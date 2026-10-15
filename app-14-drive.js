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
      const client = google.accounts.oauth2.initTokenClient({
        client_id: DRIVE_CLIENT_ID, scope: DRIVE_SCOPE,
        callback: r=>{
          if(r && r.access_token){
            _driveToken = r.access_token; _driveTokenExp = Date.now() + (+r.expires_in||3600)*1000;
            try{ localStorage.setItem('ssn_drive_linked','1'); }catch(e){}
            resolve(_driveToken);
          } else reject(new Error((r && (r.error_description||r.error)) || 'লগইন হয়নি'));
        },
        error_callback: e=>reject(new Error(e && e.type==='popup_closed' ? 'লগইন জানালা বন্ধ করা হয়েছে' : (e && (e.message||e.type)) || 'লগইন ব্যর্থ'))
      });
      client.requestAccessToken({prompt: localStorage.getItem('ssn_drive_linked') ? '' : 'consent'});
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
function _driveBackupJson(){
  return JSON.stringify({ medicines, sales, purchases, customers, suppliers, payments, labTests, prescriptions, referrers, testPrices, exportedAt:new Date().toISOString() });
}
async function driveBackupNow(){
  if(typeof requireOwnerRole==='function' && !requireOwnerRole('Drive-এ ব্যাকআপ পাঠানো')) return;
  if(!navigator.onLine){ toast('ইন্টারনেট নেই — Drive-এ পাঠাতে ইন্টারনেট লাগবে'); return; }
  if(_driveBusy){ toast('আগের কাজ চলছে, একটু অপেক্ষা করুন'); return; }
  _driveBusy = true;
  try{
    const json = _driveBackupJson();
    toast('Google লগইন/অনুমতি নিয়ে Drive-এ পাঠানো হচ্ছে…');
    const folderId = await _driveFolderId(true);
    const stamp = new Date().toISOString().replace(/[:T]/g,'-').slice(0,16);
    const meta = {name:'nrisingha-backup-'+stamp+'.json', parents:[folderId], mimeType:'application/json'};
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
    try{ localStorage.setItem('ssn_last_drive_backup_ts', String(Date.now())); }catch(e){}
    try{ _markBackupShared(); }catch(e){}
    driveUpdateInfo();
    toast('✓ Drive-এ ব্যাকআপ জমা হয়েছে ('+_driveFmtSize(info && info.size || bytes)+')');
  }catch(e){
    console.error(e);
    alert('Drive-এ পাঠানো যায়নি:\n'+(e && e.message ? e.message : e)+'\n\nআপনার ডাটা অক্ষত আছে। পরে আবার চেষ্টা করুন, বা "ব্যাকআপ শেয়ার করুন" দিয়ে পাঠান।');
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
    const r = await _driveFetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id,name,createdTime,size)&orderBy=createdTime%20desc&pageSize=30');
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
