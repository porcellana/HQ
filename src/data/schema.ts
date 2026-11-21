/**
 * TIPOS DEL CONTENIDO DEL JUEGO
 * ------------------------------
 * Todo lo que hay en src/data/** debe cumplir estos tipos. Si añades un
 * archivo nuevo en una carpeta de datos, el registro (registry.ts) lo carga
 * automáticamente: no hace falta tocar el motor.
 *
 * Consejo: en los archivos .ts usa `satisfies ZoneDef` (o el tipo que toque)
 * para que el editor te avise de errores mientras escribes.
 */

/** Definición de un tipo de casilla del mapa. */
export interface TileDef {
  /** Identificador único, p. ej. "hierba". */
  id: string;
  /** Carácter que la representa en los mapas ASCII. */
  char: string;
  /** Nombre legible (para depuración y descripciones). */
  name: string;
  /** ¿Se puede caminar por ella? */
  walkable: boolean;
  /** ¿Bloquea la línea de visión? (muros, árboles...) */
  blocksSight: boolean;
  /** Id del generador de sprite en src/gfx/tiles.ts. */
  sprite: string;
  /** Color en el minimapa (CSS). */
  minimap: string;
}

export type ZoneKind = 'town' | 'wild' | 'dungeon' | 'world' | 'interior';

/** Salida de una zona: casilla marcada con un dígito en el mapa ASCII. */
export interface ZoneExitDef {
  /** Id de la zona de destino. */
  to: string;
  /** Dígito de la salida en la zona destino donde aparece el jugador. */
  arrive: string;
  /** Texto opcional al tocarla, p. ej. "Hacia el Bosque Sombrío". */
  label?: string;
  /** Tile que se dibuja en la salida (por defecto `exitTile` de la zona). */
  tile?: string;
}

/**
 * Zona con mapa fijo (pueblos, zonas salvajes, salas de jefe...).
 *
 * El mapa es una lista de filas de texto, todas del mismo ancho.
 * Caracteres especiales además de los de tiles.ts:
 *   '@'      punto de inicio de partida nueva (se dibuja como `spawnTile`).
 *   '1'..'9' salidas, configuradas en `exits` (se dibujan como `exitTile`).
 */
export interface ZoneDef {
  id: string;
  name: string;
  kind: ZoneKind;
  /** Nivel orientativo de la zona (para encuentros y avisos). */
  level: number;
  map: string[];
  /** Tile usado bajo '@' y bajo las salidas. Por defecto "camino". */
  exitTile?: string;
  spawnTile?: string;
  /** Sobrescribe el significado de caracteres sólo en esta zona: { "x": "id_de_tile" }. */
  legend?: Record<string, string>;
  exits?: Record<string, ZoneExitDef>;
  /** Descripción que se muestra al llegar por primera vez. */
  description?: string;
  /** Oscuridad ambiental 0 (pleno día) .. 1 (negro). */
  darkness?: number;
}
