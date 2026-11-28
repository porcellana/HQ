/** v0.10: geometría 3D, chunks, instancias, cámara y calidad (todo puro, sin WebGL). */
import { describe, expect, it } from 'vitest';
import { Geo, buildChunk, chunksInRadius, CHUNK, WATER_Y, type Grid3D } from '@/gfx/world3d/terrain';
import { MeshBuilder, STRIDE } from '@/gfx/world3d/mesh';
import { STATIC_MODELS, staticModel, beastRig, humanoidRig } from '@/gfx/world3d/models';
import { ident, invert, lookAt, mul, perspective, project, unprojectRay } from '@/gfx/world3d/mat';
import { FpsGuard, QUALITY, camDistance, lowerQuality, remapDir } from '@/gfx/world3d/quality';
import { envFor, zoneStyle } from '@/gfx/world3d/style';
import { BATTLE_H, BATTLE_W, battleGrid } from '@/gfx/world3d/battle3d';
import { TILES } from '@/data/registry';
import { Game } from '@/game/game';
import { testState } from './helpers';
import { generateCell } from '@/game/world/procgen/generate';

const grid = (rows: string[], kind = 'wild'): Grid3D => {
  const map: Record<string, string> = { ',': 'grass', '~': 'water', '#': 'stoneWall', M: 'roof', W: 'woodWall', T: 'tree', '^': 'crag', b: 'bridge', '.': 'stoneFloor' };
  return { width: rows[0]!.length, height: rows.length, kind, seed: 3, sprite: (x, y) => map[rows[y]?.[x] ?? ','] ?? 'grass' };
};

describe('terreno 3D', () => {
  it('toda casilla del juego tiene un sprite conocido o cae en el respaldo sin romper', () => {
    for (const t of TILES.values()) {
      const g = grid(['.'.repeat(3)]);
      const geo = new Geo({ ...g, sprite: () => t.sprite });
      expect(Number.isFinite(geo.heightAt(1, 0.5)), t.id).toBe(true);
    }
  });
  it('las alturas son finitas y el agua queda por debajo del nivel del agua', () => {
    const geo = new Geo(grid([',,,,,,', ',~~~~,', ',~~~~,', ',~~~~,', ',,,,,,']));
    for (const v of geo.vh) expect(Number.isFinite(v)).toBe(true);
    expect(geo.heightAt(3, 2.5)).toBeLessThan(WATER_Y);
    expect(geo.heightAt(0.5, 0.5)).toBeGreaterThan(WATER_Y);
  });
  it('las montañas suben hacia el centro del macizo', () => {
    const geo = new Geo(grid(['^^^^^^^', '^^^^^^^', '^^^^^^^', '^^^^^^^', '^^^^^^^', '^^^^^^^', '^^^^^^^']));
    expect(geo.heightAt(3.5, 3.5)).toBeGreaterThan(geo.heightAt(0.2, 0.2));
  });
  it('los tejados forman una cumbrera: el centro es más alto que el alero', () => {
    const geo = new Geo(grid([',,,,', ',MM,', ',MM,', ',WW,', ',,,,'], 'town'));
    const a = geo.cornerTops(1, 1), b = geo.cornerTops(1, 2);
    expect(a[2]).toBeGreaterThan(a[0]);
    expect(b[0]).toBeGreaterThan(b[2]);
  });
  it('un chunk genera triángulos completos, agua, instancias y luces', () => {
    const g = grid(['TT,,,,,,', ',~~~,,,,', ',~~~,W,,', ',,,,,#,,', ',,,,,,,,'], 'town');
    const geo = new Geo(g);
    const c = buildChunk(geo, 0, 0, { density: 1 });
    expect(c.terrain.length % (STRIDE * 3)).toBe(0);
    expect(c.terrain.length).toBeGreaterThan(0);
    expect(c.water.length % (STRIDE * 3)).toBe(0);
    expect(c.water.length).toBeGreaterThan(0);
    const trees = [...c.inst.entries()].filter(([k]) => k.startsWith('tree')).reduce((s, [, a]) => s + a.length / 8, 0);
    expect(trees).toBe(2);
    for (const a of c.terrain) expect(Number.isFinite(a)).toBe(true);
    for (const a of c.inst.values()) expect(a.length % 8).toBe(0);
  });
  it('la densidad baja reduce el decorado menor', () => {
    const g = grid(Array.from({ length: 16 }, () => ','.repeat(16)));
    const geo = new Geo(g);
    const n = (d: number) => [...buildChunk(geo, 0, 0, { density: d }).inst.get('tuft') ?? []].length;
    expect(n(0.3)).toBeLessThan(n(1));
  });
  it('la roca maciza lejos del suelo no se dibuja en mazmorras', () => {
    const rows = ['#######', '#######', '#######', '#######', '#######', '#######', '#######'];
    const geo = new Geo(grid(rows, 'dungeon'));
    expect(buildChunk(geo, 0, 0).terrain.length).toBe(0);
    const open = new Geo(grid(['#######', '#######', '###.###', '#######', '#######', '#######', '#######'], 'dungeon'));
    expect(buildChunk(open, 0, 0).terrain.length).toBeGreaterThan(0);
  });
  it('chunksInRadius devuelve sólo chunks cercanos y todos si el radio es enorme', () => {
    expect(chunksInRadius(64, 64, 8, 8, 4)).toEqual([[0, 0]]);
    expect(chunksInRadius(64, 64, 8, 8, 500).length).toBe((64 / CHUNK) ** 2);
    expect(chunksInRadius(64, 64, 8, 8, 12).length).toBeLessThan(16);
  });
});

describe('modelos y mallas', () => {
  it('cada modelo estático es una malla válida (múltiplo de triángulos, sin NaN)', () => {
    for (const id of STATIC_MODELS) {
      const m = staticModel(id)!;
      expect(m.length % (STRIDE * 3), id).toBe(0);
      expect(m.length, id).toBeGreaterThan(0);
      expect(m.every(Number.isFinite), id).toBe(true);
    }
  });
  it('los rigs de humanoides y criaturas tienen partes y alturas', () => {
    const look = { main: '#808080', dark: '#202020', accent: '#c04040' };
    for (const shape of ['humanoide', 'goblin', 'esqueleto', 'lobo', 'rata', 'zorro', 'arana', 'serpiente', 'pajaro', 'murcielago', 'hada', 'medusa', 'escarabajo', 'brote', 'armadillo', 'nutria', 'lagarto', 'desconocida']) {
      const r = beastRig(shape, look, 'guerrero');
      expect(r.parts.length, shape).toBeGreaterThan(1);
      expect(r.height, shape).toBeGreaterThan(0);
      for (const p of r.parts) expect(p.mesh.every(Number.isFinite), shape).toBe(true);
    }
    for (const ov of ['guerrero', 'mago', 'picaro', 'clerigo', 'barbaro', 'explorador', 'druida', 'bardo']) {
      expect(humanoidRig({ skin: '#d9a67a', hair: '#333', cloth: '#a00', clothDark: '#500', pants: '#222', overlay: ov }).parts.length).toBe(6);
    }
  });
  it('MeshBuilder.append transforma y conserva el número de vértices', () => {
    const a = new MeshBuilder().box(0, 0, 0, 1, 1, 1, [1, 0, 0]);
    const b = new MeshBuilder().append(a, 5, 0, 0, Math.PI / 2, 2);
    expect(b.count).toBe(a.count);
    expect(Math.max(...b.v.filter((_, i) => i % STRIDE === 0))).toBeGreaterThan(5);
  });
});

describe('cámara, picking y calidad', () => {
  it('proyectar y des-proyectar un punto del suelo devuelve el mismo punto', () => {
    const vp = mul(perspective(0.78, 0.5, 0.4, 120), lookAt([5, 12, 15], [5, 0, 5]));
    const p = project(vp, 6, 0, 4);
    const inv = invert(vp)!;
    const r = unprojectRay(inv, p.x, p.y);
    const t = -r.o[1] / r.d[1];
    expect(r.o[0] + r.d[0] * t).toBeCloseTo(6, 3);
    expect(r.o[2] + r.d[2] * t).toBeCloseTo(4, 3);
  });
  it('la identidad es neutra al multiplicar', () => {
    const m = lookAt([1, 2, 3], [0, 0, 0]);
    expect([...mul(ident(), m)]).toEqual([...m]);
  });
  it('remapDir: sin giro no cambia y a 90° gira la dirección', () => {
    expect(remapDir({ dx: 0, dy: -1 }, 0)).toEqual({ dx: 0, dy: -1 });
    expect(remapDir({ dx: 1, dy: 0 }, 0)).toEqual({ dx: 1, dy: 0 });
    const r = remapDir({ dx: 0, dy: -1 }, Math.PI / 2);
    expect(Math.abs(r.dx) + Math.abs(r.dy)).toBe(1);
    expect(r.dx).toBe(-1); // con la cámara girada 90° «arriba» es el oeste
    expect(remapDir({ dx: 1, dy: -1 }, 0)).toEqual({ dx: 1, dy: -1 });
  });
  it('el zoom acerca y aleja la cámara', () => {
    expect(camDistance(1)).toBeLessThan(camDistance(0));
    expect(camDistance(-1)).toBeGreaterThan(camDistance(0));
    expect(camDistance(99)).toBe(camDistance(2));
  });
  it('la calidad media es la de por defecto y baja en cascada', () => {
    expect(QUALITY.baja.radius).toBeLessThan(QUALITY.media.radius);
    expect(QUALITY.media.radius).toBeLessThan(QUALITY.alta.radius);
    expect(lowerQuality('alta')).toBe('media');
    expect(lowerQuality('media')).toBe('baja');
    expect(lowerQuality('baja')).toBe('baja');
  });
  it('FpsGuard avisa sólo si los fps se mantienen bajos', () => {
    const slow = new FpsGuard(34, 20, 5);
    let hit = false;
    for (let i = 0; i < 40; i++) hit = slow.push(1 / 15) || hit;
    expect(hit).toBe(true);
    const fast = new FpsGuard(34, 20, 5);
    hit = false;
    for (let i = 0; i < 100; i++) hit = fast.push(1 / 60) || hit;
    expect(hit).toBe(false);
    const spike = new FpsGuard(34, 20, 5);
    hit = false;
    for (let i = 0; i < 100; i++) hit = spike.push(i % 10 === 0 ? 0.6 : 1 / 60) || hit; // pausas no cuentan
    expect(hit).toBe(false);
  });
});

describe('entorno y fondos de batalla', () => {
  it('la noche oscurece la luz y la niebla; los recintos cerrados no tienen sol', () => {
    const st = zoneStyle(grid([',,,,', ',,,,']));
    const day = envFor(st, 0, 0, 0.3), night = envFor(st, 1, 0, 0.3);
    expect(night.ambTop[0]).toBeLessThan(day.ambTop[0]);
    expect(night.sunCol[0]).toBeLessThan(day.sunCol[0]);
    const cave = zoneStyle(grid(['....', '....'], 'dungeon'));
    expect(cave.enclosed).toBe(true);
    expect(envFor(cave, 0, 0, 0.3).fogDensity).toBeGreaterThan(day.fogDensity);
  });
  it('cada bioma de batalla tiene escenario con tamaño fijo y suelo despejado al frente', () => {
    for (const b of ['pradera', 'bosque', 'montana', 'cueva', 'cripta', 'galerias', 'puerto', 'aldea', 'interior'] as const) {
      const g = battleGrid(b, 5);
      expect(g.width).toBe(BATTLE_W);
      expect(g.height).toBe(BATTLE_H);
      const geo = new Geo(g);
      let blocked = 0;
      for (let y = 14; y < BATTLE_H; y++) for (let x = 8; x < BATTLE_W - 8; x++) if (['tree', 'pine', 'crag', 'caveWall', 'stoneWall', 'cryptWall', 'woodWall', 'water'].includes(geo.spriteAt(x, y))) blocked++;
      expect(blocked, b).toBe(0);
      expect(buildChunk(geo, 0, 0).terrain.length, b).toBeGreaterThan(0);
    }
  });
});

describe('mundo: ríos, costas y eventos al viajar', () => {
  it('hay zonas con río o costa y sus caminos cruzan por puentes o muelles', () => {
    let withWater = 0, withBridge = 0, total = 0;
    for (const seed of [1, 7, 42, 1234, 99999]) {
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
        if (!x && !y) continue;
        const z = generateCell(seed, x, y, 3).zones[0]!;
        if (z.kind !== 'wild') continue;
        total++;
        const m = z.map.join('');
        if ((m.match(/[~x]/g) ?? []).length > 40) withWater++;
        if (/[bD]/.test(m)) withBridge++;
      }
    }
    expect(total).toBeGreaterThan(40);
    expect(withWater).toBeGreaterThan(5);
    expect(withBridge).toBeGreaterThan(0);
  });
  it('los eventos al viajar dan bolsa, frasco, curación o emboscada', () => {
    const g = new Game(testState());
    const p = g.state.player;
    p.hp = 1;
    expect(g.travelEvent('manantial')).toBe('manantial');
    expect(p.hp).toBeGreaterThan(1);
    expect(g.travelEvent('bolsa')).toBe('bolsa');
    expect(g.ground.some((l) => l.gold > 0)).toBe(true);
    expect(g.travelEvent('hierbas')).toBe('hierbas');
    expect(g.ground.some((l) => l.items.length > 0)).toBe(true);
  });
  it('la acción contextual detecta PNJ, cofres y botín cercanos', () => {
    const g = new Game(testState());
    expect(g.contextAction()).toBeNull();
    const p = g.playerPos;
    g.dropLoot(p.x + 1, p.y, [], 5);
    const a = g.contextAction();
    expect(a?.kind).toBe('recoger');
  });
});
