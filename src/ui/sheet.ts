/** Ficha de personaje: características, valores derivados, rasgos y habilidades. */
import { getClass } from '@/data/registry';
import { ABILITY_KEYS } from '@/data/schema';
import { abilityModifier } from '@/game/rules/dice';
import { STAT_HINTS, STAT_MAX, STAT_NAMES, armorClass, attackBonus, formatMod, proficiencyBonus } from '@/game/rules/character';
import { levelProgress } from '@/game/rules/progression';
import { recalcPlayer, type PlayerState } from '@/game/state';
import { heroColors, spriteCanvas } from '@/gfx/sprites';
import { skillList } from './creation';
import { h } from './dom';

export function characterSheet(p: PlayerState, onClose: () => void, onChanged: () => void): HTMLElement {
  const root = h('div', { class: 'screen sheet' });
  const render = () => {
    const cls = getClass(p.classId);
    const prog = levelProgress(p.xp);
    root.replaceChildren(
      h('div', { class: 'sheet-head' }, [
        spriteCanvas(heroColors(cls.look, p.portrait), 'portrait-canvas'),
        h('div', {}, [
          h('h2', { text: p.name }),
          h('div', { class: 'subtitle', text: `${cls.name} de nivel ${p.level}` }),
          h('small', { class: 'muted', text: prog.needed ? `XP ${prog.current} / ${prog.needed} para el nivel ${p.level + 1}` : 'Nivel máximo' }),
        ]),
      ]),
      h('div', { class: 'derived' }, [
        item('PV', `${p.hp}/${p.maxHp}`),
        item(cls.resource.short, `${p.mp}/${p.maxMp}`),
        item('CA', `${armorClass(cls, p.stats)}`),
        item('Ataque', `${formatMod(attackBonus(cls, p.stats, p.level))}`),
        item('Daño', `${cls.weapon.dice}${formatMod(abilityModifier(p.stats[cls.weapon.stat]))}`),
        item('Compet.', formatMod(proficiencyBonus(p.level))),
      ]),
      h('div', { class: 'panel' }, [
        h('h3', { text: 'Características' }),
        p.attributePoints > 0 ? h('div', { class: 'points-left', text: `Puntos por repartir: ${p.attributePoints}` }) : null,
        h(
          'div',
          { class: 'stat-list' },
          ABILITY_KEYS.map((k) =>
            h('div', { class: `stat-row${cls.primary.includes(k) ? ' primary' : ''}` }, [
              h('div', { class: 'stat-name' }, [h('b', { text: k }), h('small', { text: `${STAT_NAMES[k]} · ${STAT_HINTS[k]}` })]),
              h('span', { class: 'stat-val', text: `${p.stats[k]}` }),
              h('span', { class: 'stat-mod', text: formatMod(abilityModifier(p.stats[k])) }),
              p.attributePoints > 0
                ? h('button', {
                    class: 'mini', text: '+', disabled: p.stats[k] >= STAT_MAX,
                    onClick: () => {
                      p.stats[k]++;
                      p.attributePoints--;
                      const hpBefore = p.maxHp;
                      recalcPlayer(p);
                      p.hp += Math.max(0, p.maxHp - hpBefore);
                      onChanged();
                      render();
                    },
                  })
                : null,
            ]),
          ),
        ),
      ]),
      h('div', { class: 'panel' }, [
        h('h3', { text: `Arma: ${cls.weapon.name}` }),
        h('h3', { text: 'Rasgos' }),
        h('ul', { class: 'traits' }, cls.traits.map((t) => h('li', { text: t }))),
        h('h3', { text: 'Habilidades' }),
        skillList(cls, p.level),
      ]),
      h('div', { class: 'menu-buttons' }, [h('button', { class: 'primary', text: 'Cerrar', onClick: onClose })]),
    );
  };
  render();
  return root;
}

function item(label: string, value: string): HTMLElement {
  return h('div', { class: 'derived-item' }, [h('small', { text: label }), h('b', { text: value })]);
}
