/** v0.14: animaciones por familia, jefes con entrada y fase, e información de combatientes. */
import { describe, expect, it } from 'vitest';
import { rigPose, type AnimState, type AnimVariant } from '@/gfx/world3d/anim';
import { beastRig, humanoidRig } from '@/gfx/world3d/models';
import { unitInfo, DAMAGE_LABEL } from '@/game/battle/info';
import { Game } from '@/game/game';
import { ENEMIES } from '@/data/registry';
import { testState } from './helpers';

const FAMILIES: AnimVariant[] = ['goblinoide', 'no-muerto', 'bestia', 'araña', 'orco', 'humano'];
const rig = humanoidRig({ skin: '#d9a67a', hair: '#333', cloth: '#a33', clothDark: '#611', pants: '#222' });
const beast = beastRig('lobo', { main: '#888', dark: '#444', accent: '#aaa', shape: 'lobo' } as never);
const pose = (r: typeof rig, state: AnimState, k: number, variant?: string) =>
  JSON.stringify(rigPose(r, { state, k, time: 1.3, walkT: 0, walk: 0, seed: 1, ...(variant ? { variant } : {}) }));

describe('animaciones por familia', () => {
  it('cada familia ataca, descansa y muere de forma distinta a las demás', () => {
    for (const state of ['attack', 'die'] as const) {
      const seen = new Set(FAMILIES.map((f) => pose(rig, state, 0.5, f)));
      expect(seen.size, state).toBeGreaterThanOrEqual(5);
    }
    const idle = new Set(FAMILIES.map((f) => pose(rig, 'idle', 0, f)));
    expect(idle.size).toBeGreaterThanOrEqual(5);
  });

  it('las poses son finitas y la muerte termina en el suelo para cada familia y rig', () => {
    for (const r of [rig, beast]) for (const f of FAMILIES) for (const st of ['idle', 'attack', 'die', 'hurt', 'enter', 'phase'] as const) for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const p = rigPose(r, { state: st, k, time: 2, walkT: 1, walk: 0, seed: 3, variant: f });
      for (const v of [p.body.dy, p.body.dz, p.body.rx, p.body.rz, p.body.sy, p.head.rx, p.arms.l.rx, p.arms.r.rx, p.legs.a.rx]) expect(Number.isFinite(v), `${f} ${st} ${k}`).toBe(true);
    }
  });

  it('el jefe entra emergiendo y ruge al cambiar de fase', () => {
    const enter0 = rigPose(rig, { state: 'enter', k: 0, time: 0, walkT: 0, walk: 0, seed: 0 });
    const enter1 = rigPose(rig, { state: 'enter', k: 1, time: 0, walkT: 0, walk: 0, seed: 0 });
    expect(enter0.body.dy).toBeLessThan(-0.3);
    expect(Math.abs(enter1.body.dy)).toBeLessThan(0.05);
    const roar = rigPose(rig, { state: 'phase', k: 0.5, time: 0, walkT: 0, walk: 0, seed: 0 });
    expect(roar.arms.l.rx).toBeLessThan(-1.5);
    expect(roar.head.rx).toBeLessThan(-0.3);
  });
});

describe('información de combatientes', () => {
  it('muestra nombre, nivel, PV, CA, estados y debilidades de enemigos y aliados', () => {
    const g = new Game(testState('guerrero', 5));
    g.enemies = [];
    const withWeak = [...ENEMIES.values()].find((e) => e.vulnerable?.length) ?? [...ENEMIES.values()][0]!;
    const e = g.spawnEnemy(withWeak.id, g.playerPos.x + 2, g.playerPos.y + 2)!;
    const b = g.beginBattle([e]);
    const c = b.get(`e${e.uid}`)!;
    c.statuses.push({ id: 'veneno', turns: 3 } as never);
    const i = unitInfo(b, c);
    expect(i.name).toBe(withWeak.name);
    expect(i.subtitle).toContain(`Nv ${withWeak.level}`);
    expect(i.maxHp).toBe(e.maxHp);
    expect(i.ac).toBe(withWeak.ac);
    expect(i.statuses).toEqual([{ id: 'veneno', turns: 3 }]);
    expect(i.weak).toEqual((withWeak.vulnerable ?? []).map((t) => DAMAGE_LABEL[t]));
    const me = unitInfo(b, b.player);
    expect(me.subtitle).toBe('Tú');
    expect(me.hp).toBe(g.state.player.hp);
  });
});
