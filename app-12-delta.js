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
    if(d && d.exists){ try{ histSyncFromShopDoc(d.data()); }catch(e){ console.warn('ইতিহাস সীমা মেলানো যায়নি', e); } try{ doctorsSyncFromShopDoc(d.data()); }catch(e){ console.warn('প্রেসক্রাইবার তালিকা মেলানো যায়নি', e); } const v = d.data().deltaSync; if(v===true) localStorage.setItem('ssn_delta_cloud','1'); else if(v===false) localStorage.setItem('ssn_delta_cloud','0'); }
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
    const day = quotaDay();
    let o = null; try{ o = JSON.parse(localStorage.getItem('ssn_dl_reads')); }catch(e){}
    if(!o || o.d!==day) o = {d:day, n:0};
    o.n += n; localStorage.setItem('ssn_dl_reads', JSON.stringify(o));
    _reportReadsSoon();
  }catch(e){}
}
// ===== ক্লাউডের দৈনিক সীমা (পড়া + লেখা) — আনুমানিক হিসাব =====
// ফায়ারবেসের দৈনিক সীমা আমেরিকার (Pacific) মধ্যরাতে নতুন করে শুরু হয় — তাই দিনের হিসাবও সেই সময়ে ভাগ করা (বাংলাদেশে দুপুর ১টা/২টা)।
// ফ্রি (Spark) প্ল্যানে সীমা: দিনে ৫০,০০০ পড়া ও ২০,০০০ লেখা। এই অ্যাপ থেকে যা যা পড়া/লেখা হয় সেটাই গোনা হয় (আসল হিসাব ফায়ারবেস কনসোলের Usage ট্যাবে)।
const QUOTA = { reads: 50000, writes: 20000 };
function quotaDay(){ try{ return new Date().toLocaleDateString('en-CA', {timeZone:'America/Los_Angeles'}); }catch(e){ return new Date().toISOString().slice(0,10); } }
function quotaResetText(){
  let z = 'PDT';
  try{ z = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', timeZoneName:'short'}).formatToParts(new Date()).find(p=>p.type==='timeZoneName').value; }catch(e){}
  return z==='PST' ? 'দুপুর ২টায়' : 'দুপুর ১টায়';
}
// ক্লাউড প্ল্যান: 'free' (ফ্রি — সীমা শেষ হলে ক্লাউড আটকায়) বা 'paid' (পেইড/Blaze — ফ্রি অংশ শেষ হলে টাকা কাটা শুরু)। মালিক সেটিংস থেকে বদলান।
function quotaPlan(){ try{ return localStorage.getItem('ssn_quota_plan')==='paid' ? 'paid' : 'free'; }catch(e){ return 'free'; } }
function toggleQuotaPlan(){
  const toPaid = quotaPlan()!=='paid';
  if(!confirm(toPaid
    ? 'আপনি কি Firebase-এর পেইড প্ল্যানে (Blaze) গিয়েছেন?\n\nতাহলে "ফ্রি অংশ শেষ — এখন টাকা কাটছে" ধরনের সতর্কতা আসবে (ক্লাউড বন্ধ হওয়ার কথা বলবে না)। সীমার সংখ্যা (৫০,০০০ পড়া / ২০,০০০ লেখা) একই থাকবে — ওটা পেইড প্ল্যানেও দৈনিক ফ্রি অংশ।'
    : 'ফ্রি প্ল্যানের সতর্কতায় ফিরবেন?\n\nসীমা শেষ হলে "ক্লাউডে যাওয়া আটকে থাকতে পারে" বলবে।')) return;
  try{ localStorage.setItem('ssn_quota_plan', toPaid ? 'paid' : 'free'); }catch(e){}
  try{ _usageCache = {at:0, data:null}; }catch(e){}
  updateDeltaSyncUi(); try{ quotaBannerUpdate(true); }catch(e){}
  toast(toPaid ? 'পেইড প্ল্যানের সতর্কতা চালু ✓' : 'ফ্রি প্ল্যানের সতর্কতা চালু ✓');
}
const _qn = n=>{ try{ return Number(n||0).toLocaleString('bn-BD'); }catch(e){ return String(n||0); } };
function _usageLocal(key){ try{ const o = JSON.parse(localStorage.getItem(key)); return (o && o.d===quotaDay()) ? (o.n||0) : 0; }catch(e){ return 0; } }
function deltaCountWrites(n, skipReport){
  try{
    if(!n) return;
    const day = quotaDay();
    let o = null; try{ o = JSON.parse(localStorage.getItem('ssn_dl_writes')); }catch(e){}
    if(!o || o.d!==day) o = {d:day, n:0};
    o.n += n; localStorage.setItem('ssn_dl_writes', JSON.stringify(o));
    if(!skipReport) _reportReadsSoon();
  }catch(e){}
}
// প্রতিটা Firestore ডকুমেন্ট লেখা/বদল/মোছা এখানে গোনা হয় (ব্যাচের লেখা app-10-এর ব্যাচ-র‍্যাপারে গোনা হয়)
function _installWriteCounter(){
  try{
    const DR = firebase.firestore.DocumentReference; if(!DR || DR.prototype.__wc) return;
    ['set','update','delete'].forEach(k=>{
      const orig = DR.prototype[k]; if(typeof orig!=='function') return;
      DR.prototype[k] = function(...a){ try{ deltaCountWrites(1, /\/devices\//.test(this.path||'')); }catch(e){} return orig.apply(this, a); };
    });
    DR.prototype.__wc = true;
  }catch(e){}
  // পড়াও SDK স্তরে গোনা — যেকোনো জায়গার .get() (ছবি, ডিভাইস তালিকা, বাকি মেলানো, ব্যাকআপ...) এখন ধরা পড়ে; ক্যাশ থেকে এলে গোনা হয় না, খালি ফলাফলেও কমপক্ষে ১
  try{
    const Q = firebase.firestore.Query;
    if(Q && !Q.prototype.__rc){
      const og = Q.prototype.get;
      Q.prototype.get = function(...a){ return og.apply(this, a).then(snap=>{ try{ if(!(snap.metadata && snap.metadata.fromCache)) deltaCountReads(Math.max(1, snap.size||0)); }catch(e){} return snap; }); };
      Q.prototype.__rc = true;
    }
    const D = firebase.firestore.DocumentReference;
    if(D && !D.prototype.__rc){
      const od = D.prototype.get;
      D.prototype.get = function(...a){ return od.apply(this, a).then(snap=>{ try{ if(!(snap.metadata && snap.metadata.fromCache)) deltaCountReads(1); }catch(e){} return snap; }); };
      D.prototype.__rc = true;
    }
  }catch(e){}
}
// প্রতিটা ফোন (কর্মচারীরটাও) নিজের আজকের পড়া-লেখার সংখ্যা নিজের ডিভাইস-ডকুমেন্টে লেখে (রুলস বদলানো লাগে না — devices/{token} সবাই লিখতে পারে);
// মালিক সব ফোনের যোগফল দেখেন। ৫ মিনিটে সর্বোচ্চ একবার লেখে, যাতে লেখার খরচ না বাড়ে।
let _rdTimer = null, _rdLast = 0;
function _reportReadsSoon(){
  try{
    if(_rdTimer) return;
    const wait = Math.max(3000, 5*60*1000 - (Date.now()-_rdLast));
    _rdTimer = setTimeout(_reportReads, wait);
  }catch(e){}
}
async function _reportReads(){
  _rdTimer = null;
  try{
    const shop = localStorage.getItem('ssn_shop_code'), token = localStorage.getItem('ssn_device_token');
    if(!shop || !token || typeof cloudDb==='undefined' || !cloudDb) return;
    const day = quotaDay();
    const payload = { readsAt: Date.now(), reads:{d:day, n:_usageLocal('ssn_dl_reads')}, writes:{d:day, n:_usageLocal('ssn_dl_writes')} };
    _rdLast = Date.now();
    await cloudDb.collection('pharmacies').doc(shop).collection('devices').doc(token).set(payload, {merge:true});
  }catch(e){ console.warn('পড়া-লেখার সংখ্যা ক্লাউডে যায়নি', e); }
}
// সব ফোন মিলিয়ে আজকের ব্যবহার (শুধু মালিকের ফোনে)
let _usageCache = {at:0, data:null};
async function _allPhonesUsage(maxAgeMs){
  try{
    if(typeof currentRole!=='function' || currentRole()!=='owner') return null;
    const shop = localStorage.getItem('ssn_shop_code');
    if(!shop || typeof cloudDb==='undefined' || !cloudDb) return null;
    if(_usageCache.data && Date.now()-_usageCache.at < (maxAgeMs||60000)) return _usageCache.data;
    await _reportReads();   // নিজের সর্বশেষ সংখ্যাও ঢুকিয়ে নিই
    const snap = await cloudDb.collection('pharmacies').doc(shop).collection('devices').get({source:'server'});
    const day = quotaDay(), me = localStorage.getItem('ssn_device_token');
    let reads = 0, writes = 0; const parts = [];
    snap.docs.forEach(d=>{
      const x = d.data();
      let r = (x.reads && x.reads.d===day) ? x.reads.n : 0, w = (x.writes && x.writes.d===day) ? x.writes.n : 0;
      if(d.id===me){ r = Math.max(r, _usageLocal('ssn_dl_reads')); w = Math.max(w, _usageLocal('ssn_dl_writes')); }
      reads += r; writes += w;
      parts.push({ name:(x.name && x.name!=='নতুন ডিভাইস' ? x.name : (x.role==='staff'?'কর্মচারীর ফোন':'মালিকের ফোন')), me:d.id===me, r, w });
    });
    try{   // সার্ভারের অটো Drive ব্যাকআপের পড়া-লেখা (সার্ভার নিজে দোকানের মূল ডকুমেন্টে লিখে রাখে; এটা শুধু চালু থাকলে আসে)
      const su = JSON.parse(localStorage.getItem('ssn_server_usage')||'null');
      if(su && su.d===day){ reads += (su.reads||0); writes += (su.writes||0); parts.push({ name:'সার্ভার অটো ব্যাকআপ', me:false, r:(su.reads||0), w:(su.writes||0) }); }
    }catch(e){}
    const data = {reads, writes, parts};
    _usageCache = {at:Date.now(), data};
    return data;
  }catch(e){ return null; }
}
function _quotaPct(u){ return Math.max((u.reads||0)/QUOTA.reads, (u.writes||0)/QUOTA.writes); }
function _quotaLine(u){
  const pr = Math.round(u.reads/QUOTA.reads*100), pw = Math.round(u.writes/QUOTA.writes*100);
  return 'পড়া '+_qn(u.reads)+' / '+_qn(QUOTA.reads)+' ('+_qn(pr)+'%) • লেখা '+_qn(u.writes)+' / '+_qn(QUOTA.writes)+' ('+_qn(pw)+'%)';
}
// হোম পাতার ওপরে সতর্কতা: ৭০% পেরোলে হলুদ, ৯০% পেরোলে লাল, শেষ হলে স্পষ্ট বার্তা; ৯০% ও ১০০%-এ দিনে একবার করে পপ-আপ
function _quotaBannerRender(u){
  const el = document.getElementById('quotaBanner'); if(!el) return;
  if(!u){ el.style.display = 'none'; return; }
  const p = _quotaPct(u);
  if(p < 0.7){ el.style.display = 'none'; return; }
  const red = p >= 0.9, done = p >= 1, paid = quotaPlan()==='paid';
  el.style.cssText = 'display:block;margin-bottom:12px;padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.5;' + ((red || (paid && done)) ? 'background:#fdecea;border:1px solid #f1aeb5;color:#8a1c1c;' : 'background:#fff7e0;border:1px solid #ecd48a;color:#7a5b00;');
  const overR = Math.max(0, u.reads - QUOTA.reads), overW = Math.max(0, u.writes - QUOTA.writes);
  let head, tail;
  if(paid){
    head = done ? '💳 <b>আজকের ফ্রি অংশ শেষ — এখন প্রতিটা পড়া/লেখায় টাকা কাটছে।</b> ' : red ? '🔴 <b>আজকের ফ্রি অংশ প্রায় শেষ — এরপর থেকে টাকা কাটা শুরু হবে।</b> ' : '⚠️ <b>আজকের ফ্রি অংশের ৭০% পেরিয়েছে।</b> ';
    tail = done ? 'ফ্রি অংশের বাইরে আনুমানিক: পড়া '+_qn(overR)+', লেখা '+_qn(overW)+'। ক্লাউড চালুই আছে, কিছু আটকাচ্ছে না। আসল বিল Firebase/Google Cloud-এর বিলিং পাতায় দেখুন। নতুন দিন বাংলাদেশ সময় '+quotaResetText()+' শুরু।'
               : 'ক্লাউড চালুই থাকবে, শুধু ফ্রি অংশ পেরোলে টাকা কাটবে। বাংলাদেশ সময় '+quotaResetText()+' হিসাব নতুন করে শুরু হয়।';
  } else {
    head = done ? '⛔ <b>আজকের ক্লাউড সীমা শেষ।</b> ' : red ? '🔴 <b>ক্লাউডের আজকের সীমা প্রায় শেষ।</b> ' : '⚠️ <b>ক্লাউডের আজকের ব্যবহার ৭০% পেরিয়েছে।</b> ';
    tail = done ? 'বিক্রি ফোনে ঠিকঠাক চলবে, সব ডাটা ফোনে জমা থাকবে। ক্লাউডে যাওয়া/অন্য ফোনে দেখা আটকে থাকতে পারে। বাংলাদেশ সময় '+quotaResetText()+' সীমা নতুন হবে — তারপর রিপোর্ট ট্যাবে "এই ফোনে আছে, ক্লাউডে নেই — মিলিয়ে দেখুন" চেপে ক্লাউডে পাঠিয়ে নিন।'
               : 'এখন অপ্রয়োজনীয় "পুরো ডাটা মিলিয়ে নিন" বা বারবার সিঙ্ক এড়িয়ে চলুন। বাংলাদেশ সময় '+quotaResetText()+' হিসাব নতুন করে শুরু হয়।';
  }
  el.innerHTML = head + '<div style="margin-top:2px;">'+_quotaLine(u)+'</div><div style="margin-top:4px;font-size:13px;">'+tail+'</div>';
  try{
    const lvl = done ? 100 : (red ? 90 : 0);
    if(lvl){
      const k = 'ssn_quota_alert', day = quotaDay(); let o = null; try{ o = JSON.parse(localStorage.getItem(k)); }catch(e){}
      if(!o || o.d!==day || o.lvl<lvl){
        localStorage.setItem(k, JSON.stringify({d:day, lvl}));
        alert(paid
          ? (done ? '💳 আজকের ফ্রি অংশ শেষ — এখন থেকে টাকা কাটছে!' : '🔴 আজকের ফ্রি অংশ প্রায় শেষ — এরপর টাকা কাটা শুরু হবে।')+'\n\n'+_quotaLine(u)+(done ? '\n\nফ্রি অংশের বাইরে আনুমানিক: পড়া '+_qn(overR)+', লেখা '+_qn(overW) : '')+'\n\nক্লাউড চালু থাকবে। আসল বিল Firebase/Google Cloud-এর বিলিং পাতায় দেখুন।'
          : (done ? '⛔ আজকের ক্লাউড সীমা শেষ!' : '🔴 ক্লাউডের আজকের সীমা প্রায় শেষ!')+'\n\n'+_quotaLine(u)+'\n\nবিক্রি ফোনে চলবে ও ডাটা ফোনে জমা থাকবে। বাংলাদেশ সময় '+quotaResetText()+' সীমা নতুন হবে।');
      }
    }
  }catch(e){}
}
let _qbBusy = false;
async function quotaBannerUpdate(force){
  try{
    if(_qbBusy) return;
    if(typeof currentRole!=='function' || currentRole()!=='owner' || typeof cloudReady!=='function' || !cloudReady()){ _quotaBannerRender(null); return; }
    _qbBusy = true;
    const u = await _allPhonesUsage(force ? 1000 : 5*60*1000);
    _quotaBannerRender(u);
  }catch(e){} finally{ _qbBusy = false; }
}
try{ setTimeout(()=>quotaBannerUpdate(true), 25000); setInterval(()=>quotaBannerUpdate(false), 5*60*1000); }catch(e){}
function _allPhonesReadsText(){ return Promise.resolve(''); }   // পুরনো নাম — এখন updateDeltaSyncUi নিজেই দেখায়

// ---------- মূল ইঞ্জিন ----------
// ফেরত: বন্ধ করার ফাংশন (unsub); gen বদলে গেলে null; প্রথম পুরো পড়া ব্যর্থ হলে ত্রুটি ছোড়ে (কলার পুরনো পদ্ধতিতে ফিরবে)
async function deltaStart(name, bootQueryFn, handle, onErr, gen, localCountFn){
  let cur = deltaGetCursor(name);
  if(!cur || _deltaNeedsFull(name, localCountFn())){
    const snap = await bootQueryFn().get({source:'server'});
    if(gen!==_deltaGen) return null;
    handle(snap.docs, true);   // পড়ার গণনা SDK স্তরে হয়ে গেছে

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
  try{ histUpdateUi(); }catch(e){}
  const info = document.getElementById('deltaSyncInfo'), btn = document.getElementById('deltaSyncBtn');
  if(!info || !btn) return;
  const on = deltaEnabled();
  btn.textContent = on ? '⚡ দ্রুত সিঙ্ক: চালু আছে — সব ফোনে (বন্ধ করতে চাপুন)' : '⚡ দ্রুত সিঙ্ক চালু করুন (সব ফোনে)';
  const reads = _usageLocal('ssn_dl_reads'), writes = _usageLocal('ssn_dl_writes');
  let last = ''; try{ const m = JSON.parse(localStorage.getItem('ssn_dl_meta_customers')||localStorage.getItem('ssn_dl_meta_medicines')); if(m) last = new Date(m.at).toLocaleDateString('en-GB'); }catch(e){}
  const base = (on ? 'চালু' : 'বন্ধ (পুরনো পদ্ধতি)') + ' • আজ এই ফোনে আনুমানিক: পড়া ' + _qn(reads) + 'টা • লেখা ' + _qn(writes) + 'টা' + (last ? ' • শেষ পুরো মেলানো: ' + last : '');
  info.textContent = base;
  try{ const pb = document.getElementById('quotaPlanBtn'); if(pb) pb.textContent = quotaPlan()==='paid' ? '💳 ক্লাউড প্ল্যান: পেইড (ফ্রিতে ফিরতে চাপুন)' : '☁️ ক্লাউড প্ল্যান: ফ্রি (পেইডে গেলে এখানে চাপুন)'; }catch(e){}
  _allPhonesUsage(60000).then(u=>{
    if(!u) return;
    info.style.whiteSpace = 'pre-line';
    info.textContent = base + '\nসব ফোন মিলিয়ে আজ (আনুমানিক): ' + _quotaLine(u) + '\n' + u.parts.map(x=>x.name + (x.me?' (এই ফোন)':'') + ': পড়া ' + _qn(x.r) + ', লেখা ' + _qn(x.w)).join(' • ')
      + '\n('+(quotaPlan()==='paid' ? 'পেইড প্ল্যান: এটা দৈনিক ফ্রি অংশ — এর বেশি হলে টাকা কাটে।' : 'ফ্রি প্ল্যানের দৈনিক সীমা ধরে হিসাব।')+' বাংলাদেশ সময় ' + quotaResetText() + ' নতুন দিন শুরু হয়। কোনো ফোনে অ্যাপ পুরনো থাকলে তার লেখা এখানে ০ দেখাবে।)';
    try{ _quotaBannerRender(u); }catch(e){}
  });
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

// ---------- মোছার খবর সব ফোনে (v29) ----------
// সমস্যা ছিল: মালিক কিছু মুছলে ক্লাউড থেকে মুছত, কিন্তু "ইচ্ছে করে মোছা" চিহ্ন থাকত শুধু মালিকের ফোনে। কর্মচারীর ফোন
// ক্লাউডের "মোছা হয়েছে" ঘটনা উপেক্ষা করে (ডাটা হারানো ঠেকাতে ফোনের রেকর্ড রেখে দেয়), তাই মোছা কাস্টমার সেখানে থেকে যেত।
// সমাধান: মালিক মুছলে id দোকানের মূল ডকুমেন্টের delLog-এ লেখা হয় (রুলস বদলানো লাগে না — মূল ডকুমেন্ট শুধু মালিকই লিখতে পারে)।
// প্রতিটা ফোন সেটা পড়ে — শর্ত: ক্লাউডের সার্ভারে ওই রেকর্ড সত্যিই নেই (ফিরিয়ে আনা রেকর্ড কখনো মোছা হয় না)।
// বিক্রি/ক্রয়ের "আর্কাইভ" এর আওতায় নেই — আর্কাইভ শুধু ওই ফোনের নিজের ব্যাপার।
const DELLOG_KEEP_MS = 60*24*60*60*1000;
let _dlTimer = null, _dlApplying = false;
function _dlPendGet(){ try{ return JSON.parse(localStorage.getItem('ssn_dellog_pending'))||[]; }catch(e){ return []; } }
function _dlPendSet(a){ try{ localStorage.setItem('ssn_dellog_pending', JSON.stringify(a)); }catch(e){} }
function addTombstoneLogged(id){
  addTombstone(id);
  try{
    if(currentRole()!=='owner') return;
    const p = _dlPendGet();
    if(!p.some(x=>x.id===id)) p.push({id:id, ts:Date.now()});
    _dlPendSet(p);
    if(_dlTimer) clearTimeout(_dlTimer);
    _dlTimer = setTimeout(flushDeleteLog, 600);
  }catch(e){ console.warn('মোছার খবর জমা করা যায়নি', e); }
}
async function flushDeleteLog(){
  _dlTimer = null;
  try{
    if(currentRole()!=='owner') return;
    const shop = localStorage.getItem('ssn_shop_code');
    if(!shop || typeof cloudDb==='undefined' || !cloudDb) return;
    const p = _dlPendGet(); if(!p.length) return;
    for(let i=0;i<p.length;i+=200){
      const chunk = p.slice(i,i+200);
      await cloudDb.collection('pharmacies').doc(shop).set({delLog: firebase.firestore.FieldValue.arrayUnion.apply(null, chunk)}, {merge:true});
    }
    const sent = new Set(p.map(x=>x.id));
    _dlPendSet(_dlPendGet().filter(x=>!sent.has(x.id)));
  }catch(e){ console.warn('মোছার খবর ক্লাউডে যায়নি — পরে আবার চেষ্টা হবে', e); }
}
async function applyDeleteLog(list){
  if(_dlApplying || !Array.isArray(list) || !list.length) return 0;
  _dlApplying = true;
  let removed = 0;
  try{
    const cur = { medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices };
    const have = new Map();
    LIVE_COLLECTIONS.forEach(c=>{ (cur[c.arrKey]||[]).forEach(r=>{ if(r && r.id) have.set(r.id, c); }); });
    const cutoff = Date.now() - DELLOG_KEEP_MS;
    const toRemove = {};   // arrKey -> Set(id)
    for(const e of list){
      if(!e || !e.id || (e.ts && e.ts < cutoff)) continue;
      const c = have.get(e.id); if(!c) continue;
      try{
        const d = await shopColl(c.name).doc(e.id).get({source:'server'});
        if(d && d.exists) continue;            // ক্লাউডে আছে (ফিরিয়ে আনা হয়েছে) — ছোঁয়া হবে না
      }catch(err){ continue; }                  // অফলাইন/ত্রুটি — নিশ্চিত না হলে কিছু মোছা হবে না
      (toRemove[c.arrKey] = toRemove[c.arrKey] || new Set()).add(e.id);
    }
    LIVE_COLLECTIONS.forEach(c=>{
      const ids = toRemove[c.arrKey]; if(!ids || !ids.size) return;
      ids.forEach(id=>addTombstone(id));        // শুধু এই ফোনে — ক্লাউডে আবার লেখা হয় না
      const arr = (cur[c.arrKey]||[]).filter(r=>!(r && ids.has(r.id)));
      setLiveArray(c.arrKey, arr);
      save(c.dbKey, arr, true);
      removed += ids.size;
    });
    if(removed){
      try{ toast('🧹 মালিকের মোছা '+removed+'টা রেকর্ড এই ফোন থেকেও সরানো হয়েছে'); }catch(e){}
      try{ rerenderCurrentSection(); }catch(e){}
      try{ renderCustomers(); }catch(e){}
    }
  }catch(e){ console.error('applyDeleteLog failed', e); }
  _dlApplying = false;
  return removed;
}
function watchDeleteLog(db, shopCode){
  const unsub = db.collection('pharmacies').doc(shopCode).onSnapshot(snap=>{
    try{
      if(!snap || !snap.exists) return;
      try{ const _su = (snap.data()||{}).serverUsage; if(_su) localStorage.setItem('ssn_server_usage', JSON.stringify(_su)); }catch(e){}
      const list = (snap.data()||{}).delLog;
      if(Array.isArray(list) && list.length){
        applyDeleteLog(list);
        if(currentRole()==='owner'){
          const keep = list.filter(e=>e && e.ts && e.ts >= Date.now()-DELLOG_KEEP_MS);
          if(keep.length < list.length) db.collection('pharmacies').doc(shopCode).set({delLog: keep}, {merge:true}).catch(()=>{});
        }
      }
      if(currentRole()==='owner' && _dlPendGet().length) flushDeleteLog();
    }catch(e){ console.warn('delLog পড়া যায়নি', e); }
  }, err=>console.warn('delLog শোনা যায়নি', err));
  if(typeof liveListeners!=='undefined') liveListeners.push(unsub);
  return unsub;
}
// একবারের কাজ: আগে মোছা (রিসাইকেল বিনে আছে) রেকর্ডগুলোও কর্মচারীর ফোন থেকে সরানো — যেমন আগে মোছা "H"
async function broadcastTrashDeletes(){
  if(!requireOwnerRole('মোছার খবর পাঠানো')) return;
  try{
    if(!cloudReady()){ toast('আগে ক্লাউড সংযুক্ত করুন'); return; }
    const okKeys = new Set([DB_KEYS.customer, DB_KEYS.supplier, DB_KEYS.med, DB_KEYS.labTest, DB_KEYS.prescription, DB_KEYS.referrer, DB_KEYS.payment]);
    const items = await HistDB.getAll('trash');
    const ids = [...new Set(items.filter(it=>it && it.record && it.record.id && okKeys.has(it.key)).map(it=>it.record.id))];
    if(!ids.length){ toast('রিসাইকেল বিনে এমন কিছু নেই'); return; }
    if(!confirm('রিসাইকেল বিনে থাকা '+ids.length+'টা মোছা রেকর্ড (কাস্টমার, সাপ্লায়ার, ওষুধ ইত্যাদি) অন্য ফোন থেকেও সরানো হবে — শুধু যেগুলো ক্লাউডেও নেই। আপনার রিসাইকেল বিনের কিছু বদলাবে না। এগোবেন?')) return;
    const p = _dlPendGet(); const have = new Set(p.map(x=>x.id)); const now = Date.now();
    ids.forEach(id=>{ if(!have.has(id)) p.push({id:id, ts:now}); });
    _dlPendSet(p);
    await flushDeleteLog();
    toast('✓ '+ids.length+'টা মোছার খবর পাঠানো হয়েছে — অন্য ফোন অ্যাপ খুললে/অনলাইনে এলে মিলে যাবে');
  }catch(e){ console.error(e); toast('পাঠানো যায়নি'); }
}
