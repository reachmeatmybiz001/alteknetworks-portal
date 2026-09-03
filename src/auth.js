import { Amplify } from 'aws-amplify'
import { confirmSignIn, fetchAuthSession, getCurrentUser, signIn, signOut } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { config } from './config'
const ROLES = {
  CUSTOMER: 'Customers',
  SUPPORT_ADMIN: 'SupportAdmins',
  USER_ADMIN: 'UserAdmins',
  SUPER_ADMIN: 'SuperAdmins',
}

function primaryRole(groups = []) {
  if (groups.includes(ROLES.SUPER_ADMIN)) return ROLES.SUPER_ADMIN
  if (groups.includes(ROLES.USER_ADMIN)) return ROLES.USER_ADMIN
  if (groups.includes(ROLES.SUPPORT_ADMIN)) return ROLES.SUPPORT_ADMIN
  return ROLES.CUSTOMER
}

function isAdminRole(role) {
  return [
    ROLES.SUPPORT_ADMIN,
    ROLES.USER_ADMIN,
    ROLES.SUPER_ADMIN,
  ].includes(role)
}
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

export { authEvents, currentUser, currentUser as currentAuth, login, logout, confirmSignIn, ROLES, primaryRole, isAdminRole }
