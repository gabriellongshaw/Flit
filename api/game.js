import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_EQUIPPED, DEFAULT_OWNED, findItem, kindOf } from '../assets/js/core/cosmetics.js';
import { weekKey } from '../assets/js/core/week.js';
import { cleanPrivacy, defaultPrivacy } from '../assets/js/core/privacy.js';
import { allQuests, applyRun, cleanQuests, freshQuests, isClaimed, markClaimed, progressOf } from '../assets/js/core/quests.js';
import { USERNAME, cleanDisplayName, createSocial, pickPhoto, profileFixups, validPhoto } from '../server/social.js';
import { createAnnouncements } from '../server/announcements.js';
import { createPolls, isAdmin } from '../server/polls.js';

export { USERNAME, cleanDisplayName };

const ORIGINS = ['https://flit-tau.vercel.app', 'https://gabriellongshaw.co.uk', 'https://www.gabriellongshaw.co.uk'];
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const RELEASE_SECRET = process.env.RELEASE_SECRET || '';
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const MIN_RUN_SECONDS = 2;
const MAX_RUN_SECONDS = 3600;
const FIRST_PIPE_SECONDS = 2.5;
const SECONDS_PER_PIPE = 1.3;
const FLAPS_BASE = 8;
const FLAPS_PER_SECOND = 14;
const PAGE = 25;

const ANON_ACTIONS = new Set(['syncProfile', 'startRun', 'submitRun', 'claimQuest', 'buyItem', 'equipItem', 'getBoard', 'viewProfile', 'listPosts', 'listReplies', 'listAnnouncements']);

const PHOTO_MODES = ['google', 'custom', 'none'];

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
  quests: freshQuests(),
  username: null,
  usernameAt: 0,
  displayName: null,
  searchable: true,
  photoMode: 'google',
  photoData: null,
  privacy: defaultPrivacy()
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
    quests: cleanQuests(data.quests),
    publicBoard: data.publicBoard !== false,
    lastRun: whole(data.lastRun),
    lastCoins: whole(data.lastCoins),
    username: typeof data.username === 'string' && USERNAME.test(data.username.toLowerCase()) ? data.username.toLowerCase() : null,
    usernameAt: whole(data.usernameAt),
    displayName: cleanDisplayName(data.displayName),
    searchable: data.searchable !== false,
    photoMode: PHOTO_MODES.includes(data.photoMode) ? data.photoMode : 'google',
    photoData: typeof data.photoData === 'string' && data.photoData ? data.photoData : null,
    privacy: cleanPrivacy(data.privacy)
  };
}

const view = p => ({
  coins: p.coins,
  best: p.best,
  weekBest: p.weekBest,
  runs: p.runs,
  owned: p.owned,
  equipped: p.equipped,
  quests: p.quests,
  publicBoard: p.publicBoard,
  username: p.username,
  displayName: p.displayName,
  searchable: p.searchable,
  photoMode: p.photoMode,
  photoData: p.photoData,
  privacy: p.privacy
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

export function createApi({ db, verify, secret, now = () => Date.now(), adminEmail = ADMIN_EMAIL, releaseSecret = RELEASE_SECRET }) {
  const profileRef = uid => db.doc(`flitProfiles/${uid}`);
  const allTimeRef = uid => db.doc(`flitBoard/${uid}`);
  const weekRef = (week, uid) => db.doc(`flitWeeks/${week}/entries/${uid}`);
  const boardName = (user, profile) => profile.username || profile.displayName || user.name;
  const boardPhoto = (user, profile) => (profile.privacy.photo === 'public' ? pickPhoto({ photoMode: profile.photoMode, photoData: profile.photoData, photo: cleanPhoto(user.photo) }) : null);
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

  const social = createSocial({ db, profileRef, load, sanitize, view, Fail, publish, now });

  const republish = run => async (user, body) => {
    const out = await run(user, body);
    const profile = await db.runTransaction(tx => load(tx, user.uid));
    await publish(user, profile);
    return out;
  };

  const polls = createPolls({ db, load, Fail, now });
  const { publishRelease, ...announcements } = createAnnouncements({ db, Fail, now });

  const actions = {
    ...social,
    ...polls,
    ...announcements,
    setDisplayName: republish(social.setDisplayName),
    setPhoto: republish(social.setPhoto),
    setPrivacy: republish(social.setPrivacy),

    async syncProfile(user) {
      const profile = await db.runTransaction(async tx => {
        const ref = profileRef(user.uid);
        const snap = await tx.get(ref);
        const raw = snap.exists ? snap.data() : null;
        const current = sanitize(raw);
        const photo = cleanPhoto(user.photo);
        const fix = profileFixups(raw, photo);
        if (!snap.exists) tx.set(ref, { ...current, name: shortName(user.name), photo, displayLower: null, updatedAt: FieldValue.serverTimestamp() });
        else if (Object.keys(fix).length) tx.update(ref, fix);
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
        const quests = applyRun(profile.quests, run, new Date(now()));
        const next = {
          ...profile,
          coins: profile.coins + run.score,
          runs: profile.runs + 1,
          best: Math.max(profile.best, run.score),
          weekBest: { week, score: Math.max(weekNow, run.score) },
          quests
        };
        tx.update(profileRef(user.uid), { coins: next.coins, runs: next.runs, best: next.best, weekBest: next.weekBest, quests, ...base, lastCoins: run.score });
        return { profile: next, rejected: null };
      });
      if (!out.rejected && !(await publish(user, out.profile))) throw new Fail(503, 'board');
      return { rejected: out.rejected, profile: view(out.profile) };
    },

    async claimQuest(user, body) {
      if (typeof body.id !== 'string') throw new Fail(400, 'id');
      return db.runTransaction(async tx => {
        const profile = await load(tx, user.uid);
        const quest = allQuests(profile.quests).find(item => item.id === body.id);
        if (!quest) throw new Fail(404, 'unknown');
        if (isClaimed(profile.quests, quest)) return { reward: 0, profile: view(profile) };
        if (progressOf(profile.quests, quest) < quest.target) throw new Fail(409, 'progress');
        const next = { ...profile, coins: profile.coins + quest.reward, quests: markClaimed(profile.quests, quest) };
        tx.update(profileRef(user.uid), { coins: next.coins, quests: next.quests, updatedAt: FieldValue.serverTimestamp() });
        return { reward: quest.reward, profile: view(next) };
      });
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

    async getBoard(user, body) {
      const week = body.scope === 'all' ? null : weekKey(now());
      const col = week ? db.collection(`flitWeeks/${week}/entries`) : db.collection('flitBoard');
      const snap = await col.orderBy('score', 'desc').limit(PAGE).get();
      const entries = snap.docs.map(d => {
        const data = d.data();
        return {
          name: typeof data.name === 'string' && data.name ? data.name.slice(0, 24) : 'Player',
          score: whole(data.score),
          photo: validPhoto(data.photo) ? data.photo : cleanPhoto(data.photo),
          uid: d.id,
          me: d.id === user.uid
        };
      });
      let me = null;
      if (!user.anon && !entries.some(e => e.me)) {
        const mine = await db.runTransaction(tx => load(tx, user.uid)).catch(() => null);
        const score = mine ? (week ? weekScore(mine) : mine.best) : 0;
        if (mine && mine.publicBoard && score > 0) {
          const count = await col.where('score', '>', score).count().get();
          me = { rank: count.data().count + 1, score, name: shortName(boardName(user, mine)), photo: boardPhoto(user, mine), uid: user.uid };
        }
      }
      return { entries, me, week };
    }
  };

  const digest = value => createHash('sha256').update(String(value)).digest();
  const releaseAllowed = token => !!releaseSecret && !!token && timingSafeEqual(digest(token), digest(releaseSecret));

  return async function handle(token, body) {
    if (body && body.action === 'publishRelease') {
      if (!releaseAllowed(token)) throw new Fail(403, 'secret');
      return publishRelease(body);
    }
    const user = await verify(token);
    if (!user) throw new Fail(401, 'auth');
    const run = body && typeof body.action === 'string' && Object.hasOwn(actions, body.action) ? actions[body.action] : null;
    if (!run) throw new Fail(400, 'action');
    if (user.anon && !ANON_ACTIONS.has(body.action)) throw new Fail(403, 'signin');
    return run({ ...user, admin: isAdmin(user, adminEmail) }, body);
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
        return { uid: decoded.uid, name: decoded.name || null, photo: decoded.picture || null, anon: provider === 'anonymous', email: decoded.email || null, verified: decoded.email_verified === true, provider };
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