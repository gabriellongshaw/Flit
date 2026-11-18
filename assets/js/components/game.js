import { Bird, BIRD_RADIUS } from './bird.js';
import { World } from './world.js';
import { Spawner, PIPE_WIDTH } from './pipes.js';
import { Particles } from './particles.js';
import { fitStage } from './stage.js';
import { readPalette, isDark } from '../core/theme.js';
import { clamp } from '../core/utils.js';
import { audio } from '../core/audio.js';

const STEP = 1 / 120;
const BASE_SPEED = 150;
const SPEED_PER_POINT = 2.5;
const MAX_BOOST = 40;
const IDLE_SPEED = 110;

const touches = (box, x, y, r) => {
  const nx = clamp(x, box.x, box.x + box.w);
  const ny = clamp(y, box.y, box.y + box.h);
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy < r * r;
};

export class Game {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.best = hooks.best || 0;
    this.world = new World();
    this.world.bindSky(mode => {
      document.documentElement.dataset.sky = mode;
    });
    this.world.setDark(isDark());
    this.palette = readPalette();
    this.bird = new Bird();
    this.spawner = new Spawner();
    this.particles = new Particles();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.last = 0;
    this.state = 'ready';
    this.frame = this.frame.bind(this);
    this.resize();
    this.reset();
    requestAnimationFrame(t => {
      this.last = t;
      this.frame(t);
    });
  }

  resize() {
    const view = fitStage(this.canvas);
    this.viewW = view.viewW;
    this.viewH = view.viewH;
    this.groundY = view.groundY;
    this.pxScale = view.pxScale;
    this.bird.x = clamp(this.viewW * 0.28, 80, 220);
    if (this.state === 'ready') this.bird.y = this.hoverY();
    this.world.resize(this.viewW, this.viewH, this.groundY);
  }

  hoverY() {
    return this.groundY * 0.46;
  }

  setPalette() {
    this.palette = readPalette();
    this.world.setDark(isDark());
  }

  reset() {
    this.score = -1;
    this.flaps = 0;
    this.speed = BASE_SPEED;
    this.shake = 0;
    this.flash = 0;
    this.particles.clear();
    this.world.restart();
    this.spawner.reset();
    this.bird.reset(this.bird.x, this.hoverY());
    this.state = 'ready';
    this.emitScore(0);
  }

  start() {
    this.reset();
    this.state = 'playing';
    this.flap();
  }

  pause() {
    if (this.state !== 'playing') return false;
    this.state = 'paused';
    return true;
  }

  resume() {
    if (this.state === 'paused') this.state = 'playing';
  }

  flap() {
    if (this.state !== 'playing') return;
    this.bird.flap();
    this.flaps++;
    audio.sfx('flap');
    this.particles.emit(this.bird.x - 14, this.bird.y + 8, 3, {
      a0: Math.PI * 0.55,
      a1: Math.PI * 0.95,
      s0: 30,
      s1: 90,
      l0: 0.25,
      l1: 0.45,
      z0: 2,
      z1: 3.5,
      color: this.world.p.dust,
      vx: -this.speed * 0.3
    });
  }

  emitScore(value) {
    if (value === this.score) return;
    this.score = value;
    this.hooks.onScore(value);
  }

  die() {
    this.state = 'over';
    audio.sfx('hit');
    this.bird.alive = false;
    this.shake = this.reducedMotion ? 0 : 1;
    this.flash = this.reducedMotion ? 0 : 1;
    const burst = { s0: 120, s1: 380, l0: 0.5, l1: 1, z0: 3, z1: 7, gravity: 900 };
    this.particles.emit(this.bird.x, this.bird.y, 22, { ...burst, color: this.palette.runner });
    this.particles.emit(this.bird.x, this.bird.y, 8, { ...burst, color: this.palette.scarf });
    try {
      navigator.vibrate?.(40);
    } catch {}
    const isBest = this.score > this.best;
    if (isBest) this.best = this.score;
    this.hooks.onOver({ score: this.score, best: this.best, isBest, flaps: this.flaps });
  }

  tick(h) {
    const bird = this.bird;
    if (this.state === 'ready') {
      this.world.update(h, IDLE_SPEED);
      bird.hover(h, this.time, this.hoverY());
      return;
    }
    if (this.state === 'over') {
      if (bird.y + BIRD_RADIUS < this.groundY) {
        bird.step(h);
        if (bird.y + BIRD_RADIUS >= this.groundY) {
          bird.y = this.groundY - BIRD_RADIUS;
          bird.vy = 0;
        }
      }
      return;
    }
    if (this.state !== 'playing') return;

    this.speed = BASE_SPEED + Math.min(this.score, MAX_BOOST) * SPEED_PER_POINT;
    this.world.update(h, this.speed);
    bird.step(h);
    this.spawner.update(h, this.speed, this.viewW, this.groundY);

    if (bird.y - BIRD_RADIUS < 0) {
      bird.y = BIRD_RADIUS;
      if (bird.vy < 0) bird.vy = 0;
    }
    if (bird.y + BIRD_RADIUS >= this.groundY) {
      bird.y = this.groundY - BIRD_RADIUS;
      this.die();
      return;
    }
    for (const pipe of this.spawner.pipes) {
      for (const box of pipe.boxes(this.groundY)) {
        if (touches(box, bird.x, bird.y, BIRD_RADIUS)) {
          this.die();
          return;
        }
      }
    }
    for (const pipe of this.spawner.pipes) {
      if (!pipe.passed && pipe.x + PIPE_WIDTH / 2 < bird.x) {
        pipe.passed = true;
        audio.sfx('point');
        this.emitScore(this.score + 1);
      }
    }
  }

  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    if (this.state !== 'paused') {
      this.time += dt;
      const steps = Math.max(1, Math.ceil(dt / STEP));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) this.tick(h);
      this.particles.update(dt);
      this.shake = Math.max(0, this.shake - dt * 2.5);
      this.flash = Math.max(0, this.flash - dt * 4);
    }
    this.draw();
    requestAnimationFrame(this.frame);
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.pxScale, 0, 0, this.pxScale, 0, 0);
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake * 10, (Math.random() - 0.5) * this.shake * 10);
    }
    this.world.draw(ctx);
    this.spawner.draw(ctx, this.palette, this.groundY);
    this.world.drawGround(ctx);
    this.particles.draw(ctx);
    this.bird.draw(ctx, this.palette);
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-30, -30, this.viewW + 60, this.viewH + 60);
      ctx.globalAlpha = 1;
    }
  }
}