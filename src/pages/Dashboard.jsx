import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, CalendarClock, CalendarRange, FileCheck2, FileClock, FileX2, Plus
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { listRecentChallans, getDashboardStats } from '../services/challanService'
import { formatCurrency } from '../utils/calculations'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const PIE_COLORS = ['#1B2A4A', '#5D73AB', '#C98A2C', '#2F6846', '#B23A34']

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid #D6DCEA',
  boxShadow: 'none',
  fontSize: 12
}

// Keeps the last dashboard data (per user) so coming back to this page is instant;
// fresh data is still fetched every time and replaces it as soon as it arrives.
let dashboardCache = null

function greetingFor(date) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const toast = useToast()
  const { user, profile } = useAuth()
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

  const monthlyChart = useMemo(() => {
    const map = {}
    recent.forEach((c) => {
      const key = c.dc_date?.slice(0, 7)
      if (!key) return
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month))
  }, [recent])

  const statusChart = useMemo(() => {
    const map = {}
    recent.forEach((c) => { map[c.dc_status] = (map[c.dc_status] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [recent])

  const now = new Date()
  const dateText = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const rawName = profile?.full_name || user?.email?.split('@')[0] || ''
  const firstName = rawName ? rawName.split(/[\s._-]+/)[0].replace(/^./, (ch) => ch.toUpperCase()) : ''

  const cards = [
    { label: 'Total Delivery Challans', value: stats ? stats.total : '–', icon: FileText },
    { label: "Today's Challans", value: stats ? stats.today : '–', icon: CalendarClock },
    { label: "This Month's Challans", value: stats ? stats.thisMonth : '–', icon: CalendarRange },
    { label: 'E-Way Bills Generated', value: stats ? stats.ewayGenerated : '–', icon: FileCheck2 },
    { label: 'Pending E-Way Bills', value: stats ? stats.ewayPending : '–', icon: FileClock },
    { label: 'Cancelled Challans', value: stats ? stats.cancelled : '–', icon: FileX2 }
  ]

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-5 lg:p-7">
      {/* Welcome banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-navy-100 bg-navy-50/50 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-400">Dashboard</p>
          <h1 className="mt-1 text-xl font-semibold text-navy">
            {greetingFor(now)}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-navy-400">
            {dateText}
            {stats && stats.ewayPending > 0 && (
              <> &middot; {stats.ewayPending} e-way bill{stats.ewayPending === 1 ? '' : 's'} pending</>
            )}
          </p>
        </div>
        <Link to="/challan/new" className="btn-primary">
          <Plus size={16} /> Create Delivery Challan
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-navy-100 bg-white p-4 transition-colors hover:border-navy-300">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs leading-snug text-navy-400">{c.label}</p>
              <c.icon size={16} className="mt-0.5 shrink-0 text-navy-300" />
            </div>
            <p className={`mt-3 text-2xl font-semibold text-navy ${stats ? '' : 'animate-pulse opacity-40'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-navy-100 bg-white p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-navy">Delivery Challans by Month</h3>
          {recentLoading ? (
            <div className="h-[240px] animate-pulse rounded-lg bg-navy-50/70" />
          ) : monthlyChart.length === 0 ? (
            <EmptyState title="No data yet" description="Create a few delivery challans to see monthly trends." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyChart}>
                <CartesianGrid stroke="#E5E9F2" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(27,42,74,0.04)' }} />
                <Bar dataKey="count" fill="#1B2A4A" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-navy-100 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-navy">DC Status Split</h3>
          {recentLoading ? (
            <div className="h-[240px] animate-pulse rounded-lg bg-navy-50/70" />
          ) : statusChart.length === 0 ? (
            <EmptyState title="No data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusChart}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {statusChart.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent challans */}
      <div className="rounded-xl border border-navy-100 bg-white">
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-navy">Recent Delivery Challans</h3>
          <Link to="/master-list" className="text-xs font-semibold text-navy-500 hover:text-navy hover:underline">View all</Link>
        </div>
        {recentLoading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-navy-50/70" />)}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title="No delivery challans yet"
            description="Create your first delivery challan to see it here."
            action={<Link to="/challan/new" className="btn-primary mt-2"><Plus size={16} /> Create Delivery Challan</Link>}
          />
        ) : (
          <div className="overflow-x-auto rounded-b-xl">
            <table className="table-base table-flat">
              <thead>
                <tr>
                  <th>DC No.</th><th>Date</th><th>Vendor</th><th className="text-right">Grand Total</th>
                  <th>Vehicle</th><th>E-Way Bill</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-navy">
                      <Link to={`/challan/${c.id}/edit`} className="hover:underline">{c.dc_number}</Link>
                    </td>
                    <td>{c.dc_date}</td>
                    <td>{c.partners?.name || c.bill_to_snapshot?.name || '-'}</td>
                    <td className="text-right">{formatCurrency(c.grand_total)}</td>
                    <td>{c.vehicle_number || '-'}</td>
                    <td><StatusBadge status={c.eway_bills?.[0]?.status || 'Not Generated'} /></td>
                    <td><StatusBadge status={c.dc_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
