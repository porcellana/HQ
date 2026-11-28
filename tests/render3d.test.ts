import { describe, expect, it } from 'vitest';
import { rigMatrices, rigPose, type AnimInput } from '@/gfx/world3d/anim';
import { Fx3D, FX3D_CAP, ambientMote, buffBurst, count, critBurst, explosion, healBurst, impact, shockRing } from '@/gfx/world3d/fx3d';
import { cameraDistance, heroPixels } from '@/gfx/world3d/battle3d';
import { ident } from '@/gfx/world3d/mat';
import { MeshBuilder, STRIDE, hexRgb } from '@/gfx/world3d/mesh';
import { beastRig, humanoidRig, BEAST_SHAPES } from '@/gfx/world3d/models';
import { SIGNAL_COLOR, crystalMotion, gemModel, npcSignal, pathAhead, runeRingModel } from '@/gfx/world3d/signals';
import { KNOWN_OVERLAYS, portraitColors, PORTRAIT_COUNT } from '@/gfx/look';

const c = hexRgb('#88aa66');
const valid = (m: MeshBuilder): void => {
  expect(m.v.length % (STRIDE * 3)).toBe(0);
  expect(m.v.length).toBeGreaterThan(0);
  for (let i = 0; i < m.v.length; i += STRIDE) {
    for (let k = 0; k < STRIDE; k++) expect(Number.isFinite(m.v[i + k]!)).toBe(true);
    expect(Math.hypot(m.v[i + 3]!, m.v[i + 4]!, m.v[i + 5]!)).toBeCloseTo(1, 3);
  }
};

describe('primitivas suaves', () => {
  it('ball, rbox, lathe, limb y ribbon generan mallas válidas con normales unitarias', () => {
    valid(new MeshBuilder().ball(0, 0.5, 0, 0.4, 0.3, 0.4, c, { wob: 0.1, seed: 3 }));
    valid(new MeshBuilder().rbox(0, 0, 0, 0.5, 0.4, 0.3, c, { r: 0.08 }));
    valid(new MeshBuilder().lathe(0, 0, [[0, 0], [0.3, 0.05], [0.2, 0.5], [0, 0.6]], c));
    valid(new MeshBuilder().limb(0, 0, 0, 0.3, 0.8, 0.1, 0.06, 0.03, c));
    valid(new MeshBuilder().ribbon([[0, 0, 0], [0.1, 0.3, 0], [0.2, 0.5, 0.1]], [0.03, 0.02, 0.005], [0, 0, 1], c));
  });

  it('la caja redondeada queda dentro de su volumen y la esfera es redonda', () => {
    const m = new MeshBuilder().rbox(0, 0, 0, 1, 1, 1, c, { r: 0.2 });
    for (let i = 0; i < m.v.length; i += STRIDE) {
      expect(Math.abs(m.v[i]!)).toBeLessThanOrEqual(0.5001);
      expect(m.v[i + 1]!).toBeGreaterThanOrEqual(-0.0001);
      expect(m.v[i + 1]!).toBeLessThanOrEqual(1.0001);
    }
    const b = new MeshBuilder().ball(0, 0, 0, 1, 1, 1, c, { seg: 12 });
    for (let i = 0; i < b.v.length; i += STRIDE) expect(Math.hypot(b.v[i]!, b.v[i + 1]!, b.v[i + 2]!)).toBeCloseTo(1, 4);
  });

  it('el sombreado es suave: la normal de una esfera coincide con su dirección', () => {
    const b = new MeshBuilder().ball(0, 0, 0, 1, 1, 1, c, { seg: 10 });
    for (let i = 0; i < b.v.length; i += STRIDE) {
      const p = [b.v[i]!, b.v[i + 1]!, b.v[i + 2]!], n = [b.v[i + 3]!, b.v[i + 4]!, b.v[i + 5]!];
      expect(p[0]! * n[0]! + p[1]! * n[1]! + p[2]! * n[2]!).toBeGreaterThan(0.99);
    }
  });

  it('rotate gira posiciones y normales sin deformar', () => {
    const m = new MeshBuilder().limb(0, 0, 0, 0, 1, 0, 0.1, 0.1, c);
    const before = m.v.slice();
    m.rotate(0, Math.PI / 2, 0, 0, 0, 0);
    for (let i = 0; i < m.v.length; i += STRIDE) {
      expect(Math.hypot(m.v[i]!, m.v[i + 1]!, m.v[i + 2]!)).toBeCloseTo(Math.hypot(before[i]!, before[i + 1]!, before[i + 2]!), 4);
      expect(Math.hypot(m.v[i + 3]!, m.v[i + 4]!, m.v[i + 5]!)).toBeCloseTo(1, 4);
    }
  });
});

describe('animación de rigs', () => {
  const base: AnimInput = { state: 'idle', k: 0, time: 1, walkT: 0, walk: 0, seed: 1 };
  const hero = humanoidRig({ skin: '#d9a67a', hair: '#333', cloth: '#a00', clothDark: '#500', pants: '#222', overlay: 'guerrero' });
  const wolf = beastRig('lobo', { main: '#888', dark: '#444', accent: '#ccc' });

  it('cada pose es finita y produce una matriz por pieza', () => {
    for (const rig of [hero, wolf, beastRig('pajaro', { main: '#888', dark: '#444', accent: '#ccc' })]) {
      for (const state of ['idle', 'walk', 'attack', 'cast', 'hurt', 'die', 'cheer', 'defend'] as const) {
        for (const k of [0, 0.3, 0.6, 1]) {
          const pose = rigPose(rig, { ...base, state, k, walk: state === 'walk' ? 1 : 0, walkT: 2 });
          const mats = rigMatrices(rig, ident(), pose);
          expect(mats.length).toBe(rig.parts.length);
          for (const m of mats) expect([...m].every(Number.isFinite)).toBe(true);
        }
      }
    }
  });

  it('atacar levanta el brazo y luego golpea; morir tumba el cuerpo; celebrar salta', () => {
    const wind = rigPose(hero, { ...base, state: 'attack', k: 0.32 });
    const strike = rigPose(hero, { ...base, state: 'attack', k: 0.55 });
    expect(wind.arms.r.rx).toBeLessThan(strike.arms.r.rx);
    expect(wind.arms.r.rx).toBeLessThan(-2);
    expect(rigPose(hero, { ...base, state: 'die', k: 1 }).body.rz).toBeGreaterThan(1.2);
    expect(rigPose(hero, { ...base, state: 'cheer', time: 0.26 }).body.dy).toBeGreaterThan(0.05);
    expect(rigPose(hero, { ...base, state: 'hurt', k: 0.5 }).body.rx).toBeLessThan(0);
    expect(rigPose(wolf, { ...base, state: 'attack', k: 0.5 }).body.dz).toBeGreaterThan(0.1);
  });

  it('caminar mueve las piernas en oposición', () => {
    const p = rigPose(hero, { ...base, state: 'walk', walk: 1, walkT: 1.2 });
    expect(p.legs.l.rx).toBeCloseTo(-p.legs.r.rx, 5);
    expect(Math.abs(p.legs.l.rx)).toBeGreaterThan(0.3);
  });

  it('todas las formas y clases tienen rig', () => {
    for (const s of BEAST_SHAPES) expect(beastRig(s, { main: '#888', dark: '#444', accent: '#ccc' }).parts.length).toBeGreaterThan(0);
    for (const o of KNOWN_OVERLAYS) expect(humanoidRig({ skin: '#d9a67a', hair: '#333', cloth: '#a00', clothDark: '#500', pants: '#222', overlay: o }).style).toBeDefined();
    expect(PORTRAIT_COUNT).toBeGreaterThan(10);
    expect(portraitColors(3).skin).toMatch(/^#/);
  });
});

describe('señalización diegética', () => {
  it('el tipo de señal depende de la misión, la entrega y la tienda', () => {
    expect(npcSignal('!', false)).toBe('quest');
    expect(npcSignal('?', true)).toBe('turnin');
    expect(npcSignal(null, true)).toBe('shop');
    expect(npcSignal(null, false)).toBeNull();
    expect(new Set(Object.values(SIGNAL_COLOR)).size).toBe(Object.keys(SIGNAL_COLOR).length);
  });

  it('las gemas y las runas son mallas emisivas válidas', () => {
    for (const k of Object.keys(SIGNAL_COLOR) as Array<keyof typeof SIGNAL_COLOR>) {
      for (const a of [gemModel(k), runeRingModel(k)]) {
        expect(a.length % (STRIDE * 3)).toBe(0);
        expect(a[9]).toBe(2);
        expect([...a].every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('pathAhead coloca puntos del camino por delante del jugador', () => {
    const path = Array.from({ length: 12 }, (_, i) => ({ x: 5 + i, y: 3 }));
    const pts = pathAhead(path, { x: 5, y: 3 }, 3, 4);
    expect(pts.length).toBe(4);
    expect(pts[0]!.x).toBeGreaterThan(5.5);
    expect(pts[3]!.x).toBeGreaterThan(pts[0]!.x);
    expect(pathAhead([], { x: 0, y: 0 }, 3, 4)).toEqual([]);
  });

  it('el cristal flota y gira de forma acotada', () => {
    for (let t = 0; t < 10; t += 0.37) {
      const m = crystalMotion(t, 1);
      expect(Math.abs(m.y)).toBeLessThanOrEqual(0.0601);
      expect(m.glow).toBeGreaterThan(0.49);
    }
  });
});

describe('partículas 3D de batalla', () => {
  it('las partículas nacen, se mueven y mueren; el tope se respeta', () => {
    const fx = new Fx3D(1);
    explosion(fx, 'fuego', 0, 1, 0, 1, () => 0.5);
    const n = fx.items.length;
    expect(n).toBeGreaterThan(5);
    fx.update(0.1);
    expect(fx.items.length).toBe(n);
    fx.update(2);
    expect(fx.items.length).toBe(0);
    for (let i = 0; i < 50; i++) explosion(fx, 'rayo', 0, 1, 0, 1);
    expect(fx.items.length).toBeLessThanOrEqual(FX3D_CAP);
  });

  it('cada elemento tiene su carácter y la densidad 0 no emite chispas', () => {
    for (const el of ['fuego', 'frio', 'rayo', 'veneno', 'sagrado', 'necrotico', 'arcano', 'fisico'] as const) {
      const fx = new Fx3D(1);
      impact(fx, el, 0, 1, 0, 0.8, 1, () => 0.4);
      expect(fx.items.length, el).toBeGreaterThan(3);
    }
    const none = new Fx3D(0);
    expect(count(10, 0)).toBe(0);
    healBurst(none, 0, 1, 0);
    buffBurst(none, 0, 1, 0, '#fff');
    expect(none.items.length).toBe(0);
  });

  it('write entrega tamaño y opacidad acotados y la gravedad hace caer', () => {
    const fx = new Fx3D(1);
    critBurst(fx, 0, 1, 0);
    shockRing(fx, 0, 0, 1, '#fff');
    fx.spawn({ x: 0, y: 2, z: 0, life: 1, gy: 9.8 });
    fx.update(0.5);
    fx.write((x, y, z, size, a) => {
      expect([x, y, z, size, a].every(Number.isFinite)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    });
    expect(fx.items[fx.items.length - 1]!.y).toBeLessThan(2);
  });

  it('las motas de ambiente se quedan dentro del escenario', () => {
    for (const kind of ['leaves', 'snow', 'embers', 'spores', 'fog', 'bubbles', 'dust', 'motes'] as const) {
      for (let i = 0; i < 20; i++) {
        const p = ambientMote(i, 3.7 + i, kind);
        expect(p.x).toBeGreaterThanOrEqual(8);
        expect(p.x).toBeLessThanOrEqual(28);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(3.5);
      }
    }
  });
});

describe('cámara de batalla', () => {
  it('el héroe mide más en pantallas grandes (con tope) y la cámara se aleja si hay más píxeles', () => {
    expect(heroPixels(360, 500)).toBeLessThanOrEqual(heroPixels(700, 900));
    expect(heroPixels(2000, 2000)).toBeLessThanOrEqual(140);
    expect(heroPixels(100, 100)).toBeGreaterThanOrEqual(70);
    expect(cameraDistance(800, 90)).toBeGreaterThan(cameraDistance(400, 90));
  });
});
