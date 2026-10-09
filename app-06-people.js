/* ---------------- Customers & Suppliers ---------------- */
let editingCustomerId = null;
function populateAgeSelects(){
  const yEl = document.getElementById('cAgeYears');
  const mEl = document.getElementById('cAgeMonths');
  if(yEl.options.length===0){
    yEl.innerHTML = '<option value="">বছর নেই</option>' + Array.from({length:101},(_,i)=>`<option value="${i}">${i} বছর</option>`).join('');
  }
  if(mEl.options.length===0){
    mEl.innerHTML = '<option value="">মাস নেই</option>' + Array.from({length:12},(_,i)=>`<option value="${i}">${i} মাস</option>`).join('');
  }
}
function formatAge(c){
  if(!c) return '';
  const parts = [];
  if(c.age) parts.push(c.age+' বছর');
  if(c.ageMonths) parts.push(c.ageMonths+' মাস');
  return parts.join(' ');
}
// ===== কাস্টমারের ছোট ছবি (ঐচ্ছিক) — সম্পূর্ণ আলাদা IndexedDB-তে ("ssn_photos"), কাস্টমার/বিক্রয়/বাকি/ব্যাকআপ/রিস্টোরের
// কোনো ডাটা বা কোডের সাথে জড়ানো নেই। ছবি সেভ/লোড ব্যর্থ হলে শুধু ছবি দেখাবে না, নামের প্রথম অক্ষর দেখাবে — আর কিছু বদলাবে না।
// ছবি শুধু এই ফোনে থাকে (ক্লাউড/JSON ব্যাকআপে যায় না)। ৯৬×৯৬ px JPEG, প্রায় ৩–৬ KB।
const _photoCache = {};
let _photoDbP = null;
function _photoDb(){
  if(_photoDbP) return _photoDbP;
  _photoDbP = new Promise((res,rej)=>{
    try{
      const r = indexedDB.open('ssn_photos', 1);
      r.onupgradeneeded = ()=>{ r.result.createObjectStore('photos', {keyPath:'id'}); };
      r.onsuccess = ()=>res(r.result); r.onerror = ()=>rej(r.error);
    }catch(e){ rej(e); }
  });
  return _photoDbP;
}
async function photoPut(id, dataUrl){ const db = await _photoDb(); return new Promise((res,rej)=>{ const t=db.transaction('photos','readwrite'); t.objectStore('photos').put({id, data:dataUrl}); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); }); }
async function photoDelete(id){ const db = await _photoDb(); return new Promise((res,rej)=>{ const t=db.transaction('photos','readwrite'); t.objectStore('photos').delete(id); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); }); }
async function photoLoadAll(){
  try{
    const db = await _photoDb();
    const rows = await new Promise((res,rej)=>{ const q=db.transaction('photos').objectStore('photos').getAll(); q.onsuccess=()=>res(q.result||[]); q.onerror=()=>rej(q.error); });
    rows.forEach(r=>{ if(r && r.id && r.data && !_photoCache[r.id]) _photoCache[r.id] = r.data; });
    try{ renderCustomers(); }catch(e){}
    try{ renderSuppliers(); }catch(e){}
  }catch(e){ console.error('photos load failed (ছবি ছাড়াই অ্যাপ চলবে)', e); }
}
function custAvatar(c, size, zoom){
  size = size || 44;
  const st = `width:${size}px;height:${size}px;border-radius:50%;flex:none;`;
  const ph = c && _photoCache[c.id];
  if(ph){
    const click = zoom ? ` onclick="event.stopPropagation();openPhotoViewer('${c.id}')"` : '';
    return `<img src="${ph}" alt=""${click} style="${st}object-fit:cover;background:#ddd;${zoom?'cursor:zoom-in;':''}">`;
  }
  const ch = Array.from(String((c&&c.name)||'?').trim())[0] || '?';
  return `<span style="${st}display:inline-flex;align-items:center;justify-content:center;background:var(--green-soft,#e8f5e9);color:var(--primary-dark,#1b4d3e);font-weight:700;font-size:${Math.round(size*0.45)}px;">${escapeHtml(ch.toUpperCase())}</span>`;
}
function refreshCustomerPhotoBox(){
  const box = document.getElementById('cPhotoBox'), hint = document.getElementById('cPhotoHint');
  if(!box || !hint) return;
  const c = editingCustomerId ? customers.find(x=>x.id===editingCustomerId) : null;
  box.style.display = c ? 'flex' : 'none';
  hint.style.display = c ? 'none' : 'block';
  if(c){
    document.getElementById('cPhotoPreview').innerHTML = custAvatar(c, 64, true);
    document.getElementById('cPhotoRemove').style.display = _photoCache[c.id] ? 'inline-block' : 'none';
    const vb = document.getElementById('cVcfBtn');
    if(vb) vb.style.display = (_photoCache[c.id] && c.mobile) ? 'inline-block' : 'none';
  }
}
// ---- ছবিসহ কন্টাক্ট ফাইল (.vcf): ফোনের Contacts-এ ইমপোর্ট করলে ওই নম্বর থেকে কল এলে ছবি ভেসে উঠবে।
// এটা শুধু একটা ফাইল তৈরি করে ডাউনলোড করে — অ্যাপের কোনো তথ্য বদলায় না, নতুন কিছু সংরক্ষণও করে না।
function _vcfEsc(t){ return String(t||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,' '); }
function _vcfFold(line){
  const out=[]; let i=0;
  while(i<line.length){ out.push((i?' ':'')+line.slice(i, i+(i?74:75))); i += (i?74:75); }
  return out.join('\r\n');
}
function _customerVcard(c){
  const mob = (typeof bnToEnDigits==='function' ? bnToEnDigits(c.mobile||'') : (c.mobile||'')).replace(/[^\d+]/g,'');
  const ph = _photoFullCache[c.id] || _photoCache[c.id];
  if(!mob || !ph) return '';
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(ph); if(!m) return '';
  const type = m[1].toUpperCase()==='JPG' ? 'JPEG' : m[1].toUpperCase();
  // নামের শেষে চিহ্ন: ফোনে "নৃসিংহ" সার্চ করলে এই সব কন্টাক্ট একসাথে পাওয়া যাবে (মুছতে সুবিধা)
  const nm = _vcfEsc((c.name||'') + ' (নৃসিংহ)');
  return [
    'BEGIN:VCARD','VERSION:3.0',
    'N:'+nm+';;;;', 'FN:'+nm,
    'TEL;TYPE=CELL:'+mob,
    _vcfFold('PHOTO;ENCODING=b;TYPE='+type+':'+m[2]),
    'END:VCARD'
  ].join('\r\n');
}
function _downloadVcf(text, filename){
  const blob = new Blob([text], {type:'text/vcard;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function downloadCustomerVcf(id){
  const c = customers.find(x=>x.id===id); if(!c) return;
  const v = _customerVcard(c);
  if(!v){ toast('ছবি ও মোবাইল নম্বর দুটোই লাগবে'); return; }
  _downloadVcf(v+'\r\n', 'contact-'+(c.name||'customer').replace(/[^\w\u0980-\u09FF]+/g,'_')+'.vcf');
  toast('ফাইল ডাউনলোড হয়েছে — খুলে Contacts-এ সেভ করুন');
}
function downloadAllCustomerVcf(){
  const eligible = customers.filter(c=>!c.provisional && _customerVcard(c))
    .sort((a,b)=>customerTotalPurchased(b.id)-customerTotalPurchased(a.id));
  if(!eligible.length){ toast('ছবি ও মোবাইল নম্বর আছে এমন কাস্টমার নেই'); return; }
  const ans = prompt('ছবি ও নম্বর আছে এমন '+eligible.length+' জন কাস্টমার আছে।\nসবচেয়ে বেশি কেনা কতজনকে ফাইলে নিতে চান?', String(Math.min(50, eligible.length)));
  if(ans===null) return;
  const n = Math.max(1, Math.min(eligible.length, parseInt(ans)||0));
  if(!parseInt(ans)){ toast('সঠিক সংখ্যা দিন'); return; }
  const cards = eligible.slice(0, n).map(_customerVcard);
  _downloadVcf(cards.join('\r\n')+'\r\n', 'customers-with-photo-'+todayStr()+'.vcf');
  toast(cards.length+' জনের কন্টাক্ট ফাইল ডাউনলোড হয়েছে — Contacts-এ "নৃসিংহ" লিখে সার্চ করলে সবাইকে পাবেন');
}
// ছবি দুই আকারে: ছোট (৯৬px, তালিকার জন্য) → ক্লাউড collection "photos"; বড় (৩৬০px, চাপলে বড় করে দেখার জন্য) → আলাদা
// collection "photos_full", শুধু ছবিতে চাপলে একটা রেকর্ড পড়া হয়। কাস্টমার/বিক্রয়/বাকির কোনো রেকর্ডে ছবি ঢোকানো নেই।
const _photoFullCache = {};
function _resizeBoth(file){
  return new Promise((res,rej)=>{
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = ()=>{
      try{
        const side = Math.min(img.width, img.height);
        const draw = (px,q)=>{ const cv=document.createElement('canvas'); cv.width=cv.height=px; cv.getContext('2d').drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,px,px); return cv.toDataURL('image/jpeg',q); };
        const out = { thumb: draw(96,0.72), full: draw(Math.min(360,side),0.75) };
        URL.revokeObjectURL(url); res(out);
      }catch(e){ rej(e); }
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); rej(new Error('ছবি পড়া যায়নি')); };
    img.src = url;
  });
}
async function pickCustomerPhoto(evt){
  const f = evt.target.files && evt.target.files[0]; const id = editingCustomerId;
  try{ evt.target.value = ''; }catch(e){}
  if(!f || !id) return;
  try{
    const {thumb, full} = await _resizeBoth(f);
    await photoPut(id, thumb);
    _photoCache[id] = thumb; _photoFullCache[id] = full;
    refreshCustomerPhotoBox(); try{ renderCustomers(); }catch(e){}
    if(cloudReady()){
      const ts = Date.now();
      shopColl('photos').doc(id).set({data:thumb, ts}).catch(e=>console.error('photo cloud save', e));
      shopColl('photos_full').doc(id).set({data:full, ts}).catch(e=>console.error('photo full cloud save', e));
      toast('ছবি যোগ হয়েছে ✓ — সব ফোনে দেখা যাবে');
    } else toast('ছবি এই ফোনে যোগ হয়েছে (ক্লাউড সংযুক্ত না থাকায় অন্য ফোনে যাবে না)');
  }catch(e){ console.error(e); toast('ছবি যোগ করা যায়নি (কাস্টমারের তথ্য অক্ষত আছে)'); }
}
async function removeCustomerPhoto(){
  const id = editingCustomerId; if(!id) return;
  try{
    await photoDelete(id); delete _photoCache[id]; delete _photoFullCache[id];
    refreshCustomerPhotoBox(); try{ renderCustomers(); }catch(e){}
    if(cloudReady()){
      shopColl('photos').doc(id).delete().catch(e=>console.error(e));
      shopColl('photos_full').doc(id).delete().catch(e=>console.error(e));
    }
    toast('ছবি সরানো হয়েছে');
  }catch(e){ console.error(e); toast('ছবি সরানো যায়নি'); }
}
// ক্লাউড ↔ ফোন ছবি মেলানো। শুধু নতুন/বদলানো/সরানো ছবির পরিবর্তন প্রয়োগ হয় — ক্লাউডে কিছু "নেই" বলে ফোনের ছবি কখনো মোছা হয় না।
let _photoUnsub = null;
function attachPhotoListener(){
  if(_photoUnsub || !cloudReady()) return;
  try{
    const coll = shopColl('photos'); let first = true;
    _photoUnsub = coll.onSnapshot(snap=>{
      let changed = false;
      snap.docChanges().forEach(ch=>{
        const id = ch.doc.id, d = ch.doc.data();
        if(ch.type==='removed'){
          if(_photoCache[id]){ delete _photoCache[id]; delete _photoFullCache[id]; photoDelete(id).catch(()=>{}); changed = true; }
        } else if(d && d.data && _photoCache[id]!==d.data){
          _photoCache[id] = d.data; delete _photoFullCache[id]; photoPut(id, d.data).catch(()=>{}); changed = true;
        }
      });
      if(changed){ try{ renderCustomers(); }catch(e){} try{ renderSuppliers(); }catch(e){} try{ refreshCustomerPhotoBox(); }catch(e){} }
      if(first && !snap.metadata.fromCache){
        first = false; // এই ফোনে আগে থেকে থাকা ছবি যেগুলো ক্লাউডে নেই, একবার উঠিয়ে দেওয়া
        const inCloud = new Set(snap.docs.map(d=>d.id));
        Object.keys(_photoCache).forEach(id=>{ if(!inCloud.has(id)) coll.doc(id).set({data:_photoCache[id], ts:Date.now()}).catch(()=>{}); });
      }
    }, err=>{ console.error('photo listener', err); _photoUnsub = null; });
  }catch(e){ console.error(e); _photoUnsub = null; }
}
let _photoViewToken = 0;
function closePhotoViewer(){ const v=document.getElementById('photoViewer'); if(v) v.remove(); _photoViewToken++; }
function openPhotoViewer(id){
  const thumb = _photoCache[id]; if(!thumb) return;
  const c = customers.find(x=>x.id===id) || {name:(typeof _photoNames!=='undefined' && _photoNames[id])||''};
  closePhotoViewer();
  const token = ++_photoViewToken;
  const v = document.createElement('div');
  v.id = 'photoViewer';
  v.setAttribute('style','position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;');
  v.onclick = closePhotoViewer;
  v.innerHTML = `<img id="photoViewerImg" src="${_photoFullCache[id]||thumb}" alt="" style="max-width:94vw;max-height:76vh;border-radius:14px;object-fit:contain;background:#222;">`+
    `<div style="color:#fff;font-weight:700;font-size:16px;">${escapeHtml((c&&c.name)||'')}</div>`+
    `<div style="color:#bbb;font-size:12px;">বন্ধ করতে যেকোনো জায়গায় চাপুন</div>`;
  document.body.appendChild(v);
  if(!_photoFullCache[id] && cloudReady()){
    shopColl('photos_full').doc(id).get().then(d=>{
      const dd = d.exists ? d.data() : null;
      if(dd && dd.data){ _photoFullCache[id] = dd.data; if(token===_photoViewToken){ const im=document.getElementById('photoViewerImg'); if(im) im.src = dd.data; } }
    }).catch(e=>console.error('full photo fetch', e));
  }
}
setTimeout(photoLoadAll, 800);

function openCustomerModal(id){
  _saleQuickAddCustomer = false;
  editingCustomerId = id || null;
  const c = id ? customers.find(x=>x.id===id) : null;
  populateAgeSelects();
  document.getElementById('cName').value = c ? c.name : '';
  document.getElementById('cGuardian').value = c ? (c.guardian||'') : '';
  document.getElementById('cMobile').value = c ? (c.mobile||'') : '';
  document.getElementById('cAddress').value = c ? (c.address||'') : '';
  document.getElementById('cAgeYears').value = c && c.age ? c.age : '';
  document.getElementById('cAgeMonths').value = c && c.ageMonths ? c.ageMonths : '';
  document.getElementById('customerModalTitle').textContent = c ? 'কাস্টমার সম্পাদনা করুন' : 'নতুন কাস্টমার';
  // কাস্টমার মুছতে পারবে শুধু মালিক-মোড; স্টাফ-মোডে বাটনই দেখা যাবে না
  document.getElementById('customerDeleteBtn').style.display = (c && currentRole()==='owner') ? 'block' : 'none';
  try{ refreshCustomerPhotoBox(); }catch(e){ console.error(e); }
  openModal('customerModalBackdrop');
}
function saveCustomer(){
 try{
  const name = document.getElementById('cName').value.trim();
  if(!name){ toast('নাম দিন'); return; }
  const guardian = document.getElementById('cGuardian').value.trim();
  const mobile = document.getElementById('cMobile').value.trim();
  const address = document.getElementById('cAddress').value.trim();
  const ageYearsVal = document.getElementById('cAgeYears').value;
  const ageMonthsVal = document.getElementById('cAgeMonths').value;
  const age = ageYearsVal ? parseInt(ageYearsVal) : null;
  const ageMonths = ageMonthsVal ? parseInt(ageMonthsVal) : null;

  // Mobile numbers can genuinely be shared by several people (a family phone), so mobile
  // alone isn't a duplicate signal — but the SAME name AND the SAME mobile together almost
  // always means this exact person is already saved. Warn instead of silently creating a
  // second record, and bring the existing one to the front rather than losing it in the list.
  if(mobile){
    const dupe = customers.find(c=>c.id!==editingCustomerId && (c.name||'').trim().toLowerCase()===name.toLowerCase() && (c.mobile||'').trim()===mobile);
    if(dupe){
      // If confirm() itself fails on this device/browser (some WebViews block JS dialogs), fail
      // OPEN (proceed with saving) rather than silently blocking every mobile-number save — a
      // false duplicate warning that can't be answered must never be able to eat real data.
      let goAhead;
      try{ goAhead = confirm(`"${dupe.name}" (${dupe.mobile}) নামে একজন কাস্টমার আগে থেকেই সংরক্ষিত আছে${dupe.due>0?' — বাকি আছে '+fmt(dupe.due):''}।\n\nতারপরও কি আলাদা একজন হিসেবে নতুন করে যোগ করতে চান?\n(বাতিল করলে আগের কাস্টমারটি দেখানো হবে)`); }
      catch(confirmErr){ console.error('confirm() failed', confirmErr); goAhead = true; }
      if(!goAhead){
        closeModal('customerModalBackdrop');
        if(_saleQuickAddCustomer){
          _saleQuickAddCustomer = false;
          renderSaleCustomerSelect();
          pickSaleCustomer(dupe.id, dupe.name);
          toast('আগের কাস্টমারটি বিক্রয়ে সিলেক্ট করা হয়েছে');
        } else {
          document.getElementById('customerSearch').value = dupe.name;
          renderCustomers();
          toast('আগের কাস্টমারটি ওপরে দেখানো হচ্ছে');
        }
        return;
      }
    }
  }

  const custId = editingCustomerId || uid();
  if(editingCustomerId){
    const c = customers.find(x=>x.id===editingCustomerId);
    if(c){ c.name=name; c.guardian=guardian; c.mobile=mobile; c.address=address; c.age=age; c.ageMonths=ageMonths; c.updatedBy=_deviceId(); c.updatedAt=Date.now(); }
  } else {
    customers.push({id:custId, name, guardian, mobile, address, age, ageMonths, due:0});
    _markJustAdded('cust', custId);
  }
  save(DB_KEYS.customer, customers);
  closeModal('customerModalBackdrop');
  renderCustomers();
  // Non-blocking heads-up (separate from the exact-duplicate confirm() above): this number is
  // already saved under a DIFFERENT name. Often legit (a shared family phone), but worth
  // surfacing plainly so it's never mistaken for "the number didn't save" — see the রুবি/আম্বিয়া
  // mix-up this exact pattern caused before it was made visible. Folded into the SAME toast as
  // the save confirmation (rather than a second toast() call right after) since this UI only
  // shows one toast at a time — a second call would just silently replace the first.
  const sameNumOtherName = mobile ? customers.find(c=>c.id!==custId && (c.mobile||'').trim()===mobile) : null;
  const sharedNumNote = sameNumOtherName ? (' ('+mobile+' নম্বরটি "'+sameNumOtherName.name+'"-এর সাথেও আছে — একই ফোন শেয়ার করলে স্বাভাবিক)') : '';
  if(_saleQuickAddCustomer){
    _saleQuickAddCustomer = false;
    renderSaleCustomerSelect();
    pickSaleCustomer(custId, name);
    toast('নতুন কাস্টমার যোগ হয়েছে ও বিক্রয়ে সিলেক্ট করা হয়েছে ✓'+sharedNumNote);
  } else {
    toast('কাস্টমার সংরক্ষিত হয়েছে ✓'+sharedNumNote);
  }
  if(cloudReady()){
    if(editingCustomerId){
      shopColl('customers').doc(custId).set({name, guardian, mobile, address, age, ageMonths, updatedBy:_deviceId(), updatedAt:Date.now()}, {merge:true}).catch(e=>console.error(e));
    } else {
      shopColl('customers').doc(custId).set({name, guardian, mobile, address, age, ageMonths, due:0}).catch(e=>console.error(e));
    }
  }
 }catch(saveErr){
   // A save that fails must NEVER fail silently — show the real error so it can be reported
   // and fixed, instead of the entry just quietly not appearing (which is what made this bug
   // so hard to pin down before).
   console.error('saveCustomer() failed', saveErr);
   alert('⚠️ কাস্টমার সংরক্ষণ করতে সমস্যা হয়েছে।\n\nকারণ (দয়া করে স্ক্রিনশট নিয়ে জানান): '+(saveErr && saveErr.message ? saveErr.message : saveErr));
 }
}
// Finds an existing customer by mobile (preferred, since names repeat) or exact name match;
// creates a new one automatically when neither matches. Used to link prescription-originated
// sales (and could be reused for other flows) to real customer records instead of leaving
// them as untracked walk-ins.
function findOrCreateCustomerFor(name, mobile, address, provisional){
  name = (name||'').trim(); mobile = (mobile||'').trim(); address = (address||'').trim();
  if(!name) return null;
  let c = null;
  if(mobile) c = customers.find(x=>(x.mobile||'').trim() === mobile);
  if(!c) c = customers.find(x=>!x.mobile && (x.name||'').trim().toLowerCase()===name.toLowerCase());
  if(c){
    // Fill in any details this record was missing, without overwriting what's already there.
    // Never touch an existing record's provisional flag here — a real customer must stay real.
    let changed = false;
    if(!c.mobile && mobile){ c.mobile = mobile; changed = true; }
    if(!c.address && address){ c.address = address; changed = true; }
    if(changed){ save(DB_KEYS.customer, customers); if(cloudReady()) shopColl('customers').doc(c.id).set({mobile:c.mobile, address:c.address}, {merge:true}).catch(e=>console.error(e)); }
    return c;
  }
  const custId = uid();
  // "provisional" customers (currently: patients only seen via a টেস্ট report) are kept out of
  // the কাস্টমার tab list (see renderCustomers) so it doesn't fill up with one-off test visitors
  // who never buy medicine — but they still resolve/search normally everywhere else (বিক্রয়
  // customer search, due lookups, etc.), and completeSale() promotes them to a real customer
  // the moment an actual medicine sale is made in their name.
  c = {id:custId, name, guardian:'', mobile, address, age:null, ageMonths:null, due:0, provisional: !!provisional};
  customers.push(c);
  save(DB_KEYS.customer, customers);
  if(cloudReady()) shopColl('customers').doc(custId).set({name, guardian:'', mobile, address, age:null, ageMonths:null, due:0, provisional: !!provisional}).catch(e=>console.error(e));
  return c;
}
// হারানো কাস্টমার উদ্ধার: প্রতিটি বিক্রয়ে customerId + customerName সংরক্ষিত থাকে। কোনো কারণে কাস্টমার
// তালিকা থেকে গায়েব হলে (রিসাইকেল বিনেও না থাকলে) বিক্রয়/পেমেন্টের রেকর্ড থেকে তাকে আবার তৈরি করা হয় —
// একই id দিয়ে, তাই আগের সব বিক্রয় ও ইতিহাস আবার তার সাথে জুড়ে যায়। বাকি = বাকি রাখা বিক্রয় + হাতে-যোগ করা বাকি − জমা।
// বিক্রয়/পেমেন্টের রেকর্ড ঘেঁটে বের করে কোন কাস্টমার তালিকায় নেই। skipTombstoned=true হলে
// ইচ্ছে করে মুছে ফেলা (রিসাইকেল বিনে থাকা) কাস্টমারদের বাদ দেয় — স্বয়ংক্রিয় উদ্ধারে যাতে তারা ফিরে না আসে।
function findMissingCustomers(skipTombstoned){
  const have = new Set(customers.map(c=>c.id));
  const tomb = skipTombstoned ? new Set(getTombstones().map(t=>t.id)) : new Set();
  const found = {};
  sales.forEach(s=>{
    if(!s.customerId || have.has(s.customerId) || tomb.has(s.customerId)) return;
    const f = found[s.customerId] || (found[s.customerId] = {id:s.customerId, name:'', lastTs:0, count:0, total:0, due:0});
    f.count++; f.total += (s.total||0); f.due += (s.dueAdded||0);
    if((s.ts||0) >= f.lastTs && s.customerName){ f.lastTs = s.ts||0; f.name = s.customerName; }
  });
  payments.forEach(p=>{
    if(!p.customerId || have.has(p.customerId) || !found[p.customerId]) return;
    if(p.type==='due_adjustment') found[p.customerId].due += (p.amount||0);
    else if(!p.type) found[p.customerId].due -= (p.amount||0);
  });
  const list = Object.values(found).map(f=>{ f.due = Math.max(f.due,0); if(!f.name) f.name='(নাম নেই)'; f.mobile=''; f.address=''; return f; });
  // হারানো কাস্টমারের মোবাইল/ঠিকানা ফেরানোর চেষ্টা: বিক্রয়ের রোগীর মোবাইল, প্রেসক্রিপশন (মোবাইল+ঠিকানা) এবং টেস্ট রেকর্ড
  // থেকে — শুধু যেখানে রোগীর নাম এই কাস্টমারের নামের সাথে মেলে (অন্য মানুষের নম্বর ভুল করে বসানো এড়াতে)।
  const nk = x=>String(x||'').toLowerCase().replace(/[\s.\-_,]+/g,'');
  list.forEach(f=>{
    const key = nk(f.name); if(!key || f.name==='(নাম নেই)') return;
    const cands = [];
    sales.forEach(s=>{
      if(s.customerId!==f.id) return;
      if(s.patientName && nk(s.patientName)===key) cands.push({ts:s.ts||0, mobile:s.patientMobile, address:''});
      const rx = s.rxId ? prescriptions.find(r=>r.id===s.rxId) : null;
      if(rx && (!rx.patientName || nk(rx.patientName)===key)) cands.push({ts:rx.ts||s.ts||0, mobile:rx.patientMobile, address:rx.patientAddress});
    });
    prescriptions.forEach(r=>{ if(nk(r.patientName)===key) cands.push({ts:r.ts||0, mobile:r.patientMobile, address:r.patientAddress}); });
    labTests.forEach(t=>{ if(nk(t.patientName)===key) cands.push({ts:t.ts||0, mobile:t.patientMobile, address:''}); });
    cands.sort((a,b)=>b.ts-a.ts);
    const m = cands.find(c=>c.mobile && String(c.mobile).trim()); if(m) f.mobile = String(m.mobile).trim();
    const a = cands.find(c=>c.address && String(c.address).trim()); if(a) f.address = String(a.address).trim();
  });
  return list;
}
function applyCustomerRecovery(list, caller){
  const tomb = new Set(list.map(f=>f.id));
  localStorage.setItem('ssn_deleted_ids', JSON.stringify(getTombstones().filter(t=>!tomb.has(t.id))));
  list.forEach(f=>{
    const rec = {id:f.id, name:f.name, guardian:'', mobile:f.mobile||'', address:f.address||'', age:null, ageMonths:null, due:f.due, provisional:false};
    customers.push(rec);
    _recentLocalWriteAt[f.id] = Date.now();
  });
  save(DB_KEYS.customer, customers);
  if(cloudReady()){
    list.forEach(f=>{
      shopColl('customers').doc(f.id).set({name:f.name, guardian:'', mobile:f.mobile||'', address:f.address||'', age:null, ageMonths:null, due:f.due, provisional:false}).catch(e=>console.error(e));
    });
  }
  try{ HistDB.add('audit', {ts:Date.now(), key:DB_KEYS.customer, label:'কাস্টমার', action:'restore', id:'', who:list.map(f=>f.name).join(', '), src:'local', dev:_deviceId(), role:currentRole(), caller:caller}); }catch(e){}
}
function recoverMissingCustomers(){
  try{
    const list = findMissingCustomers(false).sort((a,b)=>(b.lastTs||0)-(a.lastTs||0));
    if(!list.length){ toast('কোনো হারানো কাস্টমার পাওয়া যায়নি ✓'); return; }
    window._recoverList = list;
    let bd = document.getElementById('recoverPickBackdrop');
    if(!bd){
      bd = document.createElement('div');
      bd.id = 'recoverPickBackdrop';
      bd.className = 'modal-backdrop';
      bd.style.zIndex = 70;
      document.body.appendChild(bd);
    }
    bd.innerHTML = '<div class="modal">'+
      '<div class="modal-head"><h4>🧩 কাকে ফিরিয়ে আনবেন?</h4><button class="modal-close" onclick="closeRecoverPicker()">✕</button></div>'+
      '<div style="font-size:12px;color:#666;margin-bottom:8px;">বিক্রয়ের হিসাবে আছে কিন্তু কাস্টমার তালিকায় নেই — '+list.length+' জন। যাকে ফেরাতে চান শুধু তাকে টিক দিন।</div>'+
      '<input id="recoverSearch" type="text" placeholder="নাম খুঁজুন..." oninput="filterRecoverList()" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #ccc;border-radius:10px;font-size:14px;margin-bottom:8px;">'+
      '<div id="recoverRows">'+
      list.map((f,i)=>'<label class="recover-row" data-name="'+escapeHtml((f.name||'').toLowerCase())+'" style="display:flex;gap:10px;align-items:center;padding:9px 4px;border-bottom:1px solid #eee;cursor:pointer;">'+
        '<input type="checkbox" class="recover-cb" value="'+i+'" style="width:20px;height:20px;flex:none;">'+
        '<span style="flex:1;font-size:14px;"><b>'+escapeHtml(f.name)+'</b><br><span style="font-size:12px;color:#666;">'+f.count+'টা বিক্রয়, মোট '+fmt(f.total)+(f.due>0?', বাকি '+fmt(f.due):'')+(f.mobile?'<br>📞 '+escapeHtml(f.mobile):'')+(f.address?'<br>📍 '+escapeHtml(f.address):'')+'</span></span></label>').join('')+
      '</div>'+
      '<div style="display:flex;gap:8px;margin-top:12px;">'+
        '<button class="btn btn-outline" style="flex:1;" onclick="closeRecoverPicker()">বাতিল</button>'+
        '<button class="btn btn-outline" style="flex:1.4;" onclick="ignoreRecoverPicked()">আর দেখাবেন না</button>'+
        '<button class="btn btn-primary" style="flex:2;" onclick="confirmRecoverPicked()">ফেরান</button>'+
      '</div></div>';
    bd.classList.add('show');
  }catch(e){ console.error('recoverMissingCustomers failed', e); alert('উদ্ধার করা যায়নি: '+(e&&e.message?e.message:e)); }
}
function ignoreRecoverPicked(){
  try{
    const list = window._recoverList || [];
    const picked = [...document.querySelectorAll('#recoverRows .recover-cb:checked')].map(cb=>list[+cb.value]).filter(Boolean);
    if(!picked.length){ toast('কাউকে টিক দেওয়া হয়নি'); return; }
    let ign = []; try{ ign = JSON.parse(localStorage.getItem('ssn_ignored_missing_cust')||'[]'); }catch(e){}
    picked.forEach(f=>{ if(!ign.includes(f.id)) ign.push(f.id); });
    localStorage.setItem('ssn_ignored_missing_cust', JSON.stringify(ign));
    closeRecoverPicker(); toast(picked.length+' জনকে আর সতর্কতায় দেখানো হবে না'); try{ renderDashboard(); }catch(e){}
  }catch(e){ console.error(e); }
}
function closeRecoverPicker(){ const bd=document.getElementById('recoverPickBackdrop'); if(bd) bd.classList.remove('show'); }
function filterRecoverList(){
  const q = (document.getElementById('recoverSearch').value||'').trim().toLowerCase();
  document.querySelectorAll('#recoverRows .recover-row').forEach(r=>{ r.style.display = (!q || r.dataset.name.includes(q)) ? 'flex' : 'none'; });
}
function confirmRecoverPicked(){
  try{
    const list = window._recoverList || [];
    const picked = [...document.querySelectorAll('#recoverRows .recover-cb:checked')].map(cb=>list[+cb.value]).filter(Boolean);
    if(!picked.length){ toast('কাউকে টিক দেওয়া হয়নি'); return; }
    applyCustomerRecovery(picked, 'recoverMissingCustomers');
    closeRecoverPicker();
    toast(picked.map(f=>f.name).join(', ')+' — ফিরিয়ে আনা হয়েছে ✓');
    try{ renderCustomers(); renderDashboard(); }catch(e){}
  }catch(e){ console.error(e); alert('উদ্ধার করা যায়নি: '+(e&&e.message?e.message:e)); }
}
// নিরাপত্তা-জাল: পুনরুদ্ধার / ব্যাকআপ ইমপোর্ট / ক্লাউড থেকে ফেরানোর পর অ্যাপ নিজেই বিক্রয়ের রেকর্ড মিলিয়ে দেখে
// কোনো কাস্টমার হারিয়েছে কিনা, থাকলে সাথে সাথে ফিরিয়ে আনে। ইচ্ছে করে মুছে ফেলা কাস্টমার (রিসাইকেল বিনে) বাদ যায়।
function autoRecoverMissingCustomers(caller){
  try{
    const all = findMissingCustomers(true);
    if(!all.length) return 0;
    // শুধু যাদের বাকি আছে (টাকা পাওনা) তাদেরই নিজে থেকে ফেরানো হয় — কারণ ওয়াক-ইন/এক-বারের রোগীর নামও
    // বিক্রয়ে থেকে যায়, তাদের সবাইকে কাস্টমার বানানো ঠিক নয়। বাকিরা সেটিংসের "🧩 হারানো কাস্টমার উদ্ধার" থেকে বেছে ফেরানো যাবে।
    const list = all.filter(f=>f.due>0);
    if(list.length){
      applyCustomerRecovery(list, caller||'autoRecover');
      toast('🛡 বাকি আছে এমন '+list.length+' জন কাস্টমার ফিরিয়ে আনা হয়েছে: '+list.slice(0,3).map(f=>f.name).join(', ')+(list.length>3?' …':''));
      try{ renderCustomers(); renderDashboard(); }catch(e){}
    }
    return list.length;
  }catch(e){ console.error('autoRecoverMissingCustomers failed', e); return 0; }
}
function askDelete(msg){ try{ return confirm(msg); }catch(e){ console.error('confirm() failed', e); toast('নিশ্চিতকরণ বক্স খোলেনি — নিরাপত্তার জন্য মোছা হয়নি'); return false; } }
function deleteCustomer(){
  if(!editingCustomerId) return;
  if(currentRole()!=='owner'){ toast('কাস্টমার মুছতে পারবেন শুধু মালিক'); return; }
  const idToDelete = editingCustomerId;
  const _c = customers.find(x=>x.id===idToDelete);
  if(_c){
    let total = 0; try{ total = customerTotalPurchased(_c.id); }catch(e){}
    if(!askDelete(`"${_c.name}" কাস্টমারকে মুছে ফেলবেন?\n\nমোবাইল: ${_c.mobile||'—'}\nবাকি: ${fmt(_c.due||0)}\nমোট কেনাকাটা: ${fmt(total)}\n\nমুছলেও সেটিংস → "পরিবর্তনের লগ ও রিসাইকেল বিন" থেকে ফেরানো যাবে।`)) return;
    if((_c.due||0)>0 && !askDelete(`⚠ "${_c.name}"-এর নামে ${fmt(_c.due)} বাকি আছে। মুছলে এই বাকির হিসাব কাস্টমার তালিকা থেকে হারিয়ে যাবে।\n\nতবুও মুছবেন?`)) return;
  }
  customers = customers.filter(x=>x.id!==idToDelete);
  addTombstone(idToDelete);
  save(DB_KEYS.customer, customers);
  closeModal('customerModalBackdrop'); toast('কাস্টমার মুছে ফেলা হয়েছে'); renderCustomers();
  if(cloudReady()){
    shopColl('customers').doc(idToDelete).delete().catch(e=>console.error(e));
  }
}

