# ALTEKNETWORKS Portal – Ready-to-Deploy Fix

This package fixes the two issues currently visible in the ticket processing panel:

1. Cognito UUIDs are never displayed as Customer / Created by / Updated by / comment author.
2. Attachments up to 7 MB are uploaded through the authenticated Lambda/API path first, avoiding browser-to-S3 CORS failures.
3. Attachments above 7 MB continue to use the presigned S3 path.
4. The attachment is recorded in DynamoDB only after the S3 upload succeeds.
5. Browser/network errors are converted into useful user-facing messages.

## Files to replace

Copy:

- `src/ticketService.js` → replace the existing file completely.
- Apply `src/main.jsx.patch` to the existing `src/main.jsx`.
- Apply `backend/index.mjs.patch` to the existing `backend/index.mjs`.

The backend already contains the authenticated direct-upload endpoint:
`POST /tickets/{ticketId}/attachments/upload`

Make sure API Gateway has this route attached to the same Lambda.

## Backend deployment

From the `backend` directory:

```bash
npm install
sam build
sam deploy
```

Use your existing SAM configuration/stack parameters. Do not create a second stack if the existing production stack already owns the Cognito authorizer, DynamoDB table and attachment bucket.

The Lambda needs:

- `USER_POOL_ID`
- `TICKETS_TABLE`
- `ATTACHMENTS_BUCKET`
- `ALLOWED_ORIGIN=https://portal.alteknetworks.com`

The Lambda execution role must have:

- `dynamodb:GetItem`
- `dynamodb:PutItem`
- `dynamodb:UpdateItem`
- `dynamodb:Scan`
- `dynamodb:Query`
- `s3:PutObject`
- `s3:GetObject`
- Cognito read permissions used by the existing identity-resolution code.

## S3 CORS

The attachment bucket must allow the portal origin for the large-file presigned upload path.

The existing `backend/S3-CORS.json` should allow:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["https://portal.alteknetworks.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## API Gateway routes required

```text
GET    /tickets
POST   /tickets
PATCH  /tickets/{ticketId}

POST   /tickets/{ticketId}/attachments/upload
POST   /tickets/{ticketId}/attachments/upload-url
POST   /tickets/{ticketId}/attachments
GET    /tickets/{ticketId}/attachments/{attachmentId}/download-url
```

All ticket and attachment routes must use the existing Cognito JWT authorizer.

## Frontend deployment

After replacing the files:

```bash
npm install
npm run build
```

Then deploy the generated `dist/` through the existing Amplify app.

Make sure Amplify has:

```text
VITE_API_BASE_URL=<your existing API Gateway URL>
```

The production portal remains:

```text
https://portal.alteknetworks.com
```

## Validation

Test with:

- one XLSX file below 7 MB
- one PDF below 7 MB
- one file above 7 MB
- ticket created by a customer
- ticket updated by SupportAdmin

Expected:

- Customer shows email, not UUID.
- Created by shows email, not UUID.
- Updated by shows email, not UUID.
- Comments show email or `Portal user`, never a UUID.
- <=7 MB attachment uses API/Lambda upload.
- >7 MB attachment uses presigned S3.
- Download remains authenticated through the backend.
