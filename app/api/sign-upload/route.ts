import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "crypto"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const filename = body?.filename
    const contentType = body?.contentType

    const bucket = process.env.S3_BUCKET_NAME
    // Amplify environment variables cannot start with the reserved prefix "AWS".
    // Use APP_* variables only.
    const region = process.env.APP_REGION || "us-east-1"

    // Prefer server-side AWS credentials. If not provided, allow the default provider chain
    // (IAM role, web identity, etc.) for hosted environments.
    const accessKeyId = process.env.APP_ACCESS_KEY
    const secretAccessKey = process.env.APP_SECRET_ACCESS_KEY
    const sessionToken = process.env.APP_SESSION_TOKEN
    const hasExplicitCreds = Boolean(accessKeyId && secretAccessKey)

    console.log("🔍 S3 presign config:", {
      bucketSet: Boolean(bucket),
      region,
      credentialSource: hasExplicitCreds ? "env" : "default-provider",
      filename: typeof filename === "string" ? filename : undefined,
      contentType: typeof contentType === "string" ? contentType : undefined,
    })

    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
    }

    if (!bucket) {
      console.error("❌ Missing S3 bucket configuration")
      return NextResponse.json(
        { success: false, error: "S3 is not configured. Missing S3_BUCKET_NAME." },
        { status: 500 },
      )
    }

    if (!region) {
      console.error("❌ Missing AWS region configuration")
      return NextResponse.json(
        { success: false, error: "S3 is not configured. Missing APP_REGION." },
        { status: 500 },
      )
    }

    const s3 = new S3Client({
      region,
      // When explicit credentials are not provided we fall back to the default credential
      // provider chain (IAM role, web identity, etc.) so Amplify hosted environments work
      // without storing long-lived keys.
      credentials: hasExplicitCreds
        ? { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, sessionToken }
        : undefined,
    })

    const safeName = (typeof filename === "string" && filename ? filename : "upload.dat").replace(
      /[^a-zA-Z0-9_.-]/g,
      "_",
    )
    const key = `${randomUUID()}-${safeName}` // bucket root

    console.log("📁 Creating S3 command:", { bucket, key, safeName })

    // Build command with the content type we expect the client to use on PUT
    const expectedContentType = typeof contentType === "string" && contentType ? contentType : "application/octet-stream"
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: expectedContentType,
      Metadata: {
        "uploaded-by": "stacktalk-app",
        "upload-timestamp": new Date().toISOString(),
      },
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

    const hints: string[] = []
    if (!process.env.S3_BUCKET_NAME) {
      hints.push("Missing S3_BUCKET_NAME")
    }
    if (!process.env.APP_REGION) {
      hints.push("Missing APP_REGION")
    }
    if (!(process.env.APP_ACCESS_KEY && process.env.APP_SECRET_ACCESS_KEY)) {
      hints.push("Missing APP_ACCESS_KEY/APP_SECRET_ACCESS_KEY")
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create presigned URL",
        message: err?.message || "Unknown error",
        name: err?.name,
        code: err?.code || err?.$metadata?.httpStatusCode,
        hint: hints.length ? hints.join("; ") : undefined,
      },
      { status: 500 },
    )
  }
}
