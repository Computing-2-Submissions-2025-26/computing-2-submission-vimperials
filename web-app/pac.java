import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.util.ArrayList;
import java.util.Random;

public class GamePanel extends JPanel implements ActionListener, KeyListener {

    private static final int TILE_SIZE = 32;

    private static final int ROWS = 21;
    private static final int COLS = 19;

    private static final int BOARD_WIDTH = COLS * TILE_SIZE;
    private static final int BOARD_HEIGHT = ROWS * TILE_SIZE;

    private final Timer gameLoop;

    private Player player;

    private final ArrayList<Rectangle> walls = new ArrayList<>();
    private final ArrayList<Pellet> pellets = new ArrayList<>();
    private final ArrayList<PowerPellet> powerPellets = new ArrayList<>();
    private final ArrayList<Ghost> ghosts = new ArrayList<>();

    private int spawnX;
    private int spawnY;

    private long startTime;

    private boolean gameWon = false;
    private boolean gameOver = false;

    private final Random random = new Random();

    public GamePanel(int players) {

        setPreferredSize(new Dimension(
                BOARD_WIDTH,
                BOARD_HEIGHT));

        setBackground(Color.BLACK);

        setFocusable(true);

        addKeyListener(this);

        loadLevel(Level.LEVEL_1);

        startTime = System.currentTimeMillis();

        gameLoop = new Timer(16, this);
        gameLoop.start();
    }

    private void loadLevel(String[] map) {

        walls.clear();
        pellets.clear();
        powerPellets.clear();
        ghosts.clear();

        for (int row = 0; row < ROWS; row++) {

            for (int col = 0; col < COLS; col++) {

                char tile = map[row].charAt(col);

                int x = col * TILE_SIZE;
                int y = row * TILE_SIZE;

                switch (tile) {

                    case 'X':
                        walls.add(
                                new Rectangle(
                                        x,
                                        y,
                                        TILE_SIZE,
                                        TILE_SIZE));
                        break;

                    case ' ':
                        pellets.add(
                                new Pellet(
                                        x + 14,
                                        y + 14));
                        break;

                    case 'E':
                        powerPellets.add(
                                new PowerPellet(
                                        x + 10,
                                        y + 10));
                        break;

                    case 'P':

                        spawnX = x + 2;
                        spawnY = y + 2;

                        player = new Player(
                                spawnX,
                                spawnY,
                                Color.YELLOW);

                        break;

                    case 'b':
                        ghosts.add(
                                new Ghost(
                                        x + 2,
                                        y + 2,
                                        Color.CYAN));
                        break;

                    case 'o':
                        ghosts.add(
                                new Ghost(
                                        x + 2,
                                        y + 2,
                                        Color.ORANGE));
                        break;

                    case 'p':
                        ghosts.add(
                                new Ghost(
                                        x + 2,
                                        y + 2,
                                        Color.PINK));
                        break;

                    case 'r':
                        ghosts.add(
                                new Ghost(
                                        x + 2,
                                        y + 2,
                                        Color.RED));
                        break;
                }
            }
        }

        for (Ghost ghost : ghosts) {
            ghost.setDirection(
                    Direction.values()[random.nextInt(4)]);
        }
    }

    private void updateGame() {

        if (gameWon || gameOver)
            return;

        player.updatePowerState();

        updatePlayer();

        updateGhosts();

        checkPellets();

        checkGhostCollisions();

        if (pellets.isEmpty() &&
                powerPellets.isEmpty()) {

            gameWon = true;
        }
    }

    private void updatePlayer() {

        tryQueuedDirection();

        double oldX = player.x;
        double oldY = player.y;

        moveEntity(player,
                player.getCurrentDirection(),
                player.speed);

        if (hitsWall(player.getBounds())) {

            player.setPosition(oldX, oldY);
        }

        tunnelWrap(player);
    }

    private void tryQueuedDirection() {

        Direction queued =
                player.getQueuedDirection();

        if (queued == Direction.NONE)
            return;

        double oldX = player.x;
        double oldY = player.y;

        moveEntity(player,
                queued,
                player.speed);

        boolean blocked =
                hitsWall(player.getBounds());

        player.setPosition(oldX, oldY);

        if (!blocked) {

            player.setCurrentDirection(
                    queued);
        }
    }

    private void updateGhosts() {

        for (Ghost ghost : ghosts) {

            double oldX = ghost.x;
            double oldY = ghost.y;

            moveEntity(
                    ghost,
                    ghost.getDirection(),
                    ghost.speed);

            if (hitsWall(
                    ghost.getBounds())) {

                ghost.setPosition(
                        oldX,
                        oldY);

                chooseNewDirection(
                        ghost);
            }

            tunnelWrap(ghost);
        }
    }

    private void chooseNewDirection(
            Ghost ghost) {

        ArrayList<Direction> valid =
                new ArrayList<>();

        for (Direction dir :
                new Direction[]{
                        Direction.UP,
                        Direction.DOWN,
                        Direction.LEFT,
                        Direction.RIGHT
                }) {

            double oldX = ghost.x;
            double oldY = ghost.y;

            moveEntity(
                    ghost,
                    dir,
                    TILE_SIZE);

            boolean blocked =
                    hitsWall(
                            ghost.getBounds());

            ghost.setPosition(
                    oldX,
                    oldY);

            if (!blocked)
                valid.add(dir);
        }

        if (!valid.isEmpty()) {

            ghost.setDirection(
                    valid.get(
                            random.nextInt(
                                    valid.size())));
        }
    }

    private void moveEntity(
            Entity entity,
            Direction dir,
            double speed) {

        switch (dir) {

            case UP:
                entity.y -= speed;
                break;

            case DOWN:
                entity.y += speed;
                break;

            case LEFT:
                entity.x -= speed;
                break;

            case RIGHT:
                entity.x += speed;
                break;
        }
    }

    private boolean hitsWall(
            Rectangle bounds) {

        for (Rectangle wall :
                walls) {

            if (bounds.intersects(wall))
                return true;
        }

        return false;
    }

    private void tunnelWrap(
            Entity entity) {

        if (entity.x <
                -entity.width) {

            entity.x = BOARD_WIDTH;
        }

        if (entity.x >
                BOARD_WIDTH) {

            entity.x = -entity.width;
        }
    }

    private void checkPellets() {

        pellets.removeIf(pellet -> {

            Rectangle pelletRect =
                    new Rectangle(
                            pellet.getX(),
                            pellet.getY(),
                            4,
                            4);

            if (player.getBounds()
                    .intersects(
                            pelletRect)) {

                player.addScore(10);

                return true;
            }

            return false;
        });

        powerPellets.removeIf(power -> {

            Rectangle powerRect =
                    new Rectangle(
                            power.getX(),
                            power.getY(),
                            12,
                            12);

            if (player.getBounds()
                    .intersects(
                            powerRect)) {

                player.addScore(50);

                player.activatePower();

                return true;
            }

            return false;
        });
    }

    private void checkGhostCollisions() {

        for (Ghost ghost : ghosts) {

            if (!player.getBounds()
                    .intersects(
                            ghost.getBounds()))
                continue;

            if (player.isPowered()) {

                ghost.setPosition(
                        BOARD_WIDTH / 2.0,
                        BOARD_HEIGHT / 2.0);

                player.addScore(200);
            }
            else {

                player.loseLife();

                player.setPosition(
                        spawnX,
                        spawnY);

                player.setCurrentDirection(
                        Direction.NONE);

                if (player.isDead()) {

                    gameOver = true;
                }
            }
        }
    }

    @Override
    protected void paintComponent(
            Graphics g) {

        super.paintComponent(g);

        Graphics2D g2 =
                (Graphics2D) g;

        drawWalls(g2);

        drawPellets(g2);

        drawGhosts(g2);

        player.draw(g2);

        drawHUD(g2);
    }

    private void drawWalls(
            Graphics2D g) {

        g.setColor(
                new Color(
                        40,
                        40,
                        255));

        for (Rectangle wall :
                walls) {

            g.fillRect(
                    wall.x,
                    wall.y,
                    wall.width,
                    wall.height);
        }
    }

    private void drawPellets(
            Graphics2D g) {

        for (Pellet pellet :
                pellets) {

            pellet.draw(g);
        }

        for (PowerPellet power :
                powerPellets) {

            power.draw(g);
        }
    }

    private void drawGhosts(
            Graphics2D g) {

        for (Ghost ghost :
                ghosts) {

            ghost.draw(g);
        }
    }

    private void drawHUD(
            Graphics2D g) {

        g.setColor(Color.WHITE);

        g.setFont(
                new Font(
                        "Arial",
                        Font.BOLD,
                        18));

        long elapsed =
                (System.currentTimeMillis()
                        - startTime) / 1000;

        g.drawString(
                "Score: "
                        + player.getScore(),
                10,
                20);

        g.drawString(
                "Lives: "
                        + player.getLives(),
                10,
                45);

        g.drawString(
                "Time: "
                        + elapsed + "s",
                10,
                70);

        if (gameWon) {

            g.setColor(Color.GREEN);

            g.drawString(
                    "YOU WIN!",
                    BOARD_WIDTH / 2 - 50,
                    BOARD_HEIGHT / 2);
        }

        if (gameOver) {

            g.setColor(Color.RED);

            g.drawString(
                    "GAME OVER",
                    BOARD_WIDTH / 2 - 60,
                    BOARD_HEIGHT / 2);
        }
    }

    @Override
    public void actionPerformed(
            ActionEvent e) {

        updateGame();

        repaint();
    }

    @Override
    public void keyPressed(
            KeyEvent e) {

        switch (
                e.getKeyCode()) {

            case KeyEvent.VK_UP:
                player.queueDirection(
                        Direction.UP);
                break;

            case KeyEvent.VK_DOWN:
                player.queueDirection(
                        Direction.DOWN);
                break;

            case KeyEvent.VK_LEFT:
                player.queueDirection(
                        Direction.LEFT);
                break;

            case KeyEvent.VK_RIGHT:
                player.queueDirection(
                        Direction.RIGHT);
                break;
        }
    }

    @Override
    public void keyReleased(
            KeyEvent e) {
    }

    @Override
    public void keyTyped(
            KeyEvent e) {
    }
}