# Registro de cambios

Formato: versión · fecha · cambios. La versión también aparece en el menú principal.

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
