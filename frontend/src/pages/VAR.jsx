import React, { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ADDRESSES, WORLD_CUP_TEAMS, formatUSDC, parseUSDC } from '../utils/contracts'
import { MockUSDC_ABI, VARMarket_ABI } from '../abis'
import { useUSDCBalance, useUSDCAllowance, useVARMarket, useAllMatchIds, useMatch, useConvictionMultiplier } from '../hooks/useContracts'
import { IconTrophy, IconBall, IconRedCard, IconClock, IconCheck, IconBolt } from '../components/Icons'

const MARKET_NAMES = ['Match Winner', 'First Goal', 'Red Card', 'Extra Time']
const MARKET_ICONS = [IconTrophy, IconBall, IconRedCard, IconClock]
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
  if (outcome === teamA)       return 'teamA'
  if (outcome === teamB)       return 'teamB'
  if (outcome === 'Draw')      return 'draw'
  if (outcome === 'No Goal')   return 'none'
  return outcome // YES / NO
}

export default function VAR() {
  const { address, isConnected } = useAccount()
  const [selectedMatchId, setSelectedMatchId]   = useState(null)
  const [selectedMarket, setSelectedMarket]     = useState(0)
  const [selectedOutcome, setSelectedOutcome]   = useState(null)
  const [betAmount, setBetAmount]               = useState('')
  const [txStep, setTxStep]                     = useState('idle')

  const { data: matchIds }    = useAllMatchIds()
  const { data: usdcBalance } = useUSDCBalance(address)
  const { data: allowance }   = useUSDCAllowance(address, ADDRESSES.varMarket)
  const { data: selectedMatch } = useMatch(selectedMatchId)

  const parsedAmount   = betAmount ? parseUSDC(betAmount) : 0n
  const needsApproval  = allowance !== undefined && parsedAmount > 0n && allowance < parsedAmount

  const { writeContract, data: txHash } = useWriteContract()
  const { isLoading: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const teamA    = selectedMatch?.teamA || ''
  const teamB    = selectedMatch?.teamB || ''

  function handleApprove() {
    setTxStep('approving')
    writeContract({
      address: ADDRESSES.mockUSDC,
      abi: MockUSDC_ABI,
      functionName: 'approve',
      args: [ADDRESSES.varMarket, parsedAmount],
    })
  }

  function handlePlaceBet() {
    if (!selectedMatchId || !selectedOutcome || !parsedAmount) return
    setTxStep('betting')
    const contractOutcome = outcomeToContract(selectedOutcome, teamA, teamB)
    writeContract({
      address: ADDRESSES.varMarket,
      abi: VARMarket_ABI,
      functionName: 'placeBet',
      args: [BigInt(selectedMatchId), selectedMarket, contractOutcome, parsedAmount],
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <IconChart size={28} className="text-stadium-green" />
        <div>
          <h1 className="section-title">VAR — Variable Action Rewards</h1>
          <p className="section-subtitle">Predict in-match events. Win your share of the losing pool. Conviction holders get 1.5× bonus.</p>
        </div>
      </div>

      {/* VAR Mechanics Banner */}
      <div className="card border-blue-500/20 bg-blue-500/5">
        <div className="grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="font-semibold text-stadium-text mb-2">How VAR Pays Out</div>
            <div className="text-stadium-muted space-y-1">
              <div className="flex items-center gap-2"><IconCheck size={14} className="text-stadium-green flex-shrink-0" /> Correct: your bet + share of losing pool</div>
              <div className="flex items-center gap-2"><IconCheck size={14} className="text-stadium-green flex-shrink-0" /> CONVICTION holder: 1.5× net winnings</div>
              <div className="flex items-center gap-2"><IconCheck size={14} className="text-stadium-green flex-shrink-0" /> Wrong: 10% of your bet returned automatically</div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-stadium-text mb-2">VAR Window</div>
            <div className="text-stadium-muted space-y-1">
              <div>Opens: 60 min before kickoff</div>
              <div>Closes: At kickoff</div>
              <div>Settles: After match ends via oracle</div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-stadium-text mb-2">Loss Distribution</div>
            <div className="text-stadium-muted space-y-1">
              <div>45% → winning pool</div>
              <div>25% → Champion Pool</div>
              <div>20% → Treasury</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Match List */}
        <div className="lg:col-span-1">
          <h2 className="font-semibold text-stadium-text mb-4">Live Matches</h2>
          {!matchIds || matchIds.length === 0 ? (
            <div className="card text-stadium-muted text-sm text-center py-8">
              No matches scheduled yet
            </div>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
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
            <div className="card h-full flex items-center justify-center text-stadium-muted text-sm">
              Select a match to see VAR markets
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

function IconChart({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 20h18M7 20V12M12 20V6M17 20v-8" />
    </svg>
  )
}

function MatchListItem({ matchId, isSelected, onSelect }) {
  const { data: match } = useMatch(matchId)
  if (!match) return null

  const kickoff    = new Date(Number(match.kickoffTime) * 1000)
  const statusText = match.settled ? 'Settled'
    : match.varClosed ? 'In Progress'
    : match.varOpen   ? 'VAR Open'
    : 'Upcoming'

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 border transition-all ${
        isSelected
          ? 'border-stadium-green bg-stadium-green/10'
          : 'border-stadium-border hover:border-stadium-green/40'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold text-stadium-text">
          {match.teamA} vs {match.teamB}
        </div>
        <span className={`text-xs flex items-center gap-1 ${match.varOpen ? 'text-stadium-green' : 'text-stadium-muted'}`}>
          {match.varOpen && <span className="w-1.5 h-1.5 bg-stadium-green inline-block animate-pulse" />}
          {statusText}
        </span>
      </div>
      <div className="text-xs text-stadium-muted">
        {kickoff.toLocaleDateString()} · {kickoff.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      {match.settled && (
        <div className="text-xs text-stadium-muted mt-1">Result: {match.winner}</div>
      )}
    </button>
  )
}

function VARBettingPanel({
  matchId, match, selectedMarket, setSelectedMarket,
  selectedOutcome, setSelectedOutcome,
  betAmount, setBetAmount,
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
      <div className="text-center">
        <div className="flex items-center justify-center gap-6 mb-2">
          {[teamA, teamB].map(t => {
            const info = WORLD_CUP_TEAMS.find(w => w.name === t)
            return (
              <div key={t} className="flex items-center gap-2">
                <span className="text-xl">{info?.flag || ''}</span>
                <span className="font-bold text-stadium-text">{t}</span>
              </div>
            )
          })}
        </div>
        {hasBonus && (
          <div className="badge-gold text-xs mx-auto w-fit flex items-center gap-1">
            <IconBolt size={11} /> 1.5× CONVICTION bonus active
          </div>
        )}
        {match?.varOpen ? (
          <div className="badge-green text-xs mx-auto w-fit mt-1">VAR Window Open</div>
        ) : match?.settled ? (
          <div className="badge-red text-xs mx-auto w-fit mt-1">Settled — Winner: {match.winner}</div>
        ) : (
          <div className="text-xs text-stadium-muted mt-1">VAR window not open yet</div>
        )}
      </div>

      {/* Market Tabs */}
      <div className="grid grid-cols-4 gap-2">
        {MARKET_NAMES.map((name, i) => {
          const MIcon = MARKET_ICONS[i]
          return (
            <button
              key={i}
              onClick={() => setSelectedMarket(i)}
              className={`text-center p-2.5 border transition-colors text-xs ${
                selectedMarket === i
                  ? 'border-stadium-green bg-stadium-green/10 text-stadium-green'
                  : 'border-stadium-border text-stadium-muted hover:border-stadium-green/40'
              }`}
            >
              <div className="flex justify-center mb-1">
                <MIcon size={16} className={selectedMarket === i ? 'text-stadium-green' : 'text-stadium-muted'} />
              </div>
              <div className="font-medium leading-tight">{name}</div>
            </button>
          )
        })}
      </div>

      {/* Market Description */}
      <div className="text-xs text-stadium-muted text-center">
        {MARKET_DESCRIPTIONS[selectedMarket]}
      </div>

      {/* Pool Info */}
      <div className="flex justify-between text-xs text-stadium-muted bg-stadium-dark border border-stadium-border p-3">
        <span>Total pool: ${formatUSDC(totalPool)}</span>
        <span>Yes/A: ${formatUSDC(market?.totalYesPool)}</span>
        <span>No/B: ${formatUSDC(market?.totalNoPool)}</span>
      </div>

      {/* Outcome Selection */}
      <div>
        <div className="text-sm font-medium text-stadium-text mb-2">Choose Outcome</div>
        <div className="grid grid-cols-3 gap-2">
          {outcomes.map(outcome => (
            <button
              key={outcome}
              onClick={() => setSelectedOutcome(outcome)}
              disabled={!match?.varOpen}
              className={`p-3 border text-sm font-medium transition-all ${
                selectedOutcome === outcome
                  ? 'border-stadium-green bg-stadium-green/10 text-stadium-green'
                  : 'border-stadium-border text-stadium-muted hover:border-stadium-green/40 disabled:opacity-40 disabled:cursor-not-allowed'
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
          <label className="text-sm text-stadium-muted mb-1.5 block">Bet Amount (USDC)</label>
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stadium-green hover:text-stadium-text"
            >
              MAX
            </button>
          </div>
        </div>
      )}

      {/* Action Button */}
      {!isConnected ? (
        <ConnectButton />
      ) : needsApproval ? (
        <button onClick={onApprove} disabled={txPending || !betAmount} className="btn-primary w-full">
          {txPending ? 'Approving...' : 'Approve USDC'}
        </button>
      ) : (
        <button
          onClick={onBet}
          disabled={txPending || !betAmount || !selectedOutcome || !match?.varOpen}
          className="btn-primary w-full"
        >
          {txPending
            ? 'Placing bet...'
            : match?.varOpen
            ? `Bet $${betAmount || '0'} on ${selectedOutcome || '...'}`
            : 'VAR Window Closed'}
        </button>
      )}

      {txSuccess && (
        <div className="text-center text-stadium-green text-sm flex items-center justify-center gap-2">
          <IconCheck size={16} /> Prediction placed!
        </div>
      )}
    </div>
  )
}
