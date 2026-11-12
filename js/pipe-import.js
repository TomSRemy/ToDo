// Todo — the Pipe Excel read back into the app (team mode « Excel ») : colleagues work in the app AND in the Pipe.
// A line nobody here knows (Producteur + Centrale) becomes a sheet (the list shown once, the first time) ; a cell a
// colleague changed is taken when the sheet hasn't changed it since the last send ; changed on both sides : left to
// Synchro Excel, which asks. The step comes from the Pipe's « Stade », or the Suivi's « Statut » once transferred.
// Never touched by the Excel : the fine sub-steps, linked tasks, notes, calls. Loaded before js/app.js.
window.TodoPipeImport=(function(){
  const api={};
  const STADE={ aqualifier:'a_qualifier', priseencontact:'prise_contact', collectedinformations:'collecte', qualificationencours:'qualif_en_cours', nogo:'no_go' };
  const STATUT={ enpreparation:'pricing_indicatif', enattente:'offre_attente', gagne:'onboarding', perdu:'perdu', abandonne:'abandonne' };
  const FIRST='pipe-import-ok', EVERY=5*60000, ASK_MAX=12, MAYBE_MAX=8;
  // « Solaris SAS » and « SOLARIS » are the same producer : legal forms and punctuation left out
  const CO_FORMS=new Set(['sas','sasu','sa','sarl','eurl','sci','snc','scop','sem','spl','sca','selarl','ste','societe','groupe','group','ltd','gmbh','inc','llc','gaec','earl','scea']);
  const fold=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const words=s=>new Set(fold(s).split(/[^a-z0-9]+/).filter(w=>w.length>1 && !CO_FORMS.has(w)));
  const coKey=s=>[...words(s)].sort().join(' ');
  const num=v=>{ const n=parseFloat(String(v==null?'':v).replace(/\s/g,'').replace(',','.')); return isNaN(n)||!n ? null : n; };
  const near=(a, b, t)=>a!=null && b!=null && Math.abs(a-b)<=Math.max(a, b)*t;
  const deptOf=s=>{ const m=/^\s*(\d{2,3}|2[ab])\b/i.exec(String(s||'')); return m?m[1].toLowerCase():fold(s).trim(); };
  // two plant names : 1 = the same words, 0 = nothing in common
  function plantSim(a, b){ const A=words(a), B=words(b); if(!A.size || !B.size) return 0; let n=0; A.forEach(w=>{ if(B.has(w)) n++; }); return n/Math.min(A.size, B.size); }
  api.init=function(app){
    const { PQ_FIELDS, pipeCells, cellToText, stageIndex, notify, askChoice, renderPipeline, saveCrm, newId, mode, bridgeReady }=app;
    const X=()=>window.TodoExcelSync;
    let busy=false, lastRun=0;
    const opps=()=>app.opportunities;
    const col=k=>X().xsColIdx((PQ_FIELDS.find(f=>f.k===k)||{}).col);
    const cell=(vals, f)=>X().xsCellText(vals[X().xsColIdx(f.col)], f.type==='date'||['mesPrev','mesEff','debut','fin'].includes(f.k));
    // a Pipe cell's text as the sheet keeps it (dates jj/mm/aaaa → aaaa-mm-jj for date fields, ticks as booleans)
    function asField(f, t){
      if(f.type==='check') return /^(vrai|true|oui|1|x)$/i.test(t);
      if(f.type==='date'){ const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t); return m?m[3]+'-'+m[2]+'-'+m[1]:t; }
      return t;
    }
    // the step a line stands at : the Pipe's « Stade » before the Go, the Suivi's « Statut » after
    function stageOf(vals, bddHit){
      const st=X().xsNorm(X().xsCellText(vals[col('stade')]));
      if(STADE[st]) return STADE[st];
      if(/transfere/.test(st)){ const s=bddHit ? X().xsNorm(X().xsCellText(bddHit.vals[24])) : ''; return STATUT[s] || 'pricing_indicatif'; }
      return 'a_qualifier';
    }
    // the app's installations, by Producteur (or company) + Centrale ; a centrale name met only once also counts
    function known(){
      const keys=new Set(), plants=new Map();
      opps().forEach(o=>{ if(o.deleted || o.kind!=='installation') return;
        keys.add(X().xsKey('pipe', X().xsAppValues('pipe', o)));
        keys.add(X().xsNorm(o.producteur||o.company)+'|'+X().xsNorm(o.centrale||o.title));
        const c=X().xsNorm(o.centrale||o.title); plants.set(c, (plants.get(c)||0)+1); });
      return (k, vals)=>keys.has(k) || plants.get(X().xsNorm(vals[col('centrale')]))===1;
    }
    // a Pipe line nobody knows by its names : maybe a sheet of the app under other names. Sure (the same business code
    // in the Suivi, or the same producer + power + department) : linked ; likely : asked ; else a new sheet
    // each clue that the Pipe line and the sheet are the same plant, by name
    const CLUES=[
      ['même code affaire', (v, bh, o)=>{ const code=bh && fold(X().xsCellText(bh.vals[7])).replace(/\s/g,''), mine=fold(app.codeAffaire(o)).replace(/\s/g,''); return !!code && !/\[/.test(mine) && code===mine; }],
      ['même producteur', (v, bh, o)=>!!coKey(v[col('producteur')]) && coKey(v[col('producteur')])===coKey(o.producteur||o.company)],
      ['nom de centrale proche', (v, bh, o)=>plantSim(v[col('centrale')], o.centrale||o.title)>=0.5],
      ['même puissance', (v, bh, o)=>near(num(v[col('kwc')]), num(o.kwc), 0.02)],
      ['même P50', (v, bh, o)=>near(num(v[col('mwh')]), num(o.mwh), 0.03)],
      ['même département', (v, bh, o)=>{ const d=deptOf(X().xsCellText(v[col('dept')])); return !!d && d===deptOf(o.dept); }]
    ];
    function evidence(hit, bddHit, o){
      const why=CLUES.filter(([, test])=>test(hit.vals, bddHit, o)).map(([w])=>w), has=w=>why.includes(w);
      const sure=has('même code affaire') || (has('même producteur') && has('même puissance') && has('même département'));
      const likely=sure || (has('même producteur') && why.length>=2) || (has('nom de centrale proche') && (has('même puissance') || has('même P50')));
      return likely ? { o, sure, why } : null;
    }
    function bestMatch(hit, bddHit, free){
      let best=null;
      free.forEach(o=>{ const e=evidence(hit, bddHit, o); if(e && (!best || (e.sure && !best.sure) || (e.sure===best.sure && e.why.length>best.why.length))) best=e; });
      return best;
    }
    // linked : the sheet takes the Pipe's names (so both sides now find each other) ; its other cells are compared in Synchro Excel
    function link(o, hit){
      o.producteur=X().xsCellText(hit.vals[col('producteur')]) || o.producteur; o.centrale=X().xsCellText(hit.vals[col('centrale')]) || o.centrale;
      o.excelLinked={ at:Date.now(), line:hit.line }; o.updatedAt=Date.now();
    }
    const desc=(p, c, kwc, dept, who)=>[p||'?', c||'?', kwc?String(kwc).replace('.', ',')+' kWc':'', dept?'dépt '+deptOf(dept):'', who?'('+who+')':''].filter(Boolean).join(' \u00b7 ');
    async function askSame(m, hit){
      const v=hit.vals, t=X().xsCellText;
      const r=await askChoice('Même installation ?', 'Ligne du Pipe : '+desc(t(v[col('producteur')]), t(v[col('centrale')]), t(v[col('kwc')]), t(v[col('dept')]), t(v[col('charge')]))
        +'\nFiche de l\u2019appli : '+desc(m.o.producteur||m.o.company, m.o.centrale||m.o.title, m.o.kwc, m.o.dept, m.o.charge)+'\n\nPoints communs : '+m.why.join(', ')+'.',
        [{ label:'Oui, les relier', value:'same' }, { label:'Non, nouvelle fiche', value:'new', ghost:true }, { label:'Plus tard', value:'later', ghost:true }], { cancel:false });
      return r||'later';
    }
    function sheetFrom(k, hit, bdd){
      const o={ id:newId(), kind:'installation', taskId:null, createdAt:Date.now(), updatedAt:Date.now(), deleted:false, lostAt:null };
      PQ_FIELDS.forEach(f=>{ if(f.k==='stade') return; const t=cell(hit.vals, f); if(t!=='') o[f.k]=asField(f, t); });
      o.company=o.producteur||''; o.title=o.centrale||'';
      const bddHit=bdd && bdd.rows.get(k);
      o.stage=stageOf(hit.vals, bddHit); if(o.stage==='no_go'||o.stage==='perdu'||o.stage==='abandonne'){ o.stageBeforeExit='a_qualifier'; o.lostAt=Date.now(); }
      o.fromExcel={ at:Date.now(), line:hit.line };
      // what the Pipe holds is what was « sent » : no difference shown, nothing to send back
      const vals=pipeCells(o); o.excelPrev={ pipe:X().xsAppValues('pipe', o) }; o.excelSent={ pipe:{ at:Date.now(), h:X().xsHash(vals) } };
      return o;
    }
    // the cells a colleague changed while the sheet kept what it last sent : taken ; the Stade moves the step
    function takeChanges(o, hit, bdd){
      const prev=(o.excelPrev && o.excelPrev.pipe)||[]; let n=0;
      PQ_FIELDS.forEach(f=>{ const i=X().xsColIdx(f.col), ex=cell(hit.vals, f), mine=cellToText(X().xsAppValues('pipe', o)[i]), was=cellToText(prev[i]);
        if(X().xsNorm(ex)===X().xsNorm(mine) || X().xsNorm(ex)===X().xsNorm(was) || X().xsNorm(mine)!==X().xsNorm(was)) return;   // same, unchanged in the Excel, or changed here too
        if(f.k==='stade'){ const s=stageOf(hit.vals, bdd && bdd.rows.get(X().xsKey('pipe', hit.vals))); if(s!==o.stage && stageIndex(s)>=0 && stageIndex(o.stage)<stageIndex('pricing_indicatif')){ o.stage=s; n++; } }
        else if(ex!==''){ o[f.k]=asField(f, ex); n++; }
        o.excelPrev.pipe[i]=hit.vals[i]; });
      if(n) o.updatedAt=Date.now();
      return n;
    }
    async function confirmFirst(fresh, manual){
      try{ if(localStorage.getItem(FIRST)) return true; }catch(e){ return false; }
      if(!manual) return false;   // the very first import is never done unasked
      const list=fresh.slice(0, ASK_MAX).map(x=>'• '+(x.o.producteur||'?')+' · '+(x.o.centrale||'?')+' — '+x.stade+(x.o.charge?' ('+x.o.charge+')':'')).join('\n');
      const v=await askChoice('Lignes du Pipe à importer', fresh.length+' ligne'+(fresh.length>1?'s':'')+' du Pipe n’'+(fresh.length>1?'ont':'a')+' pas de fiche dans l’appli :\n\n'+list+(fresh.length>ASK_MAX?'\n… et '+(fresh.length-ASK_MAX)+' autres':'')+'\n\nElles deviennent des fiches du pipeline, marquées « arrivée du Pipe ». Ensuite, les nouvelles lignes arriveront toutes seules.',
        [{ label:'Importer les '+fresh.length, value:'y' }, { label:'Plus tard', value:'n', ghost:true }], { cancel:false });
      if(v!=='y') return false;
      try{ localStorage.setItem(FIRST, '1'); }catch(e){ /* asked again next time */ }
      return true;
    }
    // the Pipe (and the Suivi, for the step after the Go) read through the bridge, then compared with the app
    async function readBoth(){ await X().xsReadFile('pipe'); try{ await X().xsReadFile('bdd'); }catch(e){ /* the Suivi only gives the step after the Go */ } return X().xsReadNow(); }
    function scan(pipe, bdd){
      const isKnown=known(), fresh=[], links=[], maybes=[]; let changed=0;
      // the sheets no Pipe line finds by their names : the only ones a renamed line can be
      const free=opps().filter(o=>!o.deleted && o.kind==='installation' && !pipe.rows.has(X().xsKey('pipe', X().xsAppValues('pipe', o))));
      pipe.rows.forEach((hit, k)=>{ if(isKnown(k, hit.vals)) return;
        const m=bestMatch(hit, bdd && bdd.rows.get(k), free.filter(o=>!links.some(l=>l.m.o===o) && !maybes.some(l=>l.m.o===o)));
        if(m && m.sure) links.push({ m, hit }); else if(m) maybes.push({ m, hit, k });
        else fresh.push({ o:sheetFrom(k, hit, bdd), stade:X().xsCellText(hit.vals[col('stade')])||'A qualifier' }); });
      opps().forEach(o=>{ if(o.deleted || o.kind!=='installation' || !(o.excelPrev && o.excelPrev.pipe)) return;
        const hit=pipe.rows.get(X().xsKey('pipe', X().xsAppValues('pipe', o))); if(hit) changed+=takeChanges(o, hit, bdd); });
      return { fresh, changed, links, maybes };
    }
    // likely the same : asked, by « ↻ Relire » only (never unasked) ; « Non » makes it a new sheet, « Plus tard » waits
    async function settleMaybes(maybes, manual, fresh, bdd){
      let linked=0; if(!manual) return linked;
      for(const x of maybes.slice(0, MAYBE_MAX)){
        const r=await askSame(x.m, x.hit);
        if(r==='same'){ link(x.m.o, x.hit); linked++; }
        else if(r==='new') fresh.push({ o:sheetFrom(x.k, x.hit, bdd), stade:X().xsCellText(x.hit.vals[col('stade')])||'A qualifier' });
      }
      return linked;
    }
    const plural=(n, w)=>n+' '+w+(n>1?'s':'');
    function report(added, changed, linked){
      const a=added ? plural(added, 'fiche')+' arrivée'+(added>1?'s':'')+', ' : '', l=linked ? plural(linked, 'fiche')+' reliée'+(linked>1?'s':'')+' à sa ligne, ' : '';
      const c=changed ? plural(changed, 'case')+' reprise'+(changed>1?'s':'')+' des collègues' : 'rien d\u2019autre';
      notify('Pipe Excel : '+a+l+c+'.');
    }
    const howMany=async (fresh, manual)=>(fresh.length && await confirmFirst(fresh, manual)) ? fresh.length : 0;
    async function run(manual){
      if(busy || mode()!=='excel' || !bridgeReady()) return null; busy=true; lastRun=Date.now();
      try{
        const rd=await readBoth(), { fresh, changed, links, maybes }=scan(rd.pipe, rd.bdd);
        links.forEach(x=>link(x.m.o, x.hit));
        const linked=links.length+await settleMaybes(maybes, manual, fresh, rd.bdd), added=await howMany(fresh, manual);
        fresh.slice(0, added).forEach(x=>opps().push(x.o));
        if(added || changed || linked){ await saveCrm(); renderPipeline(); }
        if(added || changed || linked || manual) report(added, changed, linked);
        return { added, changed, linked, waiting:fresh.length-added };
      }catch(e){ if(manual) notify('Pipe Excel illisible : '+(e&&e.message||e)); return null; }
      finally{ busy=false; }
    }
    setInterval(()=>{ if(document.visibilityState==='visible' && Date.now()-lastRun>EVERY) run(false); }, 60000);
    Object.assign(api, { run, stageOf });
  };
  return api;
})();
