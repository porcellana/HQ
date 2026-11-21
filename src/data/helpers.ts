/**
 * Ayudantes para escribir contenido más rápido. NO es una carpeta de datos:
 * el registro no carga este archivo; los datos lo importan.
 */
import type { DialogEffect, DialogNode, DialogOption, ZoneDef } from './schema';

/**
 * Crea un interior (casa, tienda, templo...). La salida '1' del mapa vuelve a
 * la puerta `door` de la zona `outside`.
 */
export function interior(
  id: string,
  name: string,
  outside: string,
  door: string,
  map: string[],
  extra: Partial<ZoneDef> = {},
): ZoneDef {
  return {
    id,
    name,
    kind: 'interior',
    level: 1,
    exits: { '1': { to: outside, arrive: door, label: 'Salir', tile: 'puerta' } },
    exitTile: 'madera',
    spawnTile: 'madera',
    map,
    ...extra,
  };
}


/**
 * Diálogo estándar de un PNJ: saludo, misiones, servicio (tienda, posada o
 * templo), rumores y despedida. Puedes añadir nodos y opciones propios.
 */
export function npcDialog(o: {
  greeting: string | string[];
  rumors?: string[];
  quests?: boolean;
  shop?: string;
  shopLabel?: string;
  inn?: number;
  temple?: number;
  extraOptions?: DialogOption[];
  extraNodes?: Record<string, DialogNode>;
}): Record<string, DialogNode> {
  const options: DialogOption[] = [...(o.extraOptions ?? [])];
  if (o.quests) options.push({ label: '📜 Misiones', action: { type: 'quests' } });
  if (o.shop) options.push({ label: `🛒 ${o.shopLabel ?? 'Ver mercancía'}`, action: { type: 'shop', shop: o.shop } });
  if (o.inn !== undefined) options.push({ label: `🛏️ Descansar (${o.inn} oro)`, action: { type: 'inn', price: o.inn } });
  if (o.temple !== undefined) options.push({ label: '🕯️ Pedir sanación', action: { type: 'temple', pricePerLevel: o.temple } });
  if (o.rumors?.length) options.push({ label: '💬 ¿Qué se cuenta por aquí?', goto: 'rumores' });
  options.push({ label: 'Adiós', action: { type: 'end' } });
  const nodes: Record<string, DialogNode> = { inicio: { text: o.greeting, options }, ...(o.extraNodes ?? {}) };
  if (o.rumors?.length) {
    nodes['rumores'] = {
      text: o.rumors,
      options: [
        { label: '💬 Cuéntame otra cosa', goto: 'rumores' },
        { label: 'Volver', goto: 'inicio' },
        { label: 'Adiós', action: { type: 'end' } },
      ],
    };
  }
  return nodes;
}

/** Opciones estándar para cerrar un nodo de respuesta. */
export const BACK: DialogOption[] = [
  { label: 'Volver', goto: 'inicio' },
  { label: 'Adiós', action: { type: 'end' } },
];

/** Nodo de respuesta con efectos (aplicados una sola vez si se da `once`). */
export function reply(text: string | string[], effects?: DialogEffect[], once?: string, options: DialogOption[] = BACK): DialogNode {
  return { text, options, ...(effects ? { effects } : {}), ...(once ? { once } : {}) };
}
