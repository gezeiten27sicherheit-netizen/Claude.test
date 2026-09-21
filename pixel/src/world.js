// Welt: ASCII-Karte -> Kachelgitter + Spawn-Listen, dazu Kollisionsabfragen
// und das Zeichnen der sichtbaren Kacheln.
(function () {
  const PX = (window.PX = window.PX || {});
  const U = PX.util;
  const T = 16;

  const EMPTY = 0, SOLID = 1, PLATFORM = 2, SPIKE = 3;

  function create(def) {
    const rows = def.rows;
    const h = rows.length;
    const w = rows[0].length;
    const grid = new Uint8Array(w * h);
    const spawns = { enemies: [], pickups: [], movers: [], player: { x: 32, y: 32 }, goal: { x: w * T - 48, y: 0 } };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        const px = x * T, py = y * T;
        switch (ch) {
          case '#': grid[y * w + x] = SOLID; break;
          case '=': grid[y * w + x] = PLATFORM; break;
          case '^': grid[y * w + x] = SPIKE; break;
          case 'P': spawns.player = { x: px, y: py }; break;
          case 'F': spawns.goal = { x: px, y: py }; break;
          case 's': spawns.enemies.push({ type: 'slime', x: px, y: py }); break;
          case 'b': spawns.enemies.push({ type: 'bat', x: px, y: py }); break;
          case 'o': spawns.pickups.push({ type: 'coin', x: px + 4, y: py + 4 }); break;
          case '*': spawns.pickups.push({ type: 'gem', x: px + 4, y: py + 4 }); break;
          case 'h': spawns.pickups.push({ type: 'heart', x: px + 4, y: py + 4 }); break;
          case 'M': spawns.movers.push({ x: px, y: py, axis: 'x' }); break;
          case 'V': spawns.movers.push({ x: px, y: py, axis: 'y' }); break;
          default: break;
        }
      }
    }

    const world = {
      def, w, h, grid, spawns,
      pxW: w * T, pxH: h * T,
      tileset: PX.tiles.get(def.theme),
      decor: [],
      visual: new Uint8Array(w * h), // 0 keine, 1 oben, 2 mitte, 3 tief
    };

    // Reichweite der fahrenden Plattformen aus dem freien Raum ableiten.
    world.spawns.movers.forEach((m) => {
      const cx = (m.x / T) | 0, cy = (m.y / T) | 0;
      let a = 0, b = 0;
      if (m.axis === 'x') {
        while (a < 5 && isFree(world, cx - a - 1, cy)) a++;
        while (b < 5 && isFree(world, cx + b + 1, cy)) b++;
      } else {
        while (a < 5 && isFree(world, cx, cy - a - 1)) a++;
        while (b < 5 && isFree(world, cx, cy + b + 1)) b++;
      }
      m.min = m.axis === 'x' ? m.x - a * T : m.y - a * T;
      m.max = m.axis === 'x' ? m.x + b * T : m.y + b * T;
    });

    // Optik vorberechnen: Deckschicht, Erde, tiefes Gestein.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y * w + x] !== SOLID) continue;
        const above = y > 0 ? grid[(y - 1) * w + x] : EMPTY;
        if (above !== SOLID) {
          world.visual[y * w + x] = 1;
          if (U.hash2(x, y, 7) < 0.34) {
            world.decor.push({ x: x * T + 4, y: y * T - 8, i: (U.hash2(x, y, 13) * 3) | 0 });
          }
        } else {
          const depth = y >= 2 && grid[(y - 2) * w + x] === SOLID ? 3 : 2;
          world.visual[y * w + x] = depth;
        }
      }
    }

    return world;
  }

  function isFree(world, cx, cy) {
    if (cx < 0 || cy < 0 || cx >= world.w || cy >= world.h) return false;
    return world.grid[cy * world.w + cx] === EMPTY;
  }

  function tileAt(world, cx, cy) {
    if (cx < 0 || cx >= world.w) return SOLID; // Levelraender sind Wand
    if (cy < 0) return EMPTY;
    if (cy >= world.h) return EMPTY; // unten faellt man heraus
    return world.grid[cy * world.w + cx];
  }

  function solidAtPx(world, x, y) {
    return tileAt(world, Math.floor(x / T), Math.floor(y / T)) === SOLID;
  }

  // Rechteck gegen feste Bloecke pruefen.
  function rectSolid(world, x, y, w, h) {
    const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 1) / T);
    const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 1) / T);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (tileAt(world, cx, cy) === SOLID) return true;
      }
    }
    return false;
  }

  function rectSpike(world, x, y, w, h) {
    const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 1) / T);
    const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 1) / T);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (tileAt(world, cx, cy) !== SPIKE) continue;
        // Stacheln sind nur in den unteren 10 Pixeln der Kachel toedlich.
        if (y + h > cy * T + 6) return true;
      }
    }
    return false;
  }

  function render(world, ctx, cam, time) {
    const ts = world.tileset;
    const x0 = Math.max(0, Math.floor(cam.x / T) - 1);
    const x1 = Math.min(world.w - 1, Math.floor((cam.x + cam.w) / T) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / T) - 1);
    const y1 = Math.min(world.h - 1, Math.floor((cam.y + cam.h) / T) + 1);

    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const t = world.grid[cy * world.w + cx];
        if (t === EMPTY) continue;
        const sx = Math.round(cx * T - cam.x);
        const sy = Math.round(cy * T - cam.y);
        if (t === SOLID) {
          const kind = world.visual[cy * world.w + cx];
          const set = kind === 1 ? ts.top : kind === 3 ? ts.deep : ts.mid;
          ctx.drawImage(set[(U.hash2(cx, cy, 3) * set.length) | 0], sx, sy);
        } else if (t === PLATFORM) {
          ctx.drawImage(ts.platform, sx, sy);
        } else if (t === SPIKE) {
          ctx.drawImage(ts.spike, sx, sy);
        }
      }
    }

    // Grasbueschel, Blumen, Kristalle auf der Deckschicht.
    for (let i = 0; i < world.decor.length; i++) {
      const d = world.decor[i];
      if (d.x < cam.x - 16 || d.x > cam.x + cam.w + 16) continue;
      ctx.drawImage(ts.decor[d.i], Math.round(d.x - cam.x), Math.round(d.y - cam.y));
    }

    drawGoal(world, ctx, cam, time);
  }

  // Zielfahne: Mast plus wehendes Banner (Sinuswelle, pixelweise gezeichnet).
  function drawGoal(world, ctx, cam, time) {
    const g = world.spawns.goal;
    const x = Math.round(g.x + 6 - cam.x);
    const base = Math.round(g.y + T - cam.y);
    if (x < -40 || x > cam.w + 40) return;
    const top = base - 42;
    ctx.fillStyle = '#d9d4c4';
    ctx.fillRect(x, top, 2, 42);
    ctx.fillStyle = '#8f8a78';
    ctx.fillRect(x + 1, top, 1, 42);
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(x - 1, top - 2, 4, 2);
    for (let row = 0; row < 14; row++) {
      const wlen = 18 - Math.abs(row - 7);
      for (let col = 0; col < wlen; col++) {
        const off = Math.round(Math.sin(time * 6 + col * 0.5 + row * 0.15) * (col / 5));
        ctx.fillStyle = (row + col) % 7 === 0 ? '#ffe7a8' : col > wlen - 4 ? '#b7263f' : '#e5384f';
        ctx.fillRect(x + 2 + col, top + 3 + row + off, 1, 1);
      }
    }
  }

  PX.world = { create, tileAt, rectSolid, rectSpike, solidAtPx, render, EMPTY, SOLID, PLATFORM, SPIKE, T };
})();
