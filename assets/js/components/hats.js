const dome = (ctx, color, r, h) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.quadraticCurveTo(-r, -h, 0, -h);
  ctx.quadraticCurveTo(r, -h, r, 0);
  ctx.closePath();
  ctx.fill();
};

const circle = (ctx, color, x, y, r) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

const tri = (ctx, color, a, b, c) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.closePath();
  ctx.fill();
};

const box = (ctx, color, x, y, w, h, r = 0) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

const oval = (ctx, color, x, y, rx, ry, rot = 0) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
};

const stroke = (ctx, color, width) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
};

const HATS = {
  beanie(ctx) {
    dome(ctx, '#ef4444', 15, 20);
    box(ctx, '#b91c1c', -16, -5, 32, 6, 3);
    circle(ctx, '#ffffff', 0, -21, 4);
  },
  cap(ctx) {
    dome(ctx, '#2563eb', 14, 17);
    oval(ctx, '#1d4ed8', 14, -1, 10, 3);
  },
  party(ctx) {
    tri(ctx, '#a855f7', [-11, 0], [11, 0], [0, -26]);
    circle(ctx, '#fde047', -3, -9, 2);
    circle(ctx, '#fde047', 3, -15, 2);
    circle(ctx, '#fde047', 0, -27, 3.5);
  },
  catears(ctx) {
    tri(ctx, '#374151', [-15, 0], [-13, -15], [-3, -2]);
    tri(ctx, '#374151', [15, 0], [13, -15], [3, -2]);
    tri(ctx, '#f9a8d4', [-12, -2], [-12, -10], [-6, -3]);
    tri(ctx, '#f9a8d4', [12, -2], [12, -10], [6, -3]);
  },
  headphones(ctx) {
    stroke(ctx, '#1f2937', 3.5);
    ctx.beginPath();
    ctx.arc(0, 2, 15, Math.PI, Math.PI * 2);
    ctx.stroke();
    box(ctx, '#ef4444', -20, 0, 7, 11, 3);
    box(ctx, '#ef4444', 13, 0, 7, 11, 3);
  },
  chef(ctx) {
    box(ctx, '#ffffff', -12, -8, 24, 10, 2);
    circle(ctx, '#ffffff', -8, -12, 7);
    circle(ctx, '#ffffff', 0, -16, 8);
    circle(ctx, '#ffffff', 8, -12, 7);
    box(ctx, '#e5e7eb', -12, -2, 24, 3, 1);
  },
  halo(ctx) {
    stroke(ctx, '#facc15', 3);
    ctx.beginPath();
    ctx.ellipse(0, -11, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
  tophat(ctx) {
    box(ctx, '#111827', -17, -3, 34, 4, 2);
    box(ctx, '#111827', -10, -21, 20, 19, 2);
    box(ctx, '#ef4444', -10, -9, 20, 4);
  },
  cowboy(ctx) {
    oval(ctx, '#92400e', 0, -2, 21, 5);
    dome(ctx, '#a16207', 9, 14);
    box(ctx, '#78350f', -9, -6, 18, 3);
  },
  wizard(ctx) {
    oval(ctx, '#4c1d95', 0, -1, 16, 3.5);
    tri(ctx, '#6d28d9', [-11, -1], [11, -1], [3, -31]);
    circle(ctx, '#fde047', -1, -12, 2.5);
    circle(ctx, '#fde047', 3, -20, 1.8);
  },
  crown(ctx) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-13, -14);
    ctx.lineTo(-6.5, -7);
    ctx.lineTo(0, -16);
    ctx.lineTo(6.5, -7);
    ctx.lineTo(13, -14);
    ctx.lineTo(13, 0);
    ctx.closePath();
    ctx.fill();
    circle(ctx, '#ef4444', 0, -5, 2.4);
    circle(ctx, '#38bdf8', -7, -4, 1.8);
    circle(ctx, '#38bdf8', 7, -4, 1.8);
  },
  bow(ctx) {
    tri(ctx, '#ec4899', [0, -5], [-14, -13], [-14, 3]);
    tri(ctx, '#ec4899', [0, -5], [14, -13], [14, 3]);
    circle(ctx, '#be185d', 0, -5, 3.6);
  },
  flower(ctx) {
    stroke(ctx, '#16a34a', 2.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -9);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      circle(ctx, '#fb7185', Math.cos(a) * 5, -14 + Math.sin(a) * 5, 3.6);
    }
    circle(ctx, '#fde047', 0, -14, 3);
  },
  propeller(ctx) {
    dome(ctx, '#38bdf8', 12, 12);
    stroke(ctx, '#1f2937', 2);
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(0, -16);
    ctx.stroke();
    oval(ctx, '#ef4444', -7, -17, 7, 2);
    oval(ctx, '#fde047', 7, -17, 7, 2);
  },
  antennae(ctx) {
    stroke(ctx, '#374151', 2);
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-9, -14);
    ctx.moveTo(5, 0);
    ctx.lineTo(9, -14);
    ctx.stroke();
    circle(ctx, '#fde047', -9, -15, 3.2);
    circle(ctx, '#fde047', 9, -15, 3.2);
  },
  santa(ctx) {
    tri(ctx, '#dc2626', [-14, 0], [14, 0], [8, -22]);
    box(ctx, '#ffffff', -15, -4, 30, 6, 3);
    circle(ctx, '#ffffff', 8, -22, 4);
  },
  bunny(ctx) {
    oval(ctx, '#ffffff', -6, -13, 3.8, 11, -0.15);
    oval(ctx, '#ffffff', 6, -13, 3.8, 11, 0.15);
    oval(ctx, '#f9a8d4', -6, -13, 1.8, 8, -0.15);
    oval(ctx, '#f9a8d4', 6, -13, 1.8, 8, 0.15);
  }
};

export function drawHat(ctx, id) {
  const name = typeof id === 'string' ? id.slice(4) : '';
  const draw = HATS[name];
  if (!draw) return;
  ctx.save();
  ctx.translate(1, -13);
  ctx.scale(0.8, 0.8);
  draw(ctx);
  ctx.restore();
}
