import { Router, Request, Response } from 'express'
import { publicClient } from './chain'
import { MATCH_ORACLE_ABI, CONVICTION_VAULT_ABI, CONVICTION_DEPOSITED_EVENT } from './abis'
import { config } from './config'
import { getCachedMatches } from './football'
import { footballRouter } from './footballRoutes'
import { state } from './state'

export const router = Router()

router.use('/football', footballRouter)

// GET /api/matches
// Returns football API cache merged with keeper sync state
router.get('/matches', (_req: Request, res: Response) => {
  const matches = getCachedMatches().map(m => ({
    externalId:  m.id,
    internalId:  state.syncedMatches[String(m.id)] ?? null,
    homeTeam:    m.homeTeam.name,
    awayTeam:    m.awayTeam.name,
    kickoff:     m.utcDate,
    status:      m.status,
    stage:       m.stage,
    group:       m.group,
    score:       m.score,
    synced:      !!state.syncedMatches[String(m.id)],
    settled:     state.settledMatches.has(String(m.id)),
    varOpen:     state.varOpenMatches.has(String(m.id)),
  }))
  res.json({ matches, count: matches.length })
})

// GET /api/matches/:id
// Reads a single match from MatchOracle by internal match ID
router.get('/matches/:id', async (req: Request, res: Response) => {
  try {
    const match = await publicClient.readContract({
      address: config.matchOracleAddress,
      abi:     MATCH_ORACLE_ABI,
      functionName: 'getMatch',
      args:    [BigInt(req.params.id)],
    })
    // bigints → strings for JSON
    res.json(JSON.parse(JSON.stringify(match, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v
    )))
  } catch {
    res.status(404).json({ error: 'Match not found' })
  }
})

// GET /api/leaderboard
// Scans ConvictionDeposited events and returns top 50 depositors
router.get('/leaderboard', async (_req: Request, res: Response) => {
  try {
    const logs = await publicClient.getLogs({
      address:   config.convictionVaultAddress,
      event:     CONVICTION_DEPOSITED_EVENT,
      fromBlock: 0n,
      toBlock:   'latest',
    })

    const totals: Record<string, bigint> = {}
    const byTeam:  Record<string, Record<number, bigint>> = {}

    for (const log of logs) {
      const user   = (log.args.user   as string).toLowerCase()
      const teamId = Number(log.args.teamId as unknown as bigint)
      const amount = log.args.amount as bigint

      totals[user] = (totals[user] ?? 0n) + amount
      if (!byTeam[user]) byTeam[user] = {}
      byTeam[user][teamId] = (byTeam[user][teamId] ?? 0n) + amount
    }

    const leaderboard = Object.entries(totals)
      .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
      .slice(0, 50)
      .map(([address, total], i) => ({
        rank:    i + 1,
        address,
        total:   total.toString(),
        teams:   Object.entries(byTeam[address] ?? {}).map(([id, amt]) => ({
          teamId: Number(id),
          amount: amt.toString(),
        })),
      }))

    res.json({ leaderboard })
  } catch (e) {
    console.error('/api/leaderboard error:', e)
    res.status(500).json({ error: 'Failed to build leaderboard' })
  }
})

// GET /api/stats
// Keeper status + on-chain vault stats
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [closeTime, totalAlive] = await Promise.all([
      publicClient.readContract({
        address: config.convictionVaultAddress,
        abi: CONVICTION_VAULT_ABI,
        functionName: 'convictionCloseTime',
      }),
      publicClient.readContract({
        address: config.convictionVaultAddress,
        abi: CONVICTION_VAULT_ABI,
        functionName: 'totalAliveDeposits',
      }),
    ])
    res.json({
      convictionCloseTime:  closeTime.toString(),
      totalAliveDeposits:   totalAlive.toString(),
      keeper: {
        lastSync:          state.lastSync,
        syncedMatchCount:  Object.keys(state.syncedMatches).length,
        settledMatchCount: state.settledMatches.size,
        eliminatedTeams:   [...state.eliminatedTeams],
      },
    })
  } catch (e) {
    res.status(500).json({ error: 'Stats unavailable' })
  }
})

// POST /api/admin/sync
// Manually trigger a keeper cycle (oracle sync + settlement). Guarded by ADMIN_KEY.
router.post('/admin/sync', async (req: Request, res: Response) => {
  const adminKey = process.env.ADMIN_KEY
  if (adminKey && req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const { runKeeper } = await import('./keeper')
    await runKeeper()
    res.json({ ok: true, message: 'Keeper sync triggered', ts: Date.now() })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Sync failed' })
  }
})
