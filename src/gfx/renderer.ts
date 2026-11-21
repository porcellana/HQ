/**
 * RENDERIZADOR DEL MAPA
 * ---------------------
 * Pre-renderiza cada zona en un canvas fuera de pantalla (una sola vez) y
 * cada fotograma sólo copia la parte visible + dibuja entidades. Escala
 * entera para que el pixel art se vea nítido en cualquier pantalla.
 */
import { Camera } from '@/engine/camera';
import type { Point } from '@/engine/pathfinding';
import type { Game } from '@/game/game';
import type { Zone } from '@/game/world/zone';
import { TILE, ctx2d, makeCanvas } from './canvas';
import { PAL } from './palette';
import { DEFAULT_HERO_COLORS, humanoidSprite, type HumanoidColors } from './sprites';
import { getTileSprite, variantFor } from './tiles';

/** Casillas visibles aproximadas de ancho (en vertical). */
const TARGET_TILES_ACROSS = 12;

export interface RenderOptions {
  grid: boolean;
}

export class Renderer {
  readonly camera = new Camera();
  private readonly ctx: CanvasRenderingContext2D;
  private zoom = 3;
  /** devicePixelRatio efectivo (limitado a 3 por rendimiento). */
  pixelRatio = 1;
  private zoneCache: { zone: Zone; canvas: HTMLCanvasElement } | null = null;
  private time = 0;
  heroColors: HumanoidColors = DEFAULT_HERO_COLORS;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = ctx2d(canvas);
    this.resize();
  }

  /** Ajusta la resolución interna al tamaño CSS * devicePixelRatio. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.pixelRatio = dpr;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.imageSmoothingEnabled = false;
    const across = Math.min(w, h * 0.8);
    this.zoom = Math.max(1, Math.round(across / (TILE * TARGET_TILES_ACROSS)));
    this.camera.viewW = w / this.zoom;
    this.camera.viewH = h / this.zoom;
  }

  /** Altura (px de canvas) tapada arriba por el HUD y abajo por los botones. */
  setInsets(topPx: number, bottomPx: number): void {
    this.camera.insets = { top: topPx / this.zoom, bottom: bottomPx / this.zoom };
  }

  /** Convierte un punto del canvas (px internos) en casilla del mapa. */
  screenToTile(sx: number, sy: number): Point {
    return {
      x: Math.floor((sx / this.zoom + this.camera.x) / TILE),
      y: Math.floor((sy / this.zoom + this.camera.y) / TILE),
    };
  }

  /** Dibuja la zona entera en un canvas (se hace una vez por zona). */
  private getZoneCanvas(zone: Zone): HTMLCanvasElement {
    if (this.zoneCache?.zone === zone) return this.zoneCache.canvas;
    const canvas = makeCanvas(zone.width * TILE, zone.height * TILE);
    const c = ctx2d(canvas);
    for (let y = 0; y < zone.height; y++) {
      for (let x = 0; x < zone.width; x++) {
        const tile = zone.tileAt(x, y);
        if (tile) c.drawImage(getTileSprite(tile.sprite, variantFor(x, y)), x * TILE, y * TILE);
      }
    }
    this.zoneCache = { zone, canvas };
    return canvas;
  }

  render(game: Game, dt: number, opts: RenderOptions): void {
    this.time += dt;
    const { ctx, canvas, camera, zoom } = this;
    const zone = game.zone;
    const zc = this.getZoneCanvas(zone);
    const v = game.view;

    // Cámara centrada en el jugador (posición interpolada).
    camera.centerOn((v.rx + 0.5) * TILE, (v.ry + 0.5) * TILE, zone.width * TILE, zone.height * TILE);
    // Ajuste a píxel de pantalla para evitar costuras.
    const camX = Math.round(camera.x * zoom) / zoom;
    const camY = Math.round(camera.y * zoom) / zoom;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(zc, 0, 0);

    if (opts.grid) this.drawGrid(zone);
    this.drawExits(zone);
    this.drawPath(game);
    this.drawPlayer(game);
    this.drawDarkness(game, camX, camY);
  }

  private drawGrid(zone: Zone): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = 0; x <= zone.width; x++) ctx.fillRect(x * TILE, 0, 1 / this.zoom, zone.height * TILE);
    for (let y = 0; y <= zone.height; y++) ctx.fillRect(0, y * TILE, zone.width * TILE, 1 / this.zoom);
  }

  /** Brillo pulsante sobre las salidas para que se vean claramente. */
  private drawExits(zone: Zone): void {
    const { ctx } = this;
    const a = 0.25 + 0.2 * Math.sin(this.time * 3);
    ctx.fillStyle = `rgba(242,216,136,${a.toFixed(3)})`;
    for (const e of zone.exits) {
      ctx.fillRect(e.x * TILE + 2, e.y * TILE + 2, TILE - 4, TILE - 4);
    }
  }

  private drawPath(game: Game): void {
    const { ctx } = this;
    const v = game.view;
    ctx.fillStyle = 'rgba(242,216,136,0.55)';
    for (const p of v.path) ctx.fillRect(p.x * TILE + 7, p.y * TILE + 7, 2, 2);
    if (v.target) {
      const t = v.target;
      const s = 1 + Math.sin(this.time * 8) * 0.5;
      ctx.strokeStyle = PAL.goldL;
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x * TILE + 1.5 - s, t.y * TILE + 1.5 - s, TILE - 3 + s * 2, TILE - 3 + s * 2);
    }
  }

  private drawPlayer(game: Game): void {
    const { ctx } = this;
    const v = game.view;
    const x = v.rx * TILE;
    const y = v.ry * TILE;
    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 15, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pequeño salto al caminar
    const bob = v.stepT >= 0 ? -Math.round(Math.sin(v.stepT * Math.PI) * 1.5) : 0;
    const sprite = humanoidSprite(this.heroColors);
    ctx.drawImage(v.facing === 'right' ? sprite.right : sprite.left, Math.round(x), Math.round(y) + bob - 1);
  }

  /** Oscuridad ambiental con un halo de luz alrededor del jugador. */
  private drawDarkness(game: Game, camX: number, camY: number): void {
    const dark = game.zone.def.darkness ?? 0;
    if (dark <= 0) return;
    const { ctx, camera } = this;
    const v = game.view;
    const cx = (v.rx + 0.5) * TILE;
    const cy = (v.ry + 0.5) * TILE;
    const flicker = 1 + Math.sin(this.time * 7) * 0.02;
    const g = ctx.createRadialGradient(cx, cy, TILE * 1.5, cx, cy, TILE * 6 * flicker);
    g.addColorStop(0, 'rgba(11,10,16,0)');
    g.addColorStop(1, `rgba(11,10,16,${Math.min(0.95, dark * 2.4).toFixed(3)})`);
    ctx.fillStyle = `rgba(11,10,16,${dark.toFixed(3)})`;
    ctx.fillRect(camX, camY, camera.viewW, camera.viewH);
    ctx.fillStyle = g;
    ctx.fillRect(camX, camY, camera.viewW, camera.viewH);
  }
}
