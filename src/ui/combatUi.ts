/**
 * INTERFAZ DEL COMBATE POR TURNOS
 *  - Barra de turnos (bajo el HUD): retratos en orden con el actor en curso
 *    resaltado y su vida en miniatura.
 *  - Cartel de acción centrado: qué ha hecho cada actor.
 *  - Menú de acciones en tu turno, en UNA sola línea: Atacar, Habilidad, Objeto,
 *    Defender, Huir y Terminar. Correr, Vincular y las órdenes a la mascota
 *    están dentro de «Habilidad» (junto a tus habilidades). Una pastilla
 *    flotante muestra el movimiento 👣 y si la acción está lista.
 *  - Botón grande «▶ Siguiente» en el modo paso a paso.
 */
import type { Actor, Game, TurnEntry } from '@/game/game';
import { itemDef } from '@/game/items/items';
import type { HumanoidColors } from '@/gfx/sprites';
import { actorSprite } from './actorSprite';
import { showDialog } from './dialogs';
import { h } from './dom';

export interface CombatActions {
  onAttack(): void;
  onToggleSkills(): void;
  onDefend(): void;
  onDash(): void;
  onWait(): void;
  onFlee(): void;
  onBind(): void;
  onPetOrders(): void;
  onContinue(): void;
  onSkipRound(): void;
}

export class CombatUi {
  readonly turnBar: HTMLDivElement;
  readonly caption: HTMLDivElement;
  readonly menu: HTMLDivElement;
  readonly nextBtn: HTMLButtonElement;
  /** «⏩ Saltar ronda»: aparece cuando hay 3+ actores por actuar. */
  readonly skipBtn: HTMLButtonElement;
  /** Habilidades desplegadas (la barra de habilidades se muestra). */
  skillsOpen = false;
  heroColors: HumanoidColors | null = null;
  private barSig = '';
  private menuSig = '';
  private captionTimer = 0;

  constructor(private readonly root: HTMLElement, private readonly actions: CombatActions) {
    this.turnBar = h('div', { class: 'turn-bar' });
    this.caption = h('div', { class: 'action-caption' });
    this.menu = h('div', { class: 'combat-menu' });
    this.nextBtn = h('button', { class: 'next-btn primary', text: '▶ Siguiente', onClick: () => actions.onContinue() });
    this.skipBtn = h('button', { class: 'skip-btn', text: '⏩ Saltar ronda', onClick: () => actions.onSkipRound(), attrs: { 'aria-label': 'Saltar el resto de la ronda' } });
    this.skipBtn.style.display = 'none';
  }

  /** Cartel con la acción de un actor. Se queda hasta la siguiente acción. */
  showAction(name: string, lines: string[], isFoe: boolean, holdMs: number): void {
    window.clearTimeout(this.captionTimer);
    const shown = lines.slice(-3);
    this.caption.replaceChildren(
      h('b', { class: isFoe ? 'foe' : 'friend', text: name }),
      ...(shown.length ? shown.map((l) => h('div', { text: l })) : [h('div', { class: 'muted', text: '…' })]),
    );
    this.caption.classList.add('show');
    this.captionTimer = window.setTimeout(() => this.caption.classList.remove('show'), holdMs);
  }

  hideAction(): void {
    window.clearTimeout(this.captionTimer);
    this.caption.classList.remove('show');
  }

  /** Abre la lista de objetos usables en combate. */
  openItems(game: Game, onError: (msg: string) => void): void {
    const p = game.state.player;
    const usable = p.inventory.filter((x) => {
      const u = itemDef(x).use;
      return !!u && !u.outOfCombatOnly;
    });
    if (!usable.length) {
      onError('No llevas objetos que se puedan usar en combate.');
      return;
    }
    showDialog(this.root, 'Objetos', 'Usar un objeto gasta tu acción de este turno.', [
      ...usable.map((it) => ({
        label: `${itemDef(it).name}${it.qty > 1 ? ` ×${it.qty}` : ''}`,
        action: () => {
          const err = game.useItem(it.uid);
          if (err) onError(err);
        },
      })),
      { label: 'Cancelar' },
    ]);
  }

  update(game: Game): void {
    const combat = game.inCombat && !game.isDead;
    // --- Barra de turnos
    const order = combat ? game.turnOrder() : [];
    const bsig = order.map((e) => `${e.actor.kind}${e.actor.uid ?? ''}:${e.hp}/${e.maxHp}:${e.current ? 1 : 0}`).join('|');
    if (bsig !== this.barSig) {
      this.barSig = bsig;
      this.turnBar.style.display = combat ? '' : 'none';
      this.turnBar.replaceChildren(...order.slice(0, 8).map((e) => this.turnCell(game, e)));
    }
    // --- Menú de acciones / Siguiente
    const myTurn = combat && game.canAct;
    // Tras la última acción el combate puede haber acabado: aún hay que pulsar «Siguiente».
    const waiting = (combat && game.phase === 'enemies') || game.awaitingContinue;
    const bindable = game.bindTargets().length > 0 && game.state.player.inventory.some((x) => x.id === 'runa_vinculo');
    const holding = game.holdT > 0;
    const msig = [myTurn, waiting, game.awaitingContinue, holding, game.canSkipRound, game.combatSpeed, game.attackMode, this.skillsOpen, bindable, !!game.petInstance, game.turnMove, game.turnMoveMax, game.actionUsed].join('|');
    if (msig === this.menuSig) return;
    this.menuSig = msig;
    if (!combat && !game.awaitingContinue) {
      this.skillsOpen = false;
      this.hideAction();
    }
    this.menu.style.display = myTurn ? '' : 'none';
    document.body.classList.toggle('combat-turn', myTurn);
    const waitLabel = game.combatSpeed === 'paso' && game.awaitingContinue ? '▶ Siguiente' : 'Turno de los demás…';
    this.nextBtn.style.display = waiting ? '' : 'none';
    this.nextBtn.textContent = holding && game.awaitingContinue ? '⏳ …' : waitLabel;
    this.nextBtn.disabled = !(game.combatSpeed === 'paso' && game.awaitingContinue) || holding;
    this.skipBtn.style.display = waiting && game.canSkipRound ? '' : 'none';
    this.nextBtn.classList.toggle('with-skip', waiting && game.canSkipRound);
    if (!myTurn) return;
    const used = game.actionUsed;
    if (used && this.skillsOpen) this.skillsOpen = false;
    const b = (ico: string, label: string, fn: () => void, extra = '', isAction = true) =>
      h('button', {
        class: `cbtn${extra}`, onClick: fn, disabled: isAction && used,
        attrs: { 'aria-label': label },
      }, [h('span', { class: 'ico', text: ico }), h('span', { class: 'lbl', text: label })]);
    // Nada útil que hacer: «Terminar turno» destacado.
    const done = used && (game.turnMove <= 0);
    const status = h('div', { class: 'turn-status' }, [
      h('span', { class: `moves${game.turnMove <= 0 ? ' empty' : ''}`, text: `👣 ${game.turnMove}/${game.turnMoveMax}` }),
      h('span', { class: `act${used ? ' used' : ''}`, text: used ? '⚔ ✕' : '⚔ ✓', attrs: { title: used ? 'Acción usada' : 'Acción lista' } }),
    ]);
    // Panel de UNA sola línea. Correr, Vincular y Órdenes viven en «Habilidad».
    this.menu.replaceChildren(
      status,
      h('div', { class: 'cm-row main' }, [
        b('⚔', 'Atacar', this.actions.onAttack, game.attackMode ? ' active' : ''),
        b('✨', 'Habilidad', this.actions.onToggleSkills, this.skillsOpen ? ' active' : ''),
        b('🧪', 'Objeto', () => this.onItems?.()),
        b('🛡', 'Defender', this.actions.onDefend),
        b('🏃', 'Huir', this.actions.onFlee),
        b('⏭', 'Terminar', this.actions.onWait, done || used ? ' end highlight' : ' end', false),
      ]),
    );
  }

  /** Lo fija la interfaz para abrir la lista de objetos. */
  onItems: (() => void) | null = null;

  private turnCell(game: Game, e: TurnEntry): HTMLElement {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    c.className = 'turn-icon';
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const img = this.spriteFor(game, e.actor);
    if (img) ctx.drawImage(img, 0, 0);
    const ratio = e.maxHp > 0 ? Math.max(0, e.hp) / e.maxHp : 0;
    const foe = e.actor.kind === 'enemy';
    return h('div', { class: `turn-cell${e.current ? ' current' : ''}${foe ? ' foe' : ''}`, attrs: { title: e.name } }, [
      c,
      h('div', { class: 'turn-hp' }, [h('i', { attrs: { style: `width:${Math.round(ratio * 100)}%` } })]),
    ]);
  }

  private spriteFor(game: Game, a: Actor): HTMLCanvasElement | null {
    return actorSprite(game, a, this.heroColors);
  }
}
