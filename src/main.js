// Bootstrap: scene, sky/day-night, input wiring, targeting, main loop.
(function () {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

  const hemi = new THREE.HemisphereLight(0x8fd0ff, 0x3a2f22, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(60, 90, 40);
  sun.target.position.set(40, 0, 40);
  scene.add(sun, sun.target);
  const fillLight = new THREE.AmbientLight(0x223355, 0.25);
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

  const world = new window.G.World(1337, scene);
  let player = null;
  let entityManager = null;
  let ui = null;

  const keys = {};
  const mouseDelta = { x: 0, y: 0 };
  let leftDown = false;
  let rightEdge = false;
  let started = false;

  const NIGHT_COLOR = new THREE.Color(0x060a16);
  const SUNSET_COLOR = new THREE.Color(0x6a4a5a);
  const DAY_COLOR = new THREE.Color(0x8fd0ff);
  let dayFrac = 0.28;
  const DAY_LENGTH = 480; // seconds for a full day/night cycle
  let isNight = false;

  function updateDayNight(dt) {
    dayFrac = (dayFrac + dt / DAY_LENGTH) % 1;
    const angle = (dayFrac - 0.25) * Math.PI * 2;
    const sunY = Math.sin(angle), sunX = Math.cos(angle);
    isNight = sunY < 0.05;

    const dist = 140;
    sun.position.set(sunX * dist, Math.max(sunY, -0.15) * dist + 20, 40);
    sunMesh.position.copy(sun.position);
    moonMesh.position.set(-sunX * dist, -sunY * dist + 20, 40);

    const lightAmt = Math.max(0.08, sunY * 0.95 + 0.15);
    sun.intensity = lightAmt * 1.1;
    hemi.intensity = 0.25 + Math.max(0, sunY) * 0.55;

    let sky;
    if (sunY > 0.2) sky = DAY_COLOR;
    else if (sunY > -0.25) {
      const t = (sunY + 0.25) / 0.45;
      sky = SUNSET_COLOR.clone().lerp(DAY_COLOR, Math.max(0, Math.min(1, t)));
      if (t < 0.5) sky.lerp(NIGHT_COLOR, 1 - t * 2);
    } else sky = NIGHT_COLOR;

    scene.background = sky;
    scene.fog = new THREE.Fog(sky.getHex(), 28, 78);
    starMat.opacity = Math.max(0, Math.min(1, (0.05 - sunY) * 3));
  }
  updateDayNight(0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (!started) return;
    if (e.code === 'KeyE') { e.preventDefault(); toggleMenu('inventory'); }
    else if (e.code === 'KeyF') { e.preventDefault(); toggleMenu('fuse'); }
    else if (/^Digit[1-9]$/.test(e.code)) {
      player.selected = parseInt(e.code.slice(5), 10) - 1;
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      mouseDelta.x += e.movementX || 0;
      mouseDelta.y += e.movementY || 0;
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== canvas) {
      if (started && !ui.anyModalOpen()) canvas.requestPointerLock();
      return;
    }
    if (e.button === 0) leftDown = true;
    if (e.button === 2) rightEdge = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) leftDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    if (!started || document.pointerLockElement !== canvas) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    player.selected = (player.selected + dir + 9) % 9;
  });

  function toggleMenu(which) {
    const other = which === 'inventory' ? 'fuse' : 'inventory';
    const otherOpen = other === 'inventory' ? !document.getElementById('inventory-modal').classList.contains('hidden')
                                             : !document.getElementById('fuse-modal').classList.contains('hidden');
    if (otherOpen) return;
    const opening = which === 'inventory' ? ui.toggleInventory() : ui.toggleFuse();
    if (opening) document.exitPointerLock();
    else canvas.requestPointerLock();
  }

  document.getElementById('inv-close').addEventListener('click', () => { canvas.requestPointerLock(); });
  document.getElementById('fuse-close').addEventListener('click', () => { canvas.requestPointerLock(); });

  document.getElementById('start-btn').addEventListener('click', () => {
    const btn = document.getElementById('start-btn');
    btn.disabled = true;
    btn.textContent = 'Welt wird erschaffen…';
    setTimeout(() => {
      world.generate();
      world.buildAllChunks();
      player = new window.G.Player(world, camera);
      entityManager = new window.G.EntityManager(world, scene, {
        onDrop: (id, count) => player.addItem(id, count),
        toast: (msg) => ui.toast(msg),
      });
      ui = new window.G.UI(player);
      window.__debug = { world, player, entityManager, ui, scene, camera };
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
      const locked = document.pointerLockElement === canvas;
      const menuOpen = ui.anyModalOpen();
      const activeKeys = (locked && !menuOpen) ? keys : {};
      const delta = (locked && !menuOpen) ? mouseDelta : { x: 0, y: 0 };

      if (!player.dead) player.update(dt, activeKeys, delta);
      mouseDelta.x = 0; mouseDelta.y = 0;

      if (!menuOpen && !player.dead) {
        const origin = camera.position;
        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        const blockHit = world.raycast(origin, lookDir, 5.5);
        const mobHit = entityManager.findTarget(origin, lookDir, 3.4, Math.cos(THREE.MathUtils.degToRad(35)));

        if (blockHit) {
          highlight.visible = true;
          highlight.position.set(blockHit.x + 0.5, blockHit.y + 0.5, blockHit.z + 0.5);
        } else {
          highlight.visible = false;
        }

        player.interact(dt, blockHit, mobHit, locked && leftDown, locked && rightEdge, { toast: (m) => ui.toast(m) });
        ui.updateCrosshair(player.miningProgress, !!mobHit);
      } else {
        highlight.visible = false;
      }
      rightEdge = false;

      entityManager.update(dt, player, isNight);
      world.flushDirtyChunks(3);
      updateDayNight(dt);
      ui.updateClock(dayFrac, isNight);

      if (player.dead) ui.showDeath(true);
      ui.tick(dt);
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
})();
