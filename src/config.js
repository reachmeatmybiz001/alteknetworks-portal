const env = import.meta.env

export const config = {
  awsRegion: env.VITE_AWS_REGION || 'ap-south-1',
  userPoolId: env.VITE_COGNITO_USER_POOL_ID || 'ap-south-1_SlGcnsePN',
  userPoolClientId: env.VITE_COGNITO_CLIENT_ID || 'na3h2smm2qp9gvhfc14h7q4bj',
  apiBaseUrl: (env.VITE_API_BASE_URL || '').replace(/\/$/, ''),
  portalUrl: 'https://portal.alteknetworks.com',
}
