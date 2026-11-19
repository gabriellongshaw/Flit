import { loadFirebase } from './firebase.js';
import { DEFAULT_EQUIPPED, DEFAULT_OWNED, findItem, kindOf } from './cosmetics.js';
import { weekKey } from './week.js';

const KEY = 'flit:profile';
const API_URL = 'https://flit-api.vercel.app/api/game';

const listeners = new Set();
const session = { status: 'loading', syncing: false, error: null };
let cloud = null;
let cloudReady = false;
let started = false;
let runPromise = null;
let anonPending = false;
let inflight = null;

const whole = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const cleanName = v => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60) : '') || null;
const cleanPhoto = v => {
  try {
    return typeof v === 'string' && new URL(v).protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
};

const defaults = () => ({
  coins: 0,
  best: 0,
  weekBest: { week: '', score: 0 },
  runs: 0,
  owned: [...DEFAULT_OWNED],
  equipped: { ...DEFAULT_EQUIPPED },
  publicBoard: true
});

function sanitize(raw) {
  const base = defaults();
  const data = raw && typeof raw === 'object' ? raw : {};
  const owned = new Set(base.owned);
  if (Array.isArray(data.owned)) data.owned.forEach(id => findItem(id) && owned.add(id));
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
    weekBest: { week: typeof wb.week === 'string' ? wb.week : '', score: whole(wb.score) },
    runs: whole(data.runs),
    owned: [...owned],
    equipped,
    publicBoard: data.publicBoard !== false
  };
}

function load() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY));
  } catch {}
  return {
    ...sanitize(raw),
    uid: raw && typeof raw.uid === 'string' ? raw.uid : null,
    anon: !!(raw && raw.anon === true),
    name: cleanName(raw && raw.name),
    photo: cleanPhoto(raw && raw.photo)
  };
}

let state = load();

const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
};
const emit = () => listeners.forEach(fn => fn());
const guestState = () => ({ ...defaults(), uid: null, anon: false, name: null, photo: null });

async function call(action, data) {
  const user = cloud && cloud.auth.currentUser;
  if (!user) throw new Error('signed-out');
  const token = await user.getIdToken();
  const res = await fetch(API_URL, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...data })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(out.error || 'server');
    err.code = out.error || 'server';
    throw err;
  }
  return out;
}

function applyServer(remote) {
  state = { ...state, ...sanitize(remote) };
  persist();
  emit();
}

async function refresh() {
  if (!cloudReady || !state.uid) return;
  const uid = state.uid;
  try {
    const out = await call('syncProfile', {});
    if (state.uid === uid) applyServer(out.profile);
  } catch {}
}

function startAnonymous() {
  if (anonPending || !cloud) return;
  anonPending = true;
  cloud.authMod
    .signInAnonymously(cloud.auth)
    .catch(e => {
      const code = e && e.code;
      session.error = code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation' ? 'anon' : 'offline';
      emit();
    })
    .finally(() => {
      anonPending = false;
    });
}

async function runUser(user) {
  const status = user.isAnonymous ? 'out' : 'in';
  session.status = status;
  session.syncing = true;
  session.error = null;
  emit();
  try {
    const out = await call('syncProfile', {});
    state = { ...sanitize(out.profile), uid: user.uid, anon: user.isAnonymous, name: cleanName(user.displayName), photo: cleanPhoto(user.photoURL) };
    cloudReady = true;
    persist();
  } catch (e) {
    cloudReady = false;
    session.error = 'offline';
  }
  session.syncing = false;
  emit();
}

async function handleUser(user) {
  if (!user) {
    cloudReady = false;
    if (state.uid) {
      state = guestState();
      persist();
    }
    session.status = 'out';
    session.syncing = false;
    emit();
    startAnonymous();
    return;
  }
  const key = `${user.uid}:${user.isAnonymous}`;
  if (inflight && inflight.key === key) return inflight.promise;
  const promise = runUser(user);
  inflight = { key, promise };
  try {
    await promise;
  } finally {
    if (inflight && inflight.promise === promise) inflight = null;
  }
}

async function finishLink() {
  const user = cloud.auth.currentUser;
  if (!user) return;
  await user.getIdToken(true);
  await user.reload();
  await handleUser(cloud.auth.currentUser);
}

async function resolveClash(e) {
  const credential = cloud.authMod.GoogleAuthProvider.credentialFromError(e);
  if (!credential) throw e;
  await cloud.authMod.signInWithCredential(cloud.auth, credential);
}

export const profile = {
  get state() {
    return state;
  },
  get session() {
    return session;
  },
  get ready() {
    return cloudReady && !!state.uid;
  },
  get avatar() {
    return state.photo;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  owns: id => state.owned.includes(id),

  async init() {
    if (started) return;
    started = true;
    try {
      cloud = await loadFirebase();
    } catch {
      session.status = 'unavailable';
      emit();
      return;
    }
    cloud.authMod.onAuthStateChanged(cloud.auth, user => {
      handleUser(user);
    });
    cloud.authMod
      .getRedirectResult(cloud.auth)
      .then(result => result && result.user && finishLink())
      .catch(e => {
        if (e && e.code === 'auth/credential-already-in-use') resolveClash(e).catch(() => {});
      });
    window.addEventListener('online', () => {
      if (!cloud.auth.currentUser) startAnonymous();
      else if (!cloudReady) handleUser(cloud.auth.currentUser);
    });
  },

  async signIn() {
    if (!cloud) {
      const err = new Error('not ready');
      err.code = 'flit/not-ready';
      throw err;
    }
    const { authMod, auth } = cloud;
    const provider = new authMod.GoogleAuthProvider();
    const guest = auth.currentUser && auth.currentUser.isAnonymous ? auth.currentUser : null;
    try {
      if (guest) {
        await authMod.linkWithPopup(guest, provider);
        await finishLink();
      } else {
        await authMod.signInWithPopup(auth, provider);
      }
    } catch (e) {
      if (guest && e.code === 'auth/credential-already-in-use') {
        await resolveClash(e);
        return;
      }
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        if (guest) await authMod.linkWithRedirect(guest, provider);
        else await authMod.signInWithRedirect(auth, provider);
        return;
      }
      throw e;
    }
  },

  async signOut() {
    if (cloud) await cloud.authMod.signOut(cloud.auth);
  },

  beginRun() {
    runPromise = null;
    if (!cloudReady || !state.uid) return;
    runPromise = call('startRun')
      .then(out => out.runId)
      .catch(() => null);
  },

  recordRun({ score, flaps }) {
    if (!cloudReady || !state.uid) return false;
    const week = weekKey();
    const mine = state.weekBest.week === week ? state.weekBest.score : 0;
    state = {
      ...state,
      coins: state.coins + score,
      runs: state.runs + 1,
      best: Math.max(state.best, score),
      weekBest: { week, score: Math.max(mine, score) }
    };
    persist();
    emit();
    const pending = runPromise;
    runPromise = null;
    const uid = state.uid;
    Promise.resolve(pending)
      .then(runId => {
        if (!runId) throw new Error('no-run');
        return call('submitRun', { runId, score, flaps });
      })
      .then(out => {
        if (out.rejected) console.warn(`[flit] run not saved: ${out.rejected}`);
        if (state.uid === uid) applyServer(out.profile);
      })
      .catch(() => refresh());
    return true;
  },

  async buy(id) {
    const item = findItem(id);
    if (!item) return { ok: false, reason: 'unknown' };
    if (state.owned.includes(id)) return { ok: true };
    if (!cloudReady || !state.uid) return { ok: false, reason: 'offline' };
    try {
      const out = await call('buyItem', { id });
      applyServer(out.profile);
      return { ok: true };
    } catch (e) {
      if (e && e.code === 'coins') await refresh();
      return { ok: false, reason: e && e.code === 'coins' ? 'coins' : 'offline' };
    }
  },

  equip(id) {
    const item = findItem(id);
    if (!item || !state.owned.includes(id) || !cloudReady || !state.uid) return false;
    state = { ...state, equipped: { ...state.equipped, [kindOf(id)]: id } };
    persist();
    emit();
    call('equipItem', { id })
      .then(out => applyServer(out.profile))
      .catch(() => refresh());
    return true;
  },

  setPublicBoard(on) {
    if (!cloudReady || !state.uid || state.anon) return;
    state = { ...state, publicBoard: !!on };
    persist();
    emit();
    call('setPublicBoard', { on: !!on })
      .then(out => applyServer(out.profile))
      .catch(() => refresh());
  },

  async fetchBoard(scope) {
    return call('getBoard', { scope });
  }
};
