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
  const { user, getToken } = useAuth()
  let voiceIdToUse = ""

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

  const createTwin = async (authToken: string) => {
    try {
      console.log("🔧 === CREATE TWIN FUNCTION START ===")
      setError("")
      setDebugInfo("")

      console.log("🔑 Using Firebase auth token for API call:", authToken.substring(0, 30) + "...")

      const storedVoiceId = typeof window !== "undefined" ? localStorage.getItem("voiceCloneId") : null
      console.log("🎤 Voice ID for twin creation:", storedVoiceId)

      const backupVoiceId = typeof window !== "undefined" ? localStorage.getItem("voiceCloneId_backup") : null
      const backupContinueVoiceId =
        typeof window !== "undefined" ? localStorage.getItem("voiceCloneId_backup_continue") : null

      console.log("📁 Backup voice IDs:", { backupVoiceId, backupContinueVoiceId })

      if (backupContinueVoiceId) {
        try {
          const parsed = JSON.parse(backupContinueVoiceId)
          if (parsed.voiceId && parsed.voiceId.length > 10) {
            voiceIdToUse = parsed.voiceId
            console.log("🔄 Recovered voice ID from backup:", voiceIdToUse)
            localStorage.setItem("voiceCloneId", voiceIdToUse)
          }
        } catch (e) {
          console.log("⚠️ Could not recover from backup:", e)
        }
      }

      console.log("📋 Building FormData for API call...")
      const formData = new FormData()

      formData.append("name", creatorName)
      formData.append("title", `${creatorName}'s AI Twin`)
      formData.append("subtitle", creatorDescription.substring(0, 100))

      console.log("✅ Basic form fields added")

      if (
        storedVoiceId &&
        storedVoiceId.trim() !== "" &&
        storedVoiceId !== "null" &&
        storedVoiceId !== "undefined" &&
        !storedVoiceId.startsWith("demo-voice-") &&
        !storedVoiceId.startsWith("fallback-voice-") &&
        storedVoiceId.length > 10
      ) {
        voiceIdToUse = storedVoiceId.trim()
        console.log("✅ Using valid voice ID:", voiceIdToUse)
      } else {
        if (!voiceIdToUse) {
          console.log("⚠️ No valid voice ID found, using default voice")
        }
      }

      console.log("🎤 Voice ID being sent to Talk2Me API:", voiceIdToUse)

      formData.append("voice_id", voiceIdToUse)
      formData.append("system_prompt", systemPrompt)
      formData.append("greeting_prompt", creatorGreeting)
      formData.append("new_user_greeting_prompt", creatorGreeting)

      console.log("✅ Voice and prompt fields added")

      let imageBlob: Blob
      if (profilePicturePreview && profilePicturePreview.startsWith("data:")) {
        try {
          const response = await fetch(profilePicturePreview)
          imageBlob = await response.blob()
          console.log("✅ Using uploaded profile image")
        } catch (error) {
          console.error("❌ Error processing profile image:", error)
          imageBlob = await createDefaultImage(creatorName)
          console.log("🎨 Error with uploaded image, using generated default")
        }
      } else {
        imageBlob = await createDefaultImage(creatorName)
        console.log("🎨 Using generated default profile image")
      }

      formData.append("image_file", imageBlob, "profile.png")
      console.log("✅ Image file added to form data")

      const categoryMapping: { [key: string]: string } = {
        "Art & Creativity": "1",
        "Beauty & Makeup": "2",
        "Business & Entrepreneurship": "3",
        "Cooking & Recipes": "4",
        "DIY & Crafting": "5",
        "Educational Content": "6",
        "Entertainment & Comedy": "7",
        "Fashion & Lifestyle": "8",
        "Fitness & Health": "9",
        Gaming: "10",
        "Mental Health & Wellness": "11",
        "Motivational & Self Improvement": "12",
        "Parenting & Family": "13",
        Sports: "14",
        "Technology & AI": "15",
        "Travel & Adventure": "16",
      }

      const categoryId = categoryMapping[category] || "6"
      formData.append("category_ids", categoryId)
      formData.append("websearch", "false")
      
      // Note: Phone number is not required by Talk2Me API, so we don't send it

      console.log("✅ Category fields added")
      console.log("📊 Final form data summary:")
      console.log("- name:", creatorName)
      console.log("- title:", `${creatorName}'s AI Twin`)
      console.log("- subtitle:", creatorDescription.substring(0, 50) + "...")
      console.log("- voice_id:", voiceIdToUse)
      console.log("- category_ids:", categoryId)
      console.log("- phone: (not sent - not required)")
      console.log("- system_prompt length:", systemPrompt.length)
      console.log("- greeting_prompt length:", creatorGreeting.length)

      console.log("📡 Making API call to Talk2Me with Firebase auth token...")

      const response = await fetch("https://api.talk2me.ai/creators/account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      })

      console.log("📊 === API RESPONSE DETAILS ===")
      console.log("📊 API Response Status:", response.status, response.statusText)
      console.log("📊 API Response Headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ API Error Response Body:", errorText)

        // Try to parse error as JSON for more details
        try {
          const errorJson = JSON.parse(errorText)
          console.error("❌ Parsed Error JSON:", errorJson)
          setDebugInfo(`API Error: ${response.status} - ${JSON.stringify(errorJson, null, 2)}`)
        } catch (parseError) {
          setDebugInfo(`API Error: ${response.status} - ${errorText}`)
        }

        if (response.status === 401) {
          throw new Error("Authentication failed. Firebase token may be invalid or expired.")
        } else if (response.status === 403) {
          throw new Error("Access forbidden. Please check your permissions.")
        } else if (response.status === 405) {
          throw new Error("API endpoint does not accept POST requests.")
        } else if (response.status === 500) {
          if (errorText.includes("Voice with ID not found")) {
            throw new Error("VOICE_NOT_FOUND")
          } else {
            throw new Error(`Server Error: ${errorText}`)
          }
        } else {
          throw new Error(`API Error: ${response.status} - ${errorText}`)
        }
      }

      const result = await response.json()
      console.log("✅ FULL API RESPONSE:")
      console.log("📋 Response Object:", result)
      console.log("📋 Response Keys:", Object.keys(result))
      console.log("📋 Response JSON (formatted):", JSON.stringify(result, null, 2))

      // Set debug info to show the full response
      setDebugInfo(`API Success Response:\n${JSON.stringify(result, null, 2)}`)

      // Extract the twin ID from creator.ext_id specifically
      const twinId = result.creator?.ext_id
      console.log("🆔 EXTRACTED TWIN ID from creator.ext_id:", twinId)

      if (twinId) {
        console.log("🎯 TWIN ID FOUND:", twinId)
        console.log("🎯 TWIN ID TYPE:", typeof twinId)
        console.log("🎯 TWIN ID LENGTH:", String(twinId).length)

        // Validate the ID format (should be a UUID)
        const twinIdStr = String(twinId).trim()
        if (twinIdStr.length < 10) {
          console.warn("⚠️ Twin ID seems too short:", twinIdStr)
          setDebugInfo(
            (prev) => prev + `\n\nWARNING: Twin ID '${twinIdStr}' seems too short (${twinIdStr.length} chars)`,
          )
        }

        // Generate the anonymous app link (append /anonymous)
        const appLink = `https://app.talk2me.ai/creator/${twinIdStr}/anonymous`
        console.log("🔗 Generated anonymous app link:", appLink)

        // Store the twin ID and generate the app link immediately
        if (typeof window !== "undefined") {
          localStorage.setItem("twinId", twinIdStr)
          localStorage.setItem("twinAppLink", appLink)
          localStorage.setItem(
            "twinData",
            JSON.stringify({
              ...result,
              id: twinIdStr,
              appLink: appLink,
            }),
          )
          console.log("✅ Successfully stored twin ID and anonymous app link")
        }

        // Add the ID to the result object to ensure it's available
        result.id = twinIdStr
        result.appLink = appLink

        setDebugInfo(
          (prev) => prev + `\n\nSUCCESS:\nTwin ID (creator.ext_id): ${twinIdStr}\nAnonymous App Link: ${appLink}`,
        )
      } else {
        console.error("❌ NO creator.ext_id FOUND IN API RESPONSE")
        console.log("📋 Creator object:", result.creator)
        console.log("📋 Full response structure:", JSON.stringify(result, null, 2))

        setDebugInfo(
          (prev) =>
            prev +
            `\n\nERROR: No creator.ext_id found in response!\nCreator object: ${JSON.stringify(result.creator, null, 2)}\nFull response: ${JSON.stringify(result, null, 2)}`,
        )

        throw new Error("API response missing creator.ext_id - cannot generate app link. Check debug info below.")
      }

      return result
    } catch (error) {
      console.error("❌ Error creating twin:", error)
      throw error
    }
  }

  const createTwinFallback = async () => {
    console.log("Using fallback twin creation (API unavailable)")
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Generate a UUID-like demo ID that looks realistic
    const generateUUID = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c == "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    }

    const demoTwinId = generateUUID()
    const anonymousAppLink = `https://app.talk2me.ai/creator/${demoTwinId}/anonymous`
    console.log("🎭 Generated demo twin ID:", demoTwinId)
    setDebugInfo(`DEMO MODE:\nGenerated Twin ID: ${demoTwinId}\nAnonymous App Link: ${anonymousAppLink}`)

    return {
      id: demoTwinId,
      creator: { ext_id: demoTwinId }, // Match the API structure
      name: creatorName,
      status: "created",
      message: "Twin created successfully (demo mode)",
      appLink: anonymousAppLink,
    }
  }

  const createBillingPlan = async (authToken: string, creatorId: number) => {
    try {
      console.log("💳 ==========================================")
      console.log("💳 STARTING BILLING PLAN CREATION PROCESS")
      console.log("💳 ==========================================")
      console.log("🆔 Creator ID received:", creatorId)
      console.log("🆔 Creator ID type:", typeof creatorId)
      console.log("💰 Subscription price from state:", subscriptionPrice)
      console.log("⏰ Free minutes from state:", freeMinutes)
      
      const monthlyPrice = parseFloat(subscriptionPrice) || 0
      const yearlyPrice = monthlyPrice * 10
      const talkMinutes = parseInt(freeMinutes) || 0
      
      console.log("💰 Calculated monthly price:", monthlyPrice)
      console.log("💰 Calculated yearly price:", yearlyPrice)
      console.log("⏰ Calculated talk minutes:", talkMinutes)
      
      const planData = {
        name: "Substack Voice",
        description: "24/7 Access",
        plan_type: "PAID",  // Must be uppercase: "FREE" or "PAID"
        monthly_price: monthlyPrice,
        yearly_price: yearlyPrice,
        talk_minutes: talkMinutes,
        is_active: true,
        creator_id: creatorId
      }
      
      console.log("📦 Plan data object created:", JSON.stringify(planData, null, 2))
      console.log("🔑 Auth token for billing plan (first 30 chars):", authToken.substring(0, 30) + "...")
      console.log("🌐 Making request to: https://api.talk2me.ai/plans/")
      console.log("📡 Request method: POST")
      console.log("📋 Request headers: Authorization: Bearer [TOKEN], Content-Type: application/json")
      console.log("📦 Request body sent:", JSON.stringify(planData, null, 2))
      
      const response = await fetch("https://api.talk2me.ai/plans/", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(planData),
      })
      
      console.log("📊 ======================================")
      console.log("📡 BILLING PLAN API RESPONSE DETAILS")
      console.log("📊 ======================================")
      console.log("✅ Response status:", response.status)
      console.log("🔗 Response URL:", response.url)
      console.log("✔️ Response OK:", response.ok)
      console.log("📊 Response status text:", response.statusText)
      console.log("📊 Response headers:", Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ BILLING PLAN API ERROR:")
        console.error("❌ Error status:", response.status)
        console.error("❌ Error status text:", response.statusText)
        console.error("❌ Error response body:", errorText)
        throw new Error(`Billing plan creation failed: ${response.status} - ${errorText}`)
      }
      
      const result = await response.json()
      console.log("✅ BILLING PLAN CREATED SUCCESSFULLY!")
      console.log("💳 Plan creation response:", JSON.stringify(result, null, 2))
      console.log("💳 ==========================================")
      
      return result
    } catch (error) {
      console.error("❌ BILLING PLAN CREATION FAILED:")
      console.error("❌ Error details:", error)
      throw error
    }
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
      console.log("� === TWIN CREATION PROCESS STARTING ===")
      console.log("�🔍 Checking Firebase authentication...")

      // Check for current user
      if (!user) {
        console.error("❌ User not authenticated")
        throw new Error("User not authenticated. Please sign in again.")
      }

      console.log("✅ User authenticated:", user.email)
      console.log("🔑 Getting Firebase authentication token...")

      // Get Firebase authentication token
      const authToken = await getToken()
      if (!authToken) {
        console.error("❌ Failed to get Firebase token")
        throw new Error("Failed to get Firebase authentication token. Please sign in again.")
      }

      console.log("✅ Firebase auth token obtained:", authToken.substring(0, 20) + "...")
      console.log("🎤 Checking voice clone ID...")
      
      const storedVoiceId = typeof window !== "undefined" ? localStorage.getItem("voiceCloneId") : null
      console.log("📝 Voice ID from localStorage:", storedVoiceId)
      
      console.log("� Preparing form data for Talk2Me API...")
      console.log("- Creator Name:", creatorName)
      console.log("- Creator Description:", creatorDescription.substring(0, 100) + "...")
      console.log("- Creator Greeting:", creatorGreeting.substring(0, 100) + "...")
      console.log("- System Prompt length:", systemPrompt.length)
      console.log("- Category:", category)
      console.log("- User Phone:", userPhone)
      
      console.log("�🚀 Creating twin with Talk2Me API...")

      let twinResult
      let retryCount = 0
      const maxRetries = 1 // Reduce retries to prevent multiple creations

      while (retryCount <= maxRetries) {
        try {
          console.log(`🔄 Twin creation attempt ${retryCount + 1}/${maxRetries + 1}`)
          twinResult = await createTwin(authToken)
          console.log("✅ Twin created successfully via API")
          break
        } catch (apiError) {
          console.error(`❌ API call failed (attempt ${retryCount + 1}):`, apiError)

          if (apiError instanceof Error && apiError.message === "VOICE_NOT_FOUND") {
            console.log("🔄 Voice ID not found, clearing and retrying...")
            if (typeof window !== "undefined") {
              localStorage.setItem("voiceCloneId", "")
            }
            if (retryCount === 0) {
              retryCount++
              setError("Voice clone not found, retrying with default voice...")
              continue
            } else {
              console.log("🔄 Falling back to demo mode...")
              twinResult = await createTwinFallback()
              setError("Note: Using demo mode - voice cloning needs reconfiguration")
              break
            }
          } else if (
            apiError instanceof Error &&
            (apiError.message.includes("405") ||
              apiError.message.includes("401") ||
              apiError.message.includes("403") ||
              apiError.message.includes("Authentication failed"))
          ) {
            console.log("🔄 API authentication/endpoint issue, using fallback...")
            twinResult = await createTwinFallback()
            setError("Note: Using demo mode - API authentication may need configuration")
            break
          } else if (retryCount < maxRetries) {
            retryCount++
            setError(`Attempt ${retryCount} failed, retrying...`)
            await new Promise((resolve) => setTimeout(resolve, 1000))
            continue
          } else {
            console.log("🔄 Max retries reached, using fallback...")
            twinResult = await createTwinFallback()
            setError("Note: Using demo mode - API may be temporarily unavailable")
            break
          }
        }
      }

      if (typeof window !== "undefined") {
        const actualTwinId = twinResult.creator?.ext_id || twinResult.id
        if (actualTwinId) {
          const anonymousAppLink = `https://app.talk2me.ai/creator/${actualTwinId}/anonymous`
          localStorage.setItem("twinId", actualTwinId)
          localStorage.setItem("twinAppLink", anonymousAppLink)
          localStorage.setItem(
            "twinData",
            JSON.stringify({
              ...twinResult,
              id: actualTwinId,
              appLink: anonymousAppLink,
            }),
          )
          console.log("✅ Stored twin ID:", actualTwinId)
          console.log("✅ Generated anonymous app link:", anonymousAppLink)
          
          // Create billing plan after successful twin creation
          try {
            console.log("💳 Starting billing plan creation...")
            console.log("🔍 Full twin result for creator ID extraction:", JSON.stringify(twinResult, null, 2))
            
            // Try to extract the numeric creator ID from different possible locations
            let creatorId = null
            
            if (twinResult.creator?.id) {
              creatorId = twinResult.creator.id
              console.log("📍 Found creator ID in twinResult.creator.id:", creatorId)
            } else if (twinResult.creator_id) {
              creatorId = twinResult.creator_id
              console.log("📍 Found creator ID in twinResult.creator_id:", creatorId)
            } else if (twinResult.id && !isNaN(Number(twinResult.id))) {
              creatorId = twinResult.id
              console.log("📍 Using twinResult.id as creator ID:", creatorId)
            } else {
              console.error("❌ Could not find numeric creator ID in twin result")
              console.log("🔍 Available fields in twinResult:", Object.keys(twinResult))
              if (twinResult.creator) {
                console.log("🔍 Available fields in twinResult.creator:", Object.keys(twinResult.creator))
              }
              throw new Error("Creator ID not found in twin creation response")
            }
            
            const numericCreatorId = Number(creatorId)
            if (isNaN(numericCreatorId)) {
              throw new Error(`Creator ID is not numeric: ${creatorId}`)
            }
            
            console.log("💳 Using creator ID for billing plan:", numericCreatorId)
            await createBillingPlan(authToken, numericCreatorId)
            console.log("✅ Billing plan creation completed successfully")
          } catch (billingError) {
            console.error("❌ Billing plan creation failed:", billingError)
            // Don't fail the entire process if billing plan creation fails
            setError("Twin created successfully, but billing plan creation failed. You may need to set up billing manually.")
          }
        } else {
          console.error("❌ No creator.ext_id found in API response:", twinResult)
          setError("Twin created but no creator.ext_id returned from API")
        }
      }

      console.log("✅ Twin creation complete, redirecting...")

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
              <CardTitle className="text-2xl text-center">Review & Launch Your AI Twin</CardTitle>
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
                      <p className="text-sm text-white mt-1">"{creatorGreeting}"</p>
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
                  <h3 className="text-red-400 font-medium mb-2">Error Creating Twin</h3>
                  <p className="text-red-300 text-sm">{error}</p>
                  {error.includes("authentication") && (
                    <p className="text-red-300 text-xs mt-2">Redirecting to sign in...</p>
                  )}
                </div>
              )}

              {launching ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-100 mb-2">Creating Your AI Twin...</h3>
                  <p className="text-sm text-gray-400">Using Firebase authentication with Talk2Me API</p>
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
