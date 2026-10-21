import React from 'react'

// Shows plain text for everyone. For an admin in edit mode it turns into a text box,
// so the wording can be changed right where it appears.
export default function EditableText({ as: Tag = 'p', value, onChange, editable, multiline = false, className = '', placeholder }) {
  if (!editable) return <Tag className={className}>{value}</Tag>
  const shared =
    `${className} w-full rounded-md border border-dashed border-gold-400/80 bg-white/5 px-1.5 py-0.5 outline-none ` +
    'focus:border-solid focus:bg-white/10'
  return multiline ? (
    <textarea rows={2} className={`${shared} resize-none`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input type="text" className={shared} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  )
}
