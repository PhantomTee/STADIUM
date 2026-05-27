# STADIUM — World Cup DeFi Protocol

**Back your team. Earn while they win.**

STADIUM is a production-grade DeFi protocol built for the 2026 FIFA World Cup, deployed on X Layer (OKX's EVM-compatible chain). It combines conviction staking, prediction markets, and on-chain tournament mechanics—all orchestrated through a **Uniswap V4 Hook as the core primitive**.

---

## Hackathon Compliance

| Requirement | Implementation |
|---|---|
| **Uniswap V4 Hook** | `StadiumHook.sol` — `beforeSwap`, `afterSwap`, `beforeAddLiquidity`, `afterAddLiquidity` |
| **Dynamic fees** | Group stage (0.3%) → Knockout (0.5%) → Final (1.0%), conviction holder discount |
| **On-chain oracle** | `MatchOracle.sol` — tournament lifecycle management, results posted on-chain |
| **X Layer deployment** | Chain ID 196 (mainnet) / 1952 (testnet), native OKB gas |
| **Pull-based payouts** | All claims user-initiated — CEI pattern throughout, no push loops |
| **Real token mechanics** | `TeamToken.sol` ERC20 per team, `TeamFactory.sol` creates V4 pools |
| **No admin backdoors** | `onlyOwner` = oracle admin only; users always get their funds |

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
    50% → winners pool (weighted by conviction multiplier)
    25% → ChampionPool
    25% → Treasury
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
VITE_MOCK_USDC_ADDRESS=0x...
VITE_CONVICTION_VAULT_ADDRESS=0x...
VITE_VAR_MARKET_ADDRESS=0x...
VITE_MATCH_ORACLE_ADDRESS=0x...
VITE_CHAMPION_POOL_ADDRESS=0x...
VITE_STADIUM_NFT_ADDRESS=0x...
VITE_STADIUM_HOOK_ADDRESS=0x...
VITE_TEAM_FACTORY_ADDRESS=0x...
VITE_TREASURY_ADDRESS=0x...
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

- [x] Uniswap V4 Hook with real logic (not decorative)
- [x] Dynamic fees based on tournament stage
- [x] Conviction holder fee discount
- [x] Team momentum tracking via swap volume
- [x] X Layer deployment scripts and chain config
- [x] Pull-based payouts (no gas-limit DoS vectors)
- [x] MasterChef O(1) yield distribution (no loops over users)
- [x] On-chain oracle for match results
- [x] ERC20 team tokens (one per team)
- [x] V4 pool per team via TeamFactory
- [x] API-Football oracle relayer (GitHub Actions)
- [x] 25+ Foundry tests
- [x] Frontend with Trade page showing hook activity
