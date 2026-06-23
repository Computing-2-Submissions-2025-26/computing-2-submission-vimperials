import java.awt.Color;
import java.awt.Graphics2D;

public class PowerPellet {

    private final int x;
    private final int y;

    public PowerPellet(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public int getX() { return x; }
    public int getY() { return y; }

    public void draw(Graphics2D g) {
        g.setColor(new Color(255, 200, 0, 90));
        g.fillOval(x - 4, y - 4, 20, 20);
        g.setColor(new Color(255, 230, 0));
        g.fillOval(x, y, 12, 12);
        g.setColor(new Color(255, 255, 210));
        g.fillOval(x + 3, y + 2, 4, 4);
    }
}
