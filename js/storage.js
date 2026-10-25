// Todo — storage (loaded before js/app.js): IndexedDB with an in-memory copy, localStorage for small settings.
  // ---------- Storage ----------
  // The data (tasks, CRM, notes, sync reference copies, Portefeuille) lives in IndexedDB: no 5 MB ceiling, and that
  // ceiling is shared with every other page of tomsremy.github.io. Reads come from an in-memory copy filled at start-up.
  // Small settings stay in localStorage. Data written by an older page straight into localStorage (todo_* keys) is taken
  // in, merged item by item (latest updatedAt wins), then removed from localStorage once safely written here.
  // No IndexedDB (rare private modes): everything stays in localStorage as before.
  if(!window.storage) (function(){
    const DB_KEYS=new Set(['todo-widget-tasks','todo-widget-companies','todo-widget-contacts','todo-widget-meetings','todo-widget-opportunities',
      'todo-widget-notes','todo-widget-clients','todo-widget-projects','todo-widget-company-types','sync-tasks-base','sync-crm-base','sync-notes-base',
      'sync-conflicts','parc-data','inbox-seen-ids','contact-inbox-seen-ids']);
    const ENTITY_KEYS=new Set(['todo-widget-tasks','todo-widget-companies','todo-widget-contacts','todo-widget-meetings','todo-widget-opportunities','todo-widget-notes','sync-conflicts']);
    const SET_KEYS=new Set(['todo-widget-clients','todo-widget-projects','todo-widget-company-types','inbox-seen-ids','contact-inbox-seen-ids']);
    const cache=new Map();
    let db=null, mode='ls';
    const fail=err=>{ try{ window.dispatchEvent(new CustomEvent('todo-storage-error', { detail:{ name:err&&err.name||'Error', message:String(err&&err.message||err) } })); }catch(e){} };
    const lsGet=k=>{ try{ return localStorage.getItem('todo_'+k); }catch(e){ return null; } };
    const lsSet=(k,v)=>{ try{ localStorage.setItem('todo_'+k,v); return true; }catch(e){ fail(e); return false; } };
    const lsDel=k=>{ try{ localStorage.removeItem('todo_'+k); }catch(e){} };
    // two copies of one key: entities merged by id (latest updatedAt wins), lists of names united, anything else: ours
    function mergeValues(k, ours, theirs){
      if(ours==null) return theirs;
      if(theirs==null || theirs===ours) return ours;
      try{
        const a=JSON.parse(ours), b=JSON.parse(theirs);
        if(ENTITY_KEYS.has(k) && Array.isArray(a) && Array.isArray(b)){
          const by=new Map(a.map(x=>[x&&x.id,x]));
          b.forEach(x=>{ if(!x || x.id==null) return; const y=by.get(x.id); if(!y || (x.updatedAt||0)>(y.updatedAt||0)) by.set(x.id,x); });
          return JSON.stringify([...by.values()]);
        }
        if(SET_KEYS.has(k) && Array.isArray(a) && Array.isArray(b)) return JSON.stringify([...new Set([...a,...b])]);
      }catch(e){}
      return ours;
    }
    const idbReq=r=>new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
    function putAll(entries){
      return new Promise((res,rej)=>{
        const tx=db.transaction('kv','readwrite'), st=tx.objectStore('kv');
        entries.forEach(([k,v])=>{ if(v==null) st.delete(k); else st.put(v,k); });
        tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); tx.onabort=()=>rej(tx.error||new Error('abort'));
      });
    }
    // take in what an older page left in localStorage (at start-up, and live when another tab of an old page writes)
    async function absorbLocal(keys){
      const changed=[];
      keys.forEach(k=>{ const v=lsGet(k); if(v==null) return; const m=mergeValues(k, cache.has(k)?cache.get(k):null, v); if(m!==cache.get(k)){ cache.set(k,m); changed.push([k,m]); } else changed.push([k,null,'same']); });
      if(!changed.length) return [];
      await putAll(changed.filter(c=>!c[2]).map(c=>[c[0],c[1]]));
      changed.forEach(c=>lsDel(c[0]));   // safely written: the old copy goes
      return changed.filter(c=>!c[2]);
    }
    const chan=('BroadcastChannel' in window)?new BroadcastChannel('todo-store'):null;
    const notify=(k,v)=>{ try{ window.dispatchEvent(new StorageEvent('storage',{ key:'todo_'+k, newValue:v })); }catch(e){} };
    let isReady=false;
    const ready=(async()=>{
      try{
        if(!('indexedDB' in window)) return;
        const open=indexedDB.open('todo',1);
        open.onupgradeneeded=()=>open.result.createObjectStore('kv');
        db=await idbReq(open);
        const tx=db.transaction('kv','readonly'), st=tx.objectStore('kv');
        const [keys,vals]=await Promise.all([idbReq(st.getAllKeys()), idbReq(st.getAll())]);
        keys.forEach((k,i)=>cache.set(k,vals[i]));
        mode='idb';
        await absorbLocal([...DB_KEYS]);
        try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}   // ask the browser not to evict it
      }catch(e){ console.error('IndexedDB unavailable, staying on localStorage', e); db=null; mode='ls'; }
      finally{ isReady=true; }
    })();
    // once ready, the in-memory copy changes at once (same moment as the old synchronous localStorage write)
    const whenReady=fn=>isReady?fn():ready.then(fn);
    if(chan) chan.onmessage=e=>{ const {k,v}=e.data||{}; if(!DB_KEYS.has(k)) return; if(v==null) cache.delete(k); else cache.set(k,v); notify(k,v); };
    // an older page (or the share page) wrote a data key into localStorage while this tab is open: merge it in now
    window.addEventListener('storage', e=>{
      if(mode!=='idb' || e.storageArea!==localStorage || !e.key || e.key.indexOf('todo_')!==0) return;
      const k=e.key.slice(5); if(!DB_KEYS.has(k) || e.newValue==null) return;
      absorbLocal([k]).then(ch=>ch.forEach(([kk,v])=>{ if(chan) chan.postMessage({ k:kk, v }); notify(kk,v); })).catch(fail);
    });
    const inDb=k=>mode==='idb' && DB_KEYS.has(k);
    async function doSet(key,value){
      if(!inDb(key)) return lsSet(key,value)?{ key, value, shared:false }:null;
      cache.set(key,value);
      try{ await putAll([[key,value]]); }catch(e){ fail(e); return null; }
      if(chan) chan.postMessage({ k:key, v:value });
      return { key, value, shared:false };
    }
    async function doDelete(key){
      if(!inDb(key)){ lsDel(key); return { key, deleted:true, shared:false }; }
      cache.delete(key);
      try{ await putAll([[key,null]]); }catch(e){ fail(e); return null; }
      if(chan) chan.postMessage({ k:key, v:null });
      return { key, deleted:true, shared:false };
    }
    window.storage={
      ready,
      get mode(){ return mode; },
      isManaged:k=>inDb(k),
      async get(key){ await ready; const v=inDb(key)?(cache.has(key)?cache.get(key):null):lsGet(key); return v!=null?{ key, value:v, shared:false }:null; },
      // value now in memory (for code that cannot wait); null if unknown
      peek(key){ return inDb(key)?(cache.has(key)?cache.get(key):null):lsGet(key); },
      set(key,value){ return whenReady(()=>doSet(key,value)); },
      delete(key){ return whenReady(()=>doDelete(key)); },
      async list(prefix){ await ready; prefix=prefix||''; const keys=new Set([...cache.keys()].filter(k=>k.startsWith(prefix))); try{ Object.keys(localStorage).filter(k=>k.startsWith('todo_'+prefix)).forEach(k=>keys.add(k.slice(5))); }catch(e){} return { keys:[...keys], shared:false }; },
      // what the data takes on this device, for the gauge in Réglages
      async usage(){
        await ready;
        let data=0; const parts={};
        const add=(k,v)=>{ const n=(k.length+(v?v.length:0))*2; data+=n; parts[k]=(parts[k]||0)+n; };
        cache.forEach((v,k)=>add(k,v));
        let ls=0, lsTodo=0; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i), n=(k.length+(localStorage.getItem(k)||'').length)*2; ls+=n; if(k.indexOf('todo_')===0){ lsTodo+=n; if(mode!=='idb') add(k.slice(5), localStorage.getItem(k)); } } }catch(e){}
        let est=null; try{ if(navigator.storage && navigator.storage.estimate) est=await navigator.storage.estimate(); }catch(e){}
        return { mode, data, parts, ls, lsTodo, lsLimit:5*1024*1024*2, usage:est&&est.usage, quota:est&&est.quota };
      }
    };
  })();
