/**
 * REGISTRO DE CONTENIDO
 * ---------------------
 * Carga automáticamente TODOS los archivos .ts/.json de cada carpeta de datos
 * (gracias a import.meta.glob de Vite). Para añadir contenido basta con crear
 * un archivo nuevo en la carpeta correspondiente con un `export default`
 * (un objeto o una lista de objetos). El motor sólo consulta este registro.
 */
import type { ClassDef, EnemyDef, ItemDef, LootTableDef, Rarity, RarityDef, TileDef, ZoneDef } from './schema';
import rarityList from './config/rarities';
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

export function getZoneDef(id: string): ZoneDef | undefined {
  return ZONES.get(id);
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

export const RARITIES: readonly RarityDef[] = rarityList;
export const RARITY: ReadonlyMap<Rarity, RarityDef> = new Map(rarityList.map((r) => [r.id, r]));

export const LOOT_TABLES: ReadonlyMap<string, LootTableDef> = collect<LootTableDef>(
  import.meta.glob('./loot_tables/*.{ts,json}', { eager: true }),
  'tabla de botín',
);
