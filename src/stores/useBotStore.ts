import { create } from "zustand";
import type { BotStrategy } from "../types";

type BotPanelTab = "overview" | "parameters" | "backtest";

interface BotStoreState {
  bots: BotStrategy[];
  selectedBotId: string | null;
  activeTab: BotPanelTab;
  toggleBotStatus: (id: string) => void;
  selectBot: (id: string) => void;
  setActiveTab: (tab: BotPanelTab) => void;
}

const defaultBots: BotStrategy[] = [
  {
    id: "bot-1",
    name: "Nova Momentum",
    status: "RUNNING",
    strategy: "Breakout + volume confirmation",
    uptime: "12h 14m",
    winRate: 68.4,
    pnlSol: 4.12,
  },
  {
    id: "bot-2",
    name: "Orca Mean Revert",
    status: "RUNNING",
    strategy: "VWAP reversion scalper",
    uptime: "7h 08m",
    winRate: 64.9,
    pnlSol: 2.48,
  },
  {
    id: "bot-3",
    name: "Jito Range Guard",
    status: "PAUSED",
    strategy: "Range fade with trailing stop",
    uptime: "Paused 32m",
    winRate: 61.7,
    pnlSol: -0.42,
  },
];

export const useBotStore = create<BotStoreState>((set) => ({
  bots: defaultBots,
  selectedBotId: defaultBots[0]?.id ?? null,
  activeTab: "overview",
  toggleBotStatus: (id) =>
    set((state) => ({
      bots: state.bots.map((bot) =>
        bot.id === id
          ? {
              ...bot,
              status: bot.status === "RUNNING" ? "PAUSED" : "RUNNING",
              uptime: bot.status === "RUNNING" ? "Paused just now" : "Restarted now",
            }
          : bot,
      ),
    })),
  selectBot: (id) =>
    set({
      selectedBotId: id,
    }),
  setActiveTab: (tab) =>
    set({
      activeTab: tab,
    }),
}));
