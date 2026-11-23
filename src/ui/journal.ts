/**
 * DIARIO DE MISIONES
 * Lista de misiones en curso y completadas. Al tocar una se abre su ficha:
 * historia, objetivos con progreso, recompensas, quién la da, a quién se
 * entrega y dónde se cumple. «Seguir esta misión» la marca para la guía.
 */
import { NPCS, QUESTS, getItem } from '@/data/registry';
import type { QuestDef } from '@/data/schema';
import type { Game } from '@/game/game';
import { GOAL_ICON, questGoalZone, questStep, zoneName } from '@/game/quests/guide';
import * as Quests from '@/game/quests/quests';
import { h } from './dom';

const KIND_LABEL: Record<QuestDef['kind'], string> = { principal: 'Principal', secundaria: 'Secundaria', repetible: 'Encargo' };

export function journalScreen(game: Game, onClose: () => void): HTMLElement {
  const root = h('div', { class: 'screen journal' });
  let openId: string | null = null;

  const render = () => {
    const s = game.state;
    const active = Quests.activeQuests(s);
    const tracked = Quests.trackedQuestDef(s);
    const done = Object.entries(s.quests)
      .filter(([, q]) => q.completions > 0 && q.status !== 'activa')
      .map(([id, st]) => ({ q: QUESTS.get(id), n: st.completions }))
      .filter((x): x is { q: QuestDef; n: number } => !!x.q);
    const open = openId ? QUESTS.get(openId) : undefined;

    const card = (q: QuestDef, isDone: boolean, times = 0) => {
      const ready = !isDone && Quests.isReady(s, q);
      const isTracked = !isDone && tracked?.id === q.id;
      const step = isDone ? null : Quests.trackedQuest({ ...s, trackedQuestId: q.id });
      return h('button', {
        class: `quest-row${ready ? ' ready' : ''}${isTracked ? ' tracked' : ''}${isDone ? ' done' : ''}`,
        onClick: () => { openId = q.id; render(); },
      }, [
        h('div', { class: 'quest-title' }, [
          h('b', { text: `${isTracked ? '★ ' : ''}${q.name}` }),
          h('small', { class: `tag ${q.kind}`, text: KIND_LABEL[q.kind] }),
        ]),
        isDone
          ? h('small', { class: 'muted', text: `✔ Completada${times > 1 ? ` ×${times}` : ''}` })
          : h('small', { class: ready ? 'reward' : 'muted', text: step ? `${ready ? '✔ ' : ''}${step.text}` : '' }),
      ]);
    };

    const parts: Array<HTMLElement | null> = [
      h('h2', { text: 'Diario de misiones' }),
      open ? detail(game, open, () => { openId = null; render(); }, render) : null,
      h('div', { class: 'panel' }, [
        h('h3', { text: `En curso (${active.length})` }),
        ...(active.length ? active.map((q) => card(q, false))
          : [h('p', { class: 'muted', text: 'No tienes misiones. Habla con la gente: los que tienen ❗ encima te darán trabajo.' })]),
      ]),
      h('div', { class: 'panel' }, [
        h('h3', { text: `Completadas (${done.length})` }),
        ...(done.length ? done.map((d) => card(d.q, true, d.n)) : [h('p', { class: 'muted', text: 'Todavía ninguna.' })]),
      ]),
      h('div', { class: 'menu-buttons' }, [h('button', { class: 'primary', text: 'Cerrar', onClick: onClose })]),
    ];
    root.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    if (open) root.scrollTop = 0;
  };
  render();
  return root;
}

/** Ficha completa de una misión. */
function detail(game: Game, q: QuestDef, onBack: () => void, rerender: () => void): HTMLElement {
  const s = game.state;
  const st = s.quests[q.id];
  const activeNow = st?.status === 'activa';
  const ready = activeNow && Quests.isReady(s, q);
  const tracked = Quests.trackedQuestDef(s)?.id === q.id;
  const giver = NPCS.get(q.giver);
  const turnIn = NPCS.get(q.turnIn ?? q.giver);
  const goalZone = activeNow ? questGoalZone(s, q) : null;
  const step = activeNow ? questStep(s, q) : null;
  const rewards = [
    q.rewards.xp ? `${q.rewards.xp} XP` : '',
    q.rewards.gold ? `${q.rewards.gold} de oro` : '',
    ...(q.rewards.items ?? []).map((it) => `${getItem(it.item)?.name ?? it.item}${(it.qty ?? 1) > 1 ? ` ×${it.qty}` : ''}`),
  ].filter(Boolean);
  return h('div', { class: `panel quest-detail${tracked ? ' tracked' : ''}` }, [
    h('div', { class: 'quest-title' }, [h('b', { text: q.name }), h('small', { class: `tag ${q.kind}`, text: KIND_LABEL[q.kind] })]),
    h('p', { class: 'quest-story', text: q.description }),
    h('h3', { text: 'Objetivos' }),
    h('ul', { class: 'quest-objectives' }, q.objectives.map((o, i) => {
      const p = Quests.objectiveProgress(s, q, i);
      const ok = !activeNow || p.have >= p.need;
      return h('li', { class: ok ? 'done' : '', text: `${ok ? '✔' : '•'} ${o.label}${p.need > 1 ? ` (${activeNow ? p.have : p.need}/${p.need})` : ''}` });
    })),
    ready ? h('p', { class: 'reward', text: `¡Lista! Entrégala a ${turnIn?.name ?? '?'}.` }) : null,
    h('div', { class: 'quest-facts' }, [
      h('div', { text: `🧙 La da: ${giver?.name ?? '?'}${giver ? ` · ${zoneName(giver.zone)}` : ''}` }),
      h('div', { text: `📜 Se entrega a: ${turnIn?.name ?? '?'}${turnIn ? ` · ${zoneName(turnIn.zone)}` : ''}` }),
      goalZone && step ? h('div', { text: `${GOAL_ICON[step.kind]} Siguiente paso en: ${zoneName(goalZone)}` }) : null,
      h('div', { text: `🎁 Recompensa: ${rewards.join(', ') || '—'}` }),
    ]),
    h('div', { class: 'item-buttons' }, [
      activeNow
        ? h('button', {
            class: tracked ? '' : 'primary',
            text: tracked ? '★ Siguiendo' : 'Seguir esta misión',
            disabled: tracked,
            onClick: () => {
              Quests.setTracked(s, q.id);
              game.events.emit('message', { text: `Sigues: ${q.name}.`, kind: 'good' });
              rerender();
            },
          })
        : null,
      h('button', { text: '◀ Volver', onClick: onBack }),
    ]),
  ]);
}
