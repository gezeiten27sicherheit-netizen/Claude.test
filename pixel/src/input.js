// Eingabe: Tastatur + Touch-Pad. Liefert gehaltene Aktionen und Flanken
// ("in diesem Frame gedrueckt"), damit Sprung & Menues sauber reagieren.
(function () {
  const PX = (window.PX = window.PX || {});

  const MAP = {
    ArrowLeft: ['left'], KeyA: ['left'],
    ArrowRight: ['right'], KeyD: ['right'],
    ArrowUp: ['up', 'jump'], KeyW: ['up', 'jump'],
    ArrowDown: ['down'], KeyS: ['down'],
    Space: ['jump', 'start'],
    KeyZ: ['jump'],
    KeyJ: ['attack'], KeyX: ['attack'], KeyK: ['attack'],
    Enter: ['start'],
    Escape: ['pause'], KeyP: ['pause'],
    KeyM: ['mute'],
    KeyR: ['restart'],
  };

  const held = Object.create(null);
  const pressedNow = Object.create(null);
  let anyPress = false;
  let touchActive = false;

  function setAction(action, value) {
    if (value) {
      if (!held[action]) pressedNow[action] = true;
      held[action] = true;
      anyPress = true;
    } else {
      held[action] = false;
    }
  }

  function onKey(e, value) {
    const actions = MAP[e.code];
    if (!actions) return;
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    if (e.repeat && value) return;
    actions.forEach((a) => setAction(a, value));
  }

  function bindTouch(el, actions) {
    if (!el) return;
    const on = (e) => {
      e.preventDefault();
      touchActive = true;
      el.classList.add('is-down');
      actions.forEach((a) => setAction(a, true));
    };
    const off = (e) => {
      e.preventDefault();
      el.classList.remove('is-down');
      actions.forEach((a) => setAction(a, false));
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function init() {
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
    window.addEventListener('blur', () => {
      Object.keys(held).forEach((k) => (held[k] = false));
    });
    bindTouch(document.getElementById('btn-left'), ['left']);
    bindTouch(document.getElementById('btn-right'), ['right']);
    bindTouch(document.getElementById('btn-jump'), ['jump', 'start']);
    bindTouch(document.getElementById('btn-attack'), ['attack', 'start']);
    bindTouch(document.getElementById('btn-pause'), ['pause']);
    // Touch-Bedienung sofort einblenden, wenn das Geraet danach aussieht.
    const coarse = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (coarse || navigator.maxTouchPoints > 0 || 'ontouchstart' in window) {
      touchActive = true;
      document.body.classList.add('touch');
    }
    window.addEventListener('touchstart', () => {
      touchActive = true;
      document.body.classList.add('touch');
    }, { once: true, passive: true });
  }

  PX.input = {
    init,
    down: (a) => !!held[a],
    pressed: (a) => !!pressedNow[a],
    anyPressed: () => anyPress,
    endFrame() {
      for (const k in pressedNow) pressedNow[k] = false;
      anyPress = false;
    },
    get touchActive() { return touchActive; },
  };
})();
