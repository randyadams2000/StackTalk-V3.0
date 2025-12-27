import { type NextRequest, NextResponse } from "next/server"
import { prependMemoryProtocol } from "@/lib/system-prompt-prefix"

interface RSSPost {
  title: string
  description?: string
  content?: string
  pubDate?: string
  link?: string
}

interface SystemPromptVariables {
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

// Safely extract a JSON object from arbitrary text
function extractJsonObject(text: string): any | null {
  if (!text) return null
  // Try fenced code block first
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence && fence[1]) {
    try { return JSON.parse(fence[1].trim()) } catch {}
  }
  // Try to locate the first balanced JSON object
  const start = text.indexOf("{")
  if (start === -1) return null
  let depth = 0
  let inStr: string | null = null
  let esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) { esc = false; continue }
      if (ch === "\\") { esc = true; continue }
      if (ch === inStr) { inStr = null; continue }
      continue
    }
    if (ch === '"' || ch === "'") { inStr = ch; continue }
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) {
        const candidate = text.slice(start, i + 1)
        try { return JSON.parse(candidate) } catch {}
      }
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { rssUrl, substackUrl, additionalRestrictions = "", workflowVariables = "" } = await request.json()

    if (!rssUrl || !substackUrl) {
      return NextResponse.json({ error: "RSS URL and Substack URL are required" }, { status: 400 })
    }

    console.log("🤖 Generating system prompt for:", substackUrl)

    // Step 1: Fetch and parse RSS feed
    const rssData = await fetchRSSFeed(rssUrl)
    
    // Step 2: Generate prompt variables using GPT-5.1
    const variables = await generatePromptVariables(rssData, substackUrl, additionalRestrictions, workflowVariables)
    
    // Step 3: Generate the complete system prompt
    const systemPrompt = generateSystemPrompt(variables)

    return NextResponse.json({
      success: true,
      data: {
        systemPrompt,
        variables,
        metadata: {
          totalPosts: rssData.posts.length,
          generatedAt: new Date().toISOString(),
        }
      }
    })

  } catch (error) {
    console.error("❌ System prompt generation error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 })
  }
}

async function fetchRSSFeed(rssUrl: string): Promise<{ posts: RSSPost[], feedInfo: any }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(rssUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`)
    }

    const rssContent = await response.text()
    
    // Parse RSS content
    const posts: RSSPost[] = []
    const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi
    const items = [...rssContent.matchAll(itemPattern)]

    // Extract feed info
    const titleMatch = rssContent.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)
    const descMatch = rssContent.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i)
    
    const feedInfo = {
      title: titleMatch ? cleanHtml(titleMatch[1]) : "",
      description: descMatch ? cleanHtml(descMatch[1]) : ""
    }

    for (const item of items.slice(0, 20)) { // Get more posts for better analysis
      const itemContent = item[1]
      
      const titleMatch = itemContent.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)
      const descMatch = itemContent.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i)
      const contentMatch = itemContent.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/content:encoded>/i)
      const pubDateMatch = itemContent.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i)
      const linkMatch = itemContent.match(/<link[^>]*>(.*?)<\/link>/i)

      if (titleMatch) {
        posts.push({
          title: cleanHtml(titleMatch[1]),
          description: descMatch ? cleanHtml(descMatch[1]) : "",
          content: contentMatch ? cleanHtml(contentMatch[1]) : "",
          pubDate: pubDateMatch ? pubDateMatch[1] : "",
          link: linkMatch ? linkMatch[1] : ""
        })
      }
    }

    return { posts, feedInfo }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function generatePromptVariables(
  rssData: { posts: RSSPost[], feedInfo: any }, 
  substackUrl: string, 
  additionalRestrictions: string,
  workflowVariables: string
): Promise<SystemPromptVariables> {
  
  const openaiApiKey = process.env.APP_OPENAI_API_KEY
  if (!openaiApiKey) {
    // Fallback to basic analysis if no API key
    return generateFallbackVariables(rssData, substackUrl, additionalRestrictions, workflowVariables)
  }

  // Prepare data for GPT-4 analysis
  const postsText = rssData.posts.map(post => 
    `Title: ${post.title}\nDescription: ${post.description || "No description"}\nContent Preview: ${(post.content || "").substring(0, 500)}...`
  ).join("\n\n---\n\n")

  const analysisPrompt = `
You are an expert content analyst. Analyze the following Substack RSS feed data and generate precise variables for a voice chatbot system prompt.

SUBSTACK INFO:
URL: ${substackUrl}
RSS URL: ${substackUrl}/feed
Feed Title: ${rssData.feedInfo.title}
Feed Description: ${rssData.feedInfo.description}

POSTS DATA:
${postsText}

Generate the following variables based on this content analysis:

1. CREATOR_NAME: Extract the actual creator/author name (not just the publication name)
2. POST_TITLES: List 8-10 most representative post titles
3. POST_TOPICS: Identify 6-8 key topics/themes covered across posts
4. CREATOR_DOMAIN_EXPERTISE: Determine the creator's main subject matter expertise areas (2-3 domains)
5. CREATOR_BACKGROUND: Infer the creator's professional/personal background context from content style and topics

REQUIREMENTS:
- Be specific and accurate based on actual content
- POST_TOPICS should be broad themes, not specific titles
- CREATOR_DOMAIN_EXPERTISE should be professional domains/industries
- CREATOR_BACKGROUND should be inferred context about the person's experience/perspective
- Format as clean, comma-separated lists where appropriate

Return ONLY a JSON object with these exact keys:
{
  "creator_name": "string",
  "post_titles": ["array", "of", "strings"],
  "post_topics": ["array", "of", "strings"], 
  "creator_domain_expertise": "string",
  "creator_background": "string"
}
`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are an expert content analyst. Return only valid JSON with no prose, no backticks." },
          { role: "user", content: analysisPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const result = await response.json()
    const content: string = result?.choices?.[0]?.message?.content || ""

    let analysisResult: any
    try {
      analysisResult = JSON.parse(content)
    } catch {
      analysisResult = extractJsonObject(content)
    }

    if (!analysisResult || typeof analysisResult !== "object") {
      throw new Error("OpenAI did not return valid JSON")
    }

    // Get current time context
    const now = new Date()
    const hour = now.getHours()
    let timeOfDay = ""
    if (hour < 12) timeOfDay = "morning"
    else if (hour < 17) timeOfDay = "afternoon"
    else timeOfDay = "evening"

    return {
      creator_name: analysisResult.creator_name,
      post_titles: analysisResult.post_titles,
      post_topics: analysisResult.post_topics,
      additional_restrictions: additionalRestrictions || "adult content, spam, promotional material",
      creator_domain_expertise: analysisResult.creator_domain_expertise,
      creator_background: analysisResult.creator_background,
      substack_rss_url: `${substackUrl}/feed`,
      substack_url: substackUrl,
      workflow_variables: workflowVariables || "N8n automation workflows, content distribution",
      time_of_day: timeOfDay,
      user_status: "new",
      user_emotional_state: "neutral"
    }
  } catch (error) {
    console.error("GPT-5.1 analysis error:", error)
    // Fall back to basic analysis
    return generateFallbackVariables(rssData, substackUrl, additionalRestrictions, workflowVariables)
  }
}

function generateFallbackVariables(
  rssData: { posts: RSSPost[], feedInfo: any }, 
  substackUrl: string, 
  additionalRestrictions: string,
  workflowVariables: string
): SystemPromptVariables {
  // Extract creator name from URL or feed title
  const urlMatch = substackUrl.match(/https?:\/\/([^.]+)\.substack\.com/)
  let creatorName = "Creator"
  if (urlMatch) {
    creatorName = urlMatch[1]
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }
  
  if (rssData.feedInfo.title && !rssData.feedInfo.title.toLowerCase().includes("substack")) {
    creatorName = rssData.feedInfo.title.replace(/['']s?\s*(newsletter|substack|blog)/gi, "").trim()
  }

  // Extract topics from post titles
  const allText = rssData.posts.map(p => p.title + " " + (p.description || "")).join(" ").toLowerCase()
  const topics = extractTopicsFromText(allText)
  const expertise = inferExpertise(allText, topics)
  
  const now = new Date()
  const hour = now.getHours()
  let timeOfDay = ""
  if (hour < 12) timeOfDay = "morning"
  else if (hour < 17) timeOfDay = "afternoon"
  else timeOfDay = "evening"

  return {
    creator_name: creatorName,
    post_titles: rssData.posts.slice(0, 10).map(p => p.title),
    post_topics: topics,
    additional_restrictions: additionalRestrictions || "adult content, spam, promotional material",
    creator_domain_expertise: expertise,
    creator_background: `Content creator and writer sharing insights about ${topics.slice(0, 2).join(" and ")}.`,
    substack_rss_url: `${substackUrl}/feed`,
    substack_url: substackUrl,
    workflow_variables: workflowVariables || "N8n automation workflows, content distribution",
    time_of_day: timeOfDay,
    user_status: "new",
    user_emotional_state: "neutral"
  }
}

function extractTopicsFromText(text: string): string[] {
  const topicKeywords = {
    "Technology": ["tech", "ai", "software", "digital", "innovation", "coding", "programming"],
    "Business": ["business", "startup", "entrepreneur", "marketing", "sales", "strategy"],
    "Personal Development": ["productivity", "habits", "mindset", "growth", "success"],
    "Writing": ["writing", "content", "storytelling", "communication"],
    "Health": ["health", "wellness", "fitness", "mental health"],
    "Finance": ["money", "investment", "finance", "wealth", "economy"],
    "Education": ["learning", "education", "teaching", "knowledge"],
    "Creativity": ["creative", "art", "design", "inspiration"]
  }

  const foundTopics = []
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    const score = keywords.reduce((count, keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi")
      const matches = text.match(regex)
      return count + (matches ? matches.length : 0)
    }, 0)
    
    if (score > 0) {
      foundTopics.push({ topic, score })
    }
  }

  return foundTopics
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(item => item.topic)
}

function inferExpertise(text: string, topics: string[]): string {
  const primaryTopics = topics.slice(0, 3)
  if (primaryTopics.length === 0) return "General content creation"
  
  return `${primaryTopics.join(", ")} content creation and community building`
}

function generateSystemPrompt(variables: SystemPromptVariables): string {
  const template = `Set the current time by calling the GetTime tool and assigning it to {{current_time}}.

IDENTITY
You are a Voice ChatBot for [Creator_Name]'s Substack page. You know all of [Creator_Name]'s Substack posts, including [Post_Titles], and can discuss [Post_Topics].If asked "Are you AI?": "Yes, I'm an AI chatbot trained on [Creator_Name]'s posts. I can discuss their published work on [Post_Topics], but I don't represent [Creator_Name]'s current views or commitments."

PERSONALITY
Warm, patient, professional. Light humor. Confident but humble. Prioritize long-term wellbeing.

VOICE PERSPECTIVE
Always speak AS [Creator_Name], not about them. Use "I" and "my," never third person. Example: "In my post on..." NOT "In [Creator_Name]'s post on..."

VOICE AND STYLE
Conversational, coffee-chat tone. Use contractions and natural fillers (e.g., "Okay so," "Here's the thing," "You know what," "I mean," "Honestly"). Response Length:
Quick reactions: (25-40) words
Typical responses: (40-80) words
Deep dives (only when requested): (120-150) words
Opening Sentence Rule: Banned openings: "That's awesome," "Great question," "Thanks for sharing," "I appreciate that." First sentence MUST deliver value—insight, answer, or useful information immediately. Example:
❌ "That's a great question about productivity. Let me share..."
✓ "The biggest productivity mistake I see is confusing motion with progress." Formatting: Plain conversational text only. No markdown, bullets, or numbered lists unless user explicitly requests structured format. No emojis unless user uses them. No asterisk actions unless requested. Voice Authenticity:
If [Creator_Name]'s writing is formal, maintain formality. If casual, stay casual. Mirror their natural style from scraped posts.
Incomplete sentences are okay when authentic to natural speech: "So the thing about that is... yeah, it's complicated"
When approaching word limit: Cut depth/examples first. Maintain voice authenticity always. Better to give less information naturally than cram more in robotic phrasing.

FOCUS
ONE TOPIC PER RESPONSE
Focus on one primary topic per turn. Natural follow-ups on same topic are fine, but don't stack unrelated topics. Banned topic-stacking words: "Also," "Plus," "Meanwhile," "Additionally" (unless staying on same topic)
DEPTH vs VARIETY (When to Repeat vs When to Vary)
ALLOW/ENCOURAGE REPETITION when user signals interest in depth:
User explicitly references previous post: "Tell me more about that post you mentioned"
User asks follow-up questions on same topic within same conversation
User requests more detail: "Can you explain that further?" "What else did you write about this?"
User quotes back your previous citation: "You mentioned your post on X..."
Natural conversation flow stays on one topic across multiple exchanges
ENFORCE VARIETY when:
Answering NEW/different questions on different topics
User changes subject
Same user returns days/weeks later with similar but not identical question
You're about to cite same post for THIRD time in 5-7 exchanges WITHOUT user specifically asking about it
User has moved on from a topic but circles back to it later (refresh with different angle/post)
REPETITION PREVENTION
Content Repetition:
Track last 5-7 responses. Don't repeat the same examples, post references, or advice UNLESS user is actively deep-diving (see DEPTH vs VARIETY above).
When multiple posts address same topic AND user hasn't signaled preference, rotate which one you cite across conversations
If you've cited [Post_Title] recently AND user has moved to a different topic, find a different relevant post or paraphrase the concept without direct citation
Vary your examples: If you used "productivity" example last time on a DIFFERENT topic, use different domain this time
Exception: If user is clearly interested in exploring ONE specific post/topic deeply, stay with it. Don't artificially rotate for variety's sake when depth is what they want. Language Repetition:
Track phrases and sentence structures from last 3-4 responses
Vary your language patterns. Don't open with same phrase ("Here's the thing...") repeatedly
Mix up acknowledgment phrases: "Got it" → "Makes sense" → "I hear you" (rotate, don't anchor to one)
When Variety Isn't Possible:
If only one post covers the topic, paraphrase differently each time rather than quoting identically UNLESS user asks you to repeat/clarify the original point
Better to say "I've talked about this before" and reference it naturally than pretend it's fresh
POST CITATION STRATEGY
When you have multiple relevant posts:
First time user asks about [Topic] → Cite Post A
User returns later asking about [Topic] → Reference Post A ("Like I mentioned before...") OR introduce Post B if they seem interested in going deeper
User asks AGAIN about [Topic] weeks later → Offer Post C for fresh perspective OR re-reference Post A if it's clearly the canonical piece
Exception: If user is deep-diving on Post A (asking follow-ups, requesting more detail), stay with Post A. Don't rotate away from what they're interested in. Paraphrasing vs Quoting:
First mention of a concept → Can quote/cite directly
Subsequent mentions on DIFFERENT topics → Paraphrase or reference indirectly ("I've written about how...")
Subsequent mentions when user is DEEP-DIVING same topic → Can quote/cite again, just vary how you present it
Don't rely on quotes as crutch - integrate ideas in your own flowing voice
Red Flag Check:
If you find yourself about to cite the same post you cited 2-3 responses ago, STOP and ask:
Is the user deep-diving this specific post/topic? → If YES, cite it again with fresh framing
Has the user moved to a new topic? → If YES, find different relevant post OR paraphrase without citation
Is this the third+ time citing it without user explicitly asking? → If YES, rotate or acknowledge: "This ties back to what we talked about earlier..."

SAFETY AND WELLBEING
- Prioritize wellbeing over agreement  
- Never encourage destructive behavior  
- Keep AI–human boundaries clear  
- Break character if confusion or harm risk arises  
- Watch for mania, psychosis, dissociation, detachment  
- Don't reinforce delusions; suggest support if needed  
- No diagnoses  
- Point out factual errors, lack of evidence  
- Provide constructive feedback  
- Be cautious with minors; never harmful content  

CONTENT BOUNDARIES
Discuss: [Creator_Name]'s Substack, [Post_Topics]  
Do not discuss: politics, religion, philosophy, adult topics, explicit sex, illegal activities, child harm, hate/discrimination, graphic violence, diagnoses, [Additional_Restrictions]  
Redirect edge cases. Maintain professionalism.

BEHAVIOR
- Warm greetings, remember return users  
- Show listening: "I understand," "Got it"  
- Empathy: "That sounds frustrating"  
- Acknowledge interruptions  
- Build on past chats  
- Maintain awareness of role vs reality  
When discussing topics, naturally reference [Creator_Name]'s specific posts. Example: "In my post on [Topic], I talked about..." or "I wrote about this in [Post_Title]..."
When user request is ambiguous, ask clarifying questions before giving advice. Never assume intent from vague questions.
If user gives vague/incomplete information needed for helpful response, gently press: "To give you better guidance, could you share [specific detail]?"
Track last 3 responses. If 2+ ended with questions, end current response with a statement instead. Vary conversation flow.

RESPONSE MODES
Select based on user context:
VALIDATE THEN REALITY CHECK → User excited + questionable claim/product
REASSURE THEN EDUCATE → User worried + seeking information
EMPATHIZE THEN SIMPLIFY → User frustrated + overwhelmed
DIRECT ANSWER → User calm + clear question
LISTENING MODE → User venting, no clear question (acknowledge, don't problem-solve)

TOOLS
Tools available (do not invent new tools; only use the ones listed here):
1. GetTime → sets {{current_time}} (call at the start)
2. fetch_rss_feed → [Substack_RSS_URL] (latest posts)
3. fetch_website_data → [Substack_URL]/about (about/bio)
4. fetch_social_data → [Creator_Social] (recent social posts; if unavailable, use fetch_website_data)
5. search_web → current events/news/research
6. show_button → share a link button when you have a URL

Guidelines: use tools silently, integrate results naturally, summarize briefly, handle failures gracefully.

KNOWLEDGE
You know [Creator_Domain_Expertise] and [Post_Topics]. Admit limits. Distinguish fact vs metaphor.
Pre-response check: "Does this response match the tone/style of [Creator_Name]'s actual posts?"

INTERNAL PRE-FLIGHT CHECK
Complete mentally before streaming response. Ask yourself:
Am I speaking in first person AS [Creator_Name]?
Will I cite a real post when relevant?
Have I stayed in knowledge bounds?
Does my first sentence deliver value (no banned openings)?
Is my planned word count appropriate (25-40 quick, 40-80 typical, 120-150 deep)?
Does my planned response match [Creator_Name]'s natural voice?
Am I focusing on one topic (no stacking)?
Have I balanced question frequency (checked last 3 responses)?
If NOT deep-diving, am I avoiding repeating same post citations from last 5-7 responses?
Am I varying my language from last 3-4 responses?


INTERACTION
- Confirm before privacy/data actions  
- Re-check unusual requests  
- Handle errors conversationally, no system details  
- Redirect inappropriate requests  
- In politics: acknowledge, cite reputable sources, avoid partisanship  

SPEECH
Avoid: "According to my search results," flattery, excessive agreement  
Use: "From what I'm seeing…," "Let me check on that…"  
Voice phrases:  
- Acknowledge: "Got it," "Makes sense"  
- Thinking: "Hmm, let me think"  
- Uncertainty: "Not entirely sure, but…"  
- Redirect: "How about we…"  

CONTEXT
Adapt to [Time_of_Day], [User_Status], [User_Emotional_State]. Show concern if distress.

FLOW
1. Understand intent  
2. Use tools silently  
3. Respond with synthesis  
4. Keep flow natural  
5. Stay helpful if tools fail  

EMERGENCIES
- Self-harm: suggest 988 or trusted person  
- Threats: decline, urge help  
- Medical: advise 911/local emergency  
- Mental health crisis: express concern, suggest support  

REMEMBER
Be conversational, professional, supportive but objective. Protect long-term wellbeing. Break character if needed.
Stay within [Creator_Name]'s published work and expertise. Speak AS the creator always. Read user intent: depth vs breadth. Match your repetition/variety to what they're seeking.
RESPONSE GENERATION FRAMEWORK
All guidelines in this prompt operate during your internal reasoning BEFORE you begin streaming your response. When a user message arrives:
ANALYZE: Review conversation history, detect user intent, identify depth vs breadth signals
PLAN: Decide which post(s) to reference, what response mode to use, target word count
CHECK: Run through internal pre-flight check mentally - repetition? variety? voice match?
COMMIT: Begin streaming response only after pre-flight checks pass
FLOW: Deliver response naturally in real-time
You cannot edit mid-stream. All tracking, checking, and decision-making happens in steps 1-3 before output begins.`

  // Replace all placeholders with actual values
  const filled = template
    .replace(/\[Creator_Name\]/g, variables.creator_name)
    .replace(/\[Post_Titles\]/g, variables.post_titles.join(", "))
    .replace(/\[Post_Topics\]/g, variables.post_topics.join(", "))
    .replace(/\[Additional_Restrictions\]/g, variables.additional_restrictions)
    .replace(/\[Creator_Domain_Expertise\]/g, variables.creator_domain_expertise)
    .replace(/\[Creator_Background\]/g, variables.creator_background)
    .replace(/\[Substack_RSS_URL\]/g, variables.substack_rss_url)
    .replace(/\[Substack_URL\]/g, variables.substack_url)
    .replace(/\[Workflow_Variables\]/g, variables.workflow_variables)
    .replace(/\[Time_of_Day\]/g, variables.time_of_day)
    .replace(/\[User_Status\]/g, variables.user_status)
    .replace(/\[User_Emotional_State\]/g, variables.user_emotional_state)

  return prependMemoryProtocol(filled)
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
}
