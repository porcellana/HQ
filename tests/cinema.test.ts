import { describe, expect, it } from 'vitest';
import { CombatCinema, ACTION_ZOOM } from '@/gfx/cinema';
import { PARTICLE_CAP } from '@/gfx/particles';
import { Game } from '@/game/game';
import { DuelBook, type Resolver } from '@/game/combat/duelBook';
import { CombatLog, LOG_MAX_LINES, LOG_VISIBLE, classify } from '@/game/combat/combatLog';
import type { HitFx } from '@/game/combat/presentation';
import { lungeOffset } from '@/gfx/renderer';
import { testState } from './helpers';

const seeded = (): (() => number) => {
  let s = 99;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

function gameWithEnemy(): { g: Game; hit: HitFx } {
  const g = new Game(testState('guerrero'));
  g.enemies = [];
  const p = g.playerPos;
  const e = g.spawnEnemy('goblin', p.x, p.y - 1) ?? g.spawnEnemy('goblin', p.x + 1, p.y)!;
  const hit: HitFx = {
    type: 'hit', target: { kind: 'enemy', uid: e.uid }, pos: { x: e.x, y: e.y }, amount: 8, dmgType: 'fuego', crit: false, note: '', killed: false,
    attacker: { kind: 'player' }, action: 'Espada', lead: 0.5,
  };
  return { g, hit };
}

describe('cinemática del combate', () => {
  it('el impacto se aplica tras el retraso (lead) y no antes', () => {
    const { g, hit } = gameWithEnemy();
    const c = new CombatCinema();
    c.rand = seeded();
    c.onEvent(hit, g);
    expect(c.stats.hits).toBe(0);
    c.update(0.3, g);
    expect(c.stats.hits).toBe(0);
    c.update(0.3, g);
    expect(c.stats.hits).toBe(1);
    expect(c.pool.count).toBeGreaterThan(0);
  });

  it('efectos completos: temblor, hit-stop y cámara lenta en críticos', () => {
    const { g, hit } = gameWithEnemy();
    const c = new CombatCinema();
    c.rand = seeded();
    c.onEvent({ ...hit, crit: true, lead: 0 }, g);
    expect(c.stats.shakes).toBe(1);
    expect(c.stats.hitstops).toBe(1);
    expect(c.stats.slowmos).toBe(1);
    // Hit-stop: el juego se congela unos ms; luego cámara lenta; luego normal.
    expect(c.timeScale).toBe(0);
    c.update(0.15, g);
    expect(c.timeScale).toBe(0.4);
    c.update(0.5, g);
    expect(c.timeScale).toBe(1);
  });

  it('el temblor se amortigua y desaparece', () => {
    const { g, hit } = gameWithEnemy();
    const c = new CombatCinema();
    c.rand = seeded();
    c.onEvent({ ...hit, amount: 14, lead: 0 }, g);
    c.update(0.02, g);
    expect(Math.abs(c.shakeX) + Math.abs(c.shakeY)).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) c.update(0.05, g);
    expect(c.shakeX).toBe(0);
    expect(c.shakeY).toBe(0);
  });

  it('efectos reducidos y mínimos: sin zoom, temblor ni hit-stop', () => {
    for (const level of ['reducidos', 'minimos'] as const) {
      const { g, hit } = gameWithEnemy();
      const c = new CombatCinema();
      c.setLevel(level);
      c.rand = seeded();
      c.onEvent({ ...hit, crit: true, lead: 0 }, g);
      c.onDuelStart({ x: 1, y: 1 }, { x: 2, y: 2 }, 0.8);
      expect(c.stats.shakes, level).toBe(0);
      expect(c.stats.hitstops, level).toBe(0);
      expect(c.timeScale, level).toBe(1);
      expect(c.focus, level).toBeNull();
      c.update(0.5, g);
      expect(c.zoomMul, level).toBe(1);
    }
  });

  it('sin zoom de acción: la cámara no se acerca ni se desplaza hacia el golpe', () => {
    const { g } = gameWithEnemy();
    const c = new CombatCinema();
    expect(ACTION_ZOOM).toBe(1);
    c.onDuelStart({ x: 5, y: 5 }, { x: 7, y: 5 }, 0.5);
    for (let i = 0; i < 20; i++) c.update(0.05, g);
    expect(c.zoomMul).toBe(1);
    expect(c.focus).toBeNull();
  });

  it('un enemigo derrotado deja un fantasma que se desintegra y desaparece', () => {
    const { g } = gameWithEnemy();
    const c = new CombatCinema();
    c.rand = seeded();
    const enemy = g.enemies[0]!;
    c.onEvent({ type: 'kill', enemy, xp: 10, gold: 3, items: [{ name: 'Poción', rarity: 2 }], boss: false, lead: 0.4 }, g);
    expect(c.ghosts.length).toBe(1);
    c.update(0.2, g);
    expect(c.ghosts[0]!.started).toBe(false); // sigue entero hasta que se revela el golpe
    c.update(0.3, g);
    expect(c.ghosts[0]!.started).toBe(true);
    expect(c.pool.count).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) c.update(0.05, g);
    expect(c.ghosts.length).toBe(0);
  });

  it('con muchos golpes seguidos las partículas nunca pasan del tope', () => {
    const { g, hit } = gameWithEnemy();
    const c = new CombatCinema();
    c.rand = seeded();
    for (let i = 0; i < 80; i++) c.onEvent({ ...hit, lead: 0, amount: 20, crit: true }, g);
    expect(c.pool.count).toBeLessThanOrEqual(PARTICLE_CAP);
  });

  it('la embestida retrocede un poco (anticipación) antes de golpear', () => {
    expect(lungeOffset(0)).toBe(0);
    expect(lungeOffset(1.15)).toBeLessThan(0); // anticipación
    expect(lungeOffset(0.5)).toBeGreaterThan(3); // golpe
    expect(lungeOffset(1)).toBeCloseTo(0, 5);
  });
});

describe('libro de duelos', () => {
  const res: Resolver<string> = { name: (a) => `${a.kind}${a.uid ?? ''}`, sprite: (a) => `spr-${a.kind}` };
  const hit = (target: number, amount: number, extra: Partial<HitFx> = {}): HitFx => ({
    type: 'hit', target: { kind: 'enemy', uid: target }, pos: { x: 1, y: 1 }, amount, dmgType: 'cortante', crit: false, note: '', killed: false,
    attacker: { kind: 'player' }, action: 'Tajo', lead: 0.8, ...extra,
  });

  it('una tirada y su daño forman UNA tarjeta', () => {
    const b = new DuelBook<string>(res);
    b.onDice({ label: 'Tajo', natural: 14, bonus: 5, total: 19, target: 13, targetLabel: 'CA', outcome: 'hit', attacker: { kind: 'player' }, defender: { kind: 'enemy', uid: 1 }, action: 'Tajo', lead: 0.8 });
    b.onHit(hit(1, 7));
    b.closeBatch();
    expect(b.queue.length).toBe(1);
    const e = b.next()!;
    expect(e.rows.length).toBe(1);
    expect(e.rows[0]!.roll?.total).toBe(19);
    expect(e.rows[0]!.damage?.amount).toBe(7);
    expect(e.lead).toBe(0.8);
  });

  it('varios objetivos = una tarjeta con una fila por objetivo, en orden', () => {
    const b = new DuelBook<string>(res);
    for (const uid of [1, 2, 3]) {
      b.onDice({ label: 'Torbellino', natural: 10 + uid, bonus: 5, total: 15 + uid, target: 13, targetLabel: 'CA', outcome: uid === 2 ? 'miss' : 'hit', attacker: { kind: 'player' }, defender: { kind: 'enemy', uid }, action: 'Torbellino', lead: 0.8 });
      if (uid !== 2) b.onHit(hit(uid, uid * 2, { action: 'Torbellino' }));
    }
    b.closeBatch();
    const e = b.next()!;
    expect(e.rows.map((r) => r.defender.uid)).toEqual([1, 2, 3]);
    expect(e.rows.map((r) => r.damage?.amount)).toEqual([2, undefined, 6]);
    expect(b.queue.length).toBe(0);
  });

  it('golpes automáticos repetidos al mismo objetivo se acumulan (proyectil mágico ×3)', () => {
    const b = new DuelBook<string>(res);
    for (const a of [3, 4, 3]) b.onHit(hit(1, a, { action: 'Proyectil mágico', dmgType: 'arcano' }));
    b.closeBatch();
    const e = b.next()!;
    expect(e.rows.length).toBe(1);
    expect(e.rows[0]!.damage).toMatchObject({ amount: 10, hits: 3 });
  });

  it('acciones distintas o lotes distintos son tarjetas distintas, en orden de emisión', () => {
    const b = new DuelBook<string>(res);
    b.onHit(hit(1, 5, { action: 'A' }));
    b.closeBatch();
    b.onHit(hit(1, 6, { action: 'B', attacker: { kind: 'enemy', uid: 9 } }));
    b.closeBatch();
    expect(b.queue.map((e) => e.action)).toEqual(['A', 'B']);
    expect(b.takeFresh()).toBe(true);
    expect(b.takeFresh()).toBe(false);
  });

  it('sin atacante (trampas, estados) no hay tarjeta', () => {
    const b = new DuelBook<string>(res);
    expect(b.onHit(hit(1, 3, { attacker: null }))).toBeNull();
    expect(b.queue.length).toBe(0);
  });

  it('los fallos sin d20 (mascotas) aparecen como fila', () => {
    const b = new DuelBook<string>(res);
    b.onMiss({ type: 'miss', target: { kind: 'enemy', uid: 4 }, pos: { x: 0, y: 0 }, attacker: { kind: 'pet' }, action: 'Zarpazo', lead: 0.5 });
    b.closeBatch();
    expect(b.next()!.rows[0]!.outcome).toBe('miss');
  });
});

describe('registro de combate', () => {
  it('conserva y limita las líneas', () => {
    const log = new CombatLog();
    for (let i = 0; i < LOG_MAX_LINES + 25; i++) log.push(`línea ${i}`, 'combat');
    expect(log.lines.length).toBe(LOG_MAX_LINES);
    expect(log.lines[0]!.text).toBe('línea 25');
    expect(log.recent().length).toBe(LOG_VISIBLE);
    expect(log.recent().at(-1)!.text).toBe(`línea ${LOG_MAX_LINES + 24}`);
    log.clear();
    expect(log.lines.length).toBe(0);
  });

  it('colorea por categoría: la del motor manda; si no, se deduce', () => {
    expect(classify('Goblin recibe 5 de daño.', 'combat', 'dmg-out')).toBe('dmg-out');
    expect(classify('Recuperas 6 PV.', 'good')).toBe('heal');
    expect(classify('¡Envenenado!', 'warn')).toBe('status');
    expect(classify('El goblin falla su ataque.', 'combat')).toBe('miss');
    expect(classify('Algo pasa.', 'combat')).toBe('neutral');
  });
});
