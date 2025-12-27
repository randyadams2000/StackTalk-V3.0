import { NextRequest, NextResponse } from "next/server"
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getS3Credentials } from "@/lib/secrets"

export const runtime = "nodejs"

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const s3Key = body?.s3Key

    if (typeof s3Key !== "string" || !s3Key) {
      return NextResponse.json({ success: false, error: "s3Key is required" }, { status: 400 })
    }

    const s3Creds = await getS3Credentials()
    const bucket = s3Creds?.bucket
    const region = s3Creds?.region || "us-east-1"
    const accessKeyId = s3Creds?.accessKey
    const secretAccessKey = s3Creds?.secretKey

    if (!bucket || !region) {
      return NextResponse.json(
        { success: false, error: "S3 configuration missing" },
        { status: 500 },
      )
    }

    const s3 = new S3Client({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
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