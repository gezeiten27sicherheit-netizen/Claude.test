// Spielfigur: Bewegung mit Beschleunigung, Coyote-Time, Sprungpuffer,
// variabler Sprunghoehe, Schwerthieb, Stampf-Angriff und Trefferphasen.
(function () {
  const PX = (window.PX = window.PX || {});
  const U = PX.util;
  const W = PX.world;
  const T = 16;

  const RUN = 104;
  const ACC_GROUND = 820;
  const ACC_AIR = 430;
  const FRICTION = 920;
  const DRAG_AIR = 190;
  const GRAVITY = 900;
  const MAX_FALL = 380;
  const JUMP = -290;
  const JUMP_CUT = 0.42;
  const COYOTE = 0.09;
  const BUFFER = 0.12;
  const ATTACK_TIME = 0.28;
  const INVULN = 1.15;

  function create(x, y) {
    return {
      x, y, w: 8, h: 14,
      vx: 0, vy: 0,
      facing: 1,
      grounded: false,
      groundT: 0,
      jumpBuf: 0,
      jumping: false,
      attackT: 0,
      attackHit: false,
      invuln: 0,
      hurtT: 0,
      hp: 3, maxHp: 3,
      dead: false,
      anim: 0,
      stepT: 0,
      ridePlatform: null,

      reset(px, py) {
        this.x = px; this.y = py;
        this.vx = this.vy = 0;
        this.dead = false; this.hurtT = 0; this.invuln = 0;
        this.attackT = 0; this.grounded = false; this.anim = 0;
      },

      get hitbox() {
        const reach = 15;
        return {
          x: this.facing > 0 ? this.x + this.w - 2 : this.x - reach + 2,
          y: this.y - 1,
          w: reach,
          h: this.h + 2,
        };
      },

      hurt(amount, fromX) {
        if (this.invuln > 0 || this.dead) return false;
        this.hp -= amount;
        this.invuln = INVULN;
        this.hurtT = 0.32;
        const dir = fromX == null ? -this.facing : U.sign(this.x + this.w / 2 - fromX) || 1;
        this.vx = dir * 130;
        this.vy = -170;
        this.grounded = false;
        if (this.hp <= 0) { this.hp = 0; this.dead = true; PX.audio.sfx('die'); }
        else PX.audio.sfx('hurt');
        PX.entities.fx.burst(this.x + this.w / 2, this.y + this.h / 2, ['#ff4d6d', '#ffa3b5', '#ffffff'], 12, 90, 30);
        return true;
      },

      kill() {
        if (this.dead) return;
        this.hp = 0;
        this.dead = true;
        PX.audio.sfx('die');
        PX.entities.fx.burst(this.x + this.w / 2, this.y + this.h / 2, ['#ff4d6d', '#efe3c4', '#47a05e'], 18, 110, 40);
      },

      update(dt, world, input, movers) {
        if (this.dead) {
          this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
          this.y += this.vy * dt;
          return;
        }

        const left = input.down('left');
        const right = input.down('right');
        const dir = (right ? 1 : 0) - (left ? 1 : 0);

        // ------------------------------------------------ waagerechte Fahrt
        const acc = this.grounded ? ACC_GROUND : ACC_AIR;
        if (dir !== 0 && this.hurtT <= 0) {
          this.vx = U.approach(this.vx, dir * RUN, acc * dt);
          this.facing = dir;
        } else {
          this.vx = U.approach(this.vx, 0, (this.grounded ? FRICTION : DRAG_AIR) * dt);
        }

        // ------------------------------------------------------- Springen --
        if (input.pressed('jump')) this.jumpBuf = BUFFER;
        this.jumpBuf = Math.max(0, this.jumpBuf - dt);
        this.groundT = this.grounded ? COYOTE : Math.max(0, this.groundT - dt);

        if (this.jumpBuf > 0 && this.groundT > 0) {
          this.vy = JUMP;
          this.jumping = true;
          this.grounded = false;
          this.groundT = 0;
          this.jumpBuf = 0;
          PX.audio.sfx('jump');
          PX.entities.fx.dust(this.x + this.w / 2, this.y + this.h, this.facing);
        }
        if (this.jumping && !input.down('jump') && this.vy < 0) {
          this.vy *= JUMP_CUT;
          this.jumping = false;
        }
        if (this.vy >= 0) this.jumping = false;

        // ------------------------------------------------------ Schwertheib
        if (input.pressed('attack') && this.attackT <= 0) {
          this.attackT = ATTACK_TIME;
          this.attackHit = false;
          PX.audio.sfx('slash');
        }
        if (this.attackT > 0) this.attackT -= dt;

        this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
        if (this.hurtT > 0) this.hurtT -= dt;
        if (this.invuln > 0) this.invuln -= dt;

        const wasGrounded = this.grounded;
        this.moveX(dt, world);
        this.moveY(dt, world, movers);

        if (this.grounded && !wasGrounded) {
          PX.audio.sfx('land');
          PX.entities.fx.dust(this.x + this.w / 2, this.y + this.h, 1);
          PX.entities.fx.dust(this.x + this.w / 2, this.y + this.h, -1);
        }

        // Mitfahren auf einer fahrenden Plattform
        if (this.ridePlatform) {
          const m = this.ridePlatform;
          const nx = this.x + m.dx;
          if (!W.rectSolid(world, nx, this.y, this.w, this.h)) this.x = nx;
          if (m.dy < 0) {
            const ny = this.y + m.dy;
            if (!W.rectSolid(world, this.x, ny, this.w, this.h)) this.y = ny;
          }
        }

        // ------------------------------------------------------- Animation -
        const speed = Math.abs(this.vx);
        this.anim += dt * (this.grounded ? 2 + speed * 0.085 : 6);
        if (this.grounded && speed > 12) {
          this.stepT -= dt * speed * 0.055;
          if (this.stepT <= 0) { this.stepT = 1; PX.audio.sfx('step'); }
        }

        // Stacheln
        if (W.rectSpike(world, this.x, this.y, this.w, this.h)) this.hurt(1, null);
        // Abgrund
        if (this.y > world.pxH + 24) this.kill();
      },

      moveX(dt, world) {
        const nx = this.x + this.vx * dt;
        if (W.rectSolid(world, nx, this.y, this.w, this.h)) {
          const step = U.sign(this.vx);
          let probe = this.x;
          while (!W.rectSolid(world, probe + step, this.y, this.w, this.h) && Math.abs(probe - nx) > 0.5) probe += step;
          this.x = probe;
          this.vx = 0;
        } else {
          this.x = nx;
        }
        this.x = U.clamp(this.x, 0, world.pxW - this.w);
      },

      moveY(dt, world, movers) {
        const ny = this.y + this.vy * dt;
        this.ridePlatform = null;

        if (this.vy > 0) {
          if (W.rectSolid(world, this.x, ny, this.w, this.h)) {
            this.y = Math.floor((ny + this.h) / T) * T - this.h;
            this.vy = 0;
            this.grounded = true;
            return;
          }
          // Einwegplattformen: nur greifen, wenn die Fuesse von oben kommen.
          const oldBottom = this.y + this.h;
          const newBottom = ny + this.h;
          const cx0 = Math.floor(this.x / T), cx1 = Math.floor((this.x + this.w - 1) / T);
          for (let cy = Math.floor(oldBottom / T); cy <= Math.floor(newBottom / T); cy++) {
            const top = cy * T;
            if (oldBottom <= top + 1 && newBottom >= top) {
              for (let cx = cx0; cx <= cx1; cx++) {
                if (W.tileAt(world, cx, cy) === W.PLATFORM) {
                  this.y = top - this.h;
                  this.vy = 0;
                  this.grounded = true;
                  return;
                }
              }
            }
          }
          // Fahrende Plattformen
          for (let i = 0; movers && i < movers.length; i++) {
            const m = movers[i];
            if (this.x + this.w <= m.x || this.x >= m.x + m.w) continue;
            if (oldBottom <= m.y + 2 && newBottom >= m.y) {
              this.y = m.y - this.h;
              this.vy = 0;
              this.grounded = true;
              this.ridePlatform = m;
              return;
            }
          }
          this.y = ny;
          this.grounded = false;
        } else {
          if (W.rectSolid(world, this.x, ny, this.w, this.h)) {
            this.y = Math.floor(ny / T) * T + T;
            this.vy = 0;
          } else {
            this.y = ny;
          }
          this.grounded = false;
        }
      },

      frameKey() {
        if (this.dead) return 'fall';
        if (!this.grounded) return this.vy < -20 ? 'jump' : 'fall';
        if (Math.abs(this.vx) > 12) {
          const f = (this.anim | 0) % 4;
          return ['run1', 'run2', 'run3', 'run4'][f];
        }
        return 'idle';
      },

      draw(ctx, cam, sp, time) {
        // Blinken waehrend der Unverwundbarkeit
        if (this.invuln > 0 && Math.floor(time * 22) % 2 === 0 && !this.dead) return;
        const key = this.frameKey();
        const set = this.hurtT > 0 ? sp.hero.hurt : sp.hero[key];
        const img = this.facing < 0 ? set.left : set.right;
        const bob = key === 'idle' ? (Math.floor(this.anim) % 2 === 0 ? 0 : 1) : 0;
        const sx = Math.round(this.x - cam.x) - 2;
        const sy = Math.round(this.y - cam.y) - 2 + bob;

        // Schwert und Hieb waehrend des Angriffs
        if (this.attackT > 0) {
          const p = 1 - this.attackT / ATTACK_TIME;
          const swing = Math.round(Math.sin(p * Math.PI) * 5);
          const sword = this.facing < 0 ? sp.sword.left : sp.sword.right;
          const swx = this.facing > 0 ? sx + 8 + swing : sx - 5 - swing;
          ctx.drawImage(sword, swx, sy + 7 + Math.round(Math.cos(p * Math.PI) * 2));
          const slash = sp.slash[p < 0.5 ? 0 : 1];
          const simg = this.facing < 0 ? slash.left : slash.right;
          ctx.globalAlpha = 0.55 + 0.45 * Math.sin(p * Math.PI);
          ctx.drawImage(simg, this.facing > 0 ? sx + 6 : sx - 14, sy + 1);
          ctx.globalAlpha = 1;
        }

        ctx.drawImage(img, sx, sy);
      },
    };
  }

  PX.player = { create, ATTACK_TIME };
})();
