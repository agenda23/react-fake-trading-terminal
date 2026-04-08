# モックデータ設計書 — NovaPlex Core — Automated Trading Terminal

## 1. データ生成戦略

### 1.1 基本方針

価格・損益・トレード・ログはクライアントサイドの **擬似乱数エンジン** でリアルタイムに生成する。
トークン名のみ外部ソース (PumpPortal) を利用し、失敗時はローカル静的リストにフォールバックする。

### 1.2 リアリティ確保の原則

1. **統計的整合性**: 勝率・損益比・ドローダウンが矛盾しないよう連動して計算
2. **時系列の一貫性**: 価格 → ローソク足 → トレード → PnL がすべて同一の価格系列から導出
3. **ノイズの重畳**: 規則的すぎるパターンを避け、ランダムなバラつきを持たせる
4. **相関性**: トークン間の価格に弱い相関を持たせ (SOL の変動が他トークンに伝播)、市場全体の動きをシミュレート
5. **初期状態の妥当性**: 設定画面で指定した初期PnLが過度に非現実的にならないよう制約を設ける

---

## 2. 価格データ生成

### 2.1 Geometric Brownian Motion (GBM)

各トークンの価格 \( S_t \) は以下の離散 GBM モデルで更新:

```
S(t+1) = S(t) × exp((μ - σ²/2)Δt + σ × √Δt × Z)

Z ~ N(0, 1)   標準正規分布
μ             ドリフト率 (期待リターン)
σ             ボラティリティ
Δt            時間ステップ (秒単位で正規化)
```

### 2.2 トークン別パラメータ

| トークン | 初期価格 (対SOL) | μ (年率) | σ (年率) | カテゴリ |
|---------|-----------------|----------|----------|---------|
| SOL/USDC | 148.00 | 0.30 | 0.65 | Base |
| RAY/SOL | 0.0234 | 0.20 | 0.80 | DEX |
| JUP/SOL | 0.0089 | 0.25 | 0.75 | Aggregator |
| BONK/SOL | 0.0000012 | 0.10 | 1.50 | Meme |
| WIF/SOL | 0.0156 | 0.15 | 1.20 | Meme |
| JTO/SOL | 0.0198 | 0.20 | 0.70 | LSD |
| PYTH/SOL | 0.0032 | 0.18 | 0.60 | Oracle |
| ORCA/SOL | 0.0045 | 0.15 | 0.75 | DEX |
| MNDE/SOL | 0.0008 | 0.12 | 0.85 | Staking |
| TENSOR/SOL | 0.0067 | 0.22 | 0.90 | NFT |

### 2.3 市場相関シミュレーション

```typescript
function generateCorrelatedPriceUpdate(
  tokens: TokenPrice[],
  marketFactor: number    // -1 〜 +1 の市場全体方向
): PriceUpdate[] {
  const marketWeight = 0.3;
  const individualWeight = 0.7;

  return tokens.map(token => {
    const individual = rng.nextGaussian(0, token.volatility);
    const correlated = marketWeight * marketFactor + individualWeight * individual;
    return {
      symbol: token.symbol,
      newPrice: token.price * Math.exp(correlated * scaleFactor),
    };
  });
}
```

- **市場要因**: 5 分ごとに `marketFactor` を再生成 (-0.5 〜 +0.5)
- **個別要因**: 各トークン固有のランダムウォーク
- 配分: 市場 30% / 個別 70%

### 2.4 価格更新頻度

- **ティック間隔**: 1,000ms
- **変動幅**: 1 ティックあたり ±0.01% 〜 ±0.5% (σ に依存)
- **スパイク**: 0.5% の確率で ±1% 〜 ±3% の急変動

---

## 2.5 トークン名取得 (PumpPortal + Fallback)

### 2.5.1 取得元

- WebSocket: `wss://pumpportal.fun/api/data`
- メソッド: `subscribeNewToken`
- 目的: `name`, `symbol`, `mint` のみ取得

### 2.5.2 正規化ルール

```typescript
function normalizeTokenEvent(event: PumpPortalEvent): TokenCatalogItem | null {
  const mint = event.mint?.trim();
  const symbol = (event.symbol ?? event.metadata?.symbol ?? '').trim();
  const name = (event.name ?? event.metadata?.name ?? '').trim();

  if (!mint || !symbol || !name) return null;
  if (symbol.length > 16 || name.length > 40) return null;

  return {
    mint,
    symbol,
    name,
    source: 'pumpportal',
    discoveredAt: new Date(),
  };
}
```

### 2.5.3 フォールバック戦略

- 接続タイムアウト (例: 5 秒) で fallback 有効化
- fallback は既存の Solana トークン名セットを使用
- 背景で再接続を継続し、成功時に `source='pumpportal'` データへ差し替え
- UI には `source` を表示しない (見た目の一貫性を優先)

### 2.5.4 データ品質フィルタ

- 同一 `mint` は最新 1 件のみ保持
- 記号・制御文字を含む `name/symbol` は除外
- 1 分間あたりの追加件数を上限化 (例: 30 件) して UI ノイズを抑制

---

## 3. ローソク足データ生成

### 3.1 初期ヒストリカルデータ

画面起動時に **過去 150 本分** のローソク足を事前生成する。

```typescript
function generateHistoricalCandles(
  pair: string,
  timeframe: Timeframe,
  count: number,
  endPrice: number
): Candle[] {
  // endPrice から逆算して過去データを生成
  // GBM のパスを逆方向にシミュレーション
  const candles: Candle[] = [];
  let price = endPrice;

  for (let i = count; i > 0; i--) {
    const open = price;
    const volatility = getVolatility(pair);
    const close = open * (1 + rng.nextGaussian(0, volatility * 0.01));
    const high = Math.max(open, close) * (1 + rng.next() * volatility * 0.005);
    const low = Math.min(open, close) * (1 - rng.next() * volatility * 0.005);
    const volume = rng.nextRange(100, 10000);

    candles.unshift({ time: getTimeForIndex(i), open, high, low, close, volume });
    price = open;  // 逆方向に進む
  }

  return candles;
}
```

### 3.2 リアルタイム更新

```
タイムフレーム別の更新ロジック:
  1m  → 毎秒 close を更新、60秒で新規ローソク足確定
  5m  → 毎秒 close を更新、300秒で確定
  15m → 毎秒 close を更新、900秒で確定
  1H  → 毎秒 close を更新、3600秒で確定
  ...
```

ローソク足の更新:
1. `close` = 最新価格
2. `high` = max(既存 high, 最新価格)
3. `low` = min(既存 low, 最新価格)
4. `volume` += ランダム増分

---

## 4. トレード生成エンジン

### 4.1 トレード生成アルゴリズム

```
10〜20秒ごとにトレード生成判定:
  1. 生成確率: 30〜50% (トレード頻度の制御)
  2. トレード生成決定時:
     a. 対象トークンをランダム選択 (アクティブウォッチリストから)
     b. Side を決定 (BUY: 60%, SELL: 40%)
     c. サイズ決定 (0.3〜3.0 SOL)
     d. 勝敗判定 (Win: 65%, Loss: 35%)
     e. 損益率決定 (勝ち: +2.5%〜+8%, 負け: -1.5%〜-5%)
     f. 保有時間決定 (3〜30分)
     g. Trade オブジェクト生成
```

### 4.2 勝率制御メカニズム

勝率を目標レンジ (60〜70%) に維持するための **適応的制御**:

```typescript
function shouldWin(currentMetrics: PerformanceMetrics): boolean {
  const targetWinRate = 0.65;
  const currentWinRate = currentMetrics.winRate;
  const totalTrades = currentMetrics.totalTrades;

  if (totalTrades < 10) {
    // 初期は高めの勝率で開始
    return rng.nextBool(0.75);
  }

  // 現在の勝率が目標より低ければ勝ちやすく、高ければ負けやすく
  const adjustment = (targetWinRate - currentWinRate) * 0.5;
  const winProbability = Math.max(0.4, Math.min(0.85, targetWinRate + adjustment));

  return rng.nextBool(winProbability);
}
```

### 4.3 損益分布

**勝ちトレードの損益:**
```
分布: 正規分布 N(μ=4.5%, σ=1.5%)
下限: +1.5%
上限: +12.0%
最頻値: +3.5% 〜 +5.5%
```

**負けトレードの損益:**
```
分布: 正規分布 N(μ=-2.8%, σ=1.0%)
下限: -8.0%
上限: -0.5%
最頻値: -2.0% 〜 -3.5%
```

### 4.4 トレードサイズ分布

```
Small (0.3〜0.8 SOL):  40%
Medium (0.8〜1.5 SOL): 35%
Large (1.5〜3.0 SOL):  25%
```

### 4.5 戦略割り当て

| 戦略 | 割合 | 特徴 |
|------|------|------|
| Momentum Scalper | 30% | 短期、高頻度、小利確 |
| Mean Reversion | 25% | RSI ベース、逆張り |
| Breakout Hunter | 20% | ブレイクアウト検知、大きい利確 |
| Volume Spike | 15% | 出来高急増検知 |
| Arbitrage Bot | 10% | DEX 間価格差利用 |

---

## 5. ポジション管理

### 5.1 同時保有ルール

- 最大同時ポジション: **5 件**
- 同一トークンの重複ポジション: 不可
- 新規ポジション生成間隔: 最低 **10 秒**

### 5.2 ポジションライフサイクル

```
[ポジション生成]
  ↓
[保有中] ← 価格リアルタイム更新
  ↓
[クローズ条件判定 (毎5秒)]
  ├── TP 到達 → 利確クローズ (PROFIT ログ)
  ├── SL 到達 → 損切りクローズ (LOSS ログ)
  └── 時間経過 → タイムアウトクローズ
      (保有時間 = 事前決定の duration ± 20%)
```

### 5.3 TP/SL 設定

| 項目 | 勝ちトレード | 負けトレード |
|------|------------|------------|
| TP 距離 | エントリーから +3〜+10% | エントリーから +5〜+8% (到達しない) |
| SL 距離 | エントリーから -3〜-5% (到達しない) | エントリーから -1.5〜-5% |

TP/SL はあらかじめ勝敗が決定しているため:
- **勝ちトレード**: TP に到達するよう価格パスを誘導 (方向バイアス)
- **負けトレード**: SL に到達するよう価格パスを誘導

---

## 6. オーダーブック生成

### 6.1 生成アルゴリズム

```typescript
function generateOrderbook(midPrice: number, spread: number): OrderBook {
  const asks: OrderBookEntry[] = [];
  const bids: OrderBookEntry[] = [];

  for (let i = 0; i < 15; i++) {
    // Ask 側 (売り)
    const askPrice = midPrice + spread / 2 + i * spread * 0.2;
    const askSize = generateOrderSize(i);  // 遠いほどサイズ大
    asks.push({ price: askPrice, size: askSize, total: 0 });

    // Bid 側 (買い)
    const bidPrice = midPrice - spread / 2 - i * spread * 0.2;
    const bidSize = generateOrderSize(i);
    bids.push({ price: bidPrice, size: bidSize, total: 0 });
  }

  // 累積計算
  calculateTotals(asks);
  calculateTotals(bids);

  return { asks, bids, spread, spreadPercent: (spread / midPrice) * 100 };
}
```

### 6.2 オーダーサイズ分布

- ベスト Bid/Ask 付近: **小〜中サイズ** (5〜50 SOL)
- 中間: **中サイズ** (10〜100 SOL)
- 遠い価格帯: **大サイズ** (50〜500 SOL) — 壁を模倣
- 稀に (5%): **異常に大きい注文** (1000+ SOL) — 鯨のウォール

### 6.3 更新ロジック

- 1.5 秒ごとに各行のサイズを ±5〜15% 変動
- 0.3 秒ごとにベスト Bid/Ask の価格を微小更新
- 大口注文は 10〜30 秒で出現/消失

---

## 7. ログメッセージ生成

### 7.1 テンプレートシステム

```typescript
const LOG_TEMPLATES: Record<LogLevel, string[]> = {
  SIGNAL: [
    '{pair} — Bullish divergence detected on {timeframe}',
    '{pair} — RSI oversold bounce signal',
    '{pair} — MACD crossover detected',
    '{pair} — Volume breakout pattern forming',
    '{pair} — Support level bounce at {price}',
    '{pair} — EMA(9) crossed above EMA(21)',
    '{pair} — Accumulation pattern detected',
    '{pair} — Bollinger Band squeeze breakout',
  ],
  ENTRY: [
    '{pair} — BUY {size} SOL @ {price}',
    '{pair} — SELL {size} SOL @ {price}',
    '{pair} — Opening LONG position {size} SOL',
    '{pair} — Opening SHORT position {size} SOL',
  ],
  EXIT: [
    '{pair} — SELL {size} SOL @ {price} ({pnl}%)',
    '{pair} — Closing position @ {price}',
    '{pair} — Position closed — {pnl}% ({pnlSol} SOL)',
  ],
  PROFIT: [
    '{pair} — Closed +{pnl}% (+{pnlSol} SOL)',
    '{pair} — Take profit hit! +{pnl}%',
    '{pair} — Target reached: +{pnlSol} SOL profit',
  ],
  LOSS: [
    '{pair} — Stop loss triggered ({pnl}%)',
    '{pair} — Closed {pnl}% ({pnlSol} SOL)',
    '{pair} — Position stopped out at {price}',
  ],
  SCAN: [
    'Scanning {count} pairs on Raydium...',
    'Analyzing volume patterns across {count} tokens...',
    'Checking arbitrage opportunities on Jupiter...',
    'Monitoring new token listings on Raydium V4...',
    'Scanning mempool for pending transactions...',
  ],
  INFO: [
    'Volume spike detected: {pair} +{percent}%',
    'New liquidity pool added: {pair}',
    'Whale alert: {amount} SOL moved to {pair}',
    'Market sentiment: {sentiment}',
    'Gas price optimal — executing batch orders',
    'Portfolio rebalance check completed',
  ],
  HEALTH: [
    'RPC latency: {latency}ms | Block: #{block}',
    'WebSocket connection stable — {uptime} uptime',
    'Memory usage: {memory}MB | CPU: {cpu}%',
    'Rate limit status: {remaining}/{total} requests',
  ],
  CONFIG: [
    'TP: {tp} (+{tpPercent}%) | SL: {sl} (-{slPercent}%)',
    'Risk per trade: {risk}% | Max positions: {maxPos}',
    'Slippage tolerance: {slippage}%',
    'Strategy params updated for {strategy}',
  ],
  ERROR: [
    'RPC timeout — retrying with backup node...',
    'Transaction simulation failed — adjusting gas...',
    'Rate limited by RPC — cooling down 5s',
    'Insufficient liquidity for {pair} — skipping',
  ],
};
```

### 7.2 ログ生成頻度

| ログレベル | 平均間隔 | 確率/分 |
|-----------|---------|---------|
| SIGNAL | 15〜30秒 | 2〜4回 |
| ENTRY | トレード発生時 | トレード連動 |
| EXIT | トレード終了時 | トレード連動 |
| PROFIT | 勝ちトレード時 | トレード連動 |
| LOSS | 負けトレード時 | トレード連動 |
| SCAN | 30〜60秒 | 1〜2回 |
| INFO | 20〜40秒 | 2〜3回 |
| HEALTH | 30〜60秒 | 1〜2回 |
| CONFIG | トレード発生時 | トレード連動 |
| ERROR | 120〜300秒 | 0〜0.5回 |

### 7.3 ログの時系列ルール

トレード発生時のログは必ず以下の順序で出力:

```
1. [SCAN]    走査中メッセージ (先行して 5〜10 秒前)
2. [SIGNAL]  シグナル検知メッセージ
3. [ENTRY]   エントリーメッセージ
4. [CONFIG]  TP/SL 設定メッセージ
   ... (保有中: HEALTH, INFO が挟まる) ...
5. [EXIT]    エグジットメッセージ
6. [PROFIT] or [LOSS]  結果メッセージ
```

---

## 8. ネットワークステータスデータ

### 8.1 RPC レイテンシ

```
通常: 25〜60ms (正規分布 N(42, 10))
スパイク (5%確率): 80〜200ms
表示更新: 30 秒ごと
```

### 8.2 ブロック高さ

```
初期値: 284,500,000 + ランダムオフセット
増加: 0.4秒ごとに +1 (Solana の平均ブロックタイム)
表示更新: 1 秒ごと
```

### 8.3 TPS

```
通常: 2,500〜4,500 TPS
表示: 3,000〜4,000 の範囲でランダム変動
更新: 30 秒ごと
```

---

## 9. 初期状態データ

### 9.1 起動時の即時表示データ

画面表示までの「空白」を避けるため、起動時に以下を事前生成:

| データ | 件数 | 生成方法 |
|--------|------|---------|
| ローソク足 (履歴) | 150 本 | GBM 逆算 |
| トレード履歴 | 20 件 | バルク生成 (過去 2 時間分) |
| アクティブポジション | 2〜3 件 | ランダム生成 |
| ログ | 30 行 | テンプレートからバルク生成 |
| ウォッチリスト | 10 トークン | マスタデータから |

### 9.2 初期メトリクス

```
Balance:      62.38 SOL  (初期 50 SOL + 累積利益)
Total PnL:    +12.38 SOL (+24.8%)
Today PnL:    +1.84 SOL (+2.9%)
Win Rate:     65.2%
Total Trades: 847
Sharpe Ratio: 1.84
Max Drawdown: -8.3%
Profit Factor: 2.13
Avg Hold:     14 min
Best Trade:   +12.4%
Worst Trade:  -4.7%
```

これらの値は起動後のトレード生成により **漸進的に変化** していく。

### 9.3 設定由来の初期PnL反映

`initialTotalPnlSol` (設定値) を起動時に反映する。

```typescript
function applyInitialPnlFromSettings(
  initialBalance: number,      // 50 SOL
  initialTotalPnlSol: number   // -5.00 ~ +30.00
) {
  const clampedPnl = clamp(initialTotalPnlSol, -5, 30);
  const balance = initialBalance + clampedPnl;
  const pnlPercent = (clampedPnl / initialBalance) * 100;

  return { balance, totalPnlSol: clampedPnl, totalPnlPercent: pnlPercent };
}
```

**制約:**
- `initialTotalPnlSol` は `-5.00` 〜 `+30.00` SOL にクランプ
- 推奨レンジ `+5.00` 〜 `+18.00` は UI で案内のみ (強制しない)
- `todayPnl` は `totalPnl` と矛盾しない範囲で自動再計算
- 勝率メトリクスは既存履歴との整合性を優先し、設定変更で直接改変しない

---

## 10. データ整合性チェック

### 10.1 不変条件

以下の条件が常に満たされることを保証:

1. `balance = initialBalance + Σ(trade.pnlSol)` — 残高の整合性
2. `winRate = winTrades / totalTrades` — 勝率の整合性
3. `Σ(position.size) ≤ balance * 0.5` — ポジションが残高の 50% を超えない
4. `position.currentPrice` は直近の価格ティックと一致
5. トレード履歴のタイムスタンプは厳密に降順
6. ログのタイムスタンプは厳密に降順
7. オーダーブックの Ask は常に Bid より高い
