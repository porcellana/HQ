/** Pantalla de ayuda: controles, HUD, combate, botín y misiones. */
import { h } from './dom';

const SECTIONS: Array<[string, string[]]> = [
  ['🕹️ Moverse', [
    'Toca una casilla del mapa y tu personaje camina hasta allí.',
    'Toca el minimapa (arriba a la derecha) para ir directo a ese punto.',
    'Las flechas doradas del borde señalan las salidas. La verde con ★ lleva hacia tu objetivo.',
    'Opcional: joystick virtual en Ajustes.',
  ]],
  ['❤️ Barras', [
    'Roja: puntos de vida (PV). Si llega a 0, caes.',
    'Azul/naranja/verde/amarilla: tu recurso para habilidades (maná, vigor, energía o fe).',
    'Fina dorada: experiencia hasta el siguiente nivel.',
    'Fuera de combate recuperas vida y recurso poco a poco al caminar.',
  ]],
  ['⚔️ Combate por turnos', [
    'Fuera de combate caminas libre. Cuando un enemigo te ve empieza el combate: arriba sale la barra de turnos con los retratos en orden (el que actúa, resaltado).',
    'En TU TURNO tienes 👣 movimiento (casillas; Guerrero, Mago y Clérigo 5, Pícaro 6) y UNA ⚔ acción. Puedes moverte, actuar y volver a moverte.',
    'Las casillas azules son las que alcanzas: tócalas para moverte. Si tocas más lejos, avanzas lo que puedas.',
    'Acciones: ⚔ Atacar (toca al enemigo resaltado), ✨ Habilidad, 🧪 Objeto, 🛡 Defender (+2 CA hasta tu próximo turno), 👟 Correr (doble movimiento), 🏃 Huir y 🔮 Vincular. 🐾 Órdenes a la mascota no gasta la acción.',
    '⏭ Terminar turno cuando quieras (se termina solo si ya no te queda acción ni movimiento).',
    'Después actúan tus aliados y los enemigos, de uno en uno: en «Paso a paso» (Ajustes → Velocidad del combate) pulsa ▶ Siguiente o toca la pantalla para ver cada acción.',
    'Ataque = d20 + bonificador contra la CA. Un 20 natural es crítico; un 1, pifia. El número sobre un enemigo es su nivel: en rojo con ☠, huye o vuelve más fuerte.',
    'Los enemigos también se mueven varias casillas y atacan en el mismo turno: los lobos corren mucho, los zombis muy poco. Ralentizado = la mitad de movimiento.',
  ]],
  ['🐾 Mascotas', [
    'Tobías, junto al corral de Brumaroja, te da tu primera mascota y Runas de vínculo.',
    'Las criaturas salvajes llevan 🐾. Debilítalas y usa 🔮 Vincular: cuanta menos vida les quede, más fácil.',
    'Solo llevas una; las demás entrenan en el establo aunque no juegues.',
  ]],
  ['🎒 Botín y equipo', [
    'Lo que sueltan los enemigos brilla en el suelo con el color de su rareza: písalo para recogerlo.',
    'En la Mochila toca un objeto para ver qué mejora (▲) o empeora (▼) antes de equiparlo.',
    'Vende lo que no uses en las tiendas; el Carisma mejora los precios.',
  ]],
  ['📜 Misiones', [
    'Los aldeanos con ❗ tienen una misión; con ❓, puedes entregarla.',
    'Tu objetivo actual aparece arriba, bajo el panel de vida, con la zona donde cumplirlo.',
    'Diario completo: Ficha → Misiones.',
  ]],
  ['🏰 Mazmorras', [
    'Los cofres dan botín; algunos están cerrados (el Pícaro los abre mejor).',
    'Las trampas detectadas se ven con borde rojo: tócalas para desactivarlas y ganar XP.',
    'Con un pico equipado puedes picar vetas de mineral.',
    'Al vencer al jefe, la mazmorra se renueva para la próxima vez.',
  ]],
  ['💾 Guardado', [
    'Se guarda solo al cambiar de zona, cada pocos turnos y al salir. También en la posada.',
    'Ajustes → Exportar partida: copia de seguridad o pasarla entre la web y el APK.',
  ]],
];

export function helpScreen(onClose: () => void): HTMLElement {
  return h('div', { class: 'screen help' }, [
    h('h2', { text: 'Cómo se juega' }),
    ...SECTIONS.map(([title, lines]) => h('div', { class: 'panel' }, [h('h3', { text: title }), h('ul', { class: 'help-list' }, lines.map((l) => h('li', { text: l })))])),
    h('div', { class: 'menu-buttons' }, [h('button', { class: 'primary', text: 'Entendido', onClick: onClose })]),
  ]);
}
