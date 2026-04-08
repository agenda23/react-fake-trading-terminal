export type Side = "BUY" | "SELL";
export type ThemePreset = "emerald" | "blue" | "violet" | "amber";
export type AnimationSpeed = 0.75 | 1 | 1.25;
export type Timeframe = "1m" | "5m" | "15m" | "1H" | "4H" | "1D";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartMarkerPoint {
  time: number;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown";
  text: string;
}

export interface ChartPriceLine {
  price: number;
  color: string;
  title: string;
}

export interface BotSignal {
  label: string;
  price: number;
  tone: "positive" | "neutral" | "negative";
}

export interface TokenCatalogItem {
  mint: string;
  symbol: string;
  name: string;
  source: "pumpportal" | "fallback";
  discoveredAt: Date;
}

export interface PumpPortalEvent {
  mint?: string;
  symbol?: string;
  name?: string;
  metadata?: {
    symbol?: string;
    name?: string;
  };
}

export interface TokenFeedStatus {
  connection: "connecting" | "live" | "fallback" | "reconnecting";
  source: "pumpportal" | "fallback";
  tokenCount: number;
  retryCount: number;
  lastUpdatedAt: number | null;
}

export interface WatchItem {
  pair: string;
  price: number;
  change24h: number;
  active: boolean;
}

export interface TradeItem {
  id: string;
  timestamp: number;
  time: string;
  side: Side;
  pair: string;
  sizeSol: number;
  referencePrice: number;
  pnlPercent: number;
}

export interface PositionItem {
  id: string;
  pair: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  pnlPercent: number;
  sizeSol: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface LogItem {
  id: string;
  time: string;
  level: "SIGNAL" | "ENTRY" | "EXIT" | "INFO";
  message: string;
}

export interface PerformanceMetrics {
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winTrades: number;
  avgHoldTimeSec: number;
  bestTradePct: number;
  worstTradePct: number;
  profitFactor: number;
}

export interface DashboardState {
  balanceSol: number;
  totalPnlSol: number;
  totalPnlPercent: number;
  todayPnlSol: number;
  winRate: number;
  watchlist: WatchItem[];
  trades: TradeItem[];
  positions: PositionItem[];
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
  logs: LogItem[];
  rpcLatency: number;
  blockHeight: number;
  tps: number;
  candles: Candle[];
  candlesByPair: Record<string, Candle[]>;
  chartTick: number;
  metrics: PerformanceMetrics;
}

export interface BotStrategy {
  id: string;
  name: string;
  status: "RUNNING" | "PAUSED";
  strategy: string;
  uptime: string;
  winRate: number;
  pnlSol: number;
}
