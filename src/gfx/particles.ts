/**
 * SISTEMA DE PARTÍCULAS LIGERO Y REUTILIZABLE
 * -------------------------------------------
 * Un «pool» de partículas preasignado (nunca crea objetos por fotograma) con
 * un tope de ~150 para que vaya fluido en móviles de gama media. Todo se
 * dibuja con rectángulos y círculos pequeños (sin shadowBlur) en coordenadas
 * de mundo (16 px por casilla).
 *
 * Para añadir el efecto de un tipo de daño nuevo, escribe un emisor en
 * EMITTERS (más abajo) y se usará solo: cada golpe, hechizo o proyectil
 * llama a `emitImpact(pool, tipo, …)`.
 */
import type { DamageType } from '@/data/schema';

/** Número máximo de partículas vivas a la vez. */
export const PARTICLE_CAP = 150;

export type ParticleShape = 'square' | 'circle' | 'spark' | 'ring' | 'shard';

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Aceleración vertical (gravedad > 0 cae, < 0 sube). */
  gy: number;
  /** Rozamiento por segundo (0 = ninguno). */
  drag: number;
  age: number;
  life: number;
  size: number;
  /** Tamaño final (se interpola; igual que `size` = constante). */
  size1: number;
  color: string;
  alpha: number;
  shape: ParticleShape;
  /** Ángulo para chispas y esquirlas. */
  rot: number;
}

/** Cuánta decoración se dibuja: completos 1, reducidos 0,5, mínimos 0,2. */
export type FxLevel = 'completos' | 'reducidos' | 'minimos';
export const LEVEL_DENSITY: Record<FxLevel, number> = { completos: 1, reducidos: 0.5, minimos: 0.2 };

/** Opciones al lanzar una partícula (todo opcional salvo posición, vida y color). */
export interface SpawnOpts {
  x: number;
  y: number;
  life: number;
  color: string;
  vx?: number;
  vy?: number;
  gy?: number;
  drag?: number;
  size?: number;
  size1?: number;
  alpha?: number;
  shape?: ParticleShape;
  rot?: number;
}

export class ParticlePool {
  readonly items: Particle[];
  /** Partículas vivas ahora mismo. */
  count = 0;
  /** Cuántas se descartaron por estar lleno el pool (para pruebas). */
  dropped = 0;
  private cursor = 0;

  constructor(readonly cap: number = PARTICLE_CAP) {
    this.items = Array.from({ length: cap }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, gy: 0, drag: 0, age: 0, life: 1, size: 1, size1: 1,
      color: '#fff', alpha: 1, shape: 'square' as ParticleShape, rot: 0,
    }));
  }

  /** Lanza una partícula; devuelve false si el pool está lleno (se descarta). */
  spawn(o: SpawnOpts): boolean {
    const n = this.items.length;
    for (let i = 0; i < n; i++) {
      const p = this.items[(this.cursor + i) % n]!;
      if (p.active) continue;
      this.cursor = (this.cursor + i + 1) % n;
      p.active = true;
      p.x = o.x;
      p.y = o.y;
      p.vx = o.vx ?? 0;
      p.vy = o.vy ?? 0;
      p.gy = o.gy ?? 0;
      p.drag = o.drag ?? 0;
      p.age = 0;
      p.life = Math.max(0.05, o.life);
      p.size = o.size ?? 1.5;
      p.size1 = o.size1 ?? p.size;
      p.color = o.color;
      p.alpha = o.alpha ?? 1;
      p.shape = o.shape ?? 'square';
      p.rot = o.rot ?? 0;
      this.count++;
      return true;
    }
    this.dropped++;
    return false;
  }

  update(dt: number): void {
    if (this.count === 0) return;
    for (const p of this.items) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        this.count--;
        continue;
      }
      if (p.drag > 0) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.gy * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  clear(): void {
    for (const p of this.items) p.active = false;
    this.count = 0;
  }

  /** Dibuja las partículas vivas (el contexto ya está en coordenadas de mundo). */
  draw(ctx: CanvasRenderingContext2D): void {
    if (this.count === 0) return;
    for (const p of this.items) {
      if (!p.active) continue;
      const k = p.age / p.life;
      const size = p.size + (p.size1 - p.size) * k;
      // Aparece rápido y se desvanece al final.
      const a = p.alpha * (k < 0.15 ? k / 0.15 : k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      switch (p.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'spark': {
          // Línea corta en la dirección del movimiento.
          const len = size * 2.2;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.8, size * 0.5);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - Math.cos(p.rot) * len, p.y - Math.sin(p.rot) * len);
          ctx.stroke();
          break;
        }
        case 'shard': {
          // Esquirla romboidal (hielo, cristal).
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot + p.age * 3);
          ctx.fillRect(-size * 0.4, -size, size * 0.8, size * 2);
          ctx.restore();
          break;
        }
        default:
          ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// EMISORES
// ---------------------------------------------------------------------------

/** Aleatorio del emisor: inyectable para que los tests sean deterministas. */
export type Rand = () => number;

const rr = (r: Rand, a: number, b: number) => a + r() * (b - a);

/** Cantidad de partículas escalada por el nivel de efectos (al menos 1 si density > 0). */
function n(base: number, density: number): number {
  return density <= 0 ? 0 : Math.max(1, Math.round(base * density));
}

interface EmitCtx {
  pool: ParticlePool;
  r: Rand;
  x: number;
  y: number;
  /** 0..1: fuerza del golpe (daño, crítico). */
  power: number;
  density: number;
  /** Dirección del golpe en radianes (de atacante a objetivo). */
  dir: number;
}

type Emitter = (e: EmitCtx) => void;

function sparks(e: EmitCtx, color: string, count: number, speed: number): void {
  for (let i = 0; i < n(count, e.density); i++) {
    const a = e.dir + rr(e.r, -1.3, 1.3);
    const s = rr(e.r, speed * 0.5, speed);
    e.pool.spawn({
      x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gy: 40, drag: 2.2, life: rr(e.r, 0.18, 0.4), color, size: rr(e.r, 1.2, 2), shape: 'spark', rot: a,
    });
  }
}

function shockwave(e: EmitCtx, color: string): void {
  if (e.density <= 0.2) return;
  e.pool.spawn({ x: e.x, y: e.y, life: 0.25, color, size: 2, size1: 8 + e.power * 6, shape: 'ring', alpha: 0.8 });
}

const EMITTERS: Partial<Record<DamageType | 'generico', Emitter>> = {
  // Cortante: chispas blancas rasantes (el arco de tajo lo dibuja la cinemática).
  cortante: (e) => sparks(e, '#ffffff', 7 + e.power * 6, 80),
  // Contundente y perforante: chispas y onda de choque.
  contundente: (e) => {
    sparks(e, '#f2d888', 6 + e.power * 6, 70);
    shockwave(e, '#ece6d6');
  },
  perforante: (e) => {
    sparks(e, '#d8d0bc', 6 + e.power * 5, 85);
    shockwave(e, '#d8d0bc');
  },
  // Fuego: llamas y brasas ascendentes.
  fuego: (e) => {
    for (let i = 0; i < n(9 + e.power * 6, e.density); i++) {
      e.pool.spawn({
        x: e.x + rr(e.r, -4, 4), y: e.y + rr(e.r, -2, 4), vx: rr(e.r, -14, 14), vy: rr(e.r, -50, -20), gy: -20, drag: 0.8, life: rr(e.r, 0.35, 0.75),
        color: e.r() < 0.4 ? '#ffd040' : e.r() < 0.5 ? '#e03020' : '#ff8030', size: rr(e.r, 1.8, 3), size1: 0.5, shape: 'square',
      });
    }
  },
  // Frío: cristales de hielo y vaho.
  frio: (e) => {
    for (let i = 0; i < n(6 + e.power * 4, e.density); i++) {
      const a = rr(e.r, 0, Math.PI * 2);
      e.pool.spawn({
        x: e.x, y: e.y, vx: Math.cos(a) * rr(e.r, 20, 55), vy: Math.sin(a) * rr(e.r, 20, 55) - 10, gy: 60, drag: 1.5, life: rr(e.r, 0.4, 0.7),
        color: e.r() < 0.5 ? '#c8f0ff' : '#80d0ff', size: rr(e.r, 1.8, 2.8), shape: 'shard', rot: a,
      });
    }
    for (let i = 0; i < n(3, e.density); i++) {
      e.pool.spawn({ x: e.x + rr(e.r, -5, 5), y: e.y + rr(e.r, -3, 5), vy: rr(e.r, -12, -4), life: 0.7, color: '#dff6ff', size: 2, size1: 5, shape: 'circle', alpha: 0.35 });
    }
  },
  // Rayo: chispas amarillas y blancas muy rápidas.
  rayo: (e) => {
    for (let i = 0; i < n(10 + e.power * 6, e.density); i++) {
      const a = rr(e.r, 0, Math.PI * 2);
      const s = rr(e.r, 60, 130);
      e.pool.spawn({
        x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 4, life: rr(e.r, 0.12, 0.28), color: e.r() < 0.5 ? '#ffffff' : '#f0f060', size: rr(e.r, 1.2, 1.8), shape: 'spark', rot: a,
      });
    }
  },
  // Veneno: burbujas verdes que suben.
  veneno: (e) => {
    for (let i = 0; i < n(7 + e.power * 3, e.density); i++) {
      e.pool.spawn({
        x: e.x + rr(e.r, -5, 5), y: e.y + rr(e.r, -2, 5), vx: rr(e.r, -6, 6), vy: rr(e.r, -26, -10), gy: -6, life: rr(e.r, 0.5, 0.9), color: e.r() < 0.5 ? '#80d040' : '#b0f070',
        size: rr(e.r, 1.2, 2.4), size1: 0.4, shape: 'circle', alpha: 0.85,
      });
    }
  },
  // Sagrado: destellos dorados que suben despacio.
  sagrado: (e) => {
    for (let i = 0; i < n(8 + e.power * 4, e.density); i++) {
      e.pool.spawn({
        x: e.x + rr(e.r, -6, 6), y: e.y + rr(e.r, -2, 6), vx: rr(e.r, -5, 5), vy: rr(e.r, -34, -14), gy: -8, life: rr(e.r, 0.5, 1), color: e.r() < 0.5 ? '#fff0a0' : '#ffffff',
        size: rr(e.r, 1.2, 2), size1: 0.3, shape: 'square',
      });
    }
    shockwave(e, '#fff0a0');
  },
  // Necrótico y arcano: humo y runas violetas.
  necrotico: (e) => smokeAndRunes(e, '#a040ff', '#3a1a4a'),
  arcano: (e) => smokeAndRunes(e, '#c080ff', '#4a2a6a'),
  // Veneno de araña, etc. usan los anteriores; «generico» es el fallback.
  generico: (e) => sparks(e, '#ffffff', 5 + e.power * 4, 60),
};

function smokeAndRunes(e: EmitCtx, light: string, dark: string): void {
  for (let i = 0; i < n(4, e.density); i++) {
    e.pool.spawn({ x: e.x + rr(e.r, -4, 4), y: e.y + rr(e.r, -2, 5), vx: rr(e.r, -8, 8), vy: rr(e.r, -18, -6), life: rr(e.r, 0.6, 1), color: dark, size: 2, size1: 6, shape: 'circle', alpha: 0.5 });
  }
  for (let i = 0; i < n(5 + e.power * 3, e.density); i++) {
    const a = rr(e.r, 0, Math.PI * 2);
    e.pool.spawn({
      x: e.x, y: e.y, vx: Math.cos(a) * rr(e.r, 15, 40), vy: Math.sin(a) * rr(e.r, 15, 40) - 10, drag: 1.8, life: rr(e.r, 0.4, 0.8), color: light, size: rr(e.r, 1.4, 2.2), shape: 'square',
    });
  }
}

/** Partículas de impacto de un tipo de daño en el punto (x, y) en píxeles de mundo. */
export function emitImpact(
  pool: ParticlePool, type: DamageType | null | undefined, x: number, y: number,
  opts: { power?: number; density?: number; dir?: number; r?: Rand } = {},
): void {
  const em = (type && EMITTERS[type]) || EMITTERS.generico!;
  em({ pool, r: opts.r ?? Math.random, x, y, power: Math.max(0, Math.min(1, opts.power ?? 0.3)), density: opts.density ?? 1, dir: opts.dir ?? 0 });
}

/** Chorro de curación: partículas verdes que suben. */
export function emitHeal(pool: ParticlePool, x: number, y: number, density = 1, r: Rand = Math.random): void {
  for (let i = 0; i < n(8, density); i++) {
    pool.spawn({
      x: x + rr(r, -6, 6), y: y + rr(r, 0, 6), vx: rr(r, -4, 4), vy: rr(r, -34, -14), gy: -6, life: rr(r, 0.6, 1), color: r() < 0.5 ? '#60e070' : '#c8ffd0', size: rr(r, 1.2, 2), size1: 0.4, shape: 'square',
    });
  }
}

/** Estela de un proyectil: una partícula pequeña que se apaga rápido. */
export function emitTrail(pool: ParticlePool, x: number, y: number, color: string, density = 1, r: Rand = Math.random): void {
  if (density < 0.5 && r() < 0.5) return;
  pool.spawn({ x: x + rr(r, -1, 1), y: y + rr(r, -1, 1), vx: rr(r, -6, 6), vy: rr(r, -6, 6), life: rr(r, 0.18, 0.32), color, size: rr(r, 1.4, 2.2), size1: 0.3, shape: 'circle', alpha: 0.8 });
}

/** Desintegración del enemigo: motas del color de su familia que se dispersan hacia arriba. */
export function emitDissolve(pool: ParticlePool, x: number, y: number, colors: string[], density = 1, r: Rand = Math.random): void {
  for (let i = 0; i < n(18, density); i++) {
    const a = rr(r, 0, Math.PI * 2);
    pool.spawn({
      x: x + rr(r, -5, 5), y: y + rr(r, -5, 6), vx: Math.cos(a) * rr(r, 8, 30), vy: Math.sin(a) * rr(r, 8, 24) - 18, gy: -14, drag: 1, life: rr(r, 0.5, 1),
      color: colors[Math.floor(r() * colors.length)] ?? '#ffffff', size: rr(r, 1.5, 2.8), size1: 0.3, shape: 'square',
    });
  }
}

/** Destellos de botín del color de su rareza (más cantidad cuanto más rara). */
export function emitLootSparkle(pool: ParticlePool, x: number, y: number, color: string, rank: number, density = 1, r: Rand = Math.random): void {
  for (let i = 0; i < n(5 + rank * 3, density); i++) {
    const a = rr(r, 0, Math.PI * 2);
    pool.spawn({
      x, y, vx: Math.cos(a) * rr(r, 12, 34), vy: Math.sin(a) * rr(r, 12, 34) - 16, gy: 40, drag: 1.5, life: rr(r, 0.4, 0.8), color: r() < 0.3 ? '#ffffff' : color, size: rr(r, 1.2, 2), size1: 0.3, shape: 'square',
    });
  }
}

/** Puff de un estado alterado (veneno, quemado…) sobre la cabeza. */
export function emitStatusPuff(pool: ParticlePool, x: number, y: number, color: string, density = 1, r: Rand = Math.random): void {
  for (let i = 0; i < n(4, density); i++) {
    pool.spawn({ x: x + rr(r, -4, 4), y: y + rr(r, -2, 2), vx: rr(r, -6, 6), vy: rr(r, -22, -8), life: rr(r, 0.4, 0.7), color, size: rr(r, 1.4, 2.2), size1: 0.3, shape: 'circle', alpha: 0.8 });
  }
}

/** Color de la partícula de un tipo de daño (para inferir efectos de proyectiles y explosiones). */
export const TYPE_BY_COLOR: Readonly<Record<string, DamageType>> = {
  '#ff8030': 'fuego', '#80d0ff': 'frio', '#f0f060': 'rayo', '#80d040': 'veneno', '#fff0a0': 'sagrado', '#a040ff': 'necrotico', '#c080ff': 'arcano',
};
