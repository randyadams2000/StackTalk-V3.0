'use client'

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useS3Upload, createPreviewUrl, revokePreviewUrl, UploadOptions } from '@/lib/useS3Upload'

interface SecureUploadProps {
  onUpload: (file: File, s3Key?: string) => void
  onError?: (error: string) => void
  accept?: string
  maxSizeMB?: number
  className?: string
  children?: React.ReactNode
  disabled?: boolean
  multiple?: boolean
}

export const SecureUpload: React.FC<SecureUploadProps> = ({
  onUpload,
  onError,
  accept = 'audio/*',
  maxSizeMB = 25,
  className = '',
  children,
  disabled = false,
  multiple = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const { uploadFile, uploading, progress } = useS3Upload()

  const processFile = async (file: File) => {
    const allowedTypes = accept.split(',').map(type => type.trim())
    
    const uploadOptions: UploadOptions = {
      maxSizeMB,
      allowedTypes,
      onProgress: (prog) => {
        console.log(`Upload progress: ${prog}%`)
      },
      onSuccess: (key) => {
        console.log('✅ Secure upload successful:', { key })
        onUpload(file, key)
      },
      onError: (error) => {
        console.error('❌ Upload failed:', error)
        onError?.(error)
      }
    }

    try {
      const result = await uploadFile(file, uploadOptions)
      
      if (!result.success && !result.usedS3) {
        // S3 failed, but we can still pass the file for fallback handling
        console.log('🔄 S3 upload failed, providing file for fallback handling')
        onUpload(file, undefined) // No S3 key means fallback to direct upload
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      onError?.(errorMessage)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    for (const file of files) {
      await processFile(file)
      if (!multiple) break // Only process first file if not multiple
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    for (const file of files) {
      await processFile(file)
      if (!multiple) break
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />
      
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
      >
        {uploading ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Uploading securely to S3...</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">{progress}% complete</div>
          </div>
        ) : children ? (
          children
        ) : (
          <div className="space-y-2">
            <div className="text-lg font-medium">
              {dragOver ? 'Drop files here' : 'Click to upload or drag and drop'}
            </div>
            <div className="text-sm text-gray-500">
              Maximum file size: {maxSizeMB}MB
            </div>
            <div className="text-xs text-gray-400">
              Files are uploaded securely to AWS S3 (no credentials exposed to browser)
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Example usage component for audio uploads
export const AudioUpload: React.FC<{
  onAudioReady: (file: File, s3Key?: string) => void
  onError?: (error: string) => void
  disabled?: boolean
}> = ({ onAudioReady, onError, disabled }) => {
  return (
    <SecureUpload
      accept="audio/mpeg,audio/wav,audio/mp4,audio/m4a,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg"
      maxSizeMB={25}
      onUpload={onAudioReady}
      onError={onError}
      disabled={disabled}
      className="w-full"
    >
      <div className="space-y-2">
        <div className="text-lg font-medium">Upload Audio File</div>
        <div className="text-sm text-gray-600">
          Supported formats: MP3, WAV, M4A, AAC, OGG
        </div>
        <div className="text-sm text-gray-500">
          Maximum file size: 25MB (ElevenLabs limit)
        </div>
        <Button type="button" variant="outline" className="mt-2">
          Choose Audio File
        </Button>
      </div>
    </SecureUpload>
  )
}