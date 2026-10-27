// Adds the Ledger Master menu item, route, permissions and "npm test" script to an existing project.
// Usage (from the project folder):  node apply-ledger-patch.mjs [project-folder]
// Safe to run more than once. It only inserts a few lines and keeps each file's line endings.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.argv[2] || '.')
let failed = 0

function edit(rel, fn) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) { console.log(`SKIP  ${rel} (not found)`); failed++; return }
  const raw = fs.readFileSync(file, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const text = raw.replace(/\r\n/g, '\n')
  const out = fn(text)
  if (out === null) { console.log(`OK    ${rel} (already patched)`); return }
  if (out === false) { failed++; return }
  fs.writeFileSync(file, out.replace(/\n/g, eol))
  console.log(`PATCH ${rel}`)
}

const manual = (rel, what) => console.log(`FAIL  ${rel}: could not find the place to ${what}. Add it by hand (see README-ledger.txt).`)

edit('src/lib/permissions.js', (t) => {
  if (t.includes("'ledgers.view'")) return null
  const m = t.match(/^(\s*)'partners\.delete':.*\n/m)
  if (!m) { manual('src/lib/permissions.js', 'add the ledger permissions'); return false }
  const add =
`
  'ledgers.view': ALL,
  'ledgers.write': WRITERS,        // create / edit / deactivate ledgers
  'ledgers.delete': ADMIN_ONLY,
  'ledgers.groups': ADMIN_ONLY,    // add / edit / delete account groups
  'ledgers.banking': ADMIN_ONLY,   // see and edit bank account numbers and IFSC
  'audit.view': ADMIN_ONLY,        // read the audit history
`
  return t.replace(m[0], m[0] + add)
})

edit('src/App.jsx', (t) => {
  if (t.includes('LedgerMaster')) return null
  const imp = t.match(/^import PartnerMaster from .*\n/m)
  const route = t.match(/^\s*<Route path="\/settings".*\n/m)
  if (!imp || !route) { manual('src/App.jsx', 'add the /ledgers route'); return false }
  let out = t.replace(imp[0], imp[0] + "import LedgerMaster from './pages/LedgerMaster'\n")
  out = out.replace(route[0], `      <Route path="/ledgers" element={<ProtectedRoute perm="ledgers.view"><LedgerMaster /></ProtectedRoute>} />\n` + route[0])
  return out
})

edit('src/components/Sidebar.jsx', (t) => {
  if (t.includes("'/ledgers'")) return null
  const lucide = t.match(/import \{([^}]*)\} from 'lucide-react'/)
  const partners = t.match(/^(\s*)\{ to: '\/partners'.*\}(,?)\n/m)
  if (!lucide || !partners) { manual('src/components/Sidebar.jsx', 'add the Ledger Master menu item'); return false }
  let out = t
  if (!/\bBookOpen\b/.test(lucide[1])) out = out.replace(lucide[0], lucide[0].replace('import {', 'import { BookOpen,'))
  const line = partners[0]
  const withComma = line.replace(/\},?\n$/, '},\n')
  const item = `${partners[1]}{ to: '/ledgers', label: 'Ledger Master', icon: BookOpen, perm: 'ledgers.view' }`
  const next = partners[2] ? item + ',\n' : item + '\n'
  return out.replace(line, withComma + next)
})

edit('package.json', (t) => {
  if (/"test"\s*:/.test(t)) return null
  const m = t.match(/^(\s*)"scripts":\s*\{\n/m)
  if (!m) { manual('package.json', 'add the "test" script'); return false }
  return t.replace(m[0], m[0] + `${m[1]}  "test": "node --test",\n`)
})

console.log(failed ? '\nSome files need a manual edit.' : '\nDone. Now run: npm run build')
process.exit(failed ? 1 : 0)
