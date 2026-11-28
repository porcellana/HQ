/**
 * ICONOS DE OBJETOS (vectoriales, suaves)
 * Se dibujan con trazados y degradados en un lienzo de alta resolución (nada de píxeles), con luz
 * arriba a la izquierda, contorno blando y brillo. Para un icono nuevo, añade una forma en SHAPES
 * y úsala en data/items (icon.shape).
 */
import type { ItemIcon } from '@/data/schema';

const S = 128;
type Ctx = CanvasRenderingContext2D;

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Aclara (f>0) u oscurece (f<0) un color #rrggbb. */
function shade(hex: string, f: number): string {
  const [r, g, b] = parse(hex);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${ch(r)},${ch(g)},${ch(b)})`;
}
const WOOD = '#9a6a3a', GOLD = '#f0c860';

/** Rellena el trazado actual con degradado vertical del color y un contorno oscuro suave. */
function paint(ctx: Ctx, color: string, y0 = 0, y1 = 100, stroke = true): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(color, 0.42));
  g.addColorStop(0.5, shade(color, 0));
  g.addColorStop(1, shade(color, -0.38));
  ctx.fillStyle = g;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(24,16,30,0.6)';
    ctx.stroke();
  }
}
const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number, color: string, stroke = true): void => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  paint(ctx, color, y, y + h, stroke);
};
const circ = (ctx: Ctx, x: number, y: number, r: number, color: string, stroke = true): void => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  paint(ctx, color, y - r, y + r, stroke);
};
/** Polígono redondeado: las esquinas se suavizan con curvas hacia el punto medio de cada lado. */
const poly = (ctx: Ctx, pts: number[][], color: string, _curve = 0): void => {
  ctx.beginPath();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!, q = pts[(i + 1) % n]!, o = pts[(i + n - 1) % n]!;
    if (i === 0) ctx.moveTo((o[0]! + p[0]!) / 2, (o[1]! + p[1]!) / 2);
    ctx.quadraticCurveTo(p[0]!, p[1]!, (p[0]! + q[0]!) / 2, (p[1]! + q[1]!) / 2);
  }
  ctx.closePath();
  const ys = pts.map((p) => p[1]!);
  paint(ctx, color, Math.min(...ys), Math.max(...ys));
};
const shine = (ctx: Ctx, x: number, y: number, w: number, h: number): void => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w, h) / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
};
/** Dibuja `fn` girado `deg` grados alrededor del centro. */
const tilt = (ctx: Ctx, deg: number, fn: () => void): void => {
  ctx.save();
  ctx.translate(50, 50);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.translate(-50, -50);
  fn();
  ctx.restore();
};

type Draw = (ctx: Ctx, c: string) => void;
const SHAPES: Readonly<Record<string, Draw>> = {
  espada: (x, c) => tilt(x, 45, () => { rr(x, 44, 2, 12, 64, 6, c); shine(x, 47, 8, 3, 50); rr(x, 28, 66, 44, 9, 4.5, GOLD); rr(x, 45, 74, 10, 18, 5, WOOD); circ(x, 50, 94, 5.5, GOLD); }),
  daga: (x, c) => tilt(x, 45, () => { rr(x, 44, 22, 12, 42, 6, c); shine(x, 47, 25, 3, 30); rr(x, 34, 64, 32, 8, 4, GOLD); rr(x, 45, 71, 10, 16, 5, WOOD); }),
  hacha: (x, c) => tilt(x, 40, () => { rr(x, 46, 8, 8, 88, 4, WOOD); x.beginPath(); x.moveTo(54, 14); x.bezierCurveTo(92, 6, 96, 48, 54, 46); x.bezierCurveTo(66, 36, 66, 24, 54, 14); paint(x, c, 6, 48); shine(x, 62, 20, 3, 16); }),
  maza: (x, c) => tilt(x, 40, () => { rr(x, 46, 30, 8, 62, 4, WOOD); circ(x, 50, 24, 19, c); shine(x, 40, 12, 6, 12); for (const [px, py] of [[50, 6], [34, 22], [66, 22], [50, 40]] as const) circ(x, px, py, 3.4, shade(c, -0.1)); }),
  baston: (x, c) => tilt(x, 40, () => { rr(x, 46, 22, 8, 74, 4, WOOD); circ(x, 50, 16, 13, c); x.globalAlpha = 0.35; circ(x, 50, 16, 20, c, false); x.globalAlpha = 1; shine(x, 44, 8, 5, 8); }),
  varita: (x, c) => tilt(x, 45, () => { rr(x, 47, 20, 6, 70, 3, WOOD); circ(x, 50, 16, 9, c); x.globalAlpha = 0.35; circ(x, 50, 16, 16, c, false); x.globalAlpha = 1; shine(x, 46, 10, 4, 6); }),
  lanza: (x, c) => tilt(x, 45, () => { rr(x, 47, 26, 6, 70, 3, WOOD); x.beginPath(); x.moveTo(50, 2); x.bezierCurveTo(70, 22, 66, 36, 50, 40); x.bezierCurveTo(34, 36, 30, 22, 50, 2); paint(x, c, 2, 40); shine(x, 46, 12, 3, 18); }),
  arco: (x, c) => { x.beginPath(); x.moveTo(34, 8); x.bezierCurveTo(88, 26, 88, 74, 34, 92); x.lineWidth = 9; x.lineCap = 'round'; x.strokeStyle = shade(WOOD, -0.25); x.stroke(); x.lineWidth = 6; x.strokeStyle = shade(c === '#9aa0ac' ? WOOD : c, 0.05); x.stroke(); x.beginPath(); x.moveTo(34, 8); x.lineTo(34, 92); x.lineWidth = 2; x.strokeStyle = '#efe6d0'; x.stroke(); },
  ballesta: (x, c) => tilt(x, -40, () => { x.beginPath(); x.moveTo(12, 38); x.quadraticCurveTo(50, 22, 88, 38); x.lineWidth = 8; x.lineCap = 'round'; x.strokeStyle = shade(c, -0.1); x.stroke(); rr(x, 44, 28, 12, 62, 5, WOOD); x.beginPath(); x.moveTo(12, 38); x.lineTo(50, 66); x.lineTo(88, 38); x.lineWidth = 2; x.strokeStyle = '#efe6d0'; x.stroke(); }),
  pico: (x, c) => tilt(x, 40, () => { rr(x, 46, 20, 8, 74, 4, WOOD); x.beginPath(); x.moveTo(10, 40); x.bezierCurveTo(30, 6, 70, 6, 90, 40); x.bezierCurveTo(70, 22, 30, 22, 10, 40); paint(x, c, 6, 40); }),
  escudo: (x, c) => { x.beginPath(); x.moveTo(50, 8); x.bezierCurveTo(70, 16, 82, 14, 84, 14); x.bezierCurveTo(86, 54, 72, 78, 50, 94); x.bezierCurveTo(28, 78, 14, 54, 16, 14); x.bezierCurveTo(18, 14, 30, 16, 50, 8); paint(x, c, 8, 94); rr(x, 46, 22, 8, 54, 4, GOLD, false); rr(x, 30, 38, 40, 8, 4, GOLD, false); shine(x, 24, 20, 5, 28); },
  casco: (x, c) => { x.beginPath(); x.moveTo(18, 70); x.bezierCurveTo(14, 22, 86, 22, 82, 70); x.lineTo(70, 70); x.lineTo(70, 54); x.lineTo(30, 54); x.lineTo(30, 70); x.closePath(); paint(x, c, 22, 70); rr(x, 44, 22, 12, 40, 6, shade(c, -0.15), false); shine(x, 26, 34, 5, 16); },
  capucha: (x, c) => { x.beginPath(); x.moveTo(50, 8); x.bezierCurveTo(88, 10, 90, 62, 82, 90); x.lineTo(18, 90); x.bezierCurveTo(10, 62, 12, 10, 50, 8); paint(x, c, 8, 90); x.beginPath(); x.ellipse(50, 56, 17, 22, 0, 0, Math.PI * 2); x.fillStyle = 'rgba(12,8,16,0.85)'; x.fill(); },
  pecho: (x, c) => { x.beginPath(); x.moveTo(30, 12); x.quadraticCurveTo(50, 22, 70, 12); x.lineTo(92, 26); x.lineTo(84, 48); x.lineTo(74, 44); x.lineTo(76, 90); x.lineTo(24, 90); x.lineTo(26, 44); x.lineTo(16, 48); x.lineTo(8, 26); x.closePath(); x.lineJoin = 'round'; paint(x, c, 12, 90); rr(x, 24, 62, 52, 7, 3.5, shade(c, -0.3), false); shine(x, 34, 30, 5, 22); },
  guantes: (x, c) => { rr(x, 24, 40, 50, 46, 14, c); for (let i = 0; i < 4; i++) rr(x, 22 + i * 13, 10 + (i === 0 || i === 3 ? 8 : 0), 11, 38, 5.5, shade(c, 0.05)); rr(x, 60, 40, 24, 12, 6, shade(c, 0.08)); rr(x, 24, 76, 50, 10, 4, shade(c, -0.3)); },
  piernas: (x, c) => { x.beginPath(); x.moveTo(24, 10); x.lineTo(76, 10); x.lineTo(84, 92); x.lineTo(56, 92); x.lineTo(50, 40); x.lineTo(44, 92); x.lineTo(16, 92); x.closePath(); paint(x, c, 10, 92); rr(x, 24, 10, 52, 9, 4, shade(c, -0.3), false); },
  botas: (x, c) => { x.beginPath(); x.moveTo(30, 10); x.lineTo(62, 10); x.lineTo(62, 56); x.bezierCurveTo(90, 56, 96, 70, 94, 84); x.lineTo(24, 84); x.closePath(); paint(x, c, 10, 84); rr(x, 24, 82, 70, 9, 4, '#4a3624'); rr(x, 30, 10, 32, 9, 4, shade(c, -0.3), false); },
  libro: (x, c) => { rr(x, 18, 12, 66, 78, 7, c); rr(x, 24, 14, 6, 74, 3, shade(c, -0.35), false); rr(x, 36, 34, 36, 8, 4, GOLD, false); rr(x, 36, 50, 28, 6, 3, GOLD, false); rr(x, 84, 16, 6, 70, 3, '#f1e8d0'); },
  simbolo: (x, c) => { circ(x, 50, 50, 36, shade(c, 0.1)); circ(x, 50, 50, 29, shade(c, -0.15), false); rr(x, 45, 24, 10, 52, 5, GOLD); rr(x, 24, 40, 52, 10, 5, GOLD); },
  anillo: (x, c) => { x.beginPath(); x.arc(50, 58, 28, 0, Math.PI * 2); x.lineWidth = 12; x.strokeStyle = shade(GOLD, -0.3); x.stroke(); x.lineWidth = 8; x.strokeStyle = GOLD; x.stroke(); poly(x, [[50, 12], [64, 24], [50, 40], [36, 24]], c); shine(x, 44, 18, 5, 8); },
  amuleto: (x, c) => { x.beginPath(); x.moveTo(20, 8); x.quadraticCurveTo(50, 50, 80, 8); x.lineWidth = 4; x.strokeStyle = shade(GOLD, -0.2); x.stroke(); poly(x, [[50, 44], [72, 62], [50, 94], [28, 62]], c); circ(x, 50, 62, 7, shade(c, 0.4), false); shine(x, 38, 56, 5, 12); },
  pocion: (x, c) => { x.beginPath(); x.moveTo(40, 8); x.lineTo(60, 8); x.lineTo(60, 34); x.bezierCurveTo(84, 44, 86, 88, 50, 92); x.bezierCurveTo(14, 88, 16, 44, 40, 34); x.closePath(); x.fillStyle = 'rgba(210,235,255,0.45)'; x.fill(); x.lineWidth = 3; x.strokeStyle = 'rgba(24,16,30,0.6)'; x.stroke(); x.save(); x.clip(); x.beginPath(); x.rect(0, 52, 100, 50); paint(x, c, 52, 92, false); x.restore(); rr(x, 38, 4, 24, 10, 5, WOOD); shine(x, 28, 50, 5, 22); },
  pan: (x, c) => { x.beginPath(); x.ellipse(50, 56, 38, 28, 0, 0, Math.PI * 2); paint(x, c === '#9aa0ac' ? '#d9a860' : c, 28, 84); for (const px of [30, 50, 70]) { x.beginPath(); x.moveTo(px - 4, 40); x.quadraticCurveTo(px, 52, px + 4, 40); x.lineWidth = 3; x.strokeStyle = 'rgba(120,70,20,0.7)'; x.stroke(); } shine(x, 24, 44, 5, 12); },
  carne: (x, c) => { x.beginPath(); x.moveTo(20, 56); x.bezierCurveTo(14, 20, 60, 12, 74, 34); x.bezierCurveTo(88, 52, 66, 84, 40, 80); x.bezierCurveTo(30, 78, 24, 68, 20, 56); paint(x, c === '#9aa0ac' ? '#c8505a' : c, 14, 84); rr(x, 66, 54, 28, 12, 6, '#efe6d0'); circ(x, 94, 56, 7, '#efe6d0'); circ(x, 94, 68, 7, '#efe6d0'); shine(x, 30, 28, 5, 14); },
  colmillo: (x, c) => { x.beginPath(); x.moveTo(30, 12); x.bezierCurveTo(78, 20, 82, 60, 60, 92); x.bezierCurveTo(60, 60, 48, 40, 30, 36); x.closePath(); paint(x, c === '#9aa0ac' ? '#f1ead4' : c, 12, 92); shine(x, 44, 24, 4, 20); },
  piel: (x, c) => { x.beginPath(); x.moveTo(24, 20); x.quadraticCurveTo(50, 8, 76, 20); x.lineTo(92, 34); x.lineTo(78, 52); x.lineTo(80, 84); x.quadraticCurveTo(50, 94, 20, 84); x.lineTo(22, 52); x.lineTo(8, 34); x.closePath(); paint(x, c === '#9aa0ac' ? '#b88a5a' : c, 8, 92); shine(x, 30, 26, 5, 14); },
  seda: (x, c) => { for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(50, 50, 38 - i * 9, 26 - i * 6, 0.4 * i, 0, Math.PI * 2); x.lineWidth = 6; x.strokeStyle = shade(c === '#9aa0ac' ? '#e8e6f6' : c, -i * 0.12); x.stroke(); } },
  polvo: (x, c) => { x.beginPath(); x.moveTo(14, 84); x.quadraticCurveTo(14, 44, 50, 36); x.quadraticCurveTo(86, 44, 86, 84); x.closePath(); paint(x, c === '#9aa0ac' ? '#d8c890' : c, 36, 84); for (const [px, py] of [[34, 22], [58, 14], [74, 28]] as const) { x.beginPath(); x.arc(px, py, 3, 0, 7); x.fillStyle = 'rgba(255,255,255,0.75)'; x.fill(); } },
  mineral: (x, c) => { x.beginPath(); x.moveTo(12, 78); x.lineTo(28, 36); x.lineTo(54, 22); x.lineTo(84, 40); x.lineTo(90, 80); x.closePath(); x.lineJoin = 'round'; paint(x, '#7a7782', 22, 80); poly(x, [[46, 62], [54, 34], [66, 62]], c); poly(x, [[24, 74], [34, 50], [44, 74]], shade(c, 0.1)); poly(x, [[64, 76], [74, 50], [84, 76]], shade(c, -0.1)); },
  gema: (x, c) => { poly(x, [[50, 14], [80, 34], [50, 90], [20, 34]], c, 3); x.beginPath(); x.moveTo(20, 34); x.lineTo(80, 34); x.moveTo(36, 34); x.lineTo(50, 90); x.moveTo(64, 34); x.lineTo(50, 90); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.45)'; x.stroke(); shine(x, 36, 22, 6, 8); },
  pergamino: (x, c) => { rr(x, 20, 18, 60, 68, 8, c === '#9aa0ac' ? '#f0e4c0' : c); rr(x, 14, 12, 72, 14, 7, '#d8c690'); rr(x, 14, 78, 72, 14, 7, '#d8c690'); for (let i = 0; i < 4; i++) rr(x, 28, 34 + i * 10, 44 - (i % 2) * 10, 4, 2, 'rgba(90,60,40,0.7)', false); },
  bomba: (x, c) => { circ(x, 48, 58, 30, c === '#9aa0ac' ? '#3a3a48' : c); shine(x, 32, 40, 8, 16); rr(x, 42, 22, 12, 10, 3, '#5a5a68'); x.beginPath(); x.moveTo(52, 22); x.quadraticCurveTo(66, 10, 76, 18); x.lineWidth = 4; x.strokeStyle = '#8a6a40'; x.stroke(); circ(x, 78, 16, 7, '#ffb040', false); circ(x, 78, 16, 3.5, '#fff2a0', false); },
  lingote: (x, c) => { x.beginPath(); x.moveTo(24, 38); x.lineTo(80, 38); x.lineTo(92, 70); x.lineTo(14, 70); x.closePath(); paint(x, c, 38, 70); rr(x, 14, 66, 78, 16, 5, shade(c, -0.25)); shine(x, 32, 44, 22, 5); },
  llave: (x, c) => { x.beginPath(); x.arc(32, 32, 18, 0, 7); x.arc(32, 32, 8, 0, 7, true); paint(x, c === '#9aa0ac' ? GOLD : c, 14, 50); rr(x, 28, 44, 9, 48, 4, c === '#9aa0ac' ? GOLD : c); rr(x, 28, 74, 20, 8, 4, c === '#9aa0ac' ? GOLD : c); rr(x, 28, 58, 16, 8, 4, c === '#9aa0ac' ? GOLD : c); },
  saco: (x, c) => { x.beginPath(); x.moveTo(34, 26); x.quadraticCurveTo(10, 56, 18, 80); x.quadraticCurveTo(50, 98, 82, 80); x.quadraticCurveTo(90, 56, 66, 26); x.closePath(); paint(x, c === '#9aa0ac' ? '#b08850' : c, 26, 94); rr(x, 32, 18, 36, 12, 6, shade('#b08850', -0.2)); circ(x, 50, 62, 8, GOLD, false); },
};

const cache = new Map<string, HTMLCanvasElement>();

export function itemIcon(icon: ItemIcon): HTMLCanvasElement {
  const key = `${icon.shape}|${icon.color ?? ''}`;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.scale(S / 100, S / 100);
  ctx.save();
  const fn = SHAPES[icon.shape] ?? SHAPES['saco']!;
  // Sombra suave bajo el objeto.
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  fn(ctx, icon.color ?? '#9aa0ac');
  ctx.restore();
  cache.set(key, c);
  return c;
}

/** Icono listo para meter en el DOM. */
export function itemIconElement(icon: ItemIcon, className = 'item-icon'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  c.className = className;
  c.getContext('2d')!.drawImage(itemIcon(icon), 0, 0);
  return c;
}

export const ICON_SHAPES = Object.keys(SHAPES);
