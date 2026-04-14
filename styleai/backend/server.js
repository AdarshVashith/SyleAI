const express = require('express')
const fetch = require('node-fetch')
const FormData = require('form-data')
let gradioClientPromise = null
require('dotenv').config({ 
  path: require('path').resolve(__dirname, '.env') 
})
console.log('SERPAPI_KEY value:', 
  process.env.SERPAPI_KEY 
    ? process.env.SERPAPI_KEY.substring(0, 10) + '...' 
    : 'NOT FOUND'
)
console.log('REMOVEBG_API_KEY value:', 
  process.env.REMOVEBG_API_KEY 
    ? process.env.REMOVEBG_API_KEY.substring(0, 5) + '...' 
    : 'NOT FOUND'
)
console.log('.env file path:', require('path').resolve('.env'))
console.log('Keys loaded:')
console.log('SERPAPI_KEY:', process.env.SERPAPI_KEY ? 'SET' : 'MISSING')
console.log('REMOVEBG_API_KEY:', process.env.REMOVEBG_API_KEY ? 'SET' : 'MISSING')
console.log('REPLICATE_API_KEY:', process.env.REPLICATE_API_KEY ? 'SET' : 'MISSING')

const app = express()

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 
    'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 
    'Content-Type, Authorization, Accept')
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  next()
})

app.use(express.json({ limit: '50mb' }))

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Backend running', 
    endpoints: [
      '/api/generate-avatar',
      '/api/try-on',
      '/api/visual-search', 
      '/api/remove-bg'
    ]
  })
})

async function waitForReplicatePrediction(predictionId) {
  let attempts = 0

  while (attempts < 60) {
    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.REPLICATE_API_KEY}`
        }
      }
    )

    if (!pollRes.ok) {
      const errData = await pollRes.json()
      throw new Error(errData.detail || errData.error || JSON.stringify(errData))
    }

    const result = await pollRes.json()
    console.log(`Poll ${attempts + 1}: ${result.status}`)

    if (result.status === 'succeeded' || result.status === 'failed') {
      return result
    }

    attempts += 1
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  throw new Error('Replicate prediction timed out')
}

async function getKolorsTryOnClient() {
  if (!gradioClientPromise) {
    gradioClientPromise = import('@gradio/client').then(async module => {
      return module.Client.connect('Kwai-Kolors/Kolors-Virtual-Try-On')
    })
  }

  return gradioClientPromise
}

// ENDPOINT 1 — Generate avatar with Replicate Flux
app.post('/api/generate-avatar', async (req, res) => {
  try {
    const { facePhotoUrl, gender, bodyType, height, age } = req.body

    console.log('=== Generate Avatar ===')
    console.log({ gender, bodyType, height, age, facePhotoUrl })

    if (!facePhotoUrl) {
      throw new Error('No face photo URL provided')
    }

    const prompt = `Full body photo of this exact person,
      ${gender}, ${bodyType} body build,
      ${height}cm tall, ${age} years old,
      standing straight facing forward,
      hands relaxed at sides,
      wearing casual modern outfit,
      plain white background,
      fashion lookbook photography,
      full body visible from head to toe,
      high quality sharp professional photo,
      studio lighting`

    const startResponse = await fetch(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REPLICATE_API_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: JSON.stringify({
          input: {
            prompt: prompt,
            input_image: facePhotoUrl,
            output_format: 'jpg',
            output_quality: 90,
            safety_tolerance: 2,
            prompt_upsampling: true
          }
        })
      }
    )

    if (!startResponse.ok) {
      const errData = await startResponse.json()
      throw new Error(errData.detail || errData.error || JSON.stringify(errData))
    }

    let result = await startResponse.json()
    console.log('Prediction ID:', result.id)

    if (result.status !== 'succeeded' && result.status !== 'failed') {
      result = await waitForReplicatePrediction(result.id)
    }

    if (result.status === 'failed') {
      throw new Error('Generation failed: ' + (result.error || 'Unknown'))
    }

    if (!result.output) {
      throw new Error('No output received')
    }

    const imageUrl = Array.isArray(result.output)
      ? result.output[0]
      : result.output

    const imgRes = await fetch(imageUrl)
    const imgBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(imgBuffer).toString('base64')

    console.log('=== Avatar Generated Successfully ===')
    res.json({ success: true, base64, url: imageUrl })

  } catch (err) {
    console.error('Avatar error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ENDPOINT 2 — Virtual try-on with Hugging Face Space
app.post('/api/try-on', async (req, res) => {
  try {
    const { avatarUrl, clothImageUrl, category, clothName } = req.body

    console.log('=== Virtual Try-On ===')
    console.log({ avatarUrl, clothImageUrl, category, clothName })

    if (!avatarUrl) {
      throw new Error('No avatar URL provided')
    }

    if (!clothImageUrl) {
      throw new Error('No cloth image URL provided')
    }

    const { handle_file } = await import('@gradio/client')
    const client = await getKolorsTryOnClient()
    const randomSeed = Math.floor(Math.random() * 1000000)

    const result = await client.predict(2, [
      handle_file(avatarUrl),
      handle_file(clothImageUrl),
      randomSeed,
      true
    ])

    const imageData = result?.data?.[0]

    if (!imageData?.url) {
      throw new Error('No try-on image received from Hugging Face')
    }

    const outputImageResponse = await fetch(imageData.url)

    if (!outputImageResponse.ok) {
      throw new Error(`Could not download try-on image (${outputImageResponse.status})`)
    }

    const mimeType = outputImageResponse.headers.get('content-type') || 'image/webp'
    const outputImageBuffer = await outputImageResponse.arrayBuffer()
    const base64Image = Buffer.from(outputImageBuffer).toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    res.json({
      success: true,
      imageUrl: dataUrl,
      provider: 'huggingface',
      space: 'Kwai-Kolors/Kolors-Virtual-Try-On'
    })
  } catch (err) {
    console.error('Try-on error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ENDPOINT 3 — Google Lens visual search
app.post('/api/visual-search', async (req, res) => {
  try {
    const { imageUrl } = req.body
    console.log('=== Visual Search ===')
    console.log('Image URL:', imageUrl)
    console.log('SerpApi Key:', process.env.SERPAPI_KEY ? 'SET' : 'MISSING')

    if (!imageUrl) throw new Error('No image URL provided')
    if (!process.env.SERPAPI_KEY) {
      throw new Error('SERPAPI_KEY missing from .env')
    }

    const serpUrl = new URL('https://serpapi.com/search.json')
    serpUrl.searchParams.set('engine', 'google_lens')
    serpUrl.searchParams.set('url', imageUrl)
    serpUrl.searchParams.set('api_key', process.env.SERPAPI_KEY)

    console.log('Calling SerpApi...')
    const response = await fetch(serpUrl.toString())
    const data = await response.json()

    console.log('SerpApi response status:', response.status)
    console.log('SerpApi error:', data.error || 'none')

    if (data.error) throw new Error(data.error)

    const results = (data.visual_matches || [])
      .slice(0, 6)
      .map(item => ({
        title: item.title || 'Similar item',
        imageUrl: item.thumbnail || item.image,
        link: item.link || '',
        source: item.source || ''
      }))
      .filter(item => item.imageUrl)

    console.log('Results found:', results.length)
    if (results.length === 0) {
      return res.json({
        success: true,
        fallback: true,
        results: [
          {
            title: 'Original upload',
            imageUrl,
            link: '',
            source: 'fallback'
          }
        ]
      })
    }

    res.json({ success: true, results })

  } catch (err) {
    console.error('Visual search error:', err.message)
    const { imageUrl } = req.body || {}
    return res.json({
      success: true,
      fallback: true,
      error: err.message,
      results: imageUrl
        ? [
            {
              title: 'Original upload',
              imageUrl,
              link: '',
              source: 'fallback'
            }
          ]
        : []
    })
  }
})

// ENDPOINT 4 — Remove background
app.post('/api/remove-bg', async (req, res) => {
  try {
    const { imageUrl } = req.body
    
    console.log('=== Remove Background ===')
    console.log('Image URL:', imageUrl)
    console.log('API Key:', 
      process.env.REMOVEBG_API_KEY ? 'SET' : 'MISSING')

    if (!imageUrl) {
      throw new Error('No image URL provided')
    }

    if (!process.env.REMOVEBG_API_KEY) {
      throw new Error('REMOVEBG_API_KEY missing')
    }

    // Use query string approach instead of form-data
    const params = new URLSearchParams({
      image_url: imageUrl,
      size: 'auto'
    })

    const response = await fetch(
      'https://api.remove.bg/v1.0/removebg?' + params.toString(),
      {
        method: 'POST',
        headers: {
          'X-Api-Key': process.env.REMOVEBG_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      }
    )

    console.log('Remove.bg status:', response.status)

    if (!response.ok) {
      const errText = await response.text()
      console.error('Remove.bg error:', errText)
      
      // If remove.bg fails use original image without bg removal
      console.log('Falling back to original image...')
      return res.json({ 
        success: true, 
        dataUrl: imageUrl,
        fallback: true
      })
    }

    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:image/png;base64,${base64}`

    console.log('Background removed successfully')
    res.json({ success: true, base64, dataUrl })

  } catch (err) {
    console.error('Remove bg error:', err.message)
    
    // Fallback — return original image if removal fails
    res.json({ 
      success: true, 
      dataUrl: req.body.imageUrl,
      fallback: true,
      error: err.message
    })
  }
})

const PORT = Number(process.env.PORT || 3001)

const server = app.listen(PORT, () => {
  console.log(`=== Backend running on http://localhost:${PORT} ===`)
  console.log('Endpoints ready:')
  console.log('  POST /api/generate-avatar')
  console.log('  POST /api/try-on')
  console.log('  POST /api/visual-search')
  console.log('  POST /api/remove-bg')
})

server.on('error', (err) => {
  console.error('Backend startup error:', err.message)
})
