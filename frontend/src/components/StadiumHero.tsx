import React from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ArrowRight } from 'lucide-react'
import { useTotalAliveConvictionLocked, useChampionPoolBalance } from '../hooks/useContracts'
import { formatUSDC } from '../utils/contracts'

/* ─── Electronic substitution board ────────────────────────────────────────── */

function SubBoard({
  value,
  label,
  accent = '#fbbf24',
  size = 'md',
}: {
  value: string
  label: string
  accent?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const fontSize = size === 'lg' ? 52 : size === 'sm' ? 26 : 38
  const padding = size === 'lg' ? '14px 22px' : size === 'sm' ? '8px 14px' : '10px 18px'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Board body */}
      <div
        style={{
          background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)',
          border: '2px solid #222',
          borderRadius: 5,
          padding,
          boxShadow: `0 0 0 1px #333 inset, 0 4px 24px rgba(0,0,0,0.7), 0 0 30px ${accent}15`,
          position: 'relative',
          minWidth: size === 'lg' ? 140 : size === 'sm' ? 90 : 110,
          textAlign: 'center',
        }}
      >
        {/* Inset LED display */}
        <div
          style={{
            background: '#060606',
            borderRadius: 3,
            padding: '6px 10px',
            border: '1px solid #1a1a1a',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)',
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize,
              fontWeight: 700,
              color: accent,
              textShadow: `0 0 8px ${accent}dd, 0 0 20px ${accent}88, 0 0 40px ${accent}44`,
              letterSpacing: '0.04em',
              lineHeight: 1,
              display: 'block',
            }}
          >
            {value}
          </span>
        </div>

        {/* Corner screws */}
        <div style={{ position: 'absolute', top: 4, left: 5, width: 4, height: 4, borderRadius: '50%', background: '#2a2a2a', border: '1px solid #333' }} />
        <div style={{ position: 'absolute', top: 4, right: 5, width: 4, height: 4, borderRadius: '50%', background: '#2a2a2a', border: '1px solid #333' }} />
        <div style={{ position: 'absolute', bottom: 4, left: 5, width: 4, height: 4, borderRadius: '50%', background: '#2a2a2a', border: '1px solid #333' }} />
        <div style={{ position: 'absolute', bottom: 4, right: 5, width: 4, height: 4, borderRadius: '50%', background: '#2a2a2a', border: '1px solid #333' }} />
      </div>

      {/* Label below board */}
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)',
        }}
      >
        {label}
      </span>
    </div>
  )
}

/* ─── Scoreline board (two teams + score in the middle) ─────────────────────── */

function ScoreBoard({
  labelA,
  score,
  labelB,
  accent = '#fbbf24',
}: {
  labelA: string
  score: string
  labelB: string
  accent?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)',
        border: '2px solid #222',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: `0 0 0 1px #333 inset, 0 6px 32px rgba(0,0,0,0.75), 0 0 40px ${accent}12`,
      }}
    >
      {/* Team A */}
      <div
        style={{
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.02)',
          borderRight: '1px solid #222',
          minWidth: 100,
        }}
      >
        <span
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 18,
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {labelA}
        </span>
      </div>

      {/* Score */}
      <div
        style={{
          padding: '8px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060606',
          borderRight: '1px solid #222',
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 36,
            fontWeight: 700,
            color: accent,
            textShadow: `0 0 8px ${accent}cc, 0 0 20px ${accent}88`,
            letterSpacing: '0.1em',
            lineHeight: 1,
          }}
        >
          {score}
        </span>
      </div>

      {/* Team B */}
      <div
        style={{
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 100,
        }}
      >
        <span
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 18,
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {labelB}
        </span>
      </div>
    </div>
  )
}

/* ─── Football pitch background ─────────────────────────────────────────────── */

function PitchField() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      <svg
        className="w-full h-full"
        viewBox="0 0 420 680"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Alternating grass stripes */}
          <pattern id="grassStripe" x="0" y="0" width="70" height="680" patternUnits="userSpaceOnUse">
            <rect width="70" height="680" fill="#1a6e1a" />
            <rect width="35" height="680" fill="#1e7d1e" />
          </pattern>
          {/* Texture noise approximation using turbulence */}
          <filter id="grassTex" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blend" />
            <feComposite in="blend" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>

        {/* Grass base with stripes */}
        <rect width="420" height="680" fill="url(#grassStripe)" />

        {/* Subtle grass texture overlay */}
        <rect width="420" height="680" fill="rgba(0,0,0,0.06)" />

        {/* ── Pitch markings ── */}
        <g fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="2.2" strokeLinejoin="round">

          {/* Outer boundary */}
          <rect x="22" y="18" width="376" height="644" />

          {/* Center line */}
          <line x1="22" y1="340" x2="398" y2="340" />

          {/* Center circle */}
          <circle cx="210" cy="340" r="62" />
          {/* Center spot */}
          <circle cx="210" cy="340" r="3.5" fill="rgba(255,255,255,0.88)" stroke="none" />

          {/* ── TOP HALF ── */}
          {/* Top penalty area */}
          <rect x="98" y="18" width="224" height="128" />
          {/* Top 6-yard box */}
          <rect x="148" y="18" width="124" height="52" />
          {/* Top penalty spot */}
          <circle cx="210" cy="98" r="3.5" fill="rgba(255,255,255,0.88)" stroke="none" />
          {/* Top penalty arc (outside the box) */}
          <path d="M 155 146 A 62 62 0 0 1 265 146" />
          {/* Top goal (outside boundary) */}
          <rect x="168" y="6" width="84" height="14" />

          {/* ── BOTTOM HALF ── */}
          {/* Bottom penalty area */}
          <rect x="98" y="534" width="224" height="128" />
          {/* Bottom 6-yard box */}
          <rect x="148" y="610" width="124" height="52" />
          {/* Bottom penalty spot */}
          <circle cx="210" cy="582" r="3.5" fill="rgba(255,255,255,0.88)" stroke="none" />
          {/* Bottom penalty arc */}
          <path d="M 155 534 A 62 62 0 0 0 265 534" />
          {/* Bottom goal */}
          <rect x="168" y="660" width="84" height="14" />

          {/* Corner arcs */}
          <path d="M 22 34 A 16 16 0 0 1 38 18" />
          <path d="M 382 18 A 16 16 0 0 1 398 34" />
          <path d="M 38 662 A 16 16 0 0 1 22 646" />
          <path d="M 398 646 A 16 16 0 0 1 382 662" />
        </g>
      </svg>

      {/* Dark vignette overlay so content stays readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 90% 70% at 50% 50%, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.82) 100%)',
        }}
      />
      {/* Top + bottom edge darken */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.55) 100%)' }} />
    </div>
  )
}

/* ─── Main hero ──────────────────────────────────────────────────────────────── */

export default function StadiumHero() {
  const { isConnected } = useAccount()
  const { data: totalLocked } = useTotalAliveConvictionLocked()
  const { data: champPool } = useChampionPoolBalance()

  const lockedDisplay = totalLocked ? `$${formatUSDC(totalLocked)}` : '$0'
  const poolDisplay = champPool ? `$${formatUSDC(champPool)}` : '$0'

  return (
    <section
      className="relative -mx-4 -mt-8 overflow-hidden flex flex-col items-center justify-center"
      style={{ height: '100svh', minHeight: 640 }}
    >
      {/* Pitch background */}
      <PitchField />

      {/* Content layer */}
      <div
        className="relative flex flex-col items-center text-center px-4 w-full"
        style={{ zIndex: 10, gap: 0 }}
      >

        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 999,
            padding: '5px 16px',
            marginBottom: 20,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', flexShrink: 0, display: 'inline-block' }} />
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            Uniswap V4 · X Layer Testnet · World Cup 2026
          </span>
        </div>

        {/* 11° headline */}
        <h1
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 'clamp(96px, 20vw, 200px)',
            lineHeight: 0.9,
            color: '#ffffff',
            letterSpacing: '-0.03em',
            margin: 0,
            textShadow: '0 4px 60px rgba(0,0,0,0.6)',
          }}
        >
          11°
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 'clamp(12px, 2vw, 16px)',
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
            margin: '18px 0 0',
          }}
        >
          Back Your Team &nbsp;·&nbsp; Trade The Match &nbsp;·&nbsp; Win The Cup
        </p>

        {/* ── Electronic substitution boards ── */}
        <div
          className="flex flex-wrap items-end justify-center"
          style={{ gap: 16, marginTop: 40 }}
        >
          <SubBoard value="48" label="Nations" accent="#4ade80" size="md" />
          <SubBoard value="104" label="Matches" accent="#4ade80" size="md" />
          <SubBoard value={lockedDisplay} label="Conviction Locked" accent="#fbbf24" size="md" />
          <SubBoard value={poolDisplay} label="Champion Pool" accent="#fbbf24" size="md" />
        </div>

        {/* ── Score display ── */}
        <div style={{ marginTop: 28 }}>
          <ScoreBoard
            labelA="CONVICTION"
            score="0 — 0"
            labelB="VAR"
            accent="#4ade80"
          />
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.25)',
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            World Cup 2026 · Group Stage · Kick-off TBC
          </div>
        </div>

        {/* ── CTA buttons ── */}
        <div
          className="flex flex-wrap items-center justify-center"
          style={{ gap: 12, marginTop: 36 }}
        >
          {!isConnected ? (
            <ConnectButton label="Connect Wallet" />
          ) : (
            <>
              <Link
                to="/conviction"
                style={{ textDecoration: 'none' }}
              >
                <button
                  style={{
                    fontFamily: "'Anton', sans-serif",
                    fontSize: 16,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#000',
                    background: '#4ade80',
                    border: 'none',
                    borderRadius: 4,
                    padding: '14px 32px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  Back a Team <ArrowRight size={16} />
                </button>
              </Link>
              <Link
                to="/var"
                style={{ textDecoration: 'none' }}
              >
                <button
                  style={{
                    fontFamily: "'Anton', sans-serif",
                    fontSize: 16,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#fff',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 4,
                    padding: '14px 32px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  Predict Matches <ArrowRight size={16} />
                </button>
              </Link>
            </>
          )}
        </div>

      </div>
    </section>
  )
}
