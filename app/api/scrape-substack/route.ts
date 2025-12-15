import { type NextRequest, NextResponse } from "next/server"

interface SubstackData {
  success: boolean
  data: {
    author: string
    posts: string[]
    articles?: {
      title: string
      url?: string
      content?: string
      publishedAt?: string
    }[]
    category: string
    rssUrl: string
    substackUrl: string
    totalPosts: number
    aboutUrl?: string
    socialUrls?: string[]
    description?: string
    profileImageUrl?: string
    variables: {
      SUBSTACK_URL: string
      RSS_URL: string
      CREATOR_NAME: string
      CREATOR_WEBSITE?: string
      CREATOR_SOCIAL?: string
      CREATOR_IMAGE?: string
    }
  }
  error?: string
}

// --- Helpers to extract image from <picture> or meta tags ---
function toAbsoluteUrl(src: string, base: string): string {
  try {
    return new URL(src, base).href
  } catch {
    return src
  }
}

// Robustly parse srcset entries that may contain commas in the URL (Substack CDN)
// Matches sequences like: <URL><space><descriptor>, where descriptor is 112w or 2x
function parseSrcset(srcset: string): { url: string; width: number; dpr?: number }[] {
  const results: { url: string; width: number; dpr?: number }[] = []
  const re = /(\S+)\s+(\d+w|\d+(?:\.\d+)?x)(?=\s*,|\s*$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(srcset)) !== null) {
    const url = m[1]
    const desc = m[2]
    let width = 0
    let dpr: number | undefined
    if (desc.endsWith("w")) {
      width = parseInt(desc.slice(0, -1), 10) || 0
    } else if (desc.endsWith("x")) {
      dpr = parseFloat(desc.slice(0, -1))
      // Assume a baseline width when only DPR given; keep width as 0 so we can sort by dpr later if needed
    }
    results.push({ url, width, dpr })
  }
  // If widths are missing but DPRs exist, sort by DPR
  if (results.every(r => r.width === 0) && results.some(r => r.dpr)) {
    results.sort((a, b) => (a.dpr || 0) - (b.dpr || 0))
  }
  return results
}

function pickBestFromSrcset(srcset: string, baseUrl: string): string | null {
  const items = parseSrcset(srcset)
  if (!items.length) return null
  // Prefer width between 256 and 512 when available, else choose the largest width (or highest DPR)
  const byWidth = items.filter(i => i.width > 0).sort((a, b) => a.width - b.width)
  if (byWidth.length) {
    const preferred = byWidth.find(i => i.width >= 256 && i.width <= 512) || byWidth[byWidth.length - 1]
    return toAbsoluteUrl(preferred.url, baseUrl)
  }
  // Fall back to DPR-based selection
  const byDpr = items.slice().sort((a, b) => (a.dpr || 0) - (b.dpr || 0))
  const preferred = byDpr.find(i => (i.dpr || 0) >= 2) || byDpr[byDpr.length - 1]
  return toAbsoluteUrl(preferred.url, baseUrl)
}

function extractOgImage(html: string, baseUrl: string): string | null {
  const metaMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"'>]+)["'][^>]*>/i)
  if (metaMatch && metaMatch[1]) return toAbsoluteUrl(metaMatch[1], baseUrl)
  const metaNameMatch = html.match(/<meta[^>]+name=["']og:image["'][^>]*content=["']([^"'>]+)["'][^>]*>/i)
  if (metaNameMatch && metaNameMatch[1]) return toAbsoluteUrl(metaNameMatch[1], baseUrl)
  return null
}

function extractFromJsonLd(html: string, baseUrl: string): string | null {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const s of scripts) {
    try {
      const json = JSON.parse(s[1])
      const candidates: string[] = []
      if (json?.image) candidates.push(typeof json.image === 'string' ? json.image : json.image.url)
      if (json?.logo) candidates.push(typeof json.logo === 'string' ? json.logo : json.logo.url)
      if (json?.publisher?.logo) candidates.push(json.publisher.logo.url)
      const hit = candidates.find(Boolean)
      if (hit) return toAbsoluteUrl(hit, baseUrl)
    } catch {}
  }
  return null
}

// As an extra fallback, scan for <img> avatars outside <picture>
function extractAvatarImg(html: string, baseUrl: string, targetName?: string): string | null {
  const norm = (s: string) => (s || '').toLowerCase()
  const name = norm(targetName || '')
  const imgs = [...html.matchAll(/<img[^>]*>/gi)].map(m => m[0])
  const scored = imgs.map(tag => {
    const lower = norm(tag)
    const altMatch = tag.match(/alt=["']([^"']+)["']/i)
    const alt = norm(altMatch?.[1] || '')
    let score = 0
    if (/(avatar|profile|author|user)/.test(lower)) score += 3
    if (alt.includes('avatar')) score += 3
    if (name && (alt.includes(name) || lower.includes(name))) score += 2
    if (/\b(width|height)=["'](96|112|128)["']/.test(lower) || /sizes=["']\s*112px/i.test(lower)) score += 1
    return { tag, score }
  }).sort((a, b) => b.score - a.score)

  for (const { tag } of scored) {
    // Prefer img srcset
    const srcset = tag.match(/srcset=["']([^"']+)["']/i)
    if (srcset && srcset[1]) {
      const best = pickBestFromSrcset(srcset[1], baseUrl)
      if (best) return best
    }
    const src = tag.match(/src=["']([^"'>\s]+)["']/i)
    if (src && src[1]) return toAbsoluteUrl(src[1], baseUrl)
  }
  return null
}

function extractImageFromPicture(html: string, baseUrl: string, targetName?: string): string | null {
  const pictures = [...html.matchAll(/<picture[\s\S]*?<\/picture>/gi)].map((m) => m[0])
  if (!pictures.length) return null

  const norm = (s: string) => (s || '').toLowerCase()
  const name = norm(targetName || '')

  const scored = pictures.map((block) => {
    const lower = norm(block)
    const altMatch = block.match(/alt=["']([^"']+)["']/i)
    const alt = norm(altMatch?.[1] || '')
    let score = 0
    if (/(avatar|profile|author|user)/.test(lower)) score += 3
    if (alt.includes("avatar")) score += 4
    if (name && (alt.includes(name) || lower.includes(name))) score += 3
    if (/\b(width|height)=["'](96|112|128)["']/.test(lower) || /sizes=["']\s*112px/i.test(lower)) score += 2
    score += Math.min((block.match(/<source/gi) || []).length, 2)
    return { block, score }
  })

  scored.sort((a, b) => b.score - a.score)

  for (const { block } of scored) {
    // Prefer <img srcset>
    const imgSrcset = block.match(/<img[^>]+srcset=["']([^"'>]+)["'][^>]*>/i)
    if (imgSrcset && imgSrcset[1]) {
      const best = pickBestFromSrcset(imgSrcset[1], baseUrl)
      if (best) return best
    }

    // Fallback to <img src>
    const imgMatch = block.match(/<img[^>]+src=["']([^"'>\s]+)["'][^>]*>/i)
    if (imgMatch && imgMatch[1]) return toAbsoluteUrl(imgMatch[1], baseUrl)

    // Then try <source srcset>
    const sourceMatch = block.match(/<source[^>]+srcset=["']([^"'>]+)["'][^>]*>/i)
    if (sourceMatch && sourceMatch[1]) {
      const best = pickBestFromSrcset(sourceMatch[1], baseUrl)
      if (best) return best
    }
  }

  // Last resort, look for <img> outside <picture>
  return extractAvatarImg(html, baseUrl, targetName)
}

function stripHtmlToText(html: string): string {
  if (!html) return ""
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?p\b[^>]*>/gi, "\n")
    .replace(/<\/?div\b[^>]*>/gi, "\n")
    .replace(/<\/?li\b[^>]*>/gi, "\n- ")
    .replace(/<\/?h\d\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function firstNonEmpty(...vals: Array<string | undefined | null>): string {
  for (const v of vals) {
    const s = (v || "").trim()
    if (s) return s
  }
  return ""
}

async function fetchProfileImage(cleanUrl: string, targetName?: string): Promise<string | null> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  }

  // Try homepage
  try {
    const res = await fetch(cleanUrl, { headers, signal: AbortSignal.timeout(15000) })
    if (res.ok) {
      const html = await res.text()
      let img = extractImageFromPicture(html, cleanUrl, targetName)
      if (!img) img = extractFromJsonLd(html, cleanUrl)
      if (!img) img = extractOgImage(html, cleanUrl)
      if (img) return img
    }
  } catch {}

  // Try /about
  const aboutUrl = `${cleanUrl.replace(/\/$/, "")}/about`
  try {
    const res = await fetch(aboutUrl, { headers, signal: AbortSignal.timeout(15000) })
    if (res.ok) {
      const html = await res.text()
      let img = extractImageFromPicture(html, aboutUrl, targetName)
      if (!img) img = extractFromJsonLd(html, aboutUrl)
      if (!img) img = extractOgImage(html, aboutUrl)
      if (img) return img
    }
  } catch {}

  return null
}

export async function POST(request: NextRequest) {
  let url: string | undefined
  try {
    const { url: requestUrl } = await request.json()
    url = requestUrl

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    console.log("🔍 Starting Substack analysis for:", url)

    // Clean and validate URL
    const cleanUrl = url.replace(/\/$/, "").trim()
    const rssUrl = `${cleanUrl}/feed`
    const aboutUrl = `${cleanUrl}/about`

    console.log("📡 Generated URLs:", {
      main: cleanUrl,
      rss: rssUrl,
      about: aboutUrl,
    })

    // Extract creator info from URL
    const urlMatch = cleanUrl.match(/https?:\/\/([^.]+)\.substack\.com/)
    let creatorHandle = ""
    let creatorName = ""

    if (urlMatch) {
      creatorHandle = urlMatch[1]
      creatorName = creatorHandle
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    }

    console.log("👤 Creator info:", { handle: creatorHandle, name: creatorName })

    // Defer fetching profile image until after we know the author name from RSS
    let profileImageUrl: string | null = null

    // Fetch and parse RSS feed
    let posts: string[] = []
    let articles: { title: string; url?: string; content?: string; publishedAt?: string }[] = []
    let feedTitle = ""
    let feedDescription = ""
    let actualAuthorName = creatorName

    try {
      console.log("🚀 Fetching RSS feed...")

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      const rssResponse = await fetch(rssUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log("📊 RSS Response:", {
        status: rssResponse.status,
        statusText: rssResponse.statusText,
        headers: Object.fromEntries(rssResponse.headers.entries()),
      })

      if (!rssResponse.ok) {
        throw new Error(`RSS fetch failed: ${rssResponse.status} ${rssResponse.statusText}`)
      }

      const rssContent = await rssResponse.text()
      console.log("📄 RSS Content:", {
        length: rssContent.length,
        preview: rssContent.substring(0, 500),
      })

      // Validate RSS content - throw error if not valid RSS format
      if (!rssContent.includes("<rss") && !rssContent.includes("<feed") && !rssContent.includes("<?xml")) {
        console.error("❌ Invalid RSS format - content does not appear to be XML/RSS")
        throw new Error("RSS_INVALID_FORMAT")
      }

      // Additional validation: check for basic RSS structure
      const hasValidRssStructure = 
        (rssContent.includes("<rss") && rssContent.includes("<channel>")) ||
        (rssContent.includes("<feed") && rssContent.includes("xmlns"))
      
      if (!hasValidRssStructure) {
        console.error("❌ Invalid RSS structure - missing required RSS elements")
        throw new Error("RSS_INVALID_STRUCTURE")
      }

      // Extract feed metadata
      const titleMatch = rssContent.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)
      if (titleMatch) {
        feedTitle = titleMatch[1].trim()
        console.log("📰 Feed title:", feedTitle)

        // Try to extract actual author name from feed title
        if (feedTitle && !feedTitle.toLowerCase().includes("substack")) {
          actualAuthorName = feedTitle.replace(/['']s?\s*(newsletter|substack|blog)/gi, "").trim()
        }
      }

      const descMatch = rssContent.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i)
      if (descMatch) {
        feedDescription = descMatch[1].trim()
        console.log("📝 Feed description:", feedDescription)
      }

      // Extract posts from RSS items
      const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi
      const items = [...rssContent.matchAll(itemPattern)]

      console.log("📚 Found RSS items:", items.length)

      for (const item of items.slice(0, 15)) {
        // Limit to 15 most recent
        const itemContent = item[1]

        // Try multiple title extraction patterns
        const titlePatterns = [
          /<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/i,
          /<title[^>]*>(.*?)<\/title>/i,
          /<dc:title[^>]*><!\[CDATA\[(.*?)\]\]><\/dc:title>/i,
          /<dc:title[^>]*>(.*?)<\/dc:title>/i,
        ]

        let postTitle = ""
        for (const pattern of titlePatterns) {
          const match = itemContent.match(pattern)
          if (match && match[1]) {
            postTitle = match[1].trim()
            break
          }
        }

        // Extract link and content/description when available (for Knowledge Base ingestion)
        const linkMatch = itemContent.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)
        const urlFromItem = linkMatch ? linkMatch[1].trim() : ""

        const contentEncodedMatch = itemContent.match(
          /<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i,
        )
        const descriptionMatch = itemContent.match(
          /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i,
        )

        const rawBody = firstNonEmpty(contentEncodedMatch?.[1], descriptionMatch?.[1])
        const contentText = rawBody ? stripHtmlToText(rawBody) : ""

        const pubDateMatch = itemContent.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
        const publishedAt = pubDateMatch ? pubDateMatch[1].trim() : undefined

        if (postTitle) {
          // Clean up HTML entities
          postTitle = postTitle
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&nbsp;/g, " ")
            .replace(/<[^>]*>/g, "") // Remove any HTML tags
            .trim()

          // Filter out non-post content
          if (isValidPostTitle(postTitle)) {
            posts.push(postTitle)
            articles.push({
              title: postTitle,
              url: urlFromItem || undefined,
              content: contentText || undefined,
              publishedAt,
            })
            console.log("✅ Added post:", postTitle)
          }
        }
      }

      console.log("📚 Total valid posts extracted:", posts.length)
    } catch (rssError) {
      console.error("❌ RSS fetch/parse error:", rssError)
      
      // Check if this is a critical RSS format error
      if (rssError instanceof Error) {
        if (rssError.message === "RSS_INVALID_FORMAT" || rssError.message === "RSS_INVALID_STRUCTURE") {
          // Return error immediately without fallback for invalid RSS format
          return NextResponse.json({
            success: false,
            error: "CANNOT_CONNECT_TO_SUBSTACK",
            message: "I'm sorry, cannot continue. Unable to connect to your Substack page.",
            data: null
          }, { status: 400 })
        }
      }
      
      console.log("🔄 Will use fallback data...")
    }

    // Generate fallback data if RSS parsing failed
    if (posts.length === 0) {
      console.log("🔄 Generating fallback content...")
      posts = generateFallbackPosts(creatorName, creatorHandle)
    }

    // Determine content category
    const category = categorizeContent(posts, feedDescription)
    console.log("🎯 Content category:", category)

    // Look for potential social media links or website
    let creatorWebsite = ""
    let creatorSocial = ""

    // Try to find website from feed description
    const urlPattern = /https?:\/\/[^\s<>"]+/gi
    const foundUrls = feedDescription.match(urlPattern) || []
    for (const foundUrl of foundUrls) {
      if (!foundUrl.includes("substack.com") && !foundUrl.includes("mailto:")) {
        if (foundUrl.includes("twitter.com") || foundUrl.includes("tiktok.com") || foundUrl.includes("instagram.com")) {
          creatorSocial = foundUrl
        } else {
          creatorWebsite = foundUrl
        }
      }
    }

    // Now that we have a better author name, fetch profile image (homepage first, then /about)
    try {
      profileImageUrl = await fetchProfileImage(cleanUrl, actualAuthorName || creatorName || creatorHandle)
      console.log("🖼️ Profile image:", profileImageUrl || "not found")
    } catch (e) {
      console.warn("⚠️ Failed to fetch profile image:", e)
    }

    // Create dynamic variables for system prompt
    const variables = {
      SUBSTACK_URL: cleanUrl,
      RSS_URL: rssUrl,
      CREATOR_NAME: actualAuthorName,
      CREATOR_WEBSITE: creatorWebsite || cleanUrl,
      CREATOR_SOCIAL: creatorSocial || cleanUrl,
      CREATOR_IMAGE: profileImageUrl || "",
    }

    const result: SubstackData = {
      success: true,
      data: {
        author: actualAuthorName,
        posts: posts.slice(0, 10),
        articles: articles.slice(0, 10),
        category: category,
        rssUrl: rssUrl,
        substackUrl: cleanUrl,
        totalPosts: posts.length,
        aboutUrl: aboutUrl,
        socialUrls: creatorSocial ? [creatorSocial] : [],
        description: feedDescription,
        profileImageUrl: profileImageUrl || undefined,
        variables: variables,
      },
    }

    console.log("✅ Analysis complete:", result)
    return NextResponse.json(result)
  } catch (error) {
    console.error("❌ Scraping error:", error)

    // Return error with fallback data
    const urlMatch = url?.match(/https?:\/\/([^.]+)\.substack\.com/)
    const fallbackName = urlMatch ? urlMatch[1].charAt(0).toUpperCase() + urlMatch[1].slice(1) : "Creator"

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      data: {
        author: fallbackName,
        posts: generateFallbackPosts(fallbackName, urlMatch?.[1] || "creator"),
        category: "General",
        rssUrl: url ? `${url.replace(/\/$/, "")}/feed` : "",
        substackUrl: url || "",
        totalPosts: 5,
        description: "",
        profileImageUrl: undefined,
        variables: {
          SUBSTACK_URL: url || "",
          RSS_URL: url ? `${url.replace(/\/$/, "")}/feed` : "",
          CREATOR_NAME: fallbackName,
          CREATOR_WEBSITE: url || "",
          CREATOR_SOCIAL: url || "",
          CREATOR_IMAGE: "",
        },
      },
    })
  }
}

function isValidPostTitle(title: string): boolean {
  if (!title || title.length < 10 || title.length > 200) return false

  const invalidPatterns = [
    /^https?:\/\//i, // URLs
    /^www\./i, // Website addresses
    /subscribe|unsubscribe/i, // Subscription related
    /^comments?$/i, // Comments
    /^rss$/i, // RSS
    /^feed$/i, // Feed
    /^\d+$/, // Just numbers
    /^[^a-zA-Z]*$/, // No letters
    /newsletter.*substack/i, // Newsletter substack titles
  ]

  return !invalidPatterns.some((pattern) => pattern.test(title.trim()))
}

function generateFallbackPosts(creatorName: string, handle: string): string[] {
  const templates = [
    `${creatorName}'s Weekly Insights`,
    "The Future of Digital Innovation",
    "Building Authentic Connections Online",
    "Lessons from the Creator Economy",
    "Why Personal Branding Matters in 2024",
    "Monetizing Your Expertise: A Guide",
    "The Psychology of Viral Content",
    "Building Community Through Content",
    "Navigating the Digital Landscape",
    "Creating Value in the Information Age",
  ]

  return templates.slice(0, 5)
}

function categorizeContent(posts: string[], description = ""): string {
  const allText = (posts.join(" ") + " " + description).toLowerCase()

  const categories = {
    "Technology & AI": [
      "ai",
      "artificial intelligence",
      "tech",
      "technology",
      "software",
      "coding",
      "programming",
      "machine learning",
      "automation",
      "digital",
      "innovation",
    ],
    "Business & Entrepreneurship": [
      "business",
      "startup",
      "entrepreneur",
      "marketing",
      "sales",
      "revenue",
      "growth",
      "strategy",
      "leadership",
      "company",
    ],
    "Personal Development": [
      "productivity",
      "habits",
      "mindset",
      "success",
      "motivation",
      "self-improvement",
      "goals",
      "discipline",
      "personal",
      "development",
    ],
    "Content & Media": [
      "content",
      "writing",
      "newsletter",
      "social media",
      "creator",
      "audience",
      "engagement",
      "viral",
      "storytelling",
      "media",
    ],
    "Finance & Investment": [
      "money",
      "investment",
      "finance",
      "crypto",
      "stocks",
      "wealth",
      "financial",
      "economy",
      "trading",
      "investing",
    ],
    "Health & Wellness": [
      "health",
      "fitness",
      "wellness",
      "mental health",
      "exercise",
      "nutrition",
      "lifestyle",
      "wellbeing",
      "medical",
    ],
    "Education & Learning": [
      "education",
      "learning",
      "teaching",
      "knowledge",
      "skills",
      "training",
      "course",
      "study",
      "academic",
      "research",
    ],
  }

  let bestCategory = "General Interest"
  let maxScore = 0

  for (const [category, keywords] of Object.entries(categories)) {
    const score = keywords.reduce((count, keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi")
      const matches = allText.match(regex)
      return count + (matches ? matches.length : 0)
    }, 0)

    if (score > maxScore) {
      maxScore = score
      bestCategory = category
    }
  }

  console.log(`📊 Category analysis: ${bestCategory} (score: ${maxScore})`)
  return bestCategory
}
