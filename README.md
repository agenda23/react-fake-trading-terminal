# react-fake-trading-terminal

NovaPlex Core - Automated Trading Terminal のモック実装です。

## 開発環境セットアップ

```bash
npm install
npm run dev
```

## 現在の実装範囲

- React + TypeScript + Vite + Tailwind の起動基盤
- ダッシュボード画面の基本レイアウト
  - TopBar / Watchlist / Chart placeholder / OrderBook / RecentTrades / ActivePositions / BotConsole / BottomBar
- 1.2 秒ごとのモック更新シミュレーション
  - 価格、PnL、勝率、オーダーブック、トレード履歴、ログ、レイテンシ
- `lightweight-charts` によるローソク足 / 出来高 / MA(7/25/99) 表示
- タイムフレーム切替 UI の実動化
  - `1m / 5m / 15m / 1H / 4H / 1D`
  - 1分足データを集約して表示
- 直近トレードに基づくチャート売買マーカー表示
- Entry / TP / SL のシグナル表示
- PumpPortal WebSocket (`subscribeNewToken`) によるトークン名取得
- PumpPortal 接続失敗時の fallback トークンカタログ
- 取得したトークン名をウォッチリスト表示へ反映
- PumpPortal 接続状態 / token 件数 / retry 状態の UI 表示
- 設定モーダル
  - 初期表示 PnL
  - アニメーション速度
  - テーマカラー
- localStorage 永続化
- 保存済み設定でのシミュレーション再開
- Bot 戦略サマリー表示
- Bot 管理モーダル
- `useBotStore` による Bot 状態管理
- `useTradingStore` による simulation state 管理
- Pause / Resume 操作の UI 反映
- 選択中 Bot に応じた Overview / Parameters / Backtest パネル切替
- トレード timestamp ベースのチャートマーカー同期
- マーカーに約定価格 (`referencePrice`) を付与して価格情報を表示
- チャート上に約定価格ライン (price line) を描画して価格軸同期を強化
- 設定画面から token feed 上限を調整
  - Max New Tokens / Min
  - Catalog Size Limit
- `useTradingStore` の action を機能別に分割
  - portfolio / watchlist / orderbook / trades / positions / logs / chart / network

- **UI バグ修正 (2026-04-08)**
  - Watchlist サイドバーが縦に伸び続けるバグを修正
    - `aside` に `h-full flex flex-col overflow-hidden` を追加して高さを親グリッドセルに固定
    - watchlist アイテムのコンテナに `flex-1 min-h-0 overflow-y-auto` を設定
    - `key` を `item.pair`（安定した値）に変更してトークン名更新時の不要な DOM 再作成を抑制
  - ヘッダーを 4 カラム構成 (`160px / 200px / 240px / 1fr`) に再設計し、高さを 56px に拡張
    - 残高 / Total PnL / ステータスを横並びに整理して情報が収まるよう修正
- **情報量向上 (2026-04-08)**
  - サイドバーに Performance Metrics パネルを追加
    - Sharpe Ratio / Max Drawdown / Total Trades / Wins / Profit Factor / Avg Hold / Best & Worst Trade
    - `DashboardState.metrics: PerformanceMetrics` を追加し、tick ごとに擬似更新
  - Bot Console を `overflow-y-auto` + 末尾自動スクロール (`ConsoleLog` コンポーネント) に変更
  - Active Positions に未実現損益 SOL 金額を追加表示
    - 計算式: `sizeSol × entryPrice × (pnlPercent / 100)`
  - フッターに Block Height と TPS (mock) を追加表示
    - `DashboardState.blockHeight` / `DashboardState.tps` を追加し、tick ごとに更新

## 次フェーズ予定

- PumpPortal token 情報とトレード対象ペアの動的連動
- Bot 管理操作の永続化 (localStorage)
- コンポーネント分割（App.tsx が肥大化している）