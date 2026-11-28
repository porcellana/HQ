/**
 * Fondo 3D de las batallas: un diorama del bioma (suelo, árboles, rocas, muros, antorchas,
 * niebla y luz según la hora) con cámara baja que respira despacio. Los combatientes siguen
 * siendo sprites 2D dibujados encima, con todo el sistema de efectos existente.
 */
import type { Biome } from '@/game/battle/biome';
import { buildChunk, CHUNK, Geo, type ChunkData, type Grid3D, type Light } from './terrain';
import { hash2 } from './mesh';
import { staticModel } from './models';
import { envFor, zoneStyle } from './style';
import { ident, lookAt, mul, perspective } from './mat';
import { MAX_LIGHTS, WORLD_FS, WORLD_VS } from './shaders';
import type { QualityCfg } from './quality';

export const BATTLE_W = 36;
export const BATTLE_H = 22;

/** Cuadrícula del escenario de un bioma (pura y determinista por semilla). */
export function battleGrid(biome: Biome, seed: number): Grid3D {
  const W = BATTLE_W, H = BATTLE_H;
  const cells: string[] = new Array<string>(W * H);
  const floor: Record<Biome, string> = {
    pradera: 'grass', bosque: 'grass', montana: 'gravel', cueva: 'caveFloor', cripta: 'cryptFloor',
    galerias: 'stoneFloor', puerto: 'dock', aldea: 'dirt', interior: 'woodFloor',
  };
  const f = floor[biome];
  const r = (x: number, y: number, s = 0): number => hash2(x, y, seed * 17 + s);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cells[y * W + x] = f;
  const set = (x: number, y: number, s: string): void => {
    if (x >= 0 && y >= 0 && x < W && y < H) cells[y * W + x] = s;
  };
  // Zona de combate despejada: filas >= 8 salvo bordes laterales.
  const clear = (x: number, y: number): boolean => y >= 9 && x >= 6 && x < W - 6;
  switch (biome) {
    case 'pradera':
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (r(x, y, 1) < 0.1) set(x, y, 'flowers');
        if (!clear(x, y) && y < 8 && r(x, y, 2) < 0.28) set(x, y, r(x, y, 3) < 0.7 ? 'tree' : 'bush');
        if (!clear(x, y) && y >= 8 && (x < 4 || x >= W - 4) && r(x, y, 4) < 0.22) set(x, y, 'tree');
        if (clear(x, y) && r(x, y, 5) < 0.04) set(x, y, 'rock');
      }
      for (let x = 0; x < W; x++) if (r(x, 7, 6) < 0.5) set(x, 7, 'dirt');
      break;
    case 'bosque':
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!clear(x, y) && r(x, y, 2) < (y < 9 ? 0.6 : 0.3)) set(x, y, r(x, y, 3) < 0.5 ? 'pine' : 'tree');
        if (clear(x, y) && r(x, y, 5) < 0.03) set(x, y, 'bush');
      }
      break;
    case 'montana':
      for (let y = 0; y < 9; y++) for (let x = 0; x < W; x++) if (y < 6 || r(x, y, 2) < 0.6) set(x, y, 'crag');
      for (let y = 9; y < H; y++) for (let x = 0; x < W; x++) {
        if (!clear(x, y) && r(x, y, 3) < 0.15) set(x, y, 'crag');
        else if (r(x, y, 4) < 0.07) set(x, y, 'rock');
      }
      break;
    case 'cueva':
    case 'galerias':
    case 'cripta': {
      const wall = biome === 'cueva' ? 'stoneWall' : biome === 'cripta' ? 'cryptWall' : 'stoneWall';
      void wall;
      const w = biome === 'cueva' ? 'caveWall' : biome === 'cripta' ? 'cryptWall' : 'stoneWall';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (y < 8 || x < 3 || x >= W - 3) set(x, y, w);
        else if (biome === 'cripta' && !clear(x, y) && r(x, y, 7) < 0.08) set(x, y, 'grave');
      }
      break;
    }
    case 'puerto':
      for (let y = 0; y < 8; y++) for (let x = 0; x < W; x++) set(x, y, 'water');
      for (let x = 0; x < W; x += 6) for (let y = 7; y < H; y++) if (y < 10) set(x, y, 'dock');
      break;
    case 'aldea':
      for (let y = 0; y < 8; y++) for (let x = 0; x < W; x++) {
        if (y < 3) set(x, y, 'roof');
        else if (y === 3 || y === 4) set(x, y, x % 7 === 3 ? 'door' : 'woodWall');
        else if (r(x, y, 2) < 0.3) set(x, y, 'cobble');
      }
      for (let x = 0; x < W; x += 7) { set(x + 5, 5, 'barrel'); set(x + 1, 6, 'lamp'); }
      break;
    case 'interior':
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (y < 6 || x < 3 || x >= W - 3) set(x, y, 'woodWall');
      }
      for (let x = 4; x < W - 4; x += 5) set(x, 6, x % 10 === 4 ? 'shelf' : 'hearth');
      for (let x = 6; x < W - 6; x += 8) set(x, 8, 'table');
      break;
  }
  return {
    width: W, height: H, kind: biome === 'pradera' || biome === 'bosque' || biome === 'montana' ? 'dungeon' : biome === 'aldea' || biome === 'puerto' ? 'town' : 'interior',
    seed, sprite: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? f : cells[y * W + x]!),
  };
}

interface Prog { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }

export class Backdrop3D {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private prog!: Prog;
  private meshes: Array<{ buf: WebGLBuffer; n: number }> = [];
  private insts: Array<{ model: { buf: WebGLBuffer; n: number }; inst: WebGLBuffer; count: number }> = [];
  private lights: Light[] = [];
  private env;
  private t = 0;
  private statics = new Map<string, { buf: WebGLBuffer; n: number }>();

  constructor(canvas: HTMLCanvasElement, biome: Biome, seed: number, night: number, q: QualityCfg) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: q.aa, alpha: false });
    if (!gl) throw new Error('WebGL2 no disponible');
    this.gl = gl;
    const sh = (t: number, s: string): WebGLShader => {
      const x = gl.createShader(t)!;
      gl.shaderSource(x, s);
      gl.compileShader(x);
      if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x) ?? 'shader');
      return x;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, WORLD_VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, WORLD_FS));
    gl.linkProgram(p);
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const n of ['uVP', 'uModel', 'uTime', 'uWind', 'uCam', 'uFogCol', 'uFogDen', 'uFogOff', 'uSunDir', 'uSunCol', 'uAmbTop', 'uAmbBot', 'uFlash', 'uHole', 'uHoleOn', 'uL', 'uLC', 'uNL']) u[n] = gl.getUniformLocation(p, n);
    this.prog = { p, u };
    gl.enable(gl.DEPTH_TEST);
    gl.vertexAttribDivisor(4, 1);
    gl.vertexAttribDivisor(5, 1);
    const grid = battleGrid(biome, seed);
    const geo = new Geo(grid);
    const style = zoneStyle(grid);
    const dark = biome === 'cueva' || biome === 'cripta' || biome === 'galerias' ? 0.55 : biome === 'interior' ? 0.15 : 0;
    this.env = envFor(style, night, dark, 0.35);
    this.windy = style.wind;
    const nc = Math.ceil(BATTLE_W / CHUNK), nz = Math.ceil(BATTLE_H / CHUNK);
    for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nc; cx++) this.addChunk(buildChunk(geo, cx, cz, { density: q.density }));
  }
  private windy = 1;

  private up(data: Float32Array): { buf: WebGLBuffer; n: number } {
    const gl = this.gl;
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { buf, n: data.length / 10 };
  }

  private addChunk(d: ChunkData): void {
    const gl = this.gl;
    if (d.terrain.length) this.meshes.push(this.up(d.terrain));
    for (const [id, arr] of d.inst) {
      const m = staticModel(id);
      if (!m) continue;
      let model = this.statics.get(id);
      if (!model) this.statics.set(id, (model = this.up(m)));
      const inst = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      this.insts.push({ model, inst, count: arr.length / 8 });
    }
    this.lights.push(...d.lights);
  }

  resize(w: number, h: number, scale: number): void {
    const cw = Math.max(2, Math.round(w * scale)), ch = Math.max(2, Math.round(h * scale));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
  }

  draw(dt: number, shiftX = 0): void {
    const gl = this.gl;
    this.t += dt;
    const { env } = this;
    const W = this.canvas.width, H = this.canvas.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(env.fog[0], env.fog[1], env.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const sway = Math.sin(this.t * 0.22) * 0.9 + shiftX * 0.002;
    const eye: [number, number, number] = [18 + sway, 3.0, 21.5];
    const tgt: [number, number, number] = [18 + sway * 0.4, 0.2, 8];
    const vp = mul(perspective(0.72, W / H, 0.3, 90), lookAt(eye, tgt));
    const P = this.prog;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP!, false, vp);
    gl.uniformMatrix4fv(P.u.uModel!, false, ident());
    gl.uniform1f(P.u.uTime!, this.t);
    gl.uniform1f(P.u.uWind!, this.windy);
    gl.uniform3fv(P.u.uCam!, eye);
    gl.uniform3fv(P.u.uFogCol!, env.fog);
    gl.uniform1f(P.u.uFogDen!, Math.max(0.03, env.fogDensity * 0.7));
    gl.uniform1f(P.u.uFogOff!, 8);
    gl.uniform3fv(P.u.uSunDir!, env.sunDir);
    gl.uniform3fv(P.u.uSunCol!, env.sunCol);
    gl.uniform3fv(P.u.uAmbTop!, env.ambTop);
    gl.uniform3fv(P.u.uAmbBot!, env.ambBottom);
    gl.uniform4f(P.u.uFlash!, 0, 0, 0, 0);
    gl.uniform1f(P.u.uHoleOn!, 0);
    const nl = Math.min(this.lights.length, MAX_LIGHTS);
    const lp = new Float32Array(MAX_LIGHTS * 4), lc = new Float32Array(MAX_LIGHTS * 3);
    const k = 0.5 + Math.max(env.night, 0.5);
    for (let i = 0; i < nl; i++) {
      const l = this.lights[i]!;
      lp.set([l.x, l.y, l.z, l.rad * (1 + 0.04 * Math.sin(this.t * 9 + i))], i * 4);
      lc.set([l.r * k, l.g * k, l.b * k], i * 3);
    }
    gl.uniform4fv(P.u.uL!, lp);
    gl.uniform3fv(P.u.uLC!, lc);
    gl.uniform1i(P.u.uNL!, nl);
    const attr = (g: { buf: WebGLBuffer }): void => {
      gl.bindBuffer(gl.ARRAY_BUFFER, g.buf);
      for (const [i, size, off] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 1, 36]] as const) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, size, gl.FLOAT, false, 40, off);
      }
    };
    gl.disableVertexAttribArray(4);
    gl.disableVertexAttribArray(5);
    gl.vertexAttrib4f(4, 0, 0, 0, 0);
    gl.vertexAttrib4f(5, 1, 1, 1, 1);
    for (const m of this.meshes) {
      attr(m);
      gl.drawArrays(gl.TRIANGLES, 0, m.n);
    }
    for (const i of this.insts) {
      attr(i.model);
      gl.bindBuffer(gl.ARRAY_BUFFER, i.inst);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(5);
      gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 32, 16);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, i.model.n, i.count);
    }
  }

  destroy(): void {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}
