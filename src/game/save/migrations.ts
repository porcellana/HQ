/**
 * MIGRACIONES DE PARTIDAS GUARDADAS
 * ---------------------------------
 * Cada vez que cambie la forma de GameState:
 *   1. Sube CURRENT_SAVE_VERSION en 1.
 *   2. Añade en MIGRATIONS una función con clave = versión ANTERIOR que
 *      transforme los datos viejos en los nuevos.
 *
 * Ejemplo (de la v1 a la v2, añadiendo un inventario vacío):
 *   1: (s) => ({ ...s, inventory: [] }),
 *
 * Las migraciones se encadenan: un save v1 cargado con la v4 pasa por 1→2→3→4.
 * Nunca borres migraciones antiguas.
 */

export const CURRENT_SAVE_VERSION = 3;

/** Datos de partida sin tipar (pueden venir de cualquier versión antigua). */
export type RawSave = Record<string, unknown>;
export type Migration = (data: RawSave) => RawSave;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  /**
   * v1 → v2 (Hito 2): aparecen las clases y las características.
   * Los personajes "aventurero" del Hito 1 pasan a ser guerreros.
   * (Los números se escriben aquí a mano a propósito: una migración no debe
   * depender de datos de contenido que pueden cambiar en el futuro.)
   */
  1: (s) => {
    const player = { ...(s['player'] as Record<string, unknown>) };
    if (!player['classId'] || player['classId'] === 'aventurero') player['classId'] = 'guerrero';
    player['stats'] ??= { FUE: 15, DES: 12, CON: 14, INT: 8, SAB: 10, CAR: 11 };
    player['attributePoints'] ??= 0;
    return { ...s, player };
  },
  /**
   * v2 → v3 (Hito 4): inventario y equipo. La partida recibe el equipo inicial
   * de su clase la próxima vez que se cargue (needsStarterKit).
   */
  2: (s) => {
    const player = { ...(s['player'] as Record<string, unknown>) };
    player['inventory'] ??= [];
    player['equipment'] ??= {};
    player['needsStarterKit'] = true;
    return { ...s, player };
  },
};

export class SaveMigrationError extends Error {}

/**
 * Lleva `data` desde `fromVersion` hasta `toVersion` aplicando las migraciones
 * en orden. Lanza SaveMigrationError si falta algún paso o si el save es de
 * una versión más nueva que el juego.
 */
export function migrate(
  data: RawSave,
  fromVersion: number,
  toVersion: number = CURRENT_SAVE_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): RawSave {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new SaveMigrationError(`Versión de guardado no válida: ${fromVersion}`);
  }
  if (fromVersion > toVersion) {
    throw new SaveMigrationError(
      `La partida es de una versión más nueva del juego (save v${fromVersion}, juego v${toVersion}). Actualiza el juego.`,
    );
  }
  let current = data;
  for (let v = fromVersion; v < toVersion; v++) {
    const step = migrations[v];
    if (!step) throw new SaveMigrationError(`Falta la migración de la versión ${v} a la ${v + 1}`);
    current = step(structuredClone(current));
  }
  return current;
}
