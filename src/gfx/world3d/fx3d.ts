/**
 * Partículas 3D de la batalla (pura, sin WebGL): chispas, brasas, esquirlas, motas de luz,
 * explosiones elementales, curaciones, mejoras y polvo. Cada partícula es un destello suave
 * (sprite aditivo) con velocidad, gravedad y vida; el dibujo lo hace SpriteBatch.
 */
import { ELEMENT_COLORS, type Element } from '../battleFx';
import { hexRgb } from './mesh';

export interface P3 {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  life: number; age: number; s0: number; s1: number; a: number; r: number; g: number; b: number;
  /** Gravedad (negativa = sube) y rozamiento. */
  gy: number; drag: number;
}

export type Rand = () => number;
const rr = (r: Rand, a: number, b: number): number => a + r() * (b - a);

export const FX3D_CAP = 700;

export class Fx3D {
  items: P3[] = [];
  constructor(public density = 1) {}

  spawn(p: Partial<P3> & { x: number; y: number; z: number; life: number; color?: string }): void {
    if (this.items.length >= FX3D_CAP) return;
    const c = hexRgb(p.color ?? '#ffffff');
    this.items.push({
      x: p.x, y: p.y, z: p.z, vx: p.vx ?? 0, vy: p.vy ?? 0, vz: p.vz ?? 0, life: p.life, age: 0, s0: p.s0 ?? 0.12, s1: p.s1 ?? p.s0 ?? 0.12, a: p.a ?? 0.9,
      r: c[0], g: c[1], b: c[2], gy: p.gy ?? 0, drag: p.drag ?? 0,
    });
  }

  update(dt: number): void {
    for (const p of this.items) {
      p.age += dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz *= k;
      p.vy -= p.gy * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    this.items = this.items.filter((p) => p.age < p.life);
  }

  clear(): void {
    this.items.length = 0;
  }

  /** Envía cada partícula al lote de sprites (tamaño y opacidad según su edad). */
  write(add: (x: number, y: number, z: number, size: number, alpha: number, r: number, g: number, b: number) => void): void {
    for (const p of this.items) {
      const k = p.age / p.life;
      const a = p.a * (k < 0.12 ? k / 0.12 : k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1);
      add(p.x, p.y, p.z, p.s0 + (p.s1 - p.s0) * k, a, p.r, p.g, p.b);
    }
  }
}

/** Cantidad escalada por la densidad (al menos 1 si density > 0). */
export const count = (base: number, density: number): number => (density <= 0 ? 0 : Math.max(1, Math.round(base * density)));

/** Destello grande y breve (flash de impacto o explosión). */
function flash(fx: Fx3D, x: number, y: number, z: number, size: number, color: string, life = 0.22): void {
  if (fx.density <= 0) return;
  fx.spawn({ x, y, z, life, s0: size * 0.5, s1: size, a: 0.85, color });
}

/** Chispas rasantes en la dirección `dirX` (+1 / −1). */
export function sparksBurst(fx: Fx3D, x: number, y: number, z: number, color: string, n: number, speed: number, dirX: number, r: Rand = Math.random): void {
  for (let i = 0; i < count(n, fx.density); i++) {
    const a = rr(r, -1.2, 1.2);
    const s = rr(r, speed * 0.5, speed);
    fx.spawn({ x, y, z, vx: dirX * Math.cos(a) * s, vy: Math.sin(a) * s * 0.8 + 0.6, vz: rr(r, -0.6, 0.6), gy: 4, drag: 2.4, life: rr(r, 0.2, 0.45), s0: rr(r, 0.07, 0.12), s1: 0.02, color });
  }
}

/** Impacto según el elemento: cada uno tiene su propio carácter. */
export function impact(fx: Fx3D, el: Element, x: number, y: number, z: number, power: number, dirX: number, r: Rand = Math.random): void {
  const [core, edge] = ELEMENT_COLORS[el];
  flash(fx, x, y, z, 0.5 + power * 0.7, core, 0.18);
  const d = fx.density;
  switch (el) {
    case 'fuego':
      for (let i = 0; i < count(10 + power * 8, d); i++) fx.spawn({ x: x + rr(r, -0.15, 0.15), y: y + rr(r, -0.1, 0.2), z: z + rr(r, -0.1, 0.1), vx: rr(r, -0.6, 0.6), vy: rr(r, 0.8, 2.2), vz: rr(r, -0.4, 0.4), gy: -1.5, drag: 0.8, life: rr(r, 0.4, 0.85), s0: rr(r, 0.18, 0.34), s1: 0.04, a: 0.8, color: r() < 0.45 ? '#ffd040' : r() < 0.5 ? '#ff5020' : '#ff8a30' });
      break;
    case 'frio':
      for (let i = 0; i < count(9 + power * 5, d); i++) {
        const a = rr(r, 0, 6.28);
        fx.spawn({ x, y, z, vx: Math.cos(a) * rr(r, 0.8, 2.2), vy: rr(r, 0.4, 2), vz: Math.sin(a) * rr(r, 0.4, 1.4), gy: 4, drag: 1.3, life: rr(r, 0.5, 0.85), s0: rr(r, 0.1, 0.18), s1: 0.03, color: r() < 0.5 ? '#d8f4ff' : '#7cc8ff' });
      }
      break;
    case 'rayo':
      for (let i = 0; i < count(12 + power * 8, d); i++) {
        const a = rr(r, 0, 6.28), s = rr(r, 2.5, 6);
        fx.spawn({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rr(r, -1, 1), drag: 5, life: rr(r, 0.12, 0.3), s0: rr(r, 0.08, 0.14), s1: 0.02, color: r() < 0.5 ? '#ffffff' : '#f4e850' });
      }
      break;
    case 'veneno':
      for (let i = 0; i < count(8, d); i++) fx.spawn({ x: x + rr(r, -0.2, 0.2), y: y + rr(r, -0.2, 0.1), z: z + rr(r, -0.1, 0.1), vx: rr(r, -0.3, 0.3), vy: rr(r, 0.4, 1.2), gy: -0.3, drag: 0.6, life: rr(r, 0.6, 1.1), s0: rr(r, 0.1, 0.2), s1: 0.28, a: 0.55, color: r() < 0.5 ? '#9ae04a' : '#58a028' });
      break;
    case 'sagrado':
      for (let i = 0; i < count(11, d); i++) fx.spawn({ x: x + rr(r, -0.25, 0.25), y: y + rr(r, -0.3, 0.2), z: z + rr(r, -0.15, 0.15), vx: rr(r, -0.2, 0.2), vy: rr(r, 0.6, 1.6), gy: -0.5, drag: 0.5, life: rr(r, 0.6, 1.0), s0: rr(r, 0.1, 0.18), s1: 0.02, color: r() < 0.5 ? '#fff8d0' : '#ffe080' });
      break;
    case 'necrotico': case 'arcano':
      for (let i = 0; i < count(10, d); i++) {
        const a = rr(r, 0, 6.28);
        fx.spawn({ x, y, z, vx: Math.cos(a) * rr(r, 0.5, 1.6), vy: rr(r, -0.2, 1.4), vz: Math.sin(a) * rr(r, 0.3, 1), drag: 1.4, life: rr(r, 0.5, 0.9), s0: rr(r, 0.12, 0.24), s1: 0.04, a: 0.75, color: el === 'necrotico' ? (r() < 0.5 ? '#c070ff' : '#5a1a90') : (r() < 0.5 ? '#f0c8ff' : '#a060ff') });
      }
      break;
    default:
      sparksBurst(fx, x, y, z, '#ffffff', 7 + power * 6, 4, dirX, r);
      sparksBurst(fx, x, y, z, '#f2d888', 4, 3, dirX, r);
      for (let i = 0; i < count(4, d); i++) fx.spawn({ x: x + rr(r, -0.2, 0.2), y: 0.05, z: z + rr(r, -0.2, 0.2), vx: rr(r, -0.8, 0.8), vy: rr(r, 0.1, 0.4), vz: rr(r, -0.4, 0.4), drag: 2, life: 0.5, s0: 0.14, s1: 0.4, a: 0.28, color: '#d8cfc0' });
  }
  if (el === 'frio' || el === 'fuego' || el === 'rayo') sparksBurst(fx, x, y, z, edge, 4, 3, dirX, r);
}

/** Curación: motas verdes y doradas que suben en espiral. */
export function healBurst(fx: Fx3D, x: number, y: number, z: number, r: Rand = Math.random): void {
  flash(fx, x, y + 0.2, z, 0.9, '#90ffb0', 0.4);
  for (let i = 0; i < count(14, fx.density); i++) {
    const a = rr(r, 0, 6.28), rad = rr(r, 0.15, 0.4);
    fx.spawn({ x: x + Math.cos(a) * rad, y: y - 0.3 + rr(r, 0, 0.3), z: z + Math.sin(a) * rad * 0.6, vx: 0, vy: rr(r, 0.6, 1.5), gy: -0.2, life: rr(r, 0.7, 1.2), s0: rr(r, 0.1, 0.2), s1: 0.02, color: i % 3 ? '#9affb8' : '#fff6c0' });
  }
}

/** Mejora: aro de motas del color del hechizo que se eleva. */
export function buffBurst(fx: Fx3D, x: number, y: number, z: number, color: string, r: Rand = Math.random): void {
  const n = count(16, fx.density);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283;
    fx.spawn({ x: x + Math.cos(a) * 0.45, y: y - 0.45, z: z + Math.sin(a) * 0.3, vx: -Math.cos(a) * 0.3, vy: rr(r, 0.9, 1.4), vz: -Math.sin(a) * 0.2, life: rr(r, 0.7, 1), s0: 0.14, s1: 0.03, color });
  }
}

/** Soplo de estado (veneno, quemadura...). */
export function statusPuff(fx: Fx3D, x: number, y: number, z: number, color: string, r: Rand = Math.random): void {
  for (let i = 0; i < count(7, fx.density); i++) {
    fx.spawn({ x: x + rr(r, -0.15, 0.15), y: y + rr(r, 0, 0.2), z, vx: rr(r, -0.4, 0.4), vy: rr(r, 0.4, 1.1), life: rr(r, 0.5, 0.9), s0: rr(r, 0.12, 0.2), s1: 0.3, a: 0.5, color });
  }
}

/** Estela de proyectil. */
export function trailPuff(fx: Fx3D, x: number, y: number, z: number, color: string, r: Rand = Math.random): void {
  for (let i = 0; i < count(2, fx.density); i++) {
    fx.spawn({ x: x + rr(r, -0.04, 0.04), y: y + rr(r, -0.04, 0.04), z, vx: rr(r, -0.2, 0.2), vy: rr(r, -0.1, 0.3), life: rr(r, 0.25, 0.5), s0: rr(r, 0.1, 0.18), s1: 0.02, a: 0.7, color });
  }
}

/** Desintegración: polvo luminoso que sube del cuerpo. */
export function dissolveDust(fx: Fx3D, x: number, y: number, z: number, colors: string[], r: Rand = Math.random): void {
  for (let i = 0; i < count(5, fx.density); i++) {
    fx.spawn({ x: x + rr(r, -0.3, 0.3), y: y + rr(r, 0, 0.8), z: z + rr(r, -0.2, 0.2), vx: rr(r, -0.2, 0.2), vy: rr(r, 0.3, 1.2), gy: -0.4, drag: 0.5, life: rr(r, 0.6, 1.2), s0: rr(r, 0.08, 0.18), s1: 0.02, color: colors[Math.floor(r() * colors.length)]! });
  }
}

/** Explosión elemental: destello grande, onda de motas y chispas. */
export function explosion(fx: Fx3D, el: Element, x: number, y: number, z: number, radius: number, r: Rand = Math.random): void {
  const [core, edge] = ELEMENT_COLORS[el];
  flash(fx, x, y, z, radius * 1.5, core, 0.3);
  fx.spawn({ x, y, z, life: 0.5, s0: radius * 0.6, s1: radius * 2.2, a: 0.35, color: edge });
  const n = count(18, fx.density);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + rr(r, -0.2, 0.2), s = rr(r, 1.2, 2.8) * radius;
    fx.spawn({ x, y, z, vx: Math.cos(a) * s, vy: rr(r, -0.3, 1.2), vz: Math.sin(a) * s * 0.5, gy: el === 'fuego' ? -1 : 3, drag: 2.2, life: rr(r, 0.35, 0.7), s0: rr(r, 0.1, 0.2), s1: 0.02, color: i % 2 ? core : edge });
  }
}

/** Onda de choque sobre el suelo. */
export function shockRing(fx: Fx3D, x: number, z: number, radius: number, color: string, r: Rand = Math.random): void {
  const n = count(22, fx.density);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283;
    fx.spawn({ x, y: 0.06, z, vx: Math.cos(a) * radius * 3.2, vy: rr(r, 0, 0.3), vz: Math.sin(a) * radius * 1.9, drag: 4.2, life: 0.42, s0: 0.22, s1: 0.06, a: 0.7, color });
  }
}

/** Estrella de crítico: abanico radial de destellos dorados. */
export function critBurst(fx: Fx3D, x: number, y: number, z: number, r: Rand = Math.random): void {
  flash(fx, x, y, z, 1.6, '#fff0b0', 0.28);
  const n = count(14, fx.density);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283;
    fx.spawn({ x, y, z, vx: Math.cos(a) * rr(r, 2.4, 4), vy: Math.sin(a) * rr(r, 2.4, 4), drag: 4.5, life: 0.35, s0: 0.16, s1: 0.03, color: i % 2 ? '#ffe060' : '#ffffff' });
  }
}

/** Ambiente en 3D por bioma: devuelve posiciones de motas flotando (pura, para tests y dibujo). */
export function ambientMote(i: number, t: number, kind: 'leaves' | 'snow' | 'embers' | 'spores' | 'fog' | 'bubbles' | 'dust' | 'motes', box = { x0: 8, x1: 28, z0: 6, z1: 18 }): { x: number; y: number; z: number } {
  const h1 = (n: number): number => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const fx = h1(i + 1), fz = h1(i + 7.3), fy = h1(i + 3.1), sp = 0.15 + h1(i + 9) * 0.35;
  const up = kind === 'embers' || kind === 'bubbles' || kind === 'spores' ? 1 : kind === 'snow' || kind === 'leaves' ? -1 : 0;
  const ph = (fy + up * t * sp * 0.5 + 8) % 1;
  const y = 0.1 + ph * 3.2;
  const sway = Math.sin(t * 0.7 + i) * 0.5;
  return { x: box.x0 + ((fx * (box.x1 - box.x0) + sway + t * (kind === 'dust' ? 0.3 : 0.1) * sp * 2) % (box.x1 - box.x0) + (box.x1 - box.x0)) % (box.x1 - box.x0), y, z: box.z0 + fz * (box.z1 - box.z0) };
}
