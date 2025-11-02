import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format Substack URL to canonical subdomain form
// Examples:
//  - https://substack.com/@pmarca  -> https://pmarca.substack.com/
//  - substack.com/@pmarca         -> https://pmarca.substack.com/
//  - https://pmarca.substack.com  -> https://pmarca.substack.com/
export function formatSubstackUrl(url: string): string {
  if (!url) return ""
  let input = url.trim()

  // Ensure protocol for URL parsing, we'll normalize to https later
  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`
  }

  try {
    const u = new URL(input)
    const host = u.hostname.toLowerCase()
    const path = u.pathname || ""

    // Handle @username format on substack.com
    // e.g., https://substack.com/@pmarca or https://substack.com/@pmarca/
    const atMatch = host === "substack.com" && path.match(/^\/@([^\/]+)\/?/)
    if (atMatch && atMatch[1]) {
      const username = atMatch[1]
      return `https://${username}.substack.com/`
    }

    // Already in subdomain format
    if (/^[a-z0-9-]+\.substack\.com$/i.test(host)) {
      return `https://${host}/`
    }

    // Fallback: if on substack.com with a simple path (e.g., substack.com/pmarca), convert
    const simpleMatch = host === "substack.com" && path.match(/^\/([a-z0-9-]+)\/?$/i)
    if (simpleMatch && simpleMatch[1]) {
      const username = simpleMatch[1]
      return `https://${username}.substack.com/`
    }

    // Default: normalize to https and ensure trailing slash
    return `https://${host}/`
  } catch {
    // If URL constructor fails, try a minimal regex-based approach
    const atMatch = input.match(/substack\.com\/@([^\/]+)/i)
    if (atMatch && atMatch[1]) {
      return `https://${atMatch[1]}.substack.com/`
    }
    return input
  }
}
