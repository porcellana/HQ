/**
 * Almacenamiento clave-valor asíncrono.
 *  - Navegador/PWA: localStorage.
 *  - Android (Capacitor): Preferences (SharedPreferences nativas), con copia
 *    espejo en localStorage por si la app se cierra a mitad de escritura.
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface KeyValueStore {
  readonly name: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** localStorage (síncrono por debajo; seguro de usar al pausar la app). */
export class LocalStore implements KeyValueStore {
  readonly name = 'localStorage';
  async get(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }
  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

/** Preferences de Capacitor (persistente en Android aunque se limpie la caché web). */
export class NativeStore implements KeyValueStore {
  readonly name = 'preferences';
  async get(key: string): Promise<string | null> {
    return (await Preferences.get({ key })).value;
  }
  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }
  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}

/** Memoria (tests). */
export class MemoryStore implements KeyValueStore {
  readonly name = 'memory';
  readonly data = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}

/** Almacenes a usar según la plataforma (el primero es el principal). */
export function defaultStores(): KeyValueStore[] {
  return Capacitor.isNativePlatform() ? [new LocalStore(), new NativeStore()] : [new LocalStore()];
}
