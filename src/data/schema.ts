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
  /** Puerta de un edificio: no muestra flecha en el borde, sólo su nombre al verla. */
  door?: boolean;
  /** Sólo se puede cruzar con esta bandera de historia puesta. */
  requiresFlag?: string;
  /** Mensaje si está cerrada. */
  lockedText?: string;
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
  /** Encuentros aleatorios (zonas salvajes). Ver EncounterTable. */
  encounters?: EncounterTable;
  /** XP por descubrir la zona la primera vez (por defecto 20 × nivel). */
  discoverXp?: number;
  /** Cofres, trampas y nodos de mineral colocados en el mapa. */
  features?: ZoneFeature[];
  /** Jefe que aparece en esta zona (salas de jefe de mazmorra). */
  bossSpawn?: { enemy: string; x: number; y: number; guards?: Array<{ enemy: string; x: number; y: number }> };
  /** Rellenado por el generador: a qué mazmorra y piso pertenece la zona. */
  dungeon?: { id: string; floor: number | 'jefe'; run: number };
}

// ===========================================================================
// MAZMORRAS, COFRES, TRAMPAS Y MINERÍA
// ===========================================================================

export type TrapType = 'pinchos' | 'dardos' | 'fuego';
export type OreType = 'hierro' | 'plata' | 'gema';

/** Elemento interactivo de una zona. */
export type ZoneFeature =
  /** Cofre: se abre tocándolo desde una casilla adyacente. `locked`: hay que forzarlo. */
  | { kind: 'cofre'; x: number; y: number; locked?: boolean; loot?: string; level?: number }
  /** Trampa oculta: se detecta con SAB al acercarse y se desactiva con DES. */
  | { kind: 'trampa'; x: number; y: number; trap: TrapType; level?: number }
  /** Nodo de mineral: hace falta un pico de nivel suficiente. */
  | { kind: 'mineral'; x: number; y: number; ore: OreType };

/** Definición de un tipo de trampa (data/config/traps.ts). */
export interface TrapDef {
  id: TrapType;
  name: string;
  /** CD base para detectar (SAB) y desactivar (DES); se suma la mitad del nivel. */
  dc: number;
  damage: string;
  damageType: DamageType;
  /** Salvación para recibir la mitad al pisarla. */
  save: AbilityKey;
  applyStatus?: StatusApply;
  sprite: string;
}

/** Definición de un mineral (data/config/ores.ts). */
export interface OreDef {
  id: OreType;
  name: string;
  /** Objeto que da (data/items). */
  item: string;
  /** Nivel de pico necesario. */
  tier: number;
  /** Golpes (turnos) para agotarlo. */
  hits: number;
  qty: [number, number];
  xp: number;
  sprite: string;
}

/**
 * Mazmorra procedural. Cada piso se genera con una semilla (partida + id + piso
 * + reinicio) y el último enlaza con la sala del jefe, que es un mapa fijo.
 */
export interface DungeonDef {
  id: string;
  name: string;
  description: string;
  /** Nivel del primer piso; cada piso suma `levelPerFloor` (por defecto 1). */
  level: number;
  levelPerFloor?: number;
  floors: number;
  width: number;
  height: number;
  /** Número de salas por piso [mín, máx]. */
  rooms: [number, number];
  wallTile: string;
  floorTile: string;
  darkness: number;
  /** Salida a la superficie desde el primer piso (y desde la sala del jefe). */
  surface: { zone: string; arrive: string };
  /** Encuentros por piso (si hay menos que pisos, se repite el último). */
  floorEncounters: EncounterTable[];
  chestLoot: string;
  chestsPerFloor: [number, number];
  /** Probabilidad 0..1 de que un cofre esté cerrado con llave. */
  lockedChance: number;
  trapsPerFloor: [number, number];
  traps: TrapType[];
  oresPerFloor: [number, number];
  ores: OreType[];
  boss: {
    enemy: string;
    /** Mapa fijo: '1' escaleras de subida, '3' salida a la superficie, 'X' posición del jefe. */
    map: string[];
    /** Encuentros extra en la sala del jefe (opcional). */
    guards?: Array<{ enemy: string; x: number; y: number }>;
  };
  /** Bandera necesaria para entrar (si no, muestra `lockedText`). */
  requiresFlag?: string;
  lockedText?: string;
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
  /** Bonificador fijo a la CA por entrenamiento de la clase (se suma al del equipo). */
  armorBonus: number;
  /** Ataque desarmado (si no lleva arma equipada). */
  unarmed?: { name: string; dice: string; stat: AbilityKey; damageType: DamageType };
  /** Equipo y objetos con los que empieza. */
  startingItems: StartingItem[];
  /** Competencias en habilidades sociales (suman el bonificador de competencia). */
  skillProficiencies?: SkillKey[];
  /** Rango de crítico natural (20 = sólo 20; 19 = 19-20). */
  critRange: number;
  startingGold: number;
  /** Rasgos pasivos descritos al jugador. */
  traits: string[];
  look: ClassLook;
  skills: SkillDef[];
}

// ===========================================================================
// ENEMIGOS Y ENCUENTROS
// ===========================================================================

export type EnemyFamily = 'goblinoide' | 'no-muerto' | 'bestia' | 'araña' | 'orco' | 'humano';

/**
 * Comportamiento:
 *  - melee: se acerca y ataca cuerpo a cuerpo.
 *  - ranged: mantiene la distancia y dispara.
 *  - caster: lanza hechizos (con recarga) y si no, ataca.
 *  - skirmisher: rápido (2 casillas por turno), rodea y muerde.
 *  - boss: como melee/caster, con fases al bajar de vida.
 */
export type EnemyAI = 'melee' | 'ranged' | 'caster' | 'skirmisher' | 'boss';

export interface EnemyAttack {
  name: string;
  /** Bonificador al ataque (d20 + toHit contra la CA del jugador). */
  toHit: number;
  dice: string;
  damageType: DamageType;
  /** 1 = cuerpo a cuerpo. */
  range: number;
  applyStatus?: StatusApply;
}

export interface EnemySpell {
  id: string;
  name: string;
  kind: 'damage' | 'heal' | 'summon';
  dice?: string;
  damageType?: DamageType;
  range: number;
  /** Radio de área alrededor del objetivo (0 = un objetivo). */
  radius?: number;
  /** Si existe, el jugador tira salvación de `save` contra `dc` (mitad de daño si la supera). */
  save?: AbilityKey;
  dc?: number;
  applyStatus?: StatusApply;
  summon?: { enemy: string; count: number };
  cooldown: number;
}

export interface BossPhase {
  /** Se activa cuando la vida baja de esta fracción (0..1). */
  hpBelow: number;
  message: string;
  summon?: { enemy: string; count: number };
  /** Bonificadores permanentes a partir de esta fase. */
  toHitBonus?: number;
  damageBonus?: number;
  /** Se cura esta fracción de su vida máxima. */
  heal?: number;
}

export interface EnemyLook {
  /** Forma de src/gfx/monsters.ts: goblin, esqueleto, lobo, rata, araña, humanoide... */
  shape: string;
  /** Capa opcional (de OVERLAYS en sprites.ts) para humanoides: picaro, mago, guerrero... */
  overlay?: string;
  main: string;
  dark: string;
  accent: string;
  eye?: string;
  /** Corona o aura de jefe. */
  crown?: boolean;
}

export interface EnemyDef {
  id: string;
  name: string;
  family: EnemyFamily;
  level: number;
  /** Vida en dados, p. ej. "2d6+2" (cada enemigo tira la suya). */
  hp: string;
  ac: number;
  /** Casillas por turno (1 normal, 2 rápido). */
  speed: number;
  /** Lento: sólo actúa uno de cada dos turnos (zombis). */
  slow?: boolean;
  /** Radio de visión en casillas. */
  sight: number;
  ai: EnemyAI;
  attack: EnemyAttack;
  spells?: EnemySpell[];
  phases?: BossPhase[];
  /** Bonificadores de salvación; por defecto nivel/2. */
  saves?: Partial<Record<AbilityKey, number>>;
  /** Mitad de daño de estos tipos. */
  resist?: DamageType[];
  /** Doble daño de estos tipos. */
  vulnerable?: DamageType[];
  /** Estados que no le afectan. */
  immune?: StatusId[];
  /** XP base (se ajusta por diferencia de nivel). */
  xp: number;
  boss?: boolean;
  description: string;
  look: EnemyLook;
  /** Tabla de botín (Hito 4). */
  lootTable?: string;
  /** Criatura salvaje que se puede vincular como mascota (v0.3; lo rellena el motor). */
  pet?: { species: string; level: number };
}

/** Encuentros aleatorios de una zona salvaje. */
export interface EncounterTable {
  /** Grupos que aparecen al entrar en la zona. */
  initial: number;
  /** Probabilidad por paso de que aparezca un grupo nuevo. */
  perStepChance: number;
  /** Máximo de enemigos vivos a la vez. */
  maxActive: number;
  /** Distancia mínima al jugador para aparecer. */
  minDistance?: number;
  groups: Array<{ enemy: string; weight: number; min?: number; max?: number }>;
}

// ===========================================================================
// OBJETOS, RAREZAS Y BOTÍN
// ===========================================================================

/** Ranuras de equipo. Los accesorios ocupan accesorio1 y accesorio2. */
export type EquipSlot =
  | 'cabeza' | 'pecho' | 'manos' | 'piernas' | 'pies'
  | 'arma' | 'secundaria' | 'herramienta' | 'accesorio1' | 'accesorio2';
export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'cabeza', 'pecho', 'manos', 'piernas', 'pies', 'arma', 'secundaria', 'herramienta', 'accesorio1', 'accesorio2',
];

export type ItemKind = 'arma' | 'armadura' | 'secundaria' | 'herramienta' | 'accesorio' | 'consumible' | 'material';
export type WeaponType = 'espada' | 'hacha' | 'arco' | 'baston' | 'daga' | 'maza';
/** Ranura "lógica" del objeto (accesorio vale para accesorio1 y accesorio2). */
export type ItemSlot = Exclude<EquipSlot, 'accesorio1' | 'accesorio2'> | 'accesorio';

/** Estadísticas que pueden dar los objetos (características y extras). */
export type BonusStat = AbilityKey | 'ca' | 'ataque' | 'daño' | 'pv' | 'recurso';

export interface ItemIcon {
  /** Forma de src/gfx/items.ts: espada, hacha, arco, pocion, anillo... */
  shape: string;
  /** Color principal (metal, líquido, gema...). */
  color?: string;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  slot?: ItemSlot;
  description?: string;
  icon: ItemIcon;
  /** Nivel del objeto: limita dónde aparece y escala sus bonos aleatorios. */
  level: number;
  /** Precio base en oro (rareza y ciudad lo multiplican en el Hito 5). */
  value: number;
  /** Se apilan (consumibles y materiales). */
  stackable?: boolean;
  maxStack?: number;
  weapon?: {
    type: WeaponType;
    dice: string;
    stat: AbilityKey;
    damageType: DamageType;
    /** 1 = cuerpo a cuerpo. */
    range: number;
    twoHanded?: boolean;
    critRange?: number;
  };
  /** Armadura o escudo: suma a la CA; `maxDex` limita el bono de DES (pecho). */
  armor?: { ac: number; maxDex?: number };
  /** Bonos fijos del objeto base. */
  stats?: Partial<Record<BonusStat, number>>;
  /** Consumibles. */
  use?: {
    heal?: string;
    restore?: string;
    cleanse?: boolean;
    buff?: { stat: 'ataque' | 'daño' | 'ca'; amount: number; turns: number };
    /** No se puede usar en combate (comida). */
    outOfCombatOnly?: boolean;
    /** Runa de vínculo: intenta vincular a la criatura salvaje más debilitada cerca. */
    bind?: boolean;
  };
  /** Nivel de pico (minería, Hito 6). */
  pickaxeTier?: number;
  /** Nunca recibe bonos aleatorios (pociones, materiales...). */
  plain?: boolean;
}

export type Rarity = 'comun' | 'poco_comun' | 'raro' | 'epico' | 'legendario';

export interface RarityDef {
  id: Rarity;
  name: string;
  color: string;
  /** Bonos aleatorios que recibe el objeto. */
  affixes: number;
  /** Multiplicador de precio. */
  priceMult: number;
  /** Bono extra a daño (armas) o CA (armaduras/escudos). */
  powerBonus: number;
  /** Peso relativo al generar botín (se ajusta por nivel). */
  weight: number;
  /** Nivel mínimo del botín para que pueda salir. */
  minLevel: number;
}

/** Entrada de una tabla de botín. */
export type LootEntry =
  | { item: string; weight: number; min?: number; max?: number }
  /** Objeto de equipo aleatorio de nivel adecuado (con rareza). */
  | { pool: 'equipo' | 'armas' | 'armaduras' | 'accesorios'; weight: number }
  | { nothing: true; weight: number };

export interface LootTableDef {
  id: string;
  /** Número de tiradas en la tabla [mín, máx]. */
  rolls: [number, number];
  /** Oro [mín, máx] multiplicado por el nivel del enemigo. */
  gold?: [number, number];
  /** Probabilidad 0..1 de soltar oro. */
  goldChance?: number;
  entries: LootEntry[];
}

/** Objeto inicial de una clase. */
export interface StartingItem {
  item: string;
  qty?: number;
  equip?: boolean;
}

// ===========================================================================
// PNJ, DIÁLOGOS, TIENDAS Y MISIONES
// ===========================================================================

/** Acción de una opción de diálogo. */
export type DialogAction =
  /** Abre una tienda (data/shops). */
  | { type: 'shop'; shop: string }
  /** Posada: descansar (cura todo, pasa la noche y guarda) por `price` de oro. */
  | { type: 'inn'; price: number }
  /** Templo: curación y purificación por un donativo de `pricePerLevel` × nivel. Fija el punto de reaparición. */
  | { type: 'temple'; pricePerLevel: number }
  /** Muestra las misiones que da o recoge este PNJ. */
  | { type: 'quests' }
  /** Pone una bandera de historia. */
  | { type: 'flag'; flag: string }
  /** El compañero que te acompaña se separa de ti. */
  | { type: 'dismiss' }
  /** Abre el establo de mascotas (y la elección de la mascota inicial). */
  | { type: 'stable' }
  /** Cierra el diálogo. */
  | { type: 'end' };

export interface DialogOption {
  label: string;
  /** Nodo al que salta (en el mismo PNJ). */
  goto?: string;
  action?: DialogAction;
  /** Sólo aparece si esta bandera de historia está puesta (o no, con `!bandera`). */
  ifFlag?: string;
  /** Sólo aparece si la misión está en ese estado. */
  ifQuest?: { quest: string; state: 'disponible' | 'activa' | 'completada' };
  /** Sólo con este trasfondo (o alguno de la lista). La opción se marca con su nombre. */
  ifBackground?: string | string[];
  /** Sólo con esta clase (o alguna de la lista). */
  ifClass?: string | string[];
  /** Sólo si este compañero va contigo. */
  ifCompanion?: string;
  /** Sólo si llevas al menos este oro (para opciones de pago). */
  ifGold?: number;
  /** Sólo si la actitud del PNJ es al menos `min` (ver efecto `attitude`). */
  ifAttitude?: { npc: string; min: number };
  /**
   * Prueba de habilidad: se tira d20 + bonificador contra `dc`. Salta al nodo
   * `success` o `failure` (y a `crit`/`fumble` con un 20 o un 1 naturales, si existen).
   */
  check?: { skill: SkillKey; dc: number; success: string; failure: string; crit?: string; fumble?: string };
}

/**
 * Consecuencia de un diálogo (se aplica al entrar en el nodo). Con `once` en el
 * nodo, sólo la primera vez.
 */
export type DialogEffect =
  | { type: 'gold'; amount: number }
  | { type: 'item'; item: string; qty?: number }
  | { type: 'xp'; amount: number }
  | { type: 'flag'; flag: string; value?: boolean | number | string }
  /** Descuento permanente (porcentaje 0..50) en una tienda. */
  | { type: 'discount'; shop: string; pct: number }
  /** Aparecen enemigos junto a ti y empieza una pelea (cierra el diálogo). */
  | { type: 'fight'; enemy: string; count?: number }
  /** Cambia la aprobación de un compañero (si va contigo). */
  | { type: 'approval'; companion: string; amount: number }
  /** Cambia la actitud de un PNJ hacia ti (se guarda como número). */
  | { type: 'attitude'; npc: string; amount: number }
  /** Recluta a un compañero. */
  | { type: 'recruit'; companion: string }
  /** Curación completa. */
  | { type: 'heal' }
  /** Acepta una misión. */
  | { type: 'quest'; quest: string };

export interface DialogNode {
  /** Texto del PNJ. Si es una lista, se elige uno al azar (rumores). */
  text: string | string[];
  options: DialogOption[];
  /** Consecuencias al llegar a este nodo. */
  effects?: DialogEffect[];
  /** Bandera que impide repetir los efectos (se pone al aplicarlos). */
  once?: string;
}

/** Aspecto de un PNJ (cuerpo humanoide con colores y capa opcional). */
export interface NpcLook {
  overlay?: string;
  cloth: string;
  clothDark: string;
  pants: string;
  hat?: string;
  skin?: string;
  hair?: string;
}

export interface NpcDef {
  id: string;
  name: string;
  /** Profesión o título corto ("Herrera", "Tabernero"). */
  title?: string;
  zone: string;
  x: number;
  y: number;
  look: NpcLook;
  /** Diálogo: nodos por id; empieza en "inicio". */
  dialog: Record<string, DialogNode>;
  /** Mira hacia la izquierda. */
  facingLeft?: boolean;
  /** No aparece si esta bandera está puesta (p. ej. compañero ya reclutado). */
  hideIfFlag?: string;
  /** Sólo aparece si esta bandera está puesta. */
  showIfFlag?: string;
}

/** Entrada del stock de una tienda. */
export type ShopStockEntry =
  /** Objeto concreto (consumibles, picos...). `chance` 0..1 de que esté a la venta. */
  | { item: string; qty?: [number, number]; chance?: number }
  /** Equipo aleatorio (con rareza) de un grupo, de nivel = nivel de la tienda (+/- 1). */
  | { pool: 'equipo' | 'armas' | 'armaduras' | 'accesorios'; count: [number, number] };

export interface ShopDef {
  id: string;
  name: string;
  /** Multiplicador de precio (cada ciudad/tienda tiene el suyo). */
  priceMult: number;
  /** Turnos hasta renovar el stock. */
  restockTurns: number;
  /** Nivel del equipo que vende. */
  level: number;
  stock: ShopStockEntry[];
  /** Tipos de objeto que compra (por defecto, todos). */
  buys?: ItemKind[];
}

export type QuestObjective =
  /** Matar `count` enemigos de un id concreto o de una familia. */
  | { type: 'kill'; enemy?: string; family?: EnemyFamily; count: number; label: string }
  /** Llevar `count` unidades de un objeto al entregar (se consumen). */
  | { type: 'collect'; item: string; count: number; label: string }
  /** Visitar una zona. */
  | { type: 'visit'; zone: string; label: string }
  /** Hablar con un PNJ. */
  | { type: 'talk'; npc: string; label: string };

export interface QuestDef {
  id: string;
  name: string;
  kind: 'principal' | 'secundaria' | 'repetible';
  /** PNJ que la ofrece. */
  giver: string;
  /** PNJ al que se entrega (por defecto el que la da). */
  turnIn?: string;
  description: string;
  /** Texto del PNJ al entregarla. */
  completeText?: string;
  objectives: QuestObjective[];
  rewards: { xp: number; gold: number; items?: Array<{ item: string; qty?: number }>; flag?: string };
  /** Misiones que hay que haber completado antes. */
  requires?: string[];
  /** Sólo disponible si esta bandera de historia está puesta. */
  requiresFlag?: string;
  minLevel?: number;
  /** Repetibles: turnos hasta que se puede volver a coger. */
  cooldownTurns?: number;
}

// ===========================================================================
// IDENTIDAD DEL PERSONAJE (v0.2): HABILIDADES, TRASFONDOS, TALENTOS, COMPAÑEROS
// ===========================================================================

/** Habilidades para pruebas en diálogos (estilo D&D). */
export type SkillKey =
  | 'persuasion' | 'intimidacion' | 'engano' | 'perspicacia' | 'arcanos' | 'atletismo' | 'sigilo' | 'juego_manos';

/** Trasfondo: quién eras antes de ser aventurero. */
export interface BackgroundDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Rasgo descrito al jugador (sabor). */
  feature: string;
  /** Bonificación a características (se suma al crear el personaje). */
  statBonus?: Partial<StatBlock>;
  /** Competencias en habilidades. */
  proficiencies: SkillKey[];
  startingItems?: StartingItem[];
  gold?: number;
  /** No se ofrece al crear (p. ej. el de las partidas antiguas). */
  hidden?: boolean;
}

/**
 * Efecto declarativo de un talento. El motor (game.ts) los consulta en sus
 * "ganchos": al atacar, al matar, al recibir un ataque, al lanzar habilidades...
 */
export type TalentEffect =
  /** Bono pasivo (como el de un objeto). */
  | { type: 'stat'; stat: BonusStat; amount: number }
  /** Al matar a un enemigo: recuperas recurso/vida, te ocultas o atacas a otro adyacente. */
  | { type: 'onKill'; restore?: number; heal?: number; stealth?: number; cleave?: boolean }
  /** Tus críticos con arma aplican un estado. */
  | { type: 'onCrit'; status: StatusApply }
  /** Rango de crítico del arma −N (19-20, 18-20…). */
  | { type: 'critRange'; amount: number }
  /** Si un enemigo falla un ataque cuerpo a cuerpo contra ti, puedes devolver el golpe. */
  | { type: 'counter'; chance: number }
  /** Probabilidad de esquivar por completo un golpe que te iba a dar. */
  | { type: 'dodge'; chance: number }
  /** Quien te golpea cuerpo a cuerpo recibe daño. */
  | { type: 'thorns'; dice: string; damageType: DamageType }
  /** Con poca vida (≤ threshold %) haces más daño con el arma. */
  | { type: 'berserk'; threshold: number; damage: number }
  /** Tus ataques con arma pueden envenenar. */
  | { type: 'poisonStrike'; chance: number; turns: number }
  /** El primer ataque desde sigilo aturde 1 turno. */
  | { type: 'stealthStun' }
  /** Recuperas vida al dañar con el arma (porcentaje del daño). */
  | { type: 'lifesteal'; pct: number }
  /** En combate recuperas `amount` PV cada `every` turnos. */
  | { type: 'regen'; every: number; amount: number }
  /** Inmune a un estado. */
  | { type: 'immune'; status: StatusId }
  /** +daño a los hechizos de un tipo. */
  | { type: 'spellPower'; damageType: DamageType; amount: number }
  /** Modifica una habilidad de clase. */
  | {
      type: 'skillMod';
      skill: string;
      extraDice?: string;
      damageType?: DamageType;
      applyStatus?: StatusApply;
      costDelta?: number;
      radiusDelta?: number;
      hitsDelta?: number;
      /** Salta a `bounce` enemigos más cercanos (hechizos de un objetivo). */
      bounce?: number;
      /** Deja el suelo ardiendo N turnos donde impacta (hechizos de área). */
      burnGround?: number;
    }
  /** Tus curaciones dañan a los no-muertos cercanos. */
  | { type: 'healSmite'; dice: string; radius: number };

export interface TalentDef {
  id: string;
  /** Clase a la que pertenece ("todas" = genérico). */
  classId: string;
  /** Rama (Piromante, Berserker...). */
  branch: string;
  name: string;
  icon: string;
  description: string;
  /** Nivel mínimo para que se ofrezca. */
  minLevel: number;
  /** Se puede elegir varias veces (talentos genéricos de relleno). */
  repeatable?: boolean;
  /** Requiere tener antes otro talento. */
  requires?: string;
  effects: TalentEffect[];
}

/** Momentos en los que un compañero comenta algo. */
export type CompanionEvent = 'recluta' | 'mazmorra' | 'jefe' | 'nivel' | 'aprueba' | 'desaprueba' | 'caido' | 'victoria' | 'mata';

export interface CompanionDef {
  id: string;
  name: string;
  title: string;
  /** PNJ con el que se habla para reclutarle (y su diálogo cuando va contigo). */
  npc: string;
  look: NpcLook;
  /** Forma de luchar. */
  role: 'melee' | 'ranged';
  hpBase: number;
  hpPerLevel: number;
  ac: number;
  attack: { name: string; toHit: number; dice: string; damageType: DamageType; range: number };
  /** Frases por momento (se elige una al azar). */
  comments: Partial<Record<CompanionEvent, string[]>>;
  /** Qué le gusta y qué no (texto para el jugador). */
  likes: string;
}

// ===========================================================================
// MASCOTAS (v0.3): criaturas que te acompañan, aprenden y evolucionan
// ===========================================================================

/** Tipos elementales de las mascotas (ver data/config/pet_types.ts). */
export type PetType = 'fuego' | 'agua' | 'planta' | 'tierra' | 'sombra' | 'luz';

/** Estadísticas de una mascota: vida, ataque, defensa, velocidad y magia. */
export interface PetStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  mag: number;
}

/** Aspecto: forma de src/gfx/pets.ts + colores. */
export interface PetLook {
  shape: string;
  main: string;
  dark: string;
  accent: string;
  eye?: string;
}

export interface PetSpeciesDef {
  id: string;
  name: string;
  type: PetType;
  /** Etapa evolutiva (1 = cría). */
  stage: 1 | 2 | 3;
  description: string;
  /** Estadísticas a nivel 1 y crecimiento por nivel. */
  base: PetStats;
  growth: PetStats;
  /** Movimientos que aprende al llegar a cada nivel (los de nivel 1 los sabe de serie). */
  learnset: Array<{ level: number; move: string }>;
  /** Evoluciona a esta especie al llegar a este nivel. */
  evolvesTo?: { species: string; level: number };
  rarity: 'comun' | 'raro' | 'epico';
  /** Zonas (ids de zona o de mazmorra) donde aparece en estado salvaje. */
  habitats: string[];
  /** ¿Se puede vincular con una Runa de vínculo? */
  catchable: boolean;
  /** Se ofrece como mascota inicial en el establo. */
  starter?: boolean;
  look: PetLook;
}

/** Movimiento de mascota. */
export interface PetMoveDef {
  id: string;
  name: string;
  icon: string;
  type: PetType;
  kind: 'daño' | 'curar' | 'proteger' | 'mejora';
  description: string;
  /** Daño: dados + 1/3 de `stat`; multiplicado por la eficacia de tipo. */
  dice?: string;
  stat?: 'atk' | 'mag';
  /** Alcance en casillas (1 = cuerpo a cuerpo). */
  range: number;
  /** Radio de área alrededor del objetivo. */
  radius?: number;
  /** Probabilidad de acertar 0..1 (por defecto 0,9). */
  accuracy?: number;
  applyStatus?: StatusApply;
  /** Curar: dados + 1/3 de la magia, al jugador (o a la mascota si `self`). */
  heal?: string;
  self?: boolean;
  /** Proteger: +CA al jugador durante unos turnos. */
  shield?: { amount: number; turns: number };
  /** Mejora temporal de la propia mascota. */
  buff?: { stat: keyof PetStats; amount: number; turns: number };
  /** Turnos de recarga. */
  cooldown: number;
}

/** Tabla de tipos: contra qué es fuerte (x2) y débil (x0,5) cada tipo. */
export interface PetTypeDef {
  id: PetType;
  name: string;
  icon: string;
  color: string;
  strong: PetType[];
  weak: PetType[];
}
