import{r as m,j as t,L as K,e as pt}from"./vendor-react-D6Y9aNgo.js";import{H as ht}from"./Header-CK8DaiRD.js";import{g as mt,a as ut,u as xt,P as gt,I as ft,n as vt,R as bt,L as yt,o as Nt,d as w,p as jt,q as _t,S as Z,h as wt}from"./index-BtLH3o6U.js";import{P as Ct}from"./Pagination-D7Kh1ctC.js";import{C as St}from"./ConfirmDialog-DRWkYFIY.js";import{a as $t,l as Tt}from"./locations-wbuGQqIP.js";import{g as X,l as tt}from"./partnerService-DuVCtVnL.js";import{e as et}from"./excelExport-DfFy6a86.js";import{S as st}from"./search-D046LwAG.js";import{F as at}from"./file-spreadsheet-BDJmydrd.js";import{P as kt}from"./printer-CvOD9Hl2.js";import{F as Dt}from"./file-text-Dz6JwBCh.js";import{T as it}from"./trash-2-GY9yPVnk.js";import"./vendor-supabase-3Te545q_.js";import"./vendor-xlsx-CKN5doRT.js";const It="landscape",At=4;function Ft(s,n,r,v="pdf"){const d=s.dispatch_from_snapshot||{},c=$t(mt(),d),a=s.bill_to_snapshot||{},p=s.ship_to_snapshot||{},S=n||[],$=[c.address,[c.state,c.pincode].filter(Boolean).join(" - ")].filter(Boolean).join(", "),N=c.gstin||"",b=c.pan||(N.length>=12?N.slice(2,12):""),x=zt(c.logo||"/logo.png"),j=s.total_quantity!=null?s.total_quantity:S.reduce((I,_)=>I+(Number(_.quantity)||0),0),T=s.purpose||s.reason||"",A=s.insurance_value,k="The listed above materials is only for service purpose. There is no commercial value involved in the above material."+(A?` The insurance value is ${Pt(A)}`:""),L=s.note||k,D=s.no_of_packages?String(s.no_of_packages):"",z=s.weight_kg?`${s.weight_kg} KG`:"",g=Math.max(S.length,At),P=Array.from({length:g},(I,_)=>{const f=S[_],F=_===0?`<td class="purpose" rowspan="${g+1}">${i(T)}</td>`:"";return f?`<tr>
      <td class="r">${_+1}</td>
      <td>${i(f.item_name||"")}${f.description?` <span class="muted">– ${i(f.description)}</span>`:""}</td>
      <td class="c">${i(f.hsn||"")}</td>
      <td class="c">${i(f.uom||"No's")}</td>
      <td class="c">${rt(f.quantity)}</td>
      ${F}
    </tr>`:`<tr class="blank"><td>&nbsp;</td><td></td><td></td><td></td><td></td>${F}</tr>`}).join(""),B=r&&r.eway_bill_number?`<div class="row full"><div class="cell"><b>E-Way Bill No:</b> ${i(r.eway_bill_number)}
           &nbsp;|&nbsp; <b>Date:</b> ${R(r.eway_bill_date)}
           &nbsp;|&nbsp; <b>Valid Until:</b> ${R(r.valid_until)}
           &nbsp;|&nbsp; <b>Status:</b> ${i(r.status||"")}</div></div>`:"",M=i((c.name||"").split(" ")[0]);return`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${i(s.dc_number||"Delivery Challan")}</title>
<style>
  @page { size: A4 ${It}; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { border: 1px solid #000; width: 100%; }
  .row { display: grid; border-top: 1px solid #000; }
  .cell { padding: 2px 5px; min-width: 0; }
  .cell + .cell { border-left: 1px solid #000; }
  .b { font-weight: 700; }
  .c { text-align: center; }
  .r { text-align: right; }
  .muted { color: #444; font-size: 9px; }

  /* Header */
  .hdr { display: grid; grid-template-columns: 30% 70%; }
  .logo { display: flex; align-items: center; justify-content: center; padding: 6px; }
  .logo img { max-width: 100%; max-height: 92px; object-fit: contain; }
  .logo .fallback { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #1c5fa8; }
  .hdr-right { border-left: 1px solid #000; }
  .co-name { text-align: center; font-weight: 700; font-size: 13px; padding: 3px 5px; }
  .co-addr { text-align: center; font-size: 8px; padding: 3px 5px; border-top: 1px solid #000; min-height: 16px; }
  .co-loc { text-align: center; font-size: 8px; font-weight: 700; padding: 2px 5px; border-top: 1px solid #000; }
  .co-gst { text-align: center; font-weight: 700; font-size: 9px; padding: 3px 5px; border-top: 1px solid #000; }
  .dc-row { display: grid; grid-template-columns: 36% 64%; border-top: 1px solid #000; }
  .dc-title { display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 10px; }
  .dc-meta { border-left: 1px solid #000; }
  .kv { display: grid; grid-template-columns: 34% 66%; border-bottom: 1px solid #000; }
  .kv b { text-align: right; padding: 1px 5px; border-right: 1px solid #000; }
  .kv span { padding: 1px 5px; }
  .dc-type { text-align: right; font-weight: 700; padding: 1px 5px; }

  /* Bill / Ship */
  .two { grid-template-columns: 1fr 1fr; }
  .party-h { font-weight: 700; font-size: 10.5px; }
  .party-name { font-weight: 700; }
  .party-addr { min-height: 40px; padding-top: 14px; }

  /* Items */
  table.items { width: 100%; border-collapse: collapse; border-top: 1px solid #000; table-layout: fixed; }
  table.items th, table.items td { border: 1px solid #000; padding: 2px 5px; font-size: 10px; }
  table.items tr > *:first-child { border-left: 0; }
  table.items tr > *:last-child { border-right: 0; }
  table.items thead th { font-size: 9.5px; font-weight: 700; text-align: center; }
  table.items thead { display: table-header-group; }
  table.items tr { page-break-inside: avoid; }
  table.items td.purpose { text-align: center; vertical-align: middle; font-size: 10.5px; }
  table.items tr.total td { font-weight: 700; }

  .note { padding: 6px 5px; min-height: 26px; }
  .ref { grid-template-columns: 1fr 1fr; }
  .pkg { display: flex; align-items: flex-end; justify-content: space-between; padding: 2px 5px; }
  .ref-r { padding: 0; }
  .ref-r .g2 { display: grid; grid-template-columns: 1fr 1fr; }
  .ref-r .g2 > div { padding: 2px 5px; }
  .ref-r .g2 > div + div { border-left: 1px solid #000; }
  .ref-r .g2.top { border-bottom: 1px solid #000; font-weight: 700; }
  .sign { grid-template-columns: 1fr 1fr; height: 78px; }
  .sign .cell { display: flex; align-items: flex-end; font-weight: 700; }
  .sign .cell.right { justify-content: center; }
  .certify { padding: 2px 5px; }
  .full { grid-template-columns: 1fr; }
</style>
</head>
<body>
<div class="sheet">

  <div class="hdr">
    <div class="logo">
      <img src="${i(x)}" alt="${i(c.name)}"
           onerror="this.outerHTML='<div class=&quot;fallback&quot;>${M}</div>'" />
    </div>
    <div class="hdr-right">
      <div class="co-name">${i(c.name)}</div>
      <div class="co-addr">${i($)}</div>
      ${d.location_id&&(d.location_name||"").trim().toLowerCase()!==(c.name||"").trim().toLowerCase()?`<div class="co-loc">Dispatch From: ${i(d.location_name||"")}</div>`:""}
      <div class="co-gst">GSTIN: ${i(N)}${b?` &nbsp; PAN: ${i(b)}`:""}</div>
      <div class="dc-row">
        <div class="dc-title">DELIVERY CHALLAN</div>
        <div class="dc-meta">
          <div class="kv"><b>DC No:</b><span>${i(s.dc_number||"")}</span></div>
          <div class="kv"><b>DC Date:</b><span>${R(s.dc_date)}</span></div>
          <div class="dc-type">DC Type: ${i(s.dc_type||"Non-Returnable")}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="row two">
    <div class="cell party-h">Bill To</div>
    <div class="cell party-h">Ship To:</div>
  </div>
  <div class="row two">
    <div class="cell party-name">${i(a.name||"")}</div>
    <div class="cell party-name">${i(p.name||"")}</div>
  </div>
  <div class="row two">
    <div class="cell party-addr">${i(lt(a))}<br/>${nt(a)}</div>
    <div class="cell party-addr">${i(lt(p))}<br/>${nt(p)}</div>
  </div>
  <div class="row two">
    <div class="cell b">GSTIN: ${i(a.gstin||"URP")}</div>
    <div class="cell b">GSTIN: ${i(p.gstin||"URP")}</div>
  </div>

  <table class="items">
    <colgroup>
      <col style="width:5%"><col><col style="width:12%"><col style="width:7%"><col style="width:6%"><col style="width:22%">
    </colgroup>
    <thead>
      <tr><th>SL.No</th><th>Item Description</th><th>HSN</th><th>UOM</th><th>Qty</th><th>Purpose</th></tr>
    </thead>
    <tbody>
      ${P}
      <tr class="total"><td colspan="2" class="c">Total</td><td></td><td></td><td class="c">${rt(j)}</td></tr>
    </tbody>
  </table>

  <div class="row full"><div class="cell note"><b>Note:</b>${i(L)}</div></div>

  <div class="row ref">
    <div class="cell pkg">
      <span><b>No of Package:</b> ${i(D)}</span>
      <span class="b">${i(z)}</span>
    </div>
    <div class="cell ref-r">
      <div class="g2 top"><div>Reference Name/Department:</div><div>Kind Attention:</div></div>
      <div class="g2"><div>${i(s.reference_name||"")}</div><div>${i(s.kind_attention||"Not for Sale")}</div></div>
    </div>
  </div>

  ${B}

  <div class="row full"><div class="cell certify">I /We certify that to best of my knowledge the particulars are true, correct, and complete.</div></div>

  <div class="row sign">
    <div class="cell">Name and signature of the person to whom the goods were delivered.</div>
    <div class="cell right">Name and signature of the Consignor</div>
  </div>

</div>
<script>
  window.onload = function () { window.print(); };
<\/script>
</body>
</html>`}function Lt(s,n,r,v="pdf"){const d=Ft(s,n,r,v),c=window.open("","_blank","width=1100,height=800");if(!c)throw new Error("Pop-up blocked. Please allow pop-ups for this site to generate the PDF / print.");c.document.open(),c.document.write(d),c.document.close()}function zt(s){return/^(https?:|data:)/i.test(s)?s:typeof window<"u"?window.location.origin+(s.startsWith("/")?s:"/"+s):s}function lt(s){const n=[s.address_line1,s.address_line2,s.city,s.district].filter(Boolean).join(", "),r=[s.state,s.pin_code].filter(Boolean).join("-"),v=[n,r].filter(Boolean).join(", ");return v?v+".":""}function nt(s){const n=s.phone||s.mobile||s.contact_number;return n?`Ph. No.-${i(n)}`:""}const ot=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];function R(s){if(!s)return"-";const n=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));if(n)return`${n[3]}-${ot[Number(n[2])-1]}-${n[1]}`;const r=new Date(s);return Number.isNaN(r.getTime())?String(s):`${String(r.getDate()).padStart(2,"0")}-${ot[r.getMonth()]}-${r.getFullYear()}`}function rt(s){const n=Number(s);return Number.isFinite(n)?String(+n.toFixed(3)):""}function Pt(s){const n=Number(s);return Number.isFinite(n)?`INR ${n.toLocaleString("en-IN")}/-`:String(s)}function i(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}const E=10,C={search:"",dateFrom:"",dateTo:"",gstin:"",dcNumber:"",ewayBillNumber:"",vehicleNumber:"",state:"",status:"All",locationId:""};function Zt(){var O,W;const s=ut(),{can:n}=xt(),[r,v]=m.useState(!0),[d,c]=m.useState([]),[a,p]=m.useState(C),[S,$]=m.useState(C),[N,b]=m.useState(1),[x,j]=m.useState(null),[T,A]=m.useState({}),[k,L]=m.useState([]),[D,z]=m.useState(!0);async function g(e=S){v(!0);try{const l=await jt(e);c(l),A(await X("delivery_challans",l.map(o=>o.id)))}catch(l){s.error(l.message||"Failed to load master list")}finally{v(!1)}}m.useEffect(()=>{g(C)},[]),m.useEffect(()=>{Tt().then(L).catch(()=>{})},[]);const P=()=>{$(a),b(1),g(a)},B=()=>{p(C),$(C),b(1),g(C)},M=e=>{const l={...a,locationId:e};p(l),$(l),b(1),g(l)},I=a.locationId==="__head"?"Head Office":a.locationId?((O=k.find(e=>e.id===a.locationId))==null?void 0:O.legal_name)||((W=k.find(e=>e.id===a.locationId))==null?void 0:W.location_name)||"Company":"";function _(){if(!d.length)return s.info("No records to export for this company");const e=a.locationId==="__head"?null:a.locationId||null;tt({type:"All",activeOnly:!1}).then(l=>{const o=l.filter(y=>!y.company_location_id||y.company_location_id===e),h=new Date().toISOString().slice(0,10),u=I.replace(/[^A-Za-z0-9]+/g,"_");et(d,{partners:o,fileName:`${u}_Master_List_Report_${h}.xlsx`})}).catch(l=>s.error(l.message||"Failed to load parties for the report"))}async function f(){if(!d.length)return s.info("No records to export");try{const e=await tt({type:"All",activeOnly:!1});et(d,{partners:e})}catch(e){s.error(e.message||"Failed to load parties for the report")}}const F=m.useMemo(()=>{const e=(N-1)*E;return d.slice(e,e+E)},[d,N]),q=e=>{var l,o;return((l=e.dispatch_from_snapshot)==null?void 0:l.company_name)||((o=e.dispatch_from_snapshot)==null?void 0:o.location_name)||"Unassigned / Head Office"},dt=m.useMemo(()=>{const e=new Map;for(const l of d){const o=q(l);e.has(o)||e.set(o,[]),e.get(o).push(l)}return[...e.entries()].sort(([l],[o])=>l.localeCompare(o)).map(([l,o])=>({company:l,rows:o,totals:o.reduce((h,u)=>{var y;return{items:h.items+(((y=u.delivery_challan_items)==null?void 0:y.length)||0),qty:h.qty+Number(u.total_quantity||0),taxable:h.taxable+Number(u.taxable_value||0),gst:h.gst+Number(u.cgst||0)+Number(u.sgst||0)+Number(u.igst||0),grandTotal:h.grandTotal+Number(u.grand_total||0)}},{items:0,qty:0,taxable:0,gst:0,grandTotal:0})}))},[d]);async function ct(){try{const e=(await X("delivery_challans",[x.id]))[x.id];if(e){s.error(e),j(null);return}await _t(x.id),s.success(`${x.dc_number} deleted`),j(null),g()}catch(e){s.error(e.message||"Failed to delete"),j(null),g()}}async function G(e,l){var o;try{const h=await wt(e.id);Lt(h,h.delivery_challan_items,(o=h.eway_bills)==null?void 0:o[0],l)}catch(h){s.error(h.message||"Failed to open print view")}}function H(e){var l,o,h,u,y,U,V,Q,J,Y;return t.jsxs("tr",{children:[t.jsx("td",{className:"font-medium text-navy",children:n("challan.edit")?t.jsx(K,{to:`/challan/${e.id}/edit`,className:"hover:underline",children:e.dc_number}):e.dc_number}),t.jsx("td",{children:e.dc_date}),t.jsx("td",{className:"text-xs",children:q(e)}),t.jsx("td",{children:((l=e.partners)==null?void 0:l.name)||((o=e.bill_to_snapshot)==null?void 0:o.name)||"-"}),t.jsx("td",{className:"text-xs",children:((h=e.bill_to_snapshot)==null?void 0:h.gstin)||"-"}),t.jsx("td",{className:"text-xs",children:((u=e.bill_to_snapshot)==null?void 0:u.state)||"-"}),t.jsx("td",{className:"text-xs",children:((y=e.ship_to_snapshot)==null?void 0:y.state)||"-"}),t.jsx("td",{className:"text-right",children:((U=e.delivery_challan_items)==null?void 0:U.length)||0}),t.jsx("td",{className:"text-right",children:e.total_quantity}),t.jsx("td",{className:"text-right",children:w(e.taxable_value)}),t.jsx("td",{className:"text-right",children:w((e.cgst||0)+(e.sgst||0)+(e.igst||0))}),t.jsx("td",{className:"text-right font-semibold",children:w(e.grand_total)}),t.jsx("td",{children:e.vehicle_number||"-"}),t.jsx("td",{className:"text-xs",children:((Q=(V=e.eway_bills)==null?void 0:V[0])==null?void 0:Q.eway_bill_number)||"-"}),t.jsx("td",{children:t.jsx(Z,{status:((Y=(J=e.eway_bills)==null?void 0:J[0])==null?void 0:Y.status)||"Not Generated"})}),t.jsx("td",{children:t.jsx(Z,{status:e.dc_status})}),t.jsx("td",{className:"text-xs",children:new Date(e.created_at).toLocaleDateString("en-IN")}),t.jsx("td",{children:t.jsxs("div",{className:"flex gap-1",children:[t.jsx("button",{title:"Print",onClick:()=>G(e,"print"),className:"text-navy-400 hover:text-navy",children:t.jsx(kt,{size:15})}),t.jsx("button",{title:"Download PDF",onClick:()=>G(e,"pdf"),className:"text-navy-400 hover:text-navy",children:t.jsx(Dt,{size:15})}),n("challan.delete")&&(T[e.id]?t.jsx("button",{title:T[e.id],onClick:()=>s.info(T[e.id]),className:"cursor-not-allowed text-navy-200",children:t.jsx(it,{size:15})}):t.jsx("button",{title:"Delete",onClick:()=>j(e),className:"text-navy-400 hover:text-brick",children:t.jsx(it,{size:15})}))]})})]},e.id)}return t.jsxs("div",{children:[t.jsx(ht,{title:"Master List",subtitle:"All Delivery Challans in one place",actions:n("challan.create")&&t.jsxs(K,{to:"/challan/new",className:"btn-gold",children:[t.jsx(gt,{size:16})," Create Delivery Challan"]})}),t.jsxs("div",{className:"card p-4 mb-6",children:[t.jsxs("div",{className:"grid md:grid-cols-4 gap-3",children:[t.jsxs("div",{className:"md:col-span-2 relative",children:[t.jsx(st,{size:14,className:"absolute left-3 top-3 text-navy-300"}),t.jsx("input",{className:"input pl-8",placeholder:"Search customer, DC No., GSTIN...",value:a.search,onChange:e=>p({...a,search:e.target.value})})]}),t.jsx("input",{type:"date",className:"input",value:a.dateFrom,onChange:e=>p({...a,dateFrom:e.target.value}),placeholder:"Date From"}),t.jsx("input",{type:"date",className:"input",value:a.dateTo,onChange:e=>p({...a,dateTo:e.target.value}),placeholder:"Date To"}),t.jsx("input",{className:"input",placeholder:"DC Number",value:a.dcNumber,onChange:e=>p({...a,dcNumber:e.target.value})}),t.jsx("input",{className:"input",placeholder:"GSTIN",value:a.gstin,onChange:e=>p({...a,gstin:e.target.value})}),t.jsx("input",{className:"input",placeholder:"E-Way Bill Number",value:a.ewayBillNumber,onChange:e=>p({...a,ewayBillNumber:e.target.value})}),t.jsx("input",{className:"input",placeholder:"Vehicle Number",value:a.vehicleNumber,onChange:e=>p({...a,vehicleNumber:e.target.value})}),t.jsxs("select",{className:"input",value:a.state,onChange:e=>p({...a,state:e.target.value}),children:[t.jsx("option",{value:"",children:"All States"}),ft.map(e=>t.jsx("option",{value:e.name,children:e.name},e.code))]}),t.jsxs("div",{className:"flex gap-2",children:[t.jsxs("select",{className:"input flex-1",value:a.locationId,onChange:e=>M(e.target.value),children:[t.jsx("option",{value:"",children:"All Companies"}),t.jsx("option",{value:"__head",children:"Head Office"}),k.map(e=>t.jsx("option",{value:e.id,children:e.legal_name||e.location_name},e.id))]}),a.locationId&&t.jsx("button",{type:"button",title:`Download ${I} Master List Report`,className:"btn-outline px-2 shrink-0",onClick:_,children:t.jsx(at,{size:16})})]}),t.jsxs("select",{className:"input",value:a.status,onChange:e=>p({...a,status:e.target.value}),children:[t.jsx("option",{value:"All",children:"All Statuses"}),vt.map(e=>t.jsx("option",{children:e},e))]})]}),t.jsxs("div",{className:"flex flex-wrap items-center gap-2 mt-4",children:[t.jsxs("button",{className:"btn-primary",onClick:P,children:[t.jsx(st,{size:16})," Search"]}),t.jsxs("button",{className:"btn-outline",onClick:B,children:[t.jsx(bt,{size:16})," Clear Filters"]}),t.jsxs("label",{className:"flex items-center gap-2 text-sm text-navy-600 ml-2 cursor-pointer select-none",children:[t.jsx("input",{type:"checkbox",checked:D,onChange:e=>{z(e.target.checked),b(1)}}),"Group by Company"]}),t.jsx("div",{className:"ml-auto flex gap-2",children:t.jsxs("button",{className:"btn-outline",onClick:f,children:[t.jsx(at,{size:16})," Master List Report"]})})]})]}),t.jsx("div",{className:"card",children:r?t.jsx(yt,{}):d.length===0?t.jsx(Nt,{title:"No delivery challans found",description:"Try adjusting your filters, or create a new delivery challan."}):t.jsxs(t.Fragment,{children:[t.jsx("div",{className:"overflow-x-auto",children:t.jsxs("table",{className:"table-base min-w-[1400px]",children:[t.jsx("thead",{children:t.jsxs("tr",{children:[t.jsx("th",{children:"DC No."}),t.jsx("th",{children:"Date"}),t.jsx("th",{children:"Company"}),t.jsx("th",{children:"Vendor"}),t.jsx("th",{children:"GSTIN"}),t.jsx("th",{children:"Bill To State"}),t.jsx("th",{children:"Ship To State"}),t.jsx("th",{className:"text-right",children:"Items"}),t.jsx("th",{className:"text-right",children:"Qty"}),t.jsx("th",{className:"text-right",children:"Taxable"}),t.jsx("th",{className:"text-right",children:"GST"}),t.jsx("th",{className:"text-right",children:"Grand Total"}),t.jsx("th",{children:"Vehicle No."}),t.jsx("th",{children:"E-Way Bill No."}),t.jsx("th",{children:"E-Way Status"}),t.jsx("th",{children:"DC Status"}),t.jsx("th",{children:"Created"}),t.jsx("th",{})]})}),t.jsx("tbody",{children:D?dt.map(e=>t.jsxs(pt.Fragment,{children:[t.jsx("tr",{className:"bg-navy-50",children:t.jsxs("td",{colSpan:18,className:"font-semibold text-navy py-2",children:[e.company," ",t.jsxs("span",{className:"font-normal text-navy-400 text-xs",children:["(",e.rows.length," DC",e.rows.length===1?"":"s",")"]})]})}),e.rows.map(l=>H(l)),t.jsxs("tr",{className:"bg-cream-100 font-semibold",children:[t.jsxs("td",{colSpan:7,className:"text-right text-xs text-navy-500",children:["Subtotal - ",e.company]}),t.jsx("td",{className:"text-right",children:e.totals.items}),t.jsx("td",{className:"text-right",children:e.totals.qty}),t.jsx("td",{className:"text-right",children:w(e.totals.taxable)}),t.jsx("td",{className:"text-right",children:w(e.totals.gst)}),t.jsx("td",{className:"text-right",children:w(e.totals.grandTotal)}),t.jsx("td",{colSpan:6})]})]},e.company)):F.map(e=>H(e))})]})}),!D&&t.jsx(Ct,{page:N,pageSize:E,total:d.length,onPageChange:b})]})}),t.jsx(St,{open:!!x,title:"Are you sure you want to delete this record?",message:`This will permanently delete ${x==null?void 0:x.dc_number}. This action cannot be undone.`,confirmLabel:"Delete",danger:!0,onConfirm:ct,onCancel:()=>j(null)})]})}export{Zt as default};
