/**
 * Catálogo de modelos low-poly (puro): objetos estáticos del mundo y rigs animados
 * (humanoides, cuadrúpedos, arañas, voladores...). Todo se genera por código.
 */
import { MeshBuilder, STRIDE, hexRgb, mix, shade, type RGB } from './mesh';

const c = hexRgb;
const EMIS = 2;

/** Aplica viento a los vértices de la malla según su altura (y0..y1 → 0..amt). */
export function swayByHeight(m: MeshBuilder, y0: number, y1: number, amt: number): MeshBuilder {
  for (let i = 0; i < m.v.length; i += STRIDE) m.v[i + 9] = Math.max(0, Math.min(1, (m.v[i + 1]! - y0) / (y1 - y0))) * amt;
  return m;
}
function emissive(m: MeshBuilder, from: number): MeshBuilder {
  for (let i = from * STRIDE; i < m.v.length; i += STRIDE) m.v[i + 9] = EMIS;
  return m;
}

const BARK = c('#6b4a2e'), BARK2 = c('#4e3a28');
const WOOD = c('#9c6d40'), WOODD = c('#6b4a2e'), STONE = c('#8f8c92'), IRON = c('#3d3f48');

function leafy(seed: number, col: RGB, scale: number): MeshBuilder {
  const m = new MeshBuilder();
  m.cyl(0, 0, 0, 0.13, 0.07, 0.75 * scale, BARK, 6, 0.2, false);
  m.rock(0, 0.45 * scale, 0, 0.62 * scale, 0.5 * scale, 0.6 * scale, col, seed, 7);
  m.rock(0.32 * scale, 0.6 * scale, 0.1, 0.4 * scale, 0.38 * scale, 0.4 * scale, shade(col, 1.12), seed + 3, 6);
  m.rock(-0.25 * scale, 0.75 * scale, -0.15, 0.4 * scale, 0.4 * scale, 0.4 * scale, shade(col, 0.94), seed + 7, 6);
  m.rock(0.02, 1.0 * scale, 0, 0.34 * scale, 0.3 * scale, 0.34 * scale, shade(col, 1.2), seed + 9, 6);
  return swayByHeight(m, 0.3, 1.4 * scale, 1);
}
function conifer(tiers: number, col: RGB, snow: boolean): MeshBuilder {
  const m = new MeshBuilder();
  m.cyl(0, 0, 0, 0.12, 0.08, 0.5, BARK2, 6, 0, false);
  for (let i = 0; i < tiers; i++) {
    const y = 0.28 + i * 0.36, r = 0.7 - i * (0.5 / tiers);
    m.cyl(0, y, 0, r, 0.0, 0.62, shade(col, 0.85 + i * 0.1), 7, 1, false, i);
    if (snow) m.cyl(0, y + 0.24, 0, r * 0.62, 0.0, 0.4, c('#f4f8ff'), 7, 1, false, i);
  }
  return swayByHeight(m, 0.2, 0.28 + tiers * 0.36 + 0.4, 0.9);
}

function props(): Record<string, () => MeshBuilder> {
  return {
    tree0: () => leafy(1, c('#4f8f3a'), 1.15),
    tree1: () => leafy(5, c('#5ea23f'), 1.3),
    tree2: () => leafy(9, c('#3f7d36'), 1.05),
    pine0: () => conifer(4, c('#2f6a3c'), false),
    pine1: () => conifer(3, c('#3a7a42'), false),
    snowpine: () => conifer(4, c('#2f5f4a'), true),
    palm: () => {
      const m = new MeshBuilder();
      for (let i = 0; i < 6; i++) m.cyl(i * 0.025, i * 0.22, 0, 0.1 - i * 0.008, 0.09 - i * 0.008, 0.24, i % 2 ? BARK : shade(BARK, 1.15), 6, 0, false);
      const top = 1.32;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
        const tip = [0.15 + dx * 0.95, top - 0.28, dz * 0.95];
        const px = -dz * 0.12, pz = dx * 0.12;
        m.tri([0.15, top, 0], [0.15 + dx * 0.5 + px, top + 0.12, dz * 0.5 + pz], tip, c('#3f9a45'), 1, 1, 1);
        m.tri([0.15, top, 0], tip, [0.15 + dx * 0.5 - px, top + 0.12, dz * 0.5 - pz], c('#2f7a38'), 1, 1, 1);
        m.tri([0.15, top, 0], tip, [0.15 + dx * 0.5 + px, top + 0.12, dz * 0.5 + pz], c('#3a8a3e'), 1, 1, 1);
      }
      return swayByHeight(m, 0.4, 1.4, 1);
    },
    dead: () => {
      const m = new MeshBuilder();
      m.cyl(0, 0, 0, 0.1, 0.05, 1.0, c('#5a4a34'), 5, 0.2, false);
      m.cyl(0.12, 0.55, 0, 0.04, 0.01, 0.5, c('#5a4a34'), 4, 0.3, false, 0);
      m.cyl(-0.1, 0.7, 0.05, 0.04, 0.01, 0.45, c('#4e3f2c'), 4, 0.3, false, 1);
      return m;
    },
    cactus: () => {
      const m = new MeshBuilder();
      const g = c('#4f9a52');
      m.cyl(0, 0, 0, 0.14, 0.12, 0.85, g, 7, 0.1);
      m.cyl(0.2, 0.3, 0, 0.07, 0.06, 0.4, shade(g, 1.1), 6, 0.1);
      m.box(0.12, 0.3, 0, 0.2, 0.07, 0.07, g);
      m.cyl(-0.19, 0.45, 0, 0.07, 0.06, 0.3, shade(g, 0.95), 6, 0.1);
      m.box(-0.1, 0.45, 0, 0.2, 0.07, 0.07, g);
      return m;
    },
    bush: () => {
      const m = new MeshBuilder();
      m.rock(0, 0, 0, 0.42, 0.42, 0.4, c('#3f8a3c'), 4, 7);
      m.rock(0.22, 0, 0.1, 0.28, 0.3, 0.28, c('#4f9a45'), 8, 6);
      m.rock(-0.18, 0, -0.12, 0.26, 0.28, 0.26, c('#37803a'), 2, 6);
      return swayByHeight(m, 0, 0.45, 0.6);
    },
    rock0: () => new MeshBuilder().rock(0, 0, 0, 0.48, 0.5, 0.44, c('#82808a'), 3, 6).rock(0.3, 0, 0.15, 0.25, 0.26, 0.24, c('#6f6d78'), 5, 5),
    rock1: () => new MeshBuilder().rock(0, 0, 0, 0.4, 0.7, 0.38, c('#8d8a94'), 11, 6).rock(-0.28, 0, 0.1, 0.22, 0.3, 0.2, c('#74727c'), 6, 5),
    rock2: () => new MeshBuilder().rock(0, 0, 0, 0.55, 0.38, 0.5, c('#7a7882'), 7, 7).rock(0.2, 0.05, -0.2, 0.2, 0.3, 0.2, c('#8d8a94'), 2, 5),
    tuft: () => {
      const m = new MeshBuilder();
      const g = c('#6aa646');
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7, dx = Math.cos(a) * 0.05, dz = Math.sin(a) * 0.05;
        m.tri([dx - 0.025, 0, dz], [dx + 0.025, 0, dz], [dx * 3, 0.26 + (i % 2) * 0.1, dz * 3], shade(g, 0.9 + i * 0.08), 0, 0, 1);
      }
      return m;
    },
    flowers: () => {
      const m = new MeshBuilder();
      [['#f2e04a', 0.2, 0.2], ['#f06a8a', 0.7, 0.35], ['#ffffff', 0.4, 0.75], ['#9a7af0', 0.8, 0.8]].forEach(([col, x, z]) => {
        const px = (x as number) - 0.5, pz = (z as number) - 0.5;
        m.cyl(px, 0, pz, 0.012, 0.012, 0.2, c('#4f8f3a'), 3, 0.5, false);
        m.cyl(px, 0.2, pz, 0.06, 0.0, 0.05, c(col as string), 5, 0.6);
      });
      m.append(props().tuft!(), 0, 0, 0.0, 0, 1);
      return m;
    },
    pebble: () => new MeshBuilder().rock(0, 0, 0, 0.1, 0.07, 0.09, c('#8a8780'), 2, 5),
    reed: () => {
      const m = new MeshBuilder();
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 0.05;
        m.tri([x - 0.015, 0, 0], [x + 0.015, 0, 0], [x + 0.03, 0.5 + i * 0.07, 0.03], c('#6f9a4a'), 0, 0, 1);
        m.cyl(x + 0.03, 0.45 + i * 0.07, 0.03, 0.025, 0.02, 0.1, c('#6b4a2e'), 4, 1, true);
      }
      return m;
    },
    lily: () => new MeshBuilder().cyl(0, 0, 0, 0.22, 0.2, 0.012, c('#4f9a4a'), 8, 0, true).append(new MeshBuilder().cyl(0.05, 0.012, 0.05, 0.05, 0.02, 0.04, c('#f4a8c0'), 5), 0, 0, 0),
    mushroom: () => new MeshBuilder().cyl(0, 0, 0, 0.03, 0.025, 0.1, c('#e8e0c8'), 5, 0, false).cyl(0, 0.1, 0, 0.1, 0.0, 0.07, c('#c04a4a'), 6),
    crystal: () => {
      const m = new MeshBuilder();
      const n = m.count;
      m.cyl(0, 0, 0, 0.08, 0, 0.5, c('#6ad8ff'), 5);
      m.cyl(0.1, 0, 0.05, 0.06, 0, 0.32, c('#9ae8ff'), 5);
      m.cyl(-0.08, 0, 0.06, 0.05, 0, 0.26, c('#4ab8f0'), 5);
      void n;
      return emissive(m, 0);
    },
    well: () => {
      const m = new MeshBuilder();
      m.cyl(0, 0, 0, 0.42, 0.4, 0.45, STONE, 8);
      m.cyl(0, 0.4, 0, 0.3, 0.3, 0.02, c('#2a5a7a'), 8);
      m.box(-0.36, 0, 0, 0.07, 0.95, 0.07, WOODD);
      m.box(0.36, 0, 0, 0.07, 0.95, 0.07, WOODD);
      m.box(0, 0.92, 0, 0.85, 0.06, 0.08, WOODD);
      m.cyl(0, 0.98, 0, 0.5, 0.0, 0.3, c('#a04a3a'), 4, 0, false, Math.PI / 4);
      return m;
    },
    sign: () => new MeshBuilder().box(0, 0, 0, 0.07, 0.8, 0.07, WOODD).box(0, 0.5, 0, 0.55, 0.28, 0.05, WOOD).box(0, 0.54, 0.03, 0.4, 0.04, 0.01, c('#3a2618')),
    lamp: () => {
      const m = new MeshBuilder().box(0, 0, 0, 0.06, 1.0, 0.06, IRON).box(0.12, 0.95, 0, 0.3, 0.04, 0.04, IRON);
      const n = m.count;
      m.box(0.25, 0.72, 0, 0.14, 0.2, 0.14, c('#ffd070'));
      return emissive(m, n);
    },
    streetlamp: () => {
      const m = new MeshBuilder().cyl(0, 0, 0, 0.07, 0.04, 1.6, IRON, 6).box(0, 1.55, 0, 0.3, 0.05, 0.3, IRON);
      const n = m.count;
      m.box(0, 1.6, 0, 0.18, 0.24, 0.18, c('#ffd884'));
      emissive(m, n);
      m.cyl(0, 1.84, 0, 0.17, 0.0, 0.14, IRON, 4);
      return m;
    },
    grave: () => new MeshBuilder().box(0, 0, 0, 0.5, 0.06, 0.8, c('#5a6a4a')).box(0, 0.05, -0.28, 0.34, 0.55, 0.1, c('#8a8892')).box(0, 0.5, -0.28, 0.24, 0.12, 0.1, c('#9a98a2')),
    fenceX: () => new MeshBuilder().box(-0.45, 0, 0, 0.09, 0.62, 0.09, WOODD).box(0.45, 0, 0, 0.09, 0.62, 0.09, WOODD).box(0, 0.4, 0, 1, 0.07, 0.05, WOOD).box(0, 0.2, 0, 1, 0.07, 0.05, WOOD),
    fenceZ: () => new MeshBuilder().box(0, 0, -0.45, 0.09, 0.62, 0.09, WOODD).box(0, 0, 0.45, 0.09, 0.62, 0.09, WOODD).box(0, 0.4, 0, 0.05, 0.07, 1, WOOD).box(0, 0.2, 0, 0.05, 0.07, 1, WOOD),
    fenceP: () => new MeshBuilder().box(0, 0, 0, 0.1, 0.62, 0.1, WOODD),
    doorframe: () => new MeshBuilder().box(-0.42, 0, 0, 0.14, 1.1, 0.2, WOODD).box(0.42, 0, 0, 0.14, 1.1, 0.2, WOODD).box(0, 1.0, 0, 1, 0.14, 0.22, WOOD),
    cave: () => {
      const m = new MeshBuilder();
      m.box(0, 0, -0.1, 0.8, 0.95, 0.5, c('#0a0810'));
      m.rock(-0.5, 0, 0, 0.32, 1.2, 0.5, c('#6d6a74'), 2, 6);
      m.rock(0.5, 0, 0, 0.32, 1.2, 0.5, c('#76737e'), 4, 6);
      m.rock(0, 0.8, 0.0, 0.6, 0.5, 0.45, c('#6a6772'), 8, 7);
      return m;
    },
    stairsDown: () => {
      const m = new MeshBuilder().box(0, 0, 0, 0.9, 0.03, 0.9, c('#14111a'));
      for (let i = 0; i < 4; i++) m.box(0, 0.03, -0.3 + i * 0.2, 0.86 - i * 0.06, 0.02, 0.1, shade(c('#4a4450'), 0.7 + i * 0.12));
      return m;
    },
    stairsUp: () => {
      const m = new MeshBuilder();
      for (let i = 0; i < 4; i++) m.box(0, 0, 0.3 - i * 0.2, 0.9, 0.12 + i * 0.12, 0.2, shade(c('#7a7482'), 0.85 + i * 0.07));
      return m;
    },
    counter: () => new MeshBuilder().box(0, 0, 0, 1, 0.62, 0.62, WOOD).box(0, 0.62, 0, 1.06, 0.06, 0.68, WOODD),
    table: () => {
      const m = new MeshBuilder().box(0, 0.5, 0, 0.9, 0.07, 0.7, WOOD);
      for (const [x, z] of [[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]] as const) m.box(x, 0, z, 0.07, 0.5, 0.07, WOODD);
      return m;
    },
    barrel: () => new MeshBuilder().cyl(0, 0, 0, 0.3, 0.3, 0.62, c('#8a5a30'), 8).cyl(0, 0.18, 0, 0.325, 0.325, 0.05, IRON, 8, 0, false).cyl(0, 0.4, 0, 0.325, 0.325, 0.05, IRON, 8, 0, false),
    shelf: () => {
      const m = new MeshBuilder().box(0, 0, 0, 0.92, 1.3, 0.4, c('#5a3d24'));
      const cols = ['#a04a3a', '#3a5a9a', '#3a8a4a', '#d8b050'];
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) m.box(-0.33 + i * 0.22, 0.12 + r * 0.38, 0.18, 0.15, 0.26, 0.06, c(cols[(i + r) % 4]!));
      return m;
    },
    hearth: () => {
      const m = new MeshBuilder().box(0, 0, -0.1, 1, 0.9, 0.7, c('#6a6670')).box(0, 0.9, -0.25, 0.5, 1.0, 0.4, c('#5c5862'));
      const n = m.count;
      m.box(0, 0.05, 0.28, 0.6, 0.35, 0.05, c('#ff9a3a'));
      return emissive(m, n);
    },
    bed: () => new MeshBuilder().box(0, 0, 0, 0.75, 0.25, 0.95, WOODD).box(0, 0.25, 0.05, 0.68, 0.12, 0.8, c('#b04a4a')).box(0, 0.37, -0.32, 0.5, 0.08, 0.2, c('#eee6d0')),
    anvil: () => new MeshBuilder().box(0, 0, 0, 0.5, 0.35, 0.4, c('#4a4852')).box(0, 0.35, 0, 0.7, 0.2, 0.35, c('#5e5c68')).box(0.38, 0.4, 0, 0.18, 0.1, 0.2, c('#5e5c68')),
    altar: () => {
      const m = new MeshBuilder().box(0, 0, 0, 0.9, 0.6, 0.6, c('#8d8a94')).box(0, 0.6, 0, 1.0, 0.08, 0.7, c('#aaa6b0'));
      const n = m.count;
      m.cyl(0, 0.68, 0, 0.06, 0.04, 0.28, c('#ffe08a'), 5);
      return emissive(m, n);
    },
    tent: () => {
      const m = new MeshBuilder();
      const a = c('#b0503a'), b = c('#d8c69a');
      m.tri([-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 0.95, 0], a);
      m.tri([0.5, 0, -0.5], [-0.5, 0, -0.5], [0, 0.95, 0], shade(a, 0.7));
      m.quad([0.5, 0, 0.5], [0.5, 0, -0.5], [0, 0.95, 0], [0, 0.95, 0], shade(b, 0.9));
      m.quad([-0.5, 0, -0.5], [-0.5, 0, 0.5], [0, 0.95, 0], [0, 0.95, 0], shade(b, 0.75));
      m.tri([-0.12, 0, 0.51], [0.12, 0, 0.51], [0, 0.5, 0.35], c('#2a1c14'));
      return m;
    },
    campfire: () => {
      const m = new MeshBuilder();
      for (let i = 0; i < 6; i++) m.rock(Math.cos(i) * 0.28, 0, Math.sin(i) * 0.28, 0.09, 0.09, 0.09, c('#8a8780'), i, 5);
      m.box(0, 0.02, 0, 0.5, 0.07, 0.07, WOODD).box(0, 0.02, 0, 0.07, 0.07, 0.5, WOODD);
      const n = m.count;
      m.cyl(0, 0.08, 0, 0.16, 0.0, 0.5, c('#ff8a2a'), 5, 0.4);
      m.cyl(0, 0.1, 0, 0.09, 0.0, 0.34, c('#ffd75a'), 5, 0.4);
      return emissive(m, n);
    },
    torch: () => {
      const m = new MeshBuilder().box(0, 0, 0, 0.05, 0.4, 0.05, WOODD);
      const n = m.count;
      m.cyl(0, 0.4, 0, 0.07, 0.0, 0.22, c('#ffb040'), 5, 0.3);
      return emissive(m, n);
    },
    chimney: () => new MeshBuilder().box(0, 0, 0, 0.3, 0.55, 0.3, c('#7a6a60')).box(0, 0.55, 0, 0.38, 0.06, 0.38, c('#5a4a44')),
  };
}

const PROPS = props();
export const STATIC_MODELS = Object.keys(PROPS);
const cacheStatic = new Map<string, Float32Array>();
export function staticModel(id: string): Float32Array | null {
  let a = cacheStatic.get(id);
  if (!a) {
    const f = PROPS[id];
    if (!f) return null;
    a = f().toArray();
    cacheStatic.set(id, a);
  }
  return a;
}

// ===================================================================== RIGS
export type PartAnim = 'none' | 'legL' | 'legR' | 'armL' | 'armR' | 'wingL' | 'wingR' | 'tail' | 'legA' | 'legB' | 'body' | 'tent';
export interface RigPart { mesh: Float32Array; pivot: [number, number, number]; anim: PartAnim; phase: number }
export interface Rig {
  parts: RigPart[];
  /** Altura aproximada para etiquetas. */
  height: number;
  flyer: boolean;
  /** Radio de la sombra. */
  shadow: number;
}

const part = (m: MeshBuilder, pivot: [number, number, number], anim: PartAnim = 'none', phase = 0): RigPart => ({ mesh: m.toArray(), pivot, anim, phase });
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
  const body = new MeshBuilder();
  // Torso
  body.box(0, 0.36, 0, 0.36, 0.36, 0.2, cloth);
  body.box(0, 0.36, 0, 0.375, 0.06, 0.215, cd); // cinturón
  if (robe) body.cyl(0, 0.1, 0, 0.27, 0.2, 0.3, cloth, 7);
  // Cabeza
  const hy = 0.74;
  body.box(0, hy, 0, 0.26, 0.26, 0.26, skin);
  body.box(0, hy + 0.2, -0.01, 0.285, 0.08, 0.285, hair, 0, hair);
  body.box(0, hy + 0.05, -0.12, 0.285, 0.2, 0.06, hair);
  if (!l.bone) {
    body.box(-0.065, hy + 0.1, 0.135, 0.05, 0.05, 0.02, c(l.eye ?? '#10101a'));
    body.box(0.065, hy + 0.1, 0.135, 0.05, 0.05, 0.02, c(l.eye ?? '#10101a'));
  } else {
    body.box(-0.065, hy + 0.1, 0.135, 0.06, 0.07, 0.02, c(l.eye ?? '#e04040'), 0, c('#e04040'));
    body.box(0.065, hy + 0.1, 0.135, 0.06, 0.07, 0.02, c(l.eye ?? '#e04040'));
  }
  if (l.ears) {
    body.cyl(-0.19, hy + 0.1, 0, 0.1, 0, 0.0, skin, 3);
    body.tri([-0.13, hy + 0.15, 0], [-0.34, hy + 0.22, 0], [-0.13, hy + 0.04, 0], skin);
    body.tri([0.13, hy + 0.04, 0], [0.34, hy + 0.22, 0], [0.13, hy + 0.15, 0], skin);
  }
  // Gorros y capas por clase.
  const hat = l.hat ? c(l.hat) : cloth;
  switch (ov) {
    case 'mago': body.cyl(0, hy + 0.23, 0, 0.24, 0.1, 0.05, hat, 7).cyl(0, hy + 0.27, 0, 0.14, 0.0, 0.34, hat, 7); break;
    case 'bardo': body.cyl(0, hy + 0.23, 0, 0.2, 0.15, 0.1, hat, 7).tri([0.05, hy + 0.3, 0.1], [0.3, hy + 0.5, 0], [0.12, hy + 0.3, 0.1], c('#f0d060')); break;
    case 'guerrero': case 'barbaro': {
      body.box(0, hy + 0.16, 0, 0.3, 0.14, 0.3, c('#9ca0aa'));
      body.box(0, hy - 0.02, 0.14, 0.05, 0.16, 0.02, c('#9ca0aa'));
      if (ov === 'barbaro') { body.tri([-0.15, hy + 0.2, 0], [-0.3, hy + 0.42, 0], [-0.1, hy + 0.3, 0], c('#e8e0c8')); body.tri([0.1, hy + 0.3, 0], [0.3, hy + 0.42, 0], [0.15, hy + 0.2, 0], c('#e8e0c8')); }
      body.box(-0.24, 0.62, 0, 0.14, 0.1, 0.26, c('#9ca0aa'));
      body.box(0.24, 0.62, 0, 0.14, 0.1, 0.26, c('#9ca0aa'));
      break;
    }
    case 'picaro': case 'explorador': body.cyl(0, hy + 0.12, 0, 0.22, 0.12, 0.16, hat, 6).box(0, hy + 0.2, -0.14, 0.3, 0.2, 0.1, hat); if (ov === 'explorador') body.tri([0.1, hy + 0.3, 0], [0.34, hy + 0.5, -0.1], [0.14, hy + 0.3, 0.05], c('#60c070')); break;
    case 'clerigo': body.cyl(0, hy + 0.3, 0, 0.18, 0.18, 0.02, c('#ffe08a'), 8); break;
    case 'druida': body.box(0, hy + 0.23, 0, 0.3, 0.06, 0.3, c('#4f8f3a')); body.tri([-0.1, hy + 0.27, 0], [-0.2, hy + 0.5, 0], [0, hy + 0.27, 0], c('#6aa646')); body.tri([0.0, hy + 0.27, 0], [0.2, hy + 0.5, 0], [0.1, hy + 0.27, 0], c('#6aa646')); break;
    default: if (l.hat) body.cyl(0, hy + 0.22, 0, 0.18, 0.12, 0.1, hat, 6);
  }
  if (ov === 'picaro' || ov === 'explorador') body.box(0, 0.4, -0.13, 0.3, 0.34, 0.05, dark(cloth));
  if (ov === 'guerrero' || ov === 'barbaro') body.box(0.28, 0.18, 0.12, 0.05, 0.56, 0.05, c('#c8ccd8')).box(0.28, 0.18, 0.12, 0.16, 0.04, 0.06, c('#7a5a30'));
  if (ov === 'mago' || ov === 'druida') body.box(-0.3, 0.0, 0.1, 0.04, 1.0, 0.04, WOODD).cyl(-0.3, 1.0, 0.1, 0.07, 0.0, 0.12, ov === 'mago' ? c('#8ad8ff') : c('#7ad060'), 5);
  if (ov === 'bardo') body.box(-0.27, 0.3, 0.14, 0.14, 0.2, 0.06, c('#b87a3a'));
  if (ov === 'clerigo') body.box(0, 0.4, 0.11, 0.06, 0.18, 0.02, c('#ffe08a'));
  const sk = l.bone ? c('#e0d8c0') : skin;
  const arm = (side: number): MeshBuilder => new MeshBuilder().box(0, -0.3, 0, 0.1, 0.32, 0.12, robe || ov === 'guerrero' ? cloth : cloth).box(0, -0.34, 0, 0.1, 0.07, 0.125, sk, 0, sk).append(new MeshBuilder(), side, 0, 0);
  const leg = (): MeshBuilder => new MeshBuilder().box(0, -0.38, 0, 0.14, 0.38, 0.16, pants).box(0, -0.38, 0.015, 0.145, 0.08, 0.19, c('#3a2c22'));
  const sc = l.scale ?? 1;
  const parts = [
    part(body, [0, 0, 0], 'body'),
    part(leg(), [-0.09, 0.38, 0], 'legL'), part(leg(), [0.09, 0.38, 0], 'legR'),
    part(arm(-1), [-0.23, 0.68, 0], 'armL'), part(arm(1), [0.23, 0.68, 0], 'armR'),
  ];
  if (sc !== 1) for (const p of parts) { for (let i = 0; i < p.mesh.length; i += STRIDE) { p.mesh[i]! *= sc; p.mesh[i + 1]! *= sc; p.mesh[i + 2]! *= sc; } p.pivot = [p.pivot[0] * sc, p.pivot[1] * sc, p.pivot[2] * sc]; }
  return { parts, height: 1.05 * sc, flyer: false, shadow: 0.3 * sc };
}

export interface BeastLook { main: string; dark: string; accent: string; eye?: string | undefined; boss?: boolean }

/** Cuerpo de cuadrúpedo con variantes por forma. */
function quadruped(shape: string, l: BeastLook): Rig {
  const main = c(l.main), dk = c(l.dark), ac = c(l.accent), eye = c(l.eye ?? '#ffe070');
  const long = shape === 'lobo' || shape === 'zorro' || shape === 'nutria' || shape === 'lagarto' || shape === 'rata';
  const sc = shape === 'rata' ? 0.55 : shape === 'lobo' ? 0.95 : shape === 'armadillo' ? 0.75 : shape === 'zorro' ? 0.8 : shape === 'lagarto' ? 0.8 : 0.7;
  const bl = long ? 0.62 : 0.46, bh = shape === 'armadillo' ? 0.34 : 0.3;
  const body = new MeshBuilder();
  const ly = 0.26;
  body.box(0, ly, 0, bh, bh, bl, main);
  if (shape === 'armadillo') { body.cyl(0, ly + 0.12, 0, 0.3, 0.2, 0.2, shade(main, 0.9), 7); for (let i = 0; i < 3; i++) body.box(0, ly + 0.3, -0.12 + i * 0.12, 0.26, 0.02, 0.025, dk); }
  else body.box(0, ly + bh - 0.04, 0.0, bh * 0.9, 0.06, bl * 0.8, dk);
  body.box(0, ly + 0.02, bl * 0.2, bh * 0.85, bh * 0.45, bl * 0.5, ac);
  // Cabeza
  const hz = bl / 2 + 0.1;
  body.box(0, ly + 0.2, hz, 0.24, 0.24, 0.24, main);
  body.box(0, ly + 0.16, hz + 0.16, 0.14, 0.12, 0.16, shade(main, 1.15));
  body.box(0, ly + 0.2, hz + 0.25, 0.06, 0.05, 0.03, c('#1a1418'));
  body.box(-0.07, ly + 0.28, hz + 0.1, 0.045, 0.045, 0.03, eye, 0, eye);
  body.box(0.07, ly + 0.28, hz + 0.1, 0.045, 0.045, 0.03, eye);
  if (shape === 'lobo' || shape === 'zorro') { body.tri([-0.12, ly + 0.32, hz - 0.04], [-0.1, ly + 0.55, hz - 0.08], [-0.02, ly + 0.32, hz - 0.04], dk); body.tri([0.02, ly + 0.32, hz - 0.04], [0.1, ly + 0.55, hz - 0.08], [0.12, ly + 0.32, hz - 0.04], dk); }
  else if (shape === 'rata' || shape === 'nutria') { body.cyl(-0.1, ly + 0.34, hz - 0.03, 0.06, 0.05, 0.02, ac, 6); body.cyl(0.1, ly + 0.34, hz - 0.03, 0.06, 0.05, 0.02, ac, 6); }
  const tail = new MeshBuilder();
  if (shape === 'zorro') { tail.cyl(0, 0, -0.1, 0.1, 0.05, 0.45, ac, 5); tail.cyl(0, 0.2, -0.28, 0.0, 0.0, 0.0, ac, 3); }
  else if (shape === 'lobo') tail.box(0, -0.03, -0.18, 0.08, 0.08, 0.4, dk);
  else tail.box(0, -0.02, -0.2, 0.04, 0.04, 0.4, ac);
  const leg = (): MeshBuilder => new MeshBuilder().box(0, -0.26, 0, 0.09, 0.26, 0.09, dk);
  const hl = bh / 2 - 0.02, fz = bl / 2 - 0.08;
  const parts: RigPart[] = [
    part(body, [0, 0, 0], 'body'),
    part(tail, [0, ly + 0.15, -bl / 2], 'tail'),
    part(leg(), [-hl, ly, fz], 'legA'), part(leg(), [hl, ly, fz], 'legB'),
    part(leg(), [-hl, ly, -fz], 'legB'), part(leg(), [hl, ly, -fz], 'legA'),
  ];
  for (const p of parts) { for (let i = 0; i < p.mesh.length; i += STRIDE) { p.mesh[i]! *= sc * 1.15; p.mesh[i + 1]! *= sc * 1.15; p.mesh[i + 2]! *= sc * 1.15; } p.pivot = [p.pivot[0] * sc * 1.15, p.pivot[1] * sc * 1.15, p.pivot[2] * sc * 1.15]; }
  return { parts, height: 0.75 * sc * 1.15, flyer: false, shadow: 0.34 * sc * 1.3 };
}

function spider(l: BeastLook): Rig {
  const main = c(l.main), dk = c(l.dark), ac = c(l.accent), eye = c(l.eye ?? '#ff4040');
  const body = new MeshBuilder();
  body.rock(0, 0.22, -0.12, 0.26, 0.24, 0.3, main, 3, 7);
  body.rock(0, 0.24, 0.2, 0.18, 0.18, 0.18, dk, 5, 6);
  body.box(0, 0.36, -0.2, 0.1, 0.05, 0.12, ac);
  for (const x of [-0.06, 0.06]) for (const y of [0.3, 0.36]) body.box(x, y, 0.36, 0.04, 0.04, 0.03, eye, 0, eye);
  const parts: RigPart[] = [part(body, [0, 0, 0], 'body')];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4, z = 0.2 - k * 0.14;
    const m = new MeshBuilder();
    m.box(side * 0.18, 0, 0, 0.36, 0.045, 0.045, dk);
    m.box(side * 0.37, -0.12, 0, 0.045, 0.28, 0.045, shade(dk, 1.2));
    parts.push(part(m, [side * 0.06, 0.25, z], k % 2 ? 'legA' : 'legB', k));
  }
  return { parts, height: 0.55, flyer: false, shadow: 0.4 };
}

function serpent(l: BeastLook): Rig {
  const main = c(l.main), dk = c(l.dark), ac = c(l.accent);
  const body = new MeshBuilder();
  for (let i = 0; i < 7; i++) body.cyl(Math.sin(i * 0.9) * 0.1, 0, -i * 0.15, 0.09 - i * 0.008, 0.09 - i * 0.008, 0.12 + (i === 0 ? 0.05 : 0), i % 2 ? dk : main, 6, 0, true);
  body.box(0, 0.05, 0.12, 0.17, 0.12, 0.2, main);
  body.box(-0.05, 0.12, 0.2, 0.03, 0.03, 0.02, c(l.eye ?? '#ffe040'), 0, c('#ffe040'));
  body.box(0.05, 0.12, 0.2, 0.03, 0.03, 0.02, c(l.eye ?? '#ffe040'));
  body.box(0, 0.0, 0.24, 0.02, 0.01, 0.1, ac);
  const tail = new MeshBuilder().cyl(0, 0, -0.2, 0.05, 0.0, 0.0, main, 3);
  return { parts: [part(body, [0, 0, 0], 'body'), part(tail, [0, 0.05, -1.0], 'tail')], height: 0.3, flyer: false, shadow: 0.35 };
}

function flyer(shape: string, l: BeastLook): Rig {
  const main = c(l.main), dk = c(l.dark), ac = c(l.accent), eye = c(l.eye ?? '#ffe070');
  const body = new MeshBuilder();
  const bat = shape === 'murcielago', fairy = shape === 'hada';
  body.rock(0, 0, 0, 0.14, 0.16, 0.2, main, 2, 6);
  body.box(0, 0.12, 0.18, 0.14, 0.14, 0.14, shade(main, 1.1));
  body.box(-0.04, 0.17, 0.26, 0.03, 0.03, 0.02, eye, 0, eye);
  body.box(0.04, 0.17, 0.26, 0.03, 0.03, 0.02, eye);
  if (!fairy) body.box(0, 0.12, 0.28, 0.04, 0.03, 0.06, ac);
  if (bat) { body.tri([-0.07, 0.22, 0.16], [-0.1, 0.38, 0.14], [-0.01, 0.22, 0.16], dk); body.tri([0.01, 0.22, 0.16], [0.1, 0.38, 0.14], [0.07, 0.22, 0.16], dk); }
  const span = bat ? 0.55 : fairy ? 0.22 : 0.42;
  const wing = (s: number): MeshBuilder => {
    const m = new MeshBuilder();
    const wc = fairy ? c('#d8f4ff') : bat ? dk : ac;
    m.tri([0, 0, 0.12], [s * span, 0.06, 0.02], [0, 0, -0.14], wc, 0, 0, 0);
    m.tri([0, 0, 0.12], [0, 0, -0.14], [s * span, 0.06, 0.02], shade(wc, 0.8), 0, 0, 0);
    return fairy ? emissive(m, 0) : m;
  };
  const tail = new MeshBuilder().tri([-0.05, 0, -0.2], [0.05, 0, -0.2], [0, 0, -0.45], dk).tri([0.05, 0, -0.2], [-0.05, 0, -0.2], [0, 0, -0.45], dk);
  return { parts: [part(body, [0, 0, 0], 'body'), part(wing(-1), [-0.08, 0.08, 0], 'wingL'), part(wing(1), [0.08, 0.08, 0], 'wingR'), part(tail, [0, 0, 0], 'tail')], height: 0.6, flyer: true, shadow: 0.25 };
}

function jelly(l: BeastLook): Rig {
  const main = c(l.main), ac = c(l.accent);
  const body = new MeshBuilder();
  body.cyl(0, 0.2, 0, 0.3, 0.12, 0.28, mix(main, [1, 1, 1], 0.2), 8);
  body.rock(0, 0.3, 0, 0.28, 0.25, 0.28, main, 3, 8);
  body.box(-0.08, 0.28, 0.24, 0.05, 0.05, 0.02, c(l.eye ?? '#10101a'));
  body.box(0.08, 0.28, 0.24, 0.05, 0.05, 0.02, c(l.eye ?? '#10101a'));
  const parts: RigPart[] = [part(body, [0, 0, 0], 'body')];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.28;
    parts.push(part(new MeshBuilder().cyl(0, -0.3, 0, 0.04, 0.02, 0.3, ac, 4), [Math.cos(a) * 0.17, 0.24, Math.sin(a) * 0.17], i % 2 ? 'legA' : 'legB', i));
  }
  return { parts, height: 0.6, flyer: true, shadow: 0.3 };
}

function beetle(l: BeastLook, sprout: boolean): Rig {
  const main = c(l.main), dk = c(l.dark), ac = c(l.accent);
  const body = new MeshBuilder();
  if (sprout) {
    body.cyl(0, 0.05, 0, 0.18, 0.14, 0.3, c('#8a6a40'), 7);
    body.box(-0.06, 0.2, 0.15, 0.04, 0.05, 0.02, c(l.eye ?? '#10101a'));
    body.box(0.06, 0.2, 0.15, 0.04, 0.05, 0.02, c(l.eye ?? '#10101a'));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28; body.tri([0, 0.35, 0], [Math.cos(a) * 0.4, 0.6, Math.sin(a) * 0.4], [Math.cos(a + 0.5) * 0.15, 0.4, Math.sin(a + 0.5) * 0.15], i % 2 ? main : ac, 0, 1, 0); body.tri([0, 0.35, 0], [Math.cos(a + 0.5) * 0.15, 0.4, Math.sin(a + 0.5) * 0.15], [Math.cos(a) * 0.4, 0.6, Math.sin(a) * 0.4], dk, 0, 0, 1); }
  } else {
    body.rock(0, 0.12, 0, 0.26, 0.26, 0.34, main, 6, 7);
    body.box(0, 0.4, 0, 0.02, 0.01, 0.5, dk);
    body.box(0, 0.12, 0.34, 0.2, 0.16, 0.14, dk);
    body.box(-0.04, 0.22, 0.4, 0.03, 0.03, 0.02, c(l.eye ?? '#ffe070'));
    body.box(0.04, 0.22, 0.4, 0.03, 0.03, 0.02, c(l.eye ?? '#ffe070'));
    body.tri([-0.04, 0.2, 0.46], [-0.1, 0.34, 0.6], [0, 0.2, 0.46], ac);
    body.tri([0, 0.2, 0.46], [0.1, 0.34, 0.6], [0.04, 0.2, 0.46], ac);
  }
  const parts: RigPart[] = [part(body, [0, 0, 0], 'body')];
  if (!sprout) for (let i = 0; i < 6; i++) { const s = i < 3 ? -1 : 1; parts.push(part(new MeshBuilder().box(s * 0.14, -0.06, 0, 0.3, 0.04, 0.04, dk), [s * 0.1, 0.14, -0.2 + (i % 3) * 0.2], i % 2 ? 'legA' : 'legB')); }
  else for (const s of [-1, 1]) parts.push(part(new MeshBuilder().box(0, -0.1, 0, 0.1, 0.12, 0.12, c('#6a4a30')), [s * 0.1, 0.1, 0], s < 0 ? 'legA' : 'legB'));
  return { parts, height: 0.55, flyer: false, shadow: 0.32 };
}

const HUMANOIDS = new Set(['humanoide', 'goblin', 'esqueleto']);

/** Rig de un enemigo o mascota según su forma. */
export function beastRig(shape: string, l: BeastLook, overlay?: string): Rig {
  if (HUMANOIDS.has(shape)) {
    const g = shape === 'goblin', sk = shape === 'esqueleto';
    return humanoidRig({
      skin: sk ? '#e0d8c0' : g ? l.main : '#d6a382', hair: sk ? '#cfc8b0' : l.dark, cloth: sk ? '#c9c0a8' : g ? l.accent : l.main, clothDark: l.dark,
      pants: sk ? '#cfc8b0' : l.dark, overlay, bone: sk, ears: g, scale: g ? 0.78 : sk ? 1 : 1.05, eye: l.eye ?? (sk ? '#e04040' : '#10101a'), hat: undefined,
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

/** Cofre cerrado/abierto, veta de mineral, saco de botín y flecha guía: modelos sueltos. */
export function chestModel(open: boolean): Float32Array {
  const m = new MeshBuilder();
  m.box(0, 0, 0, 0.62, 0.32, 0.4, c('#8a5a30'));
  m.box(0, 0.0, 0, 0.64, 0.06, 0.42, IRON);
  if (open) { m.box(0, 0.32, -0.28, 0.62, 0.05, 0.3, c('#7a4a28')); const n = m.count; m.box(0, 0.3, 0, 0.5, 0.04, 0.3, c('#ffd75a')); emissive(m, n); }
  else { m.cyl(0, 0.32, 0, 0.2, 0.2, 0.62, c('#9a6a38'), 8, 0, true, 0); m.box(0, 0.32, 0.2, 0.08, 0.1, 0.03, c('#ffd75a'), 0, c('#ffd75a')); }
  return m.toArray();
}
export function oreModel(col: string): Float32Array {
  const m = new MeshBuilder();
  m.rock(0, 0, 0, 0.42, 0.55, 0.4, c('#6f6c76'), 4, 6);
  const n = m.count;
  const oc = c(col);
  for (const [x, z, h] of [[0.12, 0.1, 0.45], [-0.15, 0.05, 0.35], [0.0, -0.18, 0.3]] as const) m.cyl(x, 0.2, z, 0.08, 0.0, h, oc, 5);
  emissive(m, n);
  return m.toArray();
}
export function lootModel(col: string): Float32Array {
  const m = new MeshBuilder();
  m.rock(0, 0, 0, 0.16, 0.2, 0.16, c('#a88a58'), 2, 6);
  m.cyl(0, 0.16, 0, 0.05, 0.03, 0.08, c('#6b4a2e'), 5);
  const n = m.count;
  m.cyl(0, 0.26, 0, 0.06, 0.0, 0.1, c(col), 4);
  emissive(m, n);
  return m.toArray();
}
export function arrowModel(): Float32Array {
  const m = new MeshBuilder();
  const col = c('#a8f08a');
  m.tri([0, 0.02, 0.5], [-0.28, 0.02, 0], [0.28, 0.02, 0], col);
  m.quad([-0.1, 0.02, 0], [-0.1, 0.02, -0.4], [0.1, 0.02, -0.4], [0.1, 0.02, 0], col);
  const a = new Float32Array(m.v);
  for (let i = 0; i < a.length; i += STRIDE) a[i + 9] = EMIS;
  return a;
}
export function ringModel(col: string): Float32Array {
  const m = new MeshBuilder();
  const cc = c(col);
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * 6.283, a1 = ((i + 1) / 16) * 6.283;
    m.quad([Math.cos(a0) * 0.5, 0.03, Math.sin(a0) * 0.5], [Math.cos(a0) * 0.38, 0.03, Math.sin(a0) * 0.38], [Math.cos(a1) * 0.38, 0.03, Math.sin(a1) * 0.38], [Math.cos(a1) * 0.5, 0.03, Math.sin(a1) * 0.5], cc);
  }
  const a = new Float32Array(m.v);
  for (let i = 0; i < a.length; i += STRIDE) a[i + 9] = EMIS;
  return a;
}
export function beamModel(col: string): Float32Array {
  const m = new MeshBuilder();
  const cc = c(col);
  m.cyl(0, 0, 0, 0.12, 0.05, 2.4, cc, 6, 0, false);
  const a = new Float32Array(m.v);
  for (let i = 0; i < a.length; i += STRIDE) a[i + 9] = EMIS;
  return a;
}
export function dotModel(): Float32Array {
  const m = new MeshBuilder();
  m.cyl(0, 0.04, 0, 0.09, 0.07, 0.02, c('#ffffff'), 6);
  const a = new Float32Array(m.v);
  for (let i = 0; i < a.length; i += STRIDE) a[i + 9] = EMIS;
  return a;
}
