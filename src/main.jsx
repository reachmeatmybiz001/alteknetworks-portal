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
} from './ticketService'

import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  USER_ROLES,
  canManageUserRole,
} from './userService'

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
  'In Progress',
  'Pending Customer',
  'Resolved',
  'Closed',
]

const ADMIN_ROLES = [
  'SupportAdmins',
  'UserAdmins',
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
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [challenge, setChallenge] = useState('')
  const [newPassword, setNewPassword] = useState('')

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
        email,
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

    setSubmitting(true)

    try {

      await confirmSignIn({
        challengeResponse: newPassword,
      })

      setChallenge('')
      setNewPassword('')

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


  const isUserAdmin =
    user?.groups?.includes(
      'UserAdmins'
    )


  const isSupportAdmin =
    user?.groups?.includes(
      'SupportAdmins'
    )


  const actorRole =
    isSuperAdmin
      ? 'SuperAdmins'
      : isUserAdmin
        ? 'UserAdmins'
        : isSupportAdmin
          ? 'SupportAdmins'
          : 'Customers'


  /* =======================================================
     CREATE TICKET
  ======================================================= */

  const handleCreate = async (
    payload
  ) => {

    setError('')

    try {

      const ticket =
        await createTicket({
          ...payload,
          customerEmail:
            user.email,
        })

      setTickets(
        (current) => [
          ticket,
          ...current,
        ]
      )

      setNotice(
        `Ticket ${ticket.id} created successfully.`
      )

      setView('tickets')

    } catch (error) {

      setError(
        error?.message ||
        'Unable to create ticket.'
      )

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

    }
  }


  /* =======================================================
     LOAD USERS
  ======================================================= */

  const loadUsers = async () => {

    if (!isAdmin) return

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

      setNotice(
        'User updated successfully.'
      )

      await loadUsers()

    } catch (error) {

      setError(
        error?.message ||
        'Unable to update user.'
      )
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
                {isAdmin
                  ? 'Administrator'
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
}) {

  return (

    <>

      <section className="hero-card">

        <div>

          <span className="eyebrow">
            CUSTOMER DASHBOARD
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

          <button
            className="primary-button"
            onClick={onNew}
          >
            + Raise a new ticket
          </button>

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
        />

        <Stat
          label="Resolved / Closed"
          value={resolvedCount}
        />

        <Stat
          label="Total tickets"
          value={tickets.length}
        />

      </div>


      <section className="section-head">

        <div>

          <span className="eyebrow">
            RECENT ACTIVITY
          </span>

          <h2>
            Latest support requests
          </h2>

        </div>


        <button
          className="text-button"
          onClick={onTickets}
        >
          View all tickets →
        </button>

      </section>


      {loading ? (

        <div className="empty-card">
          Loading tickets…
        </div>

      ) : tickets.length ? (

        <TicketTable
          tickets={tickets.slice(0, 5)}
        />

      ) : (

        <div className="empty-card">

          <h3>
            No tickets yet
          </h3>

          <p>
            When you raise a support request,
            it will appear here.
          </p>

          <button
            className="secondary-button"
            onClick={onNew}
          >
            Raise your first ticket
          </button>

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
}) {

  return (

    <div className="stat-card">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>

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

  return (

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

          {admin && (
            <span>
              Action
            </span>
          )}

        </div>


        {tickets.map(
          (t) => (

            <div
              className="table-row"
              key={t.id}
            >

              <span className="ticket-id">
                {t.id}
              </span>


              <span>

                <strong>
                  {t.subject}
                </strong>

                <small>
                  {t.category}
                </small>

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
                {new Date(
                  t.updatedAt ||
                  t.createdAt
                ).toLocaleDateString()}
              </span>


              {admin && (

                <span>

                  <select
                    value={t.status}
                    onChange={(e) =>
                      onUpdate?.(
                        t.id,
                        {
                          status:
                            e.target.value,
                        }
                      )
                    }
                  >

                    <option>
                      Open
                    </option>

                    <option>
                      In Progress
                    </option>

                    <option>
                      Pending Customer
                    </option>

                    <option>
                      Resolved
                    </option>

                    <option>
                      Closed
                    </option>

                  </select>

                </span>

              )}

            </div>

          )
        )}

      </div>

    </div>
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
  onCancel,
  onCreate,
}) {

  const [form, setForm] =
    useState({
      subject: '',
      category: categories[0],
      priority: 'Medium',
      description: '',
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
            Manage customer support activity
            and portal users.
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


        <button
          className={
            adminView === 'users'
              ? 'filter-active'
              : ''
          }
          onClick={() => {

            setAdminView('users')

            if (
              users.length === 0
            ) {
              onLoadUsers()
            }

          }}
        >
          User Administration
        </button>

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


      {adminView === 'users' && (

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

  const [
    showCreate,
    setShowCreate,
  ] = useState(false)


  const [
    saving,
    setSaving,
  ] = useState(false)


  const [
    form,
    setForm,
  ] = useState({
    email: '',
    role: 'Customers',
  })


  const [
    actionUser,
    setActionUser,
  ] = useState(null)


  const resetForm = () => {

    setForm({
      email: '',
      role: 'Customers',
    })

  }


  const submitCreate = async (
    e
  ) => {

    e.preventDefault()

    if (!form.email.trim()) {
      return
    }

    setSaving(true)

    try {

      await onCreate({
        email:
          form.email.trim()
            .toLowerCase(),
        role: form.role,
      })

      resetForm()
      setShowCreate(false)

    } finally {

      setSaving(false)
    }
  }


  const canCreateRole =
    (role) =>
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
                    email:
                      e.target.value,
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
                    role:
                      e.target.value,
                  })
                }
              >

                {USER_ROLES.map(
                  (role) =>
                    canCreateRole(
                      role
                    ) && (
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

              <span>
                Email
              </span>

              <span>
                Role
              </span>

              <span>
                Status
              </span>

              <span>
                Cognito Status
              </span>

              <span>
                Created
              </span>

              <span>
                Action
              </span>

            </div>


            {users.map(
              (item) => (

                <UserRow
                  key={
                    item.username
                  }
                  user={item}
                  actorRole={actorRole}
                  isSuperAdmin={
                    isSuperAdmin
                  }
                  actionUser={
                    actionUser
                  }
                  setActionUser={
                    setActionUser
                  }
                  onUpdate={
                    onUpdate
                  }
                  onDelete={
                    onDelete
                  }
                />

              )
            )}

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

  const userRole =
    user.role ||
    user.groups?.[0] ||
    'Customers'


  const canChangeRole =
    canManageUserRole(
      actorRole,
      userRole
    )


  const canEditTarget =
    actorRole === 'SuperAdmins' ||
    (
      actorRole === 'UserAdmins' &&
      userRole === 'Customers'
    )


  const isEnabled =
    user.enabled !== false


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

        {user.status ||
          '—'}

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
              actionUser ===
                user.username
                ? null
                : user.username
            )
          }
        >
          Manage
        </button>

      </span>


      {actionUser ===
        user.username && (

        <div
          style={{
            gridColumn:
              '1 / -1',
            padding:
              '16px 0',
            display:
              'flex',
            gap: '10px',
            flexWrap:
              'wrap',
            alignItems:
              'center',
          }}
        >

          {canEditTarget && (

            <button
              className="secondary-button"
              onClick={() =>
                onUpdate(
                  user.username,
                  {
                    enabled:
                      !isEnabled,
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

            <button
              className="secondary-button"
              onClick={() =>
                onUpdate(
                  user.username,
                  {
                    resetPassword:
                      true,
                  }
                )
              }
            >
              Reset Password
            </button>

          )}


          {isSuperAdmin && (

            <select
              value={userRole}
              onChange={(e) => {

                const newRole =
                  e.target.value

                if (
                  newRole ===
                  userRole
                ) {
                  return
                }

                onUpdate(
                  user.username,
                  {
                    role:
                      newRole,
                  }
                )

              }}
            >

              {USER_ROLES.map(
                (role) => (

                  <option
                    key={role}
                    value={role}
                  >
                    {role}
                  </option>

                )
              )}

            </select>

          )}


          {isSuperAdmin && (

            <button
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
