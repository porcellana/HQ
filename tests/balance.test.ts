/**
 * Equilibrio de la progresión: simula la trama completa matando lo que aparece
 * en cada zona y piso (sin repeticiones extra) y comprueba los niveles orientativos.
 * Si cambias XP de misiones, enemigos o la curva, este test te avisa.
 */
import { expect, it } from 'vitest';
import { DUNGEONS, QUESTS, ZONES } from '@/data/registry';
import { Game } from '@/game/game';
import { xpForKill } from '@/game/combat/rules';
import { levelForXp } from '@/game/rules/progression';
import { testState } from './helpers';
import { floorZoneId } from '@/game/world/dungeons';

it('la trama completa sube niveles al ritmo previsto', () => {
  const g = new Game(testState('guerrero'));
  const p = g.state.player;
  const out: string[] = [];
  const killAll = (zone: string, times = 1) => {
    for (let t = 0; t < times; t++) {
      g.enterZone(zone, '1');
      for (const e of [...g.enemies]) p.xp += xpForKill(e.def.xp, e.def.level, levelForXp(p.xp));
      p.level = levelForXp(p.xp);
    }
  };
  const quest = (id: string) => { p.xp += QUESTS.get(id)!.rewards.xp; p.level = levelForXp(p.xp); };
  const disc = (z: string) => { const d = ZONES.get(z) ?? null; p.xp += d?.discoverXp ?? 20 * (d?.level ?? 1); p.level = levelForXp(p.xp); };
  const dungeon = (id: string) => {
    const d = DUNGEONS.get(id)!;
    for (let f = 1; f <= d.floors; f++) killAll(floorZoneId(id, f));
    killAll(floorZoneId(id, 'jefe'));
  };
  const lv: Record<string, number> = {};
  const log = (s: string) => {
    lv[s] = levelForXp(p.xp);
    out.push(`${s.padEnd(34)} nivel ${levelForXp(p.xp)}  xp ${p.xp}`);
  };
  disc('bosque_sombrio'); killAll('bosque_sombrio', 3); quest('mq1_sombras'); quest('sq_ratas'); quest('sq_paso'); log('Bosque (3 pasadas) + mq1');
  disc('paso_gris'); killAll('paso_gris', 1); quest('mq2_rastro'); quest('sq_carta'); log('Paso Gris + mq2');
  dungeon('cueva_goblin'); quest('mq3_colmillos'); log('Cueva + Gruñaz + mq3');
  killAll('paso_gris', 3); quest('rq_lobos'); quest('sq_mineral'); quest('sq_colmillos'); quest('sq_pieles'); log('Paso Gris x3 + secundarias');
  dungeon('galerias_seda'); quest('mq4_seda'); log('Galerías + Mórgala + mq4');
  killAll('paso_gris', 3); for (const r of ['rq_lobos','rq_goblins','rq_seda','rq_huesos']) if (QUESTS.has(r)) quest(r); quest('mq5_runas'); log('Paso x3 + gremio + mq5');
  const d = DUNGEONS.get('cripta_velkar')!;
  for (let f = 1; f <= d.floors; f++) killAll(floorZoneId('cripta_velkar', f));
  log('Cripta pisos (antes de Velkar)');
  killAll(floorZoneId('cripta_velkar', 'jefe')); quest('mq6_velkar'); quest('mq7_amanecer'); log('Velkar + final');
  const msg = out.join('\n');
  expect(lv['Bosque (3 pasadas) + mq1'], msg).toBeLessThanOrEqual(3);
  expect(lv['Cueva + Gruñaz + mq3'], msg).toBeGreaterThanOrEqual(3);
  expect(lv['Cueva + Gruñaz + mq3'], msg).toBeLessThanOrEqual(5);
  expect(lv['Galerías + Mórgala + mq4'], msg).toBeGreaterThanOrEqual(5);
  expect(lv['Galerías + Mórgala + mq4'], msg).toBeLessThanOrEqual(7);
  expect(lv['Cripta pisos (antes de Velkar)'], msg).toBeGreaterThanOrEqual(7);
  expect(lv['Velkar + final'], msg).toBeGreaterThanOrEqual(8);
  expect(lv['Velkar + final'], msg).toBeLessThanOrEqual(11);
});
