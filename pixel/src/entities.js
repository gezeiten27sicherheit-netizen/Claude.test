// Gegner, Beute, fahrende Plattformen und Partikel.
(function () {
  const PX = (window.PX = window.PX || {});
  const U = PX.util;
  const W = PX.world;
  const T = 16;

  const GRAVITY = 900;

  // ------------------------------------------------------------ Partikel ---
  const parts = [];
  const texts = [];

  const fx = {
    burst(x, y, colors, count, spread, up) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (0.35 + Math.random()) * (spread || 60);
        parts.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - (up || 0),
          life: 0.35 + Math.random() * 0.45,
          t: 0,
          size: Math.random() < 0.35 ? 2 : 1,
          color: colors[(Math.random() * colors.length) | 0],
          grav: 1,
        });
      }
    },
    dust(x, y, dir) {
      for (let i = 0; i < 4; i++) {
        parts.push({
          x, y,
          vx: (Math.random() * 20 + 8) * -dir,
          vy: -Math.random() * 24,
          life: 0.25 + Math.random() * 0.2,
          t: 0, size: 1, color: '#ffffff', grav: 0.3, fade: true,
        });
      }
    },
    text(x, y, str, color) {
      texts.push({ x, y, str, color, t: 0, life: 0.9 });
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t >= p.life) { parts.splice(i, 1); continue; }
        p.vy += GRAVITY * p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.t += dt;
        t.y -= 22 * dt;
        if (t.t >= t.life) texts.splice(i, 1);
      }
    },
    draw(ctx, cam) {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        ctx.globalAlpha = p.fade ? 1 - p.t / p.life : p.t / p.life > 0.7 ? 0.6 : 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < texts.length; i++) {
        const t = texts[i];
        ctx.globalAlpha = 1 - Math.pow(t.t / t.life, 3);
        PX.font.drawCenter(ctx, t.str, Math.round(t.x - cam.x), Math.round(t.y - cam.y), t.color, 1, 1, '#1b1524');
      }
      ctx.globalAlpha = 1;
    },
    clear() { parts.length = 0; texts.length = 0; },
  };

  // -------------------------------------------------------------- Gegner ---
  function makeSlime(x, y) {
    return {
      type: 'slime', x: x + 2, y: y + 6, w: 12, h: 10,
      vx: Math.random() < 0.5 ? -24 : 24, vy: 0,
      hp: 1, dead: false, flash: 0, anim: Math.random() * 2, facing: 1, damage: 1,
      update(dt, world) {
        this.anim += dt * 3.4;
        this.vy = Math.min(this.vy + GRAVITY * dt, 360);
        // waagerecht
        const nx = this.x + this.vx * dt;
        if (W.rectSolid(world, nx, this.y, this.w, this.h)) {
          this.vx = -this.vx;
        } else {
          this.x = nx;
          // Kantenpruefung: nicht ins Leere laufen
          const footX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
          const belowSolid = W.rectSolid(world, footX, this.y + this.h + 1, 1, 2);
          const belowPlat = W.tileAt(world, Math.floor(footX / T), Math.floor((this.y + this.h + 2) / T)) === W.PLATFORM;
          if (!belowSolid && !belowPlat) { this.vx = -this.vx; this.x = this.x + U.sign(this.vx) * 1; }
        }
        // senkrecht
        const ny = this.y + this.vy * dt;
        if (W.rectSolid(world, this.x, ny, this.w, this.h)) {
          if (this.vy > 0) this.y = Math.floor((ny + this.h) / T) * T - this.h;
          this.vy = 0;
        } else {
          this.y = ny;
        }
        this.facing = U.sign(this.vx) || 1;
        if (this.flash > 0) this.flash -= dt;
        if (this.y > world.pxH + 80) this.dead = true;
      },
      draw(ctx, cam, sp) {
        const f = (this.anim | 0) % 2;
        const img = this.flash > 0 ? sp.slimeWhite[f] : (this.facing < 0 ? sp.slime[f].left : sp.slime[f].right);
        ctx.drawImage(img, Math.round(this.x - cam.x), Math.round(this.y - cam.y - 0));
      },
    };
  }

  function makeBat(x, y) {
    return {
      type: 'bat', x: x + 1, y: y + 4, w: 12, h: 7,
      homeX: x + 1, homeY: y + 4, vx: 0, vy: 0,
      hp: 1, dead: false, flash: 0, anim: Math.random() * 2, facing: 1, damage: 1, awake: false,
      t: Math.random() * 6,
      update(dt, world, player) {
        this.t += dt;
        this.anim += dt * 9;
        const dx = player.x + player.w / 2 - (this.x + this.w / 2);
        const dy = player.y + player.h / 2 - (this.y + this.h / 2);
        const dist = Math.hypot(dx, dy);
        if (!this.awake && dist < 96) this.awake = true;
        if (this.awake && dist > 190) this.awake = false;
        if (this.awake) {
          const sp = 46;
          this.vx = U.approach(this.vx, (dx / (dist || 1)) * sp, 160 * dt);
          this.vy = U.approach(this.vy, (dy / (dist || 1)) * sp + Math.sin(this.t * 5) * 22, 200 * dt);
        } else {
          this.vx = U.approach(this.vx, (this.homeX - this.x) * 1.4, 150 * dt);
          this.vy = U.approach(this.vy, (this.homeY + Math.sin(this.t * 2) * 6 - this.y) * 2.4, 180 * dt);
        }
        const nx = this.x + this.vx * dt;
        if (!W.rectSolid(world, nx, this.y, this.w, this.h)) this.x = nx; else this.vx = -this.vx * 0.5;
        const ny = this.y + this.vy * dt;
        if (!W.rectSolid(world, this.x, ny, this.w, this.h)) this.y = ny; else this.vy = -this.vy * 0.5;
        if (this.vx !== 0) this.facing = U.sign(this.vx);
        if (this.flash > 0) this.flash -= dt;
      },
      draw(ctx, cam, sp) {
        const f = (this.anim | 0) % 2;
        const img = this.flash > 0 ? sp.batWhite[f] : (this.facing < 0 ? sp.bat[f].left : sp.bat[f].right);
        ctx.drawImage(img, Math.round(this.x - cam.x - 1), Math.round(this.y - cam.y - 2));
      },
    };
  }

  // --------------------------------------------------------------- Beute ---
  const PICKUP_INFO = {
    coin: { w: 8, h: 8, score: 10, colors: ['#ffd94a', '#fff3ae', '#c99a1e'] },
    gem: { w: 8, h: 8, score: 50, colors: ['#5fd8ff', '#d5f8ff', '#2a86c9'] },
    heart: { w: 8, h: 8, score: 0, colors: ['#ff4d6d', '#ffa3b5'] },
  };

  function makePickup(type, x, y) {
    const info = PICKUP_INFO[type];
    return {
      type, x, y, w: info.w, h: info.h, taken: false, t: Math.random() * 6, info,
      update(dt) { this.t += dt; },
      draw(ctx, cam, sp) {
        const bob = Math.round(Math.sin(this.t * 3) * 1.5);
        const sx = Math.round(this.x - cam.x);
        const sy = Math.round(this.y - cam.y) + bob;
        if (this.type === 'coin') {
          ctx.drawImage(sp.coin[(this.t * 7) % 4 | 0], sx, sy);
        } else if (this.type === 'gem') {
          ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.t * 4);
          ctx.fillStyle = '#5fd8ff';
          ctx.fillRect(sx - 1, sy - 1, 10, 10);
          ctx.globalAlpha = 1;
          ctx.drawImage(sp.gem, sx, sy);
        } else {
          ctx.drawImage(sp.heart, sx, sy);
        }
      },
    };
  }

  // -------------------------------------------- Fahrende Plattform (Lift) ---
  function makeMover(spec) {
    return {
      type: 'mover', x: spec.x, y: spec.y, w: 32, h: 6,
      axis: spec.axis, min: spec.min, max: spec.max, dir: 1, speed: 30,
      dx: 0, dy: 0,
      update(dt) {
        const before = this.axis === 'x' ? this.x : this.y;
        let v = (this.axis === 'x' ? this.x : this.y) + this.dir * this.speed * dt;
        if (v <= this.min) { v = this.min; this.dir = 1; }
        if (v >= this.max) { v = this.max; this.dir = -1; }
        if (this.axis === 'x') { this.x = v; this.dx = v - before; this.dy = 0; }
        else { this.y = v; this.dy = v - before; this.dx = 0; }
      },
      draw(ctx, cam, sp, ts) {
        const sx = Math.round(this.x - cam.x);
        const sy = Math.round(this.y - cam.y);
        ctx.drawImage(ts.platform, 0, 0, 16, 8, sx, sy, 16, 8);
        ctx.drawImage(ts.platform, 0, 0, 16, 8, sx + 16, sy, 16, 8);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(sx, sy + 6, 32, 1);
      },
    };
  }

  PX.entities = { makeSlime, makeBat, makePickup, makeMover, fx, PICKUP_INFO, GRAVITY };
})();
