import React, { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ADDRESSES, WORLD_CUP_TEAMS } from '../utils/contracts'
import { MatchOracle_ABI } from '../abis'
import { useAllMatchIds, useMatch, useTeamCount } from '../hooks/useContracts'
import { API_BASE } from '../services/footballData'

const ADMIN_ADDRESS = '0xF869c7b8A19146A4bbD5466e83c3B785AE7EE148'

const TEAMS_BY_ID = Object.fromEntries(WORLD_CUP_TEAMS.map(t => [t.id, t]))

// Outcome IDs matching VARMarket.sol
const OUTCOMES_WINNER    = [{ label: 'Team A wins', value: 1 }, { label: 'Team B wins', value: 2 }, { label: 'Draw', value: 3 }]
const OUTCOMES_FIRST_GOAL = [{ label: 'Team A first', value: 1 }, { label: 'Team B first', value: 2 }, { label: 'No goal', value: 6 }]

export default function Admin() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState('register')

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <h1 className="text-2xl font-bold text-stadium-text">Admin — Oracle</h1>
        <p className="text-stadium-muted font-mono text-sm">Connect wallet to access admin panel</p>
        <ConnectButton />
      </div>
    )
  }

  if (address?.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <h1 className="text-2xl font-bold text-stadium-text">Admin — Oracle</h1>
        <p className="text-stadium-muted font-mono text-sm">This page is restricted to the protocol admin.</p>
      </div>
    )
  }

  const tabs = [
    { id: 'register', label: 'Register Teams' },
    { id: 'matches',  label: 'Manage Matches' },
    { id: 'results',  label: 'Post Results'   },
    { id: 'tourney',  label: 'Elim / Champion' },
    { id: 'sync',     label: 'Oracle Sync'    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="section-title">Admin — Oracle</h1>
          <p className="section-subtitle">Register teams, manage matches, post results, declare eliminations.</p>
        </div>
        <div className="text-xs font-mono text-stadium-muted">
          Oracle: <span className="text-stadium-text">{ADDRESSES.matchOracle.slice(0,10)}…</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="grid grid-cols-5 gap-px bg-stadium-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`p-3 text-xs font-bold uppercase tracking-widest transition-colors ${
              activeTab === t.id
                ? 'bg-stadium-green/10 text-stadium-green'
                : 'bg-stadium-card text-stadium-muted hover:text-stadium-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'register'  && <RegisterTeamsTab />}
      {activeTab === 'matches'   && <ManageMatchesTab />}
      {activeTab === 'results'   && <PostResultsTab />}
      {activeTab === 'tourney'   && <TournamentTab />}
      {activeTab === 'sync'      && <OracleSyncTab />}
    </div>
  )
}

// ─── Register Teams ────────────────────────────────────────────────────────────

function RegisterTeamsTab() {
  const [batchIds, setBatchIds] = useState('')

  const { writeContract, data: txHash, isPending: txSubmitting } = useWriteContract()
  const { isLoading: txConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const isLoading = txSubmitting || txConfirming

  const { data: registeredCount } = useTeamCount()

  function handleRegisterAll() {
    const ids = batchIds
      ? batchIds.split(',').map(s => parseInt(s.trim())).filter(n => n > 0 && n <= 48)
      : WORLD_CUP_TEAMS.map(t => t.id)

    if (ids.length === 0) return

    const team = TEAMS_BY_ID[ids[0]]
    if (!team) return
    writeContract({
      address: ADDRESSES.matchOracle,
      abi: MatchOracle_ABI,
      functionName: 'registerTeam',
      args: [team.id, team.name],
    })
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-4">Register Teams</div>
        <div className="text-xs text-stadium-muted font-mono mb-4">
          Registered on-chain: <span className="text-stadium-text font-bold">{registeredCount?.toString() || '0'}</span> / 48
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">
              Team IDs (comma-separated, or leave empty for one-by-one)
            </label>
            <input
              type="text"
              value={batchIds}
              onChange={e => setBatchIds(e.target.value)}
              placeholder="1, 2, 3, 4 … (leave empty to register ID 1 first)"
              className="input-field"
            />
            <div className="text-xs text-stadium-muted font-mono mt-1">
              Note: Each registerTeam is one transaction. Use SeedDemo.s.sol script for bulk registration.
            </div>
          </div>

          <button onClick={handleRegisterAll} disabled={isLoading} className="btn-primary">
            {isLoading ? 'Registering...' : 'Register Next Team'}
          </button>

          {isSuccess && (
            <div className="text-stadium-green text-xs font-mono">Team registered successfully</div>
          )}
        </div>
      </div>

      {/* Team List */}
      <div className="card">
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-4">All 48 Teams</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-stadium-border max-h-96 overflow-y-auto">
          {WORLD_CUP_TEAMS.map(team => (
            <div key={team.id} className="bg-stadium-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{team.flag}</span>
                <span className="text-xs font-mono text-stadium-text">{team.name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-stadium-muted">
                <span>ID {team.id}</span>
                <span className="text-stadium-border">·</span>
                <span>{team.group}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Manage Matches ────────────────────────────────────────────────────────────

function ManageMatchesTab() {
  const [matchId, setMatchId]       = useState('')
  const [teamAId, setTeamAId]       = useState('')
  const [teamBId, setTeamBId]       = useState('')
  const [kickoffTime, setKickoffTime] = useState('')

  const { writeContract, data: txHash, isPending: txSubmitting } = useWriteContract()
  const { isLoading: txConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const isLoading = txSubmitting || txConfirming

  const { data: matchIds } = useAllMatchIds()

  function handleCreate() {
    const kickoff = Math.floor(new Date(kickoffTime).getTime() / 1000)
    writeContract({
      address: ADDRESSES.matchOracle,
      abi: MatchOracle_ABI,
      functionName: 'createMatch',
      args: [BigInt(matchId), parseInt(teamAId), parseInt(teamBId), BigInt(kickoff)],
    })
  }

  function handleOpenVAR(id) {
    writeContract({
      address: ADDRESSES.matchOracle,
      abi: MatchOracle_ABI,
      functionName: 'openVARWindow',
      args: [BigInt(id)],
    })
  }

  function handleStart(id) {
    writeContract({
      address: ADDRESSES.matchOracle,
      abi: MatchOracle_ABI,
      functionName: 'startMatch',
      args: [BigInt(id)],
    })
  }

  return (
    <div className="space-y-6">
      {/* Create Match */}
      <div className="card">
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-4">Create Match</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Match ID</label>
            <input type="number" value={matchId} onChange={e => setMatchId(e.target.value)} placeholder="1001" className="input-field" />
          </div>
          <div>
            <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Team A ID</label>
            <input type="number" value={teamAId} onChange={e => setTeamAId(e.target.value)} placeholder="1 (Mexico)" className="input-field" />
          </div>
          <div>
            <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Team B ID</label>
            <input type="number" value={teamBId} onChange={e => setTeamBId(e.target.value)} placeholder="2 (South Africa)" className="input-field" />
          </div>
          <div>
            <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Kickoff Time</label>
            <input type="datetime-local" value={kickoffTime} onChange={e => setKickoffTime(e.target.value)} className="input-field" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleCreate} disabled={isLoading || !matchId || !teamAId || !teamBId || !kickoffTime} className="btn-primary">
            {isLoading ? 'Creating...' : 'Create Match'}
          </button>
          {isSuccess && <span className="text-stadium-green text-xs font-mono">Match created</span>}
        </div>
        {teamAId && TEAMS_BY_ID[parseInt(teamAId)] && (
          <div className="text-xs text-stadium-muted font-mono mt-2">
            Team A: {TEAMS_BY_ID[parseInt(teamAId)].flag} {TEAMS_BY_ID[parseInt(teamAId)].name}
            {teamBId && TEAMS_BY_ID[parseInt(teamBId)] && ` vs ${TEAMS_BY_ID[parseInt(teamBId)].flag} ${TEAMS_BY_ID[parseInt(teamBId)].name}`}
          </div>
        )}
      </div>

      {/* Match List */}
      {matchIds && matchIds.length > 0 && (
        <div className="card">
          <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-4">Existing Matches</div>
          <div className="space-y-2">
            {matchIds.map(id => (
              <MatchAdminRow
                key={id.toString()}
                matchId={id}
                onOpenVAR={handleOpenVAR}
                onStart={handleStart}
                txPending={isLoading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MatchAdminRow({ matchId, onOpenVAR, onStart, txPending }) {
  const { data: match } = useMatch(matchId)
  if (!match) return null

  const statusLabel = match.settled ? 'SETTLED'
    : match.varClosed ? 'IN PROGRESS'
    : match.varOpen   ? 'VAR OPEN'
    : 'UPCOMING'

  return (
    <div className="flex items-center justify-between p-3 bg-stadium-dark border border-stadium-border text-xs font-mono">
      <div>
        <span className="font-bold text-stadium-text">#{matchId.toString()}</span>
        <span className="text-stadium-muted ml-2">{match.teamAName} vs {match.teamBName}</span>
        <span className={`ml-3 ${match.varOpen ? 'text-stadium-green' : 'text-stadium-muted'}`}>{statusLabel}</span>
      </div>
      <div className="flex gap-2">
        {!match.varOpen && !match.varClosed && !match.settled && (
          <button
            onClick={() => onOpenVAR(matchId)}
            disabled={txPending}
            className="btn-secondary text-xs py-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {txPending ? '⏳' : 'Open VAR'}
          </button>
        )}
        {match.varOpen && (
          <button
            onClick={() => onStart(matchId)}
            disabled={txPending}
            className="btn-secondary text-xs py-1 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {txPending ? '⏳' : 'Start Match'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Post Results ─────────────────────────────────────────────────────────────

function PostResultsTab() {
  const [matchId, setMatchId]       = useState('')
  const [winner, setWinner]         = useState('')
  const [firstGoal, setFirstGoal]   = useState('')
  const [redCard, setRedCard]       = useState(false)
  const [extraTime, setExtraTime]   = useState(false)

  const { writeContract, data: txHash, isPending: txSubmitting } = useWriteContract()
  const { isLoading: txConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const isLoading = txSubmitting || txConfirming

  const { data: matchIds } = useAllMatchIds()

  const selectedMatch = matchIds?.find(id => id.toString() === matchId)
  const { data: matchData } = useMatch(selectedMatch)

  function handlePost() {
    writeContract({
      address: ADDRESSES.matchOracle,
      abi: MatchOracle_ABI,
      functionName: 'postResult',
      args: [BigInt(matchId), parseInt(winner), parseInt(firstGoal), redCard, extraTime],
    })
  }

  return (
    <div className="card space-y-5">
      <div className="text-xs font-bold text-stadium-text uppercase tracking-widest">Post Match Result</div>

      <div>
        <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Match ID</label>
        <select value={matchId} onChange={e => setMatchId(e.target.value)} className="input-field">
          <option value="">Select match…</option>
          {matchIds?.map(id => (
            <option key={id.toString()} value={id.toString()}>#{id.toString()}</option>
          ))}
        </select>
        {matchData && (
          <div className="text-xs text-stadium-muted font-mono mt-1">
            {matchData.teamAName} vs {matchData.teamBName}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Winner</label>
        <div className="grid grid-cols-3 gap-px bg-stadium-border">
          {OUTCOMES_WINNER.map(o => (
            <button
              key={o.value}
              onClick={() => setWinner(o.value.toString())}
              className={`p-3 text-xs font-bold transition-colors ${
                winner === o.value.toString()
                  ? 'bg-stadium-green/10 text-stadium-green'
                  : 'bg-stadium-card text-stadium-muted hover:text-stadium-text'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">First Goal</label>
        <div className="grid grid-cols-3 gap-px bg-stadium-border">
          {OUTCOMES_FIRST_GOAL.map(o => (
            <button
              key={o.value}
              onClick={() => setFirstGoal(o.value.toString())}
              className={`p-3 text-xs font-bold transition-colors ${
                firstGoal === o.value.toString()
                  ? 'bg-stadium-green/10 text-stadium-green'
                  : 'bg-stadium-card text-stadium-muted hover:text-stadium-text'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={redCard} onChange={e => setRedCard(e.target.checked)} className="w-4 h-4 accent-stadium-green" />
          <span className="text-xs font-bold text-stadium-muted uppercase tracking-widest">Red Card Shown</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={extraTime} onChange={e => setExtraTime(e.target.checked)} className="w-4 h-4 accent-stadium-green" />
          <span className="text-xs font-bold text-stadium-muted uppercase tracking-widest">Extra Time</span>
        </label>
      </div>

      <button
        onClick={handlePost}
        disabled={isLoading || !matchId || !winner || !firstGoal}
        className="btn-primary w-full"
      >
        {isLoading ? 'Posting...' : 'Post Result & Settle VAR Markets'}
      </button>

      {isSuccess && (
        <div className="text-stadium-green text-xs font-mono text-center">Result posted and all 4 VAR markets settled</div>
      )}
    </div>
  )
}

// ─── Tournament Management ────────────────────────────────────────────────────

function TournamentTab() {
  const [elimTeamId, setElimTeamId]     = useState('')
  const [champTeamId, setChampTeamId]   = useState('')

  const { writeContract, data: elimTxHash, isPending: elimSubmitting } = useWriteContract()
  const { isLoading: elimConfirming, isSuccess: elimSuccess } = useWaitForTransactionReceipt({ hash: elimTxHash })
  const elimLoading = elimSubmitting || elimConfirming

  const { writeContract: writeChamp, data: champTxHash, isPending: champSubmitting } = useWriteContract()
  const { isLoading: champConfirming, isSuccess: champSuccess } = useWaitForTransactionReceipt({ hash: champTxHash })
  const champLoading = champSubmitting || champConfirming

  function handleElimination() {
    writeContract({
      address: ADDRESSES.matchOracle,
      abi: MatchOracle_ABI,
      functionName: 'postElimination',
      args: [parseInt(elimTeamId)],
    })
  }

  function handleChampion() {
    writeChamp({
      address: ADDRESSES.matchOracle,
      abi: MatchOracle_ABI,
      functionName: 'postChampion',
      args: [parseInt(champTeamId)],
    })
  }

  const elimTeam = TEAMS_BY_ID[parseInt(elimTeamId)]
  const champTeam = TEAMS_BY_ID[parseInt(champTeamId)]

  return (
    <div className="space-y-6">
      {/* Elimination */}
      <div className="card space-y-4">
        <div className="text-xs font-bold text-red-400 uppercase tracking-widest">Post Team Elimination</div>
        <div className="text-xs text-stadium-muted font-mono">
          Triggers CONVICTION vault to forfeit 50% and distribute survivor yield. Irreversible.
        </div>
        <div>
          <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Team ID</label>
          <div className="flex gap-3">
            <input
              type="number"
              value={elimTeamId}
              onChange={e => setElimTeamId(e.target.value)}
              placeholder="Team ID (1–48)"
              className="input-field flex-1"
              min="1"
              max="48"
            />
            {elimTeam && (
              <div className="flex items-center gap-2 text-sm font-mono text-stadium-muted">
                <span>{elimTeam.flag}</span>
                <span>{elimTeam.name}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleElimination}
          disabled={elimLoading || !elimTeamId}
          className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
        >
          {elimLoading ? 'Processing...' : `Eliminate ${elimTeam?.name || 'Team'}`}
        </button>
        {elimSuccess && (
          <div className="text-stadium-green text-xs font-mono">Elimination posted. Survivor yield distributed.</div>
        )}
      </div>

      {/* Champion */}
      <div className="card space-y-4">
        <div className="text-xs font-bold text-stadium-gold uppercase tracking-widest">Declare World Cup Champion</div>
        <div className="text-xs text-stadium-muted font-mono">
          Snapshots champion pool, then enables principal claims. Order is critical and enforced by oracle.
        </div>
        <div>
          <label className="text-xs font-bold text-stadium-muted uppercase tracking-widest mb-2 block">Team ID</label>
          <div className="flex gap-3">
            <input
              type="number"
              value={champTeamId}
              onChange={e => setChampTeamId(e.target.value)}
              placeholder="Team ID (1–48)"
              className="input-field flex-1"
              min="1"
              max="48"
            />
            {champTeam && (
              <div className="flex items-center gap-2 text-sm font-mono text-stadium-muted">
                <span>{champTeam.flag}</span>
                <span>{champTeam.name}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleChampion}
          disabled={champLoading || !champTeamId}
          className="bg-stadium-gold/10 border border-stadium-gold/30 text-stadium-gold hover:bg-stadium-gold/20 px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
        >
          {champLoading ? 'Processing...' : `Declare ${champTeam?.name || 'Team'} Champion`}
        </button>
        {champSuccess && (
          <div className="text-stadium-green text-xs font-mono">Champion declared. Pool snapshot taken. Principal claims enabled.</div>
        )}
      </div>
    </div>
  )
}

// ─── Oracle Sync ───────────────────────────────────────────────────────────────

function OracleSyncTab() {
  const [syncing, setSyncing] = useState(false)
  const [result,  setResult]  = useState(null)

  async function triggerSync() {
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/sync`, { method: 'POST' })
      setResult(res.ok ? 'Sync triggered successfully.' : `Error: ${res.status}`)
    } catch (e) {
      setResult(`Failed to reach backend: ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="card space-y-6">
      <div className="text-xs font-bold text-stadium-text uppercase tracking-widest">Oracle Sync</div>
      <p className="text-stadium-muted text-sm font-mono">
        Manually trigger the sports-data relayer to fetch the latest fixtures and push results to MatchOracle.
      </p>
      <button
        onClick={triggerSync}
        disabled={syncing}
        className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest border border-stadium-green text-stadium-green hover:bg-stadium-green/10 transition-colors disabled:opacity-40"
      >
        {syncing ? 'Syncing…' : 'Trigger Oracle Sync'}
      </button>
      {result && (
        <div className={`text-xs font-mono ${result.startsWith('Error') || result.startsWith('Failed') ? 'text-red-400' : 'text-stadium-green'}`}>
          {result}
        </div>
      )}
    </div>
  )
}
