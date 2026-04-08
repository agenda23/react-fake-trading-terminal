import type { BotSignal, Candle, ChartMarkerPoint, ChartPriceLine, Timeframe, TradeItem } from "../types";

const timeframeFactorMap: Record<Timeframe, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1H": 60,
  "4H": 240,
  "1D": 1440,
};

export const aggregateCandles = (candles: Candle[], timeframe: Timeframe): Candle[] => {
  const factor = timeframeFactorMap[timeframe];
  if (factor === 1) return candles;

  const aggregated: Candle[] = [];

  for (let index = 0; index < candles.length; index += factor) {
    const bucket = candles.slice(index, index + factor);
    if (bucket.length === 0) continue;

    aggregated.push({
      time: bucket[0].time,
      open: bucket[0].open,
      high: Math.max(...bucket.map((item) => item.high)),
      low: Math.min(...bucket.map((item) => item.low)),
      close: bucket[bucket.length - 1].close,
      volume: bucket.reduce((sum, item) => sum + item.volume, 0),
    });
  }

  return aggregated;
};

export const buildTradeMarkers = (candles: Candle[], trades: TradeItem[]): ChartMarkerPoint[] => {
  if (candles.length === 0 || trades.length === 0) return [];

  const markerTrades = trades.slice(0, Math.min(6, candles.length));

  return markerTrades.map((trade, index) => {
    const candle =
      candles.reduce((closest, current) => {
        const currentDistance = Math.abs(current.time - trade.timestamp);
        const closestDistance = Math.abs(closest.time - trade.timestamp);
        return currentDistance < closestDistance ? current : closest;
      }, candles[0]) ?? candles[Math.min(candles.length - 1, index)];
    const isBuy = trade.side === "BUY";
    return {
      time: candle.time,
      position: isBuy ? "belowBar" : "aboveBar",
      color: isBuy ? "#0ecb81" : "#f6465d",
      shape: isBuy ? "arrowUp" : "arrowDown",
      text: `${trade.side} ${trade.sizeSol.toFixed(2)} @${trade.referencePrice.toFixed(trade.referencePrice >= 1 ? 2 : 4)}`,
    };
  });
};

export const buildBotSignals = (candles: Candle[]): BotSignal[] => {
  const last = candles[candles.length - 1];
  if (!last) return [];

  return [
    {
      label: "Entry",
      price: last.close,
      tone: "positive",
    },
    {
      label: "TP",
      price: last.close * 1.03,
      tone: "neutral",
    },
    {
      label: "SL",
      price: last.close * 0.985,
      tone: "negative",
    },
  ];
};

export const buildTradePriceLines = (trades: TradeItem[]): ChartPriceLine[] => {
  return trades.slice(0, 3).map((trade) => ({
    price: trade.referencePrice,
    color: trade.side === "BUY" ? "rgba(14, 203, 129, 0.8)" : "rgba(246, 70, 93, 0.8)",
    title: `${trade.side} ${trade.referencePrice.toFixed(trade.referencePrice >= 1 ? 2 : 4)}`,
  }));
};
