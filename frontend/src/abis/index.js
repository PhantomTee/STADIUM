export const MockUSDC_ABI = [
  { inputs: [], name: "faucet", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "pure", type: "function" },
  { inputs: [{ name: "addr", type: "address" }], name: "lastFaucetTime", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
]

// ConvictionVault — MasterChef-style accumulator vault (replaces old ConvictionHook)
export const ConvictionVault_ABI = [
  // ── User write functions ──
  {
    inputs: [{ name: "teamId", type: "uint16" }, { name: "amount", type: "uint256" }],
    name: "depositConviction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "claimYield",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "teamId", type: "uint16" }],
    name: "claimEliminatedPosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "teamId", type: "uint16" }],
    name: "claimChampionPrincipal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── View functions ──
  {
    inputs: [{ name: "user", type: "address" }],
    name: "pendingYield",
    outputs: [{ name: "total", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }, { name: "teamId", type: "uint16" }],
    name: "getUserDeposit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }, { name: "teamId", type: "uint16" }],
    name: "getConvictionMultiplier",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "address" }, { name: "", type: "uint16" }],
    name: "deposits",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint16" }],
    name: "teamTotalDeposit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint16" }],
    name: "backerCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAliveDeposits",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint16" }],
    name: "teamActive",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint16" }],
    name: "teamEliminated",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint16" }],
    name: "teamChampion",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "address" }, { name: "", type: "uint16" }],
    name: "principalClaimed",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "address" }],
    name: "claimableYield",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // ── Events ──
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "teamId", type: "uint16" },
      { name: "amount", type: "uint256" },
    ],
    name: "ConvictionDeposited",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "user", type: "address" }, { name: "amount", type: "uint256" }],
    name: "YieldClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "teamId", type: "uint16" },
      { name: "refund", type: "uint256" },
    ],
    name: "EliminationClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "teamId", type: "uint16" },
      { name: "principal", type: "uint256" },
    ],
    name: "ChampionClaimed",
    type: "event",
  },
]

// VARMarket — uint8 outcome constants, pull-based claimVAR
export const VARMarket_ABI = [
  // ── User write functions ──
  {
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "marketType", type: "uint8" },
      { name: "outcome", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    name: "placeBet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }],
    name: "claimVAR",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── View functions ──
  {
    inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }],
    name: "markets",
    outputs: [{
      components: [
        { name: "teamAId", type: "uint16" },
        { name: "teamBId", type: "uint16" },
        { name: "open", type: "bool" },
        { name: "settled", type: "bool" },
        { name: "correctOutcome", type: "uint8" },
        { name: "toWinnersPool", type: "uint256" },
        { name: "totalWeightedWinning", type: "uint256" },
      ],
      name: "",
      type: "tuple",
    }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "marketType", type: "uint8" },
      { name: "outcome", type: "uint8" },
    ],
    name: "outcomePool",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "marketType", type: "uint8" },
      { name: "user", type: "address" },
      { name: "outcome", type: "uint8" },
    ],
    name: "betAmount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "marketType", type: "uint8" },
      { name: "user", type: "address" },
    ],
    name: "claimed",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // ── Events ──
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "matchId", type: "uint256" },
      { name: "marketType", type: "uint8" },
      { indexed: true, name: "user", type: "address" },
      { name: "outcome", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    name: "BetPlaced",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "matchId", type: "uint256" },
      { name: "marketType", type: "uint8" },
      { name: "payout", type: "uint256" },
    ],
    name: "VARClaimed",
    type: "event",
  },
]

// MatchOracle — uint16 teamIds, Match struct with teamAId/teamBId
export const MatchOracle_ABI = [
  // ── Admin write functions ──
  {
    inputs: [{ name: "teamId", type: "uint16" }, { name: "name", type: "string" }],
    name: "registerTeam",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "teamAId", type: "uint16" },
      { name: "teamBId", type: "uint16" },
      { name: "kickoffTime", type: "uint256" },
    ],
    name: "createMatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "matchId", type: "uint256" }],
    name: "openVARWindow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "matchId", type: "uint256" }],
    name: "startMatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "winner", type: "uint8" },
      { name: "firstGoal", type: "uint8" },
      { name: "redCard", type: "bool" },
      { name: "extraTime", type: "bool" },
    ],
    name: "postResult",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "teamId", type: "uint16" }],
    name: "postElimination",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "teamId", type: "uint16" }],
    name: "postChampion",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "_vault", type: "address" }, { name: "_varMarket", type: "address" }, { name: "_champPool", type: "address" }],
    name: "setAddresses",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── View functions ──
  {
    inputs: [{ name: "matchId", type: "uint256" }],
    name: "getMatch",
    outputs: [{
      components: [
        { name: "matchId", type: "uint256" },
        { name: "teamAId", type: "uint16" },
        { name: "teamBId", type: "uint16" },
        { name: "teamAName", type: "string" },
        { name: "teamBName", type: "string" },
        { name: "kickoffTime", type: "uint256" },
        { name: "varOpen", type: "bool" },
        { name: "varClosed", type: "bool" },
        { name: "settled", type: "bool" },
        { name: "winner", type: "uint8" },
        { name: "firstGoal", type: "uint8" },
        { name: "redCard", type: "bool" },
        { name: "extraTime", type: "bool" },
      ],
      name: "",
      type: "tuple",
    }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "teamId", type: "uint16" }],
    name: "getTeam",
    outputs: [{
      components: [
        { name: "teamId", type: "uint16" },
        { name: "name", type: "string" },
        { name: "registered", type: "bool" },
        { name: "eliminated", type: "bool" },
        { name: "champion", type: "bool" },
      ],
      name: "",
      type: "tuple",
    }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMatchCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllMatchIds",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "teamId", type: "uint16" }],
    name: "teamNameOf",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "teamCount",
    outputs: [{ name: "", type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
  // ── Events ──
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { name: "name", type: "string" }],
    name: "TeamRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "matchId", type: "uint256" },
      { name: "teamAId", type: "uint16" },
      { name: "teamBId", type: "uint16" },
      { name: "kickoffTime", type: "uint256" },
    ],
    name: "MatchCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { name: "name", type: "string" }],
    name: "TeamEliminated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "teamId", type: "uint16" }, { name: "name", type: "string" }],
    name: "ChampionAnnounced",
    type: "event",
  },
]

export const ChampionPool_ABI = [
  // ── User write functions ──
  {
    inputs: [{ name: "teamId", type: "uint16" }],
    name: "claimChampionPool",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── View functions ──
  {
    inputs: [],
    name: "totalAccumulated",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "championPoolSnapshot",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalChampionStake",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "championSet",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "championTeamId",
    outputs: [{ name: "", type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "address" }, { name: "", type: "uint16" }],
    name: "champClaimed",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // ── Events ──
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "teamId", type: "uint16" },
      { name: "poolSnapshot", type: "uint256" },
      { name: "totalStake", type: "uint256" },
    ],
    name: "ChampionDeclared",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "teamId", type: "uint16" },
      { name: "share", type: "uint256" },
    ],
    name: "ChampionShareClaimed",
    type: "event",
  },
]

export const StadiumNFT_ABI = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
]
