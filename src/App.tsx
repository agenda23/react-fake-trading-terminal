import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, Hexagon, Network, Settings, TrendingDown, TrendingUp } from "lucide-react";
import { TradingChart } from "./components/chart/TradingChart";
import { useSimulation } from "./hooks/useSimulation";
import { useTokenCatalog } from "./hooks/useTokenCatalog";
import { useBotStore } from "./stores/useBotStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import type { AnimationSpeed, BotStrategy, PerformanceMetrics, ThemePreset, Timeframe, TokenFeedStatus } from "./types";
import { aggregateCandles, buildBotSignals, buildTradeMarkers, buildTradePriceLines } from "./utils/chart";

const pnlClass = (value: number) => (value >= 0 ? "text-accent-green" : "text-accent-red");

function MetricsPanel({ metrics }: { metrics: PerformanceMetrics }) {
  return (
    <div className="mt-2 shrink-0 rounded border border-border-primary bg-bg-tertiary px-2 py-2 text-[11px]">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-text-secondary">Performance</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="flex justify-between">
          <span className="text-text-secondary">Sharpe</span>
          <span className="mono">{metrics.sharpeRatio.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">MaxDD</span>
          <span className="mono text-accent-red">-{metrics.maxDrawdown.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Trades</span>
          <span className="mono">{metrics.totalTrades}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Wins</span>
          <span className="mono">{metrics.winTrades}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">PF</span>
          <span className={`mono ${pnlClass(metrics.profitFactor - 1)}`}>{metrics.profitFactor.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">AvgHold</span>
          <span className="mono">{metrics.avgHoldTimeSec}s</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Best</span>
          <span className="mono text-accent-green">+{metrics.bestTradePct.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Worst</span>
          <span className="mono text-accent-red">{metrics.worstTradePct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

function ConsoleLog({ logs }: { logs: import("./types").LogItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      ref={containerRef}
      className="h-[118px] space-y-1 overflow-y-auto rounded border border-border-primary bg-bg-tertiary p-2 text-xs"
    >
      {logs.map((log) => (
        <div key={log.id} className="mono grid grid-cols-[70px_55px_1fr] gap-2">
          <span className="text-text-secondary">{log.time}</span>
          <span className="text-accent-blue">{log.level}</span>
          <span>{log.message}</span>
        </div>
      ))}
    </div>
  );
}

const fmtPrice = (value: number) => {
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(4);
  return value.toFixed(8);
};

const themeAccentMap: Record<ThemePreset, string> = {
  emerald: "#0ecb81",
  blue: "#3b82f6",
  violet: "#a855f7",
  amber: "#f59e0b",
};

const themeLabelMap: Record<ThemePreset, string> = {
  emerald: "Emerald",
  blue: "Blue",
  violet: "Violet",
  amber: "Amber",
};

const animationSpeedOptions: AnimationSpeed[] = [0.75, 1, 1.25];
const themeOptions: ThemePreset[] = ["emerald", "blue", "violet", "amber"];
const timeframes: Timeframe[] = ["1m", "5m", "15m", "1H", "4H", "1D"];

const feedStatusLabelMap: Record<TokenFeedStatus["connection"], string> = {
  connecting: "Connecting",
  live: "Live",
  fallback: "Fallback",
  reconnecting: "Reconnecting",
};

const feedStatusClass = (connection: TokenFeedStatus["connection"]) => {
  if (connection === "live") return "text-accent-green";
  if (connection === "fallback") return "text-accent-yellow";
  return "text-accent-blue";
};

function BotsModal({
  open,
  onClose,
  strategies,
  selectedBotId,
  activeTab,
  onSelectBot,
  onSetActiveTab,
  onToggleBotStatus,
}: {
  open: boolean;
  onClose: () => void;
  strategies: BotStrategy[];
  selectedBotId: string | null;
  activeTab: "overview" | "parameters" | "backtest";
  onSelectBot: (id: string) => void;
  onSetActiveTab: (tab: "overview" | "parameters" | "backtest") => void;
  onToggleBotStatus: (id: string) => void;
}) {
  if (!open) return null;

  const selectedBot = strategies.find((bot) => bot.id === selectedBotId) ?? strategies[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel ui-motion w-full max-w-5xl p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Bot Control Center</h2>
            <p className="text-xs text-text-secondary">戦略一覧、稼働状態、勝率、擬似PnL を管理画面として表示します。</p>
          </div>
          <button className="rounded border border-border-primary px-2 py-1 text-xs ui-motion hover:bg-bg-tertiary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3 md:grid-cols-2">
          {strategies.map((bot) => (
            <div
              key={bot.id}
              onClick={() => onSelectBot(bot.id)}
              className="ui-motion cursor-pointer rounded border bg-bg-tertiary p-3 text-left"
              style={{
                borderColor: selectedBot?.id === bot.id ? "var(--theme-accent)" : "var(--border-primary)",
              }}
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="font-medium">{bot.name}</div>
                  <div className="text-xs text-text-secondary">{bot.strategy}</div>
                </div>
                <span className={`mono text-xs ${bot.status === "RUNNING" ? "text-accent-green" : "text-accent-yellow"}`}>
                  {bot.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded border border-border-primary bg-bg-primary px-2 py-1">
                  <div className="text-text-secondary">Uptime</div>
                  <div className="mono">{bot.uptime}</div>
                </div>
                <div className="rounded border border-border-primary bg-bg-primary px-2 py-1">
                  <div className="text-text-secondary">Win Rate</div>
                  <div className="mono">{bot.winRate.toFixed(1)}%</div>
                </div>
                <div className="rounded border border-border-primary bg-bg-primary px-2 py-1">
                  <div className="text-text-secondary">PnL</div>
                  <div className={`mono ${pnlClass(bot.pnlSol)}`}>{bot.pnlSol >= 0 ? "+" : ""}{bot.pnlSol.toFixed(2)} SOL</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="ui-motion rounded border border-border-primary px-3 py-2 text-xs hover:bg-bg-primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectBot(bot.id);
                    onSetActiveTab("parameters");
                  }}
                >
                  Parameters
                </button>
                <button
                  type="button"
                  className="ui-motion rounded border border-border-primary px-3 py-2 text-xs hover:bg-bg-primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectBot(bot.id);
                    onSetActiveTab("backtest");
                  }}
                >
                  Backtest
                </button>
                <button
                  type="button"
                  className="ui-motion rounded px-3 py-2 text-xs font-medium text-black"
                  style={{ backgroundColor: bot.status === "RUNNING" ? "#f0b90b" : "var(--theme-accent)" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleBotStatus(bot.id);
                  }}
                >
                  {bot.status === "RUNNING" ? "Pause" : "Resume"}
                </button>
              </div>
            </div>
          ))}
          </div>

          <div className="rounded border border-border-primary bg-bg-tertiary p-4">
            {selectedBot ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold">{selectedBot.name}</div>
                    <div className="text-xs text-text-secondary">{selectedBot.strategy}</div>
                  </div>
                  <span className={`mono text-xs ${selectedBot.status === "RUNNING" ? "text-accent-green" : "text-accent-yellow"}`}>
                    {selectedBot.status}
                  </span>
                </div>

                <div className="mb-3 flex gap-2">
                  {(["overview", "parameters", "backtest"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => onSetActiveTab(tab)}
                      className="ui-motion rounded border px-3 py-2 text-xs capitalize"
                      style={{
                        borderColor: activeTab === tab ? "var(--theme-accent)" : "var(--border-primary)",
                        color: activeTab === tab ? "var(--theme-accent)" : undefined,
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {activeTab === "overview" ? (
                  <div className="grid gap-2 text-xs">
                    <div className="rounded border border-border-primary bg-bg-primary p-3">
                      <div className="text-text-secondary">Performance Snapshot</div>
                      <div className="mt-2 flex items-center justify-between mono">
                        <span>Win Rate {selectedBot.winRate.toFixed(1)}%</span>
                        <span className={pnlClass(selectedBot.pnlSol)}>{selectedBot.pnlSol >= 0 ? "+" : ""}{selectedBot.pnlSol.toFixed(2)} SOL</span>
                      </div>
                    </div>
                    <div className="rounded border border-border-primary bg-bg-primary p-3 text-text-secondary">
                      Runtime: {selectedBot.uptime}. Execution state and dashboard badges update immediately when paused or resumed.
                    </div>
                  </div>
                ) : null}

                {activeTab === "parameters" ? (
                  <div className="grid gap-2 text-xs">
                    <div className="rounded border border-border-primary bg-bg-primary p-3">
                      <div className="text-text-secondary">Slippage</div>
                      <div className="mono mt-1">0.85%</div>
                    </div>
                    <div className="rounded border border-border-primary bg-bg-primary p-3">
                      <div className="text-text-secondary">Take Profit / Stop Loss</div>
                      <div className="mono mt-1">+3.2% / -1.5%</div>
                    </div>
                    <div className="rounded border border-border-primary bg-bg-primary p-3">
                      <div className="text-text-secondary">Gas Cap</div>
                      <div className="mono mt-1">0.012 SOL</div>
                    </div>
                  </div>
                ) : null}

                {activeTab === "backtest" ? (
                  <div className="grid gap-2 text-xs">
                    <div className="rounded border border-border-primary bg-bg-primary p-3">
                      <div className="text-text-secondary">30D Backtest</div>
                      <div className="mono mt-1">Return +18.4% / Max DD -7.2%</div>
                    </div>
                    <div className="rounded border border-border-primary bg-bg-primary p-3">
                      <div className="text-text-secondary">Trade Sample</div>
                      <div className="mono mt-1">184 trades / PF 2.09 / Avg Hold 13m</div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const preview = useSettingsStore((store) => store.preview);
  const saved = useSettingsStore((store) => store.saved);
  const setPreviewInitialTotalPnlSol = useSettingsStore((store) => store.setPreviewInitialTotalPnlSol);
  const setPreviewAnimationSpeed = useSettingsStore((store) => store.setPreviewAnimationSpeed);
  const setPreviewThemePreset = useSettingsStore((store) => store.setPreviewThemePreset);
  const setPreviewTokenFeedMaxPerMinute = useSettingsStore((store) => store.setPreviewTokenFeedMaxPerMinute);
  const setPreviewTokenCatalogLimit = useSettingsStore((store) => store.setPreviewTokenCatalogLimit);
  const commitPreview = useSettingsStore((store) => store.commitPreview);
  const revertPreview = useSettingsStore((store) => store.revertPreview);
  const resetPreview = useSettingsStore((store) => store.resetPreview);
  const restartSimulation = useSettingsStore((store) => store.restartSimulation);

  if (!open) return null;

  const handleSave = () => {
    commitPreview();
    onClose();
  };

  const handleClose = () => {
    revertPreview();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel ui-motion w-full max-w-lg p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Settings</h2>
            <p className="text-xs text-text-secondary">テーマと演出は即時プレビュー、初期PnLは保存後の再開時に反映されます。</p>
          </div>
          <button className="rounded border border-border-primary px-2 py-1 text-xs ui-motion hover:bg-bg-tertiary" onClick={handleClose}>
            Close
          </button>
        </div>

        <div className="space-y-4">
          <section className="rounded border border-border-primary bg-bg-tertiary p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">Initial Total PnL</h3>
              <span className="mono text-xs text-text-secondary">
                {preview.initialTotalPnlSol >= 0 ? "+" : ""}
                {preview.initialTotalPnlSol.toFixed(2)} SOL / {(preview.initialTotalPnlSol / 50 * 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min={-5}
              max={30}
              step={0.01}
              value={preview.initialTotalPnlSol}
              onChange={(event) => setPreviewInitialTotalPnlSol(Number(event.target.value))}
              className="w-full"
            />
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={-5}
                max={30}
                step={0.01}
                value={preview.initialTotalPnlSol}
                onChange={(event) => setPreviewInitialTotalPnlSol(Number(event.target.value))}
                className="mono w-28 rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm text-text-primary"
              />
              <span className="text-xs text-text-secondary">許容範囲: -5.00 〜 +30.00 SOL</span>
            </div>
          </section>

          <section className="rounded border border-border-primary bg-bg-tertiary p-3">
            <h3 className="mb-2 text-sm font-medium">Animation Speed</h3>
            <div className="flex gap-2">
              {animationSpeedOptions.map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPreviewAnimationSpeed(speed)}
                  className="ui-motion rounded border px-3 py-2 text-sm"
                  style={{
                    borderColor: preview.animationSpeed === speed ? "var(--theme-accent)" : "var(--border-primary)",
                    color: preview.animationSpeed === speed ? "var(--theme-accent)" : undefined,
                  }}
                >
                  {speed.toFixed(2)}x
                </button>
              ))}
            </div>
          </section>

          <section className="rounded border border-border-primary bg-bg-tertiary p-3">
            <h3 className="mb-2 text-sm font-medium">Theme Preset</h3>
            <div className="grid grid-cols-4 gap-2">
              {themeOptions.map((theme) => (
                <button
                  key={theme}
                  onClick={() => setPreviewThemePreset(theme)}
                  className="ui-motion rounded border px-3 py-2 text-sm"
                  style={{
                    borderColor: preview.themePreset === theme ? themeAccentMap[theme] : "var(--border-primary)",
                    color: preview.themePreset === theme ? themeAccentMap[theme] : undefined,
                  }}
                >
                  {themeLabelMap[theme]}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded border border-border-primary bg-bg-tertiary p-3">
            <h3 className="mb-2 text-sm font-medium">Token Feed Limits</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-xs text-text-secondary">Max New Tokens / Min</div>
                <input
                  type="number"
                  min={5}
                  max={60}
                  step={1}
                  value={preview.tokenFeedMaxPerMinute}
                  onChange={(event) => setPreviewTokenFeedMaxPerMinute(Number(event.target.value))}
                  className="mono w-full rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm text-text-primary"
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-text-secondary">Catalog Size Limit</div>
                <input
                  type="number"
                  min={5}
                  max={50}
                  step={1}
                  value={preview.tokenCatalogLimit}
                  onChange={(event) => setPreviewTokenCatalogLimit(Number(event.target.value))}
                  className="mono w-full rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm text-text-primary"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-text-secondary">
            Saved: {themeLabelMap[saved.themePreset]} / {saved.animationSpeed.toFixed(2)}x / {saved.initialTotalPnlSol.toFixed(2)} SOL / Feed {saved.tokenFeedMaxPerMinute}/m / Catalog {saved.tokenCatalogLimit}
          </div>
          <div className="flex gap-2">
            <button className="ui-motion rounded border border-border-primary px-3 py-2 text-sm hover:bg-bg-tertiary" onClick={resetPreview}>
              Default
            </button>
            <button className="ui-motion rounded border border-border-primary px-3 py-2 text-sm hover:bg-bg-tertiary" onClick={restartSimulation}>
              Restart
            </button>
            <button
              className="ui-motion rounded px-3 py-2 text-sm font-medium text-black"
              style={{ backgroundColor: "var(--theme-accent)" }}
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const state = useSimulation();
  const savedSettings = useSettingsStore((store) => store.saved);
  const { tokens: tokenCatalog, status: tokenFeedStatus } = useTokenCatalog({
    maxPerMinute: savedSettings.tokenFeedMaxPerMinute,
    maxCatalogSize: savedSettings.tokenCatalogLimit,
  });
  const [botsOpen, setBotsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [selectedPair, setSelectedPair] = useState<string>("SOL/USDC");
  const hydrate = useSettingsStore((store) => store.hydrate);
  const hasHydrated = useSettingsStore((store) => store.hasHydrated);
  const preview = useSettingsStore((store) => store.preview);
  const botStrategies = useBotStore((store) => store.bots);
  const selectedBotId = useBotStore((store) => store.selectedBotId);
  const activeBotTab = useBotStore((store) => store.activeTab);
  const toggleBotStatus = useBotStore((store) => store.toggleBotStatus);
  const selectBot = useBotStore((store) => store.selectBot);
  const setActiveBotTab = useBotStore((store) => store.setActiveTab);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--theme-accent", themeAccentMap[preview.themePreset]);
    root.style.setProperty("--ui-motion-duration", `${Math.round(220 / preview.animationSpeed)}ms`);
  }, [preview.animationSpeed, preview.themePreset]);

  const activePairCandles = useMemo(
    () => state.candlesByPair[selectedPair] ?? state.candles,
    [state.candlesByPair, state.candles, selectedPair],
  );
  const chartCandles = useMemo(() => aggregateCandles(activePairCandles, timeframe), [activePairCandles, timeframe]);
  const chartMarkers = useMemo(() => buildTradeMarkers(chartCandles, state.trades), [chartCandles, state.trades]);
  const chartPriceLines = useMemo(() => buildTradePriceLines(state.trades), [state.trades]);
  const botSignals = useMemo(() => buildBotSignals(chartCandles), [chartCandles]);
  const runningBotsCount = useMemo(
    () => botStrategies.filter((bot) => bot.status === "RUNNING").length,
    [botStrategies],
  );
  const sidebarWatchlist = useMemo(() => {
    const dynamicTokens = tokenCatalog.filter((token) => token.symbol !== "SOL").slice(0, Math.max(0, state.watchlist.length - 1));

    return state.watchlist.map((item, index) => {
      if (index === 0) {
        return {
          ...item,
          displayPair: "SOL/USDC",
          tokenName: "Solana",
        };
      }

      const token = dynamicTokens[index - 1];
      return {
        ...item,
        displayPair: token ? `${token.symbol}/SOL` : item.pair,
        tokenName: token?.name ?? item.pair.replace("/SOL", ""),
      };
    });
  }, [state.watchlist, tokenCatalog]);

  if (!hasHydrated) {
    return <div className="flex h-screen items-center justify-center bg-bg-primary text-text-secondary">Loading settings...</div>;
  }

  return (
    <div className="grid h-screen grid-rows-[56px_1fr_200px_160px_28px] gap-2 bg-bg-primary p-2 text-sm">
      <header className="panel grid grid-cols-[160px_200px_240px_1fr] items-center gap-3 px-4">
        <div className="flex items-center gap-2">
          <Hexagon size={16} style={{ color: "var(--theme-accent)" }} />
          <span className="font-semibold">NovaPlex Core</span>
        </div>
        <div>
          <div className="mono text-xl font-semibold">{state.balanceSol.toFixed(2)} SOL</div>
          <div className="text-xs text-text-secondary">≈ ${(state.balanceSol * 148).toFixed(0)} USD</div>
        </div>
        <div>
          <div className={`mono text-base font-semibold ${pnlClass(state.totalPnlSol)}`}>
            {state.totalPnlSol >= 0 ? "+" : ""}
            {state.totalPnlSol.toFixed(2)} SOL
            <span className="ml-1 text-xs">({state.totalPnlPercent.toFixed(1)}%)</span>
          </div>
          <div className="text-xs text-text-secondary">
            Today {state.todayPnlSol >= 0 ? "+" : ""}
            {state.todayPnlSol.toFixed(2)} SOL
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 text-xs">
          <span className="text-text-secondary">W/R {state.winRate.toFixed(1)}%</span>
          <span className="inline-flex items-center gap-1 text-text-secondary">
            <Bot size={12} />{runningBotsCount} Active
          </span>
          <button
            onClick={() => setBotsOpen(true)}
            className="ui-motion inline-flex items-center gap-1 rounded border border-border-primary px-2 py-1 hover:bg-bg-tertiary"
          >
            <Bot size={12} />
            Bots
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="ui-motion inline-flex items-center gap-1 rounded border border-border-primary px-2 py-1 hover:bg-bg-tertiary"
          >
            <Settings size={12} />
            Settings
          </button>
        </div>
      </header>

      <section className="grid grid-cols-[260px_1fr_320px] gap-2 min-h-0 overflow-hidden">
        <aside className="panel flex h-full flex-col overflow-hidden p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-text-secondary">Watchlist</h2>
            <span className={`mono text-[11px] ${feedStatusClass(tokenFeedStatus.connection)}`}>
              {feedStatusLabelMap[tokenFeedStatus.connection]}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-0.5">
            {sidebarWatchlist.map((item) => {
              const isSelected = selectedPair === item.pair;
              return (
                <div
                  key={item.pair}
                  onClick={() => setSelectedPair(item.pair)}
                  className="ui-motion cursor-pointer rounded border bg-bg-tertiary px-2 py-1 hover:border-text-secondary"
                  style={{ borderColor: isSelected ? "var(--theme-accent)" : "var(--border-primary)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="mono text-xs" style={{ color: isSelected ? "var(--theme-accent)" : undefined }}>
                      {item.displayPair}
                    </span>
                    {item.active ? <Activity size={12} style={{ color: "var(--theme-accent)" }} /> : null}
                  </div>
                  <div className="truncate text-[11px] text-text-secondary">{item.tokenName}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="mono">{fmtPrice(item.price)}</span>
                    <span className={`mono text-xs ${pnlClass(item.change24h)}`}>
                      {item.change24h >= 0 ? "+" : ""}
                      {item.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 shrink-0 rounded border border-border-primary bg-bg-tertiary px-2 py-2 text-[11px] text-text-secondary">
            <div className="flex items-center justify-between">
              <span>Token Feed</span>
              <span className={`mono ${feedStatusClass(tokenFeedStatus.connection)}`}>{tokenFeedStatus.source}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Catalog</span>
              <span className="mono">{tokenFeedStatus.tokenCount} items</span>
            </div>
          </div>
          <MetricsPanel metrics={state.metrics} />
        </aside>

        <main className="panel flex min-h-0 flex-col overflow-hidden p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="mono text-sm">
                {sidebarWatchlist.find((w) => w.pair === selectedPair)?.displayPair ?? selectedPair}
                {" "}
                <span style={{ color: "var(--theme-accent)" }}>
                  ${fmtPrice(state.watchlist.find((w) => w.pair === selectedPair)?.price ?? 0)}
                </span>
              </h2>
              {botSignals.length > 0 ? (
                <div className="mt-1 text-xs text-text-secondary">
                  Signal: {botSignals.map((signal) => `${signal.label} @${fmtPrice(signal.price)}`).join(" / ")}
                </div>
              ) : null}
            </div>
            <div className="flex gap-1 text-xs">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className="ui-motion rounded border px-2 py-1 hover:bg-bg-tertiary"
                  style={{
                    borderColor: timeframe === tf ? "var(--theme-accent)" : "var(--border-primary)",
                    color: timeframe === tf ? "var(--theme-accent)" : undefined,
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded border border-border-primary bg-bg-tertiary p-3">
            <TradingChart
              candles={chartCandles}
              themePreset={preview.themePreset}
              markers={chartMarkers}
              priceLines={chartPriceLines}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
            <div className="mono">
              {timeframe} / {chartCandles.length} bars / markers {chartMarkers.length}
            </div>
            <div className="flex gap-3">
              {botSignals.map((signal) => (
                <span
                  key={signal.label}
                  className="mono"
                  style={{
                    color:
                      signal.tone === "positive"
                        ? "#0ecb81"
                        : signal.tone === "negative"
                          ? "#f6465d"
                          : "var(--theme-accent)",
                  }}
                >
                  {signal.label} {fmtPrice(signal.price)}
                </span>
              ))}
            </div>
          </div>
        </main>

        <aside className="panel grid min-h-0 grid-rows-[1fr_1fr] gap-2 overflow-hidden p-3">
          <section className="flex min-h-0 flex-col overflow-hidden rounded border border-border-primary bg-bg-tertiary p-2">
            <h3 className="mb-2 shrink-0 text-xs uppercase tracking-wider text-text-secondary">Order Book</h3>
            <div className="min-h-0 flex-1 overflow-y-auto space-y-1 text-xs">
              {state.asks.map((ask, idx) => (
                <div key={`a-${idx}`} className="mono flex justify-between text-accent-red">
                  <span>{ask.price.toFixed(2)}</span>
                  <span>{ask.size.toFixed(2)}</span>
                </div>
              ))}
              <div className="my-1 border-y border-border-primary py-1 text-center mono">
                Spread {(state.asks[0].price - state.bids[0].price).toFixed(3)}
              </div>
              {state.bids.map((bid, idx) => (
                <div key={`b-${idx}`} className="mono flex justify-between text-accent-green">
                  <span>{bid.price.toFixed(2)}</span>
                  <span>{bid.size.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="flex min-h-0 flex-col overflow-hidden rounded border border-border-primary bg-bg-tertiary p-2">
            <h3 className="mb-2 shrink-0 text-xs uppercase tracking-wider text-text-secondary">Recent Trades</h3>
            <div className="min-h-0 flex-1 overflow-y-auto space-y-1 text-xs">
              {state.trades.map((trade) => (
                <div key={trade.id} className="grid grid-cols-[auto_40px_1fr_auto] gap-2 mono">
                  <span className="text-text-secondary">{trade.time}</span>
                  <span className={trade.side === "BUY" ? "text-accent-green" : "text-accent-red"}>{trade.side}</span>
                  <span>{trade.sizeSol.toFixed(2)} SOL</span>
                  <span className={pnlClass(trade.pnlPercent)}>{trade.pnlPercent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className="panel grid grid-cols-[1.4fr_1fr] gap-3 overflow-hidden p-3">
        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wider text-text-secondary">Active Positions</h2>
          <div className="space-y-2">
            {state.positions.map((position) => {
              const unrealizedSol = position.sizeSol * position.entryPrice * (position.pnlPercent / 100);
              return (
                <div key={position.id} className="grid grid-cols-[110px_60px_1fr_1fr_90px_80px] rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-xs">
                  <span className="mono">{position.pair}</span>
                  <span className={position.side === "LONG" ? "text-accent-green" : "text-accent-red"}>{position.side}</span>
                  <span className="mono">Entry {fmtPrice(position.entryPrice)}</span>
                  <span className="mono">Now {fmtPrice(position.currentPrice)}</span>
                  <span className={`mono text-right ${pnlClass(position.pnlPercent)}`}>
                    {position.pnlPercent >= 0 ? "+" : ""}
                    {position.pnlPercent.toFixed(2)}%
                  </span>
                  <span className={`mono text-right ${pnlClass(unrealizedSol)}`}>
                    {unrealizedSol >= 0 ? "+" : ""}
                    {unrealizedSol.toFixed(4)} SOL
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-text-secondary">Bot Strategies</h2>
            <button className="ui-motion rounded border border-border-primary px-2 py-1 text-[11px] hover:bg-bg-tertiary" onClick={() => setBotsOpen(true)}>
              Open Panel
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {botStrategies.map((bot) => (
              <div key={bot.id} className="rounded border border-border-primary bg-bg-tertiary px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>{bot.name}</span>
                  <span className={`mono ${bot.status === "RUNNING" ? "text-accent-green" : "text-accent-yellow"}`}>{bot.status}</span>
                </div>
                <div className="mt-1 text-text-secondary">{bot.strategy}</div>
                <div className="mt-2 flex items-center justify-between mono">
                  <span>{bot.uptime}</span>
                  <span>{bot.winRate.toFixed(1)}%</span>
                  <span className={pnlClass(bot.pnlSol)}>{bot.pnlSol >= 0 ? "+" : ""}{bot.pnlSol.toFixed(2)} SOL</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel p-3">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-text-secondary">Bot Console</h2>
        <ConsoleLog logs={state.logs} />
      </section>

      <footer className="panel flex items-center justify-between px-3 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <Network size={12} />
          Solana RPC (mock)
        </span>
        <span className="mono">Latency {state.rpcLatency}ms</span>
        <span className="mono">Block #{state.blockHeight.toLocaleString()}</span>
        <span className="mono">{state.tps} TPS</span>
        <span className={`inline-flex items-center gap-1 ${feedStatusClass(tokenFeedStatus.connection)}`}>
          <Activity size={12} />
          Feed {feedStatusLabelMap[tokenFeedStatus.connection]} / {tokenFeedStatus.tokenCount} tokens
        </span>
        <span className="inline-flex items-center gap-1">
          {state.totalPnlSol >= 0 ? <TrendingUp size={12} className="text-accent-green" /> : <TrendingDown size={12} className="text-accent-red" />}
          {themeLabelMap[preview.themePreset]}
        </span>
      </footer>

      <BotsModal
        open={botsOpen}
        onClose={() => setBotsOpen(false)}
        strategies={botStrategies}
        selectedBotId={selectedBotId}
        activeTab={activeBotTab}
        onSelectBot={selectBot}
        onSetActiveTab={setActiveBotTab}
        onToggleBotStatus={toggleBotStatus}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
