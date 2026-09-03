import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import { signIn, signOut, getCurrentUser } from 'aws-amplify/auth'
import { config } from './config'
import { currentAuth, isAdminRole, primaryRole, ROLES } from './auth'
import * as api from './api'
import './styles.css'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.userPoolId,
      userPoolClientId: config.userPoolClientId,
    },
  },
})

const PERMISSIONS = {
  [ROLES.CUSTOMER]: { raise: true, own: true, all: false, update: false, assign: false, customerAdmin: false, adminRoles: false },
  [ROLES.SUPPORT_ADMIN]: { raise: true, own: true, all: true, update: true, assign: true, customerAdmin: false, adminRoles: false },
  [ROLES.USER_ADMIN]: { raise: true, own: true, all: true, update: true, assign: false, customerAdmin: true, adminRoles: false },
  [ROLES.SUPER_ADMIN]: { raise: true, own: true, all: true, update: true, assign: true, customerAdmin: true, adminRoles: true },
}

function roleLabel(role) {
  return ({ Customers: 'Customer', SupportAdmins: 'Support Admin', UserAdmins: 'User Admin', SuperAdmins: 'Super Admin' })[role] || role
}

function App() {
  const [auth, setAuth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginError, setLoginError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    getCurrentUser().then(() => currentAuth()).then(setAuth).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleLogin(event) {
    event.preventDefault()
    setLoginError('')
    setLoading(true)
    try {
      await signIn({ username: email.trim(), password, options: { authFlowType: 'USER_SRP_AUTH' } })
      setAuth(await currentAuth())
    } catch (error) {
      setLoginError(error?.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await signOut()
    setAuth(null)
  }

  if (loading) return <div className="center-screen"><div className="loader" />Loading portal…</div>
  if (!auth) return <Login email={email} password={password} showPassword={showPassword} setEmail={setEmail} setPassword={setPassword} setShowPassword={setShowPassword} error={loginError} onSubmit={handleLogin} />
  return <Portal auth={auth} onLogout={handleLogout} />
}

function Login({ email, password, showPassword, setEmail, setPassword, setShowPassword, error, onSubmit }) {
  return <div className="login-page">
    <div className="watermark">ALTEKNETWORKS IT SERVICES</div>
    <div className="login-card">
      <div className="brand-mark">ALTEKNETWORKS</div>
      <div className="brand-sub">IT SERVICES</div>
      <h1>CUSTOMER SUPPORT PORTAL</h1>
      <p className="muted">Secure access for customers and authorized administrators.</p>
      <form onSubmit={onSubmit}>
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="username" required />
        <label>Password</label>
        <div className="password-wrap">
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          <button type="button" className="show-btn" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="primary wide" type="submit">Sign In</button>
      </form>
    </div>
  </div>
}

function Portal({ auth, onLogout }) {
  const role = primaryRole(auth.groups)
  const permissions = PERMISSIONS[role]
  const [page, setPage] = useState('dashboard')
  const [notice, setNotice] = useState('')

  const pages = useMemo(() => {
    const base = [{ id: 'dashboard', label: 'Dashboard', icon: '⌂' }]
    if (permissions.raise) base.push({ id: 'tickets', label: 'Tickets', icon: '▤' })
    if (permissions.customerAdmin) base.push({ id: 'users', label: 'Customer Users', icon: '♙' })
    if (permissions.adminRoles) base.push({ id: 'roles', label: 'Admin Roles', icon: '⚙' })
    return base
  }, [permissions])

  useEffect(() => { if (!pages.some(p => p.id === page)) setPage('dashboard') }, [pages, page])

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="side-brand"><div>ALTEKNETWORKS</div><span>IT SERVICES</span></div>
      <div className="portal-title">SUPPORT PORTAL</div>
      <nav>{pages.map(p => <button key={p.id} className={page === p.id ? 'nav active' : 'nav'} onClick={() => setPage(p.id)}><span>{p.icon}</span>{p.label}</button>)}</nav>
      <div className="side-bottom">
        <div className="role-pill">{roleLabel(role)}</div>
        <div className="user-email">{auth.claims.email || auth.user?.username}</div>
        <button className="logout" onClick={onLogout}>Sign out</button>
      </div>
    </aside>
    <main className="content">
      <header className="topbar">
        <div><div className="eyebrow">ALTEKNETWORKS IT SERVICES</div><h2>{pages.find(p => p.id === page)?.label}</h2></div>
        <div className="top-role">{roleLabel(role)}</div>
      </header>
      {notice && <div className="notice">{notice}</div>}
      {page === 'dashboard' && <Dashboard role={role} permissions={permissions} setPage={setPage} />}
      {page === 'tickets' && <Tickets role={role} permissions={permissions} setNotice={setNotice} />}
      {page === 'users' && <Users role={role} setNotice={setNotice} />}
      {page === 'roles' && <Roles role={role} setNotice={setNotice} />}
    </main>
  </div>
}

function Dashboard({ role, permissions, setPage }) {
  const cards = role === ROLES.CUSTOMER ? [
    ['Raise a Ticket', 'Create a new support request.', 'tickets'],
    ['My Tickets', 'View tickets raised by you.', 'tickets'],
  ] : [
    ['Ticket Management', 'View and update support requests.', 'tickets'],
    ...(permissions.customerAdmin ? [['Customer Users', 'Create, disable, reset and delete customers.', 'users']] : []),
    ...(permissions.adminRoles ? [['Admin Roles', 'Create administrators and manage their roles.', 'roles']] : []),
  ]
  return <div>
    <section className="hero-card"><div><span className="hero-kicker">WELCOME</span><h1>{role === ROLES.CUSTOMER ? 'Welcome to your support portal' : `Welcome, ${roleLabel(role)}`}</h1><p>{role === ROLES.CUSTOMER ? 'Raise and track your IT support requests in one place.' : 'Use the functions available to your assigned role. Authorization is enforced by the backend.'}</p></div><div className="hero-icon">✓</div></section>
    <div className="stat-grid"><div className="stat"><span>Role</span><strong>{roleLabel(role)}</strong></div><div className="stat"><span>Access model</span><strong>Role-based</strong></div><div className="stat"><span>Portal</span><strong>portal.alteknetworks.com</strong></div></div>
    <h3 className="section-title">Available functions</h3>
    <div className="card-grid">{cards.map(([title, desc, target]) => <button className="feature-card" key={title} onClick={() => setPage(target)}><span className="feature-dot">✓</span><div><h3>{title}</h3><p>{desc}</p></div><span className="arrow">→</span></button>)}</div>
  </div>
}

function Tickets({ role, permissions, setNotice }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ subject: '', category: 'General', priority: 'Medium', description: '' })

  async function load() { setLoading(true); setError(''); try { setTickets(await api.listTickets()) } catch (e) { setError(e.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    try { await api.createTicket(form); setForm({ subject: '', category: 'General', priority: 'Medium', description: '' }); setFormOpen(false); setNotice('Ticket created successfully.'); load() } catch (e) { setError(e.message) }
  }

  async function update(id, changes) {
    try { await api.updateTicket(id, changes); setNotice('Ticket updated successfully.'); load() } catch (e) { setError(e.message) }
  }

  return <div>
    <div className="page-actions"><div><p className="muted">{permissions.all ? 'All tickets are visible to your role.' : 'Only your own tickets are visible.'}</p></div>{permissions.raise && <button className="primary" onClick={() => setFormOpen(v => !v)}>+ Raise Ticket</button>}</div>
    {formOpen && <form className="panel ticket-form" onSubmit={create}><h3>Raise a support ticket</h3><div className="form-grid"><label>Subject<input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required /></label><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option>General</option><option>Network</option><option>Security</option><option>Hardware</option><option>Software</option><option>Cloud</option></select></label><label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label></div><label>Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows="5" required /></label><button className="primary" type="submit">Submit Ticket</button></form>}
    {error && <div className="error panel">{error}</div>}
    <div className="panel"><div className="panel-head"><h3>Tickets</h3><button className="secondary" onClick={load}>Refresh</button></div>{loading ? <div className="empty">Loading…</div> : tickets.length === 0 ? <div className="empty">No tickets found.</div> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>Subject</th><th>Customer</th><th>Priority</th><th>Status</th><th>Created</th>{permissions.update && <th>Action</th>}</tr></thead><tbody>{tickets.map(t => <tr key={t.id}><td>{t.id}</td><td><strong>{t.subject}</strong><div className="small">{t.category}</div></td><td>{t.customerEmail}</td><td><span className={`priority ${String(t.priority).toLowerCase()}`}>{t.priority}</span></td><td><span className="status">{t.status}</span></td><td>{new Date(t.createdAt).toLocaleString()}</td>{permissions.update && <td><select value={t.status} onChange={e => update(t.id, { status: e.target.value })}><option>Open</option><option>In Progress</option><option>Pending Customer</option><option>Resolved</option><option>Closed</option></select>{permissions.assign && <select className="mini-select" value={t.assignedTo || ''} onChange={e => update(t.id, { assignedTo: e.target.value || null })}><option value="">Unassigned</option><option value="SupportAdmins">Support Queue</option><option value="SuperAdmins">Super Admin</option></select>}</td>}</tr>)}</tbody></table></div>}</div>
  </div>
}

function Users({ role, setNotice }) {
  const [users, setUsers] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ email: '', role: ROLES.CUSTOMER })
  const canCreateAdmin = role === ROLES.SUPER_ADMIN
  async function load() { setLoading(true); setError(''); try { setUsers(await api.listUsers()) } catch (e) { setError(e.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  async function create(e) { e.preventDefault(); try { await api.createUser(form); setForm({ email: '', role: ROLES.CUSTOMER }); setFormOpen(false); setNotice('User created and invitation sent.'); load() } catch (e) { setError(e.message) } }
  async function change(username, body, message) { try { await api.updateUser(username, body); setNotice(message); load() } catch (e) { setError(e.message) } }
  async function remove(username) { if (!confirm('Delete this customer user?')) return; try { await api.deleteUser(username); setNotice('Customer deleted.'); load() } catch (e) { setError(e.message) } }
  return <div><div className="page-actions"><div><p className="muted">User administration is restricted to User Admin and Super Admin. Backend authorization is authoritative.</p></div><button className="primary" onClick={() => setFormOpen(v => !v)}>+ Create User</button></div>{formOpen && <form className="panel inline-form" onSubmit={create}><label>Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label><label>Role<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value={ROLES.CUSTOMER}>Customer</option>{canCreateAdmin && <><option value={ROLES.SUPPORT_ADMIN}>Support Admin</option><option value={ROLES.USER_ADMIN}>User Admin</option></>}</select></label><button className="primary">Create</button></form>}{error && <div className="error panel">{error}</div>}<div className="panel"><div className="panel-head"><h3>Users</h3><button className="secondary" onClick={load}>Refresh</button></div>{loading ? <div className="empty">Loading…</div> : <div className="table-wrap"><table><thead><tr><th>Email</th><th>Status</th><th>Role</th><th>Actions</th></tr></thead><tbody>{users.map(u => <tr key={u.username}><td>{u.email || u.username}</td><td>{u.enabled ? 'Enabled' : 'Disabled'}</td><td><span className="role-tag">{roleLabel(u.role || ROLES.CUSTOMER)}</span></td><td className="actions"><button className="secondary" onClick={() => change(u.username, { resetPassword: true }, 'Password reset initiated.')}>Reset Password</button><button className="secondary" onClick={() => change(u.username, { enabled: !u.enabled }, u.enabled ? 'User disabled.' : 'User enabled.')}>{u.enabled ? 'Disable' : 'Enable'}</button>{(u.role === ROLES.CUSTOMER || !u.role) && <button className="danger" onClick={() => remove(u.username)}>Delete</button>}</td></tr>)}</tbody></table></div>}</div></div>
}

function Roles({ role, setNotice }) {
  const [users, setUsers] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  async function load() { setLoading(true); setError(''); try { setUsers((await api.listUsers()).filter(u => [ROLES.SUPPORT_ADMIN, ROLES.USER_ADMIN, ROLES.SUPER_ADMIN].includes(u.role))) } catch (e) { setError(e.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  async function change(username, newRole) { try { await api.updateUser(username, { role: newRole }); setNotice('Administrator role updated.'); load() } catch (e) { setError(e.message) } }
  if (role !== ROLES.SUPER_ADMIN) return <div className="panel error">Access denied. Only Super Admin can manage administrator roles.</div>
  return <div><div className="page-actions"><p className="muted">Only Super Admin can create, remove or change administrator roles.</p><button className="secondary" onClick={load}>Refresh</button></div>{error && <div className="error panel">{error}</div>}<div className="panel"><h3>Administrator roles</h3>{loading ? <div className="empty">Loading…</div> : <div className="table-wrap"><table><thead><tr><th>Email</th><th>Current Role</th><th>Change Role</th></tr></thead><tbody>{users.map(u => <tr key={u.username}><td>{u.email || u.username}</td><td><span className="role-tag">{roleLabel(u.role)}</span></td><td><select value={u.role} onChange={e => change(u.username, e.target.value)}><option value={ROLES.SUPPORT_ADMIN}>Support Admin</option><option value={ROLES.USER_ADMIN}>User Admin</option><option value={ROLES.SUPER_ADMIN}>Super Admin</option></select></td></tr>)}</tbody></table></div>}</div></div>
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
