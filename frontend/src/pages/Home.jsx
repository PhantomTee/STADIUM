import React from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import StadiumHero from '../components/StadiumHero'

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function Home() {
  const { isConnected } = useAccount()

  return (
    <div>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <StadiumHero />

      <div className="space-y-24 mt-20">

        {/* ── Two Ways to Win ───────────────────────────────────────────── */}
        <section>
          <div className="rule-label mb-12">
            <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
            Two Mechanics. One Tournament.
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-stadium-border">
            {/* CONVICTION */}
            <div className="bg-stadium-dark p-10 flex flex-col">
              <div className="text-xs font-mono text-stadium-green uppercase tracking-widest mb-4">Long-term strategy</div>
              <div className="text-6xl font-black text-stadium-text uppercase tracking-tight leading-none mb-6">
                CONVICTION
              </div>
              <p className="text-stadium-muted text-sm leading-relaxed mb-8 flex-1">
                Deposit USDC behind your World Cup team. Every time a rival team is eliminated,
                10% of their locked funds flows to surviving backers as yield — proportional to your stake.
                Reach the final and earn the Champion Pool too.
              </p>
              <div className="space-y-2 mb-8 font-mono text-sm">
                {[
                  ['50%', 'Returned to eliminated backers'],
                  ['10%', 'Survivor Yield → alive backers'],
                  ['25%', 'Flows to Champion Pool'],
                  ['15%', 'Protocol Treasury'],
                ].map(([pct, label]) => (
                  <div key={pct} className="flex items-center gap-4">
                    <span className="text-stadium-green font-bold w-10">{pct}</span>
                    <span className="text-stadium-muted text-xs">{label}</span>
                  </div>
                ))}
              </div>
              <Link to="/conviction" className="btn-primary text-center">
                Back a Team
              </Link>
            </div>

            {/* VAR */}
            <div className="bg-stadium-card p-10 flex flex-col">
              <div className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-4">Match-by-match action</div>
              <div className="text-6xl font-black text-stadium-text uppercase tracking-tight leading-none mb-6">
                VAR
              </div>
              <p className="text-stadium-muted text-sm leading-relaxed mb-8 flex-1">
                Four prediction markets open for every match: Match Winner, First Goal,
                Red Card, and Extra Time. Conviction holders earn a 1.5× weighted bonus on correct calls
                without creating new money — just a larger share of the same pool.
              </p>
              <div className="space-y-2 mb-8 font-mono text-sm">
                {[
                  ['45%', 'To winning pool (weighted by conviction)'],
                  ['25%', 'Flows to Champion Pool'],
                  ['10%', 'Refunded to each loser'],
                  ['20%', 'Protocol Treasury'],
                ].map(([pct, label]) => (
                  <div key={pct} className="flex items-center gap-4">
                    <span className="text-blue-400 font-bold w-10">{pct}</span>
                    <span className="text-stadium-muted text-xs">{label}</span>
                  </div>
                ))}
              </div>
              <Link to="/var" className="btn-secondary text-center">
                Predict a Match
              </Link>
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────────── */}
        <section>
          <div className="rule-label mb-12">
            <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
            How it works
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-0 border border-stadium-border divide-y sm:divide-y-0 sm:divide-x divide-stadium-border">
            {[
              { n: '01', title: 'Connect Wallet',      desc: 'Connect on X Layer Testnet. Claim free USDC from the faucet.' },
              { n: '02', title: 'Back Your Team',       desc: 'Deposit USDC into any of the 48 World Cup team conviction pools.' },
              { n: '03', title: 'Earn as Teams Fall',   desc: 'Every elimination auto-distributes 10% of lost deposits to you.' },
              { n: '04', title: 'Predict Matches',      desc: 'Use VAR markets. Your conviction stake earns a 1.5× bonus.' },
              { n: '05', title: 'Win Everything',       desc: 'Champion backers get 100% principal + all yield + Champion Pool + NFT.' },
            ].map(step => (
              <div key={step.n} className="relative p-8 overflow-hidden group hover:bg-stadium-card transition-colors">
                <div className="absolute -top-4 -left-2 text-[7rem] font-black text-stadium-green/5 leading-none select-none">
                  {step.n}
                </div>
                <div className="relative">
                  <div className="text-stadium-green font-mono text-xs font-bold mb-3">{step.n}</div>
                  <div className="font-black text-stadium-text text-sm uppercase tracking-tight mb-2 leading-tight">{step.title}</div>
                  <p className="text-stadium-muted text-xs leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Survivor Yield Formula ────────────────────────────────────── */}
        <section className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <div className="rule-label mb-6">
              <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
              Survivor Yield Mechanics
            </div>
            <h2 className="text-3xl font-black text-stadium-text uppercase tracking-tight mb-4 leading-tight">
              The longer your team survives, the more you earn.
            </h2>
            <p className="text-stadium-muted text-sm leading-relaxed mb-6">
              Yield accrues automatically on every elimination — no claiming needed until you want it.
              As the tournament progresses and fewer teams remain, each elimination represents
              a larger share of a shrinking competitor pool.
            </p>
            <p className="text-stadium-muted text-sm leading-relaxed">
              Conviction multipliers on VAR markets mean your long-term backing also
              boosts your short-term prediction returns — the two mechanics compound.
            </p>
          </div>
          <div>
            <div className="bg-stadium-dark border border-stadium-border p-6 font-mono text-sm">
              <div className="text-stadium-muted text-xs mb-4 uppercase tracking-widest">// Survivor yield formula</div>
              <div className="space-y-1">
                <div className="text-stadium-green">userYield =</div>
                <div className="ml-6 text-stadium-text">(yourDeposit / totalAliveDeposits)</div>
                <div className="ml-6 text-stadium-muted">× (eliminatedTotal × 0.50 × 0.10)</div>
              </div>
              <div className="border-t border-stadium-border mt-6 pt-6 space-y-1">
                <div className="text-stadium-muted text-xs uppercase tracking-widest mb-3">// VAR conviction multiplier</div>
                <div className="text-stadium-green">weightedShare =</div>
                <div className="ml-6 text-stadium-text">(betAmount × multiplier) / 100</div>
                <div className="ml-6 text-stadium-muted">÷ totalWeightedWinning</div>
                <div className="ml-6 text-stadium-text">× toWinnersPool</div>
              </div>
              <div className="border-t border-stadium-border mt-6 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stadium-muted">No conviction</span>
                  <span className="text-stadium-text font-bold">1.0× multiplier</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-stadium-muted">CONVICTION holder</span>
                  <span className="text-stadium-green font-bold">1.5× multiplier</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="relative -mx-4 border-t border-stadium-border overflow-hidden">
          <div className="text-center py-24 px-4">
            <div className="rule-label justify-center mb-8">
              <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
              The tournament starts soon
              <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
            </div>
            <h2 className="text-display text-stadium-text mb-6">
              WHO WINS?
            </h2>
            <p className="text-stadium-muted text-lg mb-10 max-w-lg mx-auto leading-relaxed">
              48 teams. One champion. Your USDC earns every step of the way.
              Lock your conviction before the opening whistle.
            </p>
            {!isConnected ? (
              <ConnectButton label="Connect & Start Backing" />
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/conviction" className="btn-primary px-12 py-4">
                  Choose Your Team
                </Link>
                <Link to="/leaderboard" className="btn-secondary px-12 py-4">
                  View Leaderboard
                </Link>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
