import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const write = process.argv.includes('--write');
const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!account.private_key) {
  console.error('Set FIREBASE_SERVICE_ACCOUNT to the service account JSON.');
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(account) });
const db = getFirestore();

const whole = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const weekKey = date => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
};
const thisWeek = weekKey(new Date());

const [profiles, board, entries] = await Promise.all([db.collection('flitProfiles').get(), db.collection('flitBoard').get(), db.collectionGroup('entries').get()]);

const boardScore = new Map(board.docs.map(d => [d.id, whole(d.data().score)]));
const weekScores = new Map();
const pastBest = new Map();
for (const d of entries.docs) {
  const match = d.ref.path.match(/^flitWeeks\/([^/]+)\/entries\/([^/]+)$/);
  if (!match) continue;
  const [, week, uid] = match;
  const score = whole(d.data().score);
  pastBest.set(uid, Math.max(pastBest.get(uid) || 0, score));
  if (week === thisWeek) weekScores.set(uid, score);
}

let changed = 0;
for (const doc of profiles.docs) {
  const uid = doc.id;
  const data = doc.data();
  const wb = data.weekBest || {};
  const weekMine = wb.week === thisWeek ? whole(wb.score) : 0;
  const best = Math.max(whole(data.best), boardScore.get(uid) || 0, pastBest.get(uid) || 0, weekMine);
  const week = Math.max(weekMine, weekScores.get(uid) || 0);
  const updates = {};
  if (best !== whole(data.best)) updates.best = best;
  if (week !== weekMine) updates.weekBest = { week: thisWeek, score: week };
  const publish = data.publicBoard !== false;
  const needAll = publish && best > 0 && boardScore.get(uid) !== best;
  const needWeek = publish && week > 0 && weekScores.get(uid) !== week;
  if (!Object.keys(updates).length && !needAll && !needWeek) continue;
  changed++;
  console.log(uid, JSON.stringify({ profileBest: whole(data.best), board: boardScore.get(uid) || 0, week: weekScores.get(uid) || 0, setBest: best, setWeek: week }));
  if (!write) continue;
  const name = (board.docs.find(d => d.id === uid)?.data().name) || data.username || data.displayName || 'Player';
  if (Object.keys(updates).length) await doc.ref.update(updates);
  if (needAll) await db.doc(`flitBoard/${uid}`).set({ name, score: best, updatedAt: new Date() }, { merge: true });
  if (needWeek) await db.doc(`flitWeeks/${thisWeek}/entries/${uid}`).set({ name, score: week, updatedAt: new Date() }, { merge: true });
}
console.log(`${changed} player(s) ${write ? 'updated' : 'would change (dry run, add --write to apply)'}`);