/**
 * EVENTOS DE PRESENTACIÓN DEL COMBATE
 * La lógica del combate (game.ts) es instantánea y determinista. Para que
 * se pueda DISFRUTAR, emite estos eventos con todo lo necesario y la capa
 * de presentación (src/gfx/cinema.ts y src/ui/duelCard.ts) los reproduce
 * en el tiempo: tarjeta de duelo, partículas, temblor, sonido, etc.
 */
import type { DamageType } from '@/data/schema';
import type { Actor } from '../game';
import type { Enemy } from './entities';

/** Daño o golpe resuelto sobre un actor. */
export interface HitFx {
  type: 'hit';
  target: Actor;
  pos: { x: number; y: number };
  amount: number;
  dmgType: DamageType | null;
  crit: boolean;
  note: '' | 'resiste' | 'vulnerable';
  killed: boolean;
  /** Quién golpea (null: trampa, estado, entorno). */
  attacker: Actor | null;
  /** Nombre de la acción («Cimitarra», «Bola de fuego»…). */
  action: string;
  /** Segundos hasta el impacto visible. */
  lead: number;
}

/** Ataque sin tirada de d20 que falla (mascotas, hechizos con puntería). */
export interface MissFx {
  type: 'miss';
  target: Actor;
  pos: { x: number; y: number };
  attacker: Actor | null;
  action: string;
  lead: number;
}

/** Un enemigo cae: se desintegra y suelta botín. */
export interface KillFx {
  type: 'kill';
  enemy: Enemy;
  xp: number;
  gold: number;
  items: Array<{ name: string; rarity: number }>;
  boss: boolean;
  lead: number;
}

export type CombatFxEvent = HitFx | MissFx | KillFx;

/** Rareza → índice 0..4 (para el «ding» y el brillo del botín). */
export const RARITY_RANK: Record<string, number> = { comun: 0, poco_comun: 1, raro: 2, epico: 3, legendario: 4 };

/** Categoría de una línea del registro de combate (color en pantalla). */
export type MsgCat = 'dmg-out' | 'dmg-in' | 'heal' | 'status' | 'miss' | 'neutral';
