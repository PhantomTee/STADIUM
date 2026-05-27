// Contract addresses — update after deployment
// Run Deploy.s.sol → copy values from deployments.json → set in frontend/.env

const ZERO = "0x0000000000000000000000000000000000000000"

export const ADDRESSES = {
  mockUSDC:        import.meta.env.VITE_MOCK_USDC_ADDRESS         || ZERO,
  convictionVault: import.meta.env.VITE_CONVICTION_VAULT_ADDRESS  || ZERO,
  varMarket:       import.meta.env.VITE_VAR_MARKET_ADDRESS        || ZERO,
  matchOracle:     import.meta.env.VITE_MATCH_ORACLE_ADDRESS      || ZERO,
  championPool:    import.meta.env.VITE_CHAMPION_POOL_ADDRESS     || ZERO,
  stadiumNFT:      import.meta.env.VITE_STADIUM_NFT_ADDRESS       || ZERO,
  stadiumHook:     import.meta.env.VITE_STADIUM_HOOK_ADDRESS      || ZERO,
  teamFactory:     import.meta.env.VITE_TEAM_FACTORY_ADDRESS      || ZERO,
  treasury:        import.meta.env.VITE_TREASURY_ADDRESS          || ZERO,
}

// Chain config — sourced from .env so it can be switched without rebuilding
const chainId = parseInt(import.meta.env.VITE_CHAIN_ID ?? '1952', 10)
const rpcUrl  = import.meta.env.VITE_RPC_URL ?? 'https://testrpc.xlayer.tech/terigon'
const isMainnet = chainId === 196

export const XLAYER_CHAIN = {
  id: chainId,
  name: isMainnet ? 'X Layer' : 'X Layer Testnet',
  network: isMainnet ? 'xlayer' : 'xlayer-testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public:  { http: [rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: 'OKX Explorer',
      url: isMainnet
        ? 'https://web3.okx.com/explorer/xlayer'
        : 'https://web3.okx.com/explorer/xlayer-test',
    },
  },
  testnet: !isMainnet,
}

// Keep legacy export so existing page imports don't break
export const XLAYER_TESTNET = XLAYER_CHAIN

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

// teamId matches the uint16 used in contracts (MatchOracle.registerTeam / ConvictionVault)
export const WORLD_CUP_TEAMS = [
  // Group A (ids 1-4)
  { id: 1,  name: "Mexico",         flag: "🇲🇽", group: "A", odds: "18.0"  },
  { id: 2,  name: "South Africa",   flag: "🇿🇦", group: "A", odds: "70.0"  },
  { id: 3,  name: "South Korea",    flag: "🇰🇷", group: "A", odds: "40.0"  },
  { id: 4,  name: "Czechia",        flag: "🇨🇿", group: "A", odds: "80.0"  },
  // Group B (ids 5-8)
  { id: 5,  name: "Canada",         flag: "🇨🇦", group: "B", odds: "45.0"  },
  { id: 6,  name: "Bosnia & Herz.", flag: "🇧🇦", group: "B", odds: "75.0"  },
  { id: 7,  name: "Qatar",          flag: "🇶🇦", group: "B", odds: "120.0" },
  { id: 8,  name: "Switzerland",    flag: "🇨🇭", group: "B", odds: "35.0"  },
  // Group C (ids 9-12)
  { id: 9,  name: "Brazil",         flag: "🇧🇷", group: "C", odds: "6.0"   },
  { id: 10, name: "Morocco",        flag: "🇲🇦", group: "C", odds: "22.0"  },
  { id: 11, name: "Haiti",          flag: "🇭🇹", group: "C", odds: "150.0" },
  { id: 12, name: "Scotland",       flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C", odds: "65.0"  },
  // Group D (ids 13-16)
  { id: 13, name: "USA",            flag: "🇺🇸", group: "D", odds: "20.0"  },
  { id: 14, name: "Paraguay",       flag: "🇵🇾", group: "D", odds: "70.0"  },
  { id: 15, name: "Australia",      flag: "🇦🇺", group: "D", odds: "45.0"  },
  { id: 16, name: "Türkiye",        flag: "🇹🇷", group: "D", odds: "40.0"  },
  // Group E (ids 17-20)
  { id: 17, name: "Germany",        flag: "🇩🇪", group: "E", odds: "7.0"   },
  { id: 18, name: "Curaçao",        flag: "🇨🇼", group: "E", odds: "200.0" },
  { id: 19, name: "Ivory Coast",    flag: "🇨🇮", group: "E", odds: "50.0"  },
  { id: 20, name: "Ecuador",        flag: "🇪🇨", group: "E", odds: "40.0"  },
  // Group F (ids 21-24)
  { id: 21, name: "Netherlands",    flag: "🇳🇱", group: "F", odds: "9.0"   },
  { id: 22, name: "Japan",          flag: "🇯🇵", group: "F", odds: "25.0"  },
  { id: 23, name: "Sweden",         flag: "🇸🇪", group: "F", odds: "30.0"  },
  { id: 24, name: "Tunisia",        flag: "🇹🇳", group: "F", odds: "60.0"  },
  // Group G (ids 25-28)
  { id: 25, name: "Belgium",        flag: "🇧🇪", group: "G", odds: "12.0"  },
  { id: 26, name: "Egypt",          flag: "🇪🇬", group: "G", odds: "60.0"  },
  { id: 27, name: "Iran",           flag: "🇮🇷", group: "G", odds: "75.0"  },
  { id: 28, name: "New Zealand",    flag: "🇳🇿", group: "G", odds: "150.0" },
  // Group H (ids 29-32)
  { id: 29, name: "Spain",          flag: "🇪🇸", group: "H", odds: "7.0"   },
  { id: 30, name: "Cape Verde",     flag: "🇨🇻", group: "H", odds: "90.0"  },
  { id: 31, name: "Saudi Arabia",   flag: "🇸🇦", group: "H", odds: "100.0" },
  { id: 32, name: "Uruguay",        flag: "🇺🇾", group: "H", odds: "15.0"  },
  // Group I (ids 33-36)
  { id: 33, name: "France",         flag: "🇫🇷", group: "I", odds: "5.0"   },
  { id: 34, name: "Senegal",        flag: "🇸🇳", group: "I", odds: "30.0"  },
  { id: 35, name: "Iraq",           flag: "🇮🇶", group: "I", odds: "100.0" },
  { id: 36, name: "Norway",         flag: "🇳🇴", group: "I", odds: "35.0"  },
  // Group J (ids 37-40)
  { id: 37, name: "Argentina",      flag: "🇦🇷", group: "J", odds: "4.5"   },
  { id: 38, name: "Algeria",        flag: "🇩🇿", group: "J", odds: "45.0"  },
  { id: 39, name: "Austria",        flag: "🇦🇹", group: "J", odds: "35.0"  },
  { id: 40, name: "Jordan",         flag: "🇯🇴", group: "J", odds: "100.0" },
  // Group K (ids 41-44)
  { id: 41, name: "Portugal",       flag: "🇵🇹", group: "K", odds: "9.0"   },
  { id: 42, name: "Congo DR",       flag: "🇨🇩", group: "K", odds: "100.0" },
  { id: 43, name: "Uzbekistan",     flag: "🇺🇿", group: "K", odds: "150.0" },
  { id: 44, name: "Colombia",       flag: "🇨🇴", group: "K", odds: "12.0"  },
  // Group L (ids 45-48)
  { id: 45, name: "England",        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L", odds: "6.0"   },
  { id: 46, name: "Croatia",        flag: "🇭🇷", group: "L", odds: "25.0"  },
  { id: 47, name: "Ghana",          flag: "🇬🇭", group: "L", odds: "55.0"  },
  { id: 48, name: "Panama",         flag: "🇵🇦", group: "L", odds: "100.0" },
]

// Convenience lookup by id
export const TEAM_BY_ID = Object.fromEntries(WORLD_CUP_TEAMS.map(t => [t.id, t]))
