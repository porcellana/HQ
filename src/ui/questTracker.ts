/**
 * LÍNEA DE MISIÓN (abajo, sobre la barra)
 * Una sola línea de texto con la misión que sigues: qué hacer y dónde.
 *   ⚔ Goblins 2/5 · Bosque Sombrío   (+2)
 * Tocarla abre el menú de misiones. Se oculta en combate y si desactivas la
 * guía de misión. (Antes era una lista bajo el panel de vida, arriba.)
 */
import type { Game } from '@/game/game';
import { questGoalZone, zoneName } from '@/game/quests/guide';
import * as Quests from '@/game/quests/quests';
import { h } from './dom';

export class QuestTracker {
  readonly el: HTMLButtonElement;
  private sig = '';
  /** Activo (ajuste «Guía de misión»); si no, la línea se oculta. */
  enabled = true;

  constructor(
    private readonly onOpenQuest: (id: string | null) => void,
    _onTrackChanged: () => void,
  ) {
    void _onTrackChanged;
    this.el = h('button', { class: 'quest-line', attrs: { 'aria-label': 'Abrir las misiones' } });
    this.el.addEventListener('click', () => this.onOpenQuest(Quests.trackedQuestDef(this.lastState!)?.id ?? null));
  }

  private lastState: Game['state'] | null = null;

  update(game: Game): void {
    const s = game.state;
    this.lastState = s;
    const active = Quests.activeQuests(s);
    const tq = Quests.trackedQuest(s);
    const combat = game.inCombat;
    const goal = tq ? questGoalZone(s, tq.quest) : null;
    const sig = [this.enabled, combat, active.length, tq ? `${tq.quest.id}|${tq.short}|${tq.ready}` : '', goal ?? '', game.zone.id].join('#');
    if (sig === this.sig) return;
    this.sig = sig;
    if (!this.enabled || combat || !tq) {
      this.el.style.display = 'none';
      return;
    }
    this.el.style.display = '';
    const icon = tq.ready ? '💬' : Quests.OBJECTIVE_ICON[tq.quest.objectives.find((_, i) => {
      const p = Quests.objectiveProgress(s, tq.quest, i);
      return p.have < p.need;
    })?.type ?? 'visit'];
    const where = tq.ready ? '' : goal ? ` · ${game.zone.id === goal ? 'aquí' : zoneName(goal)}` : '';
    const more = active.length > 1 ? `  (+${active.length - 1})` : '';
    this.el.replaceChildren(
      h('span', { class: tq.ready ? 'ql-main ready' : 'ql-main', text: `${icon} ${tq.short}` }),
      h('span', { class: 'ql-zone', text: where }),
      h('span', { class: 'ql-more', text: more }),
    );
  }
}
