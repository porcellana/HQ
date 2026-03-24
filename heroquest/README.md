# HeroQuest Generador Quality v3

## Generación de mapa — BSP (Binary Space Partition)

Reescritura completa del sistema de generación:

- **Todo el tablero es jugable**: sin pasillos vacíos, todas las celdas interiores son habitaciones
- **Subdivisión binaria (BSP)**: el espacio interior se subdivide recursivamente en hojas, cada hoja es una sala
- **Muros de piedra entre salas**: las líneas de corte BSP son muros de 1 tile, visualmente como bordes de piedra
- **Puertas en los muros**: cada par de salas adyacentes tiene 1-2 puertas en su muro compartido
- **Colores por sala**: cada habitación tiene un color de suelo distinto, inspirado en el tablero clásico de HeroQuest (16 tonos)
- **Fog of war por puertas**: al abrir una puerta se revela la sala contigua
- **Sala de inicio** (primera sala, arriba-izquierda) y **sala del jefe** (última, abajo-derecha)

## Mecánicas de juego conservadas

- Turnos por héroe: tirar dados → moverse → atacar → abrir puertas
- 4 clases de héroe con habilidades únicas (Bárbaro, Arquero, Mago, Enano)
- Enemigos con IA de persecución y combate
- Cofres con loot por tiers (normal/valioso/principal)
- Trampas, armería, salida
- Sistema de inventario y equipamiento
- Guardar/cargar partida
- Overlay de fin de partida (victoria/derrota)

## Controles del generador

- **Ancho/Alto**: tamaño del tablero (mín 18×10, máx 80×50)
- **Enemigos**: cantidad de enemigos normales
- **Héroes**: 1–4 héroes
- **Salas**: número de habitaciones BSP (2–12)
- **Estilo**: clásico/fortaleza/catacumba (visual)
