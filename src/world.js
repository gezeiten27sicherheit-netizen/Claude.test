// Voxel world: generation, chunked meshing, block access, voxel raycasting.
(function () {
  const BLOCK = window.G.BLOCK;
  const BLOCK_DATA = window.G.BLOCK_DATA;
  const ITEMS = window.G.ITEMS;

  const CHUNK_SIZE = 16;
  const CHUNKS_PER_SIDE = 5;
  const WORLD_SIZE = CHUNK_SIZE * CHUNKS_PER_SIDE; // 80
  const HEIGHT = 40;
  const SEA_LEVEL = 13;

  const FACES = [
    // dir: +x
    { normal: [1, 0, 0], shade: 0.75, corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
    // -x
    { normal: [-1, 0, 0], shade: 0.75, corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
    // +y (top)
    { normal: [0, 1, 0], shade: 1.0, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
    // -y (bottom)
    { normal: [0, -1, 0], shade: 0.45, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
    // +z
    { normal: [0, 0, 1], shade: 0.85, corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
    // -z
    { normal: [0, 0, -1], shade: 0.6, corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },
  ];

  function idxOf(x, y, z) { return (y * WORLD_SIZE + z) * WORLD_SIZE + x; }
  function inBounds(x, y, z) { return x >= 0 && x < WORLD_SIZE && y >= 0 && y < HEIGHT && z >= 0 && z < WORLD_SIZE; }

  class World {
    constructor(seed, scene) {
      this.seed = seed;
      this.scene = scene;
      this.data = new Uint8Array(WORLD_SIZE * HEIGHT * WORLD_SIZE);
      this.perlin = new window.G.Perlin(seed);
      this.perlinCave = new window.G.Perlin(seed + 9911);
      this.chunkMeshes = new Map();
      this.dirtyChunks = new Set();
      this.shrines = [];
      this.spawnPoint = { x: WORLD_SIZE / 2, y: HEIGHT - 1, z: WORLD_SIZE / 2 };
    }

    key(cx, cz) { return cx + ',' + cz; }

    heightAt(x, z) {
      const n = this.perlin.fbm2(x * 0.018, z * 0.018, 4, 2.0, 0.5);
      const n2 = this.perlin.fbm2(x * 0.06 + 500, z * 0.06 + 500, 2, 2.0, 0.5) * 3;
      return Math.floor(17 + n * 13 + n2);
    }

    generate() {
      const heightmap = new Int32Array(WORLD_SIZE * WORLD_SIZE);
      for (let z = 0; z < WORLD_SIZE; z++) {
        for (let x = 0; x < WORLD_SIZE; x++) {
          const h = Math.max(2, Math.min(HEIGHT - 6, this.heightAt(x, z)));
          heightmap[z * WORLD_SIZE + x] = h;
          for (let y = 0; y <= h; y++) {
            let id;
            if (y === h) id = h <= SEA_LEVEL + 1 ? BLOCK.SAND : (h > 30 ? BLOCK.SNOW : BLOCK.GRASS);
            else if (y > h - 4) id = BLOCK.DIRT;
            else id = BLOCK.STONE;
            this.data[idxOf(x, y, z)] = id;
          }
          for (let y = h + 1; y <= SEA_LEVEL; y++) {
            this.data[idxOf(x, y, z)] = BLOCK.WATER;
          }
        }
      }

      // Caves: carve blobby pockets out of stone, away from the surface.
      for (let z = 1; z < WORLD_SIZE - 1; z++) {
        for (let x = 1; x < WORLD_SIZE - 1; x++) {
          const h = heightmap[z * WORLD_SIZE + x];
          const top = Math.min(h - 5, HEIGHT - 1);
          for (let y = 2; y < top; y++) {
            const v = this.perlinCave.fbm3(x * 0.09, y * 0.12, z * 0.09, 3, 2.0, 0.5);
            if (v > 0.42) this.data[idxOf(x, y, z)] = BLOCK.AIR;
          }
        }
      }

      // Ore veins.
      for (let z = 0; z < WORLD_SIZE; z++) {
        for (let x = 0; x < WORLD_SIZE; x++) {
          const h = heightmap[z * WORLD_SIZE + x];
          for (let y = 1; y < h - 2; y++) {
            const i = idxOf(x, y, z);
            if (this.data[i] !== BLOCK.STONE) continue;
            const r = Math.random();
            if (y < 7 && r < 0.006) this.data[i] = BLOCK.ORE_CRYSTAL;
            else if (y < 11 && r < 0.012) this.data[i] = BLOCK.ORE_GOLD;
            else if (r < 0.03) this.data[i] = BLOCK.ORE_IRON;
          }
        }
      }

      // Trees.
      for (let z = 3; z < WORLD_SIZE - 3; z++) {
        for (let x = 3; x < WORLD_SIZE - 3; x++) {
          const h = heightmap[z * WORLD_SIZE + x];
          if (h <= SEA_LEVEL + 1 || h > 30) continue;
          if (this.data[idxOf(x, h, z)] !== BLOCK.GRASS) continue;
          if (Math.random() > 0.012) continue;
          this.placeTree(x, h + 1, z);
        }
      }

      this.buildShrines(heightmap);

      const sx = Math.floor(WORLD_SIZE / 2), sz = Math.floor(WORLD_SIZE / 2);
      this.spawnPoint = { x: sx + 0.5, y: this.findSurfaceY(sx, sz) + 1.2, z: sz + 0.5 };
    }

    findSurfaceY(x, z) {
      for (let y = HEIGHT - 1; y >= 0; y--) {
        const id = this.data[idxOf(x, y, z)];
        if (id !== BLOCK.AIR && id !== BLOCK.WATER) return y;
      }
      return 1;
    }

    placeTree(x, y, z) {
      const trunk = 4 + Math.floor(Math.random() * 2);
      for (let i = 0; i < trunk; i++) {
        if (inBounds(x, y + i, z)) this.data[idxOf(x, y + i, z)] = BLOCK.WOOD;
      }
      const topY = y + trunk;
      for (let dy = -1; dy <= 1; dy++) {
        const ry = dy === 1 ? 1 : 2;
        for (let dx = -ry; dx <= ry; dx++) {
          for (let dz = -ry; dz <= ry; dz++) {
            if (Math.abs(dx) === ry && Math.abs(dz) === ry) continue;
            const lx = x + dx, ly = topY + dy, lz = z + dz;
            if (!inBounds(lx, ly, lz)) continue;
            if (this.data[idxOf(lx, ly, lz)] === BLOCK.AIR) this.data[idxOf(lx, ly, lz)] = BLOCK.LEAVES;
          }
        }
      }
    }

    buildShrines(heightmap) {
      const spots = [
        [16, 16], [64, 16], [16, 64], [64, 64], [40, 40],
      ];
      for (const [sx, sz] of spots) {
        const h = heightmap[sz * WORLD_SIZE + sx];
        const y = Math.max(SEA_LEVEL + 1, Math.min(h, 32));
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            const x = sx + dx, z = sz + dz;
            if (!inBounds(x, y, z)) continue;
            // Clear the space above the platform.
            for (let cy = y + 1; cy < y + 4; cy++) {
              if (inBounds(x, cy, z)) this.data[idxOf(x, cy, z)] = BLOCK.AIR;
            }
            const isCorner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
            this.data[idxOf(x, y, z)] = isCorner ? BLOCK.ORE_CRYSTAL : BLOCK.SHRINE_STONE;
          }
        }
        // Central glowing pillar.
        if (inBounds(sx, y + 1, sz)) this.data[idxOf(sx, y + 1, sz)] = BLOCK.SHRINE_STONE;
        if (inBounds(sx, y + 2, sz)) this.data[idxOf(sx, y + 2, sz)] = BLOCK.SHRINE_GLOW;
        // Torch ring.
        const torchSpots = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
        for (const [tx, tz] of torchSpots) {
          const x = sx + tx, z = sz + tz;
          if (inBounds(x, y + 1, z)) this.data[idxOf(x, y + 1, z)] = BLOCK.TORCH;
        }
        this.shrines.push({ x: sx + 0.5, y: y + 1, z: sz + 0.5 });
      }
    }

    getBlock(x, y, z) {
      x |= 0; y |= 0; z |= 0;
      if (!inBounds(x, y, z)) return BLOCK.AIR;
      return this.data[idxOf(x, y, z)];
    }

    isSolid(x, y, z) {
      const id = this.getBlock(x, y, z);
      if (id === BLOCK.AIR) return false;
      const d = BLOCK_DATA[id];
      return d ? d.solid !== false : true;
    }

    setBlock(x, y, z, id) {
      x |= 0; y |= 0; z |= 0;
      if (!inBounds(x, y, z)) return false;
      this.data[idxOf(x, y, z)] = id;
      const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
      this.dirtyChunks.add(this.key(cx, cz));
      const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
      if (lx === 0 && cx > 0) this.dirtyChunks.add(this.key(cx - 1, cz));
      if (lx === CHUNK_SIZE - 1 && cx < CHUNKS_PER_SIDE - 1) this.dirtyChunks.add(this.key(cx + 1, cz));
      if (lz === 0 && cz > 0) this.dirtyChunks.add(this.key(cx, cz - 1));
      if (lz === CHUNK_SIZE - 1 && cz < CHUNKS_PER_SIDE - 1) this.dirtyChunks.add(this.key(cx, cz + 1));
      return true;
    }

    faceVisible(myId, neighId) {
      if (neighId === BLOCK.AIR) return true;
      const nd = BLOCK_DATA[neighId];
      if (!nd) return true;
      if (nd.transparent) return neighId !== myId;
      if (nd.solid === false) return true;
      return false;
    }

    buildAllChunks() {
      for (let cz = 0; cz < CHUNKS_PER_SIDE; cz++) {
        for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
          this.dirtyChunks.add(this.key(cx, cz));
        }
      }
      this.flushDirtyChunks(9999);
    }

    flushDirtyChunks(maxCount) {
      let count = 0;
      for (const key of Array.from(this.dirtyChunks)) {
        if (count >= maxCount) break;
        this.dirtyChunks.delete(key);
        const [cx, cz] = key.split(',').map(Number);
        this.rebuildChunk(cx, cz);
        count++;
      }
    }

    rebuildChunk(cx, cz) {
      const opaque = { pos: [], norm: [], col: [], idx: [] };
      const water = { pos: [], norm: [], col: [], idx: [] };
      const glow = { pos: [], norm: [], col: [], idx: [] };

      const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
      for (let ly = 0; ly < HEIGHT; ly++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const gx = x0 + lx, gy = ly, gz = z0 + lz;
            const id = this.data[idxOf(gx, gy, gz)];
            if (id === BLOCK.AIR) continue;
            const d = BLOCK_DATA[id];
            if (!d) continue;
            const target = id === BLOCK.WATER ? water : (d.light ? glow : opaque);
            const c = d.color;
            const r0 = (c >> 16 & 255) / 255, g0 = (c >> 8 & 255) / 255, b0 = (c & 255) / 255;
            for (let f = 0; f < 6; f++) {
              const face = FACES[f];
              const nx = gx + face.normal[0], ny = gy + face.normal[1], nz = gz + face.normal[2];
              const neighId = this.getBlock(nx, ny, nz);
              if (!this.faceVisible(id, neighId)) continue;
              const shade = target === glow ? 1.0 : face.shade;
              const base = target.pos.length / 3;
              for (const corner of face.corners) {
                target.pos.push(gx + corner[0], gy + corner[1], gz + corner[2]);
                target.norm.push(face.normal[0], face.normal[1], face.normal[2]);
                target.col.push(r0 * shade, g0 * shade, b0 * shade);
              }
              target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
          }
        }
      }

      let entry = this.chunkMeshes.get(this.key(cx, cz));
      if (!entry) {
        entry = { group: new THREE.Group() };
        entry.group.position.set(0, 0, 0);
        this.scene.add(entry.group);
        this.chunkMeshes.set(this.key(cx, cz), entry);
      }
      entry.group.clear();
      this._assign(entry, 'opaqueMesh', opaque, materials.opaque);
      this._assign(entry, 'waterMesh', water, materials.water);
      this._assign(entry, 'glowMesh', glow, materials.glow);
    }

    _assign(entry, field, data, material) {
      if (entry[field]) entry[field].geometry.dispose();
      if (data.pos.length === 0) { entry[field] = null; return; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.norm, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
      geo.setIndex(data.idx);
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = true;
      entry[field] = mesh;
      entry.group.add(mesh);
    }

    // Voxel DDA raycast. Returns { x,y,z, nx,ny,nz, dist } or null.
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
        if (id !== BLOCK.AIR && id !== BLOCK.WATER) {
          return { x, y, z, nx, ny, nz, dist, id };
        }
        if (tMaxX < tMaxY && tMaxX < tMaxZ) {
          x += stepX; dist = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
        } else if (tMaxY < tMaxZ) {
          y += stepY; dist = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
        } else {
          z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
        }
      }
      return null;
    }
  }

  const materials = {
    opaque: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    water: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  };

  window.G.World = World;
  window.G.WORLD_SIZE = WORLD_SIZE;
  window.G.WORLD_HEIGHT = HEIGHT;
  window.G.CHUNK_SIZE = CHUNK_SIZE;
  window.G.SEA_LEVEL = SEA_LEVEL;
})();
