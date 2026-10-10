/* ---------------- Prescription (Rx) ---------------- */
const RX_DOSAGE_OPTIONS = ['১+০+০','০+১+০','০+০+১','১+০+১','১+১+০','০+১+১','১+১+১','প্রয়োজন মতো'];
const RX_DOSAGE_OPTIONS_SYRUP = ['৫+০+৫ মিলি','৫+৫+৫ মিলি','২.৫+০+২.৫ মিলি','১০+০+১০ মিলি','১০+১০+১০ মিলি','প্রয়োজন মতো'];
const RX_DOSAGE_OPTIONS_DROP = ['১+০+১ ফোঁটা','১+১+১ ফোঁটা','২+০+২ ফোঁটা','২+২+২ ফোঁটা','১+১+১+১+১+১ ফোঁটা','২+২+২+২+২+২ ফোঁটা','প্রয়োজন মতো'];
const RX_DAYS_OPTIONS = ['৩ দিন','৫ দিন','৭ দিন','১০ দিন','১৫ দিন','৩০ দিন','৬০ দিন','৯০ দিন'];
const RX_INVESTIGATIONS = ['CBC','Blood Sugar (RBS/FBS)','Urine R/E','Stool R/E','Blood Grouping','ECG','X-Ray Chest P/A','USG (Abdomen)','HBsAg','S. Creatinine','Lipid Profile','Widal Test'];
let _rxInvestigations = new Set();
let _rxRows = [];
function bnToEnDigits(s){
  const bn='০১২৩৪৫৬৭৮৯', en='0123456789';
  return String(s||'').split('').map(ch=>{ const i=bn.indexOf(ch); return i>-1?en[i]:ch; }).join('');
}
function freqFromDosage(dosage){
  const en = bnToEnDigits(dosage);
  const nums = en.match(/\d+(\.\d+)?/g);
  if(!nums) return 0; // no dosage written at all — frequency is unknown, don't silently assume 1
  const sum = nums.reduce((a,n)=>a+parseFloat(n),0);
  return sum; // may be 0 if all slots are "০" (e.g. "০+০+০"), which is a valid "not taken" reading
}
// For syrup/drop, pharmacists often type just the numbers ("২+২+২") without the unit word.
// This auto-adds "মিলি"/"ফোঁটা" for display (prescription print, cart notes) when missing.
function isSyrupLike(type){ return type==='সিরাপ' || type==='সাসপেনশন'; }
// Groups same-brand medicines together in the inventory list (e.g. all "Progut" forms —
// tablet/capsule/syrup/injection — next to each other, all "Maxpro" forms next to each
// other), instead of scattering them by whenever each was added to stock.
// Strips the strength/size part of the name (e.g. "- 40 mg", "20mg", "60 ml") to get the
// shared brand name, groups by that, then orders each group's forms consistently.
function baseMedName(name){
  return (name||'').replace(/\d.*$/,'').replace(/[-–—:.,]+\s*$/,'').trim().toLowerCase();
}
const MED_TYPE_ORDER = ['ট্যাবলেট','ক্যাপসুল','সিরাপ','সাসপেনশন','ড্রপ','ইনহেলার','ইনজেকশন','সাপোজিটরি','মলম','ক্রিম','শ্যাম্পু','পাউডার/কৌটা','এন্টিসেপটিক','অন্যান্য'];
function medTypeOrderIndex(type){ const i = MED_TYPE_ORDER.indexOf(type); return i===-1 ? MED_TYPE_ORDER.length : i; }
function sortMedicinesGrouped(list){
  return [...list].sort((a,b)=>{
    const ba = baseMedName(a.name), bb = baseMedName(b.name);
    if(ba!==bb) return ba<bb?-1:1;
    const ta = medTypeOrderIndex(a.type), tb = medTypeOrderIndex(b.type);
    if(ta!==tb) return ta-tb;
    return a.name.localeCompare(b.name);
  });
}
function displayDosageText(med, dosageText){
  const text = (dosageText||'').trim();
  if(!text || !med) return text;
  if(isSyrupLike(med.type) && !/মিলি|ml/i.test(text)) return text+' মিলি';
  if(med.type==='ড্রপ' && !/ফোঁটা|drop/i.test(text)) return text+' ফোঁটা';
  return text;
}
function mlPerDoseFromQtyText(qtyText){
  const en = bnToEnDigits(qtyText||'');
  const m = en.match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}
// generic "number per dose" parser — e.g. "১টি ট্যাবলেট" -> 1, "২ চামচ" -> 2. Defaults to 1 if no number found.
function numPerDoseFromQtyText(qtyText){
  const n = mlPerDoseFromQtyText(qtyText);
  return n>0 ? n : 1;
}
const DROPS_PER_ML = 20; // standard approximation used for eye/ear/nose drops
// medicine types that are sold/consumed as whole containers (bottle/tube/pack) — always round UP when calculating sale qty
const CONTAINER_TYPES = ['সিরাপ','সাসপেনশন','ড্রপ','মলম','ক্রিম','শ্যাম্পু','ইনহেলার','পাউডার/কৌটা','এন্টিসেপটিক'];
function isContainerType(type){ return CONTAINER_TYPES.includes(type); }
function rxTypePrefix(type){
  switch(type){
    case 'ট্যাবলেট': return 'Tab.';
    case 'ক্যাপসুল': return 'Cap.';
    case 'সিরাপ': return 'Syp.';
    case 'সাসপেনশন': return 'Susp.';
    case 'ইনজেকশন': return 'Inj.';
    case 'সাপোজিটরি': return 'Suppo.';
    case 'মলম': return 'Oint.';
    case 'ক্রিম': return 'Cream';
    case 'ড্রপ': return 'Drop';
    case 'শ্যাম্পু': return 'Shampoo';
    case 'ইনহেলার': return 'Inh.';
    case 'পাউডার/কৌটা': return '';
    case 'এন্টিসেপটিক': return '';
    default: return '';
  }
}
// If the medicine's saved NAME already ends with a word matching its own type (e.g. someone
// typed "Napa Tab" as the name for a ট্যাবলেট-type entry, which is a very common habit since
// supplier invoices print names that way), showing "Tab. " in front of it too would read as
// "Tab. Napa Tab" — the same word front and back. Strips that trailing word for DISPLAY only
// (the stored name is untouched, so inventory matching by name keeps working); applies to
// existing medicines added before this fix too, not just new ones.
const TYPE_NAME_SUFFIX_WORDS = {
  'ট্যাবলেট': ['tablets','tablet','tabs','tab'],
  'ক্যাপসুল': ['capsules','capsule','caps','cap'],
  'ইনজেকশন': ['injections','injection','inj'],
  'সাপোজিটরি': ['suppositories','suppository','suppos','suppo','supp','sup'],
  'সিরাপ': ['syrups','syrup','syp','syr'],
  'সাসপেনশন': ['suspensions','suspension','susp','sus'],
  'মলম': ['ointments','ointment','oint'],
  'ক্রিম': ['creams','cream','crm'],
  'শ্যাম্পু': ['shampoos','shampoo','sham'],
  'ইনহেলার': ['inhalers','inhaler','inh'],
  'ড্রপ': ['drops','drop','dps','drp']
};
function stripRedundantTypeSuffix(name, type){
  const words = TYPE_NAME_SUFFIX_WORDS[type];
  if(!words || !name) return name;
  let cleaned = name.trim();
  for(const w of words){
    const re = new RegExp('[\\s.,-]*\\b'+w+'\\.?\\s*$', 'i');
    if(re.test(cleaned)){ cleaned = cleaned.replace(re,'').trim(); break; }
  }
  return cleaned || name.trim();
}
// The single place that builds a "Tab. Napa" style display name — use this instead of
// concatenating rxTypePrefix(type)+' '+name by hand, so the trailing-duplicate-word cleanup
// above is always applied consistently (cart, receipts, prescriptions, everywhere).
function displayMedName(med){
  if(!med) return '';
  const prefix = rxTypePrefix(med.type);
  if(!prefix) return med.name;
  return prefix + ' ' + stripRedundantTypeSuffix(med.name, med.type);
}
// small muted tag shown before medicine names in lists/search so the type is visible at a glance
function medTypeTag(type){
  const label = rxTypePrefix(type);
  return label ? `<span style="color:#6b7280;font-weight:700;">${label}</span> ` : '';
}
// Plain-text version of medTypeTag for spots that aren't innerHTML — e.g. the <input> text boxes
// in the ক্রয় entry form, which can't render a styled <span>. Two medicines can share an
// identical name (Ace 500mg tablet vs Ace 500mg suppository) and only differ by this ধরন field,
// so anywhere a medicine name is shown on its own — dropdown suggestion, picked-value textbox,
// purchase history row — needs this prefix or the two are indistinguishable.
function typePrefixPlain(type){ const p = rxTypePrefix(type); return p ? p+' ' : ''; }
function medTypeTagFor(medId){ const m = medicines.find(x=>x.id===medId); return m ? medTypeTag(m.type) : ''; }
// daily quantity needed in the medicine's SELL unit (bottle/tube/pack for container types, piece/ampoule otherwise)
function dailyUnitsForRxItem(med, dosage, qtyText){
  if(!med) return 0;
  const freq = freqFromDosage(dosage); // times per day
  switch(med.type){
    case 'সিরাপ': case 'সাসপেনশন': {
      // dosage field holds the ml-per-slot pattern itself, e.g. "৫+৫+৫ মিলি" —
      // summing its numbers gives the exact total ml/day, even when slots differ (e.g. "৫+০+১০").
      const totalMlPerDay = freqFromDosage(dosage);
      const bottleSize = med.bottleSize>0 ? med.bottleSize : 0;
      if(!bottleSize || !totalMlPerDay) return 0;
      return totalMlPerDay/bottleSize;
    }
    case 'ড্রপ': {
      // same idea: dosage field holds the drops-per-slot pattern, e.g. "১+০+১ ফোঁটা"
      const totalDropsPerDay = freqFromDosage(dosage);
      const bottleSize = med.bottleSize>0 ? med.bottleSize : 0;
      if(!bottleSize || !totalDropsPerDay) return 0;
      return totalDropsPerDay/(bottleSize*DROPS_PER_ML);
    }
    case 'মলম': case 'ক্রিম': case 'শ্যাম্পু': case 'এন্টিসেপটিক': case 'ইনহেলার': {
      // these are consumed gradually over many days regardless of exact times/day —
      // so the sale quantity is driven by "একটা সাধারণত কতদিন চলে", not by frequency×amount.
      // (এন্টিসেপটিক তরল যেমন Viodine/Hexisol/Savlon শুধু ব্যবহার হয়, খাওয়া হয় না — তাই
      //  প্রেসক্রিপশনে দোজ যাই লেখা থাকুক, সেটা এখানে ব্যবহারই হয় না, শুধু packDays দিয়ে হিসাব হয়।)
      const packDays = med.packDays>0 ? med.packDays : 0;
      if(!packDays) return 0;
      return 1/packDays;
    }
    case 'পাউডার/কৌটা': {
      const piecesPerDose = numPerDoseFromQtyText(qtyText);
      const packCount = med.packCount>0 ? med.packCount : 0;
      if(!packCount) return 0;
      return (freq*piecesPerDose)/packCount;
    }
    default:
      // ট্যাবলেট/ক্যাপসুল/ইনজেকশন/সাপোজিটরি/অন্যান্য — unit-count method, now correctly multiplied by qty-per-dose
      return freq*numPerDoseFromQtyText(qtyText);
  }
}
// The one place name-matching normalization happens — used for duplicate detection, linking
// a saved prescription's medicine back to inventory, restock matching, everywhere. Beyond
// collapsing repeated whitespace, also smooths over two very common typing inconsistencies
// that mean nothing to a pharmacist but would otherwise make two names compare as different:
// a space before the unit ("12.5 mg" vs "12.5mg") and a space around a hyphen
// ("A - Fenac" / "A- Fenac" vs "A-Fenac").
function normalizeMedName(s){
  return (s||'').trim().toLowerCase()
    // বাংলা নামের বানান-ভেদ সহ্য করা (মারিয়া/মারীয়া, রশিদ/রসিদ/রশীদ, সুমন/সূমণ...): হ্রস্ব-দীর্ঘ স্বর,
    // ণ/ন, শ/ষ/স এক ধরা হয়; য়/ড়/ঢ় এর নুক্তা, ZWJ/ZWNJ বাদ। শুধু খোঁজা/মেলানোর জন্য — সেভ করা নাম বদলায় না।
    .replace(/[\u200c\u200d]/g,'')
    .replace(/\u09DF/g,'\u09AF').replace(/\u09DC/g,'\u09A1').replace(/\u09DD/g,'\u09A2').replace(/\u09BC/g,'')
    .replace(/\u09C0/g,'\u09BF').replace(/\u09C2/g,'\u09C1')
    .replace(/\u09A3/g,'\u09A8').replace(/[\u09B6\u09B7]/g,'\u09B8')
    // A hyphen is sometimes typed, sometimes not, for the exact same product ("Ebatin - 10 mg"
    // vs "Ebatin 10 mg") — treat it just like extra whitespace so both normalize identically,
    // instead of only tidying the spacing around it (which used to leave "ebatin-10mg" and
    // "ebatin 10mg" as two different strings and let the duplicate through).
    .replace(/-/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/(\d)\s+(mg|mcg|ml|gm|gram|g|iu|%)\b/g,'$1$2');
}
// Same hyphen/space-blind comparison as normalizeMedName, but for matching a typed SEARCH query
// against a medicine's name (used across ওষুধ/বিক্রয়/ক্রয়/প্রেসক্রিপশন medicine search boxes) —
// so typing "M Lukas" finds "M-Lukas 5 mg" the same way typing "M-Lukas" would, instead of the
// hyphen making it invisible to a space-typed search.
function medNameIncludes(name, q){ return normalizeMedName(name).includes(normalizeMedName(q)); }
// সার্চ র‍্যাংক: ১) নামের শুরুতে মিল ২) নামের যেকোনো শব্দের শুরুতে মিল ৩) নামের ভেতরে মিল
// ৪) (ঐচ্ছিক) কোম্পানির নামের কোনো শব্দের শুরুতে মিল — কোম্পানির নামের ভেতরের অংশ ধরা হয় না
// (যেমন "ace" লিখলে Pharm-ace-uticals ধরে ভুল ওষুধ আসত)
function rankMeds(list, rawQ, withCompany){
  const q = normalizeMedName(rawQ);
  if(!q) return list.slice();
  const t1=[], t2=[], t3=[], t4=[];
  list.forEach(m=>{
    const n = normalizeMedName(m.name);
    if(n.startsWith(q)) t1.push(m);
    else if(n.split(' ').some(w=>w.startsWith(q))) t2.push(m);
    else if(n.includes(q)) t3.push(m);
    else if(withCompany && (m.company||'').toLowerCase().split(/[\s.,()-]+/).some(w=>w && w.startsWith(q))) t4.push(m);
  });
  const byName = (a,b)=>normalizeMedName(a.name).localeCompare(normalizeMedName(b.name));
  return t1.sort(byName).concat(t2.sort(byName), t3.sort(byName), t4.sort(byName));
}
// সাধারণ র‍্যাংক-সার্চ (কাস্টমার/সাপ্লায়ার/রোগী/রেফারার ইত্যাদির জন্য): ১) নামের শুরুতে মিল
// ২) নামের কোনো শব্দের শুরুতে মিল ৩) নামের ভেতরে মিল ৪) অন্য ঘরে (মোবাইল ইত্যাদি) মিল।
// আগের ক্রম (যেমন বেশি কেনা/নতুন আগে) প্রতিটা ধাপের ভেতরে অপরিবর্তিত থাকে। q ফাঁকা হলে সব ফেরত।
function rankBy(list, rawQ, primaryFn, secondaryFns){
  const q = normalizeMedName(rawQ);
  if(!q) return list.slice();
  const t1=[], t2=[], t3=[], t4=[];
  list.forEach(it=>{
    const n = normalizeMedName(primaryFn(it)||'');
    if(n.startsWith(q)) t1.push(it);
    else if(n.split(' ').some(w=>w.startsWith(q))) t2.push(it);
    else if(n.includes(q)) t3.push(it);
    else if((secondaryFns||[]).some(f=>{
      const v = String(f(it)||'').toLowerCase();
      const qa = rawQ.trim().toLowerCase();
      if(v.includes(qa)) return true;
      // মোবাইল নম্বর বাংলা অঙ্কে লিখলেও (বা বাংলা অঙ্কে সেভ থাকলেও) যেন মেলে
      if(typeof bnToEnDigits==='function'){ const v2 = bnToEnDigits(v), q2 = bnToEnDigits(qa); return v2.includes(q2); }
      return false;
    })) t4.push(it);
  });
  return t1.concat(t2,t3,t4);
}
function medNameStartsWith(name, q){ return normalizeMedName(name).startsWith(normalizeMedName(q)); }
function findMedicineByName(name){
  if(!name) return null;
  const q = normalizeMedName(name);
  if(!q) return null;
  return medicines.find(m=>normalizeMedName(m.name)===q)
    || medicines.find(m=>normalizeMedName(m.name).startsWith(q))
    || medicines.find(m=>normalizeMedName(m.name).includes(q))
    || null;
}
function toggleInvestigation(name){
  if(_rxInvestigations.has(name)) _rxInvestigations.delete(name); else _rxInvestigations.add(name);
  renderInvestigationChips();
}
function renderInvestigationChips(){
  const wrap = document.getElementById('rxInvestWrap');
  if(!wrap) return;
  wrap.innerHTML = RX_INVESTIGATIONS.map(t=>`<button type="button" class="btn btn-sm ${_rxInvestigations.has(t)?'btn-primary':'btn-outline'}" onclick="toggleInvestigation('${t.replace(/'/g,"\\'")}')">${t}</button>`).join('');
}
/* ---- Rx Vitals (Pulse / BP / Temp / Lungs) ---- */
let _rxLungs = '';
const RX_LUNGS_OPTIONS = ['Clear','Not Clear'];
function toggleLungs(val){
  _rxLungs = (_rxLungs===val) ? '' : val;
  renderLungsChips();
}
function renderLungsChips(){
  const wrap = document.getElementById('rxLungsWrap');
  if(!wrap) return;
  wrap.innerHTML = RX_LUNGS_OPTIONS.map(t=>`<button type="button" class="btn btn-sm ${_rxLungs===t?'btn-primary':'btn-outline'}" onclick="toggleLungs('${t}')">${t}</button>`).join('');
}
const RX_TEMP_QUICK = ['98.4','99','100','101','102','103'];
function setTempQuick(v){ document.getElementById('rxTemp').value = bnDigitsFromEn(v); renderTempChips(); }
function bnDigitsFromEn(s){ const map={'0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯'}; return String(s).replace(/[0-9]/g,d=>map[d]); }
function renderTempChips(){
  const wrap = document.getElementById('rxTempChipsWrap');
  if(!wrap) return;
  const cur = bnToEnDigits(document.getElementById('rxTemp').value||'').trim();
  wrap.innerHTML = RX_TEMP_QUICK.map(t=>`<button type="button" class="btn btn-sm ${cur===t?'btn-primary':'btn-outline'}" onclick="setTempQuick('${t}')">${t}°F</button>`).join('');
}
function buildVitalsLine(){
  const pulse = bnToEnDigits(document.getElementById('rxPulse').value||'').trim();
  const bpSys = bnToEnDigits(document.getElementById('rxBPSys').value||'').trim();
  const bpDia = bnToEnDigits(document.getElementById('rxBPDia').value||'').trim();
  const temp = bnToEnDigits(document.getElementById('rxTemp').value||'').trim();
  const parts = [];
  if(pulse) parts.push(`Pulse: ${pulse}/min`);
  if(bpSys && bpDia) parts.push(`BP: ${bpSys}/${bpDia} mmHg`);
  else if(bpSys) parts.push(`BP: ${bpSys} mmHg`);
  if(temp) parts.push(`Temp: ${temp}°F`);
  if(_rxLungs) parts.push(`Lungs: ${_rxLungs}`);
  return parts.join('\n');
}
function newRxRow(){ return {medName:'', medId:'', dosage:'', timing:'', qty:'', days:''}; }
// Resolves the exact medicine picked for an Rx row/saved item. Prefers the stored medId
// (set only when the user actually tapped a suggestion from the dropdown) so that when two
// inventory items share the same name but differ by form (e.g. Progut Capsule vs Progut
// Injection, Maxpro Tablet vs Maxpro Capsule), the specific one chosen is kept — instead of
// re-searching by name alone and silently landing on whichever same-named item happens to
// come first in the inventory list.
function resolveRxMed(row){
  if(row.medId){ const byId = medicines.find(m=>m.id===row.medId); if(byId) return byId; }
  return findMedicineByName(row.medName);
}
function addRxRow(){ _rxRows.push(newRxRow()); renderRxRows(); }
function removeRxRow(idx){
  _rxRows.splice(idx,1);
  if(!_rxRows.length) _rxRows.push(newRxRow());
  renderRxRows();
}
function updateRxField(idx, field, value){
  if(!_rxRows[idx]) return;
  _rxRows[idx][field] = value;
}
function pickRxDosage(idx, val){ _rxRows[idx].dosage = val; renderRxRows(); }
function pickRxDays(idx, val){ _rxRows[idx].days = val; renderRxRows(); }
function onRxMedInput(idx, value){
  _rxRows[idx].medName = value;
  _rxRows[idx].medId = ''; // typing invalidates any earlier dropdown pick — re-resolve by name until a suggestion is tapped again
  const el = document.getElementById('rxMedSuggest_'+idx);
  if(!el) return;
  const q = value.trim().toLowerCase();
  if(!q){ el.style.display='none'; el.innerHTML=''; return; }
  const matches = rankMeds(medicines, q, false).slice(0,12);
  el.innerHTML = matches.length ? matches.map(m=>`<div class="row-item" style="cursor:pointer;padding:8px 10px;" onclick="pickRxMed(${idx},'${m.id}')"><div class="row-title" style="font-size:13px;">${medTypeTag(m.type)}${escapeHtml(stripRedundantTypeSuffix(m.name, m.type))}</div><div class="row-sub">স্টক: ${m.stock} • ${fmt(m.sell)}</div></div>`).join('') : '';
  el.style.display = matches.length ? 'block' : 'none';
}
function pickRxMed(idx, medId){
  const med = medicines.find(m=>m.id===medId);
  if(!med) return;
  _rxRows[idx].medName = med.name;
  _rxRows[idx].medId = med.id;
  renderRxRows();
}
function renderRxRows(){
  const wrap = document.getElementById('rxRowsWrap');
  if(!wrap) return;
  wrap.innerHTML = _rxRows.map((row,idx)=>{
    const med = resolveRxMed(row);
    return `<div class="card" style="padding:10px;margin-top:8px;position:relative;">
      ${_rxRows.length>1 ? `<span onclick="removeRxRow(${idx})" style="position:absolute;top:8px;right:10px;color:var(--red);font-size:19px;cursor:pointer;line-height:1;">×</span>` : ''}
      <label style="margin-top:0;">ওষুধের নাম *</label>
      <div style="position:relative;">
        ${med && rxTypePrefix(med.type) ? `<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#6b7280;font-weight:700;font-size:14.5px;pointer-events:none;">${escapeHtml(rxTypePrefix(med.type))}</span>` : ''}
        <input type="text" value="${escapeHtml(row.medName)}" placeholder="নাম লিখুন (যেমন: Napa)" oninput="onRxMedInput(${idx}, this.value)" style="${med && rxTypePrefix(med.type) ? 'padding-left:'+(rxTypePrefix(med.type).length*8+22)+'px;' : ''}">
        <div id="rxMedSuggest_${idx}" style="position:absolute;left:0;right:0;top:100%;z-index:15;background:#fff;border:1px solid var(--border);border-radius:0 0 10px 10px;max-height:200px;overflow-y:auto;display:none;"></div>
      </div>
      ${med ? `<div class="row-sub" style="margin-top:3px;">${med.type?'ধরন: '+escapeHtml(med.type)+' • ':''}স্টকে আছে: ${med.stock} • দাম: ${fmt(med.sell)}</div>` : (row.medName ? `<div class="row-sub" style="margin-top:3px;color:var(--red);">ইনভেন্টরিতে পাওয়া যায়নি — বিক্রয়ের সময় এটি বাদ পড়বে</div>` : '')}
      <label>${med && isSyrupLike(med.type) ? 'মাত্রা (প্রতিবেলা কত মিলি — + দিয়ে যোগ করুন)' : med && med.type==='ড্রপ' ? 'মাত্রা (প্রতিবেলা কত ফোঁটা — + দিয়ে যোগ করুন)' : 'ডোজ'}</label>
      <input type="text" value="${escapeHtml(row.dosage)}" placeholder="${med && isSyrupLike(med.type) ? 'যেমন: ৫+৫+৫ মিলি' : med && med.type==='ড্রপ' ? 'যেমন: ১+০+১ ফোঁটা' : 'যেমন: ১+০+১'}" oninput="updateRxField(${idx},'dosage',this.value)">
      <div class="chip-row">
        ${(med && isSyrupLike(med.type) ? RX_DOSAGE_OPTIONS_SYRUP : med && med.type==='ড্রপ' ? RX_DOSAGE_OPTIONS_DROP : RX_DOSAGE_OPTIONS).map(o=>`<button type="button" class="btn btn-sm ${row.dosage===o?'btn-primary':'btn-outline'}" onclick="pickRxDosage(${idx},'${o}')">${o}</button>`).join('')}
      </div>
      <label style="margin-top:8px;">খাবারের নিয়ম</label>
      <select onchange="updateRxField(${idx},'timing',this.value)">
        <option value="">— বেছে নিন —</option>
        <option value="খাবার আগে" ${row.timing==='খাবার আগে'?'selected':''}>খাবার আগে</option>
        <option value="খাবার পরে" ${row.timing==='খাবার পরে'?'selected':''}>খাবার পরে</option>
        <option value="খাবার সাথে" ${row.timing==='খাবার সাথে'?'selected':''}>খাবার সাথে</option>
      </select>
      ${(!med || !(['মলম','ক্রিম','শ্যাম্পু','ড্রপ','ইনহেলার'].includes(med.type) || isSyrupLike(med.type))) ? `
      <label style="margin-top:8px;">কয়টি করে খাবে</label>
      <input type="text" value="${escapeHtml(row.qty)}" placeholder="যেমন: ১টি ট্যাবলেট, ২ চামচ" oninput="updateRxField(${idx},'qty',this.value)">` : `
      <label style="margin-top:8px;">${med && (isSyrupLike(med.type)||med.type==='ড্রপ') ? 'বাড়তি নির্দেশনা (ঐচ্ছিক)' : 'প্রয়োগের নিয়ম (ঐচ্ছিক, প্রেসক্রিপশনে লেখা থাকবে)'}</label>
      <input type="text" value="${escapeHtml(row.qty)}" placeholder="${med && (isSyrupLike(med.type)||med.type==='ড্রপ') ? 'যেমন: খাওয়ার আগে ঝাঁকিয়ে নিন' : 'যেমন: পাতলা করে লাগান'}" oninput="updateRxField(${idx},'qty',this.value)">`}
      ${med && (isSyrupLike(med.type)||med.type==='ড্রপ') && !med.bottleSize ? `<div class="row-sub" style="margin-top:2px;color:var(--red);">এই ওষুধের বোতলের সাইজ ইনভেন্টরিতে সেট করা নেই — বিক্রির সময় বোতল সংখ্যা হিসাব করা যাবে না</div>` : ''}
      ${med && ['মলম','ক্রিম','শ্যাম্পু','এন্টিসেপটিক','ইনহেলার'].includes(med.type) && !med.packDays ? `<div class="row-sub" style="margin-top:2px;color:var(--red);">এটা সাধারণত কতদিন চলে — সেটা ইনভেন্টরিতে সেট করা নেই — বিক্রির সময় সংখ্যা হিসাব করা যাবে না</div>` : ''}
      ${med && med.type==='পাউডার/কৌটা' && !med.packCount ? `<div class="row-sub" style="margin-top:2px;color:var(--red);">একটা কৌটা/পাতায় কয়টি ট্যাবলেট/ক্যাপসুল আছে — সেটা ইনভেন্টরিতে সেট করা নেই — বিক্রির সময় সংখ্যা হিসাব করা যাবে না</div>` : ''}
      <label style="margin-top:8px;">কতদিন খাবে</label>
      <input type="text" value="${escapeHtml(row.days)}" placeholder="যেমন: ৭ দিন" oninput="updateRxField(${idx},'days',this.value)">
      <div class="chip-row">
        ${RX_DAYS_OPTIONS.map(o=>`<button type="button" class="btn btn-sm ${row.days===o?'btn-primary':'btn-outline'}" onclick="pickRxDays(${idx},'${o}')">${o}</button>`).join('')}
      </div>
    </div>`;
  }).join('');
}
function openRxModal(){
  document.getElementById('rxPatientName').value='';
  document.getElementById('rxPatientAge').value='';
  document.getElementById('rxPatientGender').value='';
  document.getElementById('rxPatientMobile').value='';
  document.getElementById('rxPatientAddress').value='';
  document.getElementById('rxCC').value='';
  document.getElementById('rxPulse').value='';
  document.getElementById('rxBPSys').value='';
  document.getElementById('rxBPDia').value='';
  document.getElementById('rxTemp').value='';
  _rxLungs = '';
  renderLungsChips();
  renderTempChips();
  document.getElementById('rxOE').value='';
  document.getElementById('rxOtherTests').value='';
  document.getElementById('rxAdvice').value='';
  _rxInvestigations = new Set();
  renderInvestigationChips();
  _rxRows = [newRxRow()];
  renderRxRows();
  openModal('rxModalBackdrop');
}
function savePrescription(){
  const patientName = document.getElementById('rxPatientName').value.trim();
  if(!patientName){ toast('রোগীর নাম আবশ্যক'); return; }
  const meds = _rxRows.filter(r=>r.medName && r.medName.trim()).map(r=>{
    return { medName:r.medName.trim(), medId:r.medId||'', dosage:(r.dosage||'').trim(), timing:r.timing||'', qty:(r.qty||'').trim(), days:(r.days||'').trim() };
  });
  if(!meds.length){ toast('অন্তত একটা ওষুধ যোগ করুন'); return; }
  const rec = {
    id:uid(), ts:Date.now(), date:todayStr(),
    patientName,
    patientAge: document.getElementById('rxPatientAge').value.trim(),
    patientGender: document.getElementById('rxPatientGender').value,
    patientMobile: document.getElementById('rxPatientMobile').value.trim(),
    patientAddress: document.getElementById('rxPatientAddress').value.trim(),
    cc: document.getElementById('rxCC').value.trim(),
    vitalsLine: buildVitalsLine(),
    oe: document.getElementById('rxOE').value.trim(),
    investigations: Array.from(_rxInvestigations),
    otherTests: document.getElementById('rxOtherTests').value.trim(),
    meds,
    advice: document.getElementById('rxAdvice').value.trim()
  };
  prescriptions.unshift(rec);
  save(DB_KEYS.prescription, prescriptions);
  if(cloudReady()){
    shopColl('prescriptions').doc(rec.id).set(rec).catch(e=>console.error(e));
  }
  // Deliberately NOT creating/linking a customer record here — the patient named on a
  // prescription isn't necessarily the paying কাস্টমার (could be a parent/guardian instead), so
  // committing them to the কাস্টমার তালিকা this early can create a wrong or duplicate customer.
  // A real customer link only happens when this Rx is actually turned into a sale, via
  // applyRxRecordToSaleForm()'s findOrCreateCustomerFor() call — at that point the owner has
  // already chosen who's actually paying (and can pick a different existing customer, e.g. the
  // father, before completing the sale). The patient's own name is still preserved on the sale
  // record and shown in that customer's ইতিহাস (see showLedger) even when it differs from
  // the customer's name.
  closeModal('rxModalBackdrop');
  toast('প্রেসক্রিপশন সংরক্ষিত হয়েছে ✓');
  renderPrescriptionList();
  showPrescriptionReceipt(rec);
}
let _currentRxId = null;
let _rxSellMode = 'days';
function showPrescriptionReceipt(rec){
  _currentRxId = rec.id;
  _rxSellMode = 'days';
  const dt = new Date(rec.ts||Date.now());
  const dateStr = dt.toLocaleDateString('en-GB');
  const medsHtml = (rec.meds||[]).map((m,i)=>{
    const med = resolveRxMed(m);
    const prefix = med ? rxTypePrefix(med.type) : '';
    const rxName = med ? stripRedundantTypeSuffix(m.medName, med.type) : m.medName;
    const dosageShown = displayDosageText(med, m.dosage);
    const detailParts = [dosageShown, m.timing, m.qty, m.days].filter(Boolean);
    return `<div class="rx-med-row">
      <div class="rx-med-name">${i+1}. ${prefix?escapeHtml(prefix)+' ':''}${escapeHtml(rxName)}</div>
      <div class="rx-med-detail">${detailParts.length?escapeHtml(detailParts.join(' • ')):'—'}</div>
    </div>`;
  }).join('');
  const investList = (rec.investigations||[]).slice();
  if(rec.otherTests) rec.otherTests.split(',').map(s=>s.trim()).filter(Boolean).forEach(t=>investList.push(t));
  const investBody = investList.join(', ');
  document.getElementById('rxReceiptContent').innerHTML = `
    <div class="receipt">
      <div class="rx-letterhead">
        <div class="rx-name">Prodip Chandra Howlader</div>
        <div class="rx-line">L.M.A.F. &amp; Pharmacist (Barishal)</div>
        <div class="rx-line">Ex O.T. In-charge (Barishal)</div>
        <div class="rx-line">Uttar Sonakhali Bazar,</div>
        <div class="rx-line">Amtali, Barguna.</div>
        <div class="rx-line">Mobile : 01739097390</div>
      </div>
      <div class="rx-patient-row">
        <span>Name: ${escapeHtml(rec.patientName)}</span>
        <span>${rec.patientAge?'Age: '+escapeHtml(rec.patientAge):''}</span>
        <span>${rec.patientGender?genderLabel(rec.patientGender):''}</span>
        <span>${rec.patientMobile?'Mobile: '+escapeHtml(rec.patientMobile):''}</span>
        <span>Date: ${dateStr}</span>
      </div>
      <div class="rx-body">
        <div class="rx-left-col">
          <div class="rx-sec"><div class="rx-sec-title">C/C</div><div class="rx-sec-body">${escapeHtml(rec.cc||'')}</div></div>
          <div class="rx-sec"><div class="rx-sec-title">O/E</div><div class="rx-sec-body">${escapeHtml([rec.vitalsLine, rec.oe].filter(Boolean).join('\n'))}</div></div>
          ${investBody ? `<div class="rx-sec"><div class="rx-sec-title">Investigation</div><div class="rx-sec-body">${escapeHtml(investBody)}</div></div>` : ''}
        </div>
        <div class="rx-right-col">
          <div class="rx-symbol">℞</div>
          ${medsHtml}
          <div style="margin-top:26px;text-align:right;">
            <div style="display:inline-block;min-width:150px;border-top:1.5px solid #333;padding-top:4px;font-size:11.5px;color:#333;text-align:center;font-family:'Noto Sans Bengali',sans-serif;">Signature</div>
          </div>
        </div>
      </div>
      ${rec.advice ? `<div class="rx-advice-foot"><div class="rx-sec-title">Advice</div><div class="rx-sec-body">${escapeHtml(rec.advice)}</div></div>` : ''}
      ${shopQrHtml()}
    </div>`;
  renderRxSellPanel();
  openModal('rxReceiptModalBackdrop');
}
function setRxSellMode(mode){ _rxSellMode = mode; renderRxSellPanel(); }
function renderRxSellPanel(){
  const wrap = document.getElementById('rxSellPanelWrap');
  if(!wrap) return;
  const prevVal = document.getElementById('rxSellValue') ? document.getElementById('rxSellValue').value : '';
  wrap.innerHTML = `
    <label style="margin-top:0;">বিক্রয় করুন — মোট কতদিনের ওষুধ, নাকি কত টাকার?</label>
    <div style="display:flex;gap:6px;margin-top:4px;">
      <button type="button" class="btn btn-sm ${_rxSellMode==='days'?'btn-primary':'btn-outline'}" style="flex:1;" onclick="setRxSellMode('days')">দিন হিসেবে</button>
      <button type="button" class="btn btn-sm ${_rxSellMode==='amount'?'btn-primary':'btn-outline'}" style="flex:1;" onclick="setRxSellMode('amount')">৳ টাকা হিসেবে</button>
    </div>
    <input type="number" min="1" id="rxSellValue" value="${escapeHtml(prevVal)}" placeholder="${_rxSellMode==='amount'?'যেমন: ৫০০':'যেমন: ৫'}" style="margin-top:8px;">
    <button class="btn btn-gold btn-block" style="margin-top:10px;" onclick="sendPrescriptionToSale()">🛒 বিক্রয় কার্টে পাঠান</button>`;
}
function viewPrescription(id){
  const rec = prescriptions.find(r=>r.id===id);
  if(rec) showPrescriptionReceipt(rec);
}
function printPrescription(){ _printOnly('rxReceiptContent', false); }
function deletePrescriptionFromModal(){
  if(!_currentRxId) return;
  if(!confirm('এই প্রেসক্রিপশনটা মুছে ফেলতে চান?')) return;
  prescriptions = prescriptions.filter(r=>r.id!==_currentRxId);
  addTombstone(_currentRxId);
  save(DB_KEYS.prescription, prescriptions);
  if(cloudReady()){
    shopColl('prescriptions').doc(_currentRxId).delete().catch(e=>console.error(e));
  }
  closeModal('rxReceiptModalBackdrop');
  toast('প্রেসক্রিপশন মুছে ফেলা হয়েছে');
  renderPrescriptionList();
}
// Core "how many days' worth fits in this value" cart-builder, shared by both the prescription
// screen's সরাসরি বিক্রয় flow and the customer-history পুনরায় বিক্রয় flow below — so a
// customer's earlier prescription can be re-quantified for a fresh day-count or budget from
// either place, with the same stock/budget handling.
function buildCartFromRxRecord(rec, mode, rawVal){
  const items = (rec.meds||[]).map(m=>{ const med = resolveRxMed(m); return { medName:m.medName, med, dailyUnits:dailyUnitsForRxItem(med, m.dosage, m.qty) }; });
  const foundItems = items.filter(it=>it.med);
  const missingNames = items.filter(it=>!it.med).map(it=>it.medName);
  if(!foundItems.length) return {ok:false, msg:'কোনো ওষুধ ইনভেন্টরিতে পাওয়া যায়নি — কার্টে যোগ করা যায়নি'};

  let days;
  if(mode==='amount'){
    // Base the days-count on the REGULAR (per-dose) medicines only — tablets/capsules/
    // injections etc. Container-type items (antiseptic liquids, syrups, ointments...) often
    // last for months per bottle, so their tiny daily-cost would otherwise inflate "days"
    // way beyond what the actual tablets justify. Containers are sized to match those days
    // below, not the other way around. If EVERY item happens to be a container, fall back
    // to using all of them (no other basis to compute days from).
    const regularItems = foundItems.filter(it=>!isContainerType(it.med.type));
    const basisItems = regularItems.length ? regularItems : foundItems;
    const costPerDay = basisItems.reduce((s,it)=>s + it.dailyUnits*it.med.sell, 0);
    if(costPerDay<=0) return {ok:false, msg:'মূল্য হিসাব করা গেল না'};
    days = Math.floor(rawVal / costPerDay);
    if(days<=0) return {ok:false, msg:'এই টাকায় একদিনের ওষুধও হচ্ছে না'};
  } else {
    days = Math.max(1, Math.round(rawVal));
  }

  // Each medicine gets up to the FULL 'days' worth independently — no longer capped down
  // to whichever single medicine has the least stock. A medicine that's short in stock just
  // gets as much as is available (see qty = Math.min(desiredQty, stock) below); the other
  // medicines that do have enough stock still get the full requested days.
  const skipped = missingNames.map(n=>n+' (ইনভেন্টরিতে নেই)');
  const partials = []; // medicines that got less than the full `days` due to limited stock
  const rows = []; // {it, qty}
  foundItems.forEach(it=>{
    if(it.dailyUnits<=0){ skipped.push(it.med.name+' (ডোজ লেখা নেই বা প্যাকের হিসাব ইনভেন্টরিতে সেট করা নেই — ম্যানুয়ালি যোগ করুন)'); return; }
    const desiredQty = isContainerType(it.med.type) ? Math.ceil(it.dailyUnits*days) : Math.round(it.dailyUnits*days);
    const qty = Math.min(desiredQty, it.med.stock);
    if(qty<=0){ skipped.push(it.med.name+' (স্টক নেই)'); return; }
    if(qty<desiredQty) partials.push(it.med.name);
    rows.push({it, qty});
  });

  let unequalDaysNote = false;
  if(mode==='amount' && rows.length){
    // Budget-matching: keep the days-based quantities as a baseline, then spread any
    // leftover budget across the REGULAR medicines only (one unit at a time, cheapest
    // first) — containers are deliberately left out here too, so leftover budget doesn't
    // silently buy extra bottles nobody asked for.
    let totalCost = rows.reduce((s,r)=>s+r.qty*r.it.med.sell, 0);
    const byPriceAsc = rows.filter(r=>!isContainerType(r.it.med.type)).sort((a,b)=>a.it.med.sell-b.it.med.sell);
    let guard = 4000, progressed = true;
    while(totalCost < rawVal && progressed && guard-->0){
      progressed = false;
      for(const r of byPriceAsc){
        const remaining = rawVal - totalCost;
        if(remaining<=0) break;
        if(r.qty < r.it.med.stock && r.it.med.sell>0 && r.it.med.sell <= remaining){
          r.qty += 1;
          totalCost += r.it.med.sell;
          unequalDaysNote = true;
          progressed = true;
        }
      }
    }
    // trim from the priciest unit if unit-rounding pushed total over budget
    guard = 2000;
    while(totalCost > rawVal && guard-->0){
      const trimmable = rows.filter(r=>r.qty>0);
      if(!trimmable.length) break;
      trimmable.sort((a,b)=>b.it.med.sell-a.it.med.sell);
      trimmable[0].qty -= 1;
      totalCost -= trimmable[0].it.med.sell;
      unequalDaysNote = true;
    }
  }

  cart.length = 0;
  let totalCost = 0, addedCount = 0;
  rows.forEach(({it,qty})=>{
    if(qty<=0){ skipped.push(it.med.name+' (বাজেটে জায়গা হয়নি)'); return; }
    cart.push({id:it.med.id, name:displayMedName(it.med), price:it.med.sell, qty, maxStock:it.med.stock, isAntibiotic:!!it.med.isAntibiotic});
    totalCost += qty*it.med.sell;
    addedCount++;
  });

  return {ok:true, addedCount, totalCost, skipped, partials, unequalDaysNote, days};
}
// Carries a prescription's patient/prescriber details onto the সেল/POS form and links the
// sale-to-be to a real customer record (matched by mobile/name, or created fresh) — so it
// shows up in that customer's ইতিহাস/বাকি tracking instead of staying an untracked walk-in.
function applyRxRecordToSaleForm(rec){
  showSection('sale');
  document.getElementById('saleDoctorType').value = 'paramedic';
  document.getElementById('saleDoctorName').value = 'Prodip Chandra Howlader';
  document.getElementById('saleDoctorTitle').value = 'L.M.A.F. & Pharmacist (Barishal), Ex O.T. In-charge';
  document.getElementById('saleDiagnosis').value = (rec.cc||'').replace(/\n+/g,', ');
  document.getElementById('patientName').value = rec.patientName||'';
  document.getElementById('patientMobile').value = rec.patientMobile||'';
  backupPrescriberFields();
  _pendingSaleRxId = rec.id;
  renderCart();
  // Customer-linking runs LAST, after everything else this function touches (showSection's own
  // renderSaleCustomerSelect() call, renderCart(), etc.) — so nothing later in this function can
  // ever clobber it back to ওয়াক-ইন. rec.patientName is a required field on every saved
  // prescription (savePrescription() refuses to save without it), so cust below is never null.
  const mobile = (rec.patientMobile||'').trim();
  const existedBefore = mobile && customers.some(x=>(x.mobile||'').trim()===mobile);
  const cust = findOrCreateCustomerFor(rec.patientName, rec.patientMobile, rec.patientAddress);
  if(cust){
    renderSaleCustomerSelect();
    pickSaleCustomer(cust.id, cust.name);
    if(existedBefore && (cust.name||'').trim().toLowerCase() !== (rec.patientName||'').trim().toLowerCase()){
      toast(mobile+' নম্বরটি আগে থেকেই "'+cust.name+'" নামে সেভ করা আছে — বাকি/ইতিহাস "'+cust.name+'"-এর নামেই জমা হবে। এটা ভুল/অন্য মানুষ হলে কাস্টমার ঘর থেকে বদলে নতুন কাস্টমার বানান।');
    }
  }
}
function toastRxSellResult(result){
  if(result.addedCount){
    let msg = result.unequalDaysNote
      ? `প্রায় ${result.days} দিনের ওষুধ কার্টে যোগ হয়েছে (বাজেট অনুযায়ী কিছু ওষুধে দিন কমবেশি হতে পারে) ✓ মোট: ${fmt(result.totalCost)}`
      : `${result.days} দিনের ওষুধ কার্টে যোগ হয়েছে ✓ মোট: ${fmt(result.totalCost)}`;
    if(result.partials.length) msg += ` — "${result.partials.join('", "')}"-এর স্টক কম থাকায় পুরো ${result.days} দিনের হয়নি, যতটা সম্ভব ততটা দেওয়া হয়েছে`;
    if(result.skipped.length) msg += ' — কিছু ওষুধ বাদ পড়েছে';
    toast(msg);
  } else {
    toast('কোনো ওষুধ কার্টে যোগ করা গেল না');
  }
}
function sendPrescriptionToSale(){
  const rec = prescriptions.find(r=>r.id===_currentRxId);
  if(!rec) return;
  const valInput = document.getElementById('rxSellValue');
  const rawVal = parseFloat(bnToEnDigits(valInput ? valInput.value : '')) || 0;
  if(rawVal<=0){ toast('কতদিনের বা কত টাকার ওষুধ দেবেন লিখুন'); return; }
  const result = buildCartFromRxRecord(rec, _rxSellMode, rawVal);
  if(!result.ok){ toast(result.msg); return; }
  closeModal('rxReceiptModalBackdrop');
  applyRxRecordToSaleForm(rec);
  toastRxSellResult(result);
}
// Launched from a customer's ইতিহাস (ledger) so the owner can say "give me more at the same
// rate as this earlier purchase" using that specific past sale's own medicine ratio — works
// for ANY past sale (Rx-originated or a plain manual POS sale), since it only needs the
// items/quantities already recorded on the sale itself, not dosage data.
function resellFromHistoryByAmount(saleId, idPrefix){
  const sale = sales.find(s=>s.id===saleId);
  if(!sale){ toast('বিক্রয়ের তথ্য পাওয়া যায়নি'); return; }
  const valEl = document.getElementById(idPrefix+'_amt');
  const rawVal = parseFloat(bnToEnDigits(valEl ? valEl.value : '')) || 0;
  if(rawVal<=0){ toast('কত টাকার ওষুধ দেবেন লিখুন'); return; }

  const rows = []; const skipped = [];
  sale.items.forEach(it=>{
    let med = medicines.find(m=>m.id===it.id);
    if(!med) med = findMedicineByName(it.name); // fallback if id changed/missing on an old record
    if(!med){ skipped.push(it.name+' (ইনভেন্টরিতে নেই)'); return; }
    rows.push({med, weight: Math.max(it.qty,1)});
  });
  if(!rows.length){ toast('এই বিক্রয়ের ওষুধগুলো ইনভেন্টরিতে খুঁজে পাওয়া গেল না'); return; }

  const weightCostSum = rows.reduce((s,r)=>s+r.weight*r.med.sell,0);
  if(weightCostSum<=0){ toast('মূল্য হিসাব করা গেল না'); return; }
  const scale = rawVal/weightCostSum;
  const calc = rows.map(r=>({med:r.med, qty:Math.max(0, Math.round(r.weight*scale))}));
  calc.forEach(r=>{ if(r.qty>r.med.stock) r.qty=r.med.stock; });

  let totalCost = calc.reduce((s,r)=>s+r.qty*r.med.sell,0);
  const byPriceAsc = [...calc].sort((a,b)=>a.med.sell-b.med.sell);
  let guard=4000, progressed=true;
  while(totalCost<rawVal && progressed && guard-->0){
    progressed=false;
    for(const r of byPriceAsc){
      const remaining = rawVal-totalCost;
      if(remaining<=0) break;
      if(r.qty<r.med.stock && r.med.sell>0 && r.med.sell<=remaining){ r.qty+=1; totalCost+=r.med.sell; progressed=true; }
    }
  }
  guard=2000;
  while(totalCost>rawVal && guard-->0){
    const trimmable = calc.filter(r=>r.qty>0);
    if(!trimmable.length) break;
    trimmable.sort((a,b)=>b.med.sell-a.med.sell);
    trimmable[0].qty -= 1; totalCost -= trimmable[0].med.sell;
  }

  cart.length = 0;
  calc.forEach(r=>{
    if(r.qty<=0){ skipped.push(r.med.name+' (স্টক নেই)'); return; }
    cart.push({id:r.med.id, name:displayMedName(r.med), price:r.med.sell, qty:r.qty, maxStock:r.med.stock, isAntibiotic:!!r.med.isAntibiotic});
  });

  closeModal('ledgerModalBackdrop');
  closeModal('detailModalBackdrop');
  showSection('sale');
  const cust = sale.customerId ? customers.find(c=>c.id===sale.customerId) : null;
  if(cust){ renderSaleCustomerSelect(); pickSaleCustomer(cust.id, cust.name); }
  document.getElementById('patientName').value = sale.patientName || (cust?cust.name:'') || '';
  document.getElementById('patientMobile').value = sale.patientMobile || (cust?cust.mobile:'') || '';
  if(sale.doctorName){
    document.getElementById('saleDoctorName').value = sale.doctorName;
    document.getElementById('saleDoctorTitle').value = sale.doctorTitle||'';
    document.getElementById('saleDoctorType').value = sale.doctorType||'';
    backupPrescriberFields();
  }
  if(sale.diagnosis) document.getElementById('saleDiagnosis').value = sale.diagnosis;
  _pendingSaleRxId = sale.rxId || null;
  renderCart();
  let msg = `প্রায় ${fmt(totalCost)} টাকার ওষুধ কার্টে যোগ হয়েছে ✓ (আগের এই বিক্রয়ের অনুপাত অনুযায়ী)`;
  if(skipped.length) msg += ' — বাদ পড়েছে: '+skipped.join(', ');
  toast(msg);
}
let rxShowCount = 5;
function rxFilterChanged(){ rxShowCount = 5; renderPrescriptionList(); }
function renderPrescriptionList(){
  const el = document.getElementById('rxList');
  if(!el) return;
  const q = (document.getElementById('rxSearch')?.value||'').trim().toLowerCase();
  const filtered = rankBy([...prescriptions].sort((a,b)=>b.ts-a.ts), q, r=>r.patientName, [r=>r.patientMobile, r=>r.cc]);
  const rows = filtered.slice(0, rxShowCount);
  el.innerHTML = rows.length ? rows.map(r=>{
    const dt = new Date(r.ts||Date.now());
    const dateStr = dt.toLocaleDateString('bn-BD');
    const medNames = (r.meds||[]).map(m=>m.medName).join(', ');
    const ccSnippet = (r.cc||'').split('\n')[0];
    return `<div class="row-item" onclick="viewPrescription('${r.id}')" style="cursor:pointer;">
      <div><div class="row-title">${escapeHtml(r.patientName)} ${ccSnippet?'<span class="tag-en">'+escapeHtml(ccSnippet)+'</span>':''}</div>
      <div class="row-sub">${escapeHtml(medNames)} • ${dateStr}</div></div>
    </div>`;
  }).join('') : `<div class="empty-state">${q?'এই শর্তে কোনো প্রেসক্রিপশন নেই':'এখনো কোনো প্রেসক্রিপশন তৈরি হয়নি'}</div>`;
  if(filtered.length > rows.length){
    el.innerHTML += `<button class="btn btn-outline btn-block" style="margin-top:8px;" onclick="rxShowCount+=10;renderPrescriptionList();">আরও দেখুন</button>`;
  }
}

// Total money a customer has EVER bought medicine for — separate from c.due (which only
// tracks what they still OWE). This is what answers "মোট কত টাকার ঔষধ কিনলো" at a glance.
// পারফরম্যান্স: আগে প্রতিটা কাস্টমারের জন্য পুরো বিক্রির তালিকা বারবার ঘুরত (তালিকা সাজানোর সময়ও প্রতি তুলনায়), তাই বিক্রি বাড়লে স্লো হতো।
// এখন একবারে সব বিক্রি গুনে ম্যাপে রাখা হয়; ডেটা বদলালে (save() হলে) আবার হিসাব হয়।
let _ctpCache = null, _ctpVer = -1, _ctpSales = null, _ctpLen = -1;
function _custTotalsMap(){
  if(_ctpCache && _ctpVer === _dataVersion && _ctpSales === sales && _ctpLen === sales.length) return _ctpCache;
  const m = new Map();
  for(let i=0;i<sales.length;i++){ const s = sales[i]; if(s && s.customerId) m.set(s.customerId, (m.get(s.customerId)||0) + (s.total||0)); }
  _ctpCache = m; _ctpVer = _dataVersion; _ctpSales = sales; _ctpLen = sales.length;
  return m;
}
function customerTotalPurchased(custId){
  if(!custId) return sales.filter(s=>s.customerId===custId).reduce((sum,s)=>sum+(s.total||0),0);
  return _custTotalsMap().get(custId) || 0;
}
// Lifetime approximate profit earned from this one customer — same (price - current med.buy)
// approach used everywhere else in the app for profit (আজকের/রিপোর্টের আনুমানিক লাভ), so it's
// consistent with those numbers rather than a separately-invented calculation. Owner-only data
// (see role gating in showLedger/renderCustomers) — never computed into anything a staff
// session's DOM can read.
function customerTotalProfit(custId){
  return sales.filter(s=>s.customerId===custId).reduce((sum,s)=>{
    const cost = s.items.reduce((x,it)=>{ const med=medicines.find(m=>m.id===it.id); return x+(med?(med.buy||0)*it.qty:0); },0);
    return sum + ((s.total||0) - cost);
  },0);
}
let customerShowAll = false;
function _cMobileCallGo(a){ const v=(document.getElementById('cMobile').value||'').replace(/[^0-9+]/g,''); if(v.length<5){ toast('আগে মোবাইল নম্বর লিখুন'); return false; } a.href='tel:'+v; return true; }
function _custTel(m){ return String(m||'').replace(/[^0-9+]/g,'').length>=5 ? String(m) : ''; }
// ===== কাস্টমারের খাতায় কোন কোন নামে বাকি আছে (একবারে সবার জন্য হিসাব) =====
let _pIdxCache = null, _pIdxVer = -1;
function _buildPeopleIndex(){
  if(_pIdxCache && _pIdxVer === _dataVersion) return _pIdxCache;
  const _out = _buildPeopleIndexRaw(); _pIdxCache = _out; _pIdxVer = _dataVersion; return _out;
}
function _buildPeopleIndexRaw(){
  const own = {}; customers.forEach(c=>{ own[c.id] = (c.name||'').trim().toLowerCase(); });
  const idx = {};
  const slot = (cid, n)=>{
    n = (n||'').trim(); const k = n.toLowerCase();
    if(!n || k===own[cid]) return null;
    const m = (idx[cid] = idx[cid] || {}); return (m[k] = m[k] || {name:n, taken:0, paid:0});
  };
  sales.forEach(s=>{ if(!s.customerId) return; const p = slot(s.customerId, s.patientName); if(p) p.taken += (s.dueAdded||0); });
  payments.forEach(p=>{
    if(!p.customerId || !p.forName) return; const e = slot(p.customerId, p.forName); if(!e) return;
    if(p.type==='due_adjustment') e.taken += p.amount; else if(!p.type) e.paid += p.amount;
  });
  const out = {};
  Object.keys(idx).forEach(cid=>{ out[cid] = Object.values(idx[cid]).sort((a,b)=>(b.taken-b.paid)-(a.taken-a.paid)); });
  return out;
}
// কার নামে কত বাকি আছে (অন্যদের ভাগ) + কাস্টমারের নিজের ভাগ = মোট বাকি − অন্যদের ভাগ।
// (নাম লেখা ছাড়া আগের জমা/বাকি-যোগ কাস্টমারের নিজের ভাগেই ধরা হয়; কার নামে ছিল বেছে দিলে ভাগ বদলে যাবে।)
function _dueSplit(list, c){
  const others = (list||[]).map(p=>({name:p.name, rem:p.taken-p.paid})).filter(p=>p.rem>0.5);
  if(!others.length) return {others:[], own:0};
  const own = Math.round(((c && c.due) || 0) - others.reduce((a,p)=>a+p.rem,0));
  return {others, own};
}
function _peopleLine(list, c){
  const sp = _dueSplit(list, c);
  if(!sp.others.length) return '';
  const parts = sp.others.slice(0,4).map(p=>escapeHtml(p.name)+' <b style="color:#b3261e;">'+fmt(p.rem)+'</b>');
  if(c && sp.own>0.5) parts.push('নিজে <b style="color:#b3261e;">'+fmt(sp.own)+'</b>');
  return `<div class="row-sub" style="margin-top:3px;color:#7a5b00;">নামে আছে: ${parts.join(' • ')}${sp.others.length>4?' …+'+(sp.others.length-4):''}</div>`;
}
function renderCustomers(){
  const el = document.getElementById('customerList');
  try{
    const q = (document.getElementById('customerSearch')?.value||'').toLowerCase();
    const realCustomers = customers.filter(c=>!c.provisional);
    // সার্চ করলে "শুধু টেস্ট করা রোগী"-ও (provisional) খোঁজা হয় — আগে এরা এই তালিকায় লুকানো থাকত বলে নাম লিখে পেতেন না
    const searchBase = q.trim() ? customers : realCustomers;
    // Sorted by lifetime total purchase (highest first) rather than however they were added — so
    // the shop's biggest, most familiar customers surface first instead of getting buried under
    // 90 names once "আরও দেখুন" is needed.
    const sorted = [...searchBase].sort((a,b)=>customerTotalPurchased(b.id)-customerTotalPurchased(a.id));
    // (c.name||'') guards a record that somehow has no name saved — one bad/incomplete record
    // used to throw here and blank out BOTH this list and সাপ্লায়ার right after it (renderSuppliers
    // is called straight after this in the same tab-switch, so an uncaught error here skipped it
    // too) — looked exactly like the customer list "disappearing" even though nothing was actually
    // deleted from storage. Never again silently show nothing; a broken record just falls back to
    // "(নাম নেই)" instead of crashing the whole তালিকা.
    const _pIdx = _buildPeopleIndex();
    // রোগীর/পরিবারের সদস্যের নাম লিখেও খোঁজা যায় (যেমন "yanur" লিখলে যার খাতায় বাকি নিয়েছে সেই কাস্টমার আসে)
    const filtered = rankBy(sorted, q, c=>c.name, [c=>c.mobile, c=>c.guardian, c=>c.address, c=>(_pIdx[c.id]||[]).map(p=>p.name).join(' ')]);
    const LIMIT = 5;
    const expanded = customerShowAll || !!q;
    const list = expanded ? filtered : filtered.slice(0, LIMIT);
    const rowsHtml = list.length ? list.map(c=>`
      <div class="row-item" onclick="openCustomerModal('${c.id}')" style="cursor:pointer;flex-wrap:wrap;"><div style="display:flex;gap:10px;align-items:center;flex:1 1 150px;min-width:0;">${custAvatar(c,44,true)}<div style="min-width:0;overflow-wrap:break-word;"><div class="row-title">${c.name||'(নাম নেই)'}${c.guardian?' <span class="tag-en">('+c.guardian+')</span>':''}${c.provisional?' <span class="badge" style="font-size:11px;background:#fff3cd;color:#7a5b00;">শুধু টেস্ট রোগী</span>':''}</div><div class="row-sub"><span style="white-space:nowrap;">${c.mobile||'—'}</span>${(c.age||c.ageMonths)?' • বয়স: '+formatAge(c):''}</div>
      ${currentRole()==='owner' ? `<div class="row-sub" style="margin-top:2px;">মোট কেনাকাটা: <b>${fmt(customerTotalPurchased(c.id))}</b></div>` : ''}${_peopleLine(_pIdx[c.id], c)}</div></div>
      <div class="row-right" style="${c.due>0?'flex:1 1 100%;max-width:100%;':'flex-shrink:1;max-width:62%;'}">${c.due>0?`<span class="badge badge-red" style="cursor:pointer;" onclick="event.stopPropagation();openLedgerWithBreakdown('${c.id}')">বাকি ${fmt(c.due)} ▸</span>`:(c.due<0?`<span class="badge badge-green">অগ্রিম জমা ${fmt(-c.due)}</span>`:`<span class="badge badge-green">পরিশোধিত</span>`)}
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
        ${_custTel(c.mobile)?`<a class="btn btn-sm" href="${_telHref(c.mobile)}" onclick="event.stopPropagation()" style="text-decoration:none;background:#e6f4ea;color:#067647;font-weight:700;">📞 কল</a>`:''}
        ${c.due>0?`<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();openPaymentModal('${c.id}')">টাকা জমা নিন</button>`:''}
        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();openAdjustDueModal('${c.id}')">বাকি যোগ করুন</button>
        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();showLedger('${c.id}')">ইতিহাস</button>
      </div></div></div>`).join('') : `<div class="empty-state">${realCustomers.length?'কোনো মিল পাওয়া যায়নি':'কোনো কাস্টমার নেই'}</div>`;
    let toggleHtml = '';
    if(!q && filtered.length > LIMIT){
      toggleHtml = expanded
        ? `<div class="row-item" style="justify-content:center;cursor:pointer;color:var(--primary-dark);font-weight:700;" onclick="customerShowAll=false;renderCustomers();">▲ সংক্ষেপে দেখান</div>`
        : `<div class="row-item" style="justify-content:center;cursor:pointer;color:var(--primary-dark);font-weight:700;" onclick="customerShowAll=true;renderCustomers();">আরও ${filtered.length-LIMIT} জন দেখুন ▼</div>`;
    }
    el.innerHTML = rowsHtml + toggleHtml;
  }catch(e){
    console.error('renderCustomers crashed', e);
    el.innerHTML = `<div class="empty-state">⚠️ কাস্টমার তালিকা দেখাতে সমস্যা হয়েছে (তথ্য মুছে যায়নি) — অ্যাপ রিলোড করুন। সমস্যা থাকলে ব্যাকআপ থেকে পুনরুদ্ধার করুন।</div>`;
  }
}
let adjustingCustomerId = null, _adjForName = null, _payForName = null;
function openAdjustDueModal(id, forName){
  adjustingCustomerId = id;
  _adjForName = forName || null;
  const c = customers.find(x=>x.id===id);
  document.getElementById('adjustCustName').textContent = c.name + (_adjForName ? ' — নামে: '+_adjForName : '');
  document.getElementById('adjustCurrentDue').textContent = fmt(c.due||0);
  document.getElementById('adjustAmount').value = '';
  openModal('adjustDueModalBackdrop');
}
function saveAdjustDue(){
  const c = customers.find(x=>x.id===adjustingCustomerId);
  if(!c) return;
  const amount = parseFloat(document.getElementById('adjustAmount').value)||0;
  if(amount<=0){ toast('সঠিক পরিমাণ দিন'); return; }
  c.due = (c.due||0) + amount;
  save(DB_KEYS.customer, customers);
  // Record a permanent ledger entry (type:'due_adjustment') so this manual বাকি shows up in the
  // লেনদেনের ইতিহাস and is counted by "বাকি পুনর্গণনা" — same proof trail as a টাকা জমা.
  const adjId = uid();
  const adjTs = Date.now();
  const _adjRec = { customerId:c.id, amount, ts:adjTs, date:todayStr(), type:'due_adjustment' };
  if(_adjForName) _adjRec.forName = _adjForName;
  payments.push(Object.assign({ id:adjId }, _adjRec));
  save(DB_KEYS.payment, payments);
  closeModal('adjustDueModalBackdrop'); toast('বাকি যোগ করা হয়েছে ✓'); renderCustomers(); renderDashboard();
  try{ if(document.getElementById('ledgerModalBackdrop').classList.contains('show')) showLedger(c.id); }catch(e){}
  if(cloudReady()){
    shopColl('customers').doc(c.id).set({due: c.due}, {merge:true}).catch(e=>console.error(e));
    shopColl('payments').doc(adjId).set(_adjRec).catch(e=>console.error(e));
  }
}
function dueText(v){ v=v||0; return v<0 ? 'অগ্রিম '+fmt(-v) : fmt(v); }
let payingCustomerId = null;
function openPaymentModal(id, forName){
  payingCustomerId = id;
  _payForName = forName || null;
  reconcileOne(id);
  const c = customers.find(x=>x.id===id);
  document.getElementById('paymentCustName').textContent = c.name + (_payForName ? ' — নামে: '+_payForName : '');
  document.getElementById('paymentCurrentDue').textContent = dueText(c.due);
  document.getElementById('paymentAmount').value = '';
  openModal('paymentModalBackdrop');
}
function savePayment(){
  const c = customers.find(x=>x.id===payingCustomerId);
  if(!c) return;
  const amount = parseFloat(document.getElementById('paymentAmount').value)||0;
  if(amount<=0){ toast('সঠিক পরিমাণ দিন'); return; }
  reconcileOne(c.id); // জমা নেওয়ার ঠিক আগে ইতিহাস থেকে সঠিক বাকি বসিয়ে নিই
  if((c.due||0)<=0){
    if(!confirm('এই কাস্টমারের এখন কোনো বাকি নেই'+((c.due||0)<0?' (আগে থেকেই '+fmt(-c.due)+' অগ্রিম জমা আছে)':'')+'।\n\n'+fmt(amount)+' অগ্রিম হিসেবে জমা রাখবেন?')) return;
  } else if(amount>(c.due||0) && (amount-(c.due||0))>=1 && !confirm('বাকি আছে '+fmt(c.due)+', আপনি '+fmt(amount)+' জমা নিচ্ছেন।\n\nবাকি শোধ হয়ে অতিরিক্ত '+fmt(amount-c.due)+' অগ্রিম জমা থাকবে। এগোবেন?')) return;
  // বাকি ২৭৭.৫০, জমা ২৭৮ — এক টাকার কম অতিরিক্তটা পয়সার গোল ধরা হয়: পূর্ণ শোধ, অগ্রিম নয়
  let _roundedOff = 0;
  if(amount>(c.due||0) && (c.due||0)>0 && (amount-(c.due||0))<1){ _roundedOff = amount-(c.due||0); amount = c.due; }
  // দুবার চাপ/একই জমা দুবার ঠেকাতে
  const _dup = payments.find(p=>p.customerId===c.id && !p.type && p.amount===amount && (Date.now()-p.ts)<20000);
  if(_dup && !confirm('এই কাস্টমারের একই টাকা ('+fmt(amount)+') মাত্র কয়েক সেকেন্ড আগেই জমা নেওয়া হয়েছে। আবার নেবেন?')) return;
  c.due = (c.due||0) - amount;
  save(DB_KEYS.customer, customers);
  const paymentId = uid();
  const _payTs = Date.now();
  const _payRec = { customerId:c.id, amount, ts:_payTs, date:todayStr() };
  if(_payForName) _payRec.forName = _payForName;
  payments.push(Object.assign({ id:paymentId }, _payRec));
  save(DB_KEYS.payment, payments);
  closeModal('paymentModalBackdrop');
  try{ if(document.getElementById('ledgerModalBackdrop').classList.contains('show')) showLedger(c.id); }catch(e){}
  toast(_roundedOff>0 ? `${fmt(amount)} জমা নেওয়া হয়েছে ✓ — বাকি এখন ৳০ (${fmt(_roundedOff)} পয়সার গোল, অগ্রিম ধরা হয়নি)` : `${fmt(amount)} জমা নেওয়া হয়েছে ✓`);
  renderCustomers(); renderDashboard();
  if(cloudReady()){
    shopColl('customers').doc(c.id).set({due: c.due}, {merge:true}).catch(e=>console.error(e));
    shopColl('payments').doc(paymentId).set(_payRec).catch(e=>console.error(e));
  }
}
// ===== মোট বাকির ভাগ: কার নামে কত বাকি/জমা =====
// বিক্রয়ে লেখা "রোগীর নাম" ধরে ভাগ করা হয় (নাম খালি বা কাস্টমারের নিজের নাম হলে কাস্টমারের নিজের ভাগে)।
// এটা শুধু দেখানোর হিসাব — কাস্টমারের মোট বাকির সংখ্যা (c.due) এতে বদলায় না।
// নামসহ জমা/বাকি যোগ করলে ("forName" লেখা থাকে) সেটা ওই নামের ভাগে কমে/বাড়ে; আগের যেসব জমার কোনো নাম লেখা নেই, সেগুলো আলাদা সারিতে দেখায়।
let _lbOpen = false, _lbCust = null, _lbPeople = [];
function _ledgerBreakdownHtml(c, custSales, custPayments){
  const own = (c.name||'').trim();
  const map = new Map();
  const slot = n=>{
    n = (n||'').trim(); if(!n || n.toLowerCase()===own.toLowerCase()) n = own;
    const k = n.toLowerCase(); if(!map.has(k)) map.set(k, {name:n, taken:0, paid:0, isOwn:(n===own)});
    return map.get(k);
  };
  slot(own);
  custSales.forEach(s=>{ const p = slot(s.patientName); p.taken += (s.dueAdded||0); });
  let loosePaid = 0, looseAdd = 0;
  const looseList = [];
  custPayments.forEach(p=>{
    if(!p.forName && p.id) looseList.push(p);
    if(p.type==='due_adjustment'){ if(p.forName) slot(p.forName).taken += p.amount; else looseAdd += p.amount; }
    else { if(p.forName) slot(p.forName).paid += p.amount; else loosePaid += p.amount; }
  });
  const people = [...map.values()].filter(p=>p.isOwn || p.taken>0 || p.paid>0)
    .sort((a,b)=> (b.isOwn?1:0)-(a.isOwn?1:0) || (b.taken-b.paid)-(a.taken-a.paid));
  _lbPeople = people;
  const rows = people.map((p,i)=>{
    const rem = p.taken - p.paid;
    return `<div style="padding:10px 0;border-bottom:1px dashed #d9d9d9;" onclick="event.stopPropagation()">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
        <div style="min-width:0;overflow-wrap:anywhere;"><div style="font-weight:700;">${escapeHtml(p.name)}${p.isOwn?' <span class="row-sub">(নিজে)</span>':''}</div>
          <div class="row-sub">বাকি নিয়েছে ${fmt(p.taken)} • জমা দিয়েছে ${fmt(p.paid)}</div></div>
        <span class="badge ${rem>0?'badge-gold':'badge-green'}" style="flex-shrink:0;">${rem<0?'অগ্রিম '+fmt(-rem):fmt(rem)}</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="btn btn-sm btn-outline" style="flex:1;" onclick="_lbPay(${i})">টাকা জমা নিন</button>
        <button class="btn btn-sm btn-outline" style="flex:1;" onclick="_lbAdd(${i})">বাকি যোগ করুন</button>
      </div></div>`;
  }).join('');
  looseList.sort((x,y)=>y.ts-x.ts);
  const opts = people.map(p=>`<option value="${escapeHtml(p.name).replace(/"/g,'&quot;')}">${escapeHtml(p.name)}</option>`).join('');
  const looseRows = looseList.map(p=>{
    const isAdd = p.type==='due_adjustment';
    const dt = new Date(p.ts).toLocaleDateString('bn-BD');
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dotted #ddd;" onclick="event.stopPropagation()">
      <div style="min-width:0;"><div style="font-weight:600;">${isAdd?'বাকি যোগ +':'জমা −'}${fmt(p.amount)}</div><div class="row-sub">${dt}</div></div>
      <select onchange="_lbAssign('${p.id}', this.value)" style="max-width:48%;padding:6px;border:1px solid #ccc;border-radius:8px;font-size:14px;"><option value="">কার নামে?</option>${opts}</select></div>`;
  }).join('');
  const loose = looseList.length ? `<div style="padding:10px 0 2px;">
      <div style="font-weight:700;">⚠️ নাম লেখা নেই এমন লেনদেন${loosePaid?' • জমা −'+fmt(loosePaid):''}${looseAdd?' • বাকি যোগ +'+fmt(looseAdd):''}</div>
      <div class="row-sub" style="margin:2px 0 6px;">উপরের নামগুলোর যোগফল আর মোট বাকি না মেলার কারণ এগুলো। প্রতিটার পাশে বেছে দিন কার নামে ছিল — বেছে দিলেই ওই নামের হিসাবে কমবে/বাড়বে, মোট বাকি বদলাবে না।</div>${looseRows}</div>` : '';
  return `<div style="background:#f7faf8;border:1px solid #d6e4dc;border-radius:12px;padding:10px 12px;margin-bottom:12px;">
    <div style="font-weight:800;margin-bottom:2px;">কার নামে কত বাকি</div>${rows}${loose}</div>`;
}
function openLedgerWithBreakdown(id){ _lbCust = id; _lbOpen = true; showLedger(id); }
function _lbAssign(pid, name){
  if(!name) return;
  const p = payments.find(x=>x.id===pid); if(!p) return;
  p.forName = name;
  save(DB_KEYS.payment, payments);
  try{ if(cloudReady()) shopColl('payments').doc(pid).set({forName:name},{merge:true}).catch(e=>console.error(e)); }catch(e){}
  toast('"'+name+'"-এর নামে ধরা হয়েছে ✓');
  if(_currentLedgerCustId) showLedger(_currentLedgerCustId);
  try{ renderCustomers(); }catch(e){}
}
function _lbPay(i){ const p=_lbPeople[i]; if(p && _currentLedgerCustId) openPaymentModal(_currentLedgerCustId, p.name); }
function _lbAdd(i){ const p=_lbPeople[i]; if(p && _currentLedgerCustId) openAdjustDueModal(_currentLedgerCustId, p.name); }
function showLedger(custId){
  reconcileOne(custId);
  const c = customers.find(x=>x.id===custId);
  if(!c) return;
  const custSales = sales.filter(s=>s.customerId===custId);
  const custPayments = payments.filter(p=>p.customerId===custId);
  const events = [
    ...custSales.map(s=>({ts:s.ts, type:'sale', id:s.id, items:s.items, total:s.total, cash:s.cashPaidNow??s.total, due:s.dueAdded??0, rxId:s.rxId||null, patientName:s.patientName||null})),
    ...custPayments.map(p=>({ts:p.ts, type:(p.type==='due_adjustment'?'adjust':'payment'), amount:p.amount, forName:p.forName||null}))
  ].sort((a,b)=>a.ts-b.ts);
  let running = 0;
  const rowsHtml = events.map(e=>{
    if(e.type==='sale'){ running += e.due; }
    else if(e.type==='adjust'){ running += e.amount; }
    else { running -= e.amount; }
    const dt = new Date(e.ts).toLocaleDateString('bn-BD') + ' ' + new Date(e.ts).toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit'});
    if(e.type==='sale'){
      const itemRows = e.items.map((it,i)=>`<tr><td>${i+1}. ${escapeHtml(it.name||'')}</td><td class="num">${it.qty}</td><td class="num">${fmt(it.price*it.qty)}</td></tr>`).join('');
      // Works for EVERY past sale, not just prescription-originated ones — uses that specific
      // sale's own medicine-to-medicine ratio (the "rate" the owner sold at that time) as the
      // basis, scaled up/down to the requested amount, so it doesn't depend on dosage/days data.
      const rid = 'ledgerResell_'+e.id;
      const resellWidget = `
        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);" onclick="event.stopPropagation()">
          <div class="row-sub" style="margin-bottom:5px;">🔁 এই হারে (উপরের ওষুধগুলোর অনুপাতে) আরও ওষুধ পাঠান</div>
          <div style="display:flex;gap:6px;">
            <input type="text" id="${rid}_amt" placeholder="কত টাকার ওষুধ" inputmode="numeric" style="flex:1;min-width:0;">
            <button class="btn btn-sm btn-gold" style="flex-shrink:0;" onclick="resellFromHistoryByAmount('${e.id}','${rid}')">পাঠান</button>
          </div>
        </div>`;
      const deleteBtn = (currentRole()==='owner') ? `
        <div style="margin-top:18px;text-align:center;" onclick="event.stopPropagation()">
          <button class="btn btn-sm" style="color:var(--danger,#c0392b);background:none;border:1px solid var(--danger,#c0392b);border-radius:6px;padding:3px 8px;font-size:11px;" onclick="deleteSaleRecord('${e.id}')">🗑 ভুল/ডুপ্লিকেট বিক্রয় মুছুন</button>
        </div>` : '';
      return `<div class="card receipt" style="margin-top:0;padding:12px;cursor:pointer;" onclick="showReceiptById('${e.id}')">
        <div class="r-meta" style="margin:0 0 4px;"><span>${dt}</span><span class="badge badge-gold">${running<0?'অগ্রিম এখন: '+fmt(-running):'বাকি এখন: '+fmt(running)}</span></div>
        ${(e.patientName && e.patientName.trim() && e.patientName.trim()!==(c.name||'').trim()) ? `<div class="row-sub" style="margin:-2px 0 6px;">রোগী: <b>${escapeHtml(e.patientName)}</b></div>` : ''}
        <table style="margin-top:4px;">
          <thead><tr><th>ওষুধ</th><th class="num">পরিমাণ</th><th class="num">মূল্য</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="r-meta" style="margin-top:6px;font-weight:700;">
          <span>মোট: ${fmt(e.total)}</span>
          <span>নগদ: ${fmt(e.cash)}${e.due>0?' • বাকি +'+fmt(e.due):''}</span>
        </div>
        ${resellWidget}
        ${deleteBtn}
      </div>`;
    }
    if(e.type==='adjust'){
      return `<div class="row-item"><div><div class="row-title">বাকি যোগ করা হয়েছে (ম্যানুয়াল)</div><div class="row-sub">${dt}${e.forName?' • নামে: <b>'+escapeHtml(e.forName)+'</b>':''}</div></div><div class="row-right"><span class="badge badge-gold">+${fmt(e.amount)}</span><div class="row-sub" style="margin-top:3px;">বাকি: ${dueText(running)}</div></div></div>`;
    }
    return `<div class="row-item"><div><div class="row-title">টাকা জমা নিয়েছেন</div><div class="row-sub">${dt}${e.forName?' • নামে: <b>'+escapeHtml(e.forName)+'</b>':''}</div></div><div class="row-right"><span class="badge badge-green">-${fmt(e.amount)}</span><div class="row-sub" style="margin-top:3px;">বাকি: ${dueText(running)}</div></div></div>`;
  });
  // The running-বাকি balance above has to be computed oldest→newest (each entry depends on the
  // one before it) — but the person wants to actually SEE the newest transaction first, so the
  // display order is reversed only after that math is done.
  const rows = rowsHtml.slice().reverse().join('<div style="height:8px;"></div>');
  document.getElementById('ledgerCustName').textContent = c.name;
  try{ const lel=document.getElementById('ledgerCustName'); if(lel && _photoCache[c.id]){ lel.insertAdjacentHTML('afterbegin', custAvatar(c,36,true)+' '); } }catch(e){}
  try{
    const nameEl = document.getElementById('ledgerCustName');
    let callEl = document.getElementById('ledgerCallBtn');
    if(!callEl){ callEl = document.createElement('div'); callEl.id = 'ledgerCallBtn'; callEl.style.cssText='margin-top:8px;'; nameEl.parentNode.parentNode.insertBefore(callEl, nameEl.parentNode.nextSibling); }
    callEl.innerHTML = _custTel(c.mobile) ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div style="font-size:14px;opacity:.85;">${escapeHtml(c.mobile)}</div><a href="${_telHref(c.mobile)}" style="text-decoration:none;background:#e6f4ea;color:#067647;border-radius:10px;padding:8px 14px;font-weight:700;white-space:nowrap;">📞 কল</a></div>` : '';
  }catch(e){}
  const isOwnerView = currentRole()==='owner';
  const purchasedWrap = document.getElementById('ledgerTotalPurchasedWrap');
  const profitWrap = document.getElementById('ledgerTotalProfitWrap');
  if(isOwnerView){
    document.getElementById('ledgerTotalPurchased').textContent = fmt(customerTotalPurchased(custId));
    document.getElementById('ledgerTotalProfit').textContent = fmt(customerTotalProfit(custId));
    purchasedWrap.style.display = '';
    profitWrap.style.display = '';
  } else {
    purchasedWrap.style.display = 'none';
    profitWrap.style.display = 'none';
  }
  document.getElementById('ledgerCurrentDue').textContent = dueText(c.due);
  if(_lbCust !== custId){ _lbCust = custId; _lbOpen = false; }
  let panel = '';
  try{ panel = _lbOpen ? _ledgerBreakdownHtml(c, custSales, custPayments) : ''; }catch(e){ console.error(e); }
  try{
    const dueEl = document.getElementById('ledgerCurrentDue'); const card = dueEl && dueEl.parentElement;
    if(card){
      card.style.cursor = 'pointer'; card.onclick = ()=>{ _lbOpen = !_lbOpen; showLedger(custId); };
      let hint = card.querySelector('.lb-hint');
      if(!hint){ hint = document.createElement('div'); hint.className = 'lb-hint row-sub'; hint.style.cssText='margin-top:4px;font-size:12px;color:#067647;'; card.appendChild(hint); }
      hint.textContent = _lbOpen ? '▾ কার কত বাকি — বন্ধ করতে চাপুন' : '▸ কার নামে কত বাকি — দেখতে চাপুন';
    }
  }catch(e){}
  document.getElementById('ledgerContent').innerHTML = panel + (rows || `<div class="empty-state">এই কাস্টমারের কোনো লেনদেন নেই</div>`);
  _currentLedgerCustId = custId;
  document.getElementById('ledgerRecalcWrap').style.display = isOwnerView ? '' : 'none';
  openModal('ledgerModalBackdrop');
}
// One-off correction tool: recomputes this customer's বাকি purely from their actual remaining
// sales (dueAdded) and payments history — the same numbers the ledger rows themselves are built
// from — and overwrites the stored cust.due (locally + cloud, as an absolute value, never
// increment) to match exactly. Exists because increment()-based cloud updates on the due field
// (the delete-sale path in particular, before it was fixed to set an absolute value) had no
// floor and could drift cloud due away from the true, locally-clamped value — this button is the
// way to pull a customer's due back in sync with reality after that kind of drift, whatever
// caused it. Safe to run any time; matches what the ledger already displays if nothing is wrong.
async function recalcCustomerDue(){
  const custId = _currentLedgerCustId;
  const c = customers.find(x=>x.id===custId);
  if(!c) return;
  if(!requireOwnerRole('বাকি পুনর্গণনা করা')) return;
  const totalDueAdded = sales.filter(s=>s.customerId===custId).reduce((a,s)=>a+(s.dueAdded||0),0);
  const custPays = payments.filter(p=>p.customerId===custId);
  const totalPaid = custPays.filter(p=>p.type!=='due_adjustment').reduce((a,p)=>a+(p.amount||0),0);
  const totalManualAdded = custPays.filter(p=>p.type==='due_adjustment').reduce((a,p)=>a+(p.amount||0),0);
  const correctDue = totalDueAdded + totalManualAdded - totalPaid;
  const oldDue = c.due||0;
  c.due = correctDue;
  save(DB_KEYS.customer, customers);
  if(cloudReady()) shopColl('customers').doc(c.id).set({due: correctDue}, {merge:true}).catch(e=>console.error(e));
  toast(oldDue===correctDue ? '✓ হিসাব ঠিকই ছিল, কোনো পরিবর্তন লাগেনি' : `✓ বাকি ঠিক করা হয়েছে: ${dueText(oldDue)} → ${dueText(correctDue)}`);
  renderCustomers(); renderDashboard();
  showLedger(custId);
}

// ===== বাকি এখন লেনদেন-ইতিহাস (বিক্রয়ের বাকি + হাতে-যোগ − জমা) থেকেই হিসাব হয় =====
// আগে কাস্টমারের "বাকি" একটা আলাদা সংখ্যা হিসেবে ফোন/ক্লাউডে রাখা হতো। দুই ফোন বা দুর্বল নেট থাকলে
// কোনো পুরনো কপি (বাকি ১৮৭) জমা-নেওয়ার (বাকি ০) ওপর ফিরে আসতে পারত — ইতিহাসে জমা ঠিকই থাকত, কিন্তু সংখ্যাটা উল্টে যেত।
// এখন প্রতিবার ক্লাউড সিঙ্কের পর, খাতা খোলার সময় ও জমা নেওয়ার সময় ইতিহাস থেকে সঠিক বাকি বের করে বসানো হয়।
const _dueLiveSeen = {};
let _dueReconTimer = null;
function ledgerDueFor(custId){
  // ★ showLedger()-এর হিসাবের হুবহু একই নিয়ম (ধাপে ধাপে, ০-এর নিচে নামে না)
  if(localStorage.getItem('ssn_archived_any')) return {unsafe:true, due:0}; // পুরনো বিক্রয় আর্কাইভ হলে ইতিহাস অসম্পূর্ণ — নিজে থেকে বদলাবে না
  const ev = [];
  let unsafe = false;
  sales.forEach(s=>{
    if(s.customerId!==custId) return;
    if(s.dueAdded==null && s.payMethod==='due') unsafe = true; // খুব পুরনো রেকর্ড, বাকির পরিমাণ জানা নেই
    ev.push({ts:s.ts||0, d:(s.dueAdded||0)});
  });
  payments.forEach(p=>{
    if(p.customerId!==custId) return;
    if(p.type==='due_adjustment') ev.push({ts:p.ts||0, d:(p.amount||0)});
    else if(!p.type) ev.push({ts:p.ts||0, d:-(p.amount||0)});
  });
  ev.sort((a,b)=>a.ts-b.ts);
  let run = 0; ev.forEach(e=>{ run = run + e.d; });
  return {unsafe, due:run};
}
function reconcileOne(custId){
  const c = customers.find(x=>x.id===custId); if(!c) return null;
  const r = ledgerDueFor(custId); if(r.unsafe) return null;
  const old = c.due||0; if(old===r.due) return null;
  c.due = r.due;
  save(DB_KEYS.customer, customers);
  try{
    const lg = JSON.parse(localStorage.getItem('ssn_due_fix_log')||'[]');
    lg.push({ts:Date.now(), id:c.id, name:c.name, old, now:r.due}); localStorage.setItem('ssn_due_fix_log', JSON.stringify(lg.slice(-50)));
  }catch(e){}
  if(cloudReady()) shopColl('customers').doc(c.id).set({due:r.due},{merge:true}).catch(e=>console.error(e));
  return {name:c.name, old, now:r.due};
}
function reconcileAllDues(){
  const fixed = [];
  customers.slice().forEach(c=>{ const f = reconcileOne(c.id); if(f) fixed.push(f); });
  if(fixed.length){
    toast('✓ বাকির হিসাব মিলিয়ে ঠিক করা হয়েছে: '+fixed.slice(0,3).map(f=>f.name+' '+fmt(f.old)+'→'+fmt(f.now)).join(', ')+(fixed.length>3?' …':''));
    try{ renderCustomers(); renderDashboard(); }catch(e){}
  }
}
function scheduleDueReconcile(collName){
  _dueLiveSeen[collName] = true;
  // তিনটা তালিকাই অন্তত একবার ক্লাউড থেকে এসে গেলে তবেই হিসাব (আধা-আসা তথ্য দিয়ে হিসাব করলে ভুল হতো)
  if(!(_dueLiveSeen.customers && _dueLiveSeen.sales && _dueLiveSeen.payments)) return;
  clearTimeout(_dueReconTimer);
  _dueReconTimer = setTimeout(reconcileAllDues, 2500);
}
window.addEventListener('load', ()=>setTimeout(()=>{ try{ if(!cloudReady()) reconcileAllDues(); }catch(e){} }, 3000));
function clearFullDue(){
  const c = customers.find(x=>x.id===payingCustomerId);
  if(!c) return;
  document.getElementById('paymentAmount').value = c.due;
}
let editingSupplierId = null;
// ===== সাপ্লায়ারের প্রতিনিধির (কন্টাক্ট ব্যক্তির) ছবি =====
// কোম্পানির লোক বদলালে নতুন লোকের সারি যোগ করুন, আগের জনেরটা ✕ দিয়ে সরান — ছবি প্রতিটি লোকের সাথে আলাদা থাকে।
// কাস্টমারের ছবির একই ব্যবস্থায় (ফোন + ক্লাউড) রাখা হয়; সাপ্লায়ার/বাকি/ক্রয়ের কোনো হিসাবের সাথে জড়ানো নেই।
const _photoNames = {};
let _scPhotoTarget = null;
function _scAvatar(id, name, size, zoom){ _photoNames[id] = name||''; return custAvatar({id, name:name||'?'}, size, zoom); }
function _scRefreshRow(row){
  if(!row) return; const id = row.dataset.cid;
  row.querySelector('.sc-av').innerHTML = _scAvatar(id, row.querySelector('.sc-name').value, 52, true);
  row.querySelector('.sc-photo-rm').style.display = _photoCache[id] ? 'inline-block' : 'none';
}
function _scPickClick(btn){ const row = btn.closest('.sup-crow'); _scPhotoTarget = row.dataset.cid; document.getElementById('scPhotoFile').click(); }
async function pickSupContactPhoto(evt){
  const f = evt.target.files && evt.target.files[0]; const id = _scPhotoTarget;
  try{ evt.target.value = ''; }catch(e){}
  if(!f || !id) return;
  try{
    const {thumb, full} = await _resizeBoth(f);
    await photoPut(id, thumb);
    _photoCache[id] = thumb; _photoFullCache[id] = full;
    document.querySelectorAll('#sContacts .sup-crow').forEach(r=>{ if(r.dataset.cid===id) _scRefreshRow(r); });
    if(cloudReady()){
      const ts = Date.now();
      shopColl('photos').doc(id).set({data:thumb, ts}).catch(e=>console.error(e));
      shopColl('photos_full').doc(id).set({data:full, ts}).catch(e=>console.error(e));
      toast('ছবি যোগ হয়েছে ✓');
    } else toast('ছবি এই ফোনে যোগ হয়েছে (ক্লাউড সংযুক্ত না থাকায় অন্য ফোনে যাবে না)');
  }catch(e){ console.error(e); toast('ছবি যোগ করা যায়নি'); }
}
async function _scDropPhoto(id){
  try{
    if(!_photoCache[id]) return;
    await photoDelete(id); delete _photoCache[id]; delete _photoFullCache[id];
    if(cloudReady()){ shopColl('photos').doc(id).delete().catch(()=>{}); shopColl('photos_full').doc(id).delete().catch(()=>{}); }
  }catch(e){ console.error(e); }
}
async function removeSupContactPhoto(btn){
  const row = btn.closest('.sup-crow'); const id = row.dataset.cid;
  await _scDropPhoto(id); _scRefreshRow(row); toast('ছবি সরানো হয়েছে');
}
function removeSupContactRow(btn){
  const row = btn.closest('.sup-crow'); const id = row.dataset.cid;
  const nm = row.querySelector('.sc-name').value.trim();
  if(!confirm((nm?('"'+nm+'"'):'এই লোকের')+' নম্বর ও ছবি সরিয়ে দেবেন?\n(সংরক্ষণ করলে তবেই স্থায়ীভাবে সরবে)')) return;
  row.remove(); _scDropPhoto(id);
}
function _supContactRowHtml(c){
  c = c || {};
  const cid = c.id || uid();
  return `<div class="sup-crow" data-cid="${cid}" style="border:1px solid #e1e5e3;border-radius:12px;padding:8px;margin-top:8px;">
    <div style="display:flex;gap:8px;align-items:center;">
      <span class="sc-av" style="flex:none;">${_scAvatar(cid, c.name, 52, true)}</span>
      <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;">
        <button type="button" class="btn btn-sm btn-outline" onclick="_scPickClick(this)">📷 ছবি তুলুন / বাছুন</button>
        <button type="button" class="btn btn-sm btn-outline sc-photo-rm" style="display:${_photoCache[cid]?'inline-block':'none'};" onclick="removeSupContactPhoto(this)">ছবি সরান</button>
      </div>
      <button type="button" onclick="removeSupContactRow(this)" style="border:0;background:#f1f1f1;border-radius:10px;width:38px;height:38px;font-size:16px;flex:none;" title="এই লোককে সরান">✕</button>
    </div>
    <input type="text" class="sc-name" placeholder="নাম (যেমন: রাকিব ভাই)" value="${escapeHtml(c.name||'')}" style="margin-top:6px;">
    <input type="text" class="sc-group" list="supGroupList" placeholder="গ্রুপ / টিম (যেমন: কার্ডিয়া টিম)" value="${escapeHtml(c.group||'')}" style="margin-top:6px;">
    <input type="tel" class="sc-mobile" inputmode="tel" placeholder="মোবাইল নম্বর" value="${escapeHtml(c.mobile||'')}" style="margin-top:6px;">
  </div>`;
}
function addSupContactRow(c){
  const box = document.getElementById('sContacts'); if(!box) return;
  box.insertAdjacentHTML('beforeend', _supContactRowHtml(c));
}
function _supContactsOf(s){
  if(!s) return [];
  if(Array.isArray(s.contacts) && s.contacts.length) return s.contacts.filter(c=>c && (c.mobile||c.name));
  return s.mobile ? [{name:'', group:'', mobile:s.mobile}] : [];
}
function _supSearchText(s){ return _supContactsOf(s).map(c=>[c.name,c.group,c.mobile].join(' ')).join(' '); }
function _supContactsText(list){ return (list||[]).map(c=>[c.name,c.group,c.mobile].filter(Boolean).join(' / ')).join(' | '); }
function openSupplierModal(id){
  _supplierReturnToPurchase = false;
  editingSupplierId = (typeof id==='string' && id) ? id : null;
  const sup = editingSupplierId ? suppliers.find(x=>x.id===editingSupplierId) : null;
  if(editingSupplierId && !sup){ editingSupplierId = null; }
  document.getElementById('supModalTitle').textContent = sup ? 'সাপ্লায়ার সম্পাদনা' : 'নতুন সাপ্লায়ার';
  document.getElementById('sName').value = sup ? (sup.name||'') : '';
  const box = document.getElementById('sContacts'); box.innerHTML = '';
  const list = sup ? _supContactsOf(sup) : [];
  if(list.length) list.forEach(c=>addSupContactRow(c)); else addSupContactRow();
  const del = document.getElementById('sDeleteBtn');
  if(del) del.style.display = (sup && currentRole()==='owner') ? 'block' : 'none';
  openModal('supplierModalBackdrop');
}
function saveSupplier(){
  const name = document.getElementById('sName').value.trim();
  if(!name){ toast('কোম্পানির নাম দিন'); return; }
  const contacts = [];
  document.querySelectorAll('#sContacts .sup-crow').forEach(r=>{
    const c = {
      id: r.dataset.cid,
      name: r.querySelector('.sc-name').value.trim(),
      group: r.querySelector('.sc-group').value.trim(),
      mobile: r.querySelector('.sc-mobile').value.trim()
    };
    if(c.name || c.group || c.mobile) contacts.push(c);
  });
  const mobile = (contacts.find(c=>c.mobile)||{}).mobile || '';
  const contactsText = _supContactsText(contacts);
  const dupe = suppliers.find(x=>x.id!==editingSupplierId && (x.name||'').trim().toLowerCase()===name.toLowerCase());
  if(dupe && !askDelete(`"${dupe.name}" নামে একটা সাপ্লায়ার আগে থেকেই আছে।\n\nতবুও আলাদা করে সংরক্ষণ করবেন?`)) return;

  if(editingSupplierId){
    const sup = suppliers.find(x=>x.id===editingSupplierId);
    if(!sup){ toast('সাপ্লায়ার খুঁজে পাওয়া যায়নি'); return; }
    const oldName = sup.name;
    sup.name = name; sup.mobile = mobile; sup.contacts = contacts; sup.contactsText = contactsText; sup.updatedAt = Date.now();
    save(DB_KEYS.supplier, suppliers);
    // নাম বদলালে আগের ক্রয়ের তালিকায়ও নতুন নাম দেখাতে
    if(oldName !== name){
      const touched = purchases.filter(p=>p.supplierId===sup.id);
      if(touched.length){
        touched.forEach(p=>{ p.supplierName = name; });
        save(DB_KEYS.purchase, purchases);
        if(cloudReady()) touched.forEach(p=>{ shopColl('purchases').doc(p.id).update({supplierName:name}).catch(e=>console.error(e)); });
      }
    }
    if(cloudReady()) shopColl('suppliers').doc(sup.id).set({name, mobile, contacts, contactsText, updatedAt:sup.updatedAt}).catch(e=>console.error(e));
    closeModal('supplierModalBackdrop'); toast('সাপ্লায়ার আপডেট হয়েছে ✓'); renderSuppliers();
    try{ renderPurchases(); }catch(e){}
    editingSupplierId = null;
    return;
  }

  const supId = uid();
  suppliers.push({id:supId, name, mobile, contacts, contactsText});
  save(DB_KEYS.supplier, suppliers);
  closeModal('supplierModalBackdrop'); toast('সাপ্লায়ার যোগ হয়েছে ✓'); renderSuppliers();
  if(_supplierReturnToPurchase){
    _supplierReturnToPurchase = false;
    const sel = document.getElementById('pSupplier');
    if(sel && !sel.querySelector('option[value="'+supId+'"]')){ const o=document.createElement('option'); o.value=supId; o.textContent=name; sel.appendChild(o); }
    pickPSupplier(supId, name);
  }
  if(cloudReady()){
    shopColl('suppliers').doc(supId).set({name, mobile, contacts, contactsText}).catch(e=>console.error(e));
  }
}
function deleteSupplier(){
  if(!editingSupplierId) return;
  if(currentRole()!=='owner'){ toast('সাপ্লায়ার মুছতে পারবেন শুধু মালিক'); return; }
  const id = editingSupplierId;
  const sup = suppliers.find(x=>x.id===id); if(!sup) return;
  const due = supplierDue(id);
  if(Math.abs(due) > 0.5){
    askDelete(`"${sup.name}"-এর হিসাবে ${due>0?'বাকি':'অগ্রিম'} ${fmt(Math.abs(due))} আছে।\n\nহিসাব ০ না করে মুছলে এই টাকার হিসাব হারিয়ে যাবে — তাই এখন মোছা যাচ্ছে না। আগে "টাকা পরিশোধ" বা "বাকি যোগ" দিয়ে হিসাব মিলিয়ে নিন।`);
    return;
  }
  const nPur = purchases.filter(p=>p.supplierId===id).length;
  if(!askDelete(`"${sup.name}" সাপ্লায়ারকে মুছে ফেলবেন?\n\n${nPur?('এই সাপ্লায়ারের নামে '+nPur+'টা ক্রয় এন্ট্রি আছে — ক্রয়ের তালিকায় ওগুলো থাকবে, শুধু সাপ্লায়ারের তালিকা থেকে নাম যাবে।\n\n'):''}মুছলেও সেটিংস → "পরিবর্তনের লগ ও রিসাইকেল বিন" থেকে ফেরানো যাবে।`)) return;
  suppliers = suppliers.filter(x=>x.id!==id);
  addTombstone(id);
  save(DB_KEYS.supplier, suppliers);
  editingSupplierId = null;
  closeModal('supplierModalBackdrop'); toast('সাপ্লায়ার মুছে ফেলা হয়েছে'); renderSuppliers();
  if(cloudReady()) shopColl('suppliers').doc(id).delete().catch(e=>console.error(e));
}
function _telHref(m){ return 'tel:'+String(m||'').replace(/[^0-9+]/g,''); }
function showSupplierDetail(supId){
  const sup = suppliers.find(x=>x.id===supId); if(!sup) return;
  const isOwner = currentRole()==='owner';
  const list = _supContactsOf(sup);
  const groups = {};
  list.forEach(c=>{ const g = c.group || 'সাধারণ'; (groups[g] = groups[g] || []).push(c); });
  const groupsHtml = Object.keys(groups).map(g=>`
    <div style="margin-top:12px;">
      <div style="font-size:12.5px;font-weight:700;color:var(--primary-dark);margin-bottom:4px;">${escapeHtml(g)}</div>
      ${groups[g].map(c=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px dashed #ddd;">
        <div style="display:flex;gap:10px;align-items:center;min-width:0;">${c.id?_scAvatar(c.id, c.name, 44, true):''}<div style="min-width:0;overflow-wrap:anywhere;"><div style="font-weight:600;">${escapeHtml(c.name||'—')}</div><div style="font-size:13px;opacity:.8;">${escapeHtml(c.mobile||'')}</div></div></div>
        ${c.mobile?`<a href="${_telHref(c.mobile)}" style="text-decoration:none;background:#e6f4ea;color:#067647;border-radius:10px;padding:8px 12px;font-weight:700;white-space:nowrap;">📞 কল</a>`:''}
      </div>`).join('')}
    </div>`).join('');
  const due = isOwner ? supplierDue(supId) : 0;
  const dueHtml = isOwner ? `<div style="margin:6px 0 2px;">বর্তমান ${due<0?'অগ্রিম':'বাকি'}: <b style="color:${due>0?'#b42318':'#067647'};">${fmt(Math.abs(due))}</b></div>` : '';
  const ov = _supOverlay(`
    <div style="font-weight:800;font-size:18px;">${escapeHtml(sup.name||'')}</div>
    ${dueHtml}
    ${groupsHtml || '<div class="empty-state" style="padding:14px 0;">কোনো নম্বর যোগ করা নেই।</div>'}
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
      <button id="sdEdit" class="btn btn-outline" style="flex:1;">✏️ সম্পাদনা</button>
      ${isOwner?'<button id="sdLedger" class="btn btn-outline" style="flex:1;">📒 ইতিহাস</button>':''}
    </div>
    <button id="sdClose" class="btn btn-block" style="margin-top:10px;background:#f1f1f1;">বন্ধ করুন</button>`);
  ov.querySelector('#sdClose').onclick = ()=>ov.remove();
  ov.querySelector('#sdEdit').onclick = ()=>{ ov.remove(); openSupplierModal(supId); };
  const lb = ov.querySelector('#sdLedger'); if(lb) lb.onclick = ()=>{ ov.remove(); showSupplierLedger(supId); };
}
// ---- সাপ্লায়ারের লোকদের কন্টাক্ট ফাইল (.vcf): ফোনের Contacts-এ নিলে কল এলে নাম ও ছবি ভেসে উঠবে।
async function downloadAllSupplierVcf(){
  const items = [];
  suppliers.forEach(sup=>{ _supContactsOf(sup).forEach(c=>{
    const mob = (typeof bnToEnDigits==='function' ? bnToEnDigits(c.mobile||'') : (c.mobile||'')).replace(/[^\d+]/g,'');
    if(mob) items.push({sup, c, mob});
  }); });
  if(!items.length){ toast('নম্বর দেওয়া কোনো সাপ্লায়ার-কন্টাক্ট নেই'); return; }
  toast('ফাইল তৈরি হচ্ছে...');
  // বড় ছবি ক্লাউডে থাকলে সেটা আনি (ফোনে কল স্ক্রিনে পরিষ্কার দেখাতে), না পেলে ছোটটাই
  if(cloudReady()){
    await Promise.all(items.map(async it=>{
      const id = it.c.id; if(!id || !_photoCache[id] || _photoFullCache[id]) return;
      try{ const d = await shopColl('photos_full').doc(id).get(); const dd = d.exists ? d.data() : null; if(dd && dd.data) _photoFullCache[id] = dd.data; }catch(e){}
    }));
  }
  const cards = items.map(({sup,c,mob})=>{
    const label = _vcfEsc((c.name||c.group||'প্রতিনিধি') + ' - ' + (sup.name||'') + ' (নৃসিংহ)');
    const lines = ['BEGIN:VCARD','VERSION:3.0','N:'+label+';;;;','FN:'+label,'ORG:'+_vcfEsc(sup.name||''),'TEL;TYPE=CELL:'+mob];
    if(c.group) lines.push('TITLE:'+_vcfEsc(c.group));
    const ph = c.id && (_photoFullCache[c.id] || _photoCache[c.id]);
    const m = ph && /^data:image\/(\w+);base64,(.+)$/.exec(ph);
    if(m){ const type = m[1].toUpperCase()==='JPG' ? 'JPEG' : m[1].toUpperCase(); lines.push(_vcfFold('PHOTO;ENCODING=b;TYPE='+type+':'+m[2])); }
    lines.push('END:VCARD');
    return lines.join('\r\n');
  });
  _downloadVcf(cards.join('\r\n')+'\r\n', 'suppliers-'+todayStr()+'.vcf');
  toast(cards.length+' জনের কন্টাক্ট ফাইল ডাউনলোড হয়েছে — Contacts-এ "নৃসিংহ" লিখে সার্চ করলে পাবেন');
}
let supplierShowAll = false;
// ===== সাপ্লায়ারের বাকি/পরিশোধ =====
// বাকি = (এই সাপ্লায়ারের "বাকিতে কেনা" ক্রয়ের মোট) + (হাতে যোগ করা পুরনো বাকি) − (পরিশোধ করা টাকা)।
// হিসাব সবসময় রেকর্ড থেকে নতুন করে বের হয় — ক্রয় মুছলে/বদলালে বাকিও নিজে ঠিক হয়ে যায়।
// পরিশোধ/পুরনো-বাকি রেকর্ড আগের `payments` তালিকাতেই থাকে (supplierId দিয়ে; customerId নেই), তাই ক্লাউড-সিঙ্ক ও ব্যাকআপে নিজে নিজে ঢোকে,
// আর কাস্টমারের বাকি-হিসাব এগুলো ছোঁয় না (সেগুলো customerId দিয়ে ছাঁকে)।
function supplierEvents(supId){
  const ev = [];
  purchases.forEach(p=>{ if(p.supplierId===supId && p.credit) ev.push({ts:p.ts||0, kind:'purchase', d:(p.qty||0)*(p.price||0), label:(p.medicineName||'')+' × '+(p.qty||0)}); });
  payments.forEach(p=>{
    if(p.supplierId!==supId) return;
    if(p.type==='supplier_due_adjustment') ev.push({ts:p.ts||0, kind:'adjust', d:(p.amount||0), label:'পুরনো/হাতে যোগ করা বাকি'});
    else if(p.type==='supplier_payment') ev.push({ts:p.ts||0, kind:'payment', d:-(p.amount||0), label:'টাকা পরিশোধ'});
  });
  return ev.sort((a,b)=>a.ts-b.ts);
}
function supplierDue(supId){
  const v = supplierEvents(supId).reduce((a,e)=>a+e.d,0);
  return Math.round(v*100)/100;
}
function _supOverlay(inner){
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px;';
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:460px;width:100%;max-height:88vh;overflow:auto;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.3);">'+inner+'</div>';
  document.body.appendChild(ov);
  return ov;
}
function supplierMoneyDialog(supId, mode){   // mode: 'pay' | 'adjust'
  const sup = suppliers.find(x=>x.id===supId); if(!sup) return;
  const due = supplierDue(supId);
  const isPay = mode==='pay';
  const ov = _supOverlay(`
    <div style="font-weight:700;font-size:16px;margin-bottom:6px;">${isPay?'💸 সাপ্লায়ারকে টাকা পরিশোধ':'➕ পুরনো/হাতে বাকি যোগ করুন'}</div>
    <div style="font-weight:600;">${escapeHtml(sup.name||'')}</div>
    <div style="margin:4px 0 10px;">বর্তমান বাকি: <b>${due<0 ? 'অগ্রিম '+fmt(-due) : fmt(due)}</b></div>
    <label style="font-size:13px;">${isPay?'কত টাকা দিলেন? (৳)':'কত টাকা বাকি যোগ হবে? (৳)'}</label>
    <input type="number" id="smAmount" min="0" step="any" style="width:100%;margin:4px 0 12px;padding:10px;border:1px solid #ccc;border-radius:10px;font-size:16px;box-sizing:border-box;">
    ${isPay?'':'<div class="row-sub" style="margin-bottom:10px;">যেমন শুরুর আগে থেকে যে বাকি ছিল, বা ইনভয়েসে যা এন্ট্রি করা হয়নি।</div>'}
    <button id="smSave" class="btn btn-primary btn-block" style="margin-bottom:8px;">সংরক্ষণ করুন</button>
    <button id="smCancel" class="btn btn-block" style="background:#f1f1f1;">বাতিল</button>`);
  const amtEl = ov.querySelector('#smAmount'); setTimeout(()=>amtEl.focus(),50);
  ov.querySelector('#smCancel').onclick = ()=>ov.remove();
  ov.querySelector('#smSave').onclick = function(){
    let amount = parseFloat((typeof bnToEnDigits==='function'?bnToEnDigits(amtEl.value):amtEl.value))||0;
    if(!(amount>0)){ toast('সঠিক পরিমাণ দিন'); return; }
    if(isPay){
      const cur = supplierDue(supId);
      if(cur<=0){ if(!confirm('এই সাপ্লায়ারের এখন কোনো বাকি নেই'+(cur<0?' (আগে থেকেই '+fmt(-cur)+' অগ্রিম দেওয়া আছে)':'')+'।\n\n'+fmt(amount)+' অগ্রিম হিসেবে লিখে রাখবেন?')) return; }
      else if(amount>cur){
        if(amount-cur<1){ amount = cur; }   // ১ টাকার কম অতিরিক্ত = পয়সার গোল, পূর্ণ শোধ
        else if(!confirm('বাকি আছে '+fmt(cur)+', আপনি '+fmt(amount)+' দিচ্ছেন।\n\nবাকি শোধ হয়ে অতিরিক্ত '+fmt(amount-cur)+' অগ্রিম থাকবে। এগোবেন?')) return;
      }
    }
    this.disabled = true;   // দুবার চাপ ঠেকাতে
    const pid = uid(), ts = Date.now();
    const rec = { supplierId:supId, amount, ts, date:todayStr(), type: isPay?'supplier_payment':'supplier_due_adjustment' };
    payments.push(Object.assign({id:pid}, rec));
    save(DB_KEYS.payment, payments);
    if(cloudReady()){ shopColl('payments').doc(pid).set(rec).catch(e=>console.error(e)); }
    ov.remove();
    toast(isPay ? fmt(amount)+' পরিশোধ লেখা হয়েছে ✓' : 'বাকি যোগ হয়েছে ✓');
    renderSuppliers();
    if(document.getElementById('supDueListOv')) showSupplierDueList();   // খোলা "কার কাছে কত বাকি" তালিকা হালনাগাদ
  };
}
// "মোট বাকি" চাপলে: কোন কোন সাপ্লায়ারের কাছে কত বাকি — বেশি বাকি আগে
function showSupplierDueList(){
  const old = document.getElementById('supDueListOv'); if(old) old.remove();
  const rows = suppliers.map(x=>({x, due:supplierDue(x.id)})).filter(o=>o.due>0).sort((a,b)=>b.due-a.due);
  const total = rows.reduce((a,o)=>a+o.due,0);
  const ov = _supOverlay(`
    <div style="font-weight:700;font-size:16px;">📋 কার কাছে কত বাকি</div>
    <div style="margin:6px 0 10px;">মোট বাকি: <b style="color:#b42318;">${fmt(total)}</b> — ${rows.length}টা সাপ্লায়ার</div>
    ${rows.length ? rows.map(o=>`
      <div style="padding:10px 0;border-bottom:1px dashed #ddd;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <div style="font-weight:700;">${escapeHtml(o.x.name||'(নাম নেই)')}</div>
          <div style="color:#b42318;font-weight:700;white-space:nowrap;">${fmt(o.due)}</div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
          <button class="btn btn-sm btn-outline" onclick="supplierMoneyDialog('${o.x.id}','pay')">💸 টাকা পরিশোধ</button>
          <button class="btn btn-sm btn-outline" onclick="showSupplierLedger('${o.x.id}')">📒 ইতিহাস</button>
        </div>
      </div>`).join('') : '<div class="empty-state">কোনো সাপ্লায়ারের কাছে এখন বাকি নেই 🎉</div>'}
    <button id="sdClose" class="btn btn-block" style="margin-top:12px;background:#f1f1f1;">বন্ধ করুন</button>`);
  ov.id = 'supDueListOv';
  ov.querySelector('#sdClose').onclick = ()=>ov.remove();
}
function showSupplierLedger(supId){
  const sup = suppliers.find(x=>x.id===supId); if(!sup) return;
  const ev = supplierEvents(supId);
  let run = 0;
  const rows = ev.map(e=>{
    run += e.d;
    const dt = new Date(e.ts).toLocaleDateString('bn-BD');
    const color = e.d>0 ? '#b42318' : '#067647';
    return `<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px dashed #ddd;font-size:14px;">
      <div><div>${escapeHtml(e.label)}</div><div style="font-size:12px;opacity:.7;">${dt}</div></div>
      <div style="text-align:right;"><div style="color:${color};font-weight:700;">${e.d>0?'+':'−'}${fmt(Math.abs(e.d))}</div><div style="font-size:12px;opacity:.7;">বাকি ${run<0?'অগ্রিম '+fmt(-run):fmt(run)}</div></div></div>`;
  }).join('');
  const due = supplierDue(supId);
  const ov = _supOverlay(`
    <div style="font-weight:700;font-size:16px;">📒 ${escapeHtml(sup.name||'')} — বাকির ইতিহাস</div>
    <div style="margin:6px 0 10px;">বর্তমান বাকি: <b>${due<0?'অগ্রিম '+fmt(-due):fmt(due)}</b></div>
    ${rows || '<div class="empty-state">এখনো কোনো বাকি বা পরিশোধ লেখা নেই।<br><span style="font-size:12.5px;">ক্রয় এন্ট্রিতে "বাকিতে কিনেছি" টিক দিলে এখানে আসবে।</span></div>'}
    <button id="slClose" class="btn btn-block" style="margin-top:12px;background:#f1f1f1;">বন্ধ করুন</button>`);
  ov.querySelector('#slClose').onclick = ()=>ov.remove();
}
// ---- বাকির সাপ্লায়ার: ওষুধের কোম্পানি থেকে নিজে ধরা ----
// কোম্পানির নাম তুলনার জন্য: ছোট হাতের, Pharmaceuticals/Ltd/PLC... শব্দ বাদ ("Square pharmaceuticals" = "Square Pharma Ltd.")
function companyKey(n){
  return normalizeMedName(String(n||'').replace(/[.,()&]/g,' '))
    .replace(/\b(the|pharmaceuticals?|pharma|pharmacy|laboratories|laboratory|labs?|ltd|limited|plc|pvt|private|co|company|bangladesh|bd)\b/g,' ')
    .replace(/\s+/g,' ').trim();
}
function _lev(a,b){
  const m=a.length, n=b.length; if(!m) return n; if(!n) return m;
  let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){ const cur=[i]; for(let j=1;j<=n;j++){ cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1)); } prev=cur; }
  return prev[n];
}
function _useSupplierInForm(sup){
  const sel = document.getElementById('pSupplier');
  if(sel && !sel.querySelector('option[value="'+sup.id+'"]')){ const o=document.createElement('option'); o.value=sup.id; o.textContent=sup.name; sel.appendChild(o); }
  pickPSupplier(sup.id, sup.name);
}
function _createSupplierQuick(name){
  const id = uid();
  suppliers.push({id, name, mobile:''});
  save(DB_KEYS.supplier, suppliers);
  if(cloudReady()){ shopColl('suppliers').doc(id).set({name, mobile:''}).catch(e=>console.error(e)); }
  try{ renderSuppliers(); }catch(e){}
  return suppliers.find(x=>x.id===id);
}
function _supplierChoiceDialog(title, body, options, allowNewName){
  return new Promise(resolve=>{
    const ov = _supOverlay(`
      <div style="font-weight:700;font-size:16px;margin-bottom:6px;">${title}</div>
      <div style="font-size:14px;line-height:1.5;margin-bottom:10px;">${body}</div>
      <div id="scOpts"></div>
      ${allowNewName ? `<button id="scNew" class="btn btn-outline btn-block" style="margin-bottom:8px;">➕ নতুন সাপ্লায়ার বানান: <b>${escapeHtml(allowNewName)}</b></button>` : ''}
      <button id="scCancel" class="btn btn-block" style="background:#f1f1f1;">ফিরে যান</button>`);
    const box = ov.querySelector('#scOpts');
    options.forEach(sup=>{
      const b = document.createElement('button');
      b.className = 'btn btn-primary btn-block'; b.style.marginBottom = '8px';
      b.textContent = '✔ '+sup.name+' — এটাই';
      b.onclick = ()=>{ ov.remove(); resolve(sup); };
      box.appendChild(b);
    });
    const nb = ov.querySelector('#scNew'); if(nb) nb.onclick = ()=>{ ov.remove(); resolve(_createSupplierQuick(allowNewName)); };
    ov.querySelector('#scCancel').onclick = ()=>{ ov.remove(); resolve(null); };
  });
}
async function _resolveCreditSupplier(med){
  const company = (med.company||'').trim();
  if(company){
    const key = companyKey(company);
    // ১) নিজে ধরা: নাম মিলে গেলে (বা একটা অন্যটার শুরু) — কিছু জিজ্ঞেস না করে
    const auto = suppliers.find(x=>{ const k = companyKey(x.name); return k && key && (k===key || (k.length>=4 && key.length>=4 && (k.startsWith(key)||key.startsWith(k)))); });
    if(auto){ _useSupplierInForm(auto); toast('সাপ্লায়ার: '+auto.name+' (ওষুধের কোম্পানি থেকে)'); return true; }
    // ২) মেলেনি — বানান ভুলে বাকি দুই ভাগ না হয়ে যাক, তাই কাছাকাছি নাম দেখিয়ে একবার জিজ্ঞেস
    const near = suppliers.map(x=>({x, d:_lev(companyKey(x.name), key)}))
      .filter(o=>o.d <= Math.max(2, Math.floor(key.length*0.3))).sort((a,b)=>a.d-b.d).slice(0,3).map(o=>o.x);
    const pick = await _supplierChoiceDialog('কোন সাপ্লায়ারের বাকি?',
      `ওষুধের কোম্পানি: <b>${escapeHtml(company)}</b> — এই নামে সাপ্লায়ার তালিকায় নেই।`+(near.length?' কাছাকাছি নাম নিচে, এগুলোর একটা হলে সেটা বাছুন (নইলে বাকি দুই নামে ভাগ হয়ে যাবে):':' এটা নতুন কোম্পানি হলে নতুন সাপ্লায়ার বানান।'),
      near, company);
    if(!pick) return false;
    _useSupplierInForm(pick); return true;
  }
  // কোম্পানি লেখাই নেই
  const pick = await _supplierChoiceDialog('কোন সাপ্লায়ারের বাকি?',
    `"${escapeHtml(med.name)}" ওষুধে কোম্পানির নাম লেখা নেই। সাপ্লায়ার বাছুন।<br><span style="font-size:12.5px;opacity:.8;">ওষুধ ইনভেন্টরিতে কোম্পানি লিখে দিলে পরের বার এটা আর জিজ্ঞেস করবে না।</span>`,
    suppliers.slice(0,8), '');
  if(!pick) return false;
  _useSupplierInForm(pick); return true;
}
function creditChanged(){ if(!editingPurchaseId) _lastCredit = !!document.getElementById('pCredit').checked; }
let _lastCredit = false;
function _supHeadHtml(s){
  const list = _supContactsOf(s);
  const nm = String(s.name||'');
  const hue = Array.from(nm).reduce((a,ch)=>a+ch.charCodeAt(0),0) % 360;
  const ini = (Array.from(nm.trim())[0] || '?').toUpperCase();
  const withPhoto = list.find(c=>c.id && _photoCache[c.id]);
  const main = withPhoto
    ? _scAvatar(withPhoto.id, withPhoto.name, 52, false)
    : `<span style="width:52px;height:52px;border-radius:50%;flex:none;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;background:hsl(${hue},45%,89%);color:hsl(${hue},45%,28%);">${escapeHtml(ini)}</span>`;
  const stack = list.length>1
    ? `<div style="display:flex;align-items:center;margin-top:5px;">${list.slice(0,4).map((c,i)=>`<span style="margin-left:${i?-8:0}px;border:2px solid #fff;border-radius:50%;display:inline-flex;">${_scAvatar(c.id||('x'+i), c.name||c.group||'?', 26, false)}</span>`).join('')}${list.length>4?`<span class="row-sub" style="margin-left:6px;">+${list.length-4}</span>`:''}</div>` : '';
  return `<div onclick="showSupplierDetail('${s.id}')" style="cursor:pointer;display:flex;gap:10px;align-items:center;flex:1;min-width:0;">${main}<div style="min-width:0;overflow-wrap:anywhere;"><div class="row-title" style="color:var(--primary-dark);text-decoration:underline;">${escapeHtml(s.name||'(নাম নেই)')}</div><div class="row-sub">${_supSubLine(s)}</div>${stack}</div></div>`;
}
function _supSubLine(s){
  const l = _supContactsOf(s);
  if(!l.length) return '—';
  const first = l[0];
  const base = escapeHtml(first.name ? (first.name+(first.mobile?' · '+first.mobile:'')) : (first.mobile||'—'));
  return l.length>1 ? base+' <span style="opacity:.7;">+'+(l.length-1)+' জন</span>' : base;
}
function renderSuppliers(){
  const el = document.getElementById('supplierList');
  try{
    const q = (document.getElementById('supplierSearch')?.value||'').toLowerCase();
    const filtered = rankBy(suppliers, q, s=>s.name, [s=>s.mobile, s=>_supSearchText(s)]);
    const LIMIT = 5;
    const expanded = supplierShowAll || !!q;
    const list = expanded ? filtered : filtered.slice(0, LIMIT);
    const isOwner = (typeof currentRole==='function') ? currentRole()==='owner' : true;   // বাকি/পরিশোধ শুধু মালিক-মোডে
    const totalDue = isOwner ? suppliers.reduce((a,s)=>a+Math.max(0,supplierDue(s.id)),0) : 0;
    const totalHtml = (isOwner && suppliers.length) ? (totalDue>0
      ? `<div class="row-item" style="font-weight:700;cursor:pointer;" onclick="showSupplierDueList()"><div>সব সাপ্লায়ারের কাছে মোট বাকি <span style="font-weight:400;font-size:12.5px;opacity:.75;">(চাপুন — কার কাছে কত দেখুন)</span></div><div style="color:#b42318;white-space:nowrap;">${fmt(totalDue)} ▸</div></div>`
      : `<div class="row-item" style="font-weight:700;cursor:pointer;" onclick="showSupplierDueList()"><div>সব সাপ্লায়ারের কাছে মোট বাকি <span style="font-weight:400;font-size:12.5px;opacity:.75;">(চাপুন)</span></div><div style="color:#067647;white-space:nowrap;">৳০ — বাকি নেই ✓ ▸</div></div>`) : '';
    const rowsHtml = list.length ? list.map(s=>{
      if(!isOwner) return `<div class="row-item" style="flex-wrap:wrap;">${_supHeadHtml(s)}<div><button class="btn btn-sm btn-outline" onclick="openSupplierModal('${s.id}')">✏️ সম্পাদনা</button></div></div>`;
      const due = supplierDue(s.id);
      const hasEv = supplierEvents(s.id).length>0;
      const badge = due>0 ? `<span class="badge badge-red">বাকি ${fmt(due)}</span>` : (due<0 ? `<span class="badge badge-green">অগ্রিম ${fmt(-due)}</span>` : (hasEv?'<span class="badge badge-green">বাকি নেই</span>':''));
      return `
      <div class="row-item" style="flex-wrap:wrap;">
        ${_supHeadHtml(s)}
        <div>${badge}</div>
        <div style="width:100%;display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
          <button class="btn btn-sm btn-outline" onclick="supplierMoneyDialog('${s.id}','pay')">💸 টাকা পরিশোধ</button>
          <button class="btn btn-sm btn-outline" onclick="supplierMoneyDialog('${s.id}','adjust')">➕ বাকি যোগ</button>
          <button class="btn btn-sm btn-outline" onclick="showSupplierLedger('${s.id}')">📒 ইতিহাস</button>
          <button class="btn btn-sm btn-outline" onclick="openSupplierModal('${s.id}')">✏️ সম্পাদনা</button>
        </div>
      </div>`; }).join('') : `<div class="empty-state">${suppliers.length?'কোনো মিল পাওয়া যায়নি':'কোনো সাপ্লায়ার নেই'}</div>`;
    let toggleHtml = '';
    if(!q && filtered.length > LIMIT){
      toggleHtml = expanded
        ? `<div class="row-item" style="justify-content:center;cursor:pointer;color:var(--primary-dark);font-weight:700;" onclick="supplierShowAll=false;renderSuppliers();">▲ সংক্ষেপে দেখান</div>`
        : `<div class="row-item" style="justify-content:center;cursor:pointer;color:var(--primary-dark);font-weight:700;" onclick="supplierShowAll=true;renderSuppliers();">আরও ${filtered.length-LIMIT}টা দেখুন ▼</div>`;
    }
    el.innerHTML = totalHtml + rowsHtml + toggleHtml;
  }catch(e){
    console.error('renderSuppliers crashed', e);
    el.innerHTML = `<div class="empty-state">⚠️ সাপ্লায়ার তালিকা দেখাতে সমস্যা হয়েছে (তথ্য মুছে যায়নি) — অ্যাপ রিলোড করুন।</div>`;
  }
}

