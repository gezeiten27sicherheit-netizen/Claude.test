// Ultrahand/Recall physics props: small grabbable, movable, rewindable block objects.
(function () {
  const moveWithCollision = window.G.moveWithCollision;
  const HISTORY_STEP = 0.05;
  const HISTORY_MAX = 160; // ~8s of trail

  class PhysicsProp {
    constructor(x, y, z, blockId) {
      this.pos = new THREE.Vector3(x, y, z); // x/z centered, y = feet
      this.vel = new THREE.Vector3();
      this.blockId = blockId;
      this.halfWidth = 0.47;
      this.height = 0.96;
      this.grabbed = false;
      this.recalling = false;
      this.recallIndex = -1;
      this.history = [];
      this.historyTimer = 0;
      this.dead = false;

      const bd = (window.G.BLOCK_DATA[blockId] || { color: 0xd7a24a });
      const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
      const mat = new THREE.MeshLambertMaterial({ color: bd.color, emissive: bd.light ? bd.color : 0x000000, emissiveIntensity: bd.light ? 0.5 : 0 });
      this.mesh = new THREE.Mesh(geo, mat);
      this._syncMesh();
    }

    _syncMesh() {
      this.mesh.position.set(this.pos.x, this.pos.y + this.height / 2, this.pos.z);
    }

    startGrab() { this.grabbed = true; this.recalling = false; this.vel.set(0, 0, 0); }
    release() { this.grabbed = false; }

    startRecall() {
      if (this.grabbed || this.history.length === 0) return false;
      this.recalling = true;
      this.recallIndex = this.history.length - 1;
      return true;
    }

    stopRecall() {
      if (!this.recalling) return;
      this.recalling = false;
      this.history = this.history.slice(0, Math.max(0, this.recallIndex + 1));
    }

    update(dt, world) {
      if (this.grabbed) { this._syncMesh(); return; }

      if (this.recalling) {
        if (this.recallIndex >= 0) {
          const h = this.history[this.recallIndex];
          this.pos.set(h.x, h.y, h.z);
          this.recallIndex--;
        } else {
          this.recalling = false;
        }
        this._syncMesh();
        return;
      }

      this.vel.y -= 24 * dt;
      if (this.vel.y < -30) this.vel.y = -30;
      moveWithCollision(world, this.pos, this.vel, this.halfWidth, this.height, dt);

      this.historyTimer -= dt;
      if (this.historyTimer <= 0) {
        this.historyTimer = HISTORY_STEP;
        this.history.push({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
        if (this.history.length > HISTORY_MAX) this.history.shift();
      }
      this._syncMesh();
    }
  }

  class PropsManager {
    constructor(world, scene) {
      this.world = world;
      this.scene = scene;
      this.props = [];
    }

    spawnFromBlock(x, y, z, blockId) {
      const prop = new PhysicsProp(x + 0.5, y, z + 0.5, blockId);
      this.props.push(prop);
      this.scene.add(prop.mesh);
      return prop;
    }

    remove(prop) {
      const i = this.props.indexOf(prop);
      if (i >= 0) this.props.splice(i, 1);
      this.scene.remove(prop.mesh);
    }

    update(dt) {
      for (const p of this.props) p.update(dt, this.world);
    }

    findTarget(origin, dir, range, coneCos) {
      let best = null, bestDist = range;
      for (const p of this.props) {
        if (p.grabbed) continue;
        const toP = new THREE.Vector3(p.pos.x - origin.x, p.pos.y + p.height / 2 - origin.y, p.pos.z - origin.z);
        const dist = toP.length();
        if (dist > bestDist) continue;
        toP.normalize();
        if (toP.dot(dir) < coneCos) continue;
        best = p; bestDist = dist;
      }
      return best;
    }
  }

  window.G.PhysicsProp = PhysicsProp;
  window.G.PropsManager = PropsManager;
})();
