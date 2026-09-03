import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'

export const ROLES = {
  CUSTOMER: 'Customers',
  SUPPORT_ADMIN: 'SupportAdmins',
  USER_ADMIN: 'UserAdmins',
  SUPER_ADMIN: 'SuperAdmins',
}

export async function currentAuth() {
  const [user, session] = await Promise.all([getCurrentUser(), fetchAuthSession()])
  const claims = session.tokens?.accessToken?.payload || {}
  let groups = claims['cognito:groups'] || []
  if (!Array.isArray(groups)) groups = [groups]
  return { user, session, claims, groups }
}

export function primaryRole(groups = []) {
  if (groups.includes(ROLES.SUPER_ADMIN)) return ROLES.SUPER_ADMIN
  if (groups.includes(ROLES.USER_ADMIN)) return ROLES.USER_ADMIN
  if (groups.includes(ROLES.SUPPORT_ADMIN)) return ROLES.SUPPORT_ADMIN
  return ROLES.CUSTOMER
}

export function isAdminRole(role) {
  return [ROLES.SUPPORT_ADMIN, ROLES.USER_ADMIN, ROLES.SUPER_ADMIN].includes(role)
}
