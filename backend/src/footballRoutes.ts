import { Router, Request, Response } from 'express'
import {
  fetchMatches,
  fetchLiveMatches,
  fetchStandings,
  normalizeMatch,
  getProviderStatus,
  NormalizedMatch,
  StandingGroup,
  NormalizedStanding,
} from './football'
import { config } from './config'

export const footballRouter = Router()

// ── Mock data (served when FOOTBALL_API_KEY is not set) ───────────────────────

const MOCK_FIXTURES: NormalizedMatch[] = [
  {
    matchId: 1001,
    teamAId: 37, teamBId: 33,
    teamAName: 'Argentina', teamBName: 'France',
    teamAAbbr: 'ARG', teamBAbbr: 'FRA',
    teamAScore: 2, teamBScore: 1,
    minute: 73, status: 'live',
    kickoffTime: new Date(Date.now() - 73 * 60 * 1000).toISOString(),
    stage: 'GROUP_STAGE', group: 'GROUP_J', events: [],
  },
  {
    matchId: 1002,
    teamAId: 9, teamBId: 17,
    teamAName: 'Brazil', teamBName: 'Germany',
    teamAAbbr: 'BRA', teamBAbbr: 'GER',
    teamAScore: 0, teamBScore: 0,
    minute: null, status: 'scheduled',
    kickoffTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    stage: 'GROUP_STAGE', group: 'GROUP_C', events: [],
  },
  {
    matchId: 1003,
    teamAId: 45, teamBId: 29,
    teamAName: 'England', teamBName: 'Spain',
    teamAAbbr: 'ENG', teamBAbbr: 'ESP',
    teamAScore: 1, teamBScore: 3,
    minute: null, status: 'finished',
    kickoffTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    stage: 'GROUP_STAGE', group: 'GROUP_L', events: [],
  },
  {
    matchId: 1004,
    teamAId: 1, teamBId: 3,
    teamAName: 'Mexico', teamBName: 'South Korea',
    teamAAbbr: 'MEX', teamBAbbr: 'KOR',
    teamAScore: 0, teamBScore: 0,
    minute: 45, status: 'halftime',
    kickoffTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    stage: 'GROUP_STAGE', group: 'GROUP_A', events: [],
  },
]

const MOCK_STANDINGS: StandingGroup[] = [
  {
    group: 'GROUP_J',
    table: [
      { position: 1, teamId: 37, teamName: 'Argentina',   teamAbbr: 'ARG', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 7, goalsAgainst: 2, points: 9 },
      { position: 2, teamId: 38, teamName: 'Algeria',     teamAbbr: 'ALG', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 4, points: 4 },
      { position: 3, teamId: 39, teamName: 'Austria',     teamAbbr: 'AUT', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 4, points: 3 },
      { position: 4, teamId: 40, teamName: 'Jordan',      teamAbbr: 'JOR', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 1, goalsAgainst: 3, points: 1 },
    ],
  },
  {
    group: 'GROUP_L',
    table: [
      { position: 1, teamId: 29, teamName: 'Spain',       teamAbbr: 'ESP', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 6, goalsAgainst: 3, points: 6 },
      { position: 2, teamId: 45, teamName: 'England',     teamAbbr: 'ENG', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 3, goalsAgainst: 5, points: 3 },
      { position: 3, teamId: 46, teamName: 'Croatia',     teamAbbr: 'CRO', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 4, points: 3 },
      { position: 4, teamId: 47, teamName: 'Ghana',       teamAbbr: 'GHA', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 1, points: 3 },
    ],
  },
]

// ── GET /api/football/fixtures ─────────────────────────────────────────────────

footballRouter.get('/fixtures', async (_req: Request, res: Response) => {
  try {
    if (!config.footballApiKey) {
      return res.json({ source: 'mock', matches: MOCK_FIXTURES })
    }
    const raw     = await fetchMatches()
    const matches = raw.map(normalizeMatch)
    res.json({ source: 'football-data.org', matches })
  } catch {
    res.status(500).json({ error: 'Failed to fetch fixtures' })
  }
})

// ── GET /api/football/live ─────────────────────────────────────────────────────

footballRouter.get('/live', async (_req: Request, res: Response) => {
  try {
    if (!config.footballApiKey) {
      const live = MOCK_FIXTURES.filter(m => m.status === 'live' || m.status === 'halftime')
      return res.json({ source: 'mock', matches: live })
    }
    const raw     = await fetchLiveMatches()
    const matches = raw.map(normalizeMatch)
    res.json({ source: 'football-data.org', matches })
  } catch {
    res.status(500).json({ error: 'Failed to fetch live matches' })
  }
})

// ── GET /api/football/standings ────────────────────────────────────────────────

footballRouter.get('/standings', async (_req: Request, res: Response) => {
  try {
    if (!config.footballApiKey) {
      return res.json({ source: 'mock', groups: MOCK_STANDINGS })
    }
    const groups = await fetchStandings()
    res.json({ source: 'football-data.org', groups })
  } catch {
    res.status(500).json({ error: 'Failed to fetch standings' })
  }
})

// ── GET /api/football/matches/:id ──────────────────────────────────────────────

footballRouter.get('/matches/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid match id' })

    if (!config.footballApiKey) {
      const mock = MOCK_FIXTURES.find(m => m.matchId === id) ?? null
      if (!mock) return res.status(404).json({ error: 'Match not found' })
      return res.json({ source: 'mock', match: mock })
    }

    const raw   = await fetchMatches()
    const found = raw.find(m => m.id === id)
    if (!found) return res.status(404).json({ error: 'Match not found' })
    res.json({ source: 'football-data.org', match: normalizeMatch(found) })
  } catch {
    res.status(500).json({ error: 'Failed to fetch match' })
  }
})

// ── GET /api/football/status ───────────────────────────────────────────────────

footballRouter.get('/status', (_req: Request, res: Response) => {
  res.json(getProviderStatus())
})
