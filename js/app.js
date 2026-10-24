// Todo — the app (loaded at the end of index.html, after js/storage.js): tasks, CRM, pipeline, Portefeuille, sync.
(function(){
  const $ = id => document.getElementById(id);
  const { parseVcf, toISO, PQ_INSTALLS, PQ_CONTRATS, PQ_REGIONS, PQ_DEPTS, pqDeptLabel, PQ_YIELD, PQ_FIELDS, PQ_SHARED_KEYS, PQ_EXTRA_FIELDS, PQ_INST_GROUPS, PQ_CENTRALE_KEYS, pqPad, pqFold, pqTitleCase, pqIsoToFr, pqAddDays, PQ_MONTH_NAMES, pqFmtPhone, pqQty, pqNum, pqDeptFromPostal, pqDeptFromText, pqParseDateLoose, xlDay, PQ_GENERIC_DOMAINS, parseSignatureBlock, pqDetectPeople, parsePipeMail, parseMailInstallations, pqPlantHints, xlRound, pqRowsToInstallations, pqXlsxToInstallations, parseEml, parseMsg, PQ_CIVILITY, pqFullDate, pqMonthYear } = window.TodoParse;   // the readers with no screen, in js/parse.js
  const { recs, mergeNoteLines, SILENT_MERGE, stableStringify, sameRecords } = window.TodoMerge;   // the sync merge, in js/merge.js
  const threeWayMerge=(type, local, remote, base)=>window.TodoMerge.threeWayMerge(type, local, remote, base, logConflict);
  const taskList=$('task-list'), badge=$('todo-badge'), headStats=$('head-stats'), tableHeader=$('table-header');
  const filters=$('filters'), viewSwitch=$('view-switch'), snoozePopover=$('snooze-popover');
  const reminderToggle=$('reminder-toggle'), reminderRow=$('reminder-row'), recurToggle=$('recur-toggle'), recurRow=$('recur-row');
  const clientInput=$('f-client'), projectInput=$('f-project'), clientDot=$('client-dot'), projectDot=$('project-dot');
  const clientDatalist=$('client-datalist'), projectDatalist=$('project-datalist');
  const tabs=document.querySelectorAll('.tab'), tabToday=$('tab-today'), tabTasks=$('tab-tasks'), tabInbox=$('tab-inbox'), tabArchive=$('tab-archive'), tabLists=$('tab-lists');
  const projectChipRow=$('project-chip-row');
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

  // only real records (an object with an id): a damaged file or an old bug never breaks the app
  const asText=v=>v==null?'':Array.isArray(v)||typeof v==='object'?'':String(v);
  function cleanRecords(){
    tasks=recs(tasks); companies=recs(companies); contacts=recs(contacts); meetings=recs(meetings); opportunities=recs(opportunities);
    tasks.forEach(t=>{ if(typeof t.title!=='string') t.title=asText(t.title); ['due','reminder'].forEach(k=>{ if(t[k] && !/^\d{4}-\d{2}-\d{2}/.test(String(t[k]))) t[k]=''; }); if(!Array.isArray(t.subtasks)) t.subtasks=(t.subtasks==null?[]:[]); t.subtasks=t.subtasks.filter(x=>x && typeof x==='object'); });
    contacts.forEach(c=>['firstName','lastName','company','email','phone1','phone2','role','comment'].forEach(k=>{ if(c[k]!=null && typeof c[k]!=='string') c[k]=asText(c[k]); }));
  }
  // A data key that can't be read (damaged JSON): its raw text is put aside as « corrupt-<key>-<time> » before anything is
  // saved over it, and a red banner says so (audit A5). It used to restart from an empty list without a word.
  const corruptKeys=[];
  async function loadKey(key, fallback){
    let r=null; try{ r=await window.storage.get(key,false); }catch(e){ return fallback; }
    if(!r || !r.value) return fallback;
    try{ const v=JSON.parse(r.value); return v==null?fallback:v; }
    catch(e){
      const keep='corrupt-'+key+'-'+Date.now();
      try{ localStorage.setItem(keep, r.value); }catch(e2){ try{ await window.storage.set(keep, r.value, false); }catch(e3){} }
      corruptKeys.push(key); console.error('unreadable data, kept as '+keep, e);
      return fallback;
    }
  }
  function reportCorrupt(){
    if(!corruptKeys.length) return;
    showStorageAlert('crit', 'Une partie des données de cet appareil était illisible ('+corruptKeys.length+' ensemble'+(corruptKeys.length>1?'s':'')+'). Une copie brute est gardée sur cet appareil. '
      +(syncConfig.enabled?'La synchro va reprendre le contenu depuis GitHub.':'Restaure ta dernière sauvegarde (Réf. & data › Importer), ou active la synchro.'));
  }
  async function loadAll(){
    tasks=await loadKey(TASKS_KEY, []);
    clientsList=await loadKey(CLIENTS_KEY, []);
    projectsList=await loadKey(PROJECTS_KEY, []);
    companies=await loadKey(COMPANIES_KEY, []);
    contacts=await loadKey(CONTACTS_KEY, []);
    meetings=await loadKey(MEETINGS_KEY, []);
    opportunities=await loadKey(OPPS_KEY, []);
    companyTypesList=await loadKey(COMPANY_TYPES_KEY, []);
    try{ const r=await window.storage.get('sync-conflicts',false); conflicts=r&&r.value?JSON.parse(r.value):[]; }catch(e){ conflicts=[]; }
    // the conflicts already logged: one per record and field (the latest), none about the app's own bookkeeping or logs
    { const before=conflicts.length, seen=new Set(), keep=[];
      conflicts.slice().reverse().forEach(c=>{ const k=c.entityType+'|'+c.entityId+'|'+c.field; if(seen.has(k) || SILENT_MERGE.has(c.field) || ['notesLog','stageLog','checks'].includes(c.field)) return; seen.add(k); keep.unshift(c); });
      if(keep.length!==before){ conflicts=keep; try{ await window.storage.set('sync-conflicts', JSON.stringify(conflicts), false); }catch(e){} } }
    // post-it conflicts are no longer kept (its lines are merged): clear the old ones
    if(conflicts.some(c=>c.entityType==='note')){ conflicts=conflicts.filter(c=>c.entityType!=='note'); try{ await window.storage.set('sync-conflicts', JSON.stringify(conflicts), false); }catch(e){} }
    try{ const r=await window.storage.get('sync-tasks-base',false); tasksBaseSnapshot=r&&r.value?JSON.parse(r.value):null; }catch(e){ tasksBaseSnapshot=null; }
    try{ const r=await window.storage.get('sync-crm-base',false); crmBaseSnapshot=r&&r.value?JSON.parse(r.value):null; }catch(e){ crmBaseSnapshot=null; }
    notes=await loadKey(NOTES_KEY, []);
    try{ const r=await window.storage.get('sync-notes-base',false); notesBaseSnapshot=r&&r.value?JSON.parse(r.value):null; }catch(e){ notesBaseSnapshot=null; }
    try{ const r=await window.storage.get('visible-columns',false); if(r&&r.value) visibleColumns=Object.assign(visibleColumns, JSON.parse(r.value)); }catch(e){}
    cleanRecords();
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
    try{ render(); renderArchive(); renderLists(); renderToday(); renderContacts(); renderPipeline(); renderNotes(); }catch(e){ softFail('affichage après annulation', e); }
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
  // An error the app can live with still leaves a trace (audit C6): always in the console; said to the person when tell is given.
  function softFail(where, e, tell){ try{ console.error('['+where+']', e); }catch(e2){} if(tell){ try{ setSyncStatus(tell); }catch(e3){} } }

  async function loadSyncConfig(){
    try{ const r=await window.storage.get(SYNC_CONFIG_KEY,false); syncConfig=r&&r.value?JSON.parse(r.value):{owner:'',repo:'',token:'',enabled:false}; }
    catch(e){ syncConfig={owner:'',repo:'',token:'',enabled:false}; }
  }
  async function saveSyncConfig(){ try{ await window.storage.set(SYNC_CONFIG_KEY,JSON.stringify(syncConfig),false); }catch(e){} }

  // every call to GitHub gives up after a while (audit A6): on a phone whose network drops, a request could hang for
  // minutes, the sync pill stayed on « Synchronisation… » and the next pushes piled up behind it
  // ... and carries the token itself (audit C5): the callers only say what is theirs (method, body, a special Accept)
  function ghFetch(url, opt){
    opt=Object.assign({}, opt||{}); const ms=opt.method==='PUT'?45000:20000;
    opt.headers=Object.assign({ 'Authorization':'Bearer '+syncConfig.token, 'Accept':'application/vnd.github+json' }, opt.headers||{});
    if(window.AbortSignal && AbortSignal.timeout) opt.signal=AbortSignal.timeout(ms);
    else { const c=new AbortController(); setTimeout(()=>c.abort(), ms); opt.signal=c.signal; }
    return fetch(url, opt);
  }
  function syncApiUrl(path){ return 'https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo+'/contents/'+(path||SYNC_TASKS_PATH); }
  function b64EncodeUtf8(str){ return btoa(unescape(encodeURIComponent(str))); }
  function b64DecodeUtf8(b64){ return decodeURIComponent(escape(atob(b64.replace(/\n/g,'')))); }

  // Reads a JSON file of the data repo. The "object" media type works up to 100 MB (the default one stops
  // at 1 MB); above 1 MB the content comes empty and is fetched again as raw text.
  async function ghGetJson(path){
    const res=await ghFetch(syncApiUrl(path), { headers:{ 'Accept':'application/vnd.github.object+json' }, cache:'no-store' }).catch(e=>{ syncNote(null); throw e; });
    syncNote(res);
    if(!res.ok) return { ok:false, status:res.status };
    const data=await res.json();
    let text;
    if(data.content && data.encoding!=='none') text=b64DecodeUtf8(data.content);
    else {
      const raw=await ghFetch(syncApiUrl(path), { headers:{ 'Accept':'application/vnd.github.raw+json' }, cache:'no-store' });
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
    el.classList.toggle('warn', kind==='warn' || kind==='ios'); $('storage-alert-text').textContent=text; el.hidden=false;
    el.dataset.kind=kind; const see=$('storage-alert-see'); if(see) see.hidden=(kind==='ios');
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
    }catch(e){ softFail('mesure de l\u2019espace', e); }
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
      html+='<div class="muted">Réglages et autres pages de '+escapeHtml(location.host||'cette adresse')+' : '+Math.round(lsRatio*100)+' % du stockage simple (limite partagée entre ces pages).</div>';
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
    opportunity:{ name:o=>[o.company, o.kind==='request'?(o.label||'demande'):(o.centrale||o.title)].filter(Boolean).join(' — ')||'(sans nom)', fields:{title:'Intitulé',company:'Société',stage:'Étape',centrale:'Centrale',kwc:'Puissance',mwh:'P50',mesPrev:'MES prévisionnelle',lot:'Lot',nature:'Offre demandée',dept:'Département',commune:'Commune',requestId:'Demande'} },
    note:{ name:n=>'Post-it « '+(n.text||'').slice(0,30)+' »', fields:{text:'Texte',kind:'Type',forDate:'Pour le'} }
  };

  // src: where each version comes from, shown with the choice ({ a:'Sur cet appareil…', b:'Dans le fichier…' })
  function logConflict(entityType, entity, field, localValue, remoteValue, resolvedValue, src){
    const meta=CONFLICT_ENTITY_LABELS[entityType];
    // the same field of the same record, again at the next sync: one line, the latest, not a new one each time
    { const i=conflicts.findIndex(c=>c.entityType===entityType && c.entityId===entity.id && c.field===field); if(i>=0) conflicts.splice(i, 1); }
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

  // once a day: is the data repo still private? If it became public, the sync stops at once and a red banner says why (audit A10)
  async function checkRepoStillPrivate(){
    let last=0; try{ last=+localStorage.getItem('repo-private-checked-at')||0; }catch(e){}
    if(Date.now()-last<864e5) return true;
    try{
      const r=await ghFetch('https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo, { headers:{ 'Accept':'application/vnd.github+json' }, cache:'no-store' });
      if(!r.ok) return true;   // can't tell (network, rights): the next pull asks again
      const info=await r.json();
      if(info.private===false){
        syncConfig.enabled=false; await saveSyncConfig(); paintSyncPill();
        showStorageAlert('crit', 'Synchro suspendue : le dépôt GitHub « '+syncConfig.repo+' » est devenu PUBLIC. Rien n\u2019y est plus envoyé. Repasse-le en privé (Settings › Danger Zone sur GitHub), puis réactive la synchro dans Réf. & data.');
        return false;
      }
      try{ localStorage.setItem('repo-private-checked-at', String(Date.now())); }catch(e){}
    }catch(e){ softFail('dépôt privé ?', e); }
    return true;
  }
  async function syncPull(){
    if(!syncConfig.enabled) return;
    if(!(await checkRepoStillPrivate())) return;
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
      const sentTasks=JSON.stringify(tasks);   // the reference copy becomes what is sent (audit A9): an edit made during the write is not taken as synced
      const body={ message:'Sync tasks', content:b64EncodeUtf8(sentTasks), branch:'main' };
      if(sha) body.sha=sha;
      const putRes=await ghFetch(syncApiUrl(), {
        method:'PUT',
        headers:{ 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' },
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
        tasksBaseSnapshot=JSON.parse(sentTasks);
        await saveSnapshots(); syncRetryDone('tasks');
        if(JSON.stringify(tasks)!==sentTasks) scheduleSyncPush();   // changed while it was being sent: goes in the next write
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
      const bundle=JSON.stringify({companies,contacts,meetings,opportunities});   // the reference copy becomes what is sent (audit A9)
      const body={ message:'Sync CRM data', content:b64EncodeUtf8(bundle), branch:'main' };
      if(sha) body.sha=sha;
      const putRes=await ghFetch(syncApiUrl(SYNC_CRM_PATH), {
        method:'PUT',
        headers:{ 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' },
        body:JSON.stringify(body)
      });
      syncNote(putRes);
      if(putRes.ok){
        const putData=await putRes.json();
        lastKnownCrmSha=putData.content.sha;
        // See syncPushNow: only advance the base once the write is confirmed,
        // or a failed PUT leaves a stale base that reverts real local changes
        // on the next merge.
        crmBaseSnapshot=JSON.parse(bundle);
        await saveSnapshots(); syncRetryDone('crm');
        if(JSON.stringify({companies,contacts,meetings,opportunities})!==bundle) scheduleCrmSyncPush();
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
      if(k===TASKS_KEY){ tasks=recs(v); refreshAllViews(); }
      else if(k===COMPANIES_KEY){ companies=recs(v); renderCrm(); }
      else if(k===CONTACTS_KEY){ contacts=recs(v); renderCrm(); }
      else if(k===MEETINGS_KEY){ meetings=recs(v); }
      else if(k===OPPS_KEY){ opportunities=recs(v); renderCrm(); }
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
      const r=await ghFetch('https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo, { headers:{ 'Accept':'application/vnd.github+json' }, cache:'no-store' });
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
      const res=await ghFetch(syncApiUrl(SYNC_PARC_PATH), { method:'PUT', headers:{ 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' }, body:JSON.stringify(body) });
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
      const sentNotes=JSON.stringify(notes);   // the reference copy becomes what is sent (audit A9)
      const body={ message:'Sync notes', content:b64EncodeUtf8(sentNotes), branch:'main' };
      if(sha) body.sha=sha;
      const putRes=await ghFetch(syncApiUrl(SYNC_NOTES_PATH), {
        method:'PUT',
        headers:{ 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' },
        body:JSON.stringify(body)
      });
      syncNote(putRes);
      if(putRes.ok){
        const putData=await putRes.json();
        lastKnownNotesSha=putData.content.sha;
        notesBaseSnapshot=JSON.parse(sentNotes);
        await saveNotesBase(); syncRetryDone('notes');
        if(JSON.stringify(notes)!==sentNotes) scheduleNotesSyncPush();
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
  function fmtDateShort(d){ if(!d)return null; const dt=new Date(d+'T00:00:00'); return isNaN(dt)?String(d):DF_DM.format(dt); }   // a date typed wrong is shown as is, never breaks the list
  function fmtDateTime(ts){ const dt=new Date(ts); return isNaN(dt)?'':DF_DMY.format(dt)+' '+DF_HM.format(dt); }
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
      const res = await ghFetch(url, { headers:{ 'Accept':'application/vnd.github+json' } });
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

  // an item taken from a queue the Outlook macro also writes: if both write at once (409), read again and retry (audit A13)
  async function removeFromGhList(path, itemId, message){
    if(!syncConfig.enabled) return;
    const url='https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo+'/contents/'+path, auth={ 'Accept':'application/vnd.github+json' };
    for(let attempt=0; attempt<3; attempt++){
      try{
        const getRes=await ghFetch(url, { headers:auth, cache:'no-store' }); if(!getRes.ok) return;
        const getData=await getRes.json(), currentItems=JSON.parse(b64DecodeUtf8(getData.content)), filtered=currentItems.filter(x=>x.id!==itemId);
        if(filtered.length===currentItems.length) return;
        const put=await ghFetch(url, { method:'PUT', headers:Object.assign({ 'Content-Type':'application/json' }, auth), body:JSON.stringify({ message, content:b64EncodeUtf8(JSON.stringify(filtered)), sha:getData.sha, branch:'main' }) });
        if(put.ok || (put.status!==409 && put.status!==422)) return;
      }catch(e){ console.error('failed to remove an item from '+path, e); return; }
      await new Promise(r=>setTimeout(r, 800*(attempt+1)));
    }
  }
  const removeFromInboxOnGitHub=itemId=>removeFromGhList(INBOX_FILE_PATH, itemId, 'Remove imported inbox item');


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
      return row(o.kind==='prequal'?o.company+' (pré-qualif)':oppName(o), [o.kind==='prequal'?'':o.company, stageLabel(o.stage, o)].filter(Boolean).join(' · '), d+' j', ()=>{ gsTab('pipeline'); setTimeout(()=>openOppDetail(o.id),30); }, d>=30?'late':''); }),
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
  const PREF_PREFIX='pref_', SYNCED_PREFS=['saved-views-tasks','saved-views-pipeline','network-pins','network-hidden','pipe-goals','pipe-meet-phases','pipe-meet-cols','map-color','goal-milestones','market-board'];
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
    // the calls of the week (mode appel), and what is stuck now (more than 15 days at the same step), with who has it
    const calls=[]; { const seen=new Set(); insts.forEach(o=>(o.notesLog||[]).forEach(n=>{ if(n.kind!=='appel' || !inR(n.at)) return; const k=n.at+'|'+(o.requestId||o.id); if(seen.has(k)) return; seen.add(k);
      calls.push({ at:n.at, line:new Date(n.at).toLocaleDateString('fr-FR',{ day:'2-digit', month:'2-digit' })+' · '+(o.company||'')+(n.text?' — '+(n.text.length>90?n.text.slice(0,90)+'…':n.text):'') }); })); }
    calls.sort((x,y)=>x.at-y.at);
    sections.splice(5, 0, ['Appels', calls.map(c=>c.line)]);
    if(which!=='last'){ const stuck=new Map(); insts.filter(o=>o.kind==='installation' && !isExited(o) && o.stage!=='actif').forEach(o=>{ const d=daysInStage(o); if(d==null || d<=15) return;
        const k=meetBlockKey(o); const x=stuck.get(k)||{ o, d, list:[] }; x.list.push(o); stuck.set(k,x); });
      sections.splice(6, 0, ['Bloqués (plus de 15 jours à la même étape)', [...stuck.values()].sort((x,y)=>y.d-x.d).map(x=>{ const st=oppStage(x.o.stage);
        return x.o.company+' — '+(meetBlockName(x.o) && x.list.length>1?meetBlockName(x.o):x.list.length>3?x.list.length+' installations':x.list.map(oppName).join(', '))+' : '+stageLabel(x.o.stage, x.o)+(st && st.who!=='Com'?', chez '+(WHO[st.who]||st.who):'')+', depuis '+x.d+' j'; })]); }
    const freshMw=mwOf(fresh.filter(o=>o.kind==='installation'));
    const kpis=[[signed.length,'signé'+(signed.length>1?'s':'')+(signed.length?' · '+mw(mwOf(signed)):'')],[offers.length,'offre'+(offers.length>1?'s':'')+' remise'+(offers.length>1?'s':'')],[moves.size,'avancée'+(moves.size>1?'s':'')+' de dossier'],[done.length,'tâche'+(done.length>1?'s':'')+' faite'+(done.length>1?'s':'')]].concat(freshMw?[[mw(freshMw),'entrés dans le pipeline']]:[], calls.length?[[calls.length,'appel'+(calls.length>1?'s':'')]]:[]);
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
  window.todoExtraCommands=(window.todoExtraCommands||[]).concat([{ t:'Chercher les doublons (installations, sociétés)', k:'doublons double fusion fusionner meme installation societe', go:()=>{ openDupes(); } }]);
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
  function renderArchive(){
    // drawn when it is shown (the tab click draws it again): validating a task stays quick with a long archive
    if($('tab-archive').classList.contains('hidden'))return;
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
        const val=document.createElement('span'); val.className='conflict-choice-value'; val.textContent=value==null||value===''?'—':Array.isArray(value)?value.length+' élément'+(value.length>1?'s':''):typeof value==='object'?Object.keys(value).length+' valeur'+(Object.keys(value).length>1?'s':''):cf.field==='stage'?stageLabel(value):String(value);
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
      const res=await ghFetch(url, { headers:{ 'Accept':'application/vnd.github+json' } });
      if(!res.ok) throw new Error('no contact inbox file');
      const data=await res.json();
      contactInboxItems=JSON.parse(b64DecodeUtf8(data.content)).map(enrichInboxContact);
    }catch(e){ contactInboxItems=[]; }
    renderContactInbox();
  }
  // the Outlook macro may send the mail's signature (or, for a forwarded introduction, the whole forwarded mail):
  // read like a pasted signature, it fills what the sender's name and address don't give (role, phones, company)
  function enrichInboxContact(it){
    if(!it || !it.signature) return it;
    let g=null; try{ g=parseSignatureText(String(it.signature)); }catch(e){ softFail('signature d\u2019un contact de la macro', e); }
    if(!g) return it;
    const out=Object.assign({}, it);
    ['firstName','lastName','email','company','role','phone1','phone2'].forEach(k=>{ if(g[k] && (it.forwarded || !out[k])) out[k]=g[k]; });
    return out;
  }
  function pendingContactInboxItems(){ return contactInboxItems.filter(it=>!contactInboxSeenIds.has(it.id)); }

  const removeFromContactInboxOnGitHub=itemId=>removeFromGhList(CONTACT_INBOX_FILE_PATH, itemId, 'Remove imported contact');


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
    c={ id:'ct_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), firstName:it.firstName||'', lastName:it.lastName||'', role:it.role||'', company:it.company||'', email:it.email||'', phone1:it.phone1||'', phone2:it.phone2||'', relevance:0, createdAt:Date.now(), updatedAt:Date.now(), deleted:false };
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
    if(!window.TODO_LITE){ const call=document.createElement('button'); call.type='button'; call.className='ct-call-btn'; call.title='Mode appel'; call.setAttribute('aria-label','Appeler '+([c.firstName,c.lastName].filter(Boolean).join(' ')||'le contact')+' en Mode appel');
      call.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
      call.onclick=e=>{ e.stopPropagation(); const mailC=(c.email||'').toLowerCase(), deals=opportunities.filter(o=>!o.deleted && o.kind==='installation' && !isExited(o) && ((mailC && (o.mail||'').toLowerCase()===mailC) || (c.company && sameCo(o.company||'', c.company))));
        openCallMode(deals, ()=>renderContacts(), c); };
      actions.appendChild(call); }
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
      const tag=document.createElement('span'); tag.className='contact-activity-row-tag'; tag.style.cssText='color:var(--accent);background:var(--accent-dim);'; tag.textContent=o.stage==='perdu'?'Perdu':stageLabel(o.stage, o);
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
  const LEGACY_STAGE={ demarchage:'a_qualifier', prospect:'a_qualifier', pricing:'pricing_indicatif', demande_prix:'pricing_indicatif', encodage:'onboarding', bascule:'actif' };
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

  // One loader for every library fetched on demand (audit C5): loaded once, retried after a failure, ready() skips it
  // when the library is already there (a test, or a second call).
  const scriptLoads=new Map();
  function loadScript(src, ready, failMsg){
    if(ready && ready()) return Promise.resolve();
    if(!scriptLoads.has(src)) scriptLoads.set(src, new Promise((res, rej)=>{ const sc=document.createElement('script'); sc.src=src;
      sc.onload=()=>res(); sc.onerror=()=>{ scriptLoads.delete(src); sc.remove(); rej(new Error(failMsg||('Chargement impossible : '+src))); }; document.head.appendChild(sc); }));
    return scriptLoads.get(src);
  }
  const loadXlsxLib=()=>loadScript('vendor/xlsx-0.20.3.full.min.js', ()=>!!window.XLSX, 'Bibliothèque Excel indisponible (hors ligne ?)');
  async function readPipeFiles(files){
    const texts=[], installs=[], names=[], unreadable=[];
    for(const f of files){
      const n=f.name.toLowerCase(); names.push(f.name);
      if(/\.(xlsx|xlsm|xls)$/.test(n)){ await loadXlsxLib(); installs.push(...pqXlsxToInstallations(XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true}))); }
      else if(/\.msg$/.test(n)){
        await loadXlsxLib();
        const m=parseMsg(await f.arrayBuffer());
        texts.push('De : '+m.from+'\nObjet : '+m.subject+'\n\n'+m.body);
        for(const a of m.attachments){ if(/\.(xlsx|xlsm|xls)$/i.test(a.name)){ try{ installs.push(...pqXlsxToInstallations(XLSX.read(a.data,{type:'array',cellDates:true}))); names.push(a.name); }catch(e){ softFail('pièce jointe '+a.name, e); unreadable.push(a.name); } } }
      }
      else if(/\.eml$/.test(n)){
        const m=parseEml(await f.text());
        texts.push('De : '+m.from+'\nObjet : '+m.subject+'\n\n'+m.body);
        const xl=m.attachments.filter(a=>/\.(xlsx|xlsm|xls)$/i.test(a.name));
        if(xl.length) await loadXlsxLib();
        for(const a of xl){ try{ installs.push(...pqXlsxToInstallations(XLSX.read(a.data,{type:'array',cellDates:true}))); names.push(a.name); }catch(e){ softFail('pièce jointe '+a.name, e); unreadable.push(a.name); } }
      }
      else texts.push(await f.text());
    }
    return { text:texts.join('\n\n'), installs, names, unreadable };
  }

  // ----- Stages -----
  function oppStage(key){ return OPP_STAGES.find(s=>s.key===key)||null; }
  function stageIndex(key){ return OPP_STAGES.findIndex(s=>s.key===key); }
  // The offer's pricing step is « indicatif » or « engageant » after the kind of offer asked (Nature offre); an offer
  // engageante from the start already carries the firm price: the contract's « Pricing ferme » is then included (skipped).
  const isEngageant=o=>!!o && o.nature==='Engageante';
  // still in process: an installation not lost and not yet in service (in service lives in the Portefeuille)
  const inProcess=o=>!isExited(o) && o.stage!=='actif';
  function stageLabel(key, o){ if(key==='prequal') return 'Pré-qualif'; if(OPP_EXITS[key]) return OPP_EXITS[key];
    if(key==='pricing_indicatif' && isEngageant(o)) return 'Pricing engageant';
    const s=oppStage(LEGACY_STAGE[key]||key); return s?s.label:key; }
  const stageTaskOf=(st, o)=>st.key==='pricing_indicatif' && isEngageant(o)?'Pricing engageant':st.task;
  function oppPhase(o){ if(o.kind==='prequal') return 'prequal'; const s=oppStage(o.stage); return s?s.phase:null; }
  function oppName(o){ return o.centrale||o.title||'(sans nom)'; }
  function isExited(o){ return !!OPP_EXITS[o.stage]; }
  function pipeStade(o){
    if(o.stage==='no_go') return 'No Go';
    const i=stageIndex(o.stage), go=stageIndex('pricing_indicatif');
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
    if(opportunities.some(o=>!o || typeof o!=='object' || o.id==null || o.id==='')){ opportunities=recs(opportunities); changed=true; }
    opportunities.forEach(o=>{ if(o.kind!=='request' && o.kind!=='prequal' && o.company!=null && typeof o.company!=='string'){ o.company=asText(o.company); changed=true; } });
    opportunities.forEach(o=>{
      if(!o.kind){ o.kind='installation'; changed=true; }
      if(o.kind==='installation'){
        if(LEGACY_STAGE[o.stage]){ o.stage=LEGACY_STAGE[o.stage]; changed=true; }
        if(!oppStage(o.stage) && !OPP_EXITS[o.stage] && o.stage!=='converti'){ o.stage='a_qualifier'; changed=true; }   // a step the app doesn't know: back to the start, not lost
        ['notesLog','stageLog'].forEach(k=>{ if(o[k]!=null && !Array.isArray(o[k])){ o[k]=[]; changed=true; } else if(Array.isArray(o[k]) && o[k].some(e=>!e || typeof e!=='object')){ o[k]=o[k].filter(e=>e && typeof e==='object'); changed=true; } });
        if(o.checks!=null && (typeof o.checks!=='object' || Array.isArray(o.checks))){ o.checks={}; changed=true; }
        ['company','centrale','lot','producteur'].forEach(k=>{ if(o[k]!=null && typeof o[k]!=='string'){ o[k]=asText(o[k]); changed=true; } });
        ['mesPrev','mesEff','dateOffre','debut','fin','dept'].forEach(k=>{ if(o[k]!=null && typeof o[k]==='object'){ o[k]=''; changed=true; } });
        if(!o.centrale && o.title){ o.centrale=o.title; changed=true; }
        if(!o.producteur && o.company){ o.producteur=o.company; changed=true; }
      }
    });
    return changed;
  }
  function renderCrm(){
    try{ paintDupBanner(); }catch(e){ softFail('bandeau doublons', e); }
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
  let pipeShowExited=false, pipeDash=false, pipeMeet=false, pipeList=false, pipeMap=false, meetColsOpen=false; try{ pipeList=localStorage.getItem('pipe-list')==='1'; }catch(e){}
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
  // how likely a deal reaches commissioning, by step (an estimate, for the forecast)
  const MES_WEIGHTS={ a_qualifier:.05, prise_contact:.05, collecte:.1, qualif_en_cours:.15, pricing_indicatif:.25, offre_remise:.3, offre_attente:.4, kyc:.6, negociation:.7, pricing_ferme:.75, mise_signature:.85, signature:.9, onboarding:1, actif:1 };
  // MWc expected to start, by quarter over two years: in play, and likely (weighted by the step)
  function mesForecast(list){
    const W=MES_WEIGHTS, today=new Date(), q0=today.getFullYear()*4+Math.floor(today.getMonth()/3), Q=8, rows=Array.from({ length:Q }, (_,i)=>({ q:q0+i, all:0, likely:0, sure:0, n:0 }));
    let vague=0;   // a year alone (« 2027 ») can't be put in a quarter
    list.filter(o=>o.kind==='installation' && !isExited(o)).forEach(o=>{ const v=String(o.mesEff||o.mesPrev||'').trim(), tq=/^T([1-4])\s+(\d{4})$/i.exec(v), p2=tq?null:pqMonthYear(v);
      if(!tq && (!p2 || p2.m==null)){ if(p2) vague+=kwcNum(o)*(W[o.stage]||0); return; }
      const d=tq?new Date(+tq[2], (+tq[1]-1)*3, 1):new Date(p2.y, p2.m-1, p2.d||1); const qi=d.getFullYear()*4+Math.floor(d.getMonth()/3)-q0; if(qi<0 || qi>=Q) return;
      const k=kwcNum(o), w=W[o.stage]!=null?W[o.stage]:0; const r=rows[qi]; r.all+=k; r.likely+=k*w; if(w>=1) r.sure+=k; r.n++; });
    const tot=rows.reduce((x,r)=>x+r.likely,0), all=rows.reduce((x,r)=>x+r.all,0), maxA=Math.max(1,...rows.map(r=>r.all));
    const ch=document.createElement('div'); ch.className='pd-mes';
    rows.forEach(r=>{ const col=document.createElement('div'); col.className='pd-mes-col'; col.title=r.n?r.n+' installation'+(r.n>1?'s':'')+' · en jeu '+fmtMwc(r.all)+' · probable '+fmtMwc(r.likely)+(r.sure?' · signé '+fmtMwc(r.sure):''):'Rien de prévu';
      col.innerHTML='<span class="v"></span><span class="bars"><span class="a"></span><span class="l"></span></span><span class="q"></span>';
      col.querySelector('.v').textContent=r.likely?(Math.round(r.likely/100)/10).toLocaleString('fr-FR'):'';
      col.querySelector('.a').style.height=(r.all/maxA*100)+'%'; col.querySelector('.l').style.height=(r.likely/maxA*100)+'%';
      col.querySelector('.q').textContent='T'+(r.q%4+1)+' '+String(Math.floor(r.q/4)).slice(2); ch.appendChild(col); });
    const text='Sur deux ans : '+fmtMwc(tot)+' probables, sur '+fmtMwc(all)+' en jeu (MWc, chiffre au-dessus de chaque barre).'+(vague?' Et '+fmtMwc(vague)+' probables avec une année seule, sans trimestre.':'');
    return { tot, all, chart:ch, text };
  }
  function renderPipeDash(board){
    board.classList.add('pipe-dash');
    const all=opportunities.filter(o=>!o.deleted && o.kind!=='request' && o.stage!=='converti');
    const live=all.filter(o=>!isExited(o) && o.stage!=='actif'), year=String(new Date().getFullYear());   // the pipeline's views: deals still in process (in service = the Portefeuille)
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
    { const wb=document.createElement('button'); wb.type='button'; wb.className='pipe-bar-btn pd-week'; wb.textContent='Résumé de la semaine à copier'; wb.title='Signés, offres, avancées, nouveaux dossiers, appels, bloqués : prêt à coller dans un mail ou Teams'; wb.onclick=()=>openWeek('this'); board.appendChild(wb); }
    const grid=document.createElement('div'); grid.className='pd-grid'; board.appendChild(grid);
    const card=(title,hint)=>{ const c=document.createElement('section'); c.className='pd-card'; const h=document.createElement('h4'); h.textContent=title; c.appendChild(h); if(hint){ const p=document.createElement('p'); p.className='pd-hint'; p.textContent=hint; c.appendChild(p); } grid.appendChild(c); return c; };
    // MWc by phase, bars to one scale
    const ph=PIPE_PHASES.filter(p=>p.key!=='prequal' && p.key!=='actif').map(p=>{ const l=live.filter(o=>oppPhase(o)===p.key); return { label:p.label, n:l.length, kwc:l.reduce((s,o)=>s+kwcNum(o),0) }; });
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
    // who holds the deals now: me, Ops, the legal team, the producer, the management — and how long they wait there
    { const by={}; live.filter(o=>o.kind==='installation' && o.stage!=='actif').forEach(o=>{ const st=oppStage(o.stage); if(!st) return; const w=st.who==='SC'?'Ops':st.who; (by[w]=by[w]||[]).push(o); });
      const order=['Com','Ops','Jur','Client','Dir'].filter(w=>by[w]);
      const c4=card('Qui a la main', order.length?'Dossiers en cours selon qui doit agir à leur étape ; jours = depuis l\u2019entrée dans l\u2019étape.':'Aucun dossier en cours.');
      const maxN=Math.max(1,...order.map(w=>by[w].length));
      order.forEach(w=>{ const l=by[w], ds=l.map(daysInStage).filter(d=>d!=null), avg=ds.length?Math.round(ds.reduce((x,y)=>x+y,0)/ds.length):null, late=ds.filter(d=>d>15).length;
        const r=document.createElement('div'); r.className='pd-bar-row pd-who-row'; r.innerHTML='<span class="pd-l"><span class="who-chip"></span></span><span class="pd-bar"><span></span></span><span class="pd-v"></span>';
        const ch=r.querySelector('.who-chip'); ch.classList.add('who-'+w.toLowerCase()); ch.textContent=WHO[w]||w;
        r.querySelector('.pd-bar span').style.width=Math.max(4,l.length/maxN*100)+'%';
        r.querySelector('.pd-v').textContent=l.length+' · '+fmtMwc(l.reduce((x,o)=>x+kwcNum(o),0))+(avg!=null?' · '+avg+' j en moy.':'')+(late?' · '+late+' > 15 j':'');
        if(late) r.classList.add('late'); c4.appendChild(r); }); }
    // commissioning to come, by quarter: what is in play and what is likely (weighted by how far the deal is)
    { const f=mesForecast(live), W=MES_WEIGHTS;
      const c5=card('Mises en service à venir', f.tot?'MWc par trimestre selon la date de mise en service de la fiche. Barre claire : en jeu ; foncée : probable (pondéré par l\u2019étape : '+Object.entries({ 'qualification':W.qualif_en_cours, 'pricing':W.pricing_indicatif, 'offre en attente':W.offre_attente, 'KYC':W.kyc, 'signature':W.signature }).map(([l,v])=>l+' '+Math.round(v*100)+' %').join(', ')+', signé 100 %).':'Aucune date de mise en service dans les deux ans sur les dossiers en cours.');
      if(f.tot){ c5.appendChild(f.chart); const t2=document.createElement('p'); t2.className='pd-hint'; t2.textContent=f.text; c5.appendChild(t2); } }
    // deals that drag
    const now=Date.now(), stalled=live.filter(o=>o.stage!=='actif' && lastMove(o)>1e12 && now-lastMove(o)>=STALL_DAYS*864e5).sort((a,b)=>lastMove(a)-lastMove(b));
    const c3=card('Dossiers qui traînent', stalled.length?'Sans étape ni modification depuis '+STALL_DAYS+' jours ou plus.':'Aucun dossier sans mouvement depuis '+STALL_DAYS+' jours.');
    stalled.slice(0,10).forEach(o=>{ const d=Math.floor((now-lastMove(o))/864e5); const r=document.createElement('button'); r.type='button'; r.className='tw-row'+(d>=30?' late':'');
      r.innerHTML='<span class="k"><b></b><span></span></span><span class="v"></span>'; r.querySelector('b').textContent=o.kind==='prequal'?o.company+' (pré-qualif)':oppName(o);
      r.querySelector('.k span').textContent=[o.kind==='prequal'?'':o.company, stageLabel(o.stage, o)].filter(Boolean).join(' · '); r.querySelector('.v').textContent=d+' j'; r.onclick=()=>openOppDetail(o.id); c3.appendChild(r); });
  }
  // ----- List view: every installation in one sortable table (search, saved view and « Sorties » apply) -----
  const PL_COLS=[
    ['company','Producteur',o=>o.company||''],['bloc','Bloc',o=>{ const r=o.requestId&&opportunities.find(x=>x.id===o.requestId); return r&&!r.deleted?(r.label||requestInstalls(r.id).length+' inst.'):''; }],
    ['name','Installation',o=>oppName(o)],['stage','Étape',o=>stageIndex(o.stage)],['kwc','Puissance',o=>kwcNum(o)],['mwh','P50 (MWh/an)',o=>pqNum(String(o.mwh||''))||0],
    ['mes','MES',o=>{ const d=pqToDate(o.mesEff||o.mesPrev); return d?d.getTime():9e15; }],['contrat','Contrat',o=>o.contrat||''],['dept','Dépt',o=>o.dept||''],
    ['charge','Chargé',o=>o.charge||''],['upd','Modifiée',o=>lastMove(o)]];
  function renderPipeList(board, q){
    board.classList.add('pipe-list');
    let sort={ k:'stage', dir:-1 }; try{ const v=JSON.parse(localStorage.getItem('pipe-list-sort')||'null'); if(v && PL_COLS.some(c=>c[0]===v.k)) sort=v; }catch(e){}
    const vp=savedViewState.pipeline && savedViewState.pipeline.pred;
    const rows=opportunities.filter(o=>!o.deleted && o.kind==='installation' && o.stage!=='actif' && (pipeShowExited || !isExited(o)))
      .filter(o=>!q || pqFold([o.company,o.centrale,o.title,o.dept,o.commune,o.contrat].join(' ')).includes(q)).filter(o=>!vp || vp(o));
    const col=PL_COLS.find(c=>c[0]===sort.k), val=col[2];
    rows.sort((a,b)=>{ const x=val(a), y=val(b); const c=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'fr',{ numeric:true }); return c*sort.dir || (a.company||'').localeCompare(b.company||'','fr') || oppName(a).localeCompare(oppName(b),'fr',{ numeric:true }); });
    const kw=rows.reduce((t,o)=>t+kwcNum(o),0), mwh=rows.reduce((t,o)=>t+(pqNum(String(o.mwh||''))||0),0);
    const head=document.createElement('div'); head.className='pl-head';
    head.textContent=rows.length+' installation'+(rows.length>1?'s':'')+(kw?' · '+fmtKwc(kw):'')+(mwh?' · '+Math.round(mwh).toLocaleString('fr-FR')+' MWh/an':'');
    board.appendChild(head);
    const wrap=document.createElement('div'); wrap.className='pl-wrap';
    const t=document.createElement('table'); t.className='pl-table';
    const th=document.createElement('tr');
    PL_COLS.forEach(([k,label])=>{ const c=document.createElement('th'); c.scope='col'; const b=document.createElement('button'); b.type='button'; b.textContent=label+(sort.k===k?(sort.dir>0?' ▲':' ▼'):''); b.dataset.k=k;
      b.onclick=()=>{ const n=sort.k===k?{ k, dir:-sort.dir }:{ k, dir:(k==='stage'||k==='kwc'||k==='mwh'||k==='upd')?-1:1 }; try{ localStorage.setItem('pipe-list-sort', JSON.stringify(n)); }catch(e){} renderPipeline(); };
      c.appendChild(b); th.appendChild(c); });
    const thead=document.createElement('thead'); thead.appendChild(th); t.appendChild(thead);
    const tb=document.createElement('tbody');
    rows.forEach(o=>{ const tr=document.createElement('tr'); tr.dataset.id=o.id; if(isExited(o)) tr.className='out';
      const cells=[o.company||'', PL_COLS[1][2](o), oppName(o), null, fmtKwc(o.kwc), o.mwh?Math.round(pqNum(String(o.mwh))||0).toLocaleString('fr-FR'):'', o.mesEff||o.mesPrev||'', o.contrat||'', (o.dept||'').replace(/\s+-\s+.*/,''), o.charge||'', (()=>{ const t0=lastMove(o); return t0>1e12?new Date(t0).toLocaleDateString('fr-FR'):''; })()];
      cells.forEach((v,i)=>{ const td=document.createElement('td'); if(i===3) td.appendChild(stageChip(o)); else td.textContent=v; if(i===0){ td.style.color=clientColor(o.company); if(o.company) td.dataset.peek='co:'+o.company; } if(i===2) td.className='pl-name'; if(i===4||i===5) td.className='pl-num'; tr.appendChild(td); });
      tr.onclick=()=>openOppDetail(o.id); tb.appendChild(tr); });
    t.appendChild(tb); wrap.appendChild(t); board.appendChild(wrap);
    if(!rows.length){ const e=document.createElement('p'); e.className='modal-hint'; e.textContent='Aucune installation'+(q?' pour cette recherche':'')+'.'; board.appendChild(e); }
  }
  // ----- Meeting view: what is coming, one line per installation, to share with the pricing team -----
  const MEET_PHASES=[{ key:'qualif', label:'Qualification · à venir' }, { key:'offre', label:'Offre · pricing en cours' }, { key:'contrat', label:'Contrat · pricing ferme' }];
  function meetHiddenCols(){ try{ const v=JSON.parse(localStorage.getItem('pipe-meet-cols')||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
  const meetVis=()=>{ const h=meetHiddenCols(); return MEET_COLS.map((c,i)=>i<2 || !h.includes(c)); };
  const meetPick=(arr, vis)=>arr.filter((_,i)=>vis[i]);
  // the key figures over the table (screen, mail, Excel): in play, likely, plants, production, stuck
  function meetFigures(groups){
    const list=groups.flatMap(g=>g.list), kw=list.reduce((x,o)=>x+kwcNum(o),0), mwh=list.reduce((x,o)=>x+(pqNum(String(o.mwh||''))||0),0);
    const likely=list.reduce((x,o)=>x+kwcNum(o)*(MES_WEIGHTS[o.stage]||0),0), stuck=list.filter(o=>{ const d=daysInStage(o); return d!=null && d>15; }).length;
    return [[fmtMwc(kw),'en jeu'],[fmtMwc(likely),'probables (pondéré par l\u2019étape)'],[String(list.length),'installation'+(list.length>1?'s':'')],[mwh?(mwh>=1000?(Math.round(mwh/100)/10).toLocaleString('fr-FR')+' GWh':Math.round(mwh).toLocaleString('fr-FR')+' MWh'):'—','par an (P50)'],[String(stuck),'bloquée'+(stuck>1?'s':'')+' > 15 j']];
  }
  function meetPhasesOn(){ try{ const v=JSON.parse(localStorage.getItem('pipe-meet-phases')||'null'); if(Array.isArray(v) && v.length) return v; }catch(e){} return MEET_PHASES.map(p=>p.key); }
  const MEET_COLS=['Producteur','Centrale','Techno','Puissance','P50 (MWh/an)','Dépt','MES','Contrat','Mécanisme','Étape','Prochaine échéance','Chargé','Lot / demande','Depuis'];
  // the block an installation belongs to in the meeting view: same request, same lot, same step
  const meetBlockKey=o=>o.requestId?o.requestId+'|'+(o.lot||'')+'|'+o.stage:'o'+o.id;
  const meetBlockName=o=>{ if(o.lot) return o.lot; const r=o.requestId && opportunities.find(x=>x.id===o.requestId); return r && !r.deleted?(r.label||'Demande de '+requestInstalls(r.id).length+' installations'):''; };
  function meetRow(o){
    const fr=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?pqIsoToFr(v):(v||'');
    const s=oppStage(o.stage), task=o.taskId?tasks.find(t=>t.id===o.taskId && !t.done && t.status!=='termine'):null;
    const next=[o.relance?fr(o.relance):'', task&&task.due?pqIsoToFr(task.due)+' · '+task.title.replace(/\s+—.*$/,''):''].filter(Boolean)[0]||'';
    const mwh=pqNum(String(o.mwh||''));
    return [o.producteur||o.company||'', oppName(o), o.install==='Eolien'?'Éolien':(o.install||''), fmtKwc(o.kwc), mwh?Math.round(mwh).toLocaleString('fr-FR'):'',
      (o.dept||'').replace(/^(\S+)\s+-\s+.*$/,'$1'), o.mesEff?fr(o.mesEff)+' (effective)':fr(o.mesPrev), o.debut&&o.fin?fr(o.debut)+' → '+fr(o.fin):o.fin?'jusqu\u2019au '+fr(o.fin):o.debut?'dès '+fr(o.debut)+(o.duree?', '+o.duree+' ans':''):(o.duree?o.duree+' ans':''),
      o.contrat||'', s?stageLabel(o.stage, o)+(s.who!=='Com'?' ('+(WHO[s.who]||s.who)+')':''):'', next, o.charge||'', meetBlockName(o), (()=>{ const d=daysInStage(o); return d==null?'':d+' j'; })()];
  }
  function meetData(q){
    const on=meetPhasesOn();
    const vp=savedViewState.pipeline && savedViewState.pipeline.pred;
    const live=opportunities.filter(o=>!o.deleted && o.kind==='installation' && !isExited(o))
      .filter(o=>!q || pqFold([o.company,o.producteur,o.centrale,o.title,o.dept].join(' ')).includes(q))
      .filter(o=>!vp || vp(o));
    return MEET_PHASES.filter(p=>on.includes(p.key)).map(p=>{
      const sorted=live.filter(o=>oppPhase(o)===p.key).sort((a,b)=>stageIndex(b.stage)-stageIndex(a.stage) || (pqToDate(a.mesEff||a.mesPrev)||9e15)-(pqToDate(b.mesEff||b.mesPrev)||9e15) || (a.company||'').localeCompare(b.company||'','fr'));
      // the installations of one block (a lot, or a request at one step) stay together, where the first of them stands
      const blocks=new Map(); sorted.forEach(o=>{ const k=meetBlockKey(o); if(!blocks.has(k)) blocks.set(k,[]); blocks.get(k).push(o); });
      const list=[...blocks.values()].flat();
      const kwc=list.reduce((t,o)=>t+(pqNum(String(o.kwc||''))||0),0), mwh=list.reduce((t,o)=>t+(pqNum(String(o.mwh||''))||0),0);
      return { phase:p, list, rows:list.map(meetRow), kwc, mwh };
    });
  }
  const meetTotal=(kwc,mwh,n)=>[n+' installation'+(n>1?'s':''), kwc?fmtKwc(kwc):'', mwh?(mwh>=1000?(Math.round(mwh/100)/10).toLocaleString('fr-FR')+' GWh/an':Math.round(mwh).toLocaleString('fr-FR')+' MWh/an'):''].filter(Boolean).join(' · ');
  function meetTitle(){ return 'Pipe agrégation · ce qui arrive · '+new Date().toLocaleDateString('fr-FR',{ day:'numeric', month:'long', year:'numeric' }); }
  // the same table as HTML with inline styles (pasted into Outlook / Teams, or printed)
  function meetHtml(groups){
    const e=escapeHtml, th='style="text-align:left;padding:5px 8px;border-bottom:2px solid #1A7B8C;font:600 11px Arial;color:#333;white-space:nowrap"', td='style="padding:4px 8px;border-bottom:1px solid #ddd;font:12px Arial;color:#111;vertical-align:top"';
    const vis=meetVis(), cols=meetPick(MEET_COLS, vis);
    const figs='<table style="border-collapse:collapse;margin:0 0 12px"><tr>'+meetFigures(groups).map(([v,l])=>'<td style="padding:6px 14px 6px 0;vertical-align:top"><div style="font:700 16px Arial;color:#111">'+e(v)+'</div><div style="font:11px Arial;color:#666">'+e(l)+'</div></td>').join('')+'</tr></table>';
    let h='<p style="font:600 14px Arial;margin:0 0 8px">'+e(meetTitle())+'</p>'+figs+'<table style="border-collapse:collapse"><thead><tr>'+cols.map(c=>'<th '+th+'>'+e(c)+'</th>').join('')+'</tr></thead><tbody>';
    groups.forEach(g=>{ if(!g.rows.length) return;
      h+='<tr><td colspan="'+cols.length+'" style="padding:10px 8px 4px;font:700 12px Arial;color:#1A7B8C">'+e(g.phase.label)+' — '+e(meetTotal(g.kwc,g.mwh,g.rows.length))+'</td></tr>';
      g.rows.forEach(r=>{ h+='<tr>'+meetPick(r, vis).map((v,i)=>'<td '+td.replace('"padding','"'+(i<2?'font-weight:600;':'')+'padding')+'>'+e(v)+'</td>').join('')+'</tr>'; }); });
    return h+'</tbody></table>';
  }
  async function meetCopy(groups, btn){
    const vis=meetVis(), html=meetHtml(groups), text=[meetTitle(), meetFigures(groups).map(([v,l])=>v+' '+l).join(' · '), '', meetPick(MEET_COLS, vis).join('\t')].concat(...groups.filter(g=>g.rows.length).map(g=>[g.phase.label+' — '+meetTotal(g.kwc,g.mwh,g.rows.length)].concat(g.rows.map(r=>meetPick(r, vis).join('\t'))))).join('\n');
    try{ await navigator.clipboard.write([new ClipboardItem({ 'text/html':new Blob([html],{ type:'text/html' }), 'text/plain':new Blob([text],{ type:'text/plain' }) })]); flashBtn(btn,'✓ Copié'); }
    catch(e){ copyToClipboard(text, btn); }
  }
  function flashBtn(btn, txt){ if(!btn) return; const l=btn.textContent; btn.textContent=txt; setTimeout(()=>{ btn.textContent=l; },1600); }
  async function meetXlsx(groups, btn){
    try{
      await loadXlsxLib();
      const vis=meetVis(), head=MEET_COLS.slice(); head[3]='Puissance (kWc)';
      const aoa=[[meetTitle()],[meetFigures(groups).map(([v,l])=>v+' '+l).join(' · ')],meetPick(head, vis)];
      groups.forEach(g=>{ if(!g.rows.length) return; aoa.push([g.phase.label+' — '+meetTotal(g.kwc,g.mwh,g.rows.length)]); g.list.forEach((o,i)=>{ const r=g.rows[i].slice(); r[3]=pqNum(String(o.kwc||''))||''; r[4]=Math.round(pqNum(String(o.mwh||'')))||''; aoa.push(meetPick(r, vis)); }); aoa.push([]); });
      const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=meetPick([22,24,9,14,12,6,14,24,14,22,26,10,22,8], vis).map(w=>({ wch:w }));
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
  // the meeting view's pictures: key figures, MWc by step, commissioning by quarter, who holds the deals
  const WHO_COLORS={ Com:'var(--accent)', Ops:'#B49CFF', Jur:'#E5B54F', Client:'#7DD3FC', Dir:'#F2A541' };
  function meetVisuals(groups){
    const list=groups.flatMap(g=>g.list), kw=list.reduce((x,o)=>x+kwcNum(o),0), mwh=list.reduce((x,o)=>x+(pqNum(String(o.mwh||''))||0),0);
    const likely=list.reduce((x,o)=>x+kwcNum(o)*(MES_WEIGHTS[o.stage]||0),0), stuck=list.filter(o=>{ const d=daysInStage(o); return d!=null && d>15; }).length;
    const box=document.createElement('div'); box.className='meet-viz';
    const kp=document.createElement('div'); kp.className='meet-kpis';
    [[fmtMwc(kw),'en jeu'],[fmtMwc(likely),'probables (pondéré par l’étape)'],[list.length,'installation'+(list.length>1?'s':'')],[mwh?(mwh>=1000?(Math.round(mwh/100)/10).toLocaleString('fr-FR')+' GWh':Math.round(mwh).toLocaleString('fr-FR')+' MWh'):'—','par an (P50)'],[stuck,'bloquée'+(stuck>1?'s':'')+' > 15 j']]
      .forEach(([v,l],i)=>{ const d=document.createElement('div'); d.className='meet-kpi'+(i===4 && stuck?' warn':''); d.innerHTML='<b></b><span></span>'; d.firstChild.textContent=v; d.lastChild.textContent=l; kp.appendChild(d); });
    box.appendChild(kp);
    const cards=document.createElement('div'); cards.className='meet-cards'; box.appendChild(cards);
    const card=t=>{ const c=document.createElement('section'); c.className='meet-card'; const h=document.createElement('h4'); h.textContent=t; c.appendChild(h); cards.appendChild(c); return c; };
    // MWc by step, coloured by phase; a click goes to that part of the table
    { const c=card('MWc par étape'); const steps=OPP_STAGES.map(st=>{ const l=list.filter(o=>o.stage===st.key); return { st, n:l.length, kw:l.reduce((x,o)=>x+kwcNum(o),0) }; }).filter(x=>x.n);
      const mx=Math.max(1,...steps.map(x=>x.kw));
      steps.forEach(x=>{ const r=document.createElement('button'); r.type='button'; r.className='meet-step'; r.innerHTML='<span class="l"></span><span class="b"><span></span></span><span class="v"></span>';
        r.querySelector('.l').textContent=x.st.label; const bar=r.querySelector('.b span'); bar.style.width=Math.max(3,x.kw/mx*100)+'%'; bar.style.background=(MAP_PHASES.find(p=>p[0]===x.st.phase)||[0,0,'#888'])[2];
        r.querySelector('.v').textContent=(x.kw?fmtMwc(x.kw):'—')+' · '+x.n; r.title=x.n+' installation'+(x.n>1?'s':'')+' à « '+x.st.label+' »';
        r.onclick=()=>{ const tr=document.querySelector('#pipeline-board tr.meet-sec[data-phase="'+x.st.phase+'"]'); if(tr) tr.scrollIntoView({ block:'start', behavior:'smooth' }); };
        c.appendChild(r); }); }
    // commissioning by quarter (the same picture as the dashboard)
    { const c=card('Mises en service à venir'); const f=mesForecast(list);
      if(f.tot){ c.appendChild(f.chart); const p=document.createElement('p'); p.className='meet-hint'; p.textContent='Clair : en jeu · foncé : probable. '+f.text.replace(/ \(MWc, chiffre au-dessus de chaque barre\)/,''); c.appendChild(p); }
      else { const p=document.createElement('p'); p.className='meet-hint'; p.textContent='Pas de date de mise en service dans les deux ans sur ces dossiers.'; c.appendChild(p); } }
    // who holds the deals: one bar split by MWc, then one line each
    { const c=card('Qui a la main'); const by={}; list.forEach(o=>{ const st=oppStage(o.stage); if(!st) return; const w=st.who==='SC'?'Ops':st.who; (by[w]=by[w]||[]).push(o); });
      const order=['Com','Ops','Jur','Client','Dir'].filter(w=>by[w]), tot=Math.max(1, list.reduce((x,o)=>x+Math.max(kwcNum(o),1),0));
      const bar=document.createElement('div'); bar.className='meet-who-bar';
      order.forEach(w=>{ const sg=document.createElement('span'); sg.style.width=(by[w].reduce((x,o)=>x+Math.max(kwcNum(o),1),0)/tot*100)+'%'; sg.style.background=WHO_COLORS[w]; sg.title=WHO[w]; bar.appendChild(sg); });
      c.appendChild(bar);
      order.forEach(w=>{ const l=by[w], ds=l.map(daysInStage).filter(d=>d!=null), avg=ds.length?Math.round(ds.reduce((x,y)=>x+y,0)/ds.length):null, late=ds.filter(d=>d>15).length;
        const r=document.createElement('div'); r.className='meet-who'; r.innerHTML='<span class="who-chip"></span><span class="n"></span><span class="m"></span>';
        const ch=r.querySelector('.who-chip'); ch.classList.add('who-'+w.toLowerCase()); ch.textContent=WHO[w];
        r.querySelector('.n').textContent=l.length+' · '+fmtMwc(l.reduce((x,o)=>x+kwcNum(o),0));
        r.querySelector('.m').textContent=(avg!=null?avg+' j en moyenne':'')+(late?' · '+late+' > 15 j':''); if(late) r.classList.add('late'); c.appendChild(r); }); }
    return box;
  }
  // ---------- « Présenter » : the meeting as a consultant's deck (pyramid principle): the answer on slide 1, then one message
  // per slide that details it — an action title (a sentence with a number), one exhibit, « À retenir », source and page; the deals in appendix ----------
  const loadPptx=()=>loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', ()=>!!window.PptxGenJS, 'PowerPoint');

  const pxHex=c=>{ const m=/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/.exec(c||''); if(!m || (m[4]!=null && +m[4]<0.08)) return null; return [m[1],m[2],m[3]].map(x=>Math.round(+x).toString(16).padStart(2,'0')).join('').toUpperCase(); };
  function slideToPptx(pptx, el){
    const sl=pptx.addSlide(), R=el.getBoundingClientRect(), k=13.333/R.width, pt=px=>Math.max(6, Math.round(px*k*72*10)/10);
    const at=r=>({ x:(r.left-R.left)*k, y:(r.top-R.top)*k, w:Math.max(.02, r.width*k), h:Math.max(.02, r.height*k) });
    const cs0=getComputedStyle(el), grad=/rgba?\([^)]*\)/.exec(cs0.backgroundImage||'');
    sl.background={ color:(cs0.backgroundImage!=='none' && grad && pxHex(grad[0]))||pxHex(cs0.backgroundColor)||'FFFFFF' };
    const runOf=(txt, cs)=>({ text:cs.textTransform==='uppercase'?txt.toUpperCase():txt, options:{ bold:+cs.fontWeight>=600, italic:cs.fontStyle==='italic', color:pxHex(cs.color)||'0F1B2D', fontSize:pt(parseFloat(cs.fontSize)) } });
    const runsOf=node=>{ const out=[]; node.childNodes.forEach(c=>{
        if(c.nodeType===3){ const t=c.textContent.replace(/\s+/g,' '); if(t.trim()) out.push(runOf(t, getComputedStyle(node))); }
        else if(c.nodeType===1){ const cs=getComputedStyle(c); if(cs.display==='none') return; if(cs.display==='inline'){ const t=c.innerText.replace(/\s+/g,' '); if(t.trim()) out.push(runOf(t, cs)); } } });
      if(out.length){ out[0].text=out[0].text.replace(/^\s+/,''); out[out.length-1].text=out[out.length-1].text.replace(/\s+$/,''); }
      return out.filter(r=>r.text); };
    const isBlockText=n=>{ const cs=getComputedStyle(n); return cs.display!=='inline' && cs.display!=='none' && [...n.childNodes].some(c=>(c.nodeType===3 && c.textContent.trim()) || (c.nodeType===1 && getComputedStyle(c).display==='inline' && c.innerText.trim())); };
    el.querySelectorAll('*').forEach(n=>{
      if(n.closest('table') && n.tagName!=='TABLE') return;
      const cs=getComputedStyle(n), r=n.getBoundingClientRect(); if(cs.display==='none' || cs.visibility==='hidden' || r.width<1 || r.height<1) return;
      if(n.tagName==='TABLE'){
        const rows=[...n.rows].map(tr=>[...tr.cells].map(td=>{ const c=getComputedStyle(td), runs=runsOf(td), bg=pxHex(c.backgroundColor)||pxHex(getComputedStyle(tr).backgroundColor);
          const bb=parseFloat(c.borderBottomWidth)>0?{ type:'solid', pt:Math.max(.5, parseFloat(c.borderBottomWidth)*k*72), color:pxHex(c.borderBottomColor)||'DDE3EA' }:{ type:'none' };
          return { text:runs.length?runs:'', options:Object.assign({ align:c.textAlign==='right'?'right':'left', valign:'middle', margin:[0,4,0,4], border:[{ type:'none' },{ type:'none' },bb,{ type:'none' }] }, bg?{ fill:{ color:bg } }:{}, td.colSpan>1?{ colspan:td.colSpan }:{}) }; }));
        const full=[...n.rows].find(tr=>tr.cells.length===Math.max(...[...n.rows].map(x=>x.cells.length)));
        sl.addTable(rows, Object.assign(at(r), { colW:[...full.cells].map(td=>td.getBoundingClientRect().width*k), rowH:[...n.rows].map(tr=>tr.getBoundingClientRect().height*k), fontFace:'Arial', autoPage:false }));
        return; }
      const bg=pxHex(cs.backgroundColor), rad=parseFloat(cs.borderTopLeftRadius)||0;
      if(bg) sl.addShape(rad>=Math.min(r.width,r.height)/2-1 && Math.abs(r.width-r.height)<2?'ellipse':'rect', Object.assign(at(r), { fill:{ color:bg }, line:{ type:'none' } }));
      [['Top',0],['Bottom',0],['Left',1],['Right',1]].forEach(([sd,vert])=>{ const w=parseFloat(cs['border'+sd+'Width']), col=pxHex(cs['border'+sd+'Color']); if(!(w>=.5) || !col || cs['border'+sd+'Style']==='none') return;
        const b={ left:r.left, top:r.top, width:vert?w:r.width, height:vert?r.height:w }; if(sd==='Bottom') b.top=r.bottom-w; if(sd==='Right') b.left=r.right-w;
        sl.addShape('rect', Object.assign(at(b), { fill:{ color:col }, line:{ type:'none' } })); });
      if(n.matches('.ps-exec-r li')){ const d=r.height>0?Math.min(r.height*.6, R.width*.028):0, cb=getComputedStyle(n,'::before');   // the numbered circles are drawn by CSS
        const box={ left:r.left, top:r.top+(r.height-d)/2, width:d, height:d }; sl.addShape('ellipse', Object.assign(at(box), { fill:{ color:pxHex(cb.backgroundColor)||'0F1B2D' }, line:{ type:'none' } }));
        sl.addText(String([...n.parentNode.children].indexOf(n)+1), Object.assign(at(box), { align:'center', valign:'middle', margin:0, bold:true, color:'FFFFFF', fontSize:pt(parseFloat(cb.fontSize)||14), fontFace:'Arial' })); }
      if(isBlockText(n)){ const runs=runsOf(n); if(!runs.length) return;
        // where the text itself sits (a label above it, drawn by a block child, keeps its own place)
        const own=[...n.childNodes].filter(c=>(c.nodeType===3 && c.textContent.trim()) || (c.nodeType===1 && getComputedStyle(c).display==='inline' && c.innerText.trim()));
        const rg=document.createRange(); rg.setStartBefore(own[0]); rg.setEndAfter(own[own.length-1]); const tr=rg.getBoundingClientRect();
        const pl=parseFloat(cs.paddingLeft)+parseFloat(cs.borderLeftWidth||0), pr=parseFloat(cs.paddingRight)+parseFloat(cs.borderRightWidth||0);
        const one=tr.height<parseFloat(cs.fontSize)*1.9, align=cs.textAlign==='right' || cs.textAlign==='end'?'right':cs.textAlign==='center'?'center':'left';
        let left=r.left+pl, width=Math.max(4, r.width-pl-pr);
        if(/grid|flex/.test(cs.display)){ left=tr.left; width=Math.max(4, Math.min(tr.width, r.right-pr-tr.left)); }   // a loose text inside a grid or flex row has its own cell
        if(cs.textOverflow==='ellipsis' && n.scrollWidth>n.clientWidth+1 && runs.length===1){ const keep=Math.max(1, Math.floor(runs[0].text.length*n.clientWidth/n.scrollWidth)-1); runs[0].text=runs[0].text.slice(0,keep).trimEnd()+'…'; }
        if(one){ const extra=width*.06+6; width+=extra; if(align==='right') left-=extra; else if(align==='center') left-=extra/2; }   // PowerPoint's fonts run a little wider: one line stays one line
        sl.addText(runs, Object.assign(at({ left, top:tr.top, width, height:Math.max(4, tr.height) }), { margin:0, valign:'top', align, fontFace:'Arial', wrap:!one, lineSpacingMultiple:.95 })); }
    });
  }
  function meetPresent(groups){
    const list=groups.flatMap(g=>g.list); if(!list.length) return;
    const e=escapeHtml, date=new Date().toLocaleDateString('fr-FR',{ day:'numeric', month:'long', year:'numeric' });
    const mw=k=>fmtMwc(k), kwOf=l=>l.reduce((x,o)=>x+kwcNum(o),0), daysOf=o=>daysInStage(o), pct=(a,b)=>Math.round(a/Math.max(1,b)*100);
    const plural=(n,w)=>n+' '+w+(n>1?'s':'');
    const kw=kwOf(list), likely=list.reduce((x,o)=>x+kwcNum(o)*(MES_WEIGHTS[o.stage]||0),0), mwh=list.reduce((x,o)=>x+(pqNum(String(o.mwh||''))||0),0);
    const stuck=list.filter(o=>{ const d=daysOf(o); return d!=null && d>15; }).sort((a,b)=>daysOf(b)-daysOf(a));
    // the blocks (a lot, a request at one step, a plant alone), the unit people talk about in the meeting
    const blocks=[]; { const m=new Map(); groups.forEach(g=>g.list.forEach(o=>{ const k=meetBlockKey(o); if(!m.has(k)){ m.set(k,{ g, list:[] }); blocks.push(m.get(k)); } m.get(k).list.push(o); })); }
    const bInfo=bk=>{ const o=bk.list[0], st=oppStage(o.stage), d=daysOf(o), name=meetBlockName(o);
      const ids=new Set(bk.list.map(x=>x.id).concat(o.requestId?[o.requestId]:[])), tk=activeTasks().filter(t=>t.opportunityId && ids.has(t.opportunityId)).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'))[0];
      return { o, st, d, kw:kwOf(bk.list), n:bk.list.length, label:(o.company||'')+(bk.list.length>1 && name?' — '+name:bk.list.length===1?' — '+oppName(o):''),
        who:st?(st.who==='Com'?'Commercial':WHO[st.who]||st.who):'', next:(tk && plainLinks(tk.title||'').replace(/\s+—\s+.*$/,'').trim())||(st?stageTaskOf(st, o):'') }; };
    // the facts every slide is built from
    const steps=OPP_STAGES.map(st=>{ const l=list.filter(o=>o.stage===st.key); return { st, n:l.length, kw:kwOf(l) }; }).filter(x=>x.n);
    const bySize=steps.slice().sort((a,b)=>b.kw-a.kw), big=bySize[0], big2=bySize[1];
    const phases=groups.filter(g=>g.list.length).map(g=>({ g, kw:kwOf(g.list), color:(MAP_PHASES.find(p=>p[0]===g.phase.key)||[0,0,'#7DA2CF'])[2], short:g.phase.label.split(' · ')[0] }));
    const who={}; list.forEach(o=>{ const st=oppStage(o.stage); if(!st) return; const w=st.who==='SC'?'Ops':st.who; (who[w]=who[w]||[]).push(o); });
    const whoOrder=['Com','Ops','Jur','Client','Dir'].filter(w=>who[w]), whoLead=whoOrder.slice().sort((a,b)=>who[b].length-who[a].length)[0];
    const whoName=w=>w==='Com'?'Le commercial':w==='Ops'?'Ops':w==='Jur'?'Le Juridique':w==='Client'?'Les producteurs':'La Direction';
    const lateOf=l=>l.filter(o=>{ const d=daysOf(o); return d!=null && d>15; }).length, avgOf=l=>{ const ds=l.map(daysOf).filter(d=>d!=null); return ds.length?Math.round(ds.reduce((x,y)=>x+y,0)/ds.length):null; };
    const fc=mesForecast(list), fcPeak=(()=>{ const cols=[...fc.chart.querySelectorAll('.pd-mes-col')].map(c=>({ q:c.querySelector('.q').textContent, v:c.querySelector('.v').textContent })).filter(c=>c.v); return cols.sort((a,b)=>pqNum(b.v)-pqNum(a.v))[0]; })();
    // the deck's sections (the tracker at the top of each slide) and the slides
    const SECTIONS=['Synthèse','Étapes','Dossiers','Mises en service','Qui a la main','Attention'];
    const slides=[]; const add=o=>{ slides.push(o); return slides.length; };
    const takeaway=t=>'<aside class="ps-take"><span class="ps-k">À retenir</span>'+e(t)+'</aside>';
    // 1. the answer: every key figure and the four messages, each pointing to the slide that details it
    const S1=add({ sec:'Synthèse' });
    const pStep=add({ sec:'Étapes', title:'« '+big.st.label+' » concentre '+mw(big.kw)+', soit '+pct(big.kw,kw)+' % du volume en jeu',
      body:'<div class="ps-bars ps-fill">'+steps.map(x=>'<div class="ps-bar"><span class="l">'+e(x.st.label)+'</span><span class="b"><i style="width:'+Math.max(2,x.kw/bySize[0].kw*100)+'%;background:'+(MAP_PHASES.find(p=>p[0]===x.st.phase)||[0,0,'#7DA2CF'])[2]+'"></i></span><span class="v">'+e(mw(x.kw))+'</span><span class="n">'+plural(x.n,'install.').replace('install.s','install.')+'</span></div>').join('')+'</div>'
        +takeaway(big2?'Après « '+big.st.label+' », c’est « '+big2.st.label+' » qui pèse le plus ('+mw(big2.kw)+').':'Tout le volume est à cette étape.') });
    // dossiers: one table for every phase (a line per phase inside), cut into balanced pages so none is half empty
    let pDeals=null;
    { const rowsAll=[]; phases.forEach(ph=>blocks.filter(b=>b.g===ph.g).map(bInfo).sort((a,b)=>b.kw-a.kw).forEach(r=>rowsAll.push(Object.assign(r, { ph }))));
      const pages=Math.max(1, Math.ceil((rowsAll.length+phases.length)/11)), per=Math.ceil(rowsAll.length/pages), lead=phases.slice().sort((a,b)=>b.kw-a.kw)[0];
      for(let pg=0; pg<pages; pg++){ const part=rowsAll.slice(pg*per, (pg+1)*per); if(!part.length) break; const late=part.filter(r=>r.d!=null && r.d>15);
        let body='', last=null;
        part.forEach(r=>{ if(r.ph!==last){ const nPh=rowsAll.filter(x=>x.ph===r.ph).length; body+='<tr class="ps-ph"><td colspan="6"><i style="background:'+r.ph.color+'"></i>'+e(r.ph.short)+'<span>'+plural(nPh,'dossier')+' · '+e(mw(r.ph.kw))+(last===null && pg && rowsAll[pg*per-1].ph===r.ph?' · suite':'')+'</span></td></tr>'; last=r.ph; }
          body+='<tr><td><b>'+e(r.label)+'</b>'+(r.n>1?'<small> · '+r.n+' install.</small>':'')+'</td><td class="n">'+e(r.kw?mw(r.kw):'—')+'</td><td>'+e(r.st?stageLabel(r.o.stage, r.o):'')+'</td><td>'+e(r.who)+'</td><td class="n'+(r.d!=null && r.d>15?' warn':'')+'">'+(r.d!=null?r.d+' j':'—')+'</td><td>'+e(r.next)+'</td></tr>'; });
        const n=add({ sec:'Dossiers', title:plural(blocks.length,'dossier')+' en cours, '+mw(kw)+' : '+lead.short+' en porte '+pct(lead.kw,kw)+' %'+(pages>1?' ('+(pg+1)+'/'+pages+')':''),
          body:'<div class="ps-fill"><table class="ps-table ps-table-fill"><thead><tr><th>Dossier</th><th class="n">Puissance</th><th>Étape</th><th>Chez</th><th class="n">Depuis</th><th>Prochaine action</th></tr></thead><tbody>'+body+'</tbody></table></div>'
            +takeaway(late.length?plural(late.length,'dossier')+(pages>1?' de cette page':'')+' attend'+(late.length>1?'ent':'')+' depuis plus de 15 jours : '+[...new Set(late.map(r=>r.label.split(' — ')[0]))].slice(0,3).join(', ')+'.':'Aucun de ces dossiers n’attend depuis plus de 15 jours.') });
        if(!pDeals) pDeals=n; } }
    const pMes=fc.tot?add({ sec:'Mises en service', title:mw(fc.tot)+' probables à mettre en service d’ici deux ans'+(fcPeak?', surtout au '+fcPeak.q.replace(/(\d\d)$/,'20$1'):''),
      body:'<div class="ps-chart ps-fill">'+fc.chart.outerHTML+'</div><p class="ps-note">Barre claire : en jeu · foncée : probable, pondéré par l’étape (pricing 25 %, offre en attente 40 %, KYC 60 %, signature 90 %, signé 100 %). Chiffre : MWc probables.</p>'
        +takeaway('Sur '+mw(fc.all)+' en jeu, '+mw(fc.tot)+' sont probables : c’est le volume sur lequel on peut compter.') }):null;
    const pWho=add({ sec:'Qui a la main', title:whoName(whoLead)+' a la main sur '+plural(who[whoLead].length,'dossier')+' ('+mw(kwOf(who[whoLead]))+')',
      body:'<div class="ps-who ps-fill">'+whoOrder.map(w=>{ const l=who[w], avg=avgOf(l), late=lateOf(l);
        const top=[...new Map(l.slice().sort((a,b)=>(daysOf(b)||0)-(daysOf(a)||0)).map(o=>[meetBlockKey(o), o])).values()], max=5;
        return '<div class="ps-who-c"><span class="ps-chip" style="--c:'+WHO_COLORS[w]+'">'+e(w==='Com'?'Commercial':WHO[w])+'</span><b>'+l.length+'</b><span>'+e(mw(kwOf(l)))+'</span><em'+(late?' class="warn"':'')+'>'+(avg!=null?avg+' j en moyenne':'')+(late?' · '+late+' > 15 j':'')+'</em>'
          +'<ul class="ps-who-l">'+top.slice(0,max).map(o=>{ const d=daysOf(o); return '<li><span>'+e(o.company||oppName(o))+'</span><i'+(d!=null && d>15?' class="warn"':'')+'>'+(d!=null?d+' j':'')+'</i></li>'; }).join('')+(top.length>max?'<li class="more">+ '+(top.length-max)+' autres</li>':'')+'</ul></div>'; }).join('')+'</div>'
        +takeaway(who.Ops?'Ops porte '+plural(who.Ops.length,'dossier')+(lateOf(who.Ops)?', dont '+lateOf(who.Ops)+' depuis plus de 15 jours : à relancer.':' ; rien de bloqué de son côté.'):'Aucun dossier n’attend Ops.') });
    const pAtt=add({ sec:'Attention', title:stuck.length?plural(stuck.length,'dossier')+' à débloquer, le plus ancien depuis '+daysOf(stuck[0])+' jours':'Aucun dossier bloqué depuis plus de 15 jours',
      body:stuck.length?'<div class="ps-cards ps-fill" style="--cols:'+Math.min(4, stuck.slice(0,8).length)+'">'+stuck.slice(0,8).map(o=>{ const st=oppStage(o.stage), r=bInfo({ list:[o] }), nt=(o.notesLog||[]).filter(x=>x && x.text).sort((x,y)=>y.at-x.at)[0];
          return '<div class="ps-card"><span class="ps-k">'+e(stageLabel(o.stage, o))+' · '+e(st?(st.who==='Com'?'Commercial':WHO[st.who]||st.who):'')+'</span><b class="ps-card-t">'+e(o.company||'')+'</b><span class="ps-card-s">'+e(oppName(o))+(kwcNum(o)?' · '+e(mw(kwcNum(o))):'')+'</span>'
            +'<strong class="warn">'+daysOf(o)+' j</strong><span class="ps-card-s">sans bouger</span><p><span class="ps-k">Prochaine action</span>'+e(r.next||'—')+'</p>'+(nt?'<p class="ps-card-n"><span class="ps-k">Dernier échange · '+e(new Date(nt.at).toLocaleDateString('fr-FR'))+'</span>'+e(nt.text.length>110?nt.text.slice(0,110)+'…':nt.text)+'</p>':'')+'</div>'; }).join('')+'</div>'
        +takeaway('Décider en séance qui relance qui, et pour quand.'):takeaway('Rien n’est à la même étape depuis plus de 15 jours.') });
    // the answer, written now that every page number is known
    const msgs=[
      { b:'« '+big.st.label+' » concentre '+mw(big.kw)+' ('+pct(big.kw,kw)+' %)', s:plural(big.n,'installation')+(big2?' ; ensuite « '+big2.st.label+' » ('+mw(big2.kw)+')':''), p:pStep },
      { b:whoName(whoLead)+' a la main sur '+plural(who[whoLead].length,'dossier'), s:whoOrder.filter(w=>w!==whoLead).map(w=>(w==='Com'?'commercial':WHO[w])+' '+who[w].length).join(' · '), p:pWho },
      fc.tot?{ b:mw(fc.tot)+' probables à mettre en service d’ici deux ans', s:fcPeak?'Le plus au '+fcPeak.q.replace(/(\d\d)$/,'20$1')+' ('+fcPeak.v+' MWc)':'', p:pMes }:null,
      { b:stuck.length?plural(stuck.length,'dossier')+' bloqué'+(stuck.length>1?'s':'')+' depuis plus de 15 jours':'Aucun dossier bloqué', s:[...new Map(stuck.map(o=>[o.company||'', daysOf(o)])).entries()].slice(0,3).map(([c,d])=>c+' ('+d+' j)').join(' · '), p:pAtt, warn:!!stuck.length }
    ].filter(Boolean);
    slides[S1-1]={ sec:'Synthèse', exec:true, title:mw(likely)+' probables sur '+mw(kw)+' en jeu'+(stuck.length?' ; '+plural(stuck.length,'dossier')+' à débloquer':''),
      body:'<div class="ps-exec"><div class="ps-exec-l">'
        +[[mw(kw),'en jeu'],[mw(likely),'probables'],[String(list.length),'installations · '+plural(blocks.length,'dossier')],[mwh?(mwh>=1000?(Math.round(mwh/100)/10).toLocaleString('fr-FR')+' GWh':Math.round(mwh).toLocaleString('fr-FR')+' MWh'):'—','par an (P50)']].map(([v,l])=>'<div class="ps-ex-k"><b>'+e(v)+'</b><span>'+e(l)+'</span></div>').join('')
        +'<div class="ps-split"><div class="ps-split-bar">'+phases.map(p=>'<i style="flex:'+Math.max(p.kw,1)+';background:'+p.color+'"></i>').join('')+'</div><div class="ps-split-l">'+phases.map(p=>'<span><i style="background:'+p.color+'"></i>'+e(p.short)+' '+e(mw(p.kw))+'</span>').join('')+'</div></div>'
        +'</div><ol class="ps-exec-r">'+msgs.map(m=>'<li'+(m.warn?' class="warn"':'')+'><b>'+e(m.b)+'</b>'+(m.s?'<span>'+e(m.s)+'</span>':'')+'<em>p. '+m.p+'</em></li>').join('')+'</ol></div>' };
    // appendix: one page per deal; under the figures, the plants (or the plant's sheet) and what happened lately
    const dealMore=l=>{
      let left;
      if(l.length>1) left='<div><span class="ps-k">Centrales</span><table class="ps-table ps-mini"><tbody>'+l.slice(0,6).map(x=>'<tr><td><b>'+e(oppName(x))+'</b></td><td class="n">'+e(x.kwc?fmtKwc(x.kwc):'—')+'</td><td class="n">'+e(x.mwh?Math.round(pqNum(String(x.mwh))||0).toLocaleString('fr-FR')+' MWh':'—')+'</td><td>'+e(x.commune||'')+'</td><td>'+e(x.mesEff||x.mesPrev||'')+'</td></tr>').join('')+(l.length>6?'<tr><td colspan="5">+ '+(l.length-6)+' autres</td></tr>':'')+'</tbody></table></div>';
      else { const o=l[0], keys=['Commune','Département','Nature Projet',"Type d'injection",'Puissance raccordement (kVA)','Stockage','P90 annuel (indicatif) (MWh/an)','Productible (P50) (kWh/kWc/an)','Nom SPV','Système de gestion des heures négatives','Première injection'];
        const kv=keys.map(k=>[k.replace(/ \(.*$/,''), caractValue(o,k)]).filter(x=>x[1]!=='' && x[1]!=null).slice(0,10);
        left='<div><span class="ps-k">Caractéristiques</span>'+(kv.length?'<dl class="ps-kv">'+kv.map(([k,v])=>'<dt>'+e(k)+'</dt><dd>'+e(String(v))+'</dd>').join('')+'</dl>':'<p class="ps-empty">Fiche Caractéristiques pas encore remplie.</p>')+'</div>'; }
      const h=buildHistory(l), ev=h?[...h.querySelectorAll('li')].slice(0,6).map(li=>[li.firstChild.textContent, li.lastChild.textContent]):[];
      const right='<div><span class="ps-k">Historique récent</span>'+(ev.length?'<ul class="ps-hist">'+ev.map(([d,t])=>'<li><span>'+e(d)+'</span>'+e(t.length>90?t.slice(0,90)+'…':t)+'</li>').join('')+'</ul>':'<p class="ps-empty">Rien de noté pour l’instant.</p>')+'</div>';
      return '<div class="ps-deal-more">'+left+right+'</div>'; };
    add({ divider:true, title:'Annexe', sub:'Une fiche par dossier, dans l’ordre des tableaux' });
    blocks.slice().sort((a,b)=>MEET_PHASES.findIndex(p=>p.key===b.g.phase.key)-MEET_PHASES.findIndex(p=>p.key===a.g.phase.key) || kwOf(b.list)-kwOf(a.list)).forEach(bk=>{
      const r=bInfo(bk), o=r.o, mwhB=bk.list.reduce((x,y)=>x+(pqNum(String(y.mwh||''))||0),0), mes=o.mesEff||o.mesPrev||'';
      const lastNote=bk.list.flatMap(x=>x.notesLog||[]).filter(n=>n && n.text).sort((a,b)=>b.at-a.at)[0];
      const ph=PIPE_PHASES.filter(p=>p.key!=='prequal'), cur=ph.findIndex(p=>p.key===(r.st&&r.st.phase));
      add({ sec:'Annexe', title:r.label+' · '+(r.st?stageLabel(o.stage, o):'')+(r.d!=null?' depuis '+r.d+' jour'+(r.d>1?'s':''):''),
        body:'<div class="ps-deal"><div class="ps-deal-figs"><div><b>'+e(r.kw?mw(r.kw):'—')+'</b><span>'+plural(r.n,'installation')+'</span></div><div><b>'+e(mwhB?Math.round(mwhB).toLocaleString('fr-FR')+' MWh':'—')+'</b><span>par an (P50)</span></div><div><b>'+e(mes||'—')+'</b><span>mise en service</span></div></div>'
          +'<div class="ps-track">'+ph.map((p,i)=>'<div class="'+(i<cur?'done':i===cur?'on':'')+'"><i></i><span>'+e(p.label)+'</span></div>').join('')+'</div>'
          +'<div class="ps-deal-next"><div><span class="ps-k">Prochaine action</span><b>'+e(r.next||'—')+'</b></div><div><span class="ps-k">Chez</span><b'+(r.d!=null && r.d>15?' class="warn"':'')+'>'+e(r.who)+(r.d!=null?' · '+r.d+' j':'')+'</b></div>'+(o.contrat?'<div><span class="ps-k">Contrat</span><b>'+e(o.contrat+(o.duree?' · '+o.duree+' ans':''))+'</b></div>':'')+'</div>'
          +(lastNote?'<p class="ps-context"><span class="ps-k">Dernier échange · '+e(new Date(lastNote.at).toLocaleDateString('fr-FR'))+'</span>'+e(lastNote.text.length>180?lastNote.text.slice(0,180)+'…':lastNote.text)+'</p>':'')
          +dealMore(bk.list)+'</div>' });
    });
    // the deck
    let ov=$('present-overlay'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='present-overlay'; ov.className='ps-overlay'; ov.tabIndex=-1; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Présentation de la réunion');
    ov.innerHTML='<div class="ps-stage"><div class="ps-slide"></div></div><div class="ps-bar-ui"><button type="button" class="ps-prev" aria-label="Slide précédente">‹</button><span class="ps-count"></span><button type="button" class="ps-next" aria-label="Slide suivante">›</button><button type="button" class="ps-full" title="Plein écran (F)">Plein écran</button><button type="button" class="ps-pptx" title="Télécharger en PowerPoint (.pptx) pour retoucher les slides à la main">PowerPoint</button><button type="button" class="ps-close" title="Fermer (Échap)">Fermer</button></div>';
    document.body.appendChild(ov);
    let i=0; const box=ov.querySelector('.ps-slide');
    const tracker=sec=>'<nav class="ps-tracker">'+SECTIONS.map(x=>'<span'+(x===sec?' class="on"':'')+'>'+e(x)+'</span>').join('')+'</nav>';
    const paint=(box, n)=>{ const sl=slides[n];
      box.className='ps-slide'+(sl.divider?' ps-divider':'')+(sl.exec?' ps-execs':'');
      box.innerHTML=sl.divider?'<div class="ps-div-in"><div class="ps-cover-k">Réunion pricing · '+e(date)+'</div><h1>'+e(sl.title)+'</h1><p>'+e(sl.sub)+'</p></div>'
        :'<header>'+(sl.sec!=='Annexe'?tracker(sl.sec):'<nav class="ps-tracker"><span class="on">Annexe · fiche dossier</span></nav>')+(sl.exec?'<div class="ps-kicker">Réunion pricing · '+e(date)+'</div>':'')+'<h2>'+e(sl.title)+'</h2></header><div class="ps-body">'+sl.body+'</div>'
          +'<footer><span>Source : Pipe agrégation (appli ToDo), au '+e(date)+'</span><span>'+(n+1)+'</span></footer>';
      box.querySelectorAll('.ps-fill > .ps-table-fill').forEach(t=>{ t.style.height='auto'; t.style.fontSize=''; const room=t.parentNode.clientHeight;
        for(let f=1.45; t.offsetHeight>room && f>1.2; f-=0.06){ t.style.fontSize=f.toFixed(2)+'cqw'; t.querySelectorAll('td').forEach(td=>{ td.style.paddingTop=td.style.paddingBottom=(f*0.32).toFixed(2)+'cqw'; }); }   // too many lines: smaller, never cut
        const nat=t.offsetHeight; if(room>nat) t.style.height=Math.min(room, nat*2.2)+'px'; }); };
    const show=n=>{ i=Math.max(0, Math.min(slides.length-1, n)); paint(box, i); ov.querySelector('.ps-count').textContent=(i+1)+' / '+slides.length; };
    // « PowerPoint » : the same slides as a .pptx, every text and table editable
    ov.querySelector('.ps-pptx').onclick=async ev=>{ ev.stopPropagation(); const b=ev.currentTarget, was=b.textContent; b.disabled=true; b.textContent='Préparation…';
      try{ await loadPptx(); const host=document.createElement('div'); host.className='ps-export-host'; const sb=document.createElement('div'); host.appendChild(sb); document.body.appendChild(host);
        const pptx=new window.PptxGenJS(); pptx.layout='LAYOUT_WIDE'; pptx.title='Réunion pricing · '+date;
        try{ slides.forEach((x,n)=>{ paint(sb, n); slideToPptx(pptx, sb); }); } finally { host.remove(); }
        await pptx.writeFile({ fileName:'Reunion pricing '+toISO(new Date())+'.pptx' }); b.textContent='Téléchargé ✓'; }
      catch(err){ console.error(err); b.textContent='Échec (hors ligne ?)'; }
      ov.focus();   // the button is disabled a moment: the arrows and Échap keep working
      setTimeout(()=>{ b.textContent=was; b.disabled=false; }, 2500); };
    const onResize=()=>{ if(document.body.contains(ov)) show(i); }; window.addEventListener('resize', onResize);   // full screen: the tables are spread again
    const close=()=>{ if(document.fullscreenElement) try{ document.exitFullscreen(); }catch(e2){} window.removeEventListener('resize', onResize); ov.remove(); };
    ov.querySelector('.ps-prev').onclick=()=>show(i-1); ov.querySelector('.ps-next').onclick=()=>show(i+1); ov.querySelector('.ps-close').onclick=close;
    ov.querySelector('.ps-full').onclick=()=>{ try{ document.fullscreenElement?document.exitFullscreen():ov.requestFullscreen(); }catch(e2){} };
    ov.querySelector('.ps-stage').addEventListener('click', ev=>{ const pg=ev.target.closest('.ps-exec-r li'); if(pg){ const m=/p\. (\d+)/.exec(pg.textContent); if(m){ show(+m[1]-1); return; } }
      const r=ov.getBoundingClientRect(); show(ev.clientX>r.left+r.width/3?i+1:i-1); });
    ov.addEventListener('keydown', ev=>{ const k=ev.key; ev.stopPropagation();   // the app's own shortcuts (n, p, Ctrl K…) stay quiet while presenting
      if(['ArrowRight','ArrowDown','PageDown',' ','Enter'].includes(k)){ ev.preventDefault(); show(i+1); }
      else if(['ArrowLeft','ArrowUp','PageUp','Backspace'].includes(k)){ ev.preventDefault(); show(i-1); }
      else if(k==='Home'){ ev.preventDefault(); show(0); } else if(k==='End'){ ev.preventDefault(); show(slides.length-1); }
      else if(k==='f' || k==='F'){ ev.preventDefault(); ov.querySelector('.ps-full').click(); }
      else if(k==='Escape'){ ev.preventDefault(); if(!document.fullscreenElement) close(); } });
    show(0); ov.focus();
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
    const pres=mk('Présenter', ()=>meetPresent(groups), 'La réunion en slides, plein écran ; flèches du clavier pour avancer');
    pres.classList.add('meet-present-btn');
    const colBtn=mk('Colonnes ▾', ()=>{ meetColsOpen=!meetColsOpen; renderPipeline(); }, 'Choisir les colonnes du tableau (aussi pour la copie, l\u2019Excel et l\u2019impression)');
    colBtn.classList.add('meet-cols-btn'); colBtn.setAttribute('aria-expanded', String(meetColsOpen));
    board.appendChild(head);
    if(meetColsOpen){ const cc=document.createElement('div'); cc.className='meet-chips meet-cols'; const hid=meetHiddenCols();
      cc.innerHTML='<span class="meet-cols-l">Colonnes :</span>';
      MEET_COLS.slice(2).forEach(c=>{ const b=document.createElement('button'); b.type='button'; b.className='meet-chip'+(hid.includes(c)?'':' on'); b.textContent=c; b.dataset.col=c; b.setAttribute('aria-pressed', String(!hid.includes(c)));
        b.onclick=()=>{ let v=meetHiddenCols(); v=v.includes(c)?v.filter(x=>x!==c):v.concat(c); try{ localStorage.setItem('pipe-meet-cols', JSON.stringify(v)); }catch(e){} prefsToNote(); renderPipeline(); }; cc.appendChild(b); });
      board.appendChild(cc); }
    // which phases to show (remembered on this device)
    const chips=document.createElement('div'); chips.className='meet-chips'; const on=meetPhasesOn();
    MEET_PHASES.forEach(p=>{ const c=document.createElement('button'); c.type='button'; c.className='meet-chip'+(on.includes(p.key)?' on':''); c.textContent=p.label; c.dataset.phase=p.key; c.setAttribute('aria-pressed', String(on.includes(p.key)));
      c.onclick=()=>{ let v=meetPhasesOn(); v=v.includes(p.key)?v.filter(k=>k!==p.key):v.concat(p.key); if(!v.length) return; try{ localStorage.setItem('pipe-meet-phases', JSON.stringify(MEET_PHASES.map(x=>x.key).filter(k=>v.includes(k)))); }catch(e){} prefsToNote(); renderPipeline(); };
      chips.appendChild(c); });
    board.appendChild(chips);
    if(!n){ const e=document.createElement('div'); e.className='today-empty'; e.textContent='Aucune installation dans ces phases.'; board.appendChild(e); return; }
    board.appendChild(meetVisuals(groups));
    const wrap=document.createElement('div'); wrap.className='meet-scroll';
    const vis=meetVis(), ncol=vis.filter(Boolean).length;
    let t='<table class="meet-table"><thead><tr>'+meetPick(MEET_COLS, vis).map(c=>'<th>'+escapeHtml(c)+'</th>').join('')+'</tr></thead><tbody>';
    groups.forEach(g=>{ if(!g.rows.length) return;
      t+='<tr class="meet-sec" data-phase="'+g.phase.key+'"><th colspan="'+ncol+'"><i style="background:'+(MAP_PHASES.find(x=>x[0]===g.phase.key)||[0,0,'#888'])[2]+'"></i>'+escapeHtml(g.phase.label)+'<span>'+escapeHtml(meetTotal(g.kwc,g.mwh,g.rows.length))+'</span></th></tr>';
      let lastKey=null;
      g.rows.forEach((r,i)=>{ const o=g.list[i], k=meetBlockKey(o), mates=g.list.filter(x=>meetBlockKey(x)===k);
        if(mates.length>1 && k!==lastKey){   // a lot, or a request at one step: one title line, the installations under it
          const st=oppStage(o.stage), d=daysInStage(o), kw=mates.reduce((x,y)=>x+kwcNum(y),0);
          t+='<tr class="meet-blk" data-blk="'+escapeHtml(k)+'" data-req="'+escapeHtml(o.requestId)+'" data-ids="'+escapeHtml(mates.map(x=>x.id).join(','))+'"><td colspan="'+ncol+'"><b>'+escapeHtml(o.company||'')+'</b>'
            +(meetBlockName(o)?' <span class="meet-blk-name">'+escapeHtml(meetBlockName(o))+'</span>':'')
            +' <span class="meet-blk-sum">'+escapeHtml([mates.length+' installations', kw?fmtKwc(kw):'', stageLabel(o.stage, o), st?WHO[st.who]||st.who:'', d!=null?'depuis '+d+' j':''].filter(Boolean).join(' · '))+'</span></td></tr>'; }
        lastKey=k;
        t+='<tr data-id="'+escapeHtml(o.id)+'"'+(mates.length>1?' class="meet-inblk"':'')+'>'+meetPick(r, vis).map((v,j)=>'<td'+(j===1?' class="meet-name"':'')+'>'+escapeHtml(v)+'</td>').join('')+'</tr>'; }); });
    wrap.innerHTML=t+'</tbody></table>';
    wrap.querySelectorAll('tr[data-id]').forEach(tr=>{ tr.onclick=()=>openOppDetail(tr.dataset.id); });
    wrap.querySelectorAll('tr.meet-blk').forEach(tr=>{ tr.onclick=()=>openRequestDetail(tr.dataset.req, tr.dataset.ids.split(',')); });
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
  function renderPipeline(){ renderPipelineInner(); if(typeof paintPicks==='function') paintPicks(); paintXsCount(); paintPipeSummary(); }
  // « À moi · En attente des autres · Bloqués » over the board, counted per block
  let pipeTallyN={ me:0, others:0, stuck:0, on:false };
  function pipeTallyReset(){ pipeTallyN={ me:0, others:0, stuck:0, on:true }; }
  function pipeTally(g){ const o=g[0]; if(o.kind!=='installation' || isExited(o)) return; const st=oppStage(o.stage); if(!st) return;
    if(st.who==='Com') pipeTallyN.me++; else pipeTallyN.others++; const d=daysInStage(o); if(d!=null && d>15) pipeTallyN.stuck++; }
  function paintPipeSummary(){ try{ paintDupBtn(); paintDupBanner(); }catch(e){ softFail('bandeau doublons', e); } let el=$('pipe-summary'); const bar=document.querySelector('#tab-pipeline .quick-add-bar'); if(!bar) return;
    if(!el){ el=document.createElement('span'); el.id='pipe-summary'; el.className='pipe-summary'; const ref=$('pipe-exited-toggle'); bar.insertBefore(el, ref); }
    const show=pipeTallyN.on && !pipeDash && !pipeMeet && !pipeList && !pipeMap; el.hidden=!show; if(!show) return;
    el.innerHTML='À moi <b></b> · En attente des autres <b></b>'+(pipeTallyN.stuck?' · Bloqués &gt; 15 j <b class="late"></b>':'');
    const bs=el.querySelectorAll('b'); bs[0].textContent=pipeTallyN.me; bs[1].textContent=pipeTallyN.others; if(bs[2]) bs[2].textContent=pipeTallyN.stuck; }
  // the card's « what's next »: the linked open task, else what the step asks; who has it and since when; its request
  function cardStepInfo(card, group, reqId){
    const o=group[0], st=oppStage(o.stage); if(!st || isExited(o)) return;
    const ids=new Set(group.map(x=>x.id).concat(reqId?[reqId]:[]));
    const tk=activeTasks().filter(t=>t.opportunityId && ids.has(t.opportunityId)).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'))[0];
    const nx=document.createElement('div'); nx.className='pipe-next'; const what=(tk && plainLinks(tk.title||'').replace(/\s+—\s+.*$/,'').trim())||stageTaskOf(st, o); nx.textContent='→ '+(st.who!=='Com' && (!tk || tk.status==='en_attente')?'En attente '+(st.who==='Ops'?'d\u2019Ops':st.who==='Jur'?'du Juridique':st.who==='Client'?'du producteur':'de la Direction')+' : '+what.charAt(0).toLowerCase()+what.slice(1):what); card.appendChild(nx);
    const m=document.createElement('div'); m.className='pipe-who-row';
    const w=document.createElement('span'); w.className='who-chip who-'+String(st.who).toLowerCase(); w.textContent=WHO[st.who]||st.who; m.appendChild(w);
    const d=daysInStage(o); if(d!=null){ const sp=document.createElement('span'); sp.className='pipe-days'+(d>15?' late':''); sp.textContent=d===0?'aujourd’hui':'depuis '+d+' j'; m.appendChild(sp); }
    card.appendChild(m);
    if(o.requestId){ const all=requestInstalls(o.requestId).filter(x=>!isExited(x)); if(all.length>group.length){ const req=opportunities.find(x=>x.id===o.requestId)||{};
      const a=document.createElement('button'); a.type='button'; a.className='pipe-origin'; a.textContent='↳ demande '+(req.label||req.company||'')+' · '+all.length+' install.'; a.onclick=e=>{ e.stopPropagation(); openRequestDetail(o.requestId); }; card.appendChild(a); } }
  }
  // how many lines wait for the Excel files (or changed there), on the « Excel ⇄ » button
  function paintXsCount(){ const b=$('pipe-xs-btn'); if(!b || ON_PHONE) return; let n=0;
    try{ xsList().filter(o=>isExited(o) || stageIndex(o.stage)<stageIndex('onboarding')).forEach(o=>{ if(xsTodo(xsState('pipe',o)) || (xsBddApplies(o) && xsTodo(xsState('bdd',o)))) n++; }); }catch(e){ softFail('compteur Excel', e); }
    b.textContent='Excel ⇄'+(n?' · '+n:''); b.classList.toggle('xs-pending', n>0); }
  function renderPipelineInner(){
    if(normalizeOpps()) saveCrmLocalOnly();
    const board=$('pipeline-board');
    board.innerHTML=''; board.classList.remove('pipe-dash','pipe-meet');
    $('pipe-dash-toggle').setAttribute('aria-pressed', String(pipeDash)); $('pipe-dash-toggle').classList.toggle('on', pipeDash);
    $('pipe-meet-toggle').setAttribute('aria-pressed', String(pipeMeet)); $('pipe-meet-toggle').classList.toggle('on', pipeMeet);
    $('pipe-list-toggle').setAttribute('aria-pressed', String(pipeList && !pipeDash && !pipeMeet && !pipeMap)); $('pipe-list-toggle').classList.toggle('on', pipeList && !pipeDash && !pipeMeet && !pipeMap);
    board.classList.remove('pipe-list');
    $('pipe-exited-toggle').classList.toggle('hidden', pipeDash||pipeMeet);
    if(pipeDash){ renderPipeDash(board); return; }
    const q=pqFold($('opp-search').value.trim());
    if(pipeMeet){ renderPipeMeet(board, q); return; }
    $('pipe-map-toggle').setAttribute('aria-pressed', String(pipeMap)); $('pipe-map-toggle').classList.toggle('on', pipeMap);
    board.classList.remove('pipe-mapview');
    if(pipeMap){ board.classList.add('pipe-mapview'); mapInPipe=true; const keepL=parcMapLayer; parcMapLayer='pipe'; try{ board.appendChild(parcMap()); } finally { parcMapLayer=keepL; } return; }
    mapInPipe=false;
    if(pipeList){ renderPipeList(board, q); return; }
    const vp=savedViewState.pipeline && savedViewState.pipeline.pred;
    const items=opportunities.filter(o=>!o.deleted && o.kind!=='request' && o.stage!=='converti')
      .filter(o=>!q || pqFold([o.company,o.centrale,o.title,o.prenom,o.nom,o.dept].join(' ')).includes(q))
      .filter(o=>!vp || vp(o));
    const live=items.filter(o=>!isExited(o)), exited=items.filter(isExited);
    $('pipe-exited-toggle').textContent=pipeShowExited?'Masquer les sorties':('Sorties ('+exited.length+')');
    pipeTallyReset();
    PIPE_PHASES.filter(ph=>ph.key!=='actif').forEach(ph=>{   // in service lives in the Portefeuille (backlog decision 14)
      const col=document.createElement('div'); col.className='pipe-col'; col.dataset.phase=ph.key;
      const inPhase=live.filter(o=>oppPhase(o)===ph.key).sort((a,b)=>(a.company||'').localeCompare(b.company||'','fr'));
      const head=document.createElement('div'); head.className='pipe-col-head';
      const kwc=inPhase.reduce((s,o)=>s+(parseFloat(String(o.kwc||'').replace(',','.'))||0),0);
      head.innerHTML='<span>'+ph.label+'</span><span>'+inPhase.length+(kwc?' · '+(kwc>=1000?(Math.round(kwc/100)/10).toLocaleString('fr-FR')+' MWc':Math.round(kwc)+' kWc'):'')+'</span>';
      col.appendChild(head);
      // one block per request, lot and step (an installation moved on alone gets its own card); a small title per step
      const blocks=new Map();
      inPhase.forEach(o=>{ const k=o.requestId?'r'+o.requestId+'|'+(o.lot||'')+'|'+o.stage:'o'+o.id; if(!blocks.has(k)) blocks.set(k, []); blocks.get(k).push(o); });
      const ordered=[...blocks.values()].sort((a,b)=>stageIndex(a[0].stage)-stageIndex(b[0].stage) || (a[0].company||'').localeCompare(b[0].company||'','fr'));
      const many=ph.key!=='prequal' && OPP_STAGES.filter(st=>st.phase===ph.key).length>1;
      let prev=null;
      ordered.forEach(g=>{
        if(many && g[0].stage!==prev){ prev=g[0].stage; const n=ordered.filter(x=>x[0].stage===prev).length, h=document.createElement('div'); h.className='pipe-sub-h';
          h.textContent=(prev==='pricing_indicatif'?'Pricing':stageLabel(prev))+' · '+n; col.appendChild(h); }
        pipeTally(g);
        col.appendChild(g.length>1 && g[0].requestId?buildRequestCard(g[0].requestId, g):buildPipeCard(g[0]));
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
  // Drag a card (or a request's block) onto another phase: its steps are offered, the chosen one applies to every installation dragged
  // Drag a card or a request's block with the mouse: it follows the pointer; dropped on a column, that column's steps are offered
  { const board=$('pipeline-board'); let drag=null, eatClick=false;
    const colAt=(x,y)=>{ const el=document.elementFromPoint(x,y); let c=el && el.closest && el.closest('#pipeline-board .pipe-col[data-phase]');
      if(!c) c=[...board.querySelectorAll('.pipe-col[data-phase]')].find(k=>{ const r=k.getBoundingClientRect(); return x>=r.left && x<=r.right && y>=r.top-40; })||null;   // also below its last card
      return c && c.dataset.phase!=='prequal'?c:null; };
    const clear=()=>board.querySelectorAll('.drop-over,.drop-card').forEach(x=>x.classList.remove('drop-over','drop-card'));
    const end=()=>{ if(!drag) return; if(drag.ghost) drag.ghost.remove(); drag.card.classList.remove('dragging'); document.body.classList.remove('pipe-dragging'); clear(); drag=null; };
    board.addEventListener('pointerdown', e=>{
      if(e.button!==0 || e.pointerType==='touch') return;
      const card=e.target.closest && e.target.closest('.pipe-card[data-drag]'); if(!card || card.dataset.renaming || e.target.closest('button,input,select,a')) return;
      drag={ card, ids:card.dataset.drag.split(','), x:e.clientX, y:e.clientY, on:false };
    });
    document.addEventListener('pointermove', e=>{
      if(!drag) return;
      if(!drag.on){ if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)<6) return;
        const r=drag.card.getBoundingClientRect(); drag.on=true; drag.dx=drag.x-r.left; drag.dy=drag.y-r.top;
        const g=drag.card.cloneNode(true); g.className+=' pipe-ghost'; g.style.width=r.width+'px'; g.removeAttribute('data-drag'); document.body.appendChild(g); drag.ghost=g;
        drag.card.classList.add('dragging'); document.body.classList.add('pipe-dragging'); window.getSelection && window.getSelection().removeAllRanges(); }
      e.preventDefault();
      drag.ghost.style.left=(e.clientX-drag.dx)+'px'; drag.ghost.style.top=(e.clientY-drag.dy)+'px';
      clear(); const c=colAt(e.clientX,e.clientY); if(c) c.classList.add('drop-over');
    });
    document.addEventListener('pointerup', e=>{
      if(!drag) return; const d=drag;
      if(!d.on){ drag=null; return; }
      const c=colAt(e.clientX,e.clientY); end(); eatClick=true; setTimeout(()=>{ eatClick=false; }, 0);
      if(!c) return;
      const list=d.ids.map(id=>opportunities.find(o=>o.id===id)).filter(Boolean); if(!list.length) return;
      pipeDropMenu(list, c.dataset.phase, e.clientX, e.clientY);
    });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && drag){ end(); } }, true);
    board.addEventListener('click', e=>{ if(eatClick){ e.stopPropagation(); e.preventDefault(); eatClick=false; } }, true);   // the drop is not a click on the card
  }
  // Several cards or blocks picked (the box at their corner, or Ctrl+click), then « Grouper » puts them in one request
  const pipePicked=new Set();
  function paintPicks(){
    const board=$('pipeline-board'), shown=new Set([...board.querySelectorAll('.pipe-card[data-drag]')].map(c=>c.dataset.drag));
    [...pipePicked].forEach(k=>{ if(!shown.has(k)) pipePicked.delete(k); });   // cards no longer on screen (moved, filtered, regrouped)
    board.querySelectorAll('.pipe-card[data-drag]').forEach(c=>{ const on=pipePicked.has(c.dataset.drag); c.classList.toggle('picked', on); const b=c.querySelector('.pipe-pick'); if(b) b.setAttribute('aria-checked', String(on)); });
    document.body.classList.toggle('pipe-picking', pipePicked.size>0);
    let bar=$('pipe-pickbar');
    if(!pipePicked.size){ if(bar) bar.hidden=true; return; }
    if(!bar){ bar=document.createElement('div'); bar.id='pipe-pickbar'; bar.className='pipe-pickbar'; bar.innerHTML='<span></span><button type="button" class="pk-group">Grouper</button><button type="button" class="ghost-btn pk-cancel">Annuler</button>'; document.body.appendChild(bar);
      bar.querySelector('.pk-cancel').onclick=()=>{ pipePicked.clear(); paintPicks(); };
      bar.querySelector('.pk-group').onclick=()=>groupPicked(); }
    const ids=[...pipePicked].flatMap(k=>k.split(',')), n=pipePicked.size;
    bar.hidden=false; bar.querySelector('span').textContent=n+' sélectionné'+(n>1?'s':'')+' · '+ids.length+' installation'+(ids.length>1?'s':'');
    bar.querySelector('.pk-group').disabled=n<2;
    bar.querySelector('.pk-group').title=n<2?'Sélectionne au moins deux cartes ou blocs':'Les réunir dans une même demande';
  }
  async function groupPicked(){
    const groups=[...pipePicked].map(k=>k.split(',').map(id=>opportunities.find(o=>o.id===id)).filter(Boolean)).filter(g=>g.length);
    if(groups.length<2) return;
    const base=groups.slice().sort((a,b)=>(b[0].requestId?1:0)-(a[0].requestId?1:0) || b.length-a.length)[0];   // the biggest existing request takes the others
    const moving=groups.filter(g=>g!==base).flat();
    if(await groupInto(moving, base)){ pipePicked.clear(); paintPicks(); }
  }
  { const board=$('pipeline-board');
    board.addEventListener('click', e=>{
      const pick=e.target.closest && e.target.closest('.pipe-pick'), card=e.target.closest && e.target.closest('.pipe-card[data-drag]');
      if(!card || !(pick || e.ctrlKey || e.metaKey)) return;
      e.stopPropagation(); e.preventDefault();
      const k=card.dataset.drag; pipePicked.has(k)?pipePicked.delete(k):pipePicked.add(k); paintPicks();
    }, true);
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && pipePicked.size && !document.querySelector('.modal-overlay:not(.hidden), .drop-menu')){ pipePicked.clear(); paintPicks(); } });
  }
  // Group: the installations dragged join the request of the card they are dropped on (a new request when it has none)
  async function groupInto(moving, target){
    if(!target.length) return;
    const t0=target[0], all=[...new Set(target.concat(moving))], cos=[...new Set(all.map(o=>o.company).filter(Boolean))];
    const v=await askChoice('Grouper dans une même demande ?', (moving.length>1?moving.length+' installations':'« '+oppName(moving[0])+' »')+' rejoin'+(moving.length>1?'nent':'t')+' '+(t0.requestId?'la demande de pricing de « '+oppName(t0)+' »':'« '+oppName(t0)+' » dans une nouvelle demande de pricing')+' ('+all.length+' installations en tout).'
      +(cos.length>1?' Attention : producteurs différents ('+cos.join(', ')+') ; la demande garde « '+(t0.company||'')+' ».':''), [{ label:'Grouper', value:'y' }]);
    if(v!=='y') return false;
    let reqId=t0.requestId;
    if(!reqId){ reqId=newOppId('req'); opportunities.push({ id:reqId, kind:'request', company:t0.company||'', title:'Demande de pricing', createdAt:Date.now(), updatedAt:Date.now(), deleted:false }); }
    const left=new Set(moving.map(o=>o.requestId).filter(r=>r && r!==reqId));
    all.forEach(o=>{ if(o.requestId!==reqId){ o.requestId=reqId; touchCrm(o); } });
    left.forEach(r=>{ if(!requestInstalls(r).length) dropRequest(r, all[0].id); });   // a request left empty goes, its tasks follow
    saveCrm(); renderPipeline(); return true;
  }
  // Ungroup: each installation of the request on its own card; the request's tasks go to the first one
  function dropRequest(reqId, heirId){
    const req=opportunities.find(o=>o.id===reqId); if(!req) return;
    tasks.filter(t=>t.opportunityId===reqId).forEach(t=>{ t.opportunityId=heirId; touch(t); }); saveTasks();
    req.deleted=true; touchCrm(req);
  }
  async function ungroupRequest(reqId){
    const list=requestInstalls(reqId); if(!list.length) return false;
    const v=await askChoice('Dégrouper cette demande ?', 'Les '+list.length+' installations redeviennent des cartes séparées (rien n\u2019est effacé ; les tâches de la demande passent à « '+oppName(list[0])+' »).', [{ label:'Dégrouper', value:'y' }]);
    if(v!=='y') return false;
    list.forEach(o=>{ o.requestId=null; touchCrm(o); }); dropRequest(reqId, list[0].id); saveCrm(); renderPipeline(); return true;
  }
  function pipeDropMenu(list, phase, x, y, target){
    const steps=OPP_STAGES.filter(st=>st.phase===phase); if(!steps.length) return;
    // forward: the same window as « Étape suivante » (task to create, task to close); back: at once
    const apply=key=>{ const k=stageIndex(key), fwd=list.filter(o=>stageIndex(o.stage)<k), back=list.filter(o=>stageIndex(o.stage)>k);
      back.forEach(o=>setOppStage(o, key)); renderPipeline(); if(fwd.length) offerStageAdvance(fwd, key); };
    if(steps.length===1 && !target){ apply(steps[0].key); return; }
    document.querySelectorAll('.drop-menu').forEach(m=>m.remove());
    const m=document.createElement('div'); m.className='drop-menu'; m.setAttribute('role','menu');
    const h=document.createElement('div'); h.className='drop-menu-h'; h.textContent=(list.length>1?list.length+' installations':oppName(list[0]))+' → quelle étape ?'; m.appendChild(h);
    steps.forEach(st=>{ const b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitem'); b.dataset.stage=st.key;
      b.innerHTML='<span></span>'+(st.who!=='Com'?'<em>'+st.who+'</em>':''); b.firstChild.textContent=st.label; if(list.every(o=>o.stage===st.key)) b.classList.add('on');
      b.onclick=()=>{ m.remove(); apply(st.key); }; m.appendChild(b); });
    if(target){ const g=document.createElement('button'); g.type='button'; g.className='drop-menu-group'; g.setAttribute('role','menuitem'); g.textContent='Grouper avec « '+oppName(target[0])+(target.length>1?' » (+'+(target.length-1)+')':' »'); g.onclick=()=>{ m.remove(); groupInto(list, target); }; m.appendChild(g); }
    document.body.appendChild(m);
    const r=m.getBoundingClientRect(); m.style.left=Math.min(innerWidth-r.width-8, x)+'px'; m.style.top=Math.min(innerHeight-r.height-8, y)+'px';
    m.querySelector('button').focus();
    const close=ev=>{ if(ev.type==='keydown' && ev.key!=='Escape') return; if(ev.type==='mousedown' && m.contains(ev.target)) return; m.remove(); document.removeEventListener('mousedown', close, true); document.removeEventListener('keydown', close, true); };
    document.addEventListener('keydown', close, true); setTimeout(()=>document.addEventListener('mousedown', close, true), 0);   // Escape at once; a click only after the drop itself
  }
  function stageChip(o){
    const s=oppStage(o.stage);
    const chip=document.createElement('span'); chip.className='pipe-chip'+(isExited(o)?' out':'');
    chip.textContent=stageLabel(o.stage, o);
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
    if(o.kind!=='installation' || isExited(o) || stageIndex(o.stage)<stageIndex('pricing_indicatif')) return null;
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
    if(o.kind==='installation' && !isExited(o) && !window.TODO_LITE){ card.dataset.drag=o.id; card.appendChild(pickBox()); }
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
      if(o.kind==='installation') cardStepInfo(card, [o], null);
    }
    card.onclick=()=>openOppDetail(o.id);
    return card;
  }
  // A request's block: the producer, a name of one's own, the totals on the right; long blocks fold to their first lines
  function pickBox(){ const b=document.createElement('span'); b.className='pipe-pick'; b.setAttribute('role','checkbox'); b.setAttribute('aria-checked','false'); b.title='Sélectionner (pour grouper) — ou Ctrl+clic'; return b; }
  const REQ_FOLD_AT=3;
  function reqTotals(group){ const kw=group.reduce((t,o)=>t+kwcNum(o),0); return group.length+(kw?' · '+fmtKwc(kw):' inst.'); }
  function reqDisplayName(req, list){ return (req.label?req.label:(list.length+' installation'+(list.length>1?'s':''))); }
  function buildRequestCard(reqId, group){
    const req=opportunities.find(x=>x.id===reqId)||{};
    const company=group[0].company;
    const card=document.createElement('div'); card.className='pipe-card pipe-req-card'; card.dataset.id=reqId;
    if(!window.TODO_LITE){ card.dataset.drag=group.map(x=>x.id).join(','); card.appendChild(pickBox()); }
    card.style.borderLeft='3px solid '+clientColor(company);
    const head=document.createElement('div'); head.className='pipe-card-title pipe-req-head';
    const c=document.createElement('span'); c.className='pipe-card-company'; c.style.color=clientColor(company); c.textContent=company; if(company) c.dataset.peek='co:'+company;
    const lotName=group.every(x=>(x.lot||'')===(group[0].lot||''))?group[0].lot||'':'';
    const lab=document.createElement('span'); lab.className='pipe-req-label'; lab.textContent=lotName||req.label||'';
    const tot=document.createElement('span'); tot.className='pipe-req-tot'; tot.textContent=reqTotals(group); tot.title=group.length+' installations au total';
    head.append(c, lab);
    if(!window.TODO_LITE){
      const ren=document.createElement('button'); ren.type='button'; ren.className='pipe-req-rename'; ren.title='Nommer ce bloc (texte après le producteur)'; ren.setAttribute('aria-label','Renommer');
      ren.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
      ren.onclick=ev=>{ ev.stopPropagation(); card.dataset.renaming='1';
        const inp=document.createElement('input'); inp.className='pipe-req-label-in'; inp.value=lotName||req.label||''; inp.placeholder='ex. Lot toitures 2027'; lab.replaceWith(inp); ren.hidden=true; inp.focus(); inp.select();
        const done=save=>{ if(save){ const v=inp.value.trim(); if(lotName){ if(v && v!==lotName){ group.forEach(x=>{ x.lot=v; touchCrm(x); }); saveCrm(); } } else if((req.label||'')!==v){ req.label=v; touchCrm(req); saveCrm(); } } renderPipeline(); };
        inp.onclick=x=>x.stopPropagation(); inp.onkeydown=x=>{ if(x.key==='Enter'){ x.preventDefault(); done(true); } if(x.key==='Escape'){ x.stopPropagation(); done(false); } }; inp.onblur=()=>done(true); };
      head.appendChild(tot); head.appendChild(ren);
    } else head.appendChild(tot);
    card.appendChild(head);
    const same=group.every(o=>o.stage===group[0].stage);
    cardStepInfo(card, group, reqId);   // the step is the column's small title
    if(!window.TODO_LITE){ const ug=document.createElement('button'); ug.type='button'; ug.className='pipe-ungroup'; ug.textContent='Dégrouper'; ug.title='Séparer les installations de ce bloc';
      ug.onclick=ev=>{ ev.stopPropagation(); ungroupRequest(reqId); };
      const row=card.querySelector('.pipe-who-row'); if(row) row.appendChild(ug); else { const meta=document.createElement('div'); meta.className='pipe-card-meta'; meta.appendChild(ug); card.appendChild(meta); } }
    const foldKey=reqId+'|'+(lotName||'')+'|'+group[0].stage;
    let open=group.length<=REQ_FOLD_AT; try{ const v=JSON.parse(localStorage.getItem('pipe-req-open')||'{}')[foldKey]; if(v!=null) open=v; }catch(err){}
    group.forEach((o,i)=>{
      const r=document.createElement('div'); r.className='pipe-req-line'; if(!open) r.hidden=true;
      const n=document.createElement('span'); n.className='pipe-req-name'; n.textContent=oppName(o); n.title=[oppName(o), fmtKwc(o.kwc), stageLabel(o.stage, o)].filter(Boolean).join(' · ');
      r.appendChild(n);
      if(same){ const k=document.createElement('span'); k.className='pipe-req-kwc'; k.textContent=fmtKwc(o.kwc); r.appendChild(k); } else r.appendChild(stageChip(o));
      r.onclick=ev=>{ ev.stopPropagation(); openOppDetail(o.id); };
      card.appendChild(r);
    });
    if(group.length>REQ_FOLD_AT){
      const t=document.createElement('button'); t.type='button'; t.className='pipe-req-more'; t.textContent=open?'▴ Replier':'▾ '+group.length+' installations';
      t.onclick=ev=>{ ev.stopPropagation(); let m={}; try{ m=JSON.parse(localStorage.getItem('pipe-req-open')||'{}'); }catch(err){} m[foldKey]=!open; try{ localStorage.setItem('pipe-req-open', JSON.stringify(m)); }catch(err){} renderPipeline(); };
      card.appendChild(t);
    }
    card.onclick=()=>openRequestDetail(reqId, group.map(x=>x.id));
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
    pqLastFiles=null; setTimeout(pqRestartVisible, 0);
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
        +'<button type="button" class="pq-link pq-clear-inst" data-clear="'+i+'" title="Effacer toutes les infos de cette installation (si ce n\u2019est pas la bonne centrale)">Vider</button>'
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
    // nothing to confirm when the mail's own count matches: the box only tells it; a gap (or no count in the mail) is asked
    const conforme=!!h.count && h.count===n && !issues.length, show=!st.editId && (n>=2 || issues.length>0), need=show && !conforme;
    return { n, sum, issues, need, show, conforme, hints:h };
  }
  function pqCountBox(){
    const c=pqCountCheck(); if(!c.show) return '';
    const st=pqState, ok=!c.issues.length;
    const list=st.installs.map(i=>(i.centrale||'(sans nom)')+(i.kwc?' '+fmtKwc(i.kwc):'')).join(' · ');
    return '<div class="pq-count '+(ok?'ok':'warn')+'" id="pq-count-box"><div class="pq-count-h">'+(ok?'✓':'⚠')+' '+c.n+' installation'+(c.n>1?'s':'')+(c.sum?' — '+fmtKwc(c.sum)+' au total':'')
      +(ok && c.hints.count?' · conforme au mail ('+escapeHtml(c.hints.source)+')':'')+'</div><div class="pq-count-list">'+escapeHtml(list)+'</div>'
      +c.issues.map(x=>'<div class="pq-count-issue">'+escapeHtml(x)+'</div>').join('')
      +(c.need?'<label class="pq-count-ok"><input type="checkbox" id="pq-count-ok"'+(st.countConfirmed===c.n?' checked':'')+'> J\u2019ai vérifié : '+c.n+' installation'+(c.n>1?'s':'')+'</label>':'')+'</div>';
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
      // what the mail says for all of them (contract, duration, dates) goes to each plant; the kind of plant (toiture,
      // ombrière, au sol…) is each one's own, from its name — not every kind mentioned piled on the first one
      const KIND=[[/toitur/i,'Toiture'],[/ombri/i,'Ombrière'],[/\bau sol\b|\bsol\b/i,'Au sol'],[/hangar/i,'Hangar'],[/agrivolt/i,'Agrivoltaïsme']];
      const sharedNotes=xlsInstalls.length>1?String(base.particularites||'').split(/\s*·\s*/).filter(t=>t && !KIND.some(([,w])=>w.toLowerCase()===t.toLowerCase())):null;
      st.installs=xlsInstalls.map((x,i)=>{
        const common={ install:base.install, contrat:base.contrat, dept:base.dept, region:base.region, duree:base.duree, debut:base.debut, fin:base.fin };
        Object.keys(common).forEach(k=>{ if(common[k]==null || common[k]==='') delete common[k]; });
        const inst=Object.assign({}, i===0?base:common, x);
        if(sharedNotes){ const kinds=KIND.filter(([re])=>re.test(x.centrale||'')).map(([,w])=>w); const pt=kinds.concat(sharedNotes).concat(x.particularites?[x.particularites]:[]); if(pt.length) inst.particularites=[...new Set(pt)].join(' · '); else delete inst.particularites; }
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
    pqRestartVisible();
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
  // « Repartir de zéro » : the pasted mail, the files and everything read from them go; what was typed by hand stays
  function pqRestart(){
    const st=pqState; if(!st) return;
    $('pq-mail').value=''; pqLastFiles=null; $('pq-files-info').textContent=''; st.detected=[]; st.hints=null;
    [...st.auto].forEach(key=>{ if(st.touched.has(key)) return; const [sc,k]=key.split('.'); if(sc==='s') st.shared[k]=pqDefaults()[k]; else if(st.installs[+sc]) delete st.installs[+sc][k]; });
    st.auto=new Set();
    if(st.editId){ st.installs=st.installs.filter((x,i)=>i===0 || !x._fromFile); }
    else { const typed=st.installs.filter((x,i)=>[...st.touched].some(k=>k.startsWith(i+'.'))); st.installs=typed.length?typed:[{}];
      st.touched=new Set([...st.touched].filter(k=>k.startsWith('s.'))); }
    $('pq-detect').hidden=true; $('pq-detect').innerHTML=''; $('pq-mail-warning').hidden=true; pqRender(); pqRestartVisible();
  }
  function pqRestartVisible(){ const b=$('pq-restart'); if(b) b.hidden=!($('pq-mail').value.trim() || pqLastFiles || (pqState && pqState.auto.size)); }
  async function pqHandleFiles(fileList){
    const files=[...fileList]; if(!files.length) return;
    $('pq-files-info').textContent='Lecture…';
    try{
      pqLastFiles=await readPipeFiles(files);
      const n=pqLastFiles.installs.length;
      $('pq-files-info').textContent=pqLastFiles.names.join(', ')+(n?' — '+n+' installation'+(n>1?'s':'')+' trouvée'+(n>1?'s':'')+' dans l\u2019Excel':'')
        +(pqLastFiles.unreadable.length?' — pièce jointe illisible : '+pqLastFiles.unreadable.join(', '):'');
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
      if(stageIndex(startStage)>=stageIndex('pricing_indicatif')) o.goDate=toISO(new Date());
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
  // the sheet's buttons used now and then go in a « Plus ▾ » menu: the bar keeps the everyday ones
  const ACT_MORE=/^(Copier lignes? Pipe|Copier lignes? BDD|Voir dans le réseau|Dégrouper|Supprimer|Demande de pricing|Abandonner)$/;
  function foldActions(bar){
    if(!bar || window.TODO_LITE) return;
    const more=[...bar.children].filter(b=>b.tagName==='BUTTON' && ACT_MORE.test(b.textContent.trim()));
    if(more.length<2) return;
    const d=document.createElement('details'); d.className='act-more'; const sm=document.createElement('summary'); sm.textContent='Plus ▾'; d.appendChild(sm);
    const box=document.createElement('div'); box.className='act-more-list'; more.forEach(b=>{ b.addEventListener('click', ()=>{ d.open=false; }); box.appendChild(b); }); d.appendChild(box);
    const close=bar.querySelector('button:last-child'); if(close && /^Fermer$/.test(close.textContent.trim())) bar.insertBefore(d, close); else bar.appendChild(d);
    document.addEventListener('mousedown', e=>{ if(d.open && !d.contains(e.target)) d.open=false; }, true);
  }
  function oppActionBtn(label, fn, cls){ const b=document.createElement('button'); b.type='button'; b.textContent=label; if(cls) b.className=cls; b.onclick=fn; return b; }
  function openOppDetail(id){
    const o=opportunities.find(x=>x.id===id); if(!o) return;
    if(o.kind==='request'){ openRequestDetail(id); return; }
    const toTop=viewingOppId!==id;
    viewingOppId=id;
    const box=$('opp-detail-body'); box.innerHTML='';
    $('opp-detail-title').textContent=o.kind==='prequal'?o.company+' — pré-qualif':o.company+' — '+oppName(o);
    $('opp-detail-sum').textContent=o.kind==='prequal'?'':oppSummary(o.requestId?requestInstalls(o.requestId).filter(x=>!isExited(x)):[o]);
    { const sb=suiviBadge(o, true); if(sb){ const line=document.createElement('div'); line.className='suivi-line'; line.appendChild(sb); const t=document.createElement('span'); t.textContent=sb.title; line.appendChild(t); box.appendChild(line); } }
    if(o.company || o.requestId){
      const nav=document.createElement('div'); nav.className='opp-nav';
      if(o.requestId && o.kind==='installation'){ const req=opportunities.find(x=>x.id===o.requestId), n=requestInstalls(o.requestId).length;
        const r=document.createElement('button'); r.type='button'; r.className='opp-co-link opp-back'; r.textContent='← '+(req&&req.label?req.label+' ('+n+' installation'+(n>1?'s':'')+')':'Les '+n+' installations'); r.onclick=()=>openRequestDetail(o.requestId); nav.appendChild(r); }
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
      // step by step: the progress bar, « Étape en cours » (checklist, one button), then the plant's details, the file, the mail
      const siblings=o.requestId?requestInstalls(o.requestId):[];
      if(siblings.length>1) box.appendChild(buildRequestTabs(siblings, o.id));
      // installations of one request usually move together (those of its lot): the stage applies to all of them, or to this one only
      const batch=o.requestId?requestInstalls(o.requestId).filter(x=>!isExited(x) && (x.lot||'')===(o.lot||'')):[];
      const many=batch.length>1 && !isExited(o);
      const sc=document.createElement('div'); sc.className='stage-scope';
      if(many){
        sc.setAttribute('role','group'); sc.setAttribute('aria-label','Changer l\u2019étape de');
        sc.innerHTML='<span>Changer l\u2019étape de</span>';
        [[true,'Toutes les installations ('+batch.length+')'],[false,'Seulement celle-ci']].forEach(([v,l])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=l; b.className=stageScopeAll===v?'on':''; b.setAttribute('aria-pressed', String(stageScopeAll===v)); b.onclick=()=>{ stageScopeAll=v; openOppDetail(o.id); }; sc.appendChild(b); });
      } else sc.innerHTML='<span>Étape de l\u2019installation</span>';
      const scopeList=many&&stageScopeAll?batch:[o];
      box.appendChild(buildStageTrack(scopeList, key=>{ scopeList.forEach(x=>{ if(x.stage!==key) setOppStage(x, key); }); openOppDetail(o.id); }));
      box.appendChild(buildStepPanel(scopeList, { scope:many?sc:null, reopen:()=>openOppDetail(o.id) }));
      if(!window.TODO_LITE) box.appendChild(sheetSection('Notes express', 'colle ou tape tes notes : les chiffres sont repérés, un clic pour remplir la fiche', false, buildQuickNotes(scopeList, { onFill:()=>openOppDetail(o.id), onKeep:()=>openOppDetail(o.id) })));
      const sheet=buildInstallSheet(o);
      box.appendChild(sheetSection('Détails de la centrale', [o.install, o.contrat, fmtKwc(o.kwc)].filter(Boolean).join(' · '), stageIndex(o.stage)<=stageIndex('qualif_en_cours') || isExited(o), sheet));
      const cmp=buildRequestCompare(siblings.length>1?siblings:[o], o.id);   // every line of the « Caractéristiques Centrales » file, to fill in place
      if(!o.requestId){ const fr=document.createElement('div'), pm=appendPricingMail(fr, { company:o.company }, [o]);   // a plant on its own has its pricing mail too, first at the pricing steps
        if(pm.mailNow){ box.append(...fr.childNodes); box.appendChild(cmp); } else { box.appendChild(cmp); box.append(...fr.childNodes); } }
      else box.appendChild(cmp);
      { const h=buildHistory(o.requestId?requestInstalls(o.requestId):[o]); if(h) box.appendChild(h); }
      // moving on (Go, offer accepted, next step, lost…) is in « Étape en cours »; the bar keeps the files and copies
      excelButtons(actions, [o]);
      actions.appendChild(oppActionBtn('Fichier caractéristiques (.xlsx)', e=>downloadCaract(o.requestId?requestInstalls(o.requestId).filter(x=>!isExited(x)):[o], e.target), 'ghost-btn'));
      actions.appendChild(oppActionBtn('Copier ligne Pipe', e=>copyPipeLines(o.requestId?requestInstalls(o.requestId).filter(x=>!isExited(x)):[o], e.target), 'ghost-btn'));
      if(o.goDate || stageIndex(o.stage)>=stageIndex('pricing_indicatif')) actions.appendChild(oppActionBtn('Copier ligne BDD', e=>copyToClipboard(bddRow(o), e.target), 'ghost-btn'));
      if(!o.requestId && !isExited(o)) actions.appendChild(oppActionBtn('Demande de pricing', ()=>{
        const reqId=newOppId('req');
        opportunities.push({ id:reqId, kind:'request', company:o.company, title:'Demande de pricing', createdAt:Date.now(), updatedAt:Date.now(), deleted:false });
        o.requestId=reqId; touchCrm(o); saveCrm(); renderPipeline(); openRequestDetail(reqId);
      }, 'ghost-btn'));
      if(!isExited(o) && stageIndex(o.stage)>=stageIndex('pricing_indicatif')) actions.appendChild(oppActionBtn('Abandonner', ()=>exitOpp(o,'abandonne'), 'ghost-btn danger-btn'));
    }
    actions.appendChild(oppActionBtn('Voir dans le réseau', ()=>{ closeOppDetail(); openInNetwork('op:'+o.id); }, 'ghost-btn opp-net-btn lite-keep'));
    { const mb=mentionsBlock('op:'+o.id); if(mb) $('opp-detail-body').appendChild(mb); }
    actions.appendChild(oppActionBtn('Supprimer', ()=>{ if(!confirm('Supprimer cette fiche du pipeline ?')) return; o.deleted=true; touchCrm(o); saveCrm(); closeOppDetail(); renderPipeline(); }, 'ghost-btn danger-btn'));
    actions.appendChild(oppActionBtn('Fermer', closeOppDetail, 'ghost-btn lite-keep'));
    foldActions($('opp-detail-actions')); $('opp-detail-overlay').classList.remove('hidden'); if(toTop) sheetToTop();
  }
  // a sheet opened on another deal starts at its top (a refresh of the same one keeps the place); only once visible, a hidden box ignores scrollTop
  function sheetToTop(){ const ov=$('opp-detail-overlay'); [ov, ov.querySelector('.modal-box')].forEach(x=>{ if(x) x.scrollTop=0; }); }
  function closeOppDetail(){ $('opp-detail-overlay').classList.add('hidden'); viewingOppId=null; }
  // Installation sheet: every column of the Pipe / BDD, grouped; empty values shown as "—" so gaps are visible.
  // ---------- Installations of one pricing request: tabs to go from one to the other, and a table to check them side by side ----------
  const pqFieldLabel=k=>{ const f=PQ_FIELDS.find(x=>x.k===k)||PQ_EXTRA_FIELDS.find(x=>x.k===k); return f?f.label:k; };
  // short description of an installation for its line: power · volume · commissioning · technology
  function instLineInfo(x){
    const mwh=mwhText(x.mwh);
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
  // Excel-like fill: the small square at the corner of the active cell, dragged along its line (the other plants) or down
  // its column, copies its value into every cell it covers
  function reqFillHandle(sc){
    const handle=document.createElement('span'); handle.className='req-fill'; handle.title='Tirer pour recopier dans les cases voisines';
    sc.addEventListener('focusin', e=>{ const inp=e.target.closest && e.target.closest('.req-in'); if(!inp || inp.readOnly || inp.disabled) return; inp.closest('td').appendChild(handle); });
    handle.addEventListener('pointerdown', e=>{
      e.preventDefault(); e.stopPropagation();
      const td=handle.parentElement, src=td && td.querySelector('.req-in'); if(!src) return;
      const tbl=td.closest('table'), r0=td.parentElement.rowIndex, c0=td.cellIndex; let picked=[];
      const paint=()=>{ tbl.querySelectorAll('.fill-sel').forEach(x=>x.classList.remove('fill-sel')); picked.forEach(c=>c.classList.add('fill-sel')); };
      const move=ev=>{ const el=document.elementFromPoint(ev.clientX, ev.clientY), over=el && el.closest && el.closest('td'); if(!over || over.closest('table')!==tbl) return;
        const r=over.parentElement.rowIndex, c=over.cellIndex; picked=[];
        if(r===r0){ for(let k=Math.min(c,c0);k<=Math.max(c,c0);k++){ const x=tbl.rows[r0].cells[k]; if(x && k!==c0 && x.querySelector('.req-in')) picked.push(x); } }
        else if(c===c0){ for(let k=Math.min(r,r0);k<=Math.max(r,r0);k++){ const row=tbl.rows[k], x=row && row.cells[c0]; if(x && k!==r0 && x.offsetParent && x.querySelector('.req-in')) picked.push(x); } }
        paint(); };
      const up=()=>{ document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
        const v=src.value; picked.forEach(x=>{ const inp=x.querySelector('.req-in'); if(!inp || inp.readOnly || inp.disabled) return;
          if(inp.tagName==='SELECT'){ if(![...inp.options].some(o=>o.value===v || o.text===v)) return; } inp.value=v; inp.dispatchEvent(new Event('change', { bubbles:true })); });
        setTimeout(()=>{ picked.forEach(c=>c.classList.remove('fill-sel')); }, 600); };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    });
  }
  function buildRequestCompare(list, currentId){
    // folds away with a click on its title; open or closed is remembered on this device
    const wrap=document.createElement('details'); wrap.className='req-compare';
    // open while the plants' details are collected and priced, folded once the offer is out (each choice remembered on this device)
    const lo=Math.min(...list.filter(x=>!isExited(x)).map(x=>stageIndex(x.stage)).filter(i=>i>=0)), early=!(lo>stageIndex('pricing_indicatif')), key='req-compare-open'+(early?'':'-late');
    let open=early; try{ const v=localStorage.getItem(key); if(v!=null) open=v!=='0'; }catch(e){}
    wrap.open=open;
    wrap.addEventListener('toggle', ()=>{ if(wrap.dataset.noRemember){ delete wrap.dataset.noRemember; return; } try{ localStorage.setItem(key, wrap.open?'1':'0'); }catch(e){} });
    const missing=list.reduce((s,x)=>s+CARACT_ROWS.filter(l=>REQ_NEEDED.has(caractKey(l)) && caractValue(x,l)==='').length,0);
    wrap.innerHTML='<summary class="opp-phase-h req-compare-h">'+(list.length>1?'Les '+list.length+' installations côte à côte':'Caractéristiques centrales')+(missing?' <span class="req-miss">'+missing+' case'+(missing>1?'s':'')+' à compléter</span>':'')+'<span class="req-hint">cliquer dans une case pour la modifier · tirer le petit carré pour recopier</span></summary>';
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
      if(!labels.some(l=>REQ_NEEDED.has(caractKey(l)))) t=t.replace(/<tbody class="req-sec([^"]*)" data-sec="([^"]*)">(?![\s\S]*<tbody)/, '<tbody class="req-sec$1 opt-sec" data-sec="$2">');
      labels.forEach((l,li)=>{ const need=REQ_NEEDED.has(caractKey(l));
        t+='<tr'+(need?'':' class="opt"')+'><th scope="row" class="req-lab">'+escapeHtml(l)+'</th>'+list.map((x,xi)=>cell(x, vals[li][xi], 'data-id="'+escapeHtml(x.id)+'" data-l="'+escapeHtml(l)+'"', need)).join('')+'</tr>'; });
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
    sc.innerHTML=t;
    // all the lines of the file, or only the ones the pricing needs (choice remembered on this device)
    const tools=document.createElement('div'); tools.className='req-tools';
    let only=false; try{ only=localStorage.getItem('req-rows')==='needed'; }catch(e){}
    tools.innerHTML='<span>Lignes :</span><button type="button" data-rows="needed">Obligatoires</button><button type="button" data-rows="all">Tout le fichier</button>';
    const paintRows=()=>{ sc.querySelector('.req-table').classList.toggle('only-needed', only); tools.querySelectorAll('button').forEach(b=>b.classList.toggle('on', (b.dataset.rows==='needed')===only)); };
    tools.querySelectorAll('button').forEach(b=>b.onclick=()=>{ only=b.dataset.rows==='needed'; try{ localStorage.setItem('req-rows', only?'needed':'all'); }catch(e){} paintRows(); });
    if(!window.TODO_LITE && aiOn()){ const ai=document.createElement('button'); ai.type='button'; ai.className='req-ai'; ai.textContent='Compléter avec l\u2019IA'; ai.title='Claude propose ce qui se déduit des infos de la fiche (coordonnées, altitude, région, productible…) ; tu choisis ce qui est rempli';
      ai.onclick=()=>openAiFill(list.filter(x=>!x.deleted), ()=>{ if(viewingOppId) openOppDetail(viewingOppId); }); tools.appendChild(ai); }
    wrap.appendChild(tools); wrap.appendChild(sc); paintRows();
    if(!window.TODO_LITE) reqFillHandle(sc);
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
    const mwh=v=>mwhText(v);
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
      // a phone calls, a mail opens a new message; the small button next to it copies
      lines.forEach(([l,v])=>{ const r=document.createElement('div'); r.className='os-row'; const a=document.createElement('span'); a.textContent=l; const b=document.createElement('b');
        if(!v){ b.textContent='—'; b.classList.add('none'); r.append(a,b); p.appendChild(r); return; }
        const isMail=/@/.test(v), link=document.createElement('a'); link.className='os-link'; link.textContent=v; link.href=isMail?'mailto:'+v.trim():'tel:'+v.replace(/[^\d+]/g,''); link.onclick=e=>e.stopPropagation();
        const cp=document.createElement('button'); cp.type='button'; cp.className='os-copy'; cp.title='Copier'; cp.setAttribute('aria-label','Copier '+v); cp.textContent='⧉'; cp.onclick=e=>{ e.stopPropagation(); copyToClipboard(v, cp); };
        b.append(link, cp); r.append(a,b); p.appendChild(r); });
      return p;
    };
    const mainName=[o.prenom,(o.nom||'').replace(/^(M\.|Mme)\s+/i,'')].filter(Boolean).join(' ');
    const mainMail=(o.mail||'').toLowerCase();
    const others=(o.otherContactIds||[]).map(id=>contacts.find(c=>c.id===id)).filter(c=>c && !c.deleted && !(mainMail && (c.email||'').toLowerCase()===mainMail));
    const contactRows=[['Producteur',[o.producteur||o.company, o.marche].filter(Boolean).join(' · ')]];
    // what the sheet lacks is taken from the contact known by the same mail (name, role, phones)
    const crm=mainMail && contacts.find(c=>!c.deleted && (c.email||'').toLowerCase()===mainMail);
    const crmName=crm?[crm.firstName,crm.lastName].filter(Boolean).join(' '):'', crmTels=crm?[crm.phone1,crm.phone2].filter(Boolean).join(' / '):'';
    if(mainName||o.tel||o.mail) contactRows.push({ node:person(mainName||crmName, o.qualite||(crm&&crm.role), phones(o.tel||crmTels), o.mail, true) });
    else { const team=contacts.filter(c=>!c.deleted && c.company && sameCo(c.company, o.company)).slice(0,3);   // no main contact: the company's people
      if(team.length) team.forEach(c=>contactRows.push({ node:person([c.firstName,c.lastName].filter(Boolean).join(' '), [c.role,'contact de '+c.company].filter(Boolean).join(' · '), phones([c.phone1,c.phone2].filter(Boolean).join(' / ')), c.email, false) }));
      else contactRows.push(['Contact principal','']); }
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
  function exitList(list, kind){
    if(list.length===1) return exitOpp(list[0], kind);
    if(!confirm(list.length+' installations ('+(list[0].company||'')+') : '+OPP_EXITS[kind]+' ?')) return;
    list.forEach(o=>{ relanceOnMove(o, null); o.stageBeforeExit=o.stage; o.stage=kind; o.lostAt=Date.now(); touchCrm(o); }); saveCrm(); closeOppDetail(); renderPipeline();
  }
  function exitOpp(o, kind){
    if(!confirm('« '+oppName(o)+' » : '+OPP_EXITS[kind]+' ?')) return;
    relanceOnMove(o, null); o.stageBeforeExit=o.stage; o.stage=kind; o.lostAt=Date.now(); touchCrm(o); saveCrm();
    closeOppDetail(); renderPipeline();
  }
  // a lost deal (one installation or a whole request at once), with its little animation
  // a lost renewal: its « Renouvellement … » task (made from the Portefeuille) is closed with it
  function closeRenewalTask(o){
    if(!o || !o.renewalOf || !parcData || !parcData.items) return;
    const p=parcData.items.find(x=>parcKey(x)===o.renewalOf); if(!p) return;
    const t=tasks.find(x=>x.id===renewGroupId(p) && !x.archived && !x.deleted); if(t){ t.archived=true; t.archivedAt=Date.now(); touch(t); saveTasks(); render(); }
  }
  function loseOpps(list){
    if(!list.length) return;
    const what=list.length>1?list.length+' installations ('+list[0].company+')':'« '+oppName(list[0])+' »';
    if(!confirm(what+' : offre perdue ?')) return;
    list.forEach(o=>{ relanceOnMove(o, null); o.stageBeforeExit=o.stage; o.stage='perdu'; o.lostAt=Date.now(); touchCrm(o); closeRenewalTask(o); });
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
      const steps=OPP_STAGES.filter(st=>st.phase===ph.key), idxs=steps.map(st=>stageIndex(st.key));
      const phState=allOut?'upcoming':idxs.some(i=>list.some(x=>stageIndex(x.stage)===i))?'current':Math.max(...idxs)<lo?'done':'upcoming';
      g.classList.add('ph-'+phState);
      const num=PIPE_PHASES.filter(p=>p.key!=='prequal').indexOf(ph)+1;
      const h=document.createElement('div'); h.className='opp-phase-h'; h.innerHTML='<span class="ph-dot"></span><span class="ph-name"></span>';
      h.firstChild.textContent=phState==='done'?'✓':String(num); h.lastChild.textContent=ph.label; g.appendChild(h);
      const bar=document.createElement('div'); bar.className='ph-bar';
      steps.forEach(st=>{ const i=stageIndex(st.key), seg=document.createElement('span'); seg.className=list.some(x=>x.stage===st.key)?'on':i<lo||phState==='done'?'done':''; bar.appendChild(seg); });
      g.appendChild(bar);
      steps.forEach(st=>{
        const i=stageIndex(st.key), n=list.filter(x=>x.stage===st.key).length;
        const row=document.createElement('button'); row.type='button';
        row.className='opp-stage-step '+(allOut?'upcoming':(n?'current':(i<lo?'done':'upcoming')));
        const cls=row.className.split(' ')[1];
        const eng=list.length && list.every(isEngageant), mixed=!eng && list.some(isEngageant);
        const lbl=st.key==='pricing_indicatif'?(eng?'Pricing engageant':mixed?'Pricing indicatif / engageant':st.label):st.key==='pricing_ferme' && eng?'Pricing ferme · inclus':st.label;
        if(st.key==='pricing_ferme' && eng && !n) row.classList.add('skipped');
        row.innerHTML='<span class="ost-mark">'+(cls==='done'?'✓':cls==='current'?'●':'')+'</span><span class="ost-l">'+escapeHtml(lbl)+'</span><span class="ost-m">'+(st.who!=='Com'?'<span class="ost-who">'+st.who+'</span>':'')+(list.length>1&&n?'<b class="ost-n">'+n+'</b>':'')+'</span>';
        row.title=list.length>1?'Placer les '+list.length+' installations à cette étape':'Placer l\u2019installation à cette étape';
        row.onclick=async()=>{ if(list.every(x=>x.stage===st.key)) return;
          // one step forward: at once; several steps at a time, or back: asked first (a click on the wrong line is easy)
          const from=lo<0?-1:lo, to=stageIndex(st.key), cur=OPP_STAGES[from];
          if(from>=0 && (to>from+1 || to<from)){
            const v=await askChoice(to<from?'Revenir en arrière ?':'Sauter des étapes ?', (list.length>1?list.length+' installations : ':'')+'de « '+(cur?cur.label:'')+' » à « '+st.label+' »'+(to>from+1?' ('+(to-from)+' étapes d\u2019un coup)':'')+'.', [{ label:to<from?'Revenir':'Avancer', value:'y' }]);
            if(v!=='y') return; }
          onPick(st.key); };
        g.appendChild(row);
      });
      track.appendChild(g);
    });
    return track;
  }
  let stageScopeAll=true;   // a stage chosen in an installation's sheet applies to all the installations of its request
  function setOppStage(o, key){
    const prev=stageIndex(o.stage), next=stageIndex(key), today=toISO(new Date());
    if(next>=stageIndex('pricing_indicatif') && !o.goDate){ o.goDate=today; o.qualification=true; }
    if(prev<=stageIndex('offre_remise') && next>stageIndex('offre_remise') && !o.dateOffre) o.dateOffre=today;
    if(prev<=stageIndex('signature') && next>stageIndex('signature') && !o.signDate) o.signDate=today;
    // the offer accepted (into the contract phase), then the contract signed: a little celebration
    if(prev>=0 && prev<stageIndex('kyc') && next>=stageIndex('kyc')) celebrate(next>stageIndex('signature')?'signed':'won', [o]);
    else if(prev>=0 && prev<=stageIndex('signature') && next>stageIndex('signature')) celebrate('signed', [o]);
    relanceOnMove(o, key);
    o.stage=key; touchCrm(o); saveCrm(); renderPipeline();
  }
  // Backlog decision 3: the offer goes out → « Relancer le producteur » is created alone, due in 7 days;
  // the deal moves on (accepted, refused, any other step) → that task disappears alone if it was not done.
  // A request's installations share one task, which goes once none of them is waiting any more.
  const RELANCE_DAYS=7;
  function relanceOnMove(o, key){
    if(!o || o.kind!=='installation' || o.stage===key) return;
    const req=o.requestId && opportunities.find(x=>x.id===o.requestId && !x.deleted), target=req||o;
    const open=()=>tasks.find(t=>!t.deleted && !t.archived && t.autoRelance && t.opportunityId===target.id);
    if(key==='offre_attente'){
      if(open()) return;
      const sibs=req?requestInstalls(req.id).filter(x=>!isExited(x)):[o];
      const t=createTask({ title:'Relancer le producteur sur l\u2019offre — '+(sibs.length>1?sibs.length+' installations':oppName(o)), client:o.company||'', due:pqAddDays(RELANCE_DAYS), urgency:'moyenne', status:'a_faire',
        description:'Créée seule quand l\u2019offre est partie ; elle disparaît seule quand le dossier avance.' });
      t.opportunityId=target.id; t.autoRelance=true; t.stageLabel=oppStage('offre_attente').label; touch(t); saveTasks(); render();
    } else if(o.stage==='offre_attente'){
      if(req && requestInstalls(req.id).some(x=>x.id!==o.id && x.stage==='offre_attente')) return;   // others still waiting on the same offer
      const t=open(); if(!t) return;
      t.deleted=true; touch(t); saveTasks(); render();
    }
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
    let n=OPP_STAGES[stageIndex(o.stage)+1]; if(n && n.key==='pricing_ferme' && isEngageant(o)) n=OPP_STAGES[stageIndex('pricing_ferme')+1];
    return n?n.key:null;
  };
  function offerStageAdvance(list, forcedKey, back){
    const moves=list.map(o=>({ o, key:nextStageKey(o, forcedKey) })).filter(m=>m.key);
    if(!moves.length) return;
    // the open tasks of the step being left (linked to these installations or their request): closed with the move, if ticked
    const linkIds=new Set(moves.flatMap(m=>[m.o.id, m.o.requestId].filter(Boolean)));
    const oldTasks=tasks.filter(t=>!t.deleted && !t.archived && t.opportunityId && linkIds.has(t.opportunityId));
    pendingAdvance={ moves:moves.map(m=>({ id:m.o.id, key:m.key })), closeIds:oldTasks.map(t=>t.id), back };
    $('stage-close-row').hidden=!oldTasks.length; $('stage-close-tasks').checked=true;
    $('stage-close-text').textContent=oldTasks.length===1?'Clore « '+plainLinks(oldTasks[0].title)+' »':'Clore les '+oldTasks.length+' tâches en cours de ce dossier';
    const o=moves[0].o, next=oppStage(moves[0].key);
    const same=moves.every(m=>m.key===moves[0].key && m.o.stage===o.stage);
    const label=moves.length>1?moves.length+' installations ('+o.company+')':'« '+o.company+' — '+oppName(o)+' »';
    $('stage-advance-text').textContent=same
      ? label+' : passer de « '+stageLabel(o.stage, o)+' » à « '+next.label+' »'+(next.who!=='Com'?' (porté par '+(WHO[next.who]||next.who)+', la tâche sera « en attente »)':'')+' ?'
      : label+' : chaque installation passe à son étape suivante ('+moves.map(m=>oppName(m.o)+' → '+oppStage(m.key).label).join(', ')+') ?';
    $('stage-advance-nogo').classList.toggle('hidden', !moves.every(m=>m.o.stage==='qualif_en_cours'));
    $('stage-create-task').checked=true; $('stage-due').value=next.who!=='Com'?pqAddDays(7):''; $('stage-urgency').value='moyenne'; $('stage-due-row').style.display='flex';
    const autoRel=moves.every(m=>m.key==='offre_attente');   // the follow-up task is made alone (relanceOnMove): nothing to choose here
    $('stage-create-task').closest('.crm-form-row').style.display=autoRel?'none':''; if(autoRel){ $('stage-due-row').style.display='none'; $('stage-advance-text').textContent+=' La tâche « Relancer le producteur » se crée seule, pour dans '+RELANCE_DAYS+' jours, et disparaît dès que le dossier avance.'; }
    $('stage-advance-overlay').classList.remove('hidden');
  }
  function confirmStageAdvance(){
    if(!pendingAdvance){ closeStageAdvance(); return; }
    const moves=pendingAdvance.moves.map(m=>({ o:opportunities.find(x=>x.id===m.id), key:m.key })).filter(m=>m.o);
    moves.forEach(m=>setOppStage(m.o, m.key));
    const list=moves.map(m=>m.o);
    if($('stage-close-tasks').checked && pendingAdvance.closeIds && pendingAdvance.closeIds.length){
      pendingAdvance.closeIds.forEach(id=>{ const t=tasks.find(x=>x.id===id); if(t && !t.archived){ t.archived=true; t.archivedAt=Date.now(); touch(t); } });
      saveTasks(); renderArchive(); }
    if($('stage-create-task').checked && moves.length){
      // one task per target stage; grouped installations of a request share it
      const byKey=new Map(); moves.forEach(m=>{ if(!byKey.has(m.key)) byKey.set(m.key,[]); byKey.get(m.key).push(m.o); });
      byKey.forEach((group,key)=>{
        const req=group.length>1 && group[0].requestId ? opportunities.find(x=>x.id===group[0].requestId) : null;
        const target=req||group[0];
        const s=oppStage(key), other=s.who!=='Com';
        if(key==='offre_attente' && tasks.some(t=>!t.deleted && !t.archived && t.autoRelance && t.opportunityId===target.id)) return;
        const task=createTask({ title:stageTaskOf(s, group[0])+' — '+(req?group.length+' installations':oppName(group[0])), client:group[0].company, due:$('stage-due').value, urgency:$('stage-urgency').value, status:other?'en_attente':'a_faire', description:other?'À suivre : étape portée par '+s.who+'.':'' });
        task.opportunityId=target.id; task.stageLabel=s.label; touch(task); saveTasks();
        target.taskId=task.id; touchCrm(target);
      });
    }
    const back=closeStageAdvance(); saveCrm(); render(); renderPipeline();
    if(moves.some(m=>m.key==='pricing_indicatif')){ const reqId=list[0].requestId; if(reqId) openRequestDetail(reqId, list.map(x=>x.id)); else openOppDetail(list[0].id); }
    else if(back) back();   // started from a sheet: back to it, on the new step
  }
  function noGoFromAdvance(){
    if(!pendingAdvance) return;
    pendingAdvance.moves.map(m=>opportunities.find(x=>x.id===m.id)).filter(Boolean).forEach(o=>{ relanceOnMove(o, null); o.stageBeforeExit=o.stage; o.stage='no_go'; o.lostAt=Date.now(); touchCrm(o); });
    const back=closeStageAdvance(); saveCrm(); renderPipeline(); if(back) back();
  }
  // returns the way back to the sheet the move was started from (if any)
  function closeStageAdvance(){ const back=pendingAdvance && pendingAdvance.back; $('stage-advance-overlay').classList.add('hidden'); pendingAdvance=null; return back||null; }
  function cancelStageAdvance(){ const back=closeStageAdvance(); if(back) back(); }

  // ----- Pricing requests (several installations, one mail) -----
  // « Maintenant » : what the current step asks for, with the dates that matter at that step
  // ---------- « Étape en cours » : the step, who has it and since when, its checklist, one button to move on ----------
  const WHO={ Com:'À moi', Ops:'Ops', Jur:'Juridique', Client:'Client', Dir:'Direction' };
  function daysInStage(o){ const log=(o.stageLog||[]).filter(e=>e && e.stage===o.stage && e.at>1e12); const t=log.length?log[log.length-1].at:(o.updatedAt>1e12?o.updatedAt:0); return t?Math.max(0,Math.floor((Date.now()-t)/864e5)):null; }
  const reqMissing=list=>list.reduce((s,x)=>s+CARACT_ROWS.filter(l=>REQ_NEEDED.has(caractKey(l)) && caractValue(x,l)==='').length,0);
  // each step's checklist. auto: known by the app (ticked by itself) · date: a date of the sheet, typed right there
  // (ticking it puts today) · act: a button doing the thing next to it · else ticked by hand, with the day it was ticked
  const sheetBody=()=>$('opp-detail-body');
  const openCompare=()=>{ const d=sheetBody().querySelector('details.req-compare'); if(d){ d.open=true; d.scrollIntoView({ block:'start', behavior:'smooth' }); } };
  const reqOfList=l=>{ const id=l[0] && l[0].requestId; return (id && opportunities.find(x=>x.id===id)) || { company:l[0]?l[0].company:'' }; };
  const STEP_CHECKS={
    a_qualifier:[{ id:'contact', label:'Contact principal renseigné', auto:l=>l.every(o=>o.prenom||o.nom||o.mail||o.tel) },{ id:'appel', label:'Premier appel fait' }],
    prise_contact:[{ id:'rdv1', label:'RDV 1', date:'rdv1' }],
    collecte:[{ id:'oblig', label:'Infos obligatoires complètes', auto:l=>!reqMissing(l), note:l=>{ const n=reqMissing(l); return n?n+' case'+(n>1?'s':'')+' à compléter':''; }, act:{ label:'Compléter', show:l=>reqMissing(l)>0, fn:()=>openCompare(), stay:true } },
      { id:'fichier', label:'Fichier Caractéristiques reçu du producteur', auto:l=>l.every(o=>o.caract && Object.keys(o.caract).length) }],
    qualif_en_cours:[{ id:'rdv2', label:'RDV 2', date:'rdv2' },{ id:'decision', label:'Décision Go / No Go prise' }],
    pricing_indicatif:[{ id:'mail', label:'Mail de demande envoyé', auto:l=>l.every(o=>o.mailSentAt), act:{ label:'Copier le mail', show:l=>!l.every(o=>o.mailSentAt), fn:(l,btn)=>{ const ml=pricingMail(reqOfList(l), l); copyToClipboard(ml.subject+'\n\n'+ml.body, btn); markMailSent(l); } } },
      { id:'caract', label:'Fichier Caractéristiques joint', auto:l=>l.every(o=>o.caractSentAt), act:{ label:'Créer le fichier', show:l=>!l.every(o=>o.caractSentAt), fn:(l,btn)=>downloadCaract(l, btn) } },
      { id:'ops', label:'Retour d’Ops reçu' },{ id:'prix', label:'Prix noté dans la fiche' }],
    offre_remise:[{ id:'prete', label:'Offre préparée' },{ id:'envoyee', label:'Offre remise au producteur', date:'dateOffre' }],
    offre_attente:[{ id:'relance', label:'Relance faite', note:l=>{ const t=pqDateOf(l[0].dateOffre); if(!t) return ''; const n=Math.floor((Date.now()-t)/864e5); return n>0?'offre remise il y a '+n+' jour'+(n>1?'s':''):''; } },{ id:'reponse', label:'Réponse du producteur reçue' }],
    kyc:[{ id:'docs', label:'Documents KYC reçus' },{ id:'solva', label:'Solvabilité validée (Juridique)' }],
    negociation:[{ id:'points', label:'Points de négociation réglés' }],
    pricing_ferme:[{ id:'ferme', label:'Prix ferme reçu d’Ops' }],
    mise_signature:[{ id:'docusign', label:'DocuSign envoyé' }],
    signature:[{ id:'selfee', label:'Signé par Selfee' },{ id:'prod', label:'Signé par le producteur' }],
    actif:[{ id:'valo', label:'Valorisation démarrée', auto:()=>true }]
  };
  function stepChecklist(list, stage){
    if(stage==='onboarding') return ONBOARDING_STEPS.map(stp=>({ id:'onb_'+stp.k, label:stp.label, who:stp.who, done:list.every(o=>o['onb_'+stp.k]), auto:false, onb:true }));
    return (STEP_CHECKS[stage]||[]).map(c=>{
      const at=list.map(o=>o.checks && o.checks[stage] && o.checks[stage][c.id]);
      // an « auto » line the app knows can still be ticked (or unticked) by hand: the hand wins
      const hand=at.every(v=>v!=null && v!==undefined)?(at.every(v=>v===false)?false:at.every(Boolean)?true:null):null;
      const done=c.auto?(hand!=null?hand:!!c.auto(list)):c.date?list.every(o=>o[c.date]):at.every(Boolean);
      const when=!c.date && done && at.every(v=>typeof v==='number')?Math.max(...at):null;
      return { id:c.id, label:c.label, auto:!!c.auto, date:c.date||null, act:c.act && (!c.act.show || c.act.show(list))?c.act:null, note:c.note?c.note(list):'', done, when };
    });
  }
  function toggleCheck(list, stage, item, on){
    const today=toISO(new Date());
    list.forEach(o=>{ if(item.onb) o[item.id]=on;
      else if(item.date){ if(on){ if(!o[item.date]) o[item.date]=today; } else o[item.date]=''; }
      else { o.checks=Object.assign({}, o.checks||{}); o.checks[stage]=Object.assign({}, o.checks[stage]||{}, { [item.id]:on?Date.now():false }); }
      touchCrm(o); });
    saveCrm();
  }
  function buildStepPanel(list, opts){
    opts=opts||{};
    const live=list.filter(x=>!isExited(x)), reopen=opts.reopen||(()=>{});
    const wrap=document.createElement('div'); wrap.className='step-panel';
    const main=document.createElement('section'); main.className='sp-main'; wrap.appendChild(main);
    if(!live.length){
      const o=list[0]; main.innerHTML='<div class="sp-k">Sorti du pipeline</div><div class="sp-title"></div>'; main.querySelector('.sp-title').textContent=stageLabel(o.stage, o)+(o.lostAt?' le '+new Date(o.lostAt).toLocaleDateString('fr-FR'):'');
      if(!window.TODO_LITE){ const r=document.createElement('button'); r.type='button'; r.className='sp-next'; r.textContent='Réactiver'; r.onclick=()=>{ list.forEach(x=>{ x.stage=x.stageBeforeExit||'a_qualifier'; x.lostAt=null; touchCrm(x); }); saveCrm(); renderPipeline(); reopen(); }; main.appendChild(r); }
      return wrap; }
    const lo=Math.min(...live.map(x=>stageIndex(x.stage)).filter(i=>i>=0)), st=OPP_STAGES[lo]||OPP_STAGES[0], same=live.every(x=>x.stage===live[0].stage), first=live.find(x=>x.stage===st.key)||live[0];
    const days=daysInStage(first);
    // header: step, since when, who
    const k=document.createElement('div'); k.className='sp-k';
    k.innerHTML='<span>Étape en cours</span><span class="sp-meta"></span>';
    k.querySelector('.sp-meta').textContent=[days!=null?'depuis '+(days===0?'aujourd’hui':days+' jour'+(days>1?'s':'')):'', st.who!=='Com'?'porté par '+(WHO[st.who]||st.who):''].filter(Boolean).join(' · ');
    main.appendChild(k);
    const t=document.createElement('div'); t.className='sp-title'; t.textContent=same?stageLabel(st.key, first):live.length+' installations à des étapes différentes'; main.appendChild(t);
    if(days!=null && days>15) t.classList.add('late');
    // offer asked: indicative or engageante (from the qualification to the offer)
    if(!window.TODO_LITE && lo>=stageIndex('qualif_en_cours') && lo<=stageIndex('offre_attente')){
      const eng=live.every(isEngageant), sw=document.createElement('div'); sw.className='sf-nature'; sw.innerHTML='<span>Offre demandée :</span>';
      [['Non engageante','Indicative'],['Engageante','Engageante']].forEach(([v,l])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=l; b.classList.toggle('on', (v==='Engageante')===eng);
        b.onclick=()=>{ live.forEach(x=>{ if(x.nature!==v){ x.nature=v; touchCrm(x); } }); saveCrm(); renderPipeline(); reopen(); }; sw.appendChild(b); });
      main.appendChild(sw); }
    // the checklist
    if(same){ const items=stepChecklist(live, st.key);
      if(items.length){ const ul=document.createElement('div'); ul.className='sp-checks';
        items.forEach(it=>{ const row=document.createElement('div'); row.className='sp-check'+(it.done?' done':'');
          const lab=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=it.done; cb.disabled=!!window.TODO_LITE;
          cb.onchange=()=>{ toggleCheck(live, st.key, it, cb.checked); renderPipeline(); reopen(); }; const sp=document.createElement('span'); sp.textContent=it.label; lab.append(cb, sp); row.appendChild(lab);
          if(it.who && it.who!=='Com'){ const w=document.createElement('em'); w.textContent=WHO[it.who]||it.who; sp.appendChild(w); }
          if(it.date){ const di=document.createElement('input'); di.type='date'; di.className='sp-date'; di.value=first[it.date]||''; di.disabled=!!window.TODO_LITE; di.setAttribute('aria-label', it.label+' (date)');
            di.onchange=()=>{ live.forEach(o=>{ o[it.date]=di.value; touchCrm(o); }); saveCrm(); renderPipeline(); reopen(); }; row.appendChild(di); }
          const info=it.when?'le '+new Date(it.when).toLocaleDateString('fr-FR',{ day:'2-digit', month:'2-digit' }):it.auto && it.done?'fait':it.note||'';
          if(info){ const m=document.createElement('small'); m.className='sp-info'; m.textContent=info; row.appendChild(m); }
          if(it.act && !window.TODO_LITE){ const ab=document.createElement('button'); ab.type='button'; ab.className='sp-act'; ab.textContent=it.act.label; ab.onclick=()=>{ Promise.resolve(it.act.fn(live, ab)).then(()=>{ if(it.act.stay) return; setTimeout(()=>{ if(!ab.isConnected || $('opp-detail-overlay').classList.contains('hidden')) return; renderPipeline(); reopen(); }, 900); }); }; row.appendChild(ab); }
          ul.appendChild(row); });
        main.appendChild(ul);
        const left=items.filter(i=>!i.done).length;
        if(left){ const n=document.createElement('div'); n.className='sp-note'; n.textContent=left+' point'+(left>1?'s restent':' reste')+' à cocher — le bouton marche quand même.'; main.appendChild(n); } } }
    // one button to move on, the way out next to it
    if(!window.TODO_LITE){
      const row=document.createElement('div'); row.className='sp-actions';
      const btn=(label, cls, fn)=>{ const b=document.createElement('button'); b.type='button'; b.className=cls; b.textContent=label; b.onclick=fn; row.appendChild(b); return b; };
      const nextKey=nextStageKey(first), next=nextKey?oppStage(nextKey):null;
      if(!same) btn('→ Avancer chaque installation', 'sp-next', ()=>{ closeOppDetail(); offerStageAdvance(live, null, reopen); });
      else if(st.key==='qualif_en_cours'){ btn('Go → Pricing', 'sp-next', ()=>{ closeOppDetail(); offerStageAdvance(live, 'pricing_indicatif', reopen); }); btn('No Go', 'sp-alt', ()=>exitList(live,'no_go')); }
      else if(st.key==='offre_attente'){ btn('Offre acceptée → KYC', 'sp-next', ()=>{ closeOppDetail(); offerStageAdvance(live, 'kyc', reopen); }); btn('Offre refusée', 'sp-alt', ()=>loseOpps(live)); }
      else { if(next) btn('→ Passer à « '+stageLabel(next.key, first)+' »', 'sp-next', ()=>{ closeOppDetail(); offerStageAdvance(live, null, reopen); });
        if(lo>=stageIndex('pricing_indicatif')) btn('Perdu', 'sp-alt', ()=>loseOpps(live)); else btn('Abandonner', 'sp-alt', ()=>exitList(live,'abandonne')); }
      main.appendChild(row);
      if(!ON_PHONE){ const kh=document.createElement('div'); kh.className='sp-keys'; const nk=Math.min(9, main.querySelectorAll('.sp-checks input[type=checkbox]').length); kh.innerHTML='<kbd>Entrée</kbd> passer à la suite'+(nk?' · <kbd>1</kbd>'+(nk>1?'…<kbd>'+nk+'</kbd>':'')+' cocher':'')+' · <kbd>n</kbd> noter · <kbd>a</kbd> appel'; main.appendChild(kh); }
      if(opts.scope){ main.appendChild(opts.scope); }
    }
    // the side: next task, contact, key figures
    const side=document.createElement('aside'); side.className='sp-side'; wrap.appendChild(side);
    const box=(title)=>{ const b=document.createElement('div'); b.className='sp-box'; const h=document.createElement('div'); h.className='sp-k'; h.textContent=title; b.appendChild(h); side.appendChild(b); return b; };
    const ids=new Set(list.flatMap(x=>[x.id, x.requestId].filter(Boolean)));
    const tk=activeTasks().filter(x=>x.opportunityId && ids.has(x.opportunityId)).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'))[0];
    { const b=box('Prochaine tâche'); const d=document.createElement('div'); d.className='sp-big'; d.textContent=tk?plainLinks(tk.title):'Aucune tâche liée'; b.appendChild(d);
      if(tk){ const m=document.createElement('div'); m.className='sp-sub'+(tk.status==='en_attente'?' wait':''); m.textContent=[tk.status==='en_attente'?'En attente':'', tk.due?'pour le '+pqIsoToFr(tk.due):''].filter(Boolean).join(' · '); b.appendChild(m);
        b.classList.add('click'); b.onclick=()=>{ closeOppDetail(); openTaskEverywhere(tk.id); }; } }
    { const o=first, mail=(o.mail||'').toLowerCase(), crm=mail && contacts.find(c=>!c.deleted && (c.email||'').toLowerCase()===mail);
      const name=[o.prenom,(o.nom||'')].filter(Boolean).join(' ')||(crm?[crm.firstName,crm.lastName].filter(Boolean).join(' '):''), tel=o.tel||(crm?crm.phone1:''), role=o.qualite||(crm&&crm.role)||'';
      const b=box('Contact'); const d=document.createElement('div'); d.className='sp-big'; d.textContent=[name, role].filter(Boolean).join(' · ')||'Aucun contact sur la fiche'; b.appendChild(d);
      if(tel){ const a=document.createElement('a'); a.className='os-link'; a.href='tel:'+tel.replace(/[^\d+]/g,''); a.textContent=tel; b.appendChild(a); }
      if(mail){ const a=document.createElement('a'); a.className='os-link'; a.href='mailto:'+mail; a.textContent=mail; b.appendChild(a); }
      if(!window.TODO_LITE){ const c=document.createElement('button'); c.type='button'; c.className='sp-call'; c.textContent='Mode appel'; c.title='Un écran pour l\u2019appel : ce qu\u2019il faut demander, tes notes, les chiffres repérés au vol'; c.onclick=()=>openCallMode(list, reopen); b.appendChild(c); } }
    { const kw=live.reduce((s2,x)=>s2+kwcNum(x),0), mwh=live.reduce((s2,x)=>s2+(pqNum(String(x.mwh||''))||0),0), b=box('Chiffres'); const g=document.createElement('div'); g.className='sp-figs';
      [['Puissance',kw?fmtKwc(kw):'—'],['P50',mwh?Math.round(mwh).toLocaleString('fr-FR')+' MWh':'—'],['Contrat',[first.contrat, first.duree?first.duree+' ans':''].filter(Boolean).join(' · ')||'—']].forEach(([l,v])=>{ const c=document.createElement('div'); c.innerHTML='<span></span><b></b>'; c.firstChild.textContent=l; c.lastChild.textContent=v; g.appendChild(c); });
      b.appendChild(g); }
    return wrap;
  }
  // a folded section of the sheet (open when the step needs it)
  function sheetSection(title, sub, open, content){
    const d=document.createElement('details'); d.className='sheet-sec'; d.open=!!open;
    const s2=document.createElement('summary'); s2.innerHTML='<b></b><span></span>'; s2.firstChild.textContent=title; s2.lastChild.textContent=sub||''; d.appendChild(s2);
    if(content) d.appendChild(content); return d;
  }
  // ---------- Doublons : the same plant entered twice, the same company written two ways ----------
  const DUP_LEGAL=/\b(sas|sasu|sarl|sa|scea|earl|gaec|sci|eurl|snc|sem|spl|scic|cuma|selarl|ste|societe|groupe|holding|et|the|la|le|les|l|de|du|des|d)\b/g;
  const coDupKey=n=>pqFold(n).replace(/[^a-z0-9 ]/g,' ').replace(DUP_LEGAL,' ').replace(/[^a-z0-9]/g,'');
  const instDupKey=o=>{ const n=pqFold(oppName(o)).replace(/[^a-z0-9 ]/g,' ').replace(/\b(centrale|centrales|cs|parc|projet|pv|photovoltaique|solaire|toit|toiture|de|du|des|la|le|les|l|d)\b/g,' ').replace(/[^a-z0-9]/g,'');
    const full=pqFold(oppName(o)).replace(/[^a-z0-9]/g,'');   // « Toit A » / « Toit B » : too short once the usual words are gone, the whole name decides
    const k=n.length>=3?n:full.length>=3?full:''; return k?coDupKey(o.company||'')+'|'+k:null; };
  function dupIgnored(){ try{ return JSON.parse(localStorage.getItem('dup-ignore')||'[]'); }catch(e){ return []; } }
  function dupIgnore(sig){ const l=dupIgnored(); if(!l.includes(sig)){ l.push(sig); try{ localStorage.setItem('dup-ignore', JSON.stringify(l)); }catch(e){} } }
  function instDupGroups(){
    const by=new Map(); opportunities.filter(o=>!o.deleted && o.kind==='installation').forEach(o=>{ const k=instDupKey(o); if(!k) return; (by.get(k)||by.set(k,[]).get(k)).push(o); });
    return [...by.values()].filter(g=>g.length>1 && !g.every(x=>(x.notDupOf||[]).length && g.every(y=>y===x || (x.notDupOf||[]).includes(y.id))))
      .map(g=>g.sort((a,b)=>stageIndex(b.stage)-stageIndex(a.stage) || (b.updatedAt||0)-(a.updatedAt||0)));
  }
  function coDupGroups(){
    const names=new Map(), add=n=>{ n=String(n||'').trim(); if(!n) return; names.set(n,(names.get(n)||0)+1); };
    companies.filter(c=>!c.deleted).forEach(c=>add(c.name)); opportunities.filter(o=>!o.deleted).forEach(o=>add(o.company)); contacts.filter(c=>!c.deleted).forEach(c=>add(c.company)); clientsList.forEach(add);
    const by=new Map(); [...names.keys()].forEach(n=>{ const k=coDupKey(n); if(k.length<3) return; (by.get(k)||by.set(k,[]).get(k)).push(n); });
    const ign=dupIgnored();
    return [...by.values()].filter(g=>g.length>1 && !ign.includes('co:'+g.slice().sort().join('|'))).map(g=>g.sort((a,b)=>(names.get(b)-names.get(a)) || a.localeCompare(b)));
  }
  function dupCount(){ return instDupGroups().length+coDupGroups().length; }
  // the plant kept takes what the others knew and it did not, their tasks, notes and request
  function mergeInstallations(keep, others){
    others.forEach(x=>{
      // where the plant sits (request, lot, step, exit) stays the kept one's; a plant on its own joins the other's request
      Object.keys(x).forEach(k=>{ if(['id','createdAt','updatedAt','deleted','stage','stageLog','kind','notesLog','notDupOf','checks','lot','requestId','taskId','lostAt','stageBeforeExit'].includes(k)) return; if((keep[k]==null || keep[k]==='') && x[k]!=null && x[k]!=='') keep[k]=x[k]; });
      if(!keep.requestId && x.requestId && opportunities.some(r=>r.id===x.requestId && !r.deleted)){ keep.requestId=x.requestId; keep.lot=x.lot||''; }
      if((x.notesLog||[]).length) keep.notesLog=(keep.notesLog||[]).concat(x.notesLog).sort((a,b)=>a.at-b.at);
      if(x.createdAt && (!keep.createdAt || x.createdAt<keep.createdAt)) keep.createdAt=x.createdAt;
      tasks.forEach(t=>{ if(t.opportunityId===x.id){ t.opportunityId=keep.id; touch(t); } });
      x.deleted=true; touchCrm(x); });
    touchCrm(keep); saveTasks(); saveCrm(); renderPipeline(); render();
  }
  // duplicates are serious (MWc counted twice, two lines in the Pipe): a banner at the top of every page while there are some (backlog decision 10)
  function paintDupBanner(){ const el=$('dup-banner'); if(!el) return; if(window.TODO_WIDGET || window.TODO_LITE){ el.hidden=true; return; }
    let ig=0, cg=0; try{ ig=instDupGroups().length; cg=coDupGroups().length; }catch(e){ softFail('recherche des doublons', e); }
    el.hidden=!(ig+cg); if(!(ig+cg)) return;
    $('dup-banner-text').textContent='Doublons possibles : '+[ig?ig+' installation'+(ig>1?'s':'')+' saisie'+(ig>1?'s':'')+' deux fois':'', cg?cg+' société'+(cg>1?'s':'')+' écrite'+(cg>1?'s':'')+' de deux façons':''].filter(Boolean).join(', ')+'. Les totaux peuvent être faussés.'; }
  function paintDupBtn(){ const bar=document.querySelector('#tab-pipeline .quick-add-bar'); if(!bar || window.TODO_LITE) return; let b=$('pipe-dup-btn');
    const n=dupCount(); if(!n){ if(b) b.hidden=true; return; }
    if(!b){ b=document.createElement('button'); b.type='button'; b.id='pipe-dup-btn'; b.className='pipe-bar-btn pipe-dup-btn'; b.title='Même installation saisie deux fois, même société écrite de deux façons'; b.onclick=()=>openDupes(); bar.insertBefore(b, $('pipe-exited-toggle')); }
    b.hidden=false; b.textContent='Doublons · '+n; }
  function openDupes(){
    let ov=$('dup-overlay'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='dup-overlay'; ov.className='modal-overlay';
    ov.innerHTML='<div class="modal-box wide dup-box" role="dialog" aria-labelledby="dup-title"><div class="opp-detail-head"><h3 id="dup-title">Doublons</h3></div><div class="dup-body"></div><div class="crm-form-actions"><button type="button" class="ghost-btn dup-close">Fermer</button></div></div>';
    document.body.appendChild(ov);
    const close=()=>{ ov.remove(); renderPipeline(); paintDupBanner(); };
    ov.querySelector('.dup-close').onclick=close; ov.addEventListener('click', e=>{ if(e.target===ov) close(); }); ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } });
    const paint=()=>{ const body=ov.querySelector('.dup-body'); body.innerHTML='';
      const ig=instDupGroups(), cg=coDupGroups(), ctg=contactDupGroups();
      if(!ig.length && !cg.length){ const p=document.createElement('p'); p.className='modal-hint'; p.textContent='Aucune installation ni société en double.'; body.appendChild(p); }
      if(cg.length){ const h=document.createElement('h4'); h.className='dup-h'; h.textContent='Sociétés écrites de plusieurs façons · '+cg.length; body.appendChild(h);
        cg.forEach((g,gi)=>{ const sec=document.createElement('section'); sec.className='dup-group';
          g.forEach((n,i)=>{ const l=document.createElement('label'); l.className='dup-row'; const nb=opportunities.filter(o=>!o.deleted && o.company===n).length+contacts.filter(c=>!c.deleted && c.company===n).length+tasks.filter(t=>!t.deleted && t.client===n).length;
            l.innerHTML='<input type="radio" name="dupc'+gi+'"><b></b><span></span>'; l.querySelector('input').checked=i===0; l.querySelector('input').value=n; l.querySelector('b').textContent=n; l.querySelector('span').textContent=nb+' fiche'+(nb>1?'s':'')+' et tâche'+(nb>1?'s':''); sec.appendChild(l); });
          const acts=document.createElement('div'); acts.className='dup-acts';
          const m=document.createElement('button'); m.type='button'; m.className='dup-merge'; m.textContent='Garder le nom coché, fusionner';
          m.onclick=()=>{ const keep=sec.querySelector('input:checked').value; g.filter(n=>n!==keep).forEach(n=>mergeCompanyInto(n, keep)); paint(); };
          const no=document.createElement('button'); no.type='button'; no.className='ghost-btn'; no.textContent='Ce sont deux sociétés différentes'; no.onclick=()=>{ dupIgnore('co:'+g.slice().sort().join('|')); paint(); };
          acts.append(m, no); sec.appendChild(acts); body.appendChild(sec); }); }
      if(ig.length){ const h=document.createElement('h4'); h.className='dup-h'; h.textContent='Installations saisies deux fois · '+ig.length; body.appendChild(h);
        ig.forEach((g,gi)=>{ const sec=document.createElement('section'); sec.className='dup-group';
          g.forEach((o,i)=>{ const l=document.createElement('label'); l.className='dup-row'; l.innerHTML='<input type="radio" name="dupi'+gi+'"><b></b><span></span>'; l.querySelector('input').checked=i===0; l.querySelector('input').value=o.id;
            l.querySelector('b').textContent=(o.company||'')+' — '+oppName(o); l.querySelector('span').textContent=[stageLabel(o.stage, o), fmtKwc(o.kwc), mwhText(o.mwh), o.createdAt>1e12?'créée le '+new Date(o.createdAt).toLocaleDateString('fr-FR'):''].filter(Boolean).join(' · ');
            sec.appendChild(l); });
          const acts=document.createElement('div'); acts.className='dup-acts';
          const m=document.createElement('button'); m.type='button'; m.className='dup-merge'; m.textContent='Garder celle cochée, fusionner';
          m.title='Celle gardée reprend ce que les autres savaient en plus (cases vides), leurs tâches et leurs notes ; les autres disparaissent';
          m.onclick=()=>{ const id=sec.querySelector('input:checked').value, keep=g.find(o=>o.id===id); mergeInstallations(keep, g.filter(o=>o!==keep)); paint(); };
          const no=document.createElement('button'); no.type='button'; no.className='ghost-btn'; no.textContent='Ce sont des centrales différentes';
          no.onclick=()=>{ g.forEach(o=>{ o.notDupOf=[...new Set((o.notDupOf||[]).concat(g.filter(x=>x!==o).map(x=>x.id)))]; touchCrm(o); }); saveCrm(); paint(); };
          acts.append(m, no); sec.appendChild(acts); body.appendChild(sec); }); }
      if(ctg.length){ const p=document.createElement('p'); p.className='modal-hint dup-ct'; p.innerHTML='<span></span> <button type="button" class="pq-link">Vérifier les contacts</button>'; p.firstChild.textContent=ctg.length+' contact'+(ctg.length>1?'s':'')+' en double possible'+(ctg.length>1?'s':'')+'.'; p.querySelector('button').onclick=()=>{ close(); openContactMerge(); }; body.appendChild(p); }
    };
    paint();
  }
  // ---------- « Compléter avec l'IA » : Claude proposes the empty lines of the characteristics file that follow from what the sheet knows ----------
  // Its key stays on this device (like the GitHub token); without one, the request is copied for claude.ai and the answer pasted back.
  const AI_MODEL='claude-sonnet-5-5';
  // set aside for now (2026-10-23): hidden unless turned on for this device (localStorage feat-ai = 1)
  const aiOn=()=>{ try{ return localStorage.getItem('feat-ai')==='1'; }catch(e){ return false; } };
  const aiKey=()=>{ try{ return localStorage.getItem('ai-key')||''; }catch(e){ return ''; } };
  try{ if(localStorage.getItem('feat-ai')!=='1') localStorage.removeItem('ai-key'); }catch(e){}   // AI set aside: no Claude key kept on the device meanwhile (audit A16)
  function aiPrompt(list){
    const plants=list.map(o=>{ const known={}, empty=[];
      CARACT_ROWS.forEach(l=>{ const v=caractValue(o,l); if(v!=='' && v!=null) known[l]=String(v); else empty.push(l); });
      ['commune','cp','dept','region','particularites','install','contrat'].forEach(k=>{ if(o[k] && !Object.values(known).includes(String(o[k]))) known[k]=String(o[k]); });
      known['Producteur']=o.producteur||o.company||'';
      return { id:o.id, connu:known, a_completer:empty }; });
    return ['Tu aides à remplir le fichier « Caractéristiques Centrales » de centrales électriques (photovoltaïque, éolien…) en France, pour une demande de prix d’agrégation.',
      'Pour chaque centrale ci-dessous, propose une valeur UNIQUEMENT pour les lignes de « a_completer » qui se déduisent de façon fiable de ce qui est « connu » ou d’une connaissance publique générale :',
      'coordonnées (latitude, longitude en degrés décimaux) et altitude (m) de la commune, département et région, productible typique (kWh/kWc/an) selon le lieu et la techno, P90 ≈ 93 % du P50 si le P50 est connu, nature du projet d’après les particularités, etc.',
      'N’invente JAMAIS un identifiant ou un fait propre au projet (SIRET, nom de SPV, numéro de raccordement, puissance de raccordement, nombre d’onduleurs, dates) : laisse-les de côté.',
      'Réponds UNIQUEMENT par un objet JSON, sans texte autour, de la forme :',
      '{"<id>": {"<libellé exact de la ligne>": {"v": "<valeur>", "c": "sûr" ou "probable", "s": "<d’où vient la valeur, en quelques mots>"}}}',
      'Garde les libellés exactement comme dans « a_completer ». Nombres au format français (virgule décimale) sans unité.',
      '', JSON.stringify(plants, null, 1)].join('\n');
  }
  function aiParse(text, list){
    let t=String(text||'').replace(/```(?:json)?/gi,''); const a=t.indexOf('{'), b=t.lastIndexOf('}'); if(a<0 || b<=a) throw new Error('Pas de JSON dans la réponse.');
    const data=JSON.parse(t.slice(a, b+1)), rows=[];
    list.forEach(o=>{ const d=data[o.id]; if(!d || typeof d!=='object') return;
      Object.entries(d).forEach(([label, x])=>{ const l=CARACT_ROWS.find(r=>caractKey(r)===caractKey(label)); if(!l) return;
        const v=x && typeof x==='object'?x.v:x; if(v==null || String(v).trim()==='' || caractValue(o,l)!=='') return;   // only empty lines, never over what is there
        rows.push({ o, l, v:String(v).trim(), c:x && x.c||'', s:x && x.s||'' }); }); });
    return rows;
  }
  async function aiAsk(prompt){
    const r=await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{ 'content-type':'application/json', 'x-api-key':aiKey(), 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
      body:JSON.stringify({ model:AI_MODEL, max_tokens:4000, messages:[{ role:'user', content:prompt }] }) });
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(r.status===401?'Clé Claude refusée (Réf. & data).':(j.error && j.error.message)||('Erreur '+r.status));
    return (j.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
  }
  function openAiFill(list, done){
    if(!list.length) return;
    let ov=$('ai-overlay'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='ai-overlay'; ov.className='modal-overlay';
    ov.innerHTML='<div class="modal-box wide ai-box" role="dialog" aria-labelledby="ai-title"><div class="opp-detail-head"><h3 id="ai-title">Compléter avec l’IA</h3></div><p class="modal-hint ai-hint"></p><div class="ai-ask"></div><div class="ai-rows"></div><div class="crm-form-actions"><button type="button" class="ai-fill" hidden></button><button type="button" class="ghost-btn ai-close">Fermer</button></div></div>';
    document.body.appendChild(ov);
    const close=()=>ov.remove();
    ov.querySelector('.ai-close').onclick=close; ov.addEventListener('click', e=>{ if(e.target===ov) close(); }); ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } });
    const prompt=aiPrompt(list), empties=list.reduce((n,o)=>n+CARACT_ROWS.filter(l=>caractValue(o,l)==='').length,0);
    ov.querySelector('.ai-hint').textContent=empties+' case'+(empties>1?'s':'')+' vide'+(empties>1?'s':'')+' sur '+list.length+' installation'+(list.length>1?'s':'')+'. Claude ne propose que ce qui se déduit de la fiche (lieu, techno, production) et n’invente aucun identifiant ; rien n’est rempli sans ton accord.';
    const ask=ov.querySelector('.ai-ask'), rowsBox=ov.querySelector('.ai-rows'), fill=ov.querySelector('.ai-fill');
    let rows=[];
    const show=r=>{ rows=r; rowsBox.innerHTML='';
      if(!rows.length){ rowsBox.innerHTML='<p class="modal-hint">Rien à proposer de fiable pour les cases vides.</p>'; fill.hidden=true; return; }
      rows.forEach(x=>{ const l=document.createElement('label'); l.className='qn-row ai-row'; const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=x.c!=='probable'; x.cb=cb;
        const sp=document.createElement('span'); sp.innerHTML='<b></b> <span class="qn-v"></span> <em></em> <small></small>';
        sp.querySelector('b').textContent=(list.length>1?oppName(x.o)+' · ':'')+x.l+' :'; sp.querySelector('.qn-v').textContent=x.v; sp.querySelector('em').textContent=x.c==='probable'?'probable':''; sp.querySelector('small').textContent=x.s?'('+x.s+')':'';
        cb.onchange=paint; l.append(cb, sp); rowsBox.appendChild(l); });
      paint(); };
    function paint(){ const n=rows.filter(x=>x.cb.checked).length; fill.hidden=!rows.length; fill.disabled=!n; fill.textContent=n?'Remplir '+n+' case'+(n>1?'s':''):'Rien de coché'; }
    fill.onclick=()=>{ const ok=rows.filter(x=>x.cb.checked); const touched=new Set(); ok.forEach(x=>{ caractSet(x.o, x.l, x.v); touched.add(x.o); }); touched.forEach(o=>touchCrm(o)); saveCrm(); renderPipeline(); close(); if(done) done(); };
    // everything in the app: Claude answers here, through the key kept on this device (asked here the first time)
    const go=document.createElement('button'); go.type='button'; go.className='ai-go'; go.textContent='Demander à Claude';
    go.onclick=async()=>{ go.disabled=true; go.textContent='Claude réfléchit…';
      try{ show(aiParse(await aiAsk(prompt), list)); go.textContent='Redemander'; }
      catch(err){ rowsBox.innerHTML=''; const p2=document.createElement('p'); p2.className='modal-hint ai-err'; p2.textContent=err.message||String(err); rowsBox.appendChild(p2); go.textContent='Réessayer'; if(/refusée|401/.test(p2.textContent)) askKey(); }
      go.disabled=false; };
    const askKey=()=>{ ask.innerHTML='';
      const p2=document.createElement('p'); p2.className='modal-hint'; p2.textContent='Une fois pour cet appareil : colle ta clé de l’API Claude. Elle reste ici (jamais synchronisée ni exportée).';
      const inp=document.createElement('input'); inp.type='password'; inp.id='ai-key-here'; inp.className='ai-key-in'; inp.placeholder='sk-ant-…'; inp.autocomplete='off';
      const save=document.createElement('button'); save.type='button'; save.className='ai-go'; save.textContent='Enregistrer et demander';
      const link=document.createElement('a'); link.href='https://console.anthropic.com/settings/keys'; link.target='_blank'; link.rel='noopener'; link.className='sync-token-link'; link.textContent='Créer une clé sur la console Anthropic ↗';
      save.onclick=()=>{ const v=inp.value.trim(); if(!v){ inp.focus(); return; } try{ localStorage.setItem('ai-key', v); }catch(e){} ask.innerHTML=''; ask.appendChild(go); go.click(); };
      inp.addEventListener('keydown', e=>{ if(e.key==='Enter') save.click(); });
      const row=document.createElement('div'); row.className='ai-key-row'; row.append(inp, save);
      ask.append(p2, row, link); setTimeout(()=>inp.focus(), 30); };
    if(aiKey()){ ask.appendChild(go); setTimeout(()=>go.click(), 0); } else askKey();
  }
  // ---------- Notes express / mode appel: notes typed in bulk, the app spots the figures and offers to fill the sheet ----------
  const QN_LABELS={ kwc:'Puissance', mwh:'P50', p90:'P90', mesPrev:'MES prévisionnelle', mesEff:'MES effective', dept:'Département', commune:'Commune', cp:'Code postal',
    contrat:'Type de contrat', duree:'Durée (ans)', debut:'Début du contrat', install:'Technologie', rdv1:'RDV 1', rdv2:'RDV 2', nature:'Offre demandée', spv:'SPV', siret:'SIRET',
    tel:'Téléphone', mail:'Mail', relance:'Relance', particularites:'Particularités' };
  const QN_PER_PLANT=new Set(['kwc','mwh','p90','mesPrev','mesEff','dept','commune','cp','contrat','duree','debut','install','spv','siret','particularites']);
  // a production for the eye: « 1 200 MWh », nothing when the value is not a number (« abc », « n/c »)
  function mwhText(v){ const n=pqNum(String(v==null?'':v)); return isFinite(n) && n?Math.round(n).toLocaleString('fr-FR')+' MWh':''; }
  function qnShow(k, v){ if(v==null || v==='') return '—';
    if(k==='kwc') return fmtKwc(v); if(k==='mwh' || k==='p90') return mwhText(v)?mwhText(v)+'/an':String(v);
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return pqIsoToFr(v); return String(v); }
  function parseQuickNotes(text){
    const t=String(text||'').replace(/ /g,' '), f=pqFold(t), out={};
    if(!t.trim()) return out;
    const P=parsePipeMail(t);
    ['kwc','mesPrev','dept','region','contrat','duree','install','debut','tel','mail'].forEach(k=>{ if(P[k]) out[k]=P[k]; });
    if(out.kwc && !(pqNum(out.kwc)>0)) delete out.kwc;   // the production: read here (a P90 is not a P50)
    const qty='(?<![\\w,.-])(\\d{1,3}(?:[ .]\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?)(?![\\d.,]*e\\d)';
    let m;
    // a power or a production written short, as in notes: « 1,2 MWc », « 900 kWc », « P50 1200 », « 1 400 MWh »
    if(!out.kwc && (m=new RegExp(qty+'\\s*(mwc|mwp|mw|kwc|kwp|kw)\\b','i').exec(t))){ const v=pqQty(m[1], m[2]); if(v>0) out.kwc=String(/^m/i.test(m[2])?Math.round(v*1000):Math.round(v)); }
    if((m=new RegExp('\\bp50\\s*[:=]?\\s*'+qty+'\\s*(gwh|mwh)?','i').exec(t))){ const v=pqQty(m[1], m[2]); if(v>0) out.mwh=String(/^g/i.test(m[2]||'')?Math.round(v*1000):Math.round(v)); }
    else { const re=new RegExp(qty+'\\s*(gwh|mwh)\\b','gi'); let g; while((g=re.exec(t))){ if(/p90\W{0,4}$/i.test(t.slice(Math.max(0,g.index-8), g.index))) continue; const v=pqQty(g[1], g[2]); if(v>0){ out.mwh=String(/^g/i.test(g[2])?Math.round(v*1000):Math.round(v)); break; } } }
    if((m=new RegExp('\\bp90\\s*[:=]?\\s*'+qty+'\\s*(gwh|mwh)?','i').exec(t))){ const v=pqQty(m[1], m[2]); if(v>0) out.p90=String(/^g/i.test(m[2]||'')?Math.round(v*1000):Math.round(v)); }
    // commissioning: « MES juin 2027 », « mise en service prévue le 01/03/2027 », « MSI T2 2027 »
    if((m=/\b(mes|msi|mise en service)\b[^\n.;]{0,25}?((?:\d{1,2}\/)?\d{1,2}\/\d{4}|(?:janv|fevr|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|t[1-4]\s+\d{4}|\d{4})/i.exec(f))){ const d=pqParseDateLoose(m[2]); if(d) out[/effective|realisee|en service depuis/.test(f.slice(Math.max(0,m.index-20), m.index+40))?'mesEff':'mesPrev']=d; }
    // where: « 49300 Cholet », « à Cholet (49) »
    if((m=/\b((?:0[1-9]|[1-8]\d|9[0-5])\d{3})\s+([A-ZÉÈÀÂÎÔ][\p{L}'’ -]{1,40}?)(?=[\n,.;)]|\s{2}|$)/u.exec(t))){ out.cp=m[1]; out.commune=pqTitleCase(m[2].trim()); const d=pqDeptFromPostal(m[1]); if(d){ out.dept=pqDeptLabel(d); out.region=PQ_REGIONS[d[2]]; } }
    // meetings and follow-ups: « RDV 2 le 12/11 », « rdv1 : 05/11/2026 », « relance le 3/12 »
    const isoOf=s2=>{ let d=/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s2); if(!d || +d[1]<1 || +d[1]>31 || +d[2]<1 || +d[2]>12) return null; let y=d[3]?+d[3]:new Date().getFullYear(); if(y<100) y+=2000; const dt=new Date(y, +d[2]-1, +d[1]); if(dt.getDate()!==+d[1]) return null; if(!d[3] && dt<new Date(Date.now()-30*864e5)) dt.setFullYear(y+1); return toISO(dt); };
    [['rdv1',/\brdv\s*(?:1|un)\b[^\d\n]{0,12}(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/],['rdv2',/\brdv\s*(?:2|deux)\b[^\d\n]{0,12}(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/],['relance',/\brelan\w*[^\d\n]{0,12}(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/]]
      .forEach(([k,re])=>{ const r=re.exec(f); const v=r && isoOf(r[1]); if(v) out[k]=v; });
    if(/\b(offre|prix|pricing)\s+engageant/.test(f) || /\bengageante?\b/.test(f)) out.nature='Engageante';
    else if(/\b(offre|prix|pricing)\s+(indicati|non engageant)/.test(f)) out.nature='Non engageante';
    if((m=/\bspv\s*[:=]?\s*([^\n,;()]{2,60}?)(?=\s*(?:[.,;()\n]|\bsiret\b|$))/i.exec(t))) out.spv=m[1].trim();
    if((m=/\b(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/.exec(t))) out.siret=m[1].replace(/\s/g,'');
    return out;
  }
  // the proposals for these installations: only what changes something
  function quickNoteProposals(text, list){
    const found=parseQuickNotes(text), rows=[];
    Object.keys(QN_LABELS).forEach(k=>{ if(found[k]==null || found[k]==='') return;
      const olds=[...new Set(list.map(o=>o[k]||''))], same=olds.length===1 && String(olds[0])===String(found[k]);
      if(!same) rows.push({ k, v:found[k], old:olds.filter(Boolean).join(' / '), extra:k==='dept' && found.region?{ region:found.region }:null }); });
    return rows;
  }
  function applyQuickNotes(rows, targets){
    targets.forEach(o=>{ rows.forEach(r=>{ o[r.k]=r.v; if(r.extra) Object.assign(o, r.extra); }); touchCrm(o); });
    saveCrm(); renderPipeline();
  }
  function logNote(list, kind, text, extra){
    const n=Object.assign({ at:Date.now(), kind, text:String(text||'').trim() }, extra||{}); if(!n.text && kind!=='appel') return;
    list.forEach(o=>{ o.notesLog=(o.notesLog||[]).concat([n]); touchCrm(o); }); saveCrm();
  }
  // the box: notes, what the app understood (each line can be left out), « Remplir », « Garder la note »
  function buildQuickNotes(list, opts){
    opts=opts||{};
    const live=list.filter(x=>!isExited(x)).length?list.filter(x=>!isExited(x)):list;
    const box=document.createElement('div'); box.className='qn';
    const ta=document.createElement('textarea'); ta.className='qn-text'; ta.rows=opts.rows||4; ta.id=opts.id||'qn-text';
    ta.placeholder=opts.placeholder||'Tes notes en vrac, ex. « P50 1200, MES juin 2027, 49300 Cholet, RDV 2 le 12/11, offre engageante »';
    box.appendChild(ta);
    let pick=null;
    if(live.length>1){   // a figure of one plant: which one
      pick=document.createElement('div'); pick.className='qn-for'; pick.innerHTML='<span>Les chiffres de la centrale vont à :</span>';
      const sel=document.createElement('select'); sel.className='qn-target'; sel.innerHTML='<option value="">Toutes ('+live.length+')</option>'+live.map(o=>'<option value="'+escapeHtml(o.id)+'">'+escapeHtml(oppName(o))+'</option>').join('');
      pick.appendChild(sel); box.appendChild(pick); pick.hidden=true; }
    const prop=document.createElement('div'); prop.className='qn-props'; box.appendChild(prop);
    const acts=document.createElement('div'); acts.className='qn-acts'; box.appendChild(acts);
    const fill=document.createElement('button'); fill.type='button'; fill.className='qn-fill'; fill.hidden=true;
    const keep=document.createElement('button'); keep.type='button'; keep.className='ghost-btn qn-keep'; keep.textContent=opts.keepLabel||'Garder la note dans l’historique';
    acts.append(fill, keep);
    let rows=[];
    const targets=()=>{ const id=pick && pick.querySelector('select').value; return id?live.filter(o=>o.id===id):live; };
    const paint=()=>{
      rows=live.length?quickNoteProposals(ta.value, targets()):[]; prop.innerHTML='';
      if(pick) pick.hidden=!rows.some(r=>QN_PER_PLANT.has(r.k));
      rows.forEach(r=>{ const l=document.createElement('label'); l.className='qn-row'; const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=true; r.cb=cb;
        const sp=document.createElement('span'); sp.innerHTML='<b></b> <span class="qn-v"></span> <small></small>'; sp.querySelector('b').textContent=QN_LABELS[r.k]+' :'; sp.querySelector('.qn-v').textContent=qnShow(r.k, r.v); sp.querySelector('small').textContent=r.old?'(avant : '+r.old.split(' / ').map(v=>qnShow(r.k, v)).join(' / ')+')':'(vide)';
        cb.onchange=paintBtn; l.append(cb, sp); prop.appendChild(l); });
      paintBtn(); };
    function paintBtn(){ const n=rows.filter(r=>r.cb.checked).length; fill.hidden=!rows.length; fill.disabled=!n; fill.textContent=n?'Remplir '+n+' case'+(n>1?'s':''):'Rien à remplir'; }
    ta.addEventListener('input', paint);
    if(pick) pick.querySelector('select').onchange=paint;
    fill.onclick=()=>{ const ok=rows.filter(r=>r.cb.checked); if(!ok.length) return;
      // a meeting date, a follow-up, the offer asked: shared by the block; a figure of the plant: the chosen one(s)
      const shared=ok.filter(r=>!QN_PER_PLANT.has(r.k)), own=ok.filter(r=>QN_PER_PLANT.has(r.k));
      if(shared.length) applyQuickNotes(shared, live); if(own.length) applyQuickNotes(own, targets());
      flashBtn(fill, '✓ '+ok.length+' case'+(ok.length>1?'s':'')+' remplie'+(ok.length>1?'s':''));
      if(opts.onFill) opts.onFill(ok); else paint(); };
    keep.onclick=()=>{ if(!ta.value.trim()) return; logNote(live, 'note', ta.value); ta.value=''; paint(); flashBtn(keep, '✓ Gardée'); if(opts.onKeep) opts.onKeep(); };
    if(opts.keepHidden) keep.hidden=true;
    box.qn={ ta, paint, rows:()=>rows, fill };
    return box;
  }
  // ---------- Mode appel: one screen while on the phone with the producer ----------
  const QN_ASK={ nominstallation:'Le nom de la centrale ?', departement:'Où est-elle (commune, code postal) ?', commune:'La commune ?',
    datedemiseenserviceeffectiveouprevisionnelle:'Mise en service : quand ?', puissanceinstalleekwc:'La puissance installée (kWc) ?', p50annuelindicatifmwhan:'La production annuelle (P50, MWh/an) ?' };
  const CALL_TALK={ a_qualifier:['Présenter Selfee et l’agrégation','Combien de centrales, quelle puissance, quel contrat (AO CRE, OA, marché) ?'], prise_contact:['Fixer le RDV 1'],
    collecte:['Peut-il envoyer le fichier Caractéristiques rempli ?','La date de mise en service, le P50'], qualif_en_cours:['Fixer ou faire le RDV 2','Offre indicative ou engageante ?'],
    pricing_indicatif:['Le pricing est en cours chez Ops','Une info manque-t-elle pour le prix ?'], offre_remise:['Présenter l’offre'], offre_attente:['A-t-il pu regarder l’offre ?','Des questions, une contre-proposition ?'],
    kyc:['Documents KYC à envoyer (Kbis, statuts, RIB, pièce d’identité)'], negociation:['Les points restant à régler'], pricing_ferme:['Le prix ferme arrive (Ops)'],
    mise_signature:['Le DocuSign est-il bien arrivé ?'], signature:['Signé de son côté ?'], onboarding:['Accès, ARPE, données techniques'], actif:['Tout va bien sur la valorisation ?'] };
  // person: a contact called from the Contacts tab (backlog decision 6) — the call is about that person, with their company's deals if any
  function openCallMode(list, back, person){
    const live=list.filter(x=>!isExited(x)).length?list.filter(x=>!isExited(x)):list; if(!live.length && !person) return;
    const first=live[0]||null, st=first?oppStage(first.stage):null, started=Date.now();
    const mail=((person?person.email:first.mail)||'').toLowerCase(), crm=person||(mail && contacts.find(c=>!c.deleted && (c.email||'').toLowerCase()===mail));
    const name=person?[person.firstName,person.lastName].filter(Boolean).join(' '):[first.prenom, first.nom].filter(Boolean).join(' ')||(crm?[crm.firstName,crm.lastName].filter(Boolean).join(' '):''), tel=person?(person.phone1||person.phone2||''):first.tel||(crm?crm.phone1:'');
    const company=person?person.company||'':first.company;
    closeOppDetail();
    let ov=$('call-overlay'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='call-overlay'; ov.className='modal-overlay';
    const bx=document.createElement('div'); bx.className='modal-box wide call-box'; bx.setAttribute('role','dialog'); bx.setAttribute('aria-label','Mode appel'); ov.appendChild(bx);
    const head=document.createElement('div'); head.className='call-head';
    head.innerHTML='<div><div class="sp-k">Mode appel <span class="call-timer">0:00</span></div><h3></h3><div class="call-sub"></div></div><div class="call-tel"></div>';
    head.querySelector('h3').textContent=(name||company)+(name && company?' · '+company:'');
    head.querySelector('.call-sub').textContent=first?[live.length>1?live.length+' installations':oppName(first), fmtKwc(live.reduce((s2,x)=>s2+kwcNum(x),0)), st?stageLabel(st.key, first)+(daysInStage(first)!=null?' depuis '+daysInStage(first)+' j':''):''].filter(Boolean).join(' · '):[person && person.role, 'aucun dossier en cours'].filter(Boolean).join(' · ');
    if(tel){ const a=document.createElement('a'); a.href='tel:'+tel.replace(/[^\d+]/g,''); a.className='call-num'; a.textContent=tel; head.querySelector('.call-tel').appendChild(a); }
    if(mail){ const a=document.createElement('a'); a.href='mailto:'+mail; a.className='os-link'; a.textContent=mail; head.querySelector('.call-tel').appendChild(a); }
    if(!tel && !mail){ const n=document.createElement('span'); n.className='call-sub'; n.textContent='Pas de numéro sur la fiche'; head.querySelector('.call-tel').appendChild(n); }
    bx.appendChild(head);
    const grid=document.createElement('div'); grid.className='call-grid'; bx.appendChild(grid);
    const left=document.createElement('section'); left.className='call-col'; grid.appendChild(left);
    // what to talk about at this step, then what is missing in the sheet (typed right there)
    const talk=first?CALL_TALK[first.stage]||[]:['Présenter Selfee et l\u2019agrégation','Des projets en cours ou à venir ? Combien de centrales, quelle puissance, quel contrat ?','Qui décide, et quand se reparler ?'];
    if(talk.length){ const h=document.createElement('div'); h.className='sp-k'; h.textContent='À aborder'; left.appendChild(h); const ul=document.createElement('ul'); ul.className='call-talk'; talk.forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ul.appendChild(li); }); left.appendChild(ul); }
    { const mk=document.createElement('div'); mk.className='call-market'; left.appendChild(mk);   // the market, to open the conversation (backlog decision 24)
      const paintMk=()=>{ const t=marketLine(); mk.hidden=!t; mk.innerHTML=t?'<div class="sp-k">Le marché</div><p></p><small>Source : ENTSO-E, CRE, RTE, via PowerKlock</small>':''; if(t) mk.querySelector('p').textContent=t; };
      paintMk(); loadMarket().then(paintMk, ()=>{}); }
    const asks=document.createElement('div'); asks.className='call-asks'; left.appendChild(asks);
    const paintAsks=()=>{ asks.innerHTML=''; if(!live.length) return;
      const miss=[]; live.forEach(o=>CARACT_ROWS.forEach(l=>{ const k=caractKey(l); if(REQ_NEEDED.has(k) && caractValue(o,l)==='') miss.push({ o, l, k }); }));
      const h=document.createElement('div'); h.className='sp-k'; h.textContent=miss.length?'À demander · '+miss.length:'Fiche complète'; asks.appendChild(h);
      miss.forEach(x=>{ const r=document.createElement('label'); r.className='call-ask'; const q=document.createElement('span'); q.textContent=(live.length>1?oppName(x.o)+' — ':'')+(QN_ASK[x.k]||x.l);
        const i=document.createElement('input'); i.type='text'; i.placeholder='réponse'; i.onchange=()=>{ const v=i.value.trim(); if(!v) return; caractSet(x.o, x.l, v); touchCrm(x.o); saveCrm(); renderPipeline(); paintAsks(); };
        r.append(q, i); asks.appendChild(r); }); };
    paintAsks();
    const tk=activeTasks().filter(t=>t.opportunityId && live.some(o=>t.opportunityId===o.id || t.opportunityId===o.requestId)).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'))[0];
    if(tk){ const h=document.createElement('div'); h.className='sp-k'; h.textContent='Prochaine tâche'; const d=document.createElement('div'); d.className='call-task'; d.textContent=plainLinks(tk.title)+(tk.due?' · '+pqIsoToFr(tk.due):''); left.append(h, d); }
    const right=document.createElement('section'); right.className='call-col'; grid.appendChild(right);
    { const h=document.createElement('div'); h.className='sp-k'; h.textContent='Notes de l’appel'; right.appendChild(h); }
    const qn=buildQuickNotes(live, { id:'call-notes', rows:9, keepHidden:true, placeholder:'Ce qu’il dit, en vrac : les chiffres (P50, MES, commune, RDV…) sont repérés au fil de la frappe.', onFill:()=>{ qn.qn.paint(); paintAsks(); paintEnd(); } });
    right.appendChild(qn);
    const foot=document.createElement('div'); foot.className='crm-form-actions call-foot'; bx.appendChild(foot);
    const timer=setInterval(()=>{ const s2=Math.floor((Date.now()-started)/1000); const el=bx.querySelector('.call-timer'); if(el) el.textContent=Math.floor(s2/60)+':'+String(s2%60).padStart(2,'0'); }, 1000);
    const close=save=>{ clearInterval(timer);
      if(save){ if(qn.qn.rows().some(r=>r.cb.checked)) qn.qn.fill.click();   // what was spotted and left ticked goes into the sheet
        const mins=Math.max(1, Math.round((Date.now()-started)/60000)); if(live.length) logNote(live, 'appel', qn.qn.ta.value, { min:mins });
        if(person){ const said=qn.qn.ta.value.trim();   // the contact has no journal: the call goes at the top of its Commentaire
          person.comment=['Appel du '+new Date().toLocaleDateString('fr-FR')+' ('+mins+' min)'+(said?' : '+said:''), person.comment||''].filter(Boolean).join('\n'); touchCrm(person); saveCrm(); } }
      ov.remove(); if(back) back(); };
    const end=document.createElement('button'); end.type='button'; end.className='call-end'; end.textContent='Terminer l’appel'; end.title='Garde la note et la durée dans l’historique'; end.onclick=()=>close(true);
    const cancel=document.createElement('button'); cancel.type='button'; cancel.className='ghost-btn'; cancel.textContent='Annuler'; cancel.onclick=()=>close(false);
    foot.append(end, cancel);
    function paintEnd(){ const n=qn.qn.rows().filter(r=>r.cb.checked).length; end.textContent=n?'Terminer et remplir '+n+' case'+(n>1?'s':''):'Terminer l\u2019appel'; }
    qn.qn.ta.addEventListener('input', paintEnd); qn.addEventListener('change', paintEnd);
    ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(false); } });
    document.body.appendChild(ov);
    setTimeout(()=>qn.qn.ta.focus(), 30);
  }
  // « Historique » : when what happened (created, Go, offer, steps, signature, tasks done), newest first
  function buildHistory(list){
    const ids=new Set(list.flatMap(o=>[o.id, o.requestId].filter(Boolean))), ev=[], seen=new Set();
    const add=(at, text)=>{ if(!at) return; const t=typeof at==='number'?at:(pqDateOf(at)||new Date(at+'T12:00:00')).getTime(); if(!t || isNaN(t)) return; const k=text+'|'+toISO(new Date(t)); if(seen.has(k)) return; seen.add(k); ev.push({ t, text }); };
    const first=list.reduce((m,o)=>Math.min(m, o.createdAt>1e12?o.createdAt:Infinity), Infinity); if(isFinite(first)) add(first, 'Opportunité créée');
    list.forEach(o=>{
      (o.stageLog||[]).forEach((e,i)=>{ if(i===0 || !e || !(e.at>1e12)) return; add(e.at, 'Étape : '+stageLabel(e.stage, o)); });
      if(o.goDate) add(o.goDate, 'Go'); if(o.dateOffre) add(o.dateOffre, 'Offre remise'); if(o.signDate) add(o.signDate, 'Signé');
      if(o.lostAt) add(o.lostAt, (OPP_EXITS[o.stage]||'Sortie'));
      (o.notesLog||[]).forEach(n=>add(n.at, (n.kind==='appel'?'Appel'+(n.min?' ('+n.min+' min)':''):'Note')+(n.text?' : '+(n.text.length>140?n.text.slice(0,140)+'…':n.text):'')));
    });
    tasks.filter(t=>!t.deleted && t.archived && t.opportunityId && ids.has(t.opportunityId)).forEach(t=>add(t.archivedAt||t.updatedAt, 'Fait : '+plainLinks(t.title)));
    if(!ev.length) return null;
    ev.sort((a,b)=>b.t-a.t);
    const d=document.createElement('details'); d.className='opp-history';
    const sm=document.createElement('summary'); sm.textContent='Historique · '+ev.length; d.appendChild(sm);
    const ul=document.createElement('ul');
    ev.forEach(e=>{ const li=document.createElement('li'); li.innerHTML='<span></span><b></b>'; li.firstChild.textContent=new Date(e.t).toLocaleDateString('fr-FR'); li.lastChild.textContent=e.text; ul.appendChild(li); });
    d.appendChild(ul); return d;
  }
  // The pricing request mail (subject + body, one plant or all), open from the Go to the indicative pricing, folded otherwise
  function appendPricingMail(box, req, list){
    const mailBox=document.createElement('div'); mailBox.className='opp-mail';
    let ml=pricingMail(req, list);
    mailBox.innerHTML='<div class="opp-phase-h">Mail de demande de pricing</div>';
    const subj=document.createElement('input'); subj.readOnly=true; subj.value=ml.subject; subj.id='opp-mail-subject';
    const body=document.createElement('textarea'); body.readOnly=true; body.value=ml.body; body.rows=12; body.id='opp-mail-body';
    // all the plants together, or one only (a click on its name)
    if(list.length>1){
      const chips=document.createElement('div'); chips.className='mail-scope'; chips.setAttribute('role','group'); chips.setAttribute('aria-label','Mail pour');
      const pick=(sub, b)=>{ ml=pricingMail(req, sub); subj.value=ml.subject; body.value=ml.body; chips.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b)); };
      const mk=(label, sub)=>{ const b=document.createElement('button'); b.type='button'; b.textContent=label; b.onclick=()=>pick(sub, b); chips.appendChild(b); return b; };
      mk('Toutes ('+list.length+')', list).classList.add('on');
      const lots=[...new Set(list.map(o=>o.lot).filter(Boolean))]; if(lots.length) lots.forEach(l=>{ const sub=list.filter(o=>o.lot===l); if(sub.length>1 && sub.length<list.length) mk(l+' ('+sub.length+')', sub); });
      list.forEach(o=>mk(oppName(o), [o]));
      mailBox.appendChild(chips);
    }
    const hint=document.createElement('p'); hint.className='modal-hint'; hint.textContent='Joins le fichier « Caractéristiques Centrales » créé par le bouton ci-dessous : toutes les lignes du modèle, remplies avec ce que l\u2019appli connaît (et tout ce que contenait l\u2019Excel du producteur).';
    mailBox.appendChild(subj); mailBox.appendChild(body); mailBox.appendChild(hint);
    // the pricing mail only matters from the Go to the indicative pricing: later, it folds away (still there, one click)
    const loM=Math.min(...(list.filter(x=>!isExited(x)).length?list.filter(x=>!isExited(x)):list).map(x=>stageIndex(x.stage)).filter(i=>i>=0)), mailNow=loM>=stageIndex('qualif_en_cours') && loM<=stageIndex('pricing_indicatif') && !list.every(x=>x.mailSentAt);
    if(mailNow) box.appendChild(mailBox);
    else { const d=document.createElement('details'); d.className='opp-mail-fold'; const sm=document.createElement('summary'); sm.textContent='Mail de demande de pricing'; d.appendChild(sm);
      mailBox.querySelector('.opp-phase-h').remove();
      const cp=document.createElement('div'); cp.className='opp-mail-copy';
      [['Copier l\u2019objet',()=>ml.subject],['Copier le mail',()=>ml.body]].forEach(([t,f])=>{ const b=document.createElement('button'); b.type='button'; b.className='ghost-btn'; b.textContent=t; b.onclick=e=>{ copyToClipboard(f(), e.target); if(t==='Copier le mail') markMailSent(list); }; cp.appendChild(b); });
      mailBox.appendChild(cp); d.appendChild(mailBox); box.appendChild(d); }
    return { mailNow, ml:()=>ml };
  }
  // A request's sheet, for one of its blocks (a lot, or the installations at one step) or for all of it
  function openRequestDetail(reqId, ids){
    const req=opportunities.find(x=>x.id===reqId); if(!req) return;
    const toTop=viewingOppId!==reqId;
    viewingOppId=reqId;
    const all=requestInstalls(reqId);
    let list=ids?all.filter(o=>ids.includes(o.id)):all; if(!list.length) list=all;
    const reopen=()=>openRequestDetail(reqId, ids);
    const lot=list.length && list.every(o=>(o.lot||'')===(list[0].lot||''))?list[0].lot||'':'';
    $('opp-detail-title').textContent=req.company+' — '+(lot||reqDisplayName(req, all));
    $('opp-detail-sum').textContent=oppSummary(list.filter(x=>!isExited(x)))+(list.length<all.length?' · demande de '+all.length+' installations':'');
    { const first=list.filter(x=>!isExited(x))[0]||list[0]; const ed=$('opp-detail-edit');
      ed.hidden=!first; ed.textContent='Modifier les fiches'; ed.onclick=()=>{ closeOppDetail(); openOppForm({ editId:first.id }); }; }
    const box=$('opp-detail-body'); box.innerHTML='';
    const live=list.filter(o=>!isExited(o));
    // the progress bar and « Étape en cours », for this block
    if(live.length) box.appendChild(buildStageTrack(live, key=>{ live.forEach(o=>{ if(o.stage!==key) setOppStage(o, key); }); reopen(); }));
    box.appendChild(buildStepPanel(list, { reopen }));
    if(!window.TODO_LITE) box.appendChild(sheetSection('Notes express', 'colle ou tape tes notes : les chiffres sont repérés, un clic pour remplir la fiche', false, buildQuickNotes(list, { onFill:reopen, onKeep:reopen })));
    // the installations of the whole request: lots made here (tick some, name the lot)
    const card=document.createElement('div'); card.className='req-insts';
    const picked=new Set();
    all.forEach((o,i)=>{
      const r=document.createElement('div'); r.className='req-inst'+(isExited(o)?' out':'')+(list.includes(o)?'':' other');
      if(!window.TODO_LITE){ const cb=document.createElement('input'); cb.type='checkbox'; cb.className='req-pick'; cb.setAttribute('aria-label','Choisir '+oppName(o)); cb.onchange=()=>{ cb.checked?picked.add(o):picked.delete(o); paintLotTools(); }; r.appendChild(cb); }
      const n=document.createElement('span'); n.className='n'; n.textContent=String(i+1); r.appendChild(n);
      const nb=document.createElement('button'); nb.type='button'; nb.className='req-inst-name'; nb.innerHTML='<b></b><span></span>'; nb.querySelector('b').textContent=oppName(o); nb.querySelector('span').textContent=instLineInfo(o);
      nb.onclick=()=>openOppDetail(o.id); r.appendChild(nb);
      if(o.lot){ const lc=document.createElement('span'); lc.className='req-lot'; lc.textContent=o.lot; r.appendChild(lc); }
      r.appendChild(stageChip(o));
      const ed=document.createElement('button'); ed.type='button'; ed.className='req-inst-ed'; ed.title='Modifier'; ed.setAttribute('aria-label','Modifier '+oppName(o));
      ed.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
      ed.onclick=()=>{ closeOppDetail(); openOppForm({ editId:o.id }); }; r.appendChild(ed);
      const rm=document.createElement('button'); rm.type='button'; rm.className='req-inst-rm'; rm.title='Retirer de la demande (l’installation reste dans le pipeline)'; rm.setAttribute('aria-label','Retirer '+oppName(o)+' de la demande'); rm.textContent='×';
      rm.onclick=()=>{ o.requestId=null; o.lot=''; touchCrm(o); saveCrm(); renderPipeline(); reopen(); }; r.appendChild(rm);
      card.appendChild(r);
    });
    const tools=document.createElement('div'); tools.className='req-lot-tools';
    const lotName=document.createElement('input'); lotName.type='text'; lotName.placeholder='Nom du lot (ex. Lot 1 — toitures)'; lotName.className='req-lot-name';
    const mk=document.createElement('button'); mk.type='button'; mk.className='req-lot-make'; mk.textContent='Faire un lot';
    const un=document.createElement('button'); un.type='button'; un.className='req-lot-undo ghost-btn'; un.textContent='Retirer du lot';
    const hint=document.createElement('span'); hint.className='req-lot-hint'; hint.textContent='Coche des installations pour en faire un lot : il avance à son rythme, dans la même demande.';
    tools.append(hint, lotName, mk, un);
    function paintLotTools(){ const n=picked.size; mk.disabled=!n; mk.textContent=n?'Faire un lot ('+n+')':'Faire un lot'; un.hidden=![...picked].some(o=>o.lot); lotName.hidden=!n; hint.hidden=!!n; }
    mk.onclick=()=>{ const name=lotName.value.trim()||('Lot '+(new Set(all.map(o=>o.lot).filter(Boolean)).size+1)); [...picked].forEach(o=>{ o.lot=name; touchCrm(o); }); saveCrm(); renderPipeline(); openRequestDetail(reqId, [...picked].map(o=>o.id)); };
    un.onclick=()=>{ [...picked].forEach(o=>{ o.lot=''; touchCrm(o); }); saveCrm(); renderPipeline(); reopen(); };
    if(!window.TODO_LITE){ card.appendChild(tools); paintLotTools(); }
    const candidates=opportunities.filter(o=>!o.deleted && o.kind==='installation' && !o.requestId && o.company===req.company && !isExited(o));
    if(candidates.length){
      const sel=document.createElement('select'); sel.className='opp-req-add';
      sel.innerHTML='<option value="">+ Ajouter une installation de '+escapeHtml(req.company)+'…</option>'+candidates.map(o=>'<option value="'+o.id+'">'+escapeHtml(oppName(o))+'</option>').join('');
      sel.onchange=()=>{ const o=opportunities.find(x=>x.id===sel.value); if(o){ o.requestId=reqId; o.lot=lot; touchCrm(o); saveCrm(); renderPipeline(); reopen(); } };
      card.appendChild(sel);
    }
    const lots=[...new Set(all.map(o=>o.lot).filter(Boolean))];
    box.appendChild(sheetSection('Installations', all.length+' installation'+(all.length>1?'s':'')+(lots.length?' · '+lots.length+' lot'+(lots.length>1?'s':''):'')+' · '+all.slice(0,3).map(o=>oppName(o)+(o.kwc?' '+fmtKwc(o.kwc):'')).join(' · ')+(all.length>3?'…':''), all.length<=6, card));
    // the characteristics file and the pricing mail (open when the step needs them), the history
    const mailFrag=document.createElement('div'), pm=appendPricingMail(mailFrag, req, list), mailNow=pm.mailNow, cmp=list.length?buildRequestCompare(list, null):null;
    if(mailNow){ box.append(...mailFrag.childNodes); if(cmp) box.appendChild(cmp); } else { if(cmp) box.appendChild(cmp); box.append(...mailFrag.childNodes); }
    { const h=buildHistory(all); if(h) box.appendChild(h); }
    const actions=$('opp-detail-actions'); actions.innerHTML='';
    if(mailNow){ actions.appendChild(oppActionBtn('Copier l’objet', e=>{ copyToClipboard(pm.ml().subject, e.target); }, 'ghost-btn'));
      actions.appendChild(oppActionBtn('Copier le mail', e=>{ copyToClipboard(pm.ml().body, e.target); markMailSent(list); }, 'ghost-btn')); }
    actions.appendChild(oppActionBtn('Fichier caractéristiques (.xlsx)', e=>downloadCaract(live, e.target), 'ghost-btn'));
    excelButtons(actions, list);
    actions.appendChild(oppActionBtn('Copier lignes Pipe', e=>copyPipeLines(live, e.target), 'ghost-btn'));
    actions.appendChild(oppActionBtn('Copier lignes BDD', e=>copyToClipboard(list.map(bddRow).join('\n'), e.target), 'ghost-btn'));
    if(!window.TODO_LITE && all.length>1) actions.appendChild(oppActionBtn('Dégrouper', async()=>{ if(await ungroupRequest(reqId)) closeOppDetail(); }, 'ghost-btn'));
    actions.appendChild(oppActionBtn('Voir dans le réseau', ()=>{ closeOppDetail(); openInNetwork('rq:'+reqId); }, 'ghost-btn opp-net-btn lite-keep'));
    actions.appendChild(oppActionBtn('Fermer', closeOppDetail, 'ghost-btn lite-keep'));
    foldActions($('opp-detail-actions')); $('opp-detail-overlay').classList.remove('hidden'); if(toTop) sheetToTop();
  }
  // the pricing mail copied: noted on the installations (the checklist ticks « Mail de demande envoyé »)
  function markMailSent(list){ const now=Date.now(); list.forEach(o=>{ if(!o.mailSentAt){ o.mailSentAt=now; touchCrm(o); } }); saveCrm(); }
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
  // The « Caractéristiques Centrales » file in the template's own design: Arial 11, no gridlines, the « Nom Installation » line
  // on light blue, the labels on light grey in bold navy, thin grey borders, a thick blue line after « Productible » and a
  // medium one after each « Champ », values worked out by the app on yellow (« infos en jaune extrapolées »).
  const loadExcelJs=()=>loadScript('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js', ()=>!!window.ExcelJS, 'Bibliothèque Excel indisponible (hors ligne ?)');

  const CARACT_PLAIN=new Set(['Commune','P50 annuel (indicatif) (MWh/an)','P90 annuel (indicatif) (MWh/an)'].map(caractKey));
  function caractGuessed(o, label){   // worked out by the app rather than given by the producer
    const k=caractKey(label), num=v=>!isNaN(pqNum(String(v==null?'':v))) && String(v).trim()!=='';
    const inFile=Object.keys(o.caract||{}).some(l=>caractKey(l)===k && String(o.caract[l]).trim()!=='');
    if(k===caractKey('Productible (P50) (kWh/kWc/an)')) return !num(o.productible) && !inFile && num(o.mwh) && num(o.kwc);
    if(k===caractKey('Nature Projet')) return !inFile && !!caractValue(o,label);
    return false;
  }
  async function caractWorkbookBlob(list){
    await loadExcelJs();
    const wb=new ExcelJS.Workbook(), ws=wb.addWorksheet('Données', { views:[{ showGridLines:false }] });
    const font={ name:'Arial', size:11 }, navy='FF002060', grey='FFF2F2F2', blue='FF85C2F6', line={ style:'thin', color:{ argb:'FFBFBFBF' } };
    ws.columns=[{ width:48.8 }].concat(list.map(()=>({ width:34 })));
    const head=ws.getRow(1); head.height=16.9;
    list.forEach((_,i)=>{ const c=head.getCell(i+2); c.value='Centrale '+(i+1); c.font=Object.assign({}, font, { bold:true }); c.alignment={ horizontal:'center', vertical:'middle' }; });
    CARACT_ROWS.forEach((label, r)=>{
      const row=ws.getRow(r+2), k=caractKey(label), first=r===0;
      row.height=k===caractKey('Adresse Installation')?24:16.9;
      const bottom=k===caractKey('Productible (P50) (kWh/kWc/an)')?{ style:'thick', color:{ argb:blue } }:/^champ[123]fixeoutracker$/.test(k)?{ style:'medium', color:{ argb:blue } }:line;
      const a=row.getCell(1); a.value=label;
      a.font=Object.assign({}, font, first?{ bold:true }:CARACT_PLAIN.has(k)?{}:{ bold:true, color:{ argb:navy } });
      a.fill={ type:'pattern', pattern:'solid', fgColor:{ argb:first?blue:grey } };
      a.alignment={ vertical:'middle' }; a.border={ top:line, left:line, right:line, bottom };
      list.forEach((o,i)=>{ const c=row.getCell(i+2), v=caractValue(o,label);
        c.value=v===''||v==null?null:v;
        c.font=Object.assign({}, font, first?{ bold:true, color:{ argb:'FFFFFFFF' } }:{});
        c.alignment={ horizontal:'left', vertical:'middle', wrapText:k===caractKey('Adresse Installation')||k===caractKey('Système de gestion des heures négatives') };
        if(first) c.fill={ type:'pattern', pattern:'solid', fgColor:{ argb:blue } };
        else if(caractGuessed(o,label)) c.fill={ type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFFF00' } };
        c.border={ top:line, left:line, right:line, bottom }; });
    });
    return new Blob([await wb.xlsx.writeBuffer()], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  window.todoCaractBlob=list=>caractWorkbookBlob(list);
  async function downloadCaract(list, btn){
    try{
      const blob=await caractWorkbookBlob(list), url=URL.createObjectURL(blob);
      { const now=Date.now(); list.forEach(o=>{ o.caractSentAt=now; touchCrm(o); }); saveCrm(); }
      const a=document.createElement('a'); a.href=url; a.download=caractFileName(list); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 2000);
      if(btn){ const t=btn.textContent; btn.textContent='✓ Fichier créé'; setTimeout(()=>{ btn.textContent=t; },2000); }
    }catch(e){ console.error(e); showBridgeMsg('Fichier non créé : '+(e.message||e), false); }
  }
  // Pricing request mail, on the model of the last one sent (a producer, 3 PV + 1 éolien CR): the figures stay in the
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
    const dateText=o=>{ const a=injOf(o), b=msiOf(o), t=testLen(a,b);
      if(a && b && t) return month(a)+' → '+month(b)+' (test '+t+')';
      if(b) return 'MSI '+month(b)+(a?'':' (première injection [À CONFIRMER])');
      if(a) return month(a)+' → MSI [À CONFIRMER]';
      return '[À CONFIRMER]'; };
    // the same dates for several plants: one line; too many different lines: the period, and the attached file for the detail
    const dateGroups=[]; byStart.forEach(o=>{ const t=dateText(o), g=dateGroups.find(x=>x.t===t); if(g) g.names.push(oppName(o)); else dateGroups.push({ t, names:[oppName(o)] }); });
    const namesOf=g=>g.names.length>4?g.names.length+' centrales ('+g.names.slice(0,3).join(', ')+'…)':g.names.join(', ');
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
    if(dateGroups.length>4){
      const msis=list.map(msiOf).filter(Boolean).sort((x,y)=>(x.y*12+(x.m||0))-(y.y*12+(y.m||0)));
      L.push('   - '+(msis.length?'MSI de '+month(msis[0])+' à '+month(msis[msis.length-1])+' ; ':'')+'le détail par centrale est dans le fichier joint (lignes « Première injection » et « Date de mise en service »).');
    } else dateGroups.forEach(g=>L.push('   - '+(list.length>1?namesOf(g)+' : ':'')+g.t));
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
    results.forEach((r,i)=>{ const o=list[i]; xlRemember(kind, o, rows[i].values, r); if(r.ok && ((r.conflicts&&r.conflicts.length) || r.question)) pending.push({ o, r });
      if(r.ok && r.action!=='en attente'){ o.excelSent=Object.assign({}, o.excelSent||{}, { [kind]:{ at:Date.now(), h:xsHash(rows[i].values) } }); } });
    list.forEach(o=>{ o[kind==='pipe'?'pipeSentAt':'bddSentAt']=Date.now(); touchCrm(o); }); saveCrm();
    return { res, results, pending };
  }
  // ---------- Excel ⇄ appli : what was sent to the Pipe and to the Suivi (BDD), what changed since on either side ----------
  const xsHash=vals=>{ const t=(vals||[]).map(v=>cellToText(v)).join('␟'); let h=5381; for(let i=0;i<t.length;i++) h=((h*33)^t.charCodeAt(i))>>>0; return h.toString(36); };
  const xsNorm=v=>pqFold(String(v==null?'':v)).replace(/[^a-z0-9]/g,'');
  const xsColIdx=letters=>String(letters||'').toUpperCase().split('').reduce((n,ch)=>n*26+(ch.charCodeAt(0)-64),0)-1;
  // one Excel cell as text, the way the app writes it (dates from Excel serials, numbers with a comma)
  const xsCellText=(v, dateish)=>{ if(v==null) return ''; if(typeof v==='number' && dateish && v>20000 && v<80000){ const d=new Date(Math.round((v-25569)*86400000)); return pqPad(d.getUTCDate())+'/'+pqPad(d.getUTCMonth()+1)+'/'+d.getUTCFullYear(); }
    if(typeof v==='number') return String(Math.round(v*1000)/1000).replace('.',','); if(typeof v==='boolean') return v?'VRAI':'FAUX'; return String(v).trim(); };
  let xsRead={ pipe:null, bdd:null };   // last reading of each file through the bridge: { at, rows: Map(key → row), off }
  const XS_KEYS={ pipe:{ header:'Nom Producteur', a:6, b:19, sheet:/pipe/i }, bdd:{ header:'Nom_prod', a:6, b:33, sheet:/bdd/i } };
  const xsAppValues=(kind,o)=>kind==='pipe'?PQ_FIELDS.reduce((row,f,i)=>{ row[xsColIdx(f.col)]=pipeCells(o)[i]; return row; }, []):bddCells(o);
  const xsKey=(kind, vals)=>xsNorm(vals[XS_KEYS[kind].a])+'|'+xsNorm(vals[XS_KEYS[kind].b]);
  async function xsReadFile(kind){
    const res=await bridgeCall('GET','/'+kind+'/read',null,60000), sheets=res.sheets||{};
    const name=Object.keys(sheets).find(n=>XS_KEYS[kind].sheet.test(n)); if(!name) throw new Error('Onglet introuvable dans le fichier '+(kind==='pipe'?'Pipe':'BDD'));
    const rows=sheets[name]||[], K=XS_KEYS[kind];
    const hi=rows.findIndex((r,i)=>i<20 && (r||[]).some(c=>xsNorm(c)===xsNorm(K.header))); if(hi<0) throw new Error('En-tête « '+K.header+' » introuvable');
    const off=rows[hi].findIndex(c=>xsNorm(c)===xsNorm(K.header))-K.a, map=new Map();
    rows.slice(hi+1).forEach((r,i)=>{ if(!r) return; const vals=[]; r.forEach((c,j)=>{ vals[j-off]=c; }); const k=xsKey(kind, vals); if(k!=='|') map.set(k, { vals, line:hi+2+i }); });
    xsRead[kind]={ at:Date.now(), rows:map, name };
  }
  // where an installation stands for one file
  function xsState(kind, o){
    const vals=xsAppValues(kind, o), h=xsHash(kind==='pipe'?pipeCells(o):vals), sent=o.excelSent&&o.excelSent[kind], legacy=!sent && o.excelPrev && o.excelPrev[kind];
    const sentAt=sent?sent.at:(kind==='pipe'?o.pipeSentAt:o.bddSentAt);
    const app=sent?(sent.h===h?'ok':'modif'):legacy||sentAt?'envoye':'jamais';
    const st={ app, sentAt, excel:null, diffs:[], statut:null };
    const rd=xsRead[kind];
    if(rd){ const hit=rd.rows.get(xsKey(kind, vals));
      if(!hit) st.excel='absent';
      else { st.line=hit.line; const prev=(o.excelPrev&&o.excelPrev[kind])||[];
        const cols=kind==='pipe'?PQ_FIELDS.map(f=>({ i:xsColIdx(f.col), f, label:f.label, dateish:f.type==='date'||['mesPrev','mesEff','debut','fin'].includes(f.k) })):[{ i:24, label:'Statut' }];
        cols.forEach(c=>{ const ex=xsCellText(hit.vals[c.i], c.dateish), ap=cellToText(vals[c.i]), pv=cellToText(prev[c.i]);
          if(xsNorm(ex)===xsNorm(ap)) return;
          // changed in the Excel by someone (not what the app wrote last), or still to send from the app
          st.diffs.push({ col:c, excel:ex, app:ap, byExcel:!!ex && xsNorm(ex)!==xsNorm(pv) }); });
        if(kind==='bdd') st.statut=xsCellText(hit.vals[24]);
        st.excel=st.diffs.some(d=>d.byExcel)?'modifie':'present'; } }
    else if(kind==='bdd'){ const s2=suiviState(o); if(s2) st.excel=s2.k==='missing'?'absent':s2.k==='diff'?'statut':'present', st.statut=s2.p&&s2.p.statut; }
    return st;
  }
  const xsTodo=st=>st.app==='jamais'||st.app==='modif'||st.excel==='absent'||st.excel==='modifie'||st.excel==='statut'||(st.diffs||[]).length>0;
  function xsList(){ return opportunities.filter(o=>!o.deleted && o.kind==='installation' && (!isExited(o) || (o.excelSent||o.pipeSentAt||o.bddSentAt))); }
  const xsBddApplies=o=>isExited(o) || stageIndex(o.stage)>=stageIndex('pricing_indicatif');
  // a value changed in the Pipe by a colleague, taken into the app
  function xsTake(o, d){
    const f=d.col.f; if(!f) return;
    let v=d.excel;
    if(f.type==='check') v=/^(vrai|true|oui|1|x)$/i.test(v);
    else if(f.type==='date'){ const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); v=m?m[3]+'-'+m[2]+'-'+m[1]:v; }
    o[f.k]=v; touchCrm(o); saveCrm();
  }
  // a status typed in the Suivi by someone: Gagné / Perdu / Abandon brought into the pipeline
  function xsStatutAction(o, statut){
    const s=pqFold(statut||'');
    if(/gagne/.test(s) && stageIndex(o.stage)<stageIndex('onboarding')) return { label:'Passer à Onboarding', run:()=>{ setOppStage(o,'onboarding'); } };
    if(/perdu/.test(s) && !isExited(o)) return { label:'Marquer perdu', run:()=>{ relanceOnMove(o, null); o.stageBeforeExit=o.stage; o.stage='perdu'; o.lostAt=Date.now(); touchCrm(o); saveCrm(); } };
    if(/abandon|sans suite|no ?go/.test(s) && !isExited(o)) return { label:'Marquer abandonné', run:()=>{ relanceOnMove(o, null); o.stageBeforeExit=o.stage; o.stage='abandonne'; o.lostAt=Date.now(); touchCrm(o); saveCrm(); } };
    return null;
  }
  // which lines the panel shows: the pipeline's (not signed yet, lost ones included), the Portefeuille's (signed), or all
  let xsScope='pipe';
  const xsInScope=o=>xsScope==='all'?true:xsScope==='parc'?(!isExited(o) && stageIndex(o.stage)>=stageIndex('onboarding')):(isExited(o) || stageIndex(o.stage)<stageIndex('onboarding'));
  async function openExcelSync(opts){
    xsScope=opts && opts.scope || 'pipe';
    let ov=$('xs-overlay');
    if(!ov){ ov=document.createElement('div'); ov.id='xs-overlay'; ov.className='modal-overlay';
      ov.innerHTML='<div class="modal-box wide xs-box" role="dialog" aria-labelledby="xs-title"><div class="xs-head"><h3 id="xs-title">Excel ⇄ appli</h3><div class="xs-filter"><button type="button" data-f="todo" class="on">À traiter</button><button type="button" data-f="all">Tout</button></div><button type="button" class="modal-x xs-x" aria-label="Fermer">×</button></div>'
        +'<p class="modal-hint xs-info"></p><div class="xs-tools"><button type="button" class="xs-read">Relire les Excel</button><button type="button" class="xs-send" data-k="pipe"></button><button type="button" class="xs-send" data-k="bdd"></button></div><div class="xs-body"></div></div>';
      document.body.appendChild(ov); const close=()=>ov.classList.add('hidden');
      ov.addEventListener('click', e=>{ if(e.target===ov) close(); }); ov.querySelector('.xs-x').onclick=close;
      ov.querySelectorAll('.xs-filter button').forEach(b=>b.onclick=()=>{ ov.querySelectorAll('.xs-filter button').forEach(x=>x.classList.toggle('on', x===b)); paintExcelSync(); });
      ov.querySelector('.xs-read').onclick=async e=>{ const b=e.currentTarget, t=b.textContent; b.disabled=true; b.textContent='Lecture…';
        try{ await xsReadFile('pipe'); await xsReadFile('bdd'); importParcFromBridge(true); }catch(err){ showBridgeMsg(err.message, false); } b.disabled=false; b.textContent=t; paintExcelSync(); };
      ov.querySelectorAll('.xs-send').forEach(b=>b.onclick=async()=>{ const kind=b.dataset.k, list=xsList().filter(xsInScope).filter(o=>(kind==='pipe'||xsBddApplies(o)) && xsTodo(xsState(kind,o)) && !((xsState(kind,o).diffs||[]).some(d=>d.byExcel))); if(!list.length) return;
        await sendToExcel(kind, list, b); if(bridgeConfigured()){ try{ await xsReadFile(kind); }catch(e){ softFail('relecture de l\u2019Excel', e); } } paintExcelSync(); });
    }
    { let sc=ov.querySelector('.xs-scope'); if(!sc){ sc=document.createElement('div'); sc.className='xs-scope xs-filter'; ov.querySelector('.xs-head').appendChild(sc);
        [['pipe','Pipeline'],['parc','Portefeuille (signés)'],['all','Tout']].forEach(([k,l])=>{ const b=document.createElement('button'); b.type='button'; b.dataset.s=k; b.textContent=l; b.onclick=()=>{ xsScope=k; paintExcelSync(); }; sc.appendChild(b); }); } }
    ov.classList.remove('hidden'); paintExcelSync();
    if(bridgeConfigured() && !(opts&&opts.noRead) && (!xsRead.pipe || Date.now()-xsRead.pipe.at>120000)){ try{ await xsReadFile('pipe'); await xsReadFile('bdd'); }catch(e){ softFail('relecture des Excel', e); } paintExcelSync(); }
  }
  function paintExcelSync(){
    const ov=$('xs-overlay'); if(!ov || ov.classList.contains('hidden')) return;
    const all=ov.querySelector('.xs-filter .on').dataset.f==='all', body=ov.querySelector('.xs-body'); body.innerHTML='';
    const fmtD=t=>t>1e12?new Date(t).toLocaleDateString('fr-FR'):'';
    ov.querySelector('.xs-info').textContent=bridgeConfigured()
      ? 'Pipe '+(xsRead.pipe?'relu le '+fmtD(xsRead.pipe.at)+' à '+new Date(xsRead.pipe.at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'pas encore relu')+' · Suivi '+(xsRead.bdd?'relu':'pas encore relu')+'. Envoyer ne remplace jamais une case modifiée par un collègue : elle te sera demandée.'
      : 'Pont Excel non connecté sur cet ordinateur : la colonne « appli » dit ce qui a été envoyé ; le Suivi est relu depuis le Portefeuille (fichier chargé). Le pont se règle dans Réf. & data.';
    ov.querySelectorAll('.xs-scope button').forEach(b=>b.classList.toggle('on', b.dataset.s===xsScope));
    const rows=xsList().filter(xsInScope).map(o=>({ o, p:xsState('pipe',o), b:xsBddApplies(o)?xsState('bdd',o):null }));
    const todo=rows.filter(r=>xsTodo(r.p) || (r.b && xsTodo(r.b)));
    const cntP=rows.filter(r=>xsTodo(r.p) && !r.p.diffs.some(d=>d.byExcel)).length, cntB=rows.filter(r=>r.b && xsTodo(r.b) && !r.b.diffs.some(d=>d.byExcel)).length;
    ov.querySelectorAll('.xs-send').forEach(b=>{ const n=b.dataset.k==='pipe'?cntP:cntB; b.textContent='Envoyer au '+(b.dataset.k==='pipe'?'Pipe':'Suivi')+' ('+n+')'; b.disabled=!n || !bridgeConfigured(); b.title=bridgeConfigured()?'':'Pont Excel non connecté'; });
    const shown=all?rows:todo;
    if(!shown.length){ body.innerHTML='<p class="xs-empty">✓ Tout est à jour'+(xsRead.pipe?'':' côté appli (relis les Excel pour vérifier le contenu des fichiers)')+'.</p>'; return; }
    const t=document.createElement('table'); t.className='xs-table';
    t.innerHTML='<thead><tr><th>Installation</th><th>Pipe Excel</th><th>Suivi (BDD)</th></tr></thead>';
    const tb=document.createElement('tbody');
    const cell=(kind, o, st)=>{
      const td=document.createElement('td'); if(!st){ td.innerHTML='<span class="xs-na">pas encore (avant le pricing)</span>'; return td; }
      const tag=(cls,txt)=>{ const s=document.createElement('span'); s.className='xs-tag '+cls; s.textContent=txt; td.appendChild(s); };
      if(st.app==='jamais') tag('warn','Pas envoyé');
      else if(st.app==='modif') tag('warn','Modifié dans l’appli depuis l’envoi'+(fmtD(st.sentAt)?' du '+fmtD(st.sentAt):''));
      else tag('ok','Envoyé'+(fmtD(st.sentAt)?' le '+fmtD(st.sentAt):''));
      if(st.excel==='absent' && st.app!=='jamais') tag('bad','Absent du fichier');
      if(st.excel==='statut') tag('info','Statut Suivi : '+(st.statut||'?'));
      if(st.line) { const l=document.createElement('span'); l.className='xs-line'; l.textContent='ligne '+st.line; td.appendChild(l); }
      st.diffs.filter(d=>d.byExcel).slice(0,6).forEach(d=>{ const r=document.createElement('div'); r.className='xs-diff';
        r.innerHTML='<span></span><b></b>'; r.firstChild.textContent=d.col.label+' : Excel « '+(d.excel||'vide')+' »'; r.lastChild.textContent=' · appli « '+(d.app||'vide')+' »';
        if(kind==='pipe' && d.col.f){ const b=document.createElement('button'); b.type='button'; b.className='pq-link'; b.textContent='Reprendre dans l’appli'; b.onclick=()=>{ xsTake(o,d); renderPipeline(); paintExcelSync(); }; r.appendChild(b); }
        if(kind==='bdd'){ const a=xsStatutAction(o, d.excel); if(a){ const b=document.createElement('button'); b.type='button'; b.className='pq-link'; b.textContent=a.label; b.onclick=()=>{ a.run(); renderPipeline(); paintExcelSync(); }; r.appendChild(b); } }
        td.appendChild(r); });
      if(st.excel==='statut'){ const a=xsStatutAction(o, st.statut); if(a){ const b=document.createElement('button'); b.type='button'; b.className='pq-link'; b.textContent=a.label; b.onclick=()=>{ a.run(); renderPipeline(); paintExcelSync(); }; td.appendChild(b); } }
      if(xsTodo(st) && !st.diffs.some(d=>d.byExcel) && bridgeConfigured()){ const b=document.createElement('button'); b.type='button'; b.className='pq-link xs-one'; b.textContent='Envoyer'; b.onclick=async()=>{ await sendToExcel(kind,[o],b); try{ await xsReadFile(kind); }catch(e){ softFail('relecture de l\u2019Excel', e); } paintExcelSync(); }; td.appendChild(b); }
      return td; };
    shown.forEach(({o,p,b})=>{ const tr=document.createElement('tr');
      const n=document.createElement('td'); n.className='xs-name'; n.innerHTML='<b></b><span></span>'; n.firstChild.textContent=oppName(o); n.lastChild.textContent=[o.company, stageLabel(o.stage, o)].filter(Boolean).join(' · ');
      n.onclick=()=>{ $('xs-overlay').classList.add('hidden'); openOppDetail(o.id); };
      tr.append(n, cell('pipe', o, p), cell('bdd', o, b)); tb.appendChild(tr); });
    t.appendChild(tb); body.appendChild(t);
  }
  window.todoExcelSync=openExcelSync;
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
    if(!ON_PHONE && list.some(o=>o.goDate || stageIndex(o.stage)>=stageIndex('pricing_indicatif'))) actions.appendChild(oppActionBtn(list.length>1?'Envoyer à la BDD Excel ('+list.length+')':'Envoyer à la BDD Excel', e=>sendToExcel('bdd', list.filter(o=>o.goDate || stageIndex(o.stage)>=stageIndex('pricing_indicatif')), e.target)));
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
  // one company written two ways: everything goes to the name kept, the other one disappears
  function mergeCompanyInto(oldName, existing){
    tasks.forEach(t=>{ if(t.client===oldName){ t.client=existing; touch(t); } });
    contacts.forEach(c=>{ if(c.company===oldName){ c.company=existing; touchCrm(c); } });
    renameOppCompany(oldName, existing);
    const dupCo=companies.find(x=>x.name===oldName && !x.deleted), keep=companies.find(x=>x.name===existing && !x.deleted);
    if(dupCo){ if(!keep){ dupCo.name=existing; } else { Object.keys(dupCo).forEach(k=>{ if(!['id','name','createdAt','updatedAt','deleted'].includes(k) && (keep[k]==null || keep[k]==='') && dupCo[k]!=null && dupCo[k]!=='') keep[k]=dupCo[k]; }); touchCrm(keep); dupCo.deleted=true; } touchCrm(dupCo); }
    if(!clientsList.includes(existing) && clientsList.includes(oldName)) clientsList=clientsList.map(c=>c===oldName?existing:c); else clientsList=clientsList.filter(c=>c!==oldName);
    rewriteLinks(oldName, existing);
    saveClients(); saveTasks(); saveCrm(); render(); renderLists();
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
      mergeCompanyInto(oldName, existing);
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
  // ---------- « Restaurer une version » : go back to the tasks, the CRM or the note as they were on GitHub at a past sync (audit A4) ----------
  // Every sync is a commit of the private data repo, so every past state exists. A restore writes that state back as new
  // edits (dated now, so they win the merge on every device); what was created since is kept, or removed if asked.
  const RESTORE_SETS={
    tasks:{ label:'Tâches', path:()=>SYNC_TASKS_PATH, lists:()=>[['task', ()=>tasks, v=>{ tasks=v; }]], pick:j=>({ task:Array.isArray(j)?j:[] }), save:()=>{ saveTasks(); refreshAllViews(); } },
    crm:{ label:'Contacts, sociétés et pipeline', path:()=>SYNC_CRM_PATH,
      lists:()=>[['company', ()=>companies, v=>{ companies=v; }], ['contact', ()=>contacts, v=>{ contacts=v; }], ['meeting', ()=>meetings, v=>{ meetings=v; }], ['opportunity', ()=>opportunities, v=>{ opportunities=v; }]],
      pick:j=>({ company:j.companies||[], contact:j.contacts||[], meeting:j.meetings||[], opportunity:j.opportunities||[] }), save:()=>{ saveCrm(); renderCrm(); if(typeof renderPipeline==='function') renderPipeline(); } },
    notes:{ label:'La note', path:()=>SYNC_NOTES_PATH, lists:()=>[['note', ()=>notes, v=>{ notes=v; }]], pick:j=>({ note:Array.isArray(j)?j:[] }), save:()=>{ consolidateNotes(); saveNotes(); renderNotes(); } }
  };
  const restoreName=(t,x)=>{ const m=CONFLICT_ENTITY_LABELS[t]; return m?m.name(x):x.id; };
  // what restoring that version would change, record by record
  function restorePlan(setKey, version){
    const set=RESTORE_SETS[setKey], want=set.pick(version), plan={ back:[], changed:[], since:[], lists:set.lists() };
    plan.lists.forEach(([t,get])=>{
      const cur=new Map((get()||[]).map(x=>[x.id,x])), old=new Map(recs(want[t]||[]).map(x=>[x.id,x]));
      old.forEach((o,id)=>{ const c=cur.get(id); if(!c || (c.deleted && !o.deleted)) plan.back.push([t,o]); else if(stableStringify(Object.assign({},c,{updatedAt:0}))!==stableStringify(Object.assign({},o,{updatedAt:0}))) plan.changed.push([t,o]); });
      cur.forEach((c,id)=>{ if(!old.has(id) && !c.deleted) plan.since.push([t,c]); });
    });
    return plan;
  }
  function applyRestore(setKey, plan, removeSince){
    const now=Date.now(), byType={};
    plan.back.concat(plan.changed).forEach(([t,o])=>{ (byType[t]=byType[t]||[]).push(Object.assign(JSON.parse(JSON.stringify(o)), { updatedAt:now })); });
    plan.lists.forEach(([t,get,set])=>{
      const list=(get()||[]).slice(), at=new Map(list.map((x,i)=>[x.id,i]));
      (byType[t]||[]).forEach(o=>{ if(at.has(o.id)) list[at.get(o.id)]=o; else list.push(o); });
      if(removeSince) plan.since.filter(([tt])=>tt===t).forEach(([,c])=>{ const i=at.get(c.id); if(i!=null){ list[i]=Object.assign({}, list[i], { deleted:true, updatedAt:now }); } });
      set(list);
    });
    RESTORE_SETS[setKey].save();
  }
  async function openRestore(){
    let ov=$('restore-overlay'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='restore-overlay'; ov.className='modal-overlay';
    ov.innerHTML='<div class="modal-box wide rs-box" role="dialog" aria-label="Restaurer une version"><h3>Restaurer une version</h3>'
      +'<p class="modal-hint">Chaque synchro garde une version sur GitHub. Choisis ce que tu veux remettre et le moment : tu vois ce qui change avant de valider. Ce qui a été créé depuis est gardé, sauf si tu demandes le contraire.</p>'
      +'<div class="rs-sets">'+Object.entries(RESTORE_SETS).map(([k,s],i)=>'<label><input type="radio" name="rs-set" value="'+k+'"'+(i?'':' checked')+'> '+escapeHtml(s.label)+'</label>').join('')+'</div>'
      +'<div class="rs-list" aria-live="polite"></div><div class="rs-plan"></div><div class="crm-form-actions"><button type="button" class="ghost-btn rs-close">Fermer</button></div></div>';
    document.body.appendChild(ov);
    const box=ov.querySelector('.rs-list'), planBox=ov.querySelector('.rs-plan'), close=()=>ov.remove();
    ov.querySelector('.rs-close').onclick=close;
    ov.addEventListener('click', e=>{ if(e.target===ov) close(); });
    ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } });
    if(!syncConfig.enabled || !syncConfig.token){ box.innerHTML='<p class="muted">Il faut la synchro GitHub pour retrouver les versions passées. Sans elle : Réf. & data › Importer, avec ton dernier export.</p>'; return; }
    const auth={ 'Accept':'application/vnd.github+json' }, repoUrl='https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo;
    const listVersions=async()=>{
      const key=ov.querySelector('input[name=rs-set]:checked').value; planBox.innerHTML=''; box.innerHTML='<p class="muted">Lecture des versions…</p>';
      try{
        const r=await ghFetch(repoUrl+'/commits?path='+encodeURIComponent(RESTORE_SETS[key].path())+'&per_page=40', { headers:auth, cache:'no-store' });
        if(!r.ok) throw new Error(r.status); const commits=await r.json();
        if(!commits.length){ box.innerHTML='<p class="muted">Aucune version sur GitHub pour l’instant.</p>'; return; }
        box.innerHTML='<div class="rs-k">Versions, de la plus récente à la plus ancienne</div>';
        commits.forEach((c,i)=>{ const d=new Date(c.commit.committer.date), b=document.createElement('button'); b.type='button'; b.className='rs-ver';
          b.textContent=d.toLocaleDateString('fr-FR',{ weekday:'short', day:'numeric', month:'short' })+' à '+d.toLocaleTimeString('fr-FR',{ hour:'2-digit', minute:'2-digit' })+(i===0?' · la dernière':'');
          b.onclick=()=>{ box.querySelectorAll('.rs-ver').forEach(x=>x.classList.toggle('on', x===b)); showPlan(key, c.sha, b.textContent); }; box.appendChild(b); });
      }catch(e){ box.innerHTML='<p class="muted">Impossible de lire les versions (réseau ou jeton). Réessaie plus tard.</p>'; }
    };
    const showPlan=async(key, sha, when)=>{
      planBox.innerHTML='<p class="muted">Comparaison…</p>';
      try{
        const r=await ghFetch(repoUrl+'/contents/'+RESTORE_SETS[key].path()+'?ref='+sha, { headers:Object.assign({}, auth, { 'Accept':'application/vnd.github.raw+json' }), cache:'no-store' });
        if(!r.ok) throw new Error(r.status); const version=JSON.parse(await r.text()), plan=restorePlan(key, version);
        const names=l=>l.slice(0,6).map(([t,x])=>escapeHtml(restoreName(t,x))).join(', ')+(l.length>6?' et '+(l.length-6)+' autres':'');
        planBox.innerHTML='<div class="rs-k">Revenir au '+escapeHtml(when)+'</div><ul class="rs-sum">'
          +'<li><b>'+plan.back.length+'</b> élément'+(plan.back.length>1?'s':'')+' qui revien'+(plan.back.length>1?'nent':'t')+(plan.back.length?' : '+names(plan.back):'')+'</li>'
          +'<li><b>'+plan.changed.length+'</b> élément'+(plan.changed.length>1?'s':'')+' remis comme à ce moment-là'+(plan.changed.length?' : '+names(plan.changed):'')+'</li>'
          +'<li><b>'+plan.since.length+'</b> créé'+(plan.since.length>1?'s':'')+' depuis'+(plan.since.length?' : '+names(plan.since):'')+'</li></ul>'
          +(plan.back.length+plan.changed.length+plan.since.length?'<label class="rs-opt"'+(plan.since.length?'':' hidden')+'><input type="checkbox" class="rs-remove"> Supprimer aussi ce qui a été créé depuis</label><button type="button" class="rs-go">Restaurer</button>':'<p class="muted">Rien ne change : c’est déjà l’état actuel.</p>');
        const go=planBox.querySelector('.rs-go'); if(go) go.onclick=()=>{ applyRestore(key, plan, planBox.querySelector('.rs-remove').checked); planBox.innerHTML='<p class="rs-done">✓ Restauré. Tu peux l’annuler avec Ctrl+Z ; la synchro l’envoie à tes autres appareils.</p>'; };
      }catch(e){ planBox.innerHTML='<p class="muted">Impossible de lire cette version. Réessaie.</p>'; }
    };
    ov.querySelectorAll('input[name=rs-set]').forEach(x=>x.onchange=listVersions);
    listVersions();
  }
  // a file of the data repo, downloaded by hand (tasks.json, crm.json, notes.json): restored like a version
  function restoreKindOf(data){
    if(data && !Array.isArray(data) && (Array.isArray(data.companies) || Array.isArray(data.contacts) || Array.isArray(data.opportunities))) return 'crm';
    if(Array.isArray(data) && data.length && data.every(x=>x && typeof x==='object' && x.id)){ if(data.some(x=>x.id===POSTIT_ID || ('text' in x && !('title' in x)))) return 'notes'; if(data.some(x=>'title' in x || 'urgency' in x)) return 'tasks'; }
    return null;
  }

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
        const raw=(!data || !Array.isArray(data.tasks))?restoreKindOf(data):null;
        if(raw){   // a file taken from the data repo: shown and restored like a version
          const plan=restorePlan(raw, data);
          if(!confirm('Fichier « '+RESTORE_SETS[raw].label+' » du dépôt GitHub :\n'+plan.back.length+' élément(s) qui reviennent, '+plan.changed.length+' remis comme dans le fichier, '+plan.since.length+' créé(s) depuis (gardés).\n\nRestaurer ?')) return;
          applyRestore(raw, plan, false); return; }
        if(!data||!Array.isArray(data.tasks)) throw new Error('format');
        const extra=[data.crm?'les contacts/CRM':null, Array.isArray(data.notes)?'le calepin':null].filter(Boolean);
        if(!confirm('Remplacer les '+tasks.length+' tâche(s) actuelles par les '+data.tasks.length+' du fichier'+(extra.length?(' (ainsi que '+extra.join(' et ')+')'):'')+' ?')) return;
        tasks=recs(data.tasks); clientsList=data.clients||[]; projectsList=data.projects||[];
        tasks.forEach(t=>{ if(t.subtasks===undefined)t.subtasks=[]; if(t.recur===undefined)t.recur=null; if(t.archived===undefined)t.archived=false; });
        saveTasks(); saveClients(); saveProjects(); render(); renderArchive(); renderLists();
        if(Array.isArray(data.notes)){ notes=data.notes; consolidateNotes(); saveNotes(); renderNotes(); }
        if(data.crm){
          companies=data.crm.companies||[]; contacts=data.crm.contacts||[]; meetings=data.crm.meetings||[]; opportunities=data.crm.opportunities||[];
          cleanRecords();
          if(Array.isArray(data.crm.companyTypes)&&data.crm.companyTypes.length) companyTypesList=data.crm.companyTypes;
          saveCrm(); if(typeof renderContacts==='function') renderContacts(); if(typeof renderPipeline==='function') renderPipeline();
        }
      }catch(err){ alert('Fichier invalide.'); }
    };
    reader.readAsText(file);
  }

  const tabContacts=$('tab-contacts'), tabPipeline=$('tab-pipeline'), tabParc=$('tab-parc');
  tabs.forEach(el=>{ el.onclick=()=>{ tabs.forEach(t=>t.classList.remove('active')); el.classList.add('active'); const tgt=el.dataset.tab; tabToday.classList.toggle('hidden',tgt!=='today'); tabTasks.classList.toggle('hidden',tgt!=='tasks'); tabInbox.classList.toggle('hidden',tgt!=='inbox'); tabArchive.classList.toggle('hidden',tgt!=='archive'); tabLists.classList.toggle('hidden',tgt!=='lists'); tabContacts.classList.toggle('hidden',tgt!=='contacts'); tabPipeline.classList.toggle('hidden',tgt!=='pipeline'); tabParc.classList.toggle('hidden',tgt!=='parc'); $('tab-network').classList.toggle('hidden',tgt!=='network'); if(tgt==='network') showNetwork(); $('tab-market').classList.toggle('hidden',tgt!=='market'); if(tgt==='market') renderMarket(); if(tgt==='parc'){ renderParc(); $('parc-bridge-btn').classList.toggle('hidden', !bridgeConfigured()); renderParcSource(); if(bridgeConfigured() && parcSource().auto && (!parcData || Date.now()-(parcData.importedAt||0)>600000)) importParcFromBridge(true); } if(tgt==='today')renderToday(); if(tgt==='archive')renderArchive(); if(tgt==='contacts'){ refreshContactsTypeFilter(); renderContacts(); fetchContactInbox(); } if(tgt==='pipeline')renderPipeline(); if(tgt==='lists'){ if(bridgeConfigured()) bridgeCheck(); else renderBridgeStatus(); renderLists(); renderStats(); renderConflicts(); $('sync-owner').value=syncConfig.owner||''; $('sync-repo').value=syncConfig.repo||''; if(syncConfig.enabled) setSyncStatus('Synchro active'); } if(tgt==='inbox')fetchInbox(); }; });

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
      const infoRes=await ghFetch('https://api.github.com/repos/'+syncConfig.owner+'/'+syncConfig.repo, { headers:{ 'Accept':'application/vnd.github+json' } });
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
  // the token leaves this device (the app moved to another address, or a borrowed device): the data stays here and on GitHub
  $('sync-restore-btn').onclick=()=>openRestore();
  $('sync-forget-btn').onclick=async ()=>{
    if(!syncConfig.token){ setSyncStatus('Aucun jeton enregistré sur cet appareil.'); return; }
    if(!confirm('Retirer le jeton GitHub de cet appareil ?\n\nLa synchro s\u2019arrête ici ; tes données restent sur cet appareil et sur GitHub. Pour la reprendre, recolle un jeton.')) return;
    flushPostit(); const pend=[];   // what was waiting to leave goes first, with the token still there
    if(syncPushTimer){ clearTimeout(syncPushTimer); syncPushTimer=null; pend.push(syncPushNow()); }
    if(crmSyncPushTimer){ clearTimeout(crmSyncPushTimer); crmSyncPushTimer=null; pend.push(syncPushCrmNow()); }
    if(notesSyncPushTimer){ clearTimeout(notesSyncPushTimer); notesSyncPushTimer=null; pend.push(syncPushNotesNow()); }
    setSyncStatus('Envoi des derniers changements…'); await Promise.all(pend);
    syncConfig.token=''; syncConfig.enabled=false; await saveSyncConfig(); $('sync-token').value='';
    setSyncStatus('Jeton retiré de cet appareil.'); paintSyncPill();
  };
  $('sync-token-exp').addEventListener('change', ()=>{ syncConfig.tokenExpires=$('sync-token-exp').value||''; saveSyncConfig(); paintSyncPill(); });
  $('sync-now-btn').onclick=()=>{ if(!syncConfig.enabled){ setSyncStatus('Active la synchro d\u2019abord.'); return; } setSyncStatus('Synchronisation…'); syncPushNow(); syncPushCrmNow(); syncPushNotesNow(); };
  $('contact-add-btn').onclick=()=>openContactForm(null);
  let sigImageFile=null;

  const loadTesseract=()=>loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js', ()=>!!window.Tesseract, 'Tesseract failed to load');


  const loadXlsx=()=>loadXlsxLib();   // one loader for the Excel reader (audit A15)

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

  $('card-scan-btn').onclick=()=>$('card-scan-input').click();
  $('card-scan-input').addEventListener('change', e=>{ const f=e.target.files[0]; e.target.value=''; scanCard(f); });
  $('dup-banner-btn').onclick=()=>openDupes();
  $('vcf-import-btn').onclick=phoneImportStart;
  $('vcf-import-input').addEventListener('change', async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return; const list=parseVcf(await f.text()); if(!list.length){ alert('Aucun contact lu dans ce fichier (.vcf attendu).'); return; } openPhoneImport(list); });
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
  $('pipe-dash-toggle').onclick=()=>{ pipeDash=!pipeDash; if(pipeDash){ pipeMeet=false; pipeMap=false; } renderPipeline(); };
  $('tasks-views-btn').onclick=e=>{ e.stopPropagation(); openViewsMenu('tasks', e.currentTarget); };
  $('pipe-views-btn').onclick=e=>{ e.stopPropagation(); openViewsMenu('pipeline', e.currentTarget); };
  $('pipe-meet-toggle').onclick=()=>{ pipeMeet=!pipeMeet; if(pipeMeet){ pipeDash=false; pipeMap=false; } renderPipeline(); };
  $('pipe-xs-btn').onclick=()=>openExcelSync({ scope:'pipe' });
  if($('ai-section')) $('ai-section').hidden=!aiOn();
  { const st=()=>{ const k=aiKey(); $('ai-key-status').textContent=k?'Clé enregistrée (…'+k.slice(-4)+'). Vide le champ et enregistre pour l\u2019oublier.':'Pas de clé : copier-coller avec claude.ai.'; };
    if($('ai-key-save')){ $('ai-key-save').onclick=()=>{ const v=$('ai-key-input').value.trim(); try{ if(v) localStorage.setItem('ai-key', v); else localStorage.removeItem('ai-key'); }catch(e){} $('ai-key-input').value=''; st(); }; st(); } }
  if($('parc-xs-btn')){ $('parc-xs-btn').onclick=()=>openExcelSync({ scope:'parc' }); if(ON_PHONE) $('parc-xs-btn').hidden=true; }
  $('pipe-map-toggle').onclick=()=>{ pipeMap=!pipeMap; pipeDash=false; pipeMeet=false; parcMapSel=null; parcMapView=null; renderPipeline(); };
  $('pipe-list-toggle').onclick=()=>{ pipeMap=false; pipeList=!(pipeList && !pipeDash && !pipeMeet); pipeDash=false; pipeMeet=false; try{ localStorage.setItem('pipe-list', pipeList?'1':'0'); }catch(e){} renderPipeline(); };
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
  $('pq-restart').onclick=()=>askChoice('Repartir de zéro ?', 'Le mail collé, les fichiers et tout ce qui en a été lu (installations, contacts, dates…) seront effacés du formulaire. Ce que tu as tapé toi-même reste.', [{ label:'Repartir de zéro', value:'y' }]).then(v=>{ if(v==='y') pqRestart(); });
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
    const clr=e.target.closest('[data-clear]'); if(clr){ const i=+clr.dataset.clear, inst=pqState.installs[i]||{};
      askChoice('Vider cette installation ?', 'Toutes les infos de « '+(inst.centrale||'Installation '+(i+1))+' » seront effacées dans le formulaire (rien n\u2019est enregistré tant que tu ne valides pas).', [{ label:'Vider', value:'y' }]).then(v=>{ if(v!=='y' || !pqState) return;
        pqState.installs[i]=inst._oppId?{ _oppId:inst._oppId }:{}; const pre=i+'.';
        pqState.touched=new Set([...pqState.touched].filter(k=>!k.startsWith(pre))); pqState.auto=new Set([...pqState.auto].filter(k=>!k.startsWith(pre))); pqRender(); });
      return; }
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
  $('stage-advance-skip').onclick=cancelStageAdvance;
  $('stage-advance-nogo').onclick=noGoFromAdvance;
  $('prequal-overlay').addEventListener('click', e=>{ if(e.target.id==='prequal-overlay') closePrequalForm(); });
  $('opp-detail-overlay').addEventListener('click', e=>{ if(e.target.id==='opp-detail-overlay') closeOppDetail(); });
  $('stage-advance-overlay').addEventListener('click', e=>{ if(e.target.id==='stage-advance-overlay') cancelStageAdvance(); });
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

  // a sheet open: the keyboard drives the step — Entrée moves on, 1…9 tick the list, n notes, a calls; Entrée confirms the move
  document.addEventListener('keydown', e=>{
    if(e.ctrlKey || e.metaKey || e.altKey || window.TODO_LITE) return;
    const ae=document.activeElement, tag=ae?ae.tagName:'', typing=(tag==='INPUT' && !/^(checkbox|radio|button)$/.test(ae.type)) || tag==='TEXTAREA' || tag==='SELECT' || (ae && ae.isContentEditable);
    if(typing) return;
    const adv=$('stage-advance-overlay');
    if(adv && !adv.classList.contains('hidden')){ if(e.key==='Enter' && tag!=='BUTTON'){ e.preventDefault(); e.stopPropagation(); $('stage-advance-confirm').click(); } return; }
    const ov=$('opp-detail-overlay'); if(!ov || ov.classList.contains('hidden')) return;
    if(document.querySelector('#call-overlay, #dup-overlay, #choice-overlay:not(.hidden), #gs-overlay:not([hidden])')) return;
    const body=$('opp-detail-body');
    if(e.key==='Enter' && tag!=='BUTTON' && tag!=='A'){ const b=body.querySelector('.sp-next'); if(b){ e.preventDefault(); e.stopPropagation(); b.click(); } return; }
    if(/^[1-9]$/.test(e.key)){ const boxes=[...body.querySelectorAll('.sp-checks input[type=checkbox]')], cb=boxes[+e.key-1]; if(cb){ e.preventDefault(); e.stopPropagation(); if(!cb.disabled){ cb.checked=!cb.checked; cb.dispatchEvent(new Event('change')); } } return; }
    if(e.key==='n'){ const sec=[...body.querySelectorAll('.sheet-sec')].find(d=>d.querySelector('.qn')); if(sec){ e.preventDefault(); e.stopPropagation(); sec.open=true; const ta=sec.querySelector('textarea'); ta.scrollIntoView({ block:'center' }); ta.focus(); } return; }
    if(e.key==='a'){ const b=body.querySelector('.sp-call'); if(b){ e.preventDefault(); e.stopPropagation(); b.click(); } return; }
  }, true);

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
    const o={ id:newOppId('opp'), kind:'installation', company, title:p.inst||p.prod, centrale:p.inst||p.prod, producteur:p.prod, stage:'pricing_indicatif', requestId:null, taskId:null,
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
  // the year's goal (Suivi, GWh): crossing 75, 90 then 100 % plays its animation once, with a summary ready for the manager
  function checkGoalMilestones(won){
    if(!parcData || !parcData.objectives) return;
    const cy=new Date().getFullYear(), obj=parcData.objectives[cy]; if(!obj) return;
    const active=won.filter(p=>(p.vols[cy]||0)>0), vol=active.reduce((x,p)=>x+(p.vols[cy]||0),0)/1000, pct=vol/obj*100, reached=[100,90,75].find(l=>pct>=l)||0;
    let m={}; try{ m=JSON.parse(localStorage.getItem('goal-milestones')||'{}')||{}; }catch(e){}
    const key=String(cy), save=()=>{ try{ localStorage.setItem('goal-milestones', JSON.stringify(m)); }catch(e){} prefsToNote(); };
    if(m[key]==null){ m[key]=reached; save(); return; }   // the first look: no fanfare for old news
    if(reached<=m[key]) return;
    m[key]=reached; save();
    const f1=n=>(Math.round(n*10)/10).toLocaleString('fr-FR');
    if(window.todoCelebrate) window.todoCelebrate('goal', { sub:Math.round(pct)+' % · '+f1(vol)+' GWh sur '+f1(obj)+' GWh' }, 'g'+reached);
    const text='Objectif agrégation '+cy+' : '+Math.round(pct)+' % atteint — '+f1(vol)+' GWh sur '+f1(obj)+' GWh, '+active.length+' contrat'+(active.length>1?'s':'')+' actif'+(active.length>1?'s':'')+'.'
      +(pct<100?' Il reste '+f1(obj-vol)+' GWh pour atteindre l’objectif.':' Objectif atteint, '+f1(vol-obj)+' GWh au-delà.');
    let t=$('goal-toast'); if(t) t.remove();
    t=document.createElement('div'); t.id='goal-toast'; t.className='goal-toast'; t.setAttribute('role','status');
    t.innerHTML='<b></b><p></p><div><button type="button" class="goal-copy">Copier pour mon manager</button><button type="button" class="ghost-btn goal-close">Fermer</button></div>';
    t.querySelector('b').textContent=reached===100?'Objectif '+cy+' atteint !':reached+' % de l’objectif '+cy; t.querySelector('p').textContent=text;
    t.querySelector('.goal-copy').onclick=e=>copyToClipboard(text, e.target); t.querySelector('.goal-close').onclick=()=>t.remove();
    setTimeout(()=>{ if(!t.isConnected) document.body.appendChild(t); }, reached===100?4200:3200);
  }
  function renderParc(){ mapInPipe=false;
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
    checkGoalMilestones(won);

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
        // a renewal that will not happen: recorded as lost (pipeline « Sorties », stats), its renewal task closed
        if(opp && isExited(opp)){ act.innerHTML=''; const t=document.createElement('span'); t.className='parc-due-lost'; t.textContent='Non renouvelé'+(opp.lostAt?' le '+new Date(opp.lostAt).toLocaleDateString('fr-FR'):''); act.appendChild(t); r.classList.add('lost'); }
        else if(!window.TODO_LITE){ const nb=document.createElement('button'); nb.type='button'; nb.className='pq-link parc-due-nogo'; nb.textContent='Non renouvelé';
          nb.onclick=()=>{ if(opp){ loseOpps([opp]); renderParc(); return; }
            if(!confirm('« '+(p.inst||p.prod)+' » (fin le '+pqIsoToFr(p.fin)+') : non renouvelé ?')) return;
            const o=renewalToPipeline(p); relanceOnMove(o, null); o.stageBeforeExit=o.stage; o.stage='perdu'; o.lostAt=Date.now(); touchCrm(o); closeRenewalTask(o); saveCrm(); renderPipeline(); renderParc(); celebrate('lost', [o]); };
          act.appendChild(nb); }
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
    const wrap=document.createElement('div'); wrap.className='parc-block parc-chart-block';
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
  let FR_MAP=window.FR_MAP||null;
  // finer outlines (≈1 MB, fr-map-hd.js) swapped in when zoomed past ×2.5, so borders stay sharp
  const loadFrMapHd=()=>loadScript('fr-map-hd.js', ()=>!!window.FR_MAP_HD, 'Carte détaillée indisponible');

  const loadFrMap=()=>loadScript('fr-map.js', ()=>!!FR_MAP, 'Carte indisponible').then(()=>{ FR_MAP=FR_MAP||window.FR_MAP; });

  let parcMapLayer='won', parcMapSel=null, parcMapAll=false, parcMapView=null;
  // a clicked key figure filters the map and the table: null | 'vol' | 'active' | 'soon' | 'pending'
  let parcKpi=null, parcKpiSet=null, parcKpiLabel='';   // view = zoomed box in map units, null = all France
  const deptCodeOf=label=>{ const m=/^\s*(\d{1,3}|2A|2B)\b/i.exec(String(label||'')); if(!m) return null; const c=m[1].toUpperCase(); return /^\d$/.test(c)?'0'+c:c; };
  // technology of a plant, for the map colours (muted, so the map stays quiet and the dots read first)
  const MAP_TECHS=[ ['PV','Solaire PV','#E3B448'], ['Eolien','Éolien','#8EC5E8'], ['Hydro','Hydro','#6E9CF0'], ['Biogaz','Biogaz','#9CC37A'], ['Autre','Autre','#8B95A5'] ];
  const MAP_PHASES=[ ['qualif','Qualification','#7DA2CF'], ['offre','Offre','#E5B54F'], ['contrat','Contrat','#B49CFF'], ['onboarding','Onboarding','#5EEAD4'], ['actif','En service','#14D3A9'] ];
  const mapTech=v=>{ const f=pqFold(v||''); return /eol/.test(f)?'Eolien':/hydro/.test(f)?'Hydro':/bio|metha|cogen/.test(f)?'Biogaz':/pv|photo|solaire|ombri|toiture/.test(f)?'PV':'Autre'; };
  function parcMapPoints(layer){
    const today=toISO(new Date());
    if(parcKpiSet) return parcKpiSet.map(p=>({ code:deptCodeOf(p.siteDept||p.dept), kwc:p.kwc||0, tech:mapTech(p.enr), name:p.inst||p.prod, prod:p.prod||p.dev, who:p.dev, ref:{ parc:p }, extra:p.fin?'fin '+pqIsoToFr(p.fin):p.statut }));
    if(layer==='pipe') return opportunities.filter(o=>!o.deleted && o.kind==='installation' && inProcess(o)).map(o=>({ code:deptCodeOf(o.dept), kwc:pqNum(o.kwc||'')||0, tech:mapTech(o.install), name:oppName(o), prod:o.producteur||o.company, who:o.company, ref:{ opp:o.id }, extra:stageLabel(o.stage, o), phase:oppPhase(o) }));
    if(!parcData) return [];
    const list=layer==='pending'?parcData.items.filter(p=>p.statut==='En attente'||p.statut==='En préparation'):parcData.items.filter(p=>p.statut==='Gagné' && (!p.fin || p.fin>=today));
    return list.map(p=>({ code:deptCodeOf(p.siteDept||p.dept), kwc:p.kwc||0, tech:mapTech(p.enr), name:p.inst||p.prod, prod:p.prod||p.dev, who:p.dev, ref:{ parc:p }, extra:p.fin?'fin '+pqIsoToFr(p.fin):p.statut }));
  }
  // a plant of the map → its opportunity (pipeline) or its client's sheet (contract of the Portefeuille)
  // a plant of the Portefeuille (a line of the Suivi): its sheet in the app — found by producer + plant, or made from the Suivi line
  const parcPlantKey=(prod, inst)=>coDupKey(prod||'')+'|'+pqFold(inst||'').replace(/[^a-z0-9]/g,'');
  function findOppForParc(p){
    const keys=new Set([parcPlantKey(p.prod, p.inst), parcPlantKey(p.dev, p.inst)]);
    return opportunities.find(o=>!o.deleted && o.kind==='installation' && (keys.has(o.parcKey) || keys.has(parcPlantKey(o.producteur||o.company, oppName(o))) || keys.has(parcPlantKey(o.company, oppName(o)))));
  }
  function openParcPlant(p){
    let o=findOppForParc(p);
    if(!o){
      const today=toISO(new Date()), st=pqFold(p.statut||''), started=[p.mes, p.debut].some(d=>d && d<=today);
      const stage=/perdu|abandon|no go|resili|sans suite/.test(st)?'perdu':/gagn/.test(st)?(started || !(p.mes||p.debut)?'actif':'onboarding'):/attente/.test(st)?'offre_attente':/prepar/.test(st)?'pricing_indicatif':'actif';
      const tech=mapTech(p.enr), fr=d=>d?pqIsoToFr(d):'', now=Date.now();
      o={ id:'opp_'+now+'_'+Math.random().toString(36).slice(2,7), kind:'installation', company:p.dev||p.prod, producteur:p.prod||p.dev, centrale:p.inst||p.prod, title:p.inst||p.prod,
        stage, kwc:p.kwc?String(p.kwc):'', mwh:p.p50?String(Math.round(p.p50)):'', install:tech==='Eolien'?'Eolien':tech==='Hydro'?'Hydro':tech==='Biogaz'?'BIOGAZ':tech==='PV'?'PV':'',
        contrat:[p.ao, p.cadre].filter(Boolean).join(' ')||'', dept:p.siteDept||p.dept||'', region:p.siteRegion||p.region||'', charge:p.charge||'',
        mesEff:started?fr(p.mes):'', mesPrev:started?'':fr(p.mes), debut:fr(p.debut), fin:fr(p.fin), dateOffre:p.dateOffre||'', signDate:p.sign||'', nature:/engag/i.test(p.typeOffre||'')?'Engageante':'',
        parcKey:parcPlantKey(p.prod, p.inst), fromSuivi:true, lostAt:stage==='perdu'?now:null, createdAt:now, updatedAt:now, deleted:false, stageLog:[{ stage, at:now }],
        notesLog:[{ at:now, kind:'note', text:'Fiche créée depuis le Suivi Agrégation'+(p.statut?' (statut « '+p.statut+' »)':'')+(p.comment?' — '+p.comment:'') }] };
      opportunities.push(o); touchCrm(o); saveCrm();
    }
    openOppDetail(o.id);
    // from the Portefeuille, what matters is the plant itself: its details and characteristics open (not remembered as the new default)
    const body=$('opp-detail-body'); body.querySelectorAll('details.sheet-sec').forEach(d=>{ if(/Détails de la centrale/.test(d.querySelector('summary').textContent)) d.open=true; });
    const cmp=body.querySelector('details.req-compare'); if(cmp && !cmp.open){ cmp.dataset.noRemember='1'; cmp.open=true; }
  }
  function openMapPoint(p){
    if(p.ref && p.ref.opp){ gsTab('pipeline'); setTimeout(()=>openOppDetail(p.ref.opp),30); return; }
    if(p.ref && p.ref.parc && (p.ref.parc.inst || p.ref.parc.prod)){ openParcPlant(p.ref.parc); return; }
    const known=allCompanyNames(), pick=[p.who,p.prod].find(n=>n && known.some(k=>sameCo(k,n)));
    openCompanySheet(pick||p.who||p.prod||'');
  }
  function mapColorBy(){ try{ return localStorage.getItem('map-color')==='techno'?'techno':'phase'; }catch(e){ return 'phase'; } }   // function: the map may draw before this line runs
  var mapInPipe=false;   // the map shown in the pipeline (« Carte ») rather than in the Portefeuille; var: renderParc may run before this line
  function mapRerender(){ if(mapInPipe) renderPipeline(); else renderParc(); }
  function parcMap(){
    if(!FR_MAP){
      const w=document.createElement('div'); w.className='parc-block parc-map-block'; w.innerHTML='<div class="parc-h">Carte</div><p class="parc-muted">Chargement de la carte…</p>';
      loadFrMap().then(()=>{ if(mapInPipe){ if(!$('tab-pipeline').classList.contains('hidden')) renderPipeline(); } else if(!$('tab-parc').classList.contains('hidden')) mapRerender(); }).catch(()=>{ w.querySelector('p').textContent='Carte indisponible hors ligne (elle sera disponible après une ouverture avec réseau).'; });
      return w;
    }
    // the pipeline layer: dots by phase (where the deal is), else by technology
    const byPhase=(mapInPipe || parcMapLayer==='pipe') && !parcKpiSet && mapColorBy()==='phase', KEYS=byPhase?MAP_PHASES:MAP_TECHS;
    const color=t=>(KEYS.find(x=>x[0]===t)||KEYS[KEYS.length-1])[2];
    const techLabel=t=>(KEYS.find(x=>x[0]===t)||KEYS[KEYS.length-1])[1];
    const wrap=document.createElement('div'); wrap.className='parc-block parc-map-block';
    const head=document.createElement('div'); head.className='map-head';
    head.innerHTML='<div class="parc-h">Carte</div>';
    const seg=document.createElement('div'); seg.className='map-seg';
    [['won','Portefeuille'],['pending','Offres'],['pipe','Pipeline']].forEach(([k,l])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=l; b.className=k===parcMapLayer?'on':''; b.onclick=()=>{ parcMapLayer=k; parcMapSel=null; parcMapView=null; mapRerender(); }; seg.appendChild(b); });
    if(!parcKpiSet && !mapInPipe) head.appendChild(seg);
    if(!parcKpiSet && (mapInPipe || parcMapLayer==='pipe')){ const cb=document.createElement('div'); cb.className='map-seg map-color';
      [['phase','Par phase'],['techno','Par techno']].forEach(([k,l])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=l; b.dataset.c=k; b.className=mapColorBy()===k?'on':''; b.onclick=()=>{ try{ localStorage.setItem('map-color', k); }catch(e){} prefsToNote(); mapRerender(); }; cb.appendChild(b); });
      head.appendChild(cb); }
    wrap.appendChild(head);

    const pts=parcMapPoints(parcMapLayer); if(byPhase) pts.forEach(p=>{ p.techName=(MAP_TECHS.find(x=>x[0]===p.tech)||MAP_TECHS[4])[1]; p.tech=p.phase||'qualif'; });
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
        dots.push({ p, code, x:dep[3]+Math.cos(ang)*rad, y:dep[4]+Math.sin(ang)*rad, r:1.9+1.7*Math.sqrt(Math.max(0, p.kwc||0)/maxKwc) });   // a power typed wrong (« -5 », « abc ») gives the smallest dot
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
      if(!t){ if(parcMapSel){ parcMapSel=null; mapRerender(); } return; }
      // in the open département, a plant opens its sheet; elsewhere the first click opens the département
      if(parcMapSel===t.dataset.dep && t.dataset.i!=null && dots[+t.dataset.i]){ openMapPoint(dots[+t.dataset.i].p); return; }
      if(parcMapSel===t.dataset.dep){ parcMapSel=null; parcMapView=null; mapRerender(); return; }
      parcMapSel=t.dataset.dep;
      const dep=svgEl.querySelector('path[data-dep="'+parcMapSel+'"]');
      if(dep){ const bb=dep.getBBox(), w=Math.max(FULL.w/6, Math.max(bb.width, bb.height*FULL.w/FULL.h)*2.2); parcMapView=clampView({ w, h:w*FULL.h/FULL.w, x:bb.x+bb.width/2-w/2, y:bb.y+bb.height/2-w*FULL.h/FULL.w/2 }); }
      mapRerender();
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
      const back=document.createElement('button'); back.type='button'; back.className='map-back'; back.textContent='← Toute la France'; back.onclick=()=>{ parcMapSel=null; parcMapView=null; mapRerender(); };
      side.appendChild(back);
      top.innerHTML='<div class="map-eyebrow">'+escapeHtml(dep[1])+' · '+parcMapSel+'</div>';
    } else top.innerHTML='<div class="map-eyebrow">'+escapeHtml(parcKpiSet?parcKpiLabel:({ won:'Portefeuille signé', pending:'Offres en attente', pipe:'Pipeline' })[parcMapLayer])+'</div>';
    top.innerHTML+='<div class="map-big">'+escapeHtml(fmtMwc(total))+'</div><div class="map-sub">'+scope.length+' installation'+(scope.length>1?'s':'')+'</div>';
    side.appendChild(top);
    const mix=KEYS.map(([k,l,c])=>{ const list=scope.filter(p=>p.tech===k); return { k, l, c, n:list.length, kwc:list.reduce((x,p)=>x+p.kwc,0) }; }).filter(m=>m.n);
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
        r.onclick=()=>{ parcMapSel=code; parcMapView=null; mapRerender(); };
        r.dataset.dep=code;
        rows.appendChild(r);
      });
      attachTip(rows, t=>{ const r=t.closest && t.closest('.map-dep'); if(!r) return null; const v=by[r.dataset.dep], dep=FR_MAP.deps.find(d=>d[0]===r.dataset.dep);
        return '<b>'+escapeHtml(dep[1])+' · '+escapeHtml(fmtMwc(v.kwc))+'</b>'+v.names.slice().sort((a,b)=>b.kwc-a.kwc).slice(0,6).map(p=>tipRow(color(p.tech), p.name, p.kwc?fmtKwc(p.kwc):'')).join('')+(v.names.length>6?'<span class="muted">+ '+(v.names.length-6)+' autres</span>':''); });
    }
    side.appendChild(rows);
    // no inner scroll bar: the 6 biggest départements, the rest on demand
    if(!selV && Object.keys(by).length>6){ const more=document.createElement('button'); more.type='button'; more.className='map-more'; more.textContent=parcMapAll?'Réduire':'Voir les '+Object.keys(by).length+' départements'; more.onclick=()=>{ parcMapAll=!parcMapAll; mapRerender(); }; side.appendChild(more); }
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
    list.forEach(p=>{ t+='<tr data-pid="'+escapeHtml(p.id)+'" title="Ouvrir la fiche de la centrale"><td>'+escapeHtml(p.prod)+'</td><td>'+escapeHtml(p.inst)+'</td><td>'+escapeHtml((p.siteDept||p.dept).replace(/\s-\s.*/,''))+'</td><td>'+escapeHtml(p.enr)+'</td><td class="n">'+(p.kwc?escapeHtml(fmtKwc(p.kwc)):'')+'</td><td class="n">'+(p.p50?Math.round(p.p50).toLocaleString('fr-FR'):'')+'</td><td>'+escapeHtml(p.cadre)+'</td><td>'+escapeHtml(p.statut)+(p.renouv==='A renouveler'?' <span class="parc-flag">à renouveler</span>':'')+'</td><td>'+escapeHtml(pqIsoToFr(p.fin))+'</td></tr>'; });
    t+='</tbody></table>';
    wrap.innerHTML=t+(list.length?'':'<p class="parc-muted">Aucune installation.</p>');
    wrap.querySelectorAll('tr[data-pid]').forEach(tr=>{ tr.onclick=()=>{ const p=list.find(x=>x.id===tr.dataset.pid); if(p) openParcPlant(p); }; });
    b.appendChild(wrap);
    const n=document.createElement('div'); n.className='parc-muted'; n.textContent=list.length+' installation'+(list.length>1?'s':'')+' · '+fmtMwc(list.reduce((s,p)=>s+p.kwc,0));
    b.appendChild(n);
    return b;
  }

  // ---------- Phone → contacts: a .vcf file (what a phone exports), or the phone's own picker (Android) ----------

  // which of these are already known (same mail, phone, or name in the same company): those only get their empty boxes filled
  function phoneImportPlan(list){
    const live=contacts.filter(c=>!c.deleted), byKey=new Map(); live.forEach(c=>contactDupKeys(c).forEach(k=>byKey.set(k,c)));
    return list.map(c=>{ const known=contactDupKeys(c).map(k=>byKey.get(k)).find(Boolean)||null;
      const adds=known?['firstName','lastName','company','role','email','phone1','phone2'].filter(k=>c[k] && !known[k]):[];
      return { c, known, adds }; });
  }
  function openPhoneImport(list){
    const plan=phoneImportPlan(list); let ov=$('phone-import-overlay'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='phone-import-overlay'; ov.className='modal-overlay';
    const fresh=plan.filter(x=>!x.known), upd=plan.filter(x=>x.known && x.adds.length), same=plan.filter(x=>x.known && !x.adds.length);
    ov.innerHTML='<div class="modal-box wide" role="dialog" aria-labelledby="pi-title"><h3 id="pi-title">Contacts du téléphone</h3><p class="modal-hint pi-sum"></p><div class="pi-list"></div><div class="crm-form-actions"><button type="button" class="pi-go"></button><button type="button" class="ghost-btn pi-close">Fermer</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.pi-sum').textContent=plan.length+' contact'+(plan.length>1?'s':'')+' lu'+(plan.length>1?'s':'')+' : '+fresh.length+' nouveau'+(fresh.length>1?'x':'')+', '+upd.length+' déjà connu'+(upd.length>1?'s':'')+' à compléter, '+same.length+' déjà à jour. Rien n’est effacé ni remplacé : un contact connu ne reçoit que ses cases vides.';
    const box=ov.querySelector('.pi-list'), name=c=>[c.firstName,c.lastName].filter(Boolean).join(' ')||c.email||c.phone1;
    const row=(x, label)=>{ const l=document.createElement('label'); l.className='qn-row pi-row'; const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=true; x.cb=cb;
      const sp=document.createElement('span'); sp.innerHTML='<b></b> <small></small>'; sp.querySelector('b').textContent=name(x.c)+(x.c.company?' · '+x.c.company:''); sp.querySelector('small').textContent=label; cb.onchange=paint; l.append(cb, sp); box.appendChild(l); };
    if(fresh.length){ const h=document.createElement('h4'); h.className='dup-h'; h.textContent='Nouveaux · '+fresh.length; box.appendChild(h); fresh.forEach(x=>row(x, [x.c.email, x.c.phone1].filter(Boolean).join(' · '))); }
    if(upd.length){ const h=document.createElement('h4'); h.className='dup-h'; h.textContent='Déjà connus, cases vides à compléter · '+upd.length; box.appendChild(h);
      const L={ firstName:'prénom', lastName:'nom', company:'société', role:'fonction', email:'mail', phone1:'téléphone', phone2:'2e téléphone' }; upd.forEach(x=>row(x, '+ '+x.adds.map(k=>L[k]).join(', '))); }
    const go=ov.querySelector('.pi-go');
    function paint(){ const n=plan.filter(x=>x.cb && x.cb.checked).length; go.disabled=!n; go.textContent=n?'Importer '+n+' contact'+(n>1?'s':''):'Rien de coché'; }
    paint();
    go.onclick=()=>{ let made=0, filled=0;
      plan.filter(x=>x.cb && x.cb.checked).forEach(x=>{
        if(x.known){ x.adds.forEach(k=>{ x.known[k]=k==='company'?ensureCompany(x.c[k]):x.c[k]; }); touchCrm(x.known); filled++; }
        else { const c=Object.assign({ id:'ct_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), createdAt:Date.now(), deleted:false, relevance:0 }, x.c);
          if(c.company) c.company=ensureCompany(c.company); c.vcfAt=Date.now(); contacts.push(c); touchCrm(c); made++; } });
      saveCrm(); if(typeof renderContacts==='function') renderContacts();
      ov.querySelector('.pi-sum').textContent='✓ '+made+' contact'+(made>1?'s':'')+' ajouté'+(made>1?'s':'')+(filled?', '+filled+' complété'+(filled>1?'s':''):'')+'.'; box.innerHTML=''; go.hidden=true; };
    const close=()=>ov.remove(); ov.querySelector('.pi-close').onclick=close; ov.addEventListener('click', e=>{ if(e.target===ov) close(); }); ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } });
  }
  async function phoneImportStart(){
    // Android (Chrome): the phone's own contact picker; elsewhere: a .vcf file exported from the phone
    if('contacts' in navigator && 'ContactsManager' in window){
      try{ const sel=await navigator.contacts.select(['name','email','tel'], { multiple:true });
        if(sel && sel.length) openPhoneImport(sel.map(x=>{ const w=String((x.name||[])[0]||'').trim().split(/\s+/); const t=(x.tel||[]).map(pqFmtPhone);
          return { firstName:w.shift()||'', lastName:w.join(' '), company:'', role:'', email:String((x.email||[])[0]||'').toLowerCase(), phone1:t[0]||'', phone2:t[1]||'', comment:'' }; }));
        return; }catch(e){ /* picker refused: the file way */ } }
    // iPhone (backlog decision 26, the user has both): Safari can't read the address book, it takes the contacts exported as a file
    if(/iPhone|iPad|iPod/.test(navigator.userAgent) && !confirm('Sur iPhone : ouvre l’app Contacts, touche « Listes », reste appuyé sur une liste (ou « Tous les contacts ») puis « Exporter » et enregistre le fichier .vcf dans Fichiers. Choisis ensuite ce fichier ici.\n\nContinuer ?')) return;
    $('vcf-import-input').click();
  }
  // a business card, photographed: the text is read on the device, then the contact form opens filled in
  async function scanCard(file){
    if(!file) return; const st=$('card-scan-status'); if(st){ st.hidden=false; st.textContent='Lecture de la carte…'; }
    try{ await loadTesseract(); const { data }=await Tesseract.recognize(file, 'fra+eng'); const g=parseSignatureText(data.text||'');
      if(st) st.hidden=true;
      if(!g.firstName && !g.lastName && !g.email && !g.phone1){ alert('Je n’ai pas réussi à lire la carte. Essaie avec plus de lumière, la carte bien à plat.'); return; }
      openContactForm(null, Object.assign({}, g, { comment:[g.comment, 'Carte de visite scannée le '+new Date().toLocaleDateString('fr-FR')].filter(Boolean).join('\n') }));
    }catch(e){ if(st) st.hidden=true; alert('La lecture de la carte a échoué (connexion nécessaire la première fois).'); }
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
    const top=[['stage-advance-overlay',cancelStageAdvance],['pq-overlay',async()=>{   // the new-opportunity form: closed at once when empty, asked first when something was typed
        const typed=['pq-mail','pq1-company'].some(id=>$(id) && $(id).value.trim()) || [...document.querySelectorAll('#pq-overlay input[id^="pq-"]:not([type=checkbox]):not([type=radio])')].some(i=>i.value.trim() && i.defaultValue!==i.value);
        if(!typed || await askChoice('Fermer sans enregistrer ?', 'Ce qui a été saisi dans cette opportunité sera perdu.', [{ label:'Fermer', value:'y' }])==='y') closeOppForm(); }],['company-edit-overlay',closeCompanyEditForm],['ct-merge-overlay',()=>$('ct-merge-close').click()],
      ['sig-paste-overlay',()=>$('sig-paste-cancel').click()],['week-overlay',()=>$('week-overlay').classList.add('hidden')],['daynotes-overlay',()=>$('daynotes-overlay').classList.add('hidden')],['vcf-overlay',()=>$('vcf-close').click()]].find(([id])=>{ const o=$(id); return o && !o.classList.contains('hidden'); });
    if(!top || !$('choice-overlay').classList.contains('hidden')) return;
    e.preventDefault(); e.stopImmediatePropagation(); top[1]();
  }, true);
  $('vcf-mode-all').onchange=()=>{ if($('vcf-mode-all').checked) $('vcf-mode-changed').checked=false; };
  $('vcf-mode-changed').onchange=()=>{ if($('vcf-mode-changed').checked) $('vcf-mode-all').checked=false; };
  $('vcf-overlay').addEventListener('click', e=>{ if(e.target.id==='vcf-overlay') $('vcf-overlay').classList.add('hidden'); });

  // ---------- « Marché » : the market figures a producer talks about, read from the public PowerKlock API ----------
  // Plain GET, no key (https://tomsremy.github.io/PowerKlock/data/api.json). Every block names its source (the API's rule).
  // Only the few numbers shown are kept on this device, so the page and the call screen still show the last ones offline.
  const MK_BASE='https://tomsremy.github.io/PowerKlock/data/';
  const MK_SRC={ spot:'ENTSO-E Transparency Platform, via PowerKlock', m0:'CRE open data (Licence Ouverte) ; estimation et prévision PowerKlock', cap:'PowerKlock, à partir de RTE éCO2mix et ENTSO-E' };
  const MK_ZONES=[['FR','France'],['DE_LU','Allemagne'],['BE','Belgique'],['NL','Pays-Bas'],['ES','Espagne'],['CH','Suisse'],['IT_NORD','Italie Nord']];
  let marketData=null, marketLoading=null;
  try{ marketData=JSON.parse(localStorage.getItem('market-cache')||'null'); }catch(e){}
  const mkNum=(v,d)=>v==null || isNaN(v)?'—':Number(v).toLocaleString('fr-FR',{ minimumFractionDigits:d==null?1:d, maximumFractionDigits:d==null?1:d });
  const mkMonth=k=>{ const [y,m]=k.split('-'); return new Date(+y, +m-1, 1).toLocaleDateString('fr-FR',{ month:'short', year:'numeric' }).replace('.',''); };
  const mkDay=iso=>iso?new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' }):'';
  async function loadMarket(force){
    if(marketLoading) return marketLoading;
    if(!force && marketData && Date.now()-marketData.at<30*60000) return marketData;
    const get=async f=>{ const r=await fetch(MK_BASE+f, { cache:'no-cache' }); if(!r.ok) throw new Error(f+' '+r.status); return r.json(); };
    const now=new Date(), ym=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'), prevM=new Date(now.getFullYear(), now.getMonth()-1, 1);
    marketLoading=(async()=>{
      const [prices, cur, prev, m0, cap]=await Promise.all([get('prices.json'), get('history/monthly/'+ym(now)+'.json').catch(()=>null), get('history/monthly/'+ym(prevM)+'.json').catch(()=>null), get('cre_m0.json').catch(()=>null), get('history/fr_capture.json').catch(()=>null)]);
      const fr=(prices.zones||[]).find(z=>z.code==='FR'); if(!fr) throw new Error('FR');
      const days=[].concat(prev && prev.zones && prev.zones.FR || [], cur && cur.zones && cur.zones.FR || []).filter(x=>x && x.d).sort((a,b)=>a.d.localeCompare(b.d));
      const lastDay=days.filter(x=>Math.abs((x.avg||0)-fr.today)<0.06).pop()||days[days.length-1]||null;
      const out={ at:Date.now(), updated:prices.updated,
        spot:{ day:lastDay?lastDay.d:'', avg:fr.today, vs:fr.vsYday, min:fr.min, minH:fr.minHour, max:fr.max, maxH:fr.maxHour, neg:fr.negHours||0, peak:lastDay?lastDay.peakAvg:null, off:lastDay?lastDay.offAvg:null, ren:lastDay?lastDay.renPct:null, q:(fr.hourly||[]).slice(0,96) },
        days:days.slice(-30).map(x=>({ d:x.d, avg:x.avg, neg:x.negH||0 })),
        zones:MK_ZONES.map(([c,n])=>{ const z=(prices.zones||[]).find(x=>x.code===c); return z?{ c, n, avg:z.today, vs:z.vsYday, neg:z.negHours||0 }:null; }).filter(Boolean) };
      if(m0 && m0.official){ const o=m0.official, rows=[];
        const offM=Object.keys(o.monthly||{}).sort().slice(-3);
        offM.forEach(k=>rows.push({ m:k, base:o.monthly[k], wind:(o.wind||{})[k], solar:(o.solar||{})[k], how:'CRE' }));
        const lastOff=offM[offM.length-1]||'';
        Object.keys(m0.estimate||{}).sort().filter(k=>k>lastOff).forEach(k=>{ const e=m0.estimate[k]; rows.push({ m:k, base:e.base, wind:e.wind, solar:e.solar, how:'estimation', days:e.days }); });
        // a month the CRE published for the base only: its wind / solar come from the estimate
        rows.forEach(r=>{ const e=(m0.estimate||{})[r.m]; if(r.how==='CRE' && e){ if(r.wind==null){ r.wind=e.wind; r.est=true; } if(r.solar==null){ r.solar=e.solar; r.est=true; } } });
        (m0.forecast||[]).slice(0,3).forEach(f=>rows.push({ m:f.month, base:f.base, wind:f.wind, solar:f.solar, how:'prévision' }));
        const ann=Object.keys(o.annual||{}).sort().slice(-2).map(y=>({ y, v:o.annual[y] }));
        out.m0={ rows, ann, cur:m0.currentMonth }; }
      if(cap && cap.days && cap.days.length){ const F=cap.fields||[], ix=k=>F.indexOf(k)+1, last=cap.days[cap.days.length-1][0];
        const win=(label, from, to)=>{ const ds=cap.days.filter(x=>x[0]>=from && x[0]<=to); if(!ds.length) return null; const s=k=>ds.reduce((t,x)=>t+(x[ix(k)]||0),0);
          const base=s('pSum')/Math.max(1,s('pN')), sol=s('sE')?s('sR')/s('sE'):null, wnd=s('wE')?s('wR')/s('wE'):null;
          return { label, base, sol, wnd, solR:sol!=null?sol/base:null, wndR:wnd!=null?wnd/base:null, n:ds.length }; };
        const d30=toISO(new Date(new Date(last+'T12:00:00').getTime()-29*864e5)), y=last.slice(0,4);
        out.cap={ last, rows:[win('30 derniers jours', d30, last), win('Mois en cours', last.slice(0,7)+'-01', last), win('Depuis janvier', y+'-01-01', last), win('Année '+(y-1), (y-1)+'-01-01', (y-1)+'-12-31')].filter(Boolean) }; }
      marketData=out; try{ localStorage.setItem('market-cache', JSON.stringify(out)); }catch(e){}
      return out; })();
    try{ return await marketLoading; } finally { marketLoading=null; }
  }
  // the few words to open a call or a mail with
  function marketLine(){
    const m=marketData; if(!m || !m.spot) return '';
    const s=m.spot, sol=m.m0 && m.m0.rows.filter(r=>r.how==='CRE' && r.solar!=null && !r.est).pop(), c=m.cap && m.cap.rows[0];
    return ['Spot France du '+(s.day?pqIsoToFr(s.day):'dernier jour')+' : '+mkNum(s.avg)+' €/MWh'+(s.neg?' ('+mkNum(s.neg,1)+' h négatives)':''),
      sol?'M0 solaire '+mkMonth(sol.m)+' : '+mkNum(sol.solar)+' €/MWh':'', c && c.sol!=null?'capture solaire 30 j : '+mkNum(c.sol)+' €/MWh ('+Math.round(c.solR*100)+' % du prix moyen)':''].filter(Boolean).join(' · ');
  }
  function marketText(){
    const m=marketData; if(!m) return '';
    const s=m.spot, L=['Marché de l’électricité · '+(s.day?mkDay(s.day):''), '',
      'Spot France (day-ahead) : '+mkNum(s.avg)+' €/MWh'+(s.vs!=null?' ('+(s.vs>0?'+':'')+mkNum(s.vs)+' vs la veille)':'')+' · pointe '+mkNum(s.peak)+' · hors pointe '+mkNum(s.off)+' · min '+mkNum(s.min)+' à '+(s.minH||'')+' · max '+mkNum(s.max)+' à '+(s.maxH||'')+' · '+mkNum(s.neg,1)+' h à prix négatif'];
    if(m.m0){ L.push('', 'M0 (€/MWh) — base / éolien / solaire :'); m.m0.rows.forEach(r=>L.push('  '+mkMonth(r.m)+' : '+mkNum(r.base)+' / '+mkNum(r.wind)+' / '+mkNum(r.solar)+(r.how!=='CRE'?' ('+r.how+' PowerKlock)':r.est?' (éolien / solaire estimés)':' (CRE)'))); }
    if(m.cap){ L.push('', 'Prix capturés (€/MWh, en % du prix moyen) :'); m.cap.rows.forEach(r=>L.push('  '+r.label+' : solaire '+mkNum(r.sol)+' ('+Math.round(r.solR*100)+' %) · éolien '+mkNum(r.wnd)+' ('+Math.round(r.wndR*100)+' %) · moyenne '+mkNum(r.base))); }
    L.push('', 'Sources : '+MK_SRC.spot+' ; '+MK_SRC.m0+' ; '+MK_SRC.cap+'. Jours de livraison, heure de Paris.');
    return L.join('\n');
  }
  // charts drawn to scale: the day's 96 quarter-hours, then the last 30 days
  function mkDayChart(q){
    if(!q || !q.length) return '<p class="mk-empty">Pas de courbe pour ce jour.</p>';
    const W=640, H=200, pl=40, pr=8, pt=10, pb=24, lo=Math.min(0, ...q), hi=Math.max(...q, 1), y=v=>pt+(hi-v)/(hi-lo)*(H-pt-pb), x=i=>pl+i*(W-pl-pr)/(q.length-1);
    const step=hi-lo>300?100:hi-lo>120?50:hi-lo>60?20:10, ticks=[]; for(let t=Math.ceil(lo/step)*step; t<=hi; t+=step) ticks.push(t);
    const line=q.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
    return '<svg class="mk-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Prix au quart d’heure">'
      +ticks.map(t=>'<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(t)+'" y2="'+y(t)+'" class="mk-grid'+(t===0?' zero':'')+'"/><text x="'+(pl-6)+'" y="'+(y(t)+3.5)+'" class="mk-ax" text-anchor="end">'+t+'</text>').join('')
      +[0,6,12,18,24].map(h=>'<text x="'+x(Math.min(q.length-1,h*4))+'" y="'+(H-6)+'" class="mk-ax" text-anchor="middle">'+h+' h</text>').join('')
      +'<path d="'+line+' L'+x(q.length-1)+' '+y(lo)+' L'+x(0)+' '+y(lo)+' Z" class="mk-area"/><path d="'+line+'" class="mk-line"/>'
      +q.map((v,i)=>v<0?'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="2.2" class="mk-neg"/>':'').join('')+'</svg>';
  }
  function mk30Chart(days){
    if(!days || !days.length) return '<p class="mk-empty">Pas d’historique.</p>';
    const W=640, H=200, pl=40, pr=8, pt=10, pb=24, hi=Math.max(...days.map(d=>d.avg), 1), lo=Math.min(0, ...days.map(d=>d.avg)), y=v=>pt+(hi-v)/(hi-lo)*(H-pt-pb), bw=(W-pl-pr)/days.length;
    const step=hi>300?100:hi>120?50:20, ticks=[]; for(let t=Math.ceil(lo/step)*step; t<=hi; t+=step) ticks.push(t);
    return '<svg class="mk-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Prix moyen des 30 derniers jours">'
      +ticks.map(t=>'<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(t)+'" y2="'+y(t)+'" class="mk-grid'+(t===0?' zero':'')+'"/><text x="'+(pl-6)+'" y="'+(y(t)+3.5)+'" class="mk-ax" text-anchor="end">'+t+'</text>').join('')
      +days.map((d,i)=>{ const top=y(Math.max(0,d.avg)), bot=y(Math.min(0,d.avg)); return '<rect x="'+(pl+i*bw+bw*.15).toFixed(1)+'" width="'+(bw*.7).toFixed(1)+'" y="'+top.toFixed(1)+'" height="'+Math.max(1,bot-top).toFixed(1)+'" class="mk-bar'+(d.neg?' has-neg':'')+'"><title>'+pqIsoToFr(d.d)+' : '+mkNum(d.avg)+' €/MWh'+(d.neg?' · '+mkNum(d.neg,1)+' h négatives':'')+'</title></rect>'; }).join('')
      +[0, Math.floor(days.length/2), days.length-1].map(i=>'<text x="'+(pl+i*bw+bw/2)+'" y="'+(H-6)+'" class="mk-ax" text-anchor="middle">'+escapeHtml(days[i].d.slice(8)+'/'+days[i].d.slice(5,7))+'</text>').join('')+'</svg>';
  }
  // The page shows a ready-made PowerKlock dashboard (its « solo » link: read-only, always up to date, PowerPoint export).
  // The templates are the site's own (General › My dashboard › templates); « Mon tableau » takes a link copied from the site.
  const MK_S=t=>({ t:'s', title:t, w:12, h:1 }), MK_W=(wid,w,h,p)=>Object.assign({ t:'w', wid, w, h }, p?{ p }:{});
  const MK_BOARDS=[
    { id:'orig', name:'Origination · France', label:'Origination France : forwards, prix capturés, M0, garanties d’origine', items:[
      MK_S('Prices & forwards'), MK_W('kpi-da',3,2,{ zone:'FR' }), MK_W('kpi-fuel',3,2,{ c:'eua' }), MK_W('kpi-go',3,2), MK_W('kpi-fr-nuclear',3,2),
      MK_W('pf-curve',6,5,{ country:'FR' }), MK_W('pf-history',6,5,{ country:'FR', tenor:'Y+1', win:'3Y' }),
      MK_S('Value of renewables'), MK_W('ren-cr',6,5,{ zone:'FR', window:'1Y' }), MK_W('ren-daily',6,5,{ zone:'FR', window:'1Y' }),
      MK_W('fr-m0',12,5,{ tech:'solar', view:'price', win:'2Y' }), MK_W('fr-m0-forecast',12,6),
      MK_S('Regions & capacity'), MK_W('fr-reg-lf',6,5), MK_W('cap-history',6,5,{ country:'FR' }),
      MK_S('Guarantees of origin'), MK_W('go-cal1',6,5), MK_W('go-cal',6,5)] },
    { id:'mu', name:'Market update', label:'Point marché : dans l’ordre de la présentation interne', items:[
      MK_S('1 · Supply'), MK_W('wx-outlook',6,5,{ series:'precip' }), MK_W('wx-outlook',6,5,{ series:'solar' }), MK_W('wx-outlook',6,5,{ series:'wind' }), MK_W('nuc-monthly-years',6,5),
      MK_W('gas-storage-years',6,5), MK_W('hydro-reservoirs',6,5,{ country:'FR' }),
      MK_S('2 · Demand'), MK_W('wx-outlook',6,5,{ series:'temp' }), MK_W('fr-load-normal',6,5),
      MK_S('3 · News and geopolitics'), MK_W('fuel-coal-oil',6,5), MK_W('news-latest',6,5),
      MK_S('4 · Prices'), MK_W('fr-cal-history',6,5,{ win:'3M' }), MK_W('fr-cal-drivers',6,5,{ win:'6M' }), MK_W('ttf-cal-history',6,5,{ win:'6M' }), MK_W('ttf-fwd-table',6,5),
      MK_W('fr-spot-monthly',6,5), MK_W('fr-spot-30d',6,5), MK_W('fr-spot-day',6,7,{ day:'latest' }), MK_W('fr-spot-day',6,7,{ day:'previous' })] },
    { id:'spot', name:'Spot trader · France', label:'Spot France : prix du jour, consommation, échanges', items:[
      MK_S('Today'), MK_W('kpi-da',2,2,{ zone:'FR' }), MK_W('kpi-da',2,2,{ zone:'DE_LU' }), MK_W('kpi-fr-load',2,2), MK_W('kpi-fr-net',2,2), MK_W('kpi-fr-nuclear',2,2), MK_W('kpi-hdd',2,2),
      MK_W('da-intraday',8,5), MK_W('cb-fr-avg',4,5), MK_S('France fundamentals'), MK_W('load-day',6,5,{ zone:'FR' }), MK_W('ren-intraday',6,5), MK_W('cb-intraday',12,5)] },
    { id:'fund', name:'Fundamentals', label:'Fondamentaux : combustibles, carbone, nucléaire, météo', items:[
      MK_S('Fuels & carbon'), MK_W('kpi-fuel',3,2,{ c:'eua' }), MK_W('kpi-fuel',3,2,{ c:'ttf' }), MK_W('kpi-fuel',3,2,{ c:'coal' }), MK_W('kpi-fuel',3,2,{ c:'brent' }),
      MK_W('fuel-eua-ttf',6,5), MK_W('fuel-switch',6,5), MK_W('fuel-storage',6,5), MK_W('spark-daily',6,5),
      MK_S('Supply & weather'), MK_W('nuc-hist',6,5), MK_W('hdd',6,5), MK_S('Forwards'), MK_W('fwd-power',6,5), MK_W('fwdc-ttf',6,5)] }
  ];
  const MK_SITE='https://tomsremy.github.io/PowerKlock/index.html';
  const mkB64u=bytes=>{ let b=''; bytes.forEach(x=>{ b+=String.fromCharCode(x); }); return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
  async function mkBoardUrl(bd){   // « z » + base64url of the raw-deflated JSON, as the site expects (« j » + plain JSON if the browser can't compress)
    const raw=new TextEncoder().encode(JSON.stringify({ n:bd.name, items:bd.items }));
    if(window.CompressionStream){ try{ const buf=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(); return MK_SITE+'#solo=z'+mkB64u(new Uint8Array(buf)); }catch(e){} }
    return MK_SITE+'#solo=j'+mkB64u(raw);
  }
  const mkPick=()=>{ try{ return localStorage.getItem('market-board')||'mu'; }catch(e){ return 'mu'; } };
  const mkOwn=v=>{ const m=/^https:\/\/tomsremy\.github\.io\/PowerKlock\/(?:index\.html)?#(?:solo|board)=([zj][A-Za-z0-9_-]+)$/.exec(String(v||'').trim()); return m?MK_SITE+'#solo='+m[1]:null; };
  async function renderMarket(force){
    const root=$('market-root'); if(!root) return; const e=escapeHtml, pick=mkPick(), own=mkOwn(pick), bd=MK_BOARDS.find(b=>b.id===pick)||(own?null:MK_BOARDS[0]);
    loadMarket(force).catch(()=>{});   // the figures behind « Copier pour un mail » and the call screen
    const head='<div class="mk-head"><div><h2>Marché de l’électricité</h2><span class="mk-upd">Tableau de bord PowerKlock, toujours à jour · sources citées sous chaque graphique</span></div>'
      +'<div class="mk-acts"><select class="mk-board" aria-label="Tableau de bord">'+MK_BOARDS.map(b=>'<option value="'+b.id+'"'+(bd && bd.id===b.id?' selected':'')+'>'+e(b.label)+'</option>').join('')+'<option value="own"'+(own?' selected':'')+'>Mon tableau (lien copié sur PowerKlock)…</option></select>'
      +'<button type="button" class="pipe-bar-btn mk-copy" title="Spot, M0 et prix capturés, prêts à coller dans un mail ou dans Teams">Copier pour un mail</button><a class="pipe-bar-btn mk-open" target="_blank" rel="noopener">Ouvrir en grand ↗</a></div></div>';
    if(!navigator.onLine){ root.innerHTML=head; root.querySelector('.mk-open').remove(); mkCards(root); mkWire(root); return; }
    const url=own||await mkBoardUrl(bd);
    root.innerHTML=head+'<iframe class="mk-frame" title="Tableau de bord PowerKlock" loading="lazy" referrerpolicy="no-referrer"></iframe>';
    root.querySelector('.mk-frame').src=url; root.querySelector('.mk-open').href=url;
    mkWire(root);
  }
  function mkWire(root){
    const sel=root.querySelector('.mk-board');
    sel.onchange=()=>{ let v=sel.value;
      if(v==='own'){ const u=prompt('Colle le lien de ton tableau de bord PowerKlock (General › API › « A whole dashboard ») :', mkOwn(mkPick())||''); if(u==null){ renderMarket(); return; } if(!mkOwn(u)){ alert('Ce n’est pas un lien de tableau PowerKlock (il contient « #solo= »).'); renderMarket(); return; } v=u.trim(); }
      try{ localStorage.setItem('market-board', v); }catch(e2){} prefsToNote(); renderMarket(); };
    root.querySelector('.mk-copy').onclick=async ev=>{ const b=ev.currentTarget; try{ await loadMarket(); }catch(e2){}
      if(!marketData){ b.textContent='Pas de données (hors ligne ?)'; return; }
      navigator.clipboard.writeText(marketText()).then(()=>{ b.textContent='Copié ✓'; setTimeout(()=>{ b.textContent='Copier pour un mail'; }, 1800); }, ()=>{ b.textContent='Copie impossible'; }); };
  }
  // offline: the last figures read, drawn by the app
  function mkCards(root){
    const m=marketData, e=escapeHtml;
    if(!m){ root.insertAdjacentHTML('beforeend', '<div class="mk-load">Hors ligne, et aucun chiffre gardé pour l’instant.</div>'); return; }
    const s=m.spot, src=t=>'<p class="mk-src">Source : '+e(t)+'. Jours de livraison, heure de Paris.</p>';
    const card=(k,v,sub,cls)=>'<div class="mk-kpi'+(cls?' '+cls:'')+'"><span class="mk-k">'+e(k)+'</span><b>'+v+'</b><span class="mk-sub">'+sub+'</span></div>';
    const last30=m.days||[], avg30=last30.length?last30.reduce((t,d)=>t+d.avg,0)/last30.length:null, neg30=last30.reduce((t,d)=>t+d.neg,0);
    let h='<p class="mk-off">Hors ligne : derniers chiffres lus le '+e(new Date(m.at).toLocaleString('fr-FR',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }))+(s.day?' (spot du '+e(mkDay(s.day))+')':'')+'.</p>';
    h+='<div class="mk-kpis">'
      +card('Spot France', mkNum(s.avg)+'<small> €/MWh</small>', s.vs!=null?'<i class="'+(s.vs>0?'up':'down')+'">'+(s.vs>0?'▲ +':'▼ ')+mkNum(s.vs)+'</i> vs la veille':'moyenne du jour')
      +card('Pointe / hors pointe', mkNum(s.peak,0)+' <small>/</small> '+mkNum(s.off,0), 'pointe 8 h – 20 h, jours ouvrés')
      +card('Min · max', mkNum(s.min,0)+' <small>→</small> '+mkNum(s.max,0), 'à '+e(s.minH||'—')+' et à '+e(s.maxH||'—'))
      +card('Heures à prix négatif', mkNum(s.neg,1)+'<small> h</small>', mkNum(neg30,1)+' h sur 30 jours', s.neg?'warn':'')
      +card('Moyenne 30 jours', mkNum(avg30)+'<small> €/MWh</small>', s.ren!=null?'renouvelables '+mkNum(s.ren,0)+' % du mix le '+e(pqIsoToFr(s.day)):'')
      +'</div>';
    h+='<div class="mk-grid2"><section class="mk-card"><h3>Prix au quart d’heure · '+e(s.day?pqIsoToFr(s.day):'')+'</h3>'+mkDayChart(s.q)+src(MK_SRC.spot)+'</section>'
      +'<section class="mk-card"><h3>Prix moyen par jour · 30 derniers jours</h3>'+mk30Chart(last30)+'<p class="mk-leg"><i class="b"></i>prix moyen du jour <i class="n"></i>jour avec des heures négatives</p>'+src(MK_SRC.spot)+'</section></div>';
    h+='<div class="mk-grid2">';
    if(m.m0){ h+='<section class="mk-card"><h3>M0 : prix de marché de référence (€/MWh)</h3><p class="mk-why">Le prix de référence de la CRE pour le complément de rémunération : le producteur touche la différence entre son tarif et le M0 de sa filière.</p>'
      +'<table class="mk-table"><thead><tr><th>Mois</th><th class="n">Base</th><th class="n">Éolien</th><th class="n">Solaire</th><th></th></tr></thead><tbody>'
      +m.m0.rows.map(r=>'<tr class="'+(r.how==='CRE'?'':'mk-est')+'"><td>'+e(mkMonth(r.m))+'</td><td class="n">'+mkNum(r.base)+'</td><td class="n">'+mkNum(r.wind)+'</td><td class="n">'+mkNum(r.solar)+'</td><td><span class="mk-tag '+(r.how==='CRE'?'off':r.how==='estimation'?'est':'fc')+'">'+(r.how==='CRE'?(r.est?'CRE · éol./sol. estimés':'CRE officiel'):r.how==='estimation'?'estimation'+(r.days?' · '+r.days+' j':''):'prévision')+'</span></td></tr>').join('')
      +'</tbody></table>'+(m.m0.ann.length?'<p class="mk-why">M0 annuel officiel : '+m.m0.ann.map(a=>e(a.y)+' : '+mkNum(a.v)+' €/MWh').join(' · ')+'</p>':'')+src(MK_SRC.m0)+'</section>'; }
    if(m.cap){ const best=m.cap.rows[2]||m.cap.rows[0], prevY=m.cap.rows[3];
      h+='<section class="mk-card"><h3>Prix capturés : ce que valent le solaire et l’éolien</h3><p class="mk-why">Le prix moyen touché par la production, comparé au prix moyen du marché. En dessous de 100 %, la filière produit surtout quand les prix sont bas.</p>'
      +'<table class="mk-table"><thead><tr><th>Période</th><th class="n">Prix moyen</th><th class="n">Solaire</th><th class="n">Éolien</th></tr></thead><tbody>'
      +m.cap.rows.map(r=>'<tr><td>'+e(r.label)+'</td><td class="n">'+mkNum(r.base)+'</td><td class="n">'+mkNum(r.sol)+' <span class="mk-rate'+(r.solR<.8?' low':'')+'">'+Math.round(r.solR*100)+' %</span></td><td class="n">'+mkNum(r.wnd)+' <span class="mk-rate'+(r.wndR<.8?' low':'')+'">'+Math.round(r.wndR*100)+' %</span></td></tr>').join('')
      +'</tbody></table>'+(best && prevY?'<aside class="mk-take"><b>À retenir</b> Le solaire capte '+Math.round(best.solR*100)+' % du prix moyen depuis janvier, contre '+Math.round(prevY.solR*100)+' % sur '+e(prevY.label.replace('Année ',''))+'.</aside>':'')+src(MK_SRC.cap)+'</section>'; }
    h+='</div>';
    if(m.zones && m.zones.length){ const mx=Math.max(...m.zones.map(z=>Math.abs(z.avg)),1);
      h+='<section class="mk-card"><h3>Spot chez les voisins · même jour (€/MWh)</h3><div class="mk-zones">'+m.zones.map(z=>'<div class="mk-zone'+(z.c==='FR'?' fr':'')+'"><span>'+e(z.n)+'</span><i style="width:'+Math.max(2,Math.abs(z.avg)/mx*100)+'%"></i><b>'+mkNum(z.avg)+'</b>'+(z.neg?'<em>'+mkNum(z.neg,1)+' h nég.</em>':'<em></em>')+'</div>').join('')+'</div>'+src(MK_SRC.spot)+'</section>'; }
    root.insertAdjacentHTML('beforeend', '<div class="mk-cards">'+h+'</div>');
  }
  window.todoExtraCommands=(window.todoExtraCommands||[]).concat([{ t:'Marché : prix spot, M0, captures', k:'marche prix spot m0 cre capture powerklock electricite', go:()=>gsTab('market') }]);

  // Test hooks (tests/smoke_test.py and the mail corpus set window.TODO_TEST_HOOKS before loading)
  if(window.TODO_TEST_HOOKS) window.__todo={ threeWayMerge, mergeNoteLines, nextRecurDate, parseVcf, parsePipeMail, parsePipeMailInstallations:parseMailInstallations, parseSignatureBlock, parseSignatureText, xlsxToInstallations:(rowsBySheet)=>pqRowsToInstallations(Object.keys(rowsBySheet), n=>rowsBySheet[n]), codeAffaire, pricingMail };

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
  // the list is built once and kept until a contact, company, client or installation changes (audit A1: it used to be
  // rebuilt for every text holding a link, and each link kept its own copy — memory grew with tasks × contacts)
  let linkCache=null;
  const maxUpd=l=>{ let m=0; for(const x of l) if(x && x.updatedAt>m) m=x.updatedAt; return m; };
  function linkTargets(){
    const st=[contacts.length, companies.length, opportunities.length, clientsList.length, maxUpd(contacts), maxUpd(companies), maxUpd(opportunities)].join('|');
    if(linkCache && linkCache.st===st && linkCache.c===contacts && linkCache.co===companies && linkCache.o===opportunities) return linkCache.list;
    const list=[];
    activeContacts().forEach(c=>{ const n=[c.firstName,c.lastName].filter(Boolean).join(' '); if(n) list.push({ id:'ct:'+c.id, type:'Contact', name:n, sub:c.company||'', ref:c.id }); });
    allCompanyNames().forEach(n=>list.push({ id:'co:'+pqFold(n).replace(/[^a-z0-9]/g,''), type:'Société', name:n, sub:'', ref:n }));
    opportunities.filter(o=>!o.deleted && o.kind==='installation').forEach(o=>list.push({ id:'op:'+o.id, type:'Installation', name:oppName(o), sub:o.company||'', ref:o.id }));
    const byName=new Map(); list.forEach(x=>{ const k=pqFold(x.name); if(!byName.has(k)) byName.set(k, x); });
    linkCache={ st, c:contacts, co:companies, o:opportunities, list, byName };
    return list;
  }
  function openLinkTarget(r){ if(r.type==='Contact') openContactEverywhere(r.ref); else if(r.type==='Société') openCompany(r.ref); else { gsTab('pipeline'); setTimeout(()=>openOppDetail(r.ref),30); } }
  function resolveLink(name, T){ const f=pqFold(String(name).trim()); if(!T || T===(linkCache && linkCache.list)){ linkTargets(); return linkCache.byName.get(f)||null; } return T.find(x=>pqFold(x.name)===f)||null; }
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
      if(r){ const target=r; a.onclick=e=>{ e.stopPropagation(); openLinkTarget(target); }; } el.appendChild(a); last=at+m.length; return m; });
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
      const pre=o.kind==='prequal', id=node('op:'+o.id, pre?'prequal':'installation', pre?o.company+' (pré-qualif)':oppName(o), [o.company, stageLabel(o.stage, o), fmtKwc(o.kwc)].filter(Boolean).join(' · '), ()=>{ gsTab('pipeline'); setTimeout(()=>openOppDetail(o.id),30); });
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
      (o.stageLog||[]).forEach((s,i)=>{ if(i===0 && Math.abs(s.at-(o.createdAt||0))<60000) return; ev.push({ at:s.at, kind:'stage', html:escapeHtml(o.kind==='prequal'?'Pré-qualif':oppName(o))+' → <b>'+escapeHtml(stageLabel(s.stage, s))+'</b>' }); });
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
    section(colL,'Pipeline',live.map(o=>row(oppName(o),stageLabel(o.stage, o)+(o.dept?' · '+o.dept:''),fmtKwc(o.kwc),()=>{ gsTab('pipeline'); setTimeout(()=>openOppDetail(o.id),30); })),'Aucune opportunité en cours.'+(gone?' ('+gone+' terminée'+(gone>1?'s':'')+')':''));
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
      if(ins.length){ const top=ins.reduce((a,b)=>stageIndex(b.stage)>stageIndex(a.stage)?b:a); L.push(['Pipeline', ins.length+' installation'+(ins.length>1?'s':'')+(mw(ins)?' · '+mw(ins):'')+' · '+stageLabel(top.stage, top)]); }
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
      L.push(['', [o.company, stageLabel(o.stage, o)].filter(Boolean).join(' · ')]);
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
    if(k==='rq:'){ const l=opportunities.filter(o=>!o.deleted && o.requestId===v && o.kind==='installation'), kw=l.reduce((s,o)=>s+kwcNum(o),0), st=[...new Set(l.map(o=>stageLabel(o.stage, o)))];
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
  const reqLabelOf=o=>{ const r=o.requestId && opportunities.find(x=>x.id===o.requestId); return r && !r.deleted?r.label||'':''; };
  function gsSearch(q){
    const words=pqFold(q).split(/\s+/).filter(Boolean); if(!words.length) return [];
    const hit=(...parts)=>{ const s=pqFold(parts.filter(Boolean).join(' ')); return words.every(w=>s.includes(w)); };
    const score=title=>pqFold(title).startsWith(words[0])?0:1;
    const top=(list,n)=>list.sort((a,b)=>score(a.title)-score(b.title)||a.title.localeCompare(b.title,'fr')).slice(0,n);
    const groups=[];
    const tk=top(tasks.filter(t=>!t.deleted && hit(t.title,t.client,t.project,t.description)).map(t=>({ ic:t.archived?'✓':'T', title:plainLinks(t.title), sub:[t.client, t.archived?'archivée':(t.due?'pour le '+t.due.split('-').reverse().join('/'):'')].filter(Boolean).join(' · '), go:()=>openTaskEverywhere(t.id) })),6);
    const ct=top(activeContacts().filter(c=>hit(c.firstName,c.lastName,c.company,c.role,c.email,(c.phone1||'').replace(/\D/g,''),(c.phone2||'').replace(/\D/g,''))).map(c=>({ ic:((c.firstName||'')[0]||'')+((c.lastName||'')[0]||'')||'?', title:[c.firstName,c.lastName].filter(Boolean).join(' ')||'(sans nom)', sub:[c.role,c.company,c.phone1].filter(Boolean).join(' · '), go:()=>openContactEverywhere(c.id) })),5);
    if(ct.length) groups.push(['Contacts',ct]);
    const co=top(allCompanyNames().filter(n=>hit(n)).map(n=>{ const nC=activeContacts().filter(c=>c.company===n).length, nO=activeOpportunities().filter(o=>o.company===n).length;
      return { ic:'S', title:n, sub:[nC?nC+' contact'+(nC>1?'s':''):'', nO?nO+' opportunité'+(nO>1?'s':''):''].filter(Boolean).join(' · ')||'Société', go:()=>openCompany(n) }; }),5);
    if(co.length) groups.push(['Sociétés',co]);
    const op=top(opportunities.filter(o=>!o.deleted && o.kind!=='request' && hit(oppName(o),o.company,o.producteur,o.dept,o.commune,o.cp,o.spv,o.siret,o.charge,reqLabelOf(o),codeAffaire(o))).map(o=>({ ic:'P', title:oppName(o), sub:[o.company, stageLabel(o.stage, o)].filter(Boolean).join(' · '), right:fmtKwc(o.kwc), go:()=>{ gsTab('pipeline'); setTimeout(()=>openOppDetail(o.id),30); } })),6);
    if(op.length) groups.push(['Pipeline',op]);
    // a block named by hand (« Lot toitures »): the request itself
    const rq=opportunities.filter(r=>!r.deleted && r.kind==='request' && r.label && hit(r.label, r.company)).slice(0,3).map(r=>({ ic:'▦', title:r.company+' · '+r.label, sub:requestInstalls(r.id).length+' installations', go:()=>{ gsTab('pipeline'); setTimeout(()=>openRequestDetail(r.id),30); } }));
    if(rq.length) groups.push(['Blocs',rq]);
    // the tasks after the people, companies and deals: « Pierre » + Entrée opens Pierre, not « Appeler Pierre »
    if(tk.length) groups.push(['Tâches',tk]);
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
      { t:'Excel ⇄ appli : ce qui est envoyé ou pas', k:'excel pipe bdd suivi envoye pousse synchro', go:()=>openExcelSync() },
      { t:'Pipeline en liste', k:'liste tableau installations toutes', go:()=>{ gsTab('pipeline'); setTimeout(()=>{ pipeList=true; pipeDash=false; pipeMeet=false; try{ localStorage.setItem('pipe-list','1'); }catch(e){} renderPipeline(); },40); } },
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
    [['today','Aujourd’hui'],['tasks','Tâches'],['inbox','Boîte mail'],['archive','Archive'],['contacts','Contacts'],['pipeline','Pipeline'],['parc','Portefeuille'],['network','Réseau'],['market','Marché'],['lists','Réf. & data']]
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
    if(!q){ box.innerHTML='<div class="gs-empty">Tape un nom, une société, une centrale, un département…<br>Entrée : ouvre le premier résultat (sans résultat : crée la tâche). « &gt; » au début (ou Ctrl+P) : les commandes.</div>'; return; }
    const groups=gsSearch(q);
    const cmds=gsCommandHits(q).slice(0,3); if(cmds.length) groups.push(['Commandes',cmds]);
    const add=(it,cls)=>{ const i=gsList.length; gsList.push(it); const b=document.createElement('button'); b.type='button'; b.className='gs-item'+(cls?' '+cls:''); b.setAttribute('role','option'); b.id='gs-opt-'+i;
      b.innerHTML='<span class="gs-ic"></span><span class="gs-t"><b></b><span></span></span><span class="gs-r"></span>';
      b.querySelector('.gs-ic').textContent=it.ic; b.querySelector('b').textContent=it.title; b.querySelector('.gs-t span').textContent=it.sub||''; b.querySelector('.gs-r').textContent=it.right||'';
      b.onmousemove=()=>{ if(gsActive!==i){ gsActive=i; gsPaint(); } }; b.onclick=()=>gsGo(i); box.appendChild(b); };
    // something found: Enter opens the first result, « Créer la tâche » waits at the bottom; nothing found: Enter creates the task
    const create={ ic:'+', title:'Créer la tâche « '+q+' »', sub:groups.length?'':'Entrée', go:()=>{ quickAddInput.value=q; quickAdd(); gsTab('tasks'); } };
    if(!groups.length) add(create, 'create');
    groups.forEach(([label,items])=>{ const g=document.createElement('div'); g.className='gs-group'; g.textContent=label; box.appendChild(g); items.forEach(it=>add(it)); });
    if(groups.length){ const g=document.createElement('div'); g.className='gs-group'; g.textContent='Nouvelle tâche'; box.appendChild(g); add(create, 'create'); }
    else { const e=document.createElement('div'); e.className='gs-empty'; e.textContent='Rien trouvé ailleurs.'; box.appendChild(e); }
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

  // ---------- the browser's (or the phone's) Back button: it closes the sheet or window on screen, else goes back to the
  // previous tab — it no longer leaves the app. The opportunity form stays put (Back must not throw away what was typed).
  if(!window.TODO_WIDGET && window.history && history.pushState){
    const openOverlays=()=>[...document.querySelectorAll('.modal-overlay:not(.hidden)')].concat($('gs-overlay') && !$('gs-overlay').hidden?[$('gs-overlay')]:[]);
    let known=new Set(), ignorePop=0, restoring=false;
    const curTab=()=>{ const t=document.querySelector('.tab.active'); return t?t.dataset.tab:null; };
    try{ history.replaceState({ todo:'tab', tab:curTab() }, ''); }catch(e){}
    const watch=()=>{ const now=new Set(openOverlays());
      now.forEach(o=>{ if(!known.has(o)){ try{ history.pushState({ todo:'ov' }, ''); }catch(e){} } });
      known.forEach(o=>{ if(!now.has(o) && !restoring && history.state && history.state.todo==='ov'){ ignorePop++; history.back(); } });   // closed on screen: its step in the history goes too
      known=now; };
    new MutationObserver(()=>setTimeout(watch,0)).observe(document.body, { subtree:true, attributes:true, attributeFilter:['class','hidden'], childList:true });
    document.addEventListener('click', e=>{ const t=e.target.closest && e.target.closest('.tab[data-tab]'); if(!t || restoring) return;
      setTimeout(()=>{ const tab=curTab(); if(tab && !(history.state && history.state.tab===tab)){ try{ history.pushState({ todo:'tab', tab }, ''); }catch(err){} } }, 0); }, true);
    window.addEventListener('popstate', e=>{
      if(ignorePop>0){ ignorePop--; return; }
      const open=openOverlays();
      if(open.length){
        const top=open[open.length-1];
        if(top.id==='pq-overlay'){ try{ history.pushState({ todo:'ov' }, ''); }catch(err){} return; }
        restoring=true; document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
        if(!top.classList.contains('hidden') && top.id!=='gs-overlay'){ const x=top.querySelector('.modal-x, [id$="-close"], .ghost-btn'); if(x) x.click(); else top.classList.add('hidden'); }
        if(top.id==='gs-overlay') gsClose();
        setTimeout(()=>{ known=new Set(openOverlays()); restoring=false; }, 0); return;
      }
      const st=e.state; if(st && st.todo==='tab' && st.tab && st.tab!==curTab()){ restoring=true; const t=document.querySelector('.tab[data-tab="'+st.tab+'"]'); if(t) t.click(); setTimeout(()=>{ restoring=false; }, 0); }
    });
  }
  // ---------- widget mode: the tasks tab in a floating panel opened from a draggable bubble ----------
  // from the app: « Widget » opens the tasks in a small window of their own, kept above the other windows (Chrome / Edge),
  // or else in a small separate window — no longer a bubble inside this same page
  async function openMiniWindow(){
    const url=new URL('index.html?widget&pip', location.href).href;
    if('documentPictureInPicture' in window){
      try{ const w=await documentPictureInPicture.requestWindow({ width:400, height:600 });
        w.document.title='Tâches'; w.document.body.style.cssText='margin:0;background:#0A0D12;';
        const f=w.document.createElement('iframe'); f.src=url; f.title='Tâches'; f.style.cssText='border:0;width:100vw;height:100vh;display:block;';
        w.document.body.appendChild(f); return true; }catch(e){}
    }
    const w=window.open(url, 'todo-mini', 'popup,width=400,height=620'); return !!w;
  }
  window.todoOpenMini=openMiniWindow;
  { const wl=document.querySelector('.app-sidebar-widget'); if(wl && !window.TODO_WIDGET) wl.addEventListener('click', e=>{ e.preventDefault(); openMiniWindow(); }); }
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
  $('storage-alert-close').onclick=()=>{ const el=$('storage-alert'); if(el.dataset.kind==='ios'){ try{ localStorage.setItem('ios-hint-at', String(Date.now())); }catch(e){} } el.hidden=true; };
  // iPhone / iPad in Safari, app not on the home screen: Safari may wipe a site's data after 7 days without a visit (audit A17)
  (function(){
    const ios=/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints>1);
    const installed=navigator.standalone===true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    let last=0; try{ last=+localStorage.getItem('ios-hint-at')||0; }catch(e){}
    if(!ios || installed || window.TODO_WIDGET || Date.now()-last<14*864e5) return;
    showStorageAlert('ios', 'Sur iPhone, ajoute l\u2019appli à l\u2019écran d\u2019accueil (bouton Partager › « Sur l\u2019écran d\u2019accueil ») : sinon Safari peut effacer ses données après 7 jours sans visite.'
      +(syncConfig.enabled?' Tes données sont aussi sur GitHub.':''));
  })();
  $('storage-alert-see').onclick=()=>{ $('storage-alert').hidden=true; openStorageSection(); };
  loadAll().then(()=>{ try{ paintDupBanner(); }catch(e){ softFail('bandeau doublons', e); } try{ reportCorrupt(); }catch(e){ softFail('données illisibles', e); }
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
