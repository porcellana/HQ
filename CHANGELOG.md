# Registro de cambios

Formato: versión · fecha · cambios. La versión también aparece en el menú principal.

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
