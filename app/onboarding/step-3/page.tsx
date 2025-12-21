"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle } from "lucide-react"

export default function Step3() {
  // --- State declarations ---
  const [tone, setTone] = useState("friendly")
  const [voiceDescription, setVoiceDescription] = useState("")
  const [uploading, setUploading] = useState(false)
  const [voiceCloneId, setVoiceCloneId] = useState<string>("")
  const [testingVoice, setTestingVoice] = useState(false)
  const [testAudioUrl, setTestAudioUrl] = useState<string>("")
  const [voiceCloneError, setVoiceCloneError] = useState<string>("")
  const [voiceCloneSuccess, setVoiceCloneSuccess] = useState(false)
  const [uploadMode, setUploadMode] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState("")
  const [useDefaultVoice, setUseDefaultVoice] = useState(false)
  const [selectedDefaultVoice, setSelectedDefaultVoice] = useState("")
  const [creatorName, setCreatorName] = useState("")
  const [creatorCategory, setCreatorCategory] = useState("")
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userPhone, setUserPhone] = useState("")
  const [creatorDescription, setCreatorDescription] = useState("")
  const [creatorGreeting, setCreatorGreeting] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [category, setCategory] = useState("")
  const [freeMinutes, setFreeMinutes] = useState("")
  const [subscriptionPrice, setSubscriptionPrice] = useState("")
  const [profilePicturePreview, setProfilePicturePreview] = useState("")
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string>("")
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [deletingVoice, setDeletingVoice] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  // Voice recording states and refs
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>("")
  const [isPlaying, setIsPlaying] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const testAudioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const MIN_RECORDING_TIME = 30
  const MAX_RECORDING_TIME = 60

  // ElevenLabs default voices
  const defaultVoices = [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "American Female" },
    { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "American Female" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "American Female" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "American Male" },
    { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "American Female" },
    { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "American Male" },
    { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "American Male" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "American Male" },
    { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "American Male" },
    { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", description: "American Male" }
  ]

  // --- Load onboarding data ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      setUserName(localStorage.getItem("userName") || "")
      setUserEmail(localStorage.getItem("userEmail") || "")
      setUserPhone(localStorage.getItem("userPhone") || "")
      setCreatorDescription(localStorage.getItem("creatorDescription") || "")
      setCreatorGreeting(localStorage.getItem("creatorGreeting") || "")
      setSystemPrompt(localStorage.getItem("systemPrompt") || "")
      setCategory(localStorage.getItem("category") || "")
      setFreeMinutes(localStorage.getItem("freeMinutes") || "")
      setSubscriptionPrice(localStorage.getItem("subscriptionPrice") || "")
      setProfilePicturePreview(localStorage.getItem("profilePicturePreview") || "")
      setCreatorName(localStorage.getItem("creatorName") || "Creator")
      setCreatorCategory(localStorage.getItem("category") || "Educational Content")
      setTone(localStorage.getItem("tone") || "friendly")
      
      // Generate default voice description if not set
      const storedVoiceDescription = localStorage.getItem("voiceDescription")
      if (!storedVoiceDescription || storedVoiceDescription.trim() === "") {
        const name = localStorage.getItem("creatorName") || "Creator"
        const cat = localStorage.getItem("category") || "Educational Content"
        const defaultDesc = generateDefaultVoiceDescription(name, cat)
        setVoiceDescription(defaultDesc)
      } else {
        setVoiceDescription(storedVoiceDescription)
      }
    }
  }, [])

  // --- Cleanup effect ---
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      if (testAudioUrl) {
        URL.revokeObjectURL(testAudioUrl)
      }
    }
  }, [audioUrl, testAudioUrl])

  // --- Utility functions ---
  const createDefaultImage = async (name: string): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext("2d")
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 200, 200)
        gradient.addColorStop(0, "#8b5cf6")
        gradient.addColorStop(1, "#3b82f6")
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 200, 200)
        ctx.fillStyle = "white"
        ctx.font = "bold 72px Arial"
        ctx.textAlign = "center"
        ctx.fillText(name[0] || "A", 100, 130)
      }
      canvas.toBlob((blob) => resolve(blob || new Blob()), "image/png")
    })
  }

  const generateDefaultVoiceDescription = (name: string, category: string) => {
    const categoryDescriptions = {
      "Technology & AI": "tech-savvy and forward-thinking, with clear explanations of complex concepts",
      "Business & Entrepreneurship": "confident and motivational, with executive presence and strategic insight",
      "Educational Content": "warm and knowledgeable, like a trusted teacher who makes learning engaging",
      "Health & Wellness": "caring and supportive, with gentle authority and encouraging tone",
      "Art & Creativity": "expressive and inspiring, with artistic flair and creative energy",
      "Entertainment & Comedy": "engaging and charismatic, with natural storytelling ability and humor",
      "Sports": "energetic and passionate, with enthusiasm and competitive spirit",
      "Travel & Adventure": "adventurous and descriptive, painting vivid pictures of experiences",
      "Cooking & Recipes": "warm and inviting, like sharing cooking secrets with a close friend",
      "Fashion & Lifestyle": "stylish and confident, with sophisticated yet approachable delivery",
      "Parenting & Family": "nurturing and understanding, with wisdom gained through experience",
      "Mental Health & Wellness": "compassionate and reassuring, with gentle strength and empathy"
    }
    const categoryDesc = categoryDescriptions[category as keyof typeof categoryDescriptions] || "warm and engaging, with expertise that comes through naturally"
    return `A ${categoryDesc}. ${name}'s voice carries authenticity and passion for ${category.toLowerCase()}, making complex topics accessible while maintaining their unique perspective and conversational style.`
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // --- Recording functions ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      const chunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/wav" })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            stopRecording()
            return MAX_RECORDING_TIME
          }
          return prev + 1
        })
      }, 1000)
    } catch (error) {
      console.error("Error accessing microphone:", error)
      alert("Unable to access microphone. Please check your permissions.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (recordingTime < MIN_RECORDING_TIME) {
        return
      }
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }

  const playRecording = () => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const pauseRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioBlob(null)
    setAudioUrl("")
    setRecordingTime(0)
    setIsPlaying(false)
    setVoiceCloneError("")
    if (testAudioUrl) {
      URL.revokeObjectURL(testAudioUrl)
      setTestAudioUrl("")
    }
  }

  // --- File upload function ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ["audio/mpeg", "audio/wav", "audio/mp4", "audio/m4a", "audio/aac", "audio/ogg"]
    const fileType = file.type.toLowerCase()
    const fileName = file.name.toLowerCase()

    const isValidType =
      validTypes.includes(fileType) ||
      fileName.endsWith(".mp3") ||
      fileName.endsWith(".wav") ||
      fileName.endsWith(".m4a") ||
      fileName.endsWith(".aac") ||
      fileName.endsWith(".ogg")

    if (!isValidType) {
      alert("Please upload a valid audio file (MP3, WAV, M4A, AAC, or OGG)")
      return
    }

    // Check file size before upload (25MB limit for ElevenLabs)
    const maxSize = 25 * 1024 * 1024 // 25MB
    const fileSizeMB = file.size / (1024 * 1024)
    
    if (file.size > maxSize) {
      alert(`File too large: ${fileSizeMB.toFixed(2)} MB. Maximum size is 25MB. Please compress your audio file or reduce its duration.`)
      return
    }

    console.log(`📁 File selected: ${file.name} (${fileSizeMB.toFixed(2)} MB)`)

    const blob = new Blob([file], { type: file.type })
    setAudioBlob(blob)
    setUploadedFileName(file.name)

    const url = URL.createObjectURL(blob)
    setAudioUrl(url)

    setVoiceCloneError("")
    if (testAudioUrl) {
      URL.revokeObjectURL(testAudioUrl)
      setTestAudioUrl("")
    }
  }

  // --- Voice cloning functions ---
  const createVoiceClone = async () => {
    if (!audioBlob || !voiceDescription) return

    setUploading(true)
    setVoiceCloneError("")
    setVoiceCloneSuccess(false)

    try {
      let usedPresigned = false
      let response: Response | null = null
      let presignError: string | null = null

      try {
        const signRes = await fetch("/api/sign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: uploadedFileName || "voice-sample.wav",
            contentType: (audioBlob as any).type || "audio/wav",
          }),
        })

        const signText = await signRes.text()
        let signJson: any = null
        try { signJson = JSON.parse(signText) } catch { /* leave as text */ }
        console.log("🔐 Presign result:", { status: signRes.status, signJson: signJson || signText })
        if (!signRes.ok) throw new Error(typeof signJson === 'object' ? (signJson.error || signJson.message) : signText)

        const { uploadUrl, key, debug } = signJson || {}
        if (!uploadUrl || !key) throw new Error("Invalid upload URL response from server")
        console.log("⬆️ Uploading to S3:", { key, expectedContentType: debug?.expectedContentType, blobType: (audioBlob as any).type })

        // Warn if content types don't match what was presigned
        const putContentType = (audioBlob as any).type || "application/octet-stream"
        if (debug?.expectedContentType && debug.expectedContentType !== putContentType) {
          console.warn("⚠️ Content-Type mismatch. PUT will use:", putContentType, "but presigned for:", debug.expectedContentType)
        }

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": putContentType },
          body: audioBlob,
        })
        const putBody = await putRes.text().catch(() => "")
        const putHeaders: Record<string,string> = {}
        putRes.headers.forEach((v,k)=> putHeaders[k]=v)
        console.log("📦 S3 PUT result:", { status: putRes.status, ok: putRes.ok, headers: putHeaders, bodyPreview: putBody?.slice(0,500) })
        if (!putRes.ok) {
          // Try to parse common S3 XML error shape
          let s3Code = "", s3Message = ""
          try {
            const codeMatch = typeof putBody === 'string' ? putBody.match(new RegExp("<Code>([^<]*)</Code>", "i")) : null
            const msgMatch = typeof putBody === 'string' ? putBody.match(new RegExp("<Message>([^<]*)</Message>", "i")) : null
            if (codeMatch && codeMatch[1]) s3Code = codeMatch[1]
            if (msgMatch && msgMatch[1]) s3Message = msgMatch[1]
          } catch {}
          const composed = s3Code || s3Message ? `S3 Upload Failed: ${s3Code} ${s3Message}`.trim() : `S3 Upload Failed: ${putRes.status}`
          throw new Error(composed)
        }

        response = await fetch("/api/voice-clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            s3Key: key,
            voiceName: `${userName || creatorName} AI Twin`,
            voiceDescription,
          }),
        })
        usedPresigned = true
      } catch (e) {
        presignError = e instanceof Error ? e.message : String(e)
        console.warn("⚠️ Presigned upload path failed, falling back to direct upload:", presignError)
        const sizeMB = audioBlob.size / (1024 * 1024)
        // For small files, this is non-fatal because we fall back to direct upload.
        // For larger files, secure upload is required.
        if (sizeMB <= 5) {
          setDebugInfo(`Secure upload unavailable (${presignError}). Using direct upload fallback...`)
        } else {
          setVoiceCloneError(`Secure upload unavailable (${presignError}).`)
        }

        // Direct upload is only meant as a small-file fallback.
        // If the sample is larger, fail early with actionable guidance.
        if (sizeMB > 5) {
          throw new Error(
            `Secure upload failed and this audio is ${sizeMB.toFixed(2)}MB. ` +
              `Direct upload is only supported up to ~5MB. ` +
              `Fix S3 access (bucket CORS + server GetObject permission), or upload a shorter/compressed sample.`
          )
        }
      }

      if (!response) {
        const formData = new FormData()
        formData.append("audio", audioBlob, "voice-sample.wav")
        formData.append("voiceName", `${userName || creatorName} AI Twin`)
        formData.append("voiceDescription", voiceDescription)
        response = await fetch("/api/voice-clone", { method: "POST", body: formData })
        if (!presignError) {
          // Ensure any stale messaging is cleared if we didn't log a presign failure
          setVoiceCloneError("")
        }
      }

      if (!response.ok) {
        let errorMessage = `Voice clone API error: ${response.status}`
        try {
          const errorData = JSON.parse(await response.text())
          if (response.status === 413) {
            errorMessage = errorData.error || "File too large"
            if (errorData.fileSize && errorData.maxSize) {
              errorMessage += ` (${errorData.fileSize} exceeds limit of ${errorData.maxSize})`
            }
            if (errorData.suggestion) {
              errorMessage += `. ${errorData.suggestion}`
            }
          } else if (response.status === 400) {
            errorMessage = errorData.error || errorData.message || "Invalid audio file"
          } else {
            errorMessage = errorData.error || errorData.message || errorMessage
          }
        } catch (parseError) {
          console.error("❌ Failed to parse error response:", parseError)
          if (response.status === 413) {
            errorMessage = "File too large. Please try a smaller audio file."
          } else if (response.status === 400) {
            errorMessage = "Invalid audio file or format"
          }
        }
        console.error("❌ Voice clone API error:", response.status, errorMessage)
        throw new Error(errorMessage)
      }

      const contentLength = response.headers.get('content-length')
      if (contentLength === '0') {
        throw new Error("Empty response from voice clone API")
      }

      let result
      try {
        result = await response.json()
      } catch (jsonError) {
        console.error("❌ Failed to parse JSON response:", jsonError)
        const responseText = await response.text()
        console.error("❌ Raw response text:", responseText)
        throw new Error("Invalid JSON response from voice clone API")
      }

      if (result.success) {
        const voiceId = result.voiceId || result.voice_id
        if (voiceId) {
          setVoiceCloneError("")
          setVoiceCloneId(voiceId)
          setVoiceCloneSuccess(true)
          if (typeof window !== "undefined") {
            localStorage.setItem("voiceCloneId", voiceId)
            localStorage.setItem(
              "voiceCloneId_backup",
              JSON.stringify({ voiceId, timestamp: Date.now(), step: "step3_creation" }),
            )
          }
        } else {
          setVoiceCloneError("Voice clone created but no voice ID was returned")
          setVoiceCloneSuccess(false)
        }
      } else {
        const errorMessage = result.error || "Failed to create voice clone"
        throw new Error(errorMessage)
      }
    } catch (error) {
      let errorMessage = "Failed to create voice clone"
      if (error instanceof Error) {
        errorMessage = error.message
      }
      if (errorMessage.includes("fetch")) {
        errorMessage = "Network error - please check your connection and try again"
      }
      if (errorMessage.includes("API key") || errorMessage.includes("unauthorized")) {
        errorMessage = "Voice cloning service unavailable - using default voice"
      }
      setVoiceCloneError(errorMessage)
      setVoiceCloneSuccess(false)
    } finally {
      setUploading(false)
    }
  }

  const testVoiceClone = async () => {
    if (!voiceCloneId) return

    setTestingVoice(true)

    try {
      const testText = `Hi, this is the voice clone of ${creatorName || 'your AI twin'}.`

      const response = await fetch("/api/test-voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceId: voiceCloneId,
          text: testText,
        }),
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        setTestAudioUrl(audioUrl)

        if (testAudioRef.current) {
          testAudioRef.current.src = audioUrl
          // Use onloadeddata event instead of setTimeout for more reliable playback
          testAudioRef.current.onloadeddata = () => {
            if (testAudioRef.current) {
              testAudioRef.current.play().catch(console.error)
            }
          }
          testAudioRef.current.load()
        }
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate test audio")
      }
    } catch (error) {
      let errorMessage = "Voice test failed"
      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("not found")) {
          errorMessage = "Voice not found - the voice clone may not have been created successfully"
        } else if (error.message.includes("API key")) {
          errorMessage = "Voice testing service unavailable"
        } else {
          errorMessage = error.message
        }
      }
      setVoiceCloneError(errorMessage)
    } finally {
      setTestingVoice(false)
    }
  }

  const deleteVoiceClone = async () => {
    if (!voiceCloneId) return

    // Show confirmation dialog
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this voice clone? This action cannot be undone and will permanently remove the voice clone from ElevenLabs."
    )
    
    if (!confirmDelete) return

    setDeletingVoice(true)
    setVoiceCloneError("")

    try {
      const response = await fetch(`/api/voice-clone?voiceId=${encodeURIComponent(voiceCloneId)}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Reset voice clone state
        setVoiceCloneId("")
        setVoiceCloneSuccess(false)
        setVoiceCloneError("")
        
        // Clear from localStorage
        if (typeof window !== "undefined") {
          localStorage.removeItem("voiceCloneId")
          localStorage.removeItem("voiceCloneId_backup")
          localStorage.removeItem("voiceCloneId_backup_continue")
        }

        // Clear test audio
        if (testAudioUrl) {
          URL.revokeObjectURL(testAudioUrl)
          setTestAudioUrl("")
        }

        console.log("✅ Voice clone deleted successfully")
        
        // Show success message briefly
        setError("") // Clear any existing errors
        setTimeout(() => {
          // This will allow the user to create a new voice clone
        }, 100)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete voice clone")
      }
    } catch (error) {
      let errorMessage = "Failed to delete voice clone"
      if (error instanceof Error) {
        errorMessage = error.message
      }
      setVoiceCloneError(errorMessage)
      console.error("❌ Voice deletion error:", error)
    } finally {
      setDeletingVoice(false)
    }
  }

  // --- ElevenLabs Agent creation ---
  const createAgent = async () => {
    setError("")
    setDebugInfo("")

    let voiceIdToUse = ""
    const storedVoiceId = typeof window !== "undefined" ? localStorage.getItem("voiceCloneId") : null
    const backupContinueVoiceId =
      typeof window !== "undefined" ? localStorage.getItem("voiceCloneId_backup_continue") : null

    if (useDefaultVoice && selectedDefaultVoice) {
      voiceIdToUse = selectedDefaultVoice
    } else if (voiceCloneId) {
      voiceIdToUse = voiceCloneId
    } else if (backupContinueVoiceId) {
      try {
        const parsed = JSON.parse(backupContinueVoiceId)
        if (parsed.voiceId && String(parsed.voiceId).length > 10) {
          voiceIdToUse = String(parsed.voiceId)
          if (typeof window !== "undefined") localStorage.setItem("voiceCloneId", voiceIdToUse)
        }
      } catch {}
    } else if (
      storedVoiceId &&
      storedVoiceId.trim() !== "" &&
      storedVoiceId !== "null" &&
      storedVoiceId !== "undefined" &&
      !storedVoiceId.startsWith("demo-voice-") &&
      !storedVoiceId.startsWith("fallback-voice-") &&
      storedVoiceId.length > 10
    ) {
      voiceIdToUse = storedVoiceId.trim()
    }

    if (!voiceIdToUse) {
      throw new Error("Missing voice ID. Please select a default voice or create a voice clone.")
    }

    const res = await fetch("/api/agents/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: creatorName || "Creator",
        systemPrompt,
        greeting: creatorGreeting,
        voiceId: voiceIdToUse,
        tags: [category || creatorCategory || "Substack"],
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      const detail = data?.error ? JSON.stringify(data.error) : "Unknown error"
      setDebugInfo(`API Error: ${res.status} - ${detail}`)
      throw new Error(`Failed to create ElevenLabs agent: ${res.status}`)
    }

    const agentId = String(data?.agentId || data?.raw?.agent_id || "").trim()
    if (!agentId) throw new Error("Agent created but agent_id missing in response")

    if (typeof window !== "undefined") {
      localStorage.setItem("agentId", agentId)
      const verificationLink = `${window.location.origin}/dashboard?agentId=${encodeURIComponent(agentId)}`
      localStorage.setItem("agentLink", verificationLink)

      // Backward-compat keys (no Talk2Me calls rely on these)
      localStorage.setItem("twinId", agentId)
      localStorage.setItem("twinAppLink", verificationLink)

      localStorage.setItem(
        "twinData",
        JSON.stringify({
          agentId,
          verificationLink,
          raw: data?.raw ?? null,
        }),
      )
    }

    return { agentId, raw: data?.raw }
  }

  const uploadKnowledgeBase = async (agentId: string) => {
    if (typeof window === "undefined") return

    let articles: any[] = []
    let substackUrl = ""

    try {
      const stored = localStorage.getItem("substackAnalysis")
      if (stored) {
        const parsed = JSON.parse(stored)
        articles = Array.isArray(parsed?.articles) ? parsed.articles : []
        substackUrl = String(parsed?.substackUrl || "").trim()
      }
    } catch {}

    if (!articles.length) {
      throw new Error("No Substack articles found to add to Knowledge Base. Please re-run Step 1.")
    }

    setDebugInfo("Uploading Substack posts to Knowledge Base (from URLs)…")

    const res = await fetch("/api/agents/knowledge-base", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        creatorName,
        substackUrl,
        articles,
        name: `${creatorName || "Substack"} Articles`,
        maxDocs: 10,
        kbMode: "file",
      }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const detail = data ? JSON.stringify(data, null, 2) : "(no response body)"
      setDebugInfo(`Knowledge Base Error: ${res.status}\n${detail}`)
      throw new Error(`Failed to upload Knowledge Base: ${res.status}`)
    }

    const attachedCount = Number(data?.attachedCount || 0)
    const apiSuccess = Boolean(data?.success)
    if (!apiSuccess || attachedCount === 0) {
      const firstErr = Array.isArray(data?.results)
        ? data.results.find((r: any) => r?.error)?.error
        : null
      const detail = firstErr ? JSON.stringify(firstErr) : (data?.error ? JSON.stringify(data.error) : "No URLs attached")
      setDebugInfo(`Knowledge Base upload did not attach any URLs. Detail: ${detail}`)
      throw new Error("Knowledge Base upload failed to attach posts")
    }

    setDebugInfo(`Knowledge Base loaded with ${attachedCount} posts.`)
  }

  // --- Launch Twin handler ---
  const handleContinue = async () => {
    // Check validation for different voice modes
    if (useDefaultVoice) {
      if (!selectedDefaultVoice || !tone) return
    } else {
      if (!audioBlob || !tone || !voiceDescription) return
    }
    
    setLaunching(true)
    setError("")
    setDebugInfo("")

    try {
      // For default voices, ensure voiceCloneId is set
      if (useDefaultVoice && !voiceCloneId) {
        setVoiceCloneId(selectedDefaultVoice)
        setVoiceCloneSuccess(true)
        // Also store in localStorage to ensure consistency
        localStorage.setItem("voiceCloneId", selectedDefaultVoice)
      }

      // For custom voices, ensure voice is cloned
      if (!useDefaultVoice && !voiceCloneSuccess && !voiceCloneError) {
        await createVoiceClone()
      }

      // Require login for onboarding, but ElevenLabs Agent creation is server-side.
      if (!user) throw new Error("User not authenticated. Please sign in again.")

      const created = await createAgent()
      await uploadKnowledgeBase(created.agentId)

      setTimeout(() => {
        router.push("/twin-created")
      }, 2000)
    } catch (err) {
      setLaunching(false)
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(errorMessage)
      if (errorMessage.includes("authentication") || errorMessage.includes("token")) {
        setTimeout(() => {
          router.push("/")
        }, 3000)
      }
    }
  }

  const isFormValid =
    (audioBlob && tone && voiceDescription.trim() && (uploadMode || recordingTime >= MIN_RECORDING_TIME)) ||
    (useDefaultVoice && selectedDefaultVoice && tone)

  return (
    <div className="min-h-screen bg-black text-white py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-indigo-600">Step 3 of 3</span>
              <span className="text-sm text-gray-500">Build Your Voice Clone</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full w-full"></div>
            </div>
          </div>

          <Card className="bg-black border-gray-700">
            <CardHeader>
              <CardTitle className="text-2xl text-gray-400 text-center">Clone Your Voice</CardTitle>
              <p className="text-gray-400 text-center">
                Record your voice or upload a voice recording.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Voice Recording/Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Voice Sample</label>

                {/* Toggle between record, upload, and default voice */}
                <div className="flex items-center space-x-2 mb-4 flex-wrap gap-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMode(false)
                      setUseDefaultVoice(false)
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      !uploadMode && !useDefaultVoice ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Record Voice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMode(true)
                      setUseDefaultVoice(false)
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      uploadMode && !useDefaultVoice ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMode(false)
                      setUseDefaultVoice(true)
                      // Clear any previously stored voice clone IDs to prevent conflicts
                      localStorage.removeItem("voiceCloneId")
                      localStorage.removeItem("voiceCloneId_backup_continue")
                      setVoiceCloneId("")
                      setVoiceCloneSuccess(false)
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      useDefaultVoice ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Use Default Voice
                  </button>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                  {useDefaultVoice ? (
                    /* Default Voice Selection Mode */
                    <div className="text-center">
                      <p className="text-base font-medium text-gray-300 mb-1">Select Default Voice</p>
                      <p className="text-xs text-gray-500 mb-4">
                        Choose from ElevenLabs&apos; high-quality pre-made voices
                      </p>

                      <div className="mb-4">
                        <Select 
                          value={selectedDefaultVoice} 
                          onValueChange={(value) => {
                            setSelectedDefaultVoice(value)
                            setVoiceCloneId(value)
                            setVoiceCloneSuccess(true)
                            // Store the voice ID in localStorage for twin creation
                            localStorage.setItem("voiceCloneId", value)
                            // Set auto-generated voice description for default voices
                            const selectedVoice = defaultVoices.find(v => v.id === value)
                            if (selectedVoice) {
                              setVoiceDescription(`Professional ${selectedVoice.description.toLowerCase()} voice - ${selectedVoice.name}`)
                            }
                          }}
                        >
                          <SelectTrigger className="w-full bg-black border-gray-600 text-gray-300">
                            <SelectValue placeholder="Choose a voice..." />
                          </SelectTrigger>
                          <SelectContent className="bg-black border-gray-600">
                            {defaultVoices.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id} className="text-gray-300 hover:bg-gray-700">
                                <div className="flex flex-col items-start">
                                  <span className="font-medium">{voice.name}</span>
                                  <span className="text-xs text-gray-500">{voice.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedDefaultVoice && (
                        <div className="bg-green-900/20 rounded-lg p-3 border border-green-600/30">
                          <div className="flex items-center gap-2 text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Voice Selected: {defaultVoices.find(v => v.id === selectedDefaultVoice)?.name}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : uploadMode ? (
                    /* File Upload Mode */
                    <div className="text-center">
                      {!audioBlob ? (
                        <div>
                          <p className="text-base font-medium text-gray-300 mb-1">Upload Voice File</p>
                          <p className="text-xs text-gray-500 mb-3">
                            Upload an audio file (MP3, WAV, M4A) - at least 30 seconds, max 25MB
                          </p>

                          <input
                            type="file"
                            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="voice-file-upload"
                            disabled={uploading}
                          />

                          <label
                            htmlFor="voice-file-upload"
                            className="cursor-pointer inline-flex items-center px-6 py-3 border border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
                          >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                              />
                            </svg>
                            Choose Audio File
                          </label>

                          <p className="text-xs text-gray-500 mt-2">
                            Supported formats: MP3, WAV, M4A, AAC, OGG (Max 25MB)
                          </p>
                        </div>
                      ) : (
                        /* File uploaded successfully */
                        <div>
                          <p className="text-base font-medium text-gray-300 mb-1">File Uploaded</p>
                          <p className="text-xs text-gray-500 mb-3">
                            {uploadedFileName} ({Math.round((audioBlob.size / 1024 / 1024) * 100) / 100} MB)
                          </p>
                          <div className="flex items-center justify-center space-x-2 mb-3">
                            <Button
                              onClick={isPlaying ? pauseRecording : playRecording}
                              className="bg-purple-600 hover:bg-purple-700"
                              size="sm"
                            >
                              {isPlaying ? (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  Pause
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  Play
                                </>
                              )}
                            </Button>
                            <Button onClick={deleteRecording} variant="outline" className="bg-transparent" size="sm">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Delete
                            </Button>
                          </div>

                          {/* Voice Clone Actions for uploaded file */}
                          {voiceDescription && (
                            <div className="mt-4 space-y-2">
                              {!voiceCloneSuccess ? (
                                <Button
                                  onClick={() => createVoiceClone()}
                                  disabled={uploading}
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                                  size="default"
                                >
                                  {uploading ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                      Creating Your Voice Clone...
                                    </>
                                  ) : (
                                    <>
                                      <svg
                                        className="w-4 h-4 mr-2"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M13 10V3L4 14h7v7l9-11h-7z"
                                        />
                                      </svg>
                                      🎭 Make Your Voice Clone
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <div className="space-y-2">
                                  <div className="text-sm text-green-500 font-medium">
                                    ✓ Voice Clone Created
                                    {voiceCloneId ? (
                                      <div className="text-xs text-gray-400 mt-1">
                                        Voice ID: {voiceCloneId.substring(0, 8)}...
                                      </div>
                                    ) : (
                                      <div className="text-xs text-yellow-400 mt-1">Warning: No voice ID returned</div>
                                    )}
                                  </div>
                                  {voiceCloneId && (
                                    <div className="flex items-center justify-center gap-2">
                                      <Button
                                        onClick={testVoiceClone}
                                        disabled={testingVoice || deletingVoice}
                                        className="bg-purple-600 hover:bg-purple-700"
                                        size="sm"
                                      >
                                        {testingVoice ? (
                                          <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                            Testing Voice...
                                          </>
                                        ) : (
                                          <>
                                            <svg
                                              className="w-3 h-3 mr-1"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                              />
                                            </svg>
                                            Test Voice Clone
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        onClick={deleteVoiceClone}
                                        disabled={testingVoice || deletingVoice}
                                        variant="outline"
                                        className="bg-transparent border-red-600 text-red-400 hover:bg-red-900/20"
                                        size="sm"
                                      >
                                        {deletingVoice ? (
                                          <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-400 mr-2"></div>
                                            Deleting...
                                          </>
                                        ) : (
                                          <>
                                            <svg
                                              className="w-3 h-3 mr-1"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                              />
                                            </svg>
                                            Delete Voice Clone
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Recording Mode */
                    <div className="text-center">
                      {!audioBlob ? (
                        <div>
                          <p className="text-base font-medium text-gray-300 mb-1">Record Your Voice</p>
                          <p className="text-xs text-gray-500 mb-3">
                            Record at least 30 seconds (up to 1 minute) to clone your voice
                          </p>
                          {isRecording ? (
                            <div>
                              <div className="text-lg font-bold text-red-500 mb-2">
                                {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                              </div>
                              <div className="flex items-center justify-center space-x-2 mb-3">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-red-500 font-medium text-sm">Recording...</span>
                              </div>
                              {recordingTime < MIN_RECORDING_TIME && (
                                <p className="text-xs text-yellow-400 mb-2">
                                  Keep recording... {MIN_RECORDING_TIME - recordingTime} seconds remaining
                                </p>
                              )}
                              <Button
                                onClick={stopRecording}
                                className="bg-red-600 hover:bg-red-700"
                                size="sm"
                                disabled={recordingTime < MIN_RECORDING_TIME}
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                                </svg>
                                {recordingTime < MIN_RECORDING_TIME
                                  ? `${MIN_RECORDING_TIME - recordingTime}s remaining`
                                  : "Stop Recording"}
                              </Button>
                            </div>
                          ) : (
                            <Button onClick={startRecording} className="bg-purple-600 hover:bg-purple-700" size="sm">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                />
                              </svg>
                              Start Recording
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-base font-medium text-gray-300 mb-1">Recording Complete</p>
                          <p className="text-xs text-gray-500 mb-3">Duration: {formatTime(recordingTime)}</p>
                          <div className="flex items-center justify-center space-x-2 mb-3">
                            <Button
                              onClick={isPlaying ? pauseRecording : playRecording}
                              className="bg-purple-600 hover:bg-purple-700"
                              size="sm"
                            >
                              {isPlaying ? (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  Pause
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  Play
                                </>
                              )}
                            </Button>
                            <Button onClick={deleteRecording} variant="outline" className="bg-transparent" size="sm">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Delete
                            </Button>
                            <Button onClick={startRecording} className="bg-purple-600 hover:bg-purple-700" size="sm">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                />
                              </svg>
                              Re-record
                            </Button>
                          </div>

                          {/* Voice Clone Actions for recorded audio */}
                          {voiceDescription && (
                            <div className="mt-4 space-y-2">
                              {!voiceCloneSuccess ? (
                                <Button
                                  onClick={() => createVoiceClone()}
                                  disabled={uploading}
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                                  size="default"
                                >
                                  {uploading ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                      Creating Your Voice Clone...
                                    </>
                                  ) : (
                                    <>
                                      <svg
                                        className="w-4 h-4 mr-2"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M13 10V3L4 14h7v7l9-11h-7z"
                                        />
                                      </svg>
                                      🎭 Make Your Voice Clone
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <div className="space-y-2">
                                  <div className="text-sm text-green-500 font-medium">
                                    ✓ Voice Clone Created
                                    {voiceCloneId ? (
                                      <div className="text-xs text-gray-400 mt-1">
                                        Voice ID: {voiceCloneId.substring(0, 8)}...
                                      </div>
                                    ) : (
                                      <div className="text-xs text-yellow-400 mt-1">Warning: No voice ID returned</div>
                                    )}
                                  </div>
                                  {voiceCloneId && (
                                    <div className="flex items-center justify-center gap-2">
                                      <Button
                                        onClick={testVoiceClone}
                                        disabled={testingVoice || deletingVoice}
                                        className="bg-purple-600 hover:bg-purple-700"
                                        size="sm"
                                      >
                                        {testingVoice ? (
                                          <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                            Testing Voice...
                                          </>
                                        ) : (
                                          <>
                                            <svg
                                              className="w-3 h-3 mr-1"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                              />
                                            </svg>
                                            Test Voice Clone
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        onClick={deleteVoiceClone}
                                        disabled={testingVoice || deletingVoice}
                                        variant="outline"
                                        className="bg-transparent border-red-600 text-red-400 hover:bg-red-900/20"
                                        size="sm"
                                      >
                                        {deletingVoice ? (
                                          <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-400 mr-2"></div>
                                            Deleting...
                                          </>
                                        ) : (
                                          <>
                                            <svg
                                              className="w-3 h-3 mr-1"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                              />
                                            </svg>
                                            Delete Voice Clone
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  {useDefaultVoice 
                    ? "Select a high-quality pre-made voice for your AI twin."
                    : uploadMode
                    ? "Upload a clear audio file of your voice speaking naturally for at least 30 seconds."
                    : "Speak clearly and naturally for at least 30 seconds. This recording will be used to clone your voice."}
                </p>
              </div>

              {/* Hidden audio elements */}
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  onPause={() => setIsPlaying(false)}
                  style={{ display: "none" }}
                />
              )}
              {/* Always render test audio element so it's available for playback */}
              <audio ref={testAudioRef} style={{ display: "none" }} />

              {/* Error Display */}
              {error && (
                <div className="bg-red-900/20 rounded-lg p-4 border border-red-700">
                  <div className="text-red-300 font-medium mb-2">❌ Error</div>
                  <div className="text-sm text-red-200">{error}</div>
                </div>
              )}

              {/* Success/Loading Display */}
              {launching && !error && (
                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700">
                  <div className="text-blue-300 font-medium mb-2">🚀 Launching Your Twin...</div>
                  <div className="text-sm text-blue-200">
                    {voiceCloneSuccess ? "Creating your twin with voice clone..." : "Processing voice and creating twin..."}
                  </div>
                </div>
              )}

              {/* Voice Clone Error Display */}
              {voiceCloneError && (
                <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-700">
                  <div className="text-yellow-300 font-medium mb-2">⚠️ Voice Clone Issue</div>
                  <div className="text-sm text-yellow-200">{voiceCloneError}</div>
                  <div className="text-xs text-yellow-400 mt-2">Your twin will be created with a default voice.</div>
                </div>
              )}

              {/* Hint for users who haven't filled requirements */}
              {(!audioBlob && !selectedDefaultVoice) && (
                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700">
                  <div className="text-blue-300 font-medium mb-2">📝 Complete These Steps:</div>
                  <div className="space-y-1 text-sm text-blue-200">
                    <div>• Record your voice, upload an audio file, or select a default voice</div>
                    {!voiceDescription && <div>• Voice description has been auto-generated for you</div>}
                  </div>
                  <div className="text-xs text-blue-400 mt-2">
                    Once you have selected a voice option, you&apos;ll be able to launch your twin! ✨
                  </div>
                </div>
              )}

              <Button
                onClick={handleContinue}
                disabled={!isFormValid || launching}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {launching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Launching Your Persona...
                  </>
                ) : (
                  "🚀 Launch My Twin"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
