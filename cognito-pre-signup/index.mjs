const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com',
  'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'zoho.com', 'gmx.com',
  'mail.com', 'yandex.com', 'yandex.ru', 'rediffmail.com', 'rediff.com',
])

function domains() {
  return String(process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
}

export const handler = async (event) => {
  const email = String(event?.request?.userAttributes?.email || '').trim().toLowerCase()
  const domain = email.split('@')[1] || ''
  const allowlist = domains()

  if (!domain) {
    throw new Error('A corporate email address is required.')
  }

  if (allowlist.length > 0) {
    if (!allowlist.includes(domain)) {
      throw new Error('Please use an approved corporate email address.')
    }
  } else if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    throw new Error('Personal email addresses are not allowed. Please use your corporate email address.')
  }

  return event
}
