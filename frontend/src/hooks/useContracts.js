import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { ADDRESSES, parseUSDC, formatUSDC } from '../utils/contracts'
import {
  MockUSDC_ABI,
  ConvictionHook_ABI,
  VARMarket_ABI,
  MatchOracle_ABI,
  ChampionPool_ABI,
} from '../abis'

// ─── USDC Balance ────────────────────────────────────────────────────────────

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

// ─── CONVICTION ──────────────────────────────────────────────────────────────

export function useConvictionDeposit(user, team) {
  return useReadContract({
    address: ADDRESSES.convictionHook,
    abi: ConvictionHook_ABI,
    functionName: 'convictionDeposit',
    args: [user, team],
    query: { enabled: !!user && !!team },
  })
}

export function useAccruedYield(user) {
  return useReadContract({
    address: ADDRESSES.convictionHook,
    abi: ConvictionHook_ABI,
    functionName: 'accruedYield',
    args: [user],
    query: { enabled: !!user },
  })
}

export function useHasConviction(user, team) {
  return useReadContract({
    address: ADDRESSES.convictionHook,
    abi: ConvictionHook_ABI,
    functionName: 'hasConviction',
    args: [user, team],
    query: { enabled: !!user && !!team },
  })
}

export function useTotalConvictionLocked(team) {
  return useReadContract({
    address: ADDRESSES.convictionHook,
    abi: ConvictionHook_ABI,
    functionName: 'totalConvictionLocked',
    args: [team],
    query: { enabled: !!team },
  })
}

export function useAliveTeams() {
  return useReadContract({
    address: ADDRESSES.convictionHook,
    abi: ConvictionHook_ABI,
    functionName: 'getAliveTeams',
  })
}

export function useTeamEliminated(team) {
  return useReadContract({
    address: ADDRESSES.convictionHook,
    abi: ConvictionHook_ABI,
    functionName: 'teamEliminated',
    args: [team],
    query: { enabled: !!team },
  })
}

export function useConvictionMultiplier(user, team) {
  return useReadContract({
    address: ADDRESSES.convictionHook,
    abi: ConvictionHook_ABI,
    functionName: 'getConvictionMultiplier',
    args: [user, team],
    query: { enabled: !!user && !!team },
  })
}

export function useTotalAliveConvictionLocked() {
  return useReadContract({
    address: ADDRESSES.convictionHook,
    abi: ConvictionHook_ABI,
    functionName: 'totalAliveConvictionLocked',
  })
}

export function useBackerCount(team) {
  return useReadContract({
    address: ADDRESSES.convictionHook,
    abi: ConvictionHook_ABI,
    functionName: 'backerCount',
    args: [team],
    query: { enabled: !!team },
  })
}

// ─── VAR ─────────────────────────────────────────────────────────────────────

export function useVARMarket(matchId, marketType) {
  return useReadContract({
    address: ADDRESSES.varMarket,
    abi: VARMarket_ABI,
    functionName: 'getMarket',
    args: [matchId, marketType],
    query: { enabled: matchId !== undefined && marketType !== undefined },
  })
}

export function useUserBet(matchId, marketType, user) {
  return useReadContract({
    address: ADDRESSES.varMarket,
    abi: VARMarket_ABI,
    functionName: 'getUserBet',
    args: [matchId, marketType, user],
    query: { enabled: matchId !== undefined && marketType !== undefined && !!user },
  })
}

// ─── Oracle / Matches ────────────────────────────────────────────────────────

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

// ─── Champion Pool ────────────────────────────────────────────────────────────

export function useChampionPoolBalance() {
  return useReadContract({
    address: ADDRESSES.championPool,
    abi: ChampionPool_ABI,
    functionName: 'getBalance',
  })
}

export function useChampionPoolData() {
  const balance = useChampionPoolBalance()
  const { data: totalAccumulated } = useReadContract({
    address: ADDRESSES.championPool,
    abi: ChampionPool_ABI,
    functionName: 'totalAccumulated',
  })
  const { data: champion } = useReadContract({
    address: ADDRESSES.championPool,
    abi: ChampionPool_ABI,
    functionName: 'champion',
  })
  return { balance: balance.data, totalAccumulated, champion }
}
