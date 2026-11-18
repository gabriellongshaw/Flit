const VIEW_H = 480;
const VIEW_W = 320;
const MAX_SCALE = 2.4;

export function fitStage(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const scale = Math.min(ch / VIEW_H, cw / VIEW_W, MAX_SCALE);
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const viewH = ch / scale;
  return {
    viewW: cw / scale,
    viewH,
    groundY: Math.round(viewH * 0.78),
    pxScale: dpr * scale
  };
}