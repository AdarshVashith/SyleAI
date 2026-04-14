import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { 
  doc, getDoc, collection, 
  getDocs, addDoc, updateDoc 
} from 'firebase/firestore'
import { db, auth } from '../../firebase/firebase'
import { useNavigate } from 'react-router-dom'
import ClothCard from './components/ClothCard'
import UploadClothModal from './components/UploadClothModal'
import TryOnModal from './components/TryOnModal'

export default function Wardrobe() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [wardrobe, setWardrobe] = useState([])
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showTryOn, setShowTryOn] = useState(false)
  const [selectedCloth, setSelectedCloth] = useState(null)
  const [filterCategory, setFilterCategory] = useState('All')
  const [error, setError] = useState(null)

  const categories = [
    'All', 'Top', 'Bottom', 'Dress', 
    'Jacket', 'Shoes', 'Accessory'
  ]

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u)
      else navigate('/login')
    })
    return () => unsub()
  }, [])

  // Fetch wardrobe and avatar
  useEffect(() => {
    if (!user) return
    fetchData()
  }, [user])

  const fetchData = async () => {
    try {
      // Fetch avatar URL
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        console.log('Avatar URL:', userData.avatarUrl)
        setAvatarUrl(userData.avatarUrl)
      }

      // Fetch wardrobe items
      const wardrobeSnap = await getDocs(
        collection(db, 'users', user.uid, 'wardrobe')
      )
      const items = wardrobeSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
      setWardrobe(items)
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  // Save new cloth to Firestore
  const handleSaveCloth = async (clothData) => {
    try {
      const docRef = await addDoc(
        collection(db, 'users', user.uid, 'wardrobe'),
        clothData
      )
      setWardrobe(prev => [...prev, { id: docRef.id, ...clothData }])
      setShowUploadModal(false)
    } catch (err) {
      setError('Failed to save cloth: ' + err.message)
    }
  }

  // Mark cloth as worn today
  const handleWorn = async (clothId) => {
    try {
      const cloth = wardrobe.find(c => c.id === clothId)
      if (!cloth) return

      const newWearCount = (cloth.wearCount || 0) + 1
      const today = new Date().toISOString()

      await updateDoc(
        doc(db, 'users', user.uid, 'wardrobe', clothId),
        {
          wearCount: newWearCount,
          lastWorn: today,
          wearHistory: [...(cloth.wearHistory || []), today]
        }
      )

      setWardrobe(prev => prev.map(c =>
        c.id === clothId
          ? { 
              ...c, 
              wearCount: newWearCount, 
              lastWorn: today,
              wearHistory: [...(c.wearHistory || []), today]
            }
          : c
      ))
    } catch (err) {
      setError('Failed to update wear count: ' + err.message)
    }
  }

  const handleTryOn = (cloth) => {
    setSelectedCloth(cloth)
    setShowTryOn(true)
  }

  const filteredWardrobe = filterCategory === 'All'
    ? wardrobe
    : wardrobe.filter(c => c.category === filterCategory)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 
          border-t-orange-400 rounded-full animate-spin"/>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top navbar */}
      <div className="bg-white border-b border-gray-100 
        px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold">My wardrobe</h1>
        <button
          onClick={() => setShowUploadModal(true)}
          className="bg-gray-900 text-white px-4 py-2 
            rounded-xl text-sm font-semibold 
            hover:bg-gray-700 transition-all"
        >
          + Add cloth
        </button>
      </div>

      {/* Category filter */}
      <div className="px-6 py-4 flex gap-2 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium 
              whitespace-nowrap transition-all ${
              filterCategory === cat
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="px-6 mb-4 flex gap-4">
        <div className="bg-white rounded-xl border border-gray-100 
          px-4 py-2 text-center">
          <p className="text-xs text-gray-400">Total items</p>
          <p className="font-bold text-lg">{wardrobe.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 
          px-4 py-2 text-center">
          <p className="text-xs text-gray-400">Most worn</p>
          <p className="font-bold text-sm truncate max-w-24">
            {wardrobe.length > 0
              ? wardrobe.sort((a,b) => 
                  (b.wearCount||0) - (a.wearCount||0))[0]?.name
              : 'None yet'
            }
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 
          px-4 py-2 text-center">
          <p className="text-xs text-gray-400">Not worn 30d</p>
          <p className="font-bold text-lg">
            {wardrobe.filter(c => {
              if (!c.lastWorn) return true
              const diff = Date.now() - new Date(c.lastWorn).getTime()
              return diff > 30 * 24 * 60 * 60 * 1000
            }).length}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mb-4 bg-red-50 border border-red-100 
          text-red-600 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Wardrobe grid */}
      <div className="px-6 pb-24">
        {filteredWardrobe.length === 0 ? (
          <div className="flex flex-col items-center justify-center 
            py-20 gap-4">
            <p className="text-gray-400 text-lg">
              No clothes yet
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-gray-900 text-white px-6 py-3 
                rounded-xl font-semibold hover:bg-gray-700"
            >
              Add your first cloth
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 
            lg:grid-cols-4 gap-4">
            {filteredWardrobe.map(cloth => (
              <ClothCard
                key={cloth.id}
                cloth={cloth}
                onTryOn={handleTryOn}
                onWorn={handleWorn}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white 
        border-t border-gray-100 flex">
        {[
          { label: 'Home', path: '/home' },
          { label: 'Wardrobe', path: '/wardrobe' },
          { label: 'Wishlist', path: '/wishlist' },
          { label: 'Me', path: '/me' }
        ].map(tab => (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex-1 py-4 text-sm font-medium transition-all ${
              tab.path === '/wardrobe'
                ? 'text-gray-900 border-t-2 border-gray-900'
                : 'text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Upload modal */}
      {showUploadModal && (
        <UploadClothModal
          onClose={() => setShowUploadModal(false)}
          onSave={handleSaveCloth}
        />
      )}

      {/* Try on modal */}
      {showTryOn && selectedCloth && avatarUrl && (
        <TryOnModal
          avatarUrl={avatarUrl}
          selectedCloth={selectedCloth}
          wardrobe={wardrobe}
          onClose={() => {
            setShowTryOn(false)
            setSelectedCloth(null)
          }}
        />
      )}
    </div>
  )
}
