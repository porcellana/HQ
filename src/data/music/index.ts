/**
 * MÚSICA Y AMBIENTE POR LUGAR (v0.12)
 * Datos: qué pieza suena en cada bioma/lugar y cómo suena cada paso. El motor de audio
 * (src/audio) sólo recibe los perfiles; para una pieza nueva añade una entrada a PROFILES.
 */
import type { AmbienceDef, MusicProfile, ZoneDef } from '../schema';

const P = (p: MusicProfile): MusicProfile => p;

export const PROFILES: Record<string, MusicProfile> = {
  titulo: P({ id: 'titulo', name: 'Ecos', root: 57, scale: 'menor', tempo: 62, progression: [0, 5, 3, 4], style: 'melodia', leadWave: 'triangle', padWave: 'sine', density: 0.4, bright: 0.45 }),
  campiña: P({ id: 'campiña', name: 'Campiña', root: 60, scale: 'mayor', tempo: 84, progression: [0, 3, 4, 0, 5, 3, 4, 0], style: 'melodia', leadWave: 'triangle', padWave: 'sine', density: 0.55, bright: 0.6, amb: { viento: 0.3, pajaros: 0.6, grillos: 0.7 } }),
  espesura: P({ id: 'espesura', name: 'Espesura', root: 57, scale: 'dorico', tempo: 70, progression: [0, 0, 3, 4, 0, 5, 3, 4], style: 'arpegio', leadWave: 'sine', padWave: 'triangle', density: 0.35, bright: 0.4, amb: { viento: 0.45, pajaros: 0.7, grillos: 0.8 } }),
  cumbres: P({ id: 'cumbres', name: 'Cumbres', root: 55, scale: 'pentamayor', tempo: 66, progression: [0, 2, 4, 1], style: 'pad', leadWave: 'sine', padWave: 'triangle', density: 0.3, bright: 0.5, amb: { viento: 0.85, pajaros: 0.15 } }),
  viento_helado: P({ id: 'viento_helado', name: 'Viento helado', root: 62, scale: 'lidio', tempo: 56, progression: [0, 4, 5, 3], style: 'pad', leadWave: 'sine', padWave: 'sine', density: 0.25, bright: 0.7, amb: { viento: 1 } }),
  oleaje: P({ id: 'oleaje', name: 'Oleaje', root: 62, scale: 'mixolidio', tempo: 78, progression: [0, 4, 3, 0, 5, 4, 3, 4], style: 'arpegio', leadWave: 'triangle', padWave: 'sine', density: 0.45, bright: 0.65, amb: { agua: 0.9, viento: 0.35, pajaros: 0.4 } }),
  dunas: P({ id: 'dunas', name: 'Dunas', root: 52, scale: 'armonica', tempo: 72, progression: [0, 0, 5, 4], style: 'melodia', leadWave: 'triangle', padWave: 'triangle', density: 0.4, bright: 0.5, amb: { viento: 0.6, grillos: 0.4 } }),
  cienaga: P({ id: 'cienaga', name: 'Ciénaga', root: 50, scale: 'frigio', tempo: 58, progression: [0, 1, 0, 5], style: 'pad', leadWave: 'sine', padWave: 'sawtooth', density: 0.25, bright: 0.28, amb: { agua: 0.5, grillos: 1, viento: 0.2 } }),
  aldea: P({ id: 'aldea', name: 'Aldea', root: 62, scale: 'mayor', tempo: 96, progression: [0, 4, 5, 3, 0, 3, 4, 0], style: 'melodia', leadWave: 'triangle', padWave: 'sine', density: 0.65, bright: 0.7, amb: { fuego: 0.55, pajaros: 0.4, grillos: 0.5 } }),
  ciudad: P({ id: 'ciudad', name: 'Ciudad', root: 57, scale: 'dorico', tempo: 90, progression: [0, 3, 0, 4, 5, 3, 4, 0], style: 'arpegio', leadWave: 'triangle', padWave: 'triangle', density: 0.6, bright: 0.65, amb: { fuego: 0.35, pajaros: 0.3, grillos: 0.3 } }),
  puerto: P({ id: 'puerto', name: 'Puerto', root: 60, scale: 'mixolidio', tempo: 92, progression: [0, 3, 4, 0], style: 'melodia', leadWave: 'triangle', padWave: 'sine', density: 0.6, bright: 0.65, amb: { agua: 0.8, viento: 0.3, pajaros: 0.5, fuego: 0.2 } }),
  campamento: P({ id: 'campamento', name: 'Campamento', root: 55, scale: 'pentamenor', tempo: 64, progression: [0, 3, 0, 4], style: 'arpegio', leadWave: 'sine', padWave: 'sine', density: 0.3, bright: 0.4, amb: { fuego: 1, grillos: 0.8, viento: 0.15 } }),
  ruinas: P({ id: 'ruinas', name: 'Ruinas', root: 53, scale: 'menor', tempo: 54, progression: [0, 5, 3, 4], style: 'pad', leadWave: 'sine', padWave: 'triangle', density: 0.3, bright: 0.35, amb: { viento: 0.7, goteo: 0.2 } }),
  interior: P({ id: 'interior', name: 'Hogar', root: 65, scale: 'pentamayor', tempo: 76, progression: [0, 3, 4, 2], style: 'melodia', leadWave: 'sine', padWave: 'sine', density: 0.4, bright: 0.5, amb: { fuego: 0.8 } }),
  cueva: P({ id: 'cueva', name: 'Cueva', root: 45, scale: 'frigio', tempo: 48, progression: [0, 0, 1, 5], style: 'pad', leadWave: 'sine', padWave: 'triangle', density: 0.2, bright: 0.22, amb: { goteo: 1, viento: 0.3 } }),
  cripta: P({ id: 'cripta', name: 'Cripta', root: 43, scale: 'armonica', tempo: 52, progression: [0, 5, 3, 4], style: 'pad', leadWave: 'triangle', padWave: 'sawtooth', density: 0.25, bright: 0.25, amb: { goteo: 0.6, viento: 0.45 } }),
  sala_jefe: P({ id: 'sala_jefe', name: 'Sala del jefe', root: 41, scale: 'frigio', tempo: 60, progression: [0, 1, 0, 5], style: 'pulso', leadWave: 'sawtooth', padWave: 'sawtooth', density: 0.2, bright: 0.3, drums: 0.3, amb: { goteo: 0.4, viento: 0.5 } }),
  // ---- Batalla (la intensidad sube el tempo y la percusión) ----
  batalla: P({ id: 'batalla', name: 'Batalla', root: 50, scale: 'dorico', tempo: 132, progression: [0, 0, 5, 4, 0, 3, 5, 4], style: 'marcha', leadWave: 'square', padWave: 'sawtooth', density: 0.6, bright: 0.55, drums: 0.7 }),
  batalla_oscura: P({ id: 'batalla_oscura', name: 'Batalla oscura', root: 47, scale: 'frigio', tempo: 126, progression: [0, 1, 0, 5, 0, 1, 3, 4], style: 'marcha', leadWave: 'sawtooth', padWave: 'sawtooth', density: 0.55, bright: 0.45, drums: 0.75 }),
  batalla_jefe: P({ id: 'batalla_jefe', name: 'Jefe', root: 45, scale: 'armonica', tempo: 144, progression: [0, 0, 5, 4, 0, 5, 1, 4], style: 'marcha', leadWave: 'sawtooth', padWave: 'sawtooth', density: 0.75, bright: 0.6, drums: 0.95 }),
};

/** Pieza de un lugar según su zona (generada o escrita a mano). */
export function musicIdFor(def: Pick<ZoneDef, 'id' | 'kind' | 'generated' | 'dungeon' | 'bossSpawn'>): string {
  if (def.dungeon?.floor === 'jefe' || def.bossSpawn) return 'sala_jefe';
  const g = def.generated;
  if (def.kind === 'interior') return 'interior';
  if (g) {
    switch (g.place) {
      case 'aldea': case 'pueblo': return 'aldea';
      case 'ciudad': return 'ciudad';
      case 'campamento': return 'campamento';
      case 'ruinas': return 'ruinas';
      case 'cueva': return 'cueva';
      case 'mazmorra': return 'cripta';
      default: return PROFILES[g.music] ? g.music : 'campiña';
    }
  }
  if (def.dungeon) return def.id.includes('cueva') || def.id.includes('galer') ? 'cueva' : 'cripta';
  if (def.id === 'puerto_ceniza') return 'puerto';
  if (def.id === 'bosque_sombrio') return 'espesura';
  if (def.id === 'paso_gris') return 'cumbres';
  return def.kind === 'town' ? 'aldea' : def.kind === 'dungeon' ? 'cripta' : 'campiña';
}

/** Pieza de batalla según el escenario y si hay jefe. */
export function battleMusicId(biome: string | undefined, boss: boolean): string {
  if (boss) return 'batalla_jefe';
  return biome && ['cueva', 'cripta', 'pantano'].includes(biome) ? 'batalla_oscura' : 'batalla';
}

/** ¿El lugar está al aire libre (cambia con la hora del día)? */
export function isOutdoorKind(kind: string): boolean {
  return kind === 'town' || kind === 'wild' || kind === 'world';
}

export function ambienceOf(id: string): AmbienceDef | undefined {
  return PROFILES[id]?.amb;
}

/** Sonido de pasos según el tile del suelo. */
const STEP: Record<string, string> = {
  hierba: 'hierba', flores: 'hierba', arbusto: 'hierba', camino: 'tierra', adoquin: 'piedra', suelo: 'piedra', suelo_cueva: 'piedra',
  suelo_seda: 'piedra', suelo_cripta: 'piedra', escalera_bajada: 'piedra', escalera_subida: 'piedra', grava: 'grava', arena: 'arena',
  nieve: 'nieve', hielo: 'nieve', cieno: 'cieno', agua_cieno: 'agua', agua: 'agua', puente: 'madera', muelle: 'madera', madera: 'madera',
  alfombra: 'alfombra', puerta: 'madera', fogata: 'tierra', tienda_campana: 'tierra', cueva: 'piedra',
};
export function stepSfxFor(tileId: string | undefined): 'paso_hierba' | 'paso_piedra' | 'paso_arena' | 'paso_nieve' | 'paso_agua' | 'paso_madera' {
  switch (STEP[tileId ?? ''] ?? 'piedra') {
    case 'hierba': case 'tierra': case 'alfombra': return 'paso_hierba';
    case 'arena': case 'grava': return 'paso_arena';
    case 'nieve': return 'paso_nieve';
    case 'agua': case 'cieno': return 'paso_agua';
    case 'madera': return 'paso_madera';
    default: return 'paso_piedra';
  }
}
