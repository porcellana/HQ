/**
 * ESCENA DE BATALLA (estilo Final Fantasy, vista lateral) — capa de presentación
 * -----------------------------------------------------------------------------
 * La lógica vive en src/game/battle/battle.ts (sin DOM). Esta escena:
 *   - dibuja el escenario (fondo por bioma) y los sprites ampliados: tu grupo a
 *     la DERECHA y los enemigos a la IZQUIERDA, con respiración suave;
 *   - reproduce el guion de eventos de la batalla con animaciones (el atacante
 *     avanza y vuelve, destello, números flotantes, partículas por tipo de
 *     daño, desintegración al morir, sacudida suave);
 *   - ofrece el menú táctil compacto: Atacar, Habilidad, Objeto, Defender, Huir.
 * Sin carteles grandes, sin zoom de cámara y sin tarjeta de duelo.
 */
import { PET_SPECIES } from '@/data/registry';
import type { DamageType } from '@/data/schema';
import type { SfxId } from '@/game/game';
import type { Game } from '@/game/game';
import { Battle, SPELL_COLORS, type BattleEvent, type BattleResult, type Combatant, type TargetKind } from '@/game/battle/battle';
import { biomeOf, type Biome } from '@/game/battle/biome';
import { STATUS_INFO } from '@/game/combat/status';
import { itemDef } from '@/game/items/items';
import * as Pets from '@/game/pets/pets';
import { makeBattleBackground } from '@/gfx/battleBg';
import { monsterSprite } from '@/gfx/monsters';
import { LEVEL_DENSITY, ParticlePool, emitDissolve, emitHeal, emitImpact, emitStatusPuff, emitTrail, type FxLevel } from '@/gfx/particles';
import { PAL } from '@/gfx/palette';
import { petSprite } from '@/gfx/pets';
import { silhouette } from '@/gfx/silhouette';
import { itemIconElement } from '@/gfx/items';
import { humanoidSprite, type HumanoidColors } from '@/gfx/sprites';
import { ambientPos, ambientSpec, attackKind, damageStyle, elementOf, ghostStep, healStyle, hitStop, hpColor, missStyle, type AmbientSpec, type NumStyle } from '@/gfx/battleFx';
import { drawArrow, drawAura, drawCritStar, drawExplosion, drawHealLight, drawOrb, drawShock, drawSlash, drawThrust, makeVignette } from './battleFxDraw';
import { h } from './dom';

export interface BattleSceneDeps {
  root: HTMLElement;
  game: Game;
  battle: Battle;
  heroColors: HumanoidColors;
  speed: 'normal' | 'rapida';
  fx: FxLevel;
  sfx(id: SfxId): void;
  vibrate(ms: number): void;
  /** Se pulsó «Continuar» tras la victoria/derrota (la partida aplica el resultado). */
  onFinish(): void;
}

const IMPACT_SFX: Record<DamageType, SfxId> = {
  cortante: 'imp_tajo', perforante: 'imp_contundente', contundente: 'imp_contundente', fuego: 'imp_fuego', frio: 'imp_hielo',
  rayo: 'imp_rayo', veneno: 'imp_veneno', sagrado: 'imp_sagrado', necrotico: 'imp_sombra', arcano: 'imp_sombra',
};

interface Unit {
  id: string;
  c: Combatant;
  img: HTMLCanvasElement;
  sil: HTMLCanvasElement;
  /** Posición base (pies, centro) y desplazamiento de animación. */
  hx: number;
  hy: number;
  x: number;
  y: number;
  ox: number;
  oy: number;
  k: number;
  big: boolean;
  phase: number;
  flash: number;
  shake: number;
  alpha: number;
  dissolve: number;
  noise: Float32Array;
  hpShown: number;
  maxHp: number;
  hpTarget: number;
  dead: boolean;
  /** Mensaje de nombre (enemigos). */
  name: string;
  enter: number;
  /** Estela de daño de la barra de vida y deformación al golpear. */
  hpGhost: number;
  squash: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  t: number;
  life: number;
  pop: number;
  kind: string;
}

/** Efecto temporal en pantalla (explosiones, luz...). */
interface Fx {
  t: number;
  life: number;
  draw(ctx: CanvasRenderingContext2D, k: number): void;
}

interface Tween {
  t: number;
  d: number;
  fn(k: number): void;
  done(): void;
}

const ease = (k: number) => 1 - (1 - k) * (1 - k);

export class BattleScene {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stage: HTMLDivElement;
  private readonly msgEl: HTMLDivElement;
  private readonly orderEl: HTMLDivElement;
  private readonly partyEl: HTMLDivElement;
  private readonly menuEl: HTMLDivElement;
  private readonly drawerEl: HTMLDivElement;
  private readonly panelEl: HTMLDivElement;
  private readonly btns: Record<'attack' | 'skill' | 'item' | 'defend' | 'flee', HTMLButtonElement>;
  private units = new Map<string, Unit>();
  private pool = new ParticlePool(220);
  private floats: FloatText[] = [];
  private fxs: Fx[] = [];
  /** Dibujos de un solo fotograma (proyectiles en vuelo). */
  private immediate: Array<(ctx: CanvasRenderingContext2D) => void> = [];
  private hitStopT = 0;
  private screenFlash = 0;
  private vignette: HTMLCanvasElement | null = null;
  private amb: AmbientSpec;
  private tweens: Tween[] = [];
  private bg: HTMLCanvasElement | null = null;
  private biome: Biome;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private S = 4;
  private time = 0;
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private density: number;
  private speedK: number;
  private activeId = '';
  private lastAtk: { kind: ReturnType<typeof attackKind>; el: ReturnType<typeof elementOf>; color: string; from: string } | null = null;
  private shakeMag = 0;
  private shakeT = 0;
  private tint: { color: string; a: number } | null = null;
  private wipe = 0;
  private msgTimer = 0;
  private ro: ResizeObserver | null = null;
  // Entrada del jugador
  private choose: (() => void) | null = null;
  private targeting: { kind: TargetKind; valid: Set<string>; run(id: string): { ok: boolean; error?: string } } | null = null;
  private drawer: 'skills' | 'items' | 'orders' | null = null;
  private finished = false;
  private rows = new Map<string, { el: HTMLElement; hp: HTMLElement; hpTx: HTMLElement; mp?: HTMLElement; mpTx?: HTMLElement; st: HTMLElement }>();

  constructor(private readonly d: BattleSceneDeps) {
    const zone = d.game.zone.def;
    this.biome = biomeOf({ id: zone.id, kind: zone.kind, ...(zone.darkness !== undefined ? { darkness: zone.darkness } : {}), dungeon: zone.dungeon, generated: zone.generated });
    this.amb = ambientSpec(this.biome);
    this.density = LEVEL_DENSITY[d.fx];
    this.speedK = d.speed === 'rapida' ? 0.55 : 1;
    this.canvas = h('canvas', { class: 'b-canvas' });
    this.ctx = this.canvas.getContext('2d')!;
    this.msgEl = h('div', { class: 'b-msg' });
    this.orderEl = h('div', { class: 'b-order' });
    this.stage = h('div', { class: 'b-stage' }, [this.canvas, this.orderEl, this.msgEl]);
    this.partyEl = h('div', { class: 'b-party' });
    const mk = (key: keyof BattleScene['btns'], ico: string, label: string, fn: () => void) => {
      const b = h('button', { class: `b-btn b-${key}`, onClick: fn, attrs: { 'aria-label': label } }, [h('span', { class: 'ico', text: ico }), h('span', { text: label })]);
      return b;
    };
    this.btns = {
      attack: mk('attack', '⚔️', 'Atacar', () => this.onAttack()),
      skill: mk('skill', '✨', 'Habilidad', () => this.toggleDrawer('skills')),
      item: mk('item', '🎒', 'Objeto', () => this.toggleDrawer('items')),
      defend: mk('defend', '🛡️', 'Defender', () => this.run(() => d.battle.defend())),
      flee: mk('flee', '🏃', 'Huir', () => this.run(() => d.battle.flee())),
    };
    this.menuEl = h('div', { class: 'b-menu' }, Object.values(this.btns));
    this.drawerEl = h('div', { class: 'b-drawer' });
    this.panelEl = h('div', { class: 'b-panel' });
    const ui = h('div', { class: 'b-ui' }, [this.partyEl, this.drawerEl, this.menuEl, this.panelEl]);
    this.el = h('div', { class: 'battle' }, [this.stage, ui]);
    d.root.append(this.el);
    this.canvas.addEventListener('pointerdown', (e) => this.onTap(e));
    this.setEnabled(false);
    this.measure();
    this.buildUnits();
    this.buildParty();
    this.ro = new ResizeObserver(() => {
      this.measure();
      this.layout(true);
    });
    this.ro.observe(this.stage);
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
    void this.director();
  }

  // ======================================================== tamaño y unidades
  private measure(): void {
    const r = this.stage.getBoundingClientRect();
    this.W = Math.max(200, Math.round(r.width));
    this.H = Math.max(200, Math.round(r.height));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    // Escala de los sprites (16 px de píxel art): enteros para que se vean nítidos.
    this.S = Math.max(3, Math.min(7, Math.floor(Math.min(this.W / 5.0, this.H / 4.2) / 16)));
    this.bg = makeBattleBackground(this.W, this.H, this.biome, 7);
    this.vignette = makeVignette(this.W, this.H, this.amb.tint);
  }

  private spriteOf(c: Combatant): HTMLCanvasElement {
    const g = this.d.game;
    if (c.kind === 'player') return humanoidSprite(this.d.heroColors).left;
    if (c.kind === 'ally') {
      const l = g.companionDef?.look;
      if (!l) return humanoidSprite(this.d.heroColors).left;
      return humanoidSprite({
        hair: l.hair ?? PAL.hair, skin: l.skin ?? PAL.skin, cloth: l.cloth, clothDark: l.clothDark, pants: l.pants,
        ...(l.hat ? { hat: l.hat } : {}), ...(l.overlay ? { overlay: l.overlay } : {}),
      }).left;
    }
    if (c.kind === 'pet') {
      const sp = g.petInstance ? PET_SPECIES.get(g.petInstance.species) : undefined;
      return sp ? petSprite(sp.look, sp.stage).left : humanoidSprite(this.d.heroColors).left;
    }
    const def = c.enemy!.def;
    const wild = def.pet ? PET_SPECIES.get(def.pet.species) : undefined;
    return (wild ? petSprite(wild.look, wild.stage) : monsterSprite(def.look)).right;
  }

  private addUnit(c: Combatant, entering = false): Unit {
    const img = this.spriteOf(c);
    const b = this.d.battle;
    const noise = new Float32Array(256);
    for (let i = 0; i < 256; i++) noise[i] = Math.random();
    const u: Unit = {
      id: c.id, c, img, sil: silhouette(img, '#ffffff'), hx: 0, hy: 0, x: 0, y: 0, ox: 0, oy: 0, k: this.S + (c.boss ? 2 : 0), big: c.boss,
      phase: Math.random() * 6, flash: 0, shake: 0, alpha: entering ? 0 : 1, dissolve: 0, noise,
      hpShown: b.hp(c), maxHp: b.maxHp(c), hpTarget: b.hp(c), dead: false, name: c.name, enter: entering ? 0 : 1, hpGhost: b.hp(c), squash: 0,
    };
    this.units.set(c.id, u);
    return u;
  }

  private buildUnits(): void {
    for (const c of this.d.battle.combatants) this.addUnit(c);
    this.layout(true);
  }

  /** Coloca a cada unidad en su casilla de formación (grupo a la derecha, enemigos a la izquierda). */
  private layout(snap: boolean): void {
    const { W, H } = this;
    const party = [...this.units.values()].filter((u) => u.c.side === 'party');
    const foes = [...this.units.values()].filter((u) => u.c.side === 'foe' && !u.dead);
    // Grupo: columna diagonal (el jugador al frente).
    const order = (u: Unit) => (u.c.kind === 'ally' ? 0 : u.c.kind === 'player' ? 1 : 2);
    party.sort((a, b) => order(a) - order(b));
    const np = party.length;
    party.forEach((u, i) => {
      u.hy = H * (np === 1 ? 0.72 : 0.5 + (0.3 * (i + 0.5)) / np + (np === 2 ? 0.05 : 0));
      u.hx = W * (0.78 + 0.04 * ((i + (3 - np)) % 3) - 0.0) + (np === 1 ? W * 0.04 : 0);
    });
    // Enemigos: dos columnas escalonadas.
    const nf = foes.length;
    const cols = nf > 2 ? 2 : 1;
    foes.forEach((u, i) => {
      if (u.big && nf === 1) {
        u.hx = W * 0.27;
        u.hy = H * 0.76;
        return;
      }
      const col = cols === 1 ? 0 : i % 2;
      const row = cols === 1 ? i : Math.floor(i / 2);
      const rows = cols === 1 ? nf : Math.ceil(nf / 2);
      u.hx = W * (cols === 1 ? 0.24 + (nf === 2 ? (i % 2) * 0.1 : 0) : 0.34 - col * 0.17 + (row % 2) * 0.02);
      u.hy = H * (cols === 1 ? 0.55 + (0.26 * (i + 0.5)) / Math.max(1, nf) + 0.03 : 0.5 + (0.3 * (row + 0.5)) / rows + col * 0.035);
    });
    for (const u of this.units.values()) {
      u.k = this.S + (u.big ? 2 : 0);
      if (snap) {
        u.x = u.hx;
        u.y = u.hy;
      }
    }
  }

  // ===================================================================== bucle
  private frame(now: number): void {
    if (this.destroyed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private update(dtRaw: number): void {
    this.time += dtRaw;
    // Hit-stop: la acción se congela unas centésimas (los efectos de brillo siguen).
    let dt = dtRaw;
    if (this.hitStopT > 0) {
      this.hitStopT -= dtRaw;
      dt = 0;
    }
    this.screenFlash = Math.max(0, this.screenFlash - dtRaw * 5);
    for (const f of this.fxs) f.t += dtRaw;
    this.fxs = this.fxs.filter((f) => f.t < f.life);
    for (const t of [...this.tweens]) {
      t.t += dt;
      const k = Math.min(1, t.t / t.d);
      t.fn(k);
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(t), 1);
        t.done();
      }
    }
    this.pool.update(dt);
    for (const f of this.floats) f.t += dtRaw;
    this.floats = this.floats.filter((f) => f.t < f.life);
    if (this.shakeT > 0) this.shakeT -= dt;
    for (const u of this.units.values()) {
      u.flash = Math.max(0, u.flash - dtRaw * 6);
      u.squash *= Math.max(0, 1 - dtRaw * 12);
      u.shake = Math.max(0, u.shake - dt * 3);
      if (u.enter < 1) {
        u.enter = Math.min(1, u.enter + dtRaw * 2.6);
        u.alpha = u.enter;
      }
      u.hpGhost = ghostStep(u.hpTarget, u.hpGhost, dtRaw);
      u.hpShown += (u.hpTarget - u.hpShown) * Math.min(1, dtRaw * 7);
      if (Math.abs(u.hpTarget - u.hpShown) < 0.2) u.hpShown = u.hpTarget;
      // Se desliza hacia su sitio (al aparecer invocaciones).
      u.x += (u.hx - u.x) * Math.min(1, dt * 8);
      u.y += (u.hy - u.y) * Math.min(1, dt * 8);
    }
    this.syncRows();
  }

  /** Espera `s` segundos (escalados por la velocidad de batalla). */
  private wait(s: number): Promise<void> {
    return this.tween(s, () => void 0);
  }

  private tween(s: number, fn: (k: number) => void): Promise<void> {
    const d = Math.max(0.001, s * this.speedK);
    return new Promise((res) => this.tweens.push({ t: 0, d, fn, done: res }));
  }

  // ================================================================= dibujado
  private render(): void {
    const { ctx, W, H } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    // Sacudida suave de toda la escena
    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0 && this.d.fx !== 'minimos') {
      const m = this.shakeMag * Math.min(1, this.shakeT * 4);
      sx = Math.sin(this.time * 70) * m;
      sy = Math.cos(this.time * 83) * m * 0.7;
    }
    ctx.save();
    ctx.translate(sx, sy);
    if (this.bg) {
      // Parallax: el fondo respira despacio y se desplaza un poco con la acción.
      const px = Math.sin(this.time * 0.25) * 3 - (this.activeUnitX() - W / 2) * 0.012;
      ctx.drawImage(this.bg, -6 + px, -3, W + 12, H + 6);
    }
    this.drawAmbient(0);
    const list = [...this.units.values()].sort((a, b) => a.y - b.y);
    for (const u of list) this.drawUnit(u);
    for (const f of this.fxs) f.draw(ctx, Math.min(1, f.t / f.life));
    for (const fn of this.immediate) fn(ctx);
    this.immediate.length = 0;
    // Partículas en espacio de sprite (escala S)
    ctx.save();
    ctx.scale(this.S, this.S);
    this.pool.draw(ctx);
    ctx.restore();
    this.drawAmbient(1);
    for (const u of list) this.drawOverlay(u);
    this.drawFloats();
    ctx.restore();
    if (this.vignette && this.d.fx !== 'minimos') ctx.drawImage(this.vignette, 0, 0, W, H);
    if (this.screenFlash > 0) {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = Math.min(0.5, this.screenFlash * 0.5);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.tint && this.tint.a > 0) {
      ctx.fillStyle = this.tint.color;
      ctx.globalAlpha = this.tint.a;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.wipe < 1) this.drawWipe();
  }

  /** Partículas ambientales por bioma en dos capas de profundidad (0 detrás, 1 delante). */
  private drawAmbient(layer: 0 | 1): void {
    const { ctx, W, H, amb } = this;
    const n = Math.round(amb.count * Math.max(0.4, this.density));
    ctx.fillStyle = amb.color;
    for (let i = layer; i < n; i += 2) {
      const p = ambientPos(i, this.time, W, H, amb);
      const sz = Math.max(2, Math.round(amb.size * p.depth * (this.S / 4)));
      if (amb.kind === 'fog') {
        ctx.globalAlpha = 0.12 * p.depth;
        ctx.fillRect(Math.round(p.x - sz * 6), Math.round(p.y), sz * 14, sz * 2);
        ctx.globalAlpha = 1;
      } else if (amb.kind === 'bubbles') {
        ctx.strokeStyle = amb.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(p.x), Math.round(p.y), sz + 1, sz + 1);
      } else if (amb.kind === 'leaves') {
        ctx.fillRect(Math.round(p.x), Math.round(p.y), sz + 1, sz);
      } else ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }
  }

  private activeUnitX(): number {
    const u = this.units.get(this.activeId);
    return u ? u.x + u.ox : this.W / 2;
  }

  private drawWipe(): void {
    const { ctx, W, H } = this;
    const n = 9;
    ctx.fillStyle = '#000';
    for (let i = 0; i < n; i++) {
      const w = W * (1 - this.wipe);
      const y = (H * i) / n;
      if (i % 2) ctx.fillRect(0, y, w, H / n + 1);
      else ctx.fillRect(W - w, y, w, H / n + 1);
    }
  }

  private drawUnit(u: Unit): void {
    if (u.alpha <= 0.01) return;
    const { ctx } = this;
    const k = u.k;
    const w = 16 * k;
    // Idle: respiración (más lenta y amplia en los grandes) y leve balanceo.
    const bob = Math.sin(this.time * (u.big ? 1.5 : 2.2) + u.phase);
    const sc = 1 + 0.025 * bob + u.squash * 0.12;
    const wx = 1 - u.squash * 0.1;
    // Entrada: los enemigos entran deslizándose; los jefes caen con rebote.
    let ex = 0;
    let ey = 0;
    if (u.enter < 1) {
      const e = ease(u.enter);
      if (u.c.side === 'foe' && !u.big) ex = -(1 - e) * this.W * 0.18;
      else if (u.big) ey = -(1 - e * e) * this.H * 0.3 + Math.abs(Math.sin(e * 9)) * (1 - e) * -12;
    }
    const x = u.x + u.ox + ex + (u.shake > 0 ? Math.sin(this.time * 70) * u.shake * 4 : 0);
    const y = u.y + u.oy + ey;
    // Sombra (se encoge si el personaje salta/avanza en vertical)
    const lift = Math.max(0, -(u.oy + ey)) / Math.max(1, w);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.12, 0.38 - lift * 0.3)})`;
    ctx.beginPath();
    ctx.ellipse(u.x + u.ox + ex, u.hy + 2, w * 0.38 * (1 - lift * 0.3), w * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Aura de estado bajo los pies (veneno verde, fuego naranja...)
    if (!u.dead) {
      const st = u.c.statuses.find((s) => s.turns > 0);
      if (st) {
        const col = STATUS_INFO[st.id].color;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.28 + 0.14 * Math.sin(this.time * 5);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(u.x + u.ox, u.hy + 2, w * 0.46, w * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.globalAlpha = u.alpha;
    ctx.translate(x, y);
    if (u.dead && u.c.side === 'party') {
      ctx.rotate(-Math.PI / 2.3);
      ctx.globalAlpha = 0.55;
    }
    const img = u.dissolve > 0 ? this.dissolved(u) : u.img;
    ctx.drawImage(img, (-w * wx) / 2, -w * sc + 2, w * wx, w * sc);
    if (u.flash > 0) {
      ctx.globalAlpha = Math.min(1, u.flash) * 0.85;
      ctx.drawImage(u.sil, (-w * wx) / 2, -w * sc + 2, w * wx, w * sc);
    }
    ctx.restore();
  }

  /** Copia del sprite con huecos que crecen (desintegración de arriba abajo). */
  private dissolved(u: Unit): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const x = c.getContext('2d')!;
    x.drawImage(u.img, 0, 0);
    const id = x.getImageData(0, 0, 16, 16);
    for (let py = 0; py < 16; py++) {
      for (let px = 0; px < 16; px++) {
        const thr = u.dissolve * 1.35 - (py / 16) * 0.35;
        if (u.noise[py * 16 + px]! < thr) id.data[(py * 16 + px) * 4 + 3] = 0;
      }
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  private drawOverlay(u: Unit): void {
    if (u.alpha < 0.3 || (u.dead && u.c.side === 'foe')) return;
    const { ctx } = this;
    const k = u.k;
    const top = u.y + u.oy - 16 * k - 4;
    ctx.textAlign = 'center';
    const foe = u.c.side === 'foe';
    let ty = top;
    if (foe) {
      // Nombre y barra de vida del enemigo
      const bw = Math.max(46, 12 * k);
      ctx.font = `bold ${u.big ? 13 : 11}px system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.strokeText(u.name, u.x, ty);
      ctx.fillStyle = u.big ? '#e8c0ff' : '#f4efe0';
      ctx.fillText(u.name, u.x, ty);
      ty += 4;
      ctx.fillStyle = '#000';
      ctx.fillRect(u.x - bw / 2 - 1, ty - 1, bw + 2, 7);
      ctx.fillStyle = '#3a1010';
      ctx.fillRect(u.x - bw / 2, ty, bw, 5);
      const mh = Math.max(1, u.maxHp);
      if (u.hpGhost > u.hpShown) {
        ctx.fillStyle = '#fff0c0';
        ctx.fillRect(u.x - bw / 2, ty, (bw * Math.max(0, u.hpGhost)) / mh, 5);
      }
      ctx.fillStyle = u.big ? '#a040ff' : hpColor(u.hpShown / mh);
      ctx.fillRect(u.x - bw / 2, ty, (bw * Math.max(0, u.hpShown)) / mh, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(u.x - bw / 2, ty, (bw * Math.max(0, u.hpShown)) / mh, 1);
      ty -= 16;
    }
    // Estados (iconos sobre la cabeza)
    const st = u.c.statuses.filter((s) => s.turns > 0 || s.id === 'aturdido');
    if (st.length && !u.dead) {
      ctx.font = '13px sans-serif';
      st.forEach((s, i) => ctx.fillText(STATUS_INFO[s.id].icon, u.x + (i - (st.length - 1) / 2) * 15, (foe ? ty - 2 : top - 2) + Math.sin(this.time * 4 + i) * 1.5));
    }
    if (u.c.defending && !u.dead) {
      ctx.font = '16px sans-serif';
      ctx.fillText('🛡️', u.x + 16 * k * 0.4, u.y - 16 * k * 0.5);
    }
    // Marca de turno activo
    if (this.activeId === u.id && !u.dead) {
      ctx.fillStyle = '#f2d888';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      const ay = (foe ? ty - 12 : top - 12) + Math.sin(this.time * 6) * 2;
      ctx.beginPath();
      ctx.moveTo(u.x - 6, ay - 8);
      ctx.lineTo(u.x + 6, ay - 8);
      ctx.lineTo(u.x, ay);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }
    // Objetivo elegible
    if (this.targeting?.valid.has(u.id)) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 7);
      ctx.strokeStyle = this.targeting.kind === 'ally' ? `rgba(120,255,150,${0.5 + 0.5 * pulse})` : `rgba(255,90,70,${0.5 + 0.5 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(u.hx, u.hy + 2, 16 * k * 0.5 + pulse * 3, 16 * k * 0.15 + pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      const ay = top - (foe ? 30 : 16) - pulse * 4;
      ctx.beginPath();
      ctx.moveTo(u.x - 8, ay - 10);
      ctx.lineTo(u.x + 8, ay - 10);
      ctx.lineTo(u.x, ay + 2);
      ctx.fill();
    }
  }

  private drawFloats(): void {
    const { ctx } = this;
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      const k = f.t / f.life;
      const rise = f.t < 0.18 ? -ease(f.t / 0.18) * 14 : -14 - (f.t - 0.18) * 22;
      // «Pop»: aparece grande y se asienta (más en críticos); los fallos se deslizan.
      const pop = f.t < 0.16 ? 1 + (f.pop - 1) * (1 - f.t / 0.16) : 1;
      const dx = f.kind === 'miss' ? f.t * 26 : f.kind === 'crit' ? Math.sin(f.t * 40) * Math.max(0, 0.3 - f.t) * 14 : 0;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `${f.kind === 'miss' ? 'italic ' : ''}bold ${Math.round(f.size * pop)}px system-ui, sans-serif`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = f.kind === 'crit' ? 6 : 4;
      ctx.strokeStyle = f.kind === 'crit' ? '#7a2a00' : '#000';
      ctx.strokeText(f.text, f.x + dx, f.y + rise);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x + dx, f.y + rise);
      if (f.kind === 'crit' && f.t < 0.5) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha *= 0.45 * (1 - f.t / 0.5);
        ctx.fillText(f.text, f.x + dx, f.y + rise - 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ====================================================== utilidades de efectos
  private center(u: Unit): { x: number; y: number } {
    return { x: u.x + u.ox, y: u.y + u.oy - 8 * u.k };
  }
  private float(u: Unit, text: string, color: string, size = 22, st?: NumStyle): void {
    const c = this.center(u);
    this.floats.push({ x: c.x + (Math.random() - 0.5) * 14, y: c.y - 8 * u.k * 0.4, text, color, size, t: 0, life: st?.life ?? 1.0, pop: st?.pop ?? 1.2, kind: st?.kind ?? 'dmg' });
  }
  private floatStyled(u: Unit, st: NumStyle): void {
    this.float(u, st.text, st.color, st.size, st);
  }
  private fxPush(life: number, draw: Fx['draw']): void {
    if (this.fxs.length < 24) this.fxs.push({ t: 0, life, draw });
  }
  /** Centro del sprite en píxeles de pantalla. */
  private pos(u: Unit): { x: number; y: number } {
    return this.center(u);
  }
  private fxAt(u: Unit): { x: number; y: number } {
    const c = this.center(u);
    return { x: c.x / this.S, y: c.y / this.S };
  }
  private shake(mag: number, t: number): void {
    this.shakeMag = mag;
    this.shakeT = t;
  }

  // ===================================================================== guion
  private async director(): Promise<void> {
    const b = this.d.battle;
    // Entrada: transición breve y unidades que se deslizan
    for (const u of this.units.values()) {
      u.ox = u.c.side === 'foe' ? -this.W * 0.3 : this.W * 0.3;
      u.enter = 0;
      u.alpha = 0;
    }
    await this.tween(0.55, (k) => {
      this.wipe = ease(k);
      for (const u of this.units.values()) u.ox *= 0.86;
    });
    this.wipe = 1;
    for (const u of this.units.values()) u.ox = 0;
    if ([...this.units.values()].some((u) => u.big)) {
      this.shake(5, 0.4);
      this.screenFlash = 0.8;
      this.d.sfx('critico_grave');
    }
    const foes = b.foes();
    const names = foes.map((f) => f.name);
    this.say(foes.some((f) => f.boss) ? `¡${names[0]}!` : names.length === 1 ? `¡${names[0]} aparece!` : `¡${names.slice(0, 2).join(' y ')}${names.length > 2 ? '…' : ''}!`, 1.2);
    await this.wait(0.7);
    for (;;) {
      if (this.destroyed) return;
      for (const ev of b.drain()) await this.play(ev);
      if (b.ended) break;
      if (b.awaiting) {
        this.activeId = 'player';
        this.refreshOrder(b.upcoming());
        await this.playerTurn();
        continue;
      }
      b.step();
    }
    await this.ending();
  }

  /** Espera a que el jugador elija una acción válida. */
  private playerTurn(): Promise<void> {
    return new Promise((res) => {
      this.choose = () => {
        this.choose = null;
        res();
      };
      this.setEnabled(true);
    });
  }

  private say(text: string, hold = 1.4): void {
    this.msgEl.textContent = text;
    this.msgEl.classList.add('show');
    window.clearTimeout(this.msgTimer);
    this.msgTimer = window.setTimeout(() => this.msgEl.classList.remove('show'), hold * 1000 * this.speedK + 200);
  }

  private async play(ev: BattleEvent): Promise<void> {
    const U = (id: string) => this.units.get(id);
    switch (ev.t) {
      case 'turn':
        this.activeId = ev.id;
        this.refreshOrder(ev.order);
        await this.wait(0.12);
        break;
      case 'say':
        this.say(ev.text);
        await this.wait(0.3);
        break;
      case 'info':
        this.say(ev.text, 1.6);
        await this.wait(0.45);
        break;
      case 'attack':
        await this.playAttack(ev);
        break;
      case 'hit': {
        const u = U(ev.id);
        if (!u) break;
        u.hpTarget = ev.hp;
        u.flash = 1;
        u.shake = ev.crit ? 1 : 0.6;
        u.squash = ev.crit ? 1 : 0.6;
        const toParty = u.c.side === 'party';
        this.floatStyled(u, damageStyle(ev.amount, { crit: ev.crit, tag: ev.tag, toParty }));
        const p = this.fxAt(u);
        emitImpact(this.pool, ev.dmgType ?? null, p.x, p.y, { power: ev.crit ? 0.9 : 0.35, density: this.density });
        this.hitFx(u, ev);
        this.d.sfx(ev.crit ? 'critico' : ev.dmgType ? IMPACT_SFX[ev.dmgType] : 'golpe');
        if (toParty) {
          this.d.sfx('herido');
          if (u.id === 'player') this.d.vibrate(ev.crit ? 40 : 18);
        } else if (ev.crit) this.d.vibrate(25);
        if (ev.crit) {
          this.shake(5, 0.3);
          this.screenFlash = 0.7;
        } else if (ev.amount > 0) this.shake(toParty ? 2.5 : 1.5, 0.15);
        this.hitStopT = this.d.fx === 'minimos' ? 0 : hitStop({ crit: ev.crit, killed: ev.killed, amount: ev.amount, maxHp: u.maxHp });
        await this.wait(ev.crit ? 0.42 : 0.3);
        break;
      }
      case 'miss': {
        const u = U(ev.id);
        if (!u) break;
        this.floatStyled(u, missStyle(ev.text));
        u.ox += u.c.side === 'party' ? 12 : -12;
        this.d.sfx('fallo');
        await this.wait(0.28);
        break;
      }
      case 'heal': {
        const u = U(ev.id);
        if (!u) break;
        u.hpTarget = ev.hp;
        u.hpGhost = Math.min(u.hpGhost, ev.hp);
        this.floatStyled(u, healStyle(ev.amount));
        const p = this.fxAt(u);
        emitHeal(this.pool, p.x, p.y + 4, this.density);
        const c = this.pos(u);
        const r = 8 * u.k;
        this.fxPush(0.7, (ctx, k) => drawHealLight(ctx, c.x, u.y + 2, k, r));
        this.d.sfx('ding');
        await this.wait(0.4);
        break;
      }
      case 'mp': {
        const u = U(ev.id);
        if (u) this.float(u, `+${ev.amount} ${this.d.game.cls.resource.short}`, '#80b0ff', 18);
        await this.wait(0.2);
        break;
      }
      case 'status': {
        const u = U(ev.id);
        if (!u) break;
        const info = STATUS_INFO[ev.status];
        this.float(u, info.icon, info.color, 24);
        const p = this.fxAt(u);
        emitStatusPuff(this.pool, p.x, p.y - 4, info.color, this.density);
        await this.wait(0.25);
        break;
      }
      case 'buff': {
        const u = U(ev.id);
        if (!u) break;
        this.float(u, ev.text, '#f2d888', 18);
        const p = this.fxAt(u);
        emitHeal(this.pool, p.x, p.y, this.density * 0.6);
        const c = this.pos(u);
        const col = this.lastAtk?.color ?? '#f2d888';
        this.fxPush(0.8, (ctx, k) => drawAura(ctx, c.x, u.y + 2, k, 8 * u.k, col));
        await this.wait(0.35);
        break;
      }
      case 'defend': {
        const u = U(ev.id);
        if (u) this.float(u, '🛡 +2 CA', '#9ad0ff', 18);
        await this.wait(0.3);
        break;
      }
      case 'death': {
        const u = U(ev.id);
        if (!u) break;
        u.dead = true;
        this.d.sfx(u.c.side === 'foe' ? 'desintegra' : 'muerte');
        if (u.c.side === 'foe') {
          const colors = ['#ffffff', '#c8c0b0', '#e05050', '#a040ff'];
          const cx = this.fxAt(u);
          const big = u.big;
          if (big) {
            this.shake(6, 0.6);
            this.screenFlash = 0.9;
          }
          u.flash = 1;
          await this.tween(big ? 1.2 : 0.75, (k) => {
            u.dissolve = k;
            u.flash = Math.max(u.flash, (1 - k) * 0.6);
            if (big && Math.random() < 0.3) this.shake(3, 0.1);
            if (Math.random() < (big ? 0.9 : 0.5)) emitDissolve(this.pool, cx.x, cx.y + (Math.random() - 0.5) * 3, colors, this.density * (big ? 0.6 : 0.35));
          });
          u.alpha = 0;
          this.layout(false);
        } else await this.wait(0.35);
        break;
      }
      case 'summon': {
        const c = this.d.battle.get(ev.id);
        if (!c) break;
        const u = this.addUnit(c, true);
        this.layout(false);
        u.x = u.hx;
        u.y = u.hy;
        this.buildPartyRow(c);
        const p = this.fxAt(u);
        emitImpact(this.pool, 'necrotico', p.x, p.y, { power: 0.6, density: this.density });
        const sc = this.pos(u);
        this.fxPush(0.6, (ctx, k) => drawExplosion(ctx, sc.x, sc.y, k, 10 * u.k, 'necrotico'));
        this.d.sfx('imp_sombra');
        await this.wait(0.5);
        break;
      }
      case 'phase': {
        const u = U(ev.id);
        this.say(`«${ev.text}»`, 2.2);
        if (u) this.float(u, '‼', '#ff6040', 30);
        this.shake(3, 0.3);
        this.d.sfx('critico_grave');
        await this.wait(0.9);
        break;
      }
      case 'flee':
        if (ev.success) {
          this.say('¡Escapas!', 1);
          await this.tween(0.5, (k) => {
            for (const u of this.units.values()) if (u.c.side === 'party') u.ox = this.W * 0.5 * k * k;
          });
        } else await this.wait(0.2);
        break;
      case 'done': {
        const u = U(ev.id);
        if (u && (u.ox !== 0 || u.oy !== 0)) {
          const ox0 = u.ox;
          const oy0 = u.oy;
          await this.tween(0.18, (k) => {
            u.ox = ox0 * (1 - ease(k));
            u.oy = oy0 * (1 - ease(k));
          });
        }
        u && (u.ox = 0, u.oy = 0);
        if (this.activeId === ev.id) this.activeId = '';
        this.lastAtk = null;
        break;
      }
      case 'end':
        break;
    }
  }

  /** Efecto visual del golpe sobre el objetivo, según el arma/elemento del ataque en curso. */
  private hitFx(u: Unit, ev: Extract<BattleEvent, { t: 'hit' }>): void {
    const a = ev.tag === 'estado' ? null : this.lastAtk;
    const c = this.pos(u);
    const k = u.k;
    const dir = u.c.side === 'party' ? 1 : -1;
    if (ev.crit) this.fxPush(0.4, (ctx, kk) => drawCritStar(ctx, c.x, c.y, kk, 11 * k));
    if (!a) {
      const el = elementOf(ev.dmgType);
      if (el !== 'fisico') this.fxPush(0.45, (ctx, kk) => drawExplosion(ctx, c.x, c.y, kk, 7 * k, el));
      return;
    }
    const col = a.color;
    switch (a.kind) {
      case 'slash':
      case 'claw':
        this.fxPush(0.3, (ctx, kk) => drawSlash(ctx, c.x, c.y, 8 * k, -dir, kk, col, ev.crit, a.kind === 'claw'));
        if (ev.crit) this.fxPush(0.3, (ctx, kk) => drawSlash(ctx, c.x, c.y, 6 * k, -dir, kk, col, true, true));
        break;
      case 'thrust':
        this.fxPush(0.25, (ctx, kk) => drawThrust(ctx, c.x, c.y, 9 * k, -dir, kk, col));
        break;
      case 'smash':
        this.fxPush(0.4, (ctx, kk) => drawShock(ctx, c.x, u.y + 2, 10 * k, kk, col));
        this.fxPush(0.3, (ctx, kk) => drawExplosion(ctx, c.x, c.y, kk, 5 * k, 'fisico'));
        break;
      case 'arrow':
        this.fxPush(0.25, (ctx, kk) => drawExplosion(ctx, c.x, c.y, kk, 4 * k, 'fisico'));
        break;
      case 'orb':
        this.fxPush(0.55, (ctx, kk) => drawExplosion(ctx, c.x, c.y, kk, 9 * k, a.el));
        break;
    }
  }

  private async playAttack(ev: Extract<BattleEvent, { t: 'attack' }>): Promise<void> {
    const from = this.units.get(ev.from);
    const targets = ev.to.map((id) => this.units.get(id)).filter((u): u is Unit => !!u);
    if (!from || !targets.length) return;
    const t0 = targets[0]!;
    const color = ev.color ?? (ev.dmgType ? SPELL_COLORS[ev.dmgType] : undefined) ?? '#d8d0bc';
    const kind = attackKind(ev.style, ev.dmgType);
    const el = elementOf(ev.dmgType);
    this.lastAtk = { kind, el, color, from: ev.from };
    const dir = from.c.side === 'party' ? -1 : 1;
    if (ev.style === 'melee') {
      const gap = 16 * from.k * 0.55;
      const tx = t0.x - dir * gap - from.hx;
      const ty = t0.y - from.hy;
      from.oy = 0;
      this.d.sfx('whoosh');
      // Anticipación (retrocede y se agacha) y embestida; el pesado (contundente) salta.
      const jump = kind === 'smash' ? 10 : 0;
      await this.tween(0.12, (k) => {
        from.ox = -dir * 7 * k;
        from.squash = -0.5 * k;
      });
      from.squash = 0;
      await this.tween(0.16, (k) => {
        from.ox = -dir * 7 + (tx + dir * 7) * ease(k);
        from.oy = ty * ease(k) - jump * Math.sin(k * Math.PI);
        // Estela de imagen residual durante la embestida
        if (k > 0.2 && this.d.fx !== 'minimos') {
          const p = this.fxAt(from);
          emitTrail(this.pool, p.x - dir * 2, p.y, color, this.density * 0.6);
        }
      });
      return;
    }
    if (ev.style === 'ranged' || ev.style === 'cast') {
      this.d.sfx('whoosh');
      if (ev.style === 'cast') {
        const p = this.fxAt(from);
        emitStatusPuff(this.pool, p.x, p.y - 3, color, this.density);
        const fc = this.pos(from);
        const hasTint = !!ev.dmgType && this.d.fx !== 'minimos';
        if (hasTint) this.tint = { color, a: 0 };
        // Carga: círculo de energía que crece sobre el lanzador
        await this.tween(0.26, (k) => {
          from.oy = -8 * Math.sin(k * Math.PI);
          if (this.tint) this.tint.a = 0.14 * Math.sin(k * Math.PI);
          this.immediate.push((ctx) => drawOrb(ctx, fc.x - dir * 4, fc.y - 6, 3 + k * 5 * from.k * 0.3, el, this.time));
        });
        this.tint = null;
        from.oy = 0;
      } else {
        // Tensar el arco: retroceso y vuelta
        await this.tween(0.12, (k) => {
          from.ox = -dir * -7 * Math.sin(k * Math.PI);
        });
      }
      // Proyectil en vuelo hacia cada objetivo, con arco, estela y giro
      await this.tween(0.28, (k) => {
        const f = this.pos(from);
        for (const t of targets) {
          const tp = this.pos(t);
          const x = f.x + (tp.x - f.x) * k;
          const y = f.y + (tp.y - f.y) * k - Math.sin(k * Math.PI) * (kind === 'arrow' ? 14 : 8);
          const hh = kind === 'arrow' ? 14 : 8;
          const tilt = Math.atan2(tp.y - f.y - Math.cos(k * Math.PI) * Math.PI * hh, tp.x - f.x);
          if (kind === 'arrow') this.immediate.push((ctx) => drawArrow(ctx, x, y, tilt));
          else this.immediate.push((ctx) => drawOrb(ctx, x, y, 4 + from.k * 0.4, el, this.time));
          if (this.d.fx !== 'minimos' && (t === targets[0] || targets.length < 3)) emitTrail(this.pool, x / this.S, y / this.S, color, this.density);
        }
      });
      return;
    }
    // 'self': brillo sobre el objetivo (curas, mejoras)
    const p = this.fxAt(t0);
    emitStatusPuff(this.pool, p.x, p.y, color, this.density);
    await this.tween(0.22, (k) => {
      from.oy = -5 * Math.sin(k * Math.PI);
      from.squash = 0.3 * Math.sin(k * Math.PI);
    });
    from.oy = 0;
  }

  /** Fin de la batalla: pausa, saltitos y panel de resultado. */
  private async ending(): Promise<void> {
    const b = this.d.battle;
    this.activeId = '';
    this.setEnabled(false);
    this.refreshOrder([]);
    if (b.outcome === 'fled') {
      await this.wait(0.5);
      this.finish();
      return;
    }
    if (b.outcome === 'victory') {
      this.say('¡Victoria!', 2);
      this.d.sfx('victoria_acorde');
      for (let i = 0; i < 2; i++) {
        await this.tween(0.22, (k) => {
          for (const u of this.units.values()) if (u.c.side === 'party' && !u.dead) u.oy = -10 * Math.sin(k * Math.PI);
        });
      }
      for (const u of this.units.values()) u.oy = 0;
    } else {
      this.say('Has caído...', 2);
      await this.wait(0.8);
    }
    this.showPanel(b.result);
  }

  private showPanel(res: BattleResult): void {
    const g = this.d.game;
    this.menuEl.style.display = 'none';
    this.drawerEl.classList.remove('open');
    const lines: HTMLElement[] = [];
    if (res.outcome === 'victory') {
      const xp = g.battleXp(res);
      lines.push(h('h3', { text: 'Victoria' }));
      lines.push(h('p', { text: `+${xp} XP${res.gold ? ` · +${res.gold} oro` : ''}` }));
      if (res.items.length) lines.push(h('p', { class: 'b-loot', text: res.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ') }));
    } else lines.push(h('h3', { text: 'Has caído...' }), h('p', { text: 'Despertarás en un lugar seguro.' }));
    lines.push(h('button', { class: 'primary b-continue', text: 'Continuar', onClick: () => this.finish() }));
    this.panelEl.replaceChildren(...lines);
    this.panelEl.classList.add('open');
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.d.onFinish();
  }

  // ===================================================================== menú
  private setEnabled(on: boolean): void {
    for (const b of Object.values(this.btns)) b.disabled = !on;
    this.menuEl.classList.toggle('waiting', !on);
    if (!on) {
      this.targeting = null;
      this.closeDrawer();
    }
  }

  private run(fn: () => { ok: boolean; error?: string }): void {
    if (!this.choose) return;
    const r = fn();
    if (!r.ok) {
      this.say(r.error ?? 'No se puede.', 1.6);
      return;
    }
    this.targeting = null;
    this.closeDrawer();
    this.setEnabled(false);
    this.choose();
  }

  private onAttack(): void {
    if (!this.choose) return;
    if (this.targeting) {
      this.cancelTarget();
      return;
    }
    this.closeDrawer();
    this.pickTarget('enemy', (id) => this.d.battle.attack(id));
  }

  /** Pide objetivo: auto si sólo hay uno; si no, hay que tocarlo. */
  private pickTarget(kind: TargetKind, run: (id: string) => { ok: boolean; error?: string }, only?: (c: Combatant) => boolean): void {
    const b = this.d.battle;
    if (kind === 'allEnemies' || kind === 'self') return this.run(() => run(''));
    let cands = kind === 'enemy' ? b.foes() : b.party();
    if (only) cands = cands.filter(only);
    if (!cands.length) {
      this.say(kind === 'enemy' ? 'No hay objetivo válido.' : 'No hay aliado al que usarlo.', 1.4);
      return;
    }
    if (cands.length === 1) return this.run(() => run(cands[0]!.id));
    this.targeting = { kind, valid: new Set(cands.map((c) => c.id)), run };
    this.say(kind === 'enemy' ? 'Toca al enemigo' : 'Toca a un aliado', 6);
    this.partyEl.classList.toggle('picking', kind === 'ally');
  }

  private cancelTarget(): void {
    this.targeting = null;
    this.partyEl.classList.remove('picking');
    this.msgEl.classList.remove('show');
  }

  private onTap(e: PointerEvent): void {
    if (!this.targeting) return;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let best: Unit | null = null;
    let bd = Infinity;
    for (const u of this.units.values()) {
      if (!this.targeting.valid.has(u.id)) continue;
      const w = 16 * u.k;
      const cx = u.hx;
      const cy = u.hy - w * 0.5;
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      if (dx < w * 0.65 && dy < w * 0.75) {
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = u;
        }
      }
    }
    if (!best) {
      this.cancelTarget();
      return;
    }
    const t = this.targeting;
    this.partyEl.classList.remove('picking');
    this.run(() => t.run(best!.id));
  }

  private closeDrawer(): void {
    this.drawer = null;
    this.drawerEl.classList.remove('open');
    this.btns.skill.classList.remove('active');
    this.btns.item.classList.remove('active');
  }

  private toggleDrawer(kind: 'skills' | 'items' | 'orders'): void {
    if (!this.choose) return;
    this.cancelTarget();
    if (this.drawer === kind) return this.closeDrawer();
    this.drawer = kind;
    this.btns.skill.classList.toggle('active', kind !== 'items');
    this.btns.item.classList.toggle('active', kind === 'items');
    const b = this.d.battle;
    const items: HTMLElement[] = [];
    const cell = (ico: string | HTMLElement, name: string, badge: string, cls: string, title: string, fn: () => void, disabled = false) =>
      h('button', { class: `dr-item ${cls}`, onClick: fn, disabled, attrs: { title, 'aria-label': name } }, [
        typeof ico === 'string' ? h('span', { class: 'ico', text: ico }) : ico, h('span', { class: 'nm', text: name }), badge ? h('span', { class: 'bd', text: badge }) : null,
      ]);
    if (kind === 'skills') {
      for (const s of b.skills()) {
        items.push(cell(s.skill.icon, s.skill.name, s.reason && (b.player.cooldowns[s.skill.id] ?? 0) > 0 ? `⏳${b.player.cooldowns[s.skill.id]}` : `${s.cost}`, s.usable ? '' : 'blocked', s.reason ?? s.skill.description, () => {
          if (!s.usable) return this.say(s.reason ?? '', 1.4);
          this.closeDrawer();
          this.pickTarget(s.target, (id) => b.useSkill(s.skill.id, id || undefined));
        }));
      }
      if (b.petInstance && !b.petInstance.down) items.push(cell('🐾', 'Órdenes', '', 'pet', 'Órdenes a la mascota', () => this.toggleDrawer('orders')));
    } else if (kind === 'orders') {
      const pi = b.petInstance!;
      for (const id of pi.moves) {
        const m = Pets.getMove(id);
        items.push(cell(m?.icon ?? '🐾', m?.name ?? id, b.petOrder === id ? '✔' : '', '', m?.description ?? '', () => {
          b.setPetOrder(id);
          this.say(`${Pets.petName(pi)} usará ${m?.name ?? id}`, 1.4);
          this.closeDrawer();
        }));
      }
      items.push(cell('🤖', 'Libre', b.petOrder === null ? '✔' : '', '', 'Que decida la mascota', () => {
        b.setPetOrder(null);
        this.closeDrawer();
      }));
    } else {
      const usable = b.usableItems();
      if (!usable.length) items.push(h('p', { class: 'dr-empty', text: 'No llevas objetos usables.' }));
      for (const it of usable) {
        const def = itemDef(it);
        items.push(cell(itemIconElement(def.icon, 'dr-ico'), def.name, `×${it.qty}`, '', def.description ?? '', () => {
          this.closeDrawer();
          const tk = b.itemTarget(it);
          if (tk === 'enemy') this.pickTarget('enemy', (id) => b.useItem(it.uid, id), (c) => !!c.enemy?.def.pet);
          else this.pickTarget(tk, (id) => b.useItem(it.uid, id || undefined));
        }));
      }
    }
    this.drawerEl.replaceChildren(...items);
    this.drawerEl.classList.add('open');
  }

  // =============================================================== panel y orden
  private refreshOrder(ids: string[]): void {
    const chips: HTMLElement[] = [];
    for (const id of ids.slice(0, 8)) {
      const u = this.units.get(id);
      if (!u || u.dead) continue;
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      c.getContext('2d')!.drawImage(u.img, 0, 0);
      chips.push(h('span', { class: `o-chip ${u.c.side}${chips.length === 0 ? ' first' : ''}`, attrs: { title: u.name } }, [c]));
    }
    this.orderEl.replaceChildren(...chips);
  }

  private buildParty(): void {
    this.rows.clear();
    this.partyEl.replaceChildren();
    for (const c of this.d.battle.party()) this.buildPartyRow(c);
  }

  private buildPartyRow(c: Combatant): void {
    if (c.side !== 'party') return;
    const b = this.d.battle;
    const hp = h('i');
    const hpTx = h('em');
    const st = h('span', { class: 'b-st' });
    const bars: HTMLElement[] = [h('div', { class: 'bar hp' }, [hp, hpTx])];
    let mp: HTMLElement | undefined;
    let mpTx: HTMLElement | undefined;
    if (c.kind === 'player') {
      mp = h('i');
      mpTx = h('em');
      bars.push(h('div', { class: 'bar mp' }, [mp, mpTx]));
      mp.style.background = `linear-gradient(${b.get('player') ? this.d.game.cls.resource.color : '#3a6ad0'}, ${this.d.game.cls.resource.color}cc)`;
    }
    const el = h('div', { class: `b-row ${c.kind}`, onClick: () => this.onRowTap(c.id) }, [
      h('b', { class: 'nm', text: c.name }), st, h('div', { class: 'bars' }, bars),
    ]);
    this.partyEl.append(el);
    this.rows.set(c.id, { el, hp, hpTx, st, ...(mp ? { mp } : {}), ...(mpTx ? { mpTx } : {}) });
  }

  private onRowTap(id: string): void {
    if (!this.targeting || !this.targeting.valid.has(id)) return;
    const t = this.targeting;
    this.partyEl.classList.remove('picking');
    this.run(() => t.run(id));
  }

  private syncRows(): void {
    const b = this.d.battle;
    for (const [id, r] of this.rows) {
      const u = this.units.get(id);
      if (!u) continue;
      const max = Math.max(1, u.maxHp);
      const shown = Math.round(Math.max(0, u.hpShown));
      const key = `${shown}|${b.mp().value}|${u.c.statuses.map((s) => s.id + s.turns).join()}|${this.activeId === id}|${this.targeting?.valid.has(id) ?? false}|${u.c.buffs.length}`;
      if ((r.el as HTMLElement & { _k?: string })._k === key) continue;
      (r.el as HTMLElement & { _k?: string })._k = key;
      r.hp.style.width = `${(100 * shown) / max}%`;
      r.hpTx.textContent = `PV ${shown}/${max}`;
      if (r.mp && r.mpTx) {
        const m = b.mp();
        r.mp.style.width = `${(100 * m.value) / Math.max(1, m.max)}%`;
        r.mpTx.textContent = `${this.d.game.cls.resource.short} ${m.value}/${m.max}`;
      }
      r.st.textContent = [...u.c.statuses.map((s) => STATUS_INFO[s.id].icon), ...(u.c.buffs.length ? ['▲'] : []), ...(u.c.stealth > 0 ? ['🌑'] : [])].join('');
      r.el.classList.toggle('active', this.activeId === id);
      r.el.classList.toggle('down', u.dead);
      r.el.classList.toggle('pick', this.targeting?.valid.has(id) ?? false);
    }
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.clearTimeout(this.msgTimer);
    this.el.remove();
  }
}
