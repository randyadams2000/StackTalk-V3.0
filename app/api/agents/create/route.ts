import { NextResponse, type NextRequest } from "next/server"

function ensurePacificTimePrompt(systemPrompt: string): string {
  const prompt = String(systemPrompt ?? "")
  const normalized = prompt.toLowerCase()
  if (normalized.includes("america/los_angeles") || normalized.includes("pacific time")) return prompt

  const prefix = "TIMEZONE\nLocal time zone: America/Los_Angeles (Pacific Time, US).\n\n"
  return `${prefix}${prompt}`
}

function getElevenLabsApiKey(): string | undefined {
  const candidates = [
    process.env.ELEVEN_API_KEY,
    process.env.ELEVENLABS_API_KEY,
    process.env.ELEVEN_LABS_API_KEY,
  ]
  for (const value of candidates) {
    const trimmed = typeof value === "string" ? value.trim() : ""
    if (trimmed) return trimmed
  }
  return undefined
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

async function buildDefaultTools(req: NextRequest, apiKey: string): Promise<any[]> {
  // NOTE: These tool schemas match the structure ElevenLabs expects in
  // `conversation_config.agent.prompt.tools`.
  const origin = req.headers.get("origin") || ""

  const retrieveUrl =
    getOptionalEnv("ELEVEN_GET_CONTEXT_URL") ||
    getOptionalEnv("CONTEXT_RETRIEVE_URL") ||
    "https://vtbstifl22flybdwtjideakc340erefx.lambda-url.us-east-1.on.aws/retrieve"

  const saveUrl =
    getOptionalEnv("ELEVEN_SAVE_CONTEXT_URL") ||
    getOptionalEnv("CONTEXT_SAVE_URL") ||
    "https://vtbstifl22flybdwtjideakc340erefx.lambda-url.us-east-1.on.aws/save"

  const exaConnectionId =
    getOptionalEnv("ELEVEN_EXA_CONNECTION_ID") ||
    getOptionalEnv("EXA_INTEGRATION_CONNECTION_ID") ||
    (await discoverExaConnectionId(apiKey))

  const tools: any[] = [
    {
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
    },
    {
      type: "webhook",
      name: "GetTime",
      description:
        "Get the current time (America/Los_Angeles) and assign it to {{current_time}}. Call this at the start of the conversation.",
      response_timeout_secs: 10,
      disable_interruptions: false,
      force_pre_tool_speech: false,
      assignments: [
        {
          source: "response",
          dynamic_variable: "current_time",
          value_path: "datetime",
        },
      ],
      tool_call_sound: null,
      tool_call_sound_behavior: "auto",
      dynamic_variables: {
        dynamic_variable_placeholders: {},
      },
      execution_mode: "immediate",
      api_schema: {
        request_headers: {
          Accept: "application/json",
        },
        url: "https://worldtimeapi.org/api/timezone/America/Los_Angeles",
        method: "GET",
        path_params_schema: {},
        query_params_schema: null,
        request_body_schema: null,
        content_type: "application/json",
        auth_connection: null,
      },
    },
    {
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
    },
    {
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
    },
  ]

  if (exaConnectionId) {
    tools.push({
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
  } else {
    // Keep the other 3 tools, but surface a helpful hint for Exa setup.
    // We don't hard-fail agent creation because some environments don't have Exa configured.
    console.warn(
      "Exa integration connection id not found; omitting exa_search tool. Set ELEVEN_EXA_CONNECTION_ID to force-enable.",
    )
  }

  // Suppress unused var lint (origin reserved for future use if you want to host your own webhook URLs)
  void origin
  return tools
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getElevenLabsApiKey()
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing ElevenLabs API key. Set ELEVEN_API_KEY (or ELEVENLABS_API_KEY / ELEVEN_LABS_API_KEY) in your deployment environment.",
        },
        { status: 500 },
      )
    }

    const body = await req.json()
    const name = String(body?.name || "").trim()
    const systemPrompt = String(body?.systemPrompt || "").trim()
    const greeting = String(body?.greeting || "").trim()
    const voiceId = String(body?.voiceId || "").trim()
    const tags = Array.isArray(body?.tags) ? (body.tags as unknown[]).map(String) : undefined
    const language = String(body?.language || "en").trim() || "en"

    if (!name) return NextResponse.json({ success: false, error: "Missing name" }, { status: 400 })
    if (!voiceId) return NextResponse.json({ success: false, error: "Missing voiceId" }, { status: 400 })

    const tools = await buildDefaultTools(req, apiKey)
    const effectiveSystemPrompt = systemPrompt ? ensurePacificTimePrompt(systemPrompt) : ""

    // ElevenLabs ConvAI expects a fairly rich `conversation_config` schema.
    // We mirror the shape returned by GET /v1/convai/agents/{agent_id} to avoid schema-related 5xx/422s.
    const payload: any = {
      name,
      tags,
      conversation_config: {
        asr: {
          quality: "high",
          provider: "scribe_realtime",
          user_input_audio_format: "pcm_16000",
          keywords: [],
        },
        turn: {
          turn_timeout: 25.0,
          initial_wait_time: null,
          silence_end_call_timeout: -1.0,
          soft_timeout_config: {
            timeout_seconds: -1.0,
            message: "Just a second…",
          },
          mode: "turn",
          turn_eagerness: "normal",
        },
        tts: {
          model_id: "eleven_turbo_v2",
          voice_id: voiceId,
          supported_voices: [],
          suggested_audio_tags: [],
          agent_output_audio_format: "pcm_44100",
          optimize_streaming_latency: 2,
          stability: 0.5,
          speed: 1.0,
          similarity_boost: 0.8,
          text_normalisation_type: "system_prompt",
          pronunciation_dictionary_locators: [],
        },
        conversation: {
          text_only: false,
          max_duration_seconds: 60,
          client_events: [
            "audio",
            "interruption",
            "user_transcript",
            "agent_response",
            "agent_response_correction",
          ],
        },
        language_presets: {},
        vad: {
          background_voice_detection: false,
        },
        agent: {
          first_message: greeting || "Hi — how can I help today?",
          language,
          hinglish_mode: false,
          dynamic_variables: {
            dynamic_variable_placeholders: {},
          },
          disable_first_message_interruptions: false,
          prompt: {
            ...(effectiveSystemPrompt ? { prompt: effectiveSystemPrompt } : {}),
            tools,
          },
        },
      },
    }

    const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    })

    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
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

    const agentId = data?.agent_id
    return NextResponse.json({ success: true, agentId, raw: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
