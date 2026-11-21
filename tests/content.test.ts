/** Valida los datos de contenido: si rompes un mapa, este test te avisa. */
import { describe, expect, it } from 'vitest';
import { START_ZONE_ID, TILES, TILE_BY_CHAR, ZONES } from '@/data/registry';
import { findPath } from '@/engine/pathfinding';
import { Zone } from '@/game/world/zone';

describe('tiles', () => {
  it('ids y caracteres únicos', () => {
    const chars = [...TILES.values()].map((t) => t.char);
    expect(new Set(chars).size).toBe(chars.length);
    for (const reserved of ['@', '1', '2', '3', '4', '5', '6', '7', '8', '9']) expect(TILE_BY_CHAR.has(reserved)).toBe(false);
  });
});

describe('zonas', () => {
  it('existe la zona inicial con punto de inicio', () => {
    const def = ZONES.get(START_ZONE_ID);
    expect(def).toBeDefined();
    expect(new Zone(def!).spawn).not.toBeNull();
  });

  for (const def of ZONES.values()) {
    describe(def.id, () => {
      it('filas del mismo ancho y caracteres conocidos', () => {
        const w = def.map[0]!.length;
        def.map.forEach((row, y) => {
          expect(row.length, `fila ${y}`).toBe(w);
          for (const ch of row) {
            const known = ch === '@' || /[1-9]/.test(ch) || TILE_BY_CHAR.has(ch) || def.legend?.[ch] !== undefined;
            expect(known, `carácter '${ch}' en fila ${y}`).toBe(true);
          }
        });
      });

      it('salidas configuradas y con llegada válida', () => {
        const zone = new Zone(def);
        for (const digit of zone.exitMarkers.keys()) expect(def.exits?.[digit], `salida ${digit}`).toBeDefined();
        for (const e of zone.exits) {
          const target = ZONES.get(e.to);
          if (!target) continue; // destino aún no creado: el juego muestra "bloqueado"
          expect(new Zone(target).exitMarkers.has(e.arrive), `${e.to} no tiene la salida ${e.arrive}`).toBe(true);
        }
      });

      it('todas las salidas son alcanzables entre sí', () => {
        const zone = new Zone(def);
        const start = zone.spawn ?? zone.exits[0];
        if (!start) return;
        for (const e of zone.exits) {
          const path = findPath(zone.width, zone.height, start, e, (x, y) => zone.isWalkable(x, y));
          expect(path, `salida ${e.digit} inalcanzable`).not.toBeNull();
        }
      });
    });
  }
});
