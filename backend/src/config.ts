import 'dotenv/config'

function required(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env var: ${key}`)
  return v
}

export const config = {
  port:                   parseInt(process.env.PORT ?? '3001'),
  rpcUrl:                 required('RPC_URL'),
  privateKey:             required('PRIVATE_KEY') as `0x${string}`,
  matchOracleAddress:     required('MATCH_ORACLE_ADDRESS') as `0x${string}`,
  convictionVaultAddress: required('CONVICTION_VAULT_ADDRESS') as `0x${string}`,
  varMarketAddress:       (process.env.VAR_MARKET_ADDRESS    ?? '') as `0x${string}`,
  stadiumHookAddress:     (process.env.STADIUM_HOOK_ADDRESS  ?? '') as `0x${string}`,
  footballApiKey:         process.env.FOOTBALL_API_KEY ?? '',
  footballApiBase:        process.env.FOOTBALL_API_BASE ?? 'https://api.football-data.org/v4',
  wcCompetition:          process.env.WC_COMPETITION ?? 'WC',
  wcSeason:               process.env.WC_SEASON ?? '2026',
  stateFile:              process.env.STATE_FILE ?? './keeper-state.json',
  databaseUrl:            process.env.DATABASE_URL ?? '',
  // Set this to the block your contracts were deployed at so the indexer
  // doesn't scan from block 0 through millions of empty blocks.
  indexerStartBlock:      BigInt(process.env.INDEXER_START_BLOCK ?? '0'),
}
