import { Bird } from './bird.js';
import { Pipe } from './pipes.js';
import { World } from './world.js';
import { paletteFor } from '../core/cosmetics.js';

export function createScene(theme, dark) {
  const world = new World(theme);
  world.setDark(dark);
  return world;
}

function setup(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return null;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

// Draws a still of someone's bird in front of a pillar and their world.
export function drawBirdTo(canvas, base, look, { scene, time = 0 } = {}) {
  const view = setup(canvas);
  if (!view) return;
  const { ctx, w, h } = view;
  const ground = h * 0.8;
  const palette = paletteFor(base, look, time);
  if (scene) {
    if (scene.w !== w || scene.h !== h) scene.resize(w, h, ground);
    scene.draw(ctx);
    const pipe = new Pipe(w * 0.72, h * 0.5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, ground);
    ctx.clip();
    pipe.draw(ctx, palette, h);
    ctx.restore();
    scene.drawGround(ctx);
  }
  const bird = new Bird();
  bird.x = w * 0.34;
  bird.y = h * 0.42;
  bird.wing = 0.4;
  bird.hat = look.hat;
  bird.draw(ctx, palette);
}