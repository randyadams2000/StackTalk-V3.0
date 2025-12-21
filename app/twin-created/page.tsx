"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, MessageSquare, ExternalLink, Copy, Globe, Shield, AlertCircle } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

interface TwinData {
  author: string
  category: string
  totalPosts: number
  variables: {
    SUBSTACK_URL: string
    RSS_URL: string
    CREATOR_NAME: string
    CREATOR_WEBSITE?: string
    CREATOR_SOCIAL?: string
    CREATOR_IMAGE?: string
  }
}

export default function TwinCreated() {
  const { user } = useAuth()
  const [twinData, setTwinData] = useState<TwinData | null>(null)
  const [twinAppLink, setTwinAppLink] = useState<string>("")
  const [twinId, setTwinId] = useState<string>("")
  const [isVerified, setIsVerified] = useState<boolean>(false)
  const [isVerifying, setIsVerifying] = useState<boolean>(false)
  const [verificationError, setVerificationError] = useState<string>("")
  const [substackUrl, setSubstackUrl] = useState<string>("")

  // Function to format Substack URL properly
  const formatSubstackUrl = (url: string): string => {
    if (!url) return ""
    
    // Remove trailing slashes
    let formattedUrl = url.replace(/\/+$/, "")
    
    // Add https:// if no protocol is specified
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = "https://" + formattedUrl
    }
    
    // Handle @username format (e.g., https://substack.com/@staytuned)
    if (formattedUrl.includes("substack.com/@")) {
      const match = formattedUrl.match(/substack\.com\/@(.+)/)
      if (match && match[1]) {
        const username = match[1]
        return `https://${username}.substack.com`
      }
    }
    
    // Ensure it's a proper Substack URL format
    if (formattedUrl.includes(".substack.com")) {
      return formattedUrl
    } else if (formattedUrl.includes("substack.com/") && !formattedUrl.includes(".substack.com")) {
      // Convert from substack.com/username format to username.substack.com format
      const parts = formattedUrl.split("substack.com/")
      if (parts.length === 2 && parts[1]) {
        const protocol = parts[0].includes("://") ? parts[0] : "https://substack.com/"
        return `https://${parts[1]}.substack.com`
      }
    }
    
    return formattedUrl
  }

  useEffect(() => {
    const stored = localStorage.getItem("substackAnalysis")
    const storedTwinData = localStorage.getItem("twinData")
    const storedAgentId = localStorage.getItem("agentId")
    const storedTwinId = localStorage.getItem("twinId")
    const storedAgentLink = localStorage.getItem("agentLink")
    const storedAppLink = localStorage.getItem("twinAppLink")

    if (stored) {
      try {
        const parsedData = JSON.parse(stored)
        setTwinData(parsedData)
        if (parsedData.variables?.SUBSTACK_URL) {
          const formattedUrl = formatSubstackUrl(parsedData.variables.SUBSTACK_URL)
          setSubstackUrl(formattedUrl)
        }
      } catch (error) {
        console.error("Error parsing stored data:", error)
      }
    }

    const effectiveId = storedAgentId || storedTwinId || ""
    if (effectiveId) setTwinId(effectiveId)

    const effectiveLink = storedAgentLink || storedAppLink
    if (effectiveLink) {
      setTwinAppLink(effectiveLink)
      console.log("✅ Using stored link:", effectiveLink)
    } else if (effectiveId) {
      const generatedLink = `${window.location.origin}/dashboard?agentId=${encodeURIComponent(effectiveId)}`
      setTwinAppLink(generatedLink)
      localStorage.setItem("agentLink", generatedLink)
      localStorage.setItem("twinAppLink", generatedLink)
      console.log("🔗 Generated link from agent ID:", generatedLink)
    } else {
      console.warn("⚠️ No valid agent ID found for link generation")
    }
  }, [])

  const handleTestVoiceBot = () => {
    const agentId = String(twinId || "").trim()
    if (!agentId) return

    const creatorName =
      (typeof window !== "undefined" ? localStorage.getItem("creatorName") : "") ||
      twinData?.variables?.CREATOR_NAME ||
      twinData?.author ||
      ""

    const storedUrl = typeof window !== "undefined" ? localStorage.getItem("profilePictureUrl") || "" : ""
    const storedPreview = typeof window !== "undefined" ? localStorage.getItem("profilePicturePreview") || "" : ""
    const imageUrl =
      (storedUrl && /^https?:\/\//i.test(storedUrl) ? storedUrl : "") ||
      (storedPreview && /^https?:\/\//i.test(storedPreview) ? storedPreview : "") ||
      (twinData as any)?.profileImageUrl ||
      twinData?.variables?.CREATOR_IMAGE ||
      ""

    const targetUrl = `https://the.talk2me.bot/voice-chat?name=${encodeURIComponent(
      creatorName,
    )}&image=${encodeURIComponent(imageUrl)}&agent=${encodeURIComponent(agentId)}`

    // Open in the same window/tab
    window.location.href = targetUrl
  }

  const handleCopyTwinId = async () => {
    if (twinId) {
      try {
        await navigator.clipboard.writeText(twinAppLink)
        console.log("Persona ID copied to clipboard")
      } catch (error) {
        console.error("Failed to copy twin ID:", error)
      }
    }
  }

  const verifySubstackOwnership = async () => {
    if (!substackUrl || !twinId) {
      setVerificationError("Missing Substack URL or Twin ID")
      return
    }

    setIsVerifying(true)
    setVerificationError("")

    try {
      const aboutUrl = `${substackUrl}/about`
      
      // Fetch the about page content
      const response = await fetch(`/api/verify-substack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aboutUrl: aboutUrl,
          agentId: twinId,
          verificationLink: twinAppLink,
        }),
      })

      const result = await response.json()

      if (response.ok && result.verified) {
        // Set verified state
        setIsVerified(true)
        setVerificationError("")
        if (typeof window !== "undefined") {
          localStorage.setItem("ownershipVerified", "true")
        }
      } else {
        setVerificationError(result.error || "Verification failed. Please make sure the Twin ID is in your Substack about page.")
      }
    } catch (error) {
      console.error("Verification error:", error)
      setVerificationError("Network error during verification. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  if (!twinData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Card className="w-full max-w-md bg-black border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Loading...</CardTitle>
            <CardDescription className="text-gray-300">Preparing your Persona</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/20 rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">🎉 Your Persona is Ready!</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            {twinData.author}&apos;s Persona has been successfully created with dynamic system variables
          </p>
        </div>

        {/* Test VoiceBot Section */}
        <Card className="mb-8 shadow-lg border-blue-600/30 bg-black">
          <CardHeader className="bg-blue-900/20">
            <CardTitle className="flex items-center gap-2 text-blue-400">
              <MessageSquare className="h-5 w-5" />
              Your Persona is Ready!
            </CardTitle>
            <CardDescription className="text-blue-300">
              Test your Persona and see how it responds to questions
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center">
              <Button 
                onClick={handleTestVoiceBot} 
                size="lg" 
                className="bg-purple-600 hover:bg-purple-700 px-8"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Test Your Persona
              </Button>
            </div>
          </CardContent>
        </Card>


        {/* Verification Section */}
        <Card className="mb-8 shadow-lg border-orange-600/30 bg-black">
          <CardHeader className="bg-orange-900/20">
            <CardTitle className="flex items-center gap-2 text-orange-400">
              <Shield className="h-5 w-5" />
              Next Step: Verify Ownership
            </CardTitle>
            <CardDescription className="text-orange-300">
              Publish your StackTalk and allow others to use it
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="bg-orange-900/20 rounded-lg p-4 border border-orange-600/30 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-orange-200">
                  <p className="font-medium mb-2">Verification Required</p>
                  <p>In order to verify your ownership of this substack page, please edit your profile, and add the URL below somewhere on your about page (can be temporary for validation) then click the Verify Ownership button below.                    
                  </p>
                </div>
              </div>
            </div>

            {/* Twin ID Display */}
            <div className="bg-black rounded-lg p-4 border mb-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm text-gray-300 mb-1">Add this link (can be tremporary) somewhere on you about page and click the button below..</div>
                  <div className="font-mono text-lg text-gray-900 bg-gray-100 px-3 py-2 rounded border">
                    {twinAppLink}
                  </div>
                </div>
                <Button onClick={handleCopyTwinId} variant="outline" className="ml-4">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            </div>

            {/* Substack About Page Link */}
            {substackUrl && (
              <div className="mb-4">
                <p className="text-sm text-gray-300 mb-2">Your Substack about page:</p>
                <a 
                  href={`${substackUrl}/about`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline text-sm"
                >
                  {substackUrl}/about
                </a>
              </div>
            )}

            {/* Verification Status */}
            {isVerified ? (
              <div className="bg-green-900/20 rounded-lg p-4 border border-green-600/30 mb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div className="text-green-200">
                    <p className="font-medium">✅ Verified Successfully!</p>
                    <p className="text-sm">Your Persona is now published and available for others to use.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Button 
                  onClick={verifySubstackOwnership}
                  disabled={isVerifying}
                  className="bg-purple-600 hover:bg-purple-700"
                  size="lg"
                >
                  {isVerifying ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Verify Ownership
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Verification Error */}
            {verificationError && (
              <div className="bg-red-900/20 rounded-lg p-4 border border-red-600/30 mt-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="text-red-200">
                    <p className="font-medium">Verification Failed</p>
                    <p className="text-sm">{verificationError}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stripe Connection Section */}
        <Card className="mb-8 shadow-lg border-green-600/30 bg-black">
          <CardHeader className="bg-green-900/20">
            <CardTitle className="flex items-center gap-2 text-green-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Terms and Conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto leading-relaxed">
                Your fans will get 15 free minutes of access and then they will be asked to subscribe at $4.99/month. 
                You will receive $3.99 of that payment. We will distribute the payment to you monthly via Zelle or your perferred method of payment.
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
