/**
 * SPRITES DE PERSONAJES EN PIXEL ART (definidos como texto)
 * --------------------------------------------------------
 * Un personaje = cuerpo base + "capa" de clase (casco, capucha, sombrero,
 * arma...). Letras = colores; '.' = transparente (o "no cambiar" en capas).
 *   k contorno  h pelo  s piel  C ropa  D ropa oscura  B cinturón  g oro
 *   P pantalón  b botas  H casco/capucha/sombrero  W acero  w madera
 *   O orbe mágico  M cabeza de maza
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

/** Capas por clase, dibujadas encima del cuerpo base. */
const BASE_OVERLAYS: Readonly<Record<string, readonly string[]>> = {
  // Casco de acero con protecciones de mejillas y espada larga.
  guerrero: [
    '................',
    '.....kkkkkk.....',
    '....kHHHHHHk....',
    '...kHHHWWHHHk...',
    '....kH....Hk....',
    '....kH....Hk..k.',
    '..............kW',
    '.............kWk',
    '..kWW......WWkWk',
    '.............kWk',
    '.............kWk',
    '.............ggg',
    '..............w.',
    '................',
    '................',
    '................',
  ],
  // Capucha que enmarca la cara y daga corta.
  picaro: [
    '................',
    '.....kkkkkk.....',
    '....kHHHHHHk....',
    '...kHHHHHHHHk...',
    '...kH......Hk...',
    '...kH......Hk...',
    '...kHk....kHk...',
    '....kH....Hk....',
    '................',
    '..............k.',
    '.............kWk',
    '.............kWk',
    '.............gg.',
    '................',
    '................',
    '................',
  ],
  // Sombrero puntiagudo, túnica larga y bastón con orbe.
  mago: [
    '........kk...kOk',
    '.......kHHk..OOO',
    '......kHHHHk.kOk',
    '..kkkkHHgHHkkkwk',
    '..kHHHHHHHHHHkwk',
    '..............w.',
    '..............w.',
    '..............w.',
    '..............w.',
    '..............w.',
    '..............w.',
    '..............w.',
    '....kCCCCCCk..w.',
    '....kCCDDCCk..w.',
    '....kCCCCCCk..w.',
    '................',
  ],
  // Diadema dorada, símbolo sagrado en el pecho y maza.
  clerigo: [
    '................',
    '................',
    '................',
    '....kggggggk....',
    '................',
    '.............kk.',
    '............kMMk',
    '............kMMk',
    '.......g.....kw.',
    '......ggg....kw.',
    '.......g.....kw.',
    '..............w.',
    '................',
    '................',
    '................',
    '................',
  ],
};

/** Capas por clase; las clases nuevas (v0.10) reutilizan la plantilla más parecida. */
export const OVERLAYS: Readonly<Record<string, readonly string[]>> = {
  ...BASE_OVERLAYS,
  barbaro: BASE_OVERLAYS.guerrero!,
  explorador: BASE_OVERLAYS.picaro!,
  druida: BASE_OVERLAYS.clerigo!,
  bardo: BASE_OVERLAYS.mago!,
};

/** Colores de un personaje humanoide. */
export interface HumanoidColors {
  hair: string;
  skin: string;
  cloth: string;
  clothDark: string;
  pants: string;
  hat?: string;
  overlay?: string;
}

/** Tonos de piel y pelo para los retratos (índice = piel * PELOS + pelo). */
export const SKIN_TONES: readonly string[] = ['#f0c8a0', '#d9a67a', '#b07850', '#7a4a30'];
export const HAIR_COLORS: readonly string[] = ['#3a2418', '#1a1418', '#a8642c', '#d8c070', '#c8c0c8'];
export const PORTRAIT_COUNT = SKIN_TONES.length * HAIR_COLORS.length;

export function portraitColors(index: number): { skin: string; hair: string } {
  const i = ((index % PORTRAIT_COUNT) + PORTRAIT_COUNT) % PORTRAIT_COUNT;
  return {
    skin: SKIN_TONES[Math.floor(i / HAIR_COLORS.length)]!,
    hair: HAIR_COLORS[i % HAIR_COLORS.length]!,
  };
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
  const key = JSON.stringify(colors) + rows.length;
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
    H: colors.hat ?? colors.hair,
    W: PAL.steel,
    w: PAL.woodL,
    O: '#7fd7ff',
    M: PAL.steelD,
  };
  const right = makeCanvas(TILE, TILE);
  const ctx = ctx2d(right);
  drawPixelArt(ctx, rows, map);
  const overlay = colors.overlay ? OVERLAYS[colors.overlay] : undefined;
  if (overlay) drawPixelArt(ctx, overlay, map);
  const left = makeCanvas(TILE, TILE);
  const lc = ctx2d(left);
  lc.translate(TILE, 0);
  lc.scale(-1, 1);
  lc.drawImage(right, 0, 0);
  const out = { right, left };
  cache.set(key, out);
  return out;
}

/** Colores completos del héroe a partir de su clase y retrato. */
export function heroColors(look: { overlay: string; cloth: string; clothDark: string; pants: string; hat: string }, portrait: number): HumanoidColors {
  const pc = portraitColors(portrait);
  return { ...pc, cloth: look.cloth, clothDark: look.clothDark, pants: look.pants, hat: look.hat, overlay: look.overlay };
}

/** Dibuja un sprite escalado en un canvas nuevo (para retratos y menús). */
export function spriteCanvas(colors: HumanoidColors, className = ''): HTMLCanvasElement {
  const c = makeCanvas(TILE, TILE);
  c.className = className;
  ctx2d(c).drawImage(humanoidSprite(colors).right, 0, 0);
  return c;
}
