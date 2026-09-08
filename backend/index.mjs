import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
  AdminDeleteUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  GetCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'

const REGION = process.env.AWS_REGION || 'ap-south-1'
const USER_POOL_ID = process.env.USER_POOL_ID
const TICKETS_TABLE = process.env.TICKETS_TABLE
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://portal.alteknetworks.com'
const ATTACHMENTS_BUCKET = process.env.ATTACHMENTS_BUCKET

const cognito = new CognitoIdentityProviderClient({ region: REGION })
const s3 = new S3Client({ region: REGION })
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
})

const ROLES = ['Customers', 'SupportAdmins', 'SuperAdmins']
const ADMIN_ROLES = ['SupportAdmins', 'SuperAdmins']

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': ALLOWED_ORIGIN,
      'access-control-allow-headers': 'content-type,authorization',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  }
}

function claims(event) {
  return event?.requestContext?.authorizer?.jwt?.claims || {}
}

function normalizeGroups(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap(normalizeGroups).filter(Boolean)

  const text = String(value).trim()
  if (!text) return []

  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim()
    if (!inner) return []
    return inner
      .split(',')
      .map((item) => item.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }

  return text
    .split(',')
    .map((item) => item.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

function groups(event) {
  return normalizeGroups(claims(event)['cognito:groups'])
}

function role(event) {
  const g = groups(event)
  if (g.includes('SuperAdmins')) return 'SuperAdmins'
  if (g.includes('SupportAdmins')) return 'SupportAdmins'
  return 'Customers'
}

function claimIdentity(event) {
  const c = claims(event)
  return String(
    c.email ||
    c.preferred_username ||
    c['cognito:username'] ||
    c.username ||
    c.sub ||
    ''
  ).trim()
}

function actorUsername(event) {
  return claimIdentity(event)
}

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''))
}

const actorLookupCache = new Map()
let cognitoIdentityMapPromise = null

async function buildCognitoIdentityMap() {
  if (cognitoIdentityMapPromise) return cognitoIdentityMapPromise

  cognitoIdentityMapPromise = (async () => {
    const map = new Map()
    let token
    do {
      const result = await cognito.send(new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        PaginationToken: token,
        Limit: 60,
      }))
      for (const user of result.Users || []) {
        const attrs = user.Attributes || []
        const email = attrs.find((item) => item.Name === 'email')?.Value
        const sub = attrs.find((item) => item.Name === 'sub')?.Value
        const username = user.Username
        const display = email || username || sub
        if (display) {
          if (sub) map.set(String(sub).trim().toLowerCase(), display)
          if (username) map.set(String(username).trim().toLowerCase(), display)
        }
      }
      token = result.PaginationToken
    } while (token)
    return map
  })().catch((error) => {
    cognitoIdentityMapPromise = null
    throw error
  })

  return cognitoIdentityMapPromise
}

async function displayIdentityForStoredValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (!looksLikeUuid(raw)) return raw

  const cacheKey = raw.toLowerCase()
  if (actorLookupCache.has(cacheKey)) return actorLookupCache.get(cacheKey)

  // First try the value as the Cognito username. Older tickets may have
  // stored the Cognito username, which can itself be a UUID.
  try {
    const direct = await cognito.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: raw,
    }))
    const email = (direct.UserAttributes || []).find((item) => item.Name === 'email')?.Value
    const display = email || direct.Username || ''
    if (display) {
      actorLookupCache.set(cacheKey, display)
      return display
    }
  } catch {}

  // If the stored UUID is the Cognito sub, query Cognito directly by sub.
  try {
    const result = await cognito.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `sub = \"${raw}\"`,
      Limit: 1,
    }))
    const user = result.Users?.[0]
    if (user) {
      const email = (user.Attributes || []).find((item) => item.Name === 'email')?.Value
      const display = email || user.Username || ''
      if (display) {
        actorLookupCache.set(cacheKey, display)
        return display
      }
    }
  } catch {}

  // Final fallback: build the complete identity map.
  try {
    const map = await buildCognitoIdentityMap()
    const display = map.get(cacheKey)
    if (display) {
      actorLookupCache.set(cacheKey, display)
      return display
    }
  } catch {}

  // Do not expose raw Cognito UUID/sub values to the portal.
  return 'Portal user'
}

async function actorIdentity(event) {
  const raw = claimIdentity(event)
  const resolved = await displayIdentityForStoredValue(raw)
  return String(resolved || raw || '').trim().toLowerCase()
}

function requireRole(event, allowed) {
  const currentRole = role(event)
  if (!allowed.includes(currentRole)) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  }
  return currentRole
}

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {}
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 })
  }
}

function ticketId() {
  return `ALT-${Date.now().toString().slice(-7)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

async function getUserGroups(username) {
  const result = await cognito.send(
    new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    })
  )
  return (result.Groups || []).map((group) => group.GroupName).filter(Boolean)
}

async function getUserRole(username) {
  try {
    const userGroups = await getUserGroups(username)
    if (userGroups.includes('SuperAdmins')) return 'SuperAdmins'
    if (userGroups.includes('SupportAdmins')) return 'SupportAdmins'
    return 'Customers'
  } catch {
    return 'Customers'
  }
}

async function listAllUsers() {
  let users = []
  let token

  do {
    const result = await cognito.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        PaginationToken: token,
        Limit: 60,
      })
    )

    users = users.concat(result.Users || [])
    token = result.PaginationToken
  } while (token)

  return Promise.all(
    users.map(async (user) => ({
      username: user.Username,
      email: (user.Attributes || []).find((a) => a.Name === 'email')?.Value || user.Username,
      enabled: user.Enabled !== false,
      status: user.UserStatus,
      role: await getUserRole(user.Username),
      createdAt: user.UserCreateDate,
      lastModifiedAt: user.UserLastModifiedDate,
    }))
  )
}

async function enrichTicketIdentities(tickets) {
  return Promise.all((tickets || []).map(async (ticket) => {
    const [customerEmail, createdBy, updatedBy] = await Promise.all([
      displayIdentityForStoredValue(ticket.customerEmail),
      displayIdentityForStoredValue(ticket.createdBy),
      displayIdentityForStoredValue(ticket.updatedBy),
    ])

    return {
      ...ticket,
      customerEmail: customerEmail || ticket.customerEmail || '',
      createdBy: createdBy || ticket.createdBy || customerEmail || ticket.customerEmail || '',
      createdByEmail: createdBy || ticket.createdByEmail || ticket.createdBy || customerEmail || ticket.customerEmail || '',
      createdByUsername: createdBy || ticket.createdByUsername || ticket.createdBy || '',
      updatedBy: updatedBy || ticket.updatedBy || '',
      updatedByEmail: updatedBy || ticket.updatedByEmail || ticket.updatedBy || '',
      updatedByUsername: updatedBy || ticket.updatedByUsername || ticket.updatedBy || '',
    }
  }))
}

async function listTickets(event) {
  const actorIdentityValue = await actorIdentity(event)
  if (role(event) === 'Customers') {
    try {
      const result = await ddb.send(
        new QueryCommand({
          TableName: TICKETS_TABLE,
          IndexName: 'customerEmail-index',
          KeyConditionExpression: 'customerEmail = :email',
          ExpressionAttributeValues: { ':email': await actorIdentity(event) },
        })
      )
      if (result.Items?.length) return enrichTicketIdentities(result.Items)
      // Older tickets may have stored the Cognito sub instead of the email.
      // Fall through to Scan so those tickets remain visible after the identity fix.
    } catch (error) {
      // Fallback for an existing table without the GSI.
      if (!String(error?.message || '').includes('customerEmail-index')) throw error
    }
  }

  const result = await ddb.send(new ScanCommand({ TableName: TICKETS_TABLE }))
  const tickets = result.Items || []

  if (role(event) === 'Customers') {
    const enriched = await enrichTicketIdentities(tickets)
    return enriched.filter(
      (ticket) => String(ticket.customerEmail || '').toLowerCase() === actorIdentityValue
    )
  }

  return enrichTicketIdentities(tickets)
}

async function createTicket(event) {
  const currentRole = requireRole(event, ROLES)
  const body = parseBody(event)
  const actorEmail = await actorIdentity(event)

  if (!body.subject || !body.description) {
    throw Object.assign(new Error('Subject and description are required'), { statusCode: 400 })
  }

  let customerEmail = actorEmail
  if (ADMIN_ROLES.includes(currentRole) && body.customerEmail) {
    customerEmail = String(body.customerEmail).trim().toLowerCase()
  }

  const now = new Date().toISOString()
  const item = {
    id: ticketId(),
    subject: String(body.subject).slice(0, 200),
    category: String(body.category || 'General'),
    priority: String(body.priority || 'Medium'),
    description: String(body.description).slice(0, 10000),
    customerEmail,
    createdBy: actorEmail || actorUsername(event),
    createdByEmail: actorEmail || actorUsername(event),
    createdByUsername: actorEmail || actorUsername(event),
    createdByRole: currentRole,
    status: 'Open',
    assignedTo: body.assignedTo || null,
    comments: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
    updatedBy: actorEmail || actorUsername(event),
    updatedByEmail: actorEmail || actorUsername(event),
    updatedByUsername: actorEmail || actorUsername(event),
    closedAt: null,
    timeSpentMinutes: null,
  }

  await ddb.send(new PutCommand({ TableName: TICKETS_TABLE, Item: item }))
  return response(201, item)
}

async function updateTicket(event, ticketIdValue, attachmentOverride = null) {
  const currentRole = role(event)
  const body = parseBody(event)
  const actorEmail = await actorIdentity(event)

  const existingResult = await ddb.send(
    new GetCommand({ TableName: TICKETS_TABLE, Key: { id: ticketIdValue } })
  )
  const existing = existingResult.Item

  if (!existing) {
    throw Object.assign(new Error('Ticket not found'), { statusCode: 404 })
  }

  if (existing.status === 'Closed') {
    throw Object.assign(new Error('Closed tickets cannot be modified'), { statusCode: 409 })
  }

  const isOwner = String(existing.customerEmail || '').toLowerCase() === actorEmail
  const isCustomer = currentRole === 'Customers'
  const isSupport = currentRole === 'SupportAdmins'
  const isSuper = currentRole === 'SuperAdmins'

  if (isCustomer && !isOwner) {
    throw Object.assign(new Error('Customers can only manage their own tickets'), { statusCode: 403 })
  }

  if (!isCustomer && !isSupport && !isSuper) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  }

  const updates = {}
  const allowedFields = isCustomer
    ? ['subject', 'category', 'priority', 'description', 'status']
    : ['subject', 'category', 'priority', 'description', 'status', 'assignedTo', 'customerEmail']

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updates[key] = body[key]
    }
  }

  if (body.comment) {
    updates.comments = [
      ...(Array.isArray(existing.comments) ? existing.comments : []),
      {
        id: `COM-${Date.now()}`,
        text: String(body.comment).slice(0, 5000),
        createdBy: actorEmail || actorUsername(event),
        createdByEmail: actorEmail || actorUsername(event),
        createdByUsername: actorEmail || actorUsername(event),
        createdAt: new Date().toISOString(),
      },
    ]
  }

  const attachmentToAdd = attachmentOverride || body.attachment
  if (attachmentToAdd) {
    updates.attachments = [
      ...(Array.isArray(existing.attachments) ? existing.attachments : []),
      attachmentToAdd,
    ]
  }

  if (!Object.keys(updates).length) {
    return response(200, existing)
  }

  const now = new Date()
  updates.updatedAt = now.toISOString()
  updates.updatedBy = actorEmail || actorUsername(event)
  updates.updatedByEmail = actorEmail || actorUsername(event)
  updates.updatedByUsername = actorUsername(event) || actorEmail

  if (updates.status === 'Closed' && existing.status !== 'Closed') {
    updates.closedAt = now.toISOString()
    const start = new Date(existing.createdAt).getTime()
    updates.timeSpentMinutes = Number.isFinite(start)
      ? Math.max(0, Math.round((now.getTime() - start) / 60000))
      : null
  } else if (updates.status && updates.status !== 'Closed' && existing.status === 'Closed') {
    updates.closedAt = null
    updates.timeSpentMinutes = null
  }

  const expressionNames = {}
  const expressionValues = {}
  const expressions = []

  for (const [key, value] of Object.entries(updates)) {
    const name = `#${key}`
    const valueName = `:${key}`
    expressionNames[name] = key
    expressionValues[valueName] = value
    expressions.push(`${name} = ${valueName}`)
  }

  const result = await ddb.send(
    new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { id: ticketIdValue },
      UpdateExpression: `SET ${expressions.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: 'ALL_NEW',
    })
  )

  return response(200, result.Attributes)
}

async function createAttachmentUploadUrl(event, ticketIdValue) {
  if (!ATTACHMENTS_BUCKET) {
    throw Object.assign(new Error('Attachment storage is not configured'), { statusCode: 500 })
  }

  const currentRole = role(event)
  const body = parseBody(event)
  const actorEmail = await actorIdentity(event)
  const result = await ddb.send(new GetCommand({
    TableName: TICKETS_TABLE,
    Key: { id: ticketIdValue },
  }))
  const ticket = result.Item
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 })

  const ticketCustomerIdentity = await displayIdentityForStoredValue(ticket.customerEmail)
  const isOwner = String(ticketCustomerIdentity || ticket.customerEmail || '').toLowerCase() === actorEmail
  if (currentRole === 'Customers' && !isOwner) {
    throw Object.assign(new Error('Customers can only attach files to their own tickets'), { statusCode: 403 })
  }

  const fileName = String(body.fileName || body.name || '').trim()
  const contentType = String(body.contentType || 'application/octet-stream').trim()
  const size = Number(body.size || 0)
  if (!fileName) throw Object.assign(new Error('File name is required'), { statusCode: 400 })
  if (size > 25 * 1024 * 1024) throw Object.assign(new Error('Maximum attachment size is 25 MB'), { statusCode: 400 })

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const attachmentId = `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const key = `tickets/${ticketIdValue}/${attachmentId}-${safeName}`
  // Do not sign Content-Type into the URL. Browsers may normalize MIME types,
  // which can otherwise cause a valid presigned upload to fail with a generic
  // "Failed to fetch" / SignatureDoesNotMatch error. The object metadata is
  // still recorded in DynamoDB and the browser sends Content-Type when uploading.
  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: ATTACHMENTS_BUCKET,
    Key: key,
  }), { expiresIn: 900 })

  return response(200, {
    uploadUrl,
    attachment: {
      id: attachmentId,
      key,
      name: fileName,
      contentType,
      size,
      uploadedBy: actorEmail || actorUsername(event),
      uploadedAt: new Date().toISOString(),
    },
  })
}


async function uploadAttachmentViaApi(event, ticketIdValue) {
  if (!ATTACHMENTS_BUCKET) {
    throw Object.assign(new Error('Attachment storage is not configured'), { statusCode: 500 })
  }

  const currentRole = role(event)
  const actorEmail = await actorIdentity(event)
  const result = await ddb.send(new GetCommand({ TableName: TICKETS_TABLE, Key: { id: ticketIdValue } }))
  const ticket = result.Item
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 })

  const ticketCustomerIdentity = await displayIdentityForStoredValue(ticket.customerEmail)
  const isOwner = String(ticketCustomerIdentity || ticket.customerEmail || '').toLowerCase() === actorEmail
  if (currentRole === 'Customers' && !isOwner) {
    throw Object.assign(new Error('Customers can only attach files to their own tickets'), { statusCode: 403 })
  }
  if (ticket.status === 'Closed') {
    throw Object.assign(new Error('Closed tickets cannot be modified'), { statusCode: 400 })
  }

  const body = parseBody(event)
  const fileName = String(body.fileName || body.name || '').trim()
  const contentType = String(body.contentType || 'application/octet-stream').trim()
  const base64 = String(body.dataBase64 || '').trim()
  if (!fileName || !base64) throw Object.assign(new Error('File name and file data are required'), { statusCode: 400 })

  const estimatedSize = Math.floor((base64.length * 3) / 4)
  if (estimatedSize > 7 * 1024 * 1024) {
    throw Object.assign(new Error('Direct upload limit is 7 MB. Please deploy the S3 CORS configuration and use the normal upload for larger files.'), { statusCode: 413 })
  }

  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length > 7 * 1024 * 1024) throw Object.assign(new Error('Direct upload limit is 7 MB'), { statusCode: 413 })

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const attachmentId = `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const key = `tickets/${ticketIdValue}/${attachmentId}-${safeName}`
  await s3.send(new PutObjectCommand({
    Bucket: ATTACHMENTS_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))

  const attachment = {
    id: attachmentId,
    key,
    name: fileName,
    contentType,
    size: buffer.length,
    uploadedBy: actorEmail || actorUsername(event),
    uploadedAt: new Date().toISOString(),
  }
  return updateTicket(event, ticketIdValue, attachment)
}

async function recordAttachment(event, ticketIdValue) {
  const body = parseBody(event)
  const attachment = body.attachment
  if (!attachment?.id || !attachment?.key) {
    throw Object.assign(new Error('Attachment details are required'), { statusCode: 400 })
  }
  return updateTicket(event, ticketIdValue, attachment)
}

async function downloadAttachment(event, ticketIdValue, attachmentId) {
  if (!ATTACHMENTS_BUCKET) throw Object.assign(new Error('Attachment storage is not configured'), { statusCode: 500 })
  const currentRole = role(event)
  const actorEmail = await actorIdentity(event)
  const result = await ddb.send(new GetCommand({ TableName: TICKETS_TABLE, Key: { id: ticketIdValue } }))
  const ticket = result.Item
  if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 })
  const ticketCustomerIdentity = await displayIdentityForStoredValue(ticket.customerEmail)
  const isOwner = String(ticketCustomerIdentity || ticket.customerEmail || '').toLowerCase() === actorEmail
  if (currentRole === 'Customers' && !isOwner) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })

  const attachment = (ticket.attachments || []).find((item) => item.id === attachmentId || item.key === attachmentId)
  if (!attachment) throw Object.assign(new Error('Attachment not found'), { statusCode: 404 })
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: ATTACHMENTS_BUCKET, Key: attachment.key }), { expiresIn: 900 })
  return response(200, { url })
}

async function listUsers(event) {
  requireRole(event, ['SuperAdmins'])
  return response(200, await listAllUsers())
}

async function createUser(event) {
  requireRole(event, ['SuperAdmins'])
  const body = parseBody(event)
  const newRole = body.role || 'Customers'
  const userEmail = String(body.email || '').trim().toLowerCase()
  const temporaryPassword = String(body.temporaryPassword || '').trim()

  if (!ROLES.includes(newRole)) {
    throw Object.assign(new Error('Invalid role'), { statusCode: 400 })
  }
  if (!userEmail) {
    throw Object.assign(new Error('Email is required'), { statusCode: 400 })
  }
  if (!temporaryPassword) {
    throw Object.assign(new Error('Temporary password is required'), { statusCode: 400 })
  }

  const result = await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userEmail,
      TemporaryPassword: temporaryPassword,
      UserAttributes: [
        { Name: 'email', Value: userEmail },
        { Name: 'email_verified', Value: 'true' },
      ],
      MessageAction: 'SUPPRESS',
    })
  )

  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: result.User.Username,
      GroupName: newRole,
    })
  )

  return response(201, {
    username: result.User.Username,
    email: userEmail,
    role: newRole,
    enabled: true,
    status: result.User.UserStatus,
  })
}

async function updateUser(event, username) {
  requireRole(event, ['SuperAdmins'])
  const body = parseBody(event)

  if (body.role !== undefined) {
    const newRole = String(body.role)
    if (!ROLES.includes(newRole)) {
      throw Object.assign(new Error('Invalid role'), { statusCode: 400 })
    }

    const currentRole = await getUserRole(username)
    if (currentRole !== newRole) {
      if (ROLES.includes(currentRole)) {
        await cognito.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: currentRole,
          })
        )
      }

      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
          GroupName: newRole,
        })
      )
    }

    return response(200, { username, role: newRole })
  }

  if (body.enabled !== undefined) {
    const command = body.enabled
      ? new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
      : new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: username })

    await cognito.send(command)
    return response(200, { username, enabled: body.enabled })
  }

  if (body.action === 'reset-password') {
    const temporaryPassword = String(body.temporaryPassword || '').trim()
    if (!temporaryPassword) {
      throw Object.assign(new Error('Temporary password is required'), { statusCode: 400 })
    }

    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        Password: temporaryPassword,
        Permanent: false,
      })
    )

    return response(200, {
      username,
      message: 'Temporary password set successfully. The user must change it at next login.',
    })
  }

  throw Object.assign(new Error('No supported update supplied'), { statusCode: 400 })
}

async function deleteUser(event, username) {
  requireRole(event, ['SuperAdmins'])
  await cognito.send(
    new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
  )
  return response(200, { username, deleted: true })
}

export async function handler(event) {
  try {
    const method = (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase()
    const path = event?.rawPath || event?.requestContext?.http?.path || event?.path || ''

    if (method === 'OPTIONS') return response(204, {})

    if (method === 'GET' && path.endsWith('/tickets')) {
      return response(200, await listTickets(event))
    }

    if (method === 'POST' && path.endsWith('/tickets')) {
      return createTicket(event)
    }

    const attachmentUploadMatch = path.match(/\/tickets\/([^/]+)\/attachments\/upload-url$/)
    if (method === 'POST' && attachmentUploadMatch) {
      return createAttachmentUploadUrl(event, decodeURIComponent(attachmentUploadMatch[1]))
    }

    const attachmentDirectMatch = path.match(/\/tickets\/([^/]+)\/attachments\/upload$/)
    if (method === 'POST' && attachmentDirectMatch) {
      return uploadAttachmentViaApi(event, decodeURIComponent(attachmentDirectMatch[1]))
    }

    const attachmentDownloadMatch = path.match(/\/tickets\/([^/]+)\/attachments\/([^/]+)\/download-url$/)
    if (method === 'GET' && attachmentDownloadMatch) {
      return downloadAttachment(event, decodeURIComponent(attachmentDownloadMatch[1]), decodeURIComponent(attachmentDownloadMatch[2]))
    }

    const attachmentRecordMatch = path.match(/\/tickets\/([^/]+)\/attachments$/)
    if (method === 'POST' && attachmentRecordMatch) {
      return recordAttachment(event, decodeURIComponent(attachmentRecordMatch[1]))
    }

    const ticketMatch = path.match(/\/tickets\/([^/]+)$/)
    if (method === 'PATCH' && ticketMatch) {
      return updateTicket(event, decodeURIComponent(ticketMatch[1]))
    }

    if (method === 'GET' && path.endsWith('/admin/users')) {
      return listUsers(event)
    }

    if (method === 'POST' && path.endsWith('/admin/users')) {
      return createUser(event)
    }

    const userMatch = path.match(/\/admin\/users\/([^/]+)$/)
    if (method === 'PATCH' && userMatch) {
      return updateUser(event, decodeURIComponent(userMatch[1]))
    }

    if (method === 'DELETE' && userMatch) {
      return deleteUser(event, decodeURIComponent(userMatch[1]))
    }

    return response(404, { message: 'Route not found' })
  } catch (error) {
    console.error('Lambda error:', error)
    return response(error?.statusCode || 500, {
      message: error?.message || 'Internal server error',
    })
  }
}
