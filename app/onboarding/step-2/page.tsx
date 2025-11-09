"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SubstackData {
  author: string
  posts: string[]
  category: string
  substackUrl: string
  rssUrl: string
  totalPosts: number
  description?: string
  variables: {
    SUBSTACK_URL: string
    RSS_URL: string
    CREATOR_NAME: string
    CREATOR_WEBSITE?: string
    CREATOR_SOCIAL?: string
  }
}

export default function Step2() {
  const [substackData, setSubstackData] = useState<SubstackData | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [greeting, setGreeting] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [category, setCategory] = useState("")
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro'>('starter')
  const [loading, setLoading] = useState(true) // Start with loading=true
  const [autoGenerationComplete, setAutoGenerationComplete] = useState(false)
  const [systemPromptEdited, setSystemPromptEdited] = useState(false) // Track if user edited the prompt
  const [regeneratingPrompt, setRegeneratingPrompt] = useState(false) // Track regeneration state
  const router = useRouter()
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [profilePicturePreview, setProfilePicturePreview] = useState<string>("")

  const categories = [
    "Art & Creativity",
    "Beauty & Makeup",
    "Business & Entrepreneurship",
    "Cooking & Recipes",
    "DIY & Crafting",
    "Educational Content",
    "Entertainment & Comedy",
    "Fashion & Lifestyle",
    "Fitness & Health",
    "Gaming",
    "Mental Health & Wellness",
    "Motivational & Self Improvement",
    "Parenting & Family",
    "Sports",
    "Technology & AI",  // Changed from "Technology & Gadgets" to match analysis
    "Travel & Adventure",
  ]

  // Plan options
  const planConfig = {
    starter: { price: '4.99', minutes: '60' },
    pro: { price: '9.99', minutes: '60' }
  }

  // Helper to fetch an image URL and convert to data URL for reliable preview/storage
  const fetchImageAsDataUrl = async (url: string): Promise<string | null> => {
    try {
      const encodedUrl = encodeURIComponent(url)
      const res = await fetch(`/api/proxy-image?url=${encodedUrl}`)
      if (!res.ok) {
        console.warn("⚠️ proxy-image returned", res.status)
        return null
      }
      const data = await res.json()
      if (!data?.success || !data?.dataUrl) {
        console.warn("⚠️ proxy-image payload missing dataUrl")
        return null
      }
      return data.dataUrl as string
    } catch (e) {
      console.warn("⚠️ Failed to fetch profile image URL via proxy, falling back to placeholder", e)
      return null
    }
  }

  useEffect(() => {
    console.log("🔄 Step 2 useEffect triggered")
    // Only access localStorage on the client side
    if (typeof window !== "undefined") {
      // Load data from localStorage
      const storedAnalysis = localStorage.getItem("substackAnalysis")
      console.log("📂 Stored analysis found:", !!storedAnalysis)

      if (storedAnalysis) {
        try {
          const analysisData: SubstackData = JSON.parse(storedAnalysis)
          console.log("📊 Analysis data parsed:", analysisData)
          setSubstackData(analysisData)

          // Auto-select content category based on analysis with smart mapping
          const analysisCategory = analysisData.category || "Educational Content"
          console.log("📊 Raw analysis category:", analysisCategory)
          
          // Smart category mapping to handle variations
          const categoryMapping = {
            "Technology & AI": "Technology & AI",
            "Technology & Gadgets": "Technology & AI",
            "Tech": "Technology & AI",
            "AI": "Technology & AI",
            "Business": "Business & Entrepreneurship",
            "Education": "Educational Content",
            "Health": "Fitness & Health",
            "Wellness": "Mental Health & Wellness",
            "Art": "Art & Creativity",
            "Creative": "Art & Creativity",
            "Food": "Cooking & Recipes",
            "Travel": "Travel & Adventure",
            "Sports": "Sports",
            "Gaming": "Gaming",
            "Entertainment": "Entertainment & Comedy",
            "Comedy": "Entertainment & Comedy",
            "Fashion": "Fashion & Lifestyle",
            "Lifestyle": "Fashion & Lifestyle",
            "Parenting": "Parenting & Family",
            "Family": "Parenting & Family",
            "Mental Health": "Mental Health & Wellness",
            "Motivation": "Motivational & Self Improvement",
            "Self Improvement": "Motivational & Self Improvement",
            "DIY": "DIY & Crafting",
            "Crafting": "DIY & Crafting",
            "Beauty": "Beauty & Makeup",
            "Makeup": "Beauty & Makeup"
          }
          
          // Try exact match first, then partial matches, then default
          let autoSelectedCategory = analysisCategory
          if (!categories.includes(analysisCategory)) {
            // Try mapping table
            autoSelectedCategory = categoryMapping[analysisCategory as keyof typeof categoryMapping]
            
            // If still no match, try partial matching
            if (!autoSelectedCategory) {
              const lowerAnalysisCategory = analysisCategory.toLowerCase()
              autoSelectedCategory = categories.find(cat => 
                lowerAnalysisCategory.includes(cat.toLowerCase()) ||
                cat.toLowerCase().includes(lowerAnalysisCategory)
              ) || "Educational Content"
            }
          }
          
          console.log("🎯 Auto-selected content category:", autoSelectedCategory)
          console.log("🔍 Category mapping result:", `${analysisCategory} → ${autoSelectedCategory}`)

          // Generate default profile picture placeholder URL
          const defaultProfilePicture = `https://ui-avatars.com/api/?name=${encodeURIComponent(analysisData.author)}&size=200&background=8b5cf6&color=ffffff&format=png&rounded=true&bold=true`
          console.log("🖼️ Generated placeholder profile picture:", defaultProfilePicture)

          // Try to use extracted Substack profile image if available
          const extractedProfileImage = (analysisData as any).profileImageUrl || (analysisData as any).variables?.CREATOR_IMAGE

          // Use analyzed data to populate fields
          const derivedDescription =
            analysisData.description ||
            `I'm a ${autoSelectedCategory.toLowerCase()} creator passionate about sharing insights and connecting with my audience. Through my Substack, I explore topics that matter and help others navigate this space.`

          // Generate personalized greeting
          const derivedGreeting = `Hi! I'm ${analysisData.author}. I love discussing ${autoSelectedCategory.toLowerCase().replace(" & ", " and ")} and sharing insights from my writing. I'm here to help answer questions about my content and explore ideas together. What would you like to talk about?`

          // Auto-generate comprehensive system prompt with dynamic variables
          console.log("🤖 Auto-generating system prompt...")
          const autoGeneratedSystemPrompt = `Function Tools (4 Available)
MANDATORY WORKFLOW: Always acknowledge → use tool → respond in creator's voice

DYNAMIC VARIABLES (Auto-populated for ${analysisData.author}):
- SUBSTACK_URL = ${analysisData.variables.SUBSTACK_URL}
- RSS_URL = ${analysisData.variables.RSS_URL}
- CREATOR_NAME = ${analysisData.variables.CREATOR_NAME}
- CREATOR_WEBSITE = ${analysisData.variables.CREATOR_WEBSITE || analysisData.variables.SUBSTACK_URL}
- CREATOR_SOCIAL = ${analysisData.variables.CREATOR_SOCIAL || analysisData.variables.SUBSTACK_URL}

1. fetch_rss_feed() - Content from SubStack
Triggers: Questions about ${analysisData.author}'s latest content, specific topics covered

Step 1: "Let me check my latest posts for you..."
Step 2: fetch_rss_feed("${analysisData.variables.RSS_URL}", 10)
Step 3: Analyze and respond with findings

2. fetch_website_data() - About/Bio Info
Website triggers: Background, bio, "about" questions

Step 1: "Let me get the current information from my website..."
Step 2: fetch_website_data("${analysisData.variables.SUBSTACK_URL}/about", true)
Step 3: If no about page, try: fetch_website_data("${analysisData.variables.CREATOR_WEBSITE || analysisData.variables.SUBSTACK_URL}", true)

3. fetch_social_data() - Social Media Posts
Social triggers: Recent posts, social content

Step 1: "Let me check my recent social posts..."
Step 2: fetch_website_data("${analysisData.variables.CREATOR_SOCIAL || analysisData.variables.SUBSTACK_URL}", true)
Step 3: If no social found, fallback to Substack main page

4. search_web() - Research & Trends
Triggers: Current research, industry trends, external topics

Step 1: "I'll look up the current research on that topic..."
Step 2: search_web() with relevant keywords
Step 3: Provide evidence-based insights in ${analysisData.author}'s voice

You are ${analysisData.author}, an AI twin of a ${autoSelectedCategory.toLowerCase()} creator and writer. You embody their voice, knowledge, and personality based on their Substack content.

IDENTITY & BACKGROUND:
- You are ${analysisData.author}, creator of their Substack newsletter
- Your content focuses on: ${autoSelectedCategory}
- Your writing style and expertise: ${derivedDescription.substring(0, 200)}
- You have published ${analysisData.totalPosts} posts including: ${analysisData.posts.slice(0, 3).join(", ")}

PERSONALITY & TONE:
- Conversational yet knowledgeable - you explain topics in an accessible way
- Authentic to your established voice and writing style
- Supportive and engaging with your audience
- Curious and always eager to explore new perspectives within your domain
- Professional but approachable - you balance expertise with relatability

KNOWLEDGE AREAS:
- ${autoSelectedCategory} and related topics
- Insights from your published Substack posts
- Trends and developments in your field of expertise
- Practical advice and actionable insights
- Community building and audience engagement

COMMUNICATION STYLE:
- Reference your actual published content when relevant using the RSS feed
- Share insights from your writing and experience
- Ask thoughtful follow-up questions to understand the user's context
- Provide actionable advice when appropriate
- Maintain authenticity to your established voice and perspectives
- Use examples from your content area to illustrate points

BOUNDARIES:
- Stay focused on topics related to your expertise and content areas
- If asked about topics outside your knowledge areas, acknowledge limitations and redirect to your strengths
- Don't provide professional advice outside your domain (medical, legal, financial unless that's your expertise)
- Always maintain the perspective and voice of ${analysisData.author}

ENGAGEMENT APPROACH:
- Begin conversations warmly and show genuine interest in the user's goals
- Tailor your responses to the user's level of knowledge
- Share relevant examples from your content when helpful using the RSS feed tool
- Encourage meaningful dialogue rather than just providing information
- Foster community and connection around your content themes

Voice-Mode Rules:
Length: One paragraph, 2-4 sentences (45-85 words). Max 125 words with opt-in "Want the longer version?"
Questions: ≤1 question every two turns
Novelty: Add one net-new element each turn (fresh example, stat, analogy, tip)
No repetition: Don't repeat same myth/example twice in a row
Style: No lists unless ≤4 items. Short sentences. No stage directions.
Personality: Match ${analysisData.author}'s tone and expertise in ${autoSelectedCategory}.

Remember: You are not just an AI assistant, but ${analysisData.author}'s digital twin. Embody their unique perspective, expertise, and communication style in every interaction while staying true to their ${autoSelectedCategory.toLowerCase()} focus.`

          // Set all derived values (auto-populated)
          console.log("📝 Setting form values...")
          setName(analysisData.author)
          setDescription(derivedDescription)
          setGreeting(derivedGreeting)
          setSystemPrompt(autoGeneratedSystemPrompt)
          setCategory(autoSelectedCategory)
          setSelectedPlan('starter') // Default to starter plan

          // If we have an extracted image, show it immediately; then try to upgrade to data URL in background
          if (extractedProfileImage && typeof extractedProfileImage === "string") {
            // Immediate display using cross-origin image URL
            setProfilePicturePreview(extractedProfileImage)
            try { localStorage.setItem("profilePicturePreview", extractedProfileImage) } catch {}
            console.log("🖼️ Showing extracted Substack profile image (URL)")

            // Background attempt to convert to data URL (may fail due to CORS; safe to ignore)
            fetchImageAsDataUrl(extractedProfileImage).then((dataUrl) => {
              if (dataUrl) {
                setProfilePicturePreview(dataUrl)
                try { localStorage.setItem("profilePicturePreview", dataUrl) } catch {}
                console.log("🖼️ Upgraded profile image to data URL")
              }
            }).catch(() => {/* ignore */})
          } else {
            setProfilePicturePreview(defaultProfilePicture)
            try { localStorage.setItem("profilePicturePreview", defaultProfilePicture) } catch {}
          }

          console.log("✅ Auto-population complete:")
          console.log("- Name:", analysisData.author)
          console.log("- Category:", autoSelectedCategory, "(auto-selected)")
          console.log("- Description length:", derivedDescription.length)
          console.log("- Greeting length:", derivedGreeting.length)
          console.log("- System prompt length:", autoGeneratedSystemPrompt.length)
          console.log("- Profile picture:", defaultProfilePicture)

          setAutoGenerationComplete(true)
          setLoading(false)

          // After auto-generation completes, regenerate the system prompt one more time using the API
          console.log("🔄 Initiating second system prompt regeneration...")
          setTimeout(async () => {
            try {
              setRegeneratingPrompt(true)
              console.log("🤖 Regenerating system prompt via API (second generation)...")
              
              const result = await fetch('/api/generate-system-prompt', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  rssUrl: `${analysisData.variables.SUBSTACK_URL}/feed`,
                  substackUrl: analysisData.variables.SUBSTACK_URL,
                  additionalRestrictions: "",
                  workflowVariables: "N8n automation workflows, content distribution"
                }),
              })

              console.log("📡 Second regeneration API response status:", result.status)

              if (result.ok) {
                const data = await result.json()
                
                if (data.success && data.data?.systemPrompt) {
                  setSystemPrompt(data.data.systemPrompt)
                  setSystemPromptEdited(false)
                  console.log("✅ Second system prompt regeneration completed successfully")
                  console.log("📝 New system prompt length:", data.data.systemPrompt.length)
                } else {
                  console.error("❌ Second regeneration failed:", data.error)
                }
              } else {
                console.error("❌ Second regeneration API error:", result.status)
              }
            } catch (error) {
              console.error("❌ Error during second system prompt regeneration:", error)
            } finally {
              setRegeneratingPrompt(false)
            }
          }, 2000) // Wait 2 seconds after auto-generation completes
        } catch (error) {
          console.error("❌ Error parsing stored analysis data:", error)
          // Fallback to default values
          setCategory("Educational Content")
          setSelectedPlan('starter') // Default to starter plan
          setAutoGenerationComplete(false)
          setLoading(false)
        }
      } else {
        console.log("❌ No stored analysis found, redirecting to step 1")
        // No stored data, redirect back to step 1
        router.push("/onboarding/step-1")
      }
    }
  }, [router])

  const handleRegenerateSystemPrompt = async () => {
    if (!substackData) return

    setRegeneratingPrompt(true)
    try {
      console.log("🔄 Regenerating system prompt...")
      const result = await fetch('/api/generate-system-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rssUrl: `${substackData.variables.SUBSTACK_URL}/feed`,
          substackUrl: substackData.variables.SUBSTACK_URL,
          additionalRestrictions: "",
          workflowVariables: "N8n automation workflows, content distribution"
        }),
      })

      const data = await result.json()
      
      if (data.success && data.data?.systemPrompt) {
        setSystemPrompt(data.data.systemPrompt)
        setSystemPromptEdited(false) // Reset the edited flag after regeneration
        console.log("✅ System prompt regenerated successfully")
      } else {
        console.error("❌ Failed to regenerate system prompt:", data.error)
      }
    } catch (error) {
      console.error("❌ Error regenerating system prompt:", error)
    } finally {
      setRegeneratingPrompt(false)
    }
  }

  const handleSystemPromptChange = (value: string) => {
    setSystemPrompt(value)
    setSystemPromptEdited(true) // Mark as edited when user manually changes it
  }

  const handleContinue = () => {
    // Only access localStorage on the client side
    if (typeof window !== "undefined") {
      // Store the profile data and move to next step
      localStorage.setItem("creatorName", name)
      localStorage.setItem("creatorDescription", description)
      localStorage.setItem("creatorGreeting", greeting)
      localStorage.setItem("systemPrompt", systemPrompt)
      localStorage.setItem("category", category)
      localStorage.setItem("freeMinutes", planConfig[selectedPlan].minutes)
      localStorage.setItem("subscriptionPrice", planConfig[selectedPlan].price)
      if (profilePicturePreview) {
        localStorage.setItem("profilePicturePreview", profilePicturePreview)
      }
    }
    router.push("/onboarding/step-3")
  }

  const isFormValid =
    name.trim() &&
    description.trim() &&
    greeting.trim() &&
    systemPrompt.trim() &&
    category &&
    selectedPlan

  const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      setProfilePicture(file)

      // Create preview URL
      const reader = new FileReader()
      reader.onload = (e) => {
        setProfilePicturePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-100 mb-2">🤖 Auto-Generating Your Profile...</h3>
              <p className="text-sm text-gray-400 mb-2">
                Analyzing your Substack content and creating personalized settings
              </p>
              <div className="text-xs text-blue-400 space-y-1">
                <div>✨ Auto-selecting content category...</div>
                <div>✨ Generating system prompt with GPT-4...</div>
                <div>✨ Creating profile picture placeholder...</div>
                <div>✨ Personalizing description and greeting...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!substackData) {
    return (
      <div className="min-h-screen bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-16">
              <h3 className="text-lg font-medium text-gray-100 mb-2">No Analysis Data Found</h3>
              <p className="text-sm text-gray-400 mb-4">Please complete Step 1 first</p>
              <Button onClick={() => router.push("/onboarding/step-1")} className="bg-purple-600 hover:bg-purple-700">
                Go to Step 1
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-indigo-600">Step 2 of 4</span>
              <span className="text-sm text-gray-300">Profile Setup</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full w-2/4"></div>
            </div>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-2xl text-center text-white">Set Up Your Profile</CardTitle>
              <p className="text-gray-300 text-center">
                Customize how your AI twin introduces itself with dynamic variables
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto-Generated Notice */}
              {/*
              {autoGenerationComplete && (
                <div className="bg-green-900/20 rounded-lg p-4 border border-green-700">
                  <h3 className="text-lg font-medium text-green-300 mb-2">✨ Auto-Generated Profile Complete!</h3>
                  <div className="space-y-2 text-sm text-green-200">
                    <div>✅ Content category: <span className="font-semibold">{category}</span> (auto-selected)</div>
                    <div>✅ System prompt: <span className="font-semibold">{systemPrompt.length} characters</span> (auto-generated)</div>
                    <div>✅ Profile picture placeholder created</div>
                    <div>✅ Description and greeting personalized</div>
                  </div>
                  <p className="text-xs text-green-400 mt-2">
                    Everything has been intelligently pre-filled based on your Substack analysis - customize as needed!
                  </p>
                </div>
              )}
              */}

              {/* Dynamic Variables Display */}
              {/*
              <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700">
                <h3 className="text-lg font-medium text-blue-300 mb-3">🔧 Generated System Variables</h3>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="bg-gray-700/50 p-2 rounded">
                    <span className="font-mono text-blue-400">RSS_URL:</span>
                    <span className="text-gray-300 ml-2 break-all">{substackData.variables.RSS_URL}</span>
                  </div>
                  <div className="bg-gray-700/50 p-2 rounded">
                    <span className="font-mono text-blue-400">CREATOR_NAME:</span>
                    <span className="text-gray-300 ml-2">{substackData.variables.CREATOR_NAME}</span>
                  </div>
                  <div className="bg-gray-700/50 p-2 rounded">
                    <span className="font-mono text-blue-400">SUBSTACK_URL:</span>
                    <span className="text-gray-300 ml-2 break-all">{substackData.variables.SUBSTACK_URL}</span>
                  </div>
                </div>
                <p className="text-xs text-blue-400 mt-2">
                  ✅ These variables are automatically used in your system prompt
                </p>
              </div>
              */}

              {/* Name Field */}
              <div>
                <label htmlFor="creator-name" className="block text-sm font-medium text-gray-300 mb-2">
                  Your Name
                </label>
                <Input
                  id="creator-name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-700 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">This is how your AI twin will identify itself</p>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Content Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Select your content category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Auto-detected from your Substack content</p>
              </div>

              {/* Profile Picture Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Profile Picture</label>
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center border-2 border-gray-600 overflow-hidden">
                    {profilePicturePreview ? (
                      <img
                        src={profilePicturePreview || "/placeholder.svg"}
                        alt="Profile preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      className="hidden"
                      id="profile-picture-upload"
                    />
                    <label
                      htmlFor="profile-picture-upload"
                      className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      Upload Picture
                    </label>
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG, or GIF up to 5MB</p>
                  </div>
                </div>
              </div>

              {/* Description Field */}
              <div>
                <label htmlFor="creator-description" className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <Textarea
                  id="creator-description"
                  placeholder="Describe yourself and what you write about..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-700 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Auto-generated from your Substack content - feel free to edit
                </p>
              </div>

              {/* Greeting Field */}
              <div>
                <label htmlFor="creator-greeting" className="block text-sm font-medium text-gray-300 mb-2">
                  Default Greeting
                </label>
                <Textarea
                  id="creator-greeting"
                  placeholder="How should your twin greet new visitors?"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-700 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Personalized greeting based on your content and style</p>
              </div>

              {/* System Prompt Field - Manual Edit */}
              {/*
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="system-prompt" className="block text-sm font-medium text-gray-300">
                    AI System Prompt (Auto-Generated)
                  </label>
                  {systemPromptEdited && (
                    <Button
                      onClick={handleRegenerateSystemPrompt}
                      disabled={regeneratingPrompt}
                      size="sm"
                      variant="outline"
                      className="border-gray-600 hover:bg-gray-700 text-xs"
                    >
                      {regeneratingPrompt ? (
                        <span className="flex items-center">
                          <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></span>
                          Regenerating...
                        </span>
                      ) : (
                        "Regenerate System Prompt"
                      )}
                    </Button>
                  )}
                </div>
                <Textarea
                  id="system-prompt"
                  placeholder="Instructions for how your AI twin should behave and respond..."
                  value={systemPrompt}
                  onChange={(e) => handleSystemPromptChange(e.target.value)}
                  rows={12}
                  className="w-full bg-gray-700 border-gray-600 text-white text-xs font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ✅ Use the generator above to create an AI-powered prompt, then edit manually if needed
                </p>
              </div>
              */}

              <Button
                onClick={handleContinue}
                disabled={!isFormValid}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Continue to Voice Setup
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
