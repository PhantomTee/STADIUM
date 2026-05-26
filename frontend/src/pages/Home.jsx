import React from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useTotalAliveConvictionLocked, useChampionPoolBalance } from '../hooks/useContracts'
import { formatUSDC } from '../utils/contracts'

const FEATURES = [
  {
    icon: '⚽',
    title: 'CONVICTION',
    tagline: 'Back your team long-term',
    description: 'Deposit USDC behind your World Cup team. Earn Survivor Yield every time a rival team is eliminated. Get 100% back if your team lifts the trophy.',
    cta: 'Back a Team',
    href: '/conviction',
    color: 'stadium-green',
  },
  {
    icon: '📊',
    title: 'VAR',
    tagline: 'Predict in-match events',
    description: 'Place predictions on match outcomes, first goals, red cards and extra time. Conviction holders get a 1.5× bonus on correct predictions.',
    cta: 'Place Predictions',
    href: '/var',
    color: 'blue-400',
  },
  {
    icon: '🏆',
    title: 'Champion Pool',
    tagline: 'Winner takes the pot',
    description: 'A portion of every eliminated team\'s losses flows into the Champion Pool. When the final whistle blows, champion backers split the entire pool.',
    cta: 'View Pool',
    href: '/leaderboard',
    color: 'stadium-gold',
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Connect Wallet', desc: 'Connect your wallet on X Layer Testnet and claim free USDC from the faucet.' },
  { step: '02', title: 'Back Your Team', desc: 'Choose a World Cup team and deposit USDC into their CONVICTION pool.' },
  { step: '03', title: 'Earn as Others Fall', desc: 'Every elimination redistributes 10% of the loser\'s pool to all alive backers automatically.' },
  { step: '04', title: 'Predict Matches', desc: 'Use VAR to bet on individual match outcomes and score bonus multipliers with your CONVICTION.' },
  { step: '05', title: 'Win the Tournament', desc: 'Champion backers receive 100% principal + all yield + their share of the Champion Pool + a Champion NFT.' },
]

export default function Home() {
  const { isConnected, address } = useAccount()
  const { data: totalLocked } = useTotalAliveConvictionLocked()
  const { data: champPool } = useChampionPoolBalance()

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="text-center pt-10 pb-4">
        <div className="inline-flex items-center gap-2 badge-green mb-6 text-sm px-4 py-1.5">
          <span className="w-2 h-2 bg-stadium-green rounded-full animate-pulse"></span>
          Live on X Layer Testnet
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Back Your Team.{' '}
          <span className="text-stadium-green">Earn While</span>
          <br />
          They Win.
        </h1>
        <p className="text-stadium-muted text-xl max-w-2xl mx-auto mb-10">
          STADIUM combines long-term liquidity conviction with in-match prediction markets,
          powered by Uniswap V4 Hooks on X Layer.
        </p>

        {!isConnected ? (
          <div className="flex flex-col items-center gap-4">
            <ConnectButton label="Connect to Play" />
            <p className="text-stadium-muted text-sm">Chain ID 195 · Native gas: OKB</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/conviction" className="btn-primary text-lg px-8 py-4">
              ⚽ Back a Team
            </Link>
            <Link to="/var" className="btn-secondary text-lg px-8 py-4">
              📊 Predict a Match
            </Link>
          </div>
        )}
      </section>

      {/* Live Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Conviction Locked', value: `$${formatUSDC(totalLocked || 0)}`, icon: '💰' },
          { label: 'Champion Pool', value: `$${formatUSDC(champPool || 0)}`, icon: '🏆' },
          { label: 'Teams Remaining', value: '32', icon: '⚽' },
          { label: 'Active Backers', value: '—', icon: '👥' },
        ].map(stat => (
          <div key={stat.label} className="card text-center">
            <div className="text-3xl mb-2">{stat.icon}</div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Feature Cards */}
      <section>
        <h2 className="section-title text-center mb-2">Two Ways to Win</h2>
        <p className="section-subtitle text-center mb-8">CONVICTION is the long game. VAR is the short game. Combine them for maximum edge.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="card-hover group flex flex-col">
              <div className="text-4xl mb-4">{f.icon}</div>
              <div className={`text-xs font-semibold uppercase tracking-widest text-${f.color} mb-2`}>
                {f.tagline}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
              <p className="text-stadium-muted text-sm flex-1 mb-6">{f.description}</p>
              <Link
                to={f.href}
                className={`btn-secondary group-hover:border-stadium-green group-hover:text-stadium-green text-center`}
              >
                {f.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="card">
        <h2 className="section-title mb-2">How It Works</h2>
        <p className="section-subtitle mb-8">Five steps from wallet to winning.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {HOW_IT_WORKS.map((item, i) => (
            <div key={item.step} className="flex flex-col">
              <div className="text-stadium-green font-mono text-sm font-bold mb-3">{item.step}</div>
              <h4 className="font-semibold text-white mb-2">{item.title}</h4>
              <p className="text-stadium-muted text-sm">{item.desc}</p>
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="hidden lg:block absolute" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Yield Mechanics */}
      <section>
        <h2 className="section-title text-center mb-2">Survivor Yield Mechanics</h2>
        <p className="section-subtitle text-center mb-8">The longer your team survives, the more you earn.</p>
        <div className="card">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-white mb-4">When a team is eliminated:</h3>
              <div className="space-y-3">
                {[
                  { pct: '50%', label: 'Returned to backers', color: 'text-stadium-muted' },
                  { pct: '10%', label: 'Survivor Yield → all alive backers', color: 'text-stadium-green' },
                  { pct: '25%', label: 'Champion Pool accumulates', color: 'text-stadium-gold' },
                  { pct: '15%', label: 'Protocol Treasury', color: 'text-blue-400' },
                ].map(item => (
                  <div key={item.pct} className="flex items-center gap-4">
                    <span className={`text-2xl font-bold font-mono ${item.color} w-16`}>{item.pct}</span>
                    <span className="text-stadium-muted text-sm">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Yield formula per elimination:</h3>
              <div className="bg-stadium-dark rounded-xl p-4 font-mono text-sm text-stadium-green border border-stadium-border">
                <div className="text-stadium-muted mb-2">// Your survivor yield share</div>
                <div>userYield =</div>
                <div className="ml-4 text-white">(deposit / totalAlive)</div>
                <div className="ml-4">× (eliminatedTotal × 0.50 × 0.10)</div>
              </div>
              <p className="text-stadium-muted text-sm mt-4">
                As more teams fall, your yield rate increases because the
                numerator grows while fewer competing backers remain.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="card border-stadium-green/30 bg-stadium-green/5 text-center py-12">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-3xl font-bold text-white mb-2">Ready to back your team?</h2>
        <p className="text-stadium-muted mb-8 max-w-lg mx-auto">
          World Cup 2026 is coming. Lock in your conviction before the tournament starts
          and ride every elimination to the final.
        </p>
        {!isConnected ? (
          <ConnectButton label="Connect & Start Backing" />
        ) : (
          <Link to="/conviction" className="btn-primary text-lg px-10 py-4">
            ⚽ Choose Your Team
          </Link>
        )}
      </section>
    </div>
  )
}
