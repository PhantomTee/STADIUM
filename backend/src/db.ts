import { Pool } from 'pg'

let pool: Pool | null = null

export function initDb(databaseUrl: string) {
  pool = new Pool({ connectionString: databaseUrl, max: 5 })
  pool.on('error', err => console.error('pg pool error', err))
}

export function dbAvailable(): boolean {
  return pool !== null
}

// ── Schema setup ──────────────────────────────────────────────────────────────

export async function setupSchema() {
  if (!pool) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id              BIGSERIAL PRIMARY KEY,
      event_type      TEXT    NOT NULL,
      block_number    BIGINT  NOT NULL,
      block_timestamp BIGINT,
      tx_hash         TEXT    NOT NULL,
      log_index       INT     NOT NULL,
      user_addr       TEXT,
      team_id         INT,
      amount          TEXT,
      amount0         TEXT,
      amount1         TEXT,
      match_id        TEXT,
      UNIQUE(tx_hash, log_index)
    );
    ALTER TABLE events ADD COLUMN IF NOT EXISTS block_timestamp BIGINT;
    CREATE INDEX IF NOT EXISTS idx_events_block ON events(block_number DESC);
    CREATE INDEX IF NOT EXISTS idx_events_type  ON events(event_type);

    CREATE TABLE IF NOT EXISTS indexer_cursors (
      key          TEXT   PRIMARY KEY,
      block_number BIGINT NOT NULL
    );
  `)
  console.log('[db] schema ready')
}

// ── Cursor helpers ────────────────────────────────────────────────────────────

export async function getCursor(key: string): Promise<bigint> {
  if (!pool) return 0n
  const r = await pool.query('SELECT block_number FROM indexer_cursors WHERE key=$1', [key])
  return r.rows[0] ? BigInt(r.rows[0].block_number) : 0n
}

export async function setCursor(key: string, block: bigint) {
  if (!pool) return
  await pool.query(
    `INSERT INTO indexer_cursors(key, block_number) VALUES($1,$2)
     ON CONFLICT(key) DO UPDATE SET block_number=$2`,
    [key, block.toString()]
  )
}

export async function resetCursor(key: string) {
  if (!pool) return
  await pool.query('DELETE FROM indexer_cursors WHERE key=$1', [key])
}

export async function deleteEventsByType(type: string) {
  if (!pool) return
  await pool.query('DELETE FROM events WHERE event_type=$1', [type])
}

// ── Event insert (bulk, idempotent) ───────────────────────────────────────────

export interface EventRow {
  eventType:      string
  blockNumber:    bigint
  blockTimestamp: number | null
  txHash:         string
  logIndex:       number
  userAddr:       string | null
  teamId:         number | null
  amount:         string | null
  amount0:        string | null
  amount1:        string | null
  matchId:        string | null
}

export async function insertEvents(rows: EventRow[]): Promise<void> {
  if (!pool || rows.length === 0) return
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const r of rows) {
      await client.query(
        `INSERT INTO events
           (event_type,block_number,block_timestamp,tx_hash,log_index,user_addr,team_id,amount,amount0,amount1,match_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT(tx_hash,log_index) DO UPDATE SET
           block_timestamp = COALESCE(EXCLUDED.block_timestamp, events.block_timestamp),
           user_addr       = COALESCE(EXCLUDED.user_addr,       events.user_addr),
           team_id         = COALESCE(EXCLUDED.team_id,         events.team_id),
           amount          = COALESCE(EXCLUDED.amount,          events.amount),
           amount0         = COALESCE(EXCLUDED.amount0,         events.amount0),
           amount1         = COALESCE(EXCLUDED.amount1,         events.amount1)`,
        [r.eventType, r.blockNumber.toString(), r.blockTimestamp, r.txHash, r.logIndex,
         r.userAddr, r.teamId, r.amount, r.amount0, r.amount1, r.matchId]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── Query ─────────────────────────────────────────────────────────────────────

export interface EventQuery {
  type?:   string   // 'conviction' | 'bet' | 'swap' | 'all' (default)
  limit?:  number   // default 100, max 200
  offset?: number
}

export async function queryEvents(q: EventQuery = {}): Promise<{ events: any[]; total: number }> {
  if (!pool) return { events: [], total: 0 }

  const type   = q.type && q.type !== 'all' ? q.type : null
  const limit  = Math.min(q.limit  ?? 100, 200)
  const offset = q.offset ?? 0

  const where  = type ? 'WHERE event_type=$1' : ''
  const params = type ? [type, limit, offset] : [limit, offset]
  const pLimit = type ? '$2' : '$1'
  const pOff   = type ? '$3' : '$2'

  const [data, count] = await Promise.all([
    pool.query(
      `SELECT * FROM events ${where} ORDER BY block_number DESC LIMIT ${pLimit} OFFSET ${pOff}`,
      params
    ),
    pool.query(
      `SELECT COUNT(*) FROM events ${where}`,
      type ? [type] : []
    ),
  ])

  return {
    events: data.rows,
    total:  parseInt(count.rows[0].count, 10),
  }
}
