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

export const CURRENT_SAVE_VERSION = 8;

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
  /** v3 → v4 (Hito 5): misiones y tiendas. */
  3: (s) => ({ ...s, quests: s['quests'] ?? {}, shops: s['shops'] ?? {} }),
  /** v4 → v5 (Hito 6): mazmorras, cofres abiertos, trampas y vetas usadas. */
  4: (s) => ({ ...s, world: s['world'] ?? { dungeons: {}, features: {} } }),
  /** v5 → v6 (Hito 7): estadísticas de la partida para la pantalla final. */
  5: (s) => ({ ...s, record: s['record'] ?? { kills: 0, bosses: 0, deaths: 0, victoryTurn: 0, victoryTime: 0 } }),
  /**
   * v6 → v7 (v0.2, Fase A): trasfondo, talentos y compañeros. Los personajes
   * antiguos son "aventureros" sin trasfondo y reciben un talento por elegir por
   * cada nivel por encima del 1.
   */
  6: (s) => {
    const player = { ...(s['player'] as Record<string, unknown>) };
    player['background'] ??= 'aventurero';
    player['talents'] ??= [];
    player['talentChoices'] ??= Math.max(0, Number(player['level'] ?? 1) - 1);
    return { ...s, player, party: s['party'] ?? { active: null, hp: 0, down: false, approval: {} } };
  },
  /** v7 → v8 (v0.3): mascotas. Sin mascota, establo vacío y sin bestiario. */
  7: (s) => ({
    ...s,
    pets: s['pets'] ?? { active: null, stable: [], starterChosen: false, seen: [], caught: [] },
  }),
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
