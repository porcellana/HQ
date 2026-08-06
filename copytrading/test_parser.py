"""Pruebas del parseo de señales. No requiere MetaTrader5 ni Windows.

    python test_parser.py
"""

from parser_senales import parsear_señal

CASOS = [
    # (mensaje, esperado, descripción)
    (
        "GOLD BUY NOW 3350\nSL 3340\nTP1 3360 TP2 3370",
        {'direccion': 'BUY', 'par': 'XAUUSD', 'sl': 3340.0, 'tp': [3360.0, 3370.0]},
        "SL sin dos puntos e índices pegados: el precio entero no debe recortarse",
    ),
    (
        "SELL EUR/USD\nEntry: 1.0850\nStop Loss: 1.0880\nTake Profit 1.0800",
        {'direccion': 'SELL', 'par': 'EURUSD', 'entrada_min': 1.0850, 'entrada_max': 1.0850,
         'sl': 1.0880, 'tp': [1.0800]},
        "Forex con decimales y palabras clave completas",
    ),
    (
        "XAUUSD sell 3400-3405\nSL: 3415\nTP 3380",
        {'direccion': 'SELL', 'par': 'XAUUSD', 'entrada_min': 3400.0, 'entrada_max': 3405.0,
         'sl': 3415.0, 'tp': [3380.0]},
        "Rango de entrada",
    ),
    (
        "Long AUDUSD\nTP 0.6650\nSL 0.6600",
        {'direccion': 'BUY', 'par': 'AUDUSD', 'sl': 0.6600, 'tp': [0.6650]},
        "LONG como alias de BUY, con TP antes que SL",
    ),
    (
        "BUY XAUUSD\nSTOP LOSS 3345\nTAKE PROFIT 1: 3365\nTAKE PROFIT 2: 3380",
        {'direccion': 'BUY', 'par': 'XAUUSD', 'sl': 3345.0, 'tp': [3365.0, 3380.0]},
        "Índice de nivel separado por espacio pero seguido de separador",
    ),
    (
        "sell gold\nsl - 3420\ntp = 3390",
        {'direccion': 'SELL', 'par': 'XAUUSD', 'sl': 3420.0, 'tp': [3390.0]},
        "Separadores '-' y '=' en minúsculas",
    ),
    (
        "BUY XAGUSD\nSL 38\nTP 42",
        {'direccion': 'BUY', 'par': 'XAGUSD', 'sl': 38.0, 'tp': [42.0]},
        "Precios de dos dígitos: no confundirlos con índices de nivel",
    ),
    (
        "SHORT GBPJPY\nSL: 195.50\nTP: 193.20",
        {'direccion': 'SELL', 'par': 'GBPJPY', 'sl': 195.50, 'tp': [193.20]},
        "SHORT como alias de SELL, par cruzado",
    ),
    (
        "Good morning traders, market looks bullish today",
        None,
        "Mensaje sin dirección ni par",
    ),
    (
        "buy gold\nresults yesterday were great",
        None,
        "Dirección y par pero sin SL ni TP: no es una entrada",
    ),
]


def main():
    fallos = 0
    for mensaje, esperado, descripcion in CASOS:
        obtenido = parsear_señal(mensaje)
        if obtenido == esperado:
            print(f"  ok   {descripcion}")
        else:
            fallos += 1
            print(f"  FALLA {descripcion}")
            print(f"        mensaje:  {mensaje!r}")
            print(f"        esperado: {esperado}")
            print(f"        obtenido: {obtenido}")

    print(f"\n{len(CASOS) - fallos}/{len(CASOS)} casos correctos")
    return 1 if fallos else 0


if __name__ == '__main__':
    raise SystemExit(main())
