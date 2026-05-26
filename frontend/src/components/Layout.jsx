import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: '🏟️' },
  { path: '/conviction', label: 'CONVICTION', icon: '⚽' },
  { path: '/var', label: 'VAR', icon: '📊' },
  { path: '/portfolio', label: 'Portfolio', icon: '💼' },
  { path: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
  { path: '/nfts', label: 'NFTs', icon: '🎖️' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const { isConnected } = useAccount()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-stadium-dark flex flex-col">
      {/* Top Nav */}
      <header className="border-b border-stadium-border sticky top-0 z-40 bg-stadium-dark/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl">⚽</span>
            <span className="font-bold text-xl text-white group-hover:text-stadium-green transition-colors">
              STADIUM
            </span>
            <span className="hidden sm:inline text-stadium-muted text-xs ml-1">World Cup DeFi</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'text-stadium-green bg-stadium-green/10'
                    : 'text-stadium-muted hover:text-white hover:bg-stadium-card'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
            />
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-stadium-muted hover:text-white"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stadium-border bg-stadium-dark px-4 pb-4">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-colors mt-1 ${
                  location.pathname === item.path
                    ? 'text-stadium-green bg-stadium-green/10'
                    : 'text-stadium-muted hover:text-white hover:bg-stadium-card'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Network Warning */}
      {isConnected && (
        <NetworkBanner />
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-stadium-border py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-stadium-muted">
          <div className="flex items-center gap-2">
            <span>⚽</span>
            <span>STADIUM Protocol — Back Your Team. Earn While They Win.</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Built on X Layer Testnet</span>
            <a
              href="https://web3.okx.com/explorer/xlayer-test"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stadium-green transition-colors"
            >
              Explorer ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function NetworkBanner() {
  const { chain } = useAccount()

  if (!chain || chain.id === 195) return null

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-center text-sm text-red-400">
      ⚠️ Wrong network. Please switch to{' '}
      <strong>X Layer Testnet (Chain ID 195)</strong> to use STADIUM.
    </div>
  )
}
