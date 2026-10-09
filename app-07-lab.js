/* ---------------- Lab Test Reports ---------------- */
const TEST_NAMES = [
  'Blood Grouping','Dengue NS1 Antigen','Dengue IgG','Dengue IgM','Pregnancy Test (UPT)',
  'HBsAg','VDRL','Malaria (MP)','Blood Sugar (Random)','CRP (C-Reactive Protein)',
  'RA Test (Rheumatoid Factor)','Widal Test','ESR','ASO Titre','CBC (Complete Blood Count)',
  'H. Pylori','Other (Custom)'
];
const TEST_QUICK_RESULTS = {
  'Blood Grouping': ['A+ve','A-ve','B+ve','B-ve','AB+ve','AB-ve','O+ve','O-ve'],
  'Dengue NS1 Antigen': ['Positive','Negative'],
  'Dengue IgG': ['Positive','Negative'],
  'Dengue IgM': ['Positive','Negative'],
  'Pregnancy Test (UPT)': ['Positive','Negative'],
  'HBsAg': ['Positive','Negative'],
  'VDRL': ['Reactive','Non-Reactive'],
  'Malaria (MP)': ['Positive','Negative'],
  'CRP (C-Reactive Protein)': ['Positive','Negative'],
  'RA Test (Rheumatoid Factor)': ['Positive','Negative'],
  'H. Pylori': ['Positive','Negative']
};
let _testRows = [];

// ===== Widal Test — ছক আকারে ফলাফল (শুধু ডাইলিউশন বেছে নিন) =====
const WIDAL_TITRES = ['Negative','1:20','1:40','1:80','1:160','1:320','1:640'];
const WIDAL_ANTIGENS = [['o','S. Typhi O (TO)'],['h','S. Typhi H (TH)'],['ah','S. Paratyphi AH'],['bh','S. Paratyphi BH']];
function widalSummary(w){ w=w||{}; return WIDAL_ANTIGENS.filter(([k])=>w[k]).map(([k])=>k.toUpperCase()+': '+w[k]).join(' | '); }
function parseWidalResult(txt){
  txt = String(txt||''); const out = {}; const g = re=>{ const m = txt.match(re); return m ? m[1].replace(/\s+/g,'') : ''; };
  const val = '(1\\s*:\\s*\\d+|neg\\w*)';
  out.o = g(new RegExp('\\bO[D]?\\s*:\\s*'+val,'i')); out.h = g(new RegExp('\\bH[D]?\\s*:\\s*'+val,'i'));
  out.ah = g(new RegExp('\\b(?:HA|AH)\\s*:\\s*'+val,'i')); out.bh = g(new RegExp('\\b(?:HB|BH)\\s*:\\s*'+val,'i'));
  return Object.values(out).some(Boolean) ? out : undefined;
}
function widalInputsHtml(row, idx){
  const w = row.widal || {};
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;">` + WIDAL_ANTIGENS.map(([k,label])=>{
    const opts = WIDAL_TITRES.slice(); if(w[k] && !opts.includes(w[k])) opts.push(w[k]);
    return `<div><div class="row-sub">${label}</div><select onchange="onWidalChange(${idx},'${k}',this.value)" style="width:100%;"><option value="">— বেছে নিন —</option>${opts.map(v=>`<option value="${escapeHtml(v)}" ${w[k]===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></div>`;
  }).join('') + `</div>`;
}
function onWidalChange(idx,k,v){ const r=_testRows[idx]; r.widal = r.widal||{}; r.widal[k]=v; r.result = widalSummary(r.widal); }
function widalReportRowHtml(i,t){
  const w = t.widal||{}; const cell='padding:3px 4px;border:1px solid #000;';
  const rows = WIDAL_ANTIGENS.map(([k,label])=>`<tr><td style="${cell}">${label}</td><td style="${cell}text-align:center;font-weight:700;">${w[k]?escapeHtml(w[k]):'—'}</td></tr>`).join('');
  return `<tr><td class="num" style="vertical-align:top;">${i+1}.</td><td colspan="2"><b>Widal Test</b>
    <table style="width:100%;border-collapse:collapse;margin-top:4px;"><thead><tr><th style="${cell}text-align:left;">Antigen</th><th style="${cell}text-align:center;">Titre</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="font-size:0.8em;margin-top:3px;">Significant titre: O ≥ 1:80, H ≥ 1:160 (clinical findings সহ বিবেচ্য)</div></td></tr>`;
}
// Sums a lab test record's per-test price/cost (both optional — records saved without
// pricing just come back as {price:0, cost:0, profit:0}, which keeps them invisible to the
// dashboard/report totals below).
function labTestTotals(rec){
  let rawPrice = 0, cost = 0;
  (rec.tests||[]).forEach(t=>{ rawPrice += (t.price||0); cost += (t.cost||0); });
  // ডাক্তার প্রেসক্রিপশনে "X% less" লিখে দিলে রোগীর বিল থেকে সেই টাকাটা বাদ যায়, আর ঠিক ততটাই
  // ডাক্তারের কমিশন থেকে কাটা হয় (commissionAmount ইতিমধ্যে discountAmount বাদ দিয়েই বসানো —
  // saveLabTest দ্রষ্টব্য) — ফলে দোকান-মালিকের লাভ discount দেওয়ার আগে-পরে একই থাকে।
  const discount = rec.discountAmount || 0;
  const price = Math.max(0, rawPrice - discount);
  const commission = rec.commissionAmount || 0;
  return { price, rawPrice, cost, discount, profit: price - cost - commission };
}
// Records saved before this feature existed have no paidAmount field at all — those are
// treated as fully paid (their receipt was always the full price), so due stays ০ for them
// unless the owner later opens the record and lowers the paid amount explicitly.
function labTestDue(rec){
  const price = labTestTotals(rec).price;
  const paid = (rec.paidAmount!=null) ? rec.paidAmount : price;
  return Math.max(price - paid, 0);
}
/* ---- টেস্ট মূল্য তালিকা (per-test default price/cost, like the ওষুধ inventory) ---- */
function findTestPrice(name){ return testPrices.find(p=>p.name===name); }
// The dropdown in the টেস্ট রিপোর্ট form isn't limited to the ~16 built-in TEST_NAMES anymore —
// any test added here (via "+ নতুন টেস্ট যোগ করুন") shows up there too, right alongside them.
function getAllTestNames(){
  const base = TEST_NAMES.filter(n=>n!=='Other (Custom)');
  const extra = testPrices.map(p=>p.name).filter(n=>n && !base.includes(n));
  return [...base, ...extra, 'Other (Custom)'];
}
function applyTestPriceDefaults(row){
  if(row.name==='Other (Custom)') return row;
  const p = findTestPrice(row.name);
  if(p){ row.price = p.price||''; row.cost = p.cost||''; }
  return row;
}
function openTestPriceListModal(){
  renderTestPriceList();
  openModal('testPriceListModalBackdrop');
}
function renderTestPriceList(){
  const el = document.getElementById('testPriceList');
  if(!el) return;
  const builtIn = TEST_NAMES.filter(n=>n!=='Other (Custom)');
  const names = getAllTestNames().filter(n=>n!=='Other (Custom)');
  el.innerHTML = names.map((n,idx)=>{
    const p = findTestPrice(n);
    // Index-based id (not sanitized-name-based) since custom test names are often typed in
    // Bengali — stripping non-Latin characters for an id would collapse several different
    // Bengali test names down to the same empty-suffix id and collide.
    const id = 'tp_'+idx;
    const isCustom = !builtIn.includes(n);
    return `<div class="row-item">
      <div style="flex:1;"><div class="row-title" style="font-size:13.5px;">${escapeHtml(n)}${isCustom?' <span class="tag-en">কাস্টম</span>':''}</div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <input type="number" min="0" placeholder="মূল্য ৳" id="${id}_price" value="${p?p.price:''}" style="flex:1;">
          <input type="number" min="0" placeholder="খরচ ৳ (ঐচ্ছিক)" id="${id}_cost" value="${p&&p.cost?p.cost:''}" style="flex:1;">
          <button class="btn btn-sm btn-outline" style="flex-shrink:0;" onclick="saveTestPrice('${n.replace(/'/g,"\\'")}','${id}')">সংরক্ষণ</button>
        </div>
        ${isCustom?`<button class="btn btn-sm btn-outline" style="margin-top:6px;color:var(--red,#c0392b);" onclick="deleteCustomTest('${n.replace(/'/g,"\\'")}')">এই টেস্টটি মুছে ফেলুন</button>`:''}
      </div>
    </div>`;
  }).join('');
}
function saveTestPrice(name, id){
  const price = parseFloat(document.getElementById(id+'_price').value)||0;
  const cost = parseFloat(document.getElementById(id+'_cost').value)||0;
  let p = findTestPrice(name);
  if(p){ p.price = price; p.cost = cost; }
  else { p = {id:uid(), name, price, cost}; testPrices.push(p); }
  save(DB_KEYS.testPrice, testPrices);
  if(cloudReady()){ const {id:pid, ...fields} = p; shopColl('testPrices').doc(pid).set(fields, {merge:true}).catch(e=>console.error(e)); }
  toast('মূল্য সংরক্ষিত হয়েছে ✓');
}
function openNewTestPriceModal(){
  document.getElementById('ntpName').value = '';
  document.getElementById('ntpPrice').value = '';
  document.getElementById('ntpCost').value = '';
  openModal('newTestPriceModalBackdrop');
}
function saveNewTestPrice(){
  const name = document.getElementById('ntpName').value.trim();
  if(!name){ toast('টেস্টের নাম দিন'); return; }
  if(getAllTestNames().some(n=>n.toLowerCase()===name.toLowerCase())){ toast('এই নামে একটা টেস্ট আগে থেকেই তালিকায় আছে'); return; }
  const price = parseFloat(document.getElementById('ntpPrice').value)||0;
  const cost = parseFloat(document.getElementById('ntpCost').value)||0;
  const p = {id:uid(), name, price, cost};
  testPrices.push(p);
  save(DB_KEYS.testPrice, testPrices);
  if(cloudReady()){ const {id:pid, ...fields} = p; shopColl('testPrices').doc(pid).set(fields, {merge:true}).catch(e=>console.error(e)); }
  closeModal('newTestPriceModalBackdrop');
  toast('নতুন টেস্ট যোগ করা হয়েছে ✓');
  renderTestPriceList();
}
function deleteCustomTest(name){
  if(!confirm(`"${name}" টেস্টটা তালিকা থেকে মুছে ফেলতে চান?`)) return;
  const p = findTestPrice(name);
  testPrices = testPrices.filter(x=>x.name!==name);
  save(DB_KEYS.testPrice, testPrices);
  if(cloudLive && p) shopColl('testPrices').doc(p.id).delete().catch(e=>console.error(e));
  toast('টেস্টটা মুছে ফেলা হয়েছে');
  renderTestPriceList();
}
function addTestRow(){
  _testRows.push(applyTestPriceDefaults({name:'Blood Grouping', customName:'', result:'', price:'', cost:''}));
  renderTestRows();
}
function removeTestRow(idx){
  _testRows.splice(idx,1);
  if(!_testRows.length) _testRows.push(applyTestPriceDefaults({name:'Blood Grouping', customName:'', result:'', price:'', cost:''}));
  renderTestRows();
}
function onTestRowNameChange(idx, val){
  _testRows[idx].name = val;
  _testRows[idx].result = '';
  _testRows[idx].widal = undefined;
  applyTestPriceDefaults(_testRows[idx]);
  renderTestRows();
}
function onTestRowCustomNameChange(idx, val){ _testRows[idx].customName = val; }
function onTestRowResultChange(idx, val){ _testRows[idx].result = val; }
function onTestRowPriceChange(idx, val){ _testRows[idx].price = val; }
function onTestRowCostChange(idx, val){ _testRows[idx].cost = val; }
function pickTestRowResult(idx, val){
  _testRows[idx].result = val;
  renderTestRows();
}
function renderTestRows(){
  const wrap = document.getElementById('testRowsWrap');
  if(!wrap) return;
  wrap.innerHTML = _testRows.map((row,idx)=>{
    const quick = TEST_QUICK_RESULTS[row.name];
    const quickHtml = quick ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">${
      quick.map(o=>`<button type="button" class="btn ${row.result===o?'btn-primary':'btn-outline'}" onclick="pickTestRowResult(${idx},'${o}')" style="flex:0 0 auto;padding:6px 12px;font-size:13px;">${o}</button>`).join('')
    }</div>` : '';
    const customNameHtml = row.name==='Other (Custom)' ? `<input type="text" placeholder="Test name" value="${escapeHtml(row.customName||'')}" oninput="onTestRowCustomNameChange(${idx}, this.value)" style="margin-top:6px;">` : '';
    return `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-top:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <select onchange="onTestRowNameChange(${idx}, this.value)" style="flex:1;">
          ${getAllTestNames().map(n=>`<option value="${n}" ${row.name===n?'selected':''}>${n}</option>`).join('')}
        </select>
        ${_testRows.length>1 ? `<span onclick="removeTestRow(${idx})" style="color:var(--red,#c0392b);font-size:20px;cursor:pointer;flex-shrink:0;">×</span>` : ''}
      </div>
      ${customNameHtml}
      <div class="row-sub" style="margin-top:6px;">ফলাফল (নমুনা পরীক্ষার পর পূরণ করতে পারেন — এখন খালি রেখেও বিল করা যাবে)</div>
      ${row.name==='Widal Test' ? widalInputsHtml(row, idx) : (quickHtml + `<input type="text" placeholder="Result (এখন খালি রাখতে পারেন)" value="${escapeHtml(row.result||'')}" oninput="onTestRowResultChange(${idx}, this.value)" style="margin-top:6px;">`)}
      <div style="display:flex;gap:6px;margin-top:6px;">
        <input type="number" min="0" placeholder="মূল্য (কাস্টমার দেবে) ৳" value="${escapeHtml(row.price||'')}" oninput="onTestRowPriceChange(${idx}, this.value)" style="flex:1;">
        <input type="number" min="0" placeholder="খরচ (ঐচ্ছিক) ৳" value="${escapeHtml(row.cost||'')}" oninput="onTestRowCostChange(${idx}, this.value)" style="flex:1;">
      </div>
    </div>`;
  }).join('');
}
/* ---- Referrer (ডাক্তার/এজেন্ট) reference & commission ---- */
let _testReferrerType = 'self'; // 'self' | 'doctor' | 'agent'
let _testReferrerId = null;
// রেফারার সাধারণত একটা স্থায়ী % রেটে কমিশন পান, কিন্তু মাঝেমধ্যে ডাক্তার প্রেসক্রিপশনে
// "X% less" লিখে দেন — এতে রোগীর বিল থেকে ওই X% বাদ যায়, আর সেই টাকাটা ডাক্তারের নিজের
// কমিশন থেকেই কাটা হয় (দোকানের লাভে কোনো প্রভাব পড়ে না)। X নিজের কমিশন রেটের বেশি হতে
// পারে না — ডাক্তার নিজের কমিশনের বেশি ছাড় দিতে পারেন না।
let _testDiscountPercent = '';
function setTestReferrerType(type){
  _testReferrerType = type;
  _testReferrerId = null;
  _testDiscountPercent = '';
  renderTestReferrerTypeButtons();
  renderTestReferrerPicker();
}
function renderTestReferrerTypeButtons(){
  const wrap = document.getElementById('testReferrerTypeWrap');
  if(!wrap) return;
  const opts = [['self','সেলফ/নিজে'],['doctor','ডাক্তার'],['agent','অন্য কেউ']];
  wrap.innerHTML = opts.map(([v,l])=>`<button type="button" class="btn ${_testReferrerType===v?'btn-primary':'btn-outline'}" style="flex:1;" onclick="setTestReferrerType('${v}')">${l}</button>`).join('');
}
function renderTestReferrerPicker(){
  const wrap = document.getElementById('testReferrerPickWrap');
  if(!wrap) return;
  if(_testReferrerType==='self'){ wrap.innerHTML=''; return; }
  const list = referrers.filter(r=>r.type===_testReferrerType);
  wrap.innerHTML = `<select id="testReferrerSelect" onchange="onTestReferrerSelectChange(this.value)" style="margin-top:6px;">
    <option value="">— বেছে নিন —</option>
    ${list.map(r=>`<option value="${r.id}" ${_testReferrerId===r.id?'selected':''}>${escapeHtml(r.name)} (${r.percent||0}%)</option>`).join('')}
    <option value="__new__">+ নতুন যোগ করুন</option>
  </select>
  <label style="margin-top:6px;">প্রেসক্রিপশনে "% less" লেখা থাকলে (ঐচ্ছিক)</label>
  <input type="number" id="tCommissionLess" min="0" max="100" placeholder="যেমন: ১০ — রোগীর বিল থেকে এই % বাদ যাবে, ডাক্তারের কমিশন থেকেই কাটা হবে" value="${escapeHtml(_testDiscountPercent+'')}" oninput="_testDiscountPercent=this.value">
  <div class="row-sub" style="margin-top:2px;">ডাক্তারের নিজের কমিশন রেটের বেশি ছাড় দেওয়া যাবে না — এর বেশি লিখলে কমিশন রেট পর্যন্তই ধরা হবে।</div>`;
}
function onTestReferrerSelectChange(val){
  if(val==='__new__'){
    document.getElementById('testReferrerSelect').value='';
    openReferrerQuickAdd(_testReferrerType);
    return;
  }
  _testReferrerId = val || null;
}
let editingReferrerId = null;
// prefillType: the type this quick-add was opened for (used both from the টেস্ট modal's
// "+ নতুন যোগ করুন" picker and from the রেফারার list's own "+ নতুন রেফারার" button).
function openReferrerQuickAdd(prefillType){
  editingReferrerId = null;
  document.getElementById('referrerQuickAddTitle').textContent = 'নতুন রেফারার';
  document.getElementById('rfType').value = prefillType || 'doctor';
  document.getElementById('rfName').value = '';
  document.getElementById('rfPercent').value = '';
  document.getElementById('rfMobile').value = '';
  openModal('referrerQuickAddModalBackdrop');
}
function openReferrerEditModal(id){
  const r = referrers.find(x=>x.id===id);
  if(!r) return;
  editingReferrerId = id;
  document.getElementById('referrerQuickAddTitle').textContent = 'রেফারার এডিট করুন';
  document.getElementById('rfType').value = r.type;
  document.getElementById('rfName').value = r.name;
  document.getElementById('rfPercent').value = r.percent||'';
  document.getElementById('rfMobile').value = r.mobile||'';
  openModal('referrerQuickAddModalBackdrop');
}
function saveReferrer(){
  const type = document.getElementById('rfType').value;
  const name = document.getElementById('rfName').value.trim();
  const percent = parseFloat(document.getElementById('rfPercent').value)||0;
  const mobile = document.getElementById('rfMobile').value.trim();
  if(!name){ toast('নাম আবশ্যক'); return; }
  if(editingReferrerId){
    const r = referrers.find(x=>x.id===editingReferrerId);
    if(r){ r.type=type; r.name=name; r.percent=percent; r.mobile=mobile; }
  } else {
    const r = {id:uid(), type, name, percent, mobile, due:0};
    referrers.push(r);
    _testReferrerType = type;
    _testReferrerId = r.id;
  }
  save(DB_KEYS.referrer, referrers);
  if(cloudReady()){
    const r = editingReferrerId ? referrers.find(x=>x.id===editingReferrerId) : referrers[referrers.length-1];
    if(r){ const {id, ...fields} = r; shopColl('referrers').doc(id).set(fields, {merge:true}).catch(e=>console.error(e)); }
  }
  closeModal('referrerQuickAddModalBackdrop');
  toast('রেফারার সংরক্ষিত হয়েছে ✓');
  renderTestReferrerTypeButtons();
  renderTestReferrerPicker();
  renderReferrerList();
}
function deleteReferrer(id){
  const r = referrers.find(x=>x.id===id);
  if(!r) return;
  if(r.due>0){ toast('এই রেফারারের বকেয়া কমিশন এখনো পরিশোধ হয়নি — আগে পরিশোধ করুন'); return; }
  if(!confirm(`"${r.name}" কে মুছে ফেলতে চান?`)) return;
  referrers = referrers.filter(x=>x.id!==id);
  addTombstone(id);
  save(DB_KEYS.referrer, referrers);
  if(cloudReady()) shopColl('referrers').doc(id).delete().catch(e=>console.error(e));
  toast('রেফারার মুছে ফেলা হয়েছে');
  renderReferrerList();
}
function openReferrerListModal(){
  document.getElementById('referrerSearch').value = '';
  renderReferrerList();
  openModal('referrerListModalBackdrop');
}
function renderReferrerList(){
  const el = document.getElementById('referrerList');
  if(!el) return;
  const q = (document.getElementById('referrerSearch')?.value||'').trim().toLowerCase();
  const filtered = rankBy(referrers, q, r=>r.name, [r=>r.mobile]);
  el.innerHTML = filtered.length ? filtered.map(r=>`
    <div class="row-item">
      <div><div class="row-title">${escapeHtml(r.name)} <span class="tag-en">${r.type==='doctor'?'ডাক্তার':'এজেন্ট'} • ${r.percent||0}%</span></div>
      <div class="row-sub">${r.mobile?escapeHtml(r.mobile):'—'}</div></div>
      <div class="row-right">${(r.due||0)>0?`<span class="badge badge-red">বকেয়া ${fmt(r.due)}</span>`:`<span class="badge badge-green">পরিশোধিত</span>`}
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
        ${(r.due||0)>0?`<button class="btn btn-sm btn-outline" onclick="openReferrerPaymentModal('${r.id}')">পরিশোধ করুন</button>`:''}
        <button class="btn btn-sm btn-outline" onclick="openReferrerEditModal('${r.id}')">এডিট</button>
        <button class="btn btn-sm btn-outline" onclick="deleteReferrer('${r.id}')">মুছুন</button>
      </div></div>
    </div>`).join('') : `<div class="empty-state">${q?'কোনো মিল পাওয়া যায়নি':'এখনো কোনো রেফারার যোগ করা হয়নি'}</div>`;
}
let payingReferrerId = null;
function openReferrerPaymentModal(id){
  payingReferrerId = id;
  const r = referrers.find(x=>x.id===id);
  if(!r) return;
  document.getElementById('rfPayName').textContent = r.name;
  document.getElementById('rfPayCurrentDue').textContent = fmt(r.due||0);
  document.getElementById('rfPayAmount').value = '';
  openModal('referrerPaymentModalBackdrop');
}
function saveReferrerPayment(){
  const r = referrers.find(x=>x.id===payingReferrerId);
  if(!r) return;
  const amount = parseFloat(document.getElementById('rfPayAmount').value)||0;
  if(amount<=0){ toast('সঠিক পরিমাণ দিন'); return; }
  r.due = Math.max((r.due||0) - amount, 0);
  save(DB_KEYS.referrer, referrers);
  const paymentId = uid();
  payments.push({ id:paymentId, referrerId:r.id, amount, ts:Date.now(), date:todayStr(), type:'referrer_commission' });
  save(DB_KEYS.payment, payments);
  closeModal('referrerPaymentModalBackdrop');
  toast(`${fmt(amount)} কমিশন পরিশোধ করা হয়েছে ✓`);
  renderReferrerList();
  if(cloudReady()){
    shopColl('referrers').doc(r.id).set({due:r.due}, {merge:true}).catch(e=>console.error(e));
    shopColl('payments').doc(paymentId).set({ referrerId:r.id, amount, ts:Date.now(), date:todayStr(), type:'referrer_commission' }).catch(e=>console.error(e));
  }
}
let editingLabTestId = null;
function openTestModal(id){
  editingLabTestId = id || null;
  const rec = id ? labTests.find(t=>t.id===id) : null;
  document.getElementById('testModalTitle').textContent = rec ? 'টেস্ট রিপোর্ট এডিট করুন' : 'নতুন টেস্ট রিপোর্ট';
  document.getElementById('tPatientName').value = rec ? rec.patientName : '';
  document.getElementById('tPatientAge').value = rec ? (rec.patientAge||'') : '';
  document.getElementById('tPatientGender').value = rec ? (rec.patientGender||'') : '';
  document.getElementById('tPatientMobile').value = rec ? (rec.patientMobile||'') : '';
  document.getElementById('tNotes').value = rec ? (rec.notes||'') : '';
  document.getElementById('tPaidAmount').value = rec && rec.paidAmount!=null ? rec.paidAmount : '';
  _testRows = rec
    ? rec.tests.map(t=>{
        const known = getAllTestNames().includes(t.name);
        return { name: known ? t.name : 'Other (Custom)', customName: known ? '' : t.name, result: t.result||'', price: t.price||'', cost: t.cost||'', widal: (t.name==='Widal Test') ? (t.widal || parseWidalResult(t.result)) : undefined };
      })
    : [applyTestPriceDefaults({name:'Blood Grouping', customName:'', result:'', price:'', cost:''})];
  renderTestRows();
  _testReferrerType = rec ? (rec.referrerType||'self') : 'self';
  _testReferrerId = rec ? (rec.referrerId||null) : null;
  _testDiscountPercent = rec && rec.discountPercent ? rec.discountPercent : '';
  renderTestReferrerTypeButtons();
  renderTestReferrerPicker();
  openModal('testModalBackdrop');
}
function saveLabTest(){
  const patientName = document.getElementById('tPatientName').value.trim();
  if(!patientName){ toast('রোগীর নাম আবশ্যক'); return; }
  // A row counts as a real test once it has a name AND either a result or a price — this lets
  // a bill be created (and paid) right away, with the result typed in and reprinted later once
  // the sample is actually processed, instead of forcing both at once.
  const tests = _testRows.map(r=>({
    name: (r.name==='Other (Custom)' ? (r.customName||'').trim() : r.name),
    result: (r.result||'').toString().trim(),
    price: parseFloat(r.price)||0,
    cost: parseFloat(r.cost)||0,
    ...((r.name==='Widal Test' && r.widal && Object.values(r.widal).some(Boolean)) ? {widal:{o:r.widal.o||'',h:r.widal.h||'',ah:r.widal.ah||'',bh:r.widal.bh||''}} : {})
  })).filter(t=>t.name && (t.result || t.price>0));
  if(!tests.length){ toast('অন্তত একটা টেস্টের ফলাফল বা মূল্য দিন'); return; }
  const existing = editingLabTestId ? labTests.find(t=>t.id===editingLabTestId) : null;
  // Undo the OLD commission first (if this is an edit and it previously had one) so editing
  // never double-counts — the new commission below is computed fresh from this save's totals.
  if(existing && existing.referrerId && existing.commissionAmount){
    const oldRef = referrers.find(r=>r.id===existing.referrerId);
    if(oldRef){
      oldRef.due = Math.max((oldRef.due||0) - existing.commissionAmount, 0);
      save(DB_KEYS.referrer, referrers);
      if(cloudReady()) shopColl('referrers').doc(oldRef.id).set({due:oldRef.due}, {merge:true}).catch(e=>console.error(e));
    }
  }
  // Referrer/commission: only self-tests skip this. The commission % is snapshotted onto the
  // record at save time (referrerPercent) so a later change to the referrer's standard rate
  // never rewrites the amount already owed for past tests.
  const rawTotal = tests.reduce((s,t)=>s+(t.price||0),0);
  let referrerId = null, referrerName = '', referrerType = _testReferrerType, referrerPercent = 0, discountPercent = 0, discountAmount = 0, commissionAmount = 0;
  if(_testReferrerType!=='self' && _testReferrerId){
    const ref = referrers.find(r=>r.id===_testReferrerId);
    if(ref){
      referrerId = ref.id; referrerName = ref.name; referrerPercent = ref.percent||0;
      // ডাক্তার প্রেসক্রিপশনে "X% less" লিখে দিলে রোগীর বিল থেকে ওই X% বাদ যায় — সেই টাকাটা
      // ডাক্তারের নিজের কমিশন থেকেই কাটা হয় (দোকানের লাভে কোনো হেরফের হয় না)। ডাক্তার নিজের
      // কমিশন রেটের বেশি ছাড় দিতে পারেন না, তাই discountPercent সবসময় referrerPercent-এ ক্যাপড।
      const typedDiscount = parseFloat(document.getElementById('tCommissionLess').value)||0;
      discountPercent = Math.max(0, Math.min(referrerPercent, typedDiscount));
      discountAmount = Math.round(rawTotal * discountPercent/100);
      commissionAmount = Math.round(rawTotal * referrerPercent/100) - discountAmount;
      ref.due = (ref.due||0) + commissionAmount;
      save(DB_KEYS.referrer, referrers);
      if(cloudReady()) shopColl('referrers').doc(ref.id).set({due:ref.due}, {merge:true}).catch(e=>console.error(e));
    }
  }
  const totalPrice = Math.max(0, rawTotal - discountAmount);
  const paidRaw = document.getElementById('tPaidAmount').value;
  // Blank field = fully paid (keeps old behaviour for anyone who ignores this field). A typed
  // value, even ০, is taken literally so a real partial/no payment can be recorded.
  const paidAmount = paidRaw==='' ? totalPrice : Math.max(0, Math.min(parseFloat(paidRaw)||0, totalPrice));
  const fields = {
    patientName,
    patientAge: document.getElementById('tPatientAge').value.trim(),
    patientGender: document.getElementById('tPatientGender').value,
    patientMobile: document.getElementById('tPatientMobile').value.trim(),
    tests,
    notes: document.getElementById('tNotes').value.trim(),
    paidAmount,
    referrerId, referrerName, referrerType, referrerPercent, discountPercent, discountAmount, commissionAmount
  };
  let rec;
  if(existing){
    Object.assign(existing, fields);
    rec = existing;
  } else {
    rec = { id: uid(), ts: Date.now(), date: todayStr(), ...fields };
    labTests.unshift(rec);
  }
  save(DB_KEYS.labTest, labTests);
  if(cloudReady()){
    shopColl('labTests').doc(rec.id).set(rec).catch(e=>console.error(e));
  }
  // Link/create a customer record so this patient can be found from the বিক্রয়/POS search
  // right away — but mark it provisional so it stays out of the কাস্টমার tab list until an
  // actual medicine sale is made in their name (see findOrCreateCustomerFor / completeSale).
  findOrCreateCustomerFor(rec.patientName, rec.patientMobile, '', true);
  closeModal('testModalBackdrop');
  toast('টেস্ট রিপোর্ট সংরক্ষিত হয়েছে ✓');
  renderLabTestList();
  showLabTestReceipt(rec);
}
function genderLabel(g){ return g==='male'?'পুরুষ':g==='female'?'মহিলা':g==='other'?'অন্যান্য':''; }
let _currentLabTestId = null;
function showLabTestReceipt(rec){
  _currentLabTestId = rec.id; _clearNoHead();
  const dt = new Date(rec.ts||Date.now());
  const dateStr = dt.toLocaleDateString('bn-BD') + ' ' + dt.toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
  const testTotals = labTestTotals(rec);
  // The বিল is a cash memo — money only, no result column, even if some rows have a result
  // typed in already (that belongs on the রেজাল্ট রিপোর্ট instead).
  const testRowsHtml = (rec.tests||[]).map((t,i)=>`<tr><td class="num">${i+1}.</td><td>${escapeHtml(t.name)}</td><td class="num">${fmt(t.price||0)}</td></tr>`).join('');
  document.getElementById('labTestReceiptContent').innerHTML = `
    <div class="receipt">
      <div class="r-head">
        <div class="r-shop">শ্রী শ্রী নৃসিংহ মেডিকেল হল</div>
        <div class="r-sub" style="color:#000;"><b style="font-size:1.2em;font-weight:800;letter-spacing:0.3px;">প্রোপ্রাইটর: প্রদীপ চন্দ্র হাওলাদার</b></div>
        <div class="r-sub" style="color:#000;"><b style="font-size:1.2em;font-weight:800;letter-spacing:0.3px;">মোবাইল: ০১৭৩৯০৯৭৩৯০</b></div>
        <div class="r-sub" style="color:#000;">সোনাখালী, আমতলী, বরগুনা।</div>
      </div>
      <div class="r-sub" style="text-align:center;font-weight:700;margin:6px 0;">টেস্ট বিল</div>
      <div class="r-meta">
        <span>তারিখ: ${dateStr}</span>
        <span>রোগী: ${escapeHtml(rec.patientName)}</span>
      </div>
      <div class="r-meta" style="margin-top:-4px;">
        <span>${rec.patientAge?'বয়স: '+escapeHtml(rec.patientAge):''}</span>
        <span>${genderLabel(rec.patientGender)}</span>
      </div>
      ${rec.patientMobile ? `<div class="r-sub">মোবাইল: ${escapeHtml(rec.patientMobile)}</div>` : ''}
      ${rec.referrerType && rec.referrerType!=='self' && rec.referrerName ? `<div class="r-sub">রেফারেন্স: ${rec.referrerType==='doctor'?'ডা. ':''}${escapeHtml(rec.referrerName)}</div>` : ''}
      <table>
        <thead><tr><th class="num">ক্র</th><th>Test</th><th class="num">মূল্য</th></tr></thead>
        <tbody>${testRowsHtml}</tbody>
        ${testTotals.discount>0 ? `<tr><td colspan="2">উপমোট</td><td class="num">${fmt(testTotals.rawPrice)}</td></tr><tr><td colspan="2">ছাড়</td><td class="num">-${fmt(testTotals.discount)}</td></tr>` : ''}
        <tr class="r-total-row"><td colspan="2">সর্বমোট</td><td class="num">${fmt(testTotals.price)}</td></tr>
      </table>
      ${labTestDue(rec)>0 ? `<div class="r-meta" style="margin-top:4px;"><span>নগদ নিলেন: ${fmt(rec.paidAmount!=null?rec.paidAmount:testTotals.price)}</span><span>বাকি: ${fmt(labTestDue(rec))}</span></div>` : ''}
      ${rec.notes ? `<div class="r-sub" style="margin-top:6px;">মন্তব্য: ${escapeHtml(rec.notes)}</div>` : ''}
      <div class="r-foot">ধন্যবাদ — সুস্থ থাকুন</div>
      ${shopQrHtml()}
    </div>`;
  openModal('labTestReceiptModalBackdrop');
}
// Separate RESULT report — the copy that carries the actual findings. Deliberately excludes
// price/money entirely (regardless of whether this record has test pricing), since a lab result
// should never be mixed with billing — and shows the referring doctor's name (if any) instead,
// which is what a result copy is expected to carry.
function showLabTestResultReport(id){
  const rec = labTests.find(t=>t.id===id);
  if(!rec) return;
  const dt = new Date(rec.ts||Date.now());
  const dateStr = dt.toLocaleDateString('bn-BD') + ' ' + dt.toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
  const testRowsHtml = (rec.tests||[]).map((t,i)=> (t.name==='Widal Test' && (t.widal||parseWidalResult(t.result))) ? widalReportRowHtml(i, t.widal?t:{...t,widal:parseWidalResult(t.result)}) : `<tr><td class="num">${i+1}.</td><td>${escapeHtml(t.name)}</td><td class="num">${t.result?escapeHtml(t.result):'<span style="color:var(--muted,#999);">চলমান</span>'}</td></tr>`).join('');
  document.getElementById('labTestResultContent').innerHTML = `
    <div class="receipt">
      <div class="r-head">
        <div class="r-shop">শ্রী শ্রী নৃসিংহ মেডিকেল হল</div>
        <div class="r-sub" style="color:#000;"><b style="font-size:1.2em;font-weight:800;letter-spacing:0.3px;">প্রোপ্রাইটর: প্রদীপ চন্দ্র হাওলাদার</b></div>
        <div class="r-sub" style="color:#000;"><b style="font-size:1.2em;font-weight:800;letter-spacing:0.3px;">মোবাইল: ০১৭৩৯০৯৭৩৯০</b></div>
        <div class="r-sub" style="color:#000;">সোনাখালী, আমতলী, বরগুনা।</div>
      </div>
      <div class="r-sub" style="text-align:center;font-weight:700;margin:6px 0;">টেস্ট রেজাল্ট রিপোর্ট</div>
      <div class="r-meta">
        <span>তারিখ: ${dateStr}</span>
        <span>রোগী: ${escapeHtml(rec.patientName)}</span>
      </div>
      <div class="r-meta" style="margin-top:-4px;">
        <span>${rec.patientAge?'বয়স: '+escapeHtml(rec.patientAge):''}</span>
        <span>${genderLabel(rec.patientGender)}</span>
      </div>
      ${rec.patientMobile ? `<div class="r-sub">মোবাইল: ${escapeHtml(rec.patientMobile)}</div>` : ''}
      ${rec.referrerType && rec.referrerType!=='self' && rec.referrerName ? `<div class="r-sub">${rec.referrerType==='doctor'?'প্রেরক ডাক্তার':'রেফারেন্স'}: ${rec.referrerType==='doctor'?'ডা. ':''}${escapeHtml(rec.referrerName)}</div>` : ''}
      <table>
        <thead><tr><th class="num">ক্র</th><th>Test</th><th class="num">Result</th></tr></thead>
        <tbody>${testRowsHtml}</tbody>
      </table>
      ${rec.notes ? `<div class="r-sub" style="margin-top:6px;">মন্তব্য: ${escapeHtml(rec.notes)}</div>` : ''}
      <div class="r-foot" style="margin-top:22px;">.......................................<br>পরীক্ষকের স্বাক্ষর</div>
    </div>`;
  openModal('labTestResultModalBackdrop');
}
// দোকানের নাম/প্রোপ্রাইটর/মোবাইল/ঠিকানা (r-head) বাদ দিয়ে প্রিন্ট — বাকি সব (রোগী, বয়স, মোবাইল, রেফারেন্স, টেস্ট) থাকে
function _printOnly(contentId, noHead){
  _clearNoHead();
  document.querySelectorAll('.print-target').forEach(e=>e.classList.remove('print-target'));
  const el = document.getElementById(contentId); if(!el) return;
  el.classList.add('print-target');
  document.body.classList.add('print-one');
  if(noHead) el.classList.add('hide-shop-head');
  const done = ()=>{ el.classList.remove('hide-shop-head'); el.classList.remove('print-target'); document.body.classList.remove('print-one'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}
function printNoShopHead(contentId){ _printOnly(contentId, true); }
function _clearNoHead(){ ['labTestReceiptContent','labTestResultContent','receiptContent','rxReceiptContent'].forEach(i=>{ const e=document.getElementById(i); if(e) e.classList.remove('hide-shop-head'); }); }
function printLabTestResult(){ _printOnly('labTestResultContent', false); }
function viewLabTestReceipt(id){
  const rec = labTests.find(t=>t.id===id);
  if(rec) showLabTestReceipt(rec);
}
function printLabTestReceipt(){ _printOnly('labTestReceiptContent', false); }
function deleteLabTestFromModal(){
  if(!_currentLabTestId) return;
  if(!confirm('এই টেস্ট রিপোর্টটা মুছে ফেলতে চান?')) return;
  labTests = labTests.filter(t=>t.id!==_currentLabTestId);
  addTombstone(_currentLabTestId);
  save(DB_KEYS.labTest, labTests);
  if(cloudReady()){
    shopColl('labTests').doc(_currentLabTestId).delete().catch(e=>console.error(e));
  }
  closeModal('labTestReceiptModalBackdrop');
  toast('টেস্ট রিপোর্ট মুছে ফেলা হয়েছে');
  renderLabTestList();
}
let testShowCount = 5;
function testFilterChanged(){ testShowCount = 5; renderLabTestList(); }
function renderLabTestList(){
  const el = document.getElementById('testList');
  if(!el) return;
  const q = (document.getElementById('testSearch')?.value||'').trim().toLowerCase();
  const filtered = rankBy([...labTests].sort((a,b)=>b.ts-a.ts), q, t=>t.patientName, [t=>t.patientMobile, t=>(t.tests||[]).map(x=>x.name).join(' | ')]);
  const rows = filtered.slice(0, testShowCount);
  el.innerHTML = rows.length ? rows.map(t=>{
    const dt = new Date(t.ts||Date.now());
    const dateStr = dt.toLocaleDateString('bn-BD');
    const testNames = (t.tests||[]).map(x=>x.name).join(', ');
    const resultSummary = (t.tests||[]).filter(x=>x.result).map(x=>`${x.name}: ${x.result}`).join(' • ');
    const pending = (t.tests||[]).some(x=>!x.result);
    const due = labTestDue(t);
    return `<div class="row-item" onclick="viewLabTestReceipt('${t.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(t.patientName)} <span class="tag-en">${escapeHtml(testNames)}</span></div>
      <div class="row-sub">${resultSummary?escapeHtml(resultSummary)+' • ':''}${dateStr}</div></div>
      <div class="row-right">
        ${pending?'<span class="badge badge-red">ফলাফল বাকি</span>':''}
        ${due>0?`<div style="margin-top:4px;"><span class="badge badge-gold">বাকি ${fmt(due)}</span></div><button class="btn btn-sm btn-outline" style="margin-top:5px;" onclick="event.stopPropagation();openTestPaymentModal('${t.id}')">বাকি জমা নিন</button>`:''}
      </div>
    </div>`;
  }).join('') : `<div class="empty-state">${q?'এই শর্তে কোনো টেস্ট রিপোর্ট নেই':'এখনো কোনো টেস্ট রিপোর্ট তৈরি হয়নি'}</div>`;
  if(filtered.length > rows.length){
    el.innerHTML += `<button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="testShowCount+=10;renderLabTestList();">আরও দেখুন</button>`;
  }
  renderTestSectionStats();
}
// Test Report page's own revenue/cost/profit/due stats — computed over ALL lab test records
// (not just the current search), same way the ওষুধ Reports tab totals dashboard-wide numbers,
// so this section is self-contained and answers "profit/cost/due" without hunting in Reports.
function renderTestSectionStats(){
  const revEl = document.getElementById('tsRevenue');
  if(!revEl) return;
  let revenue=0, cost=0, profit=0, due=0;
  labTests.forEach(lt=>{
    const x = labTestTotals(lt);
    revenue += x.price; cost += x.cost; profit += x.profit; due += labTestDue(lt);
  });
  revEl.textContent = fmt(revenue);
  document.getElementById('tsCost').textContent = fmt(cost);
  document.getElementById('tsProfit').textContent = fmt(profit);
  document.getElementById('tsDue').textContent = fmt(due);
}
function testStatDetailRows(mapFn){
  return labTests.filter(lt=>labTestTotals(lt).price>0).sort((a,b)=>b.ts-a.ts).map(mapFn).join('');
}
function showTestRevenue(){
  const rows = testStatDetailRows(lt=>{
    const x = labTestTotals(lt);
    return `<div class="row-item" onclick="viewLabTestReceipt('${lt.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(lt.patientName)}</div><div class="row-sub">${new Date(lt.ts).toLocaleDateString('bn-BD')} • ${(lt.tests||[]).length} আইটেম</div></div>
      <div class="row-right"><div class="row-title">${fmt(x.price)}</div></div>
    </div>`;
  });
  document.getElementById('detailModalTitle').textContent = 'টেস্ট রিপোর্ট থেকে মোট বিক্রয়';
  document.getElementById('detailModalContent').innerHTML = rows || `<div class="empty-state">এখনো কোনো টেস্ট রিপোর্ট নেই</div>`;
  openModal('detailModalBackdrop');
}
function showTestCost(){
  const rows = testStatDetailRows(lt=>{
    const x = labTestTotals(lt);
    if(x.cost<=0) return '';
    return `<div class="row-item" onclick="viewLabTestReceipt('${lt.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(lt.patientName)}</div><div class="row-sub">${new Date(lt.ts).toLocaleDateString('bn-BD')}</div></div>
      <div class="row-right"><div class="row-title">${fmt(x.cost)}</div><div class="row-sub">খরচ</div></div>
    </div>`;
  });
  document.getElementById('detailModalTitle').textContent = 'টেস্ট রিপোর্টে খাটা চালান/খরচ';
  document.getElementById('detailModalContent').innerHTML = rows || `<div class="empty-state">কোনো খরচ নথিভুক্ত নেই</div>`;
  openModal('detailModalBackdrop');
}
function showTestProfit(){
  let totalProfit = 0;
  const rows = testStatDetailRows(lt=>{
    const x = labTestTotals(lt);
    totalProfit += x.profit;
    return `<div class="row-item" onclick="viewLabTestReceipt('${lt.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(lt.patientName)}</div><div class="row-sub">${new Date(lt.ts).toLocaleDateString('bn-BD')} • বিক্রয়: ${fmt(x.price)}</div></div>
      <div class="row-right"><div class="row-title">${fmt(x.profit)}</div><div class="row-sub">লাভ</div></div>
    </div>`;
  });
  document.getElementById('detailModalTitle').textContent = 'টেস্ট রিপোর্টের আনুমানিক লাভ';
  document.getElementById('detailModalContent').innerHTML = (rows || `<div class="empty-state">এখনো কোনো টেস্ট রিপোর্ট নেই</div>`) +
    (rows ? `<div class="row-item" style="border:none;margin-top:6px;padding-top:12px;border-top:1.5px solid #ddd;"><div class="row-title">সর্বমোট লাভ</div><div class="row-title">${fmt(totalProfit)}</div></div>` : '');
  openModal('detailModalBackdrop');
}
function showTestDue(){
  const withDue = labTests.filter(lt=>labTestDue(lt)>0).sort((a,b)=>b.ts-a.ts);
  const rows = withDue.map(lt=>`
    <div class="row-item" onclick="closeModal('detailModalBackdrop');openTestPaymentModal('${lt.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(lt.patientName)}</div><div class="row-sub">${lt.patientMobile||'—'} • ${new Date(lt.ts).toLocaleDateString('bn-BD')}</div></div>
      <span class="badge badge-red">বাকি ${fmt(labTestDue(lt))}</span>
    </div>`).join('');
  document.getElementById('detailModalTitle').textContent = 'টেস্টের বাকি আছে যাদের (' + withDue.length + 'টা)';
  document.getElementById('detailModalContent').innerHTML = rows || `<div class="empty-state">কোনো টেস্টের বাকি নেই ✓</div>`;
  openModal('detailModalBackdrop');
}
let payingTestId = null;
function openTestPaymentModal(id){
  const rec = labTests.find(t=>t.id===id);
  if(!rec) return;
  payingTestId = id;
  document.getElementById('testPaymentPatientName').textContent = rec.patientName;
  document.getElementById('testPaymentCurrentDue').textContent = fmt(labTestDue(rec));
  document.getElementById('testPaymentAmount').value = '';
  openModal('testPaymentModalBackdrop');
}
function saveTestPayment(){
  const rec = labTests.find(t=>t.id===payingTestId);
  if(!rec) return;
  const due = labTestDue(rec);
  const amount = parseFloat(document.getElementById('testPaymentAmount').value)||0;
  if(amount<=0){ toast('সঠিক পরিমাণ দিন'); return; }
  const price = labTestTotals(rec).price;
  const paidSoFar = (rec.paidAmount!=null) ? rec.paidAmount : price;
  rec.paidAmount = Math.min(paidSoFar + amount, price);
  save(DB_KEYS.labTest, labTests);
  if(cloudReady()) shopColl('labTests').doc(rec.id).set({paidAmount: rec.paidAmount}, {merge:true}).catch(e=>console.error(e));
  closeModal('testPaymentModalBackdrop');
  toast(`${fmt(Math.min(amount,due))} জমা নেওয়া হয়েছে ✓`);
  renderLabTestList();
}
