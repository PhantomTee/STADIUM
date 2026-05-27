import { createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from './config'

export const xlayer = defineChain({
  id: 1952,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: { http: [config.rpcUrl] },
    public:  { http: [config.rpcUrl] },
  },
})

export const publicClient = createPublicClient({
  chain: xlayer,
  transport: http(config.rpcUrl),
})

export const account = privateKeyToAccount(config.privateKey)

export const walletClient = createWalletClient({
  account,
  chain: xlayer,
  transport: http(config.rpcUrl),
})
