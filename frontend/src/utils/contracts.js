// Contract addresses — update after deployment
// Copy values from deployments.json after running Deploy.s.sol

export const ADDRESSES = {
  mockUSDC: import.meta.env.VITE_USDC_ADDRESS || "0x0000000000000000000000000000000000000000",
  convictionHook: import.meta.env.VITE_CONVICTION_HOOK_ADDRESS || "0x0000000000000000000000000000000000000000",
  varMarket: import.meta.env.VITE_VAR_MARKET_ADDRESS || "0x0000000000000000000000000000000000000000",
  matchOracle: import.meta.env.VITE_MATCH_ORACLE_ADDRESS || "0x0000000000000000000000000000000000000000",
  championPool: import.meta.env.VITE_CHAMPION_POOL_ADDRESS || "0x0000000000000000000000000000000000000000",
  stadiumNFT: import.meta.env.VITE_STADIUM_NFT_ADDRESS || "0x0000000000000000000000000000000000000000",
}

export const XLAYER_TESTNET = {
  id: 195,
  name: "X Layer Testnet",
  network: "xlayer-testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testrpc.xlayer.tech"] },
    public: { http: ["https://testrpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: { name: "OKX Explorer", url: "https://web3.okx.com/explorer/xlayer-test" },
  },
  testnet: true,
}

export const USDC_DECIMALS = 6
export const USDC_MULTIPLIER = BigInt(10 ** USDC_DECIMALS)

export function formatUSDC(raw) {
  if (!raw) return "0.00"
  const n = Number(raw) / 1e6
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function parseUSDC(amount) {
  return BigInt(Math.floor(Number(amount) * 1e6))
}

export const WORLD_CUP_TEAMS = [
  // Group A
  { name: "Mexico",              flag: "🇲🇽", group: "A", odds: "18.0" },
  { name: "South Africa",        flag: "🇿🇦", group: "A", odds: "70.0" },
  { name: "South Korea",         flag: "🇰🇷", group: "A", odds: "40.0" },
  { name: "Czechia",             flag: "🇨🇿", group: "A", odds: "80.0" },
  // Group B
  { name: "Canada",              flag: "🇨🇦", group: "B", odds: "45.0" },
  { name: "Bosnia & Herz.",      flag: "🇧🇦", group: "B", odds: "75.0" },
  { name: "Qatar",               flag: "🇶🇦", group: "B", odds: "120.0" },
  { name: "Switzerland",         flag: "🇨🇭", group: "B", odds: "35.0" },
  // Group C
  { name: "Brazil",              flag: "🇧🇷", group: "C", odds: "6.0"  },
  { name: "Morocco",             flag: "🇲🇦", group: "C", odds: "22.0" },
  { name: "Haiti",               flag: "🇭🇹", group: "C", odds: "150.0" },
  { name: "Scotland",            flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C", odds: "65.0" },
  // Group D
  { name: "USA",                 flag: "🇺🇸", group: "D", odds: "20.0" },
  { name: "Paraguay",            flag: "🇵🇾", group: "D", odds: "70.0" },
  { name: "Australia",           flag: "🇦🇺", group: "D", odds: "45.0" },
  { name: "Türkiye",             flag: "🇹🇷", group: "D", odds: "40.0" },
  // Group E
  { name: "Germany",             flag: "🇩🇪", group: "E", odds: "7.0"  },
  { name: "Curaçao",             flag: "🇨🇼", group: "E", odds: "200.0" },
  { name: "Ivory Coast",         flag: "🇨🇮", group: "E", odds: "50.0" },
  { name: "Ecuador",             flag: "🇪🇨", group: "E", odds: "40.0" },
  // Group F
  { name: "Netherlands",         flag: "🇳🇱", group: "F", odds: "9.0"  },
  { name: "Japan",               flag: "🇯🇵", group: "F", odds: "25.0" },
  { name: "Sweden",              flag: "🇸🇪", group: "F", odds: "30.0" },
  { name: "Tunisia",             flag: "🇹🇳", group: "F", odds: "60.0" },
  // Group G
  { name: "Belgium",             flag: "🇧🇪", group: "G", odds: "12.0" },
  { name: "Egypt",               flag: "🇪🇬", group: "G", odds: "60.0" },
  { name: "Iran",                flag: "🇮🇷", group: "G", odds: "75.0" },
  { name: "New Zealand",         flag: "🇳🇿", group: "G", odds: "150.0" },
  // Group H
  { name: "Spain",               flag: "🇪🇸", group: "H", odds: "7.0"  },
  { name: "Cape Verde",          flag: "🇨🇻", group: "H", odds: "90.0" },
  { name: "Saudi Arabia",        flag: "🇸🇦", group: "H", odds: "100.0" },
  { name: "Uruguay",             flag: "🇺🇾", group: "H", odds: "15.0" },
  // Group I
  { name: "France",              flag: "🇫🇷", group: "I", odds: "5.0"  },
  { name: "Senegal",             flag: "🇸🇳", group: "I", odds: "30.0" },
  { name: "Iraq",                flag: "🇮🇶", group: "I", odds: "100.0" },
  { name: "Norway",              flag: "🇳🇴", group: "I", odds: "35.0" },
  // Group J
  { name: "Argentina",           flag: "🇦🇷", group: "J", odds: "4.5"  },
  { name: "Algeria",             flag: "🇩🇿", group: "J", odds: "45.0" },
  { name: "Austria",             flag: "🇦🇹", group: "J", odds: "35.0" },
  { name: "Jordan",              flag: "🇯🇴", group: "J", odds: "100.0" },
  // Group K
  { name: "Portugal",            flag: "🇵🇹", group: "K", odds: "9.0"  },
  { name: "DR Congo",            flag: "🇨🇩", group: "K", odds: "100.0" },
  { name: "Uzbekistan",          flag: "🇺🇿", group: "K", odds: "150.0" },
  { name: "Colombia",            flag: "🇨🇴", group: "K", odds: "12.0" },
  // Group L
  { name: "England",             flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L", odds: "6.0"  },
  { name: "Croatia",             flag: "🇭🇷", group: "L", odds: "25.0" },
  { name: "Ghana",               flag: "🇬🇭", group: "L", odds: "55.0" },
  { name: "Panama",              flag: "🇵🇦", group: "L", odds: "100.0" },
]
