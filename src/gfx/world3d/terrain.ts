/**
 * Terreno 3D a partir de una rejilla de casillas (puro: sin WebGL ni DOM, testeable).
 * Cada casilla = 1x1 unidades. Relieve suave por vértices, bloques (muros, tejados),
 * montañas por altura, agua derivada de la altura y objetos como instancias por modelo.
 */
import { MeshBuilder, hexRgb, hash2, mix, shade, vnoise, type RGB } from './mesh';

export interface Grid3D {
  width: number;
  height: number;
  /** Id del sprite de la casilla (src/data/config/tiles.ts). */
  sprite(x: number, y: number): string;
  kind: string;
  seed: number;
  tint?: { color: string; alpha: number } | undefined;
}

export type TileClass = 'ground' | 'water' | 'wall' | 'mount' | 'roof' | 'deck';
export interface T3 {
  c: TileClass;
  col: string;
  /** Modelo instanciado sobre la casilla. */
  obj?: string;
  /** Color del suelo bajo el objeto. */
  under?: string;
  /** Altura de bloque (muros). */
  h?: number;
}

const G = '#5f8f3e', SN = '#eef3fa', SA = '#d6bc7c';
export const TILE3D: Record<string, T3> = {
  grass: { c: 'ground', col: G }, flowers: { c: 'ground', col: '#66963f', obj: 'flowers' },
  dirt: { c: 'ground', col: '#8f6e46' }, cobble: { c: 'ground', col: '#8f8c92' }, stoneFloor: { c: 'ground', col: '#6f6b7a' },
  woodFloor: { c: 'ground', col: '#9c6d40' }, carpet: { c: 'ground', col: '#a03c3c' }, sand: { c: 'ground', col: SA },
  snow: { c: 'ground', col: SN }, ice: { c: 'ground', col: '#a9d6ee' }, mud: { c: 'ground', col: '#5e4d30' },
  gravel: { c: 'ground', col: '#8d897f' }, caveFloor: { c: 'ground', col: '#5d5247' }, silkFloor: { c: 'ground', col: '#8d8996' },
  cryptFloor: { c: 'ground', col: '#4f4a60' },
  water: { c: 'water', col: '#2f6f9a' }, swampWater: { c: 'water', col: '#3f6a4c' },
  bridge: { c: 'deck', col: '#8e6b3f' }, dock: { c: 'deck', col: '#8e6b3f' },
  stoneWall: { c: 'wall', col: '#8b8895', h: 1.3 }, caveWall: { c: 'wall', col: '#5a4d40', h: 1.45 }, silkWall: { c: 'wall', col: '#716c7c', h: 1.4 },
  cryptWall: { c: 'wall', col: '#433f58', h: 1.4 }, woodWall: { c: 'wall', col: '#b08760', h: 1.0 },
  roof: { c: 'roof', col: '#b4493d' }, roofSlate: { c: 'roof', col: '#566a92' },
  crag: { c: 'mount', col: '#7f7a86' },
  tree: { c: 'ground', col: G, obj: 'tree' }, pine: { c: 'ground', col: '#4f7f3a', obj: 'pine' }, snowPine: { c: 'ground', col: SN, obj: 'snowpine' },
  palm: { c: 'ground', col: SA, obj: 'palm' }, deadTree: { c: 'ground', col: '#6a5a3a', obj: 'dead' }, cactus: { c: 'ground', col: SA, obj: 'cactus' },
  bush: { c: 'ground', col: G, obj: 'bush' }, rock: { c: 'ground', col: '#74704f', obj: 'rock' },
  well: { c: 'ground', col: '#8f8c92', obj: 'well' }, sign: { c: 'ground', col: G, obj: 'sign' }, lamp: { c: 'ground', col: G, obj: 'lamp' },
  grave: { c: 'ground', col: '#6a6a50', obj: 'grave' }, streetLamp: { c: 'ground', col: '#8f8c92', obj: 'streetlamp' },
  fence: { c: 'ground', col: G, obj: 'fence' }, door: { c: 'ground', col: '#9c6d40', obj: 'doorframe' },
  cave: { c: 'ground', col: '#3c342c', obj: 'cave' }, stairsDown: { c: 'ground', col: '#4a4450', obj: 'stairsDown' }, stairsUp: { c: 'ground', col: '#6a6470', obj: 'stairsUp' },
  counter: { c: 'ground', col: '#9c6d40', obj: 'counter' }, table: { c: 'ground', col: '#9c6d40', obj: 'table' }, barrel: { c: 'ground', col: '#9c6d40', obj: 'barrel' },
  shelf: { c: 'ground', col: '#9c6d40', obj: 'shelf' }, altar: { c: 'ground', col: '#6f6b7a', obj: 'altar' }, hearth: { c: 'ground', col: '#6f6b7a', obj: 'hearth' },
  bed: { c: 'ground', col: '#9c6d40', obj: 'bed' }, anvil: { c: 'ground', col: '#6f6b7a', obj: 'anvil' },
  tent: { c: 'ground', col: G, obj: 'tent' }, campfire: { c: 'ground', col: '#6a5a3a', obj: 'campfire' },
};

export const FALLBACK_T3: T3 = { c: 'ground', col: '#777777' };
export const t3 = (sprite: string): T3 => TILE3D[sprite] ?? FALLBACK_T3;

export const CHUNK = 16;
export const WATER_Y = -0.12;
const WATER_H = -0.52;

export interface Light { x: number; y: number; z: number; r: number; g: number; b: number; rad: number }
export interface ChunkData {
  cx: number; cz: number;
  terrain: Float32Array;
  water: Float32Array;
  /** Instancias por modelo: x,y,z,giro,escala,r,g,b. */
  inst: Map<string, number[]>;
  lights: Light[];
}

/** Rejilla procesada: alturas por vértice, profundidad de montañas, etc. */
export class Geo {
  readonly w: number;
  readonly h: number;
  readonly cls: Uint8Array;
  readonly sp: string[];
  readonly vh: Float32Array;
  readonly mdepth: Uint8Array;
  readonly amp: number;
  readonly snowy: boolean;
  static readonly C: TileClass[] = ['ground', 'water', 'wall', 'mount', 'roof', 'deck'];

  constructor(readonly g: Grid3D) {
    this.w = g.width;
    this.h = g.height;
    this.cls = new Uint8Array(this.w * this.h);
    this.sp = new Array<string>(this.w * this.h);
    let snow = 0;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const s = g.sprite(x, y);
        this.sp[y * this.w + x] = s;
        this.cls[y * this.w + x] = Geo.C.indexOf(t3(s).c);
        if (s === 'snow' || s === 'snowPine' || s === 'ice') snow++;
      }
    this.snowy = snow / (this.w * this.h) > 0.12;
    this.amp = g.kind === 'wild' || g.kind === 'world' ? 0.5 : g.kind === 'town' ? 0.14 : 0;
    this.mdepth = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.klass(x, y) !== 'mount') continue;
        let d = 3;
        for (let r = 1; r <= 3 && d === 3; r++)
          for (let dy = -r; dy <= r && d === 3; dy++)
            for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && this.klass(x + dx, y + dy) !== 'mount') { d = r - 1; break; }
        this.mdepth[y * this.w + x] = d;
      }
    this.vh = new Float32Array((this.w + 1) * (this.h + 1));
    for (let vy = 0; vy <= this.h; vy++)
      for (let vx = 0; vx <= this.w; vx++) {
        let s = 0;
        for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) s += this.tileH(Math.min(this.w - 1, Math.max(0, vx + ox!)), Math.min(this.h - 1, Math.max(0, vy + oy!)));
        this.vh[vy * (this.w + 1) + vx] = s / 4;
      }
  }

  klass(x: number, y: number): TileClass | 'out' {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 'out';
    return Geo.C[this.cls[y * this.w + x]!]!;
  }
  spriteAt(x: number, y: number): string {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? '' : this.sp[y * this.w + x]!;
  }
  /** Altura base que aporta una casilla a sus vértices. */
  private tileH(x: number, y: number): number {
    const k = this.klass(x, y);
    if (k === 'water') return this.spriteAt(x, y) === 'swampWater' ? -0.4 : WATER_H;
    if (k === 'mount') return 0.7 + 0.62 * this.mdepth[y * this.w + x]! + vnoise(x * 0.8, y * 0.8, 7) * 0.5;
    const s = this.spriteAt(x, y);
    const flat = s === 'cobble' || s === 'woodFloor' || s === 'carpet' || s === 'stoneFloor' || s === 'dock' || s === 'bridge';
    if (this.amp === 0 || flat) return flat && this.klass(x, y) !== 'deck' ? 0 : 0.01;
    const n = vnoise(x * 0.11, y * 0.11, this.g.seed) * 0.75 + vnoise(x * 0.3, y * 0.3, this.g.seed + 5) * 0.25;
    return (n - 0.45) * this.amp * 1.6 + (s === 'dirt' ? -0.04 : 0);
  }
  vert(vx: number, vy: number): number {
    return this.vh[vy * (this.w + 1) + vx]!;
  }
  /** Altura del suelo en coordenadas continuas (casilla i ocupa [i, i+1]). */
  heightAt(x: number, z: number): number {
    const fx = Math.min(this.w, Math.max(0, x)), fz = Math.min(this.h, Math.max(0, z));
    const x0 = Math.min(this.w - 1, Math.floor(fx)), z0 = Math.min(this.h - 1, Math.floor(fz));
    const tx0 = fx - x0, tz0 = fz - z0;
    const tx = tx0 * tx0 * (3 - 2 * tx0), tz = tz0 * tz0 * (3 - 2 * tz0);
    const a = this.vert(x0, z0), b = this.vert(x0 + 1, z0), c = this.vert(x0, z0 + 1), d = this.vert(x0 + 1, z0 + 1);
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  }
  isBlock(x: number, y: number): boolean {
    const k = this.klass(x, y);
    return k === 'wall' || k === 'roof';
  }
  /** Alturas de las esquinas superiores de un bloque: [x0z0, x1z0, x1z1, x0z1]. */
  cornerTops(x: number, y: number): [number, number, number, number] {
    const k = this.klass(x, y);
    const v = [this.vert(x, y), this.vert(x + 1, y), this.vert(x + 1, y + 1), this.vert(x, y + 1)] as const;
    if (k === 'roof') {
      let n = 0, s = 0;
      while (this.klass(x, y - 1 - n) === 'roof') n++;
      while (this.klass(x, y + 1 + s) === 'roof') s++;
      const rows = n + s + 1, peak = Math.max(1, rows / 2);
      const prof = (p: number): number => 0.98 + 0.46 * (Math.min(p, rows - p, peak) / peak);
      const a = prof(n), b = prof(n + 1);
      return [v[0] + a, v[1] + a, v[2] + b, v[3] + b];
    }
    const sp = this.spriteAt(x, y);
    const hh = t3(sp).h ?? 1.2;
    const jit = sp === 'caveWall' ? 0.5 : sp === 'woodWall' ? 0 : 0.2;
    const j = (cx: number, cy: number): number => (hash2(cx, cy, 3) - 0.5) * jit;
    return [v[0] + hh + j(x, y), v[1] + hh + j(x + 1, y), v[2] + hh + j(x + 1, y + 1), v[3] + hh + j(x, y + 1)];
  }
}

// ------------------------------------------------------------------ colores
const C = (h: string): RGB => hexRgb(h);
const cache = new Map<string, RGB>();
const col = (h: string): RGB => {
  let c = cache.get(h);
  if (!c) cache.set(h, (c = C(h)));
  return c;
};
const PLASTER = C('#d8c9ac'), WET = C('#6f6044'), BED = C('#4d6a66');
const TREE_LIKE = new Set(['tree', 'pine', 'snowpine', 'palm', 'dead']);

function groundColor(geo: Geo, x: number, y: number, vyh: number): RGB {
  const k = geo.klass(x, y);
  const sp = geo.spriteAt(x, y);
  if (k === 'out') return col('#3a3a3a');
  if (k === 'water' || k === 'deck') return BED;
  if (k === 'wall') return col('#5d5a66');
  if (k === 'roof') return col(G);
  if (k === 'mount') {
    const rock = col(t3(sp).col);
    const low = col(geo.snowy ? SN : G);
    const hi = geo.snowy ? col(SN) : shade(rock, 1.18);
    const m = mix(low, rock, Math.min(1, Math.max(0, (vyh - 0.2) / 0.8)));
    return mix(m, hi, Math.min(1, Math.max(0, (vyh - 1.9) / 0.9)));
  }
  return col(t3(sp).col);
}

function occlusion(geo: Geo, x: number, y: number): number {
  const k = geo.klass(x, y);
  if (k === 'wall' || k === 'roof') return 1;
  if (k === 'ground') {
    const o = t3(geo.spriteAt(x, y)).obj;
    if (o) return TREE_LIKE.has(o) ? 0.6 : 0.22;
  }
  return 0;
}

export interface BuildOpts { density: number }

export function buildChunk(geo: Geo, cx: number, cz: number, opts: BuildOpts = { density: 1 }): ChunkData {
  const T = new MeshBuilder(), Wm = new MeshBuilder();
  const inst = new Map<string, number[]>();
  const lights: Light[] = [];
  const addInst = (id: string, x: number, y: number, z: number, rot: number, sc: number, c: RGB = [1, 1, 1]): void => {
    let a = inst.get(id);
    if (!a) inst.set(id, (a = []));
    a.push(x, y, z, rot, sc, c[0], c[1], c[2]);
  };
  const x0 = cx * CHUNK, y0 = cz * CHUNK;
  const x1 = Math.min(geo.w, x0 + CHUNK), y1 = Math.min(geo.h, y0 + CHUNK);
  const outdoor = geo.g.kind === 'town' || geo.g.kind === 'wild' || geo.g.kind === 'world';
  const dens = opts.density;

  // Color y oclusión por vértice (con las 4 casillas que lo rodean).
  const vcolor = (vx: number, vy: number, own: RGB, ownW: number): RGB => {
    let r = 0, g = 0, b = 0, occ = 0, wat = 0, n = 0;
    for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
      const tx = vx + ox!, ty = vy + oy!;
      const c = groundColor(geo, tx, ty, geo.vert(vx, vy));
      r += c[0]; g += c[1]; b += c[2]; n++;
      occ += occlusion(geo, tx, ty);
      if (geo.klass(tx, ty) === 'water') wat++;
    }
    let c: RGB = [r / n, g / n, b / n];
    c = mix(c, own, ownW);
    if (wat > 0 && wat < 4) c = mix(c, WET, 0.35 * (wat / 4) + 0.1);
    const o = occ / n;
    return shade(c, 1 - 0.4 * o);
  };

  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const k = geo.klass(x, y);
      const sp = geo.spriteAt(x, y);
      const def = t3(sp);
      const hv = [geo.vert(x, y), geo.vert(x + 1, y), geo.vert(x + 1, y + 1), geo.vert(x, y + 1)];

      if (k === 'ground' || k === 'mount' || k === 'water' || k === 'deck') {
        const own = k === 'mount' ? groundColor(geo, x, y, (hv[0]! + hv[1]! + hv[2]! + hv[3]!) / 4) : groundColor(geo, x, y, 0);
        const own1 = k === 'ground' ? 0.5 : 0.25;
        const cc = [vcolor(x, y, own, own1), vcolor(x + 1, y, own, own1), vcolor(x + 1, y + 1, own, own1), vcolor(x, y + 1, own, own1)] as [RGB, RGB, RGB, RGB];
        // Subdivisión suave: alturas con interpolación curva y normales del relieve (sin facetas).
        const SUB = geo.amp > 0 || k === 'mount' ? 3 : 1;
        const gv: Array<{ p: number[]; n: number[]; c: RGB }> = [];
        const e = 0.18;
        for (let j = 0; j <= SUB; j++)
          for (let i = 0; i <= SUB; i++) {
            const u = i / SUB, v = j / SUB, px = x + u, pz = y + v;
            const ph = SUB === 1 ? hv[0]! + (hv[1]! - hv[0]!) * u + (hv[3]! - hv[0]!) * v + (hv[0]! - hv[1]! - hv[3]! + hv[2]!) * u * v : geo.heightAt(px, pz);
            let n = [0, 1, 0];
            if (SUB > 1) {
              const gx = geo.heightAt(px + e, pz) - geo.heightAt(px - e, pz), gz = geo.heightAt(px, pz + e) - geo.heightAt(px, pz - e);
              const l = Math.hypot(gx, 2 * e, gz);
              n = [-gx / l, (2 * e) / l, -gz / l];
            }
            const bl = mix(mix(cc[0], cc[1], u), mix(cc[3], cc[2], u), v);
            const patch = k === 'ground' && geo.amp > 0 ? 0.93 + 0.14 * vnoise(px * 0.45, pz * 0.45, geo.g.seed + 3) : 0.97 + 0.06 * hash2(x, y, 11);
            gv.push({ p: [px, ph, pz], n, c: shade(bl, patch) });
          }
        const gi = (i: number, j: number): { p: number[]; n: number[]; c: RGB } => gv[j * (SUB + 1) + i]!;
        for (let j = 0; j < SUB; j++)
          for (let i = 0; i < SUB; i++) {
            const A = gi(i, j), Bq = gi(i + 1, j), Cq = gi(i + 1, j + 1), D = gi(i, j + 1);
            if (((x + y + i + j) & 1) === 0) {
              T.triN(A.p, D.p, Cq.p, A.n, D.n, Cq.n, A.c, D.c, Cq.c);
              T.triN(A.p, Cq.p, Bq.p, A.n, Cq.n, Bq.n, A.c, Cq.c, Bq.c);
            } else {
              T.triN(A.p, D.p, Bq.p, A.n, D.n, Bq.n, A.c, D.c, Bq.c);
              T.triN(Bq.p, D.p, Cq.p, Bq.n, D.n, Cq.n, Bq.c, D.c, Cq.c);
            }
          }
        // Agua: cubre las casillas con alguna esquina bajo el nivel del agua.
        if (hv.some((h) => h < WATER_Y)) {
          const wc = col(k === 'water' ? def.col : geo.klass(x - 1, y) === 'water' ? t3(geo.spriteAt(x - 1, y)).col : geo.klass(x + 1, y) === 'water' ? t3(geo.spriteAt(x + 1, y)).col : geo.klass(x, y - 1) === 'water' ? t3(geo.spriteAt(x, y - 1)).col : t3(geo.spriteAt(x, y + 1)).col);
          const sh = hv.map((h) => Math.min(1, Math.max(0, (WATER_Y - h) / 0.38)));
          const wp = [[x, WATER_Y, y], [x, WATER_Y, y + 1], [x + 1, WATER_Y, y + 1], [x + 1, WATER_Y, y]];
          Wm.quad(wp[0]!, wp[1]!, wp[2]!, wp[3]!, wc, [sh[0]!, sh[3]!, sh[2]!, sh[1]!]);
        }
        if (k === 'deck') {
          const horiz = geo.klass(x - 1, y) === 'deck' || geo.klass(x + 1, y) === 'deck' || (geo.klass(x, y - 1) !== 'deck' && geo.klass(x, y + 1) !== 'deck' && geo.klass(x - 1, y) !== 'water');
          const dc = col(def.col);
          const dy = 0.05;
          for (let i = 0; i < 4; i++) {
            const c = shade(dc, 0.88 + 0.2 * hash2(x * 4 + i, y, 5));
            if (horiz) T.quad([x, dy, y + i / 4], [x, dy, y + (i + 1) / 4 - 0.01], [x + 1, dy, y + (i + 1) / 4 - 0.01], [x + 1, dy, y + i / 4], c);
            else T.quad([x + i / 4, dy, y], [x + i / 4, dy, y + 1], [x + (i + 1) / 4 - 0.01, dy, y + 1], [x + (i + 1) / 4 - 0.01, dy, y], c);
          }
          // Barandillas sobre el agua.
          for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
            if (geo.klass(x + dx!, y + dz!) !== 'water') continue;
            const px = x + 0.5 + dx! * 0.46, pz = y + 0.5 + dz! * 0.46;
            T.box(px, dy, pz, dx === 0 ? 0.92 : 0.06, 0.07, dz === 0 ? 0.92 : 0.06, shade(dc, 0.75));
            for (const o of [-0.4, 0.4]) T.box(px + (dx === 0 ? o : 0), dy, pz + (dz === 0 ? o : 0), 0.07, 0.34, 0.07, shade(dc, 0.62));
          }
        }
        // --- objetos e instancias sobre el suelo
        const gy = geo.heightAt(x + 0.5, y + 0.5);
        const h1 = hash2(x, y, 21), h2 = hash2(x, y, 22), h3 = hash2(x, y, 23);
        if (k === 'ground') {
          if (def.obj) placeObject(geo, def.obj, x, y, gy, h1, h2, h3, addInst, lights);
          else {
            if (outdoor && (sp === 'grass' || sp === 'flowers') && h1 < 0.7 * dens) {
              const n = h2 < 0.35 && dens > 0.6 ? 2 : 1;
              for (let i = 0; i < n; i++) addInst('tuft', x + 0.15 + hash2(x, y, 30 + i) * 0.7, gy, y + 0.15 + hash2(x, y, 40 + i) * 0.7, h3 * 6.28, 0.8 + h2 * 0.6, [0.9 + h3 * 0.2, 0.9 + h1 * 0.2, 0.9]);
            }
            if ((sp === 'dirt' || sp === 'gravel' || sp === 'mud') && h1 < 0.18 * dens) addInst('pebble', x + h2, gy, y + h3, h1 * 20, 0.6 + h2 * 0.8);
            if (sp === 'snow' && h1 < 0.07 * dens) addInst('pebble', x + h2, gy, y + h3, h1 * 20, 0.7, [0.9, 0.95, 1]);
            if (sp === 'caveFloor' && h1 < 0.05 * dens) addInst('pebble', x + h2, gy, y + h3, h1 * 20, 0.8);
            if (sp === 'caveFloor' && h2 < 0.012) {
              addInst('crystal', x + 0.5, gy, y + 0.5, h3 * 6, 0.8 + h1);
              lights.push({ x: x + 0.5, y: gy + 0.4, z: y + 0.5, r: 0.3, g: 0.8, b: 1, rad: 3.2 });
            }
            const nearWater = geo.klass(x - 1, y) === 'water' || geo.klass(x + 1, y) === 'water' || geo.klass(x, y - 1) === 'water' || geo.klass(x, y + 1) === 'water';
            if (nearWater && h1 < 0.55 * dens && outdoor) addInst('reed', x + 0.2 + h2 * 0.6, gy - 0.05, y + 0.2 + h3 * 0.6, h1 * 9, 0.8 + h3 * 0.7);
            if (sp === 'mud' && h2 < 0.06 * dens) addInst('mushroom', x + h1, gy, y + h3, h2 * 9, 0.8 + h1 * 0.5);
          }
        } else if (k === 'water' && hv.every((h) => h < WATER_Y - 0.1) && h1 < 0.08 * dens) addInst('lily', x + 0.5, WATER_Y + 0.01, y + 0.5, h2 * 6, 0.8 + h3 * 0.5);
        continue;
      }

      // --- bloques: muros y tejados
      // La roca maciza (sin ningún suelo alrededor) no se dibuja: así los pasillos quedan rodeados de sombra.
      if (k === 'wall' && geo.g.kind !== 'town') {
        let open = false;
        for (let dy = -1; dy <= 1 && !open; dy++) for (let dx = -1; dx <= 1; dx++) { const kk = geo.klass(x + dx, y + dy); if (kk !== 'wall' && kk !== 'roof' && kk !== 'out') { open = true; break; } }
        if (!open) continue;
      }
      const tops = geo.cornerTops(x, y);
      const base = col(def.col);
      const topCol = k === 'roof' ? shade(base, 0.95 + 0.1 * hash2(x, y, 9)) : shade(base, geo.g.kind === 'town' ? 1.15 : 0.92);
      // Aristas libres (sin bloque vecino): norte, sur, oeste, este. Se biselan y se redondean con normales.
      const B = sp === 'caveWall' ? 0.24 : sp === 'woodWall' || k === 'roof' ? 0.07 : 0.12;
      const free = { n: !geo.isBlock(x, y - 1), s: !geo.isBlock(x, y + 1), w: !geo.isBlock(x - 1, y), e: !geo.isBlock(x + 1, y) };
      // Esquinas: NO, NE, SE, SO; cada una toca dos aristas.
      const cn: Array<{ cx: number; cz: number; a: boolean; b: boolean; ax: number; az: number; bx: number; bz: number }> = [
        { cx: x, cz: y, a: free.n, b: free.w, ax: 0, az: -1, bx: -1, bz: 0 },
        { cx: x + 1, cz: y, a: free.n, b: free.e, ax: 0, az: -1, bx: 1, bz: 0 },
        { cx: x + 1, cz: y + 1, a: free.s, b: free.e, ax: 0, az: 1, bx: 1, bz: 0 },
        { cx: x, cz: y + 1, a: free.s, b: free.w, ax: 0, az: 1, bx: -1, bz: 0 },
      ];
      const outOf = (i: number): [number, number] => {
        const q = cn[i]!;
        let ox = 0, oz = 0;
        if (q.a) { ox += q.ax; oz += q.az; }
        if (q.b) { ox += q.bx; oz += q.bz; }
        const l = Math.hypot(ox, oz);
        return l > 0 ? [ox / l, oz / l] : [0, 0];
      };
      const topV = cn.map((q, i) => {
        let ix = 0, iz = 0;
        if (q.a) { ix -= q.ax * B; iz -= q.az * B; }
        if (q.b) { ix -= q.bx * B; iz -= q.bz * B; }
        const [ox, oz] = outOf(i);
        const nl = Math.hypot(ox * 0.6, 1, oz * 0.6);
        return { p: [q.cx + ix, tops[i]!, q.cz + iz], n: [(ox * 0.6) / nl, 1 / nl, (oz * 0.6) / nl], bev: Math.hypot(ox, oz) > 0 };
      });
      // Normal real del plano de la cara (los tejados tienen pendiente) mezclada con el redondeo de los bordes.
      {
        const p0 = topV[0]!.p, p1 = topV[1]!.p, p3 = topV[3]!.p;
        const e1 = [p1[0]! - p0[0]!, p1[1]! - p0[1]!, p1[2]! - p0[2]!], e2 = [p3[0]! - p0[0]!, p3[1]! - p0[1]!, p3[2]! - p0[2]!];
        let pn = [e2[1]! * e1[2]! - e2[2]! * e1[1]!, e2[2]! * e1[0]! - e2[0]! * e1[2]!, e2[0]! * e1[1]! - e2[1]! * e1[0]!];
        const pl = Math.hypot(pn[0]!, pn[1]!, pn[2]!) || 1;
        pn = [pn[0]! / pl, pn[1]! / pl, pn[2]! / pl];
        for (const v of topV) {
          const nx = v.n[0]! * 0.5 + pn[0]!, ny = v.n[1]! * 0.5 + pn[1]!, nz = v.n[2]! * 0.5 + pn[2]!, l = Math.hypot(nx, ny, nz) || 1;
          v.n = [nx / l, ny / l, nz / l];
        }
      }
      if (k === 'roof') {
        // Tejas: franjas con un tono alterno suave (de norte a sur) en vez de un plano liso.
        const S = 4;
        const lerp3 = (a: number[], b: number[], u: number): number[] => [a[0]! + (b[0]! - a[0]!) * u, a[1]! + (b[1]! - a[1]!) * u, a[2]! + (b[2]! - a[2]!) * u];
        for (let i = 0; i < S; i++) {
          const u0 = i / S, u1 = (i + 1) / S;
          const cs = shade(topCol, i % 2 ? 1.05 : 0.93);
          const cs2 = shade(topCol, i % 2 ? 0.93 : 1.05);
          const a = lerp3(topV[0]!.p, topV[3]!.p, u0), b = lerp3(topV[1]!.p, topV[2]!.p, u0), c2 = lerp3(topV[1]!.p, topV[2]!.p, u1), d = lerp3(topV[0]!.p, topV[3]!.p, u1);
          const na = lerp3(topV[0]!.n, topV[3]!.n, u0), nb = lerp3(topV[1]!.n, topV[2]!.n, u0), nc = lerp3(topV[1]!.n, topV[2]!.n, u1), nd = lerp3(topV[0]!.n, topV[3]!.n, u1);
          T.triN(a, d, c2, na, nd, nc, cs, cs2, cs2);
          T.triN(a, c2, b, na, nc, nb, cs, cs2, cs);
        }
      } else {
        T.triN(topV[0]!.p, topV[3]!.p, topV[2]!.p, topV[0]!.n, topV[3]!.n, topV[2]!.n, topCol, topCol, topCol);
        T.triN(topV[0]!.p, topV[2]!.p, topV[1]!.p, topV[0]!.n, topV[2]!.n, topV[1]!.n, topCol, topCol, topCol);
      }
      if (k === 'roof') {
        if (hash2(x, y, 4) > 0.86 && geo.klass(x, y - 1) === 'roof') addInst('chimney', x + 0.5, (tops[0] + tops[3]) / 2 + 0.05, y + 0.5, 0, 1);
      }
      // Lados: hasta la altura del vecino o del suelo; el borde superior baja un bisel con normal suave.
      const edges: Array<[number, number, number, number, number, number, number, number, boolean]> = [
        [0, -1, x, y, x + 1, y, 0, 1, free.n], [0, 1, x + 1, y + 1, x, y + 1, 2, 3, free.s], [-1, 0, x, y + 1, x, y, 3, 0, free.w], [1, 0, x + 1, y, x + 1, y + 1, 1, 2, free.e],
      ];
      for (const [dx, dz, ax, az, bx, bz, ia, ib, fr] of edges) {
        const nx = x + dx, ny = y + dz;
        const ta = tops[ia]!, tb = tops[ib]!;
        let la: number, lb: number;
        if (geo.isBlock(nx, ny)) {
          const nt = geo.cornerTops(nx, ny);
          la = Math.min(ta, topAt(nt, nx, ny, ax, az));
          lb = Math.min(tb, topAt(nt, nx, ny, bx, bz));
          if (ta - la < 0.02 && tb - lb < 0.02) continue;
        } else {
          la = geo.vert(ax, az) - 0.05;
          lb = geo.vert(bx, bz) - 0.05;
        }
        const wallCol = k === 'roof' ? PLASTER : base;
        const faceK = dz === 1 ? 1 : dz === -1 ? 0.72 : 0.86;
        const cT = shade(wallCol, faceK * (0.92 + 0.1 * hash2(x, y, 6)));
        const cB = shade(cT, 0.7);
        const bv = fr ? B : 0;
        const oa = outOf(ia), ob = outOf(ib);
        const wn = (o: [number, number], up: number): number[] => {
          const l = Math.hypot(o[0] || dx, up, o[1] || dz);
          return [(o[0] || dx) / l, up / l, (o[1] || dz) / l];
        };
        const A1 = [ax, ta - bv, az], B1 = [bx, tb - bv, bz], A0 = [ax, la, az], B0 = [bx, lb, bz];
        T.triN(A0, B0, B1, wn(oa, 0), wn(ob, 0), wn(ob, 0.45), cB, cB, cT);
        T.triN(A0, B1, A1, wn(oa, 0), wn(ob, 0.45), wn(oa, 0.45), cB, cT, cT);
        if (fr) {
          // Bisel: del borde de la pared al borde de la cara superior.
          const ta2 = topV[ia]!, tb2 = topV[ib]!;
          T.triN(A1, B1, tb2.p, wn(oa, 0.45), wn(ob, 0.45), tb2.n, cT, cT, topCol);
          T.triN(A1, tb2.p, ta2.p, wn(oa, 0.45), tb2.n, ta2.n, cT, topCol, topCol);
        }
        // Ventanas y detalle en fachadas de casa orientadas al sur.
        if (sp === 'woodWall' && dz === 1 && !geo.isBlock(nx, ny)) {
          const gy = (la + lb) / 2;
          if (hash2(x, y, 8) > 0.35) {
            const wx = x + 0.5, wy = gy + 0.5, ww = 0.24;
            const wf = T.count;
            T.rbox(wx, wy - 0.17, y + 1.0, ww * 2, 0.34, 0.05, [1.25, 0.95, 0.5], { r: 0.1, lo: 1, hi: 1 });
            for (let q = wf * 10 + 9; q < T.v.length; q += 10) T.v[q] = 2;
            T.rbox(wx, wy - 0.22, y + 1.02, 0.64, 0.05, 0.1, col('#6a4a2c'), { r: 0.02 });
            lights.push({ x: wx, y: wy, z: y + 1.4, r: 1, g: 0.72, b: 0.35, rad: 2.2 });
          }
        }
      }
      if (sp === 'stoneWall' || sp === 'cryptWall' || sp === 'caveWall') {
        // Antorchas en muros que dan a suelo (mazmorras y cuevas).
        if (hash2(x, y, 12) < 0.07 && geo.g.kind !== 'town') {
          for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
            if (geo.klass(x + dx!, y + dz!) === 'ground') {
              const ty = tops[0] - 0.7;
              addInst('torch', x + 0.5 + dx! * 0.5, ty, y + 0.5 + dz! * 0.5, Math.atan2(dx!, dz!), 1);
              lights.push({ x: x + 0.5 + dx! * 0.7, y: ty + 0.5, z: y + 0.5 + dz! * 0.7, r: 1, g: 0.62, b: 0.25, rad: 5.5 });
              break;
            }
          }
        }
      }
    }
  return { cx, cz, terrain: T.toArray(), water: Wm.toArray(), inst, lights };
}

function topAt(tops: [number, number, number, number], tx: number, ty: number, vx: number, vy: number): number {
  const ix = vx - tx, iy = vy - ty;
  return tops[iy === 0 ? ix : ix === 1 ? 2 : 3]!;
}

function placeObject(geo: Geo, obj: string, x: number, y: number, gy: number, h1: number, h2: number, h3: number, add: (id: string, x: number, y: number, z: number, rot: number, sc: number, c?: RGB) => void, lights: Light[]): void {
  const cx = x + 0.5, cz = y + 0.5;
  const tint: RGB = [0.92 + h2 * 0.16, 0.92 + h3 * 0.16, 0.92 + h1 * 0.12];
  switch (obj) {
    case 'tree': add(`tree${Math.floor(h1 * 3)}`, cx + (h2 - 0.5) * 0.3, gy, cz + (h3 - 0.5) * 0.3, h2 * 6.28, 1.0 + h3 * 0.55, tint); break;
    case 'pine': add(`pine${Math.floor(h1 * 2)}`, cx + (h2 - 0.5) * 0.25, gy, cz + (h3 - 0.5) * 0.25, h2 * 6.28, 1.0 + h3 * 0.6, tint); break;
    case 'snowpine': add('snowpine', cx + (h2 - 0.5) * 0.25, gy, cz + (h3 - 0.5) * 0.25, h2 * 6.28, 1.0 + h3 * 0.5, tint); break;
    case 'rock': add(`rock${Math.floor(h1 * 3)}`, cx, gy, cz, h2 * 6.28, 0.9 + h3 * 0.5, tint); break;
    case 'fence': {
      const hx = geo.spriteAt(x - 1, y) === 'fence' || geo.spriteAt(x + 1, y) === 'fence';
      const hz = geo.spriteAt(x, y - 1) === 'fence' || geo.spriteAt(x, y + 1) === 'fence';
      if (hx) add('fenceX', cx, gy, cz, 0, 1);
      if (hz) add('fenceZ', cx, gy, cz, 0, 1);
      if (!hx && !hz) add('fenceP', cx, gy, cz, 0, 1);
      break;
    }
    case 'doorframe': {
      const vert = geo.isBlock(x, y - 1) || geo.isBlock(x, y + 1);
      add('doorframe', cx, gy, cz, vert ? 0 : Math.PI / 2, 1);
      break;
    }
    case 'lamp': add('lamp', cx, gy, cz, 0, 1); lights.push({ x: cx, y: gy + 1.1, z: cz, r: 1, g: 0.75, b: 0.4, rad: 5 }); break;
    case 'streetlamp': add('streetlamp', cx, gy, cz, 0, 1); lights.push({ x: cx, y: gy + 1.7, z: cz, r: 1, g: 0.78, b: 0.45, rad: 6.5 }); break;
    case 'campfire': add('campfire', cx, gy, cz, 0, 1); lights.push({ x: cx, y: gy + 0.5, z: cz, r: 1, g: 0.55, b: 0.2, rad: 7 }); break;
    case 'hearth': add('hearth', cx, gy, cz, 0, 1); lights.push({ x: cx, y: gy + 0.5, z: cz + 0.2, r: 1, g: 0.5, b: 0.2, rad: 5.5 }); break;
    case 'altar': add('altar', cx, gy, cz, 0, 1); lights.push({ x: cx, y: gy + 1, z: cz, r: 1, g: 0.9, b: 0.5, rad: 4.5 }); break;
    case 'barrel': case 'table': case 'bed': add(obj, cx, gy, cz, obj === 'barrel' ? h1 * 6 : 0, 1, tint); break;
    default: add(obj, cx, gy, cz, 0, 1, tint);
  }
}

/** Número de chunks por lado de una zona. */
export function chunkCounts(w: number, h: number): { nx: number; nz: number } {
  return { nx: Math.ceil(w / CHUNK), nz: Math.ceil(h / CHUNK) };
}

/** Chunks (cx,cz) cuyo cuadrado intersecta el círculo (x,z,radio). */
export function chunksInRadius(w: number, h: number, x: number, z: number, r: number): Array<[number, number]> {
  const { nx, nz } = chunkCounts(w, h);
  const out: Array<[number, number]> = [];
  for (let cz = 0; cz < nz; cz++)
    for (let cx = 0; cx < nx; cx++) {
      const qx = Math.max(cx * CHUNK, Math.min(x, (cx + 1) * CHUNK)), qz = Math.max(cz * CHUNK, Math.min(z, (cz + 1) * CHUNK));
      if ((qx - x) ** 2 + (qz - z) ** 2 <= r * r) out.push([cx, cz]);
    }
  return out;
}

/**
 * Faldón de terreno fuera de la zona: bandas planas con el color del borde que se funden con la
 * niebla, para que el mapa no acabe de golpe en el vacío (no se genera en recintos cerrados).
 */
export function buildSkirt(geo: Geo, ext = 90): Float32Array {
  const M = new MeshBuilder();
  const W = geo.w, H = geo.h;
  const colAt = (x: number, y: number): RGB => {
    const sx = Math.min(W - 1, Math.max(0, x)), sy = Math.min(H - 1, Math.max(0, y));
    const d = t3(geo.spriteAt(sx, sy));
    return shade(col(d.c === 'ground' ? d.col : geo.snowy ? SN : G), 0.92);
  };
  const up = [0, 1, 0];
  const quad = (a: number[], b: number[], c2: number[], d: number[], ca: RGB, cb: RGB, cc: RGB, cd: RGB): void => {
    M.triN(a, b, c2, up, up, up, ca, cb, cc);
    M.triN(a, c2, d, up, up, up, ca, cc, cd);
  };
  const side = (nx: number, nz: number, along: 'x' | 'z'): void => {
    const n = along === 'x' ? W : H;
    for (let i = 0; i < n; i++) {
      const p = (k: number): { x: number; z: number; h: number } => {
        const a = k;
        if (along === 'x') return nz < 0 ? { x: a, z: 0, h: geo.vert(a, 0) } : { x: a, z: H, h: geo.vert(a, H) };
        return nx < 0 ? { x: 0, z: a, h: geo.vert(0, a) } : { x: W, z: a, h: geo.vert(W, a) };
      };
      const a = p(i), b = p(i + 1);
      const c0 = along === 'x' ? colAt(i, nz < 0 ? 0 : H - 1) : colAt(nx < 0 ? 0 : W - 1, i);
      const far = (q: { x: number; z: number }, d: number): number[] => [q.x + nx * d, 0, q.z + nz * d];
      const A = [a.x, a.h, a.z], B = [b.x, b.h, b.z];
      const A1 = far(a, 6), B1 = far(b, 6), A2 = far(a, ext), B2 = far(b, ext);
      const m2 = shade(c0, 0.96);
      quad(A, B, B1, A1, c0, c0, m2, m2);
      quad(A1, B1, B2, A2, m2, m2, m2, m2);
    }
  };
  side(0, -1, 'x'); side(0, 1, 'x'); side(-1, 0, 'z'); side(1, 0, 'z');
  // Esquinas.
  const corner = (cx: number, cz: number, sx: number, sz: number): void => {
    const c0 = shade(colAt(cx === 0 ? 0 : W - 1, cz === 0 ? 0 : H - 1), 0.96);
    const hh = geo.vert(cx, cz);
    quad([cx, hh, cz], [cx + sx * 6, 0, cz], [cx + sx * 6, 0, cz + sz * 6], [cx, 0, cz + sz * 6], c0, c0, c0, c0);
    quad([cx + sx * 6, 0, cz], [cx + sx * ext, 0, cz], [cx + sx * ext, 0, cz + sz * ext], [cx + sx * 6, 0, cz + sz * ext], c0, c0, c0, c0);
    quad([cx, 0, cz + sz * 6], [cx + sx * 6, 0, cz + sz * 6], [cx + sx * 6, 0, cz + sz * ext], [cx, 0, cz + sz * ext], c0, c0, c0, c0);
  };
  corner(0, 0, -1, -1); corner(W, 0, 1, -1); corner(0, H, -1, 1); corner(W, H, 1, 1);
  return M.toArray();
}
