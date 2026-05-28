import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

const NAV_ITEMS = [
  { path: '/',            label: 'Home'        },
  { path: '/scores',      label: 'Scores'      },
  { path: '/conviction',  label: 'CONVICTION'  },
  { path: '/var',         label: 'VAR'         },
  { path: '/trade',       label: 'Trade'       },
  { path: '/portfolio',   label: 'Portfolio'   },
  { path: '/leaderboard', label: 'Leaderboard' },
  { path: '/activity',    label: 'Activity'    },
  { path: '/about',       label: 'About'       },
  { path: '/nfts',        label: 'NFTs'        },
  { path: '/admin',       label: 'Admin'       },
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

/* The one and only icon: football beside the STADIUM wordmark */
function BallIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className="text-stadium-green flex-shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7.5 14.5 9v3L12 13.5 9.5 12V9z" strokeWidth="1" />
      <path d="M12 2v5.5M19.5 9.5l-5 2M17 20l-3.5-5.5M7 20l3.5-5.5M4.5 9.5l5 2" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export default function Layout({ children }) {
  const location = useLocation()
  const { isConnected } = useAccount()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [light, setLight] = useTheme()

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Nav */}
      <header className="border-b border-stadium-border sticky top-0 z-40 backdrop-blur-md" style={{ background: 'rgba(8,14,8,0.92)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <BallIcon />
            <span className="group-hover:text-stadium-green transition-colors" style={{ fontFamily: "'Anton', sans-serif", fontSize: 24, letterSpacing: '-0.02em', color: '#ffffff' }}>
              11°
            </span>
            <span className="hidden sm:inline text-stadium-muted text-xs ml-1 font-mono">/ World Cup DeFi</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map(({ path, label }) => {
              const active = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={`text-xs font-bold uppercase tracking-widest transition-colors ${
                    active ? 'text-stadium-green' : 'text-stadium-muted hover:text-stadium-text'
                  }`}
                >
                  {label}
                  {active && <div className="h-px bg-stadium-green mt-0.5" />}
                </Link>
              )
            })}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLight(l => !l)}
              className="p-2 text-stadium-muted hover:text-stadium-green transition-colors"
              aria-label="Toggle theme"
            >
              {light ? <MoonIcon /> : <SunIcon />}
            </button>
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-2 text-stadium-muted hover:text-stadium-text"
            >
              {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
            </button>
          </div>
        </div>

      </header>

      {/* Mobile overlay — rendered outside header so it covers full viewport */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 flex flex-col"
          style={{
            background: 'rgba(4, 8, 4, 0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          onClick={() => setMobileOpen(false)}
        >
          {/* Pitch stripe tint overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 110px, rgba(0,255,135,0.025) 110px, rgba(0,255,135,0.025) 220px)',
            }}
          />

          {/* Content — stop propagation so clicking links doesn't close before navigating */}
          <div
            className="relative flex flex-col justify-center flex-1 px-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Green rule at top */}
            <div className="flex items-center gap-3 mb-12">
              <div className="h-px w-10 bg-stadium-green flex-shrink-0" />
              <span className="text-xs font-mono text-stadium-muted uppercase tracking-widest">Navigation</span>
            </div>

            <nav className="space-y-1">
              {NAV_ITEMS.map(({ path, label }, i) => {
                const active = location.pathname === path
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={`flex items-center justify-between py-4 border-b transition-all duration-150 ${
                      active
                        ? 'border-stadium-green/30 text-stadium-green'
                        : 'border-stadium-border/40 text-stadium-muted hover:text-stadium-text hover:border-stadium-border'
                    }`}
                  >
                    <span
                      style={{ fontFamily: "'Anton', sans-serif", fontSize: 'clamp(22px, 6vw, 32px)', letterSpacing: '-0.02em' }}
                    >
                      {label}
                    </span>
                    {active && (
                      <span className="text-stadium-green font-mono text-xs">●</span>
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Bottom wallet row */}
            <div className="mt-12 pt-6 border-t border-stadium-border/40 flex items-center justify-between">
              <button
                onClick={() => setLight(l => !l)}
                className="p-2 text-stadium-muted hover:text-stadium-green transition-colors"
                aria-label="Toggle theme"
              >
                {light ? <MoonIcon /> : <SunIcon />}
              </button>
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
            </div>
          </div>
        </div>
      )}

      {isConnected && <NetworkBanner />}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-stadium-border py-8 mt-8" style={{ background: 'rgba(8,14,8,0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <BallIcon />
            <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 20, letterSpacing: '-0.02em', color: '#ffffff' }}>11°</span>
            <span className="text-stadium-muted text-xs font-mono ml-2">— Back Your Team. Trade The Match. Win The Cup.</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-stadium-muted font-mono">
            <span>X Layer Testnet · Chain ID 1952</span>
            <span className="h-3 w-px bg-stadium-border" />
            <a
              href="https://web3.okx.com/explorer/xlayer-test"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stadium-green transition-colors uppercase tracking-widest"
            >
              Block Explorer ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function NetworkBanner() {
  const { chain } = useAccount()
  const expectedId = parseInt(import.meta.env.VITE_CHAIN_ID ?? '1952', 10)
  const label = expectedId === 196
    ? 'X Layer Mainnet (Chain ID 196)'
    : `X Layer Testnet (Chain ID ${expectedId})`
  if (!chain || chain.id === expectedId) return null
  return (
    <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-center text-xs text-red-400 font-mono uppercase tracking-widest">
      Wrong network — switch to {label}
    </div>
  )
}
