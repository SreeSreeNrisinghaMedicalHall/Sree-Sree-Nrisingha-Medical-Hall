/* ---------------- Medicines ---------------- */
let editingMedId = null;
let _purchaseReturnPending = false;
const ANTIBIOTIC_KEYWORDS = ['amox','moxyl','moxaclav','clavurox','clav','augmentin','flubac','floxacillin','cloxacillin','ampicillin','penicillin',
  'cephalexin','cephradine','cefixime','cefuroxime','cefpodoxime','cefdinir','cefaclor','ceftriaxone','cefotaxime','cefepime','cefadroxil','cef',
  'ciproflox','ciprocin','cipro','ofloxacin','levoflox','moxiflox','gatiflox','floxacin',
  'azithro','zimax','clarithro','erythromycin','roxithromycin',
  'doxycycline','doxy','tetracycline','minocycline',
  'metronidazole','flagyl','tinidazole','secnidazole','metrogyl',
  'gentamicin','genta','tobramycin','amikacin','streptomycin','kanamycin',
  'vancomycin','linezolid','clindamycin','rifampicin','rifampin',
  'cotrimoxazole','co-trimoxazole','sulfamethoxazole','trimethoprim','nitrofurantoin',
  'chloramphenicol','meropenem','imipenem','ertapenem','fosfomycin','colistin'];
function looksLikeAntibiotic(name, generic){
  const text = (name+' '+generic).toLowerCase();
  return ANTIBIOTIC_KEYWORDS.some(k=>text.includes(k));
}
function checkAutoAntibiotic(){
  if(editingMedId) return; // don't override an existing medicine's saved value
  const name = document.getElementById('mName').value||'';
  const generic = document.getElementById('mGeneric').value||'';
  const hint = document.getElementById('autoAbxHint');
  if(looksLikeAntibiotic(name, generic)){
    document.getElementById('mAntibiotic').checked = true;
    if(hint) hint.style.display = 'block';
  } else {
    if(hint) hint.style.display = 'none';
  }
}
function onMedTypeChange(){
  const type = document.getElementById('mType').value;
  const needsBottle = (type==='সিরাপ' || type==='সাসপেনশন' || type==='ড্রপ' || type==='এন্টিসেপটিক');
  const needsPackDays = (type==='মলম' || type==='ক্রিম' || type==='শ্যাম্পু' || type==='এন্টিসেপটিক' || type==='ইনহেলার');
  const needsPackCount = (type==='পাউডার/কৌটা');
  document.getElementById('mBottleSizeWrap').style.display = needsBottle ? 'block' : 'none';
  document.getElementById('mPackDaysWrap').style.display = needsPackDays ? 'block' : 'none';
  document.getElementById('mPackCountWrap').style.display = needsPackCount ? 'block' : 'none';
  const bottleLabel = document.getElementById('mBottleSizeLabel');
  const bottleDesc = document.getElementById('mBottleSizeDesc');
  const packDaysLabel = document.getElementById('mPackDaysLabel');
  const packDaysDesc = document.getElementById('mPackDaysDesc');
  if(type==='এন্টিসেপটিক'){
    if(bottleLabel) bottleLabel.textContent = 'বোতলের সাইজ (মিলি)';
    if(bottleDesc) bottleDesc.textContent = 'শুধু তথ্যের জন্য — কত মিলির বোতল সেটা মনে রাখতে। বিক্রির হিসাবে এই সংখ্যাটা ব্যবহার হয় না, নিচের "কতদিন চলে" সংখ্যাটাই হিসাব করে।';
    if(packDaysLabel) packDaysLabel.textContent = 'একটা বোতল সাধারণত কতদিন চলে *';
    if(packDaysDesc) packDaysDesc.textContent = 'এন্টিসেপটিক (যেমন Viodine, Hexisol, Savlon) তো খাওয়া হয় না, শুধু ব্যবহার হয় — তাই প্রেসক্রিপশনে যা ডোজের মতো লেখা থাকুক না কেন, বিক্রির সময় হিসাব হবে না; শুধু এই "কতদিন চলে" সংখ্যা দিয়েই হিসাব হবে।';
  } else {
    if(bottleLabel) bottleLabel.textContent = 'বোতলের সাইজ (মিলি) *';
    if(bottleDesc) bottleDesc.textContent = 'প্রেসক্রিপশন থেকে বিক্রি করার সময় কতটা মিলি লাগবে সেই হিসাব থেকে ঠিক কয়টা বোতল দরকার তা বের করতে এটা ব্যবহার হয়। (ড্রপের ক্ষেত্রে ১ মিলি = ২০ ফোঁটা ধরে হিসাব হয়)';
    if(packDaysLabel) packDaysLabel.textContent = 'একটা সাধারণত কতদিন চলে (স্বাভাবিক ব্যবহারে) *';
    if(packDaysDesc) packDaysDesc.textContent = 'মলম/ক্রিম/শ্যাম্পু একবেলা বা একদিনে শেষ হয় না — এটা দিয়ে বোঝানো হয় স্বাভাবিক ব্যবহারে (যেমন দিনে ২ বার) একটা টিউব/বোতল কতদিন চলে। বিক্রির সময় এই হিসাব থেকেই দিন অনুযায়ী কয়টা লাগবে বের হবে।';
  }
  if(type==='ইনহেলার'){
    if(packDaysLabel) packDaysLabel.textContent = 'একটা ইনহেলার সাধারণত কতদিন চলে (দিন) *';
    if(packDaysDesc) packDaysDesc.textContent = 'যেমন: ৭ (সাধারণত ৫–৭ দিন চলে)। প্রেসক্রিপশন থেকে বিক্রির সময় এই হিসাব থেকেই দিন অনুযায়ী কয়টা ইনহেলার লাগবে বের হবে (সবসময় পুরো ইনহেলার, উপরের দিকে রাউন্ড হয়ে)।';
  }
}
function closeMedModal(){
  // Plain ✕/cancel out of the medicine-add form — if it was opened as the "add this medicine"
  // shortcut from the purchase form, that purchase modal is still sitting hidden underneath, so
  // bring it back instead of leaving the pharmacist with nothing on screen.
  closeModal('medModalBackdrop');
  if(_purchaseReturnPending){
    _purchaseReturnPending = false;
    openModal('purchaseModalBackdrop');
  }
  _posReturnPending = false;
}
function openMedModal(id, prefillName){
  editingMedId = id || null;
  const m = id ? medicines.find(x=>x.id===id) : null;
  document.getElementById('mName').value = m ? m.name : (prefillName || '');
  document.getElementById('mType').value = m ? (m.type||'ট্যাবলেট') : 'ট্যাবলেট';
  document.getElementById('mBottleSize').value = m ? (m.bottleSize||'') : '';
  document.getElementById('mPackDays').value = m ? (m.packDays||'') : '';
  document.getElementById('mPackCount').value = m ? (m.packCount||'') : '';
  onMedTypeChange();
  document.getElementById('mGeneric').value = m ? (m.generic||'') : '';
  document.getElementById('mCompany').value = m ? (m.company||'') : '';
  document.getElementById('mBuy').value = m ? m.buy : '';
  document.getElementById('mSell').value = m ? m.sell : '';
  document.getElementById('mBatch').value = m ? (m.batch||'') : '';
  document.getElementById('mExpiry').value = m ? (m.expiry||'') : '';
  document.getElementById('mStock').value = m ? m.stock : 0;
  document.getElementById('mLowLimit').value = m ? m.lowLimit : 10;
  document.getElementById('mAntibiotic').checked = m ? !!m.isAntibiotic : false;
  document.getElementById('autoAbxHint').style.display = 'none';
  document.getElementById('medModalTitle').textContent = m ? 'ওষুধ সম্পাদনা করুন' : 'নতুন ওষুধ যোগ করুন';
  document.getElementById('medDeleteBtn').style.display = m ? 'block' : 'none';
  openModal('medModalBackdrop');
}
function saveMedicine(){
  const name = document.getElementById('mName').value.trim().replace(/\s+/g,' ');
  const sell = parseFloat(document.getElementById('mSell').value)||0;
  const buy = parseFloat(document.getElementById('mBuy').value)||0;
  if(!name){ toast('ওষুধের নাম দিন'); return; }
  const type = document.getElementById('mType').value || 'ট্যাবলেট';

  // Same name + same strength (that's part of the name, e.g. "Diclofen 25 mg") + same
  // form/type (ট্যাবলেট/সাপোজিটরি/ইনজেকশন...) is the same medicine entered twice — warn
  // instead of silently creating a duplicate row. Matching uses normalizeMedName() (not a
  // raw string compare) so formatting differences that mean nothing to a pharmacist — an
  // extra space before "mg" ("12.5 mg" vs "12.5mg"), a space around a hyphen ("A - Fenac"
  // vs "A-Fenac") — don't let a real duplicate slip past the check. The SAME name in a
  // DIFFERENT type (e.g. Diclofen 25mg as both ট্যাবলেট and সাপোজিটরি) is legitimately two
  // different products, so that's not hard-blocked — but see the softer cross-type notice
  // below, since "সাসপেনশন" and "সাপোজিটরি" are easy to mis-tap for each other.
  if(!editingMedId){
    const normName = normalizeMedName(name);
    const dupe = medicines.find(m=>m.type===type && normalizeMedName(m.name)===normName);
    if(dupe){
      const goAhead = confirm(`"${dupe.name}" (${dupe.type}) নামে ঠিক এই ধরনের ওষুধ আগে থেকেই ইনভেন্টরিতে আছে (স্টক: ${dupe.stock}, দাম: ৳${dupe.sell})।\n\nতারপরও কি আলাদা একটা নতুন এন্ট্রি হিসেবে যোগ করতে চান?\n(বাতিল করলে আগের ওষুধটিই খোলা হবে, যাতে চাইলে সরাসরি তার স্টক/দাম আপডেট করতে পারেন)`);
      if(!goAhead){
        openMedModal(dupe.id);
        return;
      }
    } else {
      // Not an exact type match, but the SAME name already exists under a different type —
      // worth a heads-up (not a hard stop) since মিলে যাওয়া নাম often really is the same
      // medicine, and "সাসপেনশন" vs "সাপোজিটরি" (Susp. vs Supp.) is an easy mis-tap.
      const nearMiss = medicines.find(m=>m.type!==type && normalizeMedName(m.name)===normName);
      if(nearMiss) toast(`খেয়াল করুন: "${nearMiss.name}" নামে একটা ওষুধ ইতিমধ্যে ${nearMiss.type} হিসেবে আছে — এটা কি ভুলে ${type}-এর বদলে অন্য ধরন হয়ে গেছে?`);
    }
  }
  // ক্রয়মূল্য বিক্রয়মূল্যের চেয়ে বেশি হলে প্রতি ইউনিটে লোকসান হয় — বেশিরভাগ ক্ষেত্রে এটা টাইপো
  // (যেমন দাম দুটো ঘরে উল্টো বসে গেছে), তাই সংরক্ষণের আগে একবার নিশ্চিত হয়ে নেওয়া।
  if(sell>0 && buy>sell){
    const goAhead = confirm(`⚠ ক্রয়মূল্য (৳${buy}) বিক্রয়মূল্যের (৳${sell}) চেয়ে বেশি — এই ওষুধ বিক্রি করলে প্রতি ইউনিটে ৳${(buy-sell).toFixed(2)} লোকসান হবে।\n\nদাম দুটো ঠিক আছে তো? নাকি ভুলে উল্টো বসে গেছে?\n\nতারপরও এই দামেই সংরক্ষণ করতে চান?`);
    if(!goAhead) return;
  }
  // ক্রয়মূল্য ফাঁকা/০ রেখে দিলে ফর্মে "*" (আবশ্যক) লেখা থাকলেও আগে কোনো বাধা ছিল না — ফলে এই
  // ওষুধের প্রতিটা বিক্রয়ে সম্পূর্ণ বিক্রয়মূল্যটাই ভুলবশত "লাভ" হিসেবে গণনা হয়ে যেত, কোনো সংকেত
  // ছাড়াই (ড্যাশবোর্ডের সতর্কতা কার্ডও শুধু ফাঁকা/NaN ধরে, স্পষ্টভাবে ০ লেখা থাকলে ধরে না)।
  if(buy<=0){
    const goAhead = confirm(`⚠ এই ওষুধের ক্রয়মূল্য দেওয়া হয়নি (৳০ ধরা আছে) — এটা বিক্রি করলে পুরো বিক্রয়মূল্যটাই ভুলবশত লাভ হিসেবে দেখাবে, প্রকৃত লাভ না।\n\nক্রয়মূল্য ছাড়াই সংরক্ষণ করতে চান?`);
    if(!goAhead) return;
  }
  const fields = {
    name, generic:document.getElementById('mGeneric').value.trim(),
    company:document.getElementById('mCompany').value.trim(),
    buy, sell, stock:parseInt(document.getElementById('mStock').value)||0,
    lowLimit:parseInt(document.getElementById('mLowLimit').value)||10,
    batch:document.getElementById('mBatch').value.trim(),
    expiry:document.getElementById('mExpiry').value,
    isAntibiotic:document.getElementById('mAntibiotic').checked,
    type,
    bottleSize: (type==='সিরাপ'||type==='সাসপেনশন'||type==='ড্রপ'||type==='এন্টিসেপটিক') ? (parseFloat(document.getElementById('mBottleSize').value)||0) : 0,
    packDays: (type==='মলম'||type==='ক্রিম'||type==='শ্যাম্পু'||type==='এন্টিসেপটিক'||type==='ইনহেলার') ? (parseFloat(document.getElementById('mPackDays').value)||0) : 0,
    packCount: (type==='পাউডার/কৌটা') ? (parseFloat(document.getElementById('mPackCount').value)||0) : 0
  };
  const id = editingMedId || uid();
  if(editingMedId){
    const idx = medicines.findIndex(x=>x.id===editingMedId);
    if(idx>-1) medicines[idx] = {...medicines[idx], ...fields};
  } else {
    medicines.push({ id, ...fields });
    _markJustAdded('med', id);
  }
  save(DB_KEYS.med, medicines);
  closeModal('medModalBackdrop'); toast('ওষুধ সংরক্ষিত হয়েছে ✓'); renderMedicines(); renderDashboard();
  if(cloudReady()){
    shopColl('medicines').doc(id).set(fields, {merge:true}).catch(e=>{ console.error(e); toast('⚠️ ক্লাউডে সংরক্ষণ ব্যর্থ হয়েছে — ইন্টারনেট চেক করুন (ওষুধটি এই ফোনে সংরক্ষিত আছে)'); });
  }
  // If this medicine was added via the "ওষুধ পাওয়া যায়নি" shortcut from the purchase form, the
  // purchase modal was hidden (not closed) underneath — bring it back to front with the
  // freshly-added medicine already selected, instead of leaving the pharmacist to search again.
  if(_purchaseReturnPending){
    _purchaseReturnPending = false;
    renderPurchaseSelects();
    pickPMedicine(id, name);
    openModal('purchaseModalBackdrop');
  }
  // Same shortcut, but from the বিক্রয়/POS search box: the pharmacist searched a medicine
  // that wasn't in inventory yet, added it here, and almost certainly wants to sell it right
  // now — so drop straight back into the sale with it already in cart (if they gave it stock).
  if(_posReturnPending){
    _posReturnPending = false;
    showSection('sale');
    document.getElementById('posSearch').value = '';
    document.getElementById('posSearchResults').innerHTML = '';
    if(fields.stock>0) addToCart(id);
    else toast('ওষুধ যোগ হয়েছে — তবে স্টক ০, তাই বিক্রি করার আগে ক্রয়ে স্টক যোগ করুন');
  }
}
function deleteMedicine(){
  if(!editingMedId) return;
  const idToDelete = editingMedId;
  const _m = medicines.find(x=>x.id===idToDelete);
  if(!askDelete(`"${_m?_m.name:'এই ওষুধ'}" মুছে ফেলবেন?\n\nমুছলেও রিসাইকেল বিন থেকে ফেরানো যাবে।`)) return;
  medicines = medicines.filter(x=>x.id!==idToDelete);
  addTombstone(idToDelete);
  save(DB_KEYS.med, medicines);
  closeModal('medModalBackdrop'); toast('ওষুধ মুছে ফেলা হয়েছে'); renderMedicines(); renderDashboard();
  if(cloudReady()){
    shopColl('medicines').doc(idToDelete).delete().catch(e=>console.error(e));
  }
}
function openBulkModal(){ document.getElementById('bulkNames').value=''; openModal('bulkModalBackdrop'); }
function loadCommonList(){
  const common = [
    "Seclo 20mg","Seclo 40mg","Fimoxyl 500mg","Fimoxyl 250mg","Sergel 20mg","Sergel 40mg","Ambrox","Neofloxin","Filmet 400mg","Filmet 200mg",
    "Napa 500mg","Napa Extra","Napa One","Napa Syrup","Bexicam","Flexibax","Neuro-B","Bextrum Gold","Anflam",
    "Monas 10mg","Monas 5mg","Maxpro 20mg","Maxpro 40mg","Fenadin","Ceevit","Odest","Rovista","Incidal",
    "Ace 500mg","Ace Plus","Fexo 120mg","Fexo 60mg","Antadin","Omastin","Ambrolyt","Losectil 20mg","Losectil 40mg",
    "Rivotril","Ridal","Renacal","Reset","Renata Zinc","Cardiovas","Renamox",
    "Ecosprin 75mg","Cef-3 200mg","Cef-3 400mg","Alatrol 10mg","Tridosil 500mg","Skinoxa","Nexcital",
    "Ozempa","Opset","Osudin","Amodis 400mg","Amodis 200mg","Opson-A",
    "Aristocin","Aristozyme","Nulcer","Ristidon","Alfabact",
    "Popudine","Popucal","Pova","Polinate",
    "Acnil","Acefyl","Napanil","Acemet","Napa Junior",
    "Dinex","Dital","Dilong","Distil",
    "Radicef 200mg","Radizen","Radimox 500mg","Radistat",
    "Beacosone","Beflam","Beoxim",
    "Sinutab","Rolac","Losatan",
    "Paracetamol 500mg","Paracetamol Suspension","Ibuprofen 400mg","Diclofenac 50mg","Aspirin 75mg",
    "Omeprazole 20mg","Esomeprazole 20mg","Pantoprazole 40mg","Ranitidine 150mg","Domperidone 10mg",
    "Cetirizine 10mg","Loratadine 10mg","Fexofenadine 120mg","Chlorpheniramine 4mg",
    "Amoxicillin 500mg","Azithromycin 500mg","Ciprofloxacin 500mg","Metronidazole 400mg","Doxycycline 100mg","Flucloxacillin 500mg","Cefixime 200mg","Cefuroxime 500mg",
    "Metformin 500mg","Glimepiride 2mg","Atorvastatin 10mg","Amlodipine 5mg","Losartan 50mg","Enalapril 5mg",
    "Salbutamol Inhaler","Ventolin Inhaler","Montelukast 10mg","Theophylline",
    "Vitamin B Complex","Vitamin C 500mg","Vitamin D3","Calcium + D3","Multivitamin","Zinc Sulphate","Iron + Folic Acid",
    "ORSaline-N","Paracetamol Suppository","Loperamide 2mg","ORS Powder",
    "Hydrocortisone Cream","Clotrimazole Cream","Betamethasone Cream","Miconazole Cream",
    "Diazepam 5mg","Alprazolam 0.5mg (নিয়ন্ত্রিত, প্রেসক্রিপশন আবশ্যক)",
    "Insulin Mixtard (ঠান্ডা সংরক্ষণ প্রয়োজন)","Metformin+Glimepiride combo","Omeprazole+Domperidone combo"
  ];
  document.getElementById('bulkNames').value = common.join('\n');
  toast('তালিকা বসানো হয়েছে — অপ্রয়োজনীয়গুলো মুছে দিন');
}
function saveBulkMedicines(){
  const raw = document.getElementById('bulkNames').value;
  if(!raw.trim()){ toast('অন্তত একটা নাম দিন'); return; }
  closeModal('bulkModalBackdrop');
  // Routed through the same review screen the photo-scanner uses (auto-detects type from a
  // Tab/Cap/Syp/... word if the line has one, flags anything that already exists in
  // inventory) instead of adding every typed line straight to inventory — that direct-add
  // path was creating untyped duplicate rows whenever a line's wording didn't exactly match
  // an existing medicine's saved name.
  processBulkText(raw);
}
// ---------- Scan-invoice-to-add-medicines (shared by photo-scan AND bulk paste-list) ----------
let _scanRows = [];
function openScanModal(){
  document.getElementById('scanModalTitle').textContent = 'ইনভয়েসের ছবি থেকে ওষুধ যোগ করুন';
  document.getElementById('scanFileInput').value = '';
  document.getElementById('scanStep1').style.display = 'block';
  document.getElementById('scanStep2').style.display = 'none';
  document.getElementById('scanProgress').style.display = 'none';
  document.getElementById('scanRawTextDetails').style.display = '';
  _scanRows = [];
  openModal('scanModalBackdrop');
}
// Tesseract.js (OCR) is loaded on demand only when this feature is actually used, not on
// every app load — it's a fairly large library and language file, and needs internet the
// first time (subsequent scans in the same session reuse the already-loaded copy).
function loadTesseract(){
  return new Promise((resolve, reject)=>{
    if(window.Tesseract){ resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = ()=>resolve();
    s.onerror = ()=>reject(new Error('load-failed'));
    document.head.appendChild(s);
  });
}
const SCAN_TYPE_TOKEN_MAP = {
  'tab':'ট্যাবলেট','tabs':'ট্যাবলেট','tablet':'ট্যাবলেট','tablets':'ট্যাবলেট',
  'cap':'ক্যাপসুল','caps':'ক্যাপসুল','capsule':'ক্যাপসুল','capsules':'ক্যাপসুল',
  'inj':'ইনজেকশন','injection':'ইনজেকশন',
  'sup':'সাপোজিটরি','supp':'সাপোজিটরি','suppo':'সাপোজিটরি','suppos':'সাপোজিটরি','suppository':'সাপোজিটরি','suppositories':'সাপোজিটরি',
  'syp':'সিরাপ','syr':'সিরাপ','syrup':'সিরাপ',
  'sus':'সাসপেনশন','susp':'সাসপেনশন','suspension':'সাসপেনশন',
  'oint':'মলম','ointment':'মলম',
  'cream':'ক্রিম','crm':'ক্রিম',
  'drop':'ড্রপ','drops':'ড্রপ','dps':'ড্রপ','drp':'ড্রপ',
  'sham':'শ্যাম্পু','shampoo':'শ্যাম্পু',
  'inh':'ইনহেলার','inhaler':'ইনহেলার','inhalers':'ইনহেলার'
};
const SCAN_TYPE_TOKEN_REGEX = /\b(tablets?|tabs?|capsules?|caps?|injection|inj|suppositor(?:y|ies)|suppos?|supp?|syrup|syp|syr|suspension|susp?|sus|ointment|oint|cream|crm|drops?|dps|drp|sham(?:poo)?|inhalers?|inh)\b/i;
const SCAN_LINE_SKIP_REGEX = /customer|address|invoice|route\b|batch|product\s*name|total\b|adjustment|outstanding|net\b|sales\s*division|post\s*code|tel\s*no|si\.?\s*no|products?\s+of\b/i;
// Shared core: finds a dosage-form word ANYWHERE in the line (not just at the end — suppliers
// and pharmacists write these in either order, e.g. "Ace Syp 60ml Orange" vs "Renova 100ml Sus")
// and removes just THAT word, keeping everything on both sides as the name — so "Ace Syp 60ml
// Orange" becomes name "Ace 60ml Orange" (matching how it's actually saved in inventory), not a
// truncated "Ace". Also strips a trailing supplier pack-size ("50's", "100's", "10X10's") off
// the end, and — for syrup/suspension — detects a standalone "NNml" as bottle-size info without
// removing it from the name (this shop's own inventory keeps the ml in the name too).
function extractTypeAndBottle(line){
  const m = line.match(SCAN_TYPE_TOKEN_REGEX);
  let type = '', name = line;
  if(m){
    const mappedType = SCAN_TYPE_TOKEN_MAP[m[1].toLowerCase()];
    if(mappedType){
      type = mappedType;
      name = (line.slice(0,m.index) + ' ' + line.slice(m.index+m[0].length)).replace(/\s+/g,' ').trim();
    }
  }
  name = name.replace(/\b\d+\s*['’]s\.?\s*$/i,'').trim();
  name = name.replace(/\b\d+\s*[xX]\s*\d+\s*['’]?s?\s*$/i,'').trim();
  name = name.replace(/[-,:]+$/,'').trim();
  // Removing "Tab"/"Tab." etc leaves a stray leading "." or "-" behind ("Tab. Clavurox" -> ".
  // Clavurox") — clean that up too.
  name = name.replace(/^[.\-,:]+\s*/,'').trim();
  // Keep ONLY the medicine name + its strength (mg/mcg/ml/gm/g/%) — an invoice line typically
  // continues after the dose with quantity/rate/amount table columns (e.g. "Clavurox 500 mg 14
  // 560 5840"), and none of that belongs in the saved medicine name, so once a strength unit is
  // found everything past it is dropped. If no strength unit shows up at all, fall back to just
  // trimming a trailing run of bare numbers (still almost always an invoice table column, not
  // part of the name).
  const strengthMatch = name.match(/\d+(?:\.\d+)?\s*(?:mg|mcg|iu|ml|gm|g|%)\b/i);
  if(strengthMatch){
    name = name.slice(0, strengthMatch.index + strengthMatch[0].length).trim();
  } else {
    name = name.replace(/(?:\s+\d+(?:\.\d+)?){1,}\s*$/,'').trim();
  }
  let bottleSize = 0;
  if(type==='সিরাপ' || type==='সাসপেনশন'){
    const mlMatch = line.match(/(\d+(?:\.\d+)?)\s?ml\b/i);
    if(mlMatch) bottleSize = parseFloat(mlMatch[1]);
  }
  if(!name) name = line.trim();
  return {name, type, bottleSize};
}
// Photo-OCR version: stricter — a line with no recognizable type word is almost always invoice
// header/total noise (OCR output is messy), so those get dropped entirely rather than shown.
function parseInvoiceLine(line){
  line = (line||'').replace(/\s+/g,' ').trim();
  if(!line || line.length<3) return null;
  if(SCAN_LINE_SKIP_REGEX.test(line)) return null;
  const {name, type, bottleSize} = extractTypeAndBottle(line);
  if(!type) return null;
  if(!name || name.length<2) return null;
  return {name, type, bottleSize};
}
// Bulk-paste version: lenient — every non-empty line the pharmacist typed is a real medicine
// they meant to add, so it's always kept even when no type word is found (type comes back ''
// and is picked manually in the review list below) instead of being silently dropped.
function parseBulkLine(line){
  line = (line||'').replace(/\s+/g,' ').trim();
  if(!line) return null;
  const {name, type, bottleSize} = extractTypeAndBottle(line);
  if(!name || name.length<2) return null;
  return {name, type, bottleSize};
}
// Faint/low-contrast dot-matrix or carbon-copy invoice prints are hard for OCR to read as-is.
// This does a stronger prep pass than a fixed threshold can:
//  1. Scales the photo up toward a target width (only up, never down) so small/low-res photos
//     get enough pixels per character, without needlessly blowing up an already-high-res photo
//     into a huge, slow-to-process canvas.
//  2. Grayscale + min/max contrast stretch, same as before.
//  3. Binarizes using Otsu's method — an automatic threshold computed from this specific image's
//     own brightness histogram — instead of a single fixed cutoff (150) that only suited some
//     lighting/exposure conditions and could turn faint-but-readable text into a solid blob or
//     erase it entirely on a photo taken in different light.
function otsuThreshold(gray, len){
  const hist = new Array(256).fill(0);
  for(let i=0;i<len;i++) hist[gray[i]]++;
  let sum = 0;
  for(let t=0;t<256;t++) sum += t*hist[t];
  let sumB=0, wB=0, varMax=0, threshold=150;
  for(let t=0;t<256;t++){
    wB += hist[t];
    if(wB===0) continue;
    const wF = len-wB;
    if(wF===0) break;
    sumB += t*hist[t];
    const mB = sumB/wB;
    const mF = (sum-sumB)/wF;
    const varBetween = wB*wF*(mB-mF)*(mB-mF);
    if(varBetween>varMax){ varMax=varBetween; threshold=t; }
  }
  return threshold;
}
async function preprocessInvoiceImage(file){
  const img = await new Promise((resolve, reject)=>{
    const i = new Image();
    i.onload = ()=>resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });
  const targetWidth = 1800;
  const scale = Math.max(1, Math.min(targetWidth/img.width, 3));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width*scale);
  canvas.height = Math.round(img.height*scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const n = d.length/4;
  const gray = new Uint8ClampedArray(n);
  let min=255, max=0;
  for(let i=0, p=0; i<d.length; i+=4, p++){
    const g = 0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    gray[p] = g;
    if(g<min) min=g;
    if(g>max) max=g;
  }
  const range = Math.max(max-min, 1);
  for(let p=0;p<n;p++) gray[p] = (gray[p]-min) * 255/range;
  const threshold = otsuThreshold(gray, n);
  for(let i=0, p=0; i<d.length; i+=4, p++){
    const v = gray[p] < threshold ? 0 : 255;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
let _scanRawText = '';
async function runInvoiceScan(){
  const file = document.getElementById('scanFileInput').files[0];
  if(!file){ toast('একটা ছবি বেছে নিন'); return; }
  const progressWrap = document.getElementById('scanProgress');
  const progressText = document.getElementById('scanProgressText');
  progressWrap.style.display = 'block';
  progressText.textContent = 'ছবি প্রস্তুত করা হচ্ছে…';
  try{
    await loadTesseract();
    const processed = await preprocessInvoiceImage(file);
    progressText.textContent = 'প্রস্তুত হচ্ছে… (প্রথমবার একটু সময় নিতে পারে)';
    // PSM '6' (assume a single uniform block of text) keeps same-line words grouped into one
    // output line far more reliably than the previous '11' (sparse text, no particular order),
    // which matters a lot here since a medicine's name/strength/type only get recognized
    // together if they land on the same output line. A whitelist limits recognition to the
    // characters medicine lines actually use, cutting down on stray-symbol misreads.
    const result = await Tesseract.recognize(processed, 'eng', {
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,-/%() ',
      logger: (info)=>{
        if(info && info.status==='recognizing text' && typeof info.progress==='number'){
          progressText.textContent = `লেখা পড়া হচ্ছে… ${Math.round(info.progress*100)}%`;
        } else if(info && info.status){
          progressText.textContent = info.status;
        }
      }
    });
    processScannedText(result && result.data ? result.data.text : '');
  }catch(err){
    console.error(err);
    toast('ছবি থেকে লেখা পড়া যায়নি — ইন্টারনেট সংযোগ চেক করুন অথবা আরেকটা স্পষ্ট ছবি দিয়ে চেষ্টা করুন');
    progressWrap.style.display = 'none';
  }
}
// Builds the review-list rows shared by both entry points: dedupes within this batch, and
// flags each parsed line against existing inventory — isDupe (same name AND same type, so it
// starts unticked) vs nearMissType (same name but a DIFFERENT type already on file — not
// unticked, since it might genuinely be a new form, but flagged so it's not missed).
function buildReviewRows(parsedList){
  const seen = new Set();
  const rows = [];
  parsedList.forEach(parsed=>{
    if(!parsed) return;
    const key = normalizeMedName(parsed.name)+'|'+parsed.type;
    if(seen.has(key)) return; // same line seen twice in this batch
    seen.add(key);
    const dupe = parsed.type ? medicines.find(m=>m.type===parsed.type && normalizeMedName(m.name)===normalizeMedName(parsed.name)) : null;
    const nearMiss = !dupe ? medicines.find(m=>parsed.type && m.type!==parsed.type && normalizeMedName(m.name)===normalizeMedName(parsed.name)) : null;
    rows.push({ name:parsed.name, type:parsed.type||'', bottleSize:parsed.bottleSize||0, isDupe:!!dupe, nearMissType: nearMiss?nearMiss.type:'', checked:!dupe });
  });
  return rows;
}
function processScannedText(text){
  _scanRawText = text || '';
  const rawBox = document.getElementById('scanRawTextBox');
  if(rawBox) rawBox.textContent = _scanRawText.trim() || '(কিছুই পড়া যায়নি — ছবিটা হয়তো খুব অস্পষ্ট বা অন্ধকার ছিল)';
  const rows = buildReviewRows((text||'').split('\n').map(parseInvoiceLine));
  _scanRows = rows;
  document.getElementById('scanProgress').style.display = 'none';
  document.getElementById('scanStep1').style.display = 'none';
  document.getElementById('scanStep2').style.display = 'block';
  const newCount = rows.filter(r=>!r.isDupe).length;
  const dupeCount = rows.length - newCount;
  document.getElementById('scanSummaryText').textContent = rows.length
    ? `${rows.length}টা ওষুধ শনাক্ত হয়েছে (${newCount}টা নতুন${dupeCount?', '+dupeCount+'টা আগে থেকেই ইনভেন্টরিতে আছে বলে বাদ দেওয়া আছে':''})। নিচে যাচাই করে নিন — নাম/ধরন ভুল থাকলে ঠিক করে দিন, অপ্রয়োজনীয়গুলোর টিক তুলে দিন।`
    : 'ছবি থেকে কোনো ওষুধের নাম আলাদা করে বুঝে নেওয়া যায়নি। নিচে "কাঁচা লেখা" খুলে দেখুন আসলে কী পড়েছে — একদম কিছু না পড়ে থাকলে ছবিটা আরও স্পষ্ট/কাছ থেকে তুলে আবার চেষ্টা করুন। অথবা নিচের "+ হাতে একটা সারি যোগ করুন" দিয়ে সরাসরি এখানেই টাইপ করে দিন।';
  renderScanResults();
}
// Bulk paste-list entry point: every line becomes a review row (type auto-detected where a
// dosage-form word is found in the line, same logic as the photo scanner) instead of being
// added to inventory directly — so duplicates and missing types get caught before anything is
// actually saved, the way the photo-scan flow already works.
function processBulkText(text){
  const rows = buildReviewRows((text||'').split('\n').map(parseBulkLine));
  _scanRows = rows;
  document.getElementById('scanModalTitle').textContent = 'ওষুধের তালিকা যাচাই করুন';
  document.getElementById('scanStep1').style.display = 'none';
  document.getElementById('scanProgress').style.display = 'none';
  document.getElementById('scanStep2').style.display = 'block';
  document.getElementById('scanRawTextDetails').style.display = 'none';
  const newCount = rows.filter(r=>!r.isDupe).length;
  const dupeCount = rows.length - newCount;
  const noTypeCount = rows.filter(r=>!r.type).length;
  document.getElementById('scanSummaryText').textContent = rows.length
    ? `${rows.length}টা লাইন পাওয়া গেছে (${newCount}টা নতুন${dupeCount?', '+dupeCount+'টা আগে থেকেই ইনভেন্টরিতে আছে বলে বাদ দেওয়া আছে':''}${noTypeCount?', '+noTypeCount+'টার ধরন নিজে বেছে নিতে হবে':''})। নিচে যাচাই করে "যোগ করুন" চাপুন।`
    : 'কোনো লাইন পাওয়া যায়নি।';
  renderScanResults();
  openModal('scanModalBackdrop');
}
function addManualScanRow(){
  _scanRows.push({ name:'', type:'ট্যাবলেট', bottleSize:0, isDupe:false, nearMissType:'', checked:true });
  renderScanResults();
}
const SCAN_TYPE_OPTIONS = ['ট্যাবলেট','ক্যাপসুল','সিরাপ','সাসপেনশন','ইনজেকশন','সাপোজিটরি','মলম','ক্রিম','শ্যাম্পু','ড্রপ','ইনহেলার','পাউডার/কৌটা','এন্টিসেপটিক','অন্যান্য'];
function renderScanResults(){
  const wrap = document.getElementById('scanResultsList');
  wrap.innerHTML = _scanRows.map((r,i)=>`
    <div class="card" style="margin-top:8px;padding:10px;${r.isDupe?'opacity:0.6;':''}">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <input type="checkbox" ${r.checked?'checked':''} onchange="_scanRows[${i}].checked=this.checked" style="width:18px;height:18px;margin-top:10px;flex-shrink:0;">
        <div style="flex:1;min-width:0;">
          <input type="text" value="${escapeHtml(r.name)}" oninput="_scanRows[${i}].name=this.value" style="margin-bottom:6px;">
          <select onchange="_scanRows[${i}].type=this.value; renderScanResults();">
            ${!r.type ? '<option value="" selected>— ধরন বেছে নিন —</option>' : ''}
            ${SCAN_TYPE_OPTIONS.map(t=>`<option value="${t}" ${r.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
          ${(r.type==='সিরাপ'||r.type==='সাসপেনশন') ? `<div style="display:flex;align-items:center;gap:6px;margin-top:5px;"><span class="row-sub">বোতল:</span><input type="number" value="${r.bottleSize||''}" placeholder="ml" oninput="_scanRows[${i}].bottleSize=parseFloat(this.value)||0" style="width:90px;"></div>` : ''}
          ${!r.type ? `<div class="row-sub" style="color:var(--red,#c0392b);margin-top:4px;">ধরন বোঝা যায়নি — ওপর থেকে বেছে নিন</div>` : ''}
          ${r.isDupe ? `<div class="row-sub" style="color:var(--red,#c0392b);margin-top:4px;">ইনভেন্টরিতে আগে থেকেই আছে — টিক দিলে আলাদা একটা নতুন এন্ট্রি হিসেবে যোগ হবে</div>` : ''}
          ${r.nearMissType ? `<div class="row-sub" style="color:#b58900;margin-top:4px;">খেয়াল করুন: এই নামে একটা ওষুধ ইতিমধ্যে ${r.nearMissType} হিসেবে আছে — ভুলে ভিন্ন ধরন হয়ে যায়নি তো?</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}
function confirmScannedMedicines(){
  const chosen = _scanRows.filter(r=>r.checked && r.name.trim());
  if(!chosen.length){ toast('অন্তত একটা বেছে নিন'); return; }
  const missingType = chosen.filter(r=>!r.type);
  if(missingType.length){ toast(`"${missingType[0].name}"-সহ ${missingType.length}টা সারির ধরন বেছে নিন, তারপর আবার চেষ্টা করুন`); return; }
  const newOnes = [];
  chosen.forEach(r=>{
    const name = r.name.trim().replace(/\s+/g,' ');
    const type = r.type;
    const item = {
      id: uid(), name, generic:'', company:'', buy:0, sell:0,
      stock:0, lowLimit:10, batch:'', expiry:'',
      isAntibiotic: looksLikeAntibiotic(name,''),
      type,
      bottleSize: (type==='সিরাপ'||type==='সাসপেনশন'||type==='ড্রপ'||type==='এন্টিসেপটিক') ? (r.bottleSize||0) : 0,
      packDays: 0, packCount: 0
    };
    medicines.push(item);
    newOnes.push(item);
  });
  save(DB_KEYS.med, medicines);
  closeModal('scanModalBackdrop');
  toast(`${newOnes.length}টা ওষুধ যোগ হয়েছে ✓ — দাম ও স্টক পরে বসিয়ে নেবেন`);
  renderMedicines(); renderDashboard();
  if(cloudLive && newOnes.length){
    const batch = cloudDb.batch();
    newOnes.forEach(item=>{ const {id, ...fields} = item; batch.set(shopColl('medicines').doc(id), fields); });
    batch.commit().catch(e=>console.error(e));
  }
}
// ---------- /Scan-invoice ----------
let medSelectMode = false;
let selectedMedIds = new Set();
function toggleMedSelectMode(){
  medSelectMode = !medSelectMode;
  selectedMedIds.clear();
  document.getElementById('medSelectToggleBtn').textContent = medSelectMode ? 'বাতিল করুন' : 'নির্বাচন করে মুছুন';
  document.getElementById('medSelectBar').style.display = medSelectMode ? 'block' : 'none';
  renderMedicines();
}
function toggleMedSelected(id){
  if(selectedMedIds.has(id)) selectedMedIds.delete(id); else selectedMedIds.add(id);
  document.getElementById('medDeleteSelectedBtn').textContent = `নির্বাচিতগুলো মুছুন (${selectedMedIds.size})`;
}
function deleteSelectedMedicines(){
  if(!selectedMedIds.size){ toast('অন্তত একটা বেছে নিন'); return; }
  if(!confirm(`${selectedMedIds.size}টা ওষুধ মুছে ফেলবেন? এটা ফিরিয়ে আনা যাবে না।`)) return;
  const ids = [...selectedMedIds];
  medicines = medicines.filter(m=>!selectedMedIds.has(m.id));
  ids.forEach(addTombstone);
  save(DB_KEYS.med, medicines);
  toast(`${ids.length}টা ওষুধ মুছে ফেলা হয়েছে`);
  if(cloudReady()){
    const batch = cloudDb.batch();
    ids.forEach(id=>{ batch.delete(shopColl('medicines').doc(id)); });
    batch.commit().catch(e=>console.error(e));
  }
  medSelectMode = false;
  selectedMedIds.clear();
  document.getElementById('medSelectToggleBtn').textContent = 'নির্বাচন করে মুছুন';
  document.getElementById('medSelectBar').style.display = 'none';
  renderMedicines();
}
function renderMedicines(){
  const q = (document.getElementById('medSearch')?.value||'').toLowerCase();
  const list = q.trim() ? rankMeds(medicines, q, false) : sortMedicinesGrouped(medicines);
  const totalItemsEl = document.getElementById('medTotalItems');
  const totalValueEl = document.getElementById('medTotalValue');
  if(totalItemsEl){
    totalItemsEl.textContent = medicines.length;
    const totalValue = medicines.reduce((a,m)=>a+((m.stock||0)*(m.buy||0)),0);
    totalValueEl.textContent = fmt(totalValue);
  }
  const el = document.getElementById('medicineList');
  if(medSelectMode){
    el.innerHTML = list.length ? list.map(m=>`
      <div class="row-item" onclick="toggleMedSelected('${m.id}');this.querySelector('input').checked=selectedMedIds.has('${m.id}');document.getElementById('medDeleteSelectedBtn').textContent='নির্বাচিতগুলো মুছুন ('+selectedMedIds.size+')';" style="cursor:pointer;">
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="checkbox" ${selectedMedIds.has(m.id)?'checked':''} style="width:18px;height:18px;pointer-events:none;">
          <div><div class="row-title">${medTypeTag(m.type)}${stripRedundantTypeSuffix(m.name, m.type)}</div><div class="row-sub">${m.company||'—'} ${m.batch?'• ব্যাচ:'+m.batch:''}</div></div>
        </div>
        <span class="badge ${m.stock<=m.lowLimit?'badge-red':'badge-green'}">স্টক: ${m.stock}</span>
      </div>`).join('') : `<div class="empty-state">কোনো ওষুধ পাওয়া যায়নি</div>`;
  } else {
    el.innerHTML = list.length ? list.map(m=>`
      <div class="row-item" onclick="openMedModal('${m.id}')" style="cursor:pointer;">
        <div><div class="row-title">${medTypeTag(m.type)}${stripRedundantTypeSuffix(m.name, m.type)} ${m.isAntibiotic?'<span class="badge badge-red" style="margin-left:4px;">এন্টিবায়োটিক</span>':''}</div><div class="row-sub">${m.company||'—'} ${m.batch?'• ব্যাচ:'+m.batch:''}</div></div>
        <div class="row-right"><div class="row-title">${fmt(m.sell)}</div>
        <span class="badge ${m.stock<=m.lowLimit?'badge-red':'badge-green'}">স্টক: ${m.stock}</span></div>
      </div>`).join('') : `<div class="empty-state">কোনো ওষুধ পাওয়া যায়নি — উপরে থেকে যোগ করুন</div>`;
  }
}

