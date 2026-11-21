/** Minimapa: la zona a 1 píxel por casilla, con el jugador parpadeando. */
import type { Zone } from '@/game/world/zone';

export class Minimap {
  readonly el: HTMLCanvasElement;
  private base: HTMLCanvasElement | null = null;
  private zone: Zone | null = null;
  private t = 0;

  constructor() {
    this.el = document.createElement('canvas');
    this.el.className = 'minimap';
    this.el.width = 64;
    this.el.height = 64;
  }

  private build(zone: Zone): void {
    const scale = Math.max(1, Math.floor(64 / Math.max(zone.width, zone.height)));
    const c = document.createElement('canvas');
    c.width = zone.width * scale;
    c.height = zone.height * scale;
    const ctx = c.getContext('2d')!;
    for (let y = 0; y < zone.height; y++) {
      for (let x = 0; x < zone.width; x++) {
        ctx.fillStyle = zone.tileAt(x, y)?.minimap ?? '#000';
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    ctx.fillStyle = '#f2d888';
    for (const e of zone.exits) ctx.fillRect(e.x * scale, e.y * scale, scale, scale);
    this.base = c;
    this.zone = zone;
  }

  draw(zone: Zone, px: number, py: number, dt: number): void {
    if (this.zone !== zone) this.build(zone);
    const base = this.base!;
    this.t += dt;
    const ctx = this.el.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 64, 64);
    const ox = Math.floor((64 - base.width) / 2);
    const oy = Math.floor((64 - base.height) / 2);
    ctx.drawImage(base, ox, oy);
    const scale = base.width / zone.width;
    if (Math.floor(this.t * 3) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + Math.round(px * scale) - 1, oy + Math.round(py * scale) - 1, scale + 2, scale + 2);
    }
    ctx.fillStyle = '#e05050';
    ctx.fillRect(ox + Math.round(px * scale), oy + Math.round(py * scale), scale, scale);
  }
}
