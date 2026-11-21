/**
 * ELEGIR TALENTO: al subir de nivel se ofrecen 3 talentos de tu clase (de
 * ramas distintas si es posible). Puedes decidir más tarde desde la Ficha.
 */
import type { Game } from '@/game/game';
import { recalcPlayer } from '@/game/state';
import { chooseTalent, ownedTalents, talentOffer } from '@/game/talents';
import { h } from './dom';

export function talentPicker(game: Game, onClose: () => void): HTMLElement {
  const root = h('div', { class: 'screen talents' });
  const render = () => {
    const p = game.state.player;
    const pending = p.talentChoices ?? 0;
    if (pending <= 0) return onClose();
    const offer = talentOffer(p, game.state.seed);
    const owned = ownedTalents(p);
    root.replaceChildren(
      h('h2', { text: 'Elige un talento' }),
      h('div', { class: 'subtitle', text: pending > 1 ? `Tienes ${pending} talentos por elegir` : 'Define qué clase de héroe eres' }),
      h('div', { class: 'talent-list' }, offer.length
        ? offer.map((t) =>
            h('button', {
              class: 'talent-card',
              onClick: () => {
                const err = chooseTalent(p, t.id);
                if (err) return;
                recalcPlayer(p);
                game.events.emit('message', { text: `Talento aprendido: ${t.icon} ${t.name}.`, kind: 'good' });
                render();
              },
            }, [
              h('div', { class: 'talent-head' }, [h('span', { class: 'ico', text: t.icon }), h('b', { text: t.name })]),
              h('small', { class: 'branch', text: t.branch }),
              h('p', { text: t.description }),
            ]))
        : [h('p', { class: 'muted', text: 'No quedan talentos disponibles a tu nivel.' })]),
      owned.length ? h('div', { class: 'panel' }, [
        h('h3', { text: 'Ya tienes' }),
        h('div', { class: 'owned-talents', text: owned.map((t) => `${t.icon} ${t.name}`).join(' · ') }),
      ]) : h('span'),
      h('div', { class: 'menu-buttons' }, [h('button', { text: 'Decidir más tarde', onClick: onClose })]),
    );
    root.scrollTop = 0;
  };
  render();
  return root;
}
