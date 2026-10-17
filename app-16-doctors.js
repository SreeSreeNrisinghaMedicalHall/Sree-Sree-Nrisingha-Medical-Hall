/* ===== সংরক্ষিত প্রেসক্রাইবার/ডাক্তারের তালিকা (v41) =====
   - বিক্রয় ফর্মে প্রেসক্রাইবারের নাম লেখার সময় যে পরামর্শ আসে তা আগে শুধু পুরনো বিক্রি থেকে আসত। এখন মালিক আগে থেকে একসাথে অনেকজনকে (নাম + উপাধি + ধরন) সংরক্ষণ করে রাখতে পারেন।
   - তালিকা থাকে দোকানের মূল ডকুমেন্টের savedDoctors ঘরে (লিখতে পারেন শুধু মালিক — রুলসে আগে থেকেই তাই; কর্মচারী শুধু পড়ে)। নতুন কোনো কালেকশন/রুলস লাগে না।
   - সব ফোনে অ্যাপ খোলার সময় নিজে মিলে যায়। ক্লাউডে যেতে না পারলে এই ফোনে থাকে এবং পরে মালিকের ফোন অনলাইনে খুললে পাঠানো হয়। */
function savedDoctors(){
  try{ const a = JSON.parse(localStorage.getItem('ssn_saved_doctors')||'[]'); return Array.isArray(a) ? a : []; }catch(e){ return []; }
}
function _dkey(n){ return (n||'').trim().toLowerCase(); }
function _doctorsWrite(list){
  try{ localStorage.setItem('ssn_saved_doctors', JSON.stringify(list)); }catch(e){}
}
async function _doctorsPush(list){
  const shop = localStorage.getItem('ssn_shop_code');
  if(!cloudReady() || !shop){ try{ localStorage.setItem('ssn_saved_doctors_dirty','1'); }catch(e){} return false; }
  try{
    await cloudDb.collection('pharmacies').doc(shop).set({savedDoctors:list}, {merge:true});
    try{ localStorage.removeItem('ssn_saved_doctors_dirty'); }catch(e){}
    return true;
  }catch(e){
    console.error(e); try{ localStorage.setItem('ssn_saved_doctors_dirty','1'); }catch(e2){}
    return false;
  }
}
// অ্যাপ খোলার সময় ক্লাউডের মূল ডকুমেন্ট থেকে মেলানো (deltaSyncCloudFlag থেকে ডাকা হয়)
function doctorsSyncFromShopDoc(x){
  if(!x) return;
  let owner = false; try{ owner = currentRole()==='owner'; }catch(e){}
  if(localStorage.getItem('ssn_saved_doctors_dirty')==='1' && owner){ _doctorsPush(savedDoctors()); return; }   // আগে যে পরিবর্তন ক্লাউডে যায়নি সেটাই আগে পাঠাই
  if(Array.isArray(x.savedDoctors)) _doctorsWrite(x.savedDoctors);
}
async function _doctorsCommit(list, msg){
  _doctorsWrite(list);
  const ok = await _doctorsPush(list);
  toast(ok ? (msg||'✓ সংরক্ষিত') : (msg||'✓ সংরক্ষিত')+' (এই ফোনে; ক্লাউডে পরে যাবে)');
  try{ localStorage.setItem('ssn_hidden_prescribers', JSON.stringify(getHiddenPrescribers().filter(k=>!list.some(d=>_dkey(d.name)===k)))); }catch(e){}
}
function _upsertDoctor(list, d){
  const k = _dkey(d.name); if(!k) return false;
  const i = list.findIndex(x=>_dkey(x.name)===k);
  if(i>=0){ list[i] = Object.assign({}, list[i], {name:d.name.trim(), title:d.title||'', type:d.type||list[i].type||''}); return 'updated'; }
  list.push({id:uid(), name:d.name.trim(), title:d.title||'', type:d.type||''}); return 'added';
}
const _DTYPE = {doctor:'ডাক্তার', paramedic:'প্যারামেডিক', samo:'উপ-সহকারী মেডিকেল অফিসার', other:'অন্যান্য'};
function doctorsOpenManager(){
  let owner = false; try{ owner = currentRole()==='owner'; }catch(e){}
  const list = savedDoctors().slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  document.getElementById('detailModalTitle').textContent = '👨‍⚕️ সংরক্ষিত প্রেসক্রাইবার';
  document.getElementById('detailModalContent').innerHTML =
    (owner ? `<button class="btn btn-primary btn-block" onclick="doctorsBulkOpen()">＋ একসাথে অনেকজনকে যোগ করুন</button>
              <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="doctorsSaveCurrent()">★ এখন ফর্মে যে প্রেসক্রাইবার লেখা আছে তাকে সংরক্ষণ করুন</button>` :
             `<div class="row-sub" style="margin-bottom:8px;">তালিকা বদলাতে পারেন শুধু মালিক। এখান থেকে একজনকে বেছে নিন।</div>`) +
    `<div style="margin-top:10px;">` +
    (list.length ? list.map(d=>`<div class="row-item" style="align-items:center;gap:8px;"><div style="flex:1;min-width:0;cursor:pointer;" onclick="doctorsPick('${d.id}')"><div class="row-title">${escapeHtml(d.name)}</div><div class="row-sub">${escapeHtml(_DTYPE[d.type]||'')}${d.type&&d.title?' • ':''}${escapeHtml(d.title||'')}</div></div>${owner?`<span style="color:var(--red,#c0392b);font-size:18px;padding:4px 8px;cursor:pointer;" onclick="doctorsDelete('${d.id}')">🗑</span>`:''}</div>`).join('') : '<div class="empty-state">এখনো কাউকে সংরক্ষণ করা হয়নি</div>') +
    `</div><button class="btn btn-outline btn-block" style="margin-top:12px;" onclick="closeModal('detailModalBackdrop')">বন্ধ করুন</button>`;
  openModal('detailModalBackdrop');
}
function doctorsPick(id){
  const d = savedDoctors().find(x=>x.id===id); if(!d) return;
  document.getElementById('saleDoctorName').value = d.name;
  document.getElementById('saleDoctorTitle').value = d.title||'';
  if(d.type) document.getElementById('saleDoctorType').value = d.type;
  try{ backupPrescriberFields(); }catch(e){}
  closeModal('detailModalBackdrop');
}
async function doctorsDelete(id){
  if(!requireOwnerRole('প্রেসক্রাইবার তালিকা বদলানো')) return;
  const list = savedDoctors(); const d = list.find(x=>x.id===id); if(!d) return;
  if(!confirm('"'+d.name+'" কে তালিকা থেকে মুছবেন?\n\n(পুরনো বিক্রির রেকর্ড বদলাবে না।)')) return;
  await _doctorsCommit(list.filter(x=>x.id!==id), '✓ তালিকা থেকে মোছা হয়েছে');
  doctorsOpenManager();
}
async function doctorsSaveCurrent(){
  if(!requireOwnerRole('প্রেসক্রাইবার সংরক্ষণ')) return;
  const name = (document.getElementById('saleDoctorName').value||'').trim();
  if(!name){ toast('আগে প্রেসক্রাইবারের নাম লিখুন'); return; }
  const list = savedDoctors();
  const r = _upsertDoctor(list, {name, title:(document.getElementById('saleDoctorTitle').value||'').trim(), type:document.getElementById('saleDoctorType').value});
  await _doctorsCommit(list, r==='updated' ? '✓ হালনাগাদ হয়েছে' : '✓ সংরক্ষিত হয়েছে');
  doctorsOpenManager();
}
function doctorsBulkOpen(){
  if(!requireOwnerRole('প্রেসক্রাইবার সংরক্ষণ')) return;
  document.getElementById('detailModalTitle').textContent = '＋ একসাথে অনেকজনকে যোগ করুন';
  document.getElementById('detailModalContent').innerHTML = `
    <div class="row-sub" style="line-height:1.6;margin-bottom:8px;">প্রতি লাইনে একজন লিখুন: <b>নাম, উপাধি/প্রতিষ্ঠান</b> (কমা বা | দিয়ে আলাদা)। উপাধি না থাকলে শুধু নাম।<br>যেমন:<br>ডা. করিম, MBBS, মেডিসিন বিশেষজ্ঞ<br>রহিম | প্যারামেডিক, আমতলী</div>
    <label>সবার ধরন</label>
    <select id="dbType"><option value="doctor">ডাক্তার (এমবিবিএস)</option><option value="paramedic">প্যারামেডিক</option><option value="samo">উপ-সহকারী মেডিকেল অফিসার</option><option value="other">অন্যান্য</option></select>
    <textarea id="dbText" rows="9" style="margin-top:8px;width:100%;" autocomplete="off" placeholder="প্রতি লাইনে একজন..."></textarea>
    <button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="doctorsBulkSave()">✓ সংরক্ষণ করুন</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="doctorsOpenManager()">ফিরে যান</button>`;
}
function doctorsParseBulk(text, type){
  const out = [];
  String(text||'').split(/\r?\n/).forEach(line=>{
    line = line.trim(); if(!line) return;
    const m = line.match(/^([^|,،]+)[|,،]\s*([\s\S]*)$/);
    const name = (m ? m[1] : line).trim(), title = (m ? m[2] : '').trim();
    if(name) out.push({name, title, type});
  });
  return out;
}
async function doctorsBulkSave(){
  if(!requireOwnerRole('প্রেসক্রাইবার সংরক্ষণ')) return;
  const rows = doctorsParseBulk(document.getElementById('dbText').value, document.getElementById('dbType').value);
  if(!rows.length){ toast('অন্তত একজনের নাম লিখুন'); return; }
  const list = savedDoctors(); let a = 0, u = 0;
  rows.forEach(d=>{ const r = _upsertDoctor(list, d); if(r==='added') a++; else if(r==='updated') u++; });
  await _doctorsCommit(list, '✓ '+a+' জন নতুন'+(u?', '+u+' জন হালনাগাদ':'')+' সংরক্ষিত');
  doctorsOpenManager();
}

// ব্যাকআপ থেকে ফেরানোর সময়: এই ফোনে/ক্লাউডে যে নাম আগে থেকে আছে সেগুলো বদলায় না, শুধু যেগুলো নেই সেগুলো যোগ হয়
async function doctorsMergeFromBackup(arr){
  if(!Array.isArray(arr) || !arr.length) return 0;
  const list = savedDoctors(); let added = 0;
  arr.forEach(d=>{
    if(!d || !d.name || !String(d.name).trim()) return;
    const k = _dkey(d.name);
    if(list.some(x=>_dkey(x.name)===k)) return;
    list.push({id:d.id||uid(), name:String(d.name).trim(), title:d.title||'', type:d.type||''}); added++;
  });
  if(!added) return 0;
  _doctorsWrite(list);
  let owner = false; try{ owner = currentRole()==='owner'; }catch(e){}
  if(owner) await _doctorsPush(list); else { try{ localStorage.setItem('ssn_saved_doctors_dirty','1'); }catch(e){} }
  return added;
}
