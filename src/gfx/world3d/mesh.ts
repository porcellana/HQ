/**
 * Constructor de mallas low-poly (puro). Vértice = pos(3) normal(3) color(3) viento(1).
 * El «viento» (0..1) es cuánto se mece el vértice (sube con la altura en árboles y hierba).
 */
export const STRIDE = 10;

export function hexRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [1, 0, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export type RGB = [number, number, number];
export const shade = (c: RGB, k: number): RGB => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export class MeshBuilder {
  readonly v: number[] = [];

  get count(): number {
    return this.v.length / STRIDE;
  }

  /** Triángulo con normal plana (sentido antihorario = cara visible). */
  tri(a: number[], b: number[], c: number[], col: RGB, sa = 0, sb = 0, sc = 0, ca?: RGB, cb?: RGB, cc?: RGB): this {
    const ux = b[0]! - a[0]!, uy = b[1]! - a[1]!, uz = b[2]! - a[2]!;
    const vx = c[0]! - a[0]!, vy = c[1]! - a[1]!, vz = c[2]! - a[2]!;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const p = (q: number[], s: number, k?: RGB) => {
      const cc2 = k ?? col;
      this.v.push(q[0]!, q[1]!, q[2]!, nx, ny, nz, cc2[0], cc2[1], cc2[2], s);
    };
    p(a, sa, ca); p(b, sb, cb); p(c, sc, cc);
    return this;
  }

  /** Cuadrilátero a,b,c,d (antihorario). */
  quad(a: number[], b: number[], c: number[], d: number[], col: RGB, sw: [number, number, number, number] = [0, 0, 0, 0], cols?: [RGB, RGB, RGB, RGB]): this {
    this.tri(a, b, c, col, sw[0], sw[1], sw[2], cols?.[0], cols?.[1], cols?.[2]);
    this.tri(a, c, d, col, sw[0], sw[2], sw[3], cols?.[0], cols?.[2], cols?.[3]);
    return this;
  }

  /** Caja centrada en (x, y+h/2, z) apoyada en y. `sway` aplica viento proporcional a la altura. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, col: RGB, sway = 0, topCol?: RGB): this {
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y, y1 = y + h, z0 = z - d / 2, z1 = z + d / 2;
    const s0 = 0, s1 = sway;
    const side = shade(col, 0.82), side2 = shade(col, 0.68);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, [s0, s0, s1, s1]);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side2, [s0, s0, s1, s1]);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side, [s0, s0, s1, s1]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side, [s0, s0, s1, s1]);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], topCol ?? shade(col, 1.12), [s1, s1, s1, s1]);
    return this;
  }

  /** Tronco/cono con `n` lados desde y hasta y+h (radios rb y rt). */
  cyl(x: number, y: number, z: number, rb: number, rt: number, h: number, col: RGB, n = 6, sway = 0, cap = true, rot = 0): this {
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2;
      const k = shade(col, 0.74 + 0.4 * Math.max(0, Math.cos((a0 + a1) / 2 - 0.9)));
      const p00 = [x + Math.cos(a0) * rb, y, z + Math.sin(a0) * rb];
      const p10 = [x + Math.cos(a1) * rb, y, z + Math.sin(a1) * rb];
      const p11 = [x + Math.cos(a1) * rt, y + h, z + Math.sin(a1) * rt];
      const p01 = [x + Math.cos(a0) * rt, y + h, z + Math.sin(a0) * rt];
      if (rt < 0.001) this.tri(p10, p01, p00, k, 0, sway, 0);
      else this.quad(p10, p11, p01, p00, k, [0, sway, sway, 0]);
      if (cap && rt > 0.001) this.tri([x, y + h, z], p01, p11, shade(col, 1.15), sway, sway, sway);
    }
    return this;
  }

  /** Piedra/poliedro irregular: anillo central con 'n' vértices y dos cúspides. */
  rock(x: number, y: number, z: number, rx: number, ry: number, rz: number, col: RGB, seed = 1, n = 6): this {
    const ring: number[][] = [];
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
      const k = 0.78 + rnd() * 0.4;
      ring.push([x + Math.cos(a) * rx * k, y + ry * (0.35 + rnd() * 0.2), z + Math.sin(a) * rz * k]);
    }
    const top = [x + (rnd() - 0.5) * rx * 0.4, y + ry, z + (rnd() - 0.5) * rz * 0.4];
    for (let i = 0; i < n; i++) {
      const a = ring[i]!, b = ring[(i + 1) % n]!;
      const light = 0.78 + 0.35 * rnd();
      this.tri(b, top, a, shade(col, light + 0.1));
      this.tri(a, [a[0]!, y, a[2]!], [b[0]!, y, b[2]!], shade(col, 0.7));
      this.tri(a, [b[0]!, y, b[2]!], b, shade(col, light * 0.9));
      this.tri([a[0]!, y, a[2]!], [b[0]!, y, b[2]!], [x, y, z], shade(col, 0.5));
    }
    return this;
  }

  /** Copia otra malla aplicando una transformación (traslación, giro Y y escala). */
  append(o: MeshBuilder | number[], dx = 0, dy = 0, dz = 0, ry = 0, s = 1): this {
    const src = Array.isArray(o) ? o : o.v;
    const c = Math.cos(ry), sn = Math.sin(ry);
    for (let i = 0; i < src.length; i += STRIDE) {
      const px = src[i]! * s, py = src[i + 1]! * s, pz = src[i + 2]! * s;
      const nx = src[i + 3]!, nz = src[i + 5]!;
      this.v.push(px * c + pz * sn + dx, py + dy, -px * sn + pz * c + dz, nx * c + nz * sn, src[i + 4]!, -nx * sn + nz * c, src[i + 6]!, src[i + 7]!, src[i + 8]!, src[i + 9]!);
    }
    return this;
  }

  toArray(): Float32Array {
    return new Float32Array(this.v);
  }
}

/** Hash determinista 0..1 por casilla y sal. */
export function hash2(x: number, y: number, salt = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Ruido de valor suave (0..1). */
export function vnoise(x: number, y: number, salt = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, salt), b = hash2(xi + 1, yi, salt), c = hash2(xi, yi + 1, salt), d = hash2(xi + 1, yi + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
