import * as THREE from '../vendor/three.module.js';
import { NODE_DROPS, STRUCTURES } from './data.js';

export const WORLD_SIZE = 240;
export const WATER_LEVEL = -1.15;
const SEGMENTS = 150;

// ---------- 噪声 ----------
function hash2(x, y, seed) {
  // 必须用整数哈希：浮点大数参与位运算会丢低位，导致噪声恒为常数
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, seed, octaves = 4) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 71) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum / norm;
}

export class World {
  constructor(scene, seed = 1337, opts = {}) {
    this.scene = scene;
    this.seed = seed;
    this.segments = opts.segments || SEGMENTS;
    this.grassCount = opts.grassCount || 2600;
    this.terrainMatOpts = opts;
    this.nodes = [];            // 可采集节点
    this.structures = [];       // 已建造物体
    this.colliders = [];        // 圆形碰撞体 {x, z, r}
    this.meshes = [];
    this.raycastTargets = [];
    this.harvestMeshes = [];
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  // ---------- 地形高度 ----------
  height(x, z) {
    const s = this.seed;
    const base = fbm(x * 0.0062, z * 0.0062, s, 4);
    const ridge = Math.pow(fbm(x * 0.019, z * 0.019, s + 13, 3), 1.5);
    const detail = fbm(x * 0.09, z * 0.09, s + 27, 2);
    let h = (base - 0.42) * 40 + ridge * 22 + detail * 1.4;
    // 中央湖盆
    const d = Math.hypot(x, z);
    const lake = Math.max(0, 1 - d / 46);
    h -= lake * lake * 16;
    return h;
  }

  normalAt(x, z) {
    const e = 0.7;
    const hL = this.height(x - e, z), hR = this.height(x + e, z);
    const hD = this.height(x, z - e), hU = this.height(x, z + e);
    return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
  }

  slopeAt(x, z) { return 1 - this.normalAt(x, z).y; }

  isWater(x, z) { return this.height(x, z) < WATER_LEVEL; }

  // ---------- 构建 ----------
  async build(textures) {
    this.timings = {};
    let t = performance.now();
    this.buildTerrain(textures);
    this.timings.terrain = Math.round(performance.now() - t);
    t = performance.now();
    this.buildWater();
    this.timings.water = Math.round(performance.now() - t);
    t = performance.now();
    this.scatterProps(textures);
    this.timings.scatter = Math.round(performance.now() - t);
  }

  buildTerrain(textures) {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, this.segments, this.segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this.height(x, z));
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0.02 });
    const uniforms = {
      uGrass: { value: textures.grass },
      uDirt: { value: textures.dirt },
      uRock: { value: textures.rock },
      uSand: { value: textures.sand },
      uScale: { value: 0.075 },
    };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWPos = (modelMatrix * vec4(position,1.0)).xyz;\n vWNormal = normalize(mat3(modelMatrix) * normal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', [
          '#include <common>',
          'varying vec3 vWPos;',
          'varying vec3 vWNormal;',
          'uniform sampler2D uGrass; uniform sampler2D uDirt; uniform sampler2D uRock; uniform sampler2D uSand;',
          'uniform float uScale;',
        ].join('\n'))
        .replace('#include <map_fragment>', [
          'vec2 tuv = vWPos.xz * uScale;',
          'float slope = 1.0 - clamp(vWNormal.y, 0.0, 1.0);',
          'float hh = vWPos.y;',
          'vec3 cG = texture2D(uGrass, tuv).rgb;',
          'vec3 cD = texture2D(uDirt, tuv * 0.8).rgb;',
          'vec3 cR = texture2D(uRock, tuv * 1.4).rgb;',
          'vec3 cS = texture2D(uSand, tuv * 1.1).rgb;',
          'float wSand = smoothstep(0.4, -1.1, hh);',
          'float wRock = smoothstep(0.11, 0.24, slope);',
          'float wDirt = smoothstep(4.0, 11.0, hh) * 0.8;',
          'float wGrass = max(0.0, 1.0 - wRock - wDirt);',
          'vec3 blend = cG * wGrass + cD * wDirt + cR * wRock + cS * wSand;',
          'blend /= (wGrass + wDirt + wRock + wSand + 0.0001);',
          'diffuseColor.rgb *= blend * 1.22;',
        ].join('\n'));
    };
    this.groundMat = mat;
    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.group.add(terrain);
    this.terrain = terrain;
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE * 1.6, WORLD_SIZE * 1.6, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3d92a6, transparent: true, opacity: 0.74,
      roughness: 0.18, metalness: 0.35, side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = WATER_LEVEL;
    this.group.add(water);
    this.water = water;
  }

  scatterProps(textures) {
    const rand = mulberry(this.seed * 7 + 3);
    const limit = WORLD_SIZE / 2 - 12;
    const taken = [];
    const farFrom = (x, z, minD) => !taken.some((t) => Math.hypot(t.x - x, t.z - z) < minD);
    const sample = (count, want, minD, tries = 40) => {
      const out = [];
      for (let i = 0; i < count * tries && out.length < count; i++) {
        const x = (rand() * 2 - 1) * limit;
        const z = (rand() * 2 - 1) * limit;
        const h = this.height(x, z);
        if (h < WATER_LEVEL + 0.4) continue;
        const slope = this.slopeAt(x, z);
        if (!want(h, slope)) continue;
        if (minD && !farFrom(x, z, minD)) continue;
        taken.push({ x, z });
        out.push({ x, z, h, slope, r: rand() });
      }
      return out;
    };

    const trees = sample(300, (h, s) => s < 0.34 && h > WATER_LEVEL + 0.7, 3.0);
    const rocks = sample(180, (h, s) => s > 0.06, 2.4);
    const ores = sample(46, (h) => h > 5.0, 4.0);
    const coal = sample(32, (h) => h > 8.0, 4.0);
    const bushes = sample(110, (h, s) => s < 0.28 && h < 6, 2.2);
    const plants = sample(260, (h, s) => s < 0.3, 1.4);

    this.buildTrees(trees, rand, textures);
    this.buildRocks(rocks, rand, 'rock', 0x8a8b84);
    this.buildRocks(ores, rand, 'iron', 0x6f6a62, 0x7a5a3a);
    this.buildRocks(coal, rand, 'coal', 0x53514e, 0x2b2b2b);
    this.buildBushes(bushes, rand);
    this.buildPlants(plants, rand);
    this.buildGrass(rand);
  }

  buildTrees(spots, rand, textures) {
    const n = spots.length;
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5f42, roughness: 0.95, map: textures.bark || null });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    const leafGeo = new THREE.ConeGeometry(1.6, 3.2, 7);
    leafGeo.translate(0, 1.6, 0);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f9448, roughness: 0.9 });
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const s = spots[i];
      const scale = 3.4 + rand() * 3.6;
      const radius = 0.55 + scale * 0.045;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      m.compose(new THREE.Vector3(s.x, s.h - 0.1, s.z), q, new THREE.Vector3(1.5, scale, 1.5));
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(s.x, s.h + scale * 0.78, s.z), q, new THREE.Vector3(0.9 + rand() * 0.4, 1 + rand() * 0.5, 0.9 + rand() * 0.4));
      leaves.setMatrixAt(i, m);
      color.setHSL(0.26 + rand() * 0.08, 0.38 + rand() * 0.22, 0.34 + rand() * 0.16);
      leaves.setColorAt(i, color);
      this.addNode({ type: 'tree', x: s.x, z: s.z, y: s.h, radius, index: i, mesh: trunks, extraMesh: leaves, hp: NODE_DROPS.tree.hits });
    }
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    this.group.add(trunks, leaves);
    this.meshes.push(trunks, leaves);
    this.treeMeshes = { trunks, leaves };
  }

  buildRocks(spots, rand, type, baseColor, accent) {
    const n = spots.length;
    if (!n) return;
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const s = spots[i];
      const scale = 0.7 + rand() * (type === 'rock' ? 1.7 : 1.1);
      const radius = scale * 0.95;
      q.setFromEuler(new THREE.Euler(rand() * 0.5, rand() * Math.PI, rand() * 0.5));
      m.compose(new THREE.Vector3(s.x, s.h + scale * 0.35, s.z), q, new THREE.Vector3(scale, scale * 0.8, scale));
      mesh.setMatrixAt(i, m);
      if (accent) {
        const mix = 0.25 + rand() * 0.5;
        color.setHex(baseColor).lerp(new THREE.Color(accent), mix);
      } else {
        color.setHex(baseColor).offsetHSL(0, 0, (rand() - 0.5) * 0.12);
      }
      mesh.setColorAt(i, color);
      this.addNode({
        type, x: s.x, z: s.z, y: s.h, radius, index: i, mesh, hp: NODE_DROPS[type].hits,
      });
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
    this.meshes.push(mesh);
  }

  buildBushes(spots, rand) {
    const n = spots.length;
    if (!n) return;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x36592e, roughness: 0.9, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const berryGeo = new THREE.SphereGeometry(0.12, 6, 5);
    const berryMat = new THREE.MeshStandardMaterial({ color: 0x9c2b3a, roughness: 0.5, emissive: 0x330a12 });
    const berries = new THREE.InstancedMesh(berryGeo, berryMat, n * 4);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    let bi = 0;
    for (let i = 0; i < n; i++) {
      const s = spots[i];
      const scale = 0.8 + rand() * 0.6;
      q.setFromEuler(new THREE.Euler(0, rand() * 3, 0));
      m.compose(new THREE.Vector3(s.x, s.h + scale * 0.55, s.z), q, new THREE.Vector3(scale, scale * 0.85, scale));
      mesh.setMatrixAt(i, m);
      for (let b = 0; b < 4; b++) {
        const a = rand() * Math.PI * 2;
        const r = scale * (0.5 + rand() * 0.4);
        m.compose(
          new THREE.Vector3(s.x + Math.cos(a) * r, s.h + scale * (0.6 + rand() * 0.5), s.z + Math.sin(a) * r),
          q, new THREE.Vector3(1, 1, 1),
        );
        berries.setMatrixAt(bi++, m);
      }
      this.addNode({ type: 'bush', x: s.x, z: s.z, y: s.h, radius: scale, index: i, mesh, extraMesh: berries, hp: 1 });
    }
    mesh.instanceMatrix.needsUpdate = true;
    berries.instanceMatrix.needsUpdate = true;
    this.group.add(mesh, berries);
    this.meshes.push(mesh, berries);
  }

  buildPlants(spots, rand) {
    const n = spots.length;
    if (!n) return;
    const geo = new THREE.ConeGeometry(0.18, 0.9, 4);
    geo.translate(0, 0.45, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x86ab52, roughness: 0.9, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const s = spots[i];
      q.setFromEuler(new THREE.Euler(0, rand() * 3, (rand() - 0.5) * 0.4));
      m.compose(new THREE.Vector3(s.x, s.h, s.z), q, new THREE.Vector3(1, 0.8 + rand() * 0.9, 1));
      mesh.setMatrixAt(i, m);
      this.addNode({ type: 'plant', x: s.x, z: s.z, y: s.h, radius: 0.5, index: i, mesh, hp: 1 });
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
    this.meshes.push(mesh);
  }

  buildGrass(rand) {
    const count = this.grassCount;
    const geo = new THREE.ConeGeometry(0.055, 0.42, 3);
    geo.translate(0, 0.21, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x7ba84c, roughness: 1, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    const limit = WORLD_SIZE / 2 - 6;
    let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const x = (rand() * 2 - 1) * limit;
      const z = (rand() * 2 - 1) * limit;
      const h = this.height(x, z);
      if (h < WATER_LEVEL + 0.25 || this.slopeAt(x, z) > 0.4) continue;
      q.setFromEuler(new THREE.Euler(0, rand() * 3, 0));
      m.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(1, 0.7 + rand() * 1.1, 1));
      mesh.setMatrixAt(placed, m);
      color.setHSL(0.24 + rand() * 0.08, 0.4 + rand() * 0.22, 0.36 + rand() * 0.16);
      mesh.setColorAt(placed, color);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
    this.meshes.push(mesh);
  }

  // ---------- 采集节点 ----------
  addNode(node) {
    node.hpLeft = node.hp;
    node.harvested = false;
    node.regrowAt = 0;
    this.nodes.push(node);
    const entry = this.harvestMeshes.find((h) => h.mesh === node.mesh);
    if (entry) entry.map[node.index] = node;
    else this.harvestMeshes.push({ mesh: node.mesh, map: { [node.index]: node }, world: this });
    if (this.raycastTargets.indexOf(node.mesh) < 0) this.raycastTargets.push(node.mesh);
  }

  nodeFromHit(mesh, instanceId) {
    const entry = this.harvestMeshes.find((h) => h.mesh === mesh);
    if (!entry) return null;
    return entry.map[instanceId] || null;
  }

  hideNode(node) {
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    node.mesh.setMatrixAt(node.index, m);
    node.mesh.instanceMatrix.needsUpdate = true;
    if (node.extraMesh) {
      node.extraMesh.setMatrixAt(node.index, m);
      node.extraMesh.instanceMatrix.needsUpdate = true;
    }
    if (node.type === 'tree' && node.extraMesh) {
      node.extraMesh.setMatrixAt(node.index, m);
      node.extraMesh.instanceMatrix.needsUpdate = true;
    }
  }

  restoreNode(node) {
    const q = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    if (node.type === 'tree') {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (node.index * 1.7) % 6.28);
      m.compose(new THREE.Vector3(node.x, node.y - 0.1, node.z), q, new THREE.Vector3(1.5, node.scale || 5, 1.5));
      node.mesh.setMatrixAt(node.index, m);
      node.mesh.instanceMatrix.needsUpdate = true;
      if (node.extraMesh) {
        m.compose(new THREE.Vector3(node.x, node.y + (node.scale || 5) * 0.78, node.z), q, new THREE.Vector3(1, 1.2, 1));
        node.extraMesh.setMatrixAt(node.index, m);
        node.extraMesh.instanceMatrix.needsUpdate = true;
      }
    }
    node.harvested = false;
    node.hpLeft = node.hp;
  }

  // ---------- 建筑 ----------
  place(itemId, position, rotationY = 0) {
    const def = STRUCTURES[itemId];
    if (!def) return null;
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;
    let light = null;

    if (itemId === 'campfire') {
      const stone = new THREE.MeshStandardMaterial({ color: 0x777069, roughness: 0.95, flatShading: true });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19, 0), stone);
        rock.position.set(Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(rock);
      }
      const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 });
      for (let i = 0; i < 4; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.85, 5), logMat);
        log.position.set((Math.random() - 0.5) * 0.2, 0.16, (Math.random() - 0.5) * 0.2);
        log.rotation.set(Math.PI / 2.4, i * 1.2, 0);
        group.add(log);
      }
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.75, 7),
        new THREE.MeshStandardMaterial({ color: 0xff9a3c, emissive: 0xff6a12, emissiveIntensity: 1.7, transparent: true, opacity: 0.94 }),
      );
      flame.position.y = 0.42;
      group.add(flame);
      light = new THREE.PointLight(0xffa04a, 2.4, 13, 1.7);
      light.position.set(0, 0.9, 0);
      group.add(light);
      group.userData.flame = flame;
    }

    if (itemId === 'workbench') {
      const wood = new THREE.MeshStandardMaterial({ color: 0x6a4f34, roughness: 0.9 });
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.95), wood);
      top.position.y = 0.82;
      group.add(top);
      for (const [dx, dz] of [[-0.6, -0.36], [0.6, -0.36], [-0.6, 0.36], [0.6, 0.36]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.8, 0.13), wood);
        leg.position.set(dx, 0.4, dz);
        group.add(leg);
      }
      const tool = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: 0x8f8d84 }));
      tool.position.set(0.2, 0.92, 0);
      group.add(tool);
    }

    if (itemId === 'wall_wood') {
      const wood = new THREE.MeshStandardMaterial({ color: 0x6b5136, roughness: 0.95 });
      for (let i = 0; i < 5; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 0.11), wood);
        plank.position.set(0, 0.2 + i * 0.36, 0);
        group.add(plank);
      }
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 0.14), wood);
      post.position.set(-0.9, 0.95, 0);
      const post2 = post.clone();
      post2.position.x = 0.9;
      group.add(post, post2);
    }

    if (itemId === 'shelter') {
      const wood = new THREE.MeshStandardMaterial({ color: 0x6b5136, roughness: 0.95 });
      const thatch = new THREE.MeshStandardMaterial({ color: 0x7d7a44, roughness: 1 });
      for (const [dx, dz, w, d] of [[0, -1.5, 3.2, 0.12], [-1.6, 0, 0.12, 3.1], [1.6, 0, 0.12, 3.1]]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.1, d), wood);
        wall.position.set(dx, 1.05, dz);
        group.add(wall);
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.5, 4), thatch);
      roof.position.y = 2.45;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
    }

    this.group.add(group);
    const record = { item: itemId, def, group, light, position: position.clone(), rotationY, flame: group.userData.flame };
    this.structures.push(record);
    if (def.blocks) this.colliders.push({ x: position.x, z: position.z, r: 1.0 });
    return record;
  }

  // 返回附近的工作台/篝火/棚屋
  nearbyStructure(pos, kindFlag, range = 4.5) {
    for (const s of this.structures) {
      if (!s.def[kindFlag]) continue;
      if (s.position.distanceTo(pos) <= range) return s;
    }
    return null;
  }

  // 篝火取暖：返回温暖值
  warmthAt(pos) {
    let warm = 0;
    for (const s of this.structures) {
      if (!s.def.warm) continue;
      const d = s.position.distanceTo(pos);
      if (d < 8) warm = Math.max(warm, s.def.warm * (1 - d / 8));
    }
    return warm;
  }

  update(dt, time) {
    for (const s of this.structures) {
      if (s.flame) {
        s.flame.scale.setScalar(0.9 + Math.sin(time * 9 + s.position.x) * 0.12);
        s.flame.rotation.y = time * 2.2;
      }
      if (s.light) s.light.intensity = 2.2 + Math.sin(time * 11 + s.position.z) * 0.35;
    }
  }
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
