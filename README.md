# 11° — World Cup DeFi Protocol

**Back your team. Earn while they win.**

11° is a production-grade DeFi protocol built for the 2026 FIFA World Cup, deployed on X Layer (OKX's EVM-compatible chain). It combines conviction staking, prediction markets, and on-chain tournament mechanics — all orchestrated through a **Uniswap V4 Hook as the core primitive**.

---

## Hackathon Compliance

| Requirement | Status | Implementation |
|---|---|---|
| **Uniswap V4 Hook** | ✅ | `StadiumHook.sol` inherits `BaseHook`, implements `beforeSwap`, `afterSwap`, `beforeAddLiquidity`, `afterAddLiquidity` |
| **Hook permission bits in address** | ✅ | `DeployHook.s.sol` uses `HookMiner.find()` + CREATE2 — address encodes the 4 permission flags |
| **PoolKey uses IHooks(hook)** | ✅ | `TeamFactory.createTeamPool()` builds `PoolKey` with `hooks: IHooks(hook)` and `fee: DYNAMIC_FEE_FLAG` |
| **Dynamic fees** | ✅ | Group stage 0.30% → Knockout 0.50% → Final 1.00%, 0.05% conviction holder discount |
| **Hook emits visible events** | ✅ | `PoolRegistered`, `TeamSwap`, `TeamMomentumUpdated`, `ChampionFeeRouted`, `SwapBlocked` |
| **Swap blocked on elimination** | ✅ | `beforeSwap` reverts with `TeamEliminated()` after `MatchOracle.postElimination()` |
| **On-chain oracle** | ✅ | `MatchOracle.sol` — full match lifecycle, stage tracking, result posting |
| **X Layer deployment** | ✅ | Chain ID 196 (mainnet) / 1952 (testnet), native OKB gas |
| **Pull-based payouts** | ✅ | CEI pattern throughout, no push loops, nonReentrant guards |
| **Real token mechanics** | ✅ | `TeamToken.sol` ERC20 per team, `TeamFactory.sol` initialises V4 pool per team |
| **Frontend proof** | ✅ | V4 Hook Engine card on Home page showing hook address, permissions, demo flow |

### Deployed V4 Pool + Hook Addresses

| Contract | X Layer Testnet (1952) | X Layer Mainnet (196) |
|---|---|---|
| PoolManager | `0xb5E3F0eeE2094c764808de784398eAf1Cd25A4ec` [DEMO] | TBD |
| StadiumHook | `0xC529f376Af39fa58Da592447Cc659cdD58bb4cc0` | TBD |
| TeamFactory | `0x60dDFE8207474c55c34bfe0474987c1076D5E855` | TBD |
| Demo Pool (ARG/USDC) | `0xd887a4b4f84d8b140ac80d0eecbf54e2c70e8d0fea1d67e71eb43db247f617a0` | TBD |
| MockUSDC | `0xab87caF62157AD17b07473a02FD4bB50DFefF72F` | N/A |
| ConvictionVault | `0xb1059Fda29493B00F83a77aD0A633f8b97b306EA` | TBD |
| VARMarket | `0x46E7E0615fbe0c0Db876F4c5E7B2eC6fCdbaF358` | TBD |
| MatchOracle | `0x7b1E506b37f6FCa058176dc208184fBEB9F5F338` | TBD |
| ChampionPool | `0xfE7a4fDA91dc6FC0a607ebAFb9a49Ca317D05A5b` | TBD |

### Hook Permission Flags (encoded in hook address)

```
Hooks.BEFORE_SWAP_FLAG          — validates pool, returns dynamic fee
Hooks.AFTER_SWAP_FLAG           — tracks volume + momentum, emits events
Hooks.BEFORE_ADD_LIQUIDITY_FLAG — blocks liquidity on eliminated team pools
Hooks.AFTER_ADD_LIQUIDITY_FLAG  — records liquidity stats
```

Address flags are verified at deploy time:
```solidity
require(address(hook) == hookAddress, "DeployHook: address mismatch");
```

### Demo Flow — Swap Blocking Proof

```
1. Call TeamFactory.createTeamPool(teamId=37, ...) → V4 pool for Argentina (ARG/USDC) created
   Pool uses hooks: IHooks(stadiumHook)

2. Call VARMarket.placeBet(...) and swap ARG/USDC
   → StadiumHook.beforeSwap() fires
   → oracle confirms team ACTIVE
   → returns dynamic fee (0.30%)
   → swap proceeds ✓
   → TeamSwap event emitted ✓

3. Call MatchOracle.postElimination(teamId=37)
   → ConvictionVault.settleElimination(37) triggered
   → survivor yield distributed via MasterChef accumulator (O(1), no loops)

4. Attempt same ARG/USDC swap
   → StadiumHook.beforeSwap() fires
   → oracle: isTeamEliminated(37) == true
   → emit SwapBlocked(37, 1)
   → revert TeamEliminated() ✓
```

---

## What STADIUM Does

```
User deposits USDC → backs a World Cup team → earns yield from eliminated teams
                    ↓
            Team gets eliminated
                    ↓
    50% of their deposits forfeited:
      20% → Survivor Yield (MasterChef accumulator — O(1) no loops)
      50% → Champion Pool (for champion backers)
      30% → Treasury
                    ↓
    User can also trade team tokens through Uniswap V4 pools
    governed by StadiumHook — momentum tracking, conviction discounts
                    ↓
    VAR prediction markets alongside each match:
      Winner / First Goal / Red Card / Extra Time
      Winners split the losing pool proportionally
```

---

## StadiumHook — Core V4 Primitive

`src/StadiumHook.sol` is the technical core of the protocol.

### Hook Permissions

| Permission | Implemented | Purpose |
|---|---|---|
| `beforeSwap` | ✅ | Reject eliminated/paused team pools; return dynamic fee |
| `afterSwap` | ✅ | Route protocol fee to ChampionPool; update team momentum |
| `beforeAddLiquidity` | ✅ | Block liquidity on eliminated team pools |
| `afterAddLiquidity` | ✅ | Track liquidity stats |

### Dynamic Fee Logic

```
baseFee = groupStageFee (0.30%)  if stage == GROUP
        = knockoutFee   (0.50%)  if stage == KNOCKOUT
        = finalFee      (1.00%)  if stage == FINAL

if user.getActiveConviction(teamId):
    baseFee -= convictionDiscount (0.05%)
```

### Momentum Tracking

Each swap increases `teamMomentum[teamId]` by the absolute swap volume. This can be used for:
- Frontend "hot team" indicators
- Future reward tier adjustments
- External integrations

---

## Contract Architecture

```
MatchOracle (admin-only)
    │
    ├──→ ConvictionVault.registerTeam()     — team becomes depositable
    ├──→ VARMarket.openMarketsWithTeams()  — betting window opens
    ├──→ ConvictionVault.settleElimination() — yield distributed O(1)
    ├──→ ChampionPool.setChampion()         — snapshot at end
    └──→ ConvictionVault.setChampion()      — unlock principal claims

StadiumHook (V4 hook)
    ├── beforeSwap: validates pool, computes dynamic fee
    ├── afterSwap:  routes protocol fee → ChampionPool
    └── beforeAddLiquidity: blocks eliminated pools

TeamFactory
    ├── registerTeam(teamId, name, symbol) → deploys TeamToken ERC20
    └── createTeamPool(teamId, ...) → initializes Uniswap V4 pool via PoolManager

ConvictionVault (MasterChef accumulator)
    ├── depositConviction(teamId, amount)
    ├── claimYield()       — pull all pending yield across teams
    ├── claimEliminatedPosition(teamId)  — 50% refund
    └── claimChampionPrincipal(teamId)   — full return for winners

VARMarket (prediction markets)
    ├── placeBet(matchId, marketType, outcome, amount)
    └── claimVAR(matchId, marketType)   — pull-based payout

ChampionPool
    └── claimChampionPool(teamId)       — proportional share of accumulated pool
```

### Elimination Math (per elimination)

```
forfeited = 50% of team's locked USDC

20% of forfeited → accYieldPerShare accumulator (alive depositors claim lazily)
50% of forfeited → ChampionPool
30% of forfeited → Treasury
```

### VAR Settlement Split

```
losingPool = sum of all USDC bet on incorrect outcomes

10% of losingPool → refund pool (each loser gets 10% back)
90% remaining:
    50% of remaining = 45% of losingPool → winners pool (weighted by conviction multiplier)
    25% of remaining = 22.5% of losingPool → ChampionPool
    25% of remaining = 22.5% of losingPool → Treasury
```

---

## Deployment Guide

### Prerequisites

```bash
forge install
cp .env.example .env
# fill in PRIVATE_KEY, TREASURY_ADDRESS, XLAYER_RPC_URL
```

### Step 1: Core contracts

```bash
forge script script/Deploy.s.sol \
  --rpc-url $XLAYER_RPC_URL \
  --broadcast \
  --verify
```

This deploys: MockUSDC, ChampionPool, StadiumNFT, MatchOracle, ConvictionVault, VARMarket.
Writes `deployments.json`.

### Step 2: StadiumHook (requires address mining)

```bash
export POOL_MANAGER_ADDRESS=<from deployments.json>
export MOCK_USDC_ADDRESS=<from deployments.json>
export CHAMPION_POOL_ADDRESS=<from deployments.json>
export CONVICTION_VAULT_ADDRESS=<from deployments.json>
export MATCH_ORACLE_ADDRESS=<from deployments.json>

forge script script/DeployHook.s.sol \
  --rpc-url $XLAYER_RPC_URL \
  --broadcast
```

The script mines a CREATE2 salt so the hook address encodes the required Uniswap V4 permission bits.

### Step 3: Register teams

```bash
export MATCH_ORACLE_ADDRESS=<address>
forge script script/SeedTeams.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
```

### Step 4: Create V4 pools

```bash
export TEAM_FACTORY_ADDRESS=<from DeployHook output>
export STADIUM_HOOK_ADDRESS=<from DeployHook output>
forge script script/CreatePools.s.sol --rpc-url $XLAYER_RPC_URL --broadcast
```

### Step 5: Update frontend env

```env
VITE_CHAIN_ID=1952
VITE_RPC_URL=https://testrpc.xlayer.tech/terigon
VITE_MOCK_USDC_ADDRESS=0xab87caF62157AD17b07473a02FD4bB50DFefF72F
VITE_CONVICTION_VAULT_ADDRESS=0xb1059Fda29493B00F83a77aD0A633f8b97b306EA
VITE_VAR_MARKET_ADDRESS=0x46E7E0615fbe0c0Db876F4c5E7B2eC6fCdbaF358
VITE_MATCH_ORACLE_ADDRESS=0x7b1E506b37f6FCa058176dc208184fBEB9F5F338
VITE_CHAMPION_POOL_ADDRESS=0xfE7a4fDA91dc6FC0a607ebAFb9a49Ca317D05A5b
VITE_STADIUM_NFT_ADDRESS=0xf081BB46cb46Cedc1B1D8b29b70C1E8038294c3A
VITE_STADIUM_HOOK_ADDRESS=0xC529f376Af39fa58Da592447Cc659cdD58bb4cc0
VITE_TEAM_FACTORY_ADDRESS=0x60dDFE8207474c55c34bfe0474987c1076D5E855
VITE_TREASURY_ADDRESS=0x55EC7211E5EB2A2761be3C455813fBBe0C331227
```

---

## Testing

```bash
# Run all tests
forge test -vv

# With gas snapshots
forge test --gas-report

# Specific test file
forge test --match-path test/ConvictionVault.t.sol -vv
forge test --match-path test/VARMarket.t.sol -vv
forge test --match-path test/Integration.t.sol -vv
forge test --match-path test/StadiumHook.t.sol -vv
```

Test coverage: 25+ tests across unit, integration, and hook behavior.

---

## Oracle Relayer (API-Football → On-Chain)

The `.github/workflows/oracle-relayer.yml` GitHub Actions workflow:

1. Fetches fixtures and results from API-Football every 10 minutes
2. Calls `MatchOracle.createOrUpdateMatch()` for scheduled matches
3. During live matches: calls `openVARWindow`, `startMatch`, `postResult`
4. After confirmed results: calls `postElimination` / `postChampion`

Required GitHub secrets:
- `API_FOOTBALL_KEY` — API-Football v3 API key
- `ORACLE_PRIVATE_KEY` — private key with oracle admin role
- `XLAYER_RPC_URL` — RPC endpoint

---

## X Layer Network Config

| Property | Testnet | Mainnet |
|---|---|---|
| Chain ID | 1952 | 196 |
| Symbol | OKB | OKB |
| RPC | https://testrpc.xlayer.tech/terigon | https://rpc.xlayer.tech |
| Explorer | https://web3.okx.com/explorer/xlayer-test | https://web3.okx.com/explorer/xlayer |

---

## Security Notes

- **CEI pattern**: All state changes happen before external calls throughout
- **Reentrancy guards**: `nonReentrant` on all user-facing write functions
- **No admin backdoors**: Owner can only register teams and post results; cannot touch user funds
- **Pull-based**: All payouts require user transactions; no push loops
- **Oracle trust**: `MatchOracle` is admin-controlled; production version should use multi-sig
- **Hook address mining**: V4 hook address must encode permission bits — enforced at deploy time

---

## Contract Addresses

| Contract | Testnet | Mainnet |
|---|---|---|
| MockUSDC | TBD | TBD |
| ConvictionVault | TBD | TBD |
| VARMarket | TBD | TBD |
| MatchOracle | TBD | TBD |
| ChampionPool | TBD | TBD |
| StadiumHook | TBD | TBD |
| TeamFactory | TBD | TBD |

*Update after deployment.*

---

## Hackathon Submission Checklist

### Uniswap V4 Hook Requirements
- [x] `StadiumHook.sol` inherits `BaseHook` (official Uniswap V4 hook interface)
- [x] `beforeSwap` — validates pool, returns dynamic fee, reverts on eliminated teams
- [x] `afterSwap` — tracks volume + momentum, emits `TeamSwap` + `TeamMomentumUpdated`
- [x] `beforeAddLiquidity` — blocks liquidity adds on eliminated team pools
- [x] `afterAddLiquidity` — records stats, emits `TeamLiquidityAdded`
- [x] `PoolKey` uses `hooks: IHooks(address(stadiumHook))` and `DYNAMIC_FEE_FLAG`
- [x] `DeployHook.s.sol` mines CREATE2 salt via `HookMiner.find()` — address encodes permission bits
- [x] Deployment verifies `address(hook) == hookAddress` (no silent mismatch)
- [x] `CreatePools.s.sol` creates V4 pool with hook attached, writes `v4-pools.json`
- [x] Hook events: `PoolRegistered`, `TeamSwap`, `TeamMomentumUpdated`, `ChampionFeeRouted`, `SwapBlocked`
- [x] Frontend "V4 Hook Engine" card: hook address, PoolManager, permissions, live state, demo flow
- [x] Demo flow documented (swap pass → elimination → swap blocked)

### Protocol Requirements
- [x] Dynamic fees: Group 0.30% → Knockout 0.50% → Final 1.00%
- [x] Conviction holder fee discount (−0.05%)
- [x] Per-team stage tracking via `MatchOracle.updateTeamStage()`
- [x] X Layer deployment scripts and chain config (Chain ID 196 / 1952)
- [x] Pull-based payouts — CEI pattern, `nonReentrant` throughout
- [x] MasterChef O(1) yield distribution — no loops over users at settlement
- [x] VAR `settleMarket` gas-safe — `totalWeightedWinning` pre-computed in `placeBet`
- [x] On-chain oracle for match results (VAR open/close/settle, eliminations, champion)
- [x] ERC20 team tokens (one per team) via `TeamFactory`
- [x] V4 pool per team via `TeamFactory.createTeamPool()`
- [x] API-Football oracle relayer (GitHub Actions)
- [x] 25+ Foundry tests
- [x] Frontend with Hook Engine card, Trade page, Portfolio, Leaderboard
