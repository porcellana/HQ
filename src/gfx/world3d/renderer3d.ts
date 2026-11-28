/**
 * RENDERIZADOR 3D DEL MAPA (WebGL2, sin librerías).
 * Dibuja la zona como terreno suave con instancias redondeadas, personajes animados, cielo con
 * degradado, agua con espuma y señalización diegética (cristales, runas y un espíritu guía).
 * Un lienzo 2D encima (el de entrada) pinta nombres y números flotantes. La lógica de juego sigue
 * siendo por casillas.
 */
import { PET_SPECIES } from '@/data/registry';
import { findPath } from '@/engine/pathfinding';
import type { NpcDef } from '@/data/schema';
import type { Point } from '@/engine/pathfinding';
import { dangerLevel } from '@/game/combat/rules';
import { STATUS_INFO } from '@/game/combat/status';
import type { Game } from '@/game/game';
import { itemDef, rarityOf } from '@/game/items/items';
import type { Zone } from '@/game/world/zone';
import { DEFAULT_HERO_COLORS, type HumanoidColors } from '../look';
import { PLAYER_SIGHT, lungeOffset, type RenderOptions } from '../viewconst';
import { hexRgb } from './mesh';
import { beastRig, chestModel, humanoidRig, lootModel, oreModel, staticModel, type Rig } from './models';
import { rigMatrices, rigPose, type AnimState } from './anim';
import { crystalMotion, gemModel, npcHasShop, npcSignal, pathAhead, runeRingModel, SIGNAL_COLOR, type SignalKind } from './signals';
import { initWorldSamplers, makeProg, SpriteBatch, type Prog } from './glutil';
import { applyTwoFinger, decayVelocity, Momentum, PITCH_MAX, PITCH_MIN, ZOOM_STEP_MAX, ZOOM_STEP_MIN, type TwoFingerDelta } from '@/engine/gestures';
import { AdaptiveQuality, camDistance, QUALITY, remapDir, type AdaptStep, type Quality } from './quality';
import { boxVisible, frustumPlanes, instVisible, lodModelId } from './cull';
import { clockAt, dayClock, flicker } from './daycycle';
import { blobMatrix, lightMatrix } from './shadow';
import { BLOB_FS, BLOB_VS, BLUR_FS, BRIGHT_FS, COMPOSE_FS, MAX_LIGHTS, MIST_FS, MIST_VS, PART_FS, PART_VS, POST_VS, SHADOW_FS, SKY_FS, SKY_VS, WATER_FS, WATER_VS, WORLD_FS, WORLD_VS } from './shaders';
import { envFor, zoneStyle, type Env, type ParticleKind, type ZoneStyle } from './style';
import { buildChunk, buildSkirt, chunksInRadius, CHUNK, Geo, type ChunkData, type Light } from './terrain';
import { ident, invert, lookAt, mul, perspective, project, trs, unprojectRay, type Mat4 } from './mat';

interface Gpu { buf: WebGLBuffer; n: number }
/** Luz dinámica de un fotograma (se reutilizan los objetos). */
interface LightRec { x: number; y: number; z: number; r: number; g: number; b: number; rad: number; d: number; k?: 'fire' | 'crystal' | 'window' }

/** Estadísticas de rendimiento (contador de fps opcional). */
export interface RenderStats { fps: number; calls: number; tris: number; chunks: number; total: number; scale: number; quality: Quality; shadows: boolean; bloom: boolean; heapMb: number }

interface ChunkGpu { terrain: Gpu | null; water: Gpu | null; inst: WebGLBuffer | null; groups: Array<{ id: string; first: number; count: number }>; lights: Light[]; cx: number; cz: number }
interface Ent {
  gx: number; gz: number; gy: number; yaw: number; scale: number; rig: Rig | null; mesh: Gpu | null; walk: number; flash: number; alpha: number;
  hover: number; tile: Point | null; kind: string; label?: string; subCol?: string; bar?: { v: number; col: string }; icons?: string[]; hop?: number; sx?: number; sy?: number;
  st?: AnimState; k?: number; sig?: SignalKind; seed?: number;
}
interface Anim { x: number; z: number; yaw: number; sp: number; t: number }

const ENV_HOLE_Y = 0.45;
void ENV_HOLE_Y;

const PITCH_DEFAULT = 0.92;
const FOGU = ['uVis', 'uVisP', 'uVisT'];

export class Renderer3D {
  heroColors: HumanoidColors = DEFAULT_HERO_COLORS;
  pixelRatio = 1;
  private gl: WebGL2RenderingContext;
  private progs!: { world: Prog; water: Prog; blob: Prog; part: Prog; sky: Prog; mist: Prog; shadow: Prog; bright: Prog; blur: Prog; compose: Prog };
  private spr!: SpriteBatch;
  private guide: { path: Point[]; key: string; t: number; pos: { x: number; z: number } | null } = { path: [], key: '', t: 0, pos: null };
  private quality: Quality = 'media';
  private step = 0;
  private zoomCur = 0;
  private yaw = 0;
  private yawT = 0;
  private pitch = PITCH_DEFAULT;
  private pitchT = PITCH_DEFAULT;
  private yawVel = 0;
  private gesturing = false;
  private readonly momentum = new Momentum();
  private insetPx = { top: 0, bottom: 0 };
  private time = 0;
  private cam = { x: 0, y: 0, z: 0 };
  private camZone = '';
  private vp: Mat4 = ident();
  private invVp: Mat4 | null = null;
  private eye: [number, number, number] = [0, 5, 5];
  private geoCache = new WeakMap<Zone, { geo: Geo; style: ZoneStyle }>();
  private cur: { zone: Zone; geo: Geo; style: ZoneStyle; chunks: Map<number, ChunkGpu>; skirt: Gpu | null } | null = null;
  private statics = new Map<string, Gpu>();
  private partGpu = new WeakMap<Float32Array, Gpu>();
  private rigCache = new Map<string, Rig>();
  private anims = new Map<unknown, Anim>();
  private pickables: Array<{ sx: number; sy: number; r: number; tile: Point; pri: number }> = [];
  private blob!: Gpu;
  private partBuf!: WebGLBuffer;
  private partCount = 0;
  private lost = false;
  private adapt = new AdaptiveQuality('media');
  private userQ: Quality = 'media';
  private scaleMul = 1;
  private planes = new Float32Array(24);
  private visCache: { zone: string; x: number; z: number; r: number; list: Array<[number, number]> } | null = null;
  private lightPool: LightRec[] = Array.from({ length: 64 }, () => ({ x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, rad: 1, d: 0 }));
  private lightList: LightRec[] = [];
  private lpos = new Float32Array(MAX_LIGHTS * 4);
  private lcol = new Float32Array(MAX_LIGHTS * 3);
  private sh: { fbo: WebGLFramebuffer; tex: WebGLTexture; res: number } | null = null;
  private shLight: Mat4 = ident();
  private blobM = new Float32Array(16);
  /** Techo de las casas: 1 = cerrado; se desvanece al entrar (v0.14). */
  private roofA = 0;
  private post: { w: number; h: number; msFbo: WebGLFramebuffer; msColor: WebGLRenderbuffer; msDepth: WebGLRenderbuffer; sceneFbo: WebGLFramebuffer; sceneTex: WebGLTexture; t: Array<{ tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number }> } | null = null;
  /** Bloom a pantalla completa (sólo en calidad alta). */
  bloom = true;
  /** Con las estadísticas activas se cuentan llamadas de dibujo y triángulos. */
  private statsOn = false;
  private counters = { calls: 0, tris: 0 };
  private statSnap: RenderStats = { fps: 0, calls: 0, tris: 0, chunks: 0, total: 0, scale: 1, quality: 'media', shadows: false, bloom: false, heapMb: 0 };
  private fpsAcc = { t: 0, n: 0 };
  private drawnChunks = 0;
  private builds = 0;
  /** Lo llama el renderizador si pierde el contexto GL o hay que bajar calidad. */
  onContextLost: (() => void) | null = null;
  onAutoQuality: ((q: Quality, dir: 'baja' | 'sube') => void) | null = null;
  autoQuality = true;
  private lastCss = { w: 0, h: 0 };
  /** Textura de visibilidad de la niebla (1 texel por casilla: R explorado, G visible, B visible antes). */
  private fog: { tex: WebGLTexture; w: number; h: number; data: Uint8Array; ver: number; zone: string; mix: number } | null = null;

  constructor(private readonly glCanvas: HTMLCanvasElement, private readonly overlay: HTMLCanvasElement, quality: Quality = 'media') {
    const gl = glCanvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 no disponible');
    this.gl = gl;
    this.quality = quality;
    this.userQ = quality;
    this.adapt = new AdaptiveQuality(quality);
    glCanvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.onContextLost?.();
    });
    this.initGl();
    this.resize();
  }

  static supported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!c.getContext('webgl2');
    } catch {
      return false;
    }
  }

  get ctx2d(): CanvasRenderingContext2D {
    return this.overlay.getContext('2d')!;
  }

  // ------------------------------------------------------------------ GL base
  private initGl(): void {
    const gl = this.gl;
    const mk = (vs: string, fs: string, uniforms: string[]): Prog => makeProg(gl, vs, fs, uniforms);
    const lightU = ['uL', 'uLC', 'uNL'];
    this.progs = {
      world: mk(WORLD_VS, WORLD_FS, ['uVP', 'uModel', 'uTime', 'uWind', 'uCam', 'uFogCol', 'uFogDen', 'uFogOff', 'uSunDir', 'uSunCol', 'uAmbTop', 'uAmbBot', 'uFlash', 'uDis', 'uDisY', 'uDisCol', 'uWin', 'uSh', 'uShVP', 'uShP', ...FOGU, ...lightU]),
      water: mk(WATER_VS, WATER_FS, ['uVP', 'uTime', 'uCam', 'uFogCol', 'uFogDen', 'uFogOff', 'uSunDir', 'uSunCol', 'uSky', 'uAmbTop', ...FOGU, ...lightU]),
      blob: mk(BLOB_VS, BLOB_FS, ['uVP', 'uModel', 'uAlpha', 'uTint']),
      part: mk(PART_VS, PART_FS, ['uVP', 'uCenter', 'uTime', 'uVel', 'uSize', 'uScale', 'uGround', 'uBox', 'uBoxH', 'uColor']),
      mist: mk(MIST_VS, MIST_FS, ['uVP', 'uCenter', 'uSize', 'uFogCol', 'uLayer', ...FOGU]),
      sky: mk(SKY_VS, SKY_FS, ['uInv', 'uEye', 'uTop', 'uHor', 'uFog', 'uSunDir', 'uSunCol', 'uTime', 'uStars', 'uFlat', 'uMoon', 'uWarm']),
      shadow: mk(WORLD_VS, SHADOW_FS, ['uVP', 'uModel', 'uTime', 'uWind', 'uFlash']),
      bright: mk(POST_VS, BRIGHT_FS, ['uTex', 'uTh']),
      blur: mk(POST_VS, BLUR_FS, ['uTex', 'uDir']),
      compose: mk(POST_VS, COMPOSE_FS, ['uScene', 'uBloom', 'uK']),
    };
    initWorldSamplers(gl, this.progs.world);
    this.spr = new SpriteBatch(gl, 1400);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.vertexAttribDivisor(4, 1);
    gl.vertexAttribDivisor(5, 1);
    // Disco de sombra.
    const d: number[] = [];
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * 6.283, a1 = ((i + 1) / N) * 6.283;
      for (const [x, z, a] of [[0, 0, 0.7], [Math.cos(a1), Math.sin(a1), 0], [Math.cos(a0), Math.sin(a0), 0]] as const) d.push(x, 0.03, z, 0, 1, 0, 0, 0, 0, a);
    }
    this.blob = this.upload(new Float32Array(d));
    // Partículas: semillas fijas.
    const n = 220;
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    this.partBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    this.partCount = n;
  }

  private upload(data: Float32Array): Gpu {
    const gl = this.gl;
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { buf, n: data.length / 10 };
  }
  private staticMesh(key: string, make: () => Float32Array): Gpu {
    let g = this.statics.get(key);
    if (!g) this.statics.set(key, (g = this.upload(make())));
    return g;
  }
  private partMesh(a: Float32Array): Gpu {
    let g = this.partGpu.get(a);
    if (!g) this.partGpu.set(a, (g = this.upload(a)));
    return g;
  }
  private bindMesh(g: Gpu, full = true): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, g.buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    if (full) {
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 24);
    }
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 40, 36);
  }
  private noInstance(): void {
    const gl = this.gl;
    gl.disableVertexAttribArray(4);
    gl.disableVertexAttribArray(5);
    gl.vertexAttrib4f(4, 0, 0, 0, 0);
    gl.vertexAttrib4f(5, 1, 1, 1, 1);
  }

  // -------------------------------------------------------------- tamaño/zoom
  /** Calidad elegida por el jugador: es el tope al que la adaptativa puede volver a subir. */
  setQuality(q: Quality): void {
    if (q === this.userQ) return;
    this.userQ = q;
    this.quality = q;
    this.scaleMul = 1;
    this.adapt.setUser(q);
    this.dropChunks();
    this.resize();
  }
  private applyAdapt(st: AdaptStep): void {
    if (st.scaleMul !== undefined) this.scaleMul = st.scaleMul;
    if (st.level && st.level !== this.quality) {
      const down = QUALITY[st.level].radius < QUALITY[this.quality].radius;
      this.quality = st.level;
      this.dropChunks();
      this.onAutoQuality?.(st.level, down ? 'baja' : 'sube');
    }
    this.resize();
  }
  /** Estadísticas del último segundo (para el contador de fps). */
  get stats(): RenderStats {
    return this.statSnap;
  }
  setStats(on: boolean): void {
    if (on === this.statsOn) return;
    this.statsOn = on;
    const gl = this.gl as WebGL2RenderingContext & { __orig?: { a: WebGL2RenderingContext['drawArrays']; i: WebGL2RenderingContext['drawArraysInstanced'] } };
    if (on) {
      const a = gl.drawArrays.bind(gl), i = gl.drawArraysInstanced.bind(gl);
      gl.__orig = { a: gl.drawArrays, i: gl.drawArraysInstanced };
      const c = this.counters;
      gl.drawArrays = (mode: number, first: number, count: number): void => {
        c.calls++;
        if (mode === gl.TRIANGLES) c.tris += count / 3;
        a(mode, first, count);
      };
      gl.drawArraysInstanced = (mode: number, first: number, count: number, n: number): void => {
        c.calls++;
        if (mode === gl.TRIANGLES) c.tris += (count / 3) * n;
        i(mode, first, count, n);
      };
    } else if (gl.__orig) {
      gl.drawArrays = gl.__orig.a;
      gl.drawArraysInstanced = gl.__orig.i;
    }
  }
  private frameStats(dt: number): void {
    if (!this.statsOn) return;
    const f = this.fpsAcc;
    f.t += dt;
    f.n++;
    if (f.t >= 0.5) {
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      this.statSnap = { fps: f.n / f.t, calls: this.counters.calls / f.n, tris: this.counters.tris / f.n, chunks: this.drawnChunks, total: this.cur?.chunks.size ?? 0, scale: this.scaleMul * QUALITY[this.quality].scale, quality: this.quality, shadows: !!this.sh && QUALITY[this.quality].shadows, bloom: !!this.post, heapMb: mem ? mem.usedJSHeapSize / 1048576 : 0 };
      this.counters.calls = 0;
      this.counters.tris = 0;
      f.t = 0;
      f.n = 0;
    }
  }
  get qualityLevel(): Quality {
    return this.quality;
  }
  private dropChunks(): void {
    if (!this.cur) return;
    for (const c of this.cur.chunks.values()) this.freeChunk(c);
    this.cur.chunks.clear();
  }
  private freeChunk(c: ChunkGpu): void {
    const gl = this.gl;
    if (c.terrain) gl.deleteBuffer(c.terrain.buf);
    if (c.water) gl.deleteBuffer(c.water.buf);
    if (c.inst) gl.deleteBuffer(c.inst);
  }

  resize(): void {
    const cssW = this.overlay.clientWidth || window.innerWidth;
    const cssH = this.overlay.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.pixelRatio = Math.min(dpr, 3);
    const ow = Math.max(2, Math.round(cssW * this.pixelRatio)), oh = Math.max(2, Math.round(cssH * this.pixelRatio));
    if (this.overlay.width !== ow || this.overlay.height !== oh) {
      this.overlay.width = ow;
      this.overlay.height = oh;
    }
    const q = QUALITY[this.quality];
    const s = Math.min(dpr, 2) * q.scale * this.scaleMul;
    const gw = Math.max(2, Math.round(cssW * s)), gh = Math.max(2, Math.round(cssH * s));
    if (this.glCanvas.width !== gw || this.glCanvas.height !== gh) {
      this.glCanvas.width = gw;
      this.glCanvas.height = gh;
    }
    this.lastCss = { w: cssW, h: cssH };
  }

  setInsets(topPx: number, bottomPx: number): void {
    this.insetPx = { top: topPx, bottom: bottomPx };
  }
  get zoomStep(): number {
    return this.step;
  }
  get zoomLimits(): { min: number; max: number } {
    return { min: -2, max: 2 };
  }
  /** Zoom continuo (el pellizco deja valores intermedios); los botones saltan de nivel en nivel. */
  setZoomStep(step: number): number {
    this.step = Math.max(ZOOM_STEP_MIN, Math.min(ZOOM_STEP_MAX, Number.isFinite(step) ? step : 0));
    return this.step;
  }
  zoomBy(d: number): number {
    return this.setZoomStep(Math.round(this.step) + d);
  }
  resetZoom(): number {
    return this.setZoomStep(0);
  }
  /** Gesto de dos dedos: pellizco = zoom continuo, torcer = girar, arrastrar = inclinar (con inercia al girar). */
  gesture(d: TwoFingerDelta, o: { sens: number; invert: boolean }): void {
    const before = this.yawT;
    const c = applyTwoFinger({ yaw: this.yawT, pitch: this.pitchT, zoom: this.step }, d, o);
    this.yawT = c.yaw;
    this.pitchT = c.pitch;
    this.step = c.zoom;
    this.gesturing = true;
    this.momentum.sample(this.yawT - before, d.dt, performance.now() / 1000);
  }
  gestureEnd(): void {
    this.gesturing = false;
    this.yawVel = this.momentum.release(performance.now() / 1000);
  }
  /** ¿La cámara está girada o inclinada respecto a la de por defecto? */
  get cameraTouched(): boolean {
    return Math.abs(Math.sin(this.yawT / 2)) > 0.01 || Math.abs(this.pitchT - PITCH_DEFAULT) > 0.02;
  }
  /** Vuelve al giro e inclinación por defecto (por el camino corto). */
  recenter(): void {
    this.yawVel = 0;
    const k = Math.round(this.yawT / (Math.PI * 2)) * Math.PI * 2;
    this.yawT -= k;
    this.yaw -= k;
    this.pitchT = PITCH_DEFAULT;
  }
  /** Giro rápido por botones: +1/−1 cuartos de vuelta. */
  rotateStep(dir: number): void {
    this.yawT = Math.round(this.yawT / (Math.PI / 4) + dir) * (Math.PI / 4);
  }
  get cameraYaw(): number {
    return this.yaw;
  }
  /** Dirección de pantalla → dirección del mundo (joystick y teclas siguen a la cámara). */
  remap(d: { dx: number; dy: number }): { dx: number; dy: number } {
    return remapDir(d, this.yaw);
  }

  // ---------------------------------------------------------------- picking
  screenToTile(sx: number, sy: number): Point {
    // Primero criaturas y objetos tocables (su cuerpo está por encima del suelo).
    let best: { d: number; tile: Point } | null = null;
    for (const p of this.pickables) {
      const d = Math.hypot(sx - p.sx, sy - p.sy) / p.r;
      if (d < 1 && (!best || d - p.pri * 0.2 < best.d)) best = { d: d - p.pri * 0.2, tile: p.tile };
    }
    if (best) return best.tile;
    const inv = this.invVp;
    const W = this.overlay.width, H = this.overlay.height;
    if (!inv || !this.cur) return { x: -1, y: -1 };
    const r = unprojectRay(inv, (sx / W) * 2 - 1, 1 - (sy / H) * 2);
    if (Math.abs(r.d[1]) < 1e-5) return { x: -1, y: -1 };
    let t = -r.o[1] / r.d[1];
    for (let i = 0; i < 5; i++) {
      const x = r.o[0] + r.d[0] * t, z = r.o[2] + r.d[2] * t;
      const h = this.cur.geo.heightAt(x, z);
      t = (h - r.o[1]) / r.d[1];
    }
    return { x: Math.floor(r.o[0] + r.d[0] * t), y: Math.floor(r.o[2] + r.d[2] * t) };
  }

  // ------------------------------------------------------------------ zona
  private enter(zone: Zone): void {
    this.dropChunks();
    let e = this.geoCache.get(zone);
    if (!e) {
      const g = {
        width: zone.width, height: zone.height, kind: zone.def.kind, seed: [...zone.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) & 0xffff,
        tint: zone.def.tint, sprite: (x: number, y: number) => zone.tileAt(x, y)?.sprite ?? 'grass',
      };
      const geo = new Geo(g);
      e = { geo, style: zoneStyle(g) };
      this.geoCache.set(zone, e);
    }
    if (this.cur?.skirt) this.gl.deleteBuffer(this.cur.skirt.buf);
    this.roofA = zone.def.kind === 'interior' ? 1.25 : 0;
    this.cur = { zone, geo: e.geo, style: e.style, chunks: new Map(), skirt: e.style.enclosed ? null : this.upload(buildSkirt(e.geo)) };
  }

  private chunkGpu(d: ChunkData): ChunkGpu {
    const gl = this.gl;
    const groups: ChunkGpu['groups'] = [];
    let total = 0;
    for (const a of d.inst.values()) total += a.length;
    let inst: WebGLBuffer | null = null;
    if (total) {
      const data = new Float32Array(total);
      let off = 0;
      for (const [id, a] of d.inst) {
        data.set(a, off);
        groups.push({ id, first: off / 8, count: a.length / 8 });
        off += a.length;
      }
      inst = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    }
    return { terrain: d.terrain.length ? this.upload(d.terrain) : null, water: d.water.length ? this.upload(d.water) : null, inst, groups, lights: d.lights, cx: d.cx, cz: d.cz };
  }

  // --------------------------------------------------------------- render
  render(game: Game, dt: number, opts: RenderOptions): void {
    if (this.lost) return;
    const gl = this.gl;
    this.time += dt;
    this.lastDt = dt;
    this.frameStats(dt);
    if (this.autoQuality) {
      const st = this.adapt.push(dt);
      if (st) this.applyAdapt(st);
    }
    if (this.overlay.clientWidth !== this.lastCss.w || this.overlay.clientHeight !== this.lastCss.h) this.resize();
    const zone = game.zone;
    if (!this.cur || this.cur.zone !== zone) this.enter(zone);
    const cur = this.cur!;
    const { geo, style } = cur;
    const q = QUALITY[this.quality];
    const fogOn = this.syncFog(game, dt);

    // Entorno: hora del día (sol, luna, amanecer y ocaso), noche y oscuridad de la zona.
    const outdoor = zone.def.kind === 'town' || zone.def.kind === 'wild' || zone.def.kind === 'world';
    const clock = opts.dayNight && outdoor ? dayClock(game.state.turn) : clockAt(0.3, 0);
    const night = clock.night;
    const env = envFor(style, night, zone.def.darkness ?? 0, 0, clock);

    // Cámara: sigue al jugador, gira y se acerca con suavidad.
    const v = game.view;
    const px = v.rx + 0.5, pz = v.ry + 0.5;
    const py = geo.heightAt(px, pz);
    const k = Math.min(1, dt * 7);
    if (this.camZone !== zone.id) {
      this.cam = { x: px, y: py, z: pz };
      this.camZone = zone.id;
    } else {
      this.cam.x += (px - this.cam.x) * k;
      this.cam.z += (pz - this.cam.z) * k;
      this.cam.y += (py - this.cam.y) * k;
    }
    if (!this.gesturing && this.yawVel !== 0) {
      this.yawT += this.yawVel * dt;
      this.yawVel = decayVelocity(this.yawVel, dt);
    }
    this.yaw += (this.yawT - this.yaw) * Math.min(1, dt * (this.gesturing ? 24 : 10));
    this.pitch += (this.pitchT - this.pitch) * Math.min(1, dt * 14);
    this.zoomCur += (this.step - this.zoomCur) * Math.min(1, dt * (this.gesturing ? 20 : 8));
    const di = Math.max(0, Math.min(4, 2 - this.zoomCur));
    const lo = Math.floor(di), hi = Math.ceil(di);
    const dist = camDistance(2 - lo) + (camDistance(2 - hi) - camDistance(2 - lo)) * (di - lo);
    const enclosed = style.enclosed;
    const pitch = enclosed ? Math.max(PITCH_MIN, Math.min(PITCH_MAX, 1.0 + (this.pitch - PITCH_DEFAULT))) : this.pitch;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const tgt: [number, number, number] = [this.cam.x, this.cam.y + 0.45, this.cam.z];
    this.eye = [tgt[0] + Math.sin(this.yaw) * cp * dist, tgt[1] + sp * dist, tgt[2] + Math.cos(this.yaw) * cp * dist];
    const aspect = Math.max(0.2, this.glCanvas.width / this.glCanvas.height);
    const proj = perspective(0.78, aspect, 0.4, 120);
    // Desplaza el punto de mira al centro del hueco libre entre los paneles del HUD.
    const Hc = this.overlay.height;
    const ndcY = Hc > 0 ? ((this.insetPx.bottom - this.insetPx.top) / Hc) : 0;
    const shift = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, ndcY * 0.9, 0, 1]);
    this.vp = mul(mul(shift, proj), lookAt(this.eye, tgt));
    this.invVp = invert(this.vp);
    frustumPlanes(this.vp, this.planes);

    // Chunks cercanos (lista en caché mientras la cámara no se mueve mucho), con recorte por frustum.
    const radius = q.radius * (dist > 18 ? 1.25 : 1);
    let vc = this.visCache;
    if (!vc || vc.zone !== zone.id || vc.r !== radius || Math.hypot(vc.x - this.cam.x, vc.z - this.cam.z) > 2.5) {
      const list = chunksInRadius(geo.w, geo.h, this.cam.x, this.cam.z, radius + 3);
      list.sort((a, b) => Math.hypot((a[0] + 0.5) * CHUNK - this.cam.x, (a[1] + 0.5) * CHUNK - this.cam.z) - Math.hypot((b[0] + 0.5) * CHUNK - this.cam.x, (b[1] + 0.5) * CHUNK - this.cam.z));
      this.visCache = vc = { zone: zone.id, x: this.cam.x, z: this.cam.z, r: radius, list };
    }
    this.builds = 0;
    const first = cur.chunks.size === 0;
    const visible: ChunkGpu[] = [];
    const built: ChunkGpu[] = [];
    const nx = Math.ceil(geo.w / CHUNK);
    for (const [cx, cz] of vc.list) {
      const inView = boxVisible(this.planes, cx * CHUNK, -1.5, cz * CHUNK, (cx + 1) * CHUNK, 6, (cz + 1) * CHUNK);
      const key = cz * nx + cx;
      let c = cur.chunks.get(key);
      if (!c) {
        if (!first && this.builds >= (inView ? 2 : 1)) continue;
        this.builds++;
        c = this.chunkGpu(buildChunk(geo, cx, cz, { density: q.density }));
        cur.chunks.set(key, c);
      }
      built.push(c);
      if (inView) visible.push(c);
    }
    this.drawnChunks = visible.length;
    // Libera chunks lejanos para no acumular memoria.
    if (cur.chunks.size > vc.list.length + 10) {
      for (const [key, c] of cur.chunks) {
        if (Math.hypot((c.cx + 0.5) * CHUNK - this.cam.x, (c.cz + 0.5) * CHUNK - this.cam.z) > radius + CHUNK * 2.2) {
          this.freeChunk(c);
          cur.chunks.delete(key);
        }
      }
    }
    const ents = this.collect(game, geo);

    // Luces cercanas: la lámpara del héroe, faroles, antorchas (parpadean), cristales (pulsan), ventanas (sólo de noche).
    const lightAmt = Math.max(night * 0.85, enclosed ? 1 : (zone.def.darkness ?? 0) * 1.4);
    this.lightList.length = 0;
    let pool = 0;
    const addL = (x: number, y: number, z: number, r: number, g: number, b: number, rad: number, d: number, kind?: LightRec['k']): void => {
      if (pool >= this.lightPool.length) return;
      const o = this.lightPool[pool++]!;
      o.x = x; o.y = y; o.z = z; o.r = r; o.g = g; o.b = b; o.rad = rad; o.d = d;
      if (kind) o.k = kind; else delete o.k;
      this.lightList.push(o);
    };
    if (lightAmt > 0.05) {
      const fl = 1 + (flicker(this.time, 3) - 1) * 0.35;
      const ha = enclosed ? 0.85 : 1;
      addL(px, py + 1.4, pz, 1 * lightAmt * fl * ha, 0.78 * lightAmt * fl * ha, 0.5 * lightAmt * fl * ha, enclosed ? 9.5 : 8, -1);
    }
    const gk = 0.3 + 0.7 * Math.max(night, enclosed ? 1 : 0, (zone.def.darkness ?? 0));
    for (const c of built) for (const l of c.lights) {
      const d = Math.hypot(l.x - px, l.z - pz);
      if (d >= 16) continue;
      let m = gk, rad = l.rad;
      if (l.k === 'fire') { const f = flicker(this.time, l.x * 7.1 + l.z * 3.3); m *= f; rad *= 0.92 + (f - 1) * 0.5; }
      else if (l.k === 'crystal') m *= 0.8 + 0.2 * Math.sin(this.time * 1.6 + l.x * 2 + l.z);
      else if (l.k === 'window') { m = env.windows * 1.1; if (m < 0.04) continue; }
      addL(l.x, l.y, l.z, l.r * m, l.g * m, l.b * m, rad, d, l.k);
    }
    for (const f of game.fx) if (f.kind === 'burst' && f.t >= 0) {
      const a = 1 - f.t / f.life;
      const col = hexRgb(f.color);
      addL(f.x + 0.5, geo.heightAt(f.x + 0.5, f.y + 0.5) + 0.8, f.y + 0.5, col[0] * a * 1.4, col[1] * a * 1.4, col[2] * a * 1.4, 4.5, -0.5);
    }
    const L = this.lightList;
    L.sort((a, b) => a.d - b.d);
    const nl = Math.min(L.length, q.lights, MAX_LIGHTS);
    const lpos = this.lpos, lcol = this.lcol;
    lpos.fill(0);
    lcol.fill(0);
    for (let i = 0; i < nl; i++) {
      const l = L[i]!;
      lpos[i * 4] = l.x; lpos[i * 4 + 1] = l.y; lpos[i * 4 + 2] = l.z; lpos[i * 4 + 3] = l.rad;
      lcol[i * 3] = l.r; lcol[i * 3 + 1] = l.g; lcol[i * 3 + 2] = l.b;
    }

    // ---- sombras (mapa de sombras con PCF en calidad alta)
    const shadowOn = q.shadows && !enclosed && env.shadowStrength > 0.05 && this.ensureShadow(q.shadowRes);
    const shHalf = Math.min(22, Math.max(13, dist * 0.8));
    if (shadowOn) this.shadowPass(built, ents, env, px, py, pz, shHalf, q);

    // ---- fotograma GL (a un objetivo multimuestreado si hay bloom)
    const wantBloom = q.bloom && this.bloom;
    const post = wantBloom ? this.ensurePost(this.glCanvas.width, this.glCanvas.height) : null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, post ? post.msFbo : null);
    gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
    gl.clearColor(env.fog[0], env.fog[1], env.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    this.drawSky(env, style, clock.warm * (1 - night * 0.6));
    const fogDen = Math.max(env.fogDensity * 0.6, 1.9 / radius);

    const P = this.progs.world;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP!, false, this.vp);
    gl.uniform1f(P.u.uTime!, this.time);
    gl.uniform1f(P.u.uWind!, style.wind);
    gl.uniform3fv(P.u.uCam!, this.eye);
    gl.uniform3fv(P.u.uFogCol!, env.fog);
    gl.uniform1f(P.u.uFogDen!, fogDen);
    gl.uniform1f(P.u.uFogOff!, dist * 0.8);
    gl.uniform3fv(P.u.uSunDir!, env.sunDir);
    gl.uniform3fv(P.u.uSunCol!, env.sunCol);
    gl.uniform3fv(P.u.uAmbTop!, env.ambTop);
    gl.uniform3fv(P.u.uAmbBot!, env.ambBottom);
    gl.uniform1f(P.u.uWin!, env.windows);
    gl.uniform4f(P.u.uFlash!, 0, 0, 0, 0);
    gl.uniform4fv(P.u.uL!, lpos);
    gl.uniform3fv(P.u.uLC!, lcol);
    gl.uniform1i(P.u.uNL!, nl);
    if (shadowOn && this.sh) {
      gl.uniformMatrix4fv(P.u.uShVP!, false, this.shLight);
      gl.uniform4f(P.u.uShP!, env.shadowStrength * 0.85, 1 / this.sh.res, 0.0007, 0);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.sh.tex);
      gl.activeTexture(gl.TEXTURE0);
    } else gl.uniform4f(P.u.uShP!, 0, 0, 0, 0);
    const I = ident();
    gl.uniformMatrix4fv(P.u.uModel!, false, I);
    this.fogUniforms(P, fogOn);

    // Terreno e instancias (con detalle por distancia).
    if (cur.skirt) {
      this.noInstance();
      this.bindMesh(cur.skirt);
      gl.drawArrays(gl.TRIANGLES, 0, cur.skirt.n);
    }
    for (const c of visible) {
      if (c.terrain) {
        this.noInstance();
        this.bindMesh(c.terrain);
        gl.drawArrays(gl.TRIANGLES, 0, c.terrain.n);
      }
    }
    const lod = { decorDist: q.decorDist * (dist > 18 ? 1.3 : 1), instDist: q.instDist * (dist > 18 ? 1.3 : 1) };
    for (const c of visible) this.drawInst(c, Math.hypot((c.cx + 0.5) * CHUNK - this.cam.x, (c.cz + 0.5) * CHUNK - this.cam.z) - CHUNK * 0.5, lod);
    this.noInstance();

    // Sombras blandas bajo las criaturas (si no hay mapa de sombras) y entidades.
    this.drawShadows(ents, env, shadowOn);
    gl.useProgram(P.p);
    this.drawXray(ents[0], P);
    for (const e of ents) this.drawEnt(e, P);
    this.drawSignals(game, geo, ents, P, px, py, pz, opts.questGuide !== false);
    gl.uniformMatrix4fv(P.u.uModel!, false, I);

    // Agua (translúcida) y partículas.
    this.drawWater(visible, env, fogDen, dist * 0.8, lpos, lcol, nl, fogOn);
    if (fogOn && this.quality !== 'baja') this.drawMist(env, Math.min(radius, 44));
    this.drawParticles(style, env, px, py, pz, q.particles, style.particles);
    if (zone.def.kind === 'interior' && this.roofA > 0.01) {
      this.roofA = Math.max(0, this.roofA - dt * 0.85);
      this.drawCeiling(zone.width, zone.height, py, Math.min(1, this.roofA));
    }
    if (enclosed && zone.def.kind !== 'interior') this.drawParticles(style, env, px, py, pz, this.quality === 'baja' ? 14 : 34, 'bruma');
    else if (env.fireflies > 0.05) this.drawParticles(style, env, px, py, pz, Math.round(q.particles * 0.5 * env.fireflies), 'luciernagas');
    // Halos de luz (parpadean), chispas de las llamas y destellos de señalización.
    for (let i = 0; i < nl; i++) {
      const l = L[i]!;
      if (l.d < 0 && (l.rad === 8 || l.rad === 9.5)) continue;
      this.spr.add(l.x, l.y, l.z, Math.min(2.4, 0.5 + l.rad * 0.18), Math.min(0.5, 0.18 + (l.r + l.g + l.b) * 0.1), Math.min(1, l.r), Math.min(1, l.g), Math.min(1, l.b));
    }
    if (this.quality !== 'baja') for (const c of visible) for (const l of c.lights) {
      if (l.k !== 'fire' || Math.hypot(l.x - px, l.z - pz) > 13) continue;
      for (let j = 0; j < 3; j++) {
        const ph = (this.time * (0.7 + j * 0.23) + j * 0.37 + l.x * 0.31) % 1;
        this.spr.add(l.x + Math.sin(this.time * 3 + j * 2.1 + l.z) * 0.07 * (1 + ph), l.y + 0.1 + ph * 0.8, l.z + Math.cos(this.time * 2.6 + j * 1.7) * 0.07 * (1 + ph), 0.075 * (1 - ph * 0.6), 0.9 * (1 - ph), 1, 0.62 + 0.3 * (1 - ph), 0.2);
      }
    }
    this.spr.flush(this.vp, this.glCanvas.height * 1.218);
    if (post) this.finishPost(post, env, enclosed);

    this.drawOverlay(game, ents);
  }

  // ------------------------------------------------------------- instancias y sombras
  private drawInst(c: ChunkGpu, dist: number, lod: { decorDist: number; instDist: number }): void {
    if (!c.inst) return;
    const gl = this.gl;
    for (const g of c.groups) {
      if (!instVisible(g.id, dist, lod)) continue;
      const data = staticModel(lodModelId(g.id, dist, lod.instDist * 0.5));
      if (!data) continue;
      this.bindMesh(this.partMesh(data));
      gl.bindBuffer(gl.ARRAY_BUFFER, c.inst);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 32, g.first * 32);
      gl.enableVertexAttribArray(5);
      gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 32, g.first * 32 + 16);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, data.length / 10, g.count);
    }
  }

  /** Crea (o ajusta) el mapa de sombras. Devuelve false si el dispositivo no lo admite. */
  private ensureShadow(res: number): boolean {
    const gl = this.gl;
    if (this.sh && this.sh.res === res) return true;
    if (this.sh) {
      gl.deleteTexture(this.sh.tex);
      gl.deleteFramebuffer(this.sh.fbo);
      this.sh = null;
    }
    try {
      const tex = gl.createTexture()!;
      // En la unidad 2 (la de uSh): una textura con comparación en la unidad 0 rompería los sampler2D normales.
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, res, res);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0);
      if (!ok) { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); return false; }
      this.sh = { fbo, tex, res };
      return true;
    } catch {
      return false;
    }
  }

  /** Dibuja terreno, árboles, casas y criaturas cercanos en el mapa de profundidad de la luz. */
  private shadowPass(built: ChunkGpu[], ents: Ent[], env: Env, px: number, py: number, pz: number, half: number, q: { shadowRes: number }): void {
    const gl = this.gl, sh = this.sh!;
    const lm = lightMatrix([px, py, pz], env.sunDir, half, q.shadowRes);
    this.shLight = lm.vp;
    gl.bindFramebuffer(gl.FRAMEBUFFER, sh.fbo);
    gl.viewport(0, 0, sh.res, sh.res);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.colorMask(false, false, false, false);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2.5, 4);
    const P = this.progs.shadow;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP!, false, lm.vp);
    gl.uniformMatrix4fv(P.u.uModel!, false, ident());
    gl.uniform1f(P.u.uTime!, this.time);
    gl.uniform1f(P.u.uWind!, 0);
    const reach = half * 1.35 + 8;
    const lod = { decorDist: -1, instDist: half * 1.6 };
    this.noInstance();
    for (const c of built) {
      const cxm = (c.cx + 0.5) * CHUNK, czm = (c.cz + 0.5) * CHUNK;
      if (Math.abs(cxm - px) > reach || Math.abs(czm - pz) > reach) continue;
      if (c.terrain) {
        this.noInstance();
        this.bindMesh(c.terrain);
        gl.drawArrays(gl.TRIANGLES, 0, c.terrain.n);
      }
      this.drawInst(c, Math.hypot(cxm - px, czm - pz) - CHUNK * 0.5, lod);
    }
    this.noInstance();
    for (const e of ents) if (e.kind !== 'loot' && e.alpha > 0.5) this.drawEnt(e, P);
    gl.uniformMatrix4fv(P.u.uModel!, false, ident());
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ------------------------------------------------------------------ bloom
  private ensurePost(w: number, h: number): NonNullable<Renderer3D['post']> | null {
    const gl = this.gl;
    if (this.post && this.post.w === w && this.post.h === h) return this.post;
    this.freePost();
    try {
      const samples = Math.min(4, (gl.getParameter(gl.MAX_SAMPLES) as number) || 0);
      const msColor = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, msColor);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
      const msDepth = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, msDepth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
      const msFbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, msFbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msColor);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msDepth);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo');
      const mkTex = (tw: number, th: number): { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number } => {
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, tw, th);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fbo = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return { tex, fbo, w: tw, h: th };
      };
      const scene = mkTex(w, h);
      const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1), qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2);
      this.post = { w, h, msFbo, msColor, msDepth, sceneFbo: scene.fbo, sceneTex: scene.tex, t: [mkTex(hw, hh), mkTex(qw, qh), mkTex(qw, qh)] };
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return this.post;
    } catch {
      this.bloom = false;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return null;
    }
  }
  private freePost(): void {
    const p = this.post;
    if (!p) return;
    const gl = this.gl;
    gl.deleteFramebuffer(p.msFbo);
    gl.deleteRenderbuffer(p.msColor);
    gl.deleteRenderbuffer(p.msDepth);
    gl.deleteFramebuffer(p.sceneFbo);
    gl.deleteTexture(p.sceneTex);
    for (const t of p.t) { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); }
    this.post = null;
  }
  /** Resuelve el multimuestreo y compone escena + resplandor (umbral, desenfoque separable a baja resolución). */
  private finishPost(post: NonNullable<Renderer3D['post']>, env: Env, enclosed: boolean): void {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, post.msFbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, post.sceneFbo);
    gl.blitFramebuffer(0, 0, post.w, post.h, 0, 0, post.w, post.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i);
    const pass = (prog: Prog, target: { fbo: WebGLFramebuffer; w: number; h: number } | null, tex: WebGLTexture, set: () => void): void => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      gl.viewport(0, 0, target ? target.w : post.w, target ? target.h : post.h);
      gl.useProgram(prog.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      set();
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const [a, b, c] = post.t as [typeof post.t[0], typeof post.t[0], typeof post.t[0]];
    const th = enclosed ? 0.72 : 0.9 - env.night * 0.2;
    pass(this.progs.bright, a, post.sceneTex, () => { gl.uniform1i(this.progs.bright.u.uTex!, 0); gl.uniform2f(this.progs.bright.u.uTh!, th, 0.3); });
    const blur = (src: typeof a, dst: typeof a, dx: number, dy: number): void => pass(this.progs.blur, dst, src.tex, () => { gl.uniform1i(this.progs.blur.u.uTex!, 0); gl.uniform2f(this.progs.blur.u.uDir!, dx / src.w, dy / src.h); });
    blur(a, b, 1, 0);
    blur(b, c, 0, 1);
    blur(c, b, 1.6, 0);
    blur(b, c, 0, 1.6);
    const str = 0.4 + env.night * 0.6 + env.warm * 0.2 + (enclosed ? 0.3 : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, c.tex);
    gl.activeTexture(gl.TEXTURE0);
    pass(this.progs.compose, null, post.sceneTex, () => {
      gl.uniform1i(this.progs.compose.u.uScene!, 0);
      gl.uniform1i(this.progs.compose.u.uBloom!, 1);
      gl.uniform2f(this.progs.compose.u.uK!, str, 0.35);
    });
    gl.enable(gl.DEPTH_TEST);
  }

  // ------------------------------------------------------------------ niebla
  /** Sube la visibilidad cuando cambia (no por fotograma) y anima el despeje. Devuelve si hay niebla. */
  private syncFog(game: Game, dt: number): boolean {
    const gl = this.gl;
    const fm = game.fogMaps();
    if (!fm) return false;
    const z = game.zone;
    let f = this.fog;
    if (!f || f.w !== z.width || f.h !== z.height) {
      if (f) gl.deleteTexture(f.tex);
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.fog = f = { tex, w: z.width, h: z.height, data: new Uint8Array(z.width * z.height * 3), ver: -1, zone: '', mix: 1 };
    }
    if (f.ver !== game.fogVersion) {
      const fresh = f.zone !== z.id;
      const n = f.w * f.h;
      const old = f.data;
      const d = new Uint8Array(n * 3);
      for (let i = 0; i < n; i++) {
        const vis = fm.visible[i] ? 255 : 0;
        d[i * 3] = fm.explored[i] ? 255 : 0;
        d[i * 3 + 1] = vis;
        d[i * 3 + 2] = fresh ? vis : old[i * 3 + 1]!;
      }
      f.data = d;
      f.ver = game.fogVersion;
      f.zone = z.id;
      f.mix = fresh ? 1 : 0;
      gl.bindTexture(gl.TEXTURE_2D, f.tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, f.w, f.h, 0, gl.RGB, gl.UNSIGNED_BYTE, d);
    }
    f.mix = Math.min(1, f.mix + dt / 0.55);
    return true;
  }

  /** Uniformes de la niebla para un programa (apagada si no hay textura). */
  private fogUniforms(P: Prog, on: boolean): void {
    const gl = this.gl;
    const f = this.fog;
    gl.uniform4f(P.u.uVisP!, f ? 1 / f.w : 1, f ? 1 / f.h : 1, on && f ? 1 : 0, f ? f.mix : 1);
    gl.uniform2f(P.u.uVisT!, this.time, 0);
    if (on && f) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, f.tex);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(P.u.uVis!, 1);
    }
  }

  /** Dos láminas de bruma que flotan sobre lo desconocido. */
  private drawMist(env: Env, size: number): void {
    const gl = this.gl, P = this.progs.mist;
    gl.useProgram(P.p);
    for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniformMatrix4fv(P.u.uVP!, false, this.vp);
    gl.uniform3fv(P.u.uFogCol!, env.fog);
    gl.uniform1f(P.u.uSize!, size);
    this.fogUniforms(P, true);
    for (let l = 0; l < 2; l++) {
      gl.uniform3f(P.u.uCenter!, this.cam.x, this.cam.y + 0.9 + l * 1.2, this.cam.z);
      gl.uniform1f(P.u.uLayer!, l);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // ------------------------------------------------------------------ rigs
  private rig(key: string, make: () => Rig): Rig {
    let r = this.rigCache.get(key);
    if (!r) this.rigCache.set(key, (r = make()));
    return r;
  }
  private animOf(key: unknown, x: number, z: number, dt: number, face?: { x: number; z: number }): Anim {
    let a = this.anims.get(key);
    if (!a) this.anims.set(key, (a = { x, z, yaw: 0, sp: 0, t: Math.random() * 6 }));
    const dx = x - a.x, dz = z - a.z;
    const d = Math.hypot(dx, dz);
    const spd = dt > 0 ? d / dt : 0;
    a.sp += (Math.min(spd, 8) - a.sp) * Math.min(1, dt * 12);
    let target = a.yaw;
    if (d > 0.002) target = Math.atan2(dx, dz);
    else if (face) target = Math.atan2(face.x - x, face.z - z);
    let diff = target - a.yaw;
    while (diff > Math.PI) diff -= 6.2832;
    while (diff < -Math.PI) diff += 6.2832;
    a.yaw += diff * Math.min(1, dt * 12);
    a.x = x;
    a.z = z;
    if (a.sp > 0.3) a.t += dt * (6 + Math.min(a.sp, 5) * 1.4);
    else a.t += dt * 1.5;
    return a;
  }

  private collect(game: Game, geo: Geo): Ent[] {
    const out: Ent[] = [];
    const dt = Math.max(0.001, this.lastDt);
    const v = game.view;
    const gy = (x: number, z: number): number => geo.heightAt(x, z);
    const face = { x: v.rx + 0.5, z: v.ry + 0.5 };
    this.pickables.length = 0;
    const W = this.overlay.width, H = this.overlay.height;
    const reg = (e: Ent, r: number, pri: number): void => {
      const p = project(this.vp, e.gx, e.gy + 0.5 * e.scale, e.gz);
      if (p.w <= 0) return;
      const sx = (p.x * 0.5 + 0.5) * W, sy = (1 - (p.y * 0.5 + 0.5)) * H;
      e.sx = sx;
      e.sy = sy;
      if (e.tile) this.pickables.push({ sx, sy, r: r * this.pixelRatio * 40 / Math.max(0.5, p.w * 0.12), tile: e.tile, pri });
    };
    const hero = this.rig(`h:${JSON.stringify(this.heroColors)}`, () => humanoidRig({ ...this.heroColors }));
    const pa = this.animOf('player', v.rx + 0.5, v.ry + 0.5, dt);
    const lunge = lungeOffset(v.bumpT) / 16 * 2.2;
    const hop = v.stepT >= 0 ? Math.sin(v.stepT * Math.PI) * 0.06 : 0;
    const pe: Ent = { gx: v.rx + 0.5 + v.bumpDx * lunge, gz: v.ry + 0.5 + v.bumpDy * lunge, gy: gy(v.rx + 0.5, v.ry + 0.5) + hop, yaw: v.bumpT > 0 && (v.bumpDx || v.bumpDy) ? Math.atan2(v.bumpDx, v.bumpDy) : pa.yaw, scale: 1, rig: hero, mesh: null, walk: pa.sp > 0.3 ? 1 : 0, flash: v.flashT, alpha: 1, hover: 0, tile: null, kind: 'player' };
    if (v.bumpT > 0) pe.yaw = Math.atan2(v.bumpDx, v.bumpDy);
    this.setState(pe, v.bumpT, v.flashT);
    out.push(pe);
    (pe as Ent & { anim?: Anim }).anim = pa;

    // Compañero y mascota.
    const ally = game.ally;
    if (ally) {
      const l = ally.def.look;
      const r = this.rig(`a:${ally.def.id}`, () => humanoidRig({ skin: l.skin ?? '#d9a67a', hair: l.hair ?? '#3a2418', cloth: l.cloth, clothDark: l.clothDark, pants: l.pants, hat: l.hat, overlay: l.overlay }));
      const an = this.animOf(ally, ally.rx + 0.5, ally.ry + 0.5, dt, face);
      const down = game.state.party.down;
      const bump = lungeOffset(ally.bumpT) / 16 * 2.2;
      const e: Ent = { gx: ally.rx + 0.5 + ally.bumpDx * bump, gz: ally.ry + 0.5 + ally.bumpDy * bump, gy: gy(ally.rx + 0.5, ally.ry + 0.5), yaw: an.yaw, scale: 1, rig: r, mesh: null, walk: an.sp > 0.3 ? 1 : 0, flash: ally.flashT, alpha: down ? 0.45 : 1, hover: 0, tile: { x: ally.x, y: ally.y }, kind: 'ally', label: ally.def.name };
      e.bar = { v: down ? 0 : game.state.party.hp / Math.max(1, game.allyStats().maxHp), col: '#5ad05a' };
      this.setState(e, ally.bumpT, ally.flashT);
      (e as Ent & { anim?: Anim }).anim = an;
      reg(e, 0.9, 2);
      out.push(e);
    }
    const eu = game.escort, es = game.state.escort;
    if (eu && es) {
      const l = es.look;
      const r = this.rig(`x:${es.name}:${l.cloth}`, () => humanoidRig({ skin: l.skin ?? '#d9a67a', hair: l.hair ?? '#3a2418', cloth: l.cloth, clothDark: l.clothDark, pants: l.pants, hat: l.hat, overlay: l.overlay }));
      const an = this.animOf(eu, eu.rx + 0.5, eu.ry + 0.5, dt, face);
      const bump = lungeOffset(eu.bumpT) / 16 * 2.2;
      const e: Ent = { gx: eu.rx + 0.5 + eu.bumpDx * bump, gz: eu.ry + 0.5 + eu.bumpDy * bump, gy: gy(eu.rx + 0.5, eu.ry + 0.5), yaw: an.yaw, scale: 1, rig: r, mesh: null, walk: an.sp > 0.3 ? 1 : 0, flash: eu.flashT, alpha: 1, hover: 0, tile: { x: eu.x, y: eu.y }, kind: 'ally', label: es.name };
      e.bar = { v: es.hp / Math.max(1, es.maxHp), col: '#e8c85a' };
      this.setState(e, eu.bumpT, eu.flashT);
      (e as Ent & { anim?: Anim }).anim = an;
      reg(e, 0.9, 2);
      out.push(e);
    }
    const pu = game.pet, pi = game.petInstance;
    if (pu && pi) {
      const sp = PET_SPECIES.get(pi.species);
      if (sp) {
        const r = this.rig(`p:${sp.id}`, () => beastRig(sp.look.shape, sp.look));
        const an = this.animOf(pu, pu.rx + 0.5, pu.ry + 0.5, dt, face);
        const bump = lungeOffset(pu.bumpT) / 16 * 2.2;
        const e: Ent = { gx: pu.rx + 0.5 + pu.bumpDx * bump, gz: pu.ry + 0.5 + pu.bumpDy * bump, gy: gy(pu.rx + 0.5, pu.ry + 0.5), yaw: an.yaw, scale: 1, rig: r, mesh: null, walk: an.sp > 0.3 ? 1 : 0, flash: pu.flashT, alpha: pi.down ? 0.45 : 1, hover: 0, tile: { x: pu.x, y: pu.y }, kind: 'pet' };
        (e as Ent & { anim?: Anim }).anim = an;
        this.setState(e, pu.bumpT, pu.flashT);
        reg(e, 0.7, 2);
        out.push(e);
      }
    }
    // PNJ.
    for (const n of game.npcs) {
      if (!game.isVisible(n.x, n.y)) continue;
      const l = (n as NpcDef).look;
      const r = this.rig(`n:${n.id}`, () => humanoidRig({ skin: l.skin ?? '#d9a67a', hair: l.hair ?? '#3a2418', cloth: l.cloth, clothDark: l.clothDark, pants: l.pants, hat: l.hat, overlay: l.overlay }));
      const near = Math.hypot(n.x - v.rx, n.y - v.ry) < 5;
      const an = this.animOf(n, n.x + 0.5, n.y + 0.5, dt, near ? face : { x: n.x + 0.5 + (n.facingLeft ? -1 : 1), z: n.y + 1.6 });
      const mark = game.npcMarker(n.id);
      const e: Ent = { gx: n.x + 0.5, gz: n.y + 0.5, gy: gy(n.x + 0.5, n.y + 0.5), yaw: an.yaw, scale: 1, rig: r, mesh: null, walk: 0, flash: 0, alpha: 1, hover: 0, tile: { x: n.x, y: n.y }, kind: 'npc', label: near ? n.name : '' };
      e.sig = npcSignal(mark, npcHasShop(n)) ?? undefined;
      reg(e, 0.9, 3);
      out.push(e);
    }
    // Enemigos.
    const p = game.playerPos;
    for (const en of game.enemies) {
      if (Math.hypot(en.x - p.x, en.y - p.y) > PLAYER_SIGHT || !game.isVisible(en.x, en.y)) continue;
      const wild = en.def.pet ? PET_SPECIES.get(en.def.pet.species) : undefined;
      const look = wild ? wild.look : en.def.look;
      const ov = wild ? undefined : en.def.look.overlay;
      const r = this.rig(`e:${wild ? 'w' + wild.id : en.def.id}`, () => beastRig(look.shape, look, ov));
      const an = this.animOf(en, en.rx + 0.5, en.ry + 0.5, dt, en.alerted ? face : undefined);
      const bump = lungeOffset(en.bumpT) / 16 * 2.2;
      const sc = en.def.boss ? 1.55 : 1;
      const danger = dangerLevel(en.def.level, game.state.player.level);
      const col = { trivial: '#8a8a8a', facil: '#80c080', normal: '#ece6d6', dificil: '#f0a040', mortal: '#ff4040' }[danger];
      const e: Ent = { gx: en.rx + 0.5 + en.bumpDx * bump, gz: en.ry + 0.5 + en.bumpDy * bump, gy: gy(en.rx + 0.5, en.ry + 0.5), yaw: en.bumpT > 0 ? Math.atan2(en.bumpDx, en.bumpDy) : an.yaw, scale: sc, rig: r, mesh: null, walk: an.sp > 0.3 ? 1 : 0, flash: en.flashT, alpha: 1, hover: 0, tile: { x: en.x, y: en.y }, kind: en.def.boss ? 'boss' : 'enemy', label: `${danger === 'mortal' ? '☠' : ''}${en.def.level}`, subCol: col };
      if (en.def.boss || danger === 'mortal') e.sig = 'danger';
      this.setState(e, en.bumpT, en.flashT);
      if (en.statuses.length) e.icons = en.statuses.slice(0, 3).map((s) => STATUS_INFO[s.id].icon);
      (e as Ent & { anim?: Anim }).anim = an;
      reg(e, 0.9, 4);
      out.push(e);
    }
    // Botín y elementos del mapa.
    for (const g of game.ground) {
      if ((g.age !== undefined && g.age < 0) || !game.isExplored(g.x, g.y)) continue;
      const best = g.items.reduce<string>((acc, it) => (acc === '' ? rarityOf(it).color : acc), '');
      const col = g.items.length ? (g.items.map((it) => rarityOf(it)).sort((a, b) => ['comun', 'poco_comun', 'raro', 'epico', 'legendario'].indexOf(b.id) - ['comun', 'poco_comun', 'raro', 'epico', 'legendario'].indexOf(a.id))[0]?.color ?? best) : '#f2d888';
      void itemDef;
      const age = g.age ?? 99;
      const hopY = age < 0.55 ? Math.sin((age / 0.55) * Math.PI) * 0.7 : 0;
      const m = this.staticMesh(`loot${col}`, () => lootModel(col));
      const e: Ent = { gx: g.x + 0.5, gz: g.y + 0.5, gy: gy(g.x + 0.5, g.y + 0.5) + hopY + Math.sin(this.time * 3 + g.x) * 0.03 + 0.04, yaw: this.time * 1.2, scale: 1.1, rig: null, mesh: m, walk: 0, flash: 0, alpha: 1, hover: 0, tile: { x: g.x, y: g.y }, kind: 'loot' };
      reg(e, 0.7, 1);
      out.push(e);
    }
    for (const f of game.featureSprites()) {
      if (!game.isExplored(f.x, f.y)) continue;
      let m: Gpu;
      if (f.sprite.startsWith('chest')) m = this.staticMesh(f.sprite, () => chestModel(f.sprite === 'chestOpen'));
      else if (f.sprite.startsWith('ore')) m = this.staticMesh(f.sprite, () => oreModel(f.sprite === 'oreIron' ? '#e0a070' : f.sprite === 'oreSilver' ? '#d8e4f0' : '#ff6ad8'));
      else m = this.staticMesh(f.sprite, () => lootModel('#ff6060'));
      const near = Math.hypot(f.x - p.x, f.y - p.y) < 4;
      const e: Ent = { gx: f.x + 0.5, gz: f.y + 0.5, gy: gy(f.x + 0.5, f.y + 0.5), yaw: 0.2 + (f.x * 7 + f.y * 3) % 6 * 0.1, scale: 1, rig: null, mesh: m, walk: 0, flash: 0, alpha: f.dim ? 0.5 : 1, hover: 0, tile: { x: f.x, y: f.y }, kind: 'feature' };
      if (f.sprite === 'chest' || f.sprite === 'chestLocked') e.sig = 'chest';
      else if (f.sprite.startsWith('ore') && near) e.sig = 'ore';
      reg(e, 0.8, 1);
      out.push(e);
    }
    return out;
  }
  private lastDt = 0.016;
  /** Estado de animación de una criatura según su embestida (bumpT baja de 1,3 a 0) y su destello de golpe. */
  private setState(e: Ent, bump: number, flash: number): void {
    if (bump > 0) { e.st = 'attack'; e.k = 1 - Math.max(0, Math.min(1, bump / 1.3)); }
    else if (flash > 0) { e.st = 'hurt'; e.k = 1 - Math.min(1, flash * 2.5); }
    else e.st = e.walk ? 'walk' : 'idle';
  }

  /** Silueta translúcida del héroe cuando algo lo tapa (árboles, tejados): suave, sin recortes a trozos. */
  private drawXray(e: Ent | undefined, P: Prog): void {
    if (!e || !e.rig) return;
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendColor(0, 0, 0, 0.5);
    gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
    gl.depthFunc(gl.GREATER);
    gl.depthMask(false);
    this.drawEnt({ ...e, flash: 1.2, kind: 'xray' }, P);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  private matBuf: Float32Array[] = [];
  private drawEnt(e: Ent, P: Prog): void {
    const gl = this.gl;
    if (e.kind === 'xray') gl.uniform4f(P.u.uFlash!, 0.55, 0.8, 1, 0.8);
    else gl.uniform4f(P.u.uFlash!, 1, e.kind === 'player' ? 0.2 : 0.25, 0.2, Math.min(0.75, e.flash * 0.75));
    if (e.mesh) {
      const m = trs(e.gx, e.gy, e.gz, e.yaw, e.scale);
      gl.uniformMatrix4fv(P.u.uModel!, false, m);
      this.bindMesh(e.mesh);
      gl.drawArrays(gl.TRIANGLES, 0, e.mesh.n);
      return;
    }
    const rig = e.rig;
    if (!rig) return;
    const an = (e as Ent & { anim?: Anim }).anim;
    const seed = e.seed ?? e.gx * 3.1 + e.gz;
    const pose = rigPose(rig, { state: e.st ?? (e.walk ? 'walk' : 'idle'), k: e.k ?? 0, time: this.time, walkT: an ? an.t : this.time * 1.5, walk: e.walk, seed });
    const lift = rig.flyer ? (0.5 + Math.sin(this.time * 3 + seed) * 0.08) * e.scale : 0;
    const base = trs(e.gx, e.gy + lift, e.gz, e.yaw, e.scale);
    const mats = rigMatrices(rig, base, pose, this.matBuf);
    rig.parts.forEach((part, i) => {
      gl.uniformMatrix4fv(P.u.uModel!, false, mats[i]!);
      const g = this.partMesh(part.mesh);
      this.bindMesh(g);
      gl.drawArrays(gl.TRIANGLES, 0, g.n);
    });
  }

  /** Techo recortable de una casa: un plano cálido sobre toda la sala que se desvanece al entrar. */
  private drawCeiling(w: number, h: number, floorY: number, alpha: number): void {
    const gl = this.gl;
    const P = this.progs.blob;
    gl.useProgram(P.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    const quad = this.staticMesh('ceiling', () => {
      const v: number[] = [];
      for (const [x, z] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]] as const) v.push(x, 0, z, 0, 0, 0, 0, -1, 0, 1);
      return new Float32Array(v);
    });
    gl.uniformMatrix4fv(P.u.uVP!, false, this.vp);
    gl.uniformMatrix4fv(P.u.uModel!, false, new Float32Array([w, 0, 0, 0, 0, 1, 0, 0, 0, 0, h, 0, 0, floorY + 2.3, 0, 1]));
    gl.uniform3f(P.u.uTint!, 0.2, 0.11, 0.06);
    gl.uniform1f(P.u.uAlpha!, alpha * 0.96);
    this.bindMesh(quad, false);
    this.noInstance();
    gl.drawArrays(gl.TRIANGLES, 0, quad.n);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /** Sombras blandas alargadas según la luz del día; con mapa de sombras sólo queda un toque de oclusión. */
  private drawShadows(ents: Ent[], env: Env, mapped: boolean): void {
    const gl = this.gl;
    const P = this.progs.blob;
    gl.useProgram(P.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniformMatrix4fv(P.u.uVP!, false, this.vp);
    gl.uniform3f(P.u.uTint!, 0.02, 0.03, 0.05);
    this.bindMesh(this.blob, false);
    this.noInstance();
    const str = Math.max(0.25, env.shadowStrength);
    for (const e of ents) {
      const r = e.rig ? e.rig.shadow * e.scale : e.kind === 'loot' ? 0.18 : 0.38;
      const lift = e.kind === 'loot' ? 0.5 : e.rig?.flyer ? 0.4 : 1;
      const h = e.rig ? e.rig.height * e.scale : 0.4;
      if (mapped) blobMatrix(e.gx, e.gy + 0.015, e.gz, r * 1.2, 0, [0, 1, 0], this.blobM);
      else blobMatrix(e.gx, e.gy + 0.015, e.gz, r * 1.5, h * 0.7, env.sunDir, this.blobM);
      gl.uniformMatrix4fv(P.u.uModel!, false, this.blobM);
      gl.uniform1f(P.u.uAlpha!, (mapped ? 0.3 : 0.55) * e.alpha * lift * (mapped ? 1 : str));
      gl.drawArrays(gl.TRIANGLES, 0, this.blob.n);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /** Señalización diegética: runas en el suelo, cristales flotantes, chispas y el espíritu guía. */
  private drawSignals(game: Game, geo: Geo, ents: Ent[], P: Prog, px: number, py: number, pz: number, showGuide: boolean): void {
    const gl = this.gl;
    const t = this.time;
    gl.uniform4f(P.u.uFlash!, 0, 0, 0, 0);
    const draw = (g: Gpu, x: number, y: number, z: number, yaw: number, s: number): void => {
      gl.uniformMatrix4fv(P.u.uModel!, false, trs(x, y, z, yaw, s));
      this.bindMesh(g);
      gl.drawArrays(gl.TRIANGLES, 0, g.n);
    };
    const gem = (k: SignalKind): Gpu => this.staticMesh(`gem:${k}`, () => gemModel(k));
    const rune = (k: SignalKind): Gpu => this.staticMesh(`rune:${k}`, () => runeRingModel(k));
    const spr = this.spr;
    const rgb = (k: SignalKind): [number, number, number] => hexRgb(SIGNAL_COLOR[k]);
    const sparkle = (k: SignalKind, x: number, y: number, z: number, h: number, a: number, n = 3): void => {
      const c = rgb(k);
      for (let i = 0; i < n; i++) {
        const ang = t * 1.4 + (i / n) * 6.283, ph = (t * 0.6 + i / n) % 1;
        spr.add(x + Math.cos(ang) * 0.3, y + h * ph, z + Math.sin(ang) * 0.3, 0.16 * (1 - ph * 0.5), a * Math.sin(ph * 3.14), c[0], c[1], c[2]);
      }
    };
    for (const e of ents) {
      if (!e.sig) continue;
      const k = e.sig;
      const mo = crystalMotion(t, e.gx * 1.3 + e.gz);
      const top = (e.rig ? e.rig.height * e.scale : 0.7) + 0.34 + (e.rig?.flyer ? 0.5 : 0);
      const near = Math.hypot(e.gx - px, e.gz - pz);
      const fade = Math.min(1, Math.max(0.35, 1.4 - near / 16));
      const c = rgb(k);
      if (k === 'chest' || k === 'ore') {
        sparkle(k, e.gx, e.gy + 0.25, e.gz, 0.7, 0.8 * fade, 3);
        continue;
      }
      draw(gem(k), e.gx, e.gy + top + mo.y, e.gz, mo.yaw, k === 'danger' ? 1.2 : 1);
      spr.add(e.gx, e.gy + top + 0.2 + mo.y, e.gz, 1.1, 0.34 * mo.glow * fade, c[0], c[1], c[2]);
      sparkle(k, e.gx, e.gy + top - 0.1, e.gz, 0.6, 0.9 * fade, 3);
      if (k === 'quest' || k === 'turnin' || k === 'danger') draw(rune(k), e.gx, e.gy + 0.01, e.gz, t * (k === 'danger' ? -0.9 : 0.6), (k === 'danger' ? 1.5 : 1) * (e.scale > 1 ? 1.4 : 1));
    }
    // Salidas: runa suave en el suelo y un par de chispas.
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    for (const e of game.zone.exits) {
      const y = geo.heightAt(e.x + 0.5, e.y + 0.5);
      const near = Math.hypot(e.x - game.playerPos.x, e.y - game.playerPos.y);
      if (near > 14) continue;
      draw(rune('exit'), e.x + 0.5, y, e.y + 0.5, t * 0.5, 0.95 + pulse * 0.05);
      if (!e.door) sparkle('exit', e.x + 0.5, y + 0.1, e.y + 0.5, 1.0, 0.7, 3);
    }
    // Ruta tocada: destellos suaves y runa en el destino.
    const v = game.view;
    const sd = rgb('exit');
    v.path.forEach((p, i) => spr.add(p.x + 0.5, geo.heightAt(p.x + 0.5, p.y + 0.5) + 0.12, p.y + 0.5, 0.22 + 0.04 * Math.sin(t * 5 + i), 0.75, sd[0], sd[1], sd[2]));
    if (v.target) draw(rune('exit'), v.target.x + 0.5, geo.heightAt(v.target.x + 0.5, v.target.y + 0.5), v.target.y + 0.5, t * 2, 0.8 + pulse * 0.2);
    // Meta de la misión: anillo de runas, cristal violeta y un espíritu (luciérnaga) que guía el camino.
    const goal = game.questGoal;
    if (showGuide && goal?.point && !game.inCombat) {
      const gp = goal.point;
      const gy = geo.heightAt(gp.x + 0.5, gp.y + 0.5);
      const gc = rgb('goal');
      const mo = crystalMotion(t, 1.7);
      draw(rune('goal'), gp.x + 0.5, gy, gp.y + 0.5, -t * 0.8, 1.3 + pulse * 0.1);
      draw(gem('goal'), gp.x + 0.5, gy + 1.15 + mo.y, gp.y + 0.5, mo.yaw, 1.15);
      spr.add(gp.x + 0.5, gy + 1.35 + mo.y, gp.y + 0.5, 1.3, 0.36 * mo.glow, gc[0], gc[1], gc[2]);
      sparkle('goal', gp.x + 0.5, gy + 0.05, gp.y + 0.5, 1.6, 0.9, 5);
      this.guideSpirit(game, geo, gp, px, py, pz);
    }
    gl.uniformMatrix4fv(P.u.uModel!, false, ident());
  }

  /** Luciérnaga que flota por delante del jugador siguiendo el camino y deja un rastro de luz. */
  private guideSpirit(game: Game, geo: Geo, gp: Point, px: number, py: number, pz: number): void {
    const t = this.time;
    const from = game.playerPos;
    const far = Math.hypot(gp.x - from.x, gp.y - from.y);
    if (far < 2.5) return;
    const key = `${game.zone.id}|${gp.x},${gp.y}|${from.x >> 1},${from.y >> 1}`;
    if (this.guide.key !== key) {
      const path = findPath(game.zone.width, game.zone.height, from, gp, (x, y) => game.playerCanWalk(x, y), { allowGoalBlocked: true, maxNodes: 2500 });
      this.guide = { ...this.guide, key, path: path ?? [] };
    }
    const g = this.guide;
    const pts = g.path.length ? pathAhead(g.path, from, 3, 6, 0.9) : (() => {
      const dx = gp.x - from.x, dz = gp.y - from.y, d = Math.hypot(dx, dz) || 1;
      return [3, 4.5, 6, 7.5, 9].map((s, i) => ({ x: from.x + 0.5 + (dx / d) * s, z: from.y + 0.5 + (dz / d) * s, k: i / 4 }));
    })();
    const c = hexRgb('#c8e8ff'), gc = hexRgb(SIGNAL_COLOR.goal);
    pts.forEach((p, i) => {
      const hy = geo.heightAt(p.x, p.z) + 0.55 + Math.sin(t * 3 + i) * 0.06;
      const lead = i === 0;
      if (lead) {
        const wob = Math.sin(t * 2.2) * 0.12;
        this.spr.add(p.x + wob, hy + 0.15, p.z - wob, 0.5, 0.95, c[0], c[1], c[2]);
        this.spr.add(p.x + wob, hy + 0.15, p.z - wob, 1.4, 0.3, gc[0], gc[1], gc[2]);
        g.pos = { x: p.x + wob, z: p.z - wob };
      } else this.spr.add(p.x, hy - 0.08, p.z, 0.3 * (1 - p.k * 0.5), 0.5 * (1 - p.k * 0.7), gc[0], gc[1], gc[2]);
    });
    void px; void py; void pz;
  }

  private drawSky(env: Env, style: ZoneStyle, warm: number): void {
    const gl = this.gl, P = this.progs.sky;
    if (!this.invVp) return;
    gl.useProgram(P.p);
    for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.uniformMatrix4fv(P.u.uInv!, false, this.invVp);
    gl.uniform3fv(P.u.uEye!, this.eye);
    gl.uniform3fv(P.u.uTop!, env.skyTop);
    gl.uniform3f(P.u.uHor!, env.skyHorizon[0] * 0.5 + env.fog[0] * 0.5, env.skyHorizon[1] * 0.5 + env.fog[1] * 0.5, env.skyHorizon[2] * 0.5 + env.fog[2] * 0.5);
    gl.uniform3fv(P.u.uFog!, env.fog);
    gl.uniform3fv(P.u.uSunDir!, env.sunDir);
    gl.uniform3fv(P.u.uSunCol!, env.sunCol);
    gl.uniform1f(P.u.uTime!, this.time);
    gl.uniform1f(P.u.uStars!, env.stars);
    gl.uniform1f(P.u.uFlat!, style.enclosed ? 1 : 0);
    gl.uniform4f(P.u.uMoon!, env.moonDir[0], env.moonDir[1], env.moonDir[2], env.moonAmt);
    gl.uniform4f(P.u.uWarm!, 1, 0.52, 0.3, style.enclosed ? 0 : warm * 0.85);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }

  private drawWater(visible: ChunkGpu[], env: Env, fogDen: number, fogOff: number, lpos: Float32Array, lcol: Float32Array, nl: number, fogOn: boolean): void {
    const gl = this.gl;
    const P = this.progs.water;
    gl.useProgram(P.p);
    this.fogUniforms(P, fogOn);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniformMatrix4fv(P.u.uVP!, false, this.vp);
    gl.uniform1f(P.u.uTime!, this.time);
    gl.uniform3fv(P.u.uCam!, this.eye);
    gl.uniform3fv(P.u.uFogCol!, env.fog);
    gl.uniform1f(P.u.uFogDen!, fogDen);
    gl.uniform1f(P.u.uFogOff!, fogOff);
    gl.uniform3fv(P.u.uSunDir!, env.sunDir);
    gl.uniform3fv(P.u.uSunCol!, env.sunCol);
    gl.uniform3fv(P.u.uSky!, env.skyHorizon);
    gl.uniform3fv(P.u.uAmbTop!, env.ambTop);
    gl.uniform4fv(P.u.uL!, lpos);
    gl.uniform3fv(P.u.uLC!, lcol);
    gl.uniform1i(P.u.uNL!, nl);
    for (const c of visible) {
      if (!c.water) continue;
      this.bindMesh(c.water);
      gl.drawArrays(gl.TRIANGLES, 0, c.water.n);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  private drawParticles(style: ZoneStyle, env: Env, px: number, py: number, pz: number, count: number, kind: ParticleKind): void {
    void style;
    if (kind === 'ninguna' || count <= 0) return;
    const gl = this.gl;
    const P = this.progs.part;
    gl.useProgram(P.p);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    const k = kind;
    const additive = k === 'polen' || k === 'motas' || k === 'esporas' || k === 'brasas' || k === 'luciernagas';
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    const night = env.night;
    const cfg = {
      polen: { c: [1, 0.95, 0.7, 0.55 * (1 - night * 0.6)], v: [0.15, 0.1, 0.1], s: 7 },
      motas: { c: [0.8, 1, 0.5, 0.35 + night * 0.65], v: [0.1, 0.06, 0.1], s: 9 },
      nieve: { c: [1, 1, 1, 0.85], v: [0.5, -1.0, 0.3], s: 6 },
      polvo: { c: [0.9, 0.8, 0.6, 0.35], v: [1.4, 0.05, 0.4], s: 6 },
      esporas: { c: [0.6, 1, 0.55, 0.45 + night * 0.3], v: [0.05, 0.16, 0.05], s: 8 },
      brasas: { c: [1, 0.55, 0.2, 0.8], v: [0.1, 0.6, 0.1], s: 7 },
      luciernagas: { c: [0.85, 1, 0.35, 1.2 * env.fireflies], v: [0.04, 0.02, 0.05], s: 24 },
      bruma: { c: [0.55, 0.6, 0.72, 0.1], v: [0.1, 0.0, 0.06], s: 70 },
      ninguna: { c: [0, 0, 0, 0], v: [0, 0, 0], s: 0 },
    }[k];
    gl.uniformMatrix4fv(P.u.uVP!, false, this.vp);
    gl.uniform3f(P.u.uCenter!, px, py, pz);
    gl.uniform1f(P.u.uTime!, this.time);
    gl.uniform3f(P.u.uVel!, cfg.v[0]!, cfg.v[1]!, cfg.v[2]!);
    gl.uniform1f(P.u.uSize!, cfg.s);
    gl.uniform1f(P.u.uScale!, this.glCanvas.height / 540);
    gl.uniform1f(P.u.uGround!, py - (k === 'bruma' ? 0.15 : 0.2));
    gl.uniform1f(P.u.uBox!, 22);
    gl.uniform1f(P.u.uBoxH!, k === 'nieve' ? 8 : k === 'bruma' ? 0.9 : k === 'luciernagas' ? 2.2 : 4.5);
    gl.uniform4f(P.u.uColor!, cfg.c[0]!, cfg.c[1]!, cfg.c[2]!, cfg.c[3]!);
    gl.disableVertexAttribArray(1);
    gl.disableVertexAttribArray(2);
    gl.disableVertexAttribArray(3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, Math.min(count, this.partCount));
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // ------------------------------------------------------------- overlay 2D
  private drawOverlay(game: Game, ents: Ent[]): void {
    const ctx = this.ctx2d;
    const W = this.overlay.width, H = this.overlay.height, dpr = this.pixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    const px = (n: number): number => n * dpr;
    const text = (s: string, x: number, y: number, size: number, fill: string, stroke = '#000', bold = true): void => {
      ctx.font = `${bold ? 'bold ' : ''}${px(size)}px sans-serif`;
      ctx.lineWidth = px(size / 4);
      ctx.strokeStyle = stroke;
      ctx.strokeText(s, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(s, x, y);
    };
    const lab = (e: Ent, up: number): { x: number; y: number } | null => {
      const p = project(this.vp, e.gx, e.gy + up * e.scale + (e.rig?.flyer ? 0.5 : 0), e.gz);
      if (p.w <= 0) return null;
      return { x: (p.x * 0.5 + 0.5) * W, y: (1 - (p.y * 0.5 + 0.5)) * H };
    };
    for (const e of ents) {
      if (e.kind === 'player' || e.kind === 'loot') continue;
      const top = (e.rig?.height ?? 0.7) + 0.2;
      const p = lab(e, top);
      if (!p) continue;
      let y = p.y;
      if (e.bar) {
        const w = px(26);
        ctx.fillStyle = '#000';
        ctx.fillRect(p.x - w / 2 - 1, y - px(3), w + 2, px(5));
        ctx.fillStyle = e.bar.col;
        ctx.fillRect(p.x - w / 2, y - px(2), w * Math.max(0, Math.min(1, e.bar.v)), px(3));
        y -= px(7);
      }
      if (e.kind === 'enemy' || e.kind === 'boss') {
        text(e.label ?? '', p.x, y, e.kind === 'boss' ? 13 : 11, e.subCol ?? '#fff');
        if (e.icons) { text(e.icons.join(''), p.x, y - px(12), 11, '#fff', '#000', false); }
      } else if (e.label) text(e.label, p.x, y, 10, '#ece6d6', '#000', false);
    }
    // Números flotantes.
    for (const f of game.fx) {
      if (f.kind !== 'text' || f.t < 0) continue;
      const k = f.t / f.life;
      const y = this.cur ? this.cur.geo.heightAt(f.x + 0.5, f.y + 0.5) : 0;
      const p = project(this.vp, f.x + 0.5, y + 1.3 + k * 0.9, f.y + 0.5);
      if (p.w <= 0) continue;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const size = (f.size ?? (/^[-+¡]?\d/.test(f.text) ? 10 : 7)) * 1.55;
      ctx.font = `bold ${px(size)}px sans-serif`;
      ctx.lineWidth = px(3);
      ctx.strokeStyle = '#000';
      ctx.strokeText(f.text, (p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, (p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H);
      ctx.globalAlpha = 1;
    }
    // Rótulo de las salidas cercanas (uno por destino).
    const pp = game.playerPos;
    const seen = new Set<string>();
    for (const x of game.zone.exits) {
      if (Math.hypot(x.x - pp.x, x.y - pp.y) > 4 || !x.label || seen.has(x.label)) continue;
      seen.add(x.label);
      const y = this.cur ? this.cur.geo.heightAt(x.x + 0.5, x.y + 0.5) : 0;
      const p = project(this.vp, x.x + 0.5, y + 1.6, x.y + 0.5);
      if (p.w > 0) text(x.label, (p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H, 10, '#e6f3ff', 'rgba(10,8,20,0.8)', false);
    }
  }

  /** Último dt (lo fija render() antes de recopilar). */
  setDt(dt: number): void {
    this.lastDt = dt;
  }
}
