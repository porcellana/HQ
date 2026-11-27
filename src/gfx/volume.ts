/**
 * VOLUMEN PSEUDO-3D (v0.6)
 * ------------------------
 * Construye, una sola vez por zona, dos capas estáticas:
 *  - `base`: el suelo con sombras proyectadas (abajo-derecha) y oclusión ambiental junto a muros y objetos.
 *  - `tall`: muros, tejados, árboles, pinos, arbustos y rocas extruidos hacia arriba (cara frontal oscura +
 *    cara superior clara, luz desde arriba-izquierda), con fondo transparente.
 * El renderizador copia `base`, y luego `tall` por franjas de fila intercaladas con las entidades.
 * Las coordenadas del juego no cambian: la extrusión es sólo dibujo.
 */
import type { Zone } from '@/game/world/zone';
import { TILE, ctx2d, makeCanvas } from './canvas';
import { getGroundSprite, getObjectSprite, getTileSprite, isObjectSprite, variantFor } from './tiles';

/** Máxima extrusión (px de mundo) por encima de la casilla. */
export const EXTRUDE = 8;

export interface Volume {
  base: HTMLCanvasElement;
  tall: HTMLCanvasElement;
  /** Índices (y*ancho+x) de casillas de agua, para animarlas. */
  water: Int32Array;
}

const WALLS = new Set(['stoneWall', 'woodWall', 'caveWall', 'silkWall', 'cryptWall']);
const ROOFS = new Set(['roof', 'roofSlate']);
const OBJ_H: Record<string, number> = { tree: 7, pine: 8, bush: 4, rock: 4, cactus: 6, palm: 7, snowPine: 8, deadTree: 7, crag: 5, tent: 5 };
const WALL_H = 5;

type Kind = 'none' | 'wall' | 'roof' | 'object';

function classify(spriteId: string | undefined): Kind {
  if (!spriteId) return 'none';
  if (WALLS.has(spriteId)) return 'wall';
  if (ROOFS.has(spriteId)) return 'roof';
  if (isObjectSprite(spriteId)) return 'object';
  return 'none';
}

const shadeCache = new Map<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

/** Copia del sprite con un velo de color encima (sólo sobre sus píxeles opacos). */
function tinted(img: HTMLCanvasElement, color: string): HTMLCanvasElement {
  let m = shadeCache.get(img);
  if (!m) shadeCache.set(img, (m = new Map()));
  let out = m.get(color);
  if (!out) {
    out = makeCanvas(img.width, img.height);
    const c = ctx2d(out);
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = color;
    c.fillRect(0, 0, img.width, img.height);
    m.set(color, out);
  }
  return out;
}

const SIDE_DARK = 'rgba(10,6,26,0.5)';
const SIDE_MID = 'rgba(10,6,26,0.34)';
const TOP_LIGHT = 'rgba(255,240,200,0.13)';
const FACADE = 'rgba(10,6,26,0.24)';

export function buildVolume(zone: Zone): Volume {
  const W = zone.width, H = zone.height;
  const kinds: Kind[] = new Array(W * H).fill('none');
  const sprites: Array<string | undefined> = new Array(W * H);
  const water: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sp = zone.tileAt(x, y)?.sprite;
      sprites[y * W + x] = sp;
      kinds[y * W + x] = classify(sp);
      if (sp === 'water') water.push(y * W + x);
    }
  }
  const kindAt = (x: number, y: number): Kind => (x < 0 || y < 0 || x >= W || y >= H ? 'wall' : kinds[y * W + x]!);
  const isBlock = (k: Kind) => k === 'wall' || k === 'roof';

  // Fachada: pared bajo un tejado (o bajo otra fachada). Se dibuja plana, sin cara superior.
  const facade = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (kinds[y * W + x] !== 'wall') continue;
      const up = y > 0 ? y * W - W + x : -1;
      if (up >= 0 && (kinds[up] === 'roof' || facade[up])) facade[y * W + x] = 1;
    }
  }

  // ------------------------------------------------------------------ base
  const base = makeCanvas(W * TILE, H * TILE);
  const b = ctx2d(base);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sp = sprites[y * W + x];
      if (!sp) continue;
      const v = variantFor(x, y);
      b.drawImage(kinds[y * W + x] === 'object' ? getGroundSprite(sp, v) : getTileSprite(sp, v), x * TILE, y * TILE);
    }
  }

  // Sombras proyectadas (abajo-derecha) en una máscara y se aplican de una vez, suavizadas.
  const mask = makeCanvas(W * TILE, H * TILE);
  const m = ctx2d(mask);
  m.fillStyle = '#000';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = kinds[y * W + x]!;
      if (k === 'none') continue;
      const px = x * TILE, py = y * TILE;
      if (k === 'object') {
        const sp = sprites[y * W + x]!;
        const rx = sp === 'tree' || sp === 'pine' || sp === 'snowPine' || sp === 'palm' ? 8 : 6;
        m.beginPath();
        m.ellipse(px + 10, py + 13.5, rx, rx / 2.2, 0, 0, Math.PI * 2);
        m.fill();
      } else {
        m.fillRect(px + 5, py + 4, TILE, TILE);
      }
    }
  }
  b.save();
  b.globalAlpha = 0.3;
  const soft = 'filter' in b;
  if (soft) (b as unknown as { filter: string }).filter = 'blur(1.4px)';
  b.drawImage(mask, 0, 0);
  b.restore();

  // Oclusión ambiental: el suelo se oscurece junto a muros y objetos altos.
  const ao = (x: number, y: number, dx: number, dy: number, size: number, alpha: number): void => {
    const px = x * TILE, py = y * TILE;
    const gx0 = dx < 0 ? px : dx > 0 ? px + TILE : px;
    const gy0 = dy < 0 ? py : dy > 0 ? py + TILE : py;
    const g = b.createLinearGradient(gx0, gy0, gx0 + dx * size, gy0 + dy * size);
    g.addColorStop(0, `rgba(6,4,16,${alpha})`);
    g.addColorStop(1, 'rgba(6,4,16,0)');
    b.fillStyle = g;
    if (dx !== 0) b.fillRect(dx < 0 ? px : px + TILE - size, py, size, TILE);
    else b.fillRect(px, dy < 0 ? py : py + TILE - size, TILE, size);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (kinds[y * W + x] !== 'none') continue;
      const wt = (k: Kind) => (isBlock(k) ? 1 : k === 'object' ? 0.55 : 0);
      const up = wt(kindAt(x, y - 1)), lf = wt(kindAt(x - 1, y)), rt = wt(kindAt(x + 1, y)), dn = wt(kindAt(x, y + 1));
      if (up) ao(x, y, 0, -1, 7, 0.34 * up);
      if (lf) ao(x, y, -1, 0, 5, 0.26 * lf);
      if (rt) ao(x, y, 1, 0, 4, 0.18 * rt);
      if (dn) ao(x, y, 0, 1, 4, 0.12 * dn);
    }
  }

  // ------------------------------------------------------------------ tall
  const tall = makeCanvas(W * TILE, H * TILE);
  const t = ctx2d(tall);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = kinds[y * W + x]!;
      if (k === 'none') continue;
      const sp = sprites[y * W + x]!;
      const v = variantFor(x, y);
      const px = x * TILE, py = y * TILE;
      if (k === 'object') {
        const o = getObjectSprite(sp, v);
        const h = OBJ_H[sp] ?? 5;
        const dark = tinted(o, SIDE_DARK), mid = tinted(o, SIDE_MID);
        for (let i = 0; i < h; i++) t.drawImage(i < h * 0.55 ? dark : mid, px, py - i);
        t.drawImage(tinted(o, TOP_LIGHT), px, py - h);
        continue;
      }
      const s = getTileSprite(sp, v);
      if (facade[y * W + x]) {
        t.drawImage(tinted(s, FACADE), px, py);
        t.fillStyle = 'rgba(0,0,0,0.25)';
        t.fillRect(px, py + TILE - 1, TILE, 1);
        continue;
      }
      const h = WALL_H;
      // Cara superior (elevada), con bisel claro en los bordes expuestos al sol.
      t.drawImage(tinted(s, TOP_LIGHT), px, py - h);
      const exposedUp = !isBlock(kindAt(x, y - 1));
      const exposedLeft = !isBlock(kindAt(x - 1, y));
      const exposedRight = !isBlock(kindAt(x + 1, y));
      if (exposedUp) {
        t.fillStyle = 'rgba(255,248,225,0.30)';
        t.fillRect(px, py - h, TILE, 1);
      }
      if (exposedLeft) {
        t.fillStyle = 'rgba(255,248,225,0.2)';
        t.fillRect(px, py - h, 1, TILE);
      }
      if (exposedRight) {
        t.fillStyle = 'rgba(10,6,26,0.28)';
        t.fillRect(px + TILE - 1, py - h, 1, TILE);
      }
      // Cara frontal (más oscura) sólo si no hay otro bloque debajo.
      if (!isBlock(kindAt(x, y + 1))) {
        t.drawImage(s, 0, TILE - h, TILE, h, px, py + TILE - h, TILE, h);
        t.fillStyle = k === 'roof' ? 'rgba(10,6,26,0.5)' : 'rgba(10,6,26,0.42)';
        t.fillRect(px, py + TILE - h, TILE, h);
        t.fillStyle = 'rgba(255,248,225,0.12)';
        t.fillRect(px, py + TILE - h, TILE, 1);
        t.fillStyle = 'rgba(0,0,0,0.35)';
        t.fillRect(px, py + TILE - 1, TILE, 1);
      }
    }
  }
  return { base, tall, water: Int32Array.from(water) };
}
