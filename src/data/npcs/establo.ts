/**
 * Tobías, el cuidador de criaturas (v0.3): está junto al corral de Brumaroja.
 * Abre el establo (elegir mascota inicial, dejar/recoger y curar).
 */
import { npcDialog } from '../helpers';
import type { NpcDef } from '../schema';

export default [
  {
    id: 'cuidador_tobias', name: 'Tobías', title: 'Cuidador de criaturas', zone: 'aldea_brumaroja', x: 9, y: 17,
    look: { cloth: '#6a7a3a', clothDark: '#3a4a1f', pants: '#4a3a2a', hat: '#8a6a3a', hair: '#c8c0c8' },
    facingLeft: true,
    dialog: npcDialog({
      greeting: [
        '¡Eh, cuidado con el corral! Estas criaturas muerden... con cariño. ¿Vienes a por una compañera?',
        'Una criatura bien criada vale más que una espada. Y te quiere más, también.',
      ],
      rumors: [
        'En el Bosque Sombrío y en el Paso Gris viven guijarrines. Se hacen bola si les gritas.',
        'Dicen que en las cuevas revolotean umbrines, murcielaguitos de humo. Les gusta lo que brilla.',
        'Si debilitas a una criatura salvaje, una Runa de vínculo puede hacer que se quede contigo. Pim las vende.',
        'Las que dejes aquí seguirán entrenando conmigo, aunque tú estés lejos. Eso sí: no más fuertes que tú.',
        'Un destellín es raro de ver. Si alguna vez encuentras uno, trátalo bien: cura a los heridos.',
      ],
      quests: true,
      extraOptions: [{ label: '🐾 Ver el establo', action: { type: 'stable' } }],
    }),
  },
] satisfies NpcDef[];
