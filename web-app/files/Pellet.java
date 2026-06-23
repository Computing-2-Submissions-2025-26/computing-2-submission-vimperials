import java.awt.Color;
import java.awt.Graphics2D;

public class Pellet {

    private final int x;
    private final int y;

    public Pellet(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int getX() { return x; }
    public int getY() { return y; }

    public void draw(Graphics2D g) {
        g.setColor(new Color(255, 230, 180));
        g.fillOval(x, y, 4, 4);
    }
}
