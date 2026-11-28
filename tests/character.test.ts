import { describe, expect, it } from 'vitest';
import { CLASSES, getClass } from '@/data/registry';
import { ABILITY_KEYS } from '@/data/schema';
import { maxHpFor, maxResourceFor, proficiencyBonus, unlockedSkills } from '@/game/rules/character';
import { derive } from '@/game/rules/derived';
import { CURRENT_SAVE_VERSION, migrate } from '@/game/save/migrations';
import { recalcPlayer } from '@/game/state';
import { KNOWN_OVERLAYS } from '@/gfx/look';
import { testState } from './helpers';

describe('clases (datos)', () => {
  it('hay al menos las 4 clases', () => {
    for (const id of ['guerrero', 'picaro', 'mago', 'clerigo']) expect(CLASSES.has(id), id).toBe(true);
  });

  for (const cls of CLASSES.values()) {
    it(`${cls.id}: datos coherentes`, () => {
      for (const k of ABILITY_KEYS) {
        expect(cls.baseStats[k]).toBeGreaterThanOrEqual(3);
        expect(cls.baseStats[k]).toBeLessThanOrEqual(18);
      }
      expect(cls.skills.some((s) => s.unlockLevel === 1), 'al menos una habilidad a nivel 1').toBe(true);
      const ids = cls.skills.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of cls.skills) {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(20);
        expect(s.effects.length).toBeGreaterThan(0);
      }
      expect(KNOWN_OVERLAYS, `plantilla "${cls.look.overlay}"`).toContain(cls.look.overlay);
    });
  }

});

describe('reglas de personaje', () => {
  it('PV estilo 5e', () => {
    const g = getClass('guerrero');
    expect(maxHpFor(g, 1, 14)).toBe(12); // d10 + 2
    expect(maxHpFor(g, 2, 14)).toBe(12 + 8); // + (5+1+2)
    const m = getClass('mago');
    expect(maxHpFor(m, 1, 12)).toBe(7); // d6 + 1
  });

  it('el guerrero aguanta más que el mago y el mago tiene más maná', () => {
    const g = getClass('guerrero');
    const m = getClass('mago');
    expect(maxHpFor(g, 5, g.baseStats.CON)).toBeGreaterThan(maxHpFor(m, 5, m.baseStats.CON));
    expect(maxResourceFor(m, 5, m.baseStats)).toBeGreaterThan(maxResourceFor(g, 5, g.baseStats));
    expect(derive(testState('guerrero').player).ac).toBeGreaterThan(derive(testState('mago').player).ac);
  });

  it('competencia y habilidades por nivel', () => {
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(20)).toBe(6);
    const c = getClass('clerigo');
    expect(unlockedSkills(c, 1).length).toBe(2);
    expect(unlockedSkills(c, 20).length).toBe(c.skills.length);
  });

  it('partida nueva: vida y recurso al máximo, oro de la clase', () => {
    for (const id of CLASSES.keys()) {
      const s = testState(id);
      expect(s.player.hp).toBe(s.player.maxHp);
      expect(s.player.mp).toBe(s.player.maxMp);
      expect(s.player.gold).toBe(getClass(id).startingGold);
    }
  });
});

describe('migración v1 → v2', () => {
  it('convierte una partida del Hito 1 en un guerrero jugable', () => {
    const v1 = {
      seed: 5, turn: 77, visitedZones: ['aldea_brumaroja'], flags: {}, playTimeSec: 10, createdAt: '2026-01-01',
      player: { name: 'Viejo', classId: 'aventurero', portrait: 0, level: 1, xp: 0, hp: 12, maxHp: 12, mp: 4, maxMp: 4, gold: 25, pos: { zone: 'aldea_brumaroja', x: 13, y: 22 } },
    };
    const v2 = migrate(v1, 1, CURRENT_SAVE_VERSION) as unknown as ReturnType<typeof testState>;
    expect(v2.player.classId).toBe('guerrero');
    expect(v2.player.stats.FUE).toBe(15);
    expect(v2.player.attributePoints).toBe(0);
    expect(v2.turn).toBe(77);
    recalcPlayer(v2.player);
    expect(v2.player.maxHp).toBe(12);
  });
});
