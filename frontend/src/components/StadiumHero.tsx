import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ArrowRight } from 'lucide-react'

function useLightMode() {
  const [isLight, setIsLight] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('light')
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsLight(document.documentElement.classList.contains('light'))
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return isLight
}

export default function StadiumHero() {
  const { isConnected } = useAccount()
  const light = useLightMode()

  const bg        = light ? 'rgb(238,242,238)'      : 'rgba(0,0,0,0.40)'
  const cText     = light ? 'rgb(18,28,18)'         : '#ffffff'
  const cSubtitle = light ? 'rgba(18,28,18,0.50)'   : 'rgba(255,255,255,0.50)'
  const cDesc     = light ? 'rgba(18,28,18,0.65)'   : 'rgba(255,255,255,0.62)'
  const cStatLbl  = light ? 'rgba(18,28,18,0.40)'   : 'rgba(255,255,255,0.35)'
  const cGreen    = light ? 'rgb(0,168,107)'        : '#00ff87'
  const cBtnBdr   = light ? 'rgba(18,28,18,0.28)'   : 'rgba(255,255,255,0.28)'

  return (
    <section
      className="-mx-4 -mt-8 overflow-hidden md:pt-20"
      style={{
        height: '100svh',
        minHeight: 600,
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        paddingLeft: 'clamp(20px, 4vw, 64px)',
        paddingRight: 'clamp(20px, 4vw, 64px)',
        paddingBottom: 'clamp(64px, 12vh, 96px)',
        position: 'relative',
        transition: 'background 0.2s ease',
      }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Green rule + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'clamp(14px, 2.5vh, 22px)' }}>
          <div style={{ width: 40, height: 2, background: cGreen, flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: cGreen,
              boxShadow: light ? 'none' : `0 0 8px ${cGreen}`,
              display: 'inline-block',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: cSubtitle,
            }}>
              Uniswap V4 &nbsp;·&nbsp; X Layer &nbsp;·&nbsp; World Cup 2026
            </span>
          </div>
        </div>

        {/* Mega headline */}
        <h1
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 'clamp(52px, max(10vw, 7.5vh), 148px)',
            lineHeight: 0.9,
            letterSpacing: '-0.025em',
            color: cText,
            textTransform: 'uppercase',
            margin: 0,
            marginBottom: 'clamp(22px, 4vh, 44px)',
          }}
        >
          Back Your<br />
          Team.<br />
          Trade The<br />
          Match.<br />
          Win The Cup.
        </h1>

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>

          {/* Left: description + buttons */}
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(13px, 1.3vw, 15px)',
              lineHeight: 1.7,
              color: cDesc,
              maxWidth: 420,
              margin: '0 0 20px',
            }}>
              Lock conviction behind your World Cup nation. Earn Survivor Yield as rivals fall.
              Predict in-match events. Powered by Uniswap V4 Hooks.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!isConnected ? (
                <ConnectButton label="Connect Wallet" />
              ) : (
                <>
                  <Link to="/conviction" style={{ textDecoration: 'none' }}>
                    <button style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: '#000',
                      background: cGreen,
                      border: `2px solid ${cGreen}`,
                      padding: '13px 26px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 2,
                      whiteSpace: 'nowrap',
                    }}>
                      Back a Team <ArrowRight size={12} />
                    </button>
                  </Link>
                  <Link to="/var" style={{ textDecoration: 'none' }}>
                    <button style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: cText,
                      background: 'transparent',
                      border: `2px solid ${cBtnBdr}`,
                      padding: '13px 26px',
                      cursor: 'pointer',
                      borderRadius: 2,
                      whiteSpace: 'nowrap',
                    }}>
                      Predict Matches
                    </button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right: stat numbers */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 32, alignItems: 'flex-end', paddingBottom: 2 }}>
            {[
              { value: '48',  label: 'Nations'    },
              { value: '104', label: 'Matches'    },
              { value: 'V4',  label: 'Hook Pools' },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: "'Anton', sans-serif",
                  fontSize: 'clamp(32px, 4.5vw, 64px)',
                  color: cText,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}>
                  {value}
                </div>
                <div style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: cStatLbl,
                  marginTop: 5,
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
