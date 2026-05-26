import React from 'react'

function Svg({ size, className, children, filled }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconBall({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7.5 14.5 9v3L12 13.5 9.5 12V9z" strokeWidth="1" />
      <path d="M12 2v5.5M19.5 9.5l-5 2M17 20l-3.5-5.5M7 20l3.5-5.5M4.5 9.5l5 2" />
    </Svg>
  )
}

export function IconChart({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M3 20h18" />
      <path d="M7 20V12" />
      <path d="M12 20V6" />
      <path d="M17 20v-8" />
    </Svg>
  )
}

export function IconTrophy({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
      <path d="M6 5v4a6 6 0 0 0 12 0V5H6z" />
      <path d="M12 15v4" />
      <path d="M8 19h8" />
    </Svg>
  )
}

export function IconCoins({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <circle cx="9" cy="12" r="7" />
      <path d="M15.5 6.5A7 7 0 0 1 9 19" />
      <path d="M20.9 13A7 7 0 0 0 15.5 6.5" />
      <path d="M9 9v6M6.5 11h5M6.5 13h5" />
    </Svg>
  )
}

export function IconUsers({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

export function IconBriefcase({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <rect x="2" y="7" width="20" height="14" rx="0" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="12" />
      <path d="M2 12h20" />
    </Svg>
  )
}

export function IconStadium({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <ellipse cx="12" cy="10" rx="9" ry="4" />
      <path d="M3 10v5c0 2.2 4 4 9 4s9-1.8 9-4v-5" />
      <path d="M7 10v9M17 10v9" />
      <path d="M7 14h10" />
    </Svg>
  )
}

export function IconMedal({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="15" r="5" />
      <path d="M8.5 4.5 7 2h10l-1.5 2.5" />
      <path d="M8.5 4.5C8.5 4.5 10 8 12 10c2-2 3.5-5.5 3.5-5.5" />
      <path d="M12 10v5" />
    </Svg>
  )
}

export function IconCheck({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  )
}

export function IconWarn({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </Svg>
  )
}

export function IconClose({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  )
}

export function IconMenu({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </Svg>
  )
}

export function IconRedCard({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className} filled>
      <rect x="7" y="2" width="10" height="16" rx="1" fill="#ef4444" stroke="none" />
    </Svg>
  )
}

export function IconClock({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Svg>
  )
}

export function IconStar({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Svg>
  )
}

export function IconShield({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  )
}

export function IconBolt({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </Svg>
  )
}

export function IconArrow({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </Svg>
  )
}

export function IconLock({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="11" width="18" height="11" rx="0" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  )
}

export function IconTarget({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Svg>
  )
}

export function IconSun({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </Svg>
  )
}

export function IconMoon({ size = 20, className = '' }) {
  return (
    <Svg size={size} className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  )
}

export function IconDot({ className = '' }) {
  return (
    <span
      className={`inline-block w-2 h-2 bg-current ${className}`}
      aria-hidden="true"
    />
  )
}
