/**
 * MENÚ DE MISIONES (botón 📖 de la barra de abajo)
 * Pensado para entenderse de un vistazo. Cada misión en curso es una tarjeta con:
 *   ▶ la tarea de AHORA resaltada, ✓ las hechas y ○ las que faltan, con lo que
 *     llevas («Tienes 2 de 5») y una barra de progreso (si está lista, un aviso
 *     verde dice a quién entregarla)
 *   📍 DÓNDE ir (zona y ruta desde donde estás)
 *   🎁 recompensa, y botones «★ Seguir» e «Historia».
 * Además: misiones nuevas conocidas (a quién hablar) y las completadas.
 */
import { NPCS, QUESTS, getItem } from '@/data/registry';
import type { QuestDef, QuestObjective } from '@/data/schema';
import type { Game } from '@/game/game';
import { questGoalZone, routeNames, zoneName } from '@/game/quests/guide';
import * as Quests from '@/game/quests/quests';
import { h } from './dom';

const KIND_LABEL: Record<QuestDef['kind'], string> = { principal: 'Principal', secundaria: 'Secundaria', repetible: 'Encargo' };
const KIND_ORDER: Record<QuestDef['kind'], number> = { principal: 0, secundaria: 1, repetible: 2 };

/** Texto de recompensa: «150 XP · 40 oro · Poción ×2». */
export function rewardText(q: QuestDef): string {
  return [
    q.rewards.xp ? `${q.rewards.xp} XP` : '',
    q.rewards.gold ? `${q.rewards.gold} oro` : '',
    ...(q.rewards.items ?? []).map((it) => `${getItem(it.item)?.name ?? it.item}${(it.qty ?? 1) > 1 ? ` ×${it.qty}` : ''}`),
    q.rewards.pet ? '🐾 una mascota' : '',
  ].filter(Boolean).join(' · ');
}

/** «Tienes 2 de 5» / «Llevas 2 de 5» según el tipo de objetivo (vacío si no hay cantidad). */
export function progressText(o: QuestObjective, have: number, need: number): string {
  if (need <= 1) return '';
  const verb = o.type === 'collect' ? 'Tienes' : 'Llevas';
  return `${verb} ${have} de ${need}`;
}

/** Nombre del PNJ y su lugar: «Marga · Taberna La Jarra Roja». */
function whoAndWhere(npcId: string): string {
  const n = NPCS.get(npcId);
  return n ? `${n.name} · ${zoneName(n.zone)}` : '?';
}

export function journalScreen(game: Game, onClose: () => void, initialOpen: string | null = null): HTMLElement {
  const root = h('div', { class: 'screen journal' });
  let tab: 'curso' | 'hechas' = 'curso';
  const story = new Set<string>(initialOpen ? [initialOpen] : []);

  const render = () => {
    const s = game.state;
    const tracked = Quests.trackedQuestDef(s);
    const active = [...Quests.activeQuests(s)].sort((a, b) => {
      const ta = a.id === tracked?.id ? -2 : Quests.isReady(s, a) ? -1 : 0;
      const tb = b.id === tracked?.id ? -2 : Quests.isReady(s, b) ? -1 : 0;
      return ta - tb || KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    });
    const done = Object.entries(s.quests)
      .filter(([, q]) => (q.completions > 0 || q.failed) && q.status !== 'activa')
      .map(([id, st]) => ({ q: QUESTS.get(id), n: st.completions, failed: !!st.failed }))
      .filter((x): x is { q: QuestDef; n: number; failed: boolean } => !!x.q);
    // Misiones nuevas que ya se pueden coger y cuyo PNJ conoces (has pisado su zona).
    const fresh = [...QUESTS.values()].filter((q) => {
      if (Quests.questStatus(s, q.id) !== 'disponible') return false;
      const giver = NPCS.get(q.giver);
      return !!giver && s.visitedZones.includes(giver.zone);
    }).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

    const tabs = h('div', { class: 'qj-tabs' }, [
      h('button', { class: tab === 'curso' ? 'on' : '', text: `En curso (${active.length})`, onClick: () => { tab = 'curso'; render(); } }),
      h('button', { class: tab === 'hechas' ? 'on' : '', text: `Hechas (${done.length})`, onClick: () => { tab = 'hechas'; render(); } }),
    ]);

    const body: HTMLElement[] = [];
    if (tab === 'curso') {
      if (!active.length) body.push(h('p', { class: 'muted qj-empty', text: 'No tienes misiones en curso. Habla con la gente: quien tenga un cristal dorado encima te dará trabajo.' }));
      for (const q of active) body.push(activeCard(game, q, tracked?.id === q.id, story, render));
      if (fresh.length) {
        body.push(h('h3', { class: 'qj-sub', text: '❗ Misiones nuevas' }));
        for (const q of fresh.slice(0, 6)) {
          body.push(h('div', { class: 'qj-new' }, [
            h('b', { text: q.name }),
            h('small', { class: `tag ${q.kind}`, text: KIND_LABEL[q.kind] }),
            h('div', { class: 'qj-line', text: `💬 Habla con ${whoAndWhere(q.giver)}` }),
          ]));
        }
      }
    } else if (!done.length) {
      body.push(h('p', { class: 'muted qj-empty', text: 'Todavía no has completado ninguna.' }));
    } else {
      for (const d of done) {
        body.push(h('div', { class: 'qj-done' }, [
          h('b', { text: `${d.failed ? '✗' : '✓'} ${d.q.name}${d.n > 1 ? ` ×${d.n}` : ''}${d.failed ? ' (fallida)' : ''}` }),
          h('small', { class: `tag ${d.q.kind}`, text: KIND_LABEL[d.q.kind] }),
        ]));
      }
    }

    root.replaceChildren(
      h('h2', { text: '📖 Misiones' }),
      tabs,
      h('div', { class: 'qj-list' }, body),
      h('div', { class: 'menu-buttons' }, [h('button', { class: 'primary', text: 'Cerrar', onClick: onClose })]),
    );
  };
  render();
  // Si se abrió desde una misión concreta, se muestra a la vista.
  if (initialOpen) window.setTimeout(() => root.querySelector('.qj-card.focus')?.scrollIntoView({ block: 'start' }), 30);
  return root;
}

/** Tarjeta de una misión en curso. */
function activeCard(game: Game, q: QuestDef, isTracked: boolean, story: Set<string>, rerender: () => void): HTMLElement {
  const s = game.state;
  const ready = Quests.isReady(s, q);
  const firstPending = q.objectives.findIndex((_, i) => {
    const p = Quests.objectiveProgress(s, q, i);
    return p.have < p.need;
  });
  const turnInNpc = q.turnIn ?? q.giver;

  // ▶ QUÉ HACER ahora
  let todo: string;
  let whereZone: string | null;
  if (ready) {
    todo = `💬 ¡Lista! Entrégala: habla con ${whoAndWhere(turnInNpc)}`;
    whereZone = NPCS.get(turnInNpc)?.zone ?? null;
  } else {
    const o = q.objectives[firstPending];
    whereZone = questGoalZone(s, q);
    todo = o ? (o.type === 'talk' ? `💬 Habla con ${whoAndWhere(o.npc)}` : `${Quests.OBJECTIVE_ICON[o.type]} ${o.label}`) : '…';
  }

  // 📍 DÓNDE ir
  let where: HTMLElement | null = null;
  if (whereZone) {
    const here = game.zone.id === whereZone;
    const route = here ? null : routeNames(game.zone.id, whereZone);
    where = h('div', { class: 'qj-where' }, [
      h('div', { text: `📍 ${here ? 'Estás en el sitio' : 'Ve a'}: ${zoneName(whereZone)}` }),
      route && route.length ? h('small', { class: 'muted', text: `Ruta: ${[zoneName(game.zone.id), ...route].join(' → ')}` }) : null,
    ]);
  }

  const showStory = story.has(q.id);
  return h('div', { class: `qj-card${ready ? ' ready' : ''}${isTracked ? ' tracked' : ''}${story.has(q.id) && story.size === 1 ? ' focus' : ''}` }, [
    h('div', { class: 'qj-head' }, [
      h('b', { text: `${isTracked ? '★ ' : ''}${q.name}` }),
      h('small', { class: `tag ${q.kind}`, text: KIND_LABEL[q.kind] }),
    ]),
    // Sólo la entrega destaca arriba; mientras no esté lista, la tarea actual va resaltada en la lista.
    ready ? h('div', { class: 'qj-todo', text: todo }) : null,
    h('ul', { class: 'qj-tasks' }, q.objectives.map((o, i) => {
      const p = Quests.objectiveProgress(s, q, i);
      const ok = p.have >= p.need;
      const label = progressText(o, p.have, p.need);
      return h('li', { class: `${ok ? 'ok' : ''}${i === firstPending && !ready ? ' now' : ''}` }, [
        h('span', { class: 'ck', text: ok ? '✓' : i === firstPending ? '▶' : '○' }),
        h('div', { class: 'tx' }, [
          h('span', { text: o.label }),
          p.need > 1 ? h('small', { class: 'muted', text: ok ? `Completado (${p.need})` : label }) : null,
          p.need > 1 ? h('div', { class: 'qj-bar' }, [h('i', { attrs: { style: `width:${Math.round((100 * Math.min(p.have, p.need)) / p.need)}%` } })]) : null,
        ]),
      ]);
    })),
    where,
    h('div', { class: 'qj-reward', text: `🎁 ${rewardText(q) || '—'}` }),
    showStory ? h('p', { class: 'quest-story', text: q.description }) : null,
    h('div', { class: 'qj-buttons' }, [
      h('button', {
        class: isTracked ? '' : 'primary', text: isTracked ? '★ Siguiendo' : '☆ Seguir', disabled: isTracked,
        onClick: () => {
          Quests.setTracked(s, q.id);
          game.events.emit('message', { text: `Sigues: ${q.name}.`, kind: 'good' });
          rerender();
        },
      }),
      h('button', { text: showStory ? '📖 Ocultar historia' : '📖 Historia', onClick: () => { if (showStory) story.delete(q.id); else story.add(q.id); rerender(); } }),
    ]),
  ]);
}
