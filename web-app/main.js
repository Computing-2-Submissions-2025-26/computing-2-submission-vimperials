/*jslint browser */


import {
    boardDimensions,
    boardFinished,
    boardGameOver,
    boardGhosts,
    boardLevelNumber,
    boardPellets,
    boardPlayers,
    boardPowerPellets,
    boardTotalLevels,
    boardWalls,
    createGame,
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
} from "./Module.js";

// UI constants

const TILE = 22;             // pixel size of one tile on screen
const HEADER = 80;           // header bar height
const BORDER = 4;            // gap between the multiplayer boards
const STEP_MS = 130;         // time between each game step

const PALETTE = [
    "#ffd23f", "#3cdc5a", "#56b4e9", "#ff7ad5",
    "#ff8c00", "#78a0ff", "#e69f00", "#ffffff"
];
const GHOST_COLOURS = ["#e69f00", "#56b4e9", "#009e73", "#d55e00"];
const CONTROL_HINTS = ["Arrows", "WASD", "IJKL", "TFGH"];

// Which global player + direction a key controls.
const KEY_MAP = {
    ArrowDown: {dir: "DOWN", player: 1},
    ArrowLeft: {dir: "LEFT", player: 1},
    ArrowRight: {dir: "RIGHT", player: 1},
    ArrowUp: {dir: "UP", player: 1},
    a: {dir: "LEFT", player: 0},
    d: {dir: "RIGHT", player: 0},
    s: {dir: "DOWN", player: 0},
    w: {dir: "UP", player: 0},
    i: {dir: "UP", player: 2},
    j: {dir: "LEFT", player: 2},
    k: {dir: "DOWN", player: 2},
    l: {dir: "RIGHT", player: 2},
    f: {dir: "LEFT", player: 3},
    g: {dir: "DOWN", player: 3},
    h: {dir: "RIGHT", player: 3},
    t: {dir: "UP", player: 3}
};

const ui = {
    colours: [0, 1, 2, 3],
    count: 2,
    mode: "RACE"
};

const app = {
    canvas: null,
    ctx: null,
    cur: null,            // current game state
    lastStep: 0,
    prev: null,           // previous game state (for interpolation)
    rafId: 0,
    running: false
};

const dom = {};


function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

// Pixel position of an entity, interpolated between its previous and current
// tile unless it jumped (a tunnel wrap or a respawn), in which case it snaps.
function lerpPixels(prevPos, curPos, alpha) {
    const dx = Math.abs(curPos.x - prevPos.x);
    const dy = Math.abs(curPos.y - prevPos.y);
    if (dx > 1 || dy > 1) {
        return {x: curPos.x * TILE, y: curPos.y * TILE};
    }
    return {
        x: (prevPos.x + (curPos.x - prevPos.x) * alpha) * TILE,
        y: (prevPos.y + (curPos.y - prevPos.y) * alpha) * TILE
    };
}

function facingAngle(direction) {
    if (direction === "LEFT") {
        return Math.PI;
    }
    if (direction === "UP") {
        return -Math.PI / 2;
    }
    if (direction === "DOWN") {
        return Math.PI / 2;
    }
    return 0;
}



function drawWalls(ctx, board) {
    boardWalls(board).forEach(function (wall) {
        const x = wall.x * TILE;
        const y = wall.y * TILE;
        ctx.fillStyle = "#1e1edc";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = "#5050ff";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    });
}

function drawDot(ctx, pos, radius) {
    const cx = pos.x * TILE + TILE / 2;
    const cy = pos.y * TILE + TILE / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawPellets(ctx, board) {
    ctx.fillStyle = "#ffe6b4";
    boardPellets(board).forEach(function (pellet) {
        drawDot(ctx, pellet, 2);
    });
    ctx.fillStyle = "#ffe600";
    boardPowerPellets(board).forEach(function (pellet) {
        drawDot(ctx, pellet, 5);
    });
}

function drawDotPixels(ctx, cx, cy, radius) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawGhost(ctx, px, py, scared, index) {
    const r = TILE / 2;
    ctx.fillStyle = (
        scared
        ? "#3232c8"
        : GHOST_COLOURS[index % GHOST_COLOURS.length]
    );
    ctx.beginPath();
    ctx.arc(px + r, py + r, r - 1, Math.PI, 0);
    ctx.lineTo(px + TILE - 1, py + TILE);
    ctx.lineTo(px + 1, py + TILE);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    drawDotPixels(ctx, px + TILE * 0.34, py + TILE * 0.44, 2.4);
    drawDotPixels(ctx, px + TILE * 0.66, py + TILE * 0.44, 2.4);
}

function drawPlayer(ctx, px, py, direction, colour, powered, out) {
    const cx = px + TILE / 2;
    const cy = py + TILE / 2;
    const r = TILE / 2 - 1;
    if (out) {
        ctx.fillStyle = "rgba(120,120,120,0.45)";
        drawDotPixels(ctx, cx, cy, r);
        return;
    }
    const facing = facingAngle(direction);
    const mouth = Math.PI / 5;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, facing + mouth, facing + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    if (powered) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// board and header

function colourForGlobalPlayer(p) {
    return PALETTE[ui.colours[p]];
}

function drawBoardBanner(ctx, board, dims) {
    if (!boardFinished(board) && !boardGameOver(board)) {
        return;
    }
    const won = boardFinished(board);
    const mx = dims.cols * TILE / 2;
    const my = dims.rows * TILE / 2;
    ctx.fillStyle = "rgba(7,7,13,0.85)";
    ctx.fillRect(mx - 110, my - 26, 220, 52);
    ctx.strokeStyle = (
        won
        ? "#38d36b"
        : "#ff5a5a"
    );
    ctx.lineWidth = 2;
    ctx.strokeRect(mx - 110, my - 26, 220, 52);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText((
        won
        ? "FINISHED!"
        : "GAME OVER"
    ), mx, my + 8);
    ctx.textAlign = "left";
}

// Draw one board (and its players/ghosts) at a pixel offset. `globals` maps
// each local seat to a global player number for colours.
function drawBoard(ctx, prevBoard, curBoard, globals, offsetX, offsetY, alpha) {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    const dims = boardDimensions(curBoard);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, dims.cols * TILE, dims.rows * TILE);
    drawWalls(ctx, curBoard);
    drawPellets(ctx, curBoard);

    const prevGhosts = boardGhosts(prevBoard);
    boardGhosts(curBoard).forEach(function (ghost, i) {
        const from = (
            prevGhosts[i] === undefined
            ? ghost.position
            : prevGhosts[i].position
        );
        const pix = lerpPixels(from, ghost.position, alpha);
        drawGhost(ctx, pix.x, pix.y, ghost.scared, i);
    });

    const prevPlayers = boardPlayers(prevBoard);
    boardPlayers(curBoard).forEach(function (player, i) {
        const from = (
            prevPlayers[i] === undefined
            ? playerPosition(player)
            : playerPosition(prevPlayers[i])
        );
        const pix = lerpPixels(from, playerPosition(player), alpha);
        drawPlayer(
            ctx,
            pix.x,
            pix.y,
            playerDirection(player),
            colourForGlobalPlayer(globals[i]),
            playerPowered(player),
            playerEliminated(player)
        );
    });

    drawBoardBanner(ctx, curBoard, dims);
    ctx.restore();
}

function drawPlayerCard(ctx, game, p, x, top, cardW, cardH, winner) {
    const board = getBoardOf(game, p);
    const seat = getRouting(game)[p].local;
    const player = boardPlayers(board)[seat];
    const lead = (p === winner);
    const lives = Math.max(0, playerLives(player));
    const label = "P" + (p + 1) + " (" + CONTROL_HINTS[p] + ")";

    ctx.fillStyle = (
        lead
        ? "rgba(0,110,0,0.25)"
        : "rgba(255,255,255,0.06)"
    );
    ctx.fillRect(x, top, cardW, cardH);
    ctx.strokeStyle = (
        lead
        ? "#00ff00"
        : colourForGlobalPlayer(p)
    );
    ctx.lineWidth = (
        lead
        ? 2
        : 1
    );
    ctx.strokeRect(x, top, cardW, cardH);

    ctx.font = "bold 11px Arial";
    ctx.fillStyle = colourForGlobalPlayer(p);
    ctx.fillText(label, x + 6, top + 14);

    ctx.font = "11px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Score: " + playerScore(player), x + 6, top + 28);
    ctx.fillText("Lives: " + lives, x + 6, top + 42);

    ctx.font = "10px Arial";
    if (boardFinished(board)) {
        ctx.fillStyle = "#50ff50";
        ctx.fillText("DONE", x + 6, top + 55);
    } else if (playerEliminated(player)) {
        ctx.fillStyle = "#ff5050";
        ctx.fillText("OUT", x + 6, top + 55);
    } else if (getMode(game) === "RACE") {
        ctx.fillStyle = "#9696b4";
        ctx.fillText(
            "Level " + boardLevelNumber(board) + "/" + boardTotalLevels(board),
            x + 6,
            top + 55
        );
    }
}

// Per-player cards in the header (score, lives, level, leader highlight).
function drawHeader(ctx, game) {
    const width = app.canvas.width;
    const count = getPlayerCount(game);
    const winner = getWinner(game);
    ctx.fillStyle = "#0c0c1e";
    ctx.fillRect(0, 0, width, HEADER);

    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.fillText((
        getMode(game) === "RACE"
        ? "PAC-MAN RACE"
        : "PAC-MAN BATTLE"
    ), 10, 14);
    ctx.fillStyle = "#9696b4";
    ctx.font = "10px Arial";
    ctx.textAlign = "right";
    ctx.fillText("ESC: menu", width - 10, 14);
    ctx.textAlign = "left";

    const margin = 6;
    const gap = 6;
    const top = 20;
    const cardH = HEADER - 24;
    const cardW = (width - margin * 2 - gap * (count - 1)) / count;
    let p = 0;
    while (p < count) {
        drawPlayerCard(
            ctx,
            game,
            p,
            margin + p * (cardW + gap),
            top,
            cardW,
            cardH,
            winner
        );
        p += 1;
    }
}

// Lay the boards out under the header for the current mode and player count.
function drawBoards(ctx, alpha) {
    const game = app.cur;
    const prevBoards = getBoards(app.prev);
    const curBoards = getBoards(game);
    const routing = getRouting(game);

    if (getMode(game) === "BATTLE") {
        const globals = routing.map(function (route) {
            return route.local;
        });
        drawBoard(
            ctx,
            prevBoards[0],
            curBoards[0],
            globals,
            0,
            HEADER,
            alpha
        );
        return;
    }

    const dims = boardDimensions(curBoards[0]);
    const bw = dims.cols * TILE;
    const bh = dims.rows * TILE;
    const cols = [0, bw + BORDER];
    const rowsY = [HEADER, HEADER + bh + BORDER];
    curBoards.forEach(function (curBoard, i) {
        const ox = cols[i % 2];
        const oy = rowsY[Math.floor(i / 2)];
        drawBoard(ctx, prevBoards[i], curBoard, [i], ox, oy, alpha);
    });
}

function render(alpha) {
    const ctx = app.ctx;
    ctx.clearRect(0, 0, app.canvas.width, app.canvas.height);
    drawBoards(ctx, alpha);
    drawHeader(ctx, app.cur);
}

// canvas sizing

function sizeCanvas(game) {
    const dims = boardDimensions(getBoards(game)[0]);
    const bw = dims.cols * TILE;
    const bh = dims.rows * TILE;
    const count = getPlayerCount(game);
    if (getMode(game) === "BATTLE") {
        app.canvas.width = bw;
        app.canvas.height = bh + HEADER;
        return;
    }
    if (count === 1) {
        app.canvas.width = bw;
        app.canvas.height = bh + HEADER;
        return;
    }
    if (count === 2) {
        app.canvas.width = bw * 2 + BORDER;
        app.canvas.height = bh + HEADER;
        return;
    }
    app.canvas.width = bw * 2 + BORDER;
    app.canvas.height = bh * 2 + BORDER + HEADER;
}

// game loop

function loop(now) {
    if (!app.running) {
        return;
    }
    if (now - app.lastStep >= STEP_MS) {
        app.prev = app.cur;
        if (!isComplete(app.cur)) {
            app.cur = step(app.cur);
        }
        app.lastStep = now;
    }
    const alpha = clamp01((now - app.lastStep) / STEP_MS);
    render(alpha);
    app.rafId = window.requestAnimationFrame(loop);
}

// start and stop

function startGame() {
    app.cur = createGame(ui.mode, ui.count, Date.now() % 100000 + 1);
    app.prev = app.cur;
    sizeCanvas(app.cur);
    dom.startScreen.style.display = "none";
    app.canvas.style.display = "block";
    app.running = true;
    app.lastStep = 0;
    app.rafId = window.requestAnimationFrame(loop);
}

function returnToMenu() {
    app.running = false;
    window.cancelAnimationFrame(app.rafId);
    app.canvas.style.display = "none";
    dom.startScreen.style.display = "block";
}

// input

function onKeyDown(event) {
    if (!app.running) {
        return;
    }
    if (event.key === "Escape") {
        returnToMenu();
        event.preventDefault();
        return;
    }
    const byKey = KEY_MAP[event.key] || KEY_MAP[event.key.toLowerCase()];
    const action = byKey;
    if (action !== undefined && action.player < ui.count) {
        app.cur = setDirection(app.cur, action.player, action.dir);
        event.preventDefault();
    }
}

// start screen

function clearChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function makeButton(label, className, handler) {
    const btn = document.createElement("button");
    btn.className = className;
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", handler);
    return btn;
}

function buildModeButtons() {
    const defs = [
        {label: "RACE  (3 levels, fastest wins)", mode: "RACE"},
        {label: "BATTLE  (shared map, most pellets)", mode: "BATTLE"}
    ];
    clearChildren(dom.modeRow);
    defs.forEach(function (def) {
        const selected = (
            ui.mode === def.mode
            ? " selected"
            : ""
        );
        dom.modeRow.appendChild(makeButton(
            def.label,
            "toggle" + selected,
            function () {
                ui.mode = def.mode;
                buildModeButtons();
            }
        ));
    });
}

function buildPlayerRows() {
    clearChildren(dom.playersPanel);
    const range = Array.from({length: ui.count}, function (ignore, i) {
        return i;
    });
    range.forEach(function (i) {
        const row = document.createElement("div");
        row.className = "playerRow";
        const name = document.createElement("div");
        name.className = "name";
        name.textContent = "P" + (i + 1) + " (" + CONTROL_HINTS[i] + ")";
        row.appendChild(name);
        PALETTE.forEach(function (ignore, c) {
            const sw = document.createElement("button");
            sw.type = "button";
            sw.className = "swatch" + (
                ui.colours[i] === c
                ? " selected"
                : ""
            );
            sw.style.background = PALETTE[c];
            sw.setAttribute("aria-label", "Colour " + (c + 1));
            sw.addEventListener("click", function () {
                ui.colours[i] = c;
                buildPlayerRows();
            });
            row.appendChild(sw);
        });
        dom.playersPanel.appendChild(row);
    });
}

function buildCountButtons() {
    clearChildren(dom.countRow);
    [2, 3, 4].forEach(function (n) {
        const selected = (
            ui.count === n
            ? " selected"
            : ""
        );
        dom.countRow.appendChild(makeButton(
            String(n),
            "count" + selected,
            function () {
                ui.count = n;
                buildCountButtons();
                buildPlayerRows();
            }
        ));
    });
}

function init() {
    app.canvas = document.getElementById("game");
    app.ctx = app.canvas.getContext("2d");
    dom.startScreen = document.getElementById("startScreen");
    dom.modeRow = document.getElementById("modeRow");
    dom.countRow = document.getElementById("countRow");
    dom.playersPanel = document.getElementById("playersPanel");
    dom.startBtn = document.getElementById("startBtn");

    buildModeButtons();
    buildCountButtons();
    buildPlayerRows();
    dom.startBtn.addEventListener("click", startGame);
    window.addEventListener("keydown", onKeyDown);
}

window.addEventListener("DOMContentLoaded", init);