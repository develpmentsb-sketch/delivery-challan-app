import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, CalendarClock, CalendarRange, FileCheck2, FileClock, FileX2, Plus,
  Truck, ArrowRight, Package, Users, ListOrdered
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { listRecentChallans, getDashboardStats } from '../services/challanService'
import { formatCurrency } from '../utils/calculations'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import heroImg from '../assets/bg-blur.jpg'

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 8px 24px rgba(15,26,53,0.15)',
  fontSize: 12
}

const STATUS_BAR_COLORS = ['bg-teal-500', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500']

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

  const monthlyChart = useMemo(() => {
    const map = {}
    recent.forEach((c) => {
      const key = c.dc_date?.slice(0, 7)
      if (!key) return
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month))
  }, [recent])

  const statusList = useMemo(() => {
    const map = {}
    recent.forEach((c) => { map[c.dc_status] = (map[c.dc_status] || 0) + 1 })
    const total = recent.length || 1
    return Object.entries(map).map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }))
  }, [recent])

  const now = new Date()
  const dateText = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const rawName = profile?.full_name || user?.email?.split('@')[0] || ''
  const firstName = rawName ? rawName.split(/[\s._-]+/)[0].replace(/^./, (ch) => ch.toUpperCase()) : ''

  const cards = [
    { label: 'Total Challans', value: stats ? stats.total : '–', icon: FileText, tone: 'bg-sky-50 text-sky-600' },
    { label: "Today's Challans", value: stats ? stats.today : '–', icon: CalendarClock, tone: 'bg-cyan-50 text-cyan-600' },
    { label: "This Month's", value: stats ? stats.thisMonth : '–', icon: CalendarRange, tone: 'bg-teal-50 text-teal-600' },
    { label: 'E-Way Generated', value: stats ? stats.ewayGenerated : '–', icon: FileCheck2, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'E-Way Pending', value: stats ? stats.ewayPending : '–', icon: FileClock, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Cancelled', value: stats ? stats.cancelled : '–', icon: FileX2, tone: 'bg-rose-50 text-rose-600' }
  ]

  const quickActions = [
    { to: '/challan/new', label: 'Create Delivery Challan', icon: Plus, perm: 'challan.create' },
    { to: '/master-list', label: 'Open Master List', icon: ListOrdered, perm: 'challan.view' },
    { to: '/items', label: 'Manage Items', icon: Package, perm: 'items.view' },
    { to: '/partners', label: 'Manage Vendors', icon: Users, perm: 'partners.view' }
  ].filter((a) => !can || can(a.perm))

  const ewayTotal = stats ? (Number(stats.ewayGenerated) || 0) + (Number(stats.ewayPending) || 0) : 0
  const ewayGenPct = ewayTotal ? Math.round(((Number(stats.ewayGenerated) || 0) / ewayTotal) * 100) : 0

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl px-7 pb-20 pt-8 text-white lg:px-10 lg:pb-24 lg:pt-10">
        <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-sky-900/90 via-cyan-800/80 to-teal-700/70" />
        <Truck size={200} className="pointer-events-none absolute -bottom-8 -right-6 text-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{dateText}</p>
            <h1 className="mt-2 text-3xl font-bold text-white">
              {greetingFor(now)}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {stats
                ? stats.ewayPending > 0
                  ? `You have ${stats.ewayPending} pending e-way bill${stats.ewayPending === 1 ? '' : 's'} to generate.`
                  : 'All caught up. No pending e-way bills.'
                : 'Loading your numbers...'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(!can || can('challan.create')) && (
              <Link to="/challan/new" className="btn bg-white text-sky-900 hover:bg-white/90">
                <Plus size={16} /> Create Delivery Challan
              </Link>
            )}
            {(!can || can('challan.view')) && (
              <Link to="/master-list" className="btn border border-white/40 text-white hover:bg-white/10">
                Master List <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPI cards overlapping the hero */}
      <div className="relative z-10 -mt-12 grid grid-cols-2 gap-4 px-3 md:grid-cols-3 lg:px-6 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white bg-white p-4 shadow-lg shadow-slate-900/5 transition-transform duration-200 hover:-translate-y-0.5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${c.tone}`}>
              <c.icon size={18} />
            </div>
            <p className={`mt-3 text-3xl font-bold text-navy ${stats ? '' : 'animate-pulse opacity-40'}`}>{c.value}</p>
            <p className="mt-0.5 text-xs text-navy-400">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Chart + side panels */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy">Challans by month</h3>
            <span className="text-xs text-navy-400">Latest 8 challans</span>
          </div>
          {recentLoading ? (
            <div className="h-[250px] animate-pulse rounded-xl bg-navy-50/70" />
          ) : monthlyChart.length === 0 ? (
            <EmptyState title="No data yet" description="Create a few delivery challans to see monthly trends." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyChart}>
                <defs>
                  <linearGradient id="tealBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2DD4BF" />
                    <stop offset="100%" stopColor="#0E7490" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(14,116,144,0.06)' }} />
                <Bar dataKey="count" fill="url(#tealBar)" radius={[10, 10, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-3 text-sm font-semibold text-navy">Quick actions</h3>
            <div className="space-y-2">
              {quickActions.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="group flex items-center justify-between rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm font-medium text-navy transition-colors hover:border-teal-300 hover:bg-teal-50/60"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                      <a.icon size={15} />
                    </span>
                    {a.label}
                  </span>
                  <ArrowRight size={15} className="text-navy-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-3 text-sm font-semibold text-navy">E-way bill progress</h3>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-100">
              <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all" style={{ width: `${ewayGenPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-navy-400">
              {stats ? `${stats.ewayGenerated} generated, ${stats.ewayPending} pending` : 'Loading...'}
            </p>

            <h3 className="mb-2 mt-5 text-sm font-semibold text-navy">Challan status</h3>
            {recentLoading ? (
              <div className="h-16 animate-pulse rounded-xl bg-navy-50/70" />
            ) : statusList.length === 0 ? (
              <p className="text-xs text-navy-400">No data yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {statusList.map((s, i) => (
                  <li key={s.name}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-navy">{s.name}</span>
                      <span className="text-navy-400">{s.value}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-50">
                      <div className={`h-full rounded-full ${STATUS_BAR_COLORS[i % STATUS_BAR_COLORS.length]}`} style={{ width: `${s.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Recent challans as a list */}
      <div className="card mt-6">
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className="text-sm font-semibold text-navy">Recent delivery challans</h3>
          <Link to="/master-list" className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">
            View all <ArrowRight size={13} />
          </Link>
        </div>
        {recentLoading ? (
          <div className="space-y-3 px-6 pb-6">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-navy-50/70" />)}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title="No delivery challans yet"
            description="Create your first delivery challan to see it here."
            action={<Link to="/challan/new" className="btn-primary mt-2"><Plus size={16} /> Create Delivery Challan</Link>}
          />
        ) : (
          <ul className="divide-y divide-navy-100/70 border-t border-navy-100/70">
            {recent.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3.5 transition-colors hover:bg-sky-50/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <FileText size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/challan/${c.id}/edit`} className="font-semibold text-navy hover:underline">{c.dc_number}</Link>
                  <p className="truncate text-xs text-navy-400">
                    {c.partners?.name || c.bill_to_snapshot?.name || '-'} &middot; {c.dc_date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-navy">{formatCurrency(c.grand_total)}</p>
                  <p className="text-xs text-navy-400">{c.vehicle_number || 'No vehicle'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.eway_bills?.[0]?.status || 'Not Generated'} />
                  <StatusBadge status={c.dc_status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
