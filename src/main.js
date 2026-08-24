// Bootstrap: scene, sky/day-night, input wiring, targeting, main loop.
(function () {
  const Config = window.G.Config;
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

  const hemi = new THREE.HemisphereLight(0x8fd0ff, 0x3a2f22, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  scene.add(sun, sun.target);
  const fillLight = new THREE.AmbientLight(0x8899bb, 0.55);
  scene.add(fillLight);

  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 12), new THREE.MeshBasicMaterial({ color: 0xcfd8ff }));
  scene.add(sunMesh, moonMesh);

  const starGeo = new THREE.BufferGeometry();
  const starCount = 800;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 180;
    const theta = Math.random() * Math.PI * 2, phi = Math.acos(Math.random() * 2 - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.6 + 10;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true, opacity: 0 });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const highlightGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
  const highlight = new THREE.LineSegments(highlightGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
  highlight.visible = false;
  scene.add(highlight);

  let world = null;
  let player = null;
  let entityManager = null;
  let propsManager = null;
  let ui = null;
  let started = false;

  const input = new window.G.InputManager(Config);
  input.bind(canvas);

  canvas.addEventListener('mousedown', () => {
    if (started && document.pointerLockElement !== canvas && ui && !ui.anyModalOpen()) canvas.requestPointerLock();
  });

  window.addEventListener('keydown', (e) => {
    if (!started || input.rebinding) return;
    if (/^Digit[1-9]$/.test(e.code)) { player.selected = parseInt(e.code.slice(5), 10) - 1; }
  });

  canvas.addEventListener('wheel', (e) => {
    if (!started || document.pointerLockElement !== canvas) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    player.selected = (player.selected + dir + 9) % 9;
  });

  function toggleMenu(which) {
    const modals = { inventory: 'inventory-modal', fuse: 'fuse-modal', settings: 'settings-modal' };
    for (const k in modals) {
      if (k === which) continue;
      if (!document.getElementById(modals[k]).classList.contains('hidden')) return;
    }
    const opening = which === 'inventory' ? ui.toggleInventory() : which === 'fuse' ? ui.toggleFuse() : ui.toggleSettings();
    if (opening) document.exitPointerLock();
    else canvas.requestPointerLock();
  }

  document.getElementById('inv-close').addEventListener('click', () => canvas.requestPointerLock());
  document.getElementById('fuse-close').addEventListener('click', () => canvas.requestPointerLock());
  document.getElementById('settings-close').addEventListener('click', () => canvas.requestPointerLock());

  const NIGHT_COLOR = new THREE.Color(0x060a16);
  const SUNSET_COLOR = new THREE.Color(0x6a4a5a);
  const DAY_COLOR = new THREE.Color(0x8fd0ff);
  let dayFrac = 0.28;
  const DAY_LENGTH = 480;
  let isNight = false;

  function updateDayNight(dt) {
    dayFrac = (dayFrac + dt / DAY_LENGTH) % 1;
    const angle = (dayFrac - 0.25) * Math.PI * 2;
    const sunY = Math.sin(angle), sunX = Math.cos(angle);
    isNight = sunY < 0.05;

    const dist = 140;
    sun.position.set(sunX * dist, Math.max(sunY, -0.15) * dist + 20, 40);
    sun.target.position.set(sun.position.x - sunX * dist, 0, 40);
    sunMesh.position.copy(sun.position);
    moonMesh.position.set(-sunX * dist, -sunY * dist + 20, 40);

    const lightAmt = Math.max(0.08, sunY * 0.95 + 0.15);
    sun.intensity = lightAmt * 1.1;
    hemi.intensity = 0.4 + Math.max(0, sunY) * 0.5;

    let sky;
    if (sunY > 0.2) sky = DAY_COLOR;
    else if (sunY > -0.25) {
      const t = (sunY + 0.25) / 0.45;
      sky = SUNSET_COLOR.clone().lerp(DAY_COLOR, Math.max(0, Math.min(1, t)));
      if (t < 0.5) sky.lerp(NIGHT_COLOR, 1 - t * 2);
    } else sky = NIGHT_COLOR;

    scene.background = sky;
    scene.fog = new THREE.Fog(sky.getHex(), Math.max(24, (Config.graphics.renderDistance || 4) * 8), (Config.graphics.renderDistance || 4) * 16 + 20);
    starMat.opacity = Math.max(0, Math.min(1, (0.05 - sunY) * 3));
  }
  updateDayNight(0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  document.getElementById('start-btn').addEventListener('click', () => {
    const btn = document.getElementById('start-btn');
    btn.disabled = true;
    btn.textContent = 'Welt wird erschaffen…';
    setTimeout(() => {
      world = new window.G.World(Math.floor(Math.random() * 1e9), scene);
      world.ensureAreaLoaded(0, 0, 3);
      const sx = 8, sz = 8;
      world.spawnPoint = { x: sx + 0.5, y: world.findSurfaceY(sx, sz) + 1.2, z: sz + 0.5 };

      player = new window.G.Player(world, camera);
      propsManager = new window.G.PropsManager(world, scene);
      entityManager = new window.G.EntityManager(world, scene, {
        onDrop: (id, count) => player.addItem(id, count),
        toast: (msg) => ui.toast(msg),
      });
      ui = new window.G.UI(player, input);
      world.applyGraphicsSettings(renderer);
      Config.onChange((path) => {
        if (path === 'graphics.subtleShaders' || path === 'graphics.toneMapping') world.applyGraphicsSettings(renderer);
      });

      window.__debug = { world, player, entityManager, propsManager, ui, scene, camera, renderer, input, Config };
      ui.toast('Willkommen in Hyrule-Craft! Baue, sammle, überlebe.');
      document.getElementById('start-screen').classList.add('hidden');
      started = true;
      canvas.requestPointerLock();
    }, 30);
  });

  document.getElementById('respawn-btn').addEventListener('click', () => {
    player.respawn();
    ui.showDeath(false);
    canvas.requestPointerLock();
  });

  let last = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;

    if (started) {
      if (input.justPressed('inventory')) toggleMenu('inventory');
      if (input.justPressed('fuseMenu')) toggleMenu('fuse');
      if (input.justPressed('settings')) toggleMenu('settings');

      const locked = document.pointerLockElement === canvas;
      const menuOpen = ui.anyModalOpen();
      const activeInput = (locked && !menuOpen) ? input : window.G.NULL_INPUT;

      if (!player.dead) player.update(dt, activeInput);

      if (!menuOpen && !player.dead) {
        const origin = camera.position;
        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        const blockHit = world.raycast(origin, lookDir, 5.5);
        const mobHit = entityManager.findTarget(origin, lookDir, 3.4, Math.cos(THREE.MathUtils.degToRad(35)));

        if (blockHit && !player.heldProp) {
          highlight.visible = true;
          highlight.position.set(blockHit.x + 0.5, blockHit.y + 0.5, blockHit.z + 0.5);
        } else {
          highlight.visible = false;
        }

        const leftDown = locked && activeInput.down('attack');
        const rightEdge = locked && activeInput.justPressed('place');
        player.interact(dt, blockHit, mobHit, leftDown, rightEdge, { toast: (m) => ui.toast(m) });
        player.updateAbilities(activeInput, blockHit, propsManager, (m) => ui.toast(m));
        ui.updateCrosshair(player.miningProgress, !!mobHit);
      } else {
        highlight.visible = false;
      }

      propsManager.update(dt);
      entityManager.update(dt, player, isNight);
      world.update(player.pos.x, player.pos.z);
      world.tick(dt);
      updateDayNight(Config.features.dayNightCycle ? dt : 0);
      ui.updateClock(dayFrac, isNight);

      if (player.dead) ui.showDeath(true);
      ui.tick(dt);
      input.endFrame();
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
})();
