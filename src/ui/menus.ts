/** Pantallas de menú: principal, ajustes y menú de pausa. */
import { getZoneDef } from '@/data/registry';
import type { SaveSummary } from '@/game/save/saveManager';
import type { Settings } from '@/game/settings';
import { DEFAULT_HERO_COLORS, humanoidSprite } from '@/gfx/sprites';
import { h } from './dom';

export interface MainMenuActions {
  onContinue(): void;
  onNewGame(): void;
  onSettings(): void;
}

function heroImage(): HTMLCanvasElement {
  const c = h('canvas', { class: 'menu-hero' });
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(humanoidSprite(DEFAULT_HERO_COLORS).right, 0, 0);
  return c;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function mainMenu(save: SaveSummary | null, actions: MainMenuActions): HTMLElement {
  const zoneName = save ? (getZoneDef(save.zone)?.name ?? save.zone) : '';
  const cont = h('button', { class: 'primary', onClick: actions.onContinue, disabled: !save }, [
    'Continuar',
    save ? h('span', { class: 'save-info', text: `${save.name} · Nv ${save.level} · ${zoneName} · ${formatDate(save.savedAt)}` }) : null,
  ]);
  return h('div', { class: 'screen main-menu' }, [
    heroImage(),
    h('h1', { text: 'ECOS DEL ABISMO' }),
    h('div', { class: 'subtitle', text: 'Un mazmorreo de espada, dados y sombra' }),
    h('div', { class: 'menu-buttons' }, [
      cont,
      h('button', { text: 'Nueva partida', onClick: actions.onNewGame }),
      h('button', { text: 'Ajustes', onClick: actions.onSettings }),
    ]),
    h('div', { class: 'version', text: `v${__APP_VERSION__} · ${__BUILD_DATE__}` }),
  ]);
}

type Option<T> = { value: T; label: string };

/** Pantalla de ajustes. `onChange` recibe los ajustes nuevos al instante. */
export function settingsScreen(
  current: Settings,
  onChange: (s: Settings) => void,
  onBack: () => void,
  onDeleteSave: (() => void) | null,
  transfer?: { onExport: () => void; onImport: () => void },
): HTMLElement {
  const s = { ...current };
  const row = <K extends keyof Settings>(label: string, key: K, options: Option<Settings[K]>[]) => {
    const btn = h('button');
    const refresh = () => (btn.textContent = options.find((o) => o.value === s[key])?.label ?? String(s[key]));
    btn.addEventListener('click', () => {
      const i = options.findIndex((o) => o.value === s[key]);
      s[key] = options[(i + 1) % options.length]!.value;
      refresh();
      onChange({ ...s });
    });
    refresh();
    return h('div', { class: 'setting-row' }, [h('span', { text: label }), btn]);
  };
  const onOff: Option<boolean>[] = [
    { value: true, label: 'Sí' },
    { value: false, label: 'No' },
  ];
  return h('div', { class: 'screen' }, [
    h('h2', { text: 'Ajustes' }),
    h('div', { class: 'settings-list' }, [
      row('Velocidad del combate', 'combatSpeed', [
        { value: 'paso', label: 'Paso a paso' },
        { value: 'lenta', label: 'Lenta' },
        { value: 'normal', label: 'Normal' },
      ]),
      row('Joystick virtual', 'joystick', onOff),
      row('Mano dominante', 'hand', [
        { value: 'derecha', label: 'Derecha' },
        { value: 'izquierda', label: 'Izquierda' },
      ]),
      row('Velocidad al caminar', 'moveSpeed', [
        { value: 'normal', label: 'Normal' },
        { value: 'rapida', label: 'Rápida' },
      ]),
      row('Tamaño de interfaz', 'uiScale', [
        { value: 'normal', label: 'Normal' },
        { value: 'grande', label: 'Grande' },
      ]),
      row('Cuadrícula del mapa', 'grid', onOff),
      row('Vibración', 'vibration', onOff),
      row('Sonido', 'sound', onOff),
      row('Volumen', 'volume', [
        { value: 'bajo', label: 'Bajo' },
        { value: 'medio', label: 'Medio' },
        { value: 'alto', label: 'Alto' },
      ]),
      row('Día y noche', 'dayNight', onOff),
      row('Guía de misión (flecha GPS)', 'questGuide', onOff),
      transfer ? h('button', { text: '📤 Exportar partida', onClick: transfer.onExport }) : null,
      transfer ? h('button', { text: '📥 Importar partida', onClick: transfer.onImport }) : null,
      onDeleteSave ? h('button', { class: 'danger', text: 'Borrar partida guardada', onClick: onDeleteSave }) : null,
      h('button', { class: 'primary', text: 'Volver', onClick: onBack }),
    ]),
  ]);
}
