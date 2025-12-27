import { NextResponse, type NextRequest } from "next/server"

function getElevenLabsApiKey(): string | undefined {
  return process.env.APP_ELEVEN_API_KEY || process.env.ELEVEN_API_KEY
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
    if (!agentId) {
      return NextResponse.json({ success: false, error: "Missing agentId" }, { status: 400 })
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
        },
      },
    )

    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (!res.ok) {
      return NextResponse.json(
        { success: false, status: res.status, error: data },
        { status: res.status },
      )
    }

    return NextResponse.json({ success: true, raw: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
