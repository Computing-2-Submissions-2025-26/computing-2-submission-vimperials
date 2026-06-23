import java.awt.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;

public class Ghost extends Entity {

    private Direction direction;
    private boolean   scared = false;
    private final Color color;

    private static final BufferedImage redImage;
    private static final BufferedImage pinkImage;
    private static final BufferedImage orangeImage;
    private static final BufferedImage blueImage;
    private static final BufferedImage scaredImage;

    static {
        redImage    = loadImage("redGhost.png");
        pinkImage   = loadImage("pinkGhost.png");
        orangeImage = loadImage("orangeGhost.png");
        blueImage   = loadImage("blueGhost.png");
        scaredImage = loadImage("scaredGhost.png");
    }

    private static BufferedImage loadImage(String name) {
        try {
            InputStream is = Ghost.class.getResourceAsStream("/" + name);
            if (is != null) return ImageIO.read(is);
        } catch (IOException ignored) {}
        try {
            File f = new File(name);
            if (f.exists()) return ImageIO.read(f);
        } catch (IOException ignored) {}
        return null;
    }

    public Ghost(double x, double y, Color color) {
        super(x, y, 28, 28, 2.0);
        this.color = color;
        direction  = Direction.LEFT;
    }

    public Direction getDirection()              { return direction; }
    public void      setDirection(Direction dir) { direction = dir; }
    public void      setScared(boolean scared)   { this.scared = scared; }
    public boolean   isScared()                  { return scared; }

    private BufferedImage getImage() {
        if (scared && scaredImage != null) return scaredImage;
        if (color.equals(Color.RED)    && redImage    != null) return redImage;
        if (color.equals(Color.PINK)   && pinkImage   != null) return pinkImage;
        if (color.equals(Color.ORANGE) && orangeImage != null) return orangeImage;
        if (color.equals(Color.CYAN)   && blueImage   != null) return blueImage;
        return null;
    }

    public void draw(Graphics2D g) {
        BufferedImage img = getImage();
        if (img != null) {
            g.drawImage(img, (int) x, (int) y, width, height, null);
        } else {
            Color drawColor = scared ? new Color(50, 50, 200) : color;
            g.setColor(drawColor);
            g.fillRoundRect((int) x, (int) y, width, height, 8, 8);
            g.setColor(Color.WHITE);
            g.fillOval((int) x + 6,  (int) y + 8, 5, 5);
            g.fillOval((int) x + 17, (int) y + 8, 5, 5);
            g.setColor(scared ? Color.WHITE : Color.BLUE);
            g.fillOval((int) x + 7,  (int) y + 9, 3, 3);
            g.fillOval((int) x + 18, (int) y + 9, 3, 3);
        }
    }
}
