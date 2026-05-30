import React from 'react'

// Pure CSS/SVG abstract 3D football — no external assets, no copyright risk.
// Uses:
//   • Radial-gradient sphere shading (fixed layer, gives 3D depth)
//   • Rotating seam pattern (pentagon + 5 radiating curves + outer ring arcs)
//   • Floating animation
//   • Stadium-green glow
export default function FootballBall({ size = 320 }) {
  const s  = size
  const c  = s / 2
  const r  = s * 0.455   // ball radius within viewBox
  const pr = r * 0.30    // pentagon inner radius
  const n  = 5
  const startDeg = -90   // top vertex

  // Pentagon vertices
  const pentVerts = Array.from({ length: n }, (_, i) => {
    const a = (startDeg + i * 72) * (Math.PI / 180)
    return { x: c + pr * Math.cos(a), y: c + pr * Math.sin(a), a }
  })

  // Seam curves: pentagon vertex → ball edge (same angle)
  const seams = pentVerts.map(({ x, y, a }) => {
    const ex = c + r * Math.cos(a)
    const ey = c + r * Math.sin(a)
    // Control point: midpoint pushed ~12px outward from center
    const mx = (x + ex) / 2
    const my = (y + ey) / 2
    const perp = a + Math.PI / 2
    const qx = mx + 10 * Math.cos(perp)
    const qy = my + 10 * Math.sin(perp)
    return `M ${x.toFixed(2)},${y.toFixed(2)} Q ${qx.toFixed(2)},${qy.toFixed(2)} ${ex.toFixed(2)},${ey.toFixed(2)}`
  })

  // Outer ring arcs: connect adjacent edge-end-points at r=72%
  // Junction points sit between each pair of seam arms at offset angles, at intermediate radius
  const jR  = r * 0.72
  const junctions = Array.from({ length: n }, (_, i) => {
    const a = (startDeg + 36 + i * 72) * (Math.PI / 180)
    return { x: c + jR * Math.cos(a), y: c + jR * Math.sin(a) }
  })

  const outerArcs = junctions.map((j, i) => {
    const prev = pentVerts[i]
    const next = pentVerts[(i + 1) % n]
    // From pentagon vertex to junction: simulates hexagon top edge
    const ax = c + r * Math.cos(prev.a)
    const ay = c + r * Math.sin(prev.a)
    // mid control toward ball center slightly
    const mx1 = (ax + j.x) / 2 + (c - (ax + j.x) / 2) * 0.08
    const my1 = (ay + j.y) / 2 + (c - (ay + j.y) / 2) * 0.08
    return `M ${j.x.toFixed(2)},${j.y.toFixed(2)} Q ${mx1.toFixed(2)},${my1.toFixed(2)} ${ax.toFixed(2)},${ay.toFixed(2)}`
  })

  const pentagonPath = pentVerts.map((v, i) =>
    `${i === 0 ? 'M' : 'L'} ${v.x.toFixed(2)},${v.y.toFixed(2)}`
  ).join(' ') + ' Z'

  const uid = 'fb'

  return (
    <div style={{ position: 'relative', width: s, height: s, flexShrink: 0 }}>
      <style>{`
        @keyframes ${uid}-float {
          0%,100% { transform: translateY(0px) rotate(-2deg); }
          50%      { transform: translateY(-18px) rotate(2deg); }
        }
        @keyframes ${uid}-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ${uid}-pulse {
          0%,100% { opacity: 0.12; }
          50%      { opacity: 0.22; }
        }
      `}</style>

      {/* Outer ambient glow */}
      <div style={{
        position: 'absolute',
        inset: -s * 0.18,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,255,135,0.13) 30%, transparent 70%)',
        animation: `${uid}-pulse 3s ease-in-out infinite`,
        pointerEvents: 'none',
      }} />

      {/* Floating wrapper */}
      <div style={{
        width: s, height: s,
        animation: `${uid}-float 4.5s ease-in-out infinite`,
      }}>
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} overflow="visible">
          <defs>
            {/* 3D sphere shading: light from upper-left */}
            <radialGradient id={`${uid}-sphere`} cx="34%" cy="26%" r="68%">
              <stop offset="0%"   stopColor="#224433" />
              <stop offset="38%"  stopColor="#0e2018" />
              <stop offset="72%"  stopColor="#050e07" />
              <stop offset="100%" stopColor="#010401" />
            </radialGradient>

            {/* Soft specular */}
            <radialGradient id={`${uid}-spec`} cx="36%" cy="28%" r="38%">
              <stop offset="0%"   stopColor="rgba(0,255,135,0.18)" />
              <stop offset="60%"  stopColor="rgba(0,255,135,0.04)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>

            {/* Clip to circle */}
            <clipPath id={`${uid}-clip`}>
              <circle cx={c} cy={c} r={r} />
            </clipPath>

            {/* Seam glow filter */}
            <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── Sphere base ── */}
          <circle cx={c} cy={c} r={r} fill={`url(#${uid}-sphere)`} />

          {/* ── Rotating seam layer ── */}
          <g clipPath={`url(#${uid}-clip)`}>
            <g
              style={{
                transformOrigin: `${c}px ${c}px`,
                animation: `${uid}-spin 14s linear infinite`,
              }}
              stroke="#00ff87"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
              filter={`url(#${uid}-glow)`}
              opacity="0.6"
            >
              {/* Central pentagon outline */}
              <path d={pentagonPath} />

              {/* 5 seam arms to ball edge */}
              {seams.map((d, i) => <path key={`s${i}`} d={d} />)}

              {/* 5 outer junction arcs */}
              {outerArcs.map((d, i) => <path key={`a${i}`} d={d} />)}
            </g>

            {/* Pentagon face fill (dim green) */}
            <path
              d={pentagonPath}
              fill="rgba(0,255,135,0.07)"
              stroke="none"
              style={{
                transformOrigin: `${c}px ${c}px`,
                animation: `${uid}-spin 14s linear infinite`,
              }}
            />
          </g>

          {/* ── Specular highlight (static, on top) ── */}
          <circle cx={c} cy={c} r={r} fill={`url(#${uid}-spec)`} />

          {/* ── Rim shadow for depth ── */}
          <circle
            cx={c} cy={c} r={r}
            fill="none"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth={r * 0.12}
            clipPath={`url(#${uid}-clip)`}
          />

          {/* ── Thin bright rim ── */}
          <circle
            cx={c} cy={c} r={r - 0.8}
            fill="none"
            stroke="rgba(0,255,135,0.12)"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  )
}
