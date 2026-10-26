import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import SapMenuBar from '../components/SapMenuBar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { listLocations } from '../lib/locations'
import { downloadOfflineBackup, downloadOfflineViewer } from '../lib/offlineBackup'
import { getSettings, setupCompany, listGroups, listLedgers } from '../services/accountingService'
import { fyOf, fyRange, fyList } from '../utils/accounting'
import LedgersTab from './accounting/LedgersTab'
import VouchersTab from './accounting/VouchersTab'
import ReportsTab from './accounting/ReportsTab'
import InvoicesTab from './accounting/InvoicesTab'

const WINDOWS = [['daybook', 'Day Book & Vouchers'], ['invoices', 'Sales & Purchase Invoices'], ['ledgers', 'Ledgers / Chart of Accounts'], ['reports', 'Reports']]
const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const REPORT_LIST = [['tb', 'Trial Balance'], ['pl', 'Trading & Profit and Loss'], ['bs', 'Balance Sheet'], ['cf', 'Cash Flow'], ['ratios', 'Key Ratios'], ['ledger', 'Ledger Statement']]

export default function Accounting() {
  const toast = useToast()
  const navigate = useNavigate()
  const { can, user, role } = useAuth()
  const canWrite = can('accounts.write')
  const canDelete = can('accounts.delete')
  const [locations, setLocations] = useState([])
  const [entered, setEntered] = useState(false) // false = the "Choose Company" screen
  const [company, setCompany] = useState('')
  const [settings, setSettings] = useState(null)
  const [groups, setGroups] = useState([])
  const [ledgers, setLedgers] = useState([])
  const [fy, setFy] = useState(fyOf(todayStr()))
  const [tab, setTab] = useState('daybook')
  const [loading, setLoading] = useState(true)
  const [booksStart, setBooksStart] = useState(fyRange(fyOf(todayStr())).from)
  const [settingUp, setSettingUp] = useState(false)
  const [invTarget, setInvTarget] = useState(null) // a Sales / Purchase voucher opened from the Day Book
  const [cmd, setCmd] = useState(null)             // a menu command waiting for its window to pick it up
  const [busy, setBusy] = useState('')
  const [about, setAbout] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    listLocations().then((l) => {
      setLocations(l)
      let last = ''
      try { last = sessionStorage.getItem('acc_company') || '' } catch (e) { /* ignore */ }
      setCompany(l.find((x) => x.id === last)?.id || l[0]?.id || '')
      if (l.length === 1) setEntered(true) // only one company: go straight in, no Choose Company screen
      setLoading(false)
    }).catch((e) => { toast.error(e.message || 'Could not load companies'); setLoading(false) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCompany(id = company) {
    if (!id) return
    setLoading(true)
    try {
      const [s, g, l] = await Promise.all([getSettings(id), listGroups(id), listLedgers(id)])
      setSettings(s && g.length ? s : null)
      setGroups(g); setLedgers(l)
      if (s && g.length) {
        const list = fyList(s.books_start, todayStr())
        setFy((cur) => (list.includes(cur) ? cur : list[0]))
      }
    } catch (e) { toast.error(e.message || 'Could not load the accounts') } finally { setLoading(false) }
  }
  useEffect(() => { if (entered) loadCompany(company) }, [company, entered]) // eslint-disable-line react-hooks/exhaustive-deps

  function chooseCompany() {
    try { sessionStorage.setItem('acc_company', company) } catch (e) { /* ignore */ }
    setSettings(null)
    setEntered(true)
  }

  async function doSetup() {
    setSettingUp(true)
    try { await setupCompany(company, booksStart); toast.success('Accounts are ready'); await loadCompany(company) }
    catch (e) { toast.error(e.message || 'Setup failed') } finally { setSettingUp(false) }
  }

  const company_ = locations.find((l) => l.id === company)
  const companyName = company_ ? company_.legal_name || company_.location_name : ''
  const fys = useMemo(() => (settings ? fyList(settings.books_start, todayStr()) : []), [settings])

  // Opens a window and hands it a command, e.g. run('daybook', { name: 'voucher', arg: 'Payment' })
  const run = (win, command) => { setTab(win); setCmd(command ? { ...command, nonce: Math.random() } : null) }
  const done = () => setCmd(null)

  async function doBackup() {
    setBusy('backup')
    toast.info('Preparing the backup file. This can take a moment...')
    try {
      const r = await downloadOfflineBackup({ userEmail: user?.email || '' })
      const n = Object.values(r.counts).reduce((s, x) => s + x, 0)
      toast.success(`Backup downloaded (${n} records). Open it with DC-Offline-Viewer.html.${r.skipped.length ? ` Not found: ${r.skipped.join(', ')}` : ''}`)
    } catch (e) { toast.error(e.message || 'Backup failed') } finally { setBusy('') }
  }
  async function doViewer() {
    try { await downloadOfflineViewer(); toast.success('Offline viewer downloaded') } catch (e) { toast.error(e.message) }
  }

  const needBooks = Boolean(settings)
  const menus = [
    { label: 'File', items: [
      ...(locations.length > 1 ? [{ label: 'Choose company...', onClick: () => setEntered(false) }, '-'] : []),
      { label: 'Download offline backup (.dcbackup)', onClick: doBackup, disabled: busy === 'backup' },
      { label: 'Download offline viewer', onClick: doViewer },
      '-',
      { label: 'Close accounting', onClick: () => navigate('/') }
    ] },
    { label: 'Edit', items: [
      ...['Payment', 'Receipt', 'Journal', 'Contra'].map((t) => ({ label: `New ${t} voucher`, disabled: !needBooks || !canWrite, onClick: () => run('daybook', { name: 'voucher', arg: t }) })),
      '-',
      { label: 'New Sales Invoice', disabled: !needBooks || !canWrite, onClick: () => run('invoices', { name: 'invoice', arg: 'Sales' }) },
      { label: 'New Purchase Invoice', disabled: !needBooks || !canWrite, onClick: () => run('invoices', { name: 'invoice', arg: 'Purchase' }) },
      '-',
      { label: 'New Ledger', disabled: !needBooks || !canWrite, onClick: () => run('ledgers', { name: 'newLedger' }) }
    ] },
    { label: 'View', items: [
      ...(fys.length ? fys.map((f) => ({ label: `Financial year ${f}`, check: f === fy, onClick: () => setFy(f) })) : [{ label: 'Set up the accounts first', disabled: true }]),
      '-',
      { label: 'Refresh', onClick: () => { loadCompany(company); setRefresh((n) => n + 1) } }
    ] },
    { label: 'Data', items: [
      { label: 'Sync customers & vendors to ledgers', disabled: !needBooks || !canWrite, onClick: () => run('ledgers', { name: 'sync' }) },
      { label: 'Download offline backup (.dcbackup)', onClick: doBackup, disabled: busy === 'backup' }
    ] },
    { label: 'Go To', items: [
      { label: 'Dashboard', onClick: () => navigate('/') },
      { label: 'Master List', onClick: () => navigate('/master-list') },
      { label: 'Item List', onClick: () => navigate('/items') },
      { label: 'Vendor Master', onClick: () => navigate('/partners') },
      { label: 'Customer Master', onClick: () => navigate('/customers') },
      { label: 'Business Master', onClick: () => navigate('/business-master') }
    ] },
    { label: 'Modules', items: [
      { header: true, label: 'Financials' },
      { label: 'Day Book & Vouchers', disabled: !needBooks, onClick: () => run('daybook') },
      { label: 'Ledgers / Chart of Accounts', disabled: !needBooks, onClick: () => run('ledgers') },
      { header: true, label: 'Sales - A/R' },
      { label: 'Sales Invoices', disabled: !needBooks, onClick: () => run('invoices', { name: 'noop' }) },
      { header: true, label: 'Purchasing - A/P' },
      { label: 'Purchase Invoices', disabled: !needBooks, onClick: () => run('invoices', { name: 'noop' }) },
      { header: true, label: 'Business Partners' },
      { label: 'Business Master', onClick: () => navigate('/business-master') },
      { label: 'Customer Master', onClick: () => navigate('/customers') },
      { label: 'Vendor Master', onClick: () => navigate('/partners') },
      { header: true, label: 'Financial Reports' },
      ...REPORT_LIST.map(([k, n]) => ({ label: n, disabled: !needBooks, onClick: () => run('reports', { name: 'report', arg: k }) }))
    ] },
    { label: 'Tools', items: [
      { label: 'Settings', onClick: () => navigate('/settings') },
      { label: 'Backup / Restore', disabled: !can('backup.use'), onClick: () => navigate('/backup-restore') }
    ] },
    { label: 'Window', items: [
      ...WINDOWS.map(([id, label]) => ({ label, check: tab === id, disabled: !needBooks, onClick: () => run(id) }))
    ] },
    { label: 'Help', items: [{ label: 'About this module', onClick: () => setAbout(true) }] }
  ]

  // ---------------- Choose Company ----------------
  if (!entered) {
    return (
      <div className="-m-1 flex min-h-[78vh] items-center justify-center rounded-xl bg-[#44617a] p-4">
        <div className="flex w-full max-w-3xl overflow-hidden border-t-[3px] border-[#f0ab00] bg-white shadow-2xl">
          <div className="hidden flex-1 flex-col justify-end bg-gradient-to-br from-[#16314d] via-[#1f6f8b] to-[#e48a1e] p-8 text-white md:flex">
            <p className="text-3xl font-bold">DC &amp; E-Way Bill</p>
            <p className="mt-1 text-lg opacity-90">Accounting</p>
          </div>
          <div className="flex flex-1 flex-col justify-center px-8 py-12">
            <h2 className="mb-5 text-center text-2xl font-normal text-[#2a3a4a]">Choose Company</h2>
            {loading ? <LoadingSpinner /> : !locations.length ? (
              <p className="text-center text-sm text-navy-500">Add a company in Settings first.</p>
            ) : (
              <>
                <select className="input !py-3 text-sm" value={company} onChange={(e) => setCompany(e.target.value)}>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.legal_name || l.location_name}</option>)}
                </select>
                <button className="mt-4 rounded bg-[#0070f2] py-3 text-sm font-bold text-white hover:bg-[#005fcc]" onClick={chooseCompany}>OK</button>
                <button className="mt-3 text-xs text-navy-400 hover:text-navy" onClick={() => navigate('/')}>Cancel</button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------------- Workspace ----------------
  return (
    <div className="overflow-hidden rounded-xl border border-[#b9c7d6] bg-[#e9eef3] shadow">
      <SapMenuBar menus={menus} right={companyName} />
      <div className="flex gap-0.5 overflow-x-auto bg-[#cdd8e3] px-2 pt-1.5">
        {WINDOWS.map(([id, label]) => (
          <button key={id} disabled={!needBooks} onClick={() => run(id)}
            className={`whitespace-nowrap rounded-t px-4 py-1.5 text-[13px] ${tab === id ? 'border-t-2 border-[#f0ab00] bg-white font-semibold text-[#16314d]' : 'bg-[#e1e9f1] text-[#456] hover:bg-[#eef3f8]'} disabled:opacity-50`}>
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-[60vh] bg-white p-4">
        {loading ? <LoadingSpinner /> : !company ? (
          <div className="p-8 text-center text-sm text-navy-500">Add a company in Settings first.</div>
        ) : !settings ? (
          <div className="mx-auto max-w-xl rounded-lg border border-navy-100 p-6">
            <h3 className="font-display text-lg font-bold text-navy">Set up accounts for {companyName}</h3>
            <p className="mt-1 text-sm text-navy-500">This creates the standard account groups (Capital, Loans, Current Assets, Sales, Purchases, Expenses and so on) and a Cash ledger.</p>
            {canWrite ? (
              <>
                <label className="label mt-4">Books start date (opening balances are as on this date)</label>
                <input type="date" className="input max-w-xs" value={booksStart} onChange={(e) => setBooksStart(e.target.value)} />
                <p className="mt-1 text-xs text-navy-400">Use 1 April of the year you start entering accounts. You can't enter vouchers before this date.</p>
                <button className="btn-primary mt-4" disabled={settingUp || !booksStart} onClick={doSetup}>
                  {settingUp ? <Loader2 size={16} className="animate-spin" /> : null} Set up accounts
                </button>
              </>
            ) : <p className="mt-3 text-sm text-brick">Ask an admin or operator to set up the accounts.</p>}
          </div>
        ) : (
          <>
            {tab === 'daybook' && <VouchersTab key={`${company}-${fy}-${refresh}`} company={company} fy={fy} groups={groups} ledgers={ledgers} canWrite={canWrite} canDelete={canDelete} onOpenInvoice={(v) => { setInvTarget(v); setTab('invoices') }} command={cmd} onCommandDone={done} />}
            {tab === 'invoices' && <InvoicesTab key={`${company}-${fy}-${refresh}`} company={company} companyInfo={company_} companyName={companyName} fy={fy} groups={groups} ledgers={ledgers} canWrite={canWrite} canDelete={canDelete} reload={() => loadCompany(company)} target={invTarget} clearTarget={() => setInvTarget(null)} command={cmd} onCommandDone={done} />}
            {tab === 'ledgers' && <LedgersTab company={company} groups={groups} ledgers={ledgers} canWrite={canWrite} canDelete={canDelete} reload={() => loadCompany(company)} command={cmd} onCommandDone={done} />}
            {tab === 'reports' && <ReportsTab key={`${company}-${fy}-${refresh}`} company={company} companyName={companyName} fy={fy} settings={settings} groups={groups} ledgers={ledgers} canWrite={canWrite} command={cmd} onCommandDone={done} />}
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 bg-[#2d4d6f] px-3 py-1 text-xs text-white/90">
        <span>{companyName}</span>{settings && <span>FY {fy}</span>}<span>{user?.email}</span><span>{role}</span>
        <span className="flex-1" />{busy === 'backup' && <span>Preparing backup...</span>}
      </div>

      {about && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4" onClick={() => setAbout(false)}>
          <div className="max-w-md border-t-[3px] border-[#f0ab00] bg-white p-6 text-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-semibold text-navy">Accounting</h3>
            <p className="text-navy-500">Each company keeps its own books. Use <b>File &gt; Download offline backup</b> to save everything in one .dcbackup file, and open it with <b>DC-Offline-Viewer.html</b> on any PC without internet.</p>
            <button className="btn-primary mt-4" onClick={() => setAbout(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
