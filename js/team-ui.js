// Todo — the team sync (Supabase) seen from the app : push / pull / live changes, the private contacts, the status in
// Réglages. Split out of js/app.js (code audit) ; the Supabase calls themselves are in js/supabase-sync.js. Loaded before js/app.js.
window.TodoTeamUI=(function(){
  const api={};
  api.init=function(app){
    const { $, notify, softFail, askConfirm, render, renderArchive, renderLists, renderToday, renderContacts, renderPipeline, saveCrmLocalOnly, touchCrm, activeContacts, paintSettingsButtons }=app, gsTab=(...a)=>app.gsTab(...a);
    const contactsArr=()=>app.contacts;
    // ---------- Synchro équipe (Supabase, bêta) : voir js/supabase-sync.js. Inactif sans config, aucun effet sur l'appli en service. ----------
    const TEAM_TABLES=['opportunities','contacts','companies','meetings'];
    let teamPulledAt=0;   // the last full read of the team's data
    let teamSnap={ opportunities:new Map(), contacts:new Map(), companies:new Map(), meetings:new Map() }, teamSubscribed=false;
    const teamArrFor=table=>({ opportunities:app.opportunities, contacts:app.contacts, companies:app.companies, meetings:app.meetings }[table]);
    function teamRefresh(){ render(); renderArchive(); renderLists(); renderToday(); renderContacts(); renderPipeline(); }
    // pousse vers Supabase tout ce qui a changé depuis le dernier push/pull (comparaison JSON, pas de suivi champ par champ)
    // a private contact never goes to the team base ; one made private after being shared is removed from it
    const teamPrivate=(table, item)=>table==='contacts' && !!(item && item.private);
    let teamSeen=null;   // ids of contacts already seen in the team base (kept on this device) : one gone from it was made private by a colleague
    async function teamSeenLoad(){ if(teamSeen) return teamSeen; try{ const r=await window.storage.get('team-seen-contacts'); teamSeen=new Set(r&&r.value?JSON.parse(r.value):[]); }catch(e){ teamSeen=new Set(); } return teamSeen; }
    function teamSeenSave(){ try{ window.storage.set('team-seen-contacts', JSON.stringify([...teamSeen])); }catch(e){ softFail('team-seen', e); } }
    async function teamDropPrivate(id, seen){
      if(!teamSnap.contacts.has(id) && !seen.has(id)) return;   // never sent : nothing to take back
      try{
        const r=await window.TodoTeam.removeItem('contacts', id);
        if(r==='refused'){   // a colleague's contact : it stays shared, the lock is taken back
          const c=contactsArr().find(x=>x.id===id); if(c){ c.private=false; touchCrm(c); saveCrmLocalOnly(); renderContacts(); paintTeamShare(); }
          notify('Ce contact a été ajouté par un collègue : seul lui peut le retirer de l\u2019équipe. Il reste partagé.'); return;
        }
        teamSnap.contacts.delete(id); seen.delete(id); teamSeenSave();
      }
      catch(e){ console.error('[teamSyncPush] retrait contact privé', id, e); return 'failed'; }
    }
    // ---- the team sync's health : a banner on every page when it stops (signed out, base unreachable or paused, sends
    // failing), with what is waiting on this device ; the sends start again by themselves when it comes back ----
    const health={ down:false, since:0, closed:false }; let retryTimer=null;
    function teamPending(){ let n=0; TEAM_TABLES.forEach(t=>teamArrFor(t).forEach(o=>{ if(!teamPrivate(t, o) && teamSnap[t].size && teamSnap[t].get(o.id)!==JSON.stringify(o)) n++; })); return n; }
    function setTeamDown(down){
      if(down && !health.down){ health.down=true; health.since=Date.now(); health.closed=false; if(!retryTimer) retryTimer=setInterval(teamRetry, 60000); }
      if(!down && health.down){ health.down=false; health.since=0; clearInterval(retryTimer); retryTimer=null; }
      paintTeamAlert();
    }
    async function teamRetry(){ try{ await teamSyncPull(); if(!health.down) await teamSyncPush(); }catch(e){ setTeamDown(true); } }
    function teamAlertText(off){
      const n=teamPending(), keep=n?' '+n+' modification'+(n>1?'s':'')+' en attente, gardée'+(n>1?'s':'')+' sur cet appareil.':' Tes modifications restent sur cet appareil.';
      const idle=(()=>{ try{ return Number(localStorage.getItem('team-idle-out')||0)>Date.now()-864e5; }catch(e){ return false; } })();
      return off ? 'Synchro équipe arrêtée : tu n\u2019es plus connecté'+(idle?' (déconnexion automatique après 7 jours sans utilisation sur cet appareil)':'')+'.'+keep
        : 'Synchro équipe interrompue depuis '+new Date(health.since).toLocaleTimeString('fr-FR',{ hour:'2-digit', minute:'2-digit' })+' (base injoignable : en pause ou pas de réseau).'+keep+' L\u2019envoi reprendra tout seul.';
    }
    function goTeamForm(){ gsTab('lists'); setTimeout(()=>{ const t=$('team-section'); if(t) t.scrollIntoView({ behavior:'smooth', block:'start' }); const f=$(mfaPending==='none'?'team-mfa-enroll':mfaNeeded?'team-mfa-code':'team-email'); if(f) f.focus({ preventScroll:true }); }, 80); }
    // what the banner says : 'off' (signed out), 'mfa' (code awaited), 'down' (base unreachable), or nothing
    function teamAlertKind(){
      const T=window.TodoTeam, conf=T.isConfigured && T.isConfigured(), inn=T.isSignedIn && T.isSignedIn();
      if(conf && !inn) return 'off';
      if(!inn) return '';
      return mfaNeeded ? 'mfa' : health.down ? 'down' : '';
    }
    function paintTeamAlert(){
      const el=$('team-alert'); if(!el || !window.TodoTeam) return;
      const k=teamAlertKind(); el.hidden=!k || health.closed; if(el.hidden) return;
      el.querySelector('span').textContent=k==='mfa' ? (mfaPending==='none' ? 'Synchro équipe en attente : active la double authentification (Réglages › Équipe).' : 'Synchro équipe en attente : saisis le code de double authentification.') : teamAlertText(k==='off');
      const go=el.querySelector('.ta-go'); go.textContent={ off:'Se connecter', mfa:mfaPending==='none'?'L\u2019activer':'Saisir le code', down:'Réessayer' }[k];
      go.onclick=k==='down' ? ()=>{ go.textContent='…'; teamRetry(); } : goTeamForm;
      el.querySelector('.ta-x').onclick=()=>{ health.closed=true; el.hidden=true; };
    }
    window.addEventListener('online', ()=>{ if(health.down) teamRetry(); });
    // ---- field by field : two colleagues changing different fields of the same sheet both keep their change ----
    // teamSnap holds, per row, the last version seen on the base (the « base » of a three-way merge) : what I changed
    // since is mine and goes on top of the base's current version, everything else comes from the base.
    const META=new Set(['updatedAt','createdAt']), same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    // a form saves every field, empty ones included : an empty field where there was nothing is not a change
    const blank=v=>v==null || v==='' || (Array.isArray(v) && !v.length), sameVal=(a,b)=>(blank(a) && blank(b)) || same(a,b);
    function merge3(base, local, server){
      if(!base) return (local.updatedAt||0)>(server.updatedAt||0) ? Object.assign({}, server, local) : Object.assign({}, local, server);
      const out=Object.assign({}, server);
      new Set([...Object.keys(base), ...Object.keys(local)]).forEach(k=>{ if(META.has(k) || sameVal(local[k], base[k])) return; if(local[k]===undefined) delete out[k]; else out[k]=local[k]; });
      out.updatedAt=Math.max(local.updatedAt||0, server.updatedAt||0);
      return out;
    }
    // the same object kept (an open sheet holds it), its content replaced
    function assignInPlace(o, m){ Object.keys(o).forEach(k=>{ if(!(k in m)) delete o[k]; }); Object.assign(o, m); }
    const snapOf=(table, id)=>{ const j=teamSnap[table].get(id); return j ? JSON.parse(j) : null; };
    // one changed row : merged onto the base's current version (field by field), then sent ; 'sent' / 'merged' / 'failed'
    async function teamPushOne(table, item, seen){
      try{
        const base=snapOf(table, item.id), server=base ? await window.TodoTeam.getItem(table, item.id) : null;
        const out=server ? merge3(base, item, server) : item, merged=!!server && !same(out, item);
        if(merged) assignInPlace(item, out);   // a colleague's change came in with mine
        await window.TodoTeam.pushItem(table, item); teamSnap[table].set(item.id, JSON.stringify(item));
        if(table==='contacts' && !seen.has(item.id)){ seen.add(item.id); teamSeenSave(); }
        return merged ? 'merged' : 'sent';
      }catch(e){ console.error('[teamSyncPush]', table, item.id, e); return 'failed'; }
    }
    async function teamSyncPush(){
      if(!(window.TodoTeam && window.TodoTeam.isSignedIn()) || mfaNeeded) return;
      const seen=await teamSeenLoad(); let merged=false, failed=false;
      for(const table of TEAM_TABLES){
        for(const item of teamArrFor(table)){
          if(teamPrivate(table, item)){ if(await teamDropPrivate(item.id, seen)==='failed') failed=true; continue; }
          if(teamSnap[table].get(item.id)===JSON.stringify(item)) continue;
          const r=await teamPushOne(table, item, seen); if(r==='merged') merged=true; else if(r==='failed') failed=true;
        }
      }
      setTeamDown(failed);
      if(merged){ saveCrmLocalOnly(); teamRefresh(); }
    }
    // a row from the base : taken as is when nothing changed here since the last one seen, merged field by field otherwise
    function teamTakeRow(table, cur, r){
      const j=teamSnap[table].get(r.id), localEdits=cur && j && JSON.stringify(cur)!==j;
      teamSnap[table].set(r.id, JSON.stringify(r));
      if(!cur) return r;
      if(localEdits){ assignInPlace(cur, merge3(JSON.parse(j), cur, r)); return cur; }   // mine not sent yet : kept, sent by the next push
      if(j || (r.updatedAt||0)>=(cur.updatedAt||0)) assignInPlace(cur, r);
      return cur;
    }
    // recharge tout depuis Supabase au démarrage/connexion : fusionne par id, la version la plus récente gagne
    async function teamSyncPull(){
      if(!(window.TodoTeam && window.TodoTeam.isSignedIn())) return;
      if(mfaNeeded){ paintTeamAlert(); return; }   // the base answers only with the second factor : asked in Réglages
      teamPulledAt=Date.now(); let pullFailed=false; const wasDown=health.down;
      for(const table of TEAM_TABLES){
        let rows; try{ rows=await window.TodoTeam.pullAll(table); }catch(e){ console.error('[teamSyncPull]', table, e); pullFailed=true; continue; }
        if(!rows) continue;
        const arr=teamArrFor(table), by=new Map(arr.map(x=>[x.id,x]));
        rows.forEach(r=>{ const cur=by.get(r.id); if(teamPrivate(table, cur)) return;   // mine and private : the push below takes it out of the team base
          by.set(r.id, teamTakeRow(table, cur, r)); });
        if(table==='contacts' && rows.length){   // seen in the team base before, gone now, not mine-private : a colleague made it private (never on an empty answer : a base refusing access answers empty)
          const seen=await teamSeenLoad(), onServer=new Set(rows.map(r=>r.id));
          [...by.keys()].forEach(id=>{ if(seen.has(id) && !onServer.has(id) && !teamPrivate(table, by.get(id))) by.delete(id); });
          teamSeen=new Set(rows.map(r=>r.id)); teamSeenSave();
        }
        arr.length=0; arr.push(...by.values());
      }
      setTeamDown(pullFailed);
      if(wasDown && !pullFailed) teamSyncPush();   // back : what waited here leaves now
      await saveCrmLocalOnly();
      teamRefresh();
    }
    // back on the tab (or the window) after a while : the team's data read again, whatever the live channel did meanwhile
    const teamPullIfStale=()=>{ if(document.visibilityState!=='visible' || !(window.TodoTeam && window.TodoTeam.isSignedIn())) return; if(Date.now()-teamPulledAt<30000) return; teamPulledAt=Date.now(); teamSyncPull().catch(e=>softFail('synchro équipe', e)); };
    document.addEventListener('visibilitychange', teamPullIfStale); window.addEventListener('focus', teamPullIfStale);
    // un collègue modifie quelque chose : reçu en direct, fusionné dans les tableaux en mémoire
    function teamSyncSubscribe(){
      if(teamSubscribed || !(window.TodoTeam && window.TodoTeam.isSignedIn())) return;
      teamSubscribed=true;
      TEAM_TABLES.forEach(table=>{
        window.TodoTeam.subscribe(table, (item, kind)=>{
          const arr=teamArrFor(table), i=arr.findIndex(x=>x.id===item.id);
          if(i>=0 && teamPrivate(table, arr[i])) return;   // my private copy stays as it is
          if(kind==='DELETE'){ teamSnap[table].delete(item.id); if(i>=0) arr.splice(i,1); if(teamSeen) teamSeen.delete(item.id); saveCrmLocalOnly(); teamRefresh(); return; }
          if(table==='contacts' && teamSeen && !teamSeen.has(item.id)){ teamSeen.add(item.id); teamSeenSave(); }
          const got=teamTakeRow(table, i>=0 ? arr[i] : null, item); if(i<0) arr.push(got);
          saveCrmLocalOnly(); teamRefresh();
        });
      });
    }
    function paintTeamShare(){
      const el=$('team-share-summary'); if(!el) return;
      const act=activeContacts(), priv=act.filter(c=>c.private).length;
      el.innerHTML='<b>Partagé avec l\u2019équipe</b> : le pipeline, les sociétés, les rendez-vous et '+(act.length-priv)+' contact'+(act.length-priv>1?'s':'')+'.'
        +' <b>Reste à toi</b> : tes tâches, la note, et '+priv+' contact'+(priv>1?'s':'')+' privé'+(priv>1?'s':'')+'.'
        +' Un contact est partagé par défaut ; le cadenas dans Contacts le garde pour toi.';
    }
    // ---- double authentification : a code from an authenticator app, asked once per session ; required by the base ----
    let mfaNeeded=false, mfaFactor=null, mfaPending='';
    async function paintMfa(){
      const box=$('team-mfa'); if(!box || !window.TodoTeam) return;
      const T=window.TodoTeam; if(!T.isSignedIn()){ box.hidden=true; return; }
      let st='none'; try{ st=await T.mfaState(); }catch(e){ softFail('double authentification', e); }
      mfaNeeded=st!=='ok'; mfaPending=st; box.hidden=false; mfaFactor=null;   // the base answers only at aal2 : no sync before
      $('team-mfa-qr').hidden=true; $('team-mfa-status').textContent='';
      $('team-mfa-code-row').hidden=st!=='need'; $('team-mfa-enroll').hidden=st!=='none'; $('team-mfa-spare').hidden=st!=='ok';
      $('team-mfa-text').textContent=st==='ok' ? 'Double authentification active. Garde un second appareil (ou ton gestionnaire de mots de passe) en secours : sans code, l\u2019accès à l\u2019équipe est bloqué jusqu\u2019à une réinitialisation par l\u2019administrateur.'
        : st==='need' ? 'Saisis le code à 6 chiffres de ton appli d\u2019authentification pour accéder aux données de l\u2019équipe.'
        : 'Obligatoire pour l\u2019équipe : un code à 6 chiffres d\u2019une appli d\u2019authentification (Microsoft Authenticator, Google Authenticator, ou ton gestionnaire de mots de passe) en plus du mot de passe.';
      paintTeamAlert();
    }
    async function mfaStart(label){
      const st=$('team-mfa-status'); st.textContent='Préparation…';
      try{ const r=await window.TodoTeam.mfaEnroll(label); mfaFactor=r.id;
        $('team-mfa-img').src=r.qr; $('team-mfa-secret').textContent=r.secret; $('team-mfa-qr').hidden=false; $('team-mfa-code-row').hidden=false;
        $('team-mfa-text').textContent='1. Scanne ce QR code avec ton appli d\u2019authentification (ou recopie la clé affichée). 2. Saisis le code à 6 chiffres qu\u2019elle donne, puis « Valider ».';
        st.textContent=''; $('team-mfa-code').focus();
      }catch(e){ st.textContent='Erreur : '+(e&&e.message||e); }
    }
    async function mfaSubmit(){
      const code=$('team-mfa-code').value.trim(), st=$('team-mfa-status'); if(!/^\d{6}$/.test(code.replace(/\s/g,''))){ st.textContent='Le code fait 6 chiffres.'; return; }
      st.textContent='Vérification…';
      try{ if(mfaFactor) await window.TodoTeam.mfaConfirm(mfaFactor, code); else await window.TodoTeam.mfaVerify(code);
        $('team-mfa-code').value=''; st.textContent='Code accepté.'; mfaNeeded=false; await paintMfa(); await teamSyncPull(); teamSyncSubscribe();
      }catch(e){ st.textContent='Code refusé : vérifie l\u2019heure de ton téléphone et réessaie avec le code suivant.'; }
    }
    if($('team-mfa-ok')){ $('team-mfa-ok').onclick=mfaSubmit; $('team-mfa-code').addEventListener('keydown', e=>{ if(e.key==='Enter') mfaSubmit(); });
      $('team-mfa-enroll').onclick=()=>mfaStart('Appli'); $('team-mfa-spare').onclick=()=>mfaStart('Secours'); }
    async function renderTeamStatus(){
      paintTeamShare(); await paintMfa();
      const cfgEl=$('team-config-status'), authEl=$('team-auth-status');
      if(!cfgEl || !authEl || !window.TodoTeam) return;
      const cfg=await window.TodoTeam.loadConfig();
      cfgEl.textContent=cfg&&cfg.url?'Configuré : '+cfg.url:'Pas encore configuré.';
      cfgEl.className='bridge-status'+(cfg&&cfg.url?' on':'');
      if(window.TodoTeam.isSignedIn()){
        const u=window.TodoTeam.currentUser();
        const live=Object.values(window.TodoTeam.liveState ? window.TodoTeam.liveState() : {});
        authEl.textContent='Connecté comme '+(u&&u.email||'?')+(live.length?' · direct : '+(live.every(x=>x==='SUBSCRIBED')?'actif':'en reconnexion (les données se rechargent aussi à chaque retour sur l\u2019onglet)'):'');
        authEl.className='bridge-status on';
      } else {
        authEl.textContent=window.TodoTeam.isConfigured()?'Non connecté.':'Configure d’abord la connexion ci-dessus.';
        authEl.className='bridge-status';
      }
      paintSettingsButtons();
    }
    if($('team-section')){
      (async()=>{ const cfg=window.TodoTeam&&await window.TodoTeam.loadConfig(); if(cfg){ $('team-url').value=cfg.url||''; $('team-key').value=cfg.anonKey||''; } })();
      $('team-save-btn').onclick=async()=>{
        const url=$('team-url').value.trim(), key=$('team-key').value.trim();
        if(!url || !key){ $('team-config-status').textContent='URL et clé requises.'; return; }
        // un header HTTP n'accepte que de l'ISO-8859-1 : un caractère collé par erreur (guillemet
        // typographique, espace invisible…) donne sinon une erreur fetch cryptique bien plus tard
        const cfg=window.TodoTeam.cleanConfig({ url, anonKey:key });
        if(!cfg){ $('team-config-status').textContent='URL ou clé non reconnue : l\u2019URL ressemble à https://xxxx.supabase.co, la clé à trois blocs séparés par des points. Recopie-les sans rien autour.'; return; }
        await window.TodoTeam.saveConfig(cfg);
        $('team-config-status').textContent='Enregistré, rechargement…';
        location.reload();   // le client Supabase se construit une fois, au chargement : on recharge pour qu'il reprenne la config
      };
      $('team-login-btn').onclick=async()=>{
        const email=$('team-email').value.trim(), pwd=$('team-password').value;
        if(!email || !pwd){ $('team-auth-status').textContent='Email et mot de passe requis.'; return; }
        $('team-auth-status').textContent='Connexion…';
        try{ await window.TodoTeam.signIn(email, pwd); await renderTeamStatus(); $('team-password').value=''; await teamSyncPull(); teamSyncSubscribe(); }
        catch(e){ console.error('[team signIn]', e); $('team-auth-status').textContent='Erreur : '+(e&&e.message||e); }
      };
      $('team-load-btn').onclick=async()=>{
        const el=$('team-action-status'); el.textContent='Chargement…';
        try{
          const out=[];
          for(const t of ['opportunities','contacts','companies','meetings']){ const rows=await window.TodoTeam.pullAll(t); out.push(t+' : '+(rows?rows.length:0)); }
          el.textContent=out.join(' · ');
        }catch(e){ console.error('[team load]', e); el.textContent='Erreur : '+(e&&e.message||e); }
      };
      $('team-migrate-btn').onclick=async()=>{
        if(!await askConfirm('Copier tes données locales (contacts, sociétés, pipeline, rendez-vous) vers la base équipe bêta ? À faire une seule fois, sur le projet de test.', 'Migrer')) return;
        const el=$('team-action-status'); el.textContent='Migration…';
        try{ const report=await window.TodoTeam.migrateFromLocal(); el.textContent=JSON.stringify(report); }
        catch(e){ console.error('[team migrate]', e); el.textContent='Erreur : '+(e&&e.message||e); }
      };
      renderTeamStatus();
    }
    Object.assign(api, { teamSyncPush, teamSyncPull, teamSyncSubscribe, renderTeamStatus, paintTeamShare, paintTeamAlert });
  };
  return api;
})();
