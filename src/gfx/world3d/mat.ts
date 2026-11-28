/** Matemáticas 3D mínimas (matrices 4x4 en columnas, como WebGL). Puro, sin DOM. */
export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];

export const ident = (): Mat4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function mul(a: Mat4, b: Mat4, out: Mat4 = new Float32Array(16)): Mat4 {
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
      out[c * 4 + r] = s;
    }
  return out;
}

export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function norm(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

export function lookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
  const z = norm(sub(eye, target));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}

/** Transformación: traslación · giro Y · giro X (opcional) · escala. */
export function trs(x: number, y: number, z: number, ry = 0, s = 1, rx = 0, out: Mat4 = new Float32Array(16)): Mat4 {
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
  // R = Ry * Rx
  out[0] = cy * s; out[1] = 0; out[2] = -sy * s; out[3] = 0;
  out[4] = sy * sx * s; out[5] = cx * s; out[6] = cy * sx * s; out[7] = 0;
  out[8] = sy * cx * s; out[9] = -sx * s; out[10] = cy * cx * s; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}

export function invert(m: Mat4): Mat4 | null {
  const a = m, o = new Float32Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a as unknown as number[] as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  det = 1 / det;
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return o;
}

/** Proyecta un punto del mundo a NDC (x,y en -1..1, w>0 delante). */
export function project(vp: Mat4, x: number, y: number, z: number): { x: number; y: number; w: number } {
  const w = vp[3]! * x + vp[7]! * y + vp[11]! * z + vp[15]!;
  return {
    x: (vp[0]! * x + vp[4]! * y + vp[8]! * z + vp[12]!) / w,
    y: (vp[1]! * x + vp[5]! * y + vp[9]! * z + vp[13]!) / w,
    w,
  };
}

/** Rayo (origen, dirección) a través de un punto NDC con la inversa de VP. */
export function unprojectRay(inv: Mat4, nx: number, ny: number): { o: Vec3; d: Vec3 } {
  const p = (z: number): Vec3 => {
    const x = inv[0]! * nx + inv[4]! * ny + inv[8]! * z + inv[12]!;
    const y = inv[1]! * nx + inv[5]! * ny + inv[9]! * z + inv[13]!;
    const zz = inv[2]! * nx + inv[6]! * ny + inv[10]! * z + inv[14]!;
    const w = inv[3]! * nx + inv[7]! * ny + inv[11]! * z + inv[15]!;
    return [x / w, y / w, zz / w];
  };
  const a = p(-1), b = p(1);
  return { o: a, d: norm(sub(b, a)) };
}

export function translate(x: number, y: number, z: number): Mat4 {
  const m = ident();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}
/** Giro sobre X (positivo: +y hacia +z). */
export function rotX(a: number): Mat4 {
  const c = Math.cos(a), s = Math.sin(a), m = ident();
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
}
/** Giro sobre Z (positivo: +x hacia +y). */
export function rotZ(a: number): Mat4 {
  const c = Math.cos(a), s = Math.sin(a), m = ident();
  m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
  return m;
}
export function scaleXYZ(x: number, y: number, z: number): Mat4 {
  const m = ident();
  m[0] = x; m[5] = y; m[10] = z;
  return m;
}
