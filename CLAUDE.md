@AGENTS.md
@DeepBookPredictProblemStatement.md

You are implementing "deepfi", a mobile-first trading app for the DeepBook Predict Sui Hackathon using our existing React Native Expo codebase.

CONTEXT FROM HACKATHON:
We are building for the DeepBook Predict track. Requirements:

1. Must integrate deepbook_predict contract on testnet branch `predict-testnet-4-16`
2. Must work end-to-end. Judges will test full flow
3. Must show composability: use DeepBook spot + deepbook_margin + deepbook_predict in single PTB
4. Bonus: vaults, cross-venue arb, social frontends, analytics tooling
5. Tech stack: Sui testnet, dUSDC asset, predict-server.testnet.mystenlabs.com indexer

EXISTING CODEBASE:
We already have:

1. /components/SpotTradingUI - DeepBook CLOB trading view
2. /components/PredictUI - Range selector, expiry chips, SVI chart
3. /components/WalletConnect - Slush wallet + zkLogin email OTP ready
4. /hooks/useSuiClient - @mysten/sui.js setup for testnet
5. /lib/indexer - REST calls to predict-server

YOUR TASK: Implement the missing pieces to ship "Full-Stack Finance"

### 1. CORE PTB: Combo Trade Screen

File: /screens/ComboTrade.tsx

Build ONE screen that executes Spot + Margin + Predict in a single atomic PTB.

UI:

- Asset picker: SUI, BTC
- Leverage slider: 1x to 3x
- Range picker: use existing PredictUI component, default 15m expiry
- Health Factor gauge: show liquidation price from deepbook_margin
- Button: "Execute Full-Stack Trade"

PTB Logic using @mysten/sui.js:

1. If input asset != dUSDC, swap on DeepBook spot: pool::swap_exact_base_for_quote
2. Deposit resulting dUSDC to deepbook_margin as collateral
3. Borrow dUSDC based on leverage slider: margin::borrow
4. Call predict::mint with total dUSDC into selected range/expiry
5. Return all objects to user

Use package IDs from constants:
DEEPBOOK_PKG = "0x..." // from predict-testnet-4-16
MARGIN_PKG = "0x..." // deepbook_margin mainnet
PREDICT_PKG = "0x..." // predict-testnet-4-16

Error handling: If any step fails, entire PTB reverts. Show toast with reason.

### 2. SOCIAL LAYER: Copy-Trading Feed

File: /screens/SocialFeed.tsx + /server/indexer.ts

Backend:

1. Index predict-server.testnet.mystenlabs.com for events: PositionMinted, PositionRedeemed
2. Store in SQLite: {tx_digest, sender, strike_low, strike_high, expiry, size_dusdc, is_combo_ptb}
3. WebSocket: push new mints >100 dUSDC to clients
4. Endpoint: GET /feed?following=0x... returns recent trades

Frontend:

- Global Feed tab: FlatList of TradeCard components
- Each card shows: @ensOrAddr, "3x Long 70k-70.5k 15m", $size, "2m ago"
- "Mirror" button: pre-fills ComboTrade screen with same params
- "Mirror 2x" button: same but leverage = 2x via margin
- Follow button: stores in AsyncStorage for MVP

### 3. PORTFOLIO: Unified Positions

File: /screens/Portfolio.tsx

Fetch from 3 sources in parallel:

1. deepbook_margin: get_margin_account -> show collateral, debt, health_factor
2. predict::PredictManager: get all open positions, time_to_settlement
3. deepbook_spot: get token balances

Add "Close All" button: PTB that:

1. predict::redeem all settled positions
2. margin::repay debt with dUSDC
3. margin::withdraw remaining collateral
4. spot::swap back to SUI if user wants

### 4. ANALYTICS: Vol-Adjusted Leaderboard

File: /screens/Leaderboard.tsx

For each trader address:

1. Get all PositionRedeemed events
2. For each trade, fetch OracleSVI at mint timestamp
3. Calc "IV Edge" = (realized_pnl / size) / implied_vol
4. Rank by "30d IV-Edge Sharpe"

This is our hackathon moat. Only Predict can do this because we have SVI.

### 5. HACKATHON REQUIREMENTS CHECKLIST

Add these to pass qualification:

1. .env: DUSDC_FAUCET_URL=https://tally.so/r/Xx102L
2. Onboarding: If user dUSDC balance = 0, show "Get testnet dUSDC" button -> opens faucet
3. Demo mode: If TESTNET_SEED=true, spawn 3 bot wallets that trade every 5min so feed isn't empty
4. Disclaimer: Footer text "Not financial advice. Testnet only."
5. Simulation: /utils/simulator.ts - replay last 100 BTC 15m candles against range strategy, show Sharpe

### 6. FILE STRUCTURE TO CREATE

/screens/
ComboTrade.tsx
SocialFeed.tsx
Portfolio.tsx
Leaderboard.tsx
/components/
HealthFactorGauge.tsx
TradeCard.tsx
IVChart.tsx
/hooks/
useComboPTB.ts - builds the 3-protocol PTB
useSocialFeed.ts - WebSocket + AsyncStorage follows
useVolAnalytics.ts - IV-Edge calc
/lib/
deepbook.ts - all package IDs + function targets for testnet-4-16
indexer.ts - predict-server API wrapper

### 7. ACCEPTANCE CRITERIA

When done, I should be able to:

1. Login with email OTP
2. See empty feed, tap "Demo Mode" -> bots start trading
3. Follow a bot, get push notif when it trades
4. Tap "Mirror 2x" -> sign 1 tx -> see position in Portfolio
5. Wait 15min -> tap "Close All" -> get SUI back with profit/loss
6. Check Leaderboard -> see vol-adjusted rank

Use existing SpotTradingUI and PredictUI components. Do not rebuild them. Only wire them together.

Start with /hooks/useComboPTB.ts since everything depends on it. Ask for package IDs if you don't see them in /lib/deepbook.ts.
