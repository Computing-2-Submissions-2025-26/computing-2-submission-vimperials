import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.util.ArrayList;
import java.util.List;

public class GamePanel extends JPanel implements ActionListener, KeyListener {

    private final Timer    gameLoop;
    private final GameMode mode;
    private final int      playerCount;

    private final List<Board> boards = new ArrayList<>();

    // Routing: global player i -> which board, and which local index in it
    private final Board[] boardOf;
    private final int[]   localOf;

    private static final int BOARD_WIDTH  = Level.COLS * 32;
    private static final int BOARD_HEIGHT = Level.ROWS * 32;
    private static final int HEADER_HEIGHT = 72;
    private static final int BORDER = 4;

    private static final String[] CONTROL_HINTS =
        { "Arrows", "WASD", "IJKL", "Numpad" };

    // -------------------------------------------------------------------------

    public GamePanel(GameMode mode, List<PlayerConfig> configs) {
        this.mode        = mode;
        this.playerCount = configs.size();
        this.boardOf     = new Board[playerCount];
        this.localOf     = new int[playerCount];

        buildBoards(configs);

        setFocusable(true);
        addKeyListener(this);
        setPreferredSize(calculateWindowSize());
        setBackground(Color.BLACK);

        gameLoop = new Timer(16, this);
        gameLoop.start();
    }

    private void buildBoards(List<PlayerConfig> configs) {
        if (mode == GameMode.RACE) {
            // one board per player, each plays all 3 levels
            int[] art = { 0, 1, 2 }; // level i uses artwork i
            for (int i = 0; i < playerCount; i++) {
                List<PlayerConfig> single = new ArrayList<>();
                single.add(configs.get(i));
                Board b = new Board(single, Level.RACE_LEVELS, art);
                boards.add(b);
                boardOf[i] = b;
                localOf[i] = 0;
            }
        } else {
            // BATTLE: everyone on one board, single shared map (level 1 artwork)
            Board b = new Board(configs, new String[][]{ Level.LEVEL_1 }, new int[]{ 0 });
            boards.add(b);
            for (int i = 0; i < playerCount; i++) {
                boardOf[i] = b;
                localOf[i] = i;
            }
        }
    }

    private Dimension calculateWindowSize() {
        if (mode == GameMode.BATTLE) {
            return new Dimension(BOARD_WIDTH, BOARD_HEIGHT + HEADER_HEIGHT);
        }
        int w, h;
        if (playerCount == 1) {
            w = BOARD_WIDTH;            h = BOARD_HEIGHT;
        } else if (playerCount == 2) {
            w = BOARD_WIDTH * 2 + BORDER; h = BOARD_HEIGHT;
        } else {
            w = BOARD_WIDTH * 2 + BORDER; h = BOARD_HEIGHT * 2 + BORDER;
        }
        return new Dimension(w, h + HEADER_HEIGHT);
    }

    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2 = (Graphics2D) g;
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                            RenderingHints.VALUE_ANTIALIAS_ON);
        drawHeader(g2);
        drawBoards(g2);
        drawBorders(g2);
    }

    private void drawHeader(Graphics2D g) {
        g.setPaint(new GradientPaint(0, 0, new Color(8, 8, 35),
                                     0, HEADER_HEIGHT, new Color(22, 22, 60)));
        g.fillRect(0, 0, getWidth(), HEADER_HEIGHT);
        g.setColor(Color.WHITE);
        g.fillRect(0, HEADER_HEIGHT - 2, getWidth(), 2);

        g.setFont(new Font("Arial", Font.BOLD, 22));
        g.setColor(Color.YELLOW);
        g.drawString(mode == GameMode.RACE ? "PAC-MAN RACE" : "PAC-MAN BATTLE", 12, 30);

        g.setFont(new Font("Arial", Font.PLAIN, 10));
        g.setColor(new Color(150, 150, 150));
        String hint = mode == GameMode.RACE
                ? "First to clear all 3 levels wins. ESC quits."
                : "Grab the most pellets on the shared map. ESC quits.";
        g.drawString(hint, 12, 48);

        drawPlayerCards(g);
    }

    private void drawPlayerCards(Graphics2D g) {
        // Find current leader for highlighting
        int leader = -1;
        if (mode == GameMode.RACE) {
            long best = Long.MAX_VALUE;
            for (int i = 0; i < playerCount; i++) {
                Board b = boardOf[i];
                if (b.isFinished() && b.getFinishTime() < best) {
                    best = b.getFinishTime(); leader = i;
                }
            }
        } else {
            int best = Integer.MIN_VALUE;
            for (int i = 0; i < playerCount; i++) {
                int s = boardOf[i].getPlayers().get(localOf[i]).getScore();
                if (s > best) { best = s; leader = i; }
            }
        }

        int cardW = 150, gap = 6;
        int totalW = playerCount * cardW + (playerCount - 1) * gap;
        int startX = getWidth() - totalW - 8;

        for (int i = 0; i < playerCount; i++) {
            Board  b  = boardOf[i];
            Player p  = b.getPlayers().get(localOf[i]);
            Color  pc = p.getColor();
            int    cx = startX + i * (cardW + gap);
            boolean lead = (i == leader);

            g.setColor(lead ? new Color(0, 110, 0, 60)
                            : new Color(pc.getRed(), pc.getGreen(), pc.getBlue(), 22));
            g.fillRoundRect(cx, 4, cardW, HEADER_HEIGHT - 9, 8, 8);
            g.setColor(lead ? Color.GREEN : pc);
            g.setStroke(new BasicStroke(lead ? 2f : 1f));
            g.drawRoundRect(cx, 4, cardW, HEADER_HEIGHT - 9, 8, 8);
            g.setStroke(new BasicStroke(1f));

            g.setFont(new Font("Arial", Font.BOLD, 12));
            g.setColor(pc);
            g.drawString("P" + (i + 1) + " (" + CONTROL_HINTS[i] + ")", cx + 6, 19);

            g.setFont(new Font("Arial", Font.PLAIN, 11));
            g.setColor(Color.WHITE);
            g.drawString("Score: " + p.getScore(), cx + 6, 34);

            if (mode == GameMode.RACE) {
                g.drawString("Lvl " + b.getLevelNumber() + "/" + b.getTotalLevels()
                        + "   " + mmss(b.getElapsedMillis()), cx + 6, 48);
            } else {
                g.drawString("Lives: " + Math.max(0, p.getLives()), cx + 6, 48);
            }

            g.setFont(new Font("Arial", Font.BOLD, 11));
            if (b.isFinished()) {
                g.setColor(new Color(80, 255, 80));
                g.drawString(mode == GameMode.RACE ? "FINISHED" : "DONE", cx + 6, 62);
            } else if (p.isEliminated()) {
                g.setColor(new Color(255, 80, 80));
                g.drawString("OUT", cx + 6, 62);
            } else if (lead) {
                g.setColor(Color.YELLOW);
                g.drawString("LEADING", cx + 6, 62);
            }
        }
    }

    private String mmss(long ms) {
        return String.format("%02d:%02d", ms / 60000, (ms % 60000) / 1000);
    }

    private void drawBoards(Graphics2D g) {
        int yOff = HEADER_HEIGHT;
        int xOff = BOARD_WIDTH + BORDER;

        if (mode == GameMode.BATTLE) {
            boards.get(0).draw(g, 0, yOff);
            return;
        }

        switch (playerCount) {
            case 1:
                boards.get(0).draw(g, 0, yOff);
                break;
            case 2:
                boards.get(0).draw(g, 0,    yOff);
                boards.get(1).draw(g, xOff, yOff);
                break;
            case 3:
                boards.get(0).draw(g, 0,    yOff);
                boards.get(1).draw(g, xOff, yOff);
                boards.get(2).draw(g, 0,    yOff + BOARD_HEIGHT + BORDER);
                break;
            case 4:
                boards.get(0).draw(g, 0,    yOff);
                boards.get(1).draw(g, xOff, yOff);
                boards.get(2).draw(g, 0,    yOff + BOARD_HEIGHT + BORDER);
                boards.get(3).draw(g, xOff, yOff + BOARD_HEIGHT + BORDER);
                break;
        }
    }

    private void drawBorders(Graphics2D g) {
        if (mode == GameMode.BATTLE || playerCount <= 1) return;
        int yStart = HEADER_HEIGHT;
        g.setColor(new Color(80, 80, 255));
        if (playerCount == 2) {
            g.fillRect(BOARD_WIDTH, yStart, BORDER, BOARD_HEIGHT);
        } else {
            g.fillRect(BOARD_WIDTH, yStart, BORDER, BOARD_HEIGHT * 2 + BORDER);
            g.fillRect(0, yStart + BOARD_HEIGHT, BOARD_WIDTH * 2 + BORDER, BORDER);
        }
    }

    // -------------------------------------------------------------------------
    // Loop + input
    // -------------------------------------------------------------------------

    @Override
    public void actionPerformed(ActionEvent e) {
        for (Board b : boards) b.update();
        repaint();
    }

    @Override
    public void keyPressed(KeyEvent e) {
        switch (e.getKeyCode()) {
            // Player 1 — Arrows
            case KeyEvent.VK_UP:    route(0, Direction.UP);    break;
            case KeyEvent.VK_DOWN:  route(0, Direction.DOWN);  break;
            case KeyEvent.VK_LEFT:  route(0, Direction.LEFT);  break;
            case KeyEvent.VK_RIGHT: route(0, Direction.RIGHT); break;
            // Player 2 — WASD
            case KeyEvent.VK_W: route(1, Direction.UP);    break;
            case KeyEvent.VK_S: route(1, Direction.DOWN);  break;
            case KeyEvent.VK_A: route(1, Direction.LEFT);  break;
            case KeyEvent.VK_D: route(1, Direction.RIGHT); break;
            // Player 3 — IJKL
            case KeyEvent.VK_I: route(2, Direction.UP);    break;
            case KeyEvent.VK_K: route(2, Direction.DOWN);  break;
            case KeyEvent.VK_J: route(2, Direction.LEFT);  break;
            case KeyEvent.VK_L: route(2, Direction.RIGHT); break;
            // Player 4 — Numpad
            case KeyEvent.VK_NUMPAD8: route(3, Direction.UP);    break;
            case KeyEvent.VK_NUMPAD5: route(3, Direction.DOWN);  break;
            case KeyEvent.VK_NUMPAD4: route(3, Direction.LEFT);  break;
            case KeyEvent.VK_NUMPAD6: route(3, Direction.RIGHT); break;
            // Quit
            case KeyEvent.VK_ESCAPE: System.exit(0); break;
        }
    }

    private void route(int globalPlayer, Direction dir) {
        if (globalPlayer < playerCount) {
            boardOf[globalPlayer].queueDirection(localOf[globalPlayer], dir);
        }
    }

    @Override public void keyReleased(KeyEvent e) {}
    @Override public void keyTyped(KeyEvent e)    {}
}
