/**
 * Gestor de guardado: serializa GameState en un "sobre" con versión,
 * mantiene una copia de seguridad del guardado anterior y aplica
 * migraciones al cargar.
 */
import type { GameState } from '../state';
import { CURRENT_SAVE_VERSION, migrate, type RawSave } from './migrations';
import type { KeyValueStore } from './storage';

export const SAVE_KEY = 'ecos.save.main';
export const BACKUP_KEY = 'ecos.save.backup';

/** Formato en disco. No cambies los nombres de estos campos. */
export interface SaveEnvelope {
  saveVersion: number;
  gameVersion: string;
  savedAt: string;
  state: RawSave;
}

export interface SaveSummary {
  name: string;
  level: number;
  zone: string;
  savedAt: string;
  gameVersion: string;
}

export type LoadResult =
  | { ok: true; state: GameState; migratedFrom: number | null; usedBackup: boolean }
  | { ok: false; reason: 'empty' | 'error'; message: string };

function parseEnvelope(raw: string | null): SaveEnvelope | null {
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Partial<SaveEnvelope>;
    if (typeof env.saveVersion !== 'number' || typeof env.state !== 'object' || env.state === null) return null;
    return {
      saveVersion: env.saveVersion,
      gameVersion: String(env.gameVersion ?? '?'),
      savedAt: String(env.savedAt ?? ''),
      state: env.state,
    };
  } catch {
    return null;
  }
}

/** Comprobación mínima de que el estado migrado tiene lo imprescindible. */
function isPlausibleState(s: RawSave): s is RawSave & GameState {
  const p = s['player'] as Record<string, unknown> | undefined;
  const pos = p?.['pos'] as Record<string, unknown> | undefined;
  return (
    !!p &&
    typeof p['name'] === 'string' &&
    typeof p['hp'] === 'number' &&
    !!pos &&
    typeof pos['zone'] === 'string' &&
    typeof pos['x'] === 'number' &&
    typeof pos['y'] === 'number'
  );
}

export class SaveManager {
  constructor(
    private readonly stores: KeyValueStore[],
    private readonly gameVersion: string,
  ) {
    if (stores.length === 0) throw new Error('SaveManager necesita al menos un almacén');
  }

  /** Lee una clave de todos los almacenes y devuelve el sobre más reciente. */
  private async readNewest(key: string): Promise<SaveEnvelope | null> {
    let best: SaveEnvelope | null = null;
    for (const store of this.stores) {
      try {
        const env = parseEnvelope(await store.get(key));
        if (env && (!best || env.savedAt > best.savedAt)) best = env;
      } catch (e) {
        console.warn(`[guardado] error leyendo ${store.name}`, e);
      }
    }
    return best;
  }

  private async writeAll(key: string, value: string): Promise<void> {
    const results = await Promise.allSettled(this.stores.map((s) => s.set(key, value)));
    if (results.every((r) => r.status === 'rejected')) {
      throw new Error('No se pudo guardar la partida en ningún almacén');
    }
  }

  async save(state: GameState): Promise<void> {
    const previous = await this.readNewest(SAVE_KEY);
    if (previous) await this.writeAll(BACKUP_KEY, JSON.stringify(previous));
    const env: SaveEnvelope = {
      saveVersion: CURRENT_SAVE_VERSION,
      gameVersion: this.gameVersion,
      savedAt: new Date().toISOString(),
      state: structuredClone(state) as unknown as RawSave,
    };
    await this.writeAll(SAVE_KEY, JSON.stringify(env));
  }

  async load(): Promise<LoadResult> {
    const main = await this.readNewest(SAVE_KEY);
    const backup = await this.readNewest(BACKUP_KEY);
    if (!main && !backup) return { ok: false, reason: 'empty', message: 'No hay partida guardada' };

    let lastError = 'Partida dañada';
    for (const [env, usedBackup] of [[main, false], [backup, true]] as const) {
      if (!env) continue;
      try {
        const migrated = migrate(env.state, env.saveVersion);
        if (!isPlausibleState(migrated)) throw new Error('Faltan datos esenciales en la partida');
        return {
          ok: true,
          state: migrated,
          migratedFrom: env.saveVersion !== CURRENT_SAVE_VERSION ? env.saveVersion : null,
          usedBackup,
        };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error('[guardado] no se pudo cargar', usedBackup ? 'la copia de seguridad' : 'la partida', e);
      }
    }
    return { ok: false, reason: 'error', message: lastError };
  }

  /** Resumen para el menú principal (sin migrar ni validar a fondo). */
  async summary(): Promise<SaveSummary | null> {
    const env = (await this.readNewest(SAVE_KEY)) ?? (await this.readNewest(BACKUP_KEY));
    if (!env) return null;
    const p = (env.state['player'] ?? {}) as Record<string, unknown>;
    const pos = (p['pos'] ?? {}) as Record<string, unknown>;
    return {
      name: String(p['name'] ?? '¿?'),
      level: Number(p['level'] ?? 1),
      zone: String(pos['zone'] ?? ''),
      savedAt: env.savedAt,
      gameVersion: env.gameVersion,
    };
  }

  async hasSave(): Promise<boolean> {
    return (await this.summary()) !== null;
  }

  async deleteAll(): Promise<void> {
    for (const s of this.stores) {
      await s.remove(SAVE_KEY);
      await s.remove(BACKUP_KEY);
    }
  }
}

// ------------------------------------------------------- exportar / importar
const CODE_PREFIX = 'ECOS1:';

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Código de texto con la partida (para copiarla a otro dispositivo o versión). */
export function exportCode(state: GameState, gameVersion: string): string {
  const env: SaveEnvelope = {
    saveVersion: CURRENT_SAVE_VERSION,
    gameVersion,
    savedAt: new Date().toISOString(),
    state: structuredClone(state) as unknown as RawSave,
  };
  return CODE_PREFIX + toBase64(JSON.stringify(env));
}

/** Lee un código exportado; aplica migraciones si es de una versión antigua. */
export function importCode(code: string): LoadResult {
  const clean = code.trim().replace(/\s+/g, '');
  if (!clean.startsWith(CODE_PREFIX)) return { ok: false, reason: 'error', message: 'Ese texto no es un código de partida de Ecos del Abismo.' };
  let env: SaveEnvelope | null = null;
  try {
    env = parseEnvelope(fromBase64(clean.slice(CODE_PREFIX.length)));
  } catch {
    env = null;
  }
  if (!env) return { ok: false, reason: 'error', message: 'El código está incompleto o dañado. Cópialo entero.' };
  try {
    const migrated = migrate(env.state, env.saveVersion);
    if (!isPlausibleState(migrated)) throw new Error('Faltan datos esenciales en la partida');
    return { ok: true, state: migrated, migratedFrom: env.saveVersion !== CURRENT_SAVE_VERSION ? env.saveVersion : null, usedBackup: false };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
