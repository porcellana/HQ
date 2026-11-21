/** Diálogos para exportar e importar la partida como código de texto. */
import { h } from './dom';
import { showDialog } from './dialogs';

export function showExport(root: HTMLElement, code: string): void {
  const area = h('textarea', { class: 'code-area', attrs: { readonly: 'true', rows: '6' } });
  area.value = code;
  const info = h('p', { text: 'Copia este código y guárdalo (en notas, un mensaje a ti mismo…). Con «Importar partida» lo puedes cargar en la web o en el APK.' });
  const status = h('small', { class: 'muted' });
  showDialog(root, 'Exportar partida', h('div', { class: 'transfer' }, [info, area, status]), [
    {
      label: 'Copiar código',
      kind: 'primary',
      action: () => {
        area.select();
        const ok = () => (status.textContent = '¡Copiado al portapapeles!');
        const fail = () => {
          try {
            document.execCommand('copy');
            ok();
          } catch {
            status.textContent = 'No se pudo copiar: mantén pulsado el texto y elige Copiar.';
          }
        };
        if (navigator.clipboard) navigator.clipboard.writeText(code).then(ok, fail);
        else fail();
        return false;
      },
    },
    {
      label: 'Descargar como archivo',
      action: () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
        a.download = `ecos-del-abismo-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        return false;
      },
    },
    { label: 'Cerrar' },
  ]);
}

/** Pide un código; `onCode` devuelve un error (se muestra) o null si fue bien. */
export function showImport(root: HTMLElement, onCode: (code: string) => Promise<string | null>): void {
  const area = h('textarea', { class: 'code-area', attrs: { rows: '6', placeholder: 'Pega aquí el código (empieza por ECOS1:)' } });
  const status = h('small', { class: 'warn-text' });
  const file = h('input', { attrs: { type: 'file', accept: '.txt,text/plain' } });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (f) area.value = await f.text();
  });
  const close = showDialog(root, 'Importar partida', h('div', { class: 'transfer' }, [
    h('p', { text: 'Pega el código exportado o elige el archivo. Sustituirá a tu partida guardada actual.' }),
    area, file, status,
  ]), [
    {
      label: 'Importar',
      kind: 'primary',
      action: () => {
        void onCode(area.value).then((err) => {
          if (err) status.textContent = err;
          else close();
        });
        return false;
      },
    },
    { label: 'Cancelar' },
  ]);
}
