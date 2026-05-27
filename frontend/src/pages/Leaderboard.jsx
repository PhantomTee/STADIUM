import React, { useState } from 'react'
import { WORLD_CUP_TEAMS, TEAM_BY_ID, formatUSDC } from '../utils/contracts'
import {
  useTeamTotalDeposit, useBackerCount, useTeamEliminated,
  useTotalAliveDeposits, useChampionPoolData,
} from '../hooks/useContracts'

const TABS = ['Teams', 'Champion Pool']

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('Teams')

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1 className="section-title">Leaderboard</h1>
        <p className="section-subtitle">Live standings by conviction locked. The most-backed team earns its supporters the most yield.</p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-stadium-border">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
              activeTab === tab
                ? 'bg-stadium-green/10 text-stadium-green'
                : 'bg-stadium-card text-stadium-muted hover:text-stadium-text hover:bg-stadium-dark'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Teams'         && <TeamsLeaderboard />}
      {activeTab === 'Champion Pool' && <ChampionPoolView />}
    </div>
  )
}

function TeamsLeaderboard() {
  const { data: totalAlive } = useTotalAliveDeposits()
  const [sortBy, setSortBy]  = useState('locked')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="text-xs font-mono text-stadium-muted">
          Total alive locked: <span className="text-stadium-text font-bold">${formatUSDC(totalAlive)}</span>
        </div>
        <div className="flex gap-px bg-stadium-border">
          {['locked', 'backers'].map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-xs px-4 py-2 font-bold uppercase tracking-wider transition-colors ${
                sortBy === s
                  ? 'bg-stadium-green text-stadium-dark'
                  : 'bg-stadium-card text-stadium-muted hover:text-stadium-text'
              }`}
            >
              {s === 'locked' ? 'By Locked' : 'By Backers'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-mono text-stadium-muted uppercase tracking-widest border-b border-stadium-border mb-px">
        <div className="col-span-1">#</div>
        <div className="col-span-5">Team</div>
        <div className="col-span-3 text-right">Locked</div>
        <div className="col-span-3 text-right">Share</div>
      </div>

      <div className="space-y-px bg-stadium-border">
        {WORLD_CUP_TEAMS.map((team, i) => (
          <TeamLeaderboardRow key={team.id} team={team} rank={i + 1} totalAlive={totalAlive} />
        ))}
      </div>
    </div>
  )
}

function TeamLeaderboardRow({ team, rank, totalAlive }) {
  const { data: locked }    = useTeamTotalDeposit(team.id)
  const { data: backers }   = useBackerCount(team.id)
  const { data: eliminated } = useTeamEliminated(team.id)

  const pct = totalAlive && locked && totalAlive > 0n
    ? Number(locked * 10000n / totalAlive) / 100
    : 0

  return (
    <div className={`bg-stadium-card grid grid-cols-12 gap-4 items-center px-4 py-3 border-l-2 transition-colors ${
      eliminated
        ? 'border-l-transparent opacity-40'
        : 'border-l-transparent hover:border-l-stadium-green/40 hover:bg-stadium-dark'
    }`}>
      <div className="col-span-1 text-stadium-muted font-mono text-xs text-center">
        {eliminated ? '×' : rank}
      </div>
      <div className="col-span-5 flex items-center gap-2">
        <span className="text-lg">{team.flag}</span>
        <div>
          <div className="font-bold text-stadium-text text-sm uppercase tracking-tight leading-none">{team.name}</div>
          <div className="text-xs text-stadium-muted font-mono mt-0.5">
            {eliminated ? 'Eliminated' : `Group ${team.group}`}
          </div>
        </div>
      </div>
      <div className="col-span-3">
        <div className="w-full bg-stadium-border h-1 mb-1">
          <div
            className={`h-1 transition-all ${eliminated ? 'bg-stadium-muted' : 'bg-stadium-green'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="text-xs text-stadium-muted font-mono text-right">{backers?.toString() || 0} backers</div>
      </div>
      <div className="col-span-3 text-right">
        <div className="font-bold text-stadium-text text-sm font-mono">${formatUSDC(locked)}</div>
        <div className="text-xs text-stadium-muted font-mono">{pct.toFixed(1)}%</div>
      </div>
    </div>
  )
}

function ChampionPoolView() {
  const { totalAccumulated, snapshot, championSet, championTeamId } = useChampionPoolData()
  const championTeam = TEAM_BY_ID[championTeamId]

  const CONTRIBUTIONS = [
    { source: 'CONVICTION Eliminations', pct: '25%', desc: "25% of each eliminated team's 50% forfeit" },
    { source: 'VAR Losing Bets',         pct: '22.5%', desc: "22.5% of each losing VAR bet's redistribution" },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-stadium-card border border-stadium-gold/30 p-10 text-center">
        <div className="text-xs font-mono text-stadium-gold uppercase tracking-widest mb-3">Total Accumulated</div>
        <div className="text-display text-stadium-gold" style={{ fontSize: 'clamp(3rem, 8vw, 6rem)' }}>
          ${formatUSDC(totalAccumulated)}
        </div>
        <div className="text-xs text-stadium-muted font-mono uppercase tracking-widest mt-3">Champion Pool</div>
        {championSet && championTeam && (
          <div className="mt-6 inline-block badge-gold text-sm">
            Champion: {championTeam.flag} {championTeam.name}
          </div>
        )}
        {championSet && !championTeam && (
          <div className="mt-6 inline-block badge-gold text-sm">Champion declared</div>
        )}
      </div>

      <div>
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-3">How the Pool Grows</div>
        <div className="grid gap-px bg-stadium-border">
          {CONTRIBUTIONS.map(c => (
            <div key={c.source} className="flex items-center gap-5 p-4 bg-stadium-card">
              <div className="text-2xl font-black text-stadium-gold font-mono w-16 flex-shrink-0">{c.pct}</div>
              <div>
                <div className="font-bold text-stadium-text text-sm uppercase tracking-tight">{c.source}</div>
                <div className="text-xs text-stadium-muted font-mono mt-0.5">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-3">Distribution at Tournament End</div>
        <div className="bg-stadium-dark border border-stadium-border p-5 font-mono text-sm">
          <div className="text-stadium-muted text-xs mb-3 uppercase tracking-widest">// Your champion pool share</div>
          <div className="space-y-1">
            <div className="text-stadium-green">share =</div>
            <div className="ml-6 text-stadium-text">(yourDeposit / totalChampDeposits)</div>
            <div className="ml-6 text-stadium-muted">× championPoolSnapshot</div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-3">Tournament Favorites</div>
        <div className="space-y-px bg-stadium-border">
          {WORLD_CUP_TEAMS.slice(0, 8).map(team => (
            <FavoriteRow key={team.id} team={team} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FavoriteRow({ team }) {
  const { data: locked }    = useTeamTotalDeposit(team.id)
  const { data: backers }   = useBackerCount(team.id)
  const { data: eliminated } = useTeamEliminated(team.id)

  return (
    <div className={`flex items-center gap-3 p-4 bg-stadium-card border-l-2 border-l-transparent hover:border-l-stadium-gold/50 transition-colors ${eliminated ? 'opacity-30' : ''}`}>
      <span className="text-xl">{team.flag}</span>
      <div className="flex-1">
        <span className="text-sm font-bold text-stadium-text uppercase tracking-tight">{team.name}</span>
        {eliminated && <span className="text-xs text-red-400 font-mono ml-2">(eliminated)</span>}
      </div>
      <div className="text-right font-mono">
        <div className="text-stadium-text font-bold text-sm">${formatUSDC(locked)}</div>
        <div className="text-xs text-stadium-muted">{backers?.toString() || 0} backers</div>
      </div>
    </div>
  )
}
