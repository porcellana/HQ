/**
 * HUD en DOM superpuesto al canvas: vida, maná, XP, nivel, oro, minimapa,
 * registro de mensajes y barra de acciones con botones grandes.
 */
import type { Game } from '@/game/game';
import { levelProgress } from '@/game/rules/progression';
import type { Settings } from '@/game/settings';
import { humanoidSprite, type HumanoidColors } from '@/gfx/sprites';
import { h } from './dom';
import type { SkillDef } from '@/data/schema';
import { DiceRoller } from './dice';
import { Joystick } from './joystick';
import { Minimap } from './minimap';
import { SkillBar } from './skillbar';

export interface HudActions {
  onWait(): void;
  onSheet(): void;
  onMenu(): void;
  onInventory(): void;
  onJoystick(dir: { dx: number; dy: number } | null): void;
  onSkill(skill: SkillDef): void;
  onFlee(): void;
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
  private bannerTimer = 0;
  private resourceShort = 'PM';
  /** Última firma de datos mostrada, para no tocar el DOM si no cambia nada. */
  private lastSig = '';

  constructor(actions: HudActions) {
    this.portrait = h('canvas', { class: 'hud-portrait' });
    this.portrait.width = 16;
    this.portrait.height = 16;
    this.portrait.addEventListener('click', () => actions.onSheet());
    this.nameEl = h('b');
    this.goldEl = h('span', { class: 'hud-gold' });
    const panel = h('div', { class: 'hud-panel' }, [
      this.portrait,
      h('div', { class: 'hud-name' }, [this.nameEl, this.goldEl]),
      this.hp.el,
      this.mp.el,
      this.xp.el,
    ]);
    this.banner = h('div', { class: 'zone-banner' });
    this.log = h('div', { class: 'log' });
    this.joystick = new Joystick(actions.onJoystick);

    const btn = (ico: string, label: string, fn: () => void) =>
      h('button', { onClick: fn, attrs: { 'aria-label': label } }, [h('span', { class: 'ico', text: ico }), h('span', { text: label })]);
    this.actionBar = h('div', { class: 'action-bar' }, [
      btn('⏳', 'Esperar', actions.onWait),
      btn('📜', 'Ficha', actions.onSheet),
      btn('🎒', 'Mochila', actions.onInventory),
      btn('☰', 'Menú', actions.onMenu),
    ]);

    this.skillBar = new SkillBar(actions.onSkill, actions.onFlee);
    this.root = h('div', { class: 'hud passthrough' }, [
      h('div', { class: 'hud-top' }, [panel, this.minimap.el]),
      this.skillBar.statusRow,
      this.banner,
      this.log,
      this.dice.el,
      this.joystick.el,
      this.skillBar.el,
      this.actionBar,
    ]);
  }

  applySettings(s: Settings): void {
    this.joystick.el.style.display = s.joystick ? '' : 'none';
    this.joystick.setSide(s.hand);
    this.actionBar.classList.toggle('izquierda', s.hand === 'izquierda');
    this.skillBar.el.classList.toggle('izquierda', s.hand === 'izquierda');
  }

  /** Altura en px CSS tapada por el panel superior y la barra de acciones. */
  insets(): { top: number; bottom: number } {
    const top = this.root.querySelector('.hud-top')?.getBoundingClientRect().bottom ?? 0;
    const barTop = Math.min(this.actionBar.getBoundingClientRect().top, this.skillBar.el.getBoundingClientRect().top || Infinity);
    return { top: top * 0.6, bottom: Math.max(0, window.innerHeight - barTop) * 0.8 };
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
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 3200);
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
    const sig = `${p.name}|${p.level}|${p.gold}|${p.hp}/${p.maxHp}|${p.mp}/${p.maxMp}|${p.xp}|${p.attributePoints}`;
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.nameEl.replaceChildren(
        `${p.name} · Nv ${p.level}`,
        ...(p.attributePoints > 0 ? [h('span', { class: 'hud-points', text: ' ✚' })] : []),
      );
      this.goldEl.textContent = `● ${p.gold} oro`;
      this.hp.fill.style.width = `${(100 * p.hp) / Math.max(1, p.maxHp)}%`;
      this.hp.label.textContent = `PV ${p.hp}/${p.maxHp}`;
      this.mp.fill.style.width = `${(100 * p.mp) / Math.max(1, p.maxMp)}%`;
      this.mp.label.textContent = `${this.resourceShort} ${p.mp}/${p.maxMp}`;
      this.xp.fill.style.width = `${prog.ratio * 100}%`;
      this.xp.el.title = prog.needed ? `XP ${prog.current}/${prog.needed}` : 'Nivel máximo';
    }
    this.minimap.draw(game.zone, game.view.rx, game.view.ry, dt);
    this.skillBar.update(game);
  }
}
