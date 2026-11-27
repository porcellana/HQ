/** v0.2 Fase A: trasfondos, tiradas en diálogos, talentos y compañeros. */
import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, CLASSES, COMPANIONS, ENEMIES, ITEMS, NPCS, QUESTS, SHOPS, TALENTS } from '@/data/registry';
import type { DialogNode, SkillKey } from '@/data/schema';
import { Rng } from '@/engine/rng';
import { Game } from '@/game/game';
import { buyPrice, getShop } from '@/game/economy/shop';
import { countItem } from '@/game/items/inventory';
import { createItem } from '@/game/items/items';
import { totalXpForLevel } from '@/game/rules/progression';
import { SKILLS, isProficient, skillBonus, successChance } from '@/game/rules/skills';
import { CURRENT_SAVE_VERSION, migrate } from '@/game/save/migrations';
import { createNewGame, recalcPlayer, type GameState } from '@/game/state';
import { chooseTalent, eligibleTalents, talentOffer } from '@/game/talents';
import { defeat, testState } from './helpers';
import { Battle } from '@/game/battle/battle';

/** Rng que siempre saca el mínimo y siempre "acierta" las probabilidades. */
class LowRng extends Rng {
  constructor() {
    super(1);
  }
  override int(min: number): number {
    return min;
  }
  override chance(): boolean {
    return true;
  }
}

/** Batalla contra enemigos recién creados; avanza hasta el turno del jugador. */
function fight(g: Game, ...ids: string[]): Battle {
  const es = ids.map((id, i) => g.spawnEnemy(id, g.playerPos.x + 2 + i, g.playerPos.y + 2)!);
  const b = g.beginBattle(es);
  while (!b.awaiting && !b.ended) b.step();
  return b;
}

class HighRng extends Rng {
  constructor() {
    super(1);
  }
  override int(_min: number, max: number): number {
    return max;
  }
}

function gameWith(classId: string, opts: { level?: number; talents?: string[]; background?: string } = {}): Game {
  const s = createNewGame({ name: 'T', classId, portrait: 0, seed: 7, stats: { ...CLASSES.get(classId)!.baseStats }, ...(opts.background ? { background: opts.background } : {}) });
  if (opts.level && opts.level > 1) {
    s.player.level = opts.level;
    s.player.xp = totalXpForLevel(opts.level);
  }
  s.player.talents = opts.talents ?? [];
  recalcPlayer(s.player);
  s.player.hp = s.player.maxHp;
  s.player.mp = s.player.maxMp;
  const g = new Game(s);
  g.enemies = [];
  return g;
}

describe('habilidades sociales', () => {
  it('bonificador = modificador + competencia de clase o trasfondo', () => {
    const g = testState('guerrero'); // FUE 15 (+2), CAR 11 (+0), competente en intimidación
    expect(isProficient(g.player, 'intimidacion')).toBe(true);
    expect(skillBonus(g.player, 'intimidacion')).toBe(2 + 2);
    expect(skillBonus(g.player, 'persuasion')).toBe(0);
    const noble = createNewGame({ name: 'N', classId: 'guerrero', portrait: 0, seed: 1, stats: { ...CLASSES.get('guerrero')!.baseStats }, background: 'noble' });
    expect(noble.player.stats.CAR).toBe(12); // +1 del trasfondo
    expect(skillBonus(noble.player, 'persuasion')).toBe(1 + 2);
  });

  it('probabilidad de éxito con 20 y 1 naturales', () => {
    expect(successChance(0, 10)).toBeCloseTo(0.55);
    expect(successChance(-10, 30)).toBeCloseTo(0.05);
    expect(successChance(30, 5)).toBeCloseTo(0.95);
  });

  it('la tirada del diálogo usa el bonificador y anima el dado', () => {
    const g = gameWith('guerrero');
    g.rng = new LowRng();
    const dice: number[] = [];
    g.events.on('dice', (d) => dice.push(d.natural));
    const r = g.dialogCheck('intimidacion', 10);
    expect(r.natural).toBe(1);
    expect(r.success).toBe(false); // 1 natural siempre falla
    expect(r.bonus).toBe(4);
    expect(dice).toEqual([1]);
  });
});

describe('datos de identidad', () => {
  it('trasfondos válidos, con objetos que existen', () => {
    expect([...BACKGROUNDS.values()].filter((b) => !b.hidden).length).toBeGreaterThanOrEqual(4);
    for (const b of BACKGROUNDS.values()) {
      for (const i of b.startingItems ?? []) expect(ITEMS.has(i.item), `${b.id}: ${i.item}`).toBe(true);
      for (const k of b.proficiencies) expect(SKILLS[k], `${b.id}: ${k}`).toBeDefined();
    }
  });

  it('cada clase tiene 8+ talentos en 3 ramas y sus referencias existen', () => {
    for (const c of CLASSES.values()) {
      const ts = [...TALENTS.values()].filter((t) => t.classId === c.id);
      expect(ts.length, c.id).toBeGreaterThanOrEqual(8);
      expect(new Set(ts.map((t) => t.branch)).size, c.id).toBe(3);
      for (const t of ts) {
        if (t.requires) expect(TALENTS.has(t.requires), t.id).toBe(true);
        for (const e of t.effects) if (e.type === 'skillMod') expect(c.skills.some((s) => s.id === e.skill), `${t.id}: ${e.skill}`).toBe(true);
      }
    }
  });

  it('los diálogos apuntan a nodos, objetos, enemigos, tiendas y compañeros que existen', () => {
    const checkNode = (npc: string, nodes: Record<string, DialogNode>, node: DialogNode) => {
      for (const o of node.options) {
        if (o.goto) expect(nodes[o.goto], `${npc}: goto ${o.goto}`).toBeDefined();
        if (o.check) {
          for (const t of [o.check.success, o.check.failure, o.check.crit, o.check.fumble]) if (t) expect(nodes[t], `${npc}: check → ${t}`).toBeDefined();
          expect(SKILLS[o.check.skill as SkillKey]).toBeDefined();
        }
        for (const b of ([] as string[]).concat(o.ifBackground ?? [])) expect(BACKGROUNDS.has(b), `${npc}: ${b}`).toBe(true);
        if (o.ifCompanion) expect(COMPANIONS.has(o.ifCompanion)).toBe(true);
        if (o.action?.type === 'shop') expect(SHOPS.has(o.action.shop)).toBe(true);
      }
      for (const e of node.effects ?? []) {
        if (e.type === 'item') expect(ITEMS.has(e.item), `${npc}: ${e.item}`).toBe(true);
        if (e.type === 'fight') expect(ENEMIES.has(e.enemy), `${npc}: ${e.enemy}`).toBe(true);
        if (e.type === 'discount') expect(SHOPS.has(e.shop), `${npc}: ${e.shop}`).toBe(true);
        if (e.type === 'approval' || e.type === 'recruit') expect(COMPANIONS.has(e.companion)).toBe(true);
        if (e.type === 'quest') expect(QUESTS.has(e.quest)).toBe(true);
        if (e.type === 'attitude') expect(NPCS.has(e.npc), `${npc}: ${e.npc}`).toBe(true);
      }
    };
    let checks = 0;
    for (const n of NPCS.values()) {
      for (const node of Object.values(n.dialog)) {
        checkNode(n.id, n.dialog, node);
        checks += node.options.filter((o) => o.check).length;
      }
    }
    expect(checks).toBeGreaterThanOrEqual(15);
    for (const c of COMPANIONS.values()) expect(NPCS.has(c.npc), c.id).toBe(true);
  });
});

describe('talentos', () => {
  it('se gana una elección por nivel y se ofrecen 3 distintas', () => {
    const g = gameWith('mago');
    g.gainXp(totalXpForLevel(4), 'test');
    const p = g.state.player;
    expect(p.talentChoices).toBe(3);
    const offer = talentOffer(p, g.state.seed);
    expect(offer).toHaveLength(3);
    expect(new Set(offer.map((t) => t.id)).size).toBe(3);
    expect(talentOffer(p, g.state.seed).map((t) => t.id)).toEqual(offer.map((t) => t.id)); // estable
    expect(chooseTalent(p, offer[0]!.id)).toBeNull();
    expect(p.talentChoices).toBe(2);
    expect(eligibleTalents(p).some((t) => t.id === offer[0]!.id)).toBe(false);
  });

  it('suelo en llamas: la bola de fuego deja a los enemigos quemándose', () => {
    const g = gameWith('mago', { level: 6, talents: ['mago_suelo_llamas'] });
    g.rng = new LowRng() as never; // las salvaciones de los orcos fallan
    const b = fight(g, 'orco_bruto', 'orco_bruto');
    expect(b.useSkill('bola_de_fuego').ok).toBe(true);
    const burning = b.foes().filter((f) => f.statuses.some((s) => s.id === 'quemado'));
    expect(burning.length).toBeGreaterThan(0);
  });

  it('sed de sangre: matar cura', () => {
    const g = gameWith('guerrero', { level: 2, talents: ['gue_sed_sangre'] });
    g.state.player.stats.FUE = 30;
    g.state.player.hp = 3;
    g.rng = new HighRng() as never; // 20 naturales: siempre impactas
    const b = fight(g, 'rata_gigante');
    const e = b.foes()[0]!;
    e.enemy!.hp = 1;
    for (let i = 0; i < 12 && !e.dead; i++) {
      if (b.awaiting) b.attack(e.id);
      else b.step();
    }
    expect(e.dead).toBe(true);
    expect(g.state.player.hp).toBeGreaterThanOrEqual(6);
  });

  it('contraataque: si te fallan cuerpo a cuerpo, devuelves el golpe', () => {
    const g = gameWith('guerrero', { level: 2, talents: ['gue_contraataque'] });
    const es = [g.spawnEnemy('goblin', g.playerPos.x + 2, g.playerPos.y + 2)!];
    g.rng = new LowRng(); // el goblin saca un 1 (pifia) y el 50 % "acierta"
    const b = g.beginBattle(es);
    const events: string[] = [];
    for (let i = 0; i < 20 && !events.some((t) => t.includes('Contraataque')); i++) {
      b.step();
      for (const ev of b.drain()) if (ev.t === 'info') events.push(ev.text);
      if (b.awaiting) b.defend();
    }
    expect(events.some((m) => m.includes('Contraataque'))).toBe(true);
  });

  it('proyectiles rebotantes: el hechizo alcanza a un segundo enemigo', () => {
    const g = gameWith('mago', { level: 2, talents: ['mago_rebote'] });
    const b = fight(g, 'orco_bruto', 'orco_bruto');
    const [e1, e2] = b.foes();
    expect(b.useSkill('proyectil_magico', e1!.id).ok).toBe(true);
    expect(e1!.enemy!.hp).toBeLessThan(e1!.enemy!.maxHp);
    expect(e2!.enemy!.hp).toBeLessThan(e2!.enemy!.maxHp);
  });

  it('los talentos de estadística suben la CA y la vida', () => {
    const g = gameWith('guerrero', { level: 2 });
    const ac = g.derived.ac;
    const hp = g.state.player.maxHp;
    g.state.player.talents.push('gue_piel_hierro');
    recalcPlayer(g.state.player);
    expect(g.derived.ac).toBe(ac + 1);
    expect(g.state.player.maxHp).toBe(hp + 6);
  });
});

describe('compañeros', () => {
  it('reclutar coloca al compañero a tu lado y oculta su PNJ', () => {
    const g = gameWith('guerrero');
    expect(g.recruitCompanion('sira')).toBeNull();
    expect(g.ally).not.toBeNull();
    const p = g.playerPos;
    expect(Math.max(Math.abs(g.ally!.x - p.x), Math.abs(g.ally!.y - p.y))).toBeLessThanOrEqual(3);
    expect(g.state.flags['reclutado_sira']).toBe(true);
    expect(g.state.party.hp).toBe(g.allyStats().maxHp);
  });

  it('en batalla ataca a los enemigos y los enemigos le atacan a él', () => {
    let hitByAlly = 0;
    let allyHurt = 0;
    for (let n = 0; n < 15; n++) {
      const g = gameWith('guerrero');
      g.recruitCompanion('brann');
      g.state.player.hp = g.state.player.maxHp = 999;
      const e = g.spawnEnemy('orco_bruto', g.playerPos.x + 2, g.playerPos.y + 2)!;
      const b = g.beginBattle([e]);
      expect(b.get('ally')).toBeDefined();
      for (let t = 0; t < 40 && !b.ended; t++) {
        b.step();
        if (b.awaiting) b.defend();
      }
      if (e.hp < e.maxHp) hitByAlly++;
      if (g.state.party.hp < g.allyStats().maxHp || g.state.party.down) allyHurt++;
    }
    expect(hitByAlly).toBeGreaterThan(5);
    expect(allyHurt).toBeGreaterThan(3);
  });

  it('te sigue cuando te alejas', () => {
    const g = new Game(testState('guerrero'));
    g.enemies = [];
    g.recruitCompanion('sira');
    // Caminamos hacia arriba por la aldea
    const p0 = g.playerPos;
    g.tapTile(p0.x, p0.y - 8);
    for (let i = 0; i < 80; i++) g.update(0.05);
    const p = g.playerPos;
    expect(p.y).toBeLessThan(p0.y);
    expect(Math.max(Math.abs(g.ally!.x - p.x), Math.abs(g.ally!.y - p.y))).toBeLessThanOrEqual(3);
  });

  it('caído no muere: se levanta al acabar la batalla y se cura al descansar', () => {
    const g = gameWith('guerrero');
    g.recruitCompanion('sira');
    g.state.party.hp = 0;
    g.state.party.down = true;
    const e = g.spawnEnemy('goblin', g.playerPos.x + 2, g.playerPos.y + 2)!;
    const b = g.beginBattle([e]);
    expect(b.get('ally')).toBeUndefined(); // caído: no lucha
    defeat(g, e);
    expect(g.state.party.down).toBe(false);
    expect(g.state.party.hp).toBeGreaterThan(0);
    g.state.player.gold = 100;
    g.rest(10);
    expect(g.state.party.hp).toBe(g.allyStats().maxHp);
  });
});

describe('consecuencias de los diálogos', () => {
  it('descuento, oro, banderas y "once"', () => {
    const g = gameWith('guerrero');
    const node: DialogNode = { text: 'x', options: [], effects: [{ type: 'discount', shop: 'tienda_brumaroja', pct: 10 }, { type: 'gold', amount: 5 }, { type: 'flag', flag: 'prueba' }], once: 'prueba_once' };
    const gold = g.state.player.gold;
    g.applyDialogEffects(node);
    g.applyDialogEffects(node);
    expect(g.state.player.gold).toBe(gold + 5);
    expect(g.state.flags['prueba']).toBe(true);
    expect(g.shopDiscount('tienda_brumaroja')).toBe(10);
    const it = createItem('pocion_curacion', 'comun', new Rng(1));
    const shop = getShop('tienda_brumaroja');
    expect(buyPrice(it, shop, 10, 10)).toBeLessThan(buyPrice(it, shop, 10, 0));
  });

  it('una pelea de diálogo hace aparecer enemigos en alerta', () => {
    const g = gameWith('guerrero');
    const close = g.applyDialogEffects({ text: 'x', options: [], effects: [{ type: 'fight', enemy: 'maton_puerto', count: 2 }] });
    expect(close).toBe(true);
    expect(g.enemies.filter((e) => e.def.id === 'maton_puerto' && e.alerted)).toHaveLength(2);
  });

  it('los trasfondos dan sus objetos y oro', () => {
    const s = createNewGame({ name: 'L', classId: 'picaro', portrait: 0, seed: 1, stats: { ...CLASSES.get('picaro')!.baseStats }, background: 'ladron' });
    expect(countItem(s.player, 'antidoto')).toBe(1);
    expect(s.player.gold).toBe(CLASSES.get('picaro')!.startingGold + 25);
    expect(s.player.background).toBe('ladron');
  });
});

describe('guardado v7', () => {
  it('una partida v6 recibe trasfondo, talentos pendientes y grupo vacío', () => {
    const v6 = structuredClone(testState('mago')) as unknown as Record<string, unknown>;
    const pl = v6['player'] as Record<string, unknown>;
    delete pl['background'];
    delete pl['talents'];
    delete pl['talentChoices'];
    delete v6['party'];
    pl['level'] = 5;
    const s = migrate(v6, 6, CURRENT_SAVE_VERSION) as unknown as GameState;
    expect(s.player.background).toBe('aventurero');
    expect(s.player.talents).toEqual([]);
    expect(s.player.talentChoices).toBe(4);
    expect(s.party).toEqual({ active: null, hp: 0, down: false, approval: {} });
    const g = new Game(s);
    expect(g.ally).toBeNull();
  });
});
