import { NextResponse, type NextRequest } from "next/server"

function getElevenLabsApiKey(): string | undefined {
  return process.env.ELEVEN_API_KEY
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

    const body = await req.json()
    const name = String(body?.name || "").trim()
    const systemPrompt = String(body?.systemPrompt || "").trim()
    const greeting = String(body?.greeting || "").trim()
    const voiceId = String(body?.voiceId || "").trim()
    const tags = Array.isArray(body?.tags) ? (body.tags as unknown[]).map(String) : undefined
    const language = String(body?.language || "en").trim() || "en"

    if (!name) return NextResponse.json({ success: false, error: "Missing name" }, { status: 400 })
    if (!voiceId) return NextResponse.json({ success: false, error: "Missing voiceId" }, { status: 400 })

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
          max_duration_seconds: 6000,
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
          ...(systemPrompt ? { prompt: { prompt: systemPrompt } } : {}),
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
