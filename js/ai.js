// Todo — « Compléter avec l'IA » (loaded before js/app.js), set aside since 2026-10-23: hidden unless localStorage feat-ai = 1.
// Kept in its own file so the main code no longer carries it. Split out of js/app.js (code audit, lot 3, C14).
window.TodoAI=(function(){
  const api={};
  // everything this part uses from js/app.js, given once when the app has finished loading
  api.init=function(app){
    const { aiKey, $, CARACT_ROWS, caractKey, caractSet, caractValue, oppName, renderPipeline, saveCrm, touchCrm }=app;
  // ---------- « Compléter avec l'IA » : Claude proposes the empty lines of the characteristics file that follow from what the sheet knows ----------
  // Its key stays on this device (like the GitHub token); without one, the request is copied for claude.ai and the answer pasted back.
  const AI_MODEL='claude-sonnet-5-5';
  // set aside for now (2026-10-23): hidden unless turned on for this device (localStorage feat-ai = 1)
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
    if(!r.ok) throw new Error(r.status===401?'Clé Claude refusée (Réglages).':(j.error && j.error.message)||('Erreur '+r.status));
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
    Object.assign(api, { openAiFill });
  };
  return api;
})();
