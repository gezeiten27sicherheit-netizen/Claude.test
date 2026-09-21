// Tilesets werden pro Thema (Wald, Hoehle, Ruine) einmalig in Offscreen-Canvases
// gemalt: Grundfarbe + deterministisches Rauschen + Kantenlichter. Vier Varianten
// je Tile sorgen dafuer, dass grosse Flaechen nicht wie Tapete wirken.
(function () {
  const PX = (window.PX = window.PX || {});
  const U = PX.util;
  const T = 16;

  const THEMES = {
    forest: {
      sky: ['#7ec8f0', '#bfe9f7'],
      cover: ['#63c65b', '#4aa348', '#8ddc7c'],
      mid: ['#8a5a33', '#6d4526', '#a6714a'],
      deep: ['#5c6172', '#474c5b', '#6f7488'],
      plank: ['#a9763f', '#7d5327', '#c9975c'],
      fog: 'rgba(190,235,255,0.20)',
      hills: ['#4f8f6d', '#3c7357', '#2c5a44'],
      trees: '#2f6b4c',
    },
    cave: {
      sky: ['#1b1e33', '#2d3350'],
      cover: ['#79839b', '#5b6477', '#98a2ba'],
      mid: ['#4e5566', '#3b4152', '#606879'],
      deep: ['#343a4b', '#282d3c', '#434a5d'],
      plank: ['#7c6a52', '#5a4c3a', '#9a8567'],
      fog: 'rgba(60,90,160,0.22)',
      hills: ['#2b3150', '#232842', '#1b2036'],
      trees: '#2a3054',
    },
    ruin: {
      sky: ['#48407a', '#8e6ea6'],
      cover: ['#a79a84', '#8a7e69', '#c4b89f'],
      mid: ['#7e7462', '#635a4b', '#948a76'],
      deep: ['#544c3f', '#413a30', '#665d4d'],
      plank: ['#8f8b7a', '#6c6859', '#adaa98'],
      fog: 'rgba(255,200,150,0.16)',
      hills: ['#5d5476', '#4a4260', '#38314a'],
      trees: '#463c5e',
    },
  };
  function noiseFill(ctx, colors, seed, x0, y0, w, h) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = U.hash2(x + x0 * 97, y + y0 * 57, seed);
        const c = n < 0.12 ? colors[2] : n < 0.42 ? colors[1] : colors[0];
        ctx.fillStyle = c;
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
  }

  function makeSolid(theme, kind, variant) {
    const th = THEMES[theme];
    const c = U.canvas(T, T);
    const ctx = c.getContext('2d');
    const seed = 1000 + variant * 31 + (kind === 'deep' ? 7 : kind === 'top' ? 3 : 5);
    const base = kind === 'deep' ? th.deep : th.mid;
    noiseFill(ctx, base, seed, 0, 0, T, T);

    if (kind === 'top') {
      // Unregelmaessige Grasnarbe / Moosschicht oben drauf.
      const depth = [5, 4, 5, 6, 4, 5, 6, 5, 4, 5, 5, 6, 4, 5, 4, 5];
      for (let x = 0; x < T; x++) {
        const d = depth[(x + variant * 3) % T] + (U.hash2(x, variant, seed) < 0.3 ? 1 : 0);
        for (let y = 0; y < d; y++) {
          const n = U.hash2(x * 13, y * 7, seed + 11);
          ctx.fillStyle = y === 0 ? th.cover[2] : n < 0.3 ? th.cover[1] : th.cover[0];
          ctx.fillRect(x, y, 1, 1);
        }
        // Ein paar Halme, die in die Erde haengen.
        if (U.hash2(x, 99, seed) < 0.25) {
          ctx.fillStyle = th.cover[1];
          ctx.fillRect(x, d, 1, 1);
        }
      }
    }

    // Kantenlichter: oben heller, unten/rechts dunkler.
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, T - 1, T, 1);
    ctx.fillRect(T - 1, 0, 1, T);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1, T);
    ctx.globalAlpha = 1;
    return c;
  }

  function makePlatform(theme) {
    const th = THEMES[theme];
    const c = U.canvas(T, T);
    const ctx = c.getContext('2d');
    noiseFill(ctx, th.plank, 404, 0, 0, T, 6);
    ctx.fillStyle = th.plank[2];
    ctx.fillRect(0, 0, T, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 5, T, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(5, 1, 1, 4);
    ctx.fillRect(11, 1, 1, 4);
    return c;
  }

  function makeSpike() {
    const c = U.canvas(T, T);
    const ctx = c.getContext('2d');
    // Vier Zacken, jeweils 4 Pixel breit.
    for (let s = 0; s < 4; s++) {
      const ox = s * 4;
      for (let y = 0; y < 10; y++) {
        const half = Math.min(2, Math.floor((y + 1) / 2.6) + 0);
        const w = 1 + Math.floor((y / 9) * 3);
        const x = ox + Math.floor((4 - w) / 2);
        ctx.fillStyle = '#c9d4e6';
        ctx.fillRect(x, T - 10 + y, w, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + w - 1, T - 10 + y, 1, 1);
        void half;
      }
    }
    ctx.fillStyle = '#5a6272';
    ctx.fillRect(0, T - 3, T, 3);
    ctx.fillStyle = '#8b94a6';
    ctx.fillRect(0, T - 3, T, 1);
    return c;
  }

  function makeDecor(theme, i) {
    const th = THEMES[theme];
    const c = U.canvas(8, 8);
    const ctx = c.getContext('2d');
    if (theme === 'forest') {
      if (i === 0) {
        ctx.fillStyle = '#3f9a41';
        ctx.fillRect(3, 3, 1, 5); ctx.fillRect(2, 5, 1, 3); ctx.fillRect(5, 4, 1, 4);
        ctx.fillStyle = '#63c65b';
        ctx.fillRect(4, 2, 1, 6);
      } else if (i === 1) {
        ctx.fillStyle = '#3f9a41'; ctx.fillRect(3, 4, 1, 4);
        ctx.fillStyle = '#ff7ea8'; ctx.fillRect(2, 2, 3, 2);
        ctx.fillStyle = '#ffd94a'; ctx.fillRect(3, 2, 1, 1);
      } else {
        ctx.fillStyle = '#d9d0b8'; ctx.fillRect(2, 5, 3, 3);
        ctx.fillStyle = '#e0553f'; ctx.fillRect(1, 3, 5, 2);
        ctx.fillStyle = '#ffd7c8'; ctx.fillRect(2, 3, 1, 1); ctx.fillRect(4, 3, 1, 1);
      }
    } else if (theme === 'cave') {
      ctx.fillStyle = i === 0 ? '#5fd8ff' : '#8a5cc4';
      ctx.fillRect(3, 3, 2, 5); ctx.fillRect(2, 5, 1, 3); ctx.fillRect(5, 4, 1, 4);
      ctx.fillStyle = '#d5f8ff';
      ctx.fillRect(3, 3, 1, 2);
    } else {
      ctx.fillStyle = th.deep[1];
      ctx.fillRect(1, 5, 5, 3); ctx.fillRect(2, 3, 3, 2);
      ctx.fillStyle = th.deep[2];
      ctx.fillRect(2, 3, 1, 1);
    }
    return c;
  }

  const cache = {};

  function get(theme) {
    if (cache[theme]) return cache[theme];
    const set = {
      theme,
      colors: THEMES[theme],
      top: [0, 1, 2, 3].map((v) => makeSolid(theme, 'top', v)),
      mid: [0, 1, 2, 3].map((v) => makeSolid(theme, 'mid', v)),
      deep: [0, 1, 2, 3].map((v) => makeSolid(theme, 'deep', v)),
      platform: makePlatform(theme),
      spike: makeSpike(),
      decor: [0, 1, 2].map((i) => makeDecor(theme, i)),
    };
    cache[theme] = set;
    return set;
  }

  PX.tiles = { get, THEMES, SIZE: T };
})();
