# Bot de copytrading Telegram → MetaTrader 5

Escucha canales de señales de Telegram, parsea las señales de texto y abre la
operación correspondiente en MetaTrader 5, con lotaje calculado por riesgo y
seguimiento del resultado por canal.

## Archivos

| Archivo | Contenido |
|---|---|
| `bot_copytrading.py` | Punto de entrada: escucha Telegram, ejecuta en MT5, sigue posiciones |
| `parser_senales.py` | Parseo de texto → señal. Módulo puro, sin MT5 ni Telethon |
| `test_parser.py` | Pruebas del parseo, ejecutables sin MT5 ni Windows |

## Requisitos

- Windows con el terminal de **MetaTrader 5** instalado y con sesión abierta
  (el paquete `MetaTrader5` solo funciona en Windows y se conecta al terminal
  que esté corriendo en la máquina).
- Python 3.8+
- "Algo Trading" habilitado en el terminal MT5.
- Cuenta de Telegram que ya sea miembro de los canales configurados.

## Instalación

```bash
pip install -r requirements.txt
```

## Configuración

Las credenciales de Telegram se leen del entorno, **no** están en el código.
Copiar `.env.example` a `.env` y rellenarlo, o exportar las variables a mano:

```powershell
$env:TELEGRAM_API_ID = "..."
$env:TELEGRAM_API_HASH = "..."
```

`api_id` y `api_hash` se obtienen en https://my.telegram.org → *API development tools*.

En el primer arranque Telethon pide el teléfono y el código de verificación, y
guarda la sesión en `sesion_copytrading.session`. **Ese archivo da acceso a la
cuenta de Telegram**: está en `.gitignore` y no debe compartirse ni subirse.

### Canales

El diccionario `CANALES` en `bot_copytrading.py` mapea el `chat_id` de cada canal
a un nombre legible y a un `magic number` único, que es lo que permite atribuir
cada operación en MT5 al canal que la originó.

### Parámetros de riesgo

| Constante | Valor | Significado |
|---|---|---|
| `RIESGO_PORCENTAJE` | `0.02` | 2 % del balance arriesgado por operación (se calcula con la distancia al SL) |
| `VOLUMEN_RESPALDO` | `0.01` | Lotaje usado cuando la señal no trae SL y no se puede dimensionar el riesgo |
| `DESVIACION` | `20` | Slippage máximo aceptado, en puntos |

## Uso

```bash
python bot_copytrading.py
```

El bot imprime en consola cada señal detectada, el resultado de la orden, y —
cuando una posición se cierra — el P&L de esa operación más un resumen acumulado
por canal.

Para comprobar el parseo sin tocar MT5 ni la cuenta:

```bash
python test_parser.py
```

## Formatos de señal reconocidos

La dirección (`BUY`/`SELL`/`LONG`/`SHORT`) y el par se buscan por separado, así
que no necesitan ir pegados en el mensaje. Se aceptan pares con separador
(`EUR/USD`, `XAU-USD`) y sin él (`XAUUSD`), más los alias `GOLD`/`XAU` y
`SILVER`/`XAG`. Se extraen además `ENTRY`, `SL`/`STOP LOSS` y `TP`/`TAKE
PROFIT`/`TARGET` (varios niveles).

Una señal sin SL **ni** TP se descarta, para evitar ejecutar mensajes de
comentario o de seguimiento como si fueran entradas nuevas.

Solo se envía a MT5 el **primer TP**; los niveles restantes se parsean pero no
se usan (no hay gestión parcial de posición).

El índice de nivel (`TP1`, `SL2`) se distingue del precio: `SL 3340` se lee como
precio 3340, no como nivel 33 y precio 40. Esto solo afectaba a instrumentos con
precio entero — es decir, al oro, que es la mayoría de estos canales.

## Limitaciones conocidas

- El símbolo se usa tal cual (`XAUUSD`). Los brókers que añaden sufijo
  (`XAUUSD.m`, `EURUSD.pro`) harán que la orden se descarte por símbolo no
  reconocido.
- Se ejecuta a mercado al precio actual, ignorando el rango de entrada de la
  señal: si el mensaje llega tarde, la entrada puede quedar lejos de la zona
  indicada.
- No se procesan mensajes de gestión posteriores (mover SL a *break even*,
  cerrar mitad, cancelar señal).
- El resumen acumulado vive en memoria: se reinicia al reiniciar el bot.
