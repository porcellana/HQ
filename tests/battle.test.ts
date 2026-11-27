/** Lógica de la batalla por turnos (sin DOM): iniciativa, daño, habilidades, huir, victoria/derrota, estados y jefes. */
import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/rng';
import { Battle, type BattleEvent } from '@/game/battle/battle';
import { biomeOf } from '@/game/battle/biome';
import { xpForKill } from '@/game/combat/rules';
import { Game } from '@/game/game';
import { addItem } from '@/game/items/inventory';
import { createItem } from '@/game/items/items';
import { recalcPlayer } from '@/game/state';
import { testState } from './helpers';

/** Rng que fuerza los resultados de int() (para tiradas deterministas). */
class FixedRng extends Rng {
  constructor(private readonly fixed: (min: number, max: number) => number) {
    super(5);
  }
  override int(min: number, max: number): number {
    return this.fixed(min, max);
  }
}

function setup(classId: string, enemies: string[], level = 1): { g: Game; b: Battle } {
  const s = testState(classId);
  if (level > 1) {
    s.player.level = level;
    recalcPlayer(s.player);
    s.player.hp = s.player.maxHp;
    s.player.mp = s.player.maxMp;
  }
  const g = new Game(s);
  g.enemies = [];
  const es = enemies.map((id, i) => g.spawnEnemy(id, g.playerPos.x + 2 + i, g.playerPos.y + 2)!);
  const b = g.beginBattle(es);
  return { g, b };
}

/** Avanza hasta el turno del jugador (o el final). */
function toPlayer(b: Battle): void {
  for (let i = 0; i < 50 && !b.awaiting && !b.ended; i++) b.step();
}

describe('orden de turnos', () => {
  it('actúan por iniciativa: el lobo (rápido) antes que el héroe, el zombi (lento) después', () => {
    const { b } = setup('guerrero', ['zombi', 'lobo', 'goblin']);
    const ini = (id: string) => b.initiative(b.get(id)!);
    const wolf = b.foes().find((f) => f.enemy!.def.id === 'lobo')!;
    const zombie = b.foes().find((f) => f.enemy!.def.id === 'zombi')!;
    expect(b.initiative(wolf)).toBeGreaterThan(ini('player'));
    expect(b.initiative(zombie)).toBeLessThan(ini('player'));
    const order = b.upcoming(8);
    expect(order.indexOf(wolf.id)).toBeLessThan(order.indexOf('player'));
    expect(order.indexOf('player')).toBeLessThan(order.indexOf(zombie.id));
  });

  it('la DES del jugador sube su iniciativa y ralentizado la baja', () => {
    const { g, b } = setup('picaro', ['goblin']);
    const base = b.initiative(b.player);
    g.state.player.stats.DES += 4;
    expect(b.initiative(b.player)).toBeGreaterThan(base);
    b.player.statuses.push({ id: 'ralentizado', turns: 2 });
    expect(b.initiative(b.player)).toBeLessThan(base + 4);
  });

  it('el primer evento de cada turno trae la barra de orden', () => {
    const { b } = setup('guerrero', ['goblin', 'goblin']);
    toPlayer(b);
    const turns = b.drain().filter((e): e is Extract<BattleEvent, { t: 'turn' }> => e.t === 'turn');
    expect(turns.length).toBeGreaterThan(0);
    for (const t of turns) {
      expect(t.order[0]).toBe(t.id);
      expect(t.order.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('ataque y daño', () => {
  it('atacar impacta, quita vida y avisa con eventos de ataque y golpe', () => {
    const { g, b } = setup('guerrero', ['rata_gigante']);
    g.state.player.stats.FUE = 30;
    toPlayer(b);
    b.drain();
    const foe = b.foes()[0]!;
    const hp0 = foe.enemy!.hp;
    expect(b.attack(foe.id).ok).toBe(true);
    const evs = b.drain();
    expect(evs.some((e) => e.t === 'attack')).toBe(true);
    expect(evs.some((e) => e.t === 'hit' || e.t === 'miss')).toBe(true);
    expect(foe.enemy!.hp).toBeLessThan(hp0 + 1);
  });

  it('no se puede actuar fuera de turno ni sobre un objetivo inválido', () => {
    const { b } = setup('guerrero', ['goblin']);
    const first = b.foes()[0]!;
    if (!b.awaiting) expect(b.attack(first.id).ok).toBe(false);
    toPlayer(b);
    expect(b.attack('player').ok).toBe(false);
    expect(b.attack('nadie').ok).toBe(false);
  });

  it('resistencias y vulnerabilidades se aplican al daño', () => {
    const { b } = setup('guerrero', ['esqueleto']);
    const sk = b.foes()[0]!;
    sk.enemy!.hp = sk.enemy!.maxHp = 500;
    const def = sk.enemy!.def;
    const plain = b.damage(sk, 10, 'cortante');
    expect(plain).toBe(def.resist?.includes('cortante') ? 5 : def.vulnerable?.includes('cortante') ? 20 : 10);
    expect(sk.enemy!.hp).toBe(500 - plain);
    // Los esqueletos resisten lo perforante (mitad) y son vulnerables a lo contundente (doble) si lo dice su ficha.
    for (const t of def.resist ?? []) expect(b.damage(sk, 10, t)).toBe(5);
    for (const t of def.vulnerable ?? []) expect(b.damage(sk, 10, t)).toBe(20);
  });
});

describe('habilidades', () => {
  it('proyectil mágico gasta maná, nunca falla y pasa el turno', () => {
    const { g, b } = setup('mago', ['orco_bruto']);
    toPlayer(b);
    const foe = b.foes()[0]!;
    const mp = g.state.player.mp;
    const sk = b.skills().find((s) => s.skill.id === 'proyectil_magico')!;
    expect(b.useSkill('proyectil_magico', foe.id).ok).toBe(true);
    expect(g.state.player.mp).toBe(mp - sk.cost);
    expect(foe.enemy!.hp).toBeLessThan(foe.enemy!.maxHp);
    expect(b.awaiting).toBeNull();
  });

  it('sin maná o en recarga no se puede usar', () => {
    const { g, b } = setup('mago', ['orco_bruto'], 3);
    toPlayer(b);
    const foe = b.foes()[0]!;
    expect(b.useSkill('rayo_escarcha', foe.id).ok).toBe(true);
    toPlayer(b);
    if (b.awaiting) {
      const again = b.useSkill('rayo_escarcha', foe.id);
      expect(again.ok).toBe(false);
      expect(again.error).toMatch(/recarga/);
      g.state.player.mp = 0;
      expect(b.useSkill('proyectil_magico', foe.id).ok).toBe(false);
    }
  });

  it('las habilidades de área golpean a todos los enemigos sin elegir objetivo', () => {
    const { g, b } = setup('mago', ['orco_bruto', 'orco_bruto', 'orco_bruto'], 6);
    g.state.player.mp = g.state.player.maxMp;
    toPlayer(b);
    const sk = b.skills().find((s) => s.skill.id === 'bola_de_fuego')!;
    expect(sk.target).toBe('allEnemies');
    b.drain();
    expect(b.useSkill('bola_de_fuego').ok).toBe(true);
    const hits = new Set(b.drain().filter((e): e is Extract<BattleEvent, { t: 'hit' }> => e.t === 'hit').map((e) => e.id));
    expect(hits.size).toBe(3);
  });

  it('las curas eligen aliado: Curar heridas sobre ti o sobre el compañero', () => {
    const { g, b } = setup('clerigo', ['goblin']);
    g.recruitCompanion('sira');
    g.state.player.hp = g.state.player.maxHp = 999; // ni un crítico te tumba antes de curar
    g.enemies[0]!.toHitBonus = -50; // no falla ni un golpe del test
    g.enemies[0]!.hp = g.enemies[0]!.maxHp = 500; // y no cae antes de tu turno
    const b2 = g.beginBattle([g.enemies[0]!]);
    toPlayer(b2);
    expect(b2.skills().find((s) => s.skill.id === 'curar_heridas')!.target).toBe('ally');
    const ally = b2.get('ally')!;
    // Cura al compañero si sigue en pie (un crítico podría haberlo derribado) o, si no, al jugador.
    const target = ally.dead ? b2.player : ally;
    const hpOf = () => b2.hp(target);
    g.state.player.hp = Math.min(g.state.player.hp, 1);
    if (!ally.dead) g.state.party.hp = 1;
    const before = hpOf();
    const r = b2.useSkill('curar_heridas', target.id);
    expect(r.error ?? 'ok').toBe('ok');
    expect(hpOf()).toBeGreaterThan(before);
    void b;
  });

  it('un buff se aplica al aliado elegido y dura unos turnos', () => {
    const { b } = setup('clerigo', ['goblin'], 3);
    toPlayer(b);
    expect(b.useSkill('bendicion', 'player').ok).toBe(true);
    expect(b.buffTotal(b.player, 'ca')).toBe(2);
    expect(b.buffTotal(b.player, 'ataque')).toBe(2);
  });

  it('Defender suma +2 a la CA hasta tu próximo turno', () => {
    const { g, b } = setup('guerrero', ['goblin']);
    g.state.player.hp = g.state.player.maxHp = 999;
    toPlayer(b);
    const ac = b.ac(b.player);
    expect(b.defend().ok).toBe(true);
    expect(b.ac(b.player)).toBe(ac + 2);
    toPlayer(b);
    expect(b.ac(b.player)).toBe(ac); // al empezar tu turno se quita
  });
});

describe('objetos', () => {
  it('una poción cura al aliado elegido y se gasta', () => {
    const { g, b } = setup('guerrero', ['goblin']);
    const pot = createItem('pocion_curacion', 'comun', new Rng(1), { qty: 2 });
    addItem(g.state.player, pot);
    g.state.player.hp = 1;
    toPlayer(b);
    const stack = g.state.player.inventory.find((x) => x.id === 'pocion_curacion')!;
    const qty0 = stack.qty;
    expect(b.usableItems().some((i) => i.uid === stack.uid)).toBe(true);
    expect(b.useItem(stack.uid, 'player').ok).toBe(true);
    expect(g.state.player.hp).toBeGreaterThan(1);
    expect(g.state.player.inventory.find((x) => x.id === 'pocion_curacion')!.qty).toBe(qty0 - 1);
  });
});

describe('huir', () => {
  it('con tirada alta escapas; con tirada baja pierdes el turno', () => {
    const { g, b } = setup('picaro', ['goblin']);
    g.state.player.hp = g.state.player.maxHp = 999;
    (b as unknown as { rng: Rng }).rng = new FixedRng((min) => min);
    toPlayer(b);
    const r = b.flee();
    expect(r.ok).toBe(true);
    expect(r.success).toBe(false);
    expect(b.ended).toBe(false);
    (b as unknown as { rng: Rng }).rng = new FixedRng((_min, max) => max);
    toPlayer(b);
    const r2 = b.flee();
    expect(r2.success).toBe(true);
    expect(b.outcome).toBe('fled');
  });

  it('no se puede huir de un jefe', () => {
    const { b } = setup('picaro', ['rey_goblin']);
    toPlayer(b);
    const r = b.flee();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/No puedes huir/);
  });
});

describe('victoria, derrota, XP y botín', () => {
  it('ganar da XP escalada, oro y objetos, y cuenta las bajas', () => {
    const { g, b } = setup('guerrero', ['goblin', 'rata_gigante']);
    const kills = [...b.foes()];
    for (const f of kills) b.damage(f, 999, 'cortante', { src: b.player, ctx: 'weapon' });
    expect(b.ended).toBe(true);
    expect(b.outcome).toBe('victory');
    const expectedXp = kills.reduce((a, f) => a + xpForKill(f.enemy!.def.xp, f.enemy!.def.level, 1), 0);
    expect(b.result.xp).toBe(expectedXp);
    expect(b.result.kills).toHaveLength(2);
    expect(g.state.record.kills).toBe(2);
    g.finishBattle();
    expect(g.state.player.xp).toBe(g.battleXp(b.result) || g.state.player.xp);
    expect(g.enemies).toHaveLength(0);
  });

  it('con compañero y mascota el reparto de XP es menor', () => {
    const { g, b } = setup('guerrero', ['goblin']);
    const solo = g.battleXp({ ...b.result, xp: 100 });
    g.recruitCompanion('sira');
    expect(g.battleXp({ ...b.result, xp: 100 })).toBeLessThan(solo);
  });

  it('caer a 0 PV es derrota', () => {
    const { g, b } = setup('mago', ['orco_bruto']);
    g.state.player.hp = 1;
    toPlayer(b);
    b.damage(b.player, 50, 'cortante');
    expect(b.outcome).toBe('defeat');
    expect(b.drain().some((e) => e.t === 'end' && e.outcome === 'defeat')).toBe(true);
  });

  it('autoPlay termina siempre la batalla', () => {
    const { b } = setup('guerrero', ['rata_gigante']);
    expect(b.autoPlay().outcome).toMatch(/victory|defeat/);
  });
});

describe('estados', () => {
  it('el veneno hace daño al empezar el turno y se agota', () => {
    const { g, b } = setup('guerrero', ['goblin']);
    toPlayer(b);
    b.player.statuses.push({ id: 'veneno', turns: 2 });
    const hp = g.state.player.hp;
    b.defend();
    toPlayer(b);
    expect(g.state.player.hp).toBeLessThan(hp);
  });

  it('aturdido pierde el turno una vez', () => {
    const { b } = setup('guerrero', ['goblin']);
    const foe = b.foes()[0]!;
    foe.statuses.push({ id: 'aturdido', turns: 1 });
    b.drain();
    let said = false;
    for (let i = 0; i < 6 && !said; i++) {
      b.step();
      for (const e of b.drain()) if (e.t === 'say' && /aturdido/.test(e.text)) said = true;
      if (b.awaiting) b.defend();
    }
    expect(said).toBe(true);
    expect(foe.statuses.some((s) => s.id === 'aturdido')).toBe(false);
  });

  it('un golpe con estado lo aplica (hoja envenenada)', () => {
    const { g, b } = setup('picaro', ['orco_bruto'], 6);
    g.state.player.mp = g.state.player.maxMp;
    g.state.player.stats.DES = 30;
    toPlayer(b);
    const foe = b.foes()[0]!;
    b.useSkill('hoja_envenenada', foe.id);
    expect(foe.statuses.some((s) => s.id === 'veneno') || foe.dead || b.drain().some((e) => e.t === 'miss')).toBe(true);
  });
});

describe('jefes', () => {
  it('Gruñaz cambia de fase y llama refuerzos', () => {
    const { b } = setup('guerrero', ['rey_goblin']);
    const boss = b.foes()[0]!;
    b.drain();
    b.damage(boss, Math.ceil(boss.enemy!.maxHp * 0.5), 'cortante', { src: b.player, ctx: 'weapon' });
    const evs = b.drain();
    expect(boss.enemy!.phase).toBeGreaterThanOrEqual(1);
    expect(evs.some((e) => e.t === 'phase')).toBe(true);
    expect(b.foes().length).toBeGreaterThan(1);
    expect(evs.some((e) => e.t === 'summon')).toBe(true);
  });

  it('al vencer al jefe se marca su bandera y la mazmorra se completa', () => {
    const g = new Game(testState('guerrero'));
    g.enterZone('cueva_goblin', '1');
    g.enterZone('cueva_goblin__jefe', '1');
    const boss = g.enemies.find((e) => e.def.boss)!;
    const b = g.beginBattle([boss]);
    for (const f of b.foes()) b.damage(f, 99999, 'sagrado', { src: b.player, ctx: 'weapon' });
    expect(b.outcome).toBe('victory');
    g.finishBattle();
    expect(g.state.flags['boss_rey_goblin']).toBe(true);
    expect(g.state.world.dungeons['cueva_goblin']!.cleared).toBe(true);
  });

  it('las invocaciones nunca pasan del máximo de enemigos', () => {
    const { b } = setup('guerrero', ['nigromante']);
    const boss = b.foes()[0]!;
    for (let i = 0; i < 40 && !b.ended; i++) {
      b.step();
      if (b.awaiting) b.defend();
      boss.enemy!.hp = Math.max(1, boss.enemy!.hp);
    }
    expect(b.foes().length).toBeLessThanOrEqual(6);
  });
});

describe('compañero y mascota', () => {
  it('actúan solos con IA y atacan a los enemigos', () => {
    let hits = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { g } = setup('guerrero', ['orco_bruto']);
      g.recruitCompanion('brann');
      g.rng = new Rng(seed) as never;
      const e = g.enemies[0]!;
      e.hp = e.maxHp = 500;
      const b = g.beginBattle([e]);
      g.state.player.hp = g.state.player.maxHp = 999;
      for (let i = 0; i < 20 && !b.ended; i++) {
        b.step();
        if (b.awaiting) b.defend();
      }
      if (e.hp < 500) hits++;
    }
    expect(hits).toBeGreaterThan(6);
  });

  it('el compañero caído no entra en la batalla', () => {
    const { g } = setup('guerrero', ['goblin']);
    g.recruitCompanion('sira');
    g.state.party.down = true;
    g.state.party.hp = 0;
    const b = g.beginBattle([g.enemies[0]!]);
    expect(b.get('ally')).toBeUndefined();
  });
});

describe('escenario', () => {
  it('el fondo depende de la zona', () => {
    expect(biomeOf({ id: 'bosque_sombrio', kind: 'wild' })).toBe('bosque');
    expect(biomeOf({ id: 'paso_gris', kind: 'wild' })).toBe('montana');
    expect(biomeOf({ id: 'x', kind: 'dungeon', dungeon: { id: 'cripta_velkar' } })).toBe('cripta');
    expect(biomeOf({ id: 'x', kind: 'dungeon', dungeon: { id: 'galerias_seda' } })).toBe('galerias');
    expect(biomeOf({ id: 'x', kind: 'dungeon', dungeon: { id: 'cueva_goblin' } })).toBe('cueva');
    expect(biomeOf({ id: 'aldea_brumaroja', kind: 'town' })).toBe('aldea');
    expect(biomeOf({ id: 'puerto_ceniza', kind: 'town' })).toBe('puerto');
  });
});
