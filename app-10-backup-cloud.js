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
  try{ deltaForceFull(); }catch(e){}   // ব্যাকআপ থেকে ফেরালে পরের সিঙ্কে পুরোটা মিলিয়ে নেবে
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
    // ===== নিরাপত্তা লগইন (Firebase Authentication) =====
    // এই ফোনে একবার লগইন করা হয়ে থাকলে (ssn_auth_on) লগইন ছাড়া ক্লাউডে কিছু পড়া/লেখা হয় না। লগইন না থাকলে
    // অ্যাপ আগের মতোই ফোনে চলে (লোকাল-ফার্স্ট), শুধু ক্লাউড সিঙ্ক থেমে থাকে আর লগইন বক্স আসে — ডাটা কিছুই মোছে না।
    // একবারও লগইন না করা ফোনে (ssn_auth_on নেই) আগের মতোই চলে, যাতে রুলস কড়া করার আগে কিছু ভাঙে না।
    if(localStorage.getItem('ssn_auth_on')==='1'){
      if(!firebase.auth) await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
      const user = await new Promise(res=>{ const un = firebase.auth().onAuthStateChanged(u=>{ try{un();}catch(e){} res(u); }); });
      if(!user){ if(navigator.onLine) showCloudLogin(); return null; }
      try{ localStorage.setItem('ssn_auth_uid', user.uid); }catch(e){}   // এই ফোনে কে লগইন করা (মালিক/কর্মচারী) — অফলাইনেও মনে থাকে
    }
    try{ if(firebase.auth && !window._ssnAuthWatch){ window._ssnAuthWatch = true; firebase.auth().onAuthStateChanged(()=>{ try{ updateCloudStatus(); }catch(e){} }); } }catch(e){}
    cloudDb = firebase.firestore();
    _installBatchWrapper(cloudDb);
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
  const _c0 = cloudDb.collection('pharmacies').doc(shopCode).collection(name);
  const _c = (typeof _stampColl==='function' && DELTA_COLLS.indexOf(name)>-1) ? _stampColl(_c0) : _c0;   // v27: প্রতিটা লেখায় _u (সার্ভারের সময়) বসে
  return name==='medicines' ? _wrapMedColl(_c) : _c;
}
// Whether a write can be handed to Firestore right now. Deliberately NOT the same as `cloudLive`
// (which only means "the realtime listeners are currently attached" and flips false the instant
// navigator 'offline' fires) — a write made while cloudLive is false but cloudDb still exists is
// exactly the offline-purchase-entry case above: Firestore's SDK queues it and sends it once the
// network actually returns, so gating writes on cloudDb (not cloudLive) is what lets that happen.
function cloudReady(){ return !!(cloudDb && localStorage.getItem('ssn_shop_code')); }

/* ===== ক্রয়মূল্য (buy) আলাদা জায়গায়: pharmacies/{shop}/medicineCosts/{ওষুধের id} = {buy} (শুধু মালিক পড়তে পারে) =====
   ওষুধের ডকুমেন্টে আর buy যায় না — নিচের র‍্যাপারগুলো সব লেখা (set/update/batch) থেকে buy কেটে medicineCosts-এ পাঠায়।
   তাই বাকি কোডে কিছু বদলাতে হয়নি। ফোনে (লোকালি) med.buy আগের মতোই থাকে; শুধু ক্লাউডে ওষুধের তথ্য থেকে আলাদা থাকে। */
let _costMap = {};   // id → ক্রয়মূল্য (এই সেশনের মেমোরিতে; মালিকের ফোনে)
function _seedCostMap(force){
  // force=true: ফোনের কপিই সত্য (মালিক নিজে এডিট করলে আগে ফোনে লেখা হয়) — ক্লাউড-লিসেনার পরে নতুন মান আনলে সেটাই জিতবে
  try{ (load(DB_KEYS.med)||[]).forEach(m=>{ if(m && m.id && typeof m.buy==='number' && isFinite(m.buy) && (force || _costMap[m.id]===undefined)) _costMap[m.id] = m.buy; }); }catch(e){}
}
function _applyCostMap(arr){ (arr||[]).forEach(m=>{ if(m && m.id && _costMap[m.id]!==undefined) m.buy = _costMap[m.id]; }); }
function _hasBuy(d){ return !!d && typeof d==='object' && !Array.isArray(d) && Object.prototype.hasOwnProperty.call(d,'buy'); }
function _stripBuy(d){ if(!_hasBuy(d)) return d; const o = Object.assign({}, d); delete o.buy; return o; }
function _costWrite(id, data){
  try{
    if(!_hasBuy(data)) return;
    const v = data.buy;
    if(typeof v!=='number' || !isFinite(v)) return;   // FieldValue ইত্যাদি বাদ
    _costMap[id] = v;
    const shop = localStorage.getItem('ssn_shop_code');
    if(!cloudDb || !shop) return;
    cloudDb.collection('pharmacies').doc(shop).collection('medicineCosts').doc(id).set(_deltaStamp({buy:v}), {merge:true}).catch(e=>console.warn('ক্রয়মূল্য ক্লাউডে যায়নি', id, e));
  }catch(e){ console.warn('cost write error', e); }
}
function _wrapMedDoc(ref){
  return new Proxy(ref, { get(t,k){
    if(k==='__real') return t;
    if(k==='set') return (data, opts)=>{
      _costWrite(t.id, data);
      const d = _stripBuy(data);
      if(d!==data && !Object.keys(d).length) return Promise.resolve();
      return opts ? t.set(d, opts) : t.set(d);
    };
    if(k==='update') return (...a)=>{
      if(a.length===1 && _hasBuy(a[0])){
        _costWrite(t.id, a[0]);
        const d = _stripBuy(a[0]);
        if(!Object.keys(d).length) return Promise.resolve();
        return t.update(d);
      }
      return t.update(...a);
    };
    const v = t[k]; return typeof v==='function' ? v.bind(t) : v;
  }});
}
function _wrapMedColl(c){
  return new Proxy(c, { get(t,k){
    if(k==='doc') return (...a)=>_wrapMedDoc(t.doc(...a));
    const v = t[k]; return typeof v==='function' ? v.bind(t) : v;
  }});
}
function _installBatchWrapper(db){
  if(!db || db.__costWrapped) return;
  db.__costWrapped = true;
  const orig = db.batch.bind(db);
  db.__origBatch = orig;   // মাইগ্রেশনে আসল (র‍্যাপারহীন) ব্যাচ লাগে
  const un = r=>{ let x=r, g=0; while(x && x.__real && x.__real!==x && g++<4) x=x.__real; return x; };   // একাধিক র‍্যাপার (স্ট্যাম্প+ওষুধ) পার করে আসল রেফারেন্স
  const isMed = r=>{ try{ return /\/medicines\/[^/]+$/.test(r.path); }catch(e){ return false; } };
  db.batch = function(){
    const b = orig(), costs = [];
    const w = {
      set(ref, data, opts){
        const r = un(ref);
        if(isMed(r) && _hasBuy(data)){ costs.push([r.id, data]); data = _stripBuy(data); }
        data = _batchStamp(r, data);
        if(opts) b.set(r, data, opts); else b.set(r, data);
        return w;
      },
      update(ref, ...a){
        const r = un(ref);
        if(isMed(r) && a.length===1 && _hasBuy(a[0])){
          costs.push([r.id, a[0]]);
          const d = _stripBuy(a[0]);
          if(Object.keys(d).length) b.update(r, _batchStamp(r, d));
          return w;
        }
        if(a.length===1) a = [_batchStamp(r, a[0])];
        b.update(r, ...a); return w;
      },
      delete(ref){ b.delete(un(ref)); return w; },
      commit(){ return b.commit().then(res=>{ costs.forEach(([id,d])=>_costWrite(id,d)); return res; }); }
    };
    return w;
  };
}
// ফায়ারবেসের পড়ার সীমা বাঁচাতে: কম-ব্যবহারের কালেকশন (lazy:'skip' = প্রেসক্রিপশন/রেফারার/টেস্ট-দাম+ল্যাব সামগ্রী) অ্যাপ খোলার সময় ক্লাউড থেকে পড়া হয় না —
// ওই ট্যাব খুললে ensureLazyCollections() পুরোটা পড়ে। ল্যাব টেস্ট (lazy:'full') অ্যাপ খুললে শুধু গত ৩০ দিনেরটা পড়ে, টেস্ট/রিপোর্ট ট্যাবে ঢুকলে পুরোটা।
// ফোনে আগের কপি থাকেই (local-first), তাই ডাটা হারানোর ঝুঁকি নেই — শুধু অন্য ফোনের নতুন এন্ট্রি ওই ট্যাব খোলার আগে দেখা যায় না।
let _attachOneFn = null, _lazyOn = {}, _liveByName = {};
const LAZY_SECTION_MAP = { test:['labTests','referrers','testPrices'], prescription:['prescriptions'], reports:['labTests'] };
function ensureLazyCollections(names){
  try{
    if(!_attachOneFn || !cloudLive) return;
    (names||[]).forEach(n=>{
      if(_lazyOn[n]) return;
      const c = LIVE_COLLECTIONS.find(x=>x.name===n); if(!c || !c.lazy) return;
      _lazyOn[n] = true;
      _attachOneFn(c, true);
    });
  }catch(e){ console.error('lazy attach failed', e); }
}
function ensureLazyForSection(sec){ if(LAZY_SECTION_MAP[sec]) ensureLazyCollections(LAZY_SECTION_MAP[sec]); }
const ARCHIVE_AGE_MS = 365*24*60*60*1000; // 1 year — records older than this are eligible to be archived out of local storage (see archiveOldRecords() below), so their real-time listener only tracks what's actually still meant to be local.
const LIVE_COLLECTIONS = [
  {name:'medicines', arrKey:'medicines', dbKey:DB_KEYS.med},
  {name:'sales', arrKey:'sales', dbKey:DB_KEYS.sale, recentOnlyField:'ts'},
  {name:'purchases', arrKey:'purchases', dbKey:DB_KEYS.purchase, recentOnlyField:'ts'},
  {name:'customers', arrKey:'customers', dbKey:DB_KEYS.customer},
  {name:'suppliers', arrKey:'suppliers', dbKey:DB_KEYS.supplier},
  {name:'payments', arrKey:'payments', dbKey:DB_KEYS.payment},
  {name:'labTests', arrKey:'labTests', dbKey:DB_KEYS.labTest, recentOnlyField:'ts', recentMs:30*24*60*60*1000, lazy:'full'},
  {name:'prescriptions', arrKey:'prescriptions', dbKey:DB_KEYS.prescription, lazy:'skip'},
  {name:'referrers', arrKey:'referrers', dbKey:DB_KEYS.referrer, lazy:'skip'},
  {name:'testPrices', arrKey:'testPrices', dbKey:DB_KEYS.testPrice, lazy:'skip'}
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
  // পড়া খরচ কমাতে: একবার যাচাই শেষ হলে এই ফোনে আর প্রতিবার অ্যাপ খোলায় ১০–১১টা পড়া করা হবে না
  const _migFlag = 'ssn_legacy_checked_'+shopCode;
  if(localStorage.getItem(_migFlag)==='1') return;
  try{
    const legacyDoc = await db.collection('pharmacies').doc(shopCode).get();
    if(!legacyDoc.exists){ try{ localStorage.setItem(_migFlag,'1'); }catch(e){} return; }
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
    try{ localStorage.setItem(_migFlag,'1'); }catch(e){}
  }catch(e){ console.error('migration error', e); }
}

// ===== এই ফোনে আছে কিন্তু ক্লাউডে নেই — দেখে বেছে ক্লাউডে পাঠানো =====
// ইন্টারনেট ছাড়া অ্যাপ খুলে যোগ/বিক্রি করা রেকর্ড (ওষুধ, কাস্টমার, প্রেসক্রিপশন, বিক্রয়, ক্রয়, জমা, টেস্ট ইত্যাদি)
// কোনো কারণে ক্লাউডে না পৌঁছে থাকলে এখানে দেখায়। আপনি দেখে টিক দিয়ে বেছে পাঠাবেন — নিজে থেকে কিছু পাঠায় না
// (কারণ অন্য ফোনে মোছা কোনো রেকর্ড ভুলে ফিরে আসতে পারে; মোছা কিছু দেখলে টিক তুলে দিন)।
// ওষুধ/কাস্টমার/সাপ্লায়ার/প্রেসক্রিপশন/টেস্ট/রেফারার: সব রেকর্ড ক্লাউডের সাথে মেলানো হয়।
// বিক্রয়/ক্রয়/জমা: শেষ ৯০ দিনের।
async function openPendingUploads(){
  try{
    if(!localStorage.getItem('ssn_shop_code')){ toast('আগে ক্লাউড সংযোগ করুন'); return; }
    if(!navigator.onLine){ toast('ইন্টারনেট চালু করে আবার চাপুন'); return; }
    if(!cloudReady()) await attachRealtimeListeners();
    if(!cloudReady()){ toast('ক্লাউডের সাথে সংযোগ হয়নি'); return; }
    toast('ক্লাউডের সাথে মিলিয়ে দেখা হচ্ছে…');
    const cutoff = Date.now() - 90*86400000;
    const tomb = new Set(getTombstones().map(t=>t.id));
    const kinds = [
      {name:'medicines',     arr:medicines,     full:true, title:'ওষুধ'},
      {name:'customers',     arr:customers,     full:true, title:'কাস্টমার'},
      {name:'suppliers',     arr:suppliers,     full:true, title:'সাপ্লায়ার'},
      {name:'referrers',     arr:referrers,     full:true, title:'রেফারার'},
      {name:'prescriptions', arr:prescriptions, full:true, title:'প্রেসক্রিপশন'},
      {name:'labTests',      arr:labTests,      full:true, title:'টেস্ট'},
      {name:'sales',         arr:sales,         full:false, title:'বিক্রয়'},
      {name:'payments',      arr:payments,      full:false, title:'জমা/খরচ/পরিশোধ'},
      {name:'purchases',     arr:purchases,     full:false, title:'ক্রয়'}
    ];
    const found = [];
    for(const k of kinds){
      const local = k.arr.filter(r=>r && r.id && !tomb.has(r.id) && (k.full || (r.ts||0) > cutoff));
      if(!local.length) continue;
      const q = k.full ? shopColl(k.name) : shopColl(k.name).where('ts','>',cutoff);
      const snap = await q.get({source:'server'});
      const ids = new Set(snap.docs.map(d=>d.id));
      local.forEach(r=>{ if(!ids.has(r.id)) found.push({k, r}); });
    }
    const order = kinds.map(k=>k.name);
    found.sort((x,y)=> order.indexOf(x.k.name)-order.indexOf(y.k.name) || (y.r.ts||0)-(x.r.ts||0));
    const custName = id=>{ const c = customers.find(x=>x.id===id); return c ? c.name : ''; };
    const describe = ({k,r})=>{
      const when = r.date || '';
      switch(k.name){
        case 'medicines': return {t:'ওষুধ: '+escapeHtml(r.name||''), s:(r.company?escapeHtml(r.company)+' • ':'')+'স্টক '+(r.stock!=null?r.stock:'—'), a:null};
        case 'customers': return {t:'কাস্টমার: '+escapeHtml(r.name||''), s:escapeHtml(r.mobile||''), a:null};
        case 'suppliers': return {t:'সাপ্লায়ার: '+escapeHtml(r.name||''), s:'', a:null};
        case 'referrers': return {t:'রেফারার: '+escapeHtml(r.name||''), s:'', a:null};
        case 'prescriptions': return {t:'প্রেসক্রিপশন: '+escapeHtml(r.patientName||r.name||''), s:when, a:null};
        case 'labTests': return {t:'টেস্ট: '+escapeHtml(r.patientName||''), s:when, a:null};
        case 'sales': return {t:'বিক্রয়: '+escapeHtml(r.customerName||'ওয়াক-ইন')+(r.patientName?' • রোগী: '+escapeHtml(r.patientName):''), s:when+' • '+(r.items||[]).length+' আইটেম', a:r.total};
        case 'purchases': return {t:'ক্রয়: '+escapeHtml(r.medicineName||''), s:when+' • '+r.qty+' × '+fmt(r.price), a:(r.qty||0)*(r.price||0)};
        default: {
          const typ = r.type==='expense' ? 'খরচ: '+escapeHtml(r.note||'') : r.type==='due_adjustment' ? 'বাকি যোগ: '+escapeHtml(custName(r.customerId)) : r.type==='supplier_payment' ? 'সাপ্লায়ার পরিশোধ' : r.type==='referrer_commission' ? 'কমিশন পরিশোধ' : 'জমা: '+escapeHtml(custName(r.customerId));
          return {t:typ, s:when, a:r.amount};
        }
      }
    };
    const ov = _supOverlay(`
      <div style="font-weight:800;font-size:17px;">☁️ ক্লাউডে নেই এমন রেকর্ড (${found.length}টা)</div>
      <div class="row-sub" style="margin:4px 0 8px;line-height:1.5;">এই ফোনে আছে কিন্তু ক্লাউডে পাওয়া যায়নি। যেগুলো পাঠাতে চান টিক দিন। <b>যেটা অন্য ফোনে ইচ্ছে করে মুছে ফেলেছেন সেটা এখানে দেখালে টিক তুলে দিন।</b> বিক্রয় পাঠালে ক্লাউডের স্টকও কমবে।</div>
      ${found.length ? found.map((f,i)=>{ const d = describe(f); return `<label style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed #ddd;"><input type="checkbox" data-i="${i}" checked style="width:20px;height:20px;flex:none;"><div style="min-width:0;flex:1;overflow-wrap:anywhere;"><div style="font-weight:600;">${d.t}</div><div class="row-sub">${d.s}</div></div>${d.a!=null?`<b style="white-space:nowrap;">${fmt(d.a||0)}</b>`:''}</label>`; }).join('') : '<div class="empty-state">✅ সব রেকর্ড ক্লাউডে আছে — কিছু পাঠানোর নেই</div>'}
      ${found.length ? '<button id="pendSend" class="btn btn-primary btn-block" style="margin-top:12px;">টিক দেওয়াগুলো ক্লাউডে পাঠান</button>' : ''}
      <button id="pendClose" class="btn btn-block" style="margin-top:8px;background:#f1f1f1;">বন্ধ করুন</button>`);
    ov.querySelector('#pendClose').onclick = ()=>ov.remove();
    const sendBtn = ov.querySelector('#pendSend');
    if(sendBtn) sendBtn.onclick = async ()=>{
      sendBtn.disabled = true; sendBtn.textContent = 'পাঠানো হচ্ছে…';
      const chosen = [...ov.querySelectorAll('input[type=checkbox][data-i]:checked')].map(c=>found[+c.dataset.i]);
      const uploadedMeds = new Set();   // এই রানে যে ওষুধের পুরো রেকর্ড (বর্তমান স্টকসহ) পাঠানো হলো — তার জন্য আলাদা স্টক যোগ-বিয়োগ করলে দ্বিগুণ হয়ে যেত
      let ok = 0, fail = 0;
      for(const {k,r} of chosen){
        try{
          if(r.customerId && k.name!=='customers'){   // রেকর্ডে যে কাস্টমারের কথা আছে সে ক্লাউডে না থাকলে আগে তাকেও পাঠাই
            const cd = await shopColl('customers').doc(r.customerId).get();
            if(!cd.exists){ const loc = customers.find(c=>c.id===r.customerId); if(loc) await shopColl('customers').doc(loc.id).set(Object.assign({}, loc)); }
          }
          await shopColl(k.name).doc(r.id).set(Object.assign({}, r));
          if(k.name==='medicines') uploadedMeds.add(r.id);
          const inc = (id, n)=>shopColl('medicines').doc(id).update({stock: firebase.firestore.FieldValue.increment(n)}).catch(e=>console.warn('stock update skipped', id, e));
          if(k.name==='sales'){ for(const it of (r.items||[])) if(it.id && !uploadedMeds.has(it.id)) await inc(it.id, -(it.qty||0)); }
          if(k.name==='purchases' && r.medicineId && !uploadedMeds.has(r.medicineId)) await inc(r.medicineId, (r.qty||0));
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
  _lazyOn = {}; _liveByName = {};
  const gen = deltaNextGen();
  await deltaSyncCloudFlag(db, shopCode);
  try{ if(typeof watchDeleteLog==='function') watchDeleteLog(db, shopCode); }catch(e){ console.warn('মোছার খবর শোনা শুরু হয়নি', e); }   // v29: মালিক যা মুছেছেন তা এই ফোন থেকেও মুছে যাবে   // মালিক দ্রুত সিঙ্ক চালু করে থাকলে এই ফোনও (কর্মচারীর ফোনসহ) সেটা অনুসরণ করে
  await migrateLegacyIfNeeded(db, shopCode);
  // ক্লাউড থেকে আসা রেকর্ড ফোনে বসানো। isFull=true: recs মানে ক্লাউডের পুরো তালিকা (আগের মতোই); false: শুধু বদলানো রেকর্ড — আগের তালিকায় id ধরে বসে/যোগ হয়।
  const _applyRecs = (c, recs, isFull)=>{
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
          recs.forEach(rec=>{
            const loc = localById[rec.id];
            if(!loc) return;
            ['mobile','address','guardian'].forEach(f=>{ if(!rec[f] && loc[f]) rec[f] = loc[f]; });
          });
        }catch(fieldGuardErr){ console.error('customer field-protect failed', fieldGuardErr); }
      }
      if(c.name==='medicines' && currentRole()==='owner'){
        // ক্লাউডের ওষুধ-ডকুমেন্টে এখন buy থাকে না — মালিকের ফোনে ক্রয়মূল্য মেমোরি/ফোনের কপি/medicineCosts থেকে ফিরিয়ে বসানো হয়,
        // নইলে এই সিঙ্কেই ফোনের সব ক্রয়মূল্য মুছে যেত।
        try{
          const lb = {}; (load(c.dbKey)||[]).forEach(r=>{ if(r && r.id) lb[r.id] = r.buy; });
          recs.forEach(r=>{
            if(_costMap[r.id]!==undefined) r.buy = _costMap[r.id];
            else if(r.buy===undefined && lb[r.id]!==undefined) r.buy = lb[r.id];
          });
        }catch(buyErr){ console.error('buy restore failed', buyErr); }
      }
      let arr = recs;
      if(!isFull){
        const live = getLiveArray(c.arrKey) || [];
        const idx = new Map(); live.forEach((r,i)=>{ if(r && r.id) idx.set(r.id, i); });
        arr = live.slice();
        recs.forEach(r=>{ const i = idx.get(r.id); if(i===undefined){ idx.set(r.id, arr.length); arr.push(r); } else arr[i] = r; });
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
  };
  const onSnapErr = err=>{
      console.error(err);
      if(err && err.code==='permission-denied'){
        cloudLive = false;
        try{ localStorage.setItem('ssn_last_sync_error', 'অনুমতি নেই (permission-denied) — এই ফোনে লগইন করা নেই বা লগইনের অনুমতি নেই। ফোনের ডাটা নিরাপদ আছে। 🔐 লগইন করুন।'); updateCloudStatus(); }catch(e2){}
      }
  };
  // v28: বিক্রি/ক্রয় এখন সবসময় পুরো ইতিহাসসহ পড়া হয় — আগে ১ বছরের চলন্ত সীমা ছিল, কিন্তু কাস্টমারের বাকি ও সাপ্লায়ারের বাকি পুরো ইতিহাস যোগ করে হিসাব হয়,
  // তাই নতুন/মোছা ফোনে পুরনো রেকর্ড বাদ পড়লে বাকি ভুল আসত। সীমা শুধু তখনই চলে যখন এই ফোনে মালিক নিজে হাতে "আর্কাইভ" চালিয়েছেন (ssn_archived_any) — আগের মতোই।
  // ল্যাব টেস্টের ৩০ দিনের সীমা (খোলার সময়) আগের মতোই।
  const bootQuery = (c, full)=>{
    // v32: ইতিহাস সীমা চালু থাকলে বিক্রি/ক্রয় শুধু নির্দিষ্ট তারিখ (histFrom) থেকে পড়া হয় — আগের জের আলাদা জমা আছে (app-13-histwindow.js)
    try{ if(!full && (c.name==='sales'||c.name==='purchases') && typeof histOn==='function' && histOn()) return shopColl(c.name).where('ts', '>=', histFrom()); }catch(e){}
    const win = c.recentMs || (localStorage.getItem('ssn_archived_any') ? ARCHIVE_AGE_MS : 0);
    return (c.recentOnlyField && !full && win) ? shopColl(c.name).where(c.recentOnlyField, '>', Date.now()-win) : shopColl(c.name);
  };
  // পুরনো পদ্ধতি (আগের মতো হুবহু): পুরো তালিকার লাইভ লিসেনার
  const legacyAttach = (c, full)=>{
    const query = bootQuery(c, full);
    if(_liveByName[c.name]){ try{ _liveByName[c.name](); }catch(e){} }
    let first = true;
    const unsub = query.onSnapshot(snapshot=>{
      try{ if(!snapshot.metadata.fromCache) deltaCountReads(snapshot.docChanges().length); }catch(e){}   // আগের পদ্ধতিতেও পড়া গোনা হয়
      if(first){ first = false; try{ if(!snapshot.metadata.fromCache) deltaCountReads(snapshot.size); }catch(e){} }
      _applyRecs(c, snapshot.docs.map(d=>deltaRec(d)), true);
    }, onSnapErr);
    _liveByName[c.name] = unsub;
    liveListeners.push(unsub);
  };
  // নতুন পদ্ধতি (দ্রুত সিঙ্ক চালু থাকলে): প্রথমে একবার পুরো, তারপর শুধু বদলানো; কিছু ভুল হলে পুরনো পদ্ধতিতে ফেরে
  const deltaAttachOne = (c, full)=>{
    if(_liveByName[c.name]){ try{ _liveByName[c.name](); }catch(e){} _liveByName[c.name] = null; }
    deltaStart(c.name, ()=>bootQuery(c, full), (docs, isBoot)=>_applyRecs(c, docs.map(d=>deltaRec(d)), isBoot), onSnapErr, gen, ()=>{ const a = getLiveArray(c.arrKey); return a ? a.length : 0; })
      .then(unsub=>{ if(unsub){ _liveByName[c.name] = unsub; liveListeners.push(unsub); } })
      .catch(e=>{ console.warn('দ্রুত সিঙ্ক শুরু হয়নি, পুরনো পদ্ধতিতে চলছে:', c.name, e); if(gen===_deltaGen) legacyAttach(c, full); });
  };
  const attachOne = (c, full)=>{
    if(deltaEnabled() && (!c.lazy || full)) deltaAttachOne(c, full); else legacyAttach(c, full);
  };
  _attachOneFn = attachOne;
  LIVE_COLLECTIONS.forEach(c=>{ if(c.lazy==='skip') return; attachOne(c, false); });
  try{
    _seedCostMap(true);
    const applyCostDocs = docs=>{
      let changed = false;
      docs.forEach(d=>{
        const v = d.data().buy;
        if(typeof v!=='number' || !isFinite(v)) return;
        const w = _recentLocalWriteAt[d.id];
        if(w && Date.now()-w < LOCAL_WRITE_GRACE_MS) return;
        if(_costMap[d.id]!==v){ _costMap[d.id] = v; changed = true; }
      });
      if(changed && currentRole()==='owner'){ _applyCostMap(medicines); save(DB_KEYS.med, medicines, true); scheduleRerender(); }
    };
    const legacyCosts = ()=>{
      const cu = shopColl('medicineCosts').onSnapshot(snap=>{ try{ if(!snap.metadata.fromCache) deltaCountReads(snap.docChanges().length); }catch(e){} applyCostDocs(snap.docs); }, ()=>{ /* কর্মচারীর লগইনে অনুমতি নেই — এটাই স্বাভাবিক, চুপচাপ থাকবে */ });
      liveListeners.push(cu);
    };
    if(deltaEnabled() && currentRole()==='owner'){
      deltaStart('medicineCosts', ()=>shopColl('medicineCosts'), (docs)=>applyCostDocs(docs), ()=>{}, gen, ()=>Object.keys(_costMap).length)
        .then(unsub=>{ if(unsub) liveListeners.push(unsub); })
        .catch(e=>{ console.warn('ক্রয়মূল্যের দ্রুত সিঙ্ক শুরু হয়নি:', e); if(gen===_deltaGen) legacyCosts(); });
    } else legacyCosts();
  }catch(e){ console.warn('medicineCosts listener', e); }
  cloudLive = true;
  localStorage.setItem('ssn_last_sync', Date.now());
  localStorage.removeItem('ssn_last_sync_error');
  updateCloudStatus();
  setTimeout(()=>autoDailyCloudBackup(false), 25000);
  try{ attachPhotoListener(); }catch(e){ console.error(e); }
  try{ ensureLazyForSection(currentSection); }catch(e){ console.error(e); }
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
  try{ deltaForceFull(); }catch(e){}
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
  // v42: রিয়েল-টাইম সিঙ্ক চালু থাকলে এন্ট্রি আলাদা কালেকশনে সাথে সাথে যায়। পুরনো এই পদ্ধতি দোকানের মূল ডকুমেন্ট পুরো বদলে দিত
  // (কর্মচারীর PIN-হ্যাশ/তালিকা, দ্রুত সিঙ্ক, ইতিহাস সীমা, সংরক্ষিত প্রেসক্রাইবার মুছে যেত) — তাই এখন চালু থাকলে কিছুই লেখে না।
  if(cloudLive){ toast('রিয়েল-টাইম সিঙ্ক চালু — এন্ট্রি সাথে সাথেই ক্লাউডে যায়। ক্লাউডে যায়নি এমন কিছু আছে কিনা দেখতে "এই ফোনে আছে, ক্লাউডে নেই" বোতাম চাপুন।'); return; }
  const db = await initCloud(); if(!db) return;
  try{
    await db.collection('pharmacies').doc(shopCode).set({
      medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices, updatedAt: Date.now()
    }, {merge:true});
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
  try{ updateDeltaSyncUi(); }catch(e){}
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
    (err ? `<div class="row-sub" style="margin-top:6px;color:var(--red);background:var(--red-soft);padding:8px 10px;border-radius:8px;">এরর: ${err}</div>` : '') +
    cloudAuthStatusHtml() + costMigrationStatusHtml();
}
function cloudAuthStatusHtml(){
  if(localStorage.getItem('ssn_auth_on')==='1'){
    const em = escapeHtml(localStorage.getItem('ssn_auth_email')||'');
    return `<div class="row-sub" style="margin-top:8px;">🔐 নিরাপদ লগইন চালু${em?' • '+em:''}</div>` +
      `<button type="button" class="btn btn-sm btn-outline" style="margin-top:6px;" onclick="cloudLogout()">লগআউট (এই ফোন থেকে ক্লাউড-লগইন সরান)</button>`;
  }
  return `<div class="row-sub" style="margin-top:8px;color:#8a5a00;background:#fff4d6;padding:8px 10px;border-radius:8px;">🔓 এই ফোনে ক্লাউডের লগইন চালু নেই — শপ কোড জানলে যে কেউ ডাটাবেসে ঢুকতে পারে।</div>` +
    `<button type="button" class="btn btn-sm btn-primary" style="margin-top:6px;" onclick="showCloudLogin()">🔐 নিরাপদ লগইন চালু করুন</button>`;
}
// মালিকের Firebase অ্যাকাউন্টের UID (firestore.rules-এর owner() ফাংশনের UID-এর সাথে একই হতে হবে)।
// "ক্রয়মূল্য আলাদা করুন" বাটন শুধু তখনই দেখাবে যখন এই ফোনে ক্লাউডে মালিকের অ্যাকাউন্টে লগইন করা আছে —
// PIN-এর ভূমিকা (role) বা ফোনের নিজস্ব চিহ্ন দেখে নয়। তাই কর্মচারীর অ্যাকাউন্টে লগইন করা ফোনে এটা কখনো আসবে না।
const OWNER_CLOUD_UID = 'OWoSdlC71Eco4iY7Sn7esH7UCxf2';
function isCloudOwner(){
  try{ return !!(window.firebase && firebase.auth && firebase.auth().currentUser && firebase.auth().currentUser.uid === OWNER_CLOUD_UID); }catch(e){ return false; }
}
function costMigrationStatusHtml(){
  try{
    if(sessionStorage.getItem('ssn_role')!=='owner') return '';   // PIN দেওয়ার আগে/কর্মচারী হিসেবে ঢুকলে কিছুই নয়
    if(!isCloudOwner()) return '';                                // কর্মচারীর ক্লাউড-লগইন বা লগইন না থাকলে কিছুই নয়
    if(localStorage.getItem('ssn_costs_migrated_v1')) return `<div class="row-sub" style="margin-top:8px;">🔒 ক্রয়মূল্য মালিক-only জায়গায় আছে ✓</div>`;
    return `<div class="row-sub" style="margin-top:8px;line-height:1.5;">🔒 ক্রয়মূল্য এখনো ওষুধের তথ্যের সাথে ক্লাউডে আছে (কর্মচারীর লগইনে পড়া যায়)।</div>` +
      `<button type="button" class="btn btn-sm btn-primary" style="margin-top:6px;" onclick="migrateCostsToOwnerOnly()">🔒 ক্রয়মূল্য আলাদা করুন (একবারের কাজ)</button>`;
  }catch(e){ return ''; }
}
// একবারের কাজ (শুধু মালিক): ক্লাউডের সব ওষুধের ক্রয়মূল্য medicineCosts-এ কপি → মিলিয়ে দেখা → তারপরই ওষুধের ডকুমেন্ট থেকে buy সরানো।
// কোনো ধাপে গোলমাল হলে থেমে যায়, ফোন ও ক্লাউডের মূল তথ্য অক্ষত থাকে। শুরুর আগে আলাদা দৈনিক ব্যাকআপও নেয়।
async function migrateCostsToOwnerOnly(){
  if(!requireOwnerRole('ক্রয়মূল্য আলাদা করা')) return;
  if(!isCloudOwner()){ toast('শুধু মালিকের ক্লাউড-অ্যাকাউন্টে লগইন করা ফোনে এটা চলবে'); return; }
  if(!cloudReady() || !navigator.onLine){ toast('ইন্টারনেট ও ক্লাউড সংযোগ চালু থাকতে হবে'); return; }
  if(!confirm('ক্রয়মূল্য আলাদা করবেন?\n\n⚠️ আগে মালিকের ফোন, কর্মচারীর ফোনসহ সব ফোনে নতুন সংস্করণ (v18) চালু করে নিন। পুরনো সংস্করণের ফোন এর পর ক্রয়মূল্য দেখতে পাবে না।\n\nএর আগে একটা ব্যাকআপ নেওয়া হবে, আর মিলিয়ে না দেখে কিছু সরানো হবে না।')) return;
  try{
    toast('ব্যাকআপ নেওয়া হচ্ছে…');
    await autoDailyCloudBackup(true);
    if(localStorage.getItem('ssn_last_auto_backup_date')!==todayStr() || localStorage.getItem('ssn_last_auto_backup_error')){ alert('⚠️ আগে ব্যাকআপ নেওয়া যায়নি — কাজ থামানো হলো। কিছুই বদলায়নি।'); return; }
    const db = cloudDb, shop = localStorage.getItem('ssn_shop_code');
    const base = db.collection('pharmacies').doc(shop);
    toast('ক্রয়মূল্য কপি হচ্ছে…');
    const medSnap = await base.collection('medicines').get({source:'server'});
    const costs = {}, withBuy = [];
    medSnap.docs.forEach(d=>{ const v = d.data().buy; if(v!==undefined) withBuy.push(d.id); if(typeof v==='number' && isFinite(v)) costs[d.id] = v; });
    const costSnap = await base.collection('medicineCosts').get({source:'server'});
    costSnap.docs.forEach(d=>{ const v = d.data().buy; if(typeof v==='number' && isFinite(v)) costs[d.id] = v; });   // নতুনটা (আলাদা জায়গার) জেতে
    (load(DB_KEYS.med)||[]).forEach(m=>{ if(m && m.id && costs[m.id]===undefined && typeof m.buy==='number' && isFinite(m.buy)) costs[m.id] = m.buy; });   // ফাঁক ভরে ফোনের কপি
    const ids = Object.keys(costs);
    for(let i=0;i<ids.length;i+=400){
      const b = db.__origBatch();
      ids.slice(i,i+400).forEach(id=>b.set(base.collection('medicineCosts').doc(id), {buy:costs[id]}, {merge:true}));
      await b.commit();
    }
    const chk = await base.collection('medicineCosts').get({source:'server'});
    const have = new Set(chk.docs.map(d=>d.id));
    const missing = ids.filter(id=>!have.has(id));
    if(missing.length){ alert('⚠️ '+missing.length+'টা ক্রয়মূল্য আলাদা জায়গায় পৌঁছায়নি — কাজ থামানো হলো। ওষুধের তথ্যে কিছুই সরানো হয়নি।'); return; }
    toast('ওষুধের তথ্য থেকে ক্রয়মূল্য সরানো হচ্ছে…');
    for(let i=0;i<withBuy.length;i+=400){
      const b = db.__origBatch();
      withBuy.slice(i,i+400).forEach(id=>b.update(base.collection('medicines').doc(id), {buy: firebase.firestore.FieldValue.delete()}));
      await b.commit();
    }
    Object.keys(costs).forEach(id=>{ _costMap[id] = costs[id]; });
    localStorage.setItem('ssn_costs_migrated_v1', String(Date.now()));
    try{ await base.set({costsSeparatedAt: Date.now()}, {merge:true}); }catch(e){ console.warn('marker', e); }   // অন্য ফোনেও যেন "হয়ে গেছে" দেখায়
    updateCloudStatus();
    alert('✓ হয়েছে: '+ids.length+'টা ওষুধের ক্রয়মূল্য মালিক-only জায়গায় গেছে।\nএবার নতুন Firestore রুলস বসানো যাবে (SECURITY-SETUP.txt-এর ধাপ ৭)।');
  }catch(e){
    console.error(e);
    alert('⚠️ মাঝপথে থেমে গেছে: '+(e&&e.message?e.message:e)+'\n\nফোন ও ক্লাউডের তথ্য অক্ষত আছে। ইন্টারনেট ঠিক করে আবার চাপুন — আবার চালালে ক্ষতি নেই।');
  }
}
/* ---------------- Cloud লগইন (Firebase Authentication) ---------------- */
// মালিক নিজের ফোনে মালিকের অ্যাকাউন্ট, কর্মচারীর ফোনে কর্মচারীর অ্যাকাউন্ট দিয়ে একবার লগইন করবেন। পাসওয়ার্ড ফোনে সেভ হয় না —
// Firebase নিজেই লগইন-সেশন ধরে রাখে। অ্যাকাউন্ট বানানো ও Firestore রুলস বসানোর ধাপ SECURITY-SETUP.txt-এ আছে।
function showCloudLogin(){
  if(!localStorage.getItem('ssn_cloud_config')){ toast('আগে ☁ ক্লাউড সংযোগ করুন'); return; }
  if(document.getElementById('cloudLoginOv')) return;
  const ov = document.createElement('div');
  ov.id = 'cloudLoginOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;overflow:auto;padding:14px;';
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:16px;max-width:420px;margin:40px auto;">'
    + '<b style="font-size:17px;">🔐 ক্লাউড লগইন</b>'
    + '<div class="row-sub" style="margin:6px 0 10px;line-height:1.6;">মালিকের ফোনে মালিকের ইমেইল, কর্মচারীর ফোনে কর্মচারীর ইমেইল দিন। একবার লগইন করলে আর বারবার লাগবে না। লগইন না করলে অ্যাপ ফোনে আগের মতোই চলবে, শুধু ক্লাউড সিঙ্ক বন্ধ থাকবে।</div>'
    + '<label>ইমেইল</label><input type="email" id="clEmail" autocomplete="username" autocapitalize="none" style="width:100%;">'
    + '<label>পাসওয়ার্ড</label><input type="password" id="clPass" autocomplete="current-password" style="width:100%;">'
    + '<div id="clMsg" class="row-sub" style="margin-top:8px;color:var(--red);min-height:18px;"></div>'
    + '<button type="button" class="btn btn-primary btn-block" id="clGo" style="margin-top:8px;">লগইন করুন</button>'
    + '<button type="button" class="btn btn-outline btn-block" id="clLater" style="margin-top:8px;">এখন না</button></div>';
  document.body.appendChild(ov);
  const close = ()=>{ try{ ov.remove(); }catch(e){} };
  ov.querySelector('#clLater').onclick = close;
  ov.querySelector('#clGo').onclick = async ()=>{
    const email = ov.querySelector('#clEmail').value.trim();
    const pass = ov.querySelector('#clPass').value;
    const msg = ov.querySelector('#clMsg');
    if(!email || !pass){ msg.textContent = 'ইমেইল ও পাসওয়ার্ড দুটোই দিন'; return; }
    if(!navigator.onLine){ msg.textContent = 'লগইনের জন্য ইন্টারনেট লাগবে'; return; }
    msg.style.color = 'var(--text-soft,#555)'; msg.textContent = 'লগইন হচ্ছে…';
    try{
      if(!window.firebase){
        await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
      }
      if(!firebase.auth) await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
      if(!firebase.apps || !firebase.apps.length) firebase.initializeApp(JSON.parse(localStorage.getItem('ssn_cloud_config')));
      const _cred = await firebase.auth().signInWithEmailAndPassword(email, pass);
      try{ localStorage.setItem('ssn_auth_uid', _cred.user.uid); }catch(e){}
      localStorage.setItem('ssn_auth_on','1');
      localStorage.setItem('ssn_auth_email', email);
      localStorage.removeItem('ssn_last_sync_error');
      msg.style.color = 'var(--green,#1b7a3a)'; msg.textContent = '✓ লগইন সফল — অ্যাপ নতুন করে খুলছে…';
      // Firestore-কে লগইনসহ নতুনভাবে শুরু করার সবচেয়ে নিরাপদ উপায়: পাতাটা একবার রিলোড
      setTimeout(()=>location.reload(), 700);
    }catch(e){
      console.error(e);
      const c = e && e.code || '';
      msg.style.color = 'var(--red)';
      msg.textContent = (c.includes('wrong-password')||c.includes('invalid-credential')||c.includes('user-not-found')) ? 'ইমেইল বা পাসওয়ার্ড ভুল'
        : c.includes('too-many-requests') ? 'অনেকবার ভুল হয়েছে — একটু পরে আবার চেষ্টা করুন'
        : c.includes('network') ? 'ইন্টারনেট সমস্যা — আবার চেষ্টা করুন'
        : c.includes('operation-not-allowed') ? 'Firebase-এ Email/Password লগইন চালু করা নেই (SECURITY-SETUP.txt দেখুন)'
        : 'লগইন হয়নি: ' + (e && e.message ? e.message : c);
    }
  };
}
async function cloudLogout(){
  if(!confirm('এই ফোন থেকে ক্লাউড-লগইন সরাবেন? ফোনের ডাটা মুছবে না, কিন্তু আবার লগইন না করা পর্যন্ত ক্লাউড সিঙ্ক বন্ধ থাকবে।')) return;
  try{ if(window.firebase && firebase.auth) await firebase.auth().signOut(); }catch(e){ console.error(e); }
  try{ localStorage.removeItem('ssn_auth_email'); }catch(e){}
  // ssn_auth_on ইচ্ছে করেই রাখা হলো — যাতে লগআউট অবস্থায় ক্লাউড খোলা না থাকে
  cloudDb = null; cloudLive = false;
  try{ liveListeners.forEach(u=>u()); }catch(e){} liveListeners = [];
  updateCloudStatus();
  toast('লগআউট হয়েছে');
}
// ===== ব্যাকআপ পাঠানোর রিমাইন্ডার: ১ দিনের বেশি নিজের Drive/WhatsApp-এ ব্যাকআপ না পাঠালে মনে করায় =====
const BACKUP_REMIND_DAYS = 1;
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
    try{ const sv = parseInt(localStorage.getItem('ssn_srv_drive_last')||'0',10); if(sv && Date.now()-sv < 36*3600*1000) return; }catch(e){}   // সার্ভার অটো ব্যাকআপ চালু ও সফল
    if(localStorage.getItem('ssn_backup_snooze_date')===todayStr()) return;
    const ts = parseInt(localStorage.getItem('ssn_last_manual_backup_ts')||'0',10);
    const days = ts ? Math.floor((Date.now()-ts)/86400000) : Infinity;
    if(days < BACKUP_REMIND_DAYS) return;
    const bar = document.createElement('div');
    bar.id = 'backupRemindBar';
    bar.style.cssText = 'position:fixed;left:10px;right:10px;bottom:84px;z-index:90;background:#fff8e1;border:1px solid #e0b84c;border-radius:14px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.25);font-size:14px;';
    bar.innerHTML = `<div style="font-weight:700;margin-bottom:4px;">🛡 ব্যাকআপ পাঠানোর সময় হয়েছে</div>
      <div style="margin-bottom:8px;">${ts ? days+' দিন ধরে' : 'এখনো'} নিজের Drive-এ ব্যাকআপ পাঠানো হয়নি। নিচের বোতাম চাপলেই সরাসরি আপনার Google Drive-এ চলে যাবে।</div>
      <div style="display:flex;gap:8px;"><button class="btn btn-primary" style="flex:1;" id="brSend">⇪ এখনই Drive-এ পাঠান</button><button class="btn btn-outline" id="brLater">পরে</button></div>`;
    document.body.appendChild(bar);
    bar.querySelector('#brSend').onclick = ()=>{ if(typeof driveBackupNow==='function') driveBackupNow(); else shareBackup(); };
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

