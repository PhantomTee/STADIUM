import React, { useState } from 'react'

function ShareIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

export default function ShareButton({ text }) {
  const [copied, setCopied] = useState(false)

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  function handleShare() {
    const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text + ' ' + siteUrl)}`
    window.open(tw, '_blank', 'noopener,noreferrer,width=560,height=420')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${text} ${siteUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-widest text-stadium-muted hover:text-stadium-green border border-stadium-border/60 hover:border-stadium-green/40 transition-colors"
        style={{ borderRadius: 2 }}
      >
        <ShareIcon />
        Share
      </button>
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1 px-2 py-1 text-xs font-mono border transition-colors ${
          copied
            ? 'text-stadium-green border-stadium-green/30 bg-stadium-green/10'
            : 'text-stadium-muted border-stadium-border/60 hover:text-stadium-text hover:border-stadium-border'
        }`}
        style={{ borderRadius: 2 }}
        title="Copy to clipboard"
      >
        {copied ? <><CheckIcon /><span>Copied</span></> : <CopyIcon />}
      </button>
    </div>
  )
}
