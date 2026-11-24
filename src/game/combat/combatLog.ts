/**
 * REGISTRO DE COMBATE (modelo, sin DOM)
 * Conserva las líneas del combate en curso con una categoría de color y las
 * limita a un máximo para que no crezca sin fin.
 */
import type { MsgCat } from './presentation';

export interface LogLine {
  text: string;
  cat: MsgCat;
  /** Número de línea creciente (para claves y animación de entrada). */
  n: number;
  /** Instante en que se escribió (segundos, reloj monótono): sirve para desvanecerla. */
  t: number;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

export const LOG_MAX_LINES = 80;
/** Líneas visibles en el panel compacto. */
export const LOG_VISIBLE = 4;

/**
 * Categoría final de una línea: la que indicó el motor o, si no la hay,
 * una deducción por el tipo de mensaje y su texto.
 */
export function classify(text: string, kind: 'info' | 'warn' | 'good' | 'combat' | undefined, cat?: MsgCat): MsgCat {
  if (cat) return cat;
  if (/recuper|curas|curación|te sientes limpio|purificad/i.test(text)) return 'heal';
  if (/envenenad|sangrand|quemad|aturdid|ralentiz|estado|veneno|🔥|💫/i.test(text)) return 'status';
  if (/falla|fallas|pifia|esquiv|resiste/i.test(text)) return 'miss';
  if (kind === 'warn') return 'dmg-in';
  return 'neutral';
}

export class CombatLog {
  readonly lines: LogLine[] = [];
  private counter = 0;

  push(text: string, kind: 'info' | 'warn' | 'good' | 'combat' | undefined, cat?: MsgCat): LogLine {
    const line: LogLine = { text, cat: classify(text, kind, cat), n: ++this.counter, t: now() };
    this.lines.push(line);
    while (this.lines.length > LOG_MAX_LINES) this.lines.shift();
    return line;
  }

  /** Últimas líneas para el panel compacto. */
  recent(n = LOG_VISIBLE): LogLine[] {
    return this.lines.slice(-n);
  }

  /** Líneas recientes que aún no se han desvanecido (edad menor que `fadeS`). */
  fresh(fadeS: number, n = LOG_VISIBLE): LogLine[] {
    const t = now();
    return this.recent(n).filter((l) => t - l.t < fadeS);
  }

  clear(): void {
    this.lines.length = 0;
  }
}
