// Spielsteuerung: Zustandsautomat, feste Zeitschritte, Kamera, Kampf, HUD.
(function () {
  const PX = (window.PX = window.PX || {});
  const U = PX.util;
  const W = PX.world;
  const E = PX.entities;
  const F = PX.font;

  const VIEW_W = 384;
  const VIEW_H = 216;
  const STEP = 1 / 60;
  const SAVE_KEY = 'px.moosklinge.v1';

  const INK = '#f4f1e6';
  const SHADOW = '#1b1524';
  const GOLD = '#ffd94a';

  const game = {
    state: 'title',
    levelIndex: 0,
    world: null,
    player: null,
    enemies: [],
    pickups: [],
    movers: [],
    cam: { x: 0, y: 0, w: VIEW_W, h: VIEW_H },
    shake: 0,
    time: 0,
    levelTime: 0,
    totalTime: 0,
    score: 0,
    scoreAtLevelStart: 0,
    coins: 0,
    coinsInLevel: 0,
    coinsTotalInLevel: 0,
    deaths: 0,
    stateT: 0,
    hintT: 0,
    best: null,
  };

  let canvas, ctx, sprites;

  // ------------------------------------------------------------ Speichern --
  function loadSave() {
    try {
      game.best = JSON.parse(localStorage.getItem(SAVE_KEY)) || null;
    } catch (e) { game.best = null; }
  }
  function storeRun() {
    const run = { score: game.score, time: game.totalTime, deaths: game.deaths };
    if (!game.best || run.score > game.best.score || (run.score === game.best.score && run.time < game.best.time)) {
      game.best = run;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(run)); } catch (e) { /* egal */ }
    }
  }

  // --------------------------------------------------------- Level laden ---
  function loadLevel(i) {
    const def = PX.levels[i];
    game.levelIndex = i;
    game.world = W.create(def);
    const sp = game.world.spawns;
    game.player = PX.player.create(sp.player.x + 2, sp.player.y + 2);
    game.player.hp = game.player.maxHp;
    game.enemies = sp.enemies.map((e) => (e.type === 'slime' ? E.makeSlime(e.x, e.y) : E.makeBat(e.x, e.y)));
    game.pickups = sp.pickups.map((p) => E.makePickup(p.type, p.x, p.y));
    game.movers = sp.movers.map((m) => E.makeMover(m));
    game.coinsTotalInLevel = game.pickups.filter((p) => p.type === 'coin' || p.type === 'gem').length;
    game.coinsInLevel = 0;
    game.levelTime = 0;
    game.scoreAtLevelStart = game.score;
    game.hintT = def.hint ? 5 : 0;
    E.fx.clear();
    snapCamera();
    PX.audio.playTrack(def.track);
  }

  function restartLevel() {
    game.score = game.scoreAtLevelStart;
    loadLevel(game.levelIndex);
    game.state = 'play';
    game.stateT = 0;
  }

  function newRun() {
    game.score = 0;
    game.coins = 0;
    game.deaths = 0;
    game.totalTime = 0;
    loadLevel(0);
    game.state = 'play';
    game.stateT = 0;
  }

  // -------------------------------------------------------------- Kamera ---
  function cameraTarget() {
    const p = game.player;
    return {
      x: U.clamp(p.x + p.w / 2 - VIEW_W / 2 + p.facing * 26, 0, Math.max(0, game.world.pxW - VIEW_W)),
      y: U.clamp(p.y + p.h / 2 - VIEW_H / 2 + 8, 0, Math.max(0, game.world.pxH - VIEW_H)),
    };
  }
  function snapCamera() {
    const t = cameraTarget();
    game.cam.x = t.x;
    game.cam.y = t.y;
  }
  function updateCamera(dt) {
    const t = cameraTarget();
    game.cam.x = U.lerp(game.cam.x, t.x, Math.min(1, dt * 6.5));
    game.cam.y = U.lerp(game.cam.y, t.y, Math.min(1, dt * 5));
  }

  // --------------------------------------------------------------- Kampf ---
  function killEnemy(en, fromStomp) {
    en.dead = true;
    en.flash = 0.1;
    game.score += en.type === 'bat' ? 30 : 20;
    game.shake = Math.max(game.shake, fromStomp ? 2.5 : 3.5);
    const cols = en.type === 'bat' ? ['#8a5cc4', '#c9a6ff', '#ffffff'] : ['#5ad17f', '#a7f0bd', '#ffffff'];
    E.fx.burst(en.x + en.w / 2, en.y + en.h / 2, cols, 16, 110, 30);
    E.fx.text(en.x + en.w / 2, en.y - 4, '+' + (en.type === 'bat' ? 30 : 20), '#ffffff');
    PX.audio.sfx('hit');
  }

  function resolveCombat() {
    const p = game.player;
    if (p.dead) return;
    const attackActive = p.attackT > 0 && p.attackT < PX.player.ATTACK_TIME - 0.04;
    const hb = p.hitbox;

    for (let i = 0; i < game.enemies.length; i++) {
      const en = game.enemies[i];
      if (en.dead) continue;
      if (attackActive && U.aabb(hb.x, hb.y, hb.w, hb.h, en.x, en.y, en.w, en.h)) {
        killEnemy(en, false);
        continue;
      }
      if (!U.aabb(p.x, p.y, p.w, p.h, en.x, en.y, en.w, en.h)) continue;
      const stomping = p.vy > 30 && p.y + p.h - en.y < 10;
      if (stomping) {
        killEnemy(en, true);
        p.vy = -210;
        p.jumping = true;
      } else if (p.hurt(en.damage, en.x + en.w / 2)) {
        game.shake = 5;
      }
    }

    for (let i = 0; i < game.pickups.length; i++) {
      const it = game.pickups[i];
      if (it.taken) continue;
      if (!U.aabb(p.x, p.y, p.w, p.h, it.x, it.y, it.w, it.h)) continue;
      it.taken = true;
      if (it.type === 'heart') {
        if (p.hp < p.maxHp) { p.hp++; E.fx.text(it.x + 4, it.y - 2, 'LEBEN', '#ff8fa3'); }
        else { game.score += 25; E.fx.text(it.x + 4, it.y - 2, '+25', GOLD); }
        PX.audio.sfx('heal');
      } else {
        game.score += it.info.score;
        game.coins++;
        game.coinsInLevel++;
        E.fx.text(it.x + 4, it.y - 2, '+' + it.info.score, it.type === 'gem' ? '#9fe9ff' : GOLD);
        PX.audio.sfx(it.type === 'gem' ? 'gem' : 'coin');
      }
      E.fx.burst(it.x + 4, it.y + 4, it.info.colors, 8, 70, 20);
    }

    // Ziel erreicht?
    const g = game.world.spawns.goal;
    if (U.aabb(p.x, p.y, p.w, p.h, g.x + 2, g.y - 26, 14, 44)) {
      finishLevel();
    }
  }

  function finishLevel() {
    game.totalTime += game.levelTime;
    const timeBonus = Math.max(0, Math.round(600 - game.levelTime * 6));
    const allCoins = game.coinsInLevel >= game.coinsTotalInLevel && game.coinsTotalInLevel > 0;
    game.lastBonus = { time: timeBonus, perfect: allCoins ? 250 : 0 };
    game.score += timeBonus + game.lastBonus.perfect;
    game.state = game.levelIndex >= PX.levels.length - 1 ? 'win' : 'clear';
    game.stateT = 0;
    PX.audio.stopTrack();
    PX.audio.sfx('win');
    if (game.state === 'win') storeRun();
  }

  // ------------------------------------------------------------- Updates ---
  function update(dt) {
    game.time += dt;
    PX.audio.update();
    E.fx.update(dt);
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 14);
    game.stateT += dt;

    const input = PX.input;

    if (input.pressed('mute')) {
      const m = PX.audio.toggle();
      E.fx.text(game.cam.x + VIEW_W / 2, game.cam.y + 40, m ? 'TON AUS' : 'TON AN', INK);
    }

    switch (game.state) {
      case 'title':
        if (input.pressed('start') || input.pressed('jump') || input.pressed('attack')) {
          PX.audio.unlock();
          PX.audio.sfx('start');
          newRun();
        }
        break;

      case 'play': {
        game.levelTime += dt;
        if (game.hintT > 0) game.hintT -= dt;
        if (input.pressed('pause')) { game.state = 'pause'; game.stateT = 0; PX.audio.sfx('select'); break; }
        if (input.pressed('restart')) { restartLevel(); break; }

        game.movers.forEach((m) => m.update(dt));
        game.player.update(dt, game.world, input, game.movers);
        game.enemies.forEach((en) => { if (!en.dead) en.update(dt, game.world, game.player); });
        game.pickups.forEach((it) => { if (!it.taken) it.update(dt); });
        resolveCombat();
        updateCamera(dt);

        if (game.player.dead) {
          game.state = 'dead';
          game.stateT = 0;
          game.deaths++;
          game.shake = 6;
          PX.audio.stopTrack();
        }
        break;
      }

      case 'pause':
        if (input.pressed('pause') || input.pressed('start')) { game.state = 'play'; PX.audio.sfx('select'); }
        if (input.pressed('restart')) restartLevel();
        break;

      case 'dead':
        game.player.update(dt, game.world, { down: () => false, pressed: () => false }, game.movers);
        updateCamera(dt);
        if (game.stateT > 0.9 && (input.pressed('start') || input.pressed('jump') || input.pressed('attack'))) {
          restartLevel();
        }
        break;

      case 'clear':
        if (game.stateT > 0.6 && (input.pressed('start') || input.pressed('jump') || input.pressed('attack'))) {
          loadLevel(game.levelIndex + 1);
          game.state = 'play';
          game.stateT = 0;
        }
        break;

      case 'win':
        if (game.stateT > 0.8 && (input.pressed('start') || input.pressed('jump') || input.pressed('attack'))) {
          game.state = 'title';
          game.stateT = 0;
          PX.audio.playTrack(0);
        }
        break;
      default: break;
    }

    input.endFrame();
  }

  // ------------------------------------------------------------ Zeichnen ---
  function drawLayer(img, factor, cam, extraY) {
    const lw = img.width;
    let off = -((cam.x * factor) % lw);
    if (off > 0) off -= lw;
    const y = Math.round(-cam.y * factor * 0.5 + (extraY || 0));
    for (let x = Math.round(off); x < VIEW_W; x += lw) ctx.drawImage(img, x, y);
  }

  function drawBackground(theme, camOverride) {
    const sc = PX.scenery.get(theme, VIEW_H);
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, sc.sky[0]);
    grd.addColorStop(1, sc.sky[1]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const cam = camOverride || game.cam;
    drawLayer(sc.extras, 0.08, cam, Math.sin(game.time * 0.15) * 2);
    drawLayer(sc.far, 0.25, cam, 0);
    drawLayer(sc.mid2, 0.4, cam, 0);
    drawLayer(sc.trees, 0.62, cam, 0);
    ctx.globalAlpha = 0.6;
    drawLayer(sc.near, 0.85, cam, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PX.tiles.THEMES[theme].fog;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawScene() {
    const cam = game.cam;
    const shakeX = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    const shakeY = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    const view = { x: cam.x - shakeX, y: cam.y - shakeY, w: VIEW_W, h: VIEW_H };

    drawBackground(game.world.def.theme);
    W.render(game.world, ctx, view, game.time);
    game.movers.forEach((m) => m.draw(ctx, view, sprites, game.world.tileset));
    game.pickups.forEach((it) => { if (!it.taken) it.draw(ctx, view, sprites); });
    game.enemies.forEach((en) => { if (!en.dead) en.draw(ctx, view, sprites); });
    game.player.draw(ctx, view, sprites, game.time);
    E.fx.draw(ctx, view);
  }

  function drawHearts(x, y) {
    const p = game.player;
    for (let i = 0; i < p.maxHp; i++) {
      const hx = x + i * 10;
      if (i < p.hp) {
        ctx.drawImage(sprites.heart, hx, y);
      } else {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(sprites.heart, hx, y);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(20,12,24,0.45)';
        ctx.fillRect(hx, y, 8, 8);
      }
    }
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(16,12,24,0.78)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(244,241,230,0.85)';
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  function drawHUD() {
    drawHearts(6, 6);
    ctx.drawImage(sprites.coin[0], 6, 18);
    F.drawShadow(ctx, String(game.coins), 17, 19, INK, SHADOW, 1, 1);
    F.drawShadow(ctx, 'P ' + game.score, 6, 30, GOLD, SHADOW, 1, 1);

    const lv = 'ZONE ' + (game.levelIndex + 1) + '  ' + game.world.def.name.toUpperCase();
    F.drawCenter(ctx, lv, VIEW_W / 2, 6, INK, 1, 1, SHADOW);
    const tw = F.measure(fmtTime(game.levelTime), 1, 1);
    F.drawShadow(ctx, fmtTime(game.levelTime), VIEW_W - 6 - tw, 6, INK, SHADOW, 1, 1);
    if (PX.audio.muted) {
      const mw = F.measure('STUMM', 1, 1);
      F.drawShadow(ctx, 'STUMM', VIEW_W - 6 - mw, 16, '#ff8fa3', SHADOW, 1, 1);
    }
    if (game.hintT > 0) {
      ctx.globalAlpha = Math.min(1, game.hintT);
      const hint = touch() && game.levelIndex === 0 ? 'LAUFEN LINKS . SPRUNG UND HIEB RECHTS' : game.world.def.hint;
      F.drawCenter(ctx, hint, VIEW_W / 2, VIEW_H - 22, INK, 1, 1, SHADOW);
      ctx.globalAlpha = 1;
    }
  }

  function dim(alpha) {
    ctx.fillStyle = 'rgba(12,9,18,' + alpha + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function blink() {
    return Math.floor(game.time * 2) % 2 === 0;
  }

  const touch = () => PX.input.touchActive;

  function drawTitle() {
    drawBackground('forest', { x: game.time * 18, y: 0, w: VIEW_W, h: VIEW_H });
    const gy = 152;
    const ts = PX.tiles.get('forest');
    for (let x = 0; x < VIEW_W; x += 16) {
      const scroll = Math.floor(game.time * 18) % 16;
      for (let y = gy + 16; y < VIEW_H + 16; y += 16) {
        const row = (y - gy - 16) / 16;
        const set = row === 0 ? ts.top : row === 1 ? ts.mid : ts.deep;
        ctx.drawImage(set[(U.hash2(x / 16 + (game.time * 18 / 16 | 0), row, 3) * set.length) | 0], x - scroll, y);
      }
    }

    F.drawCenter(ctx, 'MOOSKLINGE', VIEW_W / 2, 30, '#f7f3dd', 4, 1, SHADOW);
    F.drawCenter(ctx, 'EIN KLEINES PIXEL-ABENTEUER', VIEW_W / 2, 64, '#bfe9c9', 1, 1, SHADOW);

    // Held laeuft ueber die Titelwiese, ein Schleim huepft hinterher.
    const t = game.time;
    const hx = Math.round(-40 + ((t * 46) % (VIEW_W + 80)));
    const frame = ['run1', 'run2', 'run3', 'run4'][(t * 9 | 0) % 4];
    ctx.drawImage(sprites.slime[(t * 3 | 0) % 2].right, hx - 26, gy + 6);
    ctx.drawImage(sprites.hero[frame].right, hx, gy);

    if (blink()) {
      F.drawCenter(ctx, touch() ? 'ZUM START AUF SPRUNG TIPPEN' : 'LEERTASTE ODER ENTER ZUM START', VIEW_W / 2, 92, GOLD, 1, 1, SHADOW);
    }
    if (touch()) {
      F.drawCenter(ctx, 'PFEILE LINKS UNTEN ZUM LAUFEN', VIEW_W / 2, 112, INK, 1, 1, SHADOW);
      F.drawCenter(ctx, 'SPRUNG UND HIEB RECHTS UNTEN . II PAUSIERT', VIEW_W / 2, 124, INK, 1, 1, SHADOW);
    } else {
      F.drawCenter(ctx, 'PFEILE ODER WASD LAUFEN . LEERTASTE SPRINGEN', VIEW_W / 2, 112, INK, 1, 1, SHADOW);
      F.drawCenter(ctx, 'J ODER X SCHLAGEN . P PAUSE . R NEUSTART . M TON', VIEW_W / 2, 124, INK, 1, 1, SHADOW);
    }
    if (game.best) {
      F.drawCenter(ctx, 'REKORD ' + game.best.score + ' PUNKTE . ' + fmtTime(game.best.time), VIEW_W / 2, 140, '#9fe9ff', 1, 1, SHADOW);
    }
  }

  function drawPause() {
    dim(0.55);
    panel(VIEW_W / 2 - 70, 70, 140, 66);
    F.drawCenter(ctx, 'PAUSE', VIEW_W / 2, 82, INK, 2, 1, SHADOW);
    F.drawCenter(ctx, touch() ? 'ZUM WEITERSPIELEN TIPPEN' : 'P ODER ENTER WEITER', VIEW_W / 2, 104, INK, 1, 1, SHADOW);
    F.drawCenter(ctx, 'R ZONE NEU STARTEN', VIEW_W / 2, 116, INK, 1, 1, SHADOW);
  }

  function drawDead() {
    dim(0.5);
    F.drawCenter(ctx, 'GEFALLEN', VIEW_W / 2, 84, '#ff8fa3', 3, 1, SHADOW);
    if (game.stateT > 0.9 && blink()) {
      F.drawCenter(ctx, touch() ? 'TIPPEN FÜR NEUEN VERSUCH' : 'TASTE DRÜCKEN FÜR NEUEN VERSUCH', VIEW_W / 2, 118, INK, 1, 1, SHADOW);
    }
  }

  function drawClear() {
    dim(0.62);
    const b = game.lastBonus || { time: 0, perfect: 0 };
    panel(VIEW_W / 2 - 92, 52, 184, 108);
    F.drawCenter(ctx, 'ZONE GESCHAFFT', VIEW_W / 2, 62, GOLD, 2, 1, SHADOW);
    F.drawCenter(ctx, game.world.def.name.toUpperCase(), VIEW_W / 2, 80, INK, 1, 1, SHADOW);
    F.drawCenter(ctx, 'ZEIT ' + fmtTime(game.levelTime) + '   BONUS ' + b.time, VIEW_W / 2, 96, INK, 1, 1, SHADOW);
    F.drawCenter(ctx, 'BEUTE ' + game.coinsInLevel + ' VON ' + game.coinsTotalInLevel, VIEW_W / 2, 108, INK, 1, 1, SHADOW);
    if (b.perfect) F.drawCenter(ctx, 'ALLES EINGESAMMELT  +' + b.perfect, VIEW_W / 2, 120, '#9fe9ff', 1, 1, SHADOW);
    F.drawCenter(ctx, 'PUNKTE ' + game.score, VIEW_W / 2, 134, GOLD, 1, 1, SHADOW);
    if (game.stateT > 0.6 && blink()) F.drawCenter(ctx, touch() ? 'ZUM WEITERSPIELEN TIPPEN' : 'WEITER MIT LEERTASTE', VIEW_W / 2, 148, INK, 1, 1, SHADOW);
  }

  function drawWin() {
    dim(0.7);
    panel(VIEW_W / 2 - 100, 44, 200, 124);
    F.drawCenter(ctx, 'GESCHAFFT', VIEW_W / 2, 54, GOLD, 3, 1, SHADOW);
    F.drawCenter(ctx, 'DIE MOOSKLINGE RUHT WIEDER', VIEW_W / 2, 80, '#bfe9c9', 1, 1, SHADOW);
    F.drawCenter(ctx, 'PUNKTE ' + game.score, VIEW_W / 2, 98, INK, 1, 1, SHADOW);
    F.drawCenter(ctx, 'GESAMTZEIT ' + fmtTime(game.totalTime), VIEW_W / 2, 110, INK, 1, 1, SHADOW);
    F.drawCenter(ctx, 'BEUTE ' + game.coins + '   STÜRZE ' + game.deaths, VIEW_W / 2, 122, INK, 1, 1, SHADOW);
    if (game.best) F.drawCenter(ctx, 'REKORD ' + game.best.score, VIEW_W / 2, 138, '#9fe9ff', 1, 1, SHADOW);
    if (game.stateT > 0.8 && blink()) F.drawCenter(ctx, touch() ? 'TIPPEN FÜR TITELBILD' : 'TASTE FÜR TITELBILD', VIEW_W / 2, 152, INK, 1, 1, SHADOW);
  }

  function vignette() {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000000';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(0, 0, VIEW_W, 1 + i);
      ctx.fillRect(0, VIEW_H - 1 - i, VIEW_W, 1 + i);
      ctx.fillRect(0, 0, 1 + i, VIEW_H);
      ctx.fillRect(VIEW_W - 1 - i, 0, 1 + i, VIEW_H);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    if (game.state === 'title') {
      drawTitle();
    } else {
      drawScene();
      drawHUD();
      if (game.state === 'pause') drawPause();
      else if (game.state === 'dead') drawDead();
      else if (game.state === 'clear') drawClear();
      else if (game.state === 'win') drawWin();
    }
    vignette();
  }

  // ------------------------------------------------------------ Skalierung -
  function resize() {
    // Auf dem Desktop ganzzahlig skalieren (knackscharfe Pixel). Auf Handys
    // waere das viel verschenkte Flaeche, dort auf ganze Geraetepixel runden -
    // das sieht bei hoher Pixeldichte genauso sauber aus.
    const dpr = window.devicePixelRatio || 1;
    const touchLayout = document.body.classList.contains('touch');
    const padX = touchLayout ? 8 : 16;
    const padY = touchLayout ? 8 : 16;
    const raw = Math.min((window.innerWidth - padX) / VIEW_W, (window.innerHeight - padY) / VIEW_H);
    // Verkleinern wird nie gerastert, sonst bliebe auf kleinen Displays zu
    // viel Flaeche ungenutzt.
    const scale = raw >= 1 ? Math.max(1, Math.floor(raw * dpr) / dpr) : Math.max(0.3, raw);
    canvas.style.width = Math.round(VIEW_W * scale) + 'px';
    canvas.style.height = Math.round(VIEW_H * scale) + 'px';
  }

  // ------------------------------------------------------------- Schleife --
  let last = 0;
  let acc = 0;
  function frame(now) {
    const t = now / 1000;
    let dt = last ? t - last : 0;
    last = t;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    render();
    requestAnimationFrame(frame);
  }

  function start() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    sprites = PX.sprites.build();
    PX.input.init();
    loadSave();
    resize();
    setTimeout(resize, 50);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 120));
    // Titelbild braucht eine Welt fuer den Hintergrund nicht - nur Kulisse.
    game.state = 'title';
    const unlock = () => PX.audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    const loader = document.getElementById('loading');
    if (loader) loader.remove();
    requestAnimationFrame(frame);
  }

  PX.game = game;
  PX.start = start;
  PX.dev = { loadLevel, newRun, restartLevel };
})();
