/**
 * Dados al estilo D&D: "1d20", "2d6+3", "1d8-1", "4".
 * Toda tirada devuelve el detalle para poder animarla en pantalla.
 */
import { Rng } from '@/engine/rng';

export interface DiceExpr {
  count: number;
  sides: number;
  modifier: number;
}

export interface DiceResult {
  expr: string;
  rolls: number[];
  modifier: number;
  total: number;
}

const DICE_RE = /^\s*(?:(\d*)d(\d+))?\s*([+-]\s*\d+)?\s*$/i;

/** Convierte "2d6+3" en {count:2, sides:6, modifier:3}. Lanza error si no es válido. */
export function parseDice(expr: string): DiceExpr {
  const trimmed = expr.trim();
  if (/^[+-]?\d+$/.test(trimmed)) return { count: 0, sides: 0, modifier: parseInt(trimmed, 10) };
  const m = DICE_RE.exec(trimmed);
  if (!m || m[2] === undefined) throw new Error(`Expresión de dados no válida: "${expr}"`);
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
  if (count < 0 || count > 100 || sides < 1 || sides > 1000) throw new Error(`Dados fuera de rango: "${expr}"`);
  return { count, sides, modifier };
}

/** Tira una expresión de dados. `extraMod` se suma al modificador (p. ej. bono de característica). */
export function roll(rng: Rng, expr: string | DiceExpr, extraMod = 0): DiceResult {
  const d = typeof expr === 'string' ? parseDice(expr) : expr;
  const rolls: number[] = [];
  for (let i = 0; i < d.count; i++) rolls.push(rng.int(1, d.sides));
  const modifier = d.modifier + extraMod;
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { expr: formatDice({ ...d, modifier }), rolls, modifier, total };
}

/** Tira un d20 (opcionalmente con ventaja/desventaja). Devuelve el natural elegido. */
export function rollD20(rng: Rng, mode: 'normal' | 'ventaja' | 'desventaja' = 'normal'): { natural: number; rolls: number[] } {
  const a = rng.int(1, 20);
  if (mode === 'normal') return { natural: a, rolls: [a] };
  const b = rng.int(1, 20);
  return { natural: mode === 'ventaja' ? Math.max(a, b) : Math.min(a, b), rolls: [a, b] };
}

/** Valor medio esperado (útil para balancear y para la IA). */
export function averageDice(expr: string | DiceExpr): number {
  const d = typeof expr === 'string' ? parseDice(expr) : expr;
  return d.count * ((d.sides + 1) / 2) + d.modifier;
}

export function formatDice(d: DiceExpr): string {
  const base = d.count > 0 ? `${d.count}d${d.sides}` : '';
  if (d.modifier === 0) return base || '0';
  const sign = d.modifier > 0 ? '+' : '-';
  return base ? `${base}${sign}${Math.abs(d.modifier)}` : `${d.modifier}`;
}

/** Modificador de característica D&D: (valor - 10) / 2 redondeado hacia abajo. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
