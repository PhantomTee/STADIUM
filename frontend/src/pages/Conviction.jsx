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
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="section-title">CONVICTION</h1>
          <p className="section-subtitle">Back a team. Earn Survivor Yield. Win the Champion Pool.</p>
        </div>
        {isConnected && (
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-stadium-muted font-mono uppercase tracking-widest">Wallet Balance</div>
            <div className="text-2xl font-black text-stadium-text">${formatUSDC(usdcBalance)}</div>
            <button onClick={handleFaucet} className="btn-secondary text-xs py-1.5 px-4">
              Claim 1,000 USDC
            </button>
          </div>
        )}
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-px bg-stadium-border text-sm">
        {[
          { label: 'Total Locked',       value: `$${formatUSDC(totalAlive)}`, accent: 'text-stadium-green' },
          { label: 'Teams Competing',    value: '32',                          accent: 'text-stadium-text'  },
          { label: 'Survivor Yield Rate', value: '10%',                        accent: 'text-stadium-gold'  },
        ].map(s => (
          <div key={s.label} className="bg-stadium-card p-5 text-center">
            <div className={`text-2xl font-black tracking-tight ${s.accent}`}>{s.value}</div>
            <div className="text-xs text-stadium-muted uppercase tracking-widest mt-1 font-mono">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Team Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-stadium-text uppercase tracking-widest">Select Your Team</div>
            <div className="flex items-center gap-px bg-stadium-border">
              {['ALL', ...GROUPS].map(g => (
                <button
                  key={g}
                  onClick={() => setFilterGroup(g)}
                  className={`text-xs px-3 py-2 font-mono font-bold transition-colors ${
                    filterGroup === g
                      ? 'bg-stadium-green text-stadium-dark'
                      : 'bg-stadium-card text-stadium-muted hover:text-stadium-text'
                  }`}
                >
                  {g === 'ALL' ? 'ALL' : g}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-px bg-stadium-border max-h-[520px] overflow-y-auto">
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
            <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-5">Deposit CONVICTION</div>

            {!isConnected ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-stadium-muted text-sm font-mono">Connect to back a team</p>
                <ConnectButton />
              </div>
            ) : !selectedTeam ? (
              <div className="text-center py-8 text-stadium-muted text-sm font-mono">
                — Select a team to back —
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

          {/* Mechanics */}
          <div className="bg-stadium-card border border-stadium-green/20 p-5 space-y-3">
            <div className="text-xs font-bold text-stadium-green uppercase tracking-widest">Conviction Mechanics</div>
            <div className="space-y-2">
              {[
                'Earn yield automatically on every elimination',
                'Claim yield anytime — principal stays locked',
                'Get 1.5× VAR bonus on your team\'s matches',
                'Eliminated: receive 50% back + all accrued yield',
                'Champion: 100% principal + yield + Champion Pool',
              ].map(item => (
                <div key={item} className="flex items-start gap-3 text-xs font-mono text-stadium-muted">
                  <span className="text-stadium-green mt-0.5 flex-shrink-0">—</span>
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
      className={`text-left p-4 transition-all border-l-2 ${
        isSelected
          ? 'border-l-stadium-green bg-stadium-green/10'
          : eliminated
          ? 'border-l-transparent bg-stadium-card opacity-40 cursor-not-allowed'
          : 'border-l-transparent bg-stadium-card hover:border-l-stadium-green/40 hover:bg-stadium-dark'
      } ${hasPosition && !eliminated ? 'active-position' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{team.flag}</span>
          <span className="font-bold text-stadium-text text-sm uppercase tracking-tight">{team.name}</span>
        </div>
        <div className="flex gap-1">
          {eliminated && <span className="badge-red">OUT</span>}
          {hasPosition && !eliminated && <span className="badge-green">Backed</span>}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs font-mono text-stadium-muted">
        <span>Group {team.group}</span>
        <span>{backerCount?.toString() || '0'} backers</span>
      </div>
      <div className="text-xs text-stadium-muted font-mono mt-1">
        ${formatUSDC(totalLocked)} locked
      </div>
      {hasPosition && (
        <div className="text-xs text-stadium-green font-bold mt-1 font-mono">
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
      <div className="text-center py-6 text-red-400 text-sm font-mono">
        {team.name} has been eliminated.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Team header */}
      <div className="flex items-center gap-3 p-3 bg-stadium-dark border border-stadium-border">
        <span className="text-3xl">{team.flag}</span>
        <div>
          <div className="font-bold text-stadium-text uppercase tracking-tight">{team.name}</div>
          <div className="text-xs text-stadium-muted font-mono">Group {team.group} · Odds: {team.odds}x</div>
        </div>
      </div>

      {/* Current position */}
      {userDeposit > 0n && (
        <div className="bg-stadium-green/10 border border-stadium-green/20 p-3 text-xs font-mono">
          <div className="flex justify-between text-stadium-green">
            <span>Your stake</span>
            <span className="font-bold">${formatUSDC(userDeposit)}</span>
          </div>
          <div className="flex justify-between text-stadium-muted mt-1">
            <span>Accrued yield</span>
            <span>${formatUSDC(accruedYield)}</span>
          </div>
        </div>
      )}

      {/* Amount input */}
      <div>
        <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Amount (USDC)</label>
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stadium-green hover:text-stadium-text uppercase"
          >
            MAX
          </button>
        </div>
        <div className="text-xs text-stadium-muted font-mono mt-1">
          Balance: ${formatUSDC(usdcBalance)}
        </div>
      </div>

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
        <div className="text-center text-stadium-green text-sm font-bold font-mono uppercase tracking-widest">
          Conviction deposited successfully
        </div>
      )}
    </div>
  )
}

function UserPositions({ address }) {
  const { data: accruedYield } = useAccruedYield(address)
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
    <div className="card border-stadium-green/30">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-1">Accrued Survivor Yield</div>
          <div className="text-2xl font-black text-stadium-green">${formatUSDC(accruedYield)}</div>
          <div className="text-xs text-stadium-muted font-mono mt-1">From team eliminations</div>
        </div>
        <button onClick={handleClaimYield} disabled={isLoading} className="btn-primary py-3 px-6">
          {isLoading ? 'Claiming...' : 'Claim All'}
        </button>
      </div>
    </div>
  )
}
