# AWS Secrets Manager Migration

## Overview

The app now uses AWS Secrets Manager instead of environment variables for sensitive credentials. This provides:
- ✅ Centralized secret management
- ✅ Automatic secret rotation support
- ✅ Encryption at rest
- ✅ Fine-grained IAM access control
- ✅ Secret versioning and audit trails

## Setup Instructions

### 1. Create Secrets in AWS

Run the setup script (make sure your `.env` file has the current values):

```bash
./scripts/setup-secrets.sh
```

This creates three secrets in AWS Secrets Manager:
- `stacktalk/elevenlabs-api-key` - ElevenLabs API key
- `stacktalk/openai-api-key` - OpenAI API key  
- `stacktalk/s3-credentials` - S3 bucket, region, and optional credentials (JSON)

### 2. Configure IAM Permissions for Amplify

Your Amplify service role needs permission to read these secrets. Add this IAM policy:

```json
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
```

**To attach this policy:**

1. Go to AWS IAM Console
2. Find your Amplify service role (typically named like `amplifyconsole-backend-role-<app-id>`)
3. Click "Attach policies" → "Create policy"
4. Paste the JSON above
5. Name it `StackTalkSecretsAccess`
6. Attach to your Amplify service role

### 3. Optional: Keep Environment Variable Fallbacks

The app automatically falls back to environment variables if secrets aren't available:

```
Secrets Manager (priority) → Environment Variables (fallback)
```

This allows local development to continue using `.env` files without AWS credentials.

### 4. Update Secrets (After Initial Setup)

To update a secret later:

```bash
# Update ElevenLabs API key
aws secretsmanager update-secret \
  --secret-id stacktalk/elevenlabs-api-key \
  --secret-string "new-api-key-here" \
  --region us-east-1

# Update OpenAI API key
aws secretsmanager update-secret \
  --secret-id stacktalk/openai-api-key \
  --secret-string "new-api-key-here" \
  --region us-east-1

# Update S3 credentials (JSON)
aws secretsmanager update-secret \
  --secret-id stacktalk/s3-credentials \
  --secret-string '{"bucket":"talk2me.temp","region":"us-east-1","accessKey":"...","secretKey":"..."}' \
  --region us-east-1
```

### 5. Local Development

For local development, you don't need AWS Secrets Manager. The app falls back to environment variables:

```env
APP_ELEVEN_API_KEY=your-key
APP_OPENAI_API_KEY=your-key
APP_S3_BUCKET_NAME=talk2me.temp
APP_REGION=us-east-1
APP_ACCESS_KEY=your-key  # optional
APP_SECRET_ACCESS_KEY=your-key  # optional
```

## Secrets Structure

### stacktalk/elevenlabs-api-key
Plain text string containing the ElevenLabs API key.

### stacktalk/openai-api-key
Plain text string containing the OpenAI API key.

### stacktalk/s3-credentials
JSON object with S3 configuration:
```json
{
  "bucket": "talk2me.temp",
  "region": "us-east-1",
  "accessKey": "OPTIONAL_AWS_ACCESS_KEY",
  "secretKey": "OPTIONAL_AWS_SECRET_KEY"
}
```

If `accessKey` and `secretKey` are omitted, the app uses the default AWS credential chain (IAM role).

## Caching

Secrets are cached in memory for 5 minutes to reduce API calls to Secrets Manager. This balances between:
- Performance (fewer network requests)
- Freshness (secrets update within 5 minutes)

## Cost Considerations

**AWS Secrets Manager Pricing (us-east-1):**
- $0.40 per secret per month
- $0.05 per 10,000 API calls

**For this app (3 secrets):**
- Storage: $1.20/month
- API calls: ~$0.15/month (assuming 30k calls with 5-min cache)
- **Total: ~$1.35/month**

## Security Benefits

| Aspect | Environment Variables | Secrets Manager |
|--------|----------------------|-----------------|
| Encryption at rest | ❌ | ✅ |
| Automatic rotation | ❌ | ✅ |
| Access audit trail | ❌ | ✅ |
| Fine-grained IAM | ❌ | ✅ |
| Version history | ❌ | ✅ |
| Centralized management | ❌ | ✅ |

## Troubleshooting

### "Failed to retrieve secret"
- Check IAM permissions on your Amplify service role
- Verify the secret exists: `aws secretsmanager get-secret-value --secret-id stacktalk/elevenlabs-api-key --region us-east-1`
- Check region matches (default: us-east-1)

### "AWS credentials are not available"
- For Amplify: Ensure service role has Secrets Manager permissions
- For local: Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` or use AWS CLI profile

### App still uses environment variables
- Secrets Manager requires AWS credentials to work
- On Amplify, ensure the service role is properly configured
- Locally, make sure you have AWS credentials configured

## Migration Checklist

- [ ] Run `./scripts/setup-secrets.sh` to create secrets
- [ ] Attach IAM policy to Amplify service role
- [ ] Deploy to Amplify and test
- [ ] Verify logs show "credentialSource: secrets" not "env"
- [ ] (Optional) Remove `APP_*` environment variables from Amplify Console once secrets work
- [ ] Update runbook/docs with secret rotation procedures
