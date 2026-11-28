import { describe, expect, it } from 'vitest';
import { applyTwoFinger, decayVelocity, Momentum, PITCH_MAX, PITCH_MIN, TwoFingerDoubleTap, TwoFingerTracker } from '@/engine/gestures';
import { computeVisible, decodeExplored, encodeExplored, fogApplies, lineClear, visionRadius } from '@/game/fog';
import { migrate } from '@/game/save/migrations';

const P = (x: number, y: number) => ({ x, y });

describe('gestos de dos dedos', () => {
  it('pellizco: separar los dedos acerca (zoom > 0) y juntarlos aleja', () => {
    const t = new TwoFingerTracker();
    t.start(P(100, 200), P(200, 200));
    const d = t.update(P(80, 200), P(220, 200), 0.016)!;
    expect(d.zoom).toBeGreaterThan(0);
    expect(Math.abs(d.twist)).toBe(0);
    const t2 = new TwoFingerTracker();
    t2.start(P(80, 200), P(220, 200));
    expect(t2.update(P(100, 200), P(200, 200), 0.016)!.zoom).toBeLessThan(0);
  });

  it('torcer en sentido horario da giro positivo, solo tras superar el umbral', () => {
    const t = new TwoFingerTracker();
    t.start(P(100, 200), P(200, 200));
    // 1,5 grados: aún no gira (evita giros por temblor).
    const a = Math.PI / 120;
    expect(t.update(P(100, 200), P(100 + 100 * Math.cos(a), 200 + 100 * Math.sin(a)), 0.016)!.twist).toBe(0);
    let tw = 0;
    for (let i = 2; i <= 12; i++) {
      const ang = (Math.PI / 120) * i;
      tw += t.update(P(100, 200), P(100 + 100 * Math.cos(ang), 200 + 100 * Math.sin(ang)), 0.016 * i)!.twist;
    }
    expect(tw).toBeGreaterThan(0.1);
  });

  it('arrastrar con los dos dedos inclina con límites', () => {
    const cam = { yaw: 0, pitch: 0.92, zoom: 0 };
    const up = applyTwoFinger(cam, { zoom: 0, twist: 0, dx: 0, dy: -5000, dt: 0.016 }, { sens: 1, invert: false });
    expect(up.pitch).toBe(PITCH_MIN);
    const down = applyTwoFinger(cam, { zoom: 0, twist: 0, dx: 0, dy: 5000, dt: 0.016 }, { sens: 1, invert: false });
    expect(down.pitch).toBe(PITCH_MAX);
  });

  it('invertir giro y sensibilidad', () => {
    const d = { zoom: 0, twist: 0.2, dx: 0, dy: 0, dt: 0.016 };
    const cam = { yaw: 0, pitch: 0.9, zoom: 0 };
    expect(applyTwoFinger(cam, d, { sens: 1, invert: false }).yaw).toBeCloseTo(0.2);
    expect(applyTwoFinger(cam, d, { sens: 1, invert: true }).yaw).toBeCloseTo(-0.2);
    expect(applyTwoFinger(cam, d, { sens: 1.6, invert: false }).yaw).toBeCloseTo(0.32);
  });

  it('el zoom continuo se limita al rango', () => {
    const cam = { yaw: 0, pitch: 0.9, zoom: 1.5 };
    expect(applyTwoFinger(cam, { zoom: 3, twist: 0, dx: 0, dy: 0, dt: 0.016 }, { sens: 1, invert: false }).zoom).toBe(2);
  });

  it('inercia: sigue girando al soltar con el dedo en movimiento y se frena', () => {
    const m = new Momentum();
    for (let i = 0; i < 6; i++) m.sample(0.02, 0.016, i * 0.016);
    const v = m.release(6 * 0.016);
    expect(v).toBeGreaterThan(0.5);
    expect(decayVelocity(v, 0.5)).toBeLessThan(v);
    const m2 = new Momentum();
    m2.sample(0.02, 0.016, 0);
    expect(m2.release(1)).toBe(0); // llevaba parado: sin inercia
  });

  it('doble toque con dos dedos recentra; un gesto largo no cuenta', () => {
    const d = new TwoFingerDoubleTap();
    expect(d.end(0, 0.1, 2)).toBe(false);
    expect(d.end(0.3, 0.4, 2)).toBe(true);
    expect(d.end(1, 2, 2)).toBe(false);
    expect(d.end(2.1, 2.2, 50)).toBe(false);
  });
});

describe('niebla de exploración', () => {
  it('radio según clase, hora y zona', () => {
    const base = { classId: 'guerrero', kind: 'wild' as const, night: 0, darkness: 0 };
    expect(visionRadius({ ...base, classId: 'explorador' })).toBeGreaterThan(visionRadius(base));
    expect(visionRadius({ ...base, night: 1 })).toBeLessThan(visionRadius(base));
    expect(visionRadius({ ...base, kind: 'dungeon' })).toBeLessThan(visionRadius(base));
  });

  it('solo hay niebla fuera de aldeas e interiores', () => {
    expect(fogApplies('wild')).toBe(true);
    expect(fogApplies('dungeon')).toBe(true);
    expect(fogApplies('town')).toBe(false);
    expect(fogApplies('town', true)).toBe(true);
  });

  it('la visión es un disco y un muro tapa lo que hay detrás', () => {
    const w = 15, h = 9;
    const wall = (x: number, y: number) => x === 7 && y !== 0;
    const open = computeVisible(w, h, 4, 4, 6, null);
    expect(open[4 * w + 10]).toBe(1);
    expect(open[8 * w + 14]).toBe(0); // fuera del radio
    const los = computeVisible(w, h, 4, 4, 6, wall);
    expect(los[4 * w + 7]).toBe(1); // el muro se ve
    expect(los[4 * w + 9]).toBe(0); // lo de detrás no
    expect(lineClear(4, 4, 6, 4, wall)).toBe(true);
  });

  it('lo explorado se guarda y se restaura bit a bit', () => {
    const m = new Uint8Array(37);
    [0, 5, 8, 36].forEach((i) => (m[i] = 1));
    const back = decodeExplored(encodeExplored(m), 37);
    expect([...back]).toEqual([...m]);
    expect(decodeExplored('%%%', 4)).toEqual(new Uint8Array(4));
  });

  it('migración v10 → v11 añade world.explored', () => {
    const out = migrate({ world: { dungeons: {}, features: {} } } as never, 10, 11) as unknown as { world: { explored: object } };
    expect(out.world.explored).toEqual({});
  });
});
