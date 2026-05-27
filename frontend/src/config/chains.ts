/**
 * X Layer chain definitions for STADIUM.
 *
 * Chain IDs:
 *   - Official X Layer mainnet:  196
 *   - Official X Layer testnet:  1952 (per testnet docs)
 *   - Some chain lists show 195 — use VITE_CHAIN_ID in .env to override.
 *
 * Set in frontend/.env:
 *   VITE_CHAIN_ID=1952
 *   VITE_RPC_URL=https://testrpc.xlayer.tech/terigon
 */

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
} as const

export const ACTIVE_CHAIN_ID = chainId
