# ALTEKNETWORKS Customer Portal

React + Vite customer portal for `portal.alteknetworks.com`.

## Included

- Amazon Cognito Managed Login / OAuth Authorization Code flow
- Customer login and logout
- Customer dashboard
- Ticket creation, listing, filtering and status tracking
- Admin dashboard UI based on Cognito group membership (`Admins`)
- Responsive ALTEKNETWORKS branding
- AWS Amplify Hosting build specification
- API service abstraction ready for API Gateway + Lambda + DynamoDB
- Local/demo ticket storage when no API URL is configured

## Cognito

The project is preconfigured for the ALTEKNETWORKS Cognito SPA client used for the portal. No Cognito client secret is used in the browser.

If you use a different client, set the variables in `.env` or Amplify Hosting environment variables using `.env.example` as the template.

The Cognito app client should use:

- Authorization code grant
- Scopes: `openid`, `email`, `profile`
- Callback URL: `https://portal.alteknetworks.com`
- Sign-out URL: `https://portal.alteknetworks.com`

For local development, add `http://localhost:5173` to the Cognito callback and sign-out URL lists, then set `VITE_COGNITO_REDIRECT_URI=http://localhost:5173` and `VITE_COGNITO_SIGNOUT_URI=http://localhost:5173`.

## Admin access

Create a Cognito user-pool group named `Admins` and add administrator users to it. Users without the `Admins` group are treated as customers.

The frontend never stores passwords.

## Ticket API

The UI is ready for a REST API. Set `VITE_API_BASE_URL` to the API Gateway base URL.

Expected endpoints:

- `GET /tickets`
- `POST /tickets`
- `PATCH /tickets/:id`

The frontend sends the Cognito access token as `Authorization: Bearer <token>`.

If `VITE_API_BASE_URL` is empty, the app uses browser local storage so the portal can be demonstrated before the AWS API is created.

## Deploy with Amplify

Connect this repository and branch to AWS Amplify Hosting. Amplify will detect the Vite/React application and the included `amplify.yml` explicitly builds `dist`.
