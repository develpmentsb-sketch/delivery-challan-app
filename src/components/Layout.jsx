import { NavLink } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Layout({ children }) {
  const { session, role, isAdmin, signOut } = useAuth()
  return (
    <div className="shell">
      <aside className="side no-print">
        <h2>Delivery Challan</h2>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/challan/new">New Delivery Challan</NavLink>
          {isAdmin && <NavLink to="/settings">Settings</NavLink>}
        </nav>
        <div className="who">
          <small>{session?.user?.email}</small>
          <small className="badge">{role}</small>
          <button onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
