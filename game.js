/**
 * PacLee — Agent Lee Edition
 * Canvas-based Pac-Man for workspace/preview/paclee/
 */
(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────
  const TILE   = 20;
  const COLS   = 28;
  const ROWS   = 31;
  const FPS    = 12;

  // Tile types
  const T = { WALL: 1, DOT: 0, BIG: 2, EMPTY: 3, GHOST_HOUSE: 4 };

  // ── Maze layout (28 × 31) ─────────────────────────────────
  // 1=wall 0=dot 2=power-dot 3=empty 4=ghost-house-floor
  const MAZE_STR = [
    "1111111111111111111111111111",
    "1000000000000110000000000001",
    "1011110111101101101111011101",
    "1211110111101101101111011121",
    "1011110111101101101111011101",
    "1000000000000000000000000001",
    "1011110110111111110110111101",
    "1011110110111111110110111101",
    "1000000110003300030110000001",
    "1111101111011110111101111111",
    "1111101111011110111101111111",
    "1111100000011110000001111111",
    "1111101111044444411101111111",
    "1111101110444444441011111111",
    "3333303333444444433303333333",
    "1111101110444444441011111111",
    "1111101111044444411101111111",
    "1111100000033330000001111111",
    "1111101111011110111101111111",
    "1111101111011110111101111111",
    "1000000110000110000110000001",
    "1011110110111111110110111101",
    "1011110110111111110110111101",
    "1200000000000110000000000021",
    "1011110111101101101111011101",
    "1011110111101101101111011101",
    "1000001100000003000011000001",
    "1111101100111111110011011111",
    "1111101100111111110011011111",
    "1000000000000000000000000001",
    "1111111111111111111111111111",
  ];

  // ── Canvas setup ──────────────────────────────────────────
  const canvas = document.getElementById("game");
  const ctx    = canvas.getContext("2d");
  canvas.width  = COLS * TILE;
  canvas.height = ROWS * TILE;

  // ── State ─────────────────────────────────────────────────
  let map, score, level, lives, pac, ghosts, dir, nextDir,
      animId, paused, started, dotsLeft, ghostMode, ghostTimer,
      mouthAngle, mouthDir;

  // ── Ghost colours + scatter targets ───────────────────────
  const GHOST_DEFS = [
    { name: "Blinky", color: "#ff0000", scatter: { r: 0,      c: COLS-1 }, sr: 11, sc: 13 },
    { name: "Pinky",  color: "#ffb8ff", scatter: { r: 0,      c: 0      }, sr: 13, sc: 13 },
    { name: "Inky",   color: "#00ffff", scatter: { r: ROWS-1, c: COLS-1 }, sr: 11, sc: 14 },
    { name: "Clyde",  color: "#ffb852", scatter: { r: ROWS-1, c: 0      }, sr: 13, sc: 14 },
  ];

  // ── Build map from string ──────────────────────────────────
  function buildMap() {
    map = MAZE_STR.map(row => row.split("").map(Number));
    dotsLeft = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (map[r][c] === T.DOT || map[r][c] === T.BIG) dotsLeft++;
  }

  // ── Reset everything ──────────────────────────────────────
  function reset(keepLevel) {
    if (!keepLevel) level = 1;
    buildMap();
    score    = keepLevel ? score : 0;
    lives    = 3;
    paused   = false;
    started  = false;
    mouthAngle = 0.3;
    mouthDir   = 1;

    pac = { r: 23, c: 14, pr: 23, pc: 14 };
    dir     = { r: 0, c: 0 };
    nextDir = { r: 0, c: 0 };

    ghostMode  = "scatter";
    ghostTimer = 0;

    ghosts = GHOST_DEFS.map(def => ({
      ...def,
      r: def.sr, c: def.sc,
      dr: -1, dc: 0,
      frightened: false,
      dead: false,
      eaten: false,
    }));

    updateHUD();
  }

  // ── HUD helpers ───────────────────────────────────────────
  function updateHUD() {
    document.getElementById("score").textContent = score;
    document.getElementById("level").textContent = level;
    document.getElementById("lives").textContent = "❤".repeat(Math.max(0, lives));
  }

  // ── Overlay ───────────────────────────────────────────────
  const overlay = document.getElementById("overlay");
  function showOverlay(title, body, hint) {
    overlay.innerHTML = `<h2>${title}</h2><p>${body}</p><p class="hint">${hint}</p>`;
    overlay.classList.remove("hidden");
  }
  function hideOverlay() { overlay.classList.add("hidden"); }

  // ── Collision helpers ─────────────────────────────────────
  function isWall(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
    const t = map[r][c];
    return t === T.WALL;
  }

  function wrapCol(c) {
    if (c < 0)    return COLS - 1;
    if (c >= COLS) return 0;
    return c;
  }

  // ── Movement ──────────────────────────────────────────────
  function tryMovePac() {
    // try nextDir first (buffered turn)
    const nr = pac.r + nextDir.r;
    const nc = wrapCol(pac.c + nextDir.c);
    if (!isWall(nr, nc)) {
      dir.r = nextDir.r;
      dir.c = nextDir.c;
    }
    const mr = pac.r + dir.r;
    const mc = wrapCol(pac.c + dir.c);
    if (!isWall(mr, mc)) {
      pac.pr = pac.r; pac.pc = pac.c;
      pac.r = mr; pac.c = mc;
    }
  }

  function moveGhost(g) {
    if (g.dead) {
      // return to house
      const tr = 13, tc = 13;
      const options = bestMoves(g, tr, tc);
      if (options.length) { g.r += options[0].dr; g.c = wrapCol(g.c + options[0].dc); }
      if (g.r === tr && g.c === tc) { g.dead = false; g.frightened = false; }
      return;
    }

    if (g.frightened) {
      // random walk
      const moves = freeMoves(g);
      if (moves.length) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        g.r += m.dr; g.c = wrapCol(g.c + m.dc);
      }
      return;
    }

    // Chase / scatter
    let tr, tc;
    if (ghostMode === "scatter") {
      tr = g.scatter.r; tc = g.scatter.c;
    } else {
      tr = pac.r; tc = pac.c;
    }

    const options = bestMoves(g, tr, tc);
    if (options.length) {
      g.dr = options[0].dr; g.dc = options[0].dc;
      g.r += g.dr; g.c = wrapCol(g.c + g.dc);
    }
  }

  function freeMoves(g) {
    return [[-1,0],[1,0],[0,-1],[0,1]]
      .filter(([dr,dc]) => !isWall(g.r+dr, wrapCol(g.c+dc)) &&
                           !(dr === -g.dr && dc === -g.dc));
  }

  function dist(r1,c1,r2,c2) { return Math.abs(r1-r2)+Math.abs(c1-c2); }

  function bestMoves(g, tr, tc) {
    return freeMoves(g)
      .map(([dr,dc]) => ({ dr, dc, d: dist(g.r+dr, wrapCol(g.c+dc), tr, tc) }))
      .sort((a,b) => a.d - b.d);
  }

  // ── Game tick ─────────────────────────────────────────────
  let tickCount = 0;
  function update() {
    if (paused || !started) return;
    tickCount++;

    // Mouth animation
    mouthAngle += 0.15 * mouthDir;
    if (mouthAngle > 0.45) mouthDir = -1;
    if (mouthAngle < 0.05) mouthDir =  1;

    // Move pac every tick
    tryMovePac();

    // Eat tiles
    const t = map[pac.r][pac.c];
    if (t === T.DOT) {
      map[pac.r][pac.c] = T.EMPTY;
      score += 10; dotsLeft--; updateHUD();
    } else if (t === T.BIG) {
      map[pac.r][pac.c] = T.EMPTY;
      score += 50; dotsLeft--; updateHUD();
      // Frighten ghosts
      ghosts.forEach(g => { if (!g.dead) g.frightened = true; });
      ghostTimer = 0; // reset fright timer
    }

    if (dotsLeft <= 0) {
      level++;
      started = false;
      showOverlay("🏆 Level Clear!", `Score: ${score}`, "Press any key for next level");
      updateHUD();
      return;
    }

    // Move ghosts every 2 ticks
    if (tickCount % 2 === 0) {
      ghosts.forEach(g => moveGhost(g));
    }

    // Ghost mode switching
    ghostTimer++;
    const MODE_DURATIONS = [7*FPS, 20*FPS, 5*FPS, 20*FPS, 5*FPS, 20*FPS, 5*FPS, 9999];
    // (scatter/chase alternating; simplified to 7s scatter / 20s chase cycle)
    if (ghostMode === "scatter" && ghostTimer > 7*FPS) {
      ghostMode = "chase"; ghostTimer = 0;
    } else if (ghostMode === "chase" && ghostTimer > 20*FPS) {
      ghostMode = "scatter"; ghostTimer = 0;
    }

    // Fright cooldown
    ghosts.forEach(g => {
      if (g.frightened && ghostTimer > 8*FPS) g.frightened = false;
    });

    // Ghost-Pac collision
    ghosts.forEach(g => {
      if (g.r === pac.r && g.c === pac.c) {
        if (g.frightened && !g.dead) {
          g.dead = true; g.frightened = false;
          score += 200; updateHUD();
        } else if (!g.dead) {
          lives--;
          updateHUD();
          if (lives <= 0) {
            started = false;
            showOverlay("💀 Game Over", `Final score: ${score}`, "Press R to restart");
            return;
          }
          // Reset positions
          pac.r = 23; pac.c = 14;
          dir = { r:0, c:0 }; nextDir = { r:0, c:0 };
          ghosts.forEach((g2, i) => { g2.r = GHOST_DEFS[i].sr; g2.c = GHOST_DEFS[i].sc; g2.frightened=false; g2.dead=false; });
          started = false;
          showOverlay("💛 Continue?", `Lives left: ${lives}`, "Press any key to continue");
        }
      }
    });
  }

  // ── Draw ──────────────────────────────────────────────────
  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Map tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE, y = r * TILE, v = map[r][c];
        if (v === T.WALL) {
          ctx.fillStyle = "#1a1aff";
          ctx.fillRect(x, y, TILE, TILE);
          // inner glow edge
          ctx.strokeStyle = "#0000bb";
          ctx.strokeRect(x+1, y+1, TILE-2, TILE-2);
        } else if (v === T.DOT) {
          ctx.fillStyle = "#ffe600";
          ctx.beginPath();
          ctx.arc(x + TILE/2, y + TILE/2, 2, 0, Math.PI*2);
          ctx.fill();
        } else if (v === T.BIG) {
          // pulsing power dot
          const pulse = 3.5 + Math.sin(tickCount * 0.2) * 1.5;
          ctx.fillStyle = "#ffe600";
          ctx.shadowColor = "#ffe60099";
          ctx.shadowBlur  = 10;
          ctx.beginPath();
          ctx.arc(x + TILE/2, y + TILE/2, pulse, 0, Math.PI*2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    // Ghost-house door
    ctx.fillStyle = "#ff69b4";
    ctx.fillRect(13*TILE, 12*TILE, 2*TILE, 2);

    // Pac-Man
    const px = pac.c * TILE + TILE/2;
    const py = pac.r * TILE + TILE/2;
    const facing = dir.c > 0 ? 0 : dir.c < 0 ? Math.PI : dir.r > 0 ? Math.PI/2 : dir.r < 0 ? -Math.PI/2 : 0;
    ctx.fillStyle = "#ffe600";
    ctx.shadowColor = "#ffe60066";
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, TILE/2 - 1, facing + mouthAngle, facing + Math.PI*2 - mouthAngle);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eye
    const eyeX = px + Math.cos(facing - 0.5) * (TILE/4);
    const eyeY = py + Math.sin(facing - 0.5) * (TILE/4);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 1.5, 0, Math.PI*2);
    ctx.fill();

    // Ghosts
    ghosts.forEach(g => {
      if (g.dead) return; // invisible while returning
      const gx = g.c * TILE + TILE/2;
      const gy = g.r * TILE + TILE/2;
      const R  = TILE/2 - 1;

      if (g.frightened) {
        const flash = ghostTimer > 6*FPS && Math.floor(tickCount/4) % 2 === 0;
        ctx.fillStyle = flash ? "#ffffff" : "#0000cc";
      } else {
        ctx.fillStyle = g.color;
      }

      // Body (dome + ruffled bottom)
      ctx.beginPath();
      ctx.arc(gx, gy, R, Math.PI, 0);
      const segments = 3;
      for (let i = segments; i >= 0; i--) {
        const bx = gx - R + (i * R*2/segments);
        const by = gy + R - (i % 2 === 0 ? 4 : 0);
        ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.fill();

      // Eyes (only when not frightened)
      if (!g.frightened) {
        [-5, 5].forEach(ox => {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.ellipse(gx+ox, gy-2, 3, 4, 0, 0, Math.PI*2);
          ctx.fill();
          ctx.fillStyle = "#00f";
          ctx.beginPath();
          ctx.arc(gx+ox+g.dc*1.5, gy-2+g.dr*1.5, 1.5, 0, Math.PI*2);
          ctx.fill();
        });
      }
    });
  }

  // ── Main loop ─────────────────────────────────────────────
  let lastTime = 0;
  const INTERVAL = 1000 / FPS;

  function loop(ts) {
    animId = requestAnimationFrame(loop);
    if (ts - lastTime < INTERVAL) return;
    lastTime = ts;
    update();
    draw();
  }

  // ── Input ─────────────────────────────────────────────────
  const KEY_MAP = {
    ArrowUp:    { r:-1, c: 0 }, w: { r:-1, c: 0 },
    ArrowDown:  { r: 1, c: 0 }, s: { r: 1, c: 0 },
    ArrowLeft:  { r: 0, c:-1 }, a: { r: 0, c:-1 },
    ArrowRight: { r: 0, c: 1 }, d: { r: 0, c: 1 },
  };

  document.addEventListener("keydown", e => {
    // Restart
    if (e.key === "r" || e.key === "R") {
      cancelAnimationFrame(animId);
      reset(false);
      hideOverlay();
      started = true;
      loop(0);
      return;
    }
    // Pause
    if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      if (!started) return;
      paused = !paused;
      return;
    }
    // Directional
    const d = KEY_MAP[e.key];
    if (d) {
      e.preventDefault();
      nextDir.r = d.r; nextDir.c = d.c;
      if (!started) {
        started = true;
        hideOverlay();
      }
    }
  });

  // Touch swipe support
  let tx0 = null, ty0 = null;
  canvas.addEventListener("touchstart", e => {
    tx0 = e.touches[0].clientX;
    ty0 = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener("touchend", e => {
    if (tx0 === null) return;
    const dx = e.changedTouches[0].clientX - tx0;
    const dy = e.changedTouches[0].clientY - ty0;
    tx0 = ty0 = null;
    if (Math.abs(dx) > Math.abs(dy)) {
      nextDir.r = 0; nextDir.c = dx > 0 ? 1 : -1;
    } else {
      nextDir.c = 0; nextDir.r = dy > 0 ? 1 : -1;
    }
    if (!started) { started = true; hideOverlay(); }
  }, { passive: true });

  // ── Boot ──────────────────────────────────────────────────
  reset(false);
  loop(0);

})();
