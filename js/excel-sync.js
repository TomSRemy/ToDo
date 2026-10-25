// Todo — the shared Excel files (loaded before js/app.js): sending a deal to the Pipe and the Suivi through the local bridge
// without overwriting a colleague's cell, and « Excel ⇄ appli », what changed on either side since. Split out of js/app.js (code audit).
window.TodoExcelSync=(function(){
  const api={};
  // what this part uses from js/app.js, given where its code used to stand in js/app.js (so it runs in the same order);
  // app.<name>: a value js/app.js defines further down or may replace, read when used
  api.init=function(app){
    const { $, ON_PHONE, PQ_FIELDS, bddCells, bridgeCall, bridgeCheck, bridgeConfigured, cellToText, importParcFromBridge, isExited, openOppDetail, oppActionBtn, oppName, pipeCells, pqFold, pqPad, relanceOnMove, renderPipeline, saveCrm, setOppStage, softFail, stageIndex, stageLabel, suiviState, touchCrm }=app;
    Object.assign(api, { xsState, xsList, openExcelSync, showBridgeMsg, excelButtons });   // function declarations: ready before the code below runs
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
    if(!app.bridgeState.info || Date.now()-app.bridgeState.checkedAt>60000) await bridgeCheck();
    if(app.bridgeState.ok && !bridgeUpToDate(app.bridgeState.info)) throw new Error('Ton pont Excel est une ancienne version, moins protégée que la nouvelle : rien n\u2019a été envoyé. Dans Réglages → Pont Excel, télécharge pont-excel.ps1, remplace l\u2019ancien fichier et relance le pont.');
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
  function xsList(){ return app.opportunities.filter(o=>!o.deleted && o.kind==='installation' && (!isExited(o) || (o.excelSent||o.pipeSentAt||o.bddSentAt))); }
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
      : 'Pont Excel non connecté sur cet ordinateur : la colonne « appli » dit ce qui a été envoyé ; le Suivi est relu depuis le Portefeuille (fichier chargé). Le pont se règle dans Réglages.';
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
    Object.assign(api, { bridgeUpToDate, xsTodo, xsBddApplies });
  };
  return api;
})();
