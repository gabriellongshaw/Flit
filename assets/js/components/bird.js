import { clamp, lerp } from '../core/utils.js';

export const BIRD_RADIUS = 12;
export const GRAVITY = 1500;
export const FLAP_SPEED = 430;
const MAX_FALL = 640;
const TILT_RATE = 12;
const WING_DECAY = 5;

export class Bird {
  constructor() {
    this.reset(90, 200);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vy = 0;
    this.tilt = 0;
    this.wing = 0;
    this.squash = 0;
    this.alive = true;
  }

  flap() {
    this.vy = -FLAP_SPEED;
    this.wing = 1;
    this.squash = 1;
  }

  animate(dt) {
    const target = clamp(this.vy / 520, -0.45, 1.2);
    this.tilt = lerp(this.tilt, target, Math.min(1, TILT_RATE * dt));
    this.wing = Math.max(0, this.wing - WING_DECAY * dt);
    this.squash = Math.max(0, this.squash - 7 * dt);
  }

  step(dt) {
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.y += this.vy * dt;
    this.animate(dt);
  }

  hover(dt, time, y) {
    this.y = y + Math.sin(time * 3) * 8;
    this.vy = Math.cos(time * 3) * 24;
    this.wing = 0.5 + 0.5 * Math.sin(time * 11);
    this.squash = 0;
    this.tilt = lerp(this.tilt, clamp(this.vy / 520, -0.45, 1.2), Math.min(1, TILT_RATE * dt));
  }

  draw(ctx, palette, color = palette.runner) {
    const stretch = this.squash * 0.1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);
    ctx.scale(1 - stretch, 1 + stretch);

    ctx.fillStyle = palette.runnerDark;
    ctx.beginPath();
    ctx.moveTo(-15, -5);
    ctx.lineTo(-27, -10);
    ctx.lineTo(-26, 2);
    ctx.lineTo(-15, 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-18, -15, 36, 30, 13);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-18, -15, 36, 30, 13);
    ctx.clip();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = palette.runnerDark;
    ctx.fillRect(-18, 5, 36, 12);
    ctx.restore();

    ctx.save();
    ctx.translate(-4, 3);
    ctx.rotate(lerp(0.3, -1, this.wing));
    ctx.fillStyle = palette.runnerDark;
    ctx.beginPath();
    ctx.ellipse(-6, 0, 11, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = palette.visor;
    ctx.beginPath();
    ctx.roundRect(1, -10, 17, 11, 5.5);
    ctx.fill();

    if (this.alive) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.roundRect(4, -8, 7, 3, 1.5);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(8, -8);
      ctx.lineTo(13, -3);
      ctx.moveTo(13, -8);
      ctx.lineTo(8, -3);
      ctx.stroke();
    }

    ctx.fillStyle = palette.scarf;
    ctx.beginPath();
    ctx.moveTo(16, 1);
    ctx.quadraticCurveTo(29, 2, 28, 7);
    ctx.quadraticCurveTo(27, 10, 16, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}