import { afterEach, describe, expect, it } from 'vitest';
import { PinchSteps, clampStep, defaultZoom, stepLimits, tilesAcross, zoomForStep, zoomLevels, ZOOM_MAX_LEVELS } from '@/engine/zoom';
import { DEFAULT_SETTINGS, loadSettings } from '@/game/settings';

describe('niveles de zoom', () => {
  it('móvil típico (1032 px de ancho): 6 niveles enteros, de ~8 a ~30 casillas, con el de por defecto dentro', () => {
    const across = 1032;
    const levels = zoomLevels(across);
    expect(levels.length).toBeGreaterThanOrEqual(5);
    expect(levels.length).toBeLessThanOrEqual(ZOOM_MAX_LEVELS);
    expect(levels).toContain(defaultZoom(across));
    // Enteros y ordenados de más cerca (zoom grande) a más lejos.
    for (const z of levels) expect(Number.isInteger(z)).toBe(true);
    expect([...levels].sort((a, b) => b - a)).toEqual(levels);
    // Rango de casillas visibles razonable.
    expect(tilesAcross(across, levels[0]!)).toBeGreaterThanOrEqual(7.5);
    expect(tilesAcross(across, levels[levels.length - 1]!)).toBeLessThanOrEqual(31);
  });

  it('el nivel por defecto es el actual (~12 casillas)', () => {
    expect(defaultZoom(1032)).toBe(5);
    expect(tilesAcross(1032, 5)).toBeCloseTo(12.9, 1);
  });

  it('pantallas muy densas reparten los niveles sin pasar de 7 y conservan el por defecto', () => {
    for (const across of [1440, 1800, 2400]) {
      const levels = zoomLevels(across);
      expect(levels.length).toBeLessThanOrEqual(ZOOM_MAX_LEVELS);
      expect(levels).toContain(defaultZoom(across));
      expect(new Set(levels).size).toBe(levels.length);
    }
  });

  it('pantallas muy pequeñas siguen teniendo al menos 3 niveles enteros', () => {
    expect(zoomLevels(393).length).toBeGreaterThanOrEqual(3);
    expect(zoomLevels(200).length).toBeGreaterThanOrEqual(1);
  });

  it('pasos: 0 = defecto, +1 más cerca, −1 más lejos, con límites', () => {
    const across = 1032;
    const levels = zoomLevels(across);
    const def = defaultZoom(across);
    expect(zoomForStep(levels, def, 0)).toBe(def);
    expect(zoomForStep(levels, def, 1)).toBeGreaterThan(def);
    expect(zoomForStep(levels, def, -1)).toBeLessThan(def);
    const lim = stepLimits(levels, def);
    expect(lim.min).toBeLessThan(0);
    expect(lim.max).toBeGreaterThan(0);
    expect(clampStep(levels, def, 99)).toBe(lim.max);
    expect(clampStep(levels, def, -99)).toBe(lim.min);
    expect(zoomForStep(levels, def, 99)).toBe(levels[0]);
    expect(zoomForStep(levels, def, -99)).toBe(levels[levels.length - 1]);
  });
});

describe('pellizco', () => {
  it('cambia de nivel al superar un umbral y no continuamente', () => {
    const p = new PinchSteps();
    p.start(100);
    expect(p.update(110)).toBe(0);
    expect(p.update(125)).toBe(0);
    expect(p.update(131)).toBe(1); // separar un 30 %: acercar
    expect(p.update(135)).toBe(0); // la referencia se reinició
    expect(p.update(95)).toBe(-1); // juntar un 25 %: alejar (131 → 95)
    expect(p.update(94)).toBe(0);
  });

  it('se pueden encadenar varios pasos en un solo gesto', () => {
    const p = new PinchSteps();
    p.start(100);
    let steps = 0;
    for (let d = 100; d <= 400; d += 20) steps += p.update(d);
    expect(steps).toBeGreaterThanOrEqual(3);
  });
});

describe('ajuste de zoom', () => {
  const store = new Map<string, string>();
  const original = (globalThis as { localStorage?: unknown }).localStorage;
  afterEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = original;
    store.clear();
  });

  it('valor por defecto 0', () => {
    expect(DEFAULT_SETTINGS.zoomStep).toBe(0);
    expect(DEFAULT_SETTINGS.combatFx).toBe('completos');
  });

  it('los ajustes guardados por versiones antiguas (sin zoom ni efectos) siguen cargando', () => {
    store.set('ecos.settings', JSON.stringify({ joystick: true, hand: 'izquierda', combatSpeed: 'lenta' }));
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    const s = loadSettings();
    expect(s.joystick).toBe(true);
    expect(s.hand).toBe('izquierda');
    expect(s.battleSpeed).toBe('normal'); // «combatSpeed» antiguo: se descarta
    expect('combatSpeed' in s).toBe(false);
    expect(s.zoomStep).toBe(0);
    expect(s.combatFx).toBe('completos');
  });
});
