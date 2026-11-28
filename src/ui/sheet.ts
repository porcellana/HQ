/** Ficha de personaje: características, valores derivados, rasgos y habilidades. */
import { getBackground, getClass } from '@/data/registry';
import type { SkillKey } from '@/data/schema';
import { SKILLS, isProficient, skillBonus } from '@/game/rules/skills';
import { ownedTalents } from '@/game/talents';
import { ABILITY_KEYS } from '@/data/schema';
import { abilityModifier } from '@/game/rules/dice';
import { STAT_HINTS, STAT_MAX, STAT_NAMES, formatMod, proficiencyBonus } from '@/game/rules/character';
import { derive } from '@/game/rules/derived';
import { levelProgress } from '@/game/rules/progression';
import { recalcPlayer, type PlayerState } from '@/game/state';
import { heroColors } from '@/gfx/look';
import { heroPortrait } from '@/gfx/world3d/studio';
import { skillList } from './creation';
import { h } from './dom';

export function characterSheet(p: PlayerState, onClose: () => void, onChanged: () => void, onTalents?: () => void, onPets?: () => void): HTMLElement {
  const root = h('div', { class: 'screen sheet' });
  const render = () => {
    const cls = getClass(p.classId);
    const prog = levelProgress(p.xp);
    const d = derive(p);
    root.replaceChildren(
      h('div', { class: 'sheet-head' }, [
        heroPortrait(heroColors(cls.look, p.portrait), 'portrait-canvas'),
        h('div', {}, [
          h('h2', { text: p.name }),
          h('div', { class: 'subtitle', text: `${cls.name} de nivel ${p.level}` }),
          h('small', { class: 'muted', text: prog.needed ? `XP ${prog.current} / ${prog.needed} para el nivel ${p.level + 1}` : 'Nivel máximo' }),
        ]),
      ]),
      h('div', { class: 'derived' }, [
        item('PV', `${p.hp}/${p.maxHp}`),
        item(cls.resource.short, `${p.mp}/${p.maxMp}`),
        item('CA', `${d.ac}`),
        item('Ataque', `${formatMod(d.toHit)}`),
        item('Daño', `${d.weapon.dice}${formatMod(d.damageMod)}`),
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
              h('span', { class: 'stat-val', text: `${d.stats[k]}`, attrs: d.stats[k] !== p.stats[k] ? { title: `Base ${p.stats[k]} + equipo` } : {} }),
              h('span', { class: 'stat-mod', text: formatMod(abilityModifier(d.stats[k])) }),
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
        h('h3', { text: `Arma: ${d.weapon.name} (${d.weapon.dice} ${d.weapon.damageType}${d.weapon.range > 1 ? `, alcance ${d.weapon.range}` : ''})` }),
        h('h3', { text: 'Rasgos' }),
        h('ul', { class: 'traits' }, cls.traits.map((t) => h('li', { text: t }))),
      ]),
      identityPanel(p, onTalents),
      h('div', { class: 'panel' }, [
        h('h3', { text: 'Habilidades' }),
        skillList(cls, p.level),
      ]),
      h('div', { class: 'menu-buttons' }, [
        onPets ? h('button', { text: '🐾 Mascotas y bestiario', onClick: onPets }) : null,
        h('button', { class: 'primary', text: 'Cerrar', onClick: onClose }),
      ]),
    );
  };
  render();
  return root;
}

function item(label: string, value: string): HTMLElement {
  return h('div', { class: 'derived-item' }, [h('small', { text: label }), h('b', { text: value })]);
}

/** Trasfondo, talentos y habilidades sociales. */
function identityPanel(p: PlayerState, onTalents?: () => void): HTMLElement {
  const bg = getBackground(p.background);
  const talents = ownedTalents(p);
  const pending = p.talentChoices ?? 0;
  return h('div', { class: 'panel' }, [
    h('h3', { text: `Trasfondo: ${bg ? `${bg.icon} ${bg.name}` : '—'}` }),
    bg ? h('p', { class: 'bg-feature', text: `✦ ${bg.feature}` }) : null,
    h('h3', { text: 'Talentos' }),
    pending > 0 && onTalents ? h('button', { class: 'primary', text: `✦ Tienes ${pending} talento${pending > 1 ? 's' : ''} por elegir`, onClick: onTalents }) : null,
    ...(talents.length
      ? talents.map((t) => h('div', { class: 'talent-owned' }, [h('span', { class: 'ico', text: t.icon }), h('div', {}, [h('b', { text: `${t.name} ` }), h('small', { class: 'muted', text: t.branch }), h('div', { text: t.description })])]))
      : [h('small', { class: 'muted', text: 'Aún no tienes talentos. Ganarás uno cada vez que subas de nivel.' })]),
    h('h3', { text: 'Habilidades sociales' }),
    h('div', { class: 'skill-rows' }, (Object.keys(SKILLS) as SkillKey[]).map((k) =>
      h('span', { class: isProficient(p, k) ? 'prof' : '', text: `${SKILLS[k].name} ${formatMod(skillBonus(p, k))}${isProficient(p, k) ? ' ★' : ''}` }),
    )),
  ]);
}
