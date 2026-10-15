/* ===== ইতিহাস সীমা (v32) =====
   লক্ষ্য: অ্যাপ খোলার সময় ক্লাউড থেকে শুধু শেষ ৬ মাসের বিক্রি-ক্রয় পড়া (ফায়ারবেসের পড়া বাঁচাতে)।
   ১) মালিক সেটিংসে "চালু করুন" চাপলে একটা নির্দিষ্ট তারিখ D ঠিক হয় (আজ থেকে ৬ মাস আগে)। D ক্লাউডে দোকানের মূল ডকুমেন্টে লেখা থাকে, সব ফোন সেটা মানে।
   ২) D-এর আগের হিসাব হারায় না: চালুর মুহূর্তে সার্ভারের পুরো ইতিহাস থেকে প্রতিটা কাস্টমারের বাকি/মোট কেনাকাটা/কার-নামে-ভাগ আর প্রতিটা সাপ্লায়ারের বাকি
      "আগের জের" (histBase) হিসেবে জমা রাখা হয়। এরপর হিসাব = জের + D-এর পরের লেনদেন।
   ৩) পুরনো রিপোর্ট দেখতে চাইলে রিপোর্টে বোতাম চাপলে ওই সময়ের বিক্রি-ক্রয় ক্লাউড থেকে আনা হয় (শুধু মেমোরিতে; ফোনে জমা হয় না, অ্যাপ বন্ধ করলে চলে যায়)।
   ৪) বন্ধ করলে আগের মতো সব ইতিহাস পড়া হয়। ফোনে আগে থেকে থাকা পুরনো রেকর্ড কখনো মোছা হয় না। */
const HIST_MAX_BASE_BYTES = 700000;
let _hxSales = [], _hxPurchases = [], _hxFrom = null;   // পুরনো-ডাটা (শুধু মেমোরিতে); _hxFrom: কোন তারিখ (ms) থেকে আনা আছে, 0 = সব
let _hbRaw = null, _hbObj = {};
function histFrom(){ try{ const v = +localStorage.getItem('ssn_hist_from'); return v>0 ? v : 0; }catch(e){ return 0; } }
function histOn(){ return histFrom()>0; }
function histBase(){
  try{
    const raw = localStorage.getItem('ssn_hist_base') || '';
    if(raw!==_hbRaw){ _hbRaw = raw; _hbObj = raw ? (JSON.parse(raw)||{}) : {}; }
  }catch(e){ _hbObj = {}; }
  return _hbObj;
}
function histBaseCust(id){ const b = histBase(); return (b.cust && +b.cust[id]) || 0; }
function histBaseTotal(id){ const b = histBase(); return (b.ct && +b.ct[id]) || 0; }
function histBaseSup(id){ const b = histBase(); return (b.sup && +b.sup[id]) || 0; }
function histBaseNames(cid){ const b = histBase(); return (b.names && b.names[cid]) || []; }
function histDateStr(){ return histOn() ? new Date(histFrom()).toISOString().slice(0,10) : ''; }
function histBn(s){ return String(s).replace(/\d/g, d=>'০১২৩৪৫৬৭৮৯'[d]); }
function histResetCaches(){ try{ _ctpCache = null; _pIdxCache = null; _dataVersion++; }catch(e){} }
// ক্লাউড থেকে আসা মূল ডকুমেন্ট দেখে এই ফোনের সীমা মেলানো (সব ফোন, কর্মচারীরটাও)
function histSyncFromShopDoc(x){
  if(!x) return;
  const cf = +x.histFrom || 0, lf = histFrom();
  if(cf>0){
    try{ localStorage.setItem('ssn_hist_from', String(cf)); localStorage.setItem('ssn_hist_base', JSON.stringify(x.histBase||{})); }catch(e){}
    if(cf!==lf){ try{ deltaForceFull(); }catch(e){} }
  } else if(lf>0){
    try{ localStorage.removeItem('ssn_hist_from'); localStorage.removeItem('ssn_hist_base'); }catch(e){}
    try{ deltaForceFull(); }catch(e){}
  }
  histResetCaches();
}
// ---------- রিপোর্টে ব্যবহারের জন্য: ফোনের তালিকা + ক্লাউড থেকে আনা পুরনো ডাটা ----------
function repSales(){
  if(!_hxSales.length) return sales;
  const ids = new Set(sales.map(s=>s.id));
  return sales.concat(_hxSales.filter(s=>!ids.has(s.id)));
}
function repPurchases(){
  if(!_hxPurchases.length) return purchases;
  const ids = new Set(purchases.map(s=>s.id));
  return purchases.concat(_hxPurchases.filter(s=>!ids.has(s.id)));
}
function histFindSale(id){ return sales.find(s=>s.id===id) || _hxSales.find(s=>s.id===id); }
function histReportFromDate(range){
  const now = new Date(), iso = d=>d.toISOString().slice(0,10);
  const back = n=>{ const d = new Date(now); d.setDate(now.getDate()-n); return iso(d); };
  if(range==='today') return todayStr();
  if(range==='week') return back(7);
  if(range==='month') return iso(now).slice(0,8)+'01';
  if(range==='3month') return back(90);
  if(range==='6month') return back(180);
  if(range==='custom') return document.getElementById('reportCustomFrom')?.value || '';
  return '';   // সর্বমোট
}
function histNeedsFetch(fromStr){
  if(!histOn()) return false;
  if(fromStr && fromStr >= histDateStr()) return false;
  if(_hxFrom===null) return true;
  if(_hxFrom===0) return false;
  return !fromStr || Date.parse(fromStr+'T00:00:00Z') < _hxFrom;
}
function histBarHtml(fromStr){
  if(!histNeedsFetch(fromStr)) return '';
  return `<div style="background:#fff4d6;border:1px solid #e6c36a;border-radius:10px;padding:10px;margin:8px 0;font-size:13px;line-height:1.5;">📅 ফোনে শুধু <b>${histBn(histDateStr())}</b> থেকে পরের বিক্রি-ক্রয় আছে, তাই এই সময়ের হিসাব অসম্পূর্ণ দেখাবে।<br><button class="btn btn-sm btn-gold" style="margin-top:6px;" onclick="histFetchOld('${fromStr||''}')">☁ পুরনো ডাটা ক্লাউড থেকে আনুন (ইন্টারনেট লাগবে)</button></div>`;
}
function histPlaceBar(anchorId, barId, html, up){
  try{
    let a = document.getElementById(anchorId); for(let i=0;a && i<(up||0);i++) a = a.parentNode; if(!a || !a.parentNode) return;
    let el = document.getElementById(barId);
    if(!el){ el = document.createElement('div'); el.id = barId; a.parentNode.insertBefore(el, a.nextSibling); }
    el.innerHTML = html;
  }catch(e){}
}
async function histFetchOld(fromStr){
  if(!histOn()) return;
  if(!cloudReady() || !navigator.onLine){ toast('পুরনো ডাটা আনতে ইন্টারনেট ও ক্লাউড সংযোগ লাগবে'); return; }
  const hf = histFrom();
  const fromTs = fromStr ? Date.parse(fromStr+'T00:00:00Z') : 0;
  if(!confirm((fromStr ? histBn(fromStr)+' থেকে ' : 'শুরু থেকে ')+histBn(histDateStr())+'-এর আগ পর্যন্ত বিক্রি-ক্রয় ক্লাউড থেকে আনবেন?\n\nযত রেকর্ড, তত Firebase "পড়া" খরচ হবে (সময় বেশি ধরলে অনেক)। ডাটা শুধু এখন দেখার জন্য আসবে, ফোনে জমা হবে না।')) return;
  toast('ক্লাউড থেকে আনা হচ্ছে…');
  try{
    const mk = n=>{ let q = shopColl(n).where('ts','<',hf); if(fromTs) q = q.where('ts','>=',fromTs); return q.get({source:'server'}); };
    const [s,p] = await Promise.all([mk('sales'), mk('purchases')]);
    try{ deltaCountReads(s.size+p.size); }catch(e){}
    const sIds = new Set(_hxSales.map(x=>x.id)), pIds = new Set(_hxPurchases.map(x=>x.id));
    s.docs.forEach(d=>{ if(!sIds.has(d.id)) _hxSales.push(deltaRec(d)); });
    p.docs.forEach(d=>{ if(!pIds.has(d.id)) _hxPurchases.push(deltaRec(d)); });
    _hxFrom = (_hxFrom===null) ? fromTs : (_hxFrom===0||fromTs===0 ? 0 : Math.min(_hxFrom, fromTs));
    toast('✓ '+s.size+'টা বিক্রি ও '+p.size+'টা ক্রয় আনা হয়েছে');
    try{ rerenderCurrentSection(); }catch(e){}
    try{ renderReports(); }catch(e){}
    try{ renderAntibioticRegister(); }catch(e){}
  }catch(e){ console.error(e); toast('আনা যায়নি: '+(e&&e.message?e.message:e)); }
}
// ---------- আগের জের হিসাব (সার্ভারের পুরো ইতিহাস থেকে) ----------
function _r2(n){ return Math.round((+n||0)*100)/100; }
function histComputeBase(D, salesAll, purchAll, paysAll, custList){
  const base = {cust:{}, ct:{}, sup:{}, names:{}};
  const own = {}; custList.forEach(c=>{ own[c.id] = (c.name||'').trim().toLowerCase(); });
  const pre = {}, post = {}, unsafe = {}, nm = {};
  const slot = (cid, n)=>{
    n = (n||'').trim(); const k = n.toLowerCase();
    if(!n || k===own[cid]) return null;
    const m = (nm[cid] = nm[cid] || {}); return (m[k] = m[k] || {name:n, taken:0, paid:0});
  };
  salesAll.forEach(s=>{
    const id = s.customerId; if(!id) return;
    if((s.ts||0) < D){
      pre[id] = (pre[id]||0) + (s.dueAdded||0);
      base.ct[id] = (base.ct[id]||0) + (s.total||0);
      if(s.dueAdded==null && s.payMethod==='due') unsafe[id] = 1;
      const e = slot(id, s.patientName); if(e) e.taken += (s.dueAdded||0);
    } else post[id] = (post[id]||0) + (s.dueAdded||0);
  });
  const supPre = {};
  paysAll.forEach(p=>{
    const t = p.ts||0;
    if(p.customerId){
      let d = 0; if(p.type==='due_adjustment') d = (p.amount||0); else if(!p.type) d = -(p.amount||0); else return;
      if(t < D){
        pre[p.customerId] = (pre[p.customerId]||0) + d;
        if(p.forName){ const e = slot(p.customerId, p.forName); if(e){ if(p.type==='due_adjustment') e.taken += p.amount; else e.paid += p.amount; } }
      } else post[p.customerId] = (post[p.customerId]||0) + d;
    } else if(p.supplierId && t < D){
      if(p.type==='supplier_due_adjustment') supPre[p.supplierId] = (supPre[p.supplierId]||0) + (p.amount||0);
      else if(p.type==='supplier_payment') supPre[p.supplierId] = (supPre[p.supplierId]||0) - (p.amount||0);
    }
  });
  purchAll.forEach(p=>{ if(p.supplierId && p.credit && (p.ts||0) < D) supPre[p.supplierId] = (supPre[p.supplierId]||0) + (p.qty||0)*(p.price||0); });
  Object.keys(pre).forEach(id=>{
    let v = pre[id];
    if(unsafe[id]){ const c = custList.find(x=>x.id===id); if(c) v = (c.due||0) - (post[id]||0); }
    v = _r2(v); if(Math.abs(v)>=0.005) base.cust[id] = v;
  });
  Object.keys(base.ct).forEach(id=>{ base.ct[id] = _r2(base.ct[id]); if(!base.ct[id]) delete base.ct[id]; });
  Object.keys(supPre).forEach(id=>{ const v = _r2(supPre[id]); if(Math.abs(v)>=0.005) base.sup[id] = v; });
  Object.keys(nm).forEach(cid=>{
    const arr = Object.values(nm[cid]).filter(e=>Math.abs(e.taken)>=0.005 || Math.abs(e.paid)>=0.005).map(e=>[e.name, _r2(e.taken), _r2(e.paid)]);
    if(arr.length) base.names[cid] = arr;
  });
  return base;
}
function histWindowDate(months){
  const d = new Date(); d.setUTCMonth(d.getUTCMonth()-months);
  const ds = d.toISOString().slice(0,10);
  return {ds, ms: Date.parse(ds+'T00:00:00Z')};
}
async function histSetWindow(months){
  months = months || 6;
  if(typeof requireOwnerRole==='function' && !requireOwnerRole('ইতিহাস সীমা ঠিক করা')) return;
  const shop = localStorage.getItem('ssn_shop_code');
  if(!cloudReady() || !navigator.onLine || !shop){ toast('এটা করতে ইন্টারনেট ও ক্লাউড সংযোগ লাগবে'); return; }
  const w = histWindowDate(months);
  if(!confirm('ফোনে শুধু '+histBn(w.ds)+' থেকে পরের (শেষ '+histBn(months)+' মাসের) বিক্রি-ক্রয় পড়া হবে — সব ফোনে।\n\nআগের কাস্টমার-বাকি, সাপ্লায়ার-বাকি, মোট কেনাকাটা "আগের জের" হিসেবে হিসাব করে জমা রাখা হবে, তাই কোনো বাকি বদলাবে না।\nপুরনো রিপোর্ট দেখতে রিপোর্টে বোতাম চাপলে ক্লাউড থেকে আসবে।\n\nএখন একবার সার্ভার থেকে পুরো বিক্রি-ক্রয়-জমা-খরচ পড়া হবে (এককালীন খরচ)। আগে ব্যাকআপ নিয়ে রেখেছেন তো? এগোবেন?')) return;
  toast('সার্ভার থেকে হিসাব আনা হচ্ছে… একটু অপেক্ষা করুন');
  try{
    const g = n=>shopColl(n).get({source:'server'});
    const [s,p,py] = await Promise.all([g('sales'), g('purchases'), g('payments')]);
    try{ deltaCountReads(s.size+p.size+py.size); }catch(e){}
    const base = histComputeBase(w.ms, s.docs.map(deltaRec), p.docs.map(deltaRec), py.docs.map(deltaRec), customers);
    if(JSON.stringify(base).length > HIST_MAX_BASE_BYTES){ alert('আগের জেরের হিসাব অনেক বড় হয়ে গেছে — কিছুই বদলানো হয়নি। আমাকে জানান।'); return; }
    await cloudDb.collection('pharmacies').doc(shop).set({histFrom:w.ms, histBase:base, histAt:Date.now()}, {mergeFields:['histFrom','histBase','histAt']});
    localStorage.setItem('ssn_hist_from', String(w.ms)); localStorage.setItem('ssn_hist_base', JSON.stringify(base));
    _hxSales = []; _hxPurchases = []; _hxFrom = null;
    histResetCaches();
    try{ deltaForceFull(); }catch(e){}
    toast('✓ ইতিহাস সীমা চালু হয়েছে ('+histBn(w.ds)+' থেকে)');
    try{ attachRealtimeListeners(); }catch(e){ console.error(e); }
    try{ reconcileAllDues(); renderDashboard(); rerenderCurrentSection(); }catch(e){}
    histUpdateUi();
  }catch(e){ console.error(e); toast('করা যায়নি, কিছুই বদলায়নি: '+(e&&e.message?e.message:e)); }
}
async function histTurnOff(){
  if(typeof requireOwnerRole==='function' && !requireOwnerRole('ইতিহাস সীমা বন্ধ করা')) return;
  const shop = localStorage.getItem('ssn_shop_code');
  if(!histOn()){ toast('সীমা আগে থেকেই বন্ধ'); return; }
  if(!cloudReady() || !navigator.onLine || !shop){ toast('এটা করতে ইন্টারনেট ও ক্লাউড সংযোগ লাগবে'); return; }
  if(!confirm('ইতিহাস সীমা বন্ধ করবেন?\n\nসব ফোন আবার পুরো বিক্রি-ক্রয় ইতিহাস পড়বে (Firebase পড়া বেশি লাগবে)।')) return;
  try{
    await cloudDb.collection('pharmacies').doc(shop).set({histFrom:firebase.firestore.FieldValue.delete(), histBase:firebase.firestore.FieldValue.delete(), histAt:Date.now()}, {merge:true});
    localStorage.removeItem('ssn_hist_from'); localStorage.removeItem('ssn_hist_base');
    _hxSales = []; _hxPurchases = []; _hxFrom = null;
    histResetCaches();
    try{ deltaForceFull(); }catch(e){}
    toast('ইতিহাস সীমা বন্ধ — সব ইতিহাস আবার পড়া হবে');
    try{ attachRealtimeListeners(); }catch(e){ console.error(e); }
    try{ reconcileAllDues(); renderDashboard(); rerenderCurrentSection(); }catch(e){}
    histUpdateUi();
  }catch(e){ console.error(e); toast('করা যায়নি: '+(e&&e.message?e.message:e)); }
}
function histUpdateUi(){
  const el = document.getElementById('histWinInfo'); if(!el) return;
  el.textContent = histOn()
    ? '✅ চালু — ফোনে '+histBn(histDateStr())+' থেকে পরের বিক্রি-ক্রয় পড়া হয়। এর আগের হিসাব "আগের জের" হিসেবে জমা আছে। সময় গড়ালে সীমা এগিয়ে আনতে আবার "চালু করুন" চাপুন।'
    : 'বন্ধ — অ্যাপ খুললে সব বিক্রি-ক্রয় ইতিহাস পড়া হয়।';
}
try{ setTimeout(histUpdateUi, 1600); }catch(e){}
