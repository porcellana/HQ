/**
 * EFECTOS DE SONIDO GENERADOS POR CÓDIGO (WebAudio, sin archivos)
 * Cada efecto es una pequeña receta de osciladores y ruido. Para crear uno
 * nuevo, añade una entrada en RECIPES y emítelo desde el juego con su id.
 */
import type { SfxId } from '@/game/game';

type Ctx = AudioContext;
type Recipe = (ctx: Ctx, out: AudioNode, t: number) => void;

/** Nota con envolvente rápida. */
function tone(ctx: Ctx, out: AudioNode, t: number, freq: number, dur: number, type: OscillatorType = 'square', gain = 0.25, slideTo?: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
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

  play(id: SfxId): void {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    if (ctx.state === 'suspended') void ctx.resume();
    master.gain.value = VOLUME[this.volume];
    try {
      RECIPES[id](ctx, master, ctx.currentTime + 0.01);
    } catch {
      /* sin audio disponible */
    }
  }
}
