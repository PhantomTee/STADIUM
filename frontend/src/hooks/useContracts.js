import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { ADDRESSES, parseUSDC, formatUSDC } from '../utils/contracts'
import {
  MockUSDC_ABI,
  ConvictionVault_ABI,
  VARMarket_ABI,
  MatchOracle_ABI,
  ChampionPool_ABI,
  StadiumHook_ABI,
  TeamFactory_ABI,
} from '../abis'

// ─── USDC ────────────────────────────────────────────────────────────────────

export function useUSDCBalance(address) {
  return useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MockUSDC_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: !!address },
  })
}

export function useUSDCAllowance(owner, spender) {
  return useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MockUSDC_ABI,
    functionName: 'allowance',
    args: [owner, spender],
    query: { enabled: !!owner && !!spender },
  })
}

// ─── CONVICTION VAULT ────────────────────────────────────────────────────────

export function useConvictionDeposit(user, teamId) {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'deposits',
    args: [user, teamId],
    query: { enabled: !!user && teamId !== undefined },
  })
}

export function usePendingYield(user) {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'pendingYield',
    args: [user],
    query: { enabled: !!user },
  })
}

export function useTeamTotalDeposit(teamId) {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'teamTotalDeposit',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

export function useBackerCount(teamId) {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'backerCount',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

export function useTotalAliveDeposits() {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'totalAliveDeposits',
  })
}

export function useTeamActive(teamId) {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'teamActive',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

export function useTeamEliminated(teamId) {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'teamEliminated',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

export function useTeamChampion(teamId) {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'teamChampion',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

export function usePrincipalClaimed(user, teamId) {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'principalClaimed',
    args: [user, teamId],
    query: { enabled: !!user && teamId !== undefined },
  })
}

export function useConvictionMultiplier(user, teamId) {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'getConvictionMultiplier',
    args: [user, teamId],
    query: { enabled: !!user && teamId !== undefined },
  })
}

export function useConvictionCloseTime() {
  return useReadContract({
    address: ADDRESSES.convictionVault,
    abi: ConvictionVault_ABI,
    functionName: 'convictionCloseTime',
  })
}

// ─── VAR MARKET ──────────────────────────────────────────────────────────────

export function useVARMarket(matchId, marketType) {
  return useReadContract({
    address: ADDRESSES.varMarket,
    abi: VARMarket_ABI,
    functionName: 'markets',
    args: [matchId, marketType],
    query: { enabled: matchId !== undefined && marketType !== undefined },
  })
}

export function useOutcomePool(matchId, marketType, outcome) {
  return useReadContract({
    address: ADDRESSES.varMarket,
    abi: VARMarket_ABI,
    functionName: 'outcomePool',
    args: [matchId, marketType, outcome],
    query: { enabled: matchId !== undefined && marketType !== undefined && outcome !== undefined },
  })
}

export function useUserBet(matchId, marketType, user, outcome) {
  return useReadContract({
    address: ADDRESSES.varMarket,
    abi: VARMarket_ABI,
    functionName: 'betAmount',
    args: [matchId, marketType, user, outcome],
    query: { enabled: matchId !== undefined && marketType !== undefined && !!user && outcome !== undefined },
  })
}

export function useVARClaimed(matchId, marketType, user) {
  return useReadContract({
    address: ADDRESSES.varMarket,
    abi: VARMarket_ABI,
    functionName: 'claimed',
    args: [matchId, marketType, user],
    query: { enabled: matchId !== undefined && marketType !== undefined && !!user },
  })
}

// ─── ORACLE / MATCHES ────────────────────────────────────────────────────────

export function useMatchCount() {
  return useReadContract({
    address: ADDRESSES.matchOracle,
    abi: MatchOracle_ABI,
    functionName: 'getMatchCount',
  })
}

export function useMatch(matchId) {
  return useReadContract({
    address: ADDRESSES.matchOracle,
    abi: MatchOracle_ABI,
    functionName: 'getMatch',
    args: [matchId],
    query: { enabled: matchId !== undefined },
  })
}

export function useAllMatchIds() {
  return useReadContract({
    address: ADDRESSES.matchOracle,
    abi: MatchOracle_ABI,
    functionName: 'getAllMatchIds',
  })
}

export function useOracleTeam(teamId) {
  return useReadContract({
    address: ADDRESSES.matchOracle,
    abi: MatchOracle_ABI,
    functionName: 'getTeam',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

export function useTeamCount() {
  return useReadContract({
    address: ADDRESSES.matchOracle,
    abi: MatchOracle_ABI,
    functionName: 'teamCount',
  })
}

// ─── CHAMPION POOL ────────────────────────────────────────────────────────────

export function useChampionPoolData() {
  const { data: totalAccumulated } = useReadContract({
    address: ADDRESSES.championPool,
    abi: ChampionPool_ABI,
    functionName: 'totalAccumulated',
  })
  const { data: snapshot } = useReadContract({
    address: ADDRESSES.championPool,
    abi: ChampionPool_ABI,
    functionName: 'championPoolSnapshot',
  })
  const { data: championSet } = useReadContract({
    address: ADDRESSES.championPool,
    abi: ChampionPool_ABI,
    functionName: 'championSet',
  })
  const { data: championTeamId } = useReadContract({
    address: ADDRESSES.championPool,
    abi: ChampionPool_ABI,
    functionName: 'championTeamId',
  })
  const { data: totalStake } = useReadContract({
    address: ADDRESSES.championPool,
    abi: ChampionPool_ABI,
    functionName: 'totalChampionStake',
  })
  return { totalAccumulated, snapshot, championSet, championTeamId, totalStake }
}

export function useChampClaimed(user, teamId) {
  return useReadContract({
    address: ADDRESSES.championPool,
    abi: ChampionPool_ABI,
    functionName: 'champClaimed',
    args: [user, teamId],
    query: { enabled: !!user && teamId !== undefined },
  })
}

// ─── STADIUM HOOK ────────────────────────────────────────────────────────────

export function useHookPaused() {
  return useReadContract({
    address: ADDRESSES.stadiumHook,
    abi: StadiumHook_ABI,
    functionName: 'paused',
  })
}

export function useTeamMomentum(teamId) {
  return useReadContract({
    address: ADDRESSES.stadiumHook,
    abi: StadiumHook_ABI,
    functionName: 'teamMomentum',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

export function useHookPoolState(poolId) {
  return useReadContract({
    address: ADDRESSES.stadiumHook,
    abi: StadiumHook_ABI,
    functionName: 'poolState',
    args: [poolId],
    query: { enabled: !!poolId },
  })
}

export function useHookTeamPoolId(teamId) {
  return useReadContract({
    address: ADDRESSES.stadiumHook,
    abi: StadiumHook_ABI,
    functionName: 'teamPoolId',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

export function useHookFeeConfig() {
  return useReadContract({
    address: ADDRESSES.stadiumHook,
    abi: StadiumHook_ABI,
    functionName: 'feeConfig',
  })
}

// ─── TEAM FACTORY ────────────────────────────────────────────────────────────

export function useFactoryTeamToken(teamId) {
  return useReadContract({
    address: ADDRESSES.teamFactory,
    abi: TeamFactory_ABI,
    functionName: 'teamToken',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

export function useFactoryTeamPoolId(teamId) {
  return useReadContract({
    address: ADDRESSES.teamFactory,
    abi: TeamFactory_ABI,
    functionName: 'teamPoolId',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

export function useFactoryTeamInfo(teamId) {
  return useReadContract({
    address: ADDRESSES.teamFactory,
    abi: TeamFactory_ABI,
    functionName: 'getTeamInfo',
    args: [teamId],
    query: { enabled: teamId !== undefined },
  })
}

// ─── Legacy aliases (used by Home.jsx) ───────────────────────────────────────

export const useTotalAliveConvictionLocked = useTotalAliveDeposits

export function useChampionPoolBalance() {
  return useReadContract({
    address: ADDRESSES.championPool,
    abi: ChampionPool_ABI,
    functionName: 'totalAccumulated',
  })
}
