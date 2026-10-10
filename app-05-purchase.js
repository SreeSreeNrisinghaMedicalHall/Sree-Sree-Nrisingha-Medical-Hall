/* ---------------- Purchase ---------------- */
// ===== এইমাত্র যোগ করা ওষুধ/কাস্টমারকে অগ্রাধিকার =====
// নতুন ওষুধ বা কাস্টমার সেভ করলে অ্যাপ মনে রাখে (৬০ মিনিট)। তারপর ক্রয়/বিক্রয়ের সার্চে সে সবার আগে আসে,
// আর ফর্ম খুললে এক ট্যাপের "🆕 এইমাত্র যোগ করা" বাটনও দেখায় — আবার খুঁজে বাছতে হয় না।
function _markJustAdded(kind, id){ try{ localStorage.setItem('ssn_last_added_'+kind, JSON.stringify({id, ts:Date.now()})); }catch(e){} }
// "🆕 এইমাত্র যোগ করা" বাটন: নতুন কাস্টমার যোগ করার পর বড়জোর ৩টা বিক্রয় পর্যন্ত (ওষুধের ক্ষেত্রে ৩টা ক্রয় পর্যন্ত)
// দেখায়, তারপর আর না — ৬০ মিনিটের সময়সীমাও আছে, যেটা আগে পৌঁছালে সেটাই ধরা হয়।
const JUST_ADDED_MAX_USES = 3;
function _justAdded(kind, maxMin){
  try{ const o = JSON.parse(localStorage.getItem('ssn_last_added_'+kind)||'null');
    if(o && o.id && (Date.now()-o.ts) < (maxMin||60)*60000){
      const arr = (kind==='cust') ? sales : (kind==='med' ? purchases : null);
      if(arr && arr.filter(x=>(x.ts||0) > o.ts).length >= JUST_ADDED_MAX_USES) return '';
      return o.id;
    } }catch(e){}
  return '';
}
function _recentFirst(list, id){
  if(!id) return list;
  const i = list.findIndex(x=>x.id===id);
  if(i>0){ const c = list.slice(); const [it] = c.splice(i,1); c.unshift(it); return c; }
  return list;
}
function renderPJustAdded(){
  const box = document.getElementById('pJustAdded'); if(!box) return;
  const id = _justAdded('med');
  const med = id ? medicines.find(m=>m.id===id) : null;
  if(!med || document.getElementById('pMedicine').value){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display = 'block';
  box.innerHTML = `<button type="button" class="btn btn-sm btn-outline" style="margin-top:6px;" onclick="pickPMedicine('${med.id}','${(typePrefixPlain(med.type)+med.name).replace(/'/g,"\\'")}')">🆕 এইমাত্র যোগ করা: ${escapeHtml(typePrefixPlain(med.type)+med.name)} — চাপুন</button>`;
}
function renderSaleJustAdded(){
  let box = document.getElementById('saleJustAdded');
  if(!box){
    const res = document.getElementById('saleCustomerResults'); if(!res || !res.parentNode) return;
    box = document.createElement('div'); box.id = 'saleJustAdded';
    res.parentNode.parentNode.insertBefore(box, res.parentNode.nextSibling);
  }
  const id = _justAdded('cust');
  const c = id ? customers.find(x=>x.id===id) : null;
  if(!c || document.getElementById('saleCustomer').value){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display = 'block';
  box.innerHTML = `<button type="button" class="btn btn-sm btn-outline" style="margin-top:6px;" onclick="pickSaleCustomer('${c.id}','${(c.name||'').replace(/'/g,"\\'")}');renderSaleJustAdded();">🆕 এইমাত্র যোগ করা: ${escapeHtml(c.name||'')}${c.mobile?' • '+escapeHtml(c.mobile):''} — চাপুন</button>`;
}
let editingPurchaseId = null;
function renderPurchaseSelects(){
  // এন্ট্রির মাঝখানে ক্লাউড/অন্য ফোন থেকে তালিকা হালনাগাদ হলে এই ফাংশন আবার চলে। আগে এটা লুকানো ওষুধ/সাপ্লায়ার বাছাই
  // মুছে দিত — পর্দায় নাম থেকে যেত, কিন্তু সংরক্ষণে চাপলে "ওষুধ বেছে নিন" আসত। এখন আগের বাছাই ধরে রাখে।
  const mSel = document.getElementById('pMedicine'), sSel = document.getElementById('pSupplier');
  const mv = mSel.value, sv = sSel.value;
  mSel.innerHTML = '<option value=""></option>' + medicines.map(m=>`<option value="${m.id}">${escapeHtml(m.name||'')}</option>`).join('');
  sSel.innerHTML = '<option value="">— নির্দিষ্ট নয় —</option>' + suppliers.map(s=>`<option value="${s.id}">${escapeHtml(s.name||'')}</option>`).join('');
  // তালিকায় (সাময়িকভাবে) না থাকলেও বাছাই মুছি না — তখন লেখা নামসহ একটা বিকল্প বসিয়ে রাখি
  if(mv){
    if(!medicines.some(m=>m.id===mv)){ const o=document.createElement('option'); o.value=mv; o.textContent=(document.getElementById('pMedicineSearch').value||''); mSel.appendChild(o); }
    mSel.value = mv;
  }
  if(sv){
    if(!suppliers.some(s=>s.id===sv)){ const o=document.createElement('option'); o.value=sv; o.textContent=(document.getElementById('pSupplierSearch').value||''); sSel.appendChild(o); }
    sSel.value = sv;
  }
}
function renderPMedicineSearch(){
  const q = document.getElementById('pMedicineSearch').value.toLowerCase().trim();
  const resEl = document.getElementById('pMedicineResults');
  const matches = _recentFirst(rankMeds(medicines, q, true), _justAdded('med')).slice(0,40);
  resEl.innerHTML = matches.length ? matches.map(m=>`<div class="row-item" onclick="pickPMedicine('${m.id}','${(typePrefixPlain(m.type)+m.name).replace(/'/g,"\\'")}')" style="cursor:pointer;padding:9px 10px;"><div class="row-title" style="font-size:13.5px;">${medTypeTag(m.type)}${escapeHtml(m.name||'')}</div><div class="row-sub">${m.type?'ধরন: '+m.type+' • ':''}${m.company||'—'} • স্টক: ${m.stock}</div></div>`).join('') : `<div class="row-item" onclick="addMedicineFromPurchase()" style="cursor:pointer;padding:9px 10px;"><div class="row-title" style="font-size:13.5px;color:var(--primary);">+ ওষুধটি ওষুধ ইনভেন্টরিতে যোগ করুন</div></div>`;
  resEl.style.display = 'block';
}
function addMedicineFromPurchase(){
  const q = document.getElementById('pMedicineSearch').value.trim();
  document.getElementById('pMedicineResults').style.display = 'none';
  _purchaseReturnPending = true;
  const _keepBack = _purchaseBack; _purchaseBack = null;   // ওষুধ-যোগ ফর্মে যাওয়ার সময় তালিকায় ফিরে যাবে না
  closeModal('purchaseModalBackdrop');
  _purchaseBack = _keepBack;
  openMedModal(null, q);
}
function pickPMedicine(id, name){
  document.getElementById('pMedicine').value = id;
  const _ja = document.getElementById('pJustAdded'); if(_ja){ _ja.style.display='none'; _ja.innerHTML=''; }
  document.getElementById('pMedicineSearch').value = name;
  document.getElementById('pMedicineResults').style.display = 'none';
  // Same medicine at the same company usually keeps the same ক্রয়মূল্য for a long stretch, so
  // pre-filling the last-known buy price (med.buy, set by savePurchase every time an entry is
  // saved) saves re-typing it — the owner then only has to confirm/change পরিমাণ. The hint text
  // under the field makes clear this is last time's price, in case this invoice's rate changed.
  const med = medicines.find(m=>m.id===id);
  const priceEl = document.getElementById('pPrice'), hintEl = document.getElementById('pPrevBuyHint');
  if(med && med.buy>0){
    priceEl.value = med.buy;
    hintEl.textContent = 'আগের ক্রয়মূল্য ৳'+med.buy+' — পরিবর্তন হয়ে থাকলে এডিট করে দিন';
    hintEl.style.display = 'block';
  } else {
    priceEl.value = '';
    hintEl.style.display = 'none';
  }
  { const _pe = document.getElementById('pDiscPct'); if(_pe.dataset.auto!=='0'){ _pe.value=''; _pe.dataset.auto='1'; } }
  document.getElementById('pSell').value = (med && med.sell>0) ? med.sell : '';
  if(document.getElementById('pDiscPct').dataset.auto==='0' && document.getElementById('pDiscPct').value) purchaseRecalc('pct');
  purchaseRecalc('qty');
  const qtyEl = document.getElementById('pQty');
  qtyEl.focus();
  qtyEl.select();
}
function renderPSupplierSearch(){
  const qRaw = document.getElementById('pSupplierSearch').value.trim();
  const q = qRaw.toLowerCase();
  const resEl = document.getElementById('pSupplierResults');
  const matches = rankBy(suppliers, q, s=>s.name, [s=>s.mobile]).slice(0,20);
  let html = `<div class="row-item" onclick="pickPSupplier('','— ওষুধের কোম্পানি —')" style="cursor:pointer;padding:9px 10px;"><div class="row-title" style="font-size:13.5px;">— নির্দিষ্ট নয় —</div></div>`;
  html += matches.map(s=>`<div class="row-item" onclick="pickPSupplier('${s.id}','${s.name.replace(/'/g,"\\'")}')" style="cursor:pointer;padding:9px 10px;"><div class="row-title" style="font-size:13.5px;">${escapeHtml(s.name||'')}</div><div class="row-sub">${s.mobile||'—'}</div></div>`).join('');
  html += `<div class="row-item" onclick="addSupplierFromPurchase()" style="cursor:pointer;padding:9px 10px;"><div class="row-title" style="font-size:13.5px;color:var(--primary);">+ ${qRaw?'"'+escapeHtml(qRaw)+'" নামে ':''}নতুন সাপ্লায়ার যোগ করুন</div></div>`;
  resEl.innerHTML = html;
  resEl.style.display = 'block';
}
let _supplierReturnToPurchase = false;
function addSupplierFromPurchase(){
  const name = document.getElementById('pSupplierSearch').value.trim();
  document.getElementById('pSupplierResults').style.display = 'none';
  openSupplierModal();
  document.getElementById('sName').value = name;
  _supplierReturnToPurchase = true;
}
function pickPSupplier(id, name){
  document.getElementById('pSupplier').value = id;
  document.getElementById('pSupplierSearch').value = id ? name : '';
  document.getElementById('pSupplierResults').style.display = 'none';
}
document.addEventListener('click', function(e){
  const wrap = document.getElementById('pMedicineSearch');
  const results = document.getElementById('pMedicineResults');
  if(wrap && results && !wrap.contains(e.target) && !results.contains(e.target)){ results.style.display = 'none'; }
  const swrap = document.getElementById('pSupplierSearch');
  const sresults = document.getElementById('pSupplierResults');
  if(swrap && sresults && !swrap.contains(e.target) && !sresults.contains(e.target)){ sresults.style.display = 'none'; }
});
// ক্রয়মূল্য হিসাব: (১) সরাসরি একক দাম, (২) বিক্রয়মূল্য থেকে ছাড় % (একবার দিলে পরের ওষুধেও থেকে যায়,
// ফাঁকা করলে বন্ধ), (৩) ইনভয়েসের লাইন-মোট দাম। বোনাস/ফ্রি থাকলে মোট দামকে (কেনা+বোনাস) দিয়ে ভাগ করে
// প্রকৃত একক খরচ ধরা হয়।
// বিক্রয়মূল্য অনুমান — দুটো আলাদা নিয়ম, কারণ অ্যাপ জানে না আপনি যে সংখ্যাটা বসিয়েছেন তাতে ভ্যাট/ছাড় মেশানো আছে কি না:
//  (ক) সংখ্যাটা শুধু ইনভয়েসের TP (ভ্যাট-ছাড় ছাড়া) হলে:  বিক্রয়মূল্য ≈ TP ÷ ০.৭৫   (আপনার ইনভয়েসগুলোতে TP ≈ ছাপা দামের ৭৫%)
//  (খ) সংখ্যাটা ভ্যাট ও ছাড় মিশিয়ে চূড়ান্ত খরচ হলে: বিক্রয়মূল্য ≈ খরচ ÷ ০.৮৬৫ (কোম্পানিভেদে ০.৮৫৮–০.৮৮)
const MRP_TP_RATIO = 0.75, MRP_COST_RATIO = 0.865;
let _estTp = 0, _estFinal = 0, _estSell = 0;
function roundMrp(raw){
  if(!(raw>0)) return 0;
  const step = raw < 3 ? 0.1 : (raw < 10 ? 0.5 : 1);   // সস্তা ওষুধে (যেমন ১.২ টাকার ট্যাবলেট) ০.১ ধাপ, নইলে ১.২ → ১.০ হয়ে যায়
  const v = Math.max(step, Math.round(raw/step)*step);
  return +v.toFixed(2);
}
function applyEstSell(which){
  const v = which==='tp' ? _estTp : _estFinal;
  if(!(v>0)){ toast('আগে ওষুধ ও ক্রয়মূল্য দিন'); return; }
  document.getElementById('pSell').value = v;
  toast('বিক্রয়মূল্য ৳'+v+' বসানো হয়েছে — সংরক্ষণ চাপলে ওষুধে বদলাবে');
}
let _lastDiscPct = '';
// ইনভয়েস সমন্বয়: গুণক = চূড়ান্ত দেয় টাকা ÷ লাইনগুলোর মোট। একবার দিলে পরের এন্ট্রিতেও থাকে (নতুন ইনভয়েসে মুছে দিন)।
let _invLinesVal = '', _invPayVal = '';
function _invFactor(){
  const L = parseFloat(document.getElementById('pInvLines').value)||0, P = parseFloat(document.getElementById('pInvPay').value)||0;
  return (L>0 && P>0) ? P/L : 1;
}
// "শুধু TP" দিলে ইনভয়েস-গুণক লাগে (ভ্যাট-ছাড় মেশে); "ভ্যাট-ডিসকাউন্ট সহ" দিলে ওটাই চূড়ান্ত — গুণক লাগে না।
// "শুধু TP" ও "ভ্যাট-ডিসকাউন্ট সহ মোট" ঘর দুটো এখন হিসাব করে নিজে ভরে যায় (ধূসর রঙে, dataset.auto='1');
// সেই অটো মান কখনো আপনার লেখা ইনপুট হিসেবে ধরা হয় না — নইলে হিসাব নিজের লেজ নিজে ধরত।
function _typedVal(id){ const el = document.getElementById(id); return (!el || el.dataset.auto==='1') ? 0 : (parseFloat(el.value)||0); }
function _autoFillLineBoxes(paid, fct, qty, sellRef){
  const set = (id, val, ph)=>{
    const el = document.getElementById(id); if(!el) return;
    if(el.dataset.auto==='0' && el.value!=='') { el.style.color=''; return; }   // আপনি লিখেছেন — ছোঁব না
    el.value = val; el.dataset.auto = '1'; el.style.color = '#667';
    if(ph!==undefined) el.placeholder = ph;
  };
  set('pLineTotal', paid>0 ? +paid.toFixed(2) : '');
  const tpVal = (paid>0 && fct!==1) ? +(paid/fct).toFixed(2) : '';
  const est = (sellRef>0 && qty>0) ? ('অনুমান ≈ '+ +(sellRef*MRP_TP_RATIO*qty).toFixed(0)) : 'যেমন: 374.82';
  set('pLineTP', tpVal, tpVal===''? est : 'যেমন: 374.82');
}
function _lineTotalEff(){
  const tp = _typedVal('pLineTP');
  const fin = _typedVal('pLineTotal');
  if(tp>0) return tp*_invFactor();
  if(fin>0) return fin;
  return 0;
}
function _invAdjSummary(){
  const f = _invFactor(), d = document.getElementById('pInvAdj'), sm = document.getElementById('pInvAdjSum');
  if(!d || !sm) return;
  if(f!==1){ sm.textContent = '⚙ ইনভয়েস সমন্বয় চালু — গুণক ×'+f.toFixed(4); sm.style.color = 'var(--primary,#1e5e45)'; d.open = true; }
  else { sm.textContent = '⚙ ইনভয়েস সমন্বয় (ভ্যাট/ছাড় নিচে আলাদা থাকলে)'; sm.style.color = ''; }
}
function invAdjChanged(){
  _invLinesVal = document.getElementById('pInvLines').value;
  _invPayVal = document.getElementById('pInvPay').value;
  _invAdjSummary();
  purchaseRecalc('qty');
}
function clearInvAdj(){
  _invLinesVal = ''; _invPayVal = ''; _lastCredit = false; const _pc = document.getElementById('pCredit'); if(_pc) _pc.checked = false;
  document.getElementById('pInvLines').value = ''; document.getElementById('pInvPay').value = '';
  _invAdjSummary(); purchaseRecalc('qty');
}
function _r4(x){ return Math.round(x*10000)/10000; }
function purchaseRecalc(src){
  const g = id=>document.getElementById(id);
  const med = medicines.find(m=>m.id===g('pMedicine').value);
  const qty = parseInt(g('pQty').value)||0, bonus = parseInt(g('pBonus').value)||0;
  const pctEl = g('pDiscPct');
  // "ছাড় %" ঘর দুই কাজ করে: (১) আপনি লিখলে সেটা থেকে ক্রয়মূল্য বের হয় (ড্রাইভার); (২) আপনি না লিখলে বিক্রয়মূল্য ও ক্রয়মূল্য থেকে
  // নিজে হিসাব করে দেখায় কত % কম দামে কিনেছেন (অটো, ধূসর রঙে) — dataset.auto: '1' = অটো, '0' = আপনার লেখা
  if(src==='pct'){
    if(pctEl.value===''){ pctEl.dataset.auto='1'; _lastDiscPct=''; }
    else { pctEl.dataset.auto='0'; _lastDiscPct = pctEl.value; }
  }
  if(src==='price'||src==='tp'||src==='total'){ pctEl.dataset.auto='1'; }
  const pctAuto = pctEl.dataset.auto!=='0';
  const pct = pctAuto ? 0 : (parseFloat(pctEl.value)||0);
  const sellRef = (parseFloat(g('pSell').value)||0) || (med ? (med.sell||0) : 0);
  // একসাথে একটাই দামের উৎস: একক দাম / % / শুধু TP / ভ্যাট-ডিসকাউন্ট সহ মোট
  const _clr = id=>{ const e=g(id); e.value=''; e.dataset.auto='0'; };
  if(src==='tp'){ g('pLineTP').dataset.auto='0'; }
  if(src==='total'){ g('pLineTotal').dataset.auto='0'; }
  if(src==='price'){ _clr('pLineTP'); _clr('pLineTotal'); }
  if(src==='tp'){ _clr('pLineTotal'); }
  if(src==='total'){ _clr('pLineTP'); }
  if(src==='pct'){ _clr('pLineTP'); _clr('pLineTotal'); }
  const tot = _lineTotalEff();
  if((src==='tp'||src==='total'||src==='qty'||src==='bonus') && tot>0 && qty>0) g('pPrice').value = _r4(tot/qty);
  if((src==='pct'||src==='sell') && !pctAuto && sellRef>0 && pct>0 && pct<100) g('pPrice').value = _r4(sellRef*(1-pct/100));
  const rate = parseFloat(g('pPrice').value)||0;
  const paid = tot > 0 ? tot : qty*rate;
  const tpTyped = _typedVal('pLineTP'), finTyped = _typedVal('pLineTotal'), fct = _invFactor();
  const parts = [];
  const pctNow = pct;
  if(pctNow>0){
    if(!med) parts.push('আগে ওষুধ বেছে নিন');
    else if(!(sellRef>0)) parts.push('এই ওষুধের বিক্রয়মূল্য দেওয়া নেই, তাই % দিয়ে হিসাব হবে না');
    else parts.push(`বিক্রয়মূল্য ৳${sellRef} − ${pctNow}% = ৳${rate}/একক`);
  }
  if(tpTyped>0){
    if(fct!==1) parts.push(`TP ৳${tpTyped} × ${fct.toFixed(4)} (ভ্যাট-ছাড় মিলিয়ে) = ৳${+(tpTyped*fct).toFixed(2)}`);
    else parts.push('⚠ শুধু TP দিয়েছেন কিন্তু ইনভয়েস সমন্বয় (ভ্যাট ও ছাড়) দেননি — ক্রয়মূল্য ভ্যাট ছাড়া, কম ধরা হচ্ছে');
  }
  if(paid>0 && qty>0){
    parts.push(`মোট ৳${+paid.toFixed(2)}`);
    if(bonus>0) parts.push(`বোনাস ধরে প্রতি ইউনিট ৳${(paid/(qty+bonus)).toFixed(2)} • স্টকে যোগ হবে ${qty+bonus}টা`);
  }
  // বিক্রয়মূল্য ও প্রকৃত একক খরচ থেকে — কত % কম দামে কিনেছেন, আর প্রতি ইউনিটে কত লাভ
  const effCost = (paid>0 && (qty+bonus)>0) ? paid/(qty+bonus) : 0;
  if(sellRef>0 && effCost>0){
    const impl = (1-effCost/sellRef)*100, diffU = sellRef-effCost;
    if(pctAuto){ pctEl.value = +impl.toFixed(2); pctEl.style.color = '#667'; }
    parts.push(diffU>=0 ? `বিক্রয় ৳${sellRef} − ক্রয় ৳${+effCost.toFixed(3)} = লাভ ৳${+diffU.toFixed(3)}/ইউনিট (${+impl.toFixed(2)}%)` : `⚠ বিক্রয় ৳${sellRef} < ক্রয় ৳${+effCost.toFixed(3)} — প্রতি ইউনিটে ৳${+(-diffU).toFixed(3)} লোকসান`);
  } else if(pctAuto){ pctEl.value = ''; pctEl.style.color = '#667'; }
  if(!pctAuto) pctEl.style.color = '';
  const h = g('pCalcHint');
  h.textContent = parts.join(' • ');
  h.style.display = parts.length ? 'block' : 'none';
  // ---- বিক্রয়মূল্য অনুমান: কোন ঘরে দাম দিয়েছেন তার ওপর নির্ভর করে, তাই আর ভুল বোঝার সুযোগ নেই ----
  const eh = g('pEstHint');
  _estTp = 0; _estFinal = 0;
  const f2 = x => x<10 ? +x.toFixed(3) : +x.toFixed(2);
  const btn = (w,v)=>`<button type="button" class="btn btn-sm btn-outline" style="margin-left:6px;" onclick="applyEstSell('${w}')">৳${v} বসান</button>`;
  let html = '';
  if(med && qty>0){
    if(tpTyped>0){            // শুধু TP → সরাসরি TP ÷ ০.৭৫ (খরচ কত হলো তার ওপর নির্ভর করে না)
      const unitTp = tpTyped/qty, raw = unitTp/MRP_TP_RATIO;
      _estTp = roundMrp(raw);
      html = `💡 <b>বিক্রয়মূল্যের অনুমান</b> (শুধু TP থেকে): একক TP ৳${f2(unitTp)} ÷ ${MRP_TP_RATIO} = ${f2(raw)} → ≈ <b>৳${_estTp}</b>${btn('tp',_estTp)}`;
    } else if(finTyped>0 || pctNow>0 || fct!==1){   // ভ্যাট-ছাড় মেশানো চূড়ান্ত খরচ
      const unitCost = paid/qty, raw = unitCost/MRP_COST_RATIO;
      if(unitCost>0){
        _estFinal = roundMrp(raw);
        const warn = _estFinal < unitCost ? ' <span style="color:#b42318;">⚠ ক্রয়মূল্যের চেয়ে কম</span>' : '';
        html = `💡 <b>বিক্রয়মূল্যের অনুমান</b> (ভ্যাট-ডিসকাউন্ট সহ দাম থেকে): একক ৳${f2(unitCost)} ÷ ${MRP_COST_RATIO} = ${f2(raw)} → ≈ <b>৳${_estFinal}</b>${warn}${btn('final',_estFinal)}`;
      }
    } else if(rate>0){        // শুধু "ক্রয় মূল্য/একক" হাতে লেখা — ভ্যাট মেশানো কি না জানা নেই, তাই দুটোই
      const rawTp = rate/MRP_TP_RATIO, rawFin = rate/MRP_COST_RATIO;
      _estTp = roundMrp(rawTp); _estFinal = roundMrp(rawFin);
      html = `💡 <b>বিক্রয়মূল্যের অনুমান</b> — একক দাম ৳${f2(rate)} কোন ধরনের তা অ্যাপ জানে না, তাই দুটো দেখাচ্ছি:`
        + `<div style="margin-top:4px;">• এটা শুধু TP হলে: ≈ <b>৳${_estTp}</b> <span style="opacity:.8;">(${f2(rate)} ÷ ${MRP_TP_RATIO})</span>${btn('tp',_estTp)}</div>`
        + `<div style="margin-top:4px;">• এটা ভ্যাট-ডিসকাউন্ট সহ হলে: ≈ <b>৳${_estFinal}</b> <span style="opacity:.8;">(${f2(rate)} ÷ ${MRP_COST_RATIO})</span>${_estFinal<rate?' <span style="color:#b42318;">⚠ ক্রয়মূল্যের চেয়ে কম</span>':''}${btn('final',_estFinal)}</div>`
        + `<div style="margin-top:4px;opacity:.8;">নিশ্চিত হতে ওপরের "শুধু TP" বা "ভ্যাট-ডিসকাউন্ট সহ" ঘরে দাম দিন।</div>`;
    }
    if(html && med.sell>0) html += `<div style="margin-top:4px;">বর্তমান বিক্রয়মূল্য: ৳${med.sell}</div>`;
  }
  eh.innerHTML = html; eh.style.display = html ? 'block' : 'none';
  _autoFillLineBoxes(paid, fct, qty, sellRef);
}
function openPurchaseModal(id, back){
  editingPurchaseId = id || null;
  _purchaseBack = (typeof back==='function') ? back : null;
  renderPurchaseSelects();
  const p = id ? purchases.find(x=>x.id===id) : null;
  if(!p) document.getElementById('pMedicine').value = '';   // নতুন এন্ট্রি: আগের এন্ট্রির ওষুধ নয়
  document.getElementById('pQty').value = p ? p.qty : 1;
  document.getElementById('pBonus').value = '0';
  document.getElementById('pLineTotal').value = ''; document.getElementById('pLineTotal').dataset.auto = '0';
  document.getElementById('pLineTP').value = ''; document.getElementById('pLineTP').dataset.auto = '0';
  document.getElementById('pDiscPct').value = p ? '' : _lastDiscPct;
  document.getElementById('pDiscPct').dataset.auto = (!p && _lastDiscPct) ? '0' : '1';
  document.getElementById('pInvLines').value = p ? '' : _invLinesVal;
  document.getElementById('pInvPay').value = p ? '' : _invPayVal;
  _invAdjSummary();
  document.getElementById('pCalcHint').style.display = 'none';
  document.getElementById('pSell').value = '';
  document.getElementById('pEstHint').style.display = 'none'; _estTp = 0; _estFinal = 0;
  document.getElementById('pPrice').value = p ? p.price : '';
  document.getElementById('pPrevBuyHint').style.display = 'none';
  document.getElementById('pBatch').value = p ? (p.batch||'') : '';
  document.getElementById('pExpiry').value = p ? (p.expiry||'') : '';
  if(p) document.getElementById('pMedicine').value = p.medicineId;
  const selMed = p ? medicines.find(m=>m.id===p.medicineId) : null;
  document.getElementById('pMedicineSearch').value = selMed ? (typePrefixPlain(selMed.type)+selMed.name) : '';
  document.getElementById('pSell').value = (selMed && selMed.sell>0) ? selMed.sell : '';   // সম্পাদনায় বিক্রয়মূল্য ফাঁকা না থেকে দেখায়
  document.getElementById('pMedicineResults').style.display = 'none';
  const selSup = p && p.supplierId ? suppliers.find(s=>s.id===p.supplierId) : null;
  document.getElementById('pSupplier').value = p ? (p.supplierId || '') : '';
  document.getElementById('pSupplierSearch').value = selSup ? selSup.name : '';
  document.getElementById('pSupplierResults').style.display = 'none';
  document.getElementById('pCredit').checked = p ? !!p.credit : _lastCredit;
  setTimeout(()=>{ if(!p) renderPJustAdded(); }, 0);
  document.getElementById('purchaseModalTitle').textContent = p ? 'ক্রয় এন্ট্রি সম্পাদনা করুন' : 'নতুন ক্রয় এন্ট্রি';
  document.getElementById('purchaseDeleteBtn').style.display = p ? 'block' : 'none';
  if(p) purchaseRecalc('qty');   // সম্পাদনায় আগের এন্ট্রির % ও লাভ দেখায়
  openModal('purchaseModalBackdrop');
}
// সাপ্লায়ার বাছা না থাকলে ওষুধের নিজের কোম্পানির নামই দেখানো/ধরা হয়
function _medCompanyOf(medId){ const m = medicines.find(x=>x.id===medId); return (m && m.company) ? m.company : ''; }
const THIN_MARGIN_PCT = 5; // লাভ এর নিচে নামলে হালকা সতর্কবার্তা
function _priceCheckKind(price, sell){
  if(!(sell>0)) return null;
  if(price>sell) return 'loss';
  if(price>0 && ((sell-price)/sell*100) < THIN_MARGIN_PCT) return 'thin';
  return null;
}
function _priceDialog(kind, med, price){
  return new Promise(resolve=>{
    const sell = med.sell;
    const diff = Math.abs(price-sell).toFixed(2);
    const pct = ((sell-price)/sell*100).toFixed(1);
    const title = kind==='loss' ? '⚠ ক্রয়মূল্য বিক্রয়মূল্যের চেয়ে বেশি' : 'ℹ লাভ খুব কম';
    const body = kind==='loss'
      ? `ক্রয়মূল্য <b>৳${+price.toFixed(2)}</b>, বর্তমান বিক্রয়মূল্য <b>৳${sell}</b> — এভাবে বিক্রি করলে প্রতি ইউনিটে <b>৳${diff} লোকসান</b>। ওষুধের দাম কি বেড়েছে? তাহলে নতুন বিক্রয়মূল্য দিন।`
      : `ক্রয়মূল্য <b>৳${+price.toFixed(2)}</b>, বিক্রয়মূল্য <b>৳${sell}</b> — প্রতি ইউনিটে লাভ মাত্র <b>৳${diff} (${pct}%)</b>। চাইলে নতুন বিক্রয়মূল্য দিন।`;
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;';
    ov.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:420px;width:100%;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.3);">
      <div style="font-weight:700;font-size:16px;margin-bottom:6px;">${title}</div>
      <div style="font-weight:600;margin-bottom:8px;">${escapeHtml(med.name)}</div>
      <div style="font-size:14px;line-height:1.5;margin-bottom:10px;">${body}</div>
      <label style="font-size:13px;font-weight:600;">বিক্রয়মূল্য ঠিক করুন (৳ প্রতি ইউনিট) — ইনভেন্টরিতে যেতে হবে না</label>
      <input type="number" id="pdNewSell" min="0" step="any" placeholder="যেমন: ${Math.ceil(price*1.1)}" style="width:100%;margin:4px 0 10px;padding:10px;border:1px solid #ccc;border-radius:10px;font-size:16px;box-sizing:border-box;">
      <button id="pdUpdate" class="btn btn-primary btn-block" style="margin-bottom:8px;">✏️ বিক্রয়মূল্য ঠিক করুন ও সংরক্ষণ করুন</button>
      <button id="pdKeep" class="btn btn-outline btn-block" style="margin-bottom:8px;">${kind==='loss'?'তারপরও এই দামেই সংরক্ষণ করুন':'বিক্রয়মূল্য না বদলে সংরক্ষণ করুন'}</button>
      <button id="pdCancel" class="btn btn-block" style="background:#f1f1f1;">ফিরে যান (দাম ঠিক করব)</button>
    </div>`;
    document.body.appendChild(ov);
    const done = r=>{ ov.remove(); resolve(r); };
    ov.querySelector('#pdCancel').onclick = ()=>done({action:'cancel'});
    ov.querySelector('#pdKeep').onclick = ()=>done({action:'keep'});
    ov.querySelector('#pdUpdate').onclick = ()=>{
      const v = parseFloat(ov.querySelector('#pdNewSell').value)||0;
      if(!(v>0)){ toast('নতুন বিক্রয়মূল্য দিন'); return; }
      if(v<=price){ toast('বিক্রয়মূল্য ক্রয়মূল্যের (৳'+(+price.toFixed(2))+') চেয়ে বেশি দিন'); return; }
      done({action:'update', newSell:v});
    };
    setTimeout(()=>{ try{ ov.querySelector('#pdNewSell').focus(); }catch(e){} }, 50);
  });
}
let _savingPurchase = false;
async function savePurchase(){
  if(_savingPurchase) return;
  _savingPurchase = true;
  try{
    // ওষুধ বাছা নেই কিন্তু নাম লেখা আছে — নাম মিললে নিজে বেছে নেয়; মেলে একাধিক হলে/না মিললে ছোট্ট নির্দেশ (আলাদা করে সেভ করতে হয় না)
    if(!document.getElementById('pMedicine').value){
      const typed = (document.getElementById('pMedicineSearch').value||'').trim();
      if(typed){
        const tk = normalizeMedName(typed);
        const hits = medicines.filter(m=>normalizeMedName(m.name)===tk || normalizeMedName(typePrefixPlain(m.type)+m.name)===tk);
        if(hits.length===1){
          const sel = document.getElementById('pMedicine');
          if(!sel.querySelector('option[value="'+hits[0].id+'"]')){ const o=document.createElement('option'); o.value=hits[0].id; o.textContent=hits[0].name; sel.appendChild(o); }
          sel.value = hits[0].id;   // pickPMedicine() ইচ্ছে করে ডাকা হয়নি — তাতে আপনার বসানো দাম মুছে যেত
        } else if(hits.length>1){
          toast('"'+typed+'" নামে একাধিক ওষুধ আছে (ধরন আলাদা) — তালিকা থেকে সঠিকটা বেছে নিন');
          renderPMedicineSearch(); return;
        } else {
          if(confirm('"'+typed+'" ওষুধ ইনভেন্টরিতে নেই।\n\nনতুন ওষুধ হিসেবে যোগ করে ক্রয়ে ফিরবেন?')) addMedicineFromPurchase();
          return;
        }
      }
    }
    const med = medicines.find(m=>m.id===document.getElementById('pMedicine').value);
    if(!med){ _savePurchaseCore(0); return; } // আগের মতো "ওষুধ বাছুন" বার্তা core-ই দেখাবে
    // বাকিতে কিনলে সাপ্লায়ার লাগে — আলাদা করে না বাছলে ওষুধের কোম্পানির নাম থেকেই নিজে ধরা হয় (দরকার হলে শুধু তখনই জিজ্ঞেস করে)
    if(document.getElementById('pCredit').checked && !document.getElementById('pSupplier').value){
      const okSup = await _resolveCreditSupplier(med);
      if(!okSup) return;
    }
    const qtyPaid = parseInt(document.getElementById('pQty').value)||0;
    const bonusQty = parseInt(document.getElementById('pBonus').value)||0;
    const lineTotal = _lineTotalEff();
    const rate = parseFloat(document.getElementById('pPrice').value)||med.buy;
    if(qtyPaid<=0){ _savePurchaseCore(0); return; }
    const qty = qtyPaid + bonusQty;
    const price = (bonusQty>0 || lineTotal>0) ? ((lineTotal>0 ? lineTotal : qtyPaid*rate) / qty) : rate;
    const tpTyped = _typedVal('pLineTP');
    const finTyped = _typedVal('pLineTotal');
    // "শুধু TP" দিয়েছেন কিন্তু ইনভয়েস সমন্বয় নেই — ক্রয়মূল্য ভ্যাট ছাড়া (কম) বসে যাবে
    if(tpTyped>0 && _invFactor()===1){
      if(!confirm(`⚠ আপনি "শুধু TP" দিয়েছেন (৳${tpTyped}), কিন্তু ইনভয়েস সমন্বয় (ভ্যাট ও ছাড়) দেননি — তাই ক্রয়মূল্য ভ্যাট ছাড়া, আসল খরচের চেয়ে কম ধরা হবে (একক ৳${+price.toFixed(3)})।\n\nএভাবেই সংরক্ষণ করতে চান?\n(না চাপলে ফিরে গিয়ে সমন্বয়ের ঘর দুটো ভরতে পারবেন, বা "ভ্যাট-ডিসকাউন্ট সহ" ঘরে দাম দিতে পারবেন)`)) return;
    }
    // ইনভয়েস সমন্বয় চালু অথচ দাম "ভ্যাট-ডিসকাউন্ট সহ" ঘরে বা কিছুই না দেওয়া — গুণক এই ওষুধে কাজ করছে না
    if(_invFactor()!==1 && !(tpTyped>0) && !(finTyped>0)){
      if(!confirm(`⚠ ইনভয়েস সমন্বয় চালু আছে (গুণক ×${_invFactor().toFixed(4)}), কিন্তু "শুধু TP" ঘর ফাঁকা — তাই সমন্বয় এই ওষুধে লাগছে না, ক্রয়মূল্য ৳${+price.toFixed(3)} ধরা হচ্ছে।\n\nএভাবেই সংরক্ষণ করতে চান?\n(না চাপলে ফিরে গিয়ে "শুধু TP" বসাতে পারবেন)`)) return;
    }
    const sellField = parseFloat(document.getElementById('pSell').value)||0;
    const fieldSell = (sellField>0 && sellField!==med.sell) ? sellField : 0; // ফর্মে বিক্রয়মূল্য বদলানো হলে সেটাই নতুন বিক্রয়মূল্য
    const medChk = Object.assign({}, med, { sell: sellField>0 ? sellField : med.sell });
    if(price<=0){
      if(!confirm(`⚠ এই ক্রয় এন্ট্রিতে ক্রয়মূল্য দেওয়া হয়নি (৳০ ধরা আছে) — "${med.name}"-এর প্রতিটা বিক্রয়ে পুরো বিক্রয়মূল্যটাই ভুলবশত লাভ হিসেবে দেখাবে।\n\nক্রয়মূল্য ছাড়াই সংরক্ষণ করতে চান?`)) return;
      _savePurchaseCore(fieldSell); return;
    }
    const kind = _priceCheckKind(price, medChk.sell);
    if(kind){
      const r = await _priceDialog(kind, medChk, price);
      if(r.action==='cancel') return;
      _savePurchaseCore(r.action==='update' ? r.newSell : fieldSell);
    } else {
      _savePurchaseCore(fieldSell);
    }
  } finally { _savingPurchase = false; }
}
function _savePurchaseCore(newSell){
  const medId = document.getElementById('pMedicine').value;
  const med = medicines.find(m=>m.id===medId);
  if(!med){ toast(medicines.length ? 'সার্চ করে একটা ওষুধ বেছে নিন' : 'প্রথমে ওষুধ যোগ করুন'); return; }
  const qtyPaid = parseInt(document.getElementById('pQty').value)||0;
  const bonusQty = parseInt(document.getElementById('pBonus').value)||0;
  const lineTotal = _lineTotalEff();
  const rate = parseFloat(document.getElementById('pPrice').value)||med.buy;
  if(qtyPaid<=0){ toast('সঠিক পরিমাণ দিন'); return; }
  // বোনাস থাকলে স্টকে (কেনা+বোনাস) যোগ হয়, আর একক খরচ = মোট দেওয়া টাকা ÷ (কেনা+বোনাস) — তাই
  // মোট ক্রয় (qty × price) সবসময় আসল দেওয়া টাকার সমান থাকে।
  const qty = qtyPaid + bonusQty;
  const price = (bonusQty>0 || lineTotal>0) ? ((lineTotal>0 ? lineTotal : qtyPaid*rate) / qty) : rate;
  // দাম যাচাই (লোকসান/কম লাভ/০ দাম) আগেই savePurchase()-এ হয়ে গেছে; newSell থাকলে নতুন বিক্রয়মূল্য বসবে।
  if(newSell>0){
    med.sell = newSell;
    if(cloudReady()){ try{ shopColl('medicines').doc(med.id).set({sell:newSell}, {merge:true}).catch(e=>console.error(e)); }catch(e){} }
  }
  const batch = document.getElementById('pBatch').value.trim();
  const expiry = document.getElementById('pExpiry').value;
  const supId = document.getElementById('pSupplier').value;
  const sup = suppliers.find(s=>s.id===supId);
  const credit = !!document.getElementById('pCredit').checked && !!supId;

  let newPurchaseId = null;
  let _editOldQty = 0, _editOldMedId = null;   // ক্লাউডে পার্থক্য পাঠাতে পুরোনো মান লাগবে
  if(editingPurchaseId){
    const old = purchases.find(x=>x.id===editingPurchaseId);
    _editOldQty = old.qty; _editOldMedId = old.medicineId;
    const oldMed = medicines.find(m=>m.id===old.medicineId);
    if(oldMed) oldMed.stock -= old.qty;
    med.stock += qty; med.buy = price; med.batch = batch; med.expiry = expiry;
    Object.assign(old, { medicineId:med.id, medicineName:med.name, qty, price, batch, expiry, supplierId:supId||null, supplierName:sup?sup.name:(med.company||null), credit });
  } else {
    med.stock += qty; med.buy = price; med.batch = batch; med.expiry = expiry;
    newPurchaseId = uid();
    purchases.push({ id:newPurchaseId, ts:Date.now(), date:todayStr(), medicineId:med.id, medicineName:med.name, qty, price, batch, expiry, supplierId:supId||null, supplierName:sup?sup.name:(med.company||null), credit });
  }
  save(DB_KEYS.med, medicines);
  save(DB_KEYS.purchase, purchases);
  closeModal('purchaseModalBackdrop'); toast('ক্রয় সংরক্ষিত হয়েছে ✓'); renderPurchases(); renderDashboard();

  if(cloudReady()){
    if(editingPurchaseId){
      // স্টকের চূড়ান্ত সংখ্যা নয়, পার্থক্য (increment) পাঠাই — অন্য ফোনের অফলাইন বিক্রি যেন মুছে না যায়
      const _FV = firebase.firestore.FieldValue, _meta = {buy: price, batch, expiry};
      if(_editOldMedId === med.id){
        shopColl('medicines').doc(med.id).set(Object.assign({stock: _FV.increment(qty - _editOldQty)}, _meta), {merge:true}).catch(e=>console.error(e));
      } else {
        if(_editOldMedId) shopColl('medicines').doc(_editOldMedId).set({stock: _FV.increment(-_editOldQty)}, {merge:true}).catch(e=>console.error(e));
        shopColl('medicines').doc(med.id).set(Object.assign({stock: _FV.increment(qty)}, _meta), {merge:true}).catch(e=>console.error(e));
      }
      shopColl('purchases').doc(editingPurchaseId).update({ medicineId:med.id, medicineName:med.name, qty, price, batch, expiry, supplierId:supId||null, supplierName:sup?sup.name:(med.company||null), credit }).catch(e=>console.error(e));
    } else {
      shopColl('medicines').doc(med.id).set({stock: firebase.firestore.FieldValue.increment(qty), buy: price, batch, expiry}, {merge:true}).catch(e=>console.error(e));
      const p = purchases.find(x=>x.id===newPurchaseId);
      shopColl('purchases').doc(newPurchaseId).set(p).catch(e=>console.error(e));
    }
  }
}
function deletePurchase(){
  if(!editingPurchaseId) return;
  const p = purchases.find(x=>x.id===editingPurchaseId);
  if(!askDelete(`এই ক্রয় এন্ট্রি মুছে ফেলবেন? ওষুধের স্টক থেকে ${p?p.qty:''} কমে যাবে।`)) return;
  const med = medicines.find(m=>m.id===p.medicineId);
  if(med) med.stock -= p.qty;
  purchases = purchases.filter(x=>x.id!==editingPurchaseId);
  addTombstone(editingPurchaseId);
  save(DB_KEYS.med, medicines);
  save(DB_KEYS.purchase, purchases);
  closeModal('purchaseModalBackdrop'); toast('ক্রয় এন্ট্রি মুছে ফেলা হয়েছে'); renderPurchases(); renderDashboard();
  if(cloudReady()){
    if(med) shopColl('medicines').doc(med.id).set({stock: firebase.firestore.FieldValue.increment(-p.qty)}, {merge:true}).catch(e=>console.error(e));
    shopColl('purchases').doc(editingPurchaseId).delete().catch(e=>console.error(e));
  }
}
// রিপোর্ট/আজকের ক্রয়/কোম্পানির তালিকা থেকে একটা ক্রয় খুলে সেভ বা বন্ধ করলে আবার সেই তালিকাতেই ফেরে
function openPurchaseFrom(id, fnName, arg){
  const sc = _detScrollGet();
  closeModal('detailModalBackdrop');
  openPurchaseModal(id, ()=>{ try{ window[fnName](arg); _detScrollSet(sc); }catch(e){} });
}
function openReceiptFromReport(id){
  const sc = _detScrollGet();
  closeModal('detailModalBackdrop');
  _receiptBack = ()=>{ showReportSales(true); _detScrollSet(sc); };
  showReceiptById(id);
}
// ===== কোম্পানির নাম একসাথে ঠিক করা =====
// সব ওষুধে ব্যবহার হওয়া আলাদা আলাদা কোম্পানির নামের তালিকা দেখায়। একটা নাম বদলে দিলে ওই নামের সব ওষুধ একসাথে বদলে যায়;
// আর নতুন নাম যদি আগে থেকেই থাকা অন্য নাম হয়, দুটো নাম একটাতে মিশে যায় (যেমন \"Square Pharma\" → \"Square pharmaceuticals\")।
function _coKey(n){ return String(n||'').toLowerCase().replace(/\b(ltd|limited|plc|pharmaceuticals?|pharma|laboratories|laboratory|labs?|co|company)\b/g,'').replace(/[^a-z0-9\u0980-\u09FF]/g,''); }
function _coStats(){
  const map = {};
  medicines.forEach(m=>{ const c=(m.company||'').trim(); if(!c) return; map[c] = (map[c]||0)+1; });
  const names = Object.keys(map).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase()));
  const keyCount = {};
  names.forEach(n=>{ const k=_coKey(n); keyCount[k]=(keyCount[k]||0)+1; });
  return names.map(n=>({name:n, count:map[n], similar: keyCount[_coKey(n)]>1 && _coKey(n)!==''}));
}
function openCompanyFixer(){
  const ov = _supOverlay(`
    <div style="font-weight:800;font-size:17px;">🏢 কোম্পানির নাম ঠিক করুন</div>
    <div class="row-sub" style="margin:4px 0 8px;">যে নামটা ভুল, সেটার পাশে "ঠিক করুন" চাপুন। নতুন নামটা আগে থেকে থাকা অন্য নামের মতো লিখলে দুটো মিশে এক হয়ে যাবে। ⚠️ চিহ্নের নামগুলো দেখতে প্রায় এক রকম — সম্ভবত একই কোম্পানি দুই বানানে।</div>
    <input type="text" id="coSearch" placeholder="কোম্পানি খুঁজুন..." autocomplete="off" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:10px;font-size:15px;">
    <div style="margin:8px 0;"><label style="font-size:13px;"><input type="checkbox" id="coOnlySimilar"> শুধু ⚠️ মিলের সম্ভাবনা থাকা নামগুলো দেখান</label></div>
    <div id="coList"></div>
    <button id="coClose" class="btn btn-block" style="margin-top:10px;background:#f1f1f1;">বন্ধ করুন</button>`);
  ov.id = 'coFixOv';
  const render = ()=>{
    const q = ov.querySelector('#coSearch').value.trim().toLowerCase();
    const only = ov.querySelector('#coOnlySimilar').checked;
    const all = _coStats();
    const list = all.filter(x=>(!q || x.name.toLowerCase().indexOf(q)>=0) && (!only || x.similar));
    ov.querySelector('#coList').innerHTML = (`<div class="row-sub" style="margin-bottom:4px;">মোট ${all.length}টা আলাদা নাম</div>`) + (list.map((x,i)=>`
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px dashed #ddd;">
        <div style="min-width:0;overflow-wrap:anywhere;"><div style="font-weight:600;">${x.similar?'⚠️ ':''}${escapeHtml(x.name)}</div><div class="row-sub">${x.count}টা ওষুধ</div></div>
        <button class="btn btn-sm btn-outline" data-i="${i}" style="flex-shrink:0;">✏️ ঠিক করুন</button>
      </div>`).join('') || '<div class="empty-state">কোনো নাম পাওয়া যায়নি</div>');
    ov.querySelectorAll('#coList button[data-i]').forEach(b=>{ b.onclick = ()=>_coEditDialog(list[+b.dataset.i].name, render); });
  };
  ov.querySelector('#coSearch').oninput = render;
  ov.querySelector('#coOnlySimilar').onchange = render;
  ov.querySelector('#coClose').onclick = ()=>ov.remove();
  render();
}
function _coEditDialog(oldName, after){
  const names = _coStats().map(x=>x.name);
  const ov = _supOverlay(`
    <div style="font-weight:700;font-size:16px;margin-bottom:6px;">কোম্পানির নাম বদলান</div>
    <div class="row-sub">এখন: <b>${escapeHtml(oldName)}</b></div>
    <label style="font-size:13px;display:block;margin-top:10px;">সঠিক নাম (তালিকা থেকে বেছে নিতেও পারেন)</label>
    <input type="text" id="coNew" list="coNameList" value="${escapeHtml(oldName)}" autocomplete="off" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:10px;font-size:16px;margin-top:4px;">
    <datalist id="coNameList">${names.filter(n=>n!==oldName).map(n=>`<option value="${escapeHtml(n)}">`).join('')}</datalist>
    <button id="coSave" class="btn btn-primary btn-block" style="margin:12px 0 8px;">সংরক্ষণ করুন</button>
    <button id="coCancel" class="btn btn-block" style="background:#f1f1f1;">বাতিল</button>`);
  setTimeout(()=>{ const i=ov.querySelector('#coNew'); i.focus(); i.select(); }, 50);
  ov.querySelector('#coCancel').onclick = ()=>ov.remove();
  ov.querySelector('#coSave').onclick = function(){
    const nn = ov.querySelector('#coNew').value.trim().replace(/\s+/g,' ');
    if(!nn){ toast('নাম লিখুন'); return; }
    if(nn===oldName){ ov.remove(); return; }
    const affected = medicines.filter(m=>(m.company||'').trim()===oldName);
    const exists = names.some(n=>n.toLowerCase()===nn.toLowerCase());
    if(!confirm(`${affected.length}টা ওষুধের কোম্পানি "${oldName}" থেকে বদলে "${nn}" হবে।`+(exists?'\n\n(এই নামটা আগে থেকেই আছে — দুটো একসাথে মিশে যাবে।)':'')+'\n\nঠিক আছে?')) return;
    this.disabled = true;
    const target = names.find(n=>n.toLowerCase()===nn.toLowerCase()) || nn;
    affected.forEach(m=>{ m.company = target; });
    // পুরনো ক্রয়ের সারিতে (সাপ্লায়ার বাছা ছাড়া) যে কোম্পানির নাম লেখা আছে সেটাও মিলিয়ে দিই
    const pAff = purchases.filter(p=>!p.supplierId && (p.supplierName||'').trim()===oldName);
    pAff.forEach(p=>{ p.supplierName = target; });
    save(DB_KEYS.med, medicines);
    if(pAff.length) save(DB_KEYS.purchase, purchases);
    if(cloudReady()){
      affected.forEach(m=>{ try{ shopColl('medicines').doc(m.id).set({company:target},{merge:true}).catch(e=>console.error(e)); }catch(e){} });
      pAff.forEach(p=>{ try{ shopColl('purchases').doc(p.id).set({supplierName:target},{merge:true}).catch(e=>console.error(e)); }catch(e){} });
    }
    ov.remove();
    toast(`${affected.length}টা ওষুধের কোম্পানি "${target}" করা হয়েছে ✓`);
    try{ renderMedicines(); }catch(e){}
    try{ renderPurchases(); }catch(e){}
    if(typeof after==='function') after();
  };
}
let purchaseShowCount = 30;
function renderPurchases(){
  const el = document.getElementById('purchaseList');
  const qEl = document.getElementById('purchaseSearch');
  const q = qEl ? bnToEnDigits(qEl.value||'').trim().toLowerCase() : '';
  const all = [...purchases].sort((a,b)=>b.ts-a.ts);
  const filteredAll = !q ? all : all.filter(p=>{
    const d = String(p.date||''); const [yy,mm,dd] = d.split('-');
    const hay = [p.medicineName, p.supplierName, _medCompanyOf(p.medicineId), p.batch, d.replace(/-/g,'/'), (dd&&mm&&yy)?(dd+'/'+mm+'/'+yy):'', (dd&&mm)?(dd+'/'+mm):''].join(' ').toLowerCase();
    return q.replace(/[-.]/g,'/').split(/\s+/).every(t=>hay.indexOf(t)>=0);
  });
  const list = filteredAll.slice(0, purchaseShowCount);
  const todayN = purchases.filter(p=>p.date===todayStr()).length;
  const todaySum = purchases.filter(p=>p.date===todayStr()).reduce((a,p)=>a+p.qty*p.price,0);
  const head = `<div class="row-sub" style="margin-bottom:8px;">মোট ক্রয় এন্ট্রি: <b>${all.length}টা</b>${q?` • মিলেছে: <b>${filteredAll.length}টা</b>`:''} • আজকের: <b>${todayN}টা (${fmt(todaySum)})</b></div>`;
  let lastDate = '';
  const rowsHtml = list.map(p=>{
    let sep = '';
    if(p.date!==lastDate){
      lastDate = p.date;
      const dayItems = filteredAll.filter(x=>x.date===p.date);
      const daySum = dayItems.reduce((a,x)=>a+x.qty*x.price,0);
      sep = `<div class="row-sub" style="margin:10px 0 2px;padding:5px 8px;background:#f1f5f2;border-radius:8px;font-weight:700;">${p.date===todayStr()?'আজ — ':''}${p.date} • ${dayItems.length}টা • ${fmt(daySum)}</div>`;
    }
    return sep + `
    <div class="row-item" onclick="openPurchaseModal('${p.id}')" style="cursor:pointer;"><div><div class="row-title">${medTypeTagFor(p.medicineId)}${escapeHtml(p.medicineName||'')}</div><div class="row-sub">${p.supplierName||_medCompanyOf(p.medicineId)||'সাপ্লায়ার নেই'}${p.batch?' • ব্যাচ: '+p.batch:''}${p.expiry?' • মেয়াদ: '+p.expiry:''}</div></div>
    <div class="row-right"><div class="row-title">${fmt(p.qty*p.price)}</div><div class="row-sub">${p.qty} × ${fmt(p.price)}</div></div></div>`;
  }).join('');
  const more = filteredAll.length > list.length
    ? `<button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="purchaseShowCount+=30;renderPurchases();">আরও দেখুন (আরও ${filteredAll.length-list.length}টা বাকি) ▼</button>` : '';
  el.innerHTML = all.length ? (head + (rowsHtml || `<div class="empty-state">কোনো মিল পাওয়া যায়নি</div>`) + more) : `<div class="empty-state">এখনো কোনো ক্রয় হয়নি</div>`;
}

