/**
 * SPRITES DE ENEMIGOS (pixel art en texto)
 *   k contorno  m color principal  d oscuro  a acento  e ojos
 *   w acero  o madera  b hueso  g oro
 * Las filas se normalizan a 16x16 automáticamente.
 */
import type { EnemyLook } from '@/data/schema';
import { PAL } from './palette';
import { TILE, ctx2d, drawPixelArt, makeCanvas } from './canvas';
import { HUMANOID, OVERLAYS } from './sprites';

export const SHAPES: Readonly<Record<string, readonly string[]>> = {
  goblin: [
    '................',
    '................',
    '................',
    '..k...kkkk...k..',
    '.kmk.kmmmmk.kmk.',
    '..kmkmmmmmmkmk..',
    '...kmememmemk...',
    '....kmmmmmmk....',
    '.....kmddmk..k..',
    '....kaaaaaak.kw.',
    '...kmaaaaaamkkwk',
    '...km.kaak.mk.o.',
    '.....kaaaak...o.',
    '.....kmkkmk.....',
    '.....kmk.kmk....',
    '.....kk...kk....',
  ],
  esqueleto: [
    '................',
    '.....kkkkkk.....',
    '....kbbbbbbk....',
    '....kbekkebk....',
    '....kbbbbbbk....',
    '.....kbkkbk.....',
    '......kbbk...k..',
    '....kkbbbbkk.kw.',
    '...kb.kbbk.bkkw.',
    '...kb.bkkb.bk.w.',
    '...k..kbbk..k.o.',
    '......kbbk......',
    '.....kb..bk.....',
    '.....kb..bk.....',
    '.....kb..bk.....',
    '....kkk..kkk....',
  ],
  lobo: [
    '................',
    '................',
    '................',
    '..........kk.k..',
    '.........kmmkmk.',
    '.........kmmmmmk',
    '..kkkkkkkmmemmkk',
    '.kmmmmmmmmmmmmak',
    'kmmmmmmmmmmmkkk.',
    'kmdmmmmmmmmmk...',
    '.kmdddddddddk...',
    '..kdk.kdk.kdk...',
    '..kdk.kdk.kdk...',
    '..kk..kk..kk....',
    '................',
    '................',
  ],
  rata: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........kkk...',
    '.......kkkmmmk..',
    '.....kkmmmmmemk.',
    '....kmmmmmmmmmak',
    '..kkmmmmmmmmmk..',
    '.kakkdddddddk...',
    'ka...kdk.kdk....',
    '.....kk...kk....',
    '................',
  ],
  arana: [
    '................',
    '................',
    '................',
    '................',
    '...k..kkkk..k...',
    '..k.kkmmmmkk.k..',
    '.k.kmmmaammmk.k.',
    '..kmmmmaammmmk..',
    '.kkmmmmmmmmmmkk.',
    'k.kmmeemmeemmk.k',
    '..kkmmmmmmmmkk..',
    '.k.k.kddddk.k.k.',
    'k..k..kkkk..k..k',
    '..k..........k..',
    '................',
    '................',
  ],
};

const CROWN = [
  '................',
  '.....g.gg.g.....',
  '.....gggggg.....',
];

function norm(rows: readonly string[]): string[] {
  const out = rows.map((r) => r.padEnd(TILE, '.').slice(0, TILE));
  while (out.length < TILE) out.push('.'.repeat(TILE));
  return out.slice(0, TILE);
}

const cache = new Map<string, { right: HTMLCanvasElement; left: HTMLCanvasElement }>();

export function monsterSprite(look: EnemyLook): { right: HTMLCanvasElement; left: HTMLCanvasElement } {
  const key = JSON.stringify(look);
  const hit = cache.get(key);
  if (hit) return hit;
  const right = makeCanvas(TILE, TILE);
  const ctx = ctx2d(right);
  const eye = look.eye ?? '#e03030';
  if (look.shape === 'humanoide') {
    // Reutiliza el cuerpo del héroe con la paleta del monstruo.
    const map: Record<string, string> = {
      k: PAL.black, h: look.dark, s: look.main, C: look.accent, D: look.dark, B: look.dark, g: PAL.gold,
      P: look.dark, b: look.dark, H: look.accent, W: PAL.steel, w: PAL.woodL, O: eye, M: PAL.steelD,
    };
    const body = HUMANOID.map((r, i) => (i === 5 ? r.replace('kskssksk', 'ksessesk') : r)); // ojos de color
    drawPixelArt(ctx, body, { ...map, e: eye });
    const ov = look.overlay ? OVERLAYS[look.overlay] : undefined;
    if (ov) drawPixelArt(ctx, ov, map);
  } else {
    const rows = norm(SHAPES[look.shape] ?? SHAPES['goblin']!);
    drawPixelArt(ctx, rows, {
      k: PAL.black, m: look.main, d: look.dark, a: look.accent, e: eye,
      w: PAL.steel, o: PAL.woodL, b: look.main, g: PAL.gold,
    });
  }
  if (look.crown) drawPixelArt(ctx, CROWN, { g: PAL.goldL });
  const left = makeCanvas(TILE, TILE);
  const lc = ctx2d(left);
  lc.translate(TILE, 0);
  lc.scale(-1, 1);
  lc.drawImage(right, 0, 0);
  const out = { right, left };
  cache.set(key, out);
  return out;
}
