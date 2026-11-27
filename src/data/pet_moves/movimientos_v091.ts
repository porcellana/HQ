/** Movimientos de mascota v0.9.1: hielo, rayo y nuevos poderes (golpes múltiples, drenaje, apoyo al jugador). */
import type { PetMoveDef } from '../schema';

const d = (id: string, name: string, icon: string, type: PetMoveDef['type'], dice: string, stat: 'atk' | 'mag', range: number, cooldown: number, description: string, extra: Partial<PetMoveDef> = {}): PetMoveDef =>
  ({ id, name, icon, type, kind: 'daño', dice, stat, range, cooldown, description, ...extra });

export default [
  // --- Hielo
  d('carambano', 'Carámbano', '🧊', 'hielo', '1d6', 'mag', 3, 0, 'Lanza un carámbano. Puede ralentizar (25 %).', { applyStatus: { id: 'ralentizado', chance: 0.25, turns: 2 } }),
  d('garra_escarcha', 'Garra de escarcha', '❄️', 'hielo', '1d8', 'atk', 1, 1, 'Zarpazo helado que ralentiza (30 %).', { applyStatus: { id: 'ralentizado', chance: 0.3, turns: 2 } }),
  d('aliento_gelido', 'Aliento gélido', '🌬️', 'hielo', '2d6', 'mag', 2, 3, 'Un soplo helado en área que ralentiza (50 %).', { radius: 1, applyStatus: { id: 'ralentizado', chance: 0.5, turns: 2 } }),
  d('ventisca', 'Ventisca', '🌨️', 'hielo', '2d8', 'mag', 3, 4, 'Tormenta de nieve en área.', { radius: 1, applyStatus: { id: 'ralentizado', chance: 0.4, turns: 3 } }),
  { id: 'armadura_hielo', name: 'Armadura de hielo', icon: '🧊', type: 'hielo', kind: 'proteger', range: 0, cooldown: 6, shield: { amount: 3, turns: 3 }, description: 'Una capa de hielo te cubre: +3 CA durante 3 turnos.' },
  // --- Rayo
  d('chispazo', 'Chispazo', '⚡', 'rayo', '1d6', 'mag', 3, 0, 'Una chispa que puede aturdir (15 %).', { applyStatus: { id: 'aturdido', chance: 0.15, turns: 1 } }),
  d('colmillo_rayo', 'Colmillo de rayo', '🦷', 'rayo', '1d8', 'atk', 1, 1, 'Mordisco eléctrico que aturde (25 %).', { applyStatus: { id: 'aturdido', chance: 0.25, turns: 1 } }),
  d('descarga', 'Descarga', '🔌', 'rayo', '1d10', 'mag', 3, 1, 'Descarga directa; aturde (25 %).', { applyStatus: { id: 'aturdido', chance: 0.25, turns: 1 } }),
  d('cadena_rayos', 'Cadena de rayos', '⛓️', 'rayo', '2d6', 'mag', 3, 3, 'Salta de un enemigo a otro.', { radius: 1 }),
  d('rayo_fulminante', 'Rayo fulminante', '🌩️', 'rayo', '3d6', 'mag', 4, 4, 'Un trueno devastador, pero puede fallar.', { accuracy: 0.8 }),
  { id: 'carga_estatica', name: 'Carga estática', icon: '🔋', type: 'rayo', kind: 'mejora', range: 0, cooldown: 5, buff: { stat: 'mag', amount: 4, turns: 4 }, description: '+4 a la magia de tu mascota durante 4 turnos.' },
  // --- Planta
  d('drenaje', 'Drenaje', '🩸', 'planta', '1d6', 'mag', 3, 2, 'Absorbe vida: la mascota se cura la mitad del daño.', { drain: 0.5 }),
  d('hojas_navaja', 'Hojas navaja', '🍃', 'planta', '1d4', 'atk', 3, 2, 'Tres hojas afiladas seguidas.', { hits: 3 }),
  d('espina_venenosa', 'Espina venenosa', '🌵', 'planta', '1d6', 'atk', 1, 1, 'Pincha y envenena (50 %).', { applyStatus: { id: 'veneno', chance: 0.5, turns: 3 } }),
  { id: 'canto_floral', name: 'Canto floral', icon: '🌸', type: 'planta', kind: 'curar', heal: '2d8', range: 0, cooldown: 5, description: 'Un canto que te cura 2d8 + magia/3 PV.' },
  // --- Fuego
  d('rafaga_brasas', 'Ráfaga de brasas', '☄️', 'fuego', '1d4', 'mag', 3, 2, 'Tres brasas seguidas; pueden quemar.', { hits: 3, applyStatus: { id: 'quemado', chance: 0.15, turns: 2 } }),
  d('bola_magma', 'Bola de magma', '🟠', 'fuego', '3d6', 'mag', 3, 4, 'Magma fundido en área que quema.', { radius: 1, applyStatus: { id: 'quemado', chance: 0.4, turns: 3 } }),
  { id: 'ira_volcanica', name: 'Ira volcánica', icon: '😡', type: 'fuego', kind: 'mejora', range: 0, cooldown: 6, buff: { stat: 'atk', amount: 5, turns: 3 }, description: '+5 al ataque de tu mascota durante 3 turnos.' },
  // --- Agua
  d('cascada', 'Cascada', '🏞️', 'agua', '2d8', 'mag', 3, 3, 'Una cascada cae sobre el objetivo.'),
  d('aguijon_medusa', 'Aguijón de medusa', '🪼', 'agua', '1d6', 'atk', 1, 1, 'Pica y envenena (40 %).', { applyStatus: { id: 'veneno', chance: 0.4, turns: 3 } }),
  { id: 'niebla_curativa', name: 'Niebla curativa', icon: '🌫️', type: 'agua', kind: 'curar', heal: '1d8', cleanse: true, range: 0, cooldown: 4, description: 'Te cura 1d8 + magia/3 PV y limpia tus estados.' },
  // --- Tierra
  d('embestida', 'Embestida', '🐗', 'tierra', '1d10', 'atk', 1, 1, 'Carga con todo el peso.'),
  d('arena_ciega', 'Arena ciega', '🏜️', 'tierra', '1d4', 'mag', 3, 3, 'Arena en los ojos: ralentiza (60 %).', { applyStatus: { id: 'ralentizado', chance: 0.6, turns: 2 } }),
  d('tormenta_arena', 'Tormenta de arena', '🌪️', 'tierra', '1d8', 'mag', 3, 3, 'Arena en área que ralentiza (40 %).', { radius: 1, applyStatus: { id: 'ralentizado', chance: 0.4, turns: 2 } }),
  d('avalancha', 'Avalancha', '⛰️', 'tierra', '3d6', 'atk', 2, 4, 'Rocas por todas partes; puede aturdir (25 %).', { radius: 1, applyStatus: { id: 'aturdido', chance: 0.25, turns: 1 } }),
  { id: 'muralla', name: 'Muralla', icon: '🧱', type: 'tierra', kind: 'proteger', range: 0, cooldown: 7, shield: { amount: 4, turns: 2 }, description: 'Una muralla de roca: +4 CA durante 2 turnos.' },
  // --- Sombra
  d('bocado_vampirico', 'Bocado vampírico', '🧛', 'sombra', '1d8', 'atk', 1, 2, 'Muerde y se cura la mitad del daño.', { drain: 0.5 }),
  d('pesadilla', 'Pesadilla', '😱', 'sombra', '1d6', 'mag', 3, 3, 'Una pesadilla que aturde (35 %).', { applyStatus: { id: 'aturdido', chance: 0.35, turns: 1 } }),
  d('garra_espectral', 'Garra espectral', '👻', 'sombra', '2d8', 'atk', 1, 3, 'Zarpazo fantasmal que hace sangrar (50 %).', { applyStatus: { id: 'sangrado', chance: 0.5, turns: 3 } }),
  d('eclipse', 'Eclipse', '🌘', 'sombra', '2d8', 'mag', 3, 4, 'Oscuridad en área; puede aturdir.', { radius: 1, applyStatus: { id: 'aturdido', chance: 0.2, turns: 1 } }),
  // --- Luz
  d('lanza_solar', 'Lanza solar', '🔆', 'luz', '2d8', 'mag', 4, 2, 'Una lanza de luz que puede quemar (20 %).', { applyStatus: { id: 'quemado', chance: 0.2, turns: 2 } }),
  d('sentencia', 'Sentencia', '⚖️', 'luz', '3d8', 'mag', 4, 5, 'Juicio de luz pura, algo imprecisa.', { accuracy: 0.85 }),
  { id: 'aura_sanadora', name: 'Aura sanadora', icon: '💖', type: 'luz', kind: 'curar', heal: '3d6', range: 0, cooldown: 6, description: 'Te cura 3d6 + magia/3 PV.' },
  { id: 'escudo_sagrado', name: 'Escudo sagrado', icon: '🛡️', type: 'luz', kind: 'proteger', range: 0, cooldown: 7, shield: { amount: 3, turns: 4 }, description: 'Escudo de luz: +3 CA durante 4 turnos.' },
  { id: 'fulgor', name: 'Fulgor', icon: '🌟', type: 'luz', kind: 'mejora', range: 0, cooldown: 6, teamBuff: { stat: 'daño', amount: 2, turns: 4 }, description: 'Te inspira: +2 a tu daño durante 4 turnos.' },
  { id: 'aullido_valor', name: 'Aullido de valor', icon: '🐺', type: 'tierra', kind: 'mejora', range: 0, cooldown: 6, teamBuff: { stat: 'ataque', amount: 2, turns: 4 }, description: 'Te da ánimos: +2 a tus tiradas de ataque durante 4 turnos.' },
] satisfies PetMoveDef[];
