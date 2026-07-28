//+------------------------------------------------------------------+
//|                                                 TrendRiderH1.mq5 |
//|                                                                  |
//|   ESTRATEGIA SEGUIDORA DE TENDENCIA PARA H1 (NO reversion)       |
//|   Archivo unico y autocontenido: manual + codigo.                |
//+------------------------------------------------------------------+
//
//  ==================================================================
//  1. INSTALACION
//  ==================================================================
//  1) MetaEditor -> Archivo -> Abrir carpeta de datos.
//  2) Copiar este archivo en MQL5\Experts\
//  3) Abrirlo en MetaEditor y compilar con F7.
//  4) Arrastrarlo a un grafico H1 y habilitar el trading algoritmico.
//
//  El parametro InpSignalTF fija el timeframe de las senales (H1 por
//  defecto), asi que funciona aunque el grafico este en otro periodo.
//
//  ==================================================================
//  2. IDEA DE LA ESTRATEGIA
//  ==================================================================
//  Cuatro bloques, sin amontonar indicadores:
//
//    1) DIRECCION : EMA rapida vs EMA lenta (50/200). Decide si solo
//                   se permiten compras o solo ventas.
//    2) CONTEXTO  : EMA del timeframe superior (D1). Opcional.
//    3) DISPARO   : ruptura de canal Donchian (20 velas) A FAVOR de
//                   la tendencia, confirmada al cierre de la vela.
//    4) GESTION   : ATR -> stop inicial, breakeven, cierre parcial y
//                   trailing Chandelier.
//
//  Es la estructura clasica de un sistema de breakout con filtro de
//  tendencia. Su ventaja NO viene del porcentaje de aciertos (sera
//  bajo, 30-45% tipicamente) sino de la ASIMETRIA: perdidas acotadas
//  a 1R y ganadoras que el trailing deja correr varios R.
//
//  ------------------------------------------------------------------
//  REGLAS EXACTAS
//  ------------------------------------------------------------------
//  Todo se evalua AL CIERRE de la vela H1 (vela 1) y la orden se envia
//  en la apertura de la siguiente. No hay repintado ni lectura de la
//  vela en curso.
//
//  COMPRA (se exigen todas):
//    1) EMA_rapida(1) > EMA_lenta(1)
//    2) Cierre(1) > EMA_rapida(1)      [si InpRequirePriceSide=true]
//    3) Filtro TF superior: Cierre(D1,1) > EMA_D1(1) y/o EMA de D1
//       ascendente, segun InpHtfMode
//    4) ADX(1) >= InpAdxMinLevel       [si InpUseAdx=true]
//    5) Cierre(1) > maximo de las N velas anteriores. El canal se
//       calcula EXCLUYENDO la vela de la ruptura.
//    6) |Cierre(1) - EMA_rapida(1)| <= InpMaxExtAtr * ATR
//       (evita perseguir un movimiento ya estirado)
//
//  VENTA: exactamente lo simetrico.
//
//  ------------------------------------------------------------------
//  GESTION DE LA POSICION
//  ------------------------------------------------------------------
//    - Stop inicial : InpSlAtrMult * ATR desde la entrada. Es la
//                     referencia de 1R y la base del calculo del lote.
//    - Take profit  : opcional (InpTpAtrMult). Desactivado por defecto
//                     para no cortar las tendencias largas.
//    - Breakeven    : al alcanzar InpBeTriggerAtr * ATR de beneficio,
//                     el stop pasa a entrada + InpBeOffsetAtr * ATR.
//    - Parcial      : al alcanzar InpPartialTriggerAtr * ATR se cierra
//                     el InpPartialPercent % del volumen inicial, una
//                     sola vez por posicion.
//    - Trailing     : Chandelier. Para largos, maximo de las ultimas N
//                     velas - InpTrailAtrMult * ATR (simetrico en
//                     cortos). Solo se mueve a favor, nunca en contra,
//                     y respeta la distancia minima del broker.
//
//  ==================================================================
//  3. COMO OPTIMIZARLA SIN SOBREAJUSTAR
//  ==================================================================
//  No optimices los 40 parametros a la vez: el resultado lo determinan
//  5 o 6. Trabaja por fases y fija el resto.
//
//  PASO 1 - Nucleo de la senal (lo que mas pesa):
//     Parametro            Inicio   Paso   Fin
//     InpEmaFastPeriod        20      10    80
//     InpEmaSlowPeriod       100      25   250
//     InpBreakoutPeriod       10       5    55
//
//  PASO 2 - Gestion (fijando ya lo del paso 1):
//     InpSlAtrMult           1.0     0.5   4.0
//     InpTrailAtrMult        1.5     0.5   5.0
//     InpTrailLookback        10       5    40
//
//  PASO 3 - Filtros, uno a uno y solo si aportan:
//     InpAdxMinLevel          15       5    35
//     InpHtfMode               0       1     3
//     InpMaxExtAtr           1.5     0.5   5.0
//     franja horaria (InpStartHour / InpEndHour)
//
//  REGLAS PRACTICAS
//    - Modelado: "Every tick based on real ticks" para la validacion
//      final. "1 minute OHLC" vale para las pasadas rapidas, pero
//      confirma siempre el mejor grupo con ticks reales.
//    - Criterio: optimiza por FACTOR DE RECUPERACION o SHARPE, nunca
//      por beneficio neto: el beneficio neto premia el sobreajuste.
//    - Muestra minima: descarta combinaciones con menos de ~100
//      operaciones. Con menos, el resultado es ruido.
//    - Mesetas, no picos: en el mapa de optimizacion elige un valor
//      rodeado de vecinos tambien rentables. Un pico aislado no
//      sobrevive fuera de muestra.
//    - Out-of-sample: optimiza en el 70% inicial del historico y valida
//      en el 30% final SIN TOCAR NADA. Si se desmorona, estaba
//      sobreajustado.
//    - Forward test: 1-2 meses en demo con el broker real antes de ir
//      a real. En H1 el spread, la comision y el swap cambian mucho el
//      resultado.
//    - Riesgo: empieza en 0.5-1%. Optimizar el riesgo no mejora el
//      sistema, solo escala la curva y el drawdown.
//
//  DONDE FUNCIONA MEJOR
//    Instrumentos con tendencias sostenidas y coste de transaccion bajo
//    respecto al ATR de H1: indices (US500, NAS100, GER40), oro
//    (XAUUSD) y divisas con recorrido (GBPJPY, EURUSD, AUDJPY). En
//    pares muy laterales o con spread alto frente a su ATR, el rango se
//    lo come a base de pequenas perdidas.
//
//  ==================================================================
//  4. AVISO
//  ==================================================================
//  Esto es una herramienta de investigacion, no una garantia de
//  rentabilidad. Un backtest favorable describe el pasado; no promete
//  el futuro. Prueba en demo antes de arriesgar dinero real y dimensiona
//  el riesgo asumiendo que habra rachas perdedoras largas: son
//  intrinsecas a cualquier sistema seguidor de tendencia.
//
//+------------------------------------------------------------------+
#property copyright "TrendRider"
#property link      ""
#property version   "1.00"
#property description "Seguimiento de tendencia con ruptura Donchian filtrada por EMA/ADX y gestion por ATR."

#include <Trade\Trade.mqh>

//+------------------------------------------------------------------+
//| Enumeraciones                                                     |
//+------------------------------------------------------------------+
enum ENUM_RISK_MODE
  {
   RISK_FIXED_LOT = 0,  // Lote fijo
   RISK_PERCENT   = 1   // % de riesgo por operacion
  };

enum ENUM_RISK_BASE
  {
   BASE_BALANCE = 0,    // Balance
   BASE_EQUITY  = 1     // Equity
  };

enum ENUM_HTF_MODE
  {
   HTF_OFF        = 0,  // Desactivado
   HTF_PRICE_EMA  = 1,  // Precio respecto a la EMA del TF superior
   HTF_EMA_SLOPE  = 2,  // Pendiente de la EMA del TF superior
   HTF_BOTH       = 3   // Ambas condiciones
  };

//+------------------------------------------------------------------+
//| Parametros de entrada                                             |
//+------------------------------------------------------------------+
input group "===== General ====="
input ENUM_TIMEFRAMES InpSignalTF          = PERIOD_H1;   // Timeframe de senal
input ulong           InpMagic             = 20260728;    // Magic number
input string          InpComment           = "TrendRider";// Comentario de las ordenes
input ulong           InpSlippagePoints    = 20;          // Deslizamiento maximo (puntos)
input bool            InpShowInfo          = true;        // Mostrar panel informativo

input group "===== Filtro de tendencia (H1) ====="
input int             InpEmaFastPeriod     = 50;          // Periodo EMA rapida
input int             InpEmaSlowPeriod     = 200;         // Periodo EMA lenta
input ENUM_APPLIED_PRICE InpEmaPrice       = PRICE_CLOSE; // Precio aplicado a las EMA
input bool            InpRequirePriceSide  = true;        // Exigir precio al lado correcto de la EMA rapida

input group "===== Filtro de timeframe superior ====="
input ENUM_HTF_MODE   InpHtfMode           = HTF_PRICE_EMA; // Modo del filtro superior
input ENUM_TIMEFRAMES InpHtfTF             = PERIOD_D1;   // Timeframe superior
input int             InpHtfEmaPeriod      = 50;          // Periodo EMA del TF superior

input group "===== Entrada: ruptura Donchian ====="
input int             InpBreakoutPeriod    = 20;          // Periodo del canal (velas)
input bool            InpBreakoutOnClose   = true;        // Confirmar ruptura con el cierre
input bool            InpAllowLong         = true;        // Permitir compras
input bool            InpAllowShort        = true;        // Permitir ventas

input group "===== Filtro de fuerza (ADX) ====="
input bool            InpUseAdx            = true;        // Usar filtro ADX
input int             InpAdxPeriod         = 14;          // Periodo ADX
input double          InpAdxMinLevel       = 20.0;        // Nivel minimo de ADX

input group "===== Filtro de extension ====="
input bool            InpUseExtFilter      = true;        // Evitar entradas sobreextendidas
input double          InpMaxExtAtr         = 3.0;         // Distancia maxima a la EMA rapida (x ATR)

input group "===== Riesgo y tamano de posicion ====="
input ENUM_RISK_MODE  InpRiskMode          = RISK_PERCENT;// Modo de calculo del lote
input ENUM_RISK_BASE  InpRiskBase          = BASE_BALANCE;// Base de calculo del riesgo
input double          InpFixedLots         = 0.10;        // Lote fijo
input double          InpRiskPercent       = 1.0;         // Riesgo por operacion (%)
input int             InpMaxPositions      = 1;           // Posiciones simultaneas maximas

input group "===== Stops y objetivos (ATR) ====="
input int             InpAtrPeriod         = 14;          // Periodo ATR
input double          InpSlAtrMult         = 2.0;         // Stop loss inicial (x ATR)
input double          InpTpAtrMult         = 0.0;         // Take profit fijo (x ATR, 0 = sin TP)

input group "===== Breakeven ====="
input bool            InpUseBreakeven      = true;        // Activar breakeven
input double          InpBeTriggerAtr      = 1.0;         // Beneficio para mover a BE (x ATR)
input double          InpBeOffsetAtr       = 0.1;         // Offset por encima de la entrada (x ATR)

input group "===== Cierre parcial ====="
input bool            InpUsePartial        = true;        // Activar cierre parcial
input double          InpPartialTriggerAtr = 1.5;         // Beneficio para el parcial (x ATR)
input double          InpPartialPercent    = 50.0;        // Porcentaje a cerrar (%)

input group "===== Trailing Chandelier (ATR) ====="
input bool            InpUseTrailing       = true;        // Activar trailing stop
input int             InpTrailLookback     = 20;          // Velas para el maximo/minimo del trailing
input double          InpTrailAtrMult      = 3.0;         // Distancia del trailing (x ATR)
input double          InpTrailStartAtr     = 1.0;         // Beneficio minimo para activarlo (x ATR)

input group "===== Filtros operativos ====="
input int             InpMaxSpreadPoints   = 30;          // Spread maximo permitido (puntos, 0 = sin limite)
input bool            InpUseTimeFilter     = false;       // Usar filtro horario
input int             InpStartHour         = 7;           // Hora de inicio (hora del servidor)
input int             InpEndHour           = 20;          // Hora de fin (hora del servidor)
input bool            InpTradeMonday       = true;        // Operar lunes
input bool            InpTradeTuesday      = true;        // Operar martes
input bool            InpTradeWednesday    = true;        // Operar miercoles
input bool            InpTradeThursday     = true;        // Operar jueves
input bool            InpTradeFriday       = true;        // Operar viernes
input int             InpFridayExitHour    = 0;           // Cerrar todo el viernes a esta hora (0 = off)
input int             InpCooldownBars      = 1;           // Velas de espera tras cerrar una posicion
input int             InpMaxTradesPerDay   = 0;           // Maximo de entradas por dia (0 = sin limite)
input double          InpMaxDailyLossPct   = 0.0;         // Perdida diaria maxima en % (0 = off)

//+------------------------------------------------------------------+
//| Variables globales                                                |
//+------------------------------------------------------------------+
CTrade   trade;

int      g_hEmaFast = INVALID_HANDLE;
int      g_hEmaSlow = INVALID_HANDLE;
int      g_hAtr     = INVALID_HANDLE;
int      g_hAdx     = INVALID_HANDLE;
int      g_hEmaHtf  = INVALID_HANDLE;

datetime g_lastBarTime  = 0;   // ultima vela procesada
datetime g_lastExitBar  = 0;   // vela en la que se cerro la ultima posicion
int      g_prevPosCount = 0;   // posiciones propias en el tick anterior

//+------------------------------------------------------------------+
//| Inicializacion                                                    |
//+------------------------------------------------------------------+
int OnInit()
  {
   if(InpEmaFastPeriod < 1 || InpEmaSlowPeriod < 1 || InpEmaFastPeriod >= InpEmaSlowPeriod)
     {
      Print("Error de parametros: la EMA rapida debe ser menor que la lenta.");
      return(INIT_PARAMETERS_INCORRECT);
     }
   if(InpBreakoutPeriod < 2 || InpAtrPeriod < 1 || InpAdxPeriod < 1 || InpTrailLookback < 2)
     {
      Print("Error de parametros: periodos de indicadores fuera de rango.");
      return(INIT_PARAMETERS_INCORRECT);
     }
   if(InpRiskMode == RISK_PERCENT && InpRiskPercent <= 0.0)
     {
      Print("Error de parametros: el riesgo por operacion debe ser mayor que 0.");
      return(INIT_PARAMETERS_INCORRECT);
     }
   if(InpSlAtrMult <= 0.0)
     {
      Print("Error de parametros: el multiplicador de stop loss debe ser mayor que 0.");
      return(INIT_PARAMETERS_INCORRECT);
     }
   if(InpUsePartial && (InpPartialPercent <= 0.0 || InpPartialPercent >= 100.0))
     {
      Print("Error de parametros: el porcentaje del cierre parcial debe estar entre 0 y 100.");
      return(INIT_PARAMETERS_INCORRECT);
     }

   g_hEmaFast = iMA(_Symbol, InpSignalTF, InpEmaFastPeriod, 0, MODE_EMA, InpEmaPrice);
   g_hEmaSlow = iMA(_Symbol, InpSignalTF, InpEmaSlowPeriod, 0, MODE_EMA, InpEmaPrice);
   g_hAtr     = iATR(_Symbol, InpSignalTF, InpAtrPeriod);
   g_hAdx     = iADX(_Symbol, InpSignalTF, InpAdxPeriod);

   if(g_hEmaFast == INVALID_HANDLE || g_hEmaSlow == INVALID_HANDLE ||
      g_hAtr == INVALID_HANDLE || g_hAdx == INVALID_HANDLE)
     {
      Print("No se han podido crear los indicadores del timeframe de senal.");
      return(INIT_FAILED);
     }

   if(InpHtfMode != HTF_OFF)
     {
      g_hEmaHtf = iMA(_Symbol, InpHtfTF, InpHtfEmaPeriod, 0, MODE_EMA, InpEmaPrice);
      if(g_hEmaHtf == INVALID_HANDLE)
        {
         Print("No se ha podido crear la EMA del timeframe superior.");
         return(INIT_FAILED);
        }
     }

   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpSlippagePoints);
   trade.SetAsyncMode(false);
   ApplyFillingMode();

   g_lastBarTime  = 0;
   g_lastExitBar  = 0;
   g_prevPosCount = CountOwnPositions();

   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Desinicializacion                                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(g_hEmaFast != INVALID_HANDLE) IndicatorRelease(g_hEmaFast);
   if(g_hEmaSlow != INVALID_HANDLE) IndicatorRelease(g_hEmaSlow);
   if(g_hAtr     != INVALID_HANDLE) IndicatorRelease(g_hAtr);
   if(g_hAdx     != INVALID_HANDLE) IndicatorRelease(g_hAdx);
   if(g_hEmaHtf  != INVALID_HANDLE) IndicatorRelease(g_hEmaHtf);

   if(InpShowInfo)
      Comment("");
  }

//+------------------------------------------------------------------+
//| Tick                                                              |
//+------------------------------------------------------------------+
void OnTick()
  {
   int posCount = CountOwnPositions();

   // Deteccion del cierre de la ultima posicion para el periodo de espera
   if(posCount == 0 && g_prevPosCount > 0)
      g_lastExitBar = iTime(_Symbol, InpSignalTF, 0);
   g_prevPosCount = posCount;

   // Cierre forzado del viernes
   if(HandleFridayExit())
      return;

   // La gestion de posiciones abiertas se hace en cada tick
   ManageOpenPositions();

   if(InpShowInfo && !MQLInfoInteger(MQL_TESTER))
      ShowInfo();

   // El resto de la logica solo se evalua al abrir una vela nueva
   if(!IsNewBar())
      return;

   if(!EntriesAllowed())
      return;

   int dir = GetSignal();
   if(dir == 0)
      return;

   if(dir > 0 && !InpAllowLong)  return;
   if(dir < 0 && !InpAllowShort) return;

   OpenPosition(dir);
  }

//+------------------------------------------------------------------+
//| Deteccion de vela nueva en el timeframe de senal                  |
//+------------------------------------------------------------------+
bool IsNewBar()
  {
   datetime t = iTime(_Symbol, InpSignalTF, 0);
   if(t == 0)
      return(false);
   if(t == g_lastBarTime)
      return(false);
   g_lastBarTime = t;
   return(true);
  }

//+------------------------------------------------------------------+
//| Lectura de un buffer de indicador                                 |
//+------------------------------------------------------------------+
double Ind(const int handle, const int buffer, const int shift)
  {
   double tmp[];
   if(handle == INVALID_HANDLE)
      return(EMPTY_VALUE);
   if(CopyBuffer(handle, buffer, shift, 1, tmp) != 1)
      return(EMPTY_VALUE);
   return(tmp[0]);
  }

//+------------------------------------------------------------------+
//| Senal de entrada: +1 compra, -1 venta, 0 nada                     |
//+------------------------------------------------------------------+
int GetSignal()
  {
   double emaFast = Ind(g_hEmaFast, 0, 1);
   double emaSlow = Ind(g_hEmaSlow, 0, 1);
   double atr     = Ind(g_hAtr,     0, 1);

   if(emaFast == EMPTY_VALUE || emaSlow == EMPTY_VALUE || atr == EMPTY_VALUE || atr <= 0.0)
      return(0);

   double close1 = iClose(_Symbol, InpSignalTF, 1);
   double high1  = iHigh(_Symbol,  InpSignalTF, 1);
   double low1   = iLow(_Symbol,   InpSignalTF, 1);
   if(close1 <= 0.0)
      return(0);

   // Canal Donchian calculado SIN incluir la vela de la ruptura
   int idxHigh = iHighest(_Symbol, InpSignalTF, MODE_HIGH, InpBreakoutPeriod, 2);
   int idxLow  = iLowest(_Symbol,  InpSignalTF, MODE_LOW,  InpBreakoutPeriod, 2);
   if(idxHigh < 0 || idxLow < 0)
      return(0);

   double upper = iHigh(_Symbol, InpSignalTF, idxHigh);
   double lower = iLow(_Symbol,  InpSignalTF, idxLow);
   if(upper <= 0.0 || lower <= 0.0)
      return(0);

   // Filtro de fuerza
   if(InpUseAdx)
     {
      double adx = Ind(g_hAdx, 0, 1);
      if(adx == EMPTY_VALUE || adx < InpAdxMinLevel)
         return(0);
     }

   // Filtro de sobreextension respecto a la EMA rapida
   if(InpUseExtFilter && MathAbs(close1 - emaFast) > InpMaxExtAtr * atr)
      return(0);

   bool trendUp   = (emaFast > emaSlow);
   bool trendDown = (emaFast < emaSlow);

   if(InpRequirePriceSide)
     {
      trendUp   = trendUp   && (close1 > emaFast);
      trendDown = trendDown && (close1 < emaFast);
     }

   if(!HtfFilterOk(true))  trendUp   = false;
   if(!HtfFilterOk(false)) trendDown = false;

   double breakLevelUp   = InpBreakoutOnClose ? close1 : high1;
   double breakLevelDown = InpBreakoutOnClose ? close1 : low1;

   if(trendUp && breakLevelUp > upper)
      return(1);
   if(trendDown && breakLevelDown < lower)
      return(-1);

   return(0);
  }

//+------------------------------------------------------------------+
//| Filtro del timeframe superior                                     |
//+------------------------------------------------------------------+
bool HtfFilterOk(const bool isLong)
  {
   if(InpHtfMode == HTF_OFF)
      return(true);

   double ema1 = Ind(g_hEmaHtf, 0, 1);
   double ema2 = Ind(g_hEmaHtf, 0, 2);
   if(ema1 == EMPTY_VALUE || ema2 == EMPTY_VALUE)
      return(false);

   double closeHtf = iClose(_Symbol, InpHtfTF, 1);
   if(closeHtf <= 0.0)
      return(false);

   bool priceOk = isLong ? (closeHtf > ema1) : (closeHtf < ema1);
   bool slopeOk = isLong ? (ema1 > ema2)     : (ema1 < ema2);

   if(InpHtfMode == HTF_PRICE_EMA) return(priceOk);
   if(InpHtfMode == HTF_EMA_SLOPE) return(slopeOk);
   return(priceOk && slopeOk);
  }

//+------------------------------------------------------------------+
//| Comprobacion de todos los filtros previos a una entrada           |
//+------------------------------------------------------------------+
bool EntriesAllowed()
  {
   if(CountOwnPositions() >= InpMaxPositions)
      return(false);

   // Periodo de espera tras el cierre de la posicion anterior
   if(InpCooldownBars > 0 && g_lastExitBar > 0)
     {
      int barsSince = iBarShift(_Symbol, InpSignalTF, g_lastExitBar, false);
      if(barsSince >= 0 && barsSince < InpCooldownBars)
         return(false);
     }

   // Spread
   if(InpMaxSpreadPoints > 0)
     {
      long spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
      if(spread > InpMaxSpreadPoints)
         return(false);
     }

   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);

   if(!DayAllowed(dt.day_of_week))
      return(false);

   if(InpUseTimeFilter && !HourAllowed(dt.hour))
      return(false);

   if(InpMaxTradesPerDay > 0 && CountTradesToday() >= InpMaxTradesPerDay)
      return(false);

   if(InpMaxDailyLossPct > 0.0)
     {
      double base = (InpRiskBase == BASE_EQUITY) ? AccountInfoDouble(ACCOUNT_EQUITY)
                                                 : AccountInfoDouble(ACCOUNT_BALANCE);
      double limit = base * InpMaxDailyLossPct / 100.0;
      if(base > 0.0 && -TodayRealizedProfit() >= limit)
         return(false);
     }

   return(true);
  }

//+------------------------------------------------------------------+
//| Filtro de dias de la semana                                       |
//+------------------------------------------------------------------+
bool DayAllowed(const int dayOfWeek)
  {
   switch(dayOfWeek)
     {
      case 1: return(InpTradeMonday);
      case 2: return(InpTradeTuesday);
      case 3: return(InpTradeWednesday);
      case 4: return(InpTradeThursday);
      case 5: return(InpTradeFriday);
      default: return(false); // sabado y domingo
     }
  }

//+------------------------------------------------------------------+
//| Filtro horario (soporta rangos que cruzan medianoche)             |
//+------------------------------------------------------------------+
bool HourAllowed(const int hour)
  {
   if(InpStartHour == InpEndHour)
      return(true);
   if(InpStartHour < InpEndHour)
      return(hour >= InpStartHour && hour < InpEndHour);
   return(hour >= InpStartHour || hour < InpEndHour);
  }

//+------------------------------------------------------------------+
//| Apertura de posicion                                              |
//+------------------------------------------------------------------+
void OpenPosition(const int dir)
  {
   double atr = Ind(g_hAtr, 0, 1);
   if(atr == EMPTY_VALUE || atr <= 0.0)
      return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(ask <= 0.0 || bid <= 0.0)
      return;

   double price   = (dir > 0) ? ask : bid;
   double slDist  = InpSlAtrMult * atr;
   double minStop = MinStopDistance();

   if(slDist < minStop)
      slDist = minStop;

   double sl = (dir > 0) ? price - slDist : price + slDist;
   double tp = 0.0;
   if(InpTpAtrMult > 0.0)
     {
      double tpDist = MathMax(InpTpAtrMult * atr, minStop);
      tp = (dir > 0) ? price + tpDist : price - tpDist;
     }

   sl = NormalizeDouble(sl, _Digits);
   tp = (tp > 0.0) ? NormalizeDouble(tp, _Digits) : 0.0;

   double lots = CalcLots(slDist);
   if(lots <= 0.0)
     {
      Print("Volumen calculado no valido, no se abre la operacion.");
      return;
     }

   bool ok = (dir > 0) ? trade.Buy(lots, _Symbol, 0.0, sl, tp, InpComment)
                       : trade.Sell(lots, _Symbol, 0.0, sl, tp, InpComment);

   if(!ok)
      PrintFormat("Fallo al abrir posicion (%s): retcode=%d %s",
                  (dir > 0 ? "BUY" : "SELL"), trade.ResultRetcode(), trade.ResultRetcodeDescription());
  }

//+------------------------------------------------------------------+
//| Calculo del volumen                                               |
//+------------------------------------------------------------------+
double CalcLots(const double slDistance)
  {
   if(InpRiskMode == RISK_FIXED_LOT)
      return(NormalizeVolume(InpFixedLots));

   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize <= 0.0 || tickValue <= 0.0 || slDistance <= 0.0)
      return(0.0);

   double base = (InpRiskBase == BASE_EQUITY) ? AccountInfoDouble(ACCOUNT_EQUITY)
                                              : AccountInfoDouble(ACCOUNT_BALANCE);
   double riskMoney  = base * InpRiskPercent / 100.0;
   double lossPerLot = (slDistance / tickSize) * tickValue;
   if(lossPerLot <= 0.0)
      return(0.0);

   double lots = NormalizeVolume(riskMoney / lossPerLot);

   // Ajuste por margen disponible
   double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double margin = 0.0;
   double ask    = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   int guard     = 0;
   while(lots >= minLot && guard < 200)
     {
      if(!OrderCalcMargin(ORDER_TYPE_BUY, _Symbol, lots, ask, margin))
         break;
      if(margin <= AccountInfoDouble(ACCOUNT_MARGIN_FREE) * 0.9)
         break;
      lots = NormalizeVolume(lots - step);
      guard++;
     }

   if(lots < minLot)
      return(0.0);

   return(lots);
  }

//+------------------------------------------------------------------+
//| Normalizacion del volumen al step del simbolo                     |
//+------------------------------------------------------------------+
double NormalizeVolume(double volume)
  {
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(step <= 0.0)
      step = 0.01;

   volume = MathFloor(volume / step + 1e-8) * step;
   if(volume < minLot) volume = 0.0;
   if(volume > maxLot) volume = maxLot;

   int digits = (int)MathMax(0, MathRound(-MathLog10(step)));
   return(NormalizeDouble(volume, digits));
  }

//+------------------------------------------------------------------+
//| Distancia minima permitida para los stops                         |
//+------------------------------------------------------------------+
double MinStopDistance()
  {
   long stopsLevel  = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   long freezeLevel = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_FREEZE_LEVEL);
   long level       = (long)MathMax((double)stopsLevel, (double)freezeLevel);
   double dist      = level * _Point;
   return(MathMax(dist, 2.0 * _Point));
  }

//+------------------------------------------------------------------+
//| Gestion de las posiciones abiertas                                |
//+------------------------------------------------------------------+
void ManageOpenPositions()
  {
   double atr = Ind(g_hAtr, 0, 1);
   if(atr == EMPTY_VALUE || atr <= 0.0)
      return;

   double minStop = MinStopDistance();

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(!PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;

      ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      bool   isLong  = (type == POSITION_TYPE_BUY);
      double entry   = PositionGetDouble(POSITION_PRICE_OPEN);
      double curSL   = PositionGetDouble(POSITION_SL);
      double curTP   = PositionGetDouble(POSITION_TP);
      double volume  = PositionGetDouble(POSITION_VOLUME);
      double market  = isLong ? SymbolInfoDouble(_Symbol, SYMBOL_BID)
                              : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      if(market <= 0.0)
         continue;

      double profitDist = isLong ? (market - entry) : (entry - market);

      // ---- Cierre parcial -------------------------------------------------
      if(InpUsePartial && profitDist >= InpPartialTriggerAtr * atr)
        {
         double initialVol = InitialVolume(ticket);
         if(initialVol > 0.0 && volume >= initialVol - 1e-8)
           {
            double closeVol = NormalizeVolume(initialVol * InpPartialPercent / 100.0);
            double minLot   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
            if(closeVol >= minLot && (volume - closeVol) >= minLot - 1e-8)
              {
               if(!trade.PositionClosePartial(ticket, closeVol))
                  PrintFormat("Fallo en el cierre parcial del ticket %I64u: retcode=%d %s",
                              ticket, trade.ResultRetcode(), trade.ResultRetcodeDescription());
               if(!PositionSelectByTicket(ticket))
                  continue;
               volume = PositionGetDouble(POSITION_VOLUME);
               curSL  = PositionGetDouble(POSITION_SL);
              }
           }
        }

      // ---- Calculo del mejor stop entre breakeven y trailing ---------------
      double newSL = curSL;

      if(InpUseBreakeven && profitDist >= InpBeTriggerAtr * atr)
        {
         double offset = InpBeOffsetAtr * atr;
         double beSL   = isLong ? (entry + offset) : (entry - offset);
         newSL = BetterStop(isLong, newSL, beSL);
        }

      if(InpUseTrailing && profitDist >= InpTrailStartAtr * atr)
        {
         double trailSL = ChandelierStop(isLong, atr);
         if(trailSL > 0.0)
            newSL = BetterStop(isLong, newSL, trailSL);
        }

      if(newSL <= 0.0 || MathAbs(newSL - curSL) < _Point * 0.5)
         continue;

      // Respetar la distancia minima al precio actual
      if(isLong && newSL > market - minStop)
         continue;
      if(!isLong && newSL < market + minStop)
         continue;

      newSL = NormalizeDouble(newSL, _Digits);
      if(!trade.PositionModify(ticket, newSL, curTP))
         PrintFormat("Fallo al modificar el stop del ticket %I64u: retcode=%d %s",
                     ticket, trade.ResultRetcode(), trade.ResultRetcodeDescription());
     }
  }

//+------------------------------------------------------------------+
//| Devuelve el stop mas favorable de los dos                         |
//+------------------------------------------------------------------+
double BetterStop(const bool isLong, const double current, const double candidate)
  {
   if(candidate <= 0.0)
      return(current);
   if(current <= 0.0)
      return(candidate);
   return(isLong ? MathMax(current, candidate) : MathMin(current, candidate));
  }

//+------------------------------------------------------------------+
//| Trailing tipo Chandelier: extremo de N velas -/+ ATR * mult       |
//+------------------------------------------------------------------+
double ChandelierStop(const bool isLong, const double atr)
  {
   if(isLong)
     {
      int idxHigh = iHighest(_Symbol, InpSignalTF, MODE_HIGH, InpTrailLookback, 1);
      if(idxHigh < 0)
         return(0.0);
      double hh = iHigh(_Symbol, InpSignalTF, idxHigh);
      if(hh <= 0.0)
         return(0.0);
      return(hh - InpTrailAtrMult * atr);
     }

   int idxLow = iLowest(_Symbol, InpSignalTF, MODE_LOW, InpTrailLookback, 1);
   if(idxLow < 0)
      return(0.0);
   double ll = iLow(_Symbol, InpSignalTF, idxLow);
   if(ll <= 0.0)
      return(0.0);
   return(ll + InpTrailAtrMult * atr);
  }

//+------------------------------------------------------------------+
//| Volumen original de una posicion (para saber si ya hubo parcial)  |
//+------------------------------------------------------------------+
double InitialVolume(const ulong ticket)
  {
   if(!PositionSelectByTicket(ticket))
      return(0.0);

   double current = PositionGetDouble(POSITION_VOLUME);
   long   posId   = (long)PositionGetInteger(POSITION_IDENTIFIER);

   if(!HistorySelectByPosition(posId))
      return(current);

   double vol   = 0.0;
   int    total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0)
         continue;
      if((ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY) == DEAL_ENTRY_IN)
         vol += HistoryDealGetDouble(deal, DEAL_VOLUME);
     }

   return(vol > 0.0 ? vol : current);
  }

//+------------------------------------------------------------------+
//| Numero de posiciones propias abiertas                             |
//+------------------------------------------------------------------+
int CountOwnPositions()
  {
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(!PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;
      count++;
     }
   return(count);
  }

//+------------------------------------------------------------------+
//| Inicio del dia actual (hora del servidor)                         |
//+------------------------------------------------------------------+
datetime DayStart()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   dt.hour = 0;
   dt.min  = 0;
   dt.sec  = 0;
   return(StructToTime(dt));
  }

//+------------------------------------------------------------------+
//| Entradas realizadas hoy                                           |
//+------------------------------------------------------------------+
int CountTradesToday()
  {
   if(!HistorySelect(DayStart(), TimeCurrent() + 1))
      return(0);

   int count = 0;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0)
         continue;
      if((ulong)HistoryDealGetInteger(deal, DEAL_MAGIC) != InpMagic)
         continue;
      if(HistoryDealGetString(deal, DEAL_SYMBOL) != _Symbol)
         continue;
      if((ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal, DEAL_ENTRY) == DEAL_ENTRY_IN)
         count++;
     }
   return(count);
  }

//+------------------------------------------------------------------+
//| Resultado realizado en el dia actual                              |
//+------------------------------------------------------------------+
double TodayRealizedProfit()
  {
   if(!HistorySelect(DayStart(), TimeCurrent() + 1))
      return(0.0);

   double profit = 0.0;
   int    total  = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0)
         continue;
      if((ulong)HistoryDealGetInteger(deal, DEAL_MAGIC) != InpMagic)
         continue;
      if(HistoryDealGetString(deal, DEAL_SYMBOL) != _Symbol)
         continue;
      profit += HistoryDealGetDouble(deal, DEAL_PROFIT)
              + HistoryDealGetDouble(deal, DEAL_SWAP)
              + HistoryDealGetDouble(deal, DEAL_COMMISSION);
     }
   return(profit);
  }

//+------------------------------------------------------------------+
//| Cierre de todas las posiciones el viernes a una hora dada         |
//+------------------------------------------------------------------+
bool HandleFridayExit()
  {
   if(InpFridayExitHour <= 0)
      return(false);

   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   if(dt.day_of_week != 5 || dt.hour < InpFridayExitHour)
      return(false);

   bool closedAny = false;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(!PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;
      if(trade.PositionClose(ticket))
         closedAny = true;
     }
   return(closedAny);
  }

//+------------------------------------------------------------------+
//| Modo de llenado soportado por el simbolo                          |
//+------------------------------------------------------------------+
void ApplyFillingMode()
  {
   long filling = SymbolInfoInteger(_Symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) != 0)
      trade.SetTypeFilling(ORDER_FILLING_FOK);
   else if((filling & SYMBOL_FILLING_IOC) != 0)
      trade.SetTypeFilling(ORDER_FILLING_IOC);
   else
      trade.SetTypeFilling(ORDER_FILLING_RETURN);
  }

//+------------------------------------------------------------------+
//| Panel informativo                                                 |
//+------------------------------------------------------------------+
void ShowInfo()
  {
   double emaFast = Ind(g_hEmaFast, 0, 1);
   double emaSlow = Ind(g_hEmaSlow, 0, 1);
   double atr     = Ind(g_hAtr,     0, 1);
   double adx     = Ind(g_hAdx,     0, 1);

   string trend = "LATERAL / SIN SESGO";
   if(emaFast != EMPTY_VALUE && emaSlow != EMPTY_VALUE)
      trend = (emaFast > emaSlow) ? "ALCISTA" : "BAJISTA";

   string txt = StringFormat(
                   "TrendRiderH1  |  %s  %s\n"
                   "Tendencia: %s\n"
                   "EMA%d: %s   EMA%d: %s\n"
                   "ATR(%d): %s   ADX(%d): %.1f\n"
                   "Spread: %d pts   Posiciones: %d/%d\n"
                   "Operaciones hoy: %d   Resultado hoy: %.2f",
                   _Symbol, EnumToString(InpSignalTF),
                   trend,
                   InpEmaFastPeriod, DoubleToString(emaFast, _Digits),
                   InpEmaSlowPeriod, DoubleToString(emaSlow, _Digits),
                   InpAtrPeriod, DoubleToString(atr, _Digits),
                   InpAdxPeriod, (adx == EMPTY_VALUE ? 0.0 : adx),
                   (int)SymbolInfoInteger(_Symbol, SYMBOL_SPREAD),
                   CountOwnPositions(), InpMaxPositions,
                   CountTradesToday(), TodayRealizedProfit());

   Comment(txt);
  }
//+------------------------------------------------------------------+
