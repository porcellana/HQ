/** v0.3: mascotas (tipos, aprendizaje, evolución, captura, establo, combate). */
import { describe, expect, it } from 'vitest';
import { BIOMES, DUNGEONS, NPCS, PET_MOVES, PET_NATURES, PET_SPECIES, PET_TYPES, ZONES, getItem } from '@/data/registry';
import { Rng } from '@/engine/rng';
import { Game } from '@/game/game';
import { addItem } from '@/game/items/inventory';
import { createItem } from '@/game/items/items';
import * as Pets from '@/game/pets/pets';
import { wildEnemyDef } from '@/game/pets/wild';
import { CURRENT_SAVE_VERSION, migrate } from '@/game/save/migrations';
import { BEAST_SHAPES } from '@/gfx/world3d/models';
import { defeat, testState } from './helpers';

describe('datos de mascotas', () => {
  it('al menos 6 líneas evolutivas y 12 especies; 3 iniciales de fuego, agua y planta', () => {
    const all = [...PET_SPECIES.values()];
    expect(all.length).toBeGreaterThanOrEqual(12);
    const lines = all.filter((s) => s.stage === 1);
    expect(lines.length).toBeGreaterThanOrEqual(6);
    for (const l of lines) expect(Pets.evolutionLine(l.id).length, l.id).toBeGreaterThanOrEqual(2);
    expect(all.filter((s) => s.starter).map((s) => s.type).sort()).toEqual(['agua', 'fuego', 'planta']);
  });

  for (const s of PET_SPECIES.values()) {
    it(`${s.id}: coherente`, () => {
      for (const l of s.learnset) expect(PET_MOVES.has(l.move), `movimiento ${l.move}`).toBe(true);
      for (const e of s.evolutions ?? []) {
        const next = PET_SPECIES.get(e.species);
        expect(next, `evoluciona a ${e.species}`).toBeDefined();
        expect(next!.stage).toBe(s.stage + 1);
        expect(e.level).toBeGreaterThan(1);
        if (e.item) expect(getItem(e.item), `objeto ${e.item}`).toBeDefined();
        for (const n of e.natures ?? []) expect(PET_NATURES.some((x) => x.id === n), `naturaleza ${n}`).toBe(true);
      }
      if (s.passive) expect(s.passive.power).toBeGreaterThan(0);
      for (const h of s.habitats) {
        if (h.startsWith('bioma:')) expect(BIOMES.has(h.slice(6)), `bioma ${h}`).toBe(true);
        else if (h.startsWith('lugar:')) expect(['cueva', 'mazmorra', 'ruinas']).toContain(h.slice(6));
        else expect(ZONES.has(h) || DUNGEONS.has(h), `hábitat ${h}`).toBe(true);
      }
      expect(BEAST_SHAPES).toContain(s.look.shape);
      if (s.stage === 1) expect(Pets.movesUpTo(s, 1).length).toBeGreaterThan(0);
    });
  }

  it('el cuidador del establo existe y abre el establo', () => {
    const t = NPCS.get('cuidador_tobias');
    expect(t).toBeDefined();
    expect(t!.dialog['inicio']!.options.some((o) => o.action?.type === 'stable')).toBe(true);
  });
});

describe('tabla de tipos', () => {
  it('fuerte x2, débil x0,5, neutro x1 y todos los tipos existen', () => {
    expect(Pets.typeMultiplier('fuego', 'planta')).toBe(2);
    expect(Pets.typeMultiplier('fuego', 'agua')).toBe(0.5);
    expect(Pets.typeMultiplier('agua', 'fuego')).toBe(2);
    expect(Pets.typeMultiplier('luz', 'sombra')).toBe(2);
    expect(Pets.typeMultiplier('planta', 'luz')).toBe(1);
    expect(Pets.typeMultiplier('fuego', null)).toBe(1);
    const ids = PET_TYPES.map((t) => t.id);
    for (const t of PET_TYPES) for (const x of [...t.strong, ...t.weak]) expect(ids).toContain(x);
    expect(Pets.familyType('no-muerto')).toBe('sombra');
  });
});

describe('crecimiento', () => {
  it('sube de nivel, mejora estadísticas y aprende movimientos', () => {
    const p = Pets.createPet('chispon', 1);
    const hp1 = Pets.petStats(p).hp;
    const gain = Pets.gainPetXp(p, 10_000, 6);
    expect(p.level).toBe(6);
    expect(gain.levels).toBe(5);
    expect(Pets.petStats(p).hp).toBeGreaterThan(hp1);
    expect(p.moves).toContain('calor_interior');
  });

  it('con 4 movimientos el nuevo queda pendiente: olvidar uno o no aprenderlo', () => {
    const p = Pets.createPet('chispon', 7);
    expect(p.moves).toHaveLength(4);
    p.declinedEvolutionAt = 8; // que no moleste la evolución
    Pets.gainPetXp(p, 1_000_000, 12);
    expect(p.pendingMoves).toContain('llamarada');
    Pets.resolveMove(p, 'llamarada', 'placaje');
    expect(p.moves).toContain('llamarada');
    expect(p.moves).not.toContain('placaje');
    expect(p.pendingMoves).toHaveLength(0);
    const q = Pets.createPet('gotin', 11);
    Pets.gainPetXp(q, 1_000_000, 12);
    const before = [...q.moves];
    Pets.resolveMove(q, q.pendingMoves[0]!, null);
    expect(q.moves).toEqual(before);
  });

  it('evoluciona al nivel indicado; detenerla la retrasa al siguiente nivel', () => {
    const p = Pets.createPet('brotin', 7);
    Pets.gainPetXp(p, Pets.petXpToNext(7));
    expect(p.level).toBe(8);
    expect(p.pendingEvolution).toBe(true);
    Pets.declineEvolution(p);
    expect(p.pendingEvolution).toBe(false);
    Pets.gainPetXp(p, Pets.petXpToNext(8));
    expect(p.pendingEvolution).toBe(true);
    const hpRatioBefore = p.hp / Pets.petStats(p).hp;
    const sp = Pets.evolve(p);
    expect(sp?.id).toBe('ramaleon');
    expect(p.species).toBe('ramaleon');
    expect(p.hp / Pets.petStats(p).hp).toBeCloseTo(hpRatioBefore, 1);
  });

  it('nunca más de 4 movimientos al crear una mascota de nivel alto', () => {
    for (const s of PET_SPECIES.values()) expect(Pets.createPet(s.id, 30).moves.length).toBeLessThanOrEqual(4);
  });
});

describe('vínculo (captura)', () => {
  it('cuanto menos vida, más fácil; las raras cuestan más', () => {
    expect(Pets.captureChance('comun', 0.1)).toBeGreaterThan(Pets.captureChance('comun', 0.8));
    expect(Pets.captureChance('raro', 0.3)).toBeLessThan(Pets.captureChance('comun', 0.3));
    expect(Pets.captureChance('epico', 1)).toBeGreaterThanOrEqual(0.05);
    expect(Pets.captureChance('comun', 0)).toBeLessThanOrEqual(0.95);
  });

  it('vincular una criatura debilitada la añade como mascota', () => {
    const g = new Game(testState());
    g.enemies = [];
    addItem(g.state.player, createItem('runa_vinculo', 'comun', new Rng(1), { qty: 40 }));
    const p = g.playerPos;
    let caught = false;
    for (let i = 0; i < 20 && !caught; i++) {
      const e = g.spawnWildPet('guijarrin', { x: p.x, y: p.y - 2 });
      expect(e?.def.pet?.species).toBe('guijarrin');
      e!.hp = 1;
      const b = g.beginBattle([e!]);
      while (!b.awaiting && !b.ended) b.step();
      const rune = g.state.player.inventory.find((x) => x.id === 'runa_vinculo')!;
      expect(b.useItem(rune.uid, `e${e!.uid}`).ok).toBe(true);
      if (b.ended) g.finishBattle();
      caught = g.state.pets.active?.species === 'guijarrin';
      g.battle = null;
      g.enemies = [];
    }
    expect(caught).toBe(true);
    expect(g.state.pets.caught).toContain('guijarrin');
    expect(g.pet).not.toBeNull();
  });

  it('la ficha de criatura salvaje usa sus estadísticas', () => {
    const d = wildEnemyDef('umbrin', 4);
    expect(d.pet).toEqual({ species: 'umbrin', level: 4 });
    expect(d.level).toBe(4);
  });
});

describe('establo', () => {
  it('entrena con el tiempo real, con tope diario y sin pasar del nivel del jugador', () => {
    const pets = Pets.emptyPets();
    const t0 = 1_000_000_000_000;
    const a = Pets.createPet('guijarrin', 1);
    a.restSince = t0;
    pets.stable.push(a);
    // 2 horas → 2 × XP por hora
    Pets.trainStable(pets, t0 + 2 * 3_600_000, 50);
    const after2h = a.level;
    expect(after2h).toBeGreaterThan(1);
    // Tope diario: 20 horas en el mismo día cuentan como 8
    const b = Pets.createPet('guijarrin', 1);
    b.restSince = t0;
    const c = Pets.createPet('guijarrin', 1);
    c.restSince = t0;
    const pb = { ...Pets.emptyPets(), stable: [b] };
    const pc = { ...Pets.emptyPets(), stable: [c] };
    Pets.trainStable(pb, t0 + 8 * 3_600_000, 50);
    Pets.trainStable(pc, t0 + 20 * 3_600_000, 50);
    expect(c.level).toBe(b.level);
    // Límite de nivel = nivel del jugador
    const d = Pets.createPet('guijarrin', 1);
    d.restSince = t0;
    const report = Pets.trainStable({ ...Pets.emptyPets(), stable: [d] }, t0 + 100 * 3_600_000, 3);
    expect(d.level).toBe(3);
    expect(report[0]?.levels).toBe(2);
  });

  it('dejar y recoger mascotas; el establo tiene capacidad', () => {
    const pets = Pets.emptyPets();
    expect(Pets.addPet(pets, Pets.createPet('gotin'), 0)).toBe('activa');
    expect(Pets.addPet(pets, Pets.createPet('brotin'), 0)).toBe('establo');
    expect(Pets.depositActive(pets, 0)).toBeNull();
    expect(pets.active).toBeNull();
    expect(Pets.withdraw(pets, pets.stable[0]!.uid)).toBeNull();
    expect(pets.active).not.toBeNull();
    while (pets.stable.length < Pets.STABLE_CAPACITY) pets.stable.push(Pets.createPet('guijarrin'));
    expect(Pets.addPet(pets, Pets.createPet('umbrin'), 0)).toBe('lleno');
  });
});

describe('mascota en batalla', () => {
  it('elegir inicial, atacar y recibir daño', () => {
    let hit = false;
    let hurt = false;
    for (let t = 0; t < 10 && !(hit && hurt); t++) {
      const g = new Game(testState('guerrero'));
      g.enemies = [];
      expect(g.chooseStarter('chispon')).toBeNull();
      expect(g.chooseStarter('gotin')).not.toBeNull();
      const pi = g.petInstance!;
      pi.hp = 999;
      const e = g.spawnEnemy('goblin', g.playerPos.x + 2, g.playerPos.y + 2)!;
      e.hp = 200;
      e.maxHp = 200;
      g.state.player.hp = g.state.player.maxHp = 999;
      const b = g.beginBattle([e]);
      expect(b.get('pet')).toBeDefined();
      for (let i = 0; i < 60 && !b.ended; i++) {
        b.step();
        if (b.awaiting) b.defend();
        if (e.hp < 200) hit = true;
        if (pi.hp < 999) hurt = true;
      }
    }
    expect(hit).toBe(true);
    expect(hurt).toBe(true);
  });

  it('la mascota gana experiencia cuando caen enemigos', () => {
    const g = new Game(testState());
    g.enemies = [];
    g.chooseStarter('gotin');
    const pi = g.petInstance!;
    const xp0 = pi.xp + pi.level * 1000;
    const e = g.spawnEnemy('goblin', g.playerPos.x + 2, g.playerPos.y + 2)!;
    defeat(g, e);
    expect(pi.xp + pi.level * 1000).toBeGreaterThan(xp0);
  });

  it('las órdenes a la mascota se pasan a la batalla', () => {
    const g = new Game(testState());
    g.enemies = [];
    g.chooseStarter('gotin');
    const move = g.petInstance!.moves[0]!;
    g.setPetOrder(move);
    const e = g.spawnEnemy('goblin', g.playerPos.x + 2, g.playerPos.y + 2)!;
    const b = g.beginBattle([e]);
    expect(b.petOrder).toBe(move);
    expect(g.petOrder).toBeNull();
  });
});

describe('guardado v8', () => {
  it('las partidas antiguas reciben un establo vacío', () => {
    const s = testState() as unknown as Record<string, unknown>;
    delete s['pets'];
    const m = migrate(s, 7, CURRENT_SAVE_VERSION) as Record<string, unknown>;
    expect(m['pets']).toEqual({ active: null, stable: [], starterChosen: false, seen: [], caught: [] });
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(8);
  });
});
