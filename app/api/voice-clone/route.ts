import { type NextRequest, NextResponse } from "next/server"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

export const runtime = "nodejs"

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const voiceId = searchParams.get("voiceId")

    if (!voiceId) {
      return NextResponse.json({ success: false, error: "Voice ID is required" }, { status: 400 })
    }

    // Check if ElevenLabs API key is available
    const elevenLabsApiKey = process.env.ELEVEN_API_KEY
    if (!elevenLabsApiKey) {
      console.warn("⚠️ ELEVEN_API_KEY missing, returning mock deletion")
      return NextResponse.json({
        success: true,
        message: "Voice clone deleted successfully (mock mode)",
        voiceId,
      })
    }

    // Delete from ElevenLabs
    const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: "DELETE",
      headers: { "xi-api-key": elevenLabsApiKey },
    })

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text()
      console.error("❌ ElevenLabs deletion failed:", errorText)
      return NextResponse.json(
        { success: false, error: `Voice deletion failed: ${errorText}` },
        { status: elevenLabsResponse.status },
      )
    }

    return NextResponse.json({
      success: true,
      message: "Voice clone deleted successfully from ElevenLabs",
      voiceId,
    })
  } catch (error) {
    console.error("❌ Voice deletion error:", error)
    return NextResponse.json(
      { success: false, error: "Voice deletion failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentTypeHeader = request.headers.get("content-type") || ""

    let audioBytes: Uint8Array | null = null
    let audioMime: string = "audio/wav"
    let voiceName = ""
    let voiceDescription = ""

    if (contentTypeHeader.includes("application/json")) {
      // JSON path: expect an S3 key
      const body = await request.json()
      const s3Key: string | undefined = body.s3Key
      voiceName = body.voiceName
      voiceDescription = body.voiceDescription

      if (!s3Key) {
        return NextResponse.json({ success: false, error: "s3Key is required" }, { status: 400 })
      }

      const bucket = process.env.S3_BUCKET_NAME
      const region = process.env.AWS_REGION
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
      const sessionToken = process.env.AWS_SESSION_TOKEN
      if (!bucket || !region) {
        return NextResponse.json(
          { success: false, error: "S3 is not configured. Missing S3_BUCKET_NAME / AWS_REGION." },
          { status: 500 },
        )
      }

      const s3 = new S3Client({
        region,
        credentials:
          accessKeyId && secretAccessKey
            ? { accessKeyId, secretAccessKey, sessionToken }
            : undefined,
      })
      const getRes = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }))

      // Convert stream to Uint8Array
      const parts: Uint8Array[] = []
      for await (const chunk of (getRes.Body as any)) {
        if (chunk instanceof Uint8Array) parts.push(chunk)
        else parts.push(new Uint8Array(chunk))
      }
      let total = 0
      for (const p of parts) total += p.length
      const joined = new Uint8Array(total)
      let offset = 0
      for (const p of parts) {
        joined.set(p, offset)
        offset += p.length
      }
      audioBytes = joined
      audioMime = getRes.ContentType || "audio/wav"

      const fileSizeMB = (audioBytes.byteLength / (1024 * 1024)).toFixed(2)
      const maxSize = 25 * 1024 * 1024
      console.log("📁 S3 file validation:", {
        key: s3Key,
        fileSize: `${fileSizeMB} MB`,
        contentType: audioMime,
        withinLimit: audioBytes.byteLength <= maxSize,
      })
      if (audioBytes.byteLength > maxSize) {
        return NextResponse.json(
          {
            success: false,
            error: "Audio file too large. Maximum size is 25MB for ElevenLabs.",
            fileSize: `${fileSizeMB} MB`,
            maxSize: "25 MB",
          },
          { status: 413 },
        )
      }
    } else {
      // Existing multipart/form-data path
      const formData = await request.formData()
      const audioFile = formData.get("audio") as File | null
      voiceName = (formData.get("voiceName") as string) || ""
      voiceDescription = (formData.get("voiceDescription") as string) || ""

      if (!audioFile) {
        return NextResponse.json({ success: false, error: "Audio file is required" }, { status: 400 })
      }
      const maxSize = 25 * 1024 * 1024
      if (audioFile.size > maxSize) {
        return NextResponse.json(
          {
            success: false,
            error: "Audio file too large. Maximum size is 25MB for ElevenLabs.",
            fileSize: `${(audioFile.size / 1024 / 1024).toFixed(2)} MB`,
            maxSize: "25 MB",
          },
          { status: 413 },
        )
      }
      audioMime = audioFile.type || "audio/wav"
      audioBytes = new Uint8Array(await audioFile.arrayBuffer())
    }

    // At this point we have audioBytes + audioMime + voiceName + voiceDescription
    if (!voiceName || !voiceDescription) {
      return NextResponse.json({ success: false, error: "Voice name and description are required" }, { status: 400 })
    }

    // Check if ElevenLabs API key is available
    const elevenLabsApiKey = process.env.ELEVEN_API_KEY
    if (!elevenLabsApiKey) {
      console.warn("⚠️ ELEVEN_API_KEY missing, returning mock")
      return NextResponse.json({
        success: true,
        voice_id: `voice_${Date.now()}`,
        voiceId: `voice_${Date.now()}`,
        message: "Voice clone created successfully (mock mode)",
        audioInfo: { fileSize: audioBytes?.byteLength || 0 },
      })
    }

    // Create FormData for ElevenLabs
    const elevenLabsFormData = new FormData()
    elevenLabsFormData.append("name", voiceName)
    elevenLabsFormData.append("description", voiceDescription)
    const ab = audioBytes!.buffer.slice(
      audioBytes!.byteOffset,
      audioBytes!.byteOffset + audioBytes!.byteLength,
    ) as ArrayBuffer
    elevenLabsFormData.append("files", new Blob([ab], { type: audioMime }), "voice-sample")
    elevenLabsFormData.append("remove_background_noise", "true")
    elevenLabsFormData.append(
      "labels",
      JSON.stringify({ source: "talk2me-onboarding", created_at: new Date().toISOString() }),
    )

    const elevenLabsResponse = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": elevenLabsApiKey },
      body: elevenLabsFormData,
    })

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text()
      return NextResponse.json(
        { success: false, error: `Voice cloning failed: ${errorText}` },
        { status: elevenLabsResponse.status },
      )
    }

    const elevenLabsResult = await elevenLabsResponse.json()
    const voiceId = elevenLabsResult.voice_id
    if (!voiceId) {
      return NextResponse.json(
        { success: false, error: "Voice clone created but no voice_id returned from ElevenLabs" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      voice_id: voiceId,
      voiceId,
      message: "Voice clone created successfully with ElevenLabs IVC",
      elevenLabsResponse: elevenLabsResult,
    })
  } catch (error) {
    console.error("❌ Voice clone error:", error)
    return NextResponse.json(
      { success: false, error: "Voice cloning failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}
