import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "crypto"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType } = await request.json()

  const bucket = process.env.S3_BUCKET_NAME
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1"
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  const hasExplicitCreds = Boolean(accessKeyId && secretAccessKey)

    // Debug logging
    console.log("🔍 S3 Config Debug:", {
      bucket: bucket ? "SET" : "MISSING",
      region: region ? "SET" : "MISSING", 
      accessKeyId: accessKeyId ? "SET" : "MISSING",
      secretAccessKey: secretAccessKey ? "SET" : "MISSING",
  hasExplicitCreds,
  usingDefaultProvider: hasExplicitCreds ? false : true,
      filename,
      contentType,
      // Show actual values to debug (remove in production)
      actualValues: {
        bucket,
        region,
        accessKeyId: accessKeyId ? `${accessKeyId.substring(0, 4)}...` : "MISSING",
        secretAccessKey: secretAccessKey ? `${secretAccessKey.substring(0, 4)}...` : "MISSING"
      },
      // Show all environment variables to see what's actually loaded
      allEnvVars: {
        S3_BUCKET_NAME: process.env.S3_BUCKET_NAME ? "SET" : "MISSING",
        AWS_REGION: process.env.AWS_REGION ? "SET" : "MISSING",
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? "SET" : "MISSING",
        AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION ? "SET" : "MISSING",
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? "SET" : "MISSING"
      }
    })

    if (!bucket) {
      console.error("❌ Missing S3_BUCKET_NAME")
      return NextResponse.json(
        { success: false, error: "Missing S3_BUCKET_NAME environment variable" },
        { status: 500 },
      )
    }

    if (!region) {
      console.error("❌ Missing AWS region configuration")
      return NextResponse.json(
        { success: false, error: "Missing AWS region configuration (AWS_REGION or AWS_DEFAULT_REGION)" },
        { status: 500 },
      )
    }

    const s3 = new S3Client({
      region,
      // When explicit credentials are not provided we fall back to the default credential
      // provider chain (IAM role, web identity, etc.) so Amplify hosted environments work
      // without storing long-lived keys.
      credentials: hasExplicitCreds ? { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! } : undefined,
    })

    const safeName = (filename || "upload.dat").replace(/[^a-zA-Z0-9_.-]/g, "_")
    const key = `${randomUUID()}-${safeName}` // bucket root

    console.log("📁 Creating S3 command:", { bucket, key, safeName })

    // Build command with the content type we expect the client to use on PUT
    const expectedContentType = contentType || "application/octet-stream"
    // Enhanced security: Set CORS headers to restrict which domains can use presigned URLs
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: expectedContentType,
      // Add security headers
      Metadata: {
        'uploaded-by': 'stacktalk-app',
        'upload-timestamp': new Date().toISOString()
      }
    })

    console.log("🔗 Generating presigned URL...")
    const started = Date.now()
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 })
    const elapsedMs = Date.now() - started
    console.log("✅ Presigned URL generated successfully:", { elapsedMs })

    // Return extra diagnostics to help debug 403s on client PUT
    return NextResponse.json({
      success: true,
      uploadUrl,
      key,
      debug: {
        bucket,
        region,
        credentialSource: hasExplicitCreds ? "env" : "default-provider",
        expectedContentType,
        presignTookMs: elapsedMs,
      },
    })
  } catch (error) {
    console.error("❌ sign-upload error:", error)
    const err = error as any
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create presigned URL",
        message: err?.message || "Unknown error",
        name: err?.name,
        code: err?.code || err?.$metadata?.httpStatusCode,
        // Stack helps in logs; not sensitive
        stack: err?.stack,
      },
      { status: 500 },
    )
  }
}
