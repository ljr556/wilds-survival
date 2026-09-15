import * as THREE from '../vendor/three.module.js';
import { CREATURES, ITEMS } from './data.js';
import { WATER_LEVEL } from './world.js';

function box(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: opts.rough ?? 0.92, flatShading: true,
    emissive: opts.emissive || 0x000000, emissiveIntensity: opts.emissiveIntensity || 0,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  return mesh;
}
function limb(r, len, color) {
  const geo = new THREE.CylinderGeometry(r * 0.8, r, len, 5);
  geo.translate(0, -len / 2, 0);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }));
}

function buildCreatureMesh(type) {
  const group = new THREE.Group();
  const legs = [];
  if (type === 'rabbit') {
    const body = box(0.42, 0.34, 0.62, 0x8d8375);
    body.position.y = 0.34;
    group.add(body);
    const head = box(0.26, 0.24, 0.26, 0x9a8f80);
    head.position.set(0, 0.46, 0.34);
    group.add(head);
    for (const s of [-0.09, 0.09]) {
      const ear = box(0.07, 0.3, 0.05, 0x8a7f70);
      ear.position.set(s, 0.68, 0.32);
      ear.rotation.x = -0.2;
      group.add(ear);
    }
    for (const [x, z] of [[-0.14, 0.2], [0.14, 0.2], [-0.14, -0.2], [0.14, -0.2]]) {
      const leg = limb(0.05, 0.22, 0x7a7062);
      leg.position.set(x, 0.22, z);
      group.add(leg);
      legs.push(leg);
    }
    const tail = box(0.14, 0.14, 0.14, 0xd8d2c6);
    tail.position.set(0, 0.42, -0.34);
    group.add(tail);
  } else if (type === 'deer') {
    const body = box(0.62, 0.72, 1.5, 0x8a6136);
    body.position.y = 1.05;
    group.add(body);
    const neck = box(0.28, 0.62, 0.3, 0x8a6136);
    neck.position.set(0, 1.5, 0.66);
    neck.rotation.x = 0.35;
    group.add(neck);
    const head = box(0.3, 0.3, 0.56, 0x966b3d);
    head.position.set(0, 1.78, 0.9);
    group.add(head);
    for (const s of [-0.11, 0.11]) {
      const antler = box(0.06, 0.5, 0.06, 0xcfc3a6);
      antler.position.set(s, 2.05, 0.86);
      antler.rotation.z = s > 0 ? -0.35 : 0.35;
      group.add(antler);
    }
    for (const [x, z] of [[-0.24, 0.5], [0.24, 0.5], [-0.24, -0.5], [0.24, -0.5]]) {
      const leg = limb(0.09, 0.72, 0x6f4c29);
      leg.position.set(x, 0.72, z);
      group.add(leg);
      legs.push(leg);
    }
  } else if (type === 'boar') {
    const body = box(0.8, 0.72, 1.3, 0x4d3b2c);
    body.position.y = 0.72;
    group.add(body);
    const head = box(0.52, 0.46, 0.52, 0x5b4634);
    head.position.set(0, 0.7, 0.78);
    group.add(head);
    const snout = box(0.26, 0.24, 0.22, 0x6d5442);
    snout.position.set(0, 0.62, 1.06);
    group.add(snout);
    for (const s of [-0.16, 0.16]) {
      const tusk = box(0.06, 0.18, 0.06, 0xe6e0cf);
      tusk.position.set(s, 0.52, 0.96);
      tusk.rotation.x = 0.3;
      group.add(tusk);
    }
    for (const [x, z] of [[-0.3, 0.42], [0.3, 0.42], [-0.3, -0.42], [0.3, -0.42]]) {
      const leg = limb(0.11, 0.5, 0x4a392a);
      leg.position.set(x, 0.5, z);
      group.add(leg);
      legs.push(leg);
    }
  } else if (type === 'wolf') {
    const body = box(0.5, 0.48, 1.15, 0x3b3f45);
    body.position.y = 0.74;
    group.add(body);
    const head = box(0.36, 0.34, 0.44, 0x454a52);
    head.position.set(0, 0.86, 0.72);
    group.add(head);
    const snout = box(0.18, 0.16, 0.24, 0x33373d);
    snout.position.set(0, 0.8, 0.98);
    group.add(snout);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffa500, emissiveIntensity: 1.6 });
    for (const s of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), eyeMat);
      eye.position.set(s, 0.92, 0.92);
      group.add(eye);
    }
    for (const s of [-0.12, 0.12]) {
      const ear = box(0.08, 0.16, 0.05, 0x2f333a);
      ear.position.set(s, 1.06, 0.68);
      group.add(ear);
    }
    const tail = box(0.12, 0.12, 0.44, 0x353a41);
    tail.position.set(0, 0.78, -0.72);
    tail.rotation.x = -0.4;
    group.add(tail);
    for (const [x, z] of [[-0.18, 0.34], [0.18, 0.34], [-0.18, -0.34], [0.18, -0.34]]) {
      const leg = limb(0.08, 0.56, 0x33373d);
      leg.position.set(x, 0.56, z);
      group.add(leg);
      legs.push(leg);
    }
  } else {
    // 林魈：高大人形怪物
    const torso = box(0.74, 1.1, 0.46, 0x2f3b32);
    torso.position.y = 1.55;
    group.add(torso);
    const head = box(0.44, 0.42, 0.44, 0x39503c);
    head.position.y = 2.32;
    group.add(head);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff6b4a, emissive: 0xff3300, emissiveIntensity: 2.1 });
    for (const s of [-0.12, 0.12]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), eyeMat);
      eye.position.set(s, 2.36, 0.22);
      group.add(eye);
    }
    for (const s of [-0.16, 0.16]) {
      const horn = box(0.08, 0.34, 0.08, 0x8a8f7a);
      horn.position.set(s, 2.6, 0.02);
      horn.rotation.z = s > 0 ? -0.3 : 0.3;
      group.add(horn);
    }
    for (const s of [-0.52, 0.52]) {
      const arm = limb(0.11, 1.15, 0x2b362d);
      arm.position.set(s, 2.0, 0);
      group.add(arm);
      legs.push(arm);
    }
    for (const s of [-0.2, 0.2]) {
      const leg = limb(0.13, 1.0, 0x27302a);
      leg.position.set(s, 1.0, 0);
      group.add(leg);
      legs.push(leg);
    }
  }
  group.userData.legs = legs;
  return group;
}

export class Creatures {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.raycastTargets = [];
    this.spawnTimer = 2;
    this.maxPassive = 22;
    this.maxHostile = 0;
  }

  spawn(typeId, x, z) {
    const def = CREATURES[typeId];
    if (!def) return null;
    const mesh = buildCreatureMesh(typeId);
    const h = this.world.height(x, z);
    mesh.position.set(x, Math.max(h, WATER_LEVEL + 0.2), z);
    mesh.scale.setScalar(def.size);
    mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.creatureRoot = mesh; } });
    this.scene.add(mesh);
    const c = {
      id: Math.random().toString(36).slice(2),
      type: typeId, def, mesh,
      hp: def.hp, maxHp: def.hp,
      state: 'wander', timer: 1 + Math.random() * 3,
      target: new THREE.Vector3(x, 0, z),
      attackCd: 0, hitFlash: 0, dead: false,
      wanderDir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      speedMul: 0.9 + Math.random() * 0.25,
      home: new THREE.Vector3(x, 0, z),
    };
    mesh.userData.creature = c;
    this.list.push(c);
    this.raycastTargets.push(mesh);
    return c;
  }

  nearest(pos, filter, maxDist) {
    let best = null, bestD = maxDist;
    for (const c of this.list) {
      if (c.dead) continue;
      if (filter && !filter(c)) continue;
      const d = c.mesh.position.distanceTo(pos);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  damage(creature, amount, fromPos) {
    if (!creature || creature.dead) return false;
    creature.hp -= amount;
    creature.hitFlash = 0.25;
    creature.state = creature.def.hostile || creature.def.aggro ? 'chase' : 'flee';
    creature.timer = 7;
    if (fromPos) {
      const dir = creature.mesh.position.clone().sub(fromPos).setY(0).normalize();
      creature.mesh.position.addScaledVector(dir, 0.5);
    }
    if (creature.hp <= 0) {
      creature.dead = true;
      return true;
    }
    return false;
  }

  remove(creature) {
    this.scene.remove(creature.mesh);
    const i = this.list.indexOf(creature);
    if (i >= 0) this.list.splice(i, 1);
    const j = this.raycastTargets.indexOf(creature.mesh);
    if (j >= 0) this.raycastTargets.splice(j, 1);
  }

  update(dt, player, env, onPlayerDamage) {
    // 夜间刷怪 / 白天清理
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.5;
      const passive = this.list.filter((c) => !c.def.hostile).length;
      const hostile = this.list.filter((c) => c.def.hostile).length;
      if (env.isNight) {
        const wantHostile = Math.min(12, 3 + Math.floor(env.day * 0.8));
        if (hostile < wantHostile) this.spawnNearPlayer(player, Math.random() < 0.72 ? 'wolf' : 'brute', 34, 62);
        if (passive > this.maxPassive - 6) this.cullFar(player, 70);
      } else {
        if (passive < this.maxPassive) this.spawnNearPlayer(player, pick(['rabbit', 'deer', 'deer', 'boar']), 26, 55);
        for (const c of this.list.slice()) {
          if (c.def.hostile && c.mesh.position.distanceTo(player.pos) > 46) this.remove(c);
        }
      }
    }

    for (const c of this.list.slice()) {
      if (c.dead) {
        const drops = c.def.drops;
        Object.keys(drops).forEach((k) => player.add(k, drops[k]));
        const names = Object.keys(drops).map((k) => ITEMS[k].name + ' ×' + drops[k]).join('、');
        this.onKill && this.onKill(c, names);
        this.remove(c);
        continue;
      }

      c.hitFlash = Math.max(0, c.hitFlash - dt);
      c.attackCd = Math.max(0, c.attackCd - dt);
      c.timer -= dt;

      const toPlayer = player.pos.clone().sub(c.mesh.position);
      const distPlayer = toPlayer.length();
      let goal = null;
      let speed = c.def.speed * c.speedMul;

      if (c.def.hostile) {
        if (distPlayer < c.def.aggro) { c.state = 'chase'; c.timer = 5; }
        if (c.state === 'chase' && c.timer > 0) {
          goal = player.pos;
          if (distPlayer < 2.3) {
            if (c.attackCd <= 0) {
              c.attackCd = 1.35;
              onPlayerDamage && onPlayerDamage(c.def.damage, c);
            }
            goal = null;
          }
        } else {
          // 捕食动物
          const prey = this.nearest(c.mesh.position, (o) => !o.def.hostile, 22);
          if (prey) {
            goal = prey.mesh.position;
            speed *= 1.05;
            if (c.mesh.position.distanceTo(prey.mesh.position) < 2.0 && c.attackCd <= 0) {
              c.attackCd = 1.6;
              prey.hp -= 14;
              if (prey.hp <= 0) { prey.dead = true; }
            }
          }
        }
      } else {
        const threat = distPlayer < (c.def.flee || 10) + (c.state === 'flee' ? 6 : 0);
        if (threat) { c.state = 'flee'; c.timer = Math.max(c.timer, 3); }
        else if (c.timer <= 0) { c.state = 'wander'; c.timer = 2 + Math.random() * 4; }

        if (c.state === 'flee') {
          const dir = c.mesh.position.clone().sub(player.pos).setY(0).normalize();
          goal = c.mesh.position.clone().addScaledVector(dir, 8);
          speed *= 1.25;
        } else if (c.def.aggro && distPlayer < c.def.aggro) {
          goal = player.pos;
          if (distPlayer < 2.2 && c.attackCd <= 0) {
            c.attackCd = 1.6;
            onPlayerDamage && onPlayerDamage(c.def.damage, c);
          }
        } else if (c.state === 'wander') {
          goal = c.home.clone().addScaledVector(c.wanderDir, 6);
          if (Math.random() < dt * 0.6) {
            c.wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            goal = c.home.clone().addScaledVector(c.wanderDir, 5 + Math.random() * 6);
          }
        }
      }

      // 移动
      const speedNow = goal ? speed : 0;
      if (goal) {
        const dir = goal.clone().sub(c.mesh.position).setY(0);
        const d = dir.length();
        if (d > 0.35) {
          dir.normalize();
          const step = Math.min(speedNow * dt, d);
          const nx = c.mesh.position.x + dir.x * step;
          const nz = c.mesh.position.z + dir.z * step;
          const ground = this.world.height(nx, nz);
          if (ground > WATER_LEVEL - 0.35) {
            c.mesh.position.set(nx, Math.max(ground, WATER_LEVEL + 0.05), nz);
            c.mesh.rotation.y = Math.atan2(dir.x, dir.z);
          } else {
            c.wanderDir.multiplyScalar(-1);
            c.home.copy(c.mesh.position);
          }
        }
      }

      // 动画
      const legs = c.mesh.userData.legs || [];
      const t = performance.now() / 1000;
      const moving = speedNow > 0.01;
      legs.forEach((leg, i) => {
        leg.rotation.x = moving ? Math.sin(t * 9 + i * 1.7) * 0.55 : Math.sin(t * 1.4 + i) * 0.04;
      });
      const flash = c.hitFlash > 0;
      c.mesh.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissive) {
          if (!o.userData.baseEmissive) o.userData.baseEmissive = o.material.emissive.getHex();
          o.material.emissive.setHex(flash ? 0xff5533 : o.userData.baseEmissive);
        }
      });
    }
  }

  spawnNearPlayer(player, typeId, minD, maxD) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = minD + Math.random() * (maxD - minD);
      const x = player.pos.x + Math.cos(a) * d;
      const z = player.pos.z + Math.sin(a) * d;
      if (Math.abs(x) > 116 || Math.abs(z) > 116) continue;
      const h = this.world.height(x, z);
      if (h < WATER_LEVEL + 0.3) continue;
      return this.spawn(typeId, x, z);
    }
    return null;
  }

  cullFar(player, dist) {
    for (const c of this.list.slice()) {
      if (!c.def.hostile && c.mesh.position.distanceTo(player.pos) > dist) this.remove(c);
    }
  }

  clearAll() {
    for (const c of this.list.slice()) this.remove(c);
  }
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
