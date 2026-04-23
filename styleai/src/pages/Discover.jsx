import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { BottomTabNav } from '../components/TabNav'
import { auth, db } from '../firebase/firebase'
import { saveToWishlist } from './Wishlist'
import callBackend from '../utils/apiClient'

function SkeletonCard() {
  return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
}

function buildDiscoverCacheKey(userId, wardrobe, profile) {
  const wardrobeSignature = wardrobe
    .map((item) => `${item.name || ''}|${item.category || ''}|${item.color || ''}`)
    .sort()
    .join('||')
  const profileSignature = [
    profile.gender || '',
    profile.bodyType || '',
    profile.skinTone || '',
    profile.age || ''
  ].join('|')

  return `discover-cache:${userId}:${wardrobeSignature}:${profileSignature}`
}

export default function Discover() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterCategory, setFilterCategory] = useState('All')
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [savingId, setSavingId] = useState('')
  const [tryOnItem, setTryOnItem] = useState(null)
  const [tryOnLoading, setTryOnLoading] = useState(false)
  const [tryOnResult, setTryOnResult] = useState(null)
  const [tryOnError, setTryOnError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)

  const fetchRecommendations = async (firebaseUser) => {
    if (!firebaseUser) return

    setError('')

    try {
      const [profileSnap, wardrobeSnap] = await Promise.all([
        getDoc(doc(db, 'users', firebaseUser.uid)),
        getDocs(collection(db, 'users', firebaseUser.uid, 'wardrobe'))
      ])

      if (!profileSnap.exists()) {
        throw new Error('Profile not found. Please complete onboarding first.')
      }

      const wardrobe = wardrobeSnap.docs.map((itemDoc) => ({
        id: itemDoc.id,
        ...itemDoc.data()
      }))

      const profile = profileSnap.data()
      setAvatarUrl(profile.avatarUrl || null)
      const discoverPayload = {
        wardrobe: wardrobe.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          color: item.color
        })),
        profile: {
          gender: profile.gender || '',
          bodyType: profile.bodyType || '',
          skinTone: profile.skinTone || '',
          age: profile.age || ''
        }
      }

      const cacheKey = buildDiscoverCacheKey(firebaseUser.uid, discoverPayload.wardrobe, discoverPayload.profile)
      const cachedItems = localStorage.getItem(cacheKey)

      if (cachedItems) {
        try {
          const parsedCache = JSON.parse(cachedItems)
          if (Array.isArray(parsedCache) && parsedCache.length > 0) {
            setItems(parsedCache)
            setLoading(false)
            setRefreshing(true)
          } else {
            setLoading(true)
          }
        } catch {
          setLoading(true)
        }
      } else {
        setLoading(true)
      }

      const data = await callBackend('/api/discover-items', discoverPayload)

      const nextItems = Array.isArray(data.items) ? data.items : []
      setItems(nextItems)
      localStorage.setItem(cacheKey, JSON.stringify(nextItems))

    } catch (err) {
      console.error('Discover fetch error:', err)
      setError(err.message || 'Failed to load discover recommendations.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        navigate('/login')
        return
      }

      setUser(firebaseUser)
      await fetchRecommendations(firebaseUser)
    })

    return () => unsubscribe()
  }, [navigate])

  const handleRetry = async () => {
    await fetchRecommendations(user)
  }

  const handleSaveToWishlist = async (item) => {
    if (!user || savingId === item.name) return

    try {
      setSavingId(item.name)
      const wishlistItem = {
        title: item.name,
        imageUrl: item.imageUrl || item.productImageUrl || '',
        link: item.link || item.productLink || '',
        source: item.productSource || item.category || 'Discover',
        category: item.category || 'Accessory',
        brand: item.brand || ''
      }
      await saveToWishlist(user.uid, {
        ...wishlistItem
      })
    } catch (err) {
      console.error('Wishlist save error:', err)
      setError('Could not save to wishlist. Please try again.')
    } finally {
      setSavingId('')
    }
  }

  const handleTryOn = async (itemOverride = null) => {
    const activeItem = itemOverride || tryOnItem
    if (!avatarUrl || !activeItem) return
    setTryOnLoading(true)
    setTryOnResult(null)
    setTryOnError('')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 95000)
      const res = await fetch(`${BACKEND_URL}/api/try-on`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          avatarUrl,
          clothImageUrl: activeItem.imageUrl,
          category: activeItem.category,
          clothName: activeItem.name
        })
      })
      clearTimeout(timeout)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Try on failed')
      }
      if (!data.success) throw new Error(data.error || 'Try on failed')
      setTryOnResult(data.imageUrl)
    } catch (err) {
      setTryOnError(err.name === 'AbortError'
        ? 'Try-on timed out. The public queue is busy right now. Please try again.'
        : err.message || 'Try on failed')
    } finally {
      setTryOnLoading(false)
    }
  }

  const filteredItems =
    filterCategory === 'All'
      ? items
      : items.filter((item) => item.category === filterCategory)

  return (
    <main className="min-h-screen bg-gray-50 px-4 pb-28 pt-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="absolute left-0 text-xl text-gray-500 hover:text-gray-700"
            >
              ←
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Discover</h1>
          </div>
          <p className="mt-2 text-center text-[13px] text-gray-400">
            Curated for your wardrobe & styling goals.
          </p>
        </header>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 16px', WebkitOverflowScrolling: 'touch' }}>
          {['All', 'Shirt', 'Pant', 'Jacket', 'Shoes', 'Accessory'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              style={{
                padding: '6px 16px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                border: filterCategory === cat ? '1.5px solid #111827' : '1.5px solid #e5e7eb',
                background: filterCategory === cat ? '#111827' : '#ffffff',
                color: filterCategory === cat ? '#ffffff' : '#4b5563',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">
          Decision Grid
        </p>

        {refreshing && !loading ? (
          <p className="mb-3 text-xs text-gray-400">
            Refreshing recommendations...
          </p>
        ) : null}

        {error && !loading ? (
          <div className="rounded-2xl border border-red-100 bg-white px-6 py-10 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredItems.map((item, index) => (
              <article
                key={`${item.name}-${index}`}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
              >
                {(() => {
                  const displayItem = {
                    ...item,
                    imageUrl: item.imageUrl || item.productImageUrl || '',
                    link: item.link || item.productLink || ''
                  }

                  return (
                    <>
                      <div className="relative">
                        {item.productImageUrl ? (
                          <img
                            src={item.productImageUrl}
                            alt={item.name}
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center bg-gray-100 text-4xl">
                            👕
                          </div>
                        )}

                        <span className="absolute left-2 top-2 rounded-full bg-black px-2 py-0.5 text-xs text-white">
                          {item.matchScore}% Match
                        </span>

                        <button
                          type="button"
                          onClick={() => handleSaveToWishlist(item)}
                          className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-sm shadow-sm"
                          aria-label={`Save ${item.name} to wishlist`}
                        >
                          {savingId === item.name ? '…' : '♡'}
                        </button>
                      </div>

                      <div className="p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">
                          {item.category}
                        </p>
                        <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900">
                          {item.name}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                          {item.reason}
                        </p>

                        <p className="mt-2 text-sm font-bold">~${item.estimatedPrice}</p>

                        <div className="mt-2 flex gap-1.5">
                          <button
                            onClick={() => window.open(displayItem.link, '_blank')}
                            disabled={!displayItem.link}
                            className="flex-1 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 py-2 disabled:opacity-40"
                          >
                            🛍 Shop
                          </button>
                          <button
                            onClick={() => {
                              setTryOnItem(displayItem)
                              setTryOnResult(null)
                              setTryOnError('')
                              handleTryOn(displayItem)
                            }}
                            className="flex-1 rounded-xl bg-black text-xs text-white font-medium transition-colors hover:bg-gray-800 py-2"
                          >
                            👔 Try On
                          </button>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </article>
            ))}
          </div>
        )}
      </div>

      {tryOnItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
          <div
            className="w-full max-w-lg rounded-t-3xl bg-white p-5"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">Try On</h2>
              <button
                onClick={() => { setTryOnItem(null); setTryOnResult(null); setTryOnError('') }}
                className="text-3xl font-light leading-none text-gray-400"
              >
                ×
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-400">
              {tryOnItem.name} · {tryOnItem.brand}
            </p>

            {!avatarUrl ? (
              <div className="py-10 text-center">
                <div className="mb-3 text-5xl">🧍</div>
                <p className="mb-1 text-sm font-medium text-gray-600">
                  No avatar found
                </p>
                <p className="mb-5 text-xs text-gray-400">
                  Generate your AI avatar first to use virtual try-on
                </p>
                <button
                  onClick={() => navigate('/generate-model')}
                  className="rounded-xl bg-black px-8 py-3 text-sm font-semibold text-white"
                >
                  Generate Avatar
                </button>
              </div>
            ) : tryOnResult ? (
              <div>
                <div
                  className="relative mb-4 overflow-hidden rounded-2xl"
                  style={{ height: '380px' }}
                >
                  <img
                    src={tryOnResult}
                    alt="Try on result"
                    className="h-full w-full object-contain bg-gray-50"
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                    ✓ Try On Result
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setTryOnResult(null)
                      setTryOnError('')
                      handleTryOn()
                    }}
                    className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700"
                  >
                    ← Try Again
                  </button>
                  <button
                    onClick={() => {
                      const a = document.createElement('a')
                      a.href = tryOnResult
                      a.download = `styleai-tryon-${Date.now()}.png`
                      a.click()
                    }}
                    className="flex-1 rounded-xl bg-black py-3 text-sm font-semibold text-white"
                  >
                    ↓ Save Photo
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex gap-3">
                  <div className="flex-1">
                    <p className="mb-1.5 text-center text-xs text-gray-400">
                      Your avatar
                    </p>
                    <img
                      src={avatarUrl}
                      alt="Your avatar"
                      className="w-full rounded-2xl object-cover"
                      style={{ height: '220px' }}
                    />
                  </div>
                  <div className="flex items-center text-2xl text-gray-300">+</div>
                  <div className="flex-1">
                    <p className="mb-1.5 text-center text-xs text-gray-400">
                      {tryOnItem.category}
                    </p>
                    <img
                      src={tryOnItem.imageUrl}
                      alt={tryOnItem.name}
                      className="w-full rounded-2xl object-cover"
                      style={{ height: '220px' }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleTryOn}
                  disabled={tryOnLoading}
                  className="w-full rounded-2xl bg-black py-4 text-sm font-semibold text-white transition-all hover:bg-gray-800 disabled:opacity-50"
                >
                  {tryOnLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Generating try on... (up to 90s)
                    </span>
                  ) : '✦ Generate Virtual Try On'}
                </button>
                {tryOnError ? (
                  <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-center text-xs text-red-600">
                    {tryOnError}
                  </div>
                ) : null}
                <p className="mt-2 text-center text-xs text-gray-400">
                  Powered by Hugging Face Leffa · Public queue can take 30–90 seconds
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomTabNav />
    </main>
  )
}
