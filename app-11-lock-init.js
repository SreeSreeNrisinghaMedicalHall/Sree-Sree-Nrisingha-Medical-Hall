/* ---------------- App Lock (PIN) ---------------- */
let lockMode = 'enter'; // 'enter' | 'setup-step1' | 'setup-step2' | 'verify-old'
let pendingNewPin = '';
let pinTarget = 'owner'; // which PIN setup-step1/step2 is currently setting: 'owner' or 'staff'
// Baked-in fallback hash for PIN "0000" — used ONLY when this device has never been able to
// reach the cloud-canonical hash below (e.g. a fresh copy of this file that's never gone
// online). CHANGE THE PIN FROM SETTINGS THE FIRST TIME YOU OPEN THIS FILE — once that succeeds
// while online, the new hash becomes canonical in the cloud (pharmacies/{shopCode}.masterPinHash)
// and every device, trusted or not, is required to use the new PIN the next time it's online,
// superseding this fallback everywhere. A device that's copied and then NEVER goes online again
// keeps working with whatever PIN it last knew — that's an inherent limit of a file with no
// server, not something any client-side code can close; the device list below is the tool for
// cutting off a specific device you no longer trust, on top of changing the PIN itself.
const FALLBACK_PIN_HASH = '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0'; // sha256("0000")
// Brute-force lockout: a stolen phone can be tried against the PIN screen indefinitely with
// nothing else stopping it, so after MAX_PIN_ATTEMPTS wrong PINs in a row (tracked in
// localStorage, so closing/reopening the tab does NOT reset the count — sessionStorage would
// have let a thief just reload to get a fresh set of tries), the plain PIN box is replaced
// entirely with the security-question recovery flow (see showLockScreen below) — even the
// CORRECT PIN is refused until it's changed through that flow. This is a deliberate trade-off
// the user asked for: it means the owner's own honest PIN typos can also trigger it, with the
// only way back in being the security questions already used for "PIN ভুলে গেছেন" — so losing
// track of both the PIN and those two answers would mean no way back in at all; told the user
// this plainly.
const MAX_PIN_ATTEMPTS = 5;
function getFailedAttempts(){ return parseInt(localStorage.getItem('ssn_failed_attempts')||'0', 10); }
function incrementFailedAttempts(){
  const n = getFailedAttempts()+1;
  localStorage.setItem('ssn_failed_attempts', String(n));
  if(n>=MAX_PIN_ATTEMPTS) localStorage.setItem('ssn_lockout_active','1');
  return n;
}
function resetFailedAttempts(){
  localStorage.removeItem('ssn_failed_attempts');
  localStorage.removeItem('ssn_lockout_active');
}
function isLockedOut(){ return localStorage.getItem('ssn_lockout_active')==='1'; }
let activePinHash = localStorage.getItem('ssn_master_pin_hash_cache') || FALLBACK_PIN_HASH;
// Optional second, lower-privilege PIN an owner can hand to staff — it unlocks the app for
// day-to-day work but is checked separately from the owner hash above, so someone who only
// knows this one can never reach "PIN পরিবর্তন করুন" or "ডিভাইস ব্যবস্থাপনা" (both gated to
// role==='owner' — see requireOwnerRole() and applyRoleGating() below). null means no staff PIN
// has been configured yet, so only the owner PIN works to unlock the app at all.
let activeStaffPinHash = localStorage.getItem('ssn_staff_pin_hash_cache') || null;
function getDeviceToken(){
  let token = localStorage.getItem('ssn_device_token');
  if(!token){ token = uid(); localStorage.setItem('ssn_device_token', token); }
  return token;
}
async function syncMasterPinHash(){
  try{
    const shopCode = localStorage.getItem('ssn_shop_code');
    if(!shopCode) return;
    const db = await initCloud();
    if(!db) return;
    const doc = await db.collection('pharmacies').doc(shopCode).get();
    const data = doc.exists ? doc.data() : null;
    if(data && data.masterPinHash){
      activePinHash = data.masterPinHash;
      localStorage.setItem('ssn_master_pin_hash_cache', data.masterPinHash);
    }
    if(data && data.staffPinHash){
      activeStaffPinHash = data.staffPinHash;
      localStorage.setItem('ssn_staff_pin_hash_cache', data.staffPinHash);
    } else if(data && !data.staffPinHash){
      // Owner may have removed the staff PIN entirely from another device — clear it here too.
      activeStaffPinHash = null;
      localStorage.removeItem('ssn_staff_pin_hash_cache');
    }
  }catch(e){ console.error('pin hash sync failed', e); }
}
// Manual escape hatch for the "PIN doesn't match even though cloud sync shows on" confusion —
// normally syncMasterPinHash() only runs once, at the exact moment the page loads (initLockGate),
// so if the shop code got connected mid-session (after that already ran), or "closing the app"
// only backgrounded it rather than truly reloading it, the device keeps using whatever PIN hash
// it started with until a genuine fresh page load happens. This button re-runs that same fetch on
// demand, right now, with no restart needed. (found: 2026-09-27 — the staff/new-device case where
// only 0000 kept working after reconnecting cloud.)
async function forceSyncPin(){
  const shopCode = localStorage.getItem('ssn_shop_code');
  if(!shopCode){ toast('⚠️ এই ফোনে এখনো কোনো শপ কোড সংযুক্ত নেই — আগে ক্লাউড সংযোগ করুন'); return; }
  const before = activePinHash;
  await syncMasterPinHash();
  if(activePinHash === before){
    toast('ক্লাউডে গিয়ে দেখা হলো — এই ফোনে যা ছিল সেটাই এখনো সঠিক PIN হিসেবে আছে');
  } else {
    toast('✓ ক্লাউড থেকে সর্বশেষ PIN এই ফোনে নেওয়া হয়েছে — এখন লগআউট করে আসল PIN দিয়ে চেষ্টা করুন');
  }
}
function currentRole(){ return sessionStorage.getItem('ssn_role') || 'owner'; }
// Cost price (buy) drives every profit calculation in the app, and it's the specific thing the
// owner doesn't want a staff session able to read — even via the browser console, not just the
// hidden UI. Stripping the field from the shared `medicines` array itself (not just hiding it in
// rendering) means typing `medicines` in devtools during a staff session shows sell price/stock
// but never cost price. Confirmed safe to strip: no বিক্রয়/ক্রয়/কাস্টমার-tab feature reads
// med.buy — a purchase entry's price is typed fresh each time, never defaulted from it.
function stripCostPriceForStaff(){
  if(currentRole()==='staff') medicines.forEach(m=>{ delete m.buy; });
}
// If the SAME browser tab later switches from a staff session to an owner session (logout +
// re-enter the owner PIN, no page reload), the shared `medicines` array could still be the
// staff-stripped copy from a moment ago — the owner's dashboard/reports need real cost prices
// back. A plain wait for the next onSnapshot event isn't reliable (nothing else may change for a
// while), so this does one explicit fresh read instead.
async function refreshMedicinesFromCloud(){
  try{
    const db = await initCloud();
    if(!db) return;
    const coll = shopColl('medicines');
    if(!coll) return;
    const snap = await coll.get();
    const arr = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    setLiveArray('medicines', arr);
    save(DB_KEYS.med, arr);
    rerenderCurrentSection();
  }catch(e){ console.error('medicines refresh failed', e); }
}
function requireOwnerRole(actionLabel){
  if(currentRole()!=='owner'){ toast('শুধু মালিক PIN দিয়ে ঢুকলে '+(actionLabel||'এই কাজটি করা')+' যাবে'); return false; }
  return true;
}
function applyRoleGating(){
  const isOwner = currentRole()==='owner';
  const secCard = document.getElementById('pinSetupBtn');
  const staffCard = document.getElementById('staffPinBtn');
  const deviceCard = document.getElementById('deviceManageCard');
  const roleNote = document.getElementById('roleNoteText');
  if(secCard) secCard.style.display = isOwner ? 'block' : 'none';
  if(staffCard) staffCard.style.display = isOwner ? 'block' : 'none';
  if(deviceCard) deviceCard.style.display = isOwner ? 'block' : 'none';
  if(roleNote) roleNote.style.display = isOwner ? 'none' : 'block';
  // Staff only need বিক্রয়/ক্রয়/কাস্টমার for day-to-day work (sales, purchase entries, customer
  // due/payment, customer search) — the rest of the nav (হোম, প্রেসক্রিপশন, ওষুধ, টেস্ট,
  // রিপোর্ট) is hidden for a simpler screen, per the owner's own request. This is a UI
  // convenience, not a data-access restriction — showSection() above still blocks direct
  // navigation into an owner-only section defensively, but medicines/prescriptions/reports DATA
  // itself isn't separately locked down the way PIN-change/device-management are.
  document.querySelectorAll('.nav-btn').forEach(b=>{
    const sec = b.dataset.sec;
    b.style.display = (isOwner || STAFF_ALLOWED_SECTIONS.includes(sec)) ? '' : 'none';
  });
  if(!isOwner && !STAFF_ALLOWED_SECTIONS.includes(currentSection)) showSection('sale');
}
async function registerDevice(role){
  try{
    const shopCode = localStorage.getItem('ssn_shop_code');
    const db = await initCloud();
    if(!db || !shopCode) return;
    const token = getDeviceToken();
    const ref = db.collection('pharmacies').doc(shopCode).collection('devices').doc(token);
    const existing = await ref.get();
    const roleToSave = role || (existing.exists ? existing.data().role : 'owner');
    if(existing.exists){ await ref.set({lastSeen: Date.now(), role: roleToSave}, {merge:true}); }
    else{ await ref.set({name:'নতুন ডিভাইস', firstSeen: Date.now(), lastSeen: Date.now(), role: roleToSave}); }
  }catch(e){ console.error('device register failed', e); }
}
async function checkDeviceRevoked(){
  // IMPORTANT: this must only block a device that was explicitly revoked — never a device that
  // simply hasn't registered itself yet (e.g. the very first correct-PIN unlock on a brand new
  // phone, or a phone connecting to this shop code for the first time). The old version treated
  // "no devices/{token} doc" as revoked, which incorrectly locked out every genuinely new device
  // on its first login (found: 2026-09-26, new-device-onboarding bug). Revocation is now tracked
  // separately in a tombstone collection (revokedDevices) that revokeDeviceEntry() writes to and
  // is never auto-cleared, so a truly revoked device stays blocked even though it's never in
  // `devices` again, while a never-seen device is simply allowed to register normally.
  try{
    const shopCode = localStorage.getItem('ssn_shop_code');
    const db = await initCloud();
    if(!db || !shopCode) return false;
    const token = localStorage.getItem('ssn_device_token');
    if(!token) return false;
    const doc = await db.collection('pharmacies').doc(shopCode).collection('revokedDevices').doc(token).get();
    return doc.exists;
  }catch(e){ console.error('device revoke check failed', e); return false; }
}
async function renderDeviceList(){
  const wrap = document.getElementById('deviceList');
  if(!wrap || currentRole()!=='owner') return;
  const shopCode = localStorage.getItem('ssn_shop_code');
  const db = await initCloud();
  if(!db || !shopCode){ wrap.innerHTML = '<div class="empty-state" style="padding:14px;">ক্লাউড সংযোগ চালু না থাকায় ডিভাইসের তালিকা দেখা যাচ্ছে না</div>'; return; }
  wrap.innerHTML = '<div class="empty-state" style="padding:14px;">লোড হচ্ছে...</div>';
  try{
    const snap = await db.collection('pharmacies').doc(shopCode).collection('devices').get();
    const myToken = localStorage.getItem('ssn_device_token');
    if(snap.empty){ wrap.innerHTML = '<div class="empty-state" style="padding:14px;">এখনো কোনো ডিভাইস তালিকাভুক্ত হয়নি</div>'; return; }
    const rows = snap.docs.map(d=>{
      const dat = d.data();
      const isMe = d.id===myToken;
      const roleLabel = dat.role==='staff' ? ' • কর্মচারী' : ' • মালিক';
      return `<div class="row-item" style="padding:10px;">
        <div style="flex:1;min-width:0;">
          <div class="row-title" style="font-size:13.5px;">${escapeHtml(dat.name||'নামহীন ডিভাইস')}${isMe?' <span style="color:var(--primary);">(এই ফোন)</span>':''}</div>
          <div class="row-sub">শেষ দেখা: ${relativeTimeBn(dat.lastSeen||dat.firstSeen||Date.now())}${roleLabel}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-outline" style="padding:6px 10px;font-size:12px;" onclick="renameDeviceEntry('${d.id}')">নাম</button>
          ${isMe?'':`<button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" onclick="revokeDeviceEntry('${d.id}')">বাতিল</button>`}
        </div>
      </div>`;
    }).join('');
    wrap.innerHTML = rows;
  }catch(e){ console.error(e); wrap.innerHTML = '<div class="empty-state" style="padding:14px;">তালিকা আনা যায়নি — ইন্টারনেট চেক করুন</div>'; }
}
async function renameDeviceEntry(token){
  if(!requireOwnerRole('ডিভাইসের নাম বদলানো')) return;
  const name = prompt('এই ডিভাইসের নাম দিন (যেমন: আমার ফোন, দোকানের কম্পিউটার):');
  if(!name) return;
  try{
    const shopCode = localStorage.getItem('ssn_shop_code');
    const db = await initCloud();
    if(!db || !shopCode) return;
    await db.collection('pharmacies').doc(shopCode).collection('devices').doc(token).set({name}, {merge:true});
    renderDeviceList();
  }catch(e){ console.error(e); toast('নাম পরিবর্তন ব্যর্থ হয়েছে'); }
}
async function revokeDeviceEntry(token){
  if(!requireOwnerRole('ডিভাইস বাতিল করা')) return;
  if(!confirm('এই ডিভাইসের প্রবেশাধিকার বাতিল করবেন? সেই ফোন পরের বার ইন্টারনেটে এলে বন্ধ হয়ে যাবে এবং আবার PIN দিতে হবে।')) return;
  try{
    const shopCode = localStorage.getItem('ssn_shop_code');
    const db = await initCloud();
    if(!db || !shopCode) return;
    await db.collection('pharmacies').doc(shopCode).collection('revokedDevices').doc(token).set({revokedAt: Date.now()});
    await db.collection('pharmacies').doc(shopCode).collection('devices').doc(token).delete();
    toast('✓ ডিভাইসটি বাতিল করা হয়েছে');
    renderDeviceList();
  }catch(e){ console.error(e); toast('বাতিল করা ব্যর্থ হয়েছে — ইন্টারনেট চেক করুন'); }
}
async function initLockGate(){
  const unlocked = sessionStorage.getItem('ssn_unlocked')==='1';
  // Show the lock screen IMMEDIATELY, synchronously, before any network round-trip — otherwise
  // there'd be a brief window where the app is visible/usable while syncMasterPinHash() below is
  // still in flight, which defeats the whole point on a stolen phone.
  if(!unlocked) showLockScreen('enter');
  await syncMasterPinHash();
  if(unlocked){
    // Already unlocked earlier this session — but a phone that was unlocked BEFORE being lost or
    // stolen would otherwise stay open forever, so re-check revocation even here.
    const revoked = await checkDeviceRevoked();
    if(revoked){
      sessionStorage.removeItem('ssn_unlocked');
      showLockScreen('enter');
      document.getElementById('lockError').textContent = 'এই ডিভাইসের প্রবেশাধিকার বাতিল করা হয়েছে — আবার PIN দিন';
      return;
    }
    registerDevice(currentRole());
    applyRoleGating();
    if(currentRole()==='staff') stripCostPriceForStaff();
  }
}
function updateLockUI(){
  const statusEl = document.getElementById('pinStatusText');
  const setupBtn = document.getElementById('pinSetupBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if(!statusEl) return;
  statusEl.textContent = 'অ্যাপ লক সবসময় চালু থাকে — PIN ছাড়া কেউ ঢুকতে পারবে না, এই ফাইল কপি করে অন্য ফোনে খুললেও।';
  setupBtn.textContent = 'PIN পরিবর্তন করুন';
  logoutBtn.style.display = 'block';
}
function showLockScreen(mode){
  lockMode = mode;
  document.getElementById('lockScreen').style.display = 'block';
  document.getElementById('lockPinInput').value = '';
  document.getElementById('lockPinConfirm').value = '';
  document.getElementById('lockError').textContent = '';
  document.getElementById('lockPinInput').placeholder = 'PIN';
  document.getElementById('normalPinWrap').style.display = 'block';
  document.getElementById('forgotPinLink').style.display = 'inline';
  document.getElementById('forgotFlowWrap').style.display = 'none';
  if(mode==='enter'){
    if(isLockedOut()){
      document.getElementById('lockSubtitle').textContent = '🔒 বারবার ভুল PIN দেওয়ায় নিরাপত্তার জন্য বন্ধ করা হয়েছে — নিচে দুটো প্রশ্নের সঠিক উত্তর দিয়ে নতুন PIN বসান';
      document.getElementById('lockConfirmWrap').style.display = 'none';
      document.getElementById('normalPinWrap').style.display = 'none';
      document.getElementById('forgotPinLink').style.display = 'none';
      document.getElementById('forgotFlowWrap').style.display = 'block';
      return;
    }
    document.getElementById('lockSubtitle').textContent = 'অ্যাপ খুলতে PIN দিন';
    document.getElementById('lockConfirmWrap').style.display = 'none';
  } else if(mode==='verify-old'){
    document.getElementById('lockSubtitle').textContent = 'পরিবর্তন করতে আগে বর্তমান PIN দিন';
    document.getElementById('lockConfirmWrap').style.display = 'none';
  } else if(mode==='setup-step1'){
    document.getElementById('lockSubtitle').textContent = 'নতুন PIN দিন (৪ সংখ্যা বা তার বেশি)';
    document.getElementById('lockConfirmWrap').style.display = 'none';
  }
  document.getElementById('lockPinInput').focus();
}
function hideLockScreen(){
  document.getElementById('lockScreen').style.display = 'none';
  maybeAutoDownloadDueList();
}
async function submitLockPin(){
  const val = document.getElementById('lockPinInput').value.trim();
  const errEl = document.getElementById('lockError');
  if(lockMode==='enter'){
    if(isLockedOut()){
      errEl.textContent = 'নিরাপত্তার জন্য বন্ধ করা হয়েছে — উপরের প্রশ্নের উত্তর দিয়ে PIN পরিবর্তন করুন';
      return;
    }
    const hash = await sha256Hex(val);
    const pickRole = h=> (h===activePinHash) ? 'owner' : ((activeStaffPinHash && h===activeStaffPinHash) ? 'staff' : null);
    let role = pickRole(hash);
    if(!role){
      // এই ফোনের PIN-কপি পুরনো হয়ে থাকতে পারে (PIN বদলানোর খবর ফোনে পৌঁছায় শুধু অ্যাপ নতুন করে খোলার সময়)।
      // তাই ভুল গণ্য করার আগে একবার ক্লাউড থেকে সর্বশেষ PIN এনে আবার মিলিয়ে দেখা হয় — মিললে ভুল চেষ্টা গোনা হয় না।
      errEl.textContent = 'ক্লাউড থেকে সর্বশেষ PIN মিলিয়ে দেখা হচ্ছে…';
      try{ await Promise.race([syncMasterPinHash(), new Promise(r=>setTimeout(r,7000))]); }catch(e){}
      role = pickRole(hash);
      if(!role) errEl.textContent = '';
    }
    if(role){
      const revoked = await checkDeviceRevoked();
      if(revoked){ errEl.textContent = 'এই ডিভাইসের প্রবেশাধিকার বাতিল করা হয়েছে — মালিকের সাথে যোগাযোগ করুন'; return; }
      resetFailedAttempts();
      sessionStorage.setItem('ssn_unlocked','1');
      sessionStorage.setItem('ssn_role', role);
      hideLockScreen();
      registerDevice(role);
      applyRoleGating();
      if(role==='staff') stripCostPriceForStaff();
      else refreshMedicinesFromCloud(); // undo any stripping a prior staff session in this same tab may have left behind
    } else {
      const attempts = incrementFailedAttempts();
      if(isLockedOut()){
        showLockScreen('enter'); // switches straight to the locked-out recovery view
      } else {
        errEl.textContent = `ভুল PIN — আর ${MAX_PIN_ATTEMPTS-attempts} বার সুযোগ আছে`;
      }
    }
  } else if(lockMode==='verify-old'){
    const hash = await sha256Hex(val);
    if(hash !== activePinHash){
      errEl.textContent = 'ভুল PIN — আবার চেষ্টা করুন';
      return;
    }
    showLockScreen('setup-step1');
  } else if(lockMode==='setup-step1'){
    if(val.length<4){ errEl.textContent = 'অন্তত ৪ সংখ্যার PIN দিন'; return; }
    pendingNewPin = val;
    lockMode = 'setup-step2';
    document.getElementById('lockSubtitle').textContent = 'নিশ্চিত করতে আবার দিন';
    document.getElementById('lockConfirmWrap').style.display = 'block';
    document.getElementById('lockPinInput').value = '';
    document.getElementById('lockPinInput').placeholder = 'আবার PIN';
    document.getElementById('lockPinConfirm').focus();
  } else if(lockMode==='setup-step2'){
    const confirmVal = document.getElementById('lockPinInput').value.trim();
    if(confirmVal !== pendingNewPin){ errEl.textContent = 'দুটো PIN মিলছে না — আবার চেষ্টা করুন'; return; }
    const hash = await sha256Hex(pendingNewPin);
    if(pinTarget==='staff'){
      activeStaffPinHash = hash;
      localStorage.setItem('ssn_staff_pin_hash_cache', hash);
      hideLockScreen();
      document.getElementById('lockPinInput').placeholder = 'PIN';
      // A staff-pin change doesn't touch this device's own session/role — the owner stays logged
      // in as owner, this only affects what the NEXT person entering the staff PIN elsewhere gets.
      try{
        const shopCode = localStorage.getItem('ssn_shop_code');
        const db = await initCloud();
        if(db && shopCode){
          await db.collection('pharmacies').doc(shopCode).set({staffPinHash: hash}, {merge:true});
          toast('কর্মচারী PIN সেট করা হয়েছে ✓');
        } else {
          toast('⚠️ এই ফোনে সেট হয়েছে, কিন্তু ক্লাউড সংযুক্ত না থাকায় অন্য ফোনে এখনো কাজ নাও করতে পারে');
        }
      }catch(e){ console.error(e); toast('⚠️ ক্লাউডে পাঠানো যায়নি — ইন্টারনেট চেক করুন'); }
      return;
    }
    activePinHash = hash;
    localStorage.setItem('ssn_master_pin_hash_cache', hash);
    sessionStorage.setItem('ssn_unlocked','1');
    sessionStorage.setItem('ssn_role','owner');
    hideLockScreen();
    document.getElementById('lockPinInput').placeholder = 'PIN';
    updateLockUI();
    applyRoleGating();
    registerDevice('owner');
    // Push the new hash to the cloud so it becomes canonical everywhere — every device (this
    // one, any others you use, and any old copy of this file anyone else might have) will be
    // required to use the NEW PIN the next time it's online, immediately superseding the old one.
    try{
      const shopCode = localStorage.getItem('ssn_shop_code');
      const db = await initCloud();
      if(db && shopCode){
        await db.collection('pharmacies').doc(shopCode).set({masterPinHash: hash}, {merge:true});
        toast('PIN পরিবর্তন করা হয়েছে ✓ — অন্য সব ডিভাইসেও এখন এই নতুন PIN লাগবে');
      } else {
        toast('⚠️ PIN বদলেছে এই ফোনে, কিন্তু ক্লাউড সংযুক্ত না থাকায় অন্য ফোনে এখনো পুরনো PIN চলতে পারে — ক্লাউড সংযোগ করে আবার চেষ্টা করুন');
      }
    }catch(e){ console.error(e); toast('⚠️ ক্লাউডে নতুন PIN পাঠানো যায়নি — ইন্টারনেট চেক করে আবার চেষ্টা করুন, নাহলে অন্য ফোনে পুরনো PIN-ই চলবে'); }
  }
}
function openChangePinFlow(){
  pinTarget = 'owner';
  showLockScreen('verify-old');
}
function openSetStaffPinFlow(){
  if(!requireOwnerRole('কর্মচারী PIN নির্ধারণ করা')) return;
  pinTarget = 'staff';
  showLockScreen('setup-step1');
}
function doLogout(){
  sessionStorage.removeItem('ssn_unlocked');
  sessionStorage.removeItem('ssn_role');
  showLockScreen('enter');
}
const SEC_Q1_HASH = 'c7fca9923b1324293ba0c1783cf14c7474340f18e54734ebdee04786048d50af';
const SEC_Q2_HASH = 'c2e40f382fa3b1e773ef5d00aad933873be81e00dcefa4f09cd2054965d840d8';
function normalizeAnswer(s){ return (s||'').trim().replace(/\s+/g,' '); }
async function sha256Hex(str){
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function openForgotFlow(){
  document.getElementById('normalPinWrap').style.display = 'none';
  document.getElementById('forgotPinLink').style.display = 'none';
  document.getElementById('forgotFlowWrap').style.display = 'block';
  document.getElementById('secAnswer1').value = '';
  document.getElementById('secAnswer2').value = '';
  document.getElementById('lockError').textContent = '';
}
function cancelForgotFlow(){
  document.getElementById('normalPinWrap').style.display = 'block';
  document.getElementById('forgotPinLink').style.display = 'inline';
  document.getElementById('forgotFlowWrap').style.display = 'none';
  document.getElementById('lockError').textContent = '';
}
async function verifySecurityAnswers(){
  const errEl = document.getElementById('lockError');
  const btn = document.getElementById('verifySecBtn');
  const a1 = normalizeAnswer(document.getElementById('secAnswer1').value);
  const a2 = normalizeAnswer(document.getElementById('secAnswer2').value);
  if(!a1 || !a2){ errEl.textContent = 'দুটো প্রশ্নেরই উত্তর দিন'; return; }
  if(!window.crypto || !window.crypto.subtle){ errEl.textContent = 'এই ব্রাউজারে যাচাই সম্ভব নয়'; return; }
  btn.disabled = true;
  try{
    const [h1, h2] = await Promise.all([sha256Hex(a1), sha256Hex(a2)]);
    if(h1 === SEC_Q1_HASH && h2 === SEC_Q2_HASH){
      cancelForgotFlow();
      pinTarget = 'owner';
      resetFailedAttempts();
      toast('যাচাই সফল হয়েছে — এখন নতুন PIN সেট করুন');
      updateLockUI();
      showLockScreen('setup-step1');
    } else {
      errEl.textContent = 'উত্তর সঠিক নয় — আবার চেষ্টা করুন';
    }
  } finally {
    btn.disabled = false;
  }
}


/* ---------------- Init ---------------- */
// One-time cleanup: medicines typed with a bare "Supp"/"Supp." suffix (matching the old
// abbreviation) get renamed to "Suppo." per the user's request that this is the abbreviation
// actually used outside this app. Only touches সাপোজিটরি-type entries, only a trailing
// "Supp"/"Supp." (not already "Suppo...", which this correctly leaves alone), runs once ever.
(function migrateSuppToSuppo(){
  if(localStorage.getItem('ssn_migrated_suppo_v1')) return;
  let changed = 0;
  const changedItems = [];
  medicines.forEach(m=>{
    if(m.type!=='সাপোজিটরি') return;
    const re = /\bsupp\.?\s*$/i;
    if(re.test(m.name)){
      m.name = m.name.replace(re, 'Suppo.').trim();
      changed++;
      changedItems.push(m);
    }
  });
  if(changed){
    save(DB_KEYS.med, medicines);
    localStorage.setItem('ssn_migrated_suppo_v1','1');
    // Cloud sync (if configured) usually hasn't connected yet this early in Init, so push
    // these specific changes a few seconds later once it has, instead of losing them.
    const pushToCloud = ()=>{
      if(cloudLive && cloudDb){
        const batch = cloudDb.batch();
        changedItems.forEach(m=>{ const {id, ...fields} = m; batch.set(shopColl('medicines').doc(id), fields, {merge:true}); });
        batch.commit().catch(e=>console.error(e));
      }
    };
    if(localStorage.getItem('ssn_cloud_config')) setTimeout(pushToCloud, 5000);
  } else {
    localStorage.setItem('ssn_migrated_suppo_v1','1');
  }
})();
renderDashboard();
// Secondary safety net alongside the save() merge-fix above: if another tab/instance of this
// app writes new data while this tab was backgrounded (e.g. it completed a sale), refresh this
// tab's in-memory copy too — so if this tab saves something next, it's already working from
// the latest data instead of relying solely on save()'s own recovery.
window.addEventListener('storage', (e)=>{
  if(!e.key) return;
  try{
    const arrByKey = { [DB_KEYS.med]:medicines, [DB_KEYS.sale]:sales, [DB_KEYS.purchase]:purchases,
      [DB_KEYS.customer]:customers, [DB_KEYS.supplier]:suppliers, [DB_KEYS.payment]:payments,
      [DB_KEYS.labTest]:labTests, [DB_KEYS.prescription]:prescriptions,
      [DB_KEYS.referrer]:referrers, [DB_KEYS.testPrice]:testPrices };
    const arr = arrByKey[e.key];
    if(arr){ arr.length = 0; arr.push(...load(e.key)); }
  }catch(err){ console.error('storage sync failed', err); }
});
updateCloudStatus();
updateStorageUsageDisplay();
updateLockUI();
initLockGate();
if(navigator.onLine && localStorage.getItem('ssn_cloud_config') && localStorage.getItem('ssn_shop_code')){
  attachRealtimeListeners();
}
window.addEventListener('offline', ()=>{ cloudLive = false; updateCloudStatus(); });
window.addEventListener('online', ()=>{
  if(localStorage.getItem('ssn_cloud_config') && localStorage.getItem('ssn_shop_code')){
    cloudDb = null;
    attachRealtimeListeners();
  }
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('service-worker.js').catch(()=>{}); });
}
