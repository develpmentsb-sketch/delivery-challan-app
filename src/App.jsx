import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DeliveryChallanForm from './pages/DeliveryChallanForm'
import Settings from './pages/Settings'

function Protected({ roles, children }) {
  const { session, role, loading } = useAuth()
  if (loading) return <p className="center">Loading…</p>
  if (!session) return <Navigate to="/login" replace />
  if (roles && !roles.includes(role)) return <p className="center">You don't have access to this page.</p>
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/challan/new" element={<Protected><DeliveryChallanForm /></Protected>} />
      <Route path="/challan/:id" element={<Protected><DeliveryChallanForm /></Protected>} />
      <Route path="/settings" element={<Protected roles={['admin']}><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
