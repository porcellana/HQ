/** v0.2.1: misión seguida, guía GPS y siguiente paso. */
import { describe, expect, it } from 'vitest';
import { NPCS } from '@/data/registry';
import { Game } from '@/game/game';
import { itemSourceZone, nextHop, questGoalZone, questStep } from '@/game/quests/guide';
import * as Quests from '@/game/quests/quests';
import { DEFAULT_SETTINGS } from '@/game/settings';
import { testState } from './helpers';

describe('misión seguida', () => {
  it('por defecto se sigue la principal; se puede elegir otra y vuelve a la principal al acabarla', () => {
    const s = testState();
    expect(Quests.accept(s, 'sq_ratas')).toBeNull();
    expect(Quests.accept(s, 'mq1_sombras')).toBeNull();
    expect(Quests.trackedQuestDef(s)?.id).toBe('mq1_sombras');
    Quests.setTracked(s, 'sq_ratas');
    expect(Quests.trackedQuestDef(s)?.id).toBe('sq_ratas');
    expect(Quests.trackedQuest(s)?.quest.id).toBe('sq_ratas');
    s.quests['sq_ratas']!.status = 'completada';
    expect(Quests.trackedQuestDef(s)?.id).toBe('mq1_sombras');
    Quests.setTracked(s, 'no_existe');
    expect(s.trackedQuestId).toBeNull();
  });

  it('la guía está activada por defecto en los ajustes', () => {
    expect(DEFAULT_SETTINGS.questGuide).toBe(true);
  });
});

describe('siguiente paso de la guía', () => {
  it('tipos de paso y entrega', () => {
    const s = testState();
    Quests.accept(s, 'mq1_sombras');
    expect(questStep(s, Quests.getQuest('mq1_sombras'))).toMatchObject({ kind: 'cazar', family: 'goblinoide' });
    expect(questGoalZone(s, Quests.getQuest('mq1_sombras'))).toBe('bosque_sombrio');
    s.quests['mq1_sombras']!.progress = [5];
    expect(questStep(s, Quests.getQuest('mq1_sombras'))).toEqual({ kind: 'hablar', npc: 'alcalde_ortun' });
    expect(questGoalZone(s, Quests.getQuest('mq1_sombras'))).toBe(NPCS.get('alcalde_ortun')!.zone);
  });

  it('«consigue X» lleva a donde se consigue: vetas o enemigos que lo sueltan', () => {
    expect(itemSourceZone('mineral_hierro')).not.toBeNull();
    expect(itemSourceZone('colmillo_goblin')).not.toBeNull();
    expect(itemSourceZone('objeto_inventado')).toBeNull();
  });

  it('desde la aldea, la salida hacia el bosque es la buena', () => {
    const g = new Game(testState());
    expect(nextHop(g.zone, 'bosque_sombrio')).toBe('bosque_sombrio');
  });

  it('el punto de la guía apunta al PNJ si está en la zona', () => {
    const s = testState();
    Quests.accept(s, 'mq1_sombras');
    s.quests['mq1_sombras']!.progress = [5];
    const npc = NPCS.get('alcalde_ortun')!;
    const g = new Game(s);
    g.enterZone(npc.zone, '1');
    const goal = g.questGoal!;
    expect(goal.kind).toBe('hablar');
    expect(goal.point).toEqual({ x: npc.x, y: npc.y });
  });

  it('fuera de la zona del objetivo, el punto es la salida que acerca', () => {
    const s = testState();
    Quests.accept(s, 'mq1_sombras');
    const g = new Game(s);
    const goal = g.questGoal!;
    expect(goal.exitTo).toBe('bosque_sombrio');
    const exit = g.zone.exits.find((e) => e.to === 'bosque_sombrio')!;
    expect(goal.point && g.zone.exitAt(goal.point.x, goal.point.y)?.to).toBe(exit.to);
  });
});

describe('mapa: casillas exploradas', () => {
  it('fuera de mazmorras se ve todo', () => {
    const g = new Game(testState());
    expect(g.isExplored(0, 0)).toBe(true);
  });
});
