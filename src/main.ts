/** Punto de entrada. */
import './ui/styles.css';
import { Capacitor } from '@capacitor/core';
import { App } from './app';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const ui = document.getElementById('ui');
if (!canvas || !ui) throw new Error('Falta #game o #ui en index.html');

const gl3d = document.getElementById('game3d') as HTMLCanvasElement | null;
if (!gl3d) throw new Error('Falta #game3d en index.html');
const app = new App(canvas, ui, gl3d);
void app.start();

// PWA: service worker sólo en producción y fuera de la app nativa.
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e: unknown) => console.warn('SW no registrado', e));
  });
}
