/* ---------------- Reports ---------------- */
function inRange(dateStr, range){
  const d = new Date(dateStr); const now = new Date();
  if(range==='today') return dateStr===todayStr();
  if(range==='week'){ const wk = new Date(now); wk.setDate(now.getDate()-7); return d>=wk; }
  if(range==='month'){ return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); }
  if(range==='3month'){ const back = new Date(now); back.setDate(now.getDate()-90); return d>=back; }
  if(range==='6month'){ const back = new Date(now); back.setDate(now.getDate()-180); return d>=back; }
  if(range==='custom'){
    // dateStr and the <input type="date"> values are both plain YYYY-MM-DD strings, so a
    // direct string comparison sorts correctly without any Date-parsing/timezone edge cases.
    const from = document.getElementById('reportCustomFrom')?.value || '';
    const to = document.getElementById('reportCustomTo')?.value || '';
    if(from && dateStr < from) return false;
    if(to && dateStr > to) return false;
    return true;
  }
  return true;
}
function rangeLabel(range){
  if(range==='custom'){
    const from = document.getElementById('reportCustomFrom')?.value || '';
    const to = document.getElementById('reportCustomTo')?.value || '';
    if(from && to) return from+' থেকে '+to;
    if(from) return from+' থেকে এখন পর্যন্ত';
    if(to) return to+' পর্যন্ত';
    return 'নির্বাচিত সময়ে';
  }
  return {today:'আজ', week:'এই সপ্তাহে', month:'এই মাসে', '3month':'গত ৩ মাসে', '6month':'গত ৬ মাসে'}[range] || 'সর্বমোট';
}
// Shows/hides the from-to date pickers and, the first time কাস্টম is picked in a session,
// pre-fills a sensible starting window (this calendar year's Jan 1 through today) so the
// owner isn't staring at two empty boxes — e.g. picking জানুয়ারি-আগস্ট just means editing "শেষ".
function onReportRangeChange(){
  const range = document.getElementById('reportRange').value;
  const wrap = document.getElementById('reportCustomRangeWrap');
  wrap.style.display = range==='custom' ? 'flex' : 'none';
  if(range==='custom'){
    const fromEl = document.getElementById('reportCustomFrom'), toEl = document.getElementById('reportCustomTo');
    if(!fromEl.value) fromEl.value = new Date().getFullYear()+'-01-01';
    if(!toEl.value) toEl.value = todayStr();
  }
  renderReports();
}
function inYear(dateStr){
  const d = new Date(dateStr); const now = new Date();
  return d.getFullYear()===now.getFullYear();
}
// The medicine's own "কোম্পানি" field (set once in inventory) decides the group — not the
// purchase-entry supplier, which the owner doesn't want to have to add every time.
function purchaseCompanyName(p){
  const med = medicines.find(m=>m.id===p.medicineId);
  const c = med && med.company ? med.company.trim() : '';
  return c || 'কোম্পানি উল্লেখ নেই';
}
// Some shops buy from 100+ companies — showing them all by default would push the whole
// রিপোর্ট page down past nothing but company names. Same "5 by default, tap to see more, or
// just search" pattern already used for the সাপ্লায়ার list (renderSuppliers above).
let companyPurchaseShowAll = false;
function renderCompanyPurchaseReport(){
  const el = document.getElementById('companyPurchaseList');
  if(!el) return;
  // Follows the same "সময়কাল বেছে নিন" dropdown as the rest of the রিপোর্ট page (আজ/সপ্তাহ/
  // মাস/৩ মাস/৬ মাস/সর্বমোট) instead of a fixed month — this is what lets the owner pick "আজ"
  // right after entering an invoice and see if it matches, or pick "৩ মাস"/"৬ মাস" to size up a
  // company before renewing a supply contract. সর্বমোট (all-time) is kept as a second line since
  // that context is useful regardless of which range is selected.
  const range = document.getElementById('reportRange')?.value || 'month';
  const rangeMap = {}, allTimeMap = {};
  purchases.forEach(p=>{
    const company = purchaseCompanyName(p);
    const amt = p.qty*p.price;
    if(inRange(p.date, range)) rangeMap[company] = (rangeMap[company]||0) + amt;
    allTimeMap[company] = (allTimeMap[company]||0) + amt;
  });
  const allCompanies = Array.from(new Set([...Object.keys(rangeMap), ...Object.keys(allTimeMap)]))
    .sort((a,b)=>(rangeMap[b]||0)-(rangeMap[a]||0));
  const q = (document.getElementById('companyPurchaseSearch')?.value||'').trim().toLowerCase();
  const filtered = rankBy(allCompanies, q, c=>c, []);
  const LIMIT = 5;
  const expanded = companyPurchaseShowAll || !!q;
  const companies = expanded ? filtered : filtered.slice(0, LIMIT);
  const label = rangeLabel(range);
  const rowsHtml = companies.length ? companies.map(c=>`
    <div class="row-item" onclick="showCompanyPurchaseDetail('${c.replace(/'/g,"\\'")}')" style="cursor:pointer;">
      <div class="row-title">${c}</div>
      <div class="row-right"><div class="row-title">${fmt(rangeMap[c]||0)}</div><div class="row-sub">${label} • সর্বমোট ${fmt(allTimeMap[c]||0)}</div></div>
    </div>`).join('') : `<div class="empty-state">${allCompanies.length?'কোনো মিল পাওয়া যায়নি':'এখনো কোনো ক্রয় নেই'}</div>`;
  let toggleHtml = '';
  if(!q && filtered.length > LIMIT){
    toggleHtml = expanded
      ? `<div class="row-item" style="justify-content:center;cursor:pointer;color:var(--primary-dark);font-weight:700;" onclick="companyPurchaseShowAll=false;renderCompanyPurchaseReport();">▲ সংক্ষেপে দেখান</div>`
      : `<div class="row-item" style="justify-content:center;cursor:pointer;color:var(--primary-dark);font-weight:700;" onclick="companyPurchaseShowAll=true;renderCompanyPurchaseReport();">আরও ${filtered.length-LIMIT}টা দেখুন ▼</div>`;
  }
  el.innerHTML = rowsHtml + toggleHtml;
}
function showCompanyPurchaseDetail(company){
  const range = document.getElementById('reportRange')?.value || 'month';
  const list = purchases.filter(p=>purchaseCompanyName(p)===company).sort((a,b)=>b.ts-a.ts);
  const rangeTotal = list.filter(p=>inRange(p.date, range)).reduce((a,p)=>a+p.qty*p.price,0);
  const allTotal = list.reduce((a,p)=>a+p.qty*p.price,0);
  const rows = list.map(p=>`
    <div class="row-item" onclick="openPurchaseFrom('${p.id}','showCompanyPurchaseDetail','${String(company).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')" style="cursor:pointer;">
      <div><div class="row-title">${medTypeTagFor(p.medicineId)}${escapeHtml(p.medicineName||'')}</div><div class="row-sub">${p.date}</div></div>
      <div class="row-right"><div class="row-title">${fmt(p.qty*p.price)}</div><div class="row-sub">${p.qty} × ${fmt(p.price)}</div></div>
    </div>`).join('');
  document.getElementById('detailModalTitle').textContent = company + ' (' + list.length + 'টা)';
  document.getElementById('detailModalContent').innerHTML =
    `<div class="row-item" style="border-bottom:none;padding-bottom:2px;"><div class="row-title">${rangeLabel(range)}</div><div class="row-title">${fmt(rangeTotal)}</div></div>`+
    `<div class="row-item" style="border-bottom:1.5px solid #ddd;padding-bottom:12px;margin-bottom:6px;"><div class="row-title">সর্বমোট</div><div class="row-title">${fmt(allTotal)}</div></div>`+
    (rows || `<div class="empty-state">কোনো ক্রয় নেই</div>`);
  openModal('detailModalBackdrop');
}
function renderReports(){
  updateDueListStatus();
  const range = document.getElementById('reportRange').value;
  const sInRange = sales.filter(s=>inRange(s.date, range));
  const pInRange = purchases.filter(p=>inRange(p.date, range));
  const ltInRange = labTests.filter(lt=>inRange(lt.date, range));
  const testSums = ltInRange.reduce((a,lt)=>{ const x=labTestTotals(lt); a.price+=x.price; a.profit+=x.profit; return a; }, {price:0, profit:0});
  const totalSales = sInRange.reduce((a,s)=>a+s.total,0) + testSums.price;
  const totalPurchase = pInRange.reduce((a,p)=>a+p.qty*p.price,0);
  const costOfGoods = sInRange.reduce((a,s)=>a+s.items.reduce((x,i)=>{ const med=medicines.find(m=>m.id===i.id); return x+(med?med.buy*i.qty:0); },0),0);
  const profit = totalSales - costOfGoods - testSums.price + testSums.profit;
  const newDue = sInRange.filter(s=>s.payMethod==='due').reduce((a,s)=>a+s.total,0);

  document.getElementById('rSales').textContent = fmt(totalSales);
  document.getElementById('rPurchase').textContent = fmt(totalPurchase);
  const _rBase = sInRange.reduce((a,x)=>a+(x.total||0),0);
  _paintProfit('rProfit', profit, _rBase);
  document.getElementById('rDue').textContent = fmt(newDue);
  { const _e = _expensesIn(d=>inRange(d, range)).reduce((a,p)=>a+(p.amount||0),0);
    const _p = _profitCalc(sInRange, ltInRange);
    document.getElementById('rExp').textContent = fmt(_e);
    _paintProfit('rNet', _p.profit - _e, _rBase); }

  const counts = {};
  sInRange.forEach(s=>s.items.forEach(i=>{ counts[i.name]=(counts[i.name]||0)+i.qty; }));
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  document.getElementById('topMeds').innerHTML = top.length ? top.map(([name,qty])=>`
    <div class="row-item"><div class="row-title">${name}</div><span class="badge badge-green">${qty} বিক্রি</span></div>`).join('') : `<div class="empty-state">এই সময়কালে কোনো বিক্রয় নেই</div>`;
  renderCompanyPurchaseReport();
  renderAntibioticRegister();
}
let antibioticShowCount = 5;
function antibioticFilterChanged(){ antibioticShowCount = 5; renderAntibioticRegister(); }
function renderAntibioticRegister(){
  const listEl = document.getElementById('antibioticRegisterList');
  if(!listEl) return;
  const q = (document.getElementById('antibioticSearch')?.value||'').trim().toLowerCase();
  const dFrom = document.getElementById('antibioticDateFrom')?.value||'';
  const dTo = document.getElementById('antibioticDateTo')?.value||'';
  const allRows = buildAntibioticRows(q, dFrom, dTo);
  const rows = allRows.slice(0, antibioticShowCount);
  listEl.innerHTML = rows.length ? rows.map(rowToHtml).join('') : `<div class="empty-state">${(q||dFrom||dTo) ? 'এই শর্তে কোনো এন্টিবায়োটিক বিক্রির রেকর্ড নেই' : 'এখনো কোনো এন্টিবায়োটিক বিক্রি হয়নি'}</div>`;
  const countInfo = document.getElementById('antibioticCountInfo');
  if(countInfo) countInfo.textContent = allRows.length ? `${rows.length} / ${allRows.length}টা দেখানো হচ্ছে` : '';
  const moreBtn = document.getElementById('antibioticLoadMoreBtn');
  if(moreBtn) moreBtn.style.display = allRows.length > rows.length ? 'block' : 'none';
}
function buildAntibioticRows(q, dFrom, dTo){
  const rows = [];
  sales.forEach(s=>{
    if(dFrom && s.date < dFrom) return;
    if(dTo && s.date > dTo) return;
    (s.items||[]).forEach(it=>{
      if(!it.isAntibiotic) return;
      if(q && !medNameIncludes(it.name, q)) return;
      rows.push({sale:s, item:it});
    });
  });
  rows.sort((a,b)=>b.sale.ts-a.sale.ts);
  return rows;
}
function rowToHtml(r){
  return `
    <div class="row-item" onclick="closeModal('detailModalBackdrop');showReceiptById('${r.sale.id}')" style="cursor:pointer;">
      <div>
        <div class="row-title">${r.item.name} <span class="tag-en">× ${r.item.qty}</span></div>
        <div class="row-sub">রোগী: ${r.sale.patientName||r.sale.customerName||'—'} • মোবাইল: ${r.sale.patientMobile||'—'}</div>
        <div class="row-sub">${r.sale.doctorName ? formatPrescriberLine(r.sale) : 'প্রেসক্রাইবার: —'}</div>
      </div>
      <div class="row-right"><div class="row-sub">${r.sale.date}</div></div>
    </div>`;
}
function buildAntibioticRegisterHtml(q, dFrom, dTo){
  const shop = (document.querySelector('.brand-name') && document.querySelector('.brand-name').textContent.trim()) || 'শ্রী শ্রী নৃসিংহ মেডিকেল হল';
  const rows = buildAntibioticRows(q||'', dFrom||'', dTo||'').slice().reverse();   // পুরনো আগে — রেজিস্টারের মতো
  const now = new Date();
  const stamp = localDateStr(now)+' '+now.toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
  const range = (dFrom||dTo) ? ((dFrom||'শুরু')+' থেকে '+(dTo||'আজ')) : 'সব তারিখ';
  const body = rows.map((r,i)=>`<tr><td class="n">${i+1}</td><td class="d">${escapeHtml(r.sale.date||'')}</td><td><b>${escapeHtml(r.item.name||'')}</b> <span class="q">× ${escapeHtml(String(r.item.qty))}</span></td><td>${escapeHtml(r.sale.patientName||r.sale.customerName||'—')}<div class="m">${escapeHtml(r.sale.patientMobile||'—')}</div></td><td>${escapeHtml(r.sale.doctorName ? formatPrescriberLine(r.sale) : '—')}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>এন্টিবায়োটিক রেজিস্টার — ${escapeHtml(localDateStr(now))}</title>
<style>@page{size:A4;margin:12mm}
body{font-family:system-ui,-apple-system,"Noto Sans Bengali","Segoe UI",sans-serif;margin:0;padding:14px;background:#f5f5f0;color:#1a2b22}
h1{font-size:18px;margin:0 0 2px}.sub{font-size:12px;color:#555;margin-bottom:10px;line-height:1.5}
input.s{width:100%;box-sizing:border-box;padding:9px;border:1px solid #ccc;border-radius:8px;font-size:15px;margin-bottom:8px}
table{width:100%;border-collapse:collapse;background:#fff}
th,td{padding:7px 6px;border:1px solid #cfd8d3;font-size:13.5px;text-align:left;vertical-align:top}
th{background:#1b4d3e;color:#fff;font-size:13px}td.n{color:#666;width:26px;text-align:center}td.d{white-space:nowrap}
.q{color:#555}.m{font-size:12px;color:#555}
button.pr{padding:9px 14px;border:0;border-radius:8px;background:#c9a227;font-weight:700;font-size:14px}
.sig{display:none;margin-top:36px;font-size:13px}
@media print{body{background:#fff;padding:0}input.s,button.pr{display:none}th{background:#e5ede9!important;color:#000!important;-webkit-print-color-adjust:exact}thead{display:table-header-group}tr{page-break-inside:avoid}.sig{display:flex;justify-content:space-between}}</style></head><body>
<h1>${escapeHtml(shop)} — এন্টিবায়োটিক বিক্রয় রেজিস্টার</h1>
<div class="sub">সময়কাল: ${escapeHtml(range)}${q?' • ওষুধ: '+escapeHtml(q):''} • মোট ${rows.length}টা এন্ট্রি • তৈরি: ${escapeHtml(stamp)}<br>এই ফাইল অ্যাপ ছাড়াই খোলা ও ছাপা যায়।</div>
<input class="s" id="q" placeholder="ওষুধ, রোগী, মোবাইল বা প্রেসক্রাইবার দিয়ে খুঁজুন…" oninput="f()">
<table><thead><tr><th>#</th><th>তারিখ</th><th>এন্টিবায়োটিক × পরিমাণ</th><th>রোগী / মোবাইল</th><th>প্রেসক্রাইবার</th></tr></thead><tbody id="tb">${body || '<tr><td colspan="5">এই শর্তে কোনো এন্টিবায়োটিক বিক্রির রেকর্ড নেই</td></tr>'}</tbody></table>
<p><button class="pr" onclick="window.print()">🖨 প্রিন্ট করুন</button></p>
<div class="sig"><div>প্রোপ্রাইটরের স্বাক্ষর: ____________________</div><div>তারিখ: ______________</div></div>
<script>function f(){var q=document.getElementById('q').value.toLowerCase(),r=document.querySelectorAll('#tb tr');for(var i=0;i<r.length;i++){r[i].style.display=(!q||r[i].textContent.toLowerCase().indexOf(q)>=0)?'':'none'}}<\/script>
</body></html>`;
}
function downloadAntibioticRegister(){
  try{
    const q = (document.getElementById('antibioticSearch')?.value||'').trim().toLowerCase();
    const dFrom = document.getElementById('antibioticDateFrom')?.value||'';
    const dTo = document.getElementById('antibioticDateTo')?.value||'';
    const html = buildAntibioticRegisterHtml(q, dFrom, dTo);
    const blob = new Blob([html], {type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nrisingha-antibiotic-register-${localDateStr(new Date())}.html`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
    toast('এন্টিবায়োটিক রেজিস্টার ডাউনলোড হয়েছে ✓ — Downloads-এ ফাইলটা খুলে প্রিন্ট দিন');
  }catch(e){ console.error(e); toast('রেজিস্টার তৈরিতে সমস্যা হয়েছে'); }
}
function showAntibioticRegisterModal(){
  const rows = buildAntibioticRows('');
  document.getElementById('detailModalTitle').textContent = 'এন্টিবায়োটিক রেজিস্টার — সম্পূর্ণ তালিকা (' + rows.length + 'টা)';
  document.getElementById('detailModalContent').innerHTML = (rows.length ? `<button class="btn btn-gold btn-block" style="margin-bottom:10px;" onclick="downloadAntibioticRegister()">⬇ রেজিস্টার ডাউনলোড (পড়া ও প্রিন্টের জন্য)</button>` : '') + (rows.length ? rows.map(rowToHtml).join('') : `<div class="empty-state">এখনো কোনো এন্টিবায়োটিক বিক্রি হয়নি</div>`);
  openModal('detailModalBackdrop');
}
let _rsQuery = '', _rsLimit = 100;
function _rsHay(s){
  const d = String(s.date||''); const [yy,mm,dd] = d.split('-');
  const dmy = (dd&&mm&&yy) ? (dd+'/'+mm+'/'+yy+' '+dd+'/'+mm+' '+String(parseInt(dd))+'/'+String(parseInt(mm))) : '';
  return [s.customerName||'ওয়াক-ইন কাস্টমার', s.patientName||'', s.patientMobile||'', d.replace(/-/g,'/'), dmy,
    (s.items||[]).map(it=>it.name).join(' ')].join(' ').toLowerCase();
}
function showReportSales(keepQuery){
  if(keepQuery!==true){ _rsQuery = ''; _rsLimit = 100; }
  document.getElementById('detailModalContent').innerHTML = `
    <div style="position:sticky;top:0;background:#fff;z-index:5;padding:2px 0 8px;">
      <input type="text" id="rsSearch" placeholder="🔍 তারিখ (০৫/১০) বা রোগী/কাস্টমারের নাম লিখে খুঁজুন" autocomplete="off" value="${escapeHtml(_rsQuery)}" oninput="_rsQuery=this.value;_rsLimit=100;_rsRender()" style="width:100%;box-sizing:border-box;">
    </div>
    <div id="rsList"></div>`;
  _rsRender();
  openModal('detailModalBackdrop');
}
function _rsRender(){
  const range = document.getElementById('reportRange').value;
  const q = bnToEnDigits(_rsQuery||'').trim().toLowerCase().replace(/[-.]/g,'/');
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const sAll = sales.filter(s=>inRange(s.date, range)).sort((a,b)=>b.ts-a.ts);
  const ltAll = labTests.filter(lt=>inRange(lt.date, range) && labTestTotals(lt).price>0).sort((a,b)=>b.ts-a.ts);
  const sIn = tokens.length ? sAll.filter(s=>{ const h=_rsHay(s); return tokens.every(t=>h.indexOf(t)>=0); }) : sAll;
  const ltIn = tokens.length ? ltAll.filter(lt=>{ const d=String(lt.date||''); const [yy,mm,dd]=d.split('-'); const h=[lt.patientName||'', d.replace(/-/g,'/'), (dd&&mm&&yy)?(dd+'/'+mm+'/'+yy+' '+dd+'/'+mm):''].join(' ').toLowerCase(); return tokens.every(t=>h.indexOf(t)>=0); }) : ltAll;
  const shown = sIn.slice(0, _rsLimit);
  const rows = shown.map(s=>{
    const cust = s.customerName || 'ওয়াক-ইন কাস্টমার';
    const pn = (s.patientName||'').trim();
    const patientLine = (pn && pn !== (s.customerName||'').trim()) ? ` <span style="color:#7a5b00;font-weight:700;">• রোগী: ${escapeHtml(pn)}</span>` : '';
    const rid = 'rsResell_'+s.id;
    return `<div class="row-item" style="flex-wrap:wrap;">
      <div onclick="openReceiptFromReport('${s.id}')" style="cursor:pointer;flex:1 1 60%;min-width:0;"><div class="row-title">${escapeHtml(cust)}${patientLine}</div><div class="row-sub">${s.items.length} আইটেম • ${s.date}</div></div>
      <div class="row-right" onclick="openReceiptFromReport('${s.id}')" style="cursor:pointer;"><div class="row-title">${fmt(s.total)}</div><div class="row-sub">${s.payMethod==='due'?'বাকি':'নগদ'}</div></div>
      <div style="flex:1 1 100%;display:flex;gap:6px;margin-top:6px;" onclick="event.stopPropagation()">
        <input type="text" id="${rid}_amt" placeholder="🔁 এই হারে কত টাকার ওষুধ" inputmode="numeric" style="flex:1;min-width:0;">
        <button class="btn btn-sm btn-gold" style="flex-shrink:0;" onclick="resellFromHistoryByAmount('${s.id}','${rid}')">পাঠান</button>
      </div>
    </div>`;
  }).join('');
  const testRows = ltIn.map(lt=>{
    const x = labTestTotals(lt);
    return `<div class="row-item" onclick="closeModal('detailModalBackdrop');viewLabTestReceipt('${lt.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(lt.patientName)} <span class="tag-en">টেস্ট</span></div><div class="row-sub">${(lt.tests||[]).length} আইটেম • ${lt.date}</div></div>
      <div class="row-right"><div class="row-title">${fmt(x.price)}</div><div class="row-sub">নগদ</div></div>
    </div>`;
  }).join('');
  const more = sIn.length > shown.length ? `<button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="_rsLimit+=100;_rsRender()">আরও দেখুন (আরও ${sIn.length-shown.length}টা) ▼</button>` : '';
  const total = sIn.length + ltIn.length;
  document.getElementById('detailModalTitle').textContent = 'মোট বিক্রয় (' + (tokens.length ? total+'টা মিলেছে / '+(sAll.length+ltAll.length)+'টার মধ্যে' : total+'টা') + ')';
  document.getElementById('rsList').innerHTML = (rows+more+testRows) || `<div class="empty-state">${tokens.length?'এই নাম/তারিখে কোনো বিক্রয় পাওয়া যায়নি':'এই সময়কালে কোনো বিক্রয় নেই'}</div>`;
}
function showReportPurchases(){
  const range = document.getElementById('reportRange').value;
  const pInRange = purchases.filter(p=>inRange(p.date, range)).sort((a,b)=>b.ts-a.ts);
  const rows = pInRange.map(p=>`
    <div class="row-item" onclick="openPurchaseFrom('${p.id}','showReportPurchases')" style="cursor:pointer;">
      <div><div class="row-title">${medTypeTagFor(p.medicineId)}${escapeHtml(p.medicineName||'')}</div><div class="row-sub">${p.supplierName||_medCompanyOf(p.medicineId)||'সাপ্লায়ার নেই'} • ${p.date}</div></div>
      <div class="row-right"><div class="row-title">${fmt(p.qty*p.price)}</div><div class="row-sub">${p.qty} × ${fmt(p.price)}</div></div>
    </div>`).join('');
  document.getElementById('detailModalTitle').textContent = 'মোট ক্রয় (' + pInRange.length + 'টা)';
  document.getElementById('detailModalContent').innerHTML = rows || `<div class="empty-state">এই সময়কালে কোনো ক্রয় নেই</div>`;
  openModal('detailModalBackdrop');
}
function showReportProfit(){
  const range = document.getElementById('reportRange').value;
  const sInRange = sales.filter(s=>inRange(s.date, range)).sort((a,b)=>b.ts-a.ts);
  const ltInRange = labTests.filter(lt=>inRange(lt.date, range) && labTestTotals(lt).price>0).sort((a,b)=>b.ts-a.ts);
  let totalProfit = 0;
  const rows = sInRange.map(s=>{
    const cost = s.items.reduce((x,it)=>{ const med=medicines.find(m=>m.id===it.id); return x+(med?(med.buy||0)*it.qty:0); },0);
    const profit = s.total - cost;
    totalProfit += profit;
    return `<div class="row-item" onclick="closeModal('detailModalBackdrop');showReceiptById('${s.id}')" style="cursor:pointer;">
      <div><div class="row-title">${s.customerName||'ওয়াক-ইন কাস্টমার'}</div><div class="row-sub">বিক্রয়: ${fmt(s.total)} • ${s.date}</div></div>
      <div class="row-right"><div class="row-title">${fmt(profit)}</div><div class="row-sub">লাভ</div></div>
    </div>`;
  }).join('');
  const testRows = ltInRange.map(lt=>{
    const x = labTestTotals(lt);
    totalProfit += x.profit;
    return `<div class="row-item" onclick="closeModal('detailModalBackdrop');viewLabTestReceipt('${lt.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(lt.patientName)} <span class="tag-en">টেস্ট</span></div><div class="row-sub">বিক্রয়: ${fmt(x.price)} • ${lt.date}</div></div>
      <div class="row-right"><div class="row-title">${fmt(x.profit)}</div><div class="row-sub">লাভ</div></div>
    </div>`;
  }).join('');
  const hasAny = sInRange.length || ltInRange.length;
  document.getElementById('detailModalTitle').textContent = 'আনুমানিক লাভের হিসাব';
  document.getElementById('detailModalContent').innerHTML = (hasAny ? (rows+testRows) : `<div class="empty-state">এই সময়কালে কোনো বিক্রয় নেই</div>`) +
    (hasAny ? `<div class="row-item" style="border:none;margin-top:6px;padding-top:12px;border-top:1.5px solid #ddd;"><div class="row-title">সর্বমোট লাভ</div><div class="row-title">${fmt(totalProfit)}</div></div>` : '');
  openModal('detailModalBackdrop');
}
function showReportDue(){
  const range = document.getElementById('reportRange').value;
  const sInRange = sales.filter(s=>inRange(s.date, range) && s.payMethod==='due').sort((a,b)=>b.ts-a.ts);
  const rows = sInRange.map(s=>`
    <div class="row-item" onclick="closeModal('detailModalBackdrop');showReceiptById('${s.id}')" style="cursor:pointer;">
      <div><div class="row-title">${s.customerName||'ওয়াক-ইন কাস্টমার'}</div><div class="row-sub">${s.date}</div></div>
      <div class="row-right"><div class="row-title">${fmt(s.total)}</div><div class="row-sub">বাকি</div></div>
    </div>`).join('');
  document.getElementById('detailModalTitle').textContent = 'নতুন বাকি (' + sInRange.length + 'টা)';
  document.getElementById('detailModalContent').innerHTML = rows || `<div class="empty-state">এই সময়কালে নতুন বাকি নেই</div>`;
  openModal('detailModalBackdrop');
}

