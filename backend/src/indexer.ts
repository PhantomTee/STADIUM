import { publicClient } from './chain'
import { config } from './config'
import { getCursor, setCursor, insertEvents, EventRow, dbAvailable } from './db'
import {
  CONVICTION_DEPOSITED_EVENT,
  BET_PLACED_EVENT,
  TEAM_SWAP_EVENT,
} from './abis'

const CHUNK     = 1999n   // stay just under X Layer's 2000-block eth_getLogs limit
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

interface ContractTarget {
  key:     string
  address: `0x${string}` | undefined
  event:   typeof CONVICTION_DEPOSITED_EVENT | typeof BET_PLACED_EVENT | typeof TEAM_SWAP_EVENT
  type:    'conviction' | 'bet' | 'swap'
}

const TARGETS: ContractTarget[] = [
  { key: 'conviction', address: config.convictionVaultAddress, event: CONVICTION_DEPOSITED_EVENT, type: 'conviction' },
  { key: 'bet',        address: config.varMarketAddress,       event: BET_PLACED_EVENT,           type: 'bet'        },
  { key: 'swap',       address: config.stadiumHookAddress,     event: TEAM_SWAP_EVENT,            type: 'swap'       },
]

export async function runIndexer(): Promise<void> {
  if (!dbAvailable()) return

  let current: bigint
  try {
    current = await publicClient.getBlockNumber()
  } catch (err) {
    console.warn('[indexer] getBlockNumber failed:', err)
    return
  }

  await Promise.all(TARGETS.map(t => indexTarget(t, current)))
}

async function indexTarget(t: ContractTarget, current: bigint): Promise<void> {
  if (!t.address || t.address === ZERO_ADDR) return

  let from = await getCursor(t.key)

  // If INDEXER_START_BLOCK is configured and ahead of the stored cursor,
  // jump forward — avoids scanning millions of empty pre-deployment blocks.
  const startBlock = config.indexerStartBlock
  if (startBlock > 0n && from < startBlock) {
    from = startBlock
    console.log(`[indexer] ${t.type}: jumping to INDEXER_START_BLOCK ${startBlock}`)
  }

  while (from < current) {
    const to = from + CHUNK <= current ? from + CHUNK : current

    try {
      const logs = await publicClient.getLogs({
        address:   t.address,
        event:     t.event as any,
        fromBlock: from + 1n,
        toBlock:   to,
      })

      const rows: EventRow[] = logs.map(log => parseLog(t.type, log))
      await insertEvents(rows)
      await setCursor(t.key, to)

      if (logs.length > 0) {
        console.log(`[indexer] ${t.type}: stored ${logs.length} events (blocks ${from+1n}–${to})`)
      }
    } catch (err) {
      console.warn(`[indexer] ${t.type} failed for ${from+1n}–${to}:`, err)
      break   // retry next cycle
    }

    from = to
  }
}

function parseLog(type: string, log: any): EventRow {
  const a = log.args ?? {}
  return {
    eventType:   type,
    blockNumber: log.blockNumber   ?? 0n,
    txHash:      log.transactionHash ?? '',
    logIndex:    log.logIndex       ?? 0,
    userAddr:    a.user     ? String(a.user).toLowerCase()  : null,
    teamId:      a.teamId   != null ? Number(a.teamId)      : null,
    amount:      a.amount   != null ? String(a.amount)      : null,
    amount0:     a.amount0  != null ? String(a.amount0)     : null,
    amount1:     a.amount1  != null ? String(a.amount1)     : null,
    matchId:     a.matchId  != null ? String(a.matchId)     : null,
  }
}
