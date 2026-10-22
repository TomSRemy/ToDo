// Todo — the app (loaded at the end of index.html, after js/storage.js): tasks, CRM, pipeline, Portefeuille, sync.
(function(){
  const $ = id => document.getElementById(id);
  const taskList=$('task-list'), badge=$('todo-badge'), headStats=$('head-stats'), tableHeader=$('table-header');
  const filters=$('filters'), viewSwitch=$('view-switch'), snoozePopover=$('snooze-popover');
  const reminderToggle=$('reminder-toggle'), reminderRow=$('reminder-row'), recurToggle=$('recur-toggle'), recurRow=$('recur-row');
  const clientInput=$('f-client'), projectInput=$('f-project'), clientDot=$('client-dot'), projectDot=$('project-dot');
  const clientDatalist=$('client-datalist'), projectDatalist=$('project-datalist');
  const tabs=document.querySelectorAll('.tab'), tabToday=$('tab-today'), tabTasks=$('tab-tasks'), tabInbox=$('tab-inbox'), tabArchive=$('tab-archive'), tabLists=$('tab-lists');
  const clientChipRow=$('client-chip-row'), projectChipRow=$('project-chip-row');
  const addSection=$('add-section'), cancelTaskBtn=$('cancel-task');
  const quickAddInput=$('quick-add-input'), quickAddMore=$('quick-add-more');
  const searchInput=$('search-input'), searchClear=$('search-clear');

  const URGENCY_RANK={critique:0,haute:1,moyenne:2,basse:3};
  const LINK_RE=/\[\[([^\[\]\n]{1,80})\]\]/g;   // [[links]] to contacts, companies, installations
  const plainLinks=s=>String(s==null?'':s).replace(LINK_RE,'$1');
  const URGENCY_ORDER=['critique','haute','moyenne','basse'];
  const URGENCY_META={critique:{label:'Critique',color:'#ED6965'},haute:{label:'Haute',color:'#BB3E03'},moyenne:{label:'Moyenne',color:'#7DD3FC'},basse:{label:'Basse',color:'#8B7FB5'}};
  // Installation stages, in order. who = RACI owner (Com = me; others become "en attente" follow-up tasks).
  // pipe = "Stade" column of the Pipe sheet, bdd = "Statut" column of the Suivi Agrégation BDD.
  const OPP_STAGES=[
    {key:'a_qualifier',label:'À qualifier',phase:'qualif',who:'Com',task:'Appeler',pipe:'A qualifier'},
    {key:'prise_contact',label:'Prise de contact',phase:'qualif',who:'Com',task:'Prendre le RDV 1',pipe:'Prise en contact'},
    {key:'collecte',label:'Collecte d\u2019infos',phase:'qualif',who:'Com',task:'Collecter les infos centrale',pipe:"Collecte d'informations"},
    {key:'qualif_en_cours',label:'Qualification',phase:'qualif',who:'Com',task:'RDV 2 et décision Go / No Go',pipe:'Qualification en cours'},
    {key:'demande_prix',label:'Demande de prix',phase:'offre',who:'Com',task:'Envoyer la demande de pricing',bdd:'En préparation'},
    {key:'pricing_indicatif',label:'Pricing indicatif',phase:'offre',who:'Ops',task:'Pricing indicatif',bdd:'En préparation'},
    {key:'offre_remise',label:'Offre à remettre',phase:'offre',who:'Com',task:'Remettre l\u2019offre au producteur',bdd:'En préparation'},
    {key:'offre_attente',label:'Retour sur l\u2019offre',phase:'offre',who:'Client',task:'Relancer le producteur sur l\u2019offre',bdd:'En attente'},
    {key:'kyc',label:'KYC + solvabilité',phase:'contrat',who:'Jur',task:'KYC et solvabilité',bdd:'En attente'},
    {key:'negociation',label:'Négociation',phase:'contrat',who:'Com',task:'Négocier le contrat',bdd:'En attente'},
    {key:'pricing_ferme',label:'Pricing ferme',phase:'contrat',who:'Ops',task:'Pricing ferme',bdd:'En attente'},
    {key:'mise_signature',label:'Mise en signature',phase:'contrat',who:'Com',task:'Mettre en signature (DocuSign)',bdd:'En attente'},
    {key:'signature',label:'Signature',phase:'contrat',who:'Dir',task:'Signature du contrat',bdd:'En attente'},
    {key:'onboarding',label:'Onboarding',phase:'onboarding',who:'Com',task:'Onboarding (WATTEE, ARPE, SharePoint)',bdd:'Gagné'},
    {key:'actif',label:'Valorisation démarrée',phase:'actif',who:'Ops',task:'Démarrage de la valorisation',bdd:'Gagné'}
  ];
  const STATUS_META={a_faire:{label:'À faire',color:'#1A7B8C'},en_cours:{label:'En cours',color:'#14D3A9'},en_attente:{label:'En attente',color:'#FFFD82'}};
  const STATUS_CYCLE=['a_faire','en_cours','en_attente'];
  const CLIENT_PALETTE=['#14D3A9','#ED6965','#FFFD82','#1A7B8C','#CA6702','#BB3E03','#7DD3FC','#8B7FB5'];
  const PROJECT_PALETTE=['#14D3A9','#ED6965','#FFFD82','#1A7B8C','#CA6702','#BB3E03','#7DD3FC','#8B7FB5'];

  let tasks=[], clientsList=[], projectsList=[];
  let companies=[], contacts=[], meetings=[], opportunities=[];
  let companyTypesList=['Client','Consultant','Fournisseur','Partenaire'];
  let syncConfig={owner:'',repo:'',token:'',enabled:false};
  let lastKnownSha=null, syncPushTimer=null;
  let conflicts=[];
  let tasksBaseSnapshot=null, crmBaseSnapshot=null;
  let currentFilter='ouvertes', currentView='liste', searchQuery='';
  let notifiedIds=new Set(), selectedTaskId=null, currentSnoozeId=null, editingId=null, expandedSubtaskIds=new Set();

  const TASKS_KEY='todo-widget-tasks', CLIENTS_KEY='todo-widget-clients', PROJECTS_KEY='todo-widget-projects';
  const COMPANIES_KEY='todo-widget-companies', CONTACTS_KEY='todo-widget-contacts', MEETINGS_KEY='todo-widget-meetings', OPPS_KEY='todo-widget-opportunities';
  const COMPANY_TYPES_KEY='todo-widget-company-types';
  const SYNC_CONFIG_KEY='sync-config';
  const SYNC_TASKS_PATH='data/tasks.json';
  const SYNC_CRM_PATH='data/crm.json';
  const NOTES_KEY='todo-widget-notes', SYNC_NOTES_PATH='data/notes.json';
  let notes=[], notesBaseSnapshot=null, lastKnownNotesSha=null, notesSyncPushTimer=null;

  async function loadAll(){
    try{ const r=await window.storage.get(TASKS_KEY,false); tasks=r&&r.value?JSON.parse(r.value):[]; }catch(e){ tasks=[]; }
    try{ const r=await window.storage.get(CLIENTS_KEY,false); clientsList=r&&r.value?JSON.parse(r.value):[]; }catch(e){ clientsList=[]; }
    try{ const r=await window.storage.get(PROJECTS_KEY,false); projectsList=r&&r.value?JSON.parse(r.value):[]; }catch(e){ projectsList=[]; }
    try{ const r=await window.storage.get(COMPANIES_KEY,false); companies=r&&r.value?JSON.parse(r.value):[]; }catch(e){ companies=[]; }
    try{ const r=await window.storage.get(CONTACTS_KEY,false); contacts=r&&r.value?JSON.parse(r.value):[]; }catch(e){ contacts=[]; }
    try{ const r=await window.storage.get(MEETINGS_KEY,false); meetings=r&&r.value?JSON.parse(r.value):[]; }catch(e){ meetings=[]; }
    try{ const r=await window.storage.get(OPPS_KEY,false); opportunities=r&&r.value?JSON.parse(r.value):[]; }catch(e){ opportunities=[]; }
    try{ const r=await window.storage.get(COMPANY_TYPES_KEY,false); companyTypesList=r&&r.value?JSON.parse(r.value):[]; }catch(e){ companyTypesList=[]; }
    try{ const r=await window.storage.get('sync-conflicts',false); conflicts=r&&r.value?JSON.parse(r.value):[]; }catch(e){ conflicts=[]; }
    // post-it conflicts are no longer kept (its lines are merged): clear the old ones
    if(conflicts.some(c=>c.entityType==='note')){ conflicts=conflicts.filter(c=>c.entityType!=='note'); try{ await window.storage.set('sync-conflicts', JSON.stringify(conflicts), false); }catch(e){} }
    try{ const r=await window.storage.get('sync-tasks-base',false); tasksBaseSnapshot=r&&r.value?JSON.parse(r.value):null; }catch(e){ tasksBaseSnapshot=null; }
    try{ const r=await window.storage.get('sync-crm-base',false); crmBaseSnapshot=r&&r.value?JSON.parse(r.value):null; }catch(e){ crmBaseSnapshot=null; }
    try{ const r=await window.storage.get(NOTES_KEY,false); notes=r&&r.value?JSON.parse(r.value):[]; }catch(e){ notes=[]; }
    try{ const r=await window.storage.get('sync-notes-base',false); notesBaseSnapshot=r&&r.value?JSON.parse(r.value):null; }catch(e){ notesBaseSnapshot=null; }
    try{ const r=await window.storage.get('visible-columns',false); if(r&&r.value) visibleColumns=Object.assign(visibleColumns, JSON.parse(r.value)); }catch(e){}
    let seeded=false, crmSeeded=false;
    if(companyTypesList.length===0){
      companyTypesList=['Client','Consultant','Fournisseur','Partenaire','Concurrent'];
      window.storage.set(COMPANY_TYPES_KEY,JSON.stringify(companyTypesList),false).catch(()=>{});
    }
    tasks.forEach(t=>{
      if(t.status==='termine'&&t.archived===undefined){ t.archived=true; t.archivedAt=t.archivedAt||Date.now(); t.status='a_faire'; seeded=true; }
      if(t.archived===undefined){ t.archived=false; seeded=true; }
      if(t.subtasks===undefined){ t.subtasks=[]; seeded=true; }
      if(Array.isArray(t.subtasks)) t.subtasks.forEach(s=>{ if(s && s.text==null){ s.text=String(s.title||s.label||''); seeded=true; } });   // a sub-task written by something else keeps its text
      if(t.recur===undefined){ t.recur=null; seeded=true; }
      if(t.client&&!clientsList.includes(t.client)){ clientsList.push(t.client); seeded=true; }
      if(t.project&&!projectsList.includes(t.project)){ projectsList.push(t.project); seeded=true; }
    });
    clientsList.forEach(name=>{
      if(!companies.find(c=>c.name===name)){
        companies.push({ id:'co_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name, whatTheyDo:'', marketScope:[], website:'', createdAt:Date.now(), updatedAt:Date.now(), deleted:false });
        crmSeeded=true;
      }
    });
    if(seeded){ saveTasks(); saveClients(); saveProjects(); }
    if(crmSeeded){ saveCrm(); }
    await loadSyncConfig();
    consolidateNotes(); rollDailyNote(); prefsInit();
    loadParc(); ensureRenewalTasks();
    if(migrateCompanyStars() | migrateContactCivility()) saveCrm();
    checkReminders();
    render(); renderArchive(); renderLists(); renderToday(); initPostit(); updateConflictBadge(); applyColumnVisibility();
    await loadSeenIds();
    fetchInbox();
    setInterval(fetchInbox, 5 * 60 * 1000);
    fetchContactInbox();
    setInterval(fetchContactInbox, 5 * 60 * 1000);
    checkDailyDigestNotification();
    undoRebase();   // the state as loaded is the starting point of the undo history
    if(syncConfig.enabled){ syncPull(); syncPullCrm(); syncPullNotes(); syncPullParc(); setInterval(syncPull, 5 * 60 * 1000); setInterval(syncPullCrm, 5 * 60 * 1000); setInterval(syncPullNotes, 5 * 60 * 1000); setInterval(syncPullParc, 5 * 60 * 1000); }
  }
  async function saveTasksLocalOnly(){ try{ await window.storage.set(TASKS_KEY,JSON.stringify(tasks),false); }catch(e){ console.error(e); } }
  // ---------- Undo / redo (Ctrl+Z / Ctrl+Maj+Z): every saved action is a step, several steps back ----------
  // A step keeps, for each task, contact, company, meeting, opportunity or note that changed, its version before and after.
  // Changes coming from the sync or from another tab are not steps (they are not this person's actions here).
  const UNDO_LISTS=[['task',()=>tasks,'tâche'],['company',()=>companies,'société'],['contact',()=>contacts,'contact'],['meeting',()=>meetings,'rendez-vous'],['opportunity',()=>opportunities,'opportunité'],['note',()=>notes,'note']];
  let undoBase=null, undoStack=[], redoStack=[], undoTimer=null, undoApplying=false;
  function undoSnapshot(){ const m=new Map(); UNDO_LISTS.forEach(([t,get])=>(get()||[]).forEach(x=>{ if(x && x.id) m.set(t+':'+x.id, JSON.stringify(x)); })); return m; }
  function undoRebase(){ clearTimeout(undoTimer); undoBase=undoSnapshot(); }
  function undoCommit(){
    clearTimeout(undoTimer);
    if(!undoBase || undoApplying) return;
    const now=undoSnapshot(), changes=[];
    now.forEach((v,k)=>{ const b=undoBase.get(k); if(b!==v) changes.push({ key:k, before:b==null?null:b, after:v }); });
    undoBase.forEach((v,k)=>{ if(!now.has(k)) changes.push({ key:k, before:v, after:null }); });
    undoBase=now;
    if(!changes.length) return;
    undoStack.push({ at:Date.now(), changes }); if(undoStack.length>60) undoStack.shift();
    redoStack=[];
  }
  function undoSchedule(){ if(undoApplying || !undoBase) return; clearTimeout(undoTimer); undoTimer=setTimeout(undoCommit, 700); }   // a burst of saves (typing) is one step
  function undoDescribe(step){
    const byType={}; step.changes.forEach(c=>{ const t=c.key.split(':')[0]; byType[t]=(byType[t]||0)+1; });
    if(step.changes.length===1){ const c=step.changes[0], t=c.key.split(':')[0], o=JSON.parse(c.after||c.before), lab=(UNDO_LISTS.find(x=>x[0]===t)||[])[2]||t;
      const name=plainLinks(o.title)||o.centrale||o.name||[o.firstName,o.lastName].filter(Boolean).join(' ')||o.label||(o.text||'').slice(0,30); return lab+(name?' « '+name+' »':''); }
    return Object.entries(byType).map(([t,n])=>n+' '+((UNDO_LISTS.find(x=>x[0]===t)||[])[2]||t)+(n>1?'s':'')).join(', ');
  }
  function undoApply(step, side){
    undoApplying=true;
    step.changes.forEach(c=>{
      const [t,id]=c.key.split(/:(.+)/), entry=UNDO_LISTS.find(x=>x[0]===t), list=entry[1](), i=list.findIndex(x=>x.id===id), val=side==='before'?c.before:c.after;
      if(val==null){ if(i>=0){ list[i].deleted=true; list[i].updatedAt=Date.now(); } return; }   // did not exist: removed (as a deletion, so the sync follows)
      const o=JSON.parse(val); o.updatedAt=Date.now();   // newer than any copy elsewhere, so the sync keeps it
      if(i>=0) list[i]=o; else list.push(o);
    });
    undoApplying=false;
    undoBase=undoSnapshot();
    saveTasks(); saveCrm(); saveNotes(); undoBase=undoSnapshot();
    try{ render(); renderArchive(); renderLists(); renderToday(); renderContacts(); renderPipeline(); renderNotes(); }catch(e){}
    if(!$('opp-detail-overlay').classList.contains('hidden') && viewingOppId){ const v=opportunities.find(x=>x.id===viewingOppId); if(v && !v.deleted) (v.kind==='request'?openRequestDetail:openOppDetail)(v.id); else closeOppDetail(); }
  }
  function undoLast(){
    undoCommit();
    const step=undoStack.pop(); if(!step){ showBridgeMsg('Rien à annuler.', true); return; }
    undoApply(step, 'before'); redoStack.push(step);
    showBridgeMsg('Annulé : '+undoDescribe(step)+'. Ctrl+Maj+Z pour rétablir'+(undoStack.length?' · encore '+undoStack.length+' étape'+(undoStack.length>1?'s':'')+' à annuler':'')+'.', true);
  }
  function redoLast(){
    const step=redoStack.pop(); if(!step){ showBridgeMsg('Rien à rétablir.', true); return; }
    undoApply(step, 'after'); undoStack.push(step);
    showBridgeMsg('Rétabli : '+undoDescribe(step)+'.', true);
  }
  document.addEventListener('keydown', e=>{
    if(!(e.ctrlKey||e.metaKey) || e.altKey) return;
    const k=e.key.toLowerCase(); if(k!=='z' && k!=='y') return;
    const t=e.target, typing=t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName==='INPUT' && !/^(checkbox|radio|button|submit)$/i.test(t.type)));
    if(typing) return;   // inside a field: the browser's own undo of the typing
    e.preventDefault();
    if(k==='y' || e.shiftKey) redoLast(); else undoLast();
  }, true);
  async function saveTasks(){ undoSchedule(); await saveTasksLocalOnly(); scheduleSyncPush(); }

  async function saveCrmLocalOnly(){
    try{
      // all at once: each one is in memory immediately, the disk writes run together
      await Promise.all([[COMPANIES_KEY,companies],[CONTACTS_KEY,contacts],[MEETINGS_KEY,meetings],[OPPS_KEY,opportunities],[COMPANY_TYPES_KEY,companyTypesList]]
        .map(([k,v])=>window.storage.set(k,JSON.stringify(v),false)));
    }catch(e){ console.error(e); }
  }
  async function saveCrm(){ undoSchedule(); await saveCrmLocalOnly(); scheduleCrmSyncPush(); }
  function touchCrm(o){
    o.updatedAt=Date.now();
    if(o && o.stage && (o.kind==='installation'||o.kind==='prequal'||o.kind==='request')){
      const log=Array.isArray(o.stageLog)?o.stageLog:[];
      if(!log.length || log[log.length-1].stage!==o.stage){ log.push({ stage:o.stage, at:o.updatedAt }); o.stageLog=log.slice(-30); }
    }
  }

  function touch(t){ t.updatedAt=Date.now(); }

  async function loadSyncConfig(){
    try{ const r=await window.storage.get(SYNC_CONFIG_KEY,false); syncConfig=r&&r.value?JSON.parse(r.value):{owner:'',repo:'',token:'',enabled:false}; }
    catch(e){ syncConfig={owner:'',repo:'',token:'',enabled:false}; }
  }
  async function saveSyncConfig(){ try{ await window.storage.set(SYNC_CONFIG_KEY,JSON.stringify(syncConfig),false); }catch(e){} }

  function syncApiUrl(path){ return 'https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo+'/contents/'+(path||SYNC_TASKS_PATH); }
  function b64EncodeUtf8(str){ return btoa(unescape(encodeURIComponent(str))); }
  function b64DecodeUtf8(b64){ return decodeURIComponent(escape(atob(b64.replace(/\n/g,'')))); }

  // Reads a JSON file of the data repo. The "object" media type works up to 100 MB (the default one stops
  // at 1 MB); above 1 MB the content comes empty and is fetched again as raw text.
  async function ghGetJson(path){
    const auth={ 'Authorization':'Bearer '+syncConfig.token };
    const res=await fetch(syncApiUrl(path), { headers:Object.assign({ 'Accept':'application/vnd.github.object+json' }, auth), cache:'no-store' }).catch(e=>{ syncNote(null); throw e; });
    syncNote(res);
    if(!res.ok) return { ok:false, status:res.status };
    const data=await res.json();
    let text;
    if(data.content && data.encoding!=='none') text=b64DecodeUtf8(data.content);
    else {
      const raw=await fetch(syncApiUrl(path), { headers:Object.assign({ 'Accept':'application/vnd.github.raw+json' }, auth), cache:'no-store' });
      if(!raw.ok) return { ok:false, status:raw.status };
      text=await raw.text();
    }
    return { ok:true, status:200, sha:data.sha, json:JSON.parse(text) };
  }
  function setSyncStatus(msg){ const el=$('sync-status'); if(el) el.textContent=msg; }

  // ---------- sync state, visible everywhere: pill in the sidebar (top right on the phone version) ----------
  // Every GitHub read/write of the sync reports here; a failure stays shown until a call succeeds again.
  const syncState={ busy:0, okAt:0, errAt:0, errStatus:null };
  function syncNote(res){
    if(res && (res.ok || res.status===404)){ syncState.okAt=Date.now(); }
    else { syncState.errAt=Date.now(); syncState.errStatus=res?res.status:0; }
    paintSyncPill();
  }
  const trackSync=fn=>async function(){
    if(!syncConfig.enabled) return fn.apply(this, arguments);
    syncState.busy++; paintSyncPill();
    try{ return await fn.apply(this, arguments); } finally{ syncState.busy--; paintSyncPill(); }
  };
  // days left before the token expires (date entered by hand: GitHub does not give it to a web page)
  function tokenDaysLeft(){
    const d=syncConfig.tokenExpires; if(!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const today=new Date(); today.setHours(0,0,0,0);
    return Math.round((new Date(d+'T00:00:00').getTime()-today.getTime())/864e5);   // calendar days: 0 = expires today
  }
  function syncPillInfo(){
    const hhmm=t=>new Date(t).toLocaleTimeString('fr-FR',{ hour:'2-digit', minute:'2-digit' });
    const last=syncState.okAt?'Dernière synchro réussie à '+hhmm(syncState.okAt)+'.':'Pas encore de synchro réussie depuis l\u2019ouverture.';
    if(!syncConfig.enabled) return { k:'off', label:'Synchro désactivée', title:'Ces données restent sur cet appareil. Clique pour activer la synchro.' };
    const days=tokenDaysLeft();
    if(days!=null && days<0) return { k:'err', label:'Jeton expiré', title:'Le jeton GitHub a expiré le '+syncConfig.tokenExpires.split('-').reverse().join('/')+' : plus rien ne se synchronise. Clique pour le renouveler.', fix:true };
    if(syncState.busy) return { k:'busy', label:'Synchronisation…', title:last };
    if(syncState.errAt>syncState.okAt){
      const s=syncState.errStatus;
      if(!s || !navigator.onLine) return { k:'off', label:'Hors ligne', title:'Pas de réseau : tes changements sont gardés ici et partiront au retour du réseau. '+last };
      const m=s===401?'Jeton refusé ou expiré':s===403?'Jeton sans les droits':s===404?'Repo introuvable':(s===409||s===422)?'Conflit, nouvel essai':'Erreur GitHub ('+s+')';
      return { k:'err', label:m, title:m+'. '+last+' '+(s===401||s===403||s===404?'Clique pour corriger le réglage.':'Clique pour réessayer.'), fix:s===401||s===403||s===404 };
    }
    if(days!=null && days<=15) return { k:'warn', label:'Jeton : expire dans '+days+' j', title:'Le jeton GitHub expire le '+syncConfig.tokenExpires.split('-').reverse().join('/')+'. Clique pour le renouveler à l\u2019avance.', fix:true };
    return { k:'ok', label:syncState.okAt?'Synchronisé '+hhmm(syncState.okAt):'Synchro active', title:last+' Clique pour synchroniser maintenant.' };
  }
  function paintSyncPill(){
    const info=syncPillInfo();
    const ban=$('lite-sync-banner'); if(ban) ban.hidden=!window.TODO_LITE || !!syncConfig.enabled;
    ['sync-pill','sync-pill-lite','sync-pill-w'].forEach(id=>{ const el=$(id); if(!el) return; el.dataset.k=info.k; el.title=info.title; el.setAttribute('aria-label', info.label+'. '+info.title); el.querySelector('.sync-label').textContent=info.label; });
  }
  function openSyncSettings(){
    if(window.TODO_LITE || window.TODO_WIDGET){ widgetOpenFull('index.html#sync'); return; }
    const tab=document.querySelector('.tab[data-tab="lists"]'); if(tab) tab.click();
    setTimeout(()=>{ const s=$('sync-section'); if(s) s.scrollIntoView({ behavior:'smooth', block:'start' }); const f=$(syncConfig.token?'sync-token-exp':'sync-owner'); if(f) f.focus({ preventScroll:true }); }, 60);
  }
  // ---------- storage space: gauge in Réf. & data, red banner when a save fails, amber when nearly full ----------
  const fmtMo=n=>n>=1048576?(n/1048576).toLocaleString('fr-FR',{ maximumFractionDigits:1 })+' Mo':Math.max(1,Math.round(n/1024))+' Ko';
  const fmtGo=n=>n>=1073741824?(n/1073741824).toLocaleString('fr-FR',{ maximumFractionDigits:1 })+' Go':fmtMo(n);
  function showStorageAlert(kind, text){
    const el=$('storage-alert'); if(!el) return;
    el.classList.toggle('warn', kind==='warn'); $('storage-alert-text').textContent=text; el.hidden=false;
  }
  function openStorageSection(){
    const tab=document.querySelector('.tab[data-tab="lists"]'); if(tab) tab.click();
    setTimeout(()=>{ const s=$('storage-section'); if(s) s.scrollIntoView({ behavior:'smooth', block:'start' }); }, 60);
  }
  let storageFailShown=false;
  window.addEventListener('todo-storage-error', e=>{
    const full=/quota/i.test((e.detail&&(e.detail.name+' '+e.detail.message))||'');
    showStorageAlert('crit', (full?'Enregistrement impossible : l\u2019espace de ce navigateur est plein. ':'Enregistrement impossible sur cet appareil (erreur du navigateur). ')
      +'Tes derniers changements ne sont pas gardés ici'+(syncConfig.enabled?' ; ils partent quand même sur GitHub à la prochaine synchro.':' : active la synchro ou exporte tes données.'));
    if(!storageFailShown){ storageFailShown=true; console.error('storage write failed', e.detail); }
  });
  async function storageRatio(){
    const u=await window.storage.usage();
    const lsRatio=u.ls/u.lsLimit, dbRatio=(u.mode==='idb' && u.quota)?u.usage/u.quota:0;
    return { u, ratio:Math.max(u.mode==='idb'?0:lsRatio, dbRatio), lsRatio };
  }
  async function checkStorageFull(){
    try{
      const { ratio }=await storageRatio();
      if(ratio>=.8 && !sessionStorage.getItem('storage-warned')){
        sessionStorage.setItem('storage-warned','1');
        showStorageAlert('warn', 'Espace de stockage presque plein ('+Math.round(ratio*100)+' %). Pense à exporter ou alléger tes données.');
      }
    }catch(e){}
  }
  async function renderStorageGauge(){
    const box=$('storage-gauge'); if(!box || !window.storage.usage) return;
    try{
      const { u, lsRatio }=await storageRatio();
      const groups=[['Tâches',['todo-widget-tasks']],['Contacts, sociétés et pipeline',['todo-widget-companies','todo-widget-contacts','todo-widget-meetings','todo-widget-opportunities','todo-widget-company-types','todo-widget-clients','todo-widget-projects']],
        ['Note rapide',['todo-widget-notes']],['Copies de référence de la synchro',['sync-tasks-base','sync-crm-base','sync-notes-base','sync-conflicts']],['Portefeuille (Excel)',['parc-data']]];
      const used=new Set(); const rows=groups.map(([l,ks])=>{ ks.forEach(k=>used.add(k)); return [l, ks.reduce((s,k)=>s+(u.parts[k]||0),0)]; });
      rows.push(['Autres', Object.entries(u.parts).filter(([k])=>!used.has(k)).reduce((s,[,n])=>s+n,0)]);
      const bar=(r,lab)=>'<div class="sg-bar'+(r>=.9?' crit':r>=.8?' warn':'')+'" title="'+lab+'"><span style="width:'+Math.min(100,Math.max(1,r*100)).toFixed(1)+'%"></span></div>';
      let html='';
      if(u.mode==='idb') html+='<div class="sg-mode">Base de données du navigateur : '+fmtMo(u.data)+' de données'+(u.quota?', '+fmtGo(u.quota)+' disponibles en tout':'')+'.</div>'+(u.quota?bar(u.usage/u.quota,'Espace du navigateur utilisé'):'');
      else html+='<div class="sg-mode">Stockage simple du navigateur : '+Math.round(lsRatio*100)+' % de sa limite (environ 5 Mo).</div>'+bar(lsRatio,'Limite du stockage simple');
      html+=rows.filter(r=>r[1]>0).map(([l,n])=>'<div class="sg-row"><span>'+l+'</span><b>'+fmtMo(n)+'</b></div>').join('');
      html+='<div class="muted">Réglages et autres pages de tomsremy.github.io : '+Math.round(lsRatio*100)+' % du stockage simple (limite partagée entre ces pages).</div>';
      box.innerHTML=html;
    }catch(e){ box.innerHTML='<span class="muted">Espace non mesurable dans ce navigateur.</span>'; }
  }
  function syncEverythingNow(){ syncPull(); syncPullCrm(); syncPullNotes(); syncPullParc(); }
  function onSyncPillClick(){
    const info=syncPillInfo();
    if(info.k==='off' && !syncConfig.enabled) return openSyncSettings();
    if(info.fix) return openSyncSettings();
    if(syncConfig.enabled) syncEverythingNow();
  }

  // Merge by id: for tasks present on both sides, keep whichever has the
  // more recent updatedAt. Deletions are tombstones (deleted:true) so their
  // absence propagates correctly instead of a stale copy reappearing.
  // Field labels shown in the conflict list, per entity type.
  const CONFLICT_ENTITY_LABELS={
    task:{ name:t=>t.title, fields:{title:'Titre',description:'Description',client:'Client',project:'Projet',urgency:'Urgence',status:'Statut',due:'Échéance'} },
    company:{ name:c=>c.name, fields:{whatTheyDo:'Activité',website:'Site web',marketScope:'Périmètre',type:'Type',relevance:'Pertinence'} },
    contact:{ name:c=>[c.firstName,c.lastName].filter(Boolean).join(' ')||'(sans nom)', fields:{firstName:'Prénom',lastName:'Nom',role:'Rôle',company:'Société',email:'Email',phone1:'Téléphone 1',phone2:'Téléphone 2',relevance:'Pertinence',comment:'Commentaire'} },
    meeting:{ name:m=>m.label, fields:{label:'Intitulé',date:'Date'} },
    opportunity:{ name:o=>o.title, fields:{title:'Intitulé',company:'Société',stage:'Étape'} },
    note:{ name:n=>'Post-it « '+(n.text||'').slice(0,30)+' »', fields:{text:'Texte',kind:'Type',forDate:'Pour le'} }
  };

  // Post-it text edited on two devices: this device's lines, minus those the other device deleted (and this one did not touch),
  // plus those the other device added, placed after the line that precedes them there.
  // a setting changed on both devices (saved views, network layout, goals): both kept — views by name, the rest key by key
  function mergePrefValue(local, remote){
    let l, r; try{ l=JSON.parse(local); r=JSON.parse(remote); }catch(e){ return local; }
    if(Array.isArray(l) && Array.isArray(r)) return JSON.stringify(l.every(x=>x && typeof x==='object')?l.concat(r.filter(x=>x && !l.some(y=>y.name===x.name))):[...new Set(l.concat(r))]);
    if(l && r && typeof l==='object' && typeof r==='object') return JSON.stringify(Object.assign({}, r, l));
    return local;
  }
  function mergeNoteLines(base, local, remote){
    const B=String(base||'').split('\n'), L=String(local||'').split('\n'), R=String(remote||'').split('\n');
    const inB=new Set(B), inR=new Set(R), inL=new Set(L);
    const out=L.filter(l=>!(inB.has(l) && !inR.has(l)));
    R.forEach((l,i)=>{ if(inB.has(l) || inL.has(l) || out.includes(l)) return;
      const prev=i>0?R[i-1]:null, at=prev!=null?out.lastIndexOf(prev):-1; out.splice(at+1, 0, l); });
    return out.join('\n').replace(/\n{3,}/g,'\n\n');
  }
  // src: where each version comes from, shown with the choice ({ a:'Sur cet appareil…', b:'Dans le fichier…' })
  function logConflict(entityType, entity, field, localValue, remoteValue, resolvedValue, src){
    const meta=CONFLICT_ENTITY_LABELS[entityType];
    if(conflicts.length>=200) conflicts.splice(0, conflicts.length-199);   // keep the log readable
    conflicts.push({
      id:'cf_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
      entityType, entityId:entity.id,
      entityName: meta ? meta.name(entity) : entity.id,
      fieldLabel: meta && meta.fields[field] ? meta.fields[field] : field,
      field, localValue, remoteValue, resolvedValue,
      srcA:src&&src.a||'', srcB:src&&src.b||'',
      at:Date.now()
    });
  }

  // Three-way merge: with a known common ancestor (base), a field that
  // changed on only one side is taken automatically; a field changed
  // differently on both sides is a real conflict — auto-resolved to the
  // most recent for now (nothing ever blocks), but logged for review.
  // Without a base (first sync ever), falls back to whole-record
  // most-recent-wins, same as before.
  function threeWayMerge(entityType, localList, remoteList, baseList){
    const baseById={}; (baseList||[]).forEach(b=>{ baseById[b.id]=b; });
    const localById={}; localList.forEach(l=>{ localById[l.id]=l; });
    const remoteById={}; remoteList.forEach(r=>{ remoteById[r.id]=r; });
    const allIds=new Set([...Object.keys(localById), ...Object.keys(remoteById)]);
    const merged=[];

    allIds.forEach(id=>{
      const local=localById[id], remote=remoteById[id], base=baseById[id];
      if(local && !remote){ merged.push(local); return; }
      if(remote && !local){ merged.push(remote); return; }
      if(!local || !remote) return;
      if(JSON.stringify(local)===JSON.stringify(remote)){ merged.push(local); return; }

      if(!base){
        merged.push((remote.updatedAt||0) > (local.updatedAt||0) ? remote : local);
        return;
      }

      const result={...local};
      const allFields=new Set([...Object.keys(local), ...Object.keys(remote)]);
      allFields.forEach(field=>{
        if(field==='updatedAt') return;
        const lv=JSON.stringify(local[field]), rv=JSON.stringify(remote[field]), bv=JSON.stringify(base[field]);
        if(lv===rv) return;
        const localChanged=lv!==bv, remoteChanged=rv!==bv;
        if(remoteChanged && !localChanged){ result[field]=remote[field]; return; }
        if(localChanged && !remoteChanged) return;
        if(localChanged && remoteChanged && entityType==='note'){
          // the post-it changes all the time on both devices: its lines are merged, never reported as a conflict
          result[field]=field==='text'?mergeNoteLines(base[field], local[field], remote[field]):field.startsWith('pref_')?mergePrefValue(local[field], remote[field]):((remote.updatedAt||0)>(local.updatedAt||0)?remote[field]:local[field]);
          return;
        }
        if(localChanged && remoteChanged){
          const takeRemote=(remote.updatedAt||0) > (local.updatedAt||0);
          result[field]=takeRemote?remote[field]:local[field];
          const when=t=>t?' (modifié le '+new Date(t).toLocaleDateString('fr-FR')+')':'';
          logConflict(entityType, result, field, local[field], remote[field], result[field], { a:'Sur cet appareil'+when(local.updatedAt), b:'Venu de ton autre appareil, par la synchro'+when(remote.updatedAt) });
        }
      });
      result.updatedAt=Math.max(local.updatedAt||0, remote.updatedAt||0);
      merged.push(result);
    });

    return merged;
  }

  function stableStringify(o){
    if(o===null || typeof o!=='object') return JSON.stringify(o);
    if(Array.isArray(o)) return '['+o.map(stableStringify).join(',')+']';
    return '{'+Object.keys(o).sort().filter(k=>o[k]!==undefined).map(k=>JSON.stringify(k)+':'+stableStringify(o[k])).join(',')+'}';
  }
  function sameRecords(a, b){
    if(a.length!==b.length) return false;
    const byId={}; b.forEach(r=>{ byId[r.id]=stableStringify(r); });
    return a.every(r=>byId[r.id]===stableStringify(r));
  }

  async function saveConflicts(){ try{ await window.storage.set('sync-conflicts', JSON.stringify(conflicts), false); }catch(e){} }
  async function saveSnapshots(){
    try{ await Promise.all([window.storage.set('sync-tasks-base', JSON.stringify(tasksBaseSnapshot), false), window.storage.set('sync-crm-base', JSON.stringify(crmBaseSnapshot), false)]); }catch(e){}
  }

  function refreshAllViews(){
    render();
    if(typeof renderToday==='function') renderToday();
    if(typeof renderArchive==='function') renderArchive();
    if(typeof renderLists==='function') renderLists();
  }

  async function syncPull(){
    if(!syncConfig.enabled) return;
    try{
      const data=await ghGetJson(SYNC_TASKS_PATH);
      if(data.status===404){ scheduleSyncPush(); return; }
      if(!data.ok){ setSyncStatus('Erreur de synchro (lecture)'); return; }
      const remoteTasks=data.json;
      undoCommit(); tasks=threeWayMerge('task', tasks, remoteTasks, tasksBaseSnapshot); undoRebase();
      // The base is what is actually on the server — not the merged result,
      // which may still hold local edits that were never pushed (e.g. app
      // closed within the 3s push debounce). Those get pushed now instead of
      // being silently reverted by the next pull.
      tasksBaseSnapshot=remoteTasks.map(t=>({...t}));
      lastKnownSha=data.sha;
      await saveTasksLocalOnly(); await saveSnapshots(); await saveConflicts(); updateConflictBadge();
      refreshAllViews();
      if(!sameRecords(tasks, remoteTasks)) scheduleSyncPush();
      setSyncStatus('Synchronisé '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
    }catch(e){ console.error('sync pull failed', e); setSyncStatus('Erreur de synchro'); }
  }

  // a write refused because the file changed meanwhile (409/422: the other device wrote first): read, merge and write again
  const syncRetries={};
  function syncRetryLater(key, status, again){
    if(status!==409 && status!==422) return false;
    const n=(syncRetries[key]||0)+1; if(n>3){ syncRetries[key]=0; return false; }
    syncRetries[key]=n; setTimeout(again, 1200*n); return true;
  }
  function syncRetryDone(key){ syncRetries[key]=0; }
  function scheduleSyncPush(){
    if(!syncConfig.enabled) return;
    clearTimeout(syncPushTimer);
    syncPushTimer=setTimeout(()=>{ syncPushTimer=null; syncPushNow(); }, 3000);
  }

  async function syncPushNow(){
    if(!syncConfig.enabled) return;
    try{
      let sha=lastKnownSha;
      const getData=await ghGetJson(SYNC_TASKS_PATH);
      if(getData.ok){
        sha=getData.sha;
        const remoteTasks=getData.json;
        undoCommit(); tasks=threeWayMerge('task', tasks, remoteTasks, tasksBaseSnapshot); undoRebase();
        await saveTasksLocalOnly();
        refreshAllViews();
      }
      await saveConflicts(); updateConflictBadge();
      const body={ message:'Sync tasks', content:b64EncodeUtf8(JSON.stringify(tasks)), branch:'main' };
      if(sha) body.sha=sha;
      const putRes=await fetch(syncApiUrl(), {
        method:'PUT',
        headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' },
        body:JSON.stringify(body)
      });
      syncNote(putRes);
      if(putRes.ok){
        const putData=await putRes.json();
        lastKnownSha=putData.content.sha;
        // Only now does the base snapshot advance to "local == remote" — if the
        // PUT above had failed, a stale base would make the next merge think a
        // just-completed field (e.g. archived) was never really changed locally
        // and silently revert it to the old remote value (tasks "reappearing").
        tasksBaseSnapshot=tasks.map(t=>({...t}));
        await saveSnapshots(); syncRetryDone('tasks');
        setSyncStatus('Synchronisé '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
      }else{
        if(!syncRetryLater('tasks', putRes.status, ()=>syncPushNow())) setSyncStatus('Erreur de synchro (écriture)');
      }
    }catch(e){ console.error('sync push failed', e); syncNote(null); setSyncStatus('Erreur de synchro'); }
  }

  let lastKnownCrmSha=null, crmSyncPushTimer=null;
  function mergeCrmBundle(local, remote){
    const base=crmBaseSnapshot||{};
    return {
      companies: threeWayMerge('company', local.companies||[], remote.companies||[], base.companies),
      contacts: threeWayMerge('contact', local.contacts||[], remote.contacts||[], base.contacts),
      meetings: threeWayMerge('meeting', local.meetings||[], remote.meetings||[], base.meetings),
      opportunities: threeWayMerge('opportunity', local.opportunities||[], remote.opportunities||[], base.opportunities)
    };
  }
  async function syncPullCrm(){
    if(!syncConfig.enabled) return;
    try{
      const data=await ghGetJson(SYNC_CRM_PATH);
      if(data.status===404){ scheduleCrmSyncPush(); return; }
      if(!data.ok) return;
      const remote=data.json;
      const merged=mergeCrmBundle({companies,contacts,meetings,opportunities}, remote);
      undoCommit(); companies=merged.companies; contacts=merged.contacts; meetings=merged.meetings; opportunities=merged.opportunities; undoRebase();
      lastKnownCrmSha=data.sha;
      // Base = server state, not merged state (see syncPull).
      crmBaseSnapshot={ companies:(remote.companies||[]).map(c=>({...c})), contacts:(remote.contacts||[]).map(c=>({...c})), meetings:(remote.meetings||[]).map(m=>({...m})), opportunities:(remote.opportunities||[]).map(o=>({...o})) };
      await saveCrmLocalOnly(); await saveSnapshots(); await saveConflicts(); updateConflictBadge();
      if(typeof renderCrm==='function') renderCrm();
      if(!sameRecords(companies, remote.companies||[]) || !sameRecords(contacts, remote.contacts||[]) || !sameRecords(meetings, remote.meetings||[]) || !sameRecords(opportunities, remote.opportunities||[])) scheduleCrmSyncPush();
    }catch(e){ console.error('crm sync pull failed', e); }
  }
  function scheduleCrmSyncPush(){
    if(!syncConfig.enabled) return;
    clearTimeout(crmSyncPushTimer);
    crmSyncPushTimer=setTimeout(()=>{ crmSyncPushTimer=null; syncPushCrmNow(); }, 3000);
  }
  async function syncPushCrmNow(){
    if(!syncConfig.enabled) return;
    try{
      let sha=lastKnownCrmSha;
      const getData=await ghGetJson(SYNC_CRM_PATH);
      if(getData.ok){
        sha=getData.sha;
        const remote=getData.json;
        const merged=mergeCrmBundle({companies,contacts,meetings,opportunities}, remote);
        undoCommit(); companies=merged.companies; contacts=merged.contacts; meetings=merged.meetings; opportunities=merged.opportunities; undoRebase();
        await saveCrmLocalOnly();
        if(typeof renderCrm==='function') renderCrm();
      }
      await saveConflicts(); updateConflictBadge();
      const bundle=JSON.stringify({companies,contacts,meetings,opportunities});
      const body={ message:'Sync CRM data', content:b64EncodeUtf8(bundle), branch:'main' };
      if(sha) body.sha=sha;
      const putRes=await fetch(syncApiUrl(SYNC_CRM_PATH), {
        method:'PUT',
        headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' },
        body:JSON.stringify(body)
      });
      syncNote(putRes);
      if(putRes.ok){
        const putData=await putRes.json();
        lastKnownCrmSha=putData.content.sha;
        // See syncPushNow: only advance the base once the write is confirmed,
        // or a failed PUT leaves a stale base that reverts real local changes
        // on the next merge.
        crmBaseSnapshot={ companies:companies.map(c=>({...c})), contacts:contacts.map(c=>({...c})), meetings:meetings.map(m=>({...m})), opportunities:opportunities.map(o=>({...o})) };
        await saveSnapshots(); syncRetryDone('crm');
      } else syncRetryLater('crm', putRes.status, ()=>syncPushCrmNow());
    }catch(e){ console.error('crm sync push failed', e); syncNote(null); }
  }
  async function saveNotesLocalOnly(){ try{ await window.storage.set(NOTES_KEY,JSON.stringify(notes),false); }catch(e){ console.error(e); } }
  async function saveNotes(){ undoSchedule(); await saveNotesLocalOnly(); scheduleNotesSyncPush(); }
  async function saveNotesBase(){ try{ await window.storage.set('sync-notes-base', JSON.stringify(notesBaseSnapshot), false); }catch(e){} }
  async function syncPullNotes(){
    if(!syncConfig.enabled) return;
    flushPostit();
    try{
      const data=await ghGetJson(SYNC_NOTES_PATH);
      if(data.status===404){ scheduleNotesSyncPush(); return; }
      if(!data.ok) return;
      const remote=data.json;
      undoCommit(); notes=threeWayMerge('note', notes, remote, notesBaseSnapshot); undoRebase();
      consolidateNotes();
      notesBaseSnapshot=remote.map(n=>({...n}));
      lastKnownNotesSha=data.sha;
      await saveNotesLocalOnly(); await saveNotesBase(); await saveConflicts(); updateConflictBadge();
      renderNotes();
      if(!sameRecords(notes, remote)) scheduleNotesSyncPush();
    }catch(e){ console.error('notes sync pull failed', e); }
  }
  function scheduleNotesSyncPush(){
    if(!syncConfig.enabled) return;
    clearTimeout(notesSyncPushTimer);
    notesSyncPushTimer=setTimeout(()=>{ notesSyncPushTimer=null; syncPushNotesNow(); }, 3000);
  }
  // Leaving the app (phone: switch app, lock screen) must not wait for the 3s debounce.
  function flushPendingSync(){
    flushPostit();
    if(syncPushTimer){ clearTimeout(syncPushTimer); syncPushTimer=null; syncPushNow(); }
    if(crmSyncPushTimer){ clearTimeout(crmSyncPushTimer); crmSyncPushTimer=null; syncPushCrmNow(); }
    if(notesSyncPushTimer){ clearTimeout(notesSyncPushTimer); notesSyncPushTimer=null; syncPushNotesNow(); }
  }
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') flushPendingSync(); });
  // Another tab of the app (or widget.html) saved: take its version, so this tab never writes an older copy back.
  window.addEventListener('storage', e=>{
    if(!e.key || e.newValue==null || e.key.indexOf('todo_')!==0) return;
    const k=e.key.slice(5);
    // a data key written straight into localStorage by an older page: the store merges it and tells us the result
    if(e.storageArea===localStorage && window.storage.isManaged && window.storage.isManaged(k)) return;
    undoCommit();   // what came from another tab is not an action of this one: not undone here
    try{
      const v=JSON.parse(e.newValue);
      if(k===TASKS_KEY){ tasks=v; refreshAllViews(); }
      else if(k===COMPANIES_KEY){ companies=v; renderCrm(); }
      else if(k===CONTACTS_KEY){ contacts=v; renderCrm(); }
      else if(k===MEETINGS_KEY){ meetings=v; }
      else if(k===OPPS_KEY){ opportunities=v; renderCrm(); }
      else if(k===NOTES_KEY){ if(!postitDirty){ notes=v; renderNotes(); } }
      else if(k==='sync-tasks-base') tasksBaseSnapshot=v;
      else if(k==='sync-crm-base') crmBaseSnapshot=v;
      else if(k==='sync-notes-base') notesBaseSnapshot=v;
    }catch(err){}
    undoRebase();
  });
  window.addEventListener('pagehide', flushPendingSync);
  // ---------- Portefeuille through the private data repo (data/parc.json): loaded on the computer, read on the phone ----------
  // Sent only once GitHub confirms the data repo is private. The most recent import wins (importedAt); an unchanged
  // workbook (same lines) keeps its date, so the bridge's automatic refresh doesn't send it again for nothing.
  const SYNC_PARC_PATH='data/parc.json';
  let repoPrivate=null, parcSyncNote='';
  async function syncRepoIsPrivate(){
    if(repoPrivate!==null) return repoPrivate;
    try{
      const r=await fetch('https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo, { headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json' }, cache:'no-store' });
      if(!r.ok) return false;
      const d=await r.json(); repoPrivate=d.private===true; return repoPrivate;
    }catch(e){ return false; }
  }
  function parcHash(d){ const s=JSON.stringify(d&&d.items||[]); let x=2166136261; for(let i=0;i<s.length;i++){ x^=s.charCodeAt(i); x=Math.imul(x,16777619); } return (x>>>0).toString(36)+'.'+s.length; }
  function parcChanged(){ if(!$('tab-parc').classList.contains('hidden')) renderParc(); renderToday(); if(!$('tab-pipeline').classList.contains('hidden')) renderPipeline(); }
  async function syncPullParc(){
    if(!syncConfig.enabled) return;
    try{
      const r=await ghGetJson(SYNC_PARC_PATH);
      if(r.status===404){ if(parcData) setTimeout(()=>syncPushParc(null), 0); return; }   // after this read (one at a time)
      if(!r.ok || !r.json || !Array.isArray(r.json.items)) return;
      const remote=r.json, mine=parcData?(parcData.importedAt||0):0;
      if(!parcData || (remote.importedAt||0)>mine){
        parcData=remote; saveParc(); ensureRenewalTasks(); parcChanged();
      } else if(mine>(remote.importedAt||0) && parcHash(parcData)!==parcHash(remote)) await syncPushParc(r.sha);
    }catch(e){ console.error('parc sync pull failed', e); }
  }
  async function syncPushParc(sha){
    if(!syncConfig.enabled || !parcData) return;
    if(!(await syncRepoIsPrivate())){ parcSyncNote='Portefeuille gardé sur cet appareil : GitHub ne confirme pas que le repo de données est privé.'; setSyncStatus(parcSyncNote); return; }
    try{
      if(sha===undefined){
        const g=await ghGetJson(SYNC_PARC_PATH);
        if(g.ok && g.json){ if((g.json.importedAt||0)>=(parcData.importedAt||0) || parcHash(g.json)===parcHash(parcData)) return; sha=g.sha; }
      }
      const body={ message:'Sync Portefeuille', content:b64EncodeUtf8(JSON.stringify(parcData)), branch:'main' };
      if(sha) body.sha=sha;
      const res=await fetch(syncApiUrl(SYNC_PARC_PATH), { method:'PUT', headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' }, body:JSON.stringify(body) });
      syncNote(res);
    }catch(e){ console.error('parc sync push failed', e); syncNote(null); }
  }
  // a new import: same lines as before → keep the previous date (nothing new to send)
  function parcImported(next){
    if(parcData && parcHash(parcData)===parcHash(next)) next.importedAt=parcData.importedAt||next.importedAt;
    const isNew=!parcData || (next.importedAt||0)!==(parcData.importedAt||0);
    parcData=next; saveParc(); ensureRenewalTasks(); renderParc();
    if(isNew) syncPushParc();
  }

  async function syncPushNotesNow(){
    if(!syncConfig.enabled) return;
    flushPostit();
    try{
      let sha=lastKnownNotesSha;
      const getData=await ghGetJson(SYNC_NOTES_PATH);
      if(getData.ok){
        sha=getData.sha;
        const remote=getData.json;
        undoCommit(); notes=threeWayMerge('note', notes, remote, notesBaseSnapshot); undoRebase();
        consolidateNotes();
        await saveNotesLocalOnly();
        renderNotes();
      }
      await saveConflicts(); updateConflictBadge();
      const body={ message:'Sync notes', content:b64EncodeUtf8(JSON.stringify(notes)), branch:'main' };
      if(sha) body.sha=sha;
      const putRes=await fetch(syncApiUrl(SYNC_NOTES_PATH), {
        method:'PUT',
        headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' },
        body:JSON.stringify(body)
      });
      syncNote(putRes);
      if(putRes.ok){
        const putData=await putRes.json();
        lastKnownNotesSha=putData.content.sha;
        notesBaseSnapshot=notes.map(n=>({...n}));
        await saveNotesBase(); syncRetryDone('notes');
      } else syncRetryLater('notes', putRes.status, ()=>syncPushNotesNow());
    }catch(e){ console.error('notes sync push failed', e); syncNote(null); }
  }

  async function saveClients(){ try{ await window.storage.set(CLIENTS_KEY,JSON.stringify(clientsList),false); }catch(e){ console.error(e); } }
  async function saveProjects(){ try{ await window.storage.set(PROJECTS_KEY,JSON.stringify(projectsList),false); }catch(e){ console.error(e); } }

  async function checkDailyDigestNotification(){
    if(!('Notification' in window) || Notification.permission !== 'granted') return;
    const todayStr = toISO(new Date());
    let lastDate = '';
    try{ const r = await window.storage.get('last-daily-notif', false); lastDate = r && r.value ? r.value : ''; }catch(e){}
    if(lastDate === todayStr) return;

    const open = activeTasks();
    const overdue = open.filter(t=>dueStatus(t.due)==='overdue').length;
    const now = new Date(); now.setHours(0,0,0,0);
    const dueToday = open.filter(t=>{
      if(!t.due) return false;
      return new Date(t.due+'T00:00:00').getTime() === now.getTime();
    }).length;

    if(overdue > 0 || dueToday > 0){
      const parts = [];
      if(overdue > 0) parts.push(overdue + ' en retard');
      if(dueToday > 0) parts.push(dueToday + " due(s) aujourd'hui");
      new Notification('Tâches du jour', { body: parts.join(' · ') });
    }
    try{ await window.storage.set('last-daily-notif', todayStr, false); }catch(e){}
  }

  // Also escapes quotes: the result is used inside attribute values (value="…"), fed by pasted mails and synced data.
  function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function isSafeHref(url){ return /^https?:\/\//i.test(url||'') || /^mailto:/i.test(url||''); }
  function toISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

  // ---------- date fields: one-click choices under the field, and a click anywhere on it opens the calendar ----------
  function qdPresets(withTime){
    const day=n=>{ const d=new Date(); d.setDate(d.getDate()+n); return d; };
    const monday=()=>{ const d=new Date(); d.setDate(d.getDate()+((8-d.getDay())%7||7)); return d; };
    const at=(d,hh,mm)=>toISO(d)+'T'+String(hh).padStart(2,'0')+':'+String(mm||0).padStart(2,'0');
    if(!withTime) return [["Aujourd'hui",toISO(day(0))],['Demain',toISO(day(1))],['Lundi',toISO(monday())],['Dans 1 sem.',toISO(day(7))],['Dans 1 mois',toISO((d=>{ d.setMonth(d.getMonth()+1); return d; })(new Date()))]];
    const now=new Date(), inHour=new Date(now.getTime()+3600e3), tonight=at(now,18), list=[['Dans 1 h',at(inHour,inHour.getHours(),Math.ceil(inHour.getMinutes()/5)*5%60)]];
    if(now.getHours()<17) list.push(['Ce soir 18 h',tonight]);
    list.push(['Demain 9 h',at(day(1),9)],['Demain 14 h',at(day(1),14)],['Lundi 9 h',at(monday(),9)]);
    return list;
  }
  function quickDates(input){
    if(!input || input.dataset.qd) return; input.dataset.qd='1';
    const withTime=input.type==='datetime-local';
    const box=document.createElement('div'); box.className='qd';
    input.parentNode.insertBefore(box, input); box.appendChild(input);
    const chips=document.createElement('div'); chips.className='qd-chips'; box.appendChild(chips);
    const set=v=>{ input.value=v; input.dispatchEvent(new Event('input',{ bubbles:true })); input.dispatchEvent(new Event('change',{ bubbles:true })); paint(); };
    // presets are recomputed each time (« Demain » must stay right on a page left open overnight)
    const paint=()=>{
      chips.innerHTML='';
      qdPresets(withTime).forEach(([label,v])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=label; b.title=withTime?v.replace('T',' à '):pqIsoToFr(v); if(input.value===v) b.className='on'; b.onclick=e=>{ e.preventDefault(); set(v); }; chips.appendChild(b); });
      if(input.value){ const c=document.createElement('button'); c.type='button'; c.className='qd-clear'; c.textContent='✕'; c.title='Effacer la date'; c.onclick=e=>{ e.preventDefault(); set(''); }; chips.appendChild(c); }
    };
    input.addEventListener('click', ()=>{ try{ input.showPicker(); }catch(e){} });
    input.addEventListener('input', paint); input.addEventListener('change', paint); input.addEventListener('focus', paint);
    paint();
    // values set by code (form reset, edit) don't fire events: repaint the highlight when they change
    const desc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
    Object.defineProperty(input,'value',{ configurable:true, get(){ return desc.get.call(this); }, set(v){ desc.set.call(this,v); paint(); } });
  }
  function hashColor(name,pal){ if(!name)return null; let h=0; for(let i=0;i<name.length;i++){h=(h*31+name.charCodeAt(i))>>>0;} return pal[h%pal.length]; }
  const clientColor=n=>{
    if(!n) return null;
    const co=companies.find(x=>x.name===n);
    if(co && co.type) return hashColor(co.type, CLIENT_PALETTE);
    return hashColor(n, CLIENT_PALETTE);
  };
  const projectColor=n=>hashColor(n,PROJECT_PALETTE);
  // date formats made once (toLocaleDateString builds a new formatter at every call: slow on long lists)
  const DF_DM=new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit'}), DF_DMY=new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}), DF_HM=new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'});
  function fmtDateShort(d){ if(!d)return null; return DF_DM.format(new Date(d+'T00:00:00')); }
  function fmtDateTime(ts){ const dt=new Date(ts); return DF_DMY.format(dt)+' '+DF_HM.format(dt); }
  function dueStatus(due){ if(!due)return ''; const t=new Date();t.setHours(0,0,0,0); const d=new Date(due+'T00:00:00'); const diff=Math.round((d-t)/86400000); if(diff<0)return 'overdue'; if(diff<=2)return 'soon'; return ''; }

  function activeTasks(){ return tasks.filter(t=>!t.archived && !t.deleted); }
  function matchesSearch(t){
    if(!searchQuery) return true;
    const q=searchQuery.toLowerCase();
    return [t.title,t.description,t.client,t.project].some(v=>v&&v.toLowerCase().includes(q))
      || (t.subtasks||[]).some(st=>st.text&&st.text.toLowerCase().includes(q));
  }
  function sortedTasks(list){
    return [...list].sort((a,b)=>{
      const ra=URGENCY_RANK[a.urgency]??4, rb=URGENCY_RANK[b.urgency]??4;
      if(ra!==rb)return ra-rb;
      const da=a.due?new Date(a.due).getTime():Infinity, db=b.due?new Date(b.due).getTime():Infinity;
      return da-db;
    });
  }
  function filteredTasks(){
    let list=activeTasks().filter(matchesSearch);
    if(savedViewState.tasks && savedViewState.tasks.pred) list=list.filter(savedViewState.tasks.pred);
    if(currentFilter==='critique') list=list.filter(t=>t.urgency==='critique');
    else if(currentFilter==='haute') list=list.filter(t=>t.urgency==='haute'||t.urgency==='critique');
    return sortedTasks(list);
  }
  function listForCurrentView(){
    if(currentView==='bloc'){
      let list=activeTasks().filter(matchesSearch);
      if(savedViewState.tasks && savedViewState.tasks.pred) list=list.filter(savedViewState.tasks.pred);
      if(currentFilter==='critique') list=list.filter(t=>t.urgency==='critique');
      else if(currentFilter==='haute') list=list.filter(t=>t.urgency==='haute'||t.urgency==='critique');
      return sortedTasks(list);
    }
    return filteredTasks();
  }
  function refreshDatalists(){
    clientDatalist.innerHTML=clientsList.slice().sort().map(c=>'<option value="'+escapeHtml(c)+'">').join('');
    projectDatalist.innerHTML=projectsList.slice().sort().map(p=>'<option value="'+escapeHtml(p)+'">').join('');
  }

  function hexToRgb(hex){ const v=hex.replace('#',''); return { r:parseInt(v.substring(0,2),16), g:parseInt(v.substring(2,4),16), b:parseInt(v.substring(4,6),16) }; }

  // Outlook deep links (outlook:<EntryID>) only work with classic Outlook's
  // registered protocol handler. The new Outlook client doesn't register it,
  // so browsers just navigate to a blank page. Fall back to a "copy subject"
  // button so the mail can be found via Outlook's own search instead.
  function makeLinkOrCopyBtn(t){
    if(t.link.indexOf('outlook:') === 0 || !isSafeHref(t.link)){
      const btn=document.createElement('button'); btn.type='button';
      btn.title="Copier l'objet (Ctrl+E dans Outlook pour chercher)";
      btn.innerHTML='<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
      btn.onclick=e=>{
        e.stopPropagation();
        navigator.clipboard.writeText(plainLinks(t.title)).then(()=>{
          const prev=btn.innerHTML;
          btn.innerHTML='<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
          setTimeout(()=>{ btn.innerHTML=prev; }, 1200);
        }).catch(()=>{});
      };
      return btn;
    }
    const a=document.createElement('a'); a.href=t.link; a.target='_blank'; a.rel='noopener noreferrer'; a.title='Mail lié'; a.onclick=e=>e.stopPropagation();
    a.innerHTML='<svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    return a;
  }

  function makeTag(label, hex, shape){
    const span=document.createElement('span');
    span.className='meta-tag'+(shape==='flag'?' flag':'');
    const rgb=hexToRgb(hex);
    span.style.color=hex;
    span.style.background='rgba('+rgb.r+','+rgb.g+','+rgb.b+',.16)';
    span.style.border='1px solid rgba('+rgb.r+','+rgb.g+','+rgb.b+',.4)';
    if(shape==='flag'){ span.style.borderLeft='3px solid '+hex; }
    else if(shape==='dot'){ const dot=document.createElement('span'); dot.className='tag-dot'; dot.style.background=hex; span.appendChild(dot); }
    span.appendChild(document.createTextNode(label));
    return span;
  }
  function makeSolidTag(label, hex, onClick){
    const span=document.createElement('span');
    span.className='meta-tag solid';
    span.style.background=hex; span.style.color='#04070C';
    span.textContent=label;
    if(onClick) span.onclick=onClick;
    return span;
  }

  function buildTaskRow(t){
    if(t.id===editingId) return buildEditRow(t);
    const row=document.createElement('div');
    row.className='task'+(t.id===selectedTaskId?' selected':'');
    row.dataset.id=t.id;

    const uColor=(URGENCY_META[t.urgency]||URGENCY_META.moyenne).color;
    const check=document.createElement('div');
    check.className='task-check'; check.style.borderColor=uColor; check.title='Valider';
    check.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    check.onclick=e=>{ e.stopPropagation(); validateTask(t.id); };
    row.appendChild(check);

    const body=document.createElement('div'); body.className='task-body';

    const title=document.createElement('div');
    title.className='task-title-compact';
    if(t.title.includes('[[')) renderLinked(title, t.title); else title.textContent=t.title;
    const nSub=(t.subtasks||[]).length;
    if(nSub){
      const done=t.subtasks.filter(s=>s.done).length;
      const b=document.createElement('span'); b.className='subtask-badge'; b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:9px;height:9px;vertical-align:-1px;margin-right:2px;"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/></svg>'+done+'/'+nSub;
      title.appendChild(b);
      const arrow=document.createElement('button'); arrow.type='button';
      arrow.className='subtask-arrow'+(expandedSubtaskIds.has(t.id)?' open':'');
      arrow.title='Voir les sous-tâches';
      arrow.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
      arrow.onclick=e=>{ e.stopPropagation(); toggleSubtasksExpanded(t.id); };
      title.appendChild(arrow);
    }
    title.onclick=()=>openEdit(t.id);
    body.appendChild(title);

    if(t.description){
      const desc=document.createElement('div'); desc.className='task-desc'; if(t.description.includes('[[')) renderLinked(desc, t.description); else desc.textContent=t.description;
      body.appendChild(desc);
    }

    if(nSub && expandedSubtaskIds.has(t.id)){
      const subList=document.createElement('div'); subList.className='subtask-inline-list';
      t.subtasks.forEach(s=>{
        const row2=document.createElement('div'); row2.className='subtask-inline-row';
        const chk=document.createElement('div'); chk.className='subtask-inline-check'+(s.done?' on':'');
        chk.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
        chk.onclick=e=>{ e.stopPropagation(); s.done=!s.done; touch(t); saveTasks(); render(); };
        const label=document.createElement('span'); label.className='subtask-inline-label'+(s.done?' done':''); label.textContent=s.text;
        row2.appendChild(chk); row2.appendChild(label);
        subList.appendChild(row2);
      });
      body.appendChild(subList);
    }

    const meta=document.createElement('div'); meta.className='task-meta-compact';
    if(t.recur){ const r=document.createElement('span'); r.title='Récurrente'; r.innerHTML='<svg class="recur-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'; meta.appendChild(r); }
    const sMeta=STATUS_META[t.status]||STATUS_META.a_faire;
    meta.appendChild(makeSolidTag(sMeta.label, sMeta.color, e=>{ e.stopPropagation(); cycleStatus(t.id); }));
    const uMeta=URGENCY_META[t.urgency]||URGENCY_META.moyenne;
    meta.appendChild(makeTag(uMeta.label, uMeta.color));
    if(t.client) meta.appendChild(makeTag(t.client, clientColor(t.client), 'dot'));
    if(t.project) meta.appendChild(makeTag(t.project, projectColor(t.project), 'flag'));
    if(t.due){ const st=dueStatus(t.due); const d=document.createElement('span'); d.className='meta-date-compact'+(st?' '+st:''); d.textContent=fmtDateShort(t.due); meta.appendChild(d); }
    if(t.link){ meta.appendChild(makeLinkOrCopyBtn(t)); }
    body.appendChild(meta);

    row.appendChild(body);

    const actions=document.createElement('div'); actions.className='task-actions-compact';
    const snoozeBtn=document.createElement('button'); snoozeBtn.title='Reporter';
    snoozeBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    snoozeBtn.onclick=e=>openSnoozePopover(e,t.id);
    actions.appendChild(snoozeBtn);
    row.appendChild(actions);
    return row;
  }

  let activeInlinePopover=null;
  function closeInlinePopover(){ if(activeInlinePopover){ activeInlinePopover.remove(); activeInlinePopover=null; } }

  function openUrgencyPopover(e, taskId){
    e.stopPropagation();
    closeInlinePopover();
    const t=tasks.find(x=>x.id===taskId);
    if(!t) return;

    const pop=document.createElement('div'); pop.className='combo-dropdown open';
    pop.style.position='fixed'; pop.style.right='auto';
    const rect=e.currentTarget.getBoundingClientRect();
    pop.style.top=Math.min(rect.bottom+4, window.innerHeight-180)+'px';
    pop.style.left=Math.max(8, Math.min(rect.left, window.innerWidth-150))+'px';
    pop.style.minWidth='130px'; pop.style.padding='5px'; pop.style.zIndex=10001;

    ['critique','haute','moyenne','basse'].forEach(key=>{
      const meta=URGENCY_META[key];
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 8px;font-size:12.5px;color:var(--tx1);cursor:pointer;border-radius:5px;';
      row.onmouseenter=()=>row.style.background='var(--panel-2)';
      row.onmouseleave=()=>row.style.background='';
      const dot=document.createElement('span'); dot.style.cssText='width:9px;height:9px;border-radius:50%;background:'+meta.color+';flex-shrink:0;';
      row.appendChild(dot); row.appendChild(document.createTextNode(meta.label));
      if(t.urgency===key){ row.style.fontWeight='700'; const check=document.createElement('span'); check.textContent='✓'; check.style.marginLeft='auto'; check.style.color=meta.color; row.appendChild(check); }
      row.onclick=ev=>{
        ev.stopPropagation();
        t.urgency=key; touch(t); saveTasks(); render();
        closeInlinePopover();
      };
      pop.appendChild(row);
    });

    document.body.appendChild(pop);
    activeInlinePopover=pop;
  }


  document.addEventListener('click', e=>{ if(activeInlinePopover && !activeInlinePopover.contains(e.target)) closeInlinePopover(); }, true);

  function openInlineFieldPopover(e, task, field, list, colorFn){
    e.stopPropagation();
    closeInlinePopover();
    closeSnoozePopover();
    const pop=document.createElement('div');
    pop.className='combo-dropdown open';
    pop.style.position='fixed'; pop.style.right='auto';
    const rect=e.currentTarget.getBoundingClientRect();
    pop.style.top=Math.min(rect.bottom+4, window.innerHeight-220)+'px';
    pop.style.left=Math.max(8, Math.min(rect.left, window.innerWidth-200))+'px';
    pop.style.minWidth='180px';
    pop.style.zIndex=10001;

    const input=document.createElement('input');
    input.type='text';
    input.value=task[field]||'';
    input.placeholder=field==='client'?'Client':'Projet';
    input.style.cssText='width:100%;padding:7px 9px;background:var(--panel);border:1px solid var(--bd);border-radius:4px;color:var(--tx1);font-size:12px;box-sizing:border-box;';
    const itemsWrap=document.createElement('div');
    itemsWrap.style.cssText='max-height:150px;overflow-y:auto;margin-top:4px;';

    function apply(name){
      name=name.trim();
      if(name){
        const existing=findExistingCI(list, name);
        task[field]=existing||name;
        if(!existing){ list.push(name); field==='client'?saveClients():saveProjects(); }
      } else {
        task[field]='';
      }
      touch(task); saveTasks(); render();
      closeInlinePopover();
    }

    function renderItems(){
      const q=input.value.trim().toLowerCase();
      itemsWrap.innerHTML='';
      const matches=list.slice().sort().filter(n=>n.toLowerCase().includes(q));
      if(task[field]){
        const clearRow=document.createElement('div'); clearRow.className='combo-item'; clearRow.style.color='var(--tx3)';
        clearRow.textContent='✕ Retirer';
        clearRow.onclick=()=>apply('');
        itemsWrap.appendChild(clearRow);
      }
      matches.forEach(name=>{
        const row=document.createElement('div'); row.className='combo-item';
        const dot=document.createElement('span'); dot.className='combo-item-dot'; dot.style.background=colorFn(name);
        const label=document.createElement('span'); label.className='combo-item-label'; label.textContent=name;
        row.appendChild(dot); row.appendChild(label);
        row.onclick=()=>apply(name);
        itemsWrap.appendChild(row);
      });
    }
    input.addEventListener('input', renderItems);
    input.addEventListener('keydown', ev=>{ if(ev.key==='Enter') apply(input.value); if(ev.key==='Escape') closeInlinePopover(); });

    pop.appendChild(input);
    pop.appendChild(itemsWrap);
    document.body.appendChild(pop);
    activeInlinePopover=pop;
    renderItems();
    input.focus(); input.select();
  }

  function buildTableRow(t, rowNum){
    if(t.id===editingId) return buildEditRow(t);
    const row=document.createElement('div');
    row.className='task-line'+(t.id===selectedTaskId?' selected':'');
    row.dataset.id=t.id;

    const grid=document.createElement('div'); grid.className='task-row-grid';

    const numSpan=document.createElement('span'); numSpan.className='row-num'; numSpan.textContent=rowNum||'';
    grid.appendChild(numSpan);

    const uColor=(URGENCY_META[t.urgency]||URGENCY_META.moyenne).color;
    const check=document.createElement('div');
    check.className='task-check'; check.style.borderColor=uColor; check.title='Valider';
    check.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    check.onclick=e=>{ e.stopPropagation(); validateTask(t.id); };
    grid.appendChild(check);

    const hasExpand=!!t.description || (t.subtasks||[]).length>0;
    const titleWrap=document.createElement('div'); titleWrap.className='td-title';
    const titleText=document.createElement('span'); titleText.className='td-title-text'; if(t.title.includes('[[')) renderLinked(titleText, t.title); else titleText.textContent=t.title;
    titleWrap.appendChild(titleText);
    if((t.subtasks||[]).length){
      const done=t.subtasks.filter(s=>s.done).length;
      const b=document.createElement('span'); b.className='subtask-badge'; b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:9px;height:9px;vertical-align:-1px;margin-right:2px;"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/></svg>'+done+'/'+t.subtasks.length;
      titleWrap.appendChild(b);
    }
    if(t.recur){ const r=document.createElement('span'); r.title='Récurrente'; r.style.marginLeft='6px'; r.innerHTML='<svg class="recur-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'; titleWrap.appendChild(r); }
    if(t.opportunityId){
      const link=document.createElement('span'); link.className='opp-task-link'; link.style.marginLeft='6px';
      link.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><line x1="4" y1="22" x2="4" y2="15"/><line x1="4" y1="11" x2="4" y2="2"/><line x1="12" y1="22" x2="12" y2="13"/><line x1="12" y1="9" x2="12" y2="2"/><circle cx="4" cy="13" r="2"/><circle cx="12" cy="11" r="2"/></svg>';
      link.title='Voir l\u2019opportunité liée';
      link.onclick=e=>{ e.stopPropagation(); document.querySelector('[data-tab="pipeline"]').click(); setTimeout(()=>openOppDetail(t.opportunityId),50); };
      titleWrap.appendChild(link);
    }
    if(hasExpand){
      const arrow=document.createElement('button'); arrow.type='button';
      arrow.className='subtask-arrow'+(expandedSubtaskIds.has(t.id)?' open':'');
      arrow.title='Voir plus';
      arrow.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
      arrow.onclick=e=>{ e.stopPropagation(); toggleSubtasksExpanded(t.id); };
      titleWrap.appendChild(arrow);
    }
    titleWrap.onclick=()=>openEdit(t.id);
    grid.appendChild(titleWrap);

    const clientTag=t.client ? makeTag(t.client, clientColor(t.client), 'dot') : makeTag('+ Client', '#6B7480');
    clientTag.style.cursor='pointer'; clientTag.title=t.client?t.client+' — cliquer pour changer le client':'Cliquer pour choisir le client';   // the full name when the chip is cut
    if(t.client) clientTag.dataset.peek='co:'+t.client;
    clientTag.onclick=e=>openInlineFieldPopover(e, t, 'client', clientsList, clientColor);
    grid.appendChild(clientTag);

    const projectTag=t.project ? makeTag(t.project, projectColor(t.project), 'flag') : makeTag('+ Projet', '#6B7480');
    if(t.project) projectTag.title=t.project;
    projectTag.style.cursor='pointer'; projectTag.title='Cliquer pour changer le projet';
    projectTag.onclick=e=>openInlineFieldPopover(e, t, 'project', projectsList, projectColor);
    grid.appendChild(projectTag);

    const sMeta=STATUS_META[t.status]||STATUS_META.a_faire;
    const sTag=makeSolidTag(sMeta.label, sMeta.color, e=>{ e.stopPropagation(); cycleStatus(t.id); });
    sTag.title='Cliquer pour changer le statut';
    grid.appendChild(sTag);

    const uMeta=URGENCY_META[t.urgency]||URGENCY_META.moyenne;
    const uTag=makeSolidTag(uMeta.label, uMeta.color, e=>openUrgencyPopover(e, t.id));
    uTag.title='Cliquer pour changer l\u2019urgence';
    grid.appendChild(uTag);

    const st=dueStatus(t.due);
    const dateTag=document.createElement('span');
    dateTag.className='meta-date-compact task-date-tag'+(st?' '+st:'');
    dateTag.style.cursor='pointer';
    dateTag.title='Cliquer pour changer la deadline';
    dateTag.textContent=t.due ? fmtDateShort(t.due) : '+ Date';
    dateTag.onclick=e=>openSnoozePopover(e, t.id);
    grid.appendChild(dateTag);

    const mailWrap=document.createElement('span'); mailWrap.className='task-mail-icon';
    if(t.link){ mailWrap.appendChild(makeLinkOrCopyBtn(t)); }
    grid.appendChild(mailWrap);

    row.appendChild(grid);

    if(hasExpand && expandedSubtaskIds.has(t.id)){
      const expandWrap=document.createElement('div'); expandWrap.className='task-expand';
      if(t.description){ const desc=document.createElement('div'); desc.className='task-desc'; desc.textContent=t.description; expandWrap.appendChild(desc); }
      if((t.subtasks||[]).length){
        const subList=document.createElement('div'); subList.className='subtask-inline-list';
        t.subtasks.forEach(s=>{
          const r=document.createElement('div'); r.className='subtask-inline-row';
          const chk=document.createElement('div'); chk.className='subtask-inline-check'+(s.done?' on':'');
          chk.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
          chk.onclick=e=>{ e.stopPropagation(); s.done=!s.done; touch(t); saveTasks(); render(); };
          const label=document.createElement('span'); label.className='subtask-inline-label'+(s.done?' done':''); label.textContent=s.text;
          r.appendChild(chk); r.appendChild(label);
          subList.appendChild(r);
        });
        expandWrap.appendChild(subList);
      }
      row.appendChild(expandWrap);
    }

    return row;
  }

  function buildEditRow(t){
    const row=document.createElement('div'); row.className='task editing'; row.dataset.id=t.id;
    const f=document.createElement('div'); f.className='edit-form';
    f.innerHTML=
      '<input type="text" class="e-title" placeholder="Titre" value="'+escapeHtml(t.title)+'">'+
      '<textarea class="e-desc" placeholder="Description">'+escapeHtml(t.description||'')+'</textarea>'+
      '<div class="form-row"><input type="text" class="e-client" list="client-datalist" placeholder="Client" value="'+escapeHtml(t.client||'')+'"><input type="text" class="e-project" list="project-datalist" placeholder="Projet" value="'+escapeHtml(t.project||'')+'"></div>'+
      '<div class="form-row"><input type="date" class="e-due" value="'+(t.due||'')+'">'+
      '<select class="e-status"><option value="a_faire"'+(t.status==='a_faire'?' selected':'')+'>À faire</option><option value="en_cours"'+(t.status==='en_cours'?' selected':'')+'>En cours</option><option value="en_attente"'+(t.status==='en_attente'?' selected':'')+'>En attente</option></select></div>'+
      '<div class="form-row"><select class="e-urgency"><option value="basse"'+(t.urgency==='basse'?' selected':'')+'>Basse</option><option value="moyenne"'+(t.urgency==='moyenne'?' selected':'')+'>Moyenne</option><option value="haute"'+(t.urgency==='haute'?' selected':'')+'>Haute</option><option value="critique"'+(t.urgency==='critique'?' selected':'')+'>Critique</option></select>'+
      '<input type="url" class="e-link" placeholder="Mail" value="'+escapeHtml(t.link||'')+'"></div>'+
      '<div class="subtasks-edit"></div>'+
      '<button class="add-subtask-btn" type="button">+ sous-tâche</button>'+
      '<div class="edit-btn-row"><button class="edit-cancel" type="button">Annuler</button><button class="edit-save" type="button">Enregistrer</button></div>';
    row.appendChild(f);
    quickDates(f.querySelector('.e-due'));

    const stWrap=f.querySelector('.subtasks-edit');
    let localSubs=(t.subtasks||[]).map(s=>({...s, text:s.text!=null?s.text:String(s.title||s.label||'')}));
    function renderSubs(){
      stWrap.innerHTML='';
      localSubs.forEach((s,i)=>{
        const r=document.createElement('div'); r.className='subtask-edit-row';
        const c=document.createElement('div'); c.className='st-check'+(s.done?' on':'');
        c.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
        c.onclick=()=>{ localSubs[i].done=!localSubs[i].done; renderSubs(); };
        const inp=document.createElement('input'); inp.type='text'; inp.value=s.text||''; inp.placeholder='Sous-tâche';
        inp.oninput=()=>{ localSubs[i].text=inp.value; };
        const d=document.createElement('button'); d.className='st-del'; d.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        d.onclick=()=>{ localSubs.splice(i,1); renderSubs(); };
        r.appendChild(c); r.appendChild(inp); r.appendChild(d); stWrap.appendChild(r);
      });
    }
    renderSubs();
    f.querySelector('.add-subtask-btn').onclick=()=>{ localSubs.push({text:'',done:false}); renderSubs(); stWrap.querySelector('.subtask-edit-row:last-child input').focus(); };

    f.querySelector('.edit-cancel').onclick=()=>{ editingId=null; render(); };
    f.querySelector('.edit-save').onclick=()=>{
      t.title=f.querySelector('.e-title').value.trim()||t.title;
      t.description=f.querySelector('.e-desc').value.trim();
      t.client=f.querySelector('.e-client').value.trim();
      t.project=f.querySelector('.e-project').value.trim();
      t.due=f.querySelector('.e-due').value;
      t.status=f.querySelector('.e-status').value;
      t.urgency=f.querySelector('.e-urgency').value;
      t.link=f.querySelector('.e-link').value.trim();
      t.subtasks=localSubs.filter(s=>String(s.text||'').trim()).map(s=>({text:String(s.text).trim(),done:!!s.done}));
      if(t.client){ const existing=findExistingCI(clientsList,t.client); if(existing){ t.client=existing; } else { clientsList.push(t.client); saveClients(); } }
      if(t.project){ const existing=findExistingCI(projectsList,t.project); if(existing){ t.project=existing; } else { projectsList.push(t.project); saveProjects(); } }
      touch(t);
      editingId=null; saveTasks(); render(); renderLists();
    };
    setTimeout(()=>f.querySelector('.e-title').focus(),0);
    return row;
  }

  function openEdit(id){ editingId=id; render(); }

  function makeGroupHeader(label,color,count){
    const d=document.createElement('div'); d.className='group-header';
    if(color) d.style.color=color;
    d.textContent=label;
    if(count!=null){ const c=document.createElement('span'); c.className='group-count'; c.textContent='· '+count; d.appendChild(c); }
    return d;
  }

  let rowCounter=1;
  function renderListView(list){ applyTableSort(list).forEach(t=>taskList.appendChild(buildTableRow(t, rowCounter++))); }
  function renderGrouped(list,keyFn,colorFn,noneLabel){
    const groups={};
    list.forEach(t=>{ const k=keyFn(t)||noneLabel; (groups[k]=groups[k]||[]).push(t); });
    Object.keys(groups).sort((a,b)=>{ if(a===noneLabel)return 1; if(b===noneLabel)return -1; return a.localeCompare(b); }).forEach(k=>{
      taskList.appendChild(makeGroupHeader(k,k===noneLabel?null:colorFn(k),groups[k].length));
      groups[k].forEach(t=>taskList.appendChild(buildTableRow(t, rowCounter++)));
    });
  }
  function renderByUrgency(list){
    URGENCY_ORDER.forEach(u=>{ const items=list.filter(t=>t.urgency===u); if(!items.length)return; taskList.appendChild(makeGroupHeader(URGENCY_META[u].label,URGENCY_META[u].color,items.length)); items.forEach(t=>taskList.appendChild(buildTableRow(t, rowCounter++))); });
  }
  function renderByDate(list){
    const today=new Date(); today.setHours(0,0,0,0);
    const b={overdue:[],today:[],week:[],later:[],none:[]};
    list.forEach(t=>{ if(!t.due){b.none.push(t);return;} const d=new Date(t.due+'T00:00:00'); const diff=Math.round((d-today)/86400000); if(diff<0)b.overdue.push(t); else if(diff===0)b.today.push(t); else if(diff<=7)b.week.push(t); else b.later.push(t); });
    [['overdue','En retard','#ED6965'],['today',"Aujourd'hui",'#14D3A9'],['week','Cette semaine',null],['later','Plus tard',null],['none','Sans date',null]].forEach(([k,l,c])=>{ if(!b[k].length)return; taskList.appendChild(makeGroupHeader(l,c,b[k].length)); b[k].forEach(t=>taskList.appendChild(buildTableRow(t, rowCounter++))); });
  }
  function renderBloc(list){
    STATUS_CYCLE.forEach(s=>{
      const col=document.createElement('div'); col.className='kanban-col';
      const items=list.filter(t=>t.status===s);
      const h=document.createElement('div'); h.className='kanban-col-header'; h.style.color=STATUS_META[s].color; h.textContent=STATUS_META[s].label+' · '+items.length; col.appendChild(h);
      const body=document.createElement('div'); body.className='kanban-col-body'; items.forEach(t=>body.appendChild(buildTaskRow(t))); col.appendChild(body);
      taskList.appendChild(col);
    });
  }

  let tableSort={ field:null, dir:'asc' };
  function applyTableSort(list){
    if(!tableSort.field) return list;
    const dir=tableSort.dir==='asc'?1:-1;
    return [...list].sort((a,b)=>{
      let av,bv;
      switch(tableSort.field){
        case 'title': av=a.title.toLowerCase(); bv=b.title.toLowerCase(); break;
        case 'client': av=(a.client||'').toLowerCase(); bv=(b.client||'').toLowerCase(); break;
        case 'project': av=(a.project||'').toLowerCase(); bv=(b.project||'').toLowerCase(); break;
        case 'status': av=STATUS_CYCLE.indexOf(a.status); bv=STATUS_CYCLE.indexOf(b.status); break;
        case 'urgency': av=URGENCY_RANK[a.urgency]??4; bv=URGENCY_RANK[b.urgency]??4; break;
        case 'due': av=a.due?new Date(a.due).getTime():Infinity; bv=b.due?new Date(b.due).getTime():Infinity; break;
        default: av=0; bv=0;
      }
      if(av<bv) return -1*dir; if(av>bv) return 1*dir; return 0;
    });
  }
  function updateSortHeaderUI(){
    tableHeader.querySelectorAll('.th-col').forEach(el=>{
      el.classList.toggle('sorted', el.dataset.sort===tableSort.field);
      el.querySelector('.th-sort-arrow')?.remove();
      if(el.dataset.sort===tableSort.field){
        const arrow=document.createElement('span'); arrow.className='th-sort-arrow'; arrow.textContent=tableSort.dir==='asc'?'▾':'▴';
        el.appendChild(arrow);
      }
    });
  }

  function render(){
    if(window.__widgetCount) window.__widgetCount();
    const list=listForCurrentView();
    taskList.className=currentView==='bloc'?'view-bloc':'';
    taskList.innerHTML='';
    rowCounter=1;
    tableHeader.style.display=currentView==='bloc'?'none':'grid';
    updateSortHeaderUI();
    if(list.length===0&&currentView!=='bloc'){ const e=document.createElement('div'); e.className='empty-state'; e.textContent=searchQuery?'Aucun résultat.':'Rien ici.'; taskList.appendChild(e); }
    else if(currentView==='liste') renderListView(list);
    else if(currentView==='client') renderGrouped(list,t=>t.client,clientColor,'Sans client');
    else if(currentView==='projet') renderGrouped(list,t=>t.project,projectColor,'Sans projet');
    else if(currentView==='urgence') renderByUrgency(list);
    else if(currentView==='date') renderByDate(list);
    else if(currentView==='bloc') renderBloc(list);
    updateBadge(); refreshDatalists();
    if(typeof renderToday==='function') renderToday();
  }

  // ===== Gmail inbox queue (data/tasks-inbox.json, written by the GitHub Action) =====
  let inboxItems = [];
  let inboxSeenIds = new Set();
  let contactInboxSeenIds = new Set();

  async function loadSeenIds(){
    try{ const r = await window.storage.get('inbox-seen-ids', false); inboxSeenIds = new Set(r && r.value ? JSON.parse(r.value) : []); }
    catch(e){ inboxSeenIds = new Set(); }
    try{ const r = await window.storage.get('contact-inbox-seen-ids', false); contactInboxSeenIds = new Set(r && r.value ? JSON.parse(r.value) : []); }
    catch(e){ contactInboxSeenIds = new Set(); }
  }
  async function saveSeenIds(){ try{ await window.storage.set('inbox-seen-ids', JSON.stringify([...inboxSeenIds]), false); }catch(e){} }
  async function saveContactSeenIds(){ try{ await window.storage.set('contact-inbox-seen-ids', JSON.stringify([...contactInboxSeenIds]), false); }catch(e){} }

  async function fetchInbox(){
    if(!syncConfig.enabled){ inboxItems = []; renderInbox(); return; }
    try{
      const url='https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo+'/contents/'+INBOX_FILE_PATH;
      const res = await fetch(url, { headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json' } });
      if(!res.ok) throw new Error('no inbox file');
      const data = await res.json();
      inboxItems = JSON.parse(b64DecodeUtf8(data.content));
    }catch(e){
      inboxItems = [];
    }
    renderInbox();
  }

  function pendingInboxItems(){ return inboxItems.filter(it => !inboxSeenIds.has(it.id)); }

  function updateInboxBadge(){
    const n = pendingInboxItems().length;
    $('inbox-badge').textContent = n > 0 ? n : '';
  }

  function renderInbox(){
    const list = $('inbox-list');
    list.innerHTML = '';
    const pending = pendingInboxItems();
    updateInboxBadge();
    if(!pending.length){
      const e = document.createElement('div'); e.className = 'empty-state';
      e.textContent = 'Rien en attente. Les mails flaggés dans Outlook apparaîtront ici.';
      list.appendChild(e);
      return;
    }
    pending.slice().reverse().forEach(it=>{
      const row = document.createElement('div'); row.className = 'inbox-item';
      const title = document.createElement('div'); title.className = 'inbox-item-title'; title.textContent = it.title; row.appendChild(title);
      if(it.sender){ const s = document.createElement('div'); s.className = 'inbox-item-sender'; s.textContent = it.sender; row.appendChild(s); }
      if(it.client || it.project || it.urgency || it.due){
        const meta = document.createElement('div'); meta.className = 'task-meta-compact'; meta.style.marginBottom = '8px';
        if(it.client) meta.appendChild(makeTag(it.client, clientColor(it.client), 'dot'));
        if(it.project) meta.appendChild(makeTag(it.project, projectColor(it.project), 'flag'));
        if(it.urgency){ const u = URGENCY_META[it.urgency] || URGENCY_META.moyenne; const tag = document.createElement('span'); tag.className = 'meta-date-compact'; tag.style.color = u.color; tag.textContent = u.label; meta.appendChild(tag); }
        if(it.due){ const d = document.createElement('span'); d.className = 'meta-date-compact'; d.textContent = fmtDateShort(it.due); meta.appendChild(d); }
        row.appendChild(meta);
      }
      if(it.description){ const d = document.createElement('div'); d.className = 'inbox-item-desc'; d.textContent = it.description; row.appendChild(d); }
      const actions = document.createElement('div'); actions.className = 'inbox-item-actions';
      const importBtn = document.createElement('button'); importBtn.className = 'inbox-import-btn'; importBtn.textContent = 'Importer comme tâche';
      importBtn.onclick = ()=> importInboxItem(it);
      actions.appendChild(importBtn);
      const ignoreBtn = document.createElement('button'); ignoreBtn.className = 'inbox-ignore-btn'; ignoreBtn.textContent = 'Ignorer';
      ignoreBtn.onclick = ()=> dismissInboxItem(it.id);
      actions.appendChild(ignoreBtn);
      if(it.link && isSafeHref(it.link)){ const a = document.createElement('a'); a.className = 'inbox-item-link'; a.href = it.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'ouvrir le mail ↗'; actions.appendChild(a); }
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  const INBOX_FILE_PATH='data/tasks-inbox.json';
  const CONTACT_INBOX_FILE_PATH='data/contacts-inbox.json';

  async function removeFromInboxOnGitHub(itemId){
    if(!syncConfig.enabled) return;
    try{
      const url='https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo+'/contents/'+INBOX_FILE_PATH;
      const getRes=await fetch(url, { headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json' } });
      if(!getRes.ok) return;
      const getData=await getRes.json();
      const currentItems=JSON.parse(b64DecodeUtf8(getData.content));
      const filtered=currentItems.filter(x=>x.id!==itemId);
      if(filtered.length===currentItems.length) return;
      const body={ message:'Remove imported inbox item', content:b64EncodeUtf8(JSON.stringify(filtered)), sha:getData.sha, branch:'main' };
      await fetch(url, { method:'PUT', headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' }, body:JSON.stringify(body) });
    }catch(e){ console.error('failed to remove inbox item from GitHub', e); }
  }

  function importInboxItem(it){
    createTask({
      title: it.title,
      description: it.description || '',
      link: it.link || '',
      client: it.client || '',
      project: it.project || '',
      urgency: it.urgency || 'moyenne',
      status: 'a_faire',
      due: it.due || ''
    });
    inboxSeenIds.add(it.id); saveSeenIds();
    render(); renderLists(); renderInbox();
    removeFromInboxOnGitHub(it.id);
  }
  function dismissInboxItem(id){
    inboxSeenIds.add(id); saveSeenIds();
    renderInbox();
    removeFromInboxOnGitHub(id);
  }

  $('inbox-refresh').onclick = fetchInbox;

  // no GitHub sync and no backup file for a month: a gentle reminder at the top of Today (« Plus tard » = a week of peace)
  const BACKUP_DAYS=30;
  function backupDueDays(){
    if(syncConfig.enabled || window.TODO_LITE || window.TODO_WIDGET) return 0;
    const get=k=>{ try{ return +localStorage.getItem(k)||0; }catch(e){ return 0; } };
    let first=get('first-seen-at'); if(!first){ first=Date.now(); try{ localStorage.setItem('first-seen-at', String(first)); }catch(e){} }
    if(Date.now()<get('backup-snooze-until') || !(tasks.length+contacts.length+opportunities.length)) return 0;
    const days=Math.floor((Date.now()-(get('last-export-at')||first))/864e5);
    return days>=BACKUP_DAYS?days:0;
  }
  function renderBackupBanner(){
    let b=$('backup-banner'); const days=backupDueDays();
    if(!days){ if(b) b.remove(); return; }
    if(!b){ b=document.createElement('div'); b.id='backup-banner'; b.className='backup-banner'; $('today-stats-row').before(b); }
    b.innerHTML='<span></span><button type="button" class="bk-go">Exporter maintenant</button><button type="button" class="bk-later">Plus tard</button>';
    b.firstChild.textContent=('Aucune copie de sécurité depuis '+days+' jours, et la synchro GitHub n\u2019est pas activée : un export garde tes données à l\u2019abri (fichier .json).');
    b.querySelector('.bk-go').onclick=()=>{ exportData(); renderBackupBanner(); };
    b.querySelector('.bk-later').onclick=()=>{ try{ localStorage.setItem('backup-snooze-until', String(Date.now()+7*864e5)); }catch(e){} renderBackupBanner(); };
  }
  function renderToday(){
    const statsRow=$('today-stats-row'), list=$('today-list');
    renderBackupBanner();
    const open=activeTasks();
    const overdueTasks=open.filter(t=>dueStatus(t.due)==='overdue');
    const now=new Date(); now.setHours(0,0,0,0);
    const todayTasks=open.filter(t=>t.due && new Date(t.due+'T00:00:00').getTime()===now.getTime());
    const weekTasks=open.filter(t=>{
      if(!t.due) return false;
      const d=new Date(t.due+'T00:00:00');
      const diff=Math.round((d-now)/86400000);
      return diff>0 && diff<=7;
    });

    statsRow.innerHTML='';
    const cards=[
      ['En retard', overdueTasks.length, 'crit'],
      ["Dues aujourd'hui", todayTasks.length, 'accent'],
      ['Cette semaine', weekTasks.length, ''],
      ['Total ouvertes', open.length, '']
    ];
    cards.forEach(([label,num,cls])=>{
      const card=document.createElement('div'); card.className='stat-card';
      const n=document.createElement('div'); n.className='stat-card-num'+(cls?' '+cls:''); n.textContent=num;
      const l=document.createElement('div'); l.className='stat-card-label'; l.textContent=label;
      card.appendChild(n); card.appendChild(l);
      statsRow.appendChild(card);
    });
    { const wk=document.createElement('button'); wk.type='button'; wk.className='stat-card wk-card'; wk.title='Ce qui a bougé cette semaine, à copier dans un mail';
      wk.innerHTML='<div class="stat-card-num">Ma semaine</div><div class="stat-card-label">résumé à copier →</div>'; wk.onclick=()=>openWeek('this'); statsRow.appendChild(wk); }

    const todayBadge=$('today-badge');
    const urgentCount=overdueTasks.length+todayTasks.length;
    todayBadge.textContent=urgentCount>0?urgentCount:'';
    const liteBadge=$('lite-today-badge'); if(liteBadge) liteBadge.textContent=urgentCount>0?urgentCount:'';

    list.innerHTML='';
    renderTodayWatch(weekTasks);
    if(overdueTasks.length===0 && todayTasks.length===0){
      const e=document.createElement('div'); e.className='today-empty'; e.textContent="Rien d'urgent aujourd'hui.";
      list.appendChild(e);
      return;
    }
    if(overdueTasks.length){
      list.appendChild(makeGroupHeader('En retard · '+overdueTasks.length, URGENCY_META.critique.color));
      sortedTasks(overdueTasks).forEach(t=>list.appendChild(buildTableRow(t)));
    }
    if(todayTasks.length){
      list.appendChild(makeGroupHeader("Aujourd'hui · "+todayTasks.length, '#14D3A9'));
      sortedTasks(todayTasks).forEach(t=>list.appendChild(buildTableRow(t)));
    }
  }

  // Below the day's tasks: the next 7 days, deals that stopped moving, contracts ending soon
  const STALL_DAYS=15, ENDING_MONTHS=3;
  function lastMove(o){ const log=o.stageLog||[]; return Math.max(o.updatedAt||0, log.length?log[log.length-1].at:0); }
  document.addEventListener('click', e=>{ const t=e.target.closest && e.target.closest('.tab[data-tab="today"], #lite-nav [data-go="today"]'); if(t) setTimeout(renderToday,0); });
  function renderTodayWatch(weekTasks){
    const box=$('today-watch'); if(!box) return; box.innerHTML='';
    const block=(title,count,rows,hint)=>{ if(!rows.length) return; const s=document.createElement('section'); s.className='tw-block';
      const h=makeGroupHeader(title+' · '+count); h.classList.add('tw-h'); s.appendChild(h);
      if(hint){ const p=document.createElement('div'); p.className='tw-hint'; p.textContent=hint; s.appendChild(p); }
      rows.forEach(r=>s.appendChild(r)); box.appendChild(s); };
    const row=(title,sub,val,fn,cls)=>{ const r=document.createElement('button'); r.type='button'; r.className='tw-row'+(cls?' '+cls:''); r.onclick=fn;
      r.innerHTML='<span class="k"><b></b><span></span></span><span class="v"></span>'; r.querySelector('b').textContent=title; r.querySelector('.k span').textContent=sub||''; r.querySelector('.v').textContent=val||''; return r; };
    const wk=sortedTasks(weekTasks.slice()).sort((a,b)=>(a.due||'').localeCompare(b.due||''));
    const day=iso=>{ const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('fr-FR',{ weekday:'short', day:'numeric', month:'short' }); };
    block('Les 7 prochains jours', wk.length, wk.slice(0,8).map(t=>row(plainLinks(t.title), t.client||'', day(t.due), ()=>openTaskEverywhere(t.id))), wk.length>8?'Les 8 premières ; toutes dans Tâches.':'');
    const now=Date.now();
    const stalled=opportunities.filter(o=>!o.deleted && (o.kind==='installation'||o.kind==='prequal') && !isExited(o) && o.stage!=='converti' && o.stage!=='actif' && lastMove(o)>1e12 && now-lastMove(o)>=STALL_DAYS*864e5)
      .sort((a,b)=>lastMove(a)-lastMove(b));
    block('Pipeline : sans mouvement depuis '+STALL_DAYS+' jours', stalled.length, stalled.slice(0,8).map(o=>{ const d=Math.floor((now-lastMove(o))/864e5);
      return row(o.kind==='prequal'?o.company+' (pré-qualif)':oppName(o), [o.kind==='prequal'?'':o.company, stageLabel(o.stage)].filter(Boolean).join(' · '), d+' j', ()=>{ gsTab('pipeline'); setTimeout(()=>openOppDetail(o.id),30); }, d>=30?'late':''); }),
      'Aucune étape ni modification depuis. Relance, avance ou classe-les.');
    if(parcData===null) loadParc();
    if(parcData){
      const today=toISO(new Date()), lim=new Date(); lim.setMonth(lim.getMonth()+ENDING_MONTHS); const limIso=toISO(lim);
      const ending=parcData.items.filter(p=>p.statut==='Gagné' && p.fin && p.fin>=today && p.fin<=limIso).sort((a,b)=>a.fin.localeCompare(b.fin));
      block('Contrats qui finissent dans les '+ENDING_MONTHS+' mois', ending.length, ending.slice(0,8).map(p=>row(p.inst||p.prod||'(sans nom)', [p.dev||p.prod, p.kwc?fmtKwc(p.kwc):''].filter(Boolean).join(' · '), pqIsoToFr(p.fin), ()=>openMapPoint({ who:p.dev, prod:p.prod, ref:{ parc:p } }))));
    }
  }

  // ===== Post-it flottant =====
  // One free-text note (id 'scratchpad'), synced like the rest via data/notes.json.
  // Open/position/size are per-device preferences (plain localStorage).
  const POSTIT_ID='scratchpad';
  let postitEl=null, postitTextEl=null, postitTabEl=null, postitDirty=false, postitSaveTimer=null, postitSavedTimer=null;
  function tomorrowISO(){ const d=new Date(); d.setDate(d.getDate()+1); return toISO(d); }
  function scratchNote(){
    let n=notes.find(x=>x.id===POSTIT_ID);
    if(!n){ n={ id:POSTIT_ID, text:'', createdAt:Date.now(), updatedAt:0, deleted:false }; notes.push(n); }
    n.deleted=false;
    return n;
  }
  // Notes from the short-lived multi-post-it version are folded into the single post-it.
  function consolidateNotes(){
    const legacy=notes.filter(n=>n.id!==POSTIT_ID && !n.deleted);
    if(!legacy.length) return;
    legacy.sort((a,b)=>((a.kind==='demain'?0:1)-(b.kind==='demain'?0:1)) || ((a.createdAt||0)-(b.createdAt||0)));
    const sp=scratchNote();
    sp.text=[(sp.text||'').trim(), ...legacy.map(n=>(n.kind==='demain'?'Demain : ':'')+n.text)].filter(Boolean).join('\n');
    touch(sp);
    legacy.forEach(n=>{ n.deleted=true; touch(n); });
    saveNotes();
  }
  function flashPostitSaved(msg){
    const el=$('postit-saved'); if(!el) return;
    el.textContent=msg; el.style.opacity='.75';
    clearTimeout(postitSavedTimer); postitSavedTimer=setTimeout(()=>{ el.style.opacity='0'; },1500);
  }
  function flushPostit(){
    if(!postitDirty || !postitTextEl) return;
    clearTimeout(postitSaveTimer);
    postitDirty=false;
    const n=scratchNote();
    if(n.text!==postitTextEl.value){ n.text=postitTextEl.value; touch(n); saveNotes(); flashPostitSaved('enregistré'); }
    updatePostitTab();
  }
  // ---------- note of the day: each morning the note keeps its unticked lines; the day before is kept, dated, in its history ----------
  // The days are fields of the note itself (« day_2026-10-21 »): the sync merges them field by field, nothing is lost.
  const DAY_PREFIX='day_';
  function dayNotes(){ const n=notes.find(x=>x.id===POSTIT_ID && !x.deleted); if(!n) return []; return Object.keys(n).filter(k=>k.startsWith(DAY_PREFIX) && n[k]).map(k=>({ day:k.slice(DAY_PREFIX.length), text:n[k] })).sort((a,b)=>b.day.localeCompare(a.day)); }
  function rollDailyNote(){
    const n=notes.find(x=>x.id===POSTIT_ID && !x.deleted); if(!n || !String(n.text||'').trim()) return false;
    const today=toISO(new Date()), lastDay=n.updatedAt?toISO(new Date(n.updatedAt)):today;
    if(lastDay>=today || n.rolledFor===today) return false;
    if(undoBase) undoCommit();   // the morning roll is not an action of the user: not a Ctrl+Z step
    const key=DAY_PREFIX+lastDay, prev=n[key]?String(n[key]).split('\n'):[];
    const lines=String(n.text).split('\n'); n[key]=prev.concat(lines.filter(l=>!prev.includes(l))).join('\n').replace(/\n{3,}/g,'\n\n').trim();
    n.text=lines.filter(l=>!PI_DONE.test(l)).join('\n').replace(/\n{3,}/g,'\n\n').replace(/^\n+/,'');
    n.rolledFor=today; touch(n); saveNotes(); if(undoBase) undoRebase(); return true;
  }
  // ---------- settings shared between devices: saved views, network layout, goals… ride along in the note as « pref_<key> » fields ----------
  // (merged field by field by the sync; the note's date is left alone so the morning roll is not disturbed)
  const PREF_PREFIX='pref_', SYNCED_PREFS=['saved-views-tasks','saved-views-pipeline','network-pins','network-hidden','pipe-goals','pipe-meet-phases'];
  const lsGet=k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, lsSet=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
  function prefsToNote(){
    if(window.TODO_WIDGET) return;
    const n=scratchNote(); let ch=false;
    SYNCED_PREFS.forEach(k=>{ const v=lsGet(k); if(v!=null && n[PREF_PREFIX+k]!==v){ n[PREF_PREFIX+k]=v; ch=true; } });
    if(!ch) return;
    if(undoBase) undoCommit(); n.prefsAt=Date.now(); saveNotesLocalOnly(); scheduleNotesSyncPush(); if(undoBase) undoRebase();   // not a Ctrl+Z step
  }
  function prefsFromNote(){
    const n=notes.find(x=>x.id===POSTIT_ID && !x.deleted); if(!n) return false; let ch=false;
    SYNCED_PREFS.forEach(k=>{ const v=n[PREF_PREFIX+k]; if(typeof v==='string' && lsGet(k)!==v){ lsSet(k,v); ch=true; } });
    return ch;
  }
  // first time on a device: what it already had and what the other device shared are put together
  function prefsInit(){
    if(window.TODO_WIDGET) return;
    const n=notes.find(x=>x.id===POSTIT_ID && !x.deleted);
    if(n && !lsGet('prefs-merged')){
      const parse=v=>{ try{ return JSON.parse(v); }catch(e){ return null; } };
      SYNCED_PREFS.forEach(k=>{ const a=parse(lsGet(k)), b=parse(n[PREF_PREFIX+k]); if(a==null || b==null) return;
        let m=null;
        if(Array.isArray(a) && Array.isArray(b)) m=k.startsWith('saved-views')?b.concat(a.filter(x=>!b.some(y=>y && x && y.name===x.name))):[...new Set(b.concat(a))];
        else if(typeof a==='object' && typeof b==='object') m=Object.assign({}, a, b);
        if(m){ const v=JSON.stringify(m); lsSet(k, v); n[PREF_PREFIX+k]=v; } });
      lsSet('prefs-merged','1'); saveNotesLocalOnly(); scheduleNotesSyncPush();
    }
    prefsFromNote(); prefsToNote();   // what the note holds wins (latest from either device); what only this device has is shared
  }
  function prefsApplied(){
    if(networkView && $('tab-network') && !$('tab-network').classList.contains('hidden')) networkView.refresh();
    if($('tab-pipeline') && !$('tab-pipeline').classList.contains('hidden')) renderPipeline();
  }
  window.todoSettingsChanged=prefsToNote;
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && rollDailyNote()) renderNotes(); });
  setInterval(()=>{ if(!document.hidden && document.activeElement!==postitTextEl && rollDailyNote()) renderNotes(); }, 5*60*1000);   // the app left open over midnight
  function openDayNotes(focusDay){
    const days=dayNotes(); let ov=$('daynotes-overlay');
    if(!ov){ ov=document.createElement('div'); ov.id='daynotes-overlay'; ov.className='modal-overlay';
      ov.innerHTML='<div class="modal-box wide dn-box" role="dialog" aria-label="Notes des jours précédents"><div class="dn-head"><h3>Notes des jours précédents</h3><input type="text" class="dn-search" placeholder="Chercher dans les notes…" aria-label="Chercher dans les notes"><button type="button" class="modal-x dn-x" aria-label="Fermer">✕</button></div><div class="dn-list"></div></div>';
      document.body.appendChild(ov); ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.add('hidden'); }); ov.querySelector('.dn-x').onclick=()=>ov.classList.add('hidden');
      ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); ov.classList.add('hidden'); } });
      ov.querySelector('.dn-search').addEventListener('input', ()=>paint()); }
    const list=ov.querySelector('.dn-list'), search=ov.querySelector('.dn-search');
    const paint=()=>{ const q=pqFold(search.value.trim()); list.innerHTML='';
      const shown=dayNotes().map(d=>({ day:d.day, lines:d.text.split('\n').filter(l=>l.trim() && (!q || pqFold(l).includes(q))) })).filter(d=>d.lines.length);
      if(!shown.length){ list.innerHTML='<p class="dn-empty">'+(days.length?'Rien trouvé.':'Pas encore d’historique : chaque matin, la note de la veille sera rangée ici (ses lignes non cochées restent dans la note).')+'</p>'; return; }
      shown.forEach(d=>{ const sec=document.createElement('section'); sec.className='dn-day'; sec.dataset.day=d.day;
        const h=document.createElement('h4'); h.textContent=new Date(d.day+'T12:00:00').toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long', year:'numeric' }); sec.appendChild(h);
        d.lines.forEach(l=>{ const done=PI_DONE.test(l), r=document.createElement('div'); r.className='dn-line'+(done?' done':''); renderLinked(r, l.replace(PI_DONE,'')); sec.appendChild(r); });
        list.appendChild(sec); });
      if(focusDay){ const el=list.querySelector('[data-day="'+focusDay+'"]'); if(el) el.scrollIntoView({ block:'start' }); focusDay=null; } };
    search.value=''; paint(); ov.classList.remove('hidden'); setTimeout(()=>search.focus(), 30);
  }
  window.todoOpenDayNote=openDayNotes;

  // ----- « Ma semaine » : what moved this week (or last week), ready to paste in a mail -----
  function weekBounds(which){
    const d=new Date(); d.setHours(0,0,0,0); const mon=new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7));
    if(which==='last'){ const a=new Date(mon); a.setDate(a.getDate()-7); return { from:a.getTime(), to:mon.getTime(), label:'Semaine du '+a.toLocaleDateString('fr-FR',{ day:'numeric', month:'long' }) }; }
    return { from:mon.getTime(), to:Date.now()+1, label:'Semaine du '+mon.toLocaleDateString('fr-FR',{ day:'numeric', month:'long' }) };
  }
  function weekData(which){
    const W=weekBounds(which), inR=ms=>ms>=W.from && ms<W.to, isoIn=v=>{ if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')) return false; const t=new Date(v+'T12:00:00').getTime(); return inR(t); };
    const insts=opportunities.filter(o=>!o.deleted && (o.kind==='installation'||o.kind==='prequal'));
    const mwOf=list=>list.reduce((s,o)=>s+kwcNum(o),0), mw=k=>(Math.round(k/100)/10).toLocaleString('fr-FR')+' MWc';
    // stage moves, grouped by request (same move for several installations = one line)
    const moves=new Map();
    insts.forEach(o=>{ const log=(o.stageLog||[]).filter(e=>e && e.at>1e12);
      log.forEach((e,i)=>{ if(!inR(e.at) || i===0 || OPP_EXITS[e.stage]) return; const from=log[i-1].stage; if(from===e.stage) return;
        const k=(o.requestId||o.id)+'|'+from+'|'+e.stage; const m=moves.get(k)||{ company:o.company||'', from, to:e.stage, list:[] }; if(!m.list.includes(o)) m.list.push(o); moves.set(k,m); }); });
    const signed=insts.filter(o=>o.kind==='installation' && (isoIn(o.signDate) || (o.stageLog||[]).some((e,i,l)=>inR(e.at) && stageIndex(e.stage)>=stageIndex('onboarding') && i>0 && stageIndex(l[i-1].stage)<stageIndex('onboarding'))));
    const offers=insts.filter(o=>o.kind==='installation' && !signed.includes(o) && (isoIn(o.dateOffre) || (o.stageLog||[]).some(e=>inR(e.at) && e.stage==='offre_attente')));
    const fresh=insts.filter(o=>inR(o.createdAt||0));
    const lost=insts.filter(o=>isExited(o) && inR(o.lostAt||0));
    const done=tasks.filter(t=>!t.deleted && t.archived && inR(t.archivedAt||0)).sort((a,b)=>(a.archivedAt||0)-(b.archivedAt||0));
    const mts=meetings.filter(m=>!m.deleted && isoIn(m.date)).sort((a,b)=>a.date.localeCompare(b.date));
    const today=new Date(); today.setHours(0,0,0,0); const in7=new Date(today); in7.setDate(today.getDate()+7);
    const next=which==='last'?[]:activeTasks().filter(t=>t.due && new Date(t.due+'T00:00:00')>today && new Date(t.due+'T00:00:00')<=in7).sort((a,b)=>a.due.localeCompare(b.due));
    const byCo=list=>{ const g=new Map(); list.forEach(o=>{ const k=o.requestId||o.id; const x=g.get(k)||{ company:o.company||'', list:[] }; x.list.push(o); g.set(k,x); }); return [...g.values()]; };
    const coLine=x=>x.company+' — '+(x.list.length>3?x.list.length+' installations':x.list.map(oppName).join(', '))+(mwOf(x.list)?' ('+mw(mwOf(x.list))+')':'');
    const ctName=m=>{ const c=contacts.find(x=>x.id===m.contactId); return c?[[c.firstName,c.lastName].filter(Boolean).join(' '), c.company].filter(Boolean).join(' · '):''; };
    const sections=[
      ['Signés', byCo(signed).map(coLine)],
      ['Offres remises', byCo(offers).map(coLine)],
      ['Dossiers qui ont avancé', [...moves.values()].map(m=>m.company+' — '+(m.list.length>3?m.list.length+' installations':m.list.map(oppName).join(', '))+' : '+(OPP_STAGES.find(x=>x.key===m.from)?stageLabel(m.from):'—')+' → '+stageLabel(m.to))],
      ['Nouveaux dossiers', byCo(fresh).map(x=>x.list[0].kind==='prequal'?x.company+' (pré-qualif)':coLine(x))],
      ['Perdus / sans suite', byCo(lost).map(x=>coLine(x)+' · '+(OPP_EXITS[x.list[0].stage]||''))],
      ['Rendez-vous', mts.map(m=>pqIsoToFr(m.date)+' · '+[m.label, ctName(m)].filter(Boolean).join(' — '))],
      ['Tâches faites', done.map(t=>plainLinks(t.title)+(t.client?' ('+t.client+')':''))],
      ['La semaine prochaine', next.map(t=>pqIsoToFr(t.due).slice(0,5)+' · '+plainLinks(t.title)+(t.client?' ('+t.client+')':''))],
    ];
    const kpis=[[signed.length,'signé'+(signed.length>1?'s':'')+(signed.length?' · '+mw(mwOf(signed)):'')],[offers.length,'offre'+(offers.length>1?'s':'')+' remise'+(offers.length>1?'s':'')],[moves.size,'avancée'+(moves.size>1?'s':'')+' de dossier'],[done.length,'tâche'+(done.length>1?'s':'')+' faite'+(done.length>1?'s':'')]];
    return { W, sections, kpis };
  }
  function weekText(d){ return [d.W.label].concat(d.kpis.map(([n,l])=>n+' '+l).join(' · '), ...d.sections.filter(s=>s[1].length).map(([h,l])=>['', h+' ('+l.length+')'].concat(l.map(x=>'• '+x)).join('\n'))).join('\n'); }
  function weekHtml(d){
    const e=escapeHtml;
    return '<p style="font:600 14px Arial;margin:0 0 4px">'+e(d.W.label)+'</p><p style="font:12px Arial;color:#555;margin:0 0 10px">'+e(d.kpis.map(([n,l])=>n+' '+l).join(' · '))+'</p>'
      +d.sections.filter(s=>s[1].length).map(([h,l])=>'<p style="font:700 12px Arial;color:#1A7B8C;margin:10px 0 4px">'+e(h)+' ('+l.length+')</p><ul style="margin:0;padding-left:18px;font:12px Arial;color:#111">'+l.map(x=>'<li>'+e(x)+'</li>').join('')+'</ul>').join('');
  }
  function openWeek(which){
    which=which||'this'; let ov=$('week-overlay');
    if(!ov){ ov=document.createElement('div'); ov.id='week-overlay'; ov.className='modal-overlay';
      ov.innerHTML='<div class="modal-box wide wk-box" role="dialog" aria-labelledby="wk-title"><div class="wk-head"><h3 id="wk-title">Ma semaine</h3><div class="wk-switch"><button type="button" data-w="this">Cette semaine</button><button type="button" data-w="last">Semaine dernière</button></div><button type="button" class="modal-x wk-x" aria-label="Fermer">×</button></div>'
        +'<div class="wk-kpis"></div><div class="wk-body"></div><div class="crm-form-actions"><button type="button" class="wk-copy">Copier pour mail / Teams</button><button type="button" class="ghost-btn wk-close">Fermer</button></div></div>';
      document.body.appendChild(ov);
      const close=()=>ov.classList.add('hidden');
      ov.addEventListener('click', e=>{ if(e.target===ov) close(); }); ov.querySelector('.wk-x').onclick=close; ov.querySelector('.wk-close').onclick=close;
      ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } });
      ov.querySelectorAll('.wk-switch button').forEach(b=>{ b.onclick=()=>openWeek(b.dataset.w); }); }
    const d=weekData(which);
    ov.querySelectorAll('.wk-switch button').forEach(b=>b.classList.toggle('on', b.dataset.w===which));
    const k=ov.querySelector('.wk-kpis'); k.innerHTML=''; d.kpis.forEach(([n,l])=>{ const c=document.createElement('div'); c.innerHTML='<b></b><span></span>'; c.firstChild.textContent=n; c.lastChild.textContent=l; k.appendChild(c); });
    const body=ov.querySelector('.wk-body'); body.innerHTML='';
    const filled=d.sections.filter(s=>s[1].length);
    if(!filled.length) body.innerHTML='<p class="modal-hint">Rien de noté pour cette semaine pour l’instant.</p>';
    filled.forEach(([h,l])=>{ const sec=document.createElement('section'); sec.className='wk-sec'; const t=document.createElement('h4'); t.textContent=h+' · '+l.length; sec.appendChild(t);
      const ul=document.createElement('ul'); l.slice(0,30).forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ul.appendChild(li); }); if(l.length>30){ const li=document.createElement('li'); li.className='wk-more'; li.textContent='+ '+(l.length-30)+' autres (dans la copie)'; ul.appendChild(li); }
      sec.appendChild(ul); body.appendChild(sec); });
    ov.querySelector('.wk-copy').onclick=async e=>{ const btn=e.currentTarget, html=weekHtml(d), text=weekText(d);
      try{ await navigator.clipboard.write([new ClipboardItem({ 'text/html':new Blob([html],{ type:'text/html' }), 'text/plain':new Blob([text],{ type:'text/plain' }) })]); flashBtn(btn,'✓ Copié'); } catch(err){ copyToClipboard(text, btn); } };
    ov.classList.remove('hidden');
  }
  window.todoOpenWeek=openWeek;
  window.todoWeekText=w=>weekText(weekData(w||'this'));
  window.todoExtraCommands=(window.todoExtraCommands||[]).concat([{ t:'Ma semaine : résumé à copier', k:'semaine resume hebdo bilan rapport manager mail', go:()=>openWeek('this') }]);
  function updatePostitTab(){
    const n=notes.find(x=>x.id===POSTIT_ID && !x.deleted);
    const first=n ? ((n.text||'').split('\n').map(l=>l.trim()).find(Boolean)||'') : '';
    $('postit-tab-preview').textContent=first||'Note';
  }
  function renderNotes(){
    if(prefsFromNote()) setTimeout(prefsApplied, 0);   // settings changed on the other device
    if(!postitTextEl) return;
    const n=notes.find(x=>x.id===POSTIT_ID && !x.deleted);
    const txt=n ? (n.text||'') : '';
    if(!postitDirty && postitTextEl.value!==txt){
      const focused=document.activeElement===postitTextEl, pos=postitTextEl.selectionStart;
      postitTextEl.value=txt;
      if(focused){ const c=Math.min(pos, txt.length); postitTextEl.setSelectionRange(c,c); }
    }
    updatePostitTab(); renderPostitList();
  }
  function setPostitOpen(open, focus){
    if(!postitEl) return;
    if(!open) flushPostit();
    postitEl.classList.toggle('hidden', !open);
    document.body.classList.toggle('postit-open', !!open);   // the lists get room at the bottom: their last lines scroll above the note
    postitTabEl.classList.toggle('hidden', open);
    try{ localStorage.setItem('postit-open', open?'1':'0'); }catch(e){}
    if(open){ clampPostit(); if(focus) setTimeout(()=>{ postitShowEditor(); postitTextEl.focus(); const l=postitTextEl.value.length; postitTextEl.setSelectionRange(l,l); },0); }
  }
  // ---------- Post-it as a list: each line is a bullet to tick (✓ in front of the line, struck through);
  // a click on a line's text, or « + Ajouter une ligne », edits the note as plain text (same text, same sync) ----------
  const PI_DONE=/^✓\s?/;
  function postitShowEditor(){ const box=$('postit-list'); if(box) box.hidden=true; postitTextEl.classList.remove('as-list'); }
  function renderPostitList(){
    const box=$('postit-list'); if(!box || !postitTextEl) return;
    const txt=postitTextEl.value, show=document.activeElement!==postitTextEl && txt.trim()!=='';
    box.hidden=!show; postitTextEl.classList.toggle('as-list', show);
    if(!show) return;
    box.innerHTML='';
    { const today=toISO(new Date()), nT=activeTasks().filter(t=>t.due===today).length, nM=meetings.filter(m=>!m.deleted && m.date===today).length;
      if(nT||nM){ const b=document.createElement('button'); b.type='button'; b.className='pi-today'; b.textContent='Aujourd’hui · '+[nM?nM+' RDV':'', nT?nT+' tâche'+(nT>1?'s':''):''].filter(Boolean).join(' · ');
        b.title='Ouvrir Aujourd’hui'; b.onclick=()=>gsTab('today'); box.appendChild(b); } }
    txt.split('\n').forEach((line,i)=>{
      if(!line.trim()){ const g=document.createElement('div'); g.className='pi-gap'; box.appendChild(g); return; }
      const done=PI_DONE.test(line), label=line.replace(PI_DONE,'');
      const r=document.createElement('div'); r.className='pi-row'+(done?' done':'');
      const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=done; cb.setAttribute('aria-label',(done?'Décocher : ':'Cocher : ')+label);
      cb.onchange=()=>postitToggleLine(i, cb.checked);
      const t=document.createElement('span'); t.className='pi-text'; if(label.includes('[[')) renderLinked(t, label); else t.textContent=label; t.title='Cliquer pour modifier'; t.onclick=()=>postitEditAt(i);
      r.append(cb,t); box.appendChild(r);
    });
    const add=document.createElement('button'); add.type='button'; add.className='pi-add'; add.textContent='+ Ajouter une ligne'; add.onclick=()=>postitEditAt(-1); box.appendChild(add);
  }
  function postitToggleLine(i, done){
    const L=postitTextEl.value.split('\n'); if(L[i]==null) return;
    L[i]=done?'✓ '+L[i].replace(PI_DONE,''):L[i].replace(PI_DONE,'');
    postitTextEl.value=L.join('\n'); postitDirty=true; flushPostit(); renderPostitList();
  }
  function postitEditAt(i){
    postitShowEditor();
    let v=postitTextEl.value, pos=v.length;
    if(i>=0) pos=v.split('\n').slice(0,i+1).join('\n').length;
    else if(v && !v.endsWith('\n')){ postitTextEl.value=v+'\n'; pos=v.length+1; }
    postitTextEl.focus(); postitTextEl.setSelectionRange(pos,pos);
  }
  function openPostit(focus){ setPostitOpen(true, focus); }
  function clampPostit(){
    if(!postitEl || window.innerWidth<=760 || !postitEl.style.left) return;
    const w=postitEl.offsetWidth||300;
    const x=Math.min(Math.max(0, parseInt(postitEl.style.left)||0), Math.max(0, window.innerWidth-w));
    const y=Math.min(Math.max(0, parseInt(postitEl.style.top)||0), Math.max(0, window.innerHeight-40));
    postitEl.style.left=x+'px'; postitEl.style.top=y+'px';
  }
  function postitLineToTask(){
    const ta=postitTextEl, v=ta.value;
    const start=ta.selectionStart, end=ta.selectionEnd;
    const ls=v.lastIndexOf('\n', start-1)+1;
    let le=v.indexOf('\n', (end>start && v[end-1]==='\n') ? end-1 : end); if(le===-1) le=v.length;
    const lines=v.slice(ls, le).split('\n').map(l=>l.replace(PI_DONE,'').replace(/^\s*(?:[-*•]|demain\s*:)\s*/i,'').trim()).filter(Boolean);
    if(!lines.length){ flashPostitSaved('mets le curseur sur une ligne'); ta.focus(); return; }
    const due=tomorrowISO();
    lines.forEach(l=>createTask({ title:l.slice(0,140), urgency:'haute', status:'a_faire', due }));
    ta.value=(v.slice(0,ls)+v.slice(le<v.length?le+1:le)).replace(/\n{3,}/g,'\n\n');
    const c=Math.min(ls, ta.value.length); ta.setSelectionRange(c,c);
    postitDirty=true; flushPostit();
    render(); renderLists();
    flashPostitSaved(lines.length>1 ? lines.length+' tâches pour demain' : 'tâche pour demain créée');
    ta.focus();
  }
  function initPostit(){
    postitEl=$('postit'); postitTextEl=$('postit-text'); postitTabEl=$('postit-tab');
    let pos=null, size=null, open=null;
    try{ pos=JSON.parse(localStorage.getItem('postit-pos')||'null'); size=JSON.parse(localStorage.getItem('postit-size')||'null'); open=localStorage.getItem('postit-open'); }catch(e){}
    if(size){ postitEl.style.width=size.w+'px'; postitEl.style.height=size.h+'px'; }
    if(pos){ postitEl.style.left=pos.x+'px'; postitEl.style.top=pos.y+'px'; postitEl.style.right='auto'; postitEl.style.bottom='auto'; }
    renderNotes();
    setPostitOpen(open===null ? window.innerWidth>760 : open==='1', false);

    postitTextEl.addEventListener('input', ()=>{ postitDirty=true; clearTimeout(postitSaveTimer); postitSaveTimer=setTimeout(flushPostit, 600); });
    postitTextEl.addEventListener('blur', ()=>{ flushPostit(); setTimeout(renderPostitList, 0); });
    postitTextEl.addEventListener('focus', postitShowEditor);
    postitTextEl.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); setPostitOpen(false); } });
    $('postit-min').onclick=()=>setPostitOpen(false);
    $('postit-history').onclick=()=>openDayNotes();
    postitTabEl.onclick=()=>setPostitOpen(true, true);
    const toTask=$('postit-to-task');
    toTask.onmousedown=e=>e.preventDefault(); // keep the cursor/selection in the textarea
    toTask.onclick=postitLineToTask;

    const bar=$('postit-bar');
    bar.addEventListener('pointerdown', e=>{
      if(e.target.closest('button') || window.innerWidth<=760) return;
      const r=postitEl.getBoundingClientRect(), dx=e.clientX-r.left, dy=e.clientY-r.top;
      bar.setPointerCapture(e.pointerId); bar.classList.add('dragging');
      const move=ev=>{
        postitEl.style.left=Math.min(Math.max(0, ev.clientX-dx), window.innerWidth-r.width)+'px';
        postitEl.style.top=Math.min(Math.max(0, ev.clientY-dy), window.innerHeight-40)+'px';
        postitEl.style.right='auto'; postitEl.style.bottom='auto';
      };
      const up=()=>{
        bar.removeEventListener('pointermove',move); bar.removeEventListener('pointerup',up); bar.removeEventListener('pointercancel',up);
        bar.classList.remove('dragging');
        try{ localStorage.setItem('postit-pos', JSON.stringify({ x:parseInt(postitEl.style.left)||0, y:parseInt(postitEl.style.top)||0 })); }catch(err){}
      };
      bar.addEventListener('pointermove',move); bar.addEventListener('pointerup',up); bar.addEventListener('pointercancel',up);
    });
    if(window.ResizeObserver){
      let t=null;
      new ResizeObserver(()=>{
        if(postitEl.classList.contains('hidden') || window.innerWidth<=760) return;
        clearTimeout(t); t=setTimeout(()=>{ try{ localStorage.setItem('postit-size', JSON.stringify({ w:postitEl.offsetWidth, h:postitEl.offsetHeight })); }catch(e){} },300);
      }).observe(postitEl);
    }
    window.addEventListener('resize', clampPostit);
  }

  let archiveFilter='toutes';
  let archiveDirty=false;
  function renderArchive(){
    // drawn when it is shown (the tab click draws it again): validating a task stays quick with a long archive
    if($('tab-archive').classList.contains('hidden')){ archiveDirty=true; return; }
    archiveDirty=false;
    const list=$('archive-list');
    list.innerHTML='';
    const q=($('archive-search').value||'').trim().toLowerCase();
    const inTrash=archiveFilter==='corbeille';
    let arch=inTrash
      ? tasks.filter(t=>t.deleted).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))
      : tasks.filter(t=>t.archived && !t.deleted).sort((a,b)=>(b.archivedAt||0)-(a.archivedAt||0));
    if(archiveFilter==='critique') arch=arch.filter(t=>t.urgency==='critique');
    else if(archiveFilter==='haute') arch=arch.filter(t=>t.urgency==='haute'||t.urgency==='critique');
    if(q) arch=arch.filter(t=>(t.title+' '+(t.client||'')+' '+(t.project||'')).toLowerCase().includes(q));
    if(!arch.length){ const e=document.createElement('div'); e.className='empty-state'; e.textContent=q?'Aucun résultat.':(inTrash?'Corbeille vide.':'Aucune tâche archivée.'); list.appendChild(e); return; }
    let n=1;
    arch.forEach(t=>list.appendChild(buildArchiveRow(t, n++, inTrash)));
  }

  function buildArchiveRow(t, rowNum, inTrash){
    const restoreFn=inTrash?untrashTask:restoreTask, restoreTitle=inTrash?'Remettre (sortir de la corbeille)':'Restaurer';
    const row=document.createElement('div'); row.className='task-line';
    row.dataset.id=t.id;
    const grid=document.createElement('div'); grid.className='task-row-grid archive-row-grid';

    const numSpan=document.createElement('span'); numSpan.className='row-num'; numSpan.textContent=rowNum||'';
    grid.appendChild(numSpan);

    const restoreDot=document.createElement('div'); restoreDot.className='task-check'; restoreDot.style.borderColor='var(--tx3)'; restoreDot.title=restoreTitle;
    restoreDot.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:9px;height:9px;display:block;stroke:var(--tx3);"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
    restoreDot.onclick=e=>{ e.stopPropagation(); restoreFn(t.id); };
    grid.appendChild(restoreDot);

    const titleWrap=document.createElement('div'); titleWrap.className='td-title';
    const titleText=document.createElement('span'); titleText.className='td-title-text'; titleText.style.textDecoration='line-through'; titleText.style.opacity='.6'; titleText.textContent=plainLinks(t.title);
    titleWrap.appendChild(titleText);
    grid.appendChild(titleWrap);

    const clientTag=t.client ? makeTag(t.client, clientColor(t.client), 'dot') : document.createElement('span');
    grid.appendChild(clientTag);
    const projectTag=t.project ? makeTag(t.project, projectColor(t.project), 'flag') : document.createElement('span');
    grid.appendChild(projectTag);

    const sMeta=STATUS_META[t.status]||STATUS_META.a_faire;
    grid.appendChild(makeSolidTag(sMeta.label, sMeta.color, null));

    const uMeta=URGENCY_META[t.urgency]||URGENCY_META.moyenne;
    grid.appendChild(makeSolidTag(uMeta.label, uMeta.color, null));

    const dateTag=document.createElement('span'); dateTag.className='meta-date-compact';
    { const ts=inTrash?t.updatedAt:t.archivedAt; dateTag.textContent=ts?DF_DMY.format(new Date(ts)):''; if(ts) dateTag.title=fmtDateTime(ts); }   // the time on hover: it does not fit in the column
    if(inTrash) dateTag.title='Supprimée le '+dateTag.textContent;
    grid.appendChild(dateTag);

    const mailWrap=document.createElement('span'); mailWrap.className='task-mail-icon';
    if(t.link){ mailWrap.appendChild(makeLinkOrCopyBtn(t)); }
    grid.appendChild(mailWrap);

    const actions=document.createElement('div'); actions.className='task-actions-compact'; actions.style.opacity='.7';
    const restore=document.createElement('button'); restore.title=restoreTitle;
    restore.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
    restore.onclick=e=>{ e.stopPropagation(); restoreFn(t.id); };
    actions.appendChild(restore);
    if(!inTrash){
      const del=document.createElement('button'); del.className='del-btn'; del.title='Supprimer';
      del.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      del.onclick=e=>{ e.stopPropagation(); deleteTask(t.id); };
      actions.appendChild(del);
    }
    grid.appendChild(actions);

    row.appendChild(grid);
    return row;
  }

  function countFor(name,field){ return activeTasks().filter(t=>t[field]===name).length; }

  function updateConflictBadge(){
    const el=$('conflicts-badge');
    if(el) el.textContent = conflicts.length>0 ? conflicts.length : '';
  }

  function findEntity(entityType, id){
    const list = entityType==='task'?tasks : entityType==='note'?notes : entityType==='company'?companies : entityType==='contact'?contacts : entityType==='meeting'?meetings : opportunities;
    return list.find(x=>x.id===id);
  }
  function saveEntityChange(entityType){
    if(entityType==='task'){ saveTasks(); render(); renderToday(); renderArchive(); }
    else if(entityType==='note'){ saveNotes(); renderNotes(); }
    else { saveCrm(); if(typeof renderContacts==='function') renderContacts(); if(typeof renderPipeline==='function') renderPipeline(); }
  }

  function renderConflicts(){
    const section=$('conflicts-section'), list=$('conflicts-list');
    section.classList.toggle('hidden', conflicts.length===0);
    updateConflictBadge();
    list.innerHTML='';
    conflicts.forEach(cf=>{
      const row=document.createElement('div'); row.className='conflict-row';
      const head=document.createElement('div'); head.className='conflict-head';
      const kind={ task:'Tâche', company:'Société', contact:'Contact', meeting:'Rendez-vous', opportunity:'Opportunité', note:'Note' }[cf.entityType]||'';
      head.textContent=(kind?kind+' « '+cf.entityName+' »':cf.entityName)+' — champ « '+cf.fieldLabel+' » : deux valeurs différentes';
      row.appendChild(head);

      const choices=document.createElement('div'); choices.className='conflict-choices';
      function buildChoiceBtn(label, value){
        const btn=document.createElement('button');
        const lab=document.createElement('span'); lab.className='conflict-choice-label'; lab.textContent=label;
        const val=document.createElement('span'); val.className='conflict-choice-value'; val.textContent=String(value||'—');
        btn.appendChild(lab); btn.appendChild(val);
        if(JSON.stringify(value)===JSON.stringify(cf.resolvedValue)){
          const kept=document.createElement('span'); kept.className='conflict-kept'; kept.textContent=' (gardée)';
          btn.appendChild(kept);
        }
        return btn;
      }
      const localBtn=buildChoiceBtn(cf.srcA||'Version A', cf.localValue);
      localBtn.onclick=()=>resolveConflict(cf.id, cf.localValue);
      const remoteBtn=buildChoiceBtn(cf.srcB||'Version B', cf.remoteValue);
      remoteBtn.onclick=()=>resolveConflict(cf.id, cf.remoteValue);
      choices.appendChild(localBtn); choices.appendChild(remoteBtn);
      row.appendChild(choices);

      const dismissBtn=document.createElement('button'); dismissBtn.className='ghost-btn'; dismissBtn.textContent='Ignorer (garder tel quel)'; dismissBtn.style.cssText='font-size:11px;margin-top:4px;';
      dismissBtn.onclick=()=>{ conflicts=conflicts.filter(x=>x.id!==cf.id); saveConflicts(); renderConflicts(); };
      row.appendChild(dismissBtn);

      list.appendChild(row);
    });
  }

  function resolveConflict(conflictId, chosenValue){
    const cf=conflicts.find(x=>x.id===conflictId);
    if(!cf) return;
    const entity=findEntity(cf.entityType, cf.entityId);
    if(entity){
      entity[cf.field]=chosenValue;
      entity.updatedAt=Date.now();
      saveEntityChange(cf.entityType);
    }
    conflicts=conflicts.filter(x=>x.id!==conflictId);
    saveConflicts();
    renderConflicts();
  }

  function renderStats(){
    const panel=$('stats-panel');
    panel.innerHTML='';
    const open=activeTasks();
    const archived=tasks.filter(t=>t.archived && !t.deleted);
    const weekAgo=Date.now()-7*86400000;
    const doneThisWeek=archived.filter(t=>t.archivedAt && t.archivedAt>=weekAgo).length;

    function addBarRow(label,count,total,color){
      const row=document.createElement('div'); row.className='stats-row';
      const l=document.createElement('div'); l.className='stats-label'; l.textContent=label; l.title=label;
      const wrap=document.createElement('div'); wrap.className='stats-bar-wrap';
      const bar=document.createElement('div'); bar.className='stats-bar';
      bar.style.width=(total>0 ? Math.round(count/total*100) : 0)+'%';
      bar.style.background=color;
      wrap.appendChild(bar);
      const v=document.createElement('div'); v.className='stats-value'; v.textContent=count;
      row.appendChild(l); row.appendChild(wrap); row.appendChild(v);
      panel.appendChild(row);
    }
    function addGroupLabel(text){
      const g=document.createElement('div'); g.className='stats-group-label'; g.textContent=text;
      panel.appendChild(g);
    }

    addGroupLabel('Vue d\u2019ensemble ('+open.length+' ouvertes, '+archived.length+' archivées, '+doneThisWeek+' validées cette semaine)');

    addGroupLabel('Par urgence');
    URGENCY_ORDER.forEach(u=>{
      const c=open.filter(t=>t.urgency===u).length;
      if(c>0) addBarRow(URGENCY_META[u].label, c, open.length, URGENCY_META[u].color);
    });

    addGroupLabel('Par statut');
    STATUS_CYCLE.forEach(s=>{
      const c=open.filter(t=>t.status===s).length;
      if(c>0) addBarRow(STATUS_META[s].label, c, open.length, STATUS_META[s].color);
    });

    const clientCounts={};
    open.forEach(t=>{ if(t.client) clientCounts[t.client]=(clientCounts[t.client]||0)+1; });
    const topClients=Object.entries(clientCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(topClients.length){
      addGroupLabel('Top clients');
      const maxC=topClients[0][1];
      topClients.forEach(([name,c])=>addBarRow(name, c, maxC, clientColor(name)));
    }

    const projectCounts={};
    open.forEach(t=>{ if(t.project) projectCounts[t.project]=(projectCounts[t.project]||0)+1; });
    const topProjects=Object.entries(projectCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(topProjects.length){
      addGroupLabel('Top projets');
      const maxP=topProjects[0][1];
      topProjects.forEach(([name,c])=>addBarRow(name, c, maxP, projectColor(name)));
    }

    if(open.length===0){
      addGroupLabel('');
      const e=document.createElement('div'); e.className='list-empty'; e.textContent='Rien à afficher pour le moment.';
      panel.appendChild(e);
    }
  }

  let editingContactId=null;
  function activeContacts(){ return contacts.filter(c=>!c.deleted); }
  function activeCompanies(){ return companies.filter(c=>!c.deleted); }

  function initials(first,last){ return ((first||'').charAt(0)+(last||'').charAt(0)).toUpperCase() || '?'; }
  function companyInitials(name){ const words=(name||'').trim().split(/\s+/).filter(Boolean); if(!words.length) return '?'; return (words[0].charAt(0)+(words[1]?words[1].charAt(0):'')).toUpperCase(); }
  const STAR_ICON_ON='<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>';
  const STAR_ICON_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>';
  // Stars (0–5) belong to the client (company.relevance). Older data had them on contacts: a company without a
  // note starts from the best note of its contacts (deterministic, so every device computes the same value).
  function companyStars(name){
    if(!name) return 0;
    const co=companies.find(x=>x.name===name && !x.deleted);
    if(co && co.relevance!==undefined) return co.relevance||0;
    // a company known only through its contacts (no record yet): best note of its contacts
    return contacts.filter(c=>!c.deleted && c.company===name).reduce((m,c)=>Math.max(m, c.relevance||0), 0);
  }
  function migrateCompanyStars(){
    let changed=false;
    companies.forEach(co=>{
      if(co.relevance!==undefined) return;
      co.relevance=contacts.filter(c=>!c.deleted && c.company===co.name).reduce((m,c)=>Math.max(m, c.relevance||0), 0);
      changed=true;
    });
    return changed;
  }
  function setCompanyStars(name, n){
    let co=companies.find(x=>x.name===name && !x.deleted);
    if(!co){ co={ id:'co_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name, whatTheyDo:'', marketScope:[], website:'', type:'', createdAt:Date.now(), updatedAt:Date.now(), deleted:false }; companies.push(co); }
    co.relevance=(companyStars(name)===n && co.relevance!==undefined)?0:n;   // clicking the current note clears it
    touchCrm(co); saveCrm(); renderContacts();
    if(typeof renderPipeline==='function' && !$('tab-pipeline').classList.contains('hidden')) renderPipeline();
  }
  // clickable stars (company header / company form) or read-only (rows, pipeline cards)
  function starsWidget(n, onPick){
    const w=document.createElement('span'); w.className='co-stars'+(onPick?' editable':'');
    for(let i=1;i<=5;i++){
      const s=document.createElement('span'); s.className='co-star'+(i<=n?' on':''); s.innerHTML=i<=n?STAR_ICON_ON:STAR_ICON_OFF;
      if(onPick){ s.title=i===n?'Retirer la note':('Note : '+i+'/5'); s.onclick=e=>{ e.stopPropagation(); onPick(i); }; }
      w.appendChild(s);
    }
    if(onPick) w.title='Note du client';
    return w;
  }
  function starsIconRow(n){
    let html='';
    for(let i=1;i<=5;i++){ html+='<span style="color:'+(i<=n?'var(--accent)':'var(--bd)')+';display:flex;">'+(i<=n?STAR_ICON_ON:STAR_ICON_OFF)+'</span>'; }
    return html;
  }
  function copyFallback(text){
    try{
      const ta=document.createElement('textarea');
      ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    }catch(e){ return false; }
  }
  // A question with a few answers (no browser pop-up): resolves with the chosen value, or null (Annuler, ✕, Échap)
  function askChoice(title, text, choices){
    return new Promise(res=>{
      const ov=$('choice-overlay'), box=$('choice-btns');
      $('choice-title').textContent=title; $('choice-text').textContent=text; box.innerHTML='';
      const done=v=>{ ov.classList.add('hidden'); document.removeEventListener('keydown', esc, true); res(v); };
      const esc=e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(null); } };
      choices.concat([{ label:'Annuler', value:null, ghost:true }]).forEach(c=>{ const b=document.createElement('button'); b.type='button'; b.textContent=c.label; if(c.ghost) b.className='ghost-btn'; b.onclick=e=>{ if(c.run) c.run(e); done(c.value); }; box.appendChild(b); });
      document.addEventListener('keydown', esc, true);
      ov.classList.remove('hidden'); setTimeout(()=>{ const f=box.querySelector('button'); if(f) f.focus(); }, 0);
    });
  }
  // Pipe lines of several installations: one line each, or a single line for all (powers and volumes added up)
  function pipeRowsFor(list, mode){
    if(mode!=='one' || list.length<2) return list.map(pipeRow).join('\n');
    const num=k=>list.reduce((s,x)=>s+(pqNum(String(x[k]||''))||0),0), first=list[0];
    const names=list.map(oppName), mes=list.map(x=>({ m:x.mesPrev, d:pqDateOf(x.mesPrev) })).filter(x=>x.d).sort((a,b)=>a.d-b.d);
    const depts=[...new Set(list.map(x=>x.dept).filter(Boolean))];
    const one=Object.assign({}, first, { centrale:names.length<=3?names.join(' + '):names.length+' centrales ('+names[0]+'…)', kwc:String(Math.round(num('kwc')*100)/100), mwh:num('mwh')?String(Math.round(num('mwh'))):'',
      p90:num('p90')?String(Math.round(num('p90'))):'', mesPrev:mes.length?mes[0].m:first.mesPrev, dept:depts.length===1?depts[0]:first.dept });
    return pipeRow(one);
  }
  async function copyPipeLines(list, btn){
    if(list.length<2){ copyToClipboard(list.map(pipeRow).join('\n'), btn); return; }
    await askChoice('Copier pour le Pipe', list.length+' installations : une ligne chacune, ou une seule ligne qui les regroupe (puissances et volumes additionnés) ?', [
      { label:'Une ligne par installation ('+list.length+')', value:'each', run:()=>copyToClipboard(pipeRowsFor(list,'each'), btn) },
      { label:'Une seule ligne pour toutes', value:'one', run:()=>copyToClipboard(pipeRowsFor(list,'one'), btn) }
    ]);
  }
  function copyToClipboard(text, feedbackEl){
    const showFeedback=()=>{
      if(!feedbackEl) return;
      const prevText=feedbackEl.textContent, prevColor=feedbackEl.style.color;
      feedbackEl.textContent='Copié !'; feedbackEl.style.color='var(--accent)';
      setTimeout(()=>{ feedbackEl.textContent=prevText; feedbackEl.style.color=prevColor; },1100);
    };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(showFeedback).catch(()=>{ if(copyFallback(text)) showFeedback(); });
    } else if(copyFallback(text)){ showFeedback(); }
  }
  const CHECK_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M20 6L9 17l-5-5"/></svg>';
  function copyIconOnClick(el, text){
    el.onclick=e=>{
      e.stopPropagation();
      const doCopy=()=>{
        const prev=el.innerHTML;
        el.innerHTML=CHECK_ICON; el.style.color='var(--accent)';
        setTimeout(()=>{ el.innerHTML=prev; el.style.color=''; },1100);
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(doCopy).catch(()=>{ if(copyFallback(text)) doCopy(); });
      } else if(copyFallback(text)){ doCopy(); }
    };
  }

  let contactInboxItems=[];
  async function fetchContactInbox(){
    if(!syncConfig.enabled){ contactInboxItems=[]; renderContactInbox(); return; }
    try{
      const url='https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo+'/contents/'+CONTACT_INBOX_FILE_PATH;
      const res=await fetch(url, { headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json' } });
      if(!res.ok) throw new Error('no contact inbox file');
      const data=await res.json();
      contactInboxItems=JSON.parse(b64DecodeUtf8(data.content));
    }catch(e){ contactInboxItems=[]; }
    renderContactInbox();
  }
  function pendingContactInboxItems(){ return contactInboxItems.filter(it=>!contactInboxSeenIds.has(it.id)); }

  async function removeFromContactInboxOnGitHub(itemId){
    if(!syncConfig.enabled) return;
    try{
      const url='https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo+'/contents/'+CONTACT_INBOX_FILE_PATH;
      const getRes=await fetch(url, { headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json' } });
      if(!getRes.ok) return;
      const getData=await getRes.json();
      const currentItems=JSON.parse(b64DecodeUtf8(getData.content));
      const filtered=currentItems.filter(x=>x.id!==itemId);
      if(filtered.length===currentItems.length) return;
      const body={ message:'Remove imported contact', content:b64EncodeUtf8(JSON.stringify(filtered)), sha:getData.sha, branch:'main' };
      await fetch(url, { method:'PUT', headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' }, body:JSON.stringify(body) });
    }catch(e){ console.error('failed to remove contact inbox item from GitHub', e); }
  }

  function renderContactInbox(){
    const section=$('contact-inbox-section'), list=$('contact-inbox-list');
    const pending=pendingContactInboxItems();
    section.classList.toggle('hidden', pending.length===0);
    $('contacts-badge').textContent = pending.length>0 ? pending.length : '';
    list.innerHTML='';
    pending.forEach(it=>{
      const row=document.createElement('div'); row.className='pending-row';
      const main=document.createElement('div'); main.className='pending-row-main';
      const name=document.createElement('div'); name.className='pending-row-name'; name.textContent=[it.firstName,it.lastName].filter(Boolean).join(' ')||'(sans nom)';
      const sub=document.createElement('div'); sub.className='pending-row-sub'; sub.textContent=[it.role,it.company,it.email].filter(Boolean).join(' · ');
      main.appendChild(name); main.appendChild(sub);
      row.appendChild(main);
      const actions=document.createElement('div'); actions.className='pending-row-actions';
      const imp=document.createElement('button'); imp.className='import-btn'; imp.textContent='Importer';
      imp.onclick=()=>importContactInboxItem(it);
      const dis=document.createElement('button'); dis.textContent='Ignorer';
      dis.onclick=()=>dismissContactInboxItem(it.id);
      actions.appendChild(imp); actions.appendChild(dis);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }
  function importContactInboxItem(it){
    let c;
    if(it.company){
      const existing=findExistingCI(clientsList, it.company);
      it.company=existing||it.company;
      if(!existing){ clientsList.push(it.company); saveClients(); }
      if(!companies.find(co=>co.name===it.company)){ companies.push({ id:'co_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name:it.company, whatTheyDo:'', marketScope:[], website:'', createdAt:Date.now(), updatedAt:Date.now(), deleted:false }); }
    }
    c={ id:'ct_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), firstName:it.firstName||'', lastName:it.lastName||'', role:it.role||'', company:it.company||'', email:it.email||'', phone1:it.phone1||'', relevance:0, createdAt:Date.now(), updatedAt:Date.now(), deleted:false };
    contacts.push(c);
    saveCrm();
    contactInboxSeenIds.add(it.id); saveContactSeenIds();
    renderContactInbox(); renderContacts(); renderLists(); refreshDatalists();
    removeFromContactInboxOnGitHub(it.id);
  }
  function dismissContactInboxItem(id){
    contactInboxSeenIds.add(id); saveContactSeenIds();
    renderContactInbox();
    removeFromContactInboxOnGitHub(id);
  }

  // list view by default; the last choice is kept on this device
  let contactsView=(()=>{ try{ return localStorage.getItem('contacts-view')==='groupe'?'groupe':'liste'; }catch(e){ return 'liste'; } })();
  document.querySelectorAll('#contacts-view-switch .view-icon-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===contactsView));
  let visibleColumns={client:true, project:true, status:true, urgency:true, date:true};
  const COLUMN_LABELS={client:'Client', project:'Projet', status:'Statut', urgency:'Urgence', date:'Échéance'};

  function applyColumnVisibility(){
    const panel=$('todo-panel');
    Object.keys(COLUMN_LABELS).forEach(key=>{
      panel.classList.toggle('hide-col-'+key, !visibleColumns[key]);
    });
  }
  async function saveColumnPrefs(){ try{ await window.storage.set('visible-columns', JSON.stringify(visibleColumns), false); }catch(e){} }

  function openColumnsPopover(e){
    e.stopPropagation();
    closeInlinePopover();
    const pop=document.createElement('div'); pop.className='combo-dropdown open';
    pop.style.position='fixed'; pop.style.right='auto';
    const rect=e.currentTarget.getBoundingClientRect();
    pop.style.top=Math.min(rect.bottom+4, window.innerHeight-220)+'px';
    pop.style.left=Math.max(8, Math.min(rect.left, window.innerWidth-170))+'px';
    pop.style.minWidth='150px'; pop.style.padding='6px'; pop.style.zIndex=10001;

    Object.keys(COLUMN_LABELS).forEach(key=>{
      const row=document.createElement('label');
      row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 7px;font-size:12.5px;color:var(--tx1);cursor:pointer;';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=visibleColumns[key];
      cb.onchange=()=>{ visibleColumns[key]=cb.checked; applyColumnVisibility(); saveColumnPrefs(); };
      row.appendChild(cb); row.appendChild(document.createTextNode(COLUMN_LABELS[key]));
      pop.appendChild(row);
    });

    document.body.appendChild(pop);
    activeInlinePopover=pop;
  }

  let contactRowCounter=1;
  function renderContacts(){
    const scroller=$('tab-contacts'), top=scroller.scrollTop;
    renderContactsList();
    scroller.scrollTop=top;
    updateContactsSortUI();
  }
  function renderContactsList(){
    renderDupesBanner();
    const list=$('contacts-list');
    list.innerHTML='';
    contactRowCounter=1;
    const q=$('contact-search').value.trim().toLowerCase();
    const typeFilter=$('contacts-type-filter').value;
    let items=activeContacts().filter(c=>{
      if(q && !(c.firstName+' '+c.lastName+' '+(c.company||'')+' '+(c.role||'')).toLowerCase().includes(q)) return false;
      if(typeFilter){
        const co=c.company?companies.find(x=>x.name===c.company):null;
        if(!co || co.type!==typeFilter) return false;
      }
      return true;
    });
    if(!items.length){
      const e=document.createElement('div'); e.className='empty-state'; e.textContent=(q||typeFilter)?'Aucun résultat.':'Aucun contact pour le moment.';
      list.appendChild(e);
      return;
    }
    const {key,dir}=contactsSort;
    const byName=(a,b)=>contactSortName(a).localeCompare(contactSortName(b),'fr',{sensitivity:'base', numeric:true});
    const byStars=(a,b)=>(companyStars(b.company)-companyStars(a.company))*dir || byName(a,b);
    const inGroup = (a,b)=>byName(a,b)*(key==='name'?dir:1);
    const pushRow=c=>{ list.appendChild(buildContactRow(c, contactRowCounter++)); if(expandedContacts.has(c.id)) list.appendChild(buildContactInfoCard(c)); };
    if(contactsView==='liste'){
      const byCo=(a,b)=>{ const ca=a.company||'', cb=b.company||''; if(!ca!==!cb) return ca?-1:1; return ca.localeCompare(cb,'fr',{sensitivity:'base'})*dir || byName(a,b); };
      items.sort(key==='co' ? byCo : key==='rel' ? byStars : inGroup).forEach(pushRow);
      return;
    }
    const groups={};
    items.forEach(c=>{ const k=c.company||'Sans société'; (groups[k]=groups[k]||[]).push(c); });
    Object.keys(groups).sort((a,b)=>{
      if(a==='Sans société') return 1; if(b==='Sans société') return -1;
      if(key==='rel'){ const d=(companyStars(b)-companyStars(a))*dir; if(d) return d; }
      return a.localeCompare(b,'fr',{sensitivity:'base'})*(key==='co'?dir:1);
    }).forEach(company=>{
      if(company==='Sans société'){
        list.appendChild(makeGroupHeader(company, null, groups[company].length));
        groups[company].sort(inGroup).forEach(pushRow);
        return;
      }
      list.appendChild(buildCompanyGroupHeader(company, groups[company].length));
      if(collapsedCompanies.has(company)) return;
      if(companyInfoOpen.has(company)) list.appendChild(buildCompanyInfoCard(company));
      groups[company].sort(inGroup).forEach(pushRow);
    });
  }

  let collapsedCompanies=new Set(), companyInfoOpen=new Set();
  let contactsSort={ key:'name', dir:1 };
  try{ const s=JSON.parse(localStorage.getItem('contacts-sort')||'null'); if(s&&['name','co','rel'].includes(s.key)&&(s.dir===1||s.dir===-1)) contactsSort=s; }catch(e){}
  // sorted as displayed (« Prénom Nom »), so the list reads alphabetically; nameless contacts last
  function contactSortName(c){ return [c.firstName,c.lastName].map(x=>String(x||'').trim()).filter(Boolean).join(' ') || '\uffff'; }
  function updateContactsSortUI(){
    document.querySelectorAll('.contacts-header-row .sort').forEach(el=>{
      const on=el.dataset.sort===contactsSort.key;
      el.classList.toggle('on', on);
      el.querySelector('.ar')?.remove();
      if(on){ const a=document.createElement('span'); a.className='ar'; a.textContent=(contactsSort.key==='rel' ? (contactsSort.dir>0?'▼':'▲') : (contactsSort.dir>0?'▲':'▼')); el.appendChild(a); }
    });
  }
  function companyHasInfo(co){ return !!(co && (co.whatTheyDo || co.website || (co.marketScope&&co.marketScope.length) || parcForCompany(co.name).length)); }
  function buildCompanyGroupHeader(companyName, count){
    const accent=clientColor(companyName);
    const header=document.createElement('div'); header.className='group-header company-group-header';
    header.style.display='flex'; header.style.alignItems='center'; header.style.gap='8px';

    const isCollapsed=collapsedCompanies.has(companyName);
    const expandBtn=document.createElement('button'); expandBtn.title=isCollapsed?'Afficher les contacts':'Masquer les contacts';
    expandBtn.style.cssText='background:none;border:none;color:var(--tx3);cursor:pointer;display:flex;align-items:center;padding:2px;flex-shrink:0;transition:transform .15s ease;';
    expandBtn.style.transform=isCollapsed?'rotate(0deg)':'rotate(90deg)';
    expandBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><polyline points="9 18 15 12 9 6"/></svg>';
    expandBtn.onclick=e=>{ e.stopPropagation(); if(isCollapsed) collapsedCompanies.delete(companyName); else collapsedCompanies.add(companyName); renderContacts(); };
    header.appendChild(expandBtn);

    const chip=document.createElement('div'); chip.className='company-group-chip';
    chip.style.background=accent+'2A'; chip.style.color=accent;
    chip.textContent=companyInitials(companyName);
    header.appendChild(chip);

    const label=document.createElement('span'); label.textContent=companyName; label.style.cssText='flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;font-size:12px;font-weight:600;color:var(--tx1);font-family:var(--font-ui);text-transform:none;letter-spacing:normal;';
    label.title='Cliquer pour éditer les infos de la société';
    label.onclick=()=>openCompanyEditForm(companyName);
    header.appendChild(label);
    const countEl=document.createElement('span'); countEl.className='group-count'; countEl.textContent='· '+count;
    header.appendChild(countEl);

    const co=companies.find(x=>x.name===companyName);
    header.appendChild(starsWidget(companyStars(companyName), n=>setCompanyStars(companyName, n)));
    const typeTag=document.createElement('span'); typeTag.className='company-type-tag';
    typeTag.textContent = co&&co.type ? co.type : '+ Type';
    typeTag.title='Cliquer pour changer le type d\u2019entreprise';
    typeTag.onclick=e=>openCompanyTypePopover(e, companyName);
    header.appendChild(typeTag);

    const sheetBtn=document.createElement('button'); sheetBtn.type='button'; sheetBtn.className='co-sheet-btn'; sheetBtn.textContent='Fiche';
    sheetBtn.title='Tout sur '+companyName+' : contacts, pipeline, contrats, échéances, historique';
    sheetBtn.onclick=e=>{ e.stopPropagation(); openCompanySheet(companyName); };
    header.appendChild(sheetBtn);
    if(companyHasInfo(co)){
      const infoOpen=companyInfoOpen.has(companyName);
      const info=document.createElement('button'); info.type='button'; info.className='co-info-btn';
      info.title=infoOpen?'Masquer les infos de la société':'Voir les infos de la société';
      info.setAttribute('aria-label', info.title); info.setAttribute('aria-expanded', infoOpen?'true':'false');
      info.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
      info.onclick=e=>{ e.stopPropagation(); if(infoOpen) companyInfoOpen.delete(companyName); else { companyInfoOpen.add(companyName); collapsedCompanies.delete(companyName); } renderContacts(); };
      header.appendChild(info);
    }

    return header;
  }

  function buildCompanyInfoCard(companyName){
    const co=companies.find(x=>x.name===companyName);
    const card=document.createElement('div');
    card.style.cssText='padding:8px 15px 12px 39px;font-size:12px;color:var(--tx2);line-height:1.6;';
    const parc=parcForCompany(companyName);
    if(parc.length){
      const won=parc.filter(p=>p.statut==='Gagné');
      const h=document.createElement('div'); h.className='co-parc-h';
      h.textContent='Portefeuille : '+won.length+' contrat'+(won.length>1?'s':'')+' gagné'+(won.length>1?'s':'')+(won.length?' · '+fmtMwc(won.reduce((s,p)=>s+p.kwc,0)):'')+(parc.length>won.length?' · '+(parc.length-won.length)+' autre'+(parc.length-won.length>1?'s':''):'');
      card.appendChild(h);
      parc.slice().sort((a,b)=>(a.fin||'9').localeCompare(b.fin||'9')).slice(0,6).forEach(p=>{
        const r=document.createElement('div'); r.className='co-parc-row';
        r.textContent=[p.inst||p.prod, p.kwc?fmtKwc(p.kwc):'', p.statut, p.fin?'fin '+pqIsoToFr(p.fin):''].filter(Boolean).join(' · ');
        card.appendChild(r);
      });
    }
    if(!co || (!co.whatTheyDo && !co.website && (!co.marketScope||!co.marketScope.length) && !co.type)){
      if(parc.length) return card;
      card.style.color='var(--tx3)'; card.style.fontStyle='italic';
      card.textContent='Aucune info renseignée pour cette société.';
      return card;
    }
    if(co.whatTheyDo){ const p=document.createElement('div'); p.textContent=co.whatTheyDo; card.appendChild(p); }
    if(co.website){ const p=document.createElement('div'); const a=document.createElement('a'); a.href=co.website.startsWith('http')?co.website:'https://'+co.website; a.target='_blank'; a.textContent=co.website; a.style.color='var(--accent)'; p.appendChild(a); card.appendChild(p); }
    if(co.marketScope&&co.marketScope.length){ const p=document.createElement('div'); p.textContent='Périmètre : '+co.marketScope.join(', '); card.appendChild(p); }
    return card;
  }

  let editingCompanyName=null;
  function openCompanyEditForm(companyName){
    editingCompanyName=companyName;
    let co=companies.find(x=>x.name===companyName);
    if(!co){ co={ id:'co_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name:companyName, whatTheyDo:'', marketScope:[], website:'', type:'', createdAt:Date.now(), updatedAt:Date.now(), deleted:false }; companies.push(co); }
    $('co-edit-title').textContent=companyName;
    $('co-whatdo').value=co.whatTheyDo||'';
    $('co-website').value=co.website||'';
    $('co-scope').value=(co.marketScope||[]).join(', ');
    $('co-type').value=co.type||'';
    let pickN=co.relevance||0;
    const drawPick=()=>{ const el=$('co-stars-pick'); el.innerHTML=''; el.appendChild(starsWidget(pickN, n=>{ pickN=(pickN===n)?0:n; el.dataset.value=pickN; drawPick(); })); el.dataset.value=pickN; };
    drawPick();
    $('co-type-list').innerHTML=companyTypesList.map(t=>'<option value="'+t.replace(/"/g,'&quot;')+'">').join('');
    $('company-edit-overlay').classList.remove('hidden');
    $('co-whatdo').focus();
  }
  function closeCompanyEditForm(){ $('company-edit-overlay').classList.add('hidden'); editingCompanyName=null; }
  function saveCompanyEdit(){
    const co=companies.find(x=>x.name===editingCompanyName);
    if(!co) return;
    co.whatTheyDo=$('co-whatdo').value.trim();
    co.website=$('co-website').value.trim();
    co.marketScope=$('co-scope').value.split(',').map(s=>s.trim()).filter(Boolean);
    const typeVal=$('co-type').value.trim();
    co.type=typeVal;
    co.relevance=parseInt($('co-stars-pick').dataset.value||'0',10);
    if(typeVal && !companyTypesList.includes(typeVal)){ companyTypesList.push(typeVal); saveCrmLocalOnly(); }
    touchCrm(co); saveCrm();
    closeCompanyEditForm();
    renderContacts();
    refreshAllViews();
  }

  function openCompanyTypePopover(e, companyName){
    e.stopPropagation();
    closeInlinePopover();
    const pop=document.createElement('div');
    pop.className='combo-dropdown open';
    pop.style.position='fixed'; pop.style.right='auto';
    const rect=e.currentTarget.getBoundingClientRect();
    pop.style.top=Math.min(rect.bottom+4, window.innerHeight-200)+'px';
    pop.style.left=Math.max(8, Math.min(rect.left, window.innerWidth-180))+'px';
    pop.style.minWidth='160px';
    pop.style.zIndex=10001;

    const input=document.createElement('input');
    input.type='text';
    let co=companies.find(x=>x.name===companyName);
    if(!co){ co={ id:'co_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name:companyName, whatTheyDo:'', marketScope:[], website:'', type:'', createdAt:Date.now(), updatedAt:Date.now(), deleted:false }; companies.push(co); }
    input.value=co.type||'';
    input.placeholder='Type d\u2019entreprise';
    input.style.cssText='width:100%;padding:7px 9px;background:var(--panel);border:1px solid var(--bd);border-radius:4px;color:var(--tx1);font-size:12px;box-sizing:border-box;';
    const itemsWrap=document.createElement('div');
    itemsWrap.style.cssText='max-height:150px;overflow-y:auto;margin-top:4px;';

    function apply(typeName){
      typeName=typeName.trim();
      co.type=typeName;
      touchCrm(co);
      if(typeName && !companyTypesList.includes(typeName)){ companyTypesList.push(typeName); }
      saveCrm();
      closeInlinePopover();
      renderContacts();
      refreshAllViews();
    }
    function renderItems(){
      const q=input.value.trim().toLowerCase();
      itemsWrap.innerHTML='';
      if(co.type){
        const clearRow=document.createElement('div'); clearRow.className='combo-item'; clearRow.style.color='var(--tx3)';
        clearRow.textContent='✕ Retirer';
        clearRow.onclick=()=>apply('');
        itemsWrap.appendChild(clearRow);
      }
      companyTypesList.slice().sort().filter(t=>t.toLowerCase().includes(q)).forEach(typeName=>{
        const row=document.createElement('div'); row.className='combo-item';
        const label=document.createElement('span'); label.className='combo-item-label'; label.textContent=typeName;
        row.appendChild(label);
        row.onclick=()=>apply(typeName);
        itemsWrap.appendChild(row);
      });
    }
    input.addEventListener('input', renderItems);
    input.addEventListener('keydown', ev=>{ if(ev.key==='Enter') apply(input.value); if(ev.key==='Escape') closeInlinePopover(); });

    pop.appendChild(input);
    pop.appendChild(itemsWrap);
    document.body.appendChild(pop);
    activeInlinePopover=pop;
    renderItems();
    input.focus();
  }

  let expandedContacts=new Set();
  function buildContactRow(c, rowNum){
    const row=document.createElement('div'); row.className='contact-row'+((rowNum%2===0)?' tint-alt':''); row.dataset.cid=c.id;

    const numSpan=document.createElement('span'); numSpan.className='row-num'; numSpan.textContent=rowNum||'';
    row.appendChild(numSpan);

    const av=document.createElement('div'); av.className='contact-avatar'; av.style.cursor='pointer';
    av.title='Voir la fiche (copier email/téléphone)';
    const hex=c.company?clientColor(c.company):'#6B7480';
    av.style.background=hex+'26'; av.style.color=hex;
    av.textContent=initials(c.firstName,c.lastName);
    av.onclick=e=>{ e.stopPropagation(); if(expandedContacts.has(c.id)) expandedContacts.delete(c.id); else expandedContacts.add(c.id); renderContacts(); };
    row.appendChild(av);

    const main=document.createElement('div'); main.className='contact-main'; main.style.cursor='pointer';
    main.title='Voir la fiche';
    main.onclick=()=>{ if(expandedContacts.has(c.id)) expandedContacts.delete(c.id); else expandedContacts.add(c.id); renderContacts(); };
    const name=document.createElement('div'); name.className='contact-name'; name.style.display='flex'; name.style.alignItems='center'; name.style.gap='5px';
    const nameText=document.createElement('span'); nameText.textContent=[c.firstName,c.lastName].filter(Boolean).join(' ')||'(sans nom)';
    name.appendChild(nameText);
    if(c.comment){
      const noteIcon=document.createElement('span'); noteIcon.title=c.comment; noteIcon.style.cssText='display:inline-flex;flex-shrink:0;color:var(--tx3);';
      noteIcon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      name.appendChild(noteIcon);
    }
    const sub=document.createElement('div'); sub.className='contact-sub'; sub.textContent=c.role||'';
    main.appendChild(name); main.appendChild(sub);
    row.appendChild(main);

    const companyCell=document.createElement('div'); companyCell.className='contact-company-cell';
    if(c.company){
      const pill=document.createElement('span'); pill.className='contact-company-pill'; pill.textContent=c.company; pill.dataset.peek='co:'+c.company;
      const chex=clientColor(c.company);
      pill.style.color=chex; pill.style.background=chex+'16';
      companyCell.appendChild(pill);
    }
    row.appendChild(companyCell);

    const emailCell=document.createElement('div'); emailCell.className='contact-meta';
    if(c.email){
      const b=document.createElement('button'); b.type='button'; b.title='Copier : '+c.email;
      b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
      copyIconOnClick(b, c.email);
      emailCell.appendChild(b);
    }
    row.appendChild(emailCell);

    const phoneCell=document.createElement('div'); phoneCell.className='contact-meta';
    if(c.phone1){
      const b=document.createElement('button'); b.type='button'; b.title='Copier : '+c.phone1;
      b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
      copyIconOnClick(b, c.phone1);
      phoneCell.appendChild(b);
    }
    if(c.phone2){
      const b2=document.createElement('button'); b2.type='button'; b2.title='Copier le 2e numéro : '+c.phone2;
      b2.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
      copyIconOnClick(b2, c.phone2);
      phoneCell.appendChild(b2);
    }
    row.appendChild(phoneCell);

    const stars=document.createElement('div'); stars.className='contact-stars';
    if(contactsView==='liste' && c.company){ stars.appendChild(starsWidget(companyStars(c.company))); stars.title='Note du client '+c.company; }
    row.appendChild(stars);

    const actions=document.createElement('div'); actions.className='contact-actions';
    const edit=document.createElement('button'); edit.className='edit-btn'; edit.title='Modifier le contact'; edit.setAttribute('aria-label','Modifier '+([c.firstName,c.lastName].filter(Boolean).join(' ')||'le contact'));
    edit.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    edit.onclick=e=>{ e.stopPropagation(); openContactForm(c); };
    actions.appendChild(edit);
    row.ondblclick=()=>openContactForm(c);
    const del=document.createElement('button'); del.className='del-btn'; del.title='Supprimer';
    del.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px;"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    del.onclick=()=>{ if(confirm('Supprimer ce contact ?')){ c.deleted=true; touchCrm(c); saveCrm(); renderContacts(); } };
    actions.appendChild(del);
    row.appendChild(actions);

    return row;
  }

  function createTaskForContact(c){
    document.querySelector('[data-tab="tasks"]').click();
    openAddForm();
    $('f-title').value='Contacter '+([c.firstName,c.lastName].filter(Boolean).join(' ')||'ce contact');
    if(c.company){ clientInput.value=c.company; clientDot.style.background=clientColor(c.company); }
    $('f-title').focus();
  }

  const PHONE_ICON_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  const MAIL_ICON_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';

  function buildContactInfoCard(c){
    const card=document.createElement('div'); card.className='contact-detail-card';

    // contact fields: icon + value, click to copy — no name/role/company/stars here,
    // that's already visible on the row directly above this card.
    const fields=[[MAIL_ICON_SVG,c.email,'Copier l’email'],[PHONE_ICON_SVG,c.phone1,'Copier le numéro'],[PHONE_ICON_SVG,c.phone2,'Copier le 2e numéro']].filter(([,v])=>v);
    if(fields.length){
      const fieldsWrap=document.createElement('div'); fieldsWrap.className='contact-detail-fields';
      fields.forEach(([iconSvg,val,title])=>{
        const row=document.createElement('div'); row.className='contact-detail-field-row';
        row.title=title;
        const icon=document.createElement('span'); icon.style.cssText='display:flex;flex-shrink:0;'; icon.innerHTML=iconSvg;
        const v=document.createElement('div'); v.className='contact-detail-field-value copyable'; v.textContent=val;
        row.appendChild(icon); row.appendChild(v);
        row.onclick=()=>copyToClipboard(val, v);
        fieldsWrap.appendChild(row);
      });
      card.appendChild(fieldsWrap);
    }

    if(c.comment){
      const com=document.createElement('div'); com.className='contact-detail-comment'; if(c.comment.includes('[[')) renderLinked(com, c.comment); else com.textContent=c.comment;
      card.appendChild(com);
    }
    { const mb=mentionsBlock('ct:'+c.id); if(mb) card.appendChild(mb); }

    // linked activity: meetings, opportunities and open tasks tied to the same company
    const contactMeetings=meetings.filter(m=>m.contactId===c.id && !m.deleted).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const linkedOpps=c.company ? activeOpportunities().filter(o=>o.company===c.company) : [];
    const linkedTasks=c.company ? tasks.filter(t=>!t.deleted && !t.archived && t.client===c.company) : [];

    function activitySection(label, items, build){
      if(!items.length) return;
      const sec=document.createElement('div'); sec.className='contact-activity-section';
      const lab=document.createElement('div'); lab.className='contact-activity-label'; lab.textContent=label;
      sec.appendChild(lab);
      items.slice(0,4).forEach(item=>sec.appendChild(build(item)));
      card.appendChild(sec);
    }

    activitySection('Rencontres', contactMeetings, m=>{
      const row=document.createElement('div'); row.className='contact-activity-row';
      const icon=document.createElement('span'); icon.style.cssText='display:flex;color:var(--tx3);flex-shrink:0;';
      icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
      row.appendChild(icon);
      const text=document.createElement('div'); text.className='contact-activity-row-text'; text.textContent=m.label;
      row.appendChild(text);
      const tag=document.createElement('span'); tag.className='contact-activity-row-tag'; tag.style.cssText='color:var(--tx3);background:var(--panel-2);'; tag.textContent=fmtDateShort(m.date)||'';
      row.appendChild(tag);
      return row;
    });

    activitySection('Opportunités liées', linkedOpps, o=>{
      const row=document.createElement('div'); row.className='contact-activity-row clickable';
      row.onclick=()=>{ document.querySelector('[data-tab="pipeline"]').click(); setTimeout(()=>openOppDetail(o.id),50); };
      const icon=document.createElement('span'); icon.style.cssText='display:flex;color:var(--accent);flex-shrink:0;';
      icon.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" style="width:13px;height:13px;"><path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21 7.5 13.5 2 9h7z"/></svg>';
      row.appendChild(icon);
      const text=document.createElement('div'); text.className='contact-activity-row-text'; text.textContent=o.title||o.company;
      row.appendChild(text);
      const tag=document.createElement('span'); tag.className='contact-activity-row-tag'; tag.style.cssText='color:var(--accent);background:var(--accent-dim);'; tag.textContent=o.stage==='perdu'?'Perdu':stageLabel(o.stage);
      row.appendChild(tag);
      return row;
    });

    activitySection('Tâches liées', linkedTasks, t=>{
      const row=document.createElement('div'); row.className='contact-activity-row clickable';
      row.onclick=()=>{ document.querySelector('[data-tab="tasks"]').click(); };
      const icon=document.createElement('span'); icon.style.cssText='display:flex;color:var(--tx3);flex-shrink:0;';
      icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>';
      row.appendChild(icon);
      const text=document.createElement('div'); text.className='contact-activity-row-text'; text.textContent=plainLinks(t.title);
      row.appendChild(text);
      if(t.due){ const tag=document.createElement('span'); tag.className='contact-activity-row-tag'; tag.style.cssText='color:var(--tx2);background:var(--panel-2);'; tag.textContent=fmtDateShort(t.due); row.appendChild(tag); }
      return row;
    });

    if(!fields.length && !c.comment && !contactMeetings.length && !linkedOpps.length && !linkedTasks.length){
      const p=document.createElement('div'); p.style.cssText='color:var(--tx3);font-style:italic;font-size:12px;margin-bottom:14px;'; p.textContent='Aucune info complémentaire.';
      card.appendChild(p);
    }

    const links=document.createElement('div'); links.className='contact-detail-links';
    const taskLink=document.createElement('button'); taskLink.type='button'; taskLink.textContent='+ Nouvelle tâche';
    taskLink.className='contact-detail-edit-link';
    taskLink.onclick=()=>createTaskForContact(c);
    links.appendChild(taskLink);
    const editBtn=document.createElement('button'); editBtn.type='button'; editBtn.textContent='Modifier la fiche';
    editBtn.className='contact-detail-edit-link';
    editBtn.onclick=()=>openContactForm(c);
    links.appendChild(editBtn);
    const netBtn=document.createElement('button'); netBtn.type='button'; netBtn.textContent='Voir dans le réseau'; netBtn.className='contact-detail-edit-link contact-net-link'; netBtn.onclick=()=>openInNetwork('ct:'+c.id);
    links.appendChild(netBtn);
    const delLink=document.createElement('button'); delLink.type='button'; delLink.textContent='Supprimer';
    delLink.className='contact-detail-edit-link danger-btn';
    delLink.onclick=()=>{ if(confirm('Supprimer ce contact ?')){ c.deleted=true; touchCrm(c); saveCrm(); renderContacts(); } };
    links.appendChild(delLink);
    card.appendChild(links);

    return card;
  }

  function openContactForm(c, prefill){
    editingContactId=c?c.id:null;
    const src=c||prefill||null;
    $('contact-form-title').textContent=c?'Modifier le contact':'Nouveau contact';
    $('contact-form').classList.remove('hidden');
    $('ct-first').value=src?src.firstName||'':'';
    $('ct-last').value=src?src.lastName||'':'';
    $('ct-role').value=src?src.role||'':'';
    $('ct-company').value=src?src.company||'':'';
    $('ct-email').value=src?src.email||'':'';
    $('ct-phone1').value=src?src.phone1||'':'';
    $('ct-phone2').value=src?src.phone2||'':'';
    $('ct-meeting').value='';
    $('ct-comment').value=src?src.comment||'':'';
    setRelevancePicker(c?c.relevance||0:0);
    $('ct-first').focus({preventScroll:true});
  }
  function closeContactForm(){ $('contact-form').classList.add('hidden'); editingContactId=null; }

  // Best-effort signature parser: never silently creates a contact, only
  // pre-fills the normal contact form for review — signatures vary too much
  // in layout for this to be treated as reliable on its own.
  // Never silently creates a contact: pre-fills the normal contact form for review.
  function parseSignatureText(text){
    const s=parseSignatureBlock(text);
    let company=s.societe;
    if(!company && s.mail){
      const domain=(s.mail.split('@')[1]||'');
      if(!PQ_GENERIC_DOMAINS.test(domain)){ const main=domain.split('.').slice(-2,-1)[0]||''; company=main?(findExistingCI(clientsList, main)||main.charAt(0).toUpperCase()+main.slice(1)):''; }
    }
    if(company){ const existing=findExistingCI(clientsList, company); if(existing) company=existing; }
    return { firstName:s.prenom, lastName:s.nom?pqTitleCase(s.nom):'', role:s.qualite, company:company||'', email:s.mail, phone1:s.tel, phone2:s.tel2, comment:[s.adresse, s.site].filter(Boolean).join(' · ') };
  }

  function setRelevancePicker(v){
    $('ct-relevance-picker').querySelectorAll('span').forEach(s=>s.classList.toggle('on', parseInt(s.dataset.v,10)<=v));
    $('ct-relevance-picker').dataset.value=v;
  }
  function saveContact(){
    const firstName=$('ct-first').value.trim(), lastName=$('ct-last').value.trim();
    if(!firstName && !lastName) return;
    const companyName=$('ct-company').value.trim();
    let c;
    if(editingContactId){ c=contacts.find(x=>x.id===editingContactId); }
    const oldFull=c?[c.firstName,c.lastName].filter(Boolean).join(' '):'';
    if(!c){
      c={ id:'ct_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), createdAt:Date.now(), deleted:false };
      contacts.push(c);
    }
    c.firstName=firstName; c.lastName=lastName; c.role=$('ct-role').value.trim();
    c.email=$('ct-email').value.trim(); c.phone1=$('ct-phone1').value.trim(); c.phone2=$('ct-phone2').value.trim();
    c.comment=$('ct-comment').value.trim();
    c.relevance=parseInt($('ct-relevance-picker').dataset.value||'0',10);
    if(companyName){
      const existing=findExistingCI(clientsList, companyName);
      c.company=existing||companyName;
      if(!existing){ clientsList.push(companyName); saveClients(); }
      if(!companies.find(co=>co.name===c.company)){ companies.push({ id:'co_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name:c.company, whatTheyDo:'', marketScope:[], website:'', createdAt:Date.now(), updatedAt:Date.now(), deleted:false }); }
    } else { c.company=''; }
    touchCrm(c);
    const meetingLabel=$('ct-meeting').value.trim();
    if(meetingLabel){
      const m={ id:'mt_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), contactId:c.id, label:meetingLabel, date:toISO(new Date()), createdAt:Date.now(), updatedAt:Date.now(), deleted:false };
      meetings.push(m);
    }
    saveCrm();
    if(oldFull) rewriteLinks(oldFull, [c.firstName,c.lastName].filter(Boolean).join(' '));
    closeContactForm();
    renderContacts();
  }

  // ---------- Pipeline agrégation ----------
  // Records live in `opportunities` (one synced list) with a `kind`:
  //  - 'prequal'      : a client met, no project yet (company level)
  //  - 'installation' : one plant = one line in the Pipe and BDD sheets; fields stored flat (key per column)
  //  - 'request'      : a pricing request grouping installations (installation.requestId)
  const PIPE_PHASES=[
    {key:'prequal',label:'Pré-qualif'},{key:'qualif',label:'Qualification'},{key:'offre',label:'Offre'},
    {key:'contrat',label:'Contrat'},{key:'onboarding',label:'Onboarding'},{key:'actif',label:'En service'}
  ];
  const OPP_EXITS={ no_go:'No Go', perdu:'Perdu', abandonne:'Abandonné' };
  const LEGACY_STAGE={ demarchage:'a_qualifier', prospect:'a_qualifier', pricing:'demande_prix', signature:'mise_signature', encodage:'onboarding', bascule:'actif' };
  const ONBOARDING_STEPS=[
    {k:'clauses',label:'Clauses communiquées pour paramétrage (prix, PN, dispo, pénalités)',who:'Com'},
    {k:'wattee_contrat',label:'Contrat créé dans WATTEE',who:'Com'},
    {k:'wattee_install',label:'Installation créée dans WATTEE',who:'Com'},
    {k:'periodes',label:'Périodes tarifaires créées',who:'Ops'},
    {k:'technique',label:'Données techniques ajoutées',who:'Ops'},
    {k:'arpei',label:'ARPE-I : remplie, signée, transmise à Enedis, reçue',who:'SC'},
    {k:'arpes',label:'ARPE-S : remplie, signée, transmise à Enedis, reçue',who:'SC'},
    {k:'stockage',label:'Contrat stocké sur SharePoint',who:'Com'},
    {k:'transmis',label:'Contrat transmis au SC et aux Ops',who:'Com'},
    {k:'tests',label:'Tests télémesure et prévision',who:'Ops'}
  ];

  const PQ_CHARGES=['PGU','EMC','QRY','MBA','TOR','SAM','SMA','JFO','LHD'];
  const PQ_ORIGINES=['Prospection','Contact direct','Crédit Agricole','BOAMP'];
  const PQ_ACTIONS=['Rendez-vous à prendre','A relancer','A rappeler','Appeler','En attente retour','A réévaluer'];
  const PQ_INSTALLS=['PV','Eolien','BIOGAZ','Hydro','PV et Eolien'];
  const PQ_CONTRATS=['AOS CRE','AO CRE CR','AO CRE','AO S21 CR','PPA Spot','Surplus ACC',"Sortie d'OA / CR",'A préciser'];
  const PQ_MARCHES=['AC','MD'];
  const PQ_NATURES=['Engageante','Non engageante'];
  const PQ_CAISSES=['Alpes Provence','Alsace Vosges','Anjou et Maine','Aquitaine','Atlantique Vendée','Brie Picardie','Centre-Est','Centre France','Centre Loire','Centre Ouest','Champagne-Bourgogne','Charente-Maritime Deux-Sèvres','Charente Périgord','Corse',"Côtes d'Armor",'Finistère','Franche-Comté','Guadeloupe','Ille-et-Vilaine','Languedoc','Loire Haute-Loire','Lorraine','Martinique-Guyane','Morbihan','Nord de France','Nord Est','Normandie','Normandie-Seine','Paris et Île-de-France','Provence Côte d\u2019Azur','Pyrénées Gascogne','Réunion','Savoie','Sud Méditerranée','Sud Rhône Alpes','Toulouse 31','Touraine Poitou','Val de France'];
  const PQ_CA_OPTIONS=['N/A','CAT&E'].concat(PQ_CAISSES.map(c=>'CR '+c));
  const PQ_REGIONS=['Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne','Centre-Val de Loire','Corse','Grand Est','Hauts-de-France','Ile-de-France','Normandie','Nouvelle-Aquitaine','Occitanie','Pays de la Loire',"Provence-Alpes-Côte d'Azur",'Guadeloupe','Martinique','Guyane','La Réunion','Mayotte'];
  const PQ_DEPTS=[['01','Ain',0],['02','Aisne',6],['03','Allier',0],['04','Alpes-de-Haute-Provence',12],['05','Hautes-Alpes',12],['06','Alpes-Maritimes',12],['07','Ardèche',0],['08','Ardennes',5],['09','Ariège',10],['10','Aube',5],['11','Aude',10],['12','Aveyron',10],['13','Bouches-du-Rhône',12],['14','Calvados',8],['15','Cantal',0],['16','Charente',9],['17','Charente-Maritime',9],['18','Cher',3],['19','Corrèze',9],['2A','Corse-du-Sud',4],['2B','Haute-Corse',4],['21',"Côte-d'Or",1],['22',"Côtes-d'Armor",2],['23','Creuse',9],['24','Dordogne',9],['25','Doubs',1],['26','Drôme',0],['27','Eure',8],['28','Eure-et-Loir',3],['29','Finistère',2],['30','Gard',10],['31','Haute-Garonne',10],['32','Gers',10],['33','Gironde',9],['34','Hérault',10],['35','Ille-et-Vilaine',2],['36','Indre',3],['37','Indre-et-Loire',3],['38','Isère',0],['39','Jura',1],['40','Landes',9],['41','Loir-et-Cher',3],['42','Loire',0],['43','Haute-Loire',0],['44','Loire-Atlantique',11],['45','Loiret',3],['46','Lot',10],['47','Lot-et-Garonne',9],['48','Lozère',10],['49','Maine-et-Loire',11],['50','Manche',8],['51','Marne',5],['52','Haute-Marne',5],['53','Mayenne',11],['54','Meurthe-et-Moselle',5],['55','Meuse',5],['56','Morbihan',2],['57','Moselle',5],['58','Nièvre',1],['59','Nord',6],['60','Oise',6],['61','Orne',8],['62','Pas-de-Calais',6],['63','Puy-de-Dôme',0],['64','Pyrénées-Atlantiques',9],['65','Hautes-Pyrénées',10],['66','Pyrénées-Orientales',10],['67','Bas-Rhin',5],['68','Haut-Rhin',5],['69','Rhône',0],['70','Haute-Saône',1],['71','Saône-et-Loire',1],['72','Sarthe',11],['73','Savoie',0],['74','Haute-Savoie',0],['75','Paris',7],['76','Seine-Maritime',8],['77','Seine-et-Marne',7],['78','Yvelines',7],['79','Deux-Sèvres',9],['80','Somme',6],['81','Tarn',10],['82','Tarn-et-Garonne',10],['83','Var',12],['84','Vaucluse',12],['85','Vendée',11],['86','Vienne',9],['87','Haute-Vienne',9],['88','Vosges',5],['89','Yonne',1],['90','Territoire de Belfort',1],['91','Essonne',7],['92','Hauts-de-Seine',7],['93','Seine-Saint-Denis',7],['94','Val-de-Marne',7],['95',"Val-d'Oise",7],['971','Guadeloupe',13],['972','Martinique',14],['973','Guyane',15],['974','La Réunion',16],['976','Mayotte',17]];
  const pqDeptLabel=d=>d[0].replace(/^0/,'')+' - '+d[1];
  const PQ_DEPT_OPTIONS=PQ_DEPTS.map(pqDeptLabel);
  const PQ_YIELD={ 'Hauts-de-France':950, 'Normandie':980, 'Ile-de-France':1000, 'Grand Est':1000, 'Bretagne':1050, 'Bourgogne-Franche-Comté':1080, 'Centre-Val de Loire':1100, 'Pays de la Loire':1100, 'Auvergne-Rhône-Alpes':1150, 'Nouvelle-Aquitaine':1200, 'Occitanie':1300, "Provence-Alpes-Côte d'Azur":1400, 'Corse':1400 };

  // Columns of the "Pipe agrégation" sheet, A → AK. sec 'centrale' = per installation, others shared by a producer's installations.
  const PQ_FIELDS=[
    { k:'annee', col:'A', label:'Année', type:'number', sec:'suivi' },
    { k:'new', col:'B', label:'New', type:'check', sec:'suivi' },
    { k:'charge', col:'C', label:"Chargé d'affaires", type:'select', opts:PQ_CHARGES, sec:'suivi', req:true },
    { k:'dateEntree', col:'D', label:'Date entrée pipe', type:'date', sec:'suivi' },
    { k:'origine', col:'E', label:'Origine du lead', type:'select', opts:PQ_ORIGINES, sec:'suivi' },
    { k:'ca', col:'F', label:'Crédit Agricole', type:'list', opts:PQ_CA_OPTIONS, sec:'suivi' },
    { k:'producteur', col:'G', label:'Nom Producteur', type:'text', sec:'prod', req:true },
    { k:'region', col:'H', label:'Région', type:'select', opts:PQ_REGIONS, sec:'centrale' },
    { k:'dept', col:'I', label:'Département', type:'list', opts:PQ_DEPT_OPTIONS, sec:'centrale' },
    { k:'marche', col:'J', label:'Type de marché', type:'select', opts:PQ_MARCHES, sec:'prod' },
    { k:'nom', col:'K', label:'Nom contact', type:'text', sec:'contact' },
    { k:'prenom', col:'L', label:'Prénom contact', type:'text', sec:'contact' },
    { k:'qualite', col:'M', label:'Qualité', type:'text', sec:'contact' },
    { k:'tel', col:'N', label:'Tel', type:'text', sec:'contact', req:true },
    { k:'mail', col:'O', label:'Mail', type:'text', sec:'contact', req:true },
    { k:'rdv1', col:'P', label:'RDV 1', type:'date', sec:'suite' },
    { k:'cr1', col:'Q', label:'CR', type:'check', sec:'suite' },
    { k:'rdv2', col:'R', label:'RDV 2', type:'date', sec:'suite' },
    { k:'cr2', col:'S', label:'CR2', type:'check', sec:'suite' },
    { k:'centrale', col:'T', label:'Nom Centrale', type:'text', sec:'centrale', req:true },
    { k:'install', col:'U', label:'Type installation', type:'select', opts:PQ_INSTALLS, sec:'centrale' },
    { k:'contrat', col:'V', label:'Type contrat', type:'select', opts:PQ_CONTRATS, sec:'centrale' },
    { k:'kwc', col:'W', label:'Puissance (kWc)', type:'number', sec:'centrale' },
    { k:'mwh', col:'X', label:'P50 (MWh/an)', type:'number', sec:'centrale' },
    { k:'mesPrev', col:'Y', label:'MES prévisionnelle', type:'text', sec:'centrale', ph:'jj/mm/aaaa ou « 2027 »' },
    { k:'mesEff', col:'Z', label:'MES effective', type:'text', sec:'centrale', ph:'jj/mm/aaaa' },
    { k:'debut', col:'AA', label:'Date début', type:'text', sec:'centrale', ph:'jj/mm/aaaa' },
    { k:'fin', col:'AB', label:'Date fin', type:'text', sec:'centrale', ph:'jj/mm/aaaa' },
    { k:'duree', col:'AC', label:'Durée (année)', type:'text', sec:'centrale' },
    { k:'particularites', col:'AD', label:'Particularités', type:'area', sec:'centrale', wide:true },
    { k:'stade', col:'AE', label:'Stade', type:'computed', sec:'none' },
    { k:'dateOffre', col:'AF', label:'Date remise 1ère offre', type:'date', sec:'suite' },
    { k:'nature', col:'AG', label:'Nature offre', type:'select', opts:PQ_NATURES, sec:'suite' },
    { k:'action', col:'AH', label:"Type d'action à réaliser", type:'select', opts:PQ_ACTIONS, sec:'suivi' },
    { k:'relance', col:'AI', label:'Date relance', type:'date', sec:'suivi' },
    { k:'commentaires', col:'AJ', label:'Commentaires', type:'area', sec:'comment', wide:true },
    { k:'qualification', col:'AK', label:'Qualification', type:'check', sec:'suite' }
  ];
  const PQ_SHARED_KEYS=PQ_FIELDS.filter(f=>f.sec!=='centrale' && f.sec!=='none').map(f=>f.k);
  // Plant details that are not Pipe columns but feed the BDD (Nom_prod, SIRET_prod, CP, P90) and the sheet
  const PQ_EXTRA_FIELDS=[
    { k:'spv', col:'BDD', label:'SPV (société de projet)', type:'text', sec:'centrale' },
    { k:'siret', col:'BDD', label:'SIRET', type:'text', sec:'centrale' },
    { k:'commune', col:'BDD', label:'Commune', type:'text', sec:'centrale' },
    { k:'cp', col:'BDD', label:'Code postal', type:'text', sec:'centrale' },
    { k:'p90', col:'BDD', label:'P90 (MWh)', type:'number', sec:'centrale' },
    { k:'productible', col:'BDD', label:'Productible (kWh/kWc)', type:'number', sec:'centrale' }
  ];
  const PQ_INST_GROUPS=[['Centrale',['centrale','install','contrat','spv','siret']], ['Lieu',['region','dept','commune','cp']],
    ['Production',['kwc','mwh','productible','p90']], ['Dates',['mesPrev','mesEff','debut','fin','duree']], ['',['particularites']]];
  const PQ_CENTRALE_KEYS=PQ_FIELDS.filter(f=>f.sec==='centrale').map(f=>f.k).concat(PQ_EXTRA_FIELDS.map(f=>f.k));

  const pqPad=n=>String(n).padStart(2,'0');
  const pqFold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pqTitleCase=s=>s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
  const pqIsoToFr=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); return m?m[3]+'/'+m[2]+'/'+m[1]:(s||''); };
  const pqAddDays=(n)=>{ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n); return toISO(d); };
  const PQ_MONTHS={ janvier:1, fevrier:2, mars:3, avril:4, mai:5, juin:6, juillet:7, aout:8, septembre:9, octobre:10, novembre:11, decembre:12 };
  const PQ_MONTH_LABEL={ janvier:'Janvier', fevrier:'Février', mars:'Mars', avril:'Avril', mai:'Mai', juin:'Juin', juillet:'Juillet', aout:'Août', septembre:'Septembre', octobre:'Octobre', novembre:'Novembre', decembre:'Décembre' };
  const PQ_MONTH_NAMES=['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];

  // ----- Mail parser (rules, runs locally: nothing leaves the browser) -----
  const PQ_EMAIL_RE=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const PQ_PHONE_RE=/(?:\+33\s?\(?0?\)?\s?|\b0)[1-9](?:[\s.\-]?\d{2}){4}\b/g;
  const pqIsCa=e=>{ const d=(e.split('@')[1]||'').toLowerCase(); return /^ca-|credit-?agricole|^ca\.|creditagricole/.test(d); };
  const PQ_CLOSINGS=/^(bien\s+)?(cordialement|à bientôt|a bientot|bien à vous|bien a vous|salutations|merci( d'avance| par avance| beaucoup)?|bonne (journée|journee|soirée|fin de journée)|best regards|regards|sincères salutations|je vous prie d.agr[ée]er|veuillez agr[ée]er|dans l.attente|--\s*$)/i;
  const PQ_LEGAL=/\b(SAS|SASU|SARL|EURL|SA|SCEA|EARL|GAEC|SCI|SNC|SEM|SPL|SCIC|SEML|GIE|SICA|CUMA|SELARL|S\.A\.S\.?|S\.A\.R\.L\.?)\b|\b(commune|mairie|communauté|syndicat|régie|regie|département|conseil)\b/i;
  const PQ_ROLE=/\b(directeur|directrice|gérant|gerant|gérante|président|presidente|responsable|chargé|chargée|ingénieur|ingenieure|ingénieure|associé|associée|dirigeant|dirigeante|fondateur|fondatrice|ceo|cfo|coo|cto|dg|daf|maire|adjoint|adjointe|manager|asset|chef|head|délégué|déléguée|exploitant|exploitante|agriculteur|agricultrice|technicien|technicienne|acheteur|acheteuse|secrétaire|assistant|assistante|comptable|conseiller|conseillère)\b/i;
  const PQ_HEADER=/^(de|from|à|a|to|cc|cci|envoyé|envoye|sent|date|objet|subject)\s*:/i;
  function pqFmtPhone(p){ let d=p.replace(/\D/g,''); if(d.startsWith('33')) d='0'+d.slice(2).replace(/^0/,''); return d.length===10?d.replace(/(\d{2})(?=\d)/g,'$1 ').trim():p.trim(); }
  // "9 800", "1.250 kWc" (thousands), "4,98 MWc", "2.5 MW" (decimal); "1.250 MWc" stays 1,25 MW
  const PQ_QTY='(?<![\\p{L}\\d.,])(\\d{1,3}(?:[ .]\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';
  function pqQty(s, unit){
    let t=String(s).replace(/\s/g,'');
    const big=/^(mw|mwc|gwh)$/i.test(unit||'');
    if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) && !(big && /^\d{1,3}\.\d{3}$/.test(t))) t=t.replace(/\./g,'');
    return parseFloat(t.replace(',','.'));
  }
  function pqNum(s){ return parseFloat(String(s).replace(/\s/g,'').replace(',','.')); }
  function pqCaisseFromText(s){
    const f=pqFold(s);
    if(/cat\s*&\s*e|transitions?\s*&?\s*energies/.test(f)) return 'CAT&E';
    let best=null;
    PQ_CAISSES.forEach(c=>{ const fc=pqFold(c).replace(/[^a-z0-9]/g,''); if(fc.length>3 && f.replace(/[^a-z0-9]/g,'').includes(fc) && (!best||fc.length>best.l)) best={c,l:fc.length}; });
    return best?'CR '+best.c:null;
  }
  function pqCaisseFromDomain(email){
    const slug=(email.split('@')[1]||'').toLowerCase().replace(/\.(fr|com|net)$/,'').replace(/^ca-/,'');
    const s=slug.replace(/[^a-z0-9]/g,'');
    if(!s || /credit|agricole/.test(s)) return null;
    let best=null;
    PQ_CAISSES.forEach(c=>{ const fc=pqFold(c).replace(/[^a-z0-9]/g,''); if(fc.includes(s)||s.includes(fc)){ if(!best||fc.length>best.l) best={c,l:fc.length}; } });
    return best?'CR '+best.c:'CR '+pqTitleCase(slug.replace(/-/g,' '));
  }
  function pqDeptFromPostal(cp){
    const n=parseInt(cp,10); if(!(n>=1000 && n<=98999)) return null;
    let code=cp.slice(0,2);
    if(code==='20') code=n<20200?'2A':'2B';
    if(code==='97'||code==='98') code=cp.slice(0,3);
    return PQ_DEPTS.find(d=>d[0]===code)||null;
  }
  function pqDeptFromText(s){
    const t=String(s||''); if(!t.trim()) return null;
    const cp=/\b((?:0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})\b/.exec(t); if(cp){ const d=pqDeptFromPostal(cp[1]); if(d) return d; }
    const code=/(?:^|\(|\s)(\d{2}|2A|2B|97\d)(?:\)|$)/.exec(t.trim()); if(code){ const d=PQ_DEPTS.find(x=>x[0]===code[1].padStart(2,'0')); if(d) return d; }
    const ft=pqFold(t);
    // hyphen last in the class: "[ '-]" (in "[ -']" it would be a range and "Seine-Maritime" would never match)
    return PQ_DEPTS.slice().sort((a,b)=>b[1].length-a[1].length).find(d=>new RegExp('(^|[^a-z])'+pqFold(d[1]).replace(/[-' ]/g,"[ '-]")+'([^a-z]|$)').test(ft))||null;
  }
  function pqParseDateLoose(s){
    s=pqFold(s);
    let m=/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s); if(m) return pqPad(m[1])+'/'+pqPad(m[2])+'/'+m[3];
    m=/(\d{4})-(\d{2})-(\d{2})/.exec(s); if(m) return m[3]+'/'+m[2]+'/'+m[1];
    m=/(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/.exec(s); if(m) return pqPad(m[1])+'/'+pqPad(PQ_MONTHS[m[2]])+'/'+m[3];
    m=/(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/.exec(s); if(m) return PQ_MONTH_LABEL[m[1]]+' '+m[2];
    // Excel's short form « juil-27 », « déc. 2027 », « sept-2028 »
    m=/\b(janv?|fevr?|mars|avr|mai|juin|juil|aout|sept?|oct|nov|dec)\.?[\s-]+(\d{2}|\d{4})\b/.exec(s);
    if(m){ const k={ jan:'janvier', janv:'janvier', fev:'fevrier', fevr:'fevrier', mars:'mars', avr:'avril', mai:'mai', juin:'juin', juil:'juillet', aout:'aout', sep:'septembre', sept:'septembre', oct:'octobre', nov:'novembre', dec:'decembre' }[m[1]];
      if(k) return PQ_MONTH_LABEL[k]+' '+(m[2].length===2?'20'+m[2]:m[2]); }
    m=/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/.exec(s); if(m) return Object.values(PQ_MONTH_LABEL)[['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(m[1])]+' '+m[2];
    m=/\bq([1-4])\s+(\d{4})/.exec(s); if(m) return 'T'+m[1]+' '+m[2];
    m=/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/.exec(s); if(m) return PQ_MONTH_LABEL[Object.keys(PQ_MONTHS)[parseInt(m[1],10)-1]]+' '+m[2];
    m=/\b(t[1-4]|[1-4](?:er|e|eme|ème)\s+trimestre)\s+(\d{4})/.exec(s); if(m){ const q=parseInt(m[1].replace(/\D/g,''),10); return 'T'+q+' '+m[2]; }
    m=/(ete|printemps|automne|hiver|debut|fin|courant)\s+(\d{4})/.exec(s); if(m) return m[0].replace(/^ete/,'été').replace(/^debut/,'début');
    m=/\b(20\d{2})\b/.exec(s); if(m) return m[1];
    return null;
  }
  // Excel serial date or JS Date → dd/mm/yyyy
  // A date read from Excel (SheetJS, cellDates) is built from a winter date plus a number of days: a summer date comes out
  // at 23:00 the day before (and very old ones a few minutes off). Back to the right calendar day.
  function xlDay(v){ const d=new Date(v.getTime()); if(d.getHours()>=22) d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d; }
  function pqCellDate(v){
    if(v instanceof Date && !isNaN(v)){ v=xlDay(v); return pqPad(v.getDate())+'/'+pqPad(v.getMonth()+1)+'/'+v.getFullYear(); }
    if(typeof v==='number' && v>20000 && v<80000){ const d=new Date(Math.round((v-25569)*86400000)); return pqPad(d.getUTCDate())+'/'+pqPad(d.getUTCMonth()+1)+'/'+d.getUTCFullYear(); }
    return pqParseDateLoose(String(v));
  }

  // Relays forward a lead without being the prospect: Crédit Agricole and colleagues (own domain).
  const PQ_INTERNAL_DOMAINS=['selfee.fr'];
  const pqIsInternal=e=>PQ_INTERNAL_DOMAINS.includes((e.split('@')[1]||'').toLowerCase());
  const pqIsRelay=e=>pqIsCa(e)||pqIsInternal(e);
  const PQ_GENERIC_DOMAINS=/^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|orange|wanadoo|free|sfr|laposte|neuf|icloud|me|aol|bbox|numericable|proton|protonmail)\./;
  // words that make a capitalised pair look like a name but are not people
  const PQ_NOT_NAME=/\b(cr[eé]dit|agricole|[eé]nergies?|solaire|syndicat|centrale|soci[eé]t[eé]|commune|mairie|parc|ville|groupe|service|transitions?|madame|monsieur|bonjour|cordialement|objet|projet|sas|sarl|earl|gaec|scea)\b/i;
  const PQ_NAME_RE=/^(?:(?:M\.|Mme|Mlle|Monsieur|Madame)\s+)?[A-ZÉÈÀÂÎÔ][\p{L}'’-]+(?:\s+(?:de\s+|de\s+la\s+|du\s+)?[A-ZÉÈÀÂÎÔ][\p{L}'’-]+){1,2}$/u;
  const PQ_FORM='SAS|SASU|SARL|EURL|EARL|GAEC|SCEA|SCI|SEM|SEML|SCIC|SPL|SA|SNC|GIE|SICA|CUMA';

  function pqSplitName(raw){
    let n=raw.trim().replace(/^(m\.|mme|mlle|monsieur|madame)\s+/i,'');
    const parts=n.split(/\s+/);
    // "DURAND Pierre": the all-caps word is the surname; otherwise the first word is the first name
    let fi=0; if(parts.length>1 && parts[0]===parts[0].toUpperCase() && parts[0].length>1 && parts[1]!==parts[1].toUpperCase()) fi=parts.length-1;
    return { prenom:pqTitleCase(fi===0?parts[0]:parts[parts.length-1]), nom:(fi===0?parts.slice(1).join(' '):parts.slice(0,-1).join(' ')).toUpperCase() };
  }
  const pqLooksLikeName=s=>PQ_NAME_RE.test(s.trim()) && !PQ_NOT_NAME.test(s) && /[a-zé]/.test(s);
  const pqLooksLikeCompany=s=>{
    const t=s.trim(); if(!t || t.split(/\s+/).length>7) return false;
    if(new RegExp('\\b('+PQ_FORM+')\\b').test(t) || /\b(commune|mairie|communaut[eé]|syndicat|r[eé]gie|d[eé]partement|conseil)\b/i.test(t)) return true;
    const letters=t.replace(/[^\p{L}]/gu,'');
    return letters.length>=4 && letters===letters.toUpperCase() && !pqLooksLikeName(t);
  };
  // "l'EARL Bastide", "la société VENTS DU NORD SAS", "SARL SOLEIL D'OC" inside a sentence
  function pqCompanyInText(s){
    // names never run onto the next line (spaces/tabs only between words)
    const W="[A-Z0-9ÉÈÀÂÎÔÛÇ][\\p{L}0-9'’&.-]*";
    let m=new RegExp('\\b('+PQ_FORM+')[ \\t]+('+W+'(?:[ \\t]+(?:(?:des|du|de|les|la|le)(?=[ \\t])|'+W+')){0,4})','u').exec(s);
    if(m){ const name=(m[1]+' '+m[2]).replace(/\s+(du|de|des|la|le|les)$/i,'').replace(/[.,;:]+$/,''); return name.toUpperCase(); }
    m=new RegExp("((?:[A-Z0-9ÉÈÀÂÎÔÛÇ][A-Z0-9ÉÈÀÂÎÔÛÇ'’&.-]+[ \\t]+){1,4})("+PQ_FORM+')\\b','u').exec(s);
    if(m) return (m[1]+m[2]).trim().toUpperCase();
    return null;
  }

  // ---------- Signature reader, shared by Contacts (« Coller une signature ») and the mail reader ----------
  // Works line by line, each line cut into parts on " | ", " – ", ", "; every part is classified as phone, mail,
  // web, address, name, role or company. The mail address helps: its local part names the person
  // (jean.dupont@ → Jean DUPONT) and its domain names the company (solairedumidi.fr → Solaire du Midi).
  const SIG_JUNK=/^\[cid:|^<image|^\[image|^image\d|envoy[ée] (de|depuis) mon|sent from my|get outlook|obtenir outlook|t[ée]l[ée]charger outlook|^[-—–_=*•·~]+$/i;
  const SIG_DISCLAIMER=/confidentiel|destinataires?\b|pi[eè]ces? jointes?|pensez [àa] l.environnement|avant d.imprimer|this (e-?mail|message)|intended (solely|only)|disclaimer|n.imprimez/i;
  const SIG_PHONE_LABEL=/^(t[ée]l[ée]?(?:phone)?|tel|t|fixe|ligne directe|direct|standard|bureau|office|mob(?:ile)?|port(?:able)?|gsm|m|cell(?:ular)?|fax|f)\s*\.?\s*:?\s*/i;
  const SIG_MAIL_LABEL=/^(e-?mail|courriel|mail|e)\s*\.?\s*:?\s*/i;
  const SIG_ROLE=/\b(directeur|directrice|director|g[ée]rante?|pr[ée]sidente?|president|responsable|charg[ée]e?|ing[ée]nieure?|engineer|associ[ée]e?|partner|dirigeante?|fondat(?:eur|rice)|founder|co-?fondat\p{L}*|ceo|cfo|coo|cto|dg|daf|dsi|vp|maire|adjointe?|manager|asset|chef|head|d[ée]l[ée]gu[ée]e?|exploitante?|agricult(?:eur|rice)|technicien(?:ne)?|acheteu(?:r|se)|secr[ée]taire|assistante?|comptable|conseill[eè]re?|consultante?|coordinat(?:eur|rice)|analyste?|analyst|officer|commerciale?|attach[ée]e?|juriste|avocate?|administrat(?:eur|rice)|gestionnaire|business developer|account)\b/iu;
  const SIG_PUBLIC=/\b(mairie|commune|communaut[eé]|syndicat|r[ée]gie|d[ée]partement|conseil (r[ée]gional|d[ée]partemental)|m[ée]tropole|agglom[ée]ration|ville de|sem\b|spl\b)/i;
  const SIG_ADDRESS=/\b\d{5}\b|\b(rue|avenue|av\.|bd|boulevard|chemin|route|place|all[ée]e|impasse|quai|cours|za|zi|zac|bp|cs|lieu-dit|lieudit|parc d.activit[ée]s)\b/i;
  const SIG_WEB=/https?:\/\/|www\.|linkedin|\b[a-z0-9-]+\.(fr|com|eu|net|org|bzh|re|io)\b(?!@)/i;
  const SIG_PARTICLES=/^(de|du|des|la|le|les|d'|van|von|da|di|del)$/i;

  function sigNameWords(s){
    const t=s.replace(/^(m\.|mr\.?|mme|mlle|monsieur|madame)\s+/i,'').trim();
    const w=t.split(/\s+/);
    if(w.length<2 || w.length>5) return null;
    // each word: a capitalised or all-caps word, or a particle (de, La, Le…) inside the name
    const capsWord=x=>x.length>1 && x===x.toUpperCase() && /\p{L}/u.test(x);
    // "BERTRAND julien": a lowercase first name is accepted next to an all-caps surname
    const lowerOk=w.length===2 && w.some(capsWord) && w.some(x=>/^[a-zéèàâîôûç][\p{L}'’-]+$/u.test(x));
    if(!lowerOk && !w.every((x,i)=>/^[A-ZÉÈÀÂÎÔÛÇ][\p{L}'’-]*$/u.test(x) || (i>0 && SIG_PARTICLES.test(x)))) return null;
    if(w.filter(x=>!SIG_PARTICLES.test(x)).length<2 && !SIG_PARTICLES.test(w[1])) return null;
    return w;
  }
  function sigLocalTokens(mail){
    if(!mail) return [];
    const whole=pqFold(mail.split('@')[0]).split(/[._]+/).filter(Boolean);
    return whole.concat(...whole.filter(t=>t.includes('-')).map(t=>t.split('-')));
  }
  function sigDomainStem(mail){ if(!mail) return ''; const d=(mail.split('@')[1]||'').toLowerCase(); if(PQ_GENERIC_DOMAINS.test(d)) return ''; return pqFold(d.replace(/\.[a-z]{2,4}$/,'')).replace(/[^a-z0-9]/g,''); }
  // How much a part looks like the person's name (0 = not a name)
  function sigNameScore(part, tokens, stem){
    const w=sigNameWords(part); if(!w) return 0;
    const f=pqFold(part);
    if(stem && f.replace(/[^a-z0-9]/g,'')===stem) return 0;
    if(SIG_ROLE.test(part) || SIG_PUBLIC.test(part) || new RegExp('\\b('+PQ_FORM+')\\b').test(part) || /\b(energie|energies|solaire|solar|capital|groupe|group|eolien|hydro|metha|soleil|vents?|centrale|parc|sas|sarl)\b/.test(f)) return 0;
    let score=1;
    const words=w.map(x=>pqFold(x).replace(/[^a-z]/g,'')).filter(Boolean);
    const joined=tokens.join('');
    if(tokens.length && words.some(x=>x.length>2 && (tokens.includes(x) || joined.includes(x)))) score+=3;
    if(/[a-zé]/.test(part)) score+=1;   // mixed case looks more like a person than an all-caps company
    return score;
  }
  function sigSplitName(part, tokens){
    const w=sigNameWords(part);
    const caps=w.map(x=>x.length>1 && x===x.toUpperCase());
    let first=[], last=[];
    if(caps.some(Boolean) && !caps.every(Boolean)){
      // "Jean DUPONT" / "DURAND Pierre": the all-caps words are the surname
      w.forEach((x,i)=>{ (caps[i] || (SIG_PARTICLES.test(x) && i>0 && caps[i+1]))?last.push(x):first.push(x); });
    } else {
      // all caps or all capitalised: the mail says which word is the surname, else the first word is the first name
      // surname = the word matching the last block of the address (anne-sophie.leclerc → leclerc)
      const lastTok=tokens.length?tokens.filter(t=>!t.includes('-'))[tokens.filter(t=>!t.includes('-')).length-1]:'';
      const blocks=tokens.filter(t=>!tokens.some(u=>u!==t && u.includes('-') && u.split('-').includes(t)));
      const surname=blocks.length>1?blocks[blocks.length-1]:lastTok;
      const li=surname?w.findIndex((x,i)=>i>0 && pqFold(x).replace(/[^a-z]/g,'')===surname):-1;
      const fi=tokens.length?w.findIndex(x=>{ const fx=pqFold(x).replace(/[^a-z-]/g,''); return tokens[0]===fx || (tokens[0]===fx[0] && tokens.length>1) || tokens[0]===fx.split('-').map(y=>y[0]).join(''); }):-1;
      if(li>0){ first=w.slice(0,li); last=w.slice(li); }
      else if(fi>0){ first=w.slice(fi); last=w.slice(0,fi); }
      else { first=[w[0]]; last=w.slice(1); }
    }
    return { prenom:first.map(x=>x.split('-').map(y=>y.charAt(0).toUpperCase()+y.slice(1).toLowerCase()).join('-')).join(' '), nom:last.join(' ').toUpperCase() };
  }
  function sigPhones(line){
    const out=[]; const re=new RegExp(PQ_PHONE_RE.source,'g'); let m;
    while((m=re.exec(line))){ out.push({ num:pqFmtPhone(m[0]), at:m.index }); }
    return out;
  }
  function parseSignatureBlock(text, hint){
    hint=hint||{};
    const res={ prenom:'', nom:'', qualite:'', societe:'', mail:'', tel:'', tel2:'', adresse:'', site:'' };
    let lines=String(text||'').replace(/\r/g,'').replace(/ /g,' ').split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
    lines=lines.filter(l=>!SIG_JUNK.test(l) && !(SIG_DISCLAIMER.test(l) && l.split(' ').length>8) && !PQ_CLOSINGS.test(l));
    const mails=[...new Set(lines.join('\n').match(PQ_EMAIL_RE)||[])].map(e=>e.toLowerCase());
    res.mail=hint.mail || mails.find(e=>!pqIsRelay(e)) || mails[0] || '';
    const tokens=sigLocalTokens(res.mail), stem=sigDomainStem(res.mail);
    // phones, ranked: mobile (06/07 or labelled mobile) > direct line > other > switchboard
    const phones=[];
    lines.forEach(l=>{
      const segs=l.split(/\s+[-–|·]\s+|\s{2,}|;\s*/);
      segs.forEach(seg=>{
        sigPhones(seg).forEach(p=>{
          const lab=pqFold(seg.slice(0,p.at));
          let rank=/^0[67]/.test(p.num)?0:2;
          if(/mob|port|gsm|cell|\bm\b/.test(lab)) rank=0; else if(/direct/.test(lab)) rank=1; else if(/standard|fax|\bf\b/.test(lab)) rank=/fax|\bf\b/.test(lab)?9:3;
          if(rank<9 && !phones.some(x=>x.num===p.num)) phones.push({ num:p.num, rank, order:phones.length });
        });
      });
    });
    phones.sort((a,b)=>a.rank-b.rank || a.order-b.order);
    if(phones[0]) res.tel=phones[0].num;
    if(phones[1]) res.tel2=phones[1].num;
    // classify the remaining parts
    const parts=[];
    lines.forEach((l,li)=>{
      l.split(/\s+[-–|·•]\s+|,\s+|\s\|\s?|\|/).map(p=>p.trim()).filter(Boolean).forEach(p=>parts.push({ p, li }));
    });
    const names=[], roles=[], companies=[];
    parts.forEach(({p,li})=>{
      if(new RegExp(PQ_EMAIL_RE.source).test(p) || SIG_MAIL_LABEL.test(p) && new RegExp(PQ_EMAIL_RE.source).test(p)) return;
      if(sigPhones(p).length || (SIG_PHONE_LABEL.test(p) && /\d{2}/.test(p) && !/[a-z]{4,}/i.test(p.replace(SIG_PHONE_LABEL,'')))) return;
      if(SIG_WEB.test(p)){ if(!res.site && !/linkedin/i.test(p)) res.site=p.replace(/^(web|site(?: web)?|w)\s*:?\s*/i,''); return; }
      if(SIG_ADDRESS.test(p) && !SIG_ROLE.test(p)){ res.adresse=(res.adresse?res.adresse+', ':'')+p; return; }
      if(p.split(' ').length>9) return;
      const ns=sigNameScore(p, tokens, stem);
      if(ns){ names.push({ p, li, score:ns }); return; }
      // "Gérant BREIZH SOLAR": a role followed by an all-caps company
      const rc=new RegExp('^(.{3,40}?)\\s+((?:[A-Z0-9ÉÈÀÂÎÔÛÇ][A-Z0-9ÉÈÀÂÎÔÛÇ\'’&.-]+\\s*){1,5})$','u').exec(p);
      if(rc && SIG_ROLE.test(rc[1]) && !SIG_ROLE.test(rc[2]) && !/^(g[ée]n[ée]ral|technique|commercial|financier|adjoint|d[ée]l[ée]gu[ée]|administratif|op[ée]rationnel|marketing|juridique|rh)$/i.test(rc[2].trim())){ roles.push({ p:rc[1], li }); companies.push({ p:rc[2].trim(), li, score:3 }); return; }
      const f=pqFold(p).replace(/[^a-z0-9]/g,'');
      const isLegal=new RegExp('\\b('+PQ_FORM+')\\b').test(p)||/cr[ée]dit agricole|caisse r[ée]gionale|caisse d.[ée]pargne|banque populaire|soci[ée]t[ée] g[ée]n[ée]rale|bnp/i.test(p), isPublic=SIG_PUBLIC.test(p);
      const letters=p.replace(/[^\p{L}]/gu,''), allCaps=letters.length>=4 && letters===letters.toUpperCase();
      const domainHit=stem && f.length>=4 && (f===stem || stem.includes(f) || f.includes(stem));
      const isRole=SIG_ROLE.test(p) && !isLegal && !(isPublic && /^(mairie|commune|syndicat|communaut)/i.test(p));
      if(isRole && !domainHit){ roles.push({ p, li }); return; }
      if(isLegal || isPublic || domainHit || allCaps){
        let score=(isLegal?4:0)+(domainHit?4:0)+(isPublic?3:0)+(allCaps?1:0);
        if(/^groupe?\b/i.test(p)) score-=3;
        companies.push({ p, li, score });
      }
    });
    if(names.length){
      names.sort((a,b)=>b.score-a.score || a.li-b.li);
      const n=sigSplitName(names[0].p, tokens); res.prenom=n.prenom; res.nom=n.nom;
    }
    if(roles.length) res.qualite=roles[0].p.replace(/\s*[-–|,:]\s*$/,'');
    if(companies.length){ companies.sort((a,b)=>b.score-a.score || a.li-b.li); res.societe=companies[0].p; }
    return res;
  }

  // Everyone of a document: each sender of a mail thread with their signature, people in To/Cc, the signature of a
  // pasted reply. Colleagues and bank relays are left out. Merged by address; senders first.
  function pqSplitDisplayName(s){
    const t=String(s||'').replace(/["'\[\]()]/g,' ').replace(PQ_CIVILITY,'').replace(/\s+/g,' ').trim();
    if(!t || /@/.test(t) || PQ_NOT_NAME.test(t)) return null;
    const w=t.split(' '); if(w.length<2 || w.length>4) return null;
    const caps=x=>x.length>1 && x===x.toUpperCase() && /[A-Z]/.test(pqFold(x).toUpperCase());
    if(caps(w[0]) && !caps(w[w.length-1])) return { prenom:pqTitleCase(w.slice(1).join(' ')), nom:w[0].toUpperCase() };
    return { prenom:pqTitleCase(w.slice(0,-1).join(' ')), nom:w[w.length-1].toUpperCase() };
  }
  const PQ_ROBOT=/^(no-?reply|ne-?pas-?repondre|notification|mailer-daemon|postmaster)@/i;
  function pqDetectPeople(raw){
    const text=String(raw||'').replace(/\r/g,'').replace(/\u00a0/g,' ').replace(/<(mailto|tel):[^>]*>/gi,'').replace(/^[ \t]*(>[ \t]?)+/gm,'');
    const lines=text.split('\n').map(l=>l.trim()); if(!text.trim()) return [];
    const blocks=[]; let cur={ from:null, lines:[], to:[] };
    lines.forEach(l=>{
      const m=/^(de|from)\s*:\s*(.*)$/i.exec(l)||/^(le|on)\s.{6,120}?(<?[\w.+-]+@[\w.-]+>?).{0,40}(a [ée]crit|wrote)\s*:?\s*$/i.exec(l);
      if(m){ if(cur.lines.length||cur.from) blocks.push(cur); cur={ from:/^(de|from)$/i.test(m[1])?m[2]:l, lines:[], to:[] }; return; }
      const r=/^(à|a|to|cc|cci|bcc)\s*:\s*(.+)$/i.exec(l); if(r){ cur.to.push(r[2]); return; }
      cur.lines.push(l);
    });
    blocks.push(cur);
    const people=new Map();
    const ok=mail=>mail && !pqIsRelay(mail) && !PQ_ROBOT.test(mail);
    const add=(p, sender)=>{
      const mail=(p.mail||'').toLowerCase(); if(mail && !ok(mail)) return;
      if(!mail && !(p.prenom && p.nom)) return;
      const key=mail||pqFold(p.prenom+' '+p.nom), was=people.get(key)||{ prenom:'', nom:'', qualite:'', tel:'', tel2:'', mail, sender:false };
      ['prenom','nom','qualite','tel','tel2'].forEach(k=>{ if(!was[k] && p[k]) was[k]=p[k]; });
      was.sender=was.sender||sender; people.set(key, was);
    };
    blocks.forEach((b,bi)=>{
      const email=(((b.from||'').match(PQ_EMAIL_RE)||[])[0]||'').toLowerCase();
      const body=b.lines.filter(l=>l && !PQ_HEADER.test(l));
      let sigStart=-1; body.forEach((l,i)=>{ if(PQ_CLOSINGS.test(l)) sigStart=i; });
      const sigLines=(sigStart>=0?body.slice(sigStart+1):body.slice(-8)).filter(l=>!/message d.origine|original message|forwarded message/i.test(l)).slice(0,10);
      const sig=sigLines.length?parseSignatureBlock(sigLines.join('\n'), email?{ mail:email }:{}):{};
      const sigMail=(sig.mail||'').toLowerCase();
      if(email && ok(email)){
        const dn=pqSplitDisplayName((b.from||'').replace(/<.*?>/,'').replace(PQ_EMAIL_RE,''));
        const sigIsHim=!sigMail || sigMail===email;
        add({ prenom:(sigIsHim&&sig.prenom)||(dn&&dn.prenom)||'', nom:(sigIsHim&&sig.nom)||(dn&&dn.nom)||'', qualite:sigIsHim?sig.qualite:'', tel:sigIsHim?sig.tel:'', tel2:sigIsHim?sig.tel2:'', mail:email }, true);
      } else if(!b.from && bi===0 && sigMail && ok(sigMail) && (sig.prenom||sig.nom)){
        add({ prenom:sig.prenom, nom:sig.nom, qualite:sig.qualite, tel:sig.tel, tel2:sig.tel2, mail:sigMail }, true);   // a reply pasted without its header
      }
      b.to.forEach(list=>list.split(/[;,](?![^<]*>)/).forEach(part=>{
        const mail=((part.match(PQ_EMAIL_RE)||[])[0]||'').toLowerCase(); if(!mail) return;
        const dn=pqSplitDisplayName(part.replace(/<.*?>/,'').replace(PQ_EMAIL_RE,''));
        add({ prenom:dn?dn.prenom:'', nom:dn?dn.nom:'', mail }, false);
      }));
    });
    return [...people.values()].sort((a,b)=>(b.sender?1:0)-(a.sender?1:0));
  }
  function parsePipeMail(raw){
    const out={};
    // clean-up: "<mailto:…>" / "<tel:…>" copies left by Outlook, "> " quote marks of plain-text replies
    let text=String(raw||'').replace(/\r/g,'').replace(/\u00a0/g,' ').replace(/<(mailto|tel):[^>]*>/gi,'').replace(/^[ \t]*(>[ \t]?)+/gm,'');
    // English mail: "12,400 MWh" is twelve thousand four hundred
    const english=(text.match(/\b(the|our|and|is|with|we|hi|best regards|please|plant)\b/gi)||[]).length>=4;
    if(english) text=text.replace(/(\d),(\d{3})(?![\d,])/g,'$1$2');
    const lines=text.split('\n').map(l=>l.trim());
    if(!text.trim()) return out;
    const all=[...new Set((text.match(PQ_EMAIL_RE)||[]).map(e=>e.toLowerCase()))];
    const caEmails=all.filter(pqIsCa);
    // Split a forward chain at each "De :"/"From:" header; the prospect is the latest block whose sender is not a relay.
    const blocks=[]; let cur={ from:null, lines:[] };
    // a new quoted message starts at "De : …" / "From: …" or at "Le jeu. 9 oct. 2026 à 11:02, X <x@y> a écrit :"
    lines.forEach(l=>{
      const m=/^(de|from)\s*:\s*(.*)$/i.exec(l)||/^(le|on)\s.{6,120}?(<?[\w.+-]+@[\w.-]+>?).{0,40}(a [ée]crit|wrote)\s*:?\s*$/i.exec(l);
      if(m){ if(cur.lines.length||cur.from) blocks.push(cur); cur={ from:/^(de|from)$/i.test(m[1])?m[2]:l, lines:[] }; } else cur.lines.push(l);
    });
    blocks.push(cur);
    blocks.forEach(b=>{ b.email=((b.from||'').match(PQ_EMAIL_RE)||[])[0]||null; b.relay=b.email?pqIsRelay(b.email):false; });
    let prospect=blocks.slice().reverse().find(b=>b.from && b.email && !b.relay)||null;
    // a reply to us (or to the bank) pasted without its own header: the top message is the prospect's
    if(!prospect && blocks.length>1 && !blocks[0].from && blocks.slice(1).every(b=>b.relay)) prospect=blocks[0];
    if(!prospect){ const b=blocks[blocks.length-1]; prospect=(b.relay||(!b.from && blocks.some(x=>x.relay)))?null:b; }
    const body=prospect?prospect.lines.filter(l=>!PQ_HEADER.test(l)):lines.filter(l=>!PQ_HEADER.test(l));
    const bodyText=body.join('\n');
    const subj=lines.map(l=>/^(objet|subject)\s*:\s*(.*)$/i.exec(l)).filter(Boolean).map(m=>m[2].replace(/^((tr|fw|fwd|re)\s*:\s*)+/i,'').trim()).filter(Boolean);
    const subject=subj[subj.length-1]||subj[0]||'';

    // Origin & Crédit Agricole caisse (a caisse name alone, e.g. "Morbihan", is not enough)
    let caisse=null;
    caEmails.forEach(e=>{ caisse=caisse||pqCaisseFromDomain(e); });
    const mentionsCa=/cr[eé]dit\s+agricole|\bca\s+(transitions|t&e)|cat\s*&\s*e/i.test(text);
    const caText=(caEmails.length||mentionsCa)?pqCaisseFromText(text):null;
    if(caText==='CAT&E' || (!caisse && caText)) caisse=caText;
    if(caEmails.length || caisse || (mentionsCa && !prospect)){ out.origine='Crédit Agricole'; out.ca=caisse||'N/A'; }
    else if(/boamp/i.test(text)){ out.origine='BOAMP'; out.ca='N/A'; }
    else { out.origine='Contact direct'; out.ca='N/A'; }

    let caPerson=null;
    if(caEmails.length){
      const idx=lines.findIndex(l=>l.toLowerCase().includes(caEmails[0]));
      for(let i=idx-1;i>=Math.max(0,idx-5);i--){ const l=lines[i]; if(/^[A-ZÉÈ][a-zéèëêïîôç-]+(\s+[A-ZÉÈ][\wéèëêïîôç'-]+){1,2}$/.test(l)){ caPerson=l; break; } }
      if(!caPerson){ const hb=blocks.find(b=>b.relay && pqIsCa(b.email||'')); if(hb) caPerson=(hb.from||'').replace(/<.*?>/,'').replace(/["']/g,'').trim()||null; }
    }

    // The prospect's own address: sender of its block, else an address quoted in the body by the relay
    const nonRelay=all.filter(e=>!pqIsRelay(e));
    let inlineLine=null;
    if(prospect && prospect.email && !pqIsRelay(prospect.email)) out.mail=prospect.email.toLowerCase();
    else if(nonRelay.length){
      out.mail=nonRelay[0];
      inlineLine=lines.find(l=>l.toLowerCase().includes(nonRelay[0]))||null;
    }
    if(!out.mail) delete out.mail;

    // Phones: on the line that quotes the prospect first, then in the prospect's part
    const phoneSrc=(inlineLine&&new RegExp(PQ_PHONE_RE.source).test(inlineLine)?inlineLine+'\n':'')+bodyText;
    const phones=[...new Set((phoneSrc.match(PQ_PHONE_RE)||[]).map(pqFmtPhone))];
    if(phones.length) out.tel=phones.slice(0,2).join(' / ');

    let name=null, role=null, company=null;
    if(prospect){
      // Signature: lines after the last closing formula; each line may hold "Name – Role, COMPANY, phone"
      let sigStart=-1;
      body.forEach((l,i)=>{ if(PQ_CLOSINGS.test(l)) sigStart=i; });
      const sigLines=(sigStart>=0?body.slice(sigStart+1):body.slice(-8)).filter(l=>l && !/message d.origine|original message|forwarded message/i.test(l)).slice(0,10);
      const sig=parseSignatureBlock(sigLines.join('\n'), { mail:out.mail });
      if(sig.prenom||sig.nom) name=[sig.prenom, sig.nom].filter(Boolean).join(' ');
      if(sig.qualite) role=sig.qualite;
      if(sig.societe) company=sig.societe;
      // the signature's phones, mobile first, win over numbers quoted elsewhere in the mail
      if(sig.tel) out.tel=[sig.tel, sig.tel2].filter(Boolean).join(' / ');
      if(!name && prospect.from){ const dn=prospect.from.replace(/<.*?>/,'').replace(PQ_EMAIL_RE,'').replace(/["'\[\]]/g,'').trim(); if(dn && dn.split(/\s+/).length>=2 && dn.split(/\s+/).length<=4 && !PQ_NOT_NAME.test(dn)) name=dn; }
    } else if(inlineLine){
      // relay mail: "M. Hugo Lefebvre, hugo@…, 06…" — the name closest before the address
      const at=inlineLine.toLowerCase().indexOf(out.mail);
      const before=inlineLine.slice(0,at);
      const re=/(?:(?:M\.|Mme|Monsieur|Madame)\s+)?([A-ZÉÈÀÂÎÔ][\p{L}'’-]+)\s+([A-ZÉÈÀÂÎÔ][\p{L}'’-]+)/gu;
      let m, best=null;
      while((m=re.exec(before))){ if(!PQ_NOT_NAME.test(m[0]) && /[a-zé]/.test(m[0])) best=m[1]+' '+m[2]; }
      if(!best){
        // or a few lines above, introduced by a civility ("M. Olivier Mercier, gérant de …")
        const li=lines.indexOf(inlineLine);
        for(let i=li-1;i>=Math.max(0,li-3) && !best;i--){ const c=/(?:M\.|Mme|Monsieur|Madame)\s+([A-ZÉÈÀÂÎÔ][\p{L}'’-]+)\s+([A-ZÉÈÀÂÎÔ][\p{L}'’-]+)/u.exec(lines[i]); if(c) best=c[1]+' '+c[2]; }
      }
      if(best) name=best;
    }
    if(name){ const n=pqSplitName(name); out.prenom=n.prenom; out.nom=n.nom; }
    if(role) out.qualite=role.replace(/\s*[-–|,]\s*$/,'');
    // figures: the prospect's message first, then the other messages of the producer's side in the thread (a later reply
    // often brings the power or the volume)
    const sideText=prospect?blocks.filter(b=>b!==prospect && b.email && !b.relay).map(b=>b.lines.filter(l=>!PQ_HEADER.test(l)).join('\n')):[];
    const scope=prospect?[bodyText].concat(sideText).join('\n'):text;
    if(!company) company=pqCompanyInText(prospect?bodyText:lines.filter(l=>!(caPerson && l.includes(caPerson))).join('\n'));
    if(!company){ const m=/\b(?:société|societe|entreprise|ferme|exploitation|commune de|ville de)\s+([A-Z][\p{L}'&.\- ]{2,40})/u.exec(scope); if(m) company=(/^(commune|ville)/i.test(m[0])?m[0]:m[1]).trim(); }
    if(!company && out.mail && !PQ_GENERIC_DOMAINS.test(out.mail.split('@')[1]||'')){
      company=(out.mail.split('@')[1]||'').replace(/\.[a-z]{2,4}$/,'').replace(/[-_.]+/g,' ');
    }
    if(company) out.producteur=company.replace(/\s+/g,' ').trim().toUpperCase();

    // Location: postal code (5 digits, overseas 97x xx), "(46)", "département … 64", then département names
    let dept=null, city=null;
    const noContact=scope.replace(PQ_EMAIL_RE,' ').replace(PQ_PHONE_RE,' ');
    const cpm=/\b(?:[àa]|sur|de|commune de)?\s*([A-ZÉÈ][\p{L}'-]+(?:[ -][A-ZÉÈ]?[\p{L}'-]+){0,3})?\s*,?\s*\(?\b((?:0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})\b\)?/u.exec(noContact);
    if(cpm){ dept=pqDeptFromPostal(cpm[2]); if(cpm[1] && !/^(Le|La|Les|De|Du|Des)$/.test(cpm[1])) city=cpm[1].trim(); }
    if(!dept){ const m=/\((\d{2}|2A|2B|97\d)\)/.exec(noContact); if(m) dept=PQ_DEPTS.find(d=>d[0]===m[1].padStart(2,'0'))||null; }
    if(!dept){ const m=/d[ée]partement[^\n\d]{0,30}?\b(\d{2,3}|2A|2B)\b/i.exec(noContact); if(m) dept=PQ_DEPTS.find(d=>d[0]===m[1].padStart(2,'0'))||null; }
    if(!dept){ const ft=pqFold(noContact); dept=PQ_DEPTS.slice().sort((a,b)=>b[1].length-a[1].length).find(d=>new RegExp('(^|[^a-z])'+pqFold(d[1]).replace(/[-' ]/g,'[ \'-]')+'([^a-z]|$)').test(ft))||null; }
    if(dept){ out.dept=pqDeptLabel(dept); out.region=PQ_REGIONS[dept[2]]; }

    // Installation & contract
    const ft=pqFold(scope);
    const eol=/eolien|eolienne/.test(ft);
    const pv=/photovolta|voltai|\bpv\b|solaire|ombriere|panneaux|toiture|hangar/.test(ft) || (!eol && /\b\d[\d\s.,]*\s*(kwc|mwc)\b|crete/.test(ft));
    if(pv&&eol) out.install='PV et Eolien'; else if(eol) out.install='Eolien'; else if(/biogaz|methanis|cogeneration/.test(ft)) out.install='BIOGAZ'; else if(/hydro/.test(ft)) out.install='Hydro'; else if(pv) out.install='PV';
    if(/\bs21\b/.test(ft)) out.contrat='AO S21 CR';
    else if(/\baos\b|appel d.offres? simplifie/.test(ft)) out.contrat='AOS CRE';
    else if(/autoconsommation collective|\bacc\b/.test(ft)) out.contrat='Surplus ACC';
    else if(/obligation d.achat|sortie d.oa|\boa\b/.test(ft) && !/jusqu.(en|au) 20(2[8-9]|[3-9]\d)/.test(ft)) out.contrat="Sortie d'OA / CR";
    else if(/\bppa\b/.test(ft)) out.contrat='PPA Spot';
    else if(/appel d.offres?|\bao\b|\bcre\b|laureat|ppe2/.test(ft)) out.contrat=/complement de remuneration|\bcr\b/.test(ft)?'AO CRE CR':'AO CRE';

    // Power & volume
    // a stated total ("soit 16,8 MW", "total 5 MWc") wins over the first figure
    const powRe=PQ_QTY+'\\s*(mwc|mwp|mw|kwc|kwp|kw)\\b(?!h)';
    const pm=new RegExp('(?:soit|au total|total(?:e)?(?:\\s+de)?)\\s*:?\\s*'+powRe,'iu').exec(scope)||new RegExp(powRe,'iu').exec(scope);
    if(pm){ let v=pqQty(pm[1],pm[2]); if(/^m/i.test(pm[2])) v*=1000; out.kwc=String(Math.round(v*100)/100); }
    const vm=new RegExp(PQ_QTY+'\\s*(gwh|mwh|kwh)(?!\\s*\\/\\s*kwc)','iu').exec(scope);
    if(vm){ let v=pqQty(vm[1],vm[2]); const u=vm[2].toLowerCase(); if(u==='gwh') v*=1000; if(u==='kwh') v/=1000; out.mwh=String(Math.round(v)); }

    // Commissioning date (not "en service depuis …"), contract length / start
    const mesSent=scope.split(/(?<=[.!?\n])/).find(s=>/mise en service|\bmis\p{L}* en service|\bm[eé]t\p{L}* en service|\ben service (?:en|au|à|a|le|pour|pr[ée]vue?)\b|\bmes\b|\bmsi\b|\bcod\b|raccordement/iu.test(s) && !/depuis/i.test(s));
    if(mesSent){ const d=pqParseDateLoose(mesSent.replace(/\d+[.,]?\d*\s*(mwc|mw|kwc|kw)\b/ig,'')); if(d) out.mesPrev=d; }
    const dm=/(?:contrat|dur[ée]e|pendant|sur|pour|offre)[^.\n]{0,40}?\b(\d{1,2})\s*(?:ans|années|annees)\b/i.exec(scope);
    if(dm) out.duree=dm[1];
    const deb=/(?:à partir du|a partir du|dès le|des le|à compter du|a compter du|début(?:\s+du contrat)?\s*(?:le|au|:)?)\s+([\d\/.\-]+|\d{1,2}(?:er)?\s+\p{L}+\s+\d{4})/iu.exec(scope);
    if(deb){ const d=pqParseDateLoose(deb[1]); if(d) out.debut=d; }

    // Plant name: CRE file number, "Parc éolien de …", else "Centrale de <ville>"; a list of plants gives the first one
    const multi=parseMailInstallations(scope);
    const cre=/\bPR\/\d{4}\/\d{4,6}\b/.exec(text);
    const named=/\b(parc|centrale|ferme)\s+(?:éolien(?:ne)?|solaire|photovoltaïque|PV|hydro\p{L}*)?\s*(de la|de l'|de l’|du|des|de)\s+([A-ZÉÈ][\p{L}'’-]+(?:[ -][A-ZÉÈ][\p{L}'’-]+)*)/u.exec(scope);
    if(multi.length){ out.centrale=multi[0].centrale; if(multi[0].kwc) out.kwc=multi[0].kwc; if(!out.dept && multi[0].dept){ out.dept=multi[0].dept; out.region=multi[0].region; } }
    else if(cre) out.centrale=cre[0];
    else if(named) out.centrale=(named[0].charAt(0).toUpperCase()+named[0].slice(1)).trim();
    else if(city) out.centrale='Centrale de '+city;
    if(!out.centrale) delete out.centrale;

    const notes=[];
    if(/au sol/.test(ft)) notes.push('Centrale au sol');
    if(/toiture|en toit|hangar/.test(ft)) notes.push('Toiture');
    if(/ombriere/.test(ft)) notes.push('Ombrière');
    if(/agrivolta/.test(ft)) notes.push('Agrivoltaïsme');
    if(/laureat/.test(ft)) notes.push('Lauréat AO');
    if(/bride/.test(ft)) notes.push('Production bridée');
    if(/stockage|batterie|bess/.test(ft)) notes.push('Stockage');
    if(/pilotage/.test(ft)) notes.push('Demande de pilotage');
    if(notes.length) out.particularites=notes.join(' · ');
    let first='Mail reçu';
    if(out.origine==='Crédit Agricole') first='Lead transmis par '+(caPerson?caPerson+' ('+(out.ca!=='N/A'?out.ca:'Crédit Agricole')+')':(out.ca!=='N/A'?out.ca:'le Crédit Agricole'));
    else if(!prospect && blocks.some(b=>b.relay)) first='Lead transmis en interne';
    out.commentaires=pqIsoToFr(toISO(new Date()))+' : '+first+(subject?' — '+subject:'')+'.';
    return out;
  }

  // A list of plants in the mail ("- Centrale de Cholet (49) : 1,2 MWc, MES 03/2027"): one installation per line
  // a table pasted in the mail (tab-separated from Excel/Outlook, or "| a | b |" from a PDF): read like an Excel sheet
  function parseMailTable(raw){
    const lines=String(raw||'').replace(/\r/g,'').replace(/\u00a0/g,' ').split('\n');
    const cells=l=>{ if((l.match(/\t/g)||[]).length>=1) return l.split('\t').map(c=>c.trim()); if((l.match(/\|/g)||[]).length>=2) return l.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|').map(c=>c.trim()); return null; };
    let best=[], block=[];
    const flush=()=>{ if(block.length>=2){ const found=pqRowsToInstallations(['mail'], ()=>block.map(r=>r.map(c=>/^-?\d+([.,]\d+)?$/.test(c)?parseFloat(c.replace(',','.')):c))); if(found.length>best.length) best=found; } block=[]; };
    lines.forEach(l=>{ const c=cells(l); if(c && c.filter(Boolean).length>=2) block.push(c); else flush(); });
    flush();
    return best;
  }
  // short project names announced in the subject ("Projets photovoltaïques DURAND, KORVAL et MERCADIER")
  function pqSubjectNames(raw){
    const subj=(/^(?:objet|subject)\s*:\s*(.*)$/im.exec(String(raw||''))||[])[1]||'';
    return (subj.match(/\b[A-ZÉÈÀÂÎÔÛÇ][A-ZÉÈÀÂÎÔÛÇ'’-]{2,}\b/g)||[]).filter(w=>!/^(RE|TR|FW|FWD|PV|AO|CRE|MW|MWC|KWC|SAS|SARL|EARL|GAEC|SCEA|ACC|OA|CR)$/.test(w));
  }
  function parseMailInstallations(raw){
    const table=parseMailTable(raw);
    if(table.length) return table;
    const found=[], short=pqSubjectNames(raw);
    String(raw||'').replace(/\r/g,'').replace(/ /g,' ').split('\n').forEach(l=>{
      const m=/^\s*(?:[-•*·–]|\d+[.)])\s*(.+)$/.exec(l); if(!m) return;
      const s=m[1];
      const pm=new RegExp(PQ_QTY+'\\s*(mwc|mwp|mw|kwc|kwp|kw)\\b(?!h)','iu').exec(s); if(!pm) return;
      let v=pqQty(pm[1],pm[2]); if(/^m/i.test(pm[2])) v*=1000;
      const inst={ kwc:String(Math.round(v*100)/100) };
      let name=s.slice(0,pm.index).replace(/\((\d{2,3}|2A|2B)\)/,' ').replace(/[\s:–,-]+$/,'').replace(/\s+/g,' ').trim();
      // "OWNER à COMMUNE (à) 55000": owner, commune and postal code go to their own fields
      const loc=/^(.+?)\s+(?:à|a|sur|-|–)\s+(.+?)\s*(?:,|\s)\s*(?:à\s+)?\(?((?:0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})\)?$/u.exec(name)
             || /^(.+?)\s+(?:à|a|sur)\s+([A-ZÉÈ][\p{L}' -]+)$/u.exec(name);
      if(loc){ inst.spv=loc[1].trim(); inst.commune=loc[2].trim(); if(loc[3]) inst.cp=loc[3]; name=inst.spv; }
      // the plant is called by the short name given in the subject when one matches ("DURAND PAUL" → DURAND)
      const hit=short.find(w=>new RegExp('(^|[^\\p{L}])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^\\p{L}]|$)','u').test(name.toUpperCase()));
      if(hit) name=hit;
      if(name) inst.centrale=name.charAt(0).toUpperCase()+name.slice(1);
      const d=inst.cp?pqDeptFromPostal(inst.cp):pqDeptFromText(s); if(d){ inst.dept=pqDeptLabel(d); inst.region=PQ_REGIONS[d[2]]; }
      const rest=s.slice(pm.index+pm[0].length);
      if(/mes|service|msi|cod|\d{1,2}\/\d{4}/i.test(rest)){ const dt=pqParseDateLoose(rest); if(dt) inst.mesPrev=dt; }
      // what follows the power ("– Injection totale.", "– Autoconsommation prévisionnelle de 10 %, à confirmer.")
      const note=rest.replace(/^[\s,;:–—-]+/,'').replace(/[.\s]+$/,'').trim();
      if(note && note.length<=120 && !/^(mes|msi|cod)\b/i.test(note)) inst.particularites=note;
      found.push(inst);
    });
    if(found.length>=2) return found;
    return parseMailSentencePlants(raw);
  }
  // plants named in a sentence: "nos centrales de Cholet (1,2 MWc) et de Saumur (800 kWc)", "l'école (36 kWc), le gymnase (100 kWc)"
  function parseMailSentencePlants(raw){
    const text=String(raw||'').replace(/\r/g,'').replace(/\u00a0/g,' ');
    const re=new RegExp("([\\p{L}'’-]+(?:[ \\t]+[\\p{L}'’-]+){0,4})\\s*\\(\\s*"+PQ_QTY+"\\s*(mwc|mwp|mw|kwc|kwp|kw)\\s*\\)",'giu');
    const STOP=/^(de|du|des|d|l|le|la|les|et|ou|nos|notre|leurs?|aux?|à|a|sa|son|ses|en|dont|avec|soit|puis)$/i;
    const found=[]; let m;
    while((m=re.exec(text))){
      const words=m[1].split(/[ \t]+/);
      let k=words.length-1;
      // the name = the words after the last little word ("de Cholet" → Cholet, "le gymnase" → gymnase, "l'école" → école)
      while(k>0 && !STOP.test(words[k-1].replace(/['’].*$/,'')) && !/['’]$/.test(words[k-1])) k--;
      let name=words.slice(k).join(' ').replace(/^[dl]['’]/i,'').trim();
      if(!name || STOP.test(name)) continue;
      let v=pqQty(m[2],m[3]); if(/^m/i.test(m[3])) v*=1000;
      found.push({ centrale:name.charAt(0).toUpperCase()+name.slice(1), kwc:String(Math.round(v*100)/100) });
    }
    return found.length>=2?found:[];
  }

  // What the mail announces about the number of plants, to check the installations found against it:
  // "trois projets", "3 centrales", the names listed in the subject, "soit une puissance totale de 795 kWc".
  const PQ_NUMBERS={ deux:2, trois:3, quatre:4, cinq:5, six:6, sept:7, huit:8, neuf:9, dix:10, onze:11, douze:12, quinze:15, vingt:20, two:2, three:3, four:4, five:5 };
  function pqPlantHints(raw){
    const text=String(raw||'').replace(/\u00a0/g,' ');
    const hints={ count:null, total:null, source:'' };
    const cm=/\b(\d{1,2}|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|two|three|four|five)\s+(?:(?:nouveaux|nouvelles|autres|futurs?|premiers?|petites?|grandes?)\s+)?(projets?|centrales?|installations?|sites?|parcs?|toitures?|ombri[eè]res?|hangars?|b[aâ]timents?|plants?|unit[ée]s?)\b/i.exec(text);
    if(cm){ const n=PQ_NUMBERS[cm[1].toLowerCase()]||parseInt(cm[1],10); if(n>=2 && n<=60){ hints.count=n; hints.source='« '+cm[0].trim()+' »'; } }
    if(!hints.count){
      const subj=(/^(?:objet|subject)\s*:\s*(.*)$/im.exec(text)||[])[1]||'';
      const names=pqSubjectNames(text);
      if(/projets|centrales|sites|parcs|installations/i.test(subj) && names.length>=2){
        // the names right after "Projets …": "Projets photovoltaïques DURAND, MARTIN et LEROY"
        const tail=subj.replace(/^.*?(projets|centrales|sites|parcs|installations)\b/i,'');
        const listed=names.filter(n=>tail.toUpperCase().includes(n));
        if(listed.length>=2){ hints.count=listed.length; hints.source='objet du mail'; }
      }
    }
    const tm=new RegExp("(?:puissance\\s+totale(?:\\s+install[ée]e)?(?:\\s+de)?|soit(?:\\s+une\\s+puissance\\s+totale(?:\\s+install[ée]e)?\\s+de)?|au\\s+total(?:\\s+de)?|total(?:e)?\\s*(?:de|:)?)\\s*:?\\s*"+PQ_QTY+"\\s*(mwc|mwp|mw|kwc|kwp|kw)\\b",'iu').exec(text)
            || new RegExp(PQ_QTY+"\\s*(mwc|mwp|mw|kwc|kwp|kw)\\s+au\\s+total",'iu').exec(text);
    if(tm){ let v=pqQty(tm[1],tm[2]); if(/^m/i.test(tm[2])) v*=1000; hints.total=Math.round(v*100)/100; }
    return hints;
  }

  // ----- Producer Excel → installations -----
  // Two layouts are recognised on every sheet, and the one that reads the most values wins:
  //  - one column per plant: labels in a left column (Puissance installée, P50…), a plant per column to the right
  //    (the Selfee « Caractéristiques Centrales » template is of this kind);
  //  - one row per plant: a header row (Projet | Puissance | P50 …), a plant per row below; « Total » rows skipped.
  // Order matters: the first definition matching a label wins (« Puissance unitaire » before « Puissance »).
  const XL_DEFS=[
    { k:'nbm', re:/nombre d.(eoliennes|machines|turbines|aerogenerateurs)|^nb (d.)?(eoliennes|machines|turbines)/ },
    { k:'unit', re:/puissance unitaire/, not:/onduleur|kva/ },
    { k:'centrale', re:/^(nom\b.*\b(installation|centrale|projet|parc|site)\b.*|nom|nom du projet|nom du site|installation|centrale|projet|site|parc|ouvrage|designation|(plant|project|site|asset) name|plant|asset)$/ },
    { k:'siret', re:/siret|siren/ },
    { k:'spv', re:/\bspv\b|societe de projet|raison sociale|^societe$/ },
    { k:'adresse', re:/^adresse/ },
    { k:'commune', re:/^(commune|ville|localite)\b/ },
    { k:'cp', re:/code postal|^cp$/ },
    { k:'dept', re:/^(departement|dept|dpt|location|localisation|county)\b/ },
    { k:'install', re:/^(type|filiere|technologie|techno|energie|nature projet|nature du projet|type d.installation|type de centrale|technology)$/, not:/injection|contrat|liste/ },
    { k:'productible', re:/kwh ?\/ ?kwc|kwh ?\/ ?kwp|par kwc|productible specifique|specific yield|heures? equivalentes?/, not:/\bp90\b/ },
    { k:'kwc', re:/puissance|^p ?(installee|crete|nominale)\b|^pc$|\bkwc\b|\bmwc\b|capacity|\bpower\b|\bmwp\b|\bkwp\b/, not:/raccordement|\bac\b|kva|mva|unitaire|onduleur|injection|reservee|kwh ?\/ ?kwc|par kwc|productible/ },
    { k:'mwh', re:/\bp50\b|production|productible|volume|energie (produite|annuelle)|\byield\b|generation|annual energy/, not:/kwh ?\/ ?kwc|\bp90\b|par kwc/ },
    { k:'p90', re:/\bp90\b/, not:/kwh ?\/ ?kwc/ },
    { k:'fin', re:/fin (de l.|d.)?oa\b|fin (du |de )?contrat|echeance|date de fin/ },
    { k:'injection', re:/premiere injection|first injection|date d.injection/, not:/type d.injection/ },   // start of the contract (test phase until the MSI)
    { k:'mesPrev', re:/mise en service|\bmsi\b|\bmes\b|\bcod\b|date de raccordement|raccordement prevu|commissioning|\bcod date\b/, not:/type d.injection/ },
    { k:'contrat', re:/mecanisme|soutien|type de contrat|appel d.offres?|^tarif|^contrat$|cadre (juridique|contractuel)/ }
  ];
  const xlLabel=v=>pqFold(v).replace(/\s+/g,' ').trim();
  function xlDef(v){
    if(typeof v!=='string' || !v.trim() || v.length>80) return null;
    const lf=xlLabel(v);
    if(/^(centrale|installation|projet|site|parc)\s*n?°?\s*\d+$/.test(lf)) return null;   // "Centrale 1" is a column title, not a label
    return XL_DEFS.find(d=>d.re.test(lf) && !(d.not && d.not.test(lf)))||null;
  }
  const xlUnit=s=>{ const m=/\b(mwc|mwp|mw|kwc|kwp|kw|kva|gwh|mwh|kwh)\b/.exec(pqFold(s)); return m?m[1]:''; };
  // number + unit from a cell; the unit written in the cell wins over the one in the label
  function xlQty(v, labelUnit){
    if(typeof v==='number') return { n:v, unit:labelUnit };
    const s=String(v||'').replace(/ /g,' ').trim(); if(!s) return null;
    const m=new RegExp(PQ_QTY+'\\s*(mwc|mwp|mw|kwc|kwp|kw|kva|gwh|mwh|kwh)?','iu').exec(s); if(!m) return null;
    const unit=(m[2]||labelUnit||'').toLowerCase();
    return { n:pqQty(m[1], unit), unit };
  }
  const xlRound=(n,d)=>String(Math.round(n*Math.pow(10,d))/Math.pow(10,d));
  function xlInstallType(v){ const f=pqFold(v); return /eol/.test(f)?'Eolien':/hydro/.test(f)?'Hydro':/biog|metha|cogen/.test(f)?'BIOGAZ':/pv|photo|solaire|ombri|toiture|\bsol\b|agrivolta|hangar/.test(f)?'PV':''; }
  function xlContrat(v){ const f=pqFold(v); return /s21/.test(f)?'AO S21 CR':/\baos\b|simplifi/.test(f)?'AOS CRE':/\boa\b|obligation/.test(f)?"Sortie d'OA / CR":/\bacc\b|autoconsommation/.test(f)?'Surplus ACC':/ppa/.test(f)?'PPA Spot':/\bao\b|cre|complement/.test(f)?'AO CRE CR':''; }
  // one value of one plant, converted for the installation form
  function xlSet(inst, def, label, v){
    if(v===''||v==null) return;
    const lu=xlUnit(label);
    switch(def.k){
      case 'kwc': { const q=xlQty(v, lu); if(!q||isNaN(q.n)) return; const dcFirst=/\bdc\b|crete|installee|totale|kwc|mwc/.test(xlLabel(label)); if(inst.kwc && !dcFirst) return; inst.kwc=xlRound(/^m/.test(q.unit)?q.n*1000:q.n, 2); return; }
      case 'unit': { const q=xlQty(v, lu||'mw'); if(q&&!isNaN(q.n)) inst._unitKw=/^m/.test(q.unit)?q.n*1000:q.n; return; }
      case 'nbm': { const n=parseFloat(v); if(n) inst._nb=n; return; }
      case 'productible': { const n=typeof v==='number'?v:pqNum(String(v)); if(!n||isNaN(n)) return; inst.productible=String(Math.round(n<10?n*1000:n)); return; }
      case 'mwh': case 'p90': { const q=xlQty(v, lu||'mwh'); if(!q||isNaN(q.n)) return; let n=q.n; if(q.unit==='gwh') n*=1000; if(q.unit==='kwh') n/=1000; inst[def.k]=String(Math.round(n)); return; }
      case 'mesPrev': case 'fin': { const d=pqCellDate(v); if(d) inst[def.k]=d; return; }
      case 'injection': { const d=pqCellDate(v); if(d) inst._inj=d; return; }
      case 'dept': { const d=pqDeptFromText(String(v)); if(d){ inst.dept=pqDeptLabel(d); inst.region=PQ_REGIONS[d[2]]; } return; }
      case 'cp': { const cp=typeof v==='number'?String(v).padStart(5,'0'):String(v).trim(); inst.cp=cp; return; }
      case 'install': { const t=xlInstallType(v); if(t) inst.install=t; if(/au sol|\bsol\b/i.test(v)) inst._nature='Centrale au sol'; else if(/toiture|hangar/i.test(v)) inst._nature='Toiture'; else if(/ombri/i.test(v)) inst._nature='Ombrière'; return; }
      case 'contrat': { const c=xlContrat(v); if(c) inst.contrat=c; return; }
      case 'commune': { const s=String(v).trim(), m=/^(\d{5})\s+(.+)$/.exec(s); if(m){ inst.commune=m[2].trim(); if(!inst.cp) inst.cp=m[1]; } else inst.commune=s; return; }
      default: inst[def.k]=String(v).trim();
    }
  }
  function xlFinish(inst){
    if(!inst.kwc && inst._nb && inst._unitKw) inst.kwc=xlRound(inst._nb*inst._unitKw, 2);
    if(!inst.dept && inst.cp){ const d=pqDeptFromPostal(inst.cp); if(d){ inst.dept=pqDeptLabel(d); inst.region=PQ_REGIONS[d[2]]; } }
    if(!inst.dept && inst.adresse){ const d=pqDeptFromText(inst.adresse); if(d){ inst.dept=pqDeptLabel(d); inst.region=PQ_REGIONS[d[2]]; } }
    if(!inst.cp && inst.adresse){ const m=/\b(\d{5})\b/.exec(inst.adresse); if(m) inst.cp=m[1]; }
    if(!inst.install && (inst.kwc||'') && /kwc|mwc|crete/.test(inst._labels||'')) inst.install='PV';
    if(inst._nature) inst.particularites=inst._nature;
    if(inst._inj && !inst.debut){ const f=pqFullDate(inst._inj); inst.debut=f||inst._inj; }   // the contract starts at the first injection
    if(inst._inj && !inst.mesPrev) inst.mesPrev=inst._inj;
    if(!inst.centrale && inst.spv) inst.centrale=inst.spv;   // « Nom Installation » left empty: the SPV names the plant
    Object.keys(inst).forEach(k=>{ if(k.charAt(0)==='_') delete inst[k]; });
    return inst;
  }
  const xlFilled=list=>list.reduce((s,i)=>s+Object.keys(i).filter(k=>k!=='caract').length,0);
  // label → value of one plant, as written in the file (dates as dd/mm/yyyy)
  function xlRaw(pairs){
    const out={};
    pairs.forEach(([l,v])=>{ if(typeof l!=='string' || !l.trim() || v==='' || v==null) return; out[l.trim()]=v instanceof Date?pqCellDate(v):(typeof v==='number'?v:String(v).trim()); });
    return out;
  }
  // layout « one column per plant »
  function xlVertical(rows){
    let best=[];
    for(let c=0;c<3;c++){
      const hits=[];
      rows.forEach((r,ri)=>{ const d=xlDef(r[c]); if(d && !hits.some(h=>h.def.k===d.k && d.k!=='kwc')) hits.push({ def:d, ri, label:r[c] }); });
      const keys=new Set(hits.map(h=>h.def.k));
      if(keys.size<2 || !['kwc','mwh','centrale'].some(k=>keys.has(k))) continue;
      const first=Math.min(...hits.map(h=>h.ri));
      const width=Math.max(...rows.map(r=>r.length));
      const plants=[];
      for(let j=c+1;j<width;j++){
        const filled=hits.filter(h=>rows[h.ri][j]!=='' && rows[h.ri][j]!=null).length;
        if(filled<2) continue;
        const inst={ _labels:hits.map(h=>xlLabel(h.label)).join(' ') };
        hits.forEach(h=>xlSet(inst, h.def, h.label, rows[h.ri][j]));
        inst.caract=xlRaw(rows.map(r=>[r[c], r[j]]));   // every line of the file, for the « Caractéristiques Centrales » sheet
        // a plant named in the column title ("Centrale du Moulin") when there is no name row
        if(!inst.centrale){ for(let r=first-1;r>=0;r--){ const t=rows[r][j]; if(typeof t==='string' && t.trim() && !/^(centrale|installation|projet|site|parc)\s*n?°?\s*\d+$/i.test(pqFold(t).trim())){ inst.centrale=t.trim(); break; } } }
        plants.push(xlFinish(inst));
      }
      if(xlFilled(plants)>xlFilled(best)) best=plants;
    }
    return best;
  }
  // layout « one row per plant »
  function xlHorizontal(rows){
    let best=[];
    rows.slice(0,40).forEach((head,hi)=>{
      const cols=[]; head.forEach((v,j)=>{ const d=xlDef(v); if(d) cols.push({ def:d, j, label:v }); });
      const keys=new Set(cols.map(c=>c.def.k));
      if(keys.size<2 || !['kwc','mwh'].some(k=>keys.has(k))) return;
      const plants=[]; let blanks=0;
      for(let r=hi+1;r<rows.length && blanks<2;r++){
        const row=rows[r]||[];
        if(!row.some(v=>v!==''&&v!=null)){ blanks++; continue; } blanks=0;
        const firstCell=String(row.find(v=>v!==''&&v!=null)||'');
        if(/^(total|sous-total|somme|moyenne|ensemble)\b/i.test(pqFold(firstCell))) continue;
        const inst={ _labels:cols.map(c=>xlLabel(c.label)).join(' ') };
        cols.forEach(c=>xlSet(inst, c.def, c.label, row[c.j]));
        inst.caract=xlRaw(head.map((l,j)=>[l, row[j]]));
        if(!inst.centrale){ const nameCell=row.find((v,j)=>typeof v==='string' && v.trim() && !cols.some(c=>c.j===j)); if(nameCell) inst.centrale=nameCell.trim(); }
        if(Object.keys(inst).filter(k=>k.charAt(0)!=='_').length>=2) plants.push(xlFinish(inst));
      }
      if(xlFilled(plants)>xlFilled(best)) best=plants;
    });
    return best;
  }
  function pqRowsToInstallations(sheetNames, getRows){
    const found=[];
    sheetNames.forEach(name=>{
      const rows=(getRows(name)||[]).map(r=>(r||[]).map(v=>v==null?'':v));
      const v=xlVertical(rows), h=xlHorizontal(rows);
      found.push(...(xlFilled(h)>xlFilled(v)?h:v));
    });
    return found.filter(i=>i.kwc||i.mwh||i.centrale);
  }
  function pqXlsxToInstallations(wb){ return pqRowsToInstallations(wb.SheetNames, n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''})); }

  // ----- Files: .eml / .txt / .msg (Outlook) / .xlsx; SheetJS is loaded on first use -----
  let xlsxLoading=null;
  function loadXlsxLib(){
    if(window.XLSX) return Promise.resolve();
    if(!xlsxLoading) xlsxLoading=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=()=>res(); s.onerror=()=>{ xlsxLoading=null; rej(new Error('Bibliothèque Excel indisponible (hors ligne ?)')); }; document.head.appendChild(s); });
    return xlsxLoading;
  }
  function pqDecodeQP(s){ return s.replace(/=\r?\n/g,'').replace(/(=[0-9A-F]{2})+/gi, m=>{ try{ return decodeURIComponent(m.replace(/=/g,'%')); }catch(e){ return m; } }); }
  function pqHtmlToText(h){ const d=document.createElement('div'); d.innerHTML=h.replace(/<(br|\/p|\/div|\/tr|\/li)[^>]*>/gi,'\n$&'); d.querySelectorAll('style,script').forEach(n=>n.remove()); return d.textContent.replace(/\n{3,}/g,'\n\n'); }
  function pqDecodeMimeWords(s){ return s.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,(m,cs,enc,txt)=>{ try{ if(enc.toLowerCase()==='b') return decodeURIComponent(escape(atob(txt))); return pqDecodeQP(txt.replace(/_/g,' ')); }catch(e){ return txt; } }); }
  // .eml (saved from the new Outlook, Outlook on the web, Gmail…): text, sender, subject and the attached files
  // (Excel of the producer…), including those of a mail forwarded as an attachment.
  function pqEmlFileName(ph){
    const h=ph.replace(/\r?\n[ \t]+/g,' ');
    const star=/filename\*=(?:([\w-]+)'[^']*')?([^;\r\n]+)/i.exec(h);
    if(star){ try{ return decodeURIComponent(star[2].trim().replace(/^"|"$/g,'')); }catch(e){ return star[2].trim(); } }
    const m=/(?:filename|name)\s*=\s*"([^"]+)"/i.exec(h) || /(?:filename|name)\s*=\s*([^;\s]+)/i.exec(h);
    return m?pqDecodeMimeWords(m[1].trim()):'';
  }
  function pqB64Bytes(s){ const bin=atob(s.replace(/[^A-Za-z0-9+/=]/g,'')); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; }
  function parseEml(raw){
    const split=raw.search(/\r?\n\r?\n/); const head=raw.slice(0,split<0?raw.length:split).replace(/\r?\n[ \t]+/g,' '); const rest=split<0?'':raw.slice(split).trim();
    const hdr=n=>{ const m=new RegExp('^'+n+':\\s*(.*)$','im').exec(head); return m?pqDecodeMimeWords(m[1].trim()):''; };
    let text='', html=''; const attachments=[], forwarded=[];
    const bm=/boundary="?([^";\r\n]+)"?/i.exec(head+'\n'+rest.slice(0,2000));
    const decodePart=(ph, body)=>{ const enc=(/content-transfer-encoding:\s*([\w-]+)/i.exec(ph)||[])[1]||''; if(/base64/i.test(enc)){ try{ return decodeURIComponent(escape(atob(body.replace(/\s/g,'')))); }catch(e){ return ''; } } if(/quoted-printable/i.test(enc)) return pqDecodeQP(body); return body; };
    if(bm){
      rest.split('--'+bm[1]).forEach(part=>{
        const i=part.search(/\r?\n\r?\n/); if(i<0) return; const ph=part.slice(0,i).replace(/^\s+/,''), pb=part.slice(i).trim();
        const name=pqEmlFileName(ph), isAttach=/content-disposition:\s*attachment/i.test(ph) || (!!name && !/content-type:\s*text\/(plain|html)/i.test(ph));
        if(/content-type:\s*message\/rfc822/i.test(ph)){ const inner=parseEml(decodePart(ph,pb)); forwarded.push(inner); attachments.push(...inner.attachments); return; }
        if(/boundary=/i.test(ph)){ const inner=parseEml(ph+'\n\n'+pb); if(!text) text=inner.body; attachments.push(...inner.attachments); return; }   // inner.body already carries its forwarded mails
        if(isAttach && name){
          try{ attachments.push({ name, data:/base64/i.test(ph)?pqB64Bytes(pb):new TextEncoder().encode(decodePart(ph,pb)) }); }catch(e){}
          return;
        }
        if(/content-type:\s*text\/plain/i.test(ph) && !text) text=decodePart(ph,pb);
        else if(/content-type:\s*text\/html/i.test(ph) && !html) html=decodePart(ph,pb);
      });
    } else { const body=decodePart(head,rest); if(/content-type:\s*text\/html/i.test(head)) html=body; else text=body; }
    let body=text||pqHtmlToText(html);
    forwarded.forEach(f=>{ body+='\n\n-------- Mail joint --------\nDe : '+f.from+'\nObjet : '+f.subject+'\n\n'+f.body; });
    return { from:hdr('From'), subject:hdr('Subject'), body, attachments, forwarded };
  }
  function pqUtf16(u8){ let s=''; for(let i=0;i+1<u8.length;i+=2) s+=String.fromCharCode(u8[i]|(u8[i+1]<<8)); return s.replace(/\u0000+$/,''); }
  function parseMsg(buf){
    const cfb=XLSX.CFB.read(new Uint8Array(buf),{type:'array'});
    const get=(path)=>{ const e=XLSX.CFB.find(cfb,path); return e&&e.content?new Uint8Array(e.content):null; };
    const str=(id)=>{ const u=get('/__substg1.0_'+id+'001F'); if(u) return pqUtf16(u); const a=get('/__substg1.0_'+id+'001E'); return a?new TextDecoder('latin1').decode(a).replace(/\u0000+$/,''):''; };
    let body=str('1000');
    if(!body){ const h=get('/__substg1.0_10130102'); if(h) body=pqHtmlToText(new TextDecoder().decode(h)); }
    const attachments=[];
    cfb.FullPaths.forEach(p=>{
      const m=/^\/?(?:Root Entry\/)?(__attach_version1\.0_#[0-9A-F]{8})\/$/i.exec(p); if(!m) return;
      const nameU=get('/'+m[1]+'/__substg1.0_3707001F')||get('/'+m[1]+'/__substg1.0_3704001F');
      const data=get('/'+m[1]+'/__substg1.0_37010102');
      if(nameU && data) attachments.push({ name:pqUtf16(nameU), data });
    });
    return { from:(str('0C1A')+' <'+(str('0C1F')||str('5D01'))+'>').trim(), subject:str('0037'), body, attachments };
  }
  async function readPipeFiles(files){
    const texts=[], installs=[], names=[];
    for(const f of files){
      const n=f.name.toLowerCase(); names.push(f.name);
      if(/\.(xlsx|xlsm|xls)$/.test(n)){ await loadXlsxLib(); installs.push(...pqXlsxToInstallations(XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true}))); }
      else if(/\.msg$/.test(n)){
        await loadXlsxLib();
        const m=parseMsg(await f.arrayBuffer());
        texts.push('De : '+m.from+'\nObjet : '+m.subject+'\n\n'+m.body);
        for(const a of m.attachments){ if(/\.(xlsx|xlsm|xls)$/i.test(a.name)){ try{ installs.push(...pqXlsxToInstallations(XLSX.read(a.data,{type:'array',cellDates:true}))); names.push(a.name); }catch(e){} } }
      }
      else if(/\.eml$/.test(n)){
        const m=parseEml(await f.text());
        texts.push('De : '+m.from+'\nObjet : '+m.subject+'\n\n'+m.body);
        const xl=m.attachments.filter(a=>/\.(xlsx|xlsm|xls)$/i.test(a.name));
        if(xl.length) await loadXlsxLib();
        for(const a of xl){ try{ installs.push(...pqXlsxToInstallations(XLSX.read(a.data,{type:'array',cellDates:true}))); names.push(a.name); }catch(e){ console.error('attachment unreadable', a.name, e); } }
      }
      else texts.push(await f.text());
    }
    return { text:texts.join('\n\n'), installs, names };
  }

  // ----- Stages -----
  function oppStage(key){ return OPP_STAGES.find(s=>s.key===key)||null; }
  function stageIndex(key){ return OPP_STAGES.findIndex(s=>s.key===key); }
  function stageLabel(key){ if(key==='prequal') return 'Pré-qualif'; if(OPP_EXITS[key]) return OPP_EXITS[key]; const s=oppStage(key); return s?s.label:key; }
  function oppPhase(o){ if(o.kind==='prequal') return 'prequal'; const s=oppStage(o.stage); return s?s.phase:null; }
  function oppName(o){ return o.centrale||o.title||'(sans nom)'; }
  function isExited(o){ return !!OPP_EXITS[o.stage]; }
  function pipeStade(o){
    if(o.stage==='no_go') return 'No Go';
    const i=stageIndex(o.stage), go=stageIndex('demande_prix');
    if(i>=go || ((o.stage==='perdu'||o.stage==='abandonne') && o.goDate)) return 'Transféré BDD';
    const s=oppStage(o.stage); return s&&s.pipe?s.pipe:'A qualifier';
  }
  function bddStatut(o){
    if(o.stage==='perdu') return 'Perdu';
    if(o.stage==='abandonne'||o.stage==='no_go') return 'Abandonné';
    const s=oppStage(o.stage); return s&&s.bdd?s.bdd:'';
  }

  function activeOpportunities(){ return opportunities.filter(o=>!o.deleted && o.kind!=='request' && o.stage!=='converti'); }
  function requestInstalls(reqId){ return opportunities.filter(o=>!o.deleted && o.kind==='installation' && o.requestId===reqId); }
  function newOppId(prefix){ return (prefix||'opp')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); }

  // Older records (kanban v1) → installations on the new stages. Deterministic, so both devices converge.
  function normalizeOpps(){
    let changed=false;
    opportunities.forEach(o=>{
      if(!o.kind){ o.kind='installation'; changed=true; }
      if(o.kind==='installation'){
        if(LEGACY_STAGE[o.stage]){ o.stage=LEGACY_STAGE[o.stage]; changed=true; }
        if(!o.centrale && o.title){ o.centrale=o.title; changed=true; }
        if(!o.producteur && o.company){ o.producteur=o.company; changed=true; }
      }
    });
    return changed;
  }
  function renderCrm(){
    if(normalizeOpps()) saveCrmLocalOnly();
    if(migrateCompanyStars()) saveCrmLocalOnly();
    if(!$('tab-pipeline').classList.contains('hidden')) renderPipeline();
    if(!$('tab-contacts').classList.contains('hidden') && typeof renderContacts==='function') renderContacts();
  }

  function ensureCompany(name){
    const existing=findExistingCI(clientsList, name);
    const finalName=existing||name;
    if(!existing){ clientsList.push(name); saveClients(); }
    if(!companies.find(co=>co.name===finalName && !co.deleted)) companies.push({ id:newOppId('co'), name:finalName, type:'Client', whatTheyDo:'', marketScope:[], website:'', createdAt:Date.now(), updatedAt:Date.now(), deleted:false });
    return finalName;
  }
  const PQ_CIVILITY=/^(m\.|mr\.?|mme|mlle|mrs?|ms|monsieur|madame|mademoiselle)\s+/i;
  function migrateContactCivility(){ let ch=false; contacts.forEach(c=>{ if(!c.deleted && PQ_CIVILITY.test(c.firstName||'')){ c.firstName=c.firstName.replace(PQ_CIVILITY,'').trim(); touchCrm(c); ch=true; } }); return ch; }
  function ensureContact(v, company){
    if(v.prenom) v=Object.assign({}, v, { prenom:String(v.prenom).replace(PQ_CIVILITY,'').trim() });
    if(!v.prenom && !v.nom && !v.mail) return null;
    const mail=(v.mail||'').toLowerCase();
    const lastName=pqTitleCase(v.nom||'').replace(/^(M\.|Mme)\s+/i,'');
    let c=contacts.find(x=>!x.deleted && ((mail && (x.email||'').toLowerCase()===mail) || (v.prenom && x.firstName===v.prenom && (x.lastName||'').toLowerCase()===lastName.toLowerCase())));
    const phones=(v.tel||'').split(/\s*\/\s*|\n/).filter(Boolean);
    if(!c){
      c={ id:newOppId('ct'), firstName:v.prenom||'', lastName, role:v.qualite||'', company, email:mail, phone1:phones[0]||'', phone2:phones[1]||'', relevance:0, comment:'', createdAt:Date.now(), updatedAt:Date.now(), deleted:false };
      contacts.push(c);
    } else {
      let ch=false;
      if(!c.email && mail){ c.email=mail; ch=true; }
      if(!c.phone1 && phones[0]){ c.phone1=phones[0]; ch=true; }
      if(!c.role && v.qualite){ c.role=v.qualite; ch=true; }
      if(!c.company){ c.company=company; ch=true; }
      if(ch) touchCrm(c);
    }
    return c;
  }


  // ----- Board -----
  let pipeShowExited=false, pipeDash=false, pipeMeet=false;
  // ---------- Pipeline dashboard: MWc by phase, time spent at each step, deals that drag ----------
  const kwcNum=o=>parseFloat(String(o.kwc||'').replace(/\s/g,'').replace(',','.'))||0;
  function stageDurations(){
    // days per step from the dated stage log; the current step counts up to today
    const per={}, now=Date.now();
    opportunities.filter(o=>!o.deleted && o.kind==='installation').forEach(o=>{
      const log=(o.stageLog||[]).filter(x=>x && x.at>1e12);
      log.forEach((e,i)=>{ const end=i+1<log.length?log[i+1].at:(isExited(o)||o.stage==='actif'?null:now); if(end==null) return;
        (per[e.stage]=per[e.stage]||[]).push({ d:(end-e.at)/864e5, live:i+1===log.length }); });
    });
    return per;
  }
  function renderPipeDash(board){
    board.classList.add('pipe-dash');
    const all=opportunities.filter(o=>!o.deleted && o.kind!=='request' && o.stage!=='converti');
    const live=all.filter(o=>!isExited(o)), year=String(new Date().getFullYear());
    const yr=ms=>ms && new Date(ms).getFullYear()===+year;
    const signedYr=all.filter(o=>!isExited(o) && stageIndex(o.stage)>=stageIndex('onboarding') && ((o.stageLog||[]).some(e=>(e.stage==='onboarding'||e.stage==='actif') && yr(e.at)) || (!(o.stageLog||[]).length && yr(o.updatedAt))));
    const lostYr=all.filter(o=>isExited(o) && yr(o.lostAt));
    const mw=list=>fmtMwc(list.reduce((s,o)=>s+kwcNum(o),0));
    const k=document.createElement('div'); k.className='pd-kpis';
    [[live.length,'dossiers en cours'],[mw(live.filter(o=>o.kind==='installation' && o.stage!=='actif')),'à signer ou en cours'],[signedYr.length+' · '+mw(signedYr),'signés en '+year],[lostYr.length,'sortis en '+year+' (perdu, no go, abandon)']]
      .forEach(([v,l])=>{ const d=document.createElement('div'); d.className='stat-card'; d.innerHTML='<div class="stat-card-num"></div><div class="stat-card-label"></div>'; d.firstChild.textContent=v; d.lastChild.textContent=l; k.appendChild(d); });
    board.appendChild(k);
    // the year's goal in MWc signed, set by hand: signed so far, and what is in the contract phase on top
    { let goals={}; try{ goals=JSON.parse(localStorage.getItem('pipe-goals')||'{}')||{}; }catch(e){}
      const goal=parseFloat(String(goals[year]||'').replace(',','.'))||0, sMw=signedYr.reduce((s,o)=>s+kwcNum(o),0)/1000;
      const cMw=live.filter(o=>o.kind==='installation' && oppPhase(o)==='contrat').reduce((s,o)=>s+kwcNum(o),0)/1000;
      const f1=n=>(Math.round(n*10)/10).toLocaleString('fr-FR');
      const g=document.createElement('section'); g.className='pd-goal';
      g.innerHTML='<div class="pd-goal-h"><b>Objectif '+year+'</b><label><input type="text" inputmode="decimal" class="pd-goal-in" aria-label="Objectif de l\u2019année en MWc signés" placeholder="à fixer"> MWc signés</label></div>'
        +'<div class="pd-goal-bar"><span class="s"></span><span class="c"></span></div><div class="pd-goal-t"></div>';
      const inp=g.querySelector('input'); inp.value=goal?f1(goal):'';
      const top=Math.max(goal, sMw+cMw, .001);
      g.querySelector('.s').style.width=(goal?Math.min(100,sMw/top*100):0)+'%'; g.querySelector('.c').style.width=(goal?Math.min(100-Math.min(100,sMw/top*100),cMw/top*100):0)+'%';
      g.querySelector('.pd-goal-t').textContent=goal
        ? f1(sMw)+' MWc signés sur '+f1(goal)+' ('+Math.round(sMw/goal*100)+' %)'+(cMw?' · + '+f1(cMw)+' MWc en contrat':'')+(sMw>=goal?' — objectif atteint 🎉':' — reste '+f1(goal-sMw)+' MWc')
        : f1(sMw)+' MWc signés en '+year+(cMw?' · '+f1(cMw)+' MWc en contrat':'')+'. Fixe un objectif pour suivre ta progression.';
      inp.addEventListener('keydown', e=>{ if(e.key==='Enter') inp.blur(); });
      inp.addEventListener('change', ()=>{ const v=parseFloat(inp.value.replace(/\s/g,'').replace(',','.')); if(v>0) goals[year]=v; else delete goals[year];
        try{ localStorage.setItem('pipe-goals', JSON.stringify(goals)); }catch(e){} if(window.todoSettingsChanged) window.todoSettingsChanged(); renderPipeline(); });
      board.appendChild(g); }
    const grid=document.createElement('div'); grid.className='pd-grid'; board.appendChild(grid);
    const card=(title,hint)=>{ const c=document.createElement('section'); c.className='pd-card'; const h=document.createElement('h4'); h.textContent=title; c.appendChild(h); if(hint){ const p=document.createElement('p'); p.className='pd-hint'; p.textContent=hint; c.appendChild(p); } grid.appendChild(c); return c; };
    // MWc by phase, bars to one scale
    const ph=PIPE_PHASES.filter(p=>p.key!=='prequal').map(p=>{ const l=live.filter(o=>oppPhase(o)===p.key); return { label:p.label, n:l.length, kwc:l.reduce((s,o)=>s+kwcNum(o),0) }; });
    const maxK=Math.max(1,...ph.map(p=>p.kwc));
    const c1=card('MWc par phase','Dossiers en cours, hors pré-qualifications ; puissance renseignée sur la fiche.');
    ph.forEach(p=>{ const r=document.createElement('div'); r.className='pd-bar-row'; r.innerHTML='<span class="pd-l"></span><span class="pd-bar"><span></span></span><span class="pd-v"></span>';
      r.querySelector('.pd-l').textContent=p.label; r.querySelector('.pd-bar span').style.width=(p.kwc?Math.max(2,p.kwc/maxK*100):0)+'%'; r.querySelector('.pd-v').textContent=(p.kwc?fmtMwc(p.kwc):'—')+' · '+p.n; c1.appendChild(r); });
    // time at each step
    const per=stageDurations(), since=opportunities.reduce((m,o)=>Math.min(m,...(o.stageLog||[]).map(e=>e.at||Infinity)),Infinity);
    const c2=card('Temps passé par étape', isFinite(since)?'Moyenne en jours, d\u2019après les changements d\u2019étape enregistrés depuis le '+new Date(since).toLocaleDateString('fr-FR')+' ; l\u2019étape en cours compte jusqu\u2019à aujourd\u2019hui.':'Les durées se rempliront au fil des changements d\u2019étape (historique démarré avec cette version).');
    const t=document.createElement('div'); t.className='pd-table';
    OPP_STAGES.forEach(s=>{ const v=per[s.key]; if(!v || !v.length) return; const avg=v.reduce((a,x)=>a+x.d,0)/v.length, mx=Math.max(...v.map(x=>x.d));
      const r=document.createElement('div'); r.className='pd-trow'+(avg>=30?' slow':''); r.innerHTML='<span></span><b></b><span class="m"></span>';
      r.firstChild.textContent=s.label; r.querySelector('b').textContent=Math.round(avg)+' j'; r.querySelector('.m').textContent=v.length+' dossier'+(v.length>1?'s':'')+' · max '+Math.round(mx)+' j'; t.appendChild(r); });
    if(t.children.length) c2.appendChild(t);
    // deals that drag
    const now=Date.now(), stalled=live.filter(o=>o.stage!=='actif' && lastMove(o)>1e12 && now-lastMove(o)>=STALL_DAYS*864e5).sort((a,b)=>lastMove(a)-lastMove(b));
    const c3=card('Dossiers qui traînent', stalled.length?'Sans étape ni modification depuis '+STALL_DAYS+' jours ou plus.':'Aucun dossier sans mouvement depuis '+STALL_DAYS+' jours.');
    stalled.slice(0,10).forEach(o=>{ const d=Math.floor((now-lastMove(o))/864e5); const r=document.createElement('button'); r.type='button'; r.className='tw-row'+(d>=30?' late':'');
      r.innerHTML='<span class="k"><b></b><span></span></span><span class="v"></span>'; r.querySelector('b').textContent=o.kind==='prequal'?o.company+' (pré-qualif)':oppName(o);
      r.querySelector('.k span').textContent=[o.kind==='prequal'?'':o.company, stageLabel(o.stage)].filter(Boolean).join(' · '); r.querySelector('.v').textContent=d+' j'; r.onclick=()=>openOppDetail(o.id); c3.appendChild(r); });
  }
  // ----- Meeting view: what is coming, one line per installation, to share with the pricing team -----
  const MEET_PHASES=[{ key:'qualif', label:'Qualification · à venir' }, { key:'offre', label:'Offre · pricing en cours' }, { key:'contrat', label:'Contrat · pricing ferme' }];
  function meetPhasesOn(){ try{ const v=JSON.parse(localStorage.getItem('pipe-meet-phases')||'null'); if(Array.isArray(v) && v.length) return v; }catch(e){} return MEET_PHASES.map(p=>p.key); }
  const MEET_COLS=['Producteur','Centrale','Techno','Puissance','P50 (MWh/an)','Dépt','MES','Contrat','Mécanisme','Étape','Prochaine échéance','Chargé'];
  function meetRow(o){
    const fr=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?pqIsoToFr(v):(v||'');
    const s=oppStage(o.stage), task=o.taskId?tasks.find(t=>t.id===o.taskId && !t.done && t.status!=='termine'):null;
    const next=[o.relance?fr(o.relance):'', task&&task.due?pqIsoToFr(task.due)+' · '+task.title.replace(/\s+—.*$/,''):''].filter(Boolean)[0]||'';
    const mwh=pqNum(String(o.mwh||''));
    return [o.producteur||o.company||'', oppName(o), o.install==='Eolien'?'Éolien':(o.install||''), fmtKwc(o.kwc), mwh?Math.round(mwh).toLocaleString('fr-FR'):'',
      (o.dept||'').replace(/^(\S+)\s+-\s+.*$/,'$1'), o.mesEff?fr(o.mesEff)+' (effective)':fr(o.mesPrev), o.debut&&o.fin?fr(o.debut)+' → '+fr(o.fin):o.fin?'jusqu\u2019au '+fr(o.fin):o.debut?'dès '+fr(o.debut)+(o.duree?', '+o.duree+' ans':''):(o.duree?o.duree+' ans':''),
      o.contrat||'', s?s.label+(s.who!=='Com'?' ('+s.who+')':''):'', next, o.charge||''];
  }
  function meetData(q){
    const on=meetPhasesOn();
    const vp=savedViewState.pipeline && savedViewState.pipeline.pred;
    const live=opportunities.filter(o=>!o.deleted && o.kind==='installation' && !isExited(o))
      .filter(o=>!q || pqFold([o.company,o.producteur,o.centrale,o.title,o.dept].join(' ')).includes(q))
      .filter(o=>!vp || vp(o));
    return MEET_PHASES.filter(p=>on.includes(p.key)).map(p=>{
      const list=live.filter(o=>oppPhase(o)===p.key).sort((a,b)=>stageIndex(b.stage)-stageIndex(a.stage) || (pqToDate(a.mesEff||a.mesPrev)||9e15)-(pqToDate(b.mesEff||b.mesPrev)||9e15) || (a.company||'').localeCompare(b.company||'','fr'));
      const kwc=list.reduce((t,o)=>t+(pqNum(String(o.kwc||''))||0),0), mwh=list.reduce((t,o)=>t+(pqNum(String(o.mwh||''))||0),0);
      return { phase:p, list, rows:list.map(meetRow), kwc, mwh };
    });
  }
  const meetTotal=(kwc,mwh,n)=>[n+' installation'+(n>1?'s':''), kwc?fmtKwc(kwc):'', mwh?(mwh>=1000?(Math.round(mwh/100)/10).toLocaleString('fr-FR')+' GWh/an':Math.round(mwh).toLocaleString('fr-FR')+' MWh/an'):''].filter(Boolean).join(' · ');
  function meetTitle(){ return 'Pipe agrégation · ce qui arrive · '+new Date().toLocaleDateString('fr-FR',{ day:'numeric', month:'long', year:'numeric' }); }
  // the same table as HTML with inline styles (pasted into Outlook / Teams, or printed)
  function meetHtml(groups){
    const e=escapeHtml, th='style="text-align:left;padding:5px 8px;border-bottom:2px solid #1A7B8C;font:600 11px Arial;color:#333;white-space:nowrap"', td='style="padding:4px 8px;border-bottom:1px solid #ddd;font:12px Arial;color:#111;vertical-align:top"';
    let h='<p style="font:600 14px Arial;margin:0 0 8px">'+e(meetTitle())+'</p><table style="border-collapse:collapse"><thead><tr>'+MEET_COLS.map(c=>'<th '+th+'>'+e(c)+'</th>').join('')+'</tr></thead><tbody>';
    groups.forEach(g=>{ if(!g.rows.length) return;
      h+='<tr><td colspan="'+MEET_COLS.length+'" style="padding:10px 8px 4px;font:700 12px Arial;color:#1A7B8C">'+e(g.phase.label)+' — '+e(meetTotal(g.kwc,g.mwh,g.rows.length))+'</td></tr>';
      g.rows.forEach(r=>{ h+='<tr>'+r.map((v,i)=>'<td '+td.replace('"padding','"'+(i<2?'font-weight:600;':'')+'padding')+'>'+e(v)+'</td>').join('')+'</tr>'; }); });
    return h+'</tbody></table>';
  }
  async function meetCopy(groups, btn){
    const html=meetHtml(groups), text=[meetTitle(), MEET_COLS.join('\t')].concat(...groups.filter(g=>g.rows.length).map(g=>[g.phase.label+' — '+meetTotal(g.kwc,g.mwh,g.rows.length)].concat(g.rows.map(r=>r.join('\t'))))).join('\n');
    try{ await navigator.clipboard.write([new ClipboardItem({ 'text/html':new Blob([html],{ type:'text/html' }), 'text/plain':new Blob([text],{ type:'text/plain' }) })]); flashBtn(btn,'✓ Copié'); }
    catch(e){ copyToClipboard(text, btn); }
  }
  function flashBtn(btn, txt){ if(!btn) return; const l=btn.textContent; btn.textContent=txt; setTimeout(()=>{ btn.textContent=l; },1600); }
  async function meetXlsx(groups, btn){
    try{
      await loadXlsxLib();
      const aoa=[[meetTitle()],[],MEET_COLS];
      groups.forEach(g=>{ if(!g.rows.length) return; aoa.push([g.phase.label+' — '+meetTotal(g.kwc,g.mwh,g.rows.length)]); g.list.forEach((o,i)=>{ const r=g.rows[i].slice(); r[3]=pqNum(String(o.kwc||''))||''; r[4]=Math.round(pqNum(String(o.mwh||'')))||''; aoa.push(r); }); aoa.push([]); });
      aoa[2][3]='Puissance (kWc)';
      const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=[22,24,9,14,12,6,14,24,14,22,26,10].map(w=>({ wch:w }));
      const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Ce qui arrive');
      const d=new Date(); XLSX.writeFile(wb, String(d.getFullYear()).slice(2)+pqPad(d.getMonth()+1)+pqPad(d.getDate())+'_Pipe agrégation - réunion pricing.xlsx');
      flashBtn(btn,'✓ Fichier créé');
    }catch(e){ flashBtn(btn,'Échec : '+(e.message||e)); }
  }
  function meetPrint(groups){
    const w=window.open('', '_blank'); if(!w){ alert('Autorise les fenêtres pour imprimer.'); return; }
    w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>'+escapeHtml(meetTitle())+'</title><style>@page{ size:A4 landscape; margin:12mm } body{ margin:0 } tr{ page-break-inside:avoid }</style></head><body>'+meetHtml(groups)+'</body></html>');
    w.document.close(); w.focus(); setTimeout(()=>w.print(), 200);
  }
  function renderPipeMeet(board, q){
    board.classList.add('pipe-meet');
    const groups=meetData(q), n=groups.reduce((t,g)=>t+g.rows.length,0);
    const head=document.createElement('div'); head.className='meet-head';
    head.innerHTML='<div class="meet-title"><b></b><span></span></div><div class="meet-actions"></div>';
    head.querySelector('b').textContent='Ce qui arrive'; head.querySelector('span').textContent=meetTotal(groups.reduce((t,g)=>t+g.kwc,0), groups.reduce((t,g)=>t+g.mwh,0), n);
    const acts=head.querySelector('.meet-actions');
    const mk=(label, fn, title)=>{ const b=document.createElement('button'); b.type='button'; b.className='pipe-bar-btn'; b.textContent=label; if(title) b.title=title; b.onclick=()=>fn(b); acts.appendChild(b); return b; };
    mk('Copier pour mail / Teams', b=>meetCopy(groups,b), 'Le tableau, prêt à coller dans un mail Outlook ou dans Teams');
    mk('Excel', b=>meetXlsx(groups,b), 'Télécharger le tableau en .xlsx');
    mk('Imprimer / PDF', ()=>meetPrint(groups), 'Imprimer, ou enregistrer en PDF (paysage)');
    board.appendChild(head);
    // which phases to show (remembered on this device)
    const chips=document.createElement('div'); chips.className='meet-chips'; const on=meetPhasesOn();
    MEET_PHASES.forEach(p=>{ const c=document.createElement('button'); c.type='button'; c.className='meet-chip'+(on.includes(p.key)?' on':''); c.textContent=p.label; c.dataset.phase=p.key; c.setAttribute('aria-pressed', String(on.includes(p.key)));
      c.onclick=()=>{ let v=meetPhasesOn(); v=v.includes(p.key)?v.filter(k=>k!==p.key):v.concat(p.key); if(!v.length) return; try{ localStorage.setItem('pipe-meet-phases', JSON.stringify(MEET_PHASES.map(x=>x.key).filter(k=>v.includes(k)))); }catch(e){} prefsToNote(); renderPipeline(); };
      chips.appendChild(c); });
    board.appendChild(chips);
    if(!n){ const e=document.createElement('div'); e.className='today-empty'; e.textContent='Aucune installation dans ces phases.'; board.appendChild(e); return; }
    const wrap=document.createElement('div'); wrap.className='meet-scroll';
    let t='<table class="meet-table"><thead><tr>'+MEET_COLS.map(c=>'<th>'+escapeHtml(c)+'</th>').join('')+'</tr></thead><tbody>';
    groups.forEach(g=>{ if(!g.rows.length) return;
      t+='<tr class="meet-sec"><th colspan="'+MEET_COLS.length+'">'+escapeHtml(g.phase.label)+'<span>'+escapeHtml(meetTotal(g.kwc,g.mwh,g.rows.length))+'</span></th></tr>';
      g.rows.forEach((r,i)=>{ t+='<tr data-id="'+escapeHtml(g.list[i].id)+'">'+r.map((v,j)=>'<td'+(j===1?' class="meet-name"':'')+'>'+escapeHtml(v)+'</td>').join('')+'</tr>'; }); });
    wrap.innerHTML=t+'</tbody></table>';
    wrap.querySelectorAll('tr[data-id]').forEach(tr=>{ tr.onclick=()=>openOppDetail(tr.dataset.id); });
    board.appendChild(wrap);
  }
  // ---------- saved views (tasks and pipeline): ready-made ones, and the user's own (filters + view + search) ----------
  // Kept on this device. A view only filters what is shown; nothing is changed in the data.
  const savedViewState={ tasks:null, pipeline:null };
  const dayMs=864e5, todayStart=()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; };
  const dueDays=t=>t.due?Math.round((new Date(t.due+'T00:00:00')-todayStart())/dayMs):null;
  const oppOpenTask=o=>tasks.some(t=>!t.deleted && !t.archived && (t.opportunityId===o.id || (o.requestId && t.opportunityId===o.requestId) || (o.taskId && t.id===o.taskId)));
  const PRESET_VIEWS={
    tasks:[
      { id:'late', name:'En retard', pred:t=>{ const d=dueDays(t); return d!==null && d<0; } },
      { id:'week', name:'Cette semaine', pred:t=>{ const d=dueDays(t); return d!==null && d<=7; }, view:'date' },
      { id:'waiting', name:'En attente des autres', pred:t=>t.status==='en_attente' },
      { id:'nodate', name:'Sans date', pred:t=>!t.due },
      { id:'byclient', name:'Par client', view:'client' }
    ],
    pipeline:[
      { id:'offer15', name:'Offres en attente depuis 15 j', pred:o=>o.stage==='offre_attente' && Date.now()-lastMove(o)>=15*dayMs },
      { id:'notask', name:'Dossiers sans tâche', pred:o=>!isExited(o) && o.kind==='installation' && !oppOpenTask(o) },
      { id:'mes6', name:'MES dans les 6 mois', pred:o=>{ const d=pqToDate(o.mesEff||o.mesPrev); return !!d && d>=todayStart() && d-todayStart()<=183*dayMs; } },
      { id:'mine', name:'Mes dossiers', pred:o=>{ let me=''; try{ me=localStorage.getItem('qualif-charge')||''; }catch(e){} return !me || o.charge===me; } }
    ]
  };
  function userViews(scope){ try{ return JSON.parse(localStorage.getItem('saved-views-'+scope)||'[]'); }catch(e){ return []; } }
  function storeUserViews(scope, list){ try{ localStorage.setItem('saved-views-'+scope, JSON.stringify(list)); }catch(e){} prefsToNote(); }
  function currentViewSnapshot(scope){
    const st=savedViewState[scope];
    if(scope==='tasks') return { filter:currentFilter, view:currentView, q:searchQuery||'', preset:st&&st.preset||null };
    return { q:$('opp-search').value||'', meet:pipeMeet, dash:pipeDash, preset:st&&st.preset||null };
  }
  function applySavedView(scope, v){
    const preset=v.preset?PRESET_VIEWS[scope].find(p=>p.id===v.preset):(v.id && PRESET_VIEWS[scope].find(p=>p.id===v.id));
    savedViewState[scope]={ name:v.name, pred:preset&&preset.pred||null, preset:preset?preset.id:null };
    if(scope==='tasks'){
      gsTab('tasks');
      if(v.filter){ currentFilter=v.filter; document.querySelectorAll('#filters .filter-chip').forEach(c=>c.classList.toggle('active', c.dataset.filter===v.filter)); }
      const view=v.view||(preset&&preset.view);
      if(view){ const b=document.querySelector('#view-switch [data-view="'+view+'"]'); if(b) b.click(); }
      if(v.q!=null){ const si=$('search-input'); if(si){ si.value=v.q; si.dispatchEvent(new Event('input')); } }
      render();
    } else {
      gsTab('pipeline');
      if(v.q!=null) $('opp-search').value=v.q;
      if(v.meet!=null){ pipeMeet=!!v.meet; pipeDash=!!v.dash&&!v.meet; }
      renderPipeline();
    }
    paintViewChip(scope);
  }
  function clearSavedView(scope){ savedViewState[scope]=null; paintViewChip(scope); if(scope==='tasks') render(); else renderPipeline(); }
  function paintViewChip(scope){
    const chip=$(scope==='tasks'?'tasks-view-chip':'pipe-view-chip'); if(!chip) return;
    const st=savedViewState[scope]; chip.hidden=!st; if(!st) return;
    chip.innerHTML=''; const t=document.createElement('span'); t.textContent=st.name; const x=document.createElement('button'); x.type='button'; x.textContent='×'; x.title='Revenir à l’affichage normal'; x.setAttribute('aria-label','Quitter la vue');
    x.onclick=()=>clearSavedView(scope); chip.append(t, x);
  }
  function openViewsMenu(scope, btn){
    document.querySelectorAll('.views-menu').forEach(m=>m.remove());
    const m=document.createElement('div'); m.className='views-menu'; m.setAttribute('role','menu');
    const item=(label, fn, cls)=>{ const b=document.createElement('button'); b.type='button'; b.className='views-item'+(cls?' '+cls:''); b.setAttribute('role','menuitem'); b.textContent=label; b.onclick=()=>{ m.remove(); fn(); }; m.appendChild(b); return b; };
    const head=t=>{ const h=document.createElement('div'); h.className='views-h'; h.textContent=t; m.appendChild(h); };
    head('Vues prêtes'); PRESET_VIEWS[scope].forEach(p=>item(p.name, ()=>applySavedView(scope, { id:p.id, name:p.name, preset:p.id })));
    const mine=userViews(scope);
    if(mine.length){ head('Mes vues'); mine.forEach((v,i)=>{ const b=item(v.name, ()=>applySavedView(scope, v)); const del=document.createElement('span'); del.className='views-del'; del.textContent='×'; del.title='Supprimer cette vue';
      del.onclick=e=>{ e.stopPropagation(); const l=userViews(scope); l.splice(i,1); storeUserViews(scope,l); m.remove(); openViewsMenu(scope, btn); }; b.appendChild(del); }); }
    item('+ Enregistrer la vue actuelle…', ()=>{ const name=prompt('Nom de la vue (filtres, affichage et recherche actuels) :', savedViewState[scope]?savedViewState[scope].name:''); if(!name||!name.trim()) return;
      const l=userViews(scope).filter(v=>v.name!==name.trim()); l.push(Object.assign({ name:name.trim() }, currentViewSnapshot(scope))); storeUserViews(scope,l); savedViewState[scope]=Object.assign({}, savedViewState[scope]||{}, { name:name.trim() }); paintViewChip(scope); }, 'save');
    document.body.appendChild(m);
    const r=btn.getBoundingClientRect(); m.style.left=Math.min(r.left, innerWidth-m.offsetWidth-8)+'px'; m.style.top=(r.bottom+4)+'px';
    // keyboard: arrows move, Escape closes and goes back to the button
    const its=()=>[...m.querySelectorAll('.views-item')];
    m.addEventListener('keydown', e=>{ const l=its(), i=l.indexOf(document.activeElement);
      if(e.key==='ArrowDown'){ e.preventDefault(); (l[i+1]||l[0]).focus(); } else if(e.key==='ArrowUp'){ e.preventDefault(); (l[i-1]||l[l.length-1]).focus(); }
      else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); m.remove(); btn.focus(); } });
    const f=its()[0]; if(f) f.focus();
    setTimeout(()=>document.addEventListener('click', function close(e){ if(!m.contains(e.target)){ m.remove(); document.removeEventListener('click', close, true); } }, true), 0);
  }
  window.todoExtraCommands=(window.todoExtraCommands||[]).concat(
    PRESET_VIEWS.tasks.map(p=>({ t:'Vue tâches : '+p.name, k:'vue filtre taches', go:()=>applySavedView('tasks',{ id:p.id, name:p.name, preset:p.id }) })),
    PRESET_VIEWS.pipeline.map(p=>({ t:'Vue pipeline : '+p.name, k:'vue filtre pipeline', go:()=>applySavedView('pipeline',{ id:p.id, name:p.name, preset:p.id }) })));
  function renderPipeline(){
    if(normalizeOpps()) saveCrmLocalOnly();
    const board=$('pipeline-board');
    board.innerHTML=''; board.classList.remove('pipe-dash','pipe-meet');
    $('pipe-dash-toggle').setAttribute('aria-pressed', String(pipeDash)); $('pipe-dash-toggle').classList.toggle('on', pipeDash);
    $('pipe-meet-toggle').setAttribute('aria-pressed', String(pipeMeet)); $('pipe-meet-toggle').classList.toggle('on', pipeMeet);
    $('pipe-exited-toggle').classList.toggle('hidden', pipeDash||pipeMeet);
    if(pipeDash){ renderPipeDash(board); return; }
    const q=pqFold($('opp-search').value.trim());
    if(pipeMeet){ renderPipeMeet(board, q); return; }
    const vp=savedViewState.pipeline && savedViewState.pipeline.pred;
    const items=opportunities.filter(o=>!o.deleted && o.kind!=='request' && o.stage!=='converti')
      .filter(o=>!q || pqFold([o.company,o.centrale,o.title,o.prenom,o.nom,o.dept].join(' ')).includes(q))
      .filter(o=>!vp || vp(o));
    const live=items.filter(o=>!isExited(o)), exited=items.filter(isExited);
    $('pipe-exited-toggle').textContent=pipeShowExited?'Masquer les sorties':('Sorties ('+exited.length+')');
    PIPE_PHASES.forEach(ph=>{
      const col=document.createElement('div'); col.className='pipe-col'; col.dataset.phase=ph.key;
      const inPhase=live.filter(o=>oppPhase(o)===ph.key).sort((a,b)=>(a.company||'').localeCompare(b.company||'','fr'));
      const head=document.createElement('div'); head.className='pipe-col-head';
      const kwc=inPhase.reduce((s,o)=>s+(parseFloat(String(o.kwc||'').replace(',','.'))||0),0);
      head.innerHTML='<span>'+ph.label+'</span><span>'+inPhase.length+(kwc?' · '+(kwc>=1000?(Math.round(kwc/100)/10).toLocaleString('fr-FR')+' MWc':Math.round(kwc)+' kWc'):'')+'</span>';
      col.appendChild(head);
      // installations of one pricing request in the same phase share one card
      const done=new Set();
      inPhase.forEach(o=>{
        if(done.has(o.id)) return;
        if(o.requestId){
          const group=inPhase.filter(x=>x.requestId===o.requestId);
          if(group.length>1){ group.forEach(x=>done.add(x.id)); col.appendChild(buildRequestCard(o.requestId, group)); return; }
        }
        done.add(o.id); col.appendChild(buildPipeCard(o));
      });
      if(!inPhase.length){ const e=document.createElement('div'); e.className='pipe-empty'; e.textContent='—'; col.appendChild(e); col.classList.add('empty'); }   // empty columns stay narrow
      board.appendChild(col);
    });
    if(pipeShowExited && exited.length){
      const col=document.createElement('div'); col.className='pipe-col lost';
      const head=document.createElement('div'); head.className='pipe-col-head';
      head.innerHTML='<span>Sorties</span><span>'+exited.length+'</span>';
      col.appendChild(head);
      exited.forEach(o=>col.appendChild(buildPipeCard(o)));
      board.appendChild(col);
    }
  }
  function stageChip(o){
    const s=oppStage(o.stage);
    const chip=document.createElement('span'); chip.className='pipe-chip'+(isExited(o)?' out':'');
    chip.textContent=stageLabel(o.stage);
    if(s && s.who && s.who!=='Com'){ const w=document.createElement('span'); w.className='pipe-who'; w.textContent=s.who; chip.appendChild(w); }
    return chip;
  }
  function fmtKwc(v){ const n=parseFloat(String(v||'').replace(',','.')); if(!n) return ''; return n>=1000?(Math.round(n/10)/100).toLocaleString('fr-FR')+' MWc':Math.round(n).toLocaleString('fr-FR')+' kWc'; }
  // ---------- Pipeline ↔ Suivi Agrégation: is this deal in the workbook, with the status its stage expects? ----------
  // From « Demande de prix » on, a deal belongs in the Suivi (En préparation → En attente → Gagné). Matched on the plant's
  // name (exact, or one inside the other), producer/client as a tie-break. Nothing shown while the Suivi is not loaded.
  function parcMatchOpp(o){
    if(parcData===null) loadParc();
    if(!parcData || !parcData.items) return null;
    const n=parcNorm(oppName(o)); if(n.length<3) return null;
    const cos=[o.producteur,o.company,o.spv].map(parcNorm).filter(x=>x.length>=3);
    const sameName=p=>{ const a=parcNorm(p.inst||p.prod); return a && (a===n || (a.length>=5 && n.length>=5 && (a.includes(n)||n.includes(a)))); };
    const coHit=p=>[p.prod,p.dev].map(parcNorm).some(a=>a && cos.some(c=>a===c || (a.length>=4 && (a.includes(c)||c.includes(a)))));
    const cands=parcData.items.filter(sameName);
    if(!cands.length) return null;
    return cands.find(p=>parcNorm(p.inst)===n && coHit(p)) || cands.find(coHit) || (cands.length===1?cands[0]:null);
  }
  function suiviState(o){
    if(o.kind!=='installation' || isExited(o) || stageIndex(o.stage)<stageIndex('demande_prix')) return null;
    if(parcData===null) loadParc();
    if(!parcData) return null;
    const want=(oppStage(o.stage)||{}).bdd, p=parcMatchOpp(o);
    if(!p) return { k:'missing', label:'Pas dans le Suivi', title:'Cette affaire n\u2019est pas encore dans le Suivi Agrégation (attendu : '+want+'). Utilise « Envoyer à la BDD Excel » ou « Copier ligne BDD ».' };
    if(want && p.statut && pqFold(p.statut)!==pqFold(want)) return { k:'diff', label:'Suivi : '+p.statut+' → '+want, title:'Dans le Suivi avec le statut « '+p.statut+' » ; l\u2019étape du pipeline correspond à « '+want+' ».', p };
    return { k:'ok', label:'Dans le Suivi'+(p.statut?' ('+p.statut+')':''), title:'Présente dans le Suivi Agrégation'+(p.statut?' avec le statut « '+p.statut+' »':'')+'.', p };
  }
  function suiviBadge(o, full){
    const s=suiviState(o); if(!s) return null;
    const b=document.createElement('span'); b.className='suivi-badge '+s.k; b.title=s.title;
    b.textContent=(s.k==='ok'?'✓ ':s.k==='diff'?'↻ ':'! ')+(full?s.label:(s.k==='ok'?'Suivi':s.k==='diff'?'Statut Suivi':'Hors Suivi'));
    return b;
  }
  function buildPipeCard(o){
    const card=document.createElement('div'); card.className='pipe-card'; card.dataset.id=o.id;
    card.style.borderLeft='3px solid '+clientColor(o.company);
    const c=document.createElement('div'); c.className='pipe-card-company'; c.style.color=clientColor(o.company); c.textContent=o.company; if(o.company) c.dataset.peek='co:'+o.company;
    const cs=companyStars(o.company); if(cs) c.appendChild(starsWidget(cs));
    card.appendChild(c);
    if(o.kind==='prequal'){
      const t=document.createElement('div'); t.className='pipe-card-title'; t.textContent=o.title||'Rencontre';
      card.appendChild(t);
    } else {
      const t=document.createElement('div'); t.className='pipe-card-title'; t.textContent=oppName(o); card.appendChild(t);
      const meta=document.createElement('div'); meta.className='pipe-card-meta';
      meta.appendChild(stageChip(o));
      const k=fmtKwc(o.kwc); if(k){ const s=document.createElement('span'); s.textContent=k; meta.appendChild(s); }
      const sb=suiviBadge(o); if(sb) meta.appendChild(sb);
      card.appendChild(meta);
    }
    card.onclick=()=>openOppDetail(o.id);
    return card;
  }
  function buildRequestCard(reqId, group){
    const req=opportunities.find(x=>x.id===reqId)||{};
    const company=group[0].company;
    const card=document.createElement('div'); card.className='pipe-card pipe-req-card'; card.dataset.id=reqId;
    card.style.borderLeft='3px solid '+clientColor(company);
    const c=document.createElement('div'); c.className='pipe-card-company'; c.style.color=clientColor(company); c.textContent=company; if(company) c.dataset.peek='co:'+company;
    const t=document.createElement('div'); t.className='pipe-card-title pipe-req-title'; t.title=(req.title||'Demande de pricing')+' · '+group.length+' installations';
    { const a=document.createElement('span'); a.textContent=req.title||'Demande de pricing'; const b=document.createElement('span'); b.className='pipe-req-n'; b.textContent=group.length+' install.'; t.append(a,b); }   // the count never cut off
    card.appendChild(c); card.appendChild(t);
    const same=group.every(o=>o.stage===group[0].stage);
    if(same){ const m=document.createElement('div'); m.className='pipe-card-meta'; m.appendChild(stageChip(group[0])); card.appendChild(m); }
    group.forEach(o=>{
      const r=document.createElement('div'); r.className='pipe-req-line';
      const n=document.createElement('span'); n.className='pipe-req-name'; n.textContent=oppName(o); n.title=[oppName(o), fmtKwc(o.kwc), stageLabel(o.stage)].filter(Boolean).join(' · ');
      r.appendChild(n);
      if(same){ const k=document.createElement('span'); k.className='pipe-req-kwc'; k.textContent=fmtKwc(o.kwc); r.appendChild(k); } else r.appendChild(stageChip(o));
      r.onclick=e=>{ e.stopPropagation(); openOppDetail(o.id); };
      card.appendChild(r);
    });
    card.onclick=()=>openRequestDetail(reqId);
    return card;
  }

  // ----- New opportunity / edit form (mail → prefilled Pipe lines, one per installation) -----
  let pqState=null;
  function pqDefaults(){
    let charge=''; try{ charge=localStorage.getItem('qualif-charge')||''; }catch(e){}
    const t=toISO(new Date());
    return { annee:t.slice(0,4), new:true, charge, dateEntree:t, action:'Rendez-vous à prendre', relance:pqAddDays(7), qualification:false, cr1:false, cr2:false, ca:'N/A' };
  }
  // Step 1 = who (client, then contact: existing or new), step 2 = data (mail / files → Pipe fields).
  function openOppForm(opts){
    opts=opts||{};
    const editing=opts.editId?opportunities.find(o=>o.id===opts.editId):null;
    pqState={ editId:editing?editing.id:null, prequalId:opts.prequalId||null, shared:pqDefaults(), installs:[{}], auto:new Set(), touched:new Set(), contactChoice:null, contactPicked:false, extras:[], extraExisting:new Set(), principal:'main', step:1 };
    pqLastFiles=null;
    if(editing){
      PQ_SHARED_KEYS.forEach(k=>{ if(editing[k]!==undefined) pqState.shared[k]=editing[k]; });
      pqState.editOtherIds=(editing.otherContactIds||[]).slice();
      pqState.peopleList=[]; (editing.otherContactIds||[]).map(id=>contacts.find(c=>c.id===id)).filter(Boolean).forEach(c=>pqState.peopleList.push({ id:c.id, v:contactV(c), label:[c.firstName,c.lastName].filter(Boolean).join(' ')||c.email }));
      // the installation being edited first, then the other installations of its pricing request (checked and corrected together)
      const asInst=o=>{ const inst={ _oppId:o.id }; PQ_CENTRALE_KEYS.forEach(k=>{ if(o[k]!==undefined) inst[k]=o[k]; }); if(o.caract) inst.caract=Object.assign({}, o.caract); return inst; };
      pqState.installs=[asInst(editing)].concat(editing.requestId?requestInstalls(editing.requestId).filter(x=>x.id!==editing.id).map(asInst):[]);
    }
    $('pq-title').textContent=editing?('Modifier — '+oppName(editing)):'Nouvelle opportunité';
    $('pq-mail').value=''; $('pq-files-info').textContent='';
    // editing: the mail / file area completes the empty fields only (what is already filled is "touched")
    pqSetFolded(pqFoldedPref());
    $('pq-drop-text').textContent=editing?'Pour compléter cette fiche : colle un mail ou dépose un .msg, un .eml ou l\u2019Excel du producteur. Seuls les champs vides seront remplis.':'Collez le mail, ou déposez ici un .msg, un .eml ou l\u2019Excel du producteur';
    if(editing){
      Object.keys(pqState.shared).forEach(k=>{ const v=pqState.shared[k]; if(v!==''&&v!=null&&v!==false) pqState.touched.add('s.'+k); });
      pqState.installs.forEach((inst,i)=>Object.keys(inst).forEach(k=>{ const v=inst[k]; if(k!=='_oppId' && k!=='caract' && v!==''&&v!=null) pqState.touched.add(i+'.'+k); }));
    }
    $('pq-overlay').querySelector('.pq-box').classList.toggle('edit', !!editing);
    $('pq-start-stage').innerHTML=OPP_STAGES.map(s=>'<option value="'+s.key+'">'+escapeHtml(PIPE_PHASES.find(p=>p.key===s.phase).label+' · '+s.label)+'</option>').join('');
    $('pq-create-task').checked=true;
    const names=[...new Set(clientsList.concat(companies.filter(c=>!c.deleted).map(c=>c.name)))].sort((x,y)=>x.localeCompare(y,'fr'));
    $('pq1-companies').innerHTML=names.map(n=>'<option value="'+escapeHtml(n)+'">').join('');
    $('pq1-company').value=opts.company||'';
    ['prenom','nom','qualite','tel','tel2','mail'].forEach(k=>{ $('pq1-'+k).value=''; });
    $('pq1-sig').value=''; $('pq1-sig-status').textContent=''; $('pq1-sig-box').open=false; pq1SigAuto=new Set();
    $('pq-overlay').classList.remove('hidden');
    if(editing){ pqShowStep(2); pqRender(); setTimeout(()=>{ const el=$('pq-form').querySelector('input'); if(el) el.focus({preventScroll:true}); },0); }
    else { pqShowStep(1); pqStep1Render(); setTimeout(()=>$(opts.company?'pq-next-btn':'pq1-company').focus({preventScroll:true}),0); }
  }
  function pqShowStep(n){
    pqState.step=n;
    const edit=!!pqState.editId;
    $('pq-step1').classList.toggle('hidden', n!==1);
    $('pq-layout').classList.toggle('hidden', n!==2);
    $('pq-summary').classList.toggle('hidden', n!==2);
    $('pq-next-btn').classList.toggle('hidden', n!==1);
    $('pq-back-btn').classList.toggle('hidden', n!==2 || edit);
    $('pq-save-btn').classList.toggle('hidden', n!==2);
    $('pq-start-row').classList.toggle('hidden', n!==2 || edit);
  }
  function pqKnownCompany(name){
    if(!name) return null;
    const lower=name.toLowerCase();
    const co=companies.find(c=>!c.deleted && c.name.toLowerCase()===lower);
    return co?co.name:findExistingCI(clientsList, name);
  }
  function pqStep1Render(){
    const name=$('pq1-company').value.trim(), known=pqKnownCompany(name);
    const list=known?contacts.filter(c=>!c.deleted && c.company===known).sort((x,y)=>((x.lastName||'')+(x.firstName||'')).localeCompare((y.lastName||'')+(y.firstName||''),'fr')):[];
    const hint=$('pq1-company-hint');
    hint.textContent=!name?'':known?'Client existant · '+list.length+' contact'+(list.length>1?'s':''):'Nouveau client';
    hint.className='pq-step-hint '+(!name?'':known?'known':'new');
    if(!pqState.contactPicked || (pqState.contactChoice!=='new' && !list.find(c=>c.id===pqState.contactChoice))){ pqState.contactChoice=list.length===1?list[0].id:'new'; pqState.contactPicked=false; }
    const box=$('pq1-contacts'); box.innerHTML='';
    list.forEach(c=>{
      const b=document.createElement('button'); b.type='button'; b.className=pqState.contactChoice===c.id?'on':'';
      b.textContent=[c.firstName,c.lastName].filter(Boolean).join(' ')+(c.role?' · '+c.role:'');
      b.onclick=()=>{ pqState.contactChoice=c.id; pqState.contactPicked=true; pqStep1Render(); };
      box.appendChild(b);
    });
    const nb=document.createElement('button'); nb.type='button'; nb.className=pqState.contactChoice==='new'?'on':''; nb.textContent='+ Nouveau contact';
    nb.onclick=()=>{ pqState.contactChoice='new'; pqState.contactPicked=true; pqStep1Render(); $('pq1-prenom').focus(); };
    box.appendChild(nb);
    $('pq1-new').classList.toggle('hidden', pqState.contactChoice!=='new');
    // other existing contacts of the client: tick the ones also involved
    const ex=$('pq1-extra-existing'); ex.innerHTML='';
    list.filter(c=>c.id!==pqState.contactChoice).forEach(c=>{
      const b=document.createElement('button'); b.type='button'; b.className=pqState.extraExisting.has(c.id)?'on':'';
      b.textContent=(pqState.extraExisting.has(c.id)?'✓ ':'+ ')+[c.firstName,c.lastName].filter(Boolean).join(' ')+(c.role?' · '+c.role:'');
      b.onclick=()=>{ pqState.extraExisting.has(c.id)?pqState.extraExisting.delete(c.id):pqState.extraExisting.add(c.id); pqStep1Render(); };
      ex.appendChild(b);
    });
    pqExtrasRender();
    pqPrincipalRender();
  }
  // Everyone involved in step 1: the contact block above, existing contacts ticked, new contacts added.
  // key: 'main' | 'ex:<contact id>' | 'x:<index>'
  function pqParticipants(){
    const st=pqState, out=[];
    if(st.contactChoice && st.contactChoice!=='new'){ const c=contacts.find(x=>x.id===st.contactChoice); if(c) out.push({ key:'main', id:c.id, label:[c.firstName,c.lastName].filter(Boolean).join(' ')||c.email, v:{ prenom:c.firstName, nom:(c.lastName||'').toUpperCase(), qualite:c.role, tel:[c.phone1,c.phone2].filter(Boolean).join(' / '), mail:c.email } }); }
    else { const v={ prenom:pqTitleCase($('pq1-prenom').value.trim()), nom:$('pq1-nom').value.trim().toUpperCase(), qualite:$('pq1-qualite').value.trim(), tel:[$('pq1-tel').value.trim(), $('pq1-tel2').value.trim()].filter(Boolean).join(' / '), mail:$('pq1-mail').value.trim().toLowerCase() };
      if(v.prenom||v.nom||v.mail) out.push({ key:'main', label:[v.prenom,v.nom].filter(Boolean).join(' ')||v.mail, v }); }
    [...st.extraExisting].forEach(id=>{ const c=contacts.find(x=>x.id===id); if(c) out.push({ key:'ex:'+id, id, label:[c.firstName,c.lastName].filter(Boolean).join(' ')||c.email, v:{ prenom:c.firstName, nom:(c.lastName||'').toUpperCase(), qualite:c.role, tel:[c.phone1,c.phone2].filter(Boolean).join(' / '), mail:c.email } }); });
    st.extras.forEach((x,i)=>{ const v={ prenom:pqTitleCase((x.prenom||'').trim()), nom:(x.nom||'').trim().toUpperCase(), qualite:(x.qualite||'').trim(), tel:[x.tel,x.tel2].map(t=>(t||'').trim()).filter(Boolean).join(' / '), mail:(x.mail||'').trim().toLowerCase() };
      if(v.prenom||v.nom||v.mail) out.push({ key:'x:'+i, label:[v.prenom,v.nom].filter(Boolean).join(' ')||v.mail, v }); });
    return out;
  }
  // the main contact (Pipe columns) is chosen among them; shown once there are at least two people
  function pqPrincipalRender(){
    const box=$('pq1-principal'); if(!box) return;
    const list=pqParticipants();
    if(!list.some(p=>p.key===pqState.principal)) pqState.principal=list.length?list[0].key:'main';
    if(list.length<2){ box.innerHTML=''; return; }
    box.innerHTML='<div class="pq-step-n">Contact principal <span class="pq-step-hint" style="text-transform:none;letter-spacing:0;">— celui des colonnes du Pipe ; les autres restent liés à l\u2019opportunité</span></div>'
      +'<div class="pq1-contacts">'+list.map(p=>'<button type="button" data-principal="'+escapeHtml(p.key)+'" class="'+(p.key===pqState.principal?'on':'')+'">'+(p.key===pqState.principal?'★ ':'')+escapeHtml(p.label)+(p.v.qualite?' · '+escapeHtml(p.v.qualite):'')+'</button>').join('')+'</div>';
  }
  // additional new contacts (beyond the main one)
  const PQ_EXTRA_FIELDS_C=[['prenom','Prénom'],['nom','Nom'],['qualite','Qualité'],['tel','Téléphone 1 (mobile)'],['tel2','Téléphone 2'],['mail','Mail']];
  function pqExtrasRender(){
    const box=$('pq1-extras'); box.innerHTML='';
    pqState.extras.forEach((x,i)=>{
      const d=document.createElement('div'); d.className='pq1-extra';
      d.innerHTML='<div class="pq1-extra-h"><span>Contact '+(i+2)+'</span><button type="button" class="pq-link" data-x-remove="'+i+'">Retirer</button></div><div class="pq-grid">'
        +PQ_EXTRA_FIELDS_C.map(([k,l])=>'<div class="pq-f"><label>'+l+'</label><input data-x="'+i+'" data-xk="'+k+'" value="'+escapeHtml(x[k]||'')+'" autocomplete="off"></div>').join('')+'</div>';
      box.appendChild(d);
    });
  }
  // Step 1 « Coller une signature »: same reader as Contacts; fills the client and the contact.
  // Fields typed by hand are never overwritten; a new paste replaces what a previous paste filled.
  let pq1SigAuto=new Set(), pq1SigTimer=null, pq1SigApplied=false;
  function pqApplySignature(text){
    const st=pqState; if(!st) return;
    const g=parseSignatureText(text||'');
    const set=(id,v)=>{ const el=$(id); if(!el || !v) return; if(el.value && !pq1SigAuto.has(id)) return; el.value=v; pq1SigAuto.add(id); };
    if(g.company){ const known=pqKnownCompany(g.company); set('pq1-company', known||g.company); }
    pqStep1Render();
    const company=pqKnownCompany($('pq1-company').value.trim());
    const mail=(g.email||'').toLowerCase();
    const existing=company && contacts.find(c=>!c.deleted && c.company===company && ((mail && (c.email||'').toLowerCase()===mail) || (g.firstName && c.firstName===g.firstName && (c.lastName||'').toLowerCase()===(g.lastName||'').toLowerCase())));
    // is the main contact already someone else? (typed by hand or filled by an earlier signature)
    const mPrenom=$('pq1-prenom').value.trim(), mNom=$('pq1-nom').value.trim(), mMail=$('pq1-mail').value.trim().toLowerCase();
    const samePerson=(mail && mMail===mail) || (g.firstName && mPrenom.toLowerCase()===g.firstName.toLowerCase() && mNom.toLowerCase()===(g.lastName||'').toLowerCase());
    const mainFilled=st.contactChoice==='new' && (mPrenom||mMail);
    const mainIsOther=(st.contactChoice!=='new' && st.contactPicked && !existing) || (mainFilled && !samePerson);
    if(existing && st.contactPicked && st.contactChoice!==existing.id && st.contactChoice!=='new'){ st.extraExisting.add(existing.id); }
    else if(existing){ st.contactChoice=existing.id; st.contactPicked=true; }
    else if(mainIsOther && (g.firstName||g.lastName||mail)){
      // the main contact is already someone else: this signature is an additional contact
      if(!st.extras.some(x=>(mail && x.mail===mail) || (x.prenom===g.firstName && x.nom===(g.lastName||'').toUpperCase())))
        st.extras.push({ prenom:g.firstName||'', nom:(g.lastName||'').toUpperCase(), qualite:g.role||'', tel:g.phone1||'', tel2:g.phone2||'', mail });
    }
    else if(g.firstName||g.lastName||mail){
      st.contactChoice='new'; st.contactPicked=true;
      set('pq1-prenom', g.firstName); set('pq1-nom', (g.lastName||'').toUpperCase()); set('pq1-qualite', g.role);
      set('pq1-tel', g.phone1); set('pq1-tel2', g.phone2); set('pq1-mail', mail);
    }
    pqStep1Render();
    const found=[g.company&&'client', (g.firstName||g.lastName)&&'nom', g.role&&'fonction', g.phone1&&'téléphone', mail&&'mail'].filter(Boolean);
    $('pq1-sig-status').textContent=found.length?('Lu : '+found.join(', ')+(existing?' — contact déjà connu, sélectionné.':'.')+' Colle une autre signature pour ajouter un contact.'):'Rien de reconnu dans ce texte.';
    pq1SigApplied=!!found.length;
  }
  function pqNext(){
    const name=$('pq1-company').value.trim();
    const people=pqParticipants();
    const principal=people.find(p=>p.key===pqState.principal)||people[0]||null;
    pqState.extraContacts=people.filter(p=>p!==principal && !p.id).map(p=>p.v);
    pqState.extraContactIds=people.filter(p=>p!==principal && p.id).map(p=>p.id);
    pqState.principalPerson=principal;
    pqState.peopleList=people; pqState.mainKey=principal?'p:'+people.indexOf(principal):'';
    if(!name){ $('pq1-company-hint').textContent='Indique le producteur pour continuer.'; $('pq1-company-hint').className='pq-step-hint new'; $('pq1-company').focus(); return; }
    const st=pqState, known=pqKnownCompany(name), set=(k,v)=>{ if(v){ st.shared[k]=v; st.touched.add('s.'+k); } };
    set('producteur', known||name);
    if(st.principalPerson){
      const v=st.principalPerson.v; set('prenom',v.prenom); set('nom',v.nom); set('qualite',v.qualite); set('tel',v.tel); set('mail',v.mail);
    } else if(st.contactChoice && st.contactChoice!=='new'){
      const c=contacts.find(x=>x.id===st.contactChoice);
      if(c){ set('prenom',c.firstName); set('nom',(c.lastName||'').toUpperCase()); set('qualite',c.role); set('tel',[c.phone1,c.phone2].filter(Boolean).join(' / ')); set('mail',c.email); }
    } else {
      set('prenom',pqTitleCase($('pq1-prenom').value.trim())); set('nom',$('pq1-nom').value.trim().toUpperCase()); set('qualite',$('pq1-qualite').value.trim()); set('tel',[$('pq1-tel').value.trim(), $('pq1-tel2').value.trim()].filter(Boolean).join(' / ')); set('mail',$('pq1-mail').value.trim().toLowerCase());
    }
    // a known client: reuse what its last installation already says
    if(known){
      const prev=opportunities.filter(o=>!o.deleted && o.kind==='installation' && o.company===known).sort((x,y)=>(y.updatedAt||0)-(x.updatedAt||0))[0];
      if(prev){
        ['charge','origine','ca','marche'].forEach(k=>{ if(prev[k] && !st.touched.has('s.'+k)){ st.shared[k]=prev[k]; st.auto.add('s.'+k); } });
        ['region','dept'].forEach(k=>{ if(prev[k]){ st.installs[0][k]=prev[k]; st.auto.add('0.'+k); } });
      }
    }
    pqShowStep(2); pqRender();
    setTimeout(()=>$('pq-mail').focus({preventScroll:true}),0);
  }
  function closeOppForm(){ $('pq-overlay').classList.add('hidden'); pqState=null; }
  function pqFieldHtml(f, scope, v, auto){
    const id='pq-'+scope+'-'+f.k;
    const data=' data-k="'+f.k+'" data-s="'+scope+'"';
    let input;
    if(f.type==='select') input='<select id="'+id+'"'+data+'><option value=""></option>'+f.opts.map(o=>'<option'+(o===v?' selected':'')+'>'+escapeHtml(o)+'</option>').join('')+(v && !f.opts.includes(v)?'<option selected>'+escapeHtml(v)+'</option>':'')+'</select>';
    else if(f.type==='list') input='<input id="'+id+'"'+data+' list="pq-dl-'+f.k+'" value="'+escapeHtml(v||'')+'" autocomplete="off">';
    else if(f.type==='check') input='<span class="pq-check"><input type="checkbox" id="'+id+'"'+data+(v?' checked':'')+'> '+(v?'Oui':'Non')+'</span>';
    else if(f.type==='area') input='<textarea id="'+id+'"'+data+' rows="'+(f.k==='commentaires'?3:2)+'">'+escapeHtml(v||'')+'</textarea>';
    else input='<input id="'+id+'"'+data+' type="'+(f.type==='date'?'date':'text')+'"'+(f.type==='number'?' inputmode="decimal"':'')+' value="'+escapeHtml(v||'')+'"'+(f.ph?' placeholder="'+escapeHtml(f.ph)+'"':'')+' autocomplete="off">';
    const empty=f.req && pqIsEmpty(f, scope);
    let extra='';
    if(f.k==='mwh' && scope!=='s'){
      const inst=pqState.installs[+scope]||{};
      if(!inst.mwh && inst.kwc && /PV/.test(inst.install||'')){
        const y=PQ_YIELD[inst.region]||1150, est=Math.round(pqNum(inst.kwc)*y/1000);
        if(est>0) extra='<button type="button" class="pq-sugg" data-est="'+est+'" data-s="'+scope+'">≈ '+est.toLocaleString('fr-FR')+' MWh ('+y+' kWh/kWc)</button>';
      }
    }
    if(f.k==='p90' && scope!=='s'){
      const inst=pqState.installs[+scope]||{}, p50=pqNum(String(inst.mwh||'')), wind=inst.install==='Eolien', r=wind?0.85:0.92;
      if(!inst.p90 && p50>0) extra='<button type="button" class="pq-sugg" data-p90="'+Math.round(p50*r)+'" data-s="'+scope+'" title="Ordre de grandeur usuel ('+(wind?'éolien':'solaire')+') : P90 ≈ '+Math.round(r*100)+' % du P50. À confirmer avec le producteur.">≈ '+Math.round(p50*r).toLocaleString('fr-FR')+' MWh ('+Math.round(r*100)+' % du P50)</button>';
    }
    if(f.k==='debut' && scope!=='s'){
      const inst=pqState.installs[+scope]||{}, mes=pqFullDate(inst.mesEff||inst.mesPrev), y=new Date().getFullYear();
      extra='<div class="pq-dchips">'+(mes && pqState.installs.length<2?'<button type="button" data-dset="debut" data-v="'+mes+'" data-s="'+scope+'" title="Début à la mise en service ('+mes+')">MES</button>':'')
        +[y+1,y+2].map(Y=>'<button type="button" data-dset="debut" data-v="01/01/'+Y+'" data-s="'+scope+'" title="1er janvier '+Y+'">1/1/'+String(Y).slice(2)+'</button>').join('')
        +(pqState.installs.length>1?'<button type="button" data-dall="mes" data-s="'+scope+'" title="Chaque installation démarre à sa propre mise en service (date de début = MES de chacune)">MES toutes</button>':'')+'</div>';
    }
    if(f.k==='fin' && scope!=='s'){ const y=new Date().getFullYear();
      extra='<div class="pq-dchips">'+[1,2,3].map(n=>'<button type="button" data-dset="fin" data-v="31/12/'+(y+n)+'" data-s="'+scope+'" title="Fin le 31 décembre '+(y+n)+'">31/12/'+String(y+n).slice(2)+'</button>').join('')+'</div>'; }
    let toAll='';
    if(scope!=='s' && pqState.installs.length>1 && f.type!=='computed' && !['centrale','kwc','mwh','p90','productible'].includes(f.k)){   // a plant's own name and figures are never copied
      const has=v!=null && v!=='' && v!==false, differs=pqState.installs.some((x,j)=>j!==+scope && String(x[f.k]==null||x[f.k]===false?'':x[f.k])!==String(has?v:''));
      toAll='<button type="button" class="pq-toall'+(!has && !differs?' off':differs?' go':'')+(!has && differs?' clear':'')+'" data-toall="'+f.k+'" data-s="'+scope+'"'+(!has && !differs?' tabindex="-1" aria-hidden="true"':'')
        +' title="'+(!differs?'Toutes les installations ont déjà cette valeur':has?'Mettre cette valeur sur toutes les installations':'Vider ce champ sur toutes les installations')+'" aria-label="'+(!differs?'Déjà sur toutes les installations':has?'Appliquer à toutes les installations':'Vider sur toutes les installations')+'">'
        +(has && !differs?'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8.5l2.5 2.5L12 5.5"/></svg>':'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5"/></svg>')+'</button>';
    }
    // the round « → toutes » sits inside the field, on its right
    const box=toAll?'<div class="pq-in pq-in-'+f.type+'">'+input+toAll+'</div>':input;
    return '<div class="pq-f'+(f.wide?' wide':'')+(auto?' auto':'')+(empty?' empty':'')+'"><label for="'+id+'">'+escapeHtml(f.label)+' <span class="pq-col">'+f.col+'</span></label>'+box+extra+'</div>';
  }
  // ---------- Contract dates: start + duration → end, start + end → duration, end + duration → start ----------
  // « mars 2027 » / « 2027 » become dd/mm/yyyy; a computed date shows in green and can still be typed over.
  function pqFullDate(s){ const p=pqMonthYear(s); if(!p) return ''; const d=new Date(p.y, (p.m||1)-1, p.d||1); return pqPad(d.getDate())+'/'+pqPad(d.getMonth()+1)+'/'+d.getFullYear(); }
  const pqDateOf=s=>{ const p=pqMonthYear(s); return p?new Date(p.y,(p.m||1)-1,p.d||1):null; };
  function pqLinkDates(i, changed){
    // start and end give the duration; the duration never moves a date (typed alone, it stays as typed)
    const st=pqState, inst=st.installs[i]; if(!inst) return;
    ['debut','fin'].forEach(k=>{ if(inst[k] && k===changed){ const f=pqFullDate(inst[k]); if(f) inst[k]=f; } });
    const d=pqDateOf(inst.debut), f=pqDateOf(inst.fin);
    if(changed!=='duree' && d && f && f>d){
      const yrs=Math.round(((f-d)/864e5+1)/365.25*2)/2;
      inst.duree=String(yrs).replace('.',','); st.auto.add(i+'.duree'); st.touched.delete(i+'.duree');
    }
  }


  // ---------- Power, P50 volume and specific yield: any two give the third ----------
  // P50 (MWh) = kWc × productible (kWh/kWc) / 1000. Only an empty or already computed box is filled (green, can be typed over);
  // a computed value never feeds another computation.
  function pqDerive(i){
    const st=pqState, inst=st.installs[i]; if(!inst) return;
    const der=st.derived||(st.derived=new Set());
    const val=k=>{ const n=pqNum(String(inst[k]==null?'':inst[k])); return n>0 && !der.has(i+'.'+k)?n:0; };
    const free=k=>inst[k]==null||inst[k]===''||der.has(i+'.'+k);
    const set=(k,v)=>{ if(String(inst[k]||'')===v) { der.add(i+'.'+k); st.auto.add(i+'.'+k); return; } inst[k]=v; der.add(i+'.'+k); st.auto.add(i+'.'+k); st.touched.delete(i+'.'+k); };
    const kwc=val('kwc'), mwh=val('mwh'), pr=val('productible');
    if(free('mwh') && kwc && pr){ const n=kwc*pr/1000; set('mwh', String(n>=100?Math.round(n):Math.round(n*10)/10)); }
    else if(free('productible') && kwc && mwh) set('productible', String(Math.round(mwh*1000/kwc)));
    else if(free('kwc') && mwh && pr) set('kwc', xlRound(mwh*1000/pr, 2));
    // a computed box whose sources were emptied is emptied too
    ['mwh','productible','kwc'].forEach(k=>{ if(der.has(i+'.'+k) && [kwc,mwh,pr].filter(Boolean).length<2){ inst[k]=''; der.delete(i+'.'+k); st.auto.delete(i+'.'+k); } });
  }
  // the mail / file column of the form can be folded away; remembered on this device
  function pqFoldedPref(){ try{ return localStorage.getItem('pq-mail-folded')==='1'; }catch(e){ return false; } }
  function pqSetFolded(f){ const l=$('pq-layout'), b=$('pq-fold'); if(!l||!b) return; l.classList.toggle('folded', f); b.setAttribute('aria-expanded', String(!f)); b.title=f?'Afficher le mail et les fichiers':'Replier le mail et les fichiers'; }
  document.addEventListener('click', e=>{ const b=e.target.closest && e.target.closest('#pq-fold'); if(!b) return; const f=!$('pq-layout').classList.contains('folded'); pqSetFolded(f); try{ localStorage.setItem('pq-mail-folded', f?'1':'0'); }catch(err){} });
  function flashPqToAll(k){ document.querySelectorAll('#pq-form [data-k="'+k+'"]').forEach(el=>{ const f=el.closest('.pq-f'); if(f){ f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash'); } }); }
  function pqIsEmpty(f, scope){
    const src=scope==='s'?pqState.shared:pqState.installs[+scope]||{};
    if(f.k==='tel'||f.k==='mail') return !pqState.shared.tel && !pqState.shared.mail;
    const v=src[f.k]; return v==null||v==='';
  }
  function pqRender(){
    const st=pqState; if(!st) return;
    const sec=(key,label,open)=>{
      const fs=PQ_FIELDS.filter(f=>f.sec===key);
      const inner='<div class="pq-grid">'+fs.map(f=>pqFieldHtml(f,'s',st.shared[f.k],st.auto.has('s.'+f.k))).join('')+'</div>';
      return open?'<div class="pq-sec"><div class="pq-sec-h">'+label+'</div>'+inner+'</div>':'<details class="pq-sec"><summary class="pq-sec-h">'+label+'</summary>'+inner+'</details>';
    };
    let h=sec('prod','Producteur',true)+sec('contact','Contact principal',true).replace('Contact principal</div>','Contact principal'+pqContactSwitch()+'</div>')+pqCountBox();
    st.installs.forEach((inst,i)=>{
      pqDerive(i);
      const fs=PQ_FIELDS.filter(f=>f.sec==='centrale').concat(PQ_EXTRA_FIELDS);
      // grouped by meaning (not by Excel column): plant, place, production, dates, then the free notes
      const byK=k=>fs.find(f=>f.k===k), used=new Set(PQ_INST_GROUPS.flatMap(g=>g[1]));
      const groups=PQ_INST_GROUPS.map(([label,keys])=>[label, keys.map(byK).filter(Boolean)]);
      const rest=fs.filter(f=>!used.has(f.k)); if(rest.length) groups[groups.length-1][1].push(...rest);
      const tag=!st.editId||st.installs.length<2?'':i===0?'<span class="pq-inst-tag">celle que tu modifies</span>':inst._oppId?'<span class="pq-inst-tag">déjà dans la demande</span>':'<span class="pq-inst-tag new">nouvelle : sera créée</span>';
      const many=st.installs.length>1, sub=[inst.centrale, fmtKwc(inst.kwc)].filter(Boolean).join(' · ');
      h+='<div class="pq-sec pq-inst'+(many?' many':'')+'" style="--inst-c:'+PROJECT_PALETTE[i%PROJECT_PALETTE.length]+'"><div class="pq-sec-h">'+(many?'<span class="pq-inst-n">'+(i+1)+'</span><span class="pq-inst-name">'+escapeHtml(sub||'Installation '+(i+1))+'</span>':'Installation')+tag
        +(st.installs.length>1 && !(st.editId && i===0)?'<button type="button" class="pq-link" data-remove="'+i+'">'+(st.editId && inst._oppId?'Ne pas modifier ici':'Retirer')+'</button>':'')+'</div>'
        +groups.map(([label,gf])=>(label?'<div class="pq-grp">'+label+'</div>':'')+'<div class="pq-grid pq-grid5">'+gf.map(f=>pqFieldHtml(f,String(i),inst[f.k],st.auto.has(i+'.'+f.k))).join('')+'</div>').join('')+'</div>';
    });
    if(!st.editId) h+='<div class="pq-add-inst"><button type="button" class="pq-link" id="pq-add-inst">+ Ajouter une installation</button>'+(st.installs.length>1?'<span class="pq-hint">Les '+st.installs.length+' installations seront regroupées dans une même demande de pricing.</span>':'')+'</div>';
    h+=sec('suivi','Suivi',true)+sec('comment','Commentaires',true)+sec('suite','RDV et offre',false);
    const openDetails=[...$('pq-form').querySelectorAll('details[open] > summary')].map(s=>s.textContent);
    $('pq-form').innerHTML=h+PQ_FIELDS.filter(f=>f.type==='list').map(f=>'<datalist id="pq-dl-'+f.k+'">'+f.opts.map(o=>'<option value="'+escapeHtml(o)+'">').join('')+'</datalist>').join('');
    $('pq-form').querySelectorAll('details').forEach(d=>{ if(openDetails.includes(d.querySelector('summary').textContent)) d.open=true; });
    attachLinkAutocomplete($('pq-s-commentaires'));   // « [[ » in the pipeline comments too
    pqSummary();
  }
  // Number of plants: checked against what the mail announces; to be confirmed when there are several or a gap
  function pqCountCheck(){
    const st=pqState, n=st.installs.length, h=st.hints||{};
    const sum=Math.round(st.installs.reduce((s,i)=>s+(pqNum(i.kwc||'')||0),0)*100)/100;
    const issues=[];
    if(h.count && h.count!==n) issues.push('Le mail annonce '+h.count+' installations ('+h.source+'), il y en a '+n+' ici : ajoute ou retire une installation, ou confirme si le mail se trompe.');
    if(h.total && sum && Math.abs(sum-h.total)/h.total>0.02) issues.push('Puissance totale annoncée : '+fmtKwc(h.total)+' ; somme des installations : '+fmtKwc(sum)+'.');
    const need=!st.editId && (n>=2 || issues.length>0);
    return { n, sum, issues, need, hints:h };
  }
  function pqCountBox(){
    const c=pqCountCheck(); if(!c.need) return '';
    const st=pqState, ok=!c.issues.length;
    const list=st.installs.map(i=>(i.centrale||'(sans nom)')+(i.kwc?' '+fmtKwc(i.kwc):'')).join(' · ');
    return '<div class="pq-count '+(ok?'ok':'warn')+'" id="pq-count-box"><div class="pq-count-h">'+(ok?'✓':'⚠')+' '+c.n+' installation'+(c.n>1?'s':'')+(c.sum?' — '+fmtKwc(c.sum)+' au total':'')
      +(ok && c.hints.count?' · conforme au mail ('+escapeHtml(c.hints.source)+')':'')+'</div><div class="pq-count-list">'+escapeHtml(list)+'</div>'
      +c.issues.map(x=>'<div class="pq-count-issue">'+escapeHtml(x)+'</div>').join('')
      +'<label class="pq-count-ok"><input type="checkbox" id="pq-count-ok"'+(st.countConfirmed===c.n?' checked':'')+'> J\u2019ai vérifié : '+c.n+' installation'+(c.n>1?'s':'')+'</label></div>';
  }
  // Step 2 « Changer de contact principal »: the step-1 people and the client's contacts
  // ---------- Duplicate contacts: same mail, same phone, or same name in the same company → proposed for merging ----------
  function contactDupKeys(c){
    const keys=[];
    if(c.email) keys.push('m:'+c.email.trim().toLowerCase());
    [c.phone1,c.phone2].filter(Boolean).forEach(p=>{ const d=String(p).replace(/\D/g,'').replace(/^33/,'0'); if(d.length>=9) keys.push('t:'+d.slice(-9)); });
    if(c.lastName && c.company) keys.push('n:'+pqFold(c.firstName+' '+c.lastName+' '+c.company).replace(/\s+/g,' ').trim());
    return keys;
  }
  const notDup=(a,b)=>(a.notDupOf||[]).includes(b.id) || (b.notDupOf||[]).includes(a.id);
  function contactDupGroups(){
    const list=activeContacts(), byKey=new Map(), parent=new Map(list.map(c=>[c.id,c.id]));
    const find=x=>{ while(parent.get(x)!==x){ parent.set(x, parent.get(parent.get(x))); x=parent.get(x); } return x; };
    list.forEach(c=>contactDupKeys(c).forEach(k=>{ const o=byKey.get(k); if(!o) byKey.set(k,c); else if(!notDup(o,c)) parent.set(find(c.id), find(o.id)); }));
    const groups=new Map(); list.forEach(c=>{ const r=find(c.id); (groups.get(r)||groups.set(r,[]).get(r)).push(c); });
    return [...groups.values()].filter(g=>g.length>1).map(g=>g.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)));
  }
  const CT_MERGE_FIELDS=[['firstName','Prénom'],['lastName','Nom'],['role','Fonction'],['company','Société'],['email','Mail'],['phone1','Tél. 1'],['phone2','Tél. 2'],['comment','Commentaire']];
  function renderDupesBanner(){
    const el=$('ct-dupes-banner'); if(!el) return;
    const g=contactDupGroups();
    if(!g.length){ el.hidden=true; el.innerHTML=''; return; }
    el.hidden=false;
    el.innerHTML='<span></span><button type="button" class="pq-link">Vérifier et fusionner</button>';
    el.querySelector('span').textContent=g.length+' contact'+(g.length>1?'s':'')+' en double possible'+(g.length>1?'s':'')+' : '+g.slice(0,3).map(x=>x.map(c=>[c.firstName,c.lastName].filter(Boolean).join(' ')).join(' / ')).join(' ; ')+(g.length>3?'…':'');
    el.querySelector('button').onclick=()=>openContactMerge();
  }
  function openContactMerge(onlyIds){
    let groups=contactDupGroups(); if(onlyIds) groups=groups.filter(g=>g.some(c=>onlyIds.includes(c.id)));
    const body=$('ct-merge-body'); body.innerHTML='';
    if(!groups.length){ body.innerHTML='<p class="modal-hint">Plus aucun doublon.</p>'; $('ct-merge-overlay').classList.remove('hidden'); return; }
    groups.forEach((g,gi)=>{
      const s=document.createElement('section'); s.className='ctm-group';
      const why=[...new Set(g.flatMap(contactDupKeys).filter(k=>g.filter(c=>contactDupKeys(c).includes(k)).length>1).map(k=>k[0]))].map(t=>t==='m'?'même mail':t==='t'?'même téléphone':'même nom').join(', ');
      s.innerHTML='<div class="ctm-h"></div><div class="ctm-table"></div><div class="ctm-actions"><button type="button" class="ctm-merge">Fusionner en une seule fiche</button><button type="button" class="ghost-btn ctm-not">Ce sont deux personnes différentes</button></div>';
      s.querySelector('.ctm-h').textContent=g.map(c=>[c.firstName,c.lastName].filter(Boolean).join(' ')||c.email).join(' / ')+' — '+why;
      const t=s.querySelector('.ctm-table');
      CT_MERGE_FIELDS.forEach(([k,l])=>{
        const vals=[...new Set(g.map(c=>String(c[k]||'').trim()).filter(Boolean))];
        if(!vals.length) return;
        const r=document.createElement('div'); r.className='ctm-row';
        const lab=document.createElement('span'); lab.className='ctm-l'; lab.textContent=l; r.appendChild(lab);
        const opts=document.createElement('div'); opts.className='ctm-opts';
        if(vals.length===1){ const b=document.createElement('b'); b.textContent=vals[0]; opts.appendChild(b); }
        else vals.forEach((v,vi)=>{
          const lb=document.createElement('label'); lb.className='ctm-opt'; const i=document.createElement('input'); i.type='radio'; i.name='ctm-'+gi+'-'+k; i.value=v; i.checked=vi===0;
          const from=g.filter(c=>String(c[k]||'').trim()===v).map(c=>'fiche « '+([c.firstName,c.lastName].filter(Boolean).join(' ')||c.email)+' »'+(c.updatedAt>1e12?' modifiée le '+new Date(c.updatedAt).toLocaleDateString('fr-FR'):'')).join(', ');
          const val=document.createElement('span'); val.className='ctm-v'; val.textContent=v; const src=document.createElement('span'); src.className='ctm-src'; src.textContent='de la '+from;
          lb.append(i, val, src); opts.appendChild(lb); });
        r.appendChild(opts); t.appendChild(r);
      });
      s.querySelector('.ctm-merge').onclick=()=>{
        const pick={}; CT_MERGE_FIELDS.forEach(([k])=>{ const ch=s.querySelector('input[name="ctm-'+gi+'-'+k+'"]:checked'); pick[k]=ch?ch.value:(g.map(c=>c[k]).find(v=>v&&String(v).trim())||''); });
        mergeContacts(g, pick); openContactMerge(onlyIds);
      };
      s.querySelector('.ctm-not').onclick=()=>{ g.forEach(c=>{ c.notDupOf=[...new Set((c.notDupOf||[]).concat(g.filter(x=>x!==c).map(x=>x.id)))]; touchCrm(c); }); saveCrm(); renderContacts(); openContactMerge(onlyIds); };
      body.appendChild(s);
    });
    $('ct-merge-overlay').classList.remove('hidden');
  }
  // one contact kept (the most recently updated), the others removed; opportunities and meetings follow
  function mergeContacts(group, pick){
    const keep=group[0], gone=group.slice(1), goneIds=new Set(gone.map(c=>c.id));
    const names=new Set(group.map(c=>pqFold([c.firstName,c.lastName].filter(Boolean).join(' '))));
    const mails=new Set(group.map(c=>(c.email||'').toLowerCase()).filter(Boolean));
    CT_MERGE_FIELDS.forEach(([k])=>{ keep[k]=pick[k]||''; });
    keep.relevance=Math.max(...group.map(c=>c.relevance||0)); touchCrm(keep);
    gone.forEach(c=>{ c.deleted=true; c.mergedInto=keep.id; touchCrm(c); });
    meetings.forEach(m=>{ if(goneIds.has(m.contactId)){ m.contactId=keep.id; touchCrm(m); } });
    opportunities.forEach(o=>{
      let ch=false;
      if(o.otherContactIds && o.otherContactIds.some(id=>goneIds.has(id))){ o.otherContactIds=[...new Set(o.otherContactIds.map(id=>goneIds.has(id)?keep.id:id))]; ch=true; }
      // the main contact (Pipe columns) is one of them: its name and mail follow the kept card
      const isMain=(o.mail && mails.has(o.mail.toLowerCase())) || names.has(pqFold([o.prenom,o.nom].filter(Boolean).join(' ')));
      if(isMain){ o.prenom=keep.firstName; o.nom=(keep.lastName||'').toUpperCase(); if(keep.email) o.mail=keep.email; ch=true;
        if(o.otherContactIds){ o.otherContactIds=o.otherContactIds.filter(id=>id!==keep.id); if(!o.otherContactIds.length) delete o.otherContactIds; } }
      if(ch) touchCrm(o);
    });
    saveCrm(); renderContacts(); renderPipeline();
    if(!$('opp-detail-overlay').classList.contains('hidden') && viewingOppId){ const v=opportunities.find(x=>x.id===viewingOppId); if(v) (v.kind==='request'?openRequestDetail:openOppDetail)(v.id); }   // the open sheet shows the merged card
    showBridgeMsg('Fiches fusionnées : '+[keep.firstName,keep.lastName].filter(Boolean).join(' ')+'.', true);
  }
  $('ct-merge-close').onclick=()=>$('ct-merge-overlay').classList.add('hidden');
  $('ct-merge-overlay').addEventListener('click', e=>{ if(e.target.id==='ct-merge-overlay') $('ct-merge-overlay').classList.add('hidden'); });
  const contactV=c=>({ prenom:c.firstName||'', nom:(c.lastName||'').toUpperCase(), qualite:c.role||'', tel:[c.phone1,c.phone2].filter(Boolean).join(' / '), mail:(c.email||'').toLowerCase() });
  function pqContactOptions(){
    const st=pqState, opts=[], seen=new Set();
    const keyOf=v=>(v.mail||'')+'|'+pqFold((v.prenom||'')+' '+(v.nom||''));
    (st.peopleList||[]).forEach((p,i)=>{ opts.push({ key:'p:'+i, id:p.id||null, v:p.v, label:p.label }); seen.add(keyOf(p.v)); if(p.id) seen.add('id:'+p.id); });
    const company=pqKnownCompany((st.shared.producteur||'').trim());
    contacts.filter(c=>!c.deleted && company && c.company===company).forEach(c=>{
      const v=contactV(c); if(seen.has('id:'+c.id) || seen.has(keyOf(v))) return;
      opts.push({ key:'c:'+c.id, id:c.id, v, label:[c.firstName,c.lastName].filter(Boolean).join(' ')||c.email }); seen.add(keyOf(v));
    });
    return opts;
  }
  function pqContactSwitch(){
    const st=pqState, opts=pqContactOptions(); if(opts.length<2) return '';
    const cur=st.shared, curKey=(st.mainKey && opts.some(o=>o.key===st.mainKey))?st.mainKey:(opts.find(o=>(o.v.mail && o.v.mail===(cur.mail||'').toLowerCase()) || (o.v.prenom===cur.prenom && o.v.nom===cur.nom))||{}).key||'';
    return '<label class="pq-switch">Changer de contact principal <select id="pq-contact-switch"><option value="">—</option>'+opts.map(o=>'<option value="'+escapeHtml(o.key)+'"'+(o.key===curKey?' selected':'')+'>'+escapeHtml(o.label+(o.v.qualite?' · '+o.v.qualite:''))+'</option>').join('')+'</select></label>';
  }
  function pqSwitchContact(key){
    const st=pqState, opts=pqContactOptions(), o=opts.find(x=>x.key===key); if(!o) return;
    const prevMail=(st.shared.mail||'').toLowerCase(), prevName=pqFold((st.shared.prenom||'')+' '+(st.shared.nom||''));
    const prevOpt=opts.find(x=>(prevMail && x.v.mail===prevMail) || pqFold(x.v.prenom+' '+x.v.nom)===prevName);
    ['prenom','nom','qualite','tel','mail'].forEach(k=>{ st.shared[k]=o.v[k]||''; st.touched.add('s.'+k); st.auto.delete('s.'+k); });
    st.mainKey=key;
    // everyone else involved stays linked as an other contact (new people are created at saving)
    if(st.editId){
      st.editOtherIds=(st.editOtherIds||[]).filter(id=>id!==o.id);
      if(prevOpt && prevOpt.id && prevOpt.id!==o.id && !st.editOtherIds.includes(prevOpt.id)) st.editOtherIds.push(prevOpt.id);
    } else {
      const others=(st.peopleList||[]).filter((p,i)=>'p:'+i!==key);
      st.extraContacts=others.filter(p=>!p.id).map(p=>p.v);
      st.extraContactIds=others.filter(p=>p.id).map(p=>p.id).concat(o.key.startsWith('c:')?[]:[]);
    }
    pqRender();
  }
  function pqSummary(){
    const st=pqState;
    const nAuto=[...st.auto].length;
    const todo=[];
    PQ_FIELDS.filter(f=>f.req).forEach(f=>{
      if(f.sec==='centrale'){ st.installs.forEach((inst,i)=>{ if(pqIsEmpty(f,String(i))) todo.push(f.label+(st.installs.length>1?' '+(i+1):'')); }); }
      else if(pqIsEmpty(f,'s')) todo.push(f.k==='tel'||f.k==='mail'?'Tel ou Mail':f.label);
    });
    const uniq=[...new Set(todo)];
    $('pq-summary').innerHTML=(nAuto?'<span class="pq-ok">'+nAuto+' champ'+(nAuto>1?'s':'')+' rempli'+(nAuto>1?'s':'')+' automatiquement</span>':'<span class="pq-muted">'+(st.editId?'Colle un mail ou dépose un fichier à gauche pour compléter les champs vides':'Collez un mail ou déposez un fichier pour pré-remplir')+'</span>')
      +(uniq.length?'<span class="pq-todo">À compléter : '+escapeHtml(uniq.join(', '))+'</span>':'<span class="pq-ok">Champs obligatoires remplis</span>');
  }
  // the plant of a workbook that is the installation being edited: name, SPV, power, postal code, département
  function pqPlantScore(cur, p){
    const n=v=>parcNorm(v||''), near=(a,b)=>{ const x=pqNum(String(a||'')), y=pqNum(String(b||'')); return x>0 && y>0 && Math.abs(x-y)/Math.max(x,y)<0.02; };
    {
      let s=0;
      if(n(cur.centrale) && n(p.centrale) && (n(cur.centrale)===n(p.centrale) || n(cur.centrale).includes(n(p.centrale)) || n(p.centrale).includes(n(cur.centrale)))) s+=5;
      if(n(cur.spv) && n(cur.spv)===n(p.spv)) s+=4;
      if(near(cur.kwc, p.kwc)) s+=3;
      if(cur.cp && cur.cp===p.cp) s+=2;
      if(cur.dept && cur.dept===p.dept && s>0) s+=1;   // the département alone does not tell two plants apart
      return s;
    }
  }
  function pqApply(parsed, xlsInstalls){
    const st=pqState; if(!st) return;
    // drop previous automatic values the user did not edit, then apply the new ones
    [...st.auto].forEach(key=>{ if(st.touched.has(key)) return; const [s,k]=key.split('.'); if(s==='s') st.shared[k]=pqDefaults()[k]; else if(st.installs[+s]) delete st.installs[+s][k]; });
    st.auto=new Set();
    Object.keys(parsed).forEach(k=>{
      const v=parsed[k]; if(v==null||v==='') return;
      if(PQ_CENTRALE_KEYS.includes(k)){ if(!st.touched.has('0.'+k)){ st.installs[0][k]=v; st.auto.add('0.'+k); } }
      else if(!st.touched.has('s.'+k)){ st.shared[k]=v; st.auto.add('s.'+k); }
    });
    if(st.editId){
      // a new reading replaces the installations it had added (kept: the ones of the pipeline)
      const keep=[]; st.installs.forEach((x,i)=>{ if(!x._fromFile) keep.push(i); });
      if(keep.length!==st.installs.length){
        const remap=k=>{ const [s,f]=k.split('.'); if(s==='s') return k; const j=keep.indexOf(+s); return j<0?null:j+'.'+f; };
        st.installs=keep.map(i=>st.installs[i]);
        st.touched=new Set([...st.touched].map(remap).filter(Boolean)); st.auto=new Set([...st.auto].map(remap).filter(Boolean));
      }
    }
    if(xlsInstalls && xlsInstalls.length && st.editId){
      // each plant of the file completes the installation it matches (name, SPV, power, postal code, département);
      // the installation being edited takes the best remaining one; the others are added as new installations
      const taken=new Set(), owner=new Map();
      xlsInstalls.forEach((p,pi)=>{
        let best=-1, top=0;
        st.installs.forEach((cur,ci)=>{ if(owner.has(ci)) return; const s=pqPlantScore(cur,p); if(s>top){ top=s; best=ci; } });
        if(best>=0){ owner.set(best,pi); taken.add(pi); }
      });
      if(!owner.has(0)){ const pi=xlsInstalls.findIndex((_,i)=>!taken.has(i)); if(pi>=0){ owner.set(0,pi); taken.add(pi); } }
      owner.forEach((pi,ci)=>{
        const cur=st.installs[ci], x=xlsInstalls[pi];
        if(x.caract) cur.caract=Object.assign({}, cur.caract||{}, x.caract);
        Object.keys(x).forEach(k=>{ if(k==='caract') return; const has=cur[k]!=null && String(cur[k]).trim()!==''; if(!st.touched.has(ci+'.'+k) && x[k] && !has){ cur[k]=x[k]; st.auto.add(ci+'.'+k); } });
      });
      xlsInstalls.forEach((x,pi)=>{
        if(taken.has(pi)) return;
        const base=st.installs[0], i=st.installs.length;
        st.installs.push(Object.assign({ install:base.install, contrat:base.contrat }, x, { _fromFile:true }));
        Object.keys(x).forEach(k=>st.auto.add(i+'.'+k));
      });
    } else if(xlsInstalls && xlsInstalls.length){
      const base=Object.assign({}, st.installs[0]);
      st.installs=xlsInstalls.map((x,i)=>{
        const inst=Object.assign({}, i===0?base:{install:base.install, contrat:base.contrat, dept:base.dept, region:base.region}, x);
        Object.keys(x).forEach(k=>st.auto.add(i+'.'+k));
        return inst;
      });
    }
    if(st.shared.dateEntree) st.shared.annee=st.shared.dateEntree.slice(0,4);
    pqRender();
  }
  let pqParseTimer=null, pqLastFiles=null;
  // Copying a mail from Outlook's message list gives only its summary line ("De  Objet  Reçu  Taille…"), not its content
  const PQ_OUTLOOK_LIST=/^\s*(de|from)\s*\t\s*(objet|subject)\s*\t/im;
  function pqReparse(){
    const files=pqLastFiles||{text:'',installs:[]}, pasted=$('pq-mail').value;
    const listOnly=PQ_OUTLOOK_LIST.test(pasted) && pasted.split('\n').filter(l=>l.trim()).length<=4;
    $('pq-mail-warning').hidden=!listOnly;
    const text=[pasted, files.text].filter(Boolean).join('\n\n');
    pqState.hints=pqPlantHints(text);
    const parsed=parsePipeMail(text), installs=files.installs.length?files.installs:parseMailInstallations(text);
    pqState.detected=pqDetectPeople(text).map(p=>({ v:p, on:p.sender }));
    pqApply(parsed, installs);
    pqDetectBox(parsed, installs);
  }
  // « Ce que j'ai trouvé » : producer, plants and people of the documents; each person can be linked or not, and made
  // the main contact. Known contacts are recognised (same mail, or same name in the same company).
  function pqKnownPerson(v){
    const mail=(v.mail||'').toLowerCase();
    return contacts.find(c=>!c.deleted && ((mail && (c.email||'').toLowerCase()===mail) || (v.prenom && v.nom && pqFold(c.firstName)===pqFold(v.prenom) && pqFold(c.lastName)===pqFold(v.nom))))||null;
  }
  const pqIsMain=v=>{ const s=pqState.shared, m=(s.mail||'').toLowerCase(); return (m && m===(v.mail||'').toLowerCase()) || (v.prenom && pqFold(v.prenom+' '+v.nom)===pqFold((s.prenom||'')+' '+(s.nom||''))); };
  function pqDetectBox(parsed, installs){
    const box=$('pq-detect'); if(!box) return;
    const st=pqState, people=st.detected||[];
    if(!people.length && !(installs&&installs.length) && !parsed.producteur){ box.hidden=true; box.innerHTML=''; return; }
    box.hidden=false;
    const plants=(installs&&installs.length)?installs:((parsed.kwc||parsed.centrale)?[{ centrale:parsed.centrale, kwc:parsed.kwc }]:[]);   // one plant described in the mail itself
    let html='<div class="pq-detect-h">Ce que j\u2019ai trouvé</div><ul class="pq-detect-sum">';
    if(parsed.producteur) html+='<li><b>Producteur</b> '+escapeHtml(parsed.producteur)+'</li>';
    html+='<li><b>'+plants.length+' installation'+(plants.length>1?'s':'')+'</b>'+(plants.length?' : '+plants.map(p=>escapeHtml([p.centrale||'(sans nom)', p.kwc?fmtKwc(p.kwc):''].filter(Boolean).join(' '))).join(' · '):'')+'</li>';
    html+=people.length?'<li><b>'+people.length+' contact'+(people.length>1?'s':'')+'</b> — coche ceux à lier, ★ = contact principal</li></ul>':'<li>Aucun contact dans le document</li></ul>';
    box.innerHTML=html;
    if(people.length){
      const list=document.createElement('div'); list.className='pq-detect-people';
      people.forEach((d,i)=>{
        const known=pqKnownPerson(d.v), main=pqIsMain(d.v);
        const r=document.createElement('div'); r.className='pq-person'+(main?' main':'');
        r.innerHTML='<input type="checkbox" id="pq-det-'+i+'"'+(d.on||main?' checked':'')+(main?' disabled':'')+'><label for="pq-det-'+i+'"><b></b><span></span></label><button type="button" class="pq-star" title="En faire le contact principal" aria-label="En faire le contact principal">★</button><em></em>';
        r.querySelector('b').textContent=[d.v.prenom,d.v.nom].filter(Boolean).join(' ')||d.v.mail;
        r.querySelector('label span').textContent=[d.v.qualite, d.v.tel, d.v.mail].filter(Boolean).join(' · ');
        r.querySelector('em').textContent=main?'principal':known?'déjà dans tes contacts':'nouveau';
        r.querySelector('input').onchange=e=>{ d.on=e.target.checked; };
        r.querySelector('.pq-star').onclick=()=>{ pqMakeMain(d.v); d.on=true; pqDetectBox(parsed, installs); };
        list.appendChild(r);
      });
      box.appendChild(list);
    }
  }
  // the chosen person becomes the main contact of the form; the previous one stays linked as another contact
  function pqMakeMain(v){
    const st=pqState, s=st.shared;
    const prev={ prenom:s.prenom||'', nom:s.nom||'', qualite:s.qualite||'', tel:s.tel||'', mail:(s.mail||'').toLowerCase() };
    if((prev.prenom||prev.nom||prev.mail) && !(st.detected||[]).some(d=>pqIsMain(d.v) && (d.v.mail===prev.mail || pqFold(d.v.prenom+d.v.nom)===pqFold(prev.prenom+prev.nom)))) (st.detected=st.detected||[]).push({ v:prev, on:true });
    else (st.detected||[]).forEach(d=>{ if(pqIsMain(d.v)) d.on=true; });
    const tel=[v.tel,v.tel2].filter(Boolean).join(' / ');
    [['prenom',v.prenom],['nom',v.nom],['qualite',v.qualite],['tel',tel],['mail',v.mail]].forEach(([k,x])=>{ s[k]=x||''; st.touched.add('s.'+k); st.auto.delete('s.'+k); });
    pqRender();
  }
  // at saving: the ticked people (except the main contact) are created if new and linked to the opportunity
  function pqDetectedIds(company){
    return (pqState.detected||[]).filter(d=>d.on && !pqIsMain(d.v)).map(d=>{ const v=Object.assign({}, d.v, { tel:[d.v.tel,d.v.tel2].filter(Boolean).join(' / ') }); const c=ensureContact(v, company); return c&&c.id; }).filter(Boolean);
  }
  async function pqHandleFiles(fileList){
    const files=[...fileList]; if(!files.length) return;
    $('pq-files-info').textContent='Lecture…';
    try{
      pqLastFiles=await readPipeFiles(files);
      const n=pqLastFiles.installs.length;
      $('pq-files-info').textContent=pqLastFiles.names.join(', ')+(n?' — '+n+' installation'+(n>1?'s':'')+' trouvée'+(n>1?'s':'')+' dans l\u2019Excel':'');
      pqReparse();
    }catch(e){ console.error(e); $('pq-files-info').textContent='Fichier illisible : '+(e.message||e); }
  }
  // Typing only updates the state; a full re-render (region from département, MWh estimate, Oui/Non) waits for `change`.
  function pqOnInput(e){
    const el=e.target, k=el.dataset.k, s=el.dataset.s; if(!k||!pqState) return;
    const v=el.type==='checkbox'?el.checked:el.value;
    if(s==='s') pqState.shared[k]=v; else if(pqState.installs[+s]) pqState.installs[+s][k]=v;
    const key=s+'.'+k; pqState.touched.add(key); pqState.auto.delete(key); if(pqState.derived) pqState.derived.delete(key);
    if(k==='dateEntree' && v) pqState.shared.annee=String(v).slice(0,4);
    if(k==='charge'){ try{ localStorage.setItem('qualif-charge', v); }catch(err){} }
    const w=el.closest('.pq-f'); if(w){ w.classList.remove('auto'); if(v!=='' ) w.classList.remove('empty'); }
    pqSummary();
  }
  function pqOnChange(e){
    const el=e.target, k=el.dataset.k, s=el.dataset.s; if(!k||!pqState) return;
    if(k==='dept'){ const d=PQ_DEPTS.find(x=>pqDeptLabel(x)===el.value); const src=s==='s'?pqState.shared:pqState.installs[+s]; if(d && src && !pqState.touched.has(s+'.region')) src.region=PQ_REGIONS[d[2]]; }
    if(s!=='s' && ['debut','fin','duree'].includes(k)){ pqLinkDates(+s, k); pqRerenderKeepFocus(); return; }
    if(s!=='s' && ['mesPrev','mesEff'].includes(k)){ pqRerenderKeepFocus(); return; }   // « À la MES » follows the new date
    if(s!=='s' && k==='cp' && /^\d{5}$/.test(el.value.trim())){ const inst=pqState.installs[+s], d=pqDeptFromPostal(el.value.trim());
      if(d && inst && !inst.dept){ inst.dept=pqDeptLabel(d); pqState.auto.add(s+'.dept'); if(!pqState.touched.has(s+'.region')){ inst.region=PQ_REGIONS[d[2]]; pqState.auto.add(s+'.region'); } } pqRerenderKeepFocus(); return; }
    if(el.type==='checkbox'||el.tagName==='SELECT'||['dept','kwc','mwh','productible','tel','mail'].includes(k)) pqRerenderKeepFocus();
  }
  function pqRerenderKeepFocus(){
    const active=document.activeElement, id=active&&active.id, pos=active&&active.selectionStart;
    const scroller=$('pq-form'), top=scroller.scrollTop;
    pqRender(); scroller.scrollTop=top;
    const again=id&&$(id); if(again && again!==document.activeElement){ again.focus({preventScroll:true}); if(pos!=null && again.setSelectionRange) try{ again.setSelectionRange(pos,pos); }catch(err){} }
  }
  function saveOpp(){
    const st=pqState; if(!st) return;
    const v=st.shared;
    const producteur=(v.producteur||'').trim();
    if(!producteur){ $('pq-summary').innerHTML='<span class="pq-todo">Indique au moins le nom du producteur.</span>'; const el=$('pq-s-producteur'); if(el) el.focus(); return; }
    const cc=pqCountCheck();
    if(cc.need && st.countConfirmed!==cc.n){
      $('pq-summary').innerHTML='<span class="pq-todo">Vérifie le nombre d\u2019installations, puis coche « J\u2019ai vérifié » avant d\u2019enregistrer.</span>';
      const box=$('pq-count-box'); if(box){ box.scrollIntoView({ block:'center', behavior:'smooth' }); box.classList.add('pulse'); setTimeout(()=>box.classList.remove('pulse'),900); }
      return;
    }
    st.installs.forEach((inst,i)=>{ if(!(inst.centrale||'').trim()) inst.centrale=st.installs.length>1?producteur+' '+(i+1):producteur; });
    if(st.editId){
      const o=opportunities.find(x=>x.id===st.editId); if(!o){ closeOppForm(); return; }
      const namesBefore=new Map(opportunities.filter(x=>!x.deleted && (x.id===o.id || (o.requestId && x.requestId===o.requestId))).map(x=>[x.id, oppName(x)]));   // renamed installations: their [[links]] follow
      const company=ensureCompany(producteur);
      PQ_SHARED_KEYS.forEach(k=>{ o[k]=v[k]; }); PQ_CENTRALE_KEYS.forEach(k=>{ o[k]=st.installs[0][k]; }); if(st.installs[0].caract) o.caract=st.installs[0].caract;
      o.company=company; o.title=o.centrale; touchCrm(o);
      // producer and contact columns are shared by the installations of a request
      if(o.requestId) requestInstalls(o.requestId).forEach(x=>{ if(x.id===o.id) return; PQ_SHARED_KEYS.filter(k=>!['action','relance','commentaires','rdv1','rdv2','cr1','cr2','dateOffre','nature','qualification'].includes(k)).forEach(k=>{ x[k]=v[k]; }); x.company=company; touchCrm(x); });
      const mc=ensureContact(v, company);
      const detIds=pqDetectedIds(company).filter(id=>!mc || id!==mc.id);
      if(detIds.length){ st.editOtherIds=[...new Set((st.editOtherIds||o.otherContactIds||[]).concat(detIds))]; }
      // the other installations of the form: those of the pipeline are updated, the new ones created in the same request
      const more=st.installs.slice(1);
      if(more.length && !o.requestId){ const reqId=newOppId('req'); opportunities.push({ id:reqId, kind:'request', company, title:'Demande de pricing', createdAt:Date.now(), updatedAt:Date.now(), deleted:false }); o.requestId=reqId; touchCrm(o); }
      more.forEach((inst,i)=>{
        let x=inst._oppId?opportunities.find(y=>y.id===inst._oppId):null;
        if(!x){
          x={ id:newOppId('opp'), kind:'installation', company, stage:o.stage, requestId:o.requestId, taskId:null, createdAt:Date.now(), updatedAt:Date.now(), deleted:false, lostAt:null };
          PQ_SHARED_KEYS.forEach(k=>{ if(v[k]!==undefined) x[k]=v[k]; });
          if(o.goDate) x.goDate=o.goDate;
          if(o.otherContactIds) x.otherContactIds=o.otherContactIds.slice();
          opportunities.push(x);
        }
        PQ_CENTRALE_KEYS.forEach(k=>{ if(inst[k]!==undefined) x[k]=inst[k]; }); if(inst.caract) x.caract=inst.caract;
        if(!(x.centrale||'').trim()) x.centrale=producteur+' '+(i+2);
        x.title=x.centrale; touchCrm(x);
      });
      if(st.editOtherIds){ o.otherContactIds=[...new Set(st.editOtherIds.filter(id=>!mc || id!==mc.id))]; if(!o.otherContactIds.length) delete o.otherContactIds; touchCrm(o); }
      namesBefore.forEach((nm,id)=>{ const x=opportunities.find(y=>y.id===id); if(x && oppName(x)!==nm) rewriteLinks(nm, oppName(x)); });
      saveCrm(); closeOppForm(); renderPipeline(); render();
      openOppDetail(o.id);
      return;
    }
    const company=ensureCompany(producteur);
    const mainContact=ensureContact(v, company);
    // other contacts: new ones are created in Contacts, existing ones linked
    const otherIds=(st.extraContactIds||[]).concat((st.extraContacts||[]).map(x=>{ const c=ensureContact(x, company); return c&&c.id; }).filter(Boolean)).concat(pqDetectedIds(company)).filter(id=>!mainContact || id!==mainContact.id);
    const startStage=$('pq-start-stage').value||'a_qualifier';
    let reqId=null;
    if(st.installs.length>1){
      reqId=newOppId('req');
      opportunities.push({ id:reqId, kind:'request', company, title:'Demande de pricing', createdAt:Date.now(), updatedAt:Date.now(), deleted:false });
    }
    const created=st.installs.map(inst=>{
      const o={ id:newOppId('opp'), kind:'installation', company, title:inst.centrale, stage:startStage, requestId:reqId, taskId:null, createdAt:Date.now(), updatedAt:Date.now(), deleted:false, lostAt:null };
      PQ_SHARED_KEYS.forEach(k=>{ if(v[k]!==undefined) o[k]=v[k]; });
      PQ_CENTRALE_KEYS.forEach(k=>{ if(inst[k]!==undefined) o[k]=inst[k]; }); if(inst.caract) o.caract=inst.caract;
      if(stageIndex(startStage)>=stageIndex('demande_prix')) o.goDate=toISO(new Date());
      if(otherIds.length) o.otherContactIds=[...new Set(otherIds)];
      opportunities.push(o);
      return o;
    });
    if(st.prequalId){ const p=opportunities.find(x=>x.id===st.prequalId); if(p){ p.stage='converti'; touchCrm(p); } }
    if($('pq-create-task').checked){
      // one task for the whole group: it is linked to the request when there is one
      const target=reqId?opportunities.find(x=>x.id===reqId):created[0];
      const s=oppStage(startStage);
      const who=[v.prenom, (v.nom||'').replace(/^(M\.|Mme)\s+/i,'')].filter(Boolean).join(' ');
      const title=(startStage==='a_qualifier'?'Appeler '+(who||producteur):s.task)+' — '+(reqId?created.length+' installations':oppName(created[0]));
      const other=s.who && s.who!=='Com';
      const task=createTask({ title, client:company, due:v.relance||'', urgency:'moyenne', status:other?'en_attente':'a_faire' });
      task.opportunityId=target.id; task.stageLabel=s.label; touch(task); saveTasks();
      target.taskId=task.id;
    }
    created.forEach(touchCrm);
    saveCrm(); closeOppForm(); renderPipeline(); render();
  }

  // ----- Pré-qualif (a client met, no project yet) -----
  function openPrequalForm(){
    $('prequal-company').value=''; $('prequal-note').value=''; $('prequal-due').value=pqAddDays(14);
    $('prequal-overlay').classList.remove('hidden'); $('prequal-company').focus();
  }
  function closePrequalForm(){ $('prequal-overlay').classList.add('hidden'); }
  function savePrequal(){
    const name=$('prequal-company').value.trim(); if(!name){ $('prequal-company').focus(); return; }
    const company=ensureCompany(name);
    const note=$('prequal-note').value.trim();
    const o={ id:newOppId('pq'), kind:'prequal', company, title:note||'Rencontre', stage:'prequal', note, metAt:toISO(new Date()), createdAt:Date.now(), updatedAt:Date.now(), deleted:false };
    opportunities.push(o);
    const due=$('prequal-due').value;
    if(due){ const t=createTask({ title:'Relancer '+company+' (pré-qualif)', client:company, due, urgency:'basse', status:'a_faire', description:note }); t.opportunityId=o.id; t.stageLabel='Pré-qualif'; touch(t); saveTasks(); o.taskId=t.id; }
    saveCrm(); closePrequalForm(); renderPipeline(); render();
  }

  // ----- Detail (installation, pre-qualif) -----
  let viewingOppId=null;
  function oppActionBtn(label, fn, cls){ const b=document.createElement('button'); b.type='button'; b.textContent=label; if(cls) b.className=cls; b.onclick=fn; return b; }
  function openOppDetail(id){
    const o=opportunities.find(x=>x.id===id); if(!o) return;
    if(o.kind==='request'){ openRequestDetail(id); return; }
    viewingOppId=id;
    const box=$('opp-detail-body'); box.innerHTML='';
    $('opp-detail-title').textContent=o.kind==='prequal'?o.company+' — pré-qualif':o.company+' — '+oppName(o);
    $('opp-detail-sum').textContent=o.kind==='prequal'?'':oppSummary(o.requestId?requestInstalls(o.requestId).filter(x=>!isExited(x)):[o]);
    { const sb=suiviBadge(o, true); if(sb){ const line=document.createElement('div'); line.className='suivi-line'; line.appendChild(sb); const t=document.createElement('span'); t.textContent=sb.title; line.appendChild(t); box.appendChild(line); } }
    if(o.company || o.requestId){
      const nav=document.createElement('div'); nav.className='opp-nav';
      if(o.requestId && o.kind==='installation'){ const req=opportunities.find(x=>x.id===o.requestId), n=requestInstalls(o.requestId).length;
        const r=document.createElement('button'); r.type='button'; r.className='opp-co-link opp-back'; r.textContent='← '+((req&&req.title)||'Demande de pricing')+' ('+n+' installation'+(n>1?'s':'')+')'; r.onclick=()=>openRequestDetail(o.requestId); nav.appendChild(r); }
      if(o.company){ const l=document.createElement('button'); l.type='button'; l.className='opp-co-link'; l.textContent='Fiche '+o.company+' →'; l.onclick=()=>{ closeOppDetail(); openCompanySheet(o.company); }; nav.appendChild(l); }
      box.appendChild(nav);
    }
    const actions=$('opp-detail-actions'); actions.innerHTML='';
    // « Modifier la fiche » at the top right of the sheet, for an installation
    const edit=$('opp-detail-edit'); edit.hidden=o.kind!=='installation'; edit.textContent='Modifier la fiche'; edit.onclick=()=>{ closeOppDetail(); openOppForm({ editId:o.id }); };
    if(o.kind==='prequal'){
      const p=document.createElement('p'); p.className='modal-hint'; p.textContent=(o.metAt?'Rencontré le '+pqIsoToFr(o.metAt)+'. ':'')+(o.note||'Pas de note.');
      box.appendChild(p);
      actions.appendChild(oppActionBtn('Projet identifié → créer l\u2019installation', ()=>{ closeOppDetail(); openOppForm({ company:o.company, prequalId:o.id }); }));
      actions.appendChild(oppActionBtn('Sans suite', ()=>{ o.stage='abandonne'; o.lostAt=Date.now(); touchCrm(o); saveCrm(); closeOppDetail(); renderPipeline(); }, 'ghost-btn'));
    } else {
      const s=oppStage(o.stage);
      const head=document.createElement('div'); head.className='opp-sheet-head';
      head.appendChild(stageChip(o));
      const meta=document.createElement('span'); meta.className='opp-sheet-meta';
      meta.textContent=[o.install, o.contrat].filter(Boolean).join(' · ');   // the figures are in the sheet just below
      head.appendChild(meta);
      const siblings=o.requestId?requestInstalls(o.requestId):[];
      if(siblings.length>1) box.appendChild(buildRequestTabs(siblings, o.id));
      box.appendChild(head);
      box.appendChild(buildInstallSheet(o));
      if(siblings.length>1) box.appendChild(buildRequestCompare(siblings, o.id));
      // installations of one request usually move together: the stage applies to all of them, or to this one only
      const batch=o.requestId?requestInstalls(o.requestId).filter(x=>!isExited(x)):[];
      const many=batch.length>1 && !isExited(o);
      if(many){
        const sc=document.createElement('div'); sc.className='stage-scope'; sc.setAttribute('role','group'); sc.setAttribute('aria-label','Changer l\u2019étape de');
        sc.innerHTML='<span>Changer l\u2019étape de</span>';
        [[true,'Toutes les installations ('+batch.length+')'],[false,'Seulement celle-ci']].forEach(([v,l])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=l; b.className=stageScopeAll===v?'on':''; b.setAttribute('aria-pressed', String(stageScopeAll===v)); b.onclick=()=>{ stageScopeAll=v; openOppDetail(o.id); }; sc.appendChild(b); });
        box.appendChild(sc);
      }
      box.appendChild(buildStageTrack(many&&stageScopeAll?batch:[o], key=>{
        const targets=many&&stageScopeAll?batch:[o];
        targets.forEach(x=>{ if(x.stage!==key) setOppStage(x, key); });
        openOppDetail(o.id);
      }));
      const cur=stageIndex(o.stage);
      if(o.stage==='onboarding'){
        const ob=document.createElement('div'); ob.className='opp-onb';
        const h=document.createElement('div'); h.className='opp-phase-h'; h.textContent='Onboarding'; ob.appendChild(h);
        ONBOARDING_STEPS.forEach(stp=>{
          const lab=document.createElement('label');
          const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!o['onb_'+stp.k];
          cb.onchange=()=>{ o['onb_'+stp.k]=cb.checked; touchCrm(o); saveCrm(); };
          lab.appendChild(cb); lab.appendChild(document.createTextNode(' '+stp.label+' '));
          const w=document.createElement('span'); w.className='pipe-who'; w.textContent=stp.who; lab.appendChild(w);
          ob.appendChild(lab);
        });
        box.appendChild(ob);
      }
      if(isExited(o)){
        actions.appendChild(oppActionBtn('Réactiver', ()=>{ o.stage=o.stageBeforeExit||'a_qualifier'; o.lostAt=null; touchCrm(o); saveCrm(); renderPipeline(); openOppDetail(o.id); }));
      } else {
        if(o.stage==='qualif_en_cours'){
          actions.appendChild(oppActionBtn('Go', ()=>{ closeOppDetail(); offerStageAdvance([o], 'demande_prix'); }));
          actions.appendChild(oppActionBtn('No Go', ()=>exitOpp(o,'no_go'), 'ghost-btn'));
        } else if(o.stage==='offre_attente'){
          actions.appendChild(oppActionBtn('Offre acceptée', ()=>{ closeOppDetail(); offerStageAdvance([o], 'kyc'); }));
          actions.appendChild(oppActionBtn('Offre refusée', ()=>loseOpps([o]), 'ghost-btn'));
        } else if(cur>=0 && cur<OPP_STAGES.length-1){
          actions.appendChild(oppActionBtn('Étape suivante', ()=>{ closeOppDetail(); offerStageAdvance([o]); }));
        }
      }
      excelButtons(actions, [o]);
      actions.appendChild(oppActionBtn('Fichier caractéristiques (.xlsx)', e=>downloadCaract(o.requestId?requestInstalls(o.requestId).filter(x=>!isExited(x)):[o], e.target), 'ghost-btn'));
      actions.appendChild(oppActionBtn('Copier ligne Pipe', e=>copyPipeLines(o.requestId?requestInstalls(o.requestId).filter(x=>!isExited(x)):[o], e.target), 'ghost-btn'));
      if(o.goDate || stageIndex(o.stage)>=stageIndex('demande_prix')) actions.appendChild(oppActionBtn('Copier ligne BDD', e=>copyToClipboard(bddRow(o), e.target), 'ghost-btn'));
      if(!o.requestId && !isExited(o)) actions.appendChild(oppActionBtn('Demande de pricing', ()=>{
        const reqId=newOppId('req');
        opportunities.push({ id:reqId, kind:'request', company:o.company, title:'Demande de pricing', createdAt:Date.now(), updatedAt:Date.now(), deleted:false });
        o.requestId=reqId; touchCrm(o); saveCrm(); renderPipeline(); openRequestDetail(reqId);
      }, 'ghost-btn'));
      if(!isExited(o)){
        if(stageIndex(o.stage)>=stageIndex('demande_prix') && o.stage!=='offre_attente'){ actions.appendChild(oppActionBtn('Perdu', ()=>loseOpps([o]), 'ghost-btn danger-btn')); }
        actions.appendChild(oppActionBtn('Abandonner', ()=>exitOpp(o,'abandonne'), 'ghost-btn danger-btn'));
      }
    }
    actions.appendChild(oppActionBtn('Voir dans le réseau', ()=>{ closeOppDetail(); openInNetwork('op:'+o.id); }, 'ghost-btn opp-net-btn lite-keep'));
    { const mb=mentionsBlock('op:'+o.id); if(mb) $('opp-detail-body').appendChild(mb); }
    actions.appendChild(oppActionBtn('Supprimer', ()=>{ if(!confirm('Supprimer cette fiche du pipeline ?')) return; o.deleted=true; touchCrm(o); saveCrm(); closeOppDetail(); renderPipeline(); }, 'ghost-btn danger-btn'));
    actions.appendChild(oppActionBtn('Fermer', closeOppDetail, 'ghost-btn lite-keep'));
    $('opp-detail-overlay').classList.remove('hidden');
  }
  function closeOppDetail(){ $('opp-detail-overlay').classList.add('hidden'); viewingOppId=null; }
  // Installation sheet: every column of the Pipe / BDD, grouped; empty values shown as "—" so gaps are visible.
  // ---------- Installations of one pricing request: tabs to go from one to the other, and a table to check them side by side ----------
  const pqFieldLabel=k=>{ const f=PQ_FIELDS.find(x=>x.k===k)||PQ_EXTRA_FIELDS.find(x=>x.k===k); return f?f.label:k; };
  // short description of an installation for its line: power · volume · commissioning · technology
  function instLineInfo(x){
    const mwh=x.mwh?Number(pqNum(String(x.mwh))).toLocaleString('fr-FR')+' MWh':'';
    return [fmtKwc(x.kwc), mwh, x.mesPrev||x.mesEff?'MES '+(x.mesEff||x.mesPrev):'', x.install].filter(Boolean).join(' · ');   // no address: power, volume, commissioning, technology
  }
  function buildRequestTabs(list, currentId){
    const t=document.createElement('div'); t.className='req-tabs'; t.setAttribute('role','tablist');
    list.forEach((x,i)=>{
      const b=document.createElement('button'); b.type='button'; b.className='req-tab'+(x.id===currentId?' on':''); b.setAttribute('role','tab'); b.setAttribute('aria-selected', String(x.id===currentId));
      b.innerHTML='<span class="n"></span><b></b><span class="k"></span>';
      b.querySelector('.n').textContent='Installation '+(i+1); b.querySelector('b').textContent=oppName(x); b.querySelector('.k').textContent=instLineInfo(x);
      b.onclick=()=>{ if(x.id!==currentId) openOppDetail(x.id); };
      t.appendChild(b);
    });
    return t;
  }
  // The installations side by side, in the order of the « Caractéristiques Centrales » file, by folding sub-sections;
  // every cell can be corrected here (an app field when there is one, else the line of the producer's file).
  const caractSections=()=>[['Identification',CARACT_ROWS.slice(0,3)], ['Localisation',CARACT_ROWS.slice(3,9)], ['Projet et raccordement',CARACT_ROWS.slice(9,21)],
    ['Production',CARACT_ROWS.slice(21,24)]].concat([1,2,3,4].map(n=>['Champ '+n, CARACT_ROWS.slice(24+(n-1)*6, 24+n*6)]));
  const REQ_APP_ROWS=['install','contrat','debut','fin','duree','particularites'];
  const CARACT_FIELD={ nominstallation:'centrale', nomspv:'spv', siretspv:'siret', commune:'commune', puissanceinstalleekwc:'kwc', p50annuelindicatifmwhan:'mwh', p90annuelindicatifmwhan:'p90', productiblep50kwhkwcan:'productible' };
  const REQ_NEEDED=new Set(['nominstallation','departement','commune','datedemiseenserviceeffectiveouprevisionnelle','puissanceinstalleekwc','p50annuelindicatifmwhan']);
  function caractSet(o, label, v){
    const k=caractKey(label);
    if(CARACT_FIELD[k]) o[CARACT_FIELD[k]]=v;
    else if(k==='departement'){ const d=v?pqDeptFromText(v):null; o.dept=d?pqDeptLabel(d):v; if(d) o.region=PQ_REGIONS[d[2]]; }
    else if(k===caractKey('Date de mise en service (effective ou prévisionnelle)')){ if(o.mesEff) o.mesEff=v; else o.mesPrev=v; }
    else {
      const raw=Object.assign({}, o.caract||{}), hit=Object.keys(raw).find(l=>caractKey(l)===k);
      if(v==='') { if(hit!==undefined) delete raw[hit]; } else raw[hit!==undefined?hit:label]=v;
      o.caract=raw;
    }
  }
  function reqSecOpen(name, def){ try{ const v=localStorage.getItem('req-sec-'+name); return v===null?def:v==='1'; }catch(e){ return def; } }
  function buildRequestCompare(list, currentId){
    // folds away with a click on its title; open or closed is remembered on this device
    const wrap=document.createElement('details'); wrap.className='req-compare';
    let open=true; try{ open=localStorage.getItem('req-compare-open')!=='0'; }catch(e){}
    wrap.open=open;
    wrap.addEventListener('toggle', ()=>{ try{ localStorage.setItem('req-compare-open', wrap.open?'1':'0'); }catch(e){} });
    const missing=list.reduce((s,x)=>s+CARACT_ROWS.filter(l=>REQ_NEEDED.has(caractKey(l)) && caractValue(x,l)==='').length,0);
    wrap.innerHTML='<summary class="opp-phase-h req-compare-h">Les '+list.length+' installations côte à côte'+(missing?' <span class="req-miss">'+missing+' case'+(missing>1?'s':'')+' à compléter</span>':'')+'<span class="req-hint">cliquer dans une case pour la modifier</span></summary>';
    const sc=document.createElement('div'); sc.className='req-compare-scroll';
    const cell=(x,v,attrs,need)=>'<td class="'+(x.id===currentId?'cur ':'')+(v===''?(need?'empty':'none'):'')+'"><input class="req-in" '+attrs+' value="'+escapeHtml(String(v))+'" placeholder="'+(need?'à compléter':'—')+'" aria-label="'+escapeHtml(oppName(x))+'"></td>';
    let t='<table class="req-table"><thead><tr><th class="req-lab">Caractéristiques centrales</th>'+list.map((x,i)=>'<th class="'+(x.id===currentId?'cur':'')+'"><button type="button" class="req-col" data-id="'+escapeHtml(x.id)+'" title="Ouvrir la fiche">'+(i+1)+' · '+escapeHtml(oppName(x))+'</button></th>').join('')+'</tr></thead>';
    const section=(name, rows, def)=>{
      const filled=rows.some(r=>r.some(Boolean)), isOpen=reqSecOpen(name, def===undefined?filled:def);
      t+='<tbody class="req-sec'+(isOpen?'':' folded')+'" data-sec="'+escapeHtml(name)+'"><tr class="req-sub"><th colspan="'+(list.length+1)+'"><button type="button" class="req-sec-h" aria-expanded="'+isOpen+'">'+escapeHtml(name)+(filled?'':' <span>vide</span>')+'</button></th></tr>';
    };
    caractSections().forEach(([name, labels])=>{
      const vals=labels.map(l=>list.map(x=>caractValue(x,l)));
      section(name, vals.map(r=>r.map(v=>v!=='')), name.startsWith('Champ')?undefined:true);
      labels.forEach((l,li)=>{ const need=REQ_NEEDED.has(caractKey(l));
        t+='<tr><th scope="row" class="req-lab">'+escapeHtml(l)+'</th>'+list.map((x,xi)=>cell(x, vals[li][xi], 'data-id="'+escapeHtml(x.id)+'" data-l="'+escapeHtml(l)+'"', need)).join('')+'</tr>'; });
      t+='</tbody>';
    });
    // what the app adds for the contract (not in the producer's file)
    const fr=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?pqIsoToFr(v):(v||'');
    section('Contrat', [REQ_APP_ROWS.map(k=>list.some(x=>x[k]))], true);
    REQ_APP_ROWS.forEach(k=>{
      t+='<tr><th scope="row" class="req-lab">'+escapeHtml(pqFieldLabel(k))+'</th>'+list.map(x=>{
        const v=fr(x[k]), opts=k==='install'?PQ_INSTALLS:k==='contrat'?PQ_CONTRATS:null;
        if(opts) return '<td class="'+(x.id===currentId?'cur ':'')+(v?'':'none')+'"><select class="req-in" data-id="'+escapeHtml(x.id)+'" data-k="'+k+'"><option value=""></option>'+opts.concat(v && !opts.includes(v)?[v]:[]).map(o=>'<option'+(o===v?' selected':'')+'>'+escapeHtml(o)+'</option>').join('')+'</select></td>';
        return cell(x, v, 'data-id="'+escapeHtml(x.id)+'" data-k="'+k+'"', false); }).join('')+'</tr>';
    });
    t+='</tbody></table>';
    sc.innerHTML=t; wrap.appendChild(sc);
    if(window.TODO_LITE) sc.querySelectorAll('.req-in').forEach(i=>{ if(i.tagName==='SELECT') i.disabled=true; else i.readOnly=true; });   // phone: read only, like the sheets
    sc.querySelectorAll('.req-col').forEach(b=>{ b.onclick=()=>openOppDetail(b.dataset.id); });
    sc.querySelectorAll('.req-sec-h').forEach(b=>{ b.onclick=()=>{ const tb=b.closest('tbody'), f=!tb.classList.contains('folded'); tb.classList.toggle('folded', f); b.setAttribute('aria-expanded', String(!f)); try{ localStorage.setItem('req-sec-'+tb.dataset.sec, f?'0':'1'); }catch(e){} }; });
    // edits: saved on Enter or when leaving the cell; Escape puts the value back
    sc.querySelectorAll('.req-in').forEach(inp=>{
      const start=inp.value;
      inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); inp.blur(); } if(e.key==='Escape'){ inp.value=start; inp.blur(); e.stopPropagation(); } });
      inp.addEventListener('change', ()=>{
        const o=opportunities.find(x=>x.id===inp.dataset.id); if(!o) return;
        let v=inp.value.trim();
        if(inp.dataset.k){ if(['debut','fin'].includes(inp.dataset.k) && v){ const f=pqFullDate(v); if(f) v=f; } o[inp.dataset.k]=v;
          // start and end give the duration (the duration never moves a date)
          if(['debut','fin'].includes(inp.dataset.k)){ const d=pqDateOf(o.debut), e=pqDateOf(o.fin); if(d && e && e>d){ o.duree=String(Math.round(((e-d)/864e5+1)/365.25*2)/2).replace('.',','); const dc=sc.querySelector('.req-in[data-id="'+o.id+'"][data-k="duree"]'); if(dc) dc.value=o.duree; } } }
        else caractSet(o, inp.dataset.l, v);
        touchCrm(o); saveCrm(); renderPipeline();
        const td=inp.closest('td'); td.classList.remove('empty','none'); if(!v) td.classList.add(td.querySelector('[placeholder="à compléter"]')?'empty':'none');
        td.classList.add('saved'); setTimeout(()=>td.classList.remove('saved'), 900);
      });
    });
    return wrap;
  }
  // Installation sheet: the key figures first, then Centrale / Contacts / Suivi with only what is filled in;
  // what is missing is listed in one line per block. Phones and mails copy on click.
  function buildInstallSheet(o){
    const fr=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?pqIsoToFr(v):(v||'');
    const mwh=v=>v?Number(pqNum(v)).toLocaleString('fr-FR')+' MWh':'';
    const phones=s=>String(s||'').split(/\s*\/\s*|\n|;/).map(x=>x.trim()).filter(Boolean);
    const wrap=document.createElement('div'); wrap.className='os';
    // key figures
    const facts=document.createElement('div'); facts.className='os-facts';
    [['Puissance',fmtKwc(o.kwc)],['Volume annuel',mwh(o.mwh)],['Mise en service',o.mesEff?o.mesEff+' (effective)':o.mesPrev],['Lieu',o.commune?o.commune+' ('+(o.cp||(o.dept||'').split(' ')[0])+')':(o.dept||'')]]
      .forEach(([l,v])=>{ const d=document.createElement('div'); d.className='os-fact'+(v?'':' empty'); d.innerHTML='<span></span><b></b>'; d.firstChild.textContent=l; d.lastChild.textContent=v||'à compléter'; facts.appendChild(d); });
    wrap.appendChild(facts);
    const grid=document.createElement('div'); grid.className='os-grid'; wrap.appendChild(grid);
    const copyVal=(b,val)=>{ b.classList.add('copy'); b.title='Copier'; b.tabIndex=0; b.setAttribute('role','button'); b.onclick=()=>copyToClipboard(val, b); };
    const card=(title, rows, cls)=>{
      const c=document.createElement('section'); c.className='os-card'+(cls?' '+cls:'');
      const h=document.createElement('h4'); h.textContent=title; c.appendChild(h);
      const missing=[];
      rows.forEach(r=>{
        if(r.node){ c.appendChild(r.node); return; }
        const [label,val,opt]=r; if(!val){ if(!(opt&&opt.optional)) missing.push(label); return; }
        const row=document.createElement('div'); row.className='os-row'+(opt&&opt.wide?' wide':'');
        const l=document.createElement('span'); l.textContent=label; const b=document.createElement('b'); if(String(val).includes('[[')) renderLinked(b, String(val)); else b.textContent=val;
        if(opt&&opt.copy) copyVal(b, val);
        if(opt&&opt.late) b.classList.add('late');
        row.append(l,b); c.appendChild(row);
      });
      if(missing.length){ const m=document.createElement('p'); m.className='os-missing'; m.textContent='Non renseigné : '+missing.join(', '); c.appendChild(m); }
      grid.appendChild(c); return c;
    };
    card('Centrale', [['Nom',oppName(o)],['Type',o.install],['Contrat',o.contrat],['Productible',o.kwc&&o.mwh?Math.round(pqNum(o.mwh)*1000/pqNum(o.kwc))+' kWh/kWc':''],
      ['P90',mwh(o.p90)],['MES prévisionnelle',o.mesEff?o.mesPrev:'',{optional:true}],['Début → fin',[o.debut,o.fin].filter(Boolean).join(' → ')+(o.duree?' ('+o.duree+' ans)':'')],
      ['Région',o.region],['SPV',o.spv],['SIRET',o.siret,{copy:true}],['Particularités',o.particularites,{wide:true}]]);
    // contacts: the main one, then the others, each with Tél. 1 / Tél. 2 / mail
    const person=(name, role, tels, mail, main)=>{
      const p=document.createElement('div'); p.className='os-person'+(main?' main':'');
      const h=document.createElement('div'); h.className='os-person-h'; h.innerHTML='<b></b><span></span>'; h.firstChild.textContent=name||'(sans nom)'; h.lastChild.textContent=[main?'contact principal':'',role].filter(Boolean).join(' · '); p.appendChild(h);
      const lines=[['Tél. 1',tels[0]],['Tél. 2',tels[1]],['Mail',mail]];
      lines.forEach(([l,v])=>{ const r=document.createElement('div'); r.className='os-row'; const a=document.createElement('span'); a.textContent=l; const b=document.createElement('b'); b.textContent=v||'—'; if(v) copyVal(b,v); else b.classList.add('none'); r.append(a,b); p.appendChild(r); });
      return p;
    };
    const mainName=[o.prenom,(o.nom||'').replace(/^(M\.|Mme)\s+/i,'')].filter(Boolean).join(' ');
    const mainMail=(o.mail||'').toLowerCase();
    const others=(o.otherContactIds||[]).map(id=>contacts.find(c=>c.id===id)).filter(c=>c && !c.deleted && !(mainMail && (c.email||'').toLowerCase()===mainMail));
    const contactRows=[['Producteur',[o.producteur||o.company, o.marche].filter(Boolean).join(' · ')]];
    if(mainName||o.tel||o.mail) contactRows.push({ node:person(mainName, o.qualite, phones(o.tel), o.mail, true) });
    else contactRows.push(['Contact principal','']);
    others.forEach(c=>contactRows.push({ node:person([c.firstName,c.lastName].filter(Boolean).join(' '), c.role, phones([c.phone1,c.phone2].filter(Boolean).join(' / ')), c.email, false) }));
    { const people=contacts.filter(c=>!c.deleted && ((mainMail && (c.email||'').toLowerCase()===mainMail) || (o.otherContactIds||[]).includes(c.id)));
      const dup=contactDupGroups().find(g=>g.filter(c=>people.includes(c)).length>1 || (g.some(c=>people.includes(c)) && g.some(c=>mainMail && (c.email||'').toLowerCase()===mainMail) && g.length>1));
      if(dup){ const n=document.createElement('div'); n.className='os-dup'; n.innerHTML='<span></span><button type="button" class="pq-link">Fusionner</button>';
        n.querySelector('span').textContent=dup.map(c=>[c.firstName,c.lastName].filter(Boolean).join(' ')).join(' et ')+' semblent être la même personne.';
        n.querySelector('button').onclick=()=>openContactMerge(dup.map(c=>c.id)); contactRows.push({ node:n }); } }
    card('Contacts', contactRows, 'os-contacts');
    const relanceLate=o.relance && o.relance<toISO(new Date());
    card('Suivi', [['Chargé',o.charge],['Origine',[o.origine, o.ca&&o.ca!=='N/A'?o.ca:''].filter(Boolean).join(' · ')],['Entrée pipe',fr(o.dateEntree)],
      ['RDV',[o.rdv1?fr(o.rdv1)+(o.cr1?' (CR)':''):'', o.rdv2?fr(o.rdv2)+(o.cr2?' (CR)':''):''].filter(Boolean).join(' · '),{optional:true}],['Go',fr(o.goDate),{optional:true}],
      ['1ère offre',[fr(o.dateOffre),o.nature].filter(Boolean).join(' · '),{optional:true}],['Signature',fr(o.signDate),{optional:true}],
      ['Prochaine action',[o.action,o.relance?'le '+fr(o.relance):''].filter(Boolean).join(' '),{late:relanceLate}],['Stade Pipe',pipeStade(o)],['Statut BDD',bddStatut(o)],['Code affaire',codeAffaire(o)],
      ['Commentaires',o.commentaires,{wide:true,optional:true}]], 'os-suivi');
    return wrap;
  }
  function exitOpp(o, kind){
    if(!confirm('« '+oppName(o)+' » : '+OPP_EXITS[kind]+' ?')) return;
    o.stageBeforeExit=o.stage; o.stage=kind; o.lostAt=Date.now(); touchCrm(o); saveCrm();
    closeOppDetail(); renderPipeline();
  }
  // a lost deal (one installation or a whole request at once), with its little animation
  function loseOpps(list){
    if(!list.length) return;
    const what=list.length>1?list.length+' installations ('+list[0].company+')':'« '+oppName(list[0])+' »';
    if(!confirm(what+' : offre perdue ?')) return;
    list.forEach(o=>{ o.stageBeforeExit=o.stage; o.stage='perdu'; o.lostAt=Date.now(); touchCrm(o); });
    saveCrm(); closeOppDetail(); renderPipeline();
    celebrate('lost', list);
  }
  // Won / signed / lost: a short animation over the page (never blocks a click, skipped if the device asks for less motion).
  // Moves made together (a whole request) show one animation.
  let celebrateTimer=null, celebrateQueue=null;
  function celebrate(kind, list){
    const rank={ lost:0, won:1, signed:2 };
    if(!celebrateQueue || rank[kind]>rank[celebrateQueue.kind]) celebrateQueue={ kind, list:list||[] };
    clearTimeout(celebrateTimer);
    celebrateTimer=setTimeout(()=>{ const q=celebrateQueue; celebrateQueue=null; playCelebration(q.kind, q.list); }, 60);
  }
  function playCelebration(kind, list){
    const n=list.length, sub=n>1?n+' installations'+(list[0]&&list[0].company?' · '+list[0].company:''):(list[0]?oppName(list[0]):'');
    if(window.todoCelebrate) window.todoCelebrate(kind, { sub });   // js/celebrate.js: three animations of each kind, at random
  }
  // Moving into a stage records the dates the BDD needs.
  // the opportunity in one line: installations · power · technology · volume
  function oppSummary(list){
    if(!list.length) return '';
    const kwc=list.reduce((s,x)=>s+(pqNum(String(x.kwc||''))||0),0), mwh=list.reduce((s,x)=>s+(pqNum(String(x.mwh||''))||0),0);
    const techs=[...new Set(list.map(x=>x.install).filter(Boolean))].join(' + ');
    return [list.length+' installation'+(list.length>1?'s':''), kwc?fmtKwc(kwc):'', techs, mwh?Math.round(mwh).toLocaleString('fr-FR')+' MWh/an':''].filter(Boolean).join(' · ');
  }
  // the steps of the pipeline as a clickable track; for several installations, the number at each step
  function buildStageTrack(list, onPick){
    const track=document.createElement('div'); track.className='opp-stage-track';
    const idx=list.filter(x=>!isExited(x)).map(x=>stageIndex(x.stage)).filter(i=>i>=0), lo=idx.length?Math.min(...idx):-1;
    const allOut=list.every(isExited);
    PIPE_PHASES.filter(p=>p.key!=='prequal').forEach(ph=>{
      const g=document.createElement('div'); g.className='opp-phase';
      const h=document.createElement('div'); h.className='opp-phase-h'; h.textContent=ph.label; g.appendChild(h);
      OPP_STAGES.filter(st=>st.phase===ph.key).forEach(st=>{
        const i=stageIndex(st.key), n=list.filter(x=>x.stage===st.key).length;
        const row=document.createElement('button'); row.type='button';
        row.className='opp-stage-step '+(allOut?'upcoming':(n?'current':(i<lo?'done':'upcoming')));
        const cls=row.className.split(' ')[1];
        row.innerHTML='<span class="ost-mark">'+(cls==='done'?'✓':cls==='current'?'●':'')+'</span><span class="ost-l">'+escapeHtml(st.label)+'</span><span class="ost-m">'+(st.who!=='Com'?'<span class="ost-who">'+st.who+'</span>':'')+(list.length>1&&n?'<b class="ost-n">'+n+'</b>':'')+'</span>';
        row.title=list.length>1?'Placer les '+list.length+' installations à cette étape':'Placer l\u2019installation à cette étape';
        row.onclick=()=>{ if(list.every(x=>x.stage===st.key)) return; onPick(st.key); };
        g.appendChild(row);
      });
      track.appendChild(g);
    });
    return track;
  }
  let stageScopeAll=true;   // a stage chosen in an installation's sheet applies to all the installations of its request
  function setOppStage(o, key){
    const prev=stageIndex(o.stage), next=stageIndex(key), today=toISO(new Date());
    if(next>=stageIndex('demande_prix') && !o.goDate){ o.goDate=today; o.qualification=true; }
    if(prev<=stageIndex('offre_remise') && next>stageIndex('offre_remise') && !o.dateOffre) o.dateOffre=today;
    if(prev<=stageIndex('signature') && next>stageIndex('signature') && !o.signDate) o.signDate=today;
    // the offer accepted (into the contract phase), then the contract signed: a little celebration
    if(prev>=0 && prev<stageIndex('kyc') && next>=stageIndex('kyc')) celebrate(next>stageIndex('signature')?'signed':'won', [o]);
    else if(prev>=0 && prev<=stageIndex('signature') && next>stageIndex('signature')) celebrate('signed', [o]);
    o.stage=key; touchCrm(o); saveCrm(); renderPipeline();
  }

  // ----- Stage advance (after a linked task is validated, or from a detail view) -----
  let pendingAdvance=null;
  function maybeOfferStageAdvance(task){
    if(!task.opportunityId) return;
    const o=opportunities.find(x=>x.id===task.opportunityId);
    if(!o || o.deleted) return;
    if(o.kind==='request'){ const list=requestInstalls(o.id).filter(x=>!isExited(x)); if(list.length) offerStageAdvance(list); return; }
    if(o.kind==='prequal'){ if(o.stage==='prequal') openOppDetail(o.id); return; }
    if(isExited(o)) return;
    offerStageAdvance([o]);
  }
  // Each installation moves to ITS next stage (a grouped request can hold installations at different stages);
  // forcedKey (Go → pricing request) applies to every installation that is still before it.
  const nextStageKey=(o, forcedKey)=>{
    if(forcedKey) return stageIndex(o.stage)<stageIndex(forcedKey)?forcedKey:null;
    const n=OPP_STAGES[stageIndex(o.stage)+1]; return n?n.key:null;
  };
  function offerStageAdvance(list, forcedKey){
    const moves=list.map(o=>({ o, key:nextStageKey(o, forcedKey) })).filter(m=>m.key);
    if(!moves.length) return;
    pendingAdvance={ moves:moves.map(m=>({ id:m.o.id, key:m.key })) };
    const o=moves[0].o, next=oppStage(moves[0].key);
    const same=moves.every(m=>m.key===moves[0].key && m.o.stage===o.stage);
    const label=moves.length>1?moves.length+' installations ('+o.company+')':'« '+o.company+' — '+oppName(o)+' »';
    $('stage-advance-text').textContent=same
      ? label+' : passer de « '+stageLabel(o.stage)+' » à « '+next.label+' »'+(next.who!=='Com'?' (porté par '+next.who+', la tâche sera « en attente »)':'')+' ?'
      : label+' : chaque installation passe à son étape suivante ('+moves.map(m=>oppName(m.o)+' → '+oppStage(m.key).label).join(', ')+') ?';
    $('stage-advance-nogo').classList.toggle('hidden', !moves.every(m=>m.o.stage==='qualif_en_cours'));
    $('stage-create-task').checked=true; $('stage-due').value=next.who!=='Com'?pqAddDays(7):''; $('stage-urgency').value='moyenne'; $('stage-due-row').style.display='flex';
    $('stage-advance-overlay').classList.remove('hidden');
  }
  function confirmStageAdvance(){
    if(!pendingAdvance){ closeStageAdvance(); return; }
    const moves=pendingAdvance.moves.map(m=>({ o:opportunities.find(x=>x.id===m.id), key:m.key })).filter(m=>m.o);
    moves.forEach(m=>setOppStage(m.o, m.key));
    const list=moves.map(m=>m.o);
    if($('stage-create-task').checked && moves.length){
      // one task per target stage; grouped installations of a request share it
      const byKey=new Map(); moves.forEach(m=>{ if(!byKey.has(m.key)) byKey.set(m.key,[]); byKey.get(m.key).push(m.o); });
      byKey.forEach((group,key)=>{
        const req=group.length>1 && group[0].requestId ? opportunities.find(x=>x.id===group[0].requestId) : null;
        const target=req||group[0];
        const s=oppStage(key), other=s.who!=='Com';
        const task=createTask({ title:s.task+' — '+(req?group.length+' installations':oppName(group[0])), client:group[0].company, due:$('stage-due').value, urgency:$('stage-urgency').value, status:other?'en_attente':'a_faire', description:other?'À suivre : étape portée par '+s.who+'.':'' });
        task.opportunityId=target.id; task.stageLabel=s.label; touch(task); saveTasks();
        target.taskId=task.id; touchCrm(target);
      });
    }
    saveCrm(); closeStageAdvance(); render(); renderPipeline();
    if(moves.some(m=>m.key==='demande_prix')){ const reqId=list[0].requestId; if(reqId) openRequestDetail(reqId); else openOppDetail(list[0].id); }
  }
  function noGoFromAdvance(){
    if(!pendingAdvance) return;
    pendingAdvance.moves.map(m=>opportunities.find(x=>x.id===m.id)).filter(Boolean).forEach(o=>{ o.stageBeforeExit=o.stage; o.stage='no_go'; o.lostAt=Date.now(); touchCrm(o); });
    saveCrm(); closeStageAdvance(); renderPipeline();
  }
  function closeStageAdvance(){ $('stage-advance-overlay').classList.add('hidden'); pendingAdvance=null; }

  // ----- Pricing requests (several installations, one mail) -----
  function openRequestDetail(reqId){
    const req=opportunities.find(x=>x.id===reqId); if(!req) return;
    viewingOppId=reqId;
    const list=requestInstalls(reqId);
    $('opp-detail-title').textContent=req.company+' — '+(req.title||'Demande de pricing');
    $('opp-detail-sum').textContent=oppSummary(requestInstalls(reqId).filter(x=>!isExited(x)));
    // edit from the global view: the form shows all the installations of the request (this one first)
    { const first=requestInstalls(reqId).filter(x=>!isExited(x))[0]||requestInstalls(reqId)[0]; const ed=$('opp-detail-edit');
      ed.hidden=!first; ed.textContent='Modifier les fiches'; ed.onclick=()=>{ closeOppDetail(); openOppForm({ editId:first.id }); }; }
    const box=$('opp-detail-body'); box.innerHTML='';
    const liveReq=list.filter(o=>!isExited(o));
    // key figures, as on an installation's sheet
    const num=v=>pqNum(String(v||''))||0, kwc=liveReq.reduce((s,x)=>s+num(x.kwc),0), mwh=liveReq.reduce((s,x)=>s+num(x.mwh),0);
    const mes=[...new Set(liveReq.map(x=>x.mesEff||x.mesPrev).filter(Boolean))].map(m=>({ m, d:pqDateOf(m) })).filter(x=>x.d).sort((a,b)=>a.d-b.d);
    const stages=[...new Set(liveReq.map(x=>x.stage))];
    const facts=document.createElement('div'); facts.className='os-facts';
    [['Installations',String(liveReq.length)+(list.length>liveReq.length?' (+'+(list.length-liveReq.length)+' sorties)':'')],['Puissance totale',kwc?fmtKwc(kwc):''],['Volume total',mwh?Math.round(mwh).toLocaleString('fr-FR')+' MWh':''],
     ['Mise en service',mes.length?(mes.length>1?mes[0].m+' → '+mes[mes.length-1].m:mes[0].m):''],['Étape',stages.length===1?stageLabel(stages[0]):(stages.length?stages.length+' étapes':'')]]
      .forEach(([l,v])=>{ const d=document.createElement('div'); d.className='os-fact'+(v?'':' empty'); d.innerHTML='<span></span><b></b>'; d.firstChild.textContent=l; d.lastChild.textContent=v||'à compléter'; facts.appendChild(d); });
    box.appendChild(facts);
    // the installations, one line each
    const card=document.createElement('section'); card.className='os-card req-insts';
    card.innerHTML='<h4>Installations</h4>';
    list.forEach((o,i)=>{
      const r=document.createElement('div'); r.className='req-inst'+(isExited(o)?' out':'');
      r.innerHTML='<span class="n"></span><button type="button" class="req-inst-name"><b></b><span></span></button>';
      r.querySelector('.n').textContent=String(i+1); r.querySelector('b').textContent=oppName(o); r.querySelector('.req-inst-name span').textContent=instLineInfo(o);
      r.querySelector('.req-inst-name').onclick=()=>openOppDetail(o.id);
      r.appendChild(stageChip(o));
      const ed=document.createElement('button'); ed.type='button'; ed.className='req-inst-ed'; ed.title='Modifier'; ed.setAttribute('aria-label','Modifier '+oppName(o));
      ed.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
      ed.onclick=()=>{ closeOppDetail(); openOppForm({ editId:o.id }); };
      r.appendChild(ed);
      const rm=document.createElement('button'); rm.type='button'; rm.className='req-inst-rm'; rm.title='Retirer de la demande (l\u2019installation reste dans le pipeline)'; rm.setAttribute('aria-label','Retirer '+oppName(o)+' de la demande'); rm.textContent='✕';
      rm.onclick=()=>{ o.requestId=null; touchCrm(o); saveCrm(); renderPipeline(); openRequestDetail(reqId); };
      r.appendChild(rm); card.appendChild(r);
    });
    const candidates=opportunities.filter(o=>!o.deleted && o.kind==='installation' && !o.requestId && o.company===req.company && !isExited(o));
    if(candidates.length){
      const sel=document.createElement('select'); sel.className='opp-req-add';
      sel.innerHTML='<option value="">+ Ajouter une installation de '+escapeHtml(req.company)+'…</option>'+candidates.map(o=>'<option value="'+o.id+'">'+escapeHtml(oppName(o))+'</option>').join('');
      sel.onchange=()=>{ const o=opportunities.find(x=>x.id===sel.value); if(o){ o.requestId=reqId; touchCrm(o); saveCrm(); renderPipeline(); openRequestDetail(reqId); } };
      card.appendChild(sel);
    }
    box.appendChild(card);
    // the same step track as an installation, for all of them at once
    if(liveReq.length){
      const sh=document.createElement('div'); sh.className='stage-scope'; sh.innerHTML='<span></span>';
      sh.firstChild.textContent=liveReq.length>1?'Étape des '+liveReq.length+' installations (un clic les place toutes à l\u2019étape)':'Étape de l\u2019installation';
      box.appendChild(sh);
      box.appendChild(buildStageTrack(liveReq, key=>{ liveReq.forEach(o=>{ if(o.stage!==key) setOppStage(o, key); }); openRequestDetail(reqId); }));
    }
    if(list.length>1) box.appendChild(buildRequestCompare(list, null));
    const mailBox=document.createElement('div'); mailBox.className='opp-mail';
    const ml=pricingMail(req, list);
    mailBox.innerHTML='<div class="opp-phase-h">Mail de demande de pricing</div>';
    const subj=document.createElement('input'); subj.readOnly=true; subj.value=ml.subject; subj.id='opp-mail-subject';
    const body=document.createElement('textarea'); body.readOnly=true; body.value=ml.body; body.rows=12; body.id='opp-mail-body';
    const hint=document.createElement('p'); hint.className='modal-hint'; hint.textContent='Joins le fichier « Caractéristiques Centrales » créé par le bouton ci-dessous : toutes les lignes du modèle, remplies avec ce que l\u2019appli connaît (et tout ce que contenait l\u2019Excel du producteur).';
    mailBox.appendChild(subj); mailBox.appendChild(body); mailBox.appendChild(hint);
    box.appendChild(mailBox);
    const actions=$('opp-detail-actions'); actions.innerHTML='';
    const live=list.filter(o=>!isExited(o));
    if(live.length){
      const same=live.every(o=>o.stage===live[0].stage);
      const waiting=live.filter(o=>o.stage==='offre_attente');
      if(waiting.length){
        actions.appendChild(oppActionBtn('Offre acceptée'+(waiting.length>1?' ('+waiting.length+')':''), ()=>{ closeOppDetail(); offerStageAdvance(waiting, 'kyc'); }));
        actions.appendChild(oppActionBtn('Offre refusée'+(waiting.length>1?' ('+waiting.length+')':''), ()=>loseOpps(waiting), 'ghost-btn'));
      }
      if(!same || !waiting.length) actions.appendChild(oppActionBtn(same?'Tout passer à l\u2019étape suivante':'Avancer chaque installation', ()=>{ closeOppDetail(); offerStageAdvance(live, live.every(o=>o.stage==='qualif_en_cours')?'demande_prix':null); }));
    }
    actions.appendChild(oppActionBtn('Copier l\u2019objet', e=>copyToClipboard(ml.subject, e.target), 'ghost-btn'));
    actions.appendChild(oppActionBtn('Copier le mail', e=>copyToClipboard(ml.body, e.target), 'ghost-btn'));
    actions.appendChild(oppActionBtn('Fichier caractéristiques (.xlsx)', e=>downloadCaract(list.filter(o=>!isExited(o)), e.target), 'ghost-btn'));
    excelButtons(actions, list);
    actions.appendChild(oppActionBtn('Copier lignes Pipe', e=>copyPipeLines(list.filter(o=>!isExited(o)), e.target), 'ghost-btn'));
    actions.appendChild(oppActionBtn('Copier lignes BDD', e=>copyToClipboard(list.map(bddRow).join('\n'), e.target), 'ghost-btn'));
    actions.appendChild(oppActionBtn('Voir dans le réseau', ()=>{ closeOppDetail(); openInNetwork('rq:'+reqId); }, 'ghost-btn opp-net-btn lite-keep'));
    actions.appendChild(oppActionBtn('Fermer', closeOppDetail, 'ghost-btn lite-keep'));
    $('opp-detail-overlay').classList.remove('hidden');
  }
  function pqMonthYear(s){
    const t=String(s||'').trim(); let m;
    if((m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) return { y:+m[3], m:+m[2], d:+m[1] };
    if((m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) return { y:+m[1], m:+m[2], d:+m[3] };
    if((m=/^(\p{L}+)\s+(\d{4})$/u.exec(t)) && PQ_MONTHS[pqFold(m[1])]) return { y:+m[2], m:PQ_MONTHS[pqFold(m[1])], d:1 };
    if((m=/^(\d{4})$/.exec(t))) return { y:+m[1], m:null, d:null };
    const loose=t?pqParseDateLoose(t):null;   // « juil-27 », « 1er mars 2027 »… once more through the loose reader
    return loose && loose!==t ? pqMonthYear(loose) : null;
  }
  // Business code (procédure GENE01-D1, agrégation): AA(MM)BB(MM) – Producteur_Centrale – A
  //  AA = start of the contract (the commissioning date until the start date is known), (MM) when not 1 January;
  //  BB = end of the contract, (MM) when not 31 December. No market (MP) nor lot (L1) in agrégation.
  function codeAffaire(o){
    const start=pqMonthYear(o.debut)||pqMonthYear(o.mesEff)||pqMonthYear(o.mesPrev);
    let end=pqMonthYear(o.fin);
    // no end date but a duration: end = start + n years − 1 day (e.g. June 2027 + 3 years → May 2030)
    const n=parseFloat(String(o.duree||'').replace(',','.'));
    if(!end && start && start.m && n>0){ const e=new Date(start.y+Math.floor(n), start.m-1+Math.round((n%1)*12), (start.d||1)-1); end={ y:e.getFullYear(), m:e.getMonth()+1, d:e.getDate() }; }
    const aa=start?String(start.y).slice(2)+(start.m && !(start.m===1 && (start.d||1)===1)?'('+pqPad(start.m)+')':''):'[AA]';
    const lastDay=end&&end.m===12&&(!end.d||end.d===31);
    const bb=end?String(end.y).slice(2)+(end.m && !lastDay?'('+pqPad(end.m)+')':''):'[BB]';
    const prod=String(o.producteur||o.company||'').trim(), name=oppName(o);
    return aa+bb+' \u2013 '+[prod, name].filter(Boolean).join('_')+' \u2013 A';
  }
  const CARACT_ROWS=['Nom Installation','Nom SPV','SIRET SPV','Adresse Installation','Département','Commune','Altitude','Latitude','Longitude','Nature Projet',"Type d'injection",
    "Taux d'autoconsommation individuelle","Taux d'autoconsommation collective (sur Prod totale)",'Première injection','Date de mise en service (effective ou prévisionnelle)',
    "Nombre d'Onduleurs",'Puissance unitaire Onduleurs (kVA)','Puissance raccordement (kVA)','Puissance installée (kWc)','Système de gestion des heures négatives','Stockage',
    'P50 annuel (indicatif) (MWh/an)','P90 annuel (indicatif) (MWh/an)','Productible (P50) (kWh/kWc/an)']
    .concat([1,2,3,4].flatMap(n=>['Champ '+n+' : Orientation (° par rapport au sud)','Champ '+n+' : Inclinaison (°)','Champ '+n+' : Puissance installée (kWc)',
      'Champ '+n+' : P50 annuel (indicatif) (MWh/an)','Champ '+n+' : P90 annuel (indicatif) (MWh/an)','Champ '+n+' : Fixe ou tracker']));
  const caractKey=l=>pqFold(l).replace(/lattitude/,'latitude').replace(/[^a-z0-9]/g,'');
  function caractValue(o, label){
    const num=v=>{ const n=pqNum(String(v==null?'':v)); return isNaN(n)?'':n; };
    const k=caractKey(label), raw=o.caract||{};
    const fromFile=()=>{ const hit=Object.keys(raw).find(l=>caractKey(l)===k); return hit!==undefined?raw[hit]:''; };
    const dept=(o.dept||'').match(/^(\S+)\s+-\s+(.+)$/);
    switch(k){
      case caractKey('Nom Installation'): return oppName(o);
      case caractKey('Nom SPV'): return o.spv||fromFile();
      case caractKey('SIRET SPV'): return o.siret||fromFile();
      case caractKey('Adresse Installation'): return fromFile()||[o.cp,o.commune].filter(Boolean).join(' ');
      case caractKey('Département'): return dept?dept[2]+' ('+dept[1]+')':(o.dept||fromFile());
      case caractKey('Commune'): return o.commune||fromFile();
      case caractKey('Nature Projet'): return fromFile()||(/sol|toiture|ombri|hangar|agrivolt/i.test(o.particularites||'')?o.particularites:(o.install==='Eolien'?'Éolien terrestre':''));
      case caractKey('Date de mise en service (effective ou prévisionnelle)'): return o.mesEff||o.mesPrev||fromFile();
      case caractKey('Puissance installée (kWc)'): return num(o.kwc)||fromFile();
      case caractKey('P50 annuel (indicatif) (MWh/an)'): return num(o.mwh)||fromFile();
      case caractKey('P90 annuel (indicatif) (MWh/an)'): return num(o.p90)||fromFile();
      case caractKey('Productible (P50) (kWh/kWc/an)'): { if(num(o.productible)) return num(o.productible); const f=fromFile(); if(f!=='') return f; const a=num(o.mwh), b=num(o.kwc); return a&&b?Math.round(a*1000/b*10)/10:''; }
      default: return fromFile();
    }
  }
  function caractFileName(list){
    const d=new Date(), yymmdd=String(d.getFullYear()).slice(2)+pqPad(d.getMonth()+1)+pqPad(d.getDate());
    const who=(list[0]&&(list[0].producteur||list[0].company)||'Producteur').replace(/[\\/:*?"<>|]/g,'').trim();
    return yymmdd+'_Caractéristiques_Centrales_'+who+'.xlsx';
  }
  async function downloadCaract(list, btn){
    try{
      await loadXlsxLib();
      const rows=[[''].concat(list.map((_,i)=>'Centrale '+(i+1)))].concat(CARACT_ROWS.map(l=>[l].concat(list.map(o=>caractValue(o,l)))));
      const ws=XLSX.utils.aoa_to_sheet(rows);
      ws['!cols']=[{ wch:52 }].concat(list.map(()=>({ wch:34 })));
      const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Données');
      XLSX.writeFile(wb, caractFileName(list));
      if(btn){ const t=btn.textContent; btn.textContent='✓ Fichier créé'; setTimeout(()=>{ btn.textContent=t; },2000); }
    }catch(e){ console.error(e); showBridgeMsg('Fichier non créé : '+(e.message||e), false); }
  }
  // Pricing request mail, on the model of the last one sent (Q ENERGY, 3 PV + 1 éolien CR): the figures stay in the
  // attached file; the mail gives the codes, the dates (first injection → MSI), the options and the conditions asked.
  function pricingMail(req, list){
    const company=req.company||(list[0]&&list[0].company)||'';
    const pv=list.filter(o=>/PV/.test(o.install||'')), eol=list.filter(o=>/Eolien/.test(o.install||'')), other=list.length-pv.length-eol.length;
    const cr=list.length && list.every(o=>/CR/.test(o.contrat||'')), anyCr=list.some(o=>/CR/.test(o.contrat||''));
    const mech=[...new Set(list.map(o=>/CR/.test(o.contrat||'')?'CR':/OA/.test(o.contrat||'')?'OA':o.contrat?'marché':'').filter(Boolean))].join(' / ');
    const parts=[]; if(pv.length) parts.push(pv.length+' PV'); if(eol.length) parts.push(eol.length+' éolien'); if(other>0 || !parts.length) parts.push((other||list.length)+' centrale'+((other||list.length)>1?'s':''));
    const subject='Demande de prix agrégation – '+company+' – '+parts.join(' + ')+(mech?' '+mech:'');
    // « 3 projets PV greenfield et 1 projet éolien greenfield »
    const today=new Date();
    const stage=g=>{ const built=g.filter(o=>{ const d=pqToDate(o.mesEff); return d && d<=today; }).length; return built===g.length?'en service':built?'en service ou greenfield':'greenfield'; };
    const proj=(g,label)=>g.length?g.length+' projet'+(g.length>1?'s':'')+' '+label+' '+stage(g):'';
    const what=[proj(pv,'PV'), proj(eol,'éolien'), other>0?other+' autre'+(other>1?'s':'')+' projet'+(other>1?'s':''):''].filter(Boolean).join(' et ');
    const many=list.length>1;
    const why=cr?(many?', tous lauréats AO CRE et bénéficiant d’un contrat de complément de rémunération':', lauréat AO CRE et bénéficiant d’un contrat de complément de rémunération')
      :list.length && list.every(o=>/OA/.test(o.contrat||''))?(many?', tous sous obligation d’achat':', sous obligation d’achat'):'';
    const indicatif=list.some(o=>o.nature==='Engageante')?'fermes et engageants':'indicatifs';
    const month=p=>p&&p.m?PQ_MONTH_NAMES[p.m-1].toLowerCase()+' '+p.y:(p?String(p.y):'');
    // first injection = start of the contract (date de début, else the producer's file); MSI = commissioning
    const injOf=o=>pqMonthYear(o.debut)||pqMonthYear(caractValue(o,'Première injection'));
    const msiOf=o=>pqMonthYear(o.mesEff||o.mesPrev);
    const testLen=(a,b)=>{ if(!a||!b||!a.m||!b.m) return ''; const da=new Date(a.y,a.m-1,a.d||1), db=new Date(b.y,b.m-1,b.d||1), days=Math.round((db-da)/864e5); if(days<=0) return '';
      const m=days/30.44; return Math.abs(m-Math.round(m))<0.2 && Math.round(m)>=1?Math.round(m)+' mois':Math.max(1,Math.round(days/7))+' semaine'+(Math.round(days/7)>1?'s':''); };
    const byStart=list.slice().sort((x,y)=>{ const a=injOf(x)||msiOf(x), b=injOf(y)||msiOf(y); return (a?a.y*12+(a.m||0):1e9)-(b?b.y*12+(b.m||0):1e9); });
    const anyTest=list.some(o=>{ const a=injOf(o), b=msiOf(o); return a && b && testLen(a,b); });
    const dateLine=o=>{ const a=injOf(o), b=msiOf(o), t=testLen(a,b);
      if(a && b && t) return oppName(o)+' : '+month(a)+' → '+month(b)+' (test '+t+')';
      if(b) return oppName(o)+' : MSI '+month(b)+(a?'':' (première injection [À CONFIRMER])');
      if(a) return oppName(o)+' : '+month(a)+' → MSI [À CONFIRMER]';
      return oppName(o)+' : [À CONFIRMER]'; };
    const ends=[...new Set(list.map(o=>{ const e=pqMonthYear(o.fin); return e&&e.m?pqPad(e.d||new Date(e.y,e.m,0).getDate())+'/'+pqPad(e.m)+'/'+e.y:(o.fin||''); }).filter(Boolean))];
    const duree=ends.length>1?ends.length+' pricing demandés, '+ends.map(e=>'jusqu’au '+e).join(' et ')+'.':ends.length?'jusqu’au '+ends[0]+'.':'[À CONFIRMER]';
    const ctx=[...new Set(list.map(o=>(o.contrat||'').replace(/\s+CR$/,' (CR)')).filter(Boolean))].join(' / ')||'[À CONFIRMER]';
    const L=['Bonjour à tous,','',
      'Ci-dessous une demande de pricing agrégation pour '+company+' : '+(what||parts.join(' + '))+why+'.',
      'Les prix demandés sont '+indicatif+'.',
      'Vous trouverez ci-joint le fichier avec les caractéristiques des centrales que je continue de compléter avec le producteur (infos en jaune extrapolées).','',
      'Codes affaire :'];
    list.forEach(o=>L.push('- '+codeAffaire(o)));
    L.push('','Informations principales :',
      '- Puissance installée : voir fichier joint.',
      '- Production : voir fichier joint.',
      '- Latitude/longitude : voir fichier joint.',
      '- Dates de démarrage du contrat (première injection → MSI, phase de test entre les deux) :');
    byStart.forEach(o=>L.push('   - '+dateLine(o)));
    L.push('- Durée : '+duree, '- Contexte du marché : '+ctx);
    if(anyTest && anyCr){
      L.push('- Prix d’achat par Selfee : Le producteur demande un prix pour la phase de test et un prix pour la période CR à partir de la MSI.',
        '   - Prix phase de Test : SPOT', '   - Prix à partir de la MSI : Prix M0 CR',
        '- Frais d’agrégation :', '   - Période de test : frais en €/MWh',
        '   - Période CR : frais fixes en €/MWh, ou fixe + variable, ou autre structure à proposer, avec un prix par centrale');
    } else {
      L.push('- Prix d’achat par Selfee : '+(anyCr?'Prix M0 CR':'[À DÉFINIR]'),
        '- Frais d’agrégation : frais fixes en €/MWh, ou fixe + variable, ou autre structure à proposer, avec un prix par centrale');
    }
    L.push('- Garanties de capacité : oui/non. Si oui indiquer les frais associés.',
      '- Pilotage Prix négatifs : oui/non. Si oui, indiquer les frais associés et le seuil d’arrêt (0 €/MWh ou -0,10 €/MWh ou autre).',
      '- Mécanisme d’ajustement : oui/non. Si oui, indiquer participation (hausse/baisse) et rémunération (partage de valeur, prime fixe d’activation, forfait annuel, autre).',
      '- Programmation : oui/non',
      '- Valorisation sur d’autres marchés : à indiquer si pertinent.',
      '- REMIT reporting et programmation : oui/non. Si oui, frais associés.',
      '- GAPD : coût et montant à indiquer.',
      '- Disponibilité : proposition franchise de 30 heures d’indisponibilité (hors indispos programmés) et passage au SPOT si arrêt long (>5jours) pour le mois concerné par l’arrêt long.',
      '- GO : '+(cr?'sans objet':'[À DÉFINIR]'));
    if(eol.length) L.push('- Éolien : bridages chiroptères, avifaune et acoustiques : [À COMPLÉTER – voir le fichier de consultation du producteur]');
    L.push('- Date de remise de l’offre : [À CONFIRMER – en attente du retour du producteur].','',
      'Je reste disponible pour en discuter si nécessaire.','','Merci d’avance !');
    return { subject, body:L.join('\n') };
  }

  // ----- Excel rows (tab-separated, pasted from column A) -----
  // Rows are built as typed cells — {d:'YYYY-MM-DD'} for dates, numbers, booleans, strings — then either
  // sent to the local Excel bridge as is, or turned into tab-separated text for a paste from column A.
  function tsvCell(v){ if(v==null) return ''; let s=String(v); if(/[\t\n"]/.test(s)) s='"'+s.replace(/"/g,'""')+'"'; return s; }
  function cellToText(v){
    if(v==null||v==='') return '';
    if(typeof v==='boolean') return v?'VRAI':'FAUX';
    if(typeof v==='number') return String(v).replace('.',',');
    if(typeof v==='object' && v.d) return pqIsoToFr(v.d);
    return tsvCell(v);
  }
  const cellsToTsv=cells=>cells.map(cellToText).join('\t');
  const dateCell=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?{d:v}:null;
  // "dd/mm/yyyy" typed by hand becomes a real date; "Juin 2027" stays text
  const looseDateCell=v=>{ const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v||'').trim()); return m?{d:m[3]+'-'+pqPad(m[2])+'-'+pqPad(m[1])}:(v||null); };
  const numCell=v=>{ if(v==null||v==='') return null; const n=pqNum(v); return isNaN(n)?String(v):n; };
  function pipeCells(o){
    return PQ_FIELDS.map(f=>{
      if(f.k==='stade') return pipeStade(o);
      const v=o[f.k];
      if(f.type==='check') return !!v;
      if(v==null||v==='') return null;
      if(f.type==='date') return dateCell(v);
      if(f.type==='number') return numCell(v);
      if(f.k==='mesPrev'||f.k==='mesEff'||f.k==='debut'||f.k==='fin') return looseDateCell(v);
      return typeof v==='string'?plainLinks(v):v;   // [[liens]] become plain names in the Excel
    });
  }
  function pipeRow(o){ return cellsToTsv(pipeCells(o)); }
  function pqToDate(s){ const p=pqMonthYear(s); return p&&p.m?new Date(p.y,p.m-1,p.d||1):null; }
  function bddCells(o){
    const row=new Array(91).fill(null);
    const c=o.contrat||'';
    const deptName=(o.dept||'').replace(/^\S+\s+-\s+/,'');
    const kwc=pqNum(o.kwc||''), mwh=pqNum(o.mwh||'');
    const ty=/ombri/i.test(o.particularites||'')?'Ombrière':/toiture/i.test(o.particularites||'')?'Toiture':/sol/i.test(o.particularites||'')?'Sol':'';
    const offre=o.dateOffre?new Date(o.dateOffre+'T00:00:00'):null;
    const or=v=>v===''||v==null?null:v;
    Object.assign(row, {
      1:numCell(o.annee), 2:or(o.charge), 7:codeAffaire(o), 3:dateCell(o.goDate), 4:or(o.origine), 5:or(o.ca), 6:or(o.producteur||o.company),
      8:/OA/.test(c)&&!/CR/.test(c)?'OA':/ACC/.test(c)?'ACC':/PPA/.test(c)?'Marché':c?'CR':null,
      9:/AOS/.test(c)?'AOS CRE':/AO/.test(c)?'AO CRE':null, 10:/PPA/.test(c)?null:(c?'Marché de gros':null),
      17:'France', 18:or(o.region), 19:or(o.dept), 20:or(deptName),
      21:offre?PQ_MONTH_NAMES[offre.getMonth()]:null, 22:dateCell(o.dateOffre), 23:or(o.nature), 24:or(bddStatut(o)),
      25:dateCell(o.signDate), 26:looseDateCell(o.debut), 27:looseDateCell(o.mesEff||o.mesPrev), 28:looseDateCell(o.fin), 30:or(o.particularites),
      31:or(o.spv||o.producteur||o.company), 32:or(o.siret), 33:oppName(o), 34:or(o.dept), 35:or(o.cp), 36:/PV et/.test(o.install||'')?null:or(o.install), 37:or(ty),
      38:kwc||null, 39:kwc&&mwh?Math.round(mwh*1000/kwc):null, 40:mwh||null, 41:o.p90?pqNum(o.p90):null
    });
    // Aggregated volume per year 2026 → 2041, prorated on the contract dates when both are known
    const from=pqToDate(o.debut)||pqToDate(o.mesEff)||pqToDate(o.mesPrev), to=pqToDate(o.fin);
    if(mwh && from && to){
      for(let y=2026;y<=2041;y++){
        const a=Math.max(from, new Date(y,0,1)), b=Math.min(to, new Date(y,11,31));
        if(b>=a){ const frac=((b-a)/86400000+1)/(((y%4===0)?366:365)); row[48+(y-2026)]=Math.round(mwh*frac*10)/10; }
      }
    }
    return row;
  }
  function bddRow(o){ return cellsToTsv(bddCells(o)); }

  // ---------- Local Excel bridge (bridge/pont-excel.ps1 running on the computer) ----------
  // The page calls http://127.0.0.1:<port>; the bridge writes into the synced Excel files through Excel itself.
  let bridgeCfg={ port:8765, token:'' }, bridgeState={ ok:false, authorized:false, checkedAt:0, info:null };
  try{ const r=localStorage.getItem('todo_bridge-config'); if(r) bridgeCfg=Object.assign(bridgeCfg, JSON.parse(r)); }catch(e){}
  function saveBridgeCfg(){ try{ localStorage.setItem('todo_bridge-config', JSON.stringify(bridgeCfg)); }catch(e){} }
  // Writing into the Excel files is for the computer only: on a phone or tablet (phone version, or the full
  // version opened there) the bridge is off whatever is stored — no button, no call, no automatic refresh.
  const ON_PHONE=!!window.TODO_LITE || /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints>1);
  const bridgeConfigured=()=>!ON_PHONE && !!bridgeCfg.token;
  if(ON_PHONE){ document.documentElement.classList.add('no-bridge'); const n=$('bridge-phone-note'); if(n) n.hidden=false; }
  async function bridgeCall(method, path, body, timeoutMs){
    if(ON_PHONE) throw new Error('Le pont Excel ne s\u2019utilise que depuis l\u2019ordinateur.');
    const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(), timeoutMs||8000);
    try{
      const res=await fetch('http://127.0.0.1:'+(bridgeCfg.port||8765)+path, { method, signal:ctl.signal, headers:Object.assign({ 'X-Bridge-Token':bridgeCfg.token||'' }, body?{ 'Content-Type':'application/json' }:{}), body:body?JSON.stringify(body):undefined });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.message||('Erreur '+res.status));
      return data;
    }catch(e){
      if(e.name==='AbortError') throw new Error('Le pont Excel ne répond pas (délai dépassé).');
      if(e instanceof TypeError) throw new Error('Pont Excel introuvable : lance « Lancer-pont-excel.bat » sur l\u2019ordinateur.');
      throw e;
    }finally{ clearTimeout(t); }
  }
  async function bridgeCheck(){
    try{ const s=await bridgeCall('GET','/status',null,2500); bridgeState={ ok:true, authorized:!!s.authorized, checkedAt:Date.now(), info:s }; }
    catch(e){ bridgeState={ ok:false, authorized:false, checkedAt:Date.now(), info:null, error:e.message }; }
    renderBridgeStatus();
    return bridgeState;
  }
  function renderBridgeStatus(){
    const el=$('bridge-status'); if(!el) return;
    const s=bridgeState;
    if(!bridgeConfigured()){ el.textContent='Pas encore configuré sur ce navigateur.'; el.className='bridge-status'; return; }
    if(!s.ok){ el.textContent=s.error||'Pont non détecté.'; el.className='bridge-status off'; return; }
    if(!s.authorized){ el.textContent='Pont détecté, mais la clé ne correspond pas.'; el.className='bridge-status off'; return; }
    el.textContent='Connecté · Pipe : '+(s.info.pipe.found?s.info.pipe.name:'fichier introuvable')+' · BDD : '+(s.info.bdd.found?s.info.bdd.name:'fichier introuvable')
      +(bridgeUpToDate(s.info)?'':' · ⚠ ancienne version du pont : télécharge pont-excel.ps1 ci-dessus, remplace l\u2019ancien fichier et relance le pont');
    el.className='bridge-status '+(bridgeUpToDate(s.info)?'on':'off');
  }
  // ---------- Sending to the shared Excel files: the safe part is written at once, the rest is shown to decide ----------
  // The bridge never overwrites what someone else typed: such cells are kept and reported, duplicates and plants lost
  // recently are asked. What the app wrote last time in each cell (excelPrev) tells « my own value » from « a colleague's »;
  // a value the user chose to keep (excelKeep) is not asked again while it stays the same in the Excel.
  const xlWon=o=>stageIndex(o.stage)>=stageIndex('onboarding');
  function xlRowFor(kind, o, extra){
    const values=(kind==='pipe'?pipeCells:bddCells)(o);
    return Object.assign({ values, prev:(o.excelPrev&&o.excelPrev[kind])||null, keep:(o.excelKeep&&o.excelKeep[kind])||null, won:xlWon(o) }, extra||{});
  }
  function xlRemember(kind, o, values, r){
    if(!r || !r.ok || r.action==='en attente') return;
    o.excelPrev=o.excelPrev||{}; const prev=(o.excelPrev[kind]||[]).slice();
    (r.mine||[]).forEach(i=>{ prev[i]=values[i]; });
    o.excelPrev[kind]=prev; touchCrm(o);
  }
  function xlSummary(kind, results, res){
    const ok=results.filter(r=>r.ok), n=k=>ok.filter(r=>r.action===k).length;
    const kept=ok.reduce((s,r)=>s+((r.conflicts||[]).length),0), asked=n('en attente'), errs=results.filter(r=>!r.ok);
    const pl=(x,a,b)=>x+' '+(x>1?b:a);
    const parts=[n('ajoutée')?pl(n('ajoutée'),'ligne ajoutée','lignes ajoutées'):'', n('mise à jour')?pl(n('mise à jour'),'ligne mise à jour','lignes mises à jour'):'',
      n('aucun changement')?pl(n('aucun changement'),'ligne déjà à jour','lignes déjà à jour'):'', kept?pl(kept,'case gardée (modifiée par quelqu’un d’autre)','cases gardées (modifiées par quelqu’un d’autre)'):'',
      asked?pl(asked,'question','questions'):''].filter(Boolean);
    let msg=(kind==='pipe'?'Pipe':'BDD')+' : '+(parts.join(', ')||'rien à écrire')+'.';
    ok.filter(r=>r.note).forEach(r=>{ msg+=' '+r.note; });
    errs.forEach(r=>{ msg+=' '+(r.key?r.key+' : ':'')+(r.message||'ligne ignorée'); });
    if(res && res.fileWasClosed) msg+=' Le fichier n’était pas ouvert dans Excel : ouvre-le avant d’envoyer pour que tes cases se fusionnent en direct avec celles des collègues.';
    return msg;
  }
  // 1.2 = the bridge that never overwrites a colleague's cell, checks the business code and the line again right before
  // writing, and keeps a journal of every cell; an older one is refused
  const bridgeUpToDate=info=>{ const v=String(info&&info.version||'0').split('.').map(Number); return v[0]>1 || (v[0]===1 && (v[1]||0)>=2); };
  async function xlSend(kind, list, rows){
    if(!bridgeState.info || Date.now()-bridgeState.checkedAt>60000) await bridgeCheck();
    if(bridgeState.ok && !bridgeUpToDate(bridgeState.info)) throw new Error('Ton pont Excel est une ancienne version, moins protégée que la nouvelle : rien n\u2019a été envoyé. Dans Réf. & data → Pont Excel, télécharge pont-excel.ps1, remplace l\u2019ancien fichier et relance le pont.');
    const res=await bridgeCall('POST','/'+kind+'/upsert',{ rows }, 30000);
    const results=res.results||[], pending=[];
    results.forEach((r,i)=>{ const o=list[i]; xlRemember(kind, o, rows[i].values, r); if(r.ok && ((r.conflicts&&r.conflicts.length) || r.question)) pending.push({ o, r }); });
    list.forEach(o=>{ o[kind==='pipe'?'pipeSentAt':'bddSentAt']=Date.now(); touchCrm(o); }); saveCrm();
    return { res, results, pending };
  }
  async function sendToExcel(kind, list, btn){
    if(ON_PHONE) return;
    const label=btn?btn.textContent:'';
    if(btn){ btn.disabled=true; btn.textContent='Envoi…'; }
    try{
      const { res, results, pending }=await xlSend(kind, list, list.map(o=>xlRowFor(kind, o)));
      const msg=xlSummary(kind, results, res);
      if(btn){ btn.textContent=pending.length?'À vérifier':'✓ Envoyé'; btn.title=msg; setTimeout(()=>{ btn.textContent=label; btn.disabled=false; },2500); }
      showBridgeMsg(msg, true);
      if(pending.length) openXlReview(kind, pending);
    }catch(e){
      if(btn){ btn.textContent=label; btn.disabled=false; }
      showBridgeMsg(e.message, false);
    }
  }
  // What was not written: cells changed by someone else (Garder / Remplacer / Fusionner) and questions
  // (duplicate lines, plant lost recently). « Garder » is the default everywhere.
  function openXlReview(kind, pending){
    const box=$('xl-review-body'); box.innerHTML='';
    $('xl-review-title').textContent=(kind==='pipe'?'Pipe Excel':'Suivi Agrégation')+' : à vérifier';
    pending.forEach((p,idx)=>{
      const s=document.createElement('section'); s.className='xr-item';
      const h=document.createElement('h4'); h.textContent=p.r.key; if(p.r.row){ const sp=document.createElement('span'); sp.textContent='ligne '+p.r.row; h.appendChild(sp); } s.appendChild(h);
      if(p.r.question){
        const q=p.r.question, intro=document.createElement('p'); intro.className='xr-intro';
        intro.textContent=q.type==='duplicate'?'Plusieurs lignes ouvertes ont ce producteur et cette centrale. Rien n’a été écrit : laquelle mettre à jour ?'
          :q.type==='other-contract'?'La ligne de cette centrale porte un autre code affaire ('+(q.rows[0]&&q.rows[0].code||'')+' ; l’appli envoie '+(q.code||'')+') : c’est peut-être un autre contrat. Rien n’a été écrit.'
          :'Cette centrale a une ligne close récemment. Rien n’a été écrit : nouvelle ligne ou reprendre l’ancienne ?';
        s.appendChild(intro);
        const desc=r=>[r.statut,r.date,r.code].filter(Boolean).join(' · ');
        const opts=q.type==='duplicate'
          ? [...q.rows.map(r=>[String(r.row),'Ligne '+r.row+(desc(r)?' · '+desc(r):'')]), ['new','Nouvelle ligne'], ['skip','Ne rien écrire']]
          : q.type==='other-contract'
          ? [['new','Nouvelle ligne pour ce contrat (l’autre reste telle quelle)'], ...q.rows.map(r=>[String(r.row),'C’est la même affaire : compléter la ligne '+r.row+' (cases vides seulement, le reste te sera demandé)']), ['skip','Ne rien écrire']]
          : [['new','Nouvelle ligne (l’ancienne reste telle quelle)'], ...q.rows.map(r=>[String(r.row),'Reprendre la ligne '+r.row+' ('+[r.statut,r.date].filter(Boolean).join(', ')+')']), ['skip','Ne rien écrire']];
        const def=q.type==='duplicate'?'skip':'new';
        opts.forEach(([v,l])=>{ const lab=document.createElement('label'); lab.className='xr-opt'; const i=document.createElement('input'); i.type='radio'; i.name='xq-'+idx; i.value=v; i.checked=v===def; lab.append(i, document.createTextNode(' '+l)); s.appendChild(lab); });
      }
      if(p.r.conflicts && p.r.conflicts.length){
        const intro=document.createElement('p'); intro.className='xr-intro'; intro.textContent='Ces cases ont été modifiées dans l’Excel par quelqu’un d’autre ; elles n’ont pas été touchées.'; s.appendChild(intro);
        const t=document.createElement('div'); t.className='xr-table';
        p.r.conflicts.forEach(c=>{
          const r=document.createElement('div'); r.className='xr-row';
          r.innerHTML='<b></b><span class="xr-v"><i>Excel</i><span></span></span><span class="xr-v"><i>Appli</i><span></span></span>';
          r.querySelector('b').textContent=c.header; r.querySelectorAll('.xr-v span')[0].textContent=c.excel; r.querySelectorAll('.xr-v span')[1].textContent=c.app;
          const sel=document.createElement('select'); sel.id='xr-'+idx+'-'+c.i; sel.setAttribute('aria-label','Choix pour '+c.header);
          [['keep','Garder l’Excel'],['replace','Remplacer par l’appli']].concat(c.comment?[['merge','Fusionner les deux']]:[]).forEach(([v,l])=>{ const o=document.createElement('option'); o.value=v; o.textContent=l; sel.appendChild(o); });
          r.appendChild(sel); t.appendChild(r);
        });
        s.appendChild(t);
      }
      box.appendChild(s);
    });
    $('xl-review-apply').onclick=async ()=>{
      const list=[], rows=[];
      pending.forEach((p,idx)=>{
        const force={}, seen={}, o=p.o;
        (p.r.conflicts||[]).forEach(c=>{
          const v=$('xr-'+idx+'-'+c.i).value;
          if(v==='keep'){ o.excelKeep=o.excelKeep||{}; o.excelKeep[kind]=Object.assign({}, o.excelKeep[kind]||{}, { [c.i]:c.excel }); touchCrm(o); }
          else { force[c.i]=v; seen[c.i]=c.excel; }   // the bridge replaces only if the cell still holds what was shown here
        });
        let target=null;
        if(p.r.question){ const ch=document.querySelector('input[name="xq-'+idx+'"]:checked'); const v=ch?ch.value:'skip'; if(v==='skip') return; target=v==='new'?'new':+v; }
        else if(!Object.keys(force).length) return;
        list.push(o); rows.push(xlRowFor(kind, o, Object.assign({ force, seen }, target!=null?{ target }:{}, p.r.row && !p.r.question?{ target:p.r.row }:{})));
      });
      saveCrm(); closeXlReview();
      if(!rows.length){ showBridgeMsg('Rien de plus à écrire : l’Excel garde ses valeurs.', true); return; }
      try{
        const { res, results, pending:again }=await xlSend(kind, list, rows);
        showBridgeMsg(xlSummary(kind, results, res), true);
        if(again.length) openXlReview(kind, again);
      }catch(e){ showBridgeMsg(e.message, false); }
    };
    $('xl-review-overlay').classList.remove('hidden');
  }
  function closeXlReview(){ $('xl-review-overlay').classList.add('hidden'); }
  $('xl-review-later').onclick=closeXlReview;
  $('xl-review-overlay').addEventListener('click', e=>{ if(e.target.id==='xl-review-overlay') closeXlReview(); });
  function showBridgeMsg(msg, ok){
    let el=$('bridge-msg');
    if(!el){ el=document.createElement('div'); el.id='bridge-msg'; el.setAttribute('role','status'); document.body.appendChild(el); }
    el.textContent=msg; el.className='bridge-msg show'+(ok?'':' err');
    clearTimeout(el._t); el._t=setTimeout(()=>{ el.className='bridge-msg'; }, ok?3500:7000);
  }
  // Buttons added to the installation sheet / pricing request when the bridge is set up on this browser
  function excelButtons(actions, list){
    if(!bridgeConfigured()) return;
    if(!ON_PHONE) actions.appendChild(oppActionBtn(list.length>1?'Envoyer au Pipe Excel ('+list.length+')':'Envoyer au Pipe Excel', e=>sendToExcel('pipe', list, e.target)));
    if(!ON_PHONE && list.some(o=>o.goDate || stageIndex(o.stage)>=stageIndex('demande_prix'))) actions.appendChild(oppActionBtn(list.length>1?'Envoyer à la BDD Excel ('+list.length+')':'Envoyer à la BDD Excel', e=>sendToExcel('bdd', list.filter(o=>o.goDate || stageIndex(o.stage)>=stageIndex('demande_prix')), e.target)));
  }

  function renderLists(){
    renderStorageGauge();
    renderClientList();
    projectChipRow.innerHTML='';
    if(!projectsList.length){ const p=document.createElement('p'); p.className='list-empty'; p.textContent='Aucun projet.'; projectChipRow.appendChild(p); }
    else projectsList.slice().sort().forEach(n=>projectChipRow.appendChild(makeManageChip(n,projectColor(n),countFor(n,'project'),()=>removeProject(n),()=>renameProject(n))));
  }

  function renderClientList(){
    const container=$('client-list-rows');
    const q=($('client-list-search').value||'').trim().toLowerCase();
    container.innerHTML='';
    let list=clientsList.slice().sort((a,b)=>a.localeCompare(b));
    if(q) list=list.filter(n=>n.toLowerCase().includes(q));
    if(!list.length){ const p=document.createElement('p'); p.className='list-empty'; p.textContent=q?'Aucun résultat.':'Aucun client.'; container.appendChild(p); return; }
    const typeOf=n=>{ const co=companies.find(x=>x.name===n && !x.deleted); return (co&&co.type)||''; };
    const groups={};
    list.forEach(n=>{ const t=typeOf(n); (groups[t]=groups[t]||[]).push(n); });
    const order=companyTypesList.filter(t=>groups[t]).concat(Object.keys(groups).filter(t=>t && !companyTypesList.includes(t)).sort((a,b)=>a.localeCompare(b))).concat(groups['']?['']:[]);
    let open=[]; try{ open=JSON.parse(localStorage.getItem('reflists-open-types')||'[]'); }catch(e){}
    order.forEach(t=>{
      const isOpen=!!q || open.includes(t);
      const head=document.createElement('button'); head.type='button'; head.className='client-type-head';
      head.setAttribute('aria-expanded', isOpen?'true':'false');
      head.innerHTML='<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
      const lbl=document.createElement('span'); lbl.textContent=t||'Sans type'; head.appendChild(lbl);
      const cnt=document.createElement('span'); cnt.className='n'; cnt.textContent='· '+groups[t].length; head.appendChild(cnt);
      const body=document.createElement('div'); body.className='client-type-body'+(isOpen?'':' hidden');
      groups[t].forEach(n=>body.appendChild(buildClientListRow(n)));
      head.onclick=()=>{
        const nowOpen=head.getAttribute('aria-expanded')!=='true';
        head.setAttribute('aria-expanded', nowOpen?'true':'false'); body.classList.toggle('hidden', !nowOpen);
        if(q) return;
        let o=[]; try{ o=JSON.parse(localStorage.getItem('reflists-open-types')||'[]'); }catch(e){}
        o=o.filter(x=>x!==t); if(nowOpen) o.push(t);
        try{ localStorage.setItem('reflists-open-types', JSON.stringify(o)); }catch(e){}
      };
      container.appendChild(head); container.appendChild(body);
    });
  }

  function buildClientListRow(name){
    const row=document.createElement('div'); row.className='client-list-row';
    const hex=clientColor(name);
    const dot=document.createElement('span'); dot.className='dot'; dot.style.background=hex;
    row.appendChild(dot);
    const label=document.createElement('span'); label.className='name'; label.textContent=name;
    row.appendChild(label);
    const count=countFor(name,'client');
    if(count){ const c=document.createElement('span'); c.className='count'; c.textContent=count; row.appendChild(c); }

    const co=companies.find(x=>x.name===name);
    const typeTag=document.createElement('span'); typeTag.className='type-tag';
    typeTag.textContent = co&&co.type ? co.type : '+ Type';
    typeTag.onclick=e=>openCompanyTypePopover(e, name);
    row.appendChild(typeTag);

    const actions=document.createElement('div'); actions.className='row-actions';
    const editBtn=document.createElement('button'); editBtn.title='Renommer';
    editBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>';
    editBtn.onclick=()=>renameClient(name);
    actions.appendChild(editBtn);
    const delBtn=document.createElement('button'); delBtn.title='Supprimer';
    delBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" style="width:13px;height:13px;"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    delBtn.onclick=()=>removeClient(name);
    actions.appendChild(delBtn);
    row.appendChild(actions);

    return row;
  }

  function makeManageChip(name,hex,count,onDelete,onRename){
    const chip=document.createElement('span'); chip.className='manage-chip';
    chip.style.color=hex; chip.style.background=hex+'22'; chip.style.border='1px solid '+hex+'55';
    const label=document.createElement('span'); label.textContent=name; chip.appendChild(label);
    if(count){ const c=document.createElement('span'); c.className='chip-count'; c.textContent=count; chip.appendChild(c); }
    const editBtn=document.createElement('button'); editBtn.title='Renommer';
    editBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>';
    editBtn.onclick=onRename; chip.appendChild(editBtn);
    const delBtn=document.createElement('button'); delBtn.title='Supprimer'; delBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'; delBtn.onclick=onDelete; chip.appendChild(delBtn);
    return chip;
  }

  function addClientToList(n){ n=n.trim(); if(!n||findExistingCI(clientsList,n))return; clientsList.push(n); saveClients(); render(); renderLists(); }
  function addProjectToList(n){ n=n.trim(); if(!n||findExistingCI(projectsList,n))return; projectsList.push(n); saveProjects(); render(); renderLists(); }
  function removeClient(n){
    const affected=tasks.filter(t=>t.client===n);
    const affectedContacts=contacts.filter(c=>c.company===n && !c.deleted);
    const total=affected.length+affectedContacts.length;
    if(total>0){
      if(!confirm('Retirer "'+n+'" de '+affected.length+' tâche(s) et '+affectedContacts.length+' contact(s) qui l\'utilisent ?')) return;
      affected.forEach(t=>{ t.client=''; touch(t); });
      if(affected.length) saveTasks();
      affectedContacts.forEach(c=>{ c.company=''; touchCrm(c); });
    }
    const co=companies.find(x=>x.name===n);
    if(co){ co.deleted=true; touchCrm(co); }
    if(affectedContacts.length || co) saveCrm();
    clientsList=clientsList.filter(c=>c!==n); saveClients(); render(); renderLists();
  }
  function removeProject(n){
    const affected=tasks.filter(t=>t.project===n);
    if(affected.length>0){
      if(!confirm('Retirer "'+n+'" de '+affected.length+' tâche(s) qui l\'utilisent ?')) return;
      affected.forEach(t=>{ t.project=''; touch(t); });
      saveTasks();
    }
    projectsList=projectsList.filter(p=>p!==n); saveProjects(); render(); renderLists();
  }
  // the pipeline follows the client too (company, and the Pipe « Nom Producteur » when it was the same name)
  function renameOppCompany(oldName, newName){
    opportunities.forEach(o=>{
      let ch=false;
      if(o.company===oldName){ o.company=newName; ch=true; }
      if(o.producteur===oldName){ o.producteur=newName; ch=true; }
      if(ch) touchCrm(o);
    });
  }
  function renameClient(oldName){
    const newName=prompt('Renommer "'+oldName+'" en :', oldName);
    if(newName===null) return;
    const trimmed=newName.trim();
    if(!trimmed||trimmed===oldName) return;
    const existing=findExistingCI(clientsList, trimmed);
    if(existing && existing!==oldName){
      const affected=tasks.filter(t=>t.client===oldName).length;
      const affectedContacts=contacts.filter(c=>c.company===oldName && !c.deleted).length;
      const affectedOpps=opportunities.filter(o=>!o.deleted && (o.company===oldName || o.producteur===oldName)).length;
      if(!confirm('"'+existing+'" existe déjà. Fusionner "'+oldName+'" dedans ? ('+affected+' tâche(s), '+affectedContacts+' contact(s) et '+affectedOpps+' opportunité(s) transférés, le doublon disparaît)')) return;
      tasks.forEach(t=>{ if(t.client===oldName){ t.client=existing; touch(t); } });
      contacts.forEach(c=>{ if(c.company===oldName){ c.company=existing; touchCrm(c); } });
      renameOppCompany(oldName, existing);
      const dupCo=companies.find(x=>x.name===oldName);
      if(dupCo){ dupCo.deleted=true; touchCrm(dupCo); }
      clientsList=clientsList.filter(c=>c!==oldName);
      rewriteLinks(oldName, existing);
      saveClients(); saveTasks(); saveCrm(); render(); renderLists();
      return;
    }
    clientsList=clientsList.map(c=>c===oldName?trimmed:c);
    tasks.forEach(t=>{ if(t.client===oldName){ t.client=trimmed; touch(t); } });
    contacts.forEach(c=>{ if(c.company===oldName){ c.company=trimmed; touchCrm(c); } });
    renameOppCompany(oldName, trimmed);
    const co=companies.find(x=>x.name===oldName);
    if(co){ co.name=trimmed; touchCrm(co); }
    rewriteLinks(oldName, trimmed);
    saveClients(); saveTasks(); saveCrm(); render(); renderLists();
  }
  function renameProject(oldName){
    const newName=prompt('Renommer "'+oldName+'" en :', oldName);
    if(newName===null) return;
    const trimmed=newName.trim();
    if(!trimmed||trimmed===oldName) return;
    const existing=findExistingCI(projectsList, trimmed);
    if(existing && existing!==oldName){
      const affected=tasks.filter(t=>t.project===oldName).length;
      if(!confirm('"'+existing+'" existe déjà. Fusionner "'+oldName+'" dedans ? ('+affected+' tâche(s) transférées, le doublon disparaît)')) return;
      tasks.forEach(t=>{ if(t.project===oldName){ t.project=existing; touch(t); } });
      projectsList=projectsList.filter(p=>p!==oldName);
      saveProjects(); saveTasks(); render(); renderLists();
      return;
    }
    projectsList=projectsList.map(p=>p===oldName?trimmed:p);
    tasks.forEach(t=>{ if(t.project===oldName){ t.project=trimmed; touch(t); } });
    saveProjects(); saveTasks(); render(); renderLists();
  }

  function updateBadge(){
    const open=activeTasks();
    if(badge){
      if(!open.length){ badge.classList.add('hidden'); } else { badge.classList.remove('hidden'); badge.textContent=open.length; badge.classList.toggle('overdue',open.some(t=>dueStatus(t.due)==='overdue')); }
    }
    if(headStats) headStats.textContent=open.length;
  }

  // monthly: the same day of the month, kept even after a shorter month (31 jan → 28/29 feb → 31 mar)
  function nextRecurDate(dateStr,freq,anchorDay){
    const d=new Date(dateStr+'T00:00:00');
    if(freq==='mensuel'){ const day=anchorDay||d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+1); const last=new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); d.setDate(Math.min(day,last)); }
    else if(freq==='hebdo') d.setDate(d.getDate()+7);
    else d.setDate(d.getDate()+1);
    return toISO(d);
  }
  function validateTask(id){
    const t=tasks.find(x=>x.id===id); if(!t)return;
    if(t.recur){
      const today=toISO(new Date()), base=t.due||today;
      if(t.recur.freq==='mensuel' && !t.recur.day) t.recur.day=new Date(base+'T00:00:00').getDate();
      let nd=nextRecurDate(base,t.recur.freq,t.recur.day);
      if(base<today){ let guard=0; while(nd<=today && guard++<400) nd=nextRecurDate(nd,t.recur.freq,t.recur.day); }   // done late: the next one comes after today
      const within=!t.recur.until || nd<=t.recur.until;
      if(within){ t.due=nd; if(t.subtasks) t.subtasks.forEach(s=>s.done=false); t.status='a_faire'; touch(t); saveTasks(); render(); return; }
    }
    t.archived=true; t.archivedAt=Date.now(); touch(t); saveTasks(); render(); renderArchive();
    if(typeof maybeOfferStageAdvance==='function') maybeOfferStageAdvance(t);
  }
  function untrashTask(id){ const t=tasks.find(x=>x.id===id); if(t){ t.deleted=false; touch(t); saveTasks(); render(); renderArchive(); } }
  function restoreTask(id){ const t=tasks.find(x=>x.id===id); if(t){ t.archived=false; t.archivedAt=null; t.status='a_faire'; touch(t); saveTasks(); render(); renderArchive(); } }
  function cycleStatus(id){ const t=tasks.find(x=>x.id===id); if(t){ const i=STATUS_CYCLE.indexOf(t.status); t.status=STATUS_CYCLE[(i+1)%STATUS_CYCLE.length]; touch(t); saveTasks(); render(); } }
  function toggleSubtasksExpanded(id){ if(expandedSubtaskIds.has(id)) expandedSubtaskIds.delete(id); else expandedSubtaskIds.add(id); render(); }
  function deleteTask(id){
    const t=tasks.find(x=>x.id===id);
    if(!t) return;
    if(!confirm('Supprimer "'+plainLinks(t.title)+'" ? (récupérable ensuite dans Archive → Corbeille)')) return;
    t.deleted=true; touch(t);
    if(selectedTaskId===id)selectedTaskId=null; if(editingId===id)editingId=null;
    saveTasks(); render(); renderArchive();
  }

  function findExistingCI(list, name){
    if(!name) return null;
    const lower=name.toLowerCase();
    return list.find(x=>x.toLowerCase()===lower) || null;
  }

  function createTask(f){
    const task={ id:'task_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), title:f.title, description:f.description||'', client:f.client||'', project:f.project||'', urgency:f.urgency||'moyenne', status:f.status||'a_faire', due:f.due||'', reminder:f.reminder||'', link:f.link||'', recur:f.recur||null, subtasks:[], archived:false, archivedAt:null, deleted:false, createdAt:Date.now(), updatedAt:Date.now() };
    if(task.client){
      const existing=findExistingCI(clientsList, task.client);
      if(existing){ task.client=existing; } else { clientsList.push(task.client); saveClients(); }
    }
    if(task.project){
      const existing=findExistingCI(projectsList, task.project);
      if(existing){ task.project=existing; } else { projectsList.push(task.project); saveProjects(); }
    }
    tasks.push(task);
    saveTasks();
    if(task.reminder&&'Notification'in window&&Notification.permission==='default'){ Notification.requestPermission(); }
    return task;
  }
  function addTask(){
    const title=$('f-title').value.trim(); if(!title)return;
    let recur=null, due=$('f-due').value;
    if(recurRow.style.display==='flex'){
      const freq=$('f-recur-freq').value, start=$('f-recur-start').value, until=$('f-recur-end').value;
      if(start){ recur={freq,until:until||null}; due=start; }
    }
    createTask({ title, description:$('f-description').value.trim(), client:clientInput.value.trim(), project:projectInput.value.trim(), urgency:$('f-urgency').value, status:$('f-status').value, reminder:$('f-reminder').value, link:$('f-link').value.trim(), due, recur });
    render(); renderLists(); closeAddForm();
  }
  // the note stays in view (that is its point): if it would cover the form's buttons, the buttons make room beside it
  function fitFormButtons(){
    const row=cancelTaskBtn.parentElement; row.style.marginRight='';
    if(!addSection.classList.contains('open') || !postitEl || postitEl.classList.contains('hidden')) return;
    const a=row.getBoundingClientRect(), b=postitEl.getBoundingClientRect();
    if(a.bottom>b.top && a.top<b.bottom && a.right>b.left && a.left<b.right) row.style.marginRight=Math.min(a.width-160, a.right-b.left+12)+'px';
  }
  function openAddForm(){ addSection.classList.add('open'); $('f-title').focus(); fitFormButtons(); }
  function closeAddForm(){ addSection.classList.remove('open'); resetAddForm(); cancelTaskBtn.parentElement.style.marginRight=''; }
  window.addEventListener('resize', fitFormButtons);
  function quickAdd(){
    const title=quickAddInput.value.trim(); if(!title) return;
    createTask({ title, urgency:'moyenne', status:'a_faire' });
    quickAddInput.value='';
    render(); renderLists();
  }
  function resetAddForm(){
    ['f-title','f-description','f-due','f-reminder','f-link','f-recur-start','f-recur-end'].forEach(id=>$(id).value='');
    clientInput.value=''; projectInput.value=''; clientDot.style.background='var(--bd)'; projectDot.style.background='var(--bd)';
    $('f-urgency').value='moyenne'; $('f-status').value='a_faire'; $('f-recur-freq').value='hebdo';
    reminderRow.style.display='none'; recurRow.style.display='none';
  }

  // Reminders already shown are remembered on this device (id + reminder time), so reopening the app
  // doesn't fire every past reminder again; a reminder more than a day late is skipped.
  try{ JSON.parse(localStorage.getItem('todo_reminders-notified')||'[]').forEach(k=>notifiedIds.add(k)); }catch(e){}
  function checkReminders(){
    const now=Date.now(); let changed=false;
    tasks.forEach(t=>{
      if(!t.reminder || t.archived || t.deleted) return;
      const key=t.id+'@'+t.reminder, at=new Date(t.reminder).getTime();
      if(notifiedIds.has(key) || isNaN(at) || at>now) return;
      notifiedIds.add(key); changed=true;
      if(now-at>86400000) return;
      if('Notification'in window&&Notification.permission==='granted'){ new Notification('Rappel : '+plainLinks(t.title),{body:[t.client,t.project].filter(Boolean).join(' · ')||'Échéance à venir'}); }
    });
    if(changed){ try{ localStorage.setItem('todo_reminders-notified', JSON.stringify([...notifiedIds].slice(-500))); }catch(e){} }
  }

  function openSnoozePopover(e,id){
    e.stopPropagation(); currentSnoozeId=id;
    const r=e.currentTarget.getBoundingClientRect(); snoozePopover.style.display='flex';
    snoozePopover.style.top=Math.min(r.bottom+4,window.innerHeight-260)+'px';
    snoozePopover.style.left=Math.max(8,Math.min(r.left-100,window.innerWidth-216))+'px';

    const t=tasks.find(x=>x.id===id);
    const curEl=document.getElementById('snooze-current');
    curEl.textContent = t && t.due ? ('Échéance actuelle : '+fmtDateShort(t.due)) : 'Pas d\u2019échéance';

    const today=new Date();
    const base = (t && t.due) ? new Date(t.due+'T00:00:00') : new Date();
    const hints={
      abs0: today,
      abs1: (()=>{ const d=new Date(today); d.setDate(d.getDate()+1); return d; })(),
      rel3: (()=>{ const d=new Date(base); d.setDate(d.getDate()+3); return d; })(),
      rel7: (()=>{ const d=new Date(base); d.setDate(d.getDate()+7); return d; })()
    };
    snoozePopover.querySelectorAll('[data-hint]').forEach(el=>{
      el.textContent = fmtDateShort(toISO(hints[el.dataset.hint]));
    });
  }
  function closeSnoozePopover(){ snoozePopover.style.display='none'; currentSnoozeId=null; }
  function applySnoozeDays(days){
    if(!currentSnoozeId)return; const t=tasks.find(x=>x.id===currentSnoozeId);
    if(t){ const base=t.due?new Date(t.due+'T00:00:00'):new Date(); base.setDate(base.getDate()+days); t.due=toISO(base); touch(t); saveTasks(); render(); }
    closeSnoozePopover();
  }
  function applySnoozeAbsolute(daysFromToday){
    if(!currentSnoozeId)return; const t=tasks.find(x=>x.id===currentSnoozeId);
    if(t){ const d=new Date(); d.setDate(d.getDate()+daysFromToday); t.due=toISO(d); touch(t); saveTasks(); render(); }
    closeSnoozePopover();
  }
  function clearSnoozeDate(){
    if(!currentSnoozeId)return; const t=tasks.find(x=>x.id===currentSnoozeId);
    if(t){ t.due=''; touch(t); saveTasks(); render(); }
    closeSnoozePopover();
  }

  function moveSelection(dir){
    const rows=Array.from(taskList.querySelectorAll('.task:not(.editing)')); if(!rows.length)return;
    let i=rows.findIndex(r=>r.dataset.id===selectedTaskId);
    i=i===-1?(dir>0?0:rows.length-1):Math.min(rows.length-1,Math.max(0,i+dir));
    selectedTaskId=rows[i].dataset.id; rows.forEach(r=>r.classList.toggle('selected',r.dataset.id===selectedTaskId)); rows[i].scrollIntoView({block:'nearest'});
  }

  // export / import
  function exportData(){
    const payload={ version:2, exportedAt:new Date().toISOString(), tasks, clients:clientsList, projects:projectsList, notes, crm:{ companies, contacts, meetings, opportunities, companyTypes:companyTypesList } };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='todo-backup-'+toISO(new Date())+'.json'; a.click();
    try{ localStorage.setItem('last-export-at', String(Date.now())); }catch(e){}
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function importData(file){
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const data=JSON.parse(e.target.result);
        if(!data||!Array.isArray(data.tasks)) throw new Error('format');
        const extra=[data.crm?'les contacts/CRM':null, Array.isArray(data.notes)?'le calepin':null].filter(Boolean);
        if(!confirm('Remplacer les '+tasks.length+' tâche(s) actuelles par les '+data.tasks.length+' du fichier'+(extra.length?(' (ainsi que '+extra.join(' et ')+')'):'')+' ?')) return;
        tasks=data.tasks; clientsList=data.clients||[]; projectsList=data.projects||[];
        tasks.forEach(t=>{ if(t.subtasks===undefined)t.subtasks=[]; if(t.recur===undefined)t.recur=null; if(t.archived===undefined)t.archived=false; });
        saveTasks(); saveClients(); saveProjects(); render(); renderArchive(); renderLists();
        if(Array.isArray(data.notes)){ notes=data.notes; consolidateNotes(); saveNotes(); renderNotes(); }
        if(data.crm){
          companies=data.crm.companies||[]; contacts=data.crm.contacts||[]; meetings=data.crm.meetings||[]; opportunities=data.crm.opportunities||[];
          if(Array.isArray(data.crm.companyTypes)&&data.crm.companyTypes.length) companyTypesList=data.crm.companyTypes;
          saveCrm(); if(typeof renderContacts==='function') renderContacts(); if(typeof renderPipeline==='function') renderPipeline();
        }
      }catch(err){ alert('Fichier invalide.'); }
    };
    reader.readAsText(file);
  }

  const tabContacts=$('tab-contacts'), tabPipeline=$('tab-pipeline'), tabParc=$('tab-parc');
  tabs.forEach(el=>{ el.onclick=()=>{ tabs.forEach(t=>t.classList.remove('active')); el.classList.add('active'); const tgt=el.dataset.tab; tabToday.classList.toggle('hidden',tgt!=='today'); tabTasks.classList.toggle('hidden',tgt!=='tasks'); tabInbox.classList.toggle('hidden',tgt!=='inbox'); tabArchive.classList.toggle('hidden',tgt!=='archive'); tabLists.classList.toggle('hidden',tgt!=='lists'); tabContacts.classList.toggle('hidden',tgt!=='contacts'); tabPipeline.classList.toggle('hidden',tgt!=='pipeline'); tabParc.classList.toggle('hidden',tgt!=='parc'); $('tab-network').classList.toggle('hidden',tgt!=='network'); if(tgt==='network') showNetwork(); if(tgt==='parc'){ renderParc(); $('parc-bridge-btn').classList.toggle('hidden', !bridgeConfigured()); renderParcSource(); if(bridgeConfigured() && parcSource().auto && (!parcData || Date.now()-(parcData.importedAt||0)>600000)) importParcFromBridge(true); } if(tgt==='today')renderToday(); if(tgt==='archive')renderArchive(); if(tgt==='contacts'){ refreshContactsTypeFilter(); renderContacts(); fetchContactInbox(); } if(tgt==='pipeline')renderPipeline(); if(tgt==='lists'){ if(bridgeConfigured()) bridgeCheck(); else renderBridgeStatus(); renderLists(); renderStats(); renderConflicts(); $('sync-owner').value=syncConfig.owner||''; $('sync-repo').value=syncConfig.repo||''; if(syncConfig.enabled) setSyncStatus('Synchro active'); } if(tgt==='inbox')fetchInbox(); }; });

  $('submit-task').onclick=addTask;
  addSection.addEventListener('keydown', e=>{ if(e.key==='Enter' && e.target.tagName!=='TEXTAREA'){ e.preventDefault(); addTask(); } });
  quickAddInput.addEventListener('keydown', e=>{ if(e.key==='Enter') quickAdd(); });
  quickAddMore.onclick=()=>{ openAddForm(); if(quickAddInput.value.trim()){ $('f-title').value=quickAddInput.value.trim(); quickAddInput.value=''; } };
  cancelTaskBtn.onclick=closeAddForm;
  clientInput.addEventListener('input',()=>{ clientDot.style.background=clientInput.value.trim()?clientColor(clientInput.value.trim()):'var(--bd)'; });
  projectInput.addEventListener('input',()=>{ projectDot.style.background=projectInput.value.trim()?projectColor(projectInput.value.trim()):'var(--bd)'; });

  function setupCombo(inputEl, dotEl, dropdownEl, getList, colorFn, onDelete){
    function renderDropdown(){
      const q=inputEl.value.trim().toLowerCase();
      const items=getList().slice().sort().filter(n=>n.toLowerCase().includes(q));
      dropdownEl.innerHTML='';
      if(items.length===0){
        const e=document.createElement('div'); e.className='combo-empty'; e.textContent=q?'Aucun résultat — tape pour créer':'Aucun enregistré — tape pour créer';
        dropdownEl.appendChild(e);
      } else {
        items.forEach(name=>{
          const row=document.createElement('div'); row.className='combo-item';
          const dot=document.createElement('span'); dot.className='combo-item-dot'; dot.style.background=colorFn(name);
          const label=document.createElement('span'); label.className='combo-item-label'; label.textContent=name;
          row.appendChild(dot); row.appendChild(label);
          row.onclick=()=>{ inputEl.value=name; dotEl.style.background=colorFn(name); dropdownEl.classList.remove('open'); };
          const del=document.createElement('button'); del.className='combo-item-del'; del.type='button'; del.title='Supprimer de la liste';
          del.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
          del.onclick=(e)=>{ e.stopPropagation(); onDelete(name); renderDropdown(); };
          row.appendChild(del);
          dropdownEl.appendChild(row);
        });
      }
    }
    inputEl.addEventListener('focus', ()=>{ renderDropdown(); dropdownEl.classList.add('open'); });
    inputEl.addEventListener('input', renderDropdown);
    document.addEventListener('click', (e)=>{ if(!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) dropdownEl.classList.remove('open'); });
  }
  setupCombo(clientInput, clientDot, $('client-dropdown'), ()=>clientsList, clientColor, removeClient);
  setupCombo(projectInput, projectDot, $('project-dropdown'), ()=>projectsList, projectColor, removeProject);
  ['f-due','f-reminder','prequal-due','stage-due'].forEach(id=>quickDates($(id)));
  reminderToggle.onclick=()=>{ const o=reminderRow.style.display==='flex'; reminderRow.style.display=o?'none':'flex'; if(!o)$('f-reminder').focus(); };
  recurToggle.onclick=()=>{ recurRow.style.display=recurRow.style.display==='flex'?'none':'flex'; };

  let searchTimer=null;   // a short pause between keys before the list is drawn again
  searchInput.addEventListener('input',()=>{ searchQuery=searchInput.value.trim(); searchClear.classList.toggle('show',!!searchQuery); clearTimeout(searchTimer); searchTimer=setTimeout(render, activeTasks().length>300?140:0); });
  searchClear.onclick=()=>{ searchInput.value=''; searchQuery=''; searchClear.classList.remove('show'); render(); searchInput.focus(); };

  filters.addEventListener('click',e=>{ const c=e.target.closest('.filter-chip'); if(!c)return; filters.querySelectorAll('.filter-chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); currentFilter=c.dataset.filter; render(); });
  viewSwitch.addEventListener('click',e=>{ const b=e.target.closest('.view-icon-btn'); if(!b)return; viewSwitch.querySelectorAll('.view-icon-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentView=b.dataset.view; render(); });
  tableHeader.addEventListener('click',e=>{
    const col=e.target.closest('.th-col'); if(!col)return;
    const field=col.dataset.sort;
    if(tableSort.field===field){ tableSort.dir=tableSort.dir==='asc'?'desc':'asc'; }
    else{ tableSort.field=field; tableSort.dir='asc'; }
    render();
  });

  $('add-client-btn').onclick=()=>{ const i=$('new-client-input'); addClientToList(i.value); i.value=''; i.focus(); };
  $('new-client-input').addEventListener('keydown',e=>{ if(e.key==='Enter')$('add-client-btn').click(); });
  $('client-list-search').addEventListener('input', ()=>{ $('client-list-search-clear').classList.toggle('show', !!$('client-list-search').value); renderClientList(); });
  $('client-list-search-clear').onclick=()=>{ $('client-list-search').value=''; $('client-list-search-clear').classList.remove('show'); renderClientList(); };
  $('add-project-btn').onclick=()=>{ const i=$('new-project-input'); addProjectToList(i.value); i.value=''; i.focus(); };
  $('new-project-input').addEventListener('keydown',e=>{ if(e.key==='Enter')$('add-project-btn').click(); });

  $('sync-save-btn').onclick=async ()=>{
    syncConfig.owner=$('sync-owner').value.trim();
    syncConfig.repo=$('sync-repo').value.trim();
    const tokenVal=$('sync-token').value.trim();
    if(tokenVal) syncConfig.token=tokenVal;
    syncConfig.tokenExpires=$('sync-token-exp').value||'';
    if(!syncConfig.owner || !syncConfig.repo || !syncConfig.token){ setSyncStatus('Pseudo, repo et token requis.'); return; }
    setSyncStatus('Vérification du repo…');
    try{
      const infoRes=await fetch('https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo, { headers:{ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json' } });
      if(!infoRes.ok){ setSyncStatus('Repo introuvable ou token invalide (vérifie pseudo/repo/token).'); return; }
      const info=await infoRes.json();
      if(info.private===false){
        const proceed=confirm('⚠️ Ce repo GitHub est PUBLIC.\n\nActiver la synchro va y publier tes tâches et tes données CRM (contacts, emails, téléphones, opportunités) en clair — lisibles par n’importe qui sur Internet, même après suppression (historique git).\n\nPasse le repo en privé sur GitHub avant de continuer si ces données sont sensibles.\n\nActiver quand même la synchro sur ce repo public ?');
        if(!proceed){ setSyncStatus('Synchro non activée (repo public).'); return; }
      }
    }catch(e){ setSyncStatus('Impossible de vérifier le repo (réseau). Réessaie.'); return; }
    syncConfig.enabled=true;
    await saveSyncConfig();
    setSyncStatus('Activation…');
    repoPrivate=null; syncPull(); syncPullCrm(); syncPullNotes(); syncPullParc();
  };
  $('sync-token-exp').addEventListener('change', ()=>{ syncConfig.tokenExpires=$('sync-token-exp').value||''; saveSyncConfig(); paintSyncPill(); });
  $('sync-now-btn').onclick=()=>{ if(!syncConfig.enabled){ setSyncStatus('Active la synchro d\u2019abord.'); return; } setSyncStatus('Synchronisation…'); syncPushNow(); syncPushCrmNow(); syncPushNotesNow(); };
  $('contact-add-btn').onclick=()=>openContactForm(null);
  let sigImageFile=null;
  let tesseractLoaded=false;

  function loadTesseract(){
    if(tesseractLoaded) return Promise.resolve();
    return new Promise((resolve, reject)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js';
      s.onload=()=>{ tesseractLoaded=true; resolve(); };
      s.onerror=()=>reject(new Error('Tesseract failed to load'));
      document.head.appendChild(s);
    });
  }

  let xlsxLoaded=false;
  function loadXlsx(){
    if(xlsxLoaded) return Promise.resolve();
    return new Promise((resolve, reject)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload=()=>{ xlsxLoaded=true; resolve(); };
      s.onerror=()=>reject(new Error('XLSX failed to load'));
      document.head.appendChild(s);
    });
  }

  function pickHeader(row, candidates){
    const keys=Object.keys(row);
    for(const cand of candidates){
      const found=keys.find(k=>k.replace(/\s+/g,' ').trim().toLowerCase()===cand);
      if(found && row[found]!=null && String(row[found]).trim()!=='') return String(row[found]).trim();
    }
    return '';
  }

  function ciEq(a,b){ return (a||'').toString().trim().toLowerCase() === (b||'').toString().trim().toLowerCase(); }

  async function importContactsExcel(file){
    await loadXlsx();
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf, { type:'array' });
    const sheet=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet, { defval:'' });

    function fillOrConflict(entity, field, newVal, entityType){
      if(!newVal) return false;
      const cur=entity[field];
      if(!cur){ entity[field]=newVal; return false; }
      if(!ciEq(String(cur), String(newVal))){ logConflict(entityType, entity, field, cur, newVal, cur, importSrc); return true; }
      return false;
    }

    let added=0, updated=0, conflictCount=0;
    let importSrc=null;   // where the two values of a conflict come from (shown in Réf. & data)
    rows.forEach((row, idx)=>{
      importSrc={ a:'Déjà dans tes contacts', b:'Dans le fichier « '+file.name+' », ligne '+(idx+2) };
      const firstName=pickHeader(row, ['first name','prénom','prenom']);
      const lastName=pickHeader(row, ['last name','nom']);
      if(!firstName && !lastName) return;
      const role=pickHeader(row, ['role','rôle','fonction']);
      let company=pickHeader(row, ['company','société','societe','entreprise']);
      const email=pickHeader(row, ['email','e-mail','mail']);
      const phone1=pickHeader(row, ['contact number 1','contact number\n1','contact number','phone','téléphone','telephone']);
      const phone2=pickHeader(row, ['contact number 2','contact number\n2']);
      const relevanceRaw=pickHeader(row, ['relevance (1-5)','relevance \n(1-5)','relevance','pertinence']);
      const relevance=parseInt(relevanceRaw,10)||0;
      const whatTheyDo=pickHeader(row, ['what they do','activité','activite']);
      const website=pickHeader(row, ['link','website','site web','lien']);
      const countryRaw=pickHeader(row, ['country','pays','périmètre','perimetre']);
      const meetingLabel=pickHeader(row, ['meetings & opportunities','meetings','rencontre']);
      const comment=pickHeader(row, ['comment','commentaire','notes','note']);

      if(company){
        const existingName=findExistingCI(clientsList, company);
        company=existingName||company;
        if(!existingName){ clientsList.push(company); }
      }

      // Duplicate detection: match by email first (most reliable), else by
      // first+last name and company together. A match means "complete this
      // existing contact", not "create a new one".
      let match=null;
      if(email){ match=contacts.find(x=>!x.deleted && ciEq(x.email,email)); }
      if(!match){ match=contacts.find(x=>!x.deleted && ciEq(x.firstName,firstName) && ciEq(x.lastName,lastName) && ciEq(x.company,company)); }

      if(match){
        if(fillOrConflict(match,'role',role,'contact')) conflictCount++;
        if(fillOrConflict(match,'email',email,'contact')) conflictCount++;
        if(fillOrConflict(match,'phone1',phone1,'contact')) conflictCount++;
        if(fillOrConflict(match,'phone2',phone2,'contact')) conflictCount++;
        if(fillOrConflict(match,'comment',comment,'contact')) conflictCount++;
        if(relevance && !match.relevance) match.relevance=relevance;
        if(relevance && company){ const co=companies.find(x=>x.name===company); if(co && !co.relevance){ co.relevance=relevance; touchCrm(co); } }
        touchCrm(match);
        updated++;
      } else {
        const contactId='ct_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)+idx;
        contacts.push({ id:contactId, firstName, lastName, role, company, email, phone1, phone2, relevance, comment, createdAt:Date.now(), updatedAt:Date.now(), deleted:false });
        if(meetingLabel){ meetings.push({ id:'mt_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)+idx, contactId, label:meetingLabel, date:toISO(new Date()), createdAt:Date.now(), updatedAt:Date.now(), deleted:false }); }
        added++;
      }

      if(company){
        let co=companies.find(x=>x.name===company);
        if(!co){
          co={ id:'co_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)+idx, name:company, whatTheyDo:'', marketScope:[], website:'', type:'', createdAt:Date.now(), updatedAt:Date.now(), deleted:false };
          companies.push(co);
        }
        if(fillOrConflict(co,'whatTheyDo',whatTheyDo,'company')) conflictCount++;
        if(fillOrConflict(co,'website',website,'company')) conflictCount++;
        if(countryRaw && (!co.marketScope||!co.marketScope.length)){
          co.marketScope=countryRaw.split(/[,/]/).map(s=>s.trim()).filter(Boolean);
        }
      }
    });

    if(added>0||updated>0){
      saveClients(); saveCrm();
      await saveConflicts(); updateConflictBadge();
      renderContacts();
    }
    let msg=added+' contact(s) créé(s), '+updated+' complété(s) ou fusionné(s).';
    if(conflictCount>0) msg+=' '+conflictCount+' conflit(s) à trancher dans Réf. & data → Conflits de synchro.';
    alert(msg);
  }

  function exportContactsExcel(){
    loadXlsx().then(()=>{
      const rows=activeContacts().map(c=>{
        const co=c.company?companies.find(x=>x.name===c.company):null;
        return {
          'Prénom': c.firstName||'',
          'Nom': c.lastName||'',
          'Rôle': c.role||'',
          'Société': c.company||'',
          'Email': c.email||'',
          'Téléphone 1': c.phone1||'',
          'Téléphone 2': c.phone2||'',
          'Pertinence (1-5)': companyStars(c.company)||'',
          'Commentaire': c.comment||'',
          'Type société': co?co.type||'':'',
          'What they do': co?co.whatTheyDo||'':'',
          'Link': co?co.website||'':'',
          'Country': co&&co.marketScope?co.marketScope.join(', '):''
        };
      });
      const ws=XLSX.utils.json_to_sheet(rows);
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
      XLSX.writeFile(wb, 'contacts-'+toISO(new Date())+'.xlsx');
    }).catch(()=>alert('Le chargement de la librairie Excel a échoué. Vérifie ta connexion.'));
  }

  function setSigImage(file){
    if(!file || !file.type.startsWith('image/')) return;
    sigImageFile=file;
    const reader=new FileReader();
    reader.onload=()=>{ $('sig-image-thumb').src=reader.result; $('sig-image-preview').classList.remove('hidden'); };
    reader.readAsDataURL(file);
  }
  function clearSigImage(){ sigImageFile=null; $('sig-image-preview').classList.add('hidden'); $('sig-image-input').value=''; }

  $('columns-toggle-btn').onclick=e=>openColumnsPopover(e);

  $('archive-search').addEventListener('input', ()=>{ $('archive-search-clear').classList.toggle('show', !!$('archive-search').value); renderArchive(); });
  $('archive-search-clear').onclick=()=>{ $('archive-search').value=''; $('archive-search-clear').classList.remove('show'); renderArchive(); };
  document.querySelectorAll('#archive-filters .filter-chip').forEach(chip=>{
    chip.onclick=()=>{
      document.querySelectorAll('#archive-filters .filter-chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      archiveFilter=chip.dataset.filter;
      renderArchive();
    };
  });

  $('sig-paste-btn').onclick=()=>{
    $('sig-paste-text').value='';
    clearSigImage();
    $('sig-ocr-status').classList.add('hidden');
    $('sig-paste-overlay').classList.remove('hidden');
    $('sig-paste-text').focus();
  };
  $('sig-paste-cancel').onclick=()=>{ $('sig-paste-overlay').classList.add('hidden'); };
  $('contact-import-btn').onclick=()=>$('contact-import-input').click();
  $('contact-import-input').addEventListener('change', e=>{
    const file=e.target.files[0];
    if(file) importContactsExcel(file);
    e.target.value='';
  });
  $('contact-export-btn').onclick=exportContactsExcel;
  $('sig-paste-overlay').addEventListener('click', e=>{ if(e.target.id==='sig-paste-overlay') $('sig-paste-overlay').classList.add('hidden'); });

  $('sig-drop-zone').onclick=()=>$('sig-image-input').click();
  $('sig-image-input').addEventListener('change', e=>{ if(e.target.files[0]) setSigImage(e.target.files[0]); });
  $('sig-image-remove').onclick=clearSigImage;
  $('sig-drop-zone').addEventListener('dragover', e=>{ e.preventDefault(); $('sig-drop-zone').style.borderColor='var(--accent)'; });
  $('sig-drop-zone').addEventListener('dragleave', ()=>{ $('sig-drop-zone').style.borderColor='var(--bd)'; });
  $('sig-drop-zone').addEventListener('drop', e=>{
    e.preventDefault(); $('sig-drop-zone').style.borderColor='var(--bd)';
    if(e.dataTransfer.files[0]) setSigImage(e.dataTransfer.files[0]);
  });
  $('sig-paste-overlay').addEventListener('paste', e=>{
    const items=(e.clipboardData || window.clipboardData).items;
    for(const item of items){
      if(item.type.startsWith('image/')){ setSigImage(item.getAsFile()); e.preventDefault(); break; }
    }
  });

  $('sig-paste-analyze').onclick=async ()=>{
    let text=$('sig-paste-text').value.trim();
    if(!text && !sigImageFile) return;

    if(sigImageFile){
      $('sig-ocr-status').classList.remove('hidden');
      $('sig-paste-analyze').disabled=true;
      try{
        await loadTesseract();
        const { data } = await Tesseract.recognize(sigImageFile, 'fra+eng');
        text=(text+'\n'+data.text).trim();
      }catch(e){
        console.error('OCR failed', e);
        alert('La lecture de l\u2019image a échoué. Analyse du texte seul.');
      }
      $('sig-ocr-status').classList.add('hidden');
      $('sig-paste-analyze').disabled=false;
    }

    if(!text) return;
    const guess=parseSignatureText(text);
    $('sig-paste-overlay').classList.add('hidden');
    openContactForm(null, guess);
  };
  $('contact-save-btn').onclick=saveContact;
  $('contact-cancel-btn').onclick=closeContactForm;
  $('co-edit-save').onclick=saveCompanyEdit;
  $('co-edit-cancel').onclick=closeCompanyEditForm;
  $('company-edit-overlay').addEventListener('click', e=>{ if(e.target.id==='company-edit-overlay') closeCompanyEditForm(); });
  $('contact-search').addEventListener('input', ()=>{ $('contact-search-clear').classList.toggle('show', !!$('contact-search').value); renderContacts(); });
  $('contact-search-clear').onclick=()=>{ $('contact-search').value=''; $('contact-search-clear').classList.remove('show'); renderContacts(); };
  document.querySelectorAll('#contacts-view-switch .view-icon-btn').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('#contacts-view-switch .view-icon-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      contactsView=btn.dataset.view; try{ localStorage.setItem('contacts-view', contactsView); }catch(e){}
      renderContacts();
    };
  });
  function refreshContactsTypeFilter(){
    const sel=$('contacts-type-filter');
    const current=sel.value;
    sel.innerHTML='<option value="">Tous les types</option>' + companyTypesList.slice().sort().map(t=>'<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>').join('');
    if(companyTypesList.includes(current)) sel.value=current;
  }
  $('contacts-type-filter').addEventListener('change', renderContacts);
  document.querySelectorAll('.contacts-header-row .sort').forEach(el=>el.addEventListener('click', ()=>{
    const k=el.dataset.sort;
    contactsSort = contactsSort.key===k ? { key:k, dir:-contactsSort.dir } : { key:k, dir:1 };
    try{ localStorage.setItem('contacts-sort', JSON.stringify(contactsSort)); }catch(e){}
    renderContacts();
  }));
  $('contact-form').addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); closeContactForm(); } });
  $('ct-relevance-picker').querySelectorAll('span').forEach(s=>{ s.onclick=()=>setRelevancePicker(parseInt(s.dataset.v,10)); });
  {
    const ctCompanyInput=$('ct-company'), ctCompanyDropdown=$('ct-company-dropdown');
    function renderCtCompanyDropdown(){
      const q=ctCompanyInput.value.trim().toLowerCase();
      ctCompanyDropdown.innerHTML='';
      clientsList.slice().sort().filter(n=>n.toLowerCase().includes(q)).forEach(name=>{
        const row=document.createElement('div'); row.className='combo-item';
        const dot=document.createElement('span'); dot.className='combo-item-dot'; dot.style.background=clientColor(name);
        const label=document.createElement('span'); label.className='combo-item-label'; label.textContent=name;
        row.appendChild(dot); row.appendChild(label);
        row.onclick=()=>{ ctCompanyInput.value=name; ctCompanyDropdown.classList.remove('open'); };
        ctCompanyDropdown.appendChild(row);
      });
    }
    ctCompanyInput.addEventListener('focus', ()=>{ renderCtCompanyDropdown(); ctCompanyDropdown.classList.add('open'); });
    ctCompanyInput.addEventListener('input', renderCtCompanyDropdown);
    document.addEventListener('click', e=>{ if(!ctCompanyInput.contains(e.target) && !ctCompanyDropdown.contains(e.target)) ctCompanyDropdown.classList.remove('open'); });
  }
  $('opp-add-btn').onclick=()=>openOppForm();
  $('prequal-add-btn').onclick=()=>{ $('prequal-companies').innerHTML=clientsList.slice().sort().map(n=>'<option value="'+escapeHtml(n)+'">').join(''); openPrequalForm(); };
  $('prequal-save-btn').onclick=savePrequal;
  $('prequal-cancel-btn').onclick=closePrequalForm;
  $('pipe-exited-toggle').onclick=()=>{ pipeShowExited=!pipeShowExited; renderPipeline(); };
  $('pipe-dash-toggle').onclick=()=>{ pipeDash=!pipeDash; if(pipeDash) pipeMeet=false; renderPipeline(); };
  $('tasks-views-btn').onclick=e=>{ e.stopPropagation(); openViewsMenu('tasks', e.currentTarget); };
  $('pipe-views-btn').onclick=e=>{ e.stopPropagation(); openViewsMenu('pipeline', e.currentTarget); };
  $('pipe-meet-toggle').onclick=()=>{ pipeMeet=!pipeMeet; if(pipeMeet) pipeDash=false; renderPipeline(); };
  $('pq-save-btn').onclick=saveOpp;
  $('pq-next-btn').onclick=pqNext;
  $('pq-back-btn').onclick=()=>{ pqShowStep(1); pqStep1Render(); };
  $('pq1-company').addEventListener('input', ()=>{ pq1SigAuto.delete('pq1-company'); pqStep1Render(); });
  ['pq1-prenom','pq1-nom','pq1-qualite','pq1-tel','pq1-tel2','pq1-mail'].forEach(id=>$(id).addEventListener('input', ()=>pq1SigAuto.delete(id)));
  $('pq1-principal').addEventListener('click', e=>{ const b=e.target.closest('[data-principal]'); if(!b) return; pqState.principal=b.dataset.principal; pqPrincipalRender(); });
  ['pq1-prenom','pq1-nom','pq1-mail'].forEach(id=>$(id).addEventListener('input', ()=>pqPrincipalRender()));
  $('pq1-add-extra').onclick=()=>{ pqState.extras.push({}); pqExtrasRender(); const els=$('pq1-extras').querySelectorAll('input[data-xk="prenom"]'); if(els.length) els[els.length-1].focus(); };
  $('pq1-extras').addEventListener('input', e=>{ const i=e.target.dataset.x; if(i==null) return; pqState.extras[+i][e.target.dataset.xk]=e.target.value; pqPrincipalRender(); });
  $('pq1-extras').addEventListener('click', e=>{ const r=e.target.closest('[data-x-remove]'); if(!r) return; pqState.extras.splice(+r.dataset.xRemove,1); if(pqState.principal.indexOf('x:')===0) pqState.principal='main'; pqExtrasRender(); pqPrincipalRender(); });
  $('pq1-sig').addEventListener('input', ()=>{ clearTimeout(pq1SigTimer); pq1SigTimer=setTimeout(()=>pqApplySignature($('pq1-sig').value), 300); });
  $('pq1-sig').addEventListener('paste', async e=>{
    const items=[...((e.clipboardData||{}).items||[])], img=items.find(i=>i.type && i.type.startsWith('image/'));
    // a new signature replaces the previous text (each paste = one person)
    if(pq1SigApplied){ $('pq1-sig').value=''; pq1SigApplied=false; }
    if(!img) return;
    e.preventDefault();
    $('pq1-sig-status').textContent='Lecture de l\u2019image…';
    try{
      await loadTesseract();
      const { data }=await Tesseract.recognize(img.getAsFile(), 'fra+eng');
      $('pq1-sig').value=(($('pq1-sig').value?$('pq1-sig').value+'\n':'')+data.text).trim();
      pqApplySignature($('pq1-sig').value);
    }catch(err){ console.error(err); $('pq1-sig-status').textContent='Lecture de l\u2019image impossible : colle plutôt le texte de la signature.'; }
  });
  $('pq1-company').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); pqNext(); } });
  $('pq-cancel-btn').onclick=closeOppForm;
  $('pq-form').addEventListener('input', pqOnInput);
  $('pq-form').addEventListener('change', pqOnChange);
  $('pq-form').addEventListener('change', e=>{ if(e.target.id==='pq-contact-switch' && pqState && e.target.value){ pqSwitchContact(e.target.value); return; } });
  $('pq-form').addEventListener('change', e=>{ if(e.target.id==='pq-count-ok' && pqState){ pqState.countConfirmed=e.target.checked?pqState.installs.length:null; } });
  $('pq-form').addEventListener('click', e=>{
    if(!pqState) return;
    const ta=e.target.closest('[data-toall]'); if(ta){
      // one field of one installation onto all the others (dates go as a set: start, duration, end);
      // values already filled differently are only replaced after asking
      e.preventDefault();
      const st=pqState, from=st.installs[+ta.dataset.s], k=ta.dataset.toall, keys=k==='dept'?['dept','region']:[k];
      const filled=v=>v!=null && String(v).trim()!=='';
      const clash=st.installs.map((x,i)=>({x,i})).filter(({x})=>x!==from && keys.some(kk=>filled(x[kk]) && String(x[kk])!==String(from[kk]??'')));
      const apply=onlyEmpty=>{ st.installs.forEach((x,i)=>{ if(x===from) return; keys.forEach(kk=>{ if(onlyEmpty && filled(x[kk])) return; x[kk]=filled(from[kk])?from[kk]:''; st.touched.add(i+'.'+kk); st.auto.delete(i+'.'+kk); if(st.derived) st.derived.delete(i+'.'+kk); });
        if(['debut','fin'].includes(k)) pqLinkDates(i, k); }); pqRerenderKeepFocus(); flashPqToAll(k); };
      const label=(PQ_FIELDS.find(f=>f.k===k)||PQ_EXTRA_FIELDS.find(f=>f.k===k)||{}).label||k;
      if(!keys.some(kk=>filled(from[kk]))){
        const others=st.installs.filter(x=>x!==from && keys.some(kk=>filled(x[kk])));
        if(!others.length) return;
        askChoice('Vider ce champ partout ?', '« '+label+' » est vide ici : '+(others.length>1?'les '+others.length+' autres installations qui l\u2019ont rempli seront vidées':'l\u2019autre installation qui l\u2019a rempli sera vidée')+' ('+others.slice(0,4).map(x=>(x.centrale||'?')+' : '+keys.map(kk=>x[kk]).filter(filled).join(', ')).join(' ; ')+(others.length>4?'…':'')+').',
          [{ label:'Vider partout', value:'all' }]).then(v=>{ if(v) apply(false); });
        return;
      }
      if(!clash.length){
        const shown=keys.map(kk=>from[kk]).filter(filled).join(', '), n=st.installs.length-1;
        askChoice('Appliquer à toutes les installations ?', '« '+label+' » : '+shown+' → sur '+(n>1?'les '+n+' autres installations':'l\u2019autre installation')+'.',
          [{ label:'Appliquer à toutes', value:'all' }]).then(v=>{ if(v) apply(false); });
        return;
      }
      askChoice('Remplacer des valeurs déjà remplies ?', clash.length+' installation'+(clash.length>1?'s ont':' a')+' déjà une autre valeur pour « '+label+' » : '+clash.slice(0,4).map(({x,i})=>(x.centrale||'Installation '+(i+1))+' ('+keys.map(kk=>x[kk]).filter(filled).join(', ')+')').join(' ; ')+(clash.length>4?'…':'')+'.',
        [{ label:'Remplacer partout', value:'all' }, { label:'Seulement les champs vides', value:'empty' }]).then(v=>{ if(v) apply(v==='empty'); });
      return;
    }
    const da=e.target.closest('[data-dall]'); if(da && !da.dataset.ok){
      // starts already typed differently are only replaced after asking
      const st=pqState, typed=st.installs.filter(x=>x.debut && pqFullDate(x.mesEff||x.mesPrev) && x.debut!==pqFullDate(x.mesEff||x.mesPrev));
      if(typed.length){ askChoice('Remplacer des dates de début déjà remplies ?', typed.length+' installation'+(typed.length>1?'s ont':' a')+' déjà une date de début différente de sa mise en service : '+typed.slice(0,4).map(x=>(x.centrale||'?')+' ('+x.debut+')').join(' ; ')+'.',
        [{ label:'Remplacer', value:'all' }]).then(v=>{ if(v){ da.dataset.ok='1'; da.click(); delete da.dataset.ok; } }); return; }
    }
    if(da){
      // every installation: its own commissioning date as start (with the duration shown here), or the same dates as this one
      const st=pqState, from=st.installs[+da.dataset.s];
      st.installs.forEach((x,i)=>{
        if(da.dataset.dall==='mes'){ const m=pqFullDate(x.mesEff||x.mesPrev); if(!m) return; x.debut=m; }
        else ['debut','fin'].forEach(k=>{ if(from[k]) x[k]=from[k]; });
        st.touched.add(i+'.debut'); st.auto.delete(i+'.debut');
        pqLinkDates(i, 'debut');
      });
      pqRerenderKeepFocus(); return;
    }
    const dc=e.target.closest('[data-dset]'); if(dc){ const i=+dc.dataset.s, k=dc.dataset.dset; pqState.installs[i][k]=dc.dataset.v; pqState.touched.add(i+'.'+k); pqState.auto.delete(i+'.'+k); pqLinkDates(i, k); pqRerenderKeepFocus(); return; }
    const p9=e.target.closest('[data-p90]'); if(p9){ const i=+p9.dataset.s; pqState.installs[i].p90=p9.dataset.p90; pqState.touched.add(i+'.p90'); pqRerenderKeepFocus(); return; }
    const est=e.target.closest('[data-est]'); if(est){ const i=+est.dataset.s; pqState.installs[i].mwh=est.dataset.est; pqState.touched.add(i+'.mwh'); pqRerenderKeepFocus(); return; }
    const rm=e.target.closest('[data-remove]'); if(rm){ pqState.installs.splice(+rm.dataset.remove,1); pqState.auto=new Set([...pqState.auto].filter(k=>k.startsWith('s.'))); pqRerenderKeepFocus(); return; }
    if(e.target.id==='pq-add-inst'){ const last=pqState.installs[pqState.installs.length-1]||{}; pqState.installs.push({ install:last.install, contrat:last.contrat }); pqRender(); const f=$('pq-'+(pqState.installs.length-1)+'-centrale'); if(f) f.focus(); }
  });
  $('pq-mail').addEventListener('input', ()=>{ clearTimeout(pqParseTimer); pqParseTimer=setTimeout(pqReparse, 250); });
  $('pq-file').addEventListener('change', e=>{ pqHandleFiles(e.target.files); e.target.value=''; });
  {
    const pane=$('pq-mail-pane');
    pane.addEventListener('dragover', e=>{ e.preventDefault(); pane.classList.add('drag'); });
    pane.addEventListener('dragleave', ()=>pane.classList.remove('drag'));
    pane.addEventListener('drop', e=>{ e.preventDefault(); pane.classList.remove('drag'); if(e.dataTransfer.files.length) pqHandleFiles(e.dataTransfer.files); });
  }
  $('opp-search').addEventListener('input', ()=>{ $('opp-search-clear').classList.toggle('show', !!$('opp-search').value); renderPipeline(); });
  $('opp-search-clear').onclick=()=>{ $('opp-search').value=''; $('opp-search-clear').classList.remove('show'); renderPipeline(); };
  $('stage-advance-confirm').onclick=confirmStageAdvance;
  $('stage-advance-skip').onclick=closeStageAdvance;
  $('stage-advance-nogo').onclick=noGoFromAdvance;
  $('prequal-overlay').addEventListener('click', e=>{ if(e.target.id==='prequal-overlay') closePrequalForm(); });
  $('opp-detail-overlay').addEventListener('click', e=>{ if(e.target.id==='opp-detail-overlay') closeOppDetail(); });
  $('stage-advance-overlay').addEventListener('click', e=>{ if(e.target.id==='stage-advance-overlay') closeStageAdvance(); });
  document.addEventListener('keydown', e=>{
    if(e.key!=='Escape') return;
    if(!$('guide-overlay').classList.contains('hidden')) $('guide-overlay').classList.add('hidden');
    else if(!$('opp-detail-overlay').classList.contains('hidden')) closeOppDetail();
    else if(!$('prequal-overlay').classList.contains('hidden')) closePrequalForm();
  });
  $('export-btn').onclick=exportData;
  $('import-btn').onclick=()=>$('import-file').click();
  $('import-file').addEventListener('change',e=>{ if(e.target.files[0])importData(e.target.files[0]); e.target.value=''; });

  snoozePopover.querySelectorAll('[data-days]').forEach(b=>{ b.onclick=()=>applySnoozeDays(parseInt(b.dataset.days,10)); });
  snoozePopover.querySelectorAll('[data-abs]').forEach(b=>{ b.onclick=()=>applySnoozeAbsolute(parseInt(b.dataset.abs,10)); });
  $('snooze-clear-date').onclick=clearSnoozeDate;
  $('snooze-date-apply').onclick=()=>{ const v=$('snooze-date-input').value; if(!currentSnoozeId||!v)return; const t=tasks.find(x=>x.id===currentSnoozeId); if(t){ t.due=v; touch(t); saveTasks(); render(); } closeSnoozePopover(); };
  document.addEventListener('click',e=>{ if(snoozePopover.style.display==='flex'&&!snoozePopover.contains(e.target))closeSnoozePopover(); });

  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='p' && !window.TODO_WIDGET){ e.preventDefault(); if($('gs-overlay').hidden) gsOpen('>'); else gsClose(); return; }   // command palette
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); if(window.TODO_WIDGET){ if(!window.TODO_PIP && !document.documentElement.classList.contains('widget-open')){ window.__widgetToggle(); return; } quickAddInput.focus(); return; } if($('gs-overlay').hidden) gsOpen(); else gsClose(); return; }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){   // the search box of the tab on screen; none there → the browser's own search
      const box=['search-input','contact-search','opp-search','archive-search','client-list-search'].map(id=>$(id)).find(el=>el && el.offsetParent);
      if(box){ e.preventDefault(); box.focus(); box.select(); } return; }
    if(e.key==='Escape'){ if(snoozePopover.style.display==='flex'){ closeSnoozePopover(); return; } if(editingId){ editingId=null; render(); return; } if(document.activeElement&&document.activeElement.id==='f-title'){ closeAddForm(); return; } if(document.activeElement===quickAddInput){ quickAddInput.blur(); return; } if(document.activeElement===searchInput&&searchQuery){ searchInput.value=''; searchQuery=''; searchClear.classList.remove('show'); render(); return; } return; }
    const tag=document.activeElement.tagName; if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    if(e.key==='n'){ e.preventDefault(); if(!quickAddInput.offsetParent){ const t=document.querySelector('.tab[data-tab="tasks"]'); if(t) t.click(); } quickAddInput.focus(); }   // from any tab
    else if(e.key==='p'){ e.preventDefault(); openPostit(true); }
    else if(e.key==='j'||e.key==='k'){ e.preventDefault(); moveSelection(e.key==='j'?1:-1); }
    else if(e.key==='Enter'){ if(selectedTaskId)validateTask(selectedTaskId); }
    else if(e.key==='e'){ if(selectedTaskId){ e.preventDefault(); openEdit(selectedTaskId); } }
  });

  // PWA: install prompt (hidden on iOS Safari and once already installed — no beforeinstallprompt there)
  let deferredInstallPrompt = null;
  const installSection = $('install-section'), installBtn = $('install-btn');
  window.addEventListener('beforeinstallprompt', e=>{
    e.preventDefault();
    deferredInstallPrompt = e;
    if(installSection) installSection.style.display = 'block';
  });
  if(installBtn){
    installBtn.onclick = async ()=>{
      if(!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installSection.style.display = 'none';
    };
  }
  window.addEventListener('appinstalled', ()=>{ if(installSection) installSection.style.display = 'none'; });

  setInterval(checkReminders,30000);
  // Console-only recovery: F12 → Console → recoverDeletedTasks()
  // Un-deletes every soft-deleted task in this browser's local data and
  // re-renders. Deliberately not exposed anywhere in the UI.
  window.recoverDeletedTasks = function(){
    const found = tasks.filter(t => t.deleted);
    if(!found.length){ console.log('Aucune tâche supprimée trouvée dans ce navigateur.'); return; }
    found.forEach(t => { t.deleted = false; touch(t); });
    saveTasks(); render(); renderArchive();
    console.log(found.length + ' tâche(s) restaurée(s) :', found.map(t => t.title));
  };

  // ---------- Parc (read from the "Suivi Agrégation" workbook, kept in this browser only) ----------
  const PARC_KEY='parc-data';
  const PARC_YEARS=Array.from({length:31},(_,i)=>2020+i);   // every "Agrégation AAAA" column the file may hold
  // what is shown: the current year and the 4 following ones
  const parcYearsShown=()=>{ const y=new Date().getFullYear(); return [y,y+1,y+2,y+3,y+4]; };
  const PARC_CADRES=['CR','OA','ACC','Marché','Autre'];
  const PARC_COLORS={ CR:'#14D3A9', OA:'#7DD3FC', ACC:'#FFFD82', 'Marché':'#CA6702', Autre:'#6B7480' };
  let parcData=null, parcYear=new Date().getFullYear(), parcFilter='Gagné', parcSearch='';
  function loadParc(){ try{ const r=window.storage.peek?window.storage.peek(PARC_KEY):localStorage.getItem('todo_'+PARC_KEY); parcData=r?JSON.parse(r):null; }catch(e){ parcData=null; } }
  function saveParc(){ window.storage.set(PARC_KEY, JSON.stringify(parcData)).catch(e=>console.error(e)); }
  const parcNorm=s=>pqFold(String(s==null?'':s)).replace(/[^a-z0-9%]/g,'');
  function parcIso(v){
    if(v instanceof Date && !isNaN(v)) return toISO(xlDay(v));
    if(typeof v==='number' && v>20000 && v<80000){ const d=new Date(Math.round((v-25569)*86400000)); return d.toISOString().slice(0,10); }
    const s=String(v||'').trim(); const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if(m) return m[3]+'-'+pqPad(m[2])+'-'+pqPad(m[1]);
    return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):'';
  }
  const parcNum=v=>{ if(typeof v==='number') return v; const n=parseFloat(String(v||'').replace(/\s|€/g,'').replace(',','.')); return isNaN(n)?0:n; };
  // Where the plant is: "Département2" (Producteur block) or its postal code; the first "Département" column
  // follows the contract (a developer's head office) and only serves when the plant's location is missing.
  function parcSite(dept2, cp, dept, region){
    let d=null;
    if(String(dept2||'').trim()) d=pqDeptFromText(String(dept2));
    if(!d && cp!=='' && cp!=null){ const c=typeof cp==='number'?String(cp).padStart(5,'0'):String(cp).trim(); if(/^\d{5}$/.test(c)) d=pqDeptFromPostal(c); }
    if(!d && String(dept||'').trim()) d=pqDeptFromText(String(dept));
    return d?{ siteDept:pqDeptLabel(d), siteRegion:PQ_REGIONS[d[2]] }:{ siteDept:String(dept||''), siteRegion:String(region||'') };
  }
  function parseParcWorkbook(wb){ return parseParcSheets(wb.SheetNames, n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''})); }
  // sheetNames + getRows(name) → array of rows (arrays); works for a file read here or rows sent by the Excel bridge
  function parseParcSheets(sheetNames, getRows){
    const sheetName=sheetNames.find(n=>/bdd/i.test(n))||sheetNames.find(n=>getRows(n).slice(0,10).some(r=>r.map(parcNorm).includes('nomprod')));
    if(!sheetName) throw new Error('Onglet « BDD Agrégation » introuvable dans ce fichier.');
    const rows=getRows(sheetName).map(r=>r.map(v=>v==null?'':v));
    const hi=rows.findIndex(r=>r.map(parcNorm).includes('nomprod'));
    if(hi<0) throw new Error('Ligne d\u2019en-têtes (Nom_prod…) introuvable.');
    const head=rows[hi].map(parcNorm);
    const col=(...names)=>{ for(const n of names){ const i=head.indexOf(parcNorm(n)); if(i>=0) return i; } return -1; };
    const C={ annee:col('Année'), charge:col('Chargé'), source:col('Source'), ca:col('Crédit Agricole'), dev:col('Développeur'), cadre:col('Cadre juridique'), ao:col('Type AO CRE'), valo:col('Type_valorisation'), secteur:col('Secteur'),
      region:col('Région'), dept:col('Département'), dept2:head.lastIndexOf('departement2'), cp:col('CP'),   // the LAST "Département2": the plant's (the first is the contract's, name only)
      dateOffre:col('Date_offre'), typeOffre:col('Type_offre'), statut:col('Statut'), sign:col('Date_sign'), debut:col('Date_début'), mes:col('Mise en service'), fin:col('Date_fin'),
      renouv:col('Renouvellement'), comment:col('Commentaire'), prod:col('Nom_prod'), inst:col('Nom_Installation_prod'), enr:col('Type_EnR'), typeInst:col('Type_installation'), kwc:col('P_installée (KWc)','P_installée'), p50:col('P50(MWh)','P50'), grd:col('GRD') };
    const volCols={}; PARC_YEARS.forEach(y=>{ const i=col('Agrégation '+y); if(i>=0) volCols[y]=i; });
    const get=(r,k)=>C[k]>=0?r[C[k]]:'';
    const items=[];
    rows.slice(hi+1).forEach((r,ix)=>{
      const prod=String(get(r,'prod')||'').trim(), inst=String(get(r,'inst')||'').trim(), dev=String(get(r,'dev')||'').trim();
      if(!prod && !inst && !dev) return;
      const vols={}; Object.keys(volCols).forEach(y=>{ const v=parcNum(r[volCols[y]]); if(v) vols[y]=v; });
      const cadre=String(get(r,'cadre')||'').trim();
      items.push({ id:'p'+ix, prod:prod||dev, inst, dev:dev||prod, statut:String(get(r,'statut')||'').trim(), renouv:String(get(r,'renouv')||'').trim(),
        cadre:PARC_CADRES.includes(cadre)?cadre:(cadre?'Autre':''), ao:String(get(r,'ao')||''), valo:String(get(r,'valo')||''), secteur:String(get(r,'secteur')||''),
        region:String(get(r,'region')||''), dept:String(get(r,'dept')||''), ...parcSite(get(r,'dept2'), get(r,'cp'), get(r,'dept'), get(r,'region')), enr:String(get(r,'enr')||''), typeInst:String(get(r,'typeInst')||''),
        kwc:parcNum(get(r,'kwc')), p50:parcNum(get(r,'p50')), charge:String(get(r,'charge')||''), source:String(get(r,'source')||''), ca:String(get(r,'ca')||''),
        dateOffre:parcIso(get(r,'dateOffre')), typeOffre:String(get(r,'typeOffre')||''), sign:parcIso(get(r,'sign')), debut:parcIso(get(r,'debut')), mes:parcIso(get(r,'mes')), fin:parcIso(get(r,'fin')),
        comment:String(get(r,'comment')||''), vols });
    });
    // supply / aggregation objectives (GWh) from the Dashboard sheet, when present
    const objectives={};
    const dash=sheetNames.find(n=>/dashboard/i.test(n));
    if(dash){
      const d=getRows(dash).map(r=>r.map(v=>v==null?'':v));
      const yr=d.find(r=>r.map(parcNorm).includes('designation'));
      const ob=d.find(r=>r.map(parcNorm).some(c=>c==='objectagregationvol'||c==='objectifagregationvol'));
      if(yr && ob) yr.forEach((y,i)=>{ const n=parseInt(y,10); if(n>=2020 && n<2100 && parcNum(ob[i])) objectives[n]=parcNum(ob[i]); });
    }
    return { items, objectives, sheet:sheetName, importedAt:Date.now() };
  }
  async function importParcFile(file){
    $('parc-info').textContent='Lecture…';
    try{
      await loadXlsxLib();
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      const next=parseParcWorkbook(wb); next.fileName=file.name; parcImported(next);
    }catch(e){ console.error(e); $('parc-info').textContent='Fichier illisible : '+(e.message||e); }
  }

  async function importParcFromBridge(silent){
    if(!silent) $('parc-info').textContent='Lecture de l’Excel…';
    try{
      const res=await bridgeCall('GET','/bdd/read',null,60000);
      const names=Object.keys(res.sheets||{});
      const next=parseParcSheets(names, n=>res.sheets[n]||[]); next.fileName='Excel (pont local)'; parcImported(next);
    }catch(e){ if(!silent) $('parc-info').textContent=e.message; }
  }
  // A Parc contract (statut Gagné) of a company: matched on Nom_prod or Développeur
  function parcForCompany(name){
    if(parcData===null) loadParc();
    const k=parcNorm(name);
    if(!parcData || k.length<4) return [];
    return parcData.items.filter(p=>[p.prod,p.dev].some(v=>{ const a=parcNorm(v); return a && (a===k || (a.length>=4 && (a.includes(k) || k.includes(a)))); }));
  }

  // ---------- Renewals: a task per won contract ending within N months (once, on every device) ----------
  const RENEW_KEY='renew-months';
  const renewMonths=()=>{ try{ return parseInt(localStorage.getItem('todo_'+RENEW_KEY),10)||6; }catch(e){ return 6; } };
  function parcKey(p){ const s=[p.prod,p.inst,p.fin].map(parcNorm).join('|'); let h=5381; for(let i=0;i<s.length;i++) h=((h*33)^s.charCodeAt(i))>>>0; return h.toString(36); }
  function renewalCandidates(){
    if(!parcData) return [];
    const today=toISO(new Date()), lim=new Date(); lim.setMonth(lim.getMonth()+renewMonths());
    const limIso=toISO(lim);
    return parcData.items.filter(p=>p.statut==='Gagné' && p.fin && p.fin>=today && p.fin<=limIso);
  }
  // One task per developer and end date (8 contracts of one developer ending on 31/12 = one task). Deterministic id:
  // the same group gives the same task on the phone and the computer, and a deleted or completed renewal
  // task is never created again.
  const renewGroupId=p=>{ const s=parcNorm(p.dev||p.prod)+'|'+p.fin; let h=5381; for(let i=0;i<s.length;i++) h=((h*33)^s.charCodeAt(i))>>>0; return 'renew_'+h.toString(36); };
  function ensureRenewalTasks(){
    const groups=new Map();
    renewalCandidates().forEach(p=>{ const id=renewGroupId(p); if(!groups.has(id)) groups.set(id,[]); groups.get(id).push(p); });
    let n=0;
    groups.forEach((list,id)=>{
      if(tasks.some(t=>t.id===id)) return;
      const p=list[0], who=p.dev||p.prod;
      const fin=new Date(p.fin+'T00:00:00'), due=new Date(fin); due.setDate(due.getDate()-120);
      const today=new Date(); today.setHours(0,0,0,0);
      const kwc=list.reduce((s,x)=>s+(x.kwc||0),0);
      const t=createTask({ title:list.length>1?'Renouveler '+list.length+' contrats — '+who:'Renouveler le contrat — '+(p.inst||p.prod), client:who,
        due:toISO(due<today?today:due), urgency:'haute', status:'a_faire',
        description:'Fin de contrat le '+pqIsoToFr(p.fin)+' · '+(kwc?fmtMwc(kwc):'')+'\n'+list.map(x=>'- '+(x.inst||x.prod)+(x.kwc?' ('+fmtKwc(x.kwc)+(x.cadre?', '+x.cadre:'')+')':'')).join('\n')+'\nIssu du portefeuille (Suivi Agrégation).' });
      t.id=id; n++;
    });
    if(n){ saveTasks(); render(); }
    return n;
  }
  // Puts a contract back into the pipeline (stage: pricing request), prefilled from the Parc
  function renewalToPipeline(p){
    const company=ensureCompany(p.dev||p.prod);
    const o={ id:newOppId('opp'), kind:'installation', company, title:p.inst||p.prod, centrale:p.inst||p.prod, producteur:p.prod, stage:'demande_prix', requestId:null, taskId:null,
      kwc:p.kwc?String(p.kwc):'', mwh:p.p50?String(Math.round(p.p50)):'', dept:p.dept, region:p.region, install:p.enr==='PV'||p.enr==='Eolien'||p.enr==='Hydro'?p.enr:'',
      contrat:p.cadre==='CR'?(p.ao==='AOS CRE'?'AOS CRE':'AO CRE CR'):p.cadre==='OA'?"Sortie d'OA / CR":p.cadre==='ACC'?'Surplus ACC':'',
      charge:p.charge, origine:'Contact direct', ca:p.ca||'N/A', dateEntree:toISO(new Date()), annee:String(new Date().getFullYear()), goDate:toISO(new Date()),
      commentaires:pqIsoToFr(toISO(new Date()))+' : renouvellement du contrat qui se termine le '+pqIsoToFr(p.fin)+'.', renewalOf:parcKey(p),
      createdAt:Date.now(), updatedAt:Date.now(), deleted:false };
    opportunities.push(o); saveCrm();
    return o;
  }
  const fmtGwh=mwh=>(Math.round(mwh/100)/10).toLocaleString('fr-FR')+' GWh';
  const fmtMwc=kwc=>(Math.round(kwc/100)/10).toLocaleString('fr-FR')+' MWc';
  function renderParc(){
    const body=$('parc-body'); if(!body) return;
    if(parcData===null) loadParc();
    body.innerHTML='';
    if(!parcData || !parcData.items.length){
      $('parc-info').textContent=syncConfig.enabled?'Le Portefeuille chargé sur un autre appareil arrive ici à la synchro.':'';
      body.innerHTML='<div class="parc-empty"><b>Aucun portefeuille chargé.</b><br>Charge le fichier « Suivi Agrégation » (.xlsx) : l\u2019app lit l\u2019onglet « BDD Agrégation » et les objectifs du « Dashboard ». Le fichier reste sur cet appareil.</div>';
      return;
    }
    if(parcData.items.length && !parcData.items.some(i=>'siteDept' in i)){ const n=document.createElement('div'); n.className='parc-reload'; n.textContent='Recharge le fichier « Suivi Agrégation » une fois : la carte placera alors chaque centrale à son vrai département (colonne Département2), et non au siège du développeur.'; body.appendChild(n); }
    $('parc-info').textContent=(parcData.fileName||'Fichier')+' · chargé le '+new Date(parcData.importedAt).toLocaleDateString('fr-FR')+' · '+parcData.items.length+' ligne'+(parcData.items.length>1?'s':'')
      +(parcSyncNote?' · '+parcSyncNote:(syncConfig.enabled?' · synchronisé avec tes autres appareils':''));
    const won=parcData.items.filter(p=>p.statut==='Gagné');
    const shown=parcYearsShown();
    if(parcYear!=='all' && !shown.includes(parcYear)) parcYear=shown[0];
    // "all" = the 5 years together: volumes and objectives summed, a contract counts if active in any of them
    const y=parcYear, today=toISO(new Date()), yrs=y==='all'?shown:[y];
    const yLabel=y==='all'?shown[0]+'–'+shown[shown.length-1]:String(y);
    const volOf=p=>yrs.reduce((s,yy)=>s+(p.vols[yy]||0),0);
    const active=won.filter(p=>volOf(p)>0);
    const volY=active.reduce((s,p)=>s+volOf(p),0);
    const objs=yrs.map(yy=>parcData.objectives[yy]).filter(v=>v!=null);
    const obj=objs.length===yrs.length?objs.reduce((s,v)=>s+v,0):null;
    const soon=renewalCandidates();
    const pending=parcData.items.filter(p=>p.statut==='En attente');

    // year chips
    const years=document.createElement('div'); years.className='parc-years';
    shown.forEach(yy=>{ const b=document.createElement('button'); b.type='button'; b.textContent=yy; b.className=yy===y?'on':''; b.onclick=()=>{ parcYear=yy; renderParc(); }; years.appendChild(b); });
    const gb=document.createElement('button'); gb.type='button'; gb.textContent='Global '+shown[0]+'–'+shown[shown.length-1]; gb.className='parc-global'+(y==='all'?' on':''); gb.onclick=()=>{ parcYear='all'; renderParc(); }; years.appendChild(gb);
    const rm=document.createElement('label'); rm.className='parc-renew-setting'; rm.innerHTML='Renouvellement : alerte à <select id="parc-renew-months">'+[3,4,6,9,12].map(m=>'<option value="'+m+'"'+(m===renewMonths()?' selected':'')+'>'+m+' mois</option>').join('')+'</select>';
    rm.querySelector('select').onchange=e=>{ try{ localStorage.setItem('todo_'+RENEW_KEY, e.target.value); }catch(err){} ensureRenewalTasks(); renderParc(); };
    years.appendChild(rm);
    body.appendChild(years);

    const kpis=document.createElement('div'); kpis.className='parc-kpis';
    const kpi=(num,label,sub,cls)=>{ const k=document.createElement('div'); k.className='stat-card'; k.innerHTML='<div class="stat-card-num'+(cls?' '+cls:'')+'">'+escapeHtml(num)+'</div><div class="stat-card-label">'+escapeHtml(label)+'</div>'+(sub?'<div class="parc-kpi-sub">'+escapeHtml(sub)+'</div>':''); kpis.appendChild(k); };
    kpi(fmtGwh(volY), 'Volume agrégé '+yLabel, obj?Math.round(volY/1000/obj*100)+' % de l\u2019objectif ('+obj.toLocaleString('fr-FR')+' GWh)':'', 'accent');
    kpi(String(active.length), 'Contrats actifs '+yLabel, fmtMwc(active.reduce((s,p)=>s+p.kwc,0)));
    kpi(String(soon.length), 'Fins de contrat < '+renewMonths()+' mois', won.filter(p=>p.renouv==='A renouveler').length+' marqués « A renouveler »', soon.length?'crit':'');
    kpi(String(pending.length), 'Offres en attente', fmtMwc(pending.reduce((s,p)=>s+p.kwc,0)));
    body.appendChild(kpis);
    const KPI_KEYS=['vol','active','soon','pending'];
    const KPI_SETS={ vol:active, active:active, soon, pending };
    const KPI_LABELS={ vol:'Contrats du volume '+yLabel, active:'Contrats actifs '+yLabel, soon:'Fins de contrat < '+renewMonths()+' mois', pending:'Offres en attente' };
    parcKpiSet=parcKpi?KPI_SETS[parcKpi]:null; parcKpiLabel=parcKpi?KPI_LABELS[parcKpi]:'';
    kpis.querySelectorAll('.stat-card').forEach((c,i)=>{
      c.dataset.kpi=String(i); c.classList.add('clickable'); c.classList.toggle('on', parcKpi===KPI_KEYS[i]);
      c.onclick=()=>{ parcKpi=parcKpi===KPI_KEYS[i]?null:KPI_KEYS[i]; parcMapSel=null; parcMapView=null; renderParc();
        if(parcKpi){ const m=document.querySelector('#tab-parc .parc-map-block'); if(m) m.scrollIntoView({ behavior:'smooth', block:'start' }); } };
    });
    if(parcKpi){
      const f=document.createElement('div'); f.className='parc-kpi-filter';
      f.innerHTML='<span>Filtre : <b>'+escapeHtml(parcKpiLabel)+'</b> · '+parcKpiSet.length+' installation'+(parcKpiSet.length>1?'s':'')+' · '+escapeHtml(fmtMwc(parcKpiSet.reduce((s,p)=>s+p.kwc,0)))+' — carte et table filtrées</span>';
      const x=document.createElement('button'); x.type='button'; x.textContent='Retirer le filtre'; x.onclick=()=>{ parcKpi=null; renderParc(); }; f.appendChild(x);
      body.appendChild(f);
    }
    attachTip(kpis, t=>{
      const c=t.closest && t.closest('.stat-card'); if(!c) return null;
      const i=+c.dataset.kpi;
      if(i===0){ const by={}; active.forEach(p=>{ by[p.cadre||'Autre']=(by[p.cadre||'Autre']||0)+volOf(p); }); return '<b>Volume '+yLabel+'</b>'+PARC_CADRES.filter(k=>by[k]).map(k=>tipRow(PARC_COLORS[k],k,fmtGwh(by[k]))).join('')+(obj?tipRow('','Objectif',obj.toLocaleString('fr-FR')+' GWh'):''); }
      if(i===1){ const by={}; active.forEach(p=>{ const k=mapTech(p.enr); (by[k]=by[k]||{ n:0, kwc:0 }); by[k].n++; by[k].kwc+=p.kwc; }); return '<b>Contrats actifs '+yLabel+'</b>'+MAP_TECHS.filter(([k])=>by[k]).map(([k,l,col])=>tipRow(col,l,by[k].n+' · '+fmtMwc(by[k].kwc))).join(''); }
      if(i===2){ return '<b>Fins de contrat</b>'+(soon.length?soon.slice().sort((a,b)=>a.fin.localeCompare(b.fin)).slice(0,6).map(p=>tipRow('',p.inst||p.prod,pqIsoToFr(p.fin))).join('')+(soon.length>6?'<span class="muted">+ '+(soon.length-6)+' autres</span>':''):'<span class="muted">Aucune</span>'); }
      if(i===3){ return '<b>Offres en attente</b>'+(pending.length?pending.slice().sort((a,b)=>b.kwc-a.kwc).slice(0,6).map(p=>tipRow('',p.inst||p.prod,p.kwc?fmtKwc(p.kwc):'')).join('')+(pending.length>6?'<span class="muted">+ '+(pending.length-6)+' autres</span>':''):'<span class="muted">Aucune</span>'); }
      return null;
    });

    body.appendChild(parcChart(won));
    body.appendChild(parcMap());

    const two=document.createElement('div'); two.className='parc-two';
    const byDev={}; active.forEach(p=>{ byDev[p.dev]=(byDev[p.dev]||0)+volOf(p); });
    two.appendChild(parcBars('Par développeur · '+yLabel, Object.entries(byDev).sort((a,b)=>b[1]-a[1]).slice(0,12), v=>fmtGwh(v)+' · '+Math.round(v/volY*100)+' %',
      (k,v)=>{ const list=active.filter(p=>p.dev===k); return '<b>'+escapeHtml(k)+'</b>'+tipRow('', 'Volume '+yLabel, fmtGwh(v)+' · '+Math.round(v/volY*100)+' %')+tipRow('', 'Contrats actifs', String(list.length))+tipRow('', 'Puissance', fmtMwc(list.reduce((s,p)=>s+p.kwc,0)))+'<span class="muted">'+escapeHtml(list.slice(0,4).map(p=>p.inst||p.prod).join(', ')+(list.length>4?'…':''))+'</span>'; }));
    const byReg={}; won.filter(p=>!p.fin || p.fin>=today).forEach(p=>{ const k=p.siteRegion||p.region||'Non renseignée'; byReg[k]=(byReg[k]||0)+p.kwc; });
    const regTotal=Object.values(byReg).reduce((s,v)=>s+v,0)||1;
    two.appendChild(parcBars('Par région des centrales · puissance en portefeuille', Object.entries(byReg).sort((a,b)=>b[1]-a[1]), v=>fmtMwc(v),
      (k,v)=>{ const list=won.filter(p=>(!p.fin || p.fin>=today) && (p.siteRegion||p.region||'Non renseignée')===k); return '<b>'+escapeHtml(k)+'</b>'+tipRow('', 'Puissance', fmtMwc(v)+' · '+Math.round(v/regTotal*100)+' %')+tipRow('', 'Installations', String(list.length))+'<span class="muted">'+escapeHtml([...new Set(list.map(p=>(p.siteDept||'').replace(/^\S+\s+-\s+/,'')).filter(Boolean))].slice(0,5).join(', '))+'</span>'; }));
    body.appendChild(two);

    if(soon.length){
      const s=document.createElement('div'); s.className='parc-block';
      s.innerHTML='<div class="parc-h">Échéances dans les '+renewMonths()+' mois · une tâche de renouvellement est créée pour chacune</div>';
      soon.sort((a,b)=>a.fin.localeCompare(b.fin)).forEach(p=>{
        const r=document.createElement('div'); r.className='parc-due';
        const key=parcKey(p), task=tasks.find(t=>t.id===renewGroupId(p)), opp=opportunities.find(o=>!o.deleted && o.renewalOf===key);
        r.innerHTML='<span class="parc-due-date">'+escapeHtml(pqIsoToFr(p.fin))+'</span><span class="parc-due-name">'+escapeHtml(p.prod)+(p.inst?' · '+escapeHtml(p.inst):'')+'</span><span class="parc-due-meta">'+escapeHtml([p.cadre, p.kwc?fmtKwc(p.kwc):'', p.renouv, task?(task.archived?'tâche faite':task.deleted?'tâche supprimée':'tâche de renouvellement créée'):''].filter(Boolean).join(' · '))+'</span>';
        const act=document.createElement('span'); act.className='parc-due-act';
        if(opp){ const b=document.createElement('button'); b.type='button'; b.className='pq-link'; b.textContent='Voir dans le pipeline'; b.onclick=()=>{ document.querySelector('.tab[data-tab="pipeline"]').click(); setTimeout(()=>openOppDetail(opp.id),50); }; act.appendChild(b); }
        else { const b=document.createElement('button'); b.type='button'; b.className='pq-link'; b.textContent='Remettre dans le pipeline'; b.onclick=()=>{ const o=renewalToPipeline(p); document.querySelector('.tab[data-tab="pipeline"]').click(); setTimeout(()=>openOppDetail(o.id),50); }; act.appendChild(b); }
        r.appendChild(act);
        s.appendChild(r);
      });
      body.appendChild(s);
    }
    body.appendChild(parcTable());
  }
  // Hover tooltip for the Portefeuille charts: resolve(target) returns the HTML to show (or null)
  function attachTip(host, resolve){
    host.classList.add('tip-host');
    const tip=document.createElement('div'); tip.className='parc-map-tip chart-tip'; tip.hidden=true; host.appendChild(tip);
    host.addEventListener('mousemove', e=>{
      const html=resolve(e.target); if(!html){ tip.hidden=true; return; }
      tip.innerHTML=html; tip.hidden=false;
      const box=host.getBoundingClientRect(), x=e.clientX-box.left, y=e.clientY-box.top;
      tip.style.left=Math.max(0,Math.min(x+14, box.width-tip.offsetWidth))+'px';
      tip.style.top=(y-tip.offsetHeight-12<0?y+16:y-tip.offsetHeight-12)+'px';
    });
    host.addEventListener('mouseleave', ()=>{ tip.hidden=true; });
  }
  const tipRow=(color,label,value)=>'<span class="tip-row">'+(color?'<i style="background:'+color+'"></i>':'')+'<span>'+escapeHtml(label)+'</span><em>'+escapeHtml(value)+'</em></span>';
  function parcChart(won){
    const wrap=document.createElement('div'); wrap.className='parc-block';
    wrap.innerHTML='<div class="parc-h">Volume agrégé par année (GWh), contrats gagnés</div>';
    const years=parcYearsShown();
    if(!years.length){ wrap.innerHTML+='<p class="parc-muted">Pas de volume renseigné.</p>'; return wrap; }
    const totals=years.map(y=>{ const t={}; PARC_CADRES.forEach(c=>{ t[c]=won.filter(p=>(p.cadre||'Autre')===c).reduce((s,p)=>s+(p.vols[y]||0),0)/1000; }); return t; });
    const max=Math.max(1,...years.map((y,i)=>Math.max(PARC_CADRES.reduce((s,c)=>s+totals[i][c],0), parcData.objectives[y]||0)));
    const step=max>500?200:max>200?100:max>100?50:max>40?20:10, top=Math.ceil(max/step)*step;
    const W=640, H=220, L=40, B=24, T=10, bw=(W-L-10)/years.length;
    let svg='<svg viewBox="0 0 '+W+' '+(H+B+T)+'" class="parc-chart" role="img" aria-label="Volume agrégé par année">';
    for(let v=0; v<=top; v+=step){ const yy=T+H-v/top*H; svg+='<line x1="'+L+'" x2="'+W+'" y1="'+yy+'" y2="'+yy+'" class="grid"/><text x="'+(L-6)+'" y="'+(yy+3)+'" text-anchor="end">'+v+'</text>'; }
    years.forEach((y,i)=>{
      let acc=0; const x=L+i*bw+bw*0.18, w=bw*0.64;
      PARC_CADRES.forEach(c=>{ const v=totals[i][c]; if(!v) return; const h=v/top*H; svg+='<rect x="'+x+'" y="'+(T+H-(acc+h))+'" width="'+w+'" height="'+h+'" fill="'+PARC_COLORS[c]+'"></rect>'; acc+=h; });
      svg+='<text x="'+(x+w/2)+'" y="'+(T+H+15)+'" text-anchor="middle" class="'+((y===parcYear||parcYear==='all')?'on':'')+'">'+y+'</text>';
    });
    const objPts=years.map((y,i)=>parcData.objectives[y]?[L+i*bw+bw/2, T+H-parcData.objectives[y]/top*H]:null).filter(Boolean);
    if(objPts.length>1) svg+='<polyline points="'+objPts.map(p=>p.join(',')).join(' ')+'" class="obj"/>';
    objPts.forEach(p=>{ svg+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="2.5" class="obj-dot"/>'; });
    // one invisible hover zone per year, on top of everything
    years.forEach((y,i)=>{ svg+='<rect class="hz" x="'+(L+i*bw)+'" y="'+T+'" width="'+bw+'" height="'+H+'" data-yi="'+i+'"></rect>'; });
    svg+='</svg>';
    wrap.innerHTML+='<div class="parc-chart-wrap">'+svg+'</div><div class="parc-legend">'+PARC_CADRES.filter(c=>totals.some(t=>t[c])).map(c=>'<span><i style="background:'+PARC_COLORS[c]+'"></i>'+c+'</span>').join('')+(objPts.length?'<span><i class="obj-i"></i>Objectif agrégation</span>':'')+'</div>';
    attachTip(wrap.querySelector('.parc-chart-wrap'), t=>{
      if(!t.dataset || t.dataset.yi==null) return null;
      const i=+t.dataset.yi, y=years[i], tot=PARC_CADRES.reduce((s,c)=>s+totals[i][c],0), obj=parcData.objectives[y];
      const n=won.filter(p=>(p.vols[y]||0)>0).length;
      return '<b>'+y+' · '+(Math.round(tot*10)/10).toLocaleString('fr-FR')+' GWh</b>'
        +PARC_CADRES.filter(c=>totals[i][c]).map(c=>tipRow(PARC_COLORS[c], c, (Math.round(totals[i][c]*10)/10).toLocaleString('fr-FR')+' GWh')).join('')
        +(obj?tipRow('', 'Objectif', obj.toLocaleString('fr-FR')+' GWh · '+Math.round(tot/obj*100)+' %'):'')
        +'<span class="muted">'+n+' contrat'+(n>1?'s':'')+' actif'+(n>1?'s':'')+'</span>';
    });
    return wrap;
  }
  // ---------- Portefeuille map ----------
  // Départements: IGN ADMIN EXPRESS (Licence Ouverte Etalab) via github.com/gregoiredavid/france-geojson, simplified to
  // whole pixels at 560 px wide; drawn in the page (no map service, works offline). Overseas plants are listed under the map.
  // the map (≈180 KB) lives in fr-map.js, loaded the first time the Portefeuille is opened
  let FR_MAP=window.FR_MAP||null, frMapLoading=null, frMapHdLoading=null;
  // finer outlines (≈1 MB, fr-map-hd.js) swapped in when zoomed past ×2.5, so borders stay sharp
  function loadFrMapHd(){
    if(window.FR_MAP_HD) return Promise.resolve();
    if(!frMapHdLoading) frMapHdLoading=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='fr-map-hd.js'; s.onload=res; s.onerror=()=>{ frMapHdLoading=null; rej(); }; document.head.appendChild(s); });
    return frMapHdLoading;
  }
  function loadFrMap(){
    if(FR_MAP) return Promise.resolve();
    if(!frMapLoading) frMapLoading=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='fr-map.js'; s.onload=()=>{ FR_MAP=window.FR_MAP; res(); }; s.onerror=()=>{ frMapLoading=null; rej(new Error('Carte indisponible')); }; document.head.appendChild(s); });
    return frMapLoading;
  }
  let parcMapLayer='won', parcMapSel=null, parcMapAll=false, parcMapView=null;
  // a clicked key figure filters the map and the table: null | 'vol' | 'active' | 'soon' | 'pending'
  let parcKpi=null, parcKpiSet=null, parcKpiLabel='';   // view = zoomed box in map units, null = all France
  const deptCodeOf=label=>{ const m=/^\s*(\d{1,3}|2A|2B)\b/i.exec(String(label||'')); if(!m) return null; const c=m[1].toUpperCase(); return /^\d$/.test(c)?'0'+c:c; };
  // technology of a plant, for the map colours (muted, so the map stays quiet and the dots read first)
  const MAP_TECHS=[ ['PV','Solaire PV','#E3B448'], ['Eolien','Éolien','#8EC5E8'], ['Hydro','Hydro','#6E9CF0'], ['Biogaz','Biogaz','#9CC37A'], ['Autre','Autre','#8B95A5'] ];
  const mapTech=v=>{ const f=pqFold(v||''); return /eol/.test(f)?'Eolien':/hydro/.test(f)?'Hydro':/bio|metha|cogen/.test(f)?'Biogaz':/pv|photo|solaire|ombri|toiture/.test(f)?'PV':'Autre'; };
  function parcMapPoints(layer){
    const today=toISO(new Date());
    if(parcKpiSet) return parcKpiSet.map(p=>({ code:deptCodeOf(p.siteDept||p.dept), kwc:p.kwc||0, tech:mapTech(p.enr), name:p.inst||p.prod, prod:p.prod||p.dev, who:p.dev, ref:{ parc:p }, extra:p.fin?'fin '+pqIsoToFr(p.fin):p.statut }));
    if(layer==='pipe') return opportunities.filter(o=>!o.deleted && o.kind==='installation' && !isExited(o)).map(o=>({ code:deptCodeOf(o.dept), kwc:pqNum(o.kwc||'')||0, tech:mapTech(o.install), name:oppName(o), prod:o.producteur||o.company, who:o.company, ref:{ opp:o.id }, extra:stageLabel(o.stage) }));
    if(!parcData) return [];
    const list=layer==='pending'?parcData.items.filter(p=>p.statut==='En attente'||p.statut==='En préparation'):parcData.items.filter(p=>p.statut==='Gagné' && (!p.fin || p.fin>=today));
    return list.map(p=>({ code:deptCodeOf(p.siteDept||p.dept), kwc:p.kwc||0, tech:mapTech(p.enr), name:p.inst||p.prod, prod:p.prod||p.dev, who:p.dev, ref:{ parc:p }, extra:p.fin?'fin '+pqIsoToFr(p.fin):p.statut }));
  }
  // a plant of the map → its opportunity (pipeline) or its client's sheet (contract of the Portefeuille)
  function openMapPoint(p){
    if(p.ref && p.ref.opp){ gsTab('pipeline'); setTimeout(()=>openOppDetail(p.ref.opp),30); return; }
    const known=allCompanyNames(), pick=[p.who,p.prod].find(n=>n && known.some(k=>sameCo(k,n)));
    openCompanySheet(pick||p.who||p.prod||'');
  }
  function parcMap(){
    if(!FR_MAP){
      const w=document.createElement('div'); w.className='parc-block parc-map-block'; w.innerHTML='<div class="parc-h">Carte</div><p class="parc-muted">Chargement de la carte…</p>';
      loadFrMap().then(()=>{ if(!$('tab-parc').classList.contains('hidden')) renderParc(); }).catch(()=>{ w.querySelector('p').textContent='Carte indisponible hors ligne (elle sera disponible après une ouverture avec réseau).'; });
      return w;
    }
    const color=t=>(MAP_TECHS.find(x=>x[0]===t)||MAP_TECHS[4])[2];
    const techLabel=t=>(MAP_TECHS.find(x=>x[0]===t)||MAP_TECHS[4])[1];
    const wrap=document.createElement('div'); wrap.className='parc-block parc-map-block';
    const head=document.createElement('div'); head.className='map-head';
    head.innerHTML='<div class="parc-h">Carte</div>';
    const seg=document.createElement('div'); seg.className='map-seg';
    [['won','Portefeuille'],['pending','Offres'],['pipe','Pipeline']].forEach(([k,l])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=l; b.className=k===parcMapLayer?'on':''; b.onclick=()=>{ parcMapLayer=k; parcMapSel=null; parcMapView=null; renderParc(); }; seg.appendChild(b); });
    if(!parcKpiSet) head.appendChild(seg); wrap.appendChild(head);

    const pts=parcMapPoints(parcMapLayer);
    const by={}, elsewhere=[];
    pts.forEach(p=>{ const metro=p.code && FR_MAP.deps.some(d=>d[0]===p.code); if(!metro){ elsewhere.push(p); return; } (by[p.code]=by[p.code]||{ kwc:0, n:0, names:[] }); by[p.code].kwc+=p.kwc; by[p.code].n++; by[p.code].names.push(p); });
    const maxKwc=Math.max(1,...pts.map(p=>p.kwc||0));

    // land in one quiet tone, départements separated by hairlines; dots carry the information
    // a margin around France so the coast and Corsica are never cut by the frame's rounded corners
    const MP=14, FULLW=FR_MAP.w+2*MP, FULLH=FR_MAP.h+2*MP;
    let svg='<svg viewBox="'+(-MP)+' '+(-MP)+' '+FULLW+' '+FULLH+'" class="parc-map" role="img" aria-label="Carte du portefeuille par département">';
    // départements tinted by their MWc (square root: small ones stay visible), a dot per plant on top
    const maxDepKwc=Math.max(1,...Object.values(by).map(v=>v.kwc));
    const shade=k=>{ const t=.25+.75*Math.sqrt(k/maxDepKwc), a=[0x2A,0x33,0x40], b=[0x4F,0x6F,0x96]; return '#'+a.map((x,i)=>Math.round(x+(b[i]-x)*t).toString(16).padStart(2,'0')).join(''); };
    // fills (no stroke), département hairlines, then the real borders of the 13 regions and the coast in white
    FR_MAP.deps.forEach(([code,name,d])=>{ svg+='<path d="'+d+'" class="dep'+(by[code]?' has':'')+'"'+(by[code]?' style="--f:'+shade(by[code].kwc)+'"':'')+' data-dep="'+code+'" data-name="'+escapeHtml(name)+'"></path>'; });
    FR_MAP.deps.forEach(([code,name,d])=>{ svg+='<path d="'+d+'" vector-effect="non-scaling-stroke" class="dep-line" data-ln="'+code+'"></path>'; });
    svg+='<path d="'+FR_MAP.regions+'" vector-effect="non-scaling-stroke" class="reg-line"></path>';
    if(parcMapSel){ const sd=FR_MAP.deps.find(x=>x[0]===parcMapSel); if(sd) svg+='<path d="'+sd[2]+'" vector-effect="non-scaling-stroke" class="dep-sel" data-ln="'+parcMapSel+'"></path>'; }
    const dots=[];
    Object.entries(by).forEach(([code,v])=>{
      const dep=FR_MAP.deps.find(d=>d[0]===code);
      v.names.slice().sort((a,b)=>b.kwc-a.kwc).forEach((p,i)=>{
        // spiral around the centre of the département, spaced wider than the biggest dot: no overlap
        const ang=i*2.39996, rad=5*Math.sqrt(i);
        dots.push({ p, code, x:dep[3]+Math.cos(ang)*rad, y:dep[4]+Math.sin(ang)*rad, r:1.9+1.7*Math.sqrt((p.kwc||0)/maxKwc) });
      });
    });
    dots.forEach((d,i)=>{ svg+='<circle cx="'+d.x.toFixed(1)+'" cy="'+d.y.toFixed(1)+'" r="'+d.r.toFixed(1)+'" data-r0="'+d.r.toFixed(2)+'" vector-effect="non-scaling-stroke" style="--c:'+color(d.p.tech)+'" class="dot'+(parcMapSel && parcMapSel!==d.code?' dim':'')+'" data-dep="'+d.code+'" data-i="'+i+'"></circle>'; });
    svg+='</svg>';

    const grid=document.createElement('div'); grid.className='parc-map-grid';
    const mapEl=document.createElement('div'); mapEl.className='parc-map-wrap'; mapEl.innerHTML=svg;
    const tip=document.createElement('div'); tip.className='parc-map-tip'; tip.hidden=true; mapEl.appendChild(tip);
    mapEl.addEventListener('mousemove', e=>{
      const t=e.target.closest('[data-dep]'); if(!t){ tip.hidden=true; return; }
      let html;
      if(t.dataset.i!=null){ const p=dots[+t.dataset.i].p; html='<b>'+escapeHtml(p.name)+'</b><span><i style="background:'+color(p.tech)+'"></i>'+escapeHtml([techLabel(p.tech), p.kwc?fmtKwc(p.kwc):''].filter(Boolean).join(' · '))+'</span><span class="muted">'+escapeHtml([p.prod||p.who, p.extra].filter(Boolean).join(' · '))+'</span>'; }
      else { const v=by[t.dataset.dep]; if(!v){ tip.hidden=true; return; } html='<b>'+escapeHtml(t.dataset.name||'')+'</b><span>'+v.n+' installation'+(v.n>1?'s':'')+' · '+escapeHtml(fmtMwc(v.kwc))+'</span>'; }
      tip.innerHTML=html; tip.hidden=false;
      const box=mapEl.getBoundingClientRect(), x=e.clientX-box.left, y=e.clientY-box.top;
      tip.style.left=Math.max(0,Math.min(x+12, box.width-tip.offsetWidth))+'px'; tip.style.top=Math.max(0, y-tip.offsetHeight-12)+'px';
    });
    mapEl.addEventListener('mouseleave', ()=>{ tip.hidden=true; });
    // --- zoom & pan: wheel, + / − / reset buttons, drag; a click on a département zooms on it
    const svgEl=mapEl.querySelector('svg'), FULL={ x:-MP, y:-MP, w:FULLW, h:FULLH };
    const applyView=()=>{
      const v=parcMapView||FULL; svgEl.setAttribute('viewBox', v.x+' '+v.y+' '+v.w+' '+v.h);
      const s=v.w/FULL.w;   // dots keep their size on screen, so they spread apart when zooming in
      // and grow a little when zoomed in (×1.6 at the closest zoom) so they stay easy to point at
      svgEl.querySelectorAll('.dot').forEach(c=>c.setAttribute('r', (c.dataset.r0*s*(1+(1-s)*.7)).toFixed(2)));
      // zoomed in: high-detail outlines, and no drop shadow (a filter makes the browser rasterise the drawing)
      const hd=s<.4; svgEl.classList.toggle('zoomed', hd);
      const swap=useHd=>{
        if(svgEl.dataset.hd===String(useHd)) return; svgEl.dataset.hd=String(useHd);
        const src=useHd?window.FR_MAP_HD:null, base=Object.fromEntries(FR_MAP.deps.map(x=>[x[0],x[2]]));
        svgEl.querySelectorAll('.dep').forEach(p=>p.setAttribute('d', src?src.deps[p.dataset.dep]||base[p.dataset.dep]:base[p.dataset.dep]));
        svgEl.querySelectorAll('[data-ln]').forEach(p=>p.setAttribute('d', src?src.deps[p.dataset.ln]||base[p.dataset.ln]:base[p.dataset.ln]));
        const rl=svgEl.querySelector('.reg-line'); if(rl) rl.setAttribute('d', src?src.regions:FR_MAP.regions);
      };
      if(hd){ if(window.FR_MAP_HD) swap(true); else loadFrMapHd().then(()=>{ if(svgEl.isConnected && svgEl.classList.contains('zoomed')) swap(true); }).catch(()=>{}); }
      else swap(false);
      zoomOut.disabled=reset.disabled=!parcMapView;
    };
    const clampView=v=>{ const w=Math.min(FULL.w, Math.max(FULL.w/14, v.w)), hh=w*FULL.h/FULL.w; return { w, h:hh, x:Math.min(FULL.w-w*.3, Math.max(-w*.7, v.x)), y:Math.min(FULL.h-hh*.3, Math.max(-hh*.7, v.y)) }; };
    const zoomAt=(f, cx, cy)=>{ const v=parcMapView||FULL; const nw=Math.max(FULL.w/14, v.w*f); if(nw>=FULL.w){ parcMapView=null; applyView(); return; } f=nw/v.w; parcMapView=clampView({ w:nw, h:nw*FULL.h/FULL.w, x:cx-(cx-v.x)*f, y:cy-(cy-v.y)*f }); applyView(); };
    const toMap=(clientX, clientY)=>{ const r=svgEl.getBoundingClientRect(), v=parcMapView||FULL; return [v.x+(clientX-r.left)/r.width*v.w, v.y+(clientY-r.top)/r.height*v.h]; };
    const zc=document.createElement('div'); zc.className='map-zoom';
    const mk=(txt,title,fn)=>{ const b=document.createElement('button'); b.type='button'; b.textContent=txt; b.title=title; b.onclick=e=>{ e.stopPropagation(); fn(); }; zc.appendChild(b); return b; };
    mk('+','Zoomer',()=>{ const v=parcMapView||FULL; zoomAt(.6, v.x+v.w/2, v.y+v.h/2); });
    const zoomOut=mk('−','Dézoomer',()=>{ const v=parcMapView||FULL; zoomAt(1/.6, v.x+v.w/2, v.y+v.h/2); });
    const reset=mk('⤢','Toute la France',()=>{ parcMapView=null; applyView(); });
    mapEl.appendChild(zc);
    mapEl.addEventListener('wheel', e=>{ e.preventDefault(); const [x,y]=toMap(e.clientX,e.clientY); zoomAt(e.deltaY<0?.8:1.25, x, y); }, { passive:false });
    let drag=null, moved=false;
    // pan only once the pointer really moves: capturing it on press would steal the click from the département under it
    svgEl.addEventListener('pointerdown', e=>{ if(!parcMapView) return; drag={ x:e.clientX, y:e.clientY, v:parcMapView, id:e.pointerId }; moved=false; });
    svgEl.addEventListener('pointermove', e=>{ if(!drag) return; if(!moved){ if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)<=3) return; moved=true; try{ svgEl.setPointerCapture(drag.id); }catch(_){} } const r=svgEl.getBoundingClientRect(); const dx=(e.clientX-drag.x)/r.width*drag.v.w, dy=(e.clientY-drag.y)/r.height*drag.v.h; parcMapView=clampView({ ...drag.v, x:drag.v.x-dx, y:drag.v.y-dy }); applyView(); });
    const endDrag=()=>{ drag=null; }; svgEl.addEventListener('pointerup', endDrag); svgEl.addEventListener('pointercancel', endDrag);
    mapEl.addEventListener('click', e=>{
      if(moved){ moved=false; return; }
      const hit=document.elementFromPoint(e.clientX, e.clientY)||e.target, t=hit.closest && hit.closest('[data-dep]');
      if(t && !by[t.dataset.dep]) return;   // a département with no plant: nothing to open, keep the current selection
      if(!t){ if(parcMapSel){ parcMapSel=null; renderParc(); } return; }
      // in the open département, a plant opens its sheet; elsewhere the first click opens the département
      if(parcMapSel===t.dataset.dep && t.dataset.i!=null && dots[+t.dataset.i]){ openMapPoint(dots[+t.dataset.i].p); return; }
      if(parcMapSel===t.dataset.dep){ parcMapSel=null; parcMapView=null; renderParc(); return; }
      parcMapSel=t.dataset.dep;
      const dep=svgEl.querySelector('path[data-dep="'+parcMapSel+'"]');
      if(dep){ const bb=dep.getBBox(), w=Math.max(FULL.w/6, Math.max(bb.width, bb.height*FULL.w/FULL.h)*2.2); parcMapView=clampView({ w, h:w*FULL.h/FULL.w, x:bb.x+bb.width/2-w/2, y:bb.y+bb.height/2-w*FULL.h/FULL.w/2 }); }
      renderParc();
    });
    grid.appendChild(mapEl);
    requestAnimationFrame(applyView);

    // side: one big figure, the technology mix as a thin bar, then the départements (or the plants of the selected one)
    const side=document.createElement('div'); side.className='parc-map-side';
    const selV=parcMapSel && by[parcMapSel];
    const scope=selV?selV.names:pts;
    const total=scope.reduce((s,p)=>s+p.kwc,0);
    const top=document.createElement('div'); top.className='map-figure';
    if(selV){
      const dep=FR_MAP.deps.find(d=>d[0]===parcMapSel);
      const back=document.createElement('button'); back.type='button'; back.className='map-back'; back.textContent='← Toute la France'; back.onclick=()=>{ parcMapSel=null; parcMapView=null; renderParc(); };
      side.appendChild(back);
      top.innerHTML='<div class="map-eyebrow">'+escapeHtml(dep[1])+' · '+parcMapSel+'</div>';
    } else top.innerHTML='<div class="map-eyebrow">'+escapeHtml(parcKpiSet?parcKpiLabel:({ won:'Portefeuille signé', pending:'Offres en attente', pipe:'Pipeline' })[parcMapLayer])+'</div>';
    top.innerHTML+='<div class="map-big">'+escapeHtml(fmtMwc(total))+'</div><div class="map-sub">'+scope.length+' installation'+(scope.length>1?'s':'')+'</div>';
    side.appendChild(top);
    const mix=MAP_TECHS.map(([k,l,c])=>{ const list=scope.filter(p=>p.tech===k); return { k, l, c, n:list.length, kwc:list.reduce((x,p)=>x+p.kwc,0) }; }).filter(m=>m.n);
    if(mix.length){
      const bar=document.createElement('div'); bar.className='map-mix';
      mix.forEach(m=>{ const s=document.createElement('span'); s.style.flex=String(Math.max(m.kwc,1)); s.style.background=m.c; s.dataset.m=m.k; bar.appendChild(s); });
      side.appendChild(bar);
      attachTip(bar, t=>{ const m=t.dataset && mix.find(x=>x.k===t.dataset.m); return m?'<b>'+escapeHtml(m.l)+'</b>'+tipRow(m.c,'Installations',String(m.n))+tipRow('','Puissance',fmtMwc(m.kwc)+' · '+Math.round(m.kwc/(total||1)*100)+' %'):null; });
      const leg=document.createElement('div'); leg.className='map-rows';
      mix.forEach(m=>{ const r=document.createElement('div'); r.className='map-row'; r.innerHTML='<span class="map-k"><i style="background:'+m.c+'"></i>'+escapeHtml(m.l)+'</span><span class="map-v">'+m.n+'</span><span class="map-v">'+escapeHtml(fmtMwc(m.kwc))+'</span>'; leg.appendChild(r); });
      side.appendChild(leg);
    }
    const listH=document.createElement('div'); listH.className='map-eyebrow map-list-h'; listH.textContent=selV?'Installations':'Départements';
    side.appendChild(listH);
    const rows=document.createElement('div'); rows.className='map-rows map-scroll';
    if(selV){
      selV.names.slice().sort((a,b)=>b.kwc-a.kwc).forEach(p=>{ const r=document.createElement('button'); r.type='button'; r.className='map-row two map-plant'; r.onclick=()=>openMapPoint(p); r.innerHTML='<span class="map-k"><i style="background:'+color(p.tech)+'"></i>'+escapeHtml(p.name)+(p.prod && p.prod!==p.name?'<span class="map-p">'+escapeHtml(p.prod)+'</span>':'')+'</span><span class="map-v">'+escapeHtml(p.kwc?fmtKwc(p.kwc):'')+'</span>'; r.title=[p.prod,p.extra].filter(Boolean).join(' · ')+(p.ref&&p.ref.opp?' — ouvrir l\u2019opportunité':' — ouvrir la fiche client'); rows.appendChild(r); });
    } else {
      const ranked=Object.entries(by).sort((a,b)=>b[1].kwc-a[1].kwc);
      const maxDep=ranked.length?ranked[0][1].kwc:1;
      ranked.slice(0, parcMapAll?ranked.length:6).forEach(([code,v])=>{
        const dep=FR_MAP.deps.find(d=>d[0]===code);
        const r=document.createElement('button'); r.type='button'; r.className='map-row map-dep';
        r.innerHTML='<span class="map-k">'+escapeHtml(dep[1])+'</span><span class="map-v">'+v.n+'</span><span class="map-v">'+escapeHtml(fmtMwc(v.kwc))+'</span><span class="map-line"><span style="width:'+Math.max(3,v.kwc/maxDep*100)+'%"></span></span>';
        r.onclick=()=>{ parcMapSel=code; parcMapView=null; renderParc(); };
        r.dataset.dep=code;
        rows.appendChild(r);
      });
      attachTip(rows, t=>{ const r=t.closest && t.closest('.map-dep'); if(!r) return null; const v=by[r.dataset.dep], dep=FR_MAP.deps.find(d=>d[0]===r.dataset.dep);
        return '<b>'+escapeHtml(dep[1])+' · '+escapeHtml(fmtMwc(v.kwc))+'</b>'+v.names.slice().sort((a,b)=>b.kwc-a.kwc).slice(0,6).map(p=>tipRow(color(p.tech), p.name, p.kwc?fmtKwc(p.kwc):'')).join('')+(v.names.length>6?'<span class="muted">+ '+(v.names.length-6)+' autres</span>':''); });
    }
    side.appendChild(rows);
    // no inner scroll bar: the 6 biggest départements, the rest on demand
    if(!selV && Object.keys(by).length>6){ const more=document.createElement('button'); more.type='button'; more.className='map-more'; more.textContent=parcMapAll?'Réduire':'Voir les '+Object.keys(by).length+' départements'; more.onclick=()=>{ parcMapAll=!parcMapAll; renderParc(); }; side.appendChild(more); }
    if(elsewhere.length && !selV){ const o=document.createElement('div'); o.className='map-foot'; o.textContent='Hors métropole ou non localisé : '+elsewhere.length+' · '+fmtMwc(elsewhere.reduce((s,p)=>s+p.kwc,0)); o.title=elsewhere.map(p=>p.name).join(', '); side.appendChild(o); }
    grid.appendChild(side); wrap.appendChild(grid);
    return wrap;
  }

  // ---------- Excel source of the Portefeuille: link to open it, automatic refresh through the local Excel bridge ----------
  // A web page cannot read a file on SharePoint by itself (sign-in + the browser blocks it); the bridge reads the
  // synced copy on the computer instead. The link is kept to open the file in one click.
  const PARC_SRC_KEY='todo_parc-source';
  const parcSource=()=>{ try{ return Object.assign({ link:'', auto:true }, JSON.parse(localStorage.getItem(PARC_SRC_KEY)||'{}')); }catch(e){ return { link:'', auto:true }; } };
  const saveParcSource=s=>{ try{ localStorage.setItem(PARC_SRC_KEY, JSON.stringify(s)); }catch(e){} };
  function renderParcSource(){
    const s=parcSource();
    $('parc-link').value=s.link||''; $('parc-auto').checked=!!s.auto;
    const a=$('parc-open-link'); const ok=/^https:\/\//i.test(s.link||''); a.classList.toggle('hidden', !ok); if(ok) a.href=s.link;
    $('parc-source-hint').textContent=bridgeConfigured()
      ? (s.auto?'Actualisation automatique active : le pont Excel de cet ordinateur relit le fichier synchronisé à l\u2019ouverture du portefeuille puis toutes les 15 minutes.':'Actualisation automatique désactivée : utilise « Lire depuis l\u2019Excel ».')
      : 'L\u2019actualisation automatique passe par le pont Excel de l\u2019ordinateur (Réf. & data → Pont Excel), qui lit la copie synchronisée du fichier. Sans lui (sur le téléphone par exemple), recharge le fichier avec « Charger le Suivi Agrégation ».';
  }
  setInterval(()=>{ if(parcSource().auto && bridgeConfigured()) importParcFromBridge(true); }, 15*60*1000);

  function parcBars(title, entries, fmt, tipFn){
    const b=document.createElement('div'); b.className='parc-block';
    b.innerHTML='<div class="parc-h">'+escapeHtml(title)+'</div>';
    const max=Math.max(1,...entries.map(e=>e[1]));
    entries.forEach(([k,v])=>{
      const r=document.createElement('div'); r.className='parc-bar';
      r.innerHTML='<span class="parc-bar-k">'+escapeHtml(k)+'</span><span class="parc-bar-track"><span style="width:'+Math.max(2,v/max*100)+'%"></span></span><span class="parc-bar-v">'+escapeHtml(fmt(v))+'</span>';
      r.dataset.k=k;
      b.appendChild(r);
    });
    if(!entries.length) b.innerHTML+='<p class="parc-muted">—</p>';
    if(tipFn && entries.length){ const byK=new Map(entries); attachTip(b, t=>{ const row=t.closest && t.closest('.parc-bar'); return row?tipFn(row.dataset.k, byK.get(row.dataset.k)):null; }); }
    return b;
  }
  function parcTable(){
    const b=document.createElement('div'); b.className='parc-block';
    const statuts=['Gagné','En attente','En préparation','Tous'];
    const head=document.createElement('div'); head.className='parc-table-head';
    head.innerHTML='<div class="parc-h">Installations</div>';
    const chips=document.createElement('div'); chips.className='parc-chips';
    if(parcKpiSet){ const c=document.createElement('button'); c.type='button'; c.className='on'; c.textContent=parcKpiLabel+' ✕'; c.title='Retirer le filtre'; c.onclick=()=>{ parcKpi=null; renderParc(); }; chips.appendChild(c); }
    else statuts.forEach(s=>{ const c=document.createElement('button'); c.type='button'; c.className=s===parcFilter?'on':''; c.textContent=s; c.onclick=()=>{ parcFilter=s; renderParc(); }; chips.appendChild(c); });
    head.appendChild(chips);
    const search=document.createElement('input'); search.type='search'; search.placeholder='Producteur, installation, département…'; search.value=parcSearch; search.className='parc-search'; search.id='parc-search';
    search.oninput=()=>{ parcSearch=search.value; const pos=search.selectionStart; renderParc(); const s=$('parc-search'); s.focus({preventScroll:true}); try{ s.setSelectionRange(pos,pos); }catch(e){} };
    head.appendChild(search);
    b.appendChild(head);
    const q=pqFold(parcSearch);
    const list=(parcKpiSet||parcData.items.filter(p=>parcFilter==='Tous'||p.statut===parcFilter)).filter(p=>!q||pqFold([p.prod,p.inst,p.dev,p.siteDept,p.dept,p.region,p.cadre].join(' ')).includes(q))
      .sort((a,c)=>(a.prod||'').localeCompare(c.prod||'','fr'));
    const wrap=document.createElement('div'); wrap.className='parc-table-wrap';
    let t='<table class="parc-table"><thead><tr><th>Producteur</th><th>Installation</th><th>Dépt</th><th>EnR</th><th class="n">Puissance</th><th class="n">P50</th><th>Cadre</th><th>Statut</th><th>Fin</th></tr></thead><tbody>';
    list.forEach(p=>{ t+='<tr><td>'+escapeHtml(p.prod)+'</td><td>'+escapeHtml(p.inst)+'</td><td>'+escapeHtml((p.siteDept||p.dept).replace(/\s-\s.*/,''))+'</td><td>'+escapeHtml(p.enr)+'</td><td class="n">'+(p.kwc?escapeHtml(fmtKwc(p.kwc)):'')+'</td><td class="n">'+(p.p50?Math.round(p.p50).toLocaleString('fr-FR'):'')+'</td><td>'+escapeHtml(p.cadre)+'</td><td>'+escapeHtml(p.statut)+(p.renouv==='A renouveler'?' <span class="parc-flag">à renouveler</span>':'')+'</td><td>'+escapeHtml(pqIsoToFr(p.fin))+'</td></tr>'; });
    t+='</tbody></table>';
    wrap.innerHTML=t+(list.length?'':'<p class="parc-muted">Aucune installation.</p>');
    b.appendChild(wrap);
    const n=document.createElement('div'); n.className='parc-muted'; n.textContent=list.length+' installation'+(list.length>1?'s':'')+' · '+fmtMwc(list.reduce((s,p)=>s+p.kwc,0));
    b.appendChild(n);
    return b;
  }

  // ---------- Contacts → phone (vCard), without duplicates ----------
  // Each contact remembers when it was last exported (vcfAt, synced), so a second export only sends new ones.
  // Contacts sharing an email or a phone number inside the app are exported once.
  function vcfEscape(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/([,;])/g,'\\$1'); }
  function contactToVcf(c){
    const lines=['BEGIN:VCARD','VERSION:3.0','UID:todo-'+c.id,
      'N:'+vcfEscape(c.lastName)+';'+vcfEscape(c.firstName)+';;;',
      'FN:'+vcfEscape([c.firstName,c.lastName].filter(Boolean).join(' ')||c.email||c.company)];
    if(c.company) lines.push('ORG:'+vcfEscape(c.company));
    if(c.role) lines.push('TITLE:'+vcfEscape(c.role));
    [c.phone1,c.phone2].filter(Boolean).forEach((p,i)=>lines.push('TEL;TYPE='+(i===0?'CELL':'WORK')+':'+p.replace(/[^\d+]/g,'')));
    if(c.email) lines.push('EMAIL;TYPE=INTERNET:'+c.email.trim().toLowerCase());
    if(c.comment) lines.push('NOTE:'+vcfEscape(c.comment));
    lines.push('CATEGORIES:Todo','END:VCARD');
    return lines.join('\r\n');
  }
  function vcfKey(c){
    const keys=[];
    if(c.email) keys.push('m:'+c.email.trim().toLowerCase());
    [c.phone1,c.phone2].filter(Boolean).forEach(p=>{ const d=p.replace(/\D/g,'').replace(/^33/,'0'); if(d.length>=9) keys.push('t:'+d.slice(-9)); });
    if(!keys.length) keys.push('n:'+pqFold((c.firstName||'')+' '+(c.lastName||'')+' '+(c.company||'')).trim());
    return keys;
  }
  function vcfCandidates(mode){
    const live=contacts.filter(c=>!c.deleted && (c.firstName||c.lastName) && (c.phone1||c.phone2||c.email));
    // inside the app: contacts sharing an email or a phone become one card (most recent first, gaps filled from the others)
    const groups=[], byKey=new Map(); let dupes=0;
    live.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).forEach(c=>{
      const ks=vcfKey(c), g=ks.map(k=>byKey.get(k)).find(Boolean);
      if(g){ g.members.push(c); dupes++; } else { const ng={ members:[c] }; groups.push(ng); ks.forEach(k=>byKey.set(k,ng)); return; }
      ks.forEach(k=>byKey.set(k,g));
    });
    const unique=groups.map(g=>{
      const m=Object.assign({}, g.members[0]); m.members=g.members;
      g.members.slice(1).forEach(o=>['firstName','lastName','role','company','email','phone1','phone2','comment'].forEach(k=>{ if(!m[k] && o[k]) m[k]=o[k]; }));
      if(m.phone2 && m.phone1 && m.phone2.replace(/\D/g,'').slice(-9)===m.phone1.replace(/\D/g,'').slice(-9)) m.phone2='';
      m.vcfAt=Math.min(...g.members.map(x=>x.vcfAt||0))||0;
      m.updatedAt=Math.max(...g.members.map(x=>x.updatedAt||0));
      if(g.members.some(x=>x.vcfAt)) m.vcfAt=Math.max(...g.members.map(x=>x.vcfAt||0));
      return m;
    });
    const fresh=unique.filter(c=>!c.vcfAt), changed=unique.filter(c=>c.vcfAt && (c.updatedAt||0)>c.vcfAt);
    const list=mode==='all'?unique:mode==='changed'?fresh.concat(changed):fresh;
    return { list, fresh, changed, dupes, total:unique.length };
  }
  function openVcfExport(){
    const r=vcfCandidates('new');
    $('vcf-new').textContent=r.fresh.length;
    $('vcf-changed').textContent=r.changed.length;
    $('vcf-dupes').textContent=r.dupes?r.dupes+' contact'+(r.dupes>1?'s':'')+' en double dans l\u2019app (même mail ou téléphone) ne seront exportés qu\u2019une fois.':'';
    $('vcf-mode-changed').checked=false; $('vcf-mode-all').checked=false;
    $('vcf-status').textContent='';
    $('vcf-overlay').classList.remove('hidden');
  }
  async function doVcfExport(){
    const mode=$('vcf-mode-all').checked?'all':$('vcf-mode-changed').checked?'changed':'new';
    const { list }=vcfCandidates(mode);
    if(!list.length){ $('vcf-status').textContent='Rien de nouveau à exporter.'; return; }
    const text=list.map(contactToVcf).join('\r\n')+'\r\n';
    const name='contacts-todo-'+toISO(new Date())+'.vcf';
    const file=new File([text], name, { type:'text/vcard' });
    let sent=false;
    try{
      if(navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title:'Contacts Todo' }); sent=true; }
    }catch(e){ if(e && e.name==='AbortError'){ $('vcf-status').textContent='Partage annulé : rien n\u2019a été marqué comme exporté.'; return; } }
    if(!sent){ const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000); }
    const now=Date.now();
    list.forEach(m=>(m.members||[m]).forEach(c=>{ c.vcfAt=now; c.updatedAt=now; }));
    saveCrm();
    $('vcf-status').textContent=list.length+' contact'+(list.length>1?'s':'')+' exporté'+(list.length>1?'s':'')+'. Ouvre le fichier sur le téléphone pour les ajouter.';
    $('vcf-new').textContent='0';
  }

  $('bridge-token').value=bridgeCfg.token||'';
  $('bridge-save-btn').onclick=()=>{ bridgeCfg.token=$('bridge-token').value.trim(); saveBridgeCfg(); $('bridge-status').textContent='Test…'; bridgeCheck(); };
  $('parc-bridge-btn').onclick=()=>importParcFromBridge(false);
  $('parc-source-btn').onclick=()=>{ $('parc-source').classList.toggle('hidden'); renderParcSource(); };
  $('parc-link-save').onclick=()=>{ const v=$('parc-link').value.trim(); if(v && !/^https:\/\//i.test(v)){ $('parc-source-hint').textContent='Le lien doit commencer par https://'; return; } const s=parcSource(); s.link=v; saveParcSource(s); renderParcSource(); };
  $('parc-auto').onchange=()=>{ const s=parcSource(); s.auto=$('parc-auto').checked; saveParcSource(s); renderParcSource(); };
  $('parc-file').addEventListener('change', e=>{ if(e.target.files[0]) importParcFile(e.target.files[0]); e.target.value=''; });
  $('vcf-btn').onclick=openVcfExport;
  $('help-btn').onclick=()=>$('guide-overlay').classList.remove('hidden');
  $('guide-close').onclick=()=>$('guide-overlay').classList.add('hidden');
  $('guide-overlay').addEventListener('click', e=>{ if(e.target.id==='guide-overlay') $('guide-overlay').classList.add('hidden'); });
  // « ? » outside a field: the guide, straight on the shortcuts
  function openGuideKeys(){ $('guide-nav').querySelector('[data-g="taches"]').click(); $('guide-overlay').classList.remove('hidden'); const h=$('guide-keys'); if(h) h.scrollIntoView({ block:'start' }); }
  document.addEventListener('keydown', e=>{
    if(e.key!=='?' || e.ctrlKey || e.metaKey || e.altKey || window.TODO_WIDGET) return;
    const t=e.target; if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if(document.querySelector('.modal-overlay:not(.hidden)') || !$('gs-overlay').hidden) return;
    e.preventDefault(); openGuideKeys();
  });
  $('guide-nav').addEventListener('click', e=>{
    const b=e.target.closest('[data-g]'); if(!b) return;
    $('guide-nav').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
    $('guide-overlay').querySelectorAll('.guide-body section').forEach(s=>{ s.hidden=s.dataset.g!==b.dataset.g; });
  });
  $('vcf-go').onclick=doVcfExport;
  $('vcf-close').onclick=()=>$('vcf-overlay').classList.add('hidden');
  // Escape closes the small windows like their « Annuler / Fermer » button — the one on top only, never the sheet under it.
  // (The opportunity form is left out on purpose: Escape must not throw away what was typed.)
  window.addEventListener('keydown', e=>{
    if(e.key!=='Escape') return;
    const top=[['stage-advance-overlay',closeStageAdvance],['company-edit-overlay',closeCompanyEditForm],['ct-merge-overlay',()=>$('ct-merge-close').click()],
      ['sig-paste-overlay',()=>$('sig-paste-cancel').click()],['week-overlay',()=>$('week-overlay').classList.add('hidden')],['daynotes-overlay',()=>$('daynotes-overlay').classList.add('hidden')],['vcf-overlay',()=>$('vcf-close').click()]].find(([id])=>{ const o=$(id); return o && !o.classList.contains('hidden'); });
    if(!top || !$('choice-overlay').classList.contains('hidden')) return;
    e.preventDefault(); e.stopImmediatePropagation(); top[1]();
  }, true);
  $('vcf-mode-all').onchange=()=>{ if($('vcf-mode-all').checked) $('vcf-mode-changed').checked=false; };
  $('vcf-mode-changed').onchange=()=>{ if($('vcf-mode-changed').checked) $('vcf-mode-all').checked=false; };
  $('vcf-overlay').addEventListener('click', e=>{ if(e.target.id==='vcf-overlay') $('vcf-overlay').classList.add('hidden'); });

  // Test hooks (tests/smoke_test.py and the mail corpus set window.TODO_TEST_HOOKS before loading)
  if(window.TODO_TEST_HOOKS) window.__todo={ parsePipeMail, parsePipeMailInstallations:parseMailInstallations, parseSignatureBlock, parseSignatureText, xlsxToInstallations:(rowsBySheet)=>pqRowsToInstallations(Object.keys(rowsBySheet), n=>rowsBySheet[n]), codeAffaire, pricingMail };

  // Phone version: bottom bar drives the sidebar tabs (which stay the single source of truth).
  if(window.TODO_LITE){
    const nav=$('lite-nav');
    const sync=()=>{ const act=document.querySelector('.tab.active'); nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active', !!act && b.dataset.go===act.dataset.tab)); };
    nav.querySelectorAll('button').forEach(b=>{ b.onclick=()=>{ document.querySelector('.tab[data-tab="'+b.dataset.go+'"]').click(); window.scrollTo(0,0); }; });
    // short placeholders: the long ones were cut off on a phone screen
    [['contact-search','Contact ou société'],['opp-search','Producteur, centrale…']].forEach(([id,ph])=>{ const el=$(id); if(el){ el.title=el.placeholder; el.placeholder=ph; } });
    document.addEventListener('click', e=>{ if(e.target.closest('.tab')) setTimeout(sync,0); }, true);
    sync();
  }
  // ---------- Every window closes with a cross at the top right ----------
  // The cross does what the window's own « Fermer » / « Annuler » / « Plus tard » button does (same checks), else hides it;
  // it stays visible while the window scrolls.
  document.querySelectorAll('.modal-overlay').forEach(ov=>{
    const box=ov.querySelector('.modal-box'); if(!box || box.querySelector('.modal-x, .co-sheet-x')) return;
    const wrap=document.createElement('div'); wrap.className='modal-x-wrap';
    const x=document.createElement('button'); x.type='button'; x.className='modal-x'; x.title='Fermer (Échap)'; x.setAttribute('aria-label','Fermer'); x.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
    x.onclick=()=>{
      const own=[...ov.querySelectorAll('button')].find(b=>b!==x && /^(fermer|annuler|plus tard)$/i.test(b.textContent.trim()) && (b.offsetParent || b.id==='guide-close'));
      if(own) own.click(); else ov.classList.add('hidden');
    };
    wrap.appendChild(x); box.insertBefore(wrap, box.firstChild);
  });

  // ---------- Keyboard and screen readers ----------
  // Clickable shapes that are not real buttons (check circles, cards, tags, tabs…) become focusable and answer
  // Enter/Space; icon-only buttons get their tooltip as a spoken name. Applied to everything rendered, as it appears.
  const KBD_SEL='.task-check, .st-check, .contact-main, .pipe-card, .meta-tag.solid, .company-type-tag, .type-tag, .company-group-header, .parc-kpis .stat-card, .co-stars.editable .co-star, .tab';
  function a11yfy(root){
    if(!root || root.nodeType!==1) return;
    const els=root.matches(KBD_SEL)?[root]:[]; root.querySelectorAll(KBD_SEL).forEach(e=>els.push(e));
    els.forEach(el=>{
      if(el.dataset.kbd) return; el.dataset.kbd='1';
      if(!el.hasAttribute('tabindex')) el.tabIndex=0;
      const check=el.classList.contains('task-check')||el.classList.contains('st-check');
      el.setAttribute('role', check?'checkbox':'button');
      if(check) el.setAttribute('aria-checked', el.classList.contains('on')?'true':'false');
      if(el.classList.contains('co-star')){ const i=[...el.parentNode.children].indexOf(el)+1; el.setAttribute('aria-label', i+' étoile'+(i>1?'s':'')); }
      const lab=el.getAttribute('aria-label')||el.title||el.textContent.trim().replace(/\s+/g,' ').slice(0,90); if(lab) el.setAttribute('aria-label', lab);
    });
    const btns=root.tagName==='BUTTON'?[root]:[...root.querySelectorAll('button')];
    btns.forEach(b=>{ if(!b.hasAttribute('aria-label') && !b.textContent.trim() && b.title) b.setAttribute('aria-label', b.title); });
  }
  new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(a11yfy))).observe(document.body, { childList:true, subtree:true });
  a11yfy(document.body);
  document.addEventListener('keydown', e=>{
    const t=e.target;
    if((e.key==='Enter'||e.key===' ') && t && t.dataset && t.dataset.kbd && !/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName)){ e.preventDefault(); e.stopPropagation(); t.click(); }
  }, true);

  // ---------- Global search (Ctrl+K): tasks, contacts, companies, pipeline, Portefeuille in one list ----------
  // Enter with nothing chosen creates the task (Ctrl+K used to be « add a task »: the habit still works).
  const gsTab=name=>{ const t=document.querySelector('.tab[data-tab="'+name+'"]'); if(t) t.click(); };
  const gsFlash=sel=>setTimeout(()=>{ const el=document.querySelector(sel); if(el){ el.scrollIntoView({ block:'center', behavior:'smooth' }); el.classList.remove('flash-row'); void el.offsetWidth; el.classList.add('flash-row'); } }, 80);
  function openTaskEverywhere(id){
    const t=tasks.find(x=>x.id===id); if(!t) return;
    if(t.archived){ gsTab('archive'); gsFlash('#archive-list [data-id="'+id+'"]'); return; }
    gsTab('tasks'); if(searchInput.value){ searchInput.value=''; searchQuery=''; searchClear.classList.remove('show'); }
    selectedTaskId=id; render(); gsFlash('#task-list [data-id="'+id+'"]');
  }
  function openContactEverywhere(id){
    const c=contacts.find(x=>x.id===id); if(!c) return;
    gsTab('contacts'); const s=$('contact-search'); if(s.value){ s.value=''; $('contact-search-clear').classList.remove('show'); }
    if(c.company) collapsedCompanies.delete(c.company);
    expandedContacts.add(id); renderContacts(); gsFlash('#contacts-list [data-cid="'+id+'"]');
  }
  function openParcItem(p){
    gsTab('parc'); parcSearch=p.inst||p.prod||''; if(parcFilter!=='Tous' && p.statut!==parcFilter) parcFilter='Tous'; renderParc();
  }
  // all the company names the app knows, from every module
  function openCompany(name){ openCompanySheet(name); }
  // ---------- [[links]]: « [[Paul Durand]] » in a task, the note or a comment points to a contact, a company or an installation ----------
  function linkTargets(){
    const list=[];
    activeContacts().forEach(c=>{ const n=[c.firstName,c.lastName].filter(Boolean).join(' '); if(n) list.push({ id:'ct:'+c.id, type:'Contact', name:n, sub:c.company||'', open:()=>openContactEverywhere(c.id) }); });
    allCompanyNames().forEach(n=>list.push({ id:'co:'+pqFold(n).replace(/[^a-z0-9]/g,''), type:'Société', name:n, sub:'', open:()=>openCompany(n) }));
    opportunities.filter(o=>!o.deleted && o.kind==='installation').forEach(o=>list.push({ id:'op:'+o.id, type:'Installation', name:oppName(o), sub:o.company||'', open:()=>{ gsTab('pipeline'); setTimeout(()=>openOppDetail(o.id),30); } }));
    return list;
  }
  function resolveLink(name, T){ const f=pqFold(String(name).trim()); return (T||linkTargets()).find(x=>pqFold(x.name)===f)||null; }
  function linksIn(text, T){ const out=[]; String(text||'').replace(LINK_RE,(m,n)=>{ const r=resolveLink(n,T); if(r && !out.includes(r.id)) out.push(r.id); return m; }); return out; }
  window.todoLinksOf=text=>linksIn(text);
  // a contact or a company renamed: its [[links]] follow (tasks, the note and its past days, comments)
  function rewriteLinks(oldName, newName){
    oldName=String(oldName||'').trim(); newName=String(newName||'').trim(); if(!oldName || !newName || oldName===newName) return 0;
    const f=pqFold(oldName); let n=0;
    const fix=txt=>{ if(!txt || !String(txt).includes('[[')) return txt; return String(txt).replace(LINK_RE,(m,name)=>pqFold(name.trim())===f?(n++, '[['+newName+']]'):m); };
    tasks.forEach(t=>{ const a=fix(t.title), b=fix(t.description); if(a!==t.title || b!==t.description){ t.title=a; t.description=b; touch(t); } });
    notes.forEach(x=>{ let ch=false; Object.keys(x).forEach(k=>{ if(k==='text' || k.startsWith('day_')){ const v=fix(x[k]); if(v!==x[k]){ x[k]=v; ch=true; } } }); if(ch) touch(x); });
    contacts.forEach(c=>{ const v=fix(c.comment); if(v!==c.comment){ c.comment=v; touchCrm(c); } });
    opportunities.forEach(o=>{ const v=fix(o.commentaires); if(v!==o.commentaires){ o.commentaires=v; touchCrm(o); } });
    if(n){ saveTasks(); saveNotes(); renderNotes(); }
    return n;
  }
  // shows a text with its links clickable (a link to nothing known stays as text, dotted)
  function renderLinked(el, text){
    el.textContent=''; const str=String(text||''); let last=0, T=null;
    str.replace(LINK_RE,(m,n,at)=>{ if(at>last) el.appendChild(document.createTextNode(str.slice(last,at)));
      T=T||linkTargets(); const r=resolveLink(n,T), a=document.createElement('span'); a.className='wl'+(r?'':' none'); a.textContent=n; a.title=r?r.type+' : ouvrir la fiche':'Rien trouvé à ce nom'; if(r) a.dataset.peek=r.type==='Société'?'co:'+r.name:r.id;
      if(r) a.onclick=e=>{ e.stopPropagation(); r.open(); }; el.appendChild(a); last=at+m.length; return m; });
    if(last<str.length) el.appendChild(document.createTextNode(str.slice(last)));
  }
  // where an entity is mentioned: tasks (archived too), the note and its archive, contact comments, pipeline comments
  function mentionsOf(id){
    const T=linkTargets(), out=[], has=txt=>linksIn(txt,T).includes(id);
    tasks.filter(t=>!t.deleted && has(t.title+' '+(t.description||''))).forEach(t=>out.push({ label:t.title.replace(LINK_RE,'$1'), sub:t.archived?'Tâche faite':'Tâche', open:()=>openTaskEverywhere(t.id) }));
    const sp=notes.find(n=>n.id===POSTIT_ID && !n.deleted);
    if(sp && sp.text) String(sp.text).split('\n').forEach(line=>{ if(has(line)) out.push({ label:line.replace(PI_DONE,'').replace(LINK_RE,'$1'), sub:'Note', open:()=>openPostit() }); });
    dayNotes().forEach(d=>d.text.split('\n').forEach(line=>{ if(has(line)) out.push({ label:line.replace(PI_DONE,'').replace(LINK_RE,'$1'), sub:'Note du '+pqIsoToFr(d.day), open:()=>openDayNotes(d.day) }); }));
    activeContacts().filter(c=>c.comment && has(c.comment)).forEach(c=>out.push({ label:[c.firstName,c.lastName].filter(Boolean).join(' '), sub:'Commentaire du contact', open:()=>openContactEverywhere(c.id) }));
    opportunities.filter(o=>!o.deleted && o.commentaires && has(o.commentaires)).forEach(o=>out.push({ label:oppName(o), sub:'Commentaire pipeline', open:()=>{ gsTab('pipeline'); setTimeout(()=>openOppDetail(o.id),30); } }));
    return out;
  }
  function mentionsBlock(id){
    const list=mentionsOf(id); if(!list.length) return null;
    const box=document.createElement('div'); box.className='wl-mentions';
    const h=document.createElement('div'); h.className='wl-mentions-h'; h.textContent='Mentionné dans · '+list.length; box.appendChild(h);
    list.slice(0,12).forEach(m=>{ const b=document.createElement('button'); b.type='button'; b.className='wl-mention'; b.innerHTML='<b></b><span></span>'; b.querySelector('b').textContent=m.label; b.querySelector('span').textContent=m.sub; b.onclick=m.open; box.appendChild(b); });
    return box;
  }
  // the note's lines with links become « note » nodes in the network
  window.todoNoteLinks=()=>{ const T=linkTargets(), out=[];
    const sp=notes.find(n=>n.id===POSTIT_ID && !n.deleted);
    if(sp && sp.text) String(sp.text).split('\n').forEach(line=>{ const tg=linksIn(line,T); if(tg.length) out.push([line.replace(PI_DONE,'').replace(LINK_RE,'$1'), 'Note', tg, ()=>openPostit()]); });
    dayNotes().forEach(d=>d.text.split('\n').forEach(line=>{ const tg=linksIn(line,T); if(tg.length) out.push([line.replace(PI_DONE,'').replace(LINK_RE,'$1'), 'Note du '+pqIsoToFr(d.day), tg, ()=>openDayNotes(d.day)]); }));
    return out; };
  // typing « [[ » proposes contacts, companies and installations
  function attachLinkAutocomplete(el){
    if(!el || el.dataset.wlac) return; el.dataset.wlac='1';
    let menu=null, items=[], act=0, m=null;
    const hide=()=>{ if(menu){ menu.remove(); menu=null; } };
    const update=()=>{
      const caret=el.selectionStart||0, before=el.value.slice(0,caret); m=/\[\[([^\[\]\n]{0,40})$/.exec(before);
      if(!m){ hide(); return; }
      const q=pqFold(m[1]); items=linkTargets().filter(x=>!q || pqFold(x.name+' '+x.sub).includes(q)).sort((a,b)=>(pqFold(a.name).startsWith(q)?0:1)-(pqFold(b.name).startsWith(q)?0:1)||a.name.localeCompare(b.name,'fr')).slice(0,8);
      if(!items.length){ hide(); return; }
      if(!menu){ menu=document.createElement('div'); menu.className='wl-ac'; menu.setAttribute('role','listbox'); document.body.appendChild(menu); }
      act=Math.min(act, items.length-1);
      menu.innerHTML=''; items.forEach((x,i)=>{ const b=document.createElement('button'); b.type='button'; b.className='wl-ac-item'+(i===act?' on':''); b.innerHTML='<span class="t"></span><b></b><span class="s"></span>';
        b.querySelector('.t').textContent=x.type; b.querySelector('b').textContent=x.name; b.querySelector('.s').textContent=x.sub; b.onmousedown=e=>{ e.preventDefault(); pick(i); }; menu.appendChild(b); });
      const r=el.getBoundingClientRect(); menu.style.left=Math.max(8,Math.min(r.left, innerWidth-320))+'px'; const below=r.bottom+4; menu.style.top=(below+260>innerHeight?Math.max(8,r.top-264):below)+'px';
    };
    const pick=i=>{ const x=items[i]; if(!x||!m) return; const caret=el.selectionStart||0, before=el.value.slice(0,caret), after=el.value.slice(caret).replace(/^\]\]/,'');
      const start=before.length-m[0].length, ins='[['+x.name+']]'; el.value=before.slice(0,start)+ins+after; const p=start+ins.length; el.setSelectionRange(p,p); hide(); el.dispatchEvent(new Event('input', { bubbles:true })); };
    el.addEventListener('input', ()=>{ act=0; update(); });
    el.addEventListener('keydown', e=>{ if(!menu) return;
      if(e.key==='ArrowDown'){ e.preventDefault(); act=Math.min(items.length-1,act+1); update(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); act=Math.max(0,act-1); update(); }
      else if(e.key==='Enter'||e.key==='Tab'){ e.preventDefault(); e.stopImmediatePropagation(); pick(act); }
      else if(e.key==='Escape'){ e.preventDefault(); e.stopImmediatePropagation(); hide(); } }, true);
    el.addEventListener('blur', ()=>setTimeout(hide, 150));
  }
  ['quick-add-input','f-title','f-description','postit-text','ct-comment'].forEach(id=>attachLinkAutocomplete($(id)));
  // ---------- Réseau: every connection between everything, as a graph (js/network.js draws it) ----------
  let networkView=null, networkFocusNext=null;
  const CO_FORMS=new Set(['sas','sasu','sa','sarl','eurl','sci','snc','scop','sem','spl','sca','selarl','ste','societe','groupe','group','ltd','gmbh','inc','llc']);
  const FREE_MAIL=/^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|icloud|me|orange|wanadoo|free|sfr|neuf|laposte|bbox|aol|gmx|protonmail|proton)\./;
  function networkData(){
    const nodes=[], edges=[], seen=new Set();
    const node=(id, type, label, sub, open)=>{ if(seen.has(id)) return id; seen.add(id); nodes.push({ id, type, label:String(label||'(sans nom)'), sub:sub||'', open }); return id; };
    // « Solaris SAS » and « SOLARIS » are the same company: legal forms and punctuation left out of the key
    const coKey=name=>pqFold(String(name||'')).replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w && !CO_FORMS.has(w)).join('');
    const perCo=new Map(); activeContacts().forEach(c=>{ const k=coKey(c.company); if(k) perCo.set(k,(perCo.get(k)||0)+1); });   // counted once
    const coId=name=>{ name=String(name||'').trim(); if(!name) return null; const key=coKey(name)||pqFold(name).replace(/[^a-z0-9]/g,''); if(!key) return null; const id='co:'+key;
      if(seen.has(id)) return id;
      const nC=perCo.get(coKey(name))||0;
      const co=companies.find(c=>!c.deleted && coKey(c.name)===key);
      const r=node(id, 'company', name, [co && co.type, nC?nC+' contact'+(nC>1?'s':''):''].filter(Boolean).join(' · ')||'Société', ()=>openCompany(name)); if(co && co.type) nodes[nodes.length-1].ctype=co.type; return r; };
    const link=(a,b)=>{ if(a && b) edges.push([a,b]); };
    allCompanyNames().forEach(coId);
    const byMail=new Map();
    // a contact with no company: the one of the colleagues sharing its mail domain (personal mailboxes left out)
    const dom=m=>{ const d=String(m||'').toLowerCase().split('@')[1]||''; return d && !FREE_MAIL.test(d)?d:''; }, coByDom=new Map();
    activeContacts().forEach(c=>{ const d=dom(c.email); if(d && c.company && !coByDom.has(d)) coByDom.set(d, c.company); });
    activeContacts().forEach(c=>{ const name=[c.firstName,c.lastName].filter(Boolean).join(' ')||c.email||'(sans nom)';
      const co=c.company || coByDom.get(dom(c.email)) || '';
      const id=node('ct:'+c.id, 'contact', name, [c.role, co].filter(Boolean).join(' · '), ()=>openContactEverywhere(c.id));
      link(id, coId(co)); if(c.email) byMail.set(String(c.email).toLowerCase(), id); });
    const live=opportunities.filter(o=>!o.deleted);
    live.filter(o=>o.kind==='request').forEach(r=>{ const n=live.filter(o=>o.requestId===r.id).length; if(!n) return;
      link(node('rq:'+r.id, 'request', 'Demande · '+(r.company||''), n+' installation'+(n>1?'s':''), ()=>{ gsTab('pipeline'); setTimeout(()=>openRequestDetail(r.id),30); }), coId(r.company)); });
    live.filter(o=>o.kind!=='request' && o.stage!=='converti').forEach(o=>{
      const pre=o.kind==='prequal', id=node('op:'+o.id, pre?'prequal':'installation', pre?o.company+' (pré-qualif)':oppName(o), [o.company, stageLabel(o.stage), fmtKwc(o.kwc)].filter(Boolean).join(' · '), ()=>{ gsTab('pipeline'); setTimeout(()=>openOppDetail(o.id),30); });
      link(id, coId(o.company)); if(o.producteur && pqFold(o.producteur)!==pqFold(o.company)) link(id, coId(o.producteur));
      if(o.requestId && seen.has('rq:'+o.requestId)) link(id, 'rq:'+o.requestId);
      if(o.mail && byMail.has(String(o.mail).toLowerCase())) link(id, byMail.get(String(o.mail).toLowerCase()));
      (o.extraContacts||[]).forEach(x=>{ if(x && x.mail && byMail.has(String(x.mail).toLowerCase())) link(id, byMail.get(String(x.mail).toLowerCase())); }); });
    tasks.filter(t=>!t.deleted && !t.archived).forEach(t=>{
      const id=node('tk:'+t.id, 'task', plainLinks(t.title), [t.client, t.due?'pour le '+pqIsoToFr(t.due):''].filter(Boolean).join(' · '), ()=>openTaskEverywhere(t.id));
      link(id, coId(t.client));
      if(t.opportunityId){ if(seen.has('op:'+t.opportunityId)) link(id, 'op:'+t.opportunityId); else if(seen.has('rq:'+t.opportunityId)) link(id, 'rq:'+t.opportunityId); }
      if(t.project) link(id, node('pj:'+pqFold(t.project), 'project', t.project, 'Projet', ()=>{ gsTab('tasks'); }));
      (window.todoLinksOf?window.todoLinksOf(t.title+' '+(t.description||'')):[]).forEach(target=>link(id, target)); });
    meetings.filter(m=>!m.deleted).forEach(m=>{ if(!seen.has('ct:'+m.contactId)) return; link(node('mt:'+m.id, 'meeting', m.label||'RDV', m.date?pqIsoToFr(m.date):'', ()=>openContactEverywhere(m.contactId)), 'ct:'+m.contactId); });
    if(parcData===null) loadParc();
    if(parcData && parcData.items) parcData.items.forEach((p,i)=>{ const id=node('pc:'+i, 'contract', p.inst||p.prod||'(contrat)', [p.statut, p.fin?'fin '+pqIsoToFr(p.fin):'', p.kwc?fmtKwc(p.kwc):''].filter(Boolean).join(' · '), ()=>openParcItem(p));
      link(id, coId(p.prod)); if(p.dev && pqFold(p.dev)!==pqFold(p.prod)) link(id, coId(p.dev)); });
    (window.todoNoteLinks?window.todoNoteLinks():[]).forEach(([label, sub, targets, open], i)=>{ const id=node('nt:'+i, 'note', label, sub, open); targets.forEach(tg=>link(id, tg)); });
    return { nodes, edges };
  }
  function showNetwork(){
    if(!window.todoNetwork) return;
    if(!networkView) networkView=window.todoNetwork.mount($('network-root'), networkData);
    else networkView.refresh();
    if(networkFocusNext){ const id=networkFocusNext; networkFocusNext=null; setTimeout(()=>networkView.focus(id, { local:true }), 250); }
  }
  // « Voir dans le réseau » from a sheet
  function openInNetwork(id){ networkFocusNext=id; gsTab('network'); }
  window.todoOpenInNetwork=openInNetwork;
  window.todoNetworkState=()=>networkView?networkView._state():null;
  window.todoNetworkPos=id=>networkView?networkView._pos(id):null;
  window.todoExtraCommands=(window.todoExtraCommands||[]).concat([{ t:'Ouvrir le réseau', k:'graphe reseau connexions liens neuronal', go:()=>gsTab('network') }]);

  // ---------- Company sheet: everything about one client on one screen, with its history ----------
  const sameCo=(a,b)=>!!a && !!b && pqFold(a).trim()===pqFold(b).trim();
  let coSheetName=null;
  const coDate=ms=>{ const d=new Date(ms); return isNaN(d)?'':String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getFullYear()).slice(2); };
  function companyHistory(name){
    const ev=[], cts=activeContacts().filter(c=>sameCo(c.company,name)), ids=new Set(cts.map(c=>c.id));
    meetings.filter(m=>!m.deleted && ids.has(m.contactId)).forEach(m=>{ const c=cts.find(x=>x.id===m.contactId); ev.push({ at:new Date((m.date||'')+'T12:00:00').getTime()||m.createdAt, kind:'rdv', html:'<b>RDV</b> avec '+escapeHtml([c.firstName,c.lastName].filter(Boolean).join(' '))+(m.label?' : '+escapeHtml(m.label):'') }); });
    tasks.filter(t=>!t.deleted && t.archived && sameCo(t.client,name)).forEach(t=>ev.push({ at:t.archivedAt||t.updatedAt, kind:'done', html:'Fait : '+escapeHtml(plainLinks(t.title)) }));
    opportunities.filter(o=>!o.deleted && (sameCo(o.company,name)||sameCo(o.producteur,name))).forEach(o=>{
      if(o.createdAt>1e12) ev.push({ at:o.createdAt, kind:'new', html:(o.kind==='request'?'Demande reçue : ':o.kind==='prequal'?'Pré-qualification : ':'Nouvelle opportunité : ')+'<b>'+escapeHtml(o.kind==='prequal'?'rencontre':oppName(o))+'</b>' });
      (o.stageLog||[]).forEach((s,i)=>{ if(i===0 && Math.abs(s.at-(o.createdAt||0))<60000) return; ev.push({ at:s.at, kind:'stage', html:escapeHtml(o.kind==='prequal'?'Pré-qualif':oppName(o))+' → <b>'+escapeHtml(stageLabel(s.stage))+'</b>' }); });
    });
    cts.forEach(c=>{ if(c.createdAt>1e12) ev.push({ at:c.createdAt, kind:'new', html:'Nouveau contact : <b>'+escapeHtml([c.firstName,c.lastName].filter(Boolean).join(' '))+'</b>' }); });
    return ev.filter(e=>e.at).sort((a,b)=>b.at-a.at);
  }
  function openCompanySheet(name, opts){
    opts=opts||{};
    name=allCompanyNames().find(n=>sameCo(n,name))||name;
    coSheetName=name;
    const co=companies.find(x=>!x.deleted && sameCo(x.name,name));
    const cts=activeContacts().filter(c=>sameCo(c.company,name)).sort((a,b)=>contactSortName(a).localeCompare(contactSortName(b),'fr'));
    const opps=opportunities.filter(o=>!o.deleted && o.kind!=='request' && (sameCo(o.company,name)||sameCo(o.producteur,name)));
    const live=opps.filter(o=>!isExited(o) && o.stage!=='converti'), gone=opps.length-live.length;
    const open=activeTasks().filter(t=>sameCo(t.client,name)).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
    const parc=parcForCompany(name), won=parc.filter(p=>p.statut==='Gagné');
    const today=toISO(new Date()), in12=toISO(new Date(Date.now()+365*864e5));
    const late=open.filter(t=>dueStatus(t.due)==='overdue').length;
    $('co-sheet-title').textContent=name;
    const meta=$('co-sheet-meta'); meta.innerHTML='';
    meta.appendChild(starsWidget(companyStars(name), n=>{ setCompanyStars(name, n); openCompanySheet(name); }));
    const addMeta=t=>{ if(!t) return; const s=document.createElement('span'); s.textContent=t; meta.appendChild(s); };
    addMeta(co&&co.type); addMeta(co&&co.whatTheyDo);
    if(co&&co.website){ const a=document.createElement('a'); a.href=co.website.startsWith('http')?co.website:'https://'+co.website; a.target='_blank'; a.rel='noopener'; a.textContent=co.website.replace(/^https?:\/\//,''); meta.appendChild(a); }
    const kwcOf=list=>list.reduce((s,o)=>s+(pqNum(String(o.kwc||''))||0),0);
    const body=$('co-sheet-body'); body.innerHTML='';
    const k=document.createElement('div'); k.className='co-kpis';
    [[cts.length,'contact'+(cts.length>1?'s':'')],[live.length+(live.length?' · '+fmtMwc(kwcOf(live)):''),'en pipeline'],[won.length+(won.length?' · '+fmtMwc(won.reduce((s,p)=>s+(p.kwc||0),0)):''),'contrat'+(won.length>1?'s':'')+' gagné'+(won.length>1?'s':'')],[open.length,'tâche'+(open.length>1?'s':'')+' ouverte'+(open.length>1?'s':'')+(late?' · '+late+' en retard':''), late]]
      .forEach(([v,l,alert])=>{ const d=document.createElement('div'); d.className='co-kpi'+(alert?' alert':''); d.innerHTML='<b></b><span></span>'; d.querySelector('b').textContent=v; d.querySelector('span').textContent=l; k.appendChild(d); });
    body.appendChild(k);
    const grid=document.createElement('div'); grid.className='co-grid'; body.appendChild(grid);
    const colL=document.createElement('div'), colR=document.createElement('div'); colL.className=colR.className='co-col'; grid.append(colL, colR);
    const section=(col,title,rows,empty,extra)=>{ const s=document.createElement('div'); s.className='co-sec'; const h=document.createElement('h4'); h.textContent=title; if(extra) h.appendChild(extra); s.appendChild(h);
      if(!rows.length){ const e=document.createElement('div'); e.className='co-empty'; e.textContent=empty; s.appendChild(e); } else rows.forEach(r=>s.appendChild(r)); col.appendChild(s); return s; };
    const row=(title,sub,val,fn,cls)=>{ const r=document.createElement(fn?'button':'div'); if(fn){ r.type='button'; r.onclick=()=>{ closeCompanySheet(); fn(); }; } r.className='co-row'+(cls?' '+cls:'');
      r.innerHTML='<span class="k"><b></b><span></span></span><span class="v"></span>'; r.querySelector('b').textContent=title; r.querySelector('.k span').textContent=sub||''; r.querySelector('.v').textContent=val||''; return r; };
    // what is coming up: dated tasks, contracts ending within a year
    const next=[...open.filter(t=>t.due).map(t=>({ d:t.due, id:t.id, r:row(plainLinks(t.title),'Tâche',pqIsoToFr(t.due),()=>openTaskEverywhere(t.id), dueStatus(t.due)==='overdue'?'late':'') })),
      ...parc.filter(p=>p.fin && p.fin>=today && p.fin<=in12).map(p=>({ d:p.fin, r:row('Fin de contrat : '+(p.inst||p.prod), p.kwc?fmtKwc(p.kwc):'', pqIsoToFr(p.fin), ()=>openParcItem(p)) }))]
      .sort((a,b)=>a.d.localeCompare(b.d)).slice(0,6);
    const inNext=new Set(next.map(x=>x.id).filter(Boolean));
    section(colL,'À venir',next.map(x=>x.r),'Rien de daté pour ce client.');
    section(colL,'Contacts',cts.map(c=>row([c.firstName,c.lastName].filter(Boolean).join(' ')||'(sans nom)',[c.role,c.email].filter(Boolean).join(' · '),c.phone1||c.phone2||'',()=>openContactEverywhere(c.id))),'Aucun contact.');
    section(colL,'Pipeline',live.map(o=>row(oppName(o),stageLabel(o.stage)+(o.dept?' · '+o.dept:''),fmtKwc(o.kwc),()=>{ gsTab('pipeline'); setTimeout(()=>openOppDetail(o.id),30); })),'Aucune opportunité en cours.'+(gone?' ('+gone+' terminée'+(gone>1?'s':'')+')':''));
    section(colR,'Portefeuille',parc.slice().sort((a,b)=>(a.statut==='Gagné'?0:1)-(b.statut==='Gagné'?0:1)||(a.fin||'9').localeCompare(b.fin||'9')).slice(0,8)
      .map(p=>row(p.inst||p.prod||'(sans nom)',[p.statut,p.fin?'fin '+pqIsoToFr(p.fin):''].filter(Boolean).join(' · '),p.kwc?fmtKwc(p.kwc):'',()=>openParcItem(p))),
      parcData?'Aucun contrat dans le Suivi Agrégation.':'Charge le Suivi Agrégation dans Portefeuille pour voir les contrats.');
    { const mb=mentionsBlock('co:'+pqFold(name).replace(/[^a-z0-9]/g,'')); if(mb) colR.appendChild(mb); }
    // the open tasks not already listed in « À venir » (no repeat)
    const others=open.filter(t=>!inNext.has(t.id));
    section(colR,inNext.size?'Autres tâches ouvertes':'Tâches ouvertes',others.slice(0,6).map(t=>row(plainLinks(t.title),t.due?'pour le '+pqIsoToFr(t.due):'sans date','',()=>openTaskEverywhere(t.id),dueStatus(t.due)==='overdue'?'late':'')),
      open.length?'Toutes les tâches ouvertes sont dans « À venir ».':'Aucune tâche ouverte.');
    // history: meetings, done tasks, pipeline steps, new contacts and opportunities
    const hist=companyHistory(name), all=!!opts.allHistory;
    const tl=document.createElement('div'); tl.className='co-tl';
    hist.slice(0, all?hist.length:10).forEach(e=>{ const r=document.createElement('div'); r.className='co-tl-row '+e.kind; r.innerHTML='<span class="d">'+coDate(e.at)+'</span><i></i><span>'+e.html+'</span>'; tl.appendChild(r); });
    const hs=section(colR,'Historique des échanges',hist.length?[tl]:[],'Pas encore d\u2019échange enregistré. Les RDV notés sur les contacts, les tâches faites et les étapes du pipeline s\u2019afficheront ici.');
    if(hist.length>10 && !all){ const m=document.createElement('button'); m.type='button'; m.className='co-more'; m.textContent='Voir tout l\u2019historique ('+hist.length+')'; m.onclick=()=>openCompanySheet(name,{ allHistory:true }); hs.appendChild(m); }
    $('co-sheet-overlay').classList.remove('hidden');
  }
  function closeCompanySheet(){ $('co-sheet-overlay').classList.add('hidden'); coSheetName=null; }
  $('co-sheet-close').onclick=closeCompanySheet;
  $('co-sheet-overlay').addEventListener('click', e=>{ if(e.target.id==='co-sheet-overlay') closeCompanySheet(); });
  $('co-sheet-edit').onclick=()=>{ const n=coSheetName; closeCompanySheet(); if(n) openCompanyEditForm(n); };
  $('co-sheet-net').onclick=()=>{ const n=coSheetName; closeCompanySheet(); if(n) openInNetwork('co:'+pqFold(n).replace(/[^a-z0-9]/g,'')); };
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && coSheetName){ e.stopPropagation(); closeCompanySheet(); } }, true);
  // ----- Hover preview: a mini sheet when the mouse rests on a company, a contact or an installation (data-peek="co:Name" | "ct:id" | "op:id") -----
  let peekEl=null, peekTimer=0, peekFor=null;
  function peekLines(key){
    const kind=key.slice(0,3), v=key.slice(3), L=[]; let title='', eyebrow='';
    const mw=list=>{ const k=list.reduce((s,o)=>s+kwcNum(o),0); return k?(k>=1000?(Math.round(k/100)/10).toLocaleString('fr-FR')+' MWc':Math.round(k).toLocaleString('fr-FR')+' kWc'):''; };
    const lastMeet=ids=>meetings.filter(m=>!m.deleted && ids.includes(m.contactId) && m.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const nextTask=list=>list.filter(t=>t.due).sort((a,b)=>a.due.localeCompare(b.due))[0];
    if(kind==='co:'){
      const name=v; eyebrow='Société'; title=name;
      const cts=activeContacts().filter(c=>sameCo(c.company,name));
      const ins=opportunities.filter(o=>!o.deleted && o.kind==='installation' && !isExited(o) && sameCo(o.company,name));
      const tk=activeTasks().filter(t=>sameCo(t.client,name));
      const co=companies.find(c=>!c.deleted && sameCo(c.name,name)); if(co && co.type) eyebrow='Société · '+co.type;
      if(ins.length){ const top=ins.reduce((a,b)=>stageIndex(b.stage)>stageIndex(a.stage)?b:a); L.push(['Pipeline', ins.length+' installation'+(ins.length>1?'s':'')+(mw(ins)?' · '+mw(ins):'')+' · '+stageLabel(top.stage)]); }
      cts.slice(0,3).forEach((c,i)=>L.push([i?'':'Contacts', [[c.firstName,c.lastName].filter(Boolean).join(' '), c.role, c.phone1].filter(Boolean).join(' · ')]));
      if(cts.length>3) L.push(['', '+ '+(cts.length-3)+' autre'+(cts.length>4?'s':'')]);
      const nt=nextTask(tk); if(tk.length) L.push(['Tâches', tk.length+' ouverte'+(tk.length>1?'s':'')+(nt?(nt.due<toISO(new Date())?' · en retard depuis le ':' · prochaine le ')+pqIsoToFr(nt.due).slice(0,5)+' : '+plainLinks(nt.title):'')]);
      const lm=lastMeet(cts.map(c=>c.id)); if(lm) L.push(['Dernier RDV', pqIsoToFr(lm.date)+(lm.label?' · '+lm.label:'')]);
      if(!L.length) L.push(['', 'Rien d’autre pour l’instant.']);
    } else if(kind==='ct:'){
      const c=contacts.find(x=>x.id===v && !x.deleted); if(!c) return null;
      eyebrow='Contact'; title=[c.firstName,c.lastName].filter(Boolean).join(' ')||c.email||'';
      if(c.role||c.company) L.push(['', [c.role, c.company].filter(Boolean).join(' · ')]);
      if(c.phone1||c.phone2) L.push(['Tél.', [c.phone1,c.phone2].filter(Boolean).join(' · ')]);
      if(c.email) L.push(['Mail', c.email]);
      const lm=lastMeet([c.id]); if(lm) L.push(['Dernier RDV', pqIsoToFr(lm.date)+(lm.label?' · '+lm.label:'')]);
      const T=linkTargets(), tk=activeTasks().filter(t=>linksIn(t.title+' '+(t.description||''),T).includes('ct:'+c.id));
      if(tk.length){ const nt=nextTask(tk)||tk[0]; L.push(['Tâches', tk.length+(tk.length>1?' le citent':' le cite')+' · '+plainLinks(nt.title)]); }
      if(c.comment) L.push(['Note', plainLinks(c.comment).slice(0,120)]);
    } else if(kind==='op:'){
      const o=opportunities.find(x=>x.id===v && !x.deleted); if(!o) return null;
      eyebrow='Installation'; title=oppName(o);
      L.push(['', [o.company, stageLabel(o.stage)].filter(Boolean).join(' · ')]);
      const f=[mw([o]), o.install, o.contrat].filter(Boolean).join(' · '); if(f) L.push(['', f]);
      if(o.mwh) L.push(['P50', Math.round(pqNum(String(o.mwh))||0).toLocaleString('fr-FR')+' MWh/an']);
      if(o.dept) L.push(['Lieu', o.dept]);
      if(o.mesPrev||o.mesEff) L.push(['MES', o.mesEff||o.mesPrev]);
      if(o.debut||o.fin) L.push(['Contrat', [o.debut, o.fin].filter(Boolean).join(' → ')]);
      if(o.charge) L.push(['Chargé', o.charge]);
      const nt=activeTasks().filter(t=>t.opportunityId===o.id || (o.requestId && t.opportunityId===o.requestId)).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'))[0];
      if(nt) L.push(['Tâche', plainLinks(nt.title)+(nt.due?' · '+pqIsoToFr(nt.due).slice(0,5):'')]);
    } else return null;
    return { eyebrow, title, L };
  }
  function hidePeek(){ clearTimeout(peekTimer); peekFor=null; if(peekEl) peekEl.hidden=true; }
  function showPeek(el){
    const d=peekLines(el.dataset.peek); if(!d || !el.isConnected) return;
    if(!peekEl){ peekEl=document.createElement('div'); peekEl.className='peek'; peekEl.setAttribute('role','tooltip'); document.body.appendChild(peekEl); }
    peekEl.innerHTML=''; const e=document.createElement('div'); e.className='peek-k'; e.textContent=d.eyebrow; const h=document.createElement('b'); h.className='peek-t'; h.textContent=d.title; peekEl.append(e,h);
    d.L.forEach(([k,v])=>{ const r=document.createElement('div'); r.className='peek-r'; const a=document.createElement('span'); a.textContent=k; const b=document.createElement('span'); b.textContent=v; r.append(a,b); peekEl.appendChild(r); });
    peekEl.hidden=false;
    const r=el.getBoundingClientRect(), w=peekEl.offsetWidth, hh=peekEl.offsetHeight;
    let x=Math.min(innerWidth-w-10, Math.max(10, r.left)), y=r.bottom+6; if(y+hh>innerHeight-10) y=Math.max(10, r.top-hh-6);
    peekEl.style.left=x+'px'; peekEl.style.top=y+'px';
  }
  if(!window.TODO_LITE && !window.TODO_WIDGET && window.matchMedia && matchMedia('(hover:hover)').matches){
    document.addEventListener('mouseover', e=>{ const el=e.target.closest && e.target.closest('[data-peek]'); if(el===peekFor) return; hidePeek(); if(!el) return;
      peekFor=el; peekTimer=setTimeout(()=>{ if(peekFor===el) showPeek(el); }, 450); });
    ['scroll','mousedown','keydown'].forEach(t=>document.addEventListener(t, hidePeek, true));
    window.addEventListener('blur', hidePeek);
  }
  // the network's tooltip and panel: a few lines of the sheet for every kind of point
  window.todoNetworkInfo=(id, label)=>{
    const k=id.slice(0,3), v=id.slice(3);
    if(k==='co:'){ const d=peekLines('co:'+label); return d?d.L:[]; }
    if(k==='ct:'||k==='op:'){ const d=peekLines(id); return d?d.L.filter(x=>!(k==='op:' && !x[0] && x===d.L[0])):[]; }
    if(k==='rq:'){ const l=opportunities.filter(o=>!o.deleted && o.requestId===v && o.kind==='installation'), kw=l.reduce((s,o)=>s+kwcNum(o),0), st=[...new Set(l.map(o=>stageLabel(o.stage)))];
      return [['Installations', l.length+(kw?' · '+(Math.round(kw/100)/10).toLocaleString('fr-FR')+' MWc':'')], ['Étape', st.join(', ')]].concat(l.slice(0,5).map((o,i)=>[i?'':'Centrales', oppName(o)+(o.kwc?' · '+fmtKwc(o.kwc):'')])); }
    if(k==='tk:'){ const t=tasks.find(x=>x.id===v); if(!t) return []; const L=[];
      if(t.client) L.push(['Client', t.client]); L.push(['Statut', (STATUS_META[t.status]||{}).label||t.status||'']); if(t.urgency) L.push(['Urgence', t.urgency]);
      if(t.due) L.push(['Échéance', pqIsoToFr(t.due)]); if(t.description) L.push(['Détail', plainLinks(t.description).slice(0,120)]); return L; }
    if(k==='mt:'){ const m=meetings.find(x=>x.id===v); if(!m) return []; const c=contacts.find(x=>x.id===m.contactId);
      return [['Date', m.date?pqIsoToFr(m.date):'']].concat(c?[['Avec', [[c.firstName,c.lastName].filter(Boolean).join(' '), c.company].filter(Boolean).join(' · ')]]:[]).filter(x=>x[1]); }
    if(k==='pc:'){ const p=parcData && parcData.items && parcData.items[+v]; if(!p) return [];
      return [['Producteur', p.prod], ['Statut', p.statut], ['Puissance', p.kwc?fmtKwc(p.kwc):''], ['P50', p.p50?Math.round(p.p50).toLocaleString('fr-FR')+' MWh/an':''], ['Techno', p.enr||p.typeInst], ['MES', p.mes?pqIsoToFr(p.mes):''], ['Fin', p.fin?pqIsoToFr(p.fin):'']].filter(x=>x[1]); }
    return [];
  };
  window.todoPeek=key=>{ const d=peekLines(key); return d?[d.eyebrow, d.title].concat(d.L.map(x=>x.filter(Boolean).join(' : '))).join('\n'):null; };

  function allCompanyNames(){
    const m=new Map(); const add=n=>{ n=String(n||'').trim(); if(n && !m.has(pqFold(n))) m.set(pqFold(n), n); };
    companies.filter(c=>!c.deleted).forEach(c=>add(c.name)); contacts.filter(c=>!c.deleted).forEach(c=>add(c.company));
    opportunities.filter(o=>!o.deleted).forEach(o=>add(o.company)); clientsList.forEach(add);
    return [...m.values()];
  }
  function gsSearch(q){
    const words=pqFold(q).split(/\s+/).filter(Boolean); if(!words.length) return [];
    const hit=(...parts)=>{ const s=pqFold(parts.filter(Boolean).join(' ')); return words.every(w=>s.includes(w)); };
    const score=title=>pqFold(title).startsWith(words[0])?0:1;
    const top=(list,n)=>list.sort((a,b)=>score(a.title)-score(b.title)||a.title.localeCompare(b.title,'fr')).slice(0,n);
    const groups=[];
    const tk=top(tasks.filter(t=>!t.deleted && hit(t.title,t.client,t.project,t.description)).map(t=>({ ic:t.archived?'✓':'T', title:plainLinks(t.title), sub:[t.client, t.archived?'archivée':(t.due?'pour le '+t.due.split('-').reverse().join('/'):'')].filter(Boolean).join(' · '), go:()=>openTaskEverywhere(t.id) })),6);
    if(tk.length) groups.push(['Tâches',tk]);
    const ct=top(activeContacts().filter(c=>hit(c.firstName,c.lastName,c.company,c.role,c.email,(c.phone1||'').replace(/\D/g,''),(c.phone2||'').replace(/\D/g,''))).map(c=>({ ic:((c.firstName||'')[0]||'')+((c.lastName||'')[0]||'')||'?', title:[c.firstName,c.lastName].filter(Boolean).join(' ')||'(sans nom)', sub:[c.role,c.company,c.phone1].filter(Boolean).join(' · '), go:()=>openContactEverywhere(c.id) })),5);
    if(ct.length) groups.push(['Contacts',ct]);
    const co=top(allCompanyNames().filter(n=>hit(n)).map(n=>{ const nC=activeContacts().filter(c=>c.company===n).length, nO=activeOpportunities().filter(o=>o.company===n).length;
      return { ic:'S', title:n, sub:[nC?nC+' contact'+(nC>1?'s':''):'', nO?nO+' opportunité'+(nO>1?'s':''):''].filter(Boolean).join(' · ')||'Société', go:()=>openCompany(n) }; }),5);
    if(co.length) groups.push(['Sociétés',co]);
    const op=top(opportunities.filter(o=>!o.deleted && o.kind!=='request' && hit(oppName(o),o.company,o.producteur,o.dept,o.commune)).map(o=>({ ic:'P', title:oppName(o), sub:[o.company, stageLabel(o.stage)].filter(Boolean).join(' · '), right:fmtKwc(o.kwc), go:()=>{ gsTab('pipeline'); setTimeout(()=>openOppDetail(o.id),30); } })),6);
    if(op.length) groups.push(['Pipeline',op]);
    const nl=[]; dayNotes().forEach(d=>d.text.split('\n').forEach(l=>{ if(l.trim() && hit(l)) nl.push({ ic:'✎', title:plainLinks(l.replace(PI_DONE,'')), sub:'Note du '+pqIsoToFr(d.day), go:()=>openDayNotes(d.day) }); }));
    if(nl.length) groups.push(['Notes', nl.slice(0,5)]);
    if(parcData===null) loadParc();
    if(parcData){ const pc=top(parcData.items.filter(p=>hit(p.inst,p.prod,p.dev,p.siteDept,p.dept)).map(p=>({ ic:'€', title:p.inst||p.prod||'(sans nom)', sub:[p.prod&&p.prod!==p.inst?p.prod:'', p.statut, p.siteDept||p.dept].filter(Boolean).join(' · '), right:p.kwc?fmtKwc(p.kwc):'', go:()=>openParcItem(p) })),6);
      if(pc.length) groups.push(['Portefeuille',pc]); }
    return groups;
  }
  // ---------- command palette (Ctrl+P, or « > » in the search): every action from the keyboard ----------
  const clickEl=(id, tab)=>()=>{ if(tab) gsTab(tab); setTimeout(()=>{ const b=$(id); if(b) b.click(); }, tab?40:0); };
  function gsCommands(){
    const go=t=>()=>gsTab(t);
    const list=[
      { t:'Nouvelle tâche', k:'ajouter creer tache', go:()=>{ gsTab('tasks'); setTimeout(()=>quickAddInput.focus(),40); } },
      { t:'Tâche complète (formulaire)', k:'nouvelle tache formulaire detail', go:clickEl('quick-add-more','tasks') },
      { t:'Nouvelle opportunité', k:'pipeline ajouter installation demande', go:clickEl('opp-add-btn','pipeline') },
      { t:'Nouvelle pré-qualif', k:'prequalif prospect', go:clickEl('prequal-add-btn','pipeline') },
      { t:'Nouveau contact', k:'ajouter contact personne', go:clickEl('contact-add-btn','contacts') },
      { t:'Coller une signature de mail', k:'contact signature', go:clickEl('sig-paste-btn','contacts') },
      { t:'Vue réunion du pipeline', k:'reunion pricing partager', go:()=>{ gsTab('pipeline'); setTimeout(()=>{ if(!pipeMeet){ pipeMeet=true; pipeDash=false; renderPipeline(); } },40); } },
      { t:'Tableau de bord du pipeline', k:'dashboard stats', go:()=>{ gsTab('pipeline'); setTimeout(()=>{ if(!pipeDash){ pipeDash=true; pipeMeet=false; renderPipeline(); } },40); } },
      { t:'Ouvrir la note (post-it)', k:'postit calepin note', go:()=>openPostit(true) },
      { t:'Notes des jours précédents', k:'historique note journal jour', go:()=>openDayNotes() },
      { t:'Exporter les contacts (Excel)', k:'export xlsx contacts', go:clickEl('contact-export-btn','contacts') },
      { t:'Importer des contacts (Excel)', k:'import xlsx contacts', go:clickEl('contact-import-btn','contacts') },
      { t:'Contacts vers le téléphone (.vcf)', k:'vcf telephone export', go:clickEl('vcf-btn','contacts') },
      { t:'Sauvegarde complète (JSON)', k:'export sauvegarde backup json', go:clickEl('export-btn','lists') },
      { t:'Synchroniser maintenant', k:'sync github synchro', go:clickEl('sync-now-btn','lists') },
      { t:'Annuler (Ctrl+Z)', k:'undo retour arriere', go:()=>undoLast() },
      { t:'Rétablir (Ctrl+Maj+Z)', k:'redo refaire', go:()=>redoLast() },
      { t:'Mode d’emploi', k:'aide guide help', go:clickEl('help-btn') }
    ];
    [['today','Aujourd’hui'],['tasks','Tâches'],['inbox','Boîte mail'],['archive','Archive'],['contacts','Contacts'],['pipeline','Pipeline'],['parc','Portefeuille'],['network','Réseau'],['lists','Réf. & data']]
      .forEach(([tab,label])=>{ if(document.querySelector('.tab[data-tab="'+tab+'"]')) list.push({ t:'Aller à : '+label, k:'onglet ouvrir '+tab, go:go(tab) }); });
    (window.todoExtraCommands||[]).forEach(c=>list.push(c));   // added by other parts (saved views, network…)
    return list;
  }
  function gsCommandHits(q){
    const words=pqFold(q).split(/\s+/).filter(Boolean), all=gsCommands();
    return (words.length?all.filter(c=>{ const s=pqFold(c.t+' '+(c.k||'')); return words.every(w=>s.includes(w)); }):all)
      .map(c=>({ ic:'›', title:c.t, sub:c.sub||'', go:c.go }));
  }
  let gsList=[], gsActive=0;
  function gsRender(){
    const raw=$('gs-input').value, q=raw.trim(), box=$('gs-results'); box.innerHTML=''; gsList=[];
    const add0=(it)=>{ const i=gsList.length; gsList.push(it); const b=document.createElement('button'); b.type='button'; b.className='gs-item'; b.setAttribute('role','option'); b.id='gs-opt-'+i;
      b.innerHTML='<span class="gs-ic"></span><span class="gs-t"><b></b><span></span></span><span class="gs-r"></span>';
      b.querySelector('.gs-ic').textContent=it.ic; b.querySelector('b').textContent=it.title; b.querySelector('.gs-t span').textContent=it.sub||'';
      b.onmousemove=()=>{ if(gsActive!==i){ gsActive=i; gsPaint(); } }; b.onclick=()=>gsGo(i); box.appendChild(b); };
    if(q.startsWith('>')){   // commands only
      const hits=gsCommandHits(q.slice(1)); const g=document.createElement('div'); g.className='gs-group'; g.textContent='Commandes'; box.appendChild(g);
      hits.forEach(add0); if(!hits.length){ const e=document.createElement('div'); e.className='gs-empty'; e.textContent='Aucune commande.'; box.appendChild(e); }
      gsActive=0; gsPaint(); return;
    }
    if(!q){ box.innerHTML='<div class="gs-empty">Tape un nom, une société, une centrale, un département…<br>Entrée sans choisir : crée la tâche. « &gt; » au début (ou Ctrl+P) : les commandes.</div>'; return; }
    const groups=gsSearch(q);
    const cmds=gsCommandHits(q).slice(0,3); if(cmds.length) groups.push(['Commandes',cmds]);
    const add=(it,cls)=>{ const i=gsList.length; gsList.push(it); const b=document.createElement('button'); b.type='button'; b.className='gs-item'+(cls?' '+cls:''); b.setAttribute('role','option'); b.id='gs-opt-'+i;
      b.innerHTML='<span class="gs-ic"></span><span class="gs-t"><b></b><span></span></span><span class="gs-r"></span>';
      b.querySelector('.gs-ic').textContent=it.ic; b.querySelector('b').textContent=it.title; b.querySelector('.gs-t span').textContent=it.sub||''; b.querySelector('.gs-r').textContent=it.right||'';
      b.onmousemove=()=>{ if(gsActive!==i){ gsActive=i; gsPaint(); } }; b.onclick=()=>gsGo(i); box.appendChild(b); };
    add({ ic:'+', title:'Créer la tâche « '+q+' »', sub:'Entrée', go:()=>{ quickAddInput.value=q; quickAdd(); gsTab('tasks'); } }, 'create');
    groups.forEach(([label,items])=>{ const g=document.createElement('div'); g.className='gs-group'; g.textContent=label; box.appendChild(g); items.forEach(it=>add(it)); });
    if(!groups.length){ const e=document.createElement('div'); e.className='gs-empty'; e.textContent='Rien trouvé ailleurs.'; box.appendChild(e); }
    gsActive=0; gsPaint();
  }
  function gsPaint(){ document.querySelectorAll('#gs-results .gs-item').forEach((b,i)=>b.classList.toggle('on', i===gsActive)); $('gs-input').setAttribute('aria-activedescendant','gs-opt-'+gsActive); const on=$('gs-opt-'+gsActive); if(on) on.scrollIntoView({ block:'nearest' }); }
  function gsGo(i){ const it=gsList[i]; if(!it) return; gsClose(); it.go(); }
  function gsOpen(prefix){ $('gs-overlay').hidden=false; const inp=$('gs-input'); inp.value=prefix||''; gsRender(); inp.focus(); }
  window.todoCommandPalette=()=>gsOpen('>');
  function gsClose(){ $('gs-overlay').hidden=true; }
  $('gs-input').addEventListener('input', gsRender);
  $('gs-input').addEventListener('keydown', e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); gsActive=Math.min(gsList.length-1, gsActive+1); gsPaint(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); gsActive=Math.max(0, gsActive-1); gsPaint(); }
    else if(e.key==='Enter'){ e.preventDefault(); gsGo(gsActive); }
    else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); gsClose(); }
  });
  $('gs-overlay').addEventListener('click', e=>{ if(e.target.id==='gs-overlay') gsClose(); });
  $('gs-open-btn').onclick=()=>gsOpen(); $('gs-open-lite').onclick=()=>gsOpen();

  // ---------- widget mode: the tasks tab in a floating panel opened from a draggable bubble ----------
  function widgetOpenFull(url){
    url=url||'index.html';
    if(window.TODO_PIP || window.top!==window){ try{ window.open(url, '_blank'); }catch(e){} return; }   // mini window or embedded page: new tab
    location.href=url;
  }
  if(window.TODO_WIDGET){
    const root=document.documentElement, bubble=$('widget-bubble'), badge=$('widget-badge');
    document.querySelector('.tab[data-tab="tasks"]').click();
    if(!window.TODO_PIP && window.top===window) $('widget-hint').hidden=false;
    const setOpen=open=>{ root.classList.toggle('widget-open', open); bubble.setAttribute('aria-expanded', String(open)); if(open) setTimeout(()=>quickAddInput.focus(), 30); };
    window.__widgetToggle=()=>setOpen(!root.classList.contains('widget-open'));
    $('widget-close').onclick=()=>setOpen(false);
    $('widget-full').onclick=()=>widgetOpenFull();
    // panel next to the bubble, on the side where there is room
    const placePanel=()=>{
      const r=bubble.getBoundingClientRect(), p=$('todo-panel'), pw=p.offsetWidth||400, ph=p.offsetHeight||580;
      const left=Math.max(8, Math.min(r.right-pw, innerWidth-pw-8));
      const top=r.top-ph-12>8 ? r.top-ph-12 : Math.max(8, Math.min(r.bottom+12, innerHeight-ph-8));
      Object.assign(p.style, { left:left+'px', top:top+'px', right:'auto', bottom:'auto' });
    };
    // draggable bubble, position kept on this device
    const POS='todo_widget-bubble-pos';
    const place=(x,y)=>{ x=Math.max(4, Math.min(x, innerWidth-bubble.offsetWidth-4)); y=Math.max(4, Math.min(y, innerHeight-bubble.offsetHeight-4)); Object.assign(bubble.style, { left:x+'px', top:y+'px', right:'auto', bottom:'auto' }); };
    try{ const s=JSON.parse(localStorage.getItem(POS)||'null'); if(s) requestAnimationFrame(()=>{ place(s.x, s.y); placePanel(); }); }catch(e){}
    let drag=null;
    bubble.addEventListener('pointerdown', e=>{ const r=bubble.getBoundingClientRect(); drag={ dx:e.clientX-r.left, dy:e.clientY-r.top, x:e.clientX, y:e.clientY, moved:false, id:e.pointerId }; });
    document.addEventListener('pointermove', e=>{ if(!drag) return; if(!drag.moved && Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)<5) return; if(!drag.moved){ drag.moved=true; try{ bubble.setPointerCapture(drag.id); }catch(_){} } place(e.clientX-drag.dx, e.clientY-drag.dy); placePanel(); });
    document.addEventListener('pointerup', ()=>{ if(drag && drag.moved){ const r=bubble.getBoundingClientRect(); try{ localStorage.setItem(POS, JSON.stringify({ x:r.left, y:r.top })); }catch(e){} } });
    bubble.addEventListener('click', e=>{ if(drag && drag.moved){ drag=null; e.preventDefault(); return; } drag=null; placePanel(); window.__widgetToggle(); });
    addEventListener('resize', ()=>{ const r=bubble.getBoundingClientRect(); place(r.left, r.top); placePanel(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && root.classList.contains('widget-open') && !document.querySelector('.modal:not(.hidden), #add-section.open')) setOpen(false); });
    // count on the bubble: open tasks, red when one is late
    const paintCount=()=>{ const open=activeTasks(), late=open.some(t=>dueStatus(t.due)==='overdue'); badge.textContent=open.length||''; badge.classList.toggle('overdue', late); $('widget-count').textContent=open.length?'· '+open.length:''; };
    window.__widgetCount=paintCount;
    // mini mode: an always-on-top window (Document Picture-in-Picture) running this same panel
    $('widget-mini').onclick=async ()=>{
      if(!('documentPictureInPicture' in window)){ $('widget-mini').title='Mode mini indisponible : il faut Chrome ou Edge (version récente).'; $('widget-mini').classList.add('off'); return; }
      try{
        const w=await documentPictureInPicture.requestWindow({ width:380, height:560 });
        w.document.body.style.cssText='margin:0;background:#0A0D12;';
        const f=w.document.createElement('iframe'); f.src=new URL('index.html?widget&pip', location.href).href; f.title='Tâches'; f.style.cssText='border:0;width:100vw;height:100vh;display:block;';
        w.document.body.appendChild(f); setOpen(false);
      }catch(e){}
    };
    if(window.TODO_PIP) setTimeout(()=>quickAddInput.focus(), 300);
  }
  // one file at a time: a read and a write of the same file never overlap (they would merge against each other)
  const syncChains={};
  const oneAtATime=(key, fn)=>function(){ const args=arguments, self=this; const run=(syncChains[key]||Promise.resolve()).then(()=>fn.apply(self, args)); syncChains[key]=run.catch(()=>{}); return run; };
  syncPull=oneAtATime('tasks', trackSync(syncPull)); syncPushNow=oneAtATime('tasks', trackSync(syncPushNow));
  syncPullCrm=oneAtATime('crm', trackSync(syncPullCrm)); syncPushCrmNow=oneAtATime('crm', trackSync(syncPushCrmNow));
  syncPullNotes=oneAtATime('notes', trackSync(syncPullNotes)); syncPushNotesNow=oneAtATime('notes', trackSync(syncPushNotesNow));
  syncPullParc=oneAtATime('parc', trackSync(syncPullParc)); syncPushParc=oneAtATime('parc', trackSync(syncPushParc));
  ['sync-pill','sync-pill-lite','sync-pill-w'].forEach(id=>{ const el=$(id); if(el) el.onclick=onSyncPillClick; });
  window.addEventListener('online', ()=>{ if(syncConfig.enabled) syncEverythingNow(); else paintSyncPill(); });
  window.addEventListener('offline', paintSyncPill);
  $('storage-alert-close').onclick=()=>{ $('storage-alert').hidden=true; };
  $('storage-alert-see').onclick=()=>{ $('storage-alert').hidden=true; openStorageSection(); };
  loadAll().then(()=>{
    paintSyncPill(); checkStorageFull(); setInterval(checkStorageFull, 10*60*1000);
    $('sync-token-exp').value=syncConfig.tokenExpires||'';
    if(location.hash==='#sync' && !window.TODO_LITE) openSyncSettings();
  });
})();

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').then(r=>r.update()).catch(()=>{}); });
  // A new version was published: once its service worker takes over, reload once so the page itself is the new one
  // (not on the very first install, when no service worker controlled the page yet).
  if(navigator.serviceWorker.controller){
    let reloaded=false;
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{ if(reloaded) return; reloaded=true; location.reload(); });
  }
}
