export const MockUSDC_ABI = [
  { inputs: [], name: "faucet", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "pure", type: "function" },
  { inputs: [{ name: "addr", type: "address" }], name: "lastFaucetTime", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
]

// ConvictionVault — MasterChef-style accumulator vault
export const ConvictionVault_ABI = [
  // ── User write functions ──
  { inputs: [{ name: "teamId", type: "uint16" }, { name: "amount", type: "uint256" }], name: "depositConviction", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "claimYield", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "claimEliminatedPosition", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "claimChampionPosition", outputs: [], stateMutability: "nonpayable", type: "function" },
  // ── View functions ──
  { inputs: [{ name: "user", type: "address" }], name: "pendingYield", outputs: [{ name: "total", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "user", type: "address" }, { name: "teamId", type: "uint16" }], name: "getUserDeposit", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "user", type: "address" }, { name: "teamId", type: "uint16" }], name: "getActiveConviction", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "user", type: "address" }, { name: "teamId", type: "uint16" }], name: "getConvictionMultiplier", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  {
    inputs: [{ name: "user", type: "address" }, { name: "teamId", type: "uint16" }],
    name: "getUserPosition",
    outputs: [{
      components: [
        { name: "deposited", type: "uint256" },
        { name: "pendingYield", type: "uint256" },
        { name: "principalClaimed", type: "bool" },
        { name: "teamActive", type: "bool" },
        { name: "teamEliminated", type: "bool" },
        { name: "teamChampion", type: "bool" },
      ],
      name: "", type: "tuple",
    }],
    stateMutability: "view", type: "function",
  },
  { inputs: [{ name: "", type: "address" }, { name: "", type: "uint16" }], name: "deposits", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "uint16" }], name: "teamTotalDeposit", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "uint16" }], name: "backerCount", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalAliveDeposits", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "uint16" }], name: "teamActive", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "uint16" }], name: "teamEliminated", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "uint16" }], name: "teamChampion", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "address" }, { name: "", type: "uint16" }], name: "principalClaimed", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "address" }], name: "claimableYield", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "convictionCloseTime", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "isConvictionOpen", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "_time", type: "uint256" }], name: "setConvictionCloseTime", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }, { name: "amount", type: "uint256" }], name: "withdrawConviction", outputs: [], stateMutability: "nonpayable", type: "function" },
  // ── Events ──
  { anonymous: false, inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "teamId", type: "uint16" }, { name: "amount", type: "uint256" }], name: "ConvictionDeposited", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "user", type: "address" }, { name: "amount", type: "uint256" }], name: "YieldClaimed", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "teamId", type: "uint16" }, { name: "refund", type: "uint256" }], name: "EliminationClaimed", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "teamId", type: "uint16" }, { name: "principal", type: "uint256" }], name: "ChampionClaimed", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "teamId", type: "uint16" }, { name: "amount", type: "uint256" }], name: "ConvictionWithdrawn", type: "event" },
]

// VARMarket — uint8 outcome constants, pull-based claimVAR / claimPayout
export const VARMarket_ABI = [
  // ── User write functions ──
  { inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }, { name: "outcome", type: "uint8" }, { name: "amount", type: "uint256" }], name: "placeBet", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }], name: "claimVAR", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }], name: "claimPayout", outputs: [], stateMutability: "nonpayable", type: "function" },
  // ── View functions ──
  {
    inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }],
    name: "markets",
    outputs: [{ components: [{ name: "teamAId", type: "uint16" }, { name: "teamBId", type: "uint16" }, { name: "open", type: "bool" }, { name: "settled", type: "bool" }, { name: "correctOutcome", type: "uint8" }, { name: "toWinnersPool", type: "uint256" }, { name: "totalWeightedWinning", type: "uint256" }], name: "", type: "tuple" }],
    stateMutability: "view", type: "function",
  },
  { inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }, { name: "outcome", type: "uint8" }], name: "outcomePool", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }, { name: "user", type: "address" }, { name: "outcome", type: "uint8" }], name: "betAmount", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }, { name: "user", type: "address" }], name: "claimed", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  // ── Events ──
  { anonymous: false, inputs: [{ indexed: true, name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }, { indexed: true, name: "user", type: "address" }, { name: "outcome", type: "uint8" }, { name: "amount", type: "uint256" }], name: "BetPlaced", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }, { name: "payout", type: "uint256" }], name: "PayoutClaimed", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }, { name: "payout", type: "uint256" }], name: "VARClaimed", type: "event" },
]

// MatchOracle — uint16 teamIds, Stage enum, createOrUpdateMatch
export const MatchOracle_ABI = [
  // ── Admin write functions ──
  { inputs: [{ name: "teamId", type: "uint16" }, { name: "name", type: "string" }], name: "registerTeam", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "matchId", type: "uint256" }, { name: "teamAId", type: "uint16" }, { name: "teamBId", type: "uint16" }, { name: "kickoffTime", type: "uint256" }], name: "createMatch", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "externalFixtureId", type: "uint256" }, { name: "matchId", type: "uint256" }, { name: "teamAId", type: "uint16" }, { name: "teamBId", type: "uint16" }, { name: "kickoffTime", type: "uint256" }, { name: "stage", type: "uint8" }], name: "createOrUpdateMatch", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "matchId", type: "uint256" }], name: "openVARWindow", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "matchId", type: "uint256" }], name: "startMatch", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "matchId", type: "uint256" }, { name: "winner", type: "uint8" }, { name: "firstGoal", type: "uint8" }, { name: "redCard", type: "bool" }, { name: "extraTime", type: "bool" }], name: "postResult", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "postElimination", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "postChampion", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "_vault", type: "address" }, { name: "_varMarket", type: "address" }, { name: "_champPool", type: "address" }], name: "setAddresses", outputs: [], stateMutability: "nonpayable", type: "function" },
  // ── View functions ──
  {
    inputs: [{ name: "matchId", type: "uint256" }],
    name: "getMatch",
    outputs: [{ components: [{ name: "matchId", type: "uint256" }, { name: "teamAId", type: "uint16" }, { name: "teamBId", type: "uint16" }, { name: "teamAName", type: "string" }, { name: "teamBName", type: "string" }, { name: "kickoffTime", type: "uint256" }, { name: "varOpen", type: "bool" }, { name: "varClosed", type: "bool" }, { name: "settled", type: "bool" }, { name: "winner", type: "uint8" }, { name: "firstGoal", type: "uint8" }, { name: "redCard", type: "bool" }, { name: "extraTime", type: "bool" }, { name: "stage", type: "uint8" }, { name: "externalFixtureId", type: "uint256" }], name: "", type: "tuple" }],
    stateMutability: "view", type: "function",
  },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "getTeam", outputs: [{ components: [{ name: "teamId", type: "uint16" }, { name: "name", type: "string" }, { name: "registered", type: "bool" }, { name: "eliminated", type: "bool" }, { name: "champion", type: "bool" }], name: "", type: "tuple" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getMatchCount", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getAllMatchIds", outputs: [{ name: "", type: "uint256[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "teamNameOf", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "teamCount", outputs: [{ name: "", type: "uint16" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "isTeamEliminated", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  // ── Events ──
  { anonymous: false, inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { name: "name", type: "string" }], name: "TeamRegistered", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "matchId", type: "uint256" }, { name: "teamAId", type: "uint16" }, { name: "teamBId", type: "uint16" }, { name: "kickoffTime", type: "uint256" }], name: "MatchCreated", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { name: "name", type: "string" }], name: "TeamEliminated", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { name: "name", type: "string" }], name: "ChampionAnnounced", type: "event" },
]

export const ChampionPool_ABI = [
  // ── User write functions ──
  { inputs: [{ name: "teamId", type: "uint16" }], name: "claimChampionPool", outputs: [], stateMutability: "nonpayable", type: "function" },
  // ── View functions ──
  { inputs: [], name: "totalAccumulated", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "championPoolSnapshot", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalChampionStake", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "championSet", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "championTeamId", outputs: [{ name: "", type: "uint16" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "", type: "address" }, { name: "", type: "uint16" }], name: "champClaimed", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getBalance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  // ── Events ──
  { anonymous: false, inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { name: "poolSnapshot", type: "uint256" }, { name: "totalStake", type: "uint256" }], name: "ChampionDeclared", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "teamId", type: "uint16" }, { name: "share", type: "uint256" }], name: "ChampionShareClaimed", type: "event" },
]

// StadiumHook — Uniswap V4 hook with dynamic fees, momentum tracking, conviction discount
export const StadiumHook_ABI = [
  // ── Admin write functions ──
  { inputs: [{ name: "_oracle", type: "address" }], name: "setOracle", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "_championPool", type: "address" }], name: "setChampionPool", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "_convictionVault", type: "address" }], name: "setConvictionVault", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "_feeBps", type: "uint24" }], name: "setProtocolFeeBps", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "pause", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "unpause", outputs: [], stateMutability: "nonpayable", type: "function" },
  // ── View functions ──
  { inputs: [{ name: "poolId", type: "bytes32" }], name: "poolState", outputs: [{ components: [{ name: "teamId", type: "uint16" }, { name: "registered", type: "bool" }, { name: "active", type: "bool" }, { name: "totalVolumeUSDC", type: "uint256" }, { name: "feeRoutedToChampPool", type: "uint256" }], name: "", type: "tuple" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "teamMomentum", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "teamPoolId", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "paused", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "protocolFeeBps", outputs: [{ name: "", type: "uint24" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "feeConfig", outputs: [{ components: [{ name: "groupStageFee", type: "uint24" }, { name: "knockoutFee", type: "uint24" }, { name: "finalFee", type: "uint24" }, { name: "convictionDiscount", type: "uint24" }], name: "", type: "tuple" }], stateMutability: "view", type: "function" },
  // ── Events ──
  { anonymous: false, inputs: [{ indexed: true, name: "poolId", type: "bytes32" }, { indexed: true, name: "teamId", type: "uint16" }], name: "PoolRegistered", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "teamId", type: "uint16" }, { name: "amount0", type: "int256" }, { name: "amount1", type: "int256" }], name: "TeamSwap", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { name: "newMomentum", type: "uint256" }], name: "TeamMomentumUpdated", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { name: "amount", type: "uint256" }], name: "ChampionFeeRouted", type: "event" },
]

// TeamFactory — deploys ERC20 team tokens and V4 pools
export const TeamFactory_ABI = [
  // ── Admin write functions ──
  { inputs: [{ name: "teamId", type: "uint16" }, { name: "name", type: "string" }, { name: "symbol", type: "string" }], name: "registerTeam", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }, { name: "tickSpacing", type: "int24" }, { name: "sqrtPriceX96", type: "uint160" }], name: "createTeamPool", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "_hook", type: "address" }], name: "setHook", outputs: [], stateMutability: "nonpayable", type: "function" },
  // ── View functions ──
  { inputs: [{ name: "teamId", type: "uint16" }], name: "teamToken", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "teamPoolId", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "registeredTeamCount", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getAllTeams", outputs: [{ name: "", type: "uint16[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "teamId", type: "uint16" }], name: "getTeamInfo", outputs: [{ components: [{ name: "teamId", type: "uint16" }, { name: "token", type: "address" }, { name: "poolId", type: "bytes32" }, { name: "active", type: "bool" }], name: "info", type: "tuple" }], stateMutability: "view", type: "function" },
  // ── Events ──
  { anonymous: false, inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { name: "token", type: "address" }], name: "TeamRegistered", type: "event" },
  { anonymous: false, inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { indexed: true, name: "poolId", type: "bytes32" }], name: "TeamPoolCreated", type: "event" },
]

// TeamToken — ERC20 per team (18 decimals, standard OZ ERC20)
export const TeamToken_ABI = [
  { inputs: [], name: "teamId", outputs: [{ name: "", type: "uint16" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "factory", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "name", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
]

// StadiumRouter — minimal V4 unlock/callback swap router
export const StadiumRouter_ABI = [
  {
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0",   type: "address" },
          { name: "currency1",   type: "address" },
          { name: "fee",         type: "uint24"  },
          { name: "tickSpacing", type: "int24"   },
          { name: "hooks",       type: "address" },
        ],
      },
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "zeroForOne",         type: "bool"    },
          { name: "amountSpecified",    type: "int256"  },
          { name: "sqrtPriceLimitX96",  type: "uint160" },
        ],
      },
      { name: "deadline", type: "uint256" },
    ],
    name: "swap",
    outputs: [{ name: "delta", type: "int256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "manager",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
]

// Treasury — receives protocol fees
export const Treasury_ABI = [
  { inputs: [{ name: "source", type: "string" }, { name: "amount", type: "uint256" }], name: "receiveFor", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "token", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "withdraw", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "totalReceived", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { anonymous: false, inputs: [{ name: "from", type: "address" }, { name: "amount", type: "uint256" }, { name: "source", type: "string" }], name: "TreasuryReceived", type: "event" },
]

export const StadiumNFT_ABI = [
  { inputs: [{ name: "tokenId", type: "uint256" }], name: "tokenURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }], name: "tokenOfOwnerByIndex", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
]
