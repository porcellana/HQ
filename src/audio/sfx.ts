/**
 * EFECTOS DE SONIDO GENERADOS POR CÓDIGO (WebAudio, sin archivos)
 * Cada efecto es una pequeña receta de osciladores y ruido. Para crear uno
 * nuevo, añade una entrada en RECIPES y emítelo desde el juego con su id.
 */
import type { SfxId } from '@/game/game';

type Ctx = AudioContext;
type Recipe = (ctx: Ctx, out: AudioNode, t: number) => void;

/** Factor de tono global del efecto que se está generando. */
let pitchRate = 1;

/** Nota con envolvente rápida. */
function tone(ctx: Ctx, out: AudioNode, t: number, freq: number, dur: number, type: OscillatorType = 'square', gain = 0.25, slideTo?: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq * pitchRate, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo * pitchRate, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Golpe de ruido filtrado (impactos). */
function noise(ctx: Ctx, out: AudioNode, t: number, dur: number, freq = 1200, gain = 0.35): void {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

/** Ruido filtrado con barrido de frecuencia (whoosh, chisporroteo, chapoteo). */
function sweep(ctx: Ctx, out: AudioNode, t: number, dur: number, from: number, to: number, gain = 0.25, type: BiquadFilterType = 'bandpass', q = 1.2): void {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

const RECIPES: Record<SfxId, Recipe> = {
  golpe: (c, o, t) => { noise(c, o, t, 0.09, 900); tone(c, o, t, 140, 0.08, 'triangle', 0.2, 70); },
  critico: (c, o, t) => { noise(c, o, t, 0.15, 2200, 0.45); tone(c, o, t, 660, 0.12, 'square', 0.15, 990); },
  fallo: (c, o, t) => noise(c, o, t, 0.12, 3000, 0.12),
  herido: (c, o, t) => { tone(c, o, t, 220, 0.15, 'sawtooth', 0.15, 110); noise(c, o, t, 0.08, 600, 0.2); },
  moneda: (c, o, t) => { tone(c, o, t, 988, 0.06, 'square', 0.12); tone(c, o, t + 0.06, 1319, 0.12, 'square', 0.12); },
  cofre: (c, o, t) => { tone(c, o, t, 330, 0.08, 'triangle', 0.2); tone(c, o, t + 0.08, 494, 0.08, 'triangle', 0.2); tone(c, o, t + 0.16, 659, 0.2, 'triangle', 0.2); },
  mision: (c, o, t) => [523, 659, 784].forEach((f, i) => tone(c, o, t + i * 0.09, f, 0.18, 'square', 0.12)),
  nivel: (c, o, t) => [392, 523, 659, 784, 1047].forEach((f, i) => tone(c, o, t + i * 0.08, f, 0.22, 'square', 0.12)),
  muerte: (c, o, t) => [330, 262, 196, 131].forEach((f, i) => tone(c, o, t + i * 0.2, f, 0.35, 'triangle', 0.22)),
  victoria: (c, o, t) => [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(c, o, t + i * 0.13, f, 0.25, 'square', 0.13)),

  // ---- Combate cinematográfico (v0.5): capas que se suman a golpe/crítico/herido ----
  /** Silbido del arma al atacar. */
  whoosh: (c, o, t) => sweep(c, o, t, 0.22, 500, 3200, 0.22),
  /** Tajo metálico. */
  imp_tajo: (c, o, t) => { sweep(c, o, t, 0.14, 4200, 1800, 0.2, 'highpass', 0.7); tone(c, o, t, 1500, 0.1, 'sawtooth', 0.06, 700); },
  /** Golpe seco y grave. */
  imp_contundente: (c, o, t) => { tone(c, o, t, 110, 0.18, 'sine', 0.35, 45); noise(c, o, t, 0.1, 500, 0.3); },
  /** Chisporroteo y llamarada. */
  imp_fuego: (c, o, t) => { sweep(c, o, t, 0.4, 700, 220, 0.3, 'lowpass', 0.8); for (let i = 0; i < 5; i++) tone(c, o, t + 0.04 * i, 900 + i * 130, 0.04, 'square', 0.05); },
  /** Cristal que se rompe. */
  imp_hielo: (c, o, t) => { [2400, 3100, 3900, 2900].forEach((f, i) => tone(c, o, t + i * 0.035, f, 0.1, 'triangle', 0.1)); sweep(c, o, t, 0.2, 6000, 2500, 0.12, 'highpass'); },
  /** Chasquido eléctrico. */
  imp_rayo: (c, o, t) => { noise(c, o, t, 0.06, 6000, 0.4); tone(c, o, t, 1800, 0.18, 'sawtooth', 0.12, 120); tone(c, o, t + 0.07, 900, 0.12, 'square', 0.08, 90); },
  /** Chapoteo viscoso. */
  imp_veneno: (c, o, t) => { sweep(c, o, t, 0.25, 300, 900, 0.22, 'bandpass', 4); tone(c, o, t + 0.09, 420, 0.08, 'sine', 0.12, 800); },
  /** Campanilla luminosa. */
  imp_sagrado: (c, o, t) => [1319, 1760, 2093].forEach((f, i) => tone(c, o, t + i * 0.05, f, 0.35, 'sine', 0.1)),
  /** Zumbido oscuro. */
  imp_sombra: (c, o, t) => { tone(c, o, t, 90, 0.4, 'sawtooth', 0.14, 55); tone(c, o, t, 135, 0.4, 'sine', 0.1, 70); sweep(c, o, t, 0.4, 900, 200, 0.12, 'lowpass'); },
  /** Capa grave y larga para los críticos. */
  critico_grave: (c, o, t) => { tone(c, o, t, 70, 0.5, 'sine', 0.4, 38); noise(c, o, t, 0.3, 1500, 0.3); tone(c, o, t + 0.05, 330, 0.3, 'sawtooth', 0.08, 165); },
  /** Campana corta: empieza tu turno. */
  turno: (c, o, t) => { tone(c, o, t, 880, 0.35, 'sine', 0.13); tone(c, o, t + 0.01, 1760, 0.25, 'sine', 0.05); },
  /** Ding de botín (el tono lo ajusta la rareza). */
  ding: (c, o, t) => { tone(c, o, t, 1568, 0.3, 'sine', 0.13); tone(c, o, t + 0.02, 3136, 0.2, 'sine', 0.04); },
  /** Acorde ascendente de victoria. */
  victoria_acorde: (c, o, t) => [[392, 494, 587], [523, 659, 784], [659, 784, 1047]].forEach((ch, i) => ch.forEach((f) => tone(c, o, t + i * 0.18, f, i === 2 ? 0.9 : 0.3, 'triangle', 0.09))),
  /** El enemigo se desintegra. */
  desintegra: (c, o, t) => { sweep(c, o, t, 0.5, 2500, 150, 0.2, 'bandpass', 2); tone(c, o, t, 400, 0.4, 'triangle', 0.08, 80); },
  /** Empieza el combate. */
  combate: (c, o, t) => { tone(c, o, t, 196, 0.25, 'sawtooth', 0.14, 147); tone(c, o, t + 0.12, 147, 0.4, 'sawtooth', 0.14, 110); noise(c, o, t, 0.2, 800, 0.15); },
};

const VOLUME = { bajo: 0.25, medio: 0.5, alto: 0.9 } as const;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;
  volume: keyof typeof VOLUME = 'medio';

  /** El navegador sólo permite audio tras un toque: se llama en el primer toque. */
  unlock(): void {
    if (this.ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  /** Reproduce un efecto, opcionalmente tras `delaySec` y con un factor de tono. */
  play(id: SfxId, delaySec = 0, rate = 1): void {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    if (ctx.state === 'suspended') void ctx.resume();
    master.gain.value = VOLUME[this.volume];
    try {
      // `rate` transpone los tonos (ding de botín según la rareza).
      pitchRate = rate;
      RECIPES[id](ctx, master, ctx.currentTime + 0.01 + Math.max(0, delaySec));
    } catch {
      /* sin audio disponible */
    } finally {
      pitchRate = 1;
    }
  }
}
