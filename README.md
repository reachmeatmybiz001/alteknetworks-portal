# ALTEKNETWORKS Unified Portal

Single portal for all four ALTEKNETWORKS user types:

- **Customers** — raise tickets and view only their own tickets.
- **Support Admins** — raise/view/update all tickets and assign tickets; no customer user administration.
- **User Admins** — raise/view/update tickets (assignment not allowed) and manage customer users; cannot manage administrator roles.
- **Super Admins** — full portal administration, including administrator role management.

## Portal URL

Production URL: **https://portal.alteknetworks.com**

The frontend is designed for AWS Amplify Hosting. The backend is AWS SAM and creates API Gateway HTTP API, Lambda and DynamoDB.

## Existing Cognito configuration

- Region: `ap-south-1`
- User Pool: `ap-south-1_SlGcnsePN`
- SPA Client: `na3h2smm2qp9gvhfc14h7q4bj`
- Cognito groups: `Customers`, `SupportAdmins`, `UserAdmins`, `SuperAdmins`

## Important security design

The UI hides functions that the current role cannot use, **but UI hiding is not the security boundary**. Every sensitive operation is checked again in `backend/index.mjs` using the Cognito JWT `cognito:groups` claim.

Examples:

- Customer ticket queries are filtered by the authenticated user's email.
- User Admin cannot create Support Admin, User Admin or Super Admin accounts.
- User Admin cannot change administrator roles.
- User Admin can enable/disable/reset/delete customers only.
- Only Super Admin can manage administrator roles.
- Only Support Admin and Super Admin can assign tickets.
- Customer identity is taken from the JWT, not from the ticket creation form.

## Deploy backend first

From the `backend` directory, deploy with AWS SAM:

```bash
sam build
sam deploy --guided
```

Use these parameter values when prompted:

- `UserPoolId`: `ap-south-1_SlGcnsePN`
- `UserPoolClientId`: `na3h2smm2qp9gvhfc14h7q4bj`
- `AllowedOrigin`: `https://portal.alteknetworks.com`

After deployment, copy the CloudFormation output **ApiUrl**.

## Deploy frontend

Connect this repository to AWS Amplify Hosting with:

- Branch: `main`
- Build command: `npm run build`
- Output directory: `dist`

Set Amplify environment variables:

```text
VITE_AWS_REGION=ap-south-1
VITE_COGNITO_USER_POOL_ID=ap-south-1_SlGcnsePN
VITE_COGNITO_CLIENT_ID=na3h2smm2qp9gvhfc14h7q4bj
VITE_API_BASE_URL=<ApiUrl output from SAM>
```

Then configure the Amplify custom domain:

`portal.alteknetworks.com`

Do not move the main ALTEKNETWORKS website from GitHub Pages.

## Permission matrix implemented

| Function | Customer | Support Admin | User Admin | Super Admin |
|---|---|---|---|---|
| Raise ticket | Yes | Yes | Yes | Yes |
| View own tickets | Yes | Yes | Yes | Yes |
| View all tickets | No | Yes | Yes | Yes |
| Update tickets | No | Yes | Yes | Yes |
| Assign tickets | No | Yes | No | Yes |
| Create customer | No | No | Yes | Yes |
| Disable customer | No | No | Yes | Yes |
| Reset customer password | No | No | Yes | Yes |
| Delete customer | No | No | Yes | Yes |
| Create Support Admin | No | No | No | Yes |
| Create User Admin | No | No | No | Yes |
| Manage admin roles | No | No | No | Yes |

## Notes

- The backend uses a DynamoDB GSI named `customerEmail-index` for customer ticket isolation.
- Password reset uses Cognito `AdminResetUserPassword`, which sends the Cognito reset flow according to the user pool configuration.
- For production, keep `AllowedOrigin` restricted to the portal domain.
