import { create } from "zustand";
import { createInitialState, tickState } from "../data/mock";
import type { DashboardState } from "../types";

interface TradingStoreState {
  state: DashboardState;
  reset: (initialTotalPnlSol: number) => void;
  tick: () => void;
  updatePortfolio: (next: Pick<DashboardState, "balanceSol" | "totalPnlSol" | "totalPnlPercent" | "todayPnlSol" | "winRate">) => void;
  updateWatchlist: (watchlist: DashboardState["watchlist"]) => void;
  updateOrderbook: (asks: DashboardState["asks"], bids: DashboardState["bids"]) => void;
  updateTrades: (trades: DashboardState["trades"]) => void;
  updatePositions: (positions: DashboardState["positions"]) => void;
  updateLogs: (logs: DashboardState["logs"]) => void;
  updateChart: (candles: DashboardState["candles"], chartTick: number) => void;
  updateNetwork: (rpcLatency: number) => void;
}

const applyTickToState = (prev: DashboardState): DashboardState => {
  const next = tickState(prev);

  return {
    ...prev,
    balanceSol: next.balanceSol,
    totalPnlSol: next.totalPnlSol,
    totalPnlPercent: next.totalPnlPercent,
    todayPnlSol: next.todayPnlSol,
    winRate: next.winRate,
    watchlist: next.watchlist,
    asks: next.asks,
    bids: next.bids,
    positions: next.positions,
    trades: next.trades,
    logs: next.logs,
    candles: next.candles,
    candlesByPair: next.candlesByPair,
    chartTick: next.chartTick,
    rpcLatency: next.rpcLatency,
    blockHeight: next.blockHeight,
    tps: next.tps,
    metrics: next.metrics,
  };
};

export const useTradingStore = create<TradingStoreState>((set) => ({
  state: createInitialState(12.38),
  reset: (initialTotalPnlSol) =>
    set({
      state: createInitialState(initialTotalPnlSol),
    }),
  tick: () =>
    set((current) => ({
      state: applyTickToState(current.state),
    })),
  updatePortfolio: (next) =>
    set((current) => ({
      state: {
        ...current.state,
        ...next,
      },
    })),
  updateWatchlist: (watchlist) =>
    set((current) => ({
      state: {
        ...current.state,
        watchlist,
      },
    })),
  updateOrderbook: (asks, bids) =>
    set((current) => ({
      state: {
        ...current.state,
        asks,
        bids,
      },
    })),
  updateTrades: (trades) =>
    set((current) => ({
      state: {
        ...current.state,
        trades,
      },
    })),
  updatePositions: (positions) =>
    set((current) => ({
      state: {
        ...current.state,
        positions,
      },
    })),
  updateLogs: (logs) =>
    set((current) => ({
      state: {
        ...current.state,
        logs,
      },
    })),
  updateChart: (candles, chartTick) =>
    set((current) => ({
      state: {
        ...current.state,
        candles,
        chartTick,
      },
    })),
  updateNetwork: (rpcLatency) =>
    set((current) => ({
      state: {
        ...current.state,
        rpcLatency,
      },
    })),
}));
