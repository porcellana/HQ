"""Parseo de señales de texto de Telegram a una operación estructurada.

Módulo puro: solo depende de `re`, sin MetaTrader5 ni Telethon, para poder
probar la lógica de parseo en cualquier máquina (ver test_parser.py) y no solo
en un Windows con el terminal de MT5 abierto.
"""

import re

MONEDAS_VALIDAS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']


def normalizar_par(par_bruto):
    codigo = par_bruto.upper().replace('/', '').replace('-', '').replace(' ', '')
    if codigo in ('GOLD', 'XAU', 'XAUUSD'):
        return 'XAUUSD'
    if codigo in ('SILVER', 'XAG', 'XAGUSD'):
        return 'XAGUSD'
    return codigo


def es_par_valido(codigo):
    if codigo in ('XAUUSD', 'XAGUSD'):
        return True
    if len(codigo) == 6 and codigo[:3] in MONEDAS_VALIDAS and codigo[3:] in MONEDAS_VALIDAS:
        return True
    return False


def detectar_direccion_y_par(texto_up):
    """Busca dirección y par de forma independiente, sin exigir que estén pegados."""
    m_dir = re.search(r'\b(BUY|SELL|LONG|SHORT)\b', texto_up)
    if not m_dir:
        return None
    direccion = 'BUY' if m_dir.group(1) in ('BUY', 'LONG') else 'SELL'

    # Par con separador explícito: EUR/USD, AUD-USD, XAU/USD...
    m_par = re.search(r'\b([A-Z]{3})\s*[-/]\s*([A-Z]{3})\b', texto_up)
    if m_par:
        par = normalizar_par(m_par.group(1) + m_par.group(2))
        if es_par_valido(par):
            return direccion, par

    # Par sin separador: XAUUSD, EURNZD, AUDUSD...
    for m in re.finditer(r'\b([A-Z]{3,6})\b', texto_up):
        candidato = normalizar_par(m.group(1))
        if es_par_valido(candidato):
            return direccion, candidato

    return None


def patron_nivel(palabras_clave):
    """Construye el patrón para 'SL 3340', 'SL: 3340', 'TP1 3360', 'TP 2: 3360'.

    El índice del nivel solo se consume si va pegado a la palabra clave ('TP1')
    o si lo sigue un separador ('TP 2:'). Si no, se dejan los dígitos para el
    precio: de lo contrario 'SL 3340' se leería como nivel 33 y precio 40, que
    es exactamente lo que pasaba con los precios enteros del oro.
    """
    return (r'(?:' + palabras_clave + r')'
            r'(?:\d{1,2}(?=\D|$)|\s*\d{1,2}\s*(?=[:=\-]))?'
            r'\s*[:=\-]?\s*'
            r'(\d{1,6}(?:\.\d+)?)')


PATRON_SL = patron_nivel(r'STOP\s*LOSS(?:\s*\(SL\))?|STOP|SL')
PATRON_TP = patron_nivel(r'TAKE\s*PROFIT|TARGET|TP')


def parsear_señal(texto):
    """Devuelve un dict con la señal, o None si el mensaje no es operable."""
    texto_norm = texto.replace('¹', '1').replace('²', '2').replace('³', '3').replace('⁴', '4').replace('⁵', '5')
    texto_up = texto_norm.upper().replace('GOLD', 'XAUUSD').replace('SILVER', 'XAGUSD')

    deteccion = detectar_direccion_y_par(texto_up)
    if deteccion is None:
        return None
    direccion, par = deteccion

    resultado = {'direccion': direccion, 'par': par}

    m = re.search(r'(?:ENTRY\s*POINT|ENTRY)\s*[:\-]?\s*(\d{1,6}(?:\.\d+)?)', texto_norm, re.IGNORECASE)
    if m:
        resultado['entrada_min'] = resultado['entrada_max'] = float(m.group(1))
    else:
        m = re.search(r'(\d{1,6}(?:\.\d+)?)\s*[-/]\s*(\d{1,6}(?:\.\d+)?)', texto_norm)
        if m:
            resultado['entrada_min'] = float(m.group(1))
            resultado['entrada_max'] = float(m.group(2))

    m = re.search(PATRON_SL, texto_norm, re.IGNORECASE)
    if m:
        resultado['sl'] = float(m.group(1))

    targets = re.findall(PATRON_TP, texto_norm, re.IGNORECASE)
    if targets:
        resultado['tp'] = [float(t) for t in targets]

    # Un mensaje sin SL ni TP suele ser comentario o seguimiento, no una entrada.
    if 'sl' not in resultado and 'tp' not in resultado:
        return None

    return resultado
