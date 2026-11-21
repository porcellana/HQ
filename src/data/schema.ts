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
}

export interface DialogNode {
  /** Texto del PNJ. Si es una lista, se elige uno al azar (rumores). */
  text: string | string[];
  options: DialogOption[];
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
  minLevel?: number;
  /** Repetibles: turnos hasta que se puede volver a coger. */
  cooldownTurns?: number;
}
