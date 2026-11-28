/** Aspecto de los personajes: colores de héroe y retratos (puro, sin DOM ni gráficos). */

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

/** Plantillas de clase que el 3D sabe dibujar (sombrero, arma y accesorios). */
export const KNOWN_OVERLAYS: readonly string[] = ['guerrero', 'picaro', 'mago', 'clerigo', 'barbaro', 'explorador', 'druida', 'bardo'];

/** Tonos de piel y pelo para los retratos (índice = piel * PELOS + pelo). */
export const SKIN_TONES: readonly string[] = ['#f0c8a0', '#d9a67a', '#b07850', '#7a4a30'];
export const HAIR_COLORS: readonly string[] = ['#3a2418', '#1a1418', '#a8642c', '#d8c070', '#c8c0c8'];
export const PORTRAIT_COUNT = SKIN_TONES.length * HAIR_COLORS.length;

export function portraitColors(index: number): { skin: string; hair: string } {
  const i = ((index % PORTRAIT_COUNT) + PORTRAIT_COUNT) % PORTRAIT_COUNT;
  return { skin: SKIN_TONES[Math.floor(i / HAIR_COLORS.length)]!, hair: HAIR_COLORS[i % HAIR_COLORS.length]! };
}

export const DEFAULT_HERO_COLORS: HumanoidColors = { hair: '#3a2418', skin: '#d9a67a', cloth: '#5a2f4a', clothDark: '#3d1f33', pants: '#3d2f22' };

/** Colores completos del héroe a partir de su clase y retrato. */
export function heroColors(look: { overlay: string; cloth: string; clothDark: string; pants: string; hat: string }, portrait: number): HumanoidColors {
  return { ...portraitColors(portrait), cloth: look.cloth, clothDark: look.clothDark, pants: look.pants, hat: look.hat, overlay: look.overlay };
}
