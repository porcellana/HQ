/**
 * Ajustes del jugador (independientes de la partida). Se guardan en
 * localStorage con su propia versión; los campos nuevos toman el valor
 * por defecto automáticamente.
 */
/** Nivel de un canal de audio. */
export type AudioLevel = 'off' | 'bajo' | 'medio' | 'alto';

export interface Settings {
  /** Mostrar joystick virtual además del toque para mover. */
  joystick: boolean;
  /** Mano dominante: coloca el joystick/botones del lado cómodo. */
  hand: 'derecha' | 'izquierda';
  /** Velocidad de animación de movimiento. */
  moveSpeed: 'normal' | 'rapida';
  /** Vibración háptica en acciones importantes. */
  vibration: boolean;
  /** Dibujar la cuadrícula del mapa. */
  grid: boolean;
  /** Tamaño de la interfaz. */
  uiScale: 'normal' | 'grande';
  /** Efectos de sonido (generados por código). */
  sound: boolean;
  /** Volumen de los efectos. */
  volume: 'bajo' | 'medio' | 'alto';
  /** Música procedural (v0.12). */
  music: AudioLevel;
  /** Ambiente: viento, agua, pájaros, grillos, goteo, fuego (v0.12). */
  ambient: AudioLevel;
  /** Ciclo de día y noche en exteriores. */
  dayNight: boolean;
  /** Guía de misión: espíritu luminoso y runas hacia el objetivo de la misión seguida. */
  questGuide: boolean;
  /** Velocidad de batalla (v0.7): normal o rápida (animaciones más cortas). */
  battleSpeed: 'normal' | 'rapida';
  /** Efectos de batalla: completos, reducidos (menos partículas) o mínimos (sin sacudidas). */
  combatFx: 'completos' | 'reducidos' | 'minimos';
  /** Zoom del mapa: 0 = por defecto, +1 un nivel más cerca, −1 más lejos (ver engine/zoom.ts). */
  zoomStep: number;
  /** Calidad del 3D (resolución, distancia, decorado, luces). */
  quality: 'baja' | 'media' | 'alta';
  /** Cámara de dos dedos: invertir el sentido del giro. */
  cameraInvert: boolean;
  /** Sensibilidad del giro e inclinación de la cámara. */
  cameraSens: 'baja' | 'media' | 'alta';
  /** Niebla de exploración en el mapa (v0.11.1). */
  fog: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  joystick: true,
  hand: 'derecha',
  moveSpeed: 'normal',
  vibration: true,
  grid: false,
  uiScale: 'normal',
  sound: true,
  volume: 'medio',
  music: 'medio',
  ambient: 'medio',
  dayNight: true,
  questGuide: true,
  battleSpeed: 'normal',
  combatFx: 'completos',
  zoomStep: 0,
  quality: 'media',
  cameraInvert: false,
  cameraSens: 'media',
  fog: true,
};

const KEY = 'ecos.settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings> & { combatSpeed?: string };
    // v0.7: «Velocidad del combate» (paso/lenta/normal) pasa a «Velocidad de batalla».
    delete parsed.combatSpeed;
    delete (parsed as { graphics?: string }).graphics;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento disponible: se ignoran */
  }
}
