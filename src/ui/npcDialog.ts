/**
 * DIÁLOGO CON PNJ (hoja inferior)
 * Muestra el texto del nodo actual y sus opciones. Las acciones (tienda,
 * posada, templo, misiones...) se delegan en `handlers`.
 */
import { NPCS } from '@/data/registry';
import type { DialogAction, DialogOption, NpcDef } from '@/data/schema';
import type { Game } from '@/game/game';
import * as Quests from '@/game/quests/quests';
import { PAL } from '@/gfx/palette';
import { spriteCanvas } from '@/gfx/sprites';
import { h } from './dom';

export interface DialogHandlers {
  openShop(shopId: string): void;
  /** Tras descansar o sanar (guardar partida, etc.). */
  afterService(): void;
  close(): void;
}

const KIND_TAG: Record<string, string> = { principal: '★ Principal', secundaria: 'Secundaria', repetible: '↻ Encargo' };

export function npcDialog(game: Game, npc: NpcDef, handlers: DialogHandlers): HTMLElement {
  const back = h('div', { class: 'dialog-back' });
  const sheet = h('div', { class: 'dialog-sheet' });
  back.append(sheet);
  const l = npc.look;
  const portrait = spriteCanvas(
    { hair: l.hair ?? PAL.hair, skin: l.skin ?? PAL.skin, cloth: l.cloth, clothDark: l.clothDark, pants: l.pants, ...(l.hat ? { hat: l.hat } : {}), ...(l.overlay ? { overlay: l.overlay } : {}) },
    'dialog-portrait',
  );
  const close = () => {
    back.remove();
    handlers.close();
  };

  const header = (text: string) =>
    h('div', { class: 'dialog-head' }, [
      portrait,
      h('div', {}, [h('b', { text: npc.name }), npc.title ? h('small', { class: 'muted', text: ` · ${npc.title}` }) : null, h('p', { text })]),
    ]);

  const visible = (o: DialogOption): boolean => {
    if (o.ifFlag) {
      const neg = o.ifFlag.startsWith('!');
      const has = !!game.state.flags[neg ? o.ifFlag.slice(1) : o.ifFlag];
      if (neg === has) return false;
    }
    if (o.ifQuest) {
      const st = Quests.questStatus(game.state, o.ifQuest.quest);
      const want = o.ifQuest.state;
      if (want === 'activa' ? !(st === 'activa' || st === 'lista') : st !== want) return false;
    }
    if (o.action?.type === 'quests' && Quests.questsForNpc(game.state, npc.id).length === 0) return false;
    return true;
  };

  const showNode = (id: string, override?: string) => {
    const node = npc.dialog[id] ?? npc.dialog['inicio'];
    if (!node) return close();
    const text = override ?? (Array.isArray(node.text) ? node.text[Math.floor(Math.random() * node.text.length)]! : node.text);
    sheet.replaceChildren(
      header(text),
      h('div', { class: 'dialog-options' }, node.options.filter(visible).map((o) =>
        h('button', { text: optionLabel(o), onClick: () => choose(o) }),
      )),
    );
  };

  const optionLabel = (o: DialogOption): string => {
    if (o.action?.type === 'quests') {
      const list = Quests.questsForNpc(game.state, npc.id);
      if (list.some((q) => q.status === 'lista' && (q.quest.turnIn ?? q.quest.giver) === npc.id)) return '📜 Misiones (¡entregar!)';
      if (list.some((q) => q.status === 'disponible')) return '📜 Misiones (nueva)';
    }
    if (o.action?.type === 'temple') return `${o.label} (${o.action.pricePerLevel * game.state.player.level} oro)`;
    return o.label;
  };

  const choose = (o: DialogOption) => {
    if (o.action) return act(o.action);
    if (o.goto) showNode(o.goto);
  };

  const act = (a: DialogAction) => {
    switch (a.type) {
      case 'end':
        return close();
      case 'shop':
        back.remove();
        return handlers.openShop(a.shop);
      case 'inn': {
        const err = game.rest(a.price);
        if (!err) handlers.afterService();
        return showNode('inicio', err ?? '¡Que descanses! Mañana será otro día.');
      }
      case 'temple': {
        const err = game.templeHeal(a.pricePerLevel);
        if (!err) handlers.afterService();
        return showNode('inicio', err ?? 'Que la Llama te acompañe.');
      }
      case 'flag':
        game.state.flags[a.flag] = true;
        return showNode('inicio');
      case 'quests':
        return showQuests();
    }
  };

  const showQuests = (note?: string) => {
    const list = Quests.questsForNpc(game.state, npc.id);
    sheet.replaceChildren(
      header(note ?? (list.length ? '¿Qué te interesa?' : 'Ahora mismo no tengo nada para ti.')),
      h('div', { class: 'quest-list' }, list.map(({ quest: q, status }) => {
        const objectives = q.objectives.map((o, i) => {
          const p = Quests.objectiveProgress(game.state, q, i);
          const done = p.have >= p.need;
          return h('li', { class: done ? 'done' : '', text: `${done ? '✔' : '•'} ${o.label}${p.need > 1 ? ` (${status === 'disponible' ? 0 : p.have}/${p.need})` : ''}` });
        });
        const rw = q.rewards;
        const btn =
          status === 'disponible'
            ? h('button', { class: 'primary', text: 'Aceptar', onClick: () => { game.acceptQuest(q.id); handlers.afterService(); showQuests('Cuento contigo.'); } })
            : status === 'lista' && (q.turnIn ?? q.giver) === npc.id
              ? h('button', { class: 'primary', text: 'Entregar', onClick: () => {
                  const err = game.turnInQuest(q.id, npc.id);
                  handlers.afterService();
                  showQuests(err ?? q.completeText ?? '¡Gracias!');
                } })
              : h('small', { class: 'muted', text: status === 'lista' ? `Entrégala a ${NPCS.get(q.turnIn ?? q.giver)?.name ?? '?'}` : 'En curso' });
        return h('div', { class: 'quest-card' }, [
          h('div', { class: 'quest-title' }, [h('b', { text: q.name }), h('small', { class: `tag ${q.kind}`, text: KIND_TAG[q.kind] ?? q.kind })]),
          h('p', { text: q.description }),
          h('ul', {}, objectives),
          h('small', { class: 'reward', text: `Recompensa: ${rw.xp} XP · ${rw.gold} oro${rw.items?.length ? ' · objetos' : ''}` }),
          btn,
        ]);
      })),
      h('div', { class: 'dialog-options' }, [
        h('button', { text: 'Volver', onClick: () => showNode('inicio') }),
        h('button', { text: 'Adiós', onClick: close }),
      ]),
    );
  };

  showNode('inicio');
  return back;
}
