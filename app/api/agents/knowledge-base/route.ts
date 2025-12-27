import { NextResponse, type NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getElevenLabsApiKey(): string | undefined {
  return process.env.APP_ELEVEN_API_KEY
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : undefined
}

async function discoverExaConnectionId(apiKey: string): Promise<string | undefined> {
  try {
    const listRes = await fetch("https://api.elevenlabs.io/v1/convai/agents", {
      headers: { "xi-api-key": apiKey },
    })
    if (!listRes.ok) return undefined
    const list = await listRes.json().catch(() => null)
    const agents = Array.isArray(list?.agents) ? list.agents : []

    for (const a of agents) {
      const id = String(a?.agent_id || a?.id || "").trim()
      if (!id) continue

      const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(id)}`, {
        headers: { "xi-api-key": apiKey },
      })
      if (!res.ok) continue
      const agent = await res.json().catch(() => null)
      const tools = agent?.conversation_config?.agent?.prompt?.tools
      if (!Array.isArray(tools)) continue

      const exa = tools.find((t: any) => t?.name === "exa_search")
      const connectionId = String(exa?.api_integration_connection_id || "").trim()
      if (connectionId) return connectionId
    }

    return undefined
  } catch {
    return undefined
  }
}

async function fetchAgentWithRetry(params: { apiKey: string; agentId: string }) {
  const url = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(params.agentId)}`
  const attempts = 6

  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { "xi-api-key": params.apiKey } })
    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (res.ok) return { res, data }

    // ElevenLabs can be eventually consistent right after agent creation.
    // Retry a few times on transient-ish statuses.
    if ([404, 409, 429, 500, 502, 503, 504].includes(res.status) && i < attempts - 1) {
      await sleep(250 * Math.pow(2, i))
      continue
    }

    return { res, data }
  }

  // Unreachable
  return { res: new Response(null, { status: 500 }), data: null }
}

async function patchAgentWithRetry(params: { apiKey: string; agentId: string; patchPayload: unknown }) {
  const url = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(params.agentId)}`
  const attempts = 4

  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "xi-api-key": params.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params.patchPayload),
    })

    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (res.ok) return { res, data }

    if ([404, 409, 429, 500, 502, 503, 504].includes(res.status) && i < attempts - 1) {
      await sleep(250 * Math.pow(2, i))
      continue
    }

    return { res, data }
  }

  return { res: new Response(null, { status: 500 }), data: null }
}

async function ensureRequiredTools(params: { apiKey: string; existingTools: unknown }): Promise<any[]> {
  const existing = Array.isArray(params.existingTools) ? params.existingTools : []
  const byName = new Map<string, any>()
  for (const t of existing) {
    const name = typeof t?.name === "string" ? t.name : ""
    if (name) byName.set(name, t)
  }

  const retrieveUrl =
    getOptionalEnv("ELEVEN_GET_CONTEXT_URL") ||
    getOptionalEnv("CONTEXT_RETRIEVE_URL") ||
    "https://vtbstifl22flybdwtjideakc340erefx.lambda-url.us-east-1.on.aws/retrieve"

  const saveUrl =
    getOptionalEnv("ELEVEN_SAVE_CONTEXT_URL") ||
    getOptionalEnv("CONTEXT_SAVE_URL") ||
    "https://vtbstifl22flybdwtjideakc340erefx.lambda-url.us-east-1.on.aws/save"

  if (!byName.has("get_context")) {
    byName.set("get_context", {
      type: "webhook",
      name: "get_context",
      description:
        "ALWAYS call this tool at the beginning of the conversation. This retrieves the user's memory and context from previous conversations.",
      response_timeout_secs: 20,
      disable_interruptions: false,
      force_pre_tool_speech: false,
      assignments: [
        {
          source: "response",
          dynamic_variable: "zep_context",
          value_path: "context",
        },
      ],
      tool_call_sound: null,
      tool_call_sound_behavior: "auto",
      dynamic_variables: {
        dynamic_variable_placeholders: {
          user_id: "default_user",
        },
      },
      execution_mode: "immediate",
      api_schema: {
        request_headers: {
          "Content-Type": "application/json",
        },
        url: retrieveUrl,
        method: "POST",
        path_params_schema: {},
        query_params_schema: null,
        request_body_schema: {
          type: "object",
          required: ["user_id"],
          description: "pass the user_id",
          properties: {
            user_id: {
              type: "string",
              description: "",
              enum: null,
              is_system_provided: false,
              dynamic_variable: "user_id",
              constant_value: "",
            },
          },
        },
        content_type: "application/json",
        auth_connection: null,
      },
    })
  }

  if (!byName.has("save_context")) {
    byName.set("save_context", {
      type: "webhook",
      name: "save_context",
      description: "Call this all the time save memory of conversation. Include both the user's message and your response.",
      response_timeout_secs: 20,
      disable_interruptions: false,
      force_pre_tool_speech: false,
      assignments: [],
      tool_call_sound: null,
      tool_call_sound_behavior: "auto",
      dynamic_variables: {
        dynamic_variable_placeholders: {
          user_id: "default_user",
        },
      },
      execution_mode: "async",
      api_schema: {
        request_headers: {
          "Content-Type": "application/json",
        },
        url: saveUrl,
        method: "POST",
        path_params_schema: {},
        query_params_schema: null,
        request_body_schema: {
          type: "object",
          required: ["content", "thread_id"],
          description: "Summarize the last exchange: what the user said and what you responded. Be concise. and save the context",
          properties: {
            content: {
              type: "string",
              description: "Summarize the last exchange: what the user said and what you responded. Be concise.",
              enum: null,
              is_system_provided: false,
              dynamic_variable: "",
              constant_value: "",
            },
            user_id: {
              type: "string",
              description: "",
              enum: null,
              is_system_provided: false,
              dynamic_variable: "user_id",
              constant_value: "",
            },
            thread_id: {
              type: "string",
              description: "",
              enum: null,
              is_system_provided: false,
              dynamic_variable: "user_id",
              constant_value: "",
            },
          },
        },
        content_type: "application/json",
        auth_connection: null,
      },
    })
  }

  if (!byName.has("ShowWeb")) {
    byName.set("ShowWeb", {
      type: "client",
      name: "ShowWeb",
      description: "This tool will cause the client to open a web page from the provided URL.",
      response_timeout_secs: 10,
      disable_interruptions: false,
      force_pre_tool_speech: true,
      assignments: [],
      tool_call_sound: null,
      tool_call_sound_behavior: "auto",
      parameters: {
        type: "object",
        required: ["URL"],
        description: "",
        properties: {
          URL: {
            type: "string",
            description: "This is the URL of the web page that is desired to be opened.",
            enum: null,
            is_system_provided: false,
            dynamic_variable: "",
            constant_value: "",
          },
        },
      },
      expects_response: true,
      dynamic_variables: {
        dynamic_variable_placeholders: {},
      },
      execution_mode: "immediate",
    })
  }

  if (!byName.has("exa_search")) {
    const exaConnectionId =
      getOptionalEnv("ELEVEN_EXA_CONNECTION_ID") ||
      getOptionalEnv("EXA_INTEGRATION_CONNECTION_ID") ||
      (await discoverExaConnectionId(params.apiKey))

    if (exaConnectionId) {
      byName.set("exa_search", {
        type: "api_integration_webhook",
        name: "exa_search",
        description:
          "Search the web using Exa's search engine. Provide a natural language query to find relevant content. Returns up to 8 search results with text content (max 2000 characters per result).",
        response_timeout_secs: 20,
        disable_interruptions: false,
        force_pre_tool_speech: false,
        assignments: [],
        tool_call_sound: null,
        tool_call_sound_behavior: "auto",
        dynamic_variables: {
          dynamic_variable_placeholders: {},
        },
        execution_mode: "immediate",
        tool_version: "1.0.0",
        api_integration_id: "exa",
        api_integration_connection_id: exaConnectionId,
        api_schema_overrides: null,
      })
    }
  }

  return Array.from(byName.values())
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
  id?: string
  created?: unknown
  details?: unknown
  patchedAgent?: unknown
  error?: unknown
  status?: number
}

type KnowledgeBaseLocator = {
  type: string
  id: string
  name?: string
  usage_mode?: string
}

function clampText(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input
  return input.slice(0, maxChars) + "\n\n[truncated]"
}

function safeDocName(input: string, maxLen: number = 96): string {
  const cleaned = String(input || "")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return "Document"
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen - 1).trimEnd() + "…"
}

function getRagIndexModel(): "e5_mistral_7b_instruct" | "multilingual_e5_large_instruct" {
  const raw = String(getOptionalEnv("ELEVEN_RAG_INDEX_MODEL") || "e5_mistral_7b_instruct").trim()
  return raw === "multilingual_e5_large_instruct" ? "multilingual_e5_large_instruct" : "e5_mistral_7b_instruct"
}

async function computeRagIndex(params: { apiKey: string; docId: string; model: string }) {
  const url = `https://api.elevenlabs.io/v1/convai/knowledge-base/${encodeURIComponent(params.docId)}/rag-index`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": params.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: params.model }),
  })

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  return { res, data }
}

async function getRagIndex(params: { apiKey: string; docId: string }) {
  const url = `https://api.elevenlabs.io/v1/convai/knowledge-base/${encodeURIComponent(params.docId)}/rag-index`
  const res = await fetch(url, {
    headers: {
      "xi-api-key": params.apiKey,
    },
  })

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { res, data }
}

function pickRagIndexStatus(payload: unknown): { status?: string; progress?: number } {
  if (!payload || typeof payload !== "object") return {}
  // GET endpoint shape: { indexes: [{ status, progress_percentage, ...}] }
  const indexes = Array.isArray((payload as any).indexes) ? ((payload as any).indexes as any[]) : null
  const first = indexes && indexes.length ? indexes[0] : null
  if (first && typeof first === "object") {
    return {
      status: typeof first.status === "string" ? first.status : undefined,
      progress: typeof first.progress_percentage === "number" ? first.progress_percentage : undefined,
    }
  }

  // POST endpoint shape can be { status, progress_percentage, ... }
  return {
    status: typeof (payload as any).status === "string" ? (payload as any).status : undefined,
    progress: typeof (payload as any).progress_percentage === "number" ? (payload as any).progress_percentage : undefined,
  }
}

async function waitForRagIndex(params: {
  apiKey: string
  docId: string
  model: string
  timeoutMs: number
  pollIntervalMs: number
}) {
  const started = Date.now()

  // Trigger compute (idempotent)
  const { res: computeRes, data: computeData } = await computeRagIndex({
    apiKey: params.apiKey,
    docId: params.docId,
    model: params.model,
  })

  if (!computeRes.ok) {
    return {
      ok: false,
      phase: "compute" as const,
      status: computeRes.status,
      data: computeData,
    }
  }

  let last: unknown = computeData
  while (Date.now() - started < params.timeoutMs) {
    const { status } = pickRagIndexStatus(last)
    if (status === "succeeded" || status === "success") {
      return { ok: true, phase: "poll" as const, data: last }
    }
    if (status === "failed" || status === "error") {
      return { ok: false, phase: "poll" as const, data: last }
    }

    await sleep(params.pollIntervalMs)

    const { res: getRes, data: getData } = await getRagIndex({ apiKey: params.apiKey, docId: params.docId })
    last = getRes.ok ? getData : { status: "unknown", httpStatus: getRes.status, error: getData }
  }

  return {
    ok: false,
    phase: "timeout" as const,
    data: last,
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const current = nextIndex++
      if (current >= items.length) return
      results[current] = await fn(items[current])
    }
  })

  await Promise.all(workers)
  return results
}

function buildKnowledgeBaseTextForArticle(params: {
  creatorName?: string
  substackUrl?: string
  article: IncomingArticle
}): string {
  const creator = (params.creatorName || "Creator").trim()
  const source = (params.substackUrl || "").trim()

  const title = String(params.article?.title || "").trim()
  const url = String(params.article?.url || "").trim()
  const publishedAt = String(params.article?.publishedAt || "").trim()
  const content = clampText(String(params.article?.content || "").trim(), 120_000)

  const header = [
    `Creator: ${creator}`,
    ...(source ? [`Substack: ${source}`] : []),
    `GeneratedAt: ${new Date().toISOString()}`,
    ...(title ? [`Title: ${title}`] : []),
    ...(publishedAt ? [`PublishedAt: ${publishedAt}`] : []),
    ...(url ? [`URL: ${url}`] : []),
    "",
  ].join("\n")

  return clampText(header + (content ? content : "(No content extracted from RSS)"), 250_000)
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
    const kbModeRaw = String(body?.kbMode || getOptionalEnv("ELEVEN_KB_MODE") || "file").trim().toLowerCase()
    const kbMode = kbModeRaw === "url" ? "url" : "file"
    const waitForIndex = body?.waitForIndex !== false
    const indexTimeoutMs = Math.max(5_000, Math.min(180_000, Number(body?.indexTimeoutMs || 60_000)))

    const indexPollIntervalMs = Math.max(500, Math.min(10_000, Number(body?.indexPollIntervalMs || 1_500)))

    // Reindex-only mode: allow callers to force indexing on already-created KB docs.
    // This is useful when docs were uploaded previously but never indexed.
    const docIds = Array.isArray(body?.docIds)
      ? (body.docIds as unknown[]).map((x) => String(x || "").trim()).filter(Boolean)
      : []
    const reindexOnly = docIds.length > 0 && articles.length === 0
    if (reindexOnly) {
      const ragModel = getRagIndexModel()
      const results = await mapWithConcurrency(docIds, 3, async (docId) => {
        try {
          if (waitForIndex) {
            const r = await waitForRagIndex({
              apiKey,
              docId,
              model: ragModel,
              timeoutMs: indexTimeoutMs,
              pollIntervalMs: indexPollIntervalMs,
            })
            return { docId, ragIndex: r }
          }

          const { res: ragRes, data: ragData } = await computeRagIndex({ apiKey, docId, model: ragModel })
          return { docId, ragIndex: ragRes.ok ? ragData : { ok: false, status: ragRes.status, error: ragData } }
        } catch (e) {
          return { docId, ragIndex: { ok: false, error: e instanceof Error ? e.message : String(e) } }
        }
      })

      if (waitForIndex) {
        const failed = results.filter(
          (r) => r && r.ragIndex && typeof r.ragIndex === "object" && (r.ragIndex as any).ok === false,
        )
        if (failed.length) {
          return NextResponse.json(
            {
              success: false,
              error: "RAG indexing did not complete successfully for one or more documents",
              ragIndexModel: ragModel,
              waitForIndex,
              indexTimeoutMs,
              indexPollIntervalMs,
              results,
            },
            { status: 502 },
          )
        }
      }

      return NextResponse.json({
        success: true,
        mode: "reindex-only",
        ragIndexModel: ragModel,
        waitForIndex,
        indexTimeoutMs,
        indexPollIntervalMs,
        results,
      })
    }

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

    // Default behavior: upload synthesized text files made from RSS content.
    // We upload one KB document per post so ElevenLabs can index and retrieve per-article chunks.
    // Reason: URL-created KB docs frequently show `supported_usages: ["prompt"]` and end up with
    // "RAG indexes: No indexes" in the ElevenLabs UI even when URL Content exists.
    if (kbMode === "file") {
      const baseName = String(body?.name || `${creatorName || "Substack"} Articles`).trim() || "Substack Articles"
      const ragModel = getRagIndexModel()
      const perPost = articles
        .filter((a) => a && typeof a.title === "string" && a.title.trim())
        .slice(0, maxDocs)

      const results: any[] = []
      const createdLocators: KnowledgeBaseLocator[] = []

      for (const a of perPost) {
        const title = String(a?.title || "").trim() || "Substack post"
        const docName = safeDocName(`${baseName} — ${title}`)
        const text = buildKnowledgeBaseTextForArticle({ creatorName, substackUrl, article: a })

        const form = new FormData()
        form.append("name", docName)
        // Use a stable-ish filename so KB UI looks sane.
        form.append("file", new Blob([text], { type: "text/plain" }), "substack-post.txt")

        const createRes = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: form,
        })

        const createText = await createRes.text()
        let createData: unknown = null
        try {
          createData = createText ? JSON.parse(createText) : null
        } catch {
          createData = createText
        }

        if (!createRes.ok) {
          console.error("KB per-post file upload failed", { status: createRes.status, docName, error: createData })
          results.push({ name: docName, status: createRes.status, error: createData })
          // Keep going; we may still attach others.
          if (createRes.status === 429) await sleep(750)
          continue
        }

        const createdId = (createData as any)?.id
        if (typeof createdId !== "string" || !createdId) {
          results.push({ name: docName, status: 502, error: "KB file uploaded but id missing", created: createData })
          continue
        }

        // Trigger RAG indexing so the KB doc becomes retrievable.
        // If waitForIndex=true, poll until the index is succeeded (or fail/time out).
        let ragIndex: unknown = null
        try {
          if (waitForIndex) {
            const result = await waitForRagIndex({
              apiKey,
              docId: createdId,
              model: ragModel,
              timeoutMs: indexTimeoutMs,
              pollIntervalMs: indexPollIntervalMs,
            })
            ragIndex = result
          } else {
            const { res: ragRes, data: ragData } = await computeRagIndex({ apiKey, docId: createdId, model: ragModel })
            ragIndex = ragRes.ok ? ragData : { ok: false, status: ragRes.status, error: ragData }
          }
        } catch (e) {
          ragIndex = { ok: false, error: e instanceof Error ? e.message : String(e) }
        }

        // Best-effort: fetch details (includes supported_usages) for debugging.
        let details: unknown = null
        try {
          const detailRes = await fetch(
            `https://api.elevenlabs.io/v1/convai/knowledge-base/${encodeURIComponent(createdId)}`,
            { headers: { "xi-api-key": apiKey } },
          )
          const detailText = await detailRes.text()
          try {
            details = detailText ? JSON.parse(detailText) : null
          } catch {
            details = detailText
          }
        } catch {
          // ignore
        }

        createdLocators.push({
          type: String((createData as any)?.type || "file"),
          id: createdId,
          name: String((createData as any)?.name || docName),
          usage_mode: "auto",
        })

        results.push({
          id: createdId,
          name: docName,
          created: createData,
          details,
          ragIndex,
        })

        // Be slightly gentle to avoid rate limiting.
        await sleep(120)
      }

      // If we were asked to wait for indexing, enforce that all docs succeeded.
      if (waitForIndex) {
        const failed = results.filter((r) => r && r.ragIndex && typeof r.ragIndex === "object" && (r.ragIndex as any).ok === false)
        if (failed.length) {
          return NextResponse.json(
            {
              success: false,
              error: "Knowledge Base documents uploaded but RAG indexing did not complete successfully",
              ragIndexModel: ragModel,
              waitForIndex,
              indexTimeoutMs,
              indexPollIntervalMs,
              results,
            },
            { status: 502 },
          )
        }
      }

      const uniqueLocators = Array.from(new Map(createdLocators.map((l) => [l.id, l])).values())
      const uniqueIds = uniqueLocators.map((l) => l.id)

      if (uniqueLocators.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "No knowledge base documents were created",
            results,
          },
          { status: 502 },
        )
      }

      const { res: getAgentRes, data: agentData } = await fetchAgentWithRetry({ apiKey, agentId })
      if (!getAgentRes.ok) {
        console.error("KB per-post file attach failed: could not fetch agent", {
          agentId,
          status: getAgentRes.status,
          agentError: agentData,
          createdIds: uniqueIds,
        })
        return NextResponse.json(
          {
            success: false,
            error: "Failed to fetch agent for KB attachment",
            status: getAgentRes.status,
            agentError: agentData,
            createdIds: uniqueIds,
            results,
          },
          { status: getAgentRes.status || 502 },
        )
      }

      const existingPrompt = agentData?.conversation_config?.agent?.prompt
      if (!existingPrompt || typeof existingPrompt !== "object") {
        return NextResponse.json(
          {
            success: false,
            error: "Agent prompt config missing; cannot attach knowledge base",
            agentId,
            agent: agentData,
            createdIds: uniqueIds,
            results,
          },
          { status: 500 },
        )
      }

      const existingKb: KnowledgeBaseLocator[] = Array.isArray((existingPrompt as any).knowledge_base)
        ? ((existingPrompt as any).knowledge_base as any[]).filter(
            (x) => x && typeof x === "object" && typeof (x as any).id === "string",
          )
        : []

      const mergedKb = Array.from(new Map([...existingKb, ...uniqueLocators].map((l) => [l.id, l])).values())

      const promptWithoutToolIds: any = { ...(existingPrompt as any) }
      delete promptWithoutToolIds.tool_ids
      delete promptWithoutToolIds.toolIds

      const updatedPrompt = {
        ...promptWithoutToolIds,
        knowledge_base: mergedKb,
        tools: await ensureRequiredTools({ apiKey, existingTools: (existingPrompt as any).tools }),
        rag: {
          ...((existingPrompt as any).rag || {}),
          enabled: true,
        },
      }

      const patchPayload = {
        conversation_config: {
          ...(agentData.conversation_config || {}),
          agent: {
            ...(agentData.conversation_config?.agent || {}),
            prompt: updatedPrompt,
          },
        },
      }

      const { res: patchRes, data: patchData } = await patchAgentWithRetry({ apiKey, agentId, patchPayload })
      if (!patchRes.ok) {
        console.error("KB per-post file attach failed: agent PATCH rejected", {
          agentId,
          status: patchRes.status,
          patchError: patchData,
          createdIds: uniqueIds,
        })
        return NextResponse.json(
          {
            success: false,
            error: "Failed to attach KB doc to agent",
            status: patchRes.status,
            patchError: patchData,
            createdIds: uniqueIds,
            results,
          },
          { status: patchRes.status || 502 },
        )
      }

      for (const r of results) r.patchedAgent = patchData

      return NextResponse.json({
        success: true,
        attachedCount: uniqueIds.length,
        knowledgeBaseIds: uniqueIds,
        results,
        mode: "file",
        perPost: true,
        ragIndexModel: ragModel,
        waitForIndex,
        indexTimeoutMs,
        indexPollIntervalMs,
      })
    }

    // Preferred path: create from URL (scrape) and then attach by PATCHing the agent's
    // `conversation_config.agent.prompt.knowledge_base` with KnowledgeBaseLocator objects.
    if (docs.length) {
      const results: UrlDocResult[] = []
      const createdLocators: KnowledgeBaseLocator[] = []
      const ragModel = getRagIndexModel()

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
            console.error("KB URL create failed", {
              status: createRes.status,
              url: d.url,
              name,
              error: createData,
            })
            entry.status = createRes.status
            entry.error = createData
            results.push(entry)
            continue
          }

          // Capture ID for agent attachment
          const createdId = (createData as any)?.id
          if (typeof createdId === "string" && createdId) {
            entry.id = createdId

            // Trigger/ensure RAG indexing.
            try {
              const rag = waitForIndex
                ? await waitForRagIndex({
                    apiKey,
                    docId: createdId,
                    model: ragModel,
                    timeoutMs: indexTimeoutMs,
                    pollIntervalMs: indexPollIntervalMs,
                  })
                : await (async () => {
                    const { res: ragRes, data: ragData } = await computeRagIndex({ apiKey, docId: createdId, model: ragModel })
                    return ragRes.ok ? ragData : { ok: false, status: ragRes.status, error: ragData }
                  })()

              entry.details = {
                ...(typeof entry.details === "object" && entry.details ? (entry.details as any) : {}),
                ragIndex: rag,
              }
            } catch (e) {
              entry.details = {
                ...(typeof entry.details === "object" && entry.details ? (entry.details as any) : {}),
                ragIndex: { ok: false, error: e instanceof Error ? e.message : String(e) },
              }
            }

            createdLocators.push({
              type: "url",
              id: createdId,
              name,
              usage_mode: "auto",
            })

            // Best-effort: fetch doc details so we can confirm extraction/size.
            try {
              const detailRes = await fetch(
                `https://api.elevenlabs.io/v1/convai/knowledge-base/${encodeURIComponent(createdId)}`,
                { headers: { "xi-api-key": apiKey } },
              )
              const detailText = await detailRes.text()
              let detailData: unknown = null
              try {
                detailData = detailText ? JSON.parse(detailText) : null
              } catch {
                detailData = detailText
              }
              entry.details = detailData
            } catch {
              // ignore
            }
          }
        } catch (e) {
          entry.error = e instanceof Error ? e.message : "Unknown error"
          results.push(entry)
          continue
        }

        results.push(entry)
      }

      const uniqueLocators = Array.from(
        new Map(createdLocators.map((l) => [l.id, l])).values(),
      )
      const uniqueIds = uniqueLocators.map((l) => l.id)

      // If URL ingestion produced no document IDs, fall back to uploading a single synthesized file.
      if (uniqueLocators.length === 0) {
        const docName = String(body?.name || `${creatorName || "Substack"} Articles`).trim() || "Substack Articles"
        const text = buildKnowledgeBaseText({ creatorName, substackUrl, articles })
        const form = new FormData()
        form.append("name", docName)
        form.append("file", new Blob([text], { type: "text/plain" }), "substack-articles.txt")

        const res = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base", {
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
              results,
              fallbackAttempted: true,
              fallbackStatus: res.status,
              fallbackError: data,
            },
            { status: res.status || 502 },
          )
        }

        // Best-effort: if the file upload returned an ID, attach it too.
        const fallbackId = (data as any)?.id
        if (typeof fallbackId === "string" && fallbackId) {
          // Trigger/ensure RAG indexing for the fallback doc.
          try {
            const { res: ragRes, data: ragData } = await computeRagIndex({ apiKey, docId: fallbackId, model: ragModel })
            if (!ragRes.ok) {
              results.push({
                url: "(fallback)",
                name: docName,
                id: fallbackId,
                status: ragRes.status,
                error: { ragIndex: ragData },
              })
            } else {
              results.push({
                url: "(fallback)",
                name: docName,
                id: fallbackId,
                details: { ragIndex: ragData },
              })
            }
          } catch (e) {
            results.push({
              url: "(fallback)",
              name: docName,
              id: fallbackId,
              error: { ragIndex: e instanceof Error ? e.message : String(e) },
            })
          }

          const getAgentRes = await fetch(
            `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`,
            { headers: { "xi-api-key": apiKey } },
          )
          const getAgentText = await getAgentRes.text()
          let agentData: any = null
          try {
            agentData = getAgentText ? JSON.parse(getAgentText) : null
          } catch {
            agentData = getAgentText
          }

          if (getAgentRes.ok) {
            const existingPrompt = agentData?.conversation_config?.agent?.prompt
            const existingKb: KnowledgeBaseLocator[] = Array.isArray(existingPrompt?.knowledge_base)
              ? (existingPrompt.knowledge_base as any[]).filter(
                  (x) => x && typeof x === "object" && typeof (x as any).id === "string",
                )
              : []

            const merged = Array.from(
              new Map(
                [...existingKb, { type: (data as any)?.type || "file", id: fallbackId, name: docName, usage_mode: "auto" }].map(
                  (l) => [l.id, l],
                ),
              ).values(),
            )

            // ElevenLabs rejects PATCH payloads containing both `tools` and `tool_ids`.
            // Agent GET responses can include both, so strip `tool_ids` before PATCHing.
            const promptWithoutToolIds: any = { ...(existingPrompt as any) }
            delete promptWithoutToolIds.tool_ids
            delete promptWithoutToolIds.toolIds

            const updatedPrompt = {
              ...promptWithoutToolIds,
              knowledge_base: merged,
              rag: {
                ...(existingPrompt?.rag || {}),
                enabled: true,
              },
            }

            await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`, {
              method: "PATCH",
              headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                conversation_config: {
                  ...(agentData.conversation_config || {}),
                  agent: {
                    ...(agentData.conversation_config?.agent || {}),
                    prompt: updatedPrompt,
                  },
                },
              }),
            })
          }
        }

        return NextResponse.json({ success: true, results, fallback: true, fallbackResult: data, ragIndexModel: ragModel })
      }

      // 2) PATCH the agent to reference the created KB docs
      const { res: getAgentRes, data: agentData } = await fetchAgentWithRetry({ apiKey, agentId })
      if (!getAgentRes.ok) {
        console.error("KB attach failed: could not fetch agent", {
          agentId,
          status: getAgentRes.status,
          agentError: agentData,
          createdIds: uniqueIds,
        })
        return NextResponse.json(
          { success: false, error: "Failed to fetch agent for KB attachment", status: getAgentRes.status, agentError: agentData, results },
          { status: getAgentRes.status || 502 },
        )
      }

      const existingPrompt = agentData?.conversation_config?.agent?.prompt
      if (!existingPrompt || typeof existingPrompt !== "object") {
        return NextResponse.json(
          { success: false, error: "Agent prompt config missing; cannot attach knowledge base", results },
          { status: 500 },
        )
      }

      const existingKb: KnowledgeBaseLocator[] = Array.isArray(existingPrompt.knowledge_base)
        ? (existingPrompt.knowledge_base as any[]).filter(
            (x) => x && typeof x === "object" && typeof (x as any).id === "string",
          )
        : []

      const mergedKb = Array.from(
        new Map([...existingKb, ...uniqueLocators].map((l) => [l.id, l])).values(),
      )

      // Important: ElevenLabs rejects PATCH payloads containing both `tools` and `tool_ids`.
      // When we supply explicit `tools` objects, strip any `tool_ids` fields from the prompt.
      const promptWithoutToolIds: any = { ...(existingPrompt as any) }
      delete promptWithoutToolIds.tool_ids
      delete promptWithoutToolIds.toolIds

      const updatedPrompt = {
        ...promptWithoutToolIds,
        knowledge_base: mergedKb,
        tools: await ensureRequiredTools({ apiKey, existingTools: existingPrompt.tools }),
        rag: {
          ...(existingPrompt.rag || {}),
          enabled: true,
        },
      }

      const patchPayload = {
        conversation_config: {
          ...(agentData.conversation_config || {}),
          agent: {
            ...(agentData.conversation_config?.agent || {}),
            prompt: updatedPrompt,
          },
        },
      }

      const { res: patchRes, data: patchData } = await patchAgentWithRetry({ apiKey, agentId, patchPayload })

      for (const r of results) r.patchedAgent = patchData

      if (!patchRes.ok) {
        console.error("KB attach failed: agent PATCH rejected", {
          agentId,
          status: patchRes.status,
          patchError: patchData,
          createdIds: uniqueIds,
        })
        return NextResponse.json(
          { success: false, error: "Failed to attach KB docs to agent", status: patchRes.status, patchError: patchData, results },
          { status: patchRes.status || 502 },
        )
      }

      return NextResponse.json({
        success: true,
        attachedCount: uniqueIds.length,
        knowledgeBaseIds: uniqueIds,
        results,
        ragIndexModel: ragModel,
        waitForIndex,
        indexTimeoutMs,
        indexPollIntervalMs,
      })
    }

    // Fallback: upload a single synthesized text file if URLs are missing.
    const docName = String(body?.name || `${creatorName || "Substack"} Articles`).trim() || "Substack Articles"
    const text = buildKnowledgeBaseText({ creatorName, substackUrl, articles })
    const form = new FormData()
    form.append("name", docName)
    form.append("file", new Blob([text], { type: "text/plain" }), "substack-articles.txt")

    const res = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base", {
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

export async function GET(req: NextRequest) {
  try {
    const apiKey = getElevenLabsApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing ElevenLabs API key (set ELEVEN_API_KEY)." },
        { status: 500 },
      )
    }

    const { searchParams } = new URL(req.url)
    const agentId = String(searchParams.get("agentId") || "").trim()
    const docId = String(searchParams.get("docId") || "").trim()

    // Debug helper: fetch a single document's details (includes `supported_usages`).
    if (docId) {
      const detailRes = await fetch(
        `https://api.elevenlabs.io/v1/convai/knowledge-base/${encodeURIComponent(docId)}`,
        { headers: { "xi-api-key": apiKey } },
      )

      const detailText = await detailRes.text()
      let detailData: unknown = null
      try {
        detailData = detailText ? JSON.parse(detailText) : null
      } catch {
        detailData = detailText
      }

      if (!detailRes.ok) {
        return NextResponse.json(
          { success: false, status: detailRes.status, error: detailData },
          { status: detailRes.status },
        )
      }

      return NextResponse.json({ success: true, data: detailData })
    }

    const listRes = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base", {
      headers: { "xi-api-key": apiKey },
    })

    const text = await listRes.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (!listRes.ok) {
      return NextResponse.json(
        { success: false, status: listRes.status, error: data },
        { status: listRes.status },
      )
    }

    if (agentId && data && typeof data === "object" && Array.isArray((data as any).documents)) {
      const docs = (data as any).documents as any[]
      const attachedToAgent = docs.filter((d) =>
        Array.isArray(d?.dependent_agents)
          ? d.dependent_agents.some((a: any) => a?.agent_id === agentId || a?.id === agentId)
          : false,
      )
      return NextResponse.json({ success: true, data, attachedToAgent, attachedCount: attachedToAgent.length })
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
