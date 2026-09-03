import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminResetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand, UpdateCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'

const REGION = process.env.AWS_REGION || 'ap-south-1'
const USER_POOL_ID = process.env.USER_POOL_ID
const TICKETS_TABLE = process.env.TICKETS_TABLE
const cognito = new CognitoIdentityProviderClient({ region: REGION })
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } })

const ROLES = ['Customers', 'SupportAdmins', 'UserAdmins', 'SuperAdmins']
const ADMIN_ROLES = ['SupportAdmins', 'UserAdmins', 'SuperAdmins']

function response(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json', 'access-control-allow-origin': process.env.ALLOWED_ORIGIN || 'https://portal.alteknetworks.com', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' }, body: JSON.stringify(body) }
}
function claims(event) { return event.requestContext?.authorizer?.jwt?.claims || {} }
function groups(event) { const g = claims(event)['cognito:groups']; return Array.isArray(g) ? g : (g ? String(g).split(',').map(s => s.trim()) : []) }
function role(event) { const g = groups(event); if (g.includes('SuperAdmins')) return 'SuperAdmins'; if (g.includes('UserAdmins')) return 'UserAdmins'; if (g.includes('SupportAdmins')) return 'SupportAdmins'; return 'Customers' }
function email(event) { return claims(event).email || claims(event).username || '' }
function requireRole(event, allowed) { const r = role(event); if (!allowed.includes(r)) throw Object.assign(new Error('Forbidden'), { statusCode: 403 }); return r }
function body(event) { try { return event.body ? JSON.parse(event.body) : {} } catch { throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }) } }
function id() { return `ALT-${Date.now().toString().slice(-7)}-${Math.random().toString(36).slice(2,6).toUpperCase()}` }

async function userRole(username) {
  try {
    const result = await cognito.send(new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: username }))
    const attr = (result.UserAttributes || []).find(a => a.Name === 'custom:role')
    return attr?.Value || 'Customers'
  } catch { return 'Customers' }
}
async function setUserRole(username, newRole, oldRole) {
  if (oldRole && ROLES.includes(oldRole) && oldRole !== newRole) await cognito.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: USER_POOL_ID, Username: username, GroupName: oldRole }))
  await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: USER_POOL_ID, Username: username, GroupName: newRole }))
  await cognito.send(new AdminUpdateUserAttributesCommand({ UserPoolId: USER_POOL_ID, Username: username, UserAttributes: [{ Name: 'custom:role', Value: newRole }] }))
}
async function listAllUsers() {
  let users = [], token
  do {
    const r = await cognito.send(new ListUsersCommand({ UserPoolId: USER_POOL_ID, PaginationToken: token, Limit: 60 }))
    users = users.concat(r.Users || [])
    token = r.PaginationToken
  } while (token)
  return Promise.all(users.map(async u => ({ username: u.Username, email: (u.Attributes || []).find(a => a.Name === 'email')?.Value || u.Username, enabled: !!u.Enabled, status: u.UserStatus, role: await userRole(u.Username), createdAt: u.UserCreateDate, lastModifiedAt: u.UserLastModifiedDate })))
}

async function ticketsFor(event) {
  if (role(event) === 'Customers') {
    const r = await ddb.send(new QueryCommand({ TableName: TICKETS_TABLE, IndexName: 'customerEmail-index', KeyConditionExpression: 'customerEmail = :email', ExpressionAttributeValues: { ':email': email(event) } }))
    return r.Items || []
  }
  const r = await ddb.send(new ScanCommand({ TableName: TICKETS_TABLE }))
  return r.Items || []
}

async function createTicket(event) {
  requireRole(event, ROLES)
  const b = body(event)
  if (!b.subject || !b.description) throw Object.assign(new Error('Subject and description are required'), { statusCode: 400 })
  const now = new Date().toISOString()
  const item = { id: id(), subject: String(b.subject).slice(0, 200), category: String(b.category || 'General'), priority: String(b.priority || 'Medium'), description: String(b.description).slice(0, 10000), customerEmail: email(event), status: 'Open', assignedTo: null, createdAt: now, updatedAt: now }
  await ddb.send(new PutCommand({ TableName: TICKETS_TABLE, Item: item }))
  return response(201, item)
}

async function updateTicket(event, ticketId) {
  const r = role(event)
  const allowed = r === 'SupportAdmins' || r === 'SuperAdmins' || r === 'UserAdmins'
  if (!allowed) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  const b = body(event)
  const existing = await ddb.send(new GetCommand({ TableName: TICKETS_TABLE, Key: { id: ticketId } }))
  if (!existing.Item) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 })
  const fields = []
  const values = {}
  const names = {}
  for (const key of ['status','assignedTo','priority','category','subject']) if (Object.prototype.hasOwnProperty.call(b, key)) { fields.push(`#${key} = :${key}`); names[`#${key}`] = key; values[`:${key}`] = b[key] }
  if (!fields.length) return response(200, existing.Item)
  fields.push('#updatedAt = :updatedAt'); names['#updatedAt'] = 'updatedAt'; values[':updatedAt'] = new Date().toISOString()
  const out = await ddb.send(new UpdateCommand({ TableName: TICKETS_TABLE, Key: { id: ticketId }, UpdateExpression: `SET ${fields.join(', ')}`, ExpressionAttributeNames: names, ExpressionAttributeValues: values, ReturnValues: 'ALL_NEW' }))
  return response(200, out.Attributes)
}

async function listUsers(event) { requireRole(event, ['UserAdmins','SuperAdmins']); return response(200, await listAllUsers()) }

async function createUser(event) {
  const actor = requireRole(event, ['UserAdmins','SuperAdmins'])
  const b = body(event)
  const newRole = b.role || 'Customers'
  if (!ROLES.includes(newRole)) throw Object.assign(new Error('Invalid role'), { statusCode: 400 })
  if (actor !== 'SuperAdmins' && newRole !== 'Customers') throw Object.assign(new Error('User Admin can create customers only'), { statusCode: 403 })
  if (newRole === 'SuperAdmins' && actor !== 'SuperAdmins') throw Object.assign(new Error('Only Super Admin can create Super Admins'), { statusCode: 403 })
  if (!b.email) throw Object.assign(new Error('Email is required'), { statusCode: 400 })
  const r = await cognito.send(new AdminCreateUserCommand({ UserPoolId: USER_POOL_ID, Username: b.email.trim().toLowerCase(), UserAttributes: [{ Name: 'email', Value: b.email.trim().toLowerCase() }, { Name: 'email_verified', Value: 'true' }, { Name: 'custom:role', Value: newRole }], DesiredDeliveryMediums: ['EMAIL'] }))
  await setUserRole(r.User.Username, newRole, null)
  return response(201, { username: r.User.Username, email: b.email.trim().toLowerCase(), role: newRole, enabled: true })
}

async function updateUser(event, username) {
  const actor = requireRole(event, ['UserAdmins','SuperAdmins'])
  const b = body(event)
  const current = await userRole(username)
  if (b.role !== undefined) {
    if (actor !== 'SuperAdmins') throw Object.assign(new Error('Only Super Admin can manage administrator roles'), { statusCode: 403 })
    if (!ROLES.includes(b.role)) throw Object.assign(new Error('Invalid role'), { statusCode: 400 })
    if (username === email(event) && b.role !== 'SuperAdmins') throw Object.assign(new Error('You cannot remove your own Super Admin role'), { statusCode: 403 })
    await setUserRole(username, b.role, current)
    return response(200, { username, role: b.role })
  }
  if (b.enabled !== undefined) {
    if (current !== 'Customers' && actor !== 'SuperAdmins') throw Object.assign(new Error('User Admin can only enable/disable customers'), { statusCode: 403 })
    const cmd = b.enabled ? new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: username }) : new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
    await cognito.send(cmd)
    return response(200, { username, enabled: b.enabled })
  }
  if (b.resetPassword) {
    if (current !== 'Customers' && actor !== 'SuperAdmins') throw Object.assign(new Error('User Admin can only reset customer passwords'), { statusCode: 403 })
    await cognito.send(new AdminResetUserPasswordCommand({ UserPoolId: USER_POOL_ID, Username: username, ClientMetadata: {} }))
    return response(200, { username, reset: true })
  }
  throw Object.assign(new Error('No supported update supplied'), { statusCode: 400 })
}

async function deleteUser(event, username) {
  const actor = requireRole(event, ['UserAdmins','SuperAdmins'])
  const current = await userRole(username)
  if (current !== 'Customers' && actor !== 'SuperAdmins') throw Object.assign(new Error('User Admin can delete customers only'), { statusCode: 403 })
  await cognito.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: username }))
  return response(200, { username, deleted: true })
}

export async function handler(event) {
  try {
    if (event.requestContext?.http?.method === 'OPTIONS') return response(204, {})
    const method = event.requestContext?.http?.method || event.httpMethod
    const path = event.rawPath || event.path || ''
    if (method === 'GET' && path.endsWith('/tickets')) return response(200, await ticketsFor(event))
    if (method === 'POST' && path.endsWith('/tickets')) return await createTicket(event)
    const ticketMatch = path.match(/\/tickets\/([^/]+)$/)
    if (method === 'PATCH' && ticketMatch) return await updateTicket(event, decodeURIComponent(ticketMatch[1]))
    if (method === 'GET' && path.endsWith('/admin/users')) return await listUsers(event)
    if (method === 'POST' && path.endsWith('/admin/users')) return await createUser(event)
    const userMatch = path.match(/\/admin\/users\/([^/]+)$/)
    if (method === 'PATCH' && userMatch) return await updateUser(event, decodeURIComponent(userMatch[1]))
    if (method === 'DELETE' && userMatch) return await deleteUser(event, decodeURIComponent(userMatch[1]))
    return response(404, { message: 'Route not found' })
  } catch (e) {
    console.error(e)
    return response(e.statusCode || 500, { message: e.message || 'Internal server error' })
  }
}
