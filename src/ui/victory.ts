/** Pantalla final: epílogo y estadísticas de la partida. */
import { getClass } from '@/data/registry';
import type { GameState } from '@/game/state';
import { heroColors } from '@/gfx/look';
import { heroPortrait } from '@/gfx/world3d/studio';
import { h } from './dom';

export function formatPlayTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const hh = Math.floor(m / 60);
  return hh > 0 ? `${hh} h ${m % 60} min` : `${m} min`;
}

export function victoryScreen(state: GameState, onContinue: () => void, onMenu: () => void): HTMLElement {
  const p = state.player;
  const cls = getClass(p.classId);
  const r = state.record;
  const stat = (label: string, value: string) => h('div', { class: 'derived-item' }, [h('small', { text: label }), h('b', { text: value })]);
  return h('div', { class: 'screen victory' }, [
    heroPortrait(heroColors(cls.look, p.portrait), 'portrait-canvas', false, 'cheer'),
    h('h1', { text: '¡VICTORIA!' }),
    h('div', { class: 'subtitle', text: `${p.name}, ${cls.name.toLowerCase()} de nivel ${p.level}, ha derrotado a Velkar el Nigromante.` }),
    h('div', { class: 'panel epilogue' }, [
      h('p', { text: 'Las campanas de Brumaroja suenan por primera vez en años. La niebla roja se retira del valle y, en Puerto Ceniza, la Llama Blanca arde quieta y limpia.' }),
      h('p', { text: 'Pero el Abismo nunca duerme del todo. En las mazmorras aún se oyen pasos, y el tablón del gremio sigue lleno de encargos...' }),
    ]),
    h('div', { class: 'derived' }, [
      stat('Nivel', `${p.level}`),
      stat('Tiempo', formatPlayTime(r.victoryTime || state.playTimeSec)),
      stat('Turnos', `${r.victoryTurn || state.turn}`),
      stat('Enemigos', `${r.kills}`),
      stat('Jefes', `${r.bosses}`),
      stat('Caídas', `${r.deaths}`),
      stat('Oro', `${p.gold}`),
    ]),
    h('p', { class: 'muted', text: 'Puedes seguir jugando: misiones del gremio, mazmorras renovadas y hasta el nivel 20. O empieza otra historia con una clase distinta.' }),
    h('div', { class: 'menu-buttons' }, [
      h('button', { class: 'primary', text: 'Seguir jugando', onClick: onContinue }),
      h('button', { text: 'Volver al menú principal', onClick: onMenu }),
    ]),
  ]);
}
