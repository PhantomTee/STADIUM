import React, { useState } from 'react'
import { WORLD_CUP_TEAMS, formatUSDC } from '../utils/contracts'
import {
  useTotalConvictionLocked, useBackerCount, useTeamEliminated,
  useTotalAliveConvictionLocked, useChampionPoolData,
} from '../hooks/useContracts'
import { IconTrophy, IconClose } from '../components/Icons'

const TABS = ['Teams', 'Champion Pool']

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('Teams')

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <IconTrophy size={28} className="text-stadium-gold" />
        <div>
          <h1 className="section-title">Leaderboard</h1>
          <p className="section-subtitle">Live standings by conviction locked. The most-backed team earns its supporters the most yield.</p>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-2 border-b border-stadium-border">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-stadium-green text-stadium-green'
                : 'border-transparent text-stadium-muted hover:text-stadium-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Teams'        && <TeamsLeaderboard />}
      {activeTab === 'Champion Pool' && <ChampionPoolView />}
    </div>
  )
}

function TeamsLeaderboard() {
  const { data: totalAlive } = useTotalAliveConvictionLocked()
  const [sortBy, setSortBy]  = useState('locked')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-stadium-muted">
          Total alive locked: <span className="text-stadium-text font-semibold">${formatUSDC(totalAlive)}</span>
        </div>
        <div className="flex gap-2">
          {['locked', 'backers'].map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-xs px-3 py-1 transition-colors ${
                sortBy === s
                  ? 'bg-stadium-green text-stadium-dark font-semibold'
                  : 'text-stadium-muted border border-stadium-border'
              }`}
            >
              {s === 'locked' ? 'By Locked' : 'By Backers'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {WORLD_CUP_TEAMS.map((team, i) => (
          <TeamLeaderboardRow key={team.name} team={team} rank={i + 1} totalAlive={totalAlive} />
        ))}
      </div>
    </div>
  )
}

function TeamLeaderboardRow({ team, rank, totalAlive }) {
  const { data: locked }    = useTotalConvictionLocked(team.name)
  const { data: backers }   = useBackerCount(team.name)
  const { data: eliminated } = useTeamEliminated(team.name)

  const pct = totalAlive && locked && totalAlive > 0n
    ? Number(locked * 10000n / totalAlive) / 100
    : 0

  return (
    <div className={`card flex items-center gap-4 py-3 ${eliminated ? 'opacity-40' : ''}`}>
      <div className="text-stadium-muted font-mono text-sm w-6 text-center">
        {eliminated
          ? <IconClose size={14} className="text-stadium-muted mx-auto" />
          : rank}
      </div>
      <span className="text-xl">{team.flag}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-stadium-text text-sm">{team.name}</span>
          {eliminated && <span className="badge-red text-xs">Eliminated</span>}
        </div>
        {/* Progress bar — sharp, no rounding */}
        <div className="w-full bg-stadium-border h-1.5">
          <div
            className={`h-1.5 transition-all ${eliminated ? 'bg-stadium-muted' : 'bg-stadium-green'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-stadium-text text-sm">${formatUSDC(locked)}</div>
        <div className="text-xs text-stadium-muted">{backers?.toString() || 0} backers · {pct.toFixed(1)}%</div>
      </div>
    </div>
  )
}

function ChampionPoolView() {
  const { balance, totalAccumulated, champion } = useChampionPoolData()

  const CONTRIBUTIONS = [
    { source: 'CONVICTION Eliminations', pct: '25%', desc: "25% of each eliminated team's 50% forfeit" },
    { source: 'VAR Losing Bets',         pct: '25%', desc: "25% of each losing VAR bet's redistribution" },
  ]

  return (
    <div className="space-y-6">
      {/* Pool Size */}
      <div className="card border-stadium-gold/30 bg-stadium-gold/5 text-center py-8">
        <div className="flex justify-center mb-4 text-stadium-gold">
          <IconTrophy size={48} />
        </div>
        <div className="text-4xl font-bold text-stadium-gold mb-2">
          ${formatUSDC(balance)}
        </div>
        <div className="text-stadium-muted">Current Champion Pool Balance</div>
        {champion && (
          <div className="mt-4 badge-gold text-sm mx-auto w-fit">Champion: {champion}</div>
        )}
      </div>

      {/* How it accumulates */}
      <div className="card">
        <h2 className="font-semibold text-stadium-text mb-4">How the Pool Grows</h2>
        <div className="space-y-3">
          {CONTRIBUTIONS.map(c => (
            <div key={c.source} className="flex items-start gap-4 p-3 bg-stadium-dark border border-stadium-border">
              <div className="text-2xl font-bold text-stadium-gold font-mono w-12">{c.pct}</div>
              <div>
                <div className="font-medium text-stadium-text text-sm">{c.source}</div>
                <div className="text-xs text-stadium-muted mt-0.5">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distribution */}
      <div className="card">
        <h2 className="font-semibold text-stadium-text mb-4">Distribution at Tournament End</h2>
        <div className="text-stadium-muted text-sm space-y-3">
          <p>When the oracle posts the World Cup champion, the full pool is distributed proportionally
          to all CONVICTION holders who backed the winning team, weighted by deposit size.</p>
          <div className="bg-stadium-dark p-4 font-mono text-xs text-stadium-green border border-stadium-border">
            <div className="text-stadium-muted mb-1">// Your champion pool share</div>
            <div>share = (yourDeposit / totalChampDeposits) × championPoolBalance</div>
          </div>
          <p>The larger your CONVICTION stake on the champion, the larger your share of the pool.</p>
        </div>
      </div>

      {/* Top Team Preview */}
      <div className="card">
        <h2 className="font-semibold text-stadium-text mb-4">Tournament Favorites</h2>
        <div className="space-y-2">
          {WORLD_CUP_TEAMS.slice(0, 8).map(team => (
            <FavoriteRow key={team.name} team={team} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FavoriteRow({ team }) {
  const { data: locked }    = useTotalConvictionLocked(team.name)
  const { data: backers }   = useBackerCount(team.name)
  const { data: eliminated } = useTeamEliminated(team.name)

  return (
    <div className={`flex items-center gap-3 p-3 ${eliminated ? 'opacity-30' : 'bg-stadium-dark border border-stadium-border'}`}>
      <span className="text-xl">{team.flag}</span>
      <div className="flex-1">
        <span className="text-sm font-medium text-stadium-text">{team.name}</span>
        {eliminated && <span className="text-xs text-red-400 ml-2">(out)</span>}
      </div>
      <div className="text-right text-xs text-stadium-muted">
        <div className="text-stadium-text font-medium">${formatUSDC(locked)}</div>
        <div>{backers?.toString() || 0} backers</div>
      </div>
    </div>
  )
}
