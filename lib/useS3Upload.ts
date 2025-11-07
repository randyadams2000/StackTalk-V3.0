import { useState } from 'react'

interface UploadOptions {
  maxSizeMB?: number
  allowedTypes?: string[]
  onProgress?: (progress: number) => void
  onSuccess?: (key: string, url?: string) => void
  onError?: (error: string) => void
}

interface UploadResult {
  success: boolean
  key?: string
  error?: string
  usedS3?: boolean
}

export const useS3Upload = () => {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadFile = async (
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    const {
      maxSizeMB = 25,
      allowedTypes = ['audio/*', 'image/*', 'video/*'],
      onProgress,
      onSuccess,
      onError
    } = options

    setUploading(true)
    setProgress(0)

    try {
      // Validate file size
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > maxSizeMB) {
        const error = `File too large: ${fileSizeMB.toFixed(2)} MB. Maximum size is ${maxSizeMB}MB.`
        onError?.(error)
        return { success: false, error }
      }

      // Validate file type
      const isValidType = allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', '/'))
        }
        return file.type === type
      })

      if (!isValidType) {
        const error = `Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`
        onError?.(error)
        return { success: false, error }
      }

      console.log(`📁 Uploading file: ${file.name} (${fileSizeMB.toFixed(2)} MB)`)

      // Step 1: Get presigned URL from server (secure - no credentials exposed)
      let usedS3 = false
      try {
        onProgress?.(10)
        setProgress(10)

        const signResponse = await fetch('/api/sign-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || 'application/octet-stream'
          })
        })

        const signData = await signResponse.json()
        
        if (!signResponse.ok) {
          throw new Error(signData.error || signData.message || 'Failed to get upload URL')
        }

        const { uploadUrl, key, debug } = signData
        if (!uploadUrl || !key) {
          throw new Error('Invalid upload URL response from server')
        }

        onProgress?.(30)
        setProgress(30)

        console.log('⬆️ Uploading directly to S3:', { key, expectedContentType: debug?.expectedContentType })

        // Step 2: Upload directly to S3 using presigned URL (bypasses server size limits)
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file
        })

        onProgress?.(80)
        setProgress(80)

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => '')
          
          // Try to parse S3 XML error
          let s3Error = `S3 Upload Failed: ${uploadResponse.status}`
          try {
            const codeMatch = errorText.match(/<Code>([^<]*)<\/Code>/i)
            const messageMatch = errorText.match(/<Message>([^<]*)<\/Message>/i)
            if (codeMatch?.[1] || messageMatch?.[1]) {
              s3Error = `S3 Upload Failed: ${codeMatch?.[1] || ''} ${messageMatch?.[1] || ''}`.trim()
            }
          } catch {}
          
          throw new Error(s3Error)
        }

        usedS3 = true
        onProgress?.(100)
        setProgress(100)
        
        console.log('✅ S3 upload successful:', { key })
        onSuccess?.(key, uploadUrl)
        
        return { success: true, key, usedS3: true }

      } catch (s3Error) {
        console.warn('⚠️ S3 upload failed, this is expected in some environments:', s3Error)
        onProgress?.(0)
        setProgress(0)
        
        // Note: Don't throw here, let it fall through to direct upload fallback
        // This allows the component using this hook to decide whether to attempt fallback
        return { 
          success: false, 
          error: s3Error instanceof Error ? s3Error.message : String(s3Error),
          usedS3: false 
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Upload failed:', errorMessage)
      onError?.(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setUploading(false)
    }
  }

  return {
    uploadFile,
    uploading,
    progress
  }
}

// Utility function to create a blob URL for preview
export const createPreviewUrl = (file: File): string => {
  return URL.createObjectURL(file)
}

// Utility function to clean up blob URLs
export const revokePreviewUrl = (url: string): void => {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

// Type definitions
export type { UploadOptions, UploadResult }