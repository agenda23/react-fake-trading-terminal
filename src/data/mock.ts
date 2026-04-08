import { format } from "date-fns";
import type { Candle, DashboardState, LogItem, PerformanceMetrics, Side } from "../types";

const TOKEN_PAIRS = [
  "SOL/USDC",
  "RAY/SOL",
  "JUP/SOL",
  "BONK/SOL",
  "WIF/SOL",
  "JTO/SOL",
  "PYTH/SOL",
  "ORCA/SOL",
];

const random = (min: number, max: number) => Math.random() * (max - min) + min;

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const createHistoricalCandles = (basePrice: number, count = 90): Candle[] => {
  const now = Math.floor(Date.now() / 1000);
  const candles: Candle[] = [];
  let cursor = basePrice * (1 + random(-0.01, 0.01));

  for (let index = count; index > 0; index -= 1) {
    const open = cursor;
    const close = open * (1 + random(-0.005, 0.005));
    const high = Math.max(open, close) * (1 + random(0.0005, 0.003));
    const low = Math.min(open, close) * (1 - random(0.0005, 0.003));
    candles.push({
      time: now - index * 60,
      open,
      high,
      low,
      close,
      volume: random(2000, 12000),
    });
    cursor = close;
  }

  return candles;
};

const buildLog = (level: LogItem["level"], message: string): LogItem => ({
  id: crypto.randomUUID(),
  time: format(new Date(), "HH:mm:ss"),
  level,
  message,
});

const buildTrade = (
  pair: string,
  side: Side,
  sizeSol: number,
  referencePrice: number,
  pnlPercent: number,
  timestamp: number,
) => ({
  id: crypto.randomUUID(),
  timestamp,
  time: format(new Date(timestamp * 1000), "HH:mm:ss"),
  side,
  pair,
  sizeSol,
  referencePrice,
  pnlPercent,
});

const createInitialMetrics = (): PerformanceMetrics => ({
  sharpeRatio: Number(random(0.8, 2.4).toFixed(2)),
  maxDrawdown: Number(random(3.5, 12.0).toFixed(2)),
  totalTrades: Math.floor(random(80, 200)),
  winTrades: Math.floor(random(55, 140)),
  avgHoldTimeSec: Math.floor(random(60, 600)),
  bestTradePct: Number(random(8, 25).toFixed(2)),
  worstTradePct: Number(random(-12, -3).toFixed(2)),
  profitFactor: Number(random(1.2, 3.0).toFixed(2)),
});

export const createInitialState = (initialTotalPnlSol = 12.38): DashboardState => {
  const watchlist = TOKEN_PAIRS.map((pair, index) => ({
    pair,
    price: index === 0 ? 148 : random(0.000001, 0.05),
    change24h: random(-6.5, 8.2),
    active: index % 3 === 0,
  }));

  const totalPnlSol = initialTotalPnlSol;
  const balanceSol = 50 + totalPnlSol;
  const now = Math.floor(Date.now() / 1000);

  return {
    balanceSol,
    totalPnlSol,
    totalPnlPercent: (totalPnlSol / 50) * 100,
    todayPnlSol: 1.84,
    winRate: 67.3,
    watchlist,
    trades: [
      buildTrade("SOL/USDC", "BUY", 0.52, watchlist[0]?.price ?? 148, 3.4, now - 6 * 60),
      buildTrade("JUP/SOL", "SELL", 1.7, watchlist[2]?.price ?? 0.0089, -1.2, now - 10 * 60),
      buildTrade("WIF/SOL", "BUY", 2.03, watchlist[4]?.price ?? 0.0156, 5.1, now - 16 * 60),
    ],
    positions: [
      {
        id: crypto.randomUUID(),
        pair: "SOL/USDC",
        side: "LONG",
        entryPrice: 147.2,
        currentPrice: 148.1,
        pnlPercent: 0.61,
        sizeSol: 0.8,
      },
      {
        id: crypto.randomUUID(),
        pair: "JTO/SOL",
        side: "LONG",
        entryPrice: 0.0191,
        currentPrice: 0.0197,
        pnlPercent: 3.14,
        sizeSol: 1.2,
      },
    ],
    asks: [0, 1, 2, 3, 4].map((step) => ({ price: 148.45 + step * 0.05, size: random(2, 20) })),
    bids: [0, 1, 2, 3, 4].map((step) => ({ price: 148.35 - step * 0.05, size: random(2, 20) })),
    logs: [
      buildLog("INFO", "Engine initialized with seed state."),
      buildLog("SIGNAL", "Momentum entry signal detected on SOL/USDC."),
      buildLog("ENTRY", "Opened LONG SOL/USDC at 147.20."),
    ],
    rpcLatency: 42,
    blockHeight: 280_000_000 + Math.floor(random(0, 100_000)),
    tps: Math.round(random(80, 200)),
    candles: createHistoricalCandles(watchlist[0]?.price ?? 148),
    candlesByPair: Object.fromEntries(
      watchlist.map((item) => [item.pair, createHistoricalCandles(item.price)]),
    ),
    chartTick: 0,
    metrics: createInitialMetrics(),
  };
};

export const tickState = (prev: DashboardState): DashboardState => {
  const watchlist = prev.watchlist.map((item) => {
    const drift = item.price * random(-0.002, 0.002);
    const nextPrice = Math.max(item.price + drift, 0.0000001);
    return {
      ...item,
      price: nextPrice,
      change24h: Math.max(-14.9, Math.min(18.8, item.change24h + random(-0.22, 0.22))),
    };
  });

  const basePrice = watchlist[0]?.price ?? 148;
  const asks = [0, 1, 2, 3, 4].map((step) => ({ price: basePrice + 0.05 + step * 0.05, size: random(2, 22) }));
  const bids = [0, 1, 2, 3, 4].map((step) => ({ price: basePrice - 0.05 - step * 0.05, size: random(2, 22) }));

  const MAX_POSITIONS = 6;
  let positions = prev.positions.map((position) => {
    const anchor = watchlist.find((item) => item.pair === position.pair)?.price ?? position.currentPrice;
    const pnlPercent = ((anchor - position.entryPrice) / position.entryPrice) * 100;
    return { ...position, currentPrice: anchor, pnlPercent };
  });

  // TP/SL ヒットでポジションをクローズ（確率 20%）
  positions = positions.filter((pos) => {
    const hit = Math.random() < 0.2;
    const tpSl = Math.abs(pos.pnlPercent) >= 2.5;
    return !(hit || tpSl);
  });

  // 新規ポジションをオープン（確率 25%、上限 MAX_POSITIONS）
  if (Math.random() < 0.25 && positions.length < MAX_POSITIONS) {
    const pair = pick(TOKEN_PAIRS);
    const pairPrice = watchlist.find((item) => item.pair === pair)?.price ?? basePrice;
    const side: "LONG" | "SHORT" = Math.random() > 0.4 ? "LONG" : "SHORT";
    positions = [
      ...positions,
      {
        id: crypto.randomUUID(),
        pair,
        side,
        entryPrice: pairPrice,
        currentPrice: pairPrice,
        pnlPercent: 0,
        sizeSol: Number(random(0.3, 2.0).toFixed(2)),
      },
    ];
  }

  const chartTick = prev.chartTick + 1;

  const updatePairCandles = (prevCandles: Candle[], price: number): Candle[] => {
    const updated = [...prevCandles];
    const last = updated[updated.length - 1];
    if (last) {
      updated[updated.length - 1] = {
        ...last,
        close: price,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        volume: last.volume + random(150, 1200),
      };
    }
    if (chartTick % 5 === 0) {
      updated.push({
        time: (last?.time ?? Math.floor(Date.now() / 1000)) + 60,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: random(1200, 5000),
      });
    }
    return updated.slice(-90);
  };

  const candles = updatePairCandles(prev.candles, basePrice);

  const candlesByPair: Record<string, Candle[]> = {};
  for (const item of watchlist) {
    const prevPairCandles = prev.candlesByPair[item.pair] ?? prev.candles;
    candlesByPair[item.pair] = updatePairCandles(prevPairCandles, item.price);
  }

  const totalPnlSol = Math.max(-5, Math.min(30, prev.totalPnlSol + random(-0.15, 0.2)));
  const totalPnlPercent = (totalPnlSol / 50) * 100;
  const todayPnlSol = prev.todayPnlSol + random(-0.08, 0.1);
  const winRate = Math.max(60, Math.min(70, prev.winRate + random(-0.08, 0.08)));

  const shouldAddTrade = Math.random() < 0.24;
  const side: Side = Math.random() > 0.48 ? "BUY" : "SELL";
  const pair = pick(TOKEN_PAIRS);
  const trade = buildTrade(
    pair,
    side,
    Number(random(0.3, 2.2).toFixed(2)),
    watchlist.find((item) => item.pair === pair)?.price ?? basePrice,
    Number(random(-4.5, 7.8).toFixed(2)),
    Math.floor(Date.now() / 1000),
  );
  const trades = shouldAddTrade ? [trade, ...prev.trades].slice(0, 20) : prev.trades;

  const logPool: Array<[LogItem["level"], string]> = [
    ["SIGNAL", `${pair} signal confirmed by volume spike.`],
    ["ENTRY", `${side} order submitted for ${pair}.`],
    ["EXIT", `Partial exit executed on ${pair}.`],
    ["INFO", `Orderbook spread normalized to ${random(0.02, 0.09).toFixed(3)}.`],
  ];
  const shouldAddLog = Math.random() < 0.4;
  const [level, message] = pick(logPool);
  const logs = shouldAddLog ? [buildLog(level, message), ...prev.logs].slice(0, 40) : prev.logs;

  const metrics: typeof prev.metrics = {
    sharpeRatio: Math.max(0.1, Number((prev.metrics.sharpeRatio + random(-0.02, 0.02)).toFixed(2))),
    maxDrawdown: Math.max(0.1, Number((prev.metrics.maxDrawdown + random(-0.05, 0.05)).toFixed(2))),
    totalTrades: shouldAddTrade ? prev.metrics.totalTrades + 1 : prev.metrics.totalTrades,
    winTrades:
      shouldAddTrade && trade.pnlPercent > 0 ? prev.metrics.winTrades + 1 : prev.metrics.winTrades,
    avgHoldTimeSec: Math.max(30, Math.round(prev.metrics.avgHoldTimeSec + random(-5, 5))),
    bestTradePct: Math.max(
      prev.metrics.bestTradePct,
      shouldAddTrade && trade.pnlPercent > 0 ? trade.pnlPercent : 0,
    ),
    worstTradePct: Math.min(
      prev.metrics.worstTradePct,
      shouldAddTrade && trade.pnlPercent < 0 ? trade.pnlPercent : 0,
    ),
    profitFactor: Math.max(0.1, Number((prev.metrics.profitFactor + random(-0.02, 0.03)).toFixed(2))),
  };

  return {
    ...prev,
    watchlist,
    asks,
    bids,
    positions,
    trades,
    logs,
    totalPnlSol,
    totalPnlPercent,
    todayPnlSol,
    winRate,
    rpcLatency: Math.round(random(28, 88)),
    blockHeight: prev.blockHeight + Math.floor(random(1, 4)),
    tps: Math.max(20, Math.min(400, Math.round(prev.tps + random(-15, 15)))),
    balanceSol: 50 + totalPnlSol + random(-0.15, 0.15),
    candles,
    candlesByPair,
    chartTick,
    metrics,
  };
};
