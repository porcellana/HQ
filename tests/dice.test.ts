import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/rng';
import { abilityModifier, averageDice, parseDice, roll, rollD20 } from '@/game/rules/dice';

describe('dados', () => {
  it('interpreta expresiones', () => {
    expect(parseDice('1d8+2')).toEqual({ count: 1, sides: 8, modifier: 2 });
    expect(parseDice('d20')).toEqual({ count: 1, sides: 20, modifier: 0 });
    expect(parseDice('3d6 - 1')).toEqual({ count: 3, sides: 6, modifier: -1 });
    expect(parseDice('4')).toEqual({ count: 0, sides: 0, modifier: 4 });
    expect(() => parseDice('banana')).toThrow();
  });

  it('las tiradas están en rango y son deterministas con semilla', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 500; i++) {
      const r = roll(a, '2d6+3');
      expect(r.total).toBeGreaterThanOrEqual(5);
      expect(r.total).toBeLessThanOrEqual(15);
      expect(r.rolls).toHaveLength(2);
      expect(roll(b, '2d6+3').total).toBe(r.total);
    }
  });

  it('el d20 sale uniforme aprox. y ventaja >= desventaja en media', () => {
    const rng = new Rng(7);
    const counts = new Array(21).fill(0);
    let adv = 0;
    let dis = 0;
    for (let i = 0; i < 20000; i++) {
      counts[rollD20(rng).natural]++;
      adv += rollD20(rng, 'ventaja').natural;
      dis += rollD20(rng, 'desventaja').natural;
    }
    for (let n = 1; n <= 20; n++) expect(counts[n]).toBeGreaterThan(800);
    expect(counts[0]).toBe(0);
    expect(adv).toBeGreaterThan(dis);
  });

  it('modificadores de característica estilo 5e', () => {
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(18)).toBe(4);
    expect(abilityModifier(3)).toBe(-4);
    expect(averageDice('1d8+2')).toBe(6.5);
  });
});
