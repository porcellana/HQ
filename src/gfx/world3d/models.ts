/**
 * Catálogo de modelos 3D suaves (puro): objetos estáticos del mundo y rigs animados.
 * Todo se genera por código con primitivas redondeadas (elipsoides, cápsulas, cajas biseladas,
 * sólidos de revolución) y normales por vértice: nada de aristas ni bloques.
 */
import { MeshBuilder, STRIDE, hexRgb, mix, shade, type RGB } from './mesh';

const c = hexRgb;
const EMIS = 2;

/** Aplica viento a los vértices de la malla según su altura (y0..y1 → 0..amt). */
export function swayByHeight(m: MeshBuilder, y0: number, y1: number, amt: number): MeshBuilder {
  for (let i = 0; i < m.v.length; i += STRIDE) m.v[i + 9] = Math.max(0, Math.min(1, (m.v[i + 1]! - y0) / (y1 - y0))) * amt;
  return m;
}
export function emissive(m: MeshBuilder, from: number): MeshBuilder {
  for (let i = from * STRIDE; i < m.v.length; i += STRIDE) m.v[i + 9] = EMIS;
  return m;
}

const BARK = c('#7a5636'), BARK2 = c('#5a4430');
const WOOD = c('#b0804c'), WOODD = c('#7a5636'), STONE = c('#9a97a0'), IRON = c('#4a4d58');

/** Anillo (toro) horizontal. */
export function torus(m: MeshBuilder, x: number, y: number, z: number, R: number, r: number, col: RGB, seg = 16): MeshBuilder {
  const p: Array<[number, number]> = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.push([R + Math.cos(a) * r, Math.sin(a) * r]);
  }
  return m.lathe(x, z, p.map(([rr, yy]) => [rr, yy + y] as [number, number]), col, { seg, lo: 0.9, hi: 1.05 });
}

function trunk(m: MeshBuilder, h: number, r0: number, r1: number, col: RGB, sway = 0): void {
  m.lathe(0, 0, [[0, -0.03], [r0 * 1.7, 0], [r0 * 1.2, 0.07 * h], [r0, 0.25 * h], [(r0 + r1) / 2, 0.6 * h], [r1, h], [r1 * 0.5, h + 0.02]], col, { seg: 8, sway });
}

/** Mientras es true, los modelos con LOD se construyen con menos segmentos (variantes «@lo»). */
let LOWDETAIL = false;

function leafy(seed: number, col: RGB, scale: number): MeshBuilder {
  const m = new MeshBuilder();
  const s = scale;
  trunk(m, 0.8 * s, 0.1, 0.06, BARK);
  const o = { seg: LOWDETAIL ? 6 : 9, ring: LOWDETAIL ? 4 : 6, wob: 0.07, lo: 0.7, hi: 1.14 };
  m.ball(0, 0.78 * s, 0, 0.58 * s, 0.46 * s, 0.55 * s, shade(col, 0.95), { ...o, seed });
  m.ball(0.34 * s, 0.98 * s, 0.1 * s, 0.4 * s, 0.34 * s, 0.4 * s, shade(col, 1.1), { ...o, seed: seed + 3 });
  m.ball(-0.3 * s, 1.0 * s, -0.12 * s, 0.4 * s, 0.34 * s, 0.38 * s, shade(col, 1.02), { ...o, seed: seed + 5 });
  m.ball(0.0, 1.22 * s, 0.02 * s, 0.34 * s, 0.28 * s, 0.34 * s, shade(col, 1.2), { ...o, seed: seed + 9 });
  m.ball(0.12 * s, 0.7 * s, 0.34 * s, 0.3 * s, 0.26 * s, 0.3 * s, shade(col, 0.88), { ...o, seed: seed + 11 });
  return swayByHeight(m, 0.35, 1.5 * s, 1);
}
function conifer(tiers: number, col: RGB, snow: boolean): MeshBuilder {
  const m = new MeshBuilder();
  trunk(m, 0.5, 0.09, 0.07, BARK2);
  for (let i = 0; i < tiers; i++) {
    const y = 0.26 + i * 0.34, r = 0.72 - i * (0.5 / tiers), h = 0.62;
    const prof: Array<[number, number]> = [[0, y + 0.02], [r * 0.5, y - 0.02], [r * 0.92, y + 0.05], [r, y + 0.13], [r * 0.78, y + 0.3 * h / 0.62], [r * 0.45, y + 0.5 * h / 0.62], [r * 0.15, y + h * 0.9], [0.015, y + h]];
    m.lathe(0, 0, prof, shade(col, 0.82 + i * 0.1), { seg: LOWDETAIL ? 6 : 10, lo: 0.7, hi: 1.12 });
    if (snow) m.lathe(0, 0, prof.map(([rr, yy]) => [rr * 0.74, yy + 0.07] as [number, number]).slice(2), c('#f6f9ff'), { seg: 10, lo: 0.95, hi: 1.1 });
  }
  return swayByHeight(m, 0.2, 0.28 + tiers * 0.34 + 0.5, 0.9);
}

function props(): Record<string, () => MeshBuilder> {
  return {
    tree0: () => leafy(1, c('#5a9a44'), 1.15),
    tree1: () => leafy(5, c('#68ac48'), 1.3),
    tree2: () => leafy(9, c('#4a8a3e'), 1.05),
    pine0: () => conifer(4, c('#2f7048'), false),
    pine1: () => conifer(3, c('#3c8048'), false),
    snowpine: () => conifer(4, c('#2f6350'), true),
    palm: () => {
      const m = new MeshBuilder();
      const pts = [[0, 0], [0.05, 0.4], [0.13, 0.85], [0.22, 1.25]];
      for (let i = 0; i < 3; i++) m.limb(pts[i]![0]!, pts[i]![1]!, 0, pts[i + 1]![0]!, pts[i + 1]![1]!, 0, 0.1 - i * 0.015, 0.09 - i * 0.015, i % 2 ? BARK : shade(BARK, 1.12), { seg: 7 });
      const top = 1.28;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
        const pp: number[][] = [], ww: number[] = [];
        for (let k = 0; k <= 5; k++) {
          const t = k / 5;
          pp.push([0.22 + dx * t * 0.95, top + Math.sin(t * 2.2) * 0.3 - t * t * 0.55, dz * t * 0.95]);
          ww.push(0.1 * Math.pow(1 - t, 0.55) + 0.012);
        }
        m.ribbon(pp, ww, [0, 1, 0], i % 2 ? c('#3f9a45') : c('#35853d'), { colTip: c('#6cc060'), sway: 1 });
      }
      m.ball(0.22, top, 0, 0.08, 0.07, 0.08, c('#6b4a2e'));
      return swayByHeight(m, 0.4, 1.5, 1);
    },
    dead: () => {
      const m = new MeshBuilder();
      m.limb(0, 0, 0, 0.03, 1.0, 0, 0.12, 0.05, c('#6a5a46'), { seg: 7 });
      m.limb(0.02, 0.6, 0, 0.42, 1.0, 0.02, 0.05, 0.02, c('#6a5a46'), { seg: 6 });
      m.limb(0.0, 0.78, 0, -0.34, 1.12, 0.1, 0.04, 0.015, c('#5e4f3c'), { seg: 6 });
      m.limb(0.2, 0.8, 0.0, 0.3, 1.28, -0.1, 0.03, 0.012, c('#5e4f3c'), { seg: 6 });
      return m;
    },
    cactus: () => {
      const m = new MeshBuilder();
      const g = c('#58a85a');
      m.limb(0, 0.14, 0, 0, 0.72, 0, 0.15, 0.14, g, { seg: 9 });
      m.limb(0.15, 0.4, 0, 0.3, 0.4, 0, 0.065, 0.065, shade(g, 1.08), { seg: 7 });
      m.limb(0.3, 0.4, 0, 0.3, 0.68, 0, 0.065, 0.065, shade(g, 1.08), { seg: 7 });
      m.limb(-0.15, 0.5, 0, -0.28, 0.5, 0, 0.06, 0.06, shade(g, 0.95), { seg: 7 });
      m.limb(-0.28, 0.5, 0, -0.28, 0.72, 0, 0.06, 0.06, shade(g, 0.95), { seg: 7 });
      m.ball(0, 0.88, 0, 0.05, 0.04, 0.05, c('#f08aa8'));
      return m;
    },
    bush: () => {
      const m = new MeshBuilder();
      const o = { seg: 9, ring: 6, wob: 0.08, lo: 0.7, hi: 1.12 };
      m.ball(0, 0.26, 0, 0.44, 0.34, 0.4, c('#4a9a44'), { ...o, seed: 4 });
      m.ball(0.25, 0.2, 0.1, 0.3, 0.26, 0.28, c('#5aaa4c'), { ...o, seed: 8 });
      m.ball(-0.22, 0.2, -0.12, 0.28, 0.26, 0.26, c('#42903f'), { ...o, seed: 2 });
      return swayByHeight(m, 0, 0.55, 0.6);
    },
    rock0: () => new MeshBuilder().ball(0, 0.17, 0, 0.48, 0.34, 0.44, c('#8e8c96'), { wob: 0.14, seed: 3, seg: 10 }).ball(0.32, 0.09, 0.16, 0.24, 0.17, 0.22, c('#7c7a86'), { wob: 0.12, seed: 5 }),
    rock1: () => new MeshBuilder().ball(0, 0.3, 0, 0.38, 0.5, 0.36, c('#9a98a2'), { wob: 0.14, seed: 11, seg: 10 }).ball(-0.3, 0.12, 0.1, 0.2, 0.17, 0.2, c('#82808c'), { wob: 0.12, seed: 6 }),
    rock2: () => new MeshBuilder().ball(0, 0.15, 0, 0.55, 0.28, 0.5, c('#86848e'), { wob: 0.16, seed: 7, seg: 10 }).ball(0.2, 0.18, -0.2, 0.2, 0.22, 0.2, c('#9a98a2'), { wob: 0.12, seed: 2 }),
    tuft: () => {
      const m = new MeshBuilder();
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05, bx = Math.cos(a) * 0.05, bz = Math.sin(a) * 0.05;
        const lean = 0.1 + (i % 3) * 0.05, hh = 0.24 + (i % 3) * 0.07;
        const pts = [[bx, 0, bz], [bx + Math.cos(a) * lean * 0.4, hh * 0.55, bz + Math.sin(a) * lean * 0.4], [bx + Math.cos(a) * lean, hh, bz + Math.sin(a) * lean]];
        m.ribbon(pts, [0.02, 0.016, 0.003], [-Math.sin(a), 0, Math.cos(a)], c('#6fae4a'), { colTip: c('#a8d870'), sway: 1 });
      }
      return m;
    },
    flowers: () => {
      const m = new MeshBuilder();
      [['#f6e45a', 0.2, 0.2], ['#f27a9a', 0.7, 0.35], ['#ffffff', 0.4, 0.75], ['#a98af6', 0.8, 0.8]].forEach(([col, x, z], k) => {
        const px = (x as number) - 0.5, pz = (z as number) - 0.5, hh = 0.2 + (k % 2) * 0.05;
        m.limb(px, 0, pz, px + 0.01, hh, pz, 0.011, 0.009, c('#58a048'), { seg: 4, sway: 0.5 });
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * 6.28;
          m.ball(px + Math.cos(a) * 0.045, hh + 0.01, pz + Math.sin(a) * 0.045, 0.034, 0.02, 0.034, c(col as string), { seg: 6, ring: 4, sway: 0.6 });
        }
        m.ball(px, hh + 0.02, pz, 0.026, 0.02, 0.026, c('#f2c040'), { seg: 6, ring: 4, sway: 0.6 });
      });
      m.append(props().tuft!(), 0, 0, 0, 0, 1);
      return m;
    },
    pebble: () => new MeshBuilder().ball(0, 0.035, 0, 0.1, 0.07, 0.09, c('#9a978f'), { seg: 7, ring: 5, wob: 0.12, seed: 2 }),
    reed: () => {
      const m = new MeshBuilder();
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 0.05, hh = 0.5 + i * 0.07;
        m.ribbon([[x, 0, 0], [x + 0.015, hh * 0.6, 0.015], [x + 0.03, hh, 0.03]], [0.014, 0.011, 0.002], [0, 0, 1], c('#6f9a4a'), { sway: 1 });
        m.limb(x + 0.03, hh - 0.06, 0.03, x + 0.03, hh + 0.05, 0.03, 0.022, 0.02, c('#7a5636'), { seg: 5, sway: 1 });
      }
      return m;
    },
    lily: () => new MeshBuilder().lathe(0, 0, [[0, 0.012], [0.2, 0.014], [0.23, 0.02], [0.22, 0.0], [0, 0.0]], c('#58a850'), { seg: 10 }).ball(0.05, 0.04, 0.05, 0.05, 0.035, 0.05, c('#f6b0c8'), { seg: 7, ring: 4 }),
    mushroom: () => new MeshBuilder().limb(0, 0, 0, 0, 0.09, 0, 0.035, 0.03, c('#efe6cc'), { seg: 6 }).lathe(0, 0, [[0.0, 0.14], [0.05, 0.135], [0.1, 0.11], [0.115, 0.085], [0.04, 0.08], [0, 0.09]], c('#d05050'), { seg: 9 }),
    crystal: () => {
      const m = new MeshBuilder();
      const g = (x: number, z: number, h: number, r: number, col: string, tilt: number): void => {
        const f = m.count;
        m.lathe(0, 0, [[0, 0], [r, 0.02], [r * 1.05, h * 0.55], [r * 0.5, h * 0.88], [0, h]], c(col), { seg: 6, lo: 0.85, hi: 1.2 });
        m.rotate(f, tilt, 0, 0, 0, 0, x, 0, z);
      };
      g(0, 0, 0.55, 0.09, '#6ad8ff', 0);
      g(0.12, 0.05, 0.36, 0.07, '#9ae8ff', 0.25);
      g(-0.1, 0.06, 0.3, 0.06, '#4ab8f0', -0.3);
      return emissive(m, 0);
    },
    well: () => {
      const m = new MeshBuilder();
      m.lathe(0, 0, [[0.3, 0], [0.46, 0.0], [0.47, 0.1], [0.44, 0.4], [0.4, 0.47], [0.3, 0.45], [0.3, 0.38]], STONE, { seg: 14 });
      m.lathe(0, 0, [[0, 0.36], [0.31, 0.36]], c('#3a78a8'), { seg: 12 });
      m.limb(-0.38, 0.1, 0, -0.38, 1.0, 0, 0.04, 0.04, WOODD, { seg: 6 });
      m.limb(0.38, 0.1, 0, 0.38, 1.0, 0, 0.04, 0.04, WOODD, { seg: 6 });
      m.limb(-0.4, 0.98, 0, 0.4, 0.98, 0, 0.035, 0.035, WOOD, { seg: 6 });
      m.lathe(0, 0, [[0.62, 0.98], [0.58, 1.02], [0.3, 1.14], [0.12, 1.26], [0, 1.3]], c('#b0503e'), { seg: 4, rot: Math.PI / 4, lo: 0.8, hi: 1.12 });
      return m;
    },
    sign: () => new MeshBuilder().limb(0, 0, 0, 0, 0.78, 0, 0.04, 0.04, WOODD, { seg: 6 }).rbox(0, 0.48, 0.03, 0.56, 0.28, 0.05, WOOD, { r: 0.025 }),
    lamp: () => {
      const m = new MeshBuilder().limb(0, 0, 0, 0, 1.0, 0, 0.035, 0.03, IRON, { seg: 6 }).limb(0, 1.0, 0, 0.24, 1.0, 0, 0.02, 0.02, IRON, { seg: 5 });
      const n = m.count;
      m.ball(0.25, 0.84, 0, 0.09, 0.12, 0.09, c('#ffd070'), { seg: 8, lo: 1, hi: 1 });
      return emissive(m, n);
    },
    streetlamp: () => {
      const m = new MeshBuilder().lathe(0, 0, [[0, 0], [0.12, 0], [0.09, 0.1], [0.04, 0.3], [0.03, 1.6]], IRON, { seg: 8 });
      m.lathe(0, 0, [[0.0, 1.55], [0.17, 1.58], [0.13, 1.64]], IRON, { seg: 8 });
      const n = m.count;
      m.ball(0, 1.78, 0, 0.12, 0.16, 0.12, c('#ffd884'), { seg: 8, lo: 1, hi: 1 });
      emissive(m, n);
      m.lathe(0, 0, [[0.17, 1.9], [0.12, 1.98], [0, 2.04]], IRON, { seg: 8 });
      return m;
    },
    grave: () => new MeshBuilder().ball(0, 0.02, 0, 0.26, 0.05, 0.4, c('#6a7a58'), { seg: 8, ring: 4 }).rbox(0, 0.02, -0.25, 0.32, 0.46, 0.1, c('#9a98a2'), { r: 0.045 }).ball(0, 0.48, -0.25, 0.16, 0.12, 0.05, c('#a8a6b0'), { seg: 8 }),
    fenceX: () => new MeshBuilder().rbox(-0.45, 0, 0, 0.1, 0.64, 0.1, WOODD, { r: 0.04 }).rbox(0.45, 0, 0, 0.1, 0.64, 0.1, WOODD, { r: 0.04 }).limb(-0.45, 0.42, 0, 0.45, 0.42, 0, 0.035, 0.035, WOOD, { seg: 6 }).limb(-0.45, 0.2, 0, 0.45, 0.2, 0, 0.035, 0.035, WOOD, { seg: 6 }),
    fenceZ: () => new MeshBuilder().rbox(0, 0, -0.45, 0.1, 0.64, 0.1, WOODD, { r: 0.04 }).rbox(0, 0, 0.45, 0.1, 0.64, 0.1, WOODD, { r: 0.04 }).limb(0, 0.42, -0.45, 0, 0.42, 0.45, 0.035, 0.035, WOOD, { seg: 6 }).limb(0, 0.2, -0.45, 0, 0.2, 0.45, 0.035, 0.035, WOOD, { seg: 6 }),
    fenceP: () => new MeshBuilder().rbox(0, 0, 0, 0.12, 0.64, 0.12, WOODD, { r: 0.05 }),
    doorframe: () => new MeshBuilder().rbox(-0.42, 0, 0, 0.14, 1.1, 0.2, WOODD, { r: 0.05 }).rbox(0.42, 0, 0, 0.14, 1.1, 0.2, WOODD, { r: 0.05 }).rbox(0, 1.0, 0, 1, 0.15, 0.22, WOOD, { r: 0.06 }),
    cave: () => {
      const m = new MeshBuilder();
      m.ball(0, 0.4, -0.15, 0.4, 0.5, 0.3, c('#0a0810'), { seg: 9 });
      m.ball(-0.5, 0.55, 0, 0.3, 0.7, 0.4, c('#7a7782'), { wob: 0.1, seed: 2 });
      m.ball(0.5, 0.55, 0, 0.3, 0.7, 0.4, c('#84818c'), { wob: 0.1, seed: 4 });
      m.ball(0, 1.05, 0.0, 0.62, 0.38, 0.42, c('#726f7c'), { wob: 0.1, seed: 8 });
      return m;
    },
    stairsDown: () => {
      const m = new MeshBuilder().rbox(0, 0, 0, 0.9, 0.03, 0.9, c('#14111a'), { r: 0.012 });
      for (let i = 0; i < 4; i++) m.rbox(0, 0.03, -0.3 + i * 0.2, 0.86 - i * 0.06, 0.03, 0.12, shade(c('#5a5460'), 0.7 + i * 0.12), { r: 0.012 });
      return m;
    },
    stairsUp: () => {
      const m = new MeshBuilder();
      for (let i = 0; i < 4; i++) m.rbox(0, 0, 0.3 - i * 0.2, 0.9, 0.12 + i * 0.12, 0.2, shade(c('#8a8492'), 0.85 + i * 0.07), { r: 0.03 });
      return m;
    },
    counter: () => new MeshBuilder().rbox(0, 0, 0, 1, 0.62, 0.62, WOOD, { r: 0.05 }).rbox(0, 0.6, 0, 1.06, 0.08, 0.68, WOODD, { r: 0.035 }),
    table: () => {
      const m = new MeshBuilder().rbox(0, 0.48, 0, 0.92, 0.09, 0.72, WOOD, { r: 0.04 });
      for (const [x, z] of [[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]] as const) m.limb(x, 0, z, x, 0.5, z, 0.04, 0.035, WOODD, { seg: 6 });
      return m;
    },
    barrel: () => new MeshBuilder().lathe(0, 0, [[0, 0], [0.24, 0], [0.3, 0.14], [0.32, 0.32], [0.3, 0.5], [0.24, 0.62], [0, 0.62]], c('#9a6a38'), { seg: 12 }).lathe(0, 0, [[0.265, 0.17], [0.33, 0.19], [0.33, 0.22], [0.265, 0.22]], IRON, { seg: 12 }).lathe(0, 0, [[0.265, 0.42], [0.33, 0.43], [0.33, 0.47], [0.265, 0.47]], IRON, { seg: 12 }),
    shelf: () => {
      const m = new MeshBuilder().rbox(0, 0, 0, 0.92, 1.3, 0.4, c('#6a4a2c'), { r: 0.05 });
      const cols = ['#b04a3a', '#3a5aaa', '#3a9a4a', '#e0b850'];
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) m.rbox(-0.33 + i * 0.22, 0.12 + r * 0.38, 0.18, 0.15, 0.26, 0.06, c(cols[(i + r) % 4]!), { r: 0.03 });
      return m;
    },
    hearth: () => {
      const m = new MeshBuilder().rbox(0, 0, -0.1, 1, 0.9, 0.7, c('#7a7680'), { r: 0.06 }).rbox(0, 0.9, -0.25, 0.5, 1.0, 0.4, c('#6c6872'), { r: 0.06 });
      const n = m.count;
      m.ball(0, 0.22, 0.26, 0.26, 0.17, 0.05, c('#ff9a3a'), { seg: 8 });
      return emissive(m, n);
    },
    bed: () => new MeshBuilder().rbox(0, 0, 0, 0.78, 0.26, 0.98, WOODD, { r: 0.05 }).rbox(0, 0.22, 0.05, 0.7, 0.14, 0.82, c('#c05a5a'), { r: 0.06 }).ball(0, 0.4, -0.32, 0.26, 0.09, 0.12, c('#f4ecd8'), { seg: 8 }),
    anvil: () => new MeshBuilder().rbox(0, 0, 0, 0.5, 0.35, 0.4, c('#545260'), { r: 0.08 }).rbox(0, 0.33, 0, 0.72, 0.2, 0.36, c('#68667a'), { r: 0.06 }).limb(0.36, 0.45, 0, 0.5, 0.47, 0, 0.08, 0.04, c('#68667a'), { seg: 6 }),
    altar: () => {
      const m = new MeshBuilder().rbox(0, 0, 0, 0.9, 0.6, 0.6, c('#9a98a2'), { r: 0.06 }).rbox(0, 0.58, 0, 1.0, 0.1, 0.7, c('#b4b0bc'), { r: 0.05 });
      const n = m.count;
      m.ball(0, 0.86, 0, 0.08, 0.14, 0.08, c('#ffe08a'), { seg: 7, lo: 1, hi: 1 });
      return emissive(m, n);
    },
    tent: () => {
      const m = new MeshBuilder();
      m.lathe(0, 0, [[0.62, 0], [0.6, 0.06], [0.42, 0.45], [0.2, 0.8], [0.07, 1.0], [0, 1.04]], c('#c0603e'), { seg: 6, rot: 0.5, lo: 0.75, hi: 1.12 });
      m.ball(0, 0.22, 0.5, 0.15, 0.24, 0.05, c('#2e2018'), { seg: 8 });
      return m;
    },
    campfire: () => {
      const m = new MeshBuilder();
      for (let i = 0; i < 7; i++) m.ball(Math.cos(i * 0.9) * 0.3, 0.05, Math.sin(i * 0.9) * 0.3, 0.1, 0.08, 0.1, c('#928f8a'), { seg: 6, ring: 4, wob: 0.1, seed: i });
      m.limb(-0.25, 0.06, -0.1, 0.25, 0.1, 0.1, 0.045, 0.045, WOODD, { seg: 6 }).limb(-0.1, 0.06, 0.25, 0.1, 0.1, -0.25, 0.045, 0.045, WOOD, { seg: 6 });
      const n = m.count;
      m.lathe(0, 0, [[0.14, 0.08], [0.17, 0.2], [0.1, 0.4], [0.03, 0.56], [0, 0.6]], c('#ff8a2a'), { seg: 7, sway: 0.4, lo: 1, hi: 1.1 });
      m.lathe(0, 0, [[0.08, 0.1], [0.1, 0.2], [0.05, 0.36], [0, 0.42]], c('#ffd75a'), { seg: 7, sway: 0.4, lo: 1, hi: 1.1 });
      return emissive(m, n);
    },
    torch: () => {
      const m = new MeshBuilder().limb(0, 0, 0, 0, 0.38, 0, 0.035, 0.03, WOODD, { seg: 6 });
      const n = m.count;
      m.lathe(0, 0, [[0.06, 0.38], [0.09, 0.46], [0.05, 0.58], [0, 0.66]], c('#ffb040'), { seg: 7, sway: 0.3, lo: 1, hi: 1.1 });
      return emissive(m, n);
    },
    brazier: () => {
      const m = new MeshBuilder();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * 6.283 + 0.4;
        m.limb(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, Math.cos(a) * 0.09, 0.5, Math.sin(a) * 0.09, 0.032, 0.026, IRON, { seg: 6 });
      }
      m.lathe(0, 0, [[0.05, 0.46], [0.25, 0.5], [0.3, 0.62], [0.27, 0.64], [0.2, 0.56], [0, 0.54]], c('#3b3c46'), { seg: 10, lo: 0.8, hi: 1.1 });
      m.ball(0, 0.58, 0, 0.2, 0.07, 0.2, c('#5a2a18'), { seg: 8, ring: 4 });
      const n = m.count;
      m.lathe(0, 0, [[0.2, 0.6], [0.24, 0.74], [0.16, 0.98], [0.06, 1.18], [0, 1.28]], c('#ff8a2a'), { seg: 7, sway: 0.4, lo: 1, hi: 1.1 });
      m.lathe(0, 0, [[0.11, 0.62], [0.13, 0.78], [0.07, 0.96], [0, 1.04]], c('#ffd75a'), { seg: 7, sway: 0.4, lo: 1, hi: 1.1 });
      return emissive(m, n);
    },
    stalag: () => {
      const m = new MeshBuilder();
      m.lathe(0, 0, [[0, -0.02], [0.17, 0], [0.15, 0.1], [0.1, 0.3], [0.06, 0.5], [0.025, 0.66], [0, 0.72]], c('#7a6c5c'), { seg: 7, lo: 0.75, hi: 1.12 });
      m.lathe(0.17, 0.06, [[0, -0.02], [0.09, 0], [0.07, 0.12], [0.03, 0.24], [0, 0.3]], c('#6c5f51'), { seg: 6, lo: 0.8, hi: 1.1 });
      return m;
    },
    stalag2: () => {
      const m = new MeshBuilder();
      m.lathe(0, 0, [[0, -0.02], [0.2, 0], [0.12, 0.12], [0.08, 0.3], [0.03, 0.42], [0, 0.46]], c('#807262'), { seg: 7, lo: 0.75, hi: 1.12 });
      m.lathe(-0.16, 0.05, [[0, -0.02], [0.1, 0], [0.06, 0.16], [0.02, 0.34], [0, 0.4]], c('#6c5f51'), { seg: 6, lo: 0.8, hi: 1.1 });
      m.lathe(0.1, -0.14, [[0, -0.02], [0.07, 0], [0.04, 0.12], [0, 0.22]], c('#8a7c6a'), { seg: 6, lo: 0.8, hi: 1.1 });
      return m;
    },
    stalac: () => new MeshBuilder().lathe(0, 0, [[0, 0.04], [0.11, 0.0], [0.1, -0.06], [0.06, -0.2], [0.03, -0.34], [0, -0.44]], c('#8a7c6a'), { seg: 7, lo: 0.8, hi: 1.12 }),
    chimney: () => new MeshBuilder().rbox(0, 0, 0, 0.3, 0.55, 0.3, c('#8a7a70'), { r: 0.05 }).rbox(0, 0.52, 0, 0.38, 0.08, 0.38, c('#6a5a54'), { r: 0.04 }),
  };
}

const PROPS = props();
export const STATIC_MODELS = Object.keys(PROPS);
const cacheStatic = new Map<string, Float32Array>();
export function staticModel(id: string): Float32Array | null {
  let a = cacheStatic.get(id);
  if (!a) {
    const lo = id.endsWith('@lo');
    const f = PROPS[lo ? id.slice(0, -3) : id];
    if (!f) return null;
    LOWDETAIL = lo;
    try {
      a = f().toArray();
    } finally {
      LOWDETAIL = false;
    }
    cacheStatic.set(id, a);
  }
  return a;
}

// ===================================================================== RIGS
export type PartAnim = 'none' | 'legL' | 'legR' | 'armL' | 'armR' | 'wingL' | 'wingR' | 'tail' | 'legA' | 'legB' | 'body' | 'tent' | 'head';
export type RigStyle = 'melee' | 'cast' | 'ranged' | 'beast';
export interface RigPart { mesh: Float32Array; pivot: [number, number, number]; anim: PartAnim; phase: number }
export interface Rig {
  parts: RigPart[];
  /** Altura aproximada para etiquetas. */
  height: number;
  flyer: boolean;
  /** Radio de la sombra. */
  shadow: number;
  /** Cómo ataca (decide la pose). */
  style: RigStyle;
  /** Giro en reposo del brazo derecho/izquierdo (armas a la vista). */
  restR?: number;
  restL?: number;
}

/** Crea una pieza: la malla se escribe en coordenadas del modelo y se guarda relativa al pivote. */
function part(m: MeshBuilder, pivot: [number, number, number], anim: PartAnim = 'none', phase = 0): RigPart {
  const a = m.toArray();
  for (let i = 0; i < a.length; i += STRIDE) { a[i]! -= pivot[0]; a[i + 1]! -= pivot[1]; a[i + 2]! -= pivot[2]; }
  return { mesh: a, pivot, anim, phase };
}
function scaleRig(parts: RigPart[], k: number): void {
  if (k === 1) return;
  for (const p of parts) {
    for (let i = 0; i < p.mesh.length; i += STRIDE) { p.mesh[i]! *= k; p.mesh[i + 1]! *= k; p.mesh[i + 2]! *= k; }
    p.pivot = [p.pivot[0] * k, p.pivot[1] * k, p.pivot[2] * k];
  }
}
const dark = (col: RGB): RGB => shade(col, 0.7);

export interface HumanLook {
  skin: string; hair: string; cloth: string; clothDark: string; pants: string;
  hat?: string | undefined; overlay?: string | undefined;
  /** Esqueleto, orco... */
  bone?: boolean; scale?: number; ears?: boolean; eye?: string;
}

export function humanoidRig(l: HumanLook): Rig {
  const skin = c(l.skin), hair = c(l.hair), cloth = c(l.cloth), cd = c(l.clothDark), pants = c(l.pants);
  const ov = l.overlay ?? '';
  const robe = ov === 'mago' || ov === 'clerigo' || ov === 'druida' || ov === 'bardo';
  const metal = c('#bcc2d2'), metalD = c('#8a90a4'), gold = c('#f0c860');
  const hat = l.hat ? c(l.hat) : cloth;
  const sk = l.bone ? c('#e8e0cc') : skin;
  const eyeC = c(l.eye ?? (l.bone ? '#ff5a4a' : '#1a1620'));
  // ---- torso
  const body = new MeshBuilder();
  body.rbox(0, 0.33, 0, 0.3, 0.34, 0.2, l.bone ? c('#d8d0b8') : cloth, { r: 0.085 });
  body.rbox(0, 0.35, 0, 0.318, 0.05, 0.218, cd, { r: 0.022 });
  if (l.bone) for (let i = 0; i < 3; i++) body.rbox(0, 0.42 + i * 0.07, 0.0, 0.3, 0.025, 0.21, c('#b8b09c'), { r: 0.01 });
  if (robe) body.lathe(0, 0, [[0, 0.06], [0.2, 0.07], [0.245, 0.14], [0.2, 0.3], [0.13, 0.4], [0, 0.4]], cloth, { seg: 14 });
  if (ov === 'guerrero' || ov === 'barbaro') body.rbox(0, 0.4, 0.095, 0.2, 0.2, 0.04, ov === 'barbaro' ? c('#8a6a48') : metal, { r: 0.05 });
  if (ov === 'picaro' || ov === 'explorador') body.ball(0, 0.42, -0.12, 0.16, 0.22, 0.05, dark(cloth), { seg: 10 });
  if (ov === 'explorador') body.rbox(0, 0.3, -0.16, 0.18, 0.24, 0.1, c('#8a6a48'), { r: 0.04 });
  if (ov === 'clerigo') body.rbox(0, 0.4, 0.105, 0.05, 0.2, 0.02, gold, { r: 0.01 }).rbox(0, 0.46, 0.105, 0.14, 0.05, 0.02, gold, { r: 0.01 });
  // ---- cabeza
  const head = new MeshBuilder();
  head.ball(0, 0.8, 0, 0.152, 0.146, 0.146, sk, { seg: 12, ring: 8, lo: 0.85, hi: 1.06 });
  head.ball(-0.057, 0.8, 0.128, 0.022, 0.03, 0.014, eyeC, { seg: 7, ring: 5, lo: 1, hi: 1 });
  head.ball(0.057, 0.8, 0.128, 0.022, 0.03, 0.014, eyeC, { seg: 7, ring: 5, lo: 1, hi: 1 });
  if (l.bone) {
    head.ball(-0.057, 0.8, 0.123, 0.034, 0.04, 0.012, c('#2a2420'), { seg: 7, ring: 5, lo: 1, hi: 1 });
    head.ball(0.057, 0.8, 0.123, 0.034, 0.04, 0.012, c('#2a2420'), { seg: 7, ring: 5, lo: 1, hi: 1 });
    head.rbox(0, 0.69, 0.07, 0.1, 0.05, 0.06, c('#d8d0b8'), { r: 0.02 });
  } else {
    head.ball(0, 0.76, 0.14, 0.018, 0.014, 0.01, shade(skin, 0.85), { seg: 6, ring: 4, lo: 1, hi: 1 });
    head.ball(-0.09, 0.765, 0.1, 0.03, 0.02, 0.012, mix(skin, c('#ff7a7a'), 0.4), { seg: 6, ring: 4, lo: 1, hi: 1 });
    head.ball(0.09, 0.765, 0.1, 0.03, 0.02, 0.012, mix(skin, c('#ff7a7a'), 0.4), { seg: 6, ring: 4, lo: 1, hi: 1 });
    head.ball(0, 0.86, -0.01, 0.16, 0.11, 0.155, hair, { seg: 12, ring: 7, lo: 0.78, hi: 1.1 });
    head.ball(0, 0.77, -0.075, 0.15, 0.15, 0.09, hair, { seg: 10 });
    head.ball(0, 0.9, 0.07, 0.1, 0.05, 0.07, shade(hair, 1.1), { seg: 8, ring: 5 });
  }
  if (l.ears) {
    for (const s of [-1, 1]) {
      const f = head.count;
      head.limb(0, 0, 0, s * 0.2, 0.05, 0, 0.045, 0.01, skin, { seg: 6 });
      head.rotate(f, 0, 0, 0, 0, 0, s * 0.12, 0.83, 0);
    }
  }
  switch (ov) {
    case 'mago': {
      const f = head.count;
      head.lathe(0, 0, [[0.27, 0], [0.24, 0.025], [0.14, 0.05], [0.1, 0.12], [0.075, 0.28], [0.04, 0.4], [0, 0.46]], hat, { seg: 12, lo: 0.8, hi: 1.12 });
      head.rotate(f, 0.0, 0, 0.18, 0, 0.1, 0, 0.9, -0.02);
      break;
    }
    case 'bardo': head.ball(0, 0.93, 0, 0.17, 0.06, 0.16, hat, { seg: 10 }).limb(0.08, 0.95, 0.04, 0.26, 1.12, -0.02, 0.012, 0.004, c('#f0d060'), { seg: 4 }); break;
    case 'guerrero': case 'barbaro':
      if (ov === 'guerrero') {
        head.ball(0, 0.87, 0, 0.17, 0.12, 0.165, metal, { seg: 12, ring: 7, lo: 0.8, hi: 1.15 });
        torus(head, 0, 0.83, 0, 0.155, 0.014, metalD, 14);
        head.rbox(0, 0.76, 0.14, 0.035, 0.11, 0.025, metal, { r: 0.01 });
        head.limb(0, 0.98, 0.0, 0, 1.03, -0.12, 0.025, 0.02, c('#c04040'), { seg: 5 });
      } else {
        head.ball(0, 0.9, -0.01, 0.17, 0.09, 0.16, c('#9a7a58'), { seg: 10 });
        for (const s of [-1, 1]) head.limb(s * 0.14, 0.92, 0, s * 0.25, 0.96, 0, 0.04, 0.03, c('#efe6cc'), { seg: 6 }).limb(s * 0.25, 0.96, 0, s * 0.29, 1.08, 0, 0.03, 0.01, c('#efe6cc'), { seg: 6 });
      }
      break;
    case 'picaro': head.ball(0, 0.85, -0.03, 0.18, 0.14, 0.17, hat, { seg: 12, ring: 7 }).ball(0, 0.73, -0.1, 0.17, 0.17, 0.1, shade(hat, 0.85), { seg: 10 }); break;
    case 'explorador': {
      head.lathe(0, 0, [[0.25, 0.9], [0.22, 0.9], [0.14, 0.92], [0.12, 0.99], [0.06, 1.02], [0, 1.02]], hat, { seg: 14, lo: 0.8, hi: 1.1 });
      head.lathe(0, 0, [[0.14, 0.915], [0.26, 0.9], [0.255, 0.885], [0.14, 0.9]], shade(hat, 0.9), { seg: 14 });
      head.limb(0.1, 0.96, 0.05, 0.22, 1.08, -0.05, 0.016, 0.004, c('#5ac078'), { seg: 4 });
      break;
    }
    case 'clerigo': { const f = head.count; torus(head, 0, 1.06, 0, 0.13, 0.014, gold, 16); emissive(head, f); break; }
    case 'druida': {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; head.ball(Math.cos(a) * 0.14, 0.92, Math.sin(a) * 0.14, 0.06, 0.035, 0.04, i % 2 ? c('#5aaa46') : c('#78c058'), { seg: 6, ring: 4 }); }
      for (const s of [-1, 1]) head.limb(s * 0.08, 0.96, 0, s * 0.16, 1.1, 0, 0.018, 0.008, c('#8a6a40'), { seg: 5 });
      break;
    }
    default: if (l.hat) head.ball(0, 0.9, 0, 0.165, 0.07, 0.16, hat, { seg: 10 });
  }
  // ---- brazos y armas
  const mkArm = (side: number): MeshBuilder => {
    const m = new MeshBuilder();
    const sl = robe ? cloth : ov === 'guerrero' || ov === 'barbaro' ? shade(cloth, 1) : cloth;
    m.limb(0, 0, 0, 0, -0.2, 0, 0.056, 0.048, l.bone ? c('#d8d0b8') : sl, { seg: 8 });
    m.ball(0, -0.265, 0, 0.047, 0.047, 0.047, sk, { seg: 8, ring: 6 });
    if (ov === 'guerrero' || ov === 'barbaro') m.ball(0, 0.0, 0, 0.085, 0.06, 0.085, ov === 'barbaro' ? c('#8a6a48') : metal, { seg: 9, ring: 6 });
    const right = side > 0;
    if (right) {
      if (ov === 'guerrero') { m.rbox(0, -0.85, 0.0, 0.075, 0.56, 0.026, c('#e4e8f2'), { r: 0.012 }).rbox(0, -0.31, 0, 0.17, 0.035, 0.055, gold, { r: 0.016 }).ball(0, -0.2, 0, 0.03, 0.03, 0.03, gold, { seg: 6, ring: 4 }); }
      else if (ov === 'barbaro') { m.limb(0, -0.15, 0, 0, -0.88, 0, 0.025, 0.022, WOODD, { seg: 6 }); m.ball(0, -0.82, 0.07, 0.022, 0.11, 0.14, metal, { seg: 8 }); }
      else if (ov === 'picaro') m.rbox(0, -0.55, 0, 0.045, 0.27, 0.016, c('#d8dcea'), { r: 0.008 }).rbox(0, -0.29, 0, 0.1, 0.025, 0.035, c('#6a4a30'), { r: 0.01 });
      else if (ov === 'clerigo') { m.limb(0, -0.2, 0, 0, -0.66, 0, 0.022, 0.02, WOODD, { seg: 6 }); m.ball(0, -0.7, 0, 0.07, 0.07, 0.07, gold, { seg: 8, ring: 6 }); }
      else if (ov === 'explorador') m.rbox(0, -0.5, 0.0, 0.03, 0.24, 0.012, c('#d8dcea'), { r: 0.006 });
    } else {
      if (ov === 'guerrero') m.ball(-0.04, -0.2, 0.07, 0.025, 0.14, 0.14, c('#4a68b0'), { seg: 10 }).ball(-0.06, -0.2, 0.07, 0.015, 0.05, 0.05, gold, { seg: 6, ring: 4 });
      else if (ov === 'clerigo') m.ball(-0.04, -0.2, 0.07, 0.022, 0.13, 0.12, c('#f4ecd8'), { seg: 10 }).ball(-0.06, -0.2, 0.07, 0.014, 0.05, 0.05, gold, { seg: 6, ring: 4 });
      else if (ov === 'mago' || ov === 'druida') {
        m.limb(0, -0.5, 0.02, 0, 0.72, 0.02, 0.02, 0.018, WOODD, { seg: 6 });
        const n = m.count;
        m.ball(0, 0.8, 0.02, 0.065, 0.07, 0.065, ov === 'mago' ? c('#8ad8ff') : c('#8ae060'), { seg: 9, ring: 7, lo: 1, hi: 1.1 });
        emissive(m, n);
      } else if (ov === 'bardo') { m.ball(0, -0.34, 0.07, 0.09, 0.11, 0.045, c('#c88a48'), { seg: 9 }); m.limb(0, -0.34, 0.07, 0, -0.04, 0.07, 0.014, 0.014, WOODD, { seg: 5 }); }
      else if (ov === 'explorador') {
        const pts: number[][] = [[0, 0.1, 0], [0, -0.1, 0.1], [0, -0.28, 0.12], [0, -0.46, 0.1], [0, -0.66, 0]];
        for (let i = 0; i < 4; i++) m.limb(pts[i]![0]!, pts[i]![1]!, pts[i]![2]!, pts[i + 1]![0]!, pts[i + 1]![1]!, pts[i + 1]![2]!, 0.02, 0.02, WOODD, { seg: 5 });
        m.limb(0, 0.1, 0, 0, -0.66, 0, 0.006, 0.006, c('#e8e0d0'), { seg: 3 });
      } else if (ov === 'picaro') m.rbox(0, -0.5, 0, 0.04, 0.24, 0.014, c('#d8dcea'), { r: 0.007 });
    }
    return m;
  };
  const leg = (): MeshBuilder => new MeshBuilder().limb(0, 0.36, 0, 0, 0.1, 0, 0.065, 0.055, pants, { seg: 8 }).rbox(0, 0, 0.03, 0.115, 0.095, 0.2, c('#4a362a'), { r: 0.04 });
  const sc = l.scale ?? 1;
  const hasR = ov === 'guerrero' || ov === 'barbaro' || ov === 'picaro' || ov === 'clerigo' || ov === 'explorador';
  const parts = [
    part(body, [0, 0, 0], 'body'),
    part(head, [0, 0.66, 0], 'head'),
    part(leg().rotate(0, 0, 0, 0, 0, 0, -0.075, 0, 0), [-0.075, 0.36, 0], 'legL'), part(leg().rotate(0, 0, 0, 0, 0, 0, 0.075, 0, 0), [0.075, 0.36, 0], 'legR'),
    part(mkArm(-1).rotate(0, 0, 0, 0, 0, 0, -0.195, 0.62, 0), [-0.195, 0.62, 0], 'armL'), part(mkArm(1).rotate(0, 0, 0, 0, 0, 0, 0.195, 0.62, 0), [0.195, 0.62, 0], 'armR'),
  ];
  scaleRig(parts, sc);
  const style: RigStyle = ov === 'mago' || ov === 'druida' || ov === 'bardo' ? 'cast' : ov === 'explorador' ? 'ranged' : 'melee';
  return { parts, height: 1.08 * sc, flyer: false, shadow: 0.3 * sc, style, restR: hasR ? -0.55 : 0, restL: 0 };
}

export interface BeastLook { main: string; dark: string; accent: string; eye?: string | undefined; boss?: boolean }

/** Cuadrúpedo con variantes por forma. */
function quadruped(shape: string, l: BeastLook): Rig {
  const main = c(l.main), dk = c(l.dark), ac = c(l.accent), eye = c(l.eye ?? '#2a2024');
  const long = shape === 'lobo' || shape === 'zorro' || shape === 'nutria' || shape === 'lagarto' || shape === 'rata';
  const sc = shape === 'rata' ? 0.6 : shape === 'lobo' ? 1.05 : shape === 'armadillo' ? 0.85 : shape === 'zorro' ? 0.88 : shape === 'lagarto' ? 0.9 : 0.8;
  const bl = long ? 0.3 : 0.24, bh = shape === 'armadillo' ? 0.2 : 0.17, ly = 0.34;
  const body = new MeshBuilder();
  if (shape === 'armadillo') {
    body.ball(0, ly + 0.02, 0, 0.23, 0.2, 0.3, shade(main, 0.9), { seg: 12, ring: 8 });
    for (let i = 0; i < 3; i++) body.ball(0, ly + 0.1, -0.12 + i * 0.12, 0.2, 0.025, 0.02, dk, { seg: 10, ring: 4 });
  } else body.ball(0, ly, 0, bh, bh * 0.95, bl, main, { seg: 12, ring: 8 });
  body.ball(0, ly - 0.07, 0.04, bh * 0.82, bh * 0.6, bl * 0.8, ac, { seg: 10, ring: 6 });
  if (shape !== 'armadillo') body.ball(0, ly + 0.07, -0.02, bh * 0.9, bh * 0.5, bl * 0.85, dk, { seg: 10, ring: 5 });
  const hz = bl + 0.06;
  body.ball(0, ly + 0.1, hz, 0.15, 0.14, 0.14, main, { seg: 12, ring: 8 });
  body.ball(0, ly + 0.05, hz + 0.13, 0.075, 0.06, 0.09, shade(main, 1.12), { seg: 9, ring: 6 });
  body.ball(0, ly + 0.08, hz + 0.21, 0.025, 0.02, 0.018, c('#1a1418'), { seg: 6, ring: 4, lo: 1, hi: 1 });
  for (const s of [-1, 1]) {
    body.ball(s * 0.07, ly + 0.16, hz + 0.08, 0.026, 0.032, 0.016, eye, { seg: 7, ring: 5, lo: 1, hi: 1.05 });
    body.ball(s * 0.07 + s * 0.006, ly + 0.17, hz + 0.092, 0.008, 0.01, 0.006, c('#ffffff'), { seg: 4, ring: 3, lo: 1, hi: 1 });
  }
  if (shape === 'lobo' || shape === 'zorro') for (const s of [-1, 1]) { const f = body.count; body.lathe(0, 0, [[0.055, 0], [0.04, 0.1], [0, 0.18]], dk, { seg: 6 }); body.rotate(f, 0, 0, s * 0.2, 0, 0, s * 0.08, ly + 0.2, hz - 0.03); }
  else if (shape === 'rata' || shape === 'nutria') for (const s of [-1, 1]) body.ball(s * 0.1, ly + 0.2, hz - 0.03, 0.055, 0.06, 0.02, ac, { seg: 8, ring: 5 });
  else if (shape === 'lagarto') body.ball(0, ly + 0.17, hz - 0.02, 0.05, 0.03, 0.08, dk, { seg: 6, ring: 4 });
  const tail = new MeshBuilder();
  if (shape === 'zorro') { tail.limb(0, ly + 0.04, -bl, 0, ly + 0.14, -bl - 0.22, 0.05, 0.075, ac, { seg: 8 }); tail.ball(0, ly + 0.15, -bl - 0.3, 0.07, 0.07, 0.1, c('#f4f0e8'), { seg: 8 }); }
  else if (shape === 'lobo') tail.limb(0, ly + 0.02, -bl, 0, ly - 0.05, -bl - 0.28, 0.04, 0.06, dk, { seg: 7 });
  else if (shape === 'lagarto') tail.limb(0, ly - 0.02, -bl, 0, ly - 0.08, -bl - 0.42, 0.06, 0.012, main, { seg: 7 });
  else if (shape === 'rata') tail.limb(0, ly, -bl, 0, ly + 0.02, -bl - 0.45, 0.014, 0.008, ac, { seg: 5 });
  else tail.limb(0, ly, -bl, 0, ly + 0.05, -bl - 0.22, 0.035, 0.03, ac, { seg: 6 });
  const leg = (): MeshBuilder => new MeshBuilder().limb(0, ly - 0.05, 0, 0, 0.05, 0, 0.05, 0.04, dk, { seg: 7 }).ball(0, 0.03, 0.025, 0.05, 0.04, 0.07, shade(dk, 1.1), { seg: 7, ring: 5 });
  const hl = bh * 0.7, fz = bl * 0.62;
  const parts: RigPart[] = [
    part(body, [0, 0, 0], 'body'),
    part(tail, [0, ly, -bl], 'tail'),
    part(leg().rotate(0, 0, 0, 0, 0, 0, -hl, 0, fz), [-hl, ly - 0.05, fz], 'legA'), part(leg().rotate(0, 0, 0, 0, 0, 0, hl, 0, fz), [hl, ly - 0.05, fz], 'legB'),
    part(leg().rotate(0, 0, 0, 0, 0, 0, -hl, 0, -fz), [-hl, ly - 0.05, -fz], 'legB'), part(leg().rotate(0, 0, 0, 0, 0, 0, hl, 0, -fz), [hl, ly - 0.05, -fz], 'legA'),
  ];
  scaleRig(parts, sc * 1.3);
  return { parts, height: 0.62 * sc * 1.3, flyer: false, shadow: 0.36 * sc * 1.3, style: 'beast' };
}

function spider(l: BeastLook): Rig {
  const main = c(l.main), dk = c(l.dark), ac = c(l.accent), eye = c(l.eye ?? '#ff4a4a');
  const body = new MeshBuilder();
  body.ball(0, 0.26, -0.14, 0.24, 0.22, 0.3, main, { seg: 12, ring: 8 });
  body.ball(0, 0.26, 0.17, 0.17, 0.15, 0.17, dk, { seg: 10, ring: 7 });
  body.ball(0, 0.38, -0.2, 0.08, 0.04, 0.11, ac, { seg: 8, ring: 5 });
  for (const x of [-0.06, 0.06]) for (const y of [0.3, 0.36]) { const n = body.count; body.ball(x, y, 0.32, 0.026, 0.026, 0.02, eye, { seg: 6, ring: 4, lo: 1, hi: 1.1 }); void n; }
  for (const x of [-0.09, 0.09]) body.limb(x, 0.2, 0.3, x * 1.1, 0.12, 0.4, 0.025, 0.012, dk, { seg: 5 });
  const parts: RigPart[] = [part(body, [0, 0, 0], 'body')];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4, z = 0.2 - k * 0.12;
    const m = new MeshBuilder();
    m.limb(side * 0.1, 0.26, z, side * 0.34, 0.4, z + (k - 1.5) * 0.04, 0.032, 0.024, dk, { seg: 6 });
    m.limb(side * 0.34, 0.4, z + (k - 1.5) * 0.04, side * 0.5, 0.0, z + (k - 1.5) * 0.12, 0.024, 0.01, shade(dk, 1.25), { seg: 6 });
    parts.push(part(m, [side * 0.1, 0.26, z], k % 2 ? 'legA' : 'legB', k));
  }
  return { parts, height: 0.55, flyer: false, shadow: 0.42, style: 'beast' };
}

function serpent(l: BeastLook): Rig {
  const main = c(l.main), dk = c(l.dark), ac = c(l.accent);
  const body = new MeshBuilder();
  for (let i = 0; i < 9; i++) body.ball(Math.sin(i * 0.8) * 0.12, 0.08 + (i === 0 ? 0.04 : 0), -i * 0.11, 0.09 - i * 0.006, 0.085 - i * 0.006, 0.09, i % 2 ? dk : main, { seg: 9, ring: 6 });
  body.ball(0, 0.15, 0.1, 0.1, 0.085, 0.13, main, { seg: 10, ring: 7 });
  for (const s of [-1, 1]) body.ball(s * 0.055, 0.19, 0.17, 0.02, 0.024, 0.014, c(l.eye ?? '#ffe040'), { seg: 6, ring: 4, lo: 1, hi: 1.1 });
  body.ribbon([[0, 0.12, 0.22], [0, 0.11, 0.3], [0.03, 0.11, 0.34]], [0.012, 0.01, 0.004], [0, 1, 0], c('#e04a5a'));
  body.ball(0, 0.04, 0.0, 0.08, 0.04, 0.2, ac, { seg: 8, ring: 5 });
  const tail = new MeshBuilder().limb(Math.sin(8 * 0.8) * 0.12, 0.07, -0.88, Math.sin(9 * 0.8) * 0.12, 0.07, -1.1, 0.04, 0.008, main, { seg: 6 });
  return { parts: [part(body, [0, 0, 0], 'body'), part(tail, [0, 0.07, -0.9], 'tail')], height: 0.34, flyer: false, shadow: 0.38, style: 'beast' };
}

function flyer(shape: string, l: BeastLook): Rig {
  const main = c(l.main), dk = c(l.dark), ac = c(l.accent), eye = c(l.eye ?? '#2a2024');
  const body = new MeshBuilder();
  const bat = shape === 'murcielago', fairy = shape === 'hada';
  body.ball(0, 0, 0, 0.14, 0.15, 0.2, main, { seg: 11, ring: 8 });
  body.ball(0, 0.0, 0.04, 0.1, 0.1, 0.15, ac, { seg: 9, ring: 6 });
  body.ball(0, 0.14, 0.17, 0.12, 0.11, 0.11, shade(main, 1.08), { seg: 11, ring: 8 });
  for (const s of [-1, 1]) body.ball(s * 0.05, 0.17, 0.26, 0.022, 0.026, 0.014, eye, { seg: 6, ring: 4, lo: 1, hi: 1.1 });
  if (!fairy) body.limb(0, 0.12, 0.25, 0, 0.1, 0.36, 0.026, 0.008, c('#f0b040'), { seg: 5 });
  if (bat) for (const s of [-1, 1]) { const f = body.count; body.lathe(0, 0, [[0.04, 0], [0.025, 0.1], [0, 0.17]], dk, { seg: 6 }); body.rotate(f, 0, 0, s * 0.2, 0, 0, s * 0.06, 0.22, 0.15); }
  const span = bat ? 0.62 : fairy ? 0.26 : 0.46;
  const wing = (s: number): MeshBuilder => {
    const m = new MeshBuilder();
    const wc = fairy ? c('#d8f4ff') : bat ? dk : ac;
    const top: number[][] = [], w1: number[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      top.push([s * span * t, 0.02 + Math.sin(t * 2.6) * 0.07 - t * 0.02, 0.04 - t * 0.06]);
      w1.push(0.18 * Math.pow(1 - t * 0.85, 0.7));
    }
    m.ribbon(top, w1, [0, 1, 0], wc, { colTip: shade(wc, 1.2) });
    return fairy ? emissive(m, 0) : m;
  };
  const tail = new MeshBuilder().ribbon([[0, 0, -0.18], [0, 0, -0.32], [0, -0.02, -0.46]], [0.045, 0.04, 0.012], [0, 1, 0], dk);
  return { parts: [part(body, [0, 0, 0], 'body'), part(wing(-1), [-0.08, 0.08, 0], 'wingL'), part(wing(1), [0.08, 0.08, 0], 'wingR'), part(tail, [0, 0, 0], 'tail')], height: 0.6, flyer: true, shadow: 0.25, style: 'beast' };
}

function jelly(l: BeastLook): Rig {
  const main = c(l.main), ac = c(l.accent);
  const body = new MeshBuilder();
  body.lathe(0, 0, [[0, 0.5], [0.12, 0.49], [0.24, 0.42], [0.31, 0.3], [0.3, 0.2], [0.22, 0.17], [0.0, 0.2]], mix(main, [1, 1, 1], 0.15), { seg: 14, lo: 0.85, hi: 1.15 });
  body.ball(0, 0.32, 0, 0.14, 0.12, 0.14, mix(main, ac, 0.6), { seg: 9, ring: 6, lo: 1, hi: 1.2 });
  for (const s of [-1, 1]) body.ball(s * 0.09, 0.34, 0.25, 0.034, 0.04, 0.012, c(l.eye ?? '#1a1620'), { seg: 7, ring: 5, lo: 1, hi: 1 });
  const parts: RigPart[] = [part(body, [0, 0, 0], 'body')];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28;
    const m = new MeshBuilder().limb(Math.cos(a) * 0.17, 0.2, Math.sin(a) * 0.17, Math.cos(a) * 0.19, -0.15, Math.sin(a) * 0.19, 0.035, 0.012, ac, { seg: 6 });
    parts.push(part(m, [Math.cos(a) * 0.17, 0.2, Math.sin(a) * 0.17], i % 2 ? 'legA' : 'legB', i));
  }
  return { parts, height: 0.62, flyer: true, shadow: 0.3, style: 'beast' };
}

function beetle(l: BeastLook, sprout: boolean): Rig {
  const main = c(l.main), dk = c(l.dark), ac = c(l.accent);
  const body = new MeshBuilder();
  if (sprout) {
    body.ball(0, 0.2, 0, 0.2, 0.2, 0.2, c('#9a7a4a'), { seg: 11, ring: 8 });
    for (const s of [-1, 1]) body.ball(s * 0.07, 0.24, 0.17, 0.028, 0.036, 0.014, c(l.eye ?? '#1a1620'), { seg: 7, ring: 5, lo: 1, hi: 1 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 6.28 + 0.3, dx = Math.cos(a), dz = Math.sin(a);
      const pp = [[0, 0.38, 0], [dx * 0.2, 0.55, dz * 0.2], [dx * 0.42, 0.56, dz * 0.42], [dx * 0.55, 0.45, dz * 0.55]];
      body.ribbon(pp, [0.035, 0.09, 0.07, 0.015], [0, 1, 0], i % 2 ? main : ac, { colTip: shade(main, 1.25), sway: 1 });
    }
  } else {
    body.ball(0, 0.18, -0.02, 0.26, 0.2, 0.33, main, { seg: 12, ring: 8 });
    body.limb(0, 0.38, -0.3, 0, 0.38, 0.26, 0.012, 0.012, dk, { seg: 5 });
    body.ball(0, 0.16, 0.33, 0.14, 0.11, 0.12, dk, { seg: 10, ring: 6 });
    for (const s of [-1, 1]) {
      body.ball(s * 0.06, 0.2, 0.42, 0.022, 0.026, 0.014, c(l.eye ?? '#ffe070'), { seg: 6, ring: 4, lo: 1, hi: 1.1 });
      body.limb(s * 0.04, 0.15, 0.42, s * 0.12, 0.3, 0.56, 0.03, 0.01, ac, { seg: 6 });
    }
  }
  const parts: RigPart[] = [part(body, [0, 0, 0], 'body')];
  if (!sprout) for (let i = 0; i < 6; i++) { const s = i < 3 ? -1 : 1; parts.push(part(new MeshBuilder().limb(s * 0.2, 0.14, -0.2 + (i % 3) * 0.2, s * 0.4, 0.06, -0.2 + (i % 3) * 0.2, 0.026, 0.016, dk, { seg: 6 }).limb(s * 0.4, 0.06, -0.2 + (i % 3) * 0.2, s * 0.44, 0.0, -0.2 + (i % 3) * 0.2, 0.016, 0.01, dk, { seg: 5 }), [s * 0.2, 0.14, -0.2 + (i % 3) * 0.2], i % 2 ? 'legA' : 'legB')); }
  else for (const s of [-1, 1]) parts.push(part(new MeshBuilder().ball(s * 0.1, 0.05, 0, 0.07, 0.06, 0.09, c('#7a5a38'), { seg: 7, ring: 5 }), [s * 0.1, 0.1, 0], s < 0 ? 'legA' : 'legB'));
  return { parts, height: sprout ? 0.6 : 0.5, flyer: false, shadow: 0.34, style: 'beast' };
}

const HUMANOIDS = new Set(['humanoide', 'goblin', 'esqueleto']);
/** Formas de criatura que el 3D sabe construir. */
export const BEAST_SHAPES: readonly string[] = ['humanoide', 'goblin', 'esqueleto', 'arana', 'serpiente', 'pajaro', 'murcielago', 'hada', 'medusa', 'escarabajo', 'brote', 'lobo', 'zorro', 'nutria', 'lagarto', 'rata', 'armadillo'];

/** Rig de un enemigo o mascota según su forma. */
export function beastRig(shape: string, l: BeastLook, overlay?: string): Rig {
  if (HUMANOIDS.has(shape)) {
    const g = shape === 'goblin', sk = shape === 'esqueleto';
    return humanoidRig({
      skin: sk ? '#e0d8c0' : g ? l.main : '#d6a382', hair: sk ? '#cfc8b0' : l.dark, cloth: sk ? '#c9c0a8' : g ? l.accent : l.main, clothDark: l.dark,
      pants: sk ? '#cfc8b0' : l.dark, overlay, bone: sk, ears: g, scale: g ? 0.8 : sk ? 1 : 1.06, eye: l.eye ?? (sk ? '#ff5a4a' : '#1a1620'), hat: undefined,
    });
  }
  switch (shape) {
    case 'arana': return spider(l);
    case 'serpiente': return serpent(l);
    case 'pajaro': case 'murcielago': case 'hada': return flyer(shape, l);
    case 'medusa': return jelly(l);
    case 'escarabajo': return beetle(l, false);
    case 'brote': return beetle(l, true);
    default: return quadruped(shape, l);
  }
}

// ----------------------------------------------------------- modelos sueltos
export function chestModel(open: boolean): Float32Array {
  const m = new MeshBuilder();
  m.rbox(0, 0, 0, 0.64, 0.34, 0.42, c('#9a6a38'), { r: 0.05 });
  m.rbox(0, 0.0, 0, 0.67, 0.06, 0.45, IRON, { r: 0.025 });
  if (open) {
    const f = m.count;
    m.rbox(0, 0, 0, 0.64, 0.12, 0.42, c('#8a5a30'), { r: 0.05 });
    m.rotate(f, -0.0, 0, 0, 0, 0, 0, 0.34, -0.2);
    const n = m.count;
    m.ball(0, 0.34, 0, 0.26, 0.05, 0.16, c('#ffd75a'), { seg: 9, ring: 4, lo: 1, hi: 1.15 });
    emissive(m, n);
  } else {
    m.ball(0, 0.34, 0, 0.32, 0.14, 0.21, c('#aa7a42'), { seg: 12, ring: 6 });
    m.rbox(0, 0.28, 0.2, 0.08, 0.12, 0.04, c('#ffd75a'), { r: 0.02 });
  }
  return m.toArray();
}
export function oreModel(col: string): Float32Array {
  const m = new MeshBuilder();
  m.ball(0, 0.3, 0, 0.44, 0.38, 0.4, c('#7a7782'), { wob: 0.12, seed: 4, seg: 10 });
  const n = m.count;
  const oc = c(col);
  for (const [x, z, h, t] of [[0.12, 0.1, 0.5, 0.2], [-0.15, 0.05, 0.4, -0.3], [0.0, -0.18, 0.34, 0.1]] as const) {
    const f = m.count;
    m.lathe(0, 0, [[0, 0], [0.07, 0.02], [0.075, h * 0.6], [0.03, h * 0.9], [0, h]], oc, { seg: 6, lo: 0.9, hi: 1.2 });
    m.rotate(f, t, 0, 0, 0, 0, x, 0.35, z);
  }
  emissive(m, n);
  return m.toArray();
}
export function lootModel(col: string): Float32Array {
  const m = new MeshBuilder();
  m.ball(0, 0.14, 0, 0.17, 0.15, 0.17, c('#b8965c'), { seg: 10, ring: 7 });
  m.lathe(0, 0, [[0.05, 0.27], [0.07, 0.3], [0.04, 0.34]], c('#6b4a2e'), { seg: 8 });
  const n = m.count;
  m.lathe(0, 0, [[0, 0.3], [0.07, 0.36], [0.05, 0.44], [0, 0.5]], c(col), { seg: 6, lo: 1, hi: 1.2 });
  emissive(m, n);
  return m.toArray();
}
