import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

/* ─── Data ───────────────────────────────────────────────────────────────── */

const HERO_ITEMS = [
  {
    id: 'cup',
    label: 'THE CUP',
    eyebrow: 'CHAMPION POOL',
    headline: 'WIN THE CUP',
    sub: 'Every team token swap seeds the Champion Pool. Back the winner, claim it all when the final whistle blows.',
    img: '/assets/hero/trophy.svg',
    accent: '#F9D423',
    bg: 'rgba(249,212,35,0.06)',
    border: 'rgba(249,212,35,0.14)',
  },
  {
    id: 'ball',
    label: 'THE BALL',
    eyebrow: 'TEAM TOKENS',
    headline: 'TRADE THE MATCH',
    sub: 'One ERC-20 per nation. Dynamic fees rise as rounds advance. Uniswap V4 pools live on X Layer.',
    img: '/assets/hero/soccer-ball.svg',
    accent: '#4ade80',
    bg: 'rgba(74,222,128,0.05)',
    border: 'rgba(74,222,128,0.14)',
  },
  {
    id: 'flags',
    label: 'THE FLAGS',
    eyebrow: '48 NATIONS',
    headline: 'BACK YOUR TEAM',
    sub: 'Lock USDC conviction behind your nation. Earn Survivor Yield as rivals fall. Multiply VAR prediction returns.',
    img: '/assets/hero/flags-collage.svg',
    accent: '#60a5fa',
    bg: 'rgba(96,165,250,0.05)',
    border: 'rgba(96,165,250,0.14)',
  },
  {
    id: 'hook',
    label: 'THE HOOK',
    eyebrow: 'V4 MATCH ENGINE',
    headline: 'POWERED BY HOOKS',
    sub: 'StadiumHook: beforeSwap gates eliminated teams. afterSwap routes protocol fees. Conviction discounts live.',
    img: '/assets/hero/hook-card.svg',
    accent: '#a78bfa',
    bg: 'rgba(167,139,250,0.05)',
    border: 'rgba(167,139,250,0.14)',
  },
] as const

type ItemIndex = 0 | 1 | 2 | 3
type Role = 'center' | 'left' | 'right' | 'back'
type NavDir = 'next' | 'prev'

/* ─── Role geometry ─────────────────────────────────────────────────────── */

const N = HERO_ITEMS.length

function getRole(i: number, active: number): Role {
  if (i === active) return 'center'
  if (i === (active + 1) % N) return 'right'
  if (i === (active + N - 1) % N) return 'left'
  return 'back'
}

const EASE = 'cubic-bezier(0.4,0,0.2,1)'
const DURATION = '650ms'

const ROLE_STYLES: Record<Role, React.CSSProperties> = {
  center: {
    transform: 'translateX(0) translateY(0) scale(1)',
    opacity: 1,
    zIndex: 20,
    filter: 'none',
    pointerEvents: 'none',
  },
  left: {
    transform: 'translateX(-62%) translateY(10%) scale(0.7)',
    opacity: 0.4,
    zIndex: 10,
    filter: 'brightness(0.5) saturate(0.6)',
    pointerEvents: 'auto',
    cursor: 'pointer',
  },
  right: {
    transform: 'translateX(62%) translateY(10%) scale(0.7)',
    opacity: 0.4,
    zIndex: 10,
    filter: 'brightness(0.5) saturate(0.6)',
    pointerEvents: 'auto',
    cursor: 'pointer',
  },
  back: {
    transform: 'translateX(0) translateY(18%) scale(0.5)',
    opacity: 0,
    zIndex: 5,
    filter: 'brightness(0.2)',
    pointerEvents: 'none',
  },
}

/* ─── Main component ────────────────────────────────────────────────────── */

export default function StadiumHero() {
  const [active, setActive] = useState(0)
  const [locked, setLocked] = useState(false)
  const lockRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navigate = useCallback((dir: NavDir) => {
    if (locked) return
    setLocked(true)
    setActive(prev => dir === 'next' ? (prev + 1) % N : (prev + N - 1) % N)
    lockRef.current = setTimeout(() => setLocked(false), 700)
  }, [locked])

  const jumpTo = useCallback((i: number) => {
    if (locked || i === active) return
    setLocked(true)
    setActive(i)
    lockRef.current = setTimeout(() => setLocked(false), 700)
  }, [locked, active])

  // Auto-advance every 5s
  useEffect(() => {
    const id = setInterval(() => navigate('next'), 5000)
    return () => clearInterval(id)
  }, [navigate])

  useEffect(() => () => { if (lockRef.current) clearTimeout(lockRef.current) }, [])

  const item = HERO_ITEMS[active]

  return (
    <section
      className="relative -mx-4 -mt-8 overflow-hidden"
      style={{ height: '100svh', minHeight: 640, background: '#060d0a' }}
    >
      {/* Layer 1: pitch lines */}
      <PitchLines />

      {/* Layer 2: floodlight + accent glows */}
      <GlowLayer accent={item.accent} />

      {/* Layer 3: film grain */}
      <GrainOverlay />

      {/* Layer 4: ghost "11°" watermark */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        style={{ zIndex: 4 }}
      >
        <span
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 'clamp(200px, 34vw, 460px)',
            color: 'rgba(255,255,255,0.016)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
          }}
        >
          11°
        </span>
      </div>

      {/* Layer 5: stats ticker (desktop) */}
      <div className="absolute top-0 left-0 right-0 z-30 hidden md:block border-b border-white/5 bg-black/25 backdrop-blur-sm">
        <StatsTicker accent={item.accent} />
      </div>

      {/* Layer 6: carousel stage */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ zIndex: 10 }}
      >
        <div style={{ position: 'relative', width: 360, height: 440 }}>
          {HERO_ITEMS.map((hi, i) => {
            const role = getRole(i, active)
            return (
              <div
                key={hi.id}
                onClick={() => {
                  if (role === 'left') navigate('prev')
                  else if (role === 'right') navigate('next')
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  transition: `all ${DURATION} ${EASE}`,
                  ...ROLE_STYLES[role],
                }}
              >
                <CarouselCard item={hi} isCenter={role === 'center'} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Layer 7: bottom-left info panel */}
      <BottomLeft item={item} active={active} locked={locked} navigate={navigate} jumpTo={jumpTo} />

      {/* Layer 8: bottom-right CTA */}
      <BottomRight />
    </section>
  )
}

/* ─── CarouselCard ───────────────────────────────────────────────────────── */

function CarouselCard({
  item,
  isCenter,
}: {
  item: (typeof HERO_ITEMS)[number]
  isCenter: boolean
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        background: item.bg,
        border: `1px solid ${item.border}`,
        boxShadow: isCenter
          ? `0 0 80px ${item.accent}14, 0 28px 80px rgba(0,0,0,0.75)`
          : '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '28px 24px',
        gap: 14,
        transition: `box-shadow ${DURATION} ${EASE}`,
      }}
    >
      {/* Top label */}
      <div
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: item.accent,
          textTransform: 'uppercase',
          opacity: 0.8,
        }}
      >
        {item.label}
      </div>

      {/* Asset image */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: 0,
        }}
      >
        <img
          src={item.img}
          alt={item.label}
          draggable={false}
          style={{
            maxWidth: '90%',
            maxHeight: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            display: 'block',
          }}
        />
      </div>

      {/* Bottom eyebrow */}
      <div
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.16em',
          color: 'rgba(255,255,255,0.38)',
          textTransform: 'uppercase',
        }}
      >
        {item.eyebrow}
      </div>
    </div>
  )
}

/* ─── BottomLeft panel ───────────────────────────────────────────────────── */

function BottomLeft({
  item,
  active,
  locked,
  navigate,
  jumpTo,
}: {
  item: (typeof HERO_ITEMS)[number]
  active: number
  locked: boolean
  navigate: (d: NavDir) => void
  jumpTo: (i: number) => void
}) {
  return (
    <div
      className="absolute bottom-0 left-0 z-30 p-6 md:p-10"
      style={{ maxWidth: 500 }}
    >
      {/* Eyebrow label */}
      <div
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: item.accent,
          textTransform: 'uppercase',
          marginBottom: 8,
          transition: `color ${DURATION} ${EASE}`,
        }}
      >
        HOOK-POWERED WORLD CUP MARKETS
      </div>

      {/* Main headline */}
      <h1
        style={{
          fontFamily: "'Anton', sans-serif",
          fontSize: 'clamp(32px, 5vw, 68px)',
          lineHeight: 1,
          color: '#ffffff',
          letterSpacing: '-0.01em',
          margin: 0,
          transition: `all ${DURATION} ${EASE}`,
        }}
      >
        {item.headline}
      </h1>

      {/* Description */}
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          lineHeight: 1.65,
          color: 'rgba(255,255,255,0.45)',
          maxWidth: 340,
          margin: '12px 0 0',
          transition: `all ${DURATION} ${EASE}`,
        }}
      >
        {item.sub}
      </p>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22 }}>
        {/* Dot indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {HERO_ITEMS.map((_, i) => (
            <button
              key={i}
              onClick={() => jumpTo(i)}
              style={{
                width: i === active ? 22 : 6,
                height: 6,
                borderRadius: 3,
                background: i === active ? item.accent : 'rgba(255,255,255,0.18)',
                border: 'none',
                padding: 0,
                cursor: i === active ? 'default' : 'pointer',
                transition: 'all 400ms ease',
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Arrow buttons */}
        <button
          onClick={() => navigate('prev')}
          disabled={locked}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.05)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: locked ? 'not-allowed' : 'pointer',
            opacity: locked ? 0.4 : 1,
            transition: 'border-color 200ms, opacity 200ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
        >
          <ArrowLeft size={13} />
        </button>
        <button
          onClick={() => navigate('next')}
          disabled={locked}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.05)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: locked ? 'not-allowed' : 'pointer',
            opacity: locked ? 0.4 : 1,
            transition: 'border-color 200ms, opacity 200ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
        >
          <ArrowRight size={13} />
        </button>

        {/* Counter */}
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          {String(active + 1).padStart(2, '0')}&nbsp;/&nbsp;{String(N).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}

/* ─── BottomRight CTA ────────────────────────────────────────────────────── */

function BottomRight() {
  return (
    <div
      className="absolute bottom-0 right-0 z-30 p-6 md:p-10"
      style={{ textAlign: 'right' }}
    >
      <div
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.25)',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Back Your Team · Trade The Match · Win The Cup
      </div>
      <Link
        to="/conviction"
        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 12 }}
        className="group"
      >
        <span
          className="group-hover:opacity-80 transition-opacity"
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 'clamp(22px, 3.8vw, 52px)',
            color: '#ffffff',
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          ENTER 11°
        </span>
        <ArrowRight
          size={Math.min(28, 22)}
          className="text-white group-hover:opacity-80 transition-opacity"
          style={{ flexShrink: 0, marginTop: 2 }}
        />
      </Link>
    </div>
  )
}

/* ─── PitchLines ─────────────────────────────────────────────────────────── */

function PitchLines() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
      <svg
        className="absolute top-0 left-0 w-full h-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke="rgba(74,222,128,0.055)"
        strokeWidth="1"
      >
        <rect x="60" y="40" width="1080" height="720" />
        <line x1="600" y1="40" x2="600" y2="760" />
        <circle cx="600" cy="400" r="100" />
        <circle cx="600" cy="400" r="5" fill="rgba(74,222,128,0.10)" stroke="none" />
        {/* Left penalty box */}
        <rect x="60" y="200" width="200" height="280" />
        <rect x="60" y="270" width="65" height="140" />
        <circle cx="190" cy="390" r="4" fill="rgba(74,222,128,0.10)" stroke="none" />
        <path d="M 260 215 A 85 85 0 0 1 260 465" />
        {/* Right penalty box */}
        <rect x="940" y="200" width="200" height="280" />
        <rect x="1075" y="270" width="65" height="140" />
        <circle cx="1010" cy="390" r="4" fill="rgba(74,222,128,0.10)" stroke="none" />
        <path d="M 940 215 A 85 85 0 0 0 940 465" />
        {/* Corner arcs */}
        <path d="M 60 56 A 16 16 0 0 1 76 40" />
        <path d="M 1124 40 A 16 16 0 0 1 1140 56" />
        <path d="M 76 760 A 16 16 0 0 1 60 744" />
        <path d="M 1140 744 A 16 16 0 0 1 1124 760" />
      </svg>
      {/* Radial vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 25%, rgba(6,13,10,0.75) 100%)',
        }}
      />
    </div>
  )
}

/* ─── GlowLayer ──────────────────────────────────────────────────────────── */

function GlowLayer({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
      {/* Top-left floodlight */}
      <div
        style={{
          position: 'absolute',
          top: -120,
          left: '18%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 65%)',
          filter: 'blur(50px)',
        }}
      />
      {/* Top-right floodlight */}
      <div
        style={{
          position: 'absolute',
          top: -120,
          right: '18%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 65%)',
          filter: 'blur(50px)',
        }}
      />
      {/* Center accent glow — follows active item color */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}0e 0%, transparent 60%)`,
          filter: 'blur(70px)',
          transition: `background ${DURATION} ${EASE}`,
        }}
      />
    </div>
  )
}

/* ─── GrainOverlay ───────────────────────────────────────────────────────── */

function GrainOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 5,
        opacity: 0.3,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`,
        backgroundSize: '160px 160px',
        mixBlendMode: 'overlay',
      }}
    />
  )
}

/* ─── StatsTicker ────────────────────────────────────────────────────────── */

function StatsTicker({ accent }: { accent: string }) {
  const items = [
    '48 TEAMS',
    '104 MATCHES',
    'V4 HOOK POOLS',
    'CHAMPION POOL LIVE',
    'CONVICTION VAULT',
    'VAR PREDICTION MARKETS',
    'X LAYER TESTNET',
    'UNISWAP V4 HOOKS',
  ]
  const doubled = [...items, ...items]

  return (
    <div style={{ overflow: 'hidden', height: 30, display: 'flex', alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          animation: 'stadiumTicker 30s linear infinite',
        }}
      >
        {doubled.map((item, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)',
                paddingLeft: 28,
                paddingRight: 28,
              }}
            >
              {item}
            </span>
            <span style={{ color: accent, fontSize: 8, transition: `color ${DURATION} ${EASE}` }}>·</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes stadiumTicker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
