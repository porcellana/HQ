/**
 * Garantiza que todo PNJ que da o recibe una misión tiene en su diálogo la opción
 * «📜 Misiones» (si no, la misión no se puede aceptar ni entregar), y que las
 * misiones de «hablar con» y «entregar a» funcionan de principio a fin.
 */
import { describe, expect, it } from 'vitest';
import { NPCS, QUESTS } from '@/data/registry';
import { Game } from '@/game/game';
import * as Quests from '@/game/quests/quests';
import { testState } from './helpers';

const hasQuestsOption = (npcId: string): boolean => JSON.stringify(NPCS.get(npcId)?.dialog ?? {}).includes('"type":"quests"');

describe('PNJ de misiones', () => {
  for (const q of QUESTS.values()) {
    it(`${q.id}: quien la da y quien la recibe puede gestionarla`, () => {
      for (const id of new Set([q.giver, q.turnIn ?? q.giver])) {
        expect(NPCS.has(id), `PNJ inexistente ${id}`).toBe(true);
        expect(hasQuestsOption(id), `${id} no tiene la opción «📜 Misiones» (quests: true)`).toBe(true);
      }
    });
  }

  it('«Carta para la Forja»: se acepta con Brunna, se cuenta al hablar con Garrik y se entrega a Garrik', () => {
    const g = new Game(testState('guerrero'));
    g.state.player.level = 3;
    expect(Quests.questsForNpc(g.state, 'herrera_brunna').some((x) => x.quest.id === 'sq_carta')).toBe(true);
    expect(g.acceptQuest('sq_carta')).toBeNull();
    expect(Quests.questStatus(g.state, 'sq_carta')).toBe('activa');
    // Hablar con Garrik cumple el objetivo…
    Quests.onTalk(g.state, 'herrero_garrik');
    expect(Quests.questStatus(g.state, 'sq_carta')).toBe('lista');
    // …y a Garrik se le puede entregar.
    expect(Quests.questsForNpc(g.state, 'herrero_garrik').some((x) => x.quest.id === 'sq_carta' && x.status === 'lista')).toBe(true);
    const gold = g.state.player.gold;
    expect(g.turnInQuest('sq_carta', 'herrero_garrik')).toBeNull();
    expect(Quests.questStatus(g.state, 'sq_carta')).toBe('completada');
    expect(g.state.player.gold).toBeGreaterThan(gold);
  });
});
