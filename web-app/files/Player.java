import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;

public class Player extends Entity {

    public static final int SIZE = 32;

    /** Base movement speed. Bump this up/down to make the game faster or slower. */
    public static final double BASE_SPEED    = 3.0;
    public static final double POWERED_SPEED = 4.0;

    private Direction currentDirection = Direction.NONE;
    private Direction queuedDirection  = Direction.NONE;

    private int score = 0;
    private int lives = 3;

    private boolean powered      = false;
    private long    powerEndTime = 0;

    private boolean eliminated = false; // battle mode: out of lives but board continues

    private final Color         color;
    private final BufferedImage icon;   // custom per-player icon (may be null)

    // Default Pac-Man sprites (shared by every player that has no custom icon)
    private static final BufferedImage upImage;
    private static final BufferedImage downImage;
    private static final BufferedImage leftImage;
    private static final BufferedImage rightImage;

    static {
        upImage    = loadImage("pacmanUp.png");
        downImage  = loadImage("pacmanDown.png");
        leftImage  = loadImage("pacmanLeft.png");
        rightImage = loadImage("pacmanRight.png");
    }

    private static BufferedImage loadImage(String name) {
        try {
            InputStream is = Player.class.getResourceAsStream("/" + name);
            if (is != null) return ImageIO.read(is);
        } catch (IOException ignored) {}
        try {
            File f = new File(name);
            if (f.exists()) return ImageIO.read(f);
        } catch (IOException ignored) {}
        return null;
    }

    // -------------------------------------------------------------------------

    public Player(double x, double y, PlayerConfig cfg) {
        super(x, y, SIZE, SIZE, BASE_SPEED);
        this.color = cfg.color;
        this.icon  = cfg.icon;
    }

    // -------------------------------------------------------------------------
    // Direction
    // -------------------------------------------------------------------------

    public void      queueDirection(Direction dir)     { queuedDirection  = dir; }
    public Direction getCurrentDirection()             { return currentDirection; }
    public Direction getQueuedDirection()              { return queuedDirection;  }
    public void      setCurrentDirection(Direction dir){ currentDirection = dir; }

    // -------------------------------------------------------------------------
    // Power-up
    // -------------------------------------------------------------------------

    public void updatePowerState() {
        if (powered && System.currentTimeMillis() > powerEndTime) {
            powered = false;
            speed   = BASE_SPEED;
        }
    }

    public void activatePower() {
        powered      = true;
        powerEndTime = System.currentTimeMillis() + 7000;
        speed        = POWERED_SPEED;
    }

    public boolean isPowered() { return powered; }

    // -------------------------------------------------------------------------
    // Score / lives
    // -------------------------------------------------------------------------

    public void addScore(int amount) { score += amount; }
    public int  getScore()           { return score; }
    public int  getLives()           { return lives; }
    public void loseLife()           { lives--; if (lives <= 0) eliminated = true; }
    public boolean isDead()          { return lives <= 0; }
    public boolean isEliminated()    { return eliminated; }
    public Color getColor()          { return color; }

    /** Reset position/direction between levels (keeps score and lives). */
    public void resetForNewLevel(double x, double y) {
        setPosition(x, y);
        currentDirection = Direction.NONE;
        queuedDirection  = Direction.NONE;
        powered = false;
        speed   = BASE_SPEED;
    }

    // -------------------------------------------------------------------------
    // Drawing
    // -------------------------------------------------------------------------

    public void draw(Graphics2D g) {
        if (eliminated) {
            // faded marker so you can see where they fell out
            g.setColor(new Color(120, 120, 120, 120));
            g.fillOval((int) x, (int) y, width, height);
            return;
        }

        if (icon != null) {
            drawIcon(g);
        } else {
            drawDefaultPacman(g);
        }

        if (powered) {
            Stroke old = g.getStroke();
            g.setStroke(new BasicStroke(2.5f));
            g.setColor(Color.WHITE);
            g.drawOval((int) x - 4, (int) y - 4, width + 4, height + 4);
            g.setStroke(old);
        }
    }

    private void drawIcon(Graphics2D g) {
        // coloured glow so players are still distinguishable
        g.setColor(new Color(color.getRed(), color.getGreen(), color.getBlue(), 150));
        g.fillOval((int) x - 3, (int) y - 3, width + 6, height + 6);

        if (currentDirection == Direction.LEFT) {
            // mirror horizontally so the icon "faces" the way it's moving
            AffineTransform old = g.getTransform();
            g.translate(x + width, y);
            g.scale(-1, 1);
            g.drawImage(icon, 0, 0, width, height, null);
            g.setTransform(old);
        } else {
            g.drawImage(icon, (int) x, (int) y, width, height, null);
        }
    }

    private void drawDefaultPacman(Graphics2D g) {
        BufferedImage img = directionSprite();

        // Non-yellow players get a colour glow behind the (yellow) Pac-Man sprite
        if (img != null && !color.equals(Color.YELLOW)) {
            g.setColor(new Color(color.getRed(), color.getGreen(), color.getBlue(), 160));
            g.fillOval((int) x - 4, (int) y - 4, width + 8, height + 8);
        }

        if (img != null) {
            g.drawImage(img, (int) x, (int) y, width, height, null);
        } else {
            g.setColor(color);
            g.fillOval((int) x, (int) y, width, height);
        }
    }

    private BufferedImage directionSprite() {
        switch (currentDirection) {
            case UP:    return upImage;
            case DOWN:  return downImage;
            case LEFT:  return leftImage;
            case RIGHT: return rightImage;
            default:    return rightImage;
        }
    }
}
