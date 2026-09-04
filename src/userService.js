import {
  createUser,
  deleteUser,
  listUsers,
  updateUser as apiUpdateUser,
} from './api'

export {
  listUsers,
  createUser,
  deleteUser,
}

export async function updateUser(username, changes = {}) {
  if (changes.enabled === true) {
    return apiUpdateUser(username, {
      action: 'enable',
    })
  }

  if (changes.enabled === false) {
    return apiUpdateUser(username, {
      action: 'disable',
    })
  }

  if (changes.resetPassword === true) {
    return apiUpdateUser(username, {
      action: 'reset-password',
      temporaryPassword: changes.temporaryPassword,
    })
  }

  if (changes.role) {
    return apiUpdateUser(username, {
      role: changes.role,
    })
  }

  return apiUpdateUser(username, changes)
}

export const USER_ROLES = [
  'Customers',
  'SupportAdmins',
  'UserAdmins',
  'SuperAdmins',
]

export function isCustomerRole(role) {
  return role === 'Customers'
}

export function isAdministratorRole(role) {
  return [
    'SupportAdmins',
    'UserAdmins',
    'SuperAdmins',
  ].includes(role)
}

export function canManageUserRole(actorRole, targetRole) {
  if (actorRole === 'SuperAdmins') return true

  if (actorRole !== 'UserAdmins') return false

  return targetRole === 'Customers'
}
