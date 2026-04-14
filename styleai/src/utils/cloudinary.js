const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export const uploadToCloudinary = async (
  fileOrBase64, 
  folder = 'styleai'
) => {
  const formData = new FormData()
  formData.append('file', fileOrBase64)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('cloud_name', CLOUD_NAME)
  formData.append('folder', folder)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'Cloudinary upload failed')
  }

  const data = await response.json()
  return data.secure_url
}
