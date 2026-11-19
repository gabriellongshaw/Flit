import { WORLDS } from './worlds.js';

export { WORLDS };

const skin = (id, name, price, runner, runnerDark, visor, scarf, extra = {}) => ({ id: `skin:${id}`, name, price, runner, runnerDark, visor, scarf, ...extra });

export const SKINS = [
  skin('coral', 'Coral', 0, null, null, null, null),
  skin('sky', 'Sky', 40, '#38bdf8', '#0369a1', '#0c2a3d', '#fde68a'),
  skin('violet', 'Violet', 40, '#a78bfa', '#6d28d9', '#1e1b4b', '#f9a8d4'),
  skin('mint', 'Mint', 40, '#6ee7b7', '#047857', '#022c22', '#fef9c3'),
  skin('lemon', 'Lemon', 40, '#fde047', '#ca8a04', '#422006', '#ffffff'),
  skin('rose', 'Rose', 50, '#f472b6', '#be185d', '#500724', '#bae6fd'),
  skin('lime', 'Lime', 50, '#a3e635', '#4d7c0f', '#1a2e05', '#f0abfc'),
  skin('crimson', 'Crimson', 60, '#ef4444', '#991b1b', '#2a0a0a', '#fde68a'),
  skin('aqua', 'Aqua', 60, '#2dd4bf', '#0f766e', '#042f2e', '#fef08a'),
  skin('cocoa', 'Cocoa', 80, '#a16207', '#451a03', '#1c0f03', '#fdba74'),
  skin('graphite', 'Graphite', 100, '#475569', '#1e293b', '#fb923c', '#fb923c'),
  skin('midnight', 'Midnight', 100, '#1e3a8a', '#172554', '#93c5fd', '#93c5fd'),
  skin('snow', 'Snow', 100, '#f1f5f9', '#94a3b8', '#1e293b', '#38bdf8'),
  skin('ice', 'Ice', 120, '#bae6fd', '#38bdf8', '#0c4a6e', '#ffffff'),
  skin('galaxy', 'Galaxy', 150, '#6366f1', '#312e81', '#e0e7ff', '#c4b5fd'),
  skin('obsidian', 'Obsidian', 150, '#1f2937', '#0b1020', '#f472b6', '#f472b6'),
  skin('gold', 'Gold', 250, '#facc15', '#a16207', '#422006', '#ffffff'),
  skin('prism', 'Prism', 400, '#a78bfa', '#6d28d9', '#1e1b4b', '#ffffff', { rainbow: true })
];

export const HATS = [
  { id: 'hat:none', name: 'None', price: 0 },
  { id: 'hat:beanie', name: 'Beanie', price: 40 },
  { id: 'hat:cap', name: 'Cap', price: 40 },
  { id: 'hat:bow', name: 'Bow', price: 40 },
  { id: 'hat:flower', name: 'Flower', price: 50 },
  { id: 'hat:party', name: 'Party', price: 60 },
  { id: 'hat:catears', name: 'Cat ears', price: 60 },
  { id: 'hat:bunny', name: 'Bunny ears', price: 70 },
  { id: 'hat:antennae', name: 'Antennae', price: 70 },
  { id: 'hat:headphones', name: 'Headphones', price: 90 },
  { id: 'hat:propeller', name: 'Propeller', price: 90 },
  { id: 'hat:chef', name: 'Chef', price: 100 },
  { id: 'hat:santa', name: 'Santa', price: 120 },
  { id: 'hat:halo', name: 'Halo', price: 150 },
  { id: 'hat:tophat', name: 'Top hat', price: 150 },
  { id: 'hat:cowboy', name: 'Cowboy', price: 160 },
  { id: 'hat:wizard', name: 'Wizard', price: 200 },
  { id: 'hat:crown', name: 'Crown', price: 300 }
];

const pillar = (id, name, price, hazard, hazardDark, hazardLight) => ({ id: `pillar:${id}`, name, price, hazard, hazardDark, hazardLight });

export const PILLARS = [
  pillar('dusk', 'Dusk', 0, null, null, null),
  pillar('teal', 'Teal', 30, '#14b8a6', '#0f766e', '#99f6e4'),
  pillar('rose', 'Rose', 30, '#f43f5e', '#be123c', '#fda4af'),
  pillar('sky', 'Sky', 40, '#38bdf8', '#0369a1', '#bae6fd'),
  pillar('lime', 'Lime', 40, '#84cc16', '#4d7c0f', '#d9f99d'),
  pillar('gold', 'Gold', 60, '#facc15', '#a16207', '#fef08a'),
  pillar('slate', 'Slate', 60, '#64748b', '#334155', '#cbd5e1'),
  pillar('candy', 'Candy', 80, '#f472b6', '#be185d', '#fbcfe8'),
  pillar('midnight', 'Midnight', 80, '#1e3a8a', '#172554', '#93c5fd'),
  pillar('bone', 'Bone', 100, '#e7e5e4', '#a8a29e', '#ffffff')
];

export const KINDS = ['skin', 'hat', 'pillar', 'world'];

export const DEFAULT_EQUIPPED = { skin: 'skin:coral', hat: 'hat:none', pillar: 'pillar:dusk', world: 'world:sunset' };

export const DEFAULT_OWNED = Object.values(DEFAULT_EQUIPPED);

const ALL = [...SKINS, ...HATS, ...PILLARS, ...WORLDS];
const BY_ID = new Map(ALL.map(item => [item.id, item]));

export const findItem = id => (typeof id === 'string' ? BY_ID.get(id) || null : null);

export const kindOf = id => (typeof id === 'string' ? id.split(':')[0] : '');

export function resolveLook(equipped) {
  const pick = kind => findItem(equipped[kind]) || findItem(DEFAULT_EQUIPPED[kind]);
  return { skin: pick('skin'), hat: pick('hat').id, pillar: pick('pillar'), world: pick('world') };
}

export function paletteFor(base, look, time = 0) {
  const palette = { ...base };
  const s = look.skin;
  if (s.rainbow) {
    const hue = (time * 70) % 360;
    palette.runner = `hsl(${hue}, 85%, 62%)`;
    palette.runnerDark = `hsl(${(hue + 20) % 360}, 70%, 40%)`;
    palette.scarf = '#ffffff';
  } else if (s.runner) {
    palette.runner = s.runner;
    palette.runnerDark = s.runnerDark;
    palette.visor = s.visor;
    palette.scarf = s.scarf;
  }
  const p = look.pillar;
  if (p.hazard) {
    palette.hazard = p.hazard;
    palette.hazardDark = p.hazardDark;
    palette.hazardLight = p.hazardLight;
  }
  return palette;
}