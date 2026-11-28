/** v0.14: eventos al viajar y misiones de escolta. */
import { beforeEach, describe, expect, it } from 'vitest';
import { NPCS, QUESTS, TRAVEL_EVENTS, getItem } from '@/data/registry';
import type { DialogEffect, TravelEventDef } from '@/data/schema';
import { Rng } from '@/engine/rng';
import { Game } from '@/game/game';
import * as Quests from '@/game/quests/quests';
import { activateGenWorld, assignQuests, emptyGen, ensureZone } from '@/game/world/procgen';
import { cellId, isSettlement, placeAt } from '@/game/world/procgen/plan';
import { dcBonus, eligibleEvents, instantiateEvent, pickEvent, validateEvent } from '@/game/world/travelEvents';
import { migrate, CURRENT_SAVE_VERSION } from '@/game/save/migrations';
import { testState } from './helpers';

const SEED = 77;
function wildCell(): string {
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    if (x === 0 && y >= -1 && y <= 2) continue;
    if (placeAt(SEED, x, y) === 'wild') return cellId(x, y);
  }
  throw new Error('sin zona salvaje');
}
function townCell(skip = 0): string {
  let n = 0;
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    if (x === 0 && y >= -1 && y <= 2) continue;
    if (isSettlement(placeAt(SEED, x, y)) && n++ >= skip) return cellId(x, y);
  }
  throw new Error('sin asentamiento');
}

describe('eventos al viajar: datos', () => {
  it('hay al menos seis eventos válidos, con salida y objetos reales', () => {
    expect(TRAVEL_EVENTS.size).toBeGreaterThanOrEqual(6);
    for (const id of ['viajero_herido', 'mercader_ambulante', 'emboscada_bandidos', 'tesoro_oculto', 'tormenta', 'santuario']) expect(TRAVEL_EVENTS.has(id), id).toBe(true);
    for (const e of TRAVEL_EVENTS.values()) expect(validateEvent(e, (i) => !!getItem(i)), e.id).toEqual([]);
  });

  it('las CD y las recompensas escalan con el nivel de la zona', () => {
    const def = TRAVEL_EVENTS.get('mercader_ambulante')!;
    const lo = instantiateEvent(def, 2), hi = instantiateEvent(def, 12);
    const dc = (n: typeof lo) => n.dialog['inicio']!.options.find((o) => o.check)!.check!.dc;
    expect(dc(hi) - dc(lo)).toBe(dcBonus(12) - dcBonus(2));
    const t = TRAVEL_EVENTS.get('viajero_herido')!;
    const gold = (n: ReturnType<typeof instantiateEvent>) => (n.dialog['robo_ok']!.effects!.find((e) => e.type === 'gold') as Extract<DialogEffect, { type: 'gold' }>).amount;
    expect(gold(instantiateEvent(t, 10))).toBe(gold(instantiateEvent(t, 1)) * 10);
  });

  it('la elección es determinista, ponderada y respeta el nivel mínimo', () => {
    const seq = (s: number) => { const r = new Rng(s); return Array.from({ length: 30 }, () => pickEvent(r, 'pradera', 5)!.id); };
    expect(seq(3)).toEqual(seq(3));
    expect(new Set(seq(3)).size).toBeGreaterThan(2);
    expect(eligibleEvents('pradera', 1).some((e) => e.id === 'emboscada_bandidos')).toBe(false);
    expect(eligibleEvents('pradera', 3).some((e) => e.id === 'emboscada_bandidos')).toBe(true);
  });
});

describe('eventos al viajar: en partida', () => {
  let g: Game;
  beforeEach(() => {
    activateGenWorld(SEED, emptyGen());
    const st = testState('guerrero', SEED);
    st.player.level = 5;
    g = new Game(st);
    g.enterZone(ensureZone(wildCell(), 5)!.id, '1');
    g.enemies = [];
    st.player.hp = st.player.maxHp;
  });

  /** Aplica los efectos de todos los nodos del evento. */
  const run = (e: TravelEventDef) => {
    const npc = instantiateEvent(e, g.zone.def.level);
    for (const node of Object.values(npc.dialog)) {
      g.state.player.hp = g.state.player.maxHp;
      g.state.player.gold = 500;
      g.enemies = [];
      expect(() => g.applyDialogEffects({ ...node, once: undefined as never })).not.toThrow();
      expect(g.state.player.hp).toBeGreaterThanOrEqual(1);
    }
  };

  it('todos los nodos de todos los eventos se pueden aplicar sin errores', () => {
    for (const e of TRAVEL_EVENTS.values()) run(e);
  });

  it('travelDialog fuerza un evento y avisa a la interfaz', () => {
    let talked = '';
    g.events.on('npcTalk', ({ npc }) => { talked = npc.id; });
    const npc = g.travelDialog('santuario');
    expect(npc?.id).toBe('evt:santuario');
    expect(talked).toBe('evt:santuario');
  });

  it('el tesoro suelta botín al nivel de la zona y la emboscada crea enemigos alertados', () => {
    g.applyDialogEffects({ text: '', options: [], effects: [{ type: 'treasure', rolls: 3 }] });
    expect(g.ground.length).toBeGreaterThan(0);
    const close = g.applyDialogEffects({ text: '', options: [], effects: [{ type: 'ambush' }] });
    expect(g.enemies.length).toBeGreaterThan(0);
    expect(close).toBe(true);
    expect(g.enemies.every((e) => e.alerted)).toBe(true);
  });

  it('herir nunca mata y restaurar sube PV', () => {
    const p = g.state.player;
    g.applyDialogEffects({ text: '', options: [], effects: [{ type: 'hurt', pct: 500 }] });
    expect(p.hp).toBe(1);
    g.applyDialogEffects({ text: '', options: [], effects: [{ type: 'restore', pct: 50 }] });
    expect(p.hp).toBeGreaterThan(1);
  });
});

describe('misiones de escolta', () => {
  let g: Game;
  beforeEach(() => {
    activateGenWorld(SEED, emptyGen());
    const st = testState('guerrero', SEED);
    st.player.level = 4;
    g = new Game(st);
  });

  /** Busca (entre varios asentamientos) una misión de escolta generada y deja `g` en su asentamiento. */
  function escortQuest() {
    for (let k = 0; k < 12; k++) {
      activateGenWorld(SEED, emptyGen());
      const st = testState('guerrero', SEED);
      st.player.level = 4;
      g = new Game(st);
      const base = townCell(k);
      g.enterZone(ensureZone(base, 4)!.id, '1');
      assignQuests(base, 4);
      const q = [...QUESTS.values()].find((x) => x.objectives.some((o) => o.type === 'escort'));
      if (q) return { base, q };
    }
    throw new Error('ninguna escolta generada');
  }

  it('se generan misiones de escolta hacia un asentamiento real, cobrables con su alcalde', () => {
    let found = 0;
    for (let k = 0; k < 6; k++) {
      activateGenWorld(SEED, emptyGen());
      const base = townCell(k);
      ensureZone(base, 4);
      for (const q of assignQuests(base, 4)) {
        const o = q.objectives[0]!;
        if (o.type !== 'escort') continue;
        found++;
        expect(Quests.validateQuest(q, (i) => !!getItem(i))).toEqual([]);
        expect(NPCS.has(q.turnIn!)).toBe(true);
        expect(q.turnIn).toBe(`${o.zone}:alcalde`);
        expect(o.zone).not.toBe(base);
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('el protegido te sigue, llega, y la misión queda lista para cobrar', () => {
    const r = escortQuest();
    const o = r.q.objectives[0] as Extract<typeof r.q.objectives[0], { type: 'escort' }>;
    expect(g.acceptQuest(r.q.id)).toBeNull();
    expect(g.state.escort?.name).toBe(o.name);
    expect(g.escort).not.toBeNull();
    expect(g.acceptQuest(r.q.id)).not.toBeNull();
    for (let i = 0; i < 6; i++) g.endPlayerTurn();
    g.enterZone(o.zone, '1');
    expect(g.state.escort).toBeNull();
    expect(Quests.questStatus(g.state, r.q.id)).toBe('lista');
    expect(g.turnInQuest(r.q.id, r.q.turnIn!)).toBeNull();
    expect(Quests.questStatus(g.state, r.q.id)).toBe('completada');
  });

  it('si el protegido cae en batalla la misión falla y no se repite', () => {
    const r = escortQuest();
    const q = r.q;
    g.acceptQuest(q.id);
    g.enemies = [];
    const e = g.spawnEnemy('goblin', g.playerPos.x + 2, g.playerPos.y + 2)!;
    const b = g.beginBattle([e]);
    expect(b.get('escort')).toBeDefined();
    expect(b.party().some((c) => c.kind === 'escort')).toBe(true);
    b.damage(b.get('escort')!, 9999, 'cortante', { src: b.get(`e${e.uid}`)!, ctx: 'other' });
    expect(b.get('escort')!.dead).toBe(true);
    b.damage(b.get(`e${e.uid}`)!, 9999, 'sagrado', { src: b.player, ctx: 'weapon' });
    const res = g.finishBattle()!;
    expect(res.escortDied).toBe(true);
    expect(g.state.escort).toBeNull();
    expect(g.escort).toBeNull();
    expect(g.state.quests[q.id]?.failed).toBe(true);
    expect(Quests.questStatus(g.state, q.id)).toBe('completada');
  });

  it('el evento del viajero herido crea una escolta aceptada hacia el asentamiento más cercano', () => {
    g.enterZone(ensureZone(wildCell(), 4)!.id, '1');
    g.applyDialogEffects({ text: '', options: [], effects: [{ type: 'escort' }] });
    expect(g.state.escort).not.toBeNull();
    const q = QUESTS.get(g.state.escort!.quest)!;
    expect(Quests.questStatus(g.state, q.id)).toBe('activa');
    const o = q.objectives[0]!;
    expect(o.type).toBe('escort');
    if (o.type === 'escort') expect(isSettlement(placeAt(SEED, ...(/^w_(-?\d+)_(-?\d+)$/.exec(o.zone)!.slice(1).map(Number) as [number, number])))).toBe(true);
  });

  it('el guardado migra a la versión 12 con escort nulo', () => {
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(12);
    const s = migrate({ player: {} }, 11, 12) as { escort: unknown };
    expect(s.escort).toBeNull();
  });
});
