/** v0.4: combate paso a paso, Defender, orden de turnos, mascotas como recompensa y objetivo «vincular». */
import { describe, expect, it } from 'vitest';
import { PET_SPECIES, QUESTS, ZONES } from '@/data/registry';
import { Game } from '@/game/game';
import { countItem } from '@/game/items/inventory';
import * as Quests from '@/game/quests/quests';
import { testState } from './helpers';

function arena(speed: 'paso' | 'lenta' | 'normal'): Game {
  const g = new Game(testState('guerrero'));
  g.enemies = [];
  g.combatSpeed = speed;
  g.state.player.hp = g.state.player.maxHp = 500;
  return g;
}

function spawnFoes(g: Game, n: number) {
  const p = g.playerPos;
  const spots = [[0, -2], [2, -2], [-2, -2], [1, -3], [-1, -3]];
  for (let i = 0; i < n; i++) {
    const [dx, dy] = spots[i]!;
    const e = g.spawnEnemy('goblin', p.x + dx!, p.y + dy!);
    if (e) e.alerted = true;
  }
  expect(g.inCombat).toBe(true);
}

describe('combate paso a paso', () => {
  it('no avanza hasta pulsar «Siguiente»', () => {
    const g = arena('paso');
    spawnFoes(g, 2);
    const actions: string[] = [];
    g.events.on('actorAction', (a) => actions.push(a.name));
    g.waitTurn();
    expect(g.phase).toBe('enemies');
    for (let i = 0; i < 10; i++) g.update(0.3);
    expect(g.awaitingContinue).toBe(true);
    const done = actions.length;
    for (let i = 0; i < 20; i++) g.update(0.3);
    expect(actions.length).toBe(done); // sigue esperando
    // Pulsar «Siguiente» hasta que vuelva tu turno
    for (let i = 0; i < 20 && g.phase !== 'player'; i++) {
      g.continueTurn();
      for (let k = 0; k < 10; k++) g.update(0.3);
    }
    expect(g.phase).toBe('player');
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(g.currentActor?.kind).toBe('player');
  });

  it('en modo normal no espera (los tests de equilibrio siguen igual)', () => {
    const g = arena('normal');
    spawnFoes(g, 2);
    g.waitTurn();
    for (let i = 0; i < 40 && g.phase !== 'player'; i++) g.update(0.25);
    expect(g.phase).toBe('player');
    expect(g.awaitingContinue).toBe(false);
  });

  it('Defender da +2 CA hasta tu próximo turno', () => {
    const g = arena('normal');
    spawnFoes(g, 1);
    const base = g.playerAC();
    g.defend();
    expect(g.defending).toBe(true);
    expect(g.playerAC()).toBe(base + 2);
    for (let i = 0; i < 40 && g.phase !== 'player'; i++) g.update(0.25);
    expect(g.defending).toBe(false);
    expect(g.playerAC()).toBe(base);
  });

  it('orden de turnos: tú primero, luego aliados y enemigos en combate', () => {
    const g = arena('paso');
    g.chooseStarter('chispon');
    spawnFoes(g, 2);
    const order = g.turnOrder();
    expect(order[0]!.actor.kind).toBe('player');
    expect(order.some((o) => o.actor.kind === 'pet')).toBe(true);
    expect(order.filter((o) => o.actor.kind === 'enemy')).toHaveLength(2);
    // Con mascota el ciclo también termina en tu turno
    g.waitTurn();
    const kinds: string[] = [];
    g.events.on('actorAction', (a) => kinds.push(a.actor.kind));
    for (let i = 0; i < 30 && g.phase !== 'player'; i++) {
      for (let k = 0; k < 10; k++) g.update(0.3);
      g.continueTurn();
    }
    expect(g.phase).toBe('player');
    expect(kinds[0]).toBe('pet');
  });

  it('Atacar: sin enemigos al alcance avisa; con uno, ataca y pasa el turno', () => {
    const g = arena('normal');
    spawnFoes(g, 1);
    expect(g.startAttack()).toMatch(/alcance/);
    const p = g.playerPos;
    const e = g.spawnEnemy('goblin', p.x + 1, p.y) ?? g.spawnEnemy('goblin', p.x - 1, p.y)!;
    e.alerted = true;
    const turn = g.state.turn;
    expect(g.startAttack()).toBeNull();
    expect(g.state.turn).toBe(turn + 1);
  });
});

describe('mascotas v0.4', () => {
  it('cada especie atrapable tiene al menos un hábitat (Aurelión incluido)', () => {
    for (const s of PET_SPECIES.values()) if (s.catchable) expect(s.habitats.length, s.id).toBeGreaterThan(0);
    expect(PET_SPECIES.get('aurelion')!.habitats.length).toBeGreaterThan(0);
  });

  it('al entrar en un hábitat aparece al menos una criatura salvaje', () => {
    const g = new Game(testState('guerrero'));
    g.enterZone('bosque_sombrio', '1');
    expect(g.enemies.some((e) => e.def.pet)).toBe(true);
  });

  it('la mascota inicial trae 3 runas y abre «Tu primera captura»', () => {
    const g = new Game(testState('guerrero'));
    expect(Quests.questStatus(g.state, 'sq_primera_captura')).toBe('bloqueada');
    g.chooseStarter('gotin');
    expect(countItem(g.state.player, 'runa_vinculo')).toBe(3);
    expect(Quests.questStatus(g.state, 'sq_primera_captura')).toBe('disponible');
    expect(g.acceptQuest('sq_primera_captura')).toBeNull();
    expect(Quests.onBind(g.state, 'guijarrin').length).toBe(1);
    expect(Quests.questStatus(g.state, 'sq_primera_captura')).toBe('lista');
    expect(Quests.shortObjective(g.state, QUESTS.get('sq_primera_captura')!, 0)).toMatch(/Vincular/);
    expect(g.turnInQuest('sq_primera_captura', 'cuidador_tobias')).toBeNull();
    expect(countItem(g.state.player, 'runa_vinculo')).toBe(6);
  });

  it('las recompensas de mascota existen y van al establo si ya llevas una', () => {
    const withPet = [...QUESTS.values()].filter((q) => q.rewards.pet);
    expect(withPet.length).toBeGreaterThanOrEqual(3);
    for (const q of withPet) expect(PET_SPECIES.has(q.rewards.pet!.species), q.id).toBe(true);
    const g = new Game(testState('guerrero'));
    g.givePet('umbrin', 4, 'test');
    expect(g.state.pets.active?.species).toBe('umbrin');
    g.givePet('aurelion', 10, 'test');
    expect(g.state.pets.stable.some((p) => p.species === 'aurelion')).toBe(true);
  });

  it('la guía de «vincular» lleva a un hábitat', async () => {
    const { questGoalZone } = await import('@/game/quests/guide');
    const g = new Game(testState('guerrero'));
    g.chooseStarter('brotin');
    g.acceptQuest('sq_primera_captura');
    const zone = questGoalZone(g.state, QUESTS.get('sq_primera_captura')!);
    expect(zone).not.toBeNull();
    expect(ZONES.has(zone!) || zone!.length > 0).toBe(true);
  });
});
