import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'
import RequirePermission from './components/RequirePermission'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// Every other page is loaded only when it is opened, so the first screen downloads much less.
const pageLoaders = {
  DeliveryChallanForm: () => import('./pages/DeliveryChallanForm'),
  MasterList: () => import('./pages/MasterList'),
  ItemMaster: () => import('./pages/ItemMaster'),
  PartnerMaster: () => import('./pages/PartnerMaster'),
  LedgerMaster: () => import('./pages/LedgerMaster'),
  Settings: () => import('./pages/Settings'),
  BackupRestorePage: () => import('./pages/BackupRestore'),
  Users: () => import('./pages/Users'),
  Accounting: () => import('./pages/Accounting'),
  BusinessMaster: () => import('./pages/BusinessMaster')
}
const DeliveryChallanForm = lazy(pageLoaders.DeliveryChallanForm)
const MasterList = lazy(pageLoaders.MasterList)
const ItemMaster = lazy(pageLoaders.ItemMaster)
const PartnerMaster = lazy(pageLoaders.PartnerMaster)
const LedgerMaster = lazy(pageLoaders.LedgerMaster)
const Settings = lazy(pageLoaders.Settings)
const BackupRestorePage = lazy(pageLoaders.BackupRestorePage)
const Users = lazy(pageLoaders.Users)
const Accounting = lazy(pageLoaders.Accounting)
const BusinessMaster = lazy(pageLoaders.BusinessMaster)

// Once the signed-in page has shown, quietly fetch the pages used most so opening them feels instant.
function usePrefetchPages(enabled) {
  useEffect(() => {
    if (!enabled) return undefined
    const run = () => {
      ;['MasterList', 'DeliveryChallanForm', 'ItemMaster', 'PartnerMaster'].forEach((k) => {
        pageLoaders[k]().catch(() => {})
      })
    }
    const idle = window.requestIdleCallback
    const handle = idle ? idle(run, { timeout: 4000 }) : setTimeout(run, 2000)
    return () => { if (idle) window.cancelIdleCallback(handle); else clearTimeout(handle) }
  }, [enabled])
}

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
      <Suspense fallback={<LoadingSpinner label="Loading..." />}>
        {perm ? <RequirePermission perm={perm}>{children}</RequirePermission> : children}
      </Suspense>
    </Layout>
  )
}

export default function App() {
  const { session, loading, isAdmin } = useAuth()
  const location = useLocation()
  usePrefetchPages(!!session)
  // An admin who is already signed in may still open the login page to arrange the sign-in panel.
  const adminLayoutEdit = isAdmin && new URLSearchParams(location.search).get('layout') === 'edit'

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? null : session && !adminLayoutEdit ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/" element={<ProtectedRoute perm="dashboard.view"><Dashboard /></ProtectedRoute>} />
      <Route path="/challan/new" element={<ProtectedRoute perm="challan.create"><DeliveryChallanForm /></ProtectedRoute>} />
      <Route path="/challan/:id/edit" element={<ProtectedRoute perm="challan.edit"><DeliveryChallanForm /></ProtectedRoute>} />
      <Route path="/master-list" element={<ProtectedRoute perm="challan.view"><MasterList /></ProtectedRoute>} />
      <Route path="/items" element={<ProtectedRoute perm="items.view"><ItemMaster /></ProtectedRoute>} />
      <Route path="/partners" element={<ProtectedRoute perm="partners.view"><PartnerMaster key="Vendor" partnerType="Vendor" /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute perm="partners.view"><PartnerMaster key="Customer" partnerType="Customer" /></ProtectedRoute>} />
      <Route path="/accounting" element={<ProtectedRoute perm="accounts.view"><Accounting /></ProtectedRoute>} />
      <Route path="/business-master" element={<ProtectedRoute perm="accounts.view"><BusinessMaster /></ProtectedRoute>} />
      <Route path="/ledgers" element={<ProtectedRoute perm="ledgers.view"><LedgerMaster /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute perm="settings.view"><Settings /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute perm="users.approve"><Users /></ProtectedRoute>} />
      <Route path="/backup-restore" element={<ProtectedRoute perm="backup.use"><BackupRestorePage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
