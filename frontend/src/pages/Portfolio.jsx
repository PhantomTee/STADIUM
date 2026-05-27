import React from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { WORLD_CUP_TEAMS, formatUSDC, ADDRESSES } from '../utils/contracts'
import {
  useConvictionDeposit, usePendingYield,
  useTeamEliminated, useTeamChampion, usePrincipalClaimed,
  useAllMatchIds, useMatch, useUSDCBalance,
  useTotalAliveDeposits, useConvictionMultiplier,
  useChampionPoolData, useChampClaimed,
} from '../hooks/useContracts'
import { ConvictionVault_ABI, ChampionPool_ABI } from '../abis'

export default function Portfolio() {
  const { address, isConnected } = useAccount()

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <h1 className="text-2xl font-bold text-stadium-text">Your Portfolio</h1>
        <p className="text-stadium-muted">Connect your wallet to see your positions</p>
        <ConnectButton />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1 className="section-title">Your Portfolio</h1>
        <p className="section-subtitle">Track all your CONVICTION positions and VAR bets in one place.</p>
      </div>

      <PortfolioSummary address={address} />
      <ConvictionPositions address={address} />
      <ChampionPoolSection address={address} />
      <VARHistory address={address} />
    </div>
  )
}

function PortfolioSummary({ address }) {
  const { data: usdcBalance }  = useUSDCBalance(address)
  const { data: pendingYield } = usePendingYield(address)
  const { data: totalAlive }   = useTotalAliveDeposits()

  const { writeContract, data: txHash } = useWriteContract()
  const { isLoading } = useWaitForTransactionReceipt({ hash: txHash })

  const hasYield = pendingYield && pendingYield > 0n

  function handleClaimYield() {
    writeContract({
      address: ADDRESSES.convictionVault,
      abi: ConvictionVault_ABI,
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
        <div className="stat-value text-stadium-green">${formatUSDC(pendingYield)}</div>
        <div className="stat-label">Pending Yield</div>
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
        <div className="stat-value text-stadium-text">${formatUSDC(totalAlive)}</div>
        <div className="stat-label">Total Alive Locked</div>
      </div>
      <div className="card">
        <div className="stat-value text-stadium-gold">—</div>
        <div className="stat-label">Champion Pool Share</div>
      </div>
    </div>
  )
}

function ConvictionPositions({ address }) {
  return (
    <div>
      <h2 className="font-semibold text-stadium-text mb-4">CONVICTION Positions</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {WORLD_CUP_TEAMS.map(team => (
          <ConvictionPositionCard key={team.id} team={team} address={address} />
        ))}
      </div>
    </div>
  )
}

function ConvictionPositionCard({ team, address }) {
  const { data: deposit }          = useConvictionDeposit(address, team.id)
  const { data: eliminated }       = useTeamEliminated(team.id)
  const { data: champion }         = useTeamChampion(team.id)
  const { data: principalClaimed } = usePrincipalClaimed(address, team.id)
  const { data: multiplier }       = useConvictionMultiplier(address, team.id)

  const { writeContract, data: txHash } = useWriteContract()
  const { isLoading } = useWaitForTransactionReceipt({ hash: txHash })

  if (!deposit || deposit === 0n) return null

  const isAlive  = !eliminated && !champion
  const hasBonus = multiplier === 150n

  function handleClaim() {
    if (champion) {
      writeContract({
        address: ADDRESSES.convictionVault,
        abi: ConvictionVault_ABI,
        functionName: 'claimChampionPrincipal',
        args: [team.id],
      })
    } else {
      writeContract({
        address: ADDRESSES.convictionVault,
        abi: ConvictionVault_ABI,
        functionName: 'claimEliminatedPosition',
        args: [team.id],
      })
    }
  }

  return (
    <div className={`card ${isAlive ? 'border-stadium-green/30' : champion ? 'border-stadium-gold/30' : 'border-stadium-border/50 opacity-70'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{team.flag}</span>
          <div>
            <div className="font-semibold text-stadium-text">{team.name}</div>
            <div className="text-xs text-stadium-muted">Group {team.group}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isAlive   && <span className="badge-green">Active</span>}
          {eliminated && <span className="badge-red">Eliminated</span>}
          {champion   && <span className="badge-gold">Champion</span>}
          {hasBonus && isAlive && <span className="badge-gold">1.5× VAR</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-stadium-muted text-xs mb-0.5">Deposited</div>
          <div className="font-semibold text-stadium-text">${formatUSDC(deposit)}</div>
        </div>
        <div>
          <div className="text-stadium-muted text-xs mb-0.5">
            {champion ? 'Full Return' : eliminated ? 'Refund (50%)' : 'Locked'}
          </div>
          <div className={`font-semibold ${champion ? 'text-stadium-gold' : 'text-stadium-green'}`}>
            {champion ? `$${formatUSDC(deposit)}` : eliminated ? `$${formatUSDC(deposit / 2n)}` : `$${formatUSDC(deposit)}`}
          </div>
        </div>
      </div>

      {(eliminated || champion) && !principalClaimed && (
        <button
          onClick={handleClaim}
          disabled={isLoading}
          className="btn-primary w-full py-2 text-xs mt-3"
        >
          {isLoading ? 'Claiming...' : champion ? 'Claim Principal' : 'Claim 50% Refund'}
        </button>
      )}
      {principalClaimed && (
        <div className="text-xs text-stadium-muted font-mono mt-2">Principal claimed</div>
      )}
    </div>
  )
}

function ChampionPoolSection({ address }) {
  const { totalAccumulated, snapshot, championSet, championTeamId } = useChampionPoolData()
  const { data: claimed } = useChampClaimed(address, championTeamId)

  const { writeContract, data: txHash } = useWriteContract()
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function handleClaim() {
    writeContract({
      address: ADDRESSES.championPool,
      abi: ChampionPool_ABI,
      functionName: 'claimChampionPool',
      args: [championTeamId],
    })
  }

  return (
    <div>
      <h2 className="font-semibold text-stadium-text mb-4">Champion Pool</h2>
      <div className="card">
        <div className="grid grid-cols-3 gap-px bg-stadium-border -mx-5 -mt-5 mb-5">
          <div className="bg-stadium-dark p-4 text-center">
            <div className="text-xl font-black text-stadium-gold">${formatUSDC(totalAccumulated)}</div>
            <div className="text-xs text-stadium-muted font-mono uppercase tracking-widest mt-1">Total Accumulated</div>
          </div>
          <div className="bg-stadium-dark p-4 text-center">
            <div className="text-xl font-black text-stadium-text">${formatUSDC(snapshot)}</div>
            <div className="text-xs text-stadium-muted font-mono uppercase tracking-widest mt-1">Pool Snapshot</div>
          </div>
          <div className="bg-stadium-dark p-4 text-center">
            <div className={`text-xl font-black ${championSet ? 'text-stadium-green' : 'text-stadium-muted'}`}>
              {championSet ? 'SET' : 'PENDING'}
            </div>
            <div className="text-xs text-stadium-muted font-mono uppercase tracking-widest mt-1">Status</div>
          </div>
        </div>

        {championSet && !claimed && !isSuccess && (
          <button onClick={handleClaim} disabled={isLoading} className="btn-primary w-full">
            {isLoading ? 'Claiming...' : 'Claim Champion Pool Share'}
          </button>
        )}
        {(claimed || isSuccess) && (
          <div className="text-center text-stadium-muted text-xs font-mono">Champion pool share claimed</div>
        )}
        {!championSet && (
          <div className="text-center text-stadium-muted text-xs font-mono">
            Champion pool distributes when the World Cup winner is declared
          </div>
        )}
      </div>
    </div>
  )
}

function VARHistory({ address }) {
  const { data: matchIds } = useAllMatchIds()

  if (!matchIds || matchIds.length === 0) {
    return (
      <div>
        <h2 className="font-semibold text-stadium-text mb-4">VAR Bet History</h2>
        <div className="card text-center text-stadium-muted py-8 text-sm">
          No VAR bets placed yet
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-semibold text-stadium-text mb-4">VAR Bet History</h2>
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

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-stadium-text">
          {match.teamAName} vs {match.teamBName}
        </div>
        {match.settled ? (
          <span className="badge-green text-xs">Settled</span>
        ) : match.varOpen ? (
          <span className="badge-green text-xs">VAR Open</span>
        ) : (
          <span className="text-xs text-stadium-muted">Upcoming</span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs font-mono text-stadium-muted">
        {MARKET_NAMES.map((name, i) => (
          <div key={i} className="text-center p-2 bg-stadium-dark border border-stadium-border">
            {name}
          </div>
        ))}
      </div>
    </div>
  )
}
