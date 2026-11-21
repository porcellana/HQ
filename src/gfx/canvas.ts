/** Utilidades de dibujo en canvas para generar sprites pixel art. */
export const TILE = 16;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Pinta un píxel (o rectángulo) de un color. */
export function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * Dibuja un sprite definido como lista de filas de caracteres.
 * Cada carácter se busca en `colors`; '.' o ' ' es transparente.
 */
export function drawPixelArt(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  colors: Readonly<Record<string, string>>,
  ox = 0,
  oy = 0,
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.' || ch === ' ') continue;
      const col = colors[ch];
      if (col) px(ctx, ox + x, oy + y, col);
    }
  }
}
