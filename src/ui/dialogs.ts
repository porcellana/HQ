/** Diálogos modales reutilizables (confirmar, aviso, menú de opciones). */
import { h } from './dom';

export interface DialogButton {
  label: string;
  kind?: 'primary' | 'danger';
  /** Devuelve false para no cerrar el diálogo. */
  action?: () => void | boolean;
}

export function showDialog(root: HTMLElement, title: string, body: string | Node | null, buttons: DialogButton[]): () => void {
  const back = h('div', { class: 'modal-back' });
  const close = () => back.remove();
  const modal = h('div', { class: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true' } }, [
    h('h3', { text: title }),
    typeof body === 'string' ? h('p', { text: body }) : body,
    h(
      'div',
      { class: 'buttons' },
      buttons.map((b) =>
        h('button', {
          class: b.kind ?? '',
          text: b.label,
          onClick: () => {
            if (b.action?.() !== false) close();
          },
        }),
      ),
    ),
  ]);
  back.append(modal);
  root.append(back);
  return close;
}

export function confirmDialog(root: HTMLElement, title: string, body: string, okLabel = 'Aceptar', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    showDialog(root, title, body, [
      { label: okLabel, kind: danger ? 'danger' : 'primary', action: () => resolve(true) },
      { label: 'Cancelar', action: () => resolve(false) },
    ]);
  });
}
