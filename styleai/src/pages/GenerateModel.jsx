import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, auth } from '../firebase/firebase'
import { useNavigate } from 'react-router-dom'
import { uploadToCloudinary } from '../utils/cloudinary'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3001'

export default function GenerateModel() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarBase64, setAvatarBase64] = useState(null)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('loading')
  const [loadingMessage, setLoadingMessage] = useState(
    'Creating your avatar... this takes 60-90 seconds'
  )

  // Wait for Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.log('User confirmed:', firebaseUser.uid)
        setUser(firebaseUser)
      } else {
        console.log('No user, redirecting to login')
        navigate('/login')
      }
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [navigate])

  // Fetch profile after user confirmed
  useEffect(() => {
    if (!user) return
    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (!userDoc.exists()) {
          throw new Error('Profile not found. Please complete onboarding first.')
        }
        const data = userDoc.data()
        console.log('Profile loaded:', data)

        if (!data.facePhotoUrl) {
          throw new Error('Face photo not found. Please redo face scan.')
        }

        setProfile({
          gender: data.gender || 'person',
          bodyType: data.bodyType || 'average',
          height: data.height || '170',
          weight: data.weight || '65',
          age: data.age || '20',
          skinTone: data.skinTone || '#f5c5a3',
          faceShape: data.faceShape || 'Oval',
          facePhotoUrl: data.facePhotoUrl
        })
        setProfileLoading(false)
        setStep('ready')
      } catch (err) {
        console.error('Profile error:', err)
        setError(err.message)
        setProfileLoading(false)
      }
    }
    fetchProfile()
  }, [user])

  const generateAvatar = async () => {
    setError(null)
    setGenerating(true)
    setStep('generating')
    setAvatarUrl(null)
    setLoadingMessage('Starting generation...')

    try {
      console.log('Sending request to backend...')
      setLoadingMessage('Sending your photo to AI...')

      const response = await fetch(
        `${BACKEND_URL}/api/generate-avatar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facePhotoUrl: profile.facePhotoUrl,
            gender: profile.gender,
            bodyType: profile.bodyType,
            height: profile.height,
            age: profile.age
          })
        }
      )

      setLoadingMessage('AI is generating your avatar... please wait')

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Generation failed')
      }

      const imageDataUrl = `data:image/jpeg;base64,${data.base64}`
      setAvatarUrl(imageDataUrl)
      setAvatarBase64(imageDataUrl)
      setGenerating(false)
      setStep('confirm')
      console.log('Avatar ready!')
    } catch (err) {
      console.error('Generation error:', err)
      setError(err.message)
      setGenerating(false)
      setStep('ready')
    }
  }

  const confirmAvatar = async () => {
    setUploading(true)
    setStep('uploading')

    try {
      // Upload to Cloudinary
      const cloudinaryUrl = await uploadToCloudinary(
        avatarBase64,
        'styleai/avatars'
      )
      console.log('Avatar uploaded to Cloudinary:', cloudinaryUrl)

      // Save URL to Firestore
      await setDoc(
        doc(db, 'users', user.uid),
        {
          avatarUrl: cloudinaryUrl,
          avatarGeneratedAt: new Date().toISOString()
        },
        { merge: true }
      )

      console.log('Avatar URL saved to Firestore')
      setStep('done')
      setTimeout(() => navigate('/home'), 2000)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message)
      setUploading(false)
      setStep('confirm')
    }
  }

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-gray-200 
            border-t-orange-400 rounded-full animate-spin"/>
          <p className="text-gray-500 text-sm">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col 
      items-center justify-center p-8">
      <div className="max-w-2xl w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs text-teal-600 font-semibold 
            tracking-widest mb-2">ALMOST DONE</p>
          <h1 className="text-4xl font-bold mb-2">Your AI avatar</h1>
          <p className="text-gray-400 text-sm">
            We generate a realistic full body avatar using 
            your face photo and body details
          </p>
        </div>

        {/* Profile summary */}
        {profile && (
          <div className="bg-white rounded-2xl border border-gray-100 
            p-4 mb-6 flex flex-wrap gap-2 justify-center">
            {[
              { label: 'Gender', value: profile.gender },
              { label: 'Body type', value: profile.bodyType },
              { label: 'Height', value: profile.height + ' cm' },
              { label: 'Weight', value: profile.weight + ' kg' },
              { label: 'Age', value: profile.age },
              { label: 'Face shape', value: profile.faceShape },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl 
                px-4 py-2 text-center min-w-fit">
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className="font-semibold text-sm capitalize">
                  {item.value}
                </p>
              </div>
            ))}
            <div className="bg-gray-50 rounded-xl px-4 py-2 
              flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full border border-gray-200"
                style={{ backgroundColor: profile.skinTone }}
              />
              <div>
                <p className="text-xs text-gray-400">Skin tone</p>
                <p className="font-mono text-xs">{profile.skinTone}</p>
              </div>
            </div>
          </div>
        )}

        {/* Face photo preview */}
        {profile?.facePhotoUrl && (
          <div className="bg-white rounded-2xl border border-gray-100 
            p-4 mb-6 flex items-center gap-4">
            <img
              src={profile.facePhotoUrl}
              alt="Your face"
              className="w-16 h-16 rounded-full object-cover 
                border-2 border-orange-200"
            />
            <div>
              <p className="font-semibold text-sm">Face reference ready</p>
              <p className="text-gray-400 text-xs">
                AI will use this photo to generate your avatar
              </p>
            </div>
            <div className="ml-auto w-3 h-3 bg-green-400 rounded-full"/>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 
            text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Generating state */}
        {generating && (
          <div className="bg-white rounded-2xl border border-gray-100 
            p-12 flex flex-col items-center gap-6 mb-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-gray-100 
                border-t-orange-400 rounded-full animate-spin"/>
              <div className="absolute inset-0 flex items-center 
                justify-center text-2xl">
                AI
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg mb-1">
                {loadingMessage}
              </p>
              <p className="text-gray-400 text-sm">
                Flux Kontext Pro is analyzing your face and 
                generating your avatar
              </p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-orange-400 h-1.5 rounded-full 
                animate-pulse" style={{ width: '70%' }}/>
            </div>
            <p className="text-xs text-gray-400">
              Please do not close this page
            </p>
          </div>
        )}

        {/* Avatar result */}
        {avatarUrl && step === 'confirm' && (
          <div className="bg-white rounded-2xl border border-gray-100 
            p-6 flex flex-col items-center gap-6 mb-6">
            <img
              src={avatarUrl}
              alt="Your AI avatar"
              className="w-72 h-96 object-contain rounded-xl 
                bg-gray-50 border border-gray-100"
            />
            <div className="text-center">
              <p className="font-semibold text-lg mb-1">
                Does this look right?
              </p>
              <p className="text-gray-400 text-sm">
                If not happy, regenerate for a different result
              </p>
            </div>
            <div className="flex gap-4 w-full">
              <button
                onClick={generateAvatar}
                className="flex-1 py-3 rounded-xl border border-gray-200
                  font-semibold text-gray-600 hover:bg-gray-50 
                  transition-all text-sm"
              >
                Regenerate
              </button>
              <button
                onClick={confirmAvatar}
                className="flex-1 py-3 rounded-xl bg-gray-900 
                  text-white font-semibold hover:bg-gray-700 
                  transition-all text-sm"
              >
                Yes, use this avatar
              </button>
            </div>
          </div>
        )}

        {/* Uploading state */}
        {step === 'uploading' && (
          <div className="bg-white rounded-2xl border border-gray-100 
            p-8 flex flex-col items-center gap-4 mb-6">
            <div className="w-10 h-10 border-4 border-gray-200 
              border-t-teal-500 rounded-full animate-spin"/>
            <p className="font-semibold">Saving your avatar...</p>
            <p className="text-gray-400 text-sm">Just a moment</p>
          </div>
        )}

        {/* Done state */}
        {step === 'done' && (
          <div className="bg-green-50 border border-green-100 
            rounded-2xl p-8 flex flex-col items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-green-500 rounded-full 
              flex items-center justify-center text-white text-2xl 
              font-bold">
              ✓
            </div>
            <p className="font-semibold text-green-800 text-lg">
              Avatar saved successfully
            </p>
            <p className="text-green-600 text-sm">
              Redirecting to your home page...
            </p>
          </div>
        )}

        {/* Generate button */}
        {step === 'ready' && !profileLoading && (
          <button
            onClick={generateAvatar}
            className="w-full py-4 rounded-2xl bg-gray-900 
              text-white font-semibold text-lg 
              hover:bg-gray-700 transition-all"
          >
            Generate my avatar
          </button>
        )}

        {/* Profile loading */}
        {profileLoading && !error && (
          <div className="flex items-center justify-center gap-3 
            text-gray-400 py-8">
            <div className="w-5 h-5 border-2 border-gray-300 
              border-t-gray-600 rounded-full animate-spin"/>
            <span className="text-sm">Loading your profile...</span>
          </div>
        )}

      </div>
    </div>
  )
}
