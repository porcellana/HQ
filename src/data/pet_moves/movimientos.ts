/**
 * Movimientos de mascota. Cada mascota conoce como máximo 4.
 *  - daño: `dice` + 1/3 de `stat` (atk o mag) × eficacia de tipo.
 *  - curar: `heal` al jugador (o a la propia mascota con `self`).
 *  - proteger: `shield` (+CA al jugador unos turnos).
 *  - mejora: `buff` temporal de la mascota.
 */
import type { PetMoveDef } from '../schema';

export default [
  // --- Básicos ---------------------------------------------------------------
  { id: 'placaje', name: 'Placaje', icon: '💥', type: 'tierra', kind: 'daño', dice: '1d6', stat: 'atk', range: 1, cooldown: 0,
    description: 'Embestida sencilla cuerpo a cuerpo.' },
  { id: 'mordisco', name: 'Mordisco', icon: '🦷', type: 'sombra', kind: 'daño', dice: '1d6+1', stat: 'atk', range: 1, cooldown: 0,
    description: 'Muerde con ganas. Puede hacer sangrar.', applyStatus: { id: 'sangrado', chance: 0.2, turns: 2 } },
  // --- Fuego -----------------------------------------------------------------
  { id: 'ascua', name: 'Ascua', icon: '🔥', type: 'fuego', kind: 'daño', dice: '1d6', stat: 'mag', range: 3, cooldown: 0,
    description: 'Escupe una brasa a distancia.', applyStatus: { id: 'quemado', chance: 0.15, turns: 2 } },
  { id: 'garra_ignea', name: 'Garra ígnea', icon: '🪝', type: 'fuego', kind: 'daño', dice: '1d10', stat: 'atk', range: 1, cooldown: 1,
    description: 'Zarpazo envuelto en llamas. Puede quemar.', applyStatus: { id: 'quemado', chance: 0.35, turns: 3 } },
  { id: 'llamarada', name: 'Llamarada', icon: '🌋', type: 'fuego', kind: 'daño', dice: '2d6', stat: 'mag', range: 3, radius: 1, cooldown: 3,
    description: 'Una explosión de fuego que alcanza a los que rodean al objetivo.', applyStatus: { id: 'quemado', chance: 0.3, turns: 3 } },
  { id: 'calor_interior', name: 'Calor interior', icon: '♨️', type: 'fuego', kind: 'mejora', range: 0, cooldown: 5,
    description: '+3 al ataque de tu mascota durante 4 turnos.', buff: { stat: 'atk', amount: 3, turns: 4 } },
  // --- Agua ------------------------------------------------------------------
  { id: 'chorro', name: 'Chorro', icon: '💧', type: 'agua', kind: 'daño', dice: '1d6', stat: 'mag', range: 3, cooldown: 0,
    description: 'Un chorro de agua a presión.' },
  { id: 'burbuja_escudo', name: 'Burbuja escudo', icon: '🫧', type: 'agua', kind: 'proteger', range: 0, cooldown: 6,
    description: 'Te envuelve en una burbuja: +2 a tu CA durante 3 turnos.', shield: { amount: 2, turns: 3 } },
  { id: 'remolino', name: 'Remolino', icon: '🌀', type: 'agua', kind: 'daño', dice: '2d6', stat: 'mag', range: 2, radius: 1, cooldown: 3,
    description: 'Un remolino que arrastra a varios enemigos y los ralentiza.', applyStatus: { id: 'ralentizado', chance: 0.4, turns: 2 } },
  { id: 'marea_curativa', name: 'Marea curativa', icon: '🌊', type: 'agua', kind: 'curar', heal: '2d6', range: 0, cooldown: 5,
    description: 'Agua fresca que te cura 2d6 + magia/3 PV.' },
  // --- Planta ----------------------------------------------------------------
  { id: 'latigo_cepa', name: 'Látigo cepa', icon: '🌿', type: 'planta', kind: 'daño', dice: '1d6', stat: 'atk', range: 2, cooldown: 0,
    description: 'Un latigazo de liana a dos casillas.' },
  { id: 'esporas', name: 'Esporas', icon: '🍄', type: 'planta', kind: 'daño', dice: '1d4', stat: 'mag', range: 3, cooldown: 3,
    description: 'Una nube de esporas que envenena (70 %).', applyStatus: { id: 'veneno', chance: 0.7, turns: 3 } },
  { id: 'raices', name: 'Raíces', icon: '🌱', type: 'planta', kind: 'daño', dice: '1d8', stat: 'mag', range: 3, cooldown: 2,
    description: 'Raíces que atrapan: ralentiza al objetivo.', applyStatus: { id: 'ralentizado', chance: 0.6, turns: 2 } },
  { id: 'fotosintesis', name: 'Fotosíntesis', icon: '☀️', type: 'planta', kind: 'curar', heal: '2d6', self: true, range: 0, cooldown: 4,
    description: 'La mascota se cura a sí misma con la luz.' },
  // --- Tierra ----------------------------------------------------------------
  { id: 'lanzarrocas', name: 'Lanzarrocas', icon: '🪨', type: 'tierra', kind: 'daño', dice: '1d8', stat: 'atk', range: 3, cooldown: 1,
    description: 'Lanza una piedra a distancia.' },
  { id: 'coraza_piedra', name: 'Coraza de piedra', icon: '🛡️', type: 'tierra', kind: 'proteger', range: 0, cooldown: 6,
    description: 'Te cubre de lascas de piedra: +3 a tu CA durante 3 turnos.', shield: { amount: 3, turns: 3 } },
  { id: 'temblor', name: 'Temblor', icon: '🌍', type: 'tierra', kind: 'daño', dice: '2d6', stat: 'atk', range: 1, radius: 1, cooldown: 3,
    description: 'Golpea el suelo: daña a todo lo que rodea al objetivo y puede aturdir.', applyStatus: { id: 'aturdido', chance: 0.2, turns: 1 } },
  // --- Sombra ----------------------------------------------------------------
  { id: 'susurro', name: 'Susurro oscuro', icon: '🌑', type: 'sombra', kind: 'daño', dice: '1d4', stat: 'mag', range: 3, cooldown: 3,
    description: 'Palabras que paralizan: aturde 1 turno (45 %).', applyStatus: { id: 'aturdido', chance: 0.45, turns: 1 } },
  { id: 'zarpa_umbria', name: 'Zarpa umbría', icon: '🦇', type: 'sombra', kind: 'daño', dice: '2d6', stat: 'atk', range: 1, cooldown: 1,
    description: 'Un zarpazo desde la oscuridad. Hace sangrar.', applyStatus: { id: 'sangrado', chance: 0.4, turns: 3 } },
  { id: 'velo_noche', name: 'Velo de noche', icon: '🌫️', type: 'sombra', kind: 'proteger', range: 0, cooldown: 6,
    description: 'Una neblina te oculta a medias: +2 a tu CA durante 4 turnos.', shield: { amount: 2, turns: 4 } },
  // --- Luz -------------------------------------------------------------------
  { id: 'destello', name: 'Destello', icon: '✨', type: 'luz', kind: 'daño', dice: '1d6', stat: 'mag', range: 4, cooldown: 0,
    description: 'Un fogonazo que puede aturdir (20 %).', applyStatus: { id: 'aturdido', chance: 0.2, turns: 1 } },
  { id: 'rayo_aurora', name: 'Rayo aurora', icon: '🌈', type: 'luz', kind: 'daño', dice: '2d8', stat: 'mag', range: 4, cooldown: 2,
    description: 'Un haz de luz pura. Devastador contra no-muertos.' },
  { id: 'bendicion_luz', name: 'Bendición de luz', icon: '💛', type: 'luz', kind: 'curar', heal: '2d8', range: 0, cooldown: 5,
    description: 'Te cura 2d8 + magia/3 PV.' },
] satisfies PetMoveDef[];
