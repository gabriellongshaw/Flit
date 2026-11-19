import { clamp, rand } from '../core/utils.js';

export const PIPE_WIDTH = 62;
export const CAP_WIDTH = 74;
const CAP_HEIGHT = 24;
const CAP_OVERHANG = (CAP_WIDTH - PIPE_WIDTH) / 2;
export const GAP = 150;
const MARGIN = 48;
const SPACING_TIME = 1.5;
const FIRST_OFFSET = 160;
const SPAWN_OFFSET = 40;
const TOP = -60;

export class Pipe {
  constructor(x, gapY) {
    this.x = x;
    this.gapY = gapY;
    this.passed = false;
  }

  boxes(ground) {
    const top = this.gapY - GAP / 2;
    const bottom = this.gapY + GAP / 2;
    return [
      { x: this.x, y: TOP, w: PIPE_WIDTH, h: top - CAP_HEIGHT - TOP },
      { x: this.x - CAP_OVERHANG, y: top - CAP_HEIGHT, w: CAP_WIDTH, h: CAP_HEIGHT },
      { x: this.x, y: bottom + CAP_HEIGHT, w: PIPE_WIDTH, h: ground - bottom - CAP_HEIGHT },
      { x: this.x - CAP_OVERHANG, y: bottom, w: CAP_WIDTH, h: CAP_HEIGHT }
    ];
  }

  draw(ctx, p, ground) {
    const [topBody, topCap, bottomBody, bottomCap] = this.boxes(ground + 4);
    for (const box of [topBody, bottomBody]) {
      ctx.fillStyle = p.hazard;
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, 4);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = p.hazardLight;
      ctx.fillRect(box.x + 7, box.y, 7, box.h);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = p.hazardDark;
      ctx.fillRect(box.x + box.w - 15, box.y, 11, box.h);
      ctx.globalAlpha = 1;
    }
    for (const box of [topCap, bottomCap]) {
      ctx.fillStyle = p.hazard;
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, 8);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = p.hazardLight;
      ctx.beginPath();
      ctx.roundRect(box.x + 7, box.y + 4, 8, box.h - 8, 3);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = p.hazardDark;
      ctx.beginPath();
      ctx.roundRect(box.x + box.w - 15, box.y + 4, 11, box.h - 8, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

export class Spawner {
  constructor() {
    this.pipes = [];
    this.lastY = null;
    this.count = 0;
  }

  reset() {
    this.pipes = [];
    this.lastY = null;
    this.count = 0;
  }

  spawn(x, ground) {
    const low = MARGIN + GAP / 2;
    const high = ground - MARGIN - GAP / 2;
    const reach = 60 + Math.min(this.count, 20) * 6;
    const from = this.lastY === null ? (low + high) / 2 : this.lastY;
    const y = clamp(from + rand(-reach, reach), low, Math.max(low, high));
    this.lastY = y;
    this.count++;
    this.pipes.push(new Pipe(x, y));
  }

  update(dt, speed, viewW, ground) {
    for (const pipe of this.pipes) pipe.x -= speed * dt;
    while (this.pipes.length && this.pipes[0].x + CAP_WIDTH < -10) this.pipes.shift();
    const last = this.pipes[this.pipes.length - 1];
    if (!last) this.spawn(viewW + FIRST_OFFSET, ground);
    else if (last.x <= viewW + SPAWN_OFFSET - speed * SPACING_TIME) this.spawn(viewW + SPAWN_OFFSET, ground);
  }

  draw(ctx, palette, ground) {
    for (const pipe of this.pipes) pipe.draw(ctx, palette, ground);
  }
}