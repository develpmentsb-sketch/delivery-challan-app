export const COMPANY = {
  name: import.meta.env.VITE_COMPANY_NAME || 'Your Company Pvt. Ltd.',
  gstin: import.meta.env.VITE_COMPANY_GSTIN || '',
  address: import.meta.env.VITE_COMPANY_ADDRESS || '',
  state: import.meta.env.VITE_COMPANY_STATE || '',
  stateCode: import.meta.env.VITE_COMPANY_STATE_CODE || '',
  pincode: import.meta.env.VITE_COMPANY_PINCODE || '',
  phone: import.meta.env.VITE_COMPANY_PHONE || '',
  email: import.meta.env.VITE_COMPANY_EMAIL || '',
  logo: import.meta.env.VITE_COMPANY_LOGO_URL || ''
}

export const DOCUMENT_TYPES = [
  'Delivery Challan',
  'Returnable DC',
  'Non-Returnable DC',
  'Stock Transfer',
  'Job Work',
  'Sales Return',
  'Other'
]

export const TRANSPORT_MODES = ['Road', 'Rail', 'Air', 'Ship']

export const VEHICLE_TYPES = ['Regular', 'Over Dimensional Cargo (ODC)']

export const EWAY_STATUSES = ['Not Generated', 'Pending', 'Generated', 'Cancelled', 'Expired']

export const DC_STATUSES = ['Draft', 'Generated', 'Dispatched', 'Cancelled', 'Completed']

export const PARTNER_TYPES = ['Customer', 'Vendor']

export const UOM_OPTIONS = [
  'NOS', 'PCS', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'BOX', 'BAG', 'SET', 'PAIR', 'ROLL', 'SQM', 'DOZ'
]

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28]

// Indian states with GST state codes, used for intra vs inter-state GST logic
export const INDIAN_STATES = [
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Punjab', code: '03' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'Haryana', code: '06' },
  { name: 'Delhi', code: '07' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Bihar', code: '10' },
  { name: 'Sikkim', code: '11' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Nagaland', code: '13' },
  { name: 'Manipur', code: '14' },
  { name: 'Mizoram', code: '15' },
  { name: 'Tripura', code: '16' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Assam', code: '18' },
  { name: 'West Bengal', code: '19' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Odisha', code: '21' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Gujarat', code: '24' },
  { name: 'Daman and Diu', code: '25' },
  { name: 'Dadra and Nagar Haveli', code: '26' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Andhra Pradesh (Old)', code: '28' },
  { name: 'Karnataka', code: '29' },
  { name: 'Goa', code: '30' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Kerala', code: '32' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Puducherry', code: '34' },
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Telangana', code: '36' },
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Ladakh', code: '38' }
]

export const stateCodeFromName = (name) =>
  INDIAN_STATES.find((s) => s.name.toLowerCase() === String(name || '').toLowerCase())?.code || ''
