Ledger Master + Chart of Accounts (Business Master, phase 3)

1. Supabase: run supabase/add_ledger_master.sql ONCE in the SQL editor (safe to re-run).
2. Copy the folders in this zip into the project (src, supabase, tests), then run:
       node apply-ledger-patch.mjs
   It adds the menu item, route, permissions and "npm test" script.
3. npm test        (unit tests for validation / tree / balances)
   npm run build
4. Sign in as admin and open "Ledger Master" in the sidebar.

If apply-ledger-patch.mjs cannot find a spot, add these by hand:
  src/lib/permissions.js  : 'ledgers.view': ALL, 'ledgers.write': WRITERS, 'ledgers.delete': ADMIN_ONLY,
                            'ledgers.groups': ADMIN_ONLY, 'ledgers.banking': ADMIN_ONLY, 'audit.view': ADMIN_ONLY
  src/App.jsx             : import LedgerMaster from './pages/LedgerMaster'
                            <Route path="/ledgers" element={<ProtectedRoute perm="ledgers.view"><LedgerMaster /></ProtectedRoute>} />
  src/components/Sidebar.jsx : { to: '/ledgers', label: 'Ledger Master', icon: BookOpen, perm: 'ledgers.view' }  (import BookOpen from lucide-react)
