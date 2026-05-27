/**
 * Football data adapter for 11°.
 *
 * Supports API-Football (api-football.com) and Sportmonks as live providers.
 * Falls back to mock data when no API key is configured.
 *
 * Set ONE of these env vars to enable live data:
 *   VITE_API_FOOTBALL_KEY=<your key>   → uses api-football.com (RapidAPI)
 *   VITE_SPORTMONKS_KEY=<your key>     → uses sportmonks.com
 *
 * Internal types are provider-agnostic — components only import from this file.
 */

// ─────────────────────────────── Internal types ───────────────────────────────

export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed'

export type MatchEvent = {
  minute: number
  type: 'goal' | 'red_card' | 'yellow_card' | 'substitution' | 'var'
  teamId: number
  player?: string
}

export type MatchScore = {
  matchId: number
  teamAId: number
  teamBId: number
  teamAName: string
  teamBName: string
  teamAAbbr: string
  teamBAbbr: string
  teamAScore: number
  teamBScore: number
  minute: number | null
  status: MatchStatus
  kickoffTime: string
  venue?: string
  events: MatchEvent[]
}

export type StandingRow = {
  teamId: number
  teamName: string
  teamAbbr: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

// ─────────────────────────────── Mock data ───────────────────────────────────

const MOCK_FIXTURES: MatchScore[] = [
  {
    matchId: 1001,
    teamAId: 37,  teamBId: 33,
    teamAName: 'Argentina', teamBName: 'France',
    teamAAbbr: 'ARG',       teamBAbbr: 'FRA',
    teamAScore: 2, teamBScore: 1,
    minute: 73,
    status: 'live',
    kickoffTime: new Date(Date.now() - 73 * 60 * 1000).toISOString(),
    venue: 'MetLife Stadium',
    events: [
      { minute: 12, type: 'goal',     teamId: 37, player: 'L. Messi' },
      { minute: 34, type: 'goal',     teamId: 33, player: 'K. Mbappé' },
      { minute: 58, type: 'goal',     teamId: 37, player: 'J. Álvarez' },
      { minute: 62, type: 'yellow_card', teamId: 33, player: 'A. Tchouaméni' },
      { minute: 70, type: 'var',      teamId: 37 },
    ],
  },
  {
    matchId: 1002,
    teamAId: 9,   teamBId: 26,
    teamAName: 'Brazil',   teamBName: 'Germany',
    teamAAbbr: 'BRA',      teamBAbbr: 'GER',
    teamAScore: 0, teamBScore: 0,
    minute: null,
    status: 'scheduled',
    kickoffTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    venue: 'Rose Bowl',
    events: [],
  },
  {
    matchId: 1003,
    teamAId: 45,  teamBId: 10,
    teamAName: 'England',  teamBName: 'Spain',
    teamAAbbr: 'ENG',      teamBAbbr: 'ESP',
    teamAScore: 1, teamBScore: 3,
    minute: 90,
    status: 'finished',
    kickoffTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    venue: 'AT&T Stadium',
    events: [
      { minute: 5,  type: 'goal',     teamId: 10, player: 'L. Yamal' },
      { minute: 31, type: 'goal',     teamId: 45, player: 'J. Bellingham' },
      { minute: 47, type: 'red_card', teamId: 45, player: 'D. Rice' },
      { minute: 61, type: 'goal',     teamId: 10, player: 'M. Oyarzabal' },
      { minute: 88, type: 'goal',     teamId: 10, player: 'P. Moreno' },
    ],
  },
  {
    matchId: 1004,
    teamAId: 1,   teamBId: 3,
    teamAName: 'Mexico',   teamBName: 'South Korea',
    teamAAbbr: 'MEX',      teamBAbbr: 'KOR',
    teamAScore: 0, teamBScore: 0,
    minute: 45,
    status: 'halftime',
    kickoffTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    venue: 'Estadio Azteca',
    events: [
      { minute: 23, type: 'yellow_card', teamId: 1, player: 'H. Lozano' },
    ],
  },
]

const MOCK_STANDINGS: StandingRow[] = [
  { teamId: 37, teamName: 'Argentina',   teamAbbr: 'ARG', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 7, goalsAgainst: 2, points: 9 },
  { teamId: 10, teamName: 'Spain',       teamAbbr: 'ESP', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 6, goalsAgainst: 3, points: 6 },
  { teamId: 9,  teamName: 'Brazil',      teamAbbr: 'BRA', played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 3, goalsAgainst: 1, points: 4 },
  { teamId: 33, teamName: 'France',      teamAbbr: 'FRA', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 4, goalsAgainst: 6, points: 3 },
  { teamId: 45, teamName: 'England',     teamAbbr: 'ENG', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 3, goalsAgainst: 5, points: 3 },
  { teamId: 26, teamName: 'Germany',     teamAbbr: 'GER', played: 2, won: 0, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 2, points: 1 },
  { teamId: 1,  teamName: 'Mexico',      teamAbbr: 'MEX', played: 2, won: 0, drawn: 1, lost: 1, goalsFor: 0, goalsAgainst: 1, points: 1 },
  { teamId: 3,  teamName: 'South Korea', teamAbbr: 'KOR', played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 5, points: 0 },
]

// ─────────────────────────────── Provider: API-Football ──────────────────────

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'

function mapApiFootballStatus(short: string): MatchStatus {
  if (['1H', '2H', 'ET', 'P'].includes(short)) return 'live'
  if (short === 'HT') return 'halftime'
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished'
  if (['PST', 'CANC', 'SUSP'].includes(short)) return 'postponed'
  return 'scheduled'
}

function mapApiFootballEvent(e: any): MatchEvent {
  const typeMap: Record<string, MatchEvent['type']> = {
    Goal: 'goal',
    Card: e.detail?.includes('Red') ? 'red_card' : 'yellow_card',
    subst: 'substitution',
    Var: 'var',
  }
  return {
    minute: e.time?.elapsed ?? 0,
    type:   typeMap[e.type] ?? 'substitution',
    teamId: e.team?.id ?? 0,
    player: e.player?.name,
  }
}

async function fetchApiFootball(endpoint: string, params: Record<string, string> = {}) {
  const key = import.meta.env.VITE_API_FOOTBALL_KEY
  const url = new URL(`${API_FOOTBALL_BASE}${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': key },
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}`)
  const json = await res.json()
  return json.response
}

function normaliseApiFootballFixture(f: any): MatchScore {
  return {
    matchId:    f.fixture.id,
    teamAId:    f.teams.home.id,
    teamBId:    f.teams.away.id,
    teamAName:  f.teams.home.name,
    teamBName:  f.teams.away.name,
    teamAAbbr:  (f.teams.home.name as string).slice(0, 3).toUpperCase(),
    teamBAbbr:  (f.teams.away.name as string).slice(0, 3).toUpperCase(),
    teamAScore: f.goals.home ?? 0,
    teamBScore: f.goals.away ?? 0,
    minute:     f.fixture.status.elapsed ?? null,
    status:     mapApiFootballStatus(f.fixture.status.short),
    kickoffTime: f.fixture.date,
    venue:      f.fixture.venue?.name,
    events:     [],
  }
}

// ─────────────────────────────── Provider: Sportmonks ────────────────────────

const SPORTMONKS_BASE = 'https://api.sportmonks.com/v3/football'

function mapSportmonksStatus(name: string): MatchStatus {
  if (['LIVE', '1H', '2H', 'ET'].includes(name)) return 'live'
  if (name === 'HT') return 'halftime'
  if (['FT', 'AET', 'PENFT'].includes(name)) return 'finished'
  if (['POSTP', 'CANCL'].includes(name)) return 'postponed'
  return 'scheduled'
}

async function fetchSportmonks(endpoint: string, params: Record<string, string> = {}) {
  const key = import.meta.env.VITE_SPORTMONKS_KEY
  const url = new URL(`${SPORTMONKS_BASE}${endpoint}`)
  url.searchParams.set('api_token', key)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Sportmonks ${res.status}`)
  const json = await res.json()
  return json.data
}

function normaliseSportmonksFixture(f: any): MatchScore {
  return {
    matchId:    f.id,
    teamAId:    f.localteam_id,
    teamBId:    f.visitorteam_id,
    teamAName:  f.localTeam?.data?.name ?? '',
    teamBName:  f.visitorTeam?.data?.name ?? '',
    teamAAbbr:  (f.localTeam?.data?.name ?? '').slice(0, 3).toUpperCase(),
    teamBAbbr:  (f.visitorTeam?.data?.name ?? '').slice(0, 3).toUpperCase(),
    teamAScore: f.scores?.localteam_score ?? 0,
    teamBScore: f.scores?.visitorteam_score ?? 0,
    minute:     f.time?.minute ?? null,
    status:     mapSportmonksStatus(f.time?.status ?? ''),
    kickoffTime: f.time?.starting_at?.datetime ?? '',
    venue:      f.venue?.data?.name,
    events:     [],
  }
}

// ─────────────────────────────── Public adapter API ──────────────────────────

function activeProvider(): 'api-football' | 'sportmonks' | 'mock' {
  if (import.meta.env.VITE_API_FOOTBALL_KEY) return 'api-football'
  if (import.meta.env.VITE_SPORTMONKS_KEY)   return 'sportmonks'
  return 'mock'
}

/** Returns upcoming + live fixtures for the World Cup 2026 season. */
export async function getFixtures(): Promise<MatchScore[]> {
  const provider = activeProvider()
  try {
    if (provider === 'api-football') {
      const data = await fetchApiFootball('/fixtures', {
        league: '1',    // FIFA World Cup league ID
        season: '2026',
        next: '10',
      })
      return (data as any[]).map(normaliseApiFootballFixture)
    }
    if (provider === 'sportmonks') {
      const data = await fetchSportmonks('/fixtures', { include: 'localTeam,visitorTeam' })
      return (data as any[]).map(normaliseSportmonksFixture)
    }
  } catch (err) {
    console.warn('[footballData] getFixtures fell back to mock:', err)
  }
  return MOCK_FIXTURES
}

/** Returns live score + match minute for a specific match. */
export async function getLiveScore(matchId: number): Promise<MatchScore | null> {
  const provider = activeProvider()
  try {
    if (provider === 'api-football') {
      const data = await fetchApiFootball('/fixtures', { id: String(matchId), live: 'all' })
      if (!(data as any[]).length) return null
      return normaliseApiFootballFixture((data as any[])[0])
    }
    if (provider === 'sportmonks') {
      const data = await fetchSportmonks(`/fixtures/${matchId}`, {
        include: 'localTeam,visitorTeam,events',
      })
      return normaliseSportmonksFixture(data)
    }
  } catch (err) {
    console.warn('[footballData] getLiveScore fell back to mock:', err)
  }
  return MOCK_FIXTURES.find(m => m.matchId === matchId) ?? null
}

/** Returns match events (goals, cards, VAR decisions). */
export async function getMatchEvents(matchId: number): Promise<MatchEvent[]> {
  const provider = activeProvider()
  try {
    if (provider === 'api-football') {
      const data = await fetchApiFootball('/fixtures/events', { fixture: String(matchId) })
      return (data as any[]).map(mapApiFootballEvent)
    }
    if (provider === 'sportmonks') {
      const data = await fetchSportmonks(`/fixtures/${matchId}`, { include: 'events' })
      return ((data.events?.data ?? []) as any[]).map((e: any): MatchEvent => ({
        minute: e.minute ?? 0,
        type:   e.type === 'goal' ? 'goal' : e.type === 'redcard' ? 'red_card' : 'yellow_card',
        teamId: e.team_id ?? 0,
        player: e.player_name,
      }))
    }
  } catch (err) {
    console.warn('[footballData] getMatchEvents fell back to mock:', err)
  }
  return MOCK_FIXTURES.find(m => m.matchId === matchId)?.events ?? []
}

/** Returns group standings. */
export async function getStandings(): Promise<StandingRow[]> {
  const provider = activeProvider()
  try {
    if (provider === 'api-football') {
      const data = await fetchApiFootball('/standings', { league: '1', season: '2026' })
      const league = (data as any[])[0]?.league
      const rows   = (league?.standings?.[0] ?? []) as any[]
      return rows.map((r: any): StandingRow => ({
        teamId:       r.team.id,
        teamName:     r.team.name,
        teamAbbr:     (r.team.name as string).slice(0, 3).toUpperCase(),
        played:       r.all.played,
        won:          r.all.win,
        drawn:        r.all.draw,
        lost:         r.all.lose,
        goalsFor:     r.all.goals.for,
        goalsAgainst: r.all.goals.against,
        points:       r.points,
      }))
    }
    if (provider === 'sportmonks') {
      const data = await fetchSportmonks('/standings/season/1', {})
      return (data as any[]).map((r: any): StandingRow => ({
        teamId:       r.team_id,
        teamName:     r.team?.data?.name ?? '',
        teamAbbr:     (r.team?.data?.name ?? '').slice(0, 3).toUpperCase(),
        played:       r.overall.games_played,
        won:          r.overall.won,
        drawn:        r.overall.draw,
        lost:         r.overall.lost,
        goalsFor:     r.overall.goals_scored,
        goalsAgainst: r.overall.goals_against,
        points:       r.total.points,
      }))
    }
  } catch (err) {
    console.warn('[footballData] getStandings fell back to mock:', err)
  }
  return MOCK_STANDINGS
}
