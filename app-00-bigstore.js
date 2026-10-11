// বড় সংরক্ষণ (app-00): বিক্রি ও ক্রয় ফোনের IndexedDB-তে রাখে।
// কারণ: localStorage-এ মাত্র ~৫ MB জায়গা — দিনে ৩০-১০০টা বিক্রি হলে কয়েক মাসেই ভরে যেত।
// IndexedDB-তে জায়গা অনেক বেশি (শত শত MB), আর প্রতিবার শুধু বদলানো রেকর্ডটাই লেখা হয়।
//
// নিরাপত্তার নিয়ম:
//  • পুরোনো localStorage-এর কপি কখনো মোছা হয় না (ফেরার পথ হিসেবে থেকে যায়)।
//  • IndexedDB-তে কপি করে গুনে মিলিয়ে দেখার পরেই নতুন ব্যবস্থা চালু হয়।
//  • কোনো ধাপে ভুল হলে (বা IndexedDB না চললে) অ্যাপ আগের মতোই localStorage দিয়ে চলে।
//  • "ssn_big_migrated_v1" পতাকা বসায় app-01-data.js — নতুন কোড সত্যিই ডেটা নেওয়ার পরে।
//    তাই index.html নতুন কিন্তু app-01 পুরোনো থাকলে পুরোনো ডেটা কখনো নতুন ধরে নেওয়া হবে না।
(function(){
  'use strict';
  var KEYS = ['ssn_sales', 'ssn_purchases'];
  var DB_NAME = 'ssn_bigstore';
  var B = window.__big = {
    ok: false,            // true হলে বিক্রি/ক্রয় IndexedDB দিয়ে চলছে
    keys: KEYS,
    arr: {},              // শুরুতে লোড হওয়া রেকর্ড (app-01 একবার নিয়ে নেয়)
    shadow: {},           // key -> Map(id -> JSON string) : সর্বশেষ লেখা অবস্থা
    bytes: {},            // key -> মোট অক্ষর (জায়গার হিসাবের জন্য)
    consumed: {},
    err: null,
    failed: false,
    pending: 0,
    migratedNow: false,
    onFail: null
  };
  B.isBig = function(key){ return B.ok && KEYS.indexOf(key) >= 0; };

  var db = null;
  var queue = Promise.resolve();

  function req(r){ return new Promise(function(res, rej){ r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); }; }); }
  function txDone(tx){ return new Promise(function(res, rej){ tx.oncomplete = function(){ res(); }; tx.onerror = function(){ rej(tx.error); }; tx.onabort = function(){ rej(tx.error || new Error('abort')); }; }); }
  function openDb(){
    return new Promise(function(res, rej){
      var r;
      try{ r = indexedDB.open(DB_NAME, 1); }catch(e){ rej(e); return; }
      r.onupgradeneeded = function(){ var d = r.result; KEYS.concat(['meta']).forEach(function(k){ if(!d.objectStoreNames.contains(k)) d.createObjectStore(k); }); };
      r.onsuccess = function(){ res(r.result); };
      r.onerror = function(){ rej(r.error); };
      r.onblocked = function(){ rej(new Error('IndexedDB blocked')); };
    });
  }

  // ছোট ছোট ব্যাচে লেখা — একসাথে লাখ রেকর্ড এক লেনদেনে না ঢুকিয়ে
  async function putAll(key, records){
    var CH = 2000;
    for(var i = 0; i < records.length; i += CH){
      var tx = db.transaction([key], 'readwrite'), st = tx.objectStore(key);
      for(var j = i; j < Math.min(i + CH, records.length); j++){ st.put(JSON.stringify(records[j]), records[j].id); }
      await txDone(tx);
    }
  }

  B.ready = (async function(){
    try{
      if(typeof indexedDB === 'undefined' || !indexedDB) return;
      db = await openDb();
      var migrated = localStorage.getItem('ssn_big_migrated_v1') === '1';
      if(!migrated){ try{ migrated = (await req(db.transaction(['meta'], 'readonly').objectStore('meta').get('migrated'))) === '1'; }catch(e){} }   // localStorage ভরা থাকলে পতাকা সেখানে বসে না — তাই IndexedDB-তেও রাখা হয়
      var staged = {};
      for(var ki = 0; ki < KEYS.length; ki++){
        var key = KEYS[ki];
        var vals = await req(db.transaction([key], 'readonly').objectStore(key).getAll());
        var recs;
        if(migrated){
          // IndexedDB-ই আসল উৎস
          recs = [];
          for(var v = 0; v < vals.length; v++){ try{ recs.push([JSON.parse(vals[v]), vals[v]]); }catch(e){ console.error('bigstore: নষ্ট রেকর্ড বাদ', e); } }
        } else {
          // প্রথমবার (বা আগের চেষ্টা অসম্পূর্ণ): পুরোনো localStorage-ই আসল। IndexedDB-র আধা-কপি মুছে নতুন করে কপি।
          if(vals.length){
            var tc = db.transaction([key], 'readwrite'); tc.objectStore(key).clear(); await txDone(tc);
          }
          var legacy = localStorage.getItem(key), arr = [];
          if(legacy){ arr = JSON.parse(legacy) || []; }          // ভুল হলে নিচের catch-এ পুরোনো পথে ফিরবে
          var good = arr.filter(function(r){ return r && r.id; });
          if(good.length !== arr.length) throw new Error('id ছাড়া রেকর্ড আছে — স্থানান্তর বাতিল');
          await putAll(key, good);
          var cnt = await req(db.transaction([key], 'readonly').objectStore(key).count());
          if(cnt !== new Set(good.map(function(r){ return r.id; })).size) throw new Error('গুনতিতে মিলছে না — স্থানান্তর বাতিল');
          recs = good.map(function(r){ return [r, JSON.stringify(r)]; });
          B.migratedNow = true;
        }
        staged[key] = recs;
      }
      KEYS.forEach(function(key){
        var recs = staged[key];
        recs.sort(function(a, b){ return ((a[0].ts || 0) - (b[0].ts || 0)); });
        var sh = new Map(), arr = [], total = 0;
        recs.forEach(function(p){ if(p[0] && p[0].id){ arr.push(p[0]); sh.set(p[0].id, p[1]); total += p[1].length; } });
        B.arr[key] = arr; B.shadow[key] = sh; B.bytes[key] = total;
      });
      B.ok = true;
    }catch(e){
      B.ok = false; B.err = e;
      console.error('bigstore: IndexedDB ব্যবস্থা চালু হয়নি — আগের মতো localStorage দিয়ে চলবে', e);
    }
  })();

  // নতুন ব্যবস্থা সত্যিই চালু হয়েছে — এখন থেকে IndexedDB-ই আসল উৎস
  B.setMigrated = function(){
    try{ localStorage.setItem('ssn_big_migrated_v1', '1'); }catch(e){}
    if(!B.ok) return;
    queue = queue.then(async function(){ var tx = db.transaction(['meta'], 'readwrite'); tx.objectStore('meta').put('1', 'migrated'); await txDone(tx); }).catch(function(e){ console.error('bigstore meta', e); });
  };

  // লেখার সারি: একটার পর একটা, সবসময় শেষ অবস্থাই পৌঁছায়
  B.write = function(key, puts, dels){
    if(!B.ok || (!puts.length && !dels.length)) return;
    B.pending++;
    queue = queue.then(async function(){
      var CH = 2000;
      for(var i = 0; i < puts.length; i += CH){
        var tx = db.transaction([key], 'readwrite'), st = tx.objectStore(key);
        for(var j = i; j < Math.min(i + CH, puts.length); j++) st.put(puts[j][1], puts[j][0]);
        await txDone(tx);
      }
      for(var k = 0; k < dels.length; k += CH){
        var tx2 = db.transaction([key], 'readwrite'), st2 = tx2.objectStore(key);
        for(var m = k; m < Math.min(k + CH, dels.length); m++) st2.delete(dels[m]);
        await txDone(tx2);
      }
    }).catch(function(e){
      B.failed = true; B.err = e;
      console.error('bigstore: লেখা ব্যর্থ', e);
      try{ if(B.onFail) B.onFail(e); }catch(_){}
    }).then(function(){ B.pending--; });
  };
})();
