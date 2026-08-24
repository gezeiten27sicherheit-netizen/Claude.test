// Procedural pixel-art texture atlas: every tile is hand-drawn at runtime onto a canvas
// (own assets, not a Minecraft texture recolor), then used as a single NearestFilter atlas.
(function () {
  const TILE_PX = 16;
  const COLS = 6, ROWS = 4;
  const ATLAS_W = COLS * TILE_PX, ATLAS_H = ROWS * TILE_PX;

  const TILES = [
    'grass_top', 'grass_side', 'dirt', 'stone', 'sand', 'wood_top',
    'wood_side', 'plank', 'leaves', 'ore_iron', 'ore_gold', 'ore_crystal',
    'shrine_stone', 'shrine_glow', 'torch', 'snow', 'water_still', 'prop',
  ];
  const TILE_INDEX = {};
  TILES.forEach((name, i) => { TILE_INDEX[name] = i; });

  function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function fillBase(ctx, x0, y0, s, color) { ctx.fillStyle = hex(color); ctx.fillRect(x0, y0, s, s); }
  function speck(ctx, x0, y0, s, color, count, alpha) {
    ctx.fillStyle = hex(color); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    for (let i = 0; i < count; i++) {
      ctx.fillRect(x0 + Math.floor(Math.random() * s), y0 + Math.floor(Math.random() * s), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  function blotch(ctx, x0, y0, s, color, cx, cy, r) {
    ctx.fillStyle = hex(color);
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r + (Math.random() < 0.3 ? 1 : 0)) {
          const px = cx + x, py = cy + y;
          if (px >= 0 && px < s && py >= 0 && py < s) ctx.fillRect(x0 + px, y0 + py, 1, 1);
        }
      }
    }
  }

  const DRAW = {
    grass_top(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x5b9c3a);
      speck(ctx, x0, y0, s, 0x3f7d2c, 34, 0.8);
      speck(ctx, x0, y0, s, 0x7bc954, 20, 0.7);
      speck(ctx, x0, y0, s, 0x6ab348, 14, 0.5);
    },
    grass_side(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x7a5230);
      speck(ctx, x0, y0, s, 0x5e3f24, 26, 0.8);
      speck(ctx, x0, y0, s, 0x8f6440, 16, 0.6);
      ctx.fillStyle = hex(0x5b9c3a);
      for (let x = 0; x < s; x++) {
        const h = 4 + Math.floor(Math.random() * 3) - 1;
        ctx.fillRect(x0 + x, y0, 1, Math.max(2, h));
      }
      speck(ctx, x0, y0, 6, 0x3f7d2c, 10, 0.7);
    },
    dirt(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x7a5230);
      speck(ctx, x0, y0, s, 0x5e3f24, 30, 0.85);
      speck(ctx, x0, y0, s, 0x8f6440, 18, 0.6);
      speck(ctx, x0, y0, s, 0x4a3018, 10, 0.9);
    },
    stone(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x8a8a8e);
      speck(ctx, x0, y0, s, 0x6f6f74, 28, 0.8);
      speck(ctx, x0, y0, s, 0xa4a4aa, 20, 0.6);
      ctx.strokeStyle = hex(0x6a6a6e); ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(x0 + rnd(2, 6), y0 + rnd(2, 6)); ctx.lineTo(x0 + rnd(8, 14), y0 + rnd(8, 14)); ctx.stroke();
      ctx.globalAlpha = 1;
    },
    sand(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0xe0d18f);
      speck(ctx, x0, y0, s, 0xc9b877, 26, 0.8);
      speck(ctx, x0, y0, s, 0xefe4ab, 18, 0.6);
    },
    wood_top(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x8a6339);
      const cx = s / 2, cy = s / 2;
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
          const ring = Math.floor(d / 1.6) % 2;
          ctx.fillStyle = ring ? hex(0x6b4a2b) : hex(0x7a5432);
          ctx.fillRect(x0 + x, y0 + y, 1, 1);
        }
      }
      ctx.fillStyle = hex(0x4a3320); ctx.fillRect(x0 + cx - 1, y0 + cy - 1, 2, 2);
    },
    wood_side(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x6b4a2b);
      for (let x = 0; x < s; x++) {
        const shade = (x % 3 === 0) ? 0x5a3d22 : (x % 3 === 1 ? 0x6b4a2b : 0x7a5432);
        ctx.fillStyle = hex(shade); ctx.fillRect(x0 + x, y0, 1, s);
      }
      speck(ctx, x0, y0, s, 0x4a3320, 10, 0.5);
    },
    plank(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0xb08552);
      speck(ctx, x0, y0, s, 0x9c714a, 20, 0.5);
      ctx.fillStyle = hex(0x8f6b3f);
      for (let y = 0; y < s; y += 4) ctx.fillRect(x0, y0 + y, s, 1);
      speck(ctx, x0, y0, s, 0xc79a63, 14, 0.5);
    },
    leaves(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x3f7d2c);
      speck(ctx, x0, y0, s, 0x2c5c1e, 40, 0.9);
      speck(ctx, x0, y0, s, 0x5aa83c, 26, 0.8);
      speck(ctx, x0, y0, s, 0x255016, 14, 0.7);
    },
    ore_iron(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x8a8a8e);
      speck(ctx, x0, y0, s, 0x6f6f74, 16, 0.7);
      blotch(ctx, x0, y0, s, 0xc9a27a, 4, 5, 2); blotch(ctx, x0, y0, s, 0xc9a27a, 11, 10, 2);
      blotch(ctx, x0, y0, s, 0xdcb994, 7, 3, 1);
    },
    ore_gold(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x8a8a8e);
      speck(ctx, x0, y0, s, 0x6f6f74, 14, 0.7);
      blotch(ctx, x0, y0, s, 0xe8c34a, 5, 6, 2); blotch(ctx, x0, y0, s, 0xe8c34a, 11, 10, 2);
      speck(ctx, x0, y0, s, 0xfff6c8, 6, 0.9);
    },
    ore_crystal(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x74747a);
      speck(ctx, x0, y0, s, 0x606066, 14, 0.7);
      blotch(ctx, x0, y0, s, 0x6fe8e0, 8, 8, 3); blotch(ctx, x0, y0, s, 0x49c8ff, 4, 4, 1);
      speck(ctx, x0, y0, s, 0xffffff, 5, 0.9);
    },
    shrine_stone(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x3a3d52);
      speck(ctx, x0, y0, s, 0x2c2e42, 22, 0.8);
      speck(ctx, x0, y0, s, 0x4d5170, 16, 0.6);
      ctx.strokeStyle = hex(0x5a6a8a); ctx.globalAlpha = 0.7;
      ctx.strokeRect(x0 + 3, y0 + 3, s - 6, s - 6);
      ctx.globalAlpha = 1;
      speck(ctx, x0, y0, s, 0x49e0ff, 4, 0.9);
    },
    shrine_glow(ctx, x0, y0, s) {
      const cx = s / 2, cy = s / 2;
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const d = Math.hypot(x - cx + 0.5, y - cy + 0.5) / (s / 2);
          const t = Math.max(0, 1 - d);
          const col = t > 0.6 ? 0xffffff : (t > 0.3 ? 0x9af5ff : 0x49e0ff);
          ctx.fillStyle = hex(col); ctx.fillRect(x0 + x, y0 + y, 1, 1);
        }
      }
    },
    torch(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x2a2f3a);
      ctx.fillStyle = hex(0x6b4a2b); ctx.fillRect(x0 + 6, y0 + 8, 4, 8);
      blotch(ctx, x0, y0, s, 0xff7a3c, 8, 5, 4); blotch(ctx, x0, y0, s, 0xffb347, 8, 4, 3);
      blotch(ctx, x0, y0, s, 0xffe08a, 8, 3, 1);
    },
    snow(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0xf2f6ff);
      speck(ctx, x0, y0, s, 0xdbe6f5, 20, 0.7);
      speck(ctx, x0, y0, s, 0xffffff, 16, 0.9);
    },
    water_still(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0x3b6fd6);
      speck(ctx, x0, y0, s, 0x5a8de8, 18, 0.5);
      speck(ctx, x0, y0, s, 0x2a5bb8, 14, 0.5);
    },
    prop(ctx, x0, y0, s) {
      fillBase(ctx, x0, y0, s, 0xd7a24a);
      speck(ctx, x0, y0, s, 0xb0812f, 24, 0.8);
      ctx.strokeStyle = hex(0x8f6720); ctx.globalAlpha = 0.8;
      ctx.strokeRect(x0 + 1, y0 + 1, s - 2, s - 2);
      ctx.globalAlpha = 1;
    },
  };

  function buildAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_W; canvas.height = ATLAS_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    TILES.forEach((name, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      DRAW[name](ctx, col * TILE_PX, row * TILE_PX, TILE_PX);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 1;
    if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  function tileUV(name) {
    const i = TILE_INDEX[name] !== undefined ? TILE_INDEX[name] : TILE_INDEX.blank;
    const col = i % COLS, row = Math.floor(i / COLS);
    return { u0: col / COLS, v0: row / ROWS, u1: (col + 1) / COLS, v1: (row + 1) / ROWS };
  }

  // Which atlas tile each block face uses.
  function blockTiles(BLOCK) {
    const T = (top, side, bottom) => ({ top, side, bottom: bottom || side });
    const map = {};
    map[BLOCK.GRASS] = T('grass_top', 'grass_side', 'dirt');
    map[BLOCK.DIRT] = T('dirt', 'dirt');
    map[BLOCK.STONE] = T('stone', 'stone');
    map[BLOCK.SAND] = T('sand', 'sand');
    map[BLOCK.WATER] = T('water_still', 'water_still');
    map[BLOCK.WOOD] = T('wood_top', 'wood_side');
    map[BLOCK.LEAVES] = T('leaves', 'leaves');
    map[BLOCK.PLANK] = T('plank', 'plank');
    map[BLOCK.ORE_IRON] = T('ore_iron', 'ore_iron');
    map[BLOCK.ORE_GOLD] = T('ore_gold', 'ore_gold');
    map[BLOCK.ORE_CRYSTAL] = T('ore_crystal', 'ore_crystal');
    map[BLOCK.SHRINE_STONE] = T('shrine_stone', 'shrine_stone');
    map[BLOCK.SHRINE_GLOW] = T('shrine_glow', 'shrine_glow');
    map[BLOCK.TORCH] = T('torch', 'torch');
    map[BLOCK.SNOW] = T('snow', 'snow', 'dirt');
    return map;
  }

  window.G = window.G || {};
  window.G.Textures = { buildAtlas, tileUV, blockTiles, TILE_PX };
})();
