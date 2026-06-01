import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getFixtures, getGroupStandings } from '../services/footballData'
import ScoreboardCard from '../components/ScoreboardCard'
import { useChampionPoolBalance } from '../hooks/useContracts'
import { formatUSDC } from '../utils/contracts'

const REFRESH_MS = 30_000

function StatusFilter({ value, onChange }) {
  const opts = ['all', 'live', 'scheduled', 'finished']
  return (
    <div className="flex gap-px">
      {opts.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 text-xs font-bold font-mono uppercase tracking-widest transition-colors ${
            value === opt
              ? 'bg-stadium-green text-stadium-dark'
              : 'bg-stadium-card text-stadium-muted hover:text-stadium-text border border-stadium-border'
          }`}
          style={{ borderRadius: 2 }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function StandingsTable({ groups }) {
  const [activeGroup, setActiveGroup] = useState(0)
  if (!groups || groups.length === 0) return null

  const current = groups[activeGroup] ?? groups[0]
  const rows    = current?.table ?? []

  return (
    <div className="border border-stadium-border overflow-hidden">
      {/* Group tabs */}
      {groups.length > 1 && (
        <div className="flex overflow-x-auto bg-stadium-dark border-b border-stadium-border">
          {groups.map((g, i) => {
            const label = g.group.replace(/^GROUP_/, '') || String(i + 1)
            return (
              <button
                key={g.group}
                onClick={() => setActiveGroup(i)}
                className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest flex-shrink-0 transition-colors ${
                  i === activeGroup
                    ? 'text-stadium-green border-b-2 border-stadium-green'
                    : 'text-stadium-muted hover:text-stadium-text'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
      {groups.length === 1 && (
        <div className="bg-stadium-dark px-4 py-2 border-b border-stadium-border">
          <span className="font-mono text-stadium-muted text-xs uppercase tracking-widest">Group Standings</span>
        </div>
      )}
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-stadium-muted border-b border-stadium-border/50">
            <th className="text-left px-4 py-2 font-normal">#</th>
            <th className="text-left px-4 py-2 font-normal">Team</th>
            <th className="text-center px-2 py-2 font-normal">P</th>
            <th className="text-center px-2 py-2 font-normal">W</th>
            <th className="text-center px-2 py-2 font-normal">D</th>
            <th className="text-center px-2 py-2 font-normal">L</th>
            <th className="text-center px-2 py-2 font-normal">GD</th>
            <th className="text-center px-2 py-2 font-bold text-stadium-text">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.teamId}
              className={`border-b border-stadium-border/30 transition-colors hover:bg-stadium-card ${i < 2 ? 'border-l-2 border-l-stadium-green' : ''}`}
            >
              <td className="px-4 py-2 text-stadium-muted">{i + 1}</td>
              <td className="px-4 py-2">
                <span className="text-stadium-text font-bold">{r.teamAbbr}</span>
                <span className="text-stadium-muted ml-2 hidden sm:inline">{r.teamName}</span>
              </td>
              <td className="text-center px-2 py-2 text-stadium-muted">{r.played}</td>
              <td className="text-center px-2 py-2 text-stadium-green">{r.won}</td>
              <td className="text-center px-2 py-2 text-stadium-muted">{r.drawn}</td>
              <td className="text-center px-2 py-2 text-red-400">{r.lost}</td>
              <td className="text-center px-2 py-2 text-stadium-muted">
                {r.goalsFor - r.goalsAgainst > 0 ? '+' : ''}{r.goalsFor - r.goalsAgainst}
              </td>
              <td className="text-center px-2 py-2 font-bold text-stadium-text">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


export default function LiveScores() {
  const [fixtures,    setFixtures]    = useState([])
  const [groups,      setGroups]      = useState([])
  const [filter,      setFilter]      = useState('all')
  const [loading,     setLoading]     = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState(null)
  const [error,       setError]       = useState(null)

  const { data: champPoolTotal } = useChampionPoolBalance()

  const load = useCallback(async () => {
    try {
      const [fix, grps] = await Promise.all([
        getFixtures(),
        getGroupStandings(),
      ])
      setFixtures(fix)
      setGroups(grps)
      setLastUpdate(new Date())
      setError(null)
    } catch (e) {
      setError('Failed to load match data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  const hookStates = useMemo(() => {
    const states = {}
    fixtures.forEach(m => {
      states[m.matchId] = {
        active:    m.status === 'live' || m.status === 'halftime',
        fee:       '0.30',
        varStatus: m.status === 'live'     ? 'open'
                 : m.status === 'halftime' ? 'closed'
                 : m.status === 'finished' ? 'settled'
                 : 'pending',
        champFees: m.status !== 'scheduled' ? (champPoolTotal != null ? formatUSDC(champPoolTotal) : null) : null,
      }
    })
    return states
  }, [fixtures])

  const filtered  = fixtures.filter(m =>
    filter === 'all' || m.status === filter || (filter === 'live' && m.status === 'halftime')
  )
  const liveCount = fixtures.filter(m => m.status === 'live' || m.status === 'halftime').length

  return (
    <div className="space-y-10">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="rule-label mb-3">
              <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
              {liveCount > 0 ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  {liveCount} match{liveCount > 1 ? 'es' : ''} live
                </span>
              ) : 'Match Centre'}
            </div>
            <h1 className="section-title">Live Scores</h1>
            <p className="section-subtitle mt-1">
              {lastUpdate
                ? `Updated ${lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Loading…'}
            </p>
          </div>
          <StatusFilter value={filter} onChange={setFilter} />
        </div>
      </div>

      {error && (
        <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 font-mono text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 border border-stadium-border bg-stadium-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6 items-start">

          {/* Left: Scoreboards */}
          <div className="lg:col-span-2 space-y-4">
            {filtered.length === 0 ? (
              <div className="border border-stadium-border bg-stadium-card p-12 text-center">
                <p className="text-stadium-muted font-mono text-sm">No matches for this filter.</p>
              </div>
            ) : (
              filtered.map(match => (
                <ScoreboardCard
                  key={match.matchId}
                  match={match}
                  hookState={hookStates[match.matchId]}
                />
              ))
            )}
          </div>

          {/* Right: Standings */}
          <div className="space-y-6">
            <StandingsTable groups={groups} />
          </div>
        </div>
      )}
    </div>
  )
}
