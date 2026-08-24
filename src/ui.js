// DOM overlay: hearts, stamina, hotbar, inventory grid, fuse menu, toasts, screens.
(function () {
  const ITEMS = window.G.ITEMS;

  class UI {
    constructor(player, input) {
      this.player = player;
      this.input = input;
      this.heldSlot = null;
      this.fuseSlots = [null, null];
      this.toastTimer = 0;

      this.hearts = document.getElementById('hearts');
      this.staminaWheel = document.getElementById('stamina-wheel');
      this.staminaWrap = document.getElementById('stamina-wrap');
      this.hotbar = document.getElementById('hotbar');
      this.toastEl = document.getElementById('toast');
      this.crosshair = document.getElementById('crosshair');
      this.invModal = document.getElementById('inventory-modal');
      this.invGrid = document.getElementById('inventory-grid');
      this.fuseModal = document.getElementById('fuse-modal');
      this.fuseGrid = document.getElementById('fuse-grid');
      this.fuseSlotA = document.getElementById('fuse-slot-a');
      this.fuseSlotB = document.getElementById('fuse-slot-b');
      this.fuseResult = document.getElementById('fuse-result');
      this.deathScreen = document.getElementById('death-screen');
      this.clock = document.getElementById('clock');
      this.settingsModal = document.getElementById('settings-modal');
      this.settingsBody = document.getElementById('settings-body');
      this.abilityHints = document.getElementById('ability-hints');

      this.buildHotbar();
      document.getElementById('fuse-btn').addEventListener('click', () => this.doFuse());
      document.getElementById('inv-close').addEventListener('click', () => this.toggleInventory(false));
      document.getElementById('fuse-close').addEventListener('click', () => this.toggleFuse(false));
      document.getElementById('settings-close').addEventListener('click', () => this.toggleSettings(false));
      document.getElementById('settings-btn').addEventListener('click', () => this.toggleSettings());
      window.G.Config.onChange(() => { this.updateAbilityHints(); if (!this.settingsModal.classList.contains('hidden')) this.renderSettings(); });
      this.updateAbilityHints();
    }

    buildHotbar() {
      this.hotbar.innerHTML = '';
      this.hotbarSlots = [];
      for (let i = 0; i < 9; i++) {
        const el = document.createElement('div');
        el.className = 'slot hotbar-slot';
        el.dataset.idx = i;
        el.innerHTML = '<span class="icon"></span><span class="count"></span><div class="dur"></div><span class="key">' + (i + 1) + '</span>';
        this.hotbar.appendChild(el);
        this.hotbarSlots.push(el);
      }
    }

    toast(msg) {
      this.toastEl.textContent = msg;
      this.toastEl.style.opacity = '1';
      this.toastTimer = 2.4;
    }

    tickToast(dt) {
      if (this.toastTimer > 0) {
        this.toastTimer -= dt;
        if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
      }
    }

    updateHearts() {
      const hp = this.player.hp, max = this.player.maxHp;
      const total = Math.ceil(max / 10);
      let html = '';
      for (let i = 0; i < total; i++) {
        const remain = hp - i * 10;
        let cls = 'heart empty';
        if (remain >= 10) cls = 'heart full';
        else if (remain > 0) cls = 'heart half';
        html += '<div class="' + cls + '"></div>';
      }
      this.hearts.innerHTML = html;
      this.hearts.classList.toggle('flash', this.player.hurtFlash > 0);
    }

    updateStamina() {
      const pct = this.player.stamina / this.player.maxStamina;
      this.staminaWheel.style.background =
        `conic-gradient(#7fe8c0 ${pct * 360}deg, rgba(255,255,255,0.15) ${pct * 360}deg)`;
      this.staminaWrap.style.opacity = pct < 0.999 ? '1' : '0.35';
    }

    itemIcon(id) {
      const def = ITEMS[id];
      return def ? def.icon : '';
    }

    updateHotbar() {
      for (let i = 0; i < 9; i++) {
        const slot = this.player.inventory[i];
        const el = this.hotbarSlots[i];
        el.classList.toggle('selected', i === this.player.selected);
        const icon = el.querySelector('.icon');
        const count = el.querySelector('.count');
        const dur = el.querySelector('.dur');
        if (slot && slot.id) {
          const def = ITEMS[slot.id];
          icon.textContent = def.icon;
          count.textContent = slot.count > 1 ? slot.count : '';
          if (slot.dur !== undefined && def.durability && def.durability !== Infinity) {
            dur.style.display = 'block';
            dur.style.width = Math.max(0, (slot.dur / def.durability) * 100) + '%';
          } else {
            dur.style.display = 'none';
          }
        } else {
          icon.textContent = '';
          count.textContent = '';
          dur.style.display = 'none';
        }
      }
    }

    updateCrosshair(mining, isMob) {
      this.crosshair.classList.toggle('targeting-mob', !!isMob);
      if (mining > 0) {
        this.crosshair.style.setProperty('--mine', Math.min(1, mining));
        this.crosshair.classList.add('mining');
      } else {
        this.crosshair.classList.remove('mining');
      }
    }

    updateClock(dayFrac, isNight) {
      const totalMin = Math.floor(dayFrac * 24 * 60);
      const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
      const m = String(totalMin % 60).padStart(2, '0');
      this.clock.textContent = (isNight ? '🌙 ' : '☀️ ') + h + ':' + m;
    }

    renderSlotEl(idx, mode) {
      const s = this.player.inventory[idx];
      const el = document.createElement('div');
      el.className = 'slot inv-slot';
      const isHeld = mode === 'inventory' && this.heldSlot === idx;
      const isFused = mode === 'fuse' && (this.fuseSlots[0] === idx || this.fuseSlots[1] === idx);
      if (isHeld || isFused) el.classList.add('selected');
      if (s && s.id) {
        const def = ITEMS[s.id];
        el.innerHTML = '<span class="icon">' + def.icon + '</span>' +
          (s.count > 1 ? '<span class="count">' + s.count + '</span>' : '') +
          '<div class="tip">' + def.name + '</div>';
      }
      el.addEventListener('click', () => {
        if (mode === 'inventory') this.onInvClick(idx);
        else this.onFuseClick(idx);
      });
      return el;
    }

    renderInventoryGrid() {
      this.invGrid.innerHTML = '';
      for (let i = 0; i < this.player.inventory.length; i++) {
        this.invGrid.appendChild(this.renderSlotEl(i, 'inventory'));
      }
    }

    onInvClick(idx) {
      if (this.heldSlot === null) {
        if (this.player.inventory[idx].id) this.heldSlot = idx;
      } else if (this.heldSlot === idx) {
        this.heldSlot = null;
      } else {
        this.player.swapSlots(this.heldSlot, idx);
        this.heldSlot = null;
      }
      this.renderInventoryGrid();
    }

    renderFuseGrid() {
      this.fuseGrid.innerHTML = '';
      for (let i = 0; i < this.player.inventory.length; i++) {
        this.fuseGrid.appendChild(this.renderSlotEl(i, 'fuse'));
      }
      const showSlot = (el, idx) => {
        if (idx === null || !this.player.inventory[idx].id) { el.innerHTML = '?'; return; }
        const def = ITEMS[this.player.inventory[idx].id];
        el.innerHTML = def.icon;
      };
      showSlot(this.fuseSlotA, this.fuseSlots[0]);
      showSlot(this.fuseSlotB, this.fuseSlots[1]);
    }

    onFuseClick(idx) {
      if (!this.player.inventory[idx].id) return;
      if (this.fuseSlots[0] === idx) { this.fuseSlots[0] = null; }
      else if (this.fuseSlots[1] === idx) { this.fuseSlots[1] = null; }
      else if (this.fuseSlots[0] === null) { this.fuseSlots[0] = idx; }
      else if (this.fuseSlots[1] === null) { this.fuseSlots[1] = idx; }
      this.renderFuseGrid();
    }

    doFuse() {
      const [a, b] = this.fuseSlots;
      if (a === null || b === null) {
        this.fuseResult.textContent = 'Wähle zwei Gegenstände aus deinem Inventar.';
        return;
      }
      const res = this.player.fuseItems(a, b);
      this.fuseResult.textContent = res.msg;
      this.fuseSlots = [null, null];
      this.renderFuseGrid();
    }

    toggleInventory(force) {
      const open = force !== undefined ? force : this.invModal.classList.contains('hidden');
      this.invModal.classList.toggle('hidden', !open);
      if (open) { this.heldSlot = null; this.renderInventoryGrid(); }
      return open;
    }

    toggleFuse(force) {
      const open = force !== undefined ? force : this.fuseModal.classList.contains('hidden');
      this.fuseModal.classList.toggle('hidden', !open);
      if (open) { this.fuseSlots = [null, null]; this.fuseResult.textContent = ''; this.renderFuseGrid(); }
      return open;
    }

    toggleSettings(force) {
      const open = force !== undefined ? force : this.settingsModal.classList.contains('hidden');
      this.settingsModal.classList.toggle('hidden', !open);
      if (open) this.renderSettings();
      return open;
    }

    anyModalOpen() {
      return !this.invModal.classList.contains('hidden') ||
             !this.fuseModal.classList.contains('hidden') ||
             !this.settingsModal.classList.contains('hidden');
    }

    renderSettings() {
      const Config = window.G.Config;
      const FEATURE_LABELS = window.G.FEATURE_LABELS;
      const ACTION_LABELS = window.G.ACTION_LABELS;
      const body = this.settingsBody;
      body.innerHTML = '';

      const addHeading = (text) => {
        const h = document.createElement('h3');
        h.textContent = text;
        body.appendChild(h);
      };
      const addRow = (el) => { const row = document.createElement('div'); row.className = 'settings-row'; row.appendChild(el); body.appendChild(row); return row; };

      addHeading('⚙️ Fähigkeiten');
      for (const key in FEATURE_LABELS) {
        const row = document.createElement('label');
        row.className = 'settings-row toggle-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!Config.features[key];
        cb.addEventListener('change', () => {
          Config.set('features.' + key, cb.checked);
          if (key === 'ambientOcclusion') { /* handled in graphics */ }
          if (key === 'infiniteWorld' && window.__debug) window.__debug.world.enforceBounds();
        });
        const span = document.createElement('span');
        span.textContent = FEATURE_LABELS[key];
        row.appendChild(cb); row.appendChild(span);
        body.appendChild(row);
      }

      addHeading('🖼️ Grafik');
      const rdRow = document.createElement('div'); rdRow.className = 'settings-row';
      const rdLabel = document.createElement('span'); rdLabel.textContent = 'Sichtweite (Chunks): ' + Config.graphics.renderDistance;
      const rdSlider = document.createElement('input');
      rdSlider.type = 'range'; rdSlider.min = 2; rdSlider.max = 8; rdSlider.value = Config.graphics.renderDistance;
      rdSlider.addEventListener('input', () => {
        Config.set('graphics.renderDistance', parseInt(rdSlider.value, 10));
        rdLabel.textContent = 'Sichtweite (Chunks): ' + rdSlider.value;
      });
      rdRow.appendChild(rdLabel); rdRow.appendChild(rdSlider);
      body.appendChild(rdRow);

      const aoRow = document.createElement('label'); aoRow.className = 'settings-row toggle-row';
      const aoCb = document.createElement('input'); aoCb.type = 'checkbox'; aoCb.checked = Config.graphics.ambientOcclusion;
      aoCb.addEventListener('change', () => {
        Config.set('graphics.ambientOcclusion', aoCb.checked);
        if (window.__debug) window.__debug.world.markAllDirty();
      });
      aoRow.appendChild(aoCb); aoRow.appendChild(Object.assign(document.createElement('span'), { textContent: 'Ambient Occlusion (Ecken-Schattierung)' }));
      body.appendChild(aoRow);

      const shRow = document.createElement('label'); shRow.className = 'settings-row toggle-row';
      const shCb = document.createElement('input'); shCb.type = 'checkbox'; shCb.checked = Config.graphics.subtleShaders;
      shCb.addEventListener('change', () => {
        Config.set('graphics.subtleShaders', shCb.checked);
        if (window.__debug) window.__debug.world.applyGraphicsSettings(window.__debug.renderer);
      });
      shRow.appendChild(shCb); shRow.appendChild(Object.assign(document.createElement('span'), { textContent: 'Dezente Shader (Wasser-Wellen, Glüh-Puls, Tonemapping)' }));
      body.appendChild(shRow);

      addHeading('⌨️ Tasten');
      for (const action in ACTION_LABELS) {
        const row = document.createElement('div'); row.className = 'settings-row keybind-row';
        const label = document.createElement('span'); label.textContent = ACTION_LABELS[action];
        const btn = document.createElement('button'); btn.className = 'action-btn keybind-btn';
        btn.textContent = window.G.InputManager.codeLabel(Config.controls[action]);
        btn.addEventListener('click', () => {
          btn.textContent = 'Drücke eine Taste…';
          this.input.startRebind(action, (code) => {
            btn.textContent = window.G.InputManager.codeLabel(code || Config.controls[action]);
          });
        });
        row.appendChild(label); row.appendChild(btn);
        body.appendChild(row);
      }

      const resetBtn = document.createElement('button');
      resetBtn.className = 'action-btn'; resetBtn.textContent = 'Alles zurücksetzen';
      resetBtn.style.marginTop = '10px';
      resetBtn.addEventListener('click', () => { Config.reset(); this.renderSettings(); });
      body.appendChild(resetBtn);
    }

    updateAbilityHints() {
      const Config = window.G.Config;
      const codeLabel = window.G.InputManager.codeLabel;
      const list = [
        ['ultrahand', 'Ultrahand'], ['ascend', 'Ascend'], ['recall', 'Recall'],
        ['fuseMenu', 'Fusion'], ['paraglider', 'Gleitschirm (Shift, in der Luft)'],
      ];
      let html = '';
      for (const [feat, label] of list) {
        if (feat === 'paraglider') {
          if (Config.features.paraglider) html += `<div>${codeLabel(Config.controls.sprintGlide)} — ${label}</div>`;
          continue;
        }
        if (!Config.features[feat]) continue;
        const action = feat === 'fuseMenu' ? 'fuseMenu' : feat;
        html += `<div>${codeLabel(Config.controls[action])} — ${label}</div>`;
      }
      this.abilityHints.innerHTML = html;
    }

    showDeath(show) {
      this.deathScreen.classList.toggle('hidden', !show);
    }

    tick(dt) {
      this.updateHearts();
      this.updateStamina();
      this.updateHotbar();
      this.tickToast(dt);
    }
  }

  window.G.UI = UI;
})();
