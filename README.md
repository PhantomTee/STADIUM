# 11° — World Cup DeFi Protocol

> **Back your team. Earn while they win.**

[![X Layer Testnet](https://img.shields.io/badge/X%20Layer-Testnet%201952-00d4aa?style=flat-square)](https://web3.okx.com/explorer/xlayer-test)
[![Uniswap V4](https://img.shields.io/badge/Uniswap-V4%20Hook-ff007a?style=flat-square)](https://docs.uniswap.org/contracts/v4/overview)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-orange?style=flat-square)](https://book.getfoundry.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

11° is a conviction-based DeFi protocol built for the 2026 FIFA World Cup, deployed on X Layer — OKX's EVM L2. Lock USDC behind a team, earn survivor yield every time a rival is eliminated, predict match outcomes through VAR markets, and share the Champion Pool if your team lifts the trophy.

The entire protocol is orchestrated through a **Uniswap V4 Hook** as its core on-chain primitive.

---

## Live Demo

| | |
|---|---|
| **Frontend** | [e11even-men.vercel.app](https://e11even-men.vercel.app) |
| **Network** | X Layer Testnet — Chain ID `1952` |
| **Explorer** | [web3.okx.com/explorer/xlayer-test](https://web3.okx.com/explorer/xlayer-test) |

---

## Protocol Overview

```
User deposits USDC
        │
        ▼
  ConvictionVault
  (backs a WC 2026 team)
        │
        ├─── Team eliminated?
        │         │
        │         ▼
        │    50% of pool forfeited:
        │      ├── 10% → Survivor Yield (MasterChef O(1) accumulator → alive backers)
        │      ├── 25% → Champion Pool  (locked until final whistle)
        │      └── 15% → Treasury
        │
        ├─── Match happening?
        │         │
        │         ▼
        │    VAR Prediction Markets open:
        │      Match Winner · First Goal · Red Card · Extra Time
        │      Conviction holders earn 1.5× weighted payout bonus
        │
        └─── Team wins WC 2026?
                  │
                  ▼
             100% principal returned
             + all survivor yield
             + proportional Champion Pool share
             + Champion NFT
```

---

## What Makes This Different

| Feature | How |
|---|---|
| **Survivor Yield** | Every elimination auto-accrues yield to alive backers via MasterChef accumulator — O(1), no loops |
| **Champion Pool** | Grows throughout the tournament; snapshotted at final whistle; proportional to stake |
| **VAR Markets** | 4 prediction markets per match; conviction holders earn 1.5× bonus on correct calls |
| **Dynamic Fees** | V4 Hook sets swap fees by tournament stage: Group 0.30% → Knockout 0.50% → Final 1.00% |
| **Swap Blocking** | Hook reverts swaps for eliminated team pools — provable on-chain market termination |
| **Momentum Tracking** | Hook tracks team swap volume; drives "hot team" UI indicators |

---

## StadiumHook — The V4 Core

`src/StadiumHook.sol` is the technical heart of the protocol. It is a Uniswap V4 `BaseHook` that manages all per-team pool state.

### Hook Permissions

| Hook | Purpose |
|---|---|
| `beforeSwap` | Validates pool is active; rejects swaps on eliminated teams; returns dynamic fee |
| `afterSwap` | Tracks notional fee accrual, updates `teamMomentum`, emits `ChampionFeeRouted`; no real USDC transfer from hook (ChampionPool funded via ConvictionVault/VARMarket settlement) |
| `beforeAddLiquidity` | Blocks new liquidity on eliminated team pools |
| `afterAddLiquidity` | Records liquidity stats per team |

### Permission Flags (encoded in CREATE2 hook address)

```
Hooks.BEFORE_SWAP_FLAG
Hooks.AFTER_SWAP_FLAG
Hooks.BEFORE_ADD_LIQUIDITY_FLAG
Hooks.AFTER_ADD_LIQUIDITY_FLAG
```

Address flags are verified at deploy time:
```solidity
require(address(hook) == hookAddress, "DeployHook: address mismatch");
```

### Dynamic Fee Formula

```
baseFee = groupStageFee (0.30%)   if stage == GROUP
        = knockoutFee   (0.50%)   if stage == KNOCKOUT
        = finalFee      (1.00%)   if stage == FINAL

if user has active conviction for teamId:
    baseFee -= convictionDiscount (0.05%)
```

### Swap Block Demo

```
1. createTeamPool(teamId=37)  →  ARG/USDC pool created with hooks: IHooks(stadiumHook)
2. swap ARG/USDC              →  beforeSwap fires, oracle: active, returns 0.30% fee ✓
                                  TeamSwap + TeamMomentumUpdated emitted ✓
3. postElimination(teamId=37) →  ConvictionVault.settleElimination(37)
                                  survivor yield distributed (O(1))
4. swap ARG/USDC again        →  beforeSwap fires, oracle: eliminated
                                  SwapBlocked(37, 1) emitted
                                  revert TeamEliminated() ✓
```

---

## Contract Architecture

```
MatchOracle  ←  trusted sports-data relayer (GitHub Actions)
    │
    ├──→ ConvictionVault.registerTeam()       team becomes depositable
    ├──→ ConvictionVault.settleElimination()  O(1) yield distribution
    ├──→ VARMarket.openMarketsWithTeams()     VAR window opens
    ├──→ VARMarket.settleMarket()             VAR results posted
    ├──→ ChampionPool.setChampion()           snapshot at tournament end
    └──→ ConvictionVault.setChampion()        unlock principal claims

StadiumHook  (Uniswap V4 BaseHook)
    ├── beforeSwap:        validate + dynamic fee + block eliminated
    ├── afterSwap:         momentum tracking + notional fee accrual (ChampionPool funded via ConvictionVault/VARMarket)
    └── beforeAddLiquidity: block eliminated pools

TeamFactory
    ├── registerTeam()     deploy TeamToken ERC20
    └── createTeamPool()   initialize V4 pool via PoolManager

ConvictionVault  (MasterChef accumulator pattern)
    ├── depositConviction(teamId, amount)
    ├── claimYield()
    ├── claimEliminatedPosition(teamId)   50% refund on elimination
    └── claimChampionPrincipal(teamId)    full return for WC winner

VARMarket
    ├── placeBet(matchId, marketType, outcome, amount)
    └── claimVAR(matchId, marketType)

ChampionPool
    └── claimChampionPool(teamId)         proportional share
```

---

## Deployed Contracts

### X Layer Testnet (Chain ID: 1952)

| Contract | Address |
|---|---|
| MockUSDC | `0x3C606882922b0921A2bCDcf6baDF00aD394709f2` |
| ConvictionVault | `0x0D39a025717b37486891ba9e5955Fa45CaB66e21` |
| VARMarket | `0x5b5dDe94479689A82E1d65d7c68E1cf9356F12dB` |
| MatchOracle | `0x876B49E2b18B0a98Db8F534185177e1c0641eC18` |
| ChampionPool | `0x1A26a2F581D901907F885506Df630cAFa4744bc8` |
| StadiumNFT | `0x0BFFa6b1E6D0a4B38423A25CdB24b52d54128D53` |
| StadiumHook | `0xE4cAd1E5947b804212E1569151f66d8Eec924cC0` |
| TeamFactory | `0x6b9D81fD631e2E58a75056cA6d8E64057062A615` |
| StadiumRouter | `0x506644f2EdfcB772ee6719f14C94077850BCD627` |
| StadiumLiquidityRouter | `0x645aD67b9380d68e5BeACEad3a8568D81D4faff3` |
| PoolManager (V4) | `0x16d7342D48b2b2e7fc5C3Ec227f8DFbF2608e45B` |
| Treasury | `0x17B01940428c3C4d8b859535E39Adf15cce3cFb8` |

### X Layer Network Info

| | Testnet | Mainnet |
|---|---|---|
| Chain ID | `1952` | `196` |
| Native Gas | OKB | OKB |
| RPC | `https://testrpc.xlayer.tech/terigon` | `https://rpc.xlayer.tech` |
| Explorer | [xlayer-test explorer](https://web3.okx.com/explorer/xlayer-test) | [xlayer explorer](https://web3.okx.com/explorer/xlayer) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.26, Foundry, Uniswap V4 |
| Chain | X Layer (OKB L2, zkEVM) |
| Frontend | React 18, Vite, wagmi v2, viem, RainbowKit |
| Styling | Tailwind CSS |
| Backend / API proxy | Node.js + Express, Railway |
| Match data | football-data.org (server-side only, never exposed to client) |
| CI / Oracle relayer | GitHub Actions |

---

## Local Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) — `foundryup`
- Node.js 18+
- An X Layer Testnet wallet with OKB for gas

### 1. Clone & install

```bash
git clone https://github.com/phantomtee/stadium
cd stadium
forge install
cd frontend && npm install
cd ../backend && npm install
```

### 2. Environment setup

```bash
# Root (contracts)
cp .env.example .env
# Set: PRIVATE_KEY, TREASURY_ADDRESS, XLAYER_RPC_URL

# Frontend
cp frontend/.env.example frontend/.env
# Set: VITE_* contract addresses, VITE_API_BASE_URL

# Backend
cp backend/.env.example backend/.env
# Set: RPC_URL, FOOTBALL_DATA_API_KEY, ADMIN_KEY
```

### 3. Run locally

```bash
# Terminal 1 — backend API proxy
cd backend && npm run dev

# Terminal 2 — frontend dev server
cd frontend && npm run dev
```

### 4. Deploy contracts (testnet)

```bash
# Core contracts
forge script script/Deploy.s.sol --rpc-url $XLAYER_RPC_URL --broadcast

# StadiumHook (mines CREATE2 salt for permission bits)
forge script script/DeployHook.s.sol --rpc-url $XLAYER_RPC_URL --broadcast

# Register all 48 WC 2026 teams
forge script script/SeedTeams.s.sol --rpc-url $XLAYER_RPC_URL --broadcast

# Create V4 pools (one per team)
forge script script/CreatePools.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
```

---

## Tests

```bash
forge test -vv                                          # all tests
forge test --gas-report                                 # with gas report
forge test --match-path test/ConvictionVault.t.sol -vv
forge test --match-path test/VARMarket.t.sol -vv
forge test --match-path test/Integration.t.sol -vv
forge test --match-path test/StadiumHook.t.sol -vv
```

25+ tests covering unit, integration, hook behavior, and edge cases.

---

## Oracle Relayer

The `.github/workflows/oracle-relayer.yml` GitHub Actions workflow runs every 10 minutes:

1. Fetches fixtures + results from football-data.org
2. Calls `MatchOracle.createOrUpdateMatch()` for upcoming matches
3. During live matches: calls `openVARWindow` → `startMatch` → `postResult`
4. After confirmed results: calls `postElimination` or `postChampion`

The API key is **server-side only** — never in frontend code or git history.

Required GitHub secrets: `FOOTBALL_DATA_API_KEY`, `ORACLE_PRIVATE_KEY`, `XLAYER_RPC_URL`

---

## Security

- **CEI pattern** — state changes always precede external calls
- **Reentrancy guards** — `nonReentrant` on all user-facing write functions
- **Pull-based payouts** — no push loops; all claims require user transaction
- **No admin backdoors** — owner can only post match results; cannot move user funds
- **Oracle trust model** — `MatchOracle` is admin-controlled; described as a *trusted sports-data relayer*, not a decentralized oracle
- **Hook address verification** — V4 hook address must encode permission bits, verified at deploy time
- **API key isolation** — football-data.org key read only from server env; frontend calls own backend proxy

---

## Hackathon Submission — XLayer Build-X 2026

### Hook Requirements Checklist

- [x] `StadiumHook.sol` inherits `BaseHook` (official Uniswap V4 interface)
- [x] `beforeSwap` — validates pool, returns dynamic fee, reverts on eliminated teams
- [x] `afterSwap` — tracks notional fee accrual, updates `teamMomentum`, emits `ChampionFeeRouted` (no real USDC transfer from hook)
- [x] `beforeAddLiquidity` — blocks liquidity on eliminated pools
- [x] `afterAddLiquidity` — records per-team liquidity stats
- [x] `PoolKey` uses `hooks: IHooks(address(stadiumHook))` + `DYNAMIC_FEE_FLAG`
- [x] `DeployHook.s.sol` mines CREATE2 salt via `HookMiner.find()` — address encodes permission bits
- [x] Deployment verifies `address(hook) == hookAddress` at runtime
- [x] Hook emits: `PoolRegistered`, `TeamSwap`, `TeamMomentumUpdated`, `ChampionFeeRouted`, `SwapBlocked`
- [x] Deployed on X Layer Testnet (Chain ID 1952) with verifiable addresses

### Protocol Requirements Checklist

- [x] 48 WC 2026 teams registered in MatchOracle + ConvictionVault
- [x] MasterChef O(1) survivor yield — no per-user loops at settlement
- [x] VAR markets — 4 types, conviction multiplier, gas-safe settlement
- [x] Champion Pool — accumulates from eliminations + VAR, proportional claim
- [x] Pull-based CEI — every payout requires explicit user claim
- [x] Dynamic fees by tournament stage (Group/Knockout/Final)
- [x] ERC20 TeamTokens (one per team) via `TeamFactory`
- [x] V4 pool per team via `TeamFactory.createTeamPool()`
- [x] Trusted sports-data relayer via GitHub Actions (football-data.org)
- [x] 25+ Foundry tests

### Frontend Features

- [x] Live leaderboard (sorted by conviction locked / backers)
- [x] Live scores + group standings (football-data.org proxied via backend)
- [x] Portfolio page — user positions, pending yield, elimination claims
- [x] Activity feed — real-time on-chain event stream
- [x] VAR betting UI per match
- [x] Countdown to conviction close (tournament kickoff)
- [x] Onboarding modal (first-visit tour)
- [x] Faucet with 24h cooldown UI
- [x] V4 Hook Engine card (hook address, permissions, live demo flow)
- [x] Conviction multiplier display

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built for the XLayer Build-X Hackathon 2026 · Uniswap V4 Hook Arena Track*
*In collaboration with [@XLayerOfficial](https://x.com/XLayerOfficial) · [@Uniswap](https://x.com/Uniswap) · [@flapdotsh](https://x.com/flapdotsh)*
