import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Conviction from './pages/Conviction'
import VAR from './pages/VAR'
import Portfolio from './pages/Portfolio'
import Leaderboard from './pages/Leaderboard'
import NFTs from './pages/NFTs'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/conviction" element={<Conviction />} />
        <Route path="/var" element={<VAR />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/nfts" element={<NFTs />} />
      </Routes>
    </Layout>
  )
}
