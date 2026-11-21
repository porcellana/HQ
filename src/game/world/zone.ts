/**
 * Zona en tiempo de ejecución: convierte una ZoneDef (mapa ASCII) en una
 * rejilla de tiles consultable por el motor.
 */
import type { TileDef, ZoneDef, ZoneExitDef } from '@/data/schema';
import { TILES, TILE_BY_CHAR } from '@/data/registry';
import type { Point } from '@/engine/pathfinding';

export interface ZoneExit extends ZoneExitDef {
  digit: string;
  x: number;
  y: number;
}

export class Zone {
  readonly id: string;
  readonly def: ZoneDef;
  readonly width: number;
  readonly height: number;
  /** tiles[y * width + x] */
  readonly tiles: TileDef[];
  readonly exits: ZoneExit[] = [];
  /** Posiciones por dígito de salida (una salida puede ocupar varias casillas). */
  readonly exitMarkers = new Map<string, Point[]>();
  spawn: Point | null = null;

  constructor(def: ZoneDef) {
    this.id = def.id;
    this.def = def;
    this.height = def.map.length;
    this.width = def.map.reduce((m, row) => Math.max(m, row.length), 0);
    const fallback = TILES.get('hierba')!;
    const exitTile = TILES.get(def.exitTile ?? 'camino') ?? fallback;
    const spawnTile = TILES.get(def.spawnTile ?? def.exitTile ?? 'camino') ?? fallback;
    this.tiles = new Array<TileDef>(this.width * this.height);

    for (let y = 0; y < this.height; y++) {
      const row = def.map[y] ?? '';
      if (row.length !== this.width) console.warn(`[zona ${def.id}] la fila ${y} mide ${row.length} y debería medir ${this.width}`);
      for (let x = 0; x < this.width; x++) {
        const ch = row[x] ?? ',';
        let tile: TileDef | undefined;
        if (ch === '@') {
          this.spawn = { x, y };
          tile = spawnTile;
        } else if (/[1-9]/.test(ch)) {
          const exitDef = def.exits?.[ch];
          if (!exitDef) console.warn(`[zona ${def.id}] salida '${ch}' sin configurar en "exits"`);
          tile = (exitDef?.tile ? TILES.get(exitDef.tile) : undefined) ?? exitTile;
          const list = this.exitMarkers.get(ch) ?? [];
          list.push({ x, y });
          this.exitMarkers.set(ch, list);
          if (exitDef) this.exits.push({ ...exitDef, digit: ch, x, y });
        } else {
          const overrideId = def.legend?.[ch];
          tile = overrideId ? TILES.get(overrideId) : TILE_BY_CHAR.get(ch);
          if (!tile) console.warn(`[zona ${def.id}] carácter desconocido '${ch}' en (${x},${y})`);
        }
        this.tiles[y * this.width + x] = tile ?? fallback;
      }
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  tileAt(x: number, y: number): TileDef | undefined {
    return this.inBounds(x, y) ? this.tiles[y * this.width + x] : undefined;
  }

  isWalkable(x: number, y: number): boolean {
    return this.tileAt(x, y)?.walkable ?? false;
  }

  exitAt(x: number, y: number): ZoneExit | undefined {
    return this.exits.find((e) => e.x === x && e.y === y);
  }

  /** Casilla donde aparece el jugador al llegar por la salida `digit`. */
  arrivalPoint(digit: string): Point {
    const marker = this.exitMarkers.get(digit)?.[0];
    return marker ?? this.spawn ?? { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
  }
}

/** Caché de zonas construidas (son inmutables, se pueden reutilizar). */
const cache = new Map<string, Zone>();
export function buildZone(def: ZoneDef): Zone {
  let z = cache.get(def.id);
  if (!z || z.def !== def) {
    z = new Zone(def);
    cache.set(def.id, z);
  }
  return z;
}
