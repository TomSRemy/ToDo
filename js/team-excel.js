// Todo — the team's shared contacts in an Excel file on SharePoint, through the Excel bridge (v1.34) : the « Excel »
// team mode (the default ; the Supabase base stays asleep, js/team-ui.js). A row is found by first name + last name.
// Field by field, against what was last agreed with the file (c.xlc) : a colleague's change comes in, mine goes out,
// both changed differently → asked. Private (locked) contacts never go to the file. Loaded before js/app.js.
window.TodoTeamExcel=(function(){
  const api={};
  const COLS=[['Prénom','firstName'],['Nom','lastName'],['Société','company'],['Fonction','role'],['Email','email'],['Téléphone','phone1'],['Téléphone 2','phone2'],['Commentaire','comment'],['ID','id'],['Modifié le',null],['Modifié par',null]];
  const META=new Set(['ID','Modifié le','Modifié par']), BATCH=20, EVERY=5*60000;
  const fold=s=>String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const txt=v=>v==null ? '' : String(v).trim();
  const same=(a,b)=>txt(a)===txt(b);
  const mode=()=>{ try{ return localStorage.getItem('team-mode')||'excel'; }catch(e){ return 'excel'; } };
  api.mode=mode;
  api.init=function(app){
    const { $, bridgeCall, bridgeInfo, notify, askChoice, saveCrm, renderContacts, uid }=app;
    let busy=false, lastRun=0, lastReport='';
    const contacts=()=>app.contacts;
    const ready=()=>{ const i=bridgeInfo(); return mode()==='excel' && !!i && !!i.who && !!(i.contacts && i.contacts.found); };
    const shared=c=>c && !c.deleted && !c.private && txt(c.firstName) && txt(c.lastName);
    const nameKey=(f, l)=>fold(f)+'|'+fold(l);
    // shared, and changed here since the file was last agreed (or never sent)
    const needsSend=c=>shared(c) && (!c.xlc || !c.xlc.ID || COLS.some(([hd, f])=>f && f!=='id' && !same(c[f], c.xlc[hd])));
    // the file's rows as { values by header, row } ; the header row is the first one with « Prénom » and « Nom »
    function parse(sheet){
      const rows=sheet||[]; let h=-1;
      for(let i=0; i<rows.length && h<0; i++){ const f=(rows[i]||[]).map(fold); if(f.includes('prenom') && f.includes('nom')) h=i; }
      if(h<0) throw new Error('En-têtes « Prénom » et « Nom » introuvables dans l’onglet « Contacts ».');
      const head=rows[h].map(x=>txt(x)), at={}; head.forEach((x, i)=>{ at[fold(x)]=i; });
      const out=rows.slice(h+1).map(r=>{ const o={}; COLS.forEach(([hd])=>{ const i=at[fold(hd)]; o[hd]=i==null ? '' : txt(r[i]); }); return o; }).filter(o=>o['Prénom'] && o['Nom']);
      return { head, at, rows:out };
    }
    function valuesFor(c, at, width, who){
      const v=new Array(width).fill(null), today=new Date().toLocaleDateString('fr-FR');
      COLS.forEach(([hd, f])=>{ const i=at[fold(hd)]; if(i==null) return; v[i]=f ? (txt(c[f])||null) : hd==='Modifié le' ? today : who; });
      return v;
    }
    // one row of the file onto my contact : 'clash' items returned, the rest taken or kept
    function pullRow(c, r, clashes){
      const base=c.xlc||{}; let changed=false;
      COLS.forEach(([hd, f])=>{ if(!f || f==='id') return;
        const ev=r[hd], lv=txt(c[f]), bv=base[hd];
        if(same(ev, lv)){ base[hd]=ev; return; }
        if(bv===undefined ? !lv : (!same(ev, bv) && same(lv, bv))){ if(ev) c[f]=ev; else delete c[f]; base[hd]=ev; changed=true; return; }
        if(bv===undefined && !ev) return;   // never agreed, nothing in the file : mine goes out (an empty cell is filled)
        if(bv===undefined || !same(ev, bv)) clashes.push({ c, hd, f, excel:ev, mine:lv, by:r['Modifié par'] });   // both changed : asked
      });
      c.xlc=base; return changed;
    }
    function pull(parsed, clashes){
      const list=contacts(), byId=new Map(list.map(c=>[c.id, c])), byName=new Map();
      list.forEach(c=>{ if(shared(c)) byName.set(nameKey(c.firstName, c.lastName), c); });
      let added=0, changed=0;
      parsed.rows.forEach(r=>{
        const c=(r.ID && byId.get(r.ID)) || byName.get(nameKey(r['Prénom'], r['Nom']));
        if(c && c.private) return;   // kept for me : the file's row is not mine to merge
        if(!c){ const n={ id:r.ID||uid(), createdAt:Date.now(), updatedAt:Date.now(), deleted:false, xlc:{} };
          COLS.forEach(([hd, f])=>{ if(f && f!=='id' && r[hd]) n[f]=r[hd]; n.xlc[hd]=r[hd]; }); list.push(n); added++; return; }
        if(pullRow(c, r, clashes)){ c.updatedAt=Date.now(); changed++; }
      });
      return { added, changed };
    }
    // what changed here since the file was last agreed : sent, with what was agreed (the bridge keeps a colleague's cell)
    // the first time, many contacts never sent : asked once (time to lock the private ones first) ; never sent unasked
    async function firstOk(fresh, manual){
      if(fresh.length<=10) return true;
      try{ if(localStorage.getItem('xc-first-ok')) return true; }catch(e){ return false; }
      if(!manual) return false;
      const v=await askChoice('Premier envoi des contacts', fresh.length+' contacts partagés vont être écrits dans le fichier de l\u2019équipe. Ceux au cadenas restent chez toi : vérifie-les d\u2019abord dans Contacts (filtre « Privés »).', [{ label:'Envoyer les '+fresh.length, value:'y' }]);
      if(v!=='y') return false;
      try{ localStorage.setItem('xc-first-ok', '1'); }catch(e){ /* asked again next time */ }
      return true;
    }
    async function push(parsed, who, clashes, manual){
      const width=parsed.head.length;
      let todo=contacts().filter(needsSend);
      const fresh=todo.filter(c=>!c.xlc);
      if(!await firstOk(fresh, manual)) todo=todo.filter(c=>c.xlc);
      let sent=0;
      for(let i=0; i<todo.length; i+=BATCH){
        const part=todo.slice(i, i+BATCH), rows=part.map(c=>{ const prev=c.xlc ? valuesFor(Object.fromEntries(COLS.filter(x=>x[1]).map(([hd, f])=>[f, c.xlc[hd]])), parsed.at, width, null) : [];
          const force={}; COLS.forEach(([hd])=>{ const k=parsed.at[fold(hd)]; if(k!=null && META.has(hd) && hd!=='ID') force[k]='replace'; });
          return { values:valuesFor(c, parsed.at, width, who), prev, force }; });
        const res=await bridgeCall('POST', '/contacts/upsert', { rows }, 180000);
        (res.results||[]).forEach((r, j)=>settle(part[j], rows[j], r, parsed, clashes)); sent+=part.length;
      }
      return sent;
    }
    function settle(c, row, r, parsed, clashes){
      if(!c || !r || !r.ok || r.question) return;
      c.xlc=c.xlc||{};
      (r.mine||[]).forEach(i=>{ const hd=parsed.head[i]; const col=COLS.find(x=>fold(x[0])===fold(hd)); if(col) c.xlc[col[0]]=txt(row.values[i]); });
      (r.conflicts||[]).forEach(x=>{ const col=COLS.find(y=>fold(y[0])===fold(x.header)); if(col && col[1] && !clashes.some(k=>k.c===c && k.hd===col[0])) clashes.push({ c, hd:col[0], f:col[1], excel:x.excel, mine:x.app, i:x.i }); });   // once per cell, even when already seen on reading
    }
    const who=c=>[c.firstName, c.lastName].filter(Boolean).join(' ');
    async function ask(k, parsed){
      const v=await askChoice('Contact modifié dans l’Excel', '« '+who(k.c)+' » · '+k.hd+'\n\nDans l’Excel'+(k.by?' (dernière modification : '+k.by+')':'')+' : « '+(k.excel||'(vide)')+' »\nIci : « '+(k.mine||'(vide)')+' »',
        [{ label:'Garder la mienne', value:'mine' }, { label:'Garder celle de l’Excel', value:'excel', ghost:true }], { cancel:false });
      if(v==='mine'){ const i=parsed.at[fold(k.hd)]; const values=valuesFor(k.c, parsed.at, parsed.head.length, bridgeInfo().who);
        await bridgeCall('POST', '/contacts/upsert', { rows:[{ values, force:{ [i]:'replace' }, seen:{ [i]:k.excel } }] }, 60000); k.c.xlc[k.hd]=txt(k.mine); }
      else { if(k.excel) k.c[k.f]=k.excel; else delete k.c[k.f]; k.c.xlc[k.hd]=txt(k.excel); k.c.updatedAt=Date.now(); }
    }
    let lastRead=null;
    async function sync(manual){
      if(busy || !ready()) return null; busy=true; lastRun=Date.now();
      try{
        // the file read again only when it changed (bridge 1.36) ; unchanged, the last reading is used again
        const res=await bridgeCall('GET', '/contacts/read'+(lastRead && lastRead.stamp && !manual ? '?since='+encodeURIComponent(lastRead.stamp) : ''), null, 120000);
        if(!res.unchanged) lastRead={ stamp:res.stamp||'', sheet:(res.sheets||{}).Contacts };
        const parsed=parse(lastRead.sheet);
        const clashes=[], got=pull(parsed, clashes), sent=await push(parsed, bridgeInfo().who, clashes, manual);
        for(const k of clashes) await ask(k, parsed);
        await saveCrm(); renderContacts();
        lastReport=parsed.rows.length+' ligne'+(parsed.rows.length>1?'s':'')+' dans l’Excel · '+got.added+' arrivée(s), '+got.changed+' mise(s) à jour ici, '+sent+' envoyée(s)';
        if(manual) notify('Contacts équipe : '+lastReport+'.');
        paint(); card(document.querySelector('.xs-card[data-k="contacts"]')); return got;
      }catch(e){ lastReport='Échec : '+(e&&e.message||e); paint(); if(manual) notify('Contacts équipe : '+lastReport); return null; }
      finally{ busy=false; }
    }
    function paint(){
      const st=$('xc-status'); if(!st) return;
      const i=bridgeInfo(); if(i && i.contacts && i.contacts.name && document.activeElement!==$('xc-file')) $('xc-file').placeholder=i.contacts.name;
      st.textContent=mode()!=='excel' ? 'Mode équipe Supabase : les contacts ne passent pas par l’Excel.' : !i ? 'Pont Excel pas joignable.' : !(i.contacts && i.contacts.found) ? 'Fichier des contacts pas encore choisi.' : (lastReport||'Prêt : '+i.contacts.name);
      st.className='bridge-status'+(ready()?' on':'');
    }
    async function setFile(){
      const p=$('xc-file').value.trim(); if(!p) return;
      try{ const r=await bridgeCall('POST', '/contacts/file', { path:p }); notify('Fichier des contacts équipe : '+r.name+'.'); $('xc-file').value=''; await app.bridgeCheck(); sync(true); }
      catch(e){ notify('Fichier refusé : '+(e&&e.message||e)); }
    }
    if($('xc-file-save')){ $('xc-file-save').onclick=setFile; $('xc-sync-btn').onclick=()=>sync(true); }
    // Réglages › Données d'équipe : Excel (default) or the Supabase base ; the other one's settings hidden
    function paintMode(){
      const m=mode(); document.querySelectorAll('input[name="team-mode"]').forEach(r=>{ r.checked=r.value===m; });
      const t=$('team-section'); if(t) t.hidden=m!=='supabase'; const x=$('xc-box'); if(x) x.hidden=m!=='excel';
    }
    document.querySelectorAll('input[name="team-mode"]').forEach(r=>r.addEventListener('change', async ()=>{
      const want=r.value; if(want===mode()) return;
      const ok=await askChoice('Données d\u2019équipe', want==='excel' ? 'Passer aux Excel SharePoint (via le pont) ? La base Supabase est mise en sommeil : plus rien n\u2019y est envoyé ni lu. L\u2019appli se recharge.' : 'Passer à la base Supabase ? Les contacts partagés et le pipeline y seront envoyés, hors du cadre de l\u2019entreprise. Toute l\u2019équipe doit faire le même choix. L\u2019appli se recharge.', [{ label:'Changer', value:'y' }]);
      if(ok!=='y'){ paintMode(); return; }
      try{ localStorage.setItem('team-mode', want); }catch(e){ notify('Réglage impossible : le navigateur refuse son stockage.'); paintMode(); return; }
      location.reload();
    }));
    paintMode();
    // every 5 minutes while the app is open, and soon after a change here
    let soon=null;
    const later=()=>{ if(mode()!=='excel') return; clearTimeout(soon); soon=setTimeout(()=>sync(false), 8000); };
    setInterval(()=>{ if(document.visibilityState==='visible' && Date.now()-lastRun>EVERY) sync(false); }, 60000);
    // the Synchro Excel page's card : what waits, what was done last ; the button syncs
    function card(el){
      if(!el) return;
      const i=bridgeInfo(), on=mode()==='excel' && !!i && !!i.who;   // shown with a bridge that knows the contacts file (v1.34+)
      el.hidden=!on; if(!on) return;
      const n=contacts().filter(needsSend).length, ok=ready();
      el.classList.toggle('done', ok && !n);
      el.querySelector('.xs-card-n').textContent=!(i.contacts && i.contacts.found) ? 'Fichier pas encore choisi (Réglages › Données d\u2019équipe)'
        : (n ? n+' contact'+(n>1?'s':'')+' à envoyer' : 'rien à envoyer')+(lastRun ? ' · synchro à '+new Date(lastRun).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '');
      const b=el.querySelector('.xs-ct-send'); b.disabled=busy || !ok; b.textContent=busy ? 'Synchro…' : 'Synchroniser les contacts';
      b.onclick=async ()=>{ b.disabled=true; b.textContent='Synchro…'; await sync(true); card(el); };
      const g=el.querySelector('.xs-ct-set'); g.hidden=ok; g.onclick=()=>app.openSettings && app.openSettings();
    }
    Object.assign(api, { sync, paint, later, parse, ready, card });
  };
  return api;
})();
