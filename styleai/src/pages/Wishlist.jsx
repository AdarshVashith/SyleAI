import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, doc, deleteDoc, addDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/firebase'
import { BottomTabNav } from '../components/TabNav'

// ── Exported helper so TryOnModal can call this ────────────────────────────
export async function saveToWishlist(userId, item) {
  const { addDoc, collection } = await import('firebase/firestore')
  const { db } = await import('../firebase/firebase')
  return addDoc(collection(db, 'users', userId, 'wishlist'), {
    ...item,
    addedAt: new Date().toISOString()
  })
}

function Wishlist() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [wishlist, setWishlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [tryOnItem, setTryOnItem] = useState(null)
  const [tryOnLoading, setTryOnLoading] = useState(false)
  const [tryOnResult, setTryOnResult] = useState(null)
  const [tryOnError, setTryOnError] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) navigate('/login')
      else setUser(u)
    })
    return () => unsub()
  }, [navigate])

  useEffect(() => {
    if (!user) return
    const fetchWishlist = async () => {
      try {
        const [wishlistSnap, profileSnap] = await Promise.all([
          getDocs(collection(db, 'users', user.uid, 'wishlist')),
          getDoc(doc(db, 'users', user.uid))
        ])

        if (profileSnap.exists()) {
          setAvatarUrl(profileSnap.data().avatarUrl || null)
        }
        setWishlist(wishlistSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        setError('Failed to load wishlist.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchWishlist()
  }, [user])

  const handleRemove = async (id) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'wishlist', id))
      setWishlist(prev => prev.filter(w => w.id !== id))
    } catch (err) {
      console.error('Remove error:', err)
    }
  }

  const handleTryOn = async (itemOverride = null) => {
    const activeItem = itemOverride || tryOnItem
    if (!avatarUrl || !activeItem?.imageUrl) return

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
          category: activeItem.category || 'Top',
          clothName: activeItem.title || 'Wishlist item'
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 pt-6 pb-28">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Wishlist</h1>
          <p className="text-sm text-gray-400 mt-0.5">{wishlist.length} saved item{wishlist.length !== 1 ? 's' : ''}</p>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Empty state */}
        {wishlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center text-4xl">
              🛍️
            </div>
            <p className="text-lg font-bold text-gray-800">Your wishlist is empty</p>
            <p className="text-sm text-gray-400 max-w-xs">
              Find items you love in your Wardrobe → Try On → Visual Search, then save them here.
            </p>
            <button
              onClick={() => navigate('/wardrobe')}
              className="mt-2 rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white active:scale-[0.98]"
            >
              Go to Wardrobe
            </button>
          </div>
        ) : (
          /* Filled state */
          <div className="grid grid-cols-2 gap-4">
            {wishlist.map(item => (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="h-40 w-full bg-gray-100 flex items-center justify-center text-gray-300 text-3xl">
                    👗
                  </div>
                )}
                <div className="px-3 py-2 space-y-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.title || 'Saved item'}</p>
                  <p className="text-xs text-gray-400">{item.source || ''}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => item.link && window.open(item.link, '_blank')}
                      disabled={!item.link}
                      className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      View
                    </button>
                    <button
                      onClick={() => {
                        setTryOnItem(item)
                        setTryOnResult(null)
                        setTryOnError('')
                        handleTryOn(item)
                      }}
                      disabled={!item.imageUrl}
                      className="flex-1 rounded-lg bg-black py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-40"
                    >
                      Try On
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
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
                onClick={() => {
                  setTryOnItem(null)
                  setTryOnResult(null)
                  setTryOnError('')
                }}
                className="text-3xl font-light leading-none text-gray-400"
              >
                ×
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-400">
              {tryOnItem.title} · {tryOnItem.source || tryOnItem.category || 'Wishlist'}
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
                    className="h-full w-full bg-gray-50 object-contain"
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
                      {tryOnItem.category || 'Item'}
                    </p>
                    <img
                      src={tryOnItem.imageUrl}
                      alt={tryOnItem.title}
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

export default Wishlist
