/** Talentos genéricos (cualquier clase, repetibles): rellenan cuando ya tienes los de tu clase. */
import type { TalentDef } from '../schema';

export default [
  { id: 'gen_robustez', classId: 'todas', branch: 'Entrenamiento', icon: '❤️', name: 'Robustez', minLevel: 2, repeatable: true,
    description: '+5 PV máximos.', effects: [{ type: 'stat', stat: 'pv', amount: 5 }] },
  { id: 'gen_reservas', classId: 'todas', branch: 'Entrenamiento', icon: '💧', name: 'Reservas', minLevel: 2, repeatable: true,
    description: '+3 de recurso máximo (maná, vigor, energía o fe).', effects: [{ type: 'stat', stat: 'recurso', amount: 3 }] },
  { id: 'gen_veterania', classId: 'todas', branch: 'Entrenamiento', icon: '🎖️', name: 'Veteranía', minLevel: 5, repeatable: true,
    description: '+1 al ataque.', effects: [{ type: 'stat', stat: 'ataque', amount: 1 }] },
] satisfies TalentDef[];
