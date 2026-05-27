import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { XLAYER_CHAIN } from './utils/contracts'

export const wagmiConfig = getDefaultConfig({
  appName: 'STADIUM — World Cup DeFi',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'stadium-demo-project-id',
  chains: [XLAYER_CHAIN],
  ssr: false,
})
