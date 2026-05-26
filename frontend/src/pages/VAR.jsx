import React, { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ADDRESSES, WORLD_CUP_TEAMS, formatUSDC, parseUSDC } from '../utils/contracts'
import { MockUSDC_ABI, VARMarket_ABI } from '../abis'
import { useUSDCBalance, useUSDCAllowance, useVARMarket, useAllMatchIds, useMatch, useConvictionMultiplier } from '../hooks/useContracts'

const MARKET_NAMES = ['Match Winner', 'First Goal', 'Red Card', 'Extra Time']
const MARKET_DESCRIPTIONS = [
  'Which team wins, or draw in group stage',
  'Which team scores first, or no goals',
  'Will a red card be shown (YES/NO)',
  'Will the match go to extra time (YES/NO)',
]

function getOutcomes(marketType, teamA, teamB) {
  if (marketType === 2 || marketType === 3) return ['YES', 'NO']
  if (marketType === 0) return [teamA, teamB, 'Draw']
  return [teamA, teamB, 'No Goal']
}

function outcomeToContract(outcome, teamA, teamB) {
  if (outcome === teamA)     return 'teamA'
  if (outcome === teamB)     return 'teamB'
  if (outcome === 'Draw')    return 'draw'
  if (outcome === 'No Goal') return 'none'
  return outcome
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

  const { writeContract, data: txHash } = useWriteContract()
  const { isLoading: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const teamA = selectedMatch?.teamA || ''
  const teamB = selectedMatch?.teamB || ''

  function handleApprove() {
    writeContract({ address: ADDRESSES.mockUSDC, abi: MockUSDC_ABI, functionName: 'approve', args: [ADDRESSES.varMarket, parsedAmount] })
  }

  function handlePlaceBet() {
    if (!selectedMatchId || !selectedOutcome || !parsedAmount) return
    const contractOutcome = outcomeToContract(selectedOutcome, teamA, teamB)
    writeContract({ address: ADDRESSES.varMarket, abi: VARMarket_ABI, functionName: 'placeBet', args: [BigInt(selectedMatchId), selectedMarket, contractOutcome, parsedAmount] })
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
          { title: 'Loss Split',       items: ['45% → winning pool', '25% → Champion Pool', '20% → Treasury · 10% → refunds'] },
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
          {match.teamA} vs {match.teamB}
        </div>
        <span className={`text-xs font-mono font-bold flex items-center gap-1 ${match.varOpen ? 'text-stadium-green' : 'text-stadium-muted'}`}>
          {match.varOpen && <span className="w-1.5 h-1.5 bg-stadium-green inline-block animate-pulse" />}
          {statusText}
        </span>
      </div>
      <div className="text-xs text-stadium-muted font-mono">
        {kickoff.toLocaleDateString()} · {kickoff.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      {match.settled && <div className="text-xs text-stadium-muted mt-1 font-mono">Result: {match.winner}</div>}
    </button>
  )
}

function VARBettingPanel({
  matchId, match, selectedMarket, setSelectedMarket,
  selectedOutcome, setSelectedOutcome, betAmount, setBetAmount,
  usdcBalance, needsApproval, txPending, txSuccess,
  isConnected, address, onApprove, onBet,
}) {
  const teamA   = match?.teamA || ''
  const teamB   = match?.teamB || ''
  const outcomes = getOutcomes(selectedMarket, teamA, teamB)

  const { data: market }      = useVARMarket(matchId, selectedMarket)
  const { data: multiplierA } = useConvictionMultiplier(address, teamA)
  const { data: multiplierB } = useConvictionMultiplier(address, teamB)
  const hasBonus = multiplierA === 150n || multiplierB === 150n

  const totalPool = market ? (market.totalYesPool + market.totalNoPool + (market.totalDrawPool || 0n)) : 0n

  return (
    <div className="card space-y-5">
      {/* Match Header */}
      <div className="text-center pb-4 border-b border-stadium-border">
        <div className="flex items-center justify-center gap-8 mb-3">
          {[teamA, teamB].map(t => {
            const info = WORLD_CUP_TEAMS.find(w => w.name === t)
            return (
              <div key={t} className="text-center">
                <div className="text-2xl mb-1">{info?.flag || '—'}</div>
                <div className="font-black text-stadium-text text-sm uppercase tracking-tight">{t}</div>
              </div>
            )
          })}
          <div className="text-stadium-muted font-mono text-xs font-bold">VS</div>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {hasBonus && (
            <span className="badge-gold">1.5× CONVICTION BONUS ACTIVE</span>
          )}
          {match?.varOpen ? (
            <span className="badge-green">VAR Window Open</span>
          ) : match?.settled ? (
            <span className="badge-red">Settled · Winner: {match.winner}</span>
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
      <div className="grid grid-cols-3 gap-px bg-stadium-border text-xs font-mono">
        <div className="bg-stadium-dark p-3 text-center">
          <div className="text-stadium-text font-bold">${formatUSDC(totalPool)}</div>
          <div className="text-stadium-muted">Total pool</div>
        </div>
        <div className="bg-stadium-dark p-3 text-center">
          <div className="text-stadium-text font-bold">${formatUSDC(market?.totalYesPool)}</div>
          <div className="text-stadium-muted">Yes / A</div>
        </div>
        <div className="bg-stadium-dark p-3 text-center">
          <div className="text-stadium-text font-bold">${formatUSDC(market?.totalNoPool)}</div>
          <div className="text-stadium-muted">No / B</div>
        </div>
      </div>

      {/* Outcome Selection */}
      <div>
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-2">Choose Outcome</div>
        <div className="grid grid-cols-3 gap-px bg-stadium-border">
          {outcomes.map(outcome => (
            <button
              key={outcome}
              onClick={() => setSelectedOutcome(outcome)}
              disabled={!match?.varOpen}
              className={`p-4 text-sm font-bold uppercase tracking-wide transition-all ${
                selectedOutcome === outcome
                  ? 'bg-stadium-green/10 text-stadium-green'
                  : 'bg-stadium-card text-stadium-muted hover:text-stadium-text hover:bg-stadium-dark disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {outcome}
            </button>
          ))}
        </div>
      </div>

      {/* Bet Amount */}
      {isConnected && (
        <div>
          <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Bet Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              value={betAmount}
              onChange={e => setBetAmount(e.target.value)}
              placeholder="50"
              min="1"
              disabled={!match?.varOpen}
              className="input-field pr-16 disabled:opacity-40"
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

      {!isConnected ? (
        <ConnectButton />
      ) : needsApproval ? (
        <button onClick={onApprove} disabled={txPending || !betAmount} className="btn-primary w-full">
          {txPending ? 'Approving...' : 'Approve USDC'}
        </button>
      ) : (
        <button onClick={onBet} disabled={txPending || !betAmount || !selectedOutcome || !match?.varOpen} className="btn-primary w-full">
          {txPending ? 'Placing bet...' : match?.varOpen ? `Bet $${betAmount || '0'} on ${selectedOutcome || '...'}` : 'VAR Window Closed'}
        </button>
      )}

      {txSuccess && (
        <div className="text-center text-stadium-green text-sm font-bold font-mono uppercase tracking-widest">
          Prediction placed successfully
        </div>
      )}
    </div>
  )
}
