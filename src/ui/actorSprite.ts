/** Sprite y nombre de cualquier actor del combate (para la barra de turnos y la tarjeta de duelo). */
import { PET_SPECIES } from '@/data/registry';
import type { Actor, Game } from '@/game/game';
import { petName } from '@/game/pets/pets';
import { monsterSprite } from '@/gfx/monsters';
import { PAL } from '@/gfx/palette';
import { petSprite } from '@/gfx/pets';
import { humanoidSprite, type HumanoidColors } from '@/gfx/sprites';

export function actorSprite(game: Game, a: Actor, hero: HumanoidColors | null): HTMLCanvasElement | null {
  if (a.kind === 'player') return hero ? humanoidSprite(hero).right : null;
  if (a.kind === 'ally') {
    const l = game.companionDef?.look;
    if (!l) return null;
    return humanoidSprite({
      hair: l.hair ?? PAL.hair, skin: l.skin ?? PAL.skin, cloth: l.cloth, clothDark: l.clothDark, pants: l.pants,
      ...(l.hat ? { hat: l.hat } : {}), ...(l.overlay ? { overlay: l.overlay } : {}),
    }).right;
  }
  if (a.kind === 'pet') {
    const sp = game.petInstance ? PET_SPECIES.get(game.petInstance.species) : undefined;
    return sp ? petSprite(sp.look, sp.stage).right : null;
  }
  const en = game.enemies.find((x) => x.uid === a.uid);
  if (!en) return null;
  const wild = en.def.pet ? PET_SPECIES.get(en.def.pet.species) : undefined;
  return (wild ? petSprite(wild.look, wild.stage) : monsterSprite(en.def.look)).left;
}

export function actorName(game: Game, a: Actor): string {
  switch (a.kind) {
    case 'player':
      return game.state.player.name;
    case 'ally':
      return game.companionDef?.name ?? 'Compañero';
    case 'pet':
      return game.petInstance ? petName(game.petInstance) : 'Mascota';
    default:
      return game.enemies.find((x) => x.uid === a.uid)?.def.name ?? 'Enemigo';
  }
}

/** Copia un sprite 16×16 a un canvas nuevo con la clase CSS dada (para meterlo en el DOM). */
export function spriteElement(img: HTMLCanvasElement | null, className: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  c.className = className;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  if (img) ctx.drawImage(img, 0, 0);
  return c;
}
