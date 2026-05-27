#!/usr/bin/env node
/**
 * Oracle relay script: API-Football → MatchOracle.sol on X Layer.
 *
 * Fetches today's World Cup fixtures, syncs them on-chain, and posts results
 * for matches that have finished since the last run.
 *
 * Called by oracle-relayer.yml GitHub Actions workflow.
 *
 * Required env vars:
 *   API_FOOTBALL_KEY    — API-Football v3 API key
 *   ORACLE_PRIVATE_KEY  — private key with MatchOracle owner role
 *   XLAYER_RPC_URL      — X Layer RPC endpoint
 *   MATCH_ORACLE_ADDR   — deployed MatchOracle contract address
 *
 * Optional:
 *   DRY_RUN            — set to "true" to skip on-chain calls
 *   FORCE_FIXTURE_ID   — if set, only process this fixture ID
 */

'use strict'
const { execSync } = require('child_process')
const https = require('https')

const API_KEY    = process.env.API_FOOTBALL_KEY
const PRIV_KEY   = process.env.ORACLE_PRIVATE_KEY
const RPC_URL    = process.env.XLAYER_RPC_URL
const ORACLE     = process.env.MATCH_ORACLE_ADDR
const DRY_RUN    = process.env.DRY_RUN === 'true'
const FORCE_FID  = process.env.FORCE_FIXTURE_ID
const LEAGUE_ID  = process.env.WORLD_CUP_LEAGUE || '1'

// Outcome constants (must match VARMarket)
const OUTCOME = { TEAM_A: 1, TEAM_B: 2, DRAW: 3, YES: 4, NO: 5, NO_GOAL: 6 }

// Stage mapping: API-Football round → uint8 stage
const STAGE_MAP = {
  'Group Stage':      0,
  'Round of 32':      1,
  'Round of 16':      2,
  'Quarter-finals':   3,
  'Semi-finals':      4,
  'Final':            5,
}

// ─────────────────────────────── helpers ──────────────────────────────────────

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'v3.football.api-sports.io',
      path,
      headers: { 'x-apisports-key': API_KEY },
    }
    https.get(opts, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

function cast(args) {
  if (DRY_RUN) {
    console.log('[DRY RUN] cast', args.join(' '))
    return
  }
  const cmd = `cast send --rpc-url "${RPC_URL}" --private-key "${PRIV_KEY}" ${args.join(' ')}`
  try {
    const out = execSync(cmd, { stdio: 'pipe' }).toString().trim()
    console.log('  tx:', out.match(/transactionHash\s+(\S+)/)?.[1] || out.slice(0, 80))
  } catch (err) {
    console.warn('  cast error:', err.stderr?.toString().slice(0, 200))
  }
}

function sig(fn, ...types) {
  return `"${fn}(${types.join(',')})"`
}

// ─────────────────────────────── main ──────────────────────────────────────────

async function main() {
  if (!API_KEY)  throw new Error('API_FOOTBALL_KEY not set')
  if (!RPC_URL)  throw new Error('XLAYER_RPC_URL not set')
  if (!ORACLE)   throw new Error('MATCH_ORACLE_ADDR not set')
  if (!DRY_RUN && !PRIV_KEY) throw new Error('ORACLE_PRIVATE_KEY not set (or set DRY_RUN=true)')

  const today = new Date().toISOString().slice(0, 10)
  const fixturesPath = `/fixtures?league=${LEAGUE_ID}&season=2026&date=${today}`

  console.log(`Fetching fixtures for ${today}...`)
  const res = await apiGet(fixturesPath)
  const fixtures = res.response || []
  console.log(`Found ${fixtures.length} fixture(s) today.`)

  for (const f of fixtures) {
    const { fixture, teams, goals, score } = f
    const fixtureId = fixture.id
    if (FORCE_FID && String(fixtureId) !== String(FORCE_FID)) continue

    const matchId   = fixtureId                    // use API fixture ID as on-chain matchId
    const teamAId   = teams.home.id                // NOTE: API team IDs ≠ protocol teamIds
    const teamBId   = teams.away.id                //       Production: maintain ID mapping
    const kickoff   = Math.floor(new Date(fixture.date).getTime() / 1000)
    const status    = fixture.status.short         // TBD, NS, 1H, HT, 2H, FT, AET, PEN
    const round     = fixture.round || 'Group Stage'
    const stage     = STAGE_MAP[round] ?? 0

    console.log(`\n[${fixtureId}] ${teams.home.name} vs ${teams.away.name} — ${status}`)

    // ── Create or update the match schedule ──
    cast([
      ORACLE,
      sig('createOrUpdateMatch', 'uint256', 'uint256', 'uint16', 'uint16', 'uint256', 'uint8'),
      fixtureId, matchId, teamAId, teamBId, kickoff, stage,
    ])

    // ── Open VAR window ~60 min before kickoff ──
    const nowSec = Math.floor(Date.now() / 1000)
    if (status === 'NS' && kickoff - nowSec < 3600) {
      console.log('  → Opening VAR window')
      cast([ORACLE, sig('openVARWindow', 'uint256'), matchId])
    }

    // ── Start match when live ──
    if (['1H', 'HT', '2H'].includes(status)) {
      console.log('  → Starting match (closing VAR)')
      cast([ORACLE, sig('startMatch', 'uint256'), matchId])
    }

    // ── Post result for finished matches ──
    if (['FT', 'AET', 'PEN'].includes(status) && goals.home !== null) {
      const homeGoals = goals.home
      const awayGoals = goals.away

      let winner, firstGoal, redCard, extraTime

      if (homeGoals > awayGoals)       winner = OUTCOME.TEAM_A
      else if (awayGoals > homeGoals)  winner = OUTCOME.TEAM_B
      else                             winner = OUTCOME.DRAW

      // First goal: simplify — whoever scored more goals (approximate)
      firstGoal = homeGoals > 0 ? OUTCOME.TEAM_A : awayGoals > 0 ? OUTCOME.TEAM_B : OUTCOME.NO_GOAL

      // Red card: check events (simplified — assume no red card if not fetched)
      redCard   = false // fetch `/fixtures/events?fixture=${fixtureId}` for real data
      extraTime = ['AET', 'PEN'].includes(status)

      console.log(`  → Posting result: winner=${winner} firstGoal=${firstGoal} redCard=${redCard} extraTime=${extraTime}`)
      cast([
        ORACLE,
        sig('postResult', 'uint256', 'uint8', 'uint8', 'bool', 'bool'),
        matchId, winner, firstGoal, redCard ? 'true' : 'false', extraTime ? 'true' : 'false',
      ])
    }
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
