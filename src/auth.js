import { Amplify } from 'aws-amplify'
import { confirmSignIn, fetchAuthSession, getCurrentUser, signIn, signOut } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { config } from './config'

// Direct Cognito authentication: the portal uses its own login form.
// No Cognito Managed Login / hosted redirect is used.
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.userPoolId,
      userPoolClientId: config.userPoolClientId,
      loginWith: {
        email: true,
      },
    },
  },
})

const authEvents = (callback) => Hub.listen('auth', callback)

const login = async (email, password) => {
  const result = await signIn({
    username: email.trim(),
    password,
  })

  return result
}

const logout = async () => {
  await signOut({ global: false })
}

const currentUser = async () => {
  try {
    const user = await getCurrentUser()
    const session = await fetchAuthSession()
    const accessPayload = session.tokens?.accessToken?.payload || {}
    const idPayload = session.tokens?.idToken?.payload || {}
    const groups = idPayload['cognito:groups'] || accessPayload['cognito:groups'] || []
    return {
      username: user.username,
      userId: user.userId,
      email: idPayload.email || accessPayload.email || '',
      groups: Array.isArray(groups) ? groups : [groups],
      accessToken: session.tokens?.accessToken?.toString() || '',
    }
  } catch {
    return null
  }
}

export { authEvents, currentUser, login, logout, confirmSignIn }
