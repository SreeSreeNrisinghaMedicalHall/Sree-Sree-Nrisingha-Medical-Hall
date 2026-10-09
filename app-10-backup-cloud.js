/* ---------------- Backup / Restore ---------------- */
function exportData(){
  const data = { medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices, exportedAt:new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nrisingha-medical-backup-${todayStr()}.json`;
  a.click();
  toast('ব্যাকআপ ডাউনলোড হয়েছে ✓');
}

// ---- বাকি তালিকা ফাইল (অ্যাপ-নিরপেক্ষ সুরক্ষা কপি) ----
// A self-contained .html file listing every customer who owes money (name, mobile, amount) that
// opens in any browser with NO dependency on this app or its data — a safety net for the case
// where the app or its data is lost/corrupted (bad data can also sync to the cloud, and the JSON
// backup can't be read without the app). Downloaded automatically at most once a day after the
// owner unlocks, plus a manual button in Settings. Tiny (a few KB), so storage is a non-issue.
function localDateStr(d){ d=d||new Date(); const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function buildDueListHtml(){
  const shop = (document.querySelector('.brand-name') && document.querySelector('.brand-name').textContent.trim()) || 'শ্রী শ্রী নৃসিংহ মেডিকেল হল';
  const list = customers.filter(c=>(c.due||0)>0).sort((a,b)=>(b.due||0)-(a.due||0));
  const total = list.reduce((a,c)=>a+Math.round(c.due||0),0); // সারির মতোই গোল করা সংখ্যা যোগ — যাতে মোট ও সারির যোগফল একই হয়
  const now = new Date();
  const stamp = localDateStr(now)+' '+now.toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
  const _pIdxD = _buildPeopleIndex();
  const rows = list.map((c,i)=>{
    const tel = String(c.mobile||'').replace(/[^0-9+]/g,'');
    const _sp = _dueSplit(_pIdxD[c.id], c);
    const _ppTxt = _sp.others.length ? ('নামে আছে: ' + _sp.others.map(p=>escapeHtml(p.name)+' '+fmt(Math.round(p.rem))).join(' • ') + (_sp.own>0.5 ? ' • নিজে '+fmt(_sp.own) : '')) : '';
    const _pp = _ppTxt ? `<div class="pp">${_ppTxt}</div>` : '';
    const mob = tel ? `<a href="tel:${escapeHtml(tel)}">${escapeHtml(c.mobile)}</a>` : '<span class="nm">মোবাইল নেই</span>';
    const due = Math.round(c.due||0);
    return `<tr data-due="${due}"><td class="n">${i+1}</td><td><div class="nn">${escapeHtml(c.name||'—')}</div><div>${mob}</div>${_pp}</td><td class="a">${fmt(due)}</td><td class="k"><div class="pay"><input type="text" inputmode="numeric" placeholder="টাকা" onkeydown="if(event.key==='Enter')add(this)"><button type="button" class="all" onclick="add(this)">জমা</button></div><div class="pay"><button type="button" class="all" onclick="full(this)">বাকি সব</button><button type="button" class="all un" style="display:none" onclick="undo(this)">↶ বাতিল</button></div><div class="left">থাকল ${fmt(due)}</div><div class="hist"></div></td></tr>`;
  }).join('');
  const key = 'duelist_'+now.getTime();
  return `<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>বাকি তালিকা — ${escapeHtml(localDateStr(now))}</title>
<style>body{font-family:system-ui,-apple-system,"Noto Sans Bengali","Segoe UI",sans-serif;margin:0;padding:14px;background:#f5f5f0;color:#1a2b22}
h1{font-size:18px;margin:0 0 2px}.sub{font-size:12px;color:#555;margin-bottom:10px}
.sum{display:flex;gap:6px;margin:10px 0}.box{flex:1;background:#fff;border-radius:10px;padding:8px 9px;border:1px solid #ddd;font-size:12px}.box b{display:block;font-size:16px}
input.s{width:100%;box-sizing:border-box;padding:9px;border:1px solid #ccc;border-radius:8px;font-size:15px;margin-bottom:8px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}
th,td{padding:8px 6px;border-bottom:1px solid #eee;font-size:14px;text-align:left;vertical-align:top}th{background:#1b4d3e;color:#fff;font-size:13px}
td.n{color:#888;width:24px}td.a{text-align:right;font-weight:700;white-space:nowrap}td.k{width:150px}
.nn{font-weight:700}.nm{color:#999;font-size:12px}a{color:#1b4d3e;text-decoration:none;font-weight:600}
.pay{display:flex;gap:4px;margin-bottom:4px}.pay input{width:100%;min-width:0;box-sizing:border-box;padding:6px;border:1px solid #bbb;border-radius:6px;font-size:14px}
.all{padding:6px 8px;border:0;border-radius:6px;background:#e6efe9;color:#1b4d3e;font-weight:700;font-size:12px;white-space:nowrap}
.un{background:#fbe9e7;color:#a33}
.pp{font-size:12px;color:#7a5b00;margin-top:3px;line-height:1.45}.left{font-size:12px;color:#a33}.hist{font-size:11px;color:#777;margin-top:2px}
tr.part td{background:#fff8e1}tr.done td{background:#eaf5ee;color:#777}tr.done .nn{text-decoration:line-through}tr.done .left{color:#2a7a4b}
button.pr{padding:9px 14px;border:0;border-radius:8px;background:#c9a227;font-weight:700;font-size:14px}
.note{font-size:11px;color:#777;margin-top:10px;line-height:1.5}
@media print{.pay,button.pr,input.s{display:none}body{background:#fff}}</style></head><body>
<h1>${escapeHtml(shop)} — বাকি তালিকা</h1><div class="sub">তৈরি: ${escapeHtml(stamp)} • এই ফাইল অ্যাপ ছাড়াই খোলা যায়</div>
<div class="sum"><div class="box">মোট বাকি<b>${fmt(total)}</b></div><div class="box">আদায়<b id="got">৳0</b></div><div class="box">এখনো বাকি<b id="rem">${fmt(total)}</b></div></div>
<input class="s" id="q" placeholder="নাম বা মোবাইল দিয়ে খুঁজুন…" oninput="find()">
<table><thead><tr><th>#</th><th>কাস্টমার</th><th style="text-align:right">বাকি</th><th>আদায়</th></tr></thead><tbody id="tb">${rows || '<tr><td colspan="4">এই মুহূর্তে কারো বাকি নেই</td></tr>'}</tbody></table>
<p><button class="pr" onclick="window.print()">🖨 প্রিন্ট করুন</button></p>
<div class="note">যত টাকা পেলেন ঘরে লিখে "জমা" চাপুন — ঘর খালি হয়ে যাবে, আবার কখনো আরও টাকা পেলে একইভাবে যোগ করুন। ভুল হলে "↶ বাতিল" দিয়ে শেষ জমাটা তুলে ফেলুন। পুরোটা পেলে "বাকি সব" চাপুন। এটা শুধু এই ফাইলে মিলিয়ে দেখার জন্য, অ্যাপের হিসাবে আপনাকে আলাদা করে জমা তুলতে হবে। এটি ${escapeHtml(stamp)} সময়ের কপি, এর পরের লেনদেন এতে নেই।</div>
<script>
var KEY=${JSON.stringify(key)},PAY={};
function fm(n){return '৳'+Math.round(n).toLocaleString('en-US')}
function num(v){var m='০১২৩৪৫৬৭৮৯',o='';for(var i=0;i<v.length;i++){var k=m.indexOf(v.charAt(i));o+=k>-1?String(k):v.charAt(i)}o=o.split(',').join('');var n=parseFloat(o);return isNaN(n)||n<0?0:Math.round(n)}
function sum(a){var t=0;for(var i=0;i<a.length;i++)t+=a[i];return t}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(PAY))}catch(e){}}
function render(r){var due=+r.dataset.due,a=PAY[r.rowIndex]||[],p=sum(a);
r.classList.toggle('done',p>=due&&due>0);r.classList.toggle('part',p>0&&p<due);
r.querySelector('.left').textContent=p>=due?'✓ পুরো আদায় ('+fm(p)+')':(p>0?'আদায় '+fm(p)+' • থাকল '+fm(due-p):'থাকল '+fm(due));
r.querySelector('.hist').textContent=a.length>1?'জমা: '+a.join(' + '):'';
r.querySelector('.un').style.display=a.length?'':'none'}
function recalc(){var g=0,t=0;document.querySelectorAll('#tb tr[data-due]').forEach(function(r){g+=sum(PAY[r.rowIndex]||[]);t+=+r.dataset.due});document.getElementById('got').textContent=fm(g);document.getElementById('rem').textContent=fm(t-g)}
function push(r,v){var a=PAY[r.rowIndex]||(PAY[r.rowIndex]=[]);var rem=+r.dataset.due-sum(a);if(v>rem)v=rem;if(v>0)a.push(v)}
function add(el){var r=el.closest('tr'),inp=r.querySelector('input');push(r,num(inp.value));inp.value='';persist();render(r);recalc()}
function full(el){var r=el.closest('tr');push(r,+r.dataset.due);persist();render(r);recalc()}
function undo(el){var r=el.closest('tr'),a=PAY[r.rowIndex]||[];a.pop();persist();render(r);recalc()}
function find(){var q=document.getElementById('q').value.toLowerCase();document.querySelectorAll('#tb tr').forEach(function(r){r.style.display=r.textContent.toLowerCase().indexOf(q)>-1?'':'none'})}
try{PAY=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){PAY={}}
document.querySelectorAll('#tb tr[data-due]').forEach(function(r){render(r)});recalc();
<\/script></body></html>`;
}
function dueListFingerprint(){
  const str = customers.filter(c=>(c.due||0)>0).map(c=>[c.id,c.name||'',c.mobile||'',Math.round(c.due||0)].join('|')).sort().join('#');
  if(!str) return '';
  let h = 5381; for(let i=0;i<str.length;i++){ h = ((h<<5)+h + str.charCodeAt(i))|0; }
  return String(h);
}
function downloadDueList(auto){
  if(!requireOwnerRole('বাকি তালিকা ডাউনলোড করা')) return;
  try{
    const fp = dueListFingerprint();
    const html = buildDueListHtml();
    const blob = new Blob([html], {type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const n = new Date(), p2 = x=>String(x).padStart(2,'0');
    a.download = `nrisingha-baki-list-${localDateStr(n)}-${p2(n.getHours())}${p2(n.getMinutes())}.html`;
    document.body.appendChild(a); a.click(); a.remove();
    localStorage.setItem('ssn_duelist_last', localDateStr()+' '+new Date().toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'}));
    localStorage.setItem('ssn_duelist_fp', fp);
    updateDueListStatus(); hideDueListBar(false);
    toast(auto ? '✓ বাকি তালিকার কপি ফোনে সেভ হয়েছে (Downloads)' : 'বাকি তালিকা ডাউনলোড হয়েছে ✓');
  }catch(e){ console.error(e); toast('বাকি তালিকা তৈরিতে সমস্যা হয়েছে'); }
}
function updateDueListStatus(){
  const el = document.getElementById('dueListStatus'); if(!el) return;
  const last = localStorage.getItem('ssn_duelist_last');
  el.textContent = last ? 'শেষ ডাউনলোড: '+last : 'এখনো ডাউনলোড করা হয়নি';
}
// The saved file is only a snapshot, so the bar appears whenever the বাকি list has CHANGED since the
// last save (a new বাকি given, a payment taken, a name/number edited) — checked at unlock and after
// every customer-data change — not just once a day. A silent auto-download isn't possible (browsers
// block downloads not tied to a tap), so the save itself stays one tap on the dashboard tile.
function maybeAutoDownloadDueList(){
  try{
    if(currentRole()!=='owner'){ hideDueListBar(); return; }
    const fp = dueListFingerprint();
    const saved = localStorage.getItem('ssn_duelist_fp');
    if(saved===null) { if(!fp) return; }
    else if(!fp && !saved) return;
    if(fp===(saved||'')){ hideDueListBar(false); return; }
    showDueListBar();
  }catch(e){ console.error(e); }
}
let _dueListTimer = null;
function scheduleDueListCheck(){ clearTimeout(_dueListTimer); _dueListTimer = setTimeout(maybeAutoDownloadDueList, 800); }
// The prompt lives in the free space beside "আজকের আনুমানিক লাভ" on the dashboard (instead of a floating
// bar that covered other tabs): when a fresh save is needed, that card shrinks to half width and the
// "বাকি তালিকা সেভ করুন" tile takes the other half; otherwise the profit card is full width as before.
function showDueListBar(){
  const tile = document.getElementById('dueListTile'), card = document.getElementById('dProfitCard');
  if(!tile || !card) return;
  card.style.gridColumn = 'span 1';
  tile.style.display = '';
}
function hideDueListBar(){
  const tile = document.getElementById('dueListTile'), card = document.getElementById('dProfitCard');
  if(tile) tile.style.display = 'none';
  if(card) card.style.gridColumn = 'span 2';
}
// Any save of customer data (new বাকি from a sale, a payment, an edit, a cloud update) re-checks freshness.
(function(){
  const orig = save;
  save = function(key, data, fromCloud){
    const r = orig.apply(this, arguments);
    try{ if(key===DB_KEYS.customer) scheduleDueListCheck(); }catch(e){}
    return r;
  };
})();
function importData(evt){
  const file = evt.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async e=>{
    try{
      const data = JSON.parse(e.target.result);
      if(!data || typeof data!=='object' || !LIVE_COLLECTIONS.some(c=>Array.isArray(data[c.arrKey]))){ toast('ফাইলটি সঠিক ব্যাকআপ নয়'); return; }
      await safeRestore(data, 'ব্যাকআপ ফাইল', {incomingWins:false});
      showSection('dashboard'); cloudPush();
    }catch(err){ console.error(err); toast('ফাইলটি সঠিক নয়'); }
    try{ evt.target.value=''; }catch(e2){}
  };
  reader.readAsText(file);
}

/* ---------------- Cloud Sync (Firebase, optional) ---------------- */
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
let cloudDb = null;
let liveListeners = [];
async function initCloud(){
  const cfgText = localStorage.getItem('ssn_cloud_config');
  if(!cfgText) return null;
  // Check for an already-initialized cloudDb BEFORE the navigator.onLine check — this used to be
  // reversed, which meant: app opens online, cloudDb gets created fine; connection drops; any
  // write attempted while offline calls initCloud() again, hits "if(!navigator.onLine) return
  // null" first, and gets null back even though a perfectly good cloudDb instance already exists.
  // That's what silently dropped a purchase/medicine-price update made while offline — the write
  // never even reached the Firestore SDK's own offline queue, so it just vanished, and going back
  // online, the realtime listener's snapshot (still the old cloud value) overwrote the local
  // "fixed" record right back to missing/৳০. Reusing the cached cloudDb regardless of online
  // status lets Firestore's own offline write queue do its job.
  if(cloudDb) return cloudDb;
  // আগে এখানে অফলাইনে সরাসরি null ফেরত যেত — তাই অ্যাপ ইন্টারনেট ছাড়া শুরু হলে ক্লাউড-সংযোগই তৈরি হতো না,
  // আর সেই সময়ের বিক্রয়/জমা শুধু ওই ফোনেই থেকে যেত (কখনো ক্লাউডে যেত না)। এখন Firebase-এর স্ক্রিপ্ট ফোনে জমা থাকলে
  // অফলাইনেও সংযোগ তৈরি হয় — Firestore নিজে লেখাগুলো লাইনে রাখে ও ইন্টারনেট ফিরলে পাঠিয়ে দেয়।
  // স্ক্রিপ্ট জমা না থাকলে আগের মতোই চুপচাপ null ফেরত যায়।
  try{
    if(!window.firebase){
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');
    }
    const cfg = JSON.parse(cfgText);
    if(!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
    cloudDb = firebase.firestore();
    // Lets Firestore itself cache data and QUEUE writes in IndexedDB so they survive the app
    // being closed/reopened while offline (spotty network), not just a brief mid-session drop.
    // Safe to ignore failure (e.g. multiple tabs open) — writes still queue in-memory for this
    // session either way, just won't survive a full app close until persistence succeeds later.
    try{ await cloudDb.enablePersistence({synchronizeTabs:true}); }catch(e){ console.warn('অফলাইন পার্সিস্টেন্স চালু করা যায়নি', e); }
    return cloudDb;
  }catch(e){ if(!navigator.onLine){ console.warn('অফলাইনে ক্লাউড শুরু করা যায়নি (স্ক্রিপ্ট জমা নেই)'); return null; } console.error(e); const msg='সংযোগ ব্যর্থ: '+(e&&e.message?e.message:'স্ক্রিপ্ট লোড হয়নি (ইন্টারনেট চেক করুন)'); localStorage.setItem('ssn_last_sync_error', msg); toast('ক্লাউড সংযোগে সমস্যা — ইন্টারনেট/কনফিগ চেক করুন'); updateCloudStatus(); return null; }
}
function shopColl(name){
  const shopCode = localStorage.getItem('ssn_shop_code');
  if(!cloudDb || !shopCode) return null;
  return cloudDb.collection('pharmacies').doc(shopCode).collection(name);
}
// Whether a write can be handed to Firestore right now. Deliberately NOT the same as `cloudLive`
// (which only means "the realtime listeners are currently attached" and flips false the instant
// navigator 'offline' fires) — a write made while cloudLive is false but cloudDb still exists is
// exactly the offline-purchase-entry case above: Firestore's SDK queues it and sends it once the
// network actually returns, so gating writes on cloudDb (not cloudLive) is what lets that happen.
function cloudReady(){ return !!(cloudDb && localStorage.getItem('ssn_shop_code')); }
const ARCHIVE_AGE_MS = 365*24*60*60*1000; // 1 year — records older than this are eligible to be archived out of local storage (see archiveOldRecords() below), so their real-time listener only tracks what's actually still meant to be local.
const LIVE_COLLECTIONS = [
  {name:'medicines', arrKey:'medicines', dbKey:DB_KEYS.med},
  {name:'sales', arrKey:'sales', dbKey:DB_KEYS.sale, recentOnlyField:'ts'},
  {name:'purchases', arrKey:'purchases', dbKey:DB_KEYS.purchase, recentOnlyField:'ts'},
  {name:'customers', arrKey:'customers', dbKey:DB_KEYS.customer},
  {name:'suppliers', arrKey:'suppliers', dbKey:DB_KEYS.supplier},
  {name:'payments', arrKey:'payments', dbKey:DB_KEYS.payment},
  {name:'labTests', arrKey:'labTests', dbKey:DB_KEYS.labTest},
  {name:'prescriptions', arrKey:'prescriptions', dbKey:DB_KEYS.prescription},
  {name:'referrers', arrKey:'referrers', dbKey:DB_KEYS.referrer},
  {name:'testPrices', arrKey:'testPrices', dbKey:DB_KEYS.testPrice}
];
function setLiveArray(key, arr){
  switch(key){
    case 'medicines': medicines = arr; break;
    case 'sales': sales = arr; break;
    case 'purchases': purchases = arr; break;
    case 'customers': customers = arr; break;
    case 'suppliers': suppliers = arr; break;
    case 'payments': payments = arr; break;
    case 'labTests': labTests = arr; break;
    case 'prescriptions': prescriptions = arr; break;
    case 'referrers': referrers = arr; break;
    case 'testPrices': testPrices = arr; break;
  }
}
function rerenderCurrentSection(){
  // Only re-render the dashboard's own numbers when it's actually the visible section — it does
  // several full sales/medicines scans (incl. a per-item medicine lookup), so recomputing it on
  // every single background data change (e.g. each of the ~10 cloud collections syncing in on
  // app open) while the person is looking at a completely different tab was pure wasted work,
  // and a real contributor to the app feeling slow to open.
  if(currentSection==='dashboard') renderDashboard();
  if(currentSection==='medicines') renderMedicines();
  if(currentSection==='purchase'){ renderPurchaseSelects(); renderPurchases(); }
  if(currentSection==='customers'){ try{renderCustomers();}catch(e){console.error(e);} try{renderSuppliers();}catch(e){console.error(e);} }
  if(currentSection==='reports') renderReports();
  if(currentSection==='sale'){ renderSaleCustomerSelect(); }
  if(currentSection==='test') renderLabTestList();
  if(currentSection==='prescription') renderPrescriptionList();
  if(document.getElementById('referrerListModalBackdrop')?.classList.contains('show')) renderReferrerList();
  if(document.getElementById('testPriceListModalBackdrop')?.classList.contains('show')) renderTestPriceList();
}
// The cloud sync in attachRealtimeListeners() below attaches one onSnapshot listener per
// collection (10 of them) — on first connect (e.g. right when the app opens) they all fire
// together within milliseconds of each other. Calling rerenderCurrentSection() straight from
// each one meant up to 10 back-to-back full re-renders of whatever's on screen in that first
// moment. This collapses that burst into a single re-render once the burst settles.
let _rerenderDebounceTimer = null;
function scheduleRerender(){
  clearTimeout(_rerenderDebounceTimer);
  _rerenderDebounceTimer = setTimeout(rerenderCurrentSection, 150);
}
async function migrateLegacyIfNeeded(db, shopCode){
  try{
    const legacyDoc = await db.collection('pharmacies').doc(shopCode).get();
    if(!legacyDoc.exists) return;
    const data = legacyDoc.data();
    for(const c of LIVE_COLLECTIONS){
      const arr = data[c.arrKey];
      if(!Array.isArray(arr) || !arr.length) continue;
      const existing = await shopColl(c.name).limit(1).get();
      if(!existing.empty) continue;
      const batch = db.batch();
      arr.forEach(item=>{ const ref = shopColl(c.name).doc(item.id||uid()); batch.set(ref, item); });
      await batch.commit();
    }
  }catch(e){ console.error('migration error', e); }
}

// ===== এই ফোনে আছে কিন্তু ক্লাউডে নেই — দেখে বেছে ক্লাউডে পাঠানো =====
// অফলাইনে করা বিক্রয়/জমা/ক্রয় যদি কোনো কারণে ক্লাউডে না পৌঁছে থাকে (যেমন ইন্টারনেট ছাড়া অ্যাপ খুলে কাজ করলে),
// এখানে শেষ ১৪ দিনের এমন রেকর্ড দেখায়। আপনি দেখে টিক দিয়ে বেছে পাঠাবেন — নিজে থেকে কিছু পাঠায় না
// (কারণ অন্য ফোনে মোছা কোনো রেকর্ড ভুলে ফিরে আসতে পারে)।
async function openPendingUploads(){
  try{
    if(!localStorage.getItem('ssn_shop_code')){ toast('আগে ক্লাউড সংযোগ করুন'); return; }
    if(!navigator.onLine){ toast('ইন্টারনেট চালু করে আবার চাপুন'); return; }
    if(!cloudReady()) await attachRealtimeListeners();
    if(!cloudReady()){ toast('ক্লাউডের সাথে সংযোগ হয়নি'); return; }
    toast('ক্লাউডের সাথে মিলিয়ে দেখা হচ্ছে…');
    const cutoff = Date.now() - 14*86400000;
    const tomb = new Set(getTombstones().map(t=>t.id));
    const kinds = [ {name:'sales', arr:sales}, {name:'payments', arr:payments}, {name:'purchases', arr:purchases} ];
    const found = [];
    for(const k of kinds){
      const local = k.arr.filter(r=>r && r.id && (r.ts||0) > cutoff && !tomb.has(r.id));
      if(!local.length) continue;
      const snap = await shopColl(k.name).where('ts','>',cutoff).get({source:'server'});
      const ids = new Set(snap.docs.map(d=>d.id));
      local.forEach(r=>{ if(!ids.has(r.id)) found.push({k, r}); });
    }
    found.sort((x,y)=>(y.r.ts||0)-(x.r.ts||0));
    const custName = id=>{ const c = customers.find(x=>x.id===id); return c ? c.name : ''; };
    const describe = ({k,r})=>{
      const when = r.date || '';
      if(k.name==='sales') return {t:'বিক্রয়: '+escapeHtml(r.customerName||'ওয়াক-ইন')+(r.patientName?' • রোগী: '+escapeHtml(r.patientName):''), s:when+' • '+(r.items||[]).length+' আইটেম', a:r.total};
      if(k.name==='purchases') return {t:'ক্রয়: '+escapeHtml(r.medicineName||''), s:when+' • '+r.qty+' × '+fmt(r.price), a:(r.qty||0)*(r.price||0)};
      const typ = r.type==='expense' ? 'খরচ: '+escapeHtml(r.note||'') : r.type==='due_adjustment' ? 'বাকি যোগ: '+escapeHtml(custName(r.customerId)) : r.type==='supplier_payment' ? 'সাপ্লায়ার পরিশোধ' : r.type==='referrer_commission' ? 'কমিশন পরিশোধ' : 'জমা: '+escapeHtml(custName(r.customerId));
      return {t:typ, s:when, a:r.amount};
    };
    const ov = _supOverlay(`
      <div style="font-weight:800;font-size:17px;">☁️ ক্লাউডে নেই এমন রেকর্ড</div>
      <div class="row-sub" style="margin:4px 0 8px;">শেষ ১৪ দিনের যে রেকর্ডগুলো এই ফোনে আছে কিন্তু ক্লাউডে পাওয়া যায়নি। যেগুলো পাঠাতে চান টিক দিন (বিক্রয় পাঠালে ক্লাউডের স্টকও কমবে)।</div>
      ${found.length ? found.map((f,i)=>{ const d = describe(f); return `<label style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed #ddd;"><input type="checkbox" data-i="${i}" checked style="width:20px;height:20px;flex:none;"><div style="min-width:0;flex:1;overflow-wrap:anywhere;"><div style="font-weight:600;">${d.t}</div><div class="row-sub">${d.s}</div></div><b style="white-space:nowrap;">${fmt(d.a||0)}</b></label>`; }).join('') : '<div class="empty-state">✅ সব রেকর্ড ক্লাউডে আছে — কিছু পাঠানোর নেই</div>'}
      ${found.length ? '<button id="pendSend" class="btn btn-primary btn-block" style="margin-top:12px;">টিক দেওয়াগুলো ক্লাউডে পাঠান</button>' : ''}
      <button id="pendClose" class="btn btn-block" style="margin-top:8px;background:#f1f1f1;">বন্ধ করুন</button>`);
    ov.querySelector('#pendClose').onclick = ()=>ov.remove();
    const sendBtn = ov.querySelector('#pendSend');
    if(sendBtn) sendBtn.onclick = async ()=>{
      sendBtn.disabled = true; sendBtn.textContent = 'পাঠানো হচ্ছে…';
      const chosen = [...ov.querySelectorAll('input[type=checkbox][data-i]:checked')].map(c=>found[+c.dataset.i]);
      let ok = 0, fail = 0;
      for(const {k,r} of chosen){
        try{
          if(r.customerId){   // রেকর্ডে যে কাস্টমারের কথা আছে সে ক্লাউডে না থাকলে আগে তাকেও পাঠাই
            const cd = await shopColl('customers').doc(r.customerId).get();
            if(!cd.exists){ const loc = customers.find(c=>c.id===r.customerId); if(loc) await shopColl('customers').doc(loc.id).set(Object.assign({}, loc)); }
          }
          await shopColl(k.name).doc(r.id).set(Object.assign({}, r));
          const inc = (id, n)=>shopColl('medicines').doc(id).update({stock: firebase.firestore.FieldValue.increment(n)}).catch(e=>console.warn('stock update skipped', id, e));
          if(k.name==='sales'){ for(const it of (r.items||[])) if(it.id) await inc(it.id, -(it.qty||0)); }
          if(k.name==='purchases' && r.medicineId) await inc(r.medicineId, (r.qty||0));
          ok++;
        }catch(e){ console.error(e); fail++; }
      }
      ov.remove();
      toast(ok+'টা ক্লাউডে পাঠানো হয়েছে ✓'+(fail?(' • '+fail+'টা ব্যর্থ — আবার চেষ্টা করুন'):''));
    };
  }catch(e){ console.error(e); toast('মেলানো যায়নি: '+(e&&e.message?e.message:e)); }
}
async function attachRealtimeListeners(){
  const db = await initCloud();
  const shopCode = localStorage.getItem('ssn_shop_code');
  if(!db || !shopCode) return;
  liveListeners.forEach(unsub=>unsub());
  liveListeners = [];
  await migrateLegacyIfNeeded(db, shopCode);
  LIVE_COLLECTIONS.forEach(c=>{
    // sales/purchases only listen for records newer than the archive cutoff — otherwise this
    // listener would re-fetch the FULL cloud collection (including anything archiveOldRecords()
    // just removed locally) on every single change anywhere in the shop, from any device, and
    // save()'s own merge-back-missing-records safety net would immediately undo the archive by
    // treating the "missing" old records as a stale write to recover from. Anything genuinely
    // still local-only and un-archived (not in this filtered query, not tombstoned) is still
    // preserved by that same merge-back logic — it's just no longer redundantly re-fetched.
    const query = c.recentOnlyField ? shopColl(c.name).where(c.recentOnlyField, '>', Date.now()-ARCHIVE_AGE_MS) : shopColl(c.name);
    const unsub = query.onSnapshot(snapshot=>{
      const arr = snapshot.docs.map(d=>({ id:d.id, ...d.data() }));
      if(c.name==='customers'){
        // Beyond the timing-based LOCAL_WRITE_GRACE_MS protection above, a customer's মোবাইল/
        // ঠিকানা/অভিভাবক once saved locally should never be silently blanked out just because an
        // incoming cloud snapshot happens to be missing it (e.g. an older/legacy copy of the
        // record from before that field was ever added). Losing saved contact info this way is
        // far worse than briefly keeping a value the cloud hasn't caught up on — a genuine,
        // deliberate clearing of the field on THIS device still goes through normally, since
        // this device's own save() already wrote '' locally before this snapshot ever arrives.
        try{
          const localCur = JSON.parse(localStorage.getItem(c.dbKey))||[];
          const localById = {}; localCur.forEach(rec=>{ if(rec&&rec.id) localById[rec.id]=rec; });
          arr.forEach(rec=>{
            const loc = localById[rec.id];
            if(!loc) return;
            ['mobile','address','guardian'].forEach(f=>{ if(!rec[f] && loc[f]) rec[f] = loc[f]; });
          });
        }catch(fieldGuardErr){ console.error('customer field-protect failed', fieldGuardErr); }
      }
      setLiveArray(c.arrKey, arr);
      // Save the REAL data (with cost prices intact) first — stripCostPriceForStaff() must only
      // ever affect what's in memory for THIS session's screen, never what gets written to
      // localStorage. It used to run before save() here, which meant every cloud sync on a
      // staff-role session permanently deleted every medicine's ক্রয়মূল্য from local storage
      // (and from the local safety snapshots, since those are taken right after save()) — with
      // no cloud-side damage (this never pushes to Firestore) but real local corruption that
      // even a snapshot restore couldn't fix, since the snapshots were corrupted too. See the
      // পয়সা/লাভ NaN bug this caused.
      save(c.dbKey, arr, true);
      if(c.name==='customers'||c.name==='sales'||c.name==='payments') scheduleDueReconcile(c.name);
      if(c.name==='medicines') stripCostPriceForStaff();
      scheduleRerender();
    }, err=>{ console.error(err); });
    liveListeners.push(unsub);
  });
  cloudLive = true;
  localStorage.setItem('ssn_last_sync', Date.now());
  localStorage.removeItem('ssn_last_sync_error');
  updateCloudStatus();
  setTimeout(()=>autoDailyCloudBackup(false), 25000);
  try{ attachPhotoListener(); }catch(e){ console.error(e); }
}
// ===== স্বয়ংক্রিয় দৈনিক ক্লাউড ব্যাকআপ (আলাদা তারিখওয়ালা কপি, ১৪ দিন রাখা হয়) =====
// রিয়েল-টাইম সিঙ্ক ক্লাউডে "একটাই বর্তমান অবস্থা" রাখে — তাই কোনো ভুল/নষ্ট ডাটা সিঙ্ক হয়ে গেলে ক্লাউডেও সেটাই থাকে।
// এই ব্যাকআপ আলাদা জায়গায় (pharmacies/{shop}/backups) প্রতিদিনের আলাদা কপি জমা রাখে, সিঙ্ক এগুলোতে হাত দেয় না।
// শুধু মালিকের সেশনে চলে (স্টাফ সেশনে ক্রয়মূল্য মেমোরি থেকে সরানো থাকে, সেই অসম্পূর্ণ ডাটা ব্যাকআপ হবে না)।
const AUTO_BACKUP_KEEP_DAYS = 14;
const AUTO_BACKUP_CHUNK = 200000; // অক্ষর — বাংলা অক্ষর ৩ বাইট, তাই Firestore-এর ১MB ডকুমেন্ট সীমার অনেক নিচে
let _autoBackupBusy = false;
function setAutoBackupInfo(html, bad){
  const el = document.getElementById('autoBackupInfo'); if(!el) return;
  el.innerHTML = html; el.style.background = bad ? 'var(--red-soft)' : 'var(--green-soft,#e8f5e9)';
}
function refreshAutoBackupInfo(){
  const d = localStorage.getItem('ssn_last_auto_backup_date');
  const err = localStorage.getItem('ssn_last_auto_backup_error');
  if(err) setAutoBackupInfo('⚠️ স্বয়ংক্রিয় ব্যাকআপ ব্যর্থ: '+escapeHtml(err)+(d?' • শেষ সফল: '+d:''), true);
  else if(d) setAutoBackupInfo('🛡 স্বয়ংক্রিয় দৈনিক ব্যাকআপ চালু • শেষ সফল: <b>'+d+'</b> • শেষ '+AUTO_BACKUP_KEEP_DAYS+' দিনের কপি ক্লাউডে থাকে।', false);
}
async function autoDailyCloudBackup(force){
  if(_autoBackupBusy) return;
  try{
    if(!cloudReady() || !navigator.onLine || currentRole()!=='owner') return;
    const today = todayStr();
    if(!force && localStorage.getItem('ssn_last_auto_backup_date')===today) return;
    if(!medicines.length && !sales.length && !customers.length) return; // খালি অবস্থা ব্যাকআপ করার মানে নেই
    _autoBackupBusy = true;
    const payload = JSON.stringify({ medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices });
    const total = Math.ceil(payload.length / AUTO_BACKUP_CHUNK);
    const coll = shopColl('backups');
    for(let i=0;i<total;i++){
      await coll.doc(today+'_'+i).set({ kind:'part', date:today, idx:i, part:payload.slice(i*AUTO_BACKUP_CHUNK,(i+1)*AUTO_BACKUP_CHUNK) });
    }
    // meta সবশেষে লেখা হয় — মাঝপথে থেমে গেলে অসম্পূর্ণ কপি তালিকায় আসে না
    await coll.doc(today+'_meta').set({ kind:'meta', date:today, ts:Date.now(), parts:total, m:medicines.length, s:sales.length, c:customers.length });
    localStorage.setItem('ssn_last_auto_backup_date', today);
    localStorage.removeItem('ssn_last_auto_backup_error');
    // পুরনো কপি মোছা
    try{
      const cutoff = new Date(Date.now()-AUTO_BACKUP_KEEP_DAYS*86400000).toISOString().slice(0,10);
      const old = await coll.where('date','<',cutoff).get();
      for(const d of old.docs){ await d.ref.delete(); }
    }catch(e){ console.error('old backup cleanup failed', e); }
    refreshAutoBackupInfo();
  }catch(e){
    console.error('auto backup failed', e);
    localStorage.setItem('ssn_last_auto_backup_error', (e&&e.code?e.code+': ':'')+(e&&e.message?e.message:'অজানা সমস্যা'));
    refreshAutoBackupInfo();
  }finally{ _autoBackupBusy = false; }
}
setInterval(()=>{ autoDailyCloudBackup(false); }, 3*60*60*1000);
window.addEventListener('online', ()=>{ setTimeout(()=>autoDailyCloudBackup(false), 5000); });
setTimeout(refreshAutoBackupInfo, 1500);

async function openCloudBackupList(){
  if(!cloudReady()){ toast('আগে ক্লাউড সংযোগ করুন'); return; }
  if(!requireOwnerRole('ব্যাকআপ থেকে ফেরানো')) return;
  let bd = document.getElementById('cloudBackupBackdrop');
  if(!bd){ bd = document.createElement('div'); bd.id='cloudBackupBackdrop'; bd.className='modal-backdrop'; bd.style.zIndex = 70; document.body.appendChild(bd); }
  bd.innerHTML = '<div class="modal"><div class="modal-head"><h4>🗓 স্বয়ংক্রিয় ব্যাকআপ</h4><button class="modal-close" onclick="document.getElementById(\'cloudBackupBackdrop\').classList.remove(\'show\')">✕</button></div><div id="cloudBackupRows" class="row-sub">লোড হচ্ছে…</div></div>';
  bd.classList.add('show');
  try{
    const snap = await shopColl('backups').where('kind','==','meta').get();
    const list = snap.docs.map(d=>d.data()).sort((a,b)=>b.date.localeCompare(a.date));
    const wrap = document.getElementById('cloudBackupRows');
    if(!list.length){ wrap.textContent = 'এখনো কোনো স্বয়ংক্রিয় ব্যাকআপ জমা হয়নি — ক্লাউড চালু থাকলে অ্যাপ খোলা অবস্থায় আজই একটা হবে।'; return; }
    wrap.innerHTML = '<div style="margin-bottom:8px;">যেদিনের অবস্থা দরকার তাতে চাপুন। ফোনের এখনকার কোনো রেকর্ড মোছা হবে না, শুধু হারানো/বদলে যাওয়া তথ্য ওই দিনের মতো ফিরবে।</div>' +
      list.map(m=>`<div class="row-item" style="padding:10px;cursor:pointer;" onclick="restoreCloudBackup('${m.date}')"><div><div class="row-title" style="font-size:13.5px;">${m.date}</div><div class="row-sub">ওষুধ ${m.m} • বিক্রয় ${m.s} • কাস্টমার ${m.c}</div></div></div>`).join('');
  }catch(e){ console.error(e); document.getElementById('cloudBackupRows').textContent = 'তালিকা আনা যায়নি: '+(e&&e.message?e.message:e); }
}
async function restoreCloudBackup(date){
  try{
    if(!confirm(date+'-এর স্বয়ংক্রিয় ব্যাকআপ থেকে ফেরাবেন?\n\nফোনের এখনকার অবস্থাও আগে একটা রিস্টোর পয়েন্ট হিসেবে জমা থাকবে, আর কোনো রেকর্ড মোছা হবে না।')) return;
    toast('ব্যাকআপ আনা হচ্ছে…');
    const snap = await shopColl('backups').where('date','==',date).get();
    const parts = snap.docs.map(d=>d.data()).filter(x=>x.kind==='part').sort((a,b)=>a.idx-b.idx);
    const meta = snap.docs.map(d=>d.data()).find(x=>x.kind==='meta');
    if(!meta || parts.length!==meta.parts){ toast('এই ব্যাকআপ অসম্পূর্ণ — অন্য তারিখ বেছে নিন'); return; }
    const data = JSON.parse(parts.map(x=>x.part).join(''));
    document.getElementById('cloudBackupBackdrop').classList.remove('show');
    await safeRestore(data, 'স্বয়ংক্রিয় ব্যাকআপ '+date, {incomingWins:true});
  }catch(e){ console.error(e); toast('ব্যাকআপ থেকে ফেরানো যায়নি: '+(e&&e.message?e.message:e)); }
}
async function cloudPush(){
  const shopCode = localStorage.getItem('ssn_shop_code');
  if(!shopCode) return;
  const db = await initCloud(); if(!db) return;
  try{
    await db.collection('pharmacies').doc(shopCode).set({
      medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices, updatedAt: Date.now()
    });
    localStorage.setItem('ssn_last_sync', Date.now());
    localStorage.removeItem('ssn_last_sync_error');
    updateCloudStatus();
    toast('ব্যাকআপ সফল হয়েছে ✓');
  }catch(e){ console.error(e); const msg=(e&&e.message?e.message:'অজানা সমস্যা'); localStorage.setItem('ssn_last_sync_error', msg); toast('ব্যাকআপ ব্যর্থ — নিচে কারণ দেখুন'); updateCloudStatus(); }
}
async function cloudPull(){
  if(cloudLive){ toast('রিয়েল-টাইম সিঙ্ক ইতিমধ্যে চালু আছে — ডাটা এমনিতেই সবসময় সবশেষ'); return; }
  const shopCode = localStorage.getItem('ssn_shop_code');
  if(!shopCode){ toast('আগে ক্লাউড সংযোগ করুন'); return; }
  const db = await initCloud(); if(!db) return;
  try{
    const doc = await db.collection('pharmacies').doc(shopCode).get();
    if(!doc.exists){ toast('ক্লাউডে এই কোডে কোনো ডাটা পাওয়া যায়নি'); return; }
    const data = doc.data();
    await safeRestore(data, 'ক্লাউড', {incomingWins:false});
    localStorage.setItem('ssn_last_sync', Date.now());
    updateCloudStatus(); showSection('dashboard');
  }catch(e){ console.error(e); toast('পুনরুদ্ধার ব্যর্থ — ইন্টারনেট/কনফিগ চেক করুন'); }
}
function saveCloudConfig(){
  const shopCode = document.getElementById('cloudShopCode').value.trim();
  const cfgText = document.getElementById('cloudConfigInput').value.trim();
  if(!shopCode || !cfgText){ toast('দুটো ফিল্ডই পূরণ করুন'); return; }
  try{
    JSON.parse(cfgText);
    localStorage.setItem('ssn_cloud_config', cfgText);
    localStorage.setItem('ssn_shop_code', shopCode);
    cloudDb = null;
    closeModal('cloudModalBackdrop');
    toast('সংযুক্ত হচ্ছে — রিয়েল-টাইম সিঙ্ক চালু হচ্ছে...');
    attachRealtimeListeners();
  }catch(e){ toast('Config ফরম্যাট সঠিক নয় (JSON আকারে পেস্ট করুন)'); }
}
function updateCloudStatus(){
  const el = document.getElementById('cloudStatus'); if(!el) return;
  const shopCode = localStorage.getItem('ssn_shop_code');
  const last = localStorage.getItem('ssn_last_sync');
  const err = localStorage.getItem('ssn_last_sync_error');
  if(!shopCode){ el.innerHTML = '<span class="badge badge-red">সংযুক্ত নয়</span>'; return; }
  // The shop code is effectively a second secret alongside the PIN (anyone who has it can
  // connect a brand new device to this shop's data). Per the owner's own instruction, this never
  // reveals the real code on screen at all — he keeps it written down elsewhere — so it's always
  // masked here, with no reveal option, not even on tap.
  const codeDisplay = '•'.repeat(Math.min(shopCode.length,14));
  el.innerHTML = `<span class="badge badge-green">${cloudLive?'রিয়েল-টাইম সিঙ্ক চালু':'সংযুক্ত'} • কোড: <span style="letter-spacing:1px;">${codeDisplay}</span></span>` +
    (last ? `<div class="row-sub" style="margin-top:5px;">শেষ আপডেট: ${new Date(parseInt(last)).toLocaleString('bn-BD')}</div>` : `<div class="row-sub" style="margin-top:5px;">এখনো সিঙ্ক হয়নি</div>`) +
    (err ? `<div class="row-sub" style="margin-top:6px;color:var(--red);background:var(--red-soft);padding:8px 10px;border-radius:8px;">এরর: ${err}</div>` : '');
}
// ===== ব্যাকআপ পাঠানোর রিমাইন্ডার: ৭ দিনের বেশি নিজের Drive/WhatsApp-এ ব্যাকআপ না পাঠালে মনে করায় =====
const BACKUP_REMIND_DAYS = 7;
function _markBackupShared(){
  try{ localStorage.setItem('ssn_last_manual_backup_ts', String(Date.now())); localStorage.removeItem('ssn_backup_snooze_date'); }catch(e){}
  const b = document.getElementById('backupRemindBar'); if(b) b.remove();
  refreshDriveBackupInfo();
}
function refreshDriveBackupInfo(){
  const el = document.getElementById('driveBackupInfo'); if(!el) return;
  const ts = parseInt(localStorage.getItem('ssn_last_manual_backup_ts')||'0',10);
  if(!ts){ el.textContent = 'এখনো নিজের Drive/WhatsApp-এ ব্যাকআপ পাঠানো হয়নি।'; return; }
  const days = Math.floor((Date.now()-ts)/86400000);
  el.textContent = 'শেষ ব্যাকআপ পাঠানো: ' + new Date(ts).toLocaleDateString('bn-BD') + (days>0 ? ' ('+days+' দিন আগে)' : ' (আজ)');
}
function checkBackupReminder(){
  try{
    if(typeof currentRole==='function' && currentRole()!=='owner') return;
    if(!medicines.length && !sales.length && !customers.length) return;
    if(document.getElementById('backupRemindBar')) return;
    if(localStorage.getItem('ssn_backup_snooze_date')===todayStr()) return;
    const ts = parseInt(localStorage.getItem('ssn_last_manual_backup_ts')||'0',10);
    const days = ts ? Math.floor((Date.now()-ts)/86400000) : Infinity;
    if(days < BACKUP_REMIND_DAYS) return;
    const bar = document.createElement('div');
    bar.id = 'backupRemindBar';
    bar.style.cssText = 'position:fixed;left:10px;right:10px;bottom:84px;z-index:90;background:#fff8e1;border:1px solid #e0b84c;border-radius:14px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.25);font-size:14px;';
    bar.innerHTML = `<div style="font-weight:700;margin-bottom:4px;">🛡 ব্যাকআপ পাঠানোর সময় হয়েছে</div>
      <div style="margin-bottom:8px;">${ts ? days+' দিন ধরে' : 'এখনো'} নিজের Drive-এ ব্যাকআপ পাঠানো হয়নি। দুই ট্যাপেই হয়ে যাবে — "Drive" বেছে নিন।</div>
      <div style="display:flex;gap:8px;"><button class="btn btn-primary" style="flex:1;" id="brSend">⇪ এখনই Drive-এ পাঠান</button><button class="btn btn-outline" id="brLater">পরে</button></div>`;
    document.body.appendChild(bar);
    bar.querySelector('#brSend').onclick = ()=>{ shareBackup(); };
    bar.querySelector('#brLater').onclick = ()=>{ try{ localStorage.setItem('ssn_backup_snooze_date', todayStr()); }catch(e){} bar.remove(); };
  }catch(e){ console.error('backup reminder failed', e); }
}
setTimeout(()=>{ checkBackupReminder(); refreshDriveBackupInfo(); }, 6000);
setInterval(checkBackupReminder, 60*60*1000);
async function shareBackup(){
  // আগে এই ব্যাকআপে payments/labTests/prescriptions/referrers/testPrices বাদ যেত (বাকির লেনদেন-ইতিহাসসহ) —
  // এখন exportData()-এর মতোই সবকিছু থাকে।
  const data = { medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices, exportedAt:new Date().toISOString() };
  const json = JSON.stringify(data);
  // "শেয়ার ব্যর্থ (NotAllowedError)"-এর কারণ: অ্যান্ড্রয়েড ব্রাউজার .json ফাইল শেয়ার করতে দেয় না (শুধু .txt, .csv, ছবি, PDF ইত্যাদি
  // অনুমোদিত), আর আগের কোড ব্যর্থ হলে আবার শেয়ার চেষ্টা করত — কিন্তু একটা ট্যাপে একবারই শেয়ার করা যায়, দ্বিতীয়বার
  // চেষ্টায় NotAllowedError আসত। তাই এখন অনুমোদিত .txt নামে (ভেতরে একই JSON) একবারই শেয়ার করা হয়; ইমপোর্টে .txt-ও চলে।
  const fname = `nrisingha-medical-backup-${todayStr()}.txt`;
  let lastErr = null, tried = false;
  if(navigator.share && navigator.canShare){
    try{
      const f = new File([json], fname, {type:'text/plain'});
      if(navigator.canShare({files:[f]})){
        tried = true;
        await navigator.share({files:[f], title:'ফার্মেসি ব্যাকআপ'});
        toast('ব্যাকআপ শেয়ার হয়েছে ✓');
        _markBackupShared();
        return;
      }
    }catch(e){
      if(e && e.name==='AbortError') return; // ব্যবহারকারী নিজেই বাতিল করেছেন
      console.error('share failed', e); lastErr = e;
    }
  }
  // শেয়ার না চললে চুপচাপ ব্যর্থ না হয়ে ফাইলটা ডাউনলোড করে দিই এবং কারণ জানাই
  exportData();
  _markBackupShared();
  const why = !navigator.share ? 'এই ব্রাউজারে শেয়ার সুবিধা নেই' :
              (!tried && !lastErr ? 'ফাইল শেয়ার সমর্থিত নয়' : 'শেয়ার ব্যর্থ'+(lastErr&&lastErr.name?' ('+lastErr.name+')':''));
  toast(why+' — ফাইল ডাউনলোড হয়েছে, ডাউনলোড ফোল্ডার থেকে WhatsApp/Drive-এ পাঠান');
}

/* ---------------- Language toggle (labels only) ---------------- */
let isEn = false;
const enMap = {
  propLine:'Proprietor: Pradip Chandra Howlader',
  dashboard0:'Dashboard', dashboard1:"Today's business summary",
  sale0:'Sale (POS)', sale1:'Quick billing',
  prescription0:'Prescription', prescription1:'Write & print prescriptions',
  medicines0:'Medicine Inventory', medicines1:'Manage your stock',
  purchase0:'Purchase', purchase1:'Bring in stock from suppliers',
  customers0:'Customers & Suppliers', customers1:'Dues & contact info',
  reports0:'Reports', reports1:"View your business numbers"
};
const bnMap = {
  propLine:'প্রোপ্রাইটর: প্রদীপ চন্দ্র হাওলাদার',
  dashboard0:'ড্যাশবোর্ড', dashboard1:'আজকের ব্যবসার সংক্ষিপ্ত চিত্র',
  sale0:'বিক্রয় (POS)', sale1:'দ্রুত বিল করুন',
  prescription0:'প্রেসক্রিপশন', prescription1:'প্রেসক্রিপশন লিখুন ও প্রিন্ট করুন',
  medicines0:'ওষুধ ইনভেন্টরি', medicines1:'স্টক পরিচালনা করুন',
  purchase0:'ক্রয়', purchase1:'সাপ্লায়ার থেকে স্টক আনুন',
  customers0:'কাস্টমার ও সাপ্লায়ার', customers1:'বাকি ও যোগাযোগ তথ্য',
  reports0:'রিপোর্ট', reports1:'ব্যবসার হিসাব দেখুন'
};
function toggleLang(){
  isEn = !isEn;
  document.getElementById('langBtn').textContent = isEn ? 'বাংলা' : 'EN';
  const map = isEn ? enMap : bnMap;
  document.getElementById('propLine').textContent = map.propLine;
  Object.keys(titles).forEach(k=>{ titles[k] = [map[k+'0'], map[k+'1']]; });
  const active = document.querySelector('.nav-btn.active').dataset.sec;
  document.getElementById('pageTitle').textContent = titles[active][0];
  document.getElementById('pageSub').textContent = titles[active][1];
}

