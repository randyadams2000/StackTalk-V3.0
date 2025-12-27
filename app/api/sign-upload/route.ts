import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getS3Credentials } from "@/lib/secrets"
import { randomUUID } from "crypto"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const filename = body?.filename
    const contentType = body?.contentType

    const s3Creds = await getS3Credentials()
    const bucket = s3Creds?.bucket
    const region = s3Creds?.region || "us-east-1"
    const accessKeyId = s3Creds?.accessKey
    const secretAccessKey = s3Creds?.secretKey

    console.log("🔍 S3 presign config:", {
      bucketSet: Boolean(bucket),
      region,
      credentialSource: accessKeyId && secretAccessKey ? "secrets" : "default-provider",
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

    const s3 = new S3Client({
      region,
      // When explicit credentials are not provided we fall back to the default credential
      // provider chain (IAM role, web identity, etc.) so Amplify hosted environments work
      // without storing long-lived keys.
      credentials: accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined,
    })

    // Presigning requires credentials. Surface a clearer error when the runtime has no IAM role/creds.
    try {
      const resolved = await (s3.config.credentials as any)?.()
      if (!resolved?.accessKeyId) {
        throw new Error("AWS credentials resolved but missing accessKeyId")
      }
    } catch (credErr) {
      const e: any = credErr
      return NextResponse.json(
        {
          success: false,
          error: "AWS credentials are not available to the server runtime",
          message: e?.message || "Could not resolve AWS credentials from the default provider chain",
          hint:
            "On Amplify, ensure the server runtime role has permission to run and is allowed to access S3 (at minimum: s3:PutObject to sign presigned PUTs; and s3:GetObject for /api/voice-clone).",
          debug: {
            bucket,
            region,
            credentialSource: accessKeyId && secretAccessKey ? "secrets" : "default-provider",
          },
        },
        { status: 500 },
      )
    }

    const safeName = (typeof filename === "string" && filename ? filename : "upload.dat").replace(
      /[^a-zA-Z0-9_.-]/g,
      "_",
    )
    const key = `${randomUUID()}-${safeName}` // bucket root

    console.log("📁 Creating S3 command:", { bucket, key, safeName })

    // We do NOT include ContentType in the signed request. This avoids common failures where
    // the browser sends a slightly different Content-Type than what was signed (SignatureDoesNotMatch).
    const expectedContentType =
      typeof contentType === "string" && contentType ? contentType : "application/octet-stream"
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
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
        credentialSource: accessKeyId && secretAccessKey ? "secrets" : "default-provider",
        expectedContentType,
        presignTookMs: elapsedMs,
      },
    })
  } catch (error) {
    console.error("❌ sign-upload error:", error)
    const err = error as any

    const hints: string[] = [
      "Ensure secrets are configured in AWS Secrets Manager (stacktalk/s3-credentials)",
      "Verify IAM role has secretsmanager:GetSecretValue permission",
      "If using environment variables, ensure APP_S3_BUCKET_NAME and APP_REGION are set",
      "For IAM role-based auth (recommended on Amplify), leave credentials unset in secrets"
    ]

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
