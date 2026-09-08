import { fetchAuthSession } from 'aws-amplify/auth'
import { config } from './config'

const STORAGE_KEY = 'alteknetworks.portal.tickets.v1'
const DIRECT_UPLOAD_LIMIT = 7 * 1024 * 1024
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024

function localTickets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveLocal(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
}

async function authHeaders() {
  const session = await fetchAuthSession()
  const token = session.tokens?.accessToken?.toString()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function listTickets() {
  if (!config.apiBaseUrl) return localTickets()

  try {
    const response = await fetch(`${config.apiBaseUrl}/tickets`, {
      headers: await authHeaders(),
    })
    if (!response.ok) {
      throw new Error(`Unable to load tickets (${response.status})`)
    }
    return response.json()
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Unable to reach the ticket service. Please check the API Gateway/Lambda deployment and try again.'
      )
    }
    throw error
  }
}

export async function createTicket(ticket) {
  if (!config.apiBaseUrl) {
    const newTicket = {
      ...ticket,
      id: `ALT-${Date.now().toString().slice(-7)}`,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveLocal([newTicket, ...localTickets()])
    return newTicket
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
      },
      body: JSON.stringify(ticket),
    })

    if (!response.ok) {
      throw new Error(`Unable to create ticket (${response.status})`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Unable to reach the ticket service. Please check the API Gateway/Lambda deployment and try again.'
      )
    }
    throw error
  }
}

export async function updateTicket(id, changes) {
  if (!config.apiBaseUrl) {
    const tickets = localTickets().map((ticket) =>
      ticket.id === id
        ? { ...ticket, ...changes, updatedAt: new Date().toISOString() }
        : ticket,
    )
    saveLocal(tickets)
    return tickets.find((ticket) => ticket.id === id)
  }

  const response = await fetch(`${config.apiBaseUrl}/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: JSON.stringify(changes),
  })

  if (!response.ok) {
    throw new Error(`Unable to update ticket (${response.status})`)
  }

  return response.json()
}

async function apiJson(path, options = {}) {
  if (!config.apiBaseUrl) {
    throw new Error('Admin API URL is not configured. Set VITE_API_BASE_URL in Amplify.')
  }

  let response

  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders()),
        ...(options.headers || {}),
      },
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Unable to reach the ticket API. Check API Gateway, Lambda, CORS and the deployed API URL.'
      )
    }
    throw error
  }

  const text = await response.text()
  let data = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text }
  }

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`)
  }

  return data
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }

    reader.onerror = () => {
      reject(new Error(`Unable to read ${file.name}.`))
    }

    reader.readAsDataURL(file)
  })
}

async function uploadDirectViaApi(id, file) {
  const dataBase64 = await readFileAsBase64(file)

  return apiJson(`/tickets/${encodeURIComponent(id)}/attachments/upload`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      dataBase64,
    }),
  })
}

export async function uploadTicketAttachment(id, file) {
  if (!file) {
    const items = await listTickets()
    return items.find((item) => item.id === id)
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error(
      `File ${file.name} exceeds the 25 MB attachment limit.`
    )
  }

  if (!config.apiBaseUrl) {
    return updateTicket(id, {
      attachment: {
        id: `ATT-${Date.now()}`,
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        uploadedBy: 'Portal user',
        uploadedAt: new Date().toISOString(),
      },
    })
  }

  /*
   * IMPORTANT:
   * Files <= 7 MB use the authenticated API/Lambda upload directly.
   * This completely avoids browser -> S3 CORS/presigned-URL failures for
   * normal support documents such as XLSX, PDF, DOCX, images, etc.
   */
  if (file.size <= DIRECT_UPLOAD_LIMIT) {
    try {
      return await uploadDirectViaApi(id, file)
    } catch (directError) {
      throw new Error(
        `Unable to upload ${file.name}. ${directError?.message || 'The API upload failed.'}`
      )
    }
  }

  /*
   * Larger files use the presigned S3 path.
   * The backend intentionally does not sign Content-Type, so do not add
   * Content-Type to the PUT request.
   */
  let prep

  try {
    prep = await apiJson(`/tickets/${encodeURIComponent(id)}/attachments/upload-url`, {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      }),
    })
  } catch (error) {
    throw new Error(
      `Unable to prepare ${file.name} for upload. ${error?.message || ''}`.trim()
    )
  }

  let uploadResponse

  try {
    uploadResponse = await fetch(prep.uploadUrl, {
      method: 'PUT',
      body: file,
    })
  } catch (error) {
    throw new Error(
      `Unable to upload ${file.name} to secure storage. This file is larger than 7 MB, so the browser requires the S3 CORS/presigned upload path. ${error?.message || 'Network/CORS error.'}`
    )
  }

  if (!uploadResponse.ok) {
    let detail = ''

    try {
      detail = await uploadResponse.text()
    } catch {}

    throw new Error(
      `Unable to upload ${file.name}${detail
        ? `: ${detail}`
        : ` (HTTP ${uploadResponse.status})`}`
    )
  }

  try {
    return await apiJson(`/tickets/${encodeURIComponent(id)}/attachments`, {
      method: 'POST',
      body: JSON.stringify({
        attachment: prep.attachment,
      }),
    })
  } catch (error) {
    throw new Error(
      `The file ${file.name} was uploaded, but the ticket record could not be updated. ${error?.message || ''}`.trim()
    )
  }
}

export async function getTicketAttachmentDownloadUrl(id, attachmentId) {
  if (!config.apiBaseUrl) return ''

  const result = await apiJson(
    `/tickets/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
    { method: 'GET' },
  )

  return result.url
}
