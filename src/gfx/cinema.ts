/**
 * CINEMÁTICA DEL COMBATE
 * ----------------------
 * Reproduce en el tiempo los eventos de presentación que emite el motor:
 *   · temblor de pantalla, «hit-stop» (congelado de ~80 ms en el impacto) y
 *     cámara lenta en críticos y golpes de gracia;
 *   · zoom de acción hacia atacante y objetivo (multiplicador RELATIVO sobre
 *     el zoom del jugador) y viñeta oscura mientras dura el combate;
 *   · partículas por tipo de daño, arcos de tajo, relámpagos, proyectiles
 *     con estela, curaciones, estados y desintegración de enemigos;
 *   · destellos del botín con el color de su rareza.
 *
 * No toca la lógica del juego: solo lee eventos y `game.fx`. Todo respeta el
 * ajuste «Efectos de combate» (completos / reducidos / mínimos).
 */
import type { DamageType } from '@/data/schema';
import type { Point } from '@/engine/pathfinding';
import type { Enemy } from '@/game/combat/entities';
import type { CombatFxEvent, HitFx, KillFx } from '@/game/combat/presentation';
import type { Game } from '@/game/game';
import { PET_SPECIES } from '@/data/registry';
import { TILE } from './canvas';
import { monsterSprite } from './monsters';
import {
  LEVEL_DENSITY, ParticlePool, TYPE_BY_COLOR, emitDissolve, emitHeal, emitImpact, emitLootSparkle, emitStatusPuff, emitTrail,
  type FxLevel, type Rand,
} from './particles';
import { petSprite } from './pets';
import { STATUS_INFO } from '@/game/combat/status';

/** Zoom máximo de la cámara de acción respecto al zoom del jugador. */
export const ACTION_ZOOM = 1.28;
/** Colores del botín por rareza (índice 0..4). */
export const RARITY_COLORS = ['#d8d4cc', '#5ad05a', '#4a90f0', '#b060f0', '#ff9a20'];

interface Shape {
  kind: 'slash' | 'lightning';
  x: number;
  y: number;
  ang: number;
  age: number;
  life: number;
  /** Relámpago: puntos ya calculados (relativos a x,y). */
  pts?: Array<[number, number]>;
  big: boolean;
}

interface Ghost {
  /** Datos para volver a dibujar el sprite del enemigo caído. */
  look: Enemy['def']['look'];
  pet: string | null;
  x: number;
  y: number;
  facing: 'left' | 'right';
  /** Negativo hasta que se revela el golpe mortal; después, 0..life. */
  t: number;
  life: number;
  colors: string[];
  started: boolean;
}

interface Timer {
  t: number;
  fn: () => void;
}

export class CombatCinema {
  level: FxLevel = 'completos';
  readonly pool = new ParticlePool();
  rand: Rand = Math.random;
  /** Desplazamiento de cámara por el temblor (en píxeles de mundo). */
  shakeX = 0;
  shakeY = 0;
  /** Multiplicador de zoom de la cámara de acción (1 = sin zoom). */
  zoomMul = 1;
  /** Punto (casillas) al que se encuadra durante una acción; null = seguir al jugador. */
  focus: Point | null = null;
  /** Opacidad de la viñeta de combate (0..1). */
  vignette = 0;

  private zoomTarget = 1;
  private frameT = 0;
  private shakeAmp = 0;
  private shakeT = 0;
  private hitstopT = 0;
  private slowT = 0;
  private timers: Timer[] = [];
  readonly ghosts: Ghost[] = [];
  readonly shapes: Shape[] = [];
  private seen = new WeakSet<object>();
  /** Contadores para pruebas. */
  readonly stats = { hits: 0, shakes: 0, hitstops: 0, slowmos: 0, ghosts: 0 };

  setLevel(l: FxLevel): void {
    this.level = l;
    if (l !== 'completos') {
      this.zoomTarget = 1;
      this.shakeAmp = 0;
      this.hitstopT = 0;
      this.slowT = 0;
    }
  }

  private get density(): number {
    return LEVEL_DENSITY[this.level];
  }

  /** Factor de velocidad del juego: 0 en el hit-stop, 0,4 en cámara lenta, 1 normal. */
  get timeScale(): number {
    if (this.hitstopT > 0) return 0;
    if (this.slowT > 0) return 0.4;
    return 1;
  }

  /** Programa algo para dentro de `delay` segundos (tiempo real). */
  schedule(delay: number, fn: () => void): void {
    if (delay <= 0) fn();
    else this.timers.push({ t: delay, fn });
  }

  /** Reinicia todos los efectos (al cambiar de zona o cargar partida). */
  reset(): void {
    this.pool.clear();
    this.timers.length = 0;
    this.ghosts.length = 0;
    this.shapes.length = 0;
    this.zoomMul = this.zoomTarget = 1;
    this.focus = null;
    this.frameT = this.shakeT = this.hitstopT = this.slowT = 0;
    this.shakeX = this.shakeY = 0;
  }

  // ----------------------------------------------------------------- eventos
  /**
   * Encuadra a atacante y objetivo durante `hold` segundos (zoom de acción).
   * Solo con efectos completos.
   */
  frame(a: Point | null, b: Point | null, hold: number): void {
    if (this.level !== 'completos' || (!a && !b)) return;
    const p1 = a ?? b!;
    const p2 = b ?? a!;
    this.focus = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    this.zoomTarget = ACTION_ZOOM;
    this.frameT = Math.max(this.frameT, hold);
  }

  /** Llega un evento del motor (el impacto se aplica tras `ev.lead` segundos). */
  onEvent(ev: CombatFxEvent, game: Game): void {
    if (ev.type === 'hit') {
      const from = ev.attacker ? game.actorPos(ev.attacker) : null;
      this.frame(from, ev.pos, ev.lead + 0.9);
      this.schedule(ev.lead, () => this.applyHit(ev, from));
    } else if (ev.type === 'kill') {
      this.addGhost(ev);
      this.schedule(ev.lead, () => this.applyKill(ev));
    }
    // 'miss': sin partículas (solo el cartel); el zoom lo pide la tarjeta.
  }

  /** La tarjeta de duelo empieza: encuadra la acción mientras rueda el d20. */
  onDuelStart(attacker: Point | null, defender: Point | null, lead: number): void {
    this.frame(attacker, defender, lead + 1.1);
  }

  private applyHit(ev: HitFx, from: Point | null): void {
    this.stats.hits++;
    const px = ev.pos.x * TILE + TILE / 2;
    const py = ev.pos.y * TILE + TILE / 2;
    const power = Math.min(1, ev.amount / 14 + (ev.crit ? 0.4 : 0));
    const dir = from ? Math.atan2(ev.pos.y - from.y, ev.pos.x - from.x) : 0;
    emitImpact(this.pool, ev.dmgType, px, py, { power, density: this.density, dir, r: this.rand });
    if (this.density >= 0.5) this.addShape(ev.dmgType, px, py, dir, ev.crit || ev.killed);
    if (this.level === 'completos') {
      // Temblor según daño; más fuerte en críticos, muertes y si te golpean a ti.
      let amp = 0.5 + Math.min(1.6, ev.amount * 0.1);
      if (ev.crit) amp *= 1.8;
      if (ev.killed) amp *= 1.5;
      if (ev.target.kind === 'player') amp *= 1.2;
      this.shake(amp);
      this.hitstopT = Math.max(this.hitstopT, (65 + Math.min(45, ev.amount * 3) + (ev.crit ? 40 : 0)) / 1000);
      this.stats.hitstops++;
      if (ev.crit || ev.killed) {
        this.slowT = Math.max(this.slowT, 0.35);
        this.stats.slowmos++;
      }
    }
  }

  private addShape(type: DamageType | null, px: number, py: number, dir: number, big: boolean): void {
    if (this.shapes.length > 10) return;
    if (type === 'cortante') this.shapes.push({ kind: 'slash', x: px, y: py, ang: dir, age: 0, life: 0.28, big });
    else if (type === 'rayo') {
      // Relámpago ramificado que cae desde arriba hasta el objetivo.
      const pts: Array<[number, number]> = [];
      let x = 0;
      let y = -34;
      while (y < 0) {
        pts.push([x, y]);
        x += (this.rand() - 0.5) * 9;
        y += 6 + this.rand() * 5;
      }
      pts.push([0, 0]);
      this.shapes.push({ kind: 'lightning', x: px, y: py, ang: 0, age: 0, life: 0.3, pts, big });
    }
  }

  private shake(amp: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = 0.28;
    this.stats.shakes++;
  }

  private addGhost(ev: KillFx): void {
    const e = ev.enemy;
    const wild = e.def.pet ? PET_SPECIES.get(e.def.pet.species) : undefined;
    const look = e.def.look;
    this.ghosts.push({
      look, pet: wild ? wild.id : null, x: e.x, y: e.y, facing: e.facing, t: -ev.lead, life: this.level === 'completos' ? 0.7 : 0.4,
      colors: [look.main, look.dark, look.accent], started: false,
    });
    this.stats.ghosts++;
  }

  private applyKill(ev: KillFx): void {
    const px = ev.enemy.x * TILE + TILE / 2;
    const py = ev.enemy.y * TILE + TILE / 2;
    if (ev.items.length || ev.gold > 0) {
      const rank = ev.items.reduce((m, it) => Math.max(m, it.rarity), 0);
      emitLootSparkle(this.pool, px, py, RARITY_COLORS[rank] ?? '#f2d888', rank, this.density, this.rand);
    }
    if (ev.boss && this.level === 'completos') {
      this.shake(3);
      this.slowT = Math.max(this.slowT, 0.6);
    }
  }

  // ------------------------------------------------------------ actualización
  /** Avanza `dt` segundos reales; devuelve el factor de tiempo que debe aplicar el juego. */
  update(dt: number, game: Game | null): number {
    // Temporizadores (tiempo real)
    if (this.timers.length) {
      const due: Array<() => void> = [];
      for (const t of this.timers) {
        t.t -= dt;
        if (t.t <= 0) due.push(t.fn);
      }
      this.timers = this.timers.filter((t) => t.t > 0);
      for (const fn of due) fn();
    }
    if (this.hitstopT > 0) this.hitstopT = Math.max(0, this.hitstopT - dt);
    else if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);

    // Temblor: se amortigua en ~0,28 s.
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const k = this.shakeT / 0.28;
      const a = this.shakeAmp * k;
      this.shakeX = (this.rand() * 2 - 1) * a;
      this.shakeY = (this.rand() * 2 - 1) * a;
      if (this.shakeT === 0) this.shakeAmp = 0;
    } else {
      this.shakeX = this.shakeY = 0;
    }

    // Zoom de acción
    if (this.frameT > 0) {
      this.frameT -= dt;
      if (this.frameT <= 0) this.zoomTarget = 1;
    }
    this.zoomMul += (this.zoomTarget - this.zoomMul) * Math.min(1, dt * 6);
    if (this.zoomTarget === 1 && Math.abs(this.zoomMul - 1) < 0.004) {
      this.zoomMul = 1;
      this.focus = null;
    }

    const scale = this.timeScale;
    const sdt = dt * (scale === 0 ? 0 : scale);
    const combat = !!game && game.inCombat && !game.isDead;
    const vTarget = combat && this.level !== 'minimos' ? 1 : 0;
    this.vignette += (vTarget - this.vignette) * Math.min(1, dt * 3);

    if (game && this.density > 0) this.deriveFromFx(game);
    this.pool.update(sdt);
    for (const s of this.shapes) s.age += sdt;
    for (let i = this.shapes.length - 1; i >= 0; i--) if (this.shapes[i]!.age >= this.shapes[i]!.life) this.shapes.splice(i, 1);
    for (const g of this.ghosts) {
      g.t += sdt;
      if (g.t >= 0 && !g.started) {
        g.started = true;
        emitDissolve(this.pool, g.x * TILE + 8, g.y * TILE + 8, g.colors, this.density, this.rand);
      }
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) if (this.ghosts[i]!.t >= this.ghosts[i]!.life) this.ghosts.splice(i, 1);
    return scale;
  }

  /** Partículas derivadas de los efectos simples del motor (proyectiles, ondas, curaciones, estados). */
  private deriveFromFx(game: Game): void {
    const d = this.density;
    for (const f of game.fx) {
      if (f.t < 0) continue;
      if (f.kind === 'bolt') {
        const k = Math.min(1, f.t / f.life);
        const hx = (f.fx + (f.tx - f.fx) * k) * TILE + 8;
        const hy = (f.fy + (f.ty - f.fy) * k) * TILE + 8;
        emitTrail(this.pool, hx, hy, f.color, d, this.rand);
      } else if (f.kind === 'burst' && !this.seen.has(f)) {
        this.seen.add(f);
        this.burstParticles(f.x * TILE + 8, f.y * TILE + 8, f.radius * TILE, f.color);
      } else if (f.kind === 'text' && !this.seen.has(f)) {
        this.seen.add(f);
        if (f.color === '#60e070' && /^\+\d/.test(f.text)) emitHeal(this.pool, f.x * TILE + 8, f.y * TILE + 6, d, this.rand);
        else if (this.isStatusColor(f.color) && !/^[-+¡\d]/.test(f.text)) emitStatusPuff(this.pool, f.x * TILE + 8, f.y * TILE + 2, f.color, d, this.rand);
      }
    }
  }

  private isStatusColor(c: string): boolean {
    return Object.values(STATUS_INFO).some((s) => s.color === c);
  }

  /** Anillo de partículas para explosiones y hechizos de área. */
  private burstParticles(x: number, y: number, radius: number, color: string): void {
    const count = Math.max(1, Math.round((6 + radius * 0.35) * this.density));
    const type = TYPE_BY_COLOR[color];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.rand() * 0.4;
      const s = radius * (1.6 + this.rand());
      this.pool.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3.2, life: 0.35 + this.rand() * 0.25, color, size: type ? 2.2 : 1.6, size1: 0.4,
        shape: type === 'frio' ? 'shard' : 'square', rot: a,
      });
    }
  }

  // ------------------------------------------------------------------ dibujo
  /** Dibuja partículas y formas en coordenadas de mundo. */
  drawWorld(ctx: CanvasRenderingContext2D): void {
    for (const s of this.shapes) this.drawShape(ctx, s);
    this.pool.draw(ctx);
  }

  private drawShape(ctx: CanvasRenderingContext2D, s: Shape): void {
    const k = s.age / s.life;
    if (s.kind === 'slash') {
      // Arco blanco que barre el objetivo y se afina.
      const r = (s.big ? 11 : 8) * (0.6 + k * 0.6);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.ang + Math.PI / 2);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = (s.big ? 2.6 : 1.8) * (1 - k * 0.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      const sweep = Math.PI * 0.9;
      ctx.arc(0, 0, r, -sweep / 2 + k * 0.5, sweep / 2 + k * 0.5);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (s.pts) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [w, c] of [[3, 'rgba(240,240,96,0.45)'], [1.2, '#ffffff']] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Dibuja los enemigos que se están desintegrando: copia estática hasta que se
   * revela el golpe, y luego parpadeo, encogimiento y desvanecimiento.
   */
  drawGhosts(ctx: CanvasRenderingContext2D, silhouette: (img: HTMLCanvasElement, color?: string) => HTMLCanvasElement): void {
    for (const g of this.ghosts) {
      const sp = g.pet ? PET_SPECIES.get(g.pet) : undefined;
      const spr = sp ? petSprite(sp.look, sp.stage) : monsterSprite(g.look);
      const img = g.facing === 'right' ? spr.right : spr.left;
      const x = g.x * TILE;
      const y = g.y * TILE;
      if (g.t < 0) {
        ctx.drawImage(img, Math.round(x), Math.round(y) - 1);
        continue;
      }
      const k = g.t / g.life;
      // Parpadeo en el primer tercio, luego se encoge y se desvanece.
      const blink = k < 0.33 ? (Math.floor(g.t * 18) % 2 === 0 ? 1 : 0.25) : 1;
      const scale = k < 0.33 ? 1 : Math.max(0.1, 1 - (k - 0.33) * 1.3);
      ctx.save();
      ctx.globalAlpha = blink * (k < 0.5 ? 1 : 1 - (k - 0.5) * 2);
      ctx.translate(x + 8, y + 15);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -8, -16);
      if (k > 0.1) {
        ctx.globalAlpha *= 0.6;
        ctx.drawImage(silhouette(img, '#ffffff'), -8, -16);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
}
