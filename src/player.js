// Player controller: TOTK-style movement (stamina, climbing, gliding) fused with
// Minecraft-style mining/placing/combat and an inventory.
(function () {
  const BLOCK = window.G.BLOCK;
  const BLOCK_DATA = window.G.BLOCK_DATA;
  const ITEMS = window.G.ITEMS;
  const moveWithCollision = window.G.moveWithCollision;

  class Player {
    constructor(world, camera) {
      this.world = world;
      this.camera = camera;
      this.pos = new THREE.Vector3(world.spawnPoint.x, world.spawnPoint.y, world.spawnPoint.z);
      this.vel = new THREE.Vector3();
      this.yaw = 0;
      this.pitch = 0;
      this.halfWidth = 0.3;
      this.height = 1.7;
      this.eyeHeight = 1.55;

      this.maxHp = 60;
      this.hp = this.maxHp;
      this.maxStamina = 100;
      this.stamina = this.maxStamina;
      this.staminaRegenTimer = 0;

      this.onGround = false;
      this.isClimbing = false;
      this.isGliding = false;
      this.fallStartY = this.pos.y;
      this.hadGlideThisFall = false;

      this.inventory = Array.from({ length: 27 }, () => ({ id: null, count: 0 }));
      this.selected = 0;
      this.miningProgress = 0;
      this.miningTarget = null;
      this.attackCooldown = 0;
      this.hurtFlash = 0;
      this.dead = false;

      this.speedBase = 4.3;
      this.sprintMul = 1.6;
      this.jumpSpeed = 7.4;
      this.gravity = 24;
      this.climbSpeed = 2.4;
      this.glideFallSpeed = -2.6;
      this.glideSpeed = 8.5;
    }

    addItem(id, count) {
      count = count || 1;
      const def = ITEMS[id];
      if (!def) return false;
      if (def.durability !== undefined) {
        for (let i = 0; i < this.inventory.length; i++) {
          if (!this.inventory[i].id) { this.inventory[i] = { id, count: 1, dur: def.durability }; return true; }
        }
        return false;
      }
      let remaining = count;
      for (let i = 0; i < this.inventory.length && remaining > 0; i++) {
        const s = this.inventory[i];
        if (s.id === id && s.count < def.max) {
          const add = Math.min(remaining, def.max - s.count);
          s.count += add; remaining -= add;
        }
      }
      for (let i = 0; i < this.inventory.length && remaining > 0; i++) {
        const s = this.inventory[i];
        if (!s.id) {
          const add = Math.min(remaining, def.max);
          this.inventory[i] = { id, count: add };
          remaining -= add;
        }
      }
      return remaining === 0;
    }

    removeFromSlot(idx, count) {
      const s = this.inventory[idx];
      if (!s || !s.id) return;
      s.count -= count;
      if (s.count <= 0) this.inventory[idx] = { id: null, count: 0 };
    }

    swapSlots(i, j) {
      const t = this.inventory[i]; this.inventory[i] = this.inventory[j]; this.inventory[j] = t;
    }

    damageSelectedItem() {
      const s = this.inventory[this.selected];
      if (!s || !s.id) return;
      const def = ITEMS[s.id];
      if (def.unbreakable || def.durability === undefined) return;
      s.dur -= 1;
      if (s.dur <= 0) {
        this.inventory[this.selected] = { id: null, count: 0 };
        return def.name;
      }
      return null;
    }

    fuseItems(idxA, idxB) {
      if (idxA === idxB) return { ok: false, msg: 'Wähle zwei verschiedene Slots.' };
      const a = this.inventory[idxA], b = this.inventory[idxB];
      if (!a || !a.id || !b || !b.id) return { ok: false, msg: 'Beide Slots brauchen Gegenstände.' };
      const res = window.G.tryFuse(a.id, b.id);
      if (!res) return { ok: false, msg: 'Diese Fusion funktioniert nicht.' };
      this.removeFromSlot(idxA, 1);
      this.removeFromSlot(idxB, 1);
      if (res.generic) {
        window.G._fuseCounter = (window.G._fuseCounter || 0) + 1;
        const newId = 'fused_' + window.G._fuseCounter;
        ITEMS[newId] = Object.assign({}, res.generated);
        this.addItem(newId, 1);
        return { ok: true, msg: 'Fusion erschaffen: ' + res.generated.name + '!' };
      }
      this.addItem(res.result, res.count);
      const nd = ITEMS[res.result];
      return { ok: true, msg: 'Fusion erschaffen: ' + nd.name + (res.count > 1 ? ' x' + res.count : '') };
    }

    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }

    takeDamage(amount) {
      if (this.dead) return;
      this.hp -= amount;
      this.hurtFlash = 0.35;
      if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    }

    respawn() {
      this.pos.set(this.world.spawnPoint.x, this.world.spawnPoint.y, this.world.spawnPoint.z);
      this.vel.set(0, 0, 0);
      this.hp = this.maxHp;
      this.stamina = this.maxStamina;
      this.dead = false;
      this.isClimbing = false;
      this.isGliding = false;
    }

    checkClimbAhead(forward) {
      const fx = this.pos.x + forward.x * 0.42, fz = this.pos.z + forward.z * 0.42;
      const bx = Math.floor(fx), bz = Math.floor(fz);
      return this.world.isSolid(bx, Math.floor(this.pos.y + 0.3), bz) ||
             this.world.isSolid(bx, Math.floor(this.pos.y + 1.2), bz);
    }

    intersectsPlayer(bx, by, bz) {
      const hw = this.halfWidth;
      return bx + 1 > this.pos.x - hw && bx < this.pos.x + hw &&
             bz + 1 > this.pos.z - hw && bz < this.pos.z + hw &&
             by + 1 > this.pos.y && by < this.pos.y + this.height;
    }

    update(dt, keys, mouseDelta) {
      if (this.dead) return;

      this.yaw -= mouseDelta.x * 0.0022;
      this.pitch -= mouseDelta.y * 0.0022;
      const limit = Math.PI / 2 - 0.05;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(this.pitch, this.yaw, 0);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      forward.y = 0; forward.normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      right.y = 0; right.normalize();

      const moveInput = new THREE.Vector3();
      if (keys['KeyW']) moveInput.add(forward);
      if (keys['KeyS']) moveInput.sub(forward);
      if (keys['KeyD']) moveInput.add(right);
      if (keys['KeyA']) moveInput.sub(right);
      if (moveInput.lengthSq() > 0) moveInput.normalize();

      const wantSprint = !!(keys['ShiftLeft'] || keys['ShiftRight']);
      const canClimb = this.checkClimbAhead(forward);
      const wantClimb = keys['Space'] && canClimb && !this.onGround && this.stamina > 0;

      if (wantClimb) { this.isClimbing = true; }
      else if (this.isClimbing && (!keys['Space'] || !canClimb)) { this.isClimbing = false; }

      if (this.isClimbing) {
        this.isGliding = false;
        this.vel.set(0, this.climbSpeed, 0);
        this.stamina -= 22 * dt; this.staminaRegenTimer = 0.6;
        if (this.stamina <= 0) { this.stamina = 0; this.isClimbing = false; }
      } else if (!this.onGround && wantSprint && this.stamina > 0) {
        this.isGliding = true;
        this.hadGlideThisFall = true;
        if (this.vel.y < this.glideFallSpeed) this.vel.y = this.glideFallSpeed;
        const strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
        const horiz = forward.clone().multiplyScalar(this.glideSpeed)
          .addScaledVector(right, strafe * this.glideSpeed * 0.5);
        this.vel.x = horiz.x; this.vel.z = horiz.z;
        this.stamina -= 9 * dt; this.staminaRegenTimer = 0.6;
        if (this.stamina <= 0) { this.stamina = 0; this.isGliding = false; }
      } else {
        this.isGliding = false;
        let speed = this.speedBase;
        if (wantSprint && this.onGround && moveInput.lengthSq() > 0 && this.stamina > 0) {
          speed *= this.sprintMul;
          this.stamina -= 14 * dt; this.staminaRegenTimer = 0.6;
          if (this.stamina < 0) this.stamina = 0;
        }
        this.vel.x = moveInput.x * speed;
        this.vel.z = moveInput.z * speed;
        this.vel.y -= this.gravity * dt;
        if (this.vel.y < -40) this.vel.y = -40;
        if (this.onGround && keys['Space'] && !canClimb) {
          this.vel.y = this.jumpSpeed;
          this.onGround = false;
        }
      }

      if (this.onGround) { this.fallStartY = this.pos.y; this.hadGlideThisFall = false; }

      const wasOnGround = this.onGround;
      this.onGround = moveWithCollision(this.world, this.pos, this.vel, this.halfWidth, this.height, dt);

      if (this.onGround && !wasOnGround) {
        const fallDist = this.fallStartY - this.pos.y;
        if (fallDist > 4 && !this.hadGlideThisFall) {
          this.takeDamage(Math.round((fallDist - 4) * 4));
        }
        this.isGliding = false; this.isClimbing = false;
      }

      // Soft world-edge barrier.
      const margin = 1.2, max = window.G.WORLD_SIZE - 1.2;
      this.pos.x = Math.max(margin, Math.min(max, this.pos.x));
      this.pos.z = Math.max(margin, Math.min(max, this.pos.z));
      if (this.pos.y < -8) this.takeDamage(1000); // fell into the void

      if (this.staminaRegenTimer > 0) this.staminaRegenTimer -= dt;
      else if (this.stamina < this.maxStamina && !this.isClimbing && !this.isGliding) {
        this.stamina = Math.min(this.maxStamina, this.stamina + 16 * dt);
      }

      this.camera.position.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);

      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.hurtFlash > 0) this.hurtFlash -= dt;
    }

    // blockHit: world.raycast() result | null. mobHit: Entity | null.
    interact(dt, blockHit, mobHit, leftDown, rightEdge, callbacks) {
      const slot = this.inventory[this.selected];
      const def = slot && slot.id ? ITEMS[slot.id] : null;

      if (leftDown) {
        if (mobHit) {
          this.miningProgress = 0; this.miningTarget = null;
          if (this.attackCooldown <= 0) {
            const dmg = (def && def.damage) ? def.damage : 4;
            mobHit.takeDamage(dmg);
            this.attackCooldown = 0.42;
            const broke = this.damageSelectedItem();
            if (broke) callbacks.toast(broke + ' ist zerbrochen!');
          }
        } else if (blockHit) {
          const bd = BLOCK_DATA[blockHit.id];
          if (bd && bd.breakTime < 900) {
            const key = blockHit.x + ',' + blockHit.y + ',' + blockHit.z;
            if (this.miningTarget !== key) { this.miningTarget = key; this.miningProgress = 0; }
            let mul = 1;
            if (def && def.isPick) mul = bd.needsPick ? (def.mineMul || 2) : 1.5;
            this.miningProgress += (dt * mul) / bd.breakTime;
            if (this.miningProgress >= 1) {
              this.world.setBlock(blockHit.x, blockHit.y, blockHit.z, BLOCK.AIR);
              if (bd.drop) this.addItem(bd.drop, 1);
              this.miningProgress = 0; this.miningTarget = null;
              if (def && def.isPick) {
                const broke = this.damageSelectedItem();
                if (broke) callbacks.toast(broke + ' ist zerbrochen!');
              }
            }
          }
        } else {
          this.miningProgress = 0; this.miningTarget = null;
        }
      } else {
        this.miningProgress = 0; this.miningTarget = null;
      }

      if (rightEdge) {
        if (def && def.type === 'block' && blockHit) {
          const px = blockHit.x + blockHit.nx, py = blockHit.y + blockHit.ny, pz = blockHit.z + blockHit.nz;
          if (!this.intersectsPlayer(px, py, pz)) {
            this.world.setBlock(px, py, pz, def.block);
            this.removeFromSlot(this.selected, 1);
          }
        } else if (def && def.type === 'food') {
          this.heal(def.heal);
          callbacks.toast('+' + def.heal + ' Herzenergie');
          this.removeFromSlot(this.selected, 1);
        }
      }
    }
  }

  window.G.Player = Player;
})();
