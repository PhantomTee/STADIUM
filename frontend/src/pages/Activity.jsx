import React, { useState, useEffect, useCallback, useRef } from 'react'
import { usePublicClient, useWatchContractEvent } from 'wagmi'
import { ADDRESSES, TEAM_BY_ID, formatUSDC } from '../utils/contracts'
import { ConvictionVault_ABI, VARMarket_ABI, StadiumHook_ABI } from '../abis'
import { API_BASE } from '../services/footballData'

const ZERO            = '0x0000000000000000000000000000000000000000'
// Uniswap V4 PoolManager / hook callbacks during pool init have near-zero "user" addresses
// (e.g. precompile addresses 0x01–0x25). Filter these out — they aren't real user activity.
const MIN_USER_ADDR   = 0x10000n   // anything below this is a system/precompile address
const BLOCK_WINDOW    = 2000n
const AUTO_REFRESH_MS = 30_000
const LS_KEY          = 'stadium-activity-v1'

// ── localStorage cache (BigInt-safe) ─────────────────────────────────────────

function eventsToJSON(events) {
  return JSON.stringify(events, (_, v) => typeof v === 'bigint' ? `__bi:${v}` : v)
}
function eventsFromJSON(str) {
  return JSON.parse(str, (_, v) =>
    typeof v === 'string' && v.startsWith('__bi:') ? BigInt(v.slice(5)) : v
  )
}
function loadCache() {
  try { return eventsFromJSON(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}
function saveCache(events) {
  try { localStorage.setItem(LS_KEY, eventsToJSON(events)) } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function absBig(n) {
  if (typeof n !== 'bigint') return 0n
  return n < 0n ? -n : n
}

function normaliseEvent(raw, type) {
  return {
    key:             `${type}-${raw.blockNumber ?? 0}-${raw.transactionHash ?? ''}-${raw.logIndex ?? 0}`,
    type,
    blockNumber:     raw.blockNumber     ?? 0n,
    blockTimestamp:  Math.floor(Date.now() / 1000),
    transactionHash: raw.transactionHash ?? '',
    args:            raw.args ?? {},
  }
}

function formatEventTime(blockTimestamp) {
  if (!blockTimestamp) return null
  const date = new Date(blockTimestamp * 1000)
  const now  = Date.now()
  const diff = now - date.getTime()
  if (diff < 60_000)    return 'just now'
  if (diff < 3600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function normaliseApiRow(row) {
  const args = {}
  if (row.user_addr)      args.user    = row.user_addr
  if (row.team_id  != null) args.teamId  = BigInt(row.team_id)
  if (row.amount   != null) args.amount  = BigInt(row.amount)
  if (row.amount0  != null) args.amount0 = BigInt(row.amount0)
  if (row.amount1  != null) args.amount1 = BigInt(row.amount1)
  if (row.match_id != null) args.matchId = BigInt(row.match_id)
  return {
    key:             `${row.event_type}-${row.block_number}-${row.tx_hash}-${row.log_index}`,
    type:            row.event_type,
    blockNumber:     BigInt(row.block_number),
    blockTimestamp:  row.block_timestamp ? Number(row.block_timestamp) : null,
    transactionHash: row.tx_hash,
    args,
  }
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <div className="bg-stadium-card px-4 py-3 flex items-center gap-3 animate-pulse">
      <div className="h-5 w-20 bg-stadium-border rounded" />
      <div className="h-4 w-24 bg-stadium-border rounded" />
      <div className="flex-1 h-4 bg-stadium-border rounded" />
      <div className="h-3 w-16 bg-stadium-border rounded ml-auto" />
    </div>
  )
}

/* ── Event row ────────────────────────────────────────────────────────────── */
const TYPE_CONFIG = {
  conviction: { label: 'CONVICTION', color: 'bg-stadium-green/10 text-stadium-green border-stadium-green/20' },
  bet:        { label: 'VAR BET',    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20'               },
  swap:       { label: 'SWAP',       color: 'bg-stadium-gold/10 text-stadium-gold border-stadium-gold/20'   },
}

function EventRow({ event }) {
  const cfg  = TYPE_CONFIG[event.type] || TYPE_CONFIG.conviction
  const txUrl = `https://web3.okx.com/explorer/xlayer-test/tx/${event.transactionHash}`
  const args  = event.args || {}

  let body = null

  if (event.type === 'conviction') {
    const team = TEAM_BY_ID[Number(args.teamId)]
    body = (
      <>
        <span className="font-mono text-xs text-stadium-muted">{shortAddr(args.user)}</span>
        <span className="text-sm">{team ? `${team.flag} ${team.name}` : `Team #${args.teamId}`}</span>
        <span className="font-mono text-sm font-bold text-stadium-green">${formatUSDC(args.amount ?? 0n)}</span>
      </>
    )
  } else if (event.type === 'bet') {
    body = (
      <>
        <span className="font-mono text-xs text-stadium-muted">{shortAddr(args.user)}</span>
        <span className="font-mono text-sm font-bold text-stadium-text">${formatUSDC(args.amount ?? 0n)}</span>
        <span className="text-xs text-stadium-muted">match #{args.matchId?.toString() ?? '?'}</span>
      </>
    )
  } else if (event.type === 'swap') {
    const team   = TEAM_BY_ID[Number(args.teamId)]
    const a0     = absBig(args.amount0)
    const a1     = absBig(args.amount1)
    const usdcVol = (a0 > 0n && a1 > 0n) ? (a0 < a1 ? a0 : a1) : (a0 || a1)
    body = (
      <>
        <span className="font-mono text-xs text-stadium-muted">{shortAddr(args.user)}</span>
        <span className="text-sm">{team ? `${team.flag} ${team.name}` : `Team #${args.teamId}`}</span>
        <span className="font-mono text-sm font-bold text-stadium-gold">${formatUSDC(usdcVol)}</span>
      </>
    )
  }

  return (
    <a
      href={txUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-stadium-card px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-stadium-dark transition-colors"
    >
      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-widest border ${cfg.color}`}>
        {cfg.label}
      </span>
      {body}
      <span className="font-mono text-xs text-stadium-text/60 ml-auto text-right whitespace-nowrap">
        {formatEventTime(event.blockTimestamp) ?? `#${event.blockNumber.toString()}`}
      </span>
    </a>
  )
}

/* ── Filter bar ───────────────────────────────────────────────────────────── */
const FILTER_OPTIONS = [
  { key: 'all',        label: 'All'        },
  { key: 'swap',       label: 'Swaps'      },
  { key: 'conviction', label: 'Conviction' },
  { key: 'bet',        label: 'VAR Bets'   },
]

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function Activity() {
  const publicClient = usePublicClient()

  // Initialise from localStorage — returning users see history instantly
  const [events,       setEvents]       = useState(() => loadCache())
  const [loading,      setLoading]      = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [lastRefresh,  setLastRefresh]  = useState(null)
  const [filter,       setFilter]       = useState('all')

  const highWaterRef = useRef(0n)

  // Update state + write through to localStorage
  const commitEvents = useCallback((evs) => {
    setEvents(evs)
    saveCache(evs)
  }, [])

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setHistoryError(null)

    // ── Try backend API first (full history from indexed DB) ─────────────────
    try {
      const res = await fetch(`${API_BASE}/api/events?limit=100`)
      if (res.ok) {
        const { events: rows } = await res.json()
        if (Array.isArray(rows)) {
          commitEvents(rows.map(normaliseApiRow))
          setLastRefresh(Date.now())
          setLoading(false)
          return
        }
      }
    } catch {
      // API unreachable — fall through to on-chain
    }

    // ── Fall back: on-chain fetch (last 2000 blocks) ──────────────────────────
    if (!publicClient) { setLoading(false); return }
    try {
      const currentBlock = await publicClient.getBlockNumber()
      highWaterRef.current = currentBlock
      const fromBlock = currentBlock > BLOCK_WINDOW ? currentBlock - BLOCK_WINDOW : 0n

      const [convictionLogs, betLogs, swapLogs] = await Promise.all([
        ADDRESSES.convictionVault !== ZERO
          ? publicClient.getContractEvents({
              address: ADDRESSES.convictionVault, abi: ConvictionVault_ABI,
              eventName: 'ConvictionDeposited', fromBlock, toBlock: currentBlock,
            }).catch(e => { console.warn('conviction fetch failed', e); return [] })
          : [],
        ADDRESSES.varMarket !== ZERO
          ? publicClient.getContractEvents({
              address: ADDRESSES.varMarket, abi: VARMarket_ABI,
              eventName: 'BetPlaced', fromBlock, toBlock: currentBlock,
            }).catch(e => { console.warn('bet fetch failed', e); return [] })
          : [],
        ADDRESSES.stadiumHook !== ZERO
          ? publicClient.getContractEvents({
              address: ADDRESSES.stadiumHook, abi: StadiumHook_ABI,
              eventName: 'TeamSwap', fromBlock, toBlock: currentBlock,
            }).catch(e => { console.warn('swap fetch failed', e); return [] })
          : [],
      ])

      const fresh = [
        ...convictionLogs.map(e => normaliseEvent(e, 'conviction')),
        ...betLogs.map(e => normaliseEvent(e, 'bet')),
        ...swapLogs.map(e => normaliseEvent(e, 'swap')),
      ]
      fresh.sort((a, b) =>
        b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0
      )

      if (fresh.length > 0) {
        // Merge fresh on-chain events with whatever is already cached
        setEvents(prev => {
          const keys = new Set(fresh.map(e => e.key))
          const merged = [...fresh, ...prev.filter(e => !keys.has(e.key))].slice(0, 100)
          saveCache(merged)
          return merged
        })
      }
      setLastRefresh(Date.now())
    } catch (err) {
      console.warn('Activity: on-chain fetch failed', err)
      setHistoryError(err?.message || 'RPC error')
    } finally {
      setLoading(false)
    }
  }, [publicClient, commitEvents])

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchHistory()
    const id = setInterval(fetchHistory, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchHistory])

  // Prepend live events — write through to localStorage
  const prependEvent = useCallback((raw, type) => {
    const ev = normaliseEvent(raw, type)
    setEvents(prev => {
      if (prev.some(e => e.key === ev.key)) return prev
      const next = [ev, ...prev].slice(0, 100)
      saveCache(next)
      return next
    })
  }, [])

  // Live watchers
  useWatchContractEvent({
    address:         ADDRESSES.convictionVault,
    abi:             ConvictionVault_ABI,
    eventName:       'ConvictionDeposited',
    enabled:         ADDRESSES.convictionVault !== ZERO,
    pollingInterval: 8_000,
    onLogs:  logs => logs.forEach(log => prependEvent(log, 'conviction')),
    onError: err  => console.warn('conviction watch error', err),
  })
  useWatchContractEvent({
    address:         ADDRESSES.varMarket,
    abi:             VARMarket_ABI,
    eventName:       'BetPlaced',
    enabled:         ADDRESSES.varMarket !== ZERO,
    pollingInterval: 8_000,
    onLogs:  logs => logs.forEach(log => prependEvent(log, 'bet')),
    onError: err  => console.warn('bet watch error', err),
  })
  useWatchContractEvent({
    address:         ADDRESSES.stadiumHook,
    abi:             StadiumHook_ABI,
    eventName:       'TeamSwap',
    enabled:         ADDRESSES.stadiumHook !== ZERO,
    pollingInterval: 8_000,
    onLogs:  logs => logs.forEach(log => prependEvent(log, 'swap')),
    onError: err  => console.warn('swap watch error', err),
  })

  // Strip pool-init artifacts before display and counting
  const realEvents = events.filter(e => {
    const user = e.args?.user
    if (!user) return true   // no user field — keep (bet events etc.)
    try { return BigInt(user) >= MIN_USER_ADDR } catch { return true }
  })
  const visible = filter === 'all' ? realEvents : realEvents.filter(e => e.type === filter)
  const counts  = { swap: 0, conviction: 0, bet: 0 }
  realEvents.forEach(e => { if (counts[e.type] !== undefined) counts[e.type]++ })

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="section-title">Activity</h1>
            <p className="section-subtitle">Live on-chain events — swaps, conviction deposits, and VAR bets</p>
          </div>
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="text-xs font-mono text-stadium-green hover:underline uppercase tracking-widest disabled:opacity-40"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {lastRefresh && !loading && (
          <div className="text-xs text-stadium-border font-mono mt-2">
            Last updated {new Date(lastRefresh).toLocaleTimeString()} · auto-refreshes every 30s
          </div>
        )}
      </div>

      {historyError && (
        <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs font-mono text-red-400">
          Fetch error: {historyError} — showing cached events
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px bg-stadium-border">
        {[
          { label: 'Swaps',      count: counts.swap,       color: 'text-stadium-gold'  },
          { label: 'Conviction', count: counts.conviction,  color: 'text-stadium-green' },
          { label: 'VAR Bets',   count: counts.bet,         color: 'text-blue-400'      },
        ].map(s => (
          <div key={s.label} className="bg-stadium-card p-4 text-center">
            <div className={`font-black text-2xl font-mono ${s.color}`}>{s.count}</div>
            <div className="text-xs text-stadium-muted font-mono uppercase tracking-widest mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-px bg-stadium-border">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              filter === opt.key
                ? 'bg-stadium-green/10 text-stadium-green'
                : 'bg-stadium-card text-stadium-muted hover:text-stadium-text'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Event feed */}
      {loading && events.length === 0 ? (
        <div className="space-y-px bg-stadium-border">
          {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-stadium-card border border-stadium-border px-4 py-12 text-center space-y-3">
          <div className="text-stadium-muted font-mono text-sm">
            No {filter === 'all' ? '' : filter + ' '}activity recorded yet
          </div>
          <div className="text-stadium-border font-mono text-xs">
            Events appear here live as users swap, deposit conviction, and place VAR bets
          </div>
        </div>
      ) : (
        <div className="space-y-px bg-stadium-border">
          {visible.map(ev => <EventRow key={ev.key} event={ev} />)}
        </div>
      )}
    </div>
  )
}
