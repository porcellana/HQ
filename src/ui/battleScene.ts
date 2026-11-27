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
import { makeBattleBackground, ambientColor } from '@/gfx/battleBg';
import { monsterSprite } from '@/gfx/monsters';
import { LEVEL_DENSITY, ParticlePool, emitDissolve, emitHeal, emitImpact, emitStatusPuff, emitTrail, type FxLevel } from '@/gfx/particles';
import { PAL } from '@/gfx/palette';
import { petSprite } from '@/gfx/pets';
import { silhouette } from '@/gfx/silhouette';
import { itemIconElement } from '@/gfx/items';
import { humanoidSprite, type HumanoidColors } from '@/gfx/sprites';
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
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  t: number;
  life: number;
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
      hpShown: b.hp(c), maxHp: b.maxHp(c), hpTarget: b.hp(c), dead: false, name: c.name, enter: entering ? 0 : 1,
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

  private update(dt: number): void {
    this.time += dt;
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
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < f.life);
    if (this.shakeT > 0) this.shakeT -= dt;
    for (const u of this.units.values()) {
      u.flash = Math.max(0, u.flash - dt * 6);
      u.shake = Math.max(0, u.shake - dt * 3);
      if (u.enter < 1) {
        u.enter = Math.min(1, u.enter + dt * 2.6);
        u.alpha = u.enter;
      }
      u.hpShown += (u.hpTarget - u.hpShown) * Math.min(1, dt * 7);
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
    if (this.bg) ctx.drawImage(this.bg, 0, 0, W, H);
    this.drawAmbient();
    const list = [...this.units.values()].sort((a, b) => a.y - b.y);
    for (const u of list) this.drawUnit(u);
    // Partículas en espacio de sprite (escala S)
    ctx.save();
    ctx.scale(this.S, this.S);
    this.pool.draw(ctx);
    ctx.restore();
    for (const u of list) this.drawOverlay(u);
    this.drawFloats();
    ctx.restore();
    if (this.tint && this.tint.a > 0) {
      ctx.fillStyle = this.tint.color;
      ctx.globalAlpha = this.tint.a;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.wipe < 1) this.drawWipe();
  }

  private drawAmbient(): void {
    const { ctx, W, H } = this;
    ctx.fillStyle = ambientColor(this.biome);
    for (let i = 0; i < 14; i++) {
      const t = this.time * (0.05 + (i % 5) * 0.012) + i * 0.37;
      const x = ((i * 97.3 + Math.sin(t * 6 + i) * 14 + t * 40) % W + W) % W;
      const y = H * (0.12 + ((i * 53) % 70) / 100) + Math.sin(t * 9 + i) * 6;
      ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
    }
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
    const bob = Math.sin(this.time * 2.2 + u.phase);
    const sc = 1 + 0.025 * bob;
    const x = u.x + u.ox + (u.shake > 0 ? Math.sin(this.time * 70) * u.shake * 4 : 0);
    const y = u.y + u.oy;
    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.hy + 2, w * 0.38, w * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = u.alpha;
    ctx.translate(x, y);
    if (u.dead && u.c.side === 'party') {
      ctx.rotate(-Math.PI / 2.3);
      ctx.globalAlpha = 0.55;
    }
    const img = u.dissolve > 0 ? this.dissolved(u) : u.img;
    ctx.drawImage(img, -w / 2, -w * sc + 2, w, w * sc);
    if (u.flash > 0) {
      ctx.globalAlpha = Math.min(1, u.flash) * 0.85;
      ctx.drawImage(u.sil, -w / 2, -w * sc + 2, w, w * sc);
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
      ctx.fillStyle = u.big ? '#a040ff' : '#d84040';
      ctx.fillRect(u.x - bw / 2, ty, (bw * Math.max(0, u.hpShown)) / Math.max(1, u.maxHp), 5);
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
      const rise = (f.t < 0.18 ? -ease(f.t / 0.18) * 14 : -14 - (f.t - 0.18) * 22);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `bold ${f.size}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000';
      ctx.strokeText(f.text, f.x, f.y + rise);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y + rise);
    }
    ctx.globalAlpha = 1;
  }

  // ====================================================== utilidades de efectos
  private center(u: Unit): { x: number; y: number } {
    return { x: u.x + u.ox, y: u.y + u.oy - 8 * u.k };
  }
  private float(u: Unit, text: string, color: string, size = 22): void {
    const c = this.center(u);
    this.floats.push({ x: c.x + (Math.random() - 0.5) * 14, y: c.y - 8 * u.k * 0.4, text, color, size, t: 0, life: 1.0 });
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
        const col = ev.tag === 'estado' ? '#c8a0ff' : ev.crit ? '#ffd860' : ev.tag === 'vulnerable' ? '#ff9040' : ev.tag === 'resiste' || ev.tag === 'mitad' ? '#b0b0c0' : u.c.side === 'party' ? '#ff8a8a' : '#ffffff';
        this.float(u, `${ev.crit ? '¡' : ''}${ev.amount}${ev.crit ? '!' : ''}`, col, ev.crit ? 30 : 24);
        const p = this.fxAt(u);
        emitImpact(this.pool, ev.dmgType ?? null, p.x, p.y, { power: ev.crit ? 0.9 : 0.35, density: this.density });
        this.d.sfx(ev.crit ? 'critico' : ev.dmgType ? IMPACT_SFX[ev.dmgType] : 'golpe');
        if (u.c.side === 'party') {
          this.d.sfx('herido');
          if (u.id === 'player') this.d.vibrate(ev.crit ? 40 : 18);
        }
        if (ev.crit) this.shake(4, 0.25);
        else if (ev.amount > 0 && u.c.side === 'party') this.shake(2, 0.15);
        await this.wait(ev.crit ? 0.42 : 0.3);
        break;
      }
      case 'miss': {
        const u = U(ev.id);
        if (!u) break;
        this.float(u, ev.text, '#b8b0a0', 18);
        u.ox += u.c.side === 'party' ? 10 : -10;
        this.d.sfx('fallo');
        await this.wait(0.28);
        break;
      }
      case 'heal': {
        const u = U(ev.id);
        if (!u) break;
        u.hpTarget = ev.hp;
        this.float(u, `+${ev.amount}`, '#70f090', 24);
        const p = this.fxAt(u);
        emitHeal(this.pool, p.x, p.y + 4, this.density);
        this.d.sfx('ding');
        await this.wait(0.35);
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
        await this.wait(0.3);
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
          await this.tween(0.75, (k) => {
            u.dissolve = k;
            if (Math.random() < 0.5) emitDissolve(this.pool, cx.x, cx.y, colors, this.density * 0.35);
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
        break;
      }
      case 'end':
        break;
    }
  }

  private async playAttack(ev: Extract<BattleEvent, { t: 'attack' }>): Promise<void> {
    const from = this.units.get(ev.from);
    const targets = ev.to.map((id) => this.units.get(id)).filter((u): u is Unit => !!u);
    if (!from || !targets.length) return;
    const t0 = targets[0]!;
    const color = ev.color ?? (ev.dmgType ? SPELL_COLORS[ev.dmgType] : undefined) ?? '#d8d0bc';
    const dir = from.c.side === 'party' ? -1 : 1;
    if (ev.style === 'melee') {
      const gap = 16 * from.k * 0.55;
      const tx = t0.x - dir * gap - from.hx;
      const ty = t0.y - from.hy;
      from.oy = 0;
      this.d.sfx('whoosh');
      // Anticipación (retrocede un poco) y embestida
      await this.tween(0.1, (k) => (from.ox = -dir * 6 * k));
      await this.tween(0.16, (k) => {
        from.ox = -dir * 6 + (tx + dir * 6) * ease(k);
        from.oy = ty * ease(k);
      });
      return;
    }
    if (ev.style === 'ranged' || ev.style === 'cast') {
      this.d.sfx(ev.style === 'cast' ? 'whoosh' : 'whoosh');
      if (ev.style === 'cast') {
        const p = this.fxAt(from);
        emitStatusPuff(this.pool, p.x, p.y - 3, color, this.density);
        if (ev.dmgType && this.d.fx !== 'minimos') this.tint = { color, a: 0.0 };
        await this.tween(0.22, (k) => {
          from.oy = -8 * Math.sin(k * Math.PI);
          if (this.tint) this.tint.a = 0.16 * Math.sin(k * Math.PI);
        });
        this.tint = null;
        from.oy = 0;
      } else await this.tween(0.1, (k) => (from.ox = -dir * -6 * Math.sin(k * Math.PI)));
      const a = this.fxAt(from);
      await this.tween(0.26, (k) => {
        const fromP = this.fxAt(from);
        void a;
        for (const t of targets) {
          const tp = this.fxAt(t);
          const x = fromP.x + (tp.x - fromP.x) * k;
          const y = fromP.y + (tp.y - fromP.y) * k - Math.sin(k * Math.PI) * 3;
          if (targets.length === 1 || t === targets[0]) emitTrail(this.pool, x, y, color, this.density);
        }
      });
      return;
    }
    // 'self': brillo sobre el objetivo (curas, mejoras)
    const p = this.fxAt(t0);
    emitStatusPuff(this.pool, p.x, p.y, color, this.density);
    await this.tween(0.2, (k) => (from.oy = -5 * Math.sin(k * Math.PI)));
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
