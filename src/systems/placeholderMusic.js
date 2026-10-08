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

export async function renderPlaceholderMusic({ bpm, offset = 0, beats }) {
  const spb = 60 / bpm;
  const duration = offset + beats * spb + 1;
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);

  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  const noise = makeNoiseBuffer(ctx);

  for (let b = 0; b < beats; b++) {
    const t = offset + b * spb;
    const bar = Math.floor(b / 4);
    const chord = CHORDS[bar % CHORDS.length];
    const intro = b < 8; // 2 mesures d'intro plus légères

    kick(ctx, master, t);
    if (!intro) {
      if (b % 2 === 1) clap(ctx, master, noise, t);
      hat(ctx, master, noise, t + spb / 2);
      // Basse en croches, octave basse de la fondamentale.
      bass(ctx, master, midiToHz(chord[0] - 24), t, spb * 0.45);
      bass(ctx, master, midiToHz(chord[0] - 12), t + spb / 2, spb * 0.45);
    }
    // Arpège en doubles croches.
    if (b >= 16) {
      for (let i = 0; i < 4; i++) {
        const note = chord[(b * 4 + i) % 3] + 12;
        lead(ctx, master, midiToHz(note), t + (i * spb) / 4, spb / 4);
      }
    }
    // Crash toutes les 8 mesures.
    if (b % 32 === 0 && b > 0) crash(ctx, master, noise, t);
  }

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
