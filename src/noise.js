// Seeded Perlin-style noise (classic permutation-table noise, public-domain algorithm adapted).
(function () {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(t, a, b) { return a + t * (b - a); }
  function grad2(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  }
  function grad3(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  class Perlin {
    constructor(seed) {
      const rand = mulberry32(seed >>> 0);
      const p = new Uint8Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
      }
      this.perm = new Uint8Array(512);
      for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    noise2D(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const perm = this.perm;
      const aa = perm[X + perm[Y]], ab = perm[X + perm[Y + 1]];
      const ba = perm[X + 1 + perm[Y]], bb = perm[X + 1 + perm[Y + 1]];
      return lerp(v,
        lerp(u, grad2(aa, x, y), grad2(ba, x - 1, y)),
        lerp(u, grad2(ab, x, y - 1), grad2(bb, x - 1, y - 1)));
    }

    noise3D(x, y, z) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = fade(x), v = fade(y), w = fade(z);
      const perm = this.perm;
      const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
      const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
      return lerp(w,
        lerp(v, lerp(u, grad3(perm[AA], x, y, z), grad3(perm[BA], x - 1, y, z)),
                lerp(u, grad3(perm[AB], x, y - 1, z), grad3(perm[BB], x - 1, y - 1, z))),
        lerp(v, lerp(u, grad3(perm[AA + 1], x, y, z - 1), grad3(perm[BA + 1], x - 1, y, z - 1)),
                lerp(u, grad3(perm[AB + 1], x, y - 1, z - 1), grad3(perm[BB + 1], x - 1, y - 1, z - 1))));
    }

    // Fractal Brownian Motion sum, 2D
    fbm2(x, y, octaves, lacunarity, gain) {
      let sum = 0, amp = 0.5, freq = 1, max = 0;
      for (let i = 0; i < octaves; i++) {
        sum += amp * this.noise2D(x * freq, y * freq);
        max += amp;
        amp *= gain;
        freq *= lacunarity;
      }
      return sum / max;
    }

    fbm3(x, y, z, octaves, lacunarity, gain) {
      let sum = 0, amp = 0.5, freq = 1, max = 0;
      for (let i = 0; i < octaves; i++) {
        sum += amp * this.noise3D(x * freq, y * freq, z * freq);
        max += amp;
        amp *= gain;
        freq *= lacunarity;
      }
      return sum / max;
    }
  }

  window.G = window.G || {};
  window.G.Perlin = Perlin;
})();
