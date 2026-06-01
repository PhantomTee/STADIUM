/**
 * Football data service for 11°.
 *
 * All match data is fetched from our own backend (/api/football/...).
 * The backend proxies football-data.org using a server-side API key.
 *
 * SECURITY: No API keys live in frontend code or VITE_ environment variables.
 * Set VITE_API_BASE_URL to override (e.g. http://localhost:3001 in dev).
 */

export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'https://stadium-production-7c50.up.railway.app').replace(/\/$/, '')

// ── Public types (consumed by components) ────────────────────────────────────

export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed'

export type MatchEvent = {
  minute: number
  type: 'goal' | 'red_card' | 'yellow_card' | 'substitution' | 'var'
  teamId: number
  player?: string
}

export type MatchScore = {
  matchId:     number
  teamAId:     number
  teamBId:     number
  teamAName:   string
  teamBName:   string
  teamAAbbr:   string
  teamBAbbr:   string
  teamAScore:  number
  teamBScore:  number
  minute:      number | null
  status:      MatchStatus
  kickoffTime: string
  venue?:      string
  events:      MatchEvent[]
}

export type StandingRow = {
  teamId:      number
  teamName:    string
  teamAbbr:    string
  played:      number
  won:         number
  drawn:       number
  lost:        number
  goalsFor:    number
  goalsAgainst: number
  points:      number
}

export type StandingGroup = {
  group: string
  table: StandingRow[]
}

// ── Mock data (fallback when backend is unreachable) ─────────────────────────

const MOCK_FIXTURES: MatchScore[] = [
  {
    matchId: 1001,
    teamAId: 37, teamBId: 33,
    teamAName: 'Argentina', teamBName: 'France',
    teamAAbbr: 'ARG', teamBAbbr: 'FRA',
    teamAScore: 2, teamBScore: 1,
    minute: 73, status: 'live',
    kickoffTime: new Date(Date.now() - 73 * 60 * 1000).toISOString(),
    venue: 'MetLife Stadium',
    events: [
      { minute: 12, type: 'goal',        teamId: 37, player: 'L. Messi' },
      { minute: 34, type: 'goal',        teamId: 33, player: 'K. Mbappé' },
      { minute: 58, type: 'goal',        teamId: 37, player: 'J. Álvarez' },
      { minute: 62, type: 'yellow_card', teamId: 33, player: 'A. Tchouaméni' },
      { minute: 70, type: 'var',         teamId: 37 },
    ],
  },
  {
    matchId: 1002,
    teamAId: 9, teamBId: 17,
    teamAName: 'Brazil', teamBName: 'Germany',
    teamAAbbr: 'BRA', teamBAbbr: 'GER',
    teamAScore: 0, teamBScore: 0,
    minute: null, status: 'scheduled',
    kickoffTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    venue: 'Rose Bowl',
    events: [],
  },
  {
    matchId: 1003,
    teamAId: 45, teamBId: 29,
    teamAName: 'England', teamBName: 'Spain',
    teamAAbbr: 'ENG', teamBAbbr: 'ESP',
    teamAScore: 1, teamBScore: 3,
    minute: null, status: 'finished',
    kickoffTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    venue: 'AT&T Stadium',
    events: [
      { minute: 5,  type: 'goal',     teamId: 29, player: 'L. Yamal' },
      { minute: 31, type: 'goal',     teamId: 45, player: 'J. Bellingham' },
      { minute: 47, type: 'red_card', teamId: 45, player: 'D. Rice' },
      { minute: 61, type: 'goal',     teamId: 29, player: 'M. Oyarzabal' },
      { minute: 88, type: 'goal',     teamId: 29, player: 'P. Moreno' },
    ],
  },
  {
    matchId: 1004,
    teamAId: 1, teamBId: 3,
    teamAName: 'Mexico', teamBName: 'South Korea',
    teamAAbbr: 'MEX', teamBAbbr: 'KOR',
    teamAScore: 0, teamBScore: 0,
    minute: 45, status: 'halftime',
    kickoffTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    venue: 'Estadio Azteca',
    events: [
      { minute: 23, type: 'yellow_card', teamId: 1, player: 'H. Lozano' },
    ],
  },
]

const MOCK_STANDINGS: StandingGroup[] = [
  {
    group: 'GROUP_J',
    table: [
      { teamId: 37, teamName: 'Argentina', teamAbbr: 'ARG', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 7, goalsAgainst: 2, points: 9 },
      { teamId: 38, teamName: 'Algeria',   teamAbbr: 'ALG', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 4, points: 4 },
      { teamId: 39, teamName: 'Austria',   teamAbbr: 'AUT', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 4, points: 3 },
      { teamId: 40, teamName: 'Jordan',    teamAbbr: 'JOR', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 1, goalsAgainst: 3, points: 1 },
    ],
  },
  {
    group: 'GROUP_L',
    table: [
      { teamId: 29, teamName: 'Spain',    teamAbbr: 'ESP', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 6, goalsAgainst: 3, points: 6 },
      { teamId: 45, teamName: 'England',  teamAbbr: 'ENG', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 3, goalsAgainst: 5, points: 3 },
      { teamId: 46, teamName: 'Croatia',  teamAbbr: 'CRO', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 4, points: 3 },
      { teamId: 47, teamName: 'Ghana',    teamAbbr: 'GHA', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 1, points: 3 },
    ],
  },
]

// ── Internal helpers ──────────────────────────────────────────────────────────

function toMatchScore(m: any): MatchScore {
  return {
    matchId:     m.matchId,
    teamAId:     m.teamAId  ?? 0,
    teamBId:     m.teamBId  ?? 0,
    teamAName:   m.teamAName,
    teamBName:   m.teamBName,
    teamAAbbr:   m.teamAAbbr,
    teamBAbbr:   m.teamBAbbr,
    teamAScore:  m.teamAScore,
    teamBScore:  m.teamBScore,
    minute:      m.minute  ?? null,
    status:      m.status,
    kickoffTime: m.kickoffTime,
    venue:       m.venue,
    events:      m.events  ?? [],
  }
}

function toStandingRow(r: any): StandingRow {
  return {
    teamId:       r.teamId      ?? 0,
    teamName:     r.teamName,
    teamAbbr:     r.teamAbbr,
    played:       r.played,
    won:          r.won,
    drawn:        r.drawn,
    lost:         r.lost,
    goalsFor:     r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    points:       r.points,
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} at ${path}`)
  return res.json()
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all competition fixtures (upcoming + finished). */
export async function getFixtures(): Promise<MatchScore[]> {
  try {
    const data = await apiFetch<{ matches: any[] }>('/api/football/fixtures')
    return data.matches.map(toMatchScore)
  } catch (err) {
    console.warn('[footballData] getFixtures fell back to mock:', err)
    return MOCK_FIXTURES
  }
}

/** Returns currently live/halftime matches (30-sec cache on backend). */
export async function getLiveMatches(): Promise<MatchScore[]> {
  try {
    const data = await apiFetch<{ matches: any[] }>('/api/football/live')
    return data.matches.map(toMatchScore)
  } catch (err) {
    console.warn('[footballData] getLiveMatches fell back to mock:', err)
    return MOCK_FIXTURES.filter(m => m.status === 'live' || m.status === 'halftime')
  }
}

/** Returns a single match by external fixture ID. */
export async function getLiveScore(matchId: number): Promise<MatchScore | null> {
  try {
    const data = await apiFetch<{ match: any }>(`/api/football/matches/${matchId}`)
    return toMatchScore(data.match)
  } catch (err) {
    console.warn('[footballData] getLiveScore fell back to mock:', err)
    return MOCK_FIXTURES.find(m => m.matchId === matchId) ?? null
  }
}

/** Returns group standings. Each group contains a sorted table. */
export async function getGroupStandings(): Promise<StandingGroup[]> {
  try {
    const data = await apiFetch<{ groups: any[] }>('/api/football/standings')
    return data.groups.map(g => ({
      group: g.group as string,
      table: (g.table as any[]).map(toStandingRow),
    }))
  } catch (err) {
    console.warn('[footballData] getGroupStandings fell back to mock:', err)
    return MOCK_STANDINGS
  }
}

/** Flat standings list — all groups concatenated (legacy compat). */
export async function getStandings(): Promise<StandingRow[]> {
  const groups = await getGroupStandings()
  return groups.flatMap(g => g.table)
}

/** Match events are not available via football-data.org free tier. */
export async function getMatchEvents(_matchId: number): Promise<MatchEvent[]> {
  return []
}

/** Backend provider status (for UI badge). */
export async function getProviderStatus(): Promise<{
  provider: string
  lastFetch: number
  matchCount: number
  liveCount: number
}> {
  try {
    return await apiFetch('/api/football/status')
  } catch {
    return { provider: 'mock', lastFetch: 0, matchCount: 0, liveCount: 0 }
  }
}
