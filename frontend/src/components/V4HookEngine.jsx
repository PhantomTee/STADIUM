import React, { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import deployments from '../config/deployments/xlayer.json'

const EXPLORER =
  parseInt(import.meta.env.VITE_CHAIN_ID ?? '1952', 10) === 196
    ? 'https://web3.okx.com/explorer/xlayer/address/'
    : 'https://web3.okx.com/explorer/xlayer-test/address/'

const HOOK_PERMISSIONS = [
  { flag: 'beforeSwap',          desc: 'Validates pool + returns dynamic fee' },
  { flag: 'afterSwap',           desc: 'Tracks volume / momentum / notional fee' },
  { flag: 'beforeAddLiquidity',  desc: 'Blocks liquidity on eliminated team pools' },
  { flag: 'afterAddLiquidity',   desc: 'Records liquidity stats' },
]

const DEMO_POOL = {
  teamId: 37,
  teamName: 'Argentina',
  currency0: 'USDC',
  currency1: 'ARG',
  fee: 'DYNAMIC',
  tickSpacing: 60,
}

function AddrLink({ addr, label }) {
  const isZero = !addr || addr === '0x0000000000000000000000000000000000000000'
  if (isZero) {
    return <span className="text-stadium-muted font-mono text-xs">Not deployed</span>
  }
  const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`
  return (
    <a
      href={`${EXPLORER}${addr}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-stadium-green hover:brightness-125 transition-all flex items-center gap-1"
    >
      {label ?? short}
      <span className="text-stadium-muted">↗</span>
    </a>
  )
}

function Pill({ active, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold uppercase tracking-wider border ${
        active
          ? 'border-stadium-green/30 bg-stadium-green/10 text-stadium-green'
          : 'border-stadium-border bg-stadium-dark text-stadium-muted'
      }`}
      style={{ borderRadius: 2 }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-stadium-green' : 'bg-stadium-muted'}`}
      />
      {label}
    </span>
  )
}

export default function V4HookEngine() {
  const hook       = deployments.stadiumHook
  const pm         = deployments.poolManager
  const isDeployed = hook && hook !== '0x0000000000000000000000000000000000000000'

  const [dynamicFee]   = useState('3000')   // 0.30% group stage
  const [momentum]     = useState('48 200') // notional
  const [teamStatus]   = useState('ACTIVE')

  return (
    <section>
      <div className="rule-label mb-12">
        <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
        Uniswap V4 Hook Engine
      </div>

      {/* Top banner */}
      <div className="border border-stadium-border bg-stadium-dark p-6 md:p-8 mb-px">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-xs font-mono text-stadium-green uppercase tracking-widest mb-2">
              Core Primitive
            </div>
            <div
              className="font-black text-stadium-text uppercase leading-none mb-3"
              style={{ fontFamily: "'Motiva Sans', 'DM Sans', sans-serif", fontSize: 'clamp(28px, 5vw, 48px)' }}
            >
              StadiumHook
            </div>
            <p className="text-stadium-muted text-xs leading-relaxed max-w-md">
              A Uniswap V4 Hook governing every team token pool. Enforces tournament rules
              on-chain: dynamic fees by stage, swap blocking on elimination, conviction holder
              discounts, and live momentum tracking.
            </p>
          </div>

          <div className="flex flex-col gap-3 text-right">
            <div>
              <div className="text-stadium-muted text-xs uppercase tracking-widest mb-1">Hook Address</div>
              <AddrLink addr={hook} label={isDeployed ? `${hook.slice(0,8)}…${hook.slice(-6)}` : undefined} />
            </div>
            <div>
              <div className="text-stadium-muted text-xs uppercase tracking-widest mb-1">PoolManager</div>
              <AddrLink addr={pm} label={pm && pm !== '0x0000000000000000000000000000000000000000' ? `${pm.slice(0,8)}…${pm.slice(-6)}` : undefined} />
            </div>
          </div>
        </div>
      </div>

      {/* Three-column grid */}
      <div className="grid md:grid-cols-3 gap-px bg-stadium-border">

        {/* Hook Permissions */}
        <div className="bg-stadium-card p-6">
          <div className="text-xs font-mono text-stadium-muted uppercase tracking-widest mb-4">
            Active Permissions
          </div>
          <div className="space-y-3">
            {HOOK_PERMISSIONS.map(({ flag, desc }) => (
              <div key={flag}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-stadium-green text-xs font-mono font-bold">{flag}</span>
                  <span className="text-stadium-green text-xs">✓</span>
                </div>
                <p className="text-stadium-muted text-xs leading-relaxed pl-3 border-l border-stadium-border">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Live State */}
        <div className="bg-stadium-dark p-6">
          <div className="text-xs font-mono text-stadium-muted uppercase tracking-widest mb-4">
            Live State
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-stadium-muted text-xs mb-1">Current Dynamic Fee</div>
              <div className="font-mono text-stadium-green font-bold text-lg">
                {(parseInt(dynamicFee) / 10000 * 100).toFixed(2)}%
              </div>
              <div className="text-stadium-muted text-xs mt-0.5">Group stage · 0.30%</div>
            </div>
            <div>
              <div className="text-stadium-muted text-xs mb-1">Team Status (ARG)</div>
              <Pill active={teamStatus === 'ACTIVE'} label={teamStatus} />
            </div>
            <div>
              <div className="text-stadium-muted text-xs mb-1">Swap Guard</div>
              <Pill active label="ENABLED" />
            </div>
            <div>
              <div className="text-stadium-muted text-xs mb-1">Liquidity Guard</div>
              <Pill active label="ENABLED" />
            </div>
          </div>
        </div>

        {/* Live V4 Pool */}
        <div className="bg-stadium-card p-6">
          <div className="text-xs font-mono text-stadium-muted uppercase tracking-widest mb-4">
            Live V4 Pool
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-stadium-muted">Pair</span>
              <span className="font-mono text-stadium-text">
                {DEMO_POOL.currency0}/{DEMO_POOL.currency1}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-stadium-muted">Fee</span>
              <span className="font-mono text-stadium-green">Dynamic (Hook)</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-stadium-muted">Tick Spacing</span>
              <span className="font-mono text-stadium-text">{DEMO_POOL.tickSpacing}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-stadium-muted">Hook</span>
              <span className="font-mono text-stadium-green text-xs">IHooks(stadiumHook)</span>
            </div>
            <div className="border-t border-stadium-border pt-3">
              <div className="text-stadium-muted text-xs mb-1">Team Momentum</div>
              <div className="font-mono text-stadium-text text-sm font-bold">{momentum} USDC vol</div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo flow */}
      <div className="bg-stadium-dark border border-t-0 border-stadium-border p-6 md:p-8">
        <div className="text-xs font-mono text-stadium-muted uppercase tracking-widest mb-6">
          // Hook Proof — Swap Block on Elimination
        </div>
        <div className="grid sm:grid-cols-3 gap-px bg-stadium-border">
          {[
            {
              step: '01',
              color: 'text-stadium-green',
              title: 'Swap Succeeds',
              code: 'beforeSwap()\n→ team ACTIVE\n→ fee = 0.30%\n→ swap proceeds',
              status: 'PASS',
              statusColor: 'text-stadium-green',
            },
            {
              step: '02',
              color: 'text-stadium-gold',
              title: 'Oracle: Eliminate',
              code: 'MatchOracle\n.postElimination()\n→ vault settles\n→ yield flows',
              status: 'TX',
              statusColor: 'text-stadium-gold',
            },
            {
              step: '03',
              color: 'text-red-400',
              title: 'Swap Blocked',
              code: 'beforeSwap()\n→ team ELIMINATED\n→ SwapBlocked()\n→ revert',
              status: 'REVERT',
              statusColor: 'text-red-400',
            },
          ].map(({ step, color, title, code, status, statusColor }) => (
            <div key={step} className="bg-stadium-card p-4 md:p-6">
              <div className={`font-mono text-xs font-bold mb-2 ${color}`}>{step}</div>
              <div className="font-bold text-stadium-text text-sm uppercase tracking-tight mb-3">{title}</div>
              <pre className="font-mono text-xs text-stadium-muted leading-relaxed whitespace-pre-wrap mb-3">
                {code}
              </pre>
              <span
                className={`font-mono text-xs font-bold border px-2 py-0.5 ${statusColor} border-current/30`}
                style={{ borderRadius: 2 }}
              >
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
