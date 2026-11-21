/**
 * PANTALLA DE CREACIÓN DE PERSONAJE
 * Paso 1: elegir clase. Paso 2: nombre, aspecto, repartir puntos y ver habilidades.
 */
import { classList } from '@/data/registry';
import { RANDOM_NAMES } from '@/data/config/names';
import { ABILITY_KEYS, type AbilityKey, type ClassDef, type StatBlock } from '@/data/schema';
import { abilityModifier } from '@/game/rules/dice';
import {
  CREATION_POINTS,
  CREATION_STAT_MAX,
  STAT_HINTS,
  STAT_NAMES,
  formatMod,
} from '@/game/rules/character';
import { createNewGame } from '@/game/state';
import { derive } from '@/game/rules/derived';
import { PORTRAIT_COUNT, heroColors, spriteCanvas } from '@/gfx/sprites';
import { h } from './dom';

export interface CreationResult {
  name: string;
  classId: string;
  portrait: number;
  stats: StatBlock;
}

export function creationScreen(onDone: (r: CreationResult) => void, onCancel: () => void): HTMLElement {
  const root = h('div', { class: 'screen creation' });
  const pickClass = () => {
    root.replaceChildren(
      h('h2', { text: 'Elige tu camino' }),
      h('div', { class: 'subtitle', text: 'Cada clase juega de forma distinta' }),
      h(
        'div',
        { class: 'class-grid' },
        classList().map((cls) =>
          h('button', { class: 'class-card', onClick: () => customize(cls) }, [
            spriteCanvas(heroColors(cls.look, 1), 'class-sprite'),
            h('strong', { text: cls.name }),
            h('em', { text: cls.role }),
            h('small', { text: cls.description }),
          ]),
        ),
      ),
      h('button', { text: 'Volver', onClick: onCancel }),
    );
    root.scrollTop = 0;
  };

  const customize = (cls: ClassDef) => {
    let portrait = 1;
    const spent: StatBlock = { FUE: 0, DES: 0, CON: 0, INT: 0, SAB: 0, CAR: 0 };
    const stats = (): StatBlock => {
      const s = { ...cls.baseStats };
      for (const k of ABILITY_KEYS) s[k] += spent[k];
      return s;
    };
    const left = () => CREATION_POINTS - ABILITY_KEYS.reduce((a, k) => a + spent[k], 0);

    const nameInput = h('input', { attrs: { type: 'text', maxlength: '16', placeholder: 'Nombre', 'aria-label': 'Nombre' } });
    nameInput.value = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)] ?? 'Aventurero';
    const portraitBox = h('div', { class: 'portrait-big' });
    const drawPortrait = () => portraitBox.replaceChildren(spriteCanvas(heroColors(cls.look, portrait), 'portrait-canvas'));
    const pointsEl = h('div', { class: 'points-left' });
    const statsBox = h('div', { class: 'stat-list' });
    const derivedBox = h('div', { class: 'derived' });

    const refresh = () => {
      const s = stats();
      pointsEl.textContent = left() > 0 ? `Puntos por repartir: ${left()}` : 'Todos los puntos repartidos';
      pointsEl.classList.toggle('done', left() === 0);
      statsBox.replaceChildren(
        ...ABILITY_KEYS.map((k: AbilityKey) => {
          const minus = h('button', { class: 'mini', text: '−', disabled: spent[k] <= 0, onClick: () => { spent[k]--; refresh(); } });
          const plus = h('button', {
            class: 'mini', text: '+', disabled: left() <= 0 || s[k] >= CREATION_STAT_MAX,
            onClick: () => { spent[k]++; refresh(); },
          });
          return h('div', { class: `stat-row${cls.primary.includes(k) ? ' primary' : ''}` }, [
            h('div', { class: 'stat-name' }, [h('b', { text: k }), h('small', { text: `${STAT_NAMES[k]} · ${STAT_HINTS[k]}` })]),
            minus,
            h('span', { class: 'stat-val', text: `${s[k]}` }),
            h('span', { class: 'stat-mod', text: formatMod(abilityModifier(s[k])) }),
            plus,
          ]);
        }),
      );
      derivedBox.replaceChildren(
        // Vista previa con el equipo inicial real de la clase
        ...(() => {
          const pv = createNewGame({ name: 'x', classId: cls.id, portrait: 0, seed: 1, stats: s }).player;
          const d = derive(pv);
          return [
            derived('PV', `${pv.maxHp}`),
            derived(cls.resource.short, `${pv.maxMp}`),
            derived('CA', `${d.ac}`),
            derived('Ataque', `${formatMod(d.toHit)} · ${d.weapon.dice}`),
          ];
        })(),
      );
    };

    drawPortrait();
    refresh();
    root.replaceChildren(
      h('h2', { text: cls.name }),
      h('div', { class: 'subtitle', text: cls.role }),
      h('div', { class: 'portrait-row' }, [
        h('button', { class: 'mini big', text: '◀', attrs: { 'aria-label': 'Aspecto anterior' }, onClick: () => { portrait = (portrait - 1 + PORTRAIT_COUNT) % PORTRAIT_COUNT; drawPortrait(); } }),
        portraitBox,
        h('button', { class: 'mini big', text: '▶', attrs: { 'aria-label': 'Aspecto siguiente' }, onClick: () => { portrait = (portrait + 1) % PORTRAIT_COUNT; drawPortrait(); } }),
      ]),
      h('div', { class: 'name-row' }, [
        nameInput,
        h('button', { class: 'mini big', text: '🎲', attrs: { 'aria-label': 'Nombre aleatorio' }, onClick: () => { nameInput.value = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)] ?? ''; } }),
      ]),
      h('p', { class: 'class-desc', text: cls.description }),
      derivedBox,
      h('div', { class: 'panel' }, [h('h3', { text: 'Características' }), pointsEl, statsBox]),
      h('div', { class: 'panel' }, [
        h('h3', { text: 'Rasgos' }),
        h('ul', { class: 'traits' }, cls.traits.map((t) => h('li', { text: t }))),
        h('h3', { text: 'Habilidades' }),
        skillList(cls, 1),
      ]),
      h('div', { class: 'menu-buttons' }, [
        h('button', {
          class: 'primary', text: 'Comenzar aventura',
          onClick: () => {
            const name = nameInput.value.trim() || 'Aventurero';
            onDone({ name, classId: cls.id, portrait, stats: stats() });
          },
        }),
        h('button', { text: '◀ Otra clase', onClick: pickClass }),
      ]),
    );
    root.scrollTop = 0;
  };

  pickClass();
  return root;
}

function derived(label: string, value: string): HTMLElement {
  return h('div', { class: 'derived-item' }, [h('small', { text: label }), h('b', { text: value })]);
}

/** Lista de habilidades de una clase marcando las bloqueadas por nivel. */
export function skillList(cls: ClassDef, level: number): HTMLElement {
  return h(
    'ul',
    { class: 'skills' },
    cls.skills.map((sk) =>
      h('li', { class: sk.unlockLevel <= level ? 'unlocked' : 'locked' }, [
        h('span', { class: 'skill-icon', text: sk.unlockLevel <= level ? sk.icon : '🔒' }),
        h('div', {}, [
          h('b', { text: sk.name }),
          h('small', { text: ` · Nv ${sk.unlockLevel} · ${sk.cost} ${cls.resource.short}` }),
          h('p', { text: sk.description }),
        ]),
      ]),
    ),
  );
}
