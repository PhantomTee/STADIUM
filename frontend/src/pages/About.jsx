import React from 'react'
import { Link } from 'react-router-dom'
import V4HookEngine from '../components/V4HookEngine'
import { ADDRESSES } from '../utils/contracts'

const CONTRACTS = [
  { name: 'ConvictionVault', addr: ADDRESSES.convictionVault, desc: 'Deposit USDC, earn survivor yield, claim champion pool' },
  { name: 'VARMarket',       addr: ADDRESSES.varMarket,       desc: 'Prediction markets for in-match events' },
  { name: 'MatchOracle',     addr: ADDRESSES.matchOracle,     desc: 'Trusted sports-data relayer — match lifecycle on-chain' },
  { name: 'ChampionPool',    addr: ADDRESSES.championPool,    desc: 'Accumulates fees; distributed to champion backers' },
  { name: 'StadiumHook',     addr: ADDRESSES.stadiumHook,     desc: 'Uniswap V4 BaseHook — dynamic fees, swap blocking, momentum' },
  { name: 'MockUSDC',        addr: ADDRESSES.mockUSDC,        desc: 'Testnet USDC with 24h faucet' },
]

const EXPLORER =
  parseInt(import.meta.env.VITE_CHAIN_ID ?? '1952', 10) === 196
    ? 'https://web3.okx.com/explorer/xlayer/address/'
    : 'https://web3.okx.com/explorer/xlayer-test/address/'

const MECHANICS = [
  {
    label: 'Conviction',
    color: 'text-stadium-green',
    border: 'border-stadium-green/30',
    rows: [
      ['50%', 'Returned to eliminated backers'],
      ['10%', 'Survivor Yield → alive backers (O(1) MasterChef accumulator)'],
      ['25%', 'Champion Pool'],
      ['15%', 'Protocol Treasury'],
    ],
  },
  {
    label: 'VAR Markets',
    color: 'text-blue-400',
    border: 'border-blue-400/30',
    rows: [
      ['45%', 'Winners pool (weighted by conviction multiplier)'],
      ['22.5%', 'Champion Pool'],
      ['10%', 'Refund to losing bettors'],
      ['22.5%', 'Protocol Treasury'],
    ],
  },
]

export default function About() {
  return (
    <div className="space-y-16">

      {/* Header */}
      <div className="page-header">
        <h1 className="section-title">About 11°</h1>
        <p className="section-subtitle">
          A conviction-based DeFi protocol built on the 2026 World Cup, deployed on X Layer.
          Powered by a Uniswap V4 Hook as its core on-chain primitive.
        </p>
      </div>

      {/* Protocol mechanics */}
      <section>
        <div className="rule-label mb-8">
          <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
          How the money moves
        </div>
        <div className="grid md:grid-cols-2 gap-px bg-stadium-border">
          {MECHANICS.map(({ label, color, border, rows }) => (
            <div key={label} className={`bg-stadium-card p-6 border-t-2 ${border}`}>
              <div className={`text-xs font-mono font-bold uppercase tracking-widest mb-4 ${color}`}>{label}</div>
              <div className="space-y-2">
                {rows.map(([pct, desc]) => (
                  <div key={pct} className="flex items-start gap-3">
                    <span className={`font-bold font-mono text-sm w-12 flex-shrink-0 ${color}`}>{pct}</span>
                    <span className="text-stadium-muted text-xs leading-relaxed">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* V4 Hook Engine */}
      <section>
        <div className="rule-label mb-8">
          <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
          Uniswap V4 Hook Engine
        </div>
        <V4HookEngine />
      </section>

      {/* Contract addresses */}
      <section>
        <div className="rule-label mb-8">
          <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
          Deployed Contracts — X Layer Testnet
        </div>
        <div className="space-y-px bg-stadium-border">
          {CONTRACTS.map(({ name, addr, desc }) => {
            const isZero = !addr || addr === '0x0000000000000000000000000000000000000000'
            return (
              <div key={name} className="bg-stadium-card flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-stadium-text text-sm font-mono">{name}</div>
                  <div className="text-xs text-stadium-muted mt-0.5">{desc}</div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {isZero ? (
                    <span className="text-stadium-muted font-mono text-xs">Not set</span>
                  ) : (
                    <a
                      href={`${EXPLORER}${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-stadium-green hover:brightness-125 transition-all"
                    >
                      {addr.slice(0, 8)}…{addr.slice(-6)} ↗
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-stadium-muted font-mono mt-3">
          Chain ID 1952 · X Layer Testnet ·{' '}
          <a
            href="https://web3.okx.com/explorer/xlayer-test"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stadium-green hover:brightness-125"
          >
            Explorer ↗
          </a>
        </p>
      </section>

      {/* Security */}
      <section>
        <div className="rule-label mb-8">
          <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
          Security model
        </div>
        <div className="grid sm:grid-cols-2 gap-px bg-stadium-border">
          {[
            { title: 'CEI Pattern',        desc: 'State changes precede every external call throughout all contracts.' },
            { title: 'Pull-based payouts', desc: 'No push loops. Every yield, refund and pool share requires a user claim transaction.' },
            { title: 'Reentrancy guards',  desc: 'nonReentrant on all user-facing write functions.' },
            { title: 'No admin backdoors', desc: 'Owner can only post match results and register teams — never move user funds.' },
            { title: 'Oracle model',       desc: 'MatchOracle is a trusted sports-data relayer, not a decentralised oracle. Results posted by a known admin key.' },
            { title: 'Hook address proof', desc: 'V4 hook address encodes permission bits via CREATE2 mining, verified on-chain at deploy time.' },
          ].map(({ title, desc }) => (
            <div key={title} className="bg-stadium-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-stadium-green text-xs">✓</span>
                <span className="font-bold text-stadium-text text-sm uppercase tracking-tight">{title}</span>
              </div>
              <p className="text-xs text-stadium-muted leading-relaxed pl-4">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-stadium-border pt-10 flex flex-wrap gap-4">
        <Link to="/conviction" className="btn-primary">Back a Team</Link>
        <Link to="/leaderboard" className="btn-secondary">View Leaderboard</Link>
        <a
          href="https://github.com/phantomtee/stadium"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          GitHub ↗
        </a>
      </section>

    </div>
  )
}
