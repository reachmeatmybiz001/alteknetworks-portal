# ALTEKNETWORKS Portal — User-Level Ticket Isolation

## Purpose
Customer portal users are isolated by their authenticated Cognito email address.
`customerId` identifies the company/customer record and may be shared by multiple users, so it is **not** used as the ticket visibility boundary.

## Customer behavior
- Customer 1 sees only tickets owned by Customer 1's authenticated email.
- Customer 2 sees only tickets owned by Customer 2's authenticated email.
- A customer cannot open, modify, upload an attachment to, or download an attachment from another customer's ticket.
- SupportAdmins and SuperAdmins retain cross-customer ticket visibility.

## Deployment
1. Deploy `ALTEKNET-UnifiedPortal-API-TICKET-ISOLATION-USER-LEVEL-2026-09-09.zip` to the existing `ALTEKNET-UnifiedPortal-API` Lambda.
2. Keep the existing environment variables unchanged.
3. Deploy this portal ZIP through the existing Amplify/Git deployment.
4. Sign out and sign back in after deployment so a fresh Cognito access token is used.

## Important data model
New tickets contain both:
- `customerId`: company/customer record used for asset association.
- `customerEmail` / `customerUserEmail`: authenticated portal user who owns the ticket.

Existing tickets are also evaluated using `customerEmail`, with safe fallbacks to the stored creator identity when necessary.

## Verification test
1. Log in as Customer 1 and create ticket `T1`.
2. Log in as Customer 2 and confirm `T1` is absent.
3. While logged in as Customer 2, manually request `/tickets/T1` through the browser/API. The backend must return 403/404 and never expose ticket data. (The current API does not provide a customer GET-by-ID route; PATCH/attachment routes are protected.)
4. Confirm Customer 2's own ticket appears normally.
5. Log in as SupportAdmin/SuperAdmin and confirm both customers' tickets are visible.
