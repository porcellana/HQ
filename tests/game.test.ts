import { describe, expect, it } from 'vitest';
import { Game } from '@/game/game';
import { testState } from './helpers';

const newGame = () => new Game(testState());
const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.05) g.update(0.05);
};

describe('movimiento por turnos', () => {
  it('sigue la ruta tocada y cuenta turnos', () => {
    const g = newGame();
    const start = g.playerPos;
    g.tapTile(start.x, start.y - 3);
    run(g, 2);
    expect(g.playerPos).toEqual({ x: start.x, y: start.y - 3 });
    expect(g.state.turn).toBe(3);
  });

  it('cruza la salida a otra zona, marca visitada y vuelve', () => {
    const g = newGame();
    const zones: string[] = [];
    g.events.on('zoneChanged', ({ zone }) => zones.push(zone.id));
    const exit = g.zone.exits.find((e) => e.to === 'bosque_sombrio')!;
    g.tapTile(exit.x, exit.y);
    run(g, 10);
    expect(g.zone.id).toBe('bosque_sombrio');
    expect(g.state.player.pos.zone).toBe('bosque_sombrio');
    expect(g.state.visitedZones).toContain('bosque_sombrio');
    // Al llegar está sobre la salida pero no rebota a la aldea.
    run(g, 1);
    expect(g.zone.id).toBe('bosque_sombrio');
    expect(zones).toEqual(['bosque_sombrio']);
  });

  it('una salida a una zona inexistente no rompe el juego', () => {
    const g = newGame();
    g.enterZone('bosque_sombrio', '1');
    const cave = g.zone.exits.find((e) => e.to === 'cueva_goblin')!;
    const msgs: string[] = [];
    g.events.on('message', (m) => msgs.push(m.text));
    g.useExit({ ...cave, to: 'zona_que_no_existe' });
    expect(g.zone.id).toBe('bosque_sombrio');
    expect(msgs[0]).toMatch(/bloqueado/);
  });

  it('una posición guardada inválida se corrige', () => {
    const s = testState();
    s.player.pos = { zone: 'zona_borrada', x: 0, y: 0 };
    const g = new Game(s);
    expect(g.zone.id).toBe('aldea_brumaroja');
    expect(g.zone.isWalkable(g.playerPos.x, g.playerPos.y)).toBe(true);
  });
});
