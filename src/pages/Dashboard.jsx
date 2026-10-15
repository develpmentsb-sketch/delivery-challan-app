import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, CalendarClock, CalendarRange, FileCheck2, FileClock, FileX2, Plus
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import Header from '../components/Header'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { listRecentChallans, getDashboardStats } from '../services/challanService'
import { formatCurrency } from '../utils/calculations'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const PIE_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#F43F5E', '#06B6D4', '#A855F7']

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 8px 24px rgba(13,21,38,0.18)',
  fontSize: 12
}

// Keeps the last dashboard data (per user) so coming back to this page is instant;
// fresh data is still fetched every time and replaces it as soon as it arrives.
let dashboardCache = null

export default function Dashboard() {
  const toast = useToast()
  const { user } = useAuth()
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

  const cards = [
    { label: 'Total Delivery Challans', value: stats ? stats.total : '–', icon: FileText, grad: 'from-indigo-500 to-violet-600', glow: 'shadow-indigo-500/30' },
    { label: "Today's Challans", value: stats ? stats.today : '–', icon: CalendarClock, grad: 'from-amber-400 to-orange-500', glow: 'shadow-orange-500/30' },
    { label: "This Month's Challans", value: stats ? stats.thisMonth : '–', icon: CalendarRange, grad: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/30' },
    { label: 'E-Way Bills Generated', value: stats ? stats.ewayGenerated : '–', icon: FileCheck2, grad: 'from-sky-500 to-blue-600', glow: 'shadow-sky-500/30' },
    { label: 'Pending E-Way Bills', value: stats ? stats.ewayPending : '–', icon: FileClock, grad: 'from-fuchsia-500 to-pink-500', glow: 'shadow-pink-500/30' },
    { label: 'Cancelled Challans', value: stats ? stats.cancelled : '–', icon: FileX2, grad: 'from-rose-500 to-red-600', glow: 'shadow-rose-500/30' }
  ]

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Overview of your delivery challans and e-way bills"
        actions={
          <Link to="/challan/new" className="btn-gold">
            <Plus size={16} /> Create Delivery Challan
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`relative overflow-hidden rounded-2xl p-4 text-white bg-gradient-to-br shadow-lg ${c.grad} ${c.glow} transition-all duration-200 hover:-translate-y-1 hover:shadow-xl`}
          >
            <div className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/15" />
            <div className="pointer-events-none absolute -bottom-8 -right-2 h-16 w-16 rounded-full bg-white/10" />
            <div className="relative w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center mb-3">
              <c.icon size={18} />
            </div>
            <p className={`relative text-3xl font-bold ${stats ? '' : 'animate-pulse opacity-60'}`}>{c.value}</p>
            <p className="relative text-xs text-white/90 mt-1 leading-snug">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-navy mb-4 text-sm"><span className="mr-2 inline-block h-4 w-1.5 rounded-full bg-gradient-to-b from-indigo-500 to-cyan-400 align-middle" />Delivery Challans by Month</h3>
          {recentLoading ? (
            <div className="h-[240px] rounded-xl bg-navy-50/70 animate-pulse" />
          ) : monthlyChart.length === 0 ? (
            <EmptyState title="No data yet" description="Create a few delivery challans to see monthly trends." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyChart}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#D6DCEA" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="count" fill="url(#barGrad)" radius={[8, 8, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-navy mb-4 text-sm"><span className="mr-2 inline-block h-4 w-1.5 rounded-full bg-gradient-to-b from-fuchsia-500 to-amber-400 align-middle" />DC Status Split</h3>
          {recentLoading ? (
            <div className="h-[240px] rounded-xl bg-navy-50/70 animate-pulse" />
          ) : statusChart.length === 0 ? (
            <EmptyState title="No data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusChart}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={3}
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

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-100/70">
          <h3 className="font-semibold text-navy text-sm"><span className="mr-2 inline-block h-4 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-sky-400 align-middle" />Recent Delivery Challans</h3>
          <Link to="/master-list" className="text-xs font-semibold text-gold-600 hover:underline">View all</Link>
        </div>
        {recentLoading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-8 rounded-lg bg-navy-50/70 animate-pulse" />)}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title="No delivery challans yet"
            description="Create your first delivery challan to see it here."
            action={<Link to="/challan/new" className="btn-primary mt-2"><Plus size={16} /> Create Delivery Challan</Link>}
          />
        ) : (
          <div className="overflow-x-auto rounded-b-2xl">
            <table className="table-base table-accent">
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
