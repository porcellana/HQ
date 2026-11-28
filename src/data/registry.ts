/**
 * REGISTRO DE CONTENIDO
 * ---------------------
 * Carga automáticamente TODOS los archivos .ts/.json de cada carpeta de datos
 * (gracias a import.meta.glob de Vite). Para añadir contenido basta con crear
 * un archivo nuevo en la carpeta correspondiente con un `export default`
 * (un objeto o una lista de objetos). El motor sólo consulta este registro.
 */
import type { ItemSetDef, BiomeDef, DungeonDef, OreDef, TrapDef, ClassDef, EnemyDef, ItemDef, LootTableDef, NpcDef, QuestDef, Rarity, RarityDef, ShopDef, TileDef, ZoneDef, BackgroundDef, TalentDef, CompanionDef, TravelEventDef, PetMoveDef, PetSpeciesDef, PetType, PetTypeDef } from './schema';
import { PET_NATURES } from './config/pet_natures';
import { FAMILY_TYPE, PET_TYPES } from './config/pet_types';
import rarityList from './config/rarities';
import trapList from './config/traps';
import oreList from './config/ores';
import tileList from './config/tiles';

type Module = { default: unknown };

/** Aplana los export default de un glob (admite objeto suelto o lista). */
function collect<T extends { id: string }>(modules: Record<string, unknown>, kind: string): Map<string, T> {
  const out = new Map<string, T>();
  for (const [path, mod] of Object.entries(modules)) {
    const value = (mod as Module).default;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items as T[]) {
      if (!item || typeof item.id !== 'string') {
        console.error(`[datos] ${kind}: elemento sin "id" en ${path}`);
        continue;
      }
      if (out.has(item.id)) console.error(`[datos] ${kind}: id duplicado "${item.id}" en ${path}`);
      out.set(item.id, item);
    }
  }
  return out;
}

// --- Tiles -----------------------------------------------------------------
export const TILES: ReadonlyMap<string, TileDef> = new Map(tileList.map((t) => [t.id, t]));
export const TILE_BY_CHAR: ReadonlyMap<string, TileDef> = new Map(tileList.map((t) => [t.char, t]));

// --- Zonas con mapa fijo (pueblos, ciudades, zonas salvajes) --------------
export const ZONES: ReadonlyMap<string, ZoneDef> = collect<ZoneDef>(
  {
    ...import.meta.glob('./towns/*.{ts,json}', { eager: true }),
    ...import.meta.glob('./wilds/*.{ts,json}', { eager: true }),
  },
  'zona',
);

/** Zona donde empieza una partida nueva. */
export const START_ZONE_ID = 'aldea_brumaroja';

/**
 * Zonas generadas en tiempo de ejecución (pisos de mazmorra). El juego registra
 * aquí un "resolutor" que las crea a partir de la semilla de la partida.
 */
let dynamicZones: ((id: string) => ZoneDef | undefined) | null = null;
export function setDynamicZoneResolver(fn: ((id: string) => ZoneDef | undefined) | null): void {
  dynamicZones = fn;
}

export function getZoneDef(id: string): ZoneDef | undefined {
  return ZONES.get(id) ?? dynamicZones?.(id);
}

// --- Clases jugables --------------------------------------------------------
export const CLASSES: ReadonlyMap<string, ClassDef> = collect<ClassDef>(
  import.meta.glob('./classes/*.{ts,json}', { eager: true }),
  'clase',
);

/** Orden en la pantalla de creación (las que no estén aquí van al final). */
const CLASS_ORDER = ['guerrero', 'picaro', 'mago', 'clerigo'];
export function classList(): ClassDef[] {
  const rank = (id: string) => {
    const i = CLASS_ORDER.indexOf(id);
    return i < 0 ? 99 : i;
  };
  return [...CLASSES.values()].sort((a, b) => rank(a.id) - rank(b.id));
}

export function getClass(id: string): ClassDef {
  const c = CLASSES.get(id) ?? CLASSES.get('guerrero') ?? [...CLASSES.values()][0];
  if (!c) throw new Error('No hay ninguna clase definida en src/data/classes');
  return c;
}

// --- Enemigos -----------------------------------------------------------------
export const ENEMIES: ReadonlyMap<string, EnemyDef> = collect<EnemyDef>(
  import.meta.glob('./enemies/*.{ts,json}', { eager: true }),
  'enemigo',
);

export function getEnemy(id: string): EnemyDef | undefined {
  return ENEMIES.get(id);
}

// --- Objetos, rarezas y botín --------------------------------------------------
export const ITEMS: ReadonlyMap<string, ItemDef> = collect<ItemDef>(
  import.meta.glob('./items/*.{ts,json}', { eager: true }),
  'objeto',
);
export function getItem(id: string): ItemDef | undefined {
  return ITEMS.get(id);
}

export const SETS: ReadonlyMap<string, ItemSetDef> = collect<ItemSetDef>(
  import.meta.glob('./sets/*.{ts,json}', { eager: true }),
  'conjunto',
);

export const RARITIES: readonly RarityDef[] = rarityList;
export const RARITY: ReadonlyMap<Rarity, RarityDef> = new Map(rarityList.map((r) => [r.id, r]));

export const LOOT_TABLES: ReadonlyMap<string, LootTableDef> = collect<LootTableDef>(
  import.meta.glob('./loot_tables/*.{ts,json}', { eager: true }),
  'tabla de botín',
);

// --- PNJ, tiendas y misiones ------------------------------------------------------
const npcMap = collect<NpcDef>(import.meta.glob('./npcs/*.{ts,json}', { eager: true }), 'PNJ');
const shopMap = collect<ShopDef>(import.meta.glob('./shops/*.{ts,json}', { eager: true }), 'tienda');
const questMap = collect<QuestDef>(import.meta.glob('./quests/*.{ts,json}', { eager: true }), 'misión');
export const NPCS: ReadonlyMap<string, NpcDef> = npcMap;
export const SHOPS: ReadonlyMap<string, ShopDef> = shopMap;
export const QUESTS: ReadonlyMap<string, QuestDef> = questMap;

/** Ids generados por el mundo procedural (se registran al cargar/crear una partida y se pueden quitar). */
const generatedIds = { npcs: new Set<string>(), shops: new Set<string>(), quests: new Set<string>() };
export function registerGenerated(g: { npcs?: Iterable<NpcDef>; shops?: Iterable<ShopDef>; quests?: Iterable<QuestDef> }): void {
  for (const n of g.npcs ?? []) { npcMap.set(n.id, n); generatedIds.npcs.add(n.id); }
  for (const s of g.shops ?? []) { shopMap.set(s.id, s); generatedIds.shops.add(s.id); }
  for (const q of g.quests ?? []) { questMap.set(q.id, q); generatedIds.quests.add(q.id); }
}
/** Quita todo lo generado (al cambiar de partida). */
export function clearGenerated(): void {
  for (const id of generatedIds.npcs) npcMap.delete(id);
  for (const id of generatedIds.shops) shopMap.delete(id);
  for (const id of generatedIds.quests) questMap.delete(id);
  generatedIds.npcs.clear();
  generatedIds.shops.clear();
  generatedIds.quests.clear();
}

// --- Biomas del mundo procedural (v0.8) -------------------------------------------
export const BIOMES: ReadonlyMap<string, BiomeDef> = collect<BiomeDef>(import.meta.glob('./biomes/*.{ts,json}', { eager: true }), 'bioma');
/** Biomas por orden de clasificación. */
export const BIOME_LIST: readonly BiomeDef[] = [...BIOMES.values()].sort((a, b) => a.order - b.order);

/** PNJ de una zona. */
export function npcsInZone(zoneId: string, flags: Record<string, unknown> = {}): NpcDef[] {
  return [...NPCS.values()].filter(
    (n) => n.zone === zoneId && !(n.hideIfFlag && flags[n.hideIfFlag]) && !(n.showIfFlag && !flags[n.showIfFlag]),
  );
}

// --- Identidad del personaje (v0.2) ------------------------------------------
export const BACKGROUNDS: ReadonlyMap<string, BackgroundDef> = collect<BackgroundDef>(
  import.meta.glob('./backgrounds/*.{ts,json}', { eager: true }),
  'trasfondo',
);
export const TALENTS: ReadonlyMap<string, TalentDef> = collect<TalentDef>(
  import.meta.glob('./talents/*.{ts,json}', { eager: true }),
  'talento',
);
export const COMPANIONS: ReadonlyMap<string, CompanionDef> = collect<CompanionDef>(
  import.meta.glob('./companions/*.{ts,json}', { eager: true }),
  'compañero',
);
/** Eventos aleatorios al viajar (v0.14). */
export const TRAVEL_EVENTS: ReadonlyMap<string, TravelEventDef> = collect<TravelEventDef>(
  import.meta.glob('./events/*.{ts,json}', { eager: true }),
  'evento',
);
export const DEFAULT_BACKGROUND = 'aventurero';
export function getBackground(id: string | undefined): BackgroundDef | undefined {
  return BACKGROUNDS.get(id ?? DEFAULT_BACKGROUND) ?? BACKGROUNDS.get(DEFAULT_BACKGROUND);
}

// --- Mazmorras, trampas y minerales -----------------------------------------
export const DUNGEONS: ReadonlyMap<string, DungeonDef> = collect<DungeonDef>(
  import.meta.glob('./dungeons/*.{ts,json}', { eager: true }),
  'mazmorra',
);
export const TRAPS: ReadonlyMap<string, TrapDef> = new Map(trapList.map((t) => [t.id, t]));
export const ORES: ReadonlyMap<string, OreDef> = new Map(oreList.map((o) => [o.id, o]));

// --- Mascotas (v0.3) -----------------------------------------------------------
export const PET_SPECIES: ReadonlyMap<string, PetSpeciesDef> = collect<PetSpeciesDef>(
  import.meta.glob('./pets/*.{ts,json}', { eager: true }),
  'especie de mascota',
);
export const PET_MOVES: ReadonlyMap<string, PetMoveDef> = collect<PetMoveDef>(
  import.meta.glob('./pet_moves/*.{ts,json}', { eager: true }),
  'movimiento de mascota',
);
export const PET_TYPE_MAP: ReadonlyMap<PetType, PetTypeDef> = new Map(PET_TYPES.map((t) => [t.id, t]));
export { FAMILY_TYPE, PET_NATURES, PET_TYPES };
