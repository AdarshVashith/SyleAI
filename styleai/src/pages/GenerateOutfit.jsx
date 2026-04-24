import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, getDocs, collection, addDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/firebase'
import { BottomTabNav } from '../components/TabNav'

const OCCASIONS = ['Casual', 'Work', 'Date Night', 'Party', 
                   'Formal', 'Festival', 'Travel', 'Gym', 'Wedding Guest']
const TIMES = ['Morning', 'Afternoon', 'Evening', 'Night']

export default function GenerateOutfit() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3001'
  const navigate = useNavigate()

  // Auth & data
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [wardrobe, setWardrobe] = useState([])
  const [weather, setWeather] = useState(null)

  // Form inputs
  const [occasion, setOccasion] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')
  const [destination, setDestination] = useState('')
  const [vibe, setVibe] = useState('')

  // UI states
  const [screen, setScreen] = useState('form')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [outfitPreviewUrl, setOutfitPreviewUrl] = useState(null)
  const [outfitPreviewLoading, setOutfitPreviewLoading] = useState(false)
  const [outfitPreviewError, setOutfitPreviewError] = useState('')

  // Load user, profile, wardrobe, weather
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) { navigate('/login'); return }
      setUser(firebaseUser)

      try {
        const profileSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
        const profileData = profileSnap.exists() ? profileSnap.data() : {}
        setProfile(profileData)

        const wardrobeSnap = await getDocs(
          collection(db, 'users', firebaseUser.uid, 'wardrobe')
        )
        const items = wardrobeSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        setWardrobe(items)

        if (profileData.city && import.meta.env.VITE_OPENWEATHER_API_KEY) {
          try {
            const wRes = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(profileData.city)}&appid=${import.meta.env.VITE_OPENWEATHER_API_KEY}&units=metric`
            )
            const wData = await wRes.json()
            if (wRes.ok) setWeather(wData)
          } catch (e) { /* weather optional */ }
        }
      } catch (err) {
        console.error(err)
      }
    })
    return () => unsub()
  }, [navigate])

  useEffect(() => {
    const generateOutfitPreview = async () => {
      if (screen !== 'result' || !result?.items?.length || !profile?.avatarUrl) return

      setOutfitPreviewLoading(true)
      setOutfitPreviewError('')
      setOutfitPreviewUrl(null)

      try {
        const res = await fetch(`${BACKEND_URL}/api/generate-outfit-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avatarUrl: profile.avatarUrl,
            items: result.items,
            occasion,
            timeOfDay,
            vibe,
            gender: profile?.gender || ''
          })
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to generate outfit preview')
        }

        setOutfitPreviewUrl(data.imageUrl)
      } catch (previewError) {
        console.error('Outfit preview error:', previewError)
        setOutfitPreviewError(previewError.message || 'Failed to generate outfit preview')
      } finally {
        setOutfitPreviewLoading(false)
      }
    }

    generateOutfitPreview()
  }, [screen, result, profile?.avatarUrl, profile?.gender, occasion, timeOfDay, vibe])

  const handleGenerate = async () => {
    if (!occasion || !timeOfDay) return
    if (wardrobe.length === 0) {
      setError('Your wardrobe is empty. Go to Wardrobe and add some clothes first.')
      return
    }

    setScreen('loading')
    setError(null)
    setResult(null)
    setOutfitPreviewUrl(null)
    setOutfitPreviewError('')

    try {
      const getSkinToneAdvice = (hex) => {
        if (!hex) return 'warm neutral'
        const r = parseInt(hex.slice(1,3), 16)
        const g = parseInt(hex.slice(3,5), 16)
        const b = parseInt(hex.slice(5,7), 16)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        const isWarm = r > b
        if (brightness > 160 && isWarm) {
          return 'light warm skin — earth tones, terracotta, olive, cream work best; avoid neon'
        }
        if (brightness > 160 && !isWarm) {
          return 'light cool skin — blues, lavender, rose, mint work best; avoid orange'
        }
        if (brightness > 100 && isWarm) {
          return 'medium warm skin (wheatish/dusky) — mustard, burgundy, forest green, navy work great; avoid pastels'
        }
        if (brightness > 100 && !isWarm) {
          return 'medium cool skin — teal, cobalt, plum, emerald work great'
        }
        if (isWarm) {
          return 'deep warm skin — bright whites, gold, red, royal blue create great contrast'
        }
        return 'deep cool skin — bright colors, whites, orange, lime create great contrast'
      }

      const normaliseGender = (value) => {
        const raw = String(value || '').toLowerCase().trim()
        if (['male', 'man', 'men', 'boy'].includes(raw)) return 'male'
        if (['female', 'woman', 'women', 'girl'].includes(raw)) return 'female'
        return 'unspecified'
      }

      const sanitizeHairTip = (hairTip, gender) => {
        if (!hairTip) return ''

        const text = String(hairTip).trim()
        if (gender === 'male') {
          return text
            .replace(/ponytail/gi, 'textured style')
            .replace(/hair tie/gi, 'light styling product')
            .replace(/clip your hair back/gi, 'keep the sides neat')
            .replace(/tie your hair back/gi, 'style your hair neatly')
        }

        if (gender === 'female') {
          return text
            .replace(/buzz cut/gi, 'sleek tied-back style')
            .replace(/fade haircut/gi, 'soft face-framing style')
        }

        return text
      }

      const wardrobeText = wardrobe
        .map(c => `- "${c.name}" | Category: ${c.category} | Color: ${c.color || 'unknown'}`)
        .join('\n')

      const weatherText = weather
        ? `Weather: ${Math.round(weather.main?.temp)}°C, ${weather.weather?.[0]?.description}`
        : 'Weather: unknown'

      const skinTone = profile?.skinTone || '#c68642'
      const skinAdvice = getSkinToneAdvice(skinTone)
      const gender = normaliseGender(profile?.gender)
      const genderStyleRule =
        gender === 'male'
          ? 'The user is MALE. Recommendations, outfit naming, styling logic, and hair tips must stay male-focused. Do not mention ponytails, dresses, skirts, handbags, heels, women, or feminine styling.'
          : gender === 'female'
            ? 'The user is FEMALE. Recommendations, outfit naming, styling logic, and hair tips must stay female-focused. Do not mention menswear, beards, fades, or masculine styling unless explicitly requested.'
            : 'Gender is unspecified. Keep styling neutral and avoid gendered assumptions.'

      const occasionCategoryRules = {
        'Home': 'MUST include comfortable items like joggers, sweatpants, casual tees. NO formal items.',
        'Gym': 'MUST include athletic/sportswear. NO jeans, blazers, or formal items.',
        'Casual': 'Use jeans, chinos, casual tees, sneakers. NO formal blazers or oxford shoes.',
        'Work': 'Use formal trousers, oxford shirts, blazers, formal shoes. NO joggers or graphic tees.',
        'Formal': 'Use blazer + formal trousers + formal shoes. NO casual items whatsoever.',
        'Party': 'Use dark jeans or chinos + stylish top + clean sneakers or formal shoes.',
        'Date Night': 'Smart casual — dark jeans, clean shirt, loafers or sneakers. Look put-together.',
        'Festival': 'Casual and fun — denim jacket, cargo pants, sneakers. Bold colors welcome.',
        'Travel': 'Comfortable yet stylish — chinos or jeans, linen shirt, loafers or sneakers.',
        'Wedding Guest': 'Formal — blazer + formal trousers + formal shoes. Must look sharp.'
      }

      const categoryRule = occasionCategoryRules[occasion] ||
        'Pick items appropriate for the occasion.'

      const prompt = `You are an expert personal stylist with deep knowledge of color theory.

STRICT RULES — YOU MUST FOLLOW ALL OF THESE:
1. Select EXACTLY 3 items: 1 Top + 1 Bottom + 1 Shoes (or add Jacket as 4th if appropriate)
2. NEVER pick 2 items from the same category (no 2 Tops, no 2 Bottoms)
3. OCCASION RULE: ${categoryRule}
4. Only select items that exist EXACTLY in the wardrobe list below
5. Use the exact full item name as written in the wardrobe list
6. ${genderStyleRule}
7. Hair tip must match the user's gender presentation and must never reference the opposite gender

USER DETAILS:
- Skin tone: ${skinTone} — ${skinAdvice}
- Gender: ${gender}
- Body type: ${profile?.bodyType || 'average'}
- Age: ${profile?.age || 'young adult'}
- ${weatherText}

USER REQUEST:
- Occasion: ${occasion}
- Time of day: ${timeOfDay}
- Going to: ${destination || 'not specified'}
- Vibe: ${vibe || 'everyday comfortable look'}

WARDROBE (only these items exist — use EXACT names):
${wardrobe.map((c, i) =>
  `${i + 1}. "${c.name}" | ${c.category} | Color: ${c.color} | Best for: ${c.occasion || 'general'}`
).join('\n')}

COLOR THEORY TASK:
The user has ${skinAdvice}.
Look at the colors available in the wardrobe and pick a combination where:
- Colors complement each other (analogous or neutral + accent rule)
- The overall palette flatters skin tone ${skinTone}
- The combination matches the ${occasion} occasion
- Consider the weather: ${weatherText}

Example good combinations for this skin tone:
${skinAdvice.includes('warm')
  ? '- Navy blue jeans + White shirt + Brown loafers (classic, warm-skin friendly)\n- Olive pants + Grey tee + White sneakers (earthy, suits warm tones)\n- Beige chinos + Light blue shirt + Brown shoes (warm neutral harmony)'
  : '- Dark blue jeans + Light blue shirt + White sneakers (cool tone harmony)\n- Black trousers + White shirt + Black shoes (high contrast, suits cool tones)\n- Grey pants + Navy tee + White sneakers (cool neutral palette)'
}

Return ONLY this JSON (no markdown, no extra text):
{
  "outfitName": "Creative 2-4 word outfit name related to the occasion and vibe",
  "styleScore": <number 72-96>,
  "selectedItems": [
    "exact wardrobe item name 1",
    "exact wardrobe item name 2", 
    "exact wardrobe item name 3"
  ],
  "whyThisWorks": "2-3 sentences: explain WHY these specific colors work together for ${skinAdvice}. Mention the specific color combination (e.g. navy + beige + brown) and the occasion.",
  "colorHarmony": "One sentence about the color palette and how it complements skin tone ${skinTone}.",
  "hairTip": "One specific, practical ${gender === 'male' ? 'male grooming / hairstyle' : gender === 'female' ? 'female hairstyle / grooming' : 'gender-neutral grooming'} tip for ${occasion} at ${timeOfDay}.",
  "colorPalette": ["#hex of item 1 color", "#hex of item 2 color", "#hex of item 3 color"]
}`

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are a professional fashion stylist. Always respond with only valid JSON. No markdown. No explanation outside JSON.'
            },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 600,
          temperature: 0.7
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error?.message || 'Groq API failed')
      }

      const data = await res.json()
      const parsed = JSON.parse(data.choices[0].message.content)

      const matchedItems = (parsed.selectedItems || []).map(selectedName => {
        const normalise = s => s.toLowerCase().trim()
          .replace(/[^a-z0-9 ]/g, '')

        let found = wardrobe.find(w =>
          normalise(w.name) === normalise(selectedName)
        )

        if (!found) {
          found = wardrobe.find(w =>
            normalise(w.name).includes(normalise(selectedName)) ||
            normalise(selectedName).includes(normalise(w.name))
          )
        }

        if (!found) {
          const selectedWords = normalise(selectedName).split(' ')
            .filter(w => w.length > 2)
          found = wardrobe.find(w => {
            const wardrobeWords = normalise(w.name).split(' ')
              .filter(x => x.length > 2)
            const overlap = selectedWords.filter(sw =>
              wardrobeWords.some(ww => ww.includes(sw) || sw.includes(ww))
            )
            return overlap.length >= 2
          })
        }

        return found || {
          name: selectedName,
          category: 'Item',
          color: 'Unknown',
          imageUrl: null,
          brand: ''
        }
      })

      const seen = new Set()
      const dedupedItems = matchedItems.filter(item => {
        const key = item.id || item.name
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      const outfitResult = {
        ...parsed,
        hairTip: sanitizeHairTip(parsed.hairTip, gender),
        items: dedupedItems
      }
      setResult(outfitResult)
      setScreen('result')

      if (user) {
        await addDoc(collection(db, 'users', user.uid, 'outfits'), {
          ...outfitResult,
          occasion, timeOfDay, destination, vibe,
          generatedAt: new Date().toISOString()
        }).catch(console.error)
      }

    } catch (err) {
      console.error('Generate error:', err)
      setError(err.message || 'Failed to generate outfit. Try again.')
      setScreen('form')
    }
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-8">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-gray-200 border-t-black rounded-full animate-spin"/>
          <div className="absolute inset-0 flex items-center justify-center text-2xl">✦</div>
        </div>
        <div className="text-center">
          <p className="font-bold text-xl mb-1">Styling your look...</p>
          <p className="text-gray-400 text-sm">
            Matching your wardrobe to your vibe
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-4 text-center max-w-xs">
          <p className="text-xs text-gray-400 mb-2">Analysing</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[occasion, timeOfDay, weather ? `${Math.round(weather.main?.temp)}°C` : null, profile?.skinTone]
              .filter(Boolean)
              .map((tag, i) => (
                <span key={i} className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'result' && result) {
    return (
      <main className="min-h-screen bg-gray-50 pb-28">
        <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => setScreen('form')} className="text-gray-400 text-xl">←</button>
          <h1 className="font-bold text-lg flex-1">Your Outfit</h1>
          <span className="bg-black text-white text-xs px-3 py-1.5 rounded-full font-semibold">
            {result.styleScore}% Style Score
          </span>
        </div>

        <div className="px-4 pt-4 space-y-4">
          <div className="text-center py-2">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
              {occasion} · {timeOfDay}
            </p>
            <h2 className="text-2xl font-bold">{result.outfitName}</h2>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Outfit On Your Avatar
            </p>
            <div className="rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 min-h-[280px] flex items-center justify-center">
              {outfitPreviewLoading ? (
                <div className="py-16 text-center">
                  <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-3"/>
                  <p className="text-sm font-semibold text-gray-700">
                    Applying full outfit to your 2D avatar...
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Gemini is combining your top, bottom, and shoes
                  </p>
                </div>
              ) : outfitPreviewUrl ? (
                <img
                  src={outfitPreviewUrl}
                  alt="Outfit preview on avatar"
                  className="w-full object-contain"
                  style={{ maxHeight: '560px' }}
                />
              ) : (
                <div className="px-6 py-12 text-center">
                  <div className="text-4xl mb-3">🧍</div>
                  <p className="text-sm font-semibold text-gray-700">
                    Preview unavailable
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {outfitPreviewError || 'Could not generate the outfit preview right now.'}
                  </p>
                </div>
              )}
            </div>
            {outfitPreviewError ? (
              <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                {outfitPreviewError}
              </div>
            ) : null}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: result.items.length >= 3
              ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
            gap: '10px'
          }}>
            {result.items.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full object-cover"
                    style={{ height: result.items.length >= 3 ? '160px' : '200px' }}
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full bg-gray-100 flex items-center justify-center text-3xl" style={{ height: '140px' }}>
                    👕
                  </div>
                )}
                <div className="p-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span style={{
                      fontSize: '9px', fontWeight: '600', letterSpacing: '0.08em',
                      textTransform: 'uppercase', padding: '1px 6px', borderRadius: '4px',
                      background: item.category === 'Top' ? '#dbeafe' :
                                  item.category === 'Bottom' ? '#dcfce7' :
                                  item.category === 'Shoes' ? '#fef3c7' :
                                  item.category === 'Jacket' ? '#f3e8ff' : '#f3f4f6',
                      color: item.category === 'Top' ? '#1d4ed8' :
                             item.category === 'Bottom' ? '#15803d' :
                             item.category === 'Shoes' ? '#b45309' :
                             item.category === 'Jacket' ? '#7e22ce' : '#374151'
                    }}>
                      {item.category}
                    </span>
                  </div>
                  <p className="font-semibold text-xs leading-tight">{item.name}</p>
                  <p className="text-gray-400 text-xs">{item.brand}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                    {item.color}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-2">✎ Why This Works</p>
            <p className="text-gray-700 text-sm leading-relaxed">
              {result.whyThisWorks}
            </p>
          </div>

          {result.colorHarmony && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Color Harmony</p>
              <p className="text-gray-700 text-sm leading-relaxed">
                {result.colorHarmony}
              </p>
              {result.colorPalette?.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {result.colorPalette.map((hex, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className="w-8 h-8 rounded-full border border-gray-200"
                        style={{ backgroundColor: hex }}
                      />
                      <span className="text-gray-400 text-xs">{hex}</span>
                    </div>
                  ))}
                  <div className="flex flex-col items-center gap-1 ml-2 pl-2 border-l border-gray-100">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300"
                      style={{ backgroundColor: profile?.skinTone || '#c68642' }}
                    />
                    <span className="text-gray-400 text-xs">Skin</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {result.hairTip && (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-green-600 mb-1">
                💇 Hair Tip
              </p>
              <p className="text-green-800 text-sm leading-relaxed">
                {result.hairTip}
              </p>
            </div>
          )}

          <div className="bg-gray-900 rounded-2xl p-4 text-white">
            <div className="flex flex-wrap gap-2">
              <span className="bg-white/10 text-xs px-3 py-1 rounded-full">
                {occasion}
              </span>
              <span className="bg-white/10 text-xs px-3 py-1 rounded-full">
                {timeOfDay}
              </span>
              {destination && (
                <span className="bg-white/10 text-xs px-3 py-1 rounded-full">
                  📍 {destination}
                </span>
              )}
              {weather && (
                <span className="bg-white/10 text-xs px-3 py-1 rounded-full">
                  🌡 {Math.round(weather.main?.temp)}°C
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3 pb-4">
            <button
              onClick={() => {
                setResult(null)
                setScreen('form')
                setOccasion('')
                setTimeOfDay('')
                setDestination('')
                setVibe('')
              }}
              className="flex-1 border border-gray-200 py-3.5 rounded-2xl text-sm font-semibold text-gray-700"
            >
              ✦ Generate Another
            </button>
            <button
              onClick={() => navigate('/home')}
              className="flex-1 bg-black text-white py-3.5 rounded-2xl text-sm font-semibold"
            >
              Home
            </button>
          </div>
        </div>
        <BottomTabNav />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      <div className="px-4 pt-6 pb-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 text-xl">
          ←
        </button>
      </div>

      <div className="px-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            What's the vibe today?
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Answer in 30 seconds or less.
          </p>
          {wardrobe.length > 0 && (
            <p className="text-xs text-teal-600 font-medium mt-2">
              ✓ {wardrobe.length} items in your wardrobe ready to style
            </p>
          )}
          {wardrobe.length === 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mt-2">
              <p className="text-orange-700 text-xs font-medium">
                ⚠ Your wardrobe is empty. 
                <button onClick={() => navigate('/wardrobe')} className="underline ml-1">
                  Add clothes first →
                </button>
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Occasion <span className="text-red-400">*</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map(occ => (
              <button
                key={occ}
                onClick={() => setOccasion(occ)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: occasion === occ ? '1.5px solid #111827' : '1.5px solid #e5e7eb',
                  background: occasion === occ ? '#111827' : '#ffffff',
                  color: occasion === occ ? '#ffffff' : '#4b5563',
                  cursor: 'pointer'
                }}
              >
                {occ}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Time of Day <span className="text-red-400">*</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {TIMES.map(t => (
              <button
                key={t}
                onClick={() => setTimeOfDay(t)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: timeOfDay === t ? '1.5px solid #111827' : '1.5px solid #e5e7eb',
                  background: timeOfDay === t ? '#111827' : '#ffffff',
                  color: timeOfDay === t ? '#ffffff' : '#4b5563',
                  cursor: 'pointer'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Where Are You Headed?
          </p>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. college, at home, mall, restaurant"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Write Whatever You Feel
          </p>
          <textarea
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="e.g. 'First date, want to look confident', 'Keep it dark and minimal', 'Something breathable for the heat'"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
          />
        </div>

        {profile?.skinTone && (
          <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
            <div
              className="w-8 h-8 rounded-full border border-gray-200 flex-shrink-0"
              style={{ backgroundColor: profile.skinTone }}
            />
            <div>
              <p className="text-xs font-semibold text-gray-700">
                Skin tone matched
              </p>
              <p className="text-xs text-gray-400">
                AI will pick colors that complement {profile.skinTone}
              </p>
            </div>
          </div>
        )}

        {weather && (
          <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
            <span className="text-2xl">
              {weather.weather?.[0]?.main === 'Rain' ? '🌧' :
               weather.weather?.[0]?.main === 'Clear' ? '☀️' :
               weather.weather?.[0]?.main === 'Clouds' ? '☁️' : '🌤'}
            </span>
            <div>
              <p className="text-xs font-semibold text-gray-700">
                {Math.round(weather.main?.temp)}°C · {weather.name}
              </p>
              <p className="text-xs text-gray-400 capitalize">
                {weather.weather?.[0]?.description} — outfit will be weather-aware
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-4 z-40">
        <button
          onClick={handleGenerate}
          disabled={!occasion || !timeOfDay || wardrobe.length === 0}
          style={{
            width: '100%',
            padding: '18px',
            borderRadius: '20px',
            background: (!occasion || !timeOfDay || wardrobe.length === 0)
              ? '#9ca3af' : '#111827',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: '700',
            border: 'none',
            cursor: (!occasion || !timeOfDay || wardrobe.length === 0)
              ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            letterSpacing: '0.02em'
          }}
        >
          ✦ Generate Look
        </button>
        {(!occasion || !timeOfDay) && (
          <p className="text-center text-xs text-gray-400 mt-2">
            Select occasion and time of day to continue
          </p>
        )}
      </div>

      <BottomTabNav />
    </main>
  )
}
