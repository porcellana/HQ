/** Dibujo de efectos de batalla en píxeles de pantalla (sin estado; k de 0 a 1). */
import { ELEMENT_COLORS, lightningPath, slashArc, type Element } from '@/gfx/battleFx';

type C = CanvasRenderingContext2D;

function glow(ctx: C, x: number, y: number, r: number, inner: string, outer: string, a = 1): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Tajo en arco con estela que se desvanece. `dir` = -1 golpea hacia la izquierda. */
export function drawSlash(ctx: C, x: number, y: number, r: number, dir: number, k: number, color: string, crit: boolean, flip = false): void {
  const a0 = (dir < 0 ? Math.PI * 1.25 : -Math.PI * 0.25) * 1;
  const sweep = (dir < 0 ? 1 : -1) * Math.PI * 0.95 * (flip ? -1 : 1);
  const head = Math.min(1, k * 1.6);
  const pts = slashArc(x, y, r, a0, sweep, head);
  const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let pass = 0; pass < 3; pass++) {
    ctx.strokeStyle = pass === 0 ? color : pass === 1 ? '#ffffff' : color;
    ctx.globalAlpha = fade * (pass === 0 ? 0.35 : 0.9);
    ctx.lineWidth = (pass === 0 ? 14 : pass === 1 ? 4 : 8) * (crit ? 1.5 : 1);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    if (pass === 1) ctx.lineWidth = 2;
  }
  ctx.restore();
}

export function drawThrust(ctx: C, x: number, y: number, len: number, dir: number, k: number, color: string): void {
  const fade = 1 - k;
  const e = Math.min(1, k * 2.2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.strokeStyle = i === 0 ? '#ffffff' : color;
    ctx.globalAlpha = fade * (i === 0 ? 1 : 0.5);
    ctx.lineWidth = i === 0 ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(x - dir * len, y + i * 5);
    ctx.lineTo(x - dir * len + dir * len * 1.1 * e, y + i * 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** Onda de choque de golpe contundente. */
export function drawShock(ctx: C, x: number, y: number, r: number, k: number, color: string): void {
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5 * (1 - k) + 1;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.3, r * k, r * k * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Explosión de magia con forma propia por elemento. */
export function drawExplosion(ctx: C, x: number, y: number, k: number, r: number, el: Element): void {
  const [a, b] = ELEMENT_COLORS[el];
  const fade = 1 - k;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  switch (el) {
    case 'fuego':
      glow(ctx, x, y - k * r * 0.3, r * (0.5 + k), a, 'rgba(255,60,0,0)', fade);
      glow(ctx, x, y - k * r * 0.5, r * (0.35 + k * 0.6), '#fff', b, fade * 0.7);
      break;
    case 'frio':
      ctx.strokeStyle = a;
      ctx.lineWidth = 3;
      ctx.globalAlpha = fade;
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * Math.PI * 2;
        const l0 = r * 0.2 * k;
        const l1 = r * (0.3 + 0.9 * Math.min(1, k * 1.5));
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * l0, y + Math.sin(an) * l0);
        ctx.lineTo(x + Math.cos(an) * l1, y + Math.sin(an) * l1);
        ctx.stroke();
      }
      glow(ctx, x, y, r * 0.6, '#fff', b, fade * 0.6);
      break;
    case 'rayo': {
      ctx.globalAlpha = fade;
      ctx.lineCap = 'round';
      const p = lightningPath(x + 6, y - r * 2.2, x, y, Math.floor(k * 6) + 1, 7, 12);
      for (const [w, c] of [[8, b], [3, '#fff']] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
      }
      glow(ctx, x, y, r * 0.8, '#fff', b, fade * 0.6);
      break;
    }
    case 'sagrado':
      ctx.globalAlpha = fade;
      glow(ctx, x, y, r * 0.7, '#fff', b, fade);
      ctx.fillStyle = a;
      ctx.fillRect(x - r * 0.28 * fade, y - r * 2.2, r * 0.56 * fade, r * 2.4);
      break;
    case 'necrotico':
      for (let i = 0; i < 3; i++) {
        const an = k * 7 + (i * Math.PI * 2) / 3;
        glow(ctx, x + Math.cos(an) * r * (1 - k) * 0.8, y + Math.sin(an) * r * (1 - k) * 0.5, r * 0.4, a, b, fade);
      }
      glow(ctx, x, y, r * 0.7 * (1 - k * 0.4), b, 'rgba(0,0,0,0)', fade);
      break;
    case 'veneno':
      for (let i = 0; i < 6; i++) {
        const an = i * 1.9;
        glow(ctx, x + Math.cos(an) * r * 0.6 * k, y - k * r * 0.9 * ((i % 3) / 3 + 0.4) + Math.sin(an) * 4, r * 0.25, a, b, fade);
      }
      break;
    default:
      ctx.strokeStyle = a;
      ctx.globalAlpha = fade;
      ctx.lineWidth = 4 * fade + 1;
      ctx.beginPath();
      ctx.arc(x, y, r * (0.3 + k), 0, Math.PI * 2);
      ctx.stroke();
      glow(ctx, x, y, r * 0.6, '#fff', b, fade * 0.8);
  }
  ctx.restore();
}

/** Columna de luz que sube con anillo (curaciones). */
export function drawHealLight(ctx: C, x: number, y: number, k: number, r: number, color = '#90ffb0'): void {
  const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y - r * 3, 0, y + r * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, color);
  ctx.globalAlpha = fade * 0.6;
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 0.55, y - r * 3, r * 1.1, r * 3.5);
  ctx.globalAlpha = fade;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.4 - k * r * 2.4, r * 0.8, r * 0.25, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Aura de mejora: anillos que ascienden alrededor del objetivo. */
export function drawAura(ctx: C, x: number, y: number, k: number, r: number, color: string): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const kk = (k + i / 3) % 1;
    ctx.globalAlpha = (1 - kk) * 0.9 * (k < 0.85 ? 1 : (1 - k) / 0.15);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.5 - kk * r * 1.8, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  glow(ctx, x, y - r * 0.4, r * 1.1, color, 'rgba(0,0,0,0)', 0.35 * Math.sin(Math.min(1, k) * Math.PI));
  ctx.restore();
}

/** Estrella de crítico: rayos que se abren y se desvanecen. */
export function drawCritStar(ctx: C, x: number, y: number, k: number, r: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = '#fff2a0';
  ctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const an = (i / 10) * Math.PI * 2 + 0.3;
    const l0 = r * 0.3 + k * r * 0.5;
    const l1 = r * (0.7 + k * 0.9) * (i % 2 ? 0.7 : 1);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(an) * l0, y + Math.sin(an) * l0);
    ctx.lineTo(x + Math.cos(an) * l1, y + Math.sin(an) * l1);
    ctx.stroke();
  }
  glow(ctx, x, y, r * 0.8, '#fff', 'rgba(255,200,60,0)', (1 - k) * 0.9);
  ctx.restore();
}

/** Oscurece los bordes (viñeta) en un lienzo reutilizable. */
export function makeVignette(w: number, h: number, tint: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.fillStyle = tint;
  x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.3, w / 2, h * 0.55, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  return c;
}
