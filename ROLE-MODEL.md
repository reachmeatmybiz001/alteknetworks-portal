# ALTEKNETWORKS Portal - Final Role Model

The portal uses exactly three Cognito groups:

| Role | Portal access | Ticket access | User administration |
|---|---|---|---|
| Customers | Customer portal | Create, view and manage only their own tickets; close own tickets | None |
| SupportAdmins | Admin / ticket queue | View all tickets; create on behalf of customers; update priority/status/details; close tickets | None |
| SuperAdmins | Full portal administration | All SupportAdmin ticket rights | Create, enable/disable, reset temporary password, change role and delete users |

## Cognito groups

Keep only:
- Customers
- SupportAdmins
- SuperAdmins

`UserAdmins` is not used by this version.

## Temporary password

SuperAdmins create users with a temporary password. Cognito forces the new user to change the password at first login.

Password reset uses `AdminSetUserPassword` with `Permanent: false`.

## IAM

The Lambda execution role must include:

- cognito-idp:ListUsers
- cognito-idp:AdminCreateUser
- cognito-idp:AdminEnableUser
- cognito-idp:AdminDisableUser
- cognito-idp:AdminDeleteUser
- cognito-idp:AdminAddUserToGroup
- cognito-idp:AdminRemoveUserFromGroup
- cognito-idp:AdminListGroupsForUser
- cognito-idp:AdminSetUserPassword

and the existing DynamoDB ticket permissions.

## Ticket audit fields

New tickets record:
- `createdBy`
- `createdByRole`
- `createdAt`
- `updatedAt`
- `updatedBy`
- `closedAt`
- `timeSpentMinutes`

When a ticket changes to `Closed`, the backend calculates the elapsed time from `createdAt` to `closedAt`.
