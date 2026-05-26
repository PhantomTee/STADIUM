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
      <div className="page-header flex items-end justify-between">
        <div>
          <h1 className="section-title">STADIUM NFTs</h1>
          <p className="section-subtitle">On-chain collectibles earned through your World Cup journey.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-stadium-text">{totalSupply?.toString() || '0'}</div>
          <div className="text-xs text-stadium-muted font-mono uppercase tracking-widest">Total Minted</div>
        </div>
      </div>

      {/* NFT Types */}
      <div className="grid md:grid-cols-2 gap-px bg-stadium-border">
        <div className="bg-stadium-card p-8 border-t-2 border-t-stadium-gold">
          <div className="text-xs font-mono text-stadium-gold uppercase tracking-widest mb-4">Rarest · Champions only</div>
          <div className="text-4xl font-black text-stadium-gold uppercase tracking-tight leading-none mb-4">
            Champion NFT
          </div>
          <p className="text-stadium-muted text-sm leading-relaxed mb-6">
            Minted only to backers of the World Cup champion. Features on-chain SVG with gold design,
            your team name, deposit amount, and total earnings.
          </p>
          <div className="space-y-1">
            {[
              'Dynamic SVG — fully on-chain, no IPFS',
              'Shows: team, deposit, total earned, mint date',
              'Gold design with shimmer effect',
              'Text: "STADIUM World Cup 2026 Champion Backer"',
            ].map(item => (
              <div key={item} className="text-xs font-mono text-stadium-muted flex gap-2">
                <span className="text-stadium-gold">—</span>{item}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-stadium-card p-8 border-t-2 border-t-stadium-border">
          <div className="text-xs font-mono text-stadium-muted uppercase tracking-widest mb-4">Awarded on elimination</div>
          <div className="text-4xl font-black text-stadium-text uppercase tracking-tight leading-none mb-4">
            Elimination Badge
          </div>
          <p className="text-stadium-muted text-sm leading-relaxed mb-6">
            Minted when your team is eliminated. A permanent record of your conviction and the
            loyalty you showed before the final whistle.
          </p>
          <div className="space-y-1">
            {[
              'Grey & dark color scheme',
              'Shows: team, amount deposited, amount recovered (50%)',
              'Shield design with elimination mark',
              'Text: "Eliminated — but you believed."',
            ].map(item => (
              <div key={item} className="text-xs font-mono text-stadium-muted flex gap-2">
                <span className="text-stadium-muted">—</span>{item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User's NFTs */}
      {!isConnected ? (
        <div className="card text-center py-12 space-y-4">
          <div className="text-xs font-mono text-stadium-muted uppercase tracking-widest">Your Collection</div>
          <p className="text-stadium-muted text-sm">Connect your wallet to see your NFTs</p>
          <ConnectButton />
        </div>
      ) : !balance || balance === 0n ? (
        <div className="card text-center py-12">
          <div className="text-xs font-mono text-stadium-muted uppercase tracking-widest mb-3">Your Collection</div>
          <p className="text-stadium-text font-bold mb-2">No NFTs yet</p>
          <p className="text-stadium-muted text-sm max-w-sm mx-auto">
            Back a team and play through the tournament to earn NFTs.
            Elimination Badges are minted automatically when your team falls.
          </p>
        </div>
      ) : (
        <div>
          <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-4">
            Your Collection ({balance?.toString()})
          </div>
          <UserNFTGrid address={address} balance={balance} />
        </div>
      )}

      {/* How to Earn */}
      <div>
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-4">How to Earn STADIUM NFTs</div>
        <div className="grid sm:grid-cols-2 gap-px bg-stadium-border">
          {[
            { n: '01', title: 'Back any team',          desc: 'Deposit USDC via CONVICTION', color: 'text-stadium-muted' },
            { n: '02', title: 'Team gets eliminated',   desc: 'Elimination Badge auto-minted to your wallet', color: 'text-stadium-muted' },
            { n: '03', title: 'Team wins the World Cup', desc: 'Champion NFT minted — the rarest badge', color: 'text-stadium-gold' },
            { n: '04', title: 'All NFTs fully on-chain', desc: 'SVG metadata stored in contract, no IPFS dependency', color: 'text-stadium-muted' },
          ].map(step => (
            <div key={step.n} className="bg-stadium-card p-6 relative overflow-hidden">
              <div className="absolute -top-4 -left-2 text-[5rem] font-black text-stadium-green/5 leading-none select-none">
                {step.n}
              </div>
              <div className="relative">
                <div className={`font-mono text-xs font-bold mb-2 ${step.color}`}>{step.n}</div>
                <div className="font-black text-stadium-text text-sm uppercase tracking-tight mb-1">{step.title}</div>
                <div className="text-stadium-muted text-xs font-mono">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NFT Preview */}
      <div>
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-4">Preview</div>
        <div className="grid md:grid-cols-2 gap-px bg-stadium-border">
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
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-px bg-stadium-border">
      {tokenIds.map(id => <NFTCard key={id} tokenId={id} />)}
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
    <div className="bg-stadium-card p-3 text-center">
      {metadata?.image ? (
        <img
          src={metadata.image}
          alt={metadata.name}
          className="w-full aspect-square mb-3 object-cover"
        />
      ) : (
        <div className="w-full aspect-square mb-3 bg-stadium-dark border border-stadium-border flex items-center justify-center">
          <span className="text-stadium-muted font-mono text-xs">#{tokenId}</span>
        </div>
      )}
      <div className="text-sm font-bold text-stadium-text uppercase tracking-tight truncate">
        {metadata?.name || `Token #${tokenId}`}
      </div>
      <div className="text-xs text-stadium-muted font-mono mt-1">#{tokenId}</div>
    </div>
  )
}

function NFTPreview({ type }) {
  const isChampion = type === 'champion'

  if (isChampion) {
    return (
      <div className="overflow-hidden border border-stadium-gold/30" style={{ background: '#1a1a2e' }}>
        <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <defs>
            <linearGradient id="bgC" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a1a2e"/>
              <stop offset="100%" stopColor="#16213e"/>
            </linearGradient>
          </defs>
          <rect width="400" height="400" fill="url(#bgC)"/>
          <rect x="10" y="10" width="380" height="380" fill="none" stroke="#FFD700" strokeWidth="3"/>
          <path d="M160 80 L240 80 L240 140 Q240 170 200 180 Q160 170 160 140 Z" fill="#FFD700"/>
          <path d="M160 100 L130 100 Q120 100 120 120 Q120 150 160 155" fill="none" stroke="#FFD700" strokeWidth="4"/>
          <path d="M240 100 L270 100 Q280 100 280 120 Q280 150 240 155" fill="none" stroke="#FFD700" strokeWidth="4"/>
          <rect x="190" y="180" width="20" height="30" fill="#FFD700"/>
          <rect x="160" y="210" width="80" height="15" fill="#FFD700"/>
          <text x="200" y="270" fontFamily="Arial,sans-serif" fontSize="22" fontWeight="bold" fill="#FFD700" textAnchor="middle">Argentina</text>
          <text x="200" y="300" fontFamily="Arial,sans-serif" fontSize="11" fill="#FFF" textAnchor="middle">STADIUM World Cup 2026 Champion Backer</text>
          <text x="200" y="325" fontFamily="Arial,sans-serif" fontSize="11" fill="#FFD700" textAnchor="middle">Deposited: $1,000.00</text>
          <text x="200" y="345" fontFamily="Arial,sans-serif" fontSize="11" fill="#FFD700" textAnchor="middle">Earned: $2,450.00</text>
          <text x="200" y="375" fontFamily="Arial,sans-serif" fontSize="10" fill="#888" textAnchor="middle">STADIUM Protocol</text>
        </svg>
        <div className="p-3 text-center border-t border-stadium-gold/20">
          <div className="text-stadium-gold font-bold text-xs uppercase tracking-widest">Champion NFT</div>
          <div className="text-stadium-muted text-xs font-mono">On-chain SVG · No IPFS</div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden border border-stadium-border" style={{ background: '#1c1c1c' }}>
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" className="w-full">
        <defs>
          <linearGradient id="bgE" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1c1c1c"/>
            <stop offset="100%" stopColor="#2a2a2a"/>
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#bgE)"/>
        <rect x="10" y="10" width="380" height="380" fill="none" stroke="#666" strokeWidth="2"/>
        <path d="M200 80 L240 100 L240 160 Q240 190 200 200 Q160 190 160 160 L160 100 Z" fill="none" stroke="#888" strokeWidth="3"/>
        <text x="200" y="165" fontFamily="Arial,sans-serif" fontSize="36" fill="#888" textAnchor="middle">✗</text>
        <text x="200" y="240" fontFamily="Arial,sans-serif" fontSize="24" fontWeight="bold" fill="#aaa" textAnchor="middle">France</text>
        <text x="200" y="272" fontFamily="Arial,sans-serif" fontSize="12" fill="#777" textAnchor="middle">Eliminated — but you believed.</text>
        <text x="200" y="300" fontFamily="Arial,sans-serif" fontSize="11" fill="#666" textAnchor="middle">Deposited: $500.00</text>
        <text x="200" y="322" fontFamily="Arial,sans-serif" fontSize="11" fill="#666" textAnchor="middle">Recovered: $250.00</text>
        <text x="200" y="345" fontFamily="Arial,sans-serif" fontSize="11" fill="#555" textAnchor="middle">Round: Group Stage</text>
        <text x="200" y="375" fontFamily="Arial,sans-serif" fontSize="10" fill="#444" textAnchor="middle">STADIUM Protocol</text>
      </svg>
      <div className="p-3 text-center border-t border-stadium-border">
        <div className="text-stadium-muted font-bold text-xs uppercase tracking-widest">Elimination Badge</div>
        <div className="text-stadium-muted text-xs font-mono opacity-60">On-chain SVG · No IPFS</div>
      </div>
    </div>
  )
}
