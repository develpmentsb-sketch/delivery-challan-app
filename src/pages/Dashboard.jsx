import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, CalendarClock, CalendarRange, FileCheck2, FileClock, FileX2, Plus
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { listChallans, getDashboardStats } from '../services/challanService'
import { formatCurrency } from '../utils/calculations'
import { useToast } from '../context/ToastContext'

const PIE_COLORS = ['#1B2A4A', '#C98A2C', '#2F6846', '#B23A34', '#8596C0']

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: 'none',
  boxShadow: '0 8px 24px rgba(13,21,38,0.18)',
  fontSize: 12
}

export default function Dashboard() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [s, list] = await Promise.all([getDashboardStats(), listChallans()])
        if (!mounted) return
        setStats(s)
        setRecent(list.slice(0, 8))
      } catch (err) {
        toast.error(err.message || 'Failed to load dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  if (loading) return <LoadingSpinner label="Loading dashboard..." />

  const cards = [
    { label: 'Total Delivery Challans', value: stats.total, icon: FileText, color: 'from-navy-500 to-navy-800 text-white' },
    { label: "Today's Challans", value: stats.today, icon: CalendarClock, color: 'from-gold-400 to-gold-600 text-white' },
    { label: "This Month's Challans", value: stats.thisMonth, icon: CalendarRange, color: 'from-forest-500 to-forest-600 text-white' },
    { label: 'E-Way Bills Generated', value: stats.ewayGenerated, icon: FileCheck2, color: 'from-navy-300 to-navy-600 text-white' },
    { label: 'Pending E-Way Bills', value: stats.ewayPending, icon: FileClock, color: 'from-gold-500 to-gold-600 text-white' },
    { label: 'Cancelled Challans', value: stats.cancelled, icon: FileX2, color: 'from-brick-500 to-brick-600 text-white' }
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
            className="card p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 shadow-md ${c.color}`}>
              <c.icon size={18} />
            </div>
            <p className="text-3xl font-bold text-navy">{c.value}</p>
            <p className="text-xs text-navy-400 mt-1 leading-snug">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-navy mb-4 text-sm">Delivery Challans by Month</h3>
          {monthlyChart.length === 0 ? (
            <EmptyState title="No data yet" description="Create a few delivery challans to see monthly trends." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyChart}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5D73AB" />
                    <stop offset="100%" stopColor="#1B2A4A" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#D6DCEA" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(27,42,74,0.06)' }} />
                <Bar dataKey="count" fill="url(#barGrad)" radius={[8, 8, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-navy mb-4 text-sm">DC Status Split</h3>
          {statusChart.length === 0 ? (
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
          <h3 className="font-semibold text-navy text-sm">Recent Delivery Challans</h3>
          <Link to="/master-list" className="text-xs font-semibold text-gold-600 hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            title="No delivery challans yet"
            description="Create your first delivery challan to see it here."
            action={<Link to="/challan/new" className="btn-primary mt-2"><Plus size={16} /> Create Delivery Challan</Link>}
          />
        ) : (
          <div className="overflow-x-auto rounded-b-2xl">
            <table className="table-base">
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
