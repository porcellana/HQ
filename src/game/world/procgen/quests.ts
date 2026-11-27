/**
 * MISIONES GENERADAS: ligadas a zonas reales del mundo procedural.
 * Cada misión apunta a una zona cercana que se genera (y fija su nivel) al crearla.
 * Tipos: matar, recolectar, visitar, entregar (hablar con un PNJ lejano) y jefe de mazmorra.
 * No hay misiones de escolta: el motor no tiene PNJ que sigan al jugador.
 */
import { LOOT_TABLES, NPCS, ORES, getEnemy, getItem } from '@/data/registry';
import type { QuestDef, QuestObjective, ZoneDef } from '@/data/schema';
import WG from '@/data/worldgen/nombres';
import { Rng, hashString } from '@/engine/rng';
import { cellId, hasUnderground, isSettlement, parseZoneId, placeAt, plannedNeighbors, subId } from './plan';

export interface QuestCtx {
  seed: number;
  /** Zona del PNJ que da las misiones. */
  zone: ZoneDef;
  giver: string;
  count: number;
  /** Genera (si falta) y devuelve una zona del mundo. */
  ensure: (id: string) => ZoneDef | undefined;
}

/** Celdas a distancia (en saltos de salida) 1..max de `from`, por orden de cercanía. */
export function cellsAround(seed: number, from: string, max: number): Array<{ id: string; dist: number }> {
  const seen = new Set<string>([from]);
  const out: Array<{ id: string; dist: number }> = [];
  let frontier = [from];
  for (let d = 1; d <= max; d++) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const n of plannedNeighbors(seed, f)) {
        if (seen.has(n)) continue;
        seen.add(n);
        next.push(n);
        out.push({ id: n, dist: d });
      }
    }
    frontier = next;
  }
  return out;
}

const fill = (t: string, v: Record<string, string | number>): string => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

type Kind = 'kill' | 'collect' | 'visit' | 'deliver' | 'boss';

export function makeQuests(ctx: QuestCtx): QuestDef[] {
  const { seed, zone } = ctx;
  const level = zone.level;
  const rng = new Rng(hashString(`${seed}:quests:${zone.id}`));
  const around = cellsAround(seed, zone.id, 5);
  const placeOf = (id: string) => {
    const p = parseZoneId(id);
    return p && !p.sub ? { p, place: placeAt(seed, p.cx, p.cy) } : null;
  };
  const kinds: Kind[] = ['kill', 'collect', 'visit', 'deliver', 'boss'];
  for (let i = kinds.length - 1; i > 0; i--) { const j = rng.int(0, i); [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!]; }
  const out: QuestDef[] = [];
  const reward = (mult: number, items: QuestDef['rewards']['items']): QuestDef['rewards'] => ({
    xp: Math.round(35 * Math.pow(level, 1.15) * mult), gold: Math.round((12 + 6 * level) * mult), ...(items ? { items } : {}),
  });
  const zoneNm = (z: ZoneDef) => z.name;

  const outdoorNear = (maxDist: number) => around.filter((a) => a.dist <= maxDist).map((a) => placeOf(a.id)).filter((x): x is NonNullable<typeof x> => !!x && !isSettlement(x.place));

  const build = (kind: Kind): { name: string; desc: string; objectives: QuestObjective[]; hint: string; mult: number; items?: QuestDef['rewards']['items'] } | null => {
    if (kind === 'kill') {
      const c = outdoorNear(2);
      if (!c.length) return null;
      const target = rng.pick(c);
      const z = ctx.ensure(cellId(target.p.cx, target.p.cy));
      const grp = z?.encounters?.groups;
      if (!z || !grp?.length) return null;
      const e = getEnemy(rng.weighted(grp, (g) => g.weight).enemy);
      if (!e) return null;
      const n = rng.int(3, 5);
      const v = { enemy: e.name.toLowerCase(), zone: zoneNm(z), n };
      return { name: cap(fill(rng.pick(WG.quest.killName), v)), desc: fill(rng.pick(WG.quest.killDesc), v), hint: z.id, mult: 1,
        objectives: [{ type: 'kill', enemy: e.id, count: n, label: `Derrotar ${e.name.toLowerCase()}` }] };
    }
    if (kind === 'collect') {
      const c = outdoorNear(2);
      if (!c.length) return null;
      const target = rng.pick(c);
      const z = ctx.ensure(cellId(target.p.cx, target.p.cy));
      if (!z) return null;
      let item: string | undefined;
      const ore = (z.features ?? []).find((f) => f.kind === 'mineral' && f.ore === 'hierro');
      if (ore) item = ORES.get('hierro')?.item;
      if (!item) {
        const drops: string[] = [];
        for (const g of z.encounters?.groups ?? []) {
          const tid = getEnemy(g.enemy)?.lootTable;
          for (const en of (tid ? LOOT_TABLES.get(tid)?.entries : undefined) ?? []) {
            if ('item' in en && getItem(en.item)?.kind === 'material') drops.push(en.item);
          }
        }
        if (drops.length) item = rng.pick(drops);
      }
      const def = item ? getItem(item) : undefined;
      if (!item || !def) return null;
      const n = rng.int(3, 4);
      const v = { item: def.name.toLowerCase(), zone: zoneNm(z), n };
      return { name: cap(fill(rng.pick(WG.quest.collectName), v)), desc: fill(rng.pick(WG.quest.collectDesc), v), hint: z.id, mult: 1,
        objectives: [{ type: 'collect', item, count: n, label: `Reunir ${def.name.toLowerCase()}` }] };
    }
    if (kind === 'visit') {
      const special = around.filter((a) => a.dist <= 3).map((a) => placeOf(a.id)).filter((x): x is NonNullable<typeof x> => !!x && x.place !== 'wild' && !isSettlement(x.place));
      const pool = special.length ? special : outdoorNear(3);
      if (!pool.length) return null;
      const t = rng.pick(pool);
      const cell = ctx.ensure(cellId(t.p.cx, t.p.cy));
      const z = hasUnderground(t.place) ? ctx.ensure(subId(t.p.cx, t.p.cy)) : cell;
      if (!z || !cell) return null;
      const v = { zone: zoneNm(cell) };
      return { name: cap(fill(rng.pick(WG.quest.visitName), v)), desc: fill(rng.pick(WG.quest.visitDesc), v), hint: z.id, mult: 0.8,
        objectives: [{ type: 'visit', zone: z.id, label: `Llegar a ${zoneNm(z)}` }] };
    }
    if (kind === 'deliver') {
      const t = around.map((a) => placeOf(a.id)).find((x) => !!x && isSettlement(x.place));
      if (!t) return null;
      const z = ctx.ensure(cellId(t.p.cx, t.p.cy));
      const npc = z ? NPCS.get(`${z.id}:alcalde`) : undefined;
      if (!z || !npc) return null;
      const v = { npc: npc.name, zone: zoneNm(z) };
      return { name: cap(fill(rng.pick(WG.quest.deliverName), v)), desc: fill(rng.pick(WG.quest.deliverDesc), v), hint: z.id, mult: 0.8,
        objectives: [{ type: 'talk', npc: npc.id, label: `Hablar con ${npc.name}` }] };
    }
    // boss
    const t = around.filter((a) => a.dist <= 5).map((a) => placeOf(a.id)).find((x) => !!x && x.place === 'mazmorra');
    if (!t) return null;
    ctx.ensure(cellId(t.p.cx, t.p.cy));
    const z = ctx.ensure(subId(t.p.cx, t.p.cy));
    const boss = z?.bossSpawn ? getEnemy(z.bossSpawn.enemy) : undefined;
    if (!z || !boss) return null;
    const v = { enemy: boss.name, zone: zoneNm(z).replace(' · Interior', '') };
    return { name: cap(fill(rng.pick(WG.quest.bossName), v)), desc: fill(rng.pick(WG.quest.bossDesc), v), hint: z.id, mult: 3,
      objectives: [{ type: 'kill', enemy: boss.id, count: 1, label: `Derrotar a ${boss.name}` }], items: [{ item: 'pocion_curacion_mayor', qty: 1 }] };
  };

  for (const kind of kinds) {
    if (out.length >= ctx.count) break;
    const b = build(kind);
    if (!b) continue;
    const i = out.length + 1;
    out.push({
      id: `gq:${zone.id}:${i}`, name: b.name, kind: 'secundaria', giver: ctx.giver, description: b.desc,
      completeText: rng.pick(WG.quest.complete), objectives: b.objectives,
      rewards: reward(b.mult, b.items ?? [{ item: 'pocion_curacion', qty: 1 + Math.floor(level / 4) }]),
      minLevel: Math.max(1, level - 3), zoneHint: b.hint,
    });
  }
  return out;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
