# ALTEKNETWORKS Ticket Isolation – Deployment Notes

This release enforces customer-level ticket isolation.

## Customer behavior
- A customer can list only tickets whose `customerId` matches the `custom:customerId` on their approved Cognito account.
- A customer cannot read/update another customer's ticket by changing a ticket ID or request payload.
- Attachment upload, attachment recording, and attachment download are also restricted to the ticket owner's customer.
- Customer ticket creation always derives `customerId` from the authenticated Cognito user. The browser cannot select another customer.

## Admin behavior
- Support Admins and Super Admins can continue to view/manage tickets across customers.
- When an admin creates a ticket on behalf of a customer, the backend validates the supplied `customerId`; if it is omitted, the backend resolves the customer from the supplied customer email.
- An admin ticket cannot be created for an email that is not associated with an approved customer account.

## Important data model
Every new customer ticket should contain:

`customerId = the approved customer's customerId`

Example:
- Customer 1 → `CUST-0001` → only sees `CUST-0001` tickets
- Customer 2 → `CUST-0002` → only sees `CUST-0002` tickets

The backend is the authoritative security boundary. The frontend also applies a defensive filter for customer sessions.

## Deploy backend
Upload `ALTEKNET-UnifiedPortal-API-TICKET-ISOLATION-2026-09-09.zip` to the existing `ALTEKNET-UnifiedPortal-API` Lambda, or deploy the `index.mjs` through the existing backend deployment workflow.

Keep the existing Lambda environment variables and IAM permissions.

## Deploy portal
Replace/deploy the portal source in the existing Amplify/Git repository with this package. Keep the existing Amplify environment variables.

No Cognito or API Gateway route changes are required for this ticket-isolation change.

## Verification test
1. Approve Customer 1 and associate them with `CUST-0001`.
2. Approve Customer 2 and associate them with `CUST-0002`.
3. Login as Customer 1 and create TKT-1.
4. Login as Customer 2 and confirm TKT-1 is not shown.
5. While logged in as Customer 2, directly request `/tickets/TKT-1`; it must return HTTP 403 (or not expose the ticket).
6. From Customer 2, try PATCH `/tickets/TKT-1`; it must return HTTP 403.
7. Try attachment upload/download against TKT-1 as Customer 2; it must return HTTP 403.
8. Login as Support Admin/Super Admin and confirm both customers' tickets are visible.
