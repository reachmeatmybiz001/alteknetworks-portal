import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'

import {
  currentUser,
  authEvents,
  login,
  logout,
  confirmSignIn,
} from './auth'

import {
  createTicket,
  listTickets,
  updateTicket,
  uploadTicketAttachment,
  getTicketAttachmentDownloadUrl,
} from './ticketService'

import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  USER_ROLES,
  canManageUserRole,
} from './userService'

import * as XLSX from 'xlsx'

import './styles.css'


const categories = [
  'Networking',
  'Security',
  'CCTV & Surveillance',
  'Cloud Infrastructure',
  'End User Computing',
  'Enterprise Computing',
  'Data Center',
  'AMC / Support',
  'Other',
]

const statuses = [
  'All',
  'Open',
  'Acknowledged',
  'In Progress',
  'Pending Customer',
  'Resolved',
  'Closed',
]

const ADMIN_ROLES = [
  'SupportAdmins',
  'SuperAdmins',
]


/* =========================================================
   LOGO
========================================================= */

function Logo({ compact = false }) {
  return (
    <img
      className={compact ? 'brand-logo compact' : 'brand-logo'}
      src="/alteknetworks-logo.png"
      alt="ALTEKNETWORKS IT Services"
    />
  )
}


/* =========================================================
   LOGIN
========================================================= */

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [submitting, setSubmitting] =
    useState(false)

  const [loginError, setLoginError] =
    useState('')

  const [challenge, setChallenge] =
    useState('')

  const [newPassword, setNewPassword] =
    useState('')

  const [confirmNewPassword, setConfirmNewPassword] =
    useState('')


  const submit = async (e) => {
    e.preventDefault()

    setLoginError('')

    if (!email.trim() || !password) {
      setLoginError(
        'Please enter your email address and password.'
      )
      return
    }

    setSubmitting(true)

    try {
      const nextStep = await login(
        email.trim(),
        password
      )

      if (
        nextStep?.nextStep?.signInStep ===
        'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED'
      ) {
        setChallenge('NEW_PASSWORD_REQUIRED')
        return
      }

      if (
        nextStep?.nextStep?.signInStep &&
        nextStep.nextStep.signInStep !== 'DONE'
      ) {
        setLoginError(
          'Additional account verification is required. Please contact your administrator.'
        )
        return
      }

      window.location.reload()

    } catch (error) {
      const message =
        error?.message ||
        'Unable to sign in. Please check your email address and password.'

      if (
        message.includes(
          'Incorrect username or password'
        )
      ) {
        setLoginError(
          'Incorrect email address or password. Please try again.'
        )

      } else if (
        message.includes('User does not exist')
      ) {
        setLoginError(
          'No portal account was found for this email address.'
        )

      } else if (
        message.includes('User is not confirmed')
      ) {
        setLoginError(
          'Your portal account is not confirmed. Please contact your administrator.'
        )

      } else {
        setLoginError(message)
      }

    } finally {
      setSubmitting(false)
    }
  }


  const submitNewPassword = async (e) => {
    e.preventDefault()

    setLoginError('')

    if (!newPassword) {
      setLoginError(
        'Please enter a new password.'
      )
      return
    }

    if (!confirmNewPassword) {
      setLoginError(
        'Please confirm your new password.'
      )
      return
    }

    if (newPassword !== confirmNewPassword) {
      setLoginError(
        'New password and confirm password do not match.'
      )
      return
    }

    setSubmitting(true)

    try {
      await confirmSignIn({
        challengeResponse: newPassword,
      })

      setChallenge('')
      setNewPassword('')
      setConfirmNewPassword('')

      window.location.reload()

    } catch (error) {
      setLoginError(
        error?.message ||
        'Unable to set the new password. Please try again.'
      )

    } finally {
      setSubmitting(false)
    }
  }


  return (
    <div className="login-page">

      <div className="login-card">

        <div className="login-brand">
          <Logo />
        </div>


        <div className="login-copy">

          <span className="eyebrow">
            CUSTOMER SUPPORT PORTAL
          </span>

          <h1>
            Welcome to your IT support portal
          </h1>

          <p>
            Sign in to raise service requests,
            track incidents and stay connected
            with the ALTEKNETWORKS support team.
          </p>

        </div>


        {loginError && (
          <div
            className="login-error"
            role="alert"
          >
            {loginError}
          </div>
        )}


        {challenge === 'NEW_PASSWORD_REQUIRED' ? (

          <form
            className="login-form"
            onSubmit={submitNewPassword}
          >

            <label>
              New Password

              <input
                type="password"
                value={newPassword}
                onChange={(e) =>
                  setNewPassword(e.target.value)
                }
                placeholder="Enter a new password"
                autoComplete="new-password"
                autoFocus
                required
              />

            </label>


            <label>
              Confirm New Password

              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) =>
                  setConfirmNewPassword(
                    e.target.value
                  )
                }
                placeholder="Confirm your new password"
                autoComplete="new-password"
                required
              />

            </label>


            <button
              className="primary-button full"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? 'Updating…'
                : 'Set New Password'}
            </button>

          </form>

        ) : (

          <form
            className="login-form"
            onSubmit={submit}
          >

            <label>
              Email Address

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="name@company.com"
                autoComplete="username"
                autoFocus
                required
              />

            </label>


            <label>
              Password

              <div className="password-field">

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (value) => !value
                    )
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword
                    ? 'Hide'
                    : 'Show'}
                </button>

              </div>

            </label>


            <button
              className="primary-button full"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? 'Signing in…'
                : 'Sign In'}
            </button>

          </form>

        )}

      </div>

    </div>
  )
}


/* =========================================================
   APP
========================================================= */

function App() {
  const [user, setUser] =
    useState(undefined)

  const [tickets, setTickets] =
    useState([])

  const [view, setView] =
    useState('dashboard')

  const [adminView, setAdminView] =
    useState('tickets')

  const [loadingTickets, setLoadingTickets] =
    useState(false)

  const [loadingUsers, setLoadingUsers] =
    useState(false)

  const [users, setUsers] =
    useState([])

  const [error, setError] =
    useState('')

  const [notice, setNotice] =
    useState('')

  const refreshUser = async () => {
    setUser(await currentUser())
  }

  useEffect(() => {

    refreshUser()

    const unsubscribe =
      authEvents(({ payload }) => {

        if (
          payload.event === 'signedIn'
        ) {
          refreshUser()
        }

        if (
          payload.event === 'signedOut'
        ) {
          setUser(null)
        }

      })

    return unsubscribe

  }, [])


  useEffect(() => {

    if (!user) return

    setLoadingTickets(true)

    setError('')

    listTickets()

      .then(setTickets)

      .catch((e) =>
        setError(e.message)
      )

      .finally(() =>
        setLoadingTickets(false)
      )

  }, [user])


  const isAdmin =
    user?.groups?.some(
      (group) =>
        ADMIN_ROLES.includes(group)
    )


  const isSuperAdmin =
    user?.groups?.includes(
      'SuperAdmins'
    )




  const isSupportAdmin =
    user?.groups?.includes(
      'SupportAdmins'
    )


  const actorRole =
    isSuperAdmin
      ? 'SuperAdmins'
      : isSupportAdmin
        ? 'SupportAdmins'
        : 'Customers'


  /* =======================================================
     CREATE TICKET
  ======================================================= */

  const handleCreate = async (payload) => {
    setError('')

    try {
      const files = Array.isArray(payload?.files) ? payload.files : []
      const { files: _files, ...ticketPayload } = payload || {}

      const ticket = await createTicket({
        ...ticketPayload,
        customerEmail: isAdmin ? ticketPayload.customerEmail : user.email,
      })

      let finalTicket = ticket
      for (const file of files) {
        finalTicket = await uploadTicketAttachment(ticket.id, file)
      }

      setTickets((current) => [
        finalTicket,
        ...current,
      ])

      setNotice(`Ticket ${ticket.id} created successfully.`)
      setView('tickets')
    } catch (error) {
      setError(error?.message || 'Unable to create ticket.')
      throw error
    }
  }


  /* =======================================================
     UPDATE TICKET
  ======================================================= */

  const handleUpdate = async (
    id,
    changes
  ) => {

    setError('')

    try {

      const updated =
        await updateTicket(
          id,
          changes
        )

      setTickets(
        (current) =>
          current.map(
            (ticket) =>
              ticket.id === id
                ? updated
                : ticket
          )
      )

    } catch (error) {

      setError(
        error?.message ||
        'Unable to update ticket.'
      )

      throw error

    }
  }


  /* =======================================================
     LOAD USERS
  ======================================================= */

  const loadUsers = async () => {

    if (!isSuperAdmin) return

    setLoadingUsers(true)
    setError('')

    try {

      const result =
        await listUsers()

      setUsers(
        Array.isArray(result)
          ? result
          : []
      )

    } catch (error) {

      setError(
        error?.message ||
        'Unable to load users.'
      )

    } finally {

      setLoadingUsers(false)
    }
  }


  /* =======================================================
     CREATE USER
  ======================================================= */

  const handleCreateUser = async (
    payload
  ) => {

    setError('')

    try {

      await createUser(payload)

      setNotice(
        `User ${payload.email} created successfully.`
      )

      await loadUsers()

    } catch (error) {

      setError(
        error?.message ||
        'Unable to create user.'
      )

      throw error
    }
  }


  /* =======================================================
     UPDATE USER
  ======================================================= */

  const handleUpdateUser = async (
    username,
    changes
  ) => {

    setError('')

    try {

      await updateUser(
        username,
        changes
      )

      if (changes?.resetPassword) {
        setNotice(
          'Temporary password set successfully. The user must change it at next login.'
        )
      } else if (changes?.enabled === false) {
        setNotice('User disabled successfully.')
      } else if (changes?.enabled === true) {
        setNotice('User enabled successfully.')
      } else if (changes?.role) {
        setNotice('User role updated successfully.')
      } else {
        setNotice('User updated successfully.')
      }

      await loadUsers()
      return true

    } catch (error) {

      setError(
        error?.message ||
        'Unable to update user.'
      )
      return false
    }
  }


  /* =======================================================
     DELETE USER
  ======================================================= */

  const handleDeleteUser = async (
    username,
    email
  ) => {

    if (!isSuperAdmin) {
      setError(
        'Only SuperAdmins can delete users.'
      )
      return
    }

    const confirmed =
      window.confirm(
        `Delete user ${email}? This action cannot be undone.`
      )

    if (!confirmed) return

    setError('')

    try {

      await deleteUser(username)

      setNotice(
        `User ${email} deleted successfully.`
      )

      await loadUsers()

    } catch (error) {

      setError(
        error?.message ||
        'Unable to delete user.'
      )
    }
  }


  if (user === undefined) {

    return (
      <div className="loading-screen">
        Loading secure portal…
      </div>
    )
  }


  if (!user) {
    return <LoginScreen />
  }


  const openCount =
    tickets.filter(
      (t) =>
        ![
          'Resolved',
          'Closed',
        ].includes(t.status)
    ).length


  const resolvedCount =
    tickets.filter(
      (t) =>
        [
          'Resolved',
          'Closed',
        ].includes(t.status)
    ).length


  return (

    <div className="app-shell">

      <header className="topbar">

        <div className="topbar-inner">

          <Logo compact />

          <nav>

            <button
              className={
                view === 'dashboard'
                  ? 'nav-active'
                  : ''
              }
              onClick={() =>
                setView('dashboard')
              }
            >
              Dashboard
            </button>


            <button
              className={
                view === 'tickets'
                  ? 'nav-active'
                  : ''
              }
              onClick={() =>
                setView('tickets')
              }
            >
              My Tickets
            </button>


            {isAdmin && (

              <button
                className={
                  view === 'admin'
                    ? 'nav-active'
                    : ''
                }
                onClick={() => {

                  setView('admin')

                  if (
                    isSuperAdmin &&
                    users.length === 0
                  ) {
                    loadUsers()
                  }

                }}
              >
                Admin
              </button>

            )}

          </nav>


          <div className="user-menu">

            <div>

              <strong>
                {user.email ||
                  user.username}
              </strong>

              <span>
                {isSuperAdmin
                  ? 'Super Administrator'
                  : isSupportAdmin
                    ? 'Support Administrator'
                    : 'Customer'}
              </span>

            </div>


            <button
              onClick={logout}
            >
              Sign out
            </button>

          </div>

        </div>

      </header>


      <main className="content">

        {notice && (

          <div className="notice">

            {notice}

            <button
              onClick={() =>
                setNotice('')
              }
            >
              ×
            </button>

          </div>

        )}


        {error && (

          <div className="error-banner">

            {error}

            <button
              onClick={() =>
                setError('')
              }
            >
              ×
            </button>

          </div>

        )}


        {view === 'dashboard' && (

          <Dashboard
            user={user}
            openCount={openCount}
            resolvedCount={resolvedCount}
            tickets={tickets}
            loading={loadingTickets}
            onNew={() =>
              setView('new')
            }
            onTickets={() =>
              setView('tickets')
            }
            isAdmin={isAdmin}
            onExport={() => exportTicketsToExcel(tickets)}
          />

        )}


        {view === 'tickets' && (

          <Tickets
            tickets={tickets}
            loading={loadingTickets}
            isAdmin={isAdmin}
            onNew={() =>
              setView('new')
            }
            onUpdate={handleUpdate}
          />

        )}


        {view === 'new' && (

          <NewTicket
            isAdmin={isAdmin}
            onCancel={() =>
              setView('dashboard')
            }
            onCreate={handleCreate}
          />

        )}


        {view === 'admin' &&
          isAdmin && (

            <AdminPanel
              tickets={tickets}
              onUpdate={handleUpdate}
              adminView={adminView}
              setAdminView={setAdminView}
              users={users}
              loadingUsers={loadingUsers}
              onLoadUsers={loadUsers}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              actorRole={actorRole}
              isSuperAdmin={isSuperAdmin}
            />

          )}

      </main>


      <footer>
        © {new Date().getFullYear()}
        {' '}
        ALTEKNETWORKS IT Services
        {' · '}
        Your Complete IT Infrastructure Partner
      </footer>

    </div>
  )
}


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  user,
  openCount,
  resolvedCount,
  tickets,
  loading,
  onNew,
  onTickets,
  isAdmin = false,
  onExport,
}) {

  return (

    <>

      <section className="hero-card">

        <div>

          <span className="eyebrow">
            {isAdmin ? 'ADMIN DASHBOARD' : 'CUSTOMER DASHBOARD'}
          </span>

          <h1>
            Hello,{' '}
            {user.email?.split('@')[0] ||
              'Customer'}
            .
          </h1>

          <p>
            Manage your IT support requests
            and keep track of every service
            interaction from one place.
          </p>

          <div className="dashboard-actions">
            <button
              className="primary-button"
              onClick={onNew}
            >
              + Raise a new ticket
            </button>
            {isAdmin && (
              <button
                type="button"
                className="secondary-button"
                onClick={onExport}
                disabled={!tickets.length}
              >
                Export Excel Report
              </button>
            )}
          </div>

        </div>


        <div className="hero-art">

          <div className="orb">
            IT
          </div>

        </div>

      </section>


      <div className="stats-grid">

        <Stat
          label="Open tickets"
          value={openCount}
          onClick={onTickets}
        />

        <Stat
          label="Resolved / Closed"
          value={resolvedCount}
          onClick={onTickets}
        />

        <Stat
          label="Total tickets"
          value={tickets.length}
          onClick={onTickets}
        />

      </div>

      {loading && (
        <div className="empty-card dashboard-loading">
          Loading ticket summary…
        </div>
      )}

    </>
  )
}


/* =========================================================
   STAT
========================================================= */

function Stat({
  label,
  value,
  onClick,
}) {

  return (
    <a
      href="#my-tickets"
      className="stat-card stat-card-link"
      onClick={(event) => {
        event.preventDefault()
        onClick()
      }}
      aria-label={`${label}: ${value}. Open My Tickets.`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </a>
  )
}


/* =========================================================
   TICKETS
========================================================= */

function Tickets({
  tickets,
  loading,
  isAdmin,
  onNew,
  onUpdate,
}) {

  const [filter, setFilter] =
    useState('All')


  const filtered =
    useMemo(
      () =>
        filter === 'All'
          ? tickets
          : tickets.filter(
              (t) =>
                t.status === filter
            ),
      [filter, tickets]
    )


  return (

    <>

      <section className="section-head page-head">

        <div>

          <span className="eyebrow">
            SUPPORT REQUESTS
          </span>

          <h1>
            {isAdmin
              ? 'All Tickets'
              : 'My Tickets'}
          </h1>

          <p>
            Search, filter and track
            support requests.
          </p>

        </div>


        <button
          className="primary-button"
          onClick={onNew}
        >
          + New ticket
        </button>

      </section>


      <div className="filter-row">

        {statuses.map(
          (status) => (

            <button
              key={status}
              className={
                filter === status
                  ? 'filter-active'
                  : ''
              }
              onClick={() =>
                setFilter(status)
              }
            >
              {status}
            </button>

          )
        )}

      </div>


      {loading ? (

        <div className="empty-card">
          Loading tickets…
        </div>

      ) : filtered.length ? (

        <TicketTable
          tickets={filtered}
          admin={isAdmin}
          onUpdate={onUpdate}
        />

      ) : (

        <div className="empty-card">
          No tickets match this filter.
        </div>

      )}

    </>
  )
}


/* =========================================================
   TICKET TABLE
========================================================= */

function TicketTable({
  tickets,
  admin = false,
  onUpdate,
}) {

  const [selectedId, setSelectedId] =
    useState(null)

  const selectedTicket =
    tickets.find((ticket) =>
      ticket.id === selectedId
    ) || null

  const openTicket = (id) => {
    setSelectedId(id)
  }

  const closeDetails = () => {
    setSelectedId(null)
  }

  return (

    <>

      <div className="table-card">

        <div className="ticket-table">

          <div className="table-row table-head">

            <span>
              Ticket
            </span>

            <span>
              Subject
            </span>

            <span>
              Priority
            </span>

            <span>
              Status
            </span>

            <span>
              Updated
            </span>


          </div>


          {tickets.map(
            (t) => (

              <div
                className={`table-row ${selectedId === t.id ? 'ticket-row-selected' : ''}`}
                key={t.id}
              >

                <span className="ticket-id">
                  <button
                    type="button"
                    className="ticket-link"
                    onClick={() => openTicket(t.id)}
                    aria-label={`Open ticket ${t.id}`}
                  >
                    {t.id}
                  </button>
                </span>


                <span>

                  <strong>
                    {t.subject}
                  </strong>

                  <small>
                    {t.category}
                  </small>

                  <small>
                    Created by: {t.createdByEmail || t.createdByUsername || t.createdBy || t.customerEmail || '—'}
                  </small>

                  <small>
                    Created: {t.createdAt
                      ? new Date(t.createdAt).toLocaleString()
                      : '—'}
                  </small>

                  {t.status === 'Closed' && (
                    <small>
                      Time to close: {typeof t.timeSpentMinutes === 'number'
                        ? `${Math.floor(t.timeSpentMinutes / 60)}h ${t.timeSpentMinutes % 60}m`
                        : '—'}
                    </small>
                  )}

                </span>


                <span>
                  <Priority
                    value={t.priority}
                  />
                </span>


                <span>
                  <Status
                    value={t.status}
                  />
                </span>


                <span>
                  {t.updatedAt || t.createdAt
                    ? new Date(
                        t.updatedAt || t.createdAt
                      ).toLocaleDateString()
                    : '—'}
                </span>


              </div>

            )
          )}

        </div>

      </div>


      {selectedTicket && onUpdate && (

        <TicketProcessingPanel
          ticket={selectedTicket}
          onUpdate={onUpdate}
          onClose={closeDetails}
          admin={admin}
        />

      )}

    </>
  )
}


function formatIdentity(value, fallback = '—') {
  const text = String(value || '').trim()
  if (!text) return fallback
  return text
}

/* =========================================================
   TICKET PROCESSING
========================================================= */

function TicketProcessingPanel({
  ticket,
  onUpdate,
  onClose,
  admin = false,
}) {
  const [priority, setPriority] = useState(ticket.priority || 'Medium')
  const [status, setStatus] = useState(ticket.status || 'Open')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [downloadBusy, setDownloadBusy] = useState('')
  const isClosed = ticket.status === 'Closed'

  useEffect(() => {
    setPriority(ticket.priority || 'Medium')
    setStatus(ticket.status || 'Open')
  }, [ticket.id, ticket.priority, ticket.status])

  const saveChanges = async () => {
    const changes = {}
    if (priority !== ticket.priority) changes.priority = priority
    if (status !== ticket.status) changes.status = status
    if (comment.trim()) changes.comment = comment.trim()

    if (!Object.keys(changes).length) return

    setSaving(true)
    try {
      await onUpdate(ticket.id, changes)
      setComment('')
    } finally {
      setSaving(false)
    }
  }

  const saveAttachments = async () => {
    if (!files.length) return
    setUploadError('')
    setUploading(true)
    try {
      for (const file of files) {
        await uploadTicketAttachment(ticket.id, file)
      }
      setFiles([])
      await onUpdate(ticket.id, {})
    } catch (error) {
      setUploadError(error?.message || 'Unable to upload the attachment. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const downloadAttachment = async (attachment) => {
    setDownloadBusy(attachment.id || attachment.key || attachment.name)
    try {
      const url = await getTicketAttachmentDownloadUrl(ticket.id, attachment.id || attachment.key)
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadBusy('')
    }
  }

  return (
    <section className="ticket-processing-card">
      <div className="ticket-processing-head">
        <div>
          <span className="eyebrow">{admin ? 'TICKET PROCESSING' : 'TICKET DETAILS'}</span>
          <h2>{ticket.id} — {ticket.subject}</h2>
          <p>Customer: <strong>{formatIdentity(ticket.customerEmail, '—')}</strong></p>
        </div>
        <button type="button" className="secondary-button" onClick={onClose} disabled={saving || uploading}>Close panel</button>
      </div>

      <div className="ticket-processing-meta">
        <div><span>Created by</span><strong>{formatIdentity(ticket.createdByEmail || ticket.createdByUsername || ticket.createdBy || ticket.customerEmail, '—')}</strong></div>
        <div><span>Created</span><strong>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}</strong></div>
        <div><span>Updated by</span><strong>{formatIdentity(ticket.updatedByEmail || ticket.updatedByUsername || ticket.updatedBy, '—')}</strong></div>
        <div><span>Time to close</span><strong>{typeof ticket.timeSpentMinutes === 'number' ? `${Math.floor(ticket.timeSpentMinutes / 60)}h ${ticket.timeSpentMinutes % 60}m` : ticket.status === 'Closed' ? '—' : 'Not closed'}</strong></div>
      </div>

      <div className="ticket-processing-description">
        <span className="processing-label">Description</span>
        <p>{ticket.description || '—'}</p>
      </div>

      <div className="ticket-processing-form">
        <label>Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={saving || uploading || isClosed}>
            <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={saving || uploading || isClosed}>
            <option>Open</option><option>Acknowledged</option><option>In Progress</option><option>Pending Customer</option><option>Resolved</option><option>Closed</option>
          </select>
          <small>Set status to Closed here to close the ticket.</small>
        </label>
        <label className="comment-field">Add Comment
          <textarea rows="4" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Enter an update for the customer or internal processing note." disabled={saving || uploading || isClosed} />
        </label>
      </div>

      <div className="attachment-box">
        <span className="processing-label">Attachments</span>
        <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} disabled={saving || uploading || isClosed} />
        {files.length > 0 && <div className="selected-files">{files.map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>)}</div>}
        {uploadError && <div className="upload-error">{uploadError}</div>}
        {files.length > 0 && (
          <button type="button" className="secondary-button small-button" onClick={saveAttachments} disabled={uploading || saving || isClosed}>
            {uploading ? 'Uploading…' : 'Upload Files'}
          </button>
        )}
        {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
          <div className="attachment-list">
            {ticket.attachments.map((attachment) => (
              <div className="attachment-item" key={attachment.id || attachment.key || attachment.name}>
                <span>{attachment.name || attachment.fileName || 'Attachment'}</span>
                <button type="button" className="text-button" onClick={() => downloadAttachment(attachment)} disabled={downloadBusy === (attachment.id || attachment.key || attachment.name)}>
                  {downloadBusy === (attachment.id || attachment.key || attachment.name) ? 'Opening…' : 'Download'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {Array.isArray(ticket.comments) && ticket.comments.length > 0 && (
        <div className="ticket-comments">
          <span className="processing-label">Comments</span>
          {ticket.comments.map((item) => (
            <div className="comment-item" key={item.id || `${item.createdAt}-${item.createdBy}`}>
              <div><strong>{item.createdByEmail || item.createdByUsername || item.createdBy || 'Portal user'}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</small></div>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      )}

      {isClosed && (
        <div className="closed-ticket-note">This ticket is closed. No further ticket changes are allowed.</div>
      )}

      <div className="ticket-processing-actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={saving || uploading}>Cancel</button>
        <button type="button" className="primary-button" onClick={saveChanges} disabled={saving || uploading || (!comment.trim() && priority === ticket.priority && status === ticket.status)}>
          {saving ? 'Saving…' : 'Update Ticket'}
        </button>
      </div>
    </section>
  )
}


/* =========================================================
   PRIORITY / STATUS
========================================================= */

function Priority({
  value,
}) {

  return (

    <span
      className={`priority ${String(
        value
      ).toLowerCase()}`}
    >
      {value}
    </span>

  )
}


function Status({
  value,
}) {

  return (

    <span
      className={`status ${String(
        value
      )
        .toLowerCase()
        .replaceAll(' ', '-')}`}
    >
      {value}
    </span>

  )
}


/* =========================================================
   NEW TICKET
========================================================= */

function NewTicket({
  isAdmin = false,
  onCancel,
  onCreate,
}) {

  const [form, setForm] =
    useState({
      customerEmail: '',
      subject: '',
      category: categories[0],
      priority: 'Medium',
      description: '',
      files: [],
    })


  const [saving, setSaving] =
    useState(false)


  const submit = async (e) => {

    e.preventDefault()

    if (
      !form.subject.trim() ||
      !form.description.trim()
    ) {
      return
    }

    setSaving(true)

    try {

      await onCreate(form)

    } finally {

      setSaving(false)
    }
  }


  return (

    <section className="form-page">

      <div className="section-head page-head">

        <div>

          <span className="eyebrow">
            SUPPORT REQUEST
          </span>

          <h1>
            Raise a new ticket
          </h1>

          <p>
            Tell us what you need help with.
            Our support team will review the
            request and update the ticket.
          </p>

        </div>

      </div>


      <form
        className="form-card"
        onSubmit={submit}
      >

        {isAdmin && (
          <label>
            Customer Email
            <input
              type="email"
              value={form.customerEmail}
              onChange={(e) =>
                setForm({
                  ...form,
                  customerEmail: e.target.value,
                })
              }
              placeholder="customer@company.com"
              required
            />
            <small>Support Admins and Super Admins can create tickets on behalf of a customer.</small>
          </label>
        )}

        <div className="form-grid">

          <label>

            Subject

            <input
              value={form.subject}
              onChange={(e) =>
                setForm({
                  ...form,
                  subject:
                    e.target.value,
                })
              }
              placeholder="Briefly describe the issue"
              required
            />

          </label>


          <label>

            Category

            <select
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category:
                    e.target.value,
                })
              }
            >

              {categories.map(
                (c) => (
                  <option key={c}>
                    {c}
                  </option>
                )
              )}

            </select>

          </label>


          <label>

            Priority

            <select
              value={form.priority}
              onChange={(e) =>
                setForm({
                  ...form,
                  priority:
                    e.target.value,
                })
              }
            >

              <option>
                Low
              </option>

              <option>
                Medium
              </option>

              <option>
                High
              </option>

              <option>
                Critical
              </option>

            </select>

          </label>

        </div>


        <label>

          Description

          <textarea
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description:
                  e.target.value,
              })
            }
            rows="7"
            placeholder="Provide the details, error message, affected device/service, and any useful troubleshooting already completed."
            required
          />

        </label>

        <label>
          Attach Files
          <input
            type="file"
            multiple
            onChange={(e) =>
              setForm({
                ...form,
                files: Array.from(e.target.files || []),
              })
            }
          />
          <small>Attach screenshots, logs, documents or other files relevant to the ticket.</small>
          {form.files.length > 0 && (
            <div className="selected-files">
              {form.files.map((file) => (
                <span key={`${file.name}-${file.size}`}>{file.name}</span>
              ))}
            </div>
          )}
        </label>

        <div className="form-actions">

          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Cancel
          </button>


          <button
            className="primary-button"
            disabled={saving}
          >
            {saving
              ? 'Creating…'
              : 'Create ticket'}
          </button>

        </div>

      </form>

    </section>
  )
}


function exportTicketsToExcel(tickets) {
  const rows = tickets.map((ticket) => ({
    'Ticket ID': ticket.id || '',
    'Customer Email': ticket.customerEmail || '',
    'Subject': ticket.subject || '',
    'Category': ticket.category || '',
    'Priority': ticket.priority || '',
    'Status': ticket.status || '',
    'Created By': ticket.createdByEmail || ticket.createdByUsername || ticket.createdBy || '',
    'Created By Role': ticket.createdByRole || '',
    'Created At': ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '',
    'Updated At': ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : '',
    'Updated By': ticket.updatedBy || '',
    'Closed At': ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : '',
    'Time to Close': typeof ticket.timeSpentMinutes === 'number'
      ? `${Math.floor(ticket.timeSpentMinutes / 60)}h ${ticket.timeSpentMinutes % 60}m`
      : '',
    'Time to Close (Minutes)': typeof ticket.timeSpentMinutes === 'number'
      ? ticket.timeSpentMinutes
      : '',
    'Assigned To': ticket.assignedTo || '',
    'Description': ticket.description || '',
    'Comments': Array.isArray(ticket.comments)
      ? ticket.comments.map((comment) =>
          `${comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''} - ${comment.createdByEmail || comment.createdByUsername || comment.createdBy || ''}: ${comment.text || ''}`
        ).join('\n')
      : '',
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 16 }, { wch: 30 }, { wch: 32 }, { wch: 20 },
    { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 18 },
    { wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 22 },
    { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 60 }, { wch: 70 },
  ]

  const workbook = XLSX.utils.book_new()

  const closedTickets = tickets.filter(
    (ticket) => ticket.status === 'Closed'
  )
  const closeTimes = closedTickets
    .map((ticket) => ticket.timeSpentMinutes)
    .filter((value) => typeof value === 'number')
  const averageCloseMinutes = closeTimes.length
    ? Math.round(closeTimes.reduce((sum, value) => sum + value, 0) / closeTimes.length)
    : null

  const summaryRows = [
    { Metric: 'Report Generated', Value: new Date().toLocaleString() },
    { Metric: 'Total Tickets', Value: tickets.length },
    { Metric: 'Open / In Progress / Pending', Value: tickets.filter((ticket) => !['Resolved', 'Closed'].includes(ticket.status)).length },
    { Metric: 'Resolved', Value: tickets.filter((ticket) => ticket.status === 'Resolved').length },
    { Metric: 'Closed', Value: closedTickets.length },
    { Metric: 'High / Critical', Value: tickets.filter((ticket) => ['High', 'Critical'].includes(ticket.priority)).length },
    { Metric: 'Average Time to Close', Value: averageCloseMinutes === null ? '—' : `${Math.floor(averageCloseMinutes / 60)}h ${averageCloseMinutes % 60}m` },
  ]
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows)
  summarySheet['!cols'] = [{ wch: 34 }, { wch: 30 }]

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ticket Report')

  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('-')

  XLSX.writeFile(
    workbook,
    `ALTEKNETWORKS_Ticket_Report_${stamp}.xlsx`
  )
}


/* =========================================================
   ADMIN PANEL
========================================================= */

function AdminPanel({
  tickets,
  onUpdate,
  adminView,
  setAdminView,
  users,
  loadingUsers,
  onLoadUsers,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  actorRole,
  isSuperAdmin,
}) {

  const customers =
    new Set(
      tickets
        .map(
          (t) =>
            t.customerEmail
        )
        .filter(Boolean)
    ).size


  return (

    <>

      <section className="section-head page-head">

        <div>

          <span className="eyebrow">
            ADMINISTRATION
          </span>

          <h1>
            Support operations
          </h1>

          <p>
            {isSuperAdmin
              ? 'Manage support tickets and portal users.'
              : 'Process and manage customer support tickets.'}
          </p>

        </div>

      </section>


      <div className="stats-grid">

        <Stat
          label="Customers with tickets"
          value={customers}
        />

        <Stat
          label="Open queue"
          value={
            tickets.filter(
              (t) =>
                ![
                  'Resolved',
                  'Closed',
                ].includes(
                  t.status
                )
            ).length
          }
        />

        <Stat
          label="Critical / High"
          value={
            tickets.filter(
              (t) =>
                [
                  'Critical',
                  'High',
                ].includes(
                  t.priority
                )
            ).length
          }
        />

      </div>


      <div
        className="filter-row"
        style={{
          marginTop: '24px',
        }}
      >

        <button
          className={
            adminView === 'tickets'
              ? 'filter-active'
              : ''
          }
          onClick={() =>
            setAdminView('tickets')
          }
        >
          Ticket Management
        </button>


        {isSuperAdmin && (
          <button
            className={
              adminView === 'users'
                ? 'filter-active'
                : ''
            }
            onClick={() => {

              setAdminView('users')

              if (users.length === 0) {
                onLoadUsers()
              }

            }}
          >
            User Administration
          </button>
        )}

      </div>


      {adminView === 'tickets' && (

        <section>

          <section className="section-head">

            <div>

              <span className="eyebrow">
                QUEUE
              </span>

              <h2>
                Ticket management
              </h2>

            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => exportTicketsToExcel(tickets)}
              disabled={!tickets.length}
            >
              Export Excel Report
            </button>

          </section>


          {tickets.length ? (

            <TicketTable
              tickets={tickets}
              admin
              onUpdate={onUpdate}
            />

          ) : (

            <div className="empty-card">
              No tickets available.
            </div>

          )}

        </section>

      )}


      {adminView === 'users' && isSuperAdmin && (

        <UserAdministration
          users={users}
          loading={loadingUsers}
          actorRole={actorRole}
          isSuperAdmin={isSuperAdmin}
          onLoad={onLoadUsers}
          onCreate={onCreateUser}
          onUpdate={onUpdateUser}
          onDelete={onDeleteUser}
        />

      )}

    </>
  )
}


/* =========================================================
   USER ADMINISTRATION
========================================================= */

function UserAdministration({
  users,
  loading,
  actorRole,
  isSuperAdmin,
  onLoad,
  onCreate,
  onUpdate,
  onDelete,
}) {

  const [showCreate, setShowCreate] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [form, setForm] =
    useState({
      email: '',
      role: 'Customers',
      temporaryPassword: '',
    })

  const [actionUser, setActionUser] =
    useState(null)

  const resetForm = () => {
    setForm({
      email: '',
      role: 'Customers',
      temporaryPassword: '',
    })
  }

  const submitCreate = async (e) => {
    e.preventDefault()

    if (!form.email.trim()) {
      return
    }

    if (!form.temporaryPassword) {
      return
    }

    setSaving(true)

    try {
      await onCreate({
        email: form.email.trim().toLowerCase(),
        role: form.role,
        temporaryPassword: form.temporaryPassword,
      })

      resetForm()
      setShowCreate(false)
    } finally {
      setSaving(false)
    }
  }

  const canCreateRole = (role) =>
    canManageUserRole(
      actorRole,
      role
    )

  return (
    <section>

      <div className="section-head">

        <div>
          <span className="eyebrow">
            IDENTITY MANAGEMENT
          </span>

          <h2>
            Portal users
          </h2>

          <p>
            Create and manage customer and
            administrator portal accounts.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
          }}
        >
          <button
            className="secondary-button"
            onClick={onLoad}
            disabled={loading}
          >
            {loading
              ? 'Refreshing…'
              : 'Refresh'}
          </button>

          <button
            className="primary-button"
            onClick={() =>
              setShowCreate(
                (value) => !value
              )
            }
          >
            + Create User
          </button>
        </div>
      </div>

      {showCreate && (
        <form
          className="form-card"
          onSubmit={submitCreate}
          style={{
            marginBottom: '24px',
          }}
        >
          <h3>
            Create portal user
          </h3>

          <div className="form-grid">
            <label>
              Email Address
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                placeholder="customer@company.com"
                required
              />
            </label>

            <label>
              Role
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value,
                  })
                }
              >
                {USER_ROLES.map(
                  (role) =>
                    canCreateRole(role) && (
                      <option
                        key={role}
                        value={role}
                      >
                        {role}
                      </option>
                    )
                )}
              </select>
            </label>

            <label>
              Temporary Password
              <input
                type="password"
                value={form.temporaryPassword}
                onChange={(e) =>
                  setForm({
                    ...form,
                    temporaryPassword:
                      e.target.value,
                  })
                }
                placeholder="Enter temporary password"
                autoComplete="new-password"
                required
              />
              <small>
                User will be required to change this password after first login.
              </small>
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                resetForm()
                setShowCreate(false)
              }}
            >
              Cancel
            </button>

            <button
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? 'Creating…'
                : 'Create User'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty-card">
          Loading users…
        </div>
      ) : users.length === 0 ? (
        <div className="empty-card">
          No portal users found.
        </div>
      ) : (
        <div className="table-card">
          <div className="ticket-table">
            <div className="table-row table-head">
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
              <span>Cognito Status</span>
              <span>Created</span>
              <span>Action</span>
            </div>

            {users.map((item) => (
              <UserRow
                key={item.username}
                user={item}
                actorRole={actorRole}
                isSuperAdmin={isSuperAdmin}
                actionUser={actionUser}
                setActionUser={setActionUser}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}


/* =========================================================
   USER ROW
========================================================= */

function UserRow({
  user,
  actorRole,
  isSuperAdmin,
  actionUser,
  setActionUser,
  onUpdate,
  onDelete,
}) {

  const [showResetPassword, setShowResetPassword] =
    useState(false)

  const [temporaryPassword, setTemporaryPassword] =
    useState('')

  const [confirmTemporaryPassword, setConfirmTemporaryPassword] =
    useState('')

  const [resetPasswordError, setResetPasswordError] =
    useState('')

  const [resettingPassword, setResettingPassword] =
    useState(false)

  const userRole =
    user.role ||
    user.groups?.[0] ||
    'Customers'

  const canEditTarget =
    actorRole === 'SuperAdmins'

  const isEnabled =
    user.enabled !== false

  const closeResetForm = () => {
    setShowResetPassword(false)
    setTemporaryPassword('')
    setConfirmTemporaryPassword('')
    setResetPasswordError('')
  }

  const submitResetPassword = async () => {
    setResetPasswordError('')

    if (!temporaryPassword) {
      setResetPasswordError(
        'Please enter a temporary password.'
      )
      return
    }

    if (!confirmTemporaryPassword) {
      setResetPasswordError(
        'Please confirm the temporary password.'
      )
      return
    }

    if (
      temporaryPassword !==
      confirmTemporaryPassword
    ) {
      setResetPasswordError(
        'Temporary passwords do not match.'
      )
      return
    }

    setResettingPassword(true)

    try {
      const success = await onUpdate(
        user.username,
        {
          resetPassword: true,
          temporaryPassword,
        }
      )

      if (success !== false) {
        closeResetForm()
      }
    } finally {
      setResettingPassword(false)
    }
  }

  return (
    <div className="table-row">

      <span>
        <strong>
          {user.email}
        </strong>
        <small>
          {user.username}
        </small>
      </span>

      <span>
        <strong>
          {userRole}
        </strong>
      </span>

      <span>
        <span
          className={
            isEnabled
              ? 'status open'
              : 'status closed'
          }
        >
          {isEnabled
            ? 'Enabled'
            : 'Disabled'}
        </span>
      </span>

      <span>
        {user.status || '—'}
      </span>

      <span>
        {user.createdAt
          ? new Date(
              user.createdAt
            ).toLocaleDateString()
          : '—'}
      </span>

      <span>
        <button
          className="secondary-button"
          onClick={() =>
            setActionUser(
              actionUser === user.username
                ? null
                : user.username
            )
          }
        >
          Manage
        </button>
      </span>

      {actionUser === user.username && (
        <div
          style={{
            gridColumn: '1 / -1',
            padding: '16px 0',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >

          {canEditTarget && (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                onUpdate(
                  user.username,
                  {
                    enabled: !isEnabled,
                  }
                )
              }
            >
              {isEnabled
                ? 'Disable User'
                : 'Enable User'}
            </button>
          )}

          {canEditTarget && (
            <div
              style={{
                flexBasis: '100%',
              }}
            >
              {!showResetPassword ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setResetPasswordError('')
                    setTemporaryPassword('')
                    setConfirmTemporaryPassword('')
                    setShowResetPassword(true)
                  }}
                >
                  Reset Password
                </button>
              ) : (
                <div
                  className="form-card"
                  style={{
                    marginTop: '10px',
                    maxWidth: '560px',
                  }}
                >
                  <h3>
                    Reset Password
                  </h3>

                  <p>
                    Set a temporary password for {user.email}. The user will be required to create a new password at next login.
                  </p>

                  <div className="form-grid">
                    <label>
                      Temporary Password
                      <input
                        type="password"
                        value={temporaryPassword}
                        onChange={(e) => {
                          setTemporaryPassword(e.target.value)
                          setResetPasswordError('')
                        }}
                        placeholder="Enter temporary password"
                        autoComplete="new-password"
                        autoFocus
                        required
                      />
                    </label>

                    <label>
                      Confirm Temporary Password
                      <input
                        type="password"
                        value={confirmTemporaryPassword}
                        onChange={(e) => {
                          setConfirmTemporaryPassword(e.target.value)
                          setResetPasswordError('')
                        }}
                        placeholder="Confirm temporary password"
                        autoComplete="new-password"
                        required
                      />
                    </label>
                  </div>

                  {resetPasswordError && (
                    <div
                      className="login-error"
                      role="alert"
                      style={{
                        marginTop: '12px',
                      }}
                    >
                      {resetPasswordError}
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={closeResetForm}
                      disabled={resettingPassword}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={submitResetPassword}
                      disabled={resettingPassword}
                    >
                      {resettingPassword
                        ? 'Resetting…'
                        : 'Set Temporary Password'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isSuperAdmin && (
            <select
              value={userRole}
              onChange={(e) => {
                const newRole = e.target.value

                if (newRole === userRole) {
                  return
                }

                onUpdate(
                  user.username,
                  {
                    role: newRole,
                  }
                )
              }}
            >
              {USER_ROLES.map((role) => (
                <option
                  key={role}
                  value={role}
                >
                  {role}
                </option>
              ))}
            </select>
          )}

          {isSuperAdmin && (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                onDelete(
                  user.username,
                  user.email
                )
              }
            >
              Delete User
            </button>
          )}
        </div>
      )}
    </div>
  )
}


/* =========================================================
   RENDER
========================================================= */

ReactDOM
  .createRoot(
    document.getElementById('root')
  )
  .render(
    <App />
  )