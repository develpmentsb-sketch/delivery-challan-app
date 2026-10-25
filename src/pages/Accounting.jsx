import React, { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { listLocations } from '../lib/locations'
import { getSettings, setupCompany, listGroups, listLedgers } from '../services/accountingService'
import { fyOf, fyRange, fyList } from '../utils/accounting'
import LedgersTab from './accounting/LedgersTab'
import VouchersTab from './accounting/VouchersTab'
import ReportsTab from './accounting/ReportsTab'
import InvoicesTab from './accounting/InvoicesTab'

const TABS = [['daybook', 'Day Book & Vouchers'], ['invoices', 'Sales & Purchase Invoices'], ['ledgers', 'Ledgers'], ['reports', 'Reports']]
const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

export default function Accounting() {
  const toast = useToast()
  const { can } = useAuth()
  const canWrite = can('accounts.write')
  const canDelete = can('accounts.delete')
  const [locations, setLocations] = useState([])
  const [company, setCompany] = useState('')
  const [settings, setSettings] = useState(null)
  const [groups, setGroups] = useState([])
  const [ledgers, setLedgers] = useState([])
  const [fy, setFy] = useState(fyOf(todayStr()))
  const [tab, setTab] = useState('daybook')
  const [loading, setLoading] = useState(true)
  const [booksStart, setBooksStart] = useState(fyRange(fyOf(todayStr())).from)
  const [settingUp, setSettingUp] = useState(false)

  useEffect(() => {
    listLocations().then((l) => { setLocations(l); if (l[0]) setCompany(l[0].id); else setLoading(false) })
      .catch((e) => { toast.error(e.message || 'Could not load companies'); setLoading(false) })
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
  useEffect(() => { loadCompany(company) }, [company]) // eslint-disable-line react-hooks/exhaustive-deps

  async function doSetup() {
    setSettingUp(true)
    try { await setupCompany(company, booksStart); toast.success('Accounts are ready'); await loadCompany(company) }
    catch (e) { toast.error(e.message || 'Setup failed') } finally { setSettingUp(false) }
  }

  const company_ = locations.find((l) => l.id === company)
  const companyName = company_ ? company_.legal_name || company_.location_name : ''
  const fys = useMemo(() => (settings ? fyList(settings.books_start, todayStr()) : []), [settings])

  return (
    <div>
      <Header
        title="Accounting"
        subtitle="Ledgers, vouchers, Trial Balance, Profit & Loss and Balance Sheet for each company"
        actions={
          <>
            <select className="input min-w-[220px]" value={company} onChange={(e) => setCompany(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.legal_name || l.location_name}</option>)}
            </select>
            {settings && (
              <select className="input w-32" value={fy} onChange={(e) => setFy(e.target.value)}>
                {fys.map((f) => <option key={f} value={f}>FY {f}</option>)}
              </select>
            )}
          </>
        }
      />

      {loading ? <LoadingSpinner /> : !company ? (
        <div className="card p-8 text-center text-sm text-navy-500">Add a company in Settings first.</div>
      ) : !settings ? (
        <div className="card mx-auto max-w-xl p-6">
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
          <div className="mb-4 flex flex-wrap gap-1 border-b border-navy-100">
            {TABS.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`-mb-px rounded-t-lg border px-4 py-2 text-sm font-semibold transition-colors ${tab === id ? 'border-navy-100 border-b-white bg-white text-navy' : 'border-transparent text-navy-400 hover:text-navy'}`}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'daybook' && <VouchersTab key={`${company}-${fy}`} company={company} fy={fy} groups={groups} ledgers={ledgers} canWrite={canWrite} canDelete={canDelete} />}
          {tab === 'invoices' && <InvoicesTab key={`${company}-${fy}`} company={company} companyInfo={company_} companyName={companyName} fy={fy} groups={groups} ledgers={ledgers} canWrite={canWrite} canDelete={canDelete} reload={() => loadCompany(company)} />}
          {tab === 'ledgers' && <LedgersTab company={company} groups={groups} ledgers={ledgers} canWrite={canWrite} canDelete={canDelete} reload={() => loadCompany(company)} />}
          {tab === 'reports' && <ReportsTab key={`${company}-${fy}`} company={company} companyName={companyName} fy={fy} settings={settings} groups={groups} ledgers={ledgers} canWrite={canWrite} />}
        </>
      )}
    </div>
  )
}
