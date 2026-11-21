/**
 * ESTADOS ALTERADOS
 *  veneno      1d4 por turno y desventaja al atacar
 *  sangrado    1d4 por turno
 *  quemado     1d6 de fuego por turno
 *  aturdido    pierde el turno
 *  ralentizado sólo actúa uno de cada dos turnos y -2 a la CA
 */
import type { StatusApply, StatusId } from '@/data/schema';
import type { Rng } from '@/engine/rng';

export interface StatusInstance {
  id: StatusId;
  turns: number;
}

export const STATUS_INFO: Record<StatusId, { name: string; icon: string; color: string; dot?: string }> = {
  veneno: { name: 'Envenenado', icon: '☠', color: '#7ac040', dot: '1d4' },
  sangrado: { name: 'Sangrando', icon: '🩸', color: '#d03030', dot: '1d4' },
  quemado: { name: 'Quemado', icon: '🔥', color: '#f08030', dot: '1d6' },
  aturdido: { name: 'Aturdido', icon: '💫', color: '#f0e060' },
  ralentizado: { name: 'Ralentizado', icon: '🐌', color: '#60a0e0' },
};

/** Intenta aplicar un estado; devuelve true si se aplicó. */
export function tryApplyStatus(rng: Rng, list: StatusInstance[], s: StatusApply, immune: readonly StatusId[] = []): boolean {
  if (immune.includes(s.id)) return false;
  if (!rng.chance(s.chance ?? 1)) return false;
  const existing = list.find((x) => x.id === s.id);
  if (existing) existing.turns = Math.max(existing.turns, s.turns);
  else list.push({ id: s.id, turns: s.turns });
  return true;
}

export function hasStatus(list: readonly StatusInstance[], id: StatusId): boolean {
  return list.some((s) => s.id === id && s.turns > 0);
}

/**
 * Al empezar el turno de alguien: aplica daño por turno y descuenta duraciones.
 * Devuelve el daño total y qué estados hicieron daño (para mensajes).
 */
export function tickStatuses(rng: Rng, list: StatusInstance[]): { damage: number; parts: Array<{ id: StatusId; amount: number }> } {
  const parts: Array<{ id: StatusId; amount: number }> = [];
  for (const s of list) {
    if (s.id === 'aturdido') continue; // se consume al perder el turno (consumeStun)
    const info = STATUS_INFO[s.id];
    if (info.dot) {
      const [n, sides] = info.dot.split('d').map(Number) as [number, number];
      let amount = 0;
      for (let i = 0; i < n; i++) amount += rng.int(1, sides);
      parts.push({ id: s.id, amount });
    }
    s.turns--;
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i]!.id !== 'aturdido' && list[i]!.turns <= 0) list.splice(i, 1);
  return { damage: parts.reduce((a, p) => a + p.amount, 0), parts };
}

/** El aturdimiento se consume al perder el turno. */
export function consumeStun(list: StatusInstance[]): boolean {
  const i = list.findIndex((s) => s.id === 'aturdido');
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}
