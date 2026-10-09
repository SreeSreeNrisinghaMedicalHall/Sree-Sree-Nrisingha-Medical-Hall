
/* ---------------- Data layer (localStorage) ---------------- */
const DB_KEYS = { med:'ssn_medicines', sale:'ssn_sales', purchase:'ssn_purchases', customer:'ssn_customers', supplier:'ssn_suppliers', payment:'ssn_payments', labTest:'ssn_lab_tests', prescription:'ssn_prescriptions', referrer:'ssn_referrers', testPrice:'ssn_test_prices' };
function load(key){ try{ return JSON.parse(localStorage.getItem(key)) || []; }catch(e){ return []; } }
// Tombstones: ids the user has INTENTIONALLY deleted (deleteMedicine, deleteCustomer, etc. all
// call addTombstone() right alongside their own save()). save()'s stale-overwrite recovery below
// checks this list before reviving a record that's missing from what's about to be written —
// that's the difference between "the pharmacist deleted this on purpose, leave it deleted" and
// "this is missing because of a stale tab/incomplete sync, bring it back." Kept 30 days, plenty
// of time for any stale tab or offline device to reconnect and catch up, then auto-trimmed.
function getTombstones(){ try{ return JSON.parse(localStorage.getItem('ssn_deleted_ids'))||[]; }catch(e){ return []; } }
function addTombstone(id){
  const list = getTombstones();
  list.push({id, ts:Date.now()});
  const cutoff = Date.now() - 30*24*60*60*1000;
  localStorage.setItem('ssn_deleted_ids', JSON.stringify(list.filter(t=>t.ts>cutoff)));
}
// Every save() used to just blindly overwrite localStorage with whatever array is currently
// in memory. On a phone that's dangerous: opening the app fresh in a new tab (from the home
// screen icon, a notification, "recent apps") while an OLDER tab of the same app is still
// alive in the background is very easy to do by accident, and each tab holds its OWN
// in-memory copy loaded at ITS OWN start time. If the background tab still has an open sale
// screen and later completes a sale (or ANY save happens from it — even something unrelated,
// like editing a medicine's stock), it writes based on ITS stale snapshot — silently erasing
// any sale/payment/customer/etc. added by the other, newer tab in between. This is almost
// certainly what happened to the missing "Shah Alam Akon" sale.
// Fix: before writing an array of {id,...} records, re-read what's CURRENTLY in localStorage
// and add back any record that's there but missing from what we're about to write (mutating
// the array in place, so the caller's live sales/medicines/etc. variable also recovers it
// immediately, not just localStorage) — UNLESS that record's id is in the tombstone list above,
// meaning it's missing because the pharmacist deleted it on purpose, not because of a stale
// write. (An earlier version of this fix checked only "is it missing", with no tombstone check —
// that silently undid every delete in the app: deleteMedicine/deletePurchase/deleteCustomer/
// deleteLabTestFromModal/deletePrescriptionFromModal/deleteSelectedMedicines would filter a
// record out and save(), and this exact recovery logic would immediately push it right back in,
// both in localStorage and in the live in-memory array, before the screen even re-rendered.
// Confirmed with a standalone Node test reproducing that exact sequence before fixing it.)
//
// CRITICAL fix found right after the above: the actual localStorage.setItem() write below had
// NO error handling at all. A phone's per-site storage quota is limited (varies by
// browser/device, sometimes just a few MB on older Android WebViews) — with 497+ medicines and
// a growing sales/purchase history, this app can realistically get close to that limit over
// time. If setItem() ever throws (quota exceeded), that exception was propagating straight up,
// UNCAUGHT, through completeSale()/saveCustomer()/etc. — silently aborting the function right
// there. Nothing after it would run: not the toast, not the cloud push, nothing. The record
// would never reach localStorage OR the live in-memory array would look fine for the rest of
// THIS session but never actually persist, so on next reopen it's back to whatever was last
// successfully saved — matching a user report of a sale/customer being 100% gone with no trace,
// no error, nothing. This is a strong, independent explanation for that report that doesn't
// depend on the multi-tab/sync mechanisms above. Fixed by wrapping the write in try/catch: on
// failure, first sacrifice the safety-net snapshots below (they exist to protect the real data,
// so they should never be the reason real data can't be saved) to free space and retry once,
// and if it STILL fails, show a blocking (not auto-dismissing) alert so the pharmacist knows
// immediately that this specific entry did NOT save, instead of finding out days later.
// recordId -> ms timestamp of the last time THIS device (not an incoming cloud snapshot) saved
// that record — lets save() protect a just-made local edit from being silently reverted by a
// cloud snapshot that hasn't caught up yet (see save()'s fromCloud handling below).
const _recentLocalWriteAt = {};
const LOCAL_WRITE_GRACE_MS = 45000; // long enough to outlast a slow/flaky round-trip to Firestore (widened from 12s after this window still proved too short on a weak connection and wiped a just-saved মোবাইল নম্বর), short enough that a genuine edit from another device still lands within a minute

/* ================= HISTORY MODULE: audit log + recycle bin + long-term restore points =================
   Stored in IndexedDB (separate from localStorage, so it never eats the 5MB quota and is never
   touched by cloud sync or save()). Nothing here is ever auto-deleted except old restore points,
   which are thinned (never dropped): every 30 min for 48h, one per day for 60 days, one per week forever. */
const HistDB = (function(){
  let dbp = null;
  function open(){
    if(dbp) return dbp;
    dbp = new Promise((res,rej)=>{
      if(!window.indexedDB){ rej(new Error('no indexedDB')); return; }
      const r = indexedDB.open('ssn_history', 1);
      r.onupgradeneeded = ()=>{
        const d = r.result;
        d.createObjectStore('snapshots', {keyPath:'ts'});
        d.createObjectStore('snapmeta', {keyPath:'ts'});
        d.createObjectStore('audit', {keyPath:'id', autoIncrement:true});
        d.createObjectStore('trash', {keyPath:'tid', autoIncrement:true});
      };
      r.onsuccess = ()=>res(r.result);
      r.onerror = ()=>rej(r.error);
    });
    return dbp;
  }
  async function run(stores, mode, fn){
    const d = await open();
    return new Promise((res,rej)=>{
      const t = d.transaction(stores, mode);
      let out;
      try{ out = fn(t); }catch(e){ rej(e); return; }
      t.oncomplete = ()=>res(out && out.result!==undefined ? out.result : out);
      t.onerror = ()=>rej(t.error); t.onabort = ()=>rej(t.error);
    });
  }
  return {
    add:(s,v)=>run(s,'readwrite',t=>t.objectStore(s).add(v)),
    put:(s,v)=>run(s,'readwrite',t=>t.objectStore(s).put(v)),
    del:(s,k)=>run(s,'readwrite',t=>t.objectStore(s).delete(k)),
    get:(s,k)=>run(s,'readonly',t=>t.objectStore(s).get(k)),
    getAll:(s)=>run(s,'readonly',t=>t.objectStore(s).getAll()),
    keys:(s)=>run(s,'readonly',t=>t.objectStore(s).getAllKeys()),
    run
  };
})();
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}

function _deviceId(){
  let d = localStorage.getItem('ssn_device_id');
  if(!d){ d = 'D'+Math.random().toString(36).slice(2,7).toUpperCase(); try{ localStorage.setItem('ssn_device_id', d); }catch(e){} }
  return d;
}
const AUDIT_LABELS = {};
AUDIT_LABELS[DB_KEYS.customer]='কাস্টমার'; AUDIT_LABELS[DB_KEYS.med]='ওষুধ'; AUDIT_LABELS[DB_KEYS.supplier]='সাপ্লায়ার';
AUDIT_LABELS[DB_KEYS.sale]='বিক্রয়'; AUDIT_LABELS[DB_KEYS.purchase]='ক্রয়'; AUDIT_LABELS[DB_KEYS.payment]='পেমেন্ট';
AUDIT_LABELS[DB_KEYS.labTest]='টেস্ট রিপোর্ট'; AUDIT_LABELS[DB_KEYS.prescription]='প্রেসক্রিপশন'; AUDIT_LABELS[DB_KEYS.referrer]='রেফারার'; AUDIT_LABELS[DB_KEYS.testPrice]='টেস্ট মূল্য';
const AUDIT_FIELDS = {};
AUDIT_FIELDS[DB_KEYS.customer] = ['name','mobile','guardian','address'];
AUDIT_FIELDS[DB_KEYS.med] = ['name'];
AUDIT_FIELDS[DB_KEYS.supplier] = ['name','mobile','contactsText'];
const AUDIT_BULK_KEYS = [DB_KEYS.sale, DB_KEYS.purchase, DB_KEYS.payment];
function _callerNames(){
  try{
    const names = [];
    (new Error().stack||'').split('\n').forEach(l=>{
      const m = l.match(/^\s*(?:at\s+)?(?:async\s+)?([A-Za-z_$][\w$.]*)[@ (]/);
      if(m && !['_callerNames','auditDiff','save','Object.save','Error','at','async','new'].includes(m[1]) && names.length<3) names.push(m[1]);
    });
    return names.join(' ← ');
  }catch(e){ return ''; }
}
function _recName(r){ return (r && (r.name||r.customerName||r.medicineName||r.patientName)) || ''; }
// Called from save() with the PREVIOUS localStorage contents and what is about to be written.
// Logs every rename/contact change and every removal (removed records go to the recycle bin).
function auditDiff(key, prev, next, fromCloud){
  if(!Array.isArray(prev) || !Array.isArray(next) || !AUDIT_LABELS[key]) return;
  const label = AUDIT_LABELS[key];
  const pm = new Map(); prev.forEach(r=>{ if(r && r.id) pm.set(r.id, r); });
  const nm = new Map(); next.forEach(r=>{ if(r && r.id) nm.set(r.id, r); });
  const ts = Date.now();
  const base = { ts, key, label, src: fromCloud ? 'cloud' : 'local', dev: _deviceId(), role: (typeof currentRole==='function' ? currentRole() : ''), caller: fromCloud ? '' : _callerNames() };
  const fields = AUDIT_FIELDS[key];
  if(fields){
    nm.forEach((r,id)=>{
      const o = pm.get(id);
      if(!o){ if(!fromCloud) HistDB.add('audit', Object.assign({}, base, {action:'add', id, who:_recName(r)})).catch(()=>{}); return; }
      fields.forEach(f=>{
        const b = (o[f]==null?'':String(o[f])), a = (r[f]==null?'':String(r[f]));
        if(b!==a) HistDB.add('audit', Object.assign({}, base, {action:'edit', id, field:f, before:b, after:a, who:(f==='name'?b:_recName(o)), by:r.updatedBy||''})).catch(()=>{});
      });
    });
  }
  const removed = [];
  pm.forEach((r,id)=>{ if(!nm.has(id)) removed.push(r); });
  if(!removed.length) return;
  if(removed.length>50 && AUDIT_BULK_KEYS.includes(key)){
    HistDB.add('audit', Object.assign({}, base, {action:'bulk-remove', count:removed.length, who:''})).catch(()=>{});
    return;
  }
  removed.forEach(r=>{
    HistDB.add('trash', {ts, key, label, record:r, name:_recName(r), src:base.src, dev:base.dev, role:base.role, caller:base.caller}).catch(()=>{});
    HistDB.add('audit', Object.assign({}, base, {action:'delete', id:r.id, who:_recName(r)})).catch(()=>{});
  });
  // অন্য ফোন/ডিভাইস থেকে কাস্টমার মুছে ফেলা হলে এই ফোনে চুপচাপ গায়েব না হয়ে সাথে সাথে জানানো হয়
  if(fromCloud && key===DB_KEYS.customer){
    try{ toast('⚠ অন্য ফোন থেকে কাস্টমার "'+removed.slice(0,2).map(r=>_recName(r)).join(', ')+'"'+(removed.length>2?' ও আরও '+(removed.length-2)+' জন':'')+' মুছে ফেলা হয়েছে — সেটিংস → পরিবর্তনের লগ ও রিসাইকেল বিন থেকে ফেরানো যাবে'); }catch(e){}
  }
}

let _dataVersion = 0;   // save() প্রতিবার বাড়ায় — ভারী হিসাবের ক্যাশ ঠিক রাখতে
function save(key, data, fromCloud){
  _dataVersion++;
  let _prevForAudit = null;
  try{ _prevForAudit = JSON.parse(localStorage.getItem(key)); }catch(e){}
  try{
    if(Array.isArray(data) && data.every(x=>x && x.id)){
      const current = JSON.parse(localStorage.getItem(key)) || [];
      if(Array.isArray(current) && current.every(x=>x && x.id)){
        const tombstones = new Set(getTombstones().map(t=>t.id));
        const ourIds = new Set(data.map(x=>x.id));
        current.forEach(rec=>{ if(!ourIds.has(rec.id) && !tombstones.has(rec.id)){ data.push(rec); ourIds.add(rec.id); } });
        if(fromCloud){
          // A Firestore snapshot just arrived. If WE edited one of these records moments ago
          // (still inside the round-trip grace window — very plausible on a slow/flaky mobile
          // connection where the write is still in flight), don't let this snapshot silently
          // revert it back to the pre-edit value just because it hasn't caught up yet. This is
          // exactly what wiped a just-typed মোবাইল নম্বর, a just-fixed ক্রয়মূল্য, and other fresh
          // edits in earlier reports. Once the grace window passes, cloud data is trusted again
          // as normal — this still picks up a genuine edit made from another device/staff phone.
          const now = Date.now();
          const localById = {}; current.forEach(rec=>{ localById[rec.id]=rec; });
          for(let i=0;i<data.length;i++){
            const rec = data[i];
            const ts = rec && _recentLocalWriteAt[rec.id];
            if(ts && (now-ts)<LOCAL_WRITE_GRACE_MS && localById[rec.id]) data[i] = localById[rec.id];
          }
        }
      }
    }
    if(!fromCloud){
      const now = Date.now();
      data.forEach(rec=>{ if(rec && rec.id) _recentLocalWriteAt[rec.id] = now; });
    }
  }catch(e){ console.error('save() merge check failed', e); }
  try{ auditDiff(key, _prevForAudit, data, !!fromCloud); }catch(e){ console.error('auditDiff failed', e); }
  try{
    localStorage.setItem(key, JSON.stringify(data));
  }catch(writeErr){
    console.error('CRITICAL: localStorage write failed', writeErr);
    try{
      clearAllSnapshots();
      localStorage.setItem(key, JSON.stringify(data));
      toast('⚠️ ফোনের সংরক্ষণ প্রায় পূর্ণ হয়ে গিয়েছিল — নিরাপত্তা স্ন্যাপশট মুছে জায়গা খালি করা হয়েছে। এই এন্ট্রিটা সংরক্ষিত হয়েছে, কিন্তু শীঘ্রই ব্যাকআপ ডাউনলোড করে জায়গা খালি করুন।');
    }catch(retryErr){
      console.error('CRITICAL: retry also failed, storage is genuinely full', retryErr);
      alert('⚠️ গুরুত্বপূর্ণ: এই তথ্যটি সংরক্ষণ করা যায়নি — ফোনের সংরক্ষণ (storage) পুরোপুরি পূর্ণ হয়ে গেছে!\n\nএখনই করণীয়:\n১) সেটিংস → "ব্যাকআপ ডাউনলোড করুন" চেপে একটা ব্যাকআপ ফাইল সংরক্ষণ করুন\n২) তারপর পুরনো/অপ্রয়োজনীয় ওষুধ বা এন্ট্রি মুছে জায়গা খালি করুন\n\nযতক্ষণ এটা ঠিক না হচ্ছে, নতুন কোনো তথ্য সংরক্ষিত হবে না — এই মুহূর্তের এন্ট্রিটা এখনো সংরক্ষিত হয়নি।');
      return false;
    }
  }
  maybeTakeSafetySnapshot();
  updateStorageUsageDisplay();
  return true;
}
function clearAllSnapshots(){
  try{
    const index = JSON.parse(localStorage.getItem('ssn_snapshot_index')||'[]');
    index.forEach(e=>localStorage.removeItem('ssn_snapshot_'+e.slot));
    localStorage.removeItem('ssn_snapshot_index');
    localStorage.removeItem('ssn_snapshot_last');
  }catch(e){ console.error(e); }
}
function estimateStorageUsageBytes(){
  let total = 0;
  try{
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      total += k.length + (localStorage.getItem(k)||'').length;
    }
  }catch(e){}
  return total;
}
function updateStorageUsageDisplay(){
  const el = document.getElementById('storageUsageInfo');
  // This scans every single localStorage key/value to total up bytes — real work, so skip it
  // entirely unless that info is actually visible right now (offsetParent is null when it or
  // any ancestor is display:none). save() used to trigger this on every single write, which
  // during the cloud-sync burst on app open meant repeating a full-storage scan up to 10 times
  // for a number nobody was looking at yet.
  if(!el || el.offsetParent===null) return;
  const bytes = estimateStorageUsageBytes();
  const mb = (bytes/1024/1024).toFixed(2);
  el.textContent = `এই ফোনে এখন প্রায় ${mb} MB তথ্য জমা আছে (সাধারণত ফোনভেদে সর্বোচ্চ ৫-১০ MB পর্যন্ত জায়গা থাকে — এর কাছাকাছি চলে গেলে নতুন এন্ট্রি সংরক্ষণ ব্যর্থ হতে পারে, তখন একটা সতর্কবার্তা দেখানো হবে)।`;
}
// Local "point-in-time" safety net, separate from (and in addition to) Cloud Backup/manual JSON
// export — nothing about live localStorage, however carefully it's written to, survives the
// phone/browser wiping its site data (a manual "clear cache", a browser reinstall, low-storage
// auto-cleanup...). This can't prevent that, but it gives a way to recover from it on THIS
// device: every ~15 minutes of actual use, bundle all 8 collections into one rotating slot (6
// kept, oldest overwritten first) under separate keys the app's own overwrite logic never
// touches, so a bad state doesn't take the snapshots down with it. See restoreFromSnapshot() for
// the recovery side. This does NOT replace Cloud Backup or the downloadable JSON export — it's
// the same-device, no-setup-required layer underneath those.
// Kept deliberately small (3 slots, 30-min spacing rather than 6/15-min) — this exists to
// protect the real data, so it should never itself be a meaningful contributor to a phone
// running low on storage. save() also always sacrifices these first, automatically, if a real
// write is ever at risk of failing for lack of space (see save() above).
const SNAPSHOT_SLOTS = 3;
const SNAPSHOT_MIN_INTERVAL_MS = 30*60*1000;
function maybeTakeSafetySnapshotLegacy(){
  try{
    const lastTs = parseInt(localStorage.getItem('ssn_snapshot_last')||'0', 10);
    if(Date.now() - lastTs < SNAPSHOT_MIN_INTERVAL_MS) return;
    const index = JSON.parse(localStorage.getItem('ssn_snapshot_index')||'[]');
    const slot = index.length < SNAPSHOT_SLOTS ? index.length : [...index].sort((a,b)=>a.ts-b.ts)[0].slot;
    const snapshot = { ts: Date.now(), medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices };
    localStorage.setItem('ssn_snapshot_'+slot, JSON.stringify(snapshot));
    const newIndex = index.filter(e=>e.slot!==slot);
    newIndex.push({slot, ts:snapshot.ts});
    localStorage.setItem('ssn_snapshot_index', JSON.stringify(newIndex));
    localStorage.setItem('ssn_snapshot_last', String(snapshot.ts));
  }catch(e){ console.error('safety snapshot failed', e); }
}

let _lastSnapJson = null;
let _snapBusy = false;
function _snapPayload(){ return JSON.stringify({ medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices }); }
async function takeSnapshotNow(note){
  if(_snapBusy) return false;
  _snapBusy = true;
  try{
    const json = _snapPayload();
    if(!note && json === _lastSnapJson) return false; // nothing changed since last restore point
    const ts = Date.now();
    await HistDB.run(['snapshots','snapmeta'],'readwrite',t=>{
      t.objectStore('snapshots').put({ts, json});
      t.objectStore('snapmeta').put({ts, m:medicines.length, s:sales.length, c:customers.length, size:json.length, note:note||''});
    });
    _lastSnapJson = json;
    localStorage.setItem('ssn_snapshot_last', String(ts));
    await migrateLegacySnapshots();
    await pruneSnapshots();
    return true;
  }catch(e){ console.error('snapshot failed', e); return false; }
  finally{ _snapBusy = false; }
}
async function migrateLegacySnapshots(){
  try{
    const idx = JSON.parse(localStorage.getItem('ssn_snapshot_index')||'[]');
    if(!idx.length) return;
    for(const e of idx){
      const raw = localStorage.getItem('ssn_snapshot_'+e.slot); if(!raw) continue;
      const s = JSON.parse(raw);
      const json = JSON.stringify({medicines:s.medicines,sales:s.sales,purchases:s.purchases,customers:s.customers,suppliers:s.suppliers,payments:s.payments,labTests:s.labTests,prescriptions:s.prescriptions,referrers:s.referrers||[],testPrices:s.testPrices||[]});
      await HistDB.run(['snapshots','snapmeta'],'readwrite',t=>{
        t.objectStore('snapshots').put({ts:s.ts, json});
        t.objectStore('snapmeta').put({ts:s.ts, m:s.medicines.length, s:s.sales.length, c:s.customers.length, size:json.length, note:''});
      });
    }
    clearAllSnapshots(); // frees the localStorage space the old 3-slot system used
  }catch(e){ console.error('legacy snapshot migration failed', e); }
}
// Thinning, never a hard expiry: all points for 48h, newest-per-day up to 60 days, newest-per-week after that.
async function pruneSnapshots(){
  const metas = (await HistDB.getAll('snapmeta')).sort((a,b)=>b.ts-a.ts);
  const now = Date.now(), H = 3600e3, D = 24*H;
  const seen = new Set(), drop = [];
  metas.forEach(m=>{
    if(m.note) return; // labelled points (e.g. before a restore) are always kept
    const age = now - m.ts;
    if(age <= 48*H) return;
    const bucket = age <= 60*D ? 'd'+Math.floor(m.ts/D) : 'w'+Math.floor(m.ts/(7*D));
    if(seen.has(bucket)) drop.push(m.ts); else seen.add(bucket);
  });
  if(drop.length) await HistDB.run(['snapshots','snapmeta'],'readwrite',t=>{ drop.forEach(k=>{ t.objectStore('snapshots').delete(k); t.objectStore('snapmeta').delete(k); }); });
}
function maybeTakeSafetySnapshot(){
  if(!window.indexedDB){ maybeTakeSafetySnapshotLegacy(); return; }
  const lastTs = parseInt(localStorage.getItem('ssn_snapshot_last')||'0', 10);
  if(Date.now() - lastTs < SNAPSHOT_MIN_INTERVAL_MS) return;
  takeSnapshotNow('').catch(()=>{});
}
function listSnapshots(){
  try{ return JSON.parse(localStorage.getItem('ssn_snapshot_index')||'[]').sort((a,b)=>b.ts-a.ts); }catch(e){ return []; }
}

function _srcText(e){
  if(e.src==='cloud') return 'উৎস: ক্লাউড সিঙ্ক (অন্য ডিভাইস'+(e.by?' '+escapeHtml(e.by):'')+' থেকে এসেছে)';
  return 'উৎস: এই ফোন ('+escapeHtml(e.dev||'')+(e.role?', '+escapeHtml(e.role):'')+')'+(e.caller?' • '+escapeHtml(e.caller):'');
}
async function renderAuditLog(){
  const wrap = document.getElementById('auditList'); if(!wrap) return;
  try{
    const q = (document.getElementById('auditSearch')?.value||'').trim().toLowerCase();
    let all = (await HistDB.getAll('audit')).sort((a,b)=>b.ts-a.ts);
    if(q) all = all.filter(e=>[e.who,e.before,e.after].some(v=>(v||'').toLowerCase().includes(q)));
    const list = all.slice(0,150);
    if(!list.length){ wrap.innerHTML = '<div class="empty-state" style="padding:14px;">'+(q?'কিছু পাওয়া যায়নি':'এখনো কোনো পরিবর্তন লগ হয়নি — এই আপডেটের পর থেকে জমা হবে')+'</div>'; return; }
    const FN = {name:'নাম', mobile:'মোবাইল', guardian:'অভিভাবক', address:'ঠিকানা'};
    wrap.innerHTML = list.map(e=>{
      let title = '';
      if(e.action==='edit') title = `<b>${e.label}</b> — ${FN[e.field]||e.field} বদল: "${escapeHtml(e.before)}" → "${escapeHtml(e.after)}"`;
      else if(e.action==='add') title = `<b>${e.label}</b> যোগ: ${escapeHtml(e.who||'')}`;
      else if(e.action==='delete') title = `<b>${e.label}</b> মোছা হয়েছে: ${escapeHtml(e.who||'')}`;
      else if(e.action==='restore') title = `<b>${e.label}</b> ফিরিয়ে আনা হয়েছে: ${escapeHtml(e.who||'')}`;
      else if(e.action==='bulk-remove') title = `<b>${e.label}</b> — ${e.count}টা রেকর্ড একসাথে সরানো (আর্কাইভ)`;
      else title = e.action;
      const red = (e.action==='delete'||e.action==='bulk-remove') ? 'badge-red' : 'badge-green';
      return `<div class="row-item" style="padding:10px;display:block;"><div class="row-title" style="font-size:13.5px;">${title}</div>
        <div class="row-sub">${new Date(e.ts).toLocaleString('bn-BD')} • ${_srcText(e)}</div></div>`;
    }).join('') + (all.length>150 ? `<div class="row-sub" style="text-align:center;padding:8px;">সবচেয়ে নতুন ১৫০টা দেখানো হচ্ছে — নাম লিখে খুঁজলে পুরনোগুলোও পাবেন</div>` : '');
  }catch(err){ console.error(err); wrap.innerHTML = '<div class="empty-state">লগ লোড হয়নি</div>'; }
}
async function renderTrash(){
  const wrap = document.getElementById('trashList'); if(!wrap) return;
  try{
    const items = (await HistDB.getAll('trash')).sort((a,b)=>b.ts-a.ts).slice(0,200);
    if(!items.length){ wrap.innerHTML = '<div class="empty-state" style="padding:14px;">রিসাইকেল বিন খালি</div>'; return; }
    wrap.innerHTML = items.map(it=>`<div class="row-item" style="padding:10px;display:block;">
      <div class="row-title" style="font-size:13.5px;"><b>${it.label}</b>: ${escapeHtml(it.name||'(নাম নেই)')}${it.record && it.record.due>0?` <span class="badge badge-red">বাকি ${fmt(it.record.due)}</span>`:''}</div>
      <div class="row-sub">${new Date(it.ts).toLocaleString('bn-BD')} • ${_srcText(it)}</div>
      <button class="btn btn-sm btn-outline" style="margin-top:6px;" onclick="restoreFromTrash(${it.tid})">↩ ফিরিয়ে আনুন</button></div>`).join('');
  }catch(err){ console.error(err); wrap.innerHTML = '<div class="empty-state">লোড হয়নি</div>'; }
}
async function restoreFromTrash(tid){
  try{
    const it = await HistDB.get('trash', tid);
    if(!it){ toast('পাওয়া যায়নি'); return; }
    const cfg = LIVE_COLLECTIONS.find(c=>c.dbKey===it.key);
    if(!cfg){ toast('এই ধরনের তথ্য ফেরানো যাচ্ছে না'); return; }
    const arr = load(it.key);
    if(arr.some(x=>x.id===it.record.id)){ toast('এটা আগে থেকেই আছে'); await HistDB.del('trash', tid); renderTrash(); return; }
    arr.push(it.record);
    localStorage.setItem('ssn_deleted_ids', JSON.stringify(getTombstones().filter(t=>t.id!==it.record.id)));
    setLiveArray(cfg.arrKey, arr);
    save(it.key, arr);
    if(cloudReady()){ const {id, ...data} = it.record; shopColl(cfg.name).doc(id).set(data).catch(e=>console.error(e)); }
    _recentLocalWriteAt[it.record.id] = Date.now();
    await HistDB.add('audit', {ts:Date.now(), key:it.key, label:it.label, action:'restore', id:it.record.id, who:it.name, src:'local', dev:_deviceId(), role:currentRole(), caller:'restoreFromTrash'});
    await HistDB.del('trash', tid);
    toast('"'+(it.name||'তথ্য')+'" ফিরিয়ে আনা হয়েছে ✓');
    renderTrash(); rerenderCurrentSection(); renderDashboard();
  }catch(e){ console.error(e); toast('ফেরানো যায়নি'); }
}
function relativeTimeBn(ts){
  const mins = Math.round((Date.now()-ts)/60000);
  if(mins<1) return 'এইমাত্র';
  if(mins<60) return `${mins} মিনিট আগে`;
  const hrs = Math.round(mins/60);
  if(hrs<24) return `${hrs} ঘণ্টা আগে`;
  const days = Math.round(hrs/24);
  return `${days} দিন আগে`;
}
async function renderSnapshotList(){
  const wrap = document.getElementById('snapshotList');
  if(window.indexedDB){
    try{
      await migrateLegacySnapshots();
      const metas = (await HistDB.getAll('snapmeta')).sort((a,b)=>b.ts-a.ts);
      if(!metas.length){ wrap.innerHTML = '<div class="empty-state" style="padding:14px;">এখনো কোনো রিস্টোর পয়েন্ট জমা হয়নি — অ্যাপ ব্যবহারের সাথে সাথে প্রতি ৩০ মিনিটে একটা করে জমা হবে</div>'; return; }
      const totalMB = (metas.reduce((a,m)=>a+(m.size||0),0)/1048576).toFixed(1);
      wrap.innerHTML = `<div class="row-sub" style="margin-bottom:8px;">মোট ${metas.length}টা রিস্টোর পয়েন্ট (প্রায় ${totalMB} MB)। ৪৮ ঘণ্টা পর্যন্ত সবগুলো, তারপর দিনে ১টা, ৬০ দিন পর সপ্তাহে ১টা — কখনো পুরোপুরি মোছা হয় না।</div>` + metas.map(m=>{
        const dt = new Date(m.ts).toLocaleString('bn-BD');
        return `<div class="row-item" style="padding:10px;cursor:pointer;" onclick="confirmRestoreSnapshotIDB(${m.ts})">
          <div class="row-title" style="font-size:13.5px;">${dt} <span class="tag-en">(${relativeTimeBn(m.ts)})</span>${m.note?' — '+escapeHtml(m.note):''}</div>
          <div class="row-sub">ওষুধ ${m.m} • বিক্রয় ${m.s} • কাস্টমার ${m.c} — পুনরুদ্ধার করতে চাপুন</div>
        </div>`;
      }).join('');
      return;
    }catch(e){ console.error(e); }
  }
  renderSnapshotListLegacy();
}
async function confirmRestoreSnapshotIDB(ts){
  try{
    const rec = await HistDB.get('snapshots', ts);
    if(!rec){ toast('রিস্টোর পয়েন্ট পাওয়া যায়নি'); return; }
    const snap = JSON.parse(rec.json); snap.ts = ts;
    let ok = false;
    try{ ok = confirm(`${new Date(ts).toLocaleString('bn-BD')}-এর অবস্থায় ফিরে যাবেন?\n\nএখন: ওষুধ ${medicines.length}, বিক্রয় ${sales.length}, কাস্টমার ${customers.length}\nসেই সময়ে: ওষুধ ${snap.medicines.length}, বিক্রয় ${snap.sales.length}, কাস্টমার ${snap.customers.length}\n\nপুনরুদ্ধারের আগে এখনকার অবস্থাও একটা রিস্টোর পয়েন্ট হিসেবে জমা থাকবে। ক্লাউড চালু থাকলে ফেরানো তথ্য ক্লাউডেও পাঠানো হবে।`); }catch(e){ ok = false; }
    if(!ok) return;
    await takeSnapshotNow('রিস্টোরের আগের অবস্থা');
    restoreFromSnapshot(snap);
    closeModal('snapshotModalBackdrop');
  }catch(e){ console.error(e); toast('পুনরুদ্ধার ব্যর্থ হয়েছে'); }
}
function renderSnapshotListLegacy(){
  const wrap = document.getElementById('snapshotList');
  const snaps = listSnapshots();
  if(!snaps.length){ wrap.innerHTML = '<div class="empty-state" style="padding:14px;">এখনো কোনো স্ন্যাপশট জমা হয়নি — অ্যাপ ব্যবহারের সাথে সাথে প্রতি ৩০ মিনিটে একটা করে জমা হবে</div>'; return; }
  wrap.innerHTML = snaps.map(s=>{
    let counts = '';
    try{
      const snap = JSON.parse(localStorage.getItem('ssn_snapshot_'+s.slot));
      counts = `ওষুধ ${snap.medicines.length} • বিক্রয় ${snap.sales.length} • কাস্টমার ${snap.customers.length}`;
    }catch(e){}
    return `<div class="row-item" style="padding:10px;cursor:pointer;" onclick="confirmRestoreSnapshot(${s.slot})">
      <div class="row-title" style="font-size:13.5px;">${relativeTimeBn(s.ts)}</div>
      <div class="row-sub">${counts} — পুনরুদ্ধার করতে চাপুন</div>
    </div>`;
  }).join('');
}
function confirmRestoreSnapshot(slot){
  try{
    const snap = JSON.parse(localStorage.getItem('ssn_snapshot_'+slot));
    if(!snap){ toast('স্ন্যাপশট পাওয়া যায়নি'); return; }
    const msg = `${relativeTimeBn(snap.ts)}-এর অবস্থায় ফিরে যাবেন?\n\nএখন: ওষুধ ${medicines.length}, বিক্রয় ${sales.length}, কাস্টমার ${customers.length}\nস্ন্যাপশটে: ওষুধ ${snap.medicines.length}, বিক্রয় ${snap.sales.length}, কাস্টমার ${snap.customers.length}\n\nএটা শুধু এই ফোনেই প্রয়োগ হবে। ক্লাউড ব্যাকআপ চালু থাকলে পুনরুদ্ধারের পর "ব্যাকআপ শেয়ার করুন" বা ক্লাউড পুশ করে নিন যেন অন্য ডিভাইসও একই তথ্য পায়।`;
    if(!confirm(msg)) return;
    restoreFromSnapshot(snap);
  }catch(e){ console.error(e); toast('পুনরুদ্ধার ব্যর্থ হয়েছে'); }
}
// ===== নিরাপদ পুনরুদ্ধার (ব্যাকআপ ইমপোর্ট / ক্লাউড থেকে টানা / স্ন্যাপশট রিস্টোর — তিনটাই এখন এটা দিয়ে চলে) =====
// আগে এই তিনটা ছিল "পুরনোটা ফেলে নতুনটা বসাও" — তাই পুরনো ব্যাকআপ/স্ন্যাপশটে যে কাস্টমার বা রেকর্ড ছিল না সে চুপচাপ হারাতো।
// এখন নিয়ম: (১) শুরুতেই "রিস্টোরের আগের অবস্থা" নামে একটা রিস্টোর পয়েন্ট জমা হয় (ভুল হলে ফিরে যাওয়া যায়);
// (২) কোনো রেকর্ড কখনো মোছা হয় না — ফাইলের রেকর্ডের সাথে ফোনের এখনকার রেকর্ড জোড়া লাগে (union);
// (৩) একই আইডির রেকর্ড দুই জায়গায় থাকলে: ইমপোর্ট/ক্লাউডের ক্ষেত্রে ফোনের এখনকার (নতুন) মান থাকে — যাতে পুরনো ব্যাকআপ
//     বর্তমান স্টক, বাকি, মোবাইল নম্বর উল্টে না দেয়; স্ন্যাপশট রিস্টোরে (ইচ্ছে করেই "আগের অবস্থায় ফেরা") স্ন্যাপশটের মান থাকে,
//     কিন্তু স্ন্যাপশটের পরে তৈরি নতুন রেকর্ডগুলো তবুও থেকে যায়; (৪) ফেরানো রেকর্ড ক্লাউডেও পাঠানো হয়।
async function safeRestore(incoming, label, opts){
  opts = opts || {};
  const incomingWins = !!opts.incomingWins;
  if(opts.pre !== false){ try{ await takeSnapshotNow('রিস্টোরের আগের অবস্থা ('+label+')'); }catch(e){ console.error(e); } }
  const cur = { medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices };
  const pushes = []; const addedCount = {}; let totalAdded = 0;
  const now = Date.now();
  const restoredIds = new Set();
  LIVE_COLLECTIONS.forEach(c=>{
    const inc = Array.isArray(incoming[c.arrKey]) ? incoming[c.arrKey] : [];
    const curArr = Array.isArray(cur[c.arrKey]) ? cur[c.arrKey] : [];
    const localById = new Map(); curArr.forEach(r=>{ if(r && r.id) localById.set(r.id, r); });
    const out = []; const seen = new Set(); let added = 0;
    inc.forEach(r=>{
      if(!r) return;
      if(!r.id){ out.push(r); return; }
      if(seen.has(r.id)) return;
      seen.add(r.id); restoredIds.add(r.id);
      const l = localById.get(r.id);
      if(!l){ out.push(r); pushes.push({coll:c.name, rec:r}); added++; }
      else if(incomingWins){ out.push(r); if(JSON.stringify(l)!==JSON.stringify(r)) pushes.push({coll:c.name, rec:r}); }
      else out.push(l);
    });
    curArr.forEach(r=>{ if(r && (!r.id || !seen.has(r.id))) out.push(r); });
    addedCount[c.arrKey] = added; totalAdded += added;
    setLiveArray(c.arrKey, out);
  });
  // ফেরানো রেকর্ড আর "ইচ্ছে করে মোছা" তালিকায় থাকবে না, আর আসন্ন ক্লাউড স্ন্যাপশটও এগুলো উল্টে দেবে না
  try{ localStorage.setItem('ssn_deleted_ids', JSON.stringify(getTombstones().filter(t=>!restoredIds.has(t.id)))); }catch(e){}
  pushes.forEach(x=>{ if(x.rec && x.rec.id) _recentLocalWriteAt[x.rec.id] = now; });
  const arrs = { medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices };
  LIVE_COLLECTIONS.forEach(c=>{ save(c.dbKey, arrs[c.arrKey]); });
  if(cloudReady() && pushes.length){
    try{
      for(let i=0;i<pushes.length;i+=400){
        const b = cloudDb.batch();
        pushes.slice(i,i+400).forEach(x=>{ const {id, ...data} = x.rec; b.set(shopColl(x.coll).doc(id), data); });
        await b.commit();
      }
    }catch(e){ console.error('restore cloud push failed', e); toast('⚠️ ফোনে ফেরানো হয়েছে, কিন্তু ক্লাউডে পাঠানো যায়নি — ইন্টারনেট চেক করুন'); }
  }
  try{ autoRecoverMissingCustomers('safeRestore:'+label); }catch(e){}
  toast('✓ পুনরুদ্ধার সম্পন্ন ('+label+') — ফোনের বর্তমান তথ্য অক্ষত আছে'+(totalAdded?', ফেরানো নতুন রেকর্ড: '+totalAdded+'টি (কাস্টমার '+(addedCount.customers||0)+', বিক্রয় '+(addedCount.sales||0)+', ওষুধ '+(addedCount.medicines||0)+')':' , নতুন কোনো রেকর্ড লাগেনি'));
  try{ renderDashboard(); rerenderCurrentSection(); }catch(e){}
  return totalAdded;
}
function restoreFromSnapshot(snap){
  // রিস্টোর পয়েন্ট আগেই জমা হয়ে থাকে (confirmRestoreSnapshotIDB দেখুন); IndexedDB না থাকা ব্রাউজারে এখানেই জমা হবে
  return safeRestore(snap, 'স্ন্যাপশট', {incomingWins:true, pre:!window.indexedDB});
}
// A restore only wrote to THIS phone. With cloud sync on, the very next Firestore snapshot used to
// overwrite the restored records with the (still wrong) cloud copy — so restores appeared to "not
// work". Fix: un-tombstone restored ids, protect them from the incoming snapshot, and push every
// record that differs from the pre-restore state up to the cloud.
function reconcileAfterRestore(prev){
  const now = Date.now();
  const restoredIds = new Set();
  const cur = { medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices };
  const pushes = [];
  LIVE_COLLECTIONS.forEach(c=>{
    const arr = cur[c.arrKey] || [], old = prev[c.arrKey] || [];
    const oldById = new Map(); old.forEach(r=>{ if(r && r.id) oldById.set(r.id, r); });
    arr.forEach(r=>{
      if(!r || !r.id) return;
      restoredIds.add(r.id); _recentLocalWriteAt[r.id] = now;
      const o = oldById.get(r.id);
      if(!o || JSON.stringify(o) !== JSON.stringify(r)) pushes.push({coll:c.name, rec:r});
    });
  });
  localStorage.setItem('ssn_deleted_ids', JSON.stringify(getTombstones().filter(t=>!restoredIds.has(t.id))));
  if(!cloudReady() || !pushes.length) return;
  (async()=>{
    try{
      for(let i=0;i<pushes.length;i+=400){
        const b = cloudDb.batch();
        pushes.slice(i,i+400).forEach(p=>{ const {id, ...data} = p.rec; b.set(shopColl(p.coll).doc(id), data); });
        await b.commit();
      }
      toast('ফেরানো তথ্য ক্লাউডেও পাঠানো হয়েছে ✓');
    }catch(e){ console.error('restore cloud push failed', e); toast('⚠️ ফোনে পুনরুদ্ধার হয়েছে, কিন্তু ক্লাউডে পাঠানো যায়নি — ইন্টারনেট চেক করুন'); }
  })();
}
// Old-history archiving: sales/purchases have no delete feature (by design — they're financial
// records) and only ever grow, so they're the main long-term driver of local storage size. This
// only ever removes a record locally after POSITIVELY confirming — with a live read against the
// cloud collection, right now — that this exact id is saved there; if that check can't be done
// (offline, or the read itself fails) nothing is touched. Manually triggered, with a clear count
// shown before anything happens, rather than silent/automatic, so the pharmacist stays in
// control of when it runs (e.g. on good wifi) and sees exactly what's leaving the phone.
async function previewArchive(){
  if(!cloudLive){ toast('আর্কাইভ করতে হলে আগে ক্লাউড সংযোগ চালু থাকতে হবে'); return null; }
  const cutoff = Date.now() - ARCHIVE_AGE_MS;
  const oldSales = sales.filter(s=>s.ts && s.ts<cutoff);
  const oldPurchases = purchases.filter(p=>p.ts && p.ts<cutoff);
  if(!oldSales.length && !oldPurchases.length){ toast('১ বছরের বেশি পুরনো কোনো রেকর্ড নেই'); return null; }
  try{
    const [salesSnap, purchSnap] = await Promise.all([
      oldSales.length ? shopColl('sales').select().get() : null,
      oldPurchases.length ? shopColl('purchases').select().get() : null
    ]);
    const cloudSaleIds = salesSnap ? new Set(salesSnap.docs.map(d=>d.id)) : new Set();
    const cloudPurchIds = purchSnap ? new Set(purchSnap.docs.map(d=>d.id)) : new Set();
    const confirmedSales = oldSales.filter(s=>cloudSaleIds.has(s.id));
    const confirmedPurchases = oldPurchases.filter(p=>cloudPurchIds.has(p.id));
    const unconfirmedCount = (oldSales.length-confirmedSales.length) + (oldPurchases.length-confirmedPurchases.length);
    return {confirmedSales, confirmedPurchases, unconfirmedCount};
  }catch(e){
    console.error('archive preview failed', e);
    toast('ক্লাউড যাচাই ব্যর্থ হয়েছে — ইন্টারনেট চেক করুন, কিছুই মোছা হয়নি');
    return null;
  }
}
async function runArchiveOldRecords(){
  const btn = document.getElementById('archiveBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'যাচাই করা হচ্ছে…'; }
  const preview = await previewArchive();
  if(btn){ btn.disabled = false; btn.textContent = '📦 পুরনো ইতিহাস আর্কাইভ করুন (১ বছরের বেশি পুরনো)'; }
  if(!preview) return;
  const {confirmedSales, confirmedPurchases, unconfirmedCount} = preview;
  if(!confirmedSales.length && !confirmedPurchases.length){
    toast(unconfirmedCount ? 'পুরনো রেকর্ড আছে কিন্তু ক্লাউডে এখনো নিশ্চিত হয়নি — পরে আবার চেষ্টা করুন' : 'সরানোর মতো কিছু নেই');
    return;
  }
  let msg = `১ বছরের বেশি পুরনো ${confirmedSales.length} টা বিক্রয় আর ${confirmedPurchases.length} টা ক্রয় রেকর্ড ক্লাউডে নিশ্চিতভাবে সংরক্ষিত পাওয়া গেছে।\n\nএগুলো এই ফোন থেকে সরিয়ে জায়গা খালি করা হবে (ক্লাউডে থেকেই যাবে — দরকার হলে নিচের "পুরনো ইতিহাস ফিরিয়ে আনুন" দিয়ে আবার আনা যাবে)।`;
  if(unconfirmedCount) msg += `\n\n(${unconfirmedCount} টা রেকর্ড এখনো ক্লাউডে নিশ্চিত হয়নি, তাই ওগুলো ফোনেই থেকে যাবে।)`;
  msg += '\n\nএগিয়ে যাবেন?';
  if(!confirm(msg)) return;
  const confirmedSaleIds = new Set(confirmedSales.map(s=>s.id));
  const confirmedPurchaseIds = new Set(confirmedPurchases.map(p=>p.id));
  sales = sales.filter(s=>!confirmedSaleIds.has(s.id));
  try{ localStorage.setItem('ssn_archived_any','1'); }catch(e){}
  purchases = purchases.filter(p=>!confirmedPurchaseIds.has(p.id));
  // Same reasoning as any other intentional removal (see deleteMedicine etc. above): tombstone
  // these so save()'s merge-back doesn't treat "missing locally" as a stale write to undo.
  // restoreArchivedHistory() below un-tombstones on the way back in.
  confirmedSaleIds.forEach(addTombstone);
  confirmedPurchaseIds.forEach(addTombstone);
  save(DB_KEYS.sale, sales);
  save(DB_KEYS.purchase, purchases);
  toast(`✓ ${confirmedSales.length+confirmedPurchases.length} টা পুরনো রেকর্ড আর্কাইভ করা হয়েছে`);
  renderDashboard(); rerenderCurrentSection();
  updateStorageUsageDisplay();
}
async function restoreArchivedHistory(){
  if(!cloudLive){ toast('আগে ক্লাউড সংযোগ চালু করুন'); return; }
  if(!confirm('ক্লাউড থেকে সব পুরনো বিক্রয়/ক্রয় ইতিহাস আবার এই ফোনে ফিরিয়ে আনবেন? এতে ফোনের জায়গা আবার বেশি লাগবে।')) return;
  try{
    const [salesSnap, purchSnap] = await Promise.all([shopColl('sales').get(), shopColl('purchases').get()]);
    const cloudSales = salesSnap.docs.map(d=>({id:d.id, ...d.data()}));
    const cloudPurchases = purchSnap.docs.map(d=>({id:d.id, ...d.data()}));
    // Merge, never replace outright — a local-only record that never actually made it to the
    // cloud (still pending, or a sync failure) must not be silently discarded just because we're
    // pulling old history back in from the cloud side.
    const cloudSaleIds = new Set(cloudSales.map(s=>s.id));
    const cloudPurchaseIds = new Set(cloudPurchases.map(p=>p.id));
    const localOnlySales = sales.filter(s=>!cloudSaleIds.has(s.id));
    const localOnlyPurchases = purchases.filter(p=>!cloudPurchaseIds.has(p.id));
    const bringingBackIds = new Set([...cloudSales.map(s=>s.id), ...cloudPurchases.map(p=>p.id)]);
    const remainingTombstones = getTombstones().filter(t=>!bringingBackIds.has(t.id));
    localStorage.setItem('ssn_deleted_ids', JSON.stringify(remainingTombstones));
    sales = [...cloudSales, ...localOnlySales];
    purchases = [...cloudPurchases, ...localOnlyPurchases];
    localStorage.setItem(DB_KEYS.sale, JSON.stringify(sales));
    localStorage.setItem(DB_KEYS.purchase, JSON.stringify(purchases));
    toast('✓ পুরনো ইতিহাস আবার ফিরিয়ে আনা হয়েছে');
    autoRecoverMissingCustomers('restoreArchivedHistory');
    renderDashboard(); rerenderCurrentSection();
    updateStorageUsageDisplay();
  }catch(e){ console.error(e); toast('ফিরিয়ে আনা ব্যর্থ হয়েছে — ইন্টারনেট চেক করুন'); }
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function fmt(n){
  n = Number(n)||0;
  const r = Math.round(n*100)/100;               // ফ্লোটিং-পয়েন্টের ধুলো (277.49999) সাফ
  if(Number.isInteger(r)) return '৳' + r.toLocaleString('en-US');
  return '৳' + r.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});   // ৳277.50
}
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); const dur = msg.length>30?4200:1800; clearTimeout(window._toastTimer); window._toastTimer=setTimeout(()=>t.classList.remove('show'),dur); }

let medicines = load(DB_KEYS.med);
let sales = load(DB_KEYS.sale);
let purchases = load(DB_KEYS.purchase);
let customers = load(DB_KEYS.customer);
// One-time repair: a customer record with no `name` field (or a non-string name) has been
// found in this shop's data — likely left over from the earlier data-loss/cloud-restore mixup.
// renderCustomers() was already guarded against this (see its own comment), but saveCustomer()'s
// duplicate check and findOrCreateCustomerFor() were NOT — both called c.name.trim() directly,
// so the mere PRESENCE of one such broken record anywhere in the list made EVERY save that
// touched those functions throw "Cannot read properties of undefined (reading 'trim')" the
// instant a mobile number was involved (the case with no mobile skips that code entirely, which
// is exactly why "no mobile" kept working while "with mobile" didn't), and silently broke
// linking a customer during "প্রেসক্রিপশন থেকে বিক্রয়ে পাঠান". Rather than only patching every call
// site defensively, actually fix the broken record(s) once so nothing depends on catching this
// again, and re-save so the fix persists (and reaches the cloud too, if connected).
(function repairNamelessCustomers(){
  try{
    let changed = false;
    customers.forEach(c=>{
      if(c && typeof c.name !== 'string'){
        c.name = (c.mobile ? 'নাম নেই ('+c.mobile+')' : 'নাম নেই');
        changed = true;
      }
    });
    if(changed){
      save(DB_KEYS.customer, customers);
      if(typeof cloudReady === 'function' && cloudReady()){
        customers.forEach(c=>{ if(c && c.name && c.name.indexOf('নাম নেই')===0) shopColl('customers').doc(c.id).set({name:c.name}, {merge:true}).catch(e=>console.error(e)); });
      }
    }
  }catch(e){ console.error('repairNamelessCustomers failed', e); }
})();
let suppliers = load(DB_KEYS.supplier);
let payments = load(DB_KEYS.payment);
let labTests = load(DB_KEYS.labTest);
let prescriptions = load(DB_KEYS.prescription);
let referrers = load(DB_KEYS.referrer);
let testPrices = load(DB_KEYS.testPrice);
let cart = [];
let _completingSale = false; // guards completeSale() against duplicate sales from repeated taps
let _currentLedgerCustId = null; // which customer's ledger modal is currently open (for recalcCustomerDue())
let _pendingSaleRxId = null; // set by sendPrescriptionToSale() so the resulting sale can be traced back to its source prescription
let cloudLive = false;
let currentSection = 'dashboard';

