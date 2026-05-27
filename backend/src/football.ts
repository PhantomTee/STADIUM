import axios from 'axios'
import { config } from './config'

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

const api = axios.create({
  baseURL: config.footballApiBase,
  headers: config.footballApiKey ? { 'X-Auth-Token': config.footballApiKey } : {},
  timeout: 10_000,
})

let _cache:     FootballMatch[] = []
let _lastFetch  = 0
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

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
    // return stale cache on transient failure
  }

  return _cache
}

export function getCachedMatches(): FootballMatch[] {
  return _cache
}
