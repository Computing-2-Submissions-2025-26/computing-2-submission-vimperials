public class Level {

    public static final int ROWS = 21;
    public static final int COLS = 19;

    // -------------------------------------------------------------------------
    // MAP LAYOUTS
    //
    // Each character is one 32x32 tile:
    //   'X' = wall
    //   ' ' = pellet (10 pts)
    //   'E' = power pellet (50 pts, lets you eat ghosts)
    //   'P' = player spawn point
    //   'O' = empty walkable space (used for the side tunnels)
    //   'b' = cyan ghost,  'o' = orange ghost,  'p' = pink ghost,  'r' = red ghost
    //
    // To DESIGN YOUR OWN MAP: just edit these strings. Keep every row exactly
    // 19 characters wide and keep 21 rows. Make sure there is exactly one 'P'.
    // -------------------------------------------------------------------------

    public static final String[] LEVEL_1 = {
        "XXXXXXXXXXXXXXXXXXX",
        "XE      X        EX",
        "X XX XXX X XXX XX X",
        "X                 X",
        "X XX X XXXXX X XX X",
        "X    X       X    X",
        "XXXX XXXX XXXX XXXX",
        "O    X       X   OO",
        "X XX X XXrXX X X XX",
        "  XX   bpo     X   ",
        "XXXX X XXXXX X XXXX",
        "OOOX X       X XOOO",
        "XXXX X XXXXX X XXXX",
        "X        X        X",
        "X XX XXX X XXX XX X",
        "X  X     P     X  X",
        "XX X X XXXXX X X XX",
        "X    X   X   X    X",
        "X XXXXXX X XXXXXX X",
        "XE               EX",
        "XXXXXXXXXXXXXXXXXXX"
    };

    public static final String[] LEVEL_2 = {
        "XXXXXXXXXXXXXXXXXXX",
        "XE               EX",
        "X X X X X X X X X X",
        "X                 X",
        "X X X X X X X X X X",
        "X                 X",
        "X X X X X X X X X X",
        "X                 X",
        "X X X X  r  X X X X",
        "O      b p o      O",
        "X X X X     X X X X",
        "O                 O",
        "X X X X X X X X X X",
        "X                 X",
        "X X X X X X X X X X",
        "X                 X",
        "X X X X X X X X X X",
        "X                 X",
        "X X X X X X X X X X",
        "XE       P       EX",
        "XXXXXXXXXXXXXXXXXXX"
    };

    public static final String[] LEVEL_3 = {
        "XXXXXXXXXXXXXXXXXXX",
        "XE               EX",
        "X X X X X X X X X X",
        "X                 X",
        "X X X X X X X X X X",
        "X  XX XXX XXXXXX  X",
        "X X X X X X X X X X",
        "O                 O",
        "X X X X  r  X X X X",
        "X      b p o      X",
        "X X X X     X X X X",
        "X                 X",
        "X X X X X X X X X X",
        "O                 O",
        "X X X X X X X X X X",
        "X  XXXXXX XXX XX  X",
        "X X X X X X X X X X",
        "X                 X",
        "X X X X X X X X X X",
        "XE       P       EX",
        "XXXXXXXXXXXXXXXXXXX"
    };

    /** The 3 levels played in sequence during RACE mode. */
    public static final String[][] RACE_LEVELS = { LEVEL_1, LEVEL_2, LEVEL_3 };

    /** All selectable maps (index matches WALL_IMAGES / BG_IMAGES below). */
    public static final String[][] ALL_LEVELS = { LEVEL_1, LEVEL_2, LEVEL_3 };

    // -------------------------------------------------------------------------
    // PER-LEVEL ARTWORK
    //
    // To skin a level's walls with your own image, drop a 32x32 (ish) PNG into
    // the same folder as the .java files and put its filename here. The index
    // lines up with ALL_LEVELS above (level 1 -> index 0, etc.).
    // If the file is missing, the game just draws the classic blue wall instead.
    //
    // Same idea for backgrounds (drawn behind the maze). Leave "" for plain black.
    // -------------------------------------------------------------------------

    public static final String[] WALL_IMAGES = {
        "wall1.png",   // skin for LEVEL_1 walls
        "wall2.png",   // skin for LEVEL_2 walls
        "wall3.png"    // skin for LEVEL_3 walls
    };

    public static final String[] BG_IMAGES = {
        "",            // LEVEL_1 background (empty = black)
        "",            // LEVEL_2 background
        ""             // LEVEL_3 background
    };
}
