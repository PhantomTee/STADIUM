import React, { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ADDRESSES, WORLD_CUP_TEAMS, formatUSDC, parseUSDC } from '../utils/contracts'
import { MockUSDC_ABI, ConvictionVault_ABI } from '../abis'
import {
  useUSDCBalance, useUSDCAllowance, useFaucetCooldown,
  useConvictionDeposit, usePendingYield,
  useTeamTotalDeposit, useTeamEliminated, useTeamChampion,
  useBackerCount, useTotalAliveDeposits, usePrincipalClaimed,
  useConvictionCloseTime,
} from '../hooks/useContracts'

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export default function Conviction() {
  const { address, isConnected } = useAccount()
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [filterGroup, setFilterGroup]   = useState('ALL')

  const { data: usdcBalance }    = useUSDCBalance(address)
  const { data: allowance }      = useUSDCAllowance(address, ADDRESSES.convictionVault)
  const { data: totalAlive }     = useTotalAliveDeposits()
  const { data: closeTime }      = useConvictionCloseTime()
  const { data: lastFaucetTime } = useFaucetCooldown(address)

  // Faucet has its own isolated write hook so it never bleeds into DepositForm
  const { writeContract: writeFaucet, data: faucetHash } = useWriteContract()
  const { isLoading: faucetPending, isSuccess: faucetSuccess } = useWaitForTransactionReceipt({ hash: faucetHash })

  const nowSec = BigInt(Math.floor(Date.now() / 1000))
  const convictionOpen = !closeTime || closeTime === 0n || nowSec < closeTime

  const FAUCET_COOLDOWN = 24n * 60n * 60n
  const faucetReady = !lastFaucetTime || nowSec >= lastFaucetTime + FAUCET_COOLDOWN
  const faucetUnlocksAt = lastFaucetTime ? lastFaucetTime + FAUCET_COOLDOWN : null
  const faucetCooldownLabel = (() => {
    if (!faucetUnlocksAt || faucetReady) return null
    const secsLeft = Number(faucetUnlocksAt - nowSec)
    const h = Math.floor(secsLeft / 3600)
    const m = Math.floor((secsLeft % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  })()

  const filteredTeams = filterGroup === 'ALL'
    ? WORLD_CUP_TEAMS
    : WORLD_CUP_TEAMS.filter(t => t.group === filterGroup)

  function handleFaucet() {
    writeFaucet({ address: ADDRESSES.mockUSDC, abi: MockUSDC_ABI, functionName: 'faucet' })
  }

  function handleSelectTeam(team) {
    // Toggle off if already selected, otherwise select
    setSelectedTeam(prev => prev?.id === team.id ? null : team)
  }

  const depositFormProps = { usdcBalance, allowance, userAddress: address, convictionOpen }

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
            <button
              onClick={handleFaucet}
              disabled={faucetPending || !faucetReady}
              className="btn-secondary text-xs py-1.5 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {faucetPending  ? 'Claiming…'
               : !faucetReady ? `Cooldown ${faucetCooldownLabel}`
               : 'Claim 1,000 USDC'}
            </button>
          </div>
        )}
      </div>

      {/* Status Banner */}
      {closeTime && closeTime > 0n && (
        convictionOpen ? (
          <div className="bg-stadium-gold/10 border border-stadium-gold/30 p-4 text-center space-y-1">
            <div className="text-xs font-bold text-stadium-gold uppercase tracking-widest font-mono">
              CONVICTION closes at tournament kickoff
            </div>
            <div className="text-xs text-stadium-muted font-mono">
              Back your team before the first whistle — {new Date(Number(closeTime) * 1000).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="bg-red-500/10 border border-red-500/20 p-4 text-center space-y-1">
            <div className="text-xs font-bold text-red-400 uppercase tracking-widest font-mono">CONVICTION Closed</div>
            <div className="text-xs text-stadium-muted font-mono">The tournament has kicked off. Deposits and withdrawals are locked.</div>
          </div>
        )
      )}

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-px bg-stadium-border text-sm">
        {[
          { label: 'Total Locked',        value: `$${formatUSDC(totalAlive)}`, accent: 'text-stadium-green' },
          { label: 'Teams Competing',     value: '48',                          accent: 'text-stadium-text'  },
          { label: 'Survivor Yield Rate', value: '10% of forfeited',            accent: 'text-stadium-gold'  },
        ].map(s => (
          <div key={s.label} className="bg-stadium-card p-5 text-center">
            <div className={`text-2xl font-black tracking-tight ${s.accent}`}>{s.value}</div>
            <div className="text-xs text-stadium-muted uppercase tracking-widest mt-1 font-mono">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── Team grid ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-stadium-text uppercase tracking-widest">Select Your Team</div>
            <div className="flex flex-wrap gap-px bg-stadium-border">
              {['ALL', ...GROUPS].map(g => (
                <button
                  key={g}
                  onClick={() => setFilterGroup(g)}
                  className={`text-xs px-2.5 py-1.5 font-mono font-bold transition-colors ${
                    filterGroup === g
                      ? 'bg-stadium-green text-stadium-dark'
                      : 'bg-stadium-card text-stadium-muted hover:text-stadium-text'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-px bg-stadium-border max-h-[520px] overflow-y-auto">
            {filteredTeams.map(team => (
              <React.Fragment key={team.id}>
                <TeamCard
                  team={team}
                  isSelected={selectedTeam?.id === team.id}
                  onSelect={() => handleSelectTeam(team)}
                  userAddress={address}
                />

                {/* Mobile inline dropdown — expands right below the tapped team.
                    Hidden on lg+ where the sidebar panel takes over. */}
                {selectedTeam?.id === team.id && (
                  <div className="col-span-full lg:hidden border-t-2 border-stadium-green bg-stadium-dark">
                    {!isConnected ? (
                      <div className="p-6 text-center space-y-4">
                        <p className="text-stadium-muted text-sm font-mono">Connect to back a team</p>
                        <ConnectButton />
                      </div>
                    ) : (
                      <div className="p-4">
                        <DepositForm key={team.id} team={team} {...depositFormProps} />
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Mechanics — shown below team list on mobile */}
          <div className="lg:hidden bg-stadium-card border border-stadium-green/20 p-5 space-y-3">
            <MechanicsCard />
          </div>
        </div>

        {/* ── Desktop sidebar ────────────────────────────────────────────── */}
        <div className="hidden lg:flex lg:flex-col gap-4">
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
              /* key={selectedTeam.id} remounts DepositForm on team change,
                 resetting all tx state so no stale success messages appear */
              <DepositForm key={selectedTeam.id} team={selectedTeam} {...depositFormProps} />
            )}
          </div>

          <MechanicsCard />
        </div>
      </div>

      {isConnected && <UserPositions address={address} />}
    </div>
  )
}

// ── TeamCard ──────────────────────────────────────────────────────────────────

function TeamCard({ team, isSelected, onSelect, userAddress }) {
  const { data: totalLocked } = useTeamTotalDeposit(team.id)
  const { data: backerCount } = useBackerCount(team.id)
  const { data: eliminated }  = useTeamEliminated(team.id)
  const { data: champion }    = useTeamChampion(team.id)
  const { data: userDeposit } = useConvictionDeposit(userAddress, team.id)

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
          : champion
          ? 'border-l-stadium-gold bg-stadium-card'
          : 'border-l-transparent bg-stadium-card hover:border-l-stadium-green/40 hover:bg-stadium-dark'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{team.flag}</span>
          <span className="font-bold text-stadium-text text-sm uppercase tracking-tight">{team.name}</span>
        </div>
        <div className="flex gap-1">
          {eliminated  && <span className="badge-red">OUT</span>}
          {champion    && <span className="badge-gold">CHAMPION</span>}
          {hasPosition && !eliminated && !champion && <span className="badge-green">Backed</span>}
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

// ── DepositForm ───────────────────────────────────────────────────────────────
// Owns all its own tx hooks so state never leaks from other actions.
// Parent keys this by team.id — remounts on team change, clearing tx history.

function DepositForm({ team, usdcBalance, allowance, userAddress, convictionOpen }) {
  const [amount, setAmount]             = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  const { data: userDeposit }      = useConvictionDeposit(userAddress, team.id)
  const { data: pendingYield }     = usePendingYield(userAddress)
  const { data: eliminated }       = useTeamEliminated(team.id)
  const { data: champion }         = useTeamChampion(team.id)
  const { data: principalClaimed } = usePrincipalClaimed(userAddress, team.id)

  const { writeContract: writeApprove,  data: approveTxHash  } = useWriteContract()
  const { isLoading: approvePending, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })

  const { writeContract: writeDeposit,  data: depositTxHash  } = useWriteContract()
  const { isLoading: depositPending, isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositTxHash })

  const { writeContract: writeClaim,    data: claimTxHash    } = useWriteContract()
  const { isLoading: claimPending }                             = useWaitForTransactionReceipt({ hash: claimTxHash })

  const { writeContract: writeWithdraw, data: withdrawHash   } = useWriteContract()
  const { isLoading: withdrawPending, isSuccess: withdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash })

  const parsedAmount   = amount         ? parseUSDC(amount)         : 0n
  const parsedWithdraw = withdrawAmount ? parseUSDC(withdrawAmount) : 0n
  // Default to requiring approval while allowance is still loading (undefined).
  // Showing Approve is always safe; showing Deposit without allowance causes a revert.
  const needsApproval  = parsedAmount > 0n && (allowance === undefined || allowance < parsedAmount)
  const maxAmount      = usdcBalance ? formatUSDC(usdcBalance).replace(/,/g, '') : '0'
  const maxWithdraw    = userDeposit ? formatUSDC(userDeposit).replace(/,/g, '') : '0'
  const txPending      = approvePending || depositPending

  function handleApprove() {
    writeApprove({
      address: ADDRESSES.mockUSDC,
      abi: MockUSDC_ABI,
      functionName: 'approve',
      args: [ADDRESSES.convictionVault, parsedAmount],
    })
  }

  function handleDeposit() {
    if (!parsedAmount) return
    writeDeposit({
      address: ADDRESSES.convictionVault,
      abi: ConvictionVault_ABI,
      functionName: 'depositConviction',
      args: [team.id, parsedAmount],
    })
  }

  function handleClaimEliminated() {
    writeClaim({
      address: ADDRESSES.convictionVault,
      abi: ConvictionVault_ABI,
      functionName: 'claimEliminatedPosition',
      args: [team.id],
    })
  }

  function handleClaimChampion() {
    writeClaim({
      address: ADDRESSES.convictionVault,
      abi: ConvictionVault_ABI,
      functionName: 'claimChampionPrincipal',
      args: [team.id],
    })
  }

  function handleWithdraw() {
    if (!parsedWithdraw) return
    writeWithdraw({
      address: ADDRESSES.convictionVault,
      abi: ConvictionVault_ABI,
      functionName: 'withdrawConviction',
      args: [team.id, parsedWithdraw],
    })
  }

  // ── Eliminated with claimable position ───────────────────────────────────
  if (eliminated && userDeposit > 0n && !principalClaimed) {
    return (
      <div className="space-y-4">
        <TeamHeader team={team} sub="Eliminated" subColor="text-red-400" />
        <div className="bg-red-500/10 border border-red-500/20 p-3 text-xs font-mono">
          <div className="flex justify-between text-red-400">
            <span>Original stake</span>
            <span className="font-bold">${formatUSDC(userDeposit)}</span>
          </div>
          <div className="flex justify-between text-stadium-muted mt-1">
            <span>Refund (50%)</span>
            <span className="font-bold text-stadium-text">${formatUSDC(userDeposit ? userDeposit / 2n : 0n)}</span>
          </div>
        </div>
        <button onClick={handleClaimEliminated} disabled={claimPending} className="btn-primary w-full">
          {claimPending ? 'Claiming…' : 'Claim 50% Refund'}
        </button>
      </div>
    )
  }

  if (eliminated) {
    return <div className="text-center py-6 text-red-400 text-sm font-mono">{team.name} has been eliminated.</div>
  }

  // ── Champion with claimable position ─────────────────────────────────────
  if (champion && userDeposit > 0n && !principalClaimed) {
    return (
      <div className="space-y-4">
        <TeamHeader team={team} sub="World Cup Champion" subColor="text-stadium-gold" />
        <div className="bg-stadium-gold/10 border border-stadium-gold/30 p-3 text-xs font-mono">
          <div className="flex justify-between text-stadium-gold">
            <span>Full principal return</span>
            <span className="font-bold">${formatUSDC(userDeposit)}</span>
          </div>
        </div>
        <button onClick={handleClaimChampion} disabled={claimPending} className="btn-primary w-full">
          {claimPending ? 'Claiming…' : 'Claim Champion Principal'}
        </button>
      </div>
    )
  }

  // ── Conviction window closed ──────────────────────────────────────────────
  if (!convictionOpen) {
    return (
      <div className="space-y-4">
        <TeamHeader team={team} sub={`Group ${team.group} · Odds: ${team.odds}x`} />
        <div className="bg-red-500/10 border border-red-500/20 p-4 text-center space-y-2">
          <div className="text-xs font-bold text-red-400 uppercase tracking-widest font-mono">CONVICTION Closed</div>
          <div className="text-xs text-stadium-muted font-mono">The tournament has kicked off. Deposits are locked.</div>
        </div>
        {userDeposit > 0n && <PositionSummary userDeposit={userDeposit} pendingYield={pendingYield} />}
      </div>
    )
  }

  // ── Active — conviction window open ──────────────────────────────────────
  return (
    <div className="space-y-4">
      <TeamHeader team={team} sub={`Group ${team.group} · Odds: ${team.odds}x`} />

      {userDeposit > 0n && <PositionSummary userDeposit={userDeposit} pendingYield={pendingYield} />}

      {/* Deposit input */}
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
        <div className="text-xs text-stadium-muted font-mono mt-1">Balance: ${formatUSDC(usdcBalance)}</div>
      </div>

      {needsApproval ? (
        <button onClick={handleApprove} disabled={txPending || !amount} className="btn-primary w-full">
          {approvePending ? 'Approving…' : 'Approve USDC'}
        </button>
      ) : (
        <button onClick={handleDeposit} disabled={txPending || !amount} className="btn-primary w-full">
          {depositPending ? 'Depositing…' : `Back ${team.name} with $${amount || '0'}`}
        </button>
      )}

      {approveSuccess && !depositSuccess && (
        <div className="text-center text-stadium-muted text-xs font-mono">
          Approved — now enter an amount and deposit
        </div>
      )}

      {depositSuccess && (
        <div className="text-center text-stadium-green text-sm font-bold font-mono uppercase tracking-widest">
          Conviction deposited successfully
        </div>
      )}

      {/* Withdraw section */}
      {userDeposit > 0n && (
        <div className="border-t border-stadium-border/40 pt-4 space-y-3">
          <div className="text-xs font-bold text-stadium-muted uppercase tracking-widest">Withdraw Before Kickoff</div>
          <div className="relative">
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="0"
              min="1"
              className="input-field pr-16"
            />
            <button
              onClick={() => setWithdrawAmount(maxWithdraw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stadium-green hover:text-stadium-text uppercase"
            >
              MAX
            </button>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={withdrawPending || !withdrawAmount || parsedWithdraw === 0n}
            className="btn-secondary w-full"
          >
            {withdrawPending ? 'Withdrawing…' : 'Withdraw'}
          </button>
          {withdrawSuccess && (
            <div className="text-center text-stadium-green text-sm font-bold font-mono uppercase tracking-widest">
              Withdrawal successful
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Small shared sub-components ───────────────────────────────────────────────

function TeamHeader({ team, sub, subColor = 'text-stadium-muted' }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-stadium-dark border border-stadium-border">
      <span className="text-3xl">{team.flag}</span>
      <div>
        <div className="font-bold text-stadium-text uppercase tracking-tight">{team.name}</div>
        <div className={`text-xs font-mono ${subColor}`}>{sub}</div>
      </div>
    </div>
  )
}

function PositionSummary({ userDeposit, pendingYield }) {
  return (
    <div className="bg-stadium-green/10 border border-stadium-green/20 p-3 text-xs font-mono">
      <div className="flex justify-between text-stadium-green">
        <span>Your stake</span>
        <span className="font-bold">${formatUSDC(userDeposit)}</span>
      </div>
      <div className="flex justify-between text-stadium-muted mt-1">
        <span>Pending yield</span>
        <span>${formatUSDC(pendingYield)}</span>
      </div>
    </div>
  )
}

function MechanicsCard() {
  return (
    <div className="bg-stadium-card border border-stadium-green/20 p-5 space-y-3">
      <div className="text-xs font-bold text-stadium-green uppercase tracking-widest">Conviction Mechanics</div>
      <div className="space-y-2">
        {[
          'CONVICTION closes at tournament kickoff — back your team before the first whistle',
          'Withdraw anytime before kickoff — locked after',
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
  )
}

// ── UserPositions ─────────────────────────────────────────────────────────────

function UserPositions({ address }) {
  const { data: pending } = usePendingYield(address)
  const { writeContract, data: txHash } = useWriteContract()
  const { isLoading } = useWaitForTransactionReceipt({ hash: txHash })

  function handleClaimYield() {
    writeContract({
      address: ADDRESSES.convictionVault,
      abi: ConvictionVault_ABI,
      functionName: 'claimYield',
    })
  }

  if (!pending || pending === 0n) return null

  return (
    <div className="card border-stadium-green/30">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-1">Accrued Survivor Yield</div>
          <div className="text-2xl font-black text-stadium-green">${formatUSDC(pending)}</div>
          <div className="text-xs text-stadium-muted font-mono mt-1">From team eliminations</div>
        </div>
        <button onClick={handleClaimYield} disabled={isLoading} className="btn-primary py-3 px-6">
          {isLoading ? 'Claiming…' : 'Claim All'}
        </button>
      </div>
    </div>
  )
}
