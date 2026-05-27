import { publicClient, walletClient } from './chain'
import { MATCH_ORACLE_ABI, CONVICTION_VAULT_ABI } from './abis'
import { config } from './config'
import { fetchMatches, FootballMatch } from './football'
import { resolveTeamId, resolveStage } from './teamMap'
import {
  state,
  markSynced, markSettled, markVarOpen, markTeamEliminated,
  updateLastSync,
} from './state'

// VAR window opens 5 min before kickoff, still considered "open" for 15 min after
const VAR_PRE_MS  = 5  * 60 * 1000
const VAR_POST_MS = 15 * 60 * 1000

// winner uint8: 0 = HOME, 1 = AWAY, 2 = DRAW
function toWinnerU8(w: string | null): number {
  if (w === 'HOME_TEAM') return 0
  if (w === 'AWAY_TEAM') return 1
  return 2
}

function hadExtraTime(m: FootballMatch): boolean {
  return m.score.extraTime?.home != null
}

function nextInternalId(): number {
  const used = Object.values(state.syncedMatches)
  return (used.length > 0 ? Math.max(...used) : 0) + 1
}

async function send(fn: () => Promise<`0x${string}`>): Promise<boolean> {
  try {
    const hash = await fn()
    await publicClient.waitForTransactionReceipt({ hash })
    return true
  } catch (e: any) {
    console.error('[keeper] tx failed:', e?.shortMessage ?? e?.message ?? e)
    return false
  }
}

// ─── Sync new fixtures to MatchOracle ────────────────────────────────────────

export async function syncMatches(): Promise<void> {
  const matches = await fetchMatches()
  if (matches.length === 0) return

  let n = 0
  let nextId = nextInternalId()

  for (const m of matches) {
    const extId = String(m.id)
    if (state.syncedMatches[extId]) continue

    const homeId = resolveTeamId(m.homeTeam.name)
    const awayId = resolveTeamId(m.awayTeam.name)
    if (!homeId || !awayId) {
      console.warn(`[sync] Unknown team(s): ${m.homeTeam.name} / ${m.awayTeam.name}`)
      continue
    }

    const kickoffSec = BigInt(Math.floor(new Date(m.utcDate).getTime() / 1000))
    const stage      = resolveStage(m.stage)
    const internalId = nextId

    const ok = await send(() =>
      walletClient.writeContract({
        address: config.matchOracleAddress,
        abi: MATCH_ORACLE_ABI,
        functionName: 'createOrUpdateMatch',
        args: [BigInt(m.id), BigInt(internalId), homeId, awayId, kickoffSec, stage],
      })
    )

    if (ok) {
      markSynced(extId, internalId)
      nextId++
      n++
      console.log(`[sync] #${internalId} ${m.homeTeam.name} vs ${m.awayTeam.name} (${m.stage})`)
    }
  }

  if (n > 0) console.log(`[sync] ${n} new match(es) synced`)
  updateLastSync()
}

// ─── Open VAR windows around kickoff ─────────────────────────────────────────

export async function openVARWindows(): Promise<void> {
  const matches = await fetchMatches()
  const now     = Date.now()

  for (const m of matches) {
    const extId     = String(m.id)
    const internalId = state.syncedMatches[extId]
    if (!internalId || state.varOpenMatches.has(extId)) continue

    const kickoffMs = new Date(m.utcDate).getTime()
    const delta     = kickoffMs - now  // negative means kickoff has passed

    if (delta <= VAR_PRE_MS && delta >= -VAR_POST_MS) {
      const ok = await send(() =>
        walletClient.writeContract({
          address: config.matchOracleAddress,
          abi: MATCH_ORACLE_ABI,
          functionName: 'openVARWindow',
          args: [BigInt(internalId)],
        })
      )
      if (ok) {
        markVarOpen(extId)
        console.log(`[var] Opened window: match #${internalId}`)
      }
    }
  }
}

// ─── Settle finished matches ──────────────────────────────────────────────────

export async function settleMatches(): Promise<void> {
  const matches = await fetchMatches()

  for (const m of matches) {
    if (m.status !== 'FINISHED') continue

    const extId      = String(m.id)
    const internalId = state.syncedMatches[extId]
    if (!internalId || state.settledMatches.has(extId)) continue

    const homeId = resolveTeamId(m.homeTeam.name)
    const awayId = resolveTeamId(m.awayTeam.name)
    if (!homeId || !awayId) continue

    const winner    = toWinnerU8(m.score.winner)
    const extraTime = hadExtraTime(m)

    const ok = await send(() =>
      walletClient.writeContract({
        address: config.matchOracleAddress,
        abi: MATCH_ORACLE_ABI,
        functionName: 'postResult',
        args: [BigInt(internalId), winner, 2 /* firstGoal: unknown */, false, extraTime],
      })
    )

    if (!ok) continue
    markSettled(extId)
    console.log(`[settle] Match #${internalId}: winner=${winner} extraTime=${extraTime}`)

    // Knockout rounds: auto-eliminate the loser
    if (m.stage !== 'GROUP_STAGE' && m.score.winner && m.score.winner !== 'DRAW') {
      const loserId = m.score.winner === 'HOME_TEAM' ? awayId : homeId
      await eliminateTeam(loserId)
    }
  }
}

async function eliminateTeam(teamId: number): Promise<void> {
  if (state.eliminatedTeams.has(teamId)) return

  const ok = await send(() =>
    walletClient.writeContract({
      address: config.matchOracleAddress,
      abi: MATCH_ORACLE_ABI,
      functionName: 'postElimination',
      args: [teamId],
    })
  )

  if (ok) {
    markTeamEliminated(teamId)
    console.log(`[eliminate] Team #${teamId} eliminated`)
  }
}

// ─── Auto-set CONVICTION close time to first match kickoff ───────────────────

export async function autoSetConvictionCloseTime(): Promise<void> {
  const matches = await fetchMatches()

  const upcoming = matches
    .filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED')
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())

  if (upcoming.length === 0) return

  const firstKickoff = BigInt(Math.floor(new Date(upcoming[0].utcDate).getTime() / 1000))

  const current = await publicClient.readContract({
    address: config.convictionVaultAddress,
    abi: CONVICTION_VAULT_ABI,
    functionName: 'convictionCloseTime',
  })

  // Only auto-set if it hasn't been configured yet
  if (current !== 0n) {
    console.log(`[conviction] Close time already set: ${new Date(Number(current) * 1000).toISOString()}`)
    return
  }

  const ok = await send(() =>
    walletClient.writeContract({
      address: config.convictionVaultAddress,
      abi: CONVICTION_VAULT_ABI,
      functionName: 'setConvictionCloseTime',
      args: [firstKickoff],
    })
  )

  if (ok) {
    console.log(`[conviction] Close time → ${new Date(Number(firstKickoff) * 1000).toISOString()}`)
  }
}

// ─── Main keeper tick ─────────────────────────────────────────────────────────

export async function runKeeper(): Promise<void> {
  console.log('[keeper] Tick', new Date().toISOString())
  try {
    await syncMatches()
    await openVARWindows()
    await settleMatches()
  } catch (e) {
    console.error('[keeper] Unhandled error:', e)
  }
}
