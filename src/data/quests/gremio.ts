/** Encargos repetibles del tablón del gremio (Puerto Ceniza). */
import type { QuestDef } from '../schema';

export default [
  {
    id: 'rq_lobos', name: 'Encargo: lobos del paso', kind: 'repetible', giver: 'maestre_doran', cooldownTurns: 150,
    description: 'Los lobos atacan a las caravanas del Paso Gris.',
    objectives: [{ type: 'kill', enemy: 'lobo', count: 3, label: 'Caza lobos' }],
    rewards: { xp: 70, gold: 35 },
  },
  {
    id: 'rq_goblins', name: 'Encargo: plaga goblin', kind: 'repetible', giver: 'maestre_doran', cooldownTurns: 150,
    description: 'El gremio paga por cada banda de goblins dispersada.',
    objectives: [{ type: 'kill', family: 'goblinoide', count: 6, label: 'Derrota goblins' }],
    rewards: { xp: 90, gold: 45 },
  },
  {
    id: 'rq_seda', name: 'Encargo: seda fina', kind: 'repetible', giver: 'maestre_doran', cooldownTurns: 200,
    description: 'Un sastre del puerto compra seda de araña gigante.',
    objectives: [{ type: 'collect', item: 'seda_arana', count: 3, label: 'Consigue seda de araña' }],
    rewards: { xp: 80, gold: 60 },
  },
  {
    id: 'rq_huesos', name: 'Encargo: huesos inquietos', kind: 'repetible', giver: 'maestre_doran', cooldownTurns: 200, minLevel: 3,
    description: 'Algo levanta a los muertos en los caminos. Devuélvelos a su sitio.',
    objectives: [{ type: 'kill', family: 'no-muerto', count: 2, label: 'Destruye no-muertos' }],
    rewards: { xp: 100, gold: 50 },
  },
] satisfies QuestDef[];
