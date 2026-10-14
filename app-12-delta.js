/* ===== ডেল্টা সিঙ্ক (v27) =====
   লক্ষ্য: অ্যাপ খুললে ক্লাউড থেকে সব রেকর্ড না পড়ে শুধু "যা বদলেছে" সেটুকু পড়া (ফায়ারবেসের পড়ার সীমা বাঁচাতে)।
   ১) স্ট্যাম্প: ক্লাউডে প্রতিটা লেখায় রেকর্ডে _u (সার্ভারের সময়) বসে — এটা সবসময় চালু, ক্ষতিহীন।
   ২) ডেল্টা পড়া: সেটিংসে "দ্রুত সিঙ্ক" চালু করলে প্রতিটা তালিকা প্রথমে একবার পুরোটা পড়ে (সার্ভার থেকে), তারপর শেষ _u-র পর থেকে
      বদলানোগুলো মাত্র পড়ে। বদলানো রেকর্ড ফোনের কপিতে id ধরে বসে/যোগ হয়; বাকি রেকর্ড যেমন ছিল তেমনই থাকে।
   ৩) নিরাপত্তা জাল: ক্রমাগত পুরো মেলানো (৭ দিনে একবার, বা বোতামে), ফোনের ডাটা কমে গেলে/ব্যাকআপ রিস্টোর করলে আপনা-আপনি পুরো মেলানো,
      অফলাইনে বা ত্রুটিতে আগের পুরনো পদ্ধতিতে ফিরে যাওয়া। মোছা-সংক্রান্ত আচরণ আগের মতোই (অন্য ফোনের মোছা এই ফোনে নিজে থেকে মোছে না)। */
const DELTA_VER = '2';   // ২: বিক্রি/ক্রয় পুরো ইতিহাসসহ — v27-এ চালু করা ফোন একবার নতুন করে পুরোটা মিলিয়ে নেবে
const DELTA_OVERLAP_S = 120;                       // শেষ চিহ্নের ২ মিনিট আগে থেকে পড়ি — সামান্য ওভারল্যাপ, ক্ষতি নেই
const DELTA_FULL_EVERY_MS = 7*24*60*60*1000;       // ৭ দিনে অন্তত একবার পুরো মেলানো
const DELTA_FULL_BIG_MS = 30*24*60*60*1000;
const DELTA_COLLS = ['medicines','sales','purchases','customers','suppliers','payments','labTests','prescriptions','referrers','testPrices'];
const _DELTA_PATH_RE = new RegExp('/(' + DELTA_COLLS.join('|') + ')/[^/]+$');
let _deltaGen = 0;
function deltaNextGen(){ return ++_deltaGen; }
// চালু আছে কি: এই ফোনে মালিক বোতাম চেপে থাকলে, অথবা মালিক ক্লাউডে চালু করে রাখলে (কর্মচারীর ফোন এটাই অনুসরণ করে — তার সেটিংস পাতা নেই)
function deltaEnabled(){ try{ return localStorage.getItem('ssn_delta_on')==='1' || localStorage.getItem('ssn_delta_cloud')==='1'; }catch(e){ return false; } }
// দোকানের মূল ডকুমেন্টের deltaSync চিহ্ন পড়ে ফোনে মনে রাখে (শুধু মালিকই লিখতে পারে — রুলসে আগে থেকেই)। true/false ছাড়া অন্য কিছু হলে আগেরটাই থাকে।
async function deltaSyncCloudFlag(db, shopCode){
  try{
    const d = await Promise.race([ db.collection('pharmacies').doc(shopCode).get(), new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), 4000)) ]);
    if(d && d.exists){ const v = d.data().deltaSync; if(v===true) localStorage.setItem('ssn_delta_cloud','1'); else if(v===false) localStorage.setItem('ssn_delta_cloud','0'); }
  }catch(e){ console.warn('deltaSync চিহ্ন পড়া যায়নি (আগেরটাই থাকবে)', e); }
}

// ---------- স্ট্যাম্প (ক্লাউডে লেখার সময় _u বসানো) ----------
function _deltaStamp(d){
  try{
    if(!d || typeof d!=='object' || Array.isArray(d)) return d;
    if(typeof firebase==='undefined' || !firebase.firestore || !firebase.firestore.FieldValue) return d;
    return Object.assign({}, d, {_u: firebase.firestore.FieldValue.serverTimestamp()});
  }catch(e){ return d; }
}
function _batchStamp(ref, d){ try{ return _DELTA_PATH_RE.test(ref.path) ? _deltaStamp(d) : d; }catch(e){ return d; } }
function _stampDoc(ref){
  return new Proxy(ref, { get(t,k){
    if(k==='__real') return t;
    if(k==='set') return (data, opts)=> opts ? t.set(_deltaStamp(data), opts) : t.set(_deltaStamp(data));
    if(k==='update') return (...a)=>{ if(a.length===1 && a[0] && typeof a[0]==='object') return t.update(_deltaStamp(a[0])); return t.update(...a); };
    const v = t[k]; return typeof v==='function' ? v.bind(t) : v;
  }});
}
function _stampColl(c){
  return new Proxy(c, { get(t,k){
    if(k==='doc') return (...a)=>_stampDoc(t.doc(...a));
    const v = t[k]; return typeof v==='function' ? v.bind(t) : v;
  }});
}
// ক্লাউডের ডকুমেন্ট → ফোনের রেকর্ড (_u বাদ; নইলে অডিট/তুলনায় ভুল পরিবর্তন ধরা পড়ত)
function deltaRec(d){ const o = d.data() || {}; const r = {id:d.id}; for(const k in o){ if(k!=='_u') r[k] = o[k]; } return r; }
function getLiveArray(key){
  switch(key){
    case 'medicines': return medicines; case 'sales': return sales; case 'purchases': return purchases;
    case 'customers': return customers; case 'suppliers': return suppliers; case 'payments': return payments;
    case 'labTests': return labTests; case 'prescriptions': return prescriptions; case 'referrers': return referrers;
    case 'testPrices': return testPrices;
  }
  return null;
}

// ---------- চিহ্ন (cursor) ----------
function _isTs(u){ return !!u && typeof u.seconds==='number' && typeof u.nanoseconds==='number'; }
function deltaGetCursor(name){
  try{ const o = JSON.parse(localStorage.getItem('ssn_dl_cur_'+name)); if(o && typeof o.s==='number' && typeof o.n==='number') return o; }catch(e){}
  return null;
}
function deltaSaveCursor(name, cur){
  try{
    const old = deltaGetCursor(name);
    if(old && (old.s > cur.s || (old.s===cur.s && old.n>=cur.n))) return;
    localStorage.setItem('ssn_dl_cur_'+name, JSON.stringify({s:cur.s, n:cur.n}));
  }catch(e){}
}
function deltaMaxU(docs){
  let best = null;
  docs.forEach(d=>{
    try{
      if(d.metadata && d.metadata.hasPendingWrites) return;
      const u = d.get('_u'); if(!_isTs(u)) return;
      if(!best || u.seconds>best.s || (u.seconds===best.s && u.nanoseconds>best.n)) best = {s:u.seconds, n:u.nanoseconds};
    }catch(e){}
  });
  return best;
}
function deltaForceFull(){
  try{
    const rm = []; for(let i=0;i<localStorage.length;i++){ const k = localStorage.key(i); if(k && (k.indexOf('ssn_dl_cur_')===0 || k.indexOf('ssn_dl_meta_')===0)) rm.push(k); }
    rm.forEach(k=>localStorage.removeItem(k));
  }catch(e){}
}
function _deltaNeedsFull(name, localCount){
  try{
    if(localStorage.getItem('ssn_dl_ver')!==DELTA_VER) return true;
    if(localStorage.getItem('ssn_dl_shop')!==localStorage.getItem('ssn_shop_code')) return true;
    const m = JSON.parse(localStorage.getItem('ssn_dl_meta_'+name));
    if(!m) return true;
    if(Date.now() - m.at > (m.n > 20000 ? DELTA_FULL_BIG_MS : DELTA_FULL_EVERY_MS)) return true;   // ডাটা বড় হলে (২০ হাজারের বেশি) ৩০ দিনে একবার, নইলে ৭ দিনে
    if(m.n > 20 && localCount < m.n*0.5) return true;     // ফোনের ডাটা হঠাৎ অনেক কমে গেছে (রিস্টোর/মুছে যাওয়া) — চিহ্নে ভরসা নেই
    return false;
  }catch(e){ return true; }
}

// ---------- আনুমানিক পড়ার হিসাব (শুধু দেখার জন্য) ----------
function deltaCountReads(n){
  try{
    if(!n) return;
    const day = new Date().toISOString().slice(0,10);
    let o = null; try{ o = JSON.parse(localStorage.getItem('ssn_dl_reads')); }catch(e){}
    if(!o || o.d!==day) o = {d:day, n:0};
    o.n += n; localStorage.setItem('ssn_dl_reads', JSON.stringify(o));
  }catch(e){}
}

// ---------- মূল ইঞ্জিন ----------
// ফেরত: বন্ধ করার ফাংশন (unsub); gen বদলে গেলে null; প্রথম পুরো পড়া ব্যর্থ হলে ত্রুটি ছোড়ে (কলার পুরনো পদ্ধতিতে ফিরবে)
async function deltaStart(name, bootQueryFn, handle, onErr, gen, localCountFn){
  let cur = deltaGetCursor(name);
  if(!cur || _deltaNeedsFull(name, localCountFn())){
    const snap = await bootQueryFn().get({source:'server'});
    if(gen!==_deltaGen) return null;
    deltaCountReads(snap.size);
    handle(snap.docs, true);
    cur = deltaMaxU(snap.docs) || {s:0, n:0};
    try{
      localStorage.removeItem('ssn_dl_cur_'+name);
      deltaSaveCursor(name, cur);
      localStorage.setItem('ssn_dl_meta_'+name, JSON.stringify({at:Date.now(), n:localCountFn()}));
      localStorage.setItem('ssn_dl_ver', DELTA_VER);
      localStorage.setItem('ssn_dl_shop', localStorage.getItem('ssn_shop_code')||'');
    }catch(e){}
  }
  else {
    // পুরো পড়া লাগেনি — ফোনের কপিই ক্লাউডের শেষ অবস্থা। আগের পদ্ধতির প্রথম স্ন্যাপশটের মতোই বাকির হিসাব মেলানো চালু করি (এটা না করলে বদল না এলে মেলানোই হতো না)
    try{ if(name==='customers' || name==='sales' || name==='payments'){ if(typeof scheduleDueReconcile==='function') scheduleDueReconcile(name); } }catch(e){}
  }
  if(gen!==_deltaGen) return null;
  const startS = cur.s>0 ? Math.max(0, cur.s - DELTA_OVERLAP_S) : 0;
  const q = shopColl(name).where('_u', '>', new firebase.firestore.Timestamp(startS, cur.s>0 ? cur.n : 0));
  return q.onSnapshot(snap=>{
    const ch = snap.docChanges().filter(x=>x.type!=='removed');   // মোছা ঘটনা আগের মতোই উপেক্ষা
    if(!ch.length) return;
    const docs = ch.map(x=>x.doc);
    if(!snap.metadata.fromCache) deltaCountReads(docs.length);
    handle(docs, false);
    const mx = deltaMaxU(docs); if(mx) deltaSaveCursor(name, mx);
  }, onErr);
}

// ---------- সেটিংসের বোতাম ----------
function updateDeltaSyncUi(){
  const info = document.getElementById('deltaSyncInfo'), btn = document.getElementById('deltaSyncBtn');
  if(!info || !btn) return;
  const on = deltaEnabled();
  btn.textContent = on ? '⚡ দ্রুত সিঙ্ক: চালু আছে — সব ফোনে (বন্ধ করতে চাপুন)' : '⚡ দ্রুত সিঙ্ক চালু করুন (সব ফোনে)';
  let reads = 0; try{ const o = JSON.parse(localStorage.getItem('ssn_dl_reads')); if(o && o.d===new Date().toISOString().slice(0,10)) reads = o.n; }catch(e){}
  let last = ''; try{ const m = JSON.parse(localStorage.getItem('ssn_dl_meta_customers')||localStorage.getItem('ssn_dl_meta_medicines')); if(m) last = new Date(m.at).toLocaleDateString('en-GB'); }catch(e){}
  info.textContent = (on ? 'চালু' : 'বন্ধ (পুরনো পদ্ধতি)') + ' • আজ এই ফোনে ক্লাউড থেকে পড়া হয়েছে আনুমানিক ' + reads + 'টা' + (last ? ' • শেষ পুরো মেলানো: ' + last : '');
}
function toggleDeltaSync(){
  const on = !deltaEnabled();
  if(on && !confirm('দ্রুত সিঙ্ক চালু করবেন?\n\nআগে নিশ্চিত করুন দোকানের সব ফোনে অ্যাপ নতুন সংস্করণে (v27) আপডেট হয়ে খোলা হয়েছে। কর্মচারীর ফোনও পরের বার অ্যাপ খুললে নিজে থেকে চালু হয়ে যাবে। প্রথমবার পুরো ডাটা একবার মিলিয়ে নেবে, তারপর শুধু নতুন বদলগুলো পড়বে।')) return;
  try{ localStorage.setItem('ssn_delta_on', on ? '1' : '0'); localStorage.setItem('ssn_delta_cloud', on ? '1' : '0'); }catch(e){}
  // মালিকের ফোন থেকে ক্লাউডেও লেখা হয় — কর্মচারীর ফোন পরের বার অ্যাপ খুললে এটা দেখে নিজে চালু/বন্ধ হবে
  try{ const shop = localStorage.getItem('ssn_shop_code'); if(on!==undefined && cloudDb && shop && currentRole()==='owner') cloudDb.collection('pharmacies').doc(shop).set({deltaSync: on}, {merge:true}).catch(e=>console.warn('deltaSync চিহ্ন ক্লাউডে যায়নি', e)); }catch(e){}
  deltaForceFull();
  updateDeltaSyncUi();
  toast(on ? '⚡ দ্রুত সিঙ্ক চালু — ডাটা মিলিয়ে নেওয়া হচ্ছে' : 'দ্রুত সিঙ্ক বন্ধ — আগের পদ্ধতিতে ফিরল');
  try{ if(cloudReady()) attachRealtimeListeners(); }catch(e){ console.error(e); }
}
function deltaFullResync(){
  deltaForceFull();
  toast('পুরো ডাটা ক্লাউডের সাথে মিলিয়ে নেওয়া হচ্ছে…');
  try{ if(cloudReady()) attachRealtimeListeners(); }catch(e){ console.error(e); }
  setTimeout(updateDeltaSyncUi, 4000);
}
try{ setTimeout(updateDeltaSyncUi, 1500); }catch(e){}
