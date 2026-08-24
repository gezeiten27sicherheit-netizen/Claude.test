// Central settings: feature toggles, graphics options, keybinds. Persisted to localStorage.
(function () {
  const STORAGE_KEY = 'hyrulecraft.config.v1';

  const DEFAULTS = {
    features: {
      mining: true,
      placing: true,
      combat: true,
      fallDamage: true,
      dayNightCycle: true,
      mobSpawning: true,
      fuse: true,
      ultrahand: true,
      ascend: true,
      recall: true,
      paraglider: true,
      climbing: true,
      infiniteWorld: true,
    },
    graphics: {
      renderDistance: 4, // in chunks (radius)
      ambientOcclusion: true,
      subtleShaders: true,
      toneMapping: true,
    },
    controls: {
      moveForward: 'KeyW',
      moveBack: 'KeyS',
      moveLeft: 'KeyA',
      moveRight: 'KeyD',
      jump: 'Space',
      sprintGlide: 'ShiftLeft',
      attack: 'Mouse0',
      place: 'Mouse2',
      inventory: 'KeyE',
      fuseMenu: 'KeyF',
      ultrahand: 'KeyG',
      ascend: 'KeyC',
      recall: 'KeyR',
      settings: 'KeyO',
    },
  };

  const ACTION_LABELS = {
    moveForward: 'Vorwärts', moveBack: 'Rückwärts', moveLeft: 'Links', moveRight: 'Rechts',
    jump: 'Springen / Klettern', sprintGlide: 'Sprinten / Gleitschirm',
    attack: 'Abbauen / Angreifen', place: 'Platzieren / Essen',
    inventory: 'Inventar', fuseMenu: 'Fusion', ultrahand: 'Ultrahand',
    ascend: 'Ascend (durch Decken)', recall: 'Recall (Objekt zurückspulen)',
    settings: 'Einstellungen',
  };

  const FEATURE_LABELS = {
    mining: 'Blöcke abbauen', placing: 'Blöcke platzieren', combat: 'Kampf',
    fallDamage: 'Sturzschaden', dayNightCycle: 'Tag/Nacht-Zyklus', mobSpawning: 'Monster/Tiere spawnen',
    fuse: 'Fusion', ultrahand: 'Ultrahand', ascend: 'Ascend', recall: 'Recall',
    paraglider: 'Gleitschirm', climbing: 'Klettern', infiniteWorld: 'Unendliche Welt',
  };

  function deepMerge(base, patch) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    for (const k in patch) {
      if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]) && base[k]) {
        out[k] = deepMerge(base[k], patch[k]);
      } else {
        out[k] = patch[k];
      }
    }
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      return deepMerge(DEFAULTS, JSON.parse(raw));
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  class Config {
    constructor() {
      this.data = load();
      this.listeners = [];
    }
    get features() { return this.data.features; }
    get graphics() { return this.data.graphics; }
    get controls() { return this.data.controls; }

    set(path, value) {
      const parts = path.split('.');
      let obj = this.data;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      this.save();
      this.emit(path, value);
    }

    save() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    }

    reset() {
      this.data = JSON.parse(JSON.stringify(DEFAULTS));
      this.save();
      this.emit('*', null);
    }

    onChange(fn) { this.listeners.push(fn); }
    emit(path, value) { for (const fn of this.listeners) fn(path, value); }
  }

  window.G = window.G || {};
  window.G.Config = new Config();
  window.G.ACTION_LABELS = ACTION_LABELS;
  window.G.FEATURE_LABELS = FEATURE_LABELS;
  window.G.CONFIG_DEFAULTS = DEFAULTS;
})();
