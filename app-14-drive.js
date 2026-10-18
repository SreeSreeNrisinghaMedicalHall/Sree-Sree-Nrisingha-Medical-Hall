/* ===== সরাসরি Google Drive ব্যাকআপ (v33) =====
   - ব্যাকআপ যায় মালিকের নিজের Google Drive-এ, "Nrisingha Backups" ফোল্ডারে, তারিখ-সময়সহ আলাদা ফাইল (আগেরগুলো মোছা হয় না)।
   - অনুমতি (scope) শুধু drive.file: অ্যাপ কেবল নিজের বানানো ফাইল/ফোল্ডার দেখতে পারে, আপনার ড্রাইভের আর কিছু নয়।
   - লগইন টোকেন শুধু মেমোরিতে থাকে (প্রায় ১ ঘণ্টা); কোথাও জমা হয় না।
   - ফাইলটা আগের মতো সাধারণ JSON, তাই চাইলে "ফাইল থেকে পুনরুদ্ধার করুন" দিয়েও ফেরানো যায়।
   - ফোনে যে ডাটা আছে সেটাই যায় (ইতিহাস সীমা চালু থাকলে নতুন ফোনে শুধু সীমার পরের বিক্রি-ক্রয়)। */
const DRIVE_CLIENT_ID = '293634939170-s1so7vp1glsv45l4nqdiosjtngh9o5u9.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'Nrisingha Backups';
let _driveToken = null, _driveTokenExp = 0, _driveBusy = false;

function _driveLoadGis(){
  return new Promise((res, rej)=>{
    if(window.google && google.accounts && google.accounts.oauth2) return res();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = ()=>res();
    s.onerror = ()=>rej(new Error('গুগলের লগইন স্ক্রিপ্ট আনা যায়নি — ইন্টারনেট দেখুন'));
    document.head.appendChild(s);
  });
}
function _driveGetToken(){
  return new Promise(async (resolve, reject)=>{
    try{
      if(_driveToken && Date.now() < _driveTokenExp - 60000) return resolve(_driveToken);
      await _driveLoadGis();
      // v46: যে গুগল অ্যাকাউন্টে Drive ব্যাকআপ যায় তার ইমেইল একবার মনে রাখি, পরেরবার "অ্যাকাউন্ট বাছুন" পর্দা ছাড়াই সেটাতে ঢোকে (ফোনে একাধিক গুগল অ্যাকাউন্ট থাকলে রোজ এই পর্দা আসত)
      const _hint = localStorage.getItem('ssn_drive_email') || '';
      const client = google.accounts.oauth2.initTokenClient({
        client_id: DRIVE_CLIENT_ID, scope: DRIVE_SCOPE, ...(_hint ? {hint:_hint} : {}),
        callback: r=>{
          if(r && r.access_token){
            _driveToken = r.access_token; _driveTokenExp = Date.now() + (+r.expires_in||3600)*1000;
            try{ localStorage.setItem('ssn_drive_linked','1'); }catch(e){}
            try{
              if(!localStorage.getItem('ssn_drive_email')){
                fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {headers:{Authorization:'Bearer '+_driveToken}})
                  .then(x=>x.json()).then(j=>{ const em = j && j.user && j.user.emailAddress; if(em) localStorage.setItem('ssn_drive_email', em); }).catch(()=>{});
              }
            }catch(e){}
            resolve(_driveToken);
          } else reject(new Error((r && (r.error_description||r.error)) || 'লগইন হয়নি'));
        },
        error_callback: e=>reject(new Error(e && e.type==='popup_closed' ? 'লগইন জানালা বন্ধ করা হয়েছে' : (e && (e.message||e.type)) || 'লগইন ব্যর্থ'))
      });
      client.requestAccessToken({prompt: localStorage.getItem('ssn_drive_linked') ? '' : 'consent', ...(_hint ? {hint:_hint} : {})});
    }catch(e){ reject(e); }
  });
}
async function _driveFetch(url, opts, retried){
  const t = await _driveGetToken();
  const o = Object.assign({}, opts||{});
  o.headers = Object.assign({}, (opts&&opts.headers)||{}, {Authorization:'Bearer '+t});
  const r = await fetch(url, o);
  if(r.status===401 && !retried){ _driveToken = null; return _driveFetch(url, opts, true); }
  if(!r.ok){
    let m = ''; try{ const j = await r.clone().json(); m = (j.error && (j.error.message||j.error)) || ''; }catch(e){}
    throw new Error('Drive '+r.status+(m ? ': '+m : ''));
  }
  return r;
}
async function _driveFolderId(create){
  const q = "name='"+DRIVE_FOLDER_NAME+"' and mimeType='application/vnd.google-apps.folder' and trashed=false";
  const r = await _driveFetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id)&pageSize=1&spaces=drive');
  const j = await r.json();
  if(j.files && j.files[0]) return j.files[0].id;
  if(!create) return null;
  const c = await _driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({name:DRIVE_FOLDER_NAME, mimeType:'application/vnd.google-apps.folder'})
  });
  return (await c.json()).id;
}
function _driveBuildMultipart(meta, json, boundary){
  return '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+
         '\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+json+'\r\n--'+boundary+'--';
}
function _driveFmtSize(n){ n = +n||0; return n>=1048576 ? (n/1048576).toFixed(1)+' MB' : Math.max(1,Math.round(n/1024))+' KB'; }
function _driveBackupObj(salesArr, purchArr){
  const o = { medicines, sales: salesArr||sales, purchases: purchArr||purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices, savedDoctors:(typeof savedDoctors==='function'?savedDoctors():[]), exportedAt:new Date().toISOString() };
  // ইতিহাস সীমা চালু থাকলে "আগের জের" হিসাবও ব্যাকআপে রাখা (শুধু তথ্য হিসেবে; ফেরানোর সময় ব্যবহার হয় না)
  try{ if(typeof histOn==='function' && histOn()){ o.histFrom = histFrom(); o.histBase = JSON.parse(localStorage.getItem('ssn_hist_base')||'null'); } }catch(e){}
  return o;
}
function _driveBackupJson(){ return JSON.stringify(_driveBackupObj()); }
const DRIVE_KEEP = 30;   // রোজকার ব্যাকআপের সর্বশেষ কতগুলো রাখা হবে (FULL- ফাইল কখনো মোছা হয় না)
function _driveStamp(){ return new Date().toISOString().replace(/[:T]/g,'-').slice(0,16); }
async function _driveUpload(json, name){
  const folderId = await _driveFolderId(true);
  const meta = {name:name, parents:[folderId], mimeType:'application/json'};
  const bytes = new Blob([json]).size;
  let info;
  if(bytes <= 4500000){
    const b = 'ssnbnd'+Date.now();
    const r = await _driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size', {
      method:'POST', headers:{'Content-Type':'multipart/related; boundary='+b}, body:_driveBuildMultipart(meta, json, b)
    });
    info = await r.json();
  } else {
    // বড় ফাইল: resumable আপলোড (প্রথমে সেশন খোলা, তারপর একবারে পুরো ফাইল)
    const s = await _driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size', {
      method:'POST', headers:{'Content-Type':'application/json; charset=UTF-8'}, body:JSON.stringify(meta)
    });
    const loc = s.headers.get('Location');
    if(!loc) throw new Error('বড় ফাইলের আপলোড শুরু করা যায়নি');
    const up = await fetch(loc, {method:'PUT', headers:{'Content-Type':'application/json'}, body:json});
    if(!up.ok) throw new Error('আপলোড ব্যর্থ ('+up.status+')');
    info = await up.json();
  }
  return {info:info, bytes:bytes, folderId:folderId};
}
// শুধু "nrisingha-backup-" দিয়ে শুরু হওয়া রোজকার ফাইল মোছে; "FULL-" ফাইলে হাত দেয় না। ব্যর্থ হলে ব্যাকআপের কোনো ক্ষতি নেই।
async function _drivePrune(folderId){
  try{
    const q = "'"+folderId+"' in parents and trashed=false";
    const r = await _driveFetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id,name,createdTime)&orderBy=createdTime%20desc&pageSize=200');
    const files = ((await r.json()).files || []).filter(f=>/^nrisingha-backup-/.test(f.name||''));
    const old = files.slice(DRIVE_KEEP);
    for(const f of old){ try{ await _driveFetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(f.id), {method:'DELETE'}); }catch(e){ console.warn('prune failed', e); } }
  }catch(e){ console.warn('drive prune skipped', e); }
}
async function driveBackupNow(opts){
  const auto = !!(opts && opts.auto);
  if(!auto && typeof requireOwnerRole==='function' && !requireOwnerRole('Drive-এ ব্যাকআপ পাঠানো')) return;
  if(!navigator.onLine){ if(!auto) toast('ইন্টারনেট নেই — Drive-এ পাঠাতে ইন্টারনেট লাগবে'); return; }
  if(_driveBusy){ if(!auto) toast('আগের কাজ চলছে, একটু অপেক্ষা করুন'); return; }
  _driveBusy = true;
  try{
    const json = _driveBackupJson();
    if(auto){
      // অটো চেষ্টায় লগইন জানালা না এলে/আটকে গেলে ৪৫ সেকেন্ড পর ছেড়ে দেওয়া হয়
      await Promise.race([_driveGetToken(), new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),45000))]);
    } else toast('Google লগইন/অনুমতি নিয়ে Drive-এ পাঠানো হচ্ছে…');
    const up = await _driveUpload(json, 'nrisingha-backup-'+_driveStamp()+'.json');
    try{ localStorage.setItem('ssn_last_drive_backup_ts', String(Date.now())); }catch(e){}
    try{ _markBackupShared(); }catch(e){}
    driveUpdateInfo();
    toast('✓ Drive-এ ব্যাকআপ জমা হয়েছে ('+_driveFmtSize(up.info && up.info.size || up.bytes)+')');
    await _drivePrune(up.folderId);
  }catch(e){
    console.error(e);
    if(!auto) alert('Drive-এ পাঠানো যায়নি:\n'+(e && e.message ? e.message : e)+'\n\nআপনার ডাটা অক্ষত আছে। পরে আবার চেষ্টা করুন, বা "ব্যাকআপ শেয়ার করুন" দিয়ে পাঠান।');
  }finally{ _driveBusy = false; }
}
// পূর্ণ আর্কাইভ: ইতিহাস সীমা চালু থাকলে ক্লাউড থেকে পুরনো বিক্রি-ক্রয় একবার এনে পুরো ইতিহাসসহ আলাদা ফাইল রাখে। এই ফাইল কখনো নিজে মোছা হয় না।
async function driveFullArchive(){
  if(typeof requireOwnerRole==='function' && !requireOwnerRole('পূর্ণ আর্কাইভ')) return;
  if(!navigator.onLine){ toast('ইন্টারনেট নেই — ইন্টারনেট লাগবে'); return; }
  if(_driveBusy){ toast('আগের কাজ চলছে, একটু অপেক্ষা করুন'); return; }
  const limited = (typeof histOn==='function') && histOn();
  if(limited){
    if(!cloudReady()){ toast('পুরনো ডাটা আনতে ক্লাউড সংযোগ লাগবে'); return; }
    if(!confirm('পূর্ণ আর্কাইভের জন্য ক্লাউড থেকে '+histBn(histDateStr())+'-এর আগের সব বিক্রি-ক্রয় একবার আনা হবে।\n\nযত রেকর্ড, তত Firebase "পড়া" খরচ হবে (শুধু এই একবার)।\n\nচালিয়ে যাবেন?')) return;
  } else if(!confirm('পুরো ডাটার একটা আলাদা "FULL" ব্যাকআপ Drive-এ রাখা হবে। এটা কখনো নিজে মোছা হবে না।\n\nচালিয়ে যাবেন?')) return;
  _driveBusy = true;
  try{
    let allSales = sales, allPurch = purchases;
    if(limited){
      toast('ক্লাউড থেকে পুরনো বিক্রি-ক্রয় আনা হচ্ছে…');
      const hf = histFrom();
      const [s,p] = await Promise.all(['sales','purchases'].map(n=>shopColl(n).where('ts','<',hf).get({source:'server'})));
      const sIds = new Set(sales.map(x=>x.id)), pIds = new Set(purchases.map(x=>x.id));
      allSales = sales.concat(s.docs.filter(d=>!sIds.has(d.id)).map(deltaRec));
      allPurch = purchases.concat(p.docs.filter(d=>!pIds.has(d.id)).map(deltaRec));
    }
    toast('Google লগইন/অনুমতি নিয়ে Drive-এ পাঠানো হচ্ছে…');
    const json = JSON.stringify(_driveBackupObj(allSales, allPurch));
    const up = await _driveUpload(json, 'FULL-nrisingha-backup-'+_driveStamp()+'.json');
    try{ localStorage.setItem('ssn_last_drive_backup_ts', String(Date.now())); }catch(e){}
    try{ _markBackupShared(); }catch(e){}
    driveUpdateInfo();
    toast('✓ পূর্ণ আর্কাইভ জমা হয়েছে ('+allSales.length+'টা বিক্রি, '+_driveFmtSize(up.info && up.info.size || up.bytes)+')');
  }catch(e){
    console.error(e);
    alert('পূর্ণ আর্কাইভ পাঠানো যায়নি:\n'+(e && e.message ? e.message : e)+'\n\nআপনার ডাটা অক্ষত আছে।');
  }finally{ _driveBusy = false; }
}
async function driveRestoreList(){
  if(typeof requireOwnerRole==='function' && !requireOwnerRole('Drive থেকে ফেরানো')) return;
  if(!navigator.onLine){ toast('ইন্টারনেট নেই — Drive থেকে আনতে ইন্টারনেট লাগবে'); return; }
  if(_driveBusy){ toast('আগের কাজ চলছে, একটু অপেক্ষা করুন'); return; }
  _driveBusy = true;
  try{
    toast('Drive-এর ব্যাকআপ তালিকা আনা হচ্ছে…');
    const fid = await _driveFolderId(false);
    if(!fid){ toast('Drive-এ এই অ্যাপের কোনো ব্যাকআপ পাওয়া যায়নি'); return; }
    const q = "'"+fid+"' in parents and trashed=false";
    const r = await _driveFetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id,name,createdTime,size)&orderBy=createdTime%20desc&pageSize=50');
    const files = (await r.json()).files || [];
    document.getElementById('detailModalTitle').textContent = '☁ Google Drive-এর ব্যাকআপ';
    document.getElementById('detailModalContent').innerHTML = files.length
      ? '<div class="row-sub" style="margin-bottom:8px;line-height:1.5;">যেটা ফেরাতে চান সেটা চাপুন। ফেরানোর সময় এই ফোনের বর্তমান ডাটা মোছা হয় না — ব্যাকআপের ডাটা মিলিয়ে নেওয়া হয়।</div>' +
        files.map(f=>`<div class="row-item" style="cursor:pointer;" onclick="driveRestoreFile('${f.id}')"><div><div class="row-title">${escapeHtml(new Date(f.createdTime).toLocaleString('bn-BD'))}</div><div class="row-sub">${escapeHtml(f.name)} • ${_driveFmtSize(f.size)}</div></div><div class="row-right"><span class="badge badge-gold">ফেরান</span></div></div>`).join('')
      : '<div class="empty-state">কোনো ব্যাকআপ ফাইল নেই</div>';
    openModal('detailModalBackdrop');
  }catch(e){
    console.error(e); alert('Drive থেকে তালিকা আনা যায়নি:\n'+(e && e.message ? e.message : e));
  }finally{ _driveBusy = false; }
}
async function driveRestoreFile(id){
  if(_driveBusy){ toast('আগের কাজ চলছে, একটু অপেক্ষা করুন'); return; }
  if(!confirm('এই Drive ব্যাকআপ থেকে ডাটা ফেরাবেন?\n\nএই ফোনের বর্তমান ডাটা মোছা হবে না, ব্যাকআপের ডাটা মিলিয়ে নেওয়া হবে।')) return;
  _driveBusy = true;
  try{
    toast('Drive থেকে ডাটা নামানো হচ্ছে… একটু অপেক্ষা করুন');
    const r = await _driveFetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media');
    const data = JSON.parse(await r.text());
    if(!data || typeof data!=='object' || !LIVE_COLLECTIONS.some(c=>Array.isArray(data[c.arrKey]))){ toast('ফাইলটি সঠিক ব্যাকআপ নয়'); return; }
    try{ deltaForceFull(); }catch(e){}
    try{ closeModal('detailModalBackdrop'); }catch(e){}
    await safeRestore(data, 'Drive ব্যাকআপ', {incomingWins:false});
    showSection('dashboard'); cloudPush();
  }catch(e){
    console.error(e); alert('Drive থেকে ফেরানো যায়নি:\n'+(e && e.message ? e.message : e)+'\n\nএই ফোনের ডাটা বদলায়নি।');
  }finally{ _driveBusy = false; }
}
function driveUpdateInfo(){
  const el = document.getElementById('driveDirectInfo'); if(!el) return;
  const ts = parseInt(localStorage.getItem('ssn_last_drive_backup_ts')||'0',10);
  el.textContent = ts ? 'শেষ সরাসরি Drive ব্যাকআপ: '+new Date(ts).toLocaleString('bn-BD') : 'এখনো সরাসরি Drive-এ ব্যাকআপ পাঠানো হয়নি।';
}
// লগইন জানালা যাতে ট্যাপের সাথে সাথে খোলে, তাই গুগলের স্ক্রিপ্ট আগেভাগে নামিয়ে রাখা (ইন্টারনেট থাকলে)
try{ setTimeout(()=>{ driveUpdateInfo(); if(navigator.onLine) _driveLoadGis().catch(()=>{}); }, 4000); }catch(e){}
// ===== সার্ভার অটো Drive ব্যাকআপ (v39): Firebase Blaze প্ল্যান + একবারের সার্ভার সেটআপ লাগে (FUNCTIONS-SETUP.txt) =====
// চালু হলে সার্ভার প্রতি রাতে নিজে Drive-এ পাঠায় — অ্যাপ বন্ধ থাকলেও। এই বোতাম শুধু Google-এর অনুমতি সার্ভারকে দেয়।
const SRV_REGION = 'asia-south1';
function _srvUrl(name){
  let cfg = {}; try{ cfg = JSON.parse(localStorage.getItem('ssn_cloud_config')||'{}'); }catch(e){}
  if(!cfg.projectId) throw new Error('আগে ক্লাউড সংযোগ করুন');
  return 'https://'+SRV_REGION+'-'+cfg.projectId+'.cloudfunctions.net/'+name;
}
async function _srvCall(name, data){
  const u = (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
  if(!u) throw new Error('নিরাপদ লগইন (মালিকের ইমেইল) লাগবে');
  const tok = await u.getIdToken();
  let r;
  try{ r = await fetch(_srvUrl(name), {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+tok}, body:JSON.stringify({data:data||{}})}); }
  catch(e){ throw new Error('SERVER_UNREACHABLE'); }   // ফাংশন ডিপ্লয় না থাকলেও ব্রাউজারে এভাবেই দেখায়
  let j = null; try{ j = await r.json(); }catch(e){}
  if(r.status===404) throw new Error('SERVER_UNREACHABLE');
  if(!r.ok || (j && j.error)) throw new Error((j && j.error && j.error.message) || ('HTTP '+r.status));
  return j && j.result;
}
function _srvErr(e){
  const m = e && e.message || String(e);
  if(m==='SERVER_UNREACHABLE') return 'সার্ভার ফাংশন পাওয়া যায়নি। ইন্টারনেট দেখুন; আর Blaze প্ল্যান ও একবারের সার্ভার সেটআপ (FUNCTIONS-SETUP.txt) না করা থাকলে আগে সেটা করতে হবে।';
  if(m==='no_refresh_token') return 'Google স্থায়ী অনুমতি দেয়নি। myaccount.google.com/permissions খুলে এই অ্যাপের অনুমতি সরিয়ে দিন, তারপর আবার "চালু করুন" চাপুন।';
  return m;
}
function srvDriveInfoSet(t){ const el = document.getElementById('srvDriveInfo'); if(el) el.textContent = t; }
async function srvDriveRefresh(quiet){
  try{
    if(typeof currentRole==='function' && currentRole()!=='owner') return;
    if(!navigator.onLine) return;
    const st = await _srvCall('driveStatus', {shop: localStorage.getItem('ssn_shop_code')});
    if(st.linked){
      localStorage.setItem('ssn_srv_drive_on','1');
      if(st.lastOk) localStorage.setItem('ssn_srv_drive_last', String(st.lastOk)); else localStorage.removeItem('ssn_srv_drive_last');
      srvDriveInfoSet('✓ চালু আছে। '+(st.lastOk ? 'শেষ সফল: '+new Date(st.lastOk).toLocaleString('bn-BD')+' ('+st.lastFile+')' : 'প্রথম ব্যাকআপ আজ রাত ২টায় হবে, বা "এখনই পরীক্ষা চালান" চাপুন।')+(st.lastError ? '\n⚠️ শেষ সমস্যা: '+st.lastError : ''));
    } else {
      localStorage.removeItem('ssn_srv_drive_on'); localStorage.removeItem('ssn_srv_drive_last');
      srvDriveInfoSet('বন্ধ আছে।');
    }
  }catch(e){ if(!quiet) srvDriveInfoSet('অবস্থা জানা যায়নি: '+_srvErr(e)); }
}
async function srvDriveLink(){
  if(typeof requireOwnerRole==='function' && !requireOwnerRole('সার্ভার অটো ব্যাকআপ চালু করা')) return;
  if(!navigator.onLine){ toast('ইন্টারনেট লাগবে'); return; }
  if(!confirm('সার্ভার অটো ব্যাকআপ চালু করবেন?\n\n• Firebase Blaze প্ল্যান ও একবারের সার্ভার সেটআপ আগে করা থাকতে হবে।\n• এরপর প্রতি রাত ২টায় সার্ভার নিজে আপনার Drive-এ ব্যাকআপ পাঠাবে।\n• Google অনুমতি চাইবে (শুধু এই অ্যাপের নিজের ফাইলের জন্য)।')) return;
  try{
    srvDriveInfoSet('Google অনুমতি নেওয়া হচ্ছে…');
    await _driveLoadGis();
    const code = await new Promise((res, rej)=>{
      const cl = google.accounts.oauth2.initCodeClient({
        client_id: DRIVE_CLIENT_ID, scope: DRIVE_SCOPE, ux_mode: 'popup',
        callback: r=>{ if(r && r.code) res(r.code); else rej(new Error((r && r.error) || 'অনুমতি পাওয়া যায়নি')); },
        error_callback: e=>rej(new Error('Google জানালা খোলেনি বা বন্ধ হয়েছে'+(e && e.type ? ' ('+e.type+')' : '')))
      });
      cl.requestCode();
    });
    srvDriveInfoSet('সার্ভারে যুক্ত করা হচ্ছে…');
    await _srvCall('driveLink', {code: code, shop: localStorage.getItem('ssn_shop_code')});
    toast('✓ সার্ভার অটো ব্যাকআপ চালু হয়েছে');
    await srvDriveRefresh();
  }catch(e){ console.error(e); srvDriveInfoSet('চালু করা যায়নি: '+_srvErr(e)); alert('সার্ভার অটো ব্যাকআপ চালু করা যায়নি:\n'+_srvErr(e)); }
}
async function srvDriveUnlink(){
  if(typeof requireOwnerRole==='function' && !requireOwnerRole('সার্ভার অটো ব্যাকআপ বন্ধ করা')) return;
  if(!confirm('সার্ভার অটো ব্যাকআপ বন্ধ করবেন?\n\nDrive-এ আগের ফাইলগুলো থেকে যাবে। Google-এর অনুমতিও বাতিল হবে।')) return;
  try{ await _srvCall('driveUnlink', {shop: localStorage.getItem('ssn_shop_code')}); toast('সার্ভার অটো ব্যাকআপ বন্ধ করা হয়েছে'); await srvDriveRefresh(); }
  catch(e){ alert('বন্ধ করা যায়নি:\n'+_srvErr(e)); }
}
async function srvDriveRunNow(){
  if(typeof requireOwnerRole==='function' && !requireOwnerRole('সার্ভার ব্যাকআপ পরীক্ষা')) return;
  try{
    srvDriveInfoSet('সার্ভার এখন ব্যাকআপ বানাচ্ছে… (১ মিনিট মতো লাগতে পারে)');
    const r = await _srvCall('driveRunNow', {shop: localStorage.getItem('ssn_shop_code')});
    if(r && r.ok) toast('✓ সার্ভার থেকে Drive-এ ব্যাকআপ গেছে ('+r.file+')'); else alert('সার্ভার ব্যাকআপ হয়নি:\n'+((r && r.error) || 'অজানা'));
    await srvDriveRefresh();
  }catch(e){ srvDriveInfoSet('পরীক্ষা ব্যর্থ: '+_srvErr(e)); alert('পরীক্ষা চালানো যায়নি:\n'+_srvErr(e)); }
}
// সার্ভার অটো চালু থাকলে ও ৩৬ ঘণ্টার মধ্যে সফল হলে ফোনের নিজের চেষ্টা/রিমাইন্ডার দরকার নেই
function srvDriveRecentlyOk(){ const t = parseInt(localStorage.getItem('ssn_srv_drive_last')||'0',10); return !!(t && Date.now()-t < 36*3600*1000); }
try{ setTimeout(()=>{ if(localStorage.getItem('ssn_srv_drive_on')) srvDriveRefresh(true); }, 2000); }catch(e){}

// দিনে একবার (অ্যাপ খোলা থাকলে) নিজে Drive-এ পাঠানোর চেষ্টা। লগইন জানালা না এলে চুপচাপ ছেড়ে দেয় — তখন রিমাইন্ডার বার দেখাবে।
function driveAutoTry(){
  try{
    if(typeof currentRole==='function' && currentRole()!=='owner') return;
    if(!navigator.onLine || _driveBusy) return;
    if(srvDriveRecentlyOk()) return;   // সার্ভার নিজেই পাঠাচ্ছে
    if(!(medicines.length || sales.length || customers.length)) return;
    if(!localStorage.getItem('ssn_drive_linked')) return;   // একবার Drive যুক্ত করার পরেই
    const last = parseInt(localStorage.getItem('ssn_last_drive_backup_ts')||'0',10);
    if(Date.now()-last < 20*3600*1000) return;
    if(localStorage.getItem('ssn_drive_auto_date')===todayStr()) return;   // দিনে একবারের বেশি জানালা খুলবে না
    localStorage.setItem('ssn_drive_auto_date', todayStr());
    driveBackupNow({auto:true});
  }catch(e){}
}
try{ setTimeout(driveAutoTry, 3500); setInterval(driveAutoTry, 60*60*1000); }catch(e){}
