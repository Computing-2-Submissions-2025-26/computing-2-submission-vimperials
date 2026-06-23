import java.awt.Color;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;

/**
 * Everything chosen for one player on the start screen:
 * which control scheme they use, their colour, and (optionally)
 * a custom icon image.
 *
 * Control schemes:
 *   0 = Arrow keys
 *   1 = WASD
 *   2 = IJKL
 *   3 = Numpad 8/5/4/6
 */
public class PlayerConfig {

    public final int     controlScheme;
    public       Color   color;
    public       String  name;
    public       BufferedImage icon; // null = use the default Pac-Man sprites

    public PlayerConfig(int controlScheme, Color color, String name) {
        this.controlScheme = controlScheme;
        this.color         = color;
        this.name          = name;
        this.icon          = null;
    }

    /**
     * Looks for a custom icon file for this player, e.g. "player1.png".
     * If found it is used in-game instead of the default Pac-Man sprite.
     * Call this with a 1-based player number.
     */
    public void tryLoadIcon(int playerNumber) {
        this.icon = loadImage("player" + playerNumber + ".png");
    }

    static BufferedImage loadImage(String name) {
        try {
            InputStream is = PlayerConfig.class.getResourceAsStream("/" + name);
            if (is != null) return ImageIO.read(is);
        } catch (IOException ignored) {}
        try {
            File f = new File(name);
            if (f.exists()) return ImageIO.read(f);
        } catch (IOException ignored) {}
        return null;
    }
}
