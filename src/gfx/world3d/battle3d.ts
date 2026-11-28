/**
 * ESCENA DE BATALLA 3D: diorama del bioma (suelo, árboles, rocas, muros, antorchas, cielo, niebla y
 * luz según la hora) con los combatientes como modelos 3D animados (grupo a la derecha, enemigos a
 * la izquierda), sombras blandas, auras de estado, proyectiles y partículas luminosas. La cámara
 * es cinematográfica pero suave (respira y sigue ligeramente al que actúa), sin zoom brusco.
 */
import type { Biome } from '@/game/battle/biome';
import { buildChunk, CHUNK, Geo, type ChunkData, type Grid3D, type Light } from './terrain';
import { hash2, hexRgb, MeshBuilder, STRIDE } from './mesh';
import { emissive, staticModel, torus, type Rig } from './models';
import { rigMatrices, rigPose, type AnimInput } from './anim';
import { envFor, zoneStyle, type Env } from './style';
import { ident, invert, lookAt, mul, perspective, project, scaleXYZ, trs, unprojectRay, type Mat4 } from './mat';
import { BLOB_FS, BLOB_VS, MAX_LIGHTS, SKY_FS, SKY_VS, WORLD_FS, WORLD_VS } from './shaders';
import { initWorldSamplers, makeProg, SpriteBatch, type Prog } from './glutil';
import type { QualityCfg } from './quality';
import { flicker, type DayClock } from './daycycle';
import { blobMatrix } from './shadow';

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

/** Datos de un combatiente para dibujarlo en un fotograma. */
export interface UnitDraw {
  rig: Rig;
  /** Posición de los pies en el mundo y giro. */
  x: number; y: number; z: number; yaw: number; scale: number;
  anim: AnimInput;
  /** Destello blanco/rojo 0..1, deformación (aplastar/estirar), desintegración 0..1. */
  flash: number; squash: number; dissolve: number;
  /** Opacidad de la sombra y color del aura bajo los pies (estado), anillo de objetivo/turno. */
  shadow: number; aura?: string | undefined; ring?: string | undefined;
  /** Color de la desintegración. */
  dissolveCol?: string;
}
export interface Projectile { x: number; y: number; z: number; kind: 'orb' | 'arrow'; color: string; size: number; yaw?: number; pitch?: number }
export interface Frame { units: UnitDraw[]; shakeX: number; shakeY: number; focusX: number; sprites: Array<[number, number, number, number, number, number, number, number]>; projectiles: Projectile[] }

const FOV = 0.62;
const PITCH = 0.34;
/** Centro de la acción en el mundo (casillas del diorama). */
export const STAGE_CENTER: [number, number, number] = [18, 0.45, 14.2];

/** Altura en píxeles de un héroe (1,08 unidades) según el tamaño de la escena. Pura. */
export function heroPixels(w: number, h: number): number {
  return Math.max(70, Math.min(140, Math.min(w * 0.22, h * 0.27)));
}

/** Distancia de cámara para que 1 unidad mida `ppu` píxeles en el centro de la escena. Pura. */
export function cameraDistance(h: number, ppu: number): number {
  return h / 2 / (Math.tan(FOV / 2) * ppu);
}

const ringCache = new Map<string, Float32Array>();
function ringMesh(col: string): Float32Array {
  let a = ringCache.get(col);
  if (!a) {
    const m = new MeshBuilder();
    const c = hexRgb(col);
    torus(m, 0, 0.04, 0, 0.55, 0.022, c, 28);
    torus(m, 0, 0.04, 0, 0.42, 0.01, c, 24);
    emissive(m, 0);
    a = m.toArray();
    ringCache.set(col, a);
  }
  return a;
}
function arrowMesh(): Float32Array {
  const m = new MeshBuilder();
  m.limb(0, 0, -0.34, 0, 0, 0.3, 0.012, 0.012, hexRgb('#e8e0c8'), { seg: 5 });
  m.limb(0, 0, 0.28, 0, 0, 0.44, 0.04, 0.004, hexRgb('#cfd4e0'), { seg: 6 });
  m.ball(0.0, 0.0, -0.34, 0.03, 0.03, 0.05, hexRgb('#c04040'), { seg: 6, ring: 4 });
  return m.toArray();
}

export class Battle3D {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private world!: Prog;
  private blob!: Prog;
  private sky!: Prog;
  private spr!: SpriteBatch;
  private meshes: Array<{ buf: WebGLBuffer; n: number }> = [];
  private insts: Array<{ model: { buf: WebGLBuffer; n: number }; inst: WebGLBuffer; count: number }> = [];
  private lights: Light[] = [];
  private env: Env;
  private t = 0;
  private statics = new Map<string, { buf: WebGLBuffer; n: number }>();
  private bufs = new WeakMap<Float32Array, WebGLBuffer>();
  private blobBuf!: { buf: WebGLBuffer; n: number };
  private windy = 1;
  private blobM = new Float32Array(16);
  private flat: boolean;
  /** Medidas actuales (px CSS) y cámara. */
  w = 1;
  h = 1;
  ppu = 100;
  private dist = 8;
  private centerY = 0.6;
  private vp: Mat4 = ident();
  private inv: Mat4 | null = null;
  private eye: [number, number, number] = [18, 3, 22];
  private baseInv: Mat4 | null = null;
  private lost = false;
  onLost: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, biome: Biome, seed: number, night: number, q: QualityCfg, clock?: DayClock) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 no disponible');
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.onLost?.();
    });
    this.world = makeProg(gl, WORLD_VS, WORLD_FS, ['uVP', 'uModel', 'uTime', 'uWind', 'uCam', 'uFogCol', 'uFogDen', 'uFogOff', 'uSunDir', 'uSunCol', 'uAmbTop', 'uAmbBot', 'uFlash', 'uDis', 'uDisY', 'uDisCol', 'uWin', 'uSh', 'uShVP', 'uShP', 'uVis', 'uVisP', 'uL', 'uLC', 'uNL']);
    initWorldSamplers(gl, this.world);
    this.blob = makeProg(gl, BLOB_VS, BLOB_FS, ['uVP', 'uModel', 'uAlpha']);
    this.sky = makeProg(gl, SKY_VS, SKY_FS, ['uInv', 'uEye', 'uTop', 'uHor', 'uFog', 'uSunDir', 'uSunCol', 'uTime', 'uStars', 'uFlat', 'uMoon', 'uWarm', 'uBias']);
    this.spr = new SpriteBatch(gl, 900);
    gl.enable(gl.DEPTH_TEST);
    gl.vertexAttribDivisor(4, 1);
    gl.vertexAttribDivisor(5, 1);
    const grid = battleGrid(biome, seed);
    const geo = new Geo(grid);
    const style = zoneStyle(grid);
    const dark = biome === 'cueva' || biome === 'cripta' || biome === 'galerias' ? 0.55 : biome === 'interior' ? 0.15 : 0;
    this.env = envFor(style, night, dark, 0.35, clock);
    this.windy = style.wind;
    this.flat = style.enclosed;
    const nc = Math.ceil(BATTLE_W / CHUNK), nz = Math.ceil(BATTLE_H / CHUNK);
    for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nc; cx++) this.addChunk(buildChunk(geo, cx, cz, { density: q.density }));
    // Disco de sombra.
    const d: number[] = [];
    const N = 18;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * 6.283, a1 = ((i + 1) / N) * 6.283;
      for (const [x, z, a] of [[0, 0, 0.62], [Math.cos(a1), Math.sin(a1), 0], [Math.cos(a0), Math.sin(a0), 0]] as const) d.push(x, 0.03, z, 0, 1, 0, 0, 0, 0, a);
    }
    this.blobBuf = this.up(new Float32Array(d));
  }

  private up(data: Float32Array): { buf: WebGLBuffer; n: number } {
    const gl = this.gl;
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { buf, n: data.length / STRIDE };
  }
  private bufFor(a: Float32Array): WebGLBuffer {
    let b = this.bufs.get(a);
    if (!b) {
      const gl = this.gl;
      b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW);
      this.bufs.set(a, b);
    }
    return b;
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

  /** Ajusta el tamaño (px CSS) y la resolución interna; recalcula cámara base. */
  resize(w: number, h: number, scale: number, usableH = h): void {
    this.w = Math.max(2, w);
    this.h = Math.max(2, h);
    const cw = Math.max(2, Math.round(w * scale)), ch = Math.max(2, Math.round(h * scale));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    this.ppu = heroPixels(w, usableH) / 1.08;
    this.dist = cameraDistance(h, this.ppu);
    this.centerY = (0.6 * usableH) / h;
    const cam = this.camera(0, 0, 0);
    this.baseInv = invert(cam.vp);
    this.vp = cam.vp;
    this.inv = this.baseInv;
    this.eye = cam.eye;
  }

  /** Cámara: giro leve, desplazamiento lateral y empuje mínimo; el centro de la acción queda en el 60 % de la altura. */
  private camera(yaw: number, dx: number, dd: number): { vp: Mat4; eye: [number, number, number] } {
    const d = this.dist * (1 + dd);
    const tgt: [number, number, number] = [STAGE_CENTER[0] + dx, STAGE_CENTER[1], STAGE_CENTER[2]];
    const eye: [number, number, number] = [tgt[0] + Math.sin(yaw) * Math.cos(PITCH) * d, tgt[1] + Math.sin(PITCH) * d, tgt[2] + Math.cos(yaw) * Math.cos(PITCH) * d];
    const aspect = this.w / this.h;
    const shift = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1 - 2 * this.centerY, 0, 1]);
    return { vp: mul(mul(shift, perspective(FOV, aspect, 0.3, 90)), lookAt(eye, tgt)), eye };
  }

  /** Punto del suelo (x,z) bajo un píxel de la cámara base (para colocar las formaciones). */
  groundAt(sx: number, sy: number): [number, number] {
    const inv = this.baseInv;
    if (!inv) return [STAGE_CENTER[0], STAGE_CENTER[2]];
    const r = unprojectRay(inv, (sx / this.w) * 2 - 1, 1 - (sy / this.h) * 2);
    const t = -r.o[1] / (r.d[1] || -1e-6);
    return [r.o[0] + r.d[0] * t, r.o[2] + r.d[2] * t];
  }

  /** Posición en píxeles CSS de un punto del mundo con la cámara actual. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    const p = project(this.vp, x, y, z);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (1 - (p.y * 0.5 + 0.5)) * this.h };
  }
  /** Píxeles por unidad de mundo en vertical (para convertir alturas). */
  get pixelsPerUnit(): number {
    return this.ppu;
  }
  /** Píxeles por unidad a lo largo de la profundidad (escorzo del suelo). */
  get depthPixels(): number {
    return this.ppu * Math.sin(PITCH);
  }

  private attr(buf: WebGLBuffer): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    for (const [i, size, off] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 1, 36]] as const) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, 40, off);
    }
  }
  private noInst(): void {
    const gl = this.gl;
    gl.disableVertexAttribArray(4);
    gl.disableVertexAttribArray(5);
    gl.vertexAttrib4f(4, 0, 0, 0, 0);
    gl.vertexAttrib4f(5, 1, 1, 1, 1);
  }

  draw(dt: number, f: Frame): void {
    if (this.lost) return;
    const gl = this.gl;
    this.t += dt;
    const { env } = this;
    const W = this.canvas.width, H = this.canvas.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(env.fog[0], env.fog[1], env.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Cámara cinematográfica suave: respira, sigue un poco al que actúa y tiembla en los impactos.
    const cam = this.camera(Math.sin(this.t * 0.21) * 0.045 + f.shakeX * 0.0006, f.focusX * 0.5 + Math.sin(this.t * 0.17) * 0.12, Math.sin(this.t * 0.13) * 0.012 + f.shakeY * 0.0004);
    this.vp = cam.vp;
    this.eye = cam.eye;
    this.inv = invert(cam.vp);
    const vp = this.vp, eye = this.eye;
    // Cielo.
    if (this.inv) {
      const S = this.sky;
      gl.useProgram(S.p);
      for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.uniformMatrix4fv(S.u.uInv!, false, this.inv);
      gl.uniform3fv(S.u.uEye!, eye);
      gl.uniform3fv(S.u.uTop!, env.skyTop);
      gl.uniform3f(S.u.uHor!, env.skyHorizon[0] * 0.5 + env.fog[0] * 0.5, env.skyHorizon[1] * 0.5 + env.fog[1] * 0.5, env.skyHorizon[2] * 0.5 + env.fog[2] * 0.5);
      gl.uniform3fv(S.u.uFog!, env.fog);
      gl.uniform3fv(S.u.uSunDir!, env.sunDir);
      gl.uniform3fv(S.u.uSunCol!, env.sunCol);
      gl.uniform1f(S.u.uTime!, this.t);
      gl.uniform1f(S.u.uStars!, env.stars);
      gl.uniform1f(S.u.uFlat!, this.flat ? 1 : 0);
      // La luna se coloca delante de la cámara para que se vea sobre el escenario.
      gl.uniform1f(S.u.uBias!, 0.42);
      gl.uniform4f(S.u.uMoon!, 0.1, 0.34, -0.95, env.moonAmt);
      gl.uniform4f(S.u.uWarm!, 1, 0.52, 0.3, this.flat ? 0 : env.warm * 0.85);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
    }
    const P = this.world;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP!, false, vp);
    gl.uniformMatrix4fv(P.u.uModel!, false, ident());
    gl.uniform1f(P.u.uTime!, this.t);
    gl.uniform1f(P.u.uWind!, this.windy);
    gl.uniform3fv(P.u.uCam!, eye);
    gl.uniform3fv(P.u.uFogCol!, env.fog);
    gl.uniform1f(P.u.uFogDen!, Math.max(0.03, env.fogDensity * 0.7));
    gl.uniform1f(P.u.uFogOff!, this.dist * 0.9);
    gl.uniform3fv(P.u.uSunDir!, env.sunDir);
    gl.uniform3fv(P.u.uSunCol!, env.sunCol);
    gl.uniform3fv(P.u.uAmbTop!, env.ambTop);
    gl.uniform3fv(P.u.uAmbBot!, env.ambBottom);
    gl.uniform4f(P.u.uFlash!, 0, 0, 0, 0);
    gl.uniform1f(P.u.uDis!, 0);
    gl.uniform1f(P.u.uWin!, env.windows);
    const nl = Math.min(this.lights.length, MAX_LIGHTS);
    const lp = new Float32Array(MAX_LIGHTS * 4), lc = new Float32Array(MAX_LIGHTS * 3);
    const k = 0.5 + Math.max(env.night, 0.5);
    for (let i = 0; i < nl; i++) {
      const l = this.lights[i]!;
      const fl = l.k === 'fire' ? flicker(this.t, l.x * 7.1 + l.z * 3.3) : l.k === 'window' ? env.windows * 1.1 : 1;
      lp.set([l.x, l.y, l.z, l.rad * (l.k === 'fire' ? 0.92 + (fl - 1) * 0.5 : 1 + 0.04 * Math.sin(this.t * 9 + i))], i * 4);
      lc.set([l.r * k * fl, l.g * k * fl, l.b * k * fl], i * 3);
    }
    gl.uniform4fv(P.u.uL!, lp);
    gl.uniform3fv(P.u.uLC!, lc);
    gl.uniform1i(P.u.uNL!, nl);
    this.noInst();
    for (const m of this.meshes) {
      this.attr(m.buf);
      gl.drawArrays(gl.TRIANGLES, 0, m.n);
    }
    for (const i of this.insts) {
      this.attr(i.model.buf);
      gl.bindBuffer(gl.ARRAY_BUFFER, i.inst);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(5);
      gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 32, 16);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, i.model.n, i.count);
    }
    this.noInst();
    // Sombras blandas.
    const B = this.blob;
    gl.useProgram(B.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniformMatrix4fv(B.u.uVP!, false, vp);
    this.attr(this.blobBuf.buf);
    this.noInst();
    for (const u of f.units) {
      if (u.shadow <= 0.01) continue;
      const r = u.rig.shadow * u.scale * 1.6;
      blobMatrix(u.x, 0.0, u.z, r, u.rig.height * u.scale * 0.6, env.sunDir, this.blobM);
      gl.uniformMatrix4fv(B.u.uModel!, false, this.blobM);
      gl.uniform1f(B.u.uAlpha!, 0.6 * u.shadow * Math.max(0.35, env.shadowStrength));
      gl.drawArrays(gl.TRIANGLES, 0, this.blobBuf.n);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    // Combatientes.
    gl.useProgram(P.p);
    for (const u of f.units) {
      const fl = Math.min(1, u.flash);
      const white = u.flash > 0;
      gl.uniform4f(P.u.uFlash!, 1, white ? 0.85 : 0.3, white ? 0.8 : 0.25, Math.min(0.85, fl * 0.85));
      gl.uniform1f(P.u.uDis!, u.dissolve);
      gl.uniform1f(P.u.uDisY!, u.y);
      const dc = hexRgb(u.dissolveCol ?? '#ffcf70');
      gl.uniform3f(P.u.uDisCol!, dc[0], dc[1], dc[2]);
      const sq = u.squash;
      const base = mul(trs(u.x, u.y, u.z, u.yaw, u.scale), scaleXYZ(1 - sq * 0.1, 1 + sq * 0.12, 1 - sq * 0.1));
      const pose = rigPose(u.rig, u.anim);
      const mats = rigMatrices(u.rig, base, pose);
      u.rig.parts.forEach((part, i) => {
        gl.uniformMatrix4fv(P.u.uModel!, false, mats[i]!);
        this.attr(this.bufFor(part.mesh));
        gl.drawArrays(gl.TRIANGLES, 0, part.mesh.length / STRIDE);
      });
    }
    gl.uniform4f(P.u.uFlash!, 0, 0, 0, 0);
    gl.uniform1f(P.u.uDis!, 0);
    // Anillos del suelo (aura de estado, turno y objetivo) y proyectiles.
    for (const u of f.units) {
      for (const [col, s, spin] of [[u.aura, 1.15, 0.8], [u.ring, 1.35, -1.2]] as const) {
        if (!col) continue;
        const key = `ring${col}`;
        let g = this.statics.get(key);
        if (!g) this.statics.set(key, (g = this.up(ringMesh(col))));
        gl.uniformMatrix4fv(P.u.uModel!, false, trs(u.x, 0.0, u.z, this.t * spin, Math.max(0.7, u.rig.shadow * 2.6 * u.scale) * s * (1 + 0.04 * Math.sin(this.t * 6))));
        this.attr(g.buf);
        gl.drawArrays(gl.TRIANGLES, 0, g.n);
      }
    }
    for (const p of f.projectiles) {
      if (p.kind !== 'arrow') continue;
      let g = this.statics.get('arrow');
      if (!g) this.statics.set('arrow', (g = this.up(arrowMesh())));
      const m = mul(trs(p.x, p.y, p.z, p.yaw ?? 0, p.size), new Float32Array(ident()));
      gl.uniformMatrix4fv(P.u.uModel!, false, mul(m, tiltX(p.pitch ?? 0)));
      this.attr(g.buf);
      gl.drawArrays(gl.TRIANGLES, 0, g.n);
    }
    this.noInst();
    // Partículas luminosas, halos de antorchas y proyectiles de energía.
    for (const s of f.sprites) this.spr.add(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]);
    for (const p of f.projectiles) {
      if (p.kind !== 'orb') continue;
      const c = hexRgb(p.color);
      this.spr.add(p.x, p.y, p.z, p.size * 2.6, 0.45, c[0], c[1], c[2]);
      this.spr.add(p.x, p.y, p.z, p.size * 1.1, 0.95, 1, 1, 1);
    }
    for (const l of this.lights.slice(0, nl)) this.spr.add(l.x, l.y, l.z, 0.9 + l.rad * 0.12, 0.2, l.r, l.g, l.b);
    this.spr.flush(vp, (this.canvas.height / (2 * Math.tan(FOV / 2))));
  }

  destroy(): void {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}

/** Giro sobre X (cabeceo) para orientar flechas. */
function tiltX(a: number): Mat4 {
  const c = Math.cos(a), s = Math.sin(a), m = ident();
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
}
