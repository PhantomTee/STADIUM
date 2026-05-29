import React, { useState } from 'react'
import ShareButton from '../components/ShareButton'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ADDRESSES, WORLD_CUP_TEAMS, TEAM_BY_ID, formatUSDC, parseUSDC } from '../utils/contracts'
import { MockUSDC_ABI, VARMarket_ABI } from '../abis'
import {
  useUSDCBalance, useUSDCAllowance,
  useVARMarket, useOutcomePool,
  useAllMatchIds, useMatch,
  useConvictionMultiplier, useVARClaimed,
} from '../hooks/useContracts'

// Outcome constants matching VARMarket.sol
const OUTCOME_TEAM_A  = 1
const OUTCOME_TEAM_B  = 2
const OUTCOME_DRAW    = 3
const OUTCOME_YES     = 4
const OUTCOME_NO      = 5
const OUTCOME_NO_GOAL = 6

const MARKET_NAMES = ['Match Winner', 'First Goal', 'Red Card', 'Extra Time']
const MARKET_DESCRIPTIONS = [
  'Which team wins, or draw in group stage',
  'Which team scores first, or no goals',
  'Will a red card be shown',
  'Will the match go to extra time',
]

function getOutcomes(marketType, teamAName, teamBName) {
  if (marketType === 2 || marketType === 3) {
    return [
      { label: 'YES', value: OUTCOME_YES },
      { label: 'NO',  value: OUTCOME_NO  },
    ]
  }
  if (marketType === 0) {
    return [
      { label: teamAName, value: OUTCOME_TEAM_A },
      { label: teamBName, value: OUTCOME_TEAM_B },
      { label: 'Draw',    value: OUTCOME_DRAW   },
    ]
  }
  // marketType === 1 (First Goal)
  return [
    { label: teamAName,   value: OUTCOME_TEAM_A  },
    { label: teamBName,   value: OUTCOME_TEAM_B  },
    { label: 'No Goal',   value: OUTCOME_NO_GOAL },
  ]
}

function outcomeLabel(outcomeId, teamAName, teamBName) {
  switch (outcomeId) {
    case OUTCOME_TEAM_A:  return teamAName || 'Team A'
    case OUTCOME_TEAM_B:  return teamBName || 'Team B'
    case OUTCOME_DRAW:    return 'Draw'
    case OUTCOME_YES:     return 'YES'
    case OUTCOME_NO:      return 'NO'
    case OUTCOME_NO_GOAL: return 'No Goal'
    default:              return '—'
  }
}

export default function VAR() {
  const { address, isConnected } = useAccount()
  const [selectedMatchId, setSelectedMatchId] = useState(null)
  const [selectedMarket, setSelectedMarket]   = useState(0)
  const [selectedOutcome, setSelectedOutcome] = useState(null)
  const [betAmount, setBetAmount]             = useState('')

  const { data: matchIds }      = useAllMatchIds()
  const { data: usdcBalance }   = useUSDCBalance(address)
  const { data: allowance }     = useUSDCAllowance(address, ADDRESSES.varMarket)
  const { data: selectedMatch } = useMatch(selectedMatchId)

  const parsedAmount  = betAmount ? parseUSDC(betAmount) : 0n
  const needsApproval = allowance !== undefined && parsedAmount > 0n && allowance < parsedAmount

  const { writeContract, data: txHash, isPending: txSubmitting } = useWriteContract()
  const { isLoading: txConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const txPending = txSubmitting || txConfirming

  const teamAName = selectedMatch?.teamAName || ''
  const teamBName = selectedMatch?.teamBName || ''

  function handleApprove() {
    writeContract({
      address: ADDRESSES.mockUSDC,
      abi: MockUSDC_ABI,
      functionName: 'approve',
      args: [ADDRESSES.varMarket, parsedAmount],
      gas: 150_000n,
    })
  }

  function handlePlaceBet() {
    if (!selectedMatchId || selectedOutcome === null || !parsedAmount) return
    writeContract({
      address: ADDRESSES.varMarket,
      abi: VARMarket_ABI,
      functionName: 'placeBet',
      args: [BigInt(selectedMatchId), selectedMarket, selectedOutcome, parsedAmount],
      gas: 400_000n,
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="page-header">
        <h1 className="section-title">VAR — Variable Action Rewards</h1>
        <p className="section-subtitle">Predict in-match events. Win your share of the losing pool. Conviction holders get 1.5× bonus.</p>
      </div>

      {/* Mechanics strip */}
      <div className="grid md:grid-cols-3 gap-px bg-stadium-border text-sm">
        {[
          { title: 'How VAR Pays Out', items: ['Correct: bet + share of losing pool', 'CONVICTION holder: 1.5× net winnings', 'Wrong: 10% of your bet returned'] },
          { title: 'VAR Window',       items: ['Opens 60 min before kickoff', 'Closes at kickoff', 'Settles after match via oracle'] },
          { title: 'Loss Split',       items: ['45% → winning pool', '22.5% → Champion Pool', '22.5% → Treasury · 10% → refunds'] },
        ].map(block => (
          <div key={block.title} className="bg-stadium-card p-5">
            <div className="font-bold text-stadium-text text-xs uppercase tracking-widest mb-3">{block.title}</div>
            <div className="space-y-1">
              {block.items.map(item => (
                <div key={item} className="text-stadium-muted text-xs font-mono">— {item}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Match List */}
        <div className="lg:col-span-1">
          <h2 className="font-bold text-stadium-text text-xs uppercase tracking-widest mb-4">Live Matches</h2>
          {!matchIds || matchIds.length === 0 ? (
            <div className="card text-stadium-muted text-sm text-center py-8 font-mono">
              No matches scheduled
            </div>
          ) : (
            <div className="space-y-px max-h-[560px] overflow-y-auto border border-stadium-border">
              {matchIds.map(id => (
                <MatchListItem
                  key={id.toString()}
                  matchId={id}
                  isSelected={selectedMatchId === id}
                  onSelect={() => { setSelectedMatchId(id); setSelectedOutcome(null) }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Betting Panel */}
        <div className="lg:col-span-2">
          {!selectedMatchId ? (
            <div className="card h-full flex items-center justify-center text-stadium-muted text-sm font-mono">
              — Select a match to open VAR markets —
            </div>
          ) : (
            <VARBettingPanel
              matchId={selectedMatchId}
              match={selectedMatch}
              selectedMarket={selectedMarket}
              setSelectedMarket={idx => { setSelectedMarket(idx); setSelectedOutcome(null) }}
              selectedOutcome={selectedOutcome}
              setSelectedOutcome={setSelectedOutcome}
              betAmount={betAmount}
              setBetAmount={setBetAmount}
              usdcBalance={usdcBalance}
              needsApproval={needsApproval}
              txPending={txPending}
              txSuccess={txSuccess}
              isConnected={isConnected}
              address={address}
              onApprove={handleApprove}
              onBet={handlePlaceBet}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function MatchListItem({ matchId, isSelected, onSelect }) {
  const { data: match } = useMatch(matchId)
  if (!match) return null

  const kickoff    = new Date(Number(match.kickoffTime) * 1000)
  const statusText = match.settled ? 'SETTLED'
    : match.varClosed ? 'IN PROGRESS'
    : match.varOpen   ? 'VAR OPEN'
    : 'UPCOMING'

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 transition-all border-l-2 ${
        isSelected
          ? 'border-l-stadium-green bg-stadium-green/10'
          : 'border-l-transparent bg-stadium-card hover:bg-stadium-dark hover:border-l-stadium-green/40'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-bold text-stadium-text">
          {match.teamAName} vs {match.teamBName}
        </div>
        <span className={`text-xs font-mono font-bold flex items-center gap-1 ${match.varOpen ? 'text-stadium-green' : 'text-stadium-muted'}`}>
          {match.varOpen && <span className="w-1.5 h-1.5 bg-stadium-green inline-block animate-pulse" />}
          {statusText}
        </span>
      </div>
      <div className="text-xs text-stadium-muted font-mono">
        {kickoff.toLocaleDateString()} · {kickoff.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </button>
  )
}

function VARBettingPanel({
  matchId, match, selectedMarket, setSelectedMarket,
  selectedOutcome, setSelectedOutcome, betAmount, setBetAmount,
  usdcBalance, needsApproval, txPending, txSuccess,
  isConnected, address, onApprove, onBet,
}) {
  const teamAId   = match?.teamAId
  const teamBId   = match?.teamBId
  const teamAName = match?.teamAName || ''
  const teamBName = match?.teamBName || ''
  const teamAInfo = TEAM_BY_ID[teamAId]
  const teamBInfo = TEAM_BY_ID[teamBId]

  const { data: multA } = useConvictionMultiplier(address, teamAId)
  const { data: multB } = useConvictionMultiplier(address, teamBId)
  const hasBonus = multA === 150n || multB === 150n

  const { data: market } = useVARMarket(matchId, selectedMarket)

  const outcomes   = getOutcomes(selectedMarket, teamAName, teamBName)
  const correctId  = market?.correctOutcome || 0

  return (
    <div className="card space-y-5">
      {/* Match Header */}
      <div className="text-center pb-4 border-b border-stadium-border">
        <div className="flex items-center justify-center gap-8 mb-3">
          {[{ info: teamAInfo, name: teamAName }, { info: teamBInfo, name: teamBName }].map(({ info, name }) => (
            <div key={name} className="text-center">
              <div className="text-2xl mb-1">{info?.flag || '—'}</div>
              <div className="font-black text-stadium-text text-sm uppercase tracking-tight">{name}</div>
            </div>
          ))}
          <div className="text-stadium-muted font-mono text-xs font-bold">VS</div>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {hasBonus && <span className="badge-gold">1.5× CONVICTION BONUS ACTIVE</span>}
          {match?.varOpen ? (
            <span className="badge-green">VAR Window Open</span>
          ) : match?.settled ? (
            <span className="badge-red">
              Settled · {outcomeLabel(market?.correctOutcome, teamAName, teamBName)}
            </span>
          ) : (
            <span className="text-xs text-stadium-muted font-mono">VAR window not open yet</span>
          )}
        </div>
      </div>

      {/* Market Tabs */}
      <div className="grid grid-cols-4 gap-px bg-stadium-border">
        {MARKET_NAMES.map((name, i) => (
          <button
            key={i}
            onClick={() => setSelectedMarket(i)}
            className={`text-center p-3 transition-colors text-xs font-bold uppercase tracking-wider ${
              selectedMarket === i
                ? 'bg-stadium-green/10 text-stadium-green'
                : 'bg-stadium-card text-stadium-muted hover:text-stadium-text hover:bg-stadium-dark'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="text-xs text-stadium-muted text-center font-mono">
        {MARKET_DESCRIPTIONS[selectedMarket]}
      </div>

      {/* Pool Info */}
      <OutcomePools matchId={matchId} marketType={selectedMarket} outcomes={outcomes} />

      {/* Outcome Selection */}
      <div>
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-2">Choose Outcome</div>
        <div className={`grid gap-px bg-stadium-border ${outcomes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {outcomes.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setSelectedOutcome(value)}
              disabled={!match?.varOpen}
              className={`p-4 text-sm font-bold uppercase tracking-wide transition-all ${
                selectedOutcome === value
                  ? 'bg-stadium-green/10 text-stadium-green'
                  : correctId > 0 && value === correctId
                  ? 'bg-stadium-gold/10 text-stadium-gold'
                  : 'bg-stadium-card text-stadium-muted hover:text-stadium-text hover:bg-stadium-dark disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Claim section if settled */}
      {match?.settled && address && (
        <ClaimSection matchId={matchId} marketType={selectedMarket} address={address} />
      )}

      {/* Bet Amount */}
      {isConnected && match?.varOpen && (
        <div>
          <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Bet Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              value={betAmount}
              onChange={e => setBetAmount(e.target.value)}
              placeholder="50"
              min="1"
              className="input-field pr-16"
            />
            <button
              onClick={() => setBetAmount(formatUSDC(usdcBalance).replace(/,/g, ''))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stadium-green hover:text-stadium-text uppercase"
            >
              MAX
            </button>
          </div>
        </div>
      )}

      {match?.varOpen && (
        !isConnected ? (
          <ConnectButton />
        ) : needsApproval ? (
          <button onClick={onApprove} disabled={txPending || !betAmount} className="btn-primary w-full">
            {txPending ? 'Approving...' : 'Approve USDC'}
          </button>
        ) : (
          <button
            onClick={onBet}
            disabled={txPending || !betAmount || selectedOutcome === null}
            className="btn-primary w-full"
          >
            {txPending ? 'Placing bet...' : `Bet $${betAmount || '0'} on ${
              selectedOutcome !== null
                ? outcomeLabel(selectedOutcome, teamAName, teamBName)
                : '...'
            }`}
          </button>
        )
      )}

      {txSuccess && (
        <div className="space-y-3">
          <div className="text-center text-stadium-green text-sm font-bold font-mono uppercase tracking-widest">
            Prediction placed successfully
          </div>
          <div className="flex justify-center">
            <ShareButton
              text={`I just predicted ${outcomeLabel(selectedOutcome, teamAName, teamBName)} in ${teamAName} vs ${teamBName} on 11° VAR — World Cup DeFi on X Layer! 🎯 #WorldCup2026 #DeFi`}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function OutcomePools({ matchId, marketType, outcomes }) {
  return (
    <div className={`grid gap-px bg-stadium-border text-xs font-mono ${outcomes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {outcomes.map(({ label, value }) => (
        <OutcomePoolCell key={value} matchId={matchId} marketType={marketType} outcome={value} label={label} />
      ))}
    </div>
  )
}

function OutcomePoolCell({ matchId, marketType, outcome, label }) {
  const { data: pool } = useOutcomePool(matchId, marketType, outcome)
  return (
    <div className="bg-stadium-dark p-3 text-center">
      <div className="text-stadium-text font-bold">${formatUSDC(pool || 0n)}</div>
      <div className="text-stadium-muted">{label}</div>
    </div>
  )
}

function ClaimSection({ matchId, marketType, address }) {
  const { data: alreadyClaimed } = useVARClaimed(matchId, marketType, address)
  const { writeContract, data: txHash, isPending: claimSubmitting } = useWriteContract()
  const { isLoading: claimConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const isLoading = claimSubmitting || claimConfirming

  function handleClaim() {
    writeContract({
      address: ADDRESSES.varMarket,
      abi: VARMarket_ABI,
      functionName: 'claimVAR',
      args: [BigInt(matchId), marketType],
      gas: 300_000n,
    })
  }

  if (alreadyClaimed) {
    return (
      <div className="text-center text-xs text-stadium-muted font-mono py-2">
        VAR payout claimed
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="text-center text-stadium-green text-sm font-bold font-mono uppercase tracking-widest">
        VAR payout claimed successfully
      </div>
    )
  }

  return (
    <button onClick={handleClaim} disabled={isLoading} className="btn-primary w-full">
      {isLoading ? 'Claiming...' : 'Claim VAR Payout'}
    </button>
  )
}
