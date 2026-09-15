import * as THREE from '../vendor/three.module.js';
import { WEATHERS } from './data.js';

const HOUR_SECONDS = 26;          // 现实 1 秒 = 游戏 1/26 小时 → 一天约 10.4 分钟
const DAY_START = 6.2;

export class Environment {
  constructor(scene, renderer, opts = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.hour = DAY_START;
    this.day = 1;
    this.weatherId = 'clear';
    this.weather = WEATHERS.clear;
    this.weatherTimer = 60 + Math.random() * 60;
    this.isNight = false;
    this.lightningTimer = 6 + Math.random() * 8;
    this.flash = 0;
    this.skyColor = new THREE.Color(WEATHERS.clear.sky);

    this.ambient = new THREE.AmbientLight(0xd8e4f0, 0.6);
    scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 3.4);
    this.sun.position.set(60, 90, 30);
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe4f2, 0x4a5a3a, 1.35);
    scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x8fa8d8, 0.0);
    this.moon.position.set(-50, 70, -40);
    scene.add(this.moon);

    scene.fog = new THREE.FogExp2(this.skyColor.getHex(), this.weather.fog);
    scene.background = this.skyColor;

    this.buildSky();
    this.rainCount = opts.rainCount || 2600;
    this.buildRain();
  }

  buildSky() {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x4f7fc8) },
        bottomColor: { value: new THREE.Color(0xd6e4ef) },
      },
      vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform vec3 topColor; uniform vec3 bottomColor; varying float vY;',
        'void main(){',
        '  float t = clamp(vY * 1.15 + 0.22, 0.0, 1.0);',
        '  vec3 c = mix(bottomColor, topColor, t);',
        '  gl_FragColor = vec4(c, 1.0);',
        '}',
      ].join('\n'),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  buildRain() {
    const count = this.rainCount;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 46;
      pos[i * 3 + 1] = Math.random() * 24;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 46;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xbcd4e6, size: 0.09, transparent: true, opacity: 0.0, depthWrite: false });
    this.rain = new THREE.Points(geo, mat);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  rollWeather() {
    const table = [
      ['clear', 0.4], ['cloudy', 0.24], ['rain', 0.2], ['fog', 0.11], ['storm', 0.05],
    ];
    const roll = Math.random();
    let acc = 0, chosen = 'clear';
    for (const [id, w] of table) {
      acc += w;
      if (roll <= acc) { chosen = id; break; }
    }
    if (chosen === this.weatherId && chosen !== 'clear') chosen = 'cloudy';
    this.weatherId = chosen;
    this.weather = WEATHERS[chosen];
    this.weatherTimer = 80 + Math.random() * 110;
    return chosen;
  }

  update(dt, cameraPos) {
    this.hour += dt / HOUR_SECONDS;
    if (this.hour >= 24) { this.hour -= 24; this.day += 1; }
    this.isNight = this.hour < 5.6 || this.hour > 19.4;

    this.weatherTimer -= dt;
    let changed = null;
    if (this.weatherTimer <= 0) changed = this.rollWeather();

    // 太阳/月亮
    const sunAngle = ((this.hour - 6) / 12) * Math.PI;
    const sunUp = Math.sin(sunAngle);
    this.sun.position.set(Math.cos(sunAngle) * 90, Math.max(-10, sunUp * 100), 40);
    this.sun.intensity = Math.max(0, sunUp) * 3.4 * this.weather.light;
    this.moon.intensity = this.isNight ? 0.85 : 0;
    this.hemi.intensity = (this.isNight ? 0.55 : 1.35) * this.weather.light + this.flash * 0.8;
    this.ambient.intensity = (this.isNight ? 0.32 : 0.6) + this.flash * 0.5;

    // 天空色：昼→昏→夜
    const baseDay = new THREE.Color(0x9dc6e8);
    const dusk = new THREE.Color(0xd88a52);
    const night = new THREE.Color(0x1b2436);
    const weatherCol = new THREE.Color(this.weather.sky);
    let target;
    if (sunUp > 0.25) target = baseDay.clone().lerp(weatherCol, 0.55);
    else if (sunUp > -0.1) target = dusk.clone().lerp(weatherCol, 0.4);
    else target = night.clone().lerp(weatherCol, 0.25);
    this.skyColor.lerp(target, Math.min(1, dt * 0.6));
    if (this.flash > 0) this.skyColor.lerp(new THREE.Color(0xdfe8ff), this.flash);
    this.scene.background = this.skyColor;
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.skyColor);
      this.scene.fog.density = this.weather.fog;
    }

    // 天穹渐变：日/昏/夜三套配色，再叠一层天气色
    if (this.sky) {
      this.sky.position.copy(cameraPos);
      const u = this.sky.material.uniforms;
      let top, bottom;
      if (sunUp > 0.25) { top = new THREE.Color(0x4a7fd0); bottom = new THREE.Color(0xd8e6f2); }
      else if (sunUp > -0.12) { top = new THREE.Color(0x3f4f8a); bottom = new THREE.Color(0xe0a878); }
      else { top = new THREE.Color(0x0d1428); bottom = new THREE.Color(0x2a3550); }
      const tint = new THREE.Color(this.weather.sky);
      top.lerp(tint, 0.45);
      bottom.lerp(tint, 0.55);
      u.topColor.value.copy(top);
      u.bottomColor.value.copy(bottom);
    }

    // 闪电
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.weather.lightning) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 4 + Math.random() * 9;
        this.flash = 0.85;
      }
    }

    // 雨
    const rainOn = this.weather.rain > 0;
    this.rain.visible = rainOn;
    if (rainOn) {
      this.rain.material.opacity = Math.min(0.55, 0.2 * this.weather.rain);
      this.rain.position.set(cameraPos.x, cameraPos.y - 6, cameraPos.z);
      const pos = this.rain.geometry.attributes.position;
      const speed = 22 * this.weather.rain;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - speed * dt;
        if (y < 0) y += 24;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    return { hour: this.hour, day: this.day, isNight: this.isNight, weather: this.weather, changed };
  }

  setTime(hour, day) {
    if (typeof hour === 'number') this.hour = hour;
    if (typeof day === 'number') this.day = day;
    this.isNight = this.hour < 5.6 || this.hour > 19.4;
  }

  sleepToMorning() {
    this.day += this.hour > 12 ? 1 : 0;
    this.hour = 6.4;
    this.isNight = false;
  }
}
