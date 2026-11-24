import { describe, expect, it } from 'vitest';
import { PARTICLE_CAP, ParticlePool, emitDissolve, emitHeal, emitImpact, emitLootSparkle } from '@/gfx/particles';

/** Aleatorio determinista. */
const seeded = (): (() => number) => {
  let s = 12345;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

describe('partículas', () => {
  it('el pool respeta el tope y descarta lo que sobra', () => {
    const pool = new ParticlePool();
    expect(pool.cap).toBe(PARTICLE_CAP);
    for (let i = 0; i < PARTICLE_CAP + 40; i++) pool.spawn({ x: 0, y: 0, life: 5, color: '#fff' });
    expect(pool.count).toBe(PARTICLE_CAP);
    expect(pool.dropped).toBe(40);
  });

  it('las partículas mueren al cumplir su vida y se pueden reutilizar', () => {
    const pool = new ParticlePool(10);
    for (let i = 0; i < 10; i++) pool.spawn({ x: 0, y: 0, life: 0.2, color: '#fff' });
    expect(pool.spawn({ x: 0, y: 0, life: 1, color: '#fff' })).toBe(false);
    pool.update(0.25);
    expect(pool.count).toBe(0);
    expect(pool.spawn({ x: 0, y: 0, life: 1, color: '#fff' })).toBe(true);
  });

  it('la física: velocidad, gravedad y rozamiento', () => {
    const pool = new ParticlePool(2);
    pool.spawn({ x: 0, y: 0, vx: 10, vy: 0, gy: 20, life: 2, color: '#fff' });
    pool.update(1);
    const p = pool.items.find((i) => i.active)!;
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(20);
  });

  it('cada tipo de daño emite partículas y el nivel de efectos las reduce', () => {
    const types = ['cortante', 'contundente', 'perforante', 'fuego', 'frio', 'rayo', 'veneno', 'sagrado', 'necrotico', 'arcano'] as const;
    for (const t of types) {
      const full = new ParticlePool();
      emitImpact(full, t, 50, 50, { power: 0.6, density: 1, r: seeded() });
      expect(full.count, t).toBeGreaterThan(0);
      const low = new ParticlePool();
      emitImpact(low, t, 50, 50, { power: 0.6, density: 0.5, r: seeded() });
      expect(low.count, t).toBeLessThanOrEqual(full.count);
      const none = new ParticlePool();
      emitImpact(none, t, 50, 50, { power: 0.6, density: 0, r: seeded() });
      expect(none.count, `${t} sin decoración`).toBeLessThanOrEqual(2);
    }
  });

  it('un tipo desconocido usa el emisor genérico', () => {
    const pool = new ParticlePool();
    emitImpact(pool, null, 0, 0, { r: seeded() });
    expect(pool.count).toBeGreaterThan(0);
  });

  it('muchos efectos a la vez nunca superan el tope', () => {
    const pool = new ParticlePool();
    const r = seeded();
    for (let i = 0; i < 60; i++) {
      emitImpact(pool, 'fuego', 0, 0, { power: 1, r });
      emitHeal(pool, 0, 0, 1, r);
      emitDissolve(pool, 0, 0, ['#fff', '#000'], 1, r);
      emitLootSparkle(pool, 0, 0, '#ff9a20', 4, 1, r);
    }
    expect(pool.count).toBeLessThanOrEqual(PARTICLE_CAP);
  });
});
