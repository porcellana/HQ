/** Iconos de lo que hay en una zona (para el rótulo al entrar): sirven para saber si se puede interactuar. */
import type { NpcDef, ZoneDef } from '@/data/schema';
import { npcMarker, type QuestHolder } from './quests/quests';

export interface ZoneIcon {
  icon: string;
  label: string;
}

export function zoneIcons(def: ZoneDef, npcs: readonly NpcDef[], state: QuestHolder): ZoneIcon[] {
  const out: ZoneIcon[] = [];
  const hasShop = npcs.some((n) => Object.values(n.dialog).some((d) => d.options.some((o) => o.action?.type === 'shop')));
  if (hasShop) out.push({ icon: '🛒', label: 'Tienda' });
  if (npcs.length) out.push({ icon: '💬', label: 'Gente' });
  if (npcs.some((n) => npcMarker(state, n.id))) out.push({ icon: '❗', label: 'Misión' });
  if (def.encounters || def.bossSpawn) out.push({ icon: '⚔', label: 'Peligro' });
  if (def.features?.some((f) => f.kind === 'mineral')) out.push({ icon: '⛏', label: 'Minerales' });
  return out;
}
