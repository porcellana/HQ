/**
 * SPRITES DE MASCOTAS (pixel art en texto, originales)
 *   k contorno  m color principal  d oscuro  a acento  e ojos
 * Cada forma tiene versión pequeña (etapa 1) y grande (etapas 2 y 3). La
 * etapa 3 añade un contorno brillante del color de acento.
 */
import type { PetLook } from '@/data/schema';
import { PAL } from './palette';
import { TILE, ctx2d, drawPixelArt, makeCanvas } from './canvas';

type Art = readonly string[];

/** Formas nuevas (v0.9.1): sólo tienen versión grande; la cría se dibuja reducida. */
const BIG_ONLY: Readonly<Record<string, Art>> = {
  zorro: [
    '.........k..k...',
    '........kmkkmk..',
    '........kmmmmmk.',
    '.kk.....kmemmmk.',
    'kaak..kkkmmmmak.',
    'kaamkkmmmmmmk...',
    '.kaammmmmmmmk...',
    '..kkmmmmmmmdk...',
    '....kmmmmmmdk...',
    '....kmdkkmdk....',
    '....kdk..kdk....',
    '....kk...kk.....',
  ],
  pajaro: [
    '.......kkk......',
    '......kmmmk.....',
    '.....kmmemmkk...',
    '.....kmmmmaak...',
    '..kk.kmmmmkk....',
    '.kddkmmmmmmk....',
    'kddmmmmammmmk...',
    '.kdmmmmmmmmdk...',
    '..kkmmmmmmdk....',
    '....kkmmmkk.....',
    '.....kakak......',
    '.....kk.kk......',
  ],
  serpiente: [
    '.....kkk........',
    '....kmmmk.......',
    '...kmemmmk......',
    '...kmmmaak......',
    '....kmmmk.......',
    '.....kmmk.......',
    '..kkkkmmkkkk....',
    '.kmmmmmmmmmmk...',
    'kmmaammaammmmk..',
    'kmmmmmmmmmmmdk..',
    '.kddmmmmmmddk...',
    '..kkkkkkkkkk....',
  ],
  escarabajo: [
    '............k.k.',
    '.....kkkkk...kk.',
    '...kkmmmmmkkkkk.',
    '..kmmmammmmkmmek',
    '.kmmammmammkmmmk',
    '.kmmmmmmmmmkkkk.',
    '.kddmmmmmmdk....',
    '..kkddddddkk....',
    '..kk.kk.kk.kk...',
    '.kk..kk.kk..kk..',
  ],
  medusa: [
    '....kkkkkkk.....',
    '..kkmmmmmmmkk...',
    '.kmmmaammmmmmk..',
    '.kmmmmmmmmmmmk..',
    '.kmmemmmmemmmk..',
    '.kmmmmmmmmmmdk..',
    '..kdddddddddk...',
    '..kakdkakdkak...',
    '...k.dk.kd.k....',
    '..kd.k..k.dk....',
    '..k..kd.dk..k...',
  ],
};

const SHAPES: Readonly<Record<string, { small?: Art; big: Art }>> = {
  ...Object.fromEntries(Object.entries(BIG_ONLY).map(([k, big]) => [k, { big }])),
  lagarto: {
    small: [
      '', '', '', '', '', '',
      '..........kkk...',
      '.........kmmmk..',
      '....kkk.kmmemk..',
      '...kmmmkmmmmmk..',
      '..kmmammmmmdk...',
      '.kmk.kmmmmdk....',
      'km...kdk.kdk....',
      '.....kk...kk....',
    ],
    big: [
      '',
      '..........kkk...',
      '.........kmmmk..',
      '.....a..kmmmemk.',
      '....kak.kmmmmmmk',
      '...kmmmkmmmmmkk.',
      '..kmmammmmmmdk..',
      '.kmmammmmmmmdk..',
      'kmk.kmmammmddk..',
      'mk..kmmmmmmdk...',
      'k...kdkk.kdkk...',
      '....kdk...kdk...',
      '...kkk...kkk....',
    ],
  },
  nutria: {
    small: [
      '', '', '', '', '', '',
      '.........kkk....',
      '........kmmmk...',
      '...kkk.kmmemk...',
      '..kmmmkmmmmak...',
      '.kmmmmmmmmmk....',
      '.kmmaammmmk.....',
      '..kmmmmmmdk.....',
      '...kdk.kdk......',
      '...kk..kk.......',
    ],
    big: [
      '', '',
      '.........kkkk...',
      '........kmmmmk..',
      '.......kmmmemk..',
      '...kkkkkmmmmaak.',
      '..kmmmmmmmmmkk..',
      '.kmmmmmmmmmmk...',
      'kmmaaaammmmmk...',
      'kmmaaaammmmdk...',
      '.kmmmmmmmmddk...',
      '..kkmmmmmmdk....',
      '...kdkk.kdk.....',
      '...kdk..kdk.....',
      '..kkk..kkk......',
    ],
  },
  brote: {
    small: [
      '', '', '', '',
      '.......aa.......',
      '......kmmk......',
      '.......kk.......',
      '.....kkmmkk.....',
      '....kmmmmmmk....',
      '...kmmemmemk....',
      '...kmmmmmmmk....',
      '...kmmmmmmdk....',
      '....kmmmmdk.....',
      '....kdk.kdk.....',
      '....kk...kk.....',
    ],
    big: [
      '',
      '....d.ddd.d.....',
      '...ddkdddkdd....',
      '..ddkmmmmmkdd...',
      '..dkmmemmemkd...',
      '..dkmmmmmmmkd...',
      '...dkmaaamkd....',
      '....kmmmmmk.....',
      '...kmmmmmmmk....',
      '..kmmmmmmmmmk...',
      '..kmmmmmmmmdk...',
      '..kmmmmmmmddk...',
      '...kdk...kdk....',
      '...kdk...kdk....',
      '..kkk...kkk.....',
    ],
  },
  armadillo: {
    small: [
      '', '', '', '', '', '', '',
      '.....kkkkk......',
      '....kdmdmdk.....',
      '...kmdmdmdmk.kk.',
      '..kmdmdmdmdmkmek',
      '..kmmmmmmmmmmmmk',
      '...kdk.kdk.kkkk.',
      '...kk..kk.......',
    ],
    big: [
      '', '', '',
      '.....kkkkkkk....',
      '....kdmdmdmdk...',
      '...kmdmdmdmdmk..',
      '..kmdmdmdmdmdmkk',
      '..kmdmdmdmdmdmek',
      '.kmmmmmmmmmmmmmk',
      '.kmaaaaaaaaaaamk',
      '..kkdk..kdk..kk.',
      '...kdk..kdk.....',
      '...kk...kk......',
    ],
  },
  murcielago: {
    small: [
      '', '', '', '', '',
      '..k..........k..',
      '.kmk...kk...kmk.',
      '.kmmk.kmmk.kmmk.',
      '.kmmmkmeemkmmmk.',
      '..kmmmmmmmmmmk..',
      '...kkmmaammkk...',
      '.....kmddmk.....',
      '......k..k......',
    ],
    big: [
      '', '',
      '.k............k.',
      'kmk...k..k...kmk',
      'kmmk..kmmk..kmmk',
      'kmmmkkmmmmkkmmmk',
      'kmmmmmmeemmmmmmk',
      '.kmmmmmmmmmmmmk.',
      '..kmmmmaammmmk..',
      '...kkmmmmmmkk...',
      '.....kmddmk.....',
      '.....kd..dk.....',
      '.....k....k.....',
    ],
  },
  hada: {
    small: [
      '', '', '', '',
      '.......aa.......',
      '.k...kmmmmk...k.',
      'kak.kmmmmmmk.kak',
      'kaakmmemmemmkaak',
      '.kakmmmmmmmmkak.',
      '..kkmmmmmmmmkk..',
      '....kmmmmmmk....',
      '.....kmmmmk.....',
      '......kddk......',
      '.......kk.......',
    ],
    big: [
      '',
      '......a..a......',
      '.......aa.......',
      'kk...kmmmmk...kk',
      'kak.kmmmmmmk.kak',
      'kaakmmemmemmkaak',
      'kaaakmmmmmmkaaak',
      '.kaakmmmmmmkaak.',
      '..kkmmmmmmmmkk..',
      '....kmmaammk....',
      '.....kmmmmk.....',
      '......kddk......',
      '.....a.kk.a.....',
      '......a..a......',
    ],
  },
};

export const PET_SHAPES = Object.keys(SHAPES);

/** Ajusta el arte a 16x16 pegado abajo (las crías se ven más pequeñas). */
function norm(rows: Art): string[] {
  const out = rows.map((r) => r.padEnd(TILE, '.').slice(0, TILE));
  while (out.length < TILE) out.unshift('.'.repeat(TILE));
  return out.slice(out.length - TILE);
}

const cache = new Map<string, { right: HTMLCanvasElement; left: HTMLCanvasElement }>();

/** Sprite de una mascota (derecha e izquierda). `stage` 1 = pequeña. */
export function petSprite(look: PetLook, stage: number): { right: HTMLCanvasElement; left: HTMLCanvasElement } {
  const key = `${JSON.stringify(look)}|${stage}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const shape = SHAPES[look.shape] ?? SHAPES['lagarto']!;
  const rows = norm(stage <= 1 && shape.small ? shape.small : shape.big);
  const map = { k: PAL.black, m: look.main, d: look.dark, a: look.accent, e: look.eye ?? '#101010' };
  const base = makeCanvas(TILE, TILE);
  drawPixelArt(ctx2d(base), rows, map);
  if (stage <= 1 && !shape.small) {
    // Cría de una forma sólo grande: versión reducida (3/4) pegada al suelo.
    const tmp = makeCanvas(TILE, TILE);
    const tc = ctx2d(tmp);
    tc.imageSmoothingEnabled = false;
    tc.drawImage(base, 0, 0, TILE, TILE, 2, 4, 12, 12);
    const bc = ctx2d(base);
    bc.clearRect(0, 0, TILE, TILE);
    bc.drawImage(tmp, 0, 0);
  }
  const right = makeCanvas(TILE, TILE);
  const rc = ctx2d(right);
  if (stage >= 3) {
    // Contorno brillante: la silueta en color de acento desplazada 1 px.
    const glow = makeCanvas(TILE, TILE);
    const gc = ctx2d(glow);
    gc.drawImage(base, 0, 0);
    gc.globalCompositeOperation = 'source-in';
    gc.fillStyle = look.accent;
    gc.fillRect(0, 0, TILE, TILE);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) rc.drawImage(glow, dx, dy);
  }
  rc.drawImage(base, 0, 0);
  const left = makeCanvas(TILE, TILE);
  const lc = ctx2d(left);
  lc.translate(TILE, 0);
  lc.scale(-1, 1);
  lc.drawImage(right, 0, 0);
  const out = { right, left };
  cache.set(key, out);
  return out;
}

/** Sprite escalado en un canvas para el DOM. `silhouette` = sólo sombra (no descubierta). */
export function petSpriteCanvas(look: PetLook, stage: number, className = '', silhouette = false): HTMLCanvasElement {
  const c = makeCanvas(TILE, TILE);
  c.className = className;
  const ctx = ctx2d(c);
  ctx.drawImage(petSprite(look, stage).right, 0, 0);
  if (silhouette) {
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#2a2633';
    ctx.fillRect(0, 0, TILE, TILE);
  }
  return c;
}
