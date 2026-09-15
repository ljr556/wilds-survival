import * as THREE from '../vendor/three.module.js';
import { ITEMS, NODE_DROPS } from './data.js';
import { WATER_LEVEL } from './world.js';

const EYE = 1.68;
const GRAVITY = 22;

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.inWater = false;

    this.stats = { health: 100, hunger: 100, thirst: 100, stamina: 100, temp: 20 };
    this.inv = [];
    this.hotbarIndex = 0;
    this.armor = 0;
    this.warmthBonus = 0;
    this.attackCooldown = 0;
    this.miningNode = null;
    this.miningProgress = 0;
    this.hurtFlash = 0;
    this.dead = false;
    for (let i = 0; i < 24; i++) this.inv.push(null);
  }

  spawnAt(x, z) {
    const h = this.world.height(x, z);
    this.pos.set(x, Math.max(h, WATER_LEVEL + 1) + 0.05, z);
    this.vel.set(0, 0, 0);
  }

  // ---------- 背包 ----------
  count(item) {
    let n = 0;
    for (const s of this.inv) if (s && s.item === item) n += s.count;
    return n;
  }

  add(item, count = 1) {
    const def = ITEMS[item];
    if (!def) return 0;
    const max = def.stack || 1;
    let left = count;
    for (const s of this.inv) {
      if (left <= 0) break;
      if (s && s.item === item && s.count < max) {
        const room = Math.min(max - s.count, left);
        s.count += room;
        left -= room;
      }
    }
    for (let i = 0; i < this.inv.length && left > 0; i++) {
      if (!this.inv[i]) {
        const put = Math.min(max, left);
        this.inv[i] = { item, count: put };
        left -= put;
      }
    }
    return count - left;
  }

  remove(item, count = 1) {
    let left = count;
    for (let i = 0; i < this.inv.length && left > 0; i++) {
      const s = this.inv[i];
      if (!s || s.item !== item) continue;
      const take = Math.min(s.count, left);
      s.count -= take;
      left -= take;
      if (s.count <= 0) this.inv[i] = null;
    }
    return count - left;
  }

  has(cost) {
    return Object.keys(cost).every((k) => this.count(k) >= cost[k]);
  }

  pay(cost) {
    if (!this.has(cost)) return false;
    Object.keys(cost).forEach((k) => this.remove(k, cost[k]));
    return true;
  }

  held() {
    const slot = this.inv[this.hotbarIndex];
    if (!slot) return null;
    return { id: slot.item, def: ITEMS[slot.item] };
  }

  // ---------- 生存 ----------
  update(dt, input, env, time) {
    if (this.dead) return;
    const stats = this.stats;

    // 移动
    const speedBase = this.inWater ? 2.4 : 4.5;
    const sprinting = input.sprint && stats.stamina > 1 && (input.forward !== 0 || input.right !== 0);
    const speed = speedBase * (sprinting ? 1.72 : 1);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wishX = input.right * cos - input.forward * sin;
    const wishZ = -input.right * sin - input.forward * cos;
    const wish = new THREE.Vector3(wishX, 0, wishZ);
    if (wish.lengthSq() > 1) wish.normalize();

    const accel = this.onGround ? 34 : 12;
    this.vel.x += (wish.x * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * speed - this.vel.z) * Math.min(1, accel * dt);
    if (this.onGround && wish.lengthSq() < 0.001) {
      this.vel.x *= Math.max(0, 1 - 12 * dt);
      this.vel.z *= Math.max(0, 1 - 12 * dt);
    }

    if (input.jump && this.onGround && !this.inWater) {
      this.vel.y = 7.4;
      this.onGround = false;
      stats.stamina -= 6;
    }
    this.vel.y -= GRAVITY * dt;

    // 碰撞：圆形阻挡
    const nextX = this.pos.x + this.vel.x * dt;
    const nextZ = this.pos.z + this.vel.z * dt;
    let bx = nextX, bz = nextZ;
    for (const c of this.world.colliders) {
      const dx = bx - c.x, dz = bz - c.z;
      const d = Math.hypot(dx, dz);
      if (d < c.r + 0.34 && d > 0.0001) {
        bx = c.x + (dx / d) * (c.r + 0.34);
        bz = c.z + (dz / d) * (c.r + 0.34);
      }
    }
    // 边界
    const lim = 118;
    bx = Math.max(-lim, Math.min(lim, bx));
    bz = Math.max(-lim, Math.min(lim, bz));
    this.pos.x = bx;
    this.pos.z = bz;
    this.pos.y += this.vel.y * dt;

    const ground = this.world.height(this.pos.x, this.pos.z);
    const water = ground < WATER_LEVEL;
    const floorY = water ? WATER_LEVEL + 0.02 : ground;
    this.inWater = water && this.pos.y < WATER_LEVEL + 0.6;
    if (this.pos.y <= floorY) {
      this.pos.y = floorY;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // 视角
    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // 体力
    if (sprinting) stats.stamina = Math.max(0, stats.stamina - 13 * dt);
    else stats.stamina = Math.min(100, stats.stamina + 11 * dt);

    // 饥渴
    stats.hunger = Math.max(0, stats.hunger - 0.075 * dt);
    stats.thirst = Math.max(0, stats.thirst - 0.1 * dt);

    // 温度
    const warmth = this.world.warmthAt(this.pos) + this.warmthBonus;
    let target = 20 - (env.weather.cold || 0) + (env.isNight ? -6 : 0) - (env.underSky ? 0 : 2);
    target += Math.min(14, warmth * 0.62);
    stats.temp += (target - stats.temp) * Math.min(1, dt * 0.35);

    // 伤害与恢复
    let hpDelta = 0;
    if (stats.temp < 6) hpDelta -= (6 - stats.temp) * 0.09 * dt;
    if (stats.hunger <= 0) hpDelta -= 0.55 * dt;
    if (stats.thirst <= 0) hpDelta -= 0.85 * dt;
    if (this.inWater && env.deep) hpDelta -= 3.2 * dt;      // 深水窒息
    if (stats.hunger > 55 && stats.thirst > 55) hpDelta += 0.35 * dt;
    if (hpDelta) this.damage(-hpDelta, true);

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
  }

  damage(amount, silent) {
    if (this.dead) return;
    const reduced = amount * (1 - this.armor);
    this.stats.health -= reduced;
    if (!silent) this.hurtFlash = 1;
    if (this.stats.health <= 0) {
      this.stats.health = 0;
      this.dead = true;
    }
  }

  heal(amount) { this.stats.health = Math.min(100, this.stats.health + amount); }

  // ---------- 采集与战斗 ----------
  toolInfo() {
    const held = this.held();
    const def = held ? held.def : null;
    return {
      id: held ? held.id : null,
      def,
      damage: def && def.damage ? def.damage : 5,
      tool: def && def.tool ? def.tool : null,
      tier: def && def.tier ? def.tier : 0,
    };
  }

  harvestFactor(nodeType) {
    const tool = this.toolInfo();
    const need = NODE_DROPS[nodeType].tool;
    if (!need) return 1;
    if (tool.tool === need) return 1 + (tool.tier - 1) * 0.3;
    if (need === 'pick' && tool.tool === 'axe') return 0.15;
    if (need === 'axe' && tool.tool === 'pick') return 0.15;
    return 0.25;
  }

  // 对节点造成一次挥击，返回是否采集完成
  swingNode(node, dt) {
    const factor = this.harvestFactor(node.type);
    this.miningProgress += factor * dt;
    if (this.miningProgress >= node.hp) {
      const drops = NODE_DROPS[node.type].drops;
      const tier = this.toolInfo().tier;
      const bonus = node.type === 'tree' || node.type === 'rock' ? 1 + (tier - 1) * 0.25 : 1;
      const got = [];
      Object.keys(drops).forEach((k) => {
        const n = Math.max(1, Math.round(drops[k] * bonus));
        this.add(k, n);
        got.push(ITEMS[k].name + ' ×' + n);
      });
      node.harvested = true;
      node.regrowAt = performance.now() / 1000 + NODE_DROPS[node.type].regrow;
      this.world.hideNode(node);
      this.miningProgress = 0;
      this.miningNode = null;
      return got;
    }
    return null;
  }

  consume(slotIndex) {
    const slot = this.inv[slotIndex];
    if (!slot) return null;
    const def = ITEMS[slot.item];
    if (!def) return null;
    const effects = [];
    if (def.food) { this.stats.hunger = Math.min(100, this.stats.hunger + def.food); effects.push('饱食 +' + def.food); }
    if (def.water) { this.stats.thirst = Math.min(100, this.stats.thirst + def.water); effects.push('水分 +' + def.water); }
    if (def.heal) { this.heal(def.heal); effects.push('生命 +' + def.heal); }
    if (def.risk && Math.random() < def.risk) { this.damage(9); effects.push('食物中毒 -9 生命'); }
    if (def.armor) { this.armor = def.armor; this.warmthBonus = def.warm || 0; effects.push('护甲 ' + Math.round(def.armor * 100) + '%'); }
    if (!effects.length) return null;
    this.remove(slot.item, 1);
    return { item: def.name, effects };
  }
}
