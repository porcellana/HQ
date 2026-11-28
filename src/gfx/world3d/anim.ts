/**
 * Animación de los rigs (pura y testeable): idle, caminar, atacar, lanzar, recibir golpe, morir,
 * celebrar y defender. Devuelve una pose (giros por pieza + movimiento del cuerpo) y
 * `rigMatrices` la convierte en una matriz por pieza.
 */
import { ident, mul, rotX, rotZ, translate, type Mat4 } from './mat';
import type { PartAnim, Rig } from './models';

export type AnimState = 'idle' | 'walk' | 'attack' | 'cast' | 'hurt' | 'die' | 'cheer' | 'defend';

export interface AnimInput {
  state: AnimState;
  /** Progreso 0..1 en estados con duración (ataque, golpe, muerte). */
  k: number;
  /** Reloj global (s) y fase de zancada. */
  time: number;
  walkT: number;
  /** 0..1: cuánto camina (amplitud de zancada). */
  walk: number;
  seed: number;
}

export interface BodyPose { dy: number; dz: number; rx: number; rz: number; sy: number }
export interface PartPose { rx: number; rz: number }
export interface Pose { body: BodyPose; arms: { l: PartPose; r: PartPose }; head: PartPose; legs: { l: PartPose; r: PartPose; a: PartPose; b: PartPose }; tail: PartPose; wings: { l: PartPose; r: PartPose }; legPhase: number }

const sm = (k: number): number => k * k * (3 - 2 * k);
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp01 = (k: number): number => Math.max(0, Math.min(1, k));
/** Interpolación por tramos: [k0,v0],[k1,v1]... */
function keys(k: number, pts: Array<[number, number]>): number {
  if (k <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) {
    if (k <= pts[i]![0]) {
      const a = pts[i - 1]!, b = pts[i]!;
      return lerp(a[1], b[1], sm(clamp01((k - a[0]) / (b[0] - a[0]))));
    }
  }
  return pts[pts.length - 1]![1];
}

const P0 = (): PartPose => ({ rx: 0, rz: 0 });

export function rigPose(rig: Rig, a: AnimInput): Pose {
  const pose: Pose = {
    body: { dy: 0, dz: 0, rx: 0, rz: 0, sy: 1 }, arms: { l: P0(), r: P0() }, head: P0(),
    legs: { l: P0(), r: P0(), a: P0(), b: P0() }, tail: P0(), wings: { l: P0(), r: P0() }, legPhase: 0,
  };
  const restR = rig.restR ?? 0, restL = rig.restL ?? 0;
  const t = a.time + a.seed * 1.7;
  const breathe = Math.sin(t * 2.1);
  const fly = rig.flyer;
  // ---- reposo y caminar (base de todo lo demás)
  const w = clamp01(a.walk);
  const sw = Math.sin(a.walkT);
  pose.body.dy = (1 - w) * breathe * 0.012 + w * Math.abs(Math.sin(a.walkT)) * 0.05;
  pose.body.sy = 1 + (1 - w) * breathe * 0.012;
  pose.legs.l.rx = sw * 0.8 * w; pose.legs.r.rx = -sw * 0.8 * w;
  pose.legs.a.rx = sw * 0.75 * w; pose.legs.b.rx = -sw * 0.75 * w;
  pose.arms.l.rx = restL - sw * 0.7 * w + (1 - w) * breathe * 0.04;
  pose.arms.r.rx = restR + sw * 0.7 * w - (1 - w) * breathe * 0.04;
  pose.arms.l.rz = -0.04; pose.arms.r.rz = 0.04;
  pose.tail.rx = Math.sin(t * 3) * 0.25 + w * 0.2;
  pose.head.rx = (1 - w) * Math.sin(t * 1.3) * 0.03;
  pose.head.rz = (1 - w) * Math.sin(t * 0.9) * 0.03;
  pose.wings.l.rz = Math.sin(t * (fly ? 14 : 3)) * (fly ? 0.8 : 0.1) + 0.2;
  pose.wings.r.rz = -pose.wings.l.rz;
  if (fly) { pose.legs.a.rx = Math.sin(t * 4) * 0.4; pose.legs.b.rx = Math.sin(t * 4 + 2) * 0.4; }
  const k = clamp01(a.k);
  switch (a.state) {
    case 'attack':
    case 'cast': {
      const beast = rig.style === 'beast';
      const cast = a.state === 'cast' || rig.style === 'cast';
      if (beast) {
        const lunge = Math.sin(k * Math.PI);
        pose.body.dz = lunge * 0.22; pose.body.rx = keys(k, [[0, 0], [0.3, -0.25], [0.55, 0.4], [1, 0]]);
        pose.head.rx = keys(k, [[0, 0], [0.3, -0.3], [0.55, 0.5], [1, 0]]);
        pose.tail.rx = lunge * 0.6; pose.legs.a.rx = lunge * 0.5; pose.legs.b.rx = -lunge * 0.4;
        pose.wings.l.rz += lunge * 0.8; pose.wings.r.rz -= lunge * 0.8;
      } else if (cast) {
        const up = keys(k, [[0, restL], [0.3, -2.7], [0.55, -1.5], [0.7, -1.5], [1, restL]]);
        pose.arms.l.rx = up; pose.arms.r.rx = keys(k, [[0, restR], [0.3, -2.6], [0.55, -1.4], [0.7, -1.4], [1, restR]]);
        pose.body.rx = keys(k, [[0, 0], [0.3, -0.18], [0.55, 0.16], [1, 0]]);
        pose.body.dy = Math.sin(k * Math.PI) * 0.06;
        pose.head.rx = keys(k, [[0, 0], [0.3, -0.2], [0.55, 0.1], [1, 0]]);
      } else if (rig.style === 'ranged') {
        pose.arms.l.rx = keys(k, [[0, restL], [0.2, -1.55], [0.7, -1.55], [1, restL]]);
        pose.arms.r.rx = keys(k, [[0, restR], [0.2, -1.5], [0.55, -1.05], [0.62, -1.6], [1, restR]]);
        pose.body.rx = keys(k, [[0, 0], [0.55, -0.1], [0.65, 0.08], [1, 0]]);
        pose.body.dz = keys(k, [[0, 0], [0.55, -0.04], [0.65, 0.02], [1, 0]]);
      } else {
        pose.arms.r.rx = keys(k, [[0, restR], [0.32, -2.7], [0.5, -0.35], [0.7, -0.2], [1, restR]]);
        pose.arms.l.rx = keys(k, [[0, restL], [0.32, -1.2], [0.5, 0.5], [1, restL]]);
        pose.body.rx = keys(k, [[0, 0], [0.32, -0.16], [0.5, 0.32], [0.75, 0.12], [1, 0]]);
        pose.body.dz = keys(k, [[0, 0], [0.32, -0.05], [0.5, 0.12], [1, 0]]);
        pose.head.rx = keys(k, [[0, 0], [0.32, -0.15], [0.5, 0.2], [1, 0]]);
        pose.legs.l.rx = keys(k, [[0, 0], [0.5, 0.5], [1, 0]]); pose.legs.r.rx = keys(k, [[0, 0], [0.5, -0.45], [1, 0]]);
      }
      break;
    }
    case 'hurt': {
      const s = Math.sin(k * Math.PI);
      pose.body.rx = -0.5 * s; pose.body.dz = -0.14 * s; pose.body.rz = Math.sin(k * 24) * 0.06 * (1 - k);
      pose.head.rx = -0.4 * s; pose.arms.l.rx = restL - 0.9 * s; pose.arms.r.rx = restR - 0.9 * s;
      pose.legs.l.rx = 0.3 * s; pose.legs.r.rx = -0.2 * s; pose.tail.rx = 0.8 * s;
      break;
    }
    case 'die': {
      const e = sm(k);
      pose.body.rz = (fly ? 0.6 : 1.5) * e; pose.body.dy = -(fly ? 0.45 : 0.1) * e; pose.body.rx = -0.25 * e;
      pose.arms.l.rx = restL - 1.1 * e; pose.arms.r.rx = restR + 0.6 * e; pose.head.rx = -0.4 * e;
      pose.legs.l.rx = 0.4 * e; pose.legs.r.rx = -0.3 * e; pose.wings.l.rz = 0.9 * e; pose.wings.r.rz = -0.9 * e;
      break;
    }
    case 'cheer': {
      const hop = Math.abs(Math.sin(a.time * 6 + a.seed));
      pose.body.dy = hop * 0.18; pose.body.rx = -0.05;
      pose.arms.l.rx = -2.7 + Math.sin(a.time * 12) * 0.25; pose.arms.r.rx = -2.7 - Math.sin(a.time * 12) * 0.25;
      pose.arms.l.rz = -0.3; pose.arms.r.rz = 0.3; pose.head.rx = -0.18;
      pose.legs.l.rx = hop * 0.3; pose.legs.r.rx = -hop * 0.3;
      pose.wings.l.rz += 0.5; pose.wings.r.rz -= 0.5; pose.tail.rx = 0.6;
      break;
    }
    case 'defend': {
      pose.body.dy = -0.06; pose.body.rx = 0.15;
      pose.arms.l.rx = -1.25; pose.arms.r.rx = -1.25; pose.arms.l.rz = 0.5; pose.arms.r.rz = -0.5;
      pose.legs.l.rx = -0.35; pose.legs.r.rx = 0.35; pose.head.rx = 0.15;
      break;
    }
    default: break;
  }
  pose.legPhase = a.walkT;
  return pose;
}

/** Matriz de cada pieza del rig para una pose (base = posición/giro/escala del personaje). */
export function rigMatrices(rig: Rig, base: Mat4, pose: Pose, out: Mat4[] = []): Mat4[] {
  const hip = 0.34 * Math.max(0.6, rig.height * 0.9);
  const b = pose.body;
  let body = mul(base, translate(0, b.dy, b.dz));
  body = mul(body, translate(0, hip, 0));
  if (b.rx) body = mul(body, rotX(b.rx));
  if (b.rz) body = mul(body, rotZ(b.rz));
  if (b.sy !== 1) { const s = new Float32Array(ident()); s[5] = b.sy; body = mul(body, s); }
  body = mul(body, translate(0, -hip, 0));
  rig.parts.forEach((p, i) => {
    let pp: PartPose | null = null;
    switch (p.anim as PartAnim) {
      case 'armL': pp = pose.arms.l; break;
      case 'armR': pp = pose.arms.r; break;
      case 'head': pp = pose.head; break;
      case 'legL': pp = pose.legs.l; break;
      case 'legR': pp = pose.legs.r; break;
      case 'legA': pp = pose.legs.a; break;
      case 'legB': pp = pose.legs.b; break;
      case 'tail': pp = pose.tail; break;
      case 'wingL': pp = pose.wings.l; break;
      case 'wingR': pp = pose.wings.r; break;
      case 'tent': pp = pose.legs.a; break;
      default: pp = null;
    }
    // Piezas con fase propia (patas de araña, tentáculos): desfase alterno.
    let m = mul(body, translate(p.pivot[0], p.pivot[1], p.pivot[2]));
    if (pp) {
      const alt = (p.anim === 'legA' || p.anim === 'legB') && rig.style === 'beast' && p.phase ? Math.sin(pose.legPhase + p.phase * 1.6) * 0.15 : 0;
      const rx = pp.rx + alt;
      if (rx) m = mul(m, rotX(rx));
      if (pp.rz) m = mul(m, rotZ(pp.rz));
    }
    out[i] = m;
  });
  return out;
}
