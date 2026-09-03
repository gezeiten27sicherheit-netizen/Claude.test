/* ==========================================================================
   BlockForge — Interaktion & Scroll-Animationen
   Vanilla JS, keine Abhängigkeiten. Alles läuft in EINER rAF-Schleife,
   Scroll-Handler schreiben nur Werte, gerendert wird pro Frame.
   ========================================================================== */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ── Gemeinsamer Scroll-Zustand ──────────────────────────────────── */
  const state = {
    y: window.scrollY,
    vw: window.innerWidth,
    vh: window.innerHeight,
  };

  let needsMeasure = true;
  const onResize = () => {
    state.vw = window.innerWidth;
    state.vh = window.innerHeight;
    needsMeasure = true;
  };
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', () => { state.y = window.scrollY; }, { passive: true });

  /* ═══════════════════════════════════════════════════════════════════
     1. Titel in Wörter/Buchstaben zerlegen (Masken-Reveal)
     ══════════════════════════════════════════════════════════════════ */
  const title = $('[data-split]');
  if (title) {
    const words = title.textContent.trim().split(/\s+/);
    title.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      const inner = document.createElement('i');
      inner.textContent = word;
      inner.style.setProperty('--d', `${i * 75 + 120}ms`);
      span.appendChild(inner);
      title.appendChild(span);
      if (i < words.length - 1) title.appendChild(document.createTextNode(' '));
    });
    requestAnimationFrame(() => requestAnimationFrame(() => title.classList.add('in')));
  }

  /* ═══════════════════════════════════════════════════════════════════
     2. Reveal on scroll
     ══════════════════════════════════════════════════════════════════ */
  const revealItems = $$('[data-reveal]');
  revealItems.forEach((el) => {
    const d = el.dataset.delay;
    if (d) el.style.setProperty('--d', `${d}ms`);
  });

  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
    revealItems.forEach((el) => io.observe(el));
  } else {
    revealItems.forEach((el) => el.classList.add('in'));
  }

  /* ═══════════════════════════════════════════════════════════════════
     3. Zahlen hochzählen
     ══════════════════════════════════════════════════════════════════ */
  const counters = $$('[data-count]');
  const runCounter = (el) => {
    const target = parseInt(el.dataset.count, 10) || 0;
    if (reduced) { el.textContent = target; return; }
    const dur = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = clamp((now - start) / dur);
      // easeOutExpo
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(target * e);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        runCounter(e.target);
        co.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  } else {
    counters.forEach(runCounter);
  }

  /* ═══════════════════════════════════════════════════════════════════
     4. Navigation: Sticky-Zustand, aktiver Link, Burger
     ══════════════════════════════════════════════════════════════════ */
  const nav = $('#nav');
  const navLinks = $$('.nav-links a');
  const burger = $('#burger');
  const menu = $('.nav-links');

  if (burger && menu) {
    burger.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A') return;
      menu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  }

  const sections = navLinks
    .map((a) => {
      const id = a.getAttribute('href');
      return id && id.startsWith('#') ? { link: a, el: document.querySelector(id), top: 0 } : null;
    })
    .filter((s) => s && s.el);

  // Positionen cachen, damit die rAF-Schleife kein Layout erzwingt.
  const measureSections = () => {
    sections.forEach((s) => { s.top = s.el.getBoundingClientRect().top + window.scrollY; });
  };

  /* ═══════════════════════════════════════════════════════════════════
     5. Cursor-Spotlight (mit Lerp, damit es nachzieht)
     ══════════════════════════════════════════════════════════════════ */
  const spot = $('#spotlight');
  const pointer = { x: state.vw / 2, y: state.vh / 2, sx: state.vw / 2, sy: state.vh / 2 };
  if (spot && !reduced && window.matchMedia('(hover: hover)').matches) {
    document.body.classList.add('has-pointer');
    window.addEventListener('pointermove', (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════════════
     6. Karten-Tilt + Glow, das dem Zeiger folgt
     ══════════════════════════════════════════════════════════════════ */
  if (!reduced) {
    $$('.tilt').forEach((card) => {
      const glow = card.querySelector('.card-glow');
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.transform =
          `perspective(900px) rotateX(${(0.5 - py) * 6}deg) rotateY(${(px - 0.5) * 7}deg) translateY(-4px)`;
        if (glow) {
          glow.style.setProperty('--mx', `${px * 100}%`);
          glow.style.setProperty('--my', `${py * 100}%`);
        }
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     7. Code-Tabs + kleiner Java-Highlighter
     ══════════════════════════════════════════════════════════════════ */
  const KEYWORDS = new Set([
    'package', 'import', 'public', 'private', 'protected', 'static', 'final',
    'class', 'interface', 'abstract', 'extends', 'implements', 'void', 'return',
    'new', 'if', 'else', 'for', 'while', 'this', 'super', 'null', 'true', 'false',
    'int', 'long', 'double', 'float', 'boolean', 'char', 'var', 'throws',
  ]);

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(@\w+)|([A-Za-z_$][\w$]*)|(\b\d+(?:\.\d+)?\b)/g;

  const highlight = (src) => {
    let out = '';
    let last = 0;
    let m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(src)) !== null) {
      out += esc(src.slice(last, m.index));
      const text = esc(m[0]);
      if (m[1]) out += `<span class="tk-com">${text}</span>`;
      else if (m[2] || m[3]) out += `<span class="tk-str">${text}</span>`;
      else if (m[4]) out += `<span class="tk-ann">${text}</span>`;
      else if (m[5]) {
        if (KEYWORDS.has(m[5])) out += `<span class="tk-key">${text}</span>`;
        else if (/^[A-Z]/.test(m[5])) out += `<span class="tk-typ">${text}</span>`;
        else out += text;
      } else if (m[6]) out += `<span class="tk-num">${text}</span>`;
      else out += text;
      last = m.index + m[0].length;
    }
    out += esc(src.slice(last));
    return out;
  };

  $$('.pane code').forEach((code) => {
    code.innerHTML = highlight(code.textContent);
  });

  const tabs = $$('.tab');
  const panes = $$('.pane');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
      panes.forEach((p) => p.classList.toggle('is-active', p.dataset.pane === key));
    });
  });

  /* ═══════════════════════════════════════════════════════════════════
     8. Hero-Canvas: schwebende Iso-Blöcke mit Parallax
     ══════════════════════════════════════════════════════════════════ */
  const canvas = $('#hero-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  // Palette: [Top, Links, Rechts]
  const PALETTES = [
    ['#7ddc5b', '#4d9c38', '#3d7d2c'], // Gras
    ['#9aa3a8', '#6f777c', '#585f63'], // Stein
    ['#6ff0ea', '#33b8b3', '#26918d'], // Diamant
    ['#ff6b63', '#c4453e', '#9c342f'], // Redstone
    ['#ffc861', '#d69a3a', '#ab7a2c'], // Gold
    ['#a97a53', '#85593a', '#6a462d'], // Holz
  ];

  const blocks = [];
  const seedBlocks = () => {
    blocks.length = 0;
    const n = state.vw < 700 ? 12 : 22;
    for (let i = 0; i < n; i++) {
      blocks.push({
        x: Math.random(),                       // relativ zur Breite
        y: Math.random(),                       // relativ zur Höhe
        size: 14 + Math.random() * 34,
        depth: 0.25 + Math.random() * 0.9,      // Parallax-Stärke
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.5,
        pal: PALETTES[(Math.random() * PALETTES.length) | 0],
        spin: Math.random() < 0.5 ? -1 : 1,
      });
    }
  };

  const drawCube = (x, y, s, pal, alpha) => {
    const w = s;
    const h = s * 0.5;
    ctx.globalAlpha = alpha;

    // Deckfläche
    ctx.fillStyle = pal[0];
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x - w, y);
    ctx.closePath();
    ctx.fill();

    // Linke Seite
    ctx.fillStyle = pal[1];
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + h + s);
    ctx.lineTo(x - w, y + s);
    ctx.closePath();
    ctx.fill();

    // Rechte Seite
    ctx.fillStyle = pal[2];
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + h + s);
    ctx.lineTo(x + w, y + s);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
  };

  const cnv = { w: 0, h: 0 };
  const sizeCanvas = () => {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    cnv.w = r.width;
    cnv.h = r.height;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    // width/height zurückzusetzen löscht den Kontext-State → Transform neu setzen.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  if (ctx) {
    seedBlocks();
    sizeCanvas();
  }

  /* ═══════════════════════════════════════════════════════════════════
     9. Gepinnte Pipeline (vertikales Scrollen → horizontale Bewegung)
     ══════════════════════════════════════════════════════════════════ */
  const pin = $('#pipeline');
  const track = $('#pin-track');
  const railFill = $('#pin-rail-fill');
  const steps = $$('.step');
  const pinM = { top: 0, dist: 1, maxX: 0, offsets: [] };
  let trackX = 0;

  const measurePin = () => {
    if (!pin || !track) return;
    // Wie weit muss der Track wandern, damit die letzte Karte sichtbar ist?
    pinM.maxX = Math.max(0, track.scrollWidth - state.vw + 24);
    // Scroll-Strecke an die Breite koppeln → gleichmäßiges Tempo auf jedem Gerät.
    pin.style.height = `${Math.round(state.vh * 1.35 + pinM.maxX * 1.25)}px`;
    const rect = pin.getBoundingClientRect();
    pinM.top = rect.top + window.scrollY;
    pinM.dist = Math.max(1, pin.offsetHeight - state.vh);
    pinM.offsets = steps.map((s) => s.offsetLeft);
  };

  /* ═══════════════════════════════════════════════════════════════════
     10. Timeline-Fortschrittslinie
     ══════════════════════════════════════════════════════════════════ */
  const timeline = $('#timeline');
  const tlM = { top: 0, h: 1 };
  const measureTimeline = () => {
    if (!timeline) return;
    const r = timeline.getBoundingClientRect();
    tlM.top = r.top + window.scrollY;
    tlM.h = r.height || 1;
  };

  const progressBar = $('#progress-bar');

  /* ═══════════════════════════════════════════════════════════════════
     11. Die eine rAF-Schleife
     ══════════════════════════════════════════════════════════════════ */
  let t0 = performance.now();

  const frame = (now) => {
    const dt = Math.min((now - t0) / 1000, 0.05);
    t0 = now;

    if (needsMeasure) {
      sizeCanvas();
      measurePin();
      measureTimeline();
      measureSections();
      needsMeasure = false;
    }

    const y = state.y;

    /* Fortschrittsbalken -------------------------------------------------- */
    if (progressBar) {
      const max = document.documentElement.scrollHeight - state.vh;
      progressBar.style.width = `${clamp(max > 0 ? y / max : 0) * 100}%`;
    }

    /* Nav ----------------------------------------------------------------- */
    if (nav) nav.classList.toggle('stuck', y > 24);

    let active = null;
    for (const s of sections) {
      if (s.top - y <= state.vh * 0.35) active = s.link;
    }
    navLinks.forEach((a) => a.classList.toggle('active', a === active));

    /* Spotlight ----------------------------------------------------------- */
    if (spot && !reduced) {
      pointer.sx = lerp(pointer.sx, pointer.x, 0.12);
      pointer.sy = lerp(pointer.sy, pointer.y, 0.12);
      spot.style.transform = `translate3d(${pointer.sx}px, ${pointer.sy}px, 0)`;
    }

    /* Pinned Pipeline ------------------------------------------------------ */
    if (pin && track) {
      const p = clamp((y - pinM.top) / pinM.dist);
      const targetX = -p * pinM.maxX;
      // Lerp macht die Bewegung weich, auch bei ruckeligem Wheel-Scroll
      trackX = reduced ? targetX : lerp(trackX, targetX, 1 - Math.pow(0.001, dt));
      track.style.transform = `translate3d(${trackX.toFixed(2)}px,0,0)`;
      if (railFill) railFill.style.width = `${p * 100}%`;

      const seen = -trackX + state.vw * 0.7;
      steps.forEach((s, i) => s.classList.toggle('lit', pinM.offsets[i] <= seen));
    }

    /* Timeline ------------------------------------------------------------- */
    if (timeline) {
      const p = clamp((y + state.vh * 0.65 - tlM.top) / tlM.h);
      timeline.style.setProperty('--fill', `${p * 100}%`);
    }

    /* Hero-Canvas ---------------------------------------------------------- */
    if (ctx && y < state.vh * 1.2) {
      const w = cnv.w;
      const h = cnv.h;
      ctx.clearRect(0, 0, w, h);

      const mx = (pointer.sx / state.vw - 0.5);
      const my = (pointer.sy / state.vh - 0.5);
      const t = now / 1000;

      for (const b of blocks) {
        const bob = Math.sin(t * b.speed + b.phase) * 14 * b.depth;
        const px = b.x * w + mx * 46 * b.depth * b.spin;
        const py = b.y * h + my * 30 * b.depth + bob - y * 0.22 * b.depth;
        const alpha = 0.16 + b.depth * 0.34;
        drawCube(px, py, b.size, b.pal, alpha);
      }
    }

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);

  /* Bilder/Fonts können Höhen ändern → nachmessen */
  window.addEventListener('load', () => { needsMeasure = true; });
})();
