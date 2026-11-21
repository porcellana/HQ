/**
 * Generador de números pseudoaleatorios con semilla (mulberry32).
 * Determinista: misma semilla => misma secuencia. Se usa para mazmorras
 * rejugables, variantes de tiles y para que los tests sean reproducibles.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Estado interno actual (se puede guardar para continuar la secuencia). */
  get seed(): number {
    return this.state;
  }

  /** Número en [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [min, max] (ambos incluidos). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** true con probabilidad p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Elemento aleatorio de una lista no vacía. */
  pick<T>(list: readonly T[]): T {
    if (list.length === 0) throw new Error('Rng.pick: lista vacía');
    return list[Math.floor(this.next() * list.length)] as T;
  }

  /** Elige un elemento según pesos (weight > 0). */
  weighted<T>(list: readonly T[], weight: (item: T) => number): T {
    const total = list.reduce((s, it) => s + Math.max(0, weight(it)), 0);
    if (total <= 0) return this.pick(list);
    let r = this.next() * total;
    for (const it of list) {
      r -= Math.max(0, weight(it));
      if (r < 0) return it;
    }
    return list[list.length - 1] as T;
  }
}

/** Hash FNV-1a de una cadena a entero de 32 bits (para derivar semillas). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Semilla aleatoria no determinista (para partidas nuevas). */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
