import React from 'react'
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
        <div className="text-xs font-bold text-stadium-text uppercase tracking-widest mb-4">How to Earn</div>
        <div className="grid sm:grid-cols-3 gap-px bg-stadium-border">
          {[
            { n: '01', title: 'Back any team',           desc: 'Deposit USDC via Conviction' },
            { n: '02', title: 'Team gets eliminated',    desc: 'Badge minted automatically to your wallet' },
            { n: '03', title: 'Team wins the World Cup', desc: 'Champion NFT minted — the rarest badge', gold: true },
          ].map(step => (
            <div key={step.n} className="bg-stadium-card p-6 relative overflow-hidden">
              <div className="absolute -top-4 -left-2 text-[5rem] font-black text-stadium-green/5 leading-none select-none">
                {step.n}
              </div>
              <div className="relative">
                <div className={`font-mono text-xs font-bold mb-2 ${step.gold ? 'text-stadium-gold' : 'text-stadium-muted'}`}>{step.n}</div>
                <div className="font-black text-stadium-text text-sm uppercase tracking-tight mb-1">{step.title}</div>
                <div className="text-stadium-muted text-xs font-mono">{step.desc}</div>
              </div>
            </div>
          ))}
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
