import { audio } from '../core/audio.js';
import { hideEl, showEl } from '../core/motion.js';

const ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';

const OPTIONS = [
  { key: 'music', label: 'Music' },
  { key: 'sfx', label: 'Sound effects' }
];

export function mountSound(parent, { className = 'sound-btn', first = false } = {}) {
  const root = document.createElement('div');
  root.className = 'sound-control';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.dataset.silent = '';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Sound');
  btn.title = 'Sound';
  btn.innerHTML = ICON;

  const menu = document.createElement('div');
  menu.className = 'sound-menu hidden';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', 'Sound');

  const rows = OPTIONS.map(({ key, label }) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'sound-option';
    row.dataset.silent = '';
    row.setAttribute('role', 'switch');
    const text = document.createElement('span');
    text.textContent = label;
    const track = document.createElement('span');
    track.className = 'sound-switch';
    track.setAttribute('aria-hidden', 'true');
    row.append(text, track);
    row.addEventListener('click', () => {
      row.blur();
      const on = !audio.settings[key];
      audio.set({ [key]: on });
      if (on) audio.sfx('toggle');
    });
    menu.appendChild(row);
    return { key, row };
  });

  const isOpen = () => !menu.classList.contains('hidden') && !menu.classList.contains('closing');

  const place = () => {
    const room = 8;
    const width = menu.offsetWidth;
    const box = btn.getBoundingClientRect();
    const left = box.right - width;
    const shift = left < room ? room - left : Math.min(0, window.innerWidth - room - box.right);
    menu.style.right = 'auto';
    menu.style.left = `${box.right - width - box.left + shift}px`;
    const origin = box.left + box.width / 2 - (box.right - width + shift);
    menu.style.transformOrigin = `${Math.round(origin)}px top`;
  };

  const open = () => {
    showEl(menu);
    place();
    btn.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    hideEl(menu);
    btn.setAttribute('aria-expanded', 'false');
  };

  const render = () => {
    rows.forEach(({ key, row }) => row.setAttribute('aria-checked', String(audio.settings[key])));
  };

  btn.addEventListener('click', () => {
    btn.blur();
    if (isOpen()) close();
    else open();
  });

  document.addEventListener(
    'pointerdown',
    e => {
      if (isOpen() && !root.contains(e.target)) close();
    },
    true
  );

  audio.subscribe(render);
  render();
  root.append(btn, menu);
  if (first) parent.prepend(root);
  else parent.appendChild(root);
  return root;
}