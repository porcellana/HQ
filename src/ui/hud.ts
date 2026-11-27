/**
 * HUD en DOM superpuesto al canvas: vida, maná, XP, nivel, oro, minimapa,
 * registro de mensajes y barra de acciones con botones grandes.
 */
import type { Game } from '@/game/game';
import { levelProgress } from '@/game/rules/progression';
import type { Settings } from '@/game/settings';
import { humanoidSprite, type HumanoidColors } from '@/gfx/sprites';
import { h } from './dom';
import * as Pets from '@/game/pets/pets';
import { petName } from '@/game/pets/pets';
import type { SkillDef } from '@/data/schema';
import { DiceRoller } from './dice';
import { Joystick } from './joystick';
import { Minimap } from './minimap';
import { SkillBar } from './skillbar';
import * as Quests from '@/game/quests/quests';
import { QuestTracker } from './questTracker';
import { ZoomControls } from './zoomControls';

export interface HudActions {
  onWait(): void;
  onSheet(): void;
  /** Diario de misiones (botón directo en la barra). */
  onJournal(): void;
  /** Ajustes (botón ⚙ directo en la barra). */
  onSettings(): void;
  onInventory(): void;
  onJoystick(dir: { dx: number; dy: number } | null): void;
  onSkill(skill: SkillDef): void;
  onMinimapTap(x: number, y: number): void;
  onPotion(): void;
  onPetOrders(): void;
  onOpenQuest(id: string | null): void;
  /** Zoom del mapa: +1 acercar, −1 alejar, 0 restablecer. */
  onZoom(dir: -1 | 0 | 1): void;
}

function bar(kind: string, thin = false): { el: HTMLDivElement; fill: HTMLElement; label: HTMLElement } {
  const fill = h('i');
  const label = h('em');
  const el = h('div', { class: `bar ${kind}${thin ? ' thin' : ''}` }, [fill, thin ? null : label]);
  return { el, fill, label };
}

export class Hud {
  readonly root: HTMLDivElement;
  private readonly minimap = new Minimap();
  private readonly joystick: Joystick;
  private readonly portrait: HTMLCanvasElement;
  private readonly nameEl: HTMLElement;
  private readonly goldEl: HTMLElement;
  private readonly hp = bar('hp');
  private readonly mp = bar('mp');
  private readonly xp = bar('xp', true);
  private readonly banner: HTMLDivElement;
  private readonly log: HTMLDivElement;
  private readonly actionBar: HTMLDivElement;
  readonly skillBar: SkillBar;
  readonly dice = new DiceRoller();
  readonly zoom: ZoomControls;
  /** Desplegable de habilidades abierto. */
  skillsOpen = false;
  private bannerTimer = 0;
  private resourceShort = 'PM';
  /** Última firma de datos mostrada, para no tocar el DOM si no cambia nada. */
  private lastSig = '';
  /** Mini barra del compañero. */
  private readonly allyEl: HTMLDivElement;
  private allySig = '';
  private readonly petEl: HTMLDivElement;
  private petSig = '';
  private layoutTick = 0;
  readonly tracker: QuestTracker;
  /** Columna izquierda bajo el panel. */
  private readonly leftCol: HTMLDivElement;
  /** Botón ✨ de la barra de exploración (abre el desplegable de habilidades). */
  private readonly drawerBtn: HTMLButtonElement;
  /** Botón 📖 de la barra: se marca con ❗ cuando hay una misión lista para entregar. */
  private readonly questsBtn: HTMLButtonElement;

  constructor(actions: HudActions) {
    this.portrait = h('canvas', { class: 'hud-portrait' });
    this.portrait.width = 16;
    this.portrait.height = 16;
    this.portrait.addEventListener('click', () => actions.onSheet());
    this.nameEl = h('b');
    this.goldEl = h('span', { class: 'hud-gold' });
    this.allyEl = h('div', { class: 'hud-ally' });
    this.petEl = h('div', { class: 'hud-ally hud-pet', attrs: { role: 'button', 'aria-label': 'Órdenes de la mascota' } });
    this.petEl.addEventListener('click', () => actions.onPetOrders());
    const panel = h('div', { class: 'hud-panel' }, [
      this.portrait,
      h('div', { class: 'hud-name' }, [this.nameEl, this.goldEl]),
      this.hp.el,
      this.mp.el,
      this.xp.el,
      this.allyEl,
      this.petEl,
    ]);
    this.banner = h('div', { class: 'zone-banner' });
    this.log = h('div', { class: 'log' });
    this.joystick = new Joystick(actions.onJoystick);

    const btn = (ico: string, label: string, fn: () => void) =>
      h('button', { onClick: fn, attrs: { 'aria-label': label } }, [h('span', { class: 'ico', text: ico }), h('span', { text: label })]);
    // Barra inferior de exploración (una sola línea): accesos directos a todo.
    this.drawerBtn = btn('✨', 'Habilidad', () => {
      this.skillsOpen = !this.skillsOpen;
    });
    this.questsBtn = btn('📖', 'Misiones', actions.onJournal);
    this.actionBar = h('div', { class: 'action-bar' }, [
      btn('⏳', 'Esperar', actions.onWait),
      this.drawerBtn,
      btn('🎒', 'Mochila', actions.onInventory),
      btn('📜', 'Ficha', actions.onSheet),
      this.questsBtn,
      btn('⚙', 'Ajustes', actions.onSettings),
    ]);

    // El desplegable de habilidades se cierra al elegir cualquier opción.
    const closing = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A): void => {
      this.skillsOpen = false;
      fn(...a);
    };
    this.skillBar = new SkillBar(closing(actions.onSkill), closing(actions.onPotion));
    this.zoom = new ZoomControls(actions.onZoom);
    this.minimap.onTapTile = actions.onMinimapTap;
    this.tracker = new QuestTracker(actions.onOpenQuest, () => void 0);
    this.leftCol = h('div', { class: 'hud-left' }, []);
    this.root = h('div', { class: 'hud passthrough' }, [
      h('div', { class: 'hud-top' }, [panel, this.minimap.el]),
      this.leftCol,
      this.banner,
      this.log,
      this.dice.el,
      this.zoom.el,
      this.joystick.el,
      this.tracker.el,
      this.skillBar.el,
      this.actionBar,
    ]);
  }

  /** Enlaza la partida. */
  setGame(_game: Game): void {
    /* (reservado) */
  }

  applySettings(s: Settings): void {
    this.joystick.el.style.display = s.joystick ? '' : 'none';
    this.joystick.setSide(s.hand);
    this.actionBar.classList.toggle('izquierda', s.hand === 'izquierda');
    this.skillBar.el.classList.toggle('izquierda', s.hand === 'izquierda');
    this.skillBar.questGuide = s.questGuide;
    this.tracker.enabled = s.questGuide;
  }

  /** Altura en px CSS tapada por el panel superior y la barra de acciones. */
  insets(): { top: number; bottom: number } {
    const top = this.root.querySelector('.hud-top')?.getBoundingClientRect().bottom ?? 0;
    const barTop = this.actionBar.style.display !== 'none' ? this.actionBar.getBoundingClientRect().top : 0;
    const bar = barTop > 0 ? barTop : window.innerHeight;
    return { top: top + 4, bottom: Math.max(0, window.innerHeight - bar) + 4 };
  }

  /** Cierra el desplegable de habilidades si estaba abierto. Devuelve true si lo cerró. */
  dismissDrawer(): boolean {
    if (!this.skillsOpen) return false;
    this.skillsOpen = false;
    return true;
  }

  setPortrait(colors: HumanoidColors): void {
    const c = this.portrait.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#000';
    c.fillRect(0, 0, 16, 16);
    c.drawImage(humanoidSprite(colors).right, 0, 0);
  }

  showBanner(title: string, subtitle?: string): void {
    this.banner.replaceChildren(title, ...(subtitle ? [h('small', { text: subtitle })] : []));
    this.banner.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 2400);
  }

  pushMessage(text: string, kind: 'info' | 'warn' | 'good' | 'combat' = 'info'): void {
    const el = h('div', { class: kind, text });
    this.log.append(el);
    while (this.log.childElementCount > 3) this.log.firstElementChild?.remove();
    window.setTimeout(() => el.remove(), 4200);
  }

  /** Nombre corto y color del recurso de la clase (PM, VIG, ENE, FE). */
  setResource(short: string, color: string): void {
    this.resourceShort = short;
    this.mp.fill.style.background = `linear-gradient(${color}, ${color}cc)`;
    this.lastSig = '';
  }

  update(game: Game, dt: number): void {
    const p = game.state.player;
    const prog = levelProgress(p.xp);
    const hpNow = p.hp;
    const sig = `${p.name}|${p.level}|${p.gold}|${hpNow}/${p.maxHp}|${p.mp}/${p.maxMp}|${p.xp}|${p.attributePoints}`;
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.nameEl.replaceChildren(
        `${p.name} · Nv ${p.level}`,
        ...(p.attributePoints > 0 ? [h('span', { class: 'hud-points', text: ' ✚' })] : []),
      );
      this.goldEl.textContent = `● ${p.gold} oro`;
      this.hp.fill.style.width = `${(100 * hpNow) / Math.max(1, p.maxHp)}%`;
      this.hp.label.textContent = `PV ${hpNow}/${p.maxHp}`;
      this.mp.fill.style.width = `${(100 * p.mp) / Math.max(1, p.maxMp)}%`;
      this.mp.label.textContent = `${this.resourceShort} ${p.mp}/${p.maxMp}`;
      this.xp.fill.style.width = `${prog.ratio * 100}%`;
      this.xp.el.title = prog.needed ? `XP ${prog.current}/${prog.needed}` : 'Nivel máximo';
    }
    this.minimap.draw(game.zone, game.view.rx, game.view.ry, dt);
    this.skillBar.update(game);
    this.tracker.update(game);
    this.actionBar.style.display = game.battle || game.pendingBattle ? 'none' : '';
    this.skillBar.el.style.display = this.skillsOpen && !game.battle ? '' : 'none';
    this.drawerBtn.classList.toggle('active', this.skillsOpen);
    this.questsBtn.classList.toggle('alert', Quests.activeQuests(game.state).some((q) => Quests.isReady(game.state, q)));
    // Compañero: nombre y vida
    const cd = game.companionDef;
    const party = game.state.party;
    const max = cd ? game.allyStats().maxHp : 0;
    const asig = cd ? `${cd.id}|${party.hp}|${max}|${party.down}|${party.approval[cd.id] ?? 0}` : '';
    // Los avisos de estado van justo debajo del panel (que crece con compañero y mascota).
    if (++this.layoutTick % 30 === 0) {
      const bottom = this.petEl.closest('.hud-panel')?.getBoundingClientRect().bottom ?? 0;
      if (bottom > 0) this.leftCol.style.top = `${Math.round(bottom + 4)}px`;
    }
    // Mascota: nombre, nivel y vida (tócala para darle órdenes)
    const pi = game.petInstance;
    const pmax = pi ? Pets.petStats(pi).hp : 0;
    const psig = pi ? `${pi.uid}|${pi.species}|${pi.nickname ?? ''}|${pi.hp}|${pmax}|${pi.down}|${pi.level}|${game.petOrder ?? ''}` : '';
    if (psig !== this.petSig) {
      this.petSig = psig;
      this.allySig = '';
      this.petEl.style.display = pi ? '' : 'none';
      if (pi) {
        this.petEl.replaceChildren(
          h('span', { class: 'ally-name pet-name', text: `🐾 ${petName(pi)} Nv${pi.level}${pi.down ? ' 💤' : ''}${game.petOrder ? ' ⚑' : ''}` }),
          h('div', { class: 'bar hp thin petbar' }, [h('i', { attrs: { style: `width:${pi.down ? 0 : (100 * pi.hp) / Math.max(1, pmax)}%` } })]),
        );
      }
    }
    if (asig !== this.allySig) {
      this.allySig = asig;
      this.allyEl.style.display = cd ? '' : 'none';
      // Los avisos de estado van justo debajo del panel (que crece con el compañero).
      requestAnimationFrame(() => {
        const bottom = this.petEl.closest('.hud-panel')?.getBoundingClientRect().bottom ?? 0;
        if (bottom > 0) this.leftCol.style.top = `${Math.round(bottom + 4)}px`;
      });
      if (cd) {
        const ap = party.approval[cd.id] ?? 0;
        const mood = ap >= 4 ? '😊' : ap <= -4 ? '😠' : '😐';
        this.allyEl.replaceChildren(
          h('span', { class: 'ally-name', text: `${cd.name} ${party.down ? '💀' : mood}` }),
          h('div', { class: 'bar hp thin ally' }, [h('i', { attrs: { style: `width:${party.down ? 0 : (100 * party.hp) / Math.max(1, max)}%` } })]),
        );
      }
    }
  }
}
