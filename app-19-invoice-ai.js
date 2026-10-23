// ===== ইনভয়েসের ছবি থেকে ক্রয়ের তালিকা (v72) =====
// ক্রয় ট্যাব → "📷 ইনভয়েসের ছবি থেকে"। ছবি সার্ভারে গিয়ে এআই পড়ে তালিকা ফেরত দেয়।
// এই ফাইল নিজে স্টক/ক্রয়/হিসাবে কিছু লেখে না: প্রতিটা লাইনের "ক্রয়ে বসান" চাপলে আগে থেকে ভরা অবস্থায় আপনার
// সাধারণ ক্রয় ফর্ম খোলে — ওখানে আপনি দেখে "সংরক্ষণ" চাপলে তবেই সেভ। (সব দামের সতর্কতা ওই ফর্মেরই।)
// Firebase Blaze + সার্ভার সেটআপ (INVOICE-AI-SETUP.txt) না হওয়া পর্যন্ত বন্ধ থাকে — কোনো ছবি যায় না, কোনো খরচ নেই।
const INVAI_FLAG = 'ssn_invai_on';
const INVAI_TYPE_MAP = { tab:'ট্যাবলেট', cap:'ক্যাপসুল', syrup:'সিরাপ', susp:'সাসপেনশন', inj:'ইনজেকশন', supp:'সাপোজিটরি', oint:'মলম', cream:'ক্রিম', drop:'ড্রপ', powder:'পাউডার-কৌটা' };
let _invaiResult = null, _invaiRows = [], _invaiOpenPick = -1;

function _invaiEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _invaiBn(n){ return (n==null||isNaN(n)) ? '—' : String(Math.round(n*100)/100); }

// এআই-র নামের সাথে ইনভেন্টরির ওষুধ মেলানো। exact = নাম হুবহু মিলেছে (হাইফেন/ফাঁকা বাদে); না মিললে আংশিক মিলকে "অনুমান" বলে দেখানো হয়
function invaiMatch(item, meds){
  try{
    const q = normalizeMedName(item.name||'');
    if(!q) return { med:null, exact:false };
    const wantType = INVAI_TYPE_MAP[item.type||''] || '';
    const list = meds || medicines;
    const exactList = list.filter(m=>normalizeMedName(m.name)===q);
    if(exactList.length){
      const t = wantType ? exactList.find(m=>m.type===wantType) : null;
      if(t) return { med:t, exact:true };
      if(exactList.length===1) return { med:exactList[0], exact:true };
      return { med:exactList[0], exact:false };   // একই নামে একাধিক ধরন — ব্যবহারকারী বেছে নিক
    }
    const ranked = rankMeds(list, item.name||'', false);
    if(ranked.length){
      const t = wantType ? ranked.find(m=>m.type===wantType) : null;
      return { med:t||ranked[0], exact:false };
    }
    // প্রথম শব্দ (ব্র্যান্ড) দিয়ে শেষ চেষ্টা
    const first = (item.name||'').trim().split(/\s+/)[0];
    if(first && first.length>=3){
      const r2 = rankMeds(list, first, false);
      if(r2.length){ const t = wantType ? r2.find(m=>m.type===wantType) : null; return { med:t||r2[0], exact:false }; }
    }
  }catch(e){ console.error(e); }
  return { med:null, exact:false };
}

// ছবি ছোট করা: সার্ভারে ও এআই-তে খরচ/সময় কমে; লেখা পড়ার জন্য ১৮০০px যথেষ্ট
async function invaiPrepareImage(file){
  const url = URL.createObjectURL(file);
  try{
    const img = await new Promise((res, rej)=>{ const i = new Image(); i.onload = ()=>res(i); i.onerror = ()=>rej(new Error('ছবি খোলা যায়নি')); i.src = url; });
    const MAX = 1800, sc = Math.min(1, MAX/Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth*sc); c.height = Math.round(img.naturalHeight*sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let q = 0.85, data = c.toDataURL('image/jpeg', q);
    while(data.length > 5.5*1024*1024 && q > 0.4){ q -= 0.15; data = c.toDataURL('image/jpeg', q); }
    return data.split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}

function _invaiEnsureModal(){
  if(document.getElementById('invaiModalBackdrop')) return;
  const d = document.createElement('div');
  d.className = 'modal-backdrop'; d.id = 'invaiModalBackdrop';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h4>📷 ইনভয়েসের ছবি থেকে ক্রয়</h4><button class="modal-close" onclick="closeModal(\'invaiModalBackdrop\')">✕</button></div><div id="invaiBody"></div></div>';
  document.body.appendChild(d);
}
function _invaiBody(html){ const b = document.getElementById('invaiBody'); if(b) b.innerHTML = html; }

function invaiOpen(){
  if(typeof requireOwnerRole==='function' && !requireOwnerRole('ইনভয়েসের ছবি পড়া')) return;
  _invaiEnsureModal();
  if(_invaiResult && _invaiRows.length){
    // আগের তালিকায় ফিরে আসা; মিল না পাওয়া লাইনে ইতিমধ্যে নতুন ওষুধ যোগ করে থাকলে আবার মিলিয়ে নেওয়া
    _invaiRows.forEach(r=>{ if(!r.medId && !r.done){ const m = invaiMatch(r.it); if(m.med){ r.medId = m.med.id; r.exact = m.exact; } } });
    invaiRenderReview(); openModal('invaiModalBackdrop'); return;
  }
  invaiRenderStart();
  openModal('invaiModalBackdrop');
}
function invaiRenderStart(msg){
  const err = msg ? '<div class="row-sub" style="color:#b42318;margin-bottom:8px;white-space:pre-wrap;">'+_invaiEsc(msg)+'</div>' : '';
  if(localStorage.getItem(INVAI_FLAG)!=='1'){
    _invaiBody(
      err
      +_invaiPasteBlock()
      +'<hr style="border:none;border-top:1px solid var(--border);margin:14px 0;">'
      +'<div style="font-weight:700;margin-bottom:4px;">✋ ছবি দেখে নিজে এন্ট্রি (এখনই চলে)</div>'
      +_invaiPhotoBlock()
      +'<hr style="border:none;border-top:1px solid var(--border);margin:14px 0;">'
      +'<div style="font-weight:700;margin-bottom:4px;">🤖 এআই দিয়ে স্বয়ংক্রিয় পড়া — এখনো চালু হয়নি</div>'
      +'<div class="row-sub" style="line-height:1.7;margin-bottom:8px;">এটা চালু করতে Firebase-এর Blaze প্ল্যান ও একবারের সার্ভার সেটআপ লাগে (ধাপগুলো <b>INVOICE-AI-SETUP.txt</b> ফাইলে)। তার আগে এখানে কিছু চাপলে কোনো ছবি সার্ভারে যাবে না, কোনো খরচও হবে না। সেটআপ শেষ হলে নিচের বোতাম চাপুন (এটা শুধু যাচাই করে সার্ভার তৈরি আছে কি না — এআই-কে ডাকে না):</div>'
      +'<button class="btn btn-primary btn-block" onclick="invaiEnable()">সার্ভার সেটআপ হয়ে গেছে — চালু করুন</button>');
    return;
  }
  _invaiBody(
    _invaiPasteBlock()
    +'<hr style="border:none;border-top:1px solid var(--border);margin:14px 0;">'
    +'<div class="row-sub" style="line-height:1.7;margin-bottom:8px;">ইনভয়েসের পরিষ্কার একটা ছবি দিন (পুরো পাতা, সোজা করে, আলো ঠিক রেখে)। এআই পড়ে ওষুধের তালিকা দেখাবে — <b>নিজে থেকে কিছু সেভ হবে না</b>। প্রতিটা লাইন আপনি দেখে "ক্রয়ে বসান" চাপবেন।</div>'
    +err
    +'<input type="file" id="invaiFile" accept="image/*">'
    +'<button class="btn btn-primary btn-block" id="invaiSendBtn" style="margin-top:10px;" onclick="invaiSend()">📤 ছবি পাঠিয়ে পড়ান</button>'
    +'<div class="row-sub" id="invaiProg" style="display:none;margin-top:8px;"></div>'
    +'<hr style="border:none;border-top:1px solid var(--border);margin:14px 0;">'
    +'<div style="font-weight:700;margin-bottom:4px;">✋ অথবা ছবি দেখে নিজে এন্ট্রি</div>'
    +_invaiPhotoBlock()
    +'<button class="btn btn-sm btn-outline" style="margin-top:14px;" onclick="invaiDisable()">এআই সুবিধা বন্ধ করুন</button>');
}

// ===== ছবি দেখে নিজে এন্ট্রি (Blaze/এআই ছাড়া, খরচ নেই, ছবি কোথাও যায় না) =====
// ছবিটা শুধু এই ফোনের মেমরিতে থাকে (অ্যাপ বন্ধ বা রিফ্রেশ করলে চলে যায়)। ক্রয় ফর্মে এন্ট্রির সময় নিচের বাঁদিকে "🖼 ইনভয়েস"
// বোতাম চাপলেই ছবি পর্দা জুড়ে খোলে (বড়-ছোট করা যায়), বন্ধ করলে ফর্মে ফেরা — ছবি দেখে দেখে হাতে এন্ট্রি।
let _invPhotoURL = '', _invZoom = 100;
const _INV_ZOOMS = [100, 150, 200, 300, 400];
function _invaiPhotoBlock(){
  if(!_invPhotoURL){
    return '<div class="row-sub" style="line-height:1.7;margin-bottom:8px;">ইনভয়েসের ছবি তুলুন বা গ্যালারি থেকে বাছুন। তারপর ক্রয় ফর্মে এন্ট্রির সময় ছবিটা এক চাপে খুলে দেখে নিতে পারবেন।</div>'
      +'<input type="file" id="invaiPhotoFile" accept="image/*" onchange="invaiPhotoPicked()">';
  }
  return '<div class="row-sub" style="line-height:1.7;margin-bottom:8px;color:#0a5c36;font-weight:700;">✓ ছবি রাখা আছে। ক্রয় ফর্মে নিচের বাঁদিকের "🖼 ইনভয়েস" বোতাম চাপলেই দেখতে পাবেন।</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;">'
    +'<button class="btn btn-primary" onclick="invaiStartManual()">➕ ক্রয় এন্ট্রি শুরু করুন</button>'
    +'<button class="btn btn-outline" onclick="invaiShowPhoto()">🖼 ছবি দেখুন</button>'
    +'<button class="btn btn-outline" onclick="invaiClearPhoto()">ছবি সরান</button></div>';
}
function invaiSetPhoto(file, openViewer){
  try{
    if(_invPhotoURL) URL.revokeObjectURL(_invPhotoURL);
    _invPhotoURL = URL.createObjectURL(file); _invZoom = 100;
    _invaiFloatInit(); _invaiFloatUpdate();
    if(openViewer) invaiShowPhoto();
  }catch(e){ console.error(e); toast('ছবি খোলা যায়নি'); }
}
function invaiPhotoPicked(){
  const f = (document.getElementById('invaiPhotoFile')||{}).files && document.getElementById('invaiPhotoFile').files[0];
  if(!f) return;
  invaiSetPhoto(f, false); invaiRenderStart();
}
function invaiClearPhoto(){
  try{ if(_invPhotoURL) URL.revokeObjectURL(_invPhotoURL); }catch(e){}
  _invPhotoURL = ''; invaiHidePhoto(); _invaiFloatUpdate();
  if(document.getElementById('invaiBody')) invaiRenderStart();
}
function invaiStartManual(){
  closeModal('invaiModalBackdrop');
  try{ openPurchaseModal(); }catch(e){ console.error(e); toast('ক্রয় ফর্ম খোলা যায়নি'); }
}
function invaiShowPhoto(){
  if(!_invPhotoURL){ toast('আগে একটা ছবি বেছে নিন'); return; }
  let v = document.getElementById('invaiPhotoView');
  if(!v){
    v = document.createElement('div'); v.id = 'invaiPhotoView';
    v.style.cssText = 'position:fixed;inset:0;z-index:300;background:#111;display:none;flex-direction:column;';
    v.innerHTML = '<div style="display:flex;gap:6px;padding:8px;background:#222;align-items:center;">'
      +'<button class="btn btn-sm btn-primary" onclick="invaiHidePhoto()">✕ বন্ধ</button>'
      +'<button class="btn btn-sm btn-outline" style="background:#fff;" onclick="invaiZoom(-1)">− ছোট</button>'
      +'<button class="btn btn-sm btn-outline" style="background:#fff;" onclick="invaiZoom(1)">+ বড়</button>'
      +'<span id="invaiZoomLbl" style="color:#ccc;font-size:12px;margin-left:auto;"></span></div>'
      +'<div id="invaiPhotoScroll" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;"><img id="invaiPhotoImg" alt="ইনভয়েস" style="display:block;max-width:none;"></div>';
    document.body.appendChild(v);
  }
  document.getElementById('invaiPhotoImg').src = _invPhotoURL;
  v.style.display = 'flex'; _invaiApplyZoom();
}
function invaiHidePhoto(){ const v = document.getElementById('invaiPhotoView'); if(v) v.style.display = 'none'; }
function invaiZoom(d){
  let i = _INV_ZOOMS.indexOf(_invZoom); if(i<0) i = 0;
  i = Math.max(0, Math.min(_INV_ZOOMS.length-1, i+d)); _invZoom = _INV_ZOOMS[i]; _invaiApplyZoom();
}
function _invaiApplyZoom(){
  const img = document.getElementById('invaiPhotoImg'), l = document.getElementById('invaiZoomLbl');
  if(img) img.style.width = _invZoom + '%'; if(l) l.textContent = _invZoom + '%';
}
// ভাসমান "🖼 ইনভয়েস" বোতাম — ছবি রাখা থাকলে, শুধু ক্রয় ট্যাবে বা ক্রয় ফর্ম খোলা থাকলে দেখায়
function _invaiFloatInit(){
  if(typeof document==='undefined' || !document.body || document.getElementById('invaiFloatBtn') || !document.createElement) return;
  const b = document.createElement('button');
  b.id = 'invaiFloatBtn'; b.className = 'btn btn-primary';
  b.style.cssText = 'position:fixed;left:10px;bottom:84px;z-index:120;display:none;box-shadow:0 4px 16px rgba(0,0,0,.3);border-radius:22px;padding:8px 14px;';
  b.textContent = '🖼 ইনভয়েস'; b.onclick = invaiShowPhoto;
  document.body.appendChild(b);
}
function _invaiFloatUpdate(){
  try{
    const b = document.getElementById('invaiFloatBtn'); if(!b || !b.style) return;
    const sec = document.getElementById('sec-purchase'), pm = document.getElementById('purchaseModalBackdrop');
    const onPurchase = !!((sec && sec.classList && sec.classList.contains('active')) || (pm && pm.classList && pm.classList.contains('show')));
    b.style.display = (_invPhotoURL && onPurchase) ? 'block' : 'none';
  }catch(e){}
}
if(typeof setInterval==='function'){ try{ setInterval(_invaiFloatUpdate, 700); }catch(e){} }
async function invaiEnable(){
  try{
    if(!navigator.onLine){ toast('ইন্টারনেট লাগবে'); return; }
    await _srvCall('invoiceStatus', {shop: localStorage.getItem('ssn_shop_code')});
    localStorage.setItem(INVAI_FLAG,'1'); toast('✓ চালু হয়েছে'); invaiRenderStart();
  }catch(e){ invaiRenderStart('এখনো চালু করা যায়নি:\n'+_srvErr(e)); }
}
function invaiDisable(){ localStorage.removeItem(INVAI_FLAG); _invaiResult = null; _invaiRows = []; invaiRenderStart(); }

let _invaiBusy = false;
async function invaiSend(){
  if(_invaiBusy) return;
  const f = (document.getElementById('invaiFile')||{}).files && document.getElementById('invaiFile').files[0];
  if(!f){ toast('একটা ছবি বেছে নিন'); return; }
  if(!navigator.onLine){ toast('ইন্টারনেট লাগবে'); return; }
  _invaiBusy = true;
  const prog = document.getElementById('invaiProg'), btn = document.getElementById('invaiSendBtn');
  if(btn) btn.disabled = true; if(prog){ prog.style.display = 'block'; prog.textContent = 'ছবি প্রস্তুত হচ্ছে…'; }
  try{
    const b64 = await invaiPrepareImage(f);
    invaiSetPhoto(f, false);
    if(prog) prog.textContent = 'এআই ইনভয়েস পড়ছে… (আধা থেকে ১ মিনিট লাগতে পারে)';
    const r = await _srvCall('invoiceScan', { shop: localStorage.getItem('ssn_shop_code'), image: b64, mediaType: 'image/jpeg' });
    if(!r || !Array.isArray(r.items) || !r.items.length){ _invaiBusy = false; invaiRenderStart((r && r.error) || 'ছবি থেকে কোনো ওষুধ পাওয়া যায়নি — আরেকটা স্পষ্ট ছবি দিয়ে চেষ্টা করুন।'); return; }
    _invaiResult = r;
    _invaiRows = r.items.map(it=>{ const m = invaiMatch(it); return { it, medId: m.med ? m.med.id : '', exact: m.exact, done: false }; });
    _invaiBusy = false; invaiRenderReview();
  }catch(e){
    console.error(e); _invaiBusy = false;
    const m = e && e.message || '';
    invaiRenderStart(m==='SERVER_UNREACHABLE' ? 'সার্ভার পাওয়া যায়নি। ইন্টারনেট দেখুন; আর Blaze ও সার্ভার সেটআপ হয়েছে কি না দেখুন।' : _srvErr(e));
  }
}

function invaiRenderReview(){
  const r = _invaiResult; if(!r) return invaiRenderStart();
  const t = r.totals || {};
  let h = '<div class="row-sub" style="line-height:1.7;margin-bottom:8px;">'
    +(r.supplier?'<b>'+_invaiEsc(r.supplier)+'</b>':'')+(r.invoiceNo?' • ইনভয়েস '+_invaiEsc(r.invoiceNo):'')+(r.date?' • '+_invaiEsc(r.date):'')
    +'<br>'+_invaiRows.length+'টা লাইন পাওয়া গেছে। '+(r.paste ? '<b>পেস্ট করা লিস্ট থেকে — সংখ্যাগুলো ইনভয়েসের সাথে একবার মিলিয়ে নিন।</b>' : '<b>এআই ভুল করতে পারে — প্রতিটা সংখ্যা ইনভয়েসের সাথে মিলিয়ে নিন।</b>')+'</div>'
    +_invaiPasteNotes(r);
  if(!r.paste && (t.totalTp>0 || t.netPayable>0)){
    h += '<div class="row-sub" style="background:#f3f7f4;border-radius:10px;padding:8px 10px;margin-bottom:8px;line-height:1.7;">ইনভয়েসের মোট: TP ৳'+_invaiBn(t.totalTp)+' • দেয় ৳'+_invaiBn(t.netPayable)+(t.specialDiscount>0?' • বিশেষ ছাড় ৳'+_invaiBn(t.specialDiscount):'')
      +'<br><button class="btn btn-sm btn-outline" style="margin-top:4px;" onclick="invaiSetAdj()">⚙ এই সংখ্যাগুলো "ইনভয়েস সমন্বয়"-এ বসান</button></div>';
  }
  _invaiRows.forEach((row, i)=>{
    const it = row.it, med = medicines.find(m=>m.id===row.medId);
    const warn = (!it.sure) ? ' <span style="color:#b42318;">⚠ অস্পষ্ট</span>' : '';
    h += '<div class="card" style="margin:6px 0;padding:10px;'+(row.done?'opacity:.55;':'')+'">'
      +'<div style="font-weight:700;">'+_invaiEsc(it.name)+warn+'</div>'
      +'<div class="row-sub">পরিমাণ '+it.qty+(it.bonus>0?' + বোনাস '+it.bonus:'')+(it.tp!=null?' • TP ৳'+_invaiBn(it.tp):'')+(it.lineTp!=null?' • লাইন TP ৳'+_invaiBn(it.lineTp):'')+(it.lineTotal!=null?' • লাইন মোট ৳'+_invaiBn(it.lineTotal):'')+(it.special>0?' • বিশেষ ছাড় ৳'+_invaiBn(it.special):'')+(it.batch?' • ব্যাচ '+_invaiEsc(it.batch):'')+'</div>'
      +(!(it.qty>0)&&it.bonus>0 ? '<div class="row-sub" style="color:#b45309;">🎁 শুধু বোনাস (বিনামূল্যে '+it.bonus+'টা, পরিমাণ ০) — ক্রয় ফর্মে বসে না; ওষুধের স্টকে হাতে +'+it.bonus+' করুন</div>' : '')
      +'<div class="row-sub" style="margin-top:4px;">'
      +(med ? ('ইনভেন্টরিতে: <b>'+_invaiEsc(displayMedName(med))+'</b>'+(row.exact?' ✓':' <span style="color:#b45309;">(অনুমান — মিলিয়ে নিন)</span>')) : '<span style="color:#b42318;">ইনভেন্টরিতে মিল পাওয়া যায়নি</span>')
      +'</div>';
    if(row.done){ h += '<div class="row-sub" style="color:#0a5c36;font-weight:700;margin-top:4px;">✓ ক্রয়ে বসানো হয়েছে</div>'; }
    else {
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">'
        +(med && it.qty>0 ? '<button class="btn btn-sm btn-primary" onclick="invaiEnter('+i+')">ক্রয়ে বসান</button>' : '')
        +'<button class="btn btn-sm btn-outline" onclick="invaiTogglePick('+i+')">🔍 ওষুধ বদলান</button>'
        +(!med ? '<button class="btn btn-sm btn-outline" onclick="invaiAddNew('+i+')">➕ নতুন ওষুধ</button>' : '')
        +'<button class="btn btn-sm btn-outline" onclick="invaiSkip('+i+')">বাদ দিন</button></div>';
      if(_invaiOpenPick===i){
        h += '<input type="text" id="invaiPickQ" placeholder="ওষুধের নাম লিখুন…" style="margin-top:6px;" oninput="invaiPickSearch('+i+')" value="'+_invaiEsc((it.name||'').split(/\s+/)[0])+'"><div id="invaiPickRes"></div>';
      }
    }
    h += '</div>';
  });
  const _nSeq = _invaiRows.filter(r=>!r.done && r.medId && r.exact && r.it && r.it.qty>0).length;
  if(_nSeq>=1) h += '<button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="invaiRunAll()">▶ একের পর এক বসান ('+_nSeq+'টা পাকা-মিল লাইন)</button><div class="row-sub" style="margin:4px 0 0;">প্রতিটা ফর্ম আগে থেকে ভরা থাকবে — দেখে \"সংরক্ষণ\" চাপলে পরেরটা নিজে খুলবে। অনুমান/মিল-না-পাওয়া লাইন বাদ থাকবে (ওগুলো ওপর থেকে আলাদা করে করবেন)।</div>';
  h += '<button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="invaiReset()">'+(r.paste?'নতুন লিস্ট দিন':'নতুন ছবি দিন')+' (এই তালিকা মুছে যাবে)</button>';
  _invaiBody(h);
  if(_invaiOpenPick>=0) invaiPickSearch(_invaiOpenPick);
}
function invaiReset(){ if(_invaiRows.some(r=>!r.done) && !confirm('এই তালিকার বাকি লাইনগুলো মুছে যাবে। নতুন করে দেবেন?')) return; _invaiSeq = false; _invaiSupId = ''; _invaiResult = null; _invaiRows = []; _invaiOpenPick = -1; invaiRenderStart(); }
function invaiSkip(i){ _invaiRows.splice(i,1); _invaiOpenPick = -1; if(!_invaiRows.length){ _invaiResult = null; invaiRenderStart(); } else invaiRenderReview(); }
function invaiTogglePick(i){ _invaiOpenPick = (_invaiOpenPick===i) ? -1 : i; invaiRenderReview(); }
function invaiPickSearch(i){
  const q = (document.getElementById('invaiPickQ')||{}).value || '';
  const el = document.getElementById('invaiPickRes'); if(!el) return;
  const list = rankMeds(medicines, q, false).slice(0, 8);
  el.innerHTML = list.length ? list.map(m=>'<div style="padding:8px;border-bottom:1px solid var(--border);cursor:pointer;" onclick="invaiPickSet('+i+',\''+m.id+'\')">'+_invaiEsc(displayMedName(m))+' <span class="row-sub">স্টক '+(m.stock||0)+'</span></div>').join('') : '<div class="row-sub" style="padding:6px;">কিছু পাওয়া যায়নি</div>';
}
function invaiPickSet(i, medId){ if(!_invaiRows[i]) return; _invaiRows[i].medId = medId; _invaiRows[i].exact = true; _invaiOpenPick = -1; invaiRenderReview(); }
function invaiSetAdj(){
  const t = (_invaiResult && _invaiResult.totals) || {};
  try{
    if(t.totalTp>0) _invLinesVal = String(t.totalTp);
    if(t.netPayable>0) _invPayVal = String(t.netPayable);
    if(t.specialDiscount>0) _invSpecialVal = String(t.specialDiscount);
    toast('✓ বসানো হয়েছে — এরপর যেকোনো লাইনে "ক্রয়ে বসান" চাপুন');
  }catch(e){ console.error(e); }
}

// লাইন → আপনার সাধারণ ক্রয় ফর্মে আগে থেকে ভরা অবস্থায়। সংরক্ষণ আপনি নিজে চাপবেন।
// ধারাবাহিক মোড (v81): "▶ একের পর এক বসান" চাপলে একটা সেভ হলেই পরের লাইনের ফর্ম নিজে খোলে; \"বাতিল\" করলে/ফর্ম বন্ধ করলে থেমে যায়।
let _invaiSeq = false, _invaiSupId = '';
function _invaiNextSeq(){ return _invaiRows.findIndex(r=>!r.done && r.medId && r.exact && r.it && r.it.qty>0); }
function invaiRunAll(){
  const i = _invaiNextSeq();
  if(i<0){ toast('বসানোর মতো পাকা-মিল লাইন নেই'); return; }
  _invaiSeq = true; invaiEnter(i);
}
function invaiEnter(i){
  const row = _invaiRows[i]; if(!row) return;
  const med = medicines.find(m=>m.id===row.medId); if(!med){ toast('আগে ওষুধ বেছে নিন'); return; }
  const it = row.it, before = purchases.length;
  if(!(it.qty>0)){ toast('এটা শুধু-বোনাস লাইন — ক্রয় ফর্মে বসানো যায় না (পরিমাণ ০)'); return; }
  closeModal('invaiModalBackdrop');
  openPurchaseModal(null, ()=>{
    // ফর্ম বন্ধ/সেভ হয়ে এলে: ক্রয় বাড়লে লাইনটা "হয়েছে" চিহ্ন পায়, তারপর তালিকায় ফেরা (ধারাবাহিক মোডে পরের লাইনে)
    let saved = false;
    try{ if(purchases.length > before){ row.done = true; saved = true; } }catch(e){}
    _invaiOpenPick = -1;
    if(_invaiSeq && saved){ const nx = _invaiNextSeq(); if(nx>=0){ invaiEnter(nx); return; } }
    _invaiSeq = false; invaiRenderReview(); openModal('invaiModalBackdrop');
  });
  try{
    pickPMedicine(med.id, typePrefixPlain(med.type)+med.name);
    const g = id=>document.getElementById(id);
    if(_invaiSupId){ const sp = suppliers.find(x=>x.id===_invaiSupId); if(sp) pickPSupplier(sp.id, sp.name); }
    if(it.qty>0) g('pQty').value = it.qty;
    g('pBonus').value = String(it.bonus||0);
    if(it.special>0) g('pLineSpecial').value = it.special;
    purchaseRecalc('bonus');
    if(it.lineTp>0){ g('pLineTP').value = it.lineTp; purchaseRecalc('tp'); }
    else if(it.tp>0 && it.qty>0){ g('pLineTP').value = Math.round(it.tp*it.qty*100)/100; purchaseRecalc('tp'); }
    else if(it.lineTotal>0){ g('pLineTotal').value = it.lineTotal; purchaseRecalc('total'); }
    if(it.batch) g('pBatch').value = it.batch;
    if(it.expiry) g('pExpiry').value = it.expiry;
    if(_invaiSeq){
      const total = _invaiRows.filter(r=>r.it && r.it.qty>0).length, no = _invaiRows.filter(r=>r.done).length + 1;
      const t = g('purchaseModalTitle'); if(t) t.textContent = 'ক্রয় এন্ট্রি — '+no+'/'+total+' ('+(it.name||'')+')';
    }
  }catch(e){ console.error(e); toast('কিছু ঘর ভরা যায়নি — হাতে দিন'); }
}
function invaiAddNew(i){
  const row = _invaiRows[i]; if(!row) return;
  const it = row.it;
  closeModal('invaiModalBackdrop');
  // ওষুধ-যোগ ফর্ম (নাম আগে থেকে বসানো)। সেভ করে ফিরে এলে "ওষুধ বদলান" থেকে নতুন ওষুধটা বেছে নিন
  try{ openMedModal(null, it.name); }catch(e){ console.error(e); toast('ওষুধ-যোগ ফর্ম খোলা যায়নি'); }
}

// ===== ইনভয়েসের লিস্ট পেস্ট (v81) =====
// ছবি পড়ে (Claude/অন্য এআই) যে লিস্ট দেয়, সেটা এখানে বসালে অ্যাপ নিজে লাইনগুলো সাজিয়ে ওষুধ মিলিয়ে দেয়। কিছু নিজে সেভ হয় না —
// আগের মতোই প্রতিটা লাইন আপনার সাধারণ ক্রয় ফর্মে আগে থেকে ভরা অবস্থায় খোলে, আপনি দেখে "সংরক্ষণ" চাপলে তবেই সেভ।
// লিস্টের ধরন (| দিয়ে আলাদা, ফাঁকা ঘর ফাঁকা রাখা যায়):
//   supplier: Popular            ← মাথার লাইনগুলো (সব ঐচ্ছিক): supplier, invoice, date, totalTp, net, special
//   Anzet | tab | 1 | 0 |  | 428.79 | BATCH | 2027-05-01 | 0
//   নাম | ধরন | পরিমাণ | বোনাস | লাইন-TP | লাইন-মোট(ভ্যাট-ছাড় সহ) | ব্যাচ | মেয়াদ(YYYY-MM-DD) | এই ওষুধের বিশেষ ছাড়
// লাইন-TP দিলে ইনভয়েস সমন্বয় (মোট TP ও দেয় টাকা) নিজে বসে; লাইন-মোট দিলে সমন্বয় লাগে না। নামের শেষে ? দিলে "অস্পষ্ট" চিহ্ন পড়ে।
const _INVP_TYPES = { tab:'tab', tablet:'tab', 'ট্যাবলেট':'tab', cap:'cap', capsule:'cap', 'ক্যাপসুল':'cap', syrup:'syrup', 'সিরাপ':'syrup', susp:'susp', suspension:'susp', 'সাসপেনশন':'susp',
  inj:'inj', injection:'inj', 'ইনজেকশন':'inj', supp:'supp', suppository:'supp', 'সাপোজিটরি':'supp', oint:'oint', ointment:'oint', 'মলম':'oint', cream:'cream', 'ক্রিম':'cream', drop:'drop', drops:'drop', 'ড্রপ':'drop', powder:'powder', 'পাউডার-কৌটা':'powder' };
const _INVP_HEAD = {};
[['supplier',['supplier','সাপ্লায়ার','কোম্পানি']],['invoiceNo',['invoice','invoiceno','ইনভয়েস','ইনভয়েসনং']],['date',['date','তারিখ']],
 ['totalTp',['totaltp','মোটtp','মোটটিপি']],['netPayable',['net','netpayable','নেট','নেটটাকা','দেয়','দেয়টাকা','চূড়ান্তদেয়']],['specialDiscount',['special','বিশেষছাড়']]]
 .forEach(([k,names])=>names.forEach(n=>{ _INVP_HEAD[n.normalize('NFC')] = k; }));
function _invpBn(s){ return String(s==null?'':s).replace(/[০-৯]/g, d=>'০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/[,৳]/g,''); }
function _invpNum(s){ const t = _invpBn(s).trim(); if(t==='') return null; if(!/^-?\d+(\.\d+)?$/.test(t)) return NaN; return parseFloat(t); }
function invaiParsePaste(text){
  const out = { supplier:'', invoiceNo:'', date:'', items:[], totals:{ totalTp:0, netPayable:0, specialDiscount:0 }, skipped:[], notes:[], check:null, paste:true };
  const lines = String(text||'').replace(/\r/g,'').split('\n');
  lines.forEach((raw, idx)=>{
    const line = raw.trim(), no = idx+1;
    if(!line || line[0]==='#' || /^[-=–—_\s|]+$/.test(line)) return;
    const sep = line.indexOf('|')>=0 ? '|' : (line.indexOf('\t')>=0 ? '\t' : null);
    if(!sep){
      const c = line.indexOf(':');
      if(c>0){
        const key = line.slice(0,c).replace(/[\s._-]/g,'').toLowerCase().normalize('NFC'), val = line.slice(c+1).trim(), f = _INVP_HEAD[key];
        if(f){
          if(f==='supplier'||f==='invoiceNo'||f==='date') out[f] = val;
          else { const n = _invpNum(val); if(n===null) return; if(isNaN(n)||n<0){ out.skipped.push('লাইন '+no+': "'+line+'" — সংখ্যা বোঝা যায়নি'); return; } out.totals[f] = n; }
          return;
        }
      }
      out.skipped.push('লাইন '+no+': "'+line+'" — চেনা গেল না (| দিয়ে আলাদা করা সারি বা "নাম: মান" মাথার লাইন নয়)'); return;
    }
    const c = line.split(sep).map(x=>x.trim());
    let name = c[0]||'', sure = true;
    if(/\?\s*$/.test(name)){ sure = false; name = name.replace(/\?+\s*$/,'').trim(); }
    if(!name){ out.skipped.push('লাইন '+no+': নাম নেই'); return; }
    const num = (i, label)=>{ const n = _invpNum(c[i]); if(n===null) return 0; if(isNaN(n)||n<0){ throw new Error(label+' "'+c[i]+'" ঠিক নয়'); } return n; };
    let qty, bonus, lineTp, lineTotal, special;
    try{ qty = num(2,'পরিমাণ'); bonus = num(3,'বোনাস'); lineTp = num(4,'লাইন-TP'); lineTotal = num(5,'লাইন-মোট'); special = num(8,'বিশেষ ছাড়'); }
    catch(e){ out.skipped.push('লাইন '+no+' ('+name+'): '+e.message); return; }
    if(qty!==Math.round(qty) || bonus!==Math.round(bonus)){ out.skipped.push('লাইন '+no+' ('+name+'): পরিমাণ/বোনাস পূর্ণ সংখ্যা হতে হবে'); return; }
    if(!(qty>0) && !(bonus>0)){ out.skipped.push('লাইন '+no+' ('+name+'): পরিমাণও নেই, বোনাসও নেই'); return; }
    if(qty>0 && !(lineTp>0) && !(lineTotal>0)){ out.skipped.push('লাইন '+no+' ('+name+'): দাম নেই (লাইন-TP বা লাইন-মোট দিতে হবে)'); return; }
    if(lineTp>0 && lineTotal>0){ lineTp = 0; out.notes.push(name+': লাইন-TP ও লাইন-মোট দুটোই ছিল — লাইন-মোট ধরা হয়েছে'); }
    const t = (c[1]||'').trim().toLowerCase().normalize('NFC');
    const expiry = /^\d{4}-\d{2}-\d{2}$/.test(c[7]||'') ? c[7] : '';
    out.items.push({ name, type: _INVP_TYPES[t]||'', qty, bonus, tp:null, lineTp: lineTp>0?lineTp:null, lineTotal: lineTotal>0?lineTotal:null, batch:(c[6]||'').trim(), expiry, special, sure });
  });
  // যোগফল মেলানো: লাইন-TP থাকলে মোট TP-র সাথে, শুধু লাইন-মোট থাকলে দেয় টাকার সাথে
  const r2 = x=>Math.round(x*100)/100;
  const anyTp = out.items.some(x=>x.lineTp>0), anyFin = out.items.some(x=>x.lineTotal>0);
  if(out.items.length){
    if(anyTp && !anyFin && out.totals.totalTp>0){ const sum = r2(out.items.reduce((a,x)=>a+(x.lineTp||0),0)); out.check = { label:'লাইনগুলোর TP-র যোগফল', sum, expect:out.totals.totalTp, ok: Math.abs(sum-out.totals.totalTp)<=0.05 }; }
    else if(anyFin && !anyTp && out.totals.netPayable>0){ const sum = r2(out.items.reduce((a,x)=>a+(x.lineTotal||0),0)); out.check = { label:'লাইনগুলোর মোটের যোগফল', sum, expect:out.totals.netPayable, ok: Math.abs(sum-out.totals.netPayable)<=0.05 }; }
    const spSum = r2(out.items.reduce((a,x)=>a+(x.special||0),0));
    if(!(out.totals.specialDiscount>0) && spSum>0) out.totals.specialDiscount = spSum;
    else if(out.totals.specialDiscount>0 && spSum>0 && Math.abs(spSum-out.totals.specialDiscount)>0.05) out.notes.push('বিশেষ ছাড়: মাথায় ৳'+out.totals.specialDiscount+', লাইনগুলোতে মোট ৳'+spSum+' — মিলছে না');
  }
  return out;
}
function _invaiPasteBlock(){
  return '<div style="font-weight:700;margin-bottom:4px;">📋 ইনভয়েসের লিস্ট পেস্ট করুন (এখনই চলে)</div>'
    +'<div class="row-sub" style="line-height:1.7;margin-bottom:8px;">ইনভয়েসের ছবি Claude-কে পাঠিয়ে যে লিস্ট পেয়েছেন, সেটা কপি করে এখানে বসান। অ্যাপ ওষুধ মিলিয়ে দেবে — কিছু নিজে সেভ হবে না।</div>'
    +'<textarea id="invaiPasteBox" rows="6" style="width:100%;font-size:13px;" placeholder="supplier: Popular&#10;net: 14159.30&#10;Anzet | tab | 1 | 0 |  | 428.79">'+_invaiEsc(_invaiPasteDraft)+'</textarea>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;"><button class="btn btn-outline" onclick="invaiPasteClip()">📋 ক্লিপবোর্ড থেকে বসান</button>'
    +'<button class="btn btn-primary" onclick="invaiPasteGo()">তালিকা বানান</button></div>';
}
let _invaiPasteDraft = '';
async function invaiPasteClip(){
  try{
    const t = await navigator.clipboard.readText();
    const el = document.getElementById('invaiPasteBox'); if(el) el.value = t||''; _invaiPasteDraft = t||'';
    if(!t) toast('ক্লিপবোর্ড ফাঁকা');
  }catch(e){ toast('ক্লিপবোর্ড পড়া যায়নি — বক্সে চেপে ধরে "পেস্ট" করুন'); }
}
function invaiPasteGo(){
  const el = document.getElementById('invaiPasteBox'); _invaiPasteDraft = el ? el.value : _invaiPasteDraft;
  const r = invaiParsePaste(_invaiPasteDraft);
  if(!r.items.length){ invaiRenderStart('এই লেখা থেকে কোনো ওষুধের লাইন পাওয়া যায়নি।'+(r.skipped.length?'\n\n'+r.skipped.slice(0,6).join('\n'):'\n\nলাইনের ধরন: নাম | ধরন | পরিমাণ | বোনাস | লাইন-TP | লাইন-মোট | ব্যাচ | মেয়াদ | বিশেষ ছাড়')); return; }
  // আগের ইনভয়েসের সমন্বয়/বিশেষ-ছাড়ের হিসাব ঝেড়ে ফেলা — নইলে এই ইনভয়েসে ভুল গুণক লাগত
  try{ _invLinesVal = ''; _invPayVal = ''; _invSpecialVal = ''; _invSpecialUsed = 0; _invSpecialInclVal = true; }catch(e){}
  const usesTp = r.items.some(x=>x.lineTp>0), t = r.totals;
  if(usesTp){
    if(t.totalTp>0 && t.netPayable>0){
      try{ _invLinesVal = String(t.totalTp); _invPayVal = String(t.netPayable); if(t.specialDiscount>0) _invSpecialVal = String(t.specialDiscount); }catch(e){ console.error(e); }
    } else r.notes.push('লাইন-TP দেওয়া আছে কিন্তু মাথায় totalTp ও net নেই — ইনভয়েস সমন্বয় বসেনি, ক্রয় ফর্মে হাতে দিতে হবে');
  }
  _invaiSupId = '';
  try{
    if(r.supplier && typeof suppliers!=='undefined' && typeof _coKey==='function'){
      const k = _coKey(r.supplier); const hit = k ? suppliers.filter(s=>_coKey(s.name)===k) : [];
      if(hit.length===1) _invaiSupId = hit[0].id;
    }
  }catch(e){ console.error(e); }
  _invaiResult = r; _invaiSeq = false; _invaiOpenPick = -1;
  _invaiRows = r.items.map(it=>{ const m = invaiMatch(it); return { it, medId: m.med ? m.med.id : '', exact: m.exact, done:false }; });
  invaiRenderReview();
}
function _invaiPasteNotes(r){
  if(!r || !r.paste) return '';
  let h = '';
  if(r.check){
    h += '<div class="row-sub" style="border-radius:10px;padding:8px 10px;margin-bottom:8px;line-height:1.7;background:'+(r.check.ok?'#e8f5ee':'#fdecea')+';">'
      +(r.check.ok ? '✓ <b>যোগফল মিলেছে</b>: ' : '⚠ <b>যোগফল মিলছে না</b>: ')+r.check.label+' ৳'+_invaiBn(r.check.sum)+' — ইনভয়েসে ৳'+_invaiBn(r.check.expect)+(r.check.ok?'':' (কোনো লাইন বাদ পড়েছে বা ভুল পড়া হয়েছে — ছবির সাথে মেলান)')+'</div>';
  }
  const t = r.totals||{};
  if(r.items.some(x=>x.lineTp>0) && t.totalTp>0 && t.netPayable>0){
    h += '<div class="row-sub" style="background:#f3f7f4;border-radius:10px;padding:8px 10px;margin-bottom:8px;line-height:1.7;">⚙ ইনভয়েস সমন্বয় নিজে বসেছে: মোট TP ৳'+_invaiBn(t.totalTp)+' • দেয় ৳'+_invaiBn(t.netPayable)+(t.specialDiscount>0?' • বিশেষ ছাড় ৳'+_invaiBn(t.specialDiscount):'')+'</div>';
  }
  if(_invaiSupId && typeof suppliers!=='undefined'){ const sp = suppliers.find(x=>x.id===_invaiSupId); if(sp) h += '<div class="row-sub" style="margin-bottom:8px;">সাপ্লায়ার: <b>'+_invaiEsc(sp.name)+'</b> (ফর্মে নিজে বসবে)</div>'; }
  const w = (r.notes||[]).concat(r.skipped||[]);
  if(w.length) h += '<div class="row-sub" style="color:#b45309;border-radius:10px;padding:8px 10px;margin-bottom:8px;background:#fff7e6;line-height:1.7;white-space:pre-wrap;">⚠ লক্ষ্য করুন:\n'+w.map(_invaiEsc).join('\n')+'</div>';
  return h;
}
