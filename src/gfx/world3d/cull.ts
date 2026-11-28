/** Recorte por frustum y niveles de detalle (puros, testeables). */
import type { Mat4 } from './mat';

/** 6 planos (a,b,c,d) normalizados del frustum de una matriz vista-proyección en columnas. */
export function frustumPlanes(m: Mat4, out: Float32Array = new Float32Array(24)): Float32Array {
  const r = (row: number, col: number): number => m[col * 4 + row]!;
  const set = (i: number, sgn: number, k: number): void => {
    const a = r(3, 0) + sgn * r(k, 0), b = r(3, 1) + sgn * r(k, 1), c = r(3, 2) + sgn * r(k, 2), d = r(3, 3) + sgn * r(k, 3);
    const l = Math.hypot(a, b, c) || 1;
    out[i * 4] = a / l; out[i * 4 + 1] = b / l; out[i * 4 + 2] = c / l; out[i * 4 + 3] = d / l;
  };
  set(0, 1, 0); set(1, -1, 0); set(2, 1, 1); set(3, -1, 1); set(4, 1, 2); set(5, -1, 2);
  return out;
}

/** ¿La caja alineada a los ejes toca el frustum? (conservador) */
export function boxVisible(p: Float32Array, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
  for (let i = 0; i < 6; i++) {
    const a = p[i * 4]!, b = p[i * 4 + 1]!, c = p[i * 4 + 2]!, d = p[i * 4 + 3]!;
    const px = a >= 0 ? x1 : x0, py = b >= 0 ? y1 : y0, pz = c >= 0 ? z1 : z0;
    if (a * px + b * py + c * pz + d < 0) return false;
  }
  return true;
}

/** Decorado diminuto: sólo se dibuja cerca. */
const TINY = /^(tuft|pebble|reed|lily|mushroom|flowers|stalacmini)/;
/** Elementos altos que se ven de lejos y no se recortan por distancia. */
const TALL = /^(tree|pine|snowpine|palm|dead|cactus|chimney|streetlamp|lamp|tent|well|crystal|brazier|stalag|torch|campfire|rock)/;

export interface LodCfg { decorDist: number; instDist: number }

/** ¿Se dibuja este grupo de instancias a esa distancia (casillas) del centro del chunk? */
export function instVisible(id: string, dist: number, cfg: LodCfg): boolean {
  if (TINY.test(id)) return dist <= cfg.decorDist;
  if (TALL.test(id)) return true;
  return dist <= cfg.instDist;
}

/** Nivel de detalle de un chunk por distancia: 0 cerca, 1 medio, 2 lejos. */
export function chunkLod(dist: number, radius: number): 0 | 1 | 2 {
  const f = dist / Math.max(1, radius);
  return f < 0.4 ? 0 : f < 0.75 ? 1 : 2;
}

const LOD_TREES = /^(tree\d|pine\d|snowpine)$/;
/** Variante de menos polígonos para árboles lejanos (id + «@lo»). */
export function lodModelId(id: string, dist: number, near: number): string {
  return dist > near && LOD_TREES.test(id) ? `${id}@lo` : id;
}
