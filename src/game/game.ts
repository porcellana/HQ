/**
 * NÚCLEO DE LA PARTIDA (sin DOM)
 * ------------------------------
 * Mantiene el estado, la zona actual y el movimiento del jugador por
 * casillas. El juego avanza por TURNOS: cada paso o acción del jugador
 * consume un turno (en el Hito 3 los enemigos actuarán tras cada turno).
 */
import { Emitter } from '@/engine/events';
import { findPath, type Point } from '@/engine/pathfinding';
import { getZoneDef } from '@/data/registry';
import { recalcPlayer, type GameState } from './state';
import { buildZone, type Zone, type ZoneExit } from './world/zone';

export interface GameEvents extends Record<string, unknown> {
  /** Ha cambiado la zona (tras transición). `firstVisit` si es la primera vez. */
  zoneChanged: { zone: Zone; firstVisit: boolean };
  /** Ha pasado un turno. */
  turn: { turn: number };
  /** Mensaje para el registro/toast. */
  message: { text: string; kind?: 'info' | 'warn' | 'good' };
}

/** Estado visual del jugador (no se guarda; se reconstruye al cargar). */
export interface PlayerView {
  /** Posición interpolada en casillas (decimales durante el paso). */
  rx: number;
  ry: number;
  facing: 'left' | 'right';
  /** 0..1 progreso del paso actual, o -1 si está quieto. */
  stepT: number;
  from: Point;
  to: Point;
  path: Point[];
  /** Destino marcado por el último toque. */
  target: Point | null;
}

export class Game {
  readonly events = new Emitter<GameEvents>();
  zone: Zone;
  readonly view: PlayerView;
  /** Dirección mantenida por joystick/teclado. */
  heldDir: { dx: number; dy: number } | null = null;
  /** Segundos que dura un paso (ajustable desde Ajustes). */
  stepDuration = 0.14;

  constructor(public state: GameState) {
    recalcPlayer(state.player);
    this.zone = this.loadZoneOrFallback(state.player.pos.zone);
    const p = state.player.pos;
    if (!this.zone.isWalkable(p.x, p.y)) {
      const s = this.zone.spawn ?? this.zone.arrivalPoint('1');
      p.x = s.x;
      p.y = s.y;
    }
    this.view = { rx: p.x, ry: p.y, facing: 'right', stepT: -1, from: { x: p.x, y: p.y }, to: { x: p.x, y: p.y }, path: [], target: null };
  }

  /** Si la zona guardada ya no existe (contenido borrado), vuelve al inicio. */
  private loadZoneOrFallback(id: string): Zone {
    const def = getZoneDef(id);
    if (def) return buildZone(def);
    console.warn(`[juego] zona "${id}" no existe; volviendo a la aldea`);
    const start = buildZone(getZoneDef('aldea_brumaroja')!);
    const s = start.spawn ?? { x: 1, y: 1 };
    this.state.player.pos = { zone: start.id, x: s.x, y: s.y };
    return start;
  }

  get playerPos(): Point {
    return { x: this.state.player.pos.x, y: this.state.player.pos.y };
  }

  get isMoving(): boolean {
    return this.view.stepT >= 0;
  }

  /** El jugador ha tocado una casilla: calcula ruta hacia ella. */
  tapTile(x: number, y: number): void {
    if (!this.zone.inBounds(x, y)) return;
    const from = this.isMoving ? this.view.to : this.playerPos;
    if (from.x === x && from.y === y) {
      this.cancelPath();
      return;
    }
    const path = findPath(this.zone.width, this.zone.height, from, { x, y }, (tx, ty) => this.zone.isWalkable(tx, ty), {
      allowGoalBlocked: true,
    });
    if (!path || path.length === 0) {
      const tile = this.zone.tileAt(x, y);
      if (tile && !tile.walkable && Math.max(Math.abs(from.x - x), Math.abs(from.y - y)) <= 1) {
        this.events.emit('message', { text: `${tile.name}.` });
      } else this.events.emit('message', { text: 'No puedes llegar ahí.', kind: 'warn' });
      this.cancelPath();
      return;
    }
    this.view.path = path;
    this.view.target = { x, y };
  }

  cancelPath(): void {
    this.view.path = [];
    this.view.target = null;
  }

  /** Esperar un turno sin moverse. */
  waitTurn(): void {
    if (this.isMoving) return;
    this.cancelPath();
    this.endTurn();
  }

  update(dt: number): void {
    this.state.playTimeSec += dt;
    const v = this.view;
    if (v.stepT >= 0) {
      v.stepT += dt / this.stepDuration;
      if (v.stepT >= 1) this.finishStep();
      else {
        v.rx = v.from.x + (v.to.x - v.from.x) * v.stepT;
        v.ry = v.from.y + (v.to.y - v.from.y) * v.stepT;
      }
    }
    if (v.stepT < 0) this.tryStartStep();
  }

  private tryStartStep(): void {
    const v = this.view;
    const pos = this.playerPos;
    let next: Point | undefined;
    if (v.path.length > 0) {
      next = v.path[0];
    } else if (this.heldDir) {
      next = this.resolveHeldStep(pos, this.heldDir);
      if (!next) return;
      v.path = [next];
    }
    if (!next) return;
    if (!this.zone.isWalkable(next.x, next.y)) {
      this.cancelPath();
      return;
    }
    v.path.shift();
    v.from = pos;
    v.to = { x: next.x, y: next.y };
    if (next.x !== pos.x) v.facing = next.x > pos.x ? 'right' : 'left';
    v.stepT = 0;
  }

  /** Paso con joystick: si la diagonal está bloqueada, prueba los ejes. */
  private resolveHeldStep(pos: Point, d: { dx: number; dy: number }): Point | undefined {
    const ok = (x: number, y: number) => this.zone.isWalkable(x, y);
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
    this.endTurn();
    // Sólo se cruza una salida al ENTRAR en ella desde fuera.
    const exit = this.zone.exitAt(v.to.x, v.to.y);
    if (exit && !prevExit) this.useExit(exit);
  }

  private endTurn(): void {
    this.state.turn++;
    this.events.emit('turn', { turn: this.state.turn });
  }

  /** Cruza una salida hacia otra zona. */
  useExit(exit: ZoneExit): void {
    const def = getZoneDef(exit.to);
    if (!def) {
      this.cancelPath();
      this.heldDir = null;
      this.events.emit('message', { text: `${exit.label ?? 'Este camino'}: está bloqueado por ahora.`, kind: 'warn' });
      return;
    }
    this.enterZone(def.id, exit.arrive);
  }

  /** Entra en una zona por la salida `arrive` (o en su punto de inicio). */
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
    const firstVisit = !this.state.visitedZones.includes(this.zone.id);
    if (firstVisit) this.state.visitedZones.push(this.zone.id);
    this.events.emit('zoneChanged', { zone: this.zone, firstVisit });
  }
}
