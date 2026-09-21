// Parallax-Hintergruende: drei Ebenen, die pro Thema einmal in breite Canvases
// gemalt und dann horizontal gekachelt werden.
(function () {
  const PX = (window.PX = window.PX || {});
  const U = PX.util;
  const LW = 512; // Kachelbreite einer Ebene

  function hillLayer(h, color, seed, baseY, amp, step) {
    const c = U.canvas(LW, h);
    const ctx = c.getContext('2d');
    const rnd = U.rng(seed);
    const pts = [];
    for (let x = 0; x <= LW; x += step) pts.push(rnd());
    ctx.fillStyle = color;
    for (let x = 0; x < LW; x++) {
      const t = x / step;
      const i = Math.floor(t);
      const f = t - i;
      const a = pts[i % (pts.length - 1)];
      const b = pts[(i + 1) % (pts.length - 1)];
      const sm = f * f * (3 - 2 * f);
      const y = Math.round(baseY - U.lerp(a, b, sm) * amp);
      ctx.fillRect(x, y, 1, h - y);
    }
    return c;
  }

  function treeLayer(h, theme, seed, baseY) {
    const c = U.canvas(LW, h);
    const ctx = c.getContext('2d');
    const rnd = U.rng(seed);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rnd() * LW);
      const th = 28 + Math.floor(rnd() * 34);
      const w = 10 + Math.floor(rnd() * 8);
      const y = baseY - th;
      if (theme === 'forest') {
        ctx.fillStyle = '#26543c';
        ctx.fillRect(x + ((w / 2) | 0) - 1, y + th - 14, 3, 16);
        ctx.fillStyle = '#2f6b4c';
        for (let k = 0; k < 3; k++) {
          const kw = w - k * 2;
          ctx.fillRect(x + k, y + k * 8, kw, 12);
        }
        ctx.fillStyle = '#3c8a5f';
        ctx.fillRect(x + 1, y + 1, w - 4, 2);
      } else if (theme === 'cave') {
        ctx.fillStyle = '#2a3054';
        ctx.fillRect(x, y, w, th);
        ctx.fillStyle = '#343c66';
        ctx.fillRect(x, y, 2, th);
        // Tropfsteine von oben
        const sw = 4 + Math.floor(rnd() * 5);
        const sh = 14 + Math.floor(rnd() * 30);
        ctx.fillStyle = '#242a49';
        for (let yy = 0; yy < sh; yy++) {
          const ww = Math.max(1, Math.round(sw * (1 - yy / sh)));
          ctx.fillRect(x + 6, yy, ww, 1);
        }
      } else {
        ctx.fillStyle = '#463c5e';
        ctx.fillRect(x, y, w, th);
        ctx.fillStyle = '#564a72';
        ctx.fillRect(x, y, w, 3);
        for (let yy = y + 6; yy < baseY; yy += 7) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x, yy, w, 1);
        }
      }
    }
    return c;
  }

  function nearLayer(h, theme, seed, baseY) {
    const c = U.canvas(LW, h);
    const ctx = c.getContext('2d');
    const rnd = U.rng(seed);
    const col = theme === 'forest' ? '#1f4a36' : theme === 'cave' ? '#1a1f38' : '#332b46';
    const hi = theme === 'forest' ? '#2f6b4c' : theme === 'cave' ? '#242c4c' : '#443a5c';
    // Buschgruppen aus mehreren ueberlappenden Klecksen statt harter Kaesten.
    for (let i = 0; i < 26; i++) {
      const bx = Math.floor(rnd() * LW);
      const blobs = 3 + Math.floor(rnd() * 3);
      const scale = 0.7 + rnd() * 0.9;
      for (let b = 0; b < blobs; b++) {
        const w = Math.round((14 + rnd() * 14) * scale);
        const hh = Math.round((10 + rnd() * 12) * scale);
        const x = bx + b * Math.round(w * 0.6) - 6;
        const y = baseY - hh - Math.round(rnd() * 6);
        ctx.fillStyle = col;
        ctx.fillRect(x, y + 2, w, hh + 26);
        ctx.fillRect(x + 2, y, w - 4, hh + 26);
        ctx.fillStyle = hi;
        ctx.fillRect(x + 2, y, w - 4, 2);
        ctx.fillRect(x, y + 2, 2, 2);
      }
    }
    return c;
  }

  function skyExtras(w, h, theme, seed) {
    const c = U.canvas(w, h);
    const ctx = c.getContext('2d');
    const rnd = U.rng(seed);
    if (theme === 'forest') {
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(rnd() * w);
        const y = 12 + Math.floor(rnd() * 60);
        const s = 1 + Math.floor(rnd() * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let k = 0; k < 4; k++) {
          ctx.fillRect(x + k * 7 * s, y + (k === 1 || k === 2 ? -3 * s : 0), 10 * s, 5 * s);
        }
      }
    } else {
      const count = theme === 'cave' ? 45 : 90;
      for (let i = 0; i < count; i++) {
        const x = Math.floor(rnd() * w);
        const y = Math.floor(rnd() * h * 0.7);
        ctx.fillStyle = theme === 'cave'
          ? (rnd() < 0.4 ? 'rgba(150,210,255,0.35)' : 'rgba(200,220,255,0.18)')
          : (rnd() < 0.3 ? 'rgba(180,210,255,0.9)' : 'rgba(255,255,255,0.55)');
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  const cache = {};

  function get(theme, viewH) {
    const key = theme + ':' + viewH;
    if (cache[key]) return cache[key];
    const h = viewH;
    const cols = PX.tiles.THEMES[theme].hills;
    const layers = {
      sky: PX.tiles.THEMES[theme].sky,
      extras: skyExtras(LW, h, theme, 4242),
      far: hillLayer(h, cols[2], 11, h * 0.72, 34, 64),
      mid2: hillLayer(h, cols[1], 27, h * 0.82, 26, 48),
      trees: treeLayer(h, theme, 91, Math.round(h * 0.92)),
      near: nearLayer(h, theme, 57, h),
      width: LW,
    };
    cache[key] = layers;
    return layers;
  }

  PX.scenery = { get, LW };
})();
