"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth/auth-provider"

export default function Step4() {
  const [substackUrl, setSubstackUrl] = useState("")
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userPhone, setUserPhone] = useState("")
  const [posts, setPosts] = useState<string[]>([])
  const [creatorName, setCreatorName] = useState("")
  const [creatorDescription, setCreatorDescription] = useState("")
  const [creatorGreeting, setCreatorGreeting] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [category, setCategory] = useState("")
  const [freeMinutes, setFreeMinutes] = useState("")
  const [subscriptionPrice, setSubscriptionPrice] = useState("")
  const [voiceRecording, setVoiceRecording] = useState("")
  const [tone, setTone] = useState("")
  const [voiceDescription, setVoiceDescription] = useState("")
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string>("")
  const [mounted, setMounted] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const router = useRouter()
  const [profilePicturePreview, setProfilePicturePreview] = useState("")
  const { user } = useAuth()

  // Ensure component is mounted before accessing auth
  useEffect(() => {
    setMounted(true)
  }, [])

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
        ctx.textBaseline = "middle"
        ctx.fillText(name.charAt(0).toUpperCase(), 100, 100)
      }

      canvas.toBlob((blob) => {
        resolve(blob || new Blob())
      }, "image/png")
    })
  }

  const createAgent = async () => {
    setError("")
    setDebugInfo("")

    const storedVoiceId = typeof window !== "undefined" ? localStorage.getItem("voiceCloneId") : null
    const backupContinueVoiceId =
      typeof window !== "undefined" ? localStorage.getItem("voiceCloneId_backup_continue") : null

    let voiceIdToUse = storedVoiceId?.trim() || ""
    if (
      (!voiceIdToUse || voiceIdToUse === "null" || voiceIdToUse === "undefined") &&
      backupContinueVoiceId
    ) {
      try {
        const parsed = JSON.parse(backupContinueVoiceId)
        if (parsed.voiceId && String(parsed.voiceId).length > 10) {
          voiceIdToUse = String(parsed.voiceId)
          localStorage.setItem("voiceCloneId", voiceIdToUse)
        }
      } catch {}
    }

    if (!voiceIdToUse) throw new Error("Missing voice ID. Please go back and set up a voice.")

    const res = await fetch("/api/agents/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: creatorName || "Creator",
        systemPrompt,
        greeting: creatorGreeting,
        voiceId: voiceIdToUse,
        tags: [category || "Substack"],
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
    }

    setDebugInfo(`Agent created:\nagentId: ${agentId}`)
    return { agentId }
  }

  const uploadKnowledgeBase = async (agentId: string) => {
    if (typeof window === "undefined") return

    let articles: any[] = []
    let substackUrlFromAnalysis = ""

    try {
      const stored = localStorage.getItem("substackAnalysis")
      if (stored) {
        const parsed = JSON.parse(stored)
        articles = Array.isArray(parsed?.articles) ? parsed.articles : []
        substackUrlFromAnalysis = String(parsed?.substackUrl || "").trim()
      }
    } catch {}

    if (!articles.length) {
      throw new Error("No Substack articles found to add to Knowledge Base. Please re-run Step 1.")
    }

    setDebugInfo("Uploading Substack articles to Knowledge Base…")

    const res = await fetch("/api/agents/knowledge-base", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        creatorName,
        substackUrl: substackUrlFromAnalysis || substackUrl,
        articles,
        name: `${creatorName || "Substack"} Articles`,
      }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const detail = data?.error ? JSON.stringify(data.error) : "Unknown error"
      setDebugInfo(`Knowledge Base Error: ${res.status} - ${detail}`)
      throw new Error(`Failed to upload Knowledge Base: ${res.status}`)
    }

    setDebugInfo("Knowledge Base uploaded.")
  }

  useEffect(() => {
    if (!mounted) return

    console.log("STEP 4 COMPONENT MOUNTED")

    if (typeof window !== "undefined") {
      console.log("LOADING DATA FROM LOCALSTORAGE...")

      const voiceIdOnMount = localStorage.getItem("voiceCloneId")
      console.log("Voice ID on Step 4 mount:", voiceIdOnMount)

      setSubstackUrl(localStorage.getItem("substackUrl") || "")
      setUserName(localStorage.getItem("userName") || "")
      setUserEmail(localStorage.getItem("userEmail") || "")
      setUserPhone(localStorage.getItem("userPhone") || "")
      setPosts(JSON.parse(localStorage.getItem("posts") || "[]"))
      setCreatorName(localStorage.getItem("creatorName") || "")
      setCreatorDescription(localStorage.getItem("creatorDescription") || "")
      setCreatorGreeting(localStorage.getItem("creatorGreeting") || "")
      setSystemPrompt(localStorage.getItem("systemPrompt") || "")
      setCategory(localStorage.getItem("category") || "")
      setFreeMinutes(localStorage.getItem("freeMinutes") || "")
      setSubscriptionPrice(localStorage.getItem("subscriptionPrice") || "")
      setProfilePicturePreview(localStorage.getItem("profilePicturePreview") || "")
      setVoiceRecording(localStorage.getItem("voiceRecording") || "")
      setTone(localStorage.getItem("tone") || "")
      setVoiceDescription(localStorage.getItem("voiceDescription") || "")

      console.log("All localStorage data loaded")
      console.log("Final voice ID after loading:", localStorage.getItem("voiceCloneId"))
    }
  }, [mounted])

  // Auto-launch as soon as mounted and user is present
  useEffect(() => {
    if (mounted && user && !launching) {
      handleLaunch()
    }
  }, [mounted, user])

  const handleLaunch = async () => {
    setLaunching(true)
    setError("")
    setDebugInfo("")

    try {
      if (!user) {
        console.error("❌ User not authenticated")
        throw new Error("User not authenticated. Please sign in again.")
      }
      const created = await createAgent()
      await uploadKnowledgeBase(created.agentId)

      setTimeout(() => {
        router.push("/twin-created")
      }, 2000)
    } catch (error) {
      console.error("❌ Twin creation failed:", error)
      setLaunching(false)

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      setError(errorMessage)

      if (errorMessage.includes("authentication") || errorMessage.includes("token")) {
        setTimeout(() => {
          router.push("/")
        }, 3000)
      }
    }
  }

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-black text-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-100 mb-2">Loading...</h3>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-600">Step 4 of 4</span>
              <span className="text-sm text-gray-400">Review & Launch</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full w-full"></div>
            </div>
          </div>

          <Card className="bg-black border-gray-700">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Review & Launch Your Persona</CardTitle>
              <p className="text-gray-400 text-center">Review your settings before launching your AI twin</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Authentication Status */}
              <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700">
                <h3 className="font-medium text-blue-300 mb-2">🔐 Authentication Status</h3>
                {user ? (
                  <div className="space-y-1">
                    <div className="text-sm text-green-400">✅ Signed in as: {user.email}</div>
                    <div className="text-xs text-blue-300">Firebase authentication active</div>
                  </div>
                ) : (
                  <div className="text-sm text-red-400">❌ Not authenticated</div>
                )}
              </div>

              {/* Debug Information */}
              {debugInfo && (
                <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-700">
                  <h3 className="font-medium text-yellow-300 mb-2">🐛 API Debug Information</h3>
                  <pre className="text-xs text-yellow-100 whitespace-pre-wrap overflow-x-auto bg-black/20 p-2 rounded">
                    {debugInfo}
                  </pre>
                </div>
              )}

              <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <h3 className="font-medium text-gray-100 mb-3">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Name:</span>
                    <span className="text-sm font-medium text-white">{userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Email:</span>
                    <span className="text-sm font-medium text-white">{userEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Phone:</span>
                    <span className="text-sm font-medium text-white">{userPhone}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <h3 className="font-medium text-gray-100 mb-2">Substack Connection</h3>
                <p className="text-sm text-gray-400 mb-2">{substackUrl}</p>
                <p className="text-sm text-purple-600">{posts.length} posts synced</p>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <h3 className="font-medium text-gray-100 mb-3">Profile Information</h3>
                <div className="flex items-start space-x-3">
                  <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                    {profilePicturePreview ? (
                      <img
                        src={profilePicturePreview || "/placeholder.svg"}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <span className="text-sm text-gray-400">Name: </span>
                      <span className="text-sm font-medium text-white">{creatorName}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Category: </span>
                      <span className="text-sm font-medium text-purple-400">{category}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Description: </span>
                      <p className="text-sm text-white mt-1">{creatorDescription}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Greeting: </span>
                      <p className="text-sm text-white mt-1">&quot;{creatorGreeting}&quot;</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <h3 className="font-medium text-gray-100 mb-3">Plan Settings</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Included Minutes:</span>
                    <span className="text-sm font-medium text-green-500">{freeMinutes} minutes</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Monthly Price:</span>
                    <span className="text-sm font-medium text-green-500">${subscriptionPrice}/month</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <h3 className="font-medium text-gray-100 mb-3">Voice Settings</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Voice Recording:</span>
                    <span className="text-sm font-medium text-green-500">✓ Recorded</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Tone:</span>
                    <span className="text-sm font-medium capitalize">{tone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Voice Clone ID:</span>
                    <span className="text-sm font-medium text-purple-400">
                      {typeof window !== "undefined" && localStorage.getItem("voiceCloneId")
                        ? localStorage.getItem("voiceCloneId")?.substring(0, 20) + "..."
                        : "Default"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-gray-400">Description:</span>
                    <p className="text-sm font-medium mt-1">{voiceDescription}</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                  <h3 className="text-red-400 font-medium mb-2">Error Creating Agent</h3>
                  <p className="text-red-300 text-sm">{error}</p>
                  {error.includes("authentication") && (
                    <p className="text-red-300 text-xs mt-2">Redirecting to sign in...</p>
                  )}
                </div>
              )}

              {launching ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-100 mb-2">Creating Your Agent...</h3>
                  <p className="text-sm text-gray-400">Creating an ElevenLabs agent</p>
                </div>
              ) : !user ? (
                <div className="text-center py-4">
                  <p className="text-red-400 mb-4">Please sign in with Firebase to create your AI twin</p>
                  <Button onClick={() => router.push("/")} className="bg-purple-600 hover:bg-purple-700">
                    Go Back to Sign In
                  </Button>
                </div>
              ) : (
                <Button onClick={handleLaunch} className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
                  Launch My Twin
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
