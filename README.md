# Delivery Challan & E-Way Bill Management Dashboard

A production-ready, modular React + Vite + Tailwind + Supabase web application
for creating and tracking Delivery Challans and E-Way Bills for an Indian
company — with an Item Master, a combined Customer/Vendor Master, Excel/CSV
export, printable PDF challans, and full backup/restore.

## 1. Tech stack

- React 18 + Vite
- Tailwind CSS
- lucide-react icons
- Recharts (dashboard charts)
- Supabase (Postgres database, auth, RLS)
- `xlsx` for Excel import/export
- Browser print → PDF for the Delivery Challan document (no server needed)

## 2. Project structure

```
src/
  components/   Sidebar, Header, Layout, PartnerSelect, ItemSelect, StatusBadge, etc.
  pages/        Dashboard, DeliveryChallanForm, MasterList, ItemMaster, PartnerMaster,
                Settings, BackupRestore, Login
  services/     challanService, partnerService, itemService, ewayBillService, numberingService
  utils/        validation, calculations (GST), numberToWords, excelExport, pdfGenerator, backupRestore
  context/      AuthContext, ToastContext
  lib/          supabase client, app constants (states, statuses, GST rates, company info)
supabase/
  schema.sql          full table definitions, indexes, the atomic DC-numbering function
  rls_policies.sql    Row Level Security policies (run after schema.sql)
```

## 3. Setup

### 3.1 Create a Supabase project

1. Go to https://supabase.com and create a new project.
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/rls_policies.sql`.
3. In **Authentication → Providers**, make sure Email sign-in is enabled.
   (You can turn off "Confirm email" while testing, or confirm via the email
   Supabase sends.)
4. In **Project Settings → API**, copy the **Project URL** and the **anon /
   public key** — never the `service_role` key.

### 3.2 Configure the app

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
VITE_COMPANY_NAME="Your Company Pvt. Ltd."
VITE_COMPANY_GSTIN=29ABCDE1234F1Z5
VITE_COMPANY_ADDRESS="123, Industrial Layout, Bengaluru"
VITE_COMPANY_STATE=Karnataka
VITE_COMPANY_STATE_CODE=29
VITE_COMPANY_PHONE=+91-9876543210
VITE_COMPANY_EMAIL=accounts@yourcompany.com
```

### 3.3 Install and run

```bash
npm install
npm run dev
```

Open the printed local URL, click **Sign up** on the login screen to create
your first user (Supabase Auth), then sign in.

### 3.4 First-time data entry workflow

1. **Item List** → add a few items (Item Code, HSN, GST %, Unit Price).
2. **Customer / Vendor Master** → add a customer or vendor, its Bill To
   address, and one or more Ship To addresses (mark one as Default).
3. **Create Delivery Challan & E-Way Bill** → select the customer/vendor
   (Bill To auto-fills), add items, review the auto-calculated GST split,
   fill transport details, optionally enable the E-Way Bill section, then
   **Save Draft** or **Save & Generate**.
4. **Generate PDF** / **Print** open a formatted, print-ready Delivery
   Challan in a new tab — use the browser's "Save as PDF" destination to
   download it.
5. **Master List** → search/filter challans and **Export Excel** / **Export
   CSV**.

## 4. Important design notes

- **Address snapshots**: when a Delivery Challan is saved, the selected Bill
  To and Ship To addresses are copied into `bill_to_snapshot` /
  `ship_to_snapshot` (JSONB) on the `delivery_challans` row. Editing the
  Customer/Vendor Master later never changes historical challans.
- **Auto numbering**: DC numbers (`DC-2026-0001`, `DC-2026-0002`, ...) are
  reserved by the Postgres function `next_dc_number()` using an atomic
  `INSERT ... ON CONFLICT DO UPDATE`, so concurrent users never get
  duplicate numbers.
- **GST split**: CGST+SGST is applied when the Place of Supply state equals
  the Ship To state; otherwise IGST is applied (see `src/utils/calculations.js`).
- **No government API integration is included on purpose.** The E-Way Bill
  section only stores the fields you enter. If you later connect the real
  GST/E-Way Bill API, do it from a secure backend (e.g. a Supabase Edge
  Function) and never put the API key in the React frontend — only the
  Supabase anon key belongs in the browser.
- **Security**: Row Level Security is enabled on every table; policies in
  `rls_policies.sql` allow any signed-in (authenticated) user full access,
  which suits a small internal team. For multi-company / multi-tenant use,
  add an `organization_id` column and scope the policies to
  `auth.uid()`'s organization.

## 5. Deployment

### Vercel / Netlify
Standard Vite deployment — set the build command to `npm run build`, the
output directory to `dist`, and add the same environment variables from
`.env` in the host's dashboard.

### GitHub Pages
Vite's `base` is read from `VITE_BASE_PATH` (see `vite.config.js`). Build with:

```bash
VITE_BASE_PATH=/your-repo-name/ npm run build
```

Then publish the `dist/` folder (e.g. with the `gh-pages` package or a GitHub
Actions workflow) to the `gh-pages` branch.

## 6. Troubleshooting

- **"Supabase env vars are missing"** in the console → check `.env` exists
  and both `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set, then
  restart `npm run dev`.
- **Pop-up blocked** when clicking Generate PDF/Print → allow pop-ups for
  this site; the print view opens in a new tab.
- **Duplicate Item Code / GSTIN** errors are expected — the app checks the
  database before saving to prevent duplicates.
