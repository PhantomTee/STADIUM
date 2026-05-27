import React from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ArrowRight } from 'lucide-react'

export default function StadiumHero() {
  const { isConnected } = useAccount()

  return (
    <section
      className="-mx-4 -mt-8 overflow-hidden"
      style={{
        height: '100svh',
        minHeight: 600,
        background: 'rgba(0,0,0,0.40)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        paddingLeft: 'clamp(20px, 4vw, 64px)',
        paddingRight: 'clamp(20px, 4vw, 64px)',
        paddingBottom: 'clamp(32px, 5vh, 56px)',
        position: 'relative',
      }}
    >
      {/* Ghost 11° — decorative, top-right */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-4%',
          right: 'clamp(-20px, -1vw, 20px)',
          fontFamily: "'Anton', sans-serif",
          fontSize: 'clamp(180px, 38vw, 560px)',
          color: 'rgba(255,255,255,0.038)',
          lineHeight: 0.85,
          letterSpacing: '-0.04em',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        11°
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Green rule + live badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'clamp(14px, 2.5vh, 22px)' }}>
          <div style={{ width: 40, height: 2, background: '#00ff87', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#00ff87',
              boxShadow: '0 0 8px #00ff87',
              display: 'inline-block',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
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
            color: '#ffffff',
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

        {/* Bottom row — description + CTAs left, stat numbers right */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 32,
          flexWrap: 'wrap',
        }}>

          {/* Left: description + buttons */}
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(13px, 1.3vw, 15px)',
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.62)',
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
                      background: '#00ff87',
                      border: '2px solid #00ff87',
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
                      color: '#ffffff',
                      background: 'transparent',
                      border: '2px solid rgba(255,255,255,0.28)',
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

          {/* Right: clean stat numbers */}
          <div style={{
            flexShrink: 0,
            display: 'flex',
            gap: 32,
            alignItems: 'flex-end',
            paddingBottom: 2,
          }}>
            {[
              { value: '48', label: 'Nations' },
              { value: '104', label: 'Matches' },
              { value: 'V4', label: 'Hook Pools' },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: "'Anton', sans-serif",
                  fontSize: 'clamp(32px, 4.5vw, 64px)',
                  color: '#ffffff',
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
                  color: 'rgba(255,255,255,0.35)',
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
