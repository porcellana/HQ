# Ecos del Abismo — contexto para Claude

RPG de mazmorreo por turnos (reglas D&D 5e), vista cenital 2D pixel art, móvil vertical. TypeScript + Vite + Canvas, Capacitor (APK), PWA. Todo en español. Código en `/home/user/HQ`, rama `ccr-7e7ceb27-hc9arl`. El prototipo `heroquest/` NO se toca.

## Cómo trabajar (preferencias del usuario)
- **Respuestas MUY breves; ahorrar tokens**; hacerlo bien igualmente. Sin preguntas triviales: decide y anota en el README.
- Sin banners/carteles grandes ni zoom de cámara en combate; UI móvil compacta (barra inferior de 1 línea, mensajes pequeños y abajo).
- Cada cambio: `npx tsc --noEmit && npx vitest run && npm run build` en verde → commit pequeño → `git push` → comprobar con las herramientas de GitHub Actions que el run «APK Android (debug)» acaba en success y que sale la Release. No crear PRs.
- Commits terminan con `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>` y la línea `Claude-Session:` que indique el sistema.
- Subir versión en `package.json` (+`npm i --package-lock-only`) y entrada arriba en `CHANGELOG.md` en cada entrega.
- Verificación visual: Playwright (ya instalado), dispositivo `Pixel 5`, `npx vite --port 5174`; en dev existen `window.__game` y `window.__app`. Capturas solo cuando haga falta.

## Arquitectura
- `src/data/**`: TODO el contenido (clases, enemigos, objetos, zonas ASCII, misiones, NPC, mazmorras, mascotas…); `registry.ts` lo carga solo; tipos en `schema.ts`. El motor (`src/game`, `src/engine`) no conoce contenido.
- `src/game/game.ts`: estado y turnos (movimiento + 1 acción, enemigos, botín, misiones). `src/game/rules`: dados, XP (base 200, exp 1,6), derivados. `src/game/combat`: reglas, estados, enemigos. `src/game/save`: guardado versionado con migraciones (subir `CURRENT_SAVE_VERSION` si cambia el estado).
- `src/gfx`: pixel art generado por código (tiles, sprites, partículas, cinemática) y `renderer.ts`. `src/ui`: HUD/pantallas en DOM (`styles.css` con bloques por versión, los últimos ganan).
- `tests/`: vitest (≈400). `scripts/`: iconos y proyecto Android. CI `.github/workflows/android-apk.yml` publica web (GitHub Pages) y APK (Release con enlace fijo).

## Estado (v0.5.9)
Hitos 1-7 + identidad (trasfondos, talentos, compañeros, diálogos con tiradas), mascotas, combate táctico en el mapa con tarjeta de duelo, mapa grande, zoom, misiones claras, sonido. Encuentros aleatorios a nivel del jugador ±1.

## Pendiente (en este orden)
1. Aspecto pseudo-3D (volumen: muros/árboles con altura, sombras, iluminación).
2. Combate estilo Final Fantasy por turnos (escena aparte: grupo a un lado, enemigos al otro, menú Atacar/Magia/Objeto/Defender/Huir).
3. Mundo procedural por semilla que se genera al explorar (biomas, aldeas/pueblos/ciudades, cuevas, mazmorras, misiones y objetos), coherente y con niveles ±1.
