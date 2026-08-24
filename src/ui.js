// DOM overlay: hearts, stamina, hotbar, inventory grid, fuse menu, toasts, screens.
(function () {
  const ITEMS = window.G.ITEMS;

  class UI {
    constructor(player) {
      this.player = player;
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

      this.buildHotbar();
      document.getElementById('fuse-btn').addEventListener('click', () => this.doFuse());
      document.getElementById('inv-close').addEventListener('click', () => this.toggleInventory(false));
      document.getElementById('fuse-close').addEventListener('click', () => this.toggleFuse(false));
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

    anyModalOpen() {
      return !this.invModal.classList.contains('hidden') || !this.fuseModal.classList.contains('hidden');
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
