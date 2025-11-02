import { NextRequest } from "next/server"

const ALLOWED_HOSTS = new Set([
  "substackcdn.com",
  "substack-post-media.s3.amazonaws.com",
])

function isAllowed(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== "https:") return false
    const host = u.hostname.toLowerCase()
    if (ALLOWED_HOSTS.has(host)) return true
    // Allow subdomains of substack.com
    if (host.endsWith(".substack.com")) return true
    return false
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url")
  if (!urlParam) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), { status: 400 })
  }

  if (!isAllowed(urlParam)) {
    return new Response(JSON.stringify({ error: "URL not allowed" }), { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(urlParam, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,application/octet-stream",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok || !res.body) {
      return new Response(JSON.stringify({ error: `Upstream fetch failed: ${res.status}` }), { status: 502 })
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream"
    return new Response(res.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
      },
      status: 200,
    })
  } catch (e) {
    clearTimeout(timeout)
    return new Response(JSON.stringify({ error: "Fetch error" }), { status: 500 })
  }
}
