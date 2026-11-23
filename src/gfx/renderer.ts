/**
 * RENDERIZADOR DEL MAPA
 * ---------------------
 * Pre-renderiza cada zona en un canvas fuera de pantalla (una sola vez) y
 * cada fotograma sólo copia la parte visible + dibuja entidades. Escala
 * entera para que el pixel art se vea nítido en cualquier pantalla.
 */
import { Camera } from '@/engine/camera';
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
import { DEFAULT_HERO_COLORS, humanoidSprite, type HumanoidColors } from './sprites';
import type { NpcDef } from '@/data/schema';
import { getTileSprite, variantFor } from './tiles';

/** Casillas visibles aproximadas de ancho (en vertical). */
const TARGET_TILES_ACROSS = 12;

export interface RenderOptions {
  grid: boolean;
  /** Ciclo de día y noche en exteriores. */
  dayNight?: boolean;
  /** Guía de misión (flecha GPS). */
  questGuide?: boolean;
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
    // Margen extra de media casilla abajo: así el jugador y el compañero que
    // camina detrás nunca quedan medio tapados por la barra de habilidades.
    this.camera.insets = { top: topPx / this.zoom, bottom: bottomPx / this.zoom + TILE * 0.75 };
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
    this.drawTargeting(game);
    this.drawExits(zone);
    this.drawPath(game);
    this.drawDarkness(game, camX, camY, opts.dayNight ?? false);
    this.drawFeatures(game);
    this.drawHazards(game);
    this.drawLoot(game);
    this.drawEntities(game);
    this.drawFx(game);
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
   * Flechas doradas en el borde de la pantalla que señalan las salidas fuera de
   * la vista, y etiqueta con el destino sobre las salidas visibles.
   */
  private drawExitPointers(game: Game, camX: number, camY: number, guide: boolean): void {
    const { ctx, canvas, zoom, camera } = this;
    const dpr = this.pixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const top = camera.insets.top * zoom + 30 * dpr;
    const bottom = canvas.height - camera.insets.bottom * zoom - 20 * dpr;
    const left = 26 * dpr;
    const right = canvas.width - 26 * dpr;
    const cx = canvas.width / 2;
    const cy = (top + bottom) / 2;
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
        if (!game.inCombat) this.labelAt(label, sx, sy - TILE * zoom * 0.8, fontPx, pulse, color);
        continue;
      }
      // La guía GPS ya dibuja su propia flecha hacia esta salida.
      if (isGoal && game.questGoal?.point && !game.inCombat) continue;
      // Las puertas de edificios sólo se rotulan cuando se ven (salvo la del objetivo).
      if (e.door && !isGoal) continue;
      // Punto del borde en dirección a la salida
      const dx = sx - cx;
      const dy = sy - cy;
      const k = Math.min(Math.abs((dx > 0 ? right - cx : left - cx) / (dx || 1e-6)), Math.abs((dy > 0 ? bottom - cy : top - cy) / (dy || 1e-6)));
      const px = cx + dx * k;
      const py = cy + dy * k;
      const ang = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = color;
      ctx.strokeStyle = PAL.black;
      ctx.lineWidth = 2 * dpr;
      const a = (isGoal ? 18 : 14) * dpr;
      ctx.beginPath();
      ctx.moveTo(a, 0);
      ctx.lineTo(-a * 0.7, -a * 0.75);
      ctx.lineTo(-a * 0.35, 0);
      ctx.lineTo(-a * 0.7, a * 0.75);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      // Etiqueta hacia dentro de la pantalla
      const lx = Math.max(left + 50 * dpr, Math.min(right - 50 * dpr, px - Math.cos(ang) * 40 * dpr));
      const ly = Math.max(top + 8 * dpr, Math.min(bottom - 4 * dpr, py - Math.sin(ang) * 28 * dpr));
      this.labelAt(label, lx, ly, fontPx, pulse, color);
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

  /** Casillas al alcance de la habilidad elegida. */
  private drawTargeting(game: Game): void {
    const sk = game.targeting;
    if (!sk) return;
    const { ctx } = this;
    const p = game.playerPos;
    const r = Math.max(1, sk.range);
    const a = 0.18 + 0.08 * Math.sin(this.time * 5);
    for (let y = p.y - r; y <= p.y + r; y++) {
      for (let x = p.x - r; x <= p.x + r; x++) {
        if (!game.zone.inBounds(x, y) || (x === p.x && y === p.y)) continue;
        if (!game.zone.tileAt(x, y)?.walkable || !game.los(p, { x, y })) continue;
        const enemy = game.enemyAt(x, y);
        ctx.fillStyle = enemy ? `rgba(255,80,60,${(a + 0.25).toFixed(3)})` : `rgba(242,216,136,${a.toFixed(3)})`;
        ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
      }
    }
  }

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
      const bob = Math.sin(this.time * 3 + g.x) * 0.8;
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

  /** Enemigos y jugador ordenados por fila (los de abajo tapan a los de arriba). */
  private drawEntities(game: Game): void {
    const list: Array<{ y: number; draw: () => void }> = game.enemies.map((e) => ({ y: e.ry, draw: () => this.drawEnemy(game, e) }));
    for (const n of game.npcs) list.push({ y: n.y, draw: () => this.drawNpc(game, n) });
    list.push({ y: game.view.ry, draw: () => this.drawPlayer(game) });
    const ally = game.ally;
    if (ally) list.push({ y: ally.ry, draw: () => this.drawAlly(game) });
    const pu = game.pet;
    if (pu) list.push({ y: pu.ry, draw: () => this.drawPet(game) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
  }

  /** Compañero: sprite humanoide con barra de vida verde (gris si está caído). */
  private drawAlly(game: Game): void {
    const a = game.ally;
    if (!a) return;
    const { ctx } = this;
    const k = Math.min(1, 0.25);
    a.rx += (a.x - a.rx) * k;
    a.ry += (a.y - a.ry) * k;
    a.bumpT = Math.max(0, a.bumpT - 0.08);
    a.flashT = Math.max(0, a.flashT - 0.06);
    const bump = Math.sin(a.bumpT * Math.PI) * 4;
    const x = a.rx * TILE + a.bumpDx * bump;
    const y = a.ry * TILE + a.bumpDy * bump;
    const l = a.def.look;
    const spr = humanoidSprite({
      hair: l.hair ?? PAL.hair, skin: l.skin ?? PAL.skin, cloth: l.cloth, clothDark: l.clothDark, pants: l.pants,
      ...(l.hat ? { hat: l.hat } : {}), ...(l.overlay ? { overlay: l.overlay } : {}),
    });
    const down = game.state.party.down;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 15, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
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
    u.rx += (u.x - u.rx) * 0.25;
    u.ry += (u.y - u.ry) * 0.25;
    u.bumpT = Math.max(0, u.bumpT - 0.08);
    u.flashT = Math.max(0, u.flashT - 0.06);
    const bump = Math.sin(u.bumpT * Math.PI) * 4;
    const hop = pi.down ? 0 : Math.abs(Math.sin(this.time * 4 + u.x)) * 0.8;
    const x = u.rx * TILE + u.bumpDx * bump;
    const y = u.ry * TILE + u.bumpDy * bump - hop;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(u.rx * TILE + 8, u.ry * TILE + 15, 4.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const spr = petSprite(sp.look, sp.stage);
    ctx.globalAlpha = pi.down ? 0.4 : 1;
    ctx.drawImage(u.facing === 'right' ? spr.right : spr.left, Math.round(x), Math.round(y));
    ctx.globalAlpha = 1;
    if (u.flashT > 0) {
      ctx.fillStyle = `rgba(255,80,60,${(u.flashT * 0.4).toFixed(2)})`;
      ctx.fillRect(Math.round(x) + 3, Math.round(y) + 4, 10, 11);
    }
    const max = Math.max(1, game.petStatsNow().hp);
    ctx.fillStyle = '#000';
    ctx.fillRect(Math.round(x) + 1.5, Math.round(y) - 1.5, 13, 2.5);
    ctx.fillStyle = '#5aa8f0';
    ctx.fillRect(Math.round(x) + 2, Math.round(y) - 1, (12 * (pi.down ? 0 : pi.hp)) / max, 1.5);
  }

  /** Suelo ardiendo (talentos). */
  private drawHazards(game: Game): void {
    const { ctx } = this;
    for (const hz of game.hazards) {
      const flick = 0.35 + 0.2 * Math.sin(this.time * 9 + hz.x * 3 + hz.y);
      ctx.fillStyle = `rgba(255,110,30,${flick.toFixed(3)})`;
      ctx.fillRect(hz.x * TILE + 1, hz.y * TILE + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = `rgba(255,220,120,${(flick * 0.8).toFixed(3)})`;
      const f = Math.floor(this.time * 6 + hz.x) % 3;
      ctx.fillRect(hz.x * TILE + 4 + f * 3, hz.y * TILE + 8 - f, 2, 4);
    }
  }

  private drawNpc(game: Game, n: NpcDef): void {
    const { ctx } = this;
    const x = n.x * TILE;
    const y = n.y * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 15, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
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
    // Fuera de la vista del jugador y lejos: no se dibuja (niebla ligera).
    if (dist(e.x, e.y, p.x, p.y) > 10) return;
    const bump = Math.sin(e.bumpT * Math.PI) * 4;
    const x = e.rx * TILE + e.bumpDx * bump;
    const y = e.ry * TILE + e.bumpDy * bump;
    if (e.def.boss) {
      const pulse = 7 + Math.sin(this.time * 4) * 1.5;
      ctx.fillStyle = 'rgba(160,40,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(x + 8, y + 13, pulse, pulse / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 15, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    const wild = e.def.pet ? PET_SPECIES.get(e.def.pet.species) : undefined;
    const spr = wild ? petSprite(wild.look, wild.stage) : monsterSprite(e.def.look);
    const img = e.facing === 'right' ? spr.right : spr.left;
    ctx.drawImage(img, Math.round(x), Math.round(y) - 1);
    if (e.flashT > 0) {
      ctx.globalAlpha = e.flashT;
      ctx.drawImage(silhouette(img), Math.round(x), Math.round(y) - 1);
      ctx.globalAlpha = 1;
    }
    // Barra de vida, nivel y estados
    if (e.alerted || e.hp < e.maxHp || e.def.boss) {
      const w = 12;
      const bx = Math.round(x) + 2;
      const by = Math.round(y) - 3;
      ctx.fillStyle = '#000';
      ctx.fillRect(bx - 0.5, by - 0.5, w + 1, 2.5);
      ctx.fillStyle = e.def.boss ? '#a040ff' : '#d03030';
      ctx.fillRect(bx, by, (w * Math.max(0, e.hp)) / e.maxHp, 1.5);
      const danger = dangerLevel(e.def.level, game.state.player.level);
      const col = { trivial: '#8a8a8a', facil: '#80c080', normal: '#ece6d6', dificil: '#f0a040', mortal: '#ff4040' }[danger];
      ctx.font = 'bold 4px sans-serif';
      ctx.textAlign = 'right';
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      const label = `${danger === 'mortal' ? '☠' : ''}${e.def.level}`;
      ctx.strokeText(label, bx - 1, by + 2.5);
      ctx.fillStyle = col;
      ctx.fillText(label, bx - 1, by + 2.5);
      e.statuses.forEach((st, i) => {
        ctx.fillStyle = STATUS_INFO[st.id].color;
        ctx.fillRect(bx + i * 3, by + 2.5, 2, 2);
      });
    }
  }

  private drawFx(game: Game): void {
    const { ctx } = this;
    for (const f of game.fx) {
      const k = f.t / f.life;
      if (f.kind === 'text') {
        const x = f.x * TILE + 8;
        const y = f.y * TILE + 2 - k * 10;
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        ctx.font = 'bold 7px sans-serif';
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
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 15, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pequeño salto al caminar
    const bob = v.stepT >= 0 ? -Math.round(Math.sin(v.stepT * Math.PI) * 1.5) : 0;
    const bump = Math.sin(v.bumpT * Math.PI) * 4;
    const sx = Math.round(x + v.bumpDx * bump);
    const sy = Math.round(y + v.bumpDy * bump) + bob - 1;
    const sprite = humanoidSprite(this.heroColors);
    const img = v.facing === 'right' ? sprite.right : sprite.left;
    if (game.combat.stealth > 0) ctx.globalAlpha = 0.45;
    ctx.drawImage(img, sx, sy);
    ctx.globalAlpha = 1;
    if (v.flashT > 0) {
      ctx.globalAlpha = v.flashT * 0.8;
      ctx.drawImage(silhouette(img, '#ff3030'), sx, sy);
      ctx.globalAlpha = 1;
    }
  }

  /** Oscuridad ambiental con un halo de luz alrededor del jugador. */
  private drawDarkness(game: Game, camX: number, camY: number, dayNight: boolean): void {
    const { ctx, camera } = this;
    const kind = game.zone.def.kind;
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

/** Silueta de un sprite en un color (para el destello al recibir daño). */
const silCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
function silhouette(img: HTMLCanvasElement, color = '#ffffff'): HTMLCanvasElement {
  let m = silCache.get(img);
  if (!m) silCache.set(img, (m = new Map()));
  let c = m.get(color);
  if (!c) {
    c = makeCanvas(img.width, img.height);
    const x = ctx2d(c);
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    m.set(color, c);
  }
  return c;
}
