"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

interface SystemPromptGeneratorProps {
  substackUrl?: string
  onPromptGenerated?: (prompt: string) => void
  className?: string
}

export default function SystemPromptGenerator({
  substackUrl = "",
  onPromptGenerated,
  className = ""
}: SystemPromptGeneratorProps) {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [additionalRestrictions, setAdditionalRestrictions] = useState("")
  const [workflowVariables, setWorkflowVariables] = useState("N8n automation workflows, content distribution")
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!substackUrl) {
      setResponse({
        success: false,
        error: "Please provide a Substack URL"
      })
      return
    }

    setLoading(true)
    setResponse(null)

    try {
      const result = await fetch('/api/generate-system-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rssUrl: `${substackUrl}/feed`,
          substackUrl,
          additionalRestrictions,
          workflowVariables
        }),
      })

      const data = await result.json()
      setResponse(data)

      if (data.success && data.data?.systemPrompt && onPromptGenerated) {
        onPromptGenerated(data.data.systemPrompt)
      }
    } catch (error) {
      setResponse({
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate system prompt"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (response?.data?.systemPrompt && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(response.data.systemPrompt)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  const handleDownload = () => {
    if (response?.data?.systemPrompt && response?.data?.variables?.creator_name) {
      const blob = new Blob([response.data.systemPrompt], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${response.data.variables.creator_name.replace(/[^a-zA-Z0-9]/g, '_')}_system_prompt.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <Card className={`bg-black border-gray-700 ${className}`}>
      <CardHeader>
        <CardTitle className="text-xl text-white flex items-center gap-2">
          🤖 AI System Prompt Generator
          {response?.success && (
            <span className="text-xs bg-green-900 text-green-100 border border-green-700 px-2 py-1 rounded">
              Generated
            </span>
          )}
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Generate a custom system prompt based on your Substack content using GPT-5.1
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Substack URL
          </label>
          <div className="bg-gray-700 rounded-lg p-3 text-sm text-gray-300">
            {substackUrl || "No Substack URL provided"}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Additional Content Restrictions (Optional)
          </label>
          <Textarea
            value={additionalRestrictions}
            onChange={(e) => setAdditionalRestrictions(e.target.value)}
            placeholder="e.g., cryptocurrency discussion, personal medical advice..."
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Workflow Variables (Optional)
          </label>
          <Textarea
            value={workflowVariables}
            onChange={(e) => setWorkflowVariables(e.target.value)}
            placeholder="e.g., N8n workflows, custom automation settings..."
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            rows={2}
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading || !substackUrl}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600"
        >
          {loading ? (
            <span className="flex items-center">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
              Analyzing Content with GPT-5.1...
            </span>
          ) : (
            "Generate System Prompt"
          )}
        </Button>

        {response && (
          <div className="space-y-4">
            {response.success && response.data ? (
              <>
                {/* Variables Summary */}
                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700">
                  <h3 className="font-medium text-blue-300 mb-3">📊 Generated Variables</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Creator:</span>
                      <span className="ml-2 text-white font-medium">{response.data.variables.creator_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Posts:</span>
                      <span className="ml-2 text-white font-medium">{response.data.metadata.totalPosts}</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-gray-400">Expertise:</span>
                      <span className="ml-2 text-white">{response.data.variables.creator_domain_expertise}</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-gray-400">Topics:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {response.data.variables.post_topics.map((topic: string, index: number) => (
                          <span key={index} className="bg-purple-900/20 text-purple-200 border border-purple-700 text-xs px-2 py-1 rounded">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Prompt */}
                <div className="bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="p-4 border-b border-gray-600 flex items-center justify-between">
                    <h3 className="font-medium text-gray-100">Generated System Prompt</h3>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCopy}
                        size="sm"
                        className="border-gray-600 hover:bg-gray-700 text-xs"
                      >
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                      <Button
                        onClick={handleDownload}
                        size="sm"
                        className="border-gray-600 hover:bg-gray-700 text-xs"
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap bg-black/20 p-3 rounded overflow-x-auto max-h-96">
                      {response.data.systemPrompt}
                    </pre>
                  </div>
                </div>

                {/* Sample Post Titles */}
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <h3 className="font-medium text-gray-100 mb-3">📰 Sample Post Titles Used</h3>
                  <div className="space-y-1">
                    {response.data.variables.post_titles.slice(0, 5).map((title: string, index: number) => (
                      <div key={index} className="text-sm text-gray-300 py-1 px-2 bg-black/20 rounded">
                        {title}
                      </div>
                    ))}
                    {response.data.variables.post_titles.length > 5 && (
                      <div className="text-xs text-gray-400 italic">
                        ...and {response.data.variables.post_titles.length - 5} more posts
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-red-900/20 rounded-lg p-4 border border-red-700">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <span className="font-medium">Generation Failed</span>
                </div>
                <p className="text-red-300 text-sm">{response.error}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
