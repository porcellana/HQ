/** Materiales extra que sueltan los enemigos según el bioma (tabla `drop_<bioma>`, 45 % de una tirada). */
import type { LootEntry, LootTableDef } from '../schema';

const t = (biome: string, entries: LootEntry[]): LootTableDef => ({ id: `drop_${biome}`, rolls: [1, 1], entries: [{ nothing: true, weight: 30 }, ...entries] });

export default [
  t('nieve', [{ item: 'cristal_hielo', weight: 25 }, { item: 'piel_lobo', weight: 20 }, { item: 'bomba_hielo', weight: 5 }, { item: 'lingote_plata', weight: 4 }]),
  t('montana', [{ item: 'pieza_roca', weight: 25 }, { item: 'mineral_hierro', weight: 25, min: 1, max: 2 }, { item: 'corazon_golem', weight: 4 }, { item: 'rubi_bruto', weight: 3 }]),
  t('costa', [{ item: 'perla_costa', weight: 22 }, { item: 'pescado_asado', weight: 15 }, { item: 'zafiro_bruto', weight: 3 }]),
  t('desierto', [{ item: 'ambar_desierto', weight: 22 }, { item: 'hueso_antiguo', weight: 15 }, { item: 'mineral_oro', weight: 5 }, { item: 'reliquia_antigua', weight: 2 }]),
  t('pantano', [{ item: 'resina_cieno', weight: 25 }, { item: 'hongo_cueva', weight: 18 }, { item: 'raiz_sombra', weight: 12 }, { item: 'bomba_acida', weight: 5 }]),
  t('bosque', [{ item: 'hierba_pradera', weight: 22 }, { item: 'flor_luna', weight: 8 }, { item: 'garra_lobo', weight: 15 }, { item: 'manzana', weight: 10, min: 1, max: 3 }]),
  t('pradera', [{ item: 'hierba_pradera', weight: 25 }, { item: 'queso', weight: 12 }, { item: 'manzana', weight: 12, min: 1, max: 3 }, { item: 'carta_sellada', weight: 2 }]),
] satisfies LootTableDef[];
