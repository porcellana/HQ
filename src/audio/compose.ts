/**
 * COMPOSICIÓN PROCEDURAL (pura, sin WebAudio): escalas, acordes y patrones.
 * Misma semilla + mismo perfil + mismo compás => las mismas notas (determinista y testeable).
 * Las notas se expresan en pulsos dentro de un compás de 4; el motor las convierte a segundos.
 */
import type { AmbienceDef, MusicProfile } from '@/data/schema';

export const BEATS_PER_BAR = 4;

/** Intervalos (semitonos) de cada escala. */
export const SCALES: Record<string, number[]> = {
  mayor: [0, 2, 4, 5, 7, 9, 11],
  menor: [0, 2, 3, 5, 7, 8, 10],
  dorico: [0, 2, 3, 5, 7, 9, 10],
  frigio: [0, 1, 3, 5, 7, 8, 10],
  lidio: [0, 2, 4, 6, 7, 9, 11],
  mixolidio: [0, 2, 4, 5, 7, 9, 10],
  armonica: [0, 2, 3, 5, 7, 8, 11],
  pentamenor: [0, 3, 5, 7, 10],
  pentamayor: [0, 2, 4, 7, 9],
};

export type Voice = 'pad' | 'bass' | 'lead' | 'arp' | 'kick' | 'snare' | 'hat';

export interface NoteEv {
  /** Pulso dentro del compás (0..4). */
  t: number;
  /** Duración en pulsos. */
  dur: number;
  /** Nota MIDI (ignorada en percusión). */
  midi: number;
  /** Volumen relativo 0..1. */
  vel: number;
  voice: Voice;
}

export function midiToHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Nota MIDI del grado `degree` (puede ser negativo o mayor que la escala: cambia de octava). */
export function degreeToMidi(scale: string, root: number, degree: number): number {
  const s = SCALES[scale] ?? SCALES.mayor!;
  const n = s.length;
  const oct = Math.floor(degree / n);
  return root + oct * 12 + s[((degree % n) + n) % n]!;
}

/** Acorde (tríada) sobre un grado de la escala. */
export function chordDegrees(degree: number): number[] {
  return [degree, degree + 2, degree + 4];
}

export function hash32(...parts: Array<string | number>): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Generador mulberry32 (misma secuencia para la misma semilla). */
export function rngFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BarOpts {
  /** 0 día .. 1 noche (más grave, lento y escaso). */
  night?: number;
  /** 0..1, sólo batalla: sube la percusión y las notas. */
  intensity?: number;
}

/** Duración de un compás en segundos. */
export function barSeconds(p: MusicProfile, opts: BarOpts = {}): number {
  const bpm = p.tempo * (1 - 0.12 * (opts.night ?? 0)) * (1 + 0.28 * (opts.intensity ?? 0));
  return (BEATS_PER_BAR * 60) / bpm;
}

/** Notas del compás `bar` de la pieza `p` para la semilla `seed`. */
export function composeBar(p: MusicProfile, seed: number, bar: number, opts: BarOpts = {}): NoteEv[] {
  const night = opts.night ?? 0;
  const inten = opts.intensity ?? 0;
  const rng = rngFrom(hash32(seed, p.id, 'bar', bar));
  const phrase = rngFrom(hash32(seed, p.id, 'frase', Math.floor(bar / 4)));
  const deg = p.progression[bar % p.progression.length]!;
  const chord = chordDegrees(deg);
  const m = (d: number, oct = 0) => degreeToMidi(p.scale, p.root + oct * 12, d);
  const out: NoteEv[] = [];
  const battle = p.style === 'marcha';

  // Colchón armónico (la marcha lo lleva más seco).
  if (p.style !== 'marcha') for (const d of chord) out.push({ t: 0, dur: BEATS_PER_BAR, midi: m(d), vel: p.style === 'pulso' ? 0.3 : 0.42, voice: 'pad' });
  // Bajo.
  if (battle || p.style === 'pulso') {
    const slots = battle ? 8 : 4;
    for (let i = 0; i < slots; i++) {
      if (battle && i % 2 === 1 && inten < 0.4 && i !== 3) continue;
      out.push({ t: (i * BEATS_PER_BAR) / slots, dur: 0.4, midi: m(deg, -2) + (i % 4 === 3 && battle ? 7 : 0), vel: i === 0 ? 0.85 : 0.55, voice: 'bass' });
    }
  } else {
    out.push({ t: 0, dur: 3.2, midi: m(deg, -2), vel: 0.6, voice: 'bass' });
    if (p.density > 0.5) out.push({ t: 2, dur: 1.6, midi: m(deg + 4, -2), vel: 0.35, voice: 'bass' });
  }

  // Arpegio: corcheas por los tonos del acorde.
  if (p.style === 'arpegio' || (battle && inten > 0.5)) {
    const pat = [0, 1, 2, 1, 2, 1, 0, 1];
    const step = battle ? 0.5 : p.density > 0.4 ? 0.5 : 1;
    for (let t = 0, i = 0; t < BEATS_PER_BAR; t += step, i++) {
      if (rng() > 0.55 + 0.45 * p.density) continue;
      out.push({ t, dur: step * 0.9, midi: m(chord[pat[i % 8]!]!, battle ? 0 : 1), vel: 0.22 + 0.06 * rng(), voice: 'arp' });
    }
  }

  // Melodía: máscara rítmica por frase (se repite 4 compases con pequeñas variaciones).
  const mask: boolean[] = [];
  for (let i = 0; i < 8; i++) mask.push(i === 0 || phrase() < p.density * (1 - 0.45 * night) * (battle ? 0.9 + inten * 0.3 : 0.8));
  const leadOct = night > 0.5 ? 0 : 1;
  let cur = chord[phrase() < 0.5 ? 1 : 2]!;
  for (let i = 0; i < 8; i++) {
    if (!mask[i] || (i > 0 && rng() < 0.2)) continue;
    const strong = i % 4 === 0;
    if (strong) cur = chord[Math.floor(rng() * 3)]! + (rng() < 0.25 ? 7 : 0);
    else cur += Math.floor(rng() * 5) - 2;
    cur = Math.max(deg - 3, Math.min(deg + 9, cur));
    let len = 1;
    while (i + len < 8 && !mask[i + len] && len < 3) len++;
    out.push({ t: i * 0.5, dur: Math.max(0.5, len * 0.5 * 0.95), midi: m(cur, leadOct), vel: strong ? 0.5 : 0.38, voice: 'lead' });
  }

  // Percusión (sólo piezas con `drums`).
  const dr = (p.drums ?? 0) * (0.55 + 0.6 * inten);
  if (dr > 0.15) {
    for (const t of [0, 2]) out.push({ t, dur: 0.2, midi: 0, vel: Math.min(1, 0.6 + dr * 0.4), voice: 'kick' });
    if (dr > 0.55) out.push({ t: 1.5, dur: 0.2, midi: 0, vel: 0.5, voice: 'kick' });
    if (dr > 0.3) for (const t of [1, 3]) out.push({ t, dur: 0.2, midi: 0, vel: 0.45 + dr * 0.2, voice: 'snare' });
    if (dr > 0.45) for (let t = 0.5; t < BEATS_PER_BAR; t += 1) out.push({ t, dur: 0.1, midi: 0, vel: 0.3, voice: 'hat' });
    if (dr > 0.85) for (let t = 0.25; t < BEATS_PER_BAR; t += 0.5) out.push({ t, dur: 0.1, midi: 0, vel: 0.18, voice: 'hat' });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Intensidad de batalla 0..1 según la vida restante de cada bando (sube al final). */
export function battleIntensity(foeHp: number, foeMax: number, partyHp: number, partyMax: number): number {
  const foe = foeMax > 0 ? 1 - foeHp / foeMax : 0;
  const party = partyMax > 0 ? 1 - partyHp / partyMax : 0;
  return Math.max(0, Math.min(1, Math.max(foe * 0.9, party * 1.1) ** 1.4 + 0.1));
}

/** Fanfarria breve: devuelve notas (en pulsos de 120 bpm: 1 pulso = 0,5 s) y su duración en pulsos. */
export function fanfare(kind: 'victoria' | 'derrota'): { notes: NoteEv[]; beats: number } {
  const notes: NoteEv[] = [];
  const root = kind === 'victoria' ? 60 : 57;
  const scale = kind === 'victoria' ? 'mayor' : 'menor';
  const lead = kind === 'victoria' ? [0, 2, 4, 7, 4, 7, 9, 11, 14] : [4, 2, 1, 0, -1, 0];
  const times = kind === 'victoria' ? [0, 0.5, 1, 1.5, 2.5, 3, 3.5, 4, 5] : [0, 1, 2, 3, 4.5, 6];
  const durs = kind === 'victoria' ? [0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 1, 3] : [1, 1, 1, 1.5, 1.5, 4];
  lead.forEach((d, i) => notes.push({ t: times[i]!, dur: durs[i]!, midi: degreeToMidi(scale, root, d), vel: 0.7, voice: 'lead' }));
  const chords = kind === 'victoria' ? [[0, 0], [3, 2.5], [4, 4], [0, 5]] : [[0, 0], [5, 2], [3, 4], [0, 6]];
  for (const [d, t] of chords as Array<[number, number]>) {
    const len = kind === 'victoria' ? (t === 5 ? 3 : 1.5) : t === 6 ? 4 : 2;
    for (const c of chordDegrees(d)) notes.push({ t, dur: len, midi: degreeToMidi(scale, root - 12, c), vel: 0.45, voice: 'pad' });
    notes.push({ t, dur: len, midi: degreeToMidi(scale, root - 24, d), vel: 0.7, voice: 'bass' });
  }
  if (kind === 'victoria') for (const t of [0, 1, 2.5, 4, 5]) notes.push({ t, dur: 0.2, midi: 0, vel: 0.7, voice: 'kick' });
  return { notes: notes.sort((a, b) => a.t - b.t), beats: kind === 'victoria' ? 8 : 10 };
}

export interface AmbientMix {
  viento: number;
  agua: number;
  fuego: number;
  pajaros: number;
  grillos: number;
  goteo: number;
}

/** Niveles de cada capa de ambiente según la hora: de día pájaros, de noche grillos. */
export function ambientMix(a: AmbienceDef | undefined, night: number): AmbientMix {
  const g = (v: number | undefined) => Math.max(0, Math.min(1, v ?? 0));
  const dayF = Math.max(0, 1 - night * 1.6);
  const nightF = Math.max(0, night * 1.6 - 0.6);
  return {
    viento: g(a?.viento), agua: g(a?.agua), fuego: g(a?.fuego), goteo: g(a?.goteo),
    pajaros: g(a?.pajaros) * Math.min(1, dayF), grillos: g(a?.grillos) * Math.min(1, nightF),
  };
}

/** Segundos hasta el próximo suceso de un proceso de Poisson (`rate` sucesos por segundo). */
export function nextEventDelay(rate: number, u: number): number {
  return rate <= 0 ? Infinity : -Math.log(1 - Math.min(0.999, Math.max(0, u))) / rate;
}
