# Registro de cambios

Formato: versión · fecha · cambios. La versión también aparece en el menú principal.

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
