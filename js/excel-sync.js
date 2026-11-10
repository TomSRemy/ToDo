// Todo — the shared Excel files (loaded before js/app.js): sending a deal to the Pipe and the Suivi through the local bridge
// without overwriting a colleague's cell, and « Synchro Excel », what changed on either side since. Split out of js/app.js (code audit).
window.TodoExcelSync=(function(){
  const api={};
  // a plain paper-plane, so « Envoyer »/« Appliquer » read as a send action at a glance, not just another button
  const XL_SEND_ICO='<svg class="xl-send-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  // a plain "open" arrow, next to an installation's name anywhere in Synchro Excel : its own fiche, one click away,
  // instead of having to find it again in Pipeline — never bubbles (installs a stopPropagation, the surrounding row/
  // header has its own click for something else : fold the card, cycle a cell's choice…)
  const XL_OPEN_ICO='<svg class="xl-open-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  // what this part uses from js/app.js, given where its code used to stand in js/app.js (so it runs in the same order);
  // app.<name>: a value js/app.js defines further down or may replace, read when used
  api.init=function(app){
    const { $, ON_PHONE, PQ_FIELDS, bddCells, bridgeCall, bridgeCheck, bridgeConfigured, cellToText, closeOppDetail, codeAffaire, copyToClipboard, gsTab, importParcFromBridge, isExited, openOppDetail, oppActionBtn, pipeCells, pqFold, pqPad, relanceOnMove, renderPipeline, saveCrm, setOppStage, softFail, stageIndex, suiviState, touchCrm }=app;
    const xlOpenBtn=oid=>{ const b=document.createElement('button'); b.type='button'; b.className='xl-open'; b.title='Ouvrir la fiche'; b.innerHTML=XL_OPEN_ICO;
      b.onclick=e=>{ e.stopPropagation(); openOppDetail(oid); }; return b; };
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
  // the same line the bridge would write, as text : for pasting into Excel by hand instead of sending through the bridge
  const xlRowTsv=(kind,o)=>(kind==='pipe'?pipeCells:bddCells)(o).map(cellToText).join('\t');
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
    // fileWasClosed used to mean "the bridge opened/closed Excel itself, slow and lock-prone, open it yourself" —
    // obsolete now that "closed" means the direct (EPPlus) path wrote it, the more reliable case, not a problem to fix
    return msg;
  }
  // 1.2 = the bridge that never overwrites a colleague's cell, checks the business code and the line again right before
  // writing, and keeps a journal of every cell; an older one is refused
  // the bridge published with this app (bridge/pont-excel.ps1 $Version; tests/bridge_test.py checks they match). Writing needs it:
  // 1.4 writes only in « Pipe Agrégation » / « BDD Agrégation », 1.7 adds new lines in a table with calculated columns
  const BRIDGE_LATEST='1.32', BRIDGE_MIN='1.11';   // writing needs BRIDGE_MIN; a newer one is only offered
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
  // ---------- Synchro Excel : what was sent to the Pipe and to the Suivi (BDD), what changed since on either side ----------
  const xsHash=vals=>{ const t=(vals||[]).map(v=>cellToText(v)).join('␟'); let h=5381; for(let i=0;i<t.length;i++) h=((h*33)^t.charCodeAt(i))>>>0; return h.toString(36); };
  const xsNorm=v=>pqFold(String(v==null?'':v)).replace(/[^a-z0-9]/g,'');
  // a phone number typed in a Pipe cell left as « Nombre » (not Text) loses its leading 0 in Excel's own storage —
  // not a real difference to ask about each time, just how Excel keeps a number : 0624479922 reads back as 624479922
  const xsDigits=v=>String(v||'').replace(/\D/g,'');
  const xsPhoneEq=(a,b)=>{ const da=xsDigits(a), db=xsDigits(b); return !!da && !!db && (da===db || da==='0'+db || db==='0'+da); };
  const xsColIdx=letters=>String(letters||'').toUpperCase().split('').reduce((n,ch)=>n*26+(ch.charCodeAt(0)-64),0)-1;
  // one Excel cell as text, the way the app writes it (dates from Excel serials, numbers with a comma)
  const xsCellText=(v, dateish)=>{ if(v==null) return ''; if(typeof v==='number' && dateish && v>20000 && v<80000){ const d=new Date(Math.round((v-25569)*86400000)); return pqPad(d.getUTCDate())+'/'+pqPad(d.getUTCMonth()+1)+'/'+d.getUTCFullYear(); }
    if(typeof v==='number') return String(Math.round(v*1000)/1000).replace('.',','); if(typeof v==='boolean') return v?'VRAI':'FAUX'; return String(v).trim(); };
  let xsRead={ pipe:null, bdd:null };   // last reading of each file through the bridge: { at, rows: Map(key → row), off }
  let xsReadError={ pipe:null, bdd:null };   // the last read's failure, kept until the next try succeeds or fails again —
  // shown right in the panel (not just a toast that disappears) so a tab renamed or missing in the Excel doesn't go unnoticed
  // a / b: the two key columns (0 = column A): Pipe G « Nom Producteur » + T « Nom Centrale »; Suivi AF « Nom_prod » + AH « Nom_Installation_prod »
  // the sheet name compared the same way the bridge itself does (accents/case/spacing folded away, not a literal
  // regex) : a tab name whose accent is stored as a decomposed Unicode character still matches
  const XS_KEYS={ pipe:{ header:'Nom Producteur', a:6, b:19, sheet:'pipeagregation' }, bdd:{ header:'Nom_prod', a:31, b:33, sheet:'bddagregation' } };   // that sheet only, never another « Pipe … » one
  const xsAppValues=(kind,o)=>kind==='pipe'?PQ_FIELDS.reduce((row,f,i)=>{ row[xsColIdx(f.col)]=pipeCells(o)[i]; return row; }, []):bddCells(o);
  const xsKey=(kind, vals)=>xsNorm(vals[XS_KEYS[kind].a])+'|'+xsNorm(vals[XS_KEYS[kind].b]);
  async function xsReadFile(kind){
    try{
      const res=await bridgeCall('GET','/'+kind+'/read',null,60000), sheets=res.sheets||{};
      const name=Object.keys(sheets).find(n=>xsNorm(n)===XS_KEYS[kind].sheet);
      // the bridge only ever returned the sheet it recognized : when it doesn't match, the real names in the file
      // (allNames, the bridge's own full worksheet list) are what tells apart a renamed tab from the wrong file
      if(!name) throw new Error('Onglet introuvable dans le fichier '+(kind==='pipe'?'Pipe':'BDD')+' (onglets trouvés : '+((res.allNames||[]).join(', ')||'aucun')+')');
      const rows=sheets[name]||[], K=XS_KEYS[kind];
      const hi=rows.findIndex((r,i)=>i<20 && (r||[]).some(c=>xsNorm(c)===xsNorm(K.header))); if(hi<0) throw new Error('En-tête « '+K.header+' » introuvable');
      const off=rows[hi].findIndex(c=>xsNorm(c)===xsNorm(K.header))-K.a, map=new Map();
      rows.slice(hi+1).forEach((r,i)=>{ if(!r) return; const vals=[]; r.forEach((c,j)=>{ vals[j-off]=c; }); const k=xsKey(kind, vals); if(k!=='|') map.set(k, { vals, line:hi+2+i }); });
      xsRead[kind]={ at:Date.now(), rows:map, name };
      xsReadError[kind]=null;
    }catch(e){ xsReadError[kind]=e.message; throw e; }
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
          if(c.f && c.f.k==='tel' && xsPhoneEq(ex, ap)) return;
          if(xsKept(kind, o, c.i, ex)) return;   // « Garder l'Excel » already answered for this value — same key as xsViOf, the real column index
          // changed in the Excel by someone (not what the app wrote last), or still to send from the app
          st.diffs.push({ col:c, excel:ex, app:ap, byExcel:!!ex && xsNorm(ex)!==xsNorm(pv) }); });
        if(kind==='bdd') st.statut=xsCellText(hit.vals[24]);
        st.excel=st.diffs.some(d=>d.byExcel)?'modifie':'present'; } }
    else if(kind==='bdd'){ const s2=suiviState(o); if(s2) st.excel=s2.k==='missing'?'absent':s2.k==='diff'?'statut':'present', st.statut=s2.p&&s2.p.statut; }
    return st;
  }
  // « jamais envoyé » d'après les repères de l'appli ne veut rien dire si l'Excel relu montre déjà exactement les
  // mêmes valeurs (st.excel==='present', aucune diff) : rien à écrire, ça ne doit pas ressortir comme « à traiter ».
  const xsTodo=st=>st.excel==='absent'||st.excel==='modifie'||st.excel==='statut'||(st.diffs||[]).length>0||((st.app==='jamais'||st.app==='modif') && st.excel!=='present');
  // a diff the app can act on in the grid : Excel changed by someone (byExcel), or the app simply never had this
  // field (app empty, Excel not) — not a conflict, but « Envoyer » can never fill it either (the bridge never
  // writes a blank over a filled cell), so it has to be offered here too or the card is stuck on « pas envoyé »
  // forever with nothing to click (found for real : « Ferme de Neuville st Jean », 3 date fields, byExcel false)
  const xsActionable=d=>d.byExcel||!d.app;
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
  // d.col.i is the real Excel column index (xsColIdx) for both kinds — what the bridge expects force/seen/keep keyed
  // by (Upsert-Rows walks vals by absolute index). Pipe used PQ_FIELDS.indexOf(d.col.f) instead : a field's position
  // in that list, not its column — a choice landed on whatever unrelated column happened to share that number, so
  // the real conflicting cell never got the decision and kept coming back as unresolved.
  const xsViOf=(kind, d)=>d.col.i;
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
  const XS_SCOPES=[['pipe','Pipeline','Pas encore signées'],['parc','Portefeuille','Contrats signés'],['all','Les deux','']];
  const xsInScope=o=>xsScope==='all'?true:xsScope==='parc'?(!isExited(o) && stageIndex(o.stage)>=stageIndex('onboarding')):(isExited(o) || stageIndex(o.stage)<stageIndex('onboarding'));
  // which file : « Suivi » and « Pipe » were hard to tell apart at a glance — real tabs instead of a text tag per cell
  let xsFileFilter='all';
  const xsFileOn=k=>xsFileFilter==='all'||xsFileFilter===k;
  // what « Envoyer » would send, and what « Copier » copies instead : the same list, so copying never misses a row sending would have caught
  const xsPendingList=kind=>xsList().filter(xsInScope).filter(o=>(kind==='pipe'||xsBddApplies(o)) && xsTodo(xsState(kind,o)) && !((xsState(kind,o).diffs||[]).some(xsActionable)));
  // a real tab (js/app.js's tab system shows/hides #tab-excel), not a modal any more : no close button, no
  // backdrop-click-to-close, content built once into the panel instead of appended to <body>
  async function openExcelSync(opts){
    xsScope=opts && opts.scope || 'pipe';
    const ov=$('tab-excel'); if(!ov) return;
    if(!ov.dataset.built){ ov.dataset.built='1';
      ov.innerHTML='<div class="xs-top"><div class="xs-top-row"><h1>Synchro Excel</h1><span class="xs-fresh"><span class="xs-info"></span><button type="button" class="xs-read">↻ Relire</button></span></div>'
        +'<div class="xs-bar"><div class="xs-filter" role="group" aria-label="Quelles lignes"><button type="button" data-f="todo" class="on">À faire <i class="xs-n"></i></button><button type="button" data-f="all">Tout <i class="xs-n"></i></button></div>'
        +'<span class="xs-sep"></span><div class="xl-filekind" role="group" aria-label="Fichiers Excel affichés"><button type="button" data-fk="pipe" aria-pressed="true">Pipe</button><button type="button" data-fk="bdd" aria-pressed="true">Suivi</button></div><span class="xs-hint">fichiers Excel affichés</span>'
        +'<span class="xs-scope-wrap"><button type="button" class="xs-scope-btn" aria-haspopup="true" aria-expanded="false">Installations : <b></b> ▾</button><div class="xs-scope" role="menu" hidden></div></span></div>'
        +'<p class="xs-read-err" hidden></p><p class="xs-note" hidden></p><div class="xs-cards"><div class="xs-card" data-k="pipe"><div class="xs-card-t"><b>Pipe Agrégation</b><span class="xs-card-n"></span></div><button type="button" class="xs-send" data-k="pipe" title="Envoyer ne remplace jamais une case modifiée par un collègue : elle te sera demandée."></button><button type="button" class="xs-copy" data-k="pipe" title="Copier les lignes à coller soi-même dans Excel, au lieu d’envoyer via le pont">Copier</button></div><div class="xs-card" data-k="bdd"><div class="xs-card-t"><b>Suivi Agrégation</b><span class="xs-card-n"></span></div><button type="button" class="xs-send" data-k="bdd" title="Envoyer ne remplace jamais une case modifiée par un collègue : elle te sera demandée."></button><button type="button" class="xs-copy" data-k="bdd" title="Copier les lignes à coller soi-même dans Excel, au lieu d’envoyer via le pont">Copier</button></div></div>'
        +'<div class="xs-conflicts" hidden><span class="xs-conf-txt"></span><span class="xs-bulk-group"><button type="button" class="xs-bulk" data-p="excel">Garder l’Excel partout</button><button type="button" class="xs-bulk" data-p="appli">Garder l’appli partout</button></span></div></div><div class="xs-body"></div>';
      ov.querySelectorAll('.xs-filter button').forEach(b=>b.onclick=()=>{ ov.querySelectorAll('.xs-filter button').forEach(x=>x.classList.toggle('on', x===b)); paintExcelSync(); });
      // the two files are switches : both on = everything ; the last one on can't be switched off
      ov.querySelectorAll('.xl-filekind button').forEach(b=>b.onclick=()=>{ const k=b.dataset.fk, other=k==='pipe'?'bdd':'pipe';
        xsFileFilter = xsFileFilter==='all' ? other : xsFileFilter===k ? k : 'all'; paintExcelSync(); });
      { const sb=ov.querySelector('.xs-scope-btn'), menu=ov.querySelector('.xs-scope');
        sb.onclick=e=>{ e.stopPropagation(); menu.hidden=!menu.hidden; sb.setAttribute('aria-expanded', String(!menu.hidden)); };
        document.addEventListener('click', e=>{ if(!menu.hidden && !menu.contains(e.target)){ menu.hidden=true; sb.setAttribute('aria-expanded','false'); } }); }
      ov.querySelector('.xs-read').onclick=async e=>{ const b=e.currentTarget, t=b.textContent; b.disabled=true; b.textContent='Lecture…';
        try{ await xsReadFile('pipe'); await xsReadFile('bdd'); importParcFromBridge(true); }catch(err){ showBridgeMsg(err.message, false); } b.disabled=false; b.textContent=t; paintExcelSync(); };
      ov.querySelectorAll('.xs-send').forEach(b=>b.onclick=async()=>{ const kind=b.dataset.k, list=xsPendingList(kind); if(!list.length) return;
        await sendToExcel(kind, list, b); if(bridgeConfigured()){ try{ await xsReadFile(kind); }catch(e){ softFail('relecture de l\u2019Excel', e); } } paintExcelSync(); });
      // same rows as \u00ab Envoyer \u00bb, but nothing sent through the bridge : one line per installation, ready to paste into Excel
      ov.querySelectorAll('.xs-copy').forEach(b=>b.onclick=()=>{ const kind=b.dataset.k, list=xsPendingList(kind); if(!list.length) return;
        copyToClipboard(list.map(o=>xlRowTsv(kind,o)).join('\n'), b); });
      // decide at once for every diverging cell currently shown (whatever scope/filter is selected, not just one lot)
      ov.querySelectorAll('.xs-bulk').forEach(b=>b.onclick=async()=>{ const targets=xsConflictTargets(xsShownNow); if(!targets.length) return;
        b.disabled=true; const t=b.textContent; b.textContent='Envoi…';
        await xsApplyBulk(targets, b.dataset.p); b.disabled=false; b.textContent=t; });
    }
    { const sc=ov.querySelector('.xs-scope'); if(!sc.children.length)
        XS_SCOPES.forEach(([k,l,sub])=>{ const b=document.createElement('button'); b.type='button'; b.setAttribute('role','menuitemradio'); b.dataset.s=k; b.innerHTML='<b>'+l+'</b>'+(sub?'<span>'+sub+'</span>':''); b.onclick=()=>{ xsScope=k; sc.hidden=true; paintExcelSync(); }; sc.appendChild(b); }); }
    paintExcelSync();
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
  const xsIsCommentCol=label=>/commentaire|remarque|observation|particularit/i.test(label||'');
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
  function paintExcelSync(){
    const ov=$('tab-excel'); if(!ov || ov.classList.contains('hidden')) return;
    const all=ov.querySelector('.xs-filter .on').dataset.f==='all', body=ov.querySelector('.xs-body'); body.innerHTML='';
    const readAt=r=>r?'relu le '+new Date(r.at).toLocaleDateString('fr-FR')+' à '+new Date(r.at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'pas encore relu';
    const br=bridgeConfigured();
    ov.querySelector('.xs-info').textContent=!br?'Pont Excel non connecté':(!xsRead.pipe && !xsRead.bdd)?'Excel pas encore relus':'Pipe '+readAt(xsRead.pipe)+' · Suivi '+readAt(xsRead.bdd);
    ov.querySelector('.xs-read').hidden=!br;
    const note=ov.querySelector('.xs-note'); note.hidden=br;
    note.textContent='Sans le pont, la colonne « appli » dit ce qui a été envoyé, et le Suivi est relu depuis le Portefeuille (fichier chargé). Le pont se règle dans Réglages.';
    // a failed read stays shown here (not just a toast that disappears) until the next read succeeds : impossible to
    // miss that the Pipe or Suivi couldn't be read (a renamed tab, a moved file…), unlike a transient message
    const errs=['pipe','bdd'].filter(k=>xsReadError[k]).map(k=>(k==='pipe'?'Pipe':'Suivi')+' : '+xsReadError[k]);
    const errEl=ov.querySelector('.xs-read-err'); errEl.hidden=!errs.length; errEl.textContent=errs.join(' · ');
    ov.querySelectorAll('.xs-scope button').forEach(b=>{ b.classList.toggle('on', b.dataset.s===xsScope); b.setAttribute('aria-checked', String(b.dataset.s===xsScope)); });
    ov.querySelector('.xs-scope-btn b').textContent=(XS_SCOPES.find(x=>x[0]===xsScope)||XS_SCOPES[0])[1];
    ov.querySelectorAll('.xl-filekind button').forEach(b=>{ const on=xsFileOn(b.dataset.fk); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const rows=xsList().filter(xsInScope).map(o=>{ const p=xsState('pipe',o), b=xsBddApplies(o)?xsState('bdd',o):null;
      return { o, p, b, pDiffs:xsFileOn('pipe')?p.diffs.filter(xsActionable):[], bDiffs:(b && xsFileOn('bdd'))?b.diffs.filter(xsActionable):[] }; });
    const relevant=r=>(xsFileOn('pipe') && xsTodo(r.p)) || (xsFileOn('bdd') && r.b && xsTodo(r.b));
    const todo=rows.filter(relevant);
    const cntP=xsFileOn('pipe')?rows.filter(r=>xsTodo(r.p) && !r.pDiffs.length).length:0, cntB=xsFileOn('bdd')?rows.filter(r=>r.b && xsTodo(r.b) && !r.bDiffs.length).length:0;
    ov.querySelectorAll('.xs-send').forEach(b=>{ const k=b.dataset.k, n=k==='pipe'?cntP:cntB; b.classList.toggle('hidden', !xsFileOn(k));
      if(xsSending[k]){ b.disabled=true; return; }   // a send in packets repaints between packets : never re-enable it mid-send (a second click would send the rest twice)
      b.innerHTML=XL_SEND_ICO+'Envoyer au '+(k==='pipe'?'Pipe':'Suivi'); b.disabled=!n || !bridgeConfigured(); b.classList.toggle('off', !bridgeConfigured()); b.title=bridgeConfigured()?'':'Pont Excel non connecté'; });
    // no bridge needed to copy (unlike « Envoyer ») : works even without the pont configured
    ov.querySelectorAll('.xs-copy').forEach(b=>{ const k=b.dataset.k, n=k==='pipe'?cntP:cntB; b.classList.toggle('hidden', !xsFileOn(k)); // with the bridge, copying is the fallback (a grey link next to « Envoyer ») ; without it, it is the way to go
      b.classList.toggle('quiet', br); b.textContent=br?'copier':'Copier pour le '+(k==='pipe'?'Pipe':'Suivi'); b.disabled=!n; });
    ov.querySelectorAll('.xs-card').forEach(c=>{ const k=c.dataset.k, n=k==='pipe'?cntP:cntB; c.hidden=!xsFileOn(k); c.classList.toggle('done', !n);
      c.querySelector('.xs-card-n').textContent=n?n+' ligne'+(n>1?'s':'')+' à envoyer':'rien à envoyer'; });
    ov.querySelectorAll('.xs-filter button').forEach(b=>{ b.querySelector('.xs-n').textContent=b.dataset.f==='all'?rows.length:todo.length; });
    const shown=all?rows:todo;
    xsShownNow=shown;
    const nConflictCells=xsConflictTargets(shown).reduce((s,tg)=>s+tg.diffs.length, 0);
    // the bulk decisions only show when there is something to decide
    ov.querySelector('.xs-conflicts').hidden=!nConflictCells;
    ov.querySelector('.xs-conf-txt').innerHTML='<b>'+nConflictCells+' case'+(nConflictCells>1?'s':'')+'</b> diff\u00e8re'+(nConflictCells>1?'nt':'')+' entre l\u2019Excel et l\u2019appli';
    ov.querySelectorAll('.xs-bulk').forEach(b=>{ b.disabled=!nConflictCells || !br; b.title=br?'Pour toutes les cases affichées':'Pont Excel non connecté'; });
    if(!shown.length){ body.innerHTML='<p class="xs-empty">✓ Tout est à jour'+(xsRead.pipe?'':' côté appli (relis les Excel pour vérifier le contenu des fichiers)')+'.</p>'; return; }
    // installations sent together for one pricing request (o.requestId) share one card ; a lone installation gets
    // the same card, for just itself — one single design, whatever the size
    const groupIds=new Set(), groups=[];
    shown.forEach(r=>{ const rid=r.o.requestId;
      if(rid){ if(groupIds.has(rid)) return; groupIds.add(rid);
        const members=shown.filter(x=>x.o.requestId===rid);
        groups.push({ rid:members.length>1?rid:null, members }); }
      else groups.push({ rid:null, members:[r] }); });
    // two groups instead of one flat list : a conflict needs a decision, a plain send doesn't — mixing them made it
    // hard to tell at a glance which installations actually needed attention
    const trancher=[], envoyer=[];
    groups.forEach(g=>(xsConflictTargets(g.members).reduce((s,tg)=>s+tg.diffs.length,0)?trancher:envoyer).push(g));
    const section=(title, list)=>{ if(!list.length) return;
      const h=document.createElement('div'); h.className='xl-section-h'; h.innerHTML='<h2></h2><span></span>';
      h.querySelector('h2').textContent=title; h.querySelector('span').textContent=list.length; body.appendChild(h);
      const lw=document.createElement('div'); lw.className='xl-lots';
      list.forEach(({rid,members})=>lw.appendChild(xlLotCard(rid, members))); body.appendChild(lw); };
    section('À trancher', trancher); section('À envoyer', envoyer);
  }
  // A card, folded by default : its name, how many cases need a decision, two quick buttons for the whole group.
  // Opened, a dense grid — columns are the fields that diverge anywhere in the group, rows are its installations ;
  // a column header decides that field for the whole group, a row name decides that whole installation, a cell just
  // itself. A lone installation (rid null) gets the very same card, for its one row — a pricing lot and a single
  // installation are the same idea at a different size, not two different things to learn.
  function xlLotCard(rid, members){
    const card=document.createElement('div'); card.className='xl-lot'; card.dataset.rid=rid||('solo-'+members[0].o.id);
    const head=document.createElement('div'); head.className='xl-head';
    head.innerHTML='<span class="xl-chev">▶</span><div class="xl-name"><b></b><span></span></div><div class="xl-meta"></div>';
    const req=rid && app.opportunities.find(x=>x.id===rid);
    if(req && !req.deleted && req.label){ head.querySelector('.xl-name b').textContent=req.label; head.querySelector('.xl-name span').textContent=members.length+' installation'+(members.length>1?'s':''); }
    else if(members.length>1){ head.querySelector('.xl-name b').textContent='Lot de '+members.length+' installations'; head.querySelector('.xl-name span').textContent=''; }
    else { const o=members[0].o; head.querySelector('.xl-name b').textContent=o.producteur||o.company||'(sans nom)'; head.querySelector('.xl-name span').textContent=codeAffaire(o); head.querySelector('.xl-name').appendChild(xlOpenBtn(o.id)); }
    const meta=head.querySelector('.xl-meta');
    const targets=xsConflictTargets(members), nCells=targets.reduce((s,tg)=>s+tg.diffs.length, 0);
    const destLabel=kinds=>kinds.map(k=>k==='pipe'?'Pipe':'Suivi').join(' + ');
    const pendingList=kind=>{ if(!xsFileOn(kind)) return []; return members.filter(m=>{ const st=kind==='pipe'?m.p:m.b, diffs=kind==='pipe'?m.pDiffs:m.bDiffs; return st && xsTodo(st) && !(diffs||[]).length; }).map(m=>m.o); };
    const needsSend=members.filter(m=>(xsFileOn('pipe') && xsTodo(m.p)&&!m.pDiffs.length) || (xsFileOn('bdd') && m.b&&xsTodo(m.b)&&!m.bDiffs.length)).length;
    const tag=document.createElement('span'); tag.className='xl-tag '+(nCells?'todo':needsSend?'warn':'ok');
    tag.textContent=nCells?nCells+' case'+(nCells>1?'s':''):needsSend?(needsSend>1?needsSend+' pas envoyées':'pas envoyé'):'à jour';
    meta.appendChild(tag);
    // which file(s) this card actually touches : « où ça part » n'était visible qu'une fois le détail ouvert
    const destKinds=nCells?[...new Set(targets.map(tg=>tg.kind))]:['pipe','bdd'].filter(k=>pendingList(k).length);
    destKinds.forEach(k=>{ const dest=document.createElement('span'); dest.className='xl-dest'; dest.dataset.k=k; dest.textContent=k==='pipe'?'Pipe':'Suivi'; meta.appendChild(dest); });   // one pill per file, in the file's colour
    card.appendChild(head);
    if(!nCells){
      if(needsSend && bridgeConfigured()){ const sb=document.createElement('button'); sb.type='button'; sb.className='pq-link'; sb.innerHTML=XL_SEND_ICO+'Envoyer ('+destLabel(destKinds)+')';
        sb.onclick=async e=>{ e.stopPropagation(); sb.disabled=true; const t=sb.textContent; sb.textContent='Envoi…';
          for(const kind of ['pipe','bdd']){ const list=pendingList(kind);
            if(list.length) await sendToExcel(kind, list, null); }
          sb.disabled=false; sb.textContent=t; };
        meta.appendChild(sb); }
      // no diffs to decide, but the chevron is shown either way : clicking it opened nothing (members.length can be in
      // the dozens, with no way to see which installations the lot actually covers). A plain list fixes both.
      head.onclick=()=>card.classList.toggle('open');
      const plain=document.createElement('div'); plain.className='xl-grid-wrap xl-plain';
      const ul=document.createElement('ul');
      members.forEach(m=>{ const li=document.createElement('li'); li.append((m.o.producteur||m.o.company||'(sans nom)')+' — '+codeAffaire(m.o), xlOpenBtn(m.o.id)); ul.appendChild(li); });
      plain.appendChild(ul); card.appendChild(plain);
      return card;
    }

    const quick=document.createElement('div'); quick.className='xl-quick';
    [['excel','Tout Excel'],['appli','Tout appli']].forEach(([policy,lbl])=>{ const qb=document.createElement('button'); qb.type='button'; qb.textContent=lbl;
      qb.onclick=e=>{ e.stopPropagation(); qb.disabled=true; xsApplyBulk(targets, policy); }; quick.appendChild(qb); });
    meta.appendChild(quick);
    head.onclick=()=>card.classList.toggle('open');

    const byCol=new Map();
    targets.forEach(tg=>tg.diffs.forEach(d=>{ const key=tg.kind+'|'+d.col.label; if(!byCol.has(key)) byCol.set(key, { kind:tg.kind, label:d.col.label, items:[] }); byCol.get(key).items.push({ o:tg.o, d }); }));
    const cols=[...byCol.values()];
    const cellChoice={};   // key kind|vi|installation id -> 'excel'|'appli'|'merge'
    cols.forEach(col=>col.items.forEach(it=>{ cellChoice[col.kind+'|'+xsViOf(col.kind, it.d)+'|'+it.o.id]='excel'; }));

    const wrap=document.createElement('div'); wrap.className='xl-grid-wrap';
    const table=document.createElement('table'); table.className='xl-grid';
    const thead=document.createElement('thead'); const htr=document.createElement('tr'); htr.appendChild(document.createElement('th'));
    const colBtns=[];
    cols.forEach(col=>{ const th=document.createElement('th'); const cb=document.createElement('button'); cb.type='button'; cb.className='xl-colhead '+col.kind; cb.dataset.side='excel'; cb.dataset.comment=xsIsCommentCol(col.label)?'1':'';
      // which file this column belongs to, always shown (not just a "(Suivi)" suffix on bdd) : a card mixing Pipe
      // and Suivi columns (like a lot with both a Pipe date and a Suivi statut in conflict) used to read as one
      // undifferentiated table — now each column says PIPE or SUIVI plainly, matching the card's own dest badge
      cb.innerHTML='<span class="xl-col-src"></span><b></b><small></small>'; cb.querySelector('.xl-col-src').textContent=col.kind==='pipe'?'Pipe':'Suivi'; cb.querySelector('b').textContent=col.label; cb.querySelector('small').textContent=col.items.length+' installation'+(col.items.length>1?'s':'')+(cb.dataset.comment?' · clic : fusionner':'');
      th.appendChild(cb); htr.appendChild(th); colBtns.push(cb); });
    thead.appendChild(htr); table.appendChild(thead);
    const tbody=document.createElement('tbody'); table.appendChild(tbody);
    const cellBtns=[];   // { key, bE, bA }
    members.forEach(m=>{
      const tr=document.createElement('tr'); tr.dataset.oid=m.o.id;
      const rh=document.createElement('th'); const rb=document.createElement('button'); rb.type='button'; rb.className='xl-rowhead'; rb.dataset.side='excel';
      rb.innerHTML='<b></b><small></small>'; rb.querySelector('b').textContent=m.o.producteur||m.o.company||'(sans nom)'; rb.querySelector('small').textContent=codeAffaire(m.o); rh.append(rb, xlOpenBtn(m.o.id)); tr.appendChild(rh);
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

    // a comment column cycles Excel → Appli → Fusionner (both texts, one after the other) → Excel ; any other field
    // just alternates Excel/Appli for the whole column
    colBtns.forEach((cb,i)=>{ const col=cols[i];
      cb.onclick=()=>{ const order=cb.dataset.comment?['excel','appli','merge']:['excel','appli'];
        const next=order[(order.indexOf(cb.dataset.side)+1)%order.length]; cb.dataset.side=next;
        col.items.forEach(it=>{ cellChoice[col.kind+'|'+xsViOf(col.kind, it.d)+'|'+it.o.id]=next; }); refresh(); }; });

    const foot=document.createElement('div'); foot.className='xl-foot';
    const summary=document.createElement('span'); foot.appendChild(summary);
    const apply=document.createElement('button'); apply.type='button'; foot.appendChild(apply);
    card.appendChild(foot);

    const refresh=()=>{
      cellBtns.forEach(({key,bE,bA})=>{ const side=cellChoice[key];
        bE.classList.toggle('sel', side==='excel'); bA.classList.toggle('sel', side==='appli');
        bE.classList.toggle('merged', side==='merge'); bA.classList.toggle('merged', side==='merge'); });
      const nApp=Object.values(cellChoice).filter(v=>v==='appli'||v==='merge').length;
      const writeKinds=[...new Set(cols.filter(col=>col.items.some(it=>{ const v=cellChoice[col.kind+'|'+xsViOf(col.kind, it.d)+'|'+it.o.id]; return v==='appli'||v==='merge'; })).map(c=>c.kind))];
      summary.textContent=nApp?nApp+' case'+(nApp>1?'s':'')+' à écrire dans '+destLabel(writeKinds):'rien à écrire dans Excel';
      apply.innerHTML=XL_SEND_ICO+'Appliquer ('+members.length+' installation'+(members.length>1?'s':'')+')';
    };
    refresh();
    apply.onclick=async()=>{ apply.disabled=true; apply.textContent='Envoi…'; await xsApplyLotGrid(targets, cellChoice); };
    return card;
  }
  const xsSending={ pipe:false, bdd:false };   // a send in progress, per file (several packets, repaints in between)
  let xsShownNow=[];   // what paintExcelSync last drew, for the « Tout garder … » buttons (read at click time)
  // extra : one { force, seen } shared by every installation in « list », or (for a mix of per-installation choices,
  // as in a lot) one array matching « list » one-for-one. Sent as a single request (packets of 8 Excel rows) : the
  // bridge opens the file once per packet, instead of once per installation — the file stays free for the rest of the
  // time, where a bridge that opened and closed it once per installation kept it busy for the whole bulk action.
  async function sendToExcel(kind, list, btn, extra){
    if(ON_PHONE) return true;
    const label=btn?btn.textContent:'';
    if(btn){ btn.disabled=true; btn.textContent='Envoi…'; }
    xsSending[kind]=true;
    try{
      const rows=list.map((o,i)=>xlRowFor(kind, o, Array.isArray(extra)?extra[i]:extra));
      const { res, results, pending }=await xlSend(kind, list, rows, (k,n)=>{ if(btn && n>XL_PACKET) btn.textContent='Envoi '+k+'/'+n+'…'; });
      xsSending[kind]=false;
      const msg=xlSummary(kind, results, res);
      try{ await xsReadFile(kind); }catch(e){ softFail('relecture de l’Excel', e); }
      // a cell the bridge could not write (changed by someone else) is not asked about here a second time : the fresh
      // read above makes it show up as an ordinary difference, decided in the same table as any other. Only a question
      // about which row is meant (duplicate lines, another contract, a plant lost recently) still needs asking.
      const questions=pending.filter(p=>p.r.question);
      if(btn){ btn.textContent=questions.length?'À trancher':'✓ Envoyé'; btn.title=msg; setTimeout(()=>{ btn.textContent=label; btn.disabled=false; },2500); }
      showBridgeMsg(msg, true);
      if(questions.length) openXlReview(kind, questions);
      const ov=$('tab-excel');
      if(ov && !ov.classList.contains('hidden')) paintExcelSync();
      else if(pending.length>questions.length){ closeOppDetail(); gsTab('excel'); await openExcelSync({ noRead:true }); }   // a plain conflict, tab not open : close the sheet so the new tab isn't hidden under it, show it there rather than nowhere
      return true;
    }catch(e){
      xsSending[kind]=false;
      if(btn){ btn.textContent=label; btn.disabled=false; }
      // a brand new line needs someone to have the file open (bridge limitation) : a clear thing to go do, shown
      // long enough to actually open the file and come back, instead of a message that fades before that
      const needsOpen=/pas encore prise en charge sans Excel ouvert/.test(e.message||'');
      showBridgeMsg(needsOpen?'Ouvre le fichier Excel, puis reviens cliquer « Envoyer » : '+e.message:e.message, false, needsOpen?20000:undefined);
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
        const ov=$('tab-excel'); if(ov && !ov.classList.contains('hidden')) paintExcelSync();
        const qAgain=again.filter(p=>p.r.question);
        if(qAgain.length) openXlReview(kind, qAgain);
      }catch(e){ showBridgeMsg(e.message, false); }
    };
    $('xl-review-overlay').classList.remove('hidden');
  }
  function closeXlReview(){ $('xl-review-overlay').classList.add('hidden'); }
  $('xl-review-later').onclick=closeXlReview;
  $('xl-review-overlay').addEventListener('click', e=>{ if(e.target.id==='xl-review-overlay') closeXlReview(); });
  function showBridgeMsg(msg, ok, ms){
    let el=$('bridge-msg');
    if(!el){ el=document.createElement('div'); el.id='bridge-msg'; el.setAttribute('role','status'); document.body.appendChild(el); }
    el.textContent=msg; el.className='bridge-msg show'+(ok?'':' err');
    clearTimeout(el._t); el._t=setTimeout(()=>{ el.className='bridge-msg'; }, ms!=null?ms:(ok?3500:7000));
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
