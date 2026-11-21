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

// ===========================================================================
// PERSONAJES Y HABILIDADES
// ===========================================================================

/** Características D&D: Fuerza, Destreza, Constitución, Inteligencia, Sabiduría, Carisma. */
export type AbilityKey = 'FUE' | 'DES' | 'CON' | 'INT' | 'SAB' | 'CAR';
export const ABILITY_KEYS: readonly AbilityKey[] = ['FUE', 'DES', 'CON', 'INT', 'SAB', 'CAR'];
export type StatBlock = Record<AbilityKey, number>;

export type DamageType =
  | 'cortante' | 'perforante' | 'contundente'
  | 'fuego' | 'frio' | 'rayo' | 'veneno' | 'sagrado' | 'necrotico' | 'arcano';

/** Estados alterados. */
export type StatusId = 'veneno' | 'aturdido' | 'sangrado' | 'quemado' | 'ralentizado';

/** Aplicar un estado con cierta probabilidad durante N turnos. */
export interface StatusApply {
  id: StatusId;
  /** Probabilidad 0..1 (por defecto 1). */
  chance?: number;
  turns: number;
}

/**
 * Efecto de una habilidad. El motor de combate (Hito 3) interpreta cada tipo:
 *  - attack: ataque con arma (tirada d20 contra CA) con daño extra.
 *  - spell:  daño mágico; con `save` el objetivo tira salvación (mitad si la supera),
 *            sin `save` impacta automáticamente; con `radius` afecta a un área.
 *  - heal:   curación.
 *  - buff:   bonificación temporal.
 *  - stealth: el lanzador se oculta (ventaja en el siguiente ataque, los enemigos lo pierden).
 *  - cleanse: elimina estados alterados.
 */
export type SkillEffect =
  | { type: 'attack'; extraDice?: string; toHitBonus?: number; critRange?: number; hits?: number; allAdjacent?: boolean; applyStatus?: StatusApply }
  | { type: 'spell'; dice: string; stat: AbilityKey; damageType: DamageType; save?: AbilityKey; radius?: number; hits?: number; applyStatus?: StatusApply }
  | { type: 'heal'; dice: string; stat?: AbilityKey; perLevel?: number }
  | { type: 'buff'; stat: 'ataque' | 'daño' | 'ca'; amount: number; turns: number }
  | { type: 'stealth'; turns: number }
  | { type: 'cleanse' };

export interface SkillDef {
  id: string;
  name: string;
  /** Emoji o símbolo para el botón. */
  icon: string;
  description: string;
  /** Nivel al que se desbloquea. */
  unlockLevel: number;
  /** Coste de recurso (maná/vigor/fe...). */
  cost: number;
  /** Turnos de espera tras usarla. */
  cooldown: number;
  target: 'self' | 'enemy' | 'area';
  /** Alcance en casillas (1 = cuerpo a cuerpo). */
  range: number;
  effects: SkillEffect[];
}

/** Aspecto del personaje: plantilla de sprite + colores de ropa. */
export interface ClassLook {
  /** Plantilla de src/gfx/sprites.ts (guerrero, picaro, mago, clerigo...). */
  overlay: string;
  cloth: string;
  clothDark: string;
  pants: string;
  /** Color del casco/capucha/sombrero. */
  hat: string;
}

export interface ClassDef {
  id: string;
  name: string;
  /** Lema corto, p. ej. "Muro de acero". */
  role: string;
  description: string;
  baseStats: StatBlock;
  /** Características principales (se resaltan y se sugieren al subir de nivel). */
  primary: AbilityKey[];
  /** Dado de golpe: 10 guerrero, 8 pícaro/clérigo, 6 mago. */
  hitDie: number;
  /** Recurso para habilidades. */
  resource: { name: string; short: string; base: number; perLevel: number; stat: AbilityKey | null; color: string };
  /** Bonificador a la CA sin armadura (se sumará a la del equipo en el Hito 4). */
  armorBonus: number;
  /** Arma inicial (dados de daño y característica de ataque) hasta tener inventario. */
  weapon: { name: string; dice: string; stat: AbilityKey; damageType: DamageType; range: number };
  /** Rango de crítico natural (20 = sólo 20; 19 = 19-20). */
  critRange: number;
  startingGold: number;
  /** Rasgos pasivos descritos al jugador. */
  traits: string[];
  look: ClassLook;
  skills: SkillDef[];
}
