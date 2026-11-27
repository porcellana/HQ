/**
 * RENDERIZADOR DEL MAPA
 * ---------------------
 * Pre-renderiza cada zona en un canvas fuera de pantalla (una sola vez) y
 * cada fotograma sólo copia la parte visible + dibuja entidades. Escala
 * entera para que el pixel art se vea nítido en cualquier pantalla.
 */
import { Camera } from '@/engine/camera';
import { clampStep, defaultZoom, stepLimits, tilesAcross, zoomForStep, zoomLevels } from '@/engine/zoom';
import type { Point } from '@/engine/pathfinding';
import { dangerLevel, dist } from '@/game/combat/rules';
import { STATUS_INFO } from '@/game/combat/status';
import type { Enemy } from '@/game/combat/entities';
import type { Game } from '@/game/game';
import { monsterSprite } from './monsters';
import { petSprite } from './pets';
import { PET_SPECIES } from '@/data/registry';
import { GOAL_ICON } from '@/game/quests/guide';
import { itemIcon } from './items';
import { itemDef, rarityOf } from '@/game/items/items';
import type { Zone } from '@/game/world/zone';
import { TILE, ctx2d, makeCanvas } from './canvas';
import { PAL } from './palette';
import { silhouette } from './silhouette';
import { DEFAULT_HERO_COLORS, humanoidSprite, type HumanoidColors } from './sprites';
import type { NpcDef } from '@/data/schema';
import { getTileSprite, variantFor } from './tiles';
import { buildVolume, EXTRUDE, type Volume } from './volume';

/**
 * Radio de visión del jugador (casillas) para ver enemigos. No cambia con el zoom:
 * alejar el mapa enseña más terreno, pero no delata criaturas lejanas.
 */
export const PLAYER_SIGHT = 10;

export interface RenderOptions {
  grid: boolean;
  /** Ciclo de día y noche en exteriores. */
  dayNight?: boolean;
  /** Volumen pseudo-3D (alturas, sombras, oclusión ambiental). Por defecto sí. */
  volume?: boolean;
  /** Guía de misión (flecha GPS). */
  questGuide?: boolean;
}

/**
 * Desplazamiento (px) de una embestida según `b` (el motor lo baja de 1,3 a 0):
 * entre 1,3 y 1 el actor RETROCEDE un poco (anticipación) y de 1 a 0 se lanza
 * hacia delante y vuelve.
 */
export function lungeOffset(b: number): number {
  if (b <= 0) return 0;
  if (b > 1) return -Math.sin(((b - 1) / 0.3) * Math.PI) * 2.2;
  return Math.sin(b * Math.PI) * 4.5;
}

/** Duración de un día completo en turnos. */
export const DAY_LENGTH_TURNS = 600;

/**
 * Oscuridad nocturna 0..1 según el turno: día claro, atardecer, noche y
 * amanecer (curva suave).
 */
export function nightAmount(turn: number): number {
  const t = (turn % DAY_LENGTH_TURNS) / DAY_LENGTH_TURNS; // 0 = amanecer
  // Día entre 0 y 0,55; noche alrededor de 0,8.
  const c = Math.cos((t - 0.8) * Math.PI * 2); // 1 en plena noche
  return Math.max(0, Math.min(1, (c - 0.2) / 0.8));
}

export class Renderer {
  readonly camera = new Camera();
  private readonly ctx: CanvasRenderingContext2D;
  /** Zoom efectivo de este fotograma = zoom del jugador (animado) × zoom de acción del combate. */
  private zoom = 3;
  /** Zoom del jugador, animado hacia `zoomTarget` (siempre entero al terminar la transición). */
  private zoomCur = 3;
  private zoomTarget = 3;
  /** Niveles enteros disponibles, nivel por defecto y paso elegido por el jugador (0 = por defecto). */
  private levels: number[] = [3];
  private defaultLevel = 3;
  private step = 0;
  /** Ancho de referencia (px) con el que se calculan los niveles. */
  private across = 0;
  /** Márgenes del HUD en px de pantalla (se convierten a mundo cada fotograma). */
  private insetPx = { top: 0, bottom: 0 };
  /** Cinemática de combate (temblor, zoom de acción, partículas…). */
  private vignetteCanvas: HTMLCanvasElement | null = null;
  /** devicePixelRatio efectivo (limitado a 3 por rendimiento). */
  pixelRatio = 1;
  private zoneCache: { zone: Zone; canvas: HTMLCanvasElement } | null = null;
  private volCache: { zone: Zone; vol: Volume } | null = null;
  /** Lienzo de pantalla para oscurecer la capa alta en zonas oscuras. */
  private scratch: HTMLCanvasElement | null = null;
  /** Volumen 3D activo en este fotograma. */
  private vol = true;
  private time = 0;
  /** Foco suavizado de la cámara (en casillas). */
  private camFX = 0;
  private camFY = 0;
  private camZone = '';
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
    this.across = across;
    this.levels = zoomLevels(across, TILE);
    this.defaultLevel = defaultZoom(across, TILE);
    this.step = clampStep(this.levels, this.defaultLevel, this.step);
    this.zoomTarget = zoomForStep(this.levels, this.defaultLevel, this.step);
    this.zoomCur = this.zoomTarget;
    this.zoom = this.zoomCur;
    this.camera.viewW = w / this.zoom;
    this.camera.viewH = h / this.zoom;
    this.vignetteCanvas = null;
  }

  // -------------------------------------------------------------- zoom del jugador
  /** Paso de zoom actual: 0 por defecto, +1 más cerca, −1 más lejos. */
  get zoomStep(): number {
    return this.step;
  }

  /** Pasos mínimo (más lejos) y máximo (más cerca) disponibles. */
  get zoomLimits(): { min: number; max: number } {
    return stepLimits(this.levels, this.defaultLevel);
  }

  /** Casillas de ancho visibles con el zoom actual del jugador. */
  get visibleTilesAcross(): number {
    return tilesAcross(this.across, this.zoomTarget, TILE);
  }

  /** Fija el paso de zoom (animado). Devuelve el paso efectivo tras limitarlo. */
  setZoomStep(step: number): number {
    this.step = clampStep(this.levels, this.defaultLevel, step);
    this.zoomTarget = zoomForStep(this.levels, this.defaultLevel, this.step);
    return this.step;
  }

  zoomBy(delta: number): number {
    return this.setZoomStep(this.step + delta);
  }

  resetZoom(): number {
    return this.setZoomStep(0);
  }

  /** Altura (px de canvas) tapada arriba por el HUD y abajo por los botones. */
  setInsets(topPx: number, bottomPx: number): void {
    // Se guardan en px de pantalla y se convierten a mundo en cada fotograma con el
    // zoom efectivo (que cambia con el zoom del jugador y el de acción).
    this.insetPx = { top: topPx, bottom: bottomPx };
    this.applyInsets();
  }

  private applyInsets(): void {
    // Margen extra de media casilla abajo: así el jugador y el compañero que
    // camina detrás nunca quedan medio tapados por la barra de habilidades.
    this.camera.insets = { top: this.insetPx.top / this.zoom, bottom: this.insetPx.bottom / this.zoom + TILE * 0.75 };
  }

  /** Convierte un punto del canvas (px internos) en casilla del mapa. */
  screenToTile(sx: number, sy: number): Point {
    return {
      x: Math.floor((sx / this.zoom + this.camera.x) / TILE),
      y: Math.floor((sy / this.zoom + this.camera.y) / TILE),
    };
  }

  /** Dibuja la zona entera en un canvas (se hace una vez por zona). */
  /** Imagen completa de la zona (16 px por casilla), para el mapa grande. */
  zoneImage(zone: Zone): HTMLCanvasElement {
    return this.getZoneCanvas(zone);
  }

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

  private getVolume(zone: Zone): Volume {
    if (this.volCache?.zone === zone) return this.volCache.vol;
    const vol = buildVolume(zone);
    this.volCache = { zone, vol };
    return vol;
  }

  render(game: Game, dt: number, opts: RenderOptions): void {
    this.time += dt;
    this.vol = opts.volume !== false;
    const { ctx, canvas, camera } = this;
    // Zoom del jugador (transición suave) × zoom de acción del combate.
    if (this.zoomCur !== this.zoomTarget) {
      this.zoomCur += (this.zoomTarget - this.zoomCur) * Math.min(1, dt * 9);
      if (Math.abs(this.zoomCur - this.zoomTarget) < 0.02) this.zoomCur = this.zoomTarget;
    }
    this.zoom = this.zoomCur;
    const zoom = this.zoom;
    camera.viewW = canvas.width / zoom;
    camera.viewH = canvas.height / zoom;
    this.applyInsets();
    const zone = game.zone;
    const vol = this.vol ? this.getVolume(zone) : null;
    const zc = vol ? vol.base : this.getZoneCanvas(zone);
    const v = game.view;

    // Cámara centrada en el jugador.
    const tx = v.rx;
    const ty = v.ry;
    if (this.camZone !== zone.id || Math.abs(this.camFX - tx) > 12 || Math.abs(this.camFY - ty) > 12) {
      this.camFX = tx;
      this.camFY = ty;
      this.camZone = zone.id;
    } else {
      const k = Math.min(1, dt * 5);
      this.camFX += (tx - this.camFX) * k;
      this.camFY += (ty - this.camFY) * k;
      // La cámara sigue al jugador sin retraso.
      this.camFX = tx;
      this.camFY = ty;
    }
    camera.centerOn((this.camFX + 0.5) * TILE, (this.camFY + 0.5) * TILE, zone.width * TILE, zone.height * TILE);
    // Ajuste a píxel de pantalla para evitar costuras.
    const camX = Math.round(camera.x * zoom) / zoom;
    const camY = Math.round(camera.y * zoom) / zoom;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(zc, 0, 0);
    if (vol) this.drawWater(vol, camX, camY);

    if (opts.grid) this.drawGrid(zone);
    this.drawExits(zone);
    this.drawPath(game);
    this.drawDarkness(game, camX, camY, opts.dayNight ?? false);
    this.drawFeatures(game);
    this.drawLoot(game);
    this.drawEntities(game, vol, camX, camY, opts.dayNight ?? false);
    this.drawFx(game);
    this.drawFog(game, camX, camY);
    if (vol) this.drawLightGrade();
    this.drawVignette(vol ? 0.4 : 0);
    this.drawExitPointers(game, camX, camY, opts.questGuide ?? true);
    if (opts.questGuide ?? true) this.drawQuestGuide(game, camX, camY);
  }

  /**
   * GUÍA DE MISIÓN (GPS): si el punto del objetivo se ve, marcador flotante
   * encima; si no, flecha grande en el borde con icono y distancia.
   */
  private drawQuestGuide(game: Game, camX: number, camY: number): void {
    const goal = game.questGoal;
    if (!goal?.point || game.inCombat) return;
    const { ctx, canvas, zoom, camera } = this;
    const dpr = this.pixelRatio;
    const icon = GOAL_ICON[goal.kind];
    const pt = goal.point;
    const p = game.playerPos;
    const distTiles = Math.max(Math.abs(pt.x - p.x), Math.abs(pt.y - p.y)); // sólo para ocultar el marcador al llegar
    const sx = ((pt.x + 0.5) * TILE - camX) * zoom;
    const sy = ((pt.y + 0.5) * TILE - camY) * zoom;
    const top = camera.insets.top * zoom + 34 * dpr;
    const bottom = canvas.height - camera.insets.bottom * zoom - 30 * dpr;
    const left = 34 * dpr;
    const right = canvas.width - 34 * dpr;
    const t = this.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const green = '#a8f08a';
    if (sx >= left && sx <= right && sy >= top && sy <= bottom) {
      if (distTiles <= 1) return; // ya estás encima
      // Marcador: rombo flotante con icono sobre el objetivo y halo en el suelo.
      const float = Math.sin(t * 3) * 5 * dpr;
      const my = sy - TILE * zoom * 0.95 + float;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4);
      ctx.strokeStyle = green;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.ellipse(sx, sy + TILE * zoom * 0.35, TILE * zoom * 0.45, TILE * zoom * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      this.guideBadge(sx, my, icon, null, dpr, 'down');
      return;
    }
    // Brújula pequeña en el borde: círculo con el icono y una punta que señala
    // hacia el objetivo (sin números, más discreta).
    const cx = canvas.width / 2;
    const cy = (top + bottom) / 2;
    const dx = sx - cx;
    const dy = sy - cy;
    const k = Math.min(Math.abs((dx > 0 ? right - cx : left - cx) / (dx || 1e-6)), Math.abs((dy > 0 ? bottom - cy : top - cy) / (dy || 1e-6)));
    const ang = Math.atan2(dy, dx);
    const bob = Math.sin(t * 3) * 2.5 * dpr;
    const px = cx + dx * k - Math.cos(ang) * (8 * dpr - bob);
    const py = cy + dy * k - Math.sin(ang) * (8 * dpr - bob);
    this.guideCompass(px, py, ang, icon, dpr);
  }

  /** Insignia redonda con icono y una punta de flecha apuntando en `ang`. */
  private guideCompass(x: number, y: number, ang: number, icon: string, dpr: number): void {
    const { ctx } = this;
    const r = 12 * dpr;
    const glow = 0.55 + 0.25 * Math.sin(this.time * 4);
    ctx.save();
    ctx.translate(x, y);
    // Punta
    ctx.save();
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(r + 9 * dpr, 0);
    ctx.lineTo(r * 0.55, -r * 0.62);
    ctx.lineTo(r * 0.55, r * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#c8f0a0';
    ctx.strokeStyle = '#0b0a10';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    // Halo suave
    ctx.globalAlpha = glow * 0.5;
    ctx.fillStyle = '#a8f08a';
    ctx.beginPath();
    ctx.arc(0, 0, r + 4 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Disco
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, '#2e5a2a');
    g.addColorStop(1, '#122612');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#c8f0a0';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.round(13 * dpr)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(icon, 0, 1 * dpr);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  /** Círculo con icono (y distancia) para la guía. */
  private guideBadge(x: number, y: number, icon: string, distText: string | null, dpr: number, pointer: 'down' | null): void {
    const { ctx } = this;
    const r = 12 * dpr;
    ctx.save();
    ctx.shadowColor = '#a8f08a';
    ctx.shadowBlur = 10 * dpr;
    ctx.fillStyle = 'rgba(16,30,16,0.92)';
    ctx.strokeStyle = '#a8f08a';
    ctx.lineWidth = 2.5 * dpr;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (pointer === 'down') {
      ctx.moveTo(x - r * 0.5, y + r * 0.85);
      ctx.lineTo(x, y + r * 1.6);
      ctx.lineTo(x + r * 0.5, y + r * 0.85);
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(13 * dpr)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(icon, x, y + 1 * dpr);
    if (distText) {
      ctx.font = `bold ${Math.round(11 * dpr)}px sans-serif`;
      const w = ctx.measureText(distText).width + 8 * dpr;
      ctx.fillStyle = '#0b0a10';
      ctx.fillRect(x - w / 2, y + r - 2 * dpr, w, 14 * dpr);
      ctx.fillStyle = '#a8f08a';
      ctx.fillText(distText, x, y + r + 5 * dpr);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  /**
   * Rótulos con el destino sobre las salidas cercanas que se ven en pantalla.
   * (Ya no hay flechas de borde hacia las salidas: demasiadas flechas. La única
   * flecha es la brújula de la guía de misión.)
   */
  private drawExitPointers(game: Game, camX: number, camY: number, guide: boolean): void {
    const { ctx, canvas, zoom, camera } = this;
    const dpr = this.pixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const top = camera.insets.top * zoom + 30 * dpr;
    const bottom = canvas.height - camera.insets.bottom * zoom - 20 * dpr;
    const left = 26 * dpr;
    const right = canvas.width - 26 * dpr;
    const seen = new Set<string>();
    const fontPx = Math.round(13 * dpr);
    ctx.font = `bold ${fontPx}px Georgia, serif`;
    ctx.textAlign = 'center';
    // La salida hacia el objetivo de la misión seguida se destaca en verde con ★.
    const goalTo = guide ? (game.questGoal?.exitTo ?? null) : null;
    for (const e of game.zone.exits) {
      if (seen.has(e.digit)) continue;
      seen.add(e.digit);
      const isGoal = goalTo !== null && e.to === goalTo;
      const color = isGoal ? '#a8f08a' : PAL.goldL;
      const marks = game.zone.exitMarkers.get(e.digit) ?? [{ x: e.x, y: e.y }];
      const mx = marks.reduce((a, m) => a + m.x, 0) / marks.length;
      const my = marks.reduce((a, m) => a + m.y, 0) / marks.length;
      const sx = ((mx + 0.5) * TILE - camX) * zoom;
      const sy = ((my + 0.5) * TILE - camY) * zoom;
      const label = isGoal ? `★ ${e.label ?? e.to}` : (e.label ?? e.to);
      const pulse = (0.75 + 0.25 * Math.sin(this.time * 4)) * (goalTo && !isGoal ? 0.7 : 1);
      if (sx >= left && sx <= right && sy >= top && sy <= bottom) {
        // En combate no se rotulan las salidas visibles: taparían a los enemigos.
        // Para no llenar la pantalla de letreros, sólo se rotulan las cercanas
        // (las puertas de edificios, sólo al tenerlas encima).
        const p = game.playerPos;
        const near = Math.max(Math.abs(mx - p.x), Math.abs(my - p.y)) <= (e.door ? 3 : 9);
        if (!game.inCombat && near) this.labelAt(label, sx, sy - TILE * zoom * 0.8, fontPx, pulse, color);
      }
      // Sin flechas de borde para las salidas: la única flecha del mapa es la brújula
      // de la guía de misión (drawQuestGuide). Las salidas se ven en el minimapa y en el mapa grande.
    }
    ctx.globalAlpha = 1;
  }

  private labelAt(text: string, x: number, y: number, fontPx: number, alpha: number, color: string = PAL.goldL): void {
    const { ctx } = this;
    const w = ctx.measureText(text).width + fontPx;
    ctx.globalAlpha = 0.85 * alpha;
    ctx.fillStyle = 'rgba(11,10,16,0.85)';
    ctx.fillRect(x - w / 2, y - fontPx, w, fontPx * 1.4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }

  /**
   * Casillas a las que puedes moverte en tu turno de combate (azul) con el
   * movimiento que te queda. Se cachean por posición y movimiento.
   */


  /** Cofres, vetas de mineral y trampas descubiertas. */
  private drawFeatures(game: Game): void {
    const { ctx } = this;
    for (const f of game.featureSprites()) {
      if (f.dim) ctx.globalAlpha = 0.45;
      ctx.drawImage(getTileSprite(f.sprite, 0), f.x * TILE, f.y * TILE);
      ctx.globalAlpha = 1;
    }
  }

  /** Botín en el suelo: saco (o el icono del objeto) con brillo del color de la rareza. */
  private drawLoot(game: Game): void {
    const { ctx } = this;
    for (const g of game.ground) {
      const best = g.items.reduce<{ color: string; rank: number } | null>((acc, it) => {
        const r = rarityOf(it);
        const rank = ['comun', 'poco_comun', 'raro', 'epico', 'legendario'].indexOf(r.id);
        return !acc || rank > acc.rank ? { color: r.color, rank } : acc;
      }, null);
      // Aún no se ha revelado el golpe que lo soltó.
      if (g.age !== undefined && g.age < 0) continue;
      // Salto con arco al caer (0,55 s) y luego flotación suave.
      const age = g.age ?? 99;
      const hop = age < 0.55 ? Math.sin((age / 0.55) * Math.PI) * 9 * (1 - age / 0.55 * 0.4) : 0;
      const bob = Math.sin(this.time * 3 + g.x) * 0.8 - hop;
      if (best && best.rank >= 1) {
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.time * 4);
        ctx.fillStyle = best.color;
        ctx.beginPath();
        ctx.arc(g.x * TILE + 8, g.y * TILE + 9, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const icon = g.items.length === 1 ? itemDef(g.items[0]!).icon : { shape: g.items.length ? 'saco' : 'anillo', color: '#f2d888' };
      const img = g.items.length === 0 && g.gold > 0 ? itemIcon({ shape: 'saco', color: '#f2d888' }) : itemIcon(icon);
      ctx.drawImage(img, g.x * TILE, Math.round(g.y * TILE + bob));
    }
  }

  /**
   * Entidades ordenadas por fila. Con volumen, la capa alta (muros, árboles…) se dibuja por
   * franjas de fila intercaladas: lo alto tapa a lo que tiene detrás y deja pasar a lo de delante.
   */
  private drawEntities(game: Game, vol: Volume | null, camX: number, camY: number, dayNight: boolean): void {
    const list: Array<{ y: number; draw: () => void }> = game.enemies.map((e) => ({ y: e.ry, draw: () => this.drawEnemy(game, e) }));
    for (const n of game.npcs) list.push({ y: n.y, draw: () => this.drawNpc(game, n) });
    list.push({ y: game.view.ry, draw: () => this.drawPlayer(game) });
    const ally = game.ally;
    if (ally) list.push({ y: ally.ry, draw: () => this.drawAlly(game) });
    const pu = game.pet;
    if (pu) list.push({ y: pu.ry, draw: () => this.drawPet(game) });
    list.sort((a, b) => a.y - b.y);
    if (!vol) {
      for (const it of list) it.draw();
      return;
    }
    const { ctx, camera, zoom, canvas } = this;
    const zone = game.zone;
    const x0 = Math.max(0, Math.floor(camX) - 2);
    const x1 = Math.min(zone.width * TILE, Math.ceil(camX + camera.viewW) + 2);
    const r0 = Math.max(0, Math.floor((camY - 2) / TILE));
    const r1 = Math.min(zone.height - 1, Math.ceil((camY + camera.viewH + EXTRUDE) / TILE));
    // En zonas oscuras la capa alta se oscurece en un lienzo aparte (como el suelo) y se copia por franjas.
    const kind = zone.def.kind;
    const outdoor = kind === 'town' || kind === 'wild' || kind === 'world';
    const night = dayNight && outdoor ? nightAmount(game.state.turn) : 0;
    const dark = Math.max(zone.def.darkness ?? 0, night * 0.33) > 0 || night > 0;
    let scratch: HTMLCanvasElement | null = null;
    if (dark) {
      if (!this.scratch || this.scratch.width !== canvas.width || this.scratch.height !== canvas.height) this.scratch = makeCanvas(canvas.width, canvas.height);
      scratch = this.scratch;
      const sc = scratch.getContext('2d')!;
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.clearRect(0, 0, scratch.width, scratch.height);
      sc.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);
      sc.imageSmoothingEnabled = false;
      sc.drawImage(vol.tall, x0, Math.max(0, camY - EXTRUDE), x1 - x0, camera.viewH + EXTRUDE + TILE, x0, Math.max(0, camY - EXTRUDE), x1 - x0, camera.viewH + EXTRUDE + TILE);
      sc.globalCompositeOperation = 'source-atop';
      this.drawDarkness(game, camX, camY, dayNight, sc);
      sc.globalCompositeOperation = 'source-over';
    }
    const strip = (r: number): void => {
      const sy = Math.max(0, r * TILE - EXTRUDE);
      const sh = r * TILE + TILE - sy;
      if (!scratch) {
        ctx.drawImage(vol.tall, x0, sy, x1 - x0, sh, x0, sy, x1 - x0, sh);
        return;
      }
      const ex0 = Math.round((x0 - camX) * zoom), ex1 = Math.round((x1 - camX) * zoom);
      const ey0 = Math.round((sy - camY) * zoom), ey1 = Math.round((sy + sh - camY) * zoom);
      if (ex1 <= ex0 || ey1 <= ey0) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(scratch, ex0, ey0, ex1 - ex0, ey1 - ey0, ex0, ey0, ex1 - ex0, ey1 - ey0);
      ctx.restore();
    };
    let i = 0;
    for (let r = r0; r <= r1; r++) {
      strip(r);
      while (i < list.length && Math.floor(list[i]!.y + 0.5) <= r) list[i++]!.draw();
    }
    while (i < list.length) list[i++]!.draw();
  }

  /** Brillo y ondas ligeras en el agua visible (sin sombras difuminadas por fotograma). */
  private drawWater(vol: Volume, camX: number, camY: number): void {
    const { ctx, camera } = this;
    const W = this.volCache!.zone.width;
    const t = this.time;
    const cx0 = Math.floor(camX / TILE) - 1, cx1 = Math.ceil((camX + camera.viewW) / TILE) + 1;
    const cy0 = Math.floor(camY / TILE) - 1, cy1 = Math.ceil((camY + camera.viewH) / TILE) + 1;
    for (let n = 0; n < vol.water.length; n++) {
      const idx = vol.water[n]!;
      const x = idx % W, y = (idx - x) / W;
      if (x < cx0 || x > cx1 || y < cy0 || y > cy1) continue;
      const h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
      const ph = t * 1.1 + (h % 628) / 100;
      const wave = Math.sin(ph);
      ctx.fillStyle = `rgba(210,240,255,${(0.1 + 0.12 * (wave * 0.5 + 0.5)).toFixed(3)})`;
      ctx.fillRect(x * TILE + 2 + Math.round(wave * 2) + (h % 5), y * TILE + 3 + (h % 7), 5, 1);
      ctx.fillStyle = `rgba(10,30,60,${(0.1 + 0.08 * (1 - wave * 0.5 - 0.5)).toFixed(3)})`;
      ctx.fillRect(x * TILE + 6 + ((h >> 4) % 6) - Math.round(wave * 2), y * TILE + 11 - ((h >> 8) % 4), 4, 1);
      if (Math.sin(ph * 1.7 + 2) > 0.93) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(x * TILE + 3 + (h % 9), y * TILE + 2 + ((h >> 3) % 10), 1, 1);
      }
    }
  }

  /** Degradado vertical de luz: algo más claro arriba y más sombrío abajo. */
  private drawLightGrade(): void {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, 'rgba(255,240,205,0.07)');
    g.addColorStop(0.5, 'rgba(255,240,205,0)');
    g.addColorStop(1, 'rgba(8,10,36,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /** Sombra suave bajo un personaje, proyectada hacia abajo-derecha (dos elipses, sin desenfoque). */
  private shadow(cx: number, cy: number, rx: number, ry: number): void {
    const { ctx } = this;
    if (!this.vol) {
      this.shadow(cx, cy, rx, ry);
      return;
    }
    ctx.fillStyle = 'rgba(8,6,20,0.13)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy, rx + 2, ry + 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(8,6,20,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx + 1.2, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Compañero: sprite humanoide con barra de vida verde (gris si está caído). */
  private drawAlly(game: Game): void {
    const a = game.ally;
    if (!a) return;
    const { ctx } = this;
    a.bumpT = Math.max(0, a.bumpT - 0.08);
    a.flashT = Math.max(0, a.flashT - 0.06);
    const bump = lungeOffset(a.bumpT);
    const x = a.rx * TILE + a.bumpDx * bump;
    const y = a.ry * TILE + a.bumpDy * bump;
    const l = a.def.look;
    const spr = humanoidSprite({
      hair: l.hair ?? PAL.hair, skin: l.skin ?? PAL.skin, cloth: l.cloth, clothDark: l.clothDark, pants: l.pants,
      ...(l.hat ? { hat: l.hat } : {}), ...(l.overlay ? { overlay: l.overlay } : {}),
    });
    const down = game.state.party.down;
    this.shadow(x + 8, y + 15, 5, 2);
    ctx.globalAlpha = down ? 0.4 : 1;
    ctx.drawImage(a.facing === 'right' ? spr.right : spr.left, Math.round(x), Math.round(y) - 1);
    ctx.globalAlpha = 1;
    if (a.flashT > 0) {
      ctx.fillStyle = `rgba(255,80,60,${(a.flashT * 0.4).toFixed(2)})`;
      ctx.fillRect(Math.round(x) + 3, Math.round(y), 10, 15);
    }
    const max = game.allyStats().maxHp;
    const hp = down ? 0 : game.state.party.hp;
    ctx.fillStyle = '#000';
    ctx.fillRect(Math.round(x) + 1.5, Math.round(y) - 3.5, 13, 2.5);
    ctx.fillStyle = '#5ad05a';
    ctx.fillRect(Math.round(x) + 2, Math.round(y) - 3, (12 * hp) / Math.max(1, max), 1.5);
  }

  /** Mascota: su sprite con barra de vida azul (transparente si está debilitada). */
  private drawPet(game: Game): void {
    const u = game.pet;
    const pi = game.petInstance;
    if (!u || !pi) return;
    const sp = PET_SPECIES.get(pi.species);
    if (!sp) return;
    const { ctx } = this;
    u.bumpT = Math.max(0, u.bumpT - 0.08);
    u.flashT = Math.max(0, u.flashT - 0.06);
    const bump = lungeOffset(u.bumpT);
    const hop = pi.down ? 0 : Math.abs(Math.sin(this.time * 4 + u.x)) * 0.8;
    const x = u.rx * TILE + u.bumpDx * bump;
    const y = u.ry * TILE + u.bumpDy * bump - hop;
    this.shadow(u.rx * TILE + 8, u.ry * TILE + 15, 4.5, 1.8);
    const spr = petSprite(sp.look, sp.stage);
    ctx.globalAlpha = pi.down ? 0.4 : 1;
    ctx.drawImage(u.facing === 'right' ? spr.right : spr.left, Math.round(x), Math.round(y));
    ctx.globalAlpha = 1;
    if (u.flashT > 0) {
      ctx.fillStyle = `rgba(255,80,60,${(u.flashT * 0.4).toFixed(2)})`;
      ctx.fillRect(Math.round(x) + 3, Math.round(y) + 4, 10, 11);
    }
  }

  private drawNpc(game: Game, n: NpcDef): void {
    const { ctx } = this;
    const x = n.x * TILE;
    const y = n.y * TILE;
    this.shadow(x + 8, y + 15, 5, 2);
    const l = n.look;
    const spr = humanoidSprite({
      hair: l.hair ?? PAL.hair, skin: l.skin ?? PAL.skin, cloth: l.cloth, clothDark: l.clothDark, pants: l.pants,
      ...(l.hat ? { hat: l.hat } : {}), ...(l.overlay ? { overlay: l.overlay } : {}),
    });
    // Respiración: sube y baja un píxel de vez en cuando.
    const breathe = Math.sin(this.time * 2 + n.x * 1.7) > 0.6 ? -1 : 0;
    ctx.drawImage(n.facingLeft ? spr.left : spr.right, x, y - 1 + breathe);
    const mark = game.npcMarker(n.id);
    if (mark) {
      const bob = Math.sin(this.time * 4) * 1.5;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = PAL.black;
      ctx.strokeText(mark, x + 8, y - 3 + bob);
      ctx.fillStyle = mark === '?' ? '#7fe07f' : PAL.goldL;
      ctx.fillText(mark, x + 8, y - 3 + bob);
    }
  }

  private drawEnemy(game: Game, e: Enemy): void {
    const { ctx } = this;
    const p = game.playerPos;
    // Fuera de la vista del jugador y lejos: no se dibuja. El radio de visión NO depende del
    // zoom: alejar el mapa no delata enemigos (los que te persiguen se ven a su alcance + 2).
    const dd = dist(e.x, e.y, p.x, p.y);
    if (dd > PLAYER_SIGHT) return;
    const bump = lungeOffset(e.bumpT);
    const x = e.rx * TILE + e.bumpDx * bump;
    const y = e.ry * TILE + e.bumpDy * bump;
    if (e.def.boss) {
      const pulse = 7 + Math.sin(this.time * 4) * 1.5;
      ctx.fillStyle = 'rgba(160,40,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(x + 8, y + 13, pulse, pulse / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    this.shadow(x + 8, y + 15, 5, 2);
    const wild = e.def.pet ? PET_SPECIES.get(e.def.pet.species) : undefined;
    const spr = wild ? petSprite(wild.look, wild.stage) : monsterSprite(e.def.look);
    const img = e.facing === 'right' ? spr.right : spr.left;
    ctx.drawImage(img, Math.round(x), Math.round(y) - 1);
    if (e.flashT > 0) {
      ctx.globalAlpha = e.flashT;
      ctx.drawImage(silhouette(img), Math.round(x), Math.round(y) - 1);
      ctx.globalAlpha = 1;
    }
    // Criatura salvaje: huella flotante y etiqueta «salvaje» para reconocerla.
    if (wild) {
      const bob = Math.sin(this.time * 3 + e.uid) * 1.2;
      ctx.font = '6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐾', Math.round(x) + 8, Math.round(y) - 6 + bob);
      ctx.font = 'bold 3.5px sans-serif';
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      ctx.strokeText('salvaje', Math.round(x) + 8, Math.round(y) + 19);
      ctx.fillStyle = '#c8a0ff';
      ctx.fillText('salvaje', Math.round(x) + 8, Math.round(y) + 19);
    }
    // Nivel de peligro sobre la cabeza.
    {
      const bx = Math.round(x) + 2;
      const by = Math.round(y) - 3;
      const danger = dangerLevel(e.def.level, game.state.player.level);
      const col = { trivial: '#8a8a8a', facil: '#80c080', normal: '#ece6d6', dificil: '#f0a040', mortal: '#ff4040' }[danger];
      ctx.font = 'bold 4px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      const label = `${danger === 'mortal' ? '☠' : ''}${e.def.level}`;
      ctx.strokeText(label, bx + 6, by + 1);
      ctx.fillStyle = col;
      ctx.fillText(label, bx + 6, by + 1);
    }
    // Estados: tinte suave del sprite e iconos pulsantes sobre la cabeza.
    if (e.statuses.length) this.drawStatusMarks(e.statuses.map((s) => s.id), Math.round(x), Math.round(y), img);
  }

  /** Tinte suave y pequeños iconos pulsantes de los estados alterados. */
  private drawStatusMarks(ids: Array<keyof typeof STATUS_INFO>, x: number, y: number, img: HTMLCanvasElement): void {
    if (!ids.length) return;
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
    ctx.globalAlpha = 0.14 + 0.1 * pulse;
    ctx.drawImage(silhouette(img, STATUS_INFO[ids[0]!].color), x, y - 1);
    ctx.globalAlpha = 1;
    ctx.font = '5px sans-serif';
    ctx.textAlign = 'center';
    ids.slice(0, 3).forEach((id, i) => {
      const sx = x + 8 + (i - (Math.min(ids.length, 3) - 1) / 2) * 6;
      ctx.globalAlpha = 0.75 + 0.25 * pulse;
      ctx.fillText(STATUS_INFO[id].icon, sx, y - 5 - pulse * 1.2);
    });
    ctx.globalAlpha = 1;
  }

  private drawFx(game: Game): void {
    const { ctx } = this;
    for (const f of game.fx) {
      if (f.t < 0) continue; // aún no se ha revelado (la tarjeta de duelo está rodando el dado)
      const k = f.t / f.life;
      if (f.kind === 'text') {
        const x = f.x * TILE + 8;
        const y = f.y * TILE + 2 - k * 10;
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        // Números de daño grandes; textos largos algo más pequeños; XP y oro pequeños (`size`).
        ctx.font = `bold ${f.size ?? (/^[-+¡]?\d/.test(f.text) ? 10 : 7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.strokeText(f.text, x, y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, x, y);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'bolt') {
        const sx = f.fx * TILE + 8, sy = f.fy * TILE + 8, tx = f.tx * TILE + 8, ty = f.ty * TILE + 8;
        const px = sx + (tx - sx) * k, py = sy + (ty - sy) * k;
        ctx.strokeStyle = f.color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx + (tx - sx) * Math.max(0, k - 0.35), sy + (ty - sy) * Math.max(0, k - 0.35));
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = f.color;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x * TILE + 8, f.y * TILE + 8, Math.max(0.1, f.radius * TILE * (0.3 + 0.7 * k)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = f.color;
        ctx.globalAlpha = (1 - k) * 0.25;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
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
    this.shadow(x + 8, y + 15, 5, 2);
    // Pequeño salto al caminar
    const bob = v.stepT >= 0 ? -Math.round(Math.sin(v.stepT * Math.PI) * 1.5) : 0;
    const bump = lungeOffset(v.bumpT);
    const sx = Math.round(x + v.bumpDx * bump);
    const sy = Math.round(y + v.bumpDy * bump) + bob - 1;
    const sprite = humanoidSprite(this.heroColors);
    const img = v.facing === 'right' ? sprite.right : sprite.left;
    ctx.drawImage(img, sx, sy);
    ctx.globalAlpha = 1;
    if (v.flashT > 0) {
      ctx.globalAlpha = v.flashT * 0.8;
      ctx.drawImage(silhouette(img, '#ff3030'), sx, sy);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Con el mapa muy alejado, un velo suave más allá del radio de visión explica
   * por qué no se ven criaturas lejanas (y mantiene el reto).
   */
  private drawFog(game: Game, camX: number, camY: number): void {
    if (this.zoomTarget >= this.defaultLevel && this.step >= 0) return;
    const { ctx, camera } = this;
    const v = game.view;
    const cx = (v.rx + 0.5) * TILE;
    const cy = (v.ry + 0.5) * TILE;
    const g = ctx.createRadialGradient(cx, cy, TILE * (PLAYER_SIGHT - 1), cx, cy, TILE * (PLAYER_SIGHT + 5));
    g.addColorStop(0, 'rgba(11,10,16,0)');
    g.addColorStop(1, 'rgba(11,10,16,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(camX, camY, camera.viewW, camera.viewH);
  }

  /** Viñeta oscura en los bordes durante el combate (atmósfera). */
  private drawVignette(alpha: number): void {
    if (alpha <= 0.01) return;
    const { ctx, canvas } = this;
    if (!this.vignetteCanvas || this.vignetteCanvas.width !== canvas.width || this.vignetteCanvas.height !== canvas.height) {
      const c = makeCanvas(canvas.width, canvas.height);
      const x = c.getContext('2d')!;
      const r = Math.hypot(canvas.width, canvas.height) / 2;
      const g = x.createRadialGradient(canvas.width / 2, canvas.height / 2, r * 0.45, canvas.width / 2, canvas.height / 2, r);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(8,4,12,0.6)');
      x.fillStyle = g;
      x.fillRect(0, 0, canvas.width, canvas.height);
      this.vignetteCanvas = c;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(this.vignetteCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  /** Oscuridad ambiental con un halo de luz alrededor del jugador. */
  private drawDarkness(game: Game, camX: number, camY: number, dayNight: boolean, target?: CanvasRenderingContext2D): void {
    const { camera } = this;
    const ctx = target ?? this.ctx;
    const kind = game.zone.def.kind;
    const tint = game.zone.def.tint;
    if (tint) {
      // Tinte del bioma (zonas generadas).
      ctx.globalAlpha = tint.alpha;
      ctx.fillStyle = tint.color;
      ctx.fillRect(camX, camY, camera.viewW, camera.viewH);
      ctx.globalAlpha = 1;
    }
    const outdoor = kind === 'town' || kind === 'wild' || kind === 'world';
    const night = dayNight && outdoor ? nightAmount(game.state.turn) : 0;
    if (night > 0) {
      // Tinte azulado nocturno (sólo exteriores).
      ctx.fillStyle = `rgba(20,30,80,${(night * 0.22).toFixed(3)})`;
      ctx.fillRect(camX, camY, camera.viewW, camera.viewH);
    }
    const dark = Math.max(game.zone.def.darkness ?? 0, night * 0.33);
    if (dark <= 0) return;
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
