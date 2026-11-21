/** Misiones personales de los compañeros (sólo mientras te acompañan). */
import type { QuestDef } from '../schema';

export default [
  {
    id: 'cq_sira', name: 'La lista de Sira', kind: 'secundaria', giver: 'sira', requiresFlag: 'reclutado_sira',
    description: 'Sira tiene una lista de cultistas con precio. Si le ayudas a tachar tres nombres, compartirá la recompensa... y algo más.',
    completeText: '(Tacha tres nombres con una sonrisa) Esto se merece algo especial. Mi arco de repuesto: cuídalo mejor que tu vida.',
    objectives: [{ type: 'kill', enemy: 'cultista', count: 3, label: 'Abate 3 cultistas del Abismo' }],
    rewards: { xp: 300, gold: 80, items: [{ item: 'arco_largo' }], flag: 'sira_lealtad' },
  },
  {
    id: 'cq_brann', name: 'El ojo de Brann', kind: 'secundaria', giver: 'brann', requiresFlag: 'reclutado_brann', minLevel: 4,
    description: 'Un orco bruto le quitó el ojo a Brann. Ronda por las Galerías de Seda o la Cripta. Brann quiere cobrarse la deuda.',
    completeText: '(Mira el cadáver un buen rato) ...Ya está. Gracias. Toma mi escudo viejo: yo ya no lo necesito para dormir tranquilo.',
    objectives: [{ type: 'kill', enemy: 'orco_bruto', count: 1, label: 'Mata a un orco bruto' }],
    rewards: { xp: 400, gold: 60, items: [{ item: 'escudo_hierro' }], flag: 'brann_lealtad' },
  },
] satisfies QuestDef[];
