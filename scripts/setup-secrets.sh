#!/bin/bash

# Setup script to create secrets in AWS Secrets Manager
# Run this script to migrate your environment variables to secrets

REGION="${APP_REGION:-us-east-1}"

echo "Setting up secrets in AWS Secrets Manager (region: $REGION)"
echo ""

# Create ElevenLabs API Key secret
if [ -n "$APP_ELEVEN_API_KEY" ]; then
  echo "Creating stacktalk/elevenlabs-api-key..."
  aws secretsmanager create-secret \
    --name "stacktalk/elevenlabs-api-key" \
    --description "ElevenLabs API Key for StackTalk" \
    --secret-string "$APP_ELEVEN_API_KEY" \
    --region "$REGION" 2>&1 | grep -v "already exists" || echo "  ✓ Secret already exists"
else
  echo "⚠️  APP_ELEVEN_API_KEY not set, skipping"
fi

# Create OpenAI API Key secret
if [ -n "$APP_OPENAI_API_KEY" ]; then
  echo "Creating stacktalk/openai-api-key..."
  aws secretsmanager create-secret \
    --name "stacktalk/openai-api-key" \
    --description "OpenAI API Key for StackTalk" \
    --secret-string "$APP_OPENAI_API_KEY" \
    --region "$REGION" 2>&1 | grep -v "already exists" || echo "  ✓ Secret already exists"
else
  echo "⚠️  APP_OPENAI_API_KEY not set, skipping"
fi

# Create S3 credentials secret (as JSON)
if [ -n "$APP_S3_BUCKET_NAME" ]; then
  echo "Creating stacktalk/s3-credentials..."
  SECRET_JSON=$(cat <<EOF
{
  "bucket": "$APP_S3_BUCKET_NAME",
  "region": "${APP_REGION:-us-east-1}",
  "accessKey": "${APP_ACCESS_KEY:-}",
  "secretKey": "${APP_SECRET_ACCESS_KEY:-}"
}
EOF
)
  aws secretsmanager create-secret \
    --name "stacktalk/s3-credentials" \
    --description "S3 credentials for StackTalk" \
    --secret-string "$SECRET_JSON" \
    --region "$REGION" 2>&1 | grep -v "already exists" || echo "  ✓ Secret already exists"
else
  echo "⚠️  APP_S3_BUCKET_NAME not set, skipping"
fi

echo ""
echo "✅ Secrets setup complete!"
echo ""
echo "📋 IAM Policy required for Amplify:"
echo ""
cat <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:*:secret:stacktalk/*"
      ]
    }
  ]
}
EOF

echo ""
echo "To update a secret later:"
echo "  aws secretsmanager update-secret --secret-id stacktalk/elevenlabs-api-key --secret-string \"new-value\" --region $REGION"
echo ""
echo "To delete all secrets (careful!):"
echo "  aws secretsmanager delete-secret --secret-id stacktalk/elevenlabs-api-key --force-delete-without-recovery --region $REGION"
echo "  aws secretsmanager delete-secret --secret-id stacktalk/openai-api-key --force-delete-without-recovery --region $REGION"
echo "  aws secretsmanager delete-secret --secret-id stacktalk/s3-credentials --force-delete-without-recovery --region $REGION"
