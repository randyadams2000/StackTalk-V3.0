import { NextResponse, type NextRequest } from "next/server"

function getElevenLabsApiKey(): string | undefined {
  return process.env.ELEVEN_API_KEY
}

type IncomingArticle = {
  title: string
  url?: string
  content?: string
  publishedAt?: string
}

type UrlDocResult = {
  url: string
  name?: string
  created?: unknown
  attached?: unknown
  error?: unknown
  status?: number
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

    const maxDocs = Math.max(1, Math.min(10, Number(body?.maxDocs || 10)))
    const docs = articles
      .map((a) => ({
        title: String(a?.title || "").trim(),
        url: String(a?.url || "").trim(),
      }))
      .filter((a) => a.url && /^https?:\/\//i.test(a.url))
      .slice(0, maxDocs)

    // Preferred path: create from URL (scrape) and attach each doc to the agent.
    if (docs.length) {
      const results: UrlDocResult[] = []

      for (const d of docs) {
        const name = d.title || `${creatorName || "Substack"} post`
        const entry: UrlDocResult = { url: d.url, name }

        // 1) Create the KB doc from URL (scrape)
        try {
          const createRes = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base/url", {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: d.url, name }),
          })

          const createText = await createRes.text()
          let createData: unknown = null
          try {
            createData = createText ? JSON.parse(createText) : null
          } catch {
            createData = createText
          }

          entry.created = createData
          if (!createRes.ok) {
            entry.status = createRes.status
            entry.error = createData
            results.push(entry)
            continue
          }
        } catch (e) {
          entry.error = e instanceof Error ? e.message : "Unknown error"
          results.push(entry)
          continue
        }

        // 2) Attach the URL doc to the agent's KB
        try {
          const form = new FormData()
          form.append("name", name)
          form.append("url", d.url)

          const attachUrl = `https://api.elevenlabs.io/v1/convai/knowledge-base?agent_id=${encodeURIComponent(agentId)}`
          const attachRes = await fetch(attachUrl, {
            method: "POST",
            headers: { "xi-api-key": apiKey },
            body: form,
          })

          const attachText = await attachRes.text()
          let attachData: unknown = null
          try {
            attachData = attachText ? JSON.parse(attachText) : null
          } catch {
            attachData = attachText
          }

          entry.attached = attachData
          if (!attachRes.ok) {
            entry.status = attachRes.status
            entry.error = attachData
          }
        } catch (e) {
          entry.error = e instanceof Error ? e.message : "Unknown error"
        }

        results.push(entry)
      }

      const attachedCount = results.filter((r) => r.attached && !r.error).length
      const hadErrors = results.some((r) => r.error)
      return NextResponse.json({
        success: !hadErrors,
        attachedCount,
        results,
      })
    }

    // Fallback: upload a single synthesized text file if URLs are missing.
    const docName = String(body?.name || `${creatorName || "Substack"} Articles`).trim() || "Substack Articles"
    const text = buildKnowledgeBaseText({ creatorName, substackUrl, articles })
    const form = new FormData()
    form.append("name", docName)
    form.append("file", new Blob([text], { type: "text/plain" }), "substack-articles.txt")

    const attachUrl = `https://api.elevenlabs.io/v1/convai/knowledge-base?agent_id=${encodeURIComponent(agentId)}`
    const res = await fetch(attachUrl, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
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

    return NextResponse.json({ success: true, raw: data, fallback: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
