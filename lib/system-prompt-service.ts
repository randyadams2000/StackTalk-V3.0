export interface SystemPromptRequest {
  rssUrl: string
  substackUrl: string
  additionalRestrictions?: string
  workflowVariables?: string
}

export interface SystemPromptResponse {
  success: boolean
  data?: {
    systemPrompt: string
    variables: {
      creator_name: string
      post_titles: string[]
      post_topics: string[]
      additional_restrictions: string
      creator_domain_expertise: string
      creator_background: string
      substack_rss_url: string
      substack_url: string
      workflow_variables: string
      time_of_day: string
      user_status: string
      user_emotional_state: string
    }
    metadata: {
      totalPosts: number
      generatedAt: string
    }
  }
  error?: string
}

export async function generateSystemPrompt(request: SystemPromptRequest): Promise<SystemPromptResponse> {
  try {
    const response = await fetch('/api/generate-system-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate system prompt')
    }

    return data
  } catch (error) {
    console.error('System prompt generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export function downloadSystemPrompt(systemPrompt: string, creatorName: string) {
  const blob = new Blob([systemPrompt], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${creatorName.replace(/[^a-zA-Z0-9]/g, '_')}_system_prompt.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
}
