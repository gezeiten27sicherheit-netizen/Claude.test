// Voxel world: infinite chunked generation/streaming, textured+AO meshing, voxel raycasting.
(function () {
  const BLOCK = window.G.BLOCK;
  const BLOCK_DATA = window.G.BLOCK_DATA;
  const Config = window.G.Config;

  const CHUNK_SIZE = 16;
  const HEIGHT = 48;
  const SEA_LEVEL = 15;

  const FACES = [
    { normal: [1, 0, 0], shade: 0.82, corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
    { normal: [-1, 0, 0], shade: 0.82, corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
    { normal: [0, 1, 0], shade: 1.0, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
    { normal: [0, -1, 0], shade: 0.6, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
    { normal: [0, 0, 1], shade: 0.9, corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
    { normal: [0, 0, -1], shade: 0.72, corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },
  ];

  function localUV(normal, corner) {
    if (normal[0] !== 0) return [corner[2], 1 - corner[1]];
    if (normal[2] !== 0) return [corner[0], 1 - corner[1]];
    return [corner[0], corner[2]];
  }

  const AO_CURVE = [0.6, 0.75, 0.88, 1.0];

  function hash01(cx, cz, seed) {
    let h = (cx * 374761393 + cz * 668265263 + seed * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }

  class Chunk {
    constructor(cx, cz) {
      this.cx = cx; this.cz = cz;
      this.data = new Uint8Array(CHUNK_SIZE * HEIGHT * CHUNK_SIZE);
      this.entry = null; // three.js meshes
      this.dirty = true;
    }
    index(lx, y, lz) { return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx; }
  }

  class World {
    constructor(seed, scene) {
      this.seed = seed;
      this.scene = scene;
      this.perlin = new window.G.Perlin(seed);
      this.perlinCave = new window.G.Perlin(seed + 9911);
      this.chunks = new Map();
      this.editsByChunk = new Map();
      this.dirtyQueue = new Set();
      this.genQueue = [];
      this.genQueued = new Set();
      this.shrines = [];
      this.boundedRadius = 8; // chunks, used when infiniteWorld feature is off
      this.spawnPoint = { x: 8.5, y: HEIGHT - 1, z: 8.5 };
      this._lastCX = null; this._lastCZ = null; this._lastChunk = null;
      this.time = 0;
      this._buildMaterials();
    }

    _buildMaterials() {
      const atlas = window.G.Textures.buildAtlas();
      this.atlas = atlas;
      this.blockTiles = window.G.Textures.blockTiles(BLOCK);
      this.opaqueMat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, side: THREE.DoubleSide });
      this.glowMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, side: THREE.DoubleSide });
      this.waterMat = new THREE.MeshLambertMaterial({
        map: atlas, vertexColors: true, transparent: true, opacity: 0.75,
        side: THREE.DoubleSide, depthWrite: false,
      });
      this._wireWaterShader();
    }

    _wireWaterShader() {
      // Subtle, cheap vertex bob — guarded so a shader-compile quirk never breaks the game.
      try {
        this.waterMat.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = { value: 0 };
          shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            transformed.y += sin(uTime * 1.6 + position.x * 0.9 + position.z * 0.9) * 0.06;`
          );
          this.waterMat.userData.shader = shader;
        };
        this.waterMat.needsUpdate = true;
      } catch (e) { /* fall back silently to flat water */ }
    }

    applyGraphicsSettings(renderer) {
      const useShaders = Config.graphics.subtleShaders;
      renderer.toneMapping = (Config.graphics.toneMapping && useShaders) ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
      renderer.toneMappingExposure = 1.05;
    }

    tick(dt) {
      this.time += dt;
      const useShaders = Config.graphics.subtleShaders;
      const shader = this.waterMat.userData.shader;
      if (shader) shader.uniforms.uTime.value = useShaders ? this.time : 0;
      if (useShaders) {
        const pulse = 0.86 + 0.14 * Math.sin(this.time * 2.6);
        this.glowMat.color.setScalar(pulse);
        this.waterMat.map.offset.y = (this.waterMat.map.offset.y - dt * 0.015) % 1;
      } else {
        this.glowMat.color.setScalar(1);
      }
    }

    key(cx, cz) { return cx + ',' + cz; }

    heightAt(x, z) {
      const n = this.perlin.fbm2(x * 0.018, z * 0.018, 4, 2.0, 0.5);
      const n2 = this.perlin.fbm2(x * 0.06 + 500, z * 0.06 + 500, 2, 2.0, 0.5) * 3;
      return Math.floor(20 + n * 14 + n2);
    }

    getChunk(cx, cz) {
      if (this._lastCX === cx && this._lastCZ === cz) return this._lastChunk;
      const c = this.chunks.get(this.key(cx, cz));
      this._lastCX = cx; this._lastCZ = cz; this._lastChunk = c;
      return c;
    }

    inBounded(cx, cz) {
      if (Config.features.infiniteWorld) return true;
      return Math.max(Math.abs(cx), Math.abs(cz)) <= this.boundedRadius;
    }

    getBlock(x, y, z) {
      if (y < 0 || y >= HEIGHT) return BLOCK.AIR;
      const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
      const chunk = this.getChunk(cx, cz);
      if (!chunk) return BLOCK.AIR;
      const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
      return chunk.data[chunk.index(lx, y, lz)];
    }

    isSolid(x, y, z) {
      const id = this.getBlock(x, y, z);
      if (id === BLOCK.AIR) return false;
      const d = BLOCK_DATA[id];
      return d ? d.solid !== false : true;
    }

    setBlock(x, y, z, id) {
      if (y < 0 || y >= HEIGHT) return false;
      const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
      const chunk = this.getChunk(cx, cz);
      if (!chunk) return false;
      const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
      chunk.data[chunk.index(lx, y, lz)] = id;

      const ck = this.key(cx, cz);
      let edits = this.editsByChunk.get(ck);
      if (!edits) { edits = new Map(); this.editsByChunk.set(ck, edits); }
      edits.set(chunk.index(lx, y, lz), id);

      this.dirtyQueue.add(ck);
      if (lx === 0) this._maybeDirty(cx - 1, cz);
      if (lx === CHUNK_SIZE - 1) this._maybeDirty(cx + 1, cz);
      if (lz === 0) this._maybeDirty(cx, cz - 1);
      if (lz === CHUNK_SIZE - 1) this._maybeDirty(cx, cz + 1);
      return true;
    }

    _maybeDirty(cx, cz) {
      if (this.chunks.has(this.key(cx, cz))) this.dirtyQueue.add(this.key(cx, cz));
    }

    isChunkLoaded(x, z) {
      const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
      return !!this.getChunk(cx, cz);
    }

    findSurfaceY(x, z) {
      for (let y = HEIGHT - 1; y >= 0; y--) {
        const id = this.getBlock(x, y, z);
        if (id !== BLOCK.AIR && id !== BLOCK.WATER) return y;
      }
      return 1;
    }

    // --- Generation -------------------------------------------------------

    ensureAreaLoaded(cx0, cz0, radius) {
      for (let cz = cz0 - radius; cz <= cz0 + radius; cz++) {
        for (let cx = cx0 - radius; cx <= cx0 + radius; cx++) {
          this.generateChunk(cx, cz);
        }
      }
      for (let cz = cz0 - radius; cz <= cz0 + radius; cz++) {
        for (let cx = cx0 - radius; cx <= cx0 + radius; cx++) {
          this.rebuildChunk(cx, cz);
        }
      }
    }

    generateChunk(cx, cz) {
      const key = this.key(cx, cz);
      if (this.chunks.has(key)) return this.chunks.get(key);
      const chunk = new Chunk(cx, cz);
      const data = chunk.data;
      const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
      const heights = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);

      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const gx = x0 + lx, gz = z0 + lz;
          const h = Math.max(2, Math.min(HEIGHT - 8, this.heightAt(gx, gz)));
          heights[lz * CHUNK_SIZE + lx] = h;
          for (let y = 0; y <= h; y++) {
            let id;
            if (y === h) id = h <= SEA_LEVEL + 1 ? BLOCK.SAND : (h > 34 ? BLOCK.SNOW : BLOCK.GRASS);
            else if (y > h - 4) id = BLOCK.DIRT;
            else id = BLOCK.STONE;
            data[chunk.index(lx, y, lz)] = id;
          }
          for (let y = h + 1; y <= SEA_LEVEL; y++) data[chunk.index(lx, y, lz)] = BLOCK.WATER;
        }
      }

      // Caves.
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const gx = x0 + lx, gz = z0 + lz;
          const h = heights[lz * CHUNK_SIZE + lx];
          const top = Math.min(h - 5, HEIGHT - 1);
          for (let y = 2; y < top; y++) {
            const v = this.perlinCave.fbm3(gx * 0.09, y * 0.12, gz * 0.09, 3, 2.0, 0.5);
            if (v > 0.42) data[chunk.index(lx, y, lz)] = BLOCK.AIR;
          }
        }
      }

      // Ore veins.
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const h = heights[lz * CHUNK_SIZE + lx];
          for (let y = 1; y < h - 2; y++) {
            const i = chunk.index(lx, y, lz);
            if (data[i] !== BLOCK.STONE) continue;
            const r = Math.random();
            if (y < 7 && r < 0.006) data[i] = BLOCK.ORE_CRYSTAL;
            else if (y < 11 && r < 0.012) data[i] = BLOCK.ORE_GOLD;
            else if (r < 0.03) data[i] = BLOCK.ORE_IRON;
          }
        }
      }

      // Trees (kept away from chunk edges so canopies never cross chunk boundaries).
      for (let lz = 3; lz < CHUNK_SIZE - 3; lz++) {
        for (let lx = 3; lx < CHUNK_SIZE - 3; lx++) {
          const h = heights[lz * CHUNK_SIZE + lx];
          if (h <= SEA_LEVEL + 1 || h > 34) continue;
          if (data[chunk.index(lx, h, lz)] !== BLOCK.GRASS) continue;
          if (Math.random() > 0.012) continue;
          this._placeTree(chunk, lx, h + 1, lz);
        }
      }

      // Rare, deterministically-scattered shrines (kept inset so they never cross a boundary).
      if (hash01(cx, cz, this.seed) < 0.015) {
        const lx = 2 + Math.floor(hash01(cx * 3 + 1, cz * 7 + 5, this.seed) * 12);
        const lz = 2 + Math.floor(hash01(cx * 11 + 3, cz * 5 + 9, this.seed) * 12);
        const h = heights[lz * CHUNK_SIZE + lx];
        this._placeShrine(chunk, lx, Math.max(SEA_LEVEL + 1, Math.min(h, HEIGHT - 8)), lz);
      }

      // Re-apply any player edits recorded for this chunk (persists across unload/reload).
      const edits = this.editsByChunk.get(key);
      if (edits) for (const [idx, id] of edits) data[idx] = id;

      this.chunks.set(key, chunk);
      this._lastCX = cx; this._lastCZ = cz; this._lastChunk = chunk;
      return chunk;
    }

    _placeTree(chunk, lx, ly, lz) {
      const trunk = 4 + Math.floor(Math.random() * 2);
      for (let i = 0; i < trunk; i++) {
        if (ly + i < HEIGHT) chunk.data[chunk.index(lx, ly + i, lz)] = BLOCK.WOOD;
      }
      const topY = ly + trunk;
      for (let dy = -1; dy <= 1; dy++) {
        const ry = dy === 1 ? 1 : 2;
        for (let dx = -ry; dx <= ry; dx++) {
          for (let dz = -ry; dz <= ry; dz++) {
            if (Math.abs(dx) === ry && Math.abs(dz) === ry) continue;
            const px = lx + dx, py = topY + dy, pz = lz + dz;
            if (px < 0 || px >= CHUNK_SIZE || pz < 0 || pz >= CHUNK_SIZE || py >= HEIGHT) continue;
            const i = chunk.index(px, py, pz);
            if (chunk.data[i] === BLOCK.AIR) chunk.data[i] = BLOCK.LEAVES;
          }
        }
      }
    }

    _placeShrine(chunk, lx, ly, lz) {
      const gx0 = chunk.cx * CHUNK_SIZE + lx, gz0 = chunk.cz * CHUNK_SIZE + lz;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const px = lx + dx, pz = lz + dz;
          if (px < 0 || px >= CHUNK_SIZE || pz < 0 || pz >= CHUNK_SIZE) continue;
          for (let cy = ly + 1; cy < ly + 4 && cy < HEIGHT; cy++) chunk.data[chunk.index(px, cy, pz)] = BLOCK.AIR;
          const isCorner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
          chunk.data[chunk.index(px, ly, pz)] = isCorner ? BLOCK.ORE_CRYSTAL : BLOCK.SHRINE_STONE;
        }
      }
      if (ly + 1 < HEIGHT) chunk.data[chunk.index(lx, ly + 1, lz)] = BLOCK.SHRINE_STONE;
      if (ly + 2 < HEIGHT) chunk.data[chunk.index(lx, ly + 2, lz)] = BLOCK.SHRINE_GLOW;
      const torchSpots = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
      for (const [tx, tz] of torchSpots) {
        const px = lx + tx, pz = lz + tz;
        if (px < 0 || px >= CHUNK_SIZE || pz < 0 || pz >= CHUNK_SIZE) continue;
        if (ly + 1 < HEIGHT) chunk.data[chunk.index(px, ly + 1, pz)] = BLOCK.TORCH;
      }
      this.shrines.push({ x: gx0 + 0.5, y: ly + 1, z: gz0 + 0.5 });
    }

    // --- Streaming ----------------------------------------------------------

    update(playerX, playerZ) {
      const cx0 = Math.floor(playerX / CHUNK_SIZE), cz0 = Math.floor(playerZ / CHUNK_SIZE);
      const rd = Math.max(2, Math.min(10, Config.graphics.renderDistance || 4));

      for (let cz = cz0 - rd; cz <= cz0 + rd; cz++) {
        for (let cx = cx0 - rd; cx <= cx0 + rd; cx++) {
          if (!this.inBounded(cx, cz)) continue;
          const key = this.key(cx, cz);
          if (this.chunks.has(key) || this.genQueued.has(key)) continue;
          this.genQueued.add(key);
          this.genQueue.push([cx, cz, (cx - cx0) * (cx - cx0) + (cz - cz0) * (cz - cz0)]);
        }
      }
      this.genQueue.sort((a, b) => a[2] - b[2]);

      let budget = 3;
      while (budget > 0 && this.genQueue.length) {
        const [cx, cz] = this.genQueue.shift();
        const key = this.key(cx, cz);
        this.genQueued.delete(key);
        if (!this.chunks.has(key)) {
          this.generateChunk(cx, cz);
          this.dirtyQueue.add(key);
          // A freshly generated chunk can uncover faces on neighbours that meshed while it was still empty.
          this._maybeDirty(cx - 1, cz); this._maybeDirty(cx + 1, cz);
          this._maybeDirty(cx, cz - 1); this._maybeDirty(cx, cz + 1);
        }
        budget--;
      }

      // Unload far chunks (keep the edit diff so terrain + player changes are consistent on reload).
      const unloadDist = rd + 3;
      for (const [key, chunk] of Array.from(this.chunks)) {
        if (Math.max(Math.abs(chunk.cx - cx0), Math.abs(chunk.cz - cz0)) > unloadDist) {
          if (chunk.entry) { this.scene.remove(chunk.entry.group); this._disposeEntry(chunk.entry); }
          this.chunks.delete(key);
          if (this._lastCX === chunk.cx && this._lastCZ === chunk.cz) { this._lastChunk = null; this._lastCX = null; this._lastCZ = null; }
        }
      }

      this.flushDirtyChunks(3);
    }

    enforceBounds() {
      if (Config.features.infiniteWorld) return;
      for (const [key, chunk] of Array.from(this.chunks)) {
        if (!this.inBounded(chunk.cx, chunk.cz)) {
          if (chunk.entry) { this.scene.remove(chunk.entry.group); this._disposeEntry(chunk.entry); }
          this.chunks.delete(key);
        }
      }
    }

    markAllDirty() {
      for (const key of this.chunks.keys()) this.dirtyQueue.add(key);
    }

    flushDirtyChunks(maxCount) {
      let count = 0;
      for (const key of Array.from(this.dirtyQueue)) {
        if (count >= maxCount) break;
        this.dirtyQueue.delete(key);
        const [cx, cz] = key.split(',').map(Number);
        if (this.chunks.has(key)) this.rebuildChunk(cx, cz);
        count++;
      }
    }

    _disposeEntry(entry) {
      for (const f of ['opaqueMesh', 'waterMesh', 'glowMesh']) {
        if (entry[f]) entry[f].geometry.dispose();
      }
    }

    faceVisible(myId, neighId) {
      if (neighId === BLOCK.AIR) return true;
      const nd = BLOCK_DATA[neighId];
      if (!nd) return true;
      if (nd.transparent) return neighId !== myId;
      if (nd.solid === false) return true;
      return false;
    }

    rebuildChunk(cx, cz) {
      const chunk = this.getChunk(cx, cz);
      if (!chunk) return;
      const useAO = Config.graphics.ambientOcclusion;
      const opaque = { pos: [], norm: [], col: [], uv: [], idx: [] };
      const water = { pos: [], norm: [], col: [], uv: [], idx: [] };
      const glow = { pos: [], norm: [], col: [], uv: [], idx: [] };

      const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
      for (let ly = 0; ly < HEIGHT; ly++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const id = chunk.data[chunk.index(lx, ly, lz)];
            if (id === BLOCK.AIR) continue;
            const d = BLOCK_DATA[id];
            if (!d) continue;
            const gx = x0 + lx, gy = ly, gz = z0 + lz;
            const target = id === BLOCK.WATER ? water : (d.light ? glow : opaque);
            const tiles = this.blockTiles[id];

            for (let f = 0; f < 6; f++) {
              const face = FACES[f];
              const nx = gx + face.normal[0], ny = gy + face.normal[1], nz = gz + face.normal[2];
              const neighId = this.getBlock(nx, ny, nz);
              if (!this.faceVisible(id, neighId)) continue;

              const tileName = face.normal[1] > 0 ? (tiles ? tiles.top : null)
                : face.normal[1] < 0 ? (tiles ? tiles.bottom : null)
                : (tiles ? tiles.side : null);
              const tile = window.G.Textures.tileUV(tileName || 'stone');

              const shade = target === glow ? 1.0 : face.shade;
              const base = target.pos.length / 3;
              for (const corner of face.corners) {
                target.pos.push(gx + corner[0], gy + corner[1], gz + corner[2]);
                target.norm.push(face.normal[0], face.normal[1], face.normal[2]);
                let ao = 1;
                if (useAO && target !== glow) {
                  ao = this._cornerAO(gx, gy, gz, face.normal, corner);
                }
                const tint = shade * ao;
                target.col.push(tint, tint, tint);
                const [u, v] = localUV(face.normal, corner);
                target.uv.push(tile.u0 + u * (tile.u1 - tile.u0), tile.v0 + v * (tile.v1 - tile.v0));
              }
              target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
          }
        }
      }

      let entry = chunk.entry;
      if (!entry) {
        entry = { group: new THREE.Group() };
        this.scene.add(entry.group);
        chunk.entry = entry;
      }
      entry.group.clear();
      this._assign(entry, 'opaqueMesh', opaque, this.opaqueMat);
      this._assign(entry, 'waterMesh', water, this.waterMat);
      this._assign(entry, 'glowMesh', glow, this.glowMat);
    }

    _cornerAO(bx, by, bz, normal, corner) {
      const axes = [0, 1, 2].filter((i) => normal[i] === 0);
      const a = axes[0], b = axes[1];
      const cornerArr = corner;
      const dA = cornerArr[a] * 2 - 1, dB = cornerArr[b] * 2 - 1;
      const offA = [0, 0, 0]; offA[a] = dA;
      const offB = [0, 0, 0]; offB[b] = dB;
      const p1x = bx + normal[0] + offA[0], p1y = by + normal[1] + offA[1], p1z = bz + normal[2] + offA[2];
      const p2x = bx + normal[0] + offB[0], p2y = by + normal[1] + offB[1], p2z = bz + normal[2] + offB[2];
      const p3x = bx + normal[0] + offA[0] + offB[0], p3y = by + normal[1] + offA[1] + offB[1], p3z = bz + normal[2] + offA[2] + offB[2];
      const s1 = this.isSolid(p1x, p1y, p1z) ? 1 : 0;
      const s2 = this.isSolid(p2x, p2y, p2z) ? 1 : 0;
      const s3 = this.isSolid(p3x, p3y, p3z) ? 1 : 0;
      const ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + s3);
      return AO_CURVE[ao];
    }

    _assign(entry, field, data, material) {
      if (entry[field]) entry[field].geometry.dispose();
      if (data.pos.length === 0) { entry[field] = null; return; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.norm, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
      geo.setIndex(data.idx);
      const mesh = new THREE.Mesh(geo, material);
      entry[field] = mesh;
      entry.group.add(mesh);
    }

    // Voxel DDA raycast. Returns { x,y,z, nx,ny,nz, dist, id } or null.
    raycast(origin, dir, maxDist) {
      let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
      const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
      const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
      const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;
      const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
      const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
      const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
      let tMaxX = dir.x > 0 ? (x + 1 - origin.x) * tDeltaX : dir.x < 0 ? (origin.x - x) * tDeltaX : Infinity;
      let tMaxY = dir.y > 0 ? (y + 1 - origin.y) * tDeltaY : dir.y < 0 ? (origin.y - y) * tDeltaY : Infinity;
      let tMaxZ = dir.z > 0 ? (z + 1 - origin.z) * tDeltaZ : dir.z < 0 ? (origin.z - z) * tDeltaZ : Infinity;
      let nx = 0, ny = 0, nz = 0;
      let dist = 0;
      let guard = 0;
      while (dist < maxDist && guard++ < 256) {
        const id = this.getBlock(x, y, z);
        if (id !== BLOCK.AIR && id !== BLOCK.WATER) return { x, y, z, nx, ny, nz, dist, id };
        if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; dist = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
        else if (tMaxY < tMaxZ) { y += stepY; dist = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
        else { z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
      }
      return null;
    }
  }

  window.G.World = World;
  window.G.WORLD_HEIGHT = HEIGHT;
  window.G.CHUNK_SIZE = CHUNK_SIZE;
  window.G.SEA_LEVEL = SEA_LEVEL;
})();
