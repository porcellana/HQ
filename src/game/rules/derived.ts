/**
 * VALORES DERIVADOS DEL PERSONAJE (con equipo)
 *  - Características efectivas = base + bonos de objetos.
 *  - CA = 10 + DES (limitada por la armadura de pecho) + CA de piezas y escudo
 *         + poder de rareza + bonos "CA" + entrenamiento de clase.
 *  - Ataque = modificador de la característica del arma + competencia + bonos.
 */
import { getClass } from '@/data/registry';
import { ABILITY_KEYS, type AbilityKey, type BonusStat, type DamageType, type StatBlock } from '@/data/schema';
import { abilityModifier } from './dice';
import { maxHpFor, maxResourceFor, proficiencyBonus } from './character';
import { equippedItems, type Carrier } from '../items/inventory';
import { itemBonuses, itemDef, rarityOf, setBonuses } from '../items/items';
import { talentEffects } from '../talents';

export interface WeaponInfo {
  name: string;
  dice: string;
  stat: AbilityKey;
  damageType: DamageType;
  range: number;
  critRange: number;
}

export interface Derived {
  stats: StatBlock;
  bonus: Record<BonusStat, number>;
  ac: number;
  toHit: number;
  weapon: WeaponInfo;
  /** Modificador de daño del arma (característica + bonos + rareza). */
  damageMod: number;
  maxHp: number;
  maxMp: number;
}

export interface DerivableCharacter extends Carrier {
  classId: string;
  level: number;
  stats: StatBlock;
  talents?: string[];
}

export function emptyBonus(): Record<BonusStat, number> {
  return { FUE: 0, DES: 0, CON: 0, INT: 0, SAB: 0, CAR: 0, ca: 0, ataque: 0, daño: 0, pv: 0, recurso: 0 };
}

export function derive(p: DerivableCharacter): Derived {
  const cls = getClass(p.classId);
  const bonus = emptyBonus();
  let armorAc = 0;
  let maxDex = Infinity;
  for (const it of equippedItems(p)) {
    const def = itemDef(it);
    for (const [k, v] of Object.entries(itemBonuses(it))) bonus[k as BonusStat] += v ?? 0;
    if (def.armor) {
      armorAc += def.armor.ac + rarityOf(it).powerBonus;
      if (def.slot === 'pecho' && def.armor.maxDex !== undefined) maxDex = Math.min(maxDex, def.armor.maxDex);
    }
  }
  for (const sb of setBonuses(equippedItems(p))) for (const [k, v] of Object.entries(sb.stats)) bonus[k as BonusStat] += v ?? 0;
  // Bonos pasivos de talentos
  for (const t of talentEffects(p, 'stat')) bonus[t.stat] += t.amount;
  const critBonus = talentEffects(p, 'critRange').reduce((a, t) => a + t.amount, 0);
  const stats = { ...p.stats };
  for (const k of ABILITY_KEYS) stats[k] = Math.min(30, stats[k] + bonus[k]);

  const w = p.equipment.arma;
  const wd = w ? itemDef(w) : undefined;
  const unarmed = cls.unarmed ?? { name: 'Puños', dice: '1d3', stat: 'FUE' as AbilityKey, damageType: 'contundente' as DamageType };
  const weapon: WeaponInfo = wd?.weapon
    ? { name: wd.name, dice: wd.weapon.dice, stat: wd.weapon.stat, damageType: wd.weapon.damageType, range: wd.weapon.range, critRange: Math.min(cls.critRange, wd.weapon.critRange ?? 20) }
    : { ...unarmed, range: 1, critRange: cls.critRange };
  weapon.critRange = Math.max(15, weapon.critRange - critBonus);
  const weaponPower = w && wd?.weapon ? rarityOf(w).powerBonus : 0;

  const dexMod = Math.min(abilityModifier(stats.DES), maxDex);
  return {
    stats,
    bonus,
    ac: 10 + dexMod + armorAc + bonus.ca + cls.armorBonus,
    toHit: abilityModifier(stats[weapon.stat]) + proficiencyBonus(p.level) + bonus.ataque,
    weapon,
    damageMod: abilityModifier(stats[weapon.stat]) + bonus.daño + weaponPower,
    maxHp: maxHpFor(cls, p.level, stats.CON) + bonus.pv,
    maxMp: maxResourceFor(cls, p.level, stats) + bonus.recurso,
  };
}
