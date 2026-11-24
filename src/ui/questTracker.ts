/**
 * SEGUIMIENTO DE MISIONES (estilo WoW)
 * Solo texto, sin fondo, bajo el panel de vida. Una cosa debajo de otra:
 *   Misiones ▾
 *   ★ Sombras sobre Brumaroja
 *     ⚔ Goblins 2/5 · Bosque Sombrío
 * Plegado: solo la misión seguida y su objetivo actual. Desplegado: todas las
 * activas (hasta 4; el resto, «+N más», abre el diario).
 * Tocar el nombre de una misión la sigue; doble toque o mantener pulsado abre
 * su ficha en el diario. Se OCULTA del todo durante el combate.
 */
import { NPCS } from '@/data/registry';
import type { QuestDef } from '@/data/schema';
import type { Game } from '@/game/game';
import { questGoalZone, zoneName } from '@/game/quests/guide';
import * as Quests from '@/game/quests/quests';
import { h } from './dom';

const KEY = 'ecos.questTracker.open';
const MAX_VISIBLE = 4;

function loadOpen(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

function saveOpen(v: boolean): void {
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* sin almacenamiento */
  }
}

export class QuestTracker {
  readonly el: HTMLDivElement;
  private open = loadOpen();
  private sig = '';
  /** Activo (ajuste «Guía de misión»); si no, el seguimiento se oculta. */
  enabled = true;

  constructor(
    private readonly onOpenQuest: (id: string | null) => void,
    private readonly onTrackChanged: () => void,
  ) {
    this.el = h('div', { class: 'quest-tracker' });
  }

  update(game: Game): void {
    const s = game.state;
    const active = Quests.activeQuests(s);
    const tracked = Quests.trackedQuestDef(s);
    const combat = game.inCombat;
    const open = this.open && !combat;
    const sig = [
      this.enabled, open, combat, tracked?.id ?? '', game.zone.id,
      active.map((q) => `${q.id}:${q.objectives.map((_, i) => Quests.objectiveProgress(s, q, i).have).join(',')}:${Quests.isReady(s, q)}`).join('|'),
    ].join('#');
    if (sig === this.sig) return;
    this.sig = sig;
    if (!this.enabled || active.length === 0 || combat) {
      this.el.replaceChildren();
      this.el.style.display = 'none';
      return;
    }
    this.el.style.display = '';
    const head = h('button', { class: 'qt-head', text: `Misiones ${open ? '▾' : '▸'}`, attrs: { 'aria-label': open ? 'Plegar misiones' : 'Desplegar misiones' } });
    head.addEventListener('click', () => {
      this.open = !this.open;
      saveOpen(this.open);
      this.sig = '';
    });
    const list: QuestDef[] = open ? active : tracked ? [tracked] : active.slice(0, 1);
    const shown = list.slice(0, MAX_VISIBLE);
    const rows: HTMLElement[] = [head];
    for (const q of shown) rows.push(...this.questRows(game, q, q.id === tracked?.id, open));
    if (open && list.length > shown.length) {
      const more = h('button', { class: 'qt-more', text: `+${list.length - shown.length} más` });
      more.addEventListener('click', () => this.onOpenQuest(null));
      rows.push(more);
    }
    this.el.replaceChildren(...rows);
  }

  private questRows(game: Game, q: QuestDef, isTracked: boolean, open: boolean): HTMLElement[] {
    const s = game.state;
    const name = h('button', { class: `qt-name${isTracked ? ' tracked' : ''}`, text: `${isTracked ? '★ ' : ''}${q.name}` });
    // Toque = seguir; doble toque o pulsación larga = abrir la ficha.
    let last = 0;
    let pressTimer = 0;
    let longDone = false;
    name.addEventListener('pointerdown', () => {
      longDone = false;
      pressTimer = window.setTimeout(() => {
        longDone = true;
        this.onOpenQuest(q.id);
      }, 550);
    });
    const cancel = () => window.clearTimeout(pressTimer);
    name.addEventListener('pointerup', cancel);
    name.addEventListener('pointerleave', cancel);
    name.addEventListener('click', () => {
      if (longDone) return;
      const now = Date.now();
      if (now - last < 350) {
        this.onOpenQuest(q.id);
        return;
      }
      last = now;
      Quests.setTracked(s, q.id);
      this.sig = '';
      this.onTrackChanged();
    });
    const out: HTMLElement[] = [name];
    if (Quests.isReady(s, q)) {
      const who = NPCS.get(q.turnIn ?? q.giver)?.name ?? '';
      out.push(h('div', { class: 'qt-line ready', text: `💬 Entregar · ${who}` }));
      return out;
    }
    const goalZone = questGoalZone(s, q);
    const firstOpen = q.objectives.findIndex((_, i) => {
      const p = Quests.objectiveProgress(s, q, i);
      return p.have < p.need;
    });
    q.objectives.forEach((o, i) => {
      const p = Quests.objectiveProgress(s, q, i);
      const done = p.have >= p.need;
      // Plegado: solo el objetivo actual.
      if (!open && i !== firstOpen) return;
      const zone = i === firstOpen && goalZone ? ` · ${zoneName(goalZone)}` : '';
      out.push(h('div', { class: `qt-line${done ? ' done' : ''}` }, [
        `${done ? '✓' : Quests.OBJECTIVE_ICON[o.type]} ${Quests.shortObjective(s, q, i)}`,
        zone ? h('span', { class: 'qt-zone', text: zone }) : null,
      ]));
    });
    return out;
  }
}
