const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'gmx.com',
  'mail.com',
  'yandex.com',
  'yandex.ru',
  'rediffmail.com',
  'rediff.com',
])

function configuredDomains() {
  return String(import.meta.env.VITE_CORPORATE_EMAIL_DOMAINS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
}

export function corporateEmailError(email) {
  const normalized = String(email || '').trim().toLowerCase()
  const match = normalized.match(/^[^@\s]+@([^@\s]+)$/)
  if (!match) return 'Please enter a valid business email address.'

  const domain = match[1]
  const allowlist = configuredDomains()

  if (allowlist.length > 0) {
    if (!allowlist.includes(domain)) {
      return `Please use an approved corporate email domain: ${allowlist.map((item) => `@${item}`).join(', ')}.`
    }
    return ''
  }

  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return 'Personal email addresses such as Gmail, Yahoo, Outlook, Hotmail and similar services are not allowed. Please use your corporate email address.'
  }

  return ''
}
