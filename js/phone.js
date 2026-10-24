// Todo — contacts to and from the phone (loaded before js/app.js): reading a .vcf file or the phone's own picker, and
// sending contacts to the phone as vCards without duplicates. Split out of js/app.js (code audit, lot 3).
window.TodoPhone=(function(){
  const api={};
  // everything this part uses from js/app.js, given once when the app has finished loading
  api.init=function(app){
    const { $, askConfirm, tell, contactDupKeys, ensureCompany, loadTesseract, openContactForm, parseSignatureText, pqFmtPhone, pqFold, renderContacts, saveCrm, toISO, touchCrm }=app;
  // ---------- Phone → contacts: a .vcf file (what a phone exports), or the phone's own picker (Android) ----------

  // which of these are already known (same mail, phone, or name in the same company): those only get their empty boxes filled
  function phoneImportPlan(list){
    const live=app.contacts.filter(c=>!c.deleted), byKey=new Map(); live.forEach(c=>contactDupKeys(c).forEach(k=>byKey.set(k,c)));
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
          if(c.company) c.company=ensureCompany(c.company); c.vcfAt=Date.now(); app.contacts.push(c); touchCrm(c); made++; } });
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
    if(/iPhone|iPad|iPod/.test(navigator.userAgent) && !await askConfirm('Sur iPhone : ouvre l’app Contacts, touche « Listes », reste appuyé sur une liste (ou « Tous les contacts ») puis « Exporter » et enregistre le fichier .vcf dans Fichiers. Choisis ensuite ce fichier ici.\n\nContinuer ?', 'Continuer')) return;
    $('vcf-import-input').click();
  }
  // a business card, photographed: the text is read on the device, then the contact form opens filled in
  async function scanCard(file){
    if(!file) return; const st=$('card-scan-status'); if(st){ st.hidden=false; st.textContent='Lecture de la carte…'; }
    try{ await loadTesseract(); const { data }=await Tesseract.recognize(file, 'fra+eng'); const g=parseSignatureText(data.text||'');
      if(st) st.hidden=true;
      if(!g.firstName && !g.lastName && !g.email && !g.phone1){ tell('Je n’ai pas réussi à lire la carte. Essaie avec plus de lumière, la carte bien à plat.'); return; }
      openContactForm(null, Object.assign({}, g, { comment:[g.comment, 'Carte de visite scannée le '+new Date().toLocaleDateString('fr-FR')].filter(Boolean).join('\n') }));
    }catch(e){ if(st) st.hidden=true; tell('La lecture de la carte a échoué (connexion nécessaire la première fois).'); }
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
    const live=app.contacts.filter(c=>!c.deleted && (c.firstName||c.lastName) && (c.phone1||c.phone2||c.email));
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
    Object.assign(api, { openPhoneImport, phoneImportStart, scanCard, openVcfExport, doVcfExport });
  };
  return api;
})();
