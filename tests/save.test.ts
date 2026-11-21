import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION, SaveMigrationError, migrate, type Migration } from '@/game/save/migrations';
import { BACKUP_KEY, SAVE_KEY, SaveManager } from '@/game/save/saveManager';
import { MemoryStore } from '@/game/save/storage';
import { testState } from './helpers';

const newState = () => testState();

describe('guardado', () => {
  it('guarda y carga sin pérdidas', async () => {
    const store = new MemoryStore();
    const sm = new SaveManager([store], '0.0.0-test');
    const s = newState();
    s.player.gold = 999;
    s.flags['prueba'] = true;
    await sm.save(s);
    const res = await sm.load();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state).toEqual(s);
      expect(res.migratedFrom).toBeNull();
    }
    const env = JSON.parse(store.data.get(SAVE_KEY)!);
    expect(env.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(env.gameVersion).toBe('0.0.0-test');
  });

  it('mantiene copia de seguridad y la usa si el principal está dañado', async () => {
    const store = new MemoryStore();
    const sm = new SaveManager([store], 't');
    const s = newState();
    s.player.gold = 1;
    await sm.save(s);
    s.player.gold = 2;
    await sm.save(s);
    expect(JSON.parse(store.data.get(BACKUP_KEY)!).state.player.gold).toBe(1);
    store.data.set(SAVE_KEY, '{basura');
    const res = await sm.load();
    expect(res.ok && res.usedBackup).toBe(true);
    if (res.ok) expect(res.state.player.gold).toBe(1);
  });

  it('elige el guardado más reciente entre varios almacenes', async () => {
    const a = new MemoryStore();
    const b = new MemoryStore();
    const s = newState();
    await new SaveManager([a], 't').save({ ...s, turn: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await new SaveManager([b], 't').save({ ...s, turn: 2 });
    const res = await new SaveManager([a, b], 't').load();
    expect(res.ok && res.state.turn).toBe(2);
  });

  it('sin partida devuelve "empty"', async () => {
    const res = await new SaveManager([new MemoryStore()], 't').load();
    expect(res).toMatchObject({ ok: false, reason: 'empty' });
  });
});

describe('migraciones', () => {
  const chain: Record<number, Migration> = {
    1: (s) => ({ ...s, inventory: [] }),
    2: (s) => ({ ...s, gold: (s['gold'] as number) * 100 }),
  };

  it('encadena migraciones en orden', () => {
    expect(migrate({ gold: 3 }, 1, 3, chain)).toEqual({ gold: 300, inventory: [] });
    expect(migrate({ gold: 3, inventory: [] }, 2, 3, chain)).toEqual({ gold: 300, inventory: [] });
  });

  it('no modifica el objeto original', () => {
    const original = { gold: 3 };
    migrate(original, 1, 3, chain);
    expect(original).toEqual({ gold: 3 });
  });

  it('falla si falta un paso o si el save es más nuevo que el juego', () => {
    expect(() => migrate({}, 1, 4, chain)).toThrow(SaveMigrationError);
    expect(() => migrate({}, 5, 3, chain)).toThrow(/más nueva/);
  });

  it('cada versión anterior a la actual tiene migración', async () => {
    const { MIGRATIONS } = await import('@/game/save/migrations');
    for (let v = 1; v < CURRENT_SAVE_VERSION; v++) expect(MIGRATIONS[v], `falta migración ${v}→${v + 1}`).toBeTypeOf('function');
  });
});
