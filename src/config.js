const env = import.meta.env

export const config = {
  awsRegion: env.VITE_AWS_REGION || 'ap-south-1',
  userPoolId: env.VITE_COGNITO_USER_POOL_ID || 'ap-south-1_SlGcnsePN',
  userPoolClientId: env.VITE_COGNITO_CLIENT_ID || 'na3h2smm2qp9gvhfc14h7q4bj',
  cognitoDomain: env.VITE_COGNITO_DOMAIN || 'ap-south-1slgcnsepn.auth.ap-south-1.amazoncognito.com',
  redirectUri: env.VITE_COGNITO_REDIRECT_URI || window.location.origin,
  signOutUri: env.VITE_COGNITO_SIGNOUT_URI || window.location.origin,
  apiBaseUrl: (env.VITE_API_BASE_URL || '').replace(/\/$/, ''),
}
