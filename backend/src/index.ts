import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { loadState } from './state'
import { runKeeper, autoSetConvictionCloseTime } from './keeper'
import { router } from './api'
import { config } from './config'
import { initDb, setupSchema } from './db'
import { runIndexer } from './indexer'

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

// Event indexer — only runs when DATABASE_URL is set
if (config.databaseUrl) {
  initDb(config.databaseUrl)
  setupSchema()
    .then(() => {
      console.log('[indexer] starting initial catch-up…')
      return runIndexer()
    })
    .catch(err => console.error('[indexer] startup failed:', err))

  // Re-index every 15 seconds to stay current
  setInterval(() => runIndexer().catch(console.error), 15_000)
} else {
  console.log('[indexer] DATABASE_URL not set — persistent event storage disabled')
}
