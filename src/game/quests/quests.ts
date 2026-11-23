/**
 * MISIONES
 * Estado por misión en GameState.quests. Los objetivos de matar/visitar/hablar
 * se cuentan al ocurrir; los de recoger se comprueban mirando la mochila y se
 * consumen al entregar.
 */
import { NPCS, QUESTS, getEnemy, getItem, getZoneDef } from '@/data/registry';
import type { EnemyDef, QuestDef, QuestObjective } from '@/data/schema';
import { countItem, type Carrier } from '../items/inventory';

export interface QuestProgress {
  status: 'activa' | 'completada';
  progress: number[];
  completions: number;
  lastCompletedTurn?: number;
}

export type QuestStatus = 'bloqueada' | 'disponible' | 'activa' | 'lista' | 'completada';

export interface QuestHolder {
  turn: number;
  flags: Record<string, boolean | number | string>;
  quests: Record<string, QuestProgress>;
  player: Carrier & { level: number };
  /** Misión elegida para seguir en el diario (null/ausente = la principal). */
  trackedQuestId?: string | null;
}

export function getQuest(id: string): QuestDef {
  const q = QUESTS.get(id);
  if (!q) throw new Error(`Misión desconocida: ${id}`);
  return q;
}

function objectiveTarget(o: QuestObjective): number {
  return o.type === 'kill' || o.type === 'collect' ? o.count : 1;
}

/** Progreso actual de un objetivo (recoger = lo que llevas en la mochila). */
export function objectiveProgress(h: QuestHolder, q: QuestDef, i: number): { have: number; need: number } {
  const o = q.objectives[i]!;
  const need = objectiveTarget(o);
  if (o.type === 'collect') return { have: Math.min(need, countItem(h.player, o.item)), need };
  return { have: Math.min(need, h.quests[q.id]?.progress[i] ?? 0), need };
}

export function isReady(h: QuestHolder, q: QuestDef): boolean {
  return q.objectives.every((_, i) => {
    const p = objectiveProgress(h, q, i);
    return p.have >= p.need;
  });
}

export function questStatus(h: QuestHolder, id: string): QuestStatus {
  const q = getQuest(id);
  const st = h.quests[id];
  if (st?.status === 'activa') return isReady(h, q) ? 'lista' : 'activa';
  if (st?.status === 'completada') {
    if (q.kind !== 'repetible') return 'completada';
    if (h.turn - (st.lastCompletedTurn ?? 0) < (q.cooldownTurns ?? 0)) return 'completada';
  }
  const reqOk = (q.requires ?? []).every((r) => h.quests[r]?.status === 'completada' || (h.quests[r]?.completions ?? 0) > 0);
  if (!reqOk || h.player.level < (q.minLevel ?? 1)) return 'bloqueada';
  if (q.requiresFlag && !h.flags[q.requiresFlag]) return 'bloqueada';
  return 'disponible';
}

/** Misiones relevantes para un PNJ: que ofrece o que se le entregan. */
export function questsForNpc(h: QuestHolder, npcId: string): Array<{ quest: QuestDef; status: QuestStatus }> {
  const out: Array<{ quest: QuestDef; status: QuestStatus }> = [];
  for (const q of QUESTS.values()) {
    const status = questStatus(h, q.id);
    const turnIn = q.turnIn ?? q.giver;
    if (q.giver === npcId && status === 'disponible') out.push({ quest: q, status });
    else if ((status === 'activa' || status === 'lista') && (q.giver === npcId || turnIn === npcId)) out.push({ quest: q, status });
  }
  return out;
}

/** Marca sobre la cabeza del PNJ: '?' entrega pendiente, '!' misión nueva. */
export function npcMarker(h: QuestHolder, npcId: string): '!' | '?' | null {
  let mark: '!' | '?' | null = null;
  for (const q of QUESTS.values()) {
    const s = questStatus(h, q.id);
    if (s === 'lista' && (q.turnIn ?? q.giver) === npcId) return '?';
    if (s === 'disponible' && q.giver === npcId) mark = '!';
  }
  return mark;
}

export function accept(h: QuestHolder, id: string): string | null {
  if (questStatus(h, id) !== 'disponible') return 'No puedes aceptar esa misión ahora.';
  const q = getQuest(id);
  const prev = h.quests[id];
  h.quests[id] = { status: 'activa', progress: q.objectives.map(() => 0), completions: prev?.completions ?? 0, ...(prev?.lastCompletedTurn !== undefined ? { lastCompletedTurn: prev.lastCompletedTurn } : {}) };
  return null;
}

function bump(h: QuestHolder, match: (o: QuestObjective) => boolean): string[] {
  const msgs: string[] = [];
  for (const [id, st] of Object.entries(h.quests)) {
    if (st.status !== 'activa') continue;
    const q = QUESTS.get(id);
    if (!q) continue;
    q.objectives.forEach((o, i) => {
      if (o.type === 'collect' || !match(o)) return;
      const need = objectiveTarget(o);
      if ((st.progress[i] ?? 0) >= need) return;
      st.progress[i] = (st.progress[i] ?? 0) + 1;
      msgs.push(`${q.name}: ${o.label} ${Math.min(need, st.progress[i]!)}/${need}${isReady(h, q) ? ' — ¡lista para entregar!' : ''}`);
    });
  }
  return msgs;
}

export function onKill(h: QuestHolder, enemy: EnemyDef): string[] {
  return bump(h, (o) => o.type === 'kill' && (o.enemy ? o.enemy === enemy.id : o.family === enemy.family));
}

export function onVisit(h: QuestHolder, zoneId: string): string[] {
  return bump(h, (o) => o.type === 'visit' && o.zone === zoneId);
}

export function onTalk(h: QuestHolder, npcId: string): string[] {
  return bump(h, (o) => o.type === 'talk' && o.npc === npcId);
}

/** Avisos al recoger objetos de misiones de recolección. */
export function collectNotes(h: QuestHolder, itemId: string): string[] {
  const msgs: string[] = [];
  for (const [id, st] of Object.entries(h.quests)) {
    if (st.status !== 'activa') continue;
    const q = QUESTS.get(id);
    q?.objectives.forEach((o, i) => {
      if (o.type !== 'collect' || o.item !== itemId) return;
      const p = objectiveProgress(h, q, i);
      msgs.push(`${q.name}: ${o.label} ${p.have}/${p.need}`);
    });
  }
  return msgs;
}

/**
 * Entrega una misión lista: consume los objetos pedidos y la marca completada.
 * Devuelve las recompensas para que el juego las aplique (XP, oro, objetos).
 */
export function turnIn(h: QuestHolder, id: string, npcId: string): { error: string } | { quest: QuestDef } {
  const q = getQuest(id);
  if ((q.turnIn ?? q.giver) !== npcId) return { error: 'Esta misión se entrega a otra persona.' };
  if (questStatus(h, id) !== 'lista') return { error: 'Todavía no has cumplido los objetivos.' };
  for (const o of q.objectives) {
    if (o.type !== 'collect') continue;
    let left = o.count;
    for (const s of [...h.player.inventory]) {
      if (left <= 0) break;
      if (s.id !== o.item) continue;
      const take = Math.min(left, s.qty);
      s.qty -= take;
      left -= take;
      if (s.qty <= 0) h.player.inventory.splice(h.player.inventory.indexOf(s), 1);
    }
  }
  const st = h.quests[id]!;
  st.status = 'completada';
  st.completions++;
  st.lastCompletedTurn = h.turn;
  if (q.rewards.flag) h.flags[q.rewards.flag] = true;
  return { quest: q };
}

/** Misiones activas ordenadas: principal, secundarias, repetibles. */
export function activeQuests(h: QuestHolder): QuestDef[] {
  const order = { principal: 0, secundaria: 1, repetible: 2 };
  return Object.entries(h.quests)
    .filter(([, s]) => s.status === 'activa')
    .map(([id]) => QUESTS.get(id))
    .filter((q): q is QuestDef => !!q)
    .sort((a, b) => order[a.kind] - order[b.kind]);
}

/** Marca una misión activa como la seguida (null = volver a la principal). */
export function setTracked(h: QuestHolder, id: string | null): void {
  h.trackedQuestId = id && h.quests[id]?.status === 'activa' ? id : null;
}

/** Misión seguida: la elegida en el diario si sigue activa; si no, la más importante. */
export function trackedQuestDef(h: QuestHolder): QuestDef | null {
  const chosen = h.trackedQuestId ? QUESTS.get(h.trackedQuestId) : undefined;
  if (chosen && h.quests[chosen.id]?.status === 'activa') return chosen;
  return activeQuests(h)[0] ?? null;
}

/** Texto corto para el HUD: la misión seguida. */
const FAMILY_SHORT: Record<string, string> = {
  goblinoide: 'Goblins', 'no-muerto': 'No-muertos', bestia: 'Bestias', 'araña': 'Arañas', orco: 'Orcos', humano: 'Cultistas',
};

/** Texto mínimo de un objetivo: «Goblins 2/5», «Seda de araña 1/3», «Marga», «Paso Gris». */
export function shortObjective(h: QuestHolder, q: QuestDef, i: number): string {
  const o = q.objectives[i]!;
  const p = objectiveProgress(h, q, i);
  const count = p.need > 1 ? ` ${p.have}/${p.need}` : '';
  switch (o.type) {
    case 'kill': {
      const name = o.enemy ? (getEnemy(o.enemy)?.name ?? o.enemy) : (FAMILY_SHORT[o.family ?? ''] ?? o.family ?? '');
      return `${name}${count}`;
    }
    case 'collect':
      return `${getItem(o.item)?.name ?? o.item}${count}`;
    case 'talk':
      return NPCS.get(o.npc)?.name ?? o.npc;
    case 'visit':
      return getZoneDef(o.zone)?.name ?? o.zone;
  }
}

export function trackedQuest(h: QuestHolder): { quest: QuestDef; name: string; text: string; short: string; ready: boolean } | null {
  const q = trackedQuestDef(h);
  if (!q) return null;
  if (isReady(h, q)) {
    const who = NPCS.get(q.turnIn ?? q.giver)?.name ?? '';
    return { quest: q, name: q.name, text: `Entrégala a ${who}`, short: `Entregar · ${who}`, ready: true };
  }
  const i = q.objectives.findIndex((_, k) => {
    const p = objectiveProgress(h, q, k);
    return p.have < p.need;
  });
  const p = objectiveProgress(h, q, i);
  const o = q.objectives[i]!;
  return { quest: q, name: q.name, text: p.need > 1 ? `${o.label} ${p.have}/${p.need}` : o.label, short: shortObjective(h, q, i), ready: false };
}

/** Comprueba que una misión es coherente con el resto del contenido (para tests). */
export function validateQuest(q: QuestDef, itemExists: (id: string) => boolean): string[] {
  const errs: string[] = [];
  if (!NPCS.has(q.giver)) errs.push(`giver desconocido ${q.giver}`);
  if (q.turnIn && !NPCS.has(q.turnIn)) errs.push(`turnIn desconocido ${q.turnIn}`);
  for (const r of q.requires ?? []) if (!QUESTS.has(r)) errs.push(`requires desconocido ${r}`);
  for (const o of q.objectives) {
    if (o.type === 'kill' && o.enemy && !getEnemy(o.enemy)) errs.push(`enemigo desconocido ${o.enemy}`);
    if (o.type === 'kill' && !o.enemy && !o.family) errs.push('kill sin enemy ni family');
    if (o.type === 'collect' && !itemExists(o.item)) errs.push(`objeto desconocido ${o.item}`);
    if (o.type === 'talk' && !NPCS.has(o.npc)) errs.push(`PNJ desconocido ${o.npc}`);
  }
  for (const it of q.rewards.items ?? []) if (!itemExists(it.item)) errs.push(`recompensa desconocida ${it.item}`);
  return errs;
}

