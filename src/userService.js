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
  // Disable user
  if (changes.enabled === false) {
    return apiUpdateUser(username, {
      action: 'disable',
    })
  }

  // Enable user
  if (changes.enabled === true) {
    return apiUpdateUser(username, {
      action: 'enable',
    })
  }

  // Reset password
  if (changes.resetPassword === true) {
    return apiUpdateUser(username, {
      action: 'reset-password',
    })
  }

  // Change user role
  if (changes.role) {
    return apiUpdateUser(username, {
      role: changes.role,
    })
  }

  // Fallback
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
