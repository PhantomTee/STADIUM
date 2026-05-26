import React from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { WORLD_CUP_TEAMS, formatUSDC } from '../utils/contracts'
import {
  useConvictionDeposit,
  useAccruedYield,
  useTeamEliminated,
  useAllMatchIds,
  useMatch,
  useUserBet,
  useUSDCBalance,
  useTotalAliveConvictionLocked,
  useConvictionMultiplier,
} from '../hooks/useContracts'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ADDRESSES } from '../utils/contracts'
import { ConvictionHook_ABI } from '../abis'

export default function Portfolio() {
  const { address, isConnected } = useAccount()

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="text-6xl">💼</div>
        <h1 className="text-2xl font-bold text-white">Your Portfolio</h1>
        <p className="text-stadium-muted">Connect your wallet to see your positions</p>
        <ConnectButton />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="section-title">💼 Your Portfolio</h1>
        <p className="section-subtitle">Track all your CONVICTION positions and VAR bets in one place.</p>
      </div>

      <PortfolioSummary address={address} />
      <ConvictionPositions address={address} />
      <VARHistory address={address} />
    </div>
  )
}

function PortfolioSummary({ address }) {
  const { data: usdcBalance } = useUSDCBalance(address)
  const { data: accruedYield } = useAccruedYield(address)
  const { data: totalAlive } = useTotalAliveConvictionLocked()

  const { writeContract, data: txHash } = useWriteContract()
  const { isLoading } = useWaitForTransactionReceipt({ hash: txHash })

  const hasYield = accruedYield && accruedYield > 0n

  function handleClaimYield() {
    writeContract({
      address: ADDRESSES.convictionHook,
      abi: ConvictionHook_ABI,
      functionName: 'claimYield',
    })
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card">
        <div className="stat-value">${formatUSDC(usdcBalance)}</div>
        <div className="stat-label">Wallet Balance</div>
      </div>
      <div className="card">
        <div className="stat-value text-stadium-green">${formatUSDC(accruedYield)}</div>
        <div className="stat-label">Accrued Yield</div>
        {hasYield && (
          <button
            onClick={handleClaimYield}
            disabled={isLoading}
            className="btn-primary py-1.5 px-3 text-xs mt-3 w-full"
          >
            {isLoading ? 'Claiming...' : 'Claim All'}
          </button>
        )}
      </div>
      <div className="card">
        <div className="stat-value text-white">{/* computed below */}—</div>
        <div className="stat-label">Active Positions</div>
      </div>
      <div className="card">
        <div className="stat-value text-stadium-gold">—</div>
        <div className="stat-label">Total Earned</div>
      </div>
    </div>
  )
}

function ConvictionPositions({ address }) {
  const positions = WORLD_CUP_TEAMS.map(team => ({
    team,
    // will be filtered inside component
  }))

  return (
    <div>
      <h2 className="font-semibold text-white mb-4">CONVICTION Positions</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {WORLD_CUP_TEAMS.map(team => (
          <ConvictionPositionCard key={team.name} team={team} address={address} />
        ))}
      </div>
    </div>
  )
}

function ConvictionPositionCard({ team, address }) {
  const { data: deposit } = useConvictionDeposit(address, team.name)
  const { data: eliminated } = useTeamEliminated(team.name)
  const { data: multiplier } = useConvictionMultiplier(address, team.name)

  if (!deposit || deposit === 0n) return null

  const isAlive = !eliminated
  const hasBonus = multiplier === 150n

  return (
    <div className={`card ${isAlive ? 'border-stadium-green/30' : 'border-stadium-border/50 opacity-60'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{team.flag}</span>
          <div>
            <div className="font-semibold text-white">{team.name}</div>
            <div className="text-xs text-stadium-muted">Group {team.group}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isAlive ? (
            <span className="badge-green">Active</span>
          ) : (
            <span className="badge-red">Eliminated</span>
          )}
          {hasBonus && isAlive && (
            <span className="badge-gold">⚡ 1.5× VAR</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-stadium-muted text-xs mb-0.5">Deposited</div>
          <div className="font-semibold text-white">${formatUSDC(deposit)}</div>
        </div>
        <div>
          <div className="text-stadium-muted text-xs mb-0.5">
            {isAlive ? 'Current Value' : 'Returned (50%)'}
          </div>
          <div className="font-semibold text-stadium-green">
            {isAlive ? `$${formatUSDC(deposit)}` : `$${formatUSDC(deposit / 2n)}`}
          </div>
        </div>
      </div>

      {isAlive && (
        <div className="mt-3 pt-3 border-t border-stadium-border text-xs text-stadium-muted">
          Principal locked until team elimination or championship
        </div>
      )}
    </div>
  )
}

function VARHistory({ address }) {
  const { data: matchIds } = useAllMatchIds()

  if (!matchIds || matchIds.length === 0) {
    return (
      <div>
        <h2 className="font-semibold text-white mb-4">VAR Bet History</h2>
        <div className="card text-center text-stadium-muted py-8 text-sm">
          No VAR bets placed yet
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-semibold text-white mb-4">VAR Bet History</h2>
      <div className="space-y-2">
        {matchIds.slice().reverse().map(id => (
          <VARMatchRow key={id.toString()} matchId={id} address={address} />
        ))}
      </div>
    </div>
  )
}

function VARMatchRow({ matchId, address }) {
  const { data: match } = useMatch(matchId)
  const MARKET_NAMES = ['Winner', 'First Goal', 'Red Card', 'Extra Time']

  if (!match) return null

  const markets = [0, 1, 2, 3].map(i => ({
    type: i,
    name: MARKET_NAMES[i],
  }))

  return (
    <VARMatchBets matchId={matchId} match={match} address={address} markets={markets} />
  )
}

function VARMatchBets({ matchId, match, address, markets }) {
  // Fetch bets for all 4 markets
  const bets = markets.map(m => ({
    ...m,
    // useUserBet called in child
  }))

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-white">
          {match.teamA} vs {match.teamB}
        </div>
        {match.settled ? (
          <span className="badge-green text-xs">Settled</span>
        ) : match.varOpen ? (
          <span className="badge-green text-xs">VAR Open</span>
        ) : (
          <span className="text-xs text-stadium-muted">Upcoming</span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {markets.map(m => (
          <SingleBetCell
            key={m.type}
            matchId={matchId}
            marketType={m.type}
            marketName={m.name}
            address={address}
            match={match}
          />
        ))}
      </div>
    </div>
  )
}

function SingleBetCell({ matchId, marketType, marketName, address, match }) {
  const { data: bet } = useUserBet(matchId, marketType, address)

  const yes = bet?.[0] || 0n
  const no = bet?.[1] || 0n
  const total = yes + no

  if (total === 0n) {
    return (
      <div className="text-center p-2 rounded-lg bg-stadium-dark text-xs text-stadium-muted">
        <div className="mb-1">{marketName}</div>
        <div>—</div>
      </div>
    )
  }

  const side = yes > no ? 'YES/A' : 'NO/B'

  return (
    <div className="text-center p-2 rounded-lg bg-stadium-green/10 border border-stadium-green/20 text-xs">
      <div className="text-stadium-muted mb-1">{marketName}</div>
      <div className="font-semibold text-stadium-green">${formatUSDC(total)}</div>
      <div className="text-stadium-muted">{side}</div>
      {match.settled && (
        <div className="mt-1 text-xs">
          {/* Show settled status */}
          Result: {match.winner || '—'}
        </div>
      )}
    </div>
  )
}
