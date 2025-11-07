/**
 * SECURE S3 UPLOAD PATTERN FOR LARGE FILES
 * 
 * This example demonstrates how to securely upload large files to S3 without exposing
 * AWS credentials to the browser. The pattern works as follows:
 * 
 * 1. Client requests presigned URL from server (server has AWS credentials)
 * 2. Server generates presigned URL and returns it (no credentials exposed)
 * 3. Client uploads directly to S3 using presigned URL (bypasses server size limits)
 * 4. File is processed from S3 (server can access with credentials)
 * 
 * SECURITY BENEFITS:
 * - AWS credentials never leave the server
 * - No credentials in client-side JavaScript bundle
 * - Presigned URLs expire automatically (10 minutes)
 * - Large files don't overwhelm your server
 * - Direct S3 upload is faster and more reliable
 */

'use client'

import React, { useState } from 'react'
import { AudioUpload } from '@/components/SecureUpload'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function SecureUploadDemo() {
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    name: string
    s3Key?: string
    method: 'S3' | 'Direct'
    size: string
  }>>([])
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleAudioUpload = async (file: File, s3Key?: string) => {
    console.log('🎵 Audio file received:', { 
      name: file.name, 
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      s3Key: s3Key ? 'Available' : 'Not available (fallback to direct)'
    })

    // Add to uploaded files list
    setUploadedFiles(prev => [...prev, {
      name: file.name,
      s3Key,
      method: s3Key ? 'S3' : 'Direct',
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
    }])

    setError(null)

    // Example: Process the audio file for voice cloning
    if (s3Key) {
      await processAudioFromS3(s3Key, file.name)
    } else {
      await processAudioDirect(file)
    }
  }

  const processAudioFromS3 = async (s3Key: string, filename: string) => {
    setProcessing(true)
    try {
      console.log('🔄 Processing audio from S3:', s3Key)
      
      // Call your voice cloning API with S3 key (secure - server accesses S3)
      const response = await fetch('/api/voice-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s3Key,
          voiceName: 'Demo Voice',
          voiceDescription: `Voice cloned from ${filename}`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Voice cloning successful:', result)
      
    } catch (error) {
      console.error('❌ S3 processing failed:', error)
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setProcessing(false)
    }
  }

  const processAudioDirect = async (file: File) => {
    setProcessing(true)
    try {
      console.log('🔄 Processing audio via direct upload (fallback):', file.name)
      
      // Fallback to FormData upload (has size limitations)
      const formData = new FormData()
      formData.append('audio', file)
      formData.append('voiceName', 'Demo Voice')
      formData.append('voiceDescription', `Voice cloned from ${file.name}`)

      const response = await fetch('/api/voice-clone', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('File too large for direct upload. S3 upload is required for large files.')
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Voice cloning successful (direct upload):', result)
      
    } catch (error) {
      console.error('❌ Direct processing failed:', error)
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setProcessing(false)
    }
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    console.error('❌ Upload error:', errorMessage)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Secure S3 Upload Demo</h1>
          <p className="text-gray-600">
            Upload large audio files securely without exposing AWS credentials
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">How It Works (Security)</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-2">
              <span className="font-bold text-green-600">1.</span>
              <span>Client requests presigned URL from server (AWS credentials stay on server)</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold text-green-600">2.</span>
              <span>Server generates presigned URL using its AWS credentials (no credentials sent to client)</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold text-green-600">3.</span>
              <span>Client uploads directly to S3 using presigned URL (bypasses server size limits)</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-bold text-green-600">4.</span>
              <span>Server processes file from S3 using its credentials (secure access)</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Upload Audio File</h2>
          <AudioUpload 
            onAudioReady={handleAudioUpload}
            onError={handleError}
            disabled={processing}
          />
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {processing && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-800 text-sm">🔄 Processing audio file for voice cloning...</p>
            </div>
          )}
        </Card>

        {uploadedFiles.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Upload History</h2>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <span className="font-medium">{file.name}</span>
                    <span className="text-gray-500 ml-2">({file.size})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      file.method === 'S3' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {file.method === 'S3' ? '✅ S3 Upload' : '⚠️ Direct Upload'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6 bg-blue-50">
          <h2 className="text-xl font-semibold mb-4 text-blue-900">Security Notes</h2>
          <div className="space-y-2 text-sm text-blue-800">
            <div>• AWS credentials are never exposed to the browser</div>
            <div>• Presigned URLs expire automatically (10 minutes)</div>
            <div>• Large files upload directly to S3 (no server size limits)</div>
            <div>• Fallback to direct upload for environments without S3 access</div>
            <div>• All file processing happens on secure server with proper credentials</div>
          </div>
        </Card>
      </div>
    </div>
  )
}