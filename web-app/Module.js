// =========================================================================
// PAC-MAN RACE & BATTLE — GAME MODULE
// -------------------------------------------------------------------------
// Pure, functional game logic for the multiplayer game. No DOM, no canvas,
// no clock and no Math.random: every function returns a new value from its
// arguments alone.
//
//   * Timing (power pellets) is counted in STEPS, not milliseconds.
//   * Randomness (ghost movement) is a deterministic seed threaded through
//     the state, so `step` is a pure function of its input.
//   * Movement is tile-stepped: one tile per step. The web app interpolates
//     for smooth drawing; the rules live here.
//
// Coordinates are grid tiles: x = column (0 = left), y = row (0 = top).
//
// SHAPE OF THE STATE
//   A Game holds one or more Boards. RACE gives each player their own board
//   (and three levels); BATTLE puts every player on one shared board.
// =========================================================================

import R from "./ramda.js";

// ---- domain types -------------------------------------------------------

/**
 * A direction of travel. "NONE" means not moving.
 * @typedef {("UP"|"DOWN"|"LEFT"|"RIGHT"|"NONE")} Direction
 */

/**
 * A position on the tile grid.
 * @typedef {object} Position
 * @property {number} x - column index, 0 is the leftmost column
 * @property {number} y - row index, 0 is the topmost row
 */

/**
 * One Pac-Man.
 * @typedef {object} PlayerState
 * @property {Position} position - the tile occupied
 * @property {Direction} direction - the way it is heading
 * @property {Direction} queued - a turn requested but not yet taken
 * @property {number} score - points collected
 * @property {number} lives - lives remaining
 * @property {boolean} powered - true while it can eat ghosts
 * @property {number} powerTimer - steps of power-up left
 * @property {boolean} eliminated - true once out of lives
 * @property {Position} spawn - the tile to return to after a hit
 */

/**
 * A ghost.
 * @typedef {object} GhostState
 * @property {Position} position - the tile occupied
 * @property {Direction} direction - the way it is heading
 * @property {boolean} scared - true while edible
 * @property {Position} spawn - the tile it returns to when eaten
 */

/**
 * One playfield: its maze, pickups, ghosts and players, plus the run of
 * levels it plays through and its win/lose flags.
 * @typedef {object} BoardState
 * @property {number} cols - maze width in tiles
 * @property {number} rows - maze height in tiles
 * @property {Position[]} walls - wall tiles
 * @property {Position[]} pellets - ordinary pellets (10 points)
 * @property {Position[]} powerPellets - power pellets (50 points)
 * @property {GhostState[]} ghosts - ghosts on this board
 * @property {PlayerState[]} players - players on this board
 * @property {string[][]} levels - the maps played in sequence
 * @property {number} levelIndex - which level is in play (0-based)
 * @property {boolean} finished - true once every level is cleared
 * @property {number} finishStep - the step at which it finished, else -1
 * @property {boolean} gameOver - true once all players are eliminated
 * @property {number} steps - steps elapsed on this board
 * @property {number} seed - the random seed for ghost movement
 */

/**
 * A whole game: the mode, the boards, and which board/seat each global
 * player number maps to.
 * @typedef {object} GameState
 * @property {("RACE"|"BATTLE")} mode - the game mode
 * @property {number} playerCount - how many players are in the game
 * @property {BoardState[]} boards - the boards in play
 * @property {Array<{board: number, local: number}>} routing - player routing
 */

// ---- rules / tuning -----------------------------------------------------

const POINTS = Object.freeze({ghost: 200, pellet: 10, power: 50});
const POWER_DURATION = 30;            // steps a power pellet lasts
const PRNG_MODULUS = 2147483647;      // 2^31 - 1  (Park-Miller)
const PRNG_MULTIPLIER = 16807;

const DELTA = Object.freeze({
    DOWN: Object.freeze({x: 0, y: 1}),
    LEFT: Object.freeze({x: -1, y: 0}),
    NONE: Object.freeze({x: 0, y: 0}),
    RIGHT: Object.freeze({x: 1, y: 0}),
    UP: Object.freeze({x: 0, y: -1})
});

const OPPOSITE = Object.freeze({
    DOWN: "UP",
    LEFT: "RIGHT",
    NONE: "NONE",
    RIGHT: "LEFT",
    UP: "DOWN"
});

const MOVES = Object.freeze(["UP", "DOWN", "LEFT", "RIGHT"]);

const GHOST_CHARS = "rpbo";

const LEVEL_1 = Object.freeze([
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
]);

const LEVEL_2 = Object.freeze([
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
]);

const LEVEL_3 = Object.freeze([
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
]);

/** The levels played in sequence in RACE mode. */
const RACE_LEVELS = Object.freeze([LEVEL_1, LEVEL_2, LEVEL_3]);

// ---- deterministic pseudo-random number generator (pure) ----------------

/**
 * Advance a random seed one step (Park-Miller). Same seed in, same seed out.
 * @param {number} seed - the current seed
 * @returns {number} the next seed
 */
function nextSeed(seed) {
    return (seed * PRNG_MULTIPLIER) % PRNG_MODULUS;
}

/**
 * Draw an integer in [0, bound) together with the next seed.
 * @param {number} seed - the current seed
 * @param {number} bound - exclusive upper bound (must be > 0)
 * @returns {{value: number, seed: number}} the draw and the next seed
 */
function randomBelow(seed, bound) {
    const advanced = nextSeed(seed);
    return {seed: advanced, value: advanced % bound};
}

// ---- geometry / predicates ----------------------------------------------

/**
 * Wrap a value into [0, limit) so the side tunnels join up.
 * @param {number} value - the raw coordinate
 * @param {number} limit - the grid width
 * @returns {number} the wrapped coordinate
 */
function wrap(value, limit) {
    return ((value % limit) + limit) % limit;
}

/**
 * Are two positions the same tile?
 * @param {Position} a - the first position
 * @param {Position} b - the second position
 * @returns {boolean} true when they share a tile
 */
function samePos(a, b) {
    return a.x === b.x && a.y === b.y;
}

/**
 * Partial application: at(p) is a predicate testing "is this p?".
 * @param {Position} position - the tile to match
 * @returns {function(Position): boolean} the predicate
 */
function at(position) {
    return function (other) {
        return samePos(position, other);
    };
}

/**
 * Is the given tile a wall?
 * @param {Position[]} walls - the wall tiles
 * @param {Position} position - the tile to test
 * @returns {boolean} true if it is a wall
 */
function isWallAt(walls, position) {
    return R.any(at(position), walls);
}

/**
 * The tile one step from a position, wrapping around the side tunnels.
 * @param {BoardState} board - the board (for its width)
 * @param {Position} position - the starting tile
 * @param {Direction} direction - the direction to look in
 * @returns {Position} the tile ahead
 */
function tileAhead(board, position, direction) {
    const delta = DELTA[direction];
    return {
        x: wrap(position.x + delta.x, board.cols),
        y: position.y + delta.y
    };
}

/**
 * Can something step from a tile in a direction without hitting a wall?
 * @param {BoardState} board - the board
 * @param {Position} position - the starting tile
 * @param {Direction} direction - the direction to test
 * @returns {boolean} true if the tile ahead is walkable
 */
function canStep(board, position, direction) {
    if (direction === "NONE") {
        return false;
    }
    return !isWallAt(board.walls, tileAhead(board, position, direction));
}

// ---- map parsing & board construction -----------------------------------

/**
 * Fold one map character into the parse accumulator.
 * @param {object} acc - the running parse result
 * @param {string} ch - the map character
 * @param {number} x - its column
 * @param {number} y - its row
 * @returns {object} the updated accumulator
 */
function classifyTile(acc, ch, x, y) {
    const position = {x, y};
    if (ch === "X") {
        return R.assoc("walls", R.append(position, acc.walls), acc);
    }
    if (ch === " ") {
        return R.assoc("pellets", R.append(position, acc.pellets), acc);
    }
    if (ch === "E") {
        return R.assoc(
            "powerPellets",
            R.append(position, acc.powerPellets),
            acc
        );
    }
    if (ch === "P") {
        return R.assoc("player", position, acc);
    }
    if (GHOST_CHARS.indexOf(ch) !== -1) {
        return R.assoc("ghosts", R.append({
            direction: "LEFT",
            position,
            scared: false,
            spawn: position
        }, acc.ghosts), acc);
    }
    return acc;
}

/**
 * Read a text map into walls, pellets, ghosts and the player spawn.
 * @param {string[]} layout - rows of tile characters
 * @returns {object} the parsed pieces of the board
 */
function parseMap(layout) {
    return R.addIndex(R.reduce)(function (rowAcc, row, y) {
        return R.addIndex(R.reduce)(function (charAcc, ch, x) {
            return classifyTile(charAcc, ch, x, y);
        }, rowAcc, row.split(""));
    }, {
        ghosts: [],
        pellets: [],
        player: {x: 0, y: 0},
        powerPellets: [],
        walls: []
    }, layout);
}

/**
 * Reachable tiles from a start, in breadth-first order (used to spread out
 * the spawn points in BATTLE so players do not stack).
 * @param {number} cols - maze width
 * @param {number} rows - maze height
 * @param {Position[]} walls - wall tiles
 * @param {Position} start - the tile to flood-fill from
 * @returns {Position[]} reachable tiles in BFS order
 */
function reachableTiles(cols, rows, walls, start) {
    const seen = {};
    const order = [];
    const queue = [start];
    const keyOf = function (p) {
        return p.x + "," + p.y;
    };
    seen[keyOf(start)] = true;
    while (queue.length > 0) {
        const cur = queue.shift();
        order.push(cur);
        R.forEach(function (dir) {
            const nb = tileAhead({cols, walls}, cur, dir);
            const inBounds = (
                nb.x >= 0 && nb.x < cols && nb.y >= 0 && nb.y < rows
            );
            const fresh = seen[keyOf(nb)] !== true;
            if (inBounds && fresh && !isWallAt(walls, nb)) {
                seen[keyOf(nb)] = true;
                queue.push(nb);
            }
        }, MOVES);
    }
    return order;
}

/**
 * Choose one spawn tile per player. One player spawns on "P"; several are
 * spread evenly along the flood-fill from "P".
 * @param {number} cols - maze width
 * @param {number} rows - maze height
 * @param {Position[]} walls - wall tiles
 * @param {Position} spawn - the "P" tile
 * @param {number} count - how many spawns are needed
 * @returns {Position[]} one spawn per player
 */
function spawnPoints(cols, rows, walls, spawn, count) {
    if (count === 1) {
        return [spawn];
    }
    const order = reachableTiles(cols, rows, walls, spawn);
    return R.map(function (i) {
        const span = Math.max(1, count - 1);
        const idx = Math.floor(i * (order.length - 1) / span);
        return order[idx];
    }, R.range(0, count));
}

/**
 * Make a fresh player at a spawn tile with full lives and nothing eaten.
 * @param {Position} spawn - the spawn tile
 * @returns {PlayerState} the new player
 */
function makePlayer(spawn) {
    return {
        direction: "NONE",
        eliminated: false,
        lives: 3,
        position: spawn,
        powerTimer: 0,
        powered: false,
        queued: "NONE",
        score: 0,
        spawn
    };
}

/**
 * Build a board from a run of levels and a player count.
 * @param {string[][]} levels - the maps to play, in order
 * @param {number} playerCount - how many players share this board
 * @param {number} seed - the random seed for ghost movement
 * @returns {BoardState} a new board on its first level
 */
function createBoard(levels, playerCount, seed) {
    const layout = levels[0];
    const cols = R.reduce(R.max, 0, R.map(R.length, layout));
    const rows = layout.length;
    const parsed = parseMap(layout);
    const spawns = spawnPoints(
        cols,
        rows,
        parsed.walls,
        parsed.player,
        playerCount
    );
    return {
        cols,
        finishStep: -1,
        finished: false,
        gameOver: false,
        ghosts: parsed.ghosts,
        levelIndex: 0,
        levels,
        pellets: parsed.pellets,
        players: R.map(makePlayer, spawns),
        powerPellets: parsed.powerPellets,
        rows,
        seed,
        steps: 0,
        walls: parsed.walls
    };
}

/**
 * Swap a board onto a new level: rebuild the maze and pickups, send players
 * to fresh spawns (keeping their score, lives and elimination).
 * @param {BoardState} board - the board to change
 * @param {number} index - the level to load
 * @returns {BoardState} the board on the new level
 */
function loadLevel(board, index) {
    const layout = board.levels[index];
    const parsed = parseMap(layout);
    const spawns = spawnPoints(
        board.cols,
        board.rows,
        parsed.walls,
        parsed.player,
        board.players.length
    );
    const players = R.addIndex(R.map)(function (player, i) {
        return R.mergeRight(player, {
            direction: "NONE",
            position: spawns[i],
            powerTimer: 0,
            powered: false,
            queued: "NONE",
            spawn: spawns[i]
        });
    }, board.players);
    return R.mergeRight(board, {
        ghosts: parsed.ghosts,
        levelIndex: index,
        pellets: parsed.pellets,
        players,
        powerPellets: parsed.powerPellets,
        walls: parsed.walls
    });
}

// ---- per-step stages (each is BoardState -> BoardState, pure) -----------

/**
 * Stage: count every player's power-up down, clearing it at zero.
 * @param {BoardState} board - the board
 * @returns {BoardState} the board with power timers advanced
 */
function expirePower(board) {
    const players = R.map(function (player) {
        if (!player.powered) {
            return player;
        }
        const left = player.powerTimer - 1;
        if (left > 0) {
            return R.assoc("powerTimer", left, player);
        }
        return R.mergeRight(player, {powerTimer: 0, powered: false});
    }, board.players);
    return R.assoc("players", players, board);
}

/**
 * Stage: ghosts are scared exactly when some active player is powered.
 * @param {BoardState} board - the board
 * @returns {BoardState} the board with ghost scared flags set
 */
function applyScared(board) {
    const anyPowered = R.any(function (player) {
        return player.powered && !player.eliminated;
    }, board.players);
    const ghosts = R.map(function (ghost) {
        return R.assoc("scared", anyPowered, ghost);
    }, board.ghosts);
    return R.assoc("ghosts", ghosts, board);
}

/**
 * Move one player: take the queued turn if it is legal, then advance.
 * @param {BoardState} board - the board
 * @param {PlayerState} player - the player to move
 * @returns {PlayerState} the moved player
 */
function movePlayer(board, player) {
    if (player.eliminated) {
        return player;
    }
    const turning = (
        player.queued !== "NONE"
        && canStep(board, player.position, player.queued)
    );
    const direction = (
        turning
        ? player.queued
        : player.direction
    );
    const position = (
        canStep(board, player.position, direction)
        ? tileAhead(board, player.position, direction)
        : player.position
    );
    return R.mergeRight(player, {direction, from: player.position, position});
}

/**
 * Stage: move every player one tile.
 * @param {BoardState} board - the board
 * @returns {BoardState} the board with players moved
 */
function movePlayers(board) {
    const players = R.map(function (player) {
        return movePlayer(board, player);
    }, board.players);
    return R.assoc("players", players, board);
}

/**
 * The directions a ghost may take: prefer not to reverse, never enter a wall.
 * @param {BoardState} board - the board
 * @param {GhostState} ghost - the ghost
 * @returns {Direction[]} the legal choices
 */
function ghostOptions(board, ghost) {
    const valid = R.filter(function (dir) {
        return canStep(board, ghost.position, dir);
    }, MOVES);
    const forward = R.reject(R.equals(OPPOSITE[ghost.direction]), valid);
    return (
        forward.length > 0
        ? forward
        : valid
    );
}

/**
 * Stage: move every ghost one tile, threading the random seed through.
 * @param {BoardState} board - the board
 * @returns {BoardState} the board with ghosts moved
 */
function moveGhosts(board) {
    const result = R.reduce(function (acc, ghost) {
        const options = ghostOptions(board, ghost);
        if (options.length === 0) {
            const stay = R.assoc("from", ghost.position, ghost);
            return R.assoc("ghosts", R.append(stay, acc.ghosts), acc);
        }
        const roll = randomBelow(acc.seed, options.length);
        const direction = options[roll.value];
        const moved = R.mergeRight(ghost, {
            direction,
            from: ghost.position,
            position: tileAhead(board, ghost.position, direction)
        });
        return {ghosts: R.append(moved, acc.ghosts), seed: roll.seed};
    }, {ghosts: [], seed: board.seed}, board.ghosts);
    return R.mergeRight(board, {ghosts: result.ghosts, seed: result.seed});
}

/**
 * The lowest-index active player standing on a tile, or -1.
 * @param {PlayerState[]} players - the players
 * @param {Position} pos - the tile
 * @returns {number} the eating player's index, or -1
 */
function eaterIndex(players, pos) {
    return R.reduce(function (found, i) {
        if (found >= 0) {
            return found;
        }
        const player = players[i];
        if (!player.eliminated && samePos(player.position, pos)) {
            return i;
        }
        return found;
    }, -1, R.range(0, players.length));
}

/**
 * Add points to one player by index.
 * @param {PlayerState[]} players - the players
 * @param {number} index - which player
 * @param {number} amount - points to add
 * @returns {PlayerState[]} the updated players
 */
function award(players, index, amount) {
    return R.adjust(index, function (player) {
        return R.assoc("score", player.score + amount, player);
    }, players);
}

/**
 * Stage: eat any ordinary pellet a player is standing on (10 points each).
 * @param {BoardState} board - the board
 * @returns {BoardState} the board after pickups
 */
function eatPellets(board) {
    const tagged = R.map(function (pellet) {
        return {eater: eaterIndex(board.players, pellet), pellet};
    }, board.pellets);
    const remaining = R.map(R.prop("pellet"), R.filter(function (t) {
        return t.eater < 0;
    }, tagged));
    const players = R.reduce(function (ps, t) {
        return (
            t.eater < 0
            ? ps
            : award(ps, t.eater, POINTS.pellet)
        );
    }, board.players, tagged);
    return R.mergeRight(board, {pellets: remaining, players});
}

/**
 * Stage: eat any power pellet a player is standing on (50 points + power-up).
 * @param {BoardState} board - the board
 * @returns {BoardState} the board after pickups
 */
function eatPowerPellets(board) {
    const tagged = R.map(function (pellet) {
        return {eater: eaterIndex(board.players, pellet), pellet};
    }, board.powerPellets);
    const remaining = R.map(R.prop("pellet"), R.filter(function (t) {
        return t.eater < 0;
    }, tagged));
    const players = R.reduce(function (ps, t) {
        if (t.eater < 0) {
            return ps;
        }
        return R.adjust(t.eater, function (player) {
            return R.mergeRight(player, {
                powerTimer: POWER_DURATION,
                powered: true,
                score: player.score + POINTS.power
            });
        }, ps);
    }, board.players, tagged);
    return R.mergeRight(board, {players, powerPellets: remaining});
}

/**
 * Hit a player: lose a life, return to spawn, eliminate at zero lives.
 * @param {PlayerState} player - the player who was caught
 * @returns {PlayerState} the player after the hit
 */
function hitPlayer(player) {
    const lives = player.lives - 1;
    return R.mergeRight(player, {
        direction: "NONE",
        eliminated: lives <= 0,
        lives,
        position: player.spawn,
        queued: "NONE"
    });
}

/**
 * Does a player collide with a ghost this step? True when they end on the
 * same tile, or when they swap tiles (passing through each other).
 * @param {PlayerState} player - the player, after moving
 * @param {GhostState} ghost - the ghost, after moving
 * @returns {boolean} true on a same-tile or swap collision
 */
function collides(player, ghost) {
    const sameTile = samePos(player.position, ghost.position);
    const swapped = (
        samePos(player.position, ghost.from)
        && samePos(ghost.position, player.from)
    );
    return sameTile || swapped;
}

/**
 * Resolve one ghost against the players sharing its tile.
 * @param {object} acc - the running {ghosts, players}
 * @param {GhostState} ghost - the ghost to resolve
 * @returns {object} the updated accumulator
 */
function resolveGhost(acc, ghost) {
    const hits = R.filter(function (i) {
        const player = acc.players[i];
        return !player.eliminated && collides(player, ghost);
    }, R.range(0, acc.players.length));
    const powered = R.find(function (i) {
        return acc.players[i].powered;
    }, hits);
    if (powered !== undefined) {
        return {
            ghosts: R.append(
                R.mergeRight(ghost, {position: ghost.spawn, scared: false}),
                acc.ghosts
            ),
            players: award(acc.players, powered, POINTS.ghost)
        };
    }
    const players = R.reduce(function (ps, i) {
        return R.adjust(i, hitPlayer, ps);
    }, acc.players, hits);
    return {ghosts: R.append(ghost, acc.ghosts), players};
}

/**
 * Stage: resolve every ghost/player contact.
 * @param {BoardState} board - the board
 * @returns {BoardState} the board after collisions
 */
function resolveCollisions(board) {
    const result = R.reduce(
        resolveGhost,
        {ghosts: [], players: board.players},
        board.ghosts
    );
    return R.mergeRight(board, {
        ghosts: result.ghosts,
        players: result.players
    });
}

/**
 * Stage: if the board is clear, advance a level or mark it finished.
 * @param {BoardState} board - the board
 * @returns {BoardState} the board after the level check
 */
function checkLevelClear(board) {
    if (board.pellets.length + board.powerPellets.length > 0) {
        return board;
    }
    if (board.levelIndex + 1 < board.levels.length) {
        return loadLevel(board, board.levelIndex + 1);
    }
    return R.mergeRight(board, {finishStep: board.steps, finished: true});
}

/**
 * Stage: mark the board over once every player is eliminated.
 * @param {BoardState} board - the board
 * @returns {BoardState} the board with its game-over flag set
 */
function checkGameOver(board) {
    const allOut = R.all(R.prop("eliminated"), board.players);
    return R.assoc("gameOver", allOut, board);
}

/**
 * Stage: advance the board's step counter.
 * @param {BoardState} board - the board
 * @returns {BoardState} the board with one more step counted
 */
function incrementSteps(board) {
    return R.assoc("steps", board.steps + 1, board);
}

/** The whole one-tick board pipeline, built by composition. */
const advanceBoard = R.pipe(
    expirePower,
    applyScared,
    movePlayers,
    moveGhosts,
    eatPellets,
    eatPowerPellets,
    resolveCollisions,
    checkLevelClear,
    checkGameOver,
    incrementSteps
);

/**
 * Advance one board by a step, leaving a finished or lost board untouched.
 * @param {BoardState} board - the board
 * @returns {BoardState} the next board state
 */
function stepBoard(board) {
    if (board.finished || board.gameOver) {
        return board;
    }
    return advanceBoard(board);
}

// ---- construction (public) ----------------------------------------------

/**
 * Build a fresh game. RACE gives each player their own three-level board;
 * BATTLE puts everyone on one shared board.
 * @param {("RACE"|"BATTLE")} mode - the game mode
 * @param {number} playerCount - number of players (1-4)
 * @param {number} [seed] - starting random seed; 1 if omitted
 * @returns {GameState} a new game ready to play
 */
function createGame(mode, playerCount, seed) {
    const base = seed || 1;
    if (mode === "BATTLE") {
        return {
            boards: [createBoard([LEVEL_1], playerCount, base)],
            mode: "BATTLE",
            playerCount,
            routing: R.map(function (i) {
                return {board: 0, local: i};
            }, R.range(0, playerCount))
        };
    }
    return {
        boards: R.map(function (i) {
            return createBoard(RACE_LEVELS, 1, base + i);
        }, R.range(0, playerCount)),
        mode: "RACE",
        playerCount,
        routing: R.map(function (i) {
            return {board: i, local: 0};
        }, R.range(0, playerCount))
    };
}

/**
 * Build a single-board game from a custom map. Behaves like BATTLE on the
 * given layout; handy for custom mazes and for tests on small boards.
 * @param {string[]} layout - the map to play
 * @param {number} playerCount - number of players (1-4)
 * @param {number} [seed] - starting random seed; 1 if omitted
 * @returns {GameState} a new game on the given map
 */
function createGameFromMap(layout, playerCount, seed) {
    return {
        boards: [createBoard([layout], playerCount, seed || 1)],
        mode: "BATTLE",
        playerCount,
        routing: R.map(function (i) {
            return {board: 0, local: i};
        }, R.range(0, playerCount))
    };
}

// ---- transitions (public) -----------------------------------------------

/**
 * Queue a turn for one global player. The turn is taken on the next step,
 * once the player can legally make it.
 * @param {GameState} game - the current game
 * @param {number} player - the global player number (0-based)
 * @param {Direction} direction - the direction to request
 * @returns {GameState} a new game with that player's turn queued
 */
function setDirection(game, player, direction) {
    const route = game.routing[player];
    if (route === undefined) {
        return game;
    }
    return R.assocPath(
        ["boards", route.board, "players", route.local, "queued"],
        direction,
        game
    );
}

/**
 * Advance the whole game by one step (every board advances).
 * @param {GameState} game - the current game
 * @returns {GameState} the next game state
 */
function step(game) {
    return R.assoc("boards", R.map(stepBoard, game.boards), game);
}

// ---- queries (public) ---------------------------------------------------

/**
 * Get the game mode.
 * @param {GameState} game - the current game
 * @returns {("RACE"|"BATTLE")} the mode
 */
function getMode(game) {
    return game.mode;
}

/**
 * Get the number of players in the game.
 * @param {GameState} game - the current game
 * @returns {number} the player count
 */
function getPlayerCount(game) {
    return game.playerCount;
}

/**
 * Get every board in the game.
 * @param {GameState} game - the current game
 * @returns {BoardState[]} the boards
 */
function getBoards(game) {
    return game.boards;
}

/**
 * Get the routing table mapping each global player to a board and seat.
 * @param {GameState} game - the current game
 * @returns {Array<{board: number, local: number}>} the routing
 */
function getRouting(game) {
    return game.routing;
}

/**
 * Get the board a global player is on.
 * @param {GameState} game - the current game
 * @param {number} player - the global player number
 * @returns {BoardState} that player's board
 */
function getBoardOf(game, player) {
    return game.boards[game.routing[player].board];
}

/**
 * Get the wall tiles of a board.
 * @param {BoardState} board - the board
 * @returns {Position[]} the walls
 */
function boardWalls(board) {
    return board.walls;
}

/**
 * Get the ordinary pellets left on a board.
 * @param {BoardState} board - the board
 * @returns {Position[]} the pellets
 */
function boardPellets(board) {
    return board.pellets;
}

/**
 * Get the power pellets left on a board.
 * @param {BoardState} board - the board
 * @returns {Position[]} the power pellets
 */
function boardPowerPellets(board) {
    return board.powerPellets;
}

/**
 * Get the ghosts on a board.
 * @param {BoardState} board - the board
 * @returns {GhostState[]} the ghosts
 */
function boardGhosts(board) {
    return board.ghosts;
}

/**
 * Get the players on a board.
 * @param {BoardState} board - the board
 * @returns {PlayerState[]} the players
 */
function boardPlayers(board) {
    return board.players;
}

/**
 * Get a board's size in tiles.
 * @param {BoardState} board - the board
 * @returns {{cols: number, rows: number}} the dimensions
 */
function boardDimensions(board) {
    return {cols: board.cols, rows: board.rows};
}

/**
 * Get a board's current level number (1-based).
 * @param {BoardState} board - the board
 * @returns {number} the level number
 */
function boardLevelNumber(board) {
    return board.levelIndex + 1;
}

/**
 * Get how many levels a board plays in total.
 * @param {BoardState} board - the board
 * @returns {number} the level count
 */
function boardTotalLevels(board) {
    return board.levels.length;
}

/**
 * Count the pellets still on a board (ordinary and power together).
 * @param {BoardState} board - the board
 * @returns {number} the remaining pellet count
 */
function boardRemainingPellets(board) {
    return board.pellets.length + board.powerPellets.length;
}

/**
 * Has a board been cleared (all levels finished)?
 * @param {BoardState} board - the board
 * @returns {boolean} true on a finish
 */
function boardFinished(board) {
    return board.finished;
}

/**
 * Are all players on a board eliminated?
 * @param {BoardState} board - the board
 * @returns {boolean} true on game over
 */
function boardGameOver(board) {
    return board.gameOver;
}

/**
 * How many steps a board has run (its race "time").
 * @param {BoardState} board - the board
 * @returns {number} the step count
 */
function boardSteps(board) {
    return board.steps;
}

/**
 * Get a player's score.
 * @param {PlayerState} player - the player
 * @returns {number} the score in points
 */
function playerScore(player) {
    return player.score;
}

/**
 * Get a player's remaining lives.
 * @param {PlayerState} player - the player
 * @returns {number} the lives left
 */
function playerLives(player) {
    return player.lives;
}

/**
 * Get a player's tile.
 * @param {PlayerState} player - the player
 * @returns {Position} the position
 */
function playerPosition(player) {
    return player.position;
}

/**
 * Get the direction a player is heading.
 * @param {PlayerState} player - the player
 * @returns {Direction} the direction
 */
function playerDirection(player) {
    return player.direction;
}

/**
 * Is a player powered up?
 * @param {PlayerState} player - the player
 * @returns {boolean} true while powered
 */
function playerPowered(player) {
    return player.powered;
}

/**
 * Is a player out of the game?
 * @param {PlayerState} player - the player
 * @returns {boolean} true once eliminated
 */
function playerEliminated(player) {
    return player.eliminated;
}

/**
 * Has the game reached an end state (someone finished, or everyone out)?
 * @param {GameState} game - the current game
 * @returns {boolean} true when the game is over
 */
function isComplete(game) {
    const anyFinished = R.any(boardFinished, game.boards);
    const allOver = R.all(function (board) {
        return board.finished || board.gameOver;
    }, game.boards);
    return anyFinished || allOver;
}

/**
 * Work out the winning global player, or -1 if there is no winner yet.
 * RACE: the player whose board finished first (fewest steps). BATTLE: the
 * player with the highest score.
 * @param {GameState} game - the current game
 * @returns {number} the winning player number, or -1
 */
function getWinner(game) {
    if (game.mode === "RACE") {
        const finishers = R.filter(function (i) {
            return game.boards[i].finished;
        }, R.range(0, game.playerCount));
        if (finishers.length === 0) {
            return -1;
        }
        return R.reduce(function (best, i) {
            const bestStep = game.boards[best].finishStep;
            return (
                game.boards[i].finishStep < bestStep
                ? i
                : best
            );
        }, finishers[0], finishers);
    }
    const players = game.boards[0].players;
    if (players.length === 0) {
        return -1;
    }
    return R.reduce(function (best, i) {
        return (
            players[i].score > players[best].score
            ? i
            : best
        );
    }, 0, R.range(0, players.length));
}

// ---- exports ------------------------------------------------------------

export {
    boardDimensions,
    boardFinished,
    boardGameOver,
    boardGhosts,
    boardLevelNumber,
    boardPellets,
    boardPlayers,
    boardPowerPellets,
    boardRemainingPellets,
    boardSteps,
    boardTotalLevels,
    boardWalls,
    createGame,
    createGameFromMap,
    getBoardOf,
    getBoards,
    getMode,
    getPlayerCount,
    getRouting,
    getWinner,
    isComplete,
    playerDirection,
    playerEliminated,
    playerLives,
    playerPosition,
    playerPowered,
    playerScore,
    setDirection,
    step
};
