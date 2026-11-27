/**
 * BATALLA POR TURNOS (estilo Final Fantasy) — LÓGICA PURA, SIN DOM
 * ----------------------------------------------------------------
 * Una batalla enfrenta a tu grupo (jugador, compañero y mascota) con un grupo
 * de enemigos. No hay mapa ni casillas: todo objetivo vale. Reutiliza las
 * reglas de src/game/combat (tiradas, estados, defensas, XP) y los talentos.
 *
 * Funcionamiento:
 *   - Cada ronda actúan todos por orden de INICIATIVA (DES + bonos; los rápidos antes).
 *   - `step()` avanza hasta que le toca al jugador (o la batalla acaba).
 *   - Los comandos del jugador (attack, useSkill, useItem, defend, flee) resuelven
 *     su acción y cierran su turno.
 *   - Todo lo que ocurre se anota en una cola de eventos (`drain()`); la escena
 *     (src/ui/battleScene.ts) los reproduce con animaciones. La lógica es
 *     instantánea y determinista dada la semilla.
 */
import { COMPANIONS, getEnemy } from '@/data/registry';
import type { CompanionDef, DamageType, PetMoveDef, PetStats, SkillDef, SkillEffect, StatusApply, StatusId } from '@/data/schema';
import type { Rng } from '@/engine/rng';
import { createEnemy, enemySave, type Enemy } from '../combat/entities';
import { applyDefenses, attackRoll, damageRoll, savingThrow, xpForKill, type RollMode } from '../combat/rules';
import { STATUS_INFO, consumeStun, hasStatus, tickStatuses, tryApplyStatus, type StatusInstance } from '../combat/status';
import { addItem, removeQty } from '../items/inventory';
import { itemDef, type ItemInstance } from '../items/items';
import { rollLoot } from '../items/loot';
import * as Pets from '../pets/pets';
import * as Quests from '../quests/quests';
import { proficiencyBonus, unlockedSkills } from '../rules/character';
import { derive, type Derived } from '../rules/derived';
import { abilityModifier, roll } from '../rules/dice';
import { emptyRecord, type GameState } from '../state';
import { skillMods, talentEffects } from '../talents';
import { getClass, getBackground } from '@/data/registry';

export type Side = 'party' | 'foe';
export type CombatantKind = 'player' | 'ally' | 'pet' | 'enemy';
export type BattleOutcome = 'victory' | 'defeat' | 'fled';
/** A quién va dirigida una habilidad u objeto. */
export type TargetKind = 'enemy' | 'allEnemies' | 'ally' | 'self';

export interface BattleBuff {
  stat: 'ataque' | 'daño' | 'ca';
  amount: number;
  turns: number;
}

export interface Combatant {
  id: string;
  kind: CombatantKind;
  side: Side;
  name: string;
  enemy?: Enemy;
  statuses: StatusInstance[];
  buffs: BattleBuff[];
  cooldowns: Record<string, number>;
  petBuffs: Array<{ stat: keyof PetStats; amount: number; turns: number }>;
  defending: boolean;
  stealth: number;
  skipNext: boolean;
  /** Ya cayó (no actúa ni es objetivo). */
  dead: boolean;
  boss: boolean;
}

/** Guion de presentación: la escena lo reproduce en orden. */
export type BattleEvent =
  /** Empieza el turno de `id`. `order`: quién actuará a continuación (incluido él). */
  | { t: 'turn'; id: string; order: string[] }
  /** Nombre de la acción (mensaje corto arriba). */
  | { t: 'say'; text: string }
  /** Línea informativa (jefe, estados...). */
  | { t: 'info'; text: string; kind?: 'good' | 'warn' | 'combat' }
  | { t: 'attack'; from: string; to: string[]; style: 'melee' | 'ranged' | 'cast' | 'self'; dmgType?: DamageType; color?: string }
  | { t: 'hit'; id: string; amount: number; hp: number; crit: boolean; tag: '' | 'resiste' | 'vulnerable' | 'mitad' | 'estado'; dmgType?: DamageType; killed: boolean }
  | { t: 'miss'; id: string; text: string }
  | { t: 'heal'; id: string; amount: number; hp: number }
  | { t: 'mp'; id: string; amount: number }
  | { t: 'status'; id: string; status: StatusId }
  | { t: 'buff'; id: string; text: string }
  | { t: 'defend'; id: string }
  | { t: 'death'; id: string }
  | { t: 'summon'; id: string }
  | { t: 'phase'; id: string; text: string }
  | { t: 'flee'; success: boolean }
  | { t: 'done'; id: string }
  | { t: 'end'; outcome: BattleOutcome };

export interface BattleResult {
  outcome: BattleOutcome;
  /** XP total de los enemigos vencidos (antes del reparto con compañeros). */
  xp: number;
  /** XP para la mascota. */
  petXp: number;
  gold: number;
  items: Array<{ name: string; qty: number; rarity: string }>;
  kills: Enemy[];
  /** Enemigos del mapa que han caído o han sido vinculados (se quitan del mapa). */
  removed: Enemy[];
  /** Se vinculó una mascota activa (la interfaz la coloca). */
  boundActivePet: boolean;
  /** Rondas jugadas. */
  rounds: number;
}

export interface BattleOptions {
  state: GameState;
  rng: Rng;
  enemies: Enemy[];
  /** Mazmorra en la que se lucha (para marcarla completada al vencer a su jefe). */
  dungeonId?: string;
}

export interface Hooks {
  /** Mensajes sueltos para el diario (opcional). */
  log?: (text: string, kind: 'good' | 'warn' | 'combat' | 'info') => void;
}

const PET_DAMAGE: Record<string, DamageType> = {
  fuego: 'fuego', agua: 'frio', planta: 'veneno', tierra: 'contundente', sombra: 'necrotico', luz: 'sagrado', hielo: 'frio', rayo: 'rayo',
};
export const PET_TYPE_COLOR: Record<string, string> = {
  fuego: '#ff8030', agua: '#60b0ff', planta: '#80d040', tierra: '#c8a060', sombra: '#a060ff', luz: '#fff0a0', hielo: '#a0e0ff', rayo: '#f8f040',
};
export const SPELL_COLORS: Partial<Record<DamageType, string>> = {
  fuego: '#ff8030', frio: '#80d0ff', rayo: '#f0f060', veneno: '#80d040', sagrado: '#fff0a0', necrotico: '#a040ff', arcano: '#c080ff',
};

/** Valores de combate del compañero (escalan con tu nivel). */
export function allyStatsFor(def: CompanionDef | null, level: number): { maxHp: number; toHit: number; dmgBonus: number; ac: number } {
  if (!def) return { maxHp: 1, toHit: 0, dmgBonus: 0, ac: 10 };
  return {
    maxHp: def.hpBase + def.hpPerLevel * (level - 1),
    toHit: def.attack.toHit + Math.floor((level - 1) / 4),
    dmgBonus: Math.floor(level / 3),
    ac: def.ac + Math.floor(level / 5),
  };
}

/** Peso al elegir objetivo: el jugador es el más probable. */
const TARGET_WEIGHT: Record<CombatantKind, number> = { player: 3, ally: 2, pet: 1, enemy: 1 };
/** Máximo de enemigos a la vez (las invocaciones no se acumulan sin fin). */
const MAX_FOES = 6;

export class Battle {
  readonly state: GameState;
  readonly rng: Rng;
  readonly combatants: Combatant[] = [];
  readonly dungeonId: string | undefined;
  /** Ronda en curso (empieza en 1). */
  round = 0;
  ended = false;
  outcome: BattleOutcome | null = null;
  /** Al jugador le toca elegir. */
  awaiting: Combatant | null = null;
  /** Movimiento de la mascota ordenado para su próximo turno. */
  petOrder: string | null = null;
  /** «Inseparable»: ya resistió un golpe mortal en este combate. */
  private petResisted = false;
  readonly result: BattleResult;
  private get cls() {
    return getClass(this.state.player.classId);
  }
  private queue: Combatant[] = [];
  private qi = 0;
  private events: BattleEvent[] = [];
  private freeStrike = false;

  constructor(opt: BattleOptions) {
    this.state = opt.state;
    this.rng = opt.rng;
    this.dungeonId = opt.dungeonId;
    const p = this.state.player;
    this.result = { outcome: 'victory', xp: 0, petXp: 0, gold: 0, items: [], kills: [], removed: [], boundActivePet: false, rounds: 0 };
    this.add({ id: 'player', kind: 'player', side: 'party', name: p.name });
    const cd = this.companionDef;
    if (cd && !this.state.party.down && this.state.party.hp > 0) this.add({ id: 'ally', kind: 'ally', side: 'party', name: cd.name });
    const pi = this.petInstance;
    if (pi && !pi.down && pi.hp > 0) this.add({ id: 'pet', kind: 'pet', side: 'party', name: Pets.petName(pi) });
    for (const e of opt.enemies) {
      if (e.hp <= 0) continue;
      this.add({ id: `e${e.uid}`, kind: 'enemy', side: 'foe', name: e.def.name, enemy: e, boss: !!e.def.boss });
    }
  }

  // ============================================================== consultas
  get companionDef(): CompanionDef | null {
    const id = this.state.party?.active;
    return id ? (COMPANIONS.get(id) ?? null) : null;
  }
  get petInstance(): Pets.PetInstance | null {
    return this.state.pets?.active ?? null;
  }
  get derived(): Derived {
    return derive(this.state.player);
  }
  get player(): Combatant {
    return this.get('player')!;
  }

  get(id: string): Combatant | undefined {
    return this.combatants.find((c) => c.id === id);
  }
  alive(side?: Side): Combatant[] {
    return this.combatants.filter((c) => !c.dead && (!side || c.side === side));
  }
  foes(): Combatant[] {
    return this.alive('foe');
  }
  party(): Combatant[] {
    return this.alive('party');
  }

  hp(c: Combatant): number {
    switch (c.kind) {
      case 'player': return this.state.player.hp;
      case 'ally': return this.state.party.down ? 0 : this.state.party.hp;
      case 'pet': return this.petInstance && !this.petInstance.down ? this.petInstance.hp : 0;
      default: return Math.max(0, c.enemy!.hp);
    }
  }
  maxHp(c: Combatant): number {
    switch (c.kind) {
      case 'player': return this.state.player.maxHp;
      case 'ally': return allyStatsFor(this.companionDef, this.state.player.level).maxHp;
      case 'pet': return this.petStatsNow(c).hp;
      default: return c.enemy!.maxHp;
    }
  }
  mp(): { value: number; max: number } {
    return { value: this.state.player.mp, max: this.state.player.maxMp };
  }
  private setHp(c: Combatant, v: number): void {
    const hp = Math.max(0, Math.min(this.maxHp(c), v));
    switch (c.kind) {
      case 'player': this.state.player.hp = hp; break;
      case 'ally':
        this.state.party.hp = hp;
        if (hp <= 0) this.state.party.down = true;
        break;
      case 'pet':
        if (this.petInstance) {
          this.petInstance.hp = hp;
          if (hp <= 0) this.petInstance.down = true;
        }
        break;
      default: c.enemy!.hp = hp;
    }
  }

  buffTotal(c: Combatant, stat: BattleBuff['stat']): number {
    return c.buffs.filter((b) => b.stat === stat).reduce((s, b) => s + b.amount, 0);
  }

  /** Poder pasivo de la mascota activa (si está en pie). */
  get petPassive() {
    const pi = this.petInstance;
    return pi && !pi.down ? Pets.getSpecies(pi.species).passive ?? null : null;
  }

  private bondTier(): number {
    return this.petInstance ? Pets.bondTier(this.petInstance.bond) : 0;
  }

  petStatsNow(c: Combatant): PetStats {
    const pi = this.petInstance;
    const st = pi ? Pets.petStats(pi) : { hp: 1, atk: 0, def: 0, spd: 0, mag: 0 };
    for (const b of c.petBuffs) st[b.stat] += b.amount;
    const ps = this.petPassive;
    if (ps?.id === 'furia' && this.hp(c) < this.maxHp(c) / 2) {
      st.atk += ps.power;
      st.mag += ps.power;
    }
    return st;
  }

  ac(c: Combatant): number {
    const slow = hasStatus(c.statuses, 'ralentizado') ? 2 : 0;
    const buff = this.buffTotal(c, 'ca') + (c.defending ? 2 : 0) - slow;
    switch (c.kind) {
      case 'player': return this.derived.ac + buff + (this.petPassive?.id === 'vigia' ? this.petPassive.power : 0);
      case 'ally': return allyStatsFor(this.companionDef, this.state.player.level).ac + buff;
      case 'pet': return 10 + Math.floor(this.petStatsNow(c).def / 2) + buff;
      default: return c.enemy!.def.ac + buff;
    }
  }

  /** Iniciativa: DES + bonos (más alta = antes). Los enemigos rápidos, como el lobo, superan al héroe medio. */
  initiative(c: Combatant): number {
    let v: number;
    switch (c.kind) {
      case 'player': {
        const p = this.state.player;
        v = 10 + 2 * abilityModifier(this.derived.stats.DES);
        for (const t of talentEffects(p, 'movement')) v += t.amount;
        v += getBackground(p.background ?? '')?.movement ?? 0;
        break;
      }
      case 'ally': v = (this.companionDef?.role === 'ranged' ? 12 : 10) + Math.floor(this.state.player.level / 4); break;
      case 'pet': v = 8 + Math.floor(this.petStatsNow(c).spd / 2); break;
      default: {
        const d = c.enemy!.def;
        v = 6 + d.speed * 5 + Math.floor(d.level / 4) + (d.slow ? -4 : 0);
      }
    }
    if (hasStatus(c.statuses, 'ralentizado')) v -= 5;
    return v;
  }

  private sortedRound(): Combatant[] {
    return this.alive()
      .map((c, i) => ({ c, i, v: this.initiative(c) }))
      .sort((a, b) => b.v - a.v || (a.c.side === b.c.side ? a.i - b.i : a.c.side === 'party' ? -1 : 1))
      .map((x) => x.c);
  }

  /** Próximos `n` actores (incluye al que está actuando/esperando). */
  upcoming(n = 8): string[] {
    const out: string[] = [];
    if (this.awaiting) out.push(this.awaiting.id);
    for (let i = this.qi; i < this.queue.length; i++) if (!this.queue[i]!.dead) out.push(this.queue[i]!.id);
    let guard = 0;
    while (out.length < n && guard++ < 6) {
      const r = this.sortedRound();
      if (!r.length) break;
      for (const c of r) out.push(c.id);
    }
    return out.slice(0, n);
  }

  drain(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  private emit(e: BattleEvent): void {
    this.events.push(e);
  }

  private add(o: { id: string; kind: CombatantKind; side: Side; name: string; enemy?: Enemy; boss?: boolean }): Combatant {
    const c: Combatant = {
      id: o.id, kind: o.kind, side: o.side, name: o.name, statuses: [], buffs: [], cooldowns: {}, petBuffs: [],
      defending: false, stealth: 0, skipNext: false, dead: false, boss: o.boss ?? false, ...(o.enemy ? { enemy: o.enemy } : {}),
    };
    this.combatants.push(c);
    return c;
  }

  // ============================================================ bucle de turnos
  /**
   * Avanza la batalla hasta que le toca al jugador o termina.
   * Devuelve false si no había nada que avanzar (esperando al jugador o acabada).
   */
  step(): boolean {
    if (this.ended || this.awaiting) return false;
    let guard = 0;
    while (!this.ended && !this.awaiting && guard++ < 200) {
      let c = this.queue[this.qi++];
      while (c && c.dead) c = this.queue[this.qi++];
      if (!c) {
        this.newRound();
        continue;
      }
      this.beginTurn(c);
      if (this.awaiting || this.ended) return true;
      this.actAI(c);
      this.finishTurn(c);
      return true;
    }
    return true;
  }

  private newRound(): void {
    this.round++;
    this.result.rounds = this.round;
    this.queue = this.sortedRound();
    this.qi = 0;
    // Regeneración de talentos del jugador cada N rondas.
    const p = this.state.player;
    if (this.round > 1 && !this.player.dead) {
      for (const r of talentEffects(p, 'regen')) {
        if (this.round % r.every === 0 && p.hp < p.maxHp) this.heal(this.player, r.amount, true);
      }
    }
  }

  private beginTurn(c: Combatant): void {
    c.defending = false;
    this.emit({ t: 'turn', id: c.id, order: this.upcomingFrom(c) });
    // Daño por estados
    const tick = tickStatuses(this.rng, c.statuses);
    for (const part of tick.parts) {
      this.rawDamage(c, part.amount, { tag: 'estado' });
      if (c.dead) return;
    }
    if (this.ended) return;
    // Aturdido: pierde el turno. Ralentizado: actúa uno de cada dos.
    if (consumeStun(c.statuses)) {
      this.emit({ t: 'say', text: `${c.name}: aturdido` });
      this.skipTurn(c);
      return;
    }
    if (hasStatus(c.statuses, 'ralentizado')) {
      c.skipNext = !c.skipNext;
      if (c.skipNext) {
        this.emit({ t: 'say', text: `${c.name}: ralentizado` });
        this.skipTurn(c);
        return;
      }
    } else c.skipNext = false;
    if (c.kind === 'player') this.awaiting = c;
  }

  private skipping = new Set<Combatant>();
  private skipTurn(c: Combatant): void {
    this.skipping.add(c);
  }

  private upcomingFrom(c: Combatant): string[] {
    const out: string[] = [c.id];
    for (let i = this.qi; i < this.queue.length; i++) if (!this.queue[i]!.dead) out.push(this.queue[i]!.id);
    for (const x of this.sortedRound()) out.push(x.id);
    return out.slice(0, 8);
  }

  private finishTurn(c: Combatant): void {
    this.skipping.delete(c);
    for (const k of Object.keys(c.cooldowns)) c.cooldowns[k] = Math.max(0, (c.cooldowns[k] ?? 0) - 1);
    for (const b of c.buffs) b.turns--;
    c.buffs = c.buffs.filter((b) => b.turns > 0);
    for (const b of c.petBuffs) b.turns--;
    c.petBuffs = c.petBuffs.filter((b) => b.turns > 0);
    if (c.stealth > 0) c.stealth--;
    if (!c.dead) this.emit({ t: 'done', id: c.id });
    this.checkEnd();
  }

  private actAI(c: Combatant): void {
    if (this.ended || c.dead || this.skipping.has(c)) return;
    if (c.kind === 'enemy') this.enemyAct(c);
    else if (c.kind === 'ally') this.allyAct(c);
    else if (c.kind === 'pet') this.petAct(c);
  }

  private checkEnd(): void {
    if (this.ended) return;
    if (this.player.dead || this.state.player.hp <= 0) return this.finish('defeat');
    if (this.foes().length === 0) this.finish('victory');
  }

  private finish(outcome: BattleOutcome): void {
    if (this.ended) return;
    this.ended = true;
    this.outcome = outcome;
    this.awaiting = null;
    this.result.outcome = outcome;
    if (outcome === 'defeat') (this.state.record ??= emptyRecord()).deaths++;
    this.emit({ t: 'end', outcome });
  }

  // ============================================================== daño y curación
  private rawDamage(t: Combatant, amount: number, o: { tag?: 'estado' | 'mitad' | '' } = {}): void {
    const before = this.hp(t);
    this.setHp(t, before - amount);
    const killed = this.hp(t) <= 0;
    this.emit({ t: 'hit', id: t.id, amount, hp: this.hp(t), crit: false, tag: o.tag ?? '', killed });
    if (killed) this.kill(t, null, 'other');
  }

  /** Daño con defensas (resistencias/vulnerabilidades de enemigos), eventos y muerte. */
  damage(t: Combatant, raw: number, type: DamageType, o: { crit?: boolean; src?: Combatant | null; ctx?: 'weapon' | 'spell' | 'ally' | 'other'; half?: boolean } = {}): number {
    const d = t.kind === 'enemy' ? applyDefenses(raw, type, t.enemy!.def) : { amount: raw, note: '' as const };
    let amount = Math.max(1, d.amount);
    if (t.kind === 'pet') {
      const ps = this.petPassive;
      if (ps?.id === 'tenaz') amount = Math.max(1, amount - ps.power);
      if (amount >= this.hp(t) && this.hp(t) > 1 && this.bondTier() >= 3 && !this.petResisted) {
        this.petResisted = true;
        amount = this.hp(t) - 1;
        this.emit({ t: 'info', text: `¡${t.name} aguanta por ti!`, kind: 'good' });
      }
    }
    this.setHp(t, this.hp(t) - amount);
    const killed = this.hp(t) <= 0;
    const tag = d.note === 'vulnerable' ? 'vulnerable' : d.note === 'resiste' ? 'resiste' : o.half ? 'mitad' : '';
    this.emit({ t: 'hit', id: t.id, amount, hp: this.hp(t), crit: !!o.crit, tag, dmgType: type, killed });
    if (killed) this.kill(t, o.src ?? null, o.ctx ?? 'other');
    else if (t.kind === 'enemy') this.bossPhase(t);
    return amount;
  }

  heal(t: Combatant, amount: number, quiet = false): number {
    const before = this.hp(t);
    this.setHp(t, before + amount);
    const got = this.hp(t) - before;
    if (!quiet || got > 0) this.emit({ t: 'heal', id: t.id, amount: got, hp: this.hp(t) });
    return got;
  }

  private applyStatus(t: Combatant, s: StatusApply): boolean {
    const immune = t.kind === 'enemy' ? (t.enemy!.def.immune ?? []) : t.kind === 'player' ? talentEffects(this.state.player, 'immune').map((x) => x.status) : [];
    if (t.dead || !tryApplyStatus(this.rng, t.statuses, s, immune)) return false;
    this.emit({ t: 'status', id: t.id, status: s.id });
    return true;
  }

  private kill(t: Combatant, src: Combatant | null, ctx: 'weapon' | 'spell' | 'ally' | 'other'): void {
    if (t.dead) return;
    t.dead = true;
    t.statuses = [];
    this.emit({ t: 'death', id: t.id });
    if (t.kind === 'player') {
      this.finish('defeat');
      return;
    }
    if (t.kind === 'ally') {
      this.state.party.down = true;
      this.emit({ t: 'info', text: `${t.name} cae al suelo.`, kind: 'warn' });
      return;
    }
    if (t.kind === 'pet') {
      this.emit({ t: 'info', text: `${t.name} está debilitada.`, kind: 'warn' });
      return;
    }
    const e = t.enemy!;
    e.hp = 0;
    const st = this.state;
    const lvl = st.player.level;
    this.result.kills.push(e);
    if (!this.result.removed.includes(e)) this.result.removed.push(e);
    this.result.xp += xpForKill(e.def.xp, e.def.level, lvl);
    const pi = this.petInstance;
    if (pi && !pi.down) this.result.petXp += Math.round(xpForKill(e.def.xp, e.def.level, pi.level) * 0.6);
    const rec = (st.record ??= emptyRecord());
    rec.kills++;
    this.emit({ t: 'info', text: `${e.def.name} cae derrotado.`, kind: 'good' });
    if (e.def.boss) {
      rec.bosses++;
      st.flags[`boss_${e.def.id}`] = true;
      if (this.dungeonId) {
        // El progreso de la mazmorra lo marca la partida al terminar (ver Game.finishBattle).
        this.emit({ t: 'info', text: `¡Has vencido a ${e.def.name}!`, kind: 'good' });
      }
    }
    void Quests.onKill(st, e.def);
    const loot = rollLoot(this.rng, e.def.lootTable, e.def.level);
    this.giveLoot(loot.items, loot.gold);
    // Talentos «al matar» (sólo si lo has matado tú).
    if (src?.kind === 'player' && (ctx === 'weapon' || ctx === 'spell')) this.onKillTalents(e, ctx);
    this.checkEnd();
  }

  private giveLoot(items: ItemInstance[], gold: number): void {
    const p = this.state.player;
    p.gold += gold;
    this.result.gold += gold;
    for (const it of items) {
      const qty = it.qty;
      const rest = addItem(p, it);
      if (rest < qty) {
        const def = itemDef(it);
        this.result.items.push({ name: def.name, qty: qty - rest, rarity: it.rarity });
        void Quests.collectNotes(this.state, it.id);
      }
    }
  }

  private onKillTalents(dead: Enemy, ctx: 'weapon' | 'spell'): void {
    const p = this.state.player;
    const me = this.player;
    for (const t of talentEffects(p, 'onKill')) {
      if (t.restore) {
        p.mp = Math.min(p.maxMp, p.mp + t.restore);
        this.emit({ t: 'mp', id: me.id, amount: t.restore });
      }
      if (t.heal) this.heal(me, t.heal, true);
      if (t.stealth) {
        me.stealth = Math.max(me.stealth, t.stealth + 1);
        this.emit({ t: 'info', text: 'Te desvaneces entre las sombras.', kind: 'good' });
      }
      if (t.cleave && ctx === 'weapon' && !this.freeStrike) {
        const next = this.foes().find((f) => f.enemy !== dead);
        if (next) {
          this.freeStrike = true;
          this.emit({ t: 'say', text: '¡Carnicería!' });
          this.weaponAttack(me, next, {});
          this.freeStrike = false;
        }
      }
    }
  }

  // ===================================================================== jefes
  private bossPhase(t: Combatant): void {
    const e = t.enemy!;
    const phases = e.def.phases ?? [];
    while (e.phase < phases.length && e.hp / e.maxHp < phases[e.phase]!.hpBelow) {
      const ph = phases[e.phase]!;
      e.phase++;
      this.emit({ t: 'phase', id: t.id, text: ph.message });
      e.toHitBonus += ph.toHitBonus ?? 0;
      e.damageBonus += ph.damageBonus ?? 0;
      if (ph.heal) this.heal(t, Math.round(e.maxHp * ph.heal));
      if (ph.summon) this.summon(t, ph.summon.enemy, ph.summon.count);
    }
  }

  private summon(by: Combatant, id: string, count: number): void {
    const def = getEnemy(id);
    if (!def) return;
    for (let i = 0; i < count && this.foes().length < MAX_FOES; i++) {
      const e = createEnemy(def, 0, 0, this.rng);
      e.alerted = true;
      const c = this.add({ id: `e${e.uid}`, kind: 'enemy', side: 'foe', name: def.name, enemy: e, boss: !!def.boss });
      this.emit({ t: 'summon', id: c.id });
    }
    void by;
  }

  // ========================================================== habilidades del jugador
  /** Habilidades desbloqueadas con su estado actual. */
  skills(): Array<{ skill: SkillDef; cost: number; usable: boolean; reason: string | null; target: TargetKind }> {
    return unlockedSkills(this.cls, this.state.player.level).map((skill) => {
      const reason = this.skillBlockedReason(skill);
      return { skill, cost: this.skillCost(skill), usable: !reason, reason, target: this.skillTarget(skill) };
    });
  }

  skillCost(skill: SkillDef): number {
    return Math.max(0, skill.cost + skillMods(this.state.player, skill.id).reduce((a, m) => a + (m.costDelta ?? 0), 0));
  }

  skillBlockedReason(skill: SkillDef): string | null {
    const p = this.state.player;
    if (skill.unlockLevel > p.level) return `Se desbloquea a nivel ${skill.unlockLevel}.`;
    const cd = this.player.cooldowns[skill.id] ?? 0;
    if (cd > 0) return `${skill.name} se recarga (${cd}).`;
    if (p.mp < this.skillCost(skill)) return `Falta ${this.cls.resource.name.toLowerCase()}.`;
    return null;
  }

  /** Qué hay que tocar para usar la habilidad. */
  skillTarget(skill: SkillDef): TargetKind {
    const mods = skillMods(this.state.player, skill.id);
    const fx = skill.effects;
    const radius = (e: SkillEffect) => (e.type === 'spell' ? (e.radius ?? 0) + mods.reduce((a, m) => a + (m.radiusDelta ?? 0), 0) : 0);
    if (fx.some((e) => (e.type === 'spell' && radius(e) > 0) || (e.type === 'attack' && e.allAdjacent))) return 'allEnemies';
    if (fx.some((e) => e.type === 'heal' || e.type === 'buff' || e.type === 'cleanse')) return 'ally';
    if (fx.some((e) => e.type === 'stealth')) return 'self';
    return 'enemy';
  }

  /** Usa una habilidad de clase. `targetId`: enemigo o aliado según su tipo. */
  useSkill(skillId: string, targetId?: string): { ok: boolean; error?: string } {
    const chk = this.canCommand();
    if (chk) return { ok: false, error: chk };
    const skill = this.cls.skills.find((s) => s.id === skillId);
    if (!skill) return { ok: false, error: 'No conoces esa habilidad.' };
    const why = this.skillBlockedReason(skill);
    if (why) return { ok: false, error: why };
    const kind = this.skillTarget(skill);
    let target: Combatant | undefined;
    if (kind === 'enemy') {
      target = targetId ? this.get(targetId) : this.foes().length === 1 ? this.foes()[0] : undefined;
      if (!target || target.dead || target.side !== 'foe') return { ok: false, error: 'Elige un enemigo.' };
    } else if (kind === 'ally') {
      target = targetId ? this.get(targetId) : this.player;
      if (!target || target.side !== 'party' || (target.dead && !this.reviveOk(skill))) return { ok: false, error: 'Elige un aliado.' };
    } else target = this.player;
    const me = this.player;
    this.state.player.mp -= this.skillCost(skill);
    if (skill.cooldown > 0) me.cooldowns[skill.id] = skill.cooldown + 1;
    this.emit({ t: 'say', text: skill.name });
    for (const eff of skill.effects) this.applyEffect(me, skill, eff, target, kind);
    this.endPlayerAction();
    return { ok: true };
  }

  private reviveOk(_s: SkillDef): boolean {
    return false;
  }

  private applyEffect(me: Combatant, skill: SkillDef, eff: SkillEffect, target: Combatant, kind: TargetKind): void {
    const p = this.state.player;
    const mods = skillMods(p, skill.id);
    const modDice = mods.map((m) => m.extraDice).filter((x): x is string => !!x);
    const modStatus = mods.map((m) => m.applyStatus).filter((x): x is StatusApply => !!x);
    switch (eff.type) {
      case 'attack': {
        const targets = eff.allAdjacent ? this.foes() : [target];
        if (!targets[0]) break;
        this.emit({ t: 'attack', from: me.id, to: targets.map((t) => t.id), style: this.derived.weapon.range > 1 ? 'ranged' : 'melee', dmgType: this.derived.weapon.damageType });
        for (const t of targets) {
          for (let i = 0; i < (eff.hits ?? 1) && !t.dead; i++) {
            this.weaponAttack(me, t, {
              ...(eff.extraDice ? { extraDice: eff.extraDice } : {}),
              ...(eff.toHitBonus ? { toHitBonus: eff.toHitBonus } : {}),
              ...(eff.critRange ? { critRange: eff.critRange } : {}),
              ...(eff.applyStatus ? { applyStatus: eff.applyStatus } : {}),
              moreDice: modDice, moreStatus: modStatus, noAnim: true,
            });
          }
        }
        break;
      }
      case 'spell': {
        const damageType = mods.find((m) => m.damageType)?.damageType ?? eff.damageType;
        const color = SPELL_COLORS[damageType] ?? '#ffffff';
        const radius = (eff.radius ?? 0) > 0 ? (eff.radius ?? 0) + mods.reduce((a, m) => a + (m.radiusDelta ?? 0), 0) : 0;
        const hits = Math.max(1, (eff.hits ?? 1) + mods.reduce((a, m) => a + (m.hitsDelta ?? 0), 0));
        const power = talentEffects(p, 'spellPower').filter((t) => t.damageType === damageType).reduce((a, t) => a + t.amount, 0);
        let targets: Combatant[];
        if (radius > 0) targets = this.areaTargets(kind === 'allEnemies' ? undefined : target, radius);
        else targets = [target];
        const bounce = mods.reduce((a, m) => a + (m.bounce ?? 0), 0);
        if (radius === 0 && bounce > 0) {
          const others = this.foes().filter((f) => f !== target).slice(0, bounce);
          if (others.length) this.emit({ t: 'info', text: '¡El hechizo rebota!', kind: 'good' });
          targets = [...targets, ...others];
        }
        this.emit({ t: 'attack', from: me.id, to: targets.map((t) => t.id), style: 'cast', dmgType: damageType, color });
        const mod = abilityModifier(this.derived.stats[eff.stat]);
        const dc = 8 + proficiencyBonus(p.level) + mod;
        for (const t of targets) {
          for (let i = 0; i < hits && !t.dead; i++) {
            let dmg = roll(this.rng, eff.dice).total + (hits > 1 ? 0 : Math.max(0, mod)) + power;
            for (const extra of modDice) dmg += roll(this.rng, extra).total;
            let saved = false;
            if (eff.save && t.enemy) {
              saved = savingThrow(this.rng, enemySave(t.enemy, eff.save), dc).success;
              if (saved) dmg = Math.max(1, Math.floor(dmg / 2));
            }
            this.damage(t, dmg, damageType, { src: me, ctx: 'spell', half: saved });
            if (!t.dead && !saved) {
              if (eff.applyStatus) this.applyStatus(t, eff.applyStatus);
              for (const st of modStatus) this.applyStatus(t, st);
              const burn = mods.reduce((a, m) => Math.max(a, m.burnGround ?? 0), 0);
              if (burn > 0 && radius > 0 && i === 0) this.applyStatus(t, { id: 'quemado', turns: burn });
            }
          }
        }
        break;
      }
      case 'heal': {
        let amount = Math.max(1, roll(this.rng, eff.dice).total + (eff.stat ? abilityModifier(this.derived.stats[eff.stat]) : 0) + (eff.perLevel ?? 0) * p.level);
        for (const extra of modDice) amount += roll(this.rng, extra).total;
        this.emit({ t: 'attack', from: me.id, to: [target.id], style: 'self', color: '#60e070' });
        this.heal(target, amount);
        for (const t of talentEffects(p, 'healSmite')) {
          const undead = this.foes().filter((f) => f.enemy!.def.family === 'no-muerto');
          for (const u of undead) this.damage(u, roll(this.rng, t.dice).total, 'sagrado', { src: me, ctx: 'spell' });
        }
        break;
      }
      case 'buff':
        this.emit({ t: 'attack', from: me.id, to: [target.id], style: 'self', color: '#f2d888' });
        target.buffs.push({ stat: eff.stat, amount: eff.amount, turns: eff.turns + 1 });
        this.emit({ t: 'buff', id: target.id, text: `+${eff.amount} ${eff.stat === 'ca' ? 'CA' : eff.stat}` });
        break;
      case 'stealth':
        me.stealth = eff.turns + 1;
        this.emit({ t: 'attack', from: me.id, to: [me.id], style: 'self', color: '#8070a0' });
        this.emit({ t: 'buff', id: me.id, text: 'Sigilo' });
        break;
      case 'cleanse':
        target.statuses = [];
        this.emit({ t: 'buff', id: target.id, text: 'Purificado' });
        break;
    }
  }

  /** Enemigos alcanzados por un área: radio ≥ 2 = todos; radio 1 = el objetivo y sus vecinos. */
  private areaTargets(center: Combatant | undefined, radius: number): Combatant[] {
    const foes = this.foes();
    if (!center || radius >= 2) return foes;
    const i = foes.indexOf(center);
    return foes.filter((_, j) => Math.abs(j - i) <= radius);
  }

  // ============================================================== ataque con arma
  /** Ataque básico del jugador. */
  attack(targetId: string): { ok: boolean; error?: string } {
    const chk = this.canCommand();
    if (chk) return { ok: false, error: chk };
    const t = this.get(targetId);
    if (!t || t.dead || t.side !== 'foe') return { ok: false, error: 'Elige un enemigo.' };
    this.emit({ t: 'say', text: this.derived.weapon.name });
    this.weaponAttack(this.player, t, {});
    this.endPlayerAction();
    return { ok: true };
  }

  private weaponAttack(
    me: Combatant, t: Combatant,
    opt: { extraDice?: string; moreDice?: string[]; toHitBonus?: number; critRange?: number; applyStatus?: StatusApply; moreStatus?: StatusApply[]; noAnim?: boolean },
  ): void {
    const d = this.derived;
    const weapon = d.weapon;
    const p = this.state.player;
    if (!opt.noAnim) this.emit({ t: 'attack', from: me.id, to: [t.id], style: weapon.range > 1 ? 'ranged' : 'melee', dmgType: weapon.damageType });
    let mode: RollMode = 'normal';
    const adv = me.stealth > 0;
    const dis = hasStatus(me.statuses, 'veneno');
    if (adv && !dis) mode = 'ventaja';
    if (dis && !adv) mode = 'desventaja';
    if (adv) me.stealth = 0;
    const toHit = d.toHit + this.buffTotal(me, 'ataque') + (opt.toHitBonus ?? 0);
    const critRange = Math.min(weapon.critRange, opt.critRange ?? 20);
    const r = attackRoll(this.rng, toHit, this.ac(t), mode, critRange);
    if (!r.hit) {
      this.emit({ t: 'miss', id: t.id, text: r.fumble ? '¡Pifia!' : 'Fallo' });
      return;
    }
    let bonus = d.damageMod + this.buffTotal(me, 'daño');
    for (const b of talentEffects(p, 'berserk')) if (p.hp <= (p.maxHp * b.threshold) / 100) bonus += b.damage;
    let dmg = damageRoll(this.rng, weapon.dice, bonus, r.crit).total;
    if (opt.extraDice) dmg += damageRoll(this.rng, opt.extraDice, 0, r.crit).total;
    for (const extra of opt.moreDice ?? []) dmg += damageRoll(this.rng, extra, 0, r.crit).total;
    const dealt = this.damage(t, dmg, weapon.damageType, { crit: r.crit, src: me, ctx: 'weapon' });
    const steal = talentEffects(p, 'lifesteal').reduce((a, x) => a + x.pct, 0);
    if (steal > 0) this.heal(me, Math.max(1, Math.round((dealt * steal) / 100)), true);
    if (t.dead) return;
    if (opt.applyStatus) this.applyStatus(t, opt.applyStatus);
    for (const st of opt.moreStatus ?? []) this.applyStatus(t, st);
    if (r.crit) for (const c of talentEffects(p, 'onCrit')) this.applyStatus(t, c.status);
    for (const ps of talentEffects(p, 'poisonStrike')) this.applyStatus(t, { id: 'veneno', chance: ps.chance, turns: ps.turns });
    if (adv && talentEffects(p, 'stealthStun').length) {
      this.emit({ t: 'info', text: '¡Golpe desde la sombra!', kind: 'good' });
      this.applyStatus(t, { id: 'aturdido', turns: 1 });
    }
  }

  // ================================================================= otras acciones
  defend(): { ok: boolean; error?: string } {
    const chk = this.canCommand();
    if (chk) return { ok: false, error: chk };
    this.player.defending = true;
    this.emit({ t: 'say', text: 'Defender' });
    this.emit({ t: 'defend', id: 'player' });
    this.endPlayerAction();
    return { ok: true };
  }

  /** Huir: DES + competencia contra CD 10 + nivel del enemigo más fuerte. Los jefes no te dejan. */
  flee(): { ok: boolean; error?: string; success?: boolean } {
    const chk = this.canCommand();
    if (chk) return { ok: false, error: chk };
    const foes = this.foes();
    if (foes.some((f) => f.boss)) return { ok: false, error: '¡No puedes huir de este enemigo!' };
    const dc = 10 + Math.max(...foes.map((f) => f.enemy!.def.level));
    const bonus = abilityModifier(this.derived.stats.DES) + proficiencyBonus(this.state.player.level);
    const s = savingThrow(this.rng, bonus, dc);
    this.emit({ t: 'say', text: 'Huir' });
    this.emit({ t: 'flee', success: s.success });
    if (s.success) {
      this.finish('fled');
      return { ok: true, success: true };
    }
    this.emit({ t: 'info', text: 'No consigues escapar...', kind: 'warn' });
    this.endPlayerAction();
    return { ok: true, success: false };
  }

  /** Objetos usables en batalla. */
  usableItems(): ItemInstance[] {
    return this.state.player.inventory.filter((it) => {
      const u = itemDef(it).use;
      return !!u && !u.outOfCombatOnly;
    });
  }

  itemTarget(it: ItemInstance): TargetKind {
    const u = itemDef(it).use;
    if (u?.bind) return 'enemy';
    if (u?.heal || u?.cleanse || u?.buff) return 'ally';
    return 'self';
  }

  useItem(uid: string, targetId?: string): { ok: boolean; error?: string } {
    const chk = this.canCommand();
    if (chk) return { ok: false, error: chk };
    const p = this.state.player;
    const it = p.inventory.find((x) => x.uid === uid);
    if (!it) return { ok: false, error: 'No tienes ese objeto.' };
    const def = itemDef(it);
    const use = def.use;
    if (!use) return { ok: false, error: 'Eso no se puede usar.' };
    if (use.outOfCombatOnly) return { ok: false, error: 'No puedes comer en pleno combate.' };
    const me = this.player;
    if (use.bind) return this.bind(it, targetId);
    const target = targetId ? this.get(targetId) : me;
    if (!target || target.side !== 'party' || target.dead) return { ok: false, error: 'Elige un aliado.' };
    this.emit({ t: 'say', text: def.name });
    this.emit({ t: 'attack', from: me.id, to: [target.id], style: 'self', color: '#60e070' });
    if (use.heal) this.heal(target, roll(this.rng, use.heal).total);
    if (use.restore) {
      const before = p.mp;
      p.mp = Math.min(p.maxMp, p.mp + roll(this.rng, use.restore).total);
      this.emit({ t: 'mp', id: me.id, amount: p.mp - before });
    }
    if (use.cleanse) {
      target.statuses = [];
      this.emit({ t: 'buff', id: target.id, text: 'Purificado' });
    }
    if (use.buff) {
      target.buffs.push({ ...use.buff, turns: use.buff.turns + 1 });
      this.emit({ t: 'buff', id: target.id, text: `+${use.buff.amount} ${use.buff.stat === 'ca' ? 'CA' : use.buff.stat}` });
    }
    removeQty(p, uid, 1);
    this.endPlayerAction();
    return { ok: true };
  }

  /** Runa de vínculo sobre una criatura salvaje. */
  private bind(rune: ItemInstance, targetId?: string): { ok: boolean; error?: string } {
    const t = targetId ? this.get(targetId) : this.foes().find((f) => f.enemy?.def.pet);
    if (!t || t.dead || t.side !== 'foe' || !t.enemy?.def.pet) return { ok: false, error: 'Elige una criatura salvaje.' };
    const e = t.enemy;
    removeQty(this.state.player, rune.uid, 1);
    const sp = Pets.getSpecies(e.def.pet!.species);
    const chance = Pets.captureChance(sp.rarity, e.hp / e.maxHp);
    this.emit({ t: 'say', text: 'Runa de vínculo' });
    this.emit({ t: 'attack', from: 'player', to: [t.id], style: 'cast', color: '#c080ff', dmgType: 'arcano' });
    if (!this.rng.chance(chance)) {
      this.emit({ t: 'info', text: `La runa brilla... pero ${sp.name} se libera.`, kind: 'warn' });
      this.endPlayerAction();
      return { ok: true };
    }
    t.dead = true;
    this.emit({ t: 'death', id: t.id });
    this.result.removed.push(e);
    const pet = Pets.createPet(sp.id, e.def.pet!.level);
    pet.hp = Math.max(1, Math.round(Pets.petStats(pet).hp * Math.max(0.3, e.hp / e.maxHp)));
    const where = Pets.addPet(this.state.pets, pet, Date.now());
    this.emit({
      t: 'info',
      text: where === 'lleno' ? `¡Vínculo logrado! Pero tu establo está lleno: ${sp.name} vuelve a la naturaleza.` : `¡${sp.name} se une a ti!${where === 'establo' ? ' Te espera en el establo.' : ''}`,
      kind: where === 'lleno' ? 'warn' : 'good',
    });
    if (where === 'activa') this.result.boundActivePet = true;
    void Quests.onBind(this.state, sp.id);
    this.result.xp += Math.round(e.def.xp * 0.5);
    this.endPlayerAction();
    return { ok: true };
  }

  /** Ordena un movimiento a la mascota para su próximo turno (no gasta turno). */
  setPetOrder(moveId: string | null): void {
    const pi = this.petInstance;
    this.petOrder = moveId && pi?.moves.includes(moveId) ? moveId : null;
  }

  private canCommand(): string | null {
    if (this.ended) return 'La batalla ha terminado.';
    if (!this.awaiting) return 'Espera tu turno.';
    return null;
  }

  private endPlayerAction(): void {
    const me = this.player;
    this.awaiting = null;
    this.finishTurn(me);
  }

  // ================================================================== IA enemiga
  private pickPartyTarget(): Combatant | null {
    const party = this.party();
    if (!party.length) return null;
    const exposed = party.filter((c) => !(c.kind === 'player' && c.stealth > 0));
    const pool = exposed.length ? exposed : party;
    const total = pool.reduce((s, c) => s + TARGET_WEIGHT[c.kind], 0);
    let r = this.rng.next() * total;
    for (const c of pool) {
      r -= TARGET_WEIGHT[c.kind];
      if (r <= 0) return c;
    }
    return pool[pool.length - 1]!;
  }

  private enemyAct(c: Combatant): void {
    const e = c.enemy!;
    for (const k of Object.keys(e.cooldowns)) e.cooldowns[k] = Math.max(0, (e.cooldowns[k] ?? 0) - 1);
    const ai = e.def.ai;
    if (ai === 'caster' || ai === 'boss') {
      for (const sp of e.def.spells ?? []) {
        if ((e.cooldowns[sp.id] ?? 0) > 0) continue;
        if (this.enemySpell(c, sp)) {
          e.cooldowns[sp.id] = sp.cooldown + 1;
          return;
        }
      }
    }
    const tgt = this.pickPartyTarget();
    if (!tgt) return;
    const atk = e.def.attack;
    this.emit({ t: 'say', text: atk.name });
    this.emit({ t: 'attack', from: c.id, to: [tgt.id], style: atk.range > 1 ? 'ranged' : 'melee', dmgType: atk.damageType });
    const mode: RollMode = hasStatus(c.statuses, 'veneno') ? 'desventaja' : 'normal';
    const r = attackRoll(this.rng, atk.toHit + e.toHitBonus, this.ac(tgt), mode);
    const p = this.state.player;
    if (!r.hit) {
      this.emit({ t: 'miss', id: tgt.id, text: r.fumble ? 'Pifia' : 'Esquiva' });
      if (tgt.kind === 'player' && atk.range === 1) {
        const counter = talentEffects(p, 'counter').reduce((a, t) => Math.max(a, t.chance), 0);
        if (counter > 0 && this.rng.chance(counter)) {
          this.emit({ t: 'info', text: '¡Contraataque!', kind: 'good' });
          this.weaponAttack(tgt, c, {});
        }
      }
      return;
    }
    if (tgt.kind === 'player') {
      const dodge = talentEffects(p, 'dodge').reduce((a, t) => a + t.chance, 0);
      if (dodge > 0 && this.rng.chance(Math.min(0.5, dodge))) {
        this.emit({ t: 'miss', id: tgt.id, text: '¡Esquiva!' });
        return;
      }
    }
    const dmg = damageRoll(this.rng, atk.dice, e.damageBonus, r.crit).total;
    this.damage(tgt, dmg, atk.damageType, { crit: r.crit, src: c });
    if (tgt.dead) return;
    if (atk.applyStatus) this.applyStatus(tgt, atk.applyStatus);
    if (tgt.kind === 'player' && atk.range === 1) {
      for (const t of talentEffects(p, 'thorns')) {
        if (c.dead) break;
        this.damage(c, roll(this.rng, t.dice).total, t.damageType, { src: tgt, ctx: 'other' });
      }
    }
  }

  private enemySpell(c: Combatant, sp: import('@/data/schema').EnemySpell): boolean {
    const e = c.enemy!;
    if (sp.kind === 'heal') {
      const ally = this.foes().find((a) => this.hp(a) < this.maxHp(a) * 0.5);
      if (!ally) return false;
      this.emit({ t: 'say', text: sp.name });
      this.emit({ t: 'attack', from: c.id, to: [ally.id], style: 'self', color: '#60e070' });
      this.heal(ally, roll(this.rng, sp.dice ?? '1d8').total);
      return true;
    }
    if (sp.kind === 'summon' && sp.summon) {
      if (this.foes().length >= MAX_FOES) return false;
      this.emit({ t: 'say', text: sp.name });
      this.emit({ t: 'attack', from: c.id, to: [c.id], style: 'self', color: '#a040ff' });
      this.summon(c, sp.summon.enemy, sp.summon.count);
      return true;
    }
    const tgt = this.pickPartyTarget();
    if (!tgt) return false;
    const type = sp.damageType ?? 'arcano';
    const targets = sp.radius ? this.party() : [tgt];
    this.emit({ t: 'say', text: sp.name });
    this.emit({ t: 'attack', from: c.id, to: targets.map((x) => x.id), style: 'cast', dmgType: type, color: SPELL_COLORS[type] ?? '#ffffff' });
    for (const t of targets) {
      let dmg = roll(this.rng, sp.dice ?? '1d6').total + e.damageBonus;
      let saved = false;
      if (sp.save && sp.dc && t.kind === 'player') {
        saved = savingThrow(this.rng, abilityModifier(this.derived.stats[sp.save]), sp.dc).success;
        if (saved) dmg = Math.max(1, Math.floor(dmg / 2));
      }
      this.damage(t, dmg, type, { src: c, half: saved });
      if (!t.dead && sp.applyStatus && !saved) this.applyStatus(t, sp.applyStatus);
    }
    return true;
  }

  // =============================================================== compañero y mascota
  private pickFoe(): Combatant | null {
    const foes = this.foes();
    if (!foes.length) return null;
    // Remata al más herido con algo de azar.
    if (this.rng.chance(0.5)) return [...foes].sort((a, b) => this.hp(a) / this.maxHp(a) - this.hp(b) / this.maxHp(b))[0]!;
    return this.rng.pick(foes);
  }

  private allyAct(c: Combatant): void {
    const def = this.companionDef;
    const t = this.pickFoe();
    if (!def || !t) return;
    const st = allyStatsFor(def, this.state.player.level);
    this.emit({ t: 'say', text: def.attack.name });
    this.emit({ t: 'attack', from: c.id, to: [t.id], style: def.attack.range > 1 ? 'ranged' : 'melee', dmgType: def.attack.damageType });
    const r = attackRoll(this.rng, st.toHit + this.buffTotal(c, 'ataque'), this.ac(t));
    if (!r.hit) {
      this.emit({ t: 'miss', id: t.id, text: 'Fallo' });
      return;
    }
    const dmg = damageRoll(this.rng, def.attack.dice, st.dmgBonus + this.buffTotal(c, 'daño'), r.crit).total;
    this.damage(t, dmg, def.attack.damageType, { crit: r.crit, src: c, ctx: 'ally' });
  }

  private petReady(c: Combatant): PetMoveDef[] {
    const pi = this.petInstance;
    if (!pi) return [];
    return pi.moves.map((m) => Pets.getMove(m)).filter((m): m is PetMoveDef => !!m && (c.cooldowns[m.id] ?? 0) <= 0);
  }

  private petAct(c: Combatant): void {
    const pi = this.petInstance;
    if (!pi || pi.down) return;
    const ps = this.petPassive;
    if (ps?.id === 'regen') this.heal(c, ps.power, true);
    if (ps?.id === 'cuidador' && this.state.player.hp < this.state.player.maxHp) this.heal(this.player, ps.power, true);
    const order = this.petOrder ? Pets.getMove(this.petOrder) : undefined;
    this.petOrder = null;
    const ready = this.petReady(c);
    const pl = this.state.player;
    const foes = this.foes();
    // Apoyo: curar / proteger / mejorar si hace falta.
    const supportPick = (): PetMoveDef | null => {
      const petHp = this.hp(c) / Math.max(1, this.maxHp(c));
      const selfHeal = ready.find((m) => m.kind === 'curar' && m.self);
      if (selfHeal && petHp < 0.45) return selfHeal;
      const heal = ready.find((m) => m.kind === 'curar' && !m.self);
      if (heal && pl.hp < pl.maxHp * 0.45) return heal;
      const shield = ready.find((m) => m.kind === 'proteger');
      if (shield && pl.hp < pl.maxHp * 0.7 && !this.player.buffs.some((b) => b.stat === 'ca')) return shield;
      const cleanse = ready.find((m) => m.kind === 'curar' && m.cleanse && !m.self);
      if (cleanse && this.player.statuses.length) return cleanse;
      const team = ready.find((m) => m.kind === 'mejora' && m.teamBuff && !this.player.buffs.some((b) => b.stat === m.teamBuff!.stat));
      if (team && this.rng.chance(0.5)) return team;
      const buff = ready.find((m) => m.kind === 'mejora' && m.buff);
      if (buff && !c.petBuffs.length && this.rng.chance(0.3)) return buff;
      return null;
    };
    if (order && ready.includes(order)) {
      if (order.kind !== 'daño') return this.usePetMove(c, order, null);
      const t = this.bestPetTarget(order);
      if (t) return this.usePetMove(c, order, t);
    }
    const sup = supportPick();
    if (sup) return this.usePetMove(c, sup, null);
    let best: { m: PetMoveDef; t: Combatant; score: number } | null = null;
    for (const m of ready) {
      if (m.kind !== 'daño') continue;
      for (const t of foes) {
        const mult = Pets.typeMultiplier(m.type, this.defenderType(t));
        const score = (m.dice ? this.avg(m.dice) : 3) * mult * (m.radius ? 1 + foes.length * 0.3 : 1) * (m.accuracy ?? 0.9) + (this.hp(t) <= 6 ? 2 : 0);
        if (!best || score > best.score) best = { m, t, score };
      }
    }
    if (best) this.usePetMove(c, best.m, best.t);
  }

  private avg(dice: string): number {
    const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(dice);
    if (!m) return 3;
    return Number(m[1]) * (Number(m[2]) + 1) / 2 + Number(m[3] ?? 0);
  }

  private defenderType(t: Combatant) {
    const d = t.enemy!.def;
    return d.pet ? Pets.getSpecies(d.pet.species).type : Pets.familyType(d.family);
  }

  private bestPetTarget(m: PetMoveDef): Combatant | null {
    const foes = this.foes();
    return [...foes].sort((a, b) => Pets.typeMultiplier(m.type, this.defenderType(b)) - Pets.typeMultiplier(m.type, this.defenderType(a)))[0] ?? null;
  }

  private usePetMove(c: Combatant, m: PetMoveDef, target: Combatant | null): void {
    const pi = this.petInstance!;
    const st = this.petStatsNow(c);
    if (m.cooldown > 0) c.cooldowns[m.id] = m.cooldown + 1 - (this.bondTier() >= 2 ? 1 : 0);
    const color = PET_TYPE_COLOR[m.type] ?? '#ffffff';
    this.emit({ t: 'say', text: m.name });
    if (m.kind === 'curar') {
      const amount = roll(this.rng, m.heal ?? '1d6').total + Math.floor(st.mag / 3);
      const to = m.self ? c : this.player;
      this.emit({ t: 'attack', from: c.id, to: [to.id], style: 'self', color: '#60e070' });
      this.heal(to, amount);
      if (m.cleanse && !m.self) to.statuses = [];
      return;
    }
    if (m.kind === 'proteger' && m.shield) {
      this.emit({ t: 'attack', from: c.id, to: ['player'], style: 'self', color });
      this.player.buffs.push({ stat: 'ca', amount: m.shield.amount, turns: m.shield.turns + 1 });
      this.emit({ t: 'buff', id: 'player', text: `+${m.shield.amount} CA` });
      return;
    }
    if (m.kind === 'mejora' && m.teamBuff) {
      this.emit({ t: 'attack', from: c.id, to: ['player'], style: 'self', color });
      this.player.buffs.push({ ...m.teamBuff, turns: m.teamBuff.turns + 1 });
      this.emit({ t: 'buff', id: 'player', text: `+${m.teamBuff.amount} ${m.teamBuff.stat}` });
      return;
    }
    if (m.kind === 'mejora' && m.buff) {
      this.emit({ t: 'attack', from: c.id, to: [c.id], style: 'self', color });
      c.petBuffs.push({ ...m.buff, turns: m.buff.turns + 1 });
      this.emit({ t: 'buff', id: c.id, text: `+${m.buff.amount}` });
      return;
    }
    if (!target) return;
    const targets = m.radius ? this.foes() : [target];
    this.emit({ t: 'attack', from: c.id, to: targets.map((x) => x.id), style: m.range > 1 ? 'cast' : 'melee', dmgType: PET_DAMAGE[m.type] ?? 'contundente', color });
    pi.bond = Math.min(100, pi.bond + 0.2);
    const hunter = this.petPassive?.id === 'cazador' ? this.petPassive.power : 0;
    for (const t of targets) {
      for (let h = 0; h < (m.hits ?? 1) && !t.dead; h++) {
        if (!this.rng.chance(m.accuracy ?? 0.9)) {
          this.emit({ t: 'miss', id: t.id, text: 'Fallo' });
          continue;
        }
        const mult = Pets.typeMultiplier(m.type, this.defenderType(t));
        const raw = roll(this.rng, m.dice ?? '1d4').total + Math.floor(st[m.stat ?? 'atk'] / 3) + (t.statuses.length ? hunter : 0);
        const dmg = Math.max(1, Math.round(raw * mult));
        if (mult > 1 && h === 0) this.emit({ t: 'info', text: '¡Muy eficaz!', kind: 'good' });
        const done = this.damage(t, dmg, PET_DAMAGE[m.type] ?? 'contundente', { src: c, ctx: 'ally' });
        if (m.drain) this.heal(c, Math.max(1, Math.round(done * m.drain)), true);
        if (!t.dead && m.applyStatus) this.applyStatus(t, m.applyStatus);
      }
    }
  }

  // ===================================================================== utilidades
  /** Para tests y modo automático: juega hasta que acabe usando ataques básicos. */
  autoPlay(maxRounds = 60): BattleResult {
    let guard = 0;
    while (!this.ended && guard++ < maxRounds * 12) {
      this.step();
      if (this.awaiting) {
        const t = this.foes()[0];
        if (!t) break;
        this.attack(t.id);
      }
    }
    return this.result;
  }

  /** Nombre del estado para etiquetas. */
  static statusName(id: StatusId): string {
    return STATUS_INFO[id].name;
  }
}
