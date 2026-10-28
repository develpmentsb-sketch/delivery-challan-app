import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ArrowRight } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { listRecentChallans, getDashboardStats } from '../services/challanService'
import { formatCurrency } from '../utils/calculations'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

// Keeps the last dashboard data (per user) so coming back to this page is instant;
// fresh data is still fetched every time and replaces it as soon as it arrives.
let dashboardCache = null

function greetingFor(date) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const num = (v) => (v === null || v === undefined ? '–' : Number(v).toLocaleString('en-IN'))

function fmtDate(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(String(d))) return d || '-'
  const dt = new Date(`${String(d).slice(0, 10)}T00:00:00`)
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// One cell in the summary strip. `dot` ties an e-way figure to its colour in the bar above it.
function Stat({ label, value, loading, dot, tone = 'text-navy' }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="flex items-center gap-2 text-xs text-navy-400">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </p>
      <p className={`mt-1.5 font-display text-3xl font-bold tabular-nums ${tone} ${loading ? 'animate-pulse opacity-30' : ''}`}>
        {value}
      </p>
    </div>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const { user, profile, can } = useAuth()
  const uid = user?.id
  const cached = dashboardCache && dashboardCache.uid === uid ? dashboardCache : null
  const [stats, setStats] = useState(cached?.stats || null)
  const [recent, setRecent] = useState(cached?.recent || [])
  const [recentLoading, setRecentLoading] = useState(!cached?.recent)

  useEffect(() => {
    let mounted = true
    const remember = (patch) => {
      dashboardCache = { ...(dashboardCache && dashboardCache.uid === uid ? dashboardCache : { uid }), ...patch }
    }

    // Stats and recent list load independently, so whichever is ready shows first.
    getDashboardStats()
      .then((s) => { if (!mounted) return; setStats(s); remember({ stats: s }) })
      .catch((err) => { if (mounted) toast.error(err.message || 'Failed to load dashboard') })

    listRecentChallans(8)
      .then((list) => { if (!mounted) return; const r = list.slice(0, 8); setRecent(r); remember({ recent: r }) })
      .catch((err) => { if (mounted) toast.error(err.message || 'Failed to load challans') })
      .finally(() => { if (mounted) setRecentLoading(false) })

    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const now = new Date()
  const dateText = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const rawName = profile?.full_name || user?.email?.split('@')[0] || ''
  const firstName = rawName ? rawName.split(/[\s._-]+/)[0].replace(/^./, (ch) => ch.toUpperCase()) : ''
  const loading = !stats

  // Share of all challans by e-way state, drawn as one bar. Anything else (drafts etc.) is the grey remainder.
  const total = stats?.total || 0
  const seg = (n) => (total > 0 ? Math.max(0, Math.min(100, (n / total) * 100)) : 0)
  const gen = seg(stats?.ewayGenerated || 0)
  const pend = seg(stats?.ewayPending || 0)
  const canc = seg(stats?.cancelled || 0)
  const pct = total > 0 ? Math.round(gen) : 0

  const pendingText = stats
    ? stats.ewayPending > 0
      ? `${stats.ewayPending} e-way bill${stats.ewayPending === 1 ? '' : 's'} still to generate.`
      : 'No e-way bills waiting.'
    : 'Loading your numbers...'

  return (
    <div className="mx-auto max-w-6xl">
      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {greetingFor(now)}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            {dateText}. <span className={stats?.ewayPending > 0 ? 'font-semibold text-amber-700' : ''}>{pendingText}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(!can || can('challan.view')) && (
            <Link to="/master-list" className="btn-outline bg-white">Master List</Link>
          )}
          {can && can('challan.create') && (
            <Link to="/challan/new" className="btn-primary"><Plus size={16} /> New challan</Link>
          )}
        </div>
      </div>

      {/* Summary: one panel, two groups, one bar */}
      <section className="card mt-6 overflow-hidden" aria-label="Summary">
        <div className="grid gap-px bg-navy-100/70 sm:grid-cols-2">
          <div>
            <p className="bg-white px-5 pt-4 text-sm font-semibold text-navy">Challans</p>
            <div className="grid grid-cols-3 gap-px bg-navy-100/70">
              <Stat label="Today" value={num(stats?.today)} loading={loading} />
              <Stat label="This month" value={num(stats?.thisMonth)} loading={loading} />
              <Stat label="All time" value={num(stats?.total)} loading={loading} />
            </div>
          </div>
          <div>
            <p className="bg-white px-5 pt-4 text-sm font-semibold text-navy">E-way bills</p>
            <div className="grid grid-cols-3 gap-px bg-navy-100/70">
              <Stat label="Generated" value={num(stats?.ewayGenerated)} loading={loading} dot="bg-teal-600" />
              <Stat
                label="Pending"
                value={num(stats?.ewayPending)}
                loading={loading}
                dot="bg-amber-500"
                tone={stats?.ewayPending > 0 ? 'text-amber-700' : 'text-navy'}
              />
              <Stat label="Cancelled" value={num(stats?.cancelled)} loading={loading} dot="bg-rose-500" />
            </div>
          </div>
        </div>

        <div className="border-t border-navy-100/70 bg-white px-5 py-4">
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-navy-100/80"
            role="img"
            aria-label={stats ? `${pct}% of ${total} challans have an e-way bill generated` : 'Loading'}
          >
            <span className="h-full bg-teal-600 transition-[width] duration-700" style={{ width: `${gen}%` }} />
            <span className="h-full bg-amber-500 transition-[width] duration-700" style={{ width: `${pend}%` }} />
            <span className="h-full bg-rose-500 transition-[width] duration-700" style={{ width: `${canc}%` }} />
          </div>
          <p className="mt-2 text-xs text-navy-400">
            {stats
              ? total > 0
                ? `${pct}% of ${num(total)} challans have an e-way bill generated.`
                : 'Nothing to show yet. Create a challan to start tracking e-way bills.'
              : ' '}
          </p>
        </div>
      </section>

      {/* Recent challans */}
      <section className="card mt-6 overflow-hidden" aria-label="Recent delivery challans">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold">Recent delivery challans</h2>
          <Link to="/master-list" className="flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {recentLoading ? (
          <div className="space-y-2 px-5 pb-5">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-navy-50/80" />)}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title="No delivery challans yet"
            description="Create your first delivery challan to see it here."
            action={can && !can('challan.create') ? null : <Link to="/challan/new" className="btn-primary mt-2"><Plus size={16} /> Create Delivery Challan</Link>}
          />
        ) : (
          <div className="overflow-x-auto border-t border-navy-100/70">
            <table className="table-base table-flat min-w-[640px]">
              <thead>
                <tr>
                  <th className="pl-5">Challan</th>
                  <th>Party</th>
                  <th className="hidden md:table-cell">Vehicle</th>
                  <th className="text-right">Amount</th>
                  <th>E-way bill</th>
                  <th className="pr-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap py-3 pl-5">
                      <Link to={`/challan/${c.id}/edit`} className="font-semibold text-navy hover:text-teal-700 hover:underline">{c.dc_number}</Link>
                      <p className="text-xs text-navy-400">{fmtDate(c.dc_date)}</p>
                    </td>
                    <td className="max-w-[16rem] truncate">{c.partners?.name || c.bill_to_snapshot?.name || '-'}</td>
                    <td className="hidden text-navy-500 md:table-cell">{c.vehicle_number || '-'}</td>
                    <td className="text-right font-semibold tabular-nums">{formatCurrency(c.grand_total)}</td>
                    <td><StatusBadge status={c.eway_bills?.[0]?.status || 'Not Generated'} /></td>
                    <td className="pr-5"><StatusBadge status={c.dc_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
