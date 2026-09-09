# ALTEKNETWORKS Portal - Phase 1 Customer / Asset Deployment

This release adds customer-to-user association, customer asset/serial inventory, serial validation for customer tickets, and customer-aware ticket/attachment authorization while preserving the existing attachment flow.

## Existing AWS resources expected

- Cognito User Pool: `ap-south-1_SlGcnsePN`
- Cognito App Client: `na3h2smm2qp9gvhfc14h7q4bj`
- Lambda: `ALTEKNET-UnifiedPortal-API`
- DynamoDB: `ALTEKNET-Tickets`
- DynamoDB: `ALTEKNET-Customers`
- DynamoDB: `ALTEKNET-Customer-Assets`
- Asset GSI: `customerId-index`
- S3 attachment bucket configured through Lambda variable `ATTACHMENTS_BUCKET`

## Cognito

The SPA app client must have:

- `custom:customerId` Read: enabled
- `custom:customerId` Write: disabled

Customers must not be allowed to change their tenant/customer association from the browser.

## Lambda environment variables

Keep the existing variables and add/verify:

```text
CUSTOMERS_TABLE=ALTEKNET-Customers
ASSETS_TABLE=ALTEKNET-Customer-Assets
```

## Lambda IAM

The Lambda execution role needs DynamoDB access to both new tables and the `customerId-index`, plus the existing Cognito/S3 permissions.

Required DynamoDB actions:

```text
GetItem
PutItem
UpdateItem
DeleteItem
Query
Scan
```

Required Cognito actions include the existing actions plus:

```text
cognito-idp:AdminUpdateUserAttributes
cognito-idp:AdminDeleteUserAttributes
```

## Backend deployment

The included GitHub Actions workflow deploys `backend/` to the existing Lambda. It runs `npm install --omit=dev`, packages the Lambda, and calls `aws lambda update-function-code`.

Configure GitHub repository variable:

```text
AWS_ROLE_ARN=<GitHub Actions OIDC deployment role ARN>
```

The AWS role must be trusted for this repository's `main` branch and must be allowed to update:

```text
arn:aws:lambda:ap-south-1:<ACCOUNT_ID>:function:ALTEKNET-UnifiedPortal-API
```

## Initial data

Create a customer such as:

```json
{
  "customerId": "CUST-0001",
  "customerName": "ABC Technologies",
  "status": "Active"
}
```

Create an asset such as:

```json
{
  "serialNumber": "PF4ABC123456",
  "customerId": "CUST-0001",
  "customerName": "ABC Technologies",
  "product": "Laptop",
  "manufacturer": "Lenovo",
  "model": "ThinkPad T14",
  "status": "Active"
}
```

Then create/update a Cognito customer user and associate it with `CUST-0001` through the Super Admin User Administration screen.

## Frontend

Amplify continues to build the Vite application with:

```text
npm install
npm run build
```

The existing environment variables remain unchanged, including `VITE_API_BASE_URL`.

## New API endpoints

```text
GET    /customers
POST   /customers
GET    /customers/{customerId}/assets
POST   /customers/{customerId}/assets
POST   /customers/{customerId}/assets/import
PATCH  /customers/{customerId}/assets/{serialNumber}
DELETE /customers/{customerId}/assets/{serialNumber}
POST   /tickets/validate-serial
```

Existing ticket and attachment endpoints remain in place.

## Customer ticket behavior

A customer must supply an active serial number assigned to their customer record. The backend independently resolves the authenticated Cognito user's `custom:customerId` and validates the serial number. The browser cannot choose another customer's ID.

## CSV import

The admin screen accepts CSV/XLS/XLSX files with these columns:

```text
serialNumber,product,manufacturer,model,status
```

Maximum import size is 1000 rows per request.

## Customer Self-Registration + Super Admin Approval

This release adds a customer self-registration flow:

1. Customer clicks **Create Customer Account** on the portal.
2. Customer registers with an email address and password.
3. Cognito sends an email verification OTP.
4. Customer enters the OTP in the portal.
5. The account remains **Pending Approval** because it has no portal group yet.
6. Super Admin opens **Admin → User Administration**, selects an active customer, and clicks **Approve Customer**.
7. Backend assigns the Cognito `Customers` group and the authoritative `custom:customerId` attribute.
8. Customer can then sign in and use tickets/assets belonging to the assigned customer.

### Cognito User Pool settings

Enable self-service sign-up in the `ALTEKNET-CUSTOMER-PORTAL` user pool. Configure email as the sign-in identifier and require email verification/confirmation. The SPA uses the Cognito confirmation-code flow for the email OTP.

Keep `custom:customerId` **Read enabled / Write disabled** for the SPA client. The browser must never be allowed to set or change a customer's `custom:customerId`.

### API Gateway

Add the following JWT-protected route using the existing Lambda integration and Cognito authorizer:

- `GET /me`

The frontend uses `/me` after login to determine whether the account is `PendingApproval` or `Approved`.

### Approval behavior

`PATCH /admin/users/{username}` accepts:

```json
{"action":"approve","customerId":"CUST-0001"}
```

or, if needed, Super Admin can reject a pending registration with:

```json
{"action":"reject"}
```

Reject disables the Cognito account. Approval requires an active customer record and sets the customer's `custom:customerId` server-side.
