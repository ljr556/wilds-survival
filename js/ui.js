import * as THREE from '../vendor/three.module.js';
import { ITEMS, RECIPES, STRUCTURES, PLACEABLES } from './data.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.input = { forward: 0, right: 0, jump: false, sprint: false, use: false, lookDX: 0, lookDY: 0 };
    this.selectedRecipe = null;
    this.touchMode = false;
  }

  init() {
    this.refs = {
      barHealth: $('barHealth'), barHunger: $('barHunger'), barThirst: $('barThirst'), barStamina: $('barStamina'),
      numHealth: $('numHealth'), numHunger: $('numHunger'), numThirst: $('numThirst'), numStamina: $('numStamina'), numTemp: $('numTemp'),
      hotbar: $('hotbar'), handInfo: $('handInfo'), interact: $('interactHint'), toasts: $('toasts'),
      invGrid: $('invGrid'), craftList: $('craftList'), craftStation: $('craftStation'), buildList: $('buildList'),
      clockTime: $('clockTime'), clockDay: $('clockDay'), clockWeather: $('clockWeather'), posText: $('posText'),
      hintText: $('hintText'),
    };
    this.touchMode = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (this.touchMode) document.body.classList.add('touch-ui');

    document.querySelectorAll('[data-close]').forEach((b) => {
      b.addEventListener('click', () => this.hidePanel(b.dataset.close));
    });
    $('btnStart').addEventListener('click', () => this.game.start(false));
    $('btnLoad').addEventListener('click', () => this.game.start(true));
    $('btnRespawn').addEventListener('click', () => this.game.respawn());

    this.attachDesktop();
    if (this.touchMode) this.attachTouch();
    else $('touchLayer').style.display = 'none';
  }

  // ---------- 桌面输入 ----------
  attachDesktop() {
    const canvas = this.game.canvas;
    const input = this.input;
    const keys = {};
    const sync = () => {
      input.forward = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
      input.right = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
      input.sprint = !!keys.shift;
    };
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if ('wasd'.includes(k) || k === 'shift' || k === ' ') e.preventDefault();
      if (k === 'w') keys.w = 1;
      if (k === 'a') keys.a = 1;
      if (k === 's') keys.s = 1;
      if (k === 'd') keys.d = 1;
      if (k === 'shift') keys.shift = 1;
      if (k === ' ') input.jump = true;
      if (k === 'e') this.game.togglePanel('panelInventory');
      if (k === 'q') this.game.togglePanel('panelCraft');
      if (k === 'b') this.game.togglePanel('panelBuild');
      if (k === 'escape') this.game.closeAllPanels();
      if (k >= '1' && k <= '6') { this.game.player.hotbarIndex = Number(k) - 1; this.refreshHotbar(); }
      sync();
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w') keys.w = 0;
      if (k === 'a') keys.a = 0;
      if (k === 's') keys.s = 0;
      if (k === 'd') keys.d = 0;
      if (k === 'shift') keys.shift = 0;
      if (k === ' ') input.jump = false;
      sync();
    });

    canvas.addEventListener('click', () => {
      if (!this.game.running || this.game.paused) return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      this.game.paused = !locked && this.game.running;
      this.refs.hintText.textContent = locked ? '' : '点击画面继续';
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.input.lookDX += e.movementX * 0.0022;
      this.input.lookDY += e.movementY * 0.0022;
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.input.use = true;
      if (e.button === 2) this.game.throwHeld();
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.input.use = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------- 触屏输入 ----------
  attachTouch() {
    const canvas = this.game.canvas;
    const stick = $('moveStick');
    const knob = $('moveKnob');
    let stickId = null, lookId = null, lastLX = 0, lastLY = 0;
    const radius = 44;

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      stickId = t.identifier;
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (lookId === null && t.clientX > window.innerWidth * 0.32) {
          lookId = t.identifier;
          lastLX = t.clientX;
          lastLY = t.clientY;
        }
      }
    }, { passive: true });

    const handleMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          const rect = stick.getBoundingClientRect();
          let dx = t.clientX - (rect.left + rect.width / 2);
          let dy = t.clientY - (rect.top + rect.height / 2);
          const len = Math.hypot(dx, dy);
          if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
          setKnob(dx, dy);
          this.input.right = dx / radius;
          this.input.forward = -dy / radius;
        } else if (t.identifier === lookId) {
          this.input.lookDX += (t.clientX - lastLX) * 0.0042;
          this.input.lookDY += (t.clientY - lastLY) * 0.0042;
          lastLX = t.clientX;
          lastLY = t.clientY;
        }
      }
    };
    const handleEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null;
          this.input.forward = 0;
          this.input.right = 0;
          setKnob(0, 0);
        }
        if (t.identifier === lookId) lookId = null;
      }
    };
    window.addEventListener('touchmove', (e) => { handleMove(e); if (e.cancelable) e.preventDefault(); }, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);

    const hold = (id, on, off) => {
      const el = $(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); off && off(); }, { passive: false });
    };
    hold('btnJump', () => { this.input.jump = true; }, () => { this.input.jump = false; });
    hold('btnSprint', () => { this.input.sprint = true; }, () => { this.input.sprint = false; });
    hold('btnUse', () => { this.input.use = true; }, () => { this.input.use = false; });
    $('btnInv').addEventListener('touchstart', (e) => { e.preventDefault(); this.game.togglePanel('panelInventory'); }, { passive: false });
    $('btnCraft').addEventListener('touchstart', (e) => { e.preventDefault(); this.game.togglePanel('panelCraft'); }, { passive: false });
    $('btnBuild').addEventListener('touchstart', (e) => { e.preventDefault(); this.game.togglePanel('panelBuild'); }, { passive: false });
  }

  // ---------- HUD ----------
  updateVitals(player, env) {
    const s = player.stats;
    const set = (bar, num, value, unit = '') => {
      bar.style.width = Math.max(0, Math.min(100, value)) + '%';
      num.textContent = unit ? Math.round(value) + unit : Math.round(value);
    };
    set(this.refs.barHealth, this.refs.numHealth, s.health);
    set(this.refs.barHunger, this.refs.numHunger, s.hunger);
    set(this.refs.barThirst, this.refs.numThirst, s.thirst);
    set(this.refs.barStamina, this.refs.numStamina, s.stamina);
    this.refs.numTemp.textContent = Math.round(s.temp) + '°C';
    this.refs.posText.textContent = `x ${player.pos.x.toFixed(1)} · y ${player.pos.y.toFixed(1)} · z ${player.pos.z.toFixed(1)}`;
  }

  updateClock(env) {
    const h = Math.floor(env.hour);
    const m = Math.floor((env.hour - h) * 60);
    this.refs.clockTime.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.refs.clockDay.textContent = `第 ${env.day} 天`;
    this.refs.clockWeather.textContent = env.weather.name;
  }

  setInteract(text) {
    this.refs.interact.textContent = text || '';
    this.refs.interact.classList.toggle('on', !!text);
  }

  toast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    this.refs.toasts.appendChild(el);
    setTimeout(() => el.remove(), 2100);
  }

  // ---------- 快捷栏与背包 ----------
  refreshHotbar() {
    const player = this.game.player;
    this.refs.hotbar.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const slot = player.inv[i];
      const div = document.createElement('div');
      div.className = 'slot' + (i === player.hotbarIndex ? ' active' : '');
      div.dataset.index = i;
      const def = slot ? ITEMS[slot.item] : null;
      div.innerHTML =
        `<span class="key">${i + 1}</span>` +
        (def ? `<img src="assets/icons/${def.icon}" alt="" />` : '') +
        (slot && slot.count > 1 ? `<span class="count">${slot.count}</span>` : '');
      div.addEventListener('click', () => {
        player.hotbarIndex = i;
        this.refreshHotbar();
      });
      this.refs.hotbar.appendChild(div);
    }
    const held = player.held();
    this.refs.handInfo.textContent = held ? (held.def.tool ? held.def.name + '（伤害 ' + held.def.damage + '）' : held.def.name) : '空手';
  }

  refreshInventory() {
    const player = this.game.player;
    this.refs.invGrid.innerHTML = '';
    for (let i = 0; i < player.inv.length; i++) {
      const slot = player.inv[i];
      const div = document.createElement('div');
      div.className = 'slot';
      if (slot) {
        const def = ITEMS[slot.item];
        div.innerHTML = `<img src="assets/icons/${def.icon}" alt="" title="${def.name}" />` +
          (slot.count > 1 ? `<span class="count">${slot.count}</span>` : '');
        div.addEventListener('click', () => this.useSlot(i));
      }
      this.refs.invGrid.appendChild(div);
    }
  }

  useSlot(index) {
    const player = this.game.player;
    const slot = player.inv[index];
    if (!slot) return;
    const def = ITEMS[slot.item];
    if (def.food || def.water || def.heal) {
      const res = player.consume(index);
      if (res) this.toast(`${res.item}：${res.effects.join('、')}`, 'good');
    } else if (def.tool || def.armor) {
      const target = player.hotbarIndex;
      const tmp = player.inv[target];
      player.inv[target] = slot;
      player.inv[index] = tmp;
      this.toast(`${def.name} 已放入快捷栏 ${target + 1}`, 'good');
      this.refreshHotbar();
    } else {
      this.toast(`${def.name} 不能直接使用`);
    }
    this.refreshInventory();
  }

  // ---------- 合成 ----------
  refreshCrafting() {
    const game = this.game;
    const player = game.player;
    const station = game.currentStation();
    this.refs.craftStation.textContent = station === 'bench' ? '工作台' : station === 'fire' ? '篝火' : '徒手';
    const cats = {};
    RECIPES.forEach((r) => {
      const ok = !r.station || r.station === station || (r.station === 'bench' && station === 'bench');
      (cats[r.cat] = cats[r.cat] || []).push({ r, ok });
    });
    this.refs.craftList.innerHTML = '';
    Object.keys(cats).forEach((cat) => {
      const head = document.createElement('div');
      head.className = 'dim small';
      head.style.padding = '6px 2px 0';
      head.textContent = cat;
      this.refs.craftList.appendChild(head);
      cats[cat].forEach(({ r, ok }) => {
        const outDef = ITEMS[r.out];
        const canAfford = player.has(r.cost);
        const row = document.createElement('div');
        row.className = 'recipe' + (ok ? '' : ' locked');
        const costText = Object.keys(r.cost).map((k) => {
          const has = player.count(k);
          const need = r.cost[k];
          return `<span class="${has >= need ? '' : 'lack'}">${ITEMS[k].name} ${has}/${need}</span>`;
        }).join(' · ');
        row.innerHTML =
          `<img src="assets/icons/${outDef.icon}" alt="" />` +
          `<div class="body"><div class="name">${outDef.name}${r.count > 1 ? ' ×' + r.count : ''}</div>` +
          `<div class="cost">${costText}</div></div>` +
          `<button ${ok && canAfford ? '' : 'disabled'}>${ok ? '制作' : '需' + (r.station === 'bench' ? '工作台' : '篝火')}</button>`;
        row.querySelector('button').addEventListener('click', () => this.craft(r));
        this.refs.craftList.appendChild(row);
      });
    });
  }

  craft(recipe) {
    const player = this.game.player;
    const station = this.game.currentStation();
    const ok = !recipe.station || recipe.station === station;
    if (!ok) { this.toast('需要靠近' + (recipe.station === 'bench' ? '工作台' : '篝火')); return; }
    if (!player.pay(recipe.cost)) { this.toast('材料不足', 'bad'); return; }
    player.add(recipe.out, recipe.count);
    this.toast(`制作完成：${ITEMS[recipe.out].name} ×${recipe.count}`, 'good');
    this.refreshCrafting();
    this.refreshInventory();
    this.refreshHotbar();
    this.refreshBuild();
  }

  // ---------- 建造 ----------
  refreshBuild() {
    const player = this.game.player;
    this.refs.buildList.innerHTML = '';
    PLACEABLES.forEach((itemId) => {
      const def = ITEMS[itemId];
      const owned = player.count(itemId);
      const row = document.createElement('div');
      row.className = 'recipe';
      row.innerHTML =
        `<img src="assets/icons/${def.icon}" alt="" />` +
        `<div class="body"><div class="name">${STRUCTURES[itemId].name}</div>` +
        `<div class="cost">持有 ${owned} 个${owned ? ' · 选中后点击画面放置' : ''}</div></div>` +
        `<button ${owned ? '' : 'disabled'}>放置</button>`;
      row.querySelector('button').addEventListener('click', () => {
        this.game.startPlacing(itemId);
        this.toast('点击画面放置 ' + STRUCTURES[itemId].name);
      });
      this.refs.buildList.appendChild(row);
    });
  }

  hidePanel(id) {
    $(id).classList.remove('open');
    this.game.closeAllPanels();
  }
}
