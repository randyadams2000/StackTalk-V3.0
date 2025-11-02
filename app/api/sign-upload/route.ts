import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "crypto"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType } = await request.json()

    const bucket = process.env.S3_BUCKET_NAME
    const region = process.env.PUBLIC_AWS_REGION || process.env.AWS_REGION || process.env.S3_REGION
    const accessKeyId = process.env.PUBLIC_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.PUBLIC_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY

    const hasCreds = Boolean(accessKeyId && secretAccessKey)

    if (!bucket) {
      return NextResponse.json(
        { success: false, error: "Missing S3_BUCKET_NAME environment variable" },
        { status: 500 },
      )
    }

    if (!region) {
      return NextResponse.json(
        { success: false, error: "Missing AWS region environment variable (PUBLIC_AWS_REGION or AWS_REGION)" },
        { status: 500 },
      )
    }

    const s3 = new S3Client({
      region,
      credentials: hasCreds ? { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! } : undefined,
    })

    const safeName = (filename || "upload.dat").replace(/[^a-zA-Z0-9_.-]/g, "_")
    const key = `${randomUUID()}-${safeName}` // bucket root

    // Build command with the content type we expect the client to use on PUT
    const expectedContentType = contentType || "application/octet-stream"
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: expectedContentType,
    })

    const started = Date.now()
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 })
    const elapsedMs = Date.now() - started

    // Return extra diagnostics to help debug 403s on client PUT
    return NextResponse.json({
      success: true,
      uploadUrl,
      key,
      debug: {
        bucket,
        region,
        hasCreds,
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
