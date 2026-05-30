import React, { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useWatchContractEvent } from 'wagmi'
import { ADDRESSES, TEAM_BY_ID, formatUSDC } from '../utils/contracts'
import { ConvictionVault_ABI, VARMarket_ABI, StadiumHook_ABI } from '../abis'

function shortAddr(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function normaliseEvent(raw, type) {
  return {
    key: `${type}-${raw.blockNumber}-${raw.transactionHash}-${raw.logIndex ?? 0}`,
    type,
    blockNumber: raw.blockNumber ?? 0n,
    transactionHash: raw.transactionHash,
    args: raw.args,
  }
}

function SkeletonRow() {
  return (
    <div className="bg-stadium-card px-4 py-3 flex items-center gap-3 animate-pulse">
      <div className="h-5 w-20 bg-stadium-border" />
      <div className="h-4 w-24 bg-stadium-border" />
      <div className="flex-1 h-4 bg-stadium-border" />
      <div className="h-3 w-16 bg-stadium-border ml-auto" />
    </div>
  )
}

const TYPE_CONFIG = {
  conviction: { label: 'CONVICTION', color: 'bg-stadium-green/10 text-stadium-green border-stadium-green/20' },
  bet:        { label: 'VAR BET',    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20'               },
  swap:       { label: 'SWAP',       color: 'bg-stadium-gold/10 text-stadium-gold border-stadium-gold/20'   },
}

function EventRow({ event }) {
  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.conviction
  const txUrl = `https://web3.okx.com/explorer/xlayer-test/tx/${event.transactionHash}`

  let body = null

  if (event.type === 'conviction') {
    const { user, teamId, amount } = event.args || {}
    const team = TEAM_BY_ID[Number(teamId)]
    body = (
      <>
        <span className="font-mono text-xs text-stadium-muted">{shortAddr(user)}</span>
        <span className="text-sm">{team ? `${team.flag} ${team.name}` : `Team #${teamId}`}</span>
        <span className="font-mono text-sm font-bold text-stadium-green">${formatUSDC(amount)}</span>
      </>
    )
  } else if (event.type === 'bet') {
    const { matchId, user, amount } = event.args || {}
    body = (
      <>
        <span className="font-mono text-xs text-stadium-muted">{shortAddr(user)}</span>
        <span className="font-mono text-sm font-bold text-stadium-text">${formatUSDC(amount)}</span>
        <span className="text-xs text-stadium-muted">match #{matchId?.toString()}</span>
      </>
    )
  } else if (event.type === 'swap') {
    const { user, teamId, amount0, amount1 } = event.args || {}
    const team = TEAM_BY_ID[Number(teamId)]
    // USDC side is whichever is 6-decimal — use abs of smaller magnitude as USDC vol
    const a0 = amount0 < 0n ? -amount0 : amount0
    const a1 = amount1 < 0n ? -amount1 : amount1
    // Pick the non-18-decimal side (USDC is 6-decimal, much smaller raw value)
    const usdcVol = a0 < a1 ? a0 : a1
    body = (
      <>
        <span className="font-mono text-xs text-stadium-muted">{shortAddr(user)}</span>
        <span className="text-sm">{team ? `${team.flag} ${team.name}` : `Team #${teamId}`}</span>
        <span className="font-mono text-sm font-bold text-stadium-gold">${formatUSDC(usdcVol)}</span>
      </>
    )
  }

  return (
    <a
      href={txUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-stadium-card px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-stadium-dark transition-colors"
    >
      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-widest border ${cfg.color}`}>
        {cfg.label}
      </span>
      {body}
      <span className="font-mono text-xs text-stadium-muted ml-auto">#{event.blockNumber.toString()}</span>
    </a>
  )
}

const FILTER_OPTIONS = [
  { key: 'all',        label: 'All'        },
  { key: 'swap',       label: 'Swaps'      },
  { key: 'conviction', label: 'Conviction' },
  { key: 'bet',        label: 'VAR Bets'   },
]

export default function Activity() {
  const publicClient = usePublicClient()

  const [events, setEvents]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [historyError, setHistoryError] = useState(false)
  const [filter, setFilter]             = useState('all')

  const fetchHistory = useCallback(async () => {
    if (!publicClient) return
    setLoading(true)
    setHistoryError(false)

    try {
      const currentBlock = await publicClient.getBlockNumber()
      // 2000-block window — stays within X Layer's eth_getLogs range limit
      const fromBlock = currentBlock > 2000n ? currentBlock - 2000n : 0n

      const [convictionLogs, betLogs, swapLogs] = await Promise.all([
        publicClient.getContractEvents({
          address: ADDRESSES.convictionVault,
          abi: ConvictionVault_ABI,
          eventName: 'ConvictionDeposited',
          fromBlock,
          toBlock: currentBlock,
        }).catch(() => []),
        publicClient.getContractEvents({
          address: ADDRESSES.varMarket,
          abi: VARMarket_ABI,
          eventName: 'BetPlaced',
          fromBlock,
          toBlock: currentBlock,
        }).catch(() => []),
        publicClient.getContractEvents({
          address: ADDRESSES.stadiumHook,
          abi: StadiumHook_ABI,
          eventName: 'TeamSwap',
          fromBlock,
          toBlock: currentBlock,
        }).catch(() => []),
      ])

      const normalised = [
        ...convictionLogs.map(e => normaliseEvent(e, 'conviction')),
        ...betLogs.map(e => normaliseEvent(e, 'bet')),
        ...swapLogs.map(e => normaliseEvent(e, 'swap')),
      ]
      normalised.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0))
      setEvents(normalised.slice(0, 100))
    } catch (err) {
      console.warn('Activity: historical event fetch failed', err)
      setHistoryError(true)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [publicClient])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const prependEvent = useCallback((raw, type) => {
    const ev = normaliseEvent(raw, type)
    setEvents(prev => {
      if (prev.some(e => e.key === ev.key)) return prev
      return [ev, ...prev].slice(0, 100)
    })
  }, [])

  useWatchContractEvent({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    eventName: 'ConvictionDeposited',
    onLogs: logs => logs.forEach(log => prependEvent(log, 'conviction')),
  })
  useWatchContractEvent({
    address: ADDRESSES.varMarket,
    abi: VARMarket_ABI,
    eventName: 'BetPlaced',
    onLogs: logs => logs.forEach(log => prependEvent(log, 'bet')),
  })
  useWatchContractEvent({
    address: ADDRESSES.stadiumHook,
    abi: StadiumHook_ABI,
    eventName: 'TeamSwap',
    onLogs: logs => logs.forEach(log => prependEvent(log, 'swap')),
  })

  const visible = filter === 'all' ? events : events.filter(e => e.type === filter)
  const counts = { swap: 0, conviction: 0, bet: 0 }
  events.forEach(e => { if (counts[e.type] !== undefined) counts[e.type]++ })

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1 className="section-title">Activity</h1>
        <p className="section-subtitle">Live on-chain events — swaps, conviction deposits, and VAR bets</p>
      </div>

      {historyError && (
        <div className="bg-stadium-card border border-stadium-border px-4 py-3 text-xs font-mono text-stadium-muted">
          Historical event fetch failed — showing live events only as they arrive
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
      {loading ? (
        <div className="space-y-px bg-stadium-border">
          {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-stadium-card border border-stadium-border px-4 py-12 text-center space-y-3">
          <div className="text-stadium-muted font-mono text-sm">No activity in the last 2000 blocks</div>
          <div className="text-stadium-border font-mono text-xs">Events appear here live as users swap, deposit conviction, and place VAR bets</div>
          <button
            onClick={fetchHistory}
            className="mt-4 text-xs font-mono text-stadium-green hover:underline uppercase tracking-widest"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="space-y-px bg-stadium-border">
          {visible.map(ev => <EventRow key={ev.key} event={ev} />)}
        </div>
      )}
    </div>
  )
}
