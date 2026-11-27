/**
 * CURVA DE ORO Y XP (v0.9.2)
 *  - Oro: base de la tabla × nivel × (1 + 6 % por nivel sobre el 1) × factor de dificultad.
 *    Factor: enemigo por encima de tu nivel paga más (+12 %/nivel, máx. ×1,5);
 *    muy por debajo, casi nada (×0,25 a −5 niveles o menos).
 *  - XP: la base viene de xpForKill; aquí van los bonos de encuentro (grupos
 *    numerosos +8 % por enemigo a partir del 3.º, máx. +40 %; jefe +25 %).
 *  - Venta: 35 % del valor (+3 %/mod. CAR, 20-50 %). Los precios de compra
 *    escalan con el valor del objeto; las mejoras y la posada son los
 *    sumideros principales de oro.
 */
export function goldLevelScale(level: number): number {
  return Math.max(1, level) * (1 + 0.06 * (Math.max(1, level) - 1));
}

export function goldDifficulty(enemyLevel: number, playerLevel: number | undefined): number {
  if (playerLevel === undefined) return 1;
  const d = enemyLevel - playerLevel;
  if (d >= 0) return Math.min(1.5, 1 + 0.12 * d);
  if (d <= -5) return 0.25;
  return 1 + 0.15 * d; // -1 → 0,85 … -4 → 0,4
}

/** Multiplicador de XP por encuentro (nº de enemigos vencidos y jefes). */
export function encounterXpBonus(kills: number, boss: boolean): number {
  return 1 + Math.min(0.4, 0.08 * Math.max(0, kills - 2)) + (boss ? 0.25 : 0);
}

/** Coste de mejorar un objeto de +n a +n+1 (máx. +3). */
export function upgradeCost(value: number, plus: number): number {
  return Math.round(Math.max(20, value * 0.6) * (plus + 1) * (1 + plus * 0.5));
}
export const MAX_PLUS = 3;

/** Precio de una bolsa misteriosa según el nivel de la tienda. */
export function gamblePrice(level: number): number {
  return Math.round(40 + level * level * 6 + level * 20);
}
