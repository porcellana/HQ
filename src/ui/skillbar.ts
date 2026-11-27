/**
 * DESPLEGABLE DE HABILIDADES DEL MAPA (pegado encima de la barra inferior).
 * Fuera de batalla sólo sirven las curativas y la poción rápida; el resto
 * se usa en la escena de batalla.
 */
import type { SkillDef } from '@/data/schema';
import type { Game } from '@/game/game';
import { unlockedSkills } from '@/game/rules/character';
import { itemDef } from '@/game/items/items';
import { h } from './dom';

export class SkillBar {
  readonly el: HTMLDivElement;
  private sig = '';
  /** Si la guía de misión está desactivada no se muestra la línea de objetivo. */
  questGuide = true;

  constructor(
    private readonly onSkill: (s: SkillDef) => void,
    private readonly onPotion: () => void,
  ) {
    this.el = h('div', { class: 'skill-bar' });
  }

  update(game: Game): void {
    const p = game.state.player;
    const skills = unlockedSkills(game.cls, p.level);
    const potions = p.inventory.filter((x) => { const u = itemDef(x).use; return !!u?.heal && !u.outOfCombatOnly; }).reduce((a, x) => a + x.qty, 0);
    const sig = [potions, skills.map((s) => s.id).join(','), p.mp, p.hp].join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    const item = (cls: string, ico: string, name: string, badge: string, onClick: () => void, title: string) =>
      h('button', { class: `dr-item ${cls}`, onClick, attrs: { 'aria-label': name, title } }, [
        h('span', { class: 'ico', text: ico }), h('span', { class: 'nm', text: name }), badge ? h('span', { class: 'bd', text: badge }) : null,
      ]);
    this.el.replaceChildren(
      ...skills.map((sk) => {
        const heal = sk.effects.some((e) => e.type === 'heal');
        const blocked = !heal || p.mp < sk.cost;
        return item(blocked ? 'blocked' : '', sk.icon, sk.name, heal ? `${sk.cost}` : 'batalla', () => this.onSkill(sk), sk.description);
      }),
      ...(potions > 0 ? [item('potion', '🧪', 'Poción', `×${potions}`, this.onPotion, 'Beber una poción de curación')] : []),
    );
  }
}
