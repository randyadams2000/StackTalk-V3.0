import { NextRequest, NextResponse } from "next/server"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"

export const runtime = "nodejs"

export async function DELETE(request: NextRequest) {
  try {
    const { s3Key } = await request.json()

    if (!s3Key) {
      return NextResponse.json(
        { success: false, error: "s3Key is required" },
        { status: 400 }
      )
    }

    const bucket = process.env.S3_BUCKET_NAME
    const region = process.env.AWS_REGION
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { success: false, error: "S3 configuration missing" },
        { status: 500 }
      )
    }

    const s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey }
    })

    console.log("🗑️ Deleting temporary file from S3:", s3Key)

    await s3.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: s3Key
    }))

    console.log("✅ File deleted successfully from S3")

    return NextResponse.json({
      success: true,
      message: "File deleted successfully"
    })

  } catch (error) {
    console.error("❌ Failed to delete file from S3:", error)
    const err = error as any
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete file from S3",
        message: err?.message || "Unknown error"
      },
      { status: 500 }
    )
  }
}