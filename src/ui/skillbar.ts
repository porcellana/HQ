/** Barra de habilidades (encima de los botones) + botón Huir durante el combate. */
import type { SkillDef } from '@/data/schema';
import type { Game } from '@/game/game';
import { unlockedSkills } from '@/game/rules/character';
import { STATUS_INFO } from '@/game/combat/status';
import { h } from './dom';

export class SkillBar {
  readonly el: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;
  private sig = '';

  constructor(private readonly onSkill: (s: SkillDef) => void, private readonly onFlee: () => void) {
    this.statusEl = h('div', { class: 'status-row' });
    this.el = h('div', { class: 'skill-bar' });
  }

  get statusRow(): HTMLDivElement {
    return this.statusEl;
  }

  update(game: Game): void {
    const p = game.state.player;
    const cls = game.cls;
    const skills = unlockedSkills(cls, p.level);
    const combat = game.inCombat;
    const c = game.combat;
    const sig = [
      skills.map((s) => s.id).join(','), p.mp, JSON.stringify(c.cooldowns), game.targeting?.id ?? '', combat, game.canAct,
      c.statuses.map((s) => `${s.id}${s.turns}`).join(), c.buffs.map((b) => `${b.stat}${b.amount}${b.turns}`).join(), c.stealth,
    ].join('|');
    if (sig === this.sig) return;
    this.sig = sig;

    this.el.replaceChildren(
      ...skills.map((sk) => {
        const cd = c.cooldowns[sk.id] ?? 0;
        const blocked = cd > 0 || p.mp < sk.cost;
        const b = h('button', {
          class: `skill${game.targeting?.id === sk.id ? ' selected' : ''}${blocked ? ' blocked' : ''}`,
          attrs: { 'aria-label': sk.name, title: `${sk.name}: ${sk.description}` },
          onClick: () => this.onSkill(sk),
        }, [
          h('span', { class: 'ico', text: sk.icon }),
          h('small', { text: cd > 0 ? `⏳${cd}` : `${sk.cost}` }),
        ]);
        return b;
      }),
      ...(combat ? [h('button', { class: 'skill flee', onClick: this.onFlee, attrs: { 'aria-label': 'Huir' } }, [h('span', { class: 'ico', text: '🏃' }), h('small', { text: 'Huir' })])] : []),
    );

    const chips: HTMLElement[] = [];
    for (const s of c.statuses) chips.push(h('span', { class: 'chip', text: `${STATUS_INFO[s.id].icon} ${s.turns}`, attrs: { title: STATUS_INFO[s.id].name } }));
    for (const b of c.buffs) chips.push(h('span', { class: 'chip good', text: `▲${b.stat} +${b.amount} (${b.turns})` }));
    if (c.stealth > 0) chips.push(h('span', { class: 'chip good', text: `🌑 oculto ${c.stealth}` }));
    if (combat) chips.push(h('span', { class: 'chip warn', text: '⚔ En combate' }));
    this.statusEl.replaceChildren(...chips);
  }
}
