// Mobs: Bokoblins (hostile, night) and Cuccos (passive, day) + spawn manager.
(function () {
  const moveWithCollision = window.G.moveWithCollision;

  function boxMesh(w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color });
    return new THREE.Mesh(geo, mat);
  }

  class Entity {
    constructor(world, x, y, z) {
      this.world = world;
      this.pos = new THREE.Vector3(x, y, z);
      this.vel = new THREE.Vector3();
      this.yaw = Math.random() * Math.PI * 2;
      this.halfWidth = 0.35;
      this.height = 1.5;
      this.hp = 20;
      this.maxHp = 20;
      this.alive = true;
      this.dead = false; // fully removable
      this.deathTimer = 0;
      this.hitFlash = 0;
      this.group = new THREE.Group();
      this.wanderTimer = 0;
      this.hurtCooldown = 0;
    }

    takeDamage(amount) {
      if (!this.alive) return;
      this.hp -= amount;
      this.hitFlash = 0.2;
      if (this.hp <= 0) this.die();
    }

    die() {
      this.alive = false;
    }

    syncMesh() {
      this.group.position.copy(this.pos);
      this.group.rotation.y = this.yaw;
      if (this.hitFlash > 0) {
        this.group.scale.setScalar(1.15);
      } else {
        this.group.scale.setScalar(1.0);
      }
    }

    baseUpdate(dt) {
      this.vel.y -= 24 * dt;
      if (this.vel.y < -30) this.vel.y = -30;
      moveWithCollision(this.world, this.pos, this.vel, this.halfWidth, this.height, dt);
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.hurtCooldown > 0) this.hurtCooldown -= dt;
    }
  }

  class Bokoblin extends Entity {
    constructor(world, x, y, z) {
      super(world, x, y, z);
      this.height = 1.6;
      this.hp = this.maxHp = 30;
      this.speed = 2.1;
      this.aggroRange = 10;
      this.attackRange = 1.3;
      this.damage = 8;
      this.attackCooldown = 0;
      this.state = 'wander';

      const body = boxMesh(0.62, 0.8, 0.4, 0x6d7a3c);
      body.position.y = 0.55;
      const head = boxMesh(0.42, 0.4, 0.4, 0x8a9a4a);
      head.position.y = 1.15;
      const tusk1 = boxMesh(0.06, 0.2, 0.06, 0xf2ead2);
      tusk1.position.set(0.15, 0.95, 0.22);
      const tusk2 = tusk1.clone(); tusk2.position.x = -0.15;
      const eye = boxMesh(0.08, 0.08, 0.05, 0xff3b30);
      eye.position.set(0, 1.2, 0.21);
      this.group.add(body, head, tusk1, tusk2, eye);
      this.body = body;
    }

    update(dt, player, isNight) {
      if (!this.alive) {
        this.deathTimer += dt;
        this.group.scale.setScalar(Math.max(0, 1 - this.deathTimer * 1.6));
        this.group.rotation.z += dt * 6;
        if (this.deathTimer > 0.6) this.dead = true;
        return;
      }
      const toPlayer = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
      const dist = toPlayer.length();

      if (dist < this.aggroRange) this.state = 'chase';
      else if (dist > this.aggroRange * 1.6) this.state = 'wander';

      if (this.state === 'chase' && dist > 0.01) {
        toPlayer.normalize();
        this.vel.x = toPlayer.x * this.speed;
        this.vel.z = toPlayer.z * this.speed;
        this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
        if (dist < this.attackRange && this.attackCooldown <= 0) {
          player.takeDamage(this.damage);
          this.attackCooldown = 1.1;
        }
      } else {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 1.5 + Math.random() * 2.5;
          this.wanderYaw = Math.random() * Math.PI * 2;
        }
        const speed = this.speed * 0.4;
        this.vel.x = Math.sin(this.wanderYaw) * speed;
        this.vel.z = Math.cos(this.wanderYaw) * speed;
        this.yaw = this.wanderYaw;
      }
      if (this.attackCooldown > 0) this.attackCooldown -= dt;

      this.baseUpdate(dt);
      this.body.position.y = 0.55 + Math.sin(performance.now() * 0.01) * 0.03;
      this.syncMesh();
    }
  }

  class Cow extends Entity {
    constructor(world, x, y, z) {
      super(world, x, y, z);
      this.height = 1.1;
      this.hp = this.maxHp = 14;
      this.speed = 1.1;

      const white = Math.random() > 0.4;
      const body = boxMesh(0.55, 0.55, 0.9, white ? 0xece6da : 0xb98452);
      body.position.y = 0.5;
      const head = boxMesh(0.35, 0.35, 0.32, 0xd8c9a3);
      head.position.set(0, 0.55, 0.58);
      const horn1 = boxMesh(0.06, 0.16, 0.06, 0xe8e0c8);
      horn1.position.set(0.12, 0.78, 0.6);
      const horn2 = horn1.clone(); horn2.position.x = -0.12;
      this.group.add(body, head, horn1, horn2);
    }

    update(dt) {
      if (!this.alive) {
        this.deathTimer += dt;
        this.group.scale.setScalar(Math.max(0, 1 - this.deathTimer * 1.6));
        if (this.deathTimer > 0.6) this.dead = true;
        return;
      }
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2 + Math.random() * 4;
        this.wanderYaw = Math.random() * Math.PI * 2;
        this.moving = Math.random() > 0.3;
      }
      const speed = this.moving ? this.speed : 0;
      this.vel.x = Math.sin(this.wanderYaw) * speed;
      this.vel.z = Math.cos(this.wanderYaw) * speed;
      this.yaw = this.wanderYaw;

      this.baseUpdate(dt);
      this.syncMesh();
    }
  }

  class EntityManager {
    constructor(world, scene, opts) {
      this.world = world;
      this.scene = scene;
      this.entities = [];
      this.onDrop = opts.onDrop;
      this.toast = opts.toast;
      this.maxHostile = 8;
      this.maxPassive = 7;
    }

    findSpawnSpot(px, pz, minR, maxR) {
      for (let i = 0; i < 12; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = minR + Math.random() * (maxR - minR);
        const x = Math.floor(px + Math.cos(ang) * r);
        const z = Math.floor(pz + Math.sin(ang) * r);
        if (x < 2 || z < 2 || x > window.G.WORLD_SIZE - 3 || z > window.G.WORLD_SIZE - 3) continue;
        const y = this.world.findSurfaceY(x, z);
        if (y <= window.G.SEA_LEVEL) continue;
        return { x: x + 0.5, y: y + 1, z: z + 0.5 };
      }
      return null;
    }

    countType(cls) { return this.entities.filter((e) => e instanceof cls && e.alive).length; }

    update(dt, player, isNight) {
      if (isNight && this.countType(Bokoblin) < this.maxHostile && Math.random() < dt * 0.4) {
        const spot = this.findSpawnSpot(player.pos.x, player.pos.z, 14, 26);
        if (spot) this.spawn(new Bokoblin(this.world, spot.x, spot.y, spot.z));
      }
      if (!isNight && this.countType(Cow) < this.maxPassive && Math.random() < dt * 0.25) {
        const spot = this.findSpawnSpot(player.pos.x, player.pos.z, 10, 22);
        if (spot) this.spawn(new Cow(this.world, spot.x, spot.y, spot.z));
      }

      for (const e of this.entities) {
        if (e.dead) continue;
        e.update(dt, player, isNight);
        if (!e.alive && !e.droppedLoot) {
          e.droppedLoot = true;
          if (e instanceof Bokoblin) {
            this.onDrop('monster_fang', 1);
            if (Math.random() < 0.4) this.onDrop('stick', 1);
            this.toast('Bokoblin besiegt! +Monsterzahn');
          } else if (e instanceof Cow) {
            this.onDrop('meat', 1 + Math.floor(Math.random() * 2));
            this.toast('+Rohes Fleisch');
          }
        }
      }
      if (this.entities.length && Math.random() < 0.1) {
        this.entities = this.entities.filter((e) => {
          if (e.dead) { this.scene.remove(e.group); return false; }
          return true;
        });
      }
    }

    spawn(entity) {
      this.entities.push(entity);
      this.scene.add(entity.group);
    }

    // Find nearest hostile mob within range+cone of an attacker for melee hit-testing.
    findTarget(origin, dir, range, coneCos) {
      let best = null, bestDist = range;
      for (const e of this.entities) {
        if (!e.alive) continue;
        const toE = new THREE.Vector3().subVectors(e.pos, origin);
        toE.y += 0.6;
        const dist = toE.length();
        if (dist > bestDist) continue;
        toE.normalize();
        if (toE.dot(dir) < coneCos) continue;
        best = e; bestDist = dist;
      }
      return best;
    }
  }

  window.G.Bokoblin = Bokoblin;
  window.G.Cow = Cow;
  window.G.EntityManager = EntityManager;
})();
