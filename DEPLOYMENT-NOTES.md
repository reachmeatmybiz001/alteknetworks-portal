# ALTEKNETWORKS Portal – Deployment Notes

This package contains the frontend and the updated Lambda/SAM backend.

## Important: deploy BOTH parts

The username resolution and attachment upload fixes are backend changes. Updating Amplify alone will not fix them.

1. Deploy the `backend/` stack/function so the Lambda contains the latest `AdminGetUser` identity resolution and attachment routes.
2. Make sure the Lambda environment variable `ATTACHMENTS_BUCKET` is populated with the S3 bucket created by the SAM stack.
3. Make sure the S3 bucket CORS configuration matches `backend/S3-CORS.json`.
4. Deploy the frontend through the existing Amplify `main` branch.

## Existing infrastructure

The SAM template uses these defaults:
- Cognito User Pool: `ap-south-1_SlGcnsePN`
- Cognito SPA client: `na3h2smm2qp9gvhfc14h7q4bj`
- Portal origin: `https://portal.alteknetworks.com`

The template creates the attachment S3 bucket and grants the Lambda `s3:PutObject` and `s3:GetObject` for `tickets/*`.

## Attachment upload

The browser performs a secure presigned PUT directly to S3. The API must therefore have the attachment upload-url and attachment record routes deployed, and the S3 bucket must allow CORS from the portal origin.

## Legacy UUID identities

Older tickets may contain a Cognito UUID in `customerEmail` or `createdBy`. The backend now first tries `AdminGetUser` using the stored value and then falls back to a Cognito user-list sub lookup. New tickets store the user's email/username directly.

If a legacy UUID belongs to a Cognito user that has been permanently deleted, Cognito cannot resolve it; such an identity requires a historical mapping.


## Dashboard summary cards / identity / attachment fixes
- Dashboard shows only Open tickets, Resolved / Closed, and Total tickets. Each count opens My Tickets.
- Existing ticket UUIDs are resolved against Cognito `sub` and `Username` and displayed as email/username.
- Attachment upload requires deployment of the backend SAM template so the private S3 bucket, CORS rules, and Lambda S3 permissions are created.
- Deploy both backend and frontend before testing attachments.


### S3 upload test
After backend deployment, the Lambda environment must contain `ATTACHMENTS_BUCKET` and the bucket must have CORS allowing the portal origin with PUT/GET/HEAD. The frontend must be rebuilt/deployed after the backend API is updated.
