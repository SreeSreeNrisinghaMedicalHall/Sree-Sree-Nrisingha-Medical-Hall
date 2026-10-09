/* ---------------- Navigation ---------------- */
const titles = {
  dashboard:['ড্যাশবোর্ড','আজকের ব্যবসার সংক্ষিপ্ত চিত্র'],
  sale:['বিক্রয় (POS)','দ্রুত বিল করুন'],
  prescription:['প্রেসক্রিপশন','প্রেসক্রিপশন লিখুন ও প্রিন্ট করুন'],
  medicines:['ওষুধ ইনভেন্টরি','স্টক পরিচালনা করুন'],
  purchase:['ক্রয়','সাপ্লায়ার থেকে স্টক আনুন'],
  customers:['কাস্টমার ও সাপ্লায়ার','বাকি ও যোগাযোগ তথ্য'],
  test:['টেস্ট রিপোর্ট','ল্যাব টেস্টের রিপোর্ট তৈরি ও প্রিন্ট করুন'],
  reports:['রিপোর্ট','ব্যবসার হিসাব দেখুন']
};
const STAFF_ALLOWED_SECTIONS = ['sale','purchase','customers'];
function showSection(name){
  // Defense in depth: block even a direct/console-triggered call into an owner-only section
  // while logged in as staff, not just hide the nav button for it.
  if(currentRole()==='staff' && !STAFF_ALLOWED_SECTIONS.includes(name)) name = 'sale';
  currentSection = name;
  document.querySelectorAll('section').forEach(s=>s.classList.remove('active'));
  document.getElementById('sec-'+name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.sec===name));
  document.getElementById('pageTitle').textContent = titles[name][0];
  document.getElementById('pageSub').textContent = titles[name][1];
  if(name==='dashboard') renderDashboard();
  if(name==='medicines') renderMedicines();
  if(name==='purchase'){ renderPurchaseSelects(); renderPurchases(); }
  if(name==='customers'){ try{renderCustomers();}catch(e){console.error(e);} try{renderSuppliers();}catch(e){console.error(e);} }
  if(name==='reports'){ renderReports(); updateCloudStatus(); updateLockUI(); applyRoleGating(); renderDeviceList(); }
  if(name==='sale'){ renderSaleCustomerSelect(); renderCart(); restorePrescriberFields(); }
  if(name==='test'){ renderLabTestList(); }
  if(name==='prescription'){ renderPrescriptionList(); }
}

/* ---------------- Modals ---------------- */
function openModal(id){ document.getElementById(id).classList.add('show'); }
// ক্রয়/মেমো খুলে দেখে বন্ধ করলে বা সেভ করলে যে তালিকা থেকে খুলেছিলেন সেই তালিকায়ই ফিরে যায় (সার্চ ও স্ক্রল সহ)
let _purchaseBack = null, _receiptBack = null;
function _detScrollGet(){ const b=document.getElementById('detailModalBackdrop'); const m=b&&b.querySelector('.modal'); return [b?b.scrollTop:0, m?m.scrollTop:0]; }
function _detScrollSet(v){ setTimeout(()=>{ try{ const b=document.getElementById('detailModalBackdrop'); const m=b&&b.querySelector('.modal'); if(b) b.scrollTop=v[0]; if(m) m.scrollTop=v[1]; }catch(e){} }, 30); }
function closeModal(id){
  document.getElementById(id).classList.remove('show');
  if(id==='purchaseModalBackdrop'){
    try{ renderPosSearch(); renderCart(); }catch(e){}
    if(_purchaseBack){ const f=_purchaseBack; _purchaseBack=null; setTimeout(()=>{ try{ f(); }catch(e){ console.error(e); } }, 0); }
  }
  if(id==='receiptModalBackdrop' && _receiptBack){ const f=_receiptBack; _receiptBack=null; setTimeout(()=>{ try{ f(); }catch(e){ console.error(e); } }, 0); }
}

// ===== লাভ/লোকসানের রং =====
// লাভ: সবুজ • শূন্য: সাধারণ • লোকসান: হলুদ (সামান্য — ৳৫০০ বা ওই সময়ের বিক্রয়ের ১০%, যেটা বেশি) • লাল (এর বেশি)
function _signedFmt(v){ v = Math.round((Number(v)||0)*100)/100; return v < 0 ? '−'+fmt(-v) : fmt(v); }
function _paintProfit(id, v, salesBase){
  const el = document.getElementById(id); if(!el) return;
  v = Math.round((Number(v)||0)*100)/100;
  let color = '', bg = '', note = '';
  if(v > 0){ color = '#067647'; bg = '#e8f6ed'; note = '▲ লাভ'; }
  else if(v < 0){
    const limit = Math.max(500, 0.10*(salesBase||0));
    if(-v <= limit){ color = '#a15c00'; bg = '#fff4d6'; note = '⚠ সামান্য লোকসান'; }
    else { color = '#b42318'; bg = '#fdecea'; note = '▼ লোকসান'; }
  }
  el.textContent = _signedFmt(v);
  el.style.color = color;
  const card = el.closest('.stat'); if(card) card.style.background = bg;
  let n = el.parentElement.querySelector('.pl-note');
  if(!n){ n = document.createElement('div'); n.className = 'pl-note row-sub'; n.style.cssText = 'font-weight:700;margin-top:2px;'; el.parentElement.appendChild(n); }
  n.textContent = note; n.style.color = color;
}
// ===== নিট লাভ = আনুমানিক লাভ − দোকানের খরচ (ক্যাশ হিসাব থেকে লেখা খরচ) =====
function _profitCalc(sList, ltList){
  const t = ltList.reduce((a,lt)=>{ const x=labTestTotals(lt); a.price+=x.price; a.profit+=x.profit; return a; }, {price:0, profit:0});
  const sale = sList.reduce((a,s)=>a+(s.total||0),0) + t.price;
  const cost = sList.reduce((a,s)=>a+s.items.reduce((x,i)=>{ const med=medicines.find(m=>m.id===i.id); return x+(med?((med.buy||0)*i.qty):0); },0),0);
  return { sale, profit: sale - cost - t.price + t.profit };
}
function _expensesIn(fn){ return payments.filter(p=>p.type==='expense' && fn(p.date)); }
function showReportExpenses(){
  const range = document.getElementById('reportRange').value;
  const list = _expensesIn(d=>inRange(d, range)).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const total = list.reduce((a,p)=>a+(p.amount||0),0);
  document.getElementById('detailModalTitle').textContent = 'দোকানের খরচ ('+list.length+'টা) • '+fmt(total);
  document.getElementById('detailModalContent').innerHTML = list.map(p=>`<div class="row-item"><div><div class="row-title">${escapeHtml(p.note||'খরচ')}</div><div class="row-sub">${p.date}</div></div><div class="row-right"><div class="row-title" style="color:#b42318;">${fmt(p.amount)}</div></div></div>`).join('') || '<div class="empty-state">এই সময়কালে কোনো খরচ লেখা নেই</div>';
  openModal('detailModalBackdrop');
}
function showProfitHistory(){
  const months = {};
  const slot = ym => (months[ym] = months[ym] || {sales:[], labs:[], exp:0});
  sales.forEach(x=>{ if(x.date) slot(x.date.slice(0,7)).sales.push(x); });
  labTests.forEach(x=>{ if(x.date) slot(x.date.slice(0,7)).labs.push(x); });
  payments.forEach(p=>{ if(p.type==='expense' && p.date) slot(p.date.slice(0,7)).exp += (p.amount||0); });
  const keys = Object.keys(months).sort().reverse();
  const rowsData = keys.map(k=>{ const m=months[k]; const c=_profitCalc(m.sales,m.labs); return {k, sale:c.sale, profit:c.profit, exp:m.exp, net:c.profit-m.exp}; });
  const sumOf = arr => arr.reduce((a,r)=>({sale:a.sale+r.sale, profit:a.profit+r.profit, exp:a.exp+r.exp, net:a.net+r.net}), {sale:0,profit:0,exp:0,net:0});
  const all = sumOf(rowsData);
  const mNames = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  const cell = (t,v,color)=>`<div style="text-align:right;"><div class="row-sub" style="font-size:11px;">${t}</div><div style="font-weight:700;color:${color||'inherit'};">${_signedFmt(v)}</div></div>`;
  const _st = r => { // নিট লাভের অবস্থা: রং + লেখা (ড্যাশবোর্ডের নিয়মেই)
    if(r.net > 0.005) return {c:'#067647', bg:'#e8f6ed', t:'▲ লাভ'};
    if(r.net < -0.005) return (-r.net <= Math.max(500, 0.10*r.sale)) ? {c:'#a15c00', bg:'#fff4d6', t:'⚠ সামান্য লোকসান'} : {c:'#b42318', bg:'#fdecea', t:'▼ লোকসান'};
    return {c:'inherit', bg:'#f7faf8', t:''};
  };
  const card = (title, r, big)=>{ const st = _st(r); return `<div style="padding:10px 12px;margin-top:8px;border-radius:12px;background:${st.bg};border:${big?'2px':'1px'} solid ${st.c==='inherit'?'#d6e4dc':st.c};">
      <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;"><span style="font-weight:800;">${title}</span><span style="font-weight:800;color:${st.c};">${st.t}</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">${cell('বিক্রয়',r.sale)}${cell('আনুমানিক লাভ',r.profit, r.profit<0?'#b42318':'')}${cell('খরচ',r.exp,'#b42318')}${cell('নিট লাভ',r.net, st.c)}</div></div>`; };
  let html = card('সর্বমোট (শুরু থেকে এখন পর্যন্ত)', all, true);
  const years = [...new Set(keys.map(k=>k.slice(0,4)))];
  years.forEach(y=>{
    const yr = rowsData.filter(r=>r.k.startsWith(y));
    html += `<div style="margin-top:14px;font-weight:800;font-size:16px;">${y} সাল</div>` + card(y+' সালের মোট', sumOf(yr), true);
    yr.forEach(r=>{ html += card(mNames[parseInt(r.k.slice(5,7))-1]+' '+y, r, false); });
  });
  document.getElementById('detailModalTitle').textContent = '📈 লাভ-খরচের ইতিহাস';
  document.getElementById('detailModalContent').innerHTML = (keys.length ? html : '<div class="empty-state">এখনো কোনো হিসাব নেই</div>') +
    `<div class="row-sub" style="margin-top:10px;line-height:1.5;">নিট লাভ = আনুমানিক লাভ − ক্যাশ হিসাবে লেখা দোকানের খরচ। ওষুধের কেনা দাম (ক্রয়মূল্য) ঠিকমতো লেখা না থাকলে আনুমানিক লাভ বেশি দেখাতে পারে।</div>`;
  openModal('detailModalBackdrop');
}
// ===== ক্যাশ হিসাব: একটা দিনে ক্যাশ বাক্সে কত টাকা থাকার কথা =====
// ঢোকা: নগদ বিক্রয় (শুধু নগদ পাওয়া অংশ — বাকি অংশ নয়) + টেস্ট ফি + কাস্টমারের বাকি জমা
// বেরোনো: নগদ ক্রয় (বাকিতে ক্রয় বাদ) + সাপ্লায়ারকে পরিশোধ + ডাক্তারের কমিশন পরিশোধ + দোকানের অন্যান্য খরচ
// শুরুর ক্যাশ ও গুনে পাওয়া ক্যাশ আপনি নিজে লিখবেন (এই ফোনেই সেভ থাকে)।
function _saleCash(s){ return (s.cashPaidNow!==undefined && s.cashPaidNow!==null) ? (s.cashPaidNow||0) : Math.max(0,(s.total||0)-(s.dueAdded||0)); }
function computeCashDay(d){
  const daySales = sales.filter(x=>x.date===d);
  const dayLab = labTests.filter(x=>x.date===d);
  const dayPay = payments.filter(p=>p.date===d);
  const collections = dayPay.filter(p=>p.customerId && !p.type);
  const supPaid = dayPay.filter(p=>p.type==='supplier_payment');
  const commPaid = dayPay.filter(p=>p.type==='referrer_commission');
  const expList = dayPay.filter(p=>p.type==='expense');   // দোকানের অন্যান্য খরচ (payments-এর মধ্যেই type:'expense' হিসেবে সেভ হয়)
  const dayPur = purchases.filter(p=>p.date===d);
  const cashPur = dayPur.filter(p=>!p.credit);
  const creditPur = dayPur.filter(p=>p.credit);
  const sum = (arr,f)=>arr.reduce((a,x)=>a+(f(x)||0),0);
  const r = {
    saleCash: sum(daySales,_saleCash), saleCount: daySales.length,
    saleDue: sum(daySales,x=>x.dueAdded||0),
    lab: sum(dayLab,x=>labTestTotals(x).price), labCount: dayLab.length,
    coll: sum(collections,x=>x.amount), collections,
    purCash: sum(cashPur,x=>x.qty*x.price), purCashCount: cashPur.length,
    purCredit: sum(creditPur,x=>x.qty*x.price),
    supPaid: sum(supPaid,x=>x.amount), supPaidList: supPaid,
    comm: sum(commPaid,x=>x.amount),
    exp: sum(expList,x=>x.amount), expList
  };
  r.cashIn = r.saleCash + r.lab + r.coll;
  r.cashOut = r.purCash + r.supPaid + r.comm + r.exp;
  r.net = r.cashIn - r.cashOut;
  return r;
}
const _cashKey = (k,d)=>'ssn_cash_'+k+'_'+d;
function _cashGet(k,d){ try{ const v = localStorage.getItem(_cashKey(k,d)); return (v===null||v==='')?null:parseFloat(v); }catch(e){ return null; } }
function updateCashTile(){
  const el = document.getElementById('dCash'); if(!el) return;
  const d = todayStr(); const r = computeCashDay(d); const open = _cashGet('open', d);
  el.textContent = fmt((open||0) + r.net);
  const sub = document.getElementById('dCashSub');
  if(sub) sub.textContent = (open!==null ? 'শুরুর '+fmt(open)+' + ' : '') + 'ঢুকেছে '+fmt(r.cashIn)+' − বেরিয়েছে '+fmt(r.cashOut);
}
function showCashBook(d){
  d = (typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? d : todayStr();
  const r = computeCashDay(d);
  const open = _cashGet('open', d), counted = _cashGet('count', d);
  const expected = (open||0) + r.net;
  const custName = id=>{ const c = customers.find(x=>x.id===id); return c ? c.name : 'কাস্টমার'; };
  const supName = id=>{ const x = suppliers.find(y=>y.id===id); return x ? x.name : 'সাপ্লায়ার'; };
  const line = (label, sub, amt, color)=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px dashed #e3e3e3;"><div style="min-width:0;overflow-wrap:anywhere;"><div style="font-weight:600;">${label}</div>${sub?`<div class="row-sub">${sub}</div>`:''}</div><div style="font-weight:700;white-space:nowrap;color:${color};">${fmt(amt)}</div></div>`;
  const head = (t,amt,color)=>`<div style="display:flex;justify-content:space-between;margin:14px 0 2px;padding:6px 10px;border-radius:8px;background:${color==='#067647'?'#e6f4ea':'#fdecea'};font-weight:800;"><span>${t}</span><span style="color:${color};">${fmt(amt)}</span></div>`;
  const G='#067647', R='#b42318';
  const collRows = r.collections.sort((a,b)=>(b.ts||0)-(a.ts||0)).map(p=>{
    const tm = p.ts ? new Date(p.ts).toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'}) : '';
    return line('↳ '+escapeHtml(custName(p.customerId))+(p.forName?' <span class="row-sub">(নামে: '+escapeHtml(p.forName)+')</span>':''), tm, p.amount, G);
  }).join('');
  const expRows = r.expList.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)).map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #e3e3e3;"><div style="min-width:0;overflow-wrap:anywhere;">↳ ${escapeHtml(p.note||'খরচ')}</div><div style="display:flex;align-items:center;gap:8px;white-space:nowrap;"><b style="color:#b42318;">${fmt(p.amount)}</b><button class="btn btn-sm btn-outline" style="padding:2px 8px;" onclick="deleteExpense('${p.id}','${d}')">✕</button></div></div>`).join('');
  const supRows = r.supPaidList.map(p=>line('↳ '+escapeHtml(supName(p.supplierId)), '', p.amount, R)).join('');
  let diffHtml = '';
  if(counted!==null){
    const diff = counted - expected;
    diffHtml = `<div style="margin-top:8px;padding:10px;border-radius:10px;font-weight:800;background:${Math.abs(diff)<0.5?'#e6f4ea':'#fff4e5'};">${Math.abs(diff)<0.5?'✅ ক্যাশ ঠিকঠাক মিলেছে':(diff<0?'⚠️ ক্যাশ কম আছে: '+fmt(-diff):'⚠️ ক্যাশ বেশি আছে: '+fmt(diff))}</div>`;
  }
  document.getElementById('detailModalTitle').textContent = '💰 ক্যাশ হিসাব';
  document.getElementById('detailModalContent').innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="date" value="${d}" onchange="showCashBook(this.value)" style="flex:1;min-width:0;">
      ${d!==todayStr()?`<button class="btn btn-sm btn-outline" onclick="showCashBook()">আজ</button>`:''}
    </div>
    <div style="margin-top:10px;">
      <label class="row-sub">এই দিনের শুরুতে ক্যাশে কত ছিল (টাকা)</label>
      <input type="number" inputmode="decimal" id="cashOpenInp" value="${open!==null?open:''}" placeholder="যেমন: ৫০০" oninput="_cashLive('open','${d}',this.value)" style="width:100%;box-sizing:border-box;">
    </div>
    ${head('➕ ক্যাশে ঢুকেছে', r.cashIn, G)}
    ${line('নগদ বিক্রয়', r.saleCount+'টা বিক্রয়'+(r.saleDue>0?' • বাকিতে গেছে '+fmt(r.saleDue)+' (ক্যাশে ঢোকেনি)':''), r.saleCash, G)}
    ${r.lab>0?line('টেস্ট ফি', r.labCount+'টা', r.lab, G):''}
    ${line('কাস্টমারের বাকি জমা', r.collections.length+' জন/বার', r.coll, G)}
    ${collRows}
    ${head('➖ ক্যাশ থেকে বেরিয়েছে', r.cashOut, R)}
    ${line('নগদ ক্রয়', r.purCashCount+'টা'+(r.purCredit>0?' • বাকিতে ক্রয় '+fmt(r.purCredit)+' (ক্যাশ যায়নি)':''), r.purCash, R)}
    ${line('সাপ্লায়ারকে টাকা পরিশোধ', '', r.supPaid, R)}
    ${supRows}
    ${r.comm>0?line('ডাক্তারের কমিশন পরিশোধ','',r.comm,R):''}
    ${line('দোকানের খরচ', r.expList.length+'টা', r.exp, R)}
    ${expRows}
    <div style="margin-top:8px;padding:10px;border:1px dashed #c9d6cf;border-radius:12px;">
      <div style="font-weight:700;margin-bottom:6px;">+ খরচ লিখুন</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">${['চা-নাস্তা','বেতন','দোকান ভাড়া','বিদ্যুৎ/ইন্টারনেট বিল','যাতায়াত','অন্যান্য'].map(c=>`<button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('expNote').value='${c}'">${c}</button>`).join('')}</div>
      <div style="display:flex;gap:6px;">
        <input type="number" inputmode="decimal" id="expAmt" placeholder="টাকা" style="flex:1;min-width:0;">
        <input type="text" id="expNote" placeholder="কীসের খরচ" style="flex:2;min-width:0;">
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:8px;" onclick="addExpense('${d}')">খরচ যোগ করুন</button>
    </div>
    <div style="margin-top:14px;padding:12px;border-radius:12px;background:#f1f6f3;border:1px solid #d6e4dc;">
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:17px;"><span>ক্যাশে থাকার কথা</span><span id="cashExpVal">${fmt(expected)}</span></div>
      <div class="row-sub" id="cashExpSub">${open!==null?'শুরুর '+fmt(open)+' + ':''}ঢুকেছে ${fmt(r.cashIn)} − বেরিয়েছে ${fmt(r.cashOut)}</div>
    </div>
    <div style="margin-top:10px;">
      <label class="row-sub">বাক্সে গুনে আসলে কত পেলেন (টাকা) — মিলিয়ে দেখতে</label>
      <input type="number" inputmode="decimal" value="${counted!==null?counted:''}" placeholder="গুনে লিখুন" oninput="_cashLive('count','${d}',this.value)" style="width:100%;box-sizing:border-box;">
    </div>
    <div id="cashDiffBox">${diffHtml}</div>
    <div class="row-sub" style="margin-top:10px;line-height:1.5;">নোট: খরচ লিখলে ক্যাশের হিসাবে বাদ যায় (ক্লাউডেও সেভ হয়)। "আজকের নিট লাভ" কার্ডে এই খরচ বাদ ধরা হয়। শুরুর ও গুনে পাওয়া ক্যাশ শুধু এই ফোনে সেভ থাকে।</div>`;
  openModal('detailModalBackdrop');
}
function addExpense(d){
  const amt = parseFloat(document.getElementById('expAmt').value);
  const note = (document.getElementById('expNote').value||'').trim();
  if(!(amt>0)){ toast('খরচের টাকা লিখুন'); return; }
  if(!note){ toast('কীসের খরচ লিখুন (বা উপরের বাটন চাপুন)'); return; }
  const isToday = (d===todayStr());
  const ts = isToday ? Date.now() : new Date(d+'T12:00:00').getTime();
  const id = uid();
  const rec = { customerId:undefined, amount:amt, ts, date:d, type:'expense', note };
  delete rec.customerId;
  payments.push(Object.assign({id}, rec));
  save(DB_KEYS.payment, payments);
  try{ if(cloudReady()) shopColl('payments').doc(id).set(rec).catch(e=>console.error(e)); }catch(e){}
  toast('খরচ যোগ হয়েছে ✓'); showCashBook(d); try{ updateCashTile(); }catch(e){}
}
function deleteExpense(id, d){
  if(!confirm('এই খরচটা মুছে ফেলবেন?')) return;
  addTombstone(id);   // save()-এর স্টেল-রিকভারি যেন ফেরত না আনে
  payments = payments.filter(p=>p.id!==id);
  save(DB_KEYS.payment, payments);
  try{ if(cloudReady()) shopColl('payments').doc(id).delete().catch(e=>console.error(e)); }catch(e){}
  toast('মুছে ফেলা হয়েছে'); showCashBook(d); try{ updateCashTile(); }catch(e){}
}
// টাইপ করার সাথে সাথে হিসাব বদলায় — বাইরে ট্যাপ করতে হয় না, আর কিবোর্ড/ফোকাসও সরে না।
function _cashLive(k, d, v){
  try{ if(v===''||v===null) localStorage.removeItem(_cashKey(k,d)); else localStorage.setItem(_cashKey(k,d), String(parseFloat(v)||0)); }catch(e){}
  const r = computeCashDay(d), open = _cashGet('open', d), counted = _cashGet('count', d);
  const expected = (open||0) + r.net;
  const ev = document.getElementById('cashExpVal'); if(ev) ev.textContent = fmt(expected);
  const es = document.getElementById('cashExpSub'); if(es) es.textContent = (open!==null?'শুরুর '+fmt(open)+' + ':'')+'ঢুকেছে '+fmt(r.cashIn)+' − বেরিয়েছে '+fmt(r.cashOut);
  const db = document.getElementById('cashDiffBox');
  if(db){
    if(counted===null) db.innerHTML = '';
    else { const diff = counted - expected; db.innerHTML = `<div style="margin-top:8px;padding:10px;border-radius:10px;font-weight:800;background:${Math.abs(diff)<0.5?'#e6f4ea':'#fff4e5'};">${Math.abs(diff)<0.5?'✅ ক্যাশ ঠিকঠাক মিলেছে':(diff<0?'⚠️ ক্যাশ কম আছে: '+fmt(-diff):'⚠️ ক্যাশ বেশি আছে: '+fmt(diff))}</div>`; }
  }
  try{ updateCashTile(); }catch(e){}
}
function _cashSet(k, d, v){
  try{ if(v===''||v===null) localStorage.removeItem(_cashKey(k,d)); else localStorage.setItem(_cashKey(k,d), String(parseFloat(v)||0)); }catch(e){}
  showCashBook(d); try{ updateCashTile(); }catch(e){}
}
/* ---------------- Dashboard ---------------- */
function renderDashboard(){
  const t = todayStr();
  const todaySales = sales.filter(s=>s.date===t);
  const todayPurchases = purchases.filter(p=>p.date===t);
  const todayLabTests = labTests.filter(lt=>lt.date===t);
  const todayTestSums = todayLabTests.reduce((a,lt)=>{ const x=labTestTotals(lt); a.price+=x.price; a.profit+=x.profit; return a; }, {price:0, profit:0});
  document.getElementById('dToday').textContent = fmt(todaySales.reduce((a,s)=>a+s.total,0) + todayTestSums.price);
  document.getElementById('dPurchase').textContent = fmt(todayPurchases.reduce((a,p)=>a+p.qty*p.price,0));
  const todayCost = todaySales.reduce((a,s)=>a+s.items.reduce((x,it)=>{ const med=medicines.find(m=>m.id===it.id); return x+(med?(med.buy||0)*it.qty:0); },0),0);
  const todayProfit = todaySales.reduce((a,s)=>a+s.total,0) - todayCost + todayTestSums.profit;
  const _dBase = sales.filter(x=>x.date===t).reduce((a,x)=>a+(x.total||0),0);
  _paintProfit('dProfit', todayProfit, _dBase);
  { const _te = _expensesIn(d=>d===t).reduce((a,p)=>a+(p.amount||0),0); const _n = document.getElementById('dNet'); if(_n) _paintProfit('dNet', todayProfit - _te, _dBase); }
  document.getElementById('dDue').textContent = fmt(customers.reduce((a,c)=>a+Math.max(Math.round(c.due||0),0),0));
  const low = medicines.filter(m=>m.stock<=m.lowLimit);
  document.getElementById('dLowStock').textContent = low.length;
  try{ updateCashTile(); }catch(e){}
  // "আজকের আনুমানিক লাভ" turning into ৳NaN almost always traces back to exactly one medicine
  // with no ক্রয়মূল্য on file (buy missing/blank) — this points straight at it instead of
  // leaving the owner to guess from a bare NaN.
  const missingBuy = medicines.filter(m=>m.buy==null || isNaN(m.buy) || m.buy<=0);
  const missingBuyEl = document.getElementById('missingBuyWarn');
  if(missingBuyEl){
    if(missingBuy.length){
      missingBuyEl.style.display = 'block';
      missingBuyEl.innerHTML = `<div class="row-sub" style="color:var(--red);font-weight:700;margin-bottom:4px;">⚠ এই ওষুধগুলোর ক্রয়মূল্য নেই — এই কারণেই লাভের হিসাবে ৳NaN আসতে পারে। ওষুধ ট্যাবে গিয়ে ক্রয়মূল্য বসিয়ে দিন:</div>` +
        missingBuy.slice(0,8).map(m=>`<div class="row-sub" style="cursor:pointer;" onclick="goToMedicine('${m.id}')">• ${escapeHtml(m.name||'')}</div>`).join('') +
        (missingBuy.length>8 ? `<div class="row-sub">…আরও ${missingBuy.length-8}টি</div>` : '');
    } else {
      missingBuyEl.style.display = 'none';
    }
  }
  // হারানো-কাস্টমার সতর্কতা (শুধু মালিকের জন্য): বিক্রয়ে যার আইডি আছে কিন্তু কাস্টমার তালিকায় নেই — এমন কেউ থাকলে
  // ড্যাশবোর্ডেই সাথে সাথে দেখা যাবে, যাতে চুপচাপ হারিয়ে গেলে প্রথম দিনেই ধরা পড়ে।
  try{
    const mcEl = document.getElementById('missingCustWarn');
    if(mcEl){
      let ign = []; try{ ign = JSON.parse(localStorage.getItem('ssn_ignored_missing_cust')||'[]'); }catch(e){}
      const miss = currentRole()==='owner' ? findMissingCustomers(true).filter(f=>!ign.includes(f.id)) : [];
      if(miss.length){
        mcEl.style.display = 'block';
        mcEl.innerHTML = `<div class="row-sub" style="color:var(--red);font-weight:700;margin-bottom:4px;">⚠ ${miss.length} জন কাস্টমারের বিক্রয় আছে কিন্তু কাস্টমার তালিকায় নেই:</div>` +
          miss.slice(0,5).map(f=>`<div class="row-sub">• ${escapeHtml(f.name)} — ${f.count}টা বিক্রয়${f.due>0?', বাকি '+fmt(f.due):''}</div>`).join('') +
          (miss.length>5 ? `<div class="row-sub">…আরও ${miss.length-5} জন</div>` : '') +
          `<button class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="recoverMissingCustomers()">🧩 বেছে ফিরিয়ে আনুন</button>`;
      } else { mcEl.style.display = 'none'; }
    }
  }catch(e){ console.error('missing-customer banner failed', e); }

  const soon = medicines.filter(m=>m.expiry).map(m=>({...m, days:(new Date(m.expiry)-new Date())/86400000})).filter(m=>m.days<60).sort((a,b)=>a.days-b.days);
  const expiryEl = document.getElementById('expiryList');
  expiryEl.innerHTML = soon.length ? soon.slice(0,5).map(m=>`
    <div class="row-item" onclick="goToMedicine('${m.id}')" style="cursor:pointer;"><div><div class="row-title">${escapeHtml(m.name||'')}</div><div class="row-sub">ব্যাচ: ${m.batch||'—'}</div></div>
    <span class="badge ${m.days<0?'badge-red':'badge-gold'}">${m.days<0?'মেয়াদ শেষ':Math.ceil(m.days)+' দিন বাকি'}</span></div>`).join('') : `<div class="empty-state">কোনো সতর্কতা নেই ✓</div>`;
  const expiryShowAllBtn = document.getElementById('expiryShowAllBtn');
  if(expiryShowAllBtn) expiryShowAllBtn.style.display = soon.length>5 ? 'block' : 'none';

  const lowEl = document.getElementById('lowStockList');
  lowEl.innerHTML = low.length ? low.slice(0,5).map(m=>`
    <div class="row-item" onclick="goToMedicine('${m.id}')" style="cursor:pointer;"><div class="row-title">${escapeHtml(m.name||'')}</div><span class="badge badge-red">স্টক: ${m.stock}</span></div>`).join('') : `<div class="empty-state">সব ওষুধে পর্যাপ্ত স্টক আছে ✓</div>`;

  const recentEl = document.getElementById('recentSales');
  const recent = [...sales].sort((a,b)=>b.ts-a.ts).slice(0,5);
  recentEl.innerHTML = recent.length ? recent.map(s=>`
    <div class="row-item" onclick="showReceiptById('${s.id}')" style="cursor:pointer;"><div><div class="row-title">${s.customerName||'ওয়াক-ইন কাস্টমার'}</div><div class="row-sub">${s.items.length} আইটেম</div></div>
    <div class="row-right"><div class="row-title">${fmt(s.total)}</div><div class="row-sub">${s.payMethod==='due'?'বাকি':'নগদ'}</div></div></div>`).join('') : `<div class="empty-state">এখনো কোনো বিক্রয় হয়নি</div>`;
}

