import { describe, expect, it } from 'vitest';
import { ambientPos, ambientSpec, arcPoint, attackKind, damageStyle, elementOf, ghostStep, hitStop, hpColor, lightningPath, slashArc } from '@/gfx/battleFx';

describe('battleFx', () => {
  it('elige animación por arma/estilo', () => {
    expect(attackKind('melee', 'cortante')).toBe('slash');
    expect(attackKind('melee', 'contundente')).toBe('smash');
    expect(attackKind('melee', 'perforante')).toBe('thrust');
    expect(attackKind('ranged', 'perforante')).toBe('arrow');
    expect(attackKind('cast', 'fuego')).toBe('orb');
    expect(elementOf('cortante')).toBe('fisico');
    expect(elementOf('rayo')).toBe('rayo');
  });
  it('estilos de número', () => {
    expect(damageStyle(9, { crit: true }).kind).toBe('crit');
    expect(damageStyle(9, { crit: true }).size).toBeGreaterThan(damageStyle(9, {}).size);
    expect(damageStyle(3, { tag: 'resiste' }).kind).toBe('resist');
    expect(damageStyle(3, { toParty: true }).kind).toBe('ally');
  });
  it('hit-stop acotado y mayor en críticos', () => {
    expect(hitStop({ crit: false, killed: false, amount: 0, maxHp: 10 })).toBe(0);
    const a = hitStop({ crit: false, killed: false, amount: 5, maxHp: 20 });
    const b = hitStop({ crit: true, killed: true, amount: 500, maxHp: 20 });
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(0.14);
  });
  it('trayectorias', () => {
    expect(arcPoint(0, 0, 0, 10, 0, 5)).toEqual({ x: 0, y: 0 });
    expect(arcPoint(0.5, 0, 0, 10, 0, 4).y).toBeCloseTo(-4);
    expect(slashArc(0, 0, 10, 0, Math.PI, 1, 4)).toHaveLength(5);
    const p = lightningPath(0, 0, 0, 40, 3);
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[p.length - 1]).toEqual({ x: 0, y: 40 });
    expect(lightningPath(0, 0, 0, 40, 3)).toEqual(p);
  });
  it('ambiente dentro de pantalla', () => {
    const s = ambientSpec('bosque');
    for (let i = 0; i < 20; i++) {
      const p = ambientPos(i, 123.4, 300, 200, s);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(300);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(200);
    }
  });
  it('barra fantasma y color', () => {
    expect(ghostStep(5, 10, 0.1)).toBeLessThan(10);
    expect(ghostStep(5, 10, 0.1)).toBeGreaterThanOrEqual(5);
    expect(ghostStep(8, 5, 0.1)).toBe(8);
    expect(hpColor(0.9)).not.toBe(hpColor(0.1));
  });
});
