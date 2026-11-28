# Registro de cambios

Formato: versión · fecha · cambios. La versión también aparece en el menú principal.

## v0.12.1 · 2026-11-28 — Cámara con dos dedos y niebla de exploración

- **Cámara (como los mapas móviles)**: pellizco = zoom continuo; torcer con dos dedos = girar (el mundo sigue a los dedos, con inercia ligera); arrastrar con dos dedos arriba/abajo = inclinar (con límites). Un dedo solo toca para caminar/interactuar, ya no gira. Doble toque con dos dedos o el botón ⟲ recentran. El joystick sigue la cámara. Ajustes: «Cámara: invertir giro», «Cámara: sensibilidad» (Baja/Media/Alta) y «Recentrar cámara». Lógica pura en `src/engine/gestures.ts` con tests.
- **Niebla de exploración 3D**: lo desconocido se cubre de bruma oscura y volumétrica (ruido animado + dos láminas flotantes) con bordes suaves que se despejan al acercarte; lo explorado queda atenuado (se ve el terreno, no los enemigos/PNJ lejanos). Radio de visión según clase, hora y zona, con línea de visión en mazmorras y cuevas. Una textura de visibilidad de 1 texel por casilla se sube solo cuando cambia (nada por casilla en cada fotograma). Minimapa y mapa grande muestran solo lo explorado. Se guarda (save v11, `world.explored`). Ajustes: «Niebla de exploración» Sí/No. Aldeas e interiores no tienen niebla.

## v0.12.0 · 2026-11-28 — Música y ambiente procedurales

- **Música generada por código** (WebAudio, sin ficheros: el APK no engorda): una pieza distinta por bioma y lugar (campiña, bosque, montaña, nieve, costa, desierto, ciénaga, aldea, ciudad, puerto, campamento, ruinas, interior, cueva, cripta y sala de jefe), con fundido cruzado al cambiar de zona, variaciones por semilla de partida y más lenta/grave de noche.
- **Batalla**: música normal, oscura (cuevas, mazmorras, ciénaga) y de jefe; el tempo y la percusión suben según avanza el combate. Fanfarrias breves de victoria y derrota.
- **Ambiente**: viento, agua, pájaros de día, grillos de noche, goteo en cuevas y fuego en aldeas/campamentos.
- **Efectos nuevos**: pasos según el suelo, clic suave de interfaz, compra y sonido de botín por rareza.
- **Ajustes**: Sonido general, Música, Efectos y Ambiente por separado. Silencio al pasar a segundo plano; el audio arranca con el primer toque.
- Lógica de composición pura y con tests (`tests/music.test.ts`); datos en `src/data/music`.

## v0.11.0 · 2026-11-28 — Todo en 3D suave, señalización diegética e interfaz nueva

- **Adiós al 2D**: eliminados el renderizador 2D, el respaldo 2D del mapa, los sprites de personajes/criaturas/mascotas, los tiles pixel art y el sistema de partículas 2D. Sin WebGL 2 se muestra un mensaje claro. Menos código y APK más ligero.
- **Geometría y luz suaves**: primitivas redondeadas con normales por vértice (elipsoides, cajas biseladas, revoluciones, cápsulas, cintas), árboles/rocas/arbustos orgánicos, casas con bisel y esquinas redondeadas, tejados con tejas, relieve de curvas suaves, cielo con degradado, nubes y estrellas, luz envolvente con contraluz, halos de luz, MSAA y faldón de terreno fuera del mapa. El héroe tapado se ve como silueta translúcida.
- **Modelos animados**: todos los personajes, PNJ, compañeros, mascotas, enemigos y jefes son modelos 3D con idle, caminar, atacar (melee, lanzar, arco, bestia), recibir golpe, morir, celebrar y defender. Cada una de las 8 clases tiene sombrero/casco, capa y arma propios.
- **Batalla 100 % 3D**: escenario del bioma con cielo, combatientes animados, sombras, auras de estado, anillos de turno/objetivo, cámara suave sin zoom brusco, proyectiles 3D con estela, partículas luminosas por elemento, explosiones, curación, mejoras, críticos, onda de choque, hit-stop, números flotantes con estilo y desintegración 3D con borde brillante.
- **Señalización diegética**: cristales giratorios sobre PNJ (misión, entrega, tienda, peligro), chispas en cofres y vetas, anillos de runas en salidas y destinos y un espíritu luminoso que guía hacia la misión seguida (opcional en Ajustes). Fuera el haz de luz, la flecha y los ❗/💬 planos; el nombre de zona es una pastilla pequeña.
- **Interfaz nueva «Pergamino y cristal»**: paneles de cristal, hojas inferiores deslizables para Mochila/Ficha/Misiones/Mascotas/Tienda/Ajustes, barra inferior compacta, menú principal y de batalla renovados, retratos 3D, iconos de objetos vectoriales, animaciones de entrada.
- **Rendimiento**: calidad Baja/Media/Alta (Media por defecto, baja sola si caen los fps), instancing, retratos cacheados.
- Ajustes: desaparecen «Gráficos» y «Volumen 3D». Sin cambios de guardado.

## v0.10.0 · 2026-11-28 — Mundo en 3D («Brumavela» + Ecos del Abismo)

- **Gráficos 3D (WebGL2, sin librerías)** en `src/gfx/world3d/`: las casillas de cada zona (a mano o generadas) se extruyen a terreno con relieve suave, **agua animada con orillas y espuma**, árboles, pinos, palmeras, rocas, montañas por altura, casas con tejado a dos aguas y ventanas, muros, antorchas, faroles, hogueras y cristales (con luz puntual), vegetación que se mece con el viento, AO horneado y sombras suaves bajo las criaturas, niebla y luz por **bioma y hora del día**, partículas ambientales (polen, luciérnagas, nieve, polvo, esporas) y «ver a través» de lo que tapa al jugador.
- **Criaturas low-poly animadas** (humanoides por clase con sombrero/casco/capa, cuadrúpedos, arañas, serpientes, voladores, medusas, escarabajos y brotes), compañero, mascota, PNJ con ❗/❓ y nombre, cofres, vetas brillantes y botín con el color de su rareza. Etiquetas y números flotantes proyectados.
- **Cámara inclinada** con giro (arrastra con un dedo o botón ↻), zoom (pellizco/botones/rueda) y seguimiento suave; el joystick y las teclas siguen a la cámara. **Toca una criatura u objeto** para ir hasta él.
- **Ajustes → Gráficos** (3D / 2D clásico, con respaldo automático si falla WebGL) y **Calidad** Baja/Media/Alta (Media por defecto; **baja sola** si los fps caen). Batalla: el escenario del bioma es un diorama 3D con los sprites de siempre encima.
- **Jugabilidad**: botón contextual **Interactuar** (hablar, abrir, minar, recoger), haz de luz y flecha 3D hacia la misión, **4 clases nuevas** (Bárbaro, Explorador, Druida y Bardo, con habilidades, talentos y equipo), **ríos, puentes y costas** en el mundo procedural, **eventos al viajar** (bolsa, frasco, manantial, emboscada), exportar/importar también desde el menú principal, joystick activado por defecto en instalaciones nuevas.
- Sin cambios de guardado.

## v0.9.5 · 2026-11-27 — Fichas de botín

- Al ganar una batalla, el botín sale como fichas con icono, color de rareza y destello.

## v0.9.4 · 2026-11-27 — Botín, economía, comercio y +130 objetos

- **Objetos**: ~135 nuevos (armas por clase y nivel hasta 19, armaduras y escudos por clase, anillos y amuletos, pociones, elixires, pergaminos, **bombas** con estados, comida, materiales, minerales, hierbas y objetos de misión). Requisitos de **clase y nivel** (`classes`, `reqLevel`), 7 iconos nuevos (varita, lanza, ballesta, bomba, lingote, pergamino, llave).
- **Rarezas con afijos con nombre** («Feroz Hacha de guerra del Oso»), **conjuntos** de 4 piezas (Bastión del Alba, Sombra de Ónix, Vestiduras del Cometa, Vigilia Solar) y de 3 (Furia del Dragón) con bonos a 2/4 piezas, y **únicos de jefe** siempre legendarios (Gruñaz, Mórgala, Velkar y jefes generados).
- **Botín**: tablas por bioma (`drop_<bioma>`), jefes con equipo raro o mejor y un único casi garantizado, favorece el equipo de tu clase, cofres cerrados con más suerte; destello y texto de rareza al recoger, ✦ en el resumen de batalla.
- **Oro y XP**: oro × (1 + 6 % por nivel) × dificultad (enemigo por encima de tu nivel paga hasta +50 %, por debajo casi nada); bonus de XP por grupos numerosos (hasta +40 %) y jefes (+25 %). Sumideros: mejora de equipo +1..+3 en herreros, bolsa misteriosa y posada.
- **Comercio**: herrería, alquimia, armería, arcanos y **mercado negro** en pueblos y ciudades generados; stock rotativo por semilla y tiempo; reputación (hasta −10 % por lo gastado); **recompra**, filtros por tipo, orden, flechas ▲▼ y 🔒, **venta de basura**.
- Sin cambios de guardado (campos opcionales `plus` y `buyback`).

## v0.9.3 · 2026-11-27 — Batalla más espectacular

- **Ataques con carácter**: tajos con estela, estocadas, golpes contundentes con onda de choque y salto, garras, flechas con trayectoria en arco, proyectiles y **explosiones por elemento** (fuego, hielo con esquirlas, rayo quebrado, veneno, luz sagrada, sombra, arcano); carga de energía al lanzar y salvas a varios objetivos.
- **Impacto**: hit-stop corto, sacudida, destello, deformación del sprite; **críticos** con estrella, destello de pantalla y doble tajo; vibración también al crítico propio.
- **Números de daño con estilo** (crítico dorado con pop, resistido gris, vulnerable naranja ↑, curación verde, fallo cursivo que se desliza), barras de vida con estela de daño y color por nivel.
- **Curaciones** con columna de luz, **mejoras** con aura de anillos, entrada de enemigos (los jefes caen con temblor y destello), muerte con destello y desintegración (más larga en jefes), aura de color bajo los pies según el estado.
- **Escenarios**: parallax suave, partículas ambientales por bioma en dos capas (hojas, nieve, brasas, esporas, niebla, burbujas, polvo), viñeta y tinte de iluminación. Código en `gfx/battleFx.ts` (lógica pura, con tests) y `ui/battleFxDraw.ts`.

## v0.9.1 · 2026-11-27 — Mascotas: especies, evoluciones ramificadas y poderes

- **42 especies** (antes 15) con sprites nuevos (zorro, pájaro, serpiente, escarabajo y medusa) y dos tipos nuevos, **hielo** ❄️ y **rayo** ⚡ (8 tipos con su tabla de eficacia). Hábitats también en el mundo procedural: `bioma:<id>` (nieve, montaña, costa, desierto, pantano, bosque, pradera) y `lugar:<cueva|mazmorra|ruinas>`; las etapas 2 y 3 sólo salen en zonas de nivel 8+ y 16+.
- **Evoluciones ramificadas**: por nivel, **vínculo** (p. ej. Escarchín → Auroral con vínculo 60), **naturaleza** (Venenal → Sombralisco) u **objeto** (piedras de trueno, escarcha y solar, que se compran en el establo). Si hay varias ramas, eliges el camino. Más líneas de etapa 3 (Montañón, Cristalón, Noctámbulo, Serafón…).
- **~36 movimientos nuevos** por tipo con estados (ralentizar, aturdir, veneno, sangrado, quemar), golpes múltiples, drenaje de vida, limpiar estados y apoyo al jugador (+CA, +daño, +ataque). Aparecen en ✨ Habilidad → Órdenes a la mascota y la IA los usa sola.
- **Poderes pasivos** por especie en batalla: regeneración, cuidador (cura al jugador), furia, tenaz, vigía (+CA) y cazador.
- **Naturalezas** (8, ±10 % a dos estadísticas) y **vínculo** con 4 niveles (Amistosa, Leal: recargas −1 turno, Inseparable: resiste un golpe mortal por combate). Se sube luchando, ganando XP y **acariciando** (+3 cada 30 min).
- Nivel máximo 30 y crecimiento propio por especie. Ficha con naturaleza, poder, ramas y botón de piedra. Guardado v10 (migración: naturaleza a las mascotas existentes).

## v0.8.0 · 2026-11-27 — Mundo procedural por semilla

- **El mundo se genera al explorar**: la aldea, el bosque, el Paso Gris y Puerto Ceniza siguen siendo el núcleo; ahora tienen salidas extra (oeste/este/norte) hacia una rejilla de zonas generadas (radio 8) con la semilla de la partida (misma semilla = mismo mundo). Cada zona se crea al cruzar la salida y se **guarda en la partida** (migración v8→v9, `world.gen`).
- **Biomas** (en `src/data/biomes`): praderas, bosque, montañas, nieve, desierto, pantano y costa, con tiles nuevos (arena, cactus, palmeras, nieve, pino nevado, hielo, cieno, árbol seco, grava, peñas, tiendas de campaña, fogata, muros en ruinas), enemigos propios (lobo de las nieves, yeti, escorpión, momia, sapo, cangrejo, pirata, bandido, oso, jabalí), botín y materiales propios, tinte de color y ambiente. Los biomas vecinos son siempre compatibles (si chocan, un bioma «puente» los separa).
- **Lugares**: aldeas, pueblos y ciudades (casas, tienda, posada, herrero, templo/gremio y vecinos con nombre y rumores sobre sitios cercanos), campamentos con mercader, ruinas con tumbas, cofres y trampas, cuevas y mazmorras (reutilizan el generador de pisos; la mazmorra acaba en un jefe), cofres y minerales.
- **Niveles**: cada zona nace con el nivel del jugador ±1 y queda fijado; sus enemigos, cofres y jefe escalan a ese nivel (rarezas y afijos según nivel).
- **Misiones generadas** (matar, recolectar, visitar, entregar a un PNJ lejano y jefe de mazmorra) ligadas a zonas reales cercanas, con recompensa acorde. La guía GPS y la brújula funcionan también hacia zonas aún no descubiertas.
- **Mapa del mundo** (botón 🌍 en el mapa grande): zonas descubiertas, salidas sin explorar «?» y objetivo 📍.
- **Rótulo de zona** más pequeño y elegante, con iconos: 🛒 tienda, 💬 gente, ❗ misión, ⚔ peligro, ⛏ minerales.
- Tests nuevos (`tests/procgen.test.ts`): determinismo, coherencia de biomas, conectividad, niveles ±1, serialización/migración y misiones completables.

## v0.7.0 · 2026-11-27 — Batalla por turnos estilo Final Fantasy

- **Escena de batalla aparte** (vista lateral): tu grupo (jugador, compañero y mascota) a la derecha, los enemigos a la izquierda, sprites ampliados con respiración y fondo pixel art según la zona (pradera, bosque, montaña, cueva, cripta, galerías, puerto, aldea, interior). Se entra con una transición breve cuando un enemigo te ve o lo embistes.
- **Turnos por iniciativa** (DES + bonos; el lobo actúa antes que tú) con barra de orden compacta. Menú táctil en una línea: Atacar, Habilidad (con coste y órdenes a la mascota), Objeto (incluye la Runa de vínculo), Defender y Huir. Sin casillas ni alcance; hechizos de área = todos los enemigos; curas y mejoras eligen aliado.
- **Animaciones**: el atacante avanza y vuelve, destello, números flotantes, partículas por tipo de daño, desintegración al morir, sacudida suave y mensajes cortos con el nombre de la acción. Sin carteles grandes, zoom de cámara ni tarjeta de duelo.
- Compañero y mascota actúan solos; jefes con fases e invocaciones, estados, resistencias, talentos, XP escalada, botín, misiones, huir con tirada y muerte/respawn siguen las reglas de siempre. Al ganar el enemigo sale del mapa; al huir vuelves con 8 turnos de inmunidad.
- Ajustes: «Velocidad de batalla» (Normal/Rápida) sustituye a «Velocidad del combate»; «Efectos de batalla».
- Lógica de batalla separada y testeable (`src/game/battle`, sin DOM) con tests nuevos. Eliminado el combate táctico del mapa (movimiento por casillas, tarjeta de duelo, barra de turnos, cinemática de cámara, registro de combate). El guardado no cambia (sin migración).

## v0.6.0 · 2026-11-27 — Volumen pseudo-3D

- Muros, paredes, tejados, árboles, pinos, arbustos y rocas se dibujan con altura (cara frontal oscura + cara superior clara, luz arriba-izquierda) y se ordenan por fila: lo alto tapa lo de detrás y personajes/enemigos/mascotas pasan por delante o detrás.
- Sombras suaves proyectadas abajo-derecha bajo objetos altos y personajes; oclusión ambiental junto a muros y objetos; degradado vertical de luz y viñeta suave; agua con ondas y destellos.
- Todo lo estático va en caché por zona; por fotograma solo entidades y agua (sin shadowBlur). Compatible con oscuridad, halo de luz y día/noche.
- Ajustes: «Volumen 3D» Sí/No (por defecto Sí). Jugabilidad, coordenadas y colisiones sin cambios.

## v0.5.9 · 2026-11-27 — Misiones sin avisos y enemigos a tu nivel

- Quitados los avisos de misión (nueva, progreso) que salían en pantalla; la línea de abajo y el menú 📖 las muestran.
- Los encuentros aleatorios salen a tu nivel ±1 (vida, ataque, daño y CA escalan); los jefes no se escalan.
- Añadido `CLAUDE.md` con el contexto del proyecto para nuevas sesiones.

## v0.5.8 · 2026-11-24 — Menú de misiones claro y desplegable cuadrado

- **Menú de misiones rehecho (📖):** cada misión en curso muestra la tarea de ahora resaltada (▶),
  las hechas (✓) y las que faltan (○) con «Tienes 2 de 5» y una barra, **dónde ir** con la ruta
  desde donde estás («Aldea de Brumaroja → Bosque Sombrío»), la recompensa y los botones
  «Seguir» e «Historia». Pestañas En curso / Hechas, y «Misiones nuevas» con a quién hablar.
  El botón 📖 de la barra muestra ❗ si hay una misión lista para entregar.
- **La lista de misiones de arriba desaparece**: queda una sola línea abajo, sobre la barra
  («⚔ Goblins 0/5 · Bosque Sombrío (+1)»), que abre el menú al tocarla.
- Quitado el enlace a las misiones de la Ficha.
- Arreglado: el desplegable de habilidades se salía por la derecha; ahora ocupa justo el ancho de
  la barra, con dos columnas iguales.

## v0.5.7 · 2026-11-24 — Barra con accesos directos y desplegable de habilidades

- Barra inferior de exploración en una línea con accesos directos: ⏳ Esperar, ✨ Habilidad,
  🎒 Mochila, 📜 Ficha, **📖 Misiones** y **⚙ Ajustes** (sustituyen al botón ☰ Menú; Esc/Atrás
  siguen abriendo la pausa).
- **Habilidades en un desplegable** pegado a la barra (rejilla de 2 columnas con icono, nombre y
  coste): se cierra al elegir y al tocar el mapa. Incluye la poción rápida y, en combate, Correr,
  Vincular y Órdenes. Ya no hay botones redondos sueltos por el mapa.
- Los pasos que te quedan (👣) salen como insignia sobre «Terminar»; desaparece la pastilla
  flotante del centro.
- Ajustes, dentro de una partida: Guardar partida, Cómo se juega y Guardar y salir al menú.
- Arreglado: los botones de zoom se veían por encima de las pantallas completas.

## v0.5.6 · 2026-11-24 — Menú de combate en una línea

- El menú de «Tu turno» pasa de dos filas a **una sola línea**: Atacar, Habilidad, Objeto,
  Defender, Huir y Terminar. Correr, Vincular y las órdenes a la mascota están dentro de
  «Habilidad». El movimiento 👣 y la acción salen en una pastilla pequeña sobre el menú.
- Quitado el cartel grande «TU TURNO» (queda un sonido suave y una vibración corta).

## v0.5.5 · 2026-11-24 — Sin recuadro «En combate»

- Quitado el recuadro rojo «⚔ En combate» que se quedaba arriba a la izquierda durante la pelea.

## v0.5.4 · 2026-11-24 — Sin banner de combate

- Quitado también el cartel grande «⚔ ¡COMBATE!» al empezar un combate (queda sólo un sonido suave).

## v0.5.3 · 2026-11-24 — Sin banner de victoria

- Quitado el cartel grande de «¡VICTORIA!» al acabar el combate. La experiencia (y el oro) salen
  pequeños, flotando sobre el personaje, como al recoger algo.

## v0.5.2 · 2026-11-24 — Mensajes de combate abajo

- La tarjeta de duelo, el cartel de acción y el registro van ahora **abajo, pegados a los botones
  de combate**, en una pila que no tapa el mapa. La tarjeta es una tira fina de dos líneas
  (retratos, acción, d20, cuenta, resultado y daño con su icono).
- Mientras hay tarjeta o cartel, el registro se esconde (no se apilan tres cosas).
- En combate la cámara reserva ese espacio para que el personaje no quede tapado.
- «▶ Siguiente» y «⏩ Saltar ronda» comparten la misma fila inferior.

## v0.5.1 · 2026-11-24 — Retoques de interfaz

- Quitado el zoom de acercamiento a cada golpe en combate (feo): la cámara ya no se acerca ni se desplaza.
- Las misiones desaparecen del todo durante el combate.
- Menos flechas: ya no hay flechas doradas hacia cada salida. Queda sólo la brújula verde de la
  guía de misión (desactivable). Los rótulos de salida sólo salen cuando estás cerca.
- Mensajes de combate más breves: el cartel de acción y la tarjeta de duelo se cierran solos
  (antes en «Paso a paso» se quedaban hasta 60 s); las líneas del registro se desvanecen solas.
- Paneles de abajo rediseñados: dock fino de cristal en exploración, botones de habilidad
  redondos y pequeños, y menú de combate de dos filas (≈ la mitad de alto). Tarjeta de duelo
  más compacta. Un solo aviso al empezar la partida.

## v0.5.0 · 2026-11-24 — Combate cinematográfico y zoom del mapa

- **Tarjeta de duelo** (estilo Baldur's Gate 3) en cada ataque o hechizo: retratos, d20 rodando,
  «14 + 5 = 19 vs CA 16», Impacto / Fallo / ¡Crítico! / ¡Pifia! y daño con su tipo. Una acción con
  varios objetivos es una sola tarjeta con una fila por objetivo.
- **Registro de combate persistente** (últimas líneas, coloreadas por tipo, sin desvanecerse;
  tócalo para ver todo el historial).
- **Cinemática**: zoom de acción hacia el golpe, temblor, hit-stop y cámara lenta en críticos y
  golpes de gracia, viñeta, anticipación y embestida, banners ⚔ ¡COMBATE! y ¡VICTORIA! (con XP,
  oro y objetos) que se encadenan con la pantalla de subida de nivel.
- **Partículas por tipo de daño** (tajo, chispas, fuego, hielo, rayo, veneno, sagrado, sombra),
  proyectiles con estela, curaciones, iconos de estado, enemigos que se desintegran y botín que
  salta con el color de su rareza.
- **Sonido en capas** y ajustes **Efectos de combate** (Completos / Reducidos / Mínimos).
- Ritmo ajustable en `src/data/config/combat_pacing.ts`; ⏩ **Saltar ronda** con 3+ actores.
- **Zoom del mapa controlado por el jugador**: pellizco, botones + − ⟲, rueda y teclas; niveles
  enteros de ~8 a ~30 casillas, guardado en Ajustes. Alejar el mapa no delata enemigos lejanos.

## v0.4.2 · 2026-11-24 — Arreglo de misiones

- Arreglado: no se podían entregar «Carta para la Forja» (Garrik) ni «Tu primera captura»
  (Tobías): sus diálogos no tenían la opción «📜 Misiones».
- Test nuevo que comprueba que todo PNJ que da o recibe una misión puede gestionarla.

## v0.4.1 · 2026-11-23 — Movimiento por turno en combate

- Economía de acciones estilo D&D 5e / Baldur's Gate 3: en tu turno de combate tienes
  **movimiento (casillas) + 1 acción**. Moverte ya no gasta el turno.
- Movimiento por clase (datos): Guerrero, Mago y Clérigo 5; Pícaro 6. +1 con el talento
  «Pies ligeros» y el trasfondo Cazador. Ralentizado = la mitad.
- Casillas alcanzables resaltadas en azul; tocar más lejos avanza lo que puedas.
- Nueva acción **Correr** (doble movimiento) y botón **Terminar turno**. Contador
  «👣 3/5 · ⚔ Acción lista/usada»; los botones de acción se apagan al usarla.
- Enemigos, compañero y mascota se mueven varias casillas (animadas casilla a casilla) y
  atacan en el mismo turno. Lobo 7, arañas 5-6, zombi 2, jefes 4-5 (nuevo campo `movement`).
- «Cómo se juega» explica el combate nuevo y cómo capturar mascotas.

## v0.4.0 · 2026-11-23 — Combate turno a turno, misiones estilo WoW y mascotas a la vista

- **Combate turno a turno**: nueva opción «Velocidad del combate» (Paso a paso por defecto,
  Lenta, Normal). En paso a paso cada compañero, mascota y enemigo actúa de uno en uno y el
  juego espera a que pulses **▶ Siguiente** (o toques la pantalla).
- **Barra de turnos** bajo el HUD con retratos en orden, vida en miniatura y el actor en
  curso resaltado; anillo bajo sus pies y cámara que se acerca si está lejos.
- **Cartel de acción** centrado con lo que hace cada uno (con la tirada), dado animado
  también para los ataques enemigos, animaciones más lentas y números de daño más grandes.
- **Menú de acciones** en tu turno: Atacar (resalta a quién puedes golpear), Habilidad,
  Objeto, **Defender** (nuevo: +2 CA hasta tu próximo turno), Esperar, Huir, Vincular y
  Órdenes a la mascota. Aviso «TU TURNO». En combate, tocar el suelo mueve una casilla.
- **Seguimiento de misiones estilo WoW**: sólo texto bajo el panel, plegable, una línea por
  objetivo con progreso y zona; tocar sigue la misión, doble toque/mantener abre su ficha.
- **Mascotas**: las criaturas salvajes llevan 🐾 y la etiqueta «salvaje», siempre hay al
  menos una al entrar en su hábitat (hasta 3), Aurelión ya vive en la Cripta. Tobías regala
  3 Runas de vínculo y la misión «Tu primera captura» (nuevo objetivo `bind`). Mascotas de
  recompensa: Umbrín (Cueva), Destellín (Mórgala) y Aurelión (epílogo). El bestiario y la
  ficha dicen dónde vive cada especie o cómo se consigue.

## v0.3.1 · 2026-11-23 — Retoques

- Aviso de misión mínimo: una línea con icono, qué/cuántos y zona («⚔ Goblins 2/5 · Bosque Sombrío»).
- Guía de misión: brújula pequeña con icono y punta hacia el objetivo, sin distancia en casillas.
- Arreglado: las pantallas largas (Ajustes, etc.) no dejaban llegar a las opciones de arriba,
  por eso no se podía activar el joystick. Ahora se desplazan enteras.

## v0.3.0 · 2026-11-23 — Mascotas

- **15 criaturas originales** en 6 líneas evolutivas: Chispón → Brasalón → Volcandor
  (fuego), Gotín → Marejón → Tritonal (agua), Brotín → Ramaleón → Bosquerón (planta),
  Guijarrín → Roquedón (tierra), Umbrín → Umbracán (sombra) y Destellín → Aurelión (luz).
  Sprites pixel art propios, más grandes y con brillo en cada etapa.
- **6 tipos** con tabla de eficacia (x2 / x0,5); cada familia de enemigos tiene tipo.
- **23 movimientos**: daño a distancia o en área, estados, curar al jugador o a sí misma,
  escudos (+CA) y mejoras. Máximo 4; al aprender el quinto eliges cuál olvidar.
- **Tobías y el establo** junto al corral de Brumaroja: elige tu mascota inicial (fuego,
  agua o planta), deja o recoge hasta 8 mascotas, cúralas gratis. **Las que se quedan
  entrenan con el tiempo real** (tope de 8 horas por día y hasta tu nivel) y al volver ves
  cuánto han subido.
- **Criaturas salvajes** en el Bosque Sombrío, el Paso Gris y las mazmorras. **Runa de
  vínculo** (tienda, alquimista y botín de goblins): debilita a la criatura y pulsa 🔮; la
  probabilidad se muestra y sube cuanto menos vida le quede.
- **Combate**: la mascota lucha a tu lado con IA por tipos, los enemigos también la atacan,
  y si cae se recupera fuera de combate. Toca su barra 🐾 (o a ella) para darle órdenes.
- **Progresión**: XP por combate (tú ganas un 10 % menos mientras te acompaña), subida de
  nivel, movimientos nuevos y **evolución animada** que se puede detener.
- **Ficha de mascota** (mote editable, estadísticas, movimientos, línea evolutiva con
  siluetas) y **bestiario** de especies vistas y vinculadas.
- Guardado v8 con migración (sin mascotas y establo vacío para partidas antiguas).

## v0.2.1 · 2026-11-23 — Arreglos, diario, guía GPS y mapa grande

- **Joystick arreglado**: no recibía los toques (la capa del HUD los dejaba pasar al
  mapa). Ahora mueve en 8 direcciones, ataca si empujas contra un enemigo, se para al
  soltar, respeta la mano dominante y queda por encima de la barra de habilidades.
- **Diario de misiones nuevo**: lista de misiones en curso y completadas; al tocar una,
  ficha con historia, objetivos y progreso, recompensas, quién la da, a quién se entrega
  y dónde está el siguiente paso. Botón **Seguir esta misión** (★).
- **Guía de misión tipo GPS** (opcional en Ajustes): flecha verde animada con brillo,
  icono del tipo de paso (💬 ⚔ ✋ 📍) y distancia en casillas; al tener el objetivo a la
  vista, marcador flotante sobre el PNJ, el enemigo o la veta. Para «consigue X» guía a
  donde se consigue (vetas o enemigos que lo sueltan) o, si no se sabe, a quien te dio
  la misión. Sigue la misión elegida en el diario.
- **Mapa grande interactivo** al tocar el minimapa: zoom con dos dedos o −/+, arrastrar,
  salidas con nombre, PNJ con ❗/❓, cofres y vetas, enemigos en alerta, objetivo de la
  misión; toca un punto y pulsa **Ir**. En las mazmorras sólo se ve lo explorado.
- Cámara: margen extra abajo para que el jugador y su compañero no queden tapados por
  la barra de habilidades.

## v0.2.0 · 2026-11-21 — Fase A: personaje con identidad

- **Trasfondos** al crear el personaje (Soldado, Ladrón callejero, Erudito, Noble caído,
  Acólito y Cazador del bosque): bono a una característica, competencias, objetos y
  opciones de diálogo exclusivas.
- **Tiradas de habilidad en los diálogos** (Persuasión, Intimidación, Engaño, Perspicacia,
  Arcanos, Atletismo, Sigilo, Juego de manos) con el dado animado, CD y probabilidad
  visibles, éxitos críticos y desastres. Consecuencias reales: descuentos, oro, objetos,
  XP, pistas, peleas, actitud de los PNJ y aprobación de los compañeros.
- Casi todos los PNJ tienen ahora alguna decisión con tirada. **Dilemas**: el secreto del
  alcalde Ortun, Hal el desertor, el cultista encadenado y el relicario robado de la
  capilla; otros PNJ comentan lo que hiciste.
- **Talentos**: al subir de nivel eliges 1 de 3. 3 ramas por clase (Piromante,
  Criomante, Arcanista; Berserker, Guardián, Maestro de armas; Asesino, Envenenador,
  Acróbata; Sanador, Inquisidor, Guardián de la Luz) con efectos que cambian cómo se
  juega: suelo en llamas, hechizos que rebotan, contraataque, esquiva, robo de vida,
  golpes gratis al matar, desvanecerse, críticos que congelan o aturden...
- **Compañeros**: Sira (arquera, en La Jarra Roja) y Brann (mercenario, en El Faro). Luchan
  a tu lado, los enemigos también les atacan, comentan lo que pasa, aprueban o desaprueban
  tus decisiones y tienen misión personal. Mini barra de vida en el HUD.
- Ficha con trasfondo, talentos y habilidades sociales.
- Guardado v7 con migración (las partidas antiguas reciben los talentos pendientes).

## v0.1.0 · 2026-11-21 — Hito 7: historia completa y primera versión completa

- Trama principal de 7 capítulos: tras Gruñaz llegan las Galerías de Seda y Mórgala,
  la reja de las runas que abre la Cripta, el combate final contra Velkar el Nigromante
  y un epílogo en Brumaroja.
- Pantalla final con epílogo y estadísticas (nivel, tiempo, turnos, enemigos, jefes,
  caídas y oro). Después puedes seguir jugando con el mismo personaje.
- Objetivo de la misión siempre visible bajo el panel de vida, con la zona donde
  cumplirlo, y flecha verde con ★ hacia la salida que te acerca al objetivo.
- Pantalla «Cómo se juega» en el menú de pausa.
- Efectos de sonido generados por código (golpes, críticos, monedas, cofres, misiones,
  subida de nivel, muerte y victoria) con ajustes de sonido y volumen.
- Ciclo de día y noche en exteriores (desactivable).
- Equilibrio: curva de XP base 200, más XP en la segunda mitad de la historia y jefes
  más justos; test que simula la progresión completa.
- Interfaz: el HUD ya no tapa al personaje (márgenes que incluyen la barra de
  habilidades y el objetivo) y las salidas no se rotulan en combate.
- APK: pantalla de inicio oscura propia y botón Atrás que vuelve al menú principal.
- Guardado v6 (estadísticas de la partida) con migración.

## v0.0.6 · 2026-11-21 — Hito 6: mazmorras, minería y jefes

- 3 mazmorras procedurales con semilla: Cueva de los Colmillos (entrada al norte del
  Bosque Sombrío), Galerías de Seda (en el Paso Gris) y Cripta de Velkar (bajo Puerto
  Ceniza, sellada hasta el Hito 7). Salas, pasillos, escaleras entre pisos y sala del
  jefe con mapa fijo.
- Jefes en su guarida: Gruñaz, Mórgala y Velkar, con escoltas. Al vencerlos se abre la
  salida a la superficie y la mazmorra se regenera la próxima vez (rejugable).
- Cofres con botín por nivel; algunos con cerradura (DES para abrirla o FUE para
  forzarla; el Pícaro es experto).
- Trampas ocultas (pinchos, dardos venenosos, runas de fuego): se detectan con SAB al
  acercarte, se desactivan con DES (dan XP) o saltan si las pisas.
- Minería: vetas de hierro, plata y gemas en mazmorras, el bosque y el Paso Gris. Hace
  falta un pico del nivel adecuado; fuera de las mazmorras las vetas vuelven a crecer.
- 3 enemigos nuevos: araña cazadora, caballero esqueleto y espectro.
- Misión principal «La Cueva de los Colmillos» y secundaria «Hierro para la forja».
- Nuevos tiles: paredes y suelos de cueva, seda y cripta, escaleras, cofres, trampas y vetas.
- Guardado v5 con migración (progreso de mazmorras y elementos usados). Si guardas dentro
  de una mazmorra, vuelves al mismo piso.

## v0.0.5 · 2026-11-21 — Hito 5: pueblos, comercio y misiones

- Tiendas: comprar y vender por cantidades (−, +, +5, Máx) en una sola operación.
- Subida de nivel más lenta: la curva de XP pasa de base 100 a 220 (exponente 1,6).

- Interiores: las puertas de la aldea llevan a la casa del alcalde, la capilla, la
  herrería, la tienda y la taberna-posada La Jarra Roja.
- Nueva ciudad, Puerto Ceniza (gremio de aventureros, templo, Forja del Ancla,
  alquimista, posada El Faro y mercado en la plaza), unida a la aldea por el Paso Gris,
  una zona salvaje de nivel 3 con encuentros (lobos, goblins, arañas, esqueletos y
  cultistas).
- 14 PNJ con diálogos en datos (saludo, rumores, misiones, servicios) y marcas ❗/❓.
- Tiendas con stock propio que se renueva con el tiempo, precios distintos por ciudad,
  compra y venta con descuento y mejor precio según el carisma, y ficha con comparación.
- Posada (descansar cura todo, pasa la noche y guarda) y templo (sanación por donativo;
  reapareces en el último templo).
- Misiones: 2 de la trama principal (contra Velkar el Nigromante), 5 secundarias y 4
  encargos repetibles del gremio. Objetivos de cazar, recoger, visitar y hablar.
- Diario de misiones (en la Ficha o tecla J) y misión en curso visible en el HUD.
- 12 tipos de casilla nuevos para interiores y la ciudad.
- Guardado v4 con migración (misiones y tiendas). 212 tests.

## v0.0.4 · 2026-11-21 — Hito 4: inventario, equipo y botín

- Mochila de 24 huecos con pilas de consumibles y materiales.
- 10 ranuras de equipo: cabeza, pecho, manos, piernas, pies, arma, mano secundaria,
  herramienta (pico) y 2 accesorios. Armas a dos manos liberan el escudo.
- 60 objetos: armas de 6 tipos (espadas, hachas, arcos, bastones, dagas, mazas),
  armaduras con límite de DES, escudos, tomos, símbolos sagrados, anillos, amuletos,
  picos de 3 niveles, pociones, comida y materiales. Iconos pixel art propios.
- 5 rarezas con bonos aleatorios (características, CA, ataque, daño, PV, recurso),
  más poder y más valor. A más nivel, mejores rarezas.
- Tablas de botín por familia de enemigo y para jefes; el botín cae al suelo y brilla
  con el color de su rareza.
- Pantalla de equipo con comparación de estadísticas (▲/▼) antes de equipar.
- Pociones utilizables en combate (gastan el turno) y botón rápido 🧪.
- Cada clase empieza con su equipo; las partidas antiguas lo reciben al cargar
  (guardado v3 con migración).
- Exportar/importar partida como código de texto (pasar progreso entre web y APK).
- Navegación: flechas doradas hacia las salidas, minimapa táctil, HUD más compacto
  que no tapa el mapa y consejos al empezar.

## v0.0.3 · 2026-11-21 — Hito 3: combate

- Combate por turnos en el propio mapa: atacar, habilidades, esperar y huir.
- Tiradas d20 contra CA con críticos (20) y pifias (1), ventaja y desventaja,
  salvaciones contra CD, resistencias y vulnerabilidades. Animación del d20.
- 12 enemigos en 6 familias (goblinoides, bestias, arañas, no-muertos, humanos,
  orcos) y 3 jefes con fases (Gruñaz, Mórgala, Velkar) listos para las mazmorras.
- IA: cuerpo a cuerpo, a distancia (mantiene la distancia), hechiceros (curan e
  invocan), rápidos (2 casillas) y jefes con fases e invocaciones.
- Estados: veneno, sangrado, quemado, aturdido y ralentizado (para ti y enemigos).
- Encuentros aleatorios en el Bosque Sombrío.
- Experiencia por matar (escalada por diferencia de nivel) y por descubrir zonas.
  Subida de nivel con pantalla propia, PV, recurso, puntos y habilidades nuevas.
- Barra de habilidades con coste y recarga, selección de objetivo con alcance
  resaltado, números de daño flotantes, proyectiles, explosiones y destellos.
- Muerte: despiertas en la aldea perdiendo el 10 % del oro (o cargas la partida).
- Clérigo: Llama sagrada desde nivel 1 y nueva habilidad «Juicio divino».
- 59 tests, incluida una simulación de duelos para equilibrar.

## v0.0.2 · 2026-11-21 — Hito 2: personajes

- Pantalla de creación: elige clase (Guerrero, Pícaro, Mago, Clérigo), nombre
  (con botón 🎲), aspecto (20 combinaciones de piel y pelo) y reparte 3 puntos.
- Características FUE, DES, CON, INT, SAB y CAR con modificadores 5e; PV por dado
  de golpe, CA, bonificador de ataque y de competencia.
- Cada clase con su recurso (Vigor, Energía, Maná, Fe), arma inicial, rasgos y
  5 habilidades que se desbloquean en los niveles 1, 3, 6, 10 y 15.
- Sprites propios por clase (casco y espada, capucha y daga, sombrero y bastón,
  diadema y maza).
- Ficha de personaje (botón «Ficha» o tocar el retrato) con reparto de puntos.
- Guardado v2 con migración: las partidas del Hito 1 pasan a ser guerreros.
- Versión web en GitHub Pages y APK publicado como Release (enlace fijo / Obtainium).

## v0.0.1 · 2026-11-21 — Hito 1: motor base

- Proyecto TypeScript + Vite + Capacitor 8 (Android) y PWA instalable sin conexión.
- Motor en Canvas 2D: mapa por casillas pre-renderizado, cámara, escala entera
  para pixel art nítido, oscuridad ambiental con halo de luz.
- Pixel art generado por código: 22 tipos de casilla con variantes y el héroe.
- Movimiento por turnos: tocar para ir (A* en 8 direcciones), joystick virtual
  opcional, teclado en PC, botón «Esperar».
- Zonas definidas en datos (mapas ASCII): Aldea de Brumaroja y Bosque Sombrío,
  conectadas por salidas. La salida a la Cueva de los Colmillos queda preparada.
- HUD: retrato, nombre, nivel, PV, PM, barra de XP, oro, minimapa, cartel de zona
  y registro de mensajes.
- Menú principal (Continuar con resumen de la partida, Nueva partida, Ajustes,
  versión), menú de pausa y botón Atrás de Android.
- Guardado versionado con migraciones, copia de seguridad automática y doble
  almacén en Android. Autoguardado al cambiar de zona, cada 40 turnos y al salir.
- Reglas base: dados D&D (`2d6+3`, ventaja/desventaja), modificadores de
  característica y curva de XP configurable (`base × nivel^1,6`, niveles 1–20).
- GitHub Actions: tests + APK debug descargable en cada push.
- 30 tests (dados, XP, rutas, guardado/migraciones, validación de mapas, movimiento).
