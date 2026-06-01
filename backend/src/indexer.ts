import { decodeEventLog, decodeAbiParameters, keccak256, toHex } from 'viem'
import { publicClient } from './chain'
import { config } from './config'
import { getCursor, setCursor, insertEvents, EventRow, dbAvailable } from './db'
import {
  CONVICTION_DEPOSITED_EVENT,
  BET_PLACED_EVENT,
  TEAM_SWAP_EVENT,
} from './abis'

const CHUNK     = 99n    // X Layer testnet caps eth_getLogs at 100 blocks
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

interface ContractTarget {
  key:     string
  address: `0x${string}` | undefined
  event:   typeof CONVICTION_DEPOSITED_EVENT | typeof BET_PLACED_EVENT | typeof TEAM_SWAP_EVENT
  type:    'conviction' | 'bet' | 'swap'
  topic0:  `0x${string}`
}

// X Layer's RPC rejects topics arrays that contain null values (which viem inserts
// when you pass `event` with no args filter). Compute topic0 manually and send
// topics: [topic0] — clean, no nulls. Decode args from raw logs afterwards.
function computeTopic0(event: { name: string; inputs: readonly { type: string }[] }): `0x${string}` {
  const sig = `${event.name}(${event.inputs.map(i => i.type).join(',')})`
  return keccak256(toHex(sig))
}

const TARGETS: ContractTarget[] = [
  { key: 'conviction', address: config.convictionVaultAddress, event: CONVICTION_DEPOSITED_EVENT, type: 'conviction', topic0: computeTopic0(CONVICTION_DEPOSITED_EVENT) },
  { key: 'bet',        address: config.varMarketAddress,       event: BET_PLACED_EVENT,           type: 'bet',        topic0: computeTopic0(BET_PLACED_EVENT)           },
  { key: 'swap',       address: config.stadiumHookAddress,     event: TEAM_SWAP_EVENT,            type: 'swap',       topic0: computeTopic0(TEAM_SWAP_EVENT)            },
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

  const startBlock = config.indexerStartBlock
  if (startBlock > 0n && from < startBlock) {
    from = startBlock
    console.log(`[indexer] ${t.type}: jumping to INDEXER_START_BLOCK ${startBlock}`)
  }

  while (from < current) {
    const to = from + CHUNK <= current ? from + CHUNK : current

    try {
      // Use raw topics filter (no nulls) — X Layer RPC rejects null topic entries
      const rawLogs = await (publicClient.getLogs as any)({
        address:   t.address,
        topics:    [t.topic0],
        fromBlock: from + 1n,
        toBlock:   to,
      })

      // Decode event args from raw logs
      const logs = (rawLogs as any[]).map((raw: any) => {
        if (t.type === 'swap') return { ...raw, args: decodeSwapArgs(raw) }
        try {
          const decoded: any = decodeEventLog({
            abi:    [t.event] as any,
            data:   raw.data,
            topics: raw.topics as any,
          })
          return { ...raw, args: decoded.args ?? {} }
        } catch {
          return { ...raw, args: {} }
        }
      })

      const rows: EventRow[] = (logs as any[]).map((log: any) => parseLog(t.type, log))
      await insertEvents(rows)
      await setCursor(t.key, to)

      if (logs.length > 0) {
        console.log(`[indexer] ${t.type}: stored ${logs.length} events (blocks ${from+1n}–${to})`)
      }
    } catch (err: any) {
      console.error(`[indexer] ${t.type} getLogs FAILED ${from+1n}–${to}: ${err?.shortMessage ?? err?.message ?? String(err)}`)
      break
    }

    from = to
  }
}

// TeamSwap decoder — handles both indexed and non-indexed teamId layouts:
//   3 topics → teamId in topics[2]; data = abi(amount0:int256, amount1:int256)
//   2 topics → teamId non-indexed;  data = abi(teamId:uint16, amount0:int256, amount1:int256)
function decodeSwapArgs(raw: any): Record<string, any> {
  const topics = (raw.topics ?? []) as string[]
  const user   = topics[1] ? ('0x' + topics[1].slice(-40)).toLowerCase() : null
  let teamId: number | null = null
  let amount0: bigint | null = null
  let amount1: bigint | null = null

  try {
    if (topics.length >= 3) {
      teamId = Number(BigInt(topics[2]))
      const p = decodeAbiParameters(
        [{ name: 'amount0', type: 'int256' }, { name: 'amount1', type: 'int256' }] as const,
        raw.data as `0x${string}`,
      )
      amount0 = p[0] as bigint
      amount1 = p[1] as bigint
    } else if (raw.data && raw.data !== '0x') {
      const p = decodeAbiParameters(
        [{ name: 'teamId', type: 'uint16' }, { name: 'amount0', type: 'int256' }, { name: 'amount1', type: 'int256' }] as const,
        raw.data as `0x${string}`,
      )
      teamId = Number(p[0])
      amount0 = p[1] as bigint
      amount1 = p[2] as bigint
    }
  } catch {}

  return { user, teamId, amount0, amount1 }
}

function parseLog(type: string, log: any): EventRow {
  const a = log.args ?? {}
  return {
    eventType:   type,
    blockNumber: log.blockNumber      ?? 0n,
    txHash:      log.transactionHash  ?? '',
    logIndex:    log.logIndex         ?? 0,
    userAddr:    a.user     ? String(a.user).toLowerCase()  : null,
    teamId:      a.teamId   != null ? Number(a.teamId)      : null,
    amount:      a.amount   != null ? String(a.amount)      : null,
    amount0:     a.amount0  != null ? String(a.amount0)     : null,
    amount1:     a.amount1  != null ? String(a.amount1)     : null,
    matchId:     a.matchId  != null ? String(a.matchId)     : null,
  }
}
