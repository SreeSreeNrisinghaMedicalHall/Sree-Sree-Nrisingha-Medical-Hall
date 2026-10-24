/* ===== ফেরত (v35) =====
   ফেরত আলাদা রেকর্ড হিসেবে জমা হয়; মূল বিক্রি/ক্রয় বদলায় না।
   • কাস্টমারের ফেরত = "ঋণাত্মক বিক্রয়" (isReturn:true, returnOf:মূল বিক্রয়ের id): মোট/পরিমাণ ঋণাত্মক, তাই বিক্রির মোট, লাভ, ক্যাশ, টপ ওষুধ — সব আপনা-আপনি নিট হয়।
       টাকা মেটানো: নগদ ফেরত (cashPaidNow ঋণাত্মক) অথবা কাস্টমারের বাকি থেকে কমানো (dueAdded ঋণাত্মক — বাকির হিসাবে আগে থেকেই ঋণাত্মক dueAdded ঠিকঠাক গোনা হয়)।
   • কোম্পানিকে ফেরত = "ঋণাত্মক ক্রয়" (isReturn:true): পরিমাণ ঋণাত্মক; credit:true হলে সাপ্লায়ারের দেনা কমে, credit:false (নগদ ফেরত পাওয়া) হলে ক্যাশ হিসাবে নগদ-ক্রয় কমে।
   • ফেরত মুছলে স্টক/বাকি আগের অবস্থায় ফেরে। ওষুধের ক্রয়মূল্য/বিক্রয়মূল্য ফেরতে বদলায় না। */
let _retSale = null, _rpMedId = null;
function _r2b(n){ return Math.round((+n||0)*100)/100; }
function returnDoneQty(saleId, itemId){
  let q = 0;
  repSales().forEach(s=>{ if(s.isReturn && s.returnOf===saleId) (s.items||[]).forEach(it=>{ if(it.id===itemId) q += Math.abs(it.qty||0); }); });
  return q;
}
function returnRemaining(sale){
  return (sale.items||[]).map(it=>Math.max(0, (it.qty||0) - returnDoneQty(sale.id, it.id)));
}
function returnUpdateReceiptBtn(sale){
  const b = document.getElementById('rcptReturnBtn'), d = document.getElementById('rcptReturnDelBtn');
  let show = false, del = false;
  try{
    const owner = currentRole()==='owner';
    show = !!sale && !sale.isReturn && owner && returnRemaining(sale).some(x=>x>1e-9);
    del = !!sale && !!sale.isReturn && owner;     // ফেরত রসিদে "ভুল ফেরত মুছুন"
  }catch(e){}
  if(b) b.style.display = show ? 'block' : 'none';
  if(d) d.style.display = del ? 'block' : 'none';
}
// রসিদের জানালা আগে বন্ধ করি — না হলে ফেরতের জানালা তার পেছনে লুকিয়ে থাকত
function returnOpenFromReceipt(){
  if(!_rcptSale) return;
  const id = _rcptSale.id;
  try{ closeModal('receiptModalBackdrop'); }catch(e){}
  returnOpenForSale(id);
}
function returnCancel(){
  try{ closeModal('detailModalBackdrop'); }catch(e){}
  if(_retSale){ try{ showReceipt(_retSale); }catch(e){} }   // বাতিল করলে আগের রসিদে ফিরে যায়
}
function returnDeleteFromReceipt(){ if(_rcptSale) deleteSaleRecord(_rcptSale.id); }
function returnOpenForSale(saleId){
  if(!requireOwnerRole('কাস্টমারের ফেরত নেওয়া')) return;
  const sale = histFindSale(saleId); if(!sale) return;
  _retSale = sale;
  const rem = returnRemaining(sale);
  const cust = sale.customerId ? customers.find(c=>c.id===sale.customerId) : null;
  const rows = (sale.items||[]).map((it,i)=>{
    if(rem[i]<=1e-9) return `<div class="row-item"><div style="display:flex;align-items:center;gap:10px;min-width:0;">${medIconById(it.id)}<div><div class="row-title">${escapeHtml(it.name||'')}</div><div class="row-sub">বিক্রি ${it.qty} — সবটাই আগে ফেরত নেওয়া হয়েছে</div></div></div></div>`;
    return `<div class="row-item"><div style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;">${medIconById(it.id)}<div style="min-width:0;"><div class="row-title">${escapeHtml(it.name||'')}</div><div class="row-sub">বিক্রি ${it.qty} • ফেরত নেওয়া যাবে সর্বোচ্চ ${rem[i]}</div></div></div>
      <div style="width:90px;"><input type="number" id="rq_${i}" min="0" max="${rem[i]}" step="any" placeholder="0" data-max="${rem[i]}" oninput="returnCalc()"></div></div>`;
  }).join('');
  const dueDefault = !!(cust && (cust.due||0) > 0);
  document.getElementById('detailModalTitle').textContent = '↩ কাস্টমারের ফেরত';
  document.getElementById('detailModalContent').innerHTML = `
    <div class="row-sub" style="margin-bottom:8px;line-height:1.5;">যে ওষুধ যতটা ফেরত নিচ্ছেন তার পরিমাণ লিখুন। ছাড় থাকলে সেই অনুপাতে টাকা ধরা হবে।</div>
    ${rows}
    <div class="divider"></div>
    <div style="font-weight:700;margin-bottom:6px;">টাকা কীভাবে মেটাবেন?</div>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;"><input type="radio" name="rqm" value="cash" ${dueDefault?'':'checked'} style="width:20px;height:20px;"> নগদ/টাকা ফেরত দিলাম</label>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;${cust?'':'opacity:.45;'}"><input type="radio" name="rqm" value="due" ${dueDefault?'checked':''} ${cust?'':'disabled'} style="width:20px;height:20px;"> কাস্টমারের বাকি থেকে কমান${cust?' (এখন '+((cust.due||0)<0?'অগ্রিম '+fmt(-cust.due):'বাকি '+fmt(cust.due||0))+')':' (এই বিক্রয়ে কাস্টমার নেই)'}</label>
    <label style="display:flex;gap:8px;align-items:center;margin:10px 0;"><input type="checkbox" id="rqRestock" checked style="width:20px;height:20px;"> ওষুধ আবার স্টকে তুলুন <span class="row-sub">(ভাঙা/নষ্ট হলে টিক তুলুন)</span></label>
    <div id="rqTotal" style="font-weight:800;font-size:16px;margin:8px 0;">ফেরতের মোট: ৳০</div>
    <button class="btn btn-primary btn-block" onclick="returnSave()">✓ ফেরত সংরক্ষণ করুন</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="returnCancel()">বাতিল</button>`;
  openModal('detailModalBackdrop');
}
function _returnCollect(){
  const sale = _retSale; if(!sale) return null;
  const ratio = (sale.subtotal>0) ? (sale.total/sale.subtotal) : 1;
  const items = []; let total = 0, bad = '';
  (sale.items||[]).forEach((it,i)=>{
    const el = document.getElementById('rq_'+i); if(!el) return;
    const q = parseFloat(bnToEnDigits(el.value)) || 0; if(q<=0) return;
    const max = +el.dataset.max;
    if(q > max + 1e-9){ bad = (it.name||'')+' — সর্বোচ্চ '+max+' ফেরত নেওয়া যায়'; return; }
    const eff = _r2b((it.price||0) * ratio);
    items.push(Object.assign({}, it, {qty:-q, price:eff}));
    total += q*eff;
  });
  return {items, total:_r2b(total), bad};
}
function returnCalc(){
  const c = _returnCollect(); const el = document.getElementById('rqTotal'); if(!c || !el) return;
  el.textContent = 'ফেরতের মোট: '+fmt(c.total);
}
function returnSave(){
  const sale = _retSale; if(!sale) return;
  if(!requireOwnerRole('কাস্টমারের ফেরত নেওয়া')) return;
  const c = _returnCollect();
  if(c.bad){ toast(c.bad); return; }
  if(!c.items.length){ toast('অন্তত একটা ওষুধের ফেরত পরিমাণ লিখুন'); return; }
  const method = (document.querySelector('input[name="rqm"]:checked')||{}).value || 'cash';
  const restock = !!document.getElementById('rqRestock').checked;
  const cust = sale.customerId ? customers.find(x=>x.id===sale.customerId) : null;
  if(method==='due' && !cust){ toast('বাকি থেকে কমাতে কাস্টমার লাগে — নগদ ফেরত বাছুন'); return; }
  const total = -c.total;
  const rec = { id:uid(), ts:Date.now(), date:todayStr(), items:c.items, subtotal:total, discount:0, total,
    payMethod:'return', cashPaidNow: method==='cash' ? total : 0, dueAdded: method==='due' ? total : 0,
    isReturn:true, returnOf:sale.id, restock, customerId:sale.customerId||null, customerName:sale.customerName||null,
    patientName:sale.patientName||null, patientMobile:sale.patientMobile||null, doctorName:'', doctorTitle:'', doctorType:'', diagnosis:null, rxId:null };
  try{ Object.assign(rec, sellerFields()); }catch(e){}
  if(!confirm('ফেরত সংরক্ষণ করবেন?\n\nফেরতের মোট: '+fmt(c.total)+'\n'+(method==='cash' ? 'নগদ ফেরত দিচ্ছেন' : 'কাস্টমারের বাকি থেকে কমবে')+'\n'+(restock?'ওষুধ স্টকে ফিরবে':'স্টক বদলাবে না'))) return;
  // আগে ফোনে সাথে সাথে — ইন্টারনেট না থাকলেও হিসাব ঠিক থাকে
  if(restock) c.items.forEach(it=>{ const med = medicines.find(m=>m.id===it.id); if(med) med.stock += Math.abs(it.qty); });
  if(restock) save(DB_KEYS.med, medicines);
  rec.serial = rcptNextNo();   // ফেরত রশিদও একই ক্রমে নম্বর পায়
  sales.push(rec); save(DB_KEYS.sale, sales);
  if(method==='due' && cust){ cust.due = (cust.due||0) + total; save(DB_KEYS.customer, customers); }
  if(cloudReady()){
    if(restock) c.items.forEach(it=>{ shopColl('medicines').doc(it.id).update({stock: firebase.firestore.FieldValue.increment(Math.abs(it.qty))}).catch(e=>{ console.error(e); toast('⚠️ ক্লাউডে স্টক আপডেট ব্যর্থ হয়েছে'); }); });
    if(method==='due' && cust) shopColl('customers').doc(cust.id).update({due: firebase.firestore.FieldValue.increment(total)}).catch(e=>{ console.error(e); toast('⚠️ ক্লাউডে বাকি আপডেট ব্যর্থ হয়েছে'); });
    shopColl('sales').doc(rec.id).set(rec).catch(e=>{ console.error(e); toast('⚠️ ক্লাউডে ফেরত সংরক্ষণ ব্যর্থ হয়েছে — আপাতত শুধু এই ফোনে আছে'); });
  }
  try{ closeModal('detailModalBackdrop'); }catch(e){}
  try{ renderDashboard(); }catch(e){}
  toast('✓ ফেরত সংরক্ষিত হয়েছে');
  try{ showReceipt(rec); }catch(e){ console.error(e); }
}
// ---------- কোম্পানিকে ফেরত ----------
function returnOpenPurchaseReturn(){
  if(!requireOwnerRole('কোম্পানিকে ফেরত দেওয়া')) return;
  _rpMedId = null;
  const supOpts = '<option value="">— নির্দিষ্ট নয় —</option>' + [...suppliers].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(s=>`<option value="${s.id}">${escapeHtml(s.name||'')}</option>`).join('');
  document.getElementById('detailModalTitle').textContent = '↩ কোম্পানিকে ফেরত';
  document.getElementById('detailModalContent').innerHTML = `
    <label>সাপ্লায়ার/কোম্পানি</label><select id="rpSup">${supOpts}</select>
    <label style="margin-top:8px;">ওষুধ (নাম লিখে খুঁজুন)</label>
    <input type="text" id="rpSearch" placeholder="ওষুধের নাম..." autocomplete="off" oninput="returnPurSearch()">
    <div id="rpResults"></div>
    <div id="rpChosen" class="row-sub" style="margin:6px 0;font-weight:700;"></div>
    <div class="grid2">
      <div><label>ফেরতের পরিমাণ</label><input type="number" id="rpQty" min="0" step="any" value="1" oninput="returnPurCalc()"></div>
      <div><label>দর (৳ প্রতি একক)</label><input type="number" id="rpPrice" min="0" step="any" oninput="returnPurCalc()"></div>
    </div>
    <label style="margin-top:8px;">কারণ</label>
    <select id="rpReason"><option>মেয়াদোত্তীর্ণ / মেয়াদ কাছাকাছি</option><option>ভাঙা বা নষ্ট</option><option>ভুল মাল এসেছিল</option><option>অন্য কারণ</option></select>
    <div style="font-weight:700;margin:10px 0 6px;">টাকা কীভাবে মেটবে?</div>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;"><input type="radio" name="rpm" value="due" checked style="width:20px;height:20px;"> সাপ্লায়ারের দেনা (বাকি) থেকে কমাও</label>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;"><input type="radio" name="rpm" value="cash" style="width:20px;height:20px;"> নগদ টাকা ফেরত পেয়েছি</label>
    <div id="rpTotal" style="font-weight:800;font-size:16px;margin:8px 0;">ফেরতের মোট: ৳০</div>
    <button class="btn btn-primary btn-block" onclick="returnPurSave()">✓ ফেরত সংরক্ষণ করুন</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="closeModal('detailModalBackdrop')">বাতিল</button>`;
  openModal('detailModalBackdrop');
}
function returnPurSearch(){
  const q = (document.getElementById('rpSearch').value||'').trim();
  const box = document.getElementById('rpResults');
  if(!q){ box.innerHTML = ''; return; }
  const list = medicines.filter(m=>medNameIncludes(m.name||'', q)).slice(0,8);
  box.innerHTML = list.length ? list.map(m=>`<div class="row-item" style="cursor:pointer;" onclick="returnPurPick('${m.id}')"><div><div class="row-title">${medTypeTagFor(m.id)}${escapeHtml(m.name||'')}</div><div class="row-sub">স্টক ${m.stock||0}${m.company?' • '+escapeHtml(m.company):''}</div></div></div>`).join('') : '<div class="row-sub">কোনো ওষুধ মেলেনি</div>';
}
function returnPurPick(id){
  const m = medicines.find(x=>x.id===id); if(!m) return;
  _rpMedId = id;
  document.getElementById('rpResults').innerHTML = '';
  document.getElementById('rpSearch').value = '';
  document.getElementById('rpChosen').textContent = '✓ '+(m.name||'')+' — স্টকে আছে '+(m.stock||0);
  document.getElementById('rpPrice').value = m.buy || '';
  try{
    if(m.company && !document.getElementById('rpSup').value){
      const k = companyKey(m.company); const s = suppliers.find(x=>companyKey(x.name)===k);
      if(s) document.getElementById('rpSup').value = s.id;
    }
  }catch(e){}
  returnPurCalc();
}
function returnPurCalc(){
  const q = parseFloat(document.getElementById('rpQty').value)||0, p = parseFloat(document.getElementById('rpPrice').value)||0;
  document.getElementById('rpTotal').textContent = 'ফেরতের মোট: '+fmt(_r2b(q*p));
}
function returnPurSave(){
  if(!requireOwnerRole('কোম্পানিকে ফেরত দেওয়া')) return;
  const med = medicines.find(m=>m.id===_rpMedId);
  if(!med){ toast('আগে একটা ওষুধ বেছে নিন'); return; }
  const q = parseFloat(document.getElementById('rpQty').value)||0;
  const price = parseFloat(document.getElementById('rpPrice').value)||0;
  if(q<=0){ toast('সঠিক পরিমাণ দিন'); return; }
  if(price<=0){ toast('দর (ক্রয়মূল্য) লিখুন — ওটা ছাড়া দেনা কমানোর হিসাব হয় না'); return; }
  const supId = document.getElementById('rpSup').value;
  const sup = suppliers.find(s=>s.id===supId);
  const method = (document.querySelector('input[name="rpm"]:checked')||{}).value || 'due';
  if(method==='due' && !sup){ toast('দেনা থেকে কমাতে সাপ্লায়ার বাছুন, অথবা "নগদ টাকা ফেরত পেয়েছি" বাছুন'); return; }
  if(q > (med.stock||0) && !confirm('স্টকে আছে '+(med.stock||0)+', আপনি '+q+' ফেরত দিচ্ছেন — স্টক ঋণাত্মক হয়ে যাবে। তবু সংরক্ষণ করবেন?')) return;
  const total = _r2b(q*price);
  if(!confirm('কোম্পানিকে ফেরত সংরক্ষণ করবেন?\n\n'+(med.name||'')+' × '+q+' = '+fmt(total)+'\n'+(method==='due' ? 'সাপ্লায়ারের দেনা থেকে কমবে' : 'নগদ টাকা ফেরত পাওয়া হিসেবে ধরা হবে')+'\nস্টক '+q+' কমবে')) return;
  const rec = { id:uid(), ts:Date.now(), date:todayStr(), medicineId:med.id, medicineName:med.name, qty:-q, price, batch:'', expiry:'',
    supplierId: sup?sup.id:null, supplierName: sup?sup.name:(med.company||null), credit: method==='due', isReturn:true, reason: document.getElementById('rpReason').value };
  med.stock = (med.stock||0) - q;
  save(DB_KEYS.med, medicines);
  purchases.push(rec); save(DB_KEYS.purchase, purchases);
  if(cloudReady()){
    shopColl('medicines').doc(med.id).set({stock: firebase.firestore.FieldValue.increment(-q)}, {merge:true}).catch(e=>{ console.error(e); toast('⚠️ ক্লাউডে স্টক আপডেট ব্যর্থ হয়েছে'); });
    shopColl('purchases').doc(rec.id).set(rec).catch(e=>{ console.error(e); toast('⚠️ ক্লাউডে ফেরত সংরক্ষণ ব্যর্থ হয়েছে — আপাতত শুধু এই ফোনে আছে'); });
  }
  try{ closeModal('detailModalBackdrop'); }catch(e){}
  try{ renderPurchases(); renderDashboard(); }catch(e){}
  toast('✓ কোম্পানিকে ফেরত সংরক্ষিত হয়েছে');
}
function returnPurchaseView(id){
  const p = purchases.find(x=>x.id===id); if(!p) return;
  document.getElementById('detailModalTitle').textContent = '↩ কোম্পানিকে ফেরত';
  document.getElementById('detailModalContent').innerHTML = `
    <div class="row-item"><div><div class="row-title">${medTypeTagFor(p.medicineId)}${escapeHtml(p.medicineName||'')}</div>
      <div class="row-sub">${escapeHtml(p.date||'')} • ${escapeHtml(p.supplierName||'সাপ্লায়ার নির্দিষ্ট নয়')}</div>
      <div class="row-sub">কারণ: ${escapeHtml(p.reason||'—')}</div></div>
      <div class="row-right"><div class="row-title">${fmt(Math.abs(p.qty*p.price))}</div><div class="row-sub">${Math.abs(p.qty)} × ${fmt(p.price)}</div></div></div>
    <div class="row-sub" style="margin:8px 0;">${p.credit ? 'সাপ্লায়ারের দেনা থেকে কমানো হয়েছে' : 'নগদ টাকা ফেরত পাওয়া হিসেবে ধরা হয়েছে'}</div>
    ${currentRole()==='owner' ? `<button class="btn btn-sm" style="color:var(--danger,#c0392b);background:none;border:1px solid var(--danger,#c0392b);border-radius:6px;padding:6px 10px;" onclick="returnPurchaseDelete('${p.id}')">🗑 ভুল ফেরত মুছুন (স্টক ও দেনা আগের অবস্থায় ফিরবে)</button>` : ''}
    <button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="closeModal('detailModalBackdrop')">বন্ধ করুন</button>`;
  openModal('detailModalBackdrop');
}
function returnPurchaseDelete(id){
  if(!requireOwnerRole('ফেরত মুছে ফেলা')) return;
  const p = purchases.find(x=>x.id===id); if(!p || !p.isReturn) return;
  if(!confirm('এই ফেরতটা মুছবেন?\n\nস্টক '+Math.abs(p.qty)+' বাড়বে এবং সাপ্লায়ারের হিসাব আগের অবস্থায় ফিরবে। শুধু ভুল ফেরত ঠিক করার জন্য।')) return;
  const med = medicines.find(m=>m.id===p.medicineId);
  if(med) med.stock = (med.stock||0) + Math.abs(p.qty);
  addTombstoneLogged(id);
  purchases = purchases.filter(x=>x.id!==id);
  save(DB_KEYS.med, medicines); save(DB_KEYS.purchase, purchases);
  if(cloudReady()){
    if(med) shopColl('medicines').doc(med.id).set({stock: firebase.firestore.FieldValue.increment(Math.abs(p.qty))}, {merge:true}).catch(e=>console.error(e));
    shopColl('purchases').doc(id).delete().catch(e=>console.error(e));
  }
  try{ closeModal('detailModalBackdrop'); renderPurchases(); renderDashboard(); }catch(e){}
  toast('✓ ফেরত মুছে ফেলা হয়েছে');
}
