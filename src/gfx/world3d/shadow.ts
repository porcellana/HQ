/** Matemáticas de sombras (puras): matriz de luz con ajuste a texel y sombra "blob" alargada por la luz. */
import { lookAt, mul, ortho, type Mat4, type Vec3 } from './mat';

/**
 * Vista-proyección de la luz direccional para un mapa de sombras centrado en `c`.
 * El centro se ajusta a la rejilla de texeles de la luz, así las sombras no «nadan» al moverse.
 */
export function lightMatrix(c: Vec3, dir: Vec3, half: number, res: number): { vp: Mat4; center: Vec3 } {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d: Vec3 = [dir[0] / l, dir[1] / l, dir[2] / l];
  const eye0: Vec3 = [c[0] + d[0] * 50, c[1] + d[1] * 50, c[2] + d[2] * 50];
  const v0 = lookAt(eye0, c);
  // Ejes x e y de la luz (filas de la vista).
  const xa: Vec3 = [v0[0]!, v0[4]!, v0[8]!], ya: Vec3 = [v0[1]!, v0[5]!, v0[9]!];
  const texel = (2 * half) / res;
  const ax = c[0] * xa[0] + c[1] * xa[1] + c[2] * xa[2], ay = c[0] * ya[0] + c[1] * ya[1] + c[2] * ya[2];
  const dx = Math.round(ax / texel) * texel - ax, dy = Math.round(ay / texel) * texel - ay;
  const sc: Vec3 = [c[0] + xa[0] * dx + ya[0] * dy, c[1] + xa[1] * dx + ya[1] * dy, c[2] + xa[2] * dx + ya[2] * dy];
  const eye: Vec3 = [sc[0] + d[0] * 50, sc[1] + d[1] * 50, sc[2] + d[2] * 50];
  return { vp: mul(ortho(-half, half, -half, half, 1, 110), lookAt(eye, sc)), center: sc };
}

/**
 * Matriz de la sombra blanda de una criatura: un disco que se alarga y se desplaza en dirección
 * contraria a la luz según la altura del cuerpo. Columnas: ancho, y, largo, posición.
 */
export function blobMatrix(x: number, y: number, z: number, r: number, height: number, light: Vec3, out: Mat4 = new Float32Array(16)): Mat4 {
  const lh = Math.hypot(light[0], light[2]);
  const ly = Math.max(0.2, light[1]);
  const len = Math.min(2.6, (height * lh) / ly);
  const sx = lh > 1e-4 ? -light[0] / lh : 0, sz = lh > 1e-4 ? -light[2] / lh : 1;
  const stretch = 1 + len * 0.55;
  const off = len * 0.5;
  out.fill(0);
  out[0] = sz * r; out[2] = -sx * r;
  out[5] = r;
  out[8] = sx * r * stretch; out[10] = sz * r * stretch;
  out[12] = x + sx * off; out[13] = y; out[14] = z + sz * off; out[15] = 1;
  return out;
}
