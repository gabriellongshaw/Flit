import { WORLDS } from '../core/worlds.js';
import { rand, clamp, seeded, parseColor, mixColor, tintColor, toCss, luminance } from '../core/utils.js';

const PERIOD = 1600;
const CYCLE = 24000;
const WARM = parseColor('#fb923c');
const KEYS = ['skyTop', 'skyBottom', 'sun', 'cloud', 'far', 'mid', 'ground', 'groundLine', 'dust'];
const COLOR_CACHE = new Map();

function colorsFor(theme) {
  let hit = COLOR_CACHE.get(theme.id);
  if (hit) return hit;
  hit = { day: {}, night: {} };
  for (const side of ['day', 'night']) {
    for (const key of KEYS) hit[side][key] = parseColor(theme[side][key]);
  }
  COLOR_CACHE.set(theme.id, hit);
  return hit;
}

function buildScenery(theme) {
  const next = seeded(theme.seed);
  const list = [];
  let x = 0;
  while (x < PERIOD) {
    if (theme.scenery === 'peaks') {
      const w = Math.min(90 + next() * 110, PERIOD - x);
      list.push({ x, w, h: 70 + next() * 120 });
      x += w * (0.55 + next() * 0.2);
    } else if (theme.scenery === 'dunes') {
      const w = Math.min(120 + next() * 160, PERIOD - x);
      list.push({ x, w, h: 40 + next() * 70 });
      x += w * (0.6 + next() * 0.2);
    } else {
      const w = Math.min(40 + next() * 70, PERIOD - x);
      list.push({ x, w, h: 60 + next() * 130 });
      x += w + next() * 12;
    }
  }
  return list;
}

export class World {
  constructor(theme = WORLDS[0]) {
    this.w = 480;
    this.h = 420;
    this.g = 310;
    this.dist = 0;
    this.clock = 0;
    this.offset = 0;
    this.sky = 'light';
    this.onSky = null;
    this.farX = 0;
    this.midX = 0;
    this.nearX = 0;
    this.clouds = [];
    this.stars = [];
    this.key = -1;
    this.setTheme(theme);
  }

  setTheme(theme) {
    this.theme = theme;
    this.colors = colorsFor(theme);
    this.buildings = buildScenery(theme);
    this.key = -1;
    if (this.h) this.refresh();
  }

  setDark(dark) {
    this.offset = dark ? 0.5 : 0;
    this.key = -1;
    this.refresh();
  }

  restart() {
    this.dist = 0;
    this.key = -1;
    this.refresh();
  }

  resize(w, h, g) {
    this.w = w;
    this.h = h;
    this.g = g;
    this.clouds = [];
    const cloudCount = Math.ceil(w / 260) + 1;
    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push({ x: rand(0, w), y: rand(g * 0.08, g * 0.42), s: rand(0.7, 1.3) });
    }
    this.stars = [];
    const starCount = Math.ceil(w / 12);
    for (let i = 0; i < starCount; i++) {
      this.stars.push({ x: rand(0, w), y: rand(4, g * 0.62), r: rand(0.6, 1.5), ph: rand(0, 6.28) });
    }
    this.refresh();
  }

  night() {
    const c = (this.dist / CYCLE + this.offset) % 1;
    return 0.5 - 0.5 * Math.cos(c * Math.PI * 2);
  }

  refresh() {
    const key = Math.round(this.night() * 240);
    if (key === this.key) return;
    this.key = key;
    const q = key / 240;
    const dusk = 1 - Math.abs(2 * q - 1);
    const p = {};
    const raw = {};
    for (const name of KEYS) {
      let c = mixColor(this.colors.day[name], this.colors.night[name], q);
      if (name === 'skyBottom' || name === 'sun') c = tintColor(c, WARM, dusk * (name === 'sun' ? 0.25 : 0.1));
      raw[name] = c;
      p[name] = toCss(c);
    }
    this.p = p;
    this.s = q;
    const lum = luminance(mixColor(raw.skyTop, raw.skyBottom, 0.5));
    const next = lum < 0.45 ? 'dark' : lum > 0.55 ? 'light' : this.sky;
    if (next !== this.sky) {
      this.sky = next;
      if (this.onSky) this.onSky(next);
    }
  }

  bindSky(callback) {
    this.onSky = callback;
    callback(this.sky);
  }

  update(dt, speed) {
    this.clock += dt;
    this.dist += speed * dt;
    this.farX += speed * 0.06 * dt;
    this.midX += speed * 0.18 * dt;
    this.nearX += speed * dt;
    this.refresh();
    for (const c of this.clouds) {
      c.x -= (6 + speed * 0.02) * dt;
      if (c.x < -140) c.x = this.w + rand(20, 120);
    }
  }

  draw(ctx) {
    const { w, g, p, s } = this;

    const sky = ctx.createLinearGradient(0, 0, 0, g);
    sky.addColorStop(0, p.skyTop);
    sky.addColorStop(1, p.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(-30, -30, w + 60, g + 30);

    const starAlpha = clamp((s - 0.45) / 0.35, 0, 1) * 0.8;
    if (starAlpha > 0.02) {
      ctx.fillStyle = '#ffffff';
      for (const st of this.stars) {
        ctx.globalAlpha = starAlpha * (0.55 + Math.sin(this.clock * 2 + st.ph) * 0.35);
        ctx.fillRect(st.x, st.y, st.r, st.r);
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = p.sun;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(w * 0.8, g * (0.3 + 0.06 * s), 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = p.cloud;
    ctx.beginPath();
    for (const c of this.clouds) {
      ctx.roundRect(c.x, c.y, 80 * c.s, 18 * c.s, 9 * c.s);
      ctx.roundRect(c.x + 16 * c.s, c.y - 10 * c.s, 44 * c.s, 20 * c.s, 10 * c.s);
    }
    ctx.fill();

    ctx.fillStyle = p.far;
    const offset = this.farX % PERIOD;
    const kind = this.theme.scenery;
    for (let base = -offset; base < w; base += PERIOD) {
      for (const b of this.buildings) {
        const x = base + b.x;
        if (x > w) break;
        if (x + b.w < 0) continue;
        if (kind === 'peaks') {
          ctx.beginPath();
          ctx.moveTo(x, g + 2);
          ctx.lineTo(x + b.w / 2, g - b.h);
          ctx.lineTo(x + b.w, g + 2);
          ctx.closePath();
          ctx.fill();
        } else if (kind === 'dunes') {
          ctx.beginPath();
          ctx.ellipse(x + b.w / 2, g + 2, b.w / 2, b.h, 0, Math.PI, 0);
          ctx.fill();
        } else {
          ctx.fillRect(x, g - b.h, b.w, b.h + 2);
        }
      }
    }

    const [base, a1, a2, f1, f2] = this.theme.hills;
    ctx.fillStyle = p.mid;
    ctx.beginPath();
    ctx.moveTo(-10, g + 2);
    for (let x = -10; x <= w + 10; x += 10) {
      const t = x + this.midX;
      ctx.lineTo(x, g - base - Math.sin(t * f1) * a1 - Math.sin(t * f2 + 1) * a2);
    }
    ctx.lineTo(w + 10, g + 2);
    ctx.closePath();
    ctx.fill();
  }

  drawGround(ctx) {
    const { w, h, g, p } = this;
    ctx.fillStyle = p.ground;
    ctx.fillRect(-30, g, w + 60, h - g + 30);
    ctx.fillStyle = p.groundLine;
    ctx.fillRect(-30, g, w + 60, 3);
    ctx.globalAlpha = 0.3;
    const o1 = this.nearX % 90;
    for (let x = -o1; x < w; x += 90) ctx.fillRect(x, g + 22, 34, 3);
    if (g + 46 < h) {
      const o2 = (this.nearX + 45) % 90;
      for (let x = -o2; x < w; x += 90) ctx.fillRect(x, g + 46, 20, 3);
    }
    ctx.globalAlpha = 1;
  }
}