/**
 * Botones de zoom del mapa («+», «−» y «⟲»), discretos y semitransparentes,
 * en el lateral derecho bajo el minimapa. El pellizco, la rueda del ratón y
 * las teclas +/− hacen lo mismo.
 */
import { h } from './dom';

export class ZoomControls {
  readonly el: HTMLDivElement;
  private readonly plus: HTMLButtonElement;
  private readonly minus: HTMLButtonElement;
  private readonly reset: HTMLButtonElement;

  constructor(onZoom: (dir: -1 | 0 | 1) => void) {
    this.plus = h('button', { class: 'zoom-btn', text: '+', onClick: () => onZoom(1), attrs: { 'aria-label': 'Acercar mapa' } });
    this.minus = h('button', { class: 'zoom-btn', text: '−', onClick: () => onZoom(-1), attrs: { 'aria-label': 'Alejar mapa' } });
    this.reset = h('button', { class: 'zoom-btn small', text: '⟲', onClick: () => onZoom(0), attrs: { 'aria-label': 'Zoom por defecto' } });
    this.el = h('div', { class: 'zoom-ctl' }, [this.plus, this.minus, this.reset]);
  }

  /** Atenúa los botones en los extremos y muestra «⟲» solo si el zoom no es el de por defecto. */
  update(step: number, limits: { min: number; max: number }): void {
    this.plus.disabled = step >= limits.max;
    this.minus.disabled = step <= limits.min;
    this.reset.style.display = step === 0 ? 'none' : '';
  }
}
