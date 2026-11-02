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
  // the bridge published with this app (bridge/pont-excel.ps1 $Version; tests/bridge_test.py checks they match). Writing needs it:
  // 1.4 writes only in « Pipe Agrégation » / « BDD Agrégation », 1.7 adds new lines in a table with calculated columns
  const BRIDGE_LATEST='1.14', BRIDGE_MIN='1.11';   // writing needs BRIDGE_MIN; a newer one is only offered
  const verAtLeast=(info, want)=>{ const v=String(info&&info.version||'0').split('.').map(Number), l=want.split('.').map(Number); return v[0]>l[0] || (v[0]===l[0] && (v[1]||0)>=l[1]); };
  const bridgeUpToDate=info=>verAtLeast(info, BRIDGE_MIN), bridgeLatest=info=>verAtLeast(info, BRIDGE_LATEST);
  // sent by packets of 8 lines (Excel takes a few seconds per line): no request runs long enough to be cut, and progress shows
  const XL_PACKET=8;
  async function xlSend(kind, list, rows, onProgress){
    if(!app.bridgeState.info || Date.now()-app.bridgeState.checkedAt>60000) await bridgeCheck();
    if(app.bridgeState.ok && !bridgeUpToDate(app.bridgeState.info)) throw new Error('Ton pont Excel n\u2019est pas à jour (version '+(app.bridgeState.info.version||'?')+', la '+BRIDGE_LATEST+' est disponible) : rien n\u2019a été envoyé. Dans Réglages → Pont Excel, télécharge pont-excel.ps1, remplace l\u2019ancien fichier et relance le pont.');
    let res={}, results=[];
    const pending=[];
    // each packet is remembered as soon as it is written: if a later one fails (bridge closed…), what was written is known
    const remember=(from, part)=>{ part.forEach((r,j)=>{ const i=from+j, o=list[i]; xlRemember(kind, o, rows[i].values, r); if(r.ok && ((r.conflicts&&r.conflicts.length) || r.question)) pending.push({ o, r });
      if(r.ok && r.action!=='en attente'){ o.excelSent=Object.assign({}, o.excelSent||{}, { [kind]:{ at:Date.now(), h:xsHash(rows[i].values) } }); o[kind==='pipe'?'pipeSentAt':'bddSentAt']=Date.now(); touchCrm(o); } }); saveCrm(); };
    for(let k=0;k<rows.length;k+=XL_PACKET){
      if(onProgress) onProgress(k, rows.length);
      let r;
      try{ r=await bridgeCall('POST','/'+kind+'/upsert',{ rows:rows.slice(k, k+XL_PACKET) }, 180000); }
      catch(e){ if(k>0) e.message='Envoi arrêté après '+k+' ligne'+(k>1?'s':'')+' sur '+rows.length+' (déjà écrites et notées) : '+e.message; throw e; }
      remember(k, r.results||[]); results=results.concat(r.results||[]); res={ ok:r.ok, backup:res.backup||r.backup, fileWasClosed:res.fileWasClosed||r.fileWasClosed };
    }
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
  // a / b: the two key columns (0 = column A): Pipe G « Nom Producteur » + T « Nom Centrale »; Suivi AF « Nom_prod » + AH « Nom_Installation_prod »
  const XS_KEYS={ pipe:{ header:'Nom Producteur', a:6, b:19, sheet:/^\s*pipe\s+agr[eé]gation\s*$/i }, bdd:{ header:'Nom_prod', a:31, b:33, sheet:/^\s*bdd\s+agr[eé]gation\s*$/i } };   // that sheet only, never another « Pipe … » one
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
          if(xsKept(kind, o, kind==='pipe'?PQ_FIELDS.indexOf(c.f):c.i, ex)) return;   // « Garder l'Excel » already answered for this value
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
  // A difference between the app and an Excel cell: « Garder l'appli » (written into the Excel) or « Garder l'Excel », then
  // « Mettre aussi l'appli à jour ? » (yes: the sheet takes the Excel's value; no: not asked again while the cell stays the same).
  // vi = index of the value in what the app sends (Pipe: field order; Suivi: column)
  const xsViOf=(kind, d)=>kind==='pipe'?PQ_FIELDS.indexOf(d.col.f):d.col.i;
  function xsKeep(kind, o, vi, excel){ o.excelKeep=o.excelKeep||{}; o.excelKeep[kind]=Object.assign({}, o.excelKeep[kind]||{}, { [vi]:excel }); touchCrm(o); saveCrm(); }
  const xsKept=(kind, o, vi, excel)=>{ const k=o.excelKeep && o.excelKeep[kind] && o.excelKeep[kind][vi]; return k!=null && xsNorm(cellToText(k))===xsNorm(excel); };
  // what « aligner l'appli » does for this cell, or null when the app has no such field
  function xsAlignAction(kind, o, vi, excel){
    if(kind==='pipe'){ const f=PQ_FIELDS[vi]; return f?{ label:'la fiche prend « '+(excel||'vide')+' »', run:()=>xsTake(o, { col:{ f }, excel }) }:null; }
    if(vi===24){ const a=xsStatutAction(o, excel); return a?{ label:a.label.toLowerCase(), run:a.run }:null; }
    return null;
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
        +'<p class="modal-hint xs-info"></p><div class="xs-tools"><button type="button" class="xs-read">Relire les Excel</button><button type="button" class="xs-send" data-k="pipe"></button><button type="button" class="xs-send" data-k="bdd"></button><span class="xs-bulk-group"><button type="button" class="xs-bulk" data-p="excel">Tout garder Excel</button><button type="button" class="xs-bulk" data-p="appli">Tout garder appli</button></span></div><div class="xs-body"></div></div>';
      document.body.appendChild(ov); const close=()=>ov.classList.add('hidden');
      ov.addEventListener('click', e=>{ if(e.target===ov) close(); }); ov.querySelector('.xs-x').onclick=close;
      ov.querySelectorAll('.xs-filter button').forEach(b=>b.onclick=()=>{ ov.querySelectorAll('.xs-filter button').forEach(x=>x.classList.toggle('on', x===b)); paintExcelSync(); });
      ov.querySelector('.xs-read').onclick=async e=>{ const b=e.currentTarget, t=b.textContent; b.disabled=true; b.textContent='Lecture…';
        try{ await xsReadFile('pipe'); await xsReadFile('bdd'); importParcFromBridge(true); }catch(err){ showBridgeMsg(err.message, false); } b.disabled=false; b.textContent=t; paintExcelSync(); };
      ov.querySelectorAll('.xs-send').forEach(b=>b.onclick=async()=>{ const kind=b.dataset.k, list=xsList().filter(xsInScope).filter(o=>(kind==='pipe'||xsBddApplies(o)) && xsTodo(xsState(kind,o)) && !((xsState(kind,o).diffs||[]).some(d=>d.byExcel))); if(!list.length) return;
        await sendToExcel(kind, list, b); if(bridgeConfigured()){ try{ await xsReadFile(kind); }catch(e){ softFail('relecture de l\u2019Excel', e); } } paintExcelSync(); });
      // decide at once for every diverging cell currently shown (whatever scope/filter is selected, not just one lot)
      ov.querySelectorAll('.xs-bulk').forEach(b=>b.onclick=async()=>{ const targets=xsConflictTargets(xsShownNow); if(!targets.length) return;
        b.disabled=true; const t=b.textContent; b.textContent='Envoi…';
        await xsApplyBulk(targets, b.dataset.p); b.disabled=false; b.textContent=t; });
    }
    { let sc=ov.querySelector('.xs-scope'); if(!sc){ sc=document.createElement('div'); sc.className='xs-scope xs-filter'; ov.querySelector('.xs-head').appendChild(sc);
        [['pipe','Pipeline'],['parc','Portefeuille (signés)'],['all','Tout']].forEach(([k,l])=>{ const b=document.createElement('button'); b.type='button'; b.dataset.s=k; b.textContent=l; b.onclick=()=>{ xsScope=k; paintExcelSync(); }; sc.appendChild(b); }); } }
    ov.classList.remove('hidden'); paintExcelSync();
    if(bridgeConfigured() && !(opts&&opts.noRead) && (!xsRead.pipe || Date.now()-xsRead.pipe.at>120000)){ try{ await xsReadFile('pipe'); await xsReadFile('bdd'); }catch(e){ softFail('relecture des Excel', e); } paintExcelSync(); }
  }
  // What « choices » (and « aligns », for the ones kept from the Excel) say for this installation's diffs : the local
  // effects (keeping a value, aligning the fiche) happen right away, with no network call. What still needs writing
  // into the Excel comes back as { force, seen } ( null when there is nothing to write).
  function xsBuildRowPlan(kind, o, diffs, choices, aligns){
    const force={}, seen={};
    diffs.forEach(d=>{ const vi=xsViOf(kind, d), ch=choices[vi];
      if(ch==='appli'){
        // the appli has nothing here: writing it would blank nothing (the bridge never empties a cell) — take the
        // Excel value into the fiche instead, the way « Garder l'Excel » used to offer
        if(!d.app){ const al=xsAlignAction(kind, o, vi, d.excel); if(al) al.run(); }
        else { force[vi]='replace'; seen[vi]=d.excel; }
      } else if(ch==='merge'){ force[vi]='merge'; seen[vi]=d.excel; }   // comment columns only : both texts kept, one after the other, in the Excel
      else {
        xsKeep(kind, o, vi, d.excel);
        if(aligns[vi]){ const al=xsAlignAction(kind, o, vi, d.excel); if(al) al.run(); }
      } });
    return Object.keys(force).length ? { force, seen } : null;
  }
  // The single row's own « Appliquer ». Returns whether it actually sent (false only when sendToExcel failed, e.g.
  // the file is locked elsewhere).
  async function xsApplyRow(kind, o, diffs, choices, aligns){
    const plan=xsBuildRowPlan(kind, o, diffs, choices, aligns);
    // sendToExcel re-reads the file and repaints the panel itself ; nothing left to do when it sends
    if(plan) return await sendToExcel(kind, [o], null, plan);
    renderPipeline(); saveCrm(); paintExcelSync(); return true;
  }
  // the diverging cells for a set of rows, as { kind, o, diffs } — a lot's rows, or everything currently shown
  function xsConflictTargets(rowList){
    const out=[]; (rowList||[]).forEach(r=>{ if(r.pDiffs.length) out.push({ kind:'pipe', o:r.o, diffs:r.pDiffs }); if(r.bDiffs.length) out.push({ kind:'bdd', o:r.o, diffs:r.bDiffs }); });
    return out;
  }
  // Every target's plan is built first (its local effects happen right away, with no network call), then every
  // installation that still needs writing is sent together, Pipe and Suivi each as their own request (packets of 8) :
  // the bridge opens the Excel file once per packet instead of once per installation, so it isn't kept busy — and
  // isn't closed to opening it yourself — for the whole bulk action.
  async function xsSendPlans(plans){   // plans : [{ kind, o, plan }]
    let sentAny=false;
    for(const kind of ['pipe','bdd']){
      const items=plans.filter(p=>p.kind===kind && p.plan);
      if(items.length){ sentAny=true; await sendToExcel(kind, items.map(p=>p.o), null, items.map(p=>p.plan)); }
    }
    if(!sentAny){ renderPipeline(); saveCrm(); paintExcelSync(); }
  }
  // one policy (« excel » or « appli ») for every cell of every target : a lot sent together for pricing often moves the
  // same way on every plant, so this decides it once instead of installation by installation
  async function xsApplyBulk(targets, policy){
    const plans=targets.map(tg=>{ const choices={}, aligns={}; tg.diffs.forEach(d=>{ const vi=xsViOf(tg.kind, d); choices[vi]=policy; aligns[vi]=true; });
      return { kind:tg.kind, o:tg.o, plan:xsBuildRowPlan(tg.kind, tg.o, tg.diffs, choices, aligns) }; });
    await xsSendPlans(plans);
  }
  // the lot grid : each cell can be decided on its own (not one policy for everything), key = kind|vi|installation id
  async function xsApplyLotGrid(targets, cellChoice){
    const plans=targets.map(tg=>{ const choices={}, aligns={}; tg.diffs.forEach(d=>{ const vi=xsViOf(tg.kind, d); choices[vi]=cellChoice[tg.kind+'|'+vi+'|'+tg.o.id]||'excel'; aligns[vi]=true; });
      return { kind:tg.kind, o:tg.o, plan:xsBuildRowPlan(tg.kind, tg.o, tg.diffs, choices, aligns) }; });
    await xsSendPlans(plans);
  }
  // Several fields changed by someone else on the same installation : one table, columns = fields (like the Excel header
  // row), the Excel row above the appli row — click a cell to keep it, click « Excel »/« Appli » to keep the whole row,
  // then one « Appliquer » sends every field kept from the appli in a single request.
  const xsIsCommentCol=label=>/commentaire|remarque|observation|particularit/i.test(label||'');
  function xsDiffTable(td, kind, o, diffs){
    if(!diffs.length) return;
    const choices={}, aligns={}; diffs.forEach(d=>{ const vi=xsViOf(kind, d); choices[vi]='excel'; aligns[vi]=true; });   // default: nothing sent, the Excel's value is kept and brought into the fiche (sauf décoché)
    const wrap=document.createElement('div'); wrap.className='xc-wrap';
    const table=document.createElement('table'); table.className='xc-table';
    const headRow=document.createElement('tr'); headRow.appendChild(document.createElement('th'));
    diffs.forEach(d=>{ const th=document.createElement('th'); th.textContent=d.col.label;
      if(xsIsCommentCol(d.col.label)){ const vi=xsViOf(kind, d), mb=document.createElement('button'); mb.type='button'; mb.className='xc-merge'; mb.textContent='fusionner';
        mb.onclick=()=>{ choices[vi]=choices[vi]==='merge'?'excel':'merge'; refresh(); }; th.appendChild(document.createElement('br')); th.appendChild(mb); }
      headRow.appendChild(th); });
    const thead=document.createElement('thead'); thead.appendChild(headRow); table.appendChild(thead);
    const tbody=document.createElement('tbody'); table.appendChild(tbody);
    const mkRow=(side, label)=>{
      const tr=document.createElement('tr');
      const rowBtn=document.createElement('button'); rowBtn.type='button'; rowBtn.className='xc-rowsel'; rowBtn.innerHTML='<span class="dot"></span>'+label;
      const th=document.createElement('th'); th.appendChild(rowBtn); tr.appendChild(th);
      diffs.forEach(d=>{ const vi=xsViOf(kind, d), td2=document.createElement('td'), b=document.createElement('button');
        b.type='button'; b.className='xc-cell'; b.textContent=(side==='excel'?d.excel:d.app)||'vide';
        b.onclick=()=>{ choices[vi]=side; refresh(); };
        td2.appendChild(b); tr.appendChild(td2); });
      rowBtn.onclick=()=>{ diffs.forEach(d=>{ choices[xsViOf(kind, d)]=side; }); refresh(); };
      return tr;
    };
    const rowExcel=mkRow('excel', 'Excel'), rowApp=mkRow('appli', 'Appli');
    tbody.append(rowExcel, rowApp); wrap.appendChild(table); td.appendChild(wrap);
    const alignBox=document.createElement('div'); alignBox.className='xc-aligns'; td.appendChild(alignBox);
    const foot=document.createElement('div'); foot.className='xc-foot';
    const summary=document.createElement('span'); foot.appendChild(summary);
    const apply=document.createElement('button'); apply.type='button'; apply.className='pq-link xc-apply'; apply.textContent='Appliquer'; foot.appendChild(apply);
    td.appendChild(foot);
    const refresh=()=>{
      diffs.forEach((d,i)=>{ const vi=xsViOf(kind, d), sel=choices[vi];
        const ec=rowExcel.children[i+1].firstChild, ac=rowApp.children[i+1].firstChild;
        ec.classList.toggle('sel', sel==='excel'); ac.classList.toggle('sel', sel==='appli');
        ec.classList.toggle('merged', sel==='merge'); ac.classList.toggle('merged', sel==='merge');
        const mb=headRow.children[i+1].querySelector('.xc-merge'); if(mb) mb.classList.toggle('on', sel==='merge'); });
      rowExcel.firstChild.firstChild.classList.toggle('on', diffs.every(d=>choices[xsViOf(kind, d)]==='excel'));
      rowApp.firstChild.firstChild.classList.toggle('on', diffs.every(d=>choices[xsViOf(kind, d)]==='appli'));
      // kept from the Excel, and the Excel's value also fits a field on the fiche (a stage, a status) : offer to bring it in too
      alignBox.innerHTML='';
      diffs.forEach(d=>{ const vi=xsViOf(kind, d); if(choices[vi]!=='excel') return;
        const al=xsAlignAction(kind, o, vi, d.excel); if(!al) return;
        const lab=document.createElement('label'); lab.className='xc-align';
        const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!aligns[vi]; cb.onchange=()=>{ aligns[vi]=cb.checked; };
        lab.append(cb, document.createTextNode(' aussi : '+al.label));
        alignBox.appendChild(lab); });
      const nApp=Object.values(choices).filter(v=>v==='appli'||v==='merge').length;
      summary.textContent=nApp?nApp+' case'+(nApp>1?'s':'')+' à écrire dans Excel':'rien à écrire dans Excel';
    };
    refresh();
    apply.onclick=async()=>{
      apply.disabled=true; apply.textContent='Envoi…';
      await xsApplyRow(kind, o, diffs, choices, aligns);
    };
  }
  function paintExcelSync(){
    const ov=$('xs-overlay'); if(!ov || ov.classList.contains('hidden')) return;
    const all=ov.querySelector('.xs-filter .on').dataset.f==='all', body=ov.querySelector('.xs-body'); body.innerHTML='';
    const fmtD=t=>t>1e12?new Date(t).toLocaleDateString('fr-FR'):'';
    ov.querySelector('.xs-info').textContent=bridgeConfigured()
      ? 'Pipe '+(xsRead.pipe?'relu le '+fmtD(xsRead.pipe.at)+' à '+new Date(xsRead.pipe.at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'pas encore relu')+' · Suivi '+(xsRead.bdd?'relu':'pas encore relu')+'. Envoyer ne remplace jamais une case modifiée par un collègue : elle te sera demandée.'
      : 'Pont Excel non connecté sur cet ordinateur : la colonne « appli » dit ce qui a été envoyé ; le Suivi est relu depuis le Portefeuille (fichier chargé). Le pont se règle dans Réglages.';
    ov.querySelectorAll('.xs-scope button').forEach(b=>b.classList.toggle('on', b.dataset.s===xsScope));
    const rows=xsList().filter(xsInScope).map(o=>{ const p=xsState('pipe',o), b=xsBddApplies(o)?xsState('bdd',o):null;
      return { o, p, b, pDiffs:p.diffs.filter(d=>d.byExcel), bDiffs:b?b.diffs.filter(d=>d.byExcel):[] }; });
    const todo=rows.filter(r=>xsTodo(r.p) || (r.b && xsTodo(r.b)));
    const cntP=rows.filter(r=>xsTodo(r.p) && !r.pDiffs.length).length, cntB=rows.filter(r=>r.b && xsTodo(r.b) && !r.bDiffs.length).length;
    ov.querySelectorAll('.xs-send').forEach(b=>{ const n=b.dataset.k==='pipe'?cntP:cntB; b.textContent='Envoyer au '+(b.dataset.k==='pipe'?'Pipe':'Suivi')+' ('+n+')'; b.disabled=!n || !bridgeConfigured(); b.title=bridgeConfigured()?'':'Pont Excel non connecté'; });
    const shown=all?rows:todo;
    xsShownNow=shown;
    const nConflictCells=xsConflictTargets(shown).reduce((s,tg)=>s+tg.diffs.length, 0);
    ov.querySelectorAll('.xs-bulk').forEach(b=>{ b.textContent=(b.dataset.p==='excel'?'Tout garder Excel':'Tout garder appli')+' ('+nConflictCells+')'; b.disabled=!nConflictCells || !bridgeConfigured(); b.title=bridgeConfigured()?'':'Pont Excel non connecté'; });
    if(!shown.length){ body.innerHTML='<p class="xs-empty">✓ Tout est à jour'+(xsRead.pipe?'':' côté appli (relis les Excel pour vérifier le contenu des fichiers)')+'.</p>'; return; }
    const cell=(kind, o, st, diffs)=>{
      const td=document.createElement('td'); if(!st){ td.innerHTML='<span class="xs-na">pas encore (avant le pricing)</span>'; return td; }
      const tag=(cls,txt)=>{ const s=document.createElement('span'); s.className='xs-tag '+cls; s.textContent=txt; td.appendChild(s); };
      if(st.app==='jamais') tag('warn','Pas envoyé');
      else if(st.app==='modif') tag('warn','Modifié dans l’appli depuis l’envoi'+(fmtD(st.sentAt)?' du '+fmtD(st.sentAt):''));
      else tag('ok','Envoyé'+(fmtD(st.sentAt)?' le '+fmtD(st.sentAt):''));
      if(st.excel==='absent' && st.app!=='jamais') tag('bad','Absent du fichier');
      if(st.excel==='statut') tag('info','Statut Suivi : '+(st.statut||'?'));
      if(st.line) { const l=document.createElement('span'); l.className='xs-line'; l.textContent='ligne '+st.line; td.appendChild(l); }
      xsDiffTable(td, kind, o, diffs);
      if(st.excel==='statut'){ const a=xsStatutAction(o, st.statut); if(a){ const b=document.createElement('button'); b.type='button'; b.className='pq-link'; b.textContent=a.label; b.onclick=()=>{ a.run(); renderPipeline(); paintExcelSync(); }; td.appendChild(b); } }
      if(xsTodo(st) && !diffs.length && bridgeConfigured()){ const b=document.createElement('button'); b.type='button'; b.className='pq-link xs-one'; b.textContent='Envoyer'; b.onclick=async()=>{ await sendToExcel(kind,[o],b); try{ await xsReadFile(kind); }catch(e){ softFail('relecture de l’Excel', e); } paintExcelSync(); }; td.appendChild(b); }
      return td; };
    const soloRow=(tb,{o,p,b,pDiffs,bDiffs})=>{ const tr=document.createElement('tr');
      const n=document.createElement('td'); n.className='xs-name'; n.innerHTML='<b></b><span></span>'; n.firstChild.textContent=oppName(o); n.lastChild.textContent=[o.company, stageLabel(o.stage, o)].filter(Boolean).join(' · ');
      n.onclick=()=>{ $('xs-overlay').classList.add('hidden'); openOppDetail(o.id); };
      tr.append(n, cell('pipe', o, p, pDiffs), cell('bdd', o, b, bDiffs)); tb.appendChild(tr); };
    // installations sent together for one pricing request (o.requestId) : a lot, folded by default like a directory
    const lotIds=new Set(), lots=[], solo=[];
    shown.forEach(r=>{ const rid=r.o.requestId;
      if(rid){ if(lotIds.has(rid)) return; lotIds.add(rid);
        const members=shown.filter(x=>x.o.requestId===rid);
        if(members.length>1) lots.push({ rid, members }); else solo.push(members[0]); }
      else solo.push(r); });
    if(lots.length){ const lw=document.createElement('div'); lw.className='xl-lots'; lots.forEach(({rid,members})=>lw.appendChild(xlLotCard(rid, members))); body.appendChild(lw); }
    if(solo.length){
      if(lots.length){ const h=document.createElement('div'); h.className='xs-solo-head'; h.textContent='Hors lot'; body.appendChild(h); }
      const t=document.createElement('table'); t.className='xs-table';
      t.innerHTML='<thead><tr><th>Installation</th><th>Pipe Excel</th><th>Suivi (BDD)</th></tr></thead>';
      const tb=document.createElement('tbody');
      solo.forEach(r=>soloRow(tb, r));
      t.appendChild(tb); body.appendChild(t);
    }
  }
  // A lot, folded by default : its name, how many cases need a decision, two quick buttons for the whole lot.
  // Opened, a dense grid — columns are the fields that diverge anywhere in the lot, rows are its installations ;
  // a column header decides that field for the whole lot, a row name decides that whole installation, a cell just itself.
  function xlLotCard(rid, members){
    const req=app.opportunities.find(x=>x.id===rid), label=(req && !req.deleted && req.label) || ('Lot de '+members.length+' installations');
    const targets=xsConflictTargets(members), nCells=targets.reduce((s,tg)=>s+tg.diffs.length, 0);
    const card=document.createElement('div'); card.className='xl-lot';
    const head=document.createElement('div'); head.className='xl-head';
    head.innerHTML='<span class="xl-chev">▶</span><div class="xl-name"><b></b><span></span></div><div class="xl-meta"></div>';
    head.querySelector('.xl-name b').textContent=label;
    head.querySelector('.xl-name span').textContent=members.length+' installation'+(members.length>1?'s':'');
    const meta=head.querySelector('.xl-meta');
    const tag=document.createElement('span'); tag.className='xl-tag '+(nCells?'todo':'ok'); tag.textContent=nCells?nCells+' case'+(nCells>1?'s':''):'à jour'; meta.appendChild(tag);
    card.appendChild(head);
    if(!nCells) return card;   // nothing to decide : the tag alone says so, no need to open it

    const quick=document.createElement('div'); quick.className='xl-quick';
    [['excel','Tout Excel'],['appli','Tout appli']].forEach(([policy,lbl])=>{ const qb=document.createElement('button'); qb.type='button'; qb.textContent=lbl;
      qb.onclick=e=>{ e.stopPropagation(); qb.disabled=true; xsApplyBulk(targets, policy); }; quick.appendChild(qb); });
    meta.appendChild(quick);
    head.onclick=()=>card.classList.toggle('open');

    const byCol=new Map();
    targets.forEach(tg=>tg.diffs.forEach(d=>{ const key=tg.kind+'|'+d.col.label; if(!byCol.has(key)) byCol.set(key, { kind:tg.kind, label:d.col.label, items:[] }); byCol.get(key).items.push({ o:tg.o, d }); }));
    const cols=[...byCol.values()];
    const cellChoice={};   // key kind|vi|installation id -> 'excel'|'appli'
    cols.forEach(col=>col.items.forEach(it=>{ cellChoice[col.kind+'|'+xsViOf(col.kind, it.d)+'|'+it.o.id]='excel'; }));

    const wrap=document.createElement('div'); wrap.className='xl-grid-wrap';
    const table=document.createElement('table'); table.className='xl-grid';
    const thead=document.createElement('thead'); const htr=document.createElement('tr'); htr.appendChild(document.createElement('th'));
    const colBtns=[];
    cols.forEach(col=>{ const th=document.createElement('th'); const cb=document.createElement('button'); cb.type='button'; cb.className='xl-colhead'; cb.dataset.side='excel';
      cb.innerHTML='<b></b><small></small>'; cb.querySelector('b').textContent=col.label+(col.kind==='bdd'?' (Suivi)':''); cb.querySelector('small').textContent=col.items.length+' installation'+(col.items.length>1?'s':'');
      th.appendChild(cb); htr.appendChild(th); colBtns.push(cb); });
    thead.appendChild(htr); table.appendChild(thead);
    const tbody=document.createElement('tbody'); table.appendChild(tbody);
    const cellBtns=[];   // { kind, vi, oid, excelBtn, appliBtn }
    members.forEach(m=>{
      const tr=document.createElement('tr');
      const rh=document.createElement('th'); const rb=document.createElement('button'); rb.type='button'; rb.className='xl-rowhead'; rb.dataset.side='excel';
      rb.innerHTML='<b></b>'; rb.querySelector('b').textContent=oppName(m.o); rh.appendChild(rb); tr.appendChild(rh);
      const rowCellKeys=[];
      cols.forEach(col=>{
        const td=document.createElement('td'); const item=col.items.find(it=>it.o.id===m.o.id);
        if(!item){ td.className='xl-same'; td.textContent='—'; tr.appendChild(td); return; }
        const vi=xsViOf(col.kind, item.d), key=col.kind+'|'+vi+'|'+m.o.id; rowCellKeys.push(key);
        const c=document.createElement('div'); c.className='xl-cell';
        const bE=document.createElement('button'); bE.type='button'; bE.innerHTML='<i>Excel</i>'; bE.appendChild(document.createTextNode(item.d.excel||'vide')); bE.classList.add('sel');
        const bA=document.createElement('button'); bA.type='button'; bA.innerHTML='<i>Appli</i>'; bA.appendChild(document.createTextNode(item.d.app||'vide'));
        bE.onclick=()=>{ cellChoice[key]='excel'; refresh(); }; bA.onclick=()=>{ cellChoice[key]='appli'; refresh(); };
        c.append(bE, bA); td.appendChild(c); tr.appendChild(td);
        cellBtns.push({ key, bE, bA });
      });
      rb.onclick=()=>{ const next=rb.dataset.side==='excel'?'appli':'excel'; rb.dataset.side=next; rowCellKeys.forEach(k=>{ cellChoice[k]=next; }); refresh(); };
      tbody.appendChild(tr);
    });
    wrap.appendChild(table); card.appendChild(wrap);

    colBtns.forEach((cb,i)=>{ const col=cols[i];
      cb.onclick=()=>{ const next=cb.dataset.side==='excel'?'appli':'excel'; cb.dataset.side=next;
        col.items.forEach(it=>{ cellChoice[col.kind+'|'+xsViOf(col.kind, it.d)+'|'+it.o.id]=next; }); refresh(); }; });

    const foot=document.createElement('div'); foot.className='xl-foot';
    const summary=document.createElement('span'); foot.appendChild(summary);
    const apply=document.createElement('button'); apply.type='button'; foot.appendChild(apply);
    card.appendChild(foot);

    const refresh=()=>{
      cellBtns.forEach(({key,bE,bA})=>{ const side=cellChoice[key]; bE.classList.toggle('sel', side==='excel'); bA.classList.toggle('sel', side==='appli'); });
      const nApp=Object.values(cellChoice).filter(v=>v==='appli').length;
      summary.textContent=nApp?nApp+' case'+(nApp>1?'s':'')+' à écrire dans Excel':'rien à écrire dans Excel';
      apply.textContent='Appliquer ('+members.length+' installation'+(members.length>1?'s':'')+')';
    };
    refresh();
    apply.onclick=async()=>{ apply.disabled=true; apply.textContent='Envoi…'; await xsApplyLotGrid(targets, cellChoice); };
    return card;
  }
  let xsShownNow=[];   // what paintExcelSync last drew, for the « Tout garder … » buttons (read at click time)
  // extra : one { force, seen } shared by every installation in « list », or (for a mix of per-installation choices,
  // as in a lot) one array matching « list » one-for-one. Sent as a single request (packets of 8 Excel rows) : the
  // bridge opens the file once per packet, instead of once per installation — the file stays free for the rest of the
  // time, where a bridge that opened and closed it once per installation kept it busy for the whole bulk action.
  async function sendToExcel(kind, list, btn, extra){
    if(ON_PHONE) return true;
    const label=btn?btn.textContent:'';
    if(btn){ btn.disabled=true; btn.textContent='Envoi…'; }
    try{
      const rows=list.map((o,i)=>xlRowFor(kind, o, Array.isArray(extra)?extra[i]:extra));
      const { res, results, pending }=await xlSend(kind, list, rows, (k,n)=>{ if(btn && n>XL_PACKET) btn.textContent='Envoi '+k+'/'+n+'…'; });
      const msg=xlSummary(kind, results, res);
      try{ await xsReadFile(kind); }catch(e){ softFail('relecture de l’Excel', e); }
      // a cell the bridge could not write (changed by someone else) is not asked about here a second time : the fresh
      // read above makes it show up as an ordinary difference, decided in the same table as any other. Only a question
      // about which row is meant (duplicate lines, another contract, a plant lost recently) still needs asking.
      const questions=pending.filter(p=>p.r.question);
      if(btn){ btn.textContent=questions.length?'À trancher':'✓ Envoyé'; btn.title=msg; setTimeout(()=>{ btn.textContent=label; btn.disabled=false; },2500); }
      showBridgeMsg(msg, true);
      if(questions.length) openXlReview(kind, questions);
      const ov=$('xs-overlay');
      if(ov && !ov.classList.contains('hidden')) paintExcelSync();
      else if(pending.length>questions.length) await openExcelSync({ noRead:true });   // a plain conflict, panel not open : show it there rather than nowhere
      return true;
    }catch(e){
      if(btn){ btn.textContent=label; btn.disabled=false; }
      showBridgeMsg(e.message, false);
      return false;
    }
  }
  // Which row is meant : several open lines share this plant's name (duplicate), the open line carries another
  // contract's code, or a plant closed recently has a line that might be the same affair. A cell the bridge could not
  // write (changed by someone else) is not asked here any more : sendToExcel's re-read already surfaces it as an
  // ordinary difference, in the same table as any other.
  function openXlReview(kind, pending){
    const box=$('xl-review-body'); box.innerHTML='';
    $('xl-review-title').textContent=(kind==='pipe'?'Pipe Excel':'Suivi Agrégation')+' : quelle ligne ?';
    pending.forEach((p,idx)=>{
      const s=document.createElement('section'); s.className='xr-item';
      const h=document.createElement('h4'); h.textContent=p.r.key; if(p.r.row){ const sp=document.createElement('span'); sp.textContent='ligne '+p.r.row; h.appendChild(sp); } s.appendChild(h);
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
      box.appendChild(s);
    });
    $('xl-review-apply').onclick=async ()=>{
      const list=[], rows=[];
      pending.forEach((p,idx)=>{
        const ch=document.querySelector('input[name="xq-'+idx+'"]:checked'); const v=ch?ch.value:'skip'; if(v==='skip') return;
        list.push(p.o); rows.push(xlRowFor(kind, p.o, { target:v==='new'?'new':+v }));
      });
      closeXlReview();
      if(!rows.length){ showBridgeMsg('Rien envoyé.', true); return; }
      try{
        const { res, results, pending:again }=await xlSend(kind, list, rows);
        showBridgeMsg(xlSummary(kind, results, res), true);
        try{ await xsReadFile(kind); }catch(e){ softFail('relecture de l’Excel', e); }
        const ov=$('xs-overlay'); if(ov && !ov.classList.contains('hidden')) paintExcelSync();
        const qAgain=again.filter(p=>p.r.question);
        if(qAgain.length) openXlReview(kind, qAgain);
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
    Object.assign(api, { bridgeUpToDate, bridgeLatest, xsTodo, xsBddApplies, BRIDGE_LATEST });
  };
  return api;
})();
