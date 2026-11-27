/** v0.9.1: más especies, ramas evolutivas, naturalezas, vínculo, poderes en batalla y migración v10. */
import { describe, expect, it } from 'vitest';
import { BIOMES, PET_MOVES, PET_SPECIES, PET_TYPES } from '@/data/registry';
import { Game } from '@/game/game';
import * as Pets from '@/game/pets/pets';
import { wildSpeciesIn } from '@/game/pets/wild';
import { migrate } from '@/game/save/migrations';
import { testState } from './helpers';

describe('contenido', () => {
  it('40+ especies, 8 tipos y 10+ líneas', () => {
    expect(PET_SPECIES.size).toBeGreaterThanOrEqual(40);
    expect(PET_TYPES.length).toBe(8);
    expect([...PET_SPECIES.values()].filter((s) => s.stage === 1).length).toBeGreaterThanOrEqual(10);
    expect(PET_MOVES.size).toBeGreaterThanOrEqual(55);
  });

  it('hay ramas por vínculo, naturaleza y objeto', () => {
    const evos = [...PET_SPECIES.values()].flatMap((s) => s.evolutions ?? []);
    expect(evos.some((e) => e.minBond)).toBe(true);
    expect(evos.some((e) => e.natures)).toBe(true);
    expect(evos.some((e) => e.item)).toBe(true);
    expect([...PET_SPECIES.values()].some((s) => (s.evolutions?.length ?? 0) > 1)).toBe(true);
  });

  it('cada bioma procedural tiene criaturas salvajes vinculables', () => {
    for (const id of BIOMES.keys()) expect(wildSpeciesIn('x', id).length, id).toBeGreaterThanOrEqual(2);
    expect(wildSpeciesIn('x', 'nieve', undefined, 1).every((s) => PET_SPECIES.get(s)!.stage === 1)).toBe(true);
  });

  it('todo movimiento aprendido por una especie con 4 huecos al nivel 30 es válido', () => {
    for (const s of PET_SPECIES.values()) for (const m of Pets.createPet(s.id, 30).moves) expect(PET_MOVES.has(m)).toBe(true);
  });
});

describe('naturaleza y vínculo', () => {
  it('la naturaleza sube y baja un 10 % (no la vida)', () => {
    const sp = PET_SPECIES.get('chispon')!;
    const neutral = Pets.statsAt(sp, 20);
    const osada = Pets.statsAt(sp, 20, 0, 'osada');
    expect(osada.atk).toBeGreaterThan(neutral.atk);
    expect(osada.def).toBeLessThan(neutral.def);
    expect(osada.hp).toBe(neutral.hp);
  });

  it('niveles hasta 30 y estadísticas crecientes', () => {
    const p = Pets.createPet('gotin', 1);
    Pets.gainPetXp(p, 1e9);
    expect(p.level).toBe(Pets.PET_MAX_LEVEL);
    expect(Pets.petStats(p).hp).toBeGreaterThan(Pets.statsAt(PET_SPECIES.get('gotin')!, 1).hp);
  });

  it('niveles de vínculo y caricias con espera', () => {
    expect(Pets.bondTier(0)).toBe(0);
    expect(Pets.bondTier(55)).toBe(2);
    expect(Pets.bondTier(100)).toBe(3);
    const p = Pets.createPet('chispon');
    expect(Pets.caress(p, 1000)).toBe(true);
    expect(Pets.caress(p, 1000 + 60_000)).toBe(false);
    expect(Pets.caress(p, 1000 + Pets.PET_CARESS_WAIT_MS)).toBe(true);
    expect(p.bond).toBe(6);
  });
});

describe('evoluciones ramificadas', () => {
  it('el vínculo abre la rama alternativa', () => {
    const p = Pets.createPet('escarchin', 14);
    p.nature = 'serena';
    expect(Pets.evolutionOptions(p).map((e) => e.species)).toEqual(['ventisquero']);
    p.bond = 70;
    expect(Pets.evolutionOptions(p).map((e) => e.species).sort()).toEqual(['auroral', 'ventisquero']);
    expect(Pets.evolve(p, 'auroral')?.id).toBe('auroral');
  });

  it('la naturaleza condiciona la rama', () => {
    const p = Pets.createPet('venenal', 24);
    p.nature = 'serena';
    expect(Pets.evolutionOptions(p).map((e) => e.species)).toEqual(['cienagon']);
    p.nature = 'astuta';
    expect(Pets.evolutionOptions(p).length).toBe(2);
  });

  it('las ramas con objeto sólo salen con la piedra', () => {
    const p = Pets.createPet('medusin', 14);
    expect(Pets.evolutionOptions(p).map((e) => e.species)).toEqual(['medusal']);
    const opts = Pets.evolutionOptions(p, (id) => id === 'piedra_trueno').map((e) => e.species);
    expect(opts).toContain('voltaica');
  });

  it('con piedra en la mochila evoluciona y la consume', () => {
    const g = new Game(testState());
    g.enemies = [];
    g.state.pets.active = Pets.createPet('medusin', 14);
    g.state.player.inventory.push({ uid: 'p1', id: 'piedra_trueno', qty: 1, rarity: 'comun', affixes: [] } as never);
    expect(g.evolvePetWithItem('voltaica')).toBeNull();
    expect(g.petInstance!.species).toBe('voltaica');
    expect(g.state.player.inventory.some((x) => x.id === 'piedra_trueno')).toBe(false);
    expect(g.evolvePetWithItem('voltaica')).not.toBeNull();
  });

  it('la cadena principal sigue la primera rama', () => {
    expect(Pets.evolutionLine('escarchin').map((s) => s.id)).toEqual(['escarchin', 'ventisquero', 'glaciarion']);
  });
});

describe('en batalla', () => {
  function setup(species: string, level: number, moves: string[]) {
    const g = new Game(testState('guerrero'));
    g.enemies = [];
    const pet = Pets.createPet(species, level);
    pet.moves = moves;
    pet.hp = Pets.petStats(pet).hp;
    g.state.pets.active = pet;
    g.state.player.hp = g.state.player.maxHp = 999;
    const e = g.spawnEnemy('goblin', g.playerPos.x + 2, g.playerPos.y + 2)!;
    e.hp = e.maxHp = 400;
    return { g, pet, e };
  }

  it('golpes múltiples, drenaje y apoyo funcionan', () => {
    const { g, pet, e } = setup('cienin', 12, ['hojas_navaja', 'drenaje']);
    pet.hp = 3;
    const b = g.beginBattle([e]);
    for (let i = 0; i < 40 && !b.ended && e.hp === 400; i++) {
      b.step();
      if (b.awaiting) b.defend();
    }
    expect(e.hp).toBeLessThan(400);
  });

  it('el poder pasivo «regen» cura a la mascota en su turno', () => {
    const { g, pet, e } = setup('brasalon', 16, ['placaje']);
    Object.assign(pet, { species: 'marejon' });
    pet.hp = 5;
    const b = g.beginBattle([e]);
    for (let i = 0; i < 12 && !b.ended; i++) {
      b.step();
      if (b.awaiting) b.defend();
      if (pet.hp > 5) break;
    }
    expect(pet.hp).toBeGreaterThan(5);
  });

  it('el aviso de fuerza: los movimientos de apoyo al jugador se pueden ordenar', () => {
    const { g, e } = setup('destellin', 12, ['fulgor']);
    g.setPetOrder('fulgor');
    const b = g.beginBattle([e]);
    expect(b.petOrder).toBe('fulgor');
  });
});

describe('guardado v10', () => {
  it('las mascotas antiguas reciben naturaleza', () => {
    const s = testState() as unknown as Record<string, unknown>;
    const old = { uid: 'abc', species: 'gotin', level: 3, xp: 0, hp: 10, moves: ['placaje'], bond: 0, down: false, pendingMoves: [], pendingEvolution: false };
    s['pets'] = { active: { ...old }, stable: [{ ...old, uid: 'def' }], starterChosen: true, seen: [], caught: [] };
    const m = migrate(s, 9, 10) as { pets: { active: { nature: string }; stable: Array<{ nature: string }> } };
    expect(Pets.getNature(m.pets.active.nature)).toBeDefined();
    expect(Pets.getNature(m.pets.stable[0]!.nature)).toBeDefined();
  });
});
