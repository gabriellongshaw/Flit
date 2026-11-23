import { profile } from '../core/profile.js';
import { msUntilReset } from '../core/week.js';
import { mountAccount, signInFlow } from '../components/account.js';
import { mountSound } from '../components/sound.js';
import { detectTouch } from '../core/theme.js';
import { initGraphics } from '../core/graphics.js';
import { initPageFadeIn, navigateTo } from '../core/transition.js';
import { initAudio } from '../core/audio.js';
import { setCoins, setShown } from '../core/motion.js';
import { colourFor } from '../components/avatar.js';
import { mountVersion } from '../components/version.js';

const $ = id => document.getElementById(id);
const CACHE_MS = 30000;

function formatTime(ms) {
  const mins = Math.ceil(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${Math.max(1, mins % 60)}m`;
}

document.addEventListener('DOMContentLoaded', () => {
  detectTouch();
  initGraphics();
  initPageFadeIn();
  profile.init();
  initAudio(1);
  mountSound(document.querySelector('.shop-bar-right'), { first: true });
  mountAccount($('account'));
  mountVersion(document.querySelector('.shop-inner'), { href: '../announcements/' });

  const list = $('rank-list');
  const visibility = $('visibility-btn');
  let scope = 'week';
  let token = 0;
  const cache = {};

  function row(entry, rank, index, me) {
    const el = document.createElement('div');
    el.className = 'rank-row' + (rank <= 3 ? ` top-${rank}` : '') + (me ? ' me' : '');
    el.style.setProperty('--n', index);
    const pos = document.createElement('span');
    pos.className = 'rank-pos';
    pos.textContent = rank;
    const initial = () => {
      const span = document.createElement('span');
      span.className = 'rank-avatar';
      span.style.background = colourFor(entry.uid || entry.name || '');
      span.textContent = (entry.name || '?').charAt(0).toUpperCase();
      return span;
    };
    let avatar = initial();
    if (entry.photo) {
      avatar = document.createElement('img');
      avatar.className = 'rank-avatar';
      avatar.src = entry.photo;
      avatar.alt = '';
      avatar.referrerPolicy = 'no-referrer';
      avatar.addEventListener('error', () => avatar.replaceWith(initial()));
    }
    const name = document.createElement('span');
    name.className = 'rank-name';
    name.textContent = entry.name;
    if (me) {
      const you = document.createElement('span');
      you.className = 'rank-you';
      you.textContent = 'You';
      name.appendChild(you);
    }
    const score = document.createElement('span');
    score.className = 'rank-score';
    score.textContent = entry.score;
    el.append(pos, avatar, name, score);
    if (entry.uid) {
      const open = () => navigateTo(me ? '../profile/' : `../profile/?id=${encodeURIComponent(entry.uid)}`);
      el.classList.add('link');
      el.tabIndex = 0;
      el.setAttribute('role', 'link');
      el.addEventListener('click', open);
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') open();
      });
    }
    return el;
  }

  let shown = { scope: '', uid: '', kind: '', sig: '' };
  const inflight = {};

  function message(text, retry) {
    shown = { scope: '', uid: '', kind: 'message', sig: '' };
    list.replaceChildren();
    const p = document.createElement('p');
    p.className = 'quest-empty';
    p.textContent = text;
    list.appendChild(p);
    if (retry) {
      const btn = document.createElement('button');
      btn.className = 'tertiary-button';
      btn.textContent = 'Try again';
      btn.addEventListener('click', () => load(true));
      list.appendChild(btn);
    }
  }

  function skeleton() {
    if (shown.kind === 'skeleton') return;
    shown = { scope: '', uid: '', kind: 'skeleton', sig: '' };
    list.replaceChildren();
    for (let i = 0; i < 6; i++) {
      const el = row({ name: '        ', score: '0000' }, i + 1, i, false);
      el.classList.add('skeleton');
      list.appendChild(el);
    }
  }

  function render(data, name) {
    const sig = JSON.stringify(data);
    const uid = String(profile.state.uid);
    if (shown.kind === 'rows' && shown.scope === name && shown.uid === uid && shown.sig === sig) return;
    shown = { scope: name, uid, kind: 'rows', sig };
    list.replaceChildren();
    if (!data.entries.length) {
      message('No scores yet. Be the first!');
      shown = { scope: name, uid, kind: 'rows', sig };
      return;
    }
    data.entries.forEach((entry, i) => list.appendChild(row(entry, i + 1, i, entry.me)));
    if (data.me) {
      const gap = document.createElement('div');
      gap.className = 'rank-gap';
      gap.textContent = '···';
      list.append(gap, row(data.me, data.me.rank, 0, true));
    }
  }

  async function load(force) {
    const name = scope;
    const mine = ++token;
    const hit = cache[name];
    if (!force && hit && Date.now() - hit.at < CACHE_MS) return render(hit.data, name);
    if (!profile.ready) {
      if (profile.session.error && !profile.session.syncing && profile.session.status !== 'loading') return message('Could not reach the leaderboard.', true);
      return skeleton();
    }
    const uid = String(profile.state.uid);
    if (shown.kind !== 'rows' || shown.scope !== name || shown.uid !== uid) skeleton();
    const id = `${uid}:${profile.state.anon}:${profile.state.best}`;
    let run = inflight[name];
    if (!run || run.id !== id) {
      run = { id, promise: profile.fetchBoard(name) };
      inflight[name] = run;
      const clear = () => {
        if (inflight[name] === run) delete inflight[name];
      };
      run.promise.then(clear, clear);
    }
    try {
      const data = await run.promise;
      cache[name] = { at: Date.now(), data };
      if (mine === token) render(data, name);
    } catch {
      if (mine === token) message('Could not load the leaderboard.', true);
    }
  }

  function renderMeta() {
    $('meta-left').textContent = scope === 'all' ? 'Best score ever' : 'Best score this week';
    $('meta-right').textContent = scope === 'all' ? '' : `Resets in ${formatTime(msUntilReset())}`;
  }

  function renderChrome() {
    const signedIn = profile.session.status === 'in' && profile.ready;
    setCoins($('wallet'), profile.state.coins);
    setShown($('note'), profile.ready && profile.session.status === 'out');
    setShown(visibility, signedIn);
    visibility.textContent = profile.state.publicBoard ? 'Hide me from the leaderboard' : 'Show me on the leaderboard';
    renderMeta();
  }

  const tabs = [...document.querySelectorAll('.tab')];
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (scope === tab.dataset.scope) return;
      scope = tab.dataset.scope;
      $('tabs').style.setProperty('--i', scope === 'week' ? 0 : 1);
      tabs.forEach(t => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab);
      });
      renderMeta();
      load(false);
    });
  });

  visibility.addEventListener('click', () => {
    visibility.blur();
    profile.setPublicBoard(!profile.state.publicBoard);
    Object.keys(cache).forEach(k => delete cache[k]);
    setTimeout(() => load(true), 900);
  });

  $('note-signin').addEventListener('click', () => signInFlow());
  $('back-btn').addEventListener('click', () => navigateTo('../'));

  let lastKey = '';
  profile.subscribe(() => {
    renderChrome();
    if (!profile.ready && !profile.session.error) return;
    const key = `${profile.ready}:${profile.state.uid}:${profile.state.anon}:${profile.state.best}`;
    if (key === lastKey) return;
    lastKey = key;
    Object.keys(cache).forEach(k => delete cache[k]);
    load(true);
  });

  window.addEventListener('pageshow', e => {
    if (e.persisted) load(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load(false);
  });

  document.querySelectorAll('.leave-button').forEach(el => {
    el.addEventListener('touchstart', () => el.classList.add('hover'), { passive: true });
    const remove = () => el.classList.remove('hover');
    el.addEventListener('touchend', remove, { passive: true });
    el.addEventListener('touchcancel', remove, { passive: true });
  });

  renderChrome();
  skeleton();
  if (profile.ready) {
    lastKey = `${profile.ready}:${profile.state.uid}:${profile.state.anon}:${profile.state.best}`;
    load(false);
  }
});