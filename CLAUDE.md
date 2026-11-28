# Ecos del Abismo — contexto para Claude

RPG de mazmorreo por turnos (reglas D&D 5e), **todo en 3D suave (WebGL2 puro, mallas por código)**, móvil vertical. TypeScript + Vite, Capacitor (APK), PWA. Todo en español. Código en `/home/user/HQ`, rama `ccr-7e7ceb27-hc9arl`. El prototipo `heroquest/` NO se toca.

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

## Estado (v0.12.0)
Hitos 1-7 + identidad (trasfondos, talentos, compañeros, diálogos con tiradas), mascotas, **batalla por turnos estilo Final Fantasy en escena aparte** (grupo a la derecha, enemigos a la izquierda, iniciativa, menú Atacar/Habilidad/Objeto/Defender/Huir, fondos por bioma; el combate táctico del mapa se eliminó), mapa grande, zoom, misiones claras, sonido. **Mundo procedural por semilla** (`src/game/world/procgen`, biomas en `src/data/biomes`, guardado en `state.world.gen`, save v9; aldeas/pueblos/ciudades, campamentos, ruinas, cuevas, mazmorras con jefe, misiones generadas, mapa del mundo 🌍, rótulo de zona con iconos). Zonas generadas: nivel jugador ±1 fijado al descubrirlas. Ajuste «Velocidad de batalla». **Mascotas v0.9.1**: 42 especies/8 tipos, `evolutions` ramificadas (nivel+vínculo/naturaleza/objeto), `passive`, naturalezas, vínculo con niveles, hábitats `bioma:`/`lugar:` (save v10).

v0.9.4: botín/economía/comercio (`game/economy/curve.ts`, `shop.ts`: recompra, mejoras, basura, bolsa; `items/loot.ts` con `LootCtx`; conjuntos en `data/sets`; ~135 objetos nuevos; `ui/shop.ts` con filtros). `ui/lootSummary.ts` (fichas de botín) está listo pero sin conectar en `battleScene.showPanel`.

v0.11.0: **TODO 3D, sin 2D ni respaldo** (sin WebGL2: mensaje). `src/gfx/world3d/`: `mesh.ts` (primitivas suaves ball/rbox/lathe/limb/ribbon con normales por vértice), `models.ts` (props y rigs; `BEAST_SHAPES`), `anim.ts` (poses puras + `rigMatrices`, compartidas por mapa, batalla y retratos), `terrain.ts` (relieve curvo, bisel/redondeo de muros, `buildSkirt`), `renderer3d.ts` (mapa), `battle3d.ts` + `ui/battleScene.ts` (batalla 3D: unidades con posición de mundo; `layout` proyecta fracciones de pantalla al suelo con la cámara base; offsets en px → mundo con `ppu`), `fx3d.ts` (partículas 3D puras), `signals.ts` (cristales/runas/espíritu guía; sustituye haz/flecha/❗), `studio.ts` (retratos 3D cacheados para el DOM), `glutil.ts` (`SpriteBatch` de destellos). Sin sprites: `gfx/look.ts` (colores de héroe), `viewconst.ts`, `items.ts` (iconos vectoriales), `mapImage.ts`. UI: `ui/styles.css` rehecho («Pergamino y cristal»); `app.setScreen` envuelve en hoja inferior deslizable las pantallas de `SHEET_SCREENS`. Tests: `tests/render3d.test.ts` y `world3d.test.ts`. Dev: `window.__dev.newGame(clase, zona)`, `__game`, `__app`.

v0.12.0: **música y ambiente procedurales** (WebAudio, sin ficheros): `src/audio/compose.ts` (puro, testeable), `engine.ts` (planificador, fundido cruzado, ambiente), `director.ts` (qué suena), `sfx.ts` (efectos sobre el bus del motor); datos en `src/data/music` (`PROFILES`, `musicIdFor`, `stepSfxFor`). Ajustes `music`/`ambient`/`volume`/`sound`.

v0.12.1: **cámara con dos dedos** (`engine/gestures.ts` pura: pellizco=zoom continuo, torcer=girar con inercia, arrastrar=inclinar; un dedo no gira; ⟲/doble toque recentra; Ajustes invertir giro/sensibilidad) y **niebla de exploración** (`game/fog.ts` + `Game.isVisible/isExplored/fogMaps`, textura de visibilidad 1 texel/casilla en `renderer3d.syncFog` + bruma en shaders; `world.explored` guardado, save v11; minimapa y mapa grande la respetan; ajuste «Niebla»). Aviso: puede haber otro agente editando el mismo árbol (audio v0.12.0): commitear solo lo propio.

v0.13.0: gráficos. `cull.ts` (frustum + LOD), `quality.ts` (`AdaptiveQuality` con histéresis; `QualityCfg.shadows/bloom/decorDist/instDist`), `daycycle.ts` (`dayClock`, sol/luna, amanecer/ocaso, ventanas, luciérnagas, `flicker`), `shadow.ts` (matriz de luz ajustada a texeles, sombra blob alargada); `renderer3d.ts`: sombras con shadow map PCF en Alta, bloom (FBO MSAA + blur 1/4), contador de fps (`stats`, ajustes `showFps`/`bloom`); `terrain.ts`: roca orgánica en cuevas/mazmorras (`rockSkin`, `Geo.rockH`), luces con tipo `k`. OJO: todo programa con `WORLD_FS` debe llamar a `initWorldSamplers` (sampler2DShadow necesita textura con comparación en la unidad 2). Dev: `__dev.newGame(clase, zona, x, y)`. Tests: `tests/gfx_v013.test.ts`.

## Pendiente (en este orden)
0. 3D: casas con interior y techo recortable, sombras en la batalla (hoy blob alargado), más animaciones por enemigo/jefe, retratos con pose por clase, braseros/llamas con forma de llama (hoy lóbulo emisivo), clima (lluvia/tormenta) heredado en batalla.
1. Interiores de casas en el mundo procedural, misiones de escolta y eventos al viajar.
2. Conectar `ui/lootSummary.ts` en el panel de victoria; selección de objetivo con información al mantener pulsado.
