import java.awt.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.ArrayDeque;

/**
 * A single playfield. Holds one or more players and plays through a sequence
 * of levels.
 *
 *  RACE   : one player per board, levels = {LEVEL_1, LEVEL_2, LEVEL_3}.
 *  BATTLE : all players on one board, levels = { chosenMap }.
 */
public class Board {

    private static final int TILE_SIZE = 32;

    private final ArrayList<Rectangle>   walls        = new ArrayList<>();
    private final ArrayList<Pellet>      pellets      = new ArrayList<>();
    private final ArrayList<PowerPellet> powerPellets = new ArrayList<>();
    private final ArrayList<Ghost>       ghosts       = new ArrayList<>();
    private final ArrayList<Player>      players      = new ArrayList<>();

    private final List<PlayerConfig> configs;
    private final String[][]         levels;     // sequence of maps to play
    private int                      levelIndex; // which one we're on
    private final int[]              levelArtIndex; // maps level -> artwork index

    private final Random random = new Random();

    private double[] spawnXs;  // per-player spawn for the current level
    private double[] spawnYs;

    private long startTime;
    private long finishTime = -1;

    private boolean finished;
    private boolean gameOver;

    private BufferedImage wallImage; // current level's wall skin (may be null)
    private BufferedImage bgImage;   // current level's background (may be null)

    // -------------------------------------------------------------------------

    /**
     * @param configs       players on this board
     * @param levels        sequence of maps
     * @param levelArtIndex artwork index for each level (same length as levels)
     */
    public Board(List<PlayerConfig> configs, String[][] levels, int[] levelArtIndex) {
        this.configs       = configs;
        this.levels        = levels;
        this.levelArtIndex = levelArtIndex;
        this.levelIndex    = 0;
        loadLevel(levels[0]);
        startTime = System.currentTimeMillis();
    }

    // -------------------------------------------------------------------------
    // Accessors
    // -------------------------------------------------------------------------

    public List<Player> getPlayers()    { return players; }
    public Player  getPlayer()          { return players.get(0); } // race convenience
    public boolean isFinished()         { return finished; }
    public boolean isGameOver()         { return gameOver; }
    public long    getFinishTime()      { return finishTime; }
    public int     getLevelNumber()     { return levelIndex + 1; }
    public int     getTotalLevels()     { return levels.length; }

    public long getElapsedMillis() {
        return finishTime >= 0
                ? finishTime - startTime
                : System.currentTimeMillis() - startTime;
    }

    public int getRemainingPellets() {
        return pellets.size() + powerPellets.size();
    }

    public void queueDirection(int playerIndex, Direction dir) {
        if (playerIndex >= 0 && playerIndex < players.size()) {
            players.get(playerIndex).queueDirection(dir);
        }
    }

    // -------------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------------

    public void update() {
        if (finished || gameOver) return;

        boolean anyPowered = false;
        for (Player p : players) {
            if (p.isEliminated()) continue;
            p.updatePowerState();
            if (p.isPowered()) anyPowered = true;
        }
        for (Ghost g : ghosts) g.setScared(anyPowered);

        for (Player p : players) {
            if (!p.isEliminated()) updatePlayer(p);
        }
        updateGhosts();
        checkPellets();
        checkGhostCollisions();

        // Level cleared?
        if (pellets.isEmpty() && powerPellets.isEmpty()) {
            if (levelIndex + 1 < levels.length) {
                levelIndex++;
                loadLevel(levels[levelIndex]); // keeps scores & lives
            } else {
                finished   = true;
                finishTime = System.currentTimeMillis();
            }
        }

        // Everyone eliminated?
        boolean allOut = true;
        for (Player p : players) if (!p.isEliminated()) allOut = false;
        if (allOut) gameOver = true;
    }

    // -------------------------------------------------------------------------
    // Level loading
    // -------------------------------------------------------------------------

    private void loadLevel(String[] map) {
        walls.clear();
        pellets.clear();
        powerPellets.clear();
        ghosts.clear();

        int artIdx = levelArtIndex[Math.min(levelIndex, levelArtIndex.length - 1)];
        wallImage  = loadImage(Level.WALL_IMAGES[artIdx]);
        bgImage    = loadImage(Level.BG_IMAGES[artIdx]);

        double pSpawnX = 0, pSpawnY = 0;

        for (int row = 0; row < Level.ROWS; row++) {
            for (int col = 0; col < Level.COLS; col++) {
                char tile = map[row].charAt(col);
                int  x    = col * TILE_SIZE;
                int  y    = row * TILE_SIZE;

                switch (tile) {
                    case 'X': walls.add(new Rectangle(x, y, TILE_SIZE, TILE_SIZE)); break;
                    case ' ': pellets.add(new Pellet(x + 14, y + 14));              break;
                    case 'E': powerPellets.add(new PowerPellet(x + 10, y + 10));    break;
                    case 'P': pSpawnX = x; pSpawnY = y;                             break;
                    case 'b': ghosts.add(new Ghost(x + 2, y + 2, Color.CYAN));      break;
                    case 'o': ghosts.add(new Ghost(x + 2, y + 2, Color.ORANGE));    break;
                    case 'p': ghosts.add(new Ghost(x + 2, y + 2, Color.PINK));      break;
                    case 'r': ghosts.add(new Ghost(x + 2, y + 2, Color.RED));       break;
                }
            }
        }

        // Work out spawn points (one per player; spread out for battle mode)
        computeSpawnPoints(pSpawnX, pSpawnY, map);

        // Create players the first time; afterwards just reposition them
        if (players.isEmpty()) {
            for (int i = 0; i < configs.size(); i++) {
                players.add(new Player(spawnXs[i], spawnYs[i], configs.get(i)));
            }
        } else {
            for (int i = 0; i < players.size(); i++) {
                players.get(i).resetForNewLevel(spawnXs[i], spawnYs[i]);
            }
        }

        for (Ghost ghost : ghosts) {
            ghost.setDirection(Direction.values()[random.nextInt(4)]);
        }
    }

    /**
     * One spawn per player. For a single player it's just the 'P' tile.
     * For multiple players we BFS out from 'P' over open tiles and pick spots
     * that are spread apart, so battle players don't all start stacked.
     */
    private void computeSpawnPoints(double pX, double pY, String[] map) {
        int n = configs.size();
        spawnXs = new double[n];
        spawnYs = new double[n];

        if (n == 1) {
            spawnXs[0] = pX;
            spawnYs[0] = pY;
            return;
        }

        int startCol = (int) (pX / TILE_SIZE);
        int startRow = (int) (pY / TILE_SIZE);

        // BFS over walkable tiles, recording order (distance from P)
        boolean[][] seen = new boolean[Level.ROWS][Level.COLS];
        ArrayList<int[]> order = new ArrayList<>();
        ArrayDeque<int[]> q = new ArrayDeque<>();
        q.add(new int[]{startRow, startCol});
        seen[startRow][startCol] = true;
        int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};
        while (!q.isEmpty()) {
            int[] cur = q.poll();
            order.add(cur);
            for (int[] d : dirs) {
                int nr = cur[0] + d[0], nc = cur[1] + d[1];
                if (nr >= 0 && nr < Level.ROWS && nc >= 0 && nc < Level.COLS
                        && !seen[nr][nc] && map[nr].charAt(nc) != 'X') {
                    seen[nr][nc] = true;
                    q.add(new int[]{nr, nc});
                }
            }
        }

        // Pick spawn tiles evenly spaced through the BFS order (well separated)
        for (int i = 0; i < n; i++) {
            int idx = (int) ((long) i * (order.size() - 1) / Math.max(1, n - 1));
            int[] cell = order.get(idx);
            spawnXs[i] = cell[1] * TILE_SIZE;
            spawnYs[i] = cell[0] * TILE_SIZE;
        }
    }

    // -------------------------------------------------------------------------
    // Movement (grid-snapped so ANY speed works, including 3)
    // -------------------------------------------------------------------------

    private void updatePlayer(Player player) {
        Direction queued  = player.getQueuedDirection();
        Direction current = player.getCurrentDirection();

        if (queued != Direction.NONE && queued != current) {
            if (isReverse(current, queued)) {
                // turning back on the same axis is always allowed
                player.setCurrentDirection(queued);
            } else if (isAligned(player)) {
                // changing axis: only from a grid-aligned position, and snap to it
                double sx = player.x, sy = player.y;
                snapToGrid(player);
                if (canMove(player, queued)) {
                    player.setCurrentDirection(queued);   // keep snapped position
                } else {
                    player.setPosition(sx, sy);           // turn blocked, undo snap
                }
            }
            // else: not aligned yet — keep the queued dir and try again next tick
        }

        moveWithCollision(player, player.getCurrentDirection());
        tunnelWrap(player);
    }

    private void updateGhosts() {
        for (Ghost ghost : ghosts) {
            double oldX = ghost.x, oldY = ghost.y;
            move(ghost, ghost.getDirection());

            if (hitsWall(ghost.getBounds())) {
                ghost.setPosition(oldX, oldY);
                snapToGrid(ghost);
                chooseDirection(ghost);
            }
            tunnelWrap(ghost);
        }
    }

    private void chooseDirection(Ghost ghost) {
        ArrayList<Direction> valid = new ArrayList<>();
        for (Direction dir : Direction.values()) {
            if (dir == Direction.NONE) continue;
            if (canMove(ghost, dir)) valid.add(dir);
        }
        if (!valid.isEmpty()) {
            ghost.setDirection(valid.get(random.nextInt(valid.size())));
        }
    }

    /** Move one step; if it lands in a wall, revert and snap flush to the grid. */
    private void moveWithCollision(Entity e, Direction dir) {
        double oldX = e.x, oldY = e.y;
        move(e, dir);
        if (hitsWall(e.getBounds())) {
            e.setPosition(oldX, oldY);
            snapToGrid(e);
        }
    }

    /** Would a single step in this direction stay out of walls? */
    private boolean canMove(Entity e, Direction dir) {
        double ox = e.x, oy = e.y;
        move(e, dir);
        boolean ok = !hitsWall(e.getBounds());
        e.setPosition(ox, oy);
        return ok;
    }

    private boolean isReverse(Direction a, Direction b) {
        return (a == Direction.UP    && b == Direction.DOWN)
            || (a == Direction.DOWN  && b == Direction.UP)
            || (a == Direction.LEFT  && b == Direction.RIGHT)
            || (a == Direction.RIGHT && b == Direction.LEFT);
    }

    private boolean isAligned(Entity e) {
        int tol = (int) Math.ceil(e.speed);
        return offsetFromGrid(e.x) <= tol && offsetFromGrid(e.y) <= tol;
    }

    private int offsetFromGrid(double v) {
        int m = ((int) Math.round(v)) % TILE_SIZE;
        if (m < 0) m += TILE_SIZE;
        return Math.min(m, TILE_SIZE - m);
    }

    private void snapToGrid(Entity e) {
        e.x = Math.round(e.x / (double) TILE_SIZE) * TILE_SIZE;
        e.y = Math.round(e.y / (double) TILE_SIZE) * TILE_SIZE;
    }

    private void move(Entity entity, Direction direction) {
        moveDistance(entity, direction, entity.speed);
    }

    private void moveDistance(Entity entity, Direction direction, double amount) {
        switch (direction) {
            case UP:    entity.y -= amount; break;
            case DOWN:  entity.y += amount; break;
            case LEFT:  entity.x -= amount; break;
            case RIGHT: entity.x += amount; break;
        }
    }

    private boolean hitsWall(Rectangle bounds) {
        for (Rectangle wall : walls) {
            if (wall.intersects(bounds)) return true;
        }
        return false;
    }

    private void tunnelWrap(Entity entity) {
        int width = Level.COLS * TILE_SIZE;
        if (entity.x < -entity.width) entity.x = width;
        if (entity.x > width)         entity.x = -entity.width;
    }

    // -------------------------------------------------------------------------
    // Pickups & collisions
    // -------------------------------------------------------------------------

    private void checkPellets() {
        pellets.removeIf(p -> {
            Rectangle r = new Rectangle(p.getX(), p.getY(), 4, 4);
            for (Player player : players) {
                if (!player.isEliminated() && player.getBounds().intersects(r)) {
                    player.addScore(10);
                    return true;
                }
            }
            return false;
        });

        powerPellets.removeIf(p -> {
            Rectangle r = new Rectangle(p.getX(), p.getY(), 12, 12);
            for (Player player : players) {
                if (!player.isEliminated() && player.getBounds().intersects(r)) {
                    player.addScore(50);
                    player.activatePower();
                    return true;
                }
            }
            return false;
        });
    }

    private void checkGhostCollisions() {
        for (Ghost ghost : ghosts) {
            for (Player player : players) {
                if (player.isEliminated()) continue;
                if (!player.getBounds().intersects(ghost.getBounds())) continue;

                if (player.isPowered()) {
                    player.addScore(200);
                    ghost.setPosition(
                            Level.COLS * TILE_SIZE / 2.0,
                            Level.ROWS * TILE_SIZE / 2.0);
                } else {
                    player.loseLife();
                    int idx = players.indexOf(player);
                    player.setPosition(spawnXs[idx], spawnYs[idx]);
                    player.setCurrentDirection(Direction.NONE);
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Image loading
    // -------------------------------------------------------------------------

    private static BufferedImage loadImage(String name) {
        if (name == null || name.isEmpty()) return null;
        try {
            InputStream is = Board.class.getResourceAsStream("/" + name);
            if (is != null) return ImageIO.read(is);
        } catch (IOException ignored) {}
        try {
            File f = new File(name);
            if (f.exists()) return ImageIO.read(f);
        } catch (IOException ignored) {}
        return null;
    }

    // -------------------------------------------------------------------------
    // Time formatting
    // -------------------------------------------------------------------------

    private String formatTime() {
        long ms     = getElapsedMillis();
        long mins   = ms / 60000;
        long secs   = (ms % 60000) / 1000;
        long centis = (ms % 1000) / 10;
        return String.format("%02d:%02d.%02d", mins, secs, centis);
    }

    // -------------------------------------------------------------------------
    // Drawing
    // -------------------------------------------------------------------------

    public void draw(Graphics2D g, int offsetX, int offsetY) {
        Graphics2D board = (Graphics2D) g.create();
        board.translate(offsetX, offsetY);
        board.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                               RenderingHints.VALUE_ANTIALIAS_ON);

        int boardW = Level.COLS * TILE_SIZE;
        int boardH = Level.ROWS * TILE_SIZE;

        // Background
        if (bgImage != null) {
            board.drawImage(bgImage, 0, 0, boardW, boardH, null);
        } else {
            board.setColor(Color.BLACK);
            board.fillRect(0, 0, boardW, boardH);
        }

        // Walls (image skin if available, else classic blue)
        if (wallImage != null) {
            for (Rectangle wall : walls) {
                board.drawImage(wallImage, wall.x, wall.y, wall.width, wall.height, null);
            }
        } else {
            board.setColor(new Color(30, 30, 220));
            for (Rectangle wall : walls) {
                board.fillRect(wall.x, wall.y, wall.width, wall.height);
            }
            board.setColor(new Color(80, 80, 255));
            for (Rectangle wall : walls) {
                board.drawRect(wall.x, wall.y, wall.width - 1, wall.height - 1);
            }
        }

        for (Pellet      p : pellets)      p.draw(board);
        for (PowerPellet p : powerPellets) p.draw(board);
        for (Ghost  ghost  : ghosts)  ghost.draw(board);
        for (Player player : players) player.draw(board);

        drawHUD(board, boardW);

        if      (finished) drawBanner(board, boardW, boardH, true);
        else if (gameOver) drawBanner(board, boardW, boardH, false);

        board.dispose();
    }

    private void drawHUD(Graphics2D g, int boardW) {
        g.setColor(new Color(0, 0, 0, 160));
        g.fillRect(0, 0, boardW, 30);

        if (players.size() == 1) {
            Player p = players.get(0);
            g.setFont(new Font("Arial", Font.BOLD, 13));
            g.setColor(Color.WHITE);
            g.drawString("Score " + p.getScore() + "   Lives " + p.getLives(), 8, 20);

            g.setColor(new Color(180, 220, 255));
            String lvl = "Level " + getLevelNumber() + "/" + getTotalLevels();
            FontMetrics fm = g.getFontMetrics();
            g.drawString(lvl, (boardW - fm.stringWidth(lvl)) / 2, 20);
        } else {
            g.setFont(new Font("Arial", Font.BOLD, 13));
            g.setColor(new Color(255, 120, 120));
            g.drawString("BATTLE", 8, 20);

            g.setColor(new Color(200, 200, 200));
            String left = getRemainingPellets() + " pellets left";
            FontMetrics fm = g.getFontMetrics();
            g.drawString(left, (boardW - fm.stringWidth(left)) / 2, 20);
        }

        g.setFont(new Font("Arial", Font.BOLD, 14));
        g.setColor(Color.YELLOW);
        String t = formatTime();
        FontMetrics fm = g.getFontMetrics();
        g.drawString(t, boardW - fm.stringWidth(t) - 8, 21);
    }

    private void drawBanner(Graphics2D g, int boardW, int boardH, boolean win) {
        int mx = boardW / 2, my = boardH / 2;

        g.setColor(win ? new Color(0, 140, 0, 205) : new Color(140, 0, 0, 205));
        g.fillRoundRect(mx - 130, my - 45, 260, 90, 14, 14);
        g.setColor(win ? new Color(0, 255, 0) : new Color(255, 60, 60));
        g.setStroke(new BasicStroke(2f));
        g.drawRoundRect(mx - 130, my - 45, 260, 90, 14, 14);

        g.setFont(new Font("Arial", Font.BOLD, 28));
        g.setColor(Color.WHITE);
        FontMetrics fm = g.getFontMetrics();
        String msg = win ? "FINISHED!" : "GAME OVER";
        g.drawString(msg, mx - fm.stringWidth(msg) / 2, my - 2);

        if (win && players.size() == 1) {
            g.setFont(new Font("Arial", Font.BOLD, 15));
            g.setColor(Color.YELLOW);
            fm = g.getFontMetrics();
            String t = "Total time: " + formatTime();
            g.drawString(t, mx - fm.stringWidth(t) / 2, my + 25);
        }
    }
}
