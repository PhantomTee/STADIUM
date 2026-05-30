import React, { useState, useEffect } from 'react'

const G = '#00ff87'

function sp(delay, dur = 0.75) {
  return {
    pathLength: 1,
    style: {
      strokeDasharray: 1,
      strokeDashoffset: 1,
      transition: `stroke-dashoffset ${dur}s cubic-bezier(0.4,0,0.2,1) ${delay}s`,
    },
  }
}

function applyDrawn(el) {
  if (!el) return
  el.style.strokeDashoffset = 0
}

export default function Preloader({ onDone }) {
  const [refs] = useState(() => Array.from({ length: 18 }, () => React.createRef()))
  const [showText, setShowText] = useState(false)
  const [exit, setExit] = useState(false)

  useEffect(() => {
    // One RAF so initial dashoffset:1 is painted before we start transitioning
    const raf = requestAnimationFrame(() => {
      refs.forEach(r => applyDrawn(r.current))
    })
    const t1 = setTimeout(() => setShowText(true), 1300)
    const t2 = setTimeout(() => setExit(true), 2200)
    const t3 = setTimeout(() => onDone?.(), 2750)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
    }
  }, [])

  // viewBox 0 0 280 180 — pitch centered
  const pw = 240, ph = 155   // pitch rect
  const px = 20, py = 12     // pitch origin
  const cx = px + pw / 2     // 140
  const cy = py + ph / 2     // 89.5 ≈ 90

  // left penalty box
  const pbW = 48, pbH = 64
  const lpbX = px, lpbY = cy - pbH / 2
  // left 6-yard
  const gbW = 16, gbH = 32
  const lgbX = px, lgbY = cy - gbH / 2
  // right mirrors
  const rpbX = px + pw - pbW, rpbY = lpbY
  const rgbX = px + pw - gbW, rgbY = lgbY
  // left goal
  const gW = 6, gH = 28
  const lgX = px - gW, lgY = cy - gH / 2
  const rgX = px + pw, rgY = lgY

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#080e08',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 28,
        opacity: exit ? 0 : 1,
        transition: 'opacity 0.55s ease',
        pointerEvents: exit ? 'none' : 'all',
      }}
    >
      {/* Pitch SVG */}
      <svg
        viewBox="0 0 280 180"
        width="min(88vw, 500px)"
        height="auto"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Outer pitch */}
        <rect ref={refs[0]} x={px} y={py} width={pw} height={ph}
          stroke={G} strokeWidth="1.8" {...sp(0, 1.0)} />

        {/* Center line */}
        <line ref={refs[1]} x1={cx} y1={py} x2={cx} y2={py + ph}
          stroke={G} strokeWidth="1.2" opacity="0.5" {...sp(0.15, 0.5)} />

        {/* Center circle */}
        <circle ref={refs[2]} cx={cx} cy={cy} r={22}
          stroke={G} strokeWidth="1.2" {...sp(0.3, 0.65)} />

        {/* Center spot */}
        <circle ref={refs[3]} cx={cx} cy={cy} r={2}
          stroke={G} strokeWidth="2" fill={G} {...sp(0.55, 0.2)} />

        {/* Left penalty box */}
        <rect ref={refs[4]} x={lpbX} y={lpbY} width={pbW} height={pbH}
          stroke={G} strokeWidth="1.2" {...sp(0.45, 0.55)} />

        {/* Left 6-yard box */}
        <rect ref={refs[5]} x={lgbX} y={lgbY} width={gbW} height={gbH}
          stroke={G} strokeWidth="1.0" opacity="0.7" {...sp(0.55, 0.4)} />

        {/* Left penalty spot */}
        <circle ref={refs[6]} cx={px + 30} cy={cy} r={1.8}
          stroke={G} strokeWidth="2" fill={G} {...sp(0.65, 0.2)} />

        {/* Left goal */}
        <rect ref={refs[7]} x={lgX} y={lgY} width={gW} height={gH}
          stroke={G} strokeWidth="1.0" opacity="0.5" {...sp(0.6, 0.35)} />

        {/* Right penalty box */}
        <rect ref={refs[8]} x={rpbX} y={rpbY} width={pbW} height={pbH}
          stroke={G} strokeWidth="1.2" {...sp(0.45, 0.55)} />

        {/* Right 6-yard box */}
        <rect ref={refs[9]} x={rgbX} y={rgbY} width={gbW} height={gbH}
          stroke={G} strokeWidth="1.0" opacity="0.7" {...sp(0.55, 0.4)} />

        {/* Right penalty spot */}
        <circle ref={refs[10]} cx={px + pw - 30} cy={cy} r={1.8}
          stroke={G} strokeWidth="2" fill={G} {...sp(0.65, 0.2)} />

        {/* Right goal */}
        <rect ref={refs[11]} x={rgX} y={rgY} width={gW} height={gH}
          stroke={G} strokeWidth="1.0" opacity="0.5" {...sp(0.6, 0.35)} />

        {/* Corner arcs */}
        {[
          `M ${px+9},${py} A 9,9 0 0 0 ${px},${py+9}`,
          `M ${px+pw-9},${py} A 9,9 0 0 1 ${px+pw},${py+9}`,
          `M ${px},${py+ph-9} A 9,9 0 0 0 ${px+9},${py+ph}`,
          `M ${px+pw},${py+ph-9} A 9,9 0 0 1 ${px+pw-9},${py+ph}`,
        ].map((d, i) => (
          <path key={i} ref={refs[12 + i]} d={d}
            stroke={G} strokeWidth="1.0" {...sp(0.7, 0.3)} />
        ))}
      </svg>

      {/* Wordmark */}
      <div style={{
        opacity: showText ? 1 : 0,
        transform: showText ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <div style={{
          fontFamily: "'Motiva Sans','DM Sans',sans-serif",
          fontSize: 'clamp(52px,10vw,88px)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          color: '#fff',
          textShadow: `0 0 40px ${G}55, 0 0 80px ${G}22`,
        }}>
          11°
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 10,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: G,
          opacity: 0.8,
        }}>
          World Cup DeFi
        </div>
      </div>
    </div>
  )
}
