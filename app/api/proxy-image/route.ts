import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")
    if (!url) {
      return NextResponse.json({ success: false, error: "Missing url parameter" }, { status: 400 })
    }

    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ success: false, error: "Invalid url parameter" }, { status: 400 })
    }

    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StackTalkBot/1.0; +https://stacktalk.app)",
      },
      cache: "no-store",
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: `Upstream fetch failed with status ${upstream.status}` },
        { status: upstream.status },
      )
    }

    const arrayBuffer = await upstream.arrayBuffer()
    const contentType = upstream.headers.get("content-type") || "image/png"
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    const dataUrl = `data:${contentType};base64,${base64}`

    return NextResponse.json({ success: true, dataUrl, contentType })
  } catch (error) {
    console.error("❌ proxy-image error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to proxy image", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}
