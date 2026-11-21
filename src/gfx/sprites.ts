/**
 * Sprites de personajes en pixel art definidos como texto.
 * Letras = colores de la paleta del personaje; '.' = transparente.
 *   k contorno  h pelo  s piel  C ropa  D ropa oscura  B cinturón
 *   g hebilla   P pantalón  b botas
 */
import { PAL } from './palette';
import { TILE, ctx2d, drawPixelArt, makeCanvas } from './canvas';

export const HUMANOID: readonly string[] = [
  '................',
  '......kkkk......',
  '.....khhhhk.....',
  '....khhhhhhk....',
  '....khsssshk....',
  '....kskssksk....',
  '....kssssssk....',
  '.....kssssk.....',
  '...kkCCCCCCkk...',
  '..kCCCDCCDCCCk..',
  '..ksCCCCCCCCsk..',
  '...kkBBgBBBkk...',
  '....kPPkkPPk....',
  '....kPPkkPPk....',
  '....kbbkkbbk....',
  '....kkk..kkk....',
];

/** Colores de un personaje humanoide. */
export interface HumanoidColors {
  hair: string;
  skin: string;
  cloth: string;
  clothDark: string;
  pants: string;
}

export const DEFAULT_HERO_COLORS: HumanoidColors = {
  hair: PAL.hair,
  skin: PAL.skin,
  cloth: PAL.cloth,
  clothDark: '#3d1f33',
  pants: PAL.dirtD,
};

const cache = new Map<string, { right: HTMLCanvasElement; left: HTMLCanvasElement }>();

/** Genera (y cachea) un sprite humanoide mirando a derecha e izquierda. */
export function humanoidSprite(colors: HumanoidColors, rows: readonly string[] = HUMANOID): { right: HTMLCanvasElement; left: HTMLCanvasElement } {
  const key = JSON.stringify(colors) + rows.join('');
  const hit = cache.get(key);
  if (hit) return hit;
  const map: Record<string, string> = {
    k: PAL.black,
    h: colors.hair,
    s: colors.skin,
    C: colors.cloth,
    D: colors.clothDark,
    B: PAL.woodD,
    g: PAL.gold,
    P: colors.pants,
    b: PAL.woodD,
  };
  const right = makeCanvas(TILE, TILE);
  drawPixelArt(ctx2d(right), rows, map);
  const left = makeCanvas(TILE, TILE);
  const lc = ctx2d(left);
  lc.translate(TILE, 0);
  lc.scale(-1, 1);
  lc.drawImage(right, 0, 0);
  const out = { right, left };
  cache.set(key, out);
  return out;
}
