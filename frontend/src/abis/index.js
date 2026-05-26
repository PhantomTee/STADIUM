export const MockUSDC_ABI = [
  { inputs: [], name: "faucet", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "pure", type: "function" },
  { inputs: [{ name: "addr", type: "address" }], name: "lastFaucetTime", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
]

export const ConvictionHook_ABI = [
  {
    inputs: [{ name: "team", type: "string" }, { name: "amount", type: "uint256" }],
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
    inputs: [{ name: "user", type: "address" }, { name: "team", type: "string" }],
    name: "convictionDeposit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "accruedYield",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }, { name: "team", type: "string" }],
    name: "hasConviction",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }, { name: "team", type: "string" }],
    name: "getConvictionMultiplier",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "team", type: "string" }],
    name: "totalConvictionLocked",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "team", type: "string" }],
    name: "backerCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAliveConvictionLocked",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "team", type: "string" }],
    name: "teamEliminated",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "team", type: "string" }],
    name: "teamChampion",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAliveTeams",
    outputs: [{ name: "", type: "string[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "team", type: "string" }],
    name: "getTeamBackers",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "user", type: "address" }, { name: "team", type: "string" }, { name: "amount", type: "uint256" }],
    name: "ConvictionDeposited",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "user", type: "address" }, { name: "amount", type: "uint256" }],
    name: "YieldClaimed",
    type: "event",
  },
]

export const VARMarket_ABI = [
  {
    inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }, { name: "outcome", type: "string" }, { name: "amount", type: "uint256" }],
    name: "placeBet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }],
    name: "getMarket",
    outputs: [{
      components: [
        { name: "matchId", type: "uint256" },
        { name: "marketType", type: "uint8" },
        { name: "open", type: "bool" },
        { name: "settled", type: "bool" },
        { name: "correctOutcome", type: "string" },
        { name: "totalYesPool", type: "uint256" },
        { name: "totalNoPool", type: "uint256" },
      ],
      name: "",
      type: "tuple",
    }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }, { name: "user", type: "address" }],
    name: "getUserBet",
    outputs: [{ name: "yes", type: "uint256" }, { name: "no", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "matchId", type: "uint256" }, { name: "marketType", type: "uint8" }, { indexed: true, name: "user", type: "address" }, { name: "outcome", type: "string" }, { name: "amount", type: "uint256" }],
    name: "BetPlaced",
    type: "event",
  },
]

export const MatchOracle_ABI = [
  {
    inputs: [{ name: "matchId", type: "uint256" }],
    name: "getMatch",
    outputs: [{
      components: [
        { name: "matchId", type: "uint256" },
        { name: "teamA", type: "string" },
        { name: "teamB", type: "string" },
        { name: "kickoffTime", type: "uint256" },
        { name: "varOpen", type: "bool" },
        { name: "varClosed", type: "bool" },
        { name: "settled", type: "bool" },
        { name: "winner", type: "string" },
        { name: "firstGoal", type: "string" },
        { name: "redCard", type: "bool" },
        { name: "extraTime", type: "bool" },
        { name: "teamAEliminated", type: "bool" },
        { name: "teamBEliminated", type: "bool" },
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
]

export const ChampionPool_ABI = [
  {
    inputs: [],
    name: "getBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAccumulated",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "distributionComplete",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "champion",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
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
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
]
