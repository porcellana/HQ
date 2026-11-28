/** Utilidades WebGL2 compartidas por el mapa y la batalla. */
import { SPR_FS, SPR_VS } from './shaders';

export interface Prog { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }

export function makeProg(gl: WebGL2RenderingContext, vs: string, fs: string, uniforms: string[]): Prog {
  const sh = (t: number, src: string): WebGLShader => {
    const s = gl.createShader(t)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const n of uniforms) u[n] = gl.getUniformLocation(p, n);
  return { p, u };
}

/**
 * Lote de sprites suaves (puntos redondos con brillo, aditivos): halos de luz, destellos,
 * chispas, estelas, cristales de señalización y partículas de batalla. Se rellena cada fotograma.
 */
export class SpriteBatch {
  private buf: WebGLBuffer;
  private data: Float32Array;
  private prog: Prog;
  n = 0;
  constructor(private readonly gl: WebGL2RenderingContext, private readonly max = 1024) {
    this.data = new Float32Array(max * 8);
    this.buf = gl.createBuffer()!;
    this.prog = makeProg(gl, SPR_VS, SPR_FS, ['uVP', 'uScale']);
  }
  clear(): void {
    this.n = 0;
  }
  /** Punto en el mundo: tamaño en unidades, opacidad 0..1 y color lineal. */
  add(x: number, y: number, z: number, size: number, alpha: number, r: number, g: number, b: number): void {
    if (this.n >= this.max || alpha <= 0.002) return;
    this.data.set([x, y, z, size, alpha, r, g, b], this.n * 8);
    this.n++;
  }
  /** Dibuja con mezcla aditiva (o normal) y vacía el lote. */
  flush(vp: Float32Array, pxScale: number, additive = true): void {
    const gl = this.gl;
    if (this.n === 0) return;
    gl.useProgram(this.prog.p);
    gl.uniformMatrix4fv(this.prog.u.uVP!, false, vp);
    gl.uniform1f(this.prog.u.uScale!, pxScale);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n * 8), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20);
    gl.disableVertexAttribArray(3);
    gl.disableVertexAttribArray(4);
    gl.disableVertexAttribArray(5);
    gl.drawArrays(gl.POINTS, 0, this.n);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    this.n = 0;
  }
}

/**
 * Textura de profundidad 1x1 con comparación en la unidad 2. Un `sampler2DShadow` necesita siempre
 * una textura con comparación enlazada (si no, el dibujo falla con "dos texturas de distinto tipo").
 */
export function bindDummyShadow(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, 1, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.activeTexture(gl.TEXTURE0);
  return tex;
}

/** Deja un programa con WORLD_FS listo: niebla en la unidad 1, sombras apagadas en la 2 (con textura de relleno). */
export function initWorldSamplers(gl: WebGL2RenderingContext, p: Prog): void {
  gl.useProgram(p.p);
  gl.uniform1i(gl.getUniformLocation(p.p, 'uVis'), 1);
  gl.uniform1i(gl.getUniformLocation(p.p, 'uSh'), 2);
  gl.uniform4f(gl.getUniformLocation(p.p, 'uShP'), 0, 0, 0, 0);
  bindDummyShadow(gl);
}
