import { profile } from '../core/profile.js';
import { SKINS, HATS, PILLARS, WORLDS, DEFAULT_EQUIPPED, findItem, kindOf, paletteFor, resolveLook } from '../core/cosmetics.js';
import { World } from '../components/world.js';
import { Bird } from '../components/bird.js';
import { Pipe } from '../components/pipes.js';
import { drawHat } from '../components/hats.js';
import { mountAccount, signInFlow, showToast } from '../components/account.js';
import { mountSound } from '../components/sound.js';
import { readPalette, onThemeChange, detectTouch, isDark } from '../core/theme.js';
import { initGraphics } from '../core/graphics.js';
import { initPageFadeIn, navigateTo } from '../core/transition.js';
import { initAudio, audio } from '../core/audio.js';
import { bump } from '../core/motion.js';

const $ = id => document.getElementById(id);

const ITEMS = { skin: SKINS, hat: HATS, pillar: PILLARS, world: WORLDS };
const KIND_LABEL = { skin: 'Colour', hat: 'Hat', pillar: 'Pillar', world: 'World' };
const PREVIEW_W = 320;
const PREVIEW_H = 170;

document.addEventListener('DOMContentLoaded', () => {
  detectTouch();
  initGraphics();
  initPageFadeIn();
  profile.init();
  initAudio(1);
  mountSound(document.querySelector('.shop-bar-right'), { first: true });
  mountAccount($('account'));

  let kind = 'skin';
  let base = readPalette();
  const sel = { ...profile.state.equipped };
  const thumbs = new Map();

  const lookOf = () => resolveLook(sel);
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  function fitCanvas(canvas, w, h) {
    const d = dpr();
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return ctx;
  }

  function drawBird(ctx, x, y, scale, look, time = 0, withHat = true) {
    const bird = new Bird();
    bird.x = 0;
    bird.y = 0;
    bird.wing = 0.4;
    bird.hat = withHat ? look.hat : 'hat:none';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    bird.draw(ctx, paletteFor(base, look, time));
    ctx.restore();
  }

  function drawThumb(canvas, item) {
    const size = 88;
    const ctx = fitCanvas(canvas, size, size);
    const own = kindOf(item.id);
    const neutral = resolveLook(DEFAULT_EQUIPPED);
    ctx.clearRect(0, 0, size, size);
    if (own === 'skin') {
      drawBird(ctx, size / 2, size / 2, 1.5, { ...neutral, skin: item });
    } else if (own === 'hat') {
      if (item.id === 'hat:none') {
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--meta-text');
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 16, 0, Math.PI * 2);
        ctx.moveTo(size / 2 - 11, size / 2 + 11);
        ctx.lineTo(size / 2 + 11, size / 2 - 11);
        ctx.stroke();
      } else {
        drawBird(ctx, size / 2, size / 2 + 12, 1.3, { ...neutral, hat: item.id });
      }
    } else if (own === 'pillar') {
      const palette = paletteFor(base, { ...neutral, pillar: item });
      ctx.save();
      ctx.scale(0.55, 0.55);
      new Pipe((size / 0.55 - 62) / 2, 125).draw(ctx, palette, 400);
      ctx.restore();
    } else {
      const world = new World(item);
      world.setDark(isDark());
      world.resize(size, size, size * 0.72);
      world.draw(ctx);
      world.drawGround(ctx);
    }
  }

  const preview = $('preview');
  let pctx = null;
  let pw = PREVIEW_W;
  const world = new World(lookOf().world);
  world.setDark(isDark());
  let time = 0;
  let last = performance.now();
  const pipe = new Pipe(0, 0);

  function sizePreview() {
    pw = Math.max(240, preview.clientWidth || PREVIEW_W);
    pctx = fitCanvas(preview, pw, PREVIEW_H);
    world.resize(pw, PREVIEW_H, PREVIEW_H * 0.8);
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    if (pctx) {
      const look = lookOf();
      world.update(dt, 60);
      world.draw(pctx);
      const palette = paletteFor(base, look, time);
      pipe.x = pw * 0.7;
      pipe.gapY = 145;
      pctx.save();
      pctx.beginPath();
      pctx.rect(0, 0, pw, PREVIEW_H * 0.8);
      pctx.clip();
      pipe.draw(pctx, palette, PREVIEW_H);
      pctx.restore();
      world.drawGround(pctx);
      const bird = new Bird();
      bird.x = pw * 0.34;
      bird.hat = look.hat;
      bird.hover(dt, time, PREVIEW_H * 0.4);
      bird.draw(pctx, palette);
    }
    requestAnimationFrame(frame);
  }

  function renderGrid() {
    const grid = $('grid');
    grid.replaceChildren();
    thumbs.clear();
    ITEMS[kind].forEach((item, i) => {
      const card = document.createElement('button');
      card.className = 'item-card';
      card.style.setProperty('--n', i);
      card.dataset.id = item.id;
      const canvas = document.createElement('canvas');
      canvas.className = 'item-thumb';
      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = item.name;
      const price = document.createElement('span');
      price.className = 'item-price';
      card.append(canvas, name, price);
      card.addEventListener('click', () => {
        card.blur();
        if (sel[kind] === item.id) return;
        sel[kind] = item.id;
        audio.sfx('click');
        if (kind === 'world') world.setTheme(findItem(item.id));
        renderState();
      });
      grid.appendChild(card);
      thumbs.set(item.id, { card, canvas, price, item });
      drawThumb(canvas, item);
    });
    renderState();
  }

  function renderState() {
    const owned = profile.state.owned;
    const equipped = profile.state.equipped;
    for (const { card, price, item } of thumbs.values()) {
      card.classList.toggle('selected', sel[kind] === item.id);
      const has = owned.includes(item.id);
      card.querySelector('.item-tag')?.remove();
      if (equipped[kind] === item.id) {
        const tag = document.createElement('span');
        tag.className = 'item-tag';
        tag.textContent = 'On';
        card.appendChild(tag);
      }
      price.replaceChildren();
      if (has) price.textContent = 'Owned';
      else {
        const dot = document.createElement('span');
        dot.className = 'coin-dot';
        price.append(dot, String(item.price));
      }
    }
    const item = findItem(sel[kind]);
    $('item-name').textContent = item.name;
    $('item-kind').textContent = KIND_LABEL[kind];
    const btn = $('action-btn');
    const has = owned.includes(item.id);
    btn.classList.remove('equipped');
    if (!profile.ready) {
      btn.textContent = has ? 'Equip' : `Buy · ${item.price}`;
      btn.disabled = true;
    } else if (equipped[kind] === item.id) {
      btn.textContent = 'Equipped';
      btn.classList.add('equipped');
      btn.disabled = true;
    } else if (has) {
      btn.textContent = 'Equip';
      btn.disabled = false;
    } else {
      btn.textContent = `Buy · ${item.price}`;
      btn.disabled = false;
    }
  }

  function renderChrome() {
    $('wallet').textContent = profile.state.coins;
    const { status } = profile.session;
    const note = $('note');
    let text = '';
    if (status === 'loading') text = '';
    else if (!profile.ready) text = 'Could not reach the shop. Check your connection.';
    else if (status === 'out') text = 'Playing as a guest. Sign in to keep your coins on any device.';
    note.classList.toggle('hidden', !text);
    $('note-text').textContent = text;
    $('note-signin').classList.toggle('hidden', !(profile.ready && status === 'out'));
    renderState();
  }

  $('action-btn').addEventListener('click', async e => {
    const btn = e.currentTarget;
    btn.blur();
    const item = findItem(sel[kind]);
    if (!item) return;
    if (!profile.state.owned.includes(item.id)) {
      btn.disabled = true;
      const result = await profile.buy(item.id);
      if (!result.ok) {
        showToast(result.reason === 'coins' ? 'Not enough coins yet.' : 'Could not buy that. Try again.');
        renderState();
        return;
      }
      audio.sfx('best');
      bump($('wallet').parentElement);
    }
    profile.equip(item.id);
    renderState();
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (kind === tab.dataset.kind) return;
      kind = tab.dataset.kind;
      const index = ['skin', 'hat', 'pillar', 'world'].indexOf(kind);
      $('tabs').style.setProperty('--i', index);
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab);
      });
      renderGrid();
    });
  });

  $('note-signin').addEventListener('click', () => signInFlow());
  $('back-btn').addEventListener('click', () => navigateTo('../'));

  let equippedKey = JSON.stringify(profile.state.equipped);
  profile.subscribe(() => {
    const next = JSON.stringify(profile.state.equipped);
    if (next !== equippedKey) {
      equippedKey = next;
      Object.assign(sel, profile.state.equipped);
      world.setTheme(lookOf().world);
    }
    renderChrome();
  });

  onThemeChange(() => {
    base = readPalette();
    world.setDark(isDark());
    renderGrid();
  });
  window.addEventListener('resize', sizePreview);

  document.querySelectorAll('.leave-button').forEach(el => {
    el.addEventListener('touchstart', () => el.classList.add('hover'), { passive: true });
    const remove = () => el.classList.remove('hover');
    el.addEventListener('touchend', remove, { passive: true });
    el.addEventListener('touchcancel', remove, { passive: true });
  });

  sizePreview();
  renderGrid();
  renderChrome();
  requestAnimationFrame(frame);
});
