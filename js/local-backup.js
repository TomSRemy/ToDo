// Todo — the local backup : once a day, the whole data (tasks, note, contacts, pipeline) written by the Excel bridge in
// a folder of this PC (by default OneDrive\ToDo\sauvegardes), encrypted with the GitHub sync's key when it is on ; the
// last 30 kept by the bridge. Restoring shows what the file holds before replacing anything. Loaded before js/app.js.
window.TodoLocalBackup=(function(){
  const api={}, AT='local-backup-at', NAG='local-backup-nag', DAY=864e5;
  api.init=function(app){
    const { $, bridgeCall, bridgeConfigured, backupPayload, importJson, notify, askChoice }=app;
    const lastAt=()=>{ try{ return Number(localStorage.getItem(AT)||0); }catch(e){ return 0; } };
    const setLs=(k, v)=>{ try{ localStorage.setItem(k, v); }catch(e){ /* storage refused : the next backup simply runs again */ } };
    let dir=(()=>{ try{ return localStorage.getItem('local-backup-dir')||''; }catch(e){ return ''; } })();
    const localDay=()=>{ const t=new Date(); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); };   // the bridge names files by the PC's date
    async function writeNow(){
      const text=JSON.stringify(backupPayload()), C=window.TodoCrypt;
      const sealed=C && C.isOn() ? await C.seal(text) : text, encrypted=sealed!==text;
      const r=await bridgeCall('POST', '/backup/write', { content:sealed, encrypted }, 60000);
      setLs(AT, String(Date.now())); dir=r.dir||dir; setLs('local-backup-dir', dir); paint();
      return r;
    }
    // once a day, as soon as the bridge answers ; three days without one : said once a day
    async function auto(){
      if(!bridgeConfigured()) return;
      const at=lastAt(); if(at && new Date(at).toDateString()===new Date().toDateString()) return;
      try{ await writeNow(); }catch(e){ nag(); }
    }
    function nag(){
      const at=lastAt(), today=new Date().toDateString(); if(at && Date.now()-at<3*DAY) return;
      try{ if(localStorage.getItem(NAG)===today) return; }catch(e){ return; }
      setLs(NAG, today);
      notify('Pas de sauvegarde locale '+(at?'depuis '+Math.floor((Date.now()-at)/DAY)+' jours':'pour l’instant')+' : lance le pont Excel sur ce PC (elle se fait alors toute seule).');
    }
    function stateText(){
      const at=lastAt(); if(!at) return 'Aucune sauvegarde locale pour l’instant.';
      const d=new Date(at), days=Math.floor((Date.now()-at)/DAY);
      return 'Dernière : '+(days===0?'aujourd’hui':days===1?'hier':'il y a '+days+' jours')+' à '+d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })+(dir?' · '+dir:'');
    }
    function paint(){
      const st=$('lb-status'); if(!st) return;
      if(!bridgeConfigured()){ st.textContent='Demande le pont Excel sur ce PC (Réglages › Pont Excel).'; st.className='bridge-status'; return; }
      st.textContent=stateText(); st.className='bridge-status'+(lastAt() && Date.now()-lastAt()<3*DAY?' on':' off');
    }
    async function saveClick(){
      const st=$('lb-status'); st.textContent='Sauvegarde…';
      try{ const r=await writeNow(); notify('Sauvegarde locale écrite : '+r.file.name+'.'); }
      catch(e){ st.textContent='Échec : '+(e&&e.message||e); st.className='bridge-status off'; }
    }
    async function dirClick(){
      const v=await askChoice('Dossier des sauvegardes', 'Colle le chemin complet du dossier (par exemple dans ton OneDrive). Vide = le dossier par défaut, OneDrive\\ToDo\\sauvegardes.', [{ label:'Enregistrer', value:'y' }], { input:dir });
      if(v==null) return;
      try{ const r=await bridgeCall('POST', '/backup/dir', { dir:v }); dir=r.dir; setLs('local-backup-dir', dir); paint(); notify('Les prochaines sauvegardes iront dans '+r.dir+'.'); }
      catch(e){ notify('Dossier refusé : '+(e&&e.message||e)); }
    }
    // a backup's content, opened (decrypted when needed) and summed up before anything is replaced
    async function openBackup(name){
      const r=await bridgeCall('POST', '/backup/read', { name }, 60000);
      let data=JSON.parse(r.content);
      if(window.TodoCrypt && window.TodoCrypt.isSealed(data)) data=await window.TodoCrypt.open(data);
      return data;
    }
    const summary=d=>{ const n=a=>(a||[]).filter(x=>x && !x.deleted).length, crm=d.crm||{};
      const w=(k, word)=>k+' '+word+(k>1?'s':'');
      return w(n(d.tasks), 'tâche')+', '+w(n(crm.contacts), 'contact')+', '+w(n(crm.opportunities), 'affaire'); };
    // the bridge's files, the last 8 days offered ; null : nothing chosen
    async function pickBackup(){
      let list; try{ list=await bridgeCall('POST', '/backup/list'); }catch(e){ notify('Liste impossible : '+(e&&e.message||e)); return null; }
      dir=list.dir||dir;
      if(!list.files.length){ notify('Aucune sauvegarde dans '+dir+'.'); return null; }
      return askChoice('Restaurer une sauvegarde locale', 'Dossier : '+dir+'\nChoisis le jour ; tu verras son contenu avant de remplacer quoi que ce soit.',
        list.files.slice(0, 8).map(f=>({ label:f.name.replace(/^todo-|\.json(\.enc)?$/g,'')+(/\.enc$/.test(f.name)?' (chiffrée)':''), value:f.name })));
    }
    // today's file would be replaced by the safety copy : none then
    async function safetyCopy(todays){
      if(todays) return true;
      try{ await writeNow(); return true; }
      catch(e){ return !!await askChoice('', 'La sauvegarde de l\u2019état actuel a échoué ('+(e&&e.message||e)+'). Restaurer quand même ?', [{ label:'Restaurer quand même', value:'y' }]); }
    }
    async function restoreClick(){
      const pick=await pickBackup(); if(!pick) return;
      let data; try{ data=await openBackup(pick); }catch(e){ notify('Sauvegarde illisible : '+(e&&e.message||e)); return; }
      const todays=pick.startsWith('todo-'+localDay());
      const ok=await askChoice('Restaurer '+pick+' ?', 'Elle contient '+summary(data)+'.\nAujourd\u2019hui tu as '+summary(backupPayload())+'.'+(todays?'':'\n\nUne sauvegarde de l\u2019état actuel est faite juste avant.'), [{ label:'Restaurer', value:'y' }]);
      if(ok!=='y' || !await safetyCopy(todays)) return;
      await importJson(data, true); notify('Sauvegarde du '+pick.slice(5,15).split('-').reverse().join('/')+' restaurée.');
    }
    if($('lb-save-btn')){ $('lb-save-btn').onclick=saveClick; $('lb-dir-btn').onclick=dirClick; $('lb-restore-btn').onclick=restoreClick; }
    paint();
    Object.assign(api, { auto, paint, writeNow, nag });
  };
  return api;
})();
