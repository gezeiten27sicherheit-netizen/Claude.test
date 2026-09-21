// Kleine Helfer: Mathe, deterministischer Zufall, Canvas-Fabrik.
(function () {
  const PX = (window.PX = window.PX || {});

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

  function approach(v, target, step) {
    return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
  }

  // Mulberry32: kleiner, schneller PRNG mit Seed -> reproduzierbare Pixel-Details.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Hash fuer Tile-Varianten: gleiche Koordinate ergibt immer denselben Wert.
  function hash2(x, y, seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').imageSmoothingEnabled = false;
    return c;
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  PX.util = { clamp, lerp, sign, approach, rng, hash2, canvas, aabb };
})();
