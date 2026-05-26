import React, { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ADDRESSES, WORLD_CUP_TEAMS, formatUSDC, parseUSDC } from '../utils/contracts'
import { MockUSDC_ABI, ConvictionHook_ABI } from '../abis'
import {
  useUSDCBalance, useUSDCAllowance, useConvictionDeposit,
  useAccruedYield, useTotalConvictionLocked, useTeamEliminated,
  useBackerCount, useTotalAliveConvictionLocked,
} from '../hooks/useContracts'
import { IconBall, IconCheck, IconLock, IconCoins, IconWarn } from '../components/Icons'

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export default function Conviction() {
  const { address, isConnected } = useAccount()
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [amount, setAmount]             = useState('')
  const [filterGroup, setFilterGroup]   = useState('ALL')
  const [txStep, setTxStep]             = useState('idle')

  const { data: usdcBalance }  = useUSDCBalance(address)
  const { data: allowance }    = useUSDCAllowance(address, ADDRESSES.convictionHook)
  const { data: totalAlive }   = useTotalAliveConvictionLocked()

  const { writeContract, data: txHash } = useWriteContract()
  const { isLoading: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const filteredTeams = filterGroup === 'ALL'
    ? WORLD_CUP_TEAMS
    : WORLD_CUP_TEAMS.filter(t => t.group === filterGroup)

  const parsedAmount  = amount ? parseUSDC(amount) : 0n
  const needsApproval = allowance !== undefined && parsedAmount > 0n && allowance < parsedAmount

  function handleApprove() {
    setTxStep('approving')
    writeContract({
      address: ADDRESSES.mockUSDC,
      abi: MockUSDC_ABI,
      functionName: 'approve',
      args: [ADDRESSES.convictionHook, parsedAmount],
    })
  }

  function handleDeposit() {
    if (!selectedTeam || !parsedAmount) return
    setTxStep('depositing')
    writeContract({
      address: ADDRESSES.convictionHook,
      abi: ConvictionHook_ABI,
      functionName: 'depositConviction',
      args: [selectedTeam.name, parsedAmount],
    })
  }

  function handleFaucet() {
    writeContract({
      address: ADDRESSES.mockUSDC,
      abi: MockUSDC_ABI,
      functionName: 'faucet',
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <IconBall size={28} className="text-stadium-green" />
          <div>
            <h1 className="section-title">CONVICTION</h1>
            <p className="section-subtitle">Back a team. Earn Survivor Yield. Win the Champion Pool.</p>
          </div>
        </div>
        {isConnected && (
          <div className="flex flex-col items-end gap-1">
            <div className="text-sm text-stadium-muted">Your USDC Balance</div>
            <div className="text-xl font-bold text-stadium-text">${formatUSDC(usdcBalance)}</div>
            <button onClick={handleFaucet} className="btn-secondary text-xs py-1 px-3">
              Claim 1,000 USDC Faucet
            </button>
          </div>
        )}
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="flex justify-center mb-2 text-stadium-green"><IconCoins size={22} /></div>
          <div className="stat-value text-stadium-green">${formatUSDC(totalAlive)}</div>
          <div className="stat-label">Total Locked</div>
        </div>
        <div className="card text-center">
          <div className="flex justify-center mb-2 text-stadium-muted"><IconBall size={22} /></div>
          <div className="stat-value">32</div>
          <div className="stat-label">Teams</div>
        </div>
        <div className="card text-center">
          <div className="flex justify-center mb-2 text-stadium-gold"><IconLock size={22} /></div>
          <div className="stat-value text-stadium-gold">10%</div>
          <div className="stat-label">Survivor Yield Rate</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Team Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stadium-text">Select Your Team</h2>
            <div className="flex items-center gap-1 flex-wrap">
              {['ALL', ...GROUPS].map(g => (
                <button
                  key={g}
                  onClick={() => setFilterGroup(g)}
                  className={`text-xs px-2.5 py-1 transition-colors ${
                    filterGroup === g
                      ? 'bg-stadium-green text-stadium-dark font-semibold'
                      : 'text-stadium-muted hover:text-stadium-text border border-stadium-border'
                  }`}
                >
                  {g === 'ALL' ? 'All' : `Group ${g}`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
            {filteredTeams.map(team => (
              <TeamCard
                key={team.name}
                team={team}
                isSelected={selectedTeam?.name === team.name}
                onSelect={() => setSelectedTeam(team)}
                userAddress={address}
              />
            ))}
          </div>
        </div>

        {/* Deposit Panel */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-stadium-text mb-4">Deposit CONVICTION</h2>

            {!isConnected ? (
              <div className="text-center py-6">
                <p className="text-stadium-muted mb-4 text-sm">Connect your wallet to back a team</p>
                <ConnectButton />
              </div>
            ) : !selectedTeam ? (
              <div className="text-center py-6 text-stadium-muted text-sm">
                Select a team to back
              </div>
            ) : (
              <DepositForm
                team={selectedTeam}
                amount={amount}
                setAmount={setAmount}
                usdcBalance={usdcBalance}
                needsApproval={needsApproval}
                txStep={txStep}
                txPending={txPending}
                txSuccess={txSuccess}
                onApprove={handleApprove}
                onDeposit={handleDeposit}
                userAddress={address}
              />
            )}
          </div>

          {/* Mechanics Info */}
          <div className="card border-stadium-green/20 bg-stadium-green/5 text-sm space-y-3">
            <div className="font-semibold text-stadium-green">Conviction Mechanics</div>
            <div className="text-stadium-muted space-y-2">
              {[
                'Earn yield automatically when any team is eliminated',
                'Claim yield anytime without touching principal',
                'Get 1.5× VAR bonus on your team\'s matches',
                'Eliminated: receive 50% back + all accrued yield',
                'Champion: receive 100% + yield + Champion Pool share',
              ].map(item => (
                <div key={item} className="flex items-start gap-2">
                  <IconCheck size={13} className="text-stadium-green mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isConnected && <UserPositions address={address} />}
    </div>
  )
}

function TeamCard({ team, isSelected, onSelect, userAddress }) {
  const { data: totalLocked } = useTotalConvictionLocked(team.name)
  const { data: backerCount } = useBackerCount(team.name)
  const { data: eliminated }  = useTeamEliminated(team.name)
  const { data: userDeposit } = useConvictionDeposit(userAddress, team.name)

  const hasPosition = userDeposit && userDeposit > 0n

  return (
    <button
      onClick={onSelect}
      disabled={eliminated}
      className={`text-left p-4 border transition-all duration-150 ${
        isSelected
          ? 'border-stadium-green bg-stadium-green/10'
          : eliminated
          ? 'border-stadium-border/30 opacity-40 cursor-not-allowed'
          : 'border-stadium-border hover:border-stadium-green/40 hover:bg-stadium-card/50'
      } ${hasPosition ? 'active-position' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{team.flag}</span>
          <span className="font-semibold text-stadium-text text-sm">{team.name}</span>
        </div>
        {eliminated && <span className="badge-red text-xs">OUT</span>}
        {hasPosition && !eliminated && <span className="badge-green text-xs">Backed</span>}
      </div>
      <div className="flex items-center justify-between text-xs text-stadium-muted">
        <span>Grp {team.group}</span>
        <span>{backerCount?.toString() || '0'} backers</span>
      </div>
      <div className="text-xs text-stadium-muted mt-1">
        ${formatUSDC(totalLocked)} locked
      </div>
      {hasPosition && (
        <div className="text-xs text-stadium-green mt-1 font-medium">
          Your stake: ${formatUSDC(userDeposit)}
        </div>
      )}
    </button>
  )
}

function DepositForm({ team, amount, setAmount, usdcBalance, needsApproval, txStep, txPending, txSuccess, onApprove, onDeposit, userAddress }) {
  const { data: userDeposit } = useConvictionDeposit(userAddress, team.name)
  const { data: accruedYield } = useAccruedYield(userAddress)
  const { data: eliminated }   = useTeamEliminated(team.name)

  const maxAmount = usdcBalance ? formatUSDC(usdcBalance).replace(/,/g, '') : '0'

  if (eliminated) {
    return (
      <div className="text-center py-4 text-red-400 text-sm flex items-center justify-center gap-2">
        <IconWarn size={16} /> {team.name} has been eliminated.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Team header */}
      <div className="flex items-center gap-3 p-3 bg-stadium-dark border border-stadium-border">
        <span className="text-3xl">{team.flag}</span>
        <div>
          <div className="font-semibold text-stadium-text">{team.name}</div>
          <div className="text-xs text-stadium-muted">Group {team.group} · Championship odds: {team.odds}x</div>
        </div>
      </div>

      {/* Current position */}
      {userDeposit > 0n && (
        <div className="bg-stadium-green/10 border border-stadium-green/20 p-3 text-sm">
          <div className="flex justify-between text-stadium-green">
            <span>Your stake</span>
            <span className="font-semibold">${formatUSDC(userDeposit)}</span>
          </div>
          <div className="flex justify-between text-stadium-muted mt-1">
            <span>Accrued yield</span>
            <span>${formatUSDC(accruedYield)}</span>
          </div>
        </div>
      )}

      {/* Amount input */}
      <div>
        <label className="text-sm text-stadium-muted mb-1.5 block">Amount (USDC)</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="100"
            min="1"
            className="input-field pr-16"
          />
          <button
            onClick={() => setAmount(maxAmount)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stadium-green hover:text-stadium-text transition-colors"
          >
            MAX
          </button>
        </div>
        <div className="text-xs text-stadium-muted mt-1">
          Balance: ${formatUSDC(usdcBalance)}
        </div>
      </div>

      {/* Action button */}
      {needsApproval ? (
        <button onClick={onApprove} disabled={txPending || !amount} className="btn-primary w-full">
          {txPending ? 'Approving...' : 'Approve USDC'}
        </button>
      ) : (
        <button onClick={onDeposit} disabled={txPending || !amount || !team} className="btn-primary w-full">
          {txPending ? 'Depositing...' : `Back ${team.name} with $${amount || '0'}`}
        </button>
      )}

      {txSuccess && (
        <div className="text-center text-stadium-green text-sm flex items-center justify-center gap-2">
          <IconCheck size={16} /> Conviction deposited successfully!
        </div>
      )}
    </div>
  )
}

function UserPositions({ address }) {
  const { data: accruedYield }  = useAccruedYield(address)
  const { writeContract, data: txHash } = useWriteContract()
  const { isLoading } = useWaitForTransactionReceipt({ hash: txHash })

  function handleClaimYield() {
    writeContract({
      address: ADDRESSES.convictionHook,
      abi: ConvictionHook_ABI,
      functionName: 'claimYield',
    })
  }

  const hasYield = accruedYield && accruedYield > 0n
  if (!hasYield) return null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-stadium-text">Accrued Survivor Yield</h2>
        <button onClick={handleClaimYield} disabled={isLoading} className="btn-primary py-2 px-4 text-sm">
          {isLoading ? 'Claiming...' : `Claim $${formatUSDC(accruedYield)}`}
        </button>
      </div>
      <div className="text-stadium-muted text-sm">
        You have <span className="text-stadium-green font-semibold">${formatUSDC(accruedYield)}</span> in
        unclaimed Survivor Yield from team eliminations.
      </div>
    </div>
  )
}
