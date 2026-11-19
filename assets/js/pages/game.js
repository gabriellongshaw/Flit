import { Game } from '../components/game.js';
import { mountSound } from '../components/sound.js';
import { onThemeChange, detectTouch } from '../core/theme.js';
import { initPageFadeIn, navigateTo } from '../core/transition.js';
import { countTo, hideEl, showEl } from '../core/motion.js';
import { initAudio, audio } from '../core/audio.js';
import { getBest, saveBest } from '../core/storage.js';
import { profile } from '../core/profile.js';

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  detectTouch();
  initPageFadeIn();
  initAudio(0.6);
  profile.init();
  $('pause-btn').before(mountSound(document.querySelector('.hud-right'), { className: 'icon-button' }));

  const coinPill = $('coin-pill');
  const coinEl = $('coin-count');
  const showCoins = extra => {
    coinPill.classList.toggle('hidden', !profile.ready);
    coinEl.textContent = profile.state.coins + extra;
  };
  profile.subscribe(() => {
    if (game.state !== 'playing' && game.state !== 'paused') showCoins(0);
  });

  const scoreEl = $('score');
  const bestEl = $('best');
  const hint = $('start-hint');
  const pauseOverlay = $('pause-overlay');
  const overOverlay = $('over-overlay');
  let overReady = false;
  let overTimer = 0;

  bestEl.textContent = `Best ${getBest()}`;

  const game = new Game($('game-canvas'), {
    best: getBest(),
    onScore(score) {
      scoreEl.textContent = score;
      if (score > 0 && game.state === 'playing') showCoins(score);
      if (score > 0) {
        scoreEl.classList.remove('bump');
        void scoreEl.offsetWidth;
        scoreEl.classList.add('bump');
      }
    },
    onOver(result) {
      if (result.isBest) saveBest(result.best);
      const earned = profile.recordRun({ score: result.score, flaps: result.flaps }) ? result.score : 0;
      bestEl.textContent = `Best ${result.best}`;
      audio.duck(0.2);
      $('over-score').textContent = result.score;
      $('over-best').textContent = result.best;
      $('over-coins').textContent = earned;
      $('over-badge').classList.toggle('hidden', !result.isBest);
      overReady = false;
      overTimer = setTimeout(() => {
        showEl(overOverlay);
        if (result.isBest) audio.sfx('best');
        overReady = true;
        countTo($('over-score'), result.score, { duration: 650 });
        countTo($('over-best'), result.best, { duration: 650 });
        countTo($('over-coins'), earned, { duration: 650 });
      }, 600);
    }
  });

  function startRun() {
    clearTimeout(overTimer);
    overReady = false;
    hideEl(hint);
    hideEl(pauseOverlay);
    hideEl(overOverlay);
    audio.duck(0.6);
    profile.beginRun();
    game.start();
    showCoins(0);
  }

  function pauseGame() {
    if (game.pause()) {
      showEl(pauseOverlay);
      audio.duck(0.25);
    }
  }

  const countdown = $('countdown');
  const countdownNum = $('countdown-num');
  const COUNT_FROM = 3;
  const COUNT_STEP = 800;
  let counting = false;
  let countTimer = 0;

  function stopCountdown() {
    clearTimeout(countTimer);
    counting = false;
    countdown.classList.add('hidden');
  }

  function resumeGame() {
    if (counting || game.state !== 'paused') return;
    hideEl(pauseOverlay);
    counting = true;
    countdown.classList.remove('hidden');
    let n = COUNT_FROM;
    const step = () => {
      if (n === 0) {
        stopCountdown();
        audio.duck(0.6);
        game.resume();
        return;
      }
      countdownNum.textContent = n;
      countdownNum.style.animation = 'none';
      void countdownNum.offsetWidth;
      countdownNum.style.animation = '';
      audio.sfx('click');
      n -= 1;
      countTimer = setTimeout(step, COUNT_STEP);
    };
    step();
  }

  function cancelCountdown() {
    stopCountdown();
    showEl(pauseOverlay);
  }

  function togglePause() {
    if (counting) cancelCountdown();
    else if (game.state === 'paused') resumeGame();
    else pauseGame();
  }

  function action() {
    if (game.state === 'ready') startRun();
    else if (game.state === 'playing') game.flap();
    else if (game.state === 'over' && overReady) startRun();
  }

  $('game-canvas').addEventListener('pointerdown', e => {
    e.preventDefault();
    action();
  });

  window.addEventListener('keydown', e => {
    const flapKey = e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
    if (flapKey) e.preventDefault();
    if (e.repeat) return;
    if (flapKey) {
      if (game.state === 'paused') resumeGame();
      else action();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      togglePause();
    } else if (e.code === 'Enter' && game.state === 'over' && overReady) {
      startRun();
    }
  });

  $('pause-btn').addEventListener('click', e => {
    e.currentTarget.blur();
    togglePause();
  });

  $('resume-btn').addEventListener('click', e => {
    e.currentTarget.blur();
    resumeGame();
  });

  $('again-btn').addEventListener('click', e => {
    e.currentTarget.blur();
    if (overReady) startRun();
  });

  ['menu-btn', 'quit-btn', 'over-menu-btn'].forEach(id => {
    $(id).addEventListener('click', () => navigateTo('../'));
  });

  document.querySelectorAll('.button, .secondary-button, .leave-button, .icon-button').forEach(el => {
    el.addEventListener('touchstart', () => el.classList.add('hover'), { passive: true });
    const remove = () => el.classList.remove('hover');
    el.addEventListener('touchend', remove, { passive: true });
    el.addEventListener('touchcancel', remove, { passive: true });
  });

  window.addEventListener('resize', () => game.resize());
  let lookKey = JSON.stringify(profile.state.equipped);
  profile.subscribe(() => {
    const next = JSON.stringify(profile.state.equipped);
    if (next === lookKey) return;
    lookKey = next;
    if (game.state === 'ready') game.setLook();
  });
  showCoins(0);
  onThemeChange(() => game.setPalette());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (counting) cancelCountdown();
    else pauseGame();
  });
  document.addEventListener('contextmenu', e => e.preventDefault());
});