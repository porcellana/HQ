import { ctx2d, makeCanvas } from './canvas';

/** Silueta de un sprite en un color (para el destello al recibir daño). */
const silCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
export function silhouette(img: HTMLCanvasElement, color = '#ffffff'): HTMLCanvasElement {
  let m = silCache.get(img);
  if (!m) silCache.set(img, (m = new Map()));
  let c = m.get(color);
  if (!c) {
    c = makeCanvas(img.width, img.height);
    const x = ctx2d(c);
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    m.set(color, c);
  }
  return c;
}
