# 技術設計書 — NovaPlex Core — Automated Trading Terminal

## 実装進捗メモ (2026-04-08)

Phase 1-2 として以下を先行実装:

- プロジェクト初期化: React + TypeScript + Vite + Tailwind
- `src/App.tsx` で UI 仕様の主要パネル骨格を実装
- `src/data/mock.ts` と `src/hooks/useSimulation.ts` でリアルタイム風更新を実装
  - 更新対象: watchlist / orderbook / trades / positions / logs / pnl / latency
- `src/components/chart/TradingChart.tsx` で `lightweight-charts` を使ったローソク足 / 出来高 / MA を実装
- `src/utils/chart.ts` で timeframes 集約処理 (`1m` ベースから `5m/15m/1H/4H/1D` を生成) を実装
- recent trades からチャートマーカーを生成し、chart 上へ表示
- Entry / TP / SL のシグナル表示をチャート下部へ追加
- `src/services/pumpPortalClient.ts` で PumpPortal WS 接続と `subscribeNewToken` 購読を実装
- `src/services/tokenSourceService.ts` で timeout fallback / dedupe / reconnect / per-minute cap を実装
- `src/hooks/useTokenCatalog.ts` で UI 用の token catalog を購読し、watchlist 表示名へ反映
- token feed status (`connecting/live/fallback/reconnecting`) を UI へ表示
- `src/stores/useSettingsStore.ts` で設定の preview / save / localStorage 永続化を実装
- `src/stores/useBotStore.ts` を追加し、bot strategy 一覧 / selected bot / panel tab / pause-resume を Zustand 管理へ移行
- テーマカラーとアニメーション速度を CSS Variables 経由で即時プレビュー
- `TradeItem.timestamp` を追加し、チャートマーカーは最も近い candle 時刻へ寄せて描画
- `TradeItem.referencePrice` を追加し、マーカー text に約定価格を表示
- `Bot Control Center` モーダルと Bot strategy summary パネルを追加
- pause/resume に応じて dashboard と modal の bot status 表示が同時更新
- settings に token feed 上限制御を追加 (`tokenFeedMaxPerMinute`, `tokenCatalogLimit`)
- `TokenSourceService` を上限設定に追従させ、runtime で反映
- `src/stores/useTradingStore.ts` を追加し、simulation state (`DashboardState`) を Zustand 管理へ移行
- `useSimulation` は timer orchestration のみ担当し、state 本体は store 参照へ変更
- chart marker に加えて、recent trades の `referencePrice` から price line を生成して価格軸へ表示
- `useTradingStore` action を機能別に分割 (`updatePortfolio`, `updateWatchlist`, `updateOrderbook`, `updateTrades`, `updatePositions`, `updateLogs`, `updateChart`, `updateNetwork`)

Phase UI-BugFix (2026-04-08):

- Watchlist 伸びバグ修正
  - `aside` に `h-full flex flex-col overflow-hidden` を付与し高さをグリッドセルに固定
  - watchlist リストに `flex-1 min-h-0 overflow-y-auto` を設定してスクロール可能化
  - watchlist アイテムの `key` を `item.pair` に変更して PumpPortal token 名更新時の DOM 再作成を抑制
- ヘッダー 4 カラム化 (`grid-cols-[160px_200px_240px_1fr]`) + 高さを 48px → 56px に拡張
- `types.ts` に `PerformanceMetrics` インターフェースを追加
- `DashboardState` に `metrics: PerformanceMetrics`, `blockHeight: number`, `tps: number` を追加
- `data/mock.ts` の `createInitialState` / `tickState` に上記フィールドの初期値・更新ロジックを追加
- サイドバーに `MetricsPanel` コンポーネントを追加 (Sharpe / MaxDD / Trades / Wins / PF / AvgHold / Best / Worst)
- Bot Console を `ConsoleLog` コンポーネント化し `overflow-y-auto` + `useRef` による末尾自動スクロールを実装
- Active Positions の行に未実現損益 SOL 金額カラムを追加
- フッターに `blockHeight` / `tps` を表示

未実装 (次フェーズ):

- PumpPortal token とトレード対象ペアの動的連動
- Bot 状態の永続化
- コンポーネント分割 (App.tsx 肥大化の解消)

## 1. プロジェクト構成

### 1.1 ディレクトリ構造

```
src/
├── main.tsx                          # エントリーポイント
├── App.tsx                           # ルートコンポーネント + レイアウト
├── index.css                         # グローバルスタイル + CSS Variables
│
├── components/
│   ├── layout/
│   │   ├── TopBar.tsx                # ヘッダーバー
│   │   ├── Sidebar.tsx               # 左サイドバー (ウォッチリスト + メトリクス)
│   │   ├── MainLayout.tsx            # グリッドレイアウトコンテナ
│   │   ├── BottomBar.tsx             # ステータスバー
│   │   └── SettingsModal.tsx         # 設定モーダル
│   │
│   ├── chart/
│   │   ├── TradingChart.tsx          # Lightweight Charts ラッパー
│   │   ├── ChartToolbar.tsx          # タイムフレーム切替
│   │   ├── BotMarkers.tsx            # エントリー/エグジットマーカー
│   │   └── ChartSignals.tsx          # Bot シグナル表示
│   │
│   ├── orderbook/
│   │   ├── OrderBook.tsx             # オーダーブックパネル
│   │   ├── OrderBookRow.tsx          # 個別行
│   │   └── SpreadIndicator.tsx       # スプレッド表示
│   │
│   ├── trades/
│   │   ├── RecentTrades.tsx          # 直近トレードリスト
│   │   ├── TradeRow.tsx              # トレード行
│   │   └── ActivePositions.tsx       # アクティブポジションテーブル
│   │
│   ├── bot/
│   │   ├── BotConsole.tsx            # ログコンソール
│   │   ├── LogEntry.tsx              # ログ行
│   │   ├── BotStatusBadge.tsx        # Bot ステータスバッジ
│   │   └── BotDetailModal.tsx        # Bot 詳細モーダル
│   │
│   ├── metrics/
│   │   ├── PerformanceMetrics.tsx    # パフォーマンスKPI
│   │   ├── WinRateRing.tsx           # 円形プログレス (勝率)
│   │   └── PnLDisplay.tsx            # PnL 表示 (アニメーション付き)
│   │
│   └── shared/
│       ├── AnimatedNumber.tsx        # 数値カウントアニメーション
│       ├── PriceFlash.tsx            # 価格変動フラッシュ
│       ├── PulsingDot.tsx            # パルスドット
│       ├── Badge.tsx                 # ラベルバッジ
│       ├── Panel.tsx                 # パネルラッパー
│       └── Tooltip.tsx               # ツールチップ
│
├── stores/
│   ├── useTradingStore.ts            # メイン状態管理 (Zustand)
│   ├── useChartStore.ts              # チャート状態
│   ├── useBotStore.ts                # Bot ステータス状態
│   └── useSettingsStore.ts           # UI設定状態
│
├── generators/
│   ├── priceGenerator.ts             # 価格データ生成エンジン
│   ├── tradeGenerator.ts             # トレード自動生成エンジン
│   ├── orderbookGenerator.ts         # オーダーブック生成
│   ├── logGenerator.ts               # ログメッセージ生成
│   └── candlestickGenerator.ts       # ローソク足データ生成
│
├── services/
│   ├── pumpPortalClient.ts           # PumpPortal WS クライアント
│   └── tokenSourceService.ts         # トークン名ソース統合 (WS + fallback)
│
├── engine/
│   ├── SimulationEngine.ts           # シミュレーション統合エンジン
│   ├── TimerManager.ts               # タイマー管理
│   └── SeededRandom.ts               # シード付き擬似乱数
│
├── data/
│   ├── tokens.ts                     # トークンマスタデータ
│   ├── strategies.ts                 # Bot 戦略定義
│   └── logTemplates.ts               # ログテンプレート
│
├── types/
│   ├── trading.ts                    # トレーディング型定義
│   ├── chart.ts                      # チャート型定義
│   ├── bot.ts                        # Bot 型定義
│   └── common.ts                     # 共通型定義
│
├── hooks/
│   ├── useSimulation.ts              # シミュレーション制御 Hook
│   ├── useAnimatedValue.ts           # 数値アニメーション Hook
│   ├── useInterval.ts                # インターバル Hook
│   └── useAutoScroll.ts              # 自動スクロール Hook
│
└── utils/
    ├── format.ts                     # 数値/日付フォーマット
    ├── color.ts                      # PnL カラー判定
    └── math.ts                       # 数学ユーティリティ
```

### 1.2 依存関係

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "lightweight-charts": "^4.2.0",
    "zustand": "^5.0.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.460.0",
    "date-fns": "^4.1.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

---

## 2. コンポーネント設計

### 2.1 コンポーネント階層

```
App
├── MainLayout
│   ├── TopBar
│   │   ├── Logo
│   │   ├── PnLDisplay (AnimatedNumber)
│   │   ├── WinRateRing
│   │   └── BotStatusBadge (PulsingDot)
│   │
│   ├── Sidebar
│   │   ├── WatchlistItem[] (PriceFlash)
│   │   └── PerformanceMetrics
│   │
│   ├── TradingChart
│   │   ├── ChartToolbar
│   │   ├── LightweightChart (外部)
│   │   ├── BotMarkers
│   │   └── ChartSignals
│   │
│   ├── RightPanel
│   │   ├── OrderBook
│   │   │   └── OrderBookRow[]
│   │   └── RecentTrades
│   │       └── TradeRow[]
│   │
│   ├── ActivePositions
│   │   └── PositionRow[] (PriceFlash, AnimatedNumber)
│   │
│   ├── BotConsole
│   │   └── LogEntry[]
│   │
│   └── BottomBar
│       └── PulsingDot
```

### 2.2 状態管理 (Zustand Store)

#### useTradingStore

```typescript
interface TradingState {
  // ポートフォリオ
  balance: number;              // 現在 SOL 残高
  initialBalance: number;       // 初期残高
  totalPnl: number;             // 全期間 PnL
  todayPnl: number;             // 本日 PnL

  // ウォッチリスト
  watchlist: TokenPrice[];      // 監視トークン一覧
  tokenCatalog: TokenCatalogItem[]; // 取得済みトークン名カタログ
  selectedPair: string;         // 選択中ペア

  // トレード
  trades: Trade[];              // トレード履歴 (最大 100 件保持)
  positions: Position[];        // アクティブポジション (最大 5 件)

  // オーダーブック
  orderbook: OrderBook;         // 現在のオーダーブック

  // メトリクス
  metrics: PerformanceMetrics;  // 統計情報

  // アクション
  addTrade: (trade: Trade) => void;
  updatePrices: (prices: PriceUpdate[]) => void;
  upsertTokenCatalog: (tokens: TokenCatalogItem[]) => void;
  openPosition: (position: Position) => void;
  closePosition: (id: string, pnl: number) => void;
  updateOrderbook: (orderbook: OrderBook) => void;
  updateMetrics: () => void;
  resetSimulationFromSettings: () => void;
}
```

#### useSettingsStore

```typescript
type ThemePreset = 'emerald' | 'blue' | 'violet' | 'amber';
type AnimationSpeed = 0.75 | 1 | 1.25;

interface SettingsState {
  initialTotalPnlSol: number;      // -5.00 ~ +30.00
  animationSpeed: AnimationSpeed;  // UI再生倍率
  themePreset: ThemePreset;        // アクセント配色
  hasHydrated: boolean;

  setInitialTotalPnlSol: (value: number) => void;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
  setThemePreset: (theme: ThemePreset) => void;
  saveSettings: () => void;        // localStorage 永続化
  loadSettings: () => void;        // 起動時復元
  resetSettings: () => void;       // 既定値へ戻す
}
```

### 2.3 外部トークン名ソース (PumpPortal)

用途を限定して PumpPortal を利用する。価格・トレード・PnL の生成ロジックには一切使わない。

```typescript
interface TokenCatalogItem {
  mint: string;
  symbol: string;
  name: string;
  source: 'pumpportal' | 'fallback';
  discoveredAt: Date;
}

interface PumpPortalEvent {
  mint?: string;
  symbol?: string;
  name?: string;
  metadata?: {
    symbol?: string;
    name?: string;
  };
}
```

```typescript
class PumpPortalClient {
  connect(): void;          // wss://pumpportal.fun/api/data
  subscribeNewToken(): void; // { method: 'subscribeNewToken' }
  onToken(cb: (item: TokenCatalogItem) => void): void;
  disconnect(): void;
}
```

`TokenSourceService` で以下を実施:
- WS 受信イベントから `name/symbol/mint` を抽出
- 欠損・重複を除外
- `maxCatalogSize` (例: 200) を超えたら古い順に破棄
- 接続失敗時は fallback リストを返却

#### useBotStore

```typescript
interface BotState {
  // Bot ステータス
  bots: BotInstance[];          // 稼働中 Bot 一覧
  logs: LogEntry[];             // ログ (最大 200 件)
  isRunning: boolean;           // 全体稼働フラグ

  // ネットワーク
  rpcLatency: number;           // RPC レイテンシ
  blockHeight: number;          // ブロック高さ
  tps: number;                  // TPS

  // アクション
  addLog: (entry: LogEntry) => void;
  updateNetworkStatus: () => void;
}
```

#### useChartStore

```typescript
interface ChartState {
  timeframe: Timeframe;         // 選択中タイムフレーム
  candles: Candle[];            // ローソク足データ
  markers: ChartMarker[];       // Bot マーカー
  signals: BotSignal[];         // アクティブシグナル

  setTimeframe: (tf: Timeframe) => void;
  addCandle: (candle: Candle) => void;
  updateLastCandle: (update: Partial<Candle>) => void;
  addMarker: (marker: ChartMarker) => void;
}
```

---

## 3. シミュレーションエンジン設計

### 3.1 全体アーキテクチャ

```
SimulationEngine (統合)
  ├── TimerManager (タイマー制御)
  │   ├── Tick: 1000ms  → 価格更新、オーダーブック更新
  │   ├── Tick: 3000ms  → ログ追加
  │   ├── Tick: 5000ms  → ポジション評価
  │   ├── Tick: 15000ms → 新規トレード検討
  │   └── Tick: 30000ms → ネットワークステータス更新
  │
  ├── PriceGenerator
  │   └── Geometric Brownian Motion ベースの価格生成
  │
  ├── TradeGenerator
  │   └── 勝率パラメータに基づくトレード生成
  │
  ├── OrderbookGenerator
  │   └── 価格ベースのオーダーブック生成
  │
  ├── CandlestickGenerator
  │   └── 価格履歴からローソク足を集約
  │
  └── LogGenerator
      └── テンプレートベースのログ生成
```

### 3.2 タイマー管理

```typescript
class TimerManager {
  private timers: Map<string, NodeJS.Timer>;

  register(id: string, callback: () => void, intervalMs: number): void;
  unregister(id: string): void;
  start(): void;
  stop(): void;
  dispose(): void;
}
```

`animationSpeed` は UI トランジションの duration にのみ反映し、価格生成や勝率ロジックには影響させない。

| タイマーID | 間隔 | 処理内容 |
|-----------|------|---------|
| price-tick | 1,000ms | 全トークン価格の微小変動 |
| orderbook-tick | 1,500ms | オーダーブック数値の更新 |
| candle-tick | 2,000ms | 現在のローソク足の更新 |
| log-tick | 2,000〜8,000ms (ランダム) | ログメッセージの追加 |
| trade-eval | 5,000ms | アクティブポジションの損益評価 |
| new-trade | 10,000〜20,000ms (ランダム) | 新規トレードの自動生成 |
| candle-close | timeframe依存 | ローソク足の確定 + 新規追加 |
| network-tick | 30,000ms | レイテンシ/ブロック高さの更新 |

### 3.3 SeededRandom (再現性)

```typescript
class SeededRandom {
  private seed: number;

  constructor(seed?: number);
  next(): number;                    // 0〜1 の一様乱数
  nextRange(min: number, max: number): number;
  nextGaussian(mean: number, std: number): number;
  nextBool(probability: number): boolean;
  pick<T>(array: T[]): T;
}
```

初回起動時のシード: `Date.now()` ベース。
ブラウザリロード時に同じ画面にならないようランダム性を保つ。

---

## 4. 型定義

### 4.1 trading.ts

```typescript
type Side = 'BUY' | 'SELL';
type TradeResult = 'WIN' | 'LOSS';
type PositionSide = 'LONG' | 'SHORT';

interface TokenInfo {
  symbol: string;
  name: string;
  pair: string;           // e.g. "JUP/SOL"
  decimals: number;
  category: 'defi' | 'meme' | 'infra' | 'nft';
}

interface TokenPrice {
  symbol: string;
  price: number;
  change24h: number;      // パーセンテージ
  isActive: boolean;      // Bot がトレード中か
}

interface Trade {
  id: string;
  timestamp: Date;
  pair: string;
  side: Side;
  size: number;           // SOL 単位
  entryPrice: number;
  exitPrice: number;
  pnlPercent: number;
  pnlSol: number;
  result: TradeResult;
  strategy: string;
  duration: number;       // 秒
}

interface Position {
  id: string;
  pair: string;
  side: PositionSide;
  entryPrice: number;
  currentPrice: number;
  size: number;
  pnlPercent: number;
  pnlSol: number;
  openedAt: Date;
  takeProfitPrice: number;
  stopLossPrice: number;
  strategy: string;
}

interface OrderBookEntry {
  price: number;
  size: number;
  total: number;          // 累積
}

interface OrderBook {
  asks: OrderBookEntry[];
  bids: OrderBookEntry[];
  spread: number;
  spreadPercent: number;
}

interface PerformanceMetrics {
  winRate: number;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgHoldTime: number;    // 秒
  bestTrade: number;      // パーセント
  worstTrade: number;     // パーセント
  profitFactor: number;
  avgWin: number;         // パーセント
  avgLoss: number;        // パーセント
}
```

### 4.4 settings.ts

```typescript
interface UserSettings {
  initialTotalPnlSol: number;
  animationSpeed: 0.75 | 1 | 1.25;
  themePreset: 'emerald' | 'blue' | 'violet' | 'amber';
}
```

### 4.2 chart.ts

```typescript
type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D';

interface Candle {
  time: number;           // Unix timestamp (秒)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle';
  text: string;
}

interface BotSignal {
  type: 'entry' | 'takeProfit' | 'stopLoss';
  pair: string;
  price: number;
  timestamp: Date;
}
```

### 4.3 bot.ts

```typescript
type LogLevel =
  | 'SIGNAL' | 'ENTRY' | 'EXIT'
  | 'PROFIT' | 'LOSS'
  | 'SCAN' | 'INFO' | 'HEALTH'
  | 'CONFIG' | 'ERROR';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

interface BotInstance {
  id: string;
  name: string;
  strategy: string;
  status: 'running' | 'paused' | 'stopped';
  uptime: number;         // 秒
  tradesCount: number;
  winRate: number;
  pnl: number;
}

interface BotStrategy {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  avgHoldTime: string;
  riskLevel: 'low' | 'medium' | 'high';
}
```

---

## 5. パフォーマンス最適化

### 5.1 レンダリング最適化

| 対策 | 対象 | 手法 |
|------|------|------|
| メモ化 | 全リストコンポーネント | `React.memo` + 適切な比較関数 |
| 仮想スクロール | ログコンソール | 200 件上限でリサイクル |
| バッチ更新 | 価格更新 | `requestAnimationFrame` でまとめて反映 |
| チャート | TradingView chart | DOM 外の Canvas 描画 |
| CSS アニメーション | フラッシュ/パルス | JS ではなく CSS transition を使用 |

### 5.2 メモリ管理

- トレード履歴: **最大 100 件** (FIFO)
- ログ: **最大 200 件** (FIFO)
- ローソク足: **最大 300 本** (FIFO)
- オーダーブック: 各サイド **15 行** 固定
- 設定キャッシュ: localStorage 1キー (`novaPlex.settings.v1`)

### 5.3 タイマークリーンアップ

- `useEffect` の cleanup で全タイマーを確実に破棄
- ブラウザタブ非表示時 (`visibilitychange`) はタイマー一時停止
- タブ復帰時にスナップショットから状態復元

---

## 6. ビルド・開発環境

### 6.1 Vite 設定

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
});
```

### 6.2 TypeScript 設定

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 6.3 Tailwind CSS 設定

```javascript
// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0b0e11',
          secondary: '#1a1d23',
          tertiary: '#242830',
          elevated: '#2a2e37',
        },
        accent: {
          green: '#0ecb81',
          red: '#f6465d',
          blue: '#1e90ff',
          yellow: '#f0b90b',
          purple: '#a855f7',
        },
        text: {
          primary: '#eaecef',
          secondary: '#848e9c',
          muted: '#5e6673',
        },
        border: {
          primary: '#2b3139',
          hover: '#3c4452',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash-green': 'flashGreen 300ms ease-out',
        'flash-red': 'flashRed 300ms ease-out',
        'slide-in': 'slideIn 400ms ease-out',
        'blink': 'blink 1s step-end infinite',
      },
    },
  },
};
```
