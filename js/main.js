import * as THREE from '../vendor/three.module.js';
import { World, WATER_LEVEL } from './world.js';
import { Player } from './player.js';
import { Creatures } from './entities.js';
import { Environment } from './weather.js';
import { UI } from './ui.js';
import { ITEMS, CREATURES, STRUCTURES, NODE_DROPS } from './data.js';

const SAVE_KEY = 'wilds-survival-save-v1';
const REACH = 3.3;

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.25 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.08, 420);
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = REACH;
    this.center = new THREE.Vector2(0, 0);

    this.running = false;
    this.paused = true;
    this.placing = null;
    this.ui = new UI(this);
    this.lastUse = false;
    this.quality = this.isMobile ? 'low' : 'high';
    this.fpsSamples = [];
    this.grassMesh = null;
  }

  async boot() {
    const startBtn = document.getElementById('btnStart');
    const setStatus = (text, ready) => {
      document.getElementById('startMeta').textContent = text;
      if (ready) {
        startBtn.disabled = false;
        startBtn.textContent = '进入森林';
      }
    };
    setStatus('正在生成森林…（首次进入需要编译着色器，请稍候）', false);
    const loader = new THREE.TextureLoader();
    const load = (file) => new Promise((res) => {
      loader.load(
        'assets/terrain/' + file,
        (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); },
        undefined,
        () => res(null),
      );
    });
    const [grass, dirt, rock, sand] = await Promise.all([
      load('grass.png'), load('dirt.png'), load('rock.png'), load('sand.png'),
    ]);
    this.world = new World(this.scene, 20240915, this.isMobile
      ? { segments: 96, grassCount: 900 }
      : { segments: 150, grassCount: 2600 });
    await this.world.build({ grass, dirt, rock, sand });
    this.player = new Player(this.camera, this.world);
    this.creatures = new Creatures(this.scene, this.world);
    this.env = new Environment(this.scene, this.renderer, { rainCount: this.isMobile ? 1100 : 2600 });
    this.ui.init();
    this.creatures.onKill = (c, names) => this.ui.toast('击杀 ' + c.def.name + '：' + names, 'good');

    // 找一个岸边出生点
    let sx = 20, sz = 20;
    for (let r = 6; r < 80; r += 3) {
      const x = Math.cos(r * 0.7) * r, z = Math.sin(r * 0.7) * r;
      if (this.world.height(x, z) > WATER_LEVEL + 1.4 && this.world.slopeAt(x, z) < 0.3) { sx = x; sz = z; break; }
    }
    this.spawnPoint = new THREE.Vector3(sx, 0, sz);
    this.player.spawnAt(sx, sz);
    this.env.update(0.016, this.player.pos);

    const has = !!localStorage.getItem(SAVE_KEY);
    setStatus(has
      ? '检测到本地存档，可继续上次的进度（进入后再点「读取存档」）'
      : '准备就绪 · 先捡树枝和石头，做一把石斧', true);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());

    this.ui.updateVitals(this.player, this.env);
    this.ui.updateClock(this.env);
    this.ui.refreshHotbar();
    this.ui.refreshInventory();
    this.ui.refreshCrafting();
    this.ui.refreshBuild();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  start(loadSave) {
    if (loadSave) this.load();
    this.running = true;
    this.paused = false;
    document.getElementById('startOverlay').classList.add('hidden');
    if (!this.isMobile && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
    this.ui.toast('第 ' + this.env.day + ' 天 · 存活开始', 'good');
    this.ui.refreshHotbar();
  }

  togglePanel(id) {
    const el = document.getElementById(id);
    const open = el.classList.contains('open');
    this.closeAllPanels();
    if (!open) {
      el.classList.add('open');
      if (id === 'panelInventory') this.ui.refreshInventory();
      if (id === 'panelCraft') this.ui.refreshCrafting();
      if (id === 'panelBuild') this.ui.refreshBuild();
      if (document.pointerLockElement) document.exitPointerLock();
      this.paused = true;
    }
  }

  closeAllPanels() {
    ['panelInventory', 'panelCraft', 'panelBuild'].forEach((id) => document.getElementById(id).classList.remove('open'));
    if (this.running && !this.isMobile) this.paused = false;
    if (this.running && this.isMobile) this.paused = false;
  }

  currentStation() {
    const p = this.player.pos;
    if (this.world.nearbyStructure(p, 'cook', 4.0)) return 'fire';
    if (this.world.nearbyStructure(p, 'bench', 4.0)) return 'bench';
    return null;
  }

  // ---------- 主循环 ----------
  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.running && !this.paused) this.update(dt);
    this.guardPerformance(dt);
    this.ui.updateVitals(this.player, this.env);
    this.ui.updateClock(this.env);
    this.renderer.render(this.scene, this.camera);
  }

  // 低端设备自动降质：连续低帧率时降低像素比并削减植被
  guardPerformance(dt) {
    if (!this.running) return;
    this.fpsSamples.push(1 / Math.max(dt, 0.0001));
    if (this.fpsSamples.length < 90) return;
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    this.fpsSamples.length = 0;
    if (avg < 26 && this.quality !== 'minimal') {
      this.quality = this.quality === 'high' ? 'low' : 'minimal';
      const ratio = this.quality === 'low' ? 1.0 : 0.7;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio));
      if (this.quality === 'minimal') {
        const grass = this.world.meshes.find((m) => m.geometry && m.geometry.type === 'ConeGeometry' && m.count > 500);
        if (grass) grass.visible = false;
        this.env.rain.visibleCount = 600;
      }
      this.ui.toast('已自动降低画质以保持流畅');
    }
  }

  update(dt) {
    const ui = this.ui;
    const input = ui.input;

    // 视角
    if (input.lookDX || input.lookDY) {
      this.player.yaw -= input.lookDX;
      this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch - input.lookDY));
      input.lookDX = 0;
      input.lookDY = 0;
    }

    const underSky = !this.world.nearbyStructure(this.player.pos, 'sleep', 2.6);
    this.envInfo = this.env.update(dt, this.player.pos);
    if (this.envInfo.changed) {
      ui.toast('天气转为：' + this.env.weather.name);
    }
    this.world.update(dt, performance.now() / 1000);
    this.player.update(dt, input, { weather: this.env.weather, isNight: this.env.isNight, underSky, deep: this.deepWater() }, dt);
    this.creatures.update(dt, this.player, this.envInfo, (dmg, c) => {
      this.player.damage(dmg);
      ui.toast(c.def.name + ' 造成 ' + Math.round(dmg * (1 - this.player.armor)) + ' 点伤害', 'bad');
    });

    // 恢复已采集的节点
    const nowS = performance.now() / 1000;
    for (const n of this.world.nodes) {
      if (n.harvested && n.regrowAt && nowS >= n.regrowAt) {
        this.world.restoreNode(n);
      }
    }

    this.handleTargeting(dt, input);

    input.jump = false;
    if (this.player.dead) this.die();
  }

  deepWater() {
    const h = this.world.height(this.player.pos.x, this.player.pos.z);
    return h < WATER_LEVEL - 1.6;
  }

  // ---------- 瞄准 / 采集 / 攻击 ----------
  handleTargeting(dt, input) {
    const ui = this.ui;
    this.raycaster.setFromCamera(this.center, this.camera);

    const creatureHit = this.raycaster.intersectObjects(this.creatures.raycastTargets, true)[0];
    let nodeHit = this.raycaster.intersectObjects(this.world.raycastTargets, false)[0];
    if (nodeHit && nodeHit.instanceId === undefined) nodeHit = null;

    const creature = creatureHit ? findCreature(creatureHit.object) : null;
    const node = nodeHit ? this.world.nodeFromHit(nodeHit.object, nodeHit.instanceId) : null;

    let prompt = '';
    if (this.placing) {
      prompt = '点击放置 ' + STRUCTURES[this.placing].name;
    } else if (creature && !creature.dead) {
      prompt = creature.def.name + ' · 生命 ' + Math.max(0, Math.round(creature.hp)) + '/' + creature.maxHp + ' · 攻击';
    } else if (node && !node.harvested) {
      const need = NODE_DROPS[node.type].tool;
      const tool = this.player.toolInfo();
      const proper = !need || tool.tool === need;
      prompt = nodeName(node.type) + (proper ? ' · 采集' : ' · 需要' + (need === 'axe' ? '斧头' : '镐子'));
    } else if (this.env.isNight && this.world.nearbyStructure(this.player.pos, 'sleep', 2.6)) {
      prompt = '按 E / 用 键睡到天亮';
    }
    ui.setInteract(prompt);

    // 交互
    const pressed = input.use && !this.lastUse;
    if (this.placing && pressed) {
      this.placeAt();
      this.lastUse = input.use;
      return;
    }
    if (creature && !creature.dead) {
      if (input.use && this.player.attackCooldown <= 0) {
        this.player.attackCooldown = 0.52;
        const dmg = this.player.toolInfo().damage;
        const killed = this.creatures.damage(creature, dmg, this.player.pos);
        ui.toast('击中 ' + creature.def.name + ' -' + dmg, killed ? 'good' : '');
      }
    } else if (node && !node.harvested && input.use) {
      const got = this.player.swingNode(node, dt);
      if (got) {
        ui.toast('获得 ' + got.join('、'), 'good');
        ui.refreshHotbar();
      }
    } else if (pressed && this.env.isNight && this.world.nearbyStructure(this.player.pos, 'sleep', 2.6)) {
      this.env.sleepToMorning();
      this.player.stats.stamina = 100;
      this.player.heal(14);
      ui.toast('你在棚屋里睡到天亮，精神恢复', 'good');
      this.save();
    }
    this.lastUse = input.use;
  }

  placeAt() {
    const itemId = this.placing;
    if (!itemId) return;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const target = this.player.pos.clone().add(dir.multiplyScalar(2.6)).setY(0);
    const h = this.world.height(target.x, target.z);
    if (h < WATER_LEVEL + 0.1) { this.ui.toast('不能放在水里', 'bad'); return; }
    if (this.player.count(itemId) <= 0) { this.ui.toast('没有可放置的' + STRUCTURES[itemId].name, 'bad'); this.placing = null; return; }
    this.player.remove(itemId, 1);
    target.y = h;
    this.world.place(itemId, target, this.player.yaw + Math.PI / 2);
    this.ui.toast('已放置 ' + STRUCTURES[itemId].name, 'good');
    this.placing = null;
    this.ui.refreshBuild();
    this.ui.refreshHotbar();
    this.save();
  }

  startPlacing(itemId) {
    this.placing = itemId;
    this.closeAllPanels();
  }

  throwHeld() {
    const held = this.player.held();
    if (!held || held.def.tool || held.def.armor) return;
    this.player.remove(held.id, 1);
    this.ui.toast('丢弃 ' + held.def.name);
    this.ui.refreshHotbar();
    this.ui.refreshInventory();
  }

  // ---------- 存读档 ----------
  save() {
    if (!this.running) return;
    const harvested = this.world.nodes.filter((n) => n.harvested).map((n) => ({
      k: n.type + ':' + n.index, t: Math.max(0, (n.regrowAt || 0) - performance.now() / 1000),
    }));
    const data = {
      seed: this.world.seed,
      hour: this.env.hour, day: this.env.day, weather: this.env.weatherId,
      player: {
        x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z,
        yaw: this.player.yaw, pitch: this.player.pitch,
        stats: this.player.stats, inv: this.player.inv, hotbar: this.player.hotbarIndex,
        armor: this.player.armor, warmth: this.player.warmthBonus,
      },
      structures: this.world.structures.map((s) => ({ item: s.item, x: s.position.x, y: s.position.y, z: s.position.z, r: s.rotationY })),
      harvested,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
  }

  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { data = null; }
    if (!data) { this.ui.toast('没有找到存档，开始新的求生', 'bad'); return; }
    this.env.setTime(data.hour, data.day);
    if (data.weather && CREATURES[data.weather] === undefined) this.env.weatherId = data.weather;
    const p = data.player || {};
    this.player.pos.set(p.x || 0, p.y || 0, p.z || 0);
    this.player.yaw = p.yaw || 0;
    this.player.pitch = p.pitch || 0;
    Object.assign(this.player.stats, p.stats || {});
    if (Array.isArray(p.inv)) this.player.inv = p.inv;
    this.player.hotbarIndex = p.hotbar || 0;
    this.player.armor = p.armor || 0;
    this.player.warmthBonus = p.warmth || 0;
    this.player.dead = false;
    (data.structures || []).forEach((s) => {
      this.world.place(s.item, new THREE.Vector3(s.x, s.y, s.z), s.r || 0);
    });
    const now = performance.now() / 1000;
    (data.harvested || []).forEach((h) => {
      const [type, idx] = String(h.k).split(':');
      const node = this.world.nodes.find((n) => n.type === type && n.index === Number(idx));
      if (node) {
        node.harvested = true;
        node.regrowAt = now + (h.t || 60);
        this.world.hideNode(node);
      }
    });
    this.ui.toast('已读取存档 · 第 ' + this.env.day + ' 天', 'good');
    this.ui.refreshHotbar();
    this.ui.refreshInventory();
  }

  die() {
    this.player.dead = false;
    this.paused = true;
    document.getElementById('deathOverlay').classList.remove('hidden');
    document.getElementById('deathText').textContent =
      '你在第 ' + this.env.day + ' 天的森林里倒下了。物品还在，重新站起来。';
    if (document.pointerLockElement) document.exitPointerLock();
  }

  respawn() {
    this.player.stats.health = 100;
    this.player.stats.hunger = Math.max(35, this.player.stats.hunger);
    this.player.stats.thirst = Math.max(35, this.player.stats.thirst);
    this.player.stats.stamina = 100;
    this.player.spawnAt(this.spawnPoint.x, this.spawnPoint.z);
    this.creatures.clearAll();
    document.getElementById('deathOverlay').classList.add('hidden');
    this.paused = false;
    if (!this.isMobile) this.canvas.requestPointerLock();
  }
}

function nodeName(type) {
  return ({ tree: '树木', rock: '岩石', iron: '铁矿', coal: '煤矿', bush: '浆果丛', plant: '草丛' })[type] || type;
}

function findCreature(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.creature) return o.userData.creature;
    o = o.parent;
  }
  return null;
}

const game = new Game();
window.__game = game;
game.boot().catch((e) => {
  document.getElementById('startMeta').textContent = '初始化失败：' + e.message;
  document.getElementById('btnStart').disabled = false;
  document.getElementById('btnStart').textContent = '仍然尝试进入';
  console.error(e);
});

setInterval(() => { if (game.running) game.save(); }, 20000);
window.addEventListener('beforeunload', () => game.save());
