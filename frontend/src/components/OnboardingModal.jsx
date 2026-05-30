import React, { useState, useEffect } from 'react'

const STORAGE_KEY = '11deg-onboarding-seen'

const STEPS = [
  {
    tag: 'Welcome',
    title: 'Welcome to 11°',
    body: 'The conviction-based DeFi protocol built on the 2026 World Cup. Lock USDC behind a team, earn yield while they stay alive, and share the Champion Pool if they lift the trophy.',
  },
  {
    tag: 'Step 1',
    title: 'Claim your USDC',
    body: "Head to the Conviction page and hit the Faucet button. You'll receive 1,000 mock USDC instantly — once every 24 hours. No wallet balance? Start here.",
  },
  {
    tag: 'Step 2',
    title: 'Lock conviction behind a team',
    body: 'Pick any of the 48 WC 2026 teams and deposit USDC. Your locked amount earns yield proportional to your share of the total pool — the more the crowd backs your team, the more you earn.',
  },
  {
    tag: 'Step 3',
    title: 'Bet on VAR moments',
    body: "During live matches, open VAR markets let you stake on in-game events — red cards, corners, goals. Wrong bettors' stakes are redistributed to the correct side. High conviction, high reward.",
  },
  {
    tag: 'Step 4',
    title: 'The Champion Pool',
    body: '25% of every eliminated team\'s forfeit flows into the Champion Pool. When the final whistle blows, holders who backed the world champion split the entire pool proportionally. One team. One shot.',
  },
]

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false)
  const [step, setStep]       = useState(0)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else dismiss()
  }

  function back() {
    if (step > 0) setStep(s => s - 1)
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,4,0.88)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="relative w-full max-w-md bg-stadium-card border border-stadium-green/40 flex flex-col"
        style={{ borderRadius: 2 }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-stadium-green">
            {current.tag}
          </span>
          <button
            onClick={dismiss}
            className="text-stadium-muted hover:text-white transition-colors text-xs font-mono uppercase tracking-widest"
          >
            Skip
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-7 flex-1">
          <h2
            className="text-2xl font-black uppercase tracking-tight text-white mb-3"
            style={{ fontFamily: "'Motiva Sans', 'DM Sans', sans-serif" }}
          >
            {current.title}
          </h2>
          <p className="text-sm text-stadium-muted font-mono leading-relaxed">
            {current.body}
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-stadium-border px-5 py-4 flex items-center justify-between gap-4">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'bg-stadium-green w-4' : 'bg-stadium-border w-1.5'
                }`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={back}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest font-mono text-stadium-muted hover:text-white border border-stadium-border transition-colors"
                style={{ borderRadius: 2 }}
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="px-5 py-2 text-xs font-bold uppercase tracking-widest font-mono bg-stadium-green text-stadium-dark hover:bg-stadium-green/90 transition-colors"
              style={{ borderRadius: 2 }}
            >
              {isLast ? "Let's go" : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
