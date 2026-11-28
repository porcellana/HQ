/**
 * INTERIORES DE CASAS (v0.14, puro y determinista)
 * -------------------------------------------------
 * Dada la semilla, el id de la casa y su oficio, genera el mapa ASCII de una casa entrable:
 * habitaciones con muebles (cama, mesa, chimenea, estanterías, barriles, mostrador, altar...),
 * cofres con botín por nivel y los puestos donde caben sus residentes. Todo es alcanzable
 * desde la puerta (se comprueba al colocar los muebles). No sabe nada de PNJ ni de tiendas:
 * devuelve las casillas, y es `generate.ts` quien las rellena.
 */
import { HOUSE_KINDS, type HouseRole } from '@/data/worldgen/casas';
import type { ZoneDef, ZoneFeature } from '@/data/schema';
import type { Point } from '@/engine/pathfinding';
import { Rng, hashString } from '@/engine/rng';

export interface InteriorIn {
  seed: number;
  /** Id de la zona interior (p. ej. `w_3_2.h4`). */
  id: string;
  role: HouseRole;
  level: number;
  /** Nombre del asentamiento y, para casas, del residente. */
  town: string;
  resident?: string;
  /** Zona exterior y carácter de salida de la puerta de la casa. */
  outside: string;
  door: string;
  /** Tabla de botín de los cofres. */
  chestLoot: string;
  /** Datos de lugar generado (bioma y música). */
  gen?: ZoneDef['generated'];
}

export interface InteriorOut {
  zone: ZoneDef;
  /** Dónde se sitúa el residente principal (detrás del mostrador, junto al altar, en el salón...). */
  resident: Point;
  /** Casillas libres donde puede haber otro residente (clientes, vecinos). */
  extras: Point[];
}

const HEARTH = 'H', BED = 'Z', TABLE = 'O', SHELF = 'E', BARREL = 'X', COUNTER = 'K', ANVIL = 'U', ALTAR = 'A', RUG = 'r', FLOOR = ':', WALL = '#';

/** ¿Hay oficio de tienda/servicio (mostrador y mercancías) o es una casa corriente? */
const SHOPLIKE = new Set<HouseRole>(['tienda', 'herrero', 'alquimista', 'armero', 'gremio', 'magos', 'negro']);

export function houseName(role: HouseRole, town: string, resident?: string): string {
  return HOUSE_KINDS[role].name.replace('{town}', town).replace('{name}', resident ?? 'un vecino');
}

export function generateInterior(inp: InteriorIn): InteriorOut {
  const kind = HOUSE_KINDS[inp.role];
  const rng = new Rng(hashString(`${inp.seed}:house:${inp.id}`));
  const [W, H] = kind.size;
  const cx = W >> 1;
  const g: string[][] = [];
  for (let y = 0; y < H; y++) g.push(Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? WALL : FLOOR)));
  const at = (x: number, y: number): string => g[y]?.[x] ?? WALL;
  const free = (x: number, y: number): boolean => x > 0 && y > 0 && x < W - 1 && y < H - 2 && at(x, y) === FLOOR;
  const put = (x: number, y: number, ch: string): boolean => {
    if (!free(x, y)) return false;
    g[y]![x] = ch;
    return true;
  };
  const doorY = H - 1;
  g[doorY]![cx] = '1';
  // La fila de la entrada y la columna central quedan libres: siempre se puede cruzar la sala.
  const paintRug = (x0: number, x1: number, y0: number, y1: number): void => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (free(x, y)) g[y]![x] = RUG;
  };
  const used = new Set<number>();
  const k = (x: number, y: number): number => y * W + x;
  let resident: Point = { x: cx, y: 2 };

  const shelves = (n: number, y = 1): void => {
    for (let i = 0; i < n; i++) put(rng.int(1, W - 2), y, rng.chance(0.85) ? SHELF : BARREL);
  };

  switch (inp.role) {
    case 'posada': {
      for (let x = cx - 1; x <= cx + 1; x++) put(x, 1, HEARTH);
      shelves(3);
      for (const x of [1, 2, W - 3, W - 2]) put(x, 1, SHELF);
      for (let x = cx - 3; x <= cx + 3; x++) if (x !== cx) put(x, 3, COUNTER);
      resident = { x: cx, y: 2 };
      // Camas al fondo de los lados y mesas de comedor
      for (const [bx, by] of [[1, 5], [1, 6], [W - 2, 5], [W - 2, 6]] as const) put(bx, by, BED);
      for (const [tx, ty] of [[3, 5], [4, 5], [3, 6], [W - 5, 5], [W - 4, 5], [W - 5, 6]] as const) put(tx, ty, TABLE);
      put(1, 3, BARREL);
      put(W - 2, 3, BARREL);
      paintRug(cx - 1, cx + 1, 4, H - 2);
      break;
    }
    case 'templo': {
      put(cx, 1, ALTAR);
      for (const x of [1, W - 2]) put(x, 1, SHELF);
      shelves(1);
      paintRug(cx, cx, 2, H - 2);
      for (let y = 4; y <= H - 3; y += 2) for (const dx of [2, 3]) { put(cx - dx, y, TABLE); put(cx + dx, y, TABLE); }
      resident = { x: cx, y: 2 };
      break;
    }
    case 'herrero': {
      for (let x = 1; x <= 3; x++) put(x, 1, HEARTH);
      shelves(3, 1);
      put(2, 2, ANVIL);
      for (let x = 4; x <= W - 3; x++) put(x, 3, COUNTER);
      put(W - 2, 2, BARREL);
      put(W - 2, 3, BARREL);
      put(1, H - 3, BARREL);
      put(W - 2, H - 3, BARREL);
      paintRug(cx - 1, cx + 1, 4, H - 2);
      resident = { x: cx, y: 2 };
      break;
    }
    case 'casa': {
      // Dos habitaciones: dormitorio a la izquierda y salón a la derecha, unidos por el pasillo de la entrada.
      const px = cx - 2;
      for (let y = 1; y <= H - 4; y++) g[y]![px] = WALL;
      put(1, 1, BED); put(2, 1, BED); put(1, 2, BED);
      put(px - 1, 1, SHELF);
      put(px - 1, 3, rng.chance(0.5) ? BARREL : SHELF);
      for (let x = cx + 1; x <= cx + 3; x++) put(x, 1, x === cx + 2 ? HEARTH : SHELF);
      put(W - 2, 3, BARREL);
      put(W - 2, 4, BARREL);
      put(cx + 2, 4, TABLE); put(cx + 3, 4, TABLE);
      paintRug(cx + 1, cx + 3, 3, 3);
      resident = { x: cx + 1, y: 4 };
      break;
    }
    default: {
      // Tienda, alquimia, armería, gremio, magos, trastienda: estanterías, mostrador y almacén.
      for (let x = 1; x <= W - 2; x++) if (x !== cx || inp.role !== 'magos') put(x, 1, rng.chance(0.82) ? SHELF : BARREL);
      for (let x = 3; x <= W - 3; x++) put(x, 3, COUNTER);
      if (inp.role === 'alquimista' || inp.role === 'magos') put(W - 3, 2, TABLE);
      if (inp.role === 'armero' || inp.role === 'gremio') { put(1, 2, BARREL); put(W - 2, 2, BARREL); }
      for (const [bx, by] of [[1, H - 3], [W - 2, H - 3], [W - 2, 4]] as const) if (rng.chance(0.8)) put(bx, by, BARREL);
      if (SHOPLIKE.has(inp.role) && rng.chance(0.6)) put(cx + rng.pick([-3, 3]), 5, TABLE);
      paintRug(cx - 1, cx + 1, 4, H - 2);
      resident = { x: cx, y: 2 };
      break;
    }
  }
  // El residente siempre está sobre suelo libre.
  if (!(at(resident.x, resident.y) === FLOOR || at(resident.x, resident.y) === RUG)) {
    for (let y = 2; y < H - 3; y++) for (let x = 1; x < W - 1; x++) if (at(x, y) === FLOOR || at(x, y) === RUG) { resident = { x, y }; y = H; break; }
  }
  g[resident.y]![resident.x] = at(resident.x, resident.y) === RUG ? RUG : FLOOR;
  used.add(k(resident.x, resident.y));

  // Cofres: pegados a un mueble o muro, a la vista de un camino, nunca en la entrada ni sobre el residente.
  const walk = (c: string): boolean => c === FLOOR || c === RUG || c === '1';
  const reachable = (): Set<number> => {
    const seen = new Set<number>([k(cx, doorY)]);
    const q: Point[] = [{ x: cx, y: doorY }];
    while (q.length) {
      const p = q.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k(nx, ny)) || !walk(at(nx, ny))) continue;
        seen.add(k(nx, ny));
        q.push({ x: nx, y: ny });
      }
    }
    return seen;
  };
  const features: ZoneFeature[] = [];
  const nChest = rng.chance(kind.chest[0]) ? rng.int(1, kind.chest[1]) : 0;
  for (let i = 0, tries = 0; i < nChest && tries < 80; tries++) {
    const x = rng.int(1, W - 2), y = rng.int(1, H - 3);
    if (!free(x, y) && at(x, y) !== RUG) continue;
    if (used.has(k(x, y)) || (x === cx)) continue;
    const nb = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).filter(([dx, dy]) => !walk(at(x + dx, y + dy))).length;
    if (nb === 0) continue;
    const old = at(x, y);
    g[y]![x] = BARREL;
    const reach = reachable();
    g[y]![x] = old;
    // Debe quedar una casilla alcanzable al lado para abrirlo, y el residente sigue alcanzable.
    const adj = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => reach.has(k(x + dx, y + dy)));
    const others = features.every((f) => ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => reach.has(k(f.x + dx, f.y + dy))));
    if (!adj || !others || !reach.has(k(resident.x, resident.y)) && !reach.has(k(resident.x, resident.y + 1))) continue;
    // Un cofre bloquea la casilla: se marca con barril fantasma para que el siguiente cálculo lo respete.
    used.add(k(x, y));
    g[y]![x] = BARREL;
    features.push({ kind: 'cofre', x, y, locked: rng.chance(0.3), loot: inp.chestLoot, level: inp.level });
    i++;
  }
  // Los barriles fantasma de los cofres vuelven a ser suelo (el cofre es una característica de la zona).
  for (const f of features) g[f.y]![f.x] = FLOOR;

  // Otros residentes posibles: casillas libres alcanzables lejos de la entrada.
  const reach = reachable();
  const extras: Point[] = [];
  for (let y = 4; y < H - 2; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (at(x, y) !== FLOOR || !reach.has(k(x, y)) || used.has(k(x, y)) || x === cx || features.some((f) => f.x === x && f.y === y)) continue;
      extras.push({ x, y });
    }
  }
  for (let i = extras.length - 1; i > 0; i--) { const j = rng.int(0, i); [extras[i], extras[j]] = [extras[j]!, extras[i]!]; }

  const name = houseName(inp.role, inp.town, inp.resident);
  const zone: ZoneDef = {
    id: inp.id,
    name,
    kind: 'interior',
    level: inp.level,
    map: g.map((r) => r.join('')),
    exitTile: 'madera',
    spawnTile: 'madera',
    exits: { '1': { to: inp.outside, arrive: inp.door, label: 'Salir', tile: 'puerta' } },
    features,
    ...(inp.gen ? { generated: { ...inp.gen, music: kind.music, battle: 'interior' } } : {}),
  };
  return { zone, resident, extras };
}
