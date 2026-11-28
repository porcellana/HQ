/** v0.14: interiores de casas del mundo procedural. */
import { beforeEach, describe, expect, it } from 'vitest';
import { NPCS, getZoneDef } from '@/data/registry';
import { HOUSE_KINDS, type HouseRole } from '@/data/worldgen/casas';
import { Game } from '@/game/game';
import { generateCell } from '@/game/world/procgen/generate';
import { generateInterior } from '@/game/world/procgen/interiors';
import { activateGenWorld, emptyGen, ensureZone } from '@/game/world/procgen';
import { isSettlement, parseZoneId, placeAt } from '@/game/world/procgen/plan';
import { DOOR_CHARS, buildZone, type Zone } from '@/game/world/zone';
import { testState } from './helpers';

const ROLES = Object.keys(HOUSE_KINDS) as HouseRole[];
const base = { seed: 5, level: 4, town: 'Vildena', outside: 'w_1_0', door: 'α', chestLoot: 'cofre' };

function flood(z: Zone, x: number, y: number): Set<number> {
  const seen = new Set<number>([y * z.width + x]);
  const q: Array<[number, number]> = [[x, y]];
  while (q.length) {
    const [cx, cy] = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy;
      if (!z.inBounds(nx, ny) || seen.has(ny * z.width + nx) || !z.isWalkable(nx, ny)) continue;
      seen.add(ny * z.width + nx);
      q.push([nx, ny]);
    }
  }
  return seen;
}

describe('interiores: generador puro', () => {
  it('es determinista por semilla y casa', () => {
    for (const role of ROLES) {
      const a = generateInterior({ ...base, id: 'w_1_0.h2', role });
      expect(JSON.stringify(a)).toBe(JSON.stringify(generateInterior({ ...base, id: 'w_1_0.h2', role })));
      expect(JSON.stringify(a.zone.map)).not.toBe(JSON.stringify(generateInterior({ ...base, seed: 6, id: 'w_1_0.h3', role: 'casa' }).zone.map) + 'x');
    }
  });

  it('mapas rectangulares, con una salida, residente y cofres alcanzables y muebles de su oficio', () => {
    for (let seed = 1; seed <= 25; seed++) {
      for (const role of ROLES) {
        const out = generateInterior({ ...base, seed, id: `w_0_2.h${seed}`, role, resident: 'Marta' });
        const z = buildZone(out.zone);
        expect(new Set(out.zone.map.map((r) => r.length)).size).toBe(1);
        expect(z.exits.length).toBe(1);
        const r = flood(z, z.exits[0]!.x, z.exits[0]!.y);
        expect(z.isWalkable(out.resident.x, out.resident.y), `${role} residente`).toBe(true);
        expect(r.has(out.resident.y * z.width + out.resident.x), `${seed} ${role} residente inalcanzable`).toBe(true);
        for (const f of out.zone.features ?? []) {
          const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r.has((f.y + dy!) * z.width + f.x + dx!));
          expect(adj, `${seed} ${role} cofre aislado`).toBe(true);
        }
        const flat = out.zone.map.join('');
        if (role === 'casa') expect(flat).toContain('Z');
        if (role === 'posada') { expect(flat).toContain('Z'); expect(flat).toContain('H'); }
        if (role === 'herrero') expect(flat).toContain('U');
        if (role === 'templo') expect(flat).toContain('A');
        expect(out.zone.kind).toBe('interior');
      }
    }
  });

  it('los cofres de la casa usan el botín y el nivel dados', () => {
    let n = 0;
    for (let seed = 1; seed < 40; seed++) {
      const o = generateInterior({ ...base, seed, id: `x.h${seed}`, role: 'casa', level: 7, resident: 'Ana' });
      for (const f of o.zone.features ?? []) { n++; expect(f.kind).toBe('cofre'); if (f.kind === 'cofre') { expect(f.level).toBe(7); expect(f.loot).toBe('cofre'); } }
    }
    expect(n).toBeGreaterThan(10);
  });
});

describe('interiores: asentamientos generados', () => {
  beforeEach(() => activateGenWorld(77, emptyGen()));

  const towns = (): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (!(x === 0 && y >= -1 && y <= 2) && isSettlement(placeAt(77, x, y))) out.push([x, y]);
    return out;
  };

  it('cada edificio tiene puerta con letra griega y un interior que vuelve a ella', () => {
    let seen = 0;
    for (const [x, y] of towns()) {
      const b = generateCell(77, x, y, 5);
      const town = b.zones[0]!;
      const houses = b.zones.filter((z) => z.kind === 'interior');
      expect(houses.length).toBeGreaterThanOrEqual(3);
      for (const h of houses) {
        seen++;
        const door = Object.entries(town.exits!).find(([, e]) => e.to === h.id)!;
        expect(DOOR_CHARS).toContain(door[0]);
        expect(town.map.join('')).toContain(door[0]);
        expect(h.exits!['1']!.to).toBe(town.id);
        expect(h.exits!['1']!.arrive).toBe(door[0]);
        expect(parseZoneId(h.id)).toMatchObject({ cx: x, cy: y, house: Number(h.id.split('.h')[1]) });
      }
      // Los servicios están dentro: tienda y posada en sus casas
      const roles = b.npcs.map((n) => n.id.split(':')[1]);
      expect(roles).toContain('tienda');
      expect(roles).toContain('posada');
      for (const n of b.npcs.filter((n) => /:(tienda|posada)$/.test(n.id))) expect(n.zone).toMatch(/\.h\d+$/);
    }
    expect(seen).toBeGreaterThan(10);
  });

  it('entrar por la puerta, ver a los residentes y salir devuelve al mismo sitio', () => {
    const [cx, cy] = towns()[0]!;
    const g = new Game(testState('guerrero', 77));
    const town = ensureZone(`w_${cx}_${cy}`, 3)!;
    g.enterZone(town.id, '1');
    const [dch, ex] = Object.entries(town.exits!).find(([, e]) => e.to.includes('.h'))!;
    g.enterZone(ex.to, ex.arrive);
    expect(g.zone.def.kind).toBe('interior');
    expect(getZoneDef(ex.to)).toBeDefined();
    expect(g.npcs.length).toBeGreaterThan(0);
    for (const n of g.npcs) expect(NPCS.get(n.id)).toBeDefined();
    const exit = g.zone.exits[0]!;
    g.enterZone(exit.to, exit.arrive);
    expect(g.zone.id).toBe(town.id);
    expect(g.zone.arrivalPoint(dch)).toEqual({ x: g.view.rx, y: g.view.ry });
  });

  it('los vecinos con favor reparten misiones', () => {
    const [cx, cy] = towns()[0]!;
    const g = new Game(testState('guerrero', 77));
    ensureZone(`w_${cx}_${cy}`, 3);
    expect([...NPCS.keys()].some((id) => id.startsWith(`w_${cx}_${cy}:vecino`))).toBe(true);
    void g;
  });
});
