// Musique électro de remplacement, générée à la volée quand le mp3 du niveau
// est absent. Elle respecte le BPM et l'offset du niveau, donc la synchro est
// la même qu'avec la vraie piste.

const SAMPLE_RATE = 44100;

// Progression Am - F - C - G (une mesure de 4 beats par accord).
const CHORDS = [
  [57, 60, 64], // A minor
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

const LOOP_BEATS = 32; // 8 mesures

// Rend une boucle de 8 mesures puis la répète sur toute la durée du niveau
// (beaucoup plus rapide que de tout synthétiser).
export async function renderPlaceholderMusic({ bpm, offset = 0, beats }) {
  const spb = 60 / bpm;
  const loop = await renderLoop(spb);
  const loopLen = Math.round(LOOP_BEATS * spb * SAMPLE_RATE);
  const start = Math.round(Math.max(0, offset) * SAMPLE_RATE);
  const length = start + Math.ceil((beats * spb + 1) * SAMPLE_RATE);
  const out = new AudioBuffer({ length, numberOfChannels: 2, sampleRate: SAMPLE_RATE });
  for (let c = 0; c < 2; c++) {
    const src = loop.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = start; i < length; i++) dst[i] = src[(i - start) % loopLen];
  }
  return out;
}

async function renderLoop(spb) {
  const ctx = new OfflineAudioContext(2, Math.round(LOOP_BEATS * spb * SAMPLE_RATE), SAMPLE_RATE);
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  const noise = makeNoiseBuffer(ctx);

  for (let b = 0; b < LOOP_BEATS; b++) {
    const t = b * spb;
    const chord = CHORDS[Math.floor(b / 4) % CHORDS.length];
    kick(ctx, master, t);
    if (b % 2 === 1) clap(ctx, master, noise, t);
    hat(ctx, master, noise, t + spb / 2);
    // Basse en croches, octave basse de la fondamentale.
    bass(ctx, master, midiToHz(chord[0] - 24), t, spb * 0.45);
    bass(ctx, master, midiToHz(chord[0] - 12), t + spb / 2, spb * 0.45);
    // Arpège en doubles croches.
    for (let i = 0; i < 4; i++) {
      const note = chord[(b * 4 + i) % 3] + 12;
      lead(ctx, master, midiToHz(note), t + (i * spb) / 4, spb / 4);
    }
  }
  crash(ctx, master, noise, 0);
  return ctx.startRendering();
}

function makeNoiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, SAMPLE_RATE, SAMPLE_RATE);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function env(ctx, dest, t, attack, decay, peak) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(dest);
  return g;
}

function kick(ctx, dest, t) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  osc.connect(env(ctx, dest, t, 0.002, 0.25, 1));
  osc.start(t);
  osc.stop(t + 0.3);
}

function noiseHit(ctx, dest, noise, t, { type, freq, decay, peak }) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  src.connect(filter);
  filter.connect(env(ctx, dest, t, 0.001, decay, peak));
  src.start(t);
  src.stop(t + decay + 0.05);
}

const hat = (ctx, d, n, t) => noiseHit(ctx, d, n, t, { type: 'highpass', freq: 8000, decay: 0.05, peak: 0.25 });
const clap = (ctx, d, n, t) => noiseHit(ctx, d, n, t, { type: 'bandpass', freq: 1500, decay: 0.15, peak: 0.6 });
const crash = (ctx, d, n, t) => noiseHit(ctx, d, n, t, { type: 'highpass', freq: 5000, decay: 1.2, peak: 0.3 });

function bass(ctx, dest, freq, t, len) {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.exponentialRampToValueAtTime(200, t + len);
  osc.connect(filter);
  filter.connect(env(ctx, dest, t, 0.005, len, 0.35));
  osc.start(t);
  osc.stop(t + len + 0.05);
}

function lead(ctx, dest, freq, t, len) {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = freq;
  osc.connect(env(ctx, dest, t, 0.003, len * 0.9, 0.08));
  osc.start(t);
  osc.stop(t + len + 0.02);
}

// Encode un AudioBuffer en WAV 16 bits (utilisé par le mode "garder la tonalité").
export function audioBufferToWavBlob(buffer) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2;
  const view = new DataView(new ArrayBuffer(44 + length));
  const writeStr = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, length, true);
  const data = [...Array(channels)].map((_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}
