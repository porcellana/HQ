/** La trama principal completa, de la primera misión a la pantalla final. */
import { describe, expect, it } from 'vitest';
import { ITEMS, QUESTS, getEnemy } from '@/data/registry';
import { Rng } from '@/engine/rng';
import { Game } from '@/game/game';
import { addItem } from '@/game/items/inventory';
import { createItem } from '@/game/items/items';
import * as Quests from '@/game/quests/quests';
import { CURRENT_SAVE_VERSION, migrate } from '@/game/save/migrations';
import type { GameState } from '@/game/state';
import { defeat, testState } from './helpers';

const MAIN = ['mq1_sombras', 'mq2_rastro', 'mq3_colmillos', 'mq4_seda', 'mq5_runas', 'mq6_velkar', 'mq7_amanecer'];

/** Entra en la guarida de una mazmorra y derrota a su jefe. */
function killBoss(g: Game, dungeon: string): void {
  g.enterZone(dungeon, '1');
  g.enterZone(`${dungeon}__jefe`, '1');
  const boss = g.enemies.find((e) => e.def.boss);
  expect(boss, `jefe en ${dungeon}`).toBeDefined();
  defeat(g, boss!);
}

describe('trama principal', () => {
  it('7 capítulos encadenados y válidos', () => {
    const main = [...QUESTS.values()].filter((q) => q.kind === 'principal').map((q) => q.id);
    expect(main).toEqual(MAIN);
    for (let i = 1; i < MAIN.length; i++) expect(QUESTS.get(MAIN[i]!)!.requires).toContain(MAIN[i - 1]);
    for (const id of MAIN) expect(Quests.validateQuest(QUESTS.get(id)!, (x) => ITEMS.has(x))).toEqual([]);
    expect(QUESTS.get('mq5_runas')!.rewards.flag).toBe('cripta_abierta');
    expect(QUESTS.get('mq7_amanecer')!.rewards.flag).toBe('victoria');
  });

  it('se puede jugar de principio a fin y dispara la pantalla final', () => {
    const g = new Game(testState('guerrero'));
    const s = g.state;
    let victory = 0;
    g.events.on('victory', () => victory++);
    const rng = new Rng(3);

    // 1. Goblins del bosque
    expect(g.acceptQuest('mq1_sombras')).toBeNull();
    for (let i = 0; i < 5; i++) Quests.onKill(s, getEnemy('goblin')!);
    expect(g.turnInQuest('mq1_sombras', 'alcalde_ortun')).toBeNull();
    // 2. Puerto Ceniza y Lysa
    expect(g.acceptQuest('mq2_rastro')).toBeNull();
    g.enterZone('puerto_ceniza', '1');
    Quests.onTalk(s, 'hermana_lysa');
    expect(g.turnInQuest('mq2_rastro', 'hermana_lysa')).toBeNull();
    // 3. Gruñaz
    expect(g.acceptQuest('mq3_colmillos')).toBeNull();
    killBoss(g, 'cueva_goblin');
    expect(Quests.questStatus(s, 'mq3_colmillos')).toBe('lista');
    expect(g.turnInQuest('mq3_colmillos', 'alcalde_ortun')).toBeNull();
    // 4. Mórgala
    expect(g.acceptQuest('mq4_seda')).toBeNull();
    killBoss(g, 'galerias_seda');
    expect(g.turnInQuest('mq4_seda', 'hermana_lysa')).toBeNull();
    // 5. Runas: la cripta sigue cerrada hasta entregarla
    g.enterZone('puerto_ceniza', '1');
    const cryptExit = g.zone.exits.find((e) => e.to === 'cripta_velkar')!;
    expect(cryptExit).toBeDefined();
    g.useExit(cryptExit);
    expect(g.zone.id).toBe('puerto_ceniza');
    expect(g.acceptQuest('mq5_runas')).toBeNull();
    addItem(s.player, createItem('polvo_hueso', 'comun', rng, { qty: 3 }));
    addItem(s.player, createItem('seda_arana', 'comun', rng, { qty: 3 }));
    expect(Quests.questStatus(s, 'mq5_runas')).toBe('activa');
    Quests.onTalk(s, 'maestre_doran');
    expect(g.turnInQuest('mq5_runas', 'hermana_lysa')).toBeNull();
    expect(s.flags['cripta_abierta']).toBe(true);
    g.useExit(cryptExit);
    expect(g.zone.id).toBe('cripta_velkar');
    // 6. Velkar
    expect(g.acceptQuest('mq6_velkar')).toBeNull();
    killBoss(g, 'cripta_velkar');
    expect(g.turnInQuest('mq6_velkar', 'hermana_lysa')).toBeNull();
    // 7. Epílogo
    expect(g.acceptQuest('mq7_amanecer')).toBeNull();
    Quests.onTalk(s, 'alcalde_ortun');
    expect(victory).toBe(0);
    expect(g.turnInQuest('mq7_amanecer', 'alcalde_ortun')).toBeNull();
    expect(victory).toBe(1);
    expect(s.flags['victoria']).toBe(true);
    expect(s.record.bosses).toBe(3);
    expect(s.record.victoryTurn).toBeGreaterThanOrEqual(0);
    for (const id of MAIN) expect(Quests.questStatus(s, id)).toBe('completada');
  });

  it('el objetivo guía hacia la zona correcta', () => {
    const g = new Game(testState('mago'));
    g.acceptQuest('mq1_sombras');
    expect(g.questGoal?.zone).toBe('bosque_sombrio');
    expect(g.questGoal?.exitTo).toBe('bosque_sombrio');
    // Con la cripta como objetivo, desde la aldea hay que ir por el Paso Gris.
    const s = g.state;
    for (const id of MAIN.slice(0, 5)) s.quests[id] = { status: 'completada', progress: [], completions: 1 };
    s.quests['mq1_sombras'] = { status: 'completada', progress: [5], completions: 1 };
    g.acceptQuest('mq6_velkar');
    expect(g.questGoal?.exitTo).toBe('paso_gris');
    g.enterZone('puerto_ceniza', '1');
    expect(g.questGoal?.exitTo).toBe('cripta_velkar');
  });

  it('migración v5 → v6 añade las estadísticas', () => {
    const s = testState('picaro') as unknown as Record<string, unknown>;
    delete s['record'];
    const out = migrate(s, 5, CURRENT_SAVE_VERSION) as unknown as GameState;
    expect(out.record).toEqual({ kills: 0, bosses: 0, deaths: 0, victoryTurn: 0, victoryTime: 0 });
  });
});
