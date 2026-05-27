import axios from 'axios'
import { config } from './config'
import { resolveTeamId } from './teamMap'

export interface FootballTeam {
  id:        number
  name:      string
  shortName: string
  tla:       string
}

export interface FootballScore {
  winner:    'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
  fullTime:  { home: number | null; away: number | null }
  halfTime:  { home: number | null; away: number | null }
  extraTime: { home: number | null; away: number | null } | null
  penalties: { home: number | null; away: number | null } | null
}

export type MatchStatus =
  | 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED'
  | 'FINISHED'  | 'SUSPENDED' | 'CANCELLED' | 'POSTPONED'

export interface FootballMatch {
  id:       number
  utcDate:  string
  status:   MatchStatus
  stage:    string
  group:    string | null
  homeTeam: FootballTeam
  awayTeam: FootballTeam
  score:    FootballScore
}

// ── Normalized types (shape returned by proxy routes & consumed by frontend) ──

export type NormalizedStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed'

export interface NormalizedMatch {
  matchId:     number
  teamAId:     number | null
  teamBId:     number | null
  teamAName:   string
  teamBName:   string
  teamAAbbr:   string
  teamBAbbr:   string
  teamAScore:  number
  teamBScore:  number
  minute:      number | null
  status:      NormalizedStatus
  kickoffTime: string
  stage:       string | null
  group:       string | null
  events:      never[]
}

export interface NormalizedStanding {
  position:     number
  teamId:       number | null
  teamName:     string
  teamAbbr:     string
  played:       number
  won:          number
  drawn:        number
  lost:         number
  goalsFor:     number
  goalsAgainst: number
  points:       number
}

export interface StandingGroup {
  group: string
  table: NormalizedStanding[]
}

// ── API client ────────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: config.footballApiBase,
  headers: config.footballApiKey ? { 'X-Auth-Token': config.footballApiKey } : {},
  timeout: 10_000,
})

// ── Caches ────────────────────────────────────────────────────────────────────

let _cache:     FootballMatch[] = []
let _lastFetch  = 0
const CACHE_TTL = 5 * 60 * 1000   // 5 minutes — used by keeper + fixtures proxy

let _liveCache: FootballMatch[] = []
let _liveFetch  = 0
const LIVE_TTL  = 30 * 1000       // 30 seconds — live scores only

let _standingsCache: StandingGroup[] = []
let _standingsFetch  = 0
const STANDINGS_TTL  = 10 * 60 * 1000  // 10 minutes

// ── Normalizers ───────────────────────────────────────────────────────────────

function mapFdoStatus(status: string): NormalizedStatus {
  if (status === 'IN_PLAY')  return 'live'
  if (status === 'PAUSED')   return 'halftime'
  if (status === 'FINISHED') return 'finished'
  if (['SUSPENDED', 'CANCELLED', 'POSTPONED'].includes(status)) return 'postponed'
  return 'scheduled'
}

export function normalizeMatch(m: FootballMatch): NormalizedMatch {
  return {
    matchId:     m.id,
    teamAId:     resolveTeamId(m.homeTeam.name) ?? null,
    teamBId:     resolveTeamId(m.awayTeam.name) ?? null,
    teamAName:   m.homeTeam.name,
    teamBName:   m.awayTeam.name,
    teamAAbbr:   m.homeTeam.tla,
    teamBAbbr:   m.awayTeam.tla,
    teamAScore:  m.score.fullTime.home ?? 0,
    teamBScore:  m.score.fullTime.away ?? 0,
    minute:      m.status === 'PAUSED' ? 45 : null,
    status:      mapFdoStatus(m.status),
    kickoffTime: m.utcDate,
    stage:       m.stage ?? null,
    group:       m.group ?? null,
    events:      [],
  }
}

// ── Fetch: all competition matches (keeper + fixtures proxy) ──────────────────

export async function fetchMatches(force = false): Promise<FootballMatch[]> {
  if (!config.footballApiKey) {
    if (_cache.length === 0) console.warn('[football] FOOTBALL_API_KEY not set — live sync disabled')
    return _cache
  }

  if (!force && Date.now() - _lastFetch < CACHE_TTL && _cache.length > 0) {
    return _cache
  }

  try {
    const res = await api.get(`/competitions/${config.wcCompetition}/matches`, {
      params: { season: config.wcSeason },
    })
    _cache     = (res.data.matches ?? []) as FootballMatch[]
    _lastFetch = Date.now()
    console.log(`[football] Fetched ${_cache.length} matches`)
  } catch (e: any) {
    console.error('[football] API error:', e?.response?.status, e?.message)
  }

  return _cache
}

// ── Fetch: live matches only (30-sec cache) ───────────────────────────────────

export async function fetchLiveMatches(force = false): Promise<FootballMatch[]> {
  if (!config.footballApiKey) {
    return _cache.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')
  }

  if (!force && Date.now() - _liveFetch < LIVE_TTL && _liveCache.length > 0) {
    return _liveCache
  }

  try {
    const res = await api.get(`/competitions/${config.wcCompetition}/matches`, {
      params: { season: config.wcSeason, status: 'IN_PLAY,PAUSED' },
    })
    _liveCache = (res.data.matches ?? []) as FootballMatch[]
    _liveFetch = Date.now()
    console.log(`[football] Fetched ${_liveCache.length} live matches`)
  } catch (e: any) {
    console.error('[football] Live fetch error:', e?.response?.status, e?.message)
    _liveCache = _cache.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')
  }

  return _liveCache
}

// ── Fetch: standings (10-min cache) ───────────────────────────────────────────

export async function fetchStandings(force = false): Promise<StandingGroup[]> {
  if (!config.footballApiKey) return _standingsCache

  if (!force && Date.now() - _standingsFetch < STANDINGS_TTL && _standingsCache.length > 0) {
    return _standingsCache
  }

  try {
    const res = await api.get(`/competitions/${config.wcCompetition}/standings`, {
      params: { season: config.wcSeason },
    })
    const groups = (res.data.standings ?? []) as any[]
    _standingsCache = groups.map((g: any): StandingGroup => ({
      group: g.group ?? g.stage ?? 'GROUP',
      table: (g.table ?? []).map((row: any, i: number): NormalizedStanding => ({
        position:     row.position ?? i + 1,
        teamId:       resolveTeamId(row.team?.name) ?? null,
        teamName:     row.team?.name ?? '',
        teamAbbr:     row.team?.tla ?? (row.team?.name ?? '').slice(0, 3).toUpperCase(),
        played:       row.playedGames ?? 0,
        won:          row.won ?? 0,
        drawn:        row.draw ?? 0,
        lost:         row.lost ?? 0,
        goalsFor:     row.goalsFor ?? 0,
        goalsAgainst: row.goalsAgainst ?? 0,
        points:       row.points ?? 0,
      })),
    }))
    _standingsFetch = Date.now()
    console.log(`[football] Fetched ${_standingsCache.length} standing groups`)
  } catch (e: any) {
    console.error('[football] Standings error:', e?.response?.status, e?.message)
  }

  return _standingsCache
}

export function getCachedMatches(): FootballMatch[] {
  return _cache
}

export function getProviderStatus() {
  return {
    provider:   config.footballApiKey ? 'football-data.org' : 'mock',
    lastFetch:  _lastFetch,
    matchCount: _cache.length,
    liveCount:  _liveCache.length,
  }
}
