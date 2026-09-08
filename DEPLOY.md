# ALTEKNETWORKS Portal – Attachment & Identity Fix Pack

This fix pack is for the existing repository:

`reachmeatmybiz001/alteknetworks-portal`

## Fixes included

1. Prevent Cognito UUID/sub values from being displayed as Customer, Created by, Updated by, or comment author.
2. Keep the existing direct API/Lambda upload path for files <= 7 MB.
3. Keep the presigned S3 upload path for files > 7 MB.
4. Improve attachment upload error messages.
5. Preserve authenticated attachment downloads.

## Confirmed API Gateway

API: `ALTEKNET-UnifiedPortal-API`
API ID: `ms9anew1xc`
Region: `ap-south-1`
Stage: `$default`
Invoke URL:

`https://ms9anew1xc.execute-api.ap-south-1.amazonaws.com`

The following routes must be attached to the existing Lambda integration `vhw1hmm`:

- POST `/tickets/{id}/attachments`
- POST `/tickets/{id}/attachments/upload-url`
- POST `/tickets/{id}/attachments/upload`
- GET `/tickets/{id}/attachments/{attachmentId}/download-url`

Your current API Gateway screenshot confirms these routes are already present and attached to `vhw1hmm`.

## Apply the code fixes

From the repository root:

```bash
git apply fixes/src-main.patch
git apply fixes/backend-index.patch
```

Then verify:

```bash
git diff --check
```

## Frontend

Set the Amplify environment variable:

```text
VITE_API_BASE_URL=https://ms9anew1xc.execute-api.ap-south-1.amazonaws.com
```

Then deploy the normal Amplify build from `main`.

## Backend

Deploy the updated `backend/index.mjs` to the SAME Lambda function currently used by integration `vhw1hmm`.

Required environment variables:

```text
USER_POOL_ID=<your Cognito user pool ID>
TICKETS_TABLE=<your existing DynamoDB tickets table>
ATTACHMENTS_BUCKET=<your existing S3 attachment bucket>
ALLOWED_ORIGIN=https://portal.alteknetworks.com
```

Required Lambda permissions include:

- Cognito `ListUsers` / `AdminGetUser`
- DynamoDB Get/Put/Update/Delete/Scan/Query
- S3 PutObject/GetObject for `tickets/*`

Do not create a second API or second ticket Lambda.

## Expected result

For an old ticket containing a Cognito UUID:

```text
Customer: Portal user
Created by: Portal user
```

If the UUID can be resolved from Cognito, the actual email is shown instead.

For a new ticket:

```text
Customer: customer@example.com
Created by: customer@example.com
```

For an XLSX/PDF/DOCX <= 7 MB:

```text
Browser -> API Gateway -> Lambda -> S3 -> DynamoDB
```

For files > 7 MB:

```text
Browser -> API Gateway -> Lambda -> presigned S3 URL -> S3
                                  -> record attachment -> DynamoDB
```
