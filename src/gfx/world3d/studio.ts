/**
 * Estudio de retratos 3D: un contexto WebGL2 fuera de pantalla que renderiza un rig (héroe, PNJ,
 * criatura o mascota) con luz suave y fondo transparente, y lo copia a un lienzo 2D listo para el DOM.
 * Sustituye a los sprites planos en menús, fichas, diálogos y mascotas.
 */
import { PET_SPECIES } from '@/data/registry';
import type { PetLook } from '@/data/schema';
import { DEFAULT_HERO_COLORS, type HumanoidColors } from '../look';
import { rigMatrices, rigPose } from './anim';
import { initWorldSamplers, makeProg, type Prog } from './glutil';
import { ident, lookAt, mul, perspective, trs } from './mat';
import { beastRig, humanoidRig, type Rig } from './models';
import { WORLD_FS, WORLD_VS } from './shaders';

const SIZE = 256;

class Studio {
  private gl: WebGL2RenderingContext;
  private prog: Prog;
  private buf = new WeakMap<Float32Array, WebGLBuffer>();
  readonly canvas: HTMLCanvasElement;
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    const gl = this.canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 no disponible');
    this.gl = gl;
    this.prog = makeProg(gl, WORLD_VS, WORLD_FS, ['uVP', 'uModel', 'uTime', 'uWind', 'uCam', 'uFogCol', 'uFogDen', 'uFogOff', 'uSunDir', 'uSunCol', 'uAmbTop', 'uAmbBot', 'uFlash', 'uL', 'uLC', 'uNL']);
    initWorldSamplers(gl, this.prog);
    gl.enable(gl.DEPTH_TEST);
    gl.vertexAttribDivisor(4, 1);
    gl.vertexAttribDivisor(5, 1);
  }

  private mesh(a: Float32Array): WebGLBuffer {
    let b = this.buf.get(a);
    if (!b) {
      const gl = this.gl;
      b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW);
      this.buf.set(a, b);
    }
    return b;
  }

  draw(rig: Rig, o: { yaw: number; bust: boolean; dim: boolean; scale: number; pose: 'idle' | 'cheer' }): void {
    const gl = this.gl, P = this.prog;
    gl.viewport(0, 0, SIZE, SIZE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(P.p);
    const h = rig.height * o.scale;
    const ty = o.bust ? h * 0.8 : h * 0.5 + (rig.flyer ? 0.3 : 0);
    const dist = (o.bust ? h * 0.62 : Math.max(h, 0.9) * 1.25) / Math.tan(0.28) * 0.62 + 0.8;
    const eye: [number, number, number] = [Math.sin(o.yaw) * dist, ty + dist * 0.16, Math.cos(o.yaw) * dist];
    const vp = mul(perspective(0.56, 1, 0.1, 40), lookAt(eye, [0, ty, 0]));
    gl.uniformMatrix4fv(P.u.uVP!, false, vp);
    gl.uniform1f(P.u.uTime!, 0);
    gl.uniform1f(P.u.uWind!, 0);
    gl.uniform3fv(P.u.uCam!, eye);
    gl.uniform3f(P.u.uFogCol!, 0, 0, 0);
    gl.uniform1f(P.u.uFogDen!, 0);
    gl.uniform1f(P.u.uFogOff!, 100);
    gl.uniform3f(P.u.uSunDir!, -0.55, 0.8, 0.7);
    gl.uniform3f(P.u.uSunCol!, 1.0, 0.94, 0.82);
    gl.uniform3f(P.u.uAmbTop!, 0.72, 0.78, 0.9);
    gl.uniform3f(P.u.uAmbBot!, 0.46, 0.4, 0.38);
    gl.uniform4f(P.u.uFlash!, 0.03, 0.02, 0.05, o.dim ? 1 : 0);
    gl.uniform4fv(P.u.uL!, new Float32Array(40));
    gl.uniform3fv(P.u.uLC!, new Float32Array(30));
    gl.uniform1i(P.u.uNL!, 0);
    gl.disableVertexAttribArray(4);
    gl.disableVertexAttribArray(5);
    gl.vertexAttrib4f(4, 0, 0, 0, 0);
    gl.vertexAttrib4f(5, 1, 1, 1, 1);
    const pose = rigPose(rig, { state: o.pose === 'cheer' ? 'cheer' : 'idle', k: 0, time: 0.4, walkT: 0, walk: 0, seed: 1 });
    const base = trs(0, rig.flyer ? 0.1 : 0, 0, 0, o.scale);
    const mats = rigMatrices(rig, base, pose);
    rig.parts.forEach((part, i) => {
      gl.uniformMatrix4fv(P.u.uModel!, false, mats[i] ?? ident());
      gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh(part.mesh));
      for (const [loc, size, off] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 1, 36]] as const) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, off);
      }
      gl.drawArrays(gl.TRIANGLES, 0, part.mesh.length / 10);
    });
  }
}

let studio: Studio | null | undefined;
function getStudio(): Studio | null {
  if (studio === undefined) {
    try {
      studio = new Studio();
    } catch {
      studio = null;
    }
  }
  return studio;
}

const cache = new Map<string, HTMLCanvasElement>();
const rigs = new Map<string, Rig>();

function shot(key: string, rig: Rig, o: { yaw: number; bust: boolean; dim: boolean; scale: number; pose: 'idle' | 'cheer' }, className: string): HTMLCanvasElement {
  let src = cache.get(key);
  if (!src) {
    src = document.createElement('canvas');
    src.width = SIZE;
    src.height = SIZE;
    const st = getStudio();
    if (st) {
      st.draw(rig, o);
      src.getContext('2d')!.drawImage(st.canvas, 0, 0);
    }
    cache.set(key, src);
  }
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  c.className = className;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

/** Retrato 3D de un humanoide (héroe o PNJ). `bust`: busto para avatares pequeños. */
export function heroPortrait(colors: HumanoidColors = DEFAULT_HERO_COLORS, className = '', bust = false, pose: 'idle' | 'cheer' = 'idle'): HTMLCanvasElement {
  const key = `h|${JSON.stringify(colors)}|${bust}|${pose}`;
  const rig = rigs.get(key) ?? humanoidRig({ skin: colors.skin, hair: colors.hair, cloth: colors.cloth, clothDark: colors.clothDark, pants: colors.pants, hat: colors.hat, overlay: colors.overlay });
  rigs.set(key, rig);
  return shot(key, rig, { yaw: 0.45, bust, dim: false, scale: 1, pose }, className);
}

/** Retrato 3D de una mascota (silueta oscura si aún no se ha visto). */
export function petPortrait(look: PetLook, stage: number, className = '', dim = false): HTMLCanvasElement {
  const key = `p|${JSON.stringify(look)}|${stage}|${dim}`;
  const rig = rigs.get(key) ?? beastRig(look.shape, look);
  rigs.set(key, rig);
  return shot(key, rig, { yaw: 0.6, bust: false, dim, scale: 0.8 + stage * 0.14, pose: 'idle' }, className);
}

/** Retrato de una especie por id (para evoluciones y listas). */
export function speciesPortrait(id: string, className = '', dim = false): HTMLCanvasElement {
  const sp = PET_SPECIES.get(id);
  return sp ? petPortrait(sp.look, sp.stage, className, dim) : document.createElement('canvas');
}



/** Retrato 3D de un rig ya construido (lista de turnos de la batalla). */
export function rigPortrait(key: string, rig: Rig, className = '', scale = 1): HTMLCanvasElement {
  const k = `r|${key}|${scale}`;
  return shot(k, rig, { yaw: 0.5, bust: false, dim: false, scale: Math.min(1.3, scale), pose: 'idle' }, className);
}
