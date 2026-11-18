import { World } from '../components/world.js';
import { Bird } from '../components/bird.js';
import { fitStage } from '../components/stage.js';
import { mountSound } from '../components/sound.js';
import { mountVersion } from '../components/version.js';
import { readPalette, onThemeChange, detectTouch, isDark } from '../core/theme.js';
import { initPageFadeIn, navigateTo } from '../core/transition.js';
import { initAudio } from '../core/audio.js';
import { getBest } from '../core/storage.js';
import { clamp } from '../core/utils.js';

document.addEventListener('DOMContentLoaded', () => {
  detectTouch();
  initPageFadeIn();
  initAudio(1);
  mountSound(document.querySelector('.home-nav'));
  mountVersion(document.querySelector('.credits-container'), { href: 'https://github.com/gabriellongshaw/Flit/releases' });

  const best = getBest();
  document.getElementById('home-best').textContent = best > 0 ? `Best ${best}` : '';

  const canvas = document.getElementById('home-canvas');
  const ctx = canvas.getContext('2d');
  const world = new World();
  world.bindSky(mode => {
    document.documentElement.dataset.sky = mode;
  });
  world.setDark(isDark());
  const bird = new Bird();
  const speed = 150;
  let view;
  let palette;
  let time = 0;
  let last = performance.now();

  const hoverY = () => view.groundY - 64;

  function resize() {
    view = fitStage(canvas);
    palette = readPalette();
    world.resize(view.viewW, view.viewH, view.groundY);
    bird.x = clamp(view.viewW * 0.18, 70, 170);
    bird.y = hoverY();
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    world.update(dt, speed);
    bird.hover(dt, time, hoverY());
    ctx.setTransform(view.pxScale, 0, 0, view.pxScale, 0, 0);
    world.draw(ctx);
    world.drawGround(ctx);
    bird.draw(ctx, palette);
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  onThemeChange(() => {
    palette = readPalette();
    world.setDark(isDark());
  });
  requestAnimationFrame(frame);

  const play = document.getElementById('play-btn');
  play.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(play.getAttribute('href'));
  });
  play.addEventListener('touchstart', () => play.classList.add('hover'), { passive: true });
  play.addEventListener('touchend', () => play.classList.remove('hover'), { passive: true });
  play.addEventListener('touchcancel', () => play.classList.remove('hover'), { passive: true });
});