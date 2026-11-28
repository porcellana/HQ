import { describe, expect, it } from 'vitest';
import { PROFILES, musicIdFor, battleMusicId, stepSfxFor } from '@/data/music';
import { SCALES, ambientMix, barSeconds, battleIntensity, chordDegrees, composeBar, degreeToMidi, fanfare, nextEventDelay } from '@/audio/compose';
import { BIOME_LIST } from '@/data/registry';

describe('composición', () => {
  it('escalas: grados y octavas', () => {
    expect(degreeToMidi('mayor', 60, 0)).toBe(60);
    expect(degreeToMidi('mayor', 60, 7)).toBe(72);
    expect(degreeToMidi('mayor', 60, -1)).toBe(59);
    expect(degreeToMidi('pentamenor', 60, 5)).toBe(72);
    expect(chordDegrees(3)).toEqual([3, 5, 7]);
  });
  it('es determinista por semilla y varía con ella', () => {
    const p = PROFILES.campiña!;
    expect(composeBar(p, 5, 3)).toEqual(composeBar(p, 5, 3));
    const a = JSON.stringify([0, 1, 2, 3].map((b) => composeBar(p, 5, b)));
    const b = JSON.stringify([0, 1, 2, 3].map((b2) => composeBar(p, 99, b2)));
    expect(a).not.toBe(b);
  });
  it('todos los perfiles son válidos y suenan dentro del compás', () => {
    for (const p of Object.values(PROFILES)) {
      expect(SCALES[p.scale], p.id).toBeTruthy();
      for (let bar = 0; bar < 8; bar++) {
        const notes = composeBar(p, 1, bar, { night: 0.5, intensity: 1 });
        expect(notes.length, p.id).toBeGreaterThan(0);
        for (const n of notes) {
          expect(n.t).toBeGreaterThanOrEqual(0);
          expect(n.t).toBeLessThan(4);
          expect(n.midi).toBeGreaterThanOrEqual(0);
          expect(n.midi).toBeLessThan(110);
        }
      }
    }
  });
  it('la noche es más lenta y la intensidad acelera y añade percusión', () => {
    const p = PROFILES.batalla!;
    expect(barSeconds(p, { night: 1 })).toBeGreaterThan(barSeconds(p));
    expect(barSeconds(p, { intensity: 1 })).toBeLessThan(barSeconds(p));
    const drums = (i: number) => composeBar(p, 1, 0, { intensity: i }).filter((n) => ['kick', 'snare', 'hat'].includes(n.voice)).length;
    expect(drums(1)).toBeGreaterThan(drums(0));
  });
  it('intensidad de batalla: sube al acabar con los enemigos', () => {
    expect(battleIntensity(100, 100, 50, 50)).toBeLessThan(battleIntensity(10, 100, 50, 50));
    expect(battleIntensity(0, 100, 50, 50)).toBeLessThanOrEqual(1);
  });
  it('fanfarrias breves', () => {
    for (const k of ['victoria', 'derrota'] as const) {
      const f = fanfare(k);
      expect(f.beats).toBeLessThanOrEqual(10);
      expect(f.notes.length).toBeGreaterThan(5);
    }
  });
  it('ambiente: pájaros de día, grillos de noche', () => {
    const a = { pajaros: 1, grillos: 1, viento: 0.5 };
    expect(ambientMix(a, 0).pajaros).toBeGreaterThan(0.9);
    expect(ambientMix(a, 0).grillos).toBe(0);
    expect(ambientMix(a, 1).pajaros).toBe(0);
    expect(ambientMix(a, 1).grillos).toBeGreaterThan(0.9);
    expect(nextEventDelay(2, 0.5)).toBeCloseTo(Math.LN2 / 2);
    expect(nextEventDelay(0, 0.5)).toBe(Infinity);
  });
});

describe('datos de música', () => {
  it('cada bioma tiene su pieza y cada pieza existe', () => {
    for (const b of BIOME_LIST) expect(PROFILES[b.music], `${b.id}: ${b.music}`).toBeTruthy();
  });
  it('zonas -> pieza', () => {
    const base = { kind: 'wild' as const };
    expect(musicIdFor({ id: 'x', ...base, generated: { cx: 0, cy: 0, biome: 'nieve', place: 'wild', music: 'viento_helado', battle: 'montana' } })).toBe('viento_helado');
    expect(musicIdFor({ id: 'x', kind: 'town', generated: { cx: 0, cy: 0, biome: 'nieve', place: 'ciudad', music: 'viento_helado', battle: 'x' } })).toBe('ciudad');
    expect(musicIdFor({ id: 'cueva_goblin', kind: 'dungeon', dungeon: { id: 'c', floor: 1, run: 0 } })).toBe('cueva');
    expect(musicIdFor({ id: 'z', kind: 'dungeon', dungeon: { id: 'c', floor: 'jefe', run: 0 } })).toBe('sala_jefe');
    expect(battleMusicId('nieve', true)).toBe('batalla_jefe');
    expect(battleMusicId('cripta', false)).toBe('batalla_oscura');
  });
  it('pasos según suelo', () => {
    expect(stepSfxFor('nieve')).toBe('paso_nieve');
    expect(stepSfxFor('arena')).toBe('paso_arena');
    expect(stepSfxFor('desconocido')).toBe('paso_piedra');
  });
});
