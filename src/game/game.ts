/**
 * NÚCLEO DE LA PARTIDA (sin DOM)
 * ------------------------------
 * Mantiene el estado, la zona actual, los enemigos y el sistema de TURNOS:
 *   turno del jugador (moverse, atacar, habilidad, esperar, huir)
 *     → turno de cada enemigo (con una breve pausa visual si está en combate)
 *     → inicio del turno del jugador (estados, regeneración, encuentros)
 * El combate ocurre en el mismo mapa, sin cambiar de pantalla.
 */
import { getClass, getEnemy, getZoneDef } from '@/data/registry';
import type { DamageType, EnemySpell, SkillDef, SkillEffect, StatusApply } from '@/data/schema';
import { Emitter } from '@/engine/events';
import { findPath, type Point } from '@/engine/pathfinding';
import { Rng, hashString } from '@/engine/rng';
import { createEnemy, enemySave, type Enemy } from './combat/entities';
import {
  applyDefenses,
  attackRoll,
  damageRoll,
  dangerLevel,
  dist,
  hasLineOfSight,
  savingThrow,
  xpForKill,
  type RollMode,
} from './combat/rules';
import { STATUS_INFO, consumeStun, hasStatus, tickStatuses, tryApplyStatus, type StatusInstance } from './combat/status';
import { armorClass, attackBonus, attributePointsAtLevel, proficiencyBonus, unlockedSkills } from './rules/character';
import { abilityModifier, roll } from './rules/dice';
import { levelForXp } from './rules/progression';
import { recalcPlayer, type GameState } from './state';
import { buildZone, type Zone, type ZoneExit } from './world/zone';

export type MsgKind = 'info' | 'warn' | 'good' | 'combat';

/** Datos de una tirada para animarla en pantalla. */
export interface DiceEvent {
  label: string;
  natural: number;
  bonus: number;
  total: number;
  /** Contra qué (CA o CD); null si no aplica. */
  target: number | null;
  targetLabel: 'CA' | 'CD' | '';
  outcome: 'crit' | 'hit' | 'miss' | 'fumble' | 'success' | 'fail';
}

export interface LevelUpEvent {
  level: number;
  hpGain: number;
  mpGain: number;
  points: number;
  skills: SkillDef[];
}

export interface GameEvents extends Record<string, unknown> {
  zoneChanged: { zone: Zone; firstVisit: boolean };
  turn: { turn: number };
  message: { text: string; kind?: MsgKind };
  dice: DiceEvent;
  levelUp: LevelUpEvent;
  playerDied: { cause: string };
  /** Recibió daño (para vibración). */
  playerHurt: { amount: number };
}

/** Efectos visuales efímeros (el renderizador los dibuja). */
export type Fx =
  | { kind: 'text'; x: number; y: number; text: string; color: string; t: number; life: number }
  | { kind: 'bolt'; fx: number; fy: number; tx: number; ty: number; color: string; t: number; life: number }
  | { kind: 'burst'; x: number; y: number; radius: number; color: string; t: number; life: number };

/** Estado visual del jugador (no se guarda; se reconstruye al cargar). */
export interface PlayerView {
  rx: number;
  ry: number;
  facing: 'left' | 'right';
  stepT: number;
  from: Point;
  to: Point;
  path: Point[];
  target: Point | null;
  bumpT: number;
  bumpDx: number;
  bumpDy: number;
  flashT: number;
}

/** Estado de combate del jugador que no se guarda (se limpia al recargar). */
export interface PlayerCombat {
  statuses: StatusInstance[];
  buffs: Array<{ stat: 'ataque' | 'daño' | 'ca'; amount: number; turns: number }>;
  cooldowns: Record<string, number>;
  stealth: number;
  skipNext: boolean;
}

const ENEMY_DELAY = 0.2;
/** Distingue partidas creadas en el mismo milisegundo (semillas distintas). */
let gameCounter = 0;

export class Game {
  readonly events = new Emitter<GameEvents>();
  zone: Zone;
  readonly view: PlayerView;
  readonly combat: PlayerCombat = { statuses: [], buffs: [], cooldowns: {}, stealth: 0, skipNext: false };
  enemies: Enemy[] = [];
  fx: Fx[] = [];
  /** Habilidad elegida esperando objetivo. */
  targeting: SkillDef | null = null;
  heldDir: { dx: number; dy: number } | null = null;
  stepDuration = 0.14;
  phase: 'player' | 'enemies' | 'dead' = 'player';
  rng: Rng;
  private enemyQueue: Enemy[] = [];
  private enemyTimer = 0;
  /** Algo importante pasó durante el turno enemigo: se detiene la ruta. */
  private interrupt = false;

  constructor(public state: GameState) {
    recalcPlayer(state.player);
    if (state.player.hp <= 0) state.player.hp = Math.ceil(state.player.maxHp / 2);
    this.rng = new Rng(hashString(`${state.seed}:${state.turn}:${Date.now()}:${gameCounter++}`));
    this.zone = this.loadZoneOrFallback(state.player.pos.zone);
    const p = state.player.pos;
    if (!this.zone.isWalkable(p.x, p.y)) {
      const s = this.zone.spawn ?? this.zone.arrivalPoint('1');
      p.x = s.x;
      p.y = s.y;
    }
    this.view = {
      rx: p.x, ry: p.y, facing: 'right', stepT: -1, from: { x: p.x, y: p.y }, to: { x: p.x, y: p.y },
      path: [], target: null, bumpT: 0, bumpDx: 0, bumpDy: 0, flashT: 0,
    };
    this.populateZone();
  }

  private loadZoneOrFallback(id: string): Zone {
    const def = getZoneDef(id);
    if (def) return buildZone(def);
    console.warn(`[juego] zona "${id}" no existe; volviendo a la aldea`);
    const start = buildZone(getZoneDef('aldea_brumaroja')!);
    const s = start.spawn ?? { x: 1, y: 1 };
    this.state.player.pos = { zone: start.id, x: s.x, y: s.y };
    return start;
  }

  // =================================================================== consultas
  get playerPos(): Point {
    return { x: this.state.player.pos.x, y: this.state.player.pos.y };
  }
  get isMoving(): boolean {
    return this.view.stepT >= 0;
  }
  get cls() {
    return getClass(this.state.player.classId);
  }
  get isDead(): boolean {
    return this.phase === 'dead';
  }
  /** ¿Puede el jugador actuar ahora mismo? */
  get canAct(): boolean {
    return this.phase === 'player' && !this.isMoving;
  }
  /** Hay enemigos alerta a la vista: estamos en combate. */
  get inCombat(): boolean {
    const p = this.playerPos;
    return this.enemies.some((e) => e.alerted && dist(e.x, e.y, p.x, p.y) <= e.def.sight + 2);
  }

  enemyAt(x: number, y: number): Enemy | undefined {
    return this.enemies.find((e) => e.x === x && e.y === y && e.hp > 0);
  }

  /** Casilla libre para el jugador (terreno + sin enemigos). */
  playerCanWalk(x: number, y: number): boolean {
    return this.zone.isWalkable(x, y) && !this.enemyAt(x, y);
  }

  private blocksSight = (x: number, y: number) => this.zone.tileAt(x, y)?.blocksSight ?? true;

  los(a: Point, b: Point): boolean {
    return hasLineOfSight(a.x, a.y, b.x, b.y, this.blocksSight);
  }

  buffTotal(stat: 'ataque' | 'daño' | 'ca'): number {
    return this.combat.buffs.filter((b) => b.stat === stat).reduce((s, b) => s + b.amount, 0);
  }

  playerAC(): number {
    return armorClass(this.cls, this.state.player.stats) + this.buffTotal('ca') - (hasStatus(this.combat.statuses, 'ralentizado') ? 2 : 0);
  }

  playerToHit(): number {
    return attackBonus(this.cls, this.state.player.stats, this.state.player.level) + this.buffTotal('ataque');
  }

  /** CD de los hechizos del jugador con una característica. */
  spellDC(stat: keyof GameState['player']['stats']): number {
    return 8 + proficiencyBonus(this.state.player.level) + abilityModifier(this.state.player.stats[stat]);
  }

  // ==================================================================== mensajes
  private msg(text: string, kind: MsgKind = 'info'): void {
    this.events.emit('message', { text, kind });
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    this.fx.push({ kind: 'text', x, y, text, color, t: 0, life: 0.9 });
  }

  // ======================================================================= input
  /** Toque en una casilla: moverse, atacar, apuntar habilidad o informar. */
  tapTile(x: number, y: number): void {
    if (!this.zone.inBounds(x, y) || this.phase === 'dead') return;
    if (this.targeting) {
      this.useSkill(this.targeting, { x, y });
      return;
    }
    const from = this.isMoving ? this.view.to : this.playerPos;
    const enemy = this.enemyAt(x, y);
    if (enemy && this.canAct) {
      const p = this.playerPos;
      const range = this.cls.weapon.range;
      if (dist(p.x, p.y, enemy.x, enemy.y) <= range && this.los(p, enemy)) {
        this.cancelPath();
        this.playerAttack(enemy, {});
        this.endPlayerTurn();
        return;
      }
      this.describeEnemy(enemy);
    }
    if (from.x === x && from.y === y) {
      this.cancelPath();
      return;
    }
    const path = findPath(this.zone.width, this.zone.height, from, { x, y }, (tx, ty) => this.playerCanWalk(tx, ty), {
      allowGoalBlocked: true,
      maxNodes: 4000,
    });
    if (!path || path.length === 0) {
      const tile = this.zone.tileAt(x, y);
      if (!enemy) {
        if (tile && !tile.walkable && dist(from.x, from.y, x, y) <= 1) this.msg(`${tile.name}.`);
        else this.msg('No puedes llegar ahí.', 'warn');
      }
      this.cancelPath();
      return;
    }
    this.view.path = path;
    this.view.target = { x, y };
  }

  describeEnemy(e: Enemy): void {
    const d = dangerLevel(e.def.level, this.state.player.level);
    const labels = { trivial: 'trivial', facil: 'fácil', normal: 'rival digno', dificil: 'peligroso', mortal: '¡MORTAL!' };
    this.msg(`${e.def.name} · Nv ${e.def.level} · ${e.hp}/${e.maxHp} PV · CA ${e.def.ac} · ${labels[d]}`, d === 'mortal' || d === 'dificil' ? 'warn' : 'info');
  }

  cancelPath(): void {
    this.view.path = [];
    this.view.target = null;
  }

  /** Elegir una habilidad desde la barra. Las de objetivo esperan a que toques el mapa. */
  selectSkill(skill: SkillDef): void {
    if (!this.canAct) return;
    if (this.targeting?.id === skill.id) {
      this.targeting = null;
      return;
    }
    const why = this.skillBlockedReason(skill);
    if (why) {
      this.msg(why, 'warn');
      return;
    }
    if (skill.target === 'self') {
      this.useSkill(skill, this.playerPos);
      return;
    }
    // Si sólo hay un enemigo válido, se lanza directamente.
    const targets = this.enemies.filter((e) => this.inSkillRange(skill, e));
    if (targets.length === 1) {
      this.useSkill(skill, targets[0]!);
      return;
    }
    if (targets.length === 0) {
      this.msg('No hay ningún objetivo a tu alcance.', 'warn');
      return;
    }
    this.targeting = skill;
    this.cancelPath();
    this.msg(`${skill.icon} ${skill.name}: toca un objetivo.`);
  }

  skillBlockedReason(skill: SkillDef): string | null {
    const p = this.state.player;
    if (skill.unlockLevel > p.level) return `Se desbloquea a nivel ${skill.unlockLevel}.`;
    if ((this.combat.cooldowns[skill.id] ?? 0) > 0) return `${skill.name} se está recargando (${this.combat.cooldowns[skill.id]} turnos).`;
    if (p.mp < skill.cost) return `No tienes suficiente ${this.cls.resource.name.toLowerCase()}.`;
    return null;
  }

  inSkillRange(skill: SkillDef, target: Point): boolean {
    const p = this.playerPos;
    return dist(p.x, p.y, target.x, target.y) <= Math.max(1, skill.range) && this.los(p, target);
  }

  /** Esperar un turno sin moverse. */
  waitTurn(): void {
    if (!this.canAct) return;
    this.cancelPath();
    this.targeting = null;
    this.endPlayerTurn();
  }

  // ================================================================ bucle / turnos
  update(dt: number): void {
    this.state.playTimeSec += dt;
    this.updateAnimations(dt);
    if (this.phase === 'enemies') {
      this.enemyTimer -= dt;
      while (this.phase === 'enemies' && this.enemyTimer <= 0) this.processNextEnemy();
      return;
    }
    if (this.phase !== 'player') return;
    const v = this.view;
    if (v.stepT >= 0) {
      v.stepT += dt / this.stepDuration;
      if (v.stepT >= 1) this.finishStep();
      else {
        v.rx = v.from.x + (v.to.x - v.from.x) * v.stepT;
        v.ry = v.from.y + (v.to.y - v.from.y) * v.stepT;
      }
    }
    if (v.stepT < 0 && this.phase === 'player') this.tryStartStep();
  }

  private updateAnimations(dt: number): void {
    const v = this.view;
    v.bumpT = Math.max(0, v.bumpT - dt * 5);
    v.flashT = Math.max(0, v.flashT - dt * 4);
    for (const e of this.enemies) {
      const k = Math.min(1, dt * 14);
      e.rx += (e.x - e.rx) * k;
      e.ry += (e.y - e.ry) * k;
      e.bumpT = Math.max(0, e.bumpT - dt * 5);
      e.flashT = Math.max(0, e.flashT - dt * 4);
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
  }

  private tryStartStep(): void {
    const v = this.view;
    const pos = this.playerPos;
    let next: Point | undefined;
    if (v.path.length > 0) next = v.path[0];
    else if (this.heldDir) {
      const target = { x: pos.x + this.heldDir.dx, y: pos.y + this.heldDir.dy };
      const enemy = this.enemyAt(target.x, target.y);
      if (enemy) {
        // Empujar el joystick contra un enemigo = atacarlo.
        this.playerAttack(enemy, {});
        this.endPlayerTurn();
        return;
      }
      next = this.resolveHeldStep(pos, this.heldDir);
      if (!next) return;
      v.path = [next];
    }
    if (!next) return;
    if (!this.playerCanWalk(next.x, next.y)) {
      this.cancelPath();
      return;
    }
    v.path.shift();
    v.from = pos;
    v.to = { x: next.x, y: next.y };
    if (next.x !== pos.x) v.facing = next.x > pos.x ? 'right' : 'left';
    v.stepT = 0;
  }

  private resolveHeldStep(pos: Point, d: { dx: number; dy: number }): Point | undefined {
    const ok = (x: number, y: number) => this.playerCanWalk(x, y);
    const { dx, dy } = d;
    if (dx !== 0 && dy !== 0) {
      if (ok(pos.x + dx, pos.y + dy) && ok(pos.x + dx, pos.y) && ok(pos.x, pos.y + dy)) return { x: pos.x + dx, y: pos.y + dy };
      if (ok(pos.x + dx, pos.y)) return { x: pos.x + dx, y: pos.y };
      if (ok(pos.x, pos.y + dy)) return { x: pos.x, y: pos.y + dy };
      return undefined;
    }
    return ok(pos.x + dx, pos.y + dy) ? { x: pos.x + dx, y: pos.y + dy } : undefined;
  }

  private finishStep(): void {
    const v = this.view;
    const prevExit = this.zone.exitAt(v.from.x, v.from.y);
    this.state.player.pos.x = v.to.x;
    this.state.player.pos.y = v.to.y;
    v.rx = v.to.x;
    v.ry = v.to.y;
    v.stepT = -1;
    if (v.path.length === 0) v.target = null;
    const exit = this.zone.exitAt(v.to.x, v.to.y);
    if (exit && !prevExit) {
      this.state.turn++;
      this.useExit(exit);
      return;
    }
    this.endPlayerTurn();
  }

  /** Fin del turno del jugador: cuentas atrás y turno de los enemigos. */
  endPlayerTurn(): void {
    if (this.phase === 'dead') return;
    this.state.turn++;
    this.targeting = null;
    const c = this.combat;
    for (const k of Object.keys(c.cooldowns)) c.cooldowns[k] = Math.max(0, (c.cooldowns[k] ?? 0) - 1);
    for (const b of c.buffs) b.turns--;
    c.buffs = c.buffs.filter((b) => b.turns > 0);
    if (c.stealth > 0) c.stealth--;
    this.events.emit('turn', { turn: this.state.turn });
    this.interrupt = false;
    const p = this.playerPos;
    this.enemyQueue = [...this.enemies].sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y));
    this.enemyTimer = 0;
    this.phase = 'enemies';
    // Sin enemigos cerca, todo ocurre en el acto para que caminar sea fluido.
    if (!this.inCombat) while (this.phase === 'enemies') this.processNextEnemy();
  }

  private processNextEnemy(): void {
    const e = this.enemyQueue.shift();
    if (!e) {
      this.startPlayerTurn();
      return;
    }
    if (e.hp <= 0 || !this.enemies.includes(e)) return;
    const visible = this.enemyTurn(e);
    if (visible && this.inCombat) this.enemyTimer = ENEMY_DELAY;
  }

  /** Comienzo del turno del jugador: estados, regeneración y encuentros. */
  private startPlayerTurn(): void {
    if (this.phase === 'dead') return;
    this.phase = 'player';
    const p = this.state.player;
    const c = this.combat;
    if (this.interrupt) this.cancelPath();

    // Daño por estados
    const tick = tickStatuses(this.rng, c.statuses);
    for (const part of tick.parts) {
      this.damagePlayer(part.amount, STATUS_INFO[part.id].name.toLowerCase());
      if (this.isDead) return;
    }
    // Regeneración fuera de combate
    if (!this.inCombat) {
      if (this.state.turn % 5 === 0 && p.hp < p.maxHp) p.hp++;
      if (this.state.turn % 3 === 0 && p.mp < p.maxMp) p.mp++;
      this.maybeSpawnEncounter();
    }
    // Aturdido o ralentizado: se pierde este turno
    if (consumeStun(c.statuses)) {
      this.msg('¡Estás aturdido y pierdes el turno!', 'warn');
      this.cancelPath();
      this.endPlayerTurn();
      return;
    }
    if (hasStatus(c.statuses, 'ralentizado')) {
      c.skipNext = !c.skipNext;
      if (c.skipNext) {
        this.msg('Ralentizado: te cuesta moverte...', 'warn');
        this.endPlayerTurn();
        return;
      }
    }
  }

  // ==================================================================== zonas
  useExit(exit: ZoneExit): void {
    const def = getZoneDef(exit.to);
    if (!def) {
      this.cancelPath();
      this.heldDir = null;
      this.msg(`${exit.label ?? 'Este camino'}: está bloqueado por ahora.`, 'warn');
      return;
    }
    if (this.inCombat) this.msg('Escapas de tus perseguidores.', 'good');
    this.enterZone(def.id, exit.arrive);
  }

  enterZone(zoneId: string, arrive: string | null): void {
    const def = getZoneDef(zoneId);
    if (!def) return;
    this.zone = buildZone(def);
    const p = arrive ? this.zone.arrivalPoint(arrive) : (this.zone.spawn ?? this.zone.arrivalPoint('1'));
    this.state.player.pos = { zone: this.zone.id, x: p.x, y: p.y };
    const v = this.view;
    v.rx = p.x;
    v.ry = p.y;
    v.from = { ...p };
    v.to = { ...p };
    v.stepT = -1;
    this.cancelPath();
    this.heldDir = null;
    this.targeting = null;
    this.phase = 'player';
    this.combat.stealth = 0;
    this.populateZone();
    const firstVisit = !this.state.visitedZones.includes(this.zone.id);
    if (firstVisit) this.state.visitedZones.push(this.zone.id);
    this.events.emit('zoneChanged', { zone: this.zone, firstVisit });
    if (firstVisit && this.zone.def.kind !== 'town') {
      this.gainXp(this.zone.def.discoverXp ?? 20 * this.zone.def.level, `descubres ${this.zone.def.name}`);
    }
  }

  // =============================================================== encuentros
  /** Coloca los grupos iniciales de la zona (los enemigos no se guardan). */
  private populateZone(): void {
    this.enemies = [];
    this.fx = [];
    const enc = this.zone.def.encounters;
    if (!enc) return;
    for (let i = 0; i < enc.initial; i++) this.spawnGroup();
  }

  private maybeSpawnEncounter(): void {
    const enc = this.zone.def.encounters;
    if (!enc || this.enemies.length >= enc.maxActive) return;
    if (this.rng.chance(enc.perStepChance)) this.spawnGroup();
  }

  /** Crea un grupo aleatorio lejos del jugador y fuera de su vista si es posible. */
  spawnGroup(): Enemy[] {
    const enc = this.zone.def.encounters;
    if (!enc || enc.groups.length === 0) return [];
    const g = this.rng.weighted(enc.groups, (x) => x.weight);
    const def = getEnemy(g.enemy);
    if (!def) {
      console.warn(`[encuentros] enemigo desconocido: ${g.enemy}`);
      return [];
    }
    const minD = enc.minDistance ?? 7;
    const p = this.playerPos;
    let spot: Point | null = null;
    for (let i = 0; i < 60 && !spot; i++) {
      const x = this.rng.int(0, this.zone.width - 1);
      const y = this.rng.int(0, this.zone.height - 1);
      if (!this.freeForEnemy(x, y) || dist(x, y, p.x, p.y) < minD || this.zone.exitAt(x, y)) continue;
      if (i < 40 && this.los(p, { x, y })) continue;
      spot = { x, y };
    }
    if (!spot) return [];
    const count = this.rng.int(g.min ?? 1, g.max ?? 1);
    const out: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      const pos = i === 0 ? spot : this.freeSpotNear(spot, 2);
      if (!pos) break;
      const e = createEnemy(def, pos.x, pos.y, this.rng);
      this.enemies.push(e);
      out.push(e);
    }
    return out;
  }

  /** Crea un enemigo concreto (jefes, invocaciones, tests). */
  spawnEnemy(id: string, x: number, y: number): Enemy | null {
    const def = getEnemy(id);
    if (!def || !this.freeForEnemy(x, y)) return null;
    const e = createEnemy(def, x, y, this.rng);
    this.enemies.push(e);
    return e;
  }

  freeForEnemy(x: number, y: number): boolean {
    const p = this.playerPos;
    return this.zone.isWalkable(x, y) && !this.enemyAt(x, y) && !(p.x === x && p.y === y);
  }

  private freeSpotNear(c: Point, r: number): Point | null {
    for (let i = 0; i < 20; i++) {
      const x = c.x + this.rng.int(-r, r);
      const y = c.y + this.rng.int(-r, r);
      if (this.freeForEnemy(x, y)) return { x, y };
    }
    return null;
  }

  // ======================================================== ataques del jugador
  /** Ataque con el arma (también lo usan las habilidades de tipo "attack"). */
  playerAttack(enemy: Enemy, opt: { extraDice?: string; toHitBonus?: number; critRange?: number; applyStatus?: StatusApply }): void {
    const cls = this.cls;
    const p = this.state.player;
    const pos = this.playerPos;
    this.faceTowards(enemy);
    this.view.bumpT = 1;
    this.view.bumpDx = Math.sign(enemy.x - pos.x);
    this.view.bumpDy = Math.sign(enemy.y - pos.y);

    let mode: RollMode = 'normal';
    const adv = this.combat.stealth > 0;
    const dis = hasStatus(this.combat.statuses, 'veneno');
    if (adv && !dis) mode = 'ventaja';
    if (dis && !adv) mode = 'desventaja';
    if (adv) {
      this.combat.stealth = 0;
      this.msg('Atacas desde las sombras (ventaja).', 'combat');
    }
    const toHit = this.playerToHit() + (opt.toHitBonus ?? 0);
    const critRange = Math.min(cls.critRange, opt.critRange ?? 20);
    const r = attackRoll(this.rng, toHit, enemy.def.ac, mode, critRange);
    this.events.emit('dice', {
      label: cls.weapon.name, natural: r.natural, bonus: toHit, total: r.total, target: enemy.def.ac, targetLabel: 'CA',
      outcome: r.fumble ? 'fumble' : r.crit ? 'crit' : r.hit ? 'hit' : 'miss',
    });
    enemy.alerted = true;
    if (!r.hit) {
      this.floatText(enemy.x, enemy.y, r.fumble ? '¡Pifia!' : 'Fallo', '#a49c8a');
      this.msg(r.fumble ? `¡Pifia! Tu ${cls.weapon.name.toLowerCase()} golpea el aire.` : `Fallas contra ${enemy.def.name} (${r.total} vs CA ${enemy.def.ac}).`, 'combat');
      return;
    }
    const statMod = abilityModifier(p.stats[cls.weapon.stat]);
    let dmg = damageRoll(this.rng, cls.weapon.dice, statMod + this.buffTotal('daño'), r.crit).total;
    if (opt.extraDice) dmg += damageRoll(this.rng, opt.extraDice, 0, r.crit).total;
    this.damageEnemy(enemy, dmg, cls.weapon.damageType, r.crit);
    if (enemy.hp > 0 && opt.applyStatus) this.applyStatusToEnemy(enemy, opt.applyStatus);
  }

  private applyStatusToEnemy(enemy: Enemy, s: StatusApply): void {
    if (tryApplyStatus(this.rng, enemy.statuses, s, enemy.def.immune)) {
      const info = STATUS_INFO[s.id];
      this.floatText(enemy.x, enemy.y - 0.3, info.icon, info.color);
      this.msg(`${enemy.def.name}: ${info.name.toLowerCase()}.`, 'combat');
    }
  }

  /** Aplica daño a un enemigo (con resistencias) y gestiona muerte y fases. */
  damageEnemy(enemy: Enemy, raw: number, type: DamageType, crit = false): void {
    const d = applyDefenses(raw, type, enemy.def);
    enemy.hp -= d.amount;
    enemy.flashT = 1;
    enemy.alerted = true;
    const color = crit ? '#f2d888' : d.note === 'vulnerable' ? '#ff8040' : d.note === 'resiste' ? '#a0a0b0' : '#ffffff';
    this.floatText(enemy.x, enemy.y, `${crit ? '¡' : ''}${d.amount}${crit ? '!' : ''}`, color);
    const note = d.note === 'vulnerable' ? ' (¡vulnerable!)' : d.note === 'resiste' ? ' (resiste)' : '';
    this.msg(`${crit ? '¡CRÍTICO! ' : ''}${enemy.def.name} recibe ${d.amount} de daño ${type}${note}.`, 'combat');
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
      return;
    }
    this.checkBossPhase(enemy);
  }

  private killEnemy(enemy: Enemy): void {
    enemy.hp = 0;
    this.enemies = this.enemies.filter((e) => e !== enemy);
    this.fx.push({ kind: 'burst', x: enemy.x, y: enemy.y, radius: 0.8, color: '#e05050', t: 0, life: 0.4 });
    const xp = xpForKill(enemy.def.xp, enemy.def.level, this.state.player.level);
    this.msg(`${enemy.def.name} cae derrotado.`, 'good');
    this.gainXp(xp, enemy.def.name);
  }

  private checkBossPhase(e: Enemy): void {
    const phases = e.def.phases ?? [];
    while (e.phase < phases.length && e.hp / e.maxHp < phases[e.phase]!.hpBelow) {
      const ph = phases[e.phase]!;
      e.phase++;
      this.msg(`${e.def.name}: «${ph.message}»`, 'warn');
      this.floatText(e.x, e.y - 0.6, '‼', '#ff6040');
      e.toHitBonus += ph.toHitBonus ?? 0;
      e.damageBonus += ph.damageBonus ?? 0;
      if (ph.heal) e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * ph.heal));
      if (ph.summon) this.summon(e, ph.summon.enemy, ph.summon.count);
    }
  }

  private summon(by: Enemy, id: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const spot = this.freeSpotNear(by, 2);
      if (!spot) continue;
      const m = this.spawnEnemy(id, spot.x, spot.y);
      if (m) {
        m.alerted = true;
        this.fx.push({ kind: 'burst', x: m.x, y: m.y, radius: 0.7, color: '#a040ff', t: 0, life: 0.5 });
      }
    }
  }

  // ================================================================ habilidades
  /** Usa una habilidad sobre una casilla objetivo. */
  useSkill(skill: SkillDef, target: Point): void {
    if (!this.canAct) return;
    const why = this.skillBlockedReason(skill);
    if (why) {
      this.msg(why, 'warn');
      this.targeting = null;
      return;
    }
    const p = this.state.player;
    const pos = this.playerPos;
    const center = skill.target === 'self' ? pos : target;
    if (skill.target !== 'self') {
      if (!this.inSkillRange(skill, center)) {
        this.msg('Fuera de alcance o sin línea de visión.', 'warn');
        return;
      }
      if (skill.target === 'enemy' && !this.enemyAt(center.x, center.y)) {
        this.msg('Toca a un enemigo.', 'warn');
        return;
      }
    }
    this.targeting = null;
    this.cancelPath();
    p.mp -= skill.cost;
    if (skill.cooldown > 0) this.combat.cooldowns[skill.id] = skill.cooldown + 1;
    this.msg(`${skill.icon} ${skill.name}`, 'combat');
    for (const eff of skill.effects) this.applySkillEffect(skill, eff, center);
    this.endPlayerTurn();
  }

  private applySkillEffect(skill: SkillDef, eff: SkillEffect, center: Point): void {
    const p = this.state.player;
    const pos = this.playerPos;
    switch (eff.type) {
      case 'attack': {
        const targets = eff.allAdjacent
          ? this.enemies.filter((e) => dist(e.x, e.y, pos.x, pos.y) === 1)
          : [this.enemyAt(center.x, center.y)].filter((e): e is Enemy => !!e);
        if (targets.length === 0) this.msg('No hay enemigos al alcance.', 'warn');
        for (const t of targets) {
          for (let i = 0; i < (eff.hits ?? 1) && t.hp > 0; i++) {
            this.playerAttack(t, {
              ...(eff.extraDice ? { extraDice: eff.extraDice } : {}),
              ...(eff.toHitBonus ? { toHitBonus: eff.toHitBonus } : {}),
              ...(eff.critRange ? { critRange: eff.critRange } : {}),
              ...(eff.applyStatus ? { applyStatus: eff.applyStatus } : {}),
            });
          }
        }
        break;
      }
      case 'spell': {
        const color = SPELL_COLORS[eff.damageType] ?? '#ffffff';
        const radius = eff.radius ?? 0;
        const targets = radius > 0
          ? this.enemies.filter((e) => dist(e.x, e.y, center.x, center.y) <= radius && this.los(center, e))
          : [this.enemyAt(center.x, center.y)].filter((e): e is Enemy => !!e);
        if (skill.target !== 'self') this.fx.push({ kind: 'bolt', fx: pos.x, fy: pos.y, tx: center.x, ty: center.y, color, t: 0, life: 0.3 });
        if (radius > 0) this.fx.push({ kind: 'burst', x: center.x, y: center.y, radius: radius + 0.5, color, t: 0, life: 0.5 });
        const mod = abilityModifier(p.stats[eff.stat]);
        const dc = this.spellDC(eff.stat);
        for (const t of targets) {
          for (let i = 0; i < (eff.hits ?? 1) && t.hp > 0; i++) {
            let dmg = roll(this.rng, eff.dice).total + (eff.hits && eff.hits > 1 ? 0 : Math.max(0, mod));
            let saved = false;
            if (eff.save) {
              const bonus = enemySave(t, eff.save);
              const s = savingThrow(this.rng, bonus, dc);
              saved = s.success;
              if (saved) dmg = Math.max(1, Math.floor(dmg / 2));
              this.msg(`${t.def.name} tira salvación de ${eff.save}: ${s.total} vs CD ${dc} — ${saved ? 'la supera (mitad)' : 'falla'}.`, 'combat');
            }
            this.damageEnemy(t, dmg, eff.damageType);
            if (t.hp > 0 && eff.applyStatus && !saved) this.applyStatusToEnemy(t, eff.applyStatus);
          }
        }
        if (targets.length === 0) this.msg('El hechizo no alcanza a nadie.', 'warn');
        break;
      }
      case 'heal': {
        const amount = Math.max(1, roll(this.rng, eff.dice).total + (eff.stat ? abilityModifier(p.stats[eff.stat]) : 0) + (eff.perLevel ?? 0) * p.level);
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + amount);
        this.floatText(pos.x, pos.y, `+${p.hp - before}`, '#60e070');
        this.fx.push({ kind: 'burst', x: pos.x, y: pos.y, radius: 0.9, color: '#60e070', t: 0, life: 0.5 });
        this.msg(`Recuperas ${p.hp - before} PV.`, 'good');
        break;
      }
      case 'buff':
        this.combat.buffs.push({ stat: eff.stat, amount: eff.amount, turns: eff.turns + 1 });
        this.floatText(pos.x, pos.y, `+${eff.amount} ${eff.stat}`, '#f2d888');
        break;
      case 'stealth':
        this.combat.stealth = eff.turns + 1;
        for (const e of this.enemies) if (dist(e.x, e.y, pos.x, pos.y) > 1) e.alerted = false;
        this.msg('Te fundes con las sombras.', 'good');
        break;
      case 'cleanse':
        this.combat.statuses = [];
        this.msg('Te sientes purificado.', 'good');
        break;
    }
  }

  // ======================================================================= huir
  /** Huir: DES + competencia contra CD 10 + nivel del enemigo más fuerte en combate. */
  flee(): void {
    if (!this.canAct || !this.inCombat) return;
    const p = this.state.player;
    const pos = this.playerPos;
    const foes = this.enemies.filter((e) => e.alerted && dist(e.x, e.y, pos.x, pos.y) <= e.def.sight + 2);
    if (foes.some((e) => e.def.boss)) {
      this.msg('¡No puedes huir de este enemigo!', 'warn');
      return;
    }
    const dc = 10 + Math.max(...foes.map((e) => e.def.level));
    const bonus = abilityModifier(p.stats.DES) + proficiencyBonus(p.level);
    const s = savingThrow(this.rng, bonus, dc);
    this.events.emit('dice', {
      label: 'Huir', natural: s.natural, bonus, total: s.total, target: dc, targetLabel: 'CD', outcome: s.success ? 'success' : 'fail',
    });
    this.cancelPath();
    if (s.success) {
      this.enemies = this.enemies.filter((e) => !foes.includes(e));
      this.msg('¡Logras escapar! Tus enemigos te pierden el rastro.', 'good');
      this.state.turn++;
      return;
    }
    this.msg('No consigues escapar...', 'warn');
    this.endPlayerTurn();
  }

  // ================================================================ enemigos
  /** Turno de un enemigo. Devuelve true si hizo algo visible. */
  private enemyTurn(e: Enemy): boolean {
    const p = this.playerPos;
    // Estados: daño por turno, aturdido, lento
    const tick = tickStatuses(this.rng, e.statuses);
    if (tick.damage > 0) {
      for (const part of tick.parts) this.floatText(e.x, e.y, `${part.amount}`, STATUS_INFO[part.id].color);
      e.hp -= tick.damage;
      e.flashT = 1;
      if (e.hp <= 0) {
        this.msg(`${e.def.name} sucumbe a sus heridas.`, 'good');
        this.killEnemy(e);
        return true;
      }
    }
    if (consumeStun(e.statuses)) {
      this.floatText(e.x, e.y - 0.4, '💫', '#f0e060');
      return true;
    }
    if (e.def.slow || hasStatus(e.statuses, 'ralentizado')) {
      e.skipNext = !e.skipNext;
      if (e.skipNext) return false;
    }
    for (const k of Object.keys(e.cooldowns)) e.cooldowns[k] = Math.max(0, (e.cooldowns[k] ?? 0) - 1);

    const d = dist(e.x, e.y, p.x, p.y);
    // ¿Detecta al jugador?
    if (!e.alerted) {
      const hidden = this.combat.stealth > 0 && d > 1;
      if (!hidden && d <= e.def.sight && this.los(e, p)) {
        e.alerted = true;
        this.interrupt = true;
        this.floatText(e.x, e.y - 0.5, '!', '#ff5040');
        if (this.enemies.filter((x) => x.alerted).length === 1) this.msg(`¡${e.def.name} te ha visto!`, 'warn');
        return true;
      }
      // Deambula
      if (this.rng.chance(0.3)) this.stepEnemy(e, { x: e.x + this.rng.int(-1, 1), y: e.y + this.rng.int(-1, 1) }, true);
      return false;
    }
    if (this.combat.stealth > 0 && d > 1) {
      e.alerted = false;
      return false;
    }
    // Pierde el rastro si se aleja mucho
    if (d > e.def.sight * 2) {
      e.alerted = false;
      return false;
    }

    const atk = e.def.attack;
    const inAtkRange = d <= atk.range && (atk.range === 1 || this.los(e, p));
    const ai = e.def.ai;

    // Hechizos (casters y jefes)
    if (ai === 'caster' || ai === 'boss') {
      for (const sp of e.def.spells ?? []) {
        if ((e.cooldowns[sp.id] ?? 0) > 0) continue;
        if (this.tryEnemySpell(e, sp, d)) {
          e.cooldowns[sp.id] = sp.cooldown + 1;
          return true;
        }
      }
    }
    // Arqueros: si estás pegado, intentan alejarse
    if (ai === 'ranged' && d === 1 && this.rng.chance(0.3) && this.stepAway(e)) return true;
    if (inAtkRange) {
      this.enemyAttack(e);
      return true;
    }
    // Casters: mantienen la distancia si el hechizo se recarga
    if (ai === 'caster' && d <= 4 && d > 1) return false;
    // Acercarse (skirmisher: 2 pasos)
    const steps = Math.max(1, e.def.speed);
    let moved = false;
    for (let i = 0; i < steps; i++) {
      const pp = this.playerPos;
      if (dist(e.x, e.y, pp.x, pp.y) <= atk.range && (atk.range === 1 || this.los(e, pp))) break;
      if (!this.approach(e)) break;
      moved = true;
    }
    if (moved && ai === 'skirmisher' && dist(e.x, e.y, p.x, p.y) <= 1) {
      this.enemyAttack(e);
    }
    return moved;
  }

  private tryEnemySpell(e: Enemy, sp: EnemySpell, d: number): boolean {
    const p = this.playerPos;
    if (sp.kind === 'heal') {
      const ally = this.enemies.find((a) => a.hp < a.maxHp * 0.5 && dist(a.x, a.y, e.x, e.y) <= sp.range);
      if (!ally) return false;
      const amount = roll(this.rng, sp.dice ?? '1d8').total;
      ally.hp = Math.min(ally.maxHp, ally.hp + amount);
      this.fx.push({ kind: 'bolt', fx: e.x, fy: e.y, tx: ally.x, ty: ally.y, color: '#60e070', t: 0, life: 0.3 });
      this.floatText(ally.x, ally.y, `+${amount}`, '#60e070');
      this.msg(`${e.def.name} usa ${sp.name} y cura ${amount} a ${ally === e ? 'sí mismo' : ally.def.name}.`, 'combat');
      return true;
    }
    if (sp.kind === 'summon' && sp.summon) {
      if (this.enemies.length > 12) return false;
      this.msg(`${e.def.name} usa ${sp.name}.`, 'warn');
      this.summon(e, sp.summon.enemy, sp.summon.count);
      return true;
    }
    if (d > sp.range || !this.los(e, p)) return false;
    // Daño
    const color = SPELL_COLORS[sp.damageType ?? 'arcano'] ?? '#ffffff';
    this.fx.push({ kind: 'bolt', fx: e.x, fy: e.y, tx: p.x, ty: p.y, color, t: 0, life: 0.3 });
    if (sp.radius) this.fx.push({ kind: 'burst', x: p.x, y: p.y, radius: sp.radius + 0.5, color, t: 0, life: 0.5 });
    let dmg = roll(this.rng, sp.dice ?? '1d6').total + e.damageBonus;
    let saved = false;
    if (sp.save && sp.dc) {
      const bonus = abilityModifier(this.state.player.stats[sp.save]);
      const s = savingThrow(this.rng, bonus, sp.dc);
      saved = s.success;
      this.events.emit('dice', {
        label: `Salvación de ${sp.save}`, natural: s.natural, bonus, total: s.total, target: sp.dc, targetLabel: 'CD', outcome: saved ? 'success' : 'fail',
      });
      if (saved) dmg = Math.max(1, Math.floor(dmg / 2));
    }
    this.msg(`${e.def.name} lanza ${sp.name}${saved ? ' (mitad de daño)' : ''}.`, 'combat');
    this.damagePlayer(dmg, sp.name);
    if (this.phase !== 'dead' && sp.applyStatus && !saved) this.applyStatusToPlayer(sp.applyStatus);
    return true;
  }

  private enemyAttack(e: Enemy): void {
    const p = this.playerPos;
    const atk = e.def.attack;
    e.facing = p.x >= e.x ? 'right' : 'left';
    if (atk.range === 1) {
      e.bumpT = 1;
      e.bumpDx = Math.sign(p.x - e.x);
      e.bumpDy = Math.sign(p.y - e.y);
    } else {
      this.fx.push({ kind: 'bolt', fx: e.x, fy: e.y, tx: p.x, ty: p.y, color: '#d8d0bc', t: 0, life: 0.25 });
    }
    const mode: RollMode = hasStatus(e.statuses, 'veneno') ? 'desventaja' : 'normal';
    const ac = this.playerAC();
    const r = attackRoll(this.rng, atk.toHit + e.toHitBonus, ac, mode);
    if (!r.hit) {
      this.floatText(p.x, p.y, r.fumble ? 'Pifia' : 'Esquivas', '#a49c8a');
      this.msg(`${e.def.name} falla su ${atk.name.toLowerCase()} (${r.total} vs tu CA ${ac}).`, 'combat');
      return;
    }
    const dmg = damageRoll(this.rng, atk.dice, e.damageBonus, r.crit).total;
    this.msg(`${r.crit ? '¡Crítico! ' : ''}${e.def.name} te alcanza con ${atk.name.toLowerCase()}: ${dmg} de daño.`, 'combat');
    this.damagePlayer(dmg, e.def.name, r.crit);
    if (this.phase !== 'dead' && atk.applyStatus) this.applyStatusToPlayer(atk.applyStatus);
  }

  private applyStatusToPlayer(s: StatusApply): void {
    if (tryApplyStatus(this.rng, this.combat.statuses, s)) {
      const info = STATUS_INFO[s.id];
      this.floatText(this.playerPos.x, this.playerPos.y - 0.4, info.icon, info.color);
      this.msg(`¡${info.name}!`, 'warn');
    }
  }

  damagePlayer(amount: number, cause: string, crit = false): void {
    const p = this.state.player;
    p.hp = Math.max(0, p.hp - amount);
    this.view.flashT = 1;
    this.interrupt = true;
    this.floatText(this.playerPos.x, this.playerPos.y, `-${amount}`, crit ? '#ff4040' : '#ff8080');
    this.events.emit('playerHurt', { amount });
    if (p.hp <= 0) {
      this.phase = 'dead';
      this.enemyQueue = [];
      this.cancelPath();
      this.heldDir = null;
      this.msg('Has caído...', 'warn');
      this.events.emit('playerDied', { cause });
    }
  }

  /** Paso de un enemigo hacia el jugador con A* (los demás enemigos estorban). */
  private approach(e: Enemy): boolean {
    const p = this.playerPos;
    const path = findPath(
      this.zone.width, this.zone.height, e, p,
      (x, y) => this.zone.isWalkable(x, y) && !this.enemies.some((o) => o !== e && o.x === x && o.y === y),
      { allowGoalBlocked: true, maxNodes: 600 },
    );
    const next = path?.[0];
    if (!next || (next.x === p.x && next.y === p.y)) return false;
    return this.stepEnemy(e, next, false);
  }

  private stepAway(e: Enemy): boolean {
    const p = this.playerPos;
    let best: Point | null = null;
    let bestD = dist(e.x, e.y, p.x, p.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = e.x + dx;
        const y = e.y + dy;
        if (!this.freeForEnemy(x, y)) continue;
        const nd = dist(x, y, p.x, p.y);
        if (nd > bestD) {
          bestD = nd;
          best = { x, y };
        }
      }
    }
    return best ? this.stepEnemy(e, best, false) : false;
  }

  private stepEnemy(e: Enemy, to: Point, wander: boolean): boolean {
    if (!this.freeForEnemy(to.x, to.y)) return false;
    if (wander && this.zone.exitAt(to.x, to.y)) return false;
    if (to.x !== e.x) e.facing = to.x > e.x ? 'right' : 'left';
    e.x = to.x;
    e.y = to.y;
    return true;
  }

  private faceTowards(t: Point): void {
    const p = this.playerPos;
    if (t.x !== p.x) this.view.facing = t.x > p.x ? 'right' : 'left';
  }

  // =========================================================== experiencia
  /** Suma XP y sube de nivel las veces que haga falta. */
  gainXp(amount: number, reason: string): void {
    const p = this.state.player;
    p.xp += amount;
    this.floatText(this.playerPos.x, this.playerPos.y - 0.6, `+${amount} XP`, '#c9a227');
    this.msg(`+${amount} XP (${reason}).`, 'good');
    const target = levelForXp(p.xp);
    while (p.level < target) {
      const hpBefore = p.maxHp;
      const mpBefore = p.maxMp;
      p.level++;
      const points = attributePointsAtLevel(p.level);
      p.attributePoints += points;
      recalcPlayer(p);
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      const skills = unlockedSkills(this.cls, p.level).filter((s) => s.unlockLevel === p.level);
      this.fx.push({ kind: 'burst', x: this.playerPos.x, y: this.playerPos.y, radius: 1.5, color: '#f2d888', t: 0, life: 0.8 });
      this.events.emit('levelUp', { level: p.level, hpGain: p.maxHp - hpBefore, mpGain: p.maxMp - mpBefore, points, skills });
    }
  }

  // ================================================================= muerte
  /** Despertar en la aldea tras caer: se pierde el 10 % del oro. */
  respawn(): void {
    const p = this.state.player;
    const lost = Math.floor(p.gold * 0.1);
    p.gold -= lost;
    this.combat.statuses = [];
    this.combat.buffs = [];
    this.combat.stealth = 0;
    this.enterZone('aldea_brumaroja', null);
    p.hp = Math.max(1, Math.ceil(p.maxHp / 2));
    p.mp = Math.ceil(p.maxMp / 2);
    this.msg(`Despiertas en la aldea, magullado. Has perdido ${lost} de oro.`, 'warn');
  }
}

const SPELL_COLORS: Partial<Record<DamageType, string>> = {
  fuego: '#ff8030', frio: '#80d0ff', rayo: '#f0f060', veneno: '#80d040', sagrado: '#fff0a0',
  necrotico: '#a040ff', arcano: '#c080ff',
};
