/** Mini-ayudante para crear elementos DOM de forma declarativa y tipada. */
type Props = {
  class?: string;
  text?: string;
  html?: string;
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  attrs?: Record<string, string>;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: Array<Node | string | null | undefined | false> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.html !== undefined) el.innerHTML = props.html;
  if (props.onClick) el.addEventListener('click', props.onClick as EventListener);
  if (props.disabled && 'disabled' in el) (el as HTMLButtonElement).disabled = true;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** Vibración corta si el dispositivo y los ajustes lo permiten. */
export function buzz(enabled: boolean, ms = 12): void {
  if (enabled && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* algunos navegadores lo bloquean */
    }
  }
}
