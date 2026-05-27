import React, { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Conviction from './pages/Conviction'
import VAR from './pages/VAR'
import Portfolio from './pages/Portfolio'
import Leaderboard from './pages/Leaderboard'
import NFTs from './pages/NFTs'
import LiveScores from './pages/LiveScores'
const Trade = lazy(() => import('./pages/Trade'))
const Admin = lazy(() => import('./pages/Admin'))

const Lazy = ({ children }) => (
  <Suspense fallback={<div className="text-stadium-muted font-mono text-sm p-8">Loading…</div>}>
    {children}
  </Suspense>
)

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scores" element={<LiveScores />} />
        <Route path="/conviction" element={<Conviction />} />
        <Route path="/var" element={<VAR />} />
        <Route path="/trade" element={<Lazy><Trade /></Lazy>} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/nfts" element={<NFTs />} />
        <Route path="/admin" element={<Lazy><Admin /></Lazy>} />
      </Routes>
    </Layout>
  )
}
