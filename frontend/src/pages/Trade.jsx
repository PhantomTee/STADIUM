import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { WORLD_CUP_TEAMS, formatUSDC, ADDRESSES } from '../utils/contracts'
import {
  useTeamMomentum, useTeamEliminated, useTeamTotalDeposit,
  useHookPaused, useHookFeeConfig, useFactoryTeamPoolId,
} from '../hooks/useContracts'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

const STAGE_LABELS = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter Final', 'Semi Final', 'Final']
const FEE_NAMES   = ['Group Stage', 'Knockout', 'Final']

export default function Trade() {
  const { isConnected } = useAccount()
  const [selectedTeamId, setSelectedTeamId] = useState(null)

  const hookDeployed = ADDRESSES.stadiumHook !== ZERO_ADDR

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1 className="section-title">Trade</h1>
        <p className="section-subtitle">
          Swap team tokens through the StadiumHook — a Uniswap V4 hook with dynamic fees,
          momentum tracking, and conviction holder discounts.
        </p>
      </div>

      {!hookDeployed && (
        <div className="bg-stadium-gold/10 border border-stadium-gold/30 p-4 text-center text-sm text-stadium-gold font-mono">
          StadiumHook not yet deployed. Run <code>DeployHook.s.sol</code> then set{' '}
          <code>VITE_STADIUM_HOOK_ADDRESS</code>.
        </div>
      )}

      <HookStatus />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TeamPoolGrid onSelect={setSelectedTeamId} selectedId={selectedTeamId} />
        </div>
        <div>
          <SwapPanel teamId={selectedTeamId} isConnected={isConnected} />
        </div>
      </div>
    </div>
  )
}

function HookStatus() {
  const { data: paused }    = useHookPaused()
  const { data: feeConfig } = useHookFeeConfig()

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card">
        <div className={`stat-value text-sm ${paused ? 'text-red-400' : 'text-stadium-green'}`}>
          {paused === undefined ? '—' : paused ? 'PAUSED' : 'ACTIVE'}
        </div>
        <div className="stat-label">Hook Status</div>
      </div>
      <div className="card">
        <div className="stat-value text-sm text-stadium-text font-mono">
          {feeConfig ? `${(feeConfig.groupStageFee / 10000 * 100).toFixed(2)}%` : '—'}
        </div>
        <div className="stat-label">Group Stage Fee</div>
      </div>
      <div className="card">
        <div className="stat-value text-sm text-stadium-text font-mono">
          {feeConfig ? `${(feeConfig.knockoutFee / 10000 * 100).toFixed(2)}%` : '—'}
        </div>
        <div className="stat-label">Knockout Fee</div>
      </div>
      <div className="card">
        <div className="stat-value text-sm text-stadium-gold font-mono">
          {feeConfig ? `-${(feeConfig.convictionDiscount / 10000 * 100).toFixed(2)}%` : '—'}
        </div>
        <div className="stat-label">Conviction Discount</div>
      </div>
    </div>
  )
}

function TeamPoolGrid({ onSelect, selectedId }) {
  const [search, setSearch] = useState('')
  const filtered = WORLD_CUP_TEAMS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) || t.group === search.toUpperCase()
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-stadium-text text-sm uppercase tracking-widest">Team Pools</h2>
        <input
          type="text"
          placeholder="Search team or group…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-stadium-dark border border-stadium-border text-stadium-text text-xs px-3 py-1.5 font-mono w-44 focus:outline-none focus:border-stadium-green"
        />
      </div>

      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-mono text-stadium-muted uppercase tracking-widest border-b border-stadium-border mb-px">
        <div className="col-span-5">Team</div>
        <div className="col-span-3 text-right">Momentum</div>
        <div className="col-span-2 text-right">Locked</div>
        <div className="col-span-2 text-right">Pool</div>
      </div>

      <div className="space-y-px bg-stadium-border max-h-[600px] overflow-y-auto">
        {filtered.map(team => (
          <TeamPoolRow
            key={team.id}
            team={team}
            selected={selectedId === team.id}
            onClick={() => onSelect(team.id === selectedId ? null : team.id)}
          />
        ))}
      </div>
    </div>
  )
}

function TeamPoolRow({ team, selected, onClick }) {
  const { data: momentum }  = useTeamMomentum(team.id)
  const { data: eliminated } = useTeamEliminated(team.id)
  const { data: locked }    = useTeamTotalDeposit(team.id)
  const { data: poolId }    = useFactoryTeamPoolId(team.id)

  const hasPool = poolId && poolId !== '0x0000000000000000000000000000000000000000000000000000000000000000'

  return (
    <div
      onClick={onClick}
      className={`bg-stadium-card grid grid-cols-12 gap-2 items-center px-3 py-2.5 border-l-2 cursor-pointer transition-colors ${
        eliminated
          ? 'border-l-transparent opacity-30 cursor-not-allowed'
          : selected
            ? 'border-l-stadium-green bg-stadium-green/5'
            : 'border-l-transparent hover:border-l-stadium-green/40 hover:bg-stadium-dark'
      }`}
    >
      <div className="col-span-5 flex items-center gap-2">
        <span className="text-base">{team.flag}</span>
        <div>
          <div className="font-bold text-stadium-text text-xs uppercase tracking-tight leading-none">{team.name}</div>
          <div className="text-xs text-stadium-muted font-mono mt-0.5">Group {team.group}</div>
        </div>
      </div>
      <div className="col-span-3 text-right">
        <div className="text-xs font-mono text-stadium-green font-bold">
          {momentum ? formatUSDC(momentum) : '0.00'}
        </div>
        <div className="text-xs text-stadium-muted font-mono">vol</div>
      </div>
      <div className="col-span-2 text-right">
        <div className="text-xs font-mono text-stadium-text">${formatUSDC(locked)}</div>
      </div>
      <div className="col-span-2 text-right">
        {hasPool ? (
          <span className="text-xs text-stadium-green font-mono">LIVE</span>
        ) : (
          <span className="text-xs text-stadium-muted font-mono">–</span>
        )}
      </div>
    </div>
  )
}

function SwapPanel({ teamId, isConnected }) {
  const team = WORLD_CUP_TEAMS.find(t => t.id === teamId)
  const { data: eliminated } = useTeamEliminated(teamId)
  const { data: poolId }     = useFactoryTeamPoolId(teamId)
  const { data: momentum }   = useTeamMomentum(teamId)

  const hasPool = poolId && poolId !== '0x0000000000000000000000000000000000000000000000000000000000000000'

  if (!team) {
    return (
      <div className="card text-center py-12">
        <div className="text-stadium-muted text-sm font-mono">
          Select a team to trade
        </div>
        <div className="text-stadium-border text-xs font-mono mt-2">
          ← click any row
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-stadium-border">
        <span className="text-3xl">{team.flag}</span>
        <div>
          <div className="font-bold text-stadium-text uppercase tracking-tight">{team.name}</div>
          <div className="text-xs text-stadium-muted font-mono">Group {team.group}</div>
        </div>
        {eliminated && <span className="badge-red ml-auto">Eliminated</span>}
      </div>

      {momentum !== undefined && (
        <div className="bg-stadium-dark border border-stadium-border p-3">
          <div className="text-xs text-stadium-muted font-mono uppercase tracking-widest mb-1">Momentum</div>
          <div className="text-stadium-green font-mono font-bold">${formatUSDC(momentum)}</div>
          <div className="text-xs text-stadium-muted font-mono mt-0.5">cumulative swap volume</div>
        </div>
      )}

      {!hasPool && (
        <div className="text-xs text-stadium-muted font-mono text-center py-4 border border-dashed border-stadium-border">
          No V4 pool created yet for this team.
          <br />Run <code className="text-stadium-green">CreatePools.s.sol</code> first.
        </div>
      )}

      {hasPool && !eliminated && (
        <SwapForm team={team} isConnected={isConnected} poolId={poolId} />
      )}
    </div>
  )
}

function SwapForm({ team, isConnected, poolId }) {
  const [amountIn, setAmountIn] = useState('')
  const [direction, setDirection] = useState('buy')

  if (!isConnected) {
    return (
      <div className="text-center py-4 space-y-3">
        <p className="text-xs text-stadium-muted font-mono">Connect wallet to swap</p>
        <ConnectButton />
      </div>
    )
  }

  const shortPoolId = poolId ? `${poolId.slice(0, 6)}…${poolId.slice(-4)}` : '—'

  return (
    <div className="space-y-3">
      <div className="flex gap-px bg-stadium-border">
        {['buy', 'sell'].map(d => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              direction === d
                ? d === 'buy' ? 'bg-stadium-green text-stadium-dark' : 'bg-red-500 text-white'
                : 'bg-stadium-card text-stadium-muted hover:text-stadium-text'
            }`}
          >
            {d === 'buy' ? `Buy ${team.name.split(' ')[0]}` : `Sell ${team.name.split(' ')[0]}`}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-stadium-muted font-mono uppercase tracking-widest block mb-1">
          {direction === 'buy' ? 'USDC In' : 'Token In'}
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amountIn}
          onChange={e => setAmountIn(e.target.value)}
          className="w-full bg-stadium-dark border border-stadium-border text-stadium-text font-mono text-sm px-3 py-2 focus:outline-none focus:border-stadium-green"
        />
      </div>

      <div className="bg-stadium-dark border border-stadium-border p-3 text-xs font-mono space-y-1">
        <div className="flex justify-between text-stadium-muted">
          <span>Pool</span>
          <span className="text-stadium-text">{shortPoolId}</span>
        </div>
        <div className="flex justify-between text-stadium-muted">
          <span>Hook</span>
          <span className="text-stadium-green">StadiumHook</span>
        </div>
        <div className="flex justify-between text-stadium-muted">
          <span>Fee (dynamic)</span>
          <span className="text-stadium-text">varies by stage</span>
        </div>
      </div>

      <button
        disabled
        className="btn-primary w-full py-3 text-sm opacity-60 cursor-not-allowed"
        title="Direct V4 swap requires Uniswap Router integration"
      >
        Swap via Uniswap V4 ↗
      </button>

      <p className="text-xs text-stadium-muted font-mono text-center">
        Swaps execute through the official Uniswap V4 router using the StadiumHook pool.
        Full swap UI coming with mainnet deployment.
      </p>
    </div>
  )
}
