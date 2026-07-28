# TrendRiderH1 — Estrategia seguidora de tendencia para MetaTrader 5

Expert Advisor para **MetaTrader 5**, diseñado para operar en **H1** siguiendo la tendencia
(**nunca busca reversión**: entra a favor del movimiento, no contra él).

Archivos:

- `Experts/TrendRiderH1.mq5` — el Expert Advisor.
- `Presets/TrendRiderH1_optimizacion.set` — preset de ejemplo con los rangos de optimización.

---

## 1. Idea de la estrategia

La lógica es deliberadamente sencilla: **4 bloques**, sin acumular indicadores.

| Bloque | Qué hace | Herramienta |
|---|---|---|
| 1. Dirección | Define si sólo se permiten compras o sólo ventas | EMA rápida vs EMA lenta (50/200 por defecto) |
| 2. Contexto | Confirma que el timeframe superior va en la misma dirección | EMA en D1 |
| 3. Disparo | Entra cuando el precio rompe el rango reciente **a favor** de la tendencia | Canal Donchian de 20 velas |
| 4. Gestión | Corta rápido lo que falla y deja correr lo que funciona | ATR: stop inicial, breakeven, parcial y trailing Chandelier |

Es la estructura clásica de un sistema de *breakout* con filtro de tendencia. Su ventaja
estadística no viene del porcentaje de aciertos (será bajo, típicamente 30–45 %), sino de la
**asimetría**: pérdidas acotadas a 1R y ganadoras que el trailing deja correr varios R.

### Reglas exactas

Todo se evalúa **al cierre de la vela H1** (vela `1`), y la orden se envía en la apertura de la
siguiente. No hay repintado ni lectura de la vela en curso.

**Compra** — se requieren todas:

1. `EMA_rápida(1) > EMA_lenta(1)`
2. `Cierre(1) > EMA_rápida(1)` (si `InpRequirePriceSide = true`)
3. Filtro TF superior: `Cierre(D1,1) > EMA_D1(1)` y/o EMA de D1 ascendente, según `InpHtfMode`
4. `ADX(1) >= InpAdxMinLevel` (si el filtro está activo)
5. `Cierre(1) > máximo de las N velas anteriores` (canal calculado **excluyendo** la vela de ruptura)
6. `|Cierre(1) − EMA_rápida(1)| <= InpMaxExtAtr × ATR` — evita perseguir un movimiento ya estirado

**Venta**: exactamente lo simétrico.

### Gestión de la posición

- **Stop inicial**: `InpSlAtrMult × ATR` desde el precio de entrada. Es la referencia de 1R y la base del cálculo del lote.
- **Take profit fijo**: opcional (`InpTpAtrMult`). Por defecto está **desactivado (0)** para no cortar las tendencias largas.
- **Breakeven**: al alcanzar `InpBeTriggerAtr × ATR` de beneficio, el stop pasa a entrada + `InpBeOffsetAtr × ATR`.
- **Cierre parcial**: al alcanzar `InpPartialTriggerAtr × ATR` se cierra el `InpPartialPercent %` del volumen inicial (una sola vez por posición).
- **Trailing Chandelier**: `máximo de las últimas N velas − InpTrailAtrMult × ATR` para largos (simétrico en cortos). Sólo se mueve a favor, nunca en contra, y respeta la distancia mínima del bróker.

---

## 2. Instalación

1. Copia `TrendRiderH1.mq5` en `MQL5/Experts/` de tu terminal
   (MetaEditor → *Archivo → Abrir carpeta de datos*).
2. Compila con **F7** en MetaEditor.
3. Arrastra el EA a un gráfico **H1** y habilita el trading algorítmico.
4. Opcional: copia el `.set` en `MQL5/Presets/` para cargarlo desde el Probador.

El parámetro `InpSignalTF` fija el timeframe de las señales (H1 por defecto), así que el EA
funciona correctamente aunque el gráfico esté en otro periodo.

---

## 3. Parámetros

### General
| Parámetro | Por defecto | Descripción |
|---|---|---|
| `InpSignalTF` | H1 | Timeframe de las señales |
| `InpMagic` | 20260728 | Identificador de las operaciones del EA |
| `InpComment` | TrendRider | Comentario de las órdenes |
| `InpSlippagePoints` | 20 | Deslizamiento máximo permitido |
| `InpShowInfo` | true | Panel informativo en el gráfico (desactivado en el Probador) |

### Filtro de tendencia
| Parámetro | Por defecto | Descripción |
|---|---|---|
| `InpEmaFastPeriod` | 50 | EMA rápida |
| `InpEmaSlowPeriod` | 200 | EMA lenta |
| `InpEmaPrice` | PRICE_CLOSE | Precio aplicado |
| `InpRequirePriceSide` | true | Exigir que el precio esté al lado correcto de la EMA rápida |

### Filtro de timeframe superior
| Parámetro | Por defecto | Descripción |
|---|---|---|
| `InpHtfMode` | Precio vs EMA | `OFF` / `precio vs EMA` / `pendiente EMA` / `ambos` |
| `InpHtfTF` | D1 | Timeframe superior |
| `InpHtfEmaPeriod` | 50 | Periodo de la EMA superior |

### Entrada
| Parámetro | Por defecto | Descripción |
|---|---|---|
| `InpBreakoutPeriod` | 20 | Velas del canal Donchian |
| `InpBreakoutOnClose` | true | `true`: rotura confirmada por cierre. `false`: basta con que el máximo/mínimo supere el canal |
| `InpAllowLong` / `InpAllowShort` | true | Permitir compras / ventas |

### Fuerza y extensión
| Parámetro | Por defecto | Descripción |
|---|---|---|
| `InpUseAdx` | true | Activar filtro ADX |
| `InpAdxPeriod` | 14 | Periodo ADX |
| `InpAdxMinLevel` | 20 | ADX mínimo para operar |
| `InpUseExtFilter` | true | Evitar entradas sobreextendidas |
| `InpMaxExtAtr` | 3.0 | Distancia máxima a la EMA rápida, en ATR |

### Riesgo
| Parámetro | Por defecto | Descripción |
|---|---|---|
| `InpRiskMode` | % de riesgo | Lote fijo o riesgo porcentual |
| `InpRiskBase` | Balance | Base de cálculo (balance o equity) |
| `InpFixedLots` | 0.10 | Lote fijo si el modo es lote fijo |
| `InpRiskPercent` | 1.0 | % arriesgado por operación (la distancia al stop define el lote) |
| `InpMaxPositions` | 1 | Posiciones simultáneas |

### Stops
| Parámetro | Por defecto | Descripción |
|---|---|---|
| `InpAtrPeriod` | 14 | Periodo del ATR |
| `InpSlAtrMult` | 2.0 | Stop inicial en ATR |
| `InpTpAtrMult` | 0.0 | TP fijo en ATR (0 = sin TP) |
| `InpUseBreakeven` | true | Activar breakeven |
| `InpBeTriggerAtr` | 1.0 | Beneficio necesario para mover a BE |
| `InpBeOffsetAtr` | 0.1 | Colchón por encima de la entrada |
| `InpUsePartial` | true | Activar cierre parcial |
| `InpPartialTriggerAtr` | 1.5 | Beneficio necesario para el parcial |
| `InpPartialPercent` | 50 | % del volumen inicial a cerrar |
| `InpUseTrailing` | true | Activar trailing |
| `InpTrailLookback` | 20 | Velas del extremo para el Chandelier |
| `InpTrailAtrMult` | 3.0 | Distancia del trailing en ATR |
| `InpTrailStartAtr` | 1.0 | Beneficio mínimo para empezar a trailear |

### Filtros operativos
| Parámetro | Por defecto | Descripción |
|---|---|---|
| `InpMaxSpreadPoints` | 30 | Spread máximo (0 = sin límite) |
| `InpUseTimeFilter` | false | Activar filtro horario |
| `InpStartHour` / `InpEndHour` | 7 / 20 | Franja horaria (hora del servidor; admite rangos que cruzan medianoche) |
| `InpTradeMonday` … `InpTradeFriday` | true | Días operables |
| `InpFridayExitHour` | 0 | Cerrar todo el viernes a esa hora (0 = desactivado) |
| `InpCooldownBars` | 1 | Velas de espera tras cerrar una posición |
| `InpMaxTradesPerDay` | 0 | Máximo de entradas diarias (0 = sin límite) |
| `InpMaxDailyLossPct` | 0.0 | Corta las entradas si la pérdida realizada del día supera este % (0 = off) |

---

## 4. Cómo optimizarla sin sobreajustar

**Orden recomendado.** No optimices los 40 parámetros a la vez: la mayoría del resultado lo
determinan 5 o 6. Trabaja por bloques y fija el resto.

**Paso 1 — Núcleo de la señal** (lo que más pesa):

| Parámetro | Inicio | Paso | Fin |
|---|---|---|---|
| `InpEmaFastPeriod` | 20 | 10 | 80 |
| `InpEmaSlowPeriod` | 100 | 25 | 250 |
| `InpBreakoutPeriod` | 10 | 5 | 55 |

**Paso 2 — Gestión** (fijando lo del paso 1):

| Parámetro | Inicio | Paso | Fin |
|---|---|---|---|
| `InpSlAtrMult` | 1.0 | 0.5 | 4.0 |
| `InpTrailAtrMult` | 1.5 | 0.5 | 5.0 |
| `InpTrailLookback` | 10 | 5 | 40 |

**Paso 3 — Filtros** (uno a uno, sólo si aportan): `InpAdxMinLevel` (15→35, paso 5),
`InpHtfMode` (los 4 valores), `InpMaxExtAtr` (1.5→5.0), franja horaria.

### Reglas prácticas

- **Modelado**: usa *Every tick based on real ticks* para la validación final. *1 minute OHLC* sirve para las pasadas rápidas de optimización, pero confirma siempre el mejor grupo con ticks reales.
- **Criterio**: optimiza por **Factor de Recuperación** o **Sharpe**, no por beneficio neto. El beneficio neto premia sistemáticamente el sobreajuste.
- **Muestra mínima**: descarta cualquier combinación con menos de ~100 operaciones. Con menos, el resultado es ruido.
- **Mesetas, no picos**: en el mapa 2D de la optimización, elige un valor rodeado de vecinos también rentables. Un pico aislado no sobrevive fuera de muestra.
- **Out-of-sample**: optimiza en el 70 % inicial del histórico y valida en el 30 % final **sin tocar nada**. Si el resultado se desmorona, la configuración estaba sobreajustada.
- **Forward test**: antes de ir a real, mínimo 1–2 meses en demo con el bróker y la cuenta reales, porque spread, comisión y swap cambian mucho el resultado en H1.
- **Riesgo**: con `InpRiskPercent`, empieza en 0.5–1 %. Optimizar el riesgo no mejora el sistema, sólo escala la curva y el drawdown.

### Dónde funciona mejor

Este tipo de sistema rinde en instrumentos con tendencias sostenidas y coste de transacción
bajo respecto al ATR de H1: índices (US500, NAS100, GER40), oro (XAUUSD) y los pares de divisas
con más recorrido (GBPJPY, EURUSD, AUDJPY). En pares muy laterales o con spread alto frente a
su ATR, el filtro de rango se lo come a base de pequeñas pérdidas.

---

## 5. Aviso

Esto es una herramienta de investigación, no una garantía de rentabilidad. Un backtest
favorable describe el pasado; no promete el futuro. Prueba siempre en demo antes de arriesgar
dinero real y dimensiona el riesgo asumiendo que habrá rachas perdedoras largas —son intrínsecas
a cualquier sistema seguidor de tendencia.
