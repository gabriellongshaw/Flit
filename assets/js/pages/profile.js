import { profile } from '../core/profile.js';
import { mountAccount, signInFlow, showToast } from '../components/account.js';
import { mountSound } from '../components/sound.js';
import { detectTouch } from '../core/theme.js';
import { initGraphics } from '../core/graphics.js';
import { initPageFadeIn, navigateTo } from '../core/transition.js';
import { initAudio } from '../core/audio.js';
import { weekKey } from '../core/week.js';

const $ = id => document.getElementById(id);

const USERNAME = /^[a-z0-9_]{3,16}$/;
const ERRORS = {
  username: 'Use 3 to 16 letters, numbers or underscores.',
  taken: 'That username is taken.',
  cooldown: 'You can change your username once a day.',
  signin: 'Sign in with Google first.'
};

document.addEventListener('DOMContentLoaded', () => {
  detectTouch();
  initGraphics();
  initPageFadeIn();
  profile.init();
  initAudio(1);
  mountSound(document.querySelector('.shop-bar-right'), { first: true });
  mountAccount($('account'));

  const setMsg = (id, text, error = false) => {
    const el = $(id);
    el.textContent = text;
    el.classList.toggle('error', error);
  };

  function avatar() {
    const photo = profile.avatar;
    const name = profile.label;
    const el = document.createElement(photo ? 'img' : 'span');
    el.className = 'account-avatar';
    if (photo) {
      el.src = photo;
      el.alt = '';
      el.referrerPolicy = 'no-referrer';
    } else {
      el.textContent = (name || '?').charAt(0).toUpperCase();
    }
    return el;
  }

  async function save(action, data, msgId, okText) {
    setMsg(msgId, 'Saving…');
    try {
      await profile.update(action, data);
      setMsg(msgId, okText);
    } catch (e) {
      setMsg(msgId, ERRORS[e && e.code] || 'Could not save. Try again.', true);
    }
  }

  $('username-form').addEventListener('submit', e => {
    e.preventDefault();
    const value = $('username').value.trim().toLowerCase();
    if (!USERNAME.test(value)) return setMsg('username-msg', ERRORS.username, true);
    if (value === profile.state.username) return setMsg('username-msg', '');
    save('setUsername', { username: value }, 'username-msg', 'Saved.');
  });

  $('display-form').addEventListener('submit', e => {
    e.preventDefault();
    save('setDisplayName', { displayName: $('display').value }, 'display-msg', 'Saved.');
  });

  const seg = $('photo-seg');
  const modes = [...seg.querySelectorAll('.tab')];
  modes.forEach(btn =>
    btn.addEventListener('click', () => {
      btn.blur();
      if (btn.dataset.mode === profile.state.photoMode) return;
      profile.update('setPhoto', { mode: btn.dataset.mode }).catch(() => showToast('Could not save. Try again.'));
    })
  );

  $('board-toggle').addEventListener('click', e => {
    e.currentTarget.blur();
    profile.setPublicBoard(!profile.state.publicBoard);
  });

  $('signout').addEventListener('click', async () => {
    try {
      await profile.signOut();
    } catch {
      showToast('Could not sign out. Try again.');
    }
  });

  $('note-signin').addEventListener('click', () => signInFlow());
  $('back-btn').addEventListener('click', () => navigateTo('../'));

  let editing = '';
  function render() {
    const { status } = profile.session;
    const account = profile.ready && status === 'in';
    $('wallet').textContent = profile.state.coins;
    $('note').classList.toggle('hidden', account || status === 'loading');
    $('note-signin').classList.toggle('hidden', !(profile.ready || status === 'out'));
    $('content').classList.toggle('hidden', !account);
    if (!account) return;
    const s = profile.state;
    $('head-avatar').replaceChildren(avatar());
    $('head-name').textContent = profile.label || 'Player';
    $('head-handle').textContent = s.username ? `@${s.username}` : 'No username yet';
    $('st-best').textContent = s.best;
    $('st-week').textContent = s.weekBest.week === weekKey() ? s.weekBest.score : 0;
    $('st-runs').textContent = s.runs;
    const key = `${s.username}|${s.displayName}`;
    if (key !== editing) {
      editing = key;
      if (document.activeElement !== $('username')) $('username').value = s.username || '';
      if (document.activeElement !== $('display')) $('display').value = s.displayName || '';
    }
    const index = s.photoMode === 'none' ? 1 : 0;
    seg.style.setProperty('--i', index);
    modes.forEach((b, i) => {
      b.classList.toggle('active', i === index);
      b.setAttribute('aria-checked', i === index);
    });
    $('board-toggle').textContent = s.publicBoard ? 'Hide me from the leaderboard' : 'Show me on the leaderboard';
  }

  profile.subscribe(render);
  render();

  document.querySelectorAll('.leave-button').forEach(el => {
    el.addEventListener('touchstart', () => el.classList.add('hover'), { passive: true });
    const remove = () => el.classList.remove('hover');
    el.addEventListener('touchend', remove, { passive: true });
    el.addEventListener('touchcancel', remove, { passive: true });
  });
});