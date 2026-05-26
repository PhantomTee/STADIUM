import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import {
  IconStadium, IconBall, IconChart, IconBriefcase,
  IconTrophy, IconMedal, IconMenu, IconClose,
  IconSun, IconMoon,
} from './Icons'

const NAV_ITEMS = [
  { path: '/',           label: 'Home',        Icon: IconStadium  },
  { path: '/conviction', label: 'CONVICTION',  Icon: IconBall     },
  { path: '/var',        label: 'VAR',         Icon: IconChart    },
  { path: '/portfolio',  label: 'Portfolio',   Icon: IconBriefcase },
  { path: '/leaderboard',label: 'Leaderboard', Icon: IconTrophy   },
  { path: '/nfts',       label: 'NFTs',        Icon: IconMedal    },
]

function useTheme() {
  const [light, setLight] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('stadium-theme') === 'light'
  })

  useEffect(() => {
    const html = document.documentElement
    if (light) {
      html.classList.add('light')
      html.classList.remove('dark')
      localStorage.setItem('stadium-theme', 'light')
    } else {
      html.classList.remove('light')
      html.classList.add('dark')
      localStorage.setItem('stadium-theme', 'dark')
    }
  }, [light])

  return [light, setLight]
}

export default function Layout({ children }) {
  const location = useLocation()
  const { isConnected } = useAccount()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [light, setLight] = useTheme()

  return (
    <div className="min-h-screen bg-stadium-dark flex flex-col">
      {/* Top Nav */}
      <header className="border-b border-stadium-border sticky top-0 z-40 bg-stadium-dark/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <IconStadium size={22} className="text-stadium-green" />
            <span className="font-bold text-xl text-stadium-text group-hover:text-stadium-green transition-colors">
              STADIUM
            </span>
            <span className="hidden sm:inline text-stadium-muted text-xs ml-1">World Cup DeFi</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ path, label, Icon }) => {
              const active = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'text-stadium-green bg-stadium-green/10'
                      : 'text-stadium-muted hover:text-stadium-text hover:bg-stadium-card'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Right: theme toggle + wallet */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLight(l => !l)}
              className="p-2 text-stadium-muted hover:text-stadium-green transition-colors"
              aria-label="Toggle theme"
            >
              {light ? <IconMoon size={18} /> : <IconSun size={18} />}
            </button>

            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-2 text-stadium-muted hover:text-stadium-text transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-stadium-border bg-stadium-dark px-4 pb-4">
            {NAV_ITEMS.map(({ path, label, Icon }) => {
              const active = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors mt-1 ${
                    active
                      ? 'text-stadium-green bg-stadium-green/10'
                      : 'text-stadium-muted hover:text-stadium-text hover:bg-stadium-card'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              )
            })}
          </div>
        )}
      </header>

      {isConnected && <NetworkBanner />}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-stadium-border py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-stadium-muted">
          <div className="flex items-center gap-2">
            <IconStadium size={16} className="text-stadium-muted" />
            <span>STADIUM Protocol — Back Your Team. Earn While They Win.</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Built on X Layer Testnet</span>
            <a
              href="https://web3.okx.com/explorer/xlayer-test"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stadium-green transition-colors flex items-center gap-1"
            >
              Explorer
              <span className="text-xs">↗</span>
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
    <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-center text-sm text-red-400 flex items-center justify-center gap-2">
      <IconWarn size={16} />
      Wrong network — please switch to <strong className="ml-1">X Layer Testnet (ID 195)</strong>
    </div>
  )
}

// Local import for banner (avoid circular)
function IconWarn({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  )
}
