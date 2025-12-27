# Next Steps: AWS Secrets Manager Setup

## What Just Changed

Your app now uses **AWS Secrets Manager** instead of environment variables for sensitive credentials. This provides better security, audit trails, and centralized secret management.

## Immediate Actions Required

### 1. Create Secrets in AWS (5 minutes)

Make sure your local `.env` file has the current values, then run:

```bash
./scripts/setup-secrets.sh
```

This will create three secrets:
- `stacktalk/elevenlabs-api-key`
- `stacktalk/openai-api-key`
- `stacktalk/s3-credentials` (JSON with bucket, region, optional credentials)

### 2. Update IAM Permissions for Amplify (5 minutes)

Your Amplify service role needs permission to read secrets:

1. Open [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Find your Amplify service role (search for `amplifyconsole-backend-role`)
3. Click "Attach policies" → "Create policy"
4. Use this JSON:

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

5. Name it `StackTalkSecretsAccess` and attach to your Amplify role

### 3. Test Deployment

After attaching the IAM policy, trigger an Amplify deployment:

```bash
git commit --allow-empty -m "Test secrets manager" && git push
```

Watch the build logs. You should see the app successfully fetch secrets.

### 4. Verify in Production

Test these endpoints after deployment:
- `/api/agents/create` - Should show `credentialSource: "secrets"` in debug logs
- Step 3 voice upload - Should work without "missing env var" errors

## Local Development (No Changes Needed)

Your local `.env` file still works! The code automatically falls back:

```
Secrets Manager (priority) → Environment Variables (fallback)
```

So local development continues using `.env` without AWS credentials.

## Optional: Remove Environment Variables from Amplify

Once secrets are working in production, you can optionally remove these from Amplify Console:
- `APP_ELEVEN_API_KEY` → Now in `stacktalk/elevenlabs-api-key`
- `APP_OPENAI_API_KEY` → Now in `stacktalk/openai-api-key`
- `APP_S3_BUCKET_NAME` → Now in `stacktalk/s3-credentials`

Keep these in Amplify Console for now:
- `APP_REGION` - Still needed for Secrets Manager client
- `APP_ACCESS_KEY` / `APP_SECRET_ACCESS_KEY` - Can be removed if using IAM role

## Cost Impact

AWS Secrets Manager pricing:
- **Storage**: $0.40/secret/month × 3 secrets = **$1.20/month**
- **API calls**: $0.05 per 10,000 calls ≈ **$0.15/month** (with 5-min cache)
- **Total**: **~$1.35/month**

## Troubleshooting

### "Failed to retrieve secret"
1. Check IAM policy is attached to Amplify service role
2. Verify secrets exist: `aws secretsmanager list-secrets --region us-east-1 | grep stacktalk`
3. Check region matches (us-east-1)

### "Missing ElevenLabs API key"
1. Verify secret was created: `aws secretsmanager get-secret-value --secret-id stacktalk/elevenlabs-api-key --region us-east-1`
2. Check Amplify service role has `secretsmanager:GetSecretValue` permission
3. Check CloudWatch logs for detailed error messages

### Still using environment variables?
That's okay! The fallback ensures your app works during migration. Once IAM permissions are set, it will automatically switch to secrets.

## Benefits You Get

✅ **Encryption at rest** - Secrets encrypted with AWS KMS  
✅ **Audit trail** - CloudTrail logs all secret access  
✅ **Automatic rotation** - Can enable rotation for compliance  
✅ **Centralized management** - One place to update all environments  
✅ **Fine-grained access** - IAM controls who can read which secrets  
✅ **Version history** - Track all secret changes  

## Documentation

- Full migration guide: [SECRETS_MIGRATION.md](./SECRETS_MIGRATION.md)
- Setup script: [scripts/setup-secrets.sh](./scripts/setup-secrets.sh)
- Secrets client code: [lib/secrets.ts](./lib/secrets.ts)

---

**Questions?** Check [SECRETS_MIGRATION.md](./SECRETS_MIGRATION.md) for detailed troubleshooting and configuration options.
