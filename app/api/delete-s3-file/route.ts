import { NextRequest, NextResponse } from "next/server"
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"

export const runtime = "nodejs"

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const s3Key = body?.s3Key

    if (typeof s3Key !== "string" || !s3Key) {
      return NextResponse.json({ success: false, error: "s3Key is required" }, { status: 400 })
    }

    const bucket = process.env.S3_BUCKET_NAME
    const region =
      process.env.APP_REGION ||
      process.env.APP_AWS_REGION ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION
    const accessKeyId = process.env.APP_ACCESS_KEY
    const secretAccessKey = process.env.APP_SECRET_ACCESS_KEY
    const sessionToken = process.env.APP_SESSION_TOKEN

    if (!bucket || !region) {
      return NextResponse.json(
        { success: false, error: "S3 configuration missing (S3_BUCKET_NAME / APP_REGION)" },
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

    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key }))

    return NextResponse.json({ success: true, message: "File deleted successfully" })
  } catch (error) {
    console.error("❌ Failed to delete file from S3:", error)
    const err = error as any

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete file from S3",
        message: err?.message || "Unknown error",
      },
      { status: 500 },
    )
  }
}