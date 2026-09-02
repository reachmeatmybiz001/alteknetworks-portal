import { Amplify } from 'aws-amplify'
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { config } from './config'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.userPoolId,
      userPoolClientId: config.userPoolClientId,
      loginWith: {
        email: true,
        oauth: {
          domain: config.cognitoDomain,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [config.redirectUri],
          redirectSignOut: [config.signOutUri],
          responseType: 'code',
        },
      },
    },
  },
})

const authEvents = (callback) => Hub.listen('auth', callback)

const login = async () => {
  await signInWithRedirect()
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
    const groups = accessPayload['cognito:groups'] || idPayload['cognito:groups'] || []
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

export { authEvents, currentUser, login, logout }
