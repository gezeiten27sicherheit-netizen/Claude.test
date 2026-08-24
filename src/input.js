// Action-based input abstraction on top of raw key/mouse codes, with live rebinding support.
(function () {
  class InputManager {
    constructor(config) {
      this.config = config;
      this.keys = {};
      this.justPressedCodes = new Set();
      this.rebinding = null; // { action, cb }
      this.mouseDelta = { x: 0, y: 0 };
    }

    bind(canvas) {
      window.addEventListener('keydown', (e) => {
        if (this.rebinding) { this._captureRebind(e.code); e.preventDefault(); return; }
        if (!this.keys[e.code]) this.justPressedCodes.add(e.code);
        this.keys[e.code] = true;
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
      canvas.addEventListener('mousedown', (e) => {
        const code = 'Mouse' + e.button;
        if (this.rebinding) { this._captureRebind(code); e.preventDefault(); return; }
        if (!this.keys[code]) this.justPressedCodes.add(code);
        this.keys[code] = true;
      });
      window.addEventListener('mouseup', (e) => { this.keys['Mouse' + e.button] = false; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
          this.mouseDelta.x += e.movementX || 0;
          this.mouseDelta.y += e.movementY || 0;
        }
      });
    }

    down(action) {
      const code = this.config.controls[action];
      return !!this.keys[code];
    }

    justPressed(action) {
      const code = this.config.controls[action];
      return this.justPressedCodes.has(code);
    }

    consumeMouseDelta() {
      const d = { x: this.mouseDelta.x, y: this.mouseDelta.y };
      this.mouseDelta.x = 0; this.mouseDelta.y = 0;
      return d;
    }

    endFrame() { this.justPressedCodes.clear(); }

    startRebind(action, cb) { this.rebinding = { action, cb }; }
    cancelRebind() { this.rebinding = null; }

    _captureRebind(code) {
      const { action, cb } = this.rebinding;
      this.rebinding = null;
      if (code === 'Escape') { cb && cb(null); return; }
      this.config.set('controls.' + action, code);
      cb && cb(code);
    }

    static codeLabel(code) {
      if (!code) return '—';
      if (code === 'Mouse0') return 'Maus links';
      if (code === 'Mouse2') return 'Maus rechts';
      if (code === 'Mouse1') return 'Maus mitte';
      if (code.startsWith('Key')) return code.slice(3);
      if (code.startsWith('Digit')) return code.slice(5);
      if (code === 'Space') return 'Leertaste';
      if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
      if (code === 'ControlLeft' || code === 'ControlRight') return 'Strg';
      return code;
    }
  }

  // Inert stand-in used whenever gameplay input must be suppressed (menus open, pointer unlocked).
  const NULL_INPUT = { down: () => false, justPressed: () => false, consumeMouseDelta: () => ({ x: 0, y: 0 }) };

  window.G = window.G || {};
  window.G.InputManager = InputManager;
  window.G.NULL_INPUT = NULL_INPUT;
})();
