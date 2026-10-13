import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'
import RequirePermission from './components/RequirePermission'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DeliveryChallanForm from './pages/DeliveryChallanForm'
import MasterList from './pages/MasterList'
import ItemMaster from './pages/ItemMaster'
import PartnerMaster from './pages/PartnerMaster'
import Settings from './pages/Settings'
import BackupRestorePage from './pages/BackupRestore'
import Users from './pages/Users'

// `perm` (optional) = permission required to open the page, see src/lib/permissions.js
function ProtectedRoute({ children, perm }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-200">
        <LoadingSpinner label="Checking session..." />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return (
    <Layout>
      {perm ? <RequirePermission perm={perm}>{children}</RequirePermission> : children}
    </Layout>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? null : session ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/" element={<ProtectedRoute perm="dashboard.view"><Dashboard /></ProtectedRoute>} />
      <Route path="/challan/new" element={<ProtectedRoute perm="challan.create"><DeliveryChallanForm /></ProtectedRoute>} />
      <Route path="/challan/:id/edit" element={<ProtectedRoute perm="challan.edit"><DeliveryChallanForm /></ProtectedRoute>} />
      <Route path="/master-list" element={<ProtectedRoute perm="challan.view"><MasterList /></ProtectedRoute>} />
      <Route path="/items" element={<ProtectedRoute perm="items.view"><ItemMaster /></ProtectedRoute>} />
      <Route path="/partners" element={<ProtectedRoute perm="partners.view"><PartnerMaster /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute perm="settings.view"><Settings /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute perm="users.manage"><Users /></ProtectedRoute>} />
      <Route path="/backup-restore" element={<ProtectedRoute perm="backup.use"><BackupRestorePage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
