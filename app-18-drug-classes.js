// ওষুধের গ্রুপ (মেডেক্সের "Drug Class"-এর মতো) — জেনেরিক নাম থেকে গ্রুপ বের করার তালিকা।
// প্রতিটা গ্রুপের পাশে তার জেনেরিকগুলো '|' দিয়ে আলাদা। অ্যাপে "🗂 গ্রুপ বসান (যাচাই করে)" বোতাম এটা পড়ে।
// মিল নিশ্চিত হলে "S", আন্দাজ হলে "G" — আন্দাজগুলো পর্দায় টিক ছাড়া থাকে, যাচাই করে টিক দিতে হয়।
const DRUG_CLASS_DEF = {
  'Penicillin Preparations': 'amoxicillin|ampicillin|cloxacillin|flucloxacillin|dicloxacillin|clavulanic acid|clavulanate|sulbactam|tazobactam|piperacillin|penicillin|benzathine penicillin|phenoxymethylpenicillin|pivmecillinam',
  'Cephalosporin Preparations': 'cefixime|cefuroxime|cefpodoxime|cefradine|cephradine|cefaclor|cefadroxil|cephalexin|cefalexin|ceftriaxone|cefotaxime|ceftazidime|cefepime|cefditoren|cefprozil|cefoperazone|cefazolin|cefdinir|ceftibuten',
  'Macrolide Antibiotics': 'azithromycin|clarithromycin|erythromycin|roxithromycin',
  'Quinolone Antibiotics': 'ciprofloxacin|levofloxacin|moxifloxacin|ofloxacin|norfloxacin|gatifloxacin|gemifloxacin|sparfloxacin|nalidixic acid|prulifloxacin',
  'Tetracycline Antibiotics': 'doxycycline|tetracycline|minocycline|tigecycline|lymecycline|oxytetracycline',
  'Aminoglycoside Antibiotics': 'gentamicin|amikacin|tobramycin|neomycin|streptomycin|kanamycin|netilmicin',
  'Lincosamide Antibiotics': 'clindamycin|lincomycin',
  'Nitroimidazole Antimicrobials': 'metronidazole|secnidazole|tinidazole|ornidazole',
  'Sulfonamide & Trimethoprim': 'co-trimoxazole|cotrimoxazole|sulfamethoxazole|trimethoprim',
  'Other Antibiotics': 'rifaximin|nitrofurantoin|linezolid|vancomycin|colistin|colistimethate|fosfomycin|chloramphenicol|teicoplanin|meropenem|imipenem|ertapenem|aztreonam|cefoperazone sulbactam',
  'Antitubercular Drugs': 'isoniazid|rifampicin|rifampin|ethambutol|pyrazinamide',
  'Topical Antibacterials & Burn Care': 'silver sulfadiazine|mupirocin|fusidic acid|framycetin|bacitracin|nadifloxacin|retapamulin',
  'Antifungal Preparations': 'fluconazole|itraconazole|terbinafine|voriconazole|clotrimazole|ketoconazole|miconazole|griseofulvin|nystatin|amphotericin b|luliconazole|econazole|sertaconazole|posaconazole|ciclopirox|butenafine|amorolfine',
  'Antiviral Preparations': 'acyclovir|aciclovir|valacyclovir|valaciclovir|famciclovir|oseltamivir|favipiravir|tenofovir|entecavir|sofosbuvir|remdesivir|molnupiravir|lamivudine|ribavirin|daclatasvir',
  'Anthelmintic Preparations': 'albendazole|mebendazole|ivermectin|pyrantel|praziquantel|levamisole|diethylcarbamazine|niclosamide',
  'Antimalarial & Antiprotozoal': 'artemether|lumefantrine|chloroquine|hydroxychloroquine|primaquine|quinine|artesunate|nitazoxanide|diloxanide|mefloquine|dihydroartemisinin|piperaquine|sulfadoxine|pyrimethamine',
  'Proton Pump Inhibitors (PPI)': 'omeprazole|esomeprazole|pantoprazole|rabeprazole|lansoprazole|dexlansoprazole|ilaprazole',
  'Potassium-Competitive Acid Blockers': 'vonoprazan|tegoprazan|fexuprazan',
  'H2 Receptor Antagonists': 'famotidine|ranitidine|cimetidine|nizatidine',
  'Antacids & Antiflatulents': 'aluminium hydroxide|aluminum hydroxide|magnesium hydroxide|magnesium trisilicate|sodium alginate|alginic acid|simethicone|dimethicone|sucralfate|sodium bicarbonate|bismuth|activated charcoal|oxethazaine',
  'Antiemetics & Prokinetics': 'ondansetron|palonosetron|granisetron|metoclopramide|domperidone|prochlorperazine|itopride|mosapride|levosulpiride|trimethobenzamide|doxylamine',
  'Antispasmodics': 'mebeverine|hyoscine|hyoscine butylbromide|drotaverine|otilonium|dicyclomine|dicycloverine|pinaverium|trimebutine|tiemonium|alverine|camylofin',
  'Laxatives': 'bisacodyl|lactulose|picosulfate|sodium picosulfate|glycerin|glycerol|isphaghula|ispaghula|psyllium|macrogol|polyethylene glycol|senna|docusate|liquid paraffin|lactitol|sodium phosphate',
  'Antidiarrheals & Oral Rehydration': 'loperamide|racecadotril|oral rehydration salt|oral rehydration salts|ors|diosmectite|kaolin|nifuroxazide',
  'Probiotics': 'lactobacillus|saccharomyces boulardii|bacillus clausii|bifidobacterium|bacillus coagulans|lactic acid bacillus',
  'Hepatobiliary Agents': 'ursodeoxycholic acid|ursodiol|silymarin|l-ornithine l-aspartate|ornithine aspartate|obeticholic acid',
  'Analgesics & Antipyretics': 'paracetamol|acetaminophen|tramadol|tapentadol|nefopam|codeine|nalbuphine|caffeine|orphenadrine',
  'NSAIDs': 'diclofenac|ibuprofen|naproxen|ketorolac|etoricoxib|celecoxib|aceclofenac|nabumetone|indomethacin|piroxicam|meloxicam|mefenamic acid|flurbiprofen|ketoprofen|dexketoprofen|lornoxicam|parecoxib|etodolac|diacerein|glucosamine|tenoxicam|nimesulide',
  'Antihistamines': 'cetirizine|levocetirizine|fexofenadine|bilastine|desloratadine|ebastine|loratadine|rupatadine|chlorpheniramine|ketotifen|promethazine|cyproheptadine|hydroxyzine|diphenhydramine|pheniramine|azelastine|triprolidine|clemastine',
  'Bronchodilators & Antiasthmatics': 'salbutamol|albuterol|levosalbutamol|levalbuterol|terbutaline|formoterol|salmeterol|ipratropium|tiotropium|glycopyrronium|doxofylline|theophylline|aminophylline|bambuterol|indacaterol|umeclidinium',
  'Leukotriene Receptor Antagonists': 'montelukast|zafirlukast',
  'Cough, Cold & Mucolytics': 'ambroxol|bromhexine|acetylcysteine|carbocisteine|carbocysteine|guaifenesin|dextromethorphan|levodropropizine|butamirate|menthol|eucalyptus|noscapine|erdosteine',
  'Nasal Decongestants': 'oxymetazoline|xylometazoline|pseudoephedrine|phenylephrine|naphazoline|tramazoline',
  'Corticosteroids': 'prednisolone|prednisone|methylprednisolone|dexamethasone|hydrocortisone|betamethasone|budesonide|mometasone|fluticasone|clobetasol|triamcinolone|deflazacort|beclomethasone|beclometasone|fluocinolone|desonide|halobetasol|fluorometholone|clobetasone',
  'Antidiabetic Drugs': 'metformin|glimepiride|gliclazide|glibenclamide|glyburide|glipizide|pioglitazone|sitagliptin|linagliptin|vildagliptin|saxagliptin|empagliflozin|dapagliflozin|canagliflozin|acarbose|insulin|liraglutide|semaglutide|repaglinide|voglibose|teneligliptin|gemigliptin|evogliptin',
  'Angiotensin II Receptor Blockers (ARBs)': 'losartan|telmisartan|olmesartan|valsartan|candesartan|irbesartan|azilsartan|sacubitril',
  'ACE Inhibitors': 'enalapril|ramipril|lisinopril|captopril|perindopril|benazepril|fosinopril|quinapril|imidapril',
  'Calcium Channel Blockers': 'amlodipine|nifedipine|diltiazem|verapamil|felodipine|lercanidipine|cilnidipine|nimodipine|benidipine|azelnidipine',
  'Beta Blockers': 'atenolol|bisoprolol|propranolol|metoprolol|carvedilol|nebivolol|labetalol|sotalol|esmolol',
  'Diuretics': 'furosemide|frusemide|hydrochlorothiazide|spironolactone|torsemide|torasemide|indapamide|chlorthalidone|amiloride|acetazolamide|eplerenone|bumetanide|metolazone',
  'Lipid-Lowering Agents': 'rosuvastatin|atorvastatin|simvastatin|pravastatin|pitavastatin|lovastatin|fenofibrate|gemfibrozil|ezetimibe|omega-3 fatty acids|omega 3 fatty acids|omega-3|omega 3|colesevelam',
  'Antiplatelets & Anticoagulants': 'aspirin|clopidogrel|ticagrelor|prasugrel|warfarin|rivaroxaban|apixaban|dabigatran|enoxaparin|heparin|cilostazol|dipyridamole|pentoxifylline|edoxaban',
  'Nitrates & Anti-anginals': 'isosorbide mononitrate|isosorbide dinitrate|isosorbide|nicorandil|trimetazidine|ranolazine|glyceryl trinitrate|nitroglycerin|ivabradine',
  'Cardiac Drugs': 'digoxin|amiodarone|dronedarone|flecainide|propafenone|mexiletine',
  'Other Antihypertensives': 'methyldopa|clonidine|hydralazine|prazosin|doxazosin|minoxidil|moxonidine|terazosin',
  'Antidepressants': 'escitalopram|citalopram|sertraline|fluoxetine|paroxetine|fluvoxamine|amitriptyline|nortriptyline|imipramine|mirtazapine|duloxetine|venlafaxine|desvenlafaxine|bupropion|trazodone|vortioxetine|clomipramine|dosulepin|dothiepin|agomelatine',
  'Anxiolytics, Sedatives & Hypnotics': 'clonazepam|alprazolam|diazepam|lorazepam|bromazepam|zolpidem|zopiclone|eszopiclone|buspirone|melatonin|midazolam|nitrazepam|chlordiazepoxide|clobazam',
  'Antipsychotics': 'olanzapine|quetiapine|risperidone|aripiprazole|haloperidol|amisulpride|clozapine|chlorpromazine|flupentixol|sulpiride|trifluoperazine|lurasidone|paliperidone|ziprasidone|lithium',
  'Anticonvulsants': 'carbamazepine|oxcarbazepine|valproic acid|valproate|sodium valproate|levetiracetam|phenytoin|lamotrigine|topiramate|phenobarbitone|phenobarbital|lacosamide|zonisamide|brivaracetam',
  'Neuropathic Pain Agents': 'pregabalin|gabapentin|mirogabalin',
  'Muscle Relaxants': 'tizanidine|thiocolchicoside|eperisone|baclofen|methocarbamol|cyclobenzaprine|chlorzoxazone|tolperisone',
  'Anti-Vertigo & Migraine Agents': 'betahistine|cinnarizine|flunarizine|sumatriptan|rizatriptan|naratriptan|zolmitriptan|eletriptan|ergotamine|dimenhydrinate|piracetam',
  'Anti-Parkinson & Dementia Drugs': 'donepezil|memantine|levodopa|carbidopa|pramipexole|ropinirole|trihexyphenidyl|rivastigmine|rasagiline|selegiline|amantadine',
  'Vitamins': 'ascorbic acid|vitamin c|cholecalciferol|vitamin d3|vitamin d|ergocalciferol|tocopherol|vitamin e|thiamine|pyridoxine|cyanocobalamin|methylcobalamin|mecobalamin|folic acid|folate|riboflavin|nicotinamide|niacinamide|niacin|biotin|multivitamin|vitamin b complex|vitamin b-complex|vitamin a|retinol|calcitriol|alfacalcidol|vitamin b1|vitamin b6|vitamin b12|vitamin b2|benfotiamine|l-methylfolate|lutein|l-carnitine|coenzyme q10|ubidecarenone|alpha lipoic acid|pantothenic acid|dexpanthenol',
  'Minerals & Calcium Supplements': 'calcium carbonate|calcium citrate|calcium gluconate|calcium lactate|calcium phosphate|zinc|zinc sulfate|zinc acetate|zinc gluconate|magnesium oxide|magnesium|selenium|calcium|chromium|copper|iodine supplement',
  'Hematinics (Iron)': 'iron sucrose|ferrous fumarate|ferrous sulfate|ferrous ascorbate|ferric carboxymaltose|iron polymaltose|ferrous gluconate|ferric ammonium citrate|iron|lactoferrin|ferrous bisglycinate|ferric derisomaltose|ferrous',
  'Hemostatics': 'tranexamic acid|etamsylate|phytomenadione|vitamin k|vitamin k1|carbazochrome|aminocaproic acid',
  'Thyroid Agents': 'levothyroxine|thyroxine|carbimazole|methimazole|propylthiouracil|liothyronine',
  'Hormones & Endocrine Agents': 'nandrolone|cabergoline|bromocriptine|desmopressin|testosterone|oxandrolone|somatropin|octreotide|growth hormone',
  'Contraceptives & Female Hormones': 'levonorgestrel|norethisterone|norethindrone|ethinylestradiol|ethinyl estradiol|desogestrel|drospirenone|progesterone|dydrogesterone|estradiol|medroxyprogesterone|clomiphene|ulipristal|cyproterone|gestodene|etonogestrel',
  'Obstetric Agents': 'misoprostol|oxytocin|methylergometrine|methylergonovine|carboprost|dinoprostone|ritodrine|isoxsuprine',
  'Urological Agents': 'tamsulosin|alfuzosin|silodosin|finasteride|dutasteride|tolterodine|solifenacin|oxybutynin|mirabegron|sildenafil|tadalafil|vardenafil|flavoxate|potassium citrate|dapoxetine|trospium|fesoterodine',
  'Antigout Agents': 'allopurinol|febuxostat|colchicine|probenecid',
  'Bone Health Drugs': 'alendronate|risedronate|ibandronate|zoledronic acid|raloxifene|calcitonin|strontium|denosumab|bazedoxifene',
  'Antiseptics & Disinfectants': 'povidone iodine|povidone-iodine|chlorhexidine|hydrogen peroxide|cetrimide|benzalkonium|alcohol|ethyl alcohol|isopropyl alcohol|sodium hypochlorite|triclosan|gentian violet|potassium permanganate|iodine|methylated spirit|chloroxylenol|octenidine',
  'Vaccines & Immunoglobulins': 'rabies vaccine|tetanus toxoid|hepatitis b vaccine|anti-tetanus serum|tetanus immunoglobulin|immunoglobulin|anti rabies serum|human rabies immunoglobulin|vaccine|toxoid',
  'Ophthalmic Preparations': 'timolol|latanoprost|carboxymethylcellulose|hypromellose|olopatadine|brimonidine|dorzolamide|tropicamide|cyclopentolate|artificial tears|sodium hyaluronate|bimatoprost|travoprost|ketotifen eye|polyvinyl alcohol|lubricant eye drops',
  'Dermatological Agents': 'isotretinoin|tretinoin|adapalene|benzoyl peroxide|permethrin|calamine|salicylic acid|urea|azelaic acid|hydroquinone|zinc oxide|coal tar|sulfur|benzyl benzoate|crotamiton|lindane|tazarotene|clindamycin phosphate gel|kojic acid|tranexamic acid cream',
  'IV Fluids & Electrolytes': 'sodium chloride|dextrose|ringer lactate|ringer|normal saline|water for injection|potassium chloride|glucose|mannitol|sodium lactate',
  'Anticancer & Immunosuppressants': 'methotrexate|tamoxifen|letrozole|anastrozole|capecitabine|imatinib|cyclophosphamide|hydroxyurea|azathioprine|mycophenolate|cyclosporine|tacrolimus|bicalutamide|exemestane|erlotinib|gefitinib|leflunomide|sulfasalazine|mesalamine|mesalazine',
  'Local Anesthetics': 'lidocaine|lignocaine|bupivacaine|ropivacaine|prilocaine|articaine|benzocaine'
};
// ধরনের ছাঁট: এই শব্দগুলো (লবণের অংশ) বাদ দিলেও জেনেরিক একই — যেমন "Diclofenac Sodium" = "Diclofenac"
const _DC_SALT = /\b(hydrochloride|hcl|hydrobromide|sodium|potassium|sulfate|sulphate|tromethamine|medoxomil|maleate|besylate|besilate|mesylate|succinate|tartrate|fumarate|citrate|acetate|phosphate|trihydrate|dihydrate|monohydrate|anhydrous|axetil|proxetil|pivoxil|dipropionate|furoate|bromide|nitrate|mononitrate|oxalate|pamoate|disodium|usp|bp|ip|er|sr|xr|cr)\b/g;
const DRUG_CLASS_LIST = Object.keys(DRUG_CLASS_DEF).sort((a,b)=>a.localeCompare(b));
const _DC_MAP = (function(){
  const m = {};
  Object.keys(DRUG_CLASS_DEF).forEach(cls=>{ DRUG_CLASS_DEF[cls].split('|').forEach(g=>{ g = g.trim(); if(g && m[g]===undefined) m[g] = cls; }); });
  return m;
})();
// একাধিক উপাদানের মিশ্রণ যেখানে প্রথম উপাদান দিয়ে গ্রুপ ঠিক হয় না — স্পষ্ট করে বলা
const _DC_COMBO = {
  'hydrochlorothiazide+losartan': 'Angiotensin II Receptor Blockers (ARBs)',
  'hydrochlorothiazide+telmisartan': 'Angiotensin II Receptor Blockers (ARBs)',
  'hydrochlorothiazide+olmesartan': 'Angiotensin II Receptor Blockers (ARBs)',
  'hydrochlorothiazide+valsartan': 'Angiotensin II Receptor Blockers (ARBs)',
  'amlodipine+olmesartan': 'Angiotensin II Receptor Blockers (ARBs)',
  'amlodipine+telmisartan': 'Angiotensin II Receptor Blockers (ARBs)',
  'amlodipine+losartan': 'Angiotensin II Receptor Blockers (ARBs)',
  'amlodipine+valsartan': 'Angiotensin II Receptor Blockers (ARBs)',
  'amlodipine+bisoprolol': 'Beta Blockers',
  'amlodipine+atenolol': 'Beta Blockers',
  'caffeine+paracetamol': 'Analgesics & Antipyretics',
  'paracetamol+tramadol': 'Analgesics & Antipyretics',
  'codeine+paracetamol': 'Analgesics & Antipyretics',
  'esomeprazole+naproxen': 'NSAIDs',
  'diclofenac+paracetamol': 'NSAIDs',
  'aceclofenac+paracetamol': 'NSAIDs',
  'ibuprofen+paracetamol': 'NSAIDs',
  'omeprazole+sodium bicarbonate': 'Proton Pump Inhibitors (PPI)',
  'domperidone+pantoprazole': 'Proton Pump Inhibitors (PPI)',
  'domperidone+rabeprazole': 'Proton Pump Inhibitors (PPI)',
  'esomeprazole+itopride': 'Proton Pump Inhibitors (PPI)',
  'montelukast+levocetirizine': 'Leukotriene Receptor Antagonists',
  'ambroxol+salbutamol': 'Cough, Cold & Mucolytics',
  'dextromethorphan+pseudoephedrine': 'Cough, Cold & Mucolytics',
  'calcium+vitamin d3': 'Minerals & Calcium Supplements',
  'calcium carbonate+vitamin d3': 'Minerals & Calcium Supplements',
  'calcium+cholecalciferol': 'Minerals & Calcium Supplements',
  'folic acid+iron': 'Hematinics (Iron)',
  'ferrous fumarate+folic acid': 'Hematinics (Iron)',
  'cefixime+clavulanic acid': 'Cephalosporin Preparations',
  'cefuroxime+clavulanic acid': 'Cephalosporin Preparations',
  'ciprofloxacin+tinidazole': 'Quinolone Antibiotics',
  'metronidazole+norfloxacin': 'Quinolone Antibiotics',
  'azithromycin+secnidazole': 'Macrolide Antibiotics',
  'ofloxacin+ornidazole': 'Quinolone Antibiotics',
  'cefixime+ofloxacin': 'Cephalosporin Preparations',
  'clotrimazole+hydrocortisone': 'Antifungal Preparations',
  'betamethasone+clotrimazole': 'Corticosteroids',
  'clobetasol+salicylic acid': 'Corticosteroids',
  'fusidic acid+hydrocortisone': 'Topical Antibacterials & Burn Care',
  'glimepiride+metformin': 'Antidiabetic Drugs',
  'metformin+pioglitazone': 'Antidiabetic Drugs',
  'metformin+sitagliptin': 'Antidiabetic Drugs',
  'atorvastatin+ezetimibe': 'Lipid-Lowering Agents',
  'ezetimibe+rosuvastatin': 'Lipid-Lowering Agents',
  'aspirin+clopidogrel': 'Antiplatelets & Anticoagulants',
  'aspirin+atorvastatin': 'Antiplatelets & Anticoagulants'
};
function _dcClean(s){
  return String(s||'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9+&\/,\s.-]/g,' ').replace(/\s+/g,' ').trim();
}
function _dcStrip(s){ return s.replace(_DC_SALT,' ').replace(/[.]+/g,' ').replace(/\s+/g,' ').trim(); }
// একটা উপাদানের গ্রুপ: [গ্রুপ, নিশ্চিত?] বা null
function _dcOne(part){
  const full = part.replace(/\s+/g,' ').trim();
  if(!full) return null;
  if(_DC_MAP[full]) return [_DC_MAP[full], true];
  const st = _dcStrip(full);
  if(_DC_MAP[st]) return [_DC_MAP[st], true];
  // ডোজ/সংখ্যা বাদ ("Metformin 500") — ফোনে জেনেরিক ঘরে মাঝেমধ্যে ডোজও লেখা থাকে
  const nd = st.replace(/\b\d+(\.\d+)?\s*(mg|mcg|gm|g|ml|iu|%|mg\/ml)?\b/g,' ').replace(/\s+/g,' ').trim();
  if(nd && _DC_MAP[nd]) return [_DC_MAP[nd], true];
  // শব্দের শেষ/শুরুর মিল (আন্দাজ): cef..., ...cillin, ...floxacin, ...prazole ইত্যাদি
  const w = (nd||st).split(' ')[0] || '';
  if(/^(vitamin|multivit)/.test(w) || /vitamin/.test(st)) return ['Vitamins', false];
  if(/vaccine|toxoid|immunoglobulin/.test(st)) return ['Vaccines & Immunoglobulins', true];
  if(/^cef|^ceph/.test(w)) return ['Cephalosporin Preparations', false];
  if(/cillin$/.test(w)) return ['Penicillin Preparations', false];
  if(/floxacin$/.test(w)) return ['Quinolone Antibiotics', false];
  if(/prazole$/.test(w)) return ['Proton Pump Inhibitors (PPI)', false];
  if(/statin$/.test(w)) return ['Lipid-Lowering Agents', false];
  if(/sartan$/.test(w)) return ['Angiotensin II Receptor Blockers (ARBs)', false];
  if(/pril$/.test(w)) return ['ACE Inhibitors', false];
  if(/olol$/.test(w)) return ['Beta Blockers', false];
  if(/dipine$/.test(w)) return ['Calcium Channel Blockers', false];
  if(/conazole$/.test(w)) return ['Antifungal Preparations', false];
  if(/tidine$/.test(w)) return ['H2 Receptor Antagonists', false];
  if(/setron$/.test(w)) return ['Antiemetics & Prokinetics', false];
  if(/gliptin$|gliflozin$/.test(w)) return ['Antidiabetic Drugs', false];
  if(/coxib$/.test(w)) return ['NSAIDs', false];
  if(/triptan$/.test(w)) return ['Anti-Vertigo & Migraine Agents', false];
  if(/mycin$|micin$/.test(w)) return null;
  return null;
}
// generic লেখা → {cls, sure} বা null। sure=false মানে আন্দাজ (পর্দায় টিক ছাড়া)।
function suggestDrugClass(generic){
  const clean = _dcClean(generic);
  if(!clean) return null;
  const parts = clean.split(/\s*(?:\+|&|\/|,|\band\b)\s*/).map(s=>s.trim()).filter(Boolean);
  if(!parts.length) return null;
  if(parts.length===1){
    const r = _dcOne(parts[0]);
    return r ? { cls:r[0], sure:r[1] } : null;
  }
  const res = parts.map(_dcOne);
  const key = parts.map(p=>_dcStrip(p)).sort().join('+');
  if(_DC_COMBO[key]) return { cls:_DC_COMBO[key], sure:true };
  // একটা উপাদানও না চিনলে — কিছু বলা যায় না
  const known = res.filter(Boolean);
  if(!known.length) return null;
  const first = res[0] || known[0];
  const sameAll = res.every(r=>r && r[0]===first[0]);
  return { cls:first[0], sure: sameAll && known.every(r=>r[1]) };
}
