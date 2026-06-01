// Maps football-data.org team names → internal team IDs (1-48)
// Multiple aliases per team handle API naming variations
export const TEAM_ID_BY_NAME: Record<string, number> = {
  // Group A
  'Mexico': 1,
  'South Africa': 2,
  'Korea Republic': 3, 'South Korea': 3, 'Republic of Korea': 3,
  'Czechia': 4, 'Czech Republic': 4,
  // Group B
  'Canada': 5,
  'Bosnia and Herzegovina': 6, 'Bosnia & Herz.': 6, 'Bosnia': 6, 'Bosnia-Herzegovina': 6,
  'Qatar': 7,
  'Switzerland': 8,
  // Group C
  'Brazil': 9,
  'Morocco': 10,
  'Haiti': 11,
  'Scotland': 12,
  // Group D
  'United States': 13, 'USA': 13,
  'Paraguay': 14,
  'Australia': 15,
  'Türkiye': 16, 'Turkey': 16,
  // Group E
  'Germany': 17,
  'Curaçao': 18, 'Curacao': 18,
  "Côte d'Ivoire": 19, 'Ivory Coast': 19,
  'Ecuador': 20,
  // Group F
  'Netherlands': 21,
  'Japan': 22,
  'Sweden': 23,
  'Tunisia': 24,
  // Group G
  'Belgium': 25,
  'Egypt': 26,
  'Iran': 27, 'IR Iran': 27, 'Islamic Republic of Iran': 27,
  'New Zealand': 28,
  // Group H
  'Spain': 29,
  'Cape Verde': 30, 'Cabo Verde': 30, 'Cape Verde Islands': 30,
  'Saudi Arabia': 31,
  'Uruguay': 32,
  // Group I
  'France': 33,
  'Senegal': 34,
  'Iraq': 35,
  'Norway': 36,
  // Group J
  'Argentina': 37,
  'Algeria': 38,
  'Austria': 39,
  'Jordan': 40,
  // Group K
  'Portugal': 41,
  'Congo DR': 42, 'DR Congo': 42, 'Democratic Republic of Congo': 42,
  'Uzbekistan': 43,
  'Colombia': 44,
  // Group L
  'England': 45,
  'Croatia': 46,
  'Ghana': 47,
  'Panama': 48,
}

// Maps football-data.org stage strings → uint8 stage values used in MatchOracle
export const STAGE_MAP: Record<string, number> = {
  'GROUP_STAGE':    0,
  'ROUND_OF_32':    1,
  'LAST_16':        2,
  'ROUND_OF_16':    2,
  'QUARTER_FINALS': 3,
  'QUARTER_FINAL':  3,
  'SEMI_FINALS':    4,
  'SEMI_FINAL':     4,
  'THIRD_PLACE':    4,
  'FINAL':          5,
}

export function resolveTeamId(name: string): number | undefined {
  return TEAM_ID_BY_NAME[name]
}

export function resolveStage(stage: string): number {
  return STAGE_MAP[stage] ?? 0
}
