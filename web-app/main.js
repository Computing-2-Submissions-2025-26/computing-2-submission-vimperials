"use strict";
/* =========================================================================
   PAC-MAN — RACE & BATTLE  (JavaScript / HTML5 Canvas port)
   -------------------------------------------------------------------------
   HOW TO RUN
     Open this file in any modern browser. No build step, no server needed.

   OPTIONAL CUSTOM ART (all optional — the game draws vector fallbacks if a
   file is missing). Put PNGs in the SAME folder as this .html file:
       pacmanUp/Down/Left/Right.png   default Pac-Man sprites
       redGhost/pinkGhost/orangeGhost/blueGhost/scaredGhost.png
       wall1.png / wall2.png / wall3.png   per-level wall skins (see LEVELS)
       player1.png … player4.png           custom per-player icons

   CODE LAYOUT (top -> bottom)
     1. CONFIG          — every tunable constant in one block
     2. Helpers         — geometry + asset loading + vector drawing
     3. Entity classes  — Entity, Player, Ghost, Pellet, PowerPellet
     4. Board           — one playfield (movement, collisions, levels, draw)
     5. Game            — lays boards out, routes input, draws the header
     6. Bootstrap       — start screen wiring + the animation loop
   ========================================================================= */


/* =========================================================================
   1. CONFIG  —  all top-level constants live here
   ========================================================================= */
const TILE          = 32;                 // pixel size of one map tile
const ROWS          = 21;                 // map height in tiles
const COLS          = 19;                 // map width in tiles
const BOARD_WIDTH   = COLS * TILE;        // 608 px
const BOARD_HEIGHT  = ROWS * TILE;        // 672 px
const HEADER_HEIGHT = 72;                 // top status bar height
const BORDER        = 4;                  // gap drawn between race boards

const BASE_SPEED    = 3.0;                // <-- player base speed (was the bug)
const POWERED_SPEED = 4.0;                // speed while a power pellet is active
const GHOST_SPEED   = 2.0;                // ghost speed
const POWER_MS      = 7000;               // power-pellet duration (ms)

/** Direction constants (used everywhere instead of magic strings). */
const DIR  = { UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT', NONE: 'NONE' };

/** The two game modes. */
const MODE = { RACE: 'RACE', BATTLE: 'BATTLE' };

/** Control-scheme labels, indexed by player number. */
const CONTROL_HINTS = ['Arrows', 'WASD', 'IJKL', 'Numpad'];

/** Placeholder icon colours offered on the start screen. */
const PALETTE = ['#FFFF00', '#3CDC5A', '#00FFFF', '#FF00FF',
                 '#FF8C00', '#78A0FF', '#FFC0CB', '#FFFFFF'];

/** Folder (relative to index.html) where image files live. */
const ASSET_DIR = 'assets/';


/* =========================================================================
   MAP LAYOUTS
   -------------------------------------------------------------------------
   One character = one 32x32 tile:
       'X' wall      ' ' pellet     'E' power pellet   'P' player spawn
       'O' empty walkable (side tunnels)
       'b' cyan ghost  'o' orange ghost  'p' pink ghost  'r' red ghost
   To design your own map: edit the strings. Keep every row 19 chars wide,
   keep 21 rows, and include exactly one 'P'.
   ========================================================================= */
const LEVEL_1 = [
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
];

const LEVEL_2 = [
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
];

const LEVEL_3 = [
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
];

/** The 3 levels played in sequence in RACE mode. */
const RACE_LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];

/** Wall image filename per level index (missing file -> classic blue wall). */
const WALL_IMAGES = ['wall1.png', 'wall2.png', 'wall3.png'];
/** Background image filename per level index ('' -> plain black). */
const BG_IMAGES   = ['', '', ''];


const state = {
    score: 0,
    lives: 3,
    powered: false,
    player: {
        position: { x: 9, y: 15 },
        direction: "RIGHT"
    },
    ghosts: [
        { position: { x: 9, y: 9 }, scared: false },
        { position: { x: 8, y: 9 }, scared: false }
    ],
    pellets: [
        { x: 1, y: 1 },
        { x: 2, y: 1 }
    ]
};



/**
 * Get the player's current score.
 * @param {GameState} state - the current game state
 * @returns {number} the player's score in points
 */
function getScore(state) {
    return state.score;
}
/**
 * Get the number of pellets still on the board.
 * @param {GameState} state - the current game state
 * @returns {number} how many pellets remain to be eaten
 */
function getRemainingPelletCount(state) {
    return 0; // placeholder — real logic comes in the implementation pass
}
/**
 * Get the player's current amount of lives remaining.
 * @param {GameState} state - the current game state
 * @returns {number} the player's life count
 */
function getLives(state) {
    return state.lives;
}
/**
 * Get the player's current position
 * @param {GameState} state - the current game state
 * @returns {{x: number, y: number}} the player's position in grid coordinates
 */
function getPlayerPosition(state) {
    return state.playerPosition;
}



/* =========================================================================
   2. HELPERS  —  geometry, asset loading, vector drawing
   ========================================================================= */

/** Shared frame counter, incremented once per animation frame (for animation). */
let frameCount = 0;

/**
 * Strict rectangle-overlap test (matches Java's Rectangle.intersects, where
 * edge-touching counts as NOT intersecting — important for flush wall stops).
 * @param {{x:number,y:number,w:number,h:number}} a
 * @param {{x:number,y:number,w:number,h:number}} b
 * @returns {boolean} true if the rectangles overlap with positive area
 */
function rectsIntersect(a, b) {
  return a.x + a.w > b.x && b.x + b.w > a.x &&
         a.y + a.h > b.y && b.y + b.h > a.y;
}

/**
 * Tiny image cache. Each filename is loaded once; `loaded` flips true on
 * success and stays false if the file is absent (so callers can fall back).
 */
const Assets = {
  _store: {},

  /**
   * Begin loading an image by filename (relative to this html file).
   * @param {string} name
   * @returns {{name:string,img:HTMLImageElement,loaded:boolean}}
   */
  register(name) {
    let entry;                                  // <- locals declared at top
    if (this._store[name]) return this._store[name];
    entry = { name: name, img: new Image(), loaded: false };
    entry.img.onload  = function () { entry.loaded = true; };
    entry.img.onerror = function () { entry.loaded = false; };
    entry.img.src = ASSET_DIR + name;
    this._store[name] = entry;
    return entry;
  },

  /**
   * Get (and lazily start loading) the cache entry for a filename.
   * @param {string} name
   * @returns {{name:string,img:HTMLImageElement,loaded:boolean}}
   */
  get(name) {
    return this._store[name] || this.register(name);
  }
};

/** Preload every known optional asset up front. */
function preloadAssets() {
  let names, i;                                 // <- locals at top
  names = [
    'pacmanUp.png', 'pacmanDown.png', 'pacmanLeft.png', 'pacmanRight.png',
    'redGhost.png', 'pinkGhost.png', 'orangeGhost.png', 'blueGhost.png', 'scaredGhost.png',
    'wall1.png', 'wall2.png', 'wall3.png',
    'player1.png', 'player2.png', 'player3.png', 'player4.png'
  ];
  for (i = 0; i < names.length; i++) Assets.register(names[i]);
}

/**
 * Map a direction to its default Pac-Man sprite filename.
 * @param {string} dir
 * @returns {string}
 */
function pacSpriteName(dir) {
  switch (dir) {
    case DIR.UP:    return 'pacmanUp.png';
    case DIR.DOWN:  return 'pacmanDown.png';
    case DIR.LEFT:  return 'pacmanLeft.png';
    case DIR.RIGHT: return 'pacmanRight.png';
    default:        return 'pacmanRight.png';
  }
}

/**
 * Draw a vector Pac-Man (used when no sprite image is available).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  top-left x
 * @param {number} y  top-left y
 * @param {number} size
 * @param {string} dir
 * @param {string} color  CSS colour
 */
function drawPacmanVector(ctx, x, y, size, dir, color) {
  let cx, cy, r, facing, mouth, a0, a1;          // <- locals at top
  cx = x + size / 2;
  cy = y + size / 2;
  r  = size / 2;
  facing = (dir === DIR.RIGHT) ?  0
         : (dir === DIR.DOWN)  ?  Math.PI / 2
         : (dir === DIR.LEFT)  ?  Math.PI
         : (dir === DIR.UP)    ? -Math.PI / 2
         :                        0;
  mouth = (0.16 + 0.14 * (0.5 + 0.5 * Math.sin(frameCount * 0.3))) * Math.PI;
  a0 = facing + mouth;
  a1 = facing + Math.PI * 2 - mouth;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, a0, a1);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a vector ghost (used when no ghost sprite image is available).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} color  CSS colour
 * @param {boolean} scared
 */
function drawGhostVector(ctx, x, y, w, h, color, scared) {
  let r, i, footW, fx;                            // <- locals at top
  r = w / 2;
  ctx.fillStyle = scared ? '#3232C8' : color;
  ctx.beginPath();
  ctx.arc(x + r, y + r, r, Math.PI, 0);          // domed head
  ctx.lineTo(x + w, y + h);
  footW = w / 4;
  for (i = 0; i < 4; i++) {                       // wavy feet
    fx = x + w - i * footW;
    ctx.lineTo(fx - footW / 2, y + h - 5);
    ctx.lineTo(fx - footW,     y + h);
  }
  ctx.closePath();
  ctx.fill();

  // eyes
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(x + w * 0.32, y + h * 0.42, w * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.68, y + h * 0.42, w * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = scared ? '#FFFFFF' : '#1414C8';
  ctx.beginPath(); ctx.arc(x + w * 0.34, y + h * 0.46, w * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.70, y + h * 0.46, w * 0.06, 0, Math.PI * 2); ctx.fill();
}


/* =========================================================================
   3. ENTITY CLASSES
   ========================================================================= */

/** Base class for anything that moves on the board. */
class Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {number} speed
   */
  constructor(x, y, width, height, speed) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
  }

  /** @returns {{x:number,y:number,w:number,h:number}} collision box */
  getBounds() { return { x: this.x, y: this.y, w: this.width, h: this.height }; }

  /** @param {number} x @param {number} y */
  setPosition(x, y) { this.x = x; this.y = y; }
}

/**
 * One player's chosen options from the start screen.
 */
class PlayerConfig {
  /**
   * @param {number} controlScheme  0=Arrows 1=WASD 2=IJKL 3=Numpad
   * @param {string} color          CSS colour
   * @param {string} name           display label
   */
  constructor(controlScheme, color, name) {
    this.controlScheme = controlScheme;
    this.color = color;
    this.name  = name;
    this.iconName = null;   // set via tryLoadIcon()
  }

  /**
   * Point this config at a custom icon file (player{n}.png). The file is used
   * in-game only if it actually loads; otherwise the default Pac-Man is drawn.
   * @param {number} playerNumber  1-based
   */
  tryLoadIcon(playerNumber) {
    this.iconName = 'player' + playerNumber + '.png';
    Assets.register(this.iconName);
  }
}

/** A controllable Pac-Man. */
class Player extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {PlayerConfig} cfg
   */
  constructor(x, y, cfg) {
    super(x, y, TILE, TILE, BASE_SPEED);
    this.color            = cfg.color;
    this.iconName         = cfg.iconName;
    this.currentDirection = DIR.NONE;
    this.queuedDirection  = DIR.NONE;
    this.score            = 0;
    this.lives            = 3;
    this.powered          = false;
    this.powerEndTime     = 0;
    this.eliminated       = false;
  }

  /** @param {string} dir queue a direction to take at the next chance */
  queueDirection(dir) { this.queuedDirection = dir; }

  /** End the power-up if its timer has expired. */
  updatePowerState() {
    if (this.powered && Date.now() > this.powerEndTime) {
      this.powered = false;
      this.speed   = BASE_SPEED;
    }
  }

  /** Start a power-up (speed boost + ability to eat ghosts). */
  activatePower() {
    this.powered      = true;
    this.powerEndTime = Date.now() + POWER_MS;
    this.speed        = POWERED_SPEED;
  }

  /** @param {number} amount */
  addScore(amount) { this.score += amount; }

  /** Lose a life; mark eliminated if none remain. */
  loseLife() { this.lives--; if (this.lives <= 0) this.eliminated = true; }

  /**
   * Reset position/direction between levels (keeps score and lives).
   * @param {number} x @param {number} y
   */
  resetForNewLevel(x, y) {
    this.setPosition(x, y);
    this.currentDirection = DIR.NONE;
    this.queuedDirection  = DIR.NONE;
    this.powered = false;
    this.speed   = BASE_SPEED;
  }

  /**
   * Draw this player.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    let icon, sprite;                              // <- locals at top

    if (this.eliminated) {
      ctx.fillStyle = 'rgba(120,120,120,0.45)';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    icon = this.iconName ? Assets.get(this.iconName) : null;

    if (icon && icon.loaded) {
      // custom per-player image, mirrored when moving left
      this._glow(ctx, 150);
      if (this.currentDirection === DIR.LEFT) {
        ctx.save();
        ctx.translate(this.x + this.width, this.y);
        ctx.scale(-1, 1);
        ctx.drawImage(icon.img, 0, 0, this.width, this.height);
        ctx.restore();
      } else {
        ctx.drawImage(icon.img, this.x, this.y, this.width, this.height);
      }
    } else {
      sprite = Assets.get(pacSpriteName(this.currentDirection));
      if (sprite.loaded) {
        if (this.color !== '#FFFF00') this._glow(ctx, 160);
        ctx.drawImage(sprite.img, this.x, this.y, this.width, this.height);
      } else {
        drawPacmanVector(ctx, this.x, this.y, this.width, this.currentDirection, this.color);
      }
    }

    if (this.powered) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2 + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /**
   * Draw the coloured glow behind a player (so they stay distinguishable).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} alpha 0-255
   * @private
   */
  _glow(ctx, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha / 255;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2 + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** A roaming ghost. */
class Ghost extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} color      CSS colour for vector fallback
   * @param {string} imageName  sprite filename for this ghost
   */
  constructor(x, y, color, imageName) {
    super(x, y, 28, 28, GHOST_SPEED);
    this.color     = color;
    this.imageName = imageName;
    this.direction = DIR.LEFT;
    this.scared    = false;
  }

  /**
   * Draw this ghost.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    let entry;                                     // <- locals at top
    entry = this.scared ? Assets.get('scaredGhost.png') : Assets.get(this.imageName);
    if (entry && entry.loaded) {
      ctx.drawImage(entry.img, this.x, this.y, this.width, this.height);
    } else {
      drawGhostVector(ctx, this.x, this.y, this.width, this.height, this.color, this.scared);
    }
  }
}

/** A small pellet worth 10 points. (x,y) is the dot's top-left. */
class Pellet {
  /** @param {number} x @param {number} y */
  constructor(x, y) { this.x = x; this.y = y; }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    ctx.fillStyle = '#FFE6B4';
    ctx.beginPath();
    ctx.arc(this.x + 2, this.y + 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A power pellet worth 50 points that lets you eat ghosts. */
class PowerPellet {
  /** @param {number} x @param {number} y */
  constructor(x, y) { this.x = x; this.y = y; }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    ctx.fillStyle = 'rgba(255,200,0,0.35)';
    ctx.beginPath(); ctx.arc(this.x + 6, this.y + 6, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFE600';
    ctx.beginPath(); ctx.arc(this.x + 6, this.y + 6, 6, 0, Math.PI * 2); ctx.fill();
  }
}


/* =========================================================================
   4. BOARD  —  one playfield: movement, collisions, levels, drawing
   -------------------------------------------------------------------------
   RACE   : one player per board, levels = [LEVEL_1, LEVEL_2, LEVEL_3]
   BATTLE : all players on one board, levels = [ chosenMap ]
   ========================================================================= */
class Board {
  /**
   * @param {PlayerConfig[]} configs        players on this board
   * @param {string[][]}     levels         sequence of maps to play
   * @param {number[]}       levelArtIndex  artwork index per level
   */
  constructor(configs, levels, levelArtIndex) {
    // --- all instance fields declared up front ---
    this.configs       = configs;
    this.levels        = levels;
    this.levelArtIndex = levelArtIndex;
    this.levelIndex    = 0;

    this.walls        = [];
    this.pellets      = [];
    this.powerPellets = [];
    this.ghosts       = [];
    this.players      = [];

    this.spawnXs = [];
    this.spawnYs = [];

    this.startTime  = Date.now();
    this.finishTime = -1;
    this.finished   = false;
    this.gameOver   = false;

    this.wallImageName = '';
    this.bgImageName   = '';

    this.loadLevel(levels[0]);
  }

  /* ---------------------- accessors ---------------------- */

  /** @returns {Player[]} */
  getPlayers() { return this.players; }
  /** @returns {Player} convenience for single-player race boards */
  getPlayer()  { return this.players[0]; }
  getLevelNumber() { return this.levelIndex + 1; }
  getTotalLevels() { return this.levels.length; }
  getRemainingPellets() { return this.pellets.length + this.powerPellets.length; }

  /** @returns {number} elapsed time in ms (frozen once finished) */
  getElapsedMillis() {
    return this.finishTime >= 0 ? this.finishTime - this.startTime
                                : Date.now() - this.startTime;
  }

  /**
   * Queue a direction for one local player on this board.
   * @param {number} playerIndex
   * @param {string} dir
   */
  queueDirection(playerIndex, dir) {
    if (playerIndex >= 0 && playerIndex < this.players.length) {
      this.players[playerIndex].queueDirection(dir);
    }
  }

  /* ---------------------- main update ---------------------- */

  /** Advance the simulation by one frame. */
  update() {
    let anyPowered, i, p, allOut;                  // <- locals at top
    if (this.finished || this.gameOver) return;

    anyPowered = false;
    for (i = 0; i < this.players.length; i++) {
      p = this.players[i];
      if (p.eliminated) continue;
      p.updatePowerState();
      if (p.powered) anyPowered = true;
    }
    for (i = 0; i < this.ghosts.length; i++) this.ghosts[i].scared = anyPowered;

    for (i = 0; i < this.players.length; i++) {
      if (!this.players[i].eliminated) this.updatePlayer(this.players[i]);
    }
    this.updateGhosts();
    this.checkPellets();
    this.checkGhostCollisions();

    // Level cleared?
    if (this.pellets.length === 0 && this.powerPellets.length === 0) {
      if (this.levelIndex + 1 < this.levels.length) {
        this.levelIndex++;
        this.loadLevel(this.levels[this.levelIndex]);  // keeps scores & lives
      } else {
        this.finished   = true;
        this.finishTime = Date.now();
      }
    }

    // Everyone eliminated?
    allOut = true;
    for (i = 0; i < this.players.length; i++) if (!this.players[i].eliminated) allOut = false;
    if (allOut) this.gameOver = true;
  }

  /* ---------------------- level loading ---------------------- */

  /**
   * Build walls/pellets/ghosts from a map and (re)position players.
   * @param {string[]} map
   */
  loadLevel(map) {
    let artIdx, pSpawnX, pSpawnY, row, col, tile, x, y, i;  // <- locals at top

    this.walls.length = 0;
    this.pellets.length = 0;
    this.powerPellets.length = 0;
    this.ghosts.length = 0;

    artIdx = this.levelArtIndex[Math.min(this.levelIndex, this.levelArtIndex.length - 1)];
    this.wallImageName = WALL_IMAGES[artIdx] || '';
    this.bgImageName   = BG_IMAGES[artIdx]   || '';

    pSpawnX = 0; pSpawnY = 0;

    for (row = 0; row < ROWS; row++) {
      for (col = 0; col < COLS; col++) {
        tile = map[row].charAt(col);
        x = col * TILE;
        y = row * TILE;
        switch (tile) {
          case 'X': this.walls.push({ x: x, y: y, w: TILE, h: TILE }); break;
          case ' ': this.pellets.push(new Pellet(x + 14, y + 14));      break;
          case 'E': this.powerPellets.push(new PowerPellet(x + 10, y + 10)); break;
          case 'P': pSpawnX = x; pSpawnY = y;                          break;
          case 'b': this.ghosts.push(new Ghost(x + 2, y + 2, '#00FFFF', 'blueGhost.png'));   break;
          case 'o': this.ghosts.push(new Ghost(x + 2, y + 2, '#FFA500', 'orangeGhost.png')); break;
          case 'p': this.ghosts.push(new Ghost(x + 2, y + 2, '#FFC0CB', 'pinkGhost.png'));   break;
          case 'r': this.ghosts.push(new Ghost(x + 2, y + 2, '#FF0000', 'redGhost.png'));    break;
          default: break;
        }
      }
    }

    this.computeSpawnPoints(pSpawnX, pSpawnY, map);

    if (this.players.length === 0) {
      for (i = 0; i < this.configs.length; i++) {
        this.players.push(new Player(this.spawnXs[i], this.spawnYs[i], this.configs[i]));
      }
    } else {
      for (i = 0; i < this.players.length; i++) {
        this.players[i].resetForNewLevel(this.spawnXs[i], this.spawnYs[i]);
      }
    }

    for (i = 0; i < this.ghosts.length; i++) {
      this.ghosts[i].direction = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT][Math.floor(Math.random() * 4)];
    }
  }

  /**
   * Choose one spawn per player. Single player uses 'P'. Multiple players
   * (battle) are spread along a flood-fill from 'P' so they don't stack.
   * @param {number} pX @param {number} pY @param {string[]} map
   */
  computeSpawnPoints(pX, pY, map) {
    let n, startCol, startRow, seen, order, queue, dirs, cur, d, nr, nc, i, idx, cell;

    n = this.configs.length;
    this.spawnXs = new Array(n);
    this.spawnYs = new Array(n);

    if (n === 1) {
      this.spawnXs[0] = pX;
      this.spawnYs[0] = pY;
      return;
    }

    startCol = Math.floor(pX / TILE);
    startRow = Math.floor(pY / TILE);

    seen  = [];
    for (i = 0; i < ROWS; i++) seen.push(new Array(COLS).fill(false));
    order = [];
    queue = [[startRow, startCol]];
    seen[startRow][startCol] = true;
    dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length > 0) {
      cur = queue.shift();
      order.push(cur);
      for (d = 0; d < dirs.length; d++) {
        nr = cur[0] + dirs[d][0];
        nc = cur[1] + dirs[d][1];
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS &&
            !seen[nr][nc] && map[nr].charAt(nc) !== 'X') {
          seen[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }

    for (i = 0; i < n; i++) {
      idx  = Math.floor(i * (order.length - 1) / Math.max(1, n - 1));
      cell = order[idx];
      this.spawnXs[i] = cell[1] * TILE;
      this.spawnYs[i] = cell[0] * TILE;
    }
  }

  /* ----------------------------------------------------------------------
     MOVEMENT  —  grid-snapped so ANY speed works (including 3).
     This is the fix for Pac-Man sticking in walls: turns only happen from a
     grid-aligned position, and the entity snaps exactly onto the grid when it
     turns or stops against a wall.
     ---------------------------------------------------------------------- */

  /**
   * Update one player: handle the queued turn, then move with collision.
   * @param {Player} player
   */
  updatePlayer(player) {
    let queued, current, sx, sy;                   // <- locals at top
    queued  = player.queuedDirection;
    current = player.currentDirection;

    if (queued !== DIR.NONE && queued !== current) {
      if (this.isReverse(current, queued)) {
        player.currentDirection = queued;          // turning back is always ok
      } else if (this.isAligned(player)) {
        sx = player.x; sy = player.y;
        this.snapToGrid(player);
        if (this.canMove(player, queued)) {
          player.currentDirection = queued;        // keep the snapped position
        } else {
          player.setPosition(sx, sy);              // turn blocked -> undo snap
        }
      }
      // else: not aligned yet — keep the queue and retry next frame
    }

    this.moveWithCollision(player, player.currentDirection);
    this.tunnelWrap(player);
  }

  /** Move every ghost; on hitting a wall, snap and pick a new direction. */
  updateGhosts() {
    let i, ghost, oldX, oldY;                       // <- locals at top
    for (i = 0; i < this.ghosts.length; i++) {
      ghost = this.ghosts[i];
      oldX = ghost.x; oldY = ghost.y;
      this.move(ghost, ghost.direction);
      if (this.hitsWall(ghost.getBounds())) {
        ghost.setPosition(oldX, oldY);
        this.snapToGrid(ghost);
        this.chooseDirection(ghost);
      }
      this.tunnelWrap(ghost);
    }
  }

  /**
   * Pick a random valid direction for a ghost from its current tile.
   * @param {Ghost} ghost
   */
  chooseDirection(ghost) {
    let valid, all, i;                              // <- locals at top
    valid = [];
    all = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
    for (i = 0; i < all.length; i++) {
      if (this.canMove(ghost, all[i])) valid.push(all[i]);
    }
    if (valid.length > 0) {
      ghost.direction = valid[Math.floor(Math.random() * valid.length)];
    }
  }

  /**
   * Move one step; if it lands in a wall, revert and snap flush to the grid.
   * @param {Entity} e @param {string} dir
   */
  moveWithCollision(e, dir) {
    let oldX, oldY;                                 // <- locals at top
    oldX = e.x; oldY = e.y;
    this.move(e, dir);
    if (this.hitsWall(e.getBounds())) {
      e.setPosition(oldX, oldY);
      this.snapToGrid(e);
    }
  }

  /**
   * Would a single step in this direction stay out of walls?
   * @param {Entity} e @param {string} dir
   * @returns {boolean}
   */
  canMove(e, dir) {
    let ox, oy, ok;                                 // <- locals at top
    ox = e.x; oy = e.y;
    this.move(e, dir);
    ok = !this.hitsWall(e.getBounds());
    e.setPosition(ox, oy);
    return ok;
  }

  /** @returns {boolean} true if a and b are opposite directions */
  isReverse(a, b) {
    return (a === DIR.UP && b === DIR.DOWN) || (a === DIR.DOWN && b === DIR.UP) ||
           (a === DIR.LEFT && b === DIR.RIGHT) || (a === DIR.RIGHT && b === DIR.LEFT);
  }

  /** @returns {boolean} true if entity is within one step of a grid line */
  isAligned(e) {
    let tol;                                        // <- locals at top
    tol = Math.ceil(e.speed);
    return this.offsetFromGrid(e.x) <= tol && this.offsetFromGrid(e.y) <= tol;
  }

  /**
   * Distance from the nearest grid line on one axis.
   * @param {number} v
   * @returns {number}
   */
  offsetFromGrid(v) {
    let m;                                          // <- locals at top
    m = Math.round(v) % TILE;
    if (m < 0) m += TILE;
    return Math.min(m, TILE - m);
  }

  /** Snap an entity exactly onto the tile grid. @param {Entity} e */
  snapToGrid(e) {
    e.x = Math.round(e.x / TILE) * TILE;
    e.y = Math.round(e.y / TILE) * TILE;
  }

  /** Move an entity by its speed in a direction. @param {Entity} e @param {string} dir */
  move(e, dir) {
    switch (dir) {
      case DIR.UP:    e.y -= e.speed; break;
      case DIR.DOWN:  e.y += e.speed; break;
      case DIR.LEFT:  e.x -= e.speed; break;
      case DIR.RIGHT: e.x += e.speed; break;
      default: break;
    }
  }

  /**
   * @param {{x:number,y:number,w:number,h:number}} bounds
   * @returns {boolean} true if bounds overlap any wall
   */
  hitsWall(bounds) {
    let i;                                          // <- locals at top
    for (i = 0; i < this.walls.length; i++) {
      if (rectsIntersect(this.walls[i], bounds)) return true;
    }
    return false;
  }

  /** Wrap an entity through the left/right side tunnels. @param {Entity} e */
  tunnelWrap(e) {
    if (e.x < -e.width)    e.x = BOARD_WIDTH;
    if (e.x > BOARD_WIDTH) e.x = -e.width;
  }

  /* ---------------------- pickups & collisions ---------------------- */

  /** Award pellets to whichever active player touches them first. */
  checkPellets() {
    let i, j, p, player, rect;                      // <- locals at top

    for (i = this.pellets.length - 1; i >= 0; i--) {
      p = this.pellets[i];
      rect = { x: p.x, y: p.y, w: 4, h: 4 };
      for (j = 0; j < this.players.length; j++) {
        player = this.players[j];
        if (!player.eliminated && rectsIntersect(player.getBounds(), rect)) {
          player.addScore(10);
          this.pellets.splice(i, 1);
          break;
        }
      }
    }

    for (i = this.powerPellets.length - 1; i >= 0; i--) {
      p = this.powerPellets[i];
      rect = { x: p.x, y: p.y, w: 12, h: 12 };
      for (j = 0; j < this.players.length; j++) {
        player = this.players[j];
        if (!player.eliminated && rectsIntersect(player.getBounds(), rect)) {
          player.addScore(50);
          player.activatePower();
          this.powerPellets.splice(i, 1);
          break;
        }
      }
    }
  }

  /** Resolve ghost/player contact: powered eats the ghost, else lose a life. */
  checkGhostCollisions() {
    let i, j, ghost, player, idx;                   // <- locals at top
    for (i = 0; i < this.ghosts.length; i++) {
      ghost = this.ghosts[i];
      for (j = 0; j < this.players.length; j++) {
        player = this.players[j];
        if (player.eliminated) continue;
        if (!rectsIntersect(player.getBounds(), ghost.getBounds())) continue;

        if (player.powered) {
          player.addScore(200);
          ghost.setPosition(COLS * TILE / 2, ROWS * TILE / 2);
        } else {
          player.loseLife();
          idx = j;
          player.setPosition(this.spawnXs[idx], this.spawnYs[idx]);
          player.currentDirection = DIR.NONE;
        }
      }
    }
  }

  /* ---------------------- drawing ---------------------- */

  /** @returns {string} elapsed time as mm:ss.cc */
  formatTime() {
    let ms, mins, secs, centis, pad;                // <- locals at top
    ms = this.getElapsedMillis();
    mins = Math.floor(ms / 60000);
    secs = Math.floor((ms % 60000) / 1000);
    centis = Math.floor((ms % 1000) / 10);
    pad = function (v) { return (v < 10 ? '0' : '') + v; };
    return pad(mins) + ':' + pad(secs) + '.' + pad(centis);
  }

  /**
   * Draw this board at a pixel offset.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} offsetX
   * @param {number} offsetY
   */
  draw(ctx, offsetX, offsetY) {
    let bg, wall, i, w;                             // <- locals at top
    ctx.save();
    ctx.translate(offsetX, offsetY);

    // background
    bg = this.bgImageName ? Assets.get(this.bgImageName) : null;
    if (bg && bg.loaded) {
      ctx.drawImage(bg.img, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    }

    // walls (image skin if available, else classic blue)
    wall = this.wallImageName ? Assets.get(this.wallImageName) : null;
    if (wall && wall.loaded) {
      for (i = 0; i < this.walls.length; i++) {
        w = this.walls[i];
        ctx.drawImage(wall.img, w.x, w.y, w.w, w.h);
      }
    } else {
      for (i = 0; i < this.walls.length; i++) {
        w = this.walls[i];
        ctx.fillStyle = '#1E1EDC';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = '#5050FF';
        ctx.lineWidth = 1;
        ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
      }
    }

    for (i = 0; i < this.pellets.length; i++)      this.pellets[i].draw(ctx);
    for (i = 0; i < this.powerPellets.length; i++) this.powerPellets[i].draw(ctx);
    for (i = 0; i < this.ghosts.length; i++)       this.ghosts[i].draw(ctx);
    for (i = 0; i < this.players.length; i++)      this.players[i].draw(ctx);

    this.drawHUD(ctx);
    if (this.finished)      this.drawBanner(ctx, true);
    else if (this.gameOver) this.drawBanner(ctx, false);

    ctx.restore();
  }

  /**
   * Draw the per-board status strip (score/lives/level or battle/pellet info).
   * @param {CanvasRenderingContext2D} ctx
   */
  drawHUD(ctx) {
    let p, lvl, left, t, tw;                        // <- locals at top
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, BOARD_WIDTH, 30);

    if (this.players.length === 1) {
      p = this.players[0];
      ctx.font = 'bold 13px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Score ' + p.score + '   Lives ' + p.lives, 8, 20);

      lvl = 'Level ' + this.getLevelNumber() + '/' + this.getTotalLevels();
      ctx.fillStyle = '#B4DCFF';
      ctx.fillText(lvl, (BOARD_WIDTH - ctx.measureText(lvl).width) / 2, 20);
    } else {
      ctx.font = 'bold 13px Arial';
      ctx.fillStyle = '#FF7878';
      ctx.fillText('BATTLE', 8, 20);

      left = this.getRemainingPellets() + ' pellets left';
      ctx.fillStyle = '#C8C8C8';
      ctx.fillText(left, (BOARD_WIDTH - ctx.measureText(left).width) / 2, 20);
    }

    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#FFFF00';
    t = this.formatTime();
    tw = ctx.measureText(t).width;
    ctx.fillText(t, BOARD_WIDTH - tw - 8, 21);
  }

  /**
   * Draw the centred FINISHED / GAME OVER banner.
   * @param {CanvasRenderingContext2D} ctx
   * @param {boolean} win
   */
  drawBanner(ctx, win) {
    let mx, my, msg, t;                             // <- locals at top
    mx = BOARD_WIDTH / 2; my = BOARD_HEIGHT / 2;

    ctx.fillStyle = win ? 'rgba(0,140,0,0.8)' : 'rgba(140,0,0,0.8)';
    ctx.fillRect(mx - 130, my - 45, 260, 90);
    ctx.strokeStyle = win ? '#00FF00' : '#FF3C3C';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx - 130, my - 45, 260, 90);

    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#FFFFFF';
    msg = win ? 'FINISHED!' : 'GAME OVER';
    ctx.fillText(msg, mx - ctx.measureText(msg).width / 2, my + 4);

    if (win && this.players.length === 1) {
      ctx.font = 'bold 15px Arial';
      ctx.fillStyle = '#FFFF00';
      t = 'Total time: ' + this.formatTime();
      ctx.fillText(t, mx - ctx.measureText(t).width / 2, my + 28);
    }
  }
}


/* =========================================================================
   5. GAME  —  lays boards out, routes input, draws the header
   ========================================================================= */
class Game {
  /**
   * @param {string} mode      MODE.RACE or MODE.BATTLE
   * @param {PlayerConfig[]} configs
   * @param {HTMLCanvasElement} canvas
   */
  constructor(mode, configs, canvas) {
    let size, art, i, single, b;                    // <- locals at top

    this.mode        = mode;
    this.playerCount = configs.length;
    this.canvas      = canvas;
    this.ctx         = canvas.getContext('2d');
    this.boards      = [];
    this.boardOf     = new Array(this.playerCount);  // global player -> Board
    this.localOf     = new Array(this.playerCount);  // global player -> local index

    if (mode === MODE.RACE) {
      art = [0, 1, 2];                               // level i uses artwork i
      for (i = 0; i < this.playerCount; i++) {
        single = [configs[i]];
        b = new Board(single, RACE_LEVELS, art);
        this.boards.push(b);
        this.boardOf[i] = b;
        this.localOf[i] = 0;
      }
    } else {
      b = new Board(configs, [LEVEL_1], [0]);        // shared map, level-1 art
      this.boards.push(b);
      for (i = 0; i < this.playerCount; i++) {
        this.boardOf[i] = b;
        this.localOf[i] = i;
      }
    }

    size = this.calculateSize();
    canvas.width  = size.w;
    canvas.height = size.h;
  }

  /**
   * Work out the canvas size for this mode + player count.
   * @returns {{w:number,h:number}}
   */
  calculateSize() {
    let w, h;                                        // <- locals at top
    if (this.mode === MODE.BATTLE) {
      return { w: BOARD_WIDTH, h: BOARD_HEIGHT + HEADER_HEIGHT };
    }
    if (this.playerCount === 1)      { w = BOARD_WIDTH;              h = BOARD_HEIGHT; }
    else if (this.playerCount === 2) { w = BOARD_WIDTH * 2 + BORDER; h = BOARD_HEIGHT; }
    else                             { w = BOARD_WIDTH * 2 + BORDER; h = BOARD_HEIGHT * 2 + BORDER; }
    return { w: w, h: h + HEADER_HEIGHT };
  }

  /** Advance every board one frame. */
  update() {
    let i;                                           // <- locals at top
    for (i = 0; i < this.boards.length; i++) this.boards[i].update();
  }

  /** Render the whole frame: header, boards, dividers. */
  draw() {
    let ctx;                                         // <- locals at top
    ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawHeader(ctx);
    this.drawBoards(ctx);
    this.drawBorders(ctx);
  }

  /**
   * Draw the top status bar (title + per-player cards).
   * @param {CanvasRenderingContext2D} ctx
   */
  drawHeader(ctx) {
    let grad, hint;                                  // <- locals at top
    grad = ctx.createLinearGradient(0, 0, 0, HEADER_HEIGHT);
    grad.addColorStop(0, '#080823');
    grad.addColorStop(1, '#16163c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, HEADER_HEIGHT);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, HEADER_HEIGHT - 2, this.canvas.width, 2);

    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#FFFF00';
    ctx.fillText(this.mode === MODE.RACE ? 'PAC-MAN RACE' : 'PAC-MAN BATTLE', 12, 28);

    ctx.font = '10px Arial';
    ctx.fillStyle = '#969696';
    hint = this.mode === MODE.RACE
         ? 'First to clear all 3 levels wins. ESC = menu.'
         : 'Grab the most pellets on the shared map. ESC = menu.';
    ctx.fillText(hint, 12, 46);

    this.drawPlayerCards(ctx);
  }

  /**
   * Draw one card per player, highlighting the current leader.
   * @param {CanvasRenderingContext2D} ctx
   */
  drawPlayerCards(ctx) {
    let leader, best, i, b, s, cardW, gap, totalW, startX, p, pc, cx, lead;

    // find leader
    leader = -1;
    if (this.mode === MODE.RACE) {
      best = Infinity;
      for (i = 0; i < this.playerCount; i++) {
        b = this.boardOf[i];
        if (b.finished && b.finishTime < best) { best = b.finishTime; leader = i; }
      }
    } else {
      best = -Infinity;
      for (i = 0; i < this.playerCount; i++) {
        s = this.boardOf[i].getPlayers()[this.localOf[i]].score;
        if (s > best) { best = s; leader = i; }
      }
    }

    cardW = 150; gap = 6;
    totalW = this.playerCount * cardW + (this.playerCount - 1) * gap;
    startX = this.canvas.width - totalW - 8;

    for (i = 0; i < this.playerCount; i++) {
      b  = this.boardOf[i];
      p  = b.getPlayers()[this.localOf[i]];
      pc = p.color;
      cx = startX + i * (cardW + gap);
      lead = (i === leader);

      ctx.fillStyle = lead ? 'rgba(0,110,0,0.25)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(cx, 4, cardW, HEADER_HEIGHT - 9);
      ctx.strokeStyle = lead ? '#00FF00' : pc;
      ctx.lineWidth = lead ? 2 : 1;
      ctx.strokeRect(cx, 4, cardW, HEADER_HEIGHT - 9);

      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = pc;
      ctx.fillText('P' + (i + 1) + ' (' + CONTROL_HINTS[i] + ')', cx + 6, 19);

      ctx.font = '11px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Score: ' + p.score, cx + 6, 34);

      if (this.mode === MODE.RACE) {
        ctx.fillText('Lvl ' + b.getLevelNumber() + '/' + b.getTotalLevels() +
                     '   ' + this.mmss(b.getElapsedMillis()), cx + 6, 48);
      } else {
        ctx.fillText('Lives: ' + Math.max(0, p.lives), cx + 6, 48);
      }

      ctx.font = 'bold 11px Arial';
      if (b.finished) {
        ctx.fillStyle = '#50FF50';
        ctx.fillText(this.mode === MODE.RACE ? 'FINISHED' : 'DONE', cx + 6, 62);
      } else if (p.eliminated) {
        ctx.fillStyle = '#FF5050';
        ctx.fillText('OUT', cx + 6, 62);
      } else if (lead) {
        ctx.fillStyle = '#FFFF00';
        ctx.fillText('LEADING', cx + 6, 62);
      }
    }
  }

  /**
   * Format milliseconds as mm:ss.
   * @param {number} ms
   * @returns {string}
   */
  mmss(ms) {
    let m, s, pad;                                   // <- locals at top
    m = Math.floor(ms / 60000);
    s = Math.floor((ms % 60000) / 1000);
    pad = function (v) { return (v < 10 ? '0' : '') + v; };
    return pad(m) + ':' + pad(s);
  }

  /**
   * Position the boards under the header.
   * @param {CanvasRenderingContext2D} ctx
   */
  drawBoards(ctx) {
    let yOff, xOff;                                  // <- locals at top
    yOff = HEADER_HEIGHT;
    xOff = BOARD_WIDTH + BORDER;

    if (this.mode === MODE.BATTLE) {
      this.boards[0].draw(ctx, 0, yOff);
      return;
    }
    switch (this.playerCount) {
      case 1:
        this.boards[0].draw(ctx, 0, yOff);
        break;
      case 2:
        this.boards[0].draw(ctx, 0,    yOff);
        this.boards[1].draw(ctx, xOff, yOff);
        break;
      case 3:
        this.boards[0].draw(ctx, 0,    yOff);
        this.boards[1].draw(ctx, xOff, yOff);
        this.boards[2].draw(ctx, 0,    yOff + BOARD_HEIGHT + BORDER);
        break;
      case 4:
        this.boards[0].draw(ctx, 0,    yOff);
        this.boards[1].draw(ctx, xOff, yOff);
        this.boards[2].draw(ctx, 0,    yOff + BOARD_HEIGHT + BORDER);
        this.boards[3].draw(ctx, xOff, yOff + BOARD_HEIGHT + BORDER);
        break;
      default: break;
    }
  }

  /**
   * Draw the divider bars between race boards.
   * @param {CanvasRenderingContext2D} ctx
   */
  drawBorders(ctx) {
    let yStart;                                      // <- locals at top
    if (this.mode === MODE.BATTLE || this.playerCount <= 1) return;
    yStart = HEADER_HEIGHT;
    ctx.fillStyle = '#5050FF';
    if (this.playerCount === 2) {
      ctx.fillRect(BOARD_WIDTH, yStart, BORDER, BOARD_HEIGHT);
    } else {
      ctx.fillRect(BOARD_WIDTH, yStart, BORDER, BOARD_HEIGHT * 2 + BORDER);
      ctx.fillRect(0, yStart + BOARD_HEIGHT, BOARD_WIDTH * 2 + BORDER, BORDER);
    }
  }

  /**
   * Route a key press to the right board + local player.
   * @param {number} globalPlayer
   * @param {string} dir
   */
  route(globalPlayer, dir) {
    if (globalPlayer < this.playerCount) {
      this.boardOf[globalPlayer].queueDirection(this.localOf[globalPlayer], dir);
    }
  }
}


/* =========================================================================
   6. BOOTSTRAP  —  start screen wiring + animation loop
   ========================================================================= */

// --- module-level state (declared together at the top) ---
let game        = null;   // current Game instance (null while on the menu)
let rafId       = null;   // requestAnimationFrame handle
let uiMode      = MODE.RACE;
let uiCount     = 2;
let uiColors    = [0, 1, 2, 3];   // chosen PALETTE index per player

const startScreen  = document.getElementById('startScreen');
const canvasEl     = document.getElementById('game');
const modeRow      = document.getElementById('modeRow');
const countRow     = document.getElementById('countRow');
const playersPanel = document.getElementById('playersPanel');
const startBtn     = document.getElementById('startBtn');

/** Build the two mode buttons. */
function buildModeButtons() {
  let defs, i, def, btn;                            // <- locals at top
  defs = [
    { label: 'RACE  (3 levels, fastest wins)', mode: MODE.RACE },
    { label: 'BATTLE  (shared map, most pellets)', mode: MODE.BATTLE }
  ];
  modeRow.innerHTML = '';
  for (i = 0; i < defs.length; i++) {
    def = defs[i];
    btn = document.createElement('button');
    btn.className = 'toggle' + (uiMode === def.mode ? ' selected' : '');
    btn.textContent = def.label;
    btn.onclick = (function (m) {
      return function () { uiMode = m; buildModeButtons(); };
    })(def.mode);
    modeRow.appendChild(btn);
  }
}

/** Build the 2/3/4 player-count buttons. */
function buildCountButtons() {
  let n, btn;                                        // <- locals at top
  countRow.innerHTML = '';
  for (n = 2; n <= 4; n++) {
    btn = document.createElement('button');
    btn.className = 'count' + (uiCount === n ? ' selected' : '');
    btn.textContent = String(n);
    btn.onclick = (function (count) {
      return function () { uiCount = count; buildCountButtons(); buildPlayerRows(); };
    })(n);
    countRow.appendChild(btn);
  }
}

/** Build one colour-picker row per active player. */
function buildPlayerRows() {
  let i, c, row, name, sw;                           // <- locals at top
  playersPanel.innerHTML = '';
  for (i = 0; i < uiCount; i++) {
    row = document.createElement('div');
    row.className = 'playerRow';

    name = document.createElement('div');
    name.className = 'name';
    name.textContent = 'P' + (i + 1) + ' (' + CONTROL_HINTS[i] + ')';
    row.appendChild(name);

    for (c = 0; c < PALETTE.length; c++) {
      sw = document.createElement('div');
      sw.className = 'swatch' + (uiColors[i] === c ? ' selected' : '');
      sw.style.background = PALETTE[c];
      sw.onclick = (function (playerIdx, colorIdx) {
        return function () { uiColors[playerIdx] = colorIdx; buildPlayerRows(); };
      })(i, c);
      row.appendChild(sw);
    }
    playersPanel.appendChild(row);
  }
}

/** Read the menu selections, build the Game, and start the loop. */
function startGame() {
  let configs, i, cfg;                               // <- locals at top
  configs = [];
  for (i = 0; i < uiCount; i++) {
    cfg = new PlayerConfig(i, PALETTE[uiColors[i]], 'P' + (i + 1));
    cfg.tryLoadIcon(i + 1);                          // uses player{n}.png if present
    configs.push(cfg);
  }

  game = new Game(uiMode, configs, canvasEl);
  startScreen.style.display = 'none';
  canvasEl.style.display = 'block';
  startLoop();
}

/** Stop the game and return to the menu. */
function returnToMenu() {
  stopLoop();
  game = null;
  canvasEl.style.display = 'none';
  startScreen.style.display = 'block';
}

/** Begin the animation loop. */
function startLoop() {
  function tick() {
    frameCount++;
    game.update();
    game.draw();
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
}

/** Stop the animation loop. */
function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

/**
 * Global keyboard handler: routes movement keys to players, ESC to the menu.
 * @param {KeyboardEvent} e
 */
function onKeyDown(e) {
  let handled;                                       // <- locals at top
  if (!game) return;
  handled = true;

  switch (e.key) {
    // Player 1 — Arrows
    case 'ArrowUp':    game.route(0, DIR.UP);    break;
    case 'ArrowDown':  game.route(0, DIR.DOWN);  break;
    case 'ArrowLeft':  game.route(0, DIR.LEFT);  break;
    case 'ArrowRight': game.route(0, DIR.RIGHT); break;
    // Player 2 — WASD
    case 'w': case 'W': game.route(1, DIR.UP);    break;
    case 's': case 'S': game.route(1, DIR.DOWN);  break;
    case 'a': case 'A': game.route(1, DIR.LEFT);  break;
    case 'd': case 'D': game.route(1, DIR.RIGHT); break;
    // Player 3 — IJKL
    case 'i': case 'I': game.route(2, DIR.UP);    break;
    case 'k': case 'K': game.route(2, DIR.DOWN);  break;
    case 'j': case 'J': game.route(2, DIR.LEFT);  break;
    case 'l': case 'L': game.route(2, DIR.RIGHT); break;
    // Menu
    case 'Escape': returnToMenu(); break;
    default: handled = false;
  }

  // Player 4 — Numpad (use e.code so NumLock state doesn't matter)
  if (!handled) {
    handled = true;
    switch (e.code) {
      case 'Numpad8': game.route(3, DIR.UP);    break;
      case 'Numpad5': game.route(3, DIR.DOWN);  break;
      case 'Numpad4': game.route(3, DIR.LEFT);  break;
      case 'Numpad6': game.route(3, DIR.RIGHT); break;
      default: handled = false;
    }
  }

  if (handled) e.preventDefault();   // stop arrows/space scrolling the page
}

/** One-time setup. */
function init() {
  preloadAssets();
  buildModeButtons();
  buildCountButtons();
  buildPlayerRows();
  startBtn.onclick = startGame;
  window.addEventListener('keydown', onKeyDown);
}

init();