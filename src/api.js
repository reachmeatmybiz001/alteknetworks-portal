import { fetchAuthSession } from 'aws-amplify/auth'
import { config } from './config'

async function request(path, options = {}) {
  if (!config.apiBaseUrl) throw new Error('Admin API URL is not configured. Set VITE_API_BASE_URL in Amplify.')
  const session = await fetchAuthSession()
  const token = session.tokens?.accessToken?.toString()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }
  const response = await fetch(`${config.apiBaseUrl}${path}`, { ...options, headers })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { message: text } }
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`)
  return data
}

export const listTickets = () => request('/tickets')
export const createTicket = (body) => request('/tickets', { method: 'POST', body: JSON.stringify(body) })
export const updateTicket = (id, body) => request(`/tickets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) })

export const listUsers = () => request('/admin/users')
export const createUser = (body) => request('/admin/users', { method: 'POST', body: JSON.stringify(body) })
export const updateUser = (username, body) => request(`/admin/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: JSON.stringify(body) })
export const deleteUser = (username) => request(`/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE' })
