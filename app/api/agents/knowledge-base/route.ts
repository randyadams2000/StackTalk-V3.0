import { NextResponse, type NextRequest } from "next/server"

function getElevenLabsApiKey(): string | undefined {
  return process.env.ELEVEN_API_KEY || process.env.NEXT_PUBLIC_ELEVEN_API_KEY
}

type IncomingArticle = {
  title: string
  url?: string
  content?: string
  publishedAt?: string
}

function clampText(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input
  return input.slice(0, maxChars) + "\n\n[truncated]"
}

function buildKnowledgeBaseText(params: {
  creatorName?: string
  substackUrl?: string
  articles: IncomingArticle[]
}): string {
  const creator = (params.creatorName || "Creator").trim()
  const source = (params.substackUrl || "").trim()

  const header = [
    `Creator: ${creator}`,
    ...(source ? [`Substack: ${source}`] : []),
    `GeneratedAt: ${new Date().toISOString()}`,
    "",
  ].join("\n")

  const blocks = params.articles
    .filter((a) => a && typeof a.title === "string" && a.title.trim())
    .slice(0, 10)
    .map((a, idx) => {
      const title = a.title.trim()
      const url = (a.url || "").trim()
      const publishedAt = (a.publishedAt || "").trim()
      const content = clampText((a.content || "").trim(), 8000)

      return [
        `### Article ${idx + 1}: ${title}`,
        ...(publishedAt ? [`PublishedAt: ${publishedAt}`] : []),
        ...(url ? [`URL: ${url}`] : []),
        "",
        ...(content ? [content] : ["(No content extracted from RSS)"]),
        "",
      ].join("\n")
    })

  // Hard cap overall doc size to reduce upload failures
  return clampText(header + blocks.join("\n"), 250_000)
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getElevenLabsApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing ElevenLabs API key (set ELEVEN_API_KEY)." },
        { status: 500 },
      )
    }

    const body = await req.json().catch(() => null)
    const agentId = String(body?.agentId || "").trim()
    const creatorName = String(body?.creatorName || "").trim()
    const substackUrl = String(body?.substackUrl || "").trim()
    const articles = Array.isArray(body?.articles) ? (body.articles as IncomingArticle[]) : []

    if (!agentId) return NextResponse.json({ success: false, error: "Missing agentId" }, { status: 400 })
    if (!articles.length)
      return NextResponse.json({ success: false, error: "Missing articles" }, { status: 400 })

    const docName = String(body?.name || `${creatorName || "Substack"} Articles`).trim() || "Substack Articles"
    const text = buildKnowledgeBaseText({ creatorName, substackUrl, articles })

    const form = new FormData()
    form.append("name", docName)
    form.append("file", new Blob([text], { type: "text/plain" }), "substack-articles.txt")

    const url = `https://api.elevenlabs.io/v1/convai/knowledge-base?agent_id=${encodeURIComponent(agentId)}`

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: form,
    })

    const rawText = await res.text()
    let data: unknown = null
    try {
      data = rawText ? JSON.parse(rawText) : null
    } catch {
      data = rawText
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          status: res.status,
          error: data,
        },
        { status: res.status },
      )
    }

    return NextResponse.json({ success: true, raw: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
