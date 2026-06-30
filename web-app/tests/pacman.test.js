// =========================================================================
// PAC-MAN RACE & BATTLE — UNIT TESTS  (Mocha)
// -------------------------------------------------------------------------
// Black-box behaviour tests. They use only the public API and tiny hand-built
// maps, so every expected score / position is a literal worked out by hand
// rather than recomputed from the module under test.
//
//   Run from the repository root:  npm test
// =========================================================================

/* global describe, it */

import assert from "node:assert/strict";
import {
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
} from "../Module.js";

// Convenience: the sole board, and one player on it, of a small game.
function board(g) {
    return getBoards(g)[0];
}

function player(g, index) {
    return boardPlayers(board(g))[index];
}

// A short corridor: wall, player, open tile (with a pellet), wall.
//   col:   0123
const CORRIDOR = ["XXXX", "XP X", "XXXX"];

describe("Setting up a game", function () {
    it("gives each player their own board in RACE mode", function () {
        const g = createGame("RACE", 3, 1);
        assert.equal(getMode(g), "RACE");
        assert.equal(getBoards(g).length, 3);
    });

    it("puts every player on one shared board in BATTLE mode", function () {
        const g = createGame("BATTLE", 2, 1);
        assert.equal(getMode(g), "BATTLE");
        assert.equal(getBoards(g).length, 1);
        assert.equal(boardPlayers(board(g)).length, 2);
    });
});

describe("Making a move", function () {
    it("advances a player one tile into open space", function () {
        const start = createGameFromMap(CORRIDOR, 1, 1);
        const next = step(setDirection(start, 0, "RIGHT"));
        assert.deepEqual(playerPosition(player(next, 0)), {x: 2, y: 1});
    });

    it("leaves a player still when it moves into a wall", function () {
        const start = createGameFromMap(CORRIDOR, 1, 1);
        const next = step(setDirection(start, 0, "LEFT"));
        assert.deepEqual(playerPosition(player(next, 0)), {x: 1, y: 1});
    });

    it("does not mutate the game it was given", function () {
        const start = createGame("BATTLE", 2, 1);
        const frozen = JSON.stringify(start);
        step(setDirection(start, 0, "LEFT"));
        assert.equal(JSON.stringify(start), frozen);
    });

    it("plays out identically for the same setup and seed", function () {
        const run = function () {
            let g = createGame("RACE", 2, 7);
            let i = 0;
            while (i < 15) {
                g = step(setDirection(g, 0, "LEFT"));
                i += 1;
            }
            return g;
        };
        assert.equal(JSON.stringify(run()), JSON.stringify(run()));
    });

    it("routes a move only to the player it was aimed at", function () {
        // RACE: player 0 and player 1 start on identical boards at "P" (9,15).
        const start = createGame("RACE", 2, 1);
        const next = step(setDirection(start, 0, "LEFT"));
        const board0 = getBoardOf(next, 0);
        const board1 = getBoardOf(next, 1);
        const p0 = boardPlayers(board0)[0];
        assert.equal(playerDirection(p0), "LEFT");
        assert.deepEqual(
            playerPosition(boardPlayers(board1)[0]),
            {x: 9, y: 15}
        );
    });
});

describe("Eating pellets", function () {
    it("scores 10 and removes the pellet for an ordinary pellet", function () {
        const start = createGameFromMap(CORRIDOR, 1, 1);
        const before = boardRemainingPellets(board(start));
        const next = step(setDirection(start, 0, "RIGHT"));
        assert.equal(playerScore(player(next, 0)), 10);
        assert.equal(boardRemainingPellets(board(next)), before - 1);
    });

    it("scores 50 and powers the player up for a power pellet", function () {
        const start = createGameFromMap(["XXXX", "XPEX", "XXXX"], 1, 1);
        const next = step(setDirection(start, 0, "RIGHT"));
        assert.equal(playerScore(player(next, 0)), 50);
        assert.equal(playerPowered(player(next, 0)), true);
    });
});

describe("Ghost encounters", function () {
    // Player eats the power pellet at (2,1); the lone ghost's only move is
    // left onto the player's tile, so the powered collision is guaranteed.
    it("eats a ghost while powered for 200 and keeps every life", function () {
        const start = createGameFromMap(["XXXXX", "XPErX", "XXXXX"], 1, 1);
        const next = step(setDirection(start, 0, "RIGHT"));
        assert.equal(playerScore(player(next, 0)), 250);
        assert.equal(playerLives(player(next, 0)), 3);
    });

    // Same geometry without the power pellet: a certain unpowered collision.
    it("costs one life and respawns the player when unpowered", function () {
        const start = createGameFromMap(["XXXXX", "XP rX", "XXXXX"], 1, 1);
        const next = step(setDirection(start, 0, "RIGHT"));
        assert.equal(playerLives(player(next, 0)), 2);
        assert.deepEqual(playerPosition(player(next, 0)), {x: 1, y: 1});
    });

    it("loses a life when a ghost passes through the player", function () {
        const start = createGameFromMap(["XXXX", "XPrX", "XXXX"], 1, 1);
        const next = step(setDirection(start, 0, "RIGHT"));
        assert.equal(playerLives(player(next, 0)), 2);
        assert.deepEqual(playerPosition(player(next, 0)), {x: 1, y: 1});
    });

    it("eats a ghost it passes through while powered", function () {
        const map = ["XXXXXX", "XPE rX", "XXXXXX"];
        let g = step(setDirection(createGameFromMap(map, 1, 1), 0, "RIGHT"));
        g = step(g);
        assert.equal(playerLives(player(g, 0)), 3);
        assert.deepEqual(boardGhosts(board(g))[0].position, {x: 4, y: 1});
    });
});

describe("Ending the game", function () {
    it("finishes the board once the last pellet is eaten", function () {
        const start = createGameFromMap(CORRIDOR, 1, 1);
        const next = step(setDirection(start, 0, "RIGHT"));
        assert.equal(boardFinished(board(next)), true);
        assert.equal(isComplete(next), true);
        assert.equal(getWinner(next), 0);
    });

    // Three ghosts each have one forced move onto the still player, stripping
    // all three lives in a single step. The walled-off pellet at (5,1) keeps
    // the empty board from also counting as finished.
    it("eliminates a player and ends when the last life is gone", function () {
        const map = ["XXXXXXX", "XrPrX X", "XXrXXXX", "XXXXXXX"];
        const start = createGameFromMap(map, 1, 1);
        const next = step(start);
        assert.equal(playerLives(player(next, 0)), 0);
        assert.equal(playerEliminated(player(next, 0)), true);
        assert.equal(boardGameOver(board(next)), true);
    });

    it("ignores further steps once a board has finished", function () {
        const won = step(setDirection(
            createGameFromMap(CORRIDOR, 1, 1),
            0,
            "RIGHT"
        ));
        assert.equal(JSON.stringify(step(won)), JSON.stringify(won));
    });

    it("reports no winner before anyone has finished a RACE", function () {
        assert.equal(getWinner(createGame("RACE", 2, 1)), -1);
    });

    it("is not complete at the start", function () {
        assert.equal(isComplete(createGame("BATTLE", 2, 1)), false);
        assert.equal(isComplete(createGame("RACE", 2, 1)), false);
    });
});

describe("Reading game setup", function () {
    it("reports the number of players", function () {
        assert.equal(getPlayerCount(createGame("BATTLE", 3, 1)), 3);
    });

    it("routes every player to the shared board in BATTLE", function () {
        assert.deepEqual(getRouting(createGame("BATTLE", 2, 1)), [
            {board: 0, local: 0},
            {board: 0, local: 1}
        ]);
    });

    it("routes each player to their own board in RACE", function () {
        assert.deepEqual(getRouting(createGame("RACE", 3, 1)), [
            {board: 0, local: 0},
            {board: 1, local: 0},
            {board: 2, local: 0}
        ]);
    });

    it("finds the board a given player is on", function () {
        const battle = createGame("BATTLE", 2, 1);
        assert.equal(getBoardOf(battle, 0), getBoardOf(battle, 1));
        const race = createGame("RACE", 2, 1);
        assert.notEqual(getBoardOf(race, 0), getBoardOf(race, 1));
    });
});

describe("Reading a board", function () {
    it("reports its dimensions in tiles", function () {
        const b = board(createGameFromMap(CORRIDOR, 1, 1));
        assert.deepEqual(boardDimensions(b), {cols: 4, rows: 3});
    });

    it("knows how many levels it plays", function () {
        const race = getBoardOf(createGame("RACE", 1, 1), 0);
        const custom = board(createGameFromMap(CORRIDOR, 1, 1));
        assert.equal(boardTotalLevels(race), 3);
        assert.equal(boardTotalLevels(custom), 1);
    });

    it("starts on level 1", function () {
        const g = createGame("RACE", 1, 1);
        assert.equal(boardLevelNumber(getBoardOf(g, 0)), 1);
    });

    it("reads walls and pellets from the map", function () {
        const b = board(createGameFromMap(CORRIDOR, 1, 1));
        assert.equal(boardWalls(b).length, 10);
        assert.equal(boardPellets(b).length, 1);
        assert.equal(boardPowerPellets(b).length, 0);
    });

    it("reads ghosts from the map", function () {
        const map = ["XXXX", "XrPX", "XXXX"];
        const ghosts = boardGhosts(board(
            createGameFromMap(map, 1, 1)
        ));
        assert.equal(ghosts.length, 1);
        assert.deepEqual(ghosts[0].position, {x: 1, y: 1});
    });

    it("counts the steps it has run", function () {
        const start = createGameFromMap(CORRIDOR, 1, 1);
        let g = setDirection(start, 0, "LEFT");
        assert.equal(boardSteps(board(g)), 0);
        let i = 0;
        while (i < 3) {
            g = step(g);
            i += 1;
        }
        assert.equal(boardSteps(board(g)), 3);
    });
});

describe("Queuing a turn", function () {
    it("queues a turn without moving until the next step", function () {
        const start = createGameFromMap(CORRIDOR, 1, 1);
        const queued = setDirection(start, 0, "RIGHT");
        assert.deepEqual(playerPosition(player(queued, 0)), {x: 1, y: 1});
        assert.equal(playerDirection(player(queued, 0)), "NONE");
    });

    it("ignores a queued turn that runs into a wall", function () {
        const start = createGameFromMap(CORRIDOR, 1, 1);
        const next = step(setDirection(start, 0, "LEFT"));
        assert.equal(playerDirection(player(next, 0)), "NONE");
        assert.deepEqual(playerPosition(player(next, 0)), {x: 1, y: 1});
    });
});

describe("Power-ups in depth", function () {
    it("does not power a player up for an ordinary pellet", function () {
        const start = createGameFromMap(CORRIDOR, 1, 1);
        const next = step(setDirection(start, 0, "RIGHT"));
        assert.equal(playerPowered(player(next, 0)), false);
    });

    it("wears off after its power-up duration", function () {
        const map = ["XXXXX", "XPE X", "XXXXX"];
        const eaten = step(setDirection(
            createGameFromMap(map, 1, 1),
            0,
            "RIGHT"
        ));
        assert.equal(playerPowered(player(eaten, 0)), true);
        let g = setDirection(eaten, 0, "LEFT");
        let i = 0;
        while (i < 35) {
            g = step(g);
            i += 1;
        }
        assert.equal(playerPowered(player(g, 0)), false);
    });

    it("scares the ghosts while it lasts", function () {
        const map = ["XXXXXXX", "XPEXr X", "XXXXXXX"];
        let g = step(setDirection(
            createGameFromMap(map, 1, 1),
            0,
            "RIGHT"
        ));
        g = step(g);
        assert.equal(playerPowered(player(g, 0)), true);
        assert.equal(boardGhosts(board(g))[0].scared, true);
    });
});

describe("The tunnel", function () {
    it("wraps a player from the right edge to the left", function () {
        const start = createGameFromMap(["  P"], 1, 1);
        const next = step(setDirection(start, 0, "RIGHT"));
        assert.deepEqual(playerPosition(player(next, 0)), {x: 0, y: 0});
    });
});
