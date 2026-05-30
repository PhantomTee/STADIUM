import React, { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { WORLD_CUP_TEAMS, formatUSDC, ADDRESSES } from '../utils/contracts'
import {
  useTeamMomentum, useTeamEliminated, useTeamTotalDeposit,
  useHookPaused, useHookFeeConfig, useFactoryTeamPoolId, useFactoryTeamToken,
} from '../hooks/useContracts'
import {
  StadiumRouter_ABI, MockUSDC_ABI, TeamToken_ABI, TeamFactory_ABI,
  StadiumHook_ABI, ConvictionVault_ABI,
} from '../abis/index.js'
import { useToast } from '../components/Toast'
import ShareButton from '../components/ShareButton'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

// V4 price limits (TickMath.MIN_SQRT_PRICE + 1 / MAX_SQRT_PRICE - 1)
const MIN_SQRT_LIMIT = 4295128740n
const MAX_SQRT_LIMIT = 1461446703485210103287273052203988822378723970341n

// LPFeeLibrary.DYNAMIC_FEE_FLAG = 0x800000
const DYNAMIC_FEE_FLAG = 0x800000
const TICK_SPACING = 60

const TOKEN_UNIT = 10n ** 18n  // team tokens: 18 decimals

function _isV4SimError(err) {
  if (!err) return false
  const msg = (err?.message || err?.shortMessage || '').toLowerCase()
  return (
    msg.includes('third-party') ||
    msg.includes('execution error') ||
    msg.includes('simulation') ||
    msg.includes('estimategas') ||
    msg.includes('eth_estimategas')
  )
}

function formatToken(raw) {
  if (!raw) return '0.00'
  const whole = raw / TOKEN_UNIT
  const frac  = raw % TOKEN_UNIT
  const n = Number(whole) + Number(frac) / 1e18
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function parseTokenAmount(str) {
  if (!str) return 0n
  const [whole, frac = ''] = str.split('.')
  const fracPadded = frac.slice(0, 18).padEnd(18, '0')
  return BigInt(whole || '0') * TOKEN_UNIT + BigInt(fracPadded)
}

function parseUSDCAmount(str) {
  if (!str) return 0n
  const [whole, frac = ''] = str.split('.')
  const fracPadded = frac.slice(0, 6).padEnd(6, '0')
  return BigInt(whole || '0') * 1_000_000n + BigInt(fracPadded)
}

export default function Trade() {
  const { isConnected } = useAccount()
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const swapPanelRef = useRef(null)

  const hookDeployed = ADDRESSES.stadiumHook !== ZERO_ADDR

  function handleSelectTeam(id) {
    setSelectedTeamId(prev => prev === id ? null : id)
    // On mobile (< lg breakpoint) scroll to the swap panel
    if (id !== selectedTeamId && window.innerWidth < 1024) {
      setTimeout(() => swapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }

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
          <TeamPoolGrid onSelect={handleSelectTeam} selectedId={selectedTeamId} />
        </div>
        <div ref={swapPanelRef}>
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
          {feeConfig ? `${(feeConfig.groupStageFee / 10000).toFixed(2)}%` : '—'}
        </div>
        <div className="stat-label">Group Stage Fee</div>
      </div>
      <div className="card">
        <div className="stat-value text-sm text-stadium-text font-mono">
          {feeConfig ? `${(feeConfig.knockoutFee / 10000).toFixed(2)}%` : '—'}
        </div>
        <div className="stat-label">Knockout Fee</div>
      </div>
      <div className="card">
        <div className="stat-value text-sm text-stadium-gold font-mono">
          {feeConfig ? `-${(feeConfig.convictionDiscount / 10000).toFixed(2)}%` : '—'}
        </div>
        <div className="stat-label">Conviction Discount</div>
      </div>
    </div>
  )
}

const SORT_OPTIONS = [
  { key: 'momentum', label: 'Momentum' },
  { key: 'locked',   label: 'Locked'   },
  { key: 'name',     label: 'A–Z'      },
]

function TeamPoolGrid({ onSelect, selectedId }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('momentum')

  // Batch-read momentum and locked for all 48 teams so we can sort without
  // waiting for per-row lazy fetches
  const { data: momentumData } = useReadContracts({
    contracts: WORLD_CUP_TEAMS.map(t => ({
      address: ADDRESSES.stadiumHook,
      abi: StadiumHook_ABI,
      functionName: 'teamMomentum',
      args: [t.id],
    })),
    query: { refetchInterval: 20_000 },
  })
  const { data: lockedData } = useReadContracts({
    contracts: WORLD_CUP_TEAMS.map(t => ({
      address: ADDRESSES.convictionVault,
      abi: ConvictionVault_ABI,
      functionName: 'teamTotalDeposit',
      args: [t.id],
    })),
    query: { refetchInterval: 20_000 },
  })

  const momentumMap = Object.fromEntries(
    WORLD_CUP_TEAMS.map((t, i) => [t.id, momentumData?.[i]?.result ?? 0n])
  )
  const lockedMap = Object.fromEntries(
    WORLD_CUP_TEAMS.map((t, i) => [t.id, lockedData?.[i]?.result ?? 0n])
  )

  const filtered = WORLD_CUP_TEAMS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) || t.group === search.toUpperCase()
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'momentum') return momentumMap[b.id] > momentumMap[a.id] ? 1 : momentumMap[b.id] < momentumMap[a.id] ? -1 : 0
    if (sortBy === 'locked')   return lockedMap[b.id]   > lockedMap[a.id]   ? 1 : lockedMap[b.id]   < lockedMap[a.id]   ? -1 : 0
    return a.name.localeCompare(b.name)
  })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="font-semibold text-stadium-text text-sm uppercase tracking-widest">Team Pools</h2>
        <div className="flex items-center gap-2">
          {/* Sort buttons */}
          <div className="flex gap-px bg-stadium-border">
            {SORT_OPTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                  sortBy === s.key
                    ? 'bg-stadium-green/10 text-stadium-green'
                    : 'bg-stadium-card text-stadium-muted hover:text-stadium-text'
                }`}
              >
                {s.label}{sortBy === s.key ? ' ↓' : ''}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-stadium-dark border border-stadium-border text-stadium-text text-xs px-3 py-1.5 font-mono w-28 focus:outline-none focus:border-stadium-green"
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-mono text-stadium-muted uppercase tracking-widest border-b border-stadium-border mb-px">
        <div className="col-span-5">Team</div>
        <button onClick={() => setSortBy('momentum')} className={`col-span-3 text-right transition-colors ${sortBy === 'momentum' ? 'text-stadium-green' : 'hover:text-stadium-text'}`}>Momentum</button>
        <button onClick={() => setSortBy('locked')}   className={`col-span-2 text-right transition-colors ${sortBy === 'locked'   ? 'text-stadium-green' : 'hover:text-stadium-text'}`}>Locked</button>
        <div className="col-span-2 text-right">Pool</div>
      </div>

      <div className="space-y-px bg-stadium-border max-h-[600px] overflow-y-auto">
        {sorted.map(team => (
          <TeamPoolRow
            key={team.id}
            team={team}
            selected={selectedId === team.id}
            onClick={() => onSelect(team.id === selectedId ? null : team.id)}
            momentum={momentumMap[team.id]}
            locked={lockedMap[team.id]}
          />
        ))}
      </div>
    </div>
  )
}

function TeamPoolRow({ team, selected, onClick, momentum, locked }) {
  const { data: eliminated } = useTeamEliminated(team.id)
  const { data: poolId }     = useFactoryTeamPoolId(team.id)

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
        <div className="text-xs font-mono text-stadium-green font-bold">{formatUSDC(momentum)}</div>
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
        <div className="text-stadium-muted text-sm font-mono">Select a team to trade</div>
        <div className="text-stadium-border text-xs font-mono mt-2">← click any row</div>
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
        <SwapForm team={team} isConnected={isConnected} />
      )}
    </div>
  )
}

function SwapForm({ team, isConnected }) {
  const { address } = useAccount()
  const toast = useToast()

  const [amountIn, setAmountIn]       = useState('')
  const [direction, setDirection]     = useState('buy')  // 'buy' = USDC→token
  const [swapDone, setSwapDone]       = useState(false)

  const routerAddr    = ADDRESSES.stadiumRouter
  const routerReady   = routerAddr !== ZERO_ADDR
  const usdcAddr      = ADDRESSES.mockUSDC
  const hookAddr      = ADDRESSES.stadiumHook

  // Team token address from factory
  const { data: teamTokenAddr } = useFactoryTeamToken(team.id)

  // Determine sorted currency order (V4 requires currency0 < currency1 by address)
  const usdcIsC0 = teamTokenAddr
    ? usdcAddr.toLowerCase() < teamTokenAddr.toLowerCase()
    : true
  const currency0 = usdcIsC0 ? usdcAddr      : (teamTokenAddr ?? ZERO_ADDR)
  const currency1 = usdcIsC0 ? (teamTokenAddr ?? ZERO_ADDR) : usdcAddr

  // zeroForOne: are we sending currency0 to receive currency1?
  const zeroForOne = direction === 'buy' ? usdcIsC0 : !usdcIsC0

  // Which token the user is spending
  const inputAddr     = direction === 'buy' ? usdcAddr : (teamTokenAddr ?? ZERO_ADDR)
  const inputIsUSDC   = direction === 'buy'
  const parsedAmount  = inputIsUSDC ? parseUSDCAmount(amountIn) : parseTokenAmount(amountIn)

  // Balances
  const { data: usdcBal,  refetch: refetchUSDC  } = useReadContract({
    address: usdcAddr,
    abi: MockUSDC_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: !!address },
  })
  const { data: tokenBal, refetch: refetchToken } = useReadContract({
    address: teamTokenAddr,
    abi: TeamToken_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: !!address && !!teamTokenAddr },
  })

  // Allowance of input token to router
  const inputABI = inputIsUSDC ? MockUSDC_ABI : TeamToken_ABI
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: inputAddr,
    abi: inputABI,
    functionName: 'allowance',
    args: [address, routerAddr],
    query: { enabled: !!address && !!inputAddr && routerReady },
  })

  const needsApproval = routerReady && !!parsedAmount && parsedAmount > 0n && (allowance ?? 0n) < parsedAmount

  // Approve
  const { writeContract: writeApprove, data: approveTxHash, isPending: approvePending, error: approveError } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })

  // Swap
  const { writeContract: writeSwap, data: swapTxHash, isPending: swapPending, error: swapError } = useWriteContract()
  const { isLoading: swapConfirming, isSuccess: swapSuccess } = useWaitForTransactionReceipt({ hash: swapTxHash })

  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance()
      toast('Approval confirmed — ready to swap', 'success')
    }
  }, [approveSuccess])

  useEffect(() => {
    if (swapSuccess) {
      refetchUSDC()
      refetchToken()
      setSwapDone(true)
      toast(`Swap complete — ${team.flag} ${team.name}`, 'success')
    }
  }, [swapSuccess])

  // Clear swapDone on direction / amount change
  useEffect(() => { setSwapDone(false) }, [direction, amountIn])

  const handleApprove = () => {
    writeApprove({
      address: inputAddr,
      abi: inputABI,
      functionName: 'approve',
      args: [routerAddr, parsedAmount],
      gas: 150_000n,
    })
  }

  const handleSwap = () => {
    if (!teamTokenAddr || !parsedAmount || parsedAmount === 0n) return

    const poolKey = {
      currency0,
      currency1,
      fee:         DYNAMIC_FEE_FLAG,
      tickSpacing: TICK_SPACING,
      hooks:       hookAddr,
    }

    const params = {
      zeroForOne,
      amountSpecified:   -parsedAmount,  // negative = exact-input
      sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_LIMIT : MAX_SQRT_LIMIT,
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)  // 20 min

    writeSwap({
      address: routerAddr,
      abi: StadiumRouter_ABI,
      functionName: 'swap',
      args: [poolKey, params, deadline],
      // Manual gas limit bypasses eth_estimateGas simulation, which OKX wallet
      // cannot handle for V4's re-entrant unlock → unlockCallback pattern.
      gas: 500_000n,
    })
  }

  const setMax = () => {
    if (direction === 'buy' && usdcBal)  setAmountIn(formatUSDC(usdcBal))
    if (direction === 'sell' && tokenBal) setAmountIn(formatToken(tokenBal))
  }

  if (!isConnected) {
    return (
      <div className="text-center py-4 space-y-3">
        <p className="text-xs text-stadium-muted font-mono">Connect wallet to swap</p>
        <ConnectButton />
      </div>
    )
  }

  if (!routerReady) {
    return (
      <div className="space-y-3">
        <div className="bg-stadium-gold/10 border border-stadium-gold/30 p-4 text-xs font-mono text-stadium-gold space-y-2">
          <div className="font-bold uppercase tracking-widest">Router Not Deployed</div>
          <p className="text-stadium-muted leading-relaxed">
            Deploy the StadiumRouter to enable on-chain V4 swaps:
          </p>
          <pre className="text-stadium-green text-[10px] leading-relaxed overflow-x-auto">
{`POOL_MANAGER_ADDRESS=0x16d7342D...
forge script script/DeployRouter.s.sol \\
  --rpc-url $XLAYER_RPC_URL --broadcast

# then add to frontend/.env:
VITE_STADIUM_ROUTER_ADDRESS=0x...`}
          </pre>
        </div>
        <SwapFormUI
          team={team} direction={direction} setDirection={setDirection}
          amountIn={amountIn} setAmountIn={setAmountIn}
          inputIsUSDC={inputIsUSDC} usdcBal={usdcBal} tokenBal={tokenBal}
          setMax={setMax} disabled={true}
          currency0={currency0} currency1={currency1}
        />
      </div>
    )
  }

  const busy = approvePending || approveConfirming || swapPending || swapConfirming
  const canAct = !!parsedAmount && parsedAmount > 0n && !busy && !!teamTokenAddr

  return (
    <div className="space-y-3">
      <SwapFormUI
        team={team} direction={direction} setDirection={setDirection}
        amountIn={amountIn} setAmountIn={setAmountIn}
        inputIsUSDC={inputIsUSDC} usdcBal={usdcBal} tokenBal={tokenBal}
        setMax={setMax} disabled={false}
        currency0={currency0} currency1={currency1}
      />

      {/* Action button */}
      {needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={!canAct}
          className="btn-primary w-full py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {approvePending ? '⏳ Confirm in wallet…' : approveConfirming ? '⏳ Approving…' : `Approve ${inputIsUSDC ? 'USDC' : team.name.split(' ')[0]}`}
        </button>
      ) : (
        <button
          onClick={handleSwap}
          disabled={!canAct}
          className="btn-primary w-full py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {swapPending ? '⏳ Confirm in wallet…'
            : swapConfirming ? '⏳ Swapping…'
            : direction === 'buy'
              ? `Buy ${team.name.split(' ')[0]} Token`
              : `Sell ${team.name.split(' ')[0]} Token`}
        </button>
      )}

      {/* Error feedback */}
      {(approveError || swapError) && (
        <div className="text-xs font-mono bg-red-500/10 border border-red-500/20 p-3 space-y-1.5">
          <div className="text-red-400">
            {(approveError || swapError)?.shortMessage || 'Transaction failed'}
          </div>
          {_isV4SimError(approveError || swapError) && (
            <div className="text-stadium-muted leading-relaxed">
              OKX wallet may not simulate Uniswap V4's callback pattern correctly.
              Try switching to MetaMask — or confirm the transaction anyway if your
              wallet shows a "Send anyway" option.
            </div>
          )}
        </div>
      )}

      {/* Success share */}
      {swapDone && (
        <div className="space-y-2">
          <div className="text-xs text-stadium-green font-mono text-center uppercase tracking-widest">
            Swap executed ✓
          </div>
          <div className="flex justify-center">
            <ShareButton text={`Just swapped ${direction === 'buy' ? 'into' : 'out of'} ${team.flag} ${team.name} on 11° — the World Cup DeFi protocol powered by Uniswap V4!`} />
          </div>
        </div>
      )}
    </div>
  )
}

// Pure presentational sub-component for the form UI (shared between router-deployed and not)
function SwapFormUI({ team, direction, setDirection, amountIn, setAmountIn,
                      inputIsUSDC, usdcBal, tokenBal, setMax, disabled, currency0, currency1 }) {

  const shortAddr = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—'
  const balLabel  = inputIsUSDC ? 'USDC' : team.name.split(' ')[0]
  const balance   = inputIsUSDC
    ? (usdcBal !== undefined ? formatUSDC(usdcBal) : '—')
    : (tokenBal !== undefined ? formatToken(tokenBal) : '—')

  return (
    <div className="space-y-3">
      {/* Direction toggle */}
      <div className="flex gap-px bg-stadium-border">
        {['buy', 'sell'].map(d => (
          <button
            key={d}
            onClick={() => !disabled && setDirection(d)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              direction === d
                ? d === 'buy' ? 'bg-stadium-green text-stadium-dark' : 'bg-red-500 text-white'
                : 'bg-stadium-card text-stadium-muted hover:text-stadium-text'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {d === 'buy' ? `Buy ${team.name.split(' ')[0]}` : `Sell ${team.name.split(' ')[0]}`}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-stadium-muted font-mono uppercase tracking-widest">
            {inputIsUSDC ? 'USDC Amount' : `${team.name.split(' ')[0]} Amount`}
          </label>
          <button
            onClick={setMax}
            disabled={disabled}
            className="text-xs text-stadium-green font-mono hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Max: {balance} {balLabel}
          </button>
        </div>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amountIn}
          onChange={e => setAmountIn(e.target.value)}
          disabled={disabled}
          className="w-full bg-stadium-dark border border-stadium-border text-stadium-text font-mono text-sm px-3 py-2 focus:outline-none focus:border-stadium-green disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Pool info */}
      <div className="bg-stadium-dark border border-stadium-border p-3 text-xs font-mono space-y-1">
        <div className="flex justify-between text-stadium-muted">
          <span>Currency 0</span>
          <span className="text-stadium-text">{shortAddr(currency0)}</span>
        </div>
        <div className="flex justify-between text-stadium-muted">
          <span>Currency 1</span>
          <span className="text-stadium-text">{shortAddr(currency1)}</span>
        </div>
        <div className="flex justify-between text-stadium-muted">
          <span>Hook</span>
          <span className="text-stadium-green">StadiumHook</span>
        </div>
        <div className="flex justify-between text-stadium-muted">
          <span>Fee</span>
          <span className="text-stadium-text">Dynamic (V4 hook)</span>
        </div>
        <div className="flex justify-between text-stadium-muted">
          <span>Tick Spacing</span>
          <span className="text-stadium-text">{TICK_SPACING}</span>
        </div>
      </div>
    </div>
  )
}
