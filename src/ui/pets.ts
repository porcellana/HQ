/**
 * INTERFAZ DE MASCOTAS
 *  - Ficha de la mascota (sprite grande, tipo, nivel, estadísticas, movimientos,
 *    línea evolutiva con siluetas y mote editable) + bestiario.
 *  - Órdenes rápidas (al tocar su barra en el HUD o a ella en el mapa).
 *  - Establo: elegir la mascota inicial, dejar/recoger, curar y resumen del
 *    entrenamiento mientras no jugabas.
 *  - Elegir qué movimiento olvidar y pantalla de evolución animada.
 */
import { PET_SPECIES, PET_TYPE_MAP, QUESTS } from '@/data/registry';
import { zoneName } from '@/game/quests/guide';
import type { PetSpeciesDef } from '@/data/schema';
import type { Game } from '@/game/game';
import * as Pets from '@/game/pets/pets';
import { petSpriteCanvas } from '@/gfx/pets';
import { showDialog } from './dialogs';
import { h } from './dom';

const STAT_LABEL: Record<keyof import('@/data/schema').PetStats, string> = { hp: 'PV', atk: 'Ataque', def: 'Defensa', spd: 'Velocidad', mag: 'Magia' };

function typeBadge(sp: PetSpeciesDef): HTMLElement {
  const t = PET_TYPE_MAP.get(sp.type);
  return h('span', { class: 'pet-type', text: `${t?.icon ?? ''} ${t?.name ?? sp.type}`, attrs: { style: `border-color:${t?.color ?? '#888'};color:${t?.color ?? '#fff'}` } });
}

/** Dónde vive o cómo se consigue una especie (para el bestiario y la ficha). */
export function speciesOrigin(sp: PetSpeciesDef): string {
  const parts: string[] = [];
  if (sp.catchable && sp.habitats.length) parts.push(`Vive en: ${sp.habitats.map((z) => zoneName(z)).join(', ')}`);
  if (sp.starter) parts.push('Mascota inicial: pídesela a Tobías en Brumaroja');
  const rewards = [...QUESTS.values()].filter((q) => q.rewards.pet?.species === sp.id).map((q) => `«${q.name}»`);
  if (rewards.length) parts.push(`Recompensa de ${rewards.join(', ')}`);
  const from = [...PET_SPECIES.values()].find((x) => x.evolvesTo?.species === sp.id);
  if (from) parts.push(`Evoluciona de ${from.name} (nivel ${from.evolvesTo!.level})`);
  return parts.join(' · ') || 'Origen desconocido';
}

function moveRow(id: string, extra?: HTMLElement | null): HTMLElement {
  const m = Pets.getMove(id);
  if (!m) return h('div', { text: id });
  const t = PET_TYPE_MAP.get(m.type);
  return h('div', { class: 'pet-move' }, [
    h('span', { class: 'ico', text: m.icon }),
    h('div', {}, [
      h('b', { text: m.name }),
      h('small', { class: 'muted', text: ` · ${t?.icon ?? ''} ${t?.name ?? m.type}${m.range > 1 ? ` · alcance ${m.range}` : ''}${m.cooldown ? ` · recarga ${m.cooldown}` : ''}` }),
      h('p', { text: m.description }),
    ]),
    extra ?? null,
  ]);
}

// ------------------------------------------------------------------- ficha
export function petScreen(game: Game, onClose: () => void, onChanged: () => void): HTMLElement {
  const root = h('div', { class: 'screen pet-screen' });
  let tab: 'mascota' | 'bestiario' = 'mascota';
  const render = () => {
    const pets = game.state.pets;
    const pi = pets.active;
    const tabs = h('div', { class: 'tabs' }, [
      h('button', { class: tab === 'mascota' ? 'primary' : '', text: '🐾 Mascota', onClick: () => { tab = 'mascota'; render(); } }),
      h('button', { class: tab === 'bestiario' ? 'primary' : '', text: '📖 Bestiario', onClick: () => { tab = 'bestiario'; render(); } }),
    ]);
    const body: HTMLElement[] = [];
    if (tab === 'bestiario') body.push(bestiary(game));
    else if (!pi) {
      body.push(h('div', { class: 'panel' }, [
        h('p', { text: 'No llevas ninguna mascota.' }),
        h('p', { class: 'muted', text: pets.starterChosen
          ? 'Recoge una en el establo de Brumaroja o vincula una criatura salvaje con una Runa de vínculo (🔮).'
          : 'Visita al cuidador Tobías, junto al corral de Brumaroja: te dejará elegir tu primera mascota.' }),
      ]));
    } else {
      const sp = Pets.getSpecies(pi.species);
      const st = Pets.petStats(pi);
      const name = h('input', { class: 'pet-nick', attrs: { type: 'text', maxlength: '14', placeholder: sp.name, 'aria-label': 'Mote' } });
      name.value = pi.nickname ?? '';
      name.addEventListener('change', () => {
        pi.nickname = name.value.trim() || undefined;
        onChanged();
      });
      const need = Pets.petXpToNext(pi.level);
      const line = Pets.evolutionLine(pi.species);
      body.push(
        h('div', { class: 'panel pet-head' }, [
          h('div', { class: 'pet-big' }, [petSpriteCanvas(sp.look, sp.stage, 'pet-canvas')]),
          h('div', { class: 'pet-headinfo' }, [
            h('b', { class: 'pet-species', text: sp.name }),
            typeBadge(sp),
            h('small', { class: 'muted', text: `Nivel ${pi.level} · Vínculo ${Math.round(pi.bond)} %` }),
            h('div', { class: 'bar xp thin' }, [h('i', { attrs: { style: `width:${pi.level >= Pets.PET_MAX_LEVEL ? 100 : (100 * pi.xp) / need}%` } })]),
            h('small', { class: 'muted', text: `PV ${pi.down ? 0 : pi.hp}/${st.hp}${pi.down ? ' (debilitada)' : ''}` }),
            h('label', { class: 'muted' }, ['Mote: ', name]),
          ]),
        ]),
        h('p', { class: 'class-desc', text: sp.description }),
        h('p', { class: 'muted pet-origin', text: `📍 ${speciesOrigin(sp)}` }),
        h('div', { class: 'derived' }, (Object.keys(STAT_LABEL) as Array<keyof typeof STAT_LABEL>).map((k) =>
          h('div', { class: 'derived-item' }, [h('small', { text: STAT_LABEL[k] }), h('b', { text: `${st[k]}` })]))),
        h('div', { class: 'panel' }, [h('h3', { text: `Movimientos (${pi.moves.length}/${Pets.MAX_MOVES})` }), ...pi.moves.map((m) => moveRow(m))]),
        h('div', { class: 'panel' }, [
          h('h3', { text: 'Línea evolutiva' }),
          h('div', { class: 'evo-line' }, line.map((s, i) => {
            const known = pets.seen.includes(s.id) || pets.caught.includes(s.id) || s.id === pi.species;
            return h('div', { class: `evo-step${s.id === pi.species ? ' current' : ''}` }, [
              petSpriteCanvas(s.look, s.stage, 'evo-canvas', !known),
              h('small', { text: known ? s.name : '???' }),
              s.evolvesTo && i < line.length - 1 ? h('small', { class: 'muted', text: `Nv ${s.evolvesTo.level} →` }) : null,
            ]);
          })),
        ]),
      );
    }
    root.replaceChildren(
      h('h2', { text: 'Mascotas' }),
      tabs,
      ...body,
      h('div', { class: 'menu-buttons' }, [h('button', { class: 'primary', text: 'Cerrar', onClick: onClose })]),
    );
  };
  render();
  return root;
}

function bestiary(game: Game): HTMLElement {
  const pets = game.state.pets;
  const all = [...PET_SPECIES.values()];
  return h('div', { class: 'panel' }, [
    h('h3', { text: `Bestiario · vistas ${pets.seen.length}/${all.length} · vinculadas ${pets.caught.length}` }),
    h('div', { class: 'bestiary' }, all.map((s) => {
      const seen = pets.seen.includes(s.id);
      const caught = pets.caught.includes(s.id);
      const t = PET_TYPE_MAP.get(s.type);
      return h('div', { class: `best-card${caught ? ' caught' : ''}` }, [
        petSpriteCanvas(s.look, s.stage, 'evo-canvas', !seen),
        h('b', { text: seen ? s.name : '???' }),
        h('small', { class: 'muted', text: seen ? `${t?.icon ?? ''} ${t?.name ?? ''}${caught ? ' · ✔' : ''}` : '' }),
        h('small', { class: 'muted best-origin', text: seen ? speciesOrigin(s) : (s.catchable && s.habitats.length ? `Vive en: ${s.habitats.map((z) => zoneName(z)).join(', ')}` : '') }),
      ]);
    })),
  ]);
}

// ------------------------------------------------------------------ órdenes
export function petOrders(root: HTMLElement, game: Game, openSheet: () => void): void {
  const pi = game.petInstance;
  if (!pi) {
    showDialog(root, 'Sin mascota', 'No llevas ninguna mascota. Visita al cuidador junto al corral de Brumaroja.', [{ label: 'Vale' }]);
    return;
  }
  const name = Pets.petName(pi);
  const buttons = pi.moves.map((id) => {
    const m = Pets.getMove(id);
    return {
      label: `${m?.icon ?? ''} ${m?.name ?? id}${game.petOrder === id ? ' ✔' : ''}`,
      action: () => game.setPetOrder(id),
    };
  });
  showDialog(root, `Órdenes para ${name}`, pi.down ? `${name} está debilitada: se recuperará fuera de combate.` : 'Elige qué hará en su turno de la próxima batalla:', [
    ...buttons,
    { label: `🤖 Que decida ${name}${game.petOrder === null ? ' ✔' : ''}`, kind: 'primary', action: () => game.setPetOrder(null) },
    { label: '📋 Ver ficha de la mascota', action: openSheet },
    { label: 'Cerrar' },
  ]);
}

// --------------------------------------------------- movimiento nuevo / evolución
/** Pregunta qué movimiento olvidar para aprender el nuevo (uno cada vez). */
export function moveChoice(root: HTMLElement, game: Game, done: () => void): void {
  const pi = game.petInstance;
  const move = pi?.pendingMoves[0];
  if (!pi || !move) return done();
  const m = Pets.getMove(move);
  const name = Pets.petName(pi);
  showDialog(root, `${name} quiere aprender ${m?.name ?? move}`, h('div', {}, [
    moveRow(move),
    h('p', { text: `Ya conoce ${Pets.MAX_MOVES} movimientos. ¿Cuál olvida?` }),
  ]), [
    ...pi.moves.map((old) => ({
      label: `Olvidar ${Pets.getMove(old)?.icon ?? ''} ${Pets.getMove(old)?.name ?? old}`,
      action: () => {
        game.resolvePetMove(move, old);
        setTimeout(() => moveChoice(root, game, done), 50);
      },
    })),
    {
      label: `No aprender ${m?.name ?? move}`,
      kind: 'danger',
      action: () => {
        game.resolvePetMove(move, null);
        setTimeout(() => moveChoice(root, game, done), 50);
      },
    },
  ]);
}

/** Pantalla de evolución animada: destellos alternando los dos sprites. */
export function evolutionScreen(root: HTMLElement, game: Game, done: () => void): void {
  const pi = game.petInstance;
  if (!pi?.pendingEvolution) return done();
  const from = Pets.getSpecies(pi.species);
  const to = from.evolvesTo ? Pets.getSpecies(from.evolvesTo.species) : null;
  if (!to) {
    pi.pendingEvolution = false;
    return done();
  }
  const name = Pets.petName(pi);
  const a = petSpriteCanvas(from.look, from.stage, 'pet-canvas');
  const b = petSpriteCanvas(to.look, to.stage, 'pet-canvas', true);
  const stage = h('div', { class: 'evo-anim' }, [a, b]);
  const text = h('p', { class: 'evo-text', text: `¿Qué le pasa a ${name}?` });
  const stop = h('button', { class: 'danger', text: '✋ ¡Detener la evolución!' });
  const back = h('div', { class: 'modal-back evo-back' }, [h('div', { class: 'modal evo-modal' }, [h('h3', { text: '¡Evolución!' }), stage, text, stop])]);
  root.append(back);
  let t = 0;
  let stopped = false;
  b.style.opacity = '0';
  const timer = window.setInterval(() => {
    t++;
    // Parpadeo cada vez más rápido
    const on = Math.floor(t / Math.max(1, 6 - Math.floor(t / 6))) % 2 === 0;
    a.style.opacity = on ? '1' : '0';
    b.style.opacity = on ? '0' : '1';
    if (t === 10) text.textContent = `${name} brilla con fuerza...`;
    if (t >= 36) {
      window.clearInterval(timer);
      if (stopped) return;
      game.evolvePet();
      const nb = petSpriteCanvas(to.look, to.stage, 'pet-canvas');
      stage.replaceChildren(nb);
      text.textContent = `¡${from.name} ha evolucionado en ${to.name}!`;
      stop.className = 'primary';
      stop.textContent = '¡Genial!';
      stop.onclick = () => {
        back.remove();
        done();
      };
    }
  }, 90);
  stop.onclick = () => {
    stopped = true;
    window.clearInterval(timer);
    game.declinePetEvolution();
    back.remove();
    showDialog(root, 'Evolución detenida', `${name} se queda como está. Volverá a intentarlo cuando suba de nivel.`, [{ label: 'Vale', action: () => void done() }]);
  };
}

// ------------------------------------------------------------------- establo
export function stableScreen(game: Game, report: Pets.TrainingReport[], onClose: () => void, onChanged: () => void): HTMLElement {
  const root = h('div', { class: 'screen stable' });
  let note = report.length
    ? report.map((r) => `${r.name} ha subido ${r.levels} nivel${r.levels > 1 ? 'es' : ''} mientras no estabas.`).join(' ')
    : '';
  const render = () => {
    const pets = game.state.pets;
    const parts: Array<HTMLElement | null> = [h('h2', { text: 'Establo de Brumaroja' })];
    if (note) parts.push(h('div', { class: 'shop-note', text: note }));
    if (!pets.starterChosen) {
      const starters = [...PET_SPECIES.values()].filter((s) => s.starter);
      parts.push(
        h('p', { class: 'class-desc', text: 'Tobías te enseña tres crías inquietas: «Elige con el corazón. Crecerá contigo, aprenderá a luchar a tu lado y, con el tiempo, cambiará.»' }),
        h('div', { class: 'class-grid' }, starters.map((sp) =>
          h('button', {
            class: 'class-card',
            onClick: () => {
              const err = game.chooseStarter(sp.id);
              note = err ?? `¡${sp.name} se une a ti! Tócala en el mapa o en su barra para darle órdenes.`;
              onChanged();
              render();
            },
          }, [
            petSpriteCanvas(sp.look, sp.stage, 'class-sprite'),
            h('strong', { text: sp.name }),
            typeBadge(sp),
            h('small', { text: sp.description }),
          ]))),
      );
    } else {
      const pi = pets.active;
      parts.push(h('div', { class: 'panel' }, [
        h('h3', { text: 'Te acompaña' }),
        pi ? petCard(pi, [
          h('button', { text: 'Dejar en el establo', disabled: pets.stable.length >= Pets.STABLE_CAPACITY, onClick: () => { note = game.depositPet() ?? `${Pets.petName(pi)} se queda entrenando.`; onChanged(); render(); } }),
        ]) : h('p', { class: 'muted', text: 'Nadie. Elige una del establo.' }),
      ]));
      parts.push(h('div', { class: 'panel' }, [
        h('h3', { text: `En el establo (${pets.stable.length}/${Pets.STABLE_CAPACITY})` }),
        h('p', { class: 'muted', text: 'Las mascotas que se quedan siguen entrenando aunque no juegues (hasta tu nivel, con un tope diario).' }),
        ...(pets.stable.length ? pets.stable.map((p) => petCard(p, [
          h('button', { class: 'primary', text: pi ? 'Cambiar por la actual' : 'Llevar conmigo', onClick: () => { note = game.withdrawPet(p.uid) ?? `${Pets.petName(p)} vuelve a tu lado.`; onChanged(); render(); } }),
        ])) : [h('p', { class: 'muted', text: 'Vacío.' })]),
      ]));
      parts.push(h('button', { text: '💚 Curar a todas (gratis)', onClick: () => { game.healPet(); for (const p of pets.stable) { p.down = false; p.hp = Pets.petStats(p).hp; } note = 'Tobías cura a tus criaturas con hierbas y paciencia.'; onChanged(); render(); } }));
    }
    parts.push(h('div', { class: 'menu-buttons' }, [h('button', { class: 'primary', text: 'Salir del establo', onClick: onClose })]));
    root.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
  };
  render();
  return root;
}

function petCard(p: Pets.PetInstance, actions: HTMLElement[]): HTMLElement {
  const sp = Pets.getSpecies(p.species);
  const st = Pets.petStats(p);
  return h('div', { class: 'pet-card' }, [
    petSpriteCanvas(sp.look, sp.stage, 'evo-canvas'),
    h('div', { class: 'pet-card-info' }, [
      h('b', { text: `${Pets.petName(p)}${p.nickname ? ` (${sp.name})` : ''}` }),
      h('small', { class: 'muted', text: `Nv ${p.level} · PV ${p.down ? 0 : p.hp}/${st.hp} · ${p.moves.length} movimientos` }),
      typeBadge(sp),
    ]),
    h('div', { class: 'pet-card-actions' }, actions),
  ]);
}
