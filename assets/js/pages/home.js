import { World } from '../components/world.js';
import { Bird } from '../components/bird.js';
import { fitStage } from '../components/stage.js';
import { mountSound } from '../components/sound.js';
import { mountVersion } from '../components/version.js';
import { readPalette, onThemeChange, detectTouch, isDark } from '../core/theme.js';
import { initGraphics } from '../core/graphics.js';
import { initPageFadeIn, navigateTo } from '../core/transition.js';
import { initAudio } from '../core/audio.js';
import { getBest } from '../core/storage.js';
import { clamp } from '../core/utils.js';
import { paletteFor } from '../core/cosmetics.js';
import { profile } from '../core/profile.js';
import { mountAccount } from '../components/account.js';
import { currentLook } from '../components/look.js';

document.addEventListener('DOMContentLoaded', () => {
  detectTouch();
  initGraphics();
  initPageFadeIn();
  initAudio(1);
  profile.init();
  mountAccount(document.getElementById('account'), './');
  mountSound(document.querySelector('.home-nav'));
  mountVersion(document.querySelector('.credits-container'), { href: 'https://github.com/gabriellongshaw/Flit/releases' });

  const best = getBest();
  document.getElementById('home-best').textContent = best > 0 ? `Best ${best}` : '';

  const canvas = document.getElementById('home-canvas');
  const ctx = canvas.getContext('2d');
  let look = currentLook();
  const world = new World(look.world);
  world.bindSky(mode => {
    document.documentElement.dataset.sky = mode;
  });
  world.setDark(isDark());
  const bird = new Bird();
  bird.hat = look.hat;
  let basePalette;
  const speed = 150;
  let view;
  let palette;
  let time = 0;
  let last = performance.now();

  const hoverY = () => view.groundY - 64;

  function resize() {
    view = fitStage(canvas);
    basePalette = readPalette();
    palette = paletteFor(basePalette, look);
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
    bird.draw(ctx, look.skin.rainbow ? paletteFor(basePalette, look, time) : palette);
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  profile.subscribe(() => {
    const next = currentLook();
    if (JSON.stringify(next) === JSON.stringify(look)) return;
    look = next;
    world.setTheme(look.world);
    bird.hat = look.hat;
    basePalette = readPalette();
    palette = paletteFor(basePalette, look);
  });
  onThemeChange(() => {
    basePalette = readPalette();
    palette = paletteFor(basePalette, look);
    world.setDark(isDark());
  });
  requestAnimationFrame(frame);

  for (const id of ['play-btn', 'shop-btn', 'board-btn']) {
    const link = document.getElementById(id);
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.getAttribute('href'));
    });
    link.addEventListener('touchstart', () => link.classList.add('hover'), { passive: true });
    link.addEventListener('touchend', () => link.classList.remove('hover'), { passive: true });
    link.addEventListener('touchcancel', () => link.classList.remove('hover'), { passive: true });
  }
});