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

export interface BallOpts { seg?: number; ring?: number; wob?: number; seed?: number; lo?: number; hi?: number; sway?: number }
export interface RBoxOpts { r?: number; top?: RGB; lo?: number; hi?: number; sway?: number }
export interface LatheOpts { seg?: number; lo?: number; hi?: number; sway?: number; rot?: number; topCol?: RGB; y?: number }

/** Ruido 3D suave y barato (0..1), determinista. */
export function wobble(x: number, y: number, z: number): number {
  return 0.5 + 0.25 * Math.sin(x * 2.1 + Math.sin(y * 1.7 + z)) + 0.15 * Math.sin(y * 3.3 - z * 1.9 + x * 0.8) + 0.1 * Math.sin(z * 4.1 + x * 2.6 - y);
}

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


  // ===================================================== primitivas suaves (normales por vértice)
  /** Vértice con normal explícita. */
  vtx(p: number[], n: number[], col: RGB, sway = 0): void {
    this.v.push(p[0]!, p[1]!, p[2]!, n[0]!, n[1]!, n[2]!, col[0], col[1], col[2], sway);
  }
  /** Triángulo con normales por vértice (sombreado suave). */
  triN(a: number[], b: number[], c: number[], na: number[], nb: number[], nc: number[], ca: RGB, cb: RGB, cc: RGB, sa = 0, sb = 0, sc = 0): this {
    this.vtx(a, na, ca, sa); this.vtx(b, nb, cb, sb); this.vtx(c, nc, cc, sc);
    return this;
  }
  /** Malla de rejilla (nu+1)x(nv+1) con vértices/normales/colores dados; cierra en U si `wrap`. */
  private grid(P: number[][], N: number[][], C: RGB[], S: number[], nu: number, nv: number): void {
    const id = (i: number, j: number): number => j * (nu + 1) + i;
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
        this.triN(P[a]!, P[b]!, P[c]!, N[a]!, N[b]!, N[c]!, C[a]!, C[b]!, C[c]!, S[a]!, S[b]!, S[c]!);
        this.triN(P[a]!, P[c]!, P[d]!, N[a]!, N[c]!, N[d]!, C[a]!, C[c]!, C[d]!, S[a]!, S[c]!, S[d]!);
      }
  }

  /**
   * Elipsoide suave (esfera achatada). `wob` deforma la silueta con ruido (rocas, follaje, nubes).
   * Color con degradado vertical (abajo más oscuro) para dar volumen sin texturas.
   */
  ball(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, col: RGB, o: BallOpts = {}): this {
    const nu = o.seg ?? 10, nv = o.ring ?? Math.max(4, Math.round(nu * 0.6));
    const wob = o.wob ?? 0, seed = o.seed ?? 1, lo = o.lo ?? 0.74, hi = o.hi ?? 1.1;
    const P: number[][] = [], N: number[][] = [], C: RGB[] = [], S: number[] = [];
    const dirAt = (u: number, v: number): [number, number, number] => {
      const th = u * Math.PI * 2, ph = (v - 0.5) * Math.PI, cp = Math.cos(ph);
      return [cp * Math.cos(th), Math.sin(ph), cp * Math.sin(th)];
    };
    const at = (u: number, v: number): number[] => {
      const d = dirAt(u, v);
      let k = 1;
      if (wob) k += wob * (wobble(d[0] * 1.9 + seed * 1.3, d[1] * 1.9 + seed * 0.7, d[2] * 1.9 - seed * 0.9) * 2 - 1);
      return [cx + d[0] * rx * k, cy + d[1] * ry * k, cz + d[2] * rz * k];
    };
    const e = 1e-3;
    for (let j = 0; j <= nv; j++)
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, v = j / nv;
        const p = at(u, v);
        let n: number[];
        if (!wob) {
          const d = dirAt(u, v);
          n = [d[0] / rx, d[1] / ry, d[2] / rz];
        } else {
          const vv = Math.min(1 - 2e-3, Math.max(2e-3, v));
          const a = at(u + e, vv), b = at(u - e, vv), c = at(u, vv + e), d = at(u, vv - e);
          const t1 = [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!], t2 = [c[0]! - d[0]!, c[1]! - d[1]!, c[2]! - d[2]!];
          n = [t1[1]! * t2[2]! - t1[2]! * t2[1]!, t1[2]! * t2[0]! - t1[0]! * t2[2]!, t1[0]! * t2[1]! - t1[1]! * t2[0]!];
          const dir = dirAt(u, v);
          if (n[0]! * dir[0] + n[1]! * dir[1] + n[2]! * dir[2] < 0) n = [-n[0]!, -n[1]!, -n[2]!];
          if (Math.hypot(n[0]!, n[1]!, n[2]!) < 1e-9) n = dir;
        }
        const l = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
        P.push(p); N.push([n[0]! / l, n[1]! / l, n[2]! / l]);
        const t = (p[1]! - (cy - ry)) / (2 * ry);
        const k = lo + (hi - lo) * Math.max(0, Math.min(1, t));
        C.push(shade(col, k));
        S.push(o.sway ? o.sway * Math.max(0, Math.min(1, t)) : 0);
      }
    this.grid(P, N, C, S, nu, nv);
    return this;
  }

  /**
   * Caja redondeada (apoyada en y) con radio de biselado `r`: normales exactas, cantos suaves.
   */
  rbox(x: number, y: number, z: number, w: number, h: number, d: number, col: RGB, o: RBoxOpts = {}): this {
    const a = w / 2, b = h / 2, c = d / 2;
    const r = Math.min(o.r ?? 0.06, a * 0.98, b * 0.98, c * 0.98);
    const cy = y + b;
    const samp = (hf: number): number[] => (r < 1e-4 ? [-hf, hf] : [-hf, -(hf - r) - 0.4 * r, -(hf - r), hf - r, hf - r + 0.4 * r, hf]);
    const sx = samp(a), sy = samp(b), sz = samp(c);
    const inner: [number, number, number] = [a - r, b - r, c - r];
    const lo = o.lo ?? 0.78, hi = o.hi ?? 1.08;
    const emit = (axis: 0 | 1 | 2, sign: number, A: number[], B: number[]): void => {
      const ax1 = (axis + 1) % 3, ax2 = (axis + 2) % 3;
      const half = [a, b, c];
      const P: number[][] = [], N: number[][] = [], C: RGB[] = [], S: number[] = [];
      for (let j = 0; j < B.length; j++)
        for (let i = 0; i < A.length; i++) {
          const p = [0, 0, 0];
          p[axis] = sign * half[axis]!;
          p[ax1] = A[i]!;
          p[ax2] = B[j]!;
          const q = [Math.max(-inner[0], Math.min(inner[0], p[0]!)), Math.max(-inner[1], Math.min(inner[1], p[1]!)), Math.max(-inner[2], Math.min(inner[2], p[2]!))];
          let n = [p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!];
          const l = Math.hypot(n[0]!, n[1]!, n[2]!);
          if (l < 1e-9) { n = [0, 0, 0]; n[axis] = sign; } else n = [n[0]! / l, n[1]! / l, n[2]! / l];
          const pos = r < 1e-4 ? p : [q[0]! + n[0]! * r, q[1]! + n[1]! * r, q[2]! + n[2]! * r];
          const t = (pos[1]! + b) / (2 * b);
          P.push([x + pos[0]!, cy + pos[1]!, z + pos[2]!]);
          N.push(n);
          const topC = o.top && n[1]! > 0.5 ? o.top : col;
          C.push(shade(topC, lo + (hi - lo) * Math.max(0, Math.min(1, t))));
          S.push(o.sway ? o.sway * Math.max(0, Math.min(1, t)) : 0);
        }
      const nu = A.length - 1, nv = B.length - 1;
      this.grid(P, N, C, S, nu, nv);
    };
    const s = [sx, sy, sz];
    for (const axis of [0, 1, 2] as const) for (const sign of [-1, 1]) emit(axis, sign, s[(axis + 1) % 3]!, s[(axis + 2) % 3]!);
    return this;
  }

  /**
   * Sólido de revolución con normales analíticas. `profile` = [radio, y, duro?]; un punto «duro»
   * conserva la arista (tapas, bordes); los demás se suavizan.
   */
  lathe(cx: number, cz: number, profile: Array<[number, number, boolean?]>, col: RGB, o: LatheOpts = {}): this {
    const seg = o.seg ?? 12, lo = o.lo ?? 0.78, hi = o.hi ?? 1.1;
    const nrm = (i: number): [number, number] => {
      const a = profile[i]!, b = profile[i + 1]!;
      const dr = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dr, dy) || 1;
      return [dy / l, -dr / l];
    };
    interface Ring { r: number; y: number; nr: number; ny: number }
    const rings: Ring[] = [];
    const link: boolean[] = [];
    const nSeg = profile.length - 1;
    const y0 = Math.min(...profile.map((p) => p[1])), y1 = Math.max(...profile.map((p) => p[1]));
    for (let i = 0; i <= nSeg; i++) {
      const p = profile[i]!;
      const prev = i > 0 ? nrm(i - 1) : null, next = i < nSeg ? nrm(i) : null;
      if (p[2] && prev && next) {
        rings.push({ r: p[0], y: p[1], nr: prev[0], ny: prev[1] });
        link.push(true);
        rings.push({ r: p[0], y: p[1], nr: next[0], ny: next[1] });
        link.push(false);
      } else {
        let nr: number, ny: number;
        if (prev && next) { nr = prev[0] + next[0]; ny = prev[1] + next[1]; } else { [nr, ny] = (prev ?? next)!; }
        const l = Math.hypot(nr, ny) || 1;
        rings.push({ r: p[0], y: p[1], nr: nr / l, ny: ny / l });
        link.push(true);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) {
      if (!link[k]) continue;
      const A = rings[k]!, B = rings[k + 1]!;
      for (let i = 0; i < seg; i++) {
        const t0 = o.rot ?? 0, a0 = t0 + (i / seg) * Math.PI * 2, a1 = t0 + ((i + 1) / seg) * Math.PI * 2;
        const v = (R: Ring, a: number): [number[], number[], RGB, number] => {
          const ca = Math.cos(a), sa = Math.sin(a);
          const t = y1 > y0 ? (R.y - y0) / (y1 - y0) : 0.5;
          const sw = o.sway ? o.sway * t : 0;
          return [[cx + ca * R.r, R.y + (o.y ?? 0), cz + sa * R.r], [R.nr * ca, R.ny, R.nr * sa], shade(o.topCol && t > 0.7 ? o.topCol : col, lo + (hi - lo) * t), sw];
        };
        const a = v(A, a0), b = v(A, a1), c = v(B, a1), d = v(B, a0);
        if (B.r > 1e-5 || A.r > 1e-5) {
          this.triN(a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2], a[3], b[3], c[3]);
          this.triN(a[0], c[0], d[0], a[1], c[1], d[1], a[2], c[2], d[2], a[3], c[3], d[3]);
        }
      }
    }
    return this;
  }

  /** Cápsula/tronco cónico redondeado entre dos puntos (miembros, ramas, postes). */
  limb(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r0: number, r1: number, col: RGB, o: LatheOpts = {}): this {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const L = Math.hypot(dx, dy, dz) || 1e-6;
    const from = this.count;
    const p: Array<[number, number]> = [];
    // casquete inferior
    for (const [k, c] of [[0, 1], [0.5, 0.87], [0.87, 0.5], [1, 0]] as const) p.push([r0 * k, -r0 * c]);
    // casquete superior (con la inclinación del cono, aproximada)
    for (const [k, c] of [[1, 0], [0.87, 0.5], [0.5, 0.87], [0, 1]] as const) p.push([r1 * k, L + r1 * c]);
    this.lathe(0, 0, p, col, { seg: o.seg ?? 8, lo: o.lo ?? 0.82, hi: o.hi ?? 1.06, ...(o.sway ? { sway: o.sway } : {}) });
    // orienta +y hacia (dx,dy,dz) y traslada a (x0,y0,z0)
    const ay = Math.acos(Math.max(-1, Math.min(1, dy / L)));
    const az = Math.atan2(dx, dz);
    this.rotate(from, ay, az, 0, 0, 0, x0, y0, z0, true);
    return this;
  }

  /**
   * Gira los vértices desde `from`: primero inclina `tilt` sobre X, luego gira `yaw` sobre Y (Ry·Rx) y
   * traslada. Con `limbMode`, `tilt` lleva +Y hacia la dirección y `yaw` es el rumbo (atan2(dx,dz)).
   */
  rotate(from: number, tilt: number, yaw: number, roll: number, px: number, py: number, dx = 0, dy = 0, dz = 0, _limb = false): this {
    const ct = Math.cos(tilt), st = Math.sin(tilt), cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
    const f = (x: number, y: number, z: number): [number, number, number] => {
      // roll (Z) → tilt (X) → yaw (Y)
      const a = x * cr - y * sr;
      let b = x * sr + y * cr, c = z;
      const b2 = b * ct - c * st, c2 = b * st + c * ct;
      b = b2; c = c2;
      return [a * cy + c * sy, b, -a * sy + c * cy];
    };
    for (let i = from * STRIDE; i < this.v.length; i += STRIDE) {
      const p = f(this.v[i]! - px, this.v[i + 1]! - py, this.v[i + 2]!);
      this.v[i] = p[0] + px + dx; this.v[i + 1] = p[1] + py + dy; this.v[i + 2] = p[2] + dz;
      const n = f(this.v[i + 3]!, this.v[i + 4]!, this.v[i + 5]!);
      this.v[i + 3] = n[0]; this.v[i + 4] = n[1]; this.v[i + 5] = n[2];
    }
    return this;
  }

  /** Cinta curva (hojas, hierba): ancho variable a lo largo de una curva dada por `pts`. */
  ribbon(pts: number[][], widths: number[], dir: [number, number, number], col: RGB, o: { colTip?: RGB; sway?: number } = {}): this {
    const n = pts.length;
    const P: number[][] = [], N: number[][] = [], C: RGB[] = [], S: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(n - 1, i + 1)]!;
      const t = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
      // lateral = t × dir (dir = hacia dónde mira la cara)
      let s = [t[1]! * dir[2] - t[2]! * dir[1], t[2]! * dir[0] - t[0]! * dir[2], t[0]! * dir[1] - t[1]! * dir[0]];
      const l = Math.hypot(s[0]!, s[1]!, s[2]!) || 1;
      s = [s[0]! / l, s[1]! / l, s[2]! / l];
      let nn = [s[1]! * t[2]! - s[2]! * t[1]!, s[2]! * t[0]! - s[0]! * t[2]!, s[0]! * t[1]! - s[1]! * t[0]!];
      const ln = Math.hypot(nn[0]!, nn[1]!, nn[2]!) || 1;
      nn = [nn[0]! / ln, nn[1]! / ln, nn[2]! / ln];
      const k = i / (n - 1), w = widths[i]!;
      const c = o.colTip ? mix(col, o.colTip, k) : shade(col, 0.8 + 0.3 * k);
      for (const sg of [-1, 1]) {
        P.push([pts[i]![0]! + s[0]! * w * sg, pts[i]![1]! + s[1]! * w * sg, pts[i]![2]! + s[2]! * w * sg]);
        N.push(nn);
        C.push(c);
        S.push((o.sway ?? 0) * k);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 3, d = a + 2;
      this.triN(P[a]!, P[b]!, P[c]!, N[a]!, N[b]!, N[c]!, C[a]!, C[b]!, C[c]!, S[a]!, S[b]!, S[c]!);
      this.triN(P[a]!, P[c]!, P[d]!, N[a]!, N[c]!, N[d]!, C[a]!, C[c]!, C[d]!, S[a]!, S[c]!, S[d]!);
    }
    return this;
  }

  /** Alisa las normales de todos los vértices que coinciden en posición (sombreado redondeado). */
  smooth(from = 0, eps = 0.002): this {
    const key = (x: number, y: number, z: number): string => `${Math.round(x / eps)},${Math.round(y / eps)},${Math.round(z / eps)}`;
    const acc = new Map<string, number[]>();
    for (let i = from * STRIDE; i < this.v.length; i += STRIDE) {
      const k = key(this.v[i]!, this.v[i + 1]!, this.v[i + 2]!);
      const a = acc.get(k) ?? [0, 0, 0];
      a[0]! += this.v[i + 3]!; a[1]! += this.v[i + 4]!; a[2]! += this.v[i + 5]!;
      acc.set(k, a);
    }
    for (let i = from * STRIDE; i < this.v.length; i += STRIDE) {
      const a = acc.get(key(this.v[i]!, this.v[i + 1]!, this.v[i + 2]!))!;
      const l = Math.hypot(a[0]!, a[1]!, a[2]!) || 1;
      this.v[i + 3] = a[0]! / l; this.v[i + 4] = a[1]! / l; this.v[i + 5] = a[2]! / l;
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
