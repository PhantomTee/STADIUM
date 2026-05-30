import React from 'react'

/* ─────────────────────────────── helpers ──────────────────────────────────── */

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return '--:--' }
}

function StatusBadge({ status, minute }) {
  const map = {
    live:      { label: minute != null ? `${minute}'` : 'LIVE',  cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
    halftime:  { label: 'HT',                                    cls: 'bg-stadium-gold/15 text-stadium-gold border-stadium-gold/30' },
    finished:  { label: 'FT',                                    cls: 'bg-stadium-border text-stadium-muted border-stadium-border' },
    scheduled: { label: 'SOON',                                  cls: 'bg-stadium-green/10 text-stadium-green border-stadium-green/20' },
    postponed: { label: 'PST',                                   cls: 'bg-red-900/20 text-red-600 border-red-900/30' },
  }
  const { label, cls } = map[status] ?? map.scheduled
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold font-mono uppercase tracking-wider border ${cls}`}
      style={{ borderRadius: 2 }}>
      {status === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
      )}
      {label}
    </span>
  )
}

function EventIcon({ type }) {
  const icons = {
    goal:         { icon: '⚽', cls: 'text-stadium-green' },
    red_card:     { icon: '🟥', cls: 'text-red-500' },
    yellow_card:  { icon: '🟨', cls: 'text-yellow-400' },
    substitution: { icon: '↕',  cls: 'text-stadium-muted' },
    var:          { icon: 'VAR', cls: 'text-blue-400 text-xs font-bold' },
  }
  const { icon, cls } = icons[type] ?? icons.substitution
  return <span className={`font-mono leading-none flex-shrink-0 ${cls}`}>{icon}</span>
}

/* ─────────────────────────────── ScoreboardCard ───────────────────────────── */

export default function ScoreboardCard({ match, hookState }) {
  const {
    teamAName, teamBName, teamAAbbr, teamBAbbr,
    teamAScore, teamBScore,
    minute, status, kickoffTime, venue, events = [],
    matchId,
  } = match

  const isLive     = status === 'live' || status === 'halftime'
  const isFinished = status === 'finished'

  /* Split events by team for side columns */
  const eventsA = events.filter(e => e.teamId === match.teamAId)
  const eventsB = events.filter(e => e.teamId === match.teamBId)

  return (
    <div
      className="relative overflow-hidden border border-stadium-border"
      style={{
        background: 'rgba(4, 10, 4, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Pitch stripe tint */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 80px, rgba(0,255,135,0.018) 80px, rgba(0,255,135,0.018) 160px)',
        }} />

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-between px-4 py-2 border-b border-stadium-border/60">
        <div className="flex items-center gap-2">
          <span className="font-mono text-stadium-muted text-xs">#{matchId}</span>
          {venue && <span className="text-stadium-muted text-xs hidden sm:inline">· {venue}</span>}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} minute={minute} />
          {hookState?.active && (
            <span className="font-mono text-xs border border-stadium-green/30 bg-stadium-green/10 text-stadium-green px-2 py-0.5"
              style={{ borderRadius: 2 }}>
              HOOK {hookState.fee}%
            </span>
          )}
        </div>
      </div>

      {/* ── Main scoreboard ─────────────────────────────────────────────── */}
      <div className="relative flex items-stretch">

        {/* Team A */}
        <div className="flex-1 flex flex-col items-center justify-center py-6 px-3 gap-2">
          <div
            className="font-black text-stadium-text uppercase tracking-tight leading-none"
            style={{ fontFamily: "'Motiva Sans', 'DM Sans', sans-serif", fontSize: 'clamp(32px, 8vw, 56px)', letterSpacing: '-0.02em' }}
          >
            {teamAAbbr}
          </div>
          <div className="text-stadium-muted text-xs font-mono text-center hidden sm:block">{teamAName}</div>
          {/* Team A events */}
          <div className="flex flex-col gap-1 mt-2 min-h-[40px]">
            {eventsA.map((ev, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                <span className="text-stadium-muted font-mono w-6 text-right flex-shrink-0">{ev.minute}'</span>
                <EventIcon type={ev.type} />
                {ev.player && <span className="text-stadium-muted truncate max-w-[80px]">{ev.player.split(' ').pop()}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center justify-center px-4 py-6 border-x border-stadium-border/60 min-w-[110px]">
          <div className="flex items-baseline gap-2">
            <span
              className={`font-black leading-none ${isLive ? 'text-white' : isFinished ? 'text-stadium-muted' : 'text-stadium-border'}`}
              style={{ fontFamily: "'Motiva Sans', 'DM Sans', sans-serif", fontSize: 'clamp(42px, 10vw, 72px)', letterSpacing: '-0.04em' }}
            >
              {isLive || isFinished || status === 'halftime' ? teamAScore : '–'}
            </span>
            <span className="text-stadium-border font-mono text-2xl pb-1">:</span>
            <span
              className={`font-black leading-none ${isLive ? 'text-white' : isFinished ? 'text-stadium-muted' : 'text-stadium-border'}`}
              style={{ fontFamily: "'Motiva Sans', 'DM Sans', sans-serif", fontSize: 'clamp(42px, 10vw, 72px)', letterSpacing: '-0.04em' }}
            >
              {isLive || isFinished || status === 'halftime' ? teamBScore : '–'}
            </span>
          </div>
          {status === 'scheduled' && (
            <div className="text-stadium-green font-mono text-sm font-bold mt-1">{fmtTime(kickoffTime)}</div>
          )}
        </div>

        {/* Team B */}
        <div className="flex-1 flex flex-col items-center justify-center py-6 px-3 gap-2">
          <div
            className="font-black text-stadium-text uppercase tracking-tight leading-none"
            style={{ fontFamily: "'Motiva Sans', 'DM Sans', sans-serif", fontSize: 'clamp(32px, 8vw, 56px)', letterSpacing: '-0.02em' }}
          >
            {teamBAbbr}
          </div>
          <div className="text-stadium-muted text-xs font-mono text-center hidden sm:block">{teamBName}</div>
          {/* Team B events */}
          <div className="flex flex-col gap-1 mt-2 min-h-[40px]">
            {eventsB.map((ev, i) => (
              <div key={i} className="flex items-center justify-end gap-1 text-xs">
                {ev.player && <span className="text-stadium-muted truncate max-w-[80px]">{ev.player.split(' ').pop()}</span>}
                <EventIcon type={ev.type} />
                <span className="text-stadium-muted font-mono w-6 flex-shrink-0">{ev.minute}'</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── VAR market + ChampionPool strip ─────────────────────────────── */}
      {(hookState?.varStatus || hookState?.champFees) && (
        <div className="relative border-t border-stadium-border/60 flex items-center divide-x divide-stadium-border/40 text-xs font-mono">
          {hookState?.varStatus && (
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-stadium-muted uppercase tracking-widest">VAR Market</span>
              <span className={`font-bold ${
                hookState.varStatus === 'open'     ? 'text-stadium-green' :
                hookState.varStatus === 'settled'  ? 'text-stadium-muted' :
                'text-stadium-gold'
              }`}>
                {hookState.varStatus.toUpperCase()}
              </span>
            </div>
          )}
          {hookState?.champFees != null && (
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-stadium-muted uppercase tracking-widest">Champion Pool</span>
              <span className="text-stadium-gold font-bold">${hookState.champFees}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
