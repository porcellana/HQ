/** v0.13: culling, LOD, calidad adaptativa, ciclo de día y noche, sombras y roca orgánica (todo puro). */
import { describe, expect, it } from 'vitest';
import { boxVisible, chunkLod, frustumPlanes, instVisible, lodModelId } from '@/gfx/world3d/cull';
import { AdaptiveQuality, QUALITY } from '@/gfx/world3d/quality';
import { clockAt, dayClock, flicker, lightDirection } from '@/gfx/world3d/daycycle';
import { envFor, zoneStyle } from '@/gfx/world3d/style';
import { blobMatrix, lightMatrix } from '@/gfx/world3d/shadow';
import { lookAt, mul, perspective } from '@/gfx/world3d/mat';
import { Geo, buildChunk, type Grid3D } from '@/gfx/world3d/terrain';
import { staticModel } from '@/gfx/world3d/models';
import { DAY_LENGTH_TURNS } from '@/gfx/viewconst';

describe('recorte por frustum', () => {
  const vp = mul(perspective(0.78, 0.5, 0.4, 120), lookAt([0, 6, 10], [0, 0, 0]));
  const planes = frustumPlanes(vp);
  it('ve lo que tiene delante y descarta lo de detrás o muy lejos', () => {
    expect(boxVisible(planes, -1, 0, -1, 1, 1, 1)).toBe(true);
    expect(boxVisible(planes, -1, 0, 30, 1, 1, 32)).toBe(false);
    expect(boxVisible(planes, 90, 0, -2, 94, 2, 2)).toBe(false);
    expect(boxVisible(planes, -1, 0, -200, 1, 1, -190)).toBe(false);
  });
  it('los planos están normalizados', () => {
    for (let i = 0; i < 6; i++) expect(Math.hypot(planes[i * 4]!, planes[i * 4 + 1]!, planes[i * 4 + 2]!)).toBeCloseTo(1, 4);
  });
});

describe('detalle por distancia', () => {
  const cfg = { decorDist: 8, instDist: 14 };
  it('el decorado diminuto sólo se ve cerca y los árboles siempre', () => {
    expect(instVisible('tuft', 5, cfg)).toBe(true);
    expect(instVisible('tuft', 12, cfg)).toBe(false);
    expect(instVisible('tree0', 40, cfg)).toBe(true);
    expect(instVisible('barrel', 20, cfg)).toBe(false);
    expect(instVisible('barrel', 10, cfg)).toBe(true);
  });
  it('niveles de chunk por distancia relativa', () => {
    expect(chunkLod(2, 30)).toBe(0);
    expect(chunkLod(15, 30)).toBe(1);
    expect(chunkLod(28, 30)).toBe(2);
  });
  it('los árboles lejanos usan la variante con menos polígonos', () => {
    expect(lodModelId('tree1', 5, 10)).toBe('tree1');
    expect(lodModelId('tree1', 20, 10)).toBe('tree1@lo');
    expect(lodModelId('barrel', 20, 10)).toBe('barrel');
    for (const id of ['tree0', 'pine0', 'snowpine']) expect(staticModel(`${id}@lo`)!.length).toBeLessThan(staticModel(id)!.length);
  });
  it('sólo la calidad alta usa sombras y bloom', () => {
    expect(QUALITY.alta.shadows && QUALITY.alta.bloom).toBe(true);
    expect(QUALITY.media.shadows || QUALITY.media.bloom || QUALITY.baja.shadows).toBe(false);
  });
});

describe('calidad adaptativa con histéresis', () => {
  const run = (a: AdaptiveQuality, fps: number, frames: number): Array<ReturnType<AdaptiveQuality['push']>> => {
    const out = [];
    for (let i = 0; i < frames; i++) out.push(a.push(1 / fps));
    return out.filter((x) => x);
  };
  const quick = { window: 10, warmup: 5, lowFps: 44, highFps: 57, minScale: 0.75, step: 0.125, raiseWindows: 2 };
  it('baja primero la resolución y luego el nivel', () => {
    const a = new AdaptiveQuality('alta', quick);
    const ev = run(a, 25, 200);
    expect(ev[0]!.scaleMul).toBeCloseTo(0.875);
    expect(a.scaleMul).toBeLessThan(1);
    expect(ev.some((e) => e!.level === 'media')).toBe(true);
    expect(a.level).toBe('baja');
  });
  it('vuelve a subir con fps altos sostenidos, sin pasar del nivel elegido', () => {
    const a = new AdaptiveQuality('alta', quick);
    run(a, 25, 120);
    expect(a.level).not.toBe('alta');
    run(a, 60, 3000);
    expect(a.level).toBe('alta');
    expect(a.scaleMul).toBe(1);
    const b = new AdaptiveQuality('media', quick);
    run(b, 60, 3000);
    expect(b.level).toBe('media');
  });
  it('tras una subida fallida espera más antes de intentarlo otra vez', () => {
    const a = new AdaptiveQuality('alta', quick);
    run(a, 25, 120);
    // sube...
    let raises = 0;
    for (let i = 0; i < 60; i++) {
      const e = run(a, 60, 40);
      if (e.some((x) => x!.level)) raises++;
      run(a, 25, 60); // ...y vuelve a caer enseguida
    }
    expect(raises).toBeLessThan(60);
  });
  it('ignora pausas y saltos', () => {
    const a = new AdaptiveQuality('alta', quick);
    for (let i = 0; i < 100; i++) expect(a.push(2)).toBeNull();
    expect(a.level).toBe('alta');
  });
  it('setUser fija el nuevo tope', () => {
    const a = new AdaptiveQuality('alta', quick);
    a.setUser('baja');
    run(a, 60, 3000);
    expect(a.level).toBe('baja');
  });
});

describe('ciclo de día y noche', () => {
  const at = (f: number) => dayClock(Math.round(f * DAY_LENGTH_TURNS));
  it('mediodía alto y medianoche bajo el horizonte', () => {
    expect(at(0.3).elev).toBeGreaterThan(0.9);
    expect(at(0.8).elev).toBeLessThan(0);
    expect(at(0.3).night).toBe(0);
    expect(at(0.8).night).toBeGreaterThan(0.9);
  });
  it('amanecer y atardecer son cálidos; mediodía y medianoche no', () => {
    expect(at(0.58).warm).toBeGreaterThan(0.6);
    expect(at(0.02).warm).toBeGreaterThan(0.6);
    expect(at(0.3).warm).toBeLessThan(0.2);
    expect(at(0.8).warm).toBeLessThan(0.2);
  });
  it('ventanas, luna y luciérnagas sólo de noche', () => {
    expect(at(0.3).windows).toBe(0);
    expect(at(0.8).windows).toBeGreaterThan(0.9);
    expect(at(0.3).moonAmt).toBe(0);
    expect(at(0.8).moonAmt).toBeGreaterThan(0.9);
    expect(at(0.3).fireflies).toBe(0);
    expect(at(0.8).fireflies).toBeGreaterThan(0.8);
  });
  it('el sol recorre el cielo de este a oeste y es continuo', () => {
    expect(at(0.05).sunDir[0]).toBeLessThan(0);
    expect(at(0.55).sunDir[0]).toBeGreaterThan(0);
    let prev = dayClock(0);
    for (let t = 1; t < DAY_LENGTH_TURNS; t += 5) {
      const c = dayClock(t);
      expect(Math.abs(c.elev - prev.elev)).toBeLessThan(0.12);
      expect(Math.abs(c.night - prev.night)).toBeLessThan(0.12);
      prev = c;
    }
  });
  it('la luz principal es el sol de día y la luna de noche', () => {
    const d = lightDirection(at(0.3));
    expect(d.moon).toBe(0);
    const n = lightDirection(at(0.8));
    expect(n.moon).toBe(1);
    expect(n.dir[1]).toBeGreaterThan(0.2);
  });
  it('el entorno cambia con la hora: cielo, niebla, ventanas y sombras', () => {
    const grass: Grid3D = { width: 6, height: 6, kind: 'wild', seed: 2, sprite: () => 'grass' };
    const st = zoneStyle(grass);
    const noon = envFor(st, 0, 0, 0, at(0.3)), dusk = envFor(st, 0.2, 0, 0, at(0.58)), night = envFor(st, 1, 0, 0, at(0.8));
    expect(dusk.skyHorizon[0] / dusk.skyHorizon[2]).toBeGreaterThan(noon.skyHorizon[0] / noon.skyHorizon[2]);
    expect(dusk.warm).toBeGreaterThan(0.4);
    expect(night.skyTop[2]).toBeLessThan(noon.skyTop[2]);
    expect(night.windows).toBeGreaterThan(noon.windows);
    expect(night.shadowStrength).toBeLessThan(noon.shadowStrength);
    expect(night.stars).toBeGreaterThan(0);
    expect(noon.stars).toBe(0);
    const cave = envFor(zoneStyle({ ...grass, kind: 'dungeon' }), 1, 0, 0, at(0.8));
    expect(cave.windows).toBe(0);
    expect(cave.moonAmt).toBe(0);
    expect(cave.shadowStrength).toBe(0);
  });
  it('clockAt y la llamada antigua de envFor siguen funcionando', () => {
    const st = zoneStyle({ width: 4, height: 4, kind: 'wild', seed: 1, sprite: () => 'grass' });
    expect(envFor(st, 0, 0, 0.3).night).toBe(0);
    expect(clockAt(0.3, 0).elev).toBeGreaterThan(0.9);
  });
  it('la llama parpadea dentro de un rango y sin repetirse entre antorchas', () => {
    let lo = 9, hi = 0;
    for (let t = 0; t < 20; t += 0.05) { const f = flicker(t, 3.3); lo = Math.min(lo, f); hi = Math.max(hi, f); }
    expect(lo).toBeGreaterThan(0.7);
    expect(hi).toBeLessThan(1.3);
    expect(hi - lo).toBeGreaterThan(0.1);
    expect(flicker(1, 1)).not.toBe(flicker(1, 2));
  });
});

describe('sombras', () => {
  it('el mapa de sombras se ajusta a la rejilla de texeles (no «nada»)', () => {
    const dir: [number, number, number] = [-0.4, 0.7, -0.3];
    const res = 1024, half = 16, texel = (2 * half) / res;
    const a = lightMatrix([10, 0, 10], dir, half, res);
    const b = lightMatrix([10 + texel * 0.2, 0, 10], dir, half, res);
    let same = 0;
    for (let i = 0; i < 16; i++) if (Math.abs(a.vp[i]! - b.vp[i]!) < 1e-4) same++;
    expect(same).toBe(16);
    const c = lightMatrix([10 + texel * 3, 0, 10], dir, half, res);
    expect(Array.from(a.vp).some((v, i) => Math.abs(v - c.vp[i]!) > 1e-4)).toBe(true);
  });
  it('la sombra blanda se alarga y se aleja de la luz cuanto más baja está', () => {
    const hi = blobMatrix(0, 0, 0, 1, 1.5, [0, 1, 0.01]);
    const low = blobMatrix(0, 0, 0, 1, 1.5, [-0.8, 0.3, 0]);
    expect(Math.hypot(low[8]!, low[10]!)).toBeGreaterThan(Math.hypot(hi[8]!, hi[10]!));
    expect(low[12]).toBeGreaterThan(0.1); // la luz viene del oeste (−x): la sombra cae al este
    expect(Math.abs(hi[12]!)).toBeLessThan(0.05);
  });
});

describe('cuevas y mazmorras orgánicas', () => {
  const rows = ['##########', '#........#', '#........#', '#...##...#', '#........#', '##########'];
  const cave: Grid3D = { width: 10, height: 6, kind: 'dungeon', seed: 11, sprite: (x, y) => (rows[y]![x] === '#' ? 'caveWall' : 'caveFloor') };
  it('la roca crece dentro del muro y desaparece en el suelo libre', () => {
    const geo = new Geo(cave);
    expect(geo.rockH(5.5, 1.5)).toBe(0);
    expect(geo.rockH(0.5, 0.5)).toBeGreaterThan(0.8);
    expect(geo.rockH(4.9, 3.5)).toBeGreaterThan(0.2);
    expect(geo.rockH(4.9, 3.5)).toBeLessThan(geo.rockH(4.5, 3.5) + 0.01);
  });
  it('es determinista por semilla y cambia con otra', () => {
    const a = buildChunk(new Geo(cave), 0, 0), b = buildChunk(new Geo(cave), 0, 0), c = buildChunk(new Geo({ ...cave, seed: 99 }), 0, 0);
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
    expect(Array.from(a.terrain)).not.toEqual(Array.from(c.terrain));
    for (const v of a.terrain) expect(Number.isFinite(v)).toBe(true);
  });
  it('el suelo de cueva es irregular y suave', () => {
    const geo = new Geo(cave);
    const hs = [1.5, 2.5, 3.5, 4.5, 5.5, 6.5].map((x) => geo.heightAt(x, 2.5));
    expect(Math.max(...hs) - Math.min(...hs)).toBeGreaterThan(0.01);
    for (let i = 1; i < hs.length; i++) expect(Math.abs(hs[i]! - hs[i - 1]!)).toBeLessThan(0.4);
  });
  it('hay estalactitas, cristales, antorchas o braseros con luces que parpadean o pulsan', () => {
    let kinds = new Set<string>(), ids = new Set<string>();
    for (let s = 1; s < 40; s++) {
      const big: Grid3D = { width: 40, height: 30, kind: 'dungeon', seed: s, sprite: (x, y) => (x === 0 || y === 0 || x === 39 || y === 29 || (x % 7 === 3 && y % 5 === 2) ? 'caveWall' : 'caveFloor') };
      const geo = new Geo(big);
      for (const [cx, cz] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const d = buildChunk(geo, cx, cz);
        for (const l of d.lights) if (l.k) kinds.add(l.k);
        for (const id of d.inst.keys()) ids.add(id);
      }
    }
    expect(kinds.has('fire') && kinds.has('crystal')).toBe(true);
    expect(ids.has('stalag') || ids.has('stalag2')).toBe(true);
    expect(ids.has('brazier')).toBe(true);
    for (const id of ['brazier', 'stalag', 'stalag2', 'stalac']) expect(staticModel(id)!.length).toBeGreaterThan(0);
  });
  it('las ventanas de las casas son luces de ventana (sólo de noche)', () => {
    const town: Grid3D = { width: 12, height: 8, kind: 'town', seed: 5, sprite: (x, y) => (x >= 3 && x <= 8 && y >= 1 && y <= 4 ? (y === 1 ? 'roof' : 'woodWall') : 'grass') };
    const wins = new Set<string | undefined>();
    for (let s = 1; s < 25; s++) for (const l of buildChunk(new Geo({ ...town, seed: s }), 0, 0).lights) wins.add(l.k);
    expect(wins.has('window')).toBe(true);
  });
});
