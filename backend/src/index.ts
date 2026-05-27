import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { loadState } from './state'
import { runKeeper, autoSetConvictionCloseTime } from './keeper'
import { router } from './api'
import { config } from './config'

loadState()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))
app.use('/api', router)

app.listen(config.port, () => {
  console.log(`Stadium backend on port ${config.port}`)
  console.log(`  Oracle:  ${config.matchOracleAddress}`)
  console.log(`  Vault:   ${config.convictionVaultAddress}`)
  console.log(`  Chain:   ${config.rpcUrl}`)
})

// On startup: auto-set conviction close time, then run keeper immediately
autoSetConvictionCloseTime()
  .then(() => runKeeper())
  .catch(console.error)

// Keeper runs every 5 minutes
cron.schedule('*/5 * * * *', () => {
  runKeeper().catch(console.error)
})
