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
  { name: "Argentina", flag: "🇦🇷", group: "A", odds: "4.5" },
  { name: "France", flag: "🇫🇷", group: "D", odds: "5.0" },
  { name: "Brazil", flag: "🇧🇷", group: "G", odds: "5.5" },
  { name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "B", odds: "6.0" },
  { name: "Germany", flag: "🇩🇪", group: "E", odds: "8.0" },
  { name: "Spain", flag: "🇪🇸", group: "E", odds: "7.0" },
  { name: "Portugal", flag: "🇵🇹", group: "H", odds: "8.0" },
  { name: "Netherlands", flag: "🇳🇱", group: "A", odds: "9.0" },
  { name: "Belgium", flag: "🇧🇪", group: "F", odds: "10.0" },
  { name: "Croatia", flag: "🇭🇷", group: "F", odds: "20.0" },
  { name: "Uruguay", flag: "🇺🇾", group: "H", odds: "18.0" },
  { name: "Mexico", flag: "🇲🇽", group: "C", odds: "25.0" },
  { name: "USA", flag: "🇺🇸", group: "B", odds: "15.0" },
  { name: "Canada", flag: "🇨🇦", group: "A", odds: "40.0" },
  { name: "Morocco", flag: "🇲🇦", group: "F", odds: "22.0" },
  { name: "Senegal", flag: "🇸🇳", group: "A", odds: "35.0" },
  { name: "Japan", flag: "🇯🇵", group: "E", odds: "28.0" },
  { name: "South Korea", flag: "🇰🇷", group: "H", odds: "45.0" },
  { name: "Australia", flag: "🇦🇺", group: "D", odds: "50.0" },
  { name: "Switzerland", flag: "🇨🇭", group: "G", odds: "35.0" },
  { name: "Denmark", flag: "🇩🇰", group: "C", odds: "30.0" },
  { name: "Poland", flag: "🇵🇱", group: "C", odds: "35.0" },
  { name: "Ecuador", flag: "🇪🇨", group: "A", odds: "60.0" },
  { name: "Cameroon", flag: "🇨🇲", group: "G", odds: "80.0" },
  { name: "Ghana", flag: "🇬🇭", group: "H", odds: "80.0" },
  { name: "Serbia", flag: "🇷🇸", group: "G", odds: "50.0" },
  { name: "Wales", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", group: "B", odds: "60.0" },
  { name: "Qatar", flag: "🇶🇦", group: "A", odds: "100.0" },
  { name: "Saudi Arabia", flag: "🇸🇦", group: "C", odds: "100.0" },
  { name: "Iran", flag: "🇮🇷", group: "B", odds: "100.0" },
  { name: "Tunisia", flag: "🇹🇳", group: "D", odds: "100.0" },
  { name: "Costa Rica", flag: "🇨🇷", group: "E", odds: "100.0" },
]
