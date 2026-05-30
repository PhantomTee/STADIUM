import React, { useRef, useEffect } from 'react'

// 3D-rotating football — canvas with proper sphere projection math.
// Great circles are defined on the unit sphere, rotated around Y axis each frame,
// and projected to 2D. Lines fade as they cross to the back hemisphere,
// giving a true Earth-rotation illusion.
export default function FootballBall({ size = 320 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')

    // Hi-DPI
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cvs.width  = size * dpr
    cvs.height = size * dpr
    ctx.scale(dpr, dpr)

    const R  = size * 0.44   // sphere radius in CSS px
    const cx = size / 2
    const cy = size / 2

    // ── helpers ──────────────────────────────────────────────────────────────
    function len([x, y, z]) { return Math.sqrt(x*x + y*y + z*z) }
    function norm(v) { const l = len(v); return v.map(x => x / l) }
    function cross([ax,ay,az], [bx,by,bz]) {
      return [ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx]
    }

    // Two orthonormal vectors spanning a great circle with given normal
    function gcBasis(n) {
      // pick any vector not parallel to n for the first basis vector
      const ref = Math.abs(n[0]) < 0.9 ? [1,0,0] : [0,1,0]
      const u = norm(cross(n, ref))
      const v = norm(cross(n, u))
      return [u, v]
    }

    // ── Football seam great circles ───────────────────────────────────────────
    // The 90 edges of a truncated icosahedron lie on exactly 6 great circles.
    // Their normals correspond to the icosahedral symmetry (golden ratio φ):
    const φ = (1 + Math.sqrt(5)) / 2
    const gcNormals = [
      [ 1,  φ,  0],
      [ 0,  1,  φ],
      [ φ,  0,  1],
      [-1,  φ,  0],
      [ 0, -1,  φ],
      [-φ,  0,  1],
    ].map(norm)

    // Pre-sample each great circle on the unit sphere (128 points)
    const STEPS = 128
    const circles = gcNormals.map(n => {
      const [u, v] = gcBasis(n)
      return Array.from({ length: STEPS }, (_, i) => {
        const t = (i / STEPS) * Math.PI * 2
        const c = Math.cos(t), s = Math.sin(t)
        return [u[0]*c + v[0]*s, u[1]*c + v[1]*s, u[2]*c + v[2]*s]
      })
    })

    let rotY  = 0
    let prevTs = 0
    let animId

    function draw() {
      ctx.clearRect(0, 0, size, size)

      // ── Sphere background ───────────────────────────────────────────────────
      const sg = ctx.createRadialGradient(cx-R*0.3, cy-R*0.28, R*0.02, cx, cy, R)
      sg.addColorStop(0,    '#1e4030')
      sg.addColorStop(0.35, '#0c2014')
      sg.addColorStop(0.72, '#050d06')
      sg.addColorStop(1,    '#010201')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI*2)
      ctx.fillStyle = sg
      ctx.fill()

      // ── Seam lines (clipped to sphere circle) ──────────────────────────────
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI*2)
      ctx.clip()

      const cosY = Math.cos(rotY)
      const sinY = Math.sin(rotY)

      circles.forEach(pts => {
        for (let i = 0; i < pts.length; i++) {
          const [x0, y0, z0] = pts[i]
          const [x1, y1, z1] = pts[(i + 1) % pts.length]

          // Rotate both endpoints around the Y axis
          const rx0 = x0*cosY - z0*sinY,  rz0 = x0*sinY + z0*cosY
          const rx1 = x1*cosY - z1*sinY,  rz1 = x1*sinY + z1*cosY

          // Skip fully back-facing segments (rz < 0 means behind the sphere)
          if (rz0 < -0.06 && rz1 < -0.06) continue

          // Alpha fades as the segment moves from front (rz≈1) to edge (rz≈0)
          const avgZ = (Math.max(0, rz0) + Math.max(0, rz1)) / 2
          const alpha = avgZ * 0.78 + 0.04
          if (alpha < 0.05) continue

          ctx.beginPath()
          ctx.moveTo(cx + rx0 * R, cy - y0 * R)
          ctx.lineTo(cx + rx1 * R, cy - y1 * R)
          ctx.strokeStyle = `rgba(0,255,135,${alpha.toFixed(3)})`
          ctx.lineWidth = 1.7
          ctx.stroke()
        }
      })

      ctx.restore()

      // ── Specular highlight (top-left, static) ─────────────────────────────
      const sp = ctx.createRadialGradient(cx-R*0.28, cy-R*0.28, 0, cx-R*0.15, cy-R*0.15, R*0.5)
      sp.addColorStop(0,   'rgba(0,255,135,0.22)')
      sp.addColorStop(0.5, 'rgba(0,255,135,0.05)')
      sp.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI*2)
      ctx.fillStyle = sp
      ctx.fill()

      // ── Rim ───────────────────────────────────────────────────────────────
      ctx.beginPath()
      ctx.arc(cx, cy, R - 0.5, 0, Math.PI*2)
      ctx.strokeStyle = 'rgba(0,255,135,0.18)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    function loop(ts) {
      if (prevTs === 0) prevTs = ts
      const dt = Math.min(ts - prevTs, 50)  // cap at 50ms so tab-blur doesn't jump
      prevTs = ts
      rotY += 0.00048 * dt  // ≈ 1 full rotation every 13 seconds
      draw()
      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [size])

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <style>{`
        @keyframes fb-float {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-16px); }
        }
        @keyframes fb-glow {
          0%,100% { opacity: 0.13; }
          50%      { opacity: 0.26; }
        }
      `}</style>

      {/* Ambient glow ring */}
      <div style={{
        position: 'absolute',
        inset: -size * 0.18,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,255,135,0.15) 25%, transparent 70%)',
        animation: 'fb-glow 3s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Floating wrapper */}
      <div style={{ animation: 'fb-float 4.5s ease-in-out infinite' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: size, height: size }}
        />
      </div>
    </div>
  )
}
