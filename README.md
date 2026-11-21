# Ecos del Abismo

RPG de mazmorreo por turnos con reglas inspiradas en D&D 5e (d20, CA, salvaciones,
críticos y pifias), vista cenital 2D en pixel art y controles táctiles. Pensado para
Android en vertical (se juega con una mano) y probable en el navegador como PWA.

> La carpeta `heroquest/` es un prototipo anterior independiente; el juego nuevo no la usa.

---

## Estado

| Hito | Contenido | Estado |
|------|-----------|--------|
| 1 | Motor base, mapa, movimiento, HUD y guardado | ✅ v0.0.1 |
| 2 | Creación de personaje, 4 clases y características | ✅ v0.0.2 |
| 3 | Combate por turnos, enemigos, XP y niveles | ✅ v0.0.3 |
| 4 | Inventario, equipo y botín | ✅ v0.0.4 |
| 5 | Pueblos, tiendas, comercio y misiones | ✅ v0.0.5 |
| 6 | Mazmorras procedurales, minería y jefes | ✅ v0.0.6 |
| 7 | Historia principal, pulido y APK final | ✅ **v0.1.0** |

**La v0.1.0 es la primera versión completa**: la historia se puede jugar de principio a
fin y después se sigue jugando (misiones del gremio, mazmorras rejugables, nivel 20).

### La historia (sin destripes)

Una niebla rojiza cubre la Aldea de Brumaroja y los goblins del Bosque Sombrío se han
vuelto demasiado audaces. Alguien los guía: en sus armas aparece la marca de un ojo
dentro de un abismo. Siete capítulos te llevan de la aldea a Puerto Ceniza, a través de
la Cueva de los Colmillos y las Galerías de Seda, hasta la cripta del responsable.

| Capítulo | Dónde | Nivel orientativo |
|---|---|---|
| 1. Sombras sobre Brumaroja | Aldea → Bosque Sombrío | 1-2 |
| 2. El rastro del Abismo | Paso Gris → Puerto Ceniza | 2-3 |
| 3. La Cueva de los Colmillos | Norte del bosque | 3-4 |
| 4. Hilos en la oscuridad | Galerías de Seda (este del Paso Gris) | 5-7 |
| 5. La reja de las runas | Puerto Ceniza y alrededores | 7 |
| 6. El corazón del Abismo | Cripta (suroeste de Puerto Ceniza) | 8-10 |
| 7. Amanecer en Brumaroja | Vuelta a la aldea | — |

El objetivo actual aparece bajo el panel de vida («📜 Objetivo: …» y la zona donde
cumplirlo) y la **flecha verde con ★** señala la salida que te acerca a él.

El workflow de GitHub Actions compila el APK en cada push (ver más abajo).

---

## Probar en 1 minuto (navegador)

Requisitos: [Node.js 22](https://nodejs.org) o superior.

```bash
npm install
npm run dev
```

Abre la URL que muestra (p. ej. `http://localhost:5173`). Para probar en el móvil,
conéctalo a la misma wifi y abre la dirección `Network:` que aparece en la consola.
En Chrome de escritorio, pulsa F12 → icono de móvil para emular un teléfono.

Otros comandos:

| Comando | Qué hace |
|---------|----------|
| `npm test` | Tests de lógica (dados, XP, guardado, rutas, mapas…) |
| `npm run build` | Comprueba tipos y genera `dist/` (la PWA) |
| `npm run preview` | Sirve `dist/` para probar la versión compilada |
| `npm run android:prepare` | Genera/actualiza el proyecto Android en `android/` |

### Controles

- **Tocar una casilla**: el personaje va hasta ella por el camino más corto.
- **Joystick virtual** (opcional, en Ajustes): moverse casilla a casilla.
- **Esperar**: pasa un turno sin moverte.
- **Menú**: pausa, guardar, ajustes y salir. En Android, el botón *Atrás* abre/cierra la pausa.
- **Atacar**: toca a un enemigo pegado a ti (o empuja el joystick contra él).
- **Habilidades**: botones encima de la barra inferior; si piden objetivo, toca al
  enemigo (las casillas a tu alcance se iluminan). El número es su coste; ⏳ = recarga.
- **Huir** aparece durante el combate.
- Toca a un enemigo lejano para ver su nivel, vida y peligro. El número sobre su
  barra de vida es su nivel (rojo con ☠ = mortal para ti).
- En PC: flechas/WASD para moverse, espacio para esperar, 1-5 habilidades, F huir,
  C ficha, I mochila, J diario, Q poción, Esc pausa.
- Las casillas que brillan en dorado son **salidas** a otras zonas; si están fuera de la
  pantalla, una **flecha dorada** en el borde indica hacia dónde ir.
- **Toca el minimapa** para caminar directamente a ese punto (o a la salida más cercana).
- **Mochila**: equipo, objetos y comparación. 🧪 en la barra = beber poción de curación.
- El botín cae al suelo (brilla con el color de su rareza): písalo para recogerlo.
- **PNJ**: tócalos para hablar (si están lejos, caminas hasta ellos). ❗ = tiene una
  misión para ti; ❓ = puedes entregarle una misión.
- **Diario de misiones**: en la Ficha (o tecla J). La misión principal en curso se ve
  arriba, bajo el panel de vida.
- **Posada**: descansar cura todo y guarda. **Templo**: sanación por un donativo; si
  caes, despiertas en el último templo donde pediste sanación (al principio, la capilla
  de la aldea).
- **Exportar/Importar partida** (en Ajustes): copia tu partida como código de texto para
  pasarla entre la web y el APK, o guardar una copia de seguridad.
- **Mazmorras**: entradas en el Bosque Sombrío (Cueva de los Colmillos, norte), el Paso
  Gris (Galerías de Seda, este) y Puerto Ceniza (Cripta, abajo a la izquierda; sellada
  hasta que avance la historia). Las escaleras llevan de piso en piso; al fondo está el
  jefe. Tras vencerlo se abre la salida a la superficie.
- **Cofres**: tócalos estando al lado. Los que tienen cerradura (gris) hay que abrirlos
  (DES) o forzarlos (FUE); el Pícaro es experto.
- **Trampas**: al acercarte tiras Percepción (SAB) para verlas (borde rojo). Rodéalas o
  tócalas para desactivarlas (DES, da XP). Si pisas una que no viste, salta.
- **Minería**: equipa un pico (ranura Herramienta) y toca una veta varias veces. Pico de
  hierro → hierro; de acero → plata; de mithril → gemas.

---

## Jugar y actualizar en el móvil

Cada `git push` lanza el workflow **«APK Android (debug)»**, que en unos 3 minutos:

1. Pasa los tests y compila la web.
2. Publica la **versión web** en GitHub Pages.
3. Compila el **APK** y lo publica como *Release* (y como artefacto de Actions, 7 días).

### Opción A — Versión web (la más rápida para probar)

- Dirección: **https://porcellana.github.io/HQ/**
- Ábrela en Chrome del móvil → menú ⋮ → **Añadir a pantalla de inicio**.
- Se actualiza sola: al abrirla tras un push verás la versión nueva (si no, ciérrala y ábrela otra vez).
- Su partida guardada es independiente de la del APK.
- **Activar una sola vez:** en GitHub, *Settings → Pages → Build and deployment →
  Source: «Deploy from a branch» → Branch: `gh-pages` / `(root)` → Save*.

### Opción B — APK con actualizaciones automáticas (Obtainium)

- Enlace fijo al último APK: **https://github.com/porcellana/HQ/releases/latest/download/ecos-del-abismo.apk**
- Mejor aún: instala [Obtainium](https://github.com/ImranR98/Obtainium) (gratis, código abierto),
  pulsa **Añadir app**, pega `https://github.com/porcellana/HQ` y guarda. Te avisará de
  cada versión nueva y la instala con un toque.
- La primera vez Android pedirá permitir **«Instalar aplicaciones de origen desconocido»**
  (y Play Protect puede avisar: *Más detalles → Instalar de todas formas*).
- Las versiones nuevas se instalan **encima** sin desinstalar y conservan la partida
  (todos los APK se firman con la misma clave de depuración de `android-keystore/`).

### Opción C — A mano desde Actions

*Actions → APK Android (debug) →* última ejecución con ✅ *→ Artifacts*: descarga el
`.zip`, extrae el `.apk` e instálalo. También puedes lanzar una compilación con **Run workflow**.

### Compilar en local (opcional)

Si algún día instalas Android Studio:

```bash
npm run android:prepare      # build web + genera android/ + sincroniza
cd android && ./gradlew assembleDebug
# APK en android/app/build/outputs/apk/debug/app-debug.apk
```

La carpeta `android/` **no se versiona**: se genera con `scripts/prepare-android.mjs`,
que fija la orientación vertical, la versión y los iconos. Si necesitas cambiar algo
nativo, hazlo en ese script para que sea reproducible.

---

## Estructura del proyecto

```
.github/workflows/android-apk.yml   CI: tests + build + APK como artefacto
android-keystore/                   Clave de depuración fija (no secreta)
public/                             manifest PWA, service worker, iconos
resources/android/                  Iconos del lanzador Android
scripts/
  gen-icons.mjs                     Genera los iconos PNG desde pixel art en texto
  prepare-android.mjs               Genera/parchea el proyecto Capacitor
src/
  main.ts                           Punto de entrada
  app.ts                            Controlador: menús, partida, autoguardado, ciclo de vida
  engine/                           Motor genérico, NO conoce el contenido
    rng.ts                          Aleatorio con semilla (mulberry32)
    pathfinding.ts                  A* en rejilla (8 direcciones)
    camera.ts  input.ts  loop.ts  events.ts
  game/                             Reglas y estado de la partida (sin DOM, testeable)
    state.ts                        GameState: todo lo que se guarda
    game.ts                         Movimiento por turnos, zonas y salidas
    settings.ts                     Ajustes del jugador
    rules/dice.ts                   Dados D&D (1d20, 2d6+3…), modificadores
    rules/progression.ts            Curva de XP y niveles
    save/                           Guardado versionado + migraciones + almacenes
    world/zone.ts                   Mapa ASCII → rejilla de tiles
  gfx/                              Pixel art generado por código y renderizado
    palette.ts  tiles.ts  sprites.ts  renderer.ts
  ui/                               Interfaz DOM: HUD, minimapa, joystick, menús, diálogos
  data/                             *** TODO EL CONTENIDO *** (ver abajo)
    schema.ts                       Tipos de todo el contenido
    registry.ts                     Carga automática de las carpetas de datos
    config/                         tiles.ts, progression.json
    towns/  wilds/                  Zonas con mapa fijo
    classes/ items/ enemies/ quests/ dungeons/ loot_tables/   (hitos siguientes)
tests/                              Vitest
```

---

## Cómo añadir contenido

**Regla de oro:** el contenido se añade creando o editando archivos en `src/data/`.
`registry.ts` carga automáticamente cualquier `.ts` o `.json` nuevo de cada carpeta;
no hay que registrarlo en ningún sitio. Después, ejecuta `npm test`: los tests de
contenido detectan mapas rotos, ids duplicados, salidas sin destino, etc.

### Añadir un pueblo o zona salvaje

1. Copia `src/data/towns/aldea_brumaroja.ts` (o `src/data/wilds/bosque_sombrio.ts`)
   con otro nombre y cambia `id`, `name`, `kind`, `level` y `description`.
2. Dibuja el mapa en `map`: una fila de texto por línea, **todas del mismo ancho**.
   Caracteres disponibles (definidos en `src/data/config/tiles.ts`):

   | Car. | Tile | | Car. | Tile |
   |---|---|---|---|---|
   | `,` | hierba | | `T` | árbol |
   | `"` | flores | | `Y` | pino oscuro |
   | `=` | camino | | `B` | arbusto |
   | `p` | adoquines | | `R` | roca |
   | `.` | suelo de piedra | | `M` | tejado rojo |
   | `#` | muro de piedra | | `N` | tejado de pizarra |
   | `~` | agua | | `W` | pared de madera |
   | `b` | puente | | `+` | puerta |
   | `f` | valla | | `w` | pozo |
   | `s` | cartel | | `l` | farol |
   | `t` | lápida | | `C` | entrada de cueva |
   | `@` | inicio de partida | | `1`–`9` | salidas |

3. Las salidas son dígitos en el mapa y se configuran en `exits`:
   ```ts
   exits: {
     '1': { to: 'aldea_brumaroja', arrive: '2', label: 'Volver a la aldea' },
   },
   ```
   `arrive` es el dígito de la salida de la otra zona donde aparecerás. Para que se
   pueda volver, pon en la otra zona una salida con ese dígito que apunte aquí.
   Si `to` apunta a una zona que todavía no existe, el juego dice «está bloqueado
   por ahora» (útil para dejar caminos preparados).
4. Opcional: `darkness: 0.2` oscurece la zona y el héroe lleva un halo de luz.

### Añadir un tipo de casilla

1. Añade una entrada en `src/data/config/tiles.ts` con un `char` libre.
2. Si quieres un dibujo nuevo, crea un generador en `src/gfx/tiles.ts` (función que
   pinta 16×16 píxeles) y añádelo a `TILE_GENERATORS`.

### Ajustar la curva de experiencia

Edita `src/data/config/progression.json`:
XP para pasar del nivel N al N+1 = `round(xpBase × N^xpExponent)`.
Con los valores actuales (200 y 1,6): nivel 2 → 200 XP, nivel 3 → 606 más, etc.
`tests/balance.test.ts` simula la historia completa y avisa si la progresión se sale
de lo previsto (Cueva 3-5, Galerías 5-7, Cripta 7+, final 8-11).

### Añadir o modificar una clase

Cada clase es un archivo en `src/data/classes/` (mira `guerrero.ts`). Campos clave:

- `baseStats`: características iniciales; el jugador reparte 3 puntos más (máx. 17).
- `hitDie`: dado de golpe (PV = dado + CON al nivel 1, luego dado/2+1+CON por nivel).
- `resource`: nombre, abreviatura y crecimiento del recurso (maná, vigor…).
- `armorBonus`, `weapon`, `critRange`, `startingGold`, `traits`.
- `look.overlay`: plantilla de sprite de `src/gfx/sprites.ts` (`OVERLAYS`) y colores.
- `skills`: habilidades con `unlockLevel`, `cost`, `cooldown`, `range` y `effects`
  (`attack`, `spell`, `heal`, `buff`, `stealth`, `cleanse`; ver `schema.ts`).

Cambiar los números de una clase también afecta a las partidas guardadas (los PV y
el recurso máximos se recalculan al cargar).

### Añadir un enemigo

Crea o edita un archivo en `src/data/enemies/` (cada archivo exporta una lista):

```ts
{
  id: 'kobold', name: 'Kobold', family: 'goblinoide', level: 1,
  hp: '2d6', ac: 12, speed: 1, sight: 6, ai: 'melee',
  attack: { name: 'Lanza', toHit: 4, dice: '1d6', damageType: 'perforante', range: 1 },
  xp: 15, description: 'Pequeño reptil traicionero.',
  look: { shape: 'goblin', main: '#a05a2a', dark: '#5a2a10', accent: '#3a3a3a', eye: '#ffd040' },
},
```

- `ai`: `melee`, `ranged` (mantiene distancia), `caster` (usa `spells`), `skirmisher`
  (rápido) o `boss` (usa `spells` y `phases`).
- `attack.applyStatus`: `{ id: 'veneno' | 'sangrado' | 'quemado' | 'aturdido' | 'ralentizado', chance, turns }`.
- `resist` / `vulnerable` / `immune`: tipos de daño y estados.
- `look.shape`: `goblin`, `esqueleto`, `lobo`, `rata`, `arana` o `humanoide` (con
  `overlay`: `guerrero`, `picaro`, `mago`, `clerigo`); `crown: true` para jefes. Las
  formas están en `src/gfx/monsters.ts` como pixel art en texto.
- `phases` (jefes): al bajar de `hpBelow` (0..1) muestra `message`, puede invocar
  (`summon`), curarse (`heal`) o enfurecerse (`toHitBonus`, `damageBonus`).

### Encuentros aleatorios de una zona

En la zona (p. ej. `bosque_sombrio.ts`) añade `encounters`:

```ts
encounters: {
  initial: 4,            // grupos al entrar
  perStepChance: 0.04,   // probabilidad por paso de un grupo nuevo
  maxActive: 8,
  groups: [{ enemy: 'goblin', weight: 4, min: 1, max: 3 }],
},
```

### Reglas de combate (resumen)

- Ataque: d20 + bonificador contra la CA. **20 natural = crítico** (dados de daño ×2) y
  **1 natural = pifia**. Ventaja/desventaja: se tiran 2d20 y se queda el mejor/peor
  (sigilo da ventaja; el veneno, desventaja).
- Hechizos con salvación: el objetivo tira d20 + bonificador contra CD = 8 +
  competencia + modificador; si la supera, recibe la mitad.
- Estados: veneno (1d4/turno y desventaja), sangrado (1d4/turno), quemado
  (1d6/turno), aturdido (pierde el turno), ralentizado (actúa un turno de cada dos, −2 CA).
- XP por enemigo = base × multiplicador por diferencia de nivel: +25 % por nivel por
  encima (máx. ×2) y −20 % por nivel por debajo; 5 o más niveles por debajo = ×0,05.
  Descubrir una zona salvaje da 20 × su nivel.
- Huir: d20 + DES + competencia contra CD 10 + nivel del enemigo más fuerte (no se
  puede huir de un jefe).
- Morir: despiertas en la aldea con la mitad de la vida y pierdes el 10 % del oro.
- Fuera de combate recuperas 1 PV cada 5 turnos y 1 punto de recurso cada 3.

### Añadir un objeto

Los objetos están en `src/data/items/` (armas, armaduras, accesorios y herramientas,
consumibles, materiales). Ejemplo de arma:

```ts
{ id: 'lanza', name: 'Lanza', kind: 'arma', slot: 'arma', level: 2, value: 12,
  icon: { shape: 'espada', color: '#b8bec8' },
  weapon: { type: 'espada', dice: '1d8', stat: 'FUE', damageType: 'perforante', range: 1 } },
```

- `slot`: `cabeza`, `pecho`, `manos`, `piernas`, `pies`, `arma`, `secundaria`,
  `herramienta` o `accesorio` (anillos/amuletos: hay 2 ranuras).
- `armor: { ac, maxDex }` para armaduras y escudos; `stats: { FUE: 1, pv: 5 }` para bonos
  fijos (`FUE…CAR`, `ca`, `ataque`, `daño`, `pv`, `recurso`).
- Consumibles: `stackable: true` y `use: { heal: '2d4+2' }` (también `restore`,
  `cleanse`, `buff`, `outOfCombatOnly`).
- `level`: a partir de qué nivel de botín aparece. `value`: precio base en oro.
- `icon.shape`: una forma de `src/gfx/items.ts` (espada, hacha, arco, baston, daga, maza,
  casco, capucha, pecho, guantes, piernas, botas, escudo, libro, simbolo, pico, anillo,
  amuleto, pocion, pan, carne, colmillo, piel, seda, polvo, mineral, gema, saco) y un color.
- `plain: true`: nunca recibe bonos aleatorios.

**Rarezas** (`src/data/config/rarities.ts`): común, poco común, raro, épico y legendario.
Cada una da más bonos aleatorios, multiplica el precio y suma poder (daño o CA). A más
nivel del botín, más probables las rarezas altas.

### Tablas de botín

En `src/data/loot_tables/` (cada enemigo indica la suya con `lootTable`):

```ts
{ id: 'goblin', rolls: [1, 1], gold: [1, 4], goldChance: 0.7,
  entries: [
    { nothing: true, weight: 40 },
    { item: 'colmillo_goblin', weight: 25, min: 1, max: 2 },
    { pool: 'armas', weight: 7 },        // arma aleatoria de nivel adecuado, con rareza
  ] }
```

`pool` puede ser `equipo`, `armas`, `armaduras` o `accesorios`. El oro se multiplica por el
nivel del enemigo.

### Equipo inicial de una clase

En la clase, `startingItems: [{ item: 'espada_larga', equip: true }, { item: 'pocion_curacion', qty: 2 }]`.

### Añadir un pueblo, un lugar (interior) y un PNJ

1. **Pueblo o ciudad**: igual que cualquier zona (`src/data/towns/`). Las puertas de los
   edificios son salidas con dígito y `door: true`:
   ```ts
   exits: {
     '3': { to: 'mi_tienda', arrive: '1', label: 'Tienda', tile: 'puerta', door: true },
   },
   ```
2. **Interior**: usa el ayudante `interior()` de `src/data/helpers.ts` (mira
   `aldea_interiores.ts`). La salida `1` del interior vuelve a la puerta del pueblo:
   ```ts
   interior('mi_tienda', 'Tienda de Rufo', 'mi_pueblo', '3', [
     '###########',
     '#EEEEEEEEE#',
     '#:::::::::#',
     '#KKKKKK:::#',
     '#:::::::::#',
     '#####1#####',
   ]),
   ```
   Tiles de interior: `:` madera, `r` alfombra, `K` mostrador, `O` mesa, `X` barril,
   `E` estantería, `A` altar, `H` chimenea, `Z` cama, `U` yunque, `D` muelle, `L` farola.
   En un templo, `@` marca dónde reapareces al caer.
3. **PNJ** (`src/data/npcs/`): zona, casilla (`x`, `y` desde 0, transitable), aspecto y
   diálogo. Lo más cómodo es `npcDialog()`:
   ```ts
   {
     id: 'rufo', name: 'Rufo', title: 'Tendero', zone: 'mi_tienda', x: 3, y: 2,
     look: { cloth: '#3a6a4a', clothDark: '#1f3a2a', pants: '#3a3028', hair: '#3a2418' },
     dialog: npcDialog({
       greeting: '¡Bienvenido!',
       shop: 'tienda_rufo',          // abre una tienda
       // inn: 15,                   // posada: descansar por 15 de oro
       // temple: 4,                 // templo: sanación por 4 × nivel de oro
       quests: true,                 // muestra sus misiones
       rumors: ['Dicen que...', 'He oído que...'],
     }),
   },
   ```
   Para un diálogo propio escribe los nodos a mano: `dialog: { inicio: { text, options: [...] } }`.
   Cada opción puede ir a otro nodo (`goto`) o hacer algo (`action`: `shop`, `inn`,
   `temple`, `quests`, `flag`, `end`), y mostrarse sólo si se cumple `ifFlag` o `ifQuest`.
   Un PNJ tras un mostrador se puede hablar a 2 casillas.

### Añadir una tienda

En `src/data/shops/`:

```ts
{ id: 'tienda_rufo', name: 'Tienda de Rufo', priceMult: 1.05, restockTurns: 250, level: 2,
  buys: ['consumible', 'material'],            // qué compra (omitir = todo)
  stock: [
    { item: 'pocion_curacion', qty: [3, 6] },
    { item: 'pico_hierro', chance: 0.5 },
    { pool: 'armas', count: [1, 2] },          // equipo aleatorio con rareza
  ] }
```

- Precio de compra = valor del objeto × `priceMult` × (1 − 2 % por punto de modificador
  de CAR, máx. −10 %).
- Precio de venta = valor × `priceMult` × (35 % + 3 % por punto de CAR, entre 20 % y 50 %).
- Lo que vendes queda a la venta en la tienda (puedes recomprarlo).
- El stock se renueva cada `restockTurns` turnos (dormir en una posada pasa 100 turnos).

### Añadir una misión

En `src/data/quests/` (principal, secundarias o encargos del gremio):

```ts
{ id: 'cazar_ratas', name: 'Ratas', kind: 'secundaria', giver: 'rufo',
  description: 'Rufo tiene ratas en el almacén.',
  objectives: [{ type: 'kill', enemy: 'rata_gigante', count: 5, label: 'Mata ratas' }],
  completeText: '¡Gracias!',
  rewards: { xp: 50, gold: 20, items: [{ item: 'pocion_curacion', qty: 1 }] } }
```

- Objetivos: `kill` (`enemy` o `family`), `collect` (se consumen al entregar), `visit`
  (zona) y `talk` (PNJ).
- `turnIn`: a quién se entrega (por defecto, a quien la da). `requires`: misiones previas.
  `minLevel`. `rewards.flag`: pone una bandera de historia.
- `kind: 'repetible'` + `cooldownTurns`: vuelve a estar disponible tras ese tiempo.
- Los PNJ con misión nueva muestran ❗ y con misión para entregar, ❓.

### Añadir una mazmorra

Crea un archivo en `src/data/dungeons/` (mira `cueva_goblin.ts`):

```ts
{ id: 'minas_olvidadas', name: 'Minas olvidadas', description: '...',
  level: 4, floors: 2, width: 40, height: 40, rooms: [7, 10],
  wallTile: 'muro_cueva', floorTile: 'suelo_cueva', darkness: 0.25,
  surface: { zone: 'paso_gris', arrive: '4' },        // salida que lleva aquí
  floorEncounters: [ { initial: 4, perStepChance: 0.012, maxActive: 9, groups: [...] } ],
  chestLoot: 'cofre', chestsPerFloor: [2, 3], lockedChance: 0.4,
  trapsPerFloor: [2, 4], traps: ['pinchos', 'dardos', 'fuego'],
  oresPerFloor: [2, 3], ores: ['hierro', 'plata'],
  boss: { enemy: 'rey_goblin', guards: [{ enemy: 'goblin', x: 5, y: 5 }],
          map: [ /* mapa fijo: '1' subir, '3' salida a la superficie, 'X' el jefe */ ] },
  requiresFlag: 'minas_abiertas', lockedText: 'La entrada está tapiada.' }   // opcional
```

Luego, en la zona de la superficie, pon un dígito en el mapa y en `exits`:
`'4': { to: 'minas_olvidadas', arrive: '1', label: 'Minas olvidadas', tile: 'cueva' }`.
Las zonas de cada piso se llaman `<id>` (piso 1), `<id>__p2`, `<id>__p3`… y `<id>__jefe`.

- **Generación**: cada piso sale de la semilla de la partida + id + piso + reinicio. Es el
  mismo cada vez que entras en esa partida (puedes guardar dentro) y distinto en otra.
  Salas unidas por pasillos, escaleras de subida en la primera sala y de bajada en la más
  lejana; cofres y vetas en esquinas sin cortar el paso; trampas dentro de salas.
- **Rejugar**: tras vencer al jefe, la siguiente vez que entres desde la superficie la
  mazmorra se regenera (nueva semilla, cofres y jefe nuevos).
- **Elementos fijos en cualquier zona**: `features: [{ kind: 'mineral', x, y, ore: 'hierro' },
  { kind: 'cofre', x, y, locked: true, loot: 'cofre', level: 3 }, { kind: 'trampa', x, y, trap: 'pinchos' }]`.
  Fuera de las mazmorras las vetas vuelven a crecer con el tiempo.
- **Trampas** (`src/data/config/traps.ts`) y **minerales** (`src/data/config/ores.ts`):
  CD, daño, estado, objeto que dan, golpes necesarios y nivel de pico.
- **Jefes**: cualquier enemigo con `boss: true` y `phases`. Al vencerlo se pone la
  bandera `boss_<id>` (úsala en misiones o diálogos con `ifFlag`).

---

## Guardado y actualizaciones (para no romper partidas)

- La partida se guarda en un «sobre» con `saveVersion` (formato de datos) y
  `gameVersion` (versión del juego que la guardó).
- **Autoguardado**: al cambiar de zona, cada 40 turnos, al pausar/salir de la app
  (Android `pause`, `visibilitychange` y `pagehide` en navegador) y al salir al menú.
- Antes de sobrescribir se guarda una **copia de seguridad**; si el guardado
  principal está dañado se carga la copia automáticamente.
- En Android se guarda en `Preferences` nativas **y** en `localStorage`; al cargar
  se usa el más reciente.

**Si cambias la forma de `GameState`** (añadir, renombrar o quitar campos):

1. Sube `CURRENT_SAVE_VERSION` en `src/game/save/migrations.ts`.
2. Añade en `MIGRATIONS` una función con clave = versión anterior que convierta
   los datos viejos:
   ```ts
   export const CURRENT_SAVE_VERSION = 2;
   export const MIGRATIONS = {
     1: (s) => ({ ...s, inventory: [] }),
   };
   ```
3. `npm test` falla si falta algún paso de migración.

## Cómo seguir ampliando el juego

Pasos clave (cada uno es editar datos; el motor no se toca):

1. **Contenido nuevo**: añade archivos en `src/data/` (zonas, PNJ, misiones, objetos,
   enemigos, tablas de botín, mazmorras). Las secciones de arriba explican cada tipo.
2. **Ejecuta `npm test`**: los tests de contenido detectan mapas rotos, ids repetidos,
   salidas sin destino, misiones que apuntan a PNJ u objetos inexistentes y saltos en
   la progresión.
3. **Si cambias la forma de la partida guardada**, sube `CURRENT_SAVE_VERSION` y añade una
   migración (ver «Guardado y actualizaciones»).
4. **Prueba en el navegador** (`npm run dev`; en desarrollo `window.__game` y
   `window.__app` permiten saltar a una zona o dar XP desde la consola) y haz push: la web
   y el APK se actualizan solos.

Ideas pendientes para próximas versiones:

- **Mapa del mundo** con viaje rápido entre pueblos visitados.
- **Más ciudades y regiones** (montañas, pantano, desierto) con sus mazmorras.
- **Artesanía**: usar los materiales (mineral, seda, pieles, gemas) en el herrero y el
  alquimista.
- **Durabilidad** y reparación de equipo (opcional según el diseño original).
- **Más habilidades** por clase a niveles 12-20 y subclases.
- Enemigos que se muevan en grupo, emboscadas y PNJ con rutinas.
- Música (ahora sólo hay efectos de sonido generados por código).
- Logros y estadísticas más detalladas.

## Publicar una versión nueva

1. Sube `version` en `package.json` (aparece en el menú principal y en el APK).
2. Añade una entrada arriba del todo en `CHANGELOG.md`.
3. Commit + push → GitHub Actions genera el APK.

---

## Decisiones de diseño

- **Canvas 2D puro + DOM en lugar de Phaser.** El mapa se pre-renderiza una vez
  por zona en un canvas oculto y cada fotograma sólo se copia la parte visible: va
  fluido en móviles modestos y el bundle pesa ~20 KB comprimido. Los menús y el HUD
  son HTML/CSS: textos grandes, accesibles y fáciles de maquetar.
- **Todo es por turnos, estilo roguelike.** Cada paso o acción del jugador consume
  un turno; en el Hito 3 los enemigos actuarán después de cada turno del jugador,
  de modo que el combate ocurre en el mismo mapa sin cambiar de pantalla.
- **Movimiento en 8 direcciones** sin cortar esquinas, con A*.
- **Contenido en TypeScript (o JSON).** Los `.ts` con `satisfies Tipo` dan
  autocompletado y errores en el editor; los `.json` también se aceptan.
- **Mapas fijos en ASCII** (fáciles de editar a mano) y mazmorras procedurales con
  semilla (Hito 6).
- **Pixel art generado por código** (16×16, escala entera): sin assets con copyright
  y con varias variantes por tile para que el suelo no se vea repetido.
- **Proyecto Android generado en CI** con un keystore de depuración fijo, para que
  las actualizaciones del APK se instalen encima sin perder la partida.
- **Nombres de la versión:** cada hito subió el parche (0.0.1 … 0.0.6) y el Hito 7
  completo es la **v0.1.0**.
- La interfaz deja libre el centro: la cámara centra al héroe en el hueco entre el
  HUD superior y la barra de botones inferior.
- **Mundo del Hito 5**: Aldea de Brumaroja (alcalde, capilla, herrería, tienda y
  taberna-posada), Bosque Sombrío al norte, Paso Gris al sur y la ciudad de Puerto
  Ceniza (gremio, templo, Forja del Ancla, alquimista, posada y mercado). Para no repetir
  lugares, la aldea tiene taberna-posada y capilla, y el gremio y el alquimista están en
  la ciudad.
- Los PNJ están quietos en su sitio (más fácil encontrarlos en móvil).
- El stock de las tiendas y el estado de las misiones se guardan en la partida
  (guardado v4). El botín del suelo no se guarda.
- **Mazmorras (Hito 6)**: Cueva de los Colmillos (nivel 2-3, 2 pisos, jefe Gruñaz),
  Galerías de Seda (nivel 5-7, 3 pisos, jefa Mórgala) y Cripta de Velkar (nivel 8-10,
  3 pisos, jefe Velkar). La cripta está sellada con la bandera `cripta_abierta`, que
  pondrá la historia del Hito 7. Se añadieron 3 enemigos para los pisos profundos
  (araña cazadora, caballero esqueleto y espectro).
- Los enemigos, el botín del suelo, las trampas detectadas y los golpes de pico a medias
  no se guardan; sí se guardan los cofres abiertos, las trampas usadas, las vetas
  agotadas y el progreso de cada mazmorra (guardado v5).
- La salida de la sala del jefe se abre con la bandera del jefe; al rejugar una mazmorra
  ya está abierta (comodidad).
- Equilibrio: limpiar una mazmorra a su nivel da ~1 nivel (hay un test que lo vigila).
- Ajustes: joystick, mano dominante (lado del joystick y los botones), velocidad,
  tamaño de interfaz, cuadrícula, vibración, sonido, volumen y día/noche.
- **Historia (Hito 7)**: 7 capítulos. Las misiones no bloquean por nivel (la
  descripción recomienda uno); el capítulo 5 pone la bandera `cripta_abierta` y el 7, la
  bandera `victoria`, que muestra la pantalla final con estadísticas (guardado v6). Tras
  el final se puede seguir jugando con el mismo personaje.
- **Equilibrio v0.1.0**: curva base 220 → 200 (exponente 1,6 sin tocar); más XP en los
  capítulos 4-7 (2000, 2500, 3000 y 500); jefes más justos: Gruñaz con un escolta menos
  y menos daño en cólera, Mórgala con menos vida y una tejedora en lugar de dos, y Velkar
  con 14d8+14 PV, CA 14, rayo 3d8 cada 2 turnos, menos invocaciones y menos curación (su
  guarida ya no tiene caballero esqueleto). Simulado con un bot: Velkar es muy difícil a
  nivel 8 y asumible a 9-10 con pociones.
- **Sonido**: efectos generados con WebAudio (golpe, crítico, fallo, herida, moneda,
  cofre, misión, nivel, muerte y victoria), sin archivos. Sin música todavía.
- **Día y noche**: un día dura 600 turnos; de noche los exteriores se oscurecen con un
  tinte azul (se puede desactivar en Ajustes). Interiores y mazmorras no cambian.
- **Guía al objetivo**: la zona del siguiente paso se calcula con una búsqueda en el
  grafo de salidas (`src/game/quests/guide.ts`); dentro de una mazmorra la flecha verde
  baja hacia el jefe o sube hacia la salida.
- **APK**: pantalla de inicio oscura con el héroe (generada en `prepare-android.mjs`, sin
  plugins) y el botón Atrás cierra cualquier pantalla abierta o vuelve al menú principal.
