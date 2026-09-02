import { fetchAuthSession } from 'aws-amplify/auth'
import { config } from './config'

const STORAGE_KEY = 'alteknetworks.portal.tickets.v1'

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
  const response = await fetch(`${config.apiBaseUrl}/tickets`, { headers: await authHeaders() })
  if (!response.ok) throw new Error(`Unable to load tickets (${response.status})`)
  return response.json()
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
  const response = await fetch(`${config.apiBaseUrl}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(ticket),
  })
  if (!response.ok) throw new Error(`Unable to create ticket (${response.status})`)
  return response.json()
}

export async function updateTicket(id, changes) {
  if (!config.apiBaseUrl) {
    const tickets = localTickets().map((ticket) =>
      ticket.id === id ? { ...ticket, ...changes, updatedAt: new Date().toISOString() } : ticket,
    )
    saveLocal(tickets)
    return tickets.find((ticket) => ticket.id === id)
  }
  const response = await fetch(`${config.apiBaseUrl}/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(changes),
  })
  if (!response.ok) throw new Error(`Unable to update ticket (${response.status})`)
  return response.json()
}
