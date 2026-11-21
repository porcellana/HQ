import { describe, expect, it } from 'vitest';
import { ENEMIES, ZONES } from '@/data/registry';
import { Rng } from '@/engine/rng';
import { applyDefenses, attackRoll, damageRoll, hasLineOfSight, xpForKill, xpMultiplier } from '@/game/combat/rules';
import { consumeStun, tickStatuses, tryApplyStatus, type StatusInstance } from '@/game/combat/status';
import { Game } from '@/game/game';
import { totalXpForLevel } from '@/game/rules/progression';
import { Zone } from '@/game/world/zone';
import { testState } from './helpers';

/** Rng con resultados de int() prefijados (para forzar tiradas). */
class FixedRng extends Rng {
  constructor(private readonly values: number[]) {
    super(1);
  }
  override int(min: number, max: number): number {
    const v = this.values.shift();
    return v === undefined ? super.int(min, max) : Math.min(max, Math.max(min, v));
  }
}

describe('reglas de combate', () => {
  it('20 natural siempre impacta y es crítico; 1 natural siempre falla', () => {
    expect(attackRoll(new FixedRng([20]), 0, 99)).toMatchObject({ hit: true, crit: true });
    expect(attackRoll(new FixedRng([1]), 50, 1)).toMatchObject({ hit: false, fumble: true });
    expect(attackRoll(new FixedRng([10]), 3, 13)).toMatchObject({ hit: true, total: 13 });
    expect(attackRoll(new FixedRng([9]), 3, 13).hit).toBe(false);
    expect(attackRoll(new FixedRng([19]), 0, 99, 'normal', 19)).toMatchObject({ hit: true, crit: true });
  });

  it('el crítico duplica los dados pero no el modificador', () => {
    const normal = damageRoll(new FixedRng([4]), '1d8', 3, false);
    const crit = damageRoll(new FixedRng([4, 6]), '1d8', 3, true);
    expect(normal.total).toBe(7);
    expect(crit.rolls).toEqual([4, 6]);
    expect(crit.total).toBe(13);
  });

  it('resistencias y vulnerabilidades', () => {
    expect(applyDefenses(10, 'sagrado', { vulnerable: ['sagrado'] }).amount).toBe(20);
    expect(applyDefenses(9, 'perforante', { resist: ['perforante'] }).amount).toBe(4);
    expect(applyDefenses(9, 'fuego', {}).amount).toBe(9);
  });

  it('XP escalada por nivel: matar enemigos muy débiles casi no da nada', () => {
    expect(xpMultiplier(5, 5)).toBe(1);
    expect(xpMultiplier(7, 5)).toBe(1.5);
    expect(xpMultiplier(20, 1)).toBe(2);
    expect(xpMultiplier(3, 5)).toBeCloseTo(0.6);
    expect(xpMultiplier(1, 10)).toBe(0.05);
    expect(xpForKill(20, 1, 10)).toBe(1);
    expect(xpForKill(100, 6, 5)).toBe(125);
  });

  it('línea de visión', () => {
    const wall = (x: number, y: number) => x === 2 && y === 0;
    expect(hasLineOfSight(0, 0, 4, 0, wall)).toBe(false);
    expect(hasLineOfSight(0, 1, 4, 1, wall)).toBe(true);
    expect(hasLineOfSight(0, 0, 2, 0, wall)).toBe(true); // ves el muro en sí
  });

  it('estados: daño por turno, duración y aturdimiento', () => {
    const list: StatusInstance[] = [];
    const rng = new Rng(3);
    expect(tryApplyStatus(rng, list, { id: 'veneno', turns: 2 })).toBe(true);
    expect(tryApplyStatus(rng, list, { id: 'veneno', turns: 1 }, ['veneno'])).toBe(false);
    const t1 = tickStatuses(rng, list);
    expect(t1.damage).toBeGreaterThanOrEqual(1);
    expect(t1.damage).toBeLessThanOrEqual(4);
    tickStatuses(rng, list);
    expect(list).toHaveLength(0);
    tryApplyStatus(rng, list, { id: 'aturdido', turns: 1 });
    tickStatuses(rng, list);
    expect(consumeStun(list)).toBe(true);
    expect(consumeStun(list)).toBe(false);
  });
});

describe('datos de enemigos', () => {
  it('al menos 12 enemigos normales y 3 jefes, de varias familias', () => {
    const all = [...ENEMIES.values()];
    expect(all.filter((e) => !e.boss).length).toBeGreaterThanOrEqual(12);
    expect(all.filter((e) => e.boss).length).toBeGreaterThanOrEqual(3);
    expect(new Set(all.map((e) => e.family)).size).toBeGreaterThanOrEqual(5);
    const ais = new Set(all.map((e) => e.ai));
    for (const ai of ['melee', 'ranged', 'caster', 'boss']) expect(ais.has(ai as never), ai).toBe(true);
  });

  it('invocaciones y encuentros apuntan a enemigos existentes', () => {
    for (const e of ENEMIES.values()) {
      for (const p of e.phases ?? []) if (p.summon) expect(ENEMIES.has(p.summon.enemy), p.summon.enemy).toBe(true);
      for (const s of e.spells ?? []) if (s.summon) expect(ENEMIES.has(s.summon.enemy), s.summon.enemy).toBe(true);
    }
    for (const z of ZONES.values()) for (const g of z.encounters?.groups ?? []) expect(ENEMIES.has(g.enemy), `${z.id}: ${g.enemy}`).toBe(true);
  });
});

// ------------------------------------------------------------- partida real
function gameIn(classId: string, zone = 'aldea_brumaroja'): Game {
  const s = testState(classId);
  const g = new Game(s);
  if (zone !== g.zone.id) g.enterZone(zone, '1');
  g.enemies = [];
  return g;
}

/** Avanza el tiempo hasta que vuelva a ser turno del jugador. */
function settle(g: Game): void {
  for (let i = 0; i < 200 && g.phase === 'enemies'; i++) g.update(0.25);
}

function adjacentFree(g: Game): { x: number; y: number } {
  const p = g.playerPos;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
    if (g.freeForEnemy(p.x + dx, p.y + dy)) return { x: p.x + dx, y: p.y + dy };
  }
  throw new Error('sin hueco');
}

/** Pelea a muerte contra un enemigo; devuelve true si gana el jugador. */
function duel(classId: string, enemyId: string, useSkills = true): boolean {
  const g = gameIn(classId);
  const spot = adjacentFree(g);
  const e = g.spawnEnemy(enemyId, spot.x, spot.y)!;
  e.alerted = true;
  for (let turn = 0; turn < 80; turn++) {
    if (g.isDead) return false;
    if (!g.enemies.includes(e)) return true;
    const sk = g.cls.skills.find((s) => s.unlockLevel <= g.state.player.level && s.target === 'enemy' && !g.skillBlockedReason(s));
    if (useSkills && sk && g.inSkillRange(sk, e)) g.useSkill(sk, e);
    else g.tapTile(e.x, e.y);
    settle(g);
  }
  return !g.enemies.includes(e);
}

describe('combate en partida', () => {
  it('el bosque se puebla con enemigos lejos del jugador', () => {
    const g = new Game(testState());
    g.enterZone('bosque_sombrio', '1');
    expect(g.enemies.length).toBeGreaterThan(0);
    const p = g.playerPos;
    const zone = new Zone(ZONES.get('bosque_sombrio')!);
    for (const e of g.enemies) {
      expect(zone.isWalkable(e.x, e.y)).toBe(true);
      expect(Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y))).toBeGreaterThanOrEqual(2);
    }
  });

  it('matar un enemigo da su XP y lo quita del mapa', () => {
    const g = gameIn('guerrero');
    const spot = adjacentFree(g);
    const e = g.spawnEnemy('rata_gigante', spot.x, spot.y)!;
    e.hp = 1;
    g.state.player.stats.FUE = 30; // asegura impactar casi siempre
    for (let i = 0; i < 20 && g.enemies.includes(e); i++) {
      g.tapTile(e.x, e.y);
      settle(g);
    }
    expect(g.enemies.includes(e)).toBe(false);
    expect(g.state.player.xp).toBe(xpForKill(e.def.xp, e.def.level, 1) + 0);
  });

  it('los enemigos alerta se acercan y atacan', () => {
    const g = gameIn('mago');
    const p = g.playerPos;
    const e = g.spawnEnemy('goblin', p.x, p.y - 3)!;
    e.alerted = true;
    const hp0 = g.state.player.hp;
    for (let i = 0; i < 15 && g.state.player.hp === hp0 && !g.isDead; i++) {
      g.waitTurn();
      settle(g);
    }
    expect(Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y))).toBe(1);
    expect(g.state.player.hp).toBeLessThan(hp0);
  });

  it('subir de nivel: PV, puntos, habilidades y evento', () => {
    const g = gameIn('mago');
    const events: number[] = [];
    g.events.on('levelUp', (ev) => events.push(ev.level));
    const hp1 = g.state.player.maxHp;
    g.gainXp(totalXpForLevel(6), 'test');
    expect(g.state.player.level).toBe(6);
    expect(events).toEqual([2, 3, 4, 5, 6]);
    expect(g.state.player.maxHp).toBeGreaterThan(hp1);
    expect(g.state.player.hp).toBe(g.state.player.maxHp);
    expect(g.state.player.attributePoints).toBe(1 + 1 + 2 + 1 + 1);
  });

  it('habilidad: proyectil mágico gasta maná, nunca falla y pasa el turno', () => {
    const g = gameIn('mago');
    const p = g.playerPos;
    const e = g.spawnEnemy('orco_bruto', p.x, p.y - 2)!;
    const sk = g.cls.skills.find((s) => s.id === 'proyectil_magico')!;
    const mp = g.state.player.mp;
    const turn = g.state.turn;
    g.useSkill(sk, e);
    expect(g.state.player.mp).toBe(mp - sk.cost);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(g.state.turn).toBe(turn + 1);
  });

  it('morir y despertar en la aldea perdiendo el 10 % del oro', () => {
    const g = gameIn('mago', 'bosque_sombrio');
    g.state.player.gold = 100;
    let died = false;
    g.events.on('playerDied', () => (died = true));
    g.damagePlayer(999, 'test');
    expect(died).toBe(true);
    expect(g.isDead).toBe(true);
    g.respawn();
    expect(g.zone.id).toBe('aldea_brumaroja');
    expect(g.state.player.gold).toBe(90);
    expect(g.state.player.hp).toBeGreaterThan(0);
    expect(g.isDead).toBe(false);
  });

  it('huir acaba funcionando y elimina a los perseguidores', () => {
    const g = gameIn('picaro');
    const p = g.playerPos;
    const e = g.spawnEnemy('goblin', p.x, p.y - 2)!;
    e.alerted = true;
    g.state.player.hp = 999;
    for (let i = 0; i < 40 && g.enemies.includes(e); i++) {
      g.flee();
      settle(g);
    }
    expect(g.enemies.includes(e)).toBe(false);
  });

  it('el jefe cambia de fase e invoca refuerzos', () => {
    const g = gameIn('guerrero');
    const spot = adjacentFree(g);
    const boss = g.spawnEnemy('rey_goblin', spot.x, spot.y)!;
    g.damageEnemy(boss, Math.ceil(boss.maxHp * 0.5), 'cortante');
    expect(boss.phase).toBeGreaterThanOrEqual(1);
    expect(g.enemies.filter((e) => e.def.id === 'goblin').length).toBeGreaterThan(0);
  });

  it('equilibrio: un personaje de nivel 1 suele ganar a un goblin', () => {
    for (const cls of ['guerrero', 'picaro', 'mago', 'clerigo']) {
      let wins = 0;
      for (let i = 0; i < 60; i++) if (duel(cls, 'goblin')) wins++;
      expect(wins / 60, `${cls} vs goblin`).toBeGreaterThan(0.6);
    }
  });

  it('equilibrio: el orco bruto es mortal a nivel 1', () => {
    let wins = 0;
    for (let i = 0; i < 40; i++) if (duel('mago', 'orco_bruto')) wins++;
    expect(wins / 40).toBeLessThan(0.2);
  });
});
