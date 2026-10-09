/* ---------------- POS Sale ---------------- */
let _posReturnPending = false;
function renderPosSearch(){
  const q = document.getElementById('posSearch').value.toLowerCase();
  const el = document.getElementById('posSearchResults');
  if(!q){ el.innerHTML=''; return; }
  const anyMatch = rankMeds(medicines, q, false);
  // সব মিলে যাওয়া ওষুধ দেখাবে — আগে স্টক আছে এমনগুলো, তারপর স্টক শূন্যগুলো
  const inStock = anyMatch.filter(m=>m.stock>0);
  const outStock = anyMatch.filter(m=>!(m.stock>0));
  const results = _recentFirst(inStock.concat(outStock), _justAdded('med')).slice(0,60);
  if(results.length){
    el.innerHTML = results.map(m=> m.stock>0 ? `
      <div class="row-item" onclick="addToCart('${m.id}')" style="cursor:pointer;">
        <div><div class="row-title">${medTypeTag(m.type)}${stripRedundantTypeSuffix(m.name, m.type)}</div><div class="row-sub">স্টক: ${m.stock}</div></div>
        <div class="row-title">${fmt(m.sell)}</div>
      </div>` : `
      <div class="row-item" onclick="togglePosBuy('${m.id}')" style="cursor:pointer;opacity:.85;flex-wrap:wrap;">
        <div><div class="row-title">${medTypeTag(m.type)}${stripRedundantTypeSuffix(m.name, m.type)}</div><div class="row-sub"><span class="badge badge-red">স্টক শূন্য</span></div></div>
        <div class="row-title">${fmt(m.sell)}</div>
        <div id="posBuy_${m.id}" style="display:none;width:100%;margin-top:8px;">
          <button class="btn btn-primary btn-block" onclick="event.stopPropagation();buyFromPos('${m.id}')">📦 ওষুধ ক্রয় করুন</button>
        </div>
      </div>`).join('');
  } else {
    el.innerHTML = `<div class="row-item" onclick="addMedicineFromPos()" style="cursor:pointer;"><div class="row-title" style="color:var(--primary);">+ ওষুধটি ওষুধ ইনভেন্টরিতে যোগ করুন</div></div>`;
  }
}
function togglePosBuy(id){
  const e = document.getElementById('posBuy_'+id);
  if(e) e.style.display = (e.style.display==='none') ? 'block' : 'none';
}
function buyFromPos(id){
  const med = medicines.find(m=>m.id===id); if(!med) return;
  openPurchaseModal(null);
  pickPMedicine(id, typePrefixPlain(med.type)+med.name);
}
// কার্টের আইটেমের সর্বোচ্চ সীমা সবসময় ইনভেন্টরির বর্তমান স্টক থেকে নেওয়া হয় —
// তাই ক্রয় করে স্টক বাড়ালে কার্ট মুছে নতুন করে ঢোকাতে হয় না
function syncCartStock(){
  cart.forEach(c=>{ const m = medicines.find(x=>x.id===c.id); if(m) c.maxStock = m.stock; });
}
function addMedicineFromPos(){
  const q = document.getElementById('posSearch').value.trim();
  document.getElementById('posSearchResults').innerHTML = '';
  _posReturnPending = true;
  openMedModal(null, q);
}
function addToCart(id){
  const med = medicines.find(m=>m.id===id);
  const existing = cart.find(c=>c.id===id);
  if(existing){ if(existing.qty<med.stock) existing.qty++; else toast('স্টকে আর নেই'); }
  else {
    cart.push({id:med.id, name:displayMedName(med), price:med.sell, qty:1, maxStock:med.stock, isAntibiotic:!!med.isAntibiotic});
  }
  document.getElementById('posSearch').value=''; document.getElementById('posSearchResults').innerHTML='';
  renderCart();
}
function changeQty(id, delta){
  syncCartStock();
  const item = cart.find(c=>c.id===id);
  item.qty += delta;
  if(item.qty<=0) cart = cart.filter(c=>c.id!==id);
  else if(item.qty>item.maxStock){ item.qty=item.maxStock; toast('সর্বোচ্চ স্টক সীমা'); }
  renderCart();
}
// Scales every item currently in the cart up or down together, keeping their existing
// quantity ratio to each other, so the cart's total lands as close as possible to the given
// amount — e.g. cart has Progut×1 and Napa×2 (1:2 ratio); asking for double the money keeps
// that same 1:2 ratio but roughly doubles both. An item that hits its stock limit freezes
// there (same as changeQty's cap) while the rest keep adjusting to make up the total.
function scaleCartByAmount(){
  syncCartStock();
  const valEl = document.getElementById('cartScaleAmount');
  const rawVal = parseFloat(bnToEnDigits(valEl ? valEl.value : '')) || 0;
  if(rawVal<=0){ toast('কত টাকার ওষুধ দেবেন লিখুন'); return; }
  if(!cart.length){ toast('কার্ট খালি — আগে ওষুধ যোগ করুন'); return; }

  const baseWeights = cart.map(c=>Math.max(c.qty,1)); // current quantities ARE the ratio to preserve
  const weightCostSum = cart.reduce((s,c,i)=>s+baseWeights[i]*c.price,0);
  if(weightCostSum<=0){ toast('মূল্য হিসাব করা গেল না'); return; }
  const scale = rawVal / weightCostSum;

  const rows = cart.map((c,i)=>({c, qty: Math.max(0, Math.round(baseWeights[i]*scale))}));
  rows.forEach(r=>{ if(r.qty > r.c.maxStock) r.qty = r.c.maxStock; });

  let totalCost = rows.reduce((s,r)=>s+r.qty*r.c.price,0);
  // Fine-tune to the exact amount: add single units to the cheapest not-yet-capped items first,
  // then trim from the priciest if unit-rounding pushed the total over — matches the same
  // budget-matching approach used for prescription/ledger amount-based re-sells.
  const byPriceAsc = [...rows].sort((a,b)=>a.c.price-b.c.price);
  let guard = 4000, progressed = true;
  while(totalCost < rawVal && progressed && guard-->0){
    progressed = false;
    for(const r of byPriceAsc){
      const remaining = rawVal - totalCost;
      if(remaining<=0) break;
      if(r.qty < r.c.maxStock && r.c.price>0 && r.c.price<=remaining){ r.qty+=1; totalCost+=r.c.price; progressed=true; }
    }
  }
  guard = 2000;
  while(totalCost > rawVal && guard-->0){
    const trimmable = rows.filter(r=>r.qty>0);
    if(!trimmable.length) break;
    trimmable.sort((a,b)=>b.c.price-a.c.price);
    trimmable[0].qty -= 1;
    totalCost -= trimmable[0].c.price;
  }

  rows.forEach(r=>{ r.c.qty = r.qty; });
  cart = cart.filter(c=>c.qty>0);
  renderCart();
  toast(`প্রায় ${fmt(totalCost)} টাকা অনুযায়ী কার্ট সমন্বয় করা হয়েছে ✓`);
}
function renderCart(){
  syncCartStock();
  const el = document.getElementById('cartList');
  el.innerHTML = cart.length ? cart.map((c,i)=>`
    <div class="cart-item">
      <div><div class="row-title" style="font-size:13.5px;">${i+1}. ${c.name} ${c.isAntibiotic?'<span class="badge badge-red" style="margin-left:4px;">এন্টিবায়োটিক</span>':''}</div><div class="row-sub">${fmt(c.price)} × ${c.qty}</div></div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQty('${c.id}',-1)">−</button>
        <span style="min-width:18px;text-align:center;font-weight:700;">${c.qty}</span>
        <button class="qty-btn" onclick="changeQty('${c.id}',1)">+</button>
      </div>
    </div>`).join('') : `<div class="empty-state">কার্ট খালি — ওপরে থেকে ওষুধ যোগ করুন</div>`;
  const subtotal = cart.reduce((a,c)=>a+c.price*c.qty,0);
  const discount = parseFloat(document.getElementById('saleDiscount').value)||0;
  document.getElementById('cartTotal').textContent = fmt(Math.max(subtotal-discount,0));
  const antibioticWrap = document.getElementById('antibioticInfoWrap');
  const hasAbx = cart.some(c=>c.isAntibiotic);
  if(antibioticWrap) antibioticWrap.style.display = hasAbx ? 'block' : 'none';
  const pNameLbl = document.getElementById('patientNameLabel');
  const pMobileLbl = document.getElementById('patientMobileLabel');
  if(pNameLbl) pNameLbl.textContent = hasAbx ? 'রোগীর নাম *' : 'রোগীর নাম (ঐচ্ছিক)';
  if(pMobileLbl) pMobileLbl.textContent = hasAbx ? 'রোগীর মোবাইল নম্বর *' : 'রোগীর মোবাইল নম্বর (ঐচ্ছিক)';
}
let _saleCustSel = '';   // বিক্রয়ে বাছা কাস্টমারের আইডি — তালিকা নতুন করে আঁকা হলেও হারায় না
function renderSaleCustomerSelect(){
  const el = document.getElementById('saleCustomer');
  const prevId = el.value || _saleCustSel;
  const prevSearch = document.getElementById('saleCustomerSearch').value;
  el.innerHTML = '<option value="">— ওয়াক-ইন কাস্টমার —</option>' + customers.map(c=>`<option value="${c.id}">${escapeHtml(c.name||'')}</option>`).join('');
  if(prevId && !customers.some(c=>c.id===prevId)){ const o=document.createElement('option'); o.value=prevId; o.textContent=prevSearch||''; el.appendChild(o); }
  el.value = prevId;
  document.getElementById('saleCustomerSearch').value = prevSearch;
  document.getElementById('saleCustomerResults').style.display = 'none';
  try{ renderSaleJustAdded(); }catch(e){}
}
function renderSaleCustomerSearch(){
  const qRaw = document.getElementById('saleCustomerSearch').value.trim();
  if(!qRaw && _saleCustSel && document.activeElement===document.getElementById('saleCustomerSearch')){ _saleCustSel=''; document.getElementById('saleCustomer').value=''; }
  const q = qRaw.toLowerCase();
  const resEl = document.getElementById('saleCustomerResults');
  const matches = _recentFirst(rankBy(customers, q, c=>c.name, [c=>c.mobile, c=>c.guardian, c=>c.address]), _justAdded('cust')).slice(0,15);
  let html = `<div class="row-item" onclick="pickSaleCustomer('','ওয়াক-ইন কাস্টমার')" style="cursor:pointer;padding:9px 10px;"><div class="row-title" style="font-size:13.5px;">— ওয়াক-ইন কাস্টমার —</div></div>`;
  html += matches.map(c=>`<div class="row-item" onclick="pickSaleCustomer('${c.id}','${c.name.replace(/'/g,"\\'")}')" style="cursor:pointer;padding:9px 10px;"><div class="row-title" style="font-size:13.5px;">${escapeHtml(c.name||'')}</div><div class="row-sub">${c.mobile||'—'}${c.due>0?' • বাকি '+fmt(c.due):(c.due<0?' • অগ্রিম '+fmt(-c.due):'')}</div></div>`).join('');
  // No saved customer matches what's typed (or nothing typed yet but this covers the
  // requested case: typing an unrecognized/new name should offer to save them as a
  // fresh customer, right from the POS search, instead of staying an untracked walk-in).
  if(qRaw && !matches.some(c=>(c.name||'').toLowerCase()===q)){
    html += `<div class="row-item" onclick="openCustomerModalFromSale('${qRaw.replace(/'/g,"\\'")}')" style="cursor:pointer;padding:9px 10px;border-top:1px solid var(--border);color:var(--primary-dark,#0a5c36);font-weight:700;">+ "${escapeHtml(qRaw)}" নামে নতুন কাস্টমার যোগ করুন</div>`;
  }
  resEl.innerHTML = html;
  resEl.style.display = 'block';
}
function pickSaleCustomer(id, name){
  _saleCustSel = id || '';
  { const _sel = document.getElementById('saleCustomer');
    if(id && !_sel.querySelector('option[value="'+id+'"]')){ const o=document.createElement('option'); o.value=id; o.textContent=name||''; _sel.appendChild(o); } }
  document.getElementById('saleCustomer').value = id;
  document.getElementById('saleCustomerSearch').value = id ? name : '';
  document.getElementById('saleCustomerResults').style.display = 'none';
  if(id){
    const cust = customers.find(c=>c.id===id);
    const pNameEl = document.getElementById('patientName');
    const pMobileEl = document.getElementById('patientMobile');
    if(cust && pNameEl && !pNameEl.value) pNameEl.value = cust.name||'';
    if(cust && pMobileEl && !pMobileEl.value) pMobileEl.value = cust.mobile||'';
  }
}
// The reverse direction of the fill above: picking a কাস্টমার auto-fills রোগীর নাম/মোবাইল, but
// typing directly into রোগীর নাম/মোবাইল (the common path when NOT coming from a saved
// প্রেসক্রিপশন) never used to touch কাস্টমার — so the sale silently stayed a ওয়াক-ইন, invisible
// to বাকি/ইতিহাস tracking, even though the printed slip clearly showed a real patient's name.
// Mirrors what applyRxRecordToSaleForm already does for the Rx-to-sale path. Only auto-links on
// a real-looking 11-digit বাংলাদেশি mobile (not name alone) — matching by name only risks
// silently merging two different people who just happen to share a common name, which is a much
// worse mistake than leaving a sale untracked. Never overrides a কাস্টমার the user already picked.
function syncPatientToSaleCustomer(){
  const custSel = document.getElementById('saleCustomer');
  if(!custSel || custSel.value) return;
  const name = (document.getElementById('patientName')?.value||'').trim();
  const mobile = (document.getElementById('patientMobile')?.value||'').trim();
  if(!name || !/^01\d{9}$/.test(mobile)) return;
  const existedBefore = customers.some(x=>(x.mobile||'').trim()===mobile);
  const cust = findOrCreateCustomerFor(name, mobile, '');
  if(cust){
    renderSaleCustomerSelect();
    custSel.value = cust.id;
    document.getElementById('saleCustomerSearch').value = cust.name;
    if(existedBefore && (cust.name||'').trim().toLowerCase() !== name.toLowerCase()){
      // The number was already saved under a DIFFERENT name — most often a real family member
      // sharing one phone, but could also just be a typo in this patient's mobile. Say so
      // plainly instead of quietly filing "Ambbia" under an existing "Rubi" profile with no
      // explanation — that mismatch is exactly what's confusing to spot after the fact.
      toast(mobile+' নম্বরটি আগে থেকেই "'+cust.name+'" নামে সেভ করা আছে — বাকি/ইতিহাস "'+cust.name+'"-এর নামেই জমা হবে (রোগীর নাম "'+name+'" স্লিপে আলাদাভাবে দেখাবে)। এটা ভুল/অন্য মানুষ হলে ওপরের কাস্টমার ঘর থেকে বদলে নতুন কাস্টমার বানান।');
    } else {
      toast('"'+cust.name+'" — কাস্টমার হিসেবে লিংক হয়েছে (বাকি/ইতিহাস এখন এই নামেই জমা হবে)। ভুল হলে ওপরের কাস্টমার ঘর থেকে বদলে দিন।');
    }
  }
}
// True while the customer-add modal was opened FROM the POS search's "+ নতুন কাস্টমার
// যোগ করুন" option, so saveCustomer() knows to select the new (or matched-duplicate)
// customer straight into the sale afterward, instead of just returning to the কাস্টমার tab.
let _saleQuickAddCustomer = false;
function openCustomerModalFromSale(prefillName){
  document.getElementById('saleCustomerResults').style.display = 'none';
  openCustomerModal();
  _saleQuickAddCustomer = true; // openCustomerModal() resets this flag, so it must be set AFTER
  document.getElementById('cName').value = prefillName || '';
}
document.addEventListener('click', function(e){
  const wrap = document.getElementById('saleCustomerSearch');
  const results = document.getElementById('saleCustomerResults');
  if(wrap && results && !wrap.contains(e.target) && !results.contains(e.target)){ results.style.display = 'none'; }
});
function getHiddenPrescribers(){
  try{ return JSON.parse(localStorage.getItem('ssn_hidden_prescribers')||'[]'); }catch(e){ return []; }
}
function hidePrescriberSuggestion(i){
  const p = _prescriberMatches[i];
  if(!p) return;
  const hidden = getHiddenPrescribers();
  const key = p.name.trim().toLowerCase();
  if(!hidden.includes(key)){ hidden.push(key); localStorage.setItem('ssn_hidden_prescribers', JSON.stringify(hidden)); }
  renderPrescriberSuggestions();
}
function getUniquePrescribers(includeHidden){
  const map = new Map();
  sales.forEach(s=>{
    if(!s.doctorName || !s.doctorName.trim()) return;
    const key = s.doctorName.trim().toLowerCase();
    map.set(key, {name:s.doctorName.trim(), title:s.doctorTitle||'', type:s.doctorType||'', ts:s.ts});
  });
  const hidden = getHiddenPrescribers();
  const all = Array.from(map.values());
  if(includeHidden) return all.map(p=>({...p, hidden:hidden.includes(p.name.trim().toLowerCase())})).sort((a,b)=>b.ts-a.ts);
  return all.filter(p=>!hidden.includes(p.name.trim().toLowerCase())).sort((a,b)=>b.ts-a.ts);
}
let _prescriberMatches = [];
let _hiddenPrescriberMatches = []; // names that matched the typed text but are on the hidden list — surfaced with an "আবার দেখান" recovery link
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function renderPrescriberSuggestions(){
  const q = document.getElementById('saleDoctorName').value.toLowerCase().trim();
  const resEl = document.getElementById('prescriberResults');
  if(!q){ resEl.style.display = 'none'; resEl.innerHTML=''; _prescriberMatches = []; _hiddenPrescriberMatches = []; return; }
  const all = getUniquePrescribers(true);
  _prescriberMatches = all.filter(p=>!p.hidden && (p.name||'').toLowerCase().split(/\s+/).some(word=>word.startsWith(q))).slice(0,8);
  _hiddenPrescriberMatches = all.filter(p=>p.hidden && (p.name||'').toLowerCase().split(/\s+/).some(word=>word.startsWith(q)));
  if(!_prescriberMatches.length && !_hiddenPrescriberMatches.length){ resEl.style.display = 'none'; resEl.innerHTML=''; return; }
  const hiddenNote = _hiddenPrescriberMatches.length ? `<div class="row-item" style="cursor:pointer;padding:9px 10px;color:#6b7280;font-size:12.5px;" onclick="unhideMatchingPrescribers()">↺ আগে লুকানো হয়েছিল — "${escapeHtml(_hiddenPrescriberMatches[0].name)}"${_hiddenPrescriberMatches.length>1?' ও আরও '+(_hiddenPrescriberMatches.length-1)+'টি':''} আবার দেখান</div>` : '';
  resEl.innerHTML = hiddenNote + _prescriberMatches.map((p,i)=>`<div class="row-item" style="cursor:pointer;padding:9px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;"><div onclick="pickPrescriber(${i})" style="flex:1;min-width:0;"><div class="row-title" style="font-size:13.5px;">${escapeHtml(p.name)}</div><div class="row-sub">${escapeHtml(p.title||'—')}</div></div><span onclick="hidePrescriberSuggestion(${i})" style="color:var(--red,#c0392b);font-size:18px;line-height:1;padding:4px 6px;flex-shrink:0;">×</span></div>`).join('');
  resEl.style.display = 'block';
}
function unhideMatchingPrescribers(){
  if(!_hiddenPrescriberMatches.length) return;
  const toRemove = _hiddenPrescriberMatches.map(p=>p.name.trim().toLowerCase());
  const updated = getHiddenPrescribers().filter(k=>!toRemove.includes(k));
  localStorage.setItem('ssn_hidden_prescribers', JSON.stringify(updated));
  toast('আবার দেখানো হচ্ছে ✓');
  renderPrescriberSuggestions();
}
function pickPrescriber(i){
  const p = _prescriberMatches[i];
  if(!p) return;
  document.getElementById('saleDoctorName').value = p.name;
  document.getElementById('saleDoctorTitle').value = p.title||'';
  if(p.type) document.getElementById('saleDoctorType').value = p.type;
  document.getElementById('prescriberResults').style.display = 'none';
  backupPrescriberFields();
}
let _savedPrescriber = {name:'', title:'', type:''};
function backupPrescriberFields(){
  _savedPrescriber = {
    name: document.getElementById('saleDoctorName').value,
    title: document.getElementById('saleDoctorTitle').value,
    type: document.getElementById('saleDoctorType').value
  };
}
function restorePrescriberFields(){
  if(_savedPrescriber.name) document.getElementById('saleDoctorName').value = _savedPrescriber.name;
  if(_savedPrescriber.title) document.getElementById('saleDoctorTitle').value = _savedPrescriber.title;
  if(_savedPrescriber.type) document.getElementById('saleDoctorType').value = _savedPrescriber.type;
}
document.addEventListener('click', function(e){
  const wrap = document.getElementById('saleDoctorName');
  const results = document.getElementById('prescriberResults');
  if(wrap && results && !wrap.contains(e.target) && !results.contains(e.target)){ results.style.display = 'none'; }
});
function togglePartialCash(){
  const isDue = document.getElementById('payMethod').value==='due';
  document.getElementById('partialCashWrap').style.display = isDue ? 'block' : 'none';
  if(isDue) document.getElementById('cashPaidNow').value = 0;
}
function completeSale(){
  if(!cart.length){ toast('কার্ট খালি'); return; }
  // কাস্টমার ঘরে নাম লেখা আছে কিন্তু বাছা (সিলেক্ট) হয়নি — চুপচাপ ওয়াক-ইন বিক্রি না করে নিজে মিলিয়ে নেয়, না মিললে থামিয়ে জানায়
  {
    const selEl = document.getElementById('saleCustomer'), txtEl = document.getElementById('saleCustomerSearch');
    const typed = (txtEl && txtEl.value || '').trim();
    if(selEl && !selEl.value && typed && !/ওয়াক-ইন/.test(typed)){
      const tk = normalizeMedName(typed);
      const hits = customers.filter(c=>normalizeMedName(c.name||'')===tk);
      if(hits.length===1){ renderSaleCustomerSelect(); pickSaleCustomer(hits[0].id, hits[0].name); toast('কাস্টমার নিজে ধরা হয়েছে: '+hits[0].name); }
      else {
        toast(hits.length>1 ? '"'+typed+'" নামে একাধিক কাস্টমার আছে — তালিকা থেকে সঠিকজনকে বেছে নিন' : '"'+typed+'" নামে কাস্টমার বাছা হয়নি — নিচের তালিকা থেকে বেছে নিন বা "+ নতুন কাস্টমার যোগ করুন" চাপুন');
        renderSaleCustomerSearch(); return;
      }
    }
  }
  // Guard: if the button gets tapped again while a sale is already mid-save (slow phone/network,
  // or the user assumes an earlier tap failed because they saw no visible confirmation), don't
  // silently create a second/third duplicate sale for the same cart. (found: 2026-09-27 —
  // repeated taps were each fully succeeding with no visible feedback, quietly stacking up
  // several identical sales and inflating a customer's বাকি.)
  if(_completingSale) return;
  _completingSale = true;
  const saleBtn = document.querySelector('[onclick="completeSale()"]');
  if(saleBtn){ saleBtn.disabled = true; saleBtn.style.opacity = '0.6'; }
  try{
    completeSaleInner();
  } finally {
    _completingSale = false;
    if(saleBtn){ saleBtn.disabled = false; saleBtn.style.opacity = ''; }
  }
}
function completeSaleInner(){
  const subtotal = cart.reduce((a,c)=>a+c.price*c.qty,0);
  const discount = parseFloat(document.getElementById('saleDiscount').value)||0;
  const total = Math.max(subtotal-discount,0);
  const payMethod = document.getElementById('payMethod').value;
  const custId = document.getElementById('saleCustomer').value;
  const cust = customers.find(c=>c.id===custId);
  const doctorName = document.getElementById('saleDoctorName').value.trim();
  const doctorTitle = document.getElementById('saleDoctorTitle').value.trim();
  const doctorType = document.getElementById('saleDoctorType').value;
  const diagnosis = document.getElementById('saleDiagnosis').value.trim();
  const hasAntibiotic = cart.some(c=>c.isAntibiotic);
  const patientName = document.getElementById('patientName').value.trim();
  const patientMobile = document.getElementById('patientMobile').value.trim();
  if(hasAntibiotic){
    if(!doctorName){ toast('এন্টিবায়োটিক বিক্রির জন্য প্রেসক্রাইবারের নাম আবশ্যক'); return; }
    if(!patientName){ toast('এন্টিবায়োটিক বিক্রির জন্য রোগীর নাম আবশ্যক'); return; }
    if(!patientMobile){ toast('এন্টিবায়োটিক বিক্রির জন্য রোগীর মোবাইল নম্বর আবশ্যক'); return; }
  }

  let cashPaidNow = total, dueAdded = 0;
  if(payMethod==='due'){
    cashPaidNow = Math.min(parseFloat(document.getElementById('cashPaidNow').value)||0, total);
    dueAdded = total - cashPaidNow;
    if(dueAdded>0 && !cust){
      toast('বাকি রাখতে হলে আগে কাস্টমার বেছে নিন বা নতুন কাস্টমার যোগ করুন');
      return;
    }
  }

  // অগ্রিম জমা থাকলে এই বিক্রয়ের দাম থেকে কেটে নেওয়ার সুযোগ
  if(cust){ try{ reconcileOne(cust.id); }catch(e){} }
  if(cust && (cust.due||0)<0 && cashPaidNow>0){
    const adv = -cust.due, use = Math.min(adv, cashPaidNow);
    if(confirm('এই কাস্টমারের অগ্রিম জমা আছে '+fmt(adv)+'।\n\nএই বিক্রয়ের '+fmt(use)+' অগ্রিম থেকে কেটে নেবেন?\n\nOK = অগ্রিম থেকে কাটুন\nCancel = পুরো টাকা নগদ নিন')){
      cashPaidNow -= use; dueAdded += use;
    }
  }

  const saleRecord = { id:uid(), ts:Date.now(), date:todayStr(), items:cart, subtotal, discount, total,
    payMethod, cashPaidNow, dueAdded, doctorName, doctorTitle, doctorType, diagnosis:diagnosis||null, customerId:custId||null, customerName:cust?cust.name:null,
    patientName:patientName||null, patientMobile:patientMobile||null, rxId:_pendingSaleRxId||null };

  // A completed sale naming this prescriber is a strong signal they're in active use again —
  // so un-hide them if an earlier accidental × tap had hidden this name from suggestions.
  if(doctorName){
    const key = doctorName.trim().toLowerCase();
    const hidden = getHiddenPrescribers();
    if(hidden.includes(key)) localStorage.setItem('ssn_hidden_prescribers', JSON.stringify(hidden.filter(k=>k!==key)));
  }

  // A real medicine sale in this customer's name is exactly the signal that turns a
  // test-only "provisional" record into a proper customer, so it now shows in the কাস্টমার tab.
  const custWasProvisional = !!(cust && cust.provisional);
  if(custWasProvisional) cust.provisional = false;

  // সবসময় আগে লোকাল ফোনে সাথে সাথে আপডেট করি — ইন্টারনেট/ক্লাউডে সমস্যা হলেও যেন বিক্রয়ের হিসাব ফোনে দেখা যায়
  cart.forEach(c=>{ const med = medicines.find(m=>m.id===c.id); if(med) med.stock -= c.qty; });
  save(DB_KEYS.med, medicines);
  sales.push(saleRecord); _lastSaleId = saleRecord.id;
  save(DB_KEYS.sale, sales);
  if(dueAdded>0 && cust){ cust.due = (cust.due||0) + dueAdded; }
  if(custWasProvisional || (dueAdded>0 && cust)) save(DB_KEYS.customer, customers);
  renderDashboard();

  if(cloudReady()){
    cart.forEach(c=>{ shopColl('medicines').doc(c.id).update({stock: firebase.firestore.FieldValue.increment(-c.qty)}).catch(e=>{ console.error(e); toast('⚠️ ক্লাউডে স্টক আপডেট ব্যর্থ হয়েছে — ইন্টারনেট চেক করুন'); }); });
    if(dueAdded>0 && cust){
      shopColl('customers').doc(cust.id).update({due: firebase.firestore.FieldValue.increment(dueAdded)}).catch(e=>{ console.error(e); toast('⚠️ ক্লাউডে বাকি আপডেট ব্যর্থ হয়েছে'); });
    }
    if(custWasProvisional){
      shopColl('customers').doc(cust.id).update({provisional:false}).catch(e=>console.error(e));
    }
    shopColl('sales').doc(saleRecord.id).set(saleRecord).catch(e=>{ console.error(e); toast('⚠️ ক্লাউডে বিক্রয় সংরক্ষণ ব্যর্থ হয়েছে — এই বিক্রয় আপাতত শুধু এই ফোনেই আছে'); });
  }

  cart = []; document.getElementById('saleDiscount').value=0; document.getElementById('saleCustomer').value=''; _saleCustSel='';
  document.getElementById('saleCustomerSearch').value='';
  document.getElementById('saleDoctorName').value=''; document.getElementById('saleDoctorTitle').value='';
  document.getElementById('saleDoctorType').value=''; _savedPrescriber = {name:'', title:'', type:''};
  document.getElementById('saleDiagnosis').value='';
  document.getElementById('patientName').value=''; document.getElementById('patientMobile').value='';
  document.getElementById('payMethod').value='cash'; togglePartialCash();
  _pendingSaleRxId = null;
  renderCart();
  // Success is guaranteed visible on its own — even if showReceipt() below hiccups for any
  // reason (slow device, a bad field on this particular sale), the cashier still sees a clear
  // "done" signal instead of silently wondering whether to press the button again.
  toast('✓ বিক্রয় সম্পন্ন হয়েছে');
  try{
    showReceipt(saleRecord);
  }catch(e){
    console.error('receipt render failed', e);
    toast('⚠️ বিক্রয় হয়ে গেছে, কিন্তু রশিদ দেখাতে সমস্যা হয়েছে — কাস্টমার/রিপোর্ট থেকে পরে দেখতে পারবেন');
  }
}
function showTodayProfit(){
  const t = todayStr();
  const todaySales = sales.filter(s=>s.date===t).sort((a,b)=>b.ts-a.ts);
  const todayLabTests = labTests.filter(lt=>lt.date===t && labTestTotals(lt).price>0).sort((a,b)=>b.ts-a.ts);
  let totalProfit = 0;
  const rows = todaySales.map(s=>{
    const cost = s.items.reduce((x,it)=>{ const med=medicines.find(m=>m.id===it.id); return x+(med?(med.buy||0)*it.qty:0); },0);
    const profit = s.total - cost;
    totalProfit += profit;
    return `<div class="row-item" onclick="showReceiptById('${s.id}')" style="cursor:pointer;">
      <div><div class="row-title">${s.customerName||'ওয়াক-ইন কাস্টমার'}</div><div class="row-sub">বিক্রয়: ${fmt(s.total)} • ${s.items.length} আইটেম</div></div>
      <div class="row-right"><div class="row-title">${fmt(profit)}</div><div class="row-sub">লাভ</div></div>
    </div>`;
  }).join('');
  const testRows = todayLabTests.map(lt=>{
    const x = labTestTotals(lt);
    totalProfit += x.profit;
    return `<div class="row-item" onclick="viewLabTestReceipt('${lt.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(lt.patientName)}</div><div class="row-sub">টেস্ট: ${fmt(x.price)} • ${(lt.tests||[]).length} আইটেম</div></div>
      <div class="row-right"><div class="row-title">${fmt(x.profit)}</div><div class="row-sub">লাভ</div></div>
    </div>`;
  }).join('');
  const hasAny = todaySales.length || todayLabTests.length;
  document.getElementById('detailModalTitle').textContent = 'আজকের লাভের হিসাব';
  document.getElementById('detailModalContent').innerHTML = (hasAny ? (rows + testRows) : `<div class="empty-state">আজ এখনো কোনো বিক্রয় হয়নি</div>`) +
    (hasAny ? `<div class="row-item" style="border:none;margin-top:6px;padding-top:12px;border-top:1.5px solid #ddd;"><div class="row-title">সর্বমোট লাভ</div><div class="row-title">${fmt(totalProfit)}</div></div>` : '');
  openModal('detailModalBackdrop');
}
function showTodaySales(){
  const t = todayStr();
  const todaySales = sales.filter(s=>s.date===t).sort((a,b)=>b.ts-a.ts);
  const todayLabTests = labTests.filter(lt=>lt.date===t && labTestTotals(lt).price>0).sort((a,b)=>b.ts-a.ts);
  const rows = todaySales.map(s=>`
    <div class="row-item" onclick="showReceiptById('${s.id}')" style="cursor:pointer;">
      <div><div class="row-title">${s.customerName||'ওয়াক-ইন কাস্টমার'}</div><div class="row-sub">${s.items.length} আইটেম • ${new Date(s.ts).toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'})}</div></div>
      <div class="row-right"><div class="row-title">${fmt(s.total)}</div><div class="row-sub">${s.payMethod==='due'?'বাকি':'নগদ'}</div></div>
    </div>`).join('');
  const testRows = todayLabTests.map(lt=>{
    const x = labTestTotals(lt);
    return `<div class="row-item" onclick="viewLabTestReceipt('${lt.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(lt.patientName)} <span class="tag-en">টেস্ট</span></div><div class="row-sub">${(lt.tests||[]).length} আইটেম • ${new Date(lt.ts).toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'})}</div></div>
      <div class="row-right"><div class="row-title">${fmt(x.price)}</div><div class="row-sub">নগদ</div></div>
    </div>`;
  }).join('');
  document.getElementById('detailModalTitle').textContent = 'আজকের বিক্রয় (' + (todaySales.length+todayLabTests.length) + 'টা)';
  document.getElementById('detailModalContent').innerHTML = (rows+testRows) || `<div class="empty-state">আজ এখনো কোনো বিক্রয় হয়নি</div>`;
  openModal('detailModalBackdrop');
}
function showTodayPurchases(){
  const t = todayStr();
  const todayP = purchases.filter(p=>p.date===t).sort((a,b)=>b.ts-a.ts);
  const rows = todayP.map(p=>`
    <div class="row-item" onclick="openPurchaseFrom('${p.id}','showTodayPurchases')" style="cursor:pointer;">
      <div><div class="row-title">${medTypeTagFor(p.medicineId)}${escapeHtml(p.medicineName||'')}</div><div class="row-sub">${p.supplierName||_medCompanyOf(p.medicineId)||'সাপ্লায়ার নেই'}</div></div>
      <div class="row-right"><div class="row-title">${fmt(p.qty*p.price)}</div><div class="row-sub">${p.qty} × ${fmt(p.price)}</div></div>
    </div>`).join('');
  document.getElementById('detailModalTitle').textContent = 'আজকের ক্রয় (' + todayP.length + 'টা)';
  document.getElementById('detailModalContent').innerHTML = rows || `<div class="empty-state">আজ এখনো কোনো ক্রয় হয়নি</div>`;
  openModal('detailModalBackdrop');
}
function showAllDues(){
  const withDue = customers.filter(c=>c.due>0).sort((a,b)=>b.due-a.due);
  const _pIdx = _buildPeopleIndex();
  const rows = withDue.map(c=>`
    <div class="row-item" onclick="closeModal('detailModalBackdrop');showLedger('${c.id}')" style="cursor:pointer;">
      <div style="min-width:0;"><div class="row-title">${escapeHtml(c.name||'')}</div><div class="row-sub">${c.mobile||'—'}</div>${_peopleLine(_pIdx[c.id], c)}</div>
      <div class="row-right"><span class="badge badge-red">বাকি ${fmt(c.due)}</span></div>
    </div>`).join('');
  document.getElementById('detailModalTitle').textContent = 'যাদের কাছে বাকি আছে (' + withDue.length + 'জন) • মোট ' + fmt(withDue.reduce((a,c)=>a+Math.round(c.due||0),0));
  document.getElementById('detailModalContent').innerHTML = rows || `<div class="empty-state">কারো কাছে বাকি নেই ✓</div>`;
  openModal('detailModalBackdrop');
}
let lowStockGroupsCache = [];
function showAllLowStock(){
  const low = medicines.filter(m=>m.stock<=m.lowLimit).sort((a,b)=>a.stock-b.stock);
  const groupsMap = {};
  low.forEach(m=>{
    const key = (m.company && m.company.trim()) ? m.company.trim() : 'কোম্পানি উল্লেখ নেই';
    (groupsMap[key] = groupsMap[key] || []).push(m);
  });
  lowStockGroupsCache = Object.keys(groupsMap)
    .sort((a,b)=>groupsMap[b].length-groupsMap[a].length)
    .map(k=>({company:k, items:groupsMap[k]}));
  const rows = lowStockGroupsCache.map((g,idx)=>`
    <div class="row-item" onclick="showLowStockCompanyDetail(${idx})" style="cursor:pointer;">
      <div class="row-title">${g.company}</div><span class="badge badge-red">${g.items.length}টি কম</span>
    </div>`).join('');
  document.getElementById('detailModalTitle').textContent = 'লো স্টক — কোম্পানি অনুযায়ী (' + low.length + 'টা)';
  document.getElementById('detailModalContent').innerHTML = rows || `<div class="empty-state">সব ওষুধে পর্যাপ্ত স্টক আছে ✓</div>`;
  openModal('detailModalBackdrop');
}
function showAllExpiry(){
  const soon = medicines.filter(m=>m.expiry).map(m=>({...m, days:(new Date(m.expiry)-new Date())/86400000})).filter(m=>m.days<60).sort((a,b)=>a.days-b.days);
  const rows = soon.map(m=>`
    <div class="row-item" onclick="closeModal('detailModalBackdrop');goToMedicine('${m.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(m.name||'')}</div><div class="row-sub">ব্যাচ: ${m.batch||'—'}</div></div>
      <span class="badge ${m.days<0?'badge-red':'badge-gold'}">${m.days<0?'মেয়াদ শেষ':Math.ceil(m.days)+' দিন বাকি'}</span>
    </div>`).join('');
  document.getElementById('detailModalTitle').textContent = 'সব মেয়াদ সতর্কতা (' + soon.length + 'টা)';
  document.getElementById('detailModalContent').innerHTML = rows || `<div class="empty-state">কোনো সতর্কতা নেই ✓</div>`;
  openModal('detailModalBackdrop');
}
function showLowStockCompanyDetail(idx){
  const g = lowStockGroupsCache[idx];
  if(!g) return;
  const rows = g.items.map(m=>`
    <div class="row-item" onclick="closeModal('detailModalBackdrop');goToMedicine('${m.id}')" style="cursor:pointer;">
      <div class="row-title">${escapeHtml(m.name||'')}</div><span class="badge badge-red">স্টক: ${m.stock}</span>
    </div>`).join('');
  document.getElementById('detailModalTitle').innerHTML = `<span onclick="showAllLowStock()" style="cursor:pointer;margin-right:6px;">←</span>${g.company} (${g.items.length}টা)`;
  document.getElementById('detailModalContent').innerHTML = rows;
}
function goToMedicine(id){
  showSection('medicines');
  openMedModal(id);
}
function formatPrescriberLine(sale){
  if(!sale.doctorName) return '';
  let label = 'প্রেসক্রাইবার', displayName = sale.doctorName;
  if(sale.doctorType==='doctor'){ label='ডাঃ'; displayName = sale.doctorName; }
  else if(sale.doctorType==='paramedic'){ label='প্যারামেডিক'; }
  else if(sale.doctorType==='samo'){ label='উপ-সহকারী মেডিকেল অফিসার'; }
  return `${label}: ${displayName}${sale.doctorTitle?' ('+sale.doctorTitle+')':''}`;
}
function showReceiptById(id){
  const sale = sales.find(s=>s.id===id);
  if(sale) showReceipt(sale);
}
// Sales are normally an append-only record on purpose (audit trail) — this exists specifically
// for correcting a genuine mistake (e.g. an accidental duplicate from a repeated button tap),
// not for routine editing. Reverses exactly what completeSale() did: adds the sold quantities
// back to stock and removes any বাকি this sale added to the customer, both locally and in the
// cloud, then removes the sale record itself.
async function deleteSaleRecord(id){
  if(!requireOwnerRole('বিক্রয় মুছে ফেলা')) return;
  const sale = sales.find(s=>s.id===id);
  if(!sale) return;
  if(!confirm('এই বিক্রয়টি মুছে ফেলবেন? এতে স্টক ফিরে যোগ হবে এবং এই বিক্রয়ে যোগ হওয়া বাকি (থাকলে) বিয়োগ হয়ে যাবে। ভুল/ডুপ্লিকেট বিক্রয় ঠিক করার জন্যই এটা — সাধারণভাবে বিক্রয় মুছবেন না।')) return;
  try{
    sale.items.forEach(it=>{ const med = medicines.find(m=>m.id===it.id); if(med) med.stock += it.qty; });
    save(DB_KEYS.med, medicines);
    let cust = null;
    if(sale.customerId && sale.dueAdded>0){
      cust = customers.find(c=>c.id===sale.customerId);
      if(cust) cust.due = (cust.due||0) - sale.dueAdded;
    }
    if(cust) save(DB_KEYS.customer, customers);
    addTombstone(id); // MUST happen before save() below — otherwise save()'s stale-write recovery
    // (which exists to protect against a multi-tab overwrite wiping a real record) sees this id
    // missing from the array we're about to write and pushes it right back in from what's still
    // in localStorage, undoing the delete in the same call. This was the actual reason deletes
    // looked like they weren't working (found: 2026-09-27).
    sales = sales.filter(s=>s.id!==id);
    save(DB_KEYS.sale, sales);
    if(cloudReady()){
      sale.items.forEach(it=>{ shopColl('medicines').doc(it.id).update({stock: firebase.firestore.FieldValue.increment(it.qty)}).catch(e=>console.error(e)); });
      if(cust) shopColl('customers').doc(cust.id).update({due: cust.due}).catch(e=>console.error(e));
      shopColl('sales').doc(id).delete().catch(e=>console.error(e));
    }
    toast('✓ বিক্রয়টি মুছে ফেলা হয়েছে, স্টক ও বাকি ঠিক করা হয়েছে');
    renderDashboard();
    if(cust) showLedger(cust.id); else closeModal('receiptModalBackdrop');
  }catch(e){ console.error(e); toast('মুছতে সমস্যা হয়েছে'); }
}
let _rcptSplit = false, _rcptSale = null;   // বাকির ভাগ রসিদে দেখানো — ডিফল্ট বন্ধ, প্রতিবার নতুন রসিদ খুললে আবার বন্ধ
function toggleReceiptSplit(v){ _rcptSplit = !!v; if(_rcptSale) showReceipt(_rcptSale, true); }
let _rcptOpenedAt = 0, _lastSaleId = null;
function closeReceiptSafe(){ if(Date.now() - _rcptOpenedAt < 900) return; closeModal('receiptModalBackdrop'); }
function showLastReceipt(){ const sl = _lastSaleId ? sales.find(x=>x.id===_lastSaleId) : [...sales].sort((a,b)=>b.ts-a.ts)[0]; if(sl) showReceipt(sl); else toast('এখনো কোনো বিক্রয় নেই'); }
function showReceipt(sale, keepSplit){
  _rcptOpenedAt = Date.now();
  _rcptSale = sale; if(!keepSplit) _rcptSplit = false;
  const dt = new Date(sale.ts);
  const dateStr = dt.toLocaleDateString('bn-BD') + ' ' + dt.toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
  const rows = sale.items.map((it,i)=>`
    <tr><td class="num">${i+1}.</td><td>${escapeHtml(it.name||'')}</td><td class="num">${it.qty}</td><td class="num">${fmt(it.price)}</td><td class="num">${fmt(it.price*it.qty)}</td></tr>
  `).join('');
  const cust = sale.customerId ? customers.find(c=>c.id===sale.customerId) : null;
  const cashPaidNow = (sale.cashPaidNow!==undefined) ? sale.cashPaidNow : sale.total;
  const dueAdded = sale.dueAdded || 0;
  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt">
      <div class="r-head">
        <div class="r-shop">শ্রী শ্রী নৃসিংহ মেডিকেল হল</div>
        <div class="r-sub" style="color:#000;"><b style="font-size:1.2em;font-weight:800;letter-spacing:0.3px;">প্রোপ্রাইটর: প্রদীপ চন্দ্র হাওলাদার</b></div>
        <div class="r-sub" style="color:#000;"><b style="font-size:1.2em;font-weight:800;letter-spacing:0.3px;">মোবাইল: ০১৭৩৯০৯৭৩৯০</b></div>
        <div class="r-sub" style="color:#000;">সোনাখালী, আমতলী, বরগুনা।</div>
      </div>
      <div class="r-meta">
        <span>তারিখ: ${dateStr}</span>
        <span>কাস্টমার: ${sale.customerName||'ওয়াক-ইন'}</span>
      </div>
      ${cust ? `<div class="r-meta" style="margin-top:-4px;">
        <span>${cust.mobile?'মোবাইল: '+cust.mobile:''}</span>
        <span>${(cust.age||cust.ageMonths)?'বয়স: '+formatAge(cust):''}</span>
      </div>` : ''}
      ${sale.doctorName ? `<div class="r-sub" style="margin-top:-2px;">${formatPrescriberLine(sale)}</div>` : ''}
      ${sale.diagnosis ? `<div class="r-sub" style="margin-top:-2px;">রোগ: ${sale.diagnosis}</div>` : ''}
      ${sale.patientName ? `<div class="r-sub" style="margin-top:-2px;">রোগী: ${sale.patientName}${sale.patientMobile?' • মোবাইল: '+sale.patientMobile:''}</div>` : ''}
      <table>
        <thead><tr><th class="num">ক্র</th><th>ওষুধ</th><th class="num">পরিমাণ</th><th class="num">দর</th><th class="num">মোট</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table>
        <tr><td>উপমোট</td><td class="num">${fmt(sale.subtotal)}</td></tr>
        ${sale.discount>0?`<tr><td>ছাড়</td><td class="num">-${fmt(sale.discount)}</td></tr>`:''}
        <tr class="r-total-row"><td>সর্বমোট</td><td class="num">${fmt(sale.total)}</td></tr>
        <tr><td>নগদ পরিশোধ</td><td class="num">${fmt(cashPaidNow)}</td></tr>
        ${dueAdded>0?`<tr><td>এই বিক্রয়ে নতুন বাকি</td><td class="num">${fmt(dueAdded)}</td></tr>`:''}
        ${cust?`<tr><td><b>${(cust.due||0)<0?'অগ্রিম জমা (এখন)':'সর্বমোট বাকি (এখন)'}</b></td><td class="num"><b>${fmt(Math.abs(cust.due||0))}</b></td></tr>`:''}
        ${_receiptDueParts(cust).map(p=>`<tr><td style="font-size:0.85em;padding-left:10px;">• ${escapeHtml(p.label)}</td><td class="num" style="font-size:0.85em;">${fmt(p.amt)}</td></tr>`).join('')}
      </table>
      <div class="r-foot">ধন্যবাদ — সুস্থ থাকুন</div>
      <div class="r-foot" style="margin-top:6px;font-weight:700;">বিঃদ্রঃ বিক্রিত ঔষধ ফেরত হয় না।</div>
      ${shopQrHtml()}
    </div>`;
  window._lastReceiptText = buildReceiptText(sale, dateStr, cust);
  try{
    const _f = _rcptSplit; _rcptSplit = true; const _has = _receiptDueParts(cust).length > 0; _rcptSplit = _f;
    document.getElementById('rcptSplitBox').style.display = _has ? 'block' : 'none';
    document.getElementById('rcptSplitChk').checked = _rcptSplit;
  }catch(e){}
  openModal('receiptModalBackdrop');
}
function shopQrHtml(){
  const waLink = 'https://wa.me/8801739097390';
  const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=' + encodeURIComponent(waLink);
  return `<div class="r-qr" style="text-align:center;margin-top:10px;">
    <img src="${qrSrc}" width="100" height="100" alt="WhatsApp QR" style="width:100px;height:100px;" onerror="this.style.display='none'">
    <div style="font-size:10px;color:#000;margin-top:2px;">স্ক্যান করে হোয়াটসঅ্যাপে যোগাযোগ করুন</div>
  </div>`;
}
// রসিদে "সর্বমোট বাকি"-র নিচে কার নামে কত (ও নিজের ভাগ) — শুধু যখন কাস্টমারের বাকি আছে আর একাধিক নামে ভাগ হয়েছে
function _receiptDueParts(cust){
  try{
    if(!_rcptSplit || !cust || !((cust.due||0) > 0)) return [];
    const sp = _dueSplit(_buildPeopleIndex()[cust.id], cust);
    if(!sp.others.length) return [];
    const parts = sp.others.map(p=>({label:p.name, amt:Math.round(p.rem)}));
    if(sp.own > 0.5) parts.push({label:'নিজে', amt:sp.own});
    return parts;
  }catch(e){ return []; }
}
function buildReceiptText(sale, dateStr, cust){
  let t = `শ্রী শ্রী নৃসিংহ মেডিকেল হল\nতারিখ: ${dateStr}\nকাস্টমার: ${sale.customerName||'ওয়াক-ইন'}\n`;
  if(cust && cust.mobile) t += `মোবাইল: ${cust.mobile}\n`;
  if(cust && (cust.age||cust.ageMonths)) t += `বয়স: ${formatAge(cust)}\n`;
  if(sale.doctorName) t += formatPrescriberLine(sale) + `\n`;
  if(sale.diagnosis) t += `রোগ: ${sale.diagnosis}\n`;
  if(sale.patientName) t += `রোগী: ${sale.patientName}${sale.patientMobile?' • মোবাইল: '+sale.patientMobile:''}\n`;
  t += `\n`;
  sale.items.forEach((it,i)=>{ t += `${i+1}. ${it.name} x${it.qty} = ${fmt(it.price*it.qty)}\n`; });
  t += `\nউপমোট: ${fmt(sale.subtotal)}\n`;
  if(sale.discount>0) t += `ছাড়: -${fmt(sale.discount)}\n`;
  const cashPaidNow = (sale.cashPaidNow!==undefined) ? sale.cashPaidNow : sale.total;
  const dueAdded = sale.dueAdded || 0;
  t += `সর্বমোট: ${fmt(sale.total)}\nনগদ পরিশোধ: ${fmt(cashPaidNow)}\n`;
  if(dueAdded>0) t += `এই বিক্রয়ে নতুন বাকি: ${fmt(dueAdded)}\n`;
  if(cust) t += ((cust.due||0)<0 ? `অগ্রিম জমা (এখন): ${fmt(-cust.due)}\n` : `সর্বমোট বাকি (এখন): ${fmt(cust.due||0)}\n`);
  { const _dp = _receiptDueParts(cust); if(_dp.length){ t += `  এর মধ্যে:\n`; _dp.forEach(p=>{ t += `  - ${p.label}: ${fmt(p.amt)}\n`; }); } }
  t += `\nধন্যবাদ\nবিঃদ্রঃ বিক্রিত ঔষধ ফেরত হয় না।`;
  return t;
}
function printReceipt(){ _printOnly('receiptContent', false); }
async function shareReceipt(){
  const text = window._lastReceiptText || '';
  if(navigator.share){
    try{ await navigator.share({title:'ক্যাশ মেমো', text}); }catch(e){}
  } else {
    try{ await navigator.clipboard.writeText(text); toast('মেমো কপি হয়েছে — পেস্ট করে পাঠান'); }
    catch(e){ toast('শেয়ার সাপোর্ট নেই এই ব্রাউজারে'); }
  }
}

