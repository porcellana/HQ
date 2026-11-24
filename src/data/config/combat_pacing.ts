/**
 * RITMO DEL COMBATE CINEMATOGRÁFICO (todo en segundos). Ajusta a tu gusto.
 *
 * Cada ataque o hechizo se presenta así:
 *   0 ──── lead ────► se resuelve (impacto, daño, partículas, sonido)
 *   La tarjeta de duelo muestra el d20 rodando durante `lead` y después el
 *   resultado. El resto de actores esperan según el modo:
 *     - paso:   nadie actúa hasta que pulses «▶ Siguiente».
 *     - lenta:  `perActor` segundos por acción de cada actor.
 *     - normal: más ágil, con los efectos básicos.
 */
export type SpeedKey = 'paso' | 'lenta' | 'normal';

export interface PacingDef {
  /** Segundos desde que empieza la acción hasta su impacto (d20 rodando). */
  lead: number;
  /** Pausa tras la acción de cada actor (lenta y normal; en «paso» se pulsa Siguiente). */
  perActor: number;
  /** Pausa tras tu propia acción antes de que actúen los demás. */
  afterPlayer: number;
  /** Pausa tras una acción sin ataque (solo moverse, esperar). */
  moveDelay: number;
  /** Tiempo mínimo antes de poder pulsar «Siguiente» (paso a paso). */
  nextHold: number;
  /** Cuánto se queda la tarjeta tras revelar el resultado (milisegundos). */
  cardHoldMs: number;
}

export const PACING: Record<SpeedKey, PacingDef> = {
  paso: { lead: 0.8, perActor: 0, afterPlayer: 2.1, moveDelay: 0.7, nextHold: 1.1, cardHoldMs: 8000 },
  lenta: { lead: 0.75, perActor: 2.0, afterPlayer: 2.0, moveDelay: 0.9, nextHold: 1.0, cardHoldMs: 1200 },
  normal: { lead: 0.3, perActor: 0.85, afterPlayer: 0.7, moveDelay: 0.25, nextHold: 0.5, cardHoldMs: 650 },
};

/** Factor de duración de los efectos visuales (números, proyectiles, ondas) en combate cinematográfico. */
export const FX_LIFE_MUL = 1.7;
/** Con 3 o más actores en la cola se ofrece «Saltar ronda». */
export const SKIP_MIN_ACTORS = 3;
