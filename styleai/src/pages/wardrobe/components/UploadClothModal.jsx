import { useState } from 'react'
import { uploadToCloudinary } from '../../../utils/cloudinary'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3001'

export default function UploadClothModal({ onClose, onSave }) {
  const [step, setStep] = useState('upload')
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [selectedResult, setSelectedResult] = useState(null)
  const [removedBgUrl, setRemovedBgUrl] = useState(null)
  const [clothName, setClothName] = useState('')
  const [clothCategory, setClothCategory] = useState('Top')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const categories = [
    'Top', 'Bottom', 'Dress', 'Jacket', 
    'Shoes', 'Accessory', 'Suit', 'Sportswear'
  ]

  // Step 1 — Upload photo to Cloudinary first
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setLoading(true)
    setError(null)
    
    try {
      const url = await uploadToCloudinary(file, 'styleai/cloth-search')
      setUploadedImageUrl(url)
      console.log('Cloth photo uploaded:', url)
      
      // Step 2 — Run visual search
      await runVisualSearch(url)
      
    } catch (err) {
      setError('Upload failed: ' + err.message)
      setLoading(false)
    }
  }

  // Step 2 — Visual search with Google Lens
  const runVisualSearch = async (imageUrl) => {
    try {
      setStep('searching')
      
      const response = await fetch(
        `${BACKEND_URL}/api/visual-search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl })
        }
      )
      
      const data = await response.json()
      
      if (!data.success) throw new Error(data.error)
      
      setSearchResults(data.results)
      setStep('select')
      setLoading(false)
      
    } catch (err) {
      setError('Visual search failed: ' + err.message)
      setLoading(false)
      setStep('upload')
    }
  }

  // Step 3 — Remove background from selected image
  const handleSelectResult = async (result) => {
    setSelectedResult(result)
    setLoading(true)
    setError(null)
    setStep('removing-bg')
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/remove-bg`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: result.imageUrl })
        }
      )
      
      const data = await response.json()
      
      if (!data.success) throw new Error(data.error)
      
      if (data.fallback) {
        console.log('Using original image - bg removal unavailable')
        setRemovedBgUrl(result.imageUrl)
      } else {
        const cloudinaryUrl = await uploadToCloudinary(
          data.dataUrl,
          'styleai/wardrobe'
        )
        setRemovedBgUrl(cloudinaryUrl)
      }
      setStep('details')
      setLoading(false)
      
    } catch (err) {
      setError('Background removal failed: ' + err.message)
      setLoading(false)
      setStep('select')
    }
  }

  // Step 4 — Save to Firestore
  const handleSave = () => {
    if (!clothName.trim()) {
      setError('Please enter a name for this cloth')
      return
    }
    
    onSave({
      name: clothName,
      category: clothCategory,
      imageUrl: removedBgUrl,
      originalImageUrl: uploadedImageUrl,
      wearCount: 0,
      wearHistory: [],
      addedAt: new Date().toISOString(),
      lastWorn: null
    })
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg 
        mx-4 max-h-screen overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Add new cloth</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            x
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 
            rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Step 1 — Upload */}
        {step === 'upload' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-full h-48 border-2 border-dashed 
              border-gray-200 rounded-2xl flex flex-col items-center 
              justify-center gap-3 cursor-pointer hover:border-gray-400
              transition-all"
              onClick={() => document.getElementById('cloth-upload').click()}
            >
              <p className="text-gray-400 text-sm">
                Click to upload a photo of your cloth
              </p>
              <p className="text-gray-300 text-xs">
                JPG, PNG up to 10MB
              </p>
            </div>
            <input
              id="cloth-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
        )}

        {/* Step 2 — Searching */}
        {step === 'searching' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-10 h-10 border-4 border-gray-200 
              border-t-orange-400 rounded-full animate-spin"/>
            <p className="text-gray-500">
              Finding similar items...
            </p>
          </div>
        )}

        {/* Step 3 — Select result */}
        {step === 'select' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Select the best matching image for your cloth:
            </p>
            <div className="grid grid-cols-3 gap-3">
              {searchResults.map((result, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectResult(result)}
                  className="cursor-pointer rounded-xl overflow-hidden 
                    border-2 border-transparent hover:border-orange-400 
                    transition-all"
                >
                  <img
                    src={result.imageUrl}
                    alt={result.title}
                    className="w-full h-32 object-cover"
                  />
                  <p className="text-xs text-gray-500 p-1 truncate">
                    {result.title}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep('upload')}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600"
            >
              Upload different photo
            </button>
          </div>
        )}

        {/* Step 4 — Removing BG */}
        {step === 'removing-bg' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-10 h-10 border-4 border-gray-200 
              border-t-teal-500 rounded-full animate-spin"/>
            <p className="text-gray-500">
              Removing background...
            </p>
          </div>
        )}

        {/* Step 5 — Enter details */}
        {step === 'details' && (
          <div className="flex flex-col gap-4">
            {removedBgUrl && (
              <div className="flex justify-center">
                <img
                  src={removedBgUrl}
                  alt="Cloth preview"
                  className="h-48 object-contain bg-gray-50 
                    rounded-xl p-2"
                />
              </div>
            )}
            
            <div>
              <label className="text-sm text-gray-500 mb-1 block">
                Cloth name
              </label>
              <input
                type="text"
                value={clothName}
                onChange={e => setClothName(e.target.value)}
                placeholder="e.g. White casual shirt"
                className="w-full border border-gray-200 rounded-xl 
                  px-4 py-2 text-sm focus:outline-none 
                  focus:border-gray-400"
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-500 mb-1 block">
                Category
              </label>
              <select
                value={clothCategory}
                onChange={e => setClothCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-xl 
                  px-4 py-2 text-sm focus:outline-none 
                  focus:border-gray-400"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleSave}
              className="w-full py-3 rounded-xl bg-gray-900 
                text-white font-semibold hover:bg-gray-700 
                transition-all"
            >
              Save to wardrobe
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
