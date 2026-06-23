import javax.swing.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;

/**
 * The opening menu: pick a game mode, how many players, and each player's
 * colour/icon. Hitting START swaps this panel out for the GamePanel.
 */
public class StartScreen extends JPanel {

    private final JFrame frame;

    private GameMode mode        = GameMode.RACE;
    private int      playerCount = 2;

    // Placeholder colour palette (each is one selectable "icon" for now)
    private static final Color[] PALETTE = {
        Color.YELLOW, new Color(60, 220, 90), Color.CYAN, Color.MAGENTA,
        new Color(255, 140, 0), new Color(120, 160, 255), Color.PINK, Color.WHITE
    };
    private static final String[] CONTROL_HINTS = { "Arrows", "WASD", "IJKL", "Numpad" };

    // Currently chosen palette index per player
    private final int[] chosenColor = { 0, 1, 2, 3 };

    private JPanel modeRow;
    private JPanel countRow;
    private JPanel playersPanel;

    public StartScreen(JFrame frame) {
        this.frame = frame;
        setBackground(new Color(10, 10, 28));
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setBorder(BorderFactory.createEmptyBorder(24, 30, 24, 30));
        setPreferredSize(new Dimension(620, 620));
        buildUI();
    }

    private void buildUI() {
        JLabel title = new JLabel("PAC-MAN");
        title.setForeground(Color.YELLOW);
        title.setFont(new Font("Arial", Font.BOLD, 46));
        title.setAlignmentX(CENTER_ALIGNMENT);
        add(title);

        JLabel sub = new JLabel("race & battle");
        sub.setForeground(new Color(150, 150, 180));
        sub.setFont(new Font("Arial", Font.ITALIC, 18));
        sub.setAlignmentX(CENTER_ALIGNMENT);
        add(sub);

        add(Box.createVerticalStrut(22));
        add(sectionLabel("MODE"));
        modeRow = new JPanel(new FlowLayout(FlowLayout.CENTER, 12, 6));
        modeRow.setOpaque(false);
        modeRow.add(modeButton("RACE  (3 levels, fastest wins)", GameMode.RACE));
        modeRow.add(modeButton("BATTLE  (shared map, most pellets)", GameMode.BATTLE));
        modeRow.setMaximumSize(new Dimension(620, 60));
        add(modeRow);

        add(Box.createVerticalStrut(14));
        add(sectionLabel("PLAYERS"));
        countRow = new JPanel(new FlowLayout(FlowLayout.CENTER, 10, 6));
        countRow.setOpaque(false);
        for (int n = 2; n <= 4; n++) countRow.add(countButton(n));
        countRow.setMaximumSize(new Dimension(620, 60));
        add(countRow);

        add(Box.createVerticalStrut(14));
        add(sectionLabel("ICONS  (placeholders — drop player1.png … player4.png to customise)"));
        playersPanel = new JPanel();
        playersPanel.setOpaque(false);
        playersPanel.setLayout(new BoxLayout(playersPanel, BoxLayout.Y_AXIS));
        playersPanel.setMaximumSize(new Dimension(620, 320));
        add(playersPanel);

        add(Box.createVerticalStrut(18));
        JButton start = new JButton("START GAME");
        start.setFont(new Font("Arial", Font.BOLD, 22));
        start.setBackground(new Color(255, 205, 0));
        start.setForeground(Color.BLACK);
        start.setFocusPainted(false);
        start.setAlignmentX(CENTER_ALIGNMENT);
        start.setMaximumSize(new Dimension(260, 52));
        start.addActionListener(e -> startGame());
        add(start);

        refreshModeButtons();
        refreshCountButtons();
        rebuildPlayerRows();
    }

    private JLabel sectionLabel(String text) {
        JLabel l = new JLabel(text);
        l.setForeground(new Color(120, 170, 255));
        l.setFont(new Font("Arial", Font.BOLD, 14));
        l.setAlignmentX(CENTER_ALIGNMENT);
        return l;
    }

    private JButton modeButton(String text, GameMode m) {
        JButton b = new JButton(text);
        b.setFont(new Font("Arial", Font.BOLD, 14));
        b.setFocusPainted(false);
        b.putClientProperty("mode", m);
        b.addActionListener(e -> { mode = m; refreshModeButtons(); });
        return b;
    }

    private void refreshModeButtons() {
        for (Component c : modeRow.getComponents()) {
            JButton b = (JButton) c;
            boolean sel = b.getClientProperty("mode") == mode;
            b.setBackground(sel ? new Color(255, 205, 0) : new Color(40, 40, 70));
            b.setForeground(sel ? Color.BLACK : Color.WHITE);
        }
    }

    private JButton countButton(int n) {
        JButton b = new JButton(String.valueOf(n));
        b.setFont(new Font("Arial", Font.BOLD, 20));
        b.setPreferredSize(new Dimension(56, 44));
        b.setFocusPainted(false);
        b.putClientProperty("count", n);
        b.addActionListener(e -> { playerCount = n; refreshCountButtons(); rebuildPlayerRows(); });
        return b;
    }

    private void refreshCountButtons() {
        for (Component c : countRow.getComponents()) {
            JButton b = (JButton) c;
            boolean sel = (int) (Integer) b.getClientProperty("count") == playerCount;
            b.setBackground(sel ? new Color(255, 205, 0) : new Color(40, 40, 70));
            b.setForeground(sel ? Color.BLACK : Color.WHITE);
        }
    }

    private void rebuildPlayerRows() {
        playersPanel.removeAll();
        for (int i = 0; i < playerCount; i++) {
            playersPanel.add(playerRow(i));
            playersPanel.add(Box.createVerticalStrut(6));
        }
        playersPanel.revalidate();
        playersPanel.repaint();
    }

    private JPanel playerRow(int playerIdx) {
        JPanel row = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 4));
        row.setBackground(new Color(20, 20, 44));
        row.setMaximumSize(new Dimension(560, 48));

        JLabel name = new JLabel("P" + (playerIdx + 1) + " (" + CONTROL_HINTS[playerIdx] + ")");
        name.setForeground(Color.WHITE);
        name.setFont(new Font("Arial", Font.BOLD, 13));
        name.setPreferredSize(new Dimension(120, 28));
        row.add(name);

        // colour swatches
        for (int c = 0; c < PALETTE.length; c++) {
            row.add(swatch(playerIdx, c));
        }
        return row;
    }

    private JButton swatch(int playerIdx, int colorIdx) {
        JButton b = new JButton();
        b.setPreferredSize(new Dimension(30, 30));
        b.setBackground(PALETTE[colorIdx]);
        b.setFocusPainted(false);
        updateSwatchBorder(b, chosenColor[playerIdx] == colorIdx);
        b.addActionListener(e -> {
            chosenColor[playerIdx] = colorIdx;
            rebuildPlayerRows(); // redraw borders
        });
        return b;
    }

    private void updateSwatchBorder(JButton b, boolean selected) {
        b.setBorder(selected
                ? BorderFactory.createLineBorder(Color.WHITE, 3)
                : BorderFactory.createLineBorder(new Color(60, 60, 90), 1));
    }

    private void startGame() {
        List<PlayerConfig> configs = new ArrayList<>();
        for (int i = 0; i < playerCount; i++) {
            PlayerConfig cfg = new PlayerConfig(i, PALETTE[chosenColor[i]], "P" + (i + 1));
            cfg.tryLoadIcon(i + 1);          // uses player1.png..player4.png if present
            configs.add(cfg);
        }

        GamePanel game = new GamePanel(mode, configs);
        frame.setContentPane(game);
        frame.pack();
        frame.setLocationRelativeTo(null);
        frame.revalidate();
        game.requestFocusInWindow();
    }
}
