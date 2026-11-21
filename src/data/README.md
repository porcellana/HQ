# Datos del juego

Aquí vive **todo el contenido**. El motor (`src/engine`, `src/game`) no conoce
pueblos, enemigos ni objetos concretos: los lee de estas carpetas a través de
`registry.ts`, que carga automáticamente cualquier archivo `.ts` o `.json`
nuevo con un `export default` (objeto o lista).

| Carpeta        | Contenido                                   | Disponible desde |
|----------------|---------------------------------------------|------------------|
| `config/`      | Tiles del mapa, curva de XP y ajustes globales | Hito 1        |
| `towns/`       | Pueblos y ciudades (mapas ASCII)            | Hito 1           |
| `wilds/`       | Zonas salvajes (mapas ASCII)                | Hito 1           |
| `classes/`     | Clases jugables                             | Hito 2           |
| `enemies/`     | Enemigos y jefes                            | Hito 3           |
| `items/`       | Armas, armaduras, consumibles, materiales   | Hito 4           |
| `loot_tables/` | Tablas de botín                             | Hito 4           |
| `quests/`      | Misiones principales, secundarias y repetibles | Hito 5        |
| `npcs/`        | PNJ: posición, aspecto y diálogo            | Hito 5           |
| `shops/`       | Tiendas: stock, precios y renovación        | Hito 5           |
| `dungeons/`    | Mazmorras procedurales y salas de jefe      | Hito 6           |

`helpers.ts` contiene ayudantes (`interior()`, `npcDialog()`); no es una carpeta de
datos. Los tipos de cada cosa están en `schema.ts`. Usa `satisfies TipoDef` en los
archivos `.ts` para que el editor te marque errores al escribir.
