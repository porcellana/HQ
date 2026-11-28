/**
 * MAPA GRANDE INTERACTIVO (al tocar el minimapa)
 * Zona actual a pantalla completa: arrastra para moverte, pellizca o usa +/−
 * para el zoom y toca un punto para «Ir aquí». Muestra salidas, PNJ (❗/❓),
 * cofres y vetas, enemigos alerta y el objetivo de la misión seguida.
 */
import type { Game } from '@/game/game';
import { npcMarker } from '@/game/quests/quests';
import { GOAL_ICON } from '@/game/quests/guide';
import type { HumanoidColors } from '@/gfx/look';
import { heroPortrait } from '@/gfx/world3d/studio';
import { getZoneDef } from '@/data/registry';
import { activeSeed } from '@/game/world/procgen';
import { worldOverview } from '@/game/world/procgen/overview';
import { h } from './dom';


interface Target {
  x: number;
  y: number;
  label: string;
}

export function zoneMapScreen(
  game: Game,
  zoneImg: HTMLCanvasElement,
  heroColors: HumanoidColors,
  onClose: () => void,
  onGo: (x: number, y: number) => void,
): HTMLElement {
  const zone = game.zone;
  const canvas = h('canvas', { class: 'map-canvas' });
  const info = h('div', { class: 'map-info' });
  const goBtn = h('button', { class: 'primary', text: 'Ir aquí', disabled: true });
  let target: Target | null = null;

  const root = h('div', { class: 'screen map-screen' }, [
    h('div', { class: 'map-top' }, [
      h('b', { text: zone.def.name }),
      h('button', { class: 'map-close', text: '✕ Cerrar', onClick: onClose }),
    ]),
    canvas,
    h('div', { class: 'map-bottom' }, [
      info,
      h('div', { class: 'map-buttons' }, [
        h('button', { class: 'mini big', text: '−', attrs: { 'aria-label': 'Alejar' }, onClick: () => zoomBy(1 / 1.4) }),
        h('button', { class: 'mini big', text: '+', attrs: { 'aria-label': 'Acercar' }, onClick: () => zoomBy(1.4) }),
        h('button', { class: 'mini big', text: '◎', attrs: { 'aria-label': 'Centrar en mí' }, onClick: () => centerOn(game.playerPos.x, game.playerPos.y) }),
        h('button', { class: 'mini big', text: '🌍', attrs: { 'aria-label': 'Mapa del mundo' }, onClick: () => toggleWorld() }),
        goBtn,
      ]),
    ]),
  ]);

  // Mapa del mundo: zonas descubiertas (fijas y generadas) y salidas aún sin explorar.
  let worldEl: HTMLElement | null = null;
  const toggleWorld = () => {
    if (worldEl) {
      worldEl.remove();
      worldEl = null;
      return;
    }
    const cells = worldOverview(activeSeed(), game.state.visitedZones, (id) => getZoneDef(id)?.name ?? id);
    const xs = cells.map((c) => c.cx), ys = cells.map((c) => c.cy);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    const here = zone.def.generated ? `w_${zone.def.generated.cx}_${zone.def.generated.cy}` : zone.id;
    const goalId = (game.questGoal?.zone ?? '').replace(/\.d$/, '');
    const grid = h('div', { class: 'wm-grid' });
    grid.style.gridTemplateColumns = `repeat(${x1 - x0 + 1}, 44px)`;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = cells.find((k) => k.cx === x && k.cy === y);
        const el = h('div', { class: `wm-cell${c ? (c.discovered ? '' : ' unknown') : ' empty'}${c && c.id === here ? ' here' : ''}${c && c.id === goalId ? ' goal' : ''}` });
        if (c) {
          el.style.background = c.discovered ? c.color : '#1a1822';
          el.textContent = c.id === goalId ? '📍' : c.discovered ? c.icon : '?';
          el.title = c.discovered ? c.name : 'Sin explorar';
        }
        grid.append(el);
      }
    }
    worldEl = h('div', { class: 'map-world' }, [
      h('b', { text: 'Mapa del mundo' }),
      h('div', { class: 'wm-scroll' }, [grid]),
      h('small', { class: 'muted', text: '▣ tú · 📍 objetivo · ? sin explorar' }),
      h('button', { class: 'mini', text: 'Cerrar', onClick: toggleWorld }),
    ]);
    root.append(worldEl);
  };

  // Vista: px CSS por casilla y desplazamiento (px CSS) del mapa en el lienzo.
  let scale = 0;
  let offX = 0;
  let offY = 0;
  const size = () => ({ w: canvas.clientWidth || 360, h: canvas.clientHeight || 500 });
  const clampView = () => {
    const { w, h: hh } = size();
    const mw = zone.width * scale;
    const mh = zone.height * scale;
    offX = mw <= w ? (w - mw) / 2 : Math.min(40, Math.max(w - mw - 40, offX));
    offY = mh <= hh ? (hh - mh) / 2 : Math.min(40, Math.max(hh - mh - 40, offY));
  };
  const centerOn = (tx: number, ty: number) => {
    const { w, h: hh } = size();
    offX = w / 2 - (tx + 0.5) * scale;
    offY = hh / 2 - (ty + 0.5) * scale;
    clampView();
  };
  const zoomBy = (f: number, cx?: number, cy?: number) => {
    const { w, h: hh } = size();
    const px = cx ?? w / 2;
    const py = cy ?? hh / 2;
    const tx = (px - offX) / scale;
    const ty = (py - offY) / scale;
    const minS = Math.min(w / zone.width, hh / zone.height) * 0.9;
    scale = Math.max(minS, Math.min(64, scale * f));
    offX = px - tx * scale;
    offY = py - ty * scale;
    clampView();
  };

  const select = (tx: number, ty: number) => {
    if (!zone.inBounds(tx, ty)) return;
    const exit = zone.exits.find((e) => Math.max(Math.abs(e.x - tx), Math.abs(e.y - ty)) <= 1);
    const npc = game.npcs.find((n) => Math.max(Math.abs(n.x - tx), Math.abs(n.y - ty)) <= 1);
    if (npc) target = { x: npc.x, y: npc.y, label: `Hablar con ${npc.name}` };
    else if (exit) target = { x: exit.x, y: exit.y, label: `Ir a: ${exit.label ?? exit.to}` };
    else if (!game.isExplored(tx, ty)) target = null;
    else if (zone.isWalkable(tx, ty)) target = { x: tx, y: ty, label: 'Ir aquí' };
    else target = { x: tx, y: ty, label: `${zone.tileAt(tx, ty)?.name ?? 'Ahí'}: ir cerca` };
    info.textContent = target ? target.label : 'Zona sin explorar.';
    goBtn.disabled = !target;
    goBtn.textContent = target ? 'Ir' : 'Ir aquí';
  };
  goBtn.addEventListener('click', () => {
    if (target) onGo(target.x, target.y);
  });

  // ---------------------------------------------------------------- gestos
  const pointers = new Map<number, { x: number; y: number }>();
  let dragged = false;
  let start = { x: 0, y: 0 };
  let pinchDist = 0;
  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      dragged = false;
      start = p;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      dragged = true;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinchDist > 0) zoomBy(d / pinchDist, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      pinchDist = d;
      return;
    }
    if (Math.hypot(p.x - start.x, p.y - start.y) > 8) dragged = true;
    if (dragged) {
      offX += p.x - prev.x;
      offY += p.y - prev.y;
      clampView();
    }
  });
  const end = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (p && !dragged && pointers.size === 0) select(Math.floor((p.x - offX) / scale), Math.floor((p.y - offY) / scale));
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = local(e as unknown as PointerEvent);
    zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  }, { passive: false });

  // --------------------------------------------------------------- dibujo
  const hero = heroPortrait(heroColors, '', true);
  const goal = game.questGoal;
  let t = 0;
  const draw = () => {
    if (!root.isConnected) return;
    t += 1 / 60;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const { w, h: hh } = size();
    if (!scale) {
      scale = Math.max(Math.min(w / zone.width, hh / zone.height) * 0.95, Math.min(22, w / 14));
      centerOn(game.playerPos.x, game.playerPos.y);
    }
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hh * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hh * dpr);
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#07060a';
    ctx.fillRect(0, 0, w, hh);
    ctx.drawImage(zoneImg, offX, offY, zone.width * scale, zone.height * scale);
    // Niebla en mazmorras: lo no visto se tapa.
    if (zone.def.dungeon) {
      ctx.fillStyle = '#07060a';
      for (let y = 0; y < zone.height; y++) {
        for (let x = 0; x < zone.width; x++) {
          if (!game.isExplored(x, y)) ctx.fillRect(offX + x * scale - 0.5, offY + y * scale - 0.5, scale + 1, scale + 1);
        }
      }
    }
    const at = (x: number, y: number) => ({ x: offX + (x + 0.5) * scale, y: offY + (y + 0.5) * scale });
    const fs = Math.max(11, Math.min(16, scale * 0.8));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Cofres y vetas
    for (const f of game.featureSprites()) {
      if (!game.isExplored(f.x, f.y)) continue;
      const c = at(f.x, f.y);
      ctx.font = `${fs}px sans-serif`;
      ctx.fillText(f.sprite.startsWith('chest') ? (f.sprite === 'chestOpen' ? '▫' : '🎁') : f.sprite.startsWith('ore') ? '⛏' : '⚠', c.x, c.y);
    }
    // Salidas
    const seen = new Set<string>();
    for (const e of zone.exits) {
      if (seen.has(e.digit) || !game.isExplored(e.x, e.y)) continue;
      seen.add(e.digit);
      const c = at(e.x, e.y);
      const isGoal = goal?.exitTo === e.to;
      ctx.fillStyle = isGoal ? '#a8f08a' : '#f2d888';
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(4, scale * 0.35), 0, Math.PI * 2);
      ctx.fill();
      label(ctx, e.label ?? e.to, c.x, c.y - Math.max(12, scale * 0.9), fs, isGoal ? '#a8f08a' : '#f2d888');
    }
    // PNJ
    for (const n of game.npcs) {
      const c = at(n.x, n.y);
      ctx.fillStyle = '#6ab0ff';
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(4, scale * 0.3), 0, Math.PI * 2);
      ctx.fill();
      const mk = npcMarker(game.state, n.id);
      label(ctx, `${mk === '!' ? '❗ ' : mk === '?' ? '❓ ' : ''}${n.name}`, c.x, c.y + Math.max(12, scale * 0.8), fs * 0.85, '#cfe4ff');
    }
    // Enemigos en alerta
    for (const e of game.enemies) {
      if (!e.alerted || !game.isExplored(e.x, e.y)) continue;
      const c = at(e.x, e.y);
      ctx.fillStyle = '#ff4a3a';
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(3, scale * 0.28), 0, Math.PI * 2);
      ctx.fill();
    }
    // Objetivo de la misión
    if (goal?.point) {
      const c = at(goal.point.x, goal.point.y);
      const r = Math.max(10, scale * 0.8) * (1 + 0.15 * Math.sin(t * 5));
      ctx.strokeStyle = '#a8f08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `${fs}px sans-serif`;
      ctx.fillText(GOAL_ICON[goal.kind], c.x, c.y - r - fs * 0.6);
    }
    // Jugador
    const pp = at(game.playerPos.x, game.playerPos.y);
    const hs = Math.max(16, scale);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, hs * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(hero, pp.x - hs / 2, pp.y - hs / 2, hs, hs);
    // Selección
    if (target) {
      const c = at(target.x, target.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x - scale / 2, c.y - scale / 2, scale, scale);
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  info.textContent = 'Toca un punto del mapa para ir allí.';
  return root;
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fs: number, color: string): void {
  ctx.font = `bold ${fs}px Georgia, serif`;
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = 'rgba(11,10,16,0.8)';
  ctx.fillRect(x - w / 2, y - fs * 0.7, w, fs * 1.4);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
