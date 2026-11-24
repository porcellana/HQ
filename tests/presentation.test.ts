/**
 * Presentación del combate en el motor: eventos en orden, retraso visual,
 * pausas por velocidad, «Siguiente» con espera mínima y saltar ronda.
 * Con `cinematic = false` (el valor por defecto en los tests) todo es instantáneo.
 */
import { describe, expect, it } from 'vitest';
import { PACING } from '@/data/config/combat_pacing';
import type { CombatFxEvent } from '@/game/combat/presentation';
import { Game, type DiceEvent } from '@/game/game';
import { testState } from './helpers';

function setup(speed: 'paso' | 'lenta' | 'normal', cinematic: boolean, enemies = 1) {
  const g = new Game(testState('guerrero'));
  g.enemies = [];
  g.cinematic = cinematic;
  g.combatSpeed = speed;
  g.state.player.hp = g.state.player.maxHp = 200;
  const p = g.playerPos;
  const spots = [[0, -1], [1, 0], [-1, 0], [0, 1], [1, -1]] as const;
  for (let i = 0; i < enemies; i++) {
    const [dx, dy] = spots[i]!;
    const e = g.spawnEnemy('goblin', p.x + dx, p.y + dy)!;
    e.alerted = true;
    e.hp = e.maxHp = 60;
  }
  const log: string[] = [];
  const dice: DiceEvent[] = [];
  const cfx: CombatFxEvent[] = [];
  g.events.on('dice', (d) => {
    dice.push(d);
    log.push('dice');
  });
  g.events.on('cfx', (c) => {
    cfx.push(c);
    log.push(`cfx:${c.type}`);
  });
  const msgs: Array<{ text: string; delay?: number }> = [];
  g.events.on('message', (m) => msgs.push({ text: m.text, ...(m.delay !== undefined ? { delay: m.delay } : {}) }));
  return { g, log, dice, cfx, msgs };
}

/** Avanza el tiempo hasta que sea tu turno (o hasta que el juego espere «Siguiente»). */
function run(g: Game, seconds: number, step = 0.05) {
  for (let t = 0; t < seconds; t += step) {
    g.update(step);
    if (g.awaitingContinue) break;
  }
}

describe('eventos de presentación', () => {
  it('la tirada (dice) llega antes que el daño (cfx hit) y lleva atacante, defensor y acción', () => {
    const { g, log, dice } = setup('normal', false);
    const e = g.enemies[0]!;
    // Forzamos impacto con un d20 alto.
    const orig = g.rng.int.bind(g.rng);
    g.rng.int = (a: number, b: number) => (a === 1 && b === 20 ? 19 : orig(a, b));
    g.tapTile(e.x, e.y);
    expect(log[0]).toBe('dice');
    expect(log).toContain('cfx:hit');
    expect(log.indexOf('dice')).toBeLessThan(log.indexOf('cfx:hit'));
    expect(dice[0]!.attacker).toEqual({ kind: 'player' });
    expect(dice[0]!.defender).toEqual({ kind: 'enemy', uid: e.uid });
    expect(dice[0]!.action).toBeTruthy();
  });

  it('un golpe de gracia emite hit y después kill con el botín', () => {
    const { g, cfx } = setup('normal', false);
    const e = g.enemies[0]!;
    e.hp = 1;
    const orig = g.rng.int.bind(g.rng);
    g.rng.int = (a: number, b: number) => (a === 1 && b === 20 ? 20 : orig(a, b));
    g.tapTile(e.x, e.y);
    const types = cfx.map((c) => c.type);
    expect(types.indexOf('hit')).toBeLessThan(types.indexOf('kill'));
    const kill = cfx.find((c) => c.type === 'kill')!;
    expect(kill.type === 'kill' && kill.xp).toBeGreaterThan(0);
  });

  it('los enemigos también emiten tirada y daño sobre ti', () => {
    const { g, dice, cfx } = setup('normal', false);
    g.endPlayerTurn();
    for (let i = 0; i < 40 && g.phase === 'enemies'; i++) g.update(0.25);
    const foe = dice.find((d) => d.attacker?.kind === 'enemy');
    expect(foe?.defender).toEqual({ kind: 'player' });
    expect(foe?.small).toBe(true);
    // Si impactó, hay un hit sobre el jugador con tipo de daño.
    const hit = cfx.find((c) => c.type === 'hit' && c.target.kind === 'player');
    if (hit && hit.type === 'hit') expect(hit.dmgType).toBeTruthy();
  });
});

describe('retraso visual (lead) y ritmo', () => {
  it('no cinematográfico: todo instantáneo, sin retraso ni esperas', () => {
    const { g, cfx, msgs } = setup('paso', false);
    const e = g.enemies[0]!;
    g.tapTile(e.x, e.y);
    expect(g.actionLead).toBe(0);
    for (const c of cfx) expect(c.lead).toBe(0);
    for (const m of msgs) expect(m.delay ?? 0).toBe(0);
  });

  it('cinematográfico: el impacto, los mensajes y el sonido llevan el retraso de la velocidad', () => {
    for (const speed of ['paso', 'lenta', 'normal'] as const) {
      const { g, cfx, msgs, dice } = setup(speed, true);
      const e = g.enemies[0]!;
      const orig = g.rng.int.bind(g.rng);
      g.rng.int = (a: number, b: number) => (a === 1 && b === 20 ? 18 : orig(a, b));
      g.tapTile(e.x, e.y);
      expect(dice[0]!.lead, speed).toBe(PACING[speed].lead);
      const hit = cfx.find((c) => c.type === 'hit');
      expect(hit?.lead, speed).toBe(PACING[speed].lead);
      expect(msgs.some((m) => (m.delay ?? 0) === PACING[speed].lead), speed).toBe(true);
    }
  });

  it('la barra de vida del enemigo no baja hasta que se revela el golpe', () => {
    const { g } = setup('lenta', true);
    const e = g.enemies[0]!;
    const orig = g.rng.int.bind(g.rng);
    g.rng.int = (a: number, b: number) => (a === 1 && b === 20 ? 18 : orig(a, b));
    const before = e.hp;
    g.tapTile(e.x, e.y);
    expect(e.hp).toBeLessThan(before); // la lógica es instantánea…
    expect(e.shownHp).toBe(before); // …pero la barra aún enseña la vida anterior
    g.update(PACING.lenta.lead + 0.05);
    expect(e.shownHp).toBeUndefined();
  });

  it('el HUD del jugador tampoco baja la vida antes de tiempo', () => {
    const { g } = setup('lenta', true);
    const before = g.state.player.hp;
    g.endPlayerTurn();
    let hurt = false;
    g.events.on('playerHurt', () => {
      hurt = true;
      expect(g.hudHp).toBe(before);
    });
    for (let i = 0; i < 80 && g.phase === 'enemies' && !hurt; i++) g.update(0.1);
    if (hurt) {
      expect(g.state.player.hp).toBeLessThan(before);
      for (let i = 0; i < 12; i++) g.update(0.1);
      expect(g.hudHp).toBe(g.state.player.hp);
    }
  });

  it('modo normal sin cinemática no bloquea: la ronda enemiga termina sola', () => {
    const { g } = setup('normal', false, 3);
    g.endPlayerTurn();
    for (let i = 0; i < 60 && g.phase === 'enemies'; i++) g.update(0.25);
    expect(g.phase).toBe('player');
    expect(g.awaitingContinue).toBe(false);
  });
});

describe('paso a paso y saltar ronda', () => {
  it('cada actor espera a «Siguiente», que tarda un mínimo en estar disponible', () => {
    const { g } = setup('paso', true, 2);
    g.endPlayerTurn();
    // Pasa la pausa tras tu propia acción.
    run(g, 6);
    expect(g.awaitingContinue).toBe(true);
    expect(g.holdT).toBeGreaterThan(0);
    g.continueTurn(); // demasiado pronto: se ignora
    expect(g.awaitingContinue).toBe(true);
    for (let i = 0; i < 40 && g.holdT > 0; i++) g.update(0.05);
    expect(g.holdT).toBe(0);
    g.continueTurn();
    expect(g.awaitingContinue).toBe(false);
  });

  it('ofrece «Saltar ronda» con 3+ actores y la acelera sin esperas', () => {
    const { g } = setup('paso', true, 4);
    g.endPlayerTurn();
    run(g, 6);
    expect(g.awaitingContinue).toBe(true);
    expect(g.canSkipRound).toBe(true);
    g.skipRound();
    // Sin pausas: en unos pocos pasos llegamos a tu turno otra vez.
    for (let i = 0; i < 40 && g.phase === 'enemies'; i++) g.update(0.05);
    expect(g.phase).toBe('player');
    expect(g.fastRound).toBe(false); // se restablece al empezar tu turno
  });

  it('con 1-2 actores no se ofrece saltar', () => {
    const { g } = setup('paso', true, 1);
    g.endPlayerTurn();
    run(g, 6);
    expect(g.canSkipRound).toBe(false);
  });

  it('fuera de modo cinematográfico saltar ronda no hace nada', () => {
    const { g } = setup('paso', false, 4);
    g.endPlayerTurn();
    g.skipRound();
    expect(g.fastRound).toBe(false);
  });

  it('al huir con éxito se marca fled (no se celebra una victoria)', () => {
    const { g } = setup('normal', false);
    g.state.player.stats.DES = 30;
    const orig = g.rng.int.bind(g.rng);
    g.rng.int = (a: number, b: number) => (a === 1 && b === 20 ? 20 : orig(a, b));
    g.flee();
    expect(g.fled).toBe(true);
  });
});
