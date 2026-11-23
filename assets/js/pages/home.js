import { World } from '../components/world.js';
import { Bird } from '../components/bird.js';
import { fitStage } from '../components/stage.js';
import { mountSound } from '../components/sound.js';
import { mountVersion } from '../components/version.js';
import { readPalette, onThemeChange, detectTouch, isDark } from '../core/theme.js';
import { initGraphics } from '../core/graphics.js';
import { initPageFadeIn, navigateTo } from '../core/transition.js';
import { initAudio } from '../core/audio.js';
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
  mountVersion(document.querySelector('.credits-container'), { href: 'announcements/', inline: true });

  const bestEl = document.getElementById('home-best');
  const showStats = () => {
    const best = profile.bestScore;
    const { coins } = profile.state;
    bestEl.textContent = best > 0 || coins > 0 ? `Best ${best} · ${coins} coins` : '';
  };
  const badge = document.getElementById('quests-badge');
  const showBadge = () => {
    const ready = profile.readyQuests();
    badge.textContent = ready;
    badge.classList.toggle('hidden', ready === 0);
  };
  const friendsBadge = document.getElementById('friends-badge');
  let socialFetched = false;
  const showFriendsBadge = async () => {
    const { status, syncing } = profile.session;
    if (status !== 'in') {
      socialFetched = false;
      friendsBadge.classList.add('hidden');
      return;
    }
    if (syncing || socialFetched || !profile.social) return;
    socialFetched = true;
    try {
      const out = await profile.api('social');
      const waiting = out.incoming.length + out.gifts.length;
      friendsBadge.textContent = waiting;
      friendsBadge.classList.toggle('hidden', waiting === 0);
    } catch {
      socialFetched = false;
    }
  };
  profile.subscribe(showFriendsBadge);
  profile.subscribe(showStats);
  profile.subscribe(showBadge);
  profile.refreshQuests();
  showStats();
  showBadge();

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

  for (const link of document.querySelectorAll('#play-btn, #shop-btn, #quests-btn, #board-btn, #friends-btn, #polls-btn, #announcements-btn')) {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.getAttribute('href'));
    });
    link.addEventListener('touchstart', () => link.classList.add('hover'), { passive: true });
    link.addEventListener('touchend', () => link.classList.remove('hover'), { passive: true });
    link.addEventListener('touchcancel', () => link.classList.remove('hover'), { passive: true });
  }
});