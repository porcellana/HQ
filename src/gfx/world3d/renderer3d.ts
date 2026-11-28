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
import { PLAYER_SIGHT, lungeOffset, nightAmount, DAY_LENGTH_TURNS, type RenderOptions } from '../viewconst';
import { hexRgb } from './mesh';
import { beastRig, chestModel, humanoidRig, lootModel, oreModel, staticModel, type Rig } from './models';
import { rigMatrices, rigPose, type AnimState } from './anim';
import { crystalMotion, gemModel, npcHasShop, npcSignal, pathAhead, runeRingModel, SIGNAL_COLOR, type SignalKind } from './signals';
import { makeProg, SpriteBatch, type Prog } from './glutil';
import { camDistance, FpsGuard, lowerQuality, QUALITY, remapDir, type Quality } from './quality';
import { BLOB_FS, BLOB_VS, MAX_LIGHTS, PART_FS, PART_VS, SKY_FS, SKY_VS, WATER_FS, WATER_VS, WORLD_FS, WORLD_VS } from './shaders';
import { envFor, zoneStyle, type Env, type ZoneStyle } from './style';
import { buildChunk, buildSkirt, chunksInRadius, CHUNK, Geo, type ChunkData, type Light } from './terrain';
import { ident, invert, lookAt, mul, perspective, project, trs, unprojectRay, type Mat4 } from './mat';

interface Gpu { buf: WebGLBuffer; n: number }
interface ChunkGpu { terrain: Gpu | null; water: Gpu | null; inst: WebGLBuffer | null; groups: Array<{ id: string; first: number; count: number }>; lights: Light[]; cx: number; cz: number }
interface Ent {
  gx: number; gz: number; gy: number; yaw: number; scale: number; rig: Rig | null; mesh: Gpu | null; walk: number; flash: number; alpha: number;
  hover: number; tile: Point | null; kind: string; label?: string; subCol?: string; bar?: { v: number; col: string }; icons?: string[]; hop?: number; sx?: number; sy?: number;
  st?: AnimState; k?: number; sig?: SignalKind; seed?: number;
}
interface Anim { x: number; z: number; yaw: number; sp: number; t: number }

const ENV_HOLE_Y = 0.45;
void ENV_HOLE_Y;

export class Renderer3D {
  heroColors: HumanoidColors = DEFAULT_HERO_COLORS;
  pixelRatio = 1;
  private gl: WebGL2RenderingContext;
  private progs!: { world: Prog; water: Prog; blob: Prog; part: Prog; sky: Prog };
  private spr!: SpriteBatch;
  private guide: { path: Point[]; key: string; t: number; pos: { x: number; z: number } | null } = { path: [], key: '', t: 0, pos: null };
  private quality: Quality = 'media';
  private step = 0;
  private zoomCur = 0;
  private yaw = 0;
  private yawT = 0;
  private pitch = 0.92;
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
  private guard = new FpsGuard();
  private builds = 0;
  /** Lo llama el renderizador si pierde el contexto GL o hay que bajar calidad. */
  onContextLost: (() => void) | null = null;
  onAutoQuality: ((q: Quality) => void) | null = null;
  autoQuality = true;
  private lastCss = { w: 0, h: 0 };

  constructor(private readonly glCanvas: HTMLCanvasElement, private readonly overlay: HTMLCanvasElement, quality: Quality = 'media') {
    const gl = glCanvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 no disponible');
    this.gl = gl;
    this.quality = quality;
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
      world: mk(WORLD_VS, WORLD_FS, ['uVP', 'uModel', 'uTime', 'uWind', 'uCam', 'uFogCol', 'uFogDen', 'uFogOff', 'uSunDir', 'uSunCol', 'uAmbTop', 'uAmbBot', 'uFlash', 'uDis', 'uDisY', 'uDisCol', ...lightU]),
      water: mk(WATER_VS, WATER_FS, ['uVP', 'uTime', 'uCam', 'uFogCol', 'uFogDen', 'uFogOff', 'uSunDir', 'uSunCol', 'uSky', 'uAmbTop', ...lightU]),
      blob: mk(BLOB_VS, BLOB_FS, ['uVP', 'uModel', 'uAlpha']),
      part: mk(PART_VS, PART_FS, ['uVP', 'uCenter', 'uTime', 'uVel', 'uSize', 'uScale', 'uGround', 'uBox', 'uBoxH', 'uColor']),
      sky: mk(SKY_VS, SKY_FS, ['uInv', 'uEye', 'uTop', 'uHor', 'uFog', 'uSunDir', 'uSunCol', 'uTime', 'uStars', 'uFlat']),
    };
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
  setQuality(q: Quality): void {
    if (q === this.quality) return;
    this.quality = q;
    this.dropChunks();
    this.guard.reset();
    this.resize();
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
    const s = Math.min(dpr, 2) * q.scale;
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
  setZoomStep(step: number): number {
    this.step = Math.max(-2, Math.min(2, Math.round(step)));
    return this.step;
  }
  zoomBy(d: number): number {
    return this.setZoomStep(this.step + d);
  }
  resetZoom(): number {
    return this.setZoomStep(0);
  }
  /** Gira la cámara (arrastre horizontal en píxeles CSS). */
  rotateBy(dxPx: number): void {
    this.yawT += dxPx * 0.0075;
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
    if (this.autoQuality && this.guard.push(dt) && this.quality !== 'baja') {
      this.setQuality(lowerQuality(this.quality));
      this.onAutoQuality?.(this.quality);
    }
    if (this.overlay.clientWidth !== this.lastCss.w || this.overlay.clientHeight !== this.lastCss.h) this.resize();
    const zone = game.zone;
    if (!this.cur || this.cur.zone !== zone) this.enter(zone);
    const cur = this.cur!;
    const { geo, style } = cur;
    const q = QUALITY[this.quality];

    // Entorno: hora del día, noche y oscuridad de la zona.
    const outdoor = zone.def.kind === 'town' || zone.def.kind === 'wild' || zone.def.kind === 'world';
    const night = opts.dayNight && outdoor ? nightAmount(game.state.turn) : 0;
    const env = envFor(style, night, zone.def.darkness ?? 0, (game.state.turn % DAY_LENGTH_TURNS) / (DAY_LENGTH_TURNS * 0.6));

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
    this.yaw += (this.yawT - this.yaw) * Math.min(1, dt * 10);
    this.zoomCur += (this.step - this.zoomCur) * Math.min(1, dt * 8);
    const di = Math.max(0, Math.min(4, 2 - this.zoomCur));
    const lo = Math.floor(di), hi = Math.ceil(di);
    const dist = camDistance(2 - lo) + (camDistance(2 - hi) - camDistance(2 - lo)) * (di - lo);
    const enclosed = style.enclosed;
    const pitch = enclosed ? 1.0 : this.pitch;
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

    // Chunks visibles (se construyen de forma escalonada).
    const radius = q.radius * (dist > 18 ? 1.25 : 1);
    const vis = chunksInRadius(geo.w, geo.h, this.cam.x, this.cam.z, radius);
    this.builds = 0;
    const first = cur.chunks.size === 0;
    const visible: ChunkGpu[] = [];
    vis.sort((a, b) => Math.hypot((a[0] + 0.5) * CHUNK - this.cam.x, (a[1] + 0.5) * CHUNK - this.cam.z) - Math.hypot((b[0] + 0.5) * CHUNK - this.cam.x, (b[1] + 0.5) * CHUNK - this.cam.z));
    const nx = Math.ceil(geo.w / CHUNK);
    for (const [cx, cz] of vis) {
      const key = cz * nx + cx;
      let c = cur.chunks.get(key);
      if (!c) {
        if (!first && this.builds >= 2) continue;
        this.builds++;
        c = this.chunkGpu(buildChunk(geo, cx, cz, { density: q.density }));
        cur.chunks.set(key, c);
      }
      visible.push(c);
    }
    // Libera chunks lejanos para no acumular memoria.
    if (cur.chunks.size > vis.length + 10) {
      for (const [key, c] of cur.chunks) {
        if (Math.hypot((c.cx + 0.5) * CHUNK - this.cam.x, (c.cz + 0.5) * CHUNK - this.cam.z) > radius + CHUNK * 2.2) {
          this.freeChunk(c);
          cur.chunks.delete(key);
        }
      }
    }

    // ---- fotograma GL
    gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
    gl.clearColor(env.fog[0], env.fog[1], env.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    this.drawSky(env, style);
    const fogDen = Math.max(env.fogDensity * 0.6, 1.9 / radius);

    // Luces cercanas: la antorcha del jugador + faroles/hogueras/cristales.
    const lightAmt = Math.max(night * 0.85, enclosed ? 1 : (zone.def.darkness ?? 0) * 1.4);
    const L: Array<{ x: number; y: number; z: number; r: number; g: number; b: number; rad: number; d: number }> = [];
    if (lightAmt > 0.05) L.push({ x: px, y: py + 1.4, z: pz, r: 1 * lightAmt, g: 0.78 * lightAmt, b: 0.5 * lightAmt, rad: 8, d: -1 });
    const gk = 0.3 + 0.7 * Math.max(night, enclosed ? 1 : 0, (zone.def.darkness ?? 0));
    for (const c of visible) for (const l of c.lights) {
      const d = Math.hypot(l.x - px, l.z - pz);
      if (d < 16) L.push({ ...l, r: l.r * gk, g: l.g * gk, b: l.b * gk, d });
    }
    for (const f of game.fx) if (f.kind === 'burst' && f.t >= 0) {
      const a = 1 - f.t / f.life;
      const col = hexRgb(f.color);
      L.push({ x: f.x + 0.5, y: geo.heightAt(f.x + 0.5, f.y + 0.5) + 0.8, z: f.y + 0.5, r: col[0] * a * 1.4, g: col[1] * a * 1.4, b: col[2] * a * 1.4, rad: 4.5, d: -0.5 });
    }
    L.sort((a, b) => a.d - b.d);
    const nl = Math.min(L.length, q.lights, MAX_LIGHTS);
    const lpos = new Float32Array(MAX_LIGHTS * 4), lcol = new Float32Array(MAX_LIGHTS * 3);
    for (let i = 0; i < nl; i++) {
      const l = L[i]!;
      lpos.set([l.x, l.y, l.z, l.rad], i * 4);
      lcol.set([l.r, l.g, l.b], i * 3);
    }

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
    gl.uniform4f(P.u.uFlash!, 0, 0, 0, 0);
    gl.uniform4fv(P.u.uL!, lpos);
    gl.uniform3fv(P.u.uLC!, lcol);
    gl.uniform1i(P.u.uNL!, nl);
    const I = ident();
    gl.uniformMatrix4fv(P.u.uModel!, false, I);

    // Terreno e instancias.
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
    for (const c of visible) {
      if (!c.inst) continue;
      for (const g of c.groups) {
        const data = staticModel(g.id);
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
    this.noInstance();

    // Entidades.
    const ents = this.collect(game, geo);
    // Sombras blandas bajo las criaturas.
    this.drawShadows(ents);
    gl.useProgram(P.p);
    this.drawXray(ents[0], P);
    for (const e of ents) this.drawEnt(e, P);
    this.drawSignals(game, geo, ents, P, px, py, pz, opts.questGuide !== false);
    gl.uniformMatrix4fv(P.u.uModel!, false, I);

    // Agua (translúcida) y partículas.
    this.drawWater(visible, env, fogDen, dist * 0.8, lpos, lcol, nl);
    this.drawParticles(style, env, px, py, pz, q.particles);
    // Halos de luz (brillo suave de antorchas, faroles y fuego) y destellos de señalización.
    const hs = hexRgb('#ffffff');
    void hs;
    for (let i = 0; i < nl; i++) {
      const l = L[i]!;
      if (l.d < 0 && l.rad === 8) continue;
      this.spr.add(l.x, l.y, l.z, Math.min(2.4, 0.5 + l.rad * 0.18), Math.min(0.5, 0.18 + (l.r + l.g + l.b) * 0.1), Math.min(1, l.r), Math.min(1, l.g), Math.min(1, l.b));
    }
    this.spr.flush(this.vp, this.glCanvas.height * 1.218);

    this.drawOverlay(game, ents);
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
      if (Math.hypot(en.x - p.x, en.y - p.y) > PLAYER_SIGHT) continue;
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
      if (g.age !== undefined && g.age < 0) continue;
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

  private drawShadows(ents: Ent[]): void {
    const gl = this.gl;
    const P = this.progs.blob;
    gl.useProgram(P.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniformMatrix4fv(P.u.uVP!, false, this.vp);
    this.bindMesh(this.blob, false);
    this.noInstance();
    for (const e of ents) {
      const r = e.rig ? e.rig.shadow * e.scale : e.kind === 'loot' ? 0.18 : 0.38;
      const lift = e.kind === 'loot' ? 0.5 : e.rig?.flyer ? 0.4 : 1;
      gl.uniformMatrix4fv(P.u.uModel!, false, trs(e.gx, e.gy - (e.kind === 'loot' ? 0 : 0) + 0.015, e.gz, 0, r * 1.5));
      gl.uniform1f(P.u.uAlpha!, 0.55 * e.alpha * lift);
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

  private drawSky(env: Env, style: ZoneStyle): void {
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }

  private drawWater(visible: ChunkGpu[], env: Env, fogDen: number, fogOff: number, lpos: Float32Array, lcol: Float32Array, nl: number): void {
    const gl = this.gl;
    const P = this.progs.water;
    gl.useProgram(P.p);
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

  private drawParticles(style: ZoneStyle, env: Env, px: number, py: number, pz: number, count: number): void {
    if (style.particles === 'ninguna' || count <= 0) return;
    const gl = this.gl;
    const P = this.progs.part;
    gl.useProgram(P.p);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    const k = style.particles;
    const additive = k === 'polen' || k === 'motas' || k === 'esporas' || k === 'brasas';
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    const night = env.night;
    const cfg = {
      polen: { c: [1, 0.95, 0.7, 0.55 * (1 - night * 0.6)], v: [0.15, 0.1, 0.1], s: 7 },
      motas: { c: [0.8, 1, 0.5, 0.35 + night * 0.65], v: [0.1, 0.06, 0.1], s: 9 },
      nieve: { c: [1, 1, 1, 0.85], v: [0.5, -1.0, 0.3], s: 6 },
      polvo: { c: [0.9, 0.8, 0.6, 0.35], v: [1.4, 0.05, 0.4], s: 6 },
      esporas: { c: [0.6, 1, 0.55, 0.45 + night * 0.3], v: [0.05, 0.16, 0.05], s: 8 },
      brasas: { c: [1, 0.55, 0.2, 0.8], v: [0.1, 0.6, 0.1], s: 7 },
      ninguna: { c: [0, 0, 0, 0], v: [0, 0, 0], s: 0 },
    }[k];
    gl.uniformMatrix4fv(P.u.uVP!, false, this.vp);
    gl.uniform3f(P.u.uCenter!, px, py, pz);
    gl.uniform1f(P.u.uTime!, this.time);
    gl.uniform3f(P.u.uVel!, cfg.v[0]!, cfg.v[1]!, cfg.v[2]!);
    gl.uniform1f(P.u.uSize!, cfg.s);
    gl.uniform1f(P.u.uScale!, this.glCanvas.height / 540);
    gl.uniform1f(P.u.uGround!, py - 0.2);
    gl.uniform1f(P.u.uBox!, 22);
    gl.uniform1f(P.u.uBoxH!, k === 'nieve' ? 8 : 4.5);
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
