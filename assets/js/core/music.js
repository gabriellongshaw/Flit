const BPM = 124;
const STEPS_PER_BAR = 16;

export const STEP_SECONDS = 60 / BPM / 4;

const NOTE = /^([A-G])([#b]?)(\d)$/;
const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midi(name) {
  const m = NOTE.exec(name);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + SEMITONES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const freq = m => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = {
  Am: { bass: 45, pad: [57, 60, 64, 69], arp: [64, 69, 72, 76] },
  F: { bass: 41, pad: [57, 60, 65, 69], arp: [65, 69, 72, 77] },
  C: { bass: 48, pad: [55, 60, 64, 67], arp: [64, 67, 72, 76] },
  G: { bass: 43, pad: [55, 59, 62, 67], arp: [62, 67, 71, 74] }
};

const SCORE = [
  ['Am', 'A4 - C5 - E5 - . E5 D5 - C5 - A4 - . .'],
  ['F', 'F5 - . C5 F5 - A5 - G5 - F5 - C5 - . .'],
  ['C', 'G5 - E5 - C5 - . E5 G5 - C6 - B5 - G5 -'],
  ['G', 'A5 - G5 - D5 - . G5 B5 - A5 - G5 - . .'],
  ['Am', 'E5 - . A5 C6 - B5 - A5 - E5 - . A5 C6 -'],
  ['F', 'A5 - F5 - . C6 A5 - F5 - A5 - C6 - . .'],
  ['C', 'E5 - G5 - C6 - E6 - D6 - C6 - G5 - E5 -'],
  ['G', 'D6 - B5 - G5 - . B5 D6 - G6 - . . D6 .']
];

export const TOTAL_STEPS = SCORE.length * STEPS_PER_BAR;

const BASS = [
  [0, 0, 2],
  [2, 12, 1],
  [3, 0, 1],
  [4, 0, 2],
  [6, 12, 1],
  [7, 0, 1],
  [8, 0, 2],
  [10, 12, 1],
  [11, 0, 1],
  [12, 0, 2],
  [14, 12, 1],
  [15, 0, 1]
];
const ARP = [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 3, 2, 1, 3];

function parseLead(text) {
  const events = [];
  text.split(' ').forEach((token, i) => {
    if (token === '-' && events.length) events[events.length - 1].len += 1;
    else if (token === '.' || token === '-') events.push({ at: i, midi: null, len: 1 });
    else events.push({ at: i, midi: midi(token), len: 1 });
  });
  return events.filter(e => e.midi !== null);
}

const LEADS = SCORE.map(([, lead]) => parseLead(lead));

const human = () => 0.94 + Math.random() * 0.12;

export function createInstruments(ctx, noise) {
  const rate = ctx.sampleRate;
  const reverb = ctx.createConvolver();
  const length = Math.floor(rate * 0.9);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    let low = 0;
    for (let i = 0; i < length; i++) {
      low += (Math.random() * 2 - 1 - low) * 0.5;
      data[i] = low * Math.pow(1 - i / length, 2.8);
    }
  }
  reverb.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  reverb.connect(wet);

  const pump = ctx.createGain();
  let attached = null;

  const sends = {};
  const level = { lead: 0.22, arp: 0.18, pad: 0.4, clap: 0.35, bass: 0, drum: 0 };
  const pumped = new Set(['lead', 'arp', 'pad', 'bass']);
  for (const key of Object.keys(level)) {
    sends[key] = ctx.createGain();
    sends[key].gain.value = level[key];
    if (level[key] > 0) sends[key].connect(reverb);
  }

  function attach(bus) {
    if (attached === bus) return;
    if (attached) {
      wet.disconnect();
      pump.disconnect();
    }
    wet.connect(bus);
    pump.connect(bus);
    attached = bus;
  }

  function out(node, bus, kind) {
    node.connect(pumped.has(kind) ? pump : bus);
    if (level[kind] > 0) node.connect(sends[kind]);
  }

  function duck(t, depth = 0.35) {
    pump.gain.setValueAtTime(depth, t);
    pump.gain.linearRampToValueAtTime(1, t + 0.2);
  }

  function ring(bus, kind, { type = 'sine', hz, t, vol, decay, attack = 0.003 }) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.setTargetAtTime(0, t + attack, decay / 4);
    osc.connect(gain);
    out(gain, bus, kind);
    osc.start(t);
    osc.stop(t + decay * 1.6 + attack);
  }

  function arp(bus, { hz, t, vol }) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(hz, t);
    filter.type = 'lowpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(4200, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + 0.11);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.003);
    gain.gain.setTargetAtTime(0, t + 0.004, 0.035);
    osc.connect(filter).connect(gain);
    out(gain, bus, 'arp');
    osc.start(t);
    osc.stop(t + 0.22);
  }

  function lead(bus, { hz, t, dur, vol }) {
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const end = t + Math.max(dur, 0.12);
    filter.type = 'lowpass';
    filter.Q.value = 1.5;
    filter.frequency.setValueAtTime(3800, t);
    filter.frequency.exponentialRampToValueAtTime(1700, end);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.006);
    gain.gain.setValueAtTime(vol * 0.85, end - 0.03);
    gain.gain.linearRampToValueAtTime(0, end + 0.07);
    [-8, 8].forEach(detune => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(hz, t);
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(t);
      osc.stop(end + 0.1);
    });
    filter.connect(gain);
    out(gain, bus, 'lead');
  }

  function pad(bus, { notes, t, dur, vol }) {
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, t);
    filter.frequency.linearRampToValueAtTime(2200, t + dur * 0.5);
    filter.frequency.linearRampToValueAtTime(1200, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.2);
    gain.gain.setValueAtTime(vol, t + dur - 0.25);
    gain.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    notes.forEach(note => {
      [-9, 9].forEach(detune => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq(note), t);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + dur + 0.1);
      });
    });
    filter.connect(gain);
    out(gain, bus, 'pad');
  }

  function bass(bus, { hz, t, dur, vol }) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const end = t + Math.max(dur, 0.06);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz, t);
    filter.type = 'lowpass';
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(1500, t);
    filter.frequency.exponentialRampToValueAtTime(260, end);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.005);
    gain.gain.setValueAtTime(vol, end - 0.02);
    gain.gain.linearRampToValueAtTime(0, end + 0.03);
    osc.connect(filter).connect(gain);
    out(gain, bus, 'bass');
    osc.start(t);
    osc.stop(end + 0.06);
    ring(bus, 'bass', { hz, t, vol: vol * 0.9, decay: Math.max(dur, 0.1), attack: 0.005 });
  }

  function noiseHit(bus, kind, t, { type, freq: f, q = 0.8, dur, vol }) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = noise;
    src.loop = true;
    filter.type = type;
    filter.frequency.setValueAtTime(f, t);
    filter.Q.value = q;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain);
    out(gain, bus, kind);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  function kick(bus, t, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(gain);
    out(gain, bus, 'drum');
    osc.start(t);
    osc.stop(t + 0.3);
    noiseHit(bus, 'drum', t, { type: 'highpass', freq: 3000, dur: 0.012, vol: vol * 0.25 });
  }

  function snare(bus, t, vol) {
    noiseHit(bus, 'clap', t, { type: 'bandpass', freq: 1900, q: 0.7, dur: 0.16, vol });
    noiseHit(bus, 'clap', t + 0.011, { type: 'bandpass', freq: 2600, q: 0.9, dur: 0.1, vol: vol * 0.6 });
    ring(bus, 'drum', { type: 'triangle', hz: 210, t, vol: vol * 0.7, decay: 0.1 });
  }

  function hat(bus, t, vol) {
    noiseHit(bus, 'drum', t, { type: 'highpass', freq: 7500, dur: 0.04, vol });
  }

  return { attach, duck, arp, lead, pad, bass, kick, snare, hat };
}

export function scheduleStep(inst, bus, step, t) {
  inst.attach(bus);
  const bar = Math.floor(step / STEPS_PER_BAR);
  const pos = step % STEPS_PER_BAR;
  const [name] = SCORE[bar];
  const chord = CHORDS[name];

  if (pos === 0) inst.pad(bus, { notes: chord.pad, t, dur: STEPS_PER_BAR * STEP_SECONDS, vol: 0.04 });

  if (pos % 4 === 0 || (bar % 2 === 1 && pos === 10)) {
    inst.kick(bus, t, 0.6);
    inst.duck(t, pos === 10 ? 0.6 : 0.3);
  }

  for (const [at, lift, len] of BASS) {
    if (at === pos) inst.bass(bus, { hz: freq(chord.bass + lift), t, dur: len * STEP_SECONDS * 0.9, vol: 0.2 * human() });
  }

  const note = chord.arp[ARP[pos]];
  inst.arp(bus, { hz: freq(note), t, vol: 0.11 * (pos % 4 === 0 ? 1.15 : 1) * human() });

  for (const e of LEADS[bar]) {
    if (e.at === pos) {
      inst.lead(bus, { hz: freq(e.midi), t: t + Math.random() * 0.004, dur: e.len * STEP_SECONDS * 0.95, vol: 0.115 * human() });
    }
  }

  if (pos === 4 || pos === 12) inst.snare(bus, t, 0.2);
  if (pos % 2 === 0) inst.hat(bus, t, 0.11 * (pos % 4 === 0 ? 1 : 0.55) * human());
}