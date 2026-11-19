import { createHmac, timingSafeEqual } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_EQUIPPED, DEFAULT_OWNED, findItem, kindOf } from '../assets/js/core/cosmetics.js';
import { weekKey } from '../assets/js/core/week.js';

const ORIGINS = ['https://gabriellongshaw.co.uk', 'https://www.gabriellongshaw.co.uk'];
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const MIN_RUN_SECONDS = 2;
const MAX_RUN_SECONDS = 3600;
const FIRST_PIPE_SECONDS = 2.5;
const SECONDS_PER_PIPE = 1.3;
const FLAPS_BASE = 8;
const FLAPS_PER_SECOND = 14;
const PAGE = 25;

const ANON_ACTIONS = new Set(['syncProfile', 'startRun', 'submitRun', 'buyItem', 'equipItem', 'getBoard']);

export const USERNAME = /^[a-z0-9_]{3,16}$/;
const RESERVED = new Set(['admin', 'administrator', 'flit', 'dash', 'dev', 'developer', 'gabriel', 'moderator', 'mod', 'official', 'staff', 'support', 'system', 'owner']);
const NAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_DISPLAY_NAME = 24;
const PHOTO_MODES = ['google', 'none'];

class Fail extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const whole = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

const defaults = () => ({
  coins: 0,
  best: 0,
  weekBest: { week: '', score: 0 },
  runs: 0,
  owned: [...DEFAULT_OWNED],
  equipped: { ...DEFAULT_EQUIPPED },
  publicBoard: true,
  lastRun: 0,
  lastCoins: 0,
  username: null,
  usernameAt: 0,
  displayName: null,
  photoMode: 'google'
});

function sanitize(raw) {
  const base = defaults();
  const data = raw && typeof raw === 'object' ? raw : {};
  const owned = new Set(base.owned);
  if (Array.isArray(data.owned)) data.owned.forEach(id => typeof id === 'string' && findItem(id) && owned.add(id));
  const equipped = { ...base.equipped };
  const eq = data.equipped || {};
  for (const kind of Object.keys(equipped)) {
    const id = eq[kind];
    if (typeof id === 'string' && owned.has(id) && kindOf(id) === kind) equipped[kind] = id;
  }
  const wb = data.weekBest || {};
  return {
    coins: whole(data.coins),
    best: whole(data.best),
    weekBest: { week: typeof wb.week === 'string' && /^\d{4}-W\d{2}$/.test(wb.week) ? wb.week : '', score: whole(wb.score) },
    runs: whole(data.runs),
    owned: [...owned],
    equipped,
    publicBoard: data.publicBoard !== false,
    lastRun: whole(data.lastRun),
    lastCoins: whole(data.lastCoins),
    username: typeof data.username === 'string' && USERNAME.test(data.username.toLowerCase()) ? data.username.toLowerCase() : null,
    usernameAt: whole(data.usernameAt),
    displayName: cleanDisplayName(data.displayName),
    photoMode: PHOTO_MODES.includes(data.photoMode) ? data.photoMode : 'google'
  };
}

export function cleanDisplayName(value) {
  if (typeof value !== 'string') return null;
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_DISPLAY_NAME);
  return name || null;
}

const view = p => ({
  coins: p.coins,
  best: p.best,
  weekBest: p.weekBest,
  runs: p.runs,
  owned: p.owned,
  equipped: p.equipped,
  publicBoard: p.publicBoard,
  username: p.username,
  displayName: p.displayName,
  photoMode: p.photoMode
});

const cleanPhoto = v => {
  try {
    return typeof v === 'string' && new URL(v).protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
};

export const shortName = full => {
  const parts = typeof full === 'string' ? full.replace(/[\u0000-\u001f\u007f]/g, '').trim().split(/\s+/).filter(Boolean) : [];
  if (!parts.length) return 'Player';
  const first = parts[0].slice(0, 16);
  return parts.length === 1 ? first : `${first} ${[...parts[parts.length - 1]][0].toUpperCase()}.`;
};

export function cleanRun(data) {
  const src = data && typeof data === 'object' ? data : {};
  const read = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
  const run = { score: read(src.score), flaps: read(src.flaps) };
  return Object.values(run).some(v => v === null) ? null : run;
}

export function maxScore(elapsed) {
  return Math.max(0, Math.floor((elapsed + 0.5 - FIRST_PIPE_SECONDS) / SECONDS_PER_PIPE) + 1);
}

export function checkRun(run, elapsed) {
  if (elapsed < MIN_RUN_SECONDS) return 'too-short';
  if (elapsed > MAX_RUN_SECONDS) return 'too-long';
  if (run.score > maxScore(elapsed)) return 'score';
  if (run.flaps < run.score) return 'flaps-low';
  if (run.flaps > FLAPS_BASE + elapsed * FLAPS_PER_SECOND) return 'flaps-high';
  return null;
}

export function createApi({ db, verify, secret, now = () => Date.now() }) {
  const profileRef = uid => db.doc(`flitProfiles/${uid}`);
  const allTimeRef = uid => db.doc(`flitBoard/${uid}`);
  const weekRef = (week, uid) => db.doc(`flitWeeks/${week}/entries/${uid}`);
  const nameRef = key => db.doc(`flitUsernames/${key}`);
  const boardName = (user, profile) => profile.username || profile.displayName || user.name;
  const boardPhoto = (user, profile) => (profile.photoMode === 'google' ? cleanPhoto(user.photo) : null);
  const entry = (name, score, photo) => ({ name: shortName(name), score, photo, updatedAt: FieldValue.serverTimestamp() });

  const sign = (uid, started) => createHmac('sha256', secret()).update(`${uid}.${started}`).digest('hex');

  function readToken(uid, token) {
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3 || parts[0] !== uid) return null;
    const started = Number(parts[1]);
    if (!Number.isSafeInteger(started) || started > now() + 1000) return null;
    const want = Buffer.from(sign(uid, started));
    const got = Buffer.from(parts[2]);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    return started;
  }

  async function load(tx, uid) {
    const snap = await tx.get(profileRef(uid));
    if (!snap.exists) throw new Fail(409, 'no-profile');
    return sanitize(snap.data());
  }

  const weekScore = profile => (profile.weekBest.week === weekKey(now()) ? profile.weekBest.score : 0);

  async function publish(user, profile) {
    if (user.anon || !profile.publicBoard) return true;
    const photo = boardPhoto(user, profile);
    const name = boardName(user, profile);
    const writes = [];
    if (profile.best > 0) writes.push(allTimeRef(user.uid).set(entry(name, profile.best, photo)));
    const week = weekScore(profile);
    if (week > 0) writes.push(weekRef(weekKey(now()), user.uid).set(entry(name, week, photo)));
    const results = await Promise.allSettled(writes);
    results.forEach(r => r.status === 'rejected' && console.error('board write failed', r.reason));
    return results.every(r => r.status === 'fulfilled');
  }

  const actions = {
    async syncProfile(user) {
      const profile = await db.runTransaction(async tx => {
        const ref = profileRef(user.uid);
        const snap = await tx.get(ref);
        const current = sanitize(snap.exists ? snap.data() : null);
        if (!snap.exists) tx.set(ref, { ...current, name: shortName(user.name), updatedAt: FieldValue.serverTimestamp() });
        return current;
      });
      await publish(user, profile);
      return { profile: view(profile) };
    },

    async startRun(user) {
      const started = now();
      return { runId: `${user.uid}.${started}.${sign(user.uid, started)}` };
    },

    async submitRun(user, body) {
      const run = cleanRun(body);
      const started = readToken(user.uid, body.runId);
      if (!run || !started) throw new Fail(400, 'run');
      const out = await db.runTransaction(async tx => {
        const profile = await load(tx, user.uid);
        if (started <= profile.lastRun) return { profile, rejected: 'replay' };
        const problem = checkRun(run, (now() - started) / 1000);
        const base = { lastRun: started, lastCoins: 0, updatedAt: FieldValue.serverTimestamp() };
        if (problem) {
          console.warn('run rejected', problem, JSON.stringify({ ...run, seconds: (now() - started) / 1000 }));
          tx.update(profileRef(user.uid), base);
          return { profile, rejected: problem };
        }
        const week = weekKey(now());
        const weekNow = profile.weekBest.week === week ? profile.weekBest.score : 0;
        const next = {
          ...profile,
          coins: profile.coins + run.score,
          runs: profile.runs + 1,
          best: Math.max(profile.best, run.score),
          weekBest: { week, score: Math.max(weekNow, run.score) }
        };
        tx.update(profileRef(user.uid), { coins: next.coins, runs: next.runs, best: next.best, weekBest: next.weekBest, ...base, lastCoins: run.score });
        return { profile: next, rejected: null };
      });
      if (!out.rejected && !(await publish(user, out.profile))) throw new Fail(503, 'board');
      return { rejected: out.rejected, profile: view(out.profile) };
    },

    async buyItem(user, body) {
      const item = typeof body.id === 'string' ? findItem(body.id) : null;
      if (!item) throw new Fail(404, 'unknown');
      return db.runTransaction(async tx => {
        const profile = await load(tx, user.uid);
        if (profile.owned.includes(item.id)) return { profile: view(profile) };
        if (profile.coins < item.price) throw new Fail(409, 'coins');
        const next = { ...profile, coins: profile.coins - item.price, owned: [...profile.owned, item.id] };
        tx.update(profileRef(user.uid), { coins: next.coins, owned: next.owned, updatedAt: FieldValue.serverTimestamp() });
        return { profile: view(next) };
      });
    },

    async equipItem(user, body) {
      const item = typeof body.id === 'string' ? findItem(body.id) : null;
      if (!item) throw new Fail(404, 'unknown');
      return db.runTransaction(async tx => {
        const profile = await load(tx, user.uid);
        if (!profile.owned.includes(item.id)) throw new Fail(409, 'not-owned');
        const equipped = { ...profile.equipped, [kindOf(item.id)]: item.id };
        tx.update(profileRef(user.uid), { equipped, updatedAt: FieldValue.serverTimestamp() });
        return { profile: view({ ...profile, equipped }) };
      });
    },

    async setPublicBoard(user, body) {
      const on = !!body.on;
      const profile = await db.runTransaction(async tx => {
        const current = await load(tx, user.uid);
        tx.update(profileRef(user.uid), { publicBoard: on, updatedAt: FieldValue.serverTimestamp() });
        return { ...current, publicBoard: on };
      });
      if (on) await publish(user, profile);
      else await Promise.allSettled([allTimeRef(user.uid).delete(), weekRef(weekKey(now()), user.uid).delete()]);
      return { profile: view(profile) };
    },

    async setUsername(user, body) {
      const name = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
      if (!USERNAME.test(name)) throw new Fail(400, 'username');
      if (RESERVED.has(name)) throw new Fail(409, 'taken');
      const profile = await db.runTransaction(async tx => {
        const snap = await tx.get(profileRef(user.uid));
        if (!snap.exists) throw new Fail(409, 'no-profile');
        const keySnap = await tx.get(nameRef(name));
        if (keySnap.exists && keySnap.data().uid !== user.uid) throw new Fail(409, 'taken');
        const raw = snap.data();
        const me = sanitize(raw);
        if (me.username === name) return me;
        if (me.username && now() - me.usernameAt < NAME_COOLDOWN_MS) throw new Fail(429, 'cooldown');
        if (me.username) tx.delete(nameRef(me.username));
        tx.set(nameRef(name), { uid: user.uid });
        tx.update(profileRef(user.uid), { username: name, usernameAt: now(), updatedAt: FieldValue.serverTimestamp() });
        return { ...me, username: name };
      });
      await publish(user, profile);
      return { profile: view(profile) };
    },

    async setDisplayName(user, body) {
      const name = cleanDisplayName(body.displayName);
      const profile = await db.runTransaction(async tx => {
        const current = await load(tx, user.uid);
        tx.update(profileRef(user.uid), { displayName: name, updatedAt: FieldValue.serverTimestamp() });
        return { ...current, displayName: name };
      });
      await publish(user, profile);
      return { profile: view(profile) };
    },

    async setPhoto(user, body) {
      if (!PHOTO_MODES.includes(body.mode)) throw new Fail(400, 'photo');
      const profile = await db.runTransaction(async tx => {
        const current = await load(tx, user.uid);
        tx.update(profileRef(user.uid), { photoMode: body.mode, updatedAt: FieldValue.serverTimestamp() });
        return { ...current, photoMode: body.mode };
      });
      await publish(user, profile);
      return { profile: view(profile) };
    },

    async getBoard(user, body) {
      const week = body.scope === 'all' ? null : weekKey(now());
      const col = week ? db.collection(`flitWeeks/${week}/entries`) : db.collection('flitBoard');
      const snap = await col.orderBy('score', 'desc').limit(PAGE).get();
      const entries = snap.docs.map(d => {
        const data = d.data();
        return {
          name: typeof data.name === 'string' && data.name ? data.name.slice(0, 24) : 'Player',
          score: whole(data.score),
          photo: cleanPhoto(data.photo),
          me: d.id === user.uid
        };
      });
      let me = null;
      if (!user.anon && !entries.some(e => e.me)) {
        const mine = await db.runTransaction(tx => load(tx, user.uid)).catch(() => null);
        const score = mine ? (week ? weekScore(mine) : mine.best) : 0;
        if (mine && mine.publicBoard && score > 0) {
          const count = await col.where('score', '>', score).count().get();
          me = { rank: count.data().count + 1, score, name: shortName(boardName(user, mine)), photo: boardPhoto(user, mine) };
        }
      }
      return { entries, me, week };
    }
  };

  return async function handle(token, body) {
    const user = await verify(token);
    if (!user) throw new Fail(401, 'auth');
    const run = body && typeof body.action === 'string' && Object.hasOwn(actions, body.action) ? actions[body.action] : null;
    if (!run) throw new Fail(400, 'action');
    if (user.anon && !ANON_ACTIONS.has(body.action)) throw new Fail(403, 'signin');
    return run(user, body);
  };
}

let handle = null;
let account = null;

function setup() {
  if (handle) return handle;
  account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!getApps().length) initializeApp({ credential: cert(account) });
  handle = createApi({
    db: getFirestore(),
    secret: () => account.private_key,
    verify: async token => {
      try {
        const decoded = await getAuth().verifyIdToken(token);
        const provider = decoded.firebase ? decoded.firebase.sign_in_provider : null;
        return { uid: decoded.uid, name: decoded.name || null, photo: decoded.picture || null, anon: provider === 'anonymous' };
      } catch {
        return null;
      }
    }
  });
  return handle;
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ORIGINS.includes(origin) || LOCAL.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const out = await setup()(token, req.body && typeof req.body === 'object' ? req.body : {});
    return res.status(200).json(out);
  } catch (e) {
    if (e instanceof Fail) return res.status(e.status).json({ error: e.code });
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
}
