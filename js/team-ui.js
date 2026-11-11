// Todo — the team sync (Supabase) seen from the app : push / pull / live changes, the private contacts, the status in
// Réglages. Split out of js/app.js (code audit) ; the Supabase calls themselves are in js/supabase-sync.js. Loaded before js/app.js.
window.TodoTeamUI=(function(){
  const api={};
  api.init=function(app){
    const { $, notify, softFail, askConfirm, render, renderArchive, renderLists, renderToday, renderContacts, renderPipeline, saveCrmLocalOnly, touchCrm, activeContacts, paintSettingsButtons }=app;
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
      catch(e){ console.error('[teamSyncPush] retrait contact privé', id, e); }
    }
    async function teamSyncPush(){
      if(!(window.TodoTeam && window.TodoTeam.isSignedIn())) return;
      const seen=await teamSeenLoad();
      for(const table of TEAM_TABLES){
        for(const item of teamArrFor(table)){
          if(teamPrivate(table, item)){ await teamDropPrivate(item.id, seen); continue; }
          const j=JSON.stringify(item); if(teamSnap[table].get(item.id)===j) continue;
          try{ await window.TodoTeam.pushItem(table, item); teamSnap[table].set(item.id, j); if(table==='contacts' && !seen.has(item.id)){ seen.add(item.id); teamSeenSave(); } }
          catch(e){ console.error('[teamSyncPush]', table, item.id, e); }
        }
      }
    }
    // recharge tout depuis Supabase au démarrage/connexion : fusionne par id, la version la plus récente gagne
    async function teamSyncPull(){
      if(!(window.TodoTeam && window.TodoTeam.isSignedIn())) return;
      teamPulledAt=Date.now();
      for(const table of TEAM_TABLES){
        let rows; try{ rows=await window.TodoTeam.pullAll(table); }catch(e){ console.error('[teamSyncPull]', table, e); continue; }
        if(!rows) continue;
        const arr=teamArrFor(table), by=new Map(arr.map(x=>[x.id,x]));
        rows.forEach(r=>{ const cur=by.get(r.id); if(teamPrivate(table, cur)) return;   // mine and private : the push below takes it out of the team base
          teamSnap[table].set(r.id, JSON.stringify(r)); if(!cur || (r.updatedAt||0)>=(cur.updatedAt||0)) by.set(r.id, r); });
        if(table==='contacts'){   // seen in the team base before, gone now, not mine-private : a colleague made it private
          const seen=await teamSeenLoad(), onServer=new Set(rows.map(r=>r.id));
          [...by.keys()].forEach(id=>{ if(seen.has(id) && !onServer.has(id) && !teamPrivate(table, by.get(id))) by.delete(id); });
          teamSeen=new Set(rows.map(r=>r.id)); teamSeenSave();
        }
        arr.length=0; arr.push(...by.values());
      }
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
          teamSnap[table].set(item.id, JSON.stringify(item));
          if(table==='contacts' && teamSeen && !teamSeen.has(item.id)){ teamSeen.add(item.id); teamSeenSave(); }
          if(i>=0) arr[i]=item; else arr.push(item);
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
    async function renderTeamStatus(){
      paintTeamShare();
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
    Object.assign(api, { teamSyncPush, teamSyncPull, teamSyncSubscribe, renderTeamStatus, paintTeamShare });
  };
  return api;
})();
