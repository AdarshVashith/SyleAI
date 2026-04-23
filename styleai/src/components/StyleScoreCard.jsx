import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/firebase'

export default function StyleScoreCard({ userId }) {
  const [outfits, setOutfits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const fetchOutfits = async () => {
      try {
        const snap = await getDocs(collection(db, 'users', userId, 'outfits'))
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        data.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))
        setOutfits(data)
      } catch (err) {
        console.error('StyleScoreCard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchOutfits()
  }, [userId])

  if (loading) return null

  // Compute stats
  const avgScore = outfits.length
    ? Math.round(outfits.reduce((sum, o) => sum + (o.styleScore || 0), 0) / outfits.length)
    : 0

  // Streak: consecutive days from today with at least one outfit
  const todayStr = new Date().toDateString()
  let currentStreak = 0
  const dateSet = new Set(outfits.map(o => new Date(o.generatedAt).toDateString()))
  let checkDate = new Date()
  while (dateSet.has(checkDate.toDateString())) {
    currentStreak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  const recentOutfits = outfits.slice(0, 5)
  const last3 = outfits.slice(0, 3)

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-base font-bold text-gray-900">🏆 Style Score</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-gray-900">{avgScore}</span>
          <span className="text-sm text-gray-400">avg</span>
        </div>
      </div>

      {/* Streak */}
      {currentStreak >= 2 && (
        <div className="mb-4">
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
            {currentStreak} day streak 🔥
          </span>
        </div>
      )}

      {outfits.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          Generate outfits to build your style score.
        </p>
      ) : (
        <>
          {/* Mini bar chart */}
          <div className="mb-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Score History
            </p>
            <div className="flex h-[60px] items-end gap-2">
              {recentOutfits.map((o, i) => (
                <div key={o.id || i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full max-w-[48px] rounded-t-md bg-black"
                    style={{ height: `${((o.styleScore || 0) / 100) * 60}px` }}
                  />
                  <span className="text-[10px] text-gray-400">{o.styleScore}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent looks */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Recent Looks
            </p>
            <div className="divide-y divide-gray-50">
              {last3.map((o, i) => (
                <div key={o.id || i} className="flex items-center justify-between py-2 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{o.outfitName}</p>
                    <p className="text-xs text-gray-400">
                      {o.occasion} · {formatDate(o.generatedAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-black px-2 py-0.5 text-sm font-bold text-white">
                    {o.styleScore}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
