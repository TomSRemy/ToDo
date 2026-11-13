// « Test du dossier d'équipe » : can ToDo read and write a OneDrive folder on this PC through Edge (File System Access),
// and does Edge keep that permission across visits ? Writes one small test file, reads it back, deletes it.
(function(){
  'use strict';
  const $=id=>document.getElementById(id), results=[], DB='todo-test-dossier';
  const browser=(()=>{ const m=/Edg\/(\d+)/.exec(navigator.userAgent) || /Chrome\/(\d+)/.exec(navigator.userAgent); return (/Edg\//.test(navigator.userAgent)?'Edge ':'Chrome ')+(m?m[1]:'?'); })();
  function add(state, label, detail){ results.push({ state, label, detail:detail||'' }); paint(); }
  function paint(){
    $('results').innerHTML='';
    results.forEach(r=>{ const li=document.createElement('li'); li.className=r.state; li.innerHTML='<span class="i"></span><span><span class="l"></span><small></small></span>';
      li.querySelector('.i').textContent=r.state==='ok'?'✓':r.state==='ko'?'✗':'…'; li.querySelector('.l').textContent=r.label; li.querySelector('small').textContent=r.detail; $('results').appendChild(li); });
    $('summary').value=['Test dossier ToDo · '+browser+' · '+new Date().toLocaleString('fr-FR')].concat(results.map(r=>(r.state==='ok'?'OK  ':r.state==='ko'?'NON ':'... ')+r.label+(r.detail?' ('+r.detail+')':''))).join('\n');
  }
  // the folder handle kept in IndexedDB, to check on the next visit whether Edge kept the permission
  function db(){ return new Promise((res, rej)=>{ const r=indexedDB.open(DB, 1); r.onupgradeneeded=()=>r.result.createObjectStore('h'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
  async function keep(h){ const d=await db(); await new Promise((res, rej)=>{ const t=d.transaction('h', 'readwrite'); t.objectStore('h').put(h, 'dir'); t.oncomplete=res; t.onerror=()=>rej(t.error); }); }
  async function kept(){ const d=await db(); return new Promise(res=>{ const t=d.transaction('h'); const g=t.objectStore('h').get('dir'); g.onsuccess=()=>res(g.result||null); g.onerror=()=>res(null); }); }
  async function tryWrite(dir){
    const name='todo-test-'+Date.now()+'.txt', text='Test ToDo '+new Date().toISOString();
    try{ const f=await dir.getFileHandle(name, { create:true }), w=await f.createWritable(); await w.write(text); await w.close(); add('ok', 'Écrire un fichier dans le dossier'); }
    catch(e){ add('ko', 'Écrire un fichier dans le dossier', e.name+' : '+e.message); return; }
    try{ const back=await (await (await dir.getFileHandle(name)).getFile()).text(); add(back===text?'ok':'ko', 'Relire ce fichier', back===text?'':'contenu différent'); }
    catch(e){ add('ko', 'Relire ce fichier', e.name+' : '+e.message); }
    try{ const f=await dir.getFileHandle(name), w=await f.createWritable({ keepExistingData:true }); const n=(await f.getFile()).size; await w.seek(n); await w.write('\nligne ajoutée'); await w.close(); add('ok', 'Ajouter une ligne à la fin (le journal fonctionne ainsi)'); }
    catch(e){ add('ko', 'Ajouter une ligne à la fin', e.name+' : '+e.message); }
    try{ await dir.removeEntry(name); add('ok', 'Supprimer le fichier de test'); }
    catch(e){ add('ko', 'Supprimer le fichier de test', e.name+' : '+e.message); }
  }
  async function listing(dir){
    try{ let n=0, xl=0; for await (const [k] of dir.entries()){ n++; if(/\.xls[xm]$/i.test(k)) xl++; if(n>500) break; } add('ok', 'Lire le contenu du dossier', n+' élément(s), dont '+xl+' Excel'); }
    catch(e){ add('ko', 'Lire le contenu du dossier', e.name+' : '+e.message); }
  }
  async function pick(){
    results.length=0; add('ok', 'Navigateur', browser);
    if(!window.showDirectoryPicker){ add('ko', 'Accès aux dossiers dans ce navigateur', 'absent : il faut Edge ou Chrome récent, ou c’est bloqué par l’entreprise'); return; }
    add('ok', 'Accès aux dossiers dans ce navigateur');
    let dir; try{ dir=await window.showDirectoryPicker({ id:'todo-equipe', mode:'readwrite' }); }
    catch(e){ add('ko', 'Choisir un dossier', e.name==='AbortError' ? 'annulé : réessaie et choisis un dossier' : e.name+' : '+e.message); return; }
    add('ok', 'Choisir un dossier', dir.name);
    const p=await dir.queryPermission({ mode:'readwrite' }); add(p==='granted'?'ok':'ko', 'Autorisation de modifier le dossier', p);
    if(p!=='granted') return;
    await listing(dir); await tryWrite(dir);
    try{ await keep(dir); $('again').hidden=false; add('wait', 'Autorisation gardée d’une visite à l’autre', 'clique « Recharger et revérifier »'); }
    catch(e){ add('ko', 'Garder le dossier pour la prochaine visite', e.name+' : '+e.message); }
  }
  async function recheck(){
    const dir=await kept().catch(()=>null); if(!dir) return;
    results.length=0; add('ok', 'Navigateur', browser); add('ok', 'Dossier retrouvé après rechargement', dir.name);
    const p=await dir.queryPermission({ mode:'readwrite' });
    if(p==='granted'){ add('ok', 'Autorisation gardée d’une visite à l’autre', 'aucun clic à refaire'); await listing(dir); }
    else { add('wait', 'Autorisation gardée d’une visite à l’autre', 'à redonner d’un clic à chaque ouverture ('+p+') : utilisable, un peu moins confortable');
      $('pick').textContent='Redonner l’autorisation'; $('pick').onclick=async()=>{ const q=await dir.requestPermission({ mode:'readwrite' }); add(q==='granted'?'ok':'ko', 'Autorisation redonnée d’un clic', q); if(q==='granted') await tryWrite(dir); }; }
    $('again').hidden=false;
  }
  $('pick').onclick=pick;
  $('again').onclick=()=>location.reload();
  $('copy').onclick=async()=>{ try{ await navigator.clipboard.writeText($('summary').value); $('copy').textContent='Copié ✓'; }catch(e){ $('summary').select(); } };
  recheck().then(()=>{ if(!results.length){ add('wait', 'Prêt', 'clique « Choisir le dossier »'); } });
})();
