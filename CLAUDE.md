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
- `src/game/game.ts`: estado, mapa, encuentros (enemigo que te ve → `startEncounter` → `beginBattle`/`finishBattle`), botín, misiones. `src/game/battle/`: batalla por turnos (lógica pura sin DOM: `battle.ts`, `biome.ts`). `src/game/rules`: dados, XP (base 200, exp 1,6), derivados. `src/game/combat`: reglas, estados, enemigos (la batalla las reutiliza). `src/game/save`: guardado versionado con migraciones (subir `CURRENT_SAVE_VERSION` si cambia el estado).
- `src/gfx`: pixel art generado por código (tiles, sprites, partículas, fondos de batalla) y `renderer.ts`. `src/ui`: HUD/pantallas en DOM; `battleScene.ts` es la escena de batalla (canvas + menú) (`styles.css` con bloques por versión, los últimos ganan).
- `tests/`: vitest (≈400). `scripts/`: iconos y proyecto Android. CI `.github/workflows/android-apk.yml` publica web (GitHub Pages) y APK (Release con enlace fijo).

## Estado (v0.9.1)
Hitos 1-7 + identidad (trasfondos, talentos, compañeros, diálogos con tiradas), mascotas, **batalla por turnos estilo Final Fantasy en escena aparte** (grupo a la derecha, enemigos a la izquierda, iniciativa, menú Atacar/Habilidad/Objeto/Defender/Huir, fondos por bioma; el combate táctico del mapa se eliminó), mapa grande, zoom, misiones claras, sonido. **Mundo procedural por semilla** (`src/game/world/procgen`, biomas en `src/data/biomes`, guardado en `state.world.gen`, save v9; aldeas/pueblos/ciudades, campamentos, ruinas, cuevas, mazmorras con jefe, misiones generadas, mapa del mundo 🌍, rótulo de zona con iconos). Zonas generadas: nivel jugador ±1 fijado al descubrirlas. Ajuste «Velocidad de batalla». **Mascotas v0.9.1**: 42 especies/8 tipos, `evolutions` ramificadas (nivel+vínculo/naturaleza/objeto), `passive`, naturalezas, vínculo con niveles, hábitats `bioma:`/`lugar:` (save v10).

## Pendiente (en este orden)
1. Interiores de casas en el mundo procedural, música/ambiente real por bioma, misiones de escolta y eventos al viajar.
2. Pulido de batalla: más animaciones por clase/enemigo, fondos por hora del día, selección de objetivo con información (nombre/nivel) al mantener pulsado.
