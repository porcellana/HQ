/** Economía del turno en combate: movimiento por casillas + una acción. */
import { describe, expect, it } from 'vitest';
import { CLASSES, getClass } from '@/data/registry';
import { Game } from '@/game/game';
import { testState } from './helpers';

function settle(g: Game): void {
  for (let i = 0; i < 400 && g.phase === 'enemies'; i++) g.update(0.25);
}
function walk(g: Game): void {
  for (let i = 0; i < 200 && (g.isMoving || g.view.path.length); i++) g.update(0.05);
}
/** Partida en la aldea con un enemigo alerta en (dx, dy) y ya en tu turno de combate. */
function combat(classId: string, enemy: string, dx: number, dy: number): Game {
  const g = new Game(testState(classId));
  g.enemies = [];
  (g as unknown as { ally: null }).ally = null;
  (g as unknown as { pet: null }).pet = null;
  const p = g.playerPos;
  const e = g.spawnEnemy(enemy, p.x + dx, p.y + dy)!;
  expect(e).toBeTruthy();
  e.alerted = true;
  g.state.player.hp = 999; // que el primer golpe enemigo no decida el test
  g.waitTurn();
  settle(g);
  return g;
}

describe('movimiento por clase', () => {
  it('cada clase define sus casillas por turno en los datos', () => {
    for (const c of CLASSES.values()) {
      expect(c.movement, c.id).toBeGreaterThanOrEqual(3);
      expect(c.movement, c.id).toBeLessThanOrEqual(8);
    }
    expect(getClass('picaro').movement).toBe(6);
    expect(getClass('guerrero').movement).toBe(5);
  });

  it('talento y trasfondo suman movimiento', () => {
    const s = testState('picaro');
    s.player.background = 'cazador';
    s.player.talents = ['pic_esquiva', 'pic_pies_ligeros'];
    const g = new Game(s);
    expect(g.movementBase).toBe(6 + 1 + 1);
  });
});

describe('turno de combate', () => {
  it('empieza con todo el movimiento y la acción disponible', () => {
    const g = combat('guerrero', 'zombi', 0, 6);
    expect(g.phase).toBe('player');
    expect(g.combatTurn).toBe(true);
    expect(g.turnMove).toBe(5);
    expect(g.actionUsed).toBe(false);
  });

  it('moverse descuenta casillas y no termina el turno', () => {
    // El orco ve lejos (6): el combate sigue aunque te alejes un poco.
    const g = combat('guerrero', 'orco_bruto', 0, 6);
    const p = g.playerPos;
    g.tapTile(p.x, p.y - 2);
    walk(g);
    expect(g.playerPos).toEqual({ x: p.x, y: p.y - 2 });
    expect(g.turnMove).toBe(3);
    expect(g.phase).toBe('player');
    // Tocar más lejos que tu movimiento: avanzas lo máximo posible.
    g.tapTile(p.x, p.y - 9);
    walk(g);
    expect(g.turnMove).toBe(0);
    expect(g.playerPos.y).toBe(p.y - 5);
    expect(g.phase).toBe('player'); // aún tienes la acción
  });

  it('sólo una acción por turno', () => {
    const g = combat('guerrero', 'orco_bruto', 1, 0);
    g.state.player.hp = 999;
    const e = g.enemies[0]!;
    g.tapTile(e.x, e.y);
    expect(g.actionUsed).toBe(true);
    expect(g.phase).toBe('player'); // queda movimiento
    expect(g.actionBlocked()).not.toBeNull();
    expect(g.startAttack()).toMatch(/acción/);
    g.defend();
    expect(g.defending).toBe(false);
    expect(g.dash()).toMatch(/acción/);
  });

  it('correr suma tu movimiento y gasta la acción', () => {
    const g = combat('picaro', 'zombi', 0, 6);
    expect(g.dash()).toBeNull();
    expect(g.turnMove).toBe(12);
    expect(g.actionUsed).toBe(true);
  });

  it('ralentizado divide el movimiento', () => {
    const g = combat('guerrero', 'zombi', 0, 7);
    g.combat.statuses.push({ id: 'ralentizado', turns: 5 });
    g.waitTurn();
    settle(g);
    expect(g.turnMove).toBe(2);
  });

  it('el turno acaba solo al gastar acción y movimiento', () => {
    const g = combat('guerrero', 'orco_bruto', 1, 0);
    g.state.player.hp = 999;
    g.turnMove = 0;
    const e = g.enemies[0]!;
    const turn = g.state.turn;
    g.tapTile(e.x, e.y);
    expect(g.state.turn).toBe(turn + 1);
    expect(g.phase === 'enemies' || g.state.turn > turn).toBe(true);
  });

  it('terminar turno con la acción sin usar también vale', () => {
    const g = combat('mago', 'zombi', 0, 6);
    const turn = g.state.turn;
    g.waitTurn();
    expect(g.state.turn).toBe(turn + 1);
  });
});

describe('movimiento de los enemigos', () => {
  it('un enemigo de 4 casillas se acerca y ataca en el mismo turno', () => {
    const g = new Game(testState('guerrero'));
    g.enemies = [];
    (g as unknown as { ally: null }).ally = null;
    (g as unknown as { pet: null }).pet = null;
    const p = g.playerPos;
    const e = g.spawnEnemy('goblin', p.x, p.y + 5)!;
    expect(g.enemyMovement(e)).toBe(4);
    e.alerted = true;
    const msgs: string[] = [];
    g.events.on('message', (m) => msgs.push(m.text));
    g.state.player.hp = 999;
    g.waitTurn();
    settle(g);
    expect(Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y))).toBe(1);
    expect(msgs.some((m) => /Goblin (te alcanza|falla)/.test(m))).toBe(true);
  });

  it('los lobos corren más y los zombis menos', () => {
    const g = new Game(testState('guerrero'));
    g.enemies = [];
    const p = g.playerPos;
    const lobo = g.spawnEnemy('lobo', p.x - 3, p.y)!;
    const zombi = g.spawnEnemy('zombi', p.x + 3, p.y)!;
    expect(g.enemyMovement(lobo)).toBe(7);
    expect(g.enemyMovement(zombi)).toBe(2);
    lobo.statuses.push({ id: 'ralentizado', turns: 2 });
    expect(g.enemyMovement(lobo)).toBe(3);
  });
});
