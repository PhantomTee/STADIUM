import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useReadContract } from 'wagmi'
import { ADDRESSES } from '../utils/contracts'
import { StadiumNFT_ABI } from '../abis'

export default function NFTs() {
  const { address, isConnected } = useAccount()

  const { data: balance } = useReadContract({
    address: ADDRESSES.stadiumNFT,
    abi: StadiumNFT_ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: !!address },
  })

  const { data: totalSupply } = useReadContract({
    address: ADDRESSES.stadiumNFT,
    abi: StadiumNFT_ABI,
    functionName: 'totalSupply',
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">🎖️ STADIUM NFTs</h1>
          <p className="section-subtitle">On-chain collectibles earned through your World Cup journey.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{totalSupply?.toString() || '0'}</div>
          <div className="text-xs text-stadium-muted">Total Minted</div>
        </div>
      </div>

      {/* NFT Types */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card border-stadium-gold/30 bg-stadium-gold/5">
          <div className="text-4xl mb-4">🏆</div>
          <h2 className="font-bold text-xl text-stadium-gold mb-2">Champion NFT</h2>
          <p className="text-stadium-muted text-sm mb-4">
            Minted only to backers of the World Cup champion. The rarest collectible in the protocol.
            Features on-chain SVG with gold & black design, your team name, deposit amount, and total earnings.
          </p>
          <div className="space-y-1 text-xs text-stadium-muted">
            <div>• Dynamic SVG — fully on-chain, no IPFS</div>
            <div>• Shows: team, deposit, total earned, mint date</div>
            <div>• Gold trophy icon with shimmer effect</div>
            <div>• Text: "STADIUM World Cup 2026 Champion Backer"</div>
          </div>
        </div>

        <div className="card border-gray-600/30">
          <div className="text-4xl mb-4">🛡️</div>
          <h2 className="font-bold text-xl text-white mb-2">Elimination Badge</h2>
          <p className="text-stadium-muted text-sm mb-4">
            Minted when your team is eliminated. A permanent record of your conviction and the loyalty
            you showed before the final whistle.
          </p>
          <div className="space-y-1 text-xs text-stadium-muted">
            <div>• Grey & dark color scheme</div>
            <div>• Shows: team, amount deposited, amount recovered (50%)</div>
            <div>• Shield icon with elimination mark</div>
            <div>• Text: "Eliminated — but you believed."</div>
          </div>
        </div>
      </div>

      {/* User's NFTs */}
      {!isConnected ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">🎖️</div>
          <p className="text-stadium-muted mb-4">Connect your wallet to see your NFTs</p>
          <ConnectButton />
        </div>
      ) : !balance || balance === 0n ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">⚽</div>
          <p className="text-white font-semibold mb-2">No NFTs yet</p>
          <p className="text-stadium-muted text-sm">
            Back a team and play through the tournament to earn NFTs.
            Elimination Badges are minted automatically when your team falls.
            Champion NFTs are reserved for the tournament winner.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="font-semibold text-white mb-4">Your Collection ({balance?.toString()})</h2>
          <UserNFTGrid address={address} balance={balance} />
        </div>
      )}

      {/* How to Earn */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">How to Earn STADIUM NFTs</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="text-2xl">1️⃣</span>
              <div>
                <div className="font-medium text-white">Back any team</div>
                <div className="text-stadium-muted text-xs">Deposit USDC via CONVICTION</div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">2️⃣</span>
              <div>
                <div className="font-medium text-white">Team gets eliminated</div>
                <div className="text-stadium-muted text-xs">Elimination Badge auto-minted to your wallet</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="text-2xl">🌟</span>
              <div>
                <div className="font-medium text-stadium-gold">Team wins the World Cup</div>
                <div className="text-stadium-muted text-xs">Champion NFT minted — the rarest badge</div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <div className="font-medium text-white">All NFTs are fully on-chain</div>
                <div className="text-stadium-muted text-xs">SVG metadata stored in contract, no IPFS dependency</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NFT Preview */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Preview</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <NFTPreview type="champion" />
          <NFTPreview type="elimination" />
        </div>
      </div>
    </div>
  )
}

function UserNFTGrid({ address, balance }) {
  const tokenIds = Array.from({ length: Number(balance) }, (_, i) => i + 1)

  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
      {tokenIds.map(id => (
        <NFTCard key={id} tokenId={id} />
      ))}
    </div>
  )
}

function NFTCard({ tokenId }) {
  const { data: tokenURI } = useReadContract({
    address: ADDRESSES.stadiumNFT,
    abi: StadiumNFT_ABI,
    functionName: 'tokenURI',
    args: [BigInt(tokenId)],
  })

  let metadata = null
  if (tokenURI) {
    try {
      const base64 = tokenURI.replace('data:application/json;base64,', '')
      metadata = JSON.parse(atob(base64))
    } catch {}
  }

  return (
    <div className="card p-3 text-center">
      {metadata?.image ? (
        <img
          src={metadata.image}
          alt={metadata.name}
          className="w-full aspect-square rounded-lg mb-3 object-cover"
        />
      ) : (
        <div className="w-full aspect-square rounded-lg mb-3 bg-stadium-dark border border-stadium-border flex items-center justify-center text-4xl">
          🎖️
        </div>
      )}
      <div className="text-sm font-medium text-white truncate">{metadata?.name || `Token #${tokenId}`}</div>
      <div className="text-xs text-stadium-muted mt-1">#{tokenId}</div>
    </div>
  )
}

function NFTPreview({ type }) {
  const isChampion = type === 'champion'

  if (isChampion) {
    return (
      <div className="rounded-2xl overflow-hidden border border-stadium-gold/30" style={{ background: '#1a1a2e' }}>
        <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <defs>
            <linearGradient id="bgC" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a1a2e"/>
              <stop offset="100%" stopColor="#16213e"/>
            </linearGradient>
          </defs>
          <rect width="400" height="400" fill="url(#bgC)" rx="20"/>
          <rect x="10" y="10" width="380" height="380" fill="none" stroke="#FFD700" strokeWidth="3" rx="16"/>
          <path d="M160 80 L240 80 L240 140 Q240 170 200 180 Q160 170 160 140 Z" fill="#FFD700"/>
          <path d="M160 100 L130 100 Q120 100 120 120 Q120 150 160 155" fill="none" stroke="#FFD700" strokeWidth="4"/>
          <path d="M240 100 L270 100 Q280 100 280 120 Q280 150 240 155" fill="none" stroke="#FFD700" strokeWidth="4"/>
          <rect x="190" y="180" width="20" height="30" fill="#FFD700"/>
          <rect x="160" y="210" width="80" height="15" fill="#FFD700" rx="4"/>
          <text x="200" y="270" fontFamily="Arial,sans-serif" fontSize="22" fontWeight="bold" fill="#FFD700" textAnchor="middle">Argentina 🇦🇷</text>
          <text x="200" y="300" fontFamily="Arial,sans-serif" fontSize="11" fill="#FFF" textAnchor="middle">STADIUM World Cup 2026 Champion Backer</text>
          <text x="200" y="325" fontFamily="Arial,sans-serif" fontSize="11" fill="#FFD700" textAnchor="middle">Deposited: $1,000.00</text>
          <text x="200" y="345" fontFamily="Arial,sans-serif" fontSize="11" fill="#FFD700" textAnchor="middle">Earned: $2,450.00</text>
          <text x="200" y="375" fontFamily="Arial,sans-serif" fontSize="10" fill="#888" textAnchor="middle">STADIUM Protocol</text>
        </svg>
        <div className="p-3 text-center">
          <div className="text-stadium-gold font-semibold text-sm">Champion NFT</div>
          <div className="text-stadium-muted text-xs">On-chain SVG • No IPFS</div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-600/30" style={{ background: '#1c1c1c' }}>
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" className="w-full">
        <defs>
          <linearGradient id="bgE" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1c1c1c"/>
            <stop offset="100%" stopColor="#2a2a2a"/>
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#bgE)" rx="20"/>
        <rect x="10" y="10" width="380" height="380" fill="none" stroke="#666" strokeWidth="2" rx="16"/>
        <path d="M200 80 L240 100 L240 160 Q240 190 200 200 Q160 190 160 160 L160 100 Z" fill="none" stroke="#888" strokeWidth="3"/>
        <text x="200" y="165" fontFamily="Arial,sans-serif" fontSize="36" fill="#888" textAnchor="middle">✗</text>
        <text x="200" y="240" fontFamily="Arial,sans-serif" fontSize="24" fontWeight="bold" fill="#aaa" textAnchor="middle">France 🇫🇷</text>
        <text x="200" y="272" fontFamily="Arial,sans-serif" fontSize="12" fill="#777" textAnchor="middle">Eliminated — but you believed.</text>
        <text x="200" y="300" fontFamily="Arial,sans-serif" fontSize="11" fill="#666" textAnchor="middle">Deposited: $500.00</text>
        <text x="200" y="322" fontFamily="Arial,sans-serif" fontSize="11" fill="#666" textAnchor="middle">Recovered: $250.00</text>
        <text x="200" y="345" fontFamily="Arial,sans-serif" fontSize="11" fill="#555" textAnchor="middle">Round: Group Stage</text>
        <text x="200" y="375" fontFamily="Arial,sans-serif" fontSize="10" fill="#444" textAnchor="middle">STADIUM Protocol</text>
      </svg>
      <div className="p-3 text-center">
        <div className="text-gray-400 font-semibold text-sm">Elimination Badge</div>
        <div className="text-stadium-muted text-xs">On-chain SVG • No IPFS</div>
      </div>
    </div>
  )
}
