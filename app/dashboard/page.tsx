"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { User, MessageSquare, Mic, Settings, Rss, Globe, ExternalLink, Copy } from "lucide-react"

interface SubstackData {
  author: string
  posts: string[]
  category: string
  totalPosts: number
  variables: {
    SUBSTACK_URL: string
    RSS_URL: string
    CREATOR_NAME: string
    CREATOR_WEBSITE?: string
    CREATOR_SOCIAL?: string
  }
}

export default function Dashboard() {
  const [substackData, setSubstackData] = useState<SubstackData | null>(null)
  const [twinAppLink, setTwinAppLink] = useState<string>("")
  const [twinId, setTwinId] = useState<string>("")

  useEffect(() => {
    const stored = localStorage.getItem("substackAnalysis")
    const storedTwinId = localStorage.getItem("twinId")
    const storedAppLink = localStorage.getItem("twinAppLink")

    if (stored) {
      try {
        setSubstackData(JSON.parse(stored))
      } catch (error) {
        console.error("Error parsing stored data:", error)
      }
    }

    if (storedTwinId) {
      setTwinId(storedTwinId)
    }

    if (storedAppLink) {
      setTwinAppLink(storedAppLink)
      console.log("Dashboard: Using stored app link:", storedAppLink)
    } else if (storedTwinId && storedTwinId !== "created") {
      // Generate link if not stored and we have a valid twin ID
      const generatedLink = `https://app.talk2me.ai/creator/${storedTwinId}`
      setTwinAppLink(generatedLink)
      localStorage.setItem("twinAppLink", generatedLink)
      console.log("Dashboard: Generated app link from twin ID:", generatedLink)
    }
  }, [])

  if (!substackData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="w-full max-w-md bg-black border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">No Data Found</CardTitle>
            <CardDescription className="text-gray-300">Please complete the onboarding process first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = "/onboarding/step-1")} className="w-full">
              Start Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AI Twin Dashboard</h1>
          <p className="text-gray-300">Manage your AI twin powered by {substackData.author}'s content</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Creator Profile */}
          <Card className="bg-black border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <User className="h-5 w-5" />
                Creator Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">{substackData.author}</div>
                <Badge variant="secondary">{substackData.category}</Badge>
                <div className="text-sm text-gray-300">{substackData.totalPosts} posts analyzed</div>
              </div>
            </CardContent>
          </Card>

          {/* Chat Interface */}
          <Card className="bg-black border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <MessageSquare className="h-5 w-5" />
                Chat Interface
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-300 mb-4">Chat with your AI twin trained on your Substack content</p>
              <Button className="w-full">Start Chatting</Button>
            </CardContent>
          </Card>

          {/* Voice Clone */}
          <Card className="bg-black border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Mic className="h-5 w-5" />
                Voice Clone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-300 mb-4">Your AI twin can speak in your voice</p>
              <Button variant="outline" className="w-full bg-transparent">
                Test Voice
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Twin Link Card */}
        {twinAppLink && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Globe className="h-5 w-5" />
                Live AI Twin
              </CardTitle>
              <CardDescription className="text-gray-300">Your AI twin is live and ready for visitors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-300 mb-1">Twin ID:</div>
                  <div className="font-mono text-sm">{twinId}</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-600 mb-1">Public Link:</div>
                  <div className="text-sm text-gray-700 break-all">{twinAppLink}</div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => window.open(twinAppLink, "_blank")} className="flex-1">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Twin
                  </Button>
                  <Button
                    onClick={() => navigator.clipboard.writeText(twinAppLink)}
                    variant="outline"
                    className="flex-1 bg-transparent"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Variables */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Settings className="h-5 w-5" />
              System Variables
            </CardTitle>
            <CardDescription className="text-gray-300">Dynamic variables used by your AI twin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(substackData.variables).map(([key, value]) => (
                <div key={key} className="bg-gray-50 p-3 rounded-lg">
                  <div className="font-mono text-sm text-blue-600 mb-1">{key}</div>
                  <div className="text-sm text-gray-700 break-all">{value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Posts */}
        <Card className="bg-black border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Rss className="h-5 w-5" />
              Recent Posts
            </CardTitle>
            <CardDescription className="text-gray-300">Latest content from your Substack</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {substackData.posts.slice(0, 5).map((post, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="text-sm text-gray-700">{post}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
