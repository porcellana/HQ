import { describe, expect, it } from 'vitest';
import { PROGRESSION, levelForXp, levelProgress, totalXpForLevel, xpToNext } from '@/game/rules/progression';

describe('curva de experiencia', () => {
  it('usa base * nivel^exponente', () => {
    const { xpBase, xpExponent } = PROGRESSION;
    expect(xpToNext(1)).toBe(xpBase);
    expect(xpToNext(2)).toBe(Math.round(xpBase * Math.pow(2, xpExponent)));
    expect(xpToNext(PROGRESSION.maxLevel)).toBe(Infinity);
  });

  it('es creciente y los niveles cuadran con la XP total', () => {
    for (let l = 1; l < PROGRESSION.maxLevel - 1; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    for (let l = 1; l <= PROGRESSION.maxLevel; l++) {
      const xp = totalXpForLevel(l);
      expect(levelForXp(xp)).toBe(l);
      if (l > 1) expect(levelForXp(xp - 1)).toBe(l - 1);
    }
    expect(levelForXp(10 ** 9)).toBe(20);
  });

  it('progreso dentro del nivel para la barra del HUD', () => {
    const p = levelProgress(xpToNext(1) + 50);
    expect(p.level).toBe(2);
    expect(p.current).toBe(50);
    expect(p.ratio).toBeCloseTo(50 / xpToNext(2));
    expect(levelProgress(10 ** 9).ratio).toBe(1);
  });
});
