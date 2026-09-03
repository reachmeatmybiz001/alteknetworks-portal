import { createUser, deleteUser, listUsers, updateUser } from './api'

export { listUsers, createUser, updateUser, deleteUser }

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
  return ['SupportAdmins', 'UserAdmins', 'SuperAdmins'].includes(role)
}

export function canManageUserRole(actorRole, targetRole) {
  if (actorRole === 'SuperAdmins') return true
  if (actorRole !== 'UserAdmins') return false
  return targetRole === 'Customers'
}
