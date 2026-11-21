/** Diario de misiones: activas (con progreso) y completadas. */
import { NPCS, QUESTS } from '@/data/registry';
import type { Game } from '@/game/game';
import * as Quests from '@/game/quests/quests';
import { h } from './dom';

export function journalScreen(game: Game, onClose: () => void): HTMLElement {
  const s = game.state;
  const active = Object.entries(s.quests).filter(([, q]) => q.status === 'activa').map(([id]) => QUESTS.get(id)).filter((q) => !!q);
  const done = Object.entries(s.quests).filter(([, q]) => q.completions > 0).map(([id, st]) => ({ q: QUESTS.get(id), n: st.completions })).filter((x) => !!x.q);
  const order = { principal: 0, secundaria: 1, repetible: 2 };
  active.sort((a, b) => order[a!.kind] - order[b!.kind]);
  return h('div', { class: 'screen journal' }, [
    h('h2', { text: 'Diario de misiones' }),
    h('div', { class: 'panel' }, [
      h('h3', { text: `En curso (${active.length})` }),
      ...(active.length
        ? active.map((q) => {
            const ready = Quests.isReady(s, q!);
            return h('div', { class: `quest-card${ready ? ' ready' : ''}` }, [
              h('div', { class: 'quest-title' }, [h('b', { text: q!.name }), h('small', { class: `tag ${q!.kind}`, text: q!.kind })]),
              h('p', { text: q!.description }),
              h('ul', {}, q!.objectives.map((o, i) => {
                const p = Quests.objectiveProgress(s, q!, i);
                return h('li', { class: p.have >= p.need ? 'done' : '', text: `${p.have >= p.need ? '✔' : '•'} ${o.label}${p.need > 1 ? ` (${p.have}/${p.need})` : ''}` });
              })),
              ready ? h('small', { class: 'reward', text: `¡Lista! Entrégala a ${NPCS.get(q!.turnIn ?? q!.giver)?.name ?? '?'}.` }) : null,
            ]);
          })
        : [h('p', { class: 'muted', text: 'No tienes misiones. Habla con la gente: los que tienen ❗ encima te darán trabajo.' })]),
    ]),
    h('div', { class: 'panel' }, [
      h('h3', { text: 'Completadas' }),
      ...(done.length ? done.map((d) => h('div', { class: 'muted', text: `✔ ${d.q!.name}${d.n > 1 ? ` (×${d.n})` : ''}` })) : [h('p', { class: 'muted', text: 'Todavía ninguna.' })]),
    ]),
    h('div', { class: 'menu-buttons' }, [h('button', { class: 'primary', text: 'Cerrar', onClick: onClose })]),
  ]);
}
