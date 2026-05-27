import fs from 'fs'
import { config } from './config'

interface StoredState {
  syncedMatches:   Record<string, number>
  settledMatches:  string[]
  varOpenMatches:  string[]
  eliminatedTeams: number[]
  lastSync:        number
}

export interface KeeperState {
  syncedMatches:   Record<string, number>  // externalId → internal matchId
  settledMatches:  Set<string>
  varOpenMatches:  Set<string>
  eliminatedTeams: Set<number>
  lastSync:        number
}

export const state: KeeperState = {
  syncedMatches:   {},
  settledMatches:  new Set(),
  varOpenMatches:  new Set(),
  eliminatedTeams: new Set(),
  lastSync:        0,
}

export function loadState(): void {
  try {
    if (fs.existsSync(config.stateFile)) {
      const raw = JSON.parse(fs.readFileSync(config.stateFile, 'utf8')) as StoredState
      state.syncedMatches   = raw.syncedMatches   ?? {}
      state.settledMatches  = new Set(raw.settledMatches  ?? [])
      state.varOpenMatches  = new Set(raw.varOpenMatches  ?? [])
      state.eliminatedTeams = new Set(raw.eliminatedTeams ?? [])
      state.lastSync        = raw.lastSync ?? 0
      console.log(`[state] Loaded — ${Object.keys(state.syncedMatches).length} matches, ${state.settledMatches.size} settled`)
    }
  } catch (e) {
    console.error('[state] Load failed, starting fresh:', e)
  }
}

function persist(): void {
  const stored: StoredState = {
    syncedMatches:   state.syncedMatches,
    settledMatches:  [...state.settledMatches],
    varOpenMatches:  [...state.varOpenMatches],
    eliminatedTeams: [...state.eliminatedTeams],
    lastSync:        state.lastSync,
  }
  fs.writeFileSync(config.stateFile, JSON.stringify(stored, null, 2))
}

export function markSynced(externalId: string, internalId: number): void {
  state.syncedMatches[externalId] = internalId
  persist()
}

export function markSettled(externalId: string): void {
  state.settledMatches.add(externalId)
  persist()
}

export function markVarOpen(externalId: string): void {
  state.varOpenMatches.add(externalId)
  persist()
}

export function markTeamEliminated(teamId: number): void {
  state.eliminatedTeams.add(teamId)
  persist()
}

export function updateLastSync(): void {
  state.lastSync = Date.now()
  persist()
}
