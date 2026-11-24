/** Barra de habilidades (encima de los botones) + botón Huir durante el combate. */
import type { SkillDef } from '@/data/schema';
import type { Game } from '@/game/game';
import { unlockedSkills } from '@/game/rules/character';
import { STATUS_INFO } from '@/game/combat/status';
import { itemDef } from '@/game/items/items';
import { trackedQuest } from '@/game/quests/quests';
import { h } from './dom';

export class SkillBar {
  readonly el: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;
  private sig = '';
  /** Si la guía de misión está desactivada no se muestra la línea de objetivo. */
  questGuide = true;

  constructor(
    private readonly onSkill: (s: SkillDef) => void,
    private readonly onFlee: () => void,
    private readonly onPotion: () => void,
    private readonly onBind: () => void,
  ) {
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
    const potions = p.inventory.filter((x) => { const u = itemDef(x).use; return !!u?.heal && !u.outOfCombatOnly; }).reduce((a, x) => a + x.qty, 0);
    const tq = trackedQuest(game.state);
    const runes = p.inventory.filter((x) => x.id === 'runa_vinculo').reduce((a, x) => a + x.qty, 0);
    const bindable = runes > 0 ? game.bindTargets() : [];
    const bestBind = bindable.reduce((b, e) => Math.max(b, game.bindChance(e)), 0);
    const sig = [
      runes, bindable.length, Math.round(bestBind * 100),
      this.questGuide,
      tq ? `${tq.name}${tq.text}${game.zone.id}` : '',
      potions,
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
      ...(bindable.length ? [h('button', { class: 'skill bind', onClick: this.onBind, attrs: { 'aria-label': 'Vincular criatura' } }, [h('span', { class: 'ico', text: '🔮' }), h('small', { text: `${Math.round(bestBind * 100)}%` })])] : []),
      ...(potions > 0 ? [h('button', { class: 'skill potion', onClick: this.onPotion, attrs: { 'aria-label': 'Poción de curación' } }, [h('span', { class: 'ico', text: '🧪' }), h('small', { text: `×${potions}` })])] : []),
      ...(combat ? [h('button', { class: 'skill flee', onClick: this.onFlee, attrs: { 'aria-label': 'Huir' } }, [h('span', { class: 'ico', text: '🏃' }), h('small', { text: 'Huir' })])] : []),
    );

    const chips: HTMLElement[] = [];
    for (const s of c.statuses) chips.push(h('span', { class: 'chip', text: `${STATUS_INFO[s.id].icon} ${s.turns}`, attrs: { title: STATUS_INFO[s.id].name } }));
    for (const b of c.buffs) chips.push(h('span', { class: 'chip good', text: `▲${b.stat} +${b.amount} (${b.turns})` }));
    if (c.stealth > 0) chips.push(h('span', { class: 'chip good', text: `🌑 oculto ${c.stealth}` }));
    // (El objetivo de misión ya no va aquí: lo muestra el seguimiento de misiones.)
    void tq;
    this.statusEl.replaceChildren(...chips);
  }
}
