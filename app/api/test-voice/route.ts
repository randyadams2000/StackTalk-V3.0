import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    if (!voiceId) {
      return NextResponse.json({ error: "Voice ID is required" }, { status: 400 })
    }

    console.log("🎤 Testing voice synthesis:", {
      text: text.substring(0, 50) + "...",
      voiceId: voiceId.substring(0, 20) + "...",
    })

    // Check if ElevenLabs API key is available
    const elevenLabsApiKey = process.env.NEXT_PUBLIC_ELEVEN_API_KEY
    if (!elevenLabsApiKey) {
      console.warn("⚠️ ElevenLabs API key not found, using mock response")

      // Mock response for development
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Return a mock audio response (small silent audio buffer)
      const mockAudioBuffer = new ArrayBuffer(1024)
      return new Response(mockAudioBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": mockAudioBuffer.byteLength.toString(),
          "X-Mock-Response": "true",
        },
      })
    }

    try {
      console.log("📡 Making request to ElevenLabs TTS API...")

      // Use ElevenLabs Text-to-Speech API
      const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg", // Request MP3 format
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_flash_v2_5", // Use the standard model
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
          // Optional: specify output format
          output_format: "mp3_44100_128",
        }),
      })

      console.log("📊 ElevenLabs TTS response status:", elevenLabsResponse.status)
      console.log("📊 ElevenLabs TTS response headers:", Object.fromEntries(elevenLabsResponse.headers.entries()))

      if (!elevenLabsResponse.ok) {
        const errorText = await elevenLabsResponse.text()
        console.error("❌ ElevenLabs TTS error:", errorText)

        // Parse error response
        let errorMessage = "ElevenLabs TTS error"
        try {
          const errorJson = JSON.parse(errorText)
          console.error("❌ Parsed ElevenLabs TTS error:", errorJson)

          if (errorJson.detail) {
            if (typeof errorJson.detail === "string") {
              errorMessage = errorJson.detail
            } else if (errorJson.detail.message) {
              errorMessage = errorJson.detail.message
            }
          } else if (errorJson.message) {
            errorMessage = errorJson.message
          }
        } catch (parseError) {
          errorMessage = errorText
        }

        // Handle specific error cases
        if (elevenLabsResponse.status === 404) {
          return NextResponse.json(
            {
              error:
                "Voice not found in ElevenLabs. The voice may not have been created successfully or the voice_id is invalid.",
              voiceId: voiceId,
              suggestion: "Please try creating the voice clone again.",
            },
            { status: 404 },
          )
        } else if (elevenLabsResponse.status === 401) {
          return NextResponse.json(
            {
              error: "Invalid ElevenLabs API key",
              voiceId: voiceId,
            },
            { status: 401 },
          )
        } else if (elevenLabsResponse.status === 422) {
          return NextResponse.json(
            {
              error: `Validation error: ${errorMessage}`,
              voiceId: voiceId,
            },
            { status: 422 },
          )
        }

        return NextResponse.json(
          {
            error: `Voice synthesis failed: ${errorMessage}`,
            voiceId: voiceId,
            status: elevenLabsResponse.status,
          },
          { status: elevenLabsResponse.status },
        )
      }

      // Return the audio stream directly
      const audioBuffer = await elevenLabsResponse.arrayBuffer()
      console.log("✅ ElevenLabs TTS success, audio size:", audioBuffer.byteLength, "bytes")

      return new Response(audioBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": audioBuffer.byteLength.toString(),
          "Cache-Control": "no-cache",
        },
      })
    } catch (elevenLabsError) {
      console.error("❌ ElevenLabs TTS request failed:", elevenLabsError)

      // Check if it's a network error
      if (elevenLabsError instanceof TypeError && elevenLabsError.message.includes("fetch")) {
        console.error("❌ Network error connecting to ElevenLabs TTS")

        // Return mock audio as fallback
        const mockAudioBuffer = new ArrayBuffer(1024)
        return new Response(mockAudioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": mockAudioBuffer.byteLength.toString(),
            "X-Fallback": "true",
            "X-Error": "Network error",
          },
        })
      }

      // Re-throw other errors
      throw elevenLabsError
    }
  } catch (error) {
    console.error("❌ Voice test error:", error)
    return NextResponse.json(
      {
        error: "Voice synthesis failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
