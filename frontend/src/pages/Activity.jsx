import React, { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useWatchContractEvent } from 'wagmi'
import { ADDRESSES, TEAM_BY_ID, formatUSDC } from '../utils/contracts'
import { ConvictionVault_ABI, VARMarket_ABI } from '../abis'

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function normaliseEvent(raw, type) {
  return {
    key: `${type}-${raw.blockNumber}-${raw.transactionHash}-${raw.logIndex ?? 0}`,
    type,
    blockNumber: raw.blockNumber ?? 0n,
    args: raw.args,
  }
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

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

// ── Event row ─────────────────────────────────────────────────────────────────

function EventRow({ event }) {
  const isConviction = event.type === 'conviction'

  if (isConviction) {
    const { user, teamId, amount } = event.args || {}
    const team = TEAM_BY_ID[Number(teamId)]
    return (
      <div className="bg-stadium-card px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Tag */}
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-widest bg-stadium-green/10 text-stadium-green border border-stadium-green/20">
          CONVICTION
        </span>

        {/* Address */}
        <span className="font-mono text-xs text-stadium-muted">{shortAddr(user)}</span>

        {/* Team */}
        <span className="text-sm">
          {team ? `${team.flag} ${team.name}` : `Team #${teamId}`}
        </span>

        {/* Amount */}
        <span className="font-mono text-sm font-bold text-stadium-green">
          ${formatUSDC(amount)}
        </span>

        {/* Block */}
        <span className="font-mono text-xs text-stadium-muted ml-auto">
          #{event.blockNumber.toString()}
        </span>
      </div>
    )
  }

  // VAR bet
  const { matchId, user, amount } = event.args || {}
  return (
    <div className="bg-stadium-card px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* Tag */}
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
        VAR BET
      </span>

      {/* Address */}
      <span className="font-mono text-xs text-stadium-muted">{shortAddr(user)}</span>

      {/* Amount + match */}
      <span className="font-mono text-sm font-bold text-stadium-text">
        ${formatUSDC(amount)}
      </span>
      <span className="text-xs text-stadium-muted">
        on match #{matchId?.toString()}
      </span>

      {/* Block */}
      <span className="font-mono text-xs text-stadium-muted ml-auto">
        #{event.blockNumber.toString()}
      </span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Activity() {
  const publicClient = usePublicClient()

  const [events, setEvents]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [historyError, setHistoryError] = useState(false)

  // ── Historical fetch ──────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    if (!publicClient) return
    setLoading(true)
    setHistoryError(false)

    try {
      const currentBlock = await publicClient.getBlockNumber()
      const fromBlock    = currentBlock > 50000n ? currentBlock - 50000n : 0n

      const [convictionLogs, betLogs] = await Promise.all([
        publicClient.getContractEvents({
          address:   ADDRESSES.convictionVault,
          abi:       ConvictionVault_ABI,
          eventName: 'ConvictionDeposited',
          fromBlock,
          toBlock:   currentBlock,
        }),
        publicClient.getContractEvents({
          address:   ADDRESSES.varMarket,
          abi:       VARMarket_ABI,
          eventName: 'BetPlaced',
          fromBlock,
          toBlock:   currentBlock,
        }),
      ])

      const normalised = [
        ...convictionLogs.map(e => normaliseEvent(e, 'conviction')),
        ...betLogs.map(e => normaliseEvent(e, 'bet')),
      ]

      normalised.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0))

      setEvents(normalised.slice(0, 50))
    } catch (err) {
      console.warn('Activity: historical event fetch failed', err)
      setHistoryError(true)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [publicClient])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // ── Live watch hooks ──────────────────────────────────────────────────────

  const prependEvent = useCallback((raw, type) => {
    const ev = normaliseEvent(raw, type)
    setEvents(prev => {
      // Deduplicate by key
      if (prev.some(e => e.key === ev.key)) return prev
      return [ev, ...prev].slice(0, 50)
    })
  }, [])

  useWatchContractEvent({
    address:   ADDRESSES.convictionVault,
    abi:       ConvictionVault_ABI,
    eventName: 'ConvictionDeposited',
    onLogs: logs => logs.forEach(log => prependEvent(log, 'conviction')),
  })

  useWatchContractEvent({
    address:   ADDRESSES.varMarket,
    abi:       VARMarket_ABI,
    eventName: 'BetPlaced',
    onLogs: logs => logs.forEach(log => prependEvent(log, 'bet')),
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div className="page-header">
        <h1 className="section-title">Activity</h1>
        <p className="section-subtitle">Live on-chain events from X Layer</p>
      </div>

      {/* Error banner */}
      {historyError && (
        <div className="bg-stadium-card border border-stadium-border px-4 py-3 text-xs font-mono text-stadium-muted">
          Historical events unavailable — showing live events only
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-1 gap-px bg-stadium-border text-sm">
        <div className="bg-stadium-card p-4 flex items-center gap-3">
          <span className="uppercase tracking-widest text-xs text-stadium-muted font-mono">Events loaded</span>
          <span className="font-black text-stadium-green text-lg font-mono">{events.length}</span>
        </div>
      </div>

      {/* Event feed */}
      {loading ? (
        <div className="space-y-px bg-stadium-border">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-stadium-card border border-stadium-border px-4 py-10 text-center text-stadium-muted font-mono text-sm">
          No recent activity found
        </div>
      ) : (
        <div className="space-y-px bg-stadium-border">
          {events.map(ev => (
            <EventRow key={ev.key} event={ev} />
          ))}
        </div>
      )}

    </div>
  )
}
