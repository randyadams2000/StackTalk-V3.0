import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager"

const region = process.env.APP_REGION || process.env.AWS_REGION || "us-east-1"

const client = new SecretsManagerClient({ region })

// Cache secrets in memory to avoid repeated API calls
const secretCache = new Map<string, { value: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getSecret(secretName: string): Promise<string | undefined> {
  // Check cache first
  const cached = secretCache.get(secretName)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value
  }

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    )

    const secretValue = response.SecretString
    if (secretValue) {
      secretCache.set(secretName, { value: secretValue, timestamp: Date.now() })
      return secretValue
    }

    return undefined
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretName}:`, error)
    return undefined
  }
}

export async function getSecretJson<T = any>(secretName: string): Promise<T | undefined> {
  const secretValue = await getSecret(secretName)
  if (!secretValue) return undefined

  try {
    return JSON.parse(secretValue) as T
  } catch {
    return undefined
  }
}

// Specific secret getters for your app
export async function getElevenLabsApiKey(): Promise<string | undefined> {
  // Try secret first, fall back to env var
  const secret = await getSecret("stacktalk/elevenlabs-api-key")
  return secret || process.env.APP_ELEVEN_API_KEY
}

export async function getOpenAiApiKey(): Promise<string | undefined> {
  const secret = await getSecret("stacktalk/openai-api-key")
  return secret || process.env.APP_OPENAI_API_KEY
}

export async function getS3Credentials(): Promise<{
  bucket: string
  region: string
  accessKey?: string
  secretKey?: string
} | undefined> {
  const secret = await getSecretJson<{
    bucket: string
    region: string
    accessKey?: string
    secretKey?: string
  }>("stacktalk/s3-credentials")

  return secret || {
    bucket: process.env.APP_S3_BUCKET_NAME || "",
    region: process.env.APP_REGION || "us-east-1",
    accessKey: process.env.APP_ACCESS_KEY,
    secretKey: process.env.APP_SECRET_ACCESS_KEY,
  }
}
