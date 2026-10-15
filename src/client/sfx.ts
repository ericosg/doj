// Retro sound effects and chiptune music synthesised with Web Audio, so there are no audio assets.
// Browsers only allow audio after a user gesture, so the context starts on the first key or click.

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let noiseBuf: AudioBuffer;
let muted = readMuted();
let pendingTrack: TrackName | null = null;

function readMuted(): boolean {
  try {
    return localStorage.getItem("doj-muted") === "1";
  } catch {
    return false;
  }
}

/** Call once at boot: audio unlocks on the first key press or click; M toggles mute. */
export function initAudio(): void {
  const unlock = () => {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.55;
      musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
    if (pendingTrack) {
      const t = pendingTrack;
      pendingTrack = null;
      playMusic(t);
    }
  };
  window.addEventListener("keydown", (e) => {
    unlock();
    if (e.key === "m" || e.key === "M") toggleMute();
  });
  window.addEventListener("pointerdown", unlock);
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): void {
  muted = !muted;
  try {
    localStorage.setItem("doj-muted", muted ? "1" : "0");
  } catch {}
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.02);
}

// ---- Primitives -----------------------------------------------------------

interface ToneOpts {
  type?: OscillatorType;
  f: number;
  f2?: number; // glide target
  dur: number;
  vol?: number;
  at?: number; // seconds from now
  when?: number; // absolute context time (music)
  vibrato?: number; // Hz
  bus?: GainNode;
}

function tone(o: ToneOpts): void {
  if (!ctx) return;
  const t = o.when ?? ctx.currentTime + (o.at ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "square";
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = o.vibrato;
    depth.gain.value = o.f * 0.04;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + o.dur);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.15, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(o.bus ?? sfxBus);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

function noise(o: { dur: number; vol?: number; at?: number; filter?: BiquadFilterType; f?: number; f2?: number; q?: number }): void {
  if (!ctx) return;
  const t = ctx.currentTime + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filt = ctx.createBiquadFilter();
  filt.type = o.filter ?? "lowpass";
  filt.frequency.setValueAtTime(o.f ?? 2000, t);
  if (o.f2) filt.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
  filt.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(filt).connect(g).connect(sfxBus);
  src.start(t, Math.random() * 1.5);
  src.stop(t + o.dur + 0.02);
}

const arp = (notes: number[], step: number, o: Omit<ToneOpts, "f">) => notes.forEach((f, i) => tone({ ...o, f, at: (o.at ?? 0) + i * step }));

// ---- Effects --------------------------------------------------------------

export const sfx = {
  move: () => tone({ f: 660, dur: 0.04, vol: 0.06 }),
  confirm: () => arp([880, 1320], 0.05, { dur: 0.06, vol: 0.08 }),
  deny: () => tone({ f: 140, dur: 0.14, vol: 0.12 }),
  slash: () => {
    noise({ filter: "highpass", f: 4000, f2: 700, dur: 0.16, vol: 0.25 });
    tone({ type: "triangle", f: 320, f2: 110, dur: 0.12, vol: 0.12 });
  },
  hit: (heavy = false) => {
    noise({ f: heavy ? 900 : 1600, dur: heavy ? 0.22 : 0.12, vol: heavy ? 0.4 : 0.28 });
    tone({ type: "sine", f: heavy ? 110 : 150, f2: 40, dur: heavy ? 0.3 : 0.16, vol: 0.45 });
  },
  blocked: () => {
    tone({ type: "triangle", f: 1400, dur: 0.12, vol: 0.12 });
    tone({ type: "square", f: 2100, dur: 0.06, vol: 0.04 });
  },
  fire: () => {
    noise({ filter: "bandpass", f: 300, f2: 1800, dur: 0.4, vol: 0.3, q: 0.8 });
    tone({ type: "sawtooth", f: 90, f2: 55, dur: 0.35, vol: 0.06 });
  },
  thunder: () => {
    noise({ f: 4000, f2: 150, dur: 1.0, vol: 0.55 });
    tone({ type: "square", f: 70, f2: 30, dur: 0.6, vol: 0.12 });
  },
  heal: () => arp([523, 659, 784, 1047], 0.07, { type: "sine", dur: 0.18, vol: 0.12 }),
  block: () => {
    tone({ type: "triangle", f: 900, f2: 1200, dur: 0.18, vol: 0.12 });
    noise({ filter: "highpass", f: 5000, dur: 0.1, vol: 0.06 });
  },
  burn: () => noise({ filter: "bandpass", f: 900, f2: 400, dur: 0.25, vol: 0.18, q: 2 }),
  bleed: () => {
    tone({ type: "sawtooth", f: 220, f2: 90, dur: 0.18, vol: 0.06 });
    noise({ f: 700, dur: 0.15, vol: 0.15 });
  },
  empower: () => tone({ f: 220, f2: 880, dur: 0.32, vol: 0.09 }),
  weaken: () => tone({ f: 620, f2: 140, dur: 0.38, vol: 0.09 }),
  cleanse: () => arp([784, 1175, 1568], 0.06, { type: "sine", dur: 0.2, vol: 0.09 }),
  roar: () => {
    tone({ type: "sawtooth", f: 95, f2: 60, dur: 0.7, vol: 0.22, vibrato: 18 });
    noise({ f: 500, dur: 0.6, vol: 0.2 });
  },
  howl: () => tone({ type: "sine", f: 380, f2: 720, dur: 0.9, vol: 0.14, vibrato: 6 }),
  chime: () => arp([1047, 1319, 1568, 2093], 0.08, { type: "sine", dur: 0.3, vol: 0.08 }),
  shift: () => {
    noise({ filter: "bandpass", f: 150, f2: 3000, dur: 0.6, vol: 0.2, q: 3 });
    tone({ type: "sawtooth", f: 100, f2: 500, dur: 0.55, vol: 0.06 });
  },
  appear: () => {
    tone({ type: "triangle", f: 220, f2: 440, dur: 0.35, vol: 0.12 });
    noise({ filter: "bandpass", f: 600, f2: 1600, dur: 0.3, vol: 0.12 });
  },
  bossAppear: () => {
    tone({ type: "sawtooth", f: 55, dur: 1.6, vol: 0.18, vibrato: 3 });
    tone({ type: "sawtooth", f: 82, dur: 1.6, vol: 0.1, vibrato: 4 });
    noise({ f: 300, dur: 1.4, vol: 0.2 });
  },
  victory: () => arp([523, 659, 784, 1047, 784, 1047], 0.11, { dur: 0.22, vol: 0.1 }),
  fanfare: () => {
    arp([523, 523, 523, 698, 880, 784, 880, 1047], 0.14, { dur: 0.26, vol: 0.1 });
    arp([262, 262, 262, 349, 440, 392, 440, 523], 0.14, { type: "triangle", dur: 0.26, vol: 0.12 });
  },
  defeat: () => arp([392, 349, 330, 294, 262], 0.22, { type: "triangle", dur: 0.4, vol: 0.14 }),
};

// ---- Music ----------------------------------------------------------------

type TrackName = "title" | "battle" | "boss";

const midi = (n: string): number => {
  const m = /^([A-G])(#?)(-?\d)$/.exec(n)!;
  const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as "C"]! + (m[2] ? 1 : 0);
  return 440 * 2 ** ((semis + (Number(m[3]) + 1) * 12 - 69) / 12);
};
const seq = (s: string) => s.trim().split(/\s+/).map((t) => (t === "." ? null : midi(t)));

// Eighth-note steps; "." is a rest.
const TRACKS: Record<TrackName, { bpm: number; lead: (number | null)[]; bass: (number | null)[]; leadType: OscillatorType }> = {
  title: {
    bpm: 84,
    leadType: "triangle",
    lead: seq("A4 C5 E5 C5 A4 C5 E5 C5 F4 A4 C5 A4 F4 A4 C5 A4 C4 E4 G4 E4 C4 E4 G4 E4 G4 B4 D5 B4 G4 B4 D5 B4"),
    bass: seq("A2 . . . A2 . . . F2 . . . F2 . . . C3 . . . C3 . . . G2 . . . G2 . . ."),
  },
  battle: {
    bpm: 138,
    leadType: "square",
    lead: seq("A4 . C5 . E5 . D5 C5 . . A4 . G4 . . . F4 . A4 . C5 . B4 A4 G4 . . . E4 . . ."),
    bass: seq("A2 A2 A3 A2 A2 A2 G2 A2 F2 F2 F3 F2 G2 G2 G3 G2 A2 A2 A3 A2 A2 A2 G2 A2 F2 F2 F3 F2 E2 E2 E3 E2"),
  },
  boss: {
    bpm: 156,
    leadType: "sawtooth",
    lead: seq("D5 . A4 . F5 . E5 D5 C5 . A4 . A#4 . A4 . D5 . A4 . F5 . G5 F5 E5 . C5 . C#5 . . ."),
    bass: seq("D2 D2 D3 D2 D2 D2 C3 D3 A#1 A#1 A#2 A#1 C2 C2 C3 C2 D2 D2 D3 D2 D2 D2 C3 D3 A#1 A#1 A#2 A#1 A1 A1 A2 C#2"),
  },
};

let current: TrackName | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextTime = 0;

export function playMusic(name: TrackName): void {
  if (!ctx) {
    pendingTrack = name;
    return;
  }
  if (current === name && timer) return;
  stopMusic();
  current = name;
  step = 0;
  nextTime = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 25);
}

export function stopMusic(): void {
  if (timer) clearInterval(timer);
  timer = null;
  current = null;
  pendingTrack = null;
}

function schedule(): void {
  if (!ctx || !current) return;
  const tr = TRACKS[current];
  const stepDur = 60 / tr.bpm / 2;
  while (nextTime < ctx.currentTime + 0.12) {
    const lead = tr.lead[step % tr.lead.length];
    const bass = tr.bass[step % tr.bass.length];
    if (lead) tone({ type: tr.leadType, f: lead, dur: stepDur * 0.9, vol: tr.leadType === "sawtooth" ? 0.025 : 0.04, when: nextTime, bus: musicBus });
    if (bass) tone({ type: "triangle", f: bass, dur: stepDur * 0.85, vol: 0.09, when: nextTime, bus: musicBus });
    nextTime += stepDur;
    step++;
  }
}
