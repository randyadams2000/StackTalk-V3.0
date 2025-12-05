"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, AlertCircle, ExternalLink, Rss, User, BookOpen, Globe } from "lucide-react"
import { formatSubstackUrl } from "@/lib/utils"

interface AnalysisData {
  author: string
  posts: string[]
  category: string
  rssUrl: string
  substackUrl: string
  totalPosts: number
  aboutUrl?: string
  socialUrls?: string[]
  description?: string
  variables: {
    SUBSTACK_URL: string
    RSS_URL: string
    CREATOR_NAME: string
    CREATOR_WEBSITE?: string
    CREATOR_SOCIAL?: string
  }
}

interface AnalysisResult {
  success: boolean
  data: AnalysisData
  error?: string
}

export default function Step1() {
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState("")
  const router = useRouter()

  const validateUrl = (inputUrl: string): boolean => {
    try {
      const urlObj = new URL(inputUrl)
      return urlObj.hostname.includes("substack.com") || urlObj.hostname.endsWith(".substack.com")
    } catch {
      return false
    }
  }

  const analyzeSubstack = async () => {
    if (!url.trim()) {
      setError("Please enter a Substack URL")
      return
    }

    // Normalize URL to desired format, including converting https://substack.com/@user -> https://user.substack.com/
    const normalizedUrl = formatSubstackUrl(url.trim())

    if (!validateUrl(normalizedUrl)) {
      setError("Please enter a valid Substack URL (e.g., https://example.substack.com)")
      return
    }

    setIsAnalyzing(true)
    setError("")
    setAnalysisResult(null)

    try {
      console.log("🚀 Starting analysis for:", normalizedUrl)

      const response = await fetch("/api/scrape-substack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: normalizedUrl }),
      })

      const result: AnalysisResult = await response.json()
      console.log("📊 Analysis result:", result)

      // Check for critical RSS connection error
      if (!result.success && result.error === "CANNOT_CONNECT_TO_SUBSTACK") {
        setIsAnalyzing(false)
        alert("I'm sorry, cannot continue. Unable to connect to your Substack page.")
        setError("Unable to connect to Substack RSS feed. Please verify the URL is correct and the Substack page is accessible.")
        return
      }

      setAnalysisResult(result)

      // Store comprehensive data for next steps and system prompt variables
      const storageData = {
        ...result.data,
        originalUrl: url.trim(),
        normalizedUrl,
        analysisTimestamp: new Date().toISOString(),
      }

      localStorage.setItem("substackAnalysis", JSON.stringify(storageData))
      localStorage.setItem("systemPromptVariables", JSON.stringify(result.data.variables))

      if (!result.success && result.error) {
        setError(`Analysis completed with issues: ${result.error}`)
      }
    } catch (err) {
      console.error("❌ Analysis error:", err)
      setError("Network error. Please check your connection and try again.")
    } finally {
      setIsAnalyzing(false)
      router.push("/onboarding/step-2")
    }
  }

  const handleContinue = () => {
    if (analysisResult?.data) {
      router.push("/onboarding/step-2")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isAnalyzing && url.trim()) {
      analyzeSubstack()
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-3xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3">Connect Your Substack</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Let's analyze your media content to create your media persona
          </p>
        </div>

        {/* URL Input Card */}
        <Card className="mb-6 shadow-lg bg-black border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Rss className="h-5 w-5 text-orange-500" />
              Substack URL Analysis
            </CardTitle>
            <CardDescription className="text-gray-300">
              Enter your Substack URL to analyze your writing style, topics, and create dynamic system variables
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://yourname.substack.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 text-lg"
                disabled={isAnalyzing}
              />
              <Button
                onClick={analyzeSubstack}
                disabled={isAnalyzing || !url.trim()}
                className="min-w-[140px] bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze Content"
                )}
              </Button>
            </div>

            <div className="text-sm text-gray-500">
              <p>
                <strong>Example:</strong> https://natesnewsletter.substack.com
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-600/30 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysisResult?.data && (
          <Card className="mb-6 shadow-lg border-green-600/30 bg-black">
            <CardHeader className="bg-green-900/20">
              <CardTitle className="flex items-center gap-2 text-green-400">
                <CheckCircle className="h-5 w-5" />
                Analysis Complete
                {!analysisResult.success && (
                  <Badge variant="outline" className="text-orange-400 border-orange-600/30">
                    Partial Data
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-green-300">
                Successfully analyzed your Substack and generated system variables
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Creator Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-900/20 rounded-lg border border-blue-600/30">
                  <User className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                  <div className="text-xl font-bold text-blue-200">{analysisResult.data.author}</div>
                  <div className="text-sm text-blue-300">Creator</div>
                </div>
                <div className="text-center p-4 bg-green-900/20 rounded-lg border border-green-600/30">
                  <BookOpen className="h-8 w-8 text-green-400 mx-auto mb-2" />
                  <div className="text-xl font-bold text-green-200">{analysisResult.data.totalPosts}</div>
                  <div className="text-sm text-green-300">Posts Found</div>
                </div>
                <div className="text-center p-4 bg-purple-900/20 rounded-lg border border-purple-600/30">
                  <div className="mb-2">
                    <Badge variant="secondary" className="text-sm bg-purple-800 text-purple-200">
                      {analysisResult.data.category}
                    </Badge>
                  </div>
                  <div className="text-sm text-purple-300">Content Category</div>
                </div>
              </div>

              {/* System Variables */}
              <div className="bg-black/50 rounded-lg p-4 border border-gray-600">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Generated System Variables
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-700 p-3 rounded border border-gray-600">
                    <div className="font-mono text-blue-400">SUBSTACK_URL</div>
                    <div className="text-gray-300 break-all">{analysisResult.data.variables.SUBSTACK_URL}</div>
                  </div>
                  <div className="bg-gray-700 p-3 rounded border border-gray-600">
                    <div className="font-mono text-blue-400">RSS_URL</div>
                    <div className="text-gray-300 break-all">{analysisResult.data.variables.RSS_URL}</div>
                  </div>
                  <div className="bg-gray-700 p-3 rounded border border-gray-600">
                    <div className="font-mono text-blue-400">CREATOR_NAME</div>
                    <div className="text-gray-300">{analysisResult.data.variables.CREATOR_NAME}</div>
                  </div>
                  <div className="bg-gray-700 p-3 rounded border border-gray-600">
                    <div className="font-mono text-blue-400">CREATOR_WEBSITE</div>
                    <div className="text-gray-300 break-all">{analysisResult.data.variables.CREATOR_WEBSITE}</div>
                  </div>
                </div>
              </div>

              {/* Recent Posts */}
              <div>
                <h4 className="font-semibold text-white mb-3">Recent Posts:</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {analysisResult.data.posts.slice(0, 8).map((post, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="w-6 h-6 bg-blue-900/30 text-blue-400 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div className="text-sm text-gray-300 leading-relaxed">{post}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              {analysisResult.data.description && (
                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-600/30">
                  <h4 className="font-semibold text-blue-400 mb-2">Newsletter Description:</h4>
                  <p className="text-blue-300 text-sm leading-relaxed">{analysisResult.data.description}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={handleContinue} className="flex-1 bg-purple-600 hover:bg-purple-700" size="lg">
                  Continue to Voice Setup
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(analysisResult.data.rssUrl, "_blank")}
                  className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700"
                  size="lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  View RSS Feed
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Indicator */}
        <div className="text-center text-sm text-gray-400">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
              1
            </div>
            <div className="w-16 h-1 bg-gray-700 rounded"></div>
            <div className="w-8 h-8 bg-gray-700 text-gray-500 rounded-full flex items-center justify-center text-xs font-semibold">
              2
            </div>
            <div className="w-16 h-1 bg-gray-700 rounded"></div>
            <div className="w-8 h-8 bg-gray-700 text-gray-500 rounded-full flex items-center justify-center text-xs font-semibold">
              3
            </div>
            <div className="w-16 h-1 bg-gray-700 rounded"></div>
            <div className="w-8 h-8 bg-gray-700 text-gray-500 rounded-full flex items-center justify-center text-xs font-semibold">
              4
            </div>
          </div>
          <p>Step 1 of 4: Content Analysis & Variable Generation</p>
        </div>
      </div>
    </div>
  )
}
