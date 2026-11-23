/**
 * DIÁLOGO CON PNJ (hoja inferior)
 * Muestra el texto del nodo actual y sus opciones. Las acciones (tienda,
 * posada, templo, misiones...) se delegan en `handlers`.
 */
import { BACKGROUNDS, CLASSES, COMPANIONS, NPCS } from '@/data/registry';
import type { DialogAction, DialogOption, NpcDef } from '@/data/schema';
import { SKILLS, successChance } from '@/game/rules/skills';
import type { Game } from '@/game/game';
import * as Quests from '@/game/quests/quests';
import { PAL } from '@/gfx/palette';
import { spriteCanvas } from '@/gfx/sprites';
import { h } from './dom';

export interface DialogHandlers {
  openShop(shopId: string): void;
  /** Abre el establo de mascotas. */
  openStable(): void;
  /** Tras descansar o sanar (guardar partida, etc.). */
  afterService(): void;
  close(): void;
}

const KIND_TAG: Record<string, string> = { principal: '★ Principal', secundaria: 'Secundaria', repetible: '↻ Encargo' };

export function npcDialog(game: Game, npc: NpcDef, handlers: DialogHandlers): HTMLElement {
  const back = h('div', { class: 'dialog-back' });
  const sheet = h('div', { class: 'dialog-sheet' });
  back.append(sheet);
  const l = npc.look;
  const portrait = spriteCanvas(
    { hair: l.hair ?? PAL.hair, skin: l.skin ?? PAL.skin, cloth: l.cloth, clothDark: l.clothDark, pants: l.pants, ...(l.hat ? { hat: l.hat } : {}), ...(l.overlay ? { overlay: l.overlay } : {}) },
    'dialog-portrait',
  );
  const close = () => {
    back.remove();
    handlers.close();
  };

  const header = (text: string) =>
    h('div', { class: 'dialog-head' }, [
      portrait,
      h('div', {}, [h('b', { text: npc.name }), npc.title ? h('small', { class: 'muted', text: ` · ${npc.title}` }) : null, h('p', { text })]),
    ]);

  const visible = (o: DialogOption): boolean => {
    if (o.ifFlag) {
      const neg = o.ifFlag.startsWith('!');
      const has = !!game.state.flags[neg ? o.ifFlag.slice(1) : o.ifFlag];
      if (neg === has) return false;
    }
    if (o.ifQuest) {
      const st = Quests.questStatus(game.state, o.ifQuest.quest);
      const want = o.ifQuest.state;
      if (want === 'activa' ? !(st === 'activa' || st === 'lista') : st !== want) return false;
    }
    if (o.action?.type === 'quests' && Quests.questsForNpc(game.state, npc.id).length === 0) return false;
    const p = game.state.player;
    if (o.ifBackground && !([] as string[]).concat(o.ifBackground).includes(p.background ?? 'aventurero')) return false;
    if (o.ifClass && !([] as string[]).concat(o.ifClass).includes(p.classId)) return false;
    if (o.ifCompanion && game.state.party?.active !== o.ifCompanion) return false;
    if (o.ifAttitude && game.attitude(o.ifAttitude.npc) < o.ifAttitude.min) return false;
    if (o.ifGold !== undefined && p.gold < o.ifGold) return false;
    return true;
  };

  /** Etiqueta con la tirada y la probabilidad, o el trasfondo/clase que la desbloquea. */
  const decorate = (o: DialogOption, base: string): string => {
    const tags: string[] = [];
    if (o.ifBackground) {
      const bg = BACKGROUNDS.get(([] as string[]).concat(o.ifBackground).find((b) => b === game.state.player.background) ?? '');
      if (bg) tags.push(`${bg.icon} ${bg.name}`);
    }
    if (o.ifClass) {
      const c = CLASSES.get(game.state.player.classId);
      if (c) tags.push(c.name);
    }
    if (o.ifCompanion) tags.push(COMPANIONS.get(o.ifCompanion)?.name ?? '');
    if (o.check) {
      const bonus = game.skillBonusOf(o.check.skill);
      const pct = Math.round(successChance(bonus, o.check.dc) * 100);
      tags.push(`🎲 ${SKILLS[o.check.skill].name} CD ${o.check.dc} · ${pct} %`);
    }
    return tags.length ? `[${tags.join(' · ')}] ${base}` : base;
  };

  const showNode = (id: string, override?: string, banner?: { ok: boolean; text: string }) => {
    const node = npc.dialog[id] ?? npc.dialog['inicio'];
    if (!node) return close();
    const text = override ?? (Array.isArray(node.text) ? node.text[Math.floor(Math.random() * node.text.length)]! : node.text);
    // Consecuencias del nodo (oro, objetos, banderas, peleas...)
    const fight = game.applyDialogEffects(node);
    if (node.effects?.length) handlers.afterService();
    const opts = node.options.filter(visible);
    sheet.replaceChildren(
      ...(banner ? [h('div', { class: `check-banner ${banner.ok ? 'ok' : 'ko'}`, text: banner.text })] : []),
      header(text),
      h('div', { class: 'dialog-options' }, fight
        ? [h('button', { class: 'danger', text: '⚔️ ¡A las armas!', onClick: close })]
        : (opts.length ? opts : [{ label: 'Adiós', action: { type: 'end' } } as DialogOption]).map((o) =>
            h('button', { class: o.check ? 'check' : o.ifBackground || o.ifClass ? 'special' : '', text: optionLabel(o), onClick: () => choose(o) }),
          )),
    );
  };

  const optionLabel = (o: DialogOption): string => {
    if (o.action?.type === 'quests') {
      const list = Quests.questsForNpc(game.state, npc.id);
      if (list.some((q) => q.status === 'lista' && (q.quest.turnIn ?? q.quest.giver) === npc.id)) return '📜 Misiones (¡entregar!)';
      if (list.some((q) => q.status === 'disponible')) return '📜 Misiones (nueva)';
    }
    if (o.action?.type === 'temple') return `${o.label} (${o.action.pricePerLevel * game.state.player.level} oro)`;
    return decorate(o, o.label);
  };

  const choose = (o: DialogOption) => {
    if (o.check) {
      const c = o.check;
      const r = game.dialogCheck(c.skill, c.dc);
      // Esperamos a que termine la animación del dado.
      sheet.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
      window.setTimeout(() => {
        const crit = r.natural === 20;
        const fumble = r.natural === 1;
        const next = crit && c.crit ? c.crit : fumble && c.fumble ? c.fumble : r.success ? c.success : c.failure;
        const what = `${SKILLS[c.skill].name}: ${r.natural} ${r.bonus >= 0 ? '+' : '−'} ${Math.abs(r.bonus)} = ${r.total} vs CD ${c.dc}`;
        showNode(next, undefined, {
          ok: r.success,
          text: `${crit ? '✨ ¡ÉXITO CRÍTICO!' : fumble ? '💀 ¡DESASTRE!' : r.success ? '✔ Éxito' : '✘ Fracaso'} — ${what}`,
        });
      }, 900);
      return;
    }
    if (o.action) return act(o.action);
    if (o.goto) showNode(o.goto);
  };

  const act = (a: DialogAction) => {
    switch (a.type) {
      case 'end':
        return close();
      case 'shop':
        back.remove();
        return handlers.openShop(a.shop);
      case 'inn': {
        const err = game.rest(a.price);
        if (!err) handlers.afterService();
        return showNode('inicio', err ?? '¡Que descanses! Mañana será otro día.');
      }
      case 'temple': {
        const err = game.templeHeal(a.pricePerLevel);
        if (!err) handlers.afterService();
        return showNode('inicio', err ?? 'Que la Llama te acompañe.');
      }
      case 'flag':
        game.state.flags[a.flag] = true;
        return showNode('inicio');
      case 'quests':
        return showQuests();
      case 'stable':
        back.remove();
        return handlers.openStable();
      case 'dismiss':
        game.dismissCompanion();
        handlers.afterService();
        return close();
    }
  };

  const showQuests = (note?: string) => {
    const list = Quests.questsForNpc(game.state, npc.id);
    sheet.replaceChildren(
      header(note ?? (list.length ? '¿Qué te interesa?' : 'Ahora mismo no tengo nada para ti.')),
      h('div', { class: 'quest-list' }, list.map(({ quest: q, status }) => {
        const objectives = q.objectives.map((o, i) => {
          const p = Quests.objectiveProgress(game.state, q, i);
          const done = p.have >= p.need;
          return h('li', { class: done ? 'done' : '', text: `${done ? '✔' : '•'} ${o.label}${p.need > 1 ? ` (${status === 'disponible' ? 0 : p.have}/${p.need})` : ''}` });
        });
        const rw = q.rewards;
        const btn =
          status === 'disponible'
            ? h('button', { class: 'primary', text: 'Aceptar', onClick: () => { game.acceptQuest(q.id); handlers.afterService(); showQuests('Cuento contigo.'); } })
            : status === 'lista' && (q.turnIn ?? q.giver) === npc.id
              ? h('button', { class: 'primary', text: 'Entregar', onClick: () => {
                  const err = game.turnInQuest(q.id, npc.id);
                  handlers.afterService();
                  showQuests(err ?? q.completeText ?? '¡Gracias!');
                } })
              : h('small', { class: 'muted', text: status === 'lista' ? `Entrégala a ${NPCS.get(q.turnIn ?? q.giver)?.name ?? '?'}` : 'En curso' });
        return h('div', { class: 'quest-card' }, [
          h('div', { class: 'quest-title' }, [h('b', { text: q.name }), h('small', { class: `tag ${q.kind}`, text: KIND_TAG[q.kind] ?? q.kind })]),
          h('p', { text: q.description }),
          h('ul', {}, objectives),
          h('small', { class: 'reward', text: `Recompensa: ${rw.xp} XP · ${rw.gold} oro${rw.items?.length ? ' · objetos' : ''}` }),
          btn,
        ]);
      })),
      h('div', { class: 'dialog-options' }, [
        h('button', { text: 'Volver', onClick: () => showNode('inicio') }),
        h('button', { text: 'Adiós', onClick: close }),
      ]),
    );
  };

  showNode('inicio');
  return back;
}
