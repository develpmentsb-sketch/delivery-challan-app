import React from 'react'

const ROW = {
  head: 'bg-navy-100/70 font-bold text-navy',
  sub: 'bg-navy-50 font-semibold text-navy',
  total: 'border-t border-navy-300 font-bold text-navy',
  warn: 'bg-brick/10 font-semibold text-brick',
  muted: 'text-xs text-navy-400'
}

export default function ReportTable({ report }) {
  if (!report) return null
  return (
    <div className="overflow-x-auto">
      <div className="mb-3">
        <h3 className="font-display text-lg font-bold text-navy">{report.title}</h3>
        <p className="text-xs text-navy-400">{report.subtitle}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-navy text-white">
            {report.columns.map((c, i) => (
              <th key={i} className={`px-3 py-2 text-xs font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r, i) => (
            <tr key={i} className={`border-b border-navy-50 ${ROW[r.style] || ''}`}>
              {r.cells.map((c, j) => (
                <td
                  key={j}
                  className={`px-3 py-1.5 ${report.columns[j]?.align === 'right' ? 'text-right tabular-nums' : ''}`}
                  style={j === 0 && r.indent ? { paddingLeft: 12 + r.indent * 16 } : undefined}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
