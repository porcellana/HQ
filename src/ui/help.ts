/** Pantalla de ayuda: controles, HUD, combate, botín y misiones. */
import { h } from './dom';

const SECTIONS: Array<[string, string[]]> = [
  ['🕹️ Moverse', [
    'Toca una casilla del mapa y tu personaje camina hasta allí.',
    'Toca el minimapa (arriba a la derecha) para ir directo a ese punto.',
    'La brújula verde del borde te lleva a tu objetivo (se puede desactivar en Ajustes → Guía de misión). Las salidas se ven brillar en dorado y en el minimapa.',
    'Barra de abajo (una línea): ⏳ Esperar, ✨ Habilidad (se despliega con tus habilidades y la poción), 🎒 Mochila, 📜 Ficha, 📖 Misiones y ⚙ Ajustes. En Ajustes también están Guardar partida, esta ayuda y Guardar y salir.',
    'Opcional: joystick virtual en Ajustes.',
    'Zoom del mapa: pellizca con dos dedos, o usa los botones + y − bajo el minimapa (⟲ vuelve al normal). En PC: rueda del ratón o teclas + − 0.',
  ]],
  ['❤️ Barras', [
    'Roja: puntos de vida (PV). Si llega a 0, caes.',
    'Azul/naranja/verde/amarilla: tu recurso para habilidades (maná, vigor, energía o fe).',
    'Fina dorada: experiencia hasta el siguiente nivel.',
    'Fuera de combate recuperas vida y recurso poco a poco al caminar.',
  ]],
  ['⚔️ Batalla por turnos', [
    'Fuera de batalla caminas libre. Cuando un enemigo te ve (o lo embistes) aparece un «!» y se abre la batalla en una escena aparte: tu grupo (tú, compañero y mascota) a la DERECHA y los enemigos a la IZQUIERDA. El fondo cambia según la zona.',
    'Los turnos van por iniciativa (DES + bonos): los rápidos, como el lobo, actúan antes. Arriba, una barra compacta con los retratos muestra quién actúa y quién va después.',
    'En TU TURNO, el menú de una sola línea: ⚔ Atacar (toca al enemigo), ✨ Habilidad (se despliega con tus habilidades y su coste; al final, 🐾 Órdenes a la mascota), 🎒 Objeto (pociones, Runa de vínculo…), 🛡 Defender (+2 CA hasta tu próximo turno) y 🏃 Huir.',
    'Los hechizos de área golpean a todos los enemigos. Curas y mejoras te dejan elegir aliado tocándolo (en el escenario o en su fila de abajo). Si sólo hay un objetivo posible, se elige solo.',
    'No hay casillas ni alcance: todo objetivo vale. Compañero y mascota actúan solos; a la mascota le puedes dar una orden para su turno.',
    'Ataque = d20 + bonificador contra la CA. Un 20 natural es crítico; un 1, pifia. Huir es una tirada de DES contra 10 + el nivel del enemigo más fuerte; de un jefe no se huye. Al huir vuelves al mapa con unos pasos de inmunidad.',
    'Al ganar: XP (repartida si llevas compañero o mascota), oro y botín directo a la mochila, y el enemigo desaparece del mapa. Si caes, despiertas en el templo.',
    'Ajustes: Velocidad de batalla (Normal o Rápida) y Efectos de batalla (Completos, Reducidos o Mínimos).',
  ]],
  ['🐾 Mascotas', [
    'Tobías, junto al corral de Brumaroja, te da tu primera mascota y Runas de vínculo.',
    'Las criaturas salvajes llevan 🐾. Debilítalas y usa 🎒 Objeto → Runa de vínculo en batalla: cuanta menos vida les quede, más fácil.',
    'Solo llevas una; las demás entrenan en el establo aunque no juegues.',
  ]],
  ['🎒 Botín y equipo', [
    'Lo que sueltan los enemigos brilla en el suelo con el color de su rareza: písalo para recogerlo.',
    'En la Mochila toca un objeto para ver qué mejora (▲) o empeora (▼) antes de equiparlo.',
    'Vende lo que no uses en las tiendas; el Carisma mejora los precios.',
  ]],
  ['📜 Misiones', [
    'Los aldeanos con ❗ tienen una misión; con ❓, puedes entregarla.',
    'Abajo, sobre la barra, ves una línea con la misión que sigues (qué hacer y dónde). Tócala para abrir el menú de misiones.',
    '📖 Misiones (barra de abajo): para cada misión ves qué te falta (▶), lo que ya llevas (✓ y «Tienes 2 de 5»), a dónde ir con la ruta y la recompensa. Con ❗ en el botón hay una lista para entregar.',
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
