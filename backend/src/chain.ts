import { createPublicClient, createWalletClient, http, fallback, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from './config'

// Extra public X Layer testnet endpoints — tried in order if the primary fails
const FALLBACK_RPCS = [
  'https://xlayertestrpc.okx.com',
  'https://testrpc.xlayer.tech',
]

export const xlayer = defineChain({
  id: 1952,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: { http: [config.rpcUrl, ...FALLBACK_RPCS] },
    public:  { http: [config.rpcUrl, ...FALLBACK_RPCS] },
  },
})

const transport = fallback([
  http(config.rpcUrl,             { retryCount: 2, retryDelay: 500 }),
  http(FALLBACK_RPCS[0],          { retryCount: 2, retryDelay: 500 }),
  http(FALLBACK_RPCS[1],          { retryCount: 1 }),
])

export const publicClient = createPublicClient({
  chain: xlayer,
  transport,
})

export const account = privateKeyToAccount(config.privateKey)

export const walletClient = createWalletClient({
  account,
  chain: xlayer,
  transport,
})
