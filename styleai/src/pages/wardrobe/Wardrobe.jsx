import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { 
  doc, getDoc, collection, 
  getDocs, addDoc, deleteDoc, updateDoc 
} from 'firebase/firestore'
import { db, auth } from '../../firebase/firebase'
import { useNavigate } from 'react-router-dom'
import ClothCard from './components/ClothCard'
import UploadClothModal from './components/UploadClothModal'
import TryOnModal from './components/TryOnModal'
import { BottomTabNav } from '../../components/TabNav'

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
  const [seedingLoading, setSeedingLoading] = useState(false)

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

  const seedWardrobe = async () => {
    setSeedingLoading(true)
    try {
      setFilterCategory('All')
      setError(null)
      const existing = await getDocs(
        collection(db, 'users', user.uid, 'wardrobe')
      )
      const deletePromises = existing.docs.map(d =>
        deleteDoc(doc(db, 'users', user.uid, 'wardrobe', d.id))
      )
      await Promise.all(deletePromises)
      setWardrobe([])

      const sampleClothes = [
        {
          name: 'Classic White Oxford Shirt',
          category: 'Top',
          color: 'White',
          occasion: 'Formal, Work',
          brand: 'Uniqlo',
          imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Navy Blue Casual T-Shirt',
          category: 'Top',
          color: 'Navy Blue',
          occasion: 'Casual, Travel',
          brand: 'H&M',
          imageUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Grey Melange Round Neck Tee',
          category: 'Top',
          color: 'Grey',
          occasion: 'Casual, Home, Gym',
          brand: 'Puma',
          imageUrl: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Black Graphic Print T-Shirt',
          category: 'Top',
          color: 'Black',
          occasion: 'Casual, Party, Date Night',
          brand: 'Zara',
          imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Light Blue Linen Shirt',
          category: 'Top',
          color: 'Light Blue',
          occasion: 'Casual, Travel, Date Night',
          brand: 'Marks & Spencer',
          imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Dark Blue Slim Fit Jeans',
          category: 'Bottom',
          color: 'Dark Blue',
          occasion: 'Casual, Date Night, Travel',
          brand: "Levi's 511",
          imageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Beige Slim Chino Pants',
          category: 'Bottom',
          color: 'Beige',
          occasion: 'Work, Formal, Casual',
          brand: 'Gap',
          imageUrl: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Olive Green Cargo Pants',
          category: 'Bottom',
          color: 'Olive Green',
          occasion: 'Casual, Travel, Festival',
          brand: 'H&M',
          imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Black Formal Trousers',
          category: 'Bottom',
          color: 'Black',
          occasion: 'Formal, Work, Party',
          brand: 'Raymond',
          imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Grey Jogger Sweatpants',
          category: 'Bottom',
          color: 'Grey',
          occasion: 'Home, Gym, Casual',
          brand: 'Nike',
          imageUrl: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Black Slim Fit Blazer',
          category: 'Jacket',
          color: 'Black',
          occasion: 'Formal, Work, Party, Date Night',
          brand: 'Zara',
          imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Light Blue Denim Jacket',
          category: 'Jacket',
          color: 'Light Blue',
          occasion: 'Casual, Travel, Festival',
          brand: "Levi's",
          imageUrl: 'https://images.unsplash.com/photo-1601333144130-8cbb312386b6?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'White Leather Sneakers',
          category: 'Shoes',
          color: 'White',
          occasion: 'Casual, Date Night, Travel',
          brand: 'Nike Air Force',
          imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Black Oxford Formal Shoes',
          category: 'Shoes',
          color: 'Black',
          occasion: 'Formal, Work, Party',
          brand: 'Clarks',
          imageUrl: 'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        },
        {
          name: 'Brown Casual Loafers',
          category: 'Shoes',
          color: 'Brown',
          occasion: 'Casual, Work, Date Night',
          brand: 'Hush Puppies',
          imageUrl: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400&fit=crop',
          wearCount: 0, wearHistory: [], addedAt: new Date().toISOString()
        }
      ]

      const addPromises = sampleClothes.map(async (cloth) => {
        const docRef = await addDoc(
          collection(db, 'users', user.uid, 'wardrobe'),
          cloth
        )
        return { id: docRef.id, ...cloth }
      })

      const newItems = await Promise.all(addPromises)
      await fetchData()
      alert(`✓ Added ${newItems.length} clothes to your wardrobe!`)
    } catch (err) {
      setError('Seed failed: ' + err.message)
      console.error(err)
    } finally {
      setSeedingLoading(false)
    }
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
        <div className="flex gap-2">
          <button
            onClick={seedWardrobe}
            disabled={seedingLoading || !user}
            className="border border-gray-200 bg-white text-gray-700 px-4 py-2 
              rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            {seedingLoading ? 'Loading...' : '✦ Load samples'}
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-gray-900 text-white px-4 py-2 
              rounded-xl text-sm font-semibold 
              hover:bg-gray-700 transition-all"
          >
            + Add cloth
          </button>
        </div>
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

      {wardrobe.length > 0 && wardrobe.length < 15 && (
        <div className="mx-6 mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          Sample wardrobe not fully loaded yet. Use `✦ Load samples` to replace the current items with the full sample wardrobe.
        </div>
      )}

      {/* Wardrobe grid */}
      <div className="px-6 pb-24">
        {filteredWardrobe.length === 0 ? (
          wardrobe.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="text-6xl">👕</div>
              <p className="text-gray-600 font-semibold text-lg">Your wardrobe is empty</p>
              <p className="text-gray-400 text-sm text-center px-8">
                Add clothes manually or load sample items to get started
              </p>
              <button
                onClick={seedWardrobe}
                disabled={seedingLoading}
                className="bg-black text-white px-8 py-3 rounded-2xl font-semibold text-sm disabled:opacity-50"
              >
                {seedingLoading ? 'Adding samples...' : '✦ Load Sample Wardrobe'}
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="border border-gray-200 text-gray-700 px-8 py-3 rounded-2xl font-semibold text-sm"
              >
                + Add My Own Clothes
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <p className="text-gray-400 text-lg">
                No clothes yet
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-700"
              >
                Add your first cloth
              </button>
            </div>
          )
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

      <BottomTabNav />

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
