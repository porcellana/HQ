import os
import sys
import asyncio
import MetaTrader5 as mt5
from telethon import TelegramClient, events
from colorama import init, Fore, Style

from parser_senales import parsear_señal

init()

# --- Configuración Telegram ---
# Credenciales desde variables de entorno (ver .env.example).
# Nunca escribir api_id / api_hash directamente en este archivo.
api_id = os.environ.get('TELEGRAM_API_ID')
api_hash = os.environ.get('TELEGRAM_API_HASH')
nombre_sesion = os.environ.get('TELEGRAM_SESSION', 'sesion_copytrading')

if not api_id or not api_hash:
    print(f"{Fore.RED}Faltan TELEGRAM_API_ID y/o TELEGRAM_API_HASH en el entorno. "
          f"Ver .env.example{Style.RESET_ALL}")
    sys.exit(1)

api_id = int(api_id)

CANALES = {
    -1001969924916: {"nombre": "TORO FX", "magic": 100001},
    -1001765226347: {"nombre": "Ben, Gold Trader", "magic": 100002},
    -1002144761347: {"nombre": "TOP 1% TRADES", "magic": 100003},
    -1001235920908: {"nombre": "ORO/DÓLAR VIP", "magic": 100004},
    -1001215049720: {"nombre": "UnitedSignals", "magic": 100005},
    -1002234718042: {"nombre": "GoldSignals.io", "magic": 100006},
    -1003944795256: {"nombre": "1000pips Builder", "magic": 100007},
    -100315847855: {"nombre": "Vasily Trader", "magic": 100008},
    -1002083247020: {"nombre": "Kai | Trading", "magic": 100009},
    -1001273443639: {"nombre": "TSA FREE TRADES", "magic": 100010},
    -1001868019139: {"nombre": "Gold Signals VIP", "magic": 100011},
    -1001196272579: {"nombre": "TopTradingSignals", "magic": 100012},
}

RIESGO_PORCENTAJE = 0.02
VOLUMEN_RESPALDO = 0.01  # si no hay SL, no se puede calcular riesgo real
DESVIACION = 20

cliente = TelegramClient(nombre_sesion, api_id, api_hash)

posiciones_seguidas = {}
resumen_canales = {}


def calcular_volumen(simbolo, precio_entrada, sl):
    """Calcula el lotaje para arriesgar RIESGO_PORCENTAJE del capital según la distancia al SL."""
    info = mt5.symbol_info(simbolo)
    cuenta = mt5.account_info()

    if info is None or cuenta is None or not sl:
        return VOLUMEN_RESPALDO

    distancia_precio = abs(precio_entrada - sl)
    if distancia_precio <= 0 or info.trade_tick_size <= 0:
        return VOLUMEN_RESPALDO

    distancia_ticks = distancia_precio / info.trade_tick_size
    perdida_por_lote = distancia_ticks * info.trade_tick_value
    if perdida_por_lote <= 0:
        return VOLUMEN_RESPALDO

    riesgo_dinero = cuenta.balance * RIESGO_PORCENTAJE
    volumen = riesgo_dinero / perdida_por_lote

    volumen = max(info.volume_min, min(info.volume_max, volumen))
    pasos = round(volumen / info.volume_step)
    volumen = round(pasos * info.volume_step, 2)

    return volumen if volumen > 0 else VOLUMEN_RESPALDO


def ejecutar_orden(señal, magic, nombre_canal):
    if not mt5.initialize():
        print(f"{Fore.RED}Error al conectar con MT5: {mt5.last_error()}{Style.RESET_ALL}")
        return None

    simbolo = señal['par']
    info = mt5.symbol_info(simbolo)
    if info is None:
        print(f"{Fore.RED}Símbolo {simbolo} no reconocido por el bróker, orden ignorada{Style.RESET_ALL}")
        mt5.shutdown()
        return None

    tick = mt5.symbol_info_tick(simbolo)
    if tick is None:
        print(f"{Fore.RED}No se pudo obtener precio de {simbolo}{Style.RESET_ALL}")
        mt5.shutdown()
        return None

    tipo_orden = mt5.ORDER_TYPE_BUY if señal['direccion'] == 'BUY' else mt5.ORDER_TYPE_SELL
    precio = tick.ask if señal['direccion'] == 'BUY' else tick.bid

    volumen = calcular_volumen(simbolo, precio, señal.get('sl'))

    solicitud = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": simbolo,
        "volume": volumen,
        "type": tipo_orden,
        "price": precio,
        "sl": señal.get('sl', 0.0),
        "tp": señal.get('tp', [0.0])[0] if señal.get('tp') else 0.0,
        "deviation": DESVIACION,
        "magic": magic,
        "comment": nombre_canal[:20],
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    resultado = mt5.order_send(solicitud)
    mt5.shutdown()

    if resultado and resultado.retcode == 10009:
        posiciones_seguidas[resultado.order] = {"canal": nombre_canal}
        if nombre_canal not in resumen_canales:
            resumen_canales[nombre_canal] = {"operaciones": 0, "ganancia_total": 0.0}

    return resultado


@cliente.on(events.NewMessage(chats=list(CANALES.keys())))
async def manejar_mensaje(evento):
    info_canal = CANALES[evento.chat_id]
    nombre_canal = info_canal["nombre"]
    texto = evento.raw_text

    señal = parsear_señal(texto)
    if señal is None:
        return

    print(f"{Fore.GREEN}{Style.BRIGHT}=== SEÑAL DETECTADA en [{nombre_canal}] ==={Style.RESET_ALL}")
    print(f"{Fore.GREEN}{texto}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}Parseada: {señal}{Style.RESET_ALL}")

    resultado = ejecutar_orden(señal, info_canal["magic"], nombre_canal)
    if resultado and resultado.retcode == 10009:
        print(f"{Fore.GREEN}{Style.BRIGHT}✔ Orden ejecutada (ticket {resultado.order}, volumen {resultado.volume}){Style.RESET_ALL}")
    else:
        print(f"{Fore.RED}{Style.BRIGHT}✘ Error al ejecutar orden: {resultado}{Style.RESET_ALL}")
    print(f"{Fore.GREEN}================================={Style.RESET_ALL}")


def imprimir_resumen():
    print(f"{Fore.CYAN}{Style.BRIGHT}--- RESUMEN POR CANAL ---{Style.RESET_ALL}")
    total_general = 0.0
    for canal, datos in resumen_canales.items():
        color = Fore.GREEN if datos["ganancia_total"] >= 0 else Fore.RED
        print(f"{color}{canal}: {datos['operaciones']} operaciones cerradas, resultado {datos['ganancia_total']:.2f} USD{Style.RESET_ALL}")
        total_general += datos["ganancia_total"]
    color_total = Fore.GREEN if total_general >= 0 else Fore.RED
    print(f"{color_total}{Style.BRIGHT}TOTAL: {total_general:.2f} USD{Style.RESET_ALL}")
    print(f"{Fore.CYAN}-------------------------{Style.RESET_ALL}")


async def monitor_posiciones():
    while True:
        await asyncio.sleep(15)
        if not posiciones_seguidas:
            continue
        if not mt5.initialize():
            continue

        tickets_abiertos = {p.ticket for p in mt5.positions_get() or []}

        for ticket in list(posiciones_seguidas.keys()):
            if ticket in tickets_abiertos:
                continue

            deals = mt5.history_deals_get(position=ticket)
            ganancia = sum(d.profit + d.swap + d.commission for d in deals) if deals else 0.0
            canal = posiciones_seguidas[ticket]["canal"]

            color = Fore.GREEN if ganancia >= 0 else Fore.RED
            print(f"{color}{Style.BRIGHT}--- OPERACIÓN CERRADA [{canal}] ticket {ticket}: {ganancia:.2f} USD ---{Style.RESET_ALL}")

            resumen_canales[canal]["operaciones"] += 1
            resumen_canales[canal]["ganancia_total"] += ganancia
            imprimir_resumen()

            del posiciones_seguidas[ticket]

        mt5.shutdown()


async def main():
    print(f"{Fore.CYAN}Bot de copytrading activo. Escuchando {len(CANALES)} canales... (Ctrl+C para detener){Style.RESET_ALL}")
    await cliente.start()
    cliente.loop.create_task(monitor_posiciones())
    await cliente.run_until_disconnected()


with cliente:
    cliente.loop.run_until_complete(main())
