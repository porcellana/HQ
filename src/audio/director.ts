/**
 * DIRECTOR DE AUDIO: decide qué música y ambiente suenan según el lugar, la hora y la batalla,
 * y aplica los ajustes. Lo único que conoce del juego son los datos de src/data/music.
 */
import type { Battle } from '@/game/battle/battle';
import type { Game } from '@/game/game';
import type { Settings, AudioLevel } from '@/game/settings';
import { battleMusicId, isOutdoorKind, musicIdFor, PROFILES } from '@/data/music';
import { nightAmount } from '@/gfx/viewconst';
import { battleIntensity } from './compose';
import { AudioEngine } from './engine';
import { SFX_VOLUME, Sfx } from './sfx';

const LEVEL: Record<AudioLevel, number> = { off: 0, bajo: 0.3, medio: 0.6, alto: 1 };
/** Mezcla base: la música y el ambiente quedan por debajo de los efectos. */
const MUSIC_GAIN = 0.55;
const AMB_GAIN = 0.9;

export class AudioDirector {
  readonly engine = new AudioEngine();
  readonly sfx = new Sfx(this.engine);
  private game: Game | null = null;
  private battle: Battle | null = null;
  private acc = 0;
  private dayNight = true;

  applySettings(s: Settings): void {
    this.engine.setEnabled(s.sound);
    this.engine.setVolumes({ music: LEVEL[s.music] * MUSIC_GAIN, sfx: SFX_VOLUME[s.volume], amb: LEVEL[s.ambient] * AMB_GAIN });
    this.dayNight = s.dayNight;
  }

  /** Menú principal. */
  title(): void {
    this.game = null;
    this.battle = null;
    this.engine.setNight(0);
    this.engine.setMusic(PROFILES.titulo!, 7, 2);
    this.engine.setAmbience(undefined);
  }

  /** Música y ambiente del lugar actual (al entrar en una zona, al empezar y al acabar una batalla). */
  zone(game: Game): void {
    this.game = game;
    this.battle = null;
    const id = musicIdFor(game.zone.def);
    const p = PROFILES[id] ?? PROFILES.campiña!;
    this.engine.setIntensity(0);
    this.engine.setNight(this.night());
    this.engine.setMusic(p, game.state.seed, 2.5);
    this.engine.setAmbience(p.amb);
  }

  startBattle(game: Game, battle: Battle): void {
    this.game = game;
    this.battle = battle;
    const boss = battle.combatants.some((c) => c.side === 'foe' && c.boss);
    this.engine.setIntensity(0);
    this.engine.setMusic(PROFILES[battleMusicId(battle.dungeonId ? 'cripta' : battle.biome, boss)]!, game.state.seed + battle.combatants.length, 0.8);
    this.engine.setAmbience(undefined);
  }

  /** Fin de batalla: fanfarria breve (la música de fondo calla). */
  endBattle(outcome: 'victoria' | 'derrota'): void {
    this.battle = null;
    this.engine.playFanfare(outcome);
  }

  private night(): number {
    const g = this.game;
    if (!g || !this.dayNight || !isOutdoorKind(g.zone.def.kind)) return 0;
    return Math.round(nightAmount(g.state.turn) * 4) / 4;
  }

  /** Llamar cada fotograma: reajusta hora e intensidad unas 2 veces por segundo. */
  update(dt: number): void {
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.acc = 0;
    if (this.battle) {
      let fh = 0, fm = 0, ph = 0, pm = 0;
      for (const c of this.battle.combatants) {
        const hp = c.dead ? 0 : this.battle.hp(c), max = this.battle.maxHp(c);
        if (c.side === 'foe') { fh += hp; fm += max; } else { ph += hp; pm += max; }
      }
      this.engine.setIntensity(battleIntensity(fh, fm, ph, pm));
    } else this.engine.setNight(this.night());
  }
}
