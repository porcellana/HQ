# Registro de cambios

Formato: versión · fecha · cambios. La versión también aparece en el menú principal.

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
