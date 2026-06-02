import { formatUSDC } from './contracts'

const C = {
  dark:   '#080e08',
  card:   '#0d160d',
  border: '#1c2c1c',
  text:   '#dce4dc',
  muted:  '#5a735a',
  green:  '#00ff87',
  gold:   '#ffd700',
}

export async function generateShareCard({ team, amount, wallet }) {
  const W = 1200, H = 630
  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Wait for web fonts before drawing text
  try { await document.fonts.ready } catch {}

  ctx.textBaseline = 'alphabetic'

  const pad = 28   // card inset from canvas edge
  const lx  = 80   // left content x (inside card + accent bar)

  // ── Outer background ────────────────────────────────────────────────────
  ctx.fillStyle = C.dark
  ctx.fillRect(0, 0, W, H)

  // ── Card fill ───────────────────────────────────────────────────────────
  ctx.fillStyle = C.card
  ctx.fillRect(pad, pad, W - pad * 2, H - pad * 2)

  // ── Card border ─────────────────────────────────────────────────────────
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.strokeRect(pad + 0.5, pad + 0.5, W - pad * 2 - 1, H - pad * 2 - 1)

  // ── Green left accent bar ───────────────────────────────────────────────
  ctx.fillStyle = C.green
  ctx.fillRect(pad, pad, 4, H - pad * 2)

  // ── Subtle green glow behind flag area ──────────────────────────────────
  const grd = ctx.createRadialGradient(200, 290, 0, 200, 290, 300)
  grd.addColorStop(0, 'rgba(0,255,135,0.07)')
  grd.addColorStop(1, 'rgba(0,255,135,0)')
  ctx.fillStyle = grd
  ctx.fillRect(pad, pad, W - pad * 2, H - pad * 2)

  // ── 11° logo (top-left) ──────────────────────────────────────────────────
  ctx.fillStyle = C.green
  ctx.font = 'bold 52px "DM Sans", DM Sans, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('11°', lx, 104)

  // ── App URL (top-right) ──────────────────────────────────────────────────
  ctx.fillStyle = C.muted
  ctx.font = '500 15px "JetBrains Mono", JetBrains Mono, monospace'
  ctx.textAlign = 'right'
  ctx.fillText('e11even-men.vercel.app', W - 64, 100)
  ctx.textAlign = 'left'

  // ── Flag emoji ───────────────────────────────────────────────────────────
  ctx.font = '100px serif'
  ctx.fillText(team.flag, lx, 280)

  // ── Team name (auto-scale for long names) ────────────────────────────────
  const maxNameWidth = W - lx - 80
  let nameSize = 76
  ctx.font = `bold ${nameSize}px "DM Sans", DM Sans, sans-serif`
  while (ctx.measureText(team.name.toUpperCase()).width > maxNameWidth && nameSize > 32) {
    nameSize -= 4
    ctx.font = `bold ${nameSize}px "DM Sans", DM Sans, sans-serif`
  }
  ctx.fillStyle = C.text
  ctx.fillText(team.name.toUpperCase(), lx, 378)

  // ── USDC amount ──────────────────────────────────────────────────────────
  ctx.fillStyle = C.gold
  ctx.font = 'bold 50px "DM Sans", DM Sans, sans-serif'
  ctx.fillText(`$${formatUSDC(amount ?? 0n)} USDC`, lx, 452)

  // ── Conviction label ─────────────────────────────────────────────────────
  ctx.fillStyle = C.muted
  ctx.font = '500 14px "JetBrains Mono", JetBrains Mono, monospace'
  ctx.fillText('CONVICTION LOCKED · WORLD CUP 2026', lx, 498)

  // ── Divider ──────────────────────────────────────────────────────────────
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(lx, 526)
  ctx.lineTo(W - 64, 526)
  ctx.stroke()

  // ── Wallet address (bottom-left) ─────────────────────────────────────────
  if (wallet) {
    const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
    ctx.fillStyle = C.muted
    ctx.font = '13px "JetBrains Mono", JetBrains Mono, monospace'
    ctx.textAlign = 'left'
    ctx.fillText(short, lx, 564)
  }

  // ── Attribution (bottom-right) ────────────────────────────────────────────
  ctx.fillStyle = C.muted
  ctx.font = '13px "JetBrains Mono", JetBrains Mono, monospace'
  ctx.textAlign = 'right'
  ctx.fillText('Uniswap V4 · X Layer Testnet', W - 64, 564)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}
