import { Amplify } from 'aws-amplify'
import {
  confirmSignIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
} from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { config } from './config'

const ROLES = {
  CUSTOMER: 'Customers',
  SUPPORT_ADMIN: 'SupportAdmins',
  SUPER_ADMIN: 'SuperAdmins',
}

function primaryRole(groups = []) {
  if (groups.includes(ROLES.SUPER_ADMIN)) return ROLES.SUPER_ADMIN
  if (groups.includes(ROLES.SUPPORT_ADMIN)) return ROLES.SUPPORT_ADMIN
  return ROLES.CUSTOMER
}

function isAdminRole(role) {
  return [ROLES.SUPPORT_ADMIN, ROLES.SUPER_ADMIN].includes(role)
}

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.userPoolId,
      userPoolClientId: config.userPoolClientId,
      loginWith: { email: true },
    },
  },
})

const authEvents = (callback) => Hub.listen('auth', callback)

const login = async (email, password) => {
  return signIn({ username: email.trim().toLowerCase(), password })
}

const register = async (email, password) => {
  return signUp({
    username: email.trim().toLowerCase(),
    password,
    options: {
      userAttributes: {
        email: email.trim().toLowerCase(),
      },
    },
  })
}

const confirmRegistration = async (email, code) => {
  return confirmSignUp({
    username: email.trim().toLowerCase(),
    confirmationCode: code.trim(),
  })
}

const resendRegistrationCode = async (email) => {
  return resendSignUpCode({ username: email.trim().toLowerCase() })
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

export {
  authEvents,
  currentUser,
  currentUser as currentAuth,
  login,
  register,
  confirmRegistration,
  resendRegistrationCode,
  logout,
  confirmSignIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
  ROLES,
  primaryRole,
  isAdminRole,
}
