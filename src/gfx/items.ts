/**
 * ICONOS DE OBJETOS (pixel art en texto, 16x16)
 *   k contorno  c color del objeto  d color oscurecido  l color aclarado
 *   w madera  g oro  x brillo blanco
 * Para un icono nuevo, añade aquí una forma y úsala en data/items (icon.shape).
 */
import type { ItemIcon } from '@/data/schema';
import { PAL } from './palette';
import { TILE, ctx2d, drawPixelArt, makeCanvas } from './canvas';

const SHAPES: Readonly<Record<string, readonly string[]>> = {
  espada: [
    '.............kk.', '............klk.', '...........klck.', '..........klck..', '.........klck...', '........klck....',
    '.......klck.....', '..kk..klck......', '..kgkklck.......', '...kgkck........', '....kgk.........', '...kwkgk........',
    '..kwk.kgk.......', '.kgk...kk.......', '.kk.............',
  ],
  daga: [
    '................', '................', '................', '..........kk....', '.........klk....', '........klck....',
    '.......klck.....', '......klck......', '..kk.klck.......', '..kgkkck........', '...kgkk.........', '...kwkgk........',
    '..kwk.kk........', '..kk............',
  ],
  hacha: [
    '................', '.......kkkk.....', '......kllcck....', '.....klcccdk....', '....kwkccddk....', '....kwkkcdk.....',
    '...kwk..kk......', '...kwk..........', '..kwk...........', '..kwk...........', '.kwk............', '.kwk............',
    'kwk.............', 'kk..............',
  ],
  maza: [
    '................', '..........kkk...', '.........klcck..', '........kcllcdk.', '........kcccddk.', '........kkcddk..',
    '.......kwkkkk...', '......kwk.......', '.....kwk........', '....kwk.........', '...kwk..........', '..kgk...........',
    '.kwk............', '.kk.............',
  ],
  baston: [
    '..........kkk...', '.........kxcck..', '.........kccck..', '..........kck...', '.........kwk....', '........kwk.....',
    '.......kwk......', '......kwk.......', '.....kwk........', '....kwk.........', '...kwk..........', '..kwk...........',
    '.kwk............', '.kk.............',
  ],
  arco: [
    '.......kkk......', '......kwwk......', '.....kwk.k......', '....kwk..x......', '....kwk..x......', '...kwk...x......',
    '...kgk...x......', '...kgk...x......', '...kwk...x......', '....kwk..x......', '....kwk..x......', '.....kwk.k......',
    '......kwwk......', '.......kkk......',
  ],
  casco: [
    '................', '................', '.....kkkkkk.....', '....kllcccck....', '...klccccccdk...', '...kcccccccdk...',
    '...kckkkkkkdk...', '...kck....kdk...', '...kck....kdk...', '...kkk....kkk...',
  ],
  capucha: [
    '................', '................', '......kkkk......', '.....kccccк.....', '....kcccccdk....', '...kcckkkkcdk...',
    '...kck....kdk...', '...kck....kdk...', '..kcck....kddk..', '..kkkk....kkkk..',
  ],
  pecho: [
    '................', '..kkk......kkk..', '.kcclkkkkkkccdk.', '.kcllccccccccdk.', '.kkcclccccccdkk.', '...kclccccccdk..',
    '...kclccccccdk..', '...kccgggggcdk..', '...kcccccccddk..', '...kccccccdddk..', '...kkkkkkkkkkk..',
  ],
  guantes: [
    '................', '................', '..k.k.k.........', '.kckckck........', '.kckckckk.......', '.kcccccckk......',
    '.kcccccckck.....', '.kcccccccdk.....', '..kccccccdk.....', '..kddddddk......', '..kggggggk......', '..kkkkkkkk......',
  ],
  piernas: [
    '................', '................', '....kkkkkkkk....', '....kgggggggk...', '....kcccccccck...', '....kcccdccck....',
    '....kccdkdcck...', '....kcck.kcck...', '....kcck.kcck...', '....kcck.kcck...', '....kcck.kcck...', '....kddk.kddk...',
    '....kkkk.kkkk...',
  ],
  botas: [
    '................', '................', '................', '.....kkkk.......', '.....kcck.......', '.....kcck.......',
    '.....kcck.......', '.....kcck.......', '.....kccckkk....', '.....kcccccck...', '.....kddddddk...', '.....kkkkkkkk...',
  ],
  escudo: [
    '................', '...kkkkkkkkkk...', '...klcccgcccdk..', '...kcccggcccdk..', '...kcgggggggdk..', '...kcccggcccdk..',
    '...kcccggcccdk..', '....kccggccdk...', '....kcccccccdk..', '.....kccccdk....', '......kccdk.....', '.......kkk......',
  ],
  libro: [
    '................', '................', '...kkkkkkkkk....', '..kcccccccccxk...', '..kcgggggccckxk..', '..kcgccccgcckxk..',
    '..kcgggggccckxk..', '..kcccccccccxk...', '..kcccccccccxk...', '..kdddddddddkk...', '...kkkkkkkkk.....',
  ],
  simbolo: [
    '................', '.......kk.......', '......kcck......', '......kcck......', '...kkkkcckkkk...', '...kcccxccccdk..',
    '...kkkkcckkkk...', '......kcck......', '......kcck......', '......kcck......', '......kddk......', '.......kk.......',
  ],
  pico: [
    '................', '..kkkkkkkkkk....', '.kccllllcccck...', 'kcck..kwk..kcck.', 'kck...kwk...kck.', 'kk....kwk....kk.',
    '......kwk.......', '......kwk.......', '......kwk.......', '......kwk.......', '......kwk.......', '......kwk.......',
    '......kkk.......',
  ],
  anillo: [
    '................', '................', '................', '.......kk.......', '......kcck......', '......kxlk......',
    '.....kkkkkk.....', '....kgg..ggk....', '...kgk....kgk...', '...kgk....kgk...', '...kgk....kgk...', '....kgg..ggk....',
    '.....kkkkkk.....',
  ],
  amuleto: [
    '................', '...kk......kk...', '...kgk....kgk...', '....kgk..kgk....', '.....kgkkgk.....', '......kggk......',
    '.....kkkkkk.....', '....kcllcck.....', '....kclcccdk....', '....kccccddk....', '.....kcddk......', '......kkk.......',
  ],
  pocion: [
    '................', '......kkkk......', '......kwwk......', '.......kk.......', '......kxxk......', '.....kxccck.....',
    '....kxlcccck....', '....kclcccdk....', '....kccccddk....', '....kcccdddk....', '.....kdddk......', '......kkk.......',
  ],
  pan: [
    '................', '................', '................', '.....kkkkkk.....', '...kkllccccdk...', '..kllclcclccdk..',
    '..kclcclcclcdk..', '..kccccccccddk..', '...kddddddddk...', '....kkkkkkkk....',
  ],
  carne: [
    '................', '................', '................', '......kkkk......', '....kkccccdk.....', '...kclcccccdkkk..',
    '...kcccxccddkxxk.', '...kcccccdddkxxk.', '....kdddddkk.kk..', '.....kkkkk.......',
  ],
  colmillo: [
    '................', '................', '.....kkk........', '....kxcck.......', '....kccck.......', '.....kccck......',
    '.....kcccdk.....', '......kccdk.....', '.......kcdk.....', '........kdk.....', '.........kk.....',
  ],
  piel: [
    '................', '................', '..kk........kk..', '.kcck.kkkk.kcck.', '..kcckcccckcck..', '...kccclcccck...',
    '...kcclccccdk...', '...kccccccddk...', '..kcck....kcck..', '.kcck......kcck.', '..kk........kk..',
  ],
  seda: [
    '................', '................', '.....kkkkkk.....', '....kcxcccck.....', '...kcxccxccck...', '...kcccxcccdk...',
    '...kccxcccxdk...', '....kcccxcdk....', '.....kkkkkk.....',
  ],
  polvo: [
    '................', '................', '................', '................', '.......kk.......', '......kcck......',
    '.....kcxcck.....', '....kcccccck....', '...kcccxcccdk...', '..kkkkkkkkkkkk..',
  ],
  mineral: [
    '................', '................', '................', '......kkkk......', '....kkdcdckk....', '...kddcxcddck...',
    '..kddcccdcxddk..', '..kdcxddcccddk..', '..kddddcddddk...', '...kkkkkkkkk....',
  ],
  gema: [
    '................', '................', '................', '.....kkkkkk.....', '....kxlcccck....', '...kxllccccdk...',
    '...kkkkkkkkkk...', '....kccccddk....', '.....kccddk.....', '......kcdk......', '.......kk.......',
  ],
  saco: [
    '................', '................', '.......kk.......', '......kggk......', '.....kkkkkk.....', '....kwwwwwwk....',
    '...kwwlwwwwwk...', '...kwlwwgwwwk...', '...kwwwwwwwdk...', '....kwwwwwdk....', '.....kkkkkk.....',
  ],
};

/** Aclara u oscurece un color #rrggbb. */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const cache = new Map<string, HTMLCanvasElement>();

export function itemIcon(icon: ItemIcon): HTMLCanvasElement {
  const key = `${icon.shape}|${icon.color ?? ''}`;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(TILE, TILE);
  const color = icon.color ?? '#9aa0ac';
  const rows = (SHAPES[icon.shape] ?? SHAPES['saco']!).map((r) => r.replace(/[^\x20-\x7e]/g, 'c').padEnd(TILE, '.').slice(0, TILE));
  drawPixelArt(ctx2d(c), rows, {
    k: PAL.black, c: color, d: shade(color, -0.35), l: shade(color, 0.35), w: PAL.woodL, g: PAL.gold, x: '#ffffff',
  });
  cache.set(key, c);
  return c;
}

/** Icono escalado listo para meter en el DOM. */
export function itemIconElement(icon: ItemIcon, className = 'item-icon'): HTMLCanvasElement {
  const c = makeCanvas(TILE, TILE);
  c.className = className;
  ctx2d(c).drawImage(itemIcon(icon), 0, 0);
  return c;
}

export const ICON_SHAPES = Object.keys(SHAPES);
