/** Emisor de eventos tipado y mínimo. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Array<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): () => void {
    (this.handlers[type] ??= []).push(fn);
    return () => this.off(type, fn);
  }

  off<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): void {
    const list = this.handlers[type];
    if (list) this.handlers[type] = list.filter((f) => f !== fn);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    for (const fn of this.handlers[type] ?? []) fn(payload);
  }
}
