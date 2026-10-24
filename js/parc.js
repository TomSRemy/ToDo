// Todo — the Portefeuille (loaded before js/app.js): renewal tasks for won contracts ending soon, the tab itself (key figures,
// table) and the France map, also drawn inside the pipeline. Split out of js/app.js (code audit).
window.TodoParc=(function(){
  const api={};
  // what this part uses from js/app.js, given where its code used to stand in js/app.js (so it runs in the same order);
  // app.<name>: a value js/app.js defines further down or may replace, read when used
  api.init=function(app){
    const { $, MAP_PHASES, MAP_TECHS, PARC_CADRES, PARC_COLORS, allCompanyNames, askConfirm, celebrate, closeRenewalTask, coDupKey, copyToClipboard, createTask, ensureCompany, escapeHtml, fmtKwc, inProcess, isExited, loadParc, loadScript, loseOpps, lsSet, newOppId, openCompanySheet, openOppDetail, oppName, oppPhase, parcBars, parcNorm, parcTable, parcYearsShown, pqFold, pqIsoToFr, pqNum, prefsToNote, relanceOnMove, render, renderPipeline, saveCrm, saveTasks, stageLabel, toISO, touchCrm }=app;
    Object.assign(api, { parcKey, ensureRenewalTasks, renderParc, attachTip, openParcPlant, openMapPoint, parcMap });   // function declarations: ready before the code below runs
  // ---------- Renewals: a task per won contract ending within N months (once, on every device) ----------
  const RENEW_KEY='renew-months';
  const renewMonths=()=>{ try{ return parseInt(localStorage.getItem('todo_'+RENEW_KEY),10)||6; }catch(e){ return 6; } };
  function parcKey(p){ const s=[p.prod,p.inst,p.fin].map(parcNorm).join('|'); let h=5381; for(let i=0;i<s.length;i++) h=((h*33)^s.charCodeAt(i))>>>0; return h.toString(36); }
  function renewalCandidates(){
    if(!app.parcData) return [];
    const today=toISO(new Date()), lim=new Date(); lim.setMonth(lim.getMonth()+renewMonths());
    const limIso=toISO(lim);
    return app.parcData.items.filter(p=>p.statut==='Gagné' && p.fin && p.fin>=today && p.fin<=limIso);
  }
  // One task per developer and end date (8 contracts of one developer ending on 31/12 = one task). Deterministic id:
  // the same group gives the same task on the phone and the computer, and a deleted or completed renewal
  // task is never created again.
  const renewGroupId=p=>{ const s=parcNorm(p.dev||p.prod)+'|'+p.fin; let h=5381; for(let i=0;i<s.length;i++) h=((h*33)^s.charCodeAt(i))>>>0; return 'renew_'+h.toString(36); };
  function ensureRenewalTasks(){
    const groups=new Map();
    renewalCandidates().forEach(p=>{ const id=renewGroupId(p); if(!groups.has(id)) groups.set(id,[]); groups.get(id).push(p); });
    let n=0;
    groups.forEach((list,id)=>{
      if(app.tasks.some(t=>t.id===id)) return;
      const p=list[0], who=p.dev||p.prod;
      const fin=new Date(p.fin+'T00:00:00'), due=new Date(fin); due.setDate(due.getDate()-120);
      const today=new Date(); today.setHours(0,0,0,0);
      const kwc=list.reduce((s,x)=>s+(x.kwc||0),0);
      const t=createTask({ title:list.length>1?'Renouveler '+list.length+' contrats — '+who:'Renouveler le contrat — '+(p.inst||p.prod), client:who,
        due:toISO(due<today?today:due), urgency:'haute', status:'a_faire',
        description:'Fin de contrat le '+pqIsoToFr(p.fin)+' · '+(kwc?fmtMwc(kwc):'')+'\n'+list.map(x=>'- '+(x.inst||x.prod)+(x.kwc?' ('+fmtKwc(x.kwc)+(x.cadre?', '+x.cadre:'')+')':'')).join('\n')+'\nIssu du portefeuille (Suivi Agrégation).' });
      t.id=id; n++;
    });
    if(n){ saveTasks(); render(); }
    return n;
  }
  // Puts a contract back into the pipeline (stage: pricing request), prefilled from the Parc
  function renewalToPipeline(p){
    const company=ensureCompany(p.dev||p.prod);
    const o={ id:newOppId('opp'), kind:'installation', company, title:p.inst||p.prod, centrale:p.inst||p.prod, producteur:p.prod, stage:'pricing_indicatif', requestId:null, taskId:null,
      kwc:p.kwc?String(p.kwc):'', mwh:p.p50?String(Math.round(p.p50)):'', dept:p.dept, region:p.region, install:p.enr==='PV'||p.enr==='Eolien'||p.enr==='Hydro'?p.enr:'',
      contrat:p.cadre==='CR'?(p.ao==='AOS CRE'?'AOS CRE':'AO CRE CR'):p.cadre==='OA'?"Sortie d'OA / CR":p.cadre==='ACC'?'Surplus ACC':'',
      charge:p.charge, origine:'Contact direct', ca:p.ca||'N/A', dateEntree:toISO(new Date()), annee:String(new Date().getFullYear()), goDate:toISO(new Date()),
      commentaires:pqIsoToFr(toISO(new Date()))+' : renouvellement du contrat qui se termine le '+pqIsoToFr(p.fin)+'.', renewalOf:parcKey(p),
      createdAt:Date.now(), updatedAt:Date.now(), deleted:false };
    app.opportunities.push(o); saveCrm();
    return o;
  }
  const fmtGwh=mwh=>(Math.round(mwh/100)/10).toLocaleString('fr-FR')+' GWh';
  const fmtMwc=kwc=>(Math.round(kwc/100)/10).toLocaleString('fr-FR')+' MWc';
  // the year's goal (Suivi, GWh): crossing 75, 90 then 100 % plays its animation once, with a summary ready for the manager
  function checkGoalMilestones(won){
    if(!app.parcData || !app.parcData.objectives) return;
    const cy=new Date().getFullYear(), obj=app.parcData.objectives[cy]; if(!obj) return;
    const active=won.filter(p=>(p.vols[cy]||0)>0), vol=active.reduce((x,p)=>x+(p.vols[cy]||0),0)/1000, pct=vol/obj*100, reached=[100,90,75].find(l=>pct>=l)||0;
    let m={}; try{ m=JSON.parse(localStorage.getItem('goal-milestones')||'{}')||{}; }catch(e){}
    const key=String(cy), save=()=>{ lsSet('goal-milestones', JSON.stringify(m)); prefsToNote(); };
    if(m[key]==null){ m[key]=reached; save(); return; }   // the first look: no fanfare for old news
    if(reached<=m[key]) return;
    m[key]=reached; save();
    const f1=n=>(Math.round(n*10)/10).toLocaleString('fr-FR');
    if(window.todoCelebrate) window.todoCelebrate('goal', { sub:Math.round(pct)+' % · '+f1(vol)+' GWh sur '+f1(obj)+' GWh' }, 'g'+reached);
    const text='Objectif agrégation '+cy+' : '+Math.round(pct)+' % atteint — '+f1(vol)+' GWh sur '+f1(obj)+' GWh, '+active.length+' contrat'+(active.length>1?'s':'')+' actif'+(active.length>1?'s':'')+'.'
      +(pct<100?' Il reste '+f1(obj-vol)+' GWh pour atteindre l’objectif.':' Objectif atteint, '+f1(vol-obj)+' GWh au-delà.');
    let t=$('goal-toast'); if(t) t.remove();
    t=document.createElement('div'); t.id='goal-toast'; t.className='goal-toast'; t.setAttribute('role','status');
    t.innerHTML='<b></b><p></p><div><button type="button" class="goal-copy">Copier pour mon manager</button><button type="button" class="ghost-btn goal-close">Fermer</button></div>';
    t.querySelector('b').textContent=reached===100?'Objectif '+cy+' atteint !':reached+' % de l’objectif '+cy; t.querySelector('p').textContent=text;
    t.querySelector('.goal-copy').onclick=e=>copyToClipboard(text, e.target); t.querySelector('.goal-close').onclick=()=>t.remove();
    setTimeout(()=>{ if(!t.isConnected) document.body.appendChild(t); }, reached===100?4200:3200);
  }
  function renderParc(){ app.mapInPipe=false;
    const body=$('parc-body'); if(!body) return;
    if(app.parcData===null) loadParc();
    body.innerHTML='';
    if(!app.parcData || !app.parcData.items.length){
      $('parc-info').textContent=app.syncConfig.enabled?'Le Portefeuille chargé sur un autre appareil arrive ici à la synchro.':'';
      body.innerHTML='<div class="parc-empty"><b>Aucun portefeuille chargé.</b><br>Charge le fichier « Suivi Agrégation » (.xlsx) : l\u2019app lit l\u2019onglet « BDD Agrégation » et les objectifs du « Dashboard ». Le fichier reste sur cet appareil.</div>';
      return;
    }
    if(app.parcData.items.length && !app.parcData.items.some(i=>'siteDept' in i)){ const n=document.createElement('div'); n.className='parc-reload'; n.textContent='Recharge le fichier « Suivi Agrégation » une fois : la carte placera alors chaque centrale à son vrai département (colonne Département2), et non au siège du développeur.'; body.appendChild(n); }
    $('parc-info').textContent=(app.parcData.fileName||'Fichier')+' · chargé le '+new Date(app.parcData.importedAt).toLocaleDateString('fr-FR')+' · '+app.parcData.items.length+' ligne'+(app.parcData.items.length>1?'s':'')
      +(app.parcSyncNote?' · '+app.parcSyncNote:(app.syncConfig.enabled?' · synchronisé avec tes autres appareils':''));
    const won=app.parcData.items.filter(p=>p.statut==='Gagné');
    const shown=parcYearsShown();
    if(app.parcYear!=='all' && !shown.includes(app.parcYear)) app.parcYear=shown[0];
    // "all" = the 5 years together: volumes and objectives summed, a contract counts if active in any of them
    const y=app.parcYear, today=toISO(new Date()), yrs=y==='all'?shown:[y];
    const yLabel=y==='all'?shown[0]+'–'+shown[shown.length-1]:String(y);
    const volOf=p=>yrs.reduce((s,yy)=>s+(p.vols[yy]||0),0);
    const active=won.filter(p=>volOf(p)>0);
    const volY=active.reduce((s,p)=>s+volOf(p),0);
    const objs=yrs.map(yy=>app.parcData.objectives[yy]).filter(v=>v!=null);
    const obj=objs.length===yrs.length?objs.reduce((s,v)=>s+v,0):null;
    const soon=renewalCandidates();
    const pending=app.parcData.items.filter(p=>p.statut==='En attente');
    checkGoalMilestones(won);

    // year chips
    const years=document.createElement('div'); years.className='parc-years';
    shown.forEach(yy=>{ const b=document.createElement('button'); b.type='button'; b.textContent=yy; b.className=yy===y?'on':''; b.onclick=()=>{ app.parcYear=yy; renderParc(); }; years.appendChild(b); });
    const gb=document.createElement('button'); gb.type='button'; gb.textContent='Global '+shown[0]+'–'+shown[shown.length-1]; gb.className='parc-global'+(y==='all'?' on':''); gb.onclick=()=>{ app.parcYear='all'; renderParc(); }; years.appendChild(gb);
    const rm=document.createElement('label'); rm.className='parc-renew-setting'; rm.innerHTML='Renouvellement : alerte à <select id="parc-renew-months">'+[3,4,6,9,12].map(m=>'<option value="'+m+'"'+(m===renewMonths()?' selected':'')+'>'+m+' mois</option>').join('')+'</select>';
    rm.querySelector('select').onchange=e=>{ try{ localStorage.setItem('todo_'+RENEW_KEY, e.target.value); }catch(err){} ensureRenewalTasks(); renderParc(); };
    years.appendChild(rm);
    body.appendChild(years);

    const kpis=document.createElement('div'); kpis.className='parc-kpis';
    const kpi=(num,label,sub,cls)=>{ const k=document.createElement('div'); k.className='stat-card'; k.innerHTML='<div class="stat-card-num'+(cls?' '+cls:'')+'">'+escapeHtml(num)+'</div><div class="stat-card-label">'+escapeHtml(label)+'</div>'+(sub?'<div class="parc-kpi-sub">'+escapeHtml(sub)+'</div>':''); kpis.appendChild(k); };
    kpi(fmtGwh(volY), 'Volume agrégé '+yLabel, obj?Math.round(volY/1000/obj*100)+' % de l\u2019objectif ('+obj.toLocaleString('fr-FR')+' GWh)':'', 'accent');
    kpi(String(active.length), 'Contrats actifs '+yLabel, fmtMwc(active.reduce((s,p)=>s+p.kwc,0)));
    kpi(String(soon.length), 'Fins de contrat < '+renewMonths()+' mois', won.filter(p=>p.renouv==='A renouveler').length+' marqués « A renouveler »', soon.length?'crit':'');
    kpi(String(pending.length), 'Offres en attente', fmtMwc(pending.reduce((s,p)=>s+p.kwc,0)));
    body.appendChild(kpis);
    const KPI_KEYS=['vol','active','soon','pending'];
    const KPI_SETS={ vol:active, active:active, soon, pending };
    const KPI_LABELS={ vol:'Contrats du volume '+yLabel, active:'Contrats actifs '+yLabel, soon:'Fins de contrat < '+renewMonths()+' mois', pending:'Offres en attente' };
    app.parcKpiSet=app.parcKpi?KPI_SETS[app.parcKpi]:null; app.parcKpiLabel=app.parcKpi?KPI_LABELS[app.parcKpi]:'';
    kpis.querySelectorAll('.stat-card').forEach((c,i)=>{
      c.dataset.kpi=String(i); c.classList.add('clickable'); c.classList.toggle('on', app.parcKpi===KPI_KEYS[i]);
      c.onclick=()=>{ app.parcKpi=app.parcKpi===KPI_KEYS[i]?null:KPI_KEYS[i]; app.parcMapSel=null; app.parcMapView=null; renderParc();
        if(app.parcKpi){ const m=document.querySelector('#tab-parc .parc-map-block'); if(m) m.scrollIntoView({ behavior:'smooth', block:'start' }); } };
    });
    if(app.parcKpi){
      const f=document.createElement('div'); f.className='parc-kpi-filter';
      f.innerHTML='<span>Filtre : <b>'+escapeHtml(app.parcKpiLabel)+'</b> · '+app.parcKpiSet.length+' installation'+(app.parcKpiSet.length>1?'s':'')+' · '+escapeHtml(fmtMwc(app.parcKpiSet.reduce((s,p)=>s+p.kwc,0)))+' — carte et table filtrées</span>';
      const x=document.createElement('button'); x.type='button'; x.textContent='Retirer le filtre'; x.onclick=()=>{ app.parcKpi=null; renderParc(); }; f.appendChild(x);
      body.appendChild(f);
    }
    attachTip(kpis, t=>{
      const c=t.closest && t.closest('.stat-card'); if(!c) return null;
      const i=+c.dataset.kpi;
      if(i===0){ const by={}; active.forEach(p=>{ by[p.cadre||'Autre']=(by[p.cadre||'Autre']||0)+volOf(p); }); return '<b>Volume '+yLabel+'</b>'+PARC_CADRES.filter(k=>by[k]).map(k=>tipRow(PARC_COLORS[k],k,fmtGwh(by[k]))).join('')+(obj?tipRow('','Objectif',obj.toLocaleString('fr-FR')+' GWh'):''); }
      if(i===1){ const by={}; active.forEach(p=>{ const k=mapTech(p.enr); (by[k]=by[k]||{ n:0, kwc:0 }); by[k].n++; by[k].kwc+=p.kwc; }); return '<b>Contrats actifs '+yLabel+'</b>'+MAP_TECHS.filter(([k])=>by[k]).map(([k,l,col])=>tipRow(col,l,by[k].n+' · '+fmtMwc(by[k].kwc))).join(''); }
      if(i===2){ return '<b>Fins de contrat</b>'+(soon.length?soon.slice().sort((a,b)=>a.fin.localeCompare(b.fin)).slice(0,6).map(p=>tipRow('',p.inst||p.prod,pqIsoToFr(p.fin))).join('')+(soon.length>6?'<span class="muted">+ '+(soon.length-6)+' autres</span>':''):'<span class="muted">Aucune</span>'); }
      if(i===3){ return '<b>Offres en attente</b>'+(pending.length?pending.slice().sort((a,b)=>b.kwc-a.kwc).slice(0,6).map(p=>tipRow('',p.inst||p.prod,p.kwc?fmtKwc(p.kwc):'')).join('')+(pending.length>6?'<span class="muted">+ '+(pending.length-6)+' autres</span>':''):'<span class="muted">Aucune</span>'); }
      return null;
    });

    body.appendChild(parcChart(won));
    body.appendChild(parcMap());

    const two=document.createElement('div'); two.className='parc-two';
    const byDev={}; active.forEach(p=>{ byDev[p.dev]=(byDev[p.dev]||0)+volOf(p); });
    two.appendChild(parcBars('Par développeur · '+yLabel, Object.entries(byDev).sort((a,b)=>b[1]-a[1]).slice(0,12), v=>fmtGwh(v)+' · '+Math.round(v/volY*100)+' %',
      (k,v)=>{ const list=active.filter(p=>p.dev===k); return '<b>'+escapeHtml(k)+'</b>'+tipRow('', 'Volume '+yLabel, fmtGwh(v)+' · '+Math.round(v/volY*100)+' %')+tipRow('', 'Contrats actifs', String(list.length))+tipRow('', 'Puissance', fmtMwc(list.reduce((s,p)=>s+p.kwc,0)))+'<span class="muted">'+escapeHtml(list.slice(0,4).map(p=>p.inst||p.prod).join(', ')+(list.length>4?'…':''))+'</span>'; }));
    const byReg={}; won.filter(p=>!p.fin || p.fin>=today).forEach(p=>{ const k=p.siteRegion||p.region||'Non renseignée'; byReg[k]=(byReg[k]||0)+p.kwc; });
    const regTotal=Object.values(byReg).reduce((s,v)=>s+v,0)||1;
    two.appendChild(parcBars('Par région des centrales · puissance en portefeuille', Object.entries(byReg).sort((a,b)=>b[1]-a[1]), v=>fmtMwc(v),
      (k,v)=>{ const list=won.filter(p=>(!p.fin || p.fin>=today) && (p.siteRegion||p.region||'Non renseignée')===k); return '<b>'+escapeHtml(k)+'</b>'+tipRow('', 'Puissance', fmtMwc(v)+' · '+Math.round(v/regTotal*100)+' %')+tipRow('', 'Installations', String(list.length))+'<span class="muted">'+escapeHtml([...new Set(list.map(p=>(p.siteDept||'').replace(/^\S+\s+-\s+/,'')).filter(Boolean))].slice(0,5).join(', '))+'</span>'; }));
    body.appendChild(two);

    if(soon.length){
      const s=document.createElement('div'); s.className='parc-block';
      s.innerHTML='<div class="parc-h">Échéances dans les '+renewMonths()+' mois · une tâche de renouvellement est créée pour chacune</div>';
      soon.sort((a,b)=>a.fin.localeCompare(b.fin)).forEach(p=>{
        const r=document.createElement('div'); r.className='parc-due';
        const key=parcKey(p), task=app.tasks.find(t=>t.id===renewGroupId(p)), opp=app.opportunities.find(o=>!o.deleted && o.renewalOf===key);
        r.innerHTML='<span class="parc-due-date">'+escapeHtml(pqIsoToFr(p.fin))+'</span><span class="parc-due-name">'+escapeHtml(p.prod)+(p.inst?' · '+escapeHtml(p.inst):'')+'</span><span class="parc-due-meta">'+escapeHtml([p.cadre, p.kwc?fmtKwc(p.kwc):'', p.renouv, task?(task.archived?'tâche faite':task.deleted?'tâche supprimée':'tâche de renouvellement créée'):''].filter(Boolean).join(' · '))+'</span>';
        const act=document.createElement('span'); act.className='parc-due-act';
        if(opp){ const b=document.createElement('button'); b.type='button'; b.className='pq-link'; b.textContent='Voir dans le pipeline'; b.onclick=()=>{ document.querySelector('.tab[data-tab="pipeline"]').click(); setTimeout(()=>openOppDetail(opp.id),50); }; act.appendChild(b); }
        else { const b=document.createElement('button'); b.type='button'; b.className='pq-link'; b.textContent='Remettre dans le pipeline'; b.onclick=()=>{ const o=renewalToPipeline(p); document.querySelector('.tab[data-tab="pipeline"]').click(); setTimeout(()=>openOppDetail(o.id),50); }; act.appendChild(b); }
        // a renewal that will not happen: recorded as lost (pipeline « Sorties », stats), its renewal task closed
        if(opp && isExited(opp)){ act.innerHTML=''; const t=document.createElement('span'); t.className='parc-due-lost'; t.textContent='Non renouvelé'+(opp.lostAt?' le '+new Date(opp.lostAt).toLocaleDateString('fr-FR'):''); act.appendChild(t); r.classList.add('lost'); }
        else if(!window.TODO_LITE){ const nb=document.createElement('button'); nb.type='button'; nb.className='pq-link parc-due-nogo'; nb.textContent='Non renouvelé';
          nb.onclick=async ()=>{ if(opp){ await loseOpps([opp]); renderParc(); return; }
            if(!await askConfirm('« '+(p.inst||p.prod)+' » (fin le '+pqIsoToFr(p.fin)+') : non renouvelé ?', 'Non renouvelé')) return;
            const o=renewalToPipeline(p); relanceOnMove(o, null); o.stageBeforeExit=o.stage; o.stage='perdu'; o.lostAt=Date.now(); touchCrm(o); closeRenewalTask(o); saveCrm(); renderPipeline(); renderParc(); celebrate('lost', [o]); };
          act.appendChild(nb); }
        r.appendChild(act);
        s.appendChild(r);
      });
      body.appendChild(s);
    }
    body.appendChild(parcTable());
  }
  // Hover tooltip for the Portefeuille charts: resolve(target) returns the HTML to show (or null)
  function attachTip(host, resolve){
    host.classList.add('tip-host');
    const tip=document.createElement('div'); tip.className='parc-map-tip chart-tip'; tip.hidden=true; host.appendChild(tip);
    host.addEventListener('mousemove', e=>{
      const html=resolve(e.target); if(!html){ tip.hidden=true; return; }
      tip.innerHTML=html; tip.hidden=false;
      const box=host.getBoundingClientRect(), x=e.clientX-box.left, y=e.clientY-box.top;
      tip.style.left=Math.max(0,Math.min(x+14, box.width-tip.offsetWidth))+'px';
      tip.style.top=(y-tip.offsetHeight-12<0?y+16:y-tip.offsetHeight-12)+'px';
    });
    host.addEventListener('mouseleave', ()=>{ tip.hidden=true; });
  }
  const tipRow=(color,label,value)=>'<span class="tip-row">'+(color?'<i style="background:'+color+'"></i>':'')+'<span>'+escapeHtml(label)+'</span><em>'+escapeHtml(value)+'</em></span>';
  function parcChart(won){
    const wrap=document.createElement('div'); wrap.className='parc-block parc-chart-block';
    wrap.innerHTML='<div class="parc-h">Volume agrégé par année (GWh), contrats gagnés</div>';
    const years=parcYearsShown();
    if(!years.length){ wrap.innerHTML+='<p class="parc-muted">Pas de volume renseigné.</p>'; return wrap; }
    const totals=years.map(y=>{ const t={}; PARC_CADRES.forEach(c=>{ t[c]=won.filter(p=>(p.cadre||'Autre')===c).reduce((s,p)=>s+(p.vols[y]||0),0)/1000; }); return t; });
    const max=Math.max(1,...years.map((y,i)=>Math.max(PARC_CADRES.reduce((s,c)=>s+totals[i][c],0), app.parcData.objectives[y]||0)));
    const step=max>500?200:max>200?100:max>100?50:max>40?20:10, top=Math.ceil(max/step)*step;
    const W=640, H=220, L=40, B=24, T=10, bw=(W-L-10)/years.length;
    let svg='<svg viewBox="0 0 '+W+' '+(H+B+T)+'" class="parc-chart" role="img" aria-label="Volume agrégé par année">';
    for(let v=0; v<=top; v+=step){ const yy=T+H-v/top*H; svg+='<line x1="'+L+'" x2="'+W+'" y1="'+yy+'" y2="'+yy+'" class="grid"/><text x="'+(L-6)+'" y="'+(yy+3)+'" text-anchor="end">'+v+'</text>'; }
    years.forEach((y,i)=>{
      let acc=0; const x=L+i*bw+bw*0.18, w=bw*0.64;
      PARC_CADRES.forEach(c=>{ const v=totals[i][c]; if(!v) return; const h=v/top*H; svg+='<rect x="'+x+'" y="'+(T+H-(acc+h))+'" width="'+w+'" height="'+h+'" fill="'+PARC_COLORS[c]+'"></rect>'; acc+=h; });
      svg+='<text x="'+(x+w/2)+'" y="'+(T+H+15)+'" text-anchor="middle" class="'+((y===app.parcYear||app.parcYear==='all')?'on':'')+'">'+y+'</text>';
    });
    const objPts=years.map((y,i)=>app.parcData.objectives[y]?[L+i*bw+bw/2, T+H-app.parcData.objectives[y]/top*H]:null).filter(Boolean);
    if(objPts.length>1) svg+='<polyline points="'+objPts.map(p=>p.join(',')).join(' ')+'" class="obj"/>';
    objPts.forEach(p=>{ svg+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="2.5" class="obj-dot"/>'; });
    // one invisible hover zone per year, on top of everything
    years.forEach((y,i)=>{ svg+='<rect class="hz" x="'+(L+i*bw)+'" y="'+T+'" width="'+bw+'" height="'+H+'" data-yi="'+i+'"></rect>'; });
    svg+='</svg>';
    wrap.innerHTML+='<div class="parc-chart-wrap">'+svg+'</div><div class="parc-legend">'+PARC_CADRES.filter(c=>totals.some(t=>t[c])).map(c=>'<span><i style="background:'+PARC_COLORS[c]+'"></i>'+c+'</span>').join('')+(objPts.length?'<span><i class="obj-i"></i>Objectif agrégation</span>':'')+'</div>';
    attachTip(wrap.querySelector('.parc-chart-wrap'), t=>{
      if(!t.dataset || t.dataset.yi==null) return null;
      const i=+t.dataset.yi, y=years[i], tot=PARC_CADRES.reduce((s,c)=>s+totals[i][c],0), obj=app.parcData.objectives[y];
      const n=won.filter(p=>(p.vols[y]||0)>0).length;
      return '<b>'+y+' · '+(Math.round(tot*10)/10).toLocaleString('fr-FR')+' GWh</b>'
        +PARC_CADRES.filter(c=>totals[i][c]).map(c=>tipRow(PARC_COLORS[c], c, (Math.round(totals[i][c]*10)/10).toLocaleString('fr-FR')+' GWh')).join('')
        +(obj?tipRow('', 'Objectif', obj.toLocaleString('fr-FR')+' GWh · '+Math.round(tot/obj*100)+' %'):'')
        +'<span class="muted">'+n+' contrat'+(n>1?'s':'')+' actif'+(n>1?'s':'')+'</span>';
    });
    return wrap;
  }
  // ---------- Portefeuille map ----------
  // Départements: IGN ADMIN EXPRESS (Licence Ouverte Etalab) via github.com/gregoiredavid/france-geojson, simplified to
  // whole pixels at 560 px wide; drawn in the page (no map service, works offline). Overseas plants are listed under the map.
  // the map (≈180 KB) lives in fr-map.js, loaded the first time the Portefeuille is opened
  let FR_MAP=window.FR_MAP||null;
  // finer outlines (≈1 MB, fr-map-hd.js) swapped in when zoomed past ×2.5, so borders stay sharp
  const loadFrMapHd=()=>loadScript('fr-map-hd.js', ()=>!!window.FR_MAP_HD, 'Carte détaillée indisponible');

  const loadFrMap=()=>loadScript('fr-map.js', ()=>!!FR_MAP, 'Carte indisponible').then(()=>{ FR_MAP=FR_MAP||window.FR_MAP; });

  const deptCodeOf=label=>{ const m=/^\s*(\d{1,3}|2A|2B)\b/i.exec(String(label||'')); if(!m) return null; const c=m[1].toUpperCase(); return /^\d$/.test(c)?'0'+c:c; };
  const mapTech=v=>{ const f=pqFold(v||''); return /eol/.test(f)?'Eolien':/hydro/.test(f)?'Hydro':/bio|metha|cogen/.test(f)?'Biogaz':/pv|photo|solaire|ombri|toiture/.test(f)?'PV':'Autre'; };
  function parcMapPoints(layer){
    const today=toISO(new Date());
    if(app.parcKpiSet) return app.parcKpiSet.map(p=>({ code:deptCodeOf(p.siteDept||p.dept), kwc:p.kwc||0, tech:mapTech(p.enr), name:p.inst||p.prod, prod:p.prod||p.dev, who:p.dev, ref:{ parc:p }, extra:p.fin?'fin '+pqIsoToFr(p.fin):p.statut }));
    if(layer==='pipe') return app.opportunities.filter(o=>!o.deleted && o.kind==='installation' && inProcess(o)).map(o=>({ code:deptCodeOf(o.dept), kwc:pqNum(o.kwc||'')||0, tech:mapTech(o.install), name:oppName(o), prod:o.producteur||o.company, who:o.company, ref:{ opp:o.id }, extra:stageLabel(o.stage, o), phase:oppPhase(o) }));
    if(!app.parcData) return [];
    const list=layer==='pending'?app.parcData.items.filter(p=>p.statut==='En attente'||p.statut==='En préparation'):app.parcData.items.filter(p=>p.statut==='Gagné' && (!p.fin || p.fin>=today));
    return list.map(p=>({ code:deptCodeOf(p.siteDept||p.dept), kwc:p.kwc||0, tech:mapTech(p.enr), name:p.inst||p.prod, prod:p.prod||p.dev, who:p.dev, ref:{ parc:p }, extra:p.fin?'fin '+pqIsoToFr(p.fin):p.statut }));
  }
  // a plant of the map → its opportunity (pipeline) or its client's sheet (contract of the Portefeuille)
  // a plant of the Portefeuille (a line of the Suivi): its sheet in the app — found by producer + plant, or made from the Suivi line
  const parcPlantKey=(prod, inst)=>coDupKey(prod||'')+'|'+pqFold(inst||'').replace(/[^a-z0-9]/g,'');
  function findOppForParc(p){
    const keys=new Set([parcPlantKey(p.prod, p.inst), parcPlantKey(p.dev, p.inst)]);
    return app.opportunities.find(o=>!o.deleted && o.kind==='installation' && (keys.has(o.parcKey) || keys.has(parcPlantKey(o.producteur||o.company, oppName(o))) || keys.has(parcPlantKey(o.company, oppName(o)))));
  }
  function openParcPlant(p){
    let o=findOppForParc(p);
    if(!o){
      const today=toISO(new Date()), st=pqFold(p.statut||''), started=[p.mes, p.debut].some(d=>d && d<=today);
      const stage=/perdu|abandon|no go|resili|sans suite/.test(st)?'perdu':/gagn/.test(st)?(started || !(p.mes||p.debut)?'actif':'onboarding'):/attente/.test(st)?'offre_attente':/prepar/.test(st)?'pricing_indicatif':'actif';
      const tech=mapTech(p.enr), fr=d=>d?pqIsoToFr(d):'', now=Date.now();
      o={ id:'opp_'+now+'_'+Math.random().toString(36).slice(2,7), kind:'installation', company:p.dev||p.prod, producteur:p.prod||p.dev, centrale:p.inst||p.prod, title:p.inst||p.prod,
        stage, kwc:p.kwc?String(p.kwc):'', mwh:p.p50?String(Math.round(p.p50)):'', install:tech==='Eolien'?'Eolien':tech==='Hydro'?'Hydro':tech==='Biogaz'?'BIOGAZ':tech==='PV'?'PV':'',
        contrat:[p.ao, p.cadre].filter(Boolean).join(' ')||'', dept:p.siteDept||p.dept||'', region:p.siteRegion||p.region||'', charge:p.charge||'',
        mesEff:started?fr(p.mes):'', mesPrev:started?'':fr(p.mes), debut:fr(p.debut), fin:fr(p.fin), dateOffre:p.dateOffre||'', signDate:p.sign||'', nature:/engag/i.test(p.typeOffre||'')?'Engageante':'',
        parcKey:parcPlantKey(p.prod, p.inst), fromSuivi:true, lostAt:stage==='perdu'?now:null, createdAt:now, updatedAt:now, deleted:false, stageLog:[{ stage, at:now }],
        notesLog:[{ at:now, kind:'note', text:'Fiche créée depuis le Suivi Agrégation'+(p.statut?' (statut « '+p.statut+' »)':'')+(p.comment?' — '+p.comment:'') }] };
      app.opportunities.push(o); touchCrm(o); saveCrm();
    }
    openOppDetail(o.id);
    // from the Portefeuille, what matters is the plant itself: its details and characteristics open (not remembered as the new default)
    const body=$('opp-detail-body'); body.querySelectorAll('details.sheet-sec').forEach(d=>{ if(/Détails de la centrale/.test(d.querySelector('summary').textContent)) d.open=true; });
    const cmp=body.querySelector('details.req-compare'); if(cmp && !cmp.open){ cmp.dataset.noRemember='1'; cmp.open=true; }
  }
  function openMapPoint(p){
    if(p.ref && p.ref.opp){ app.gsTab('pipeline'); setTimeout(()=>openOppDetail(p.ref.opp),30); return; }
    if(p.ref && p.ref.parc && (p.ref.parc.inst || p.ref.parc.prod)){ openParcPlant(p.ref.parc); return; }
    const known=allCompanyNames(), pick=[p.who,p.prod].find(n=>n && known.some(k=>app.sameCo(k,n)));
    openCompanySheet(pick||p.who||p.prod||'');
  }
  function mapColorBy(){ try{ return localStorage.getItem('map-color')==='techno'?'techno':'phase'; }catch(e){ return 'phase'; } }   // function: the map may draw before this line runs
  function mapRerender(){ if(app.mapInPipe) renderPipeline(); else renderParc(); }
  function parcMap(){
    if(!FR_MAP){
      const w=document.createElement('div'); w.className='parc-block parc-map-block'; w.innerHTML='<div class="parc-h">Carte</div><p class="parc-muted">Chargement de la carte…</p>';
      loadFrMap().then(()=>{ if(app.mapInPipe){ if(!$('tab-pipeline').classList.contains('hidden')) renderPipeline(); } else if(!$('tab-parc').classList.contains('hidden')) mapRerender(); }).catch(()=>{ w.querySelector('p').textContent='Carte indisponible hors ligne (elle sera disponible après une ouverture avec réseau).'; });
      return w;
    }
    // the pipeline layer: dots by phase (where the deal is), else by technology
    const byPhase=(app.mapInPipe || app.parcMapLayer==='pipe') && !app.parcKpiSet && mapColorBy()==='phase', KEYS=byPhase?MAP_PHASES:MAP_TECHS;
    const color=t=>(KEYS.find(x=>x[0]===t)||KEYS[KEYS.length-1])[2];
    const techLabel=t=>(KEYS.find(x=>x[0]===t)||KEYS[KEYS.length-1])[1];
    const wrap=document.createElement('div'); wrap.className='parc-block parc-map-block';
    const head=document.createElement('div'); head.className='map-head';
    head.innerHTML='<div class="parc-h">Carte</div>';
    const seg=document.createElement('div'); seg.className='map-seg';
    [['won','Portefeuille'],['pending','Offres'],['pipe','Pipeline']].forEach(([k,l])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=l; b.className=k===app.parcMapLayer?'on':''; b.onclick=()=>{ app.parcMapLayer=k; app.parcMapSel=null; app.parcMapView=null; mapRerender(); }; seg.appendChild(b); });
    if(!app.parcKpiSet && !app.mapInPipe) head.appendChild(seg);
    if(!app.parcKpiSet && (app.mapInPipe || app.parcMapLayer==='pipe')){ const cb=document.createElement('div'); cb.className='map-seg map-color';
      [['phase','Par phase'],['techno','Par techno']].forEach(([k,l])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=l; b.dataset.c=k; b.className=mapColorBy()===k?'on':''; b.onclick=()=>{ lsSet('map-color', k); prefsToNote(); mapRerender(); }; cb.appendChild(b); });
      head.appendChild(cb); }
    wrap.appendChild(head);

    const pts=parcMapPoints(app.parcMapLayer); if(byPhase) pts.forEach(p=>{ p.techName=(MAP_TECHS.find(x=>x[0]===p.tech)||MAP_TECHS[4])[1]; p.tech=p.phase||'qualif'; });
    const by={}, elsewhere=[];
    pts.forEach(p=>{ const metro=p.code && FR_MAP.deps.some(d=>d[0]===p.code); if(!metro){ elsewhere.push(p); return; } (by[p.code]=by[p.code]||{ kwc:0, n:0, names:[] }); by[p.code].kwc+=p.kwc; by[p.code].n++; by[p.code].names.push(p); });
    const maxKwc=Math.max(1,...pts.map(p=>p.kwc||0));

    // land in one quiet tone, départements separated by hairlines; dots carry the information
    // a margin around France so the coast and Corsica are never cut by the frame's rounded corners
    const MP=14, FULLW=FR_MAP.w+2*MP, FULLH=FR_MAP.h+2*MP;
    let svg='<svg viewBox="'+(-MP)+' '+(-MP)+' '+FULLW+' '+FULLH+'" class="parc-map" role="img" aria-label="Carte du portefeuille par département">';
    // départements tinted by their MWc (square root: small ones stay visible), a dot per plant on top
    const maxDepKwc=Math.max(1,...Object.values(by).map(v=>v.kwc));
    const shade=k=>{ const t=.25+.75*Math.sqrt(k/maxDepKwc), a=[0x2A,0x33,0x40], b=[0x4F,0x6F,0x96]; return '#'+a.map((x,i)=>Math.round(x+(b[i]-x)*t).toString(16).padStart(2,'0')).join(''); };
    // fills (no stroke), département hairlines, then the real borders of the 13 regions and the coast in white
    FR_MAP.deps.forEach(([code,name,d])=>{ svg+='<path d="'+d+'" class="dep'+(by[code]?' has':'')+'"'+(by[code]?' style="--f:'+shade(by[code].kwc)+'"':'')+' data-dep="'+code+'" data-name="'+escapeHtml(name)+'"></path>'; });
    FR_MAP.deps.forEach(([code,name,d])=>{ svg+='<path d="'+d+'" vector-effect="non-scaling-stroke" class="dep-line" data-ln="'+code+'"></path>'; });
    svg+='<path d="'+FR_MAP.regions+'" vector-effect="non-scaling-stroke" class="reg-line"></path>';
    if(app.parcMapSel){ const sd=FR_MAP.deps.find(x=>x[0]===app.parcMapSel); if(sd) svg+='<path d="'+sd[2]+'" vector-effect="non-scaling-stroke" class="dep-sel" data-ln="'+app.parcMapSel+'"></path>'; }
    const dots=[];
    Object.entries(by).forEach(([code,v])=>{
      const dep=FR_MAP.deps.find(d=>d[0]===code);
      v.names.slice().sort((a,b)=>b.kwc-a.kwc).forEach((p,i)=>{
        // spiral around the centre of the département, spaced wider than the biggest dot: no overlap
        const ang=i*2.39996, rad=5*Math.sqrt(i);
        dots.push({ p, code, x:dep[3]+Math.cos(ang)*rad, y:dep[4]+Math.sin(ang)*rad, r:1.9+1.7*Math.sqrt(Math.max(0, p.kwc||0)/maxKwc) });   // a power typed wrong (« -5 », « abc ») gives the smallest dot
      });
    });
    dots.forEach((d,i)=>{ svg+='<circle cx="'+d.x.toFixed(1)+'" cy="'+d.y.toFixed(1)+'" r="'+d.r.toFixed(1)+'" data-r0="'+d.r.toFixed(2)+'" vector-effect="non-scaling-stroke" style="--c:'+color(d.p.tech)+'" class="dot'+(app.parcMapSel && app.parcMapSel!==d.code?' dim':'')+'" data-dep="'+d.code+'" data-i="'+i+'"></circle>'; });
    svg+='</svg>';

    const grid=document.createElement('div'); grid.className='parc-map-grid';
    const mapEl=document.createElement('div'); mapEl.className='parc-map-wrap'; mapEl.innerHTML=svg;
    const tip=document.createElement('div'); tip.className='parc-map-tip'; tip.hidden=true; mapEl.appendChild(tip);
    mapEl.addEventListener('mousemove', e=>{
      const t=e.target.closest('[data-dep]'); if(!t){ tip.hidden=true; return; }
      let html;
      if(t.dataset.i!=null){ const p=dots[+t.dataset.i].p; html='<b>'+escapeHtml(p.name)+'</b><span><i style="background:'+color(p.tech)+'"></i>'+escapeHtml([techLabel(p.tech), p.kwc?fmtKwc(p.kwc):''].filter(Boolean).join(' · '))+'</span><span class="muted">'+escapeHtml([p.prod||p.who, p.extra].filter(Boolean).join(' · '))+'</span>'; }
      else { const v=by[t.dataset.dep]; if(!v){ tip.hidden=true; return; } html='<b>'+escapeHtml(t.dataset.name||'')+'</b><span>'+v.n+' installation'+(v.n>1?'s':'')+' · '+escapeHtml(fmtMwc(v.kwc))+'</span>'; }
      tip.innerHTML=html; tip.hidden=false;
      const box=mapEl.getBoundingClientRect(), x=e.clientX-box.left, y=e.clientY-box.top;
      tip.style.left=Math.max(0,Math.min(x+12, box.width-tip.offsetWidth))+'px'; tip.style.top=Math.max(0, y-tip.offsetHeight-12)+'px';
    });
    mapEl.addEventListener('mouseleave', ()=>{ tip.hidden=true; });
    // --- zoom & pan: wheel, + / − / reset buttons, drag; a click on a département zooms on it
    const svgEl=mapEl.querySelector('svg'), FULL={ x:-MP, y:-MP, w:FULLW, h:FULLH };
    const applyView=()=>{
      const v=app.parcMapView||FULL; svgEl.setAttribute('viewBox', v.x+' '+v.y+' '+v.w+' '+v.h);
      const s=v.w/FULL.w;   // dots keep their size on screen, so they spread apart when zooming in
      // and grow a little when zoomed in (×1.6 at the closest zoom) so they stay easy to point at
      svgEl.querySelectorAll('.dot').forEach(c=>c.setAttribute('r', (c.dataset.r0*s*(1+(1-s)*.7)).toFixed(2)));
      // zoomed in: high-detail outlines, and no drop shadow (a filter makes the browser rasterise the drawing)
      const hd=s<.4; svgEl.classList.toggle('zoomed', hd);
      const swap=useHd=>{
        if(svgEl.dataset.hd===String(useHd)) return; svgEl.dataset.hd=String(useHd);
        const src=useHd?window.FR_MAP_HD:null, base=Object.fromEntries(FR_MAP.deps.map(x=>[x[0],x[2]]));
        svgEl.querySelectorAll('.dep').forEach(p=>p.setAttribute('d', src?src.deps[p.dataset.dep]||base[p.dataset.dep]:base[p.dataset.dep]));
        svgEl.querySelectorAll('[data-ln]').forEach(p=>p.setAttribute('d', src?src.deps[p.dataset.ln]||base[p.dataset.ln]:base[p.dataset.ln]));
        const rl=svgEl.querySelector('.reg-line'); if(rl) rl.setAttribute('d', src?src.regions:FR_MAP.regions);
      };
      if(hd){ if(window.FR_MAP_HD) swap(true); else loadFrMapHd().then(()=>{ if(svgEl.isConnected && svgEl.classList.contains('zoomed')) swap(true); }).catch(()=>{}); }
      else swap(false);
      zoomOut.disabled=reset.disabled=!app.parcMapView;
    };
    const clampView=v=>{ const w=Math.min(FULL.w, Math.max(FULL.w/14, v.w)), hh=w*FULL.h/FULL.w; return { w, h:hh, x:Math.min(FULL.w-w*.3, Math.max(-w*.7, v.x)), y:Math.min(FULL.h-hh*.3, Math.max(-hh*.7, v.y)) }; };
    const zoomAt=(f, cx, cy)=>{ const v=app.parcMapView||FULL; const nw=Math.max(FULL.w/14, v.w*f); if(nw>=FULL.w){ app.parcMapView=null; applyView(); return; } f=nw/v.w; app.parcMapView=clampView({ w:nw, h:nw*FULL.h/FULL.w, x:cx-(cx-v.x)*f, y:cy-(cy-v.y)*f }); applyView(); };
    const toMap=(clientX, clientY)=>{ const r=svgEl.getBoundingClientRect(), v=app.parcMapView||FULL; return [v.x+(clientX-r.left)/r.width*v.w, v.y+(clientY-r.top)/r.height*v.h]; };
    const zc=document.createElement('div'); zc.className='map-zoom';
    const mk=(txt,title,fn)=>{ const b=document.createElement('button'); b.type='button'; b.textContent=txt; b.title=title; b.onclick=e=>{ e.stopPropagation(); fn(); }; zc.appendChild(b); return b; };
    mk('+','Zoomer',()=>{ const v=app.parcMapView||FULL; zoomAt(.6, v.x+v.w/2, v.y+v.h/2); });
    const zoomOut=mk('−','Dézoomer',()=>{ const v=app.parcMapView||FULL; zoomAt(1/.6, v.x+v.w/2, v.y+v.h/2); });
    const reset=mk('⤢','Toute la France',()=>{ app.parcMapView=null; applyView(); });
    mapEl.appendChild(zc);
    mapEl.addEventListener('wheel', e=>{ e.preventDefault(); const [x,y]=toMap(e.clientX,e.clientY); zoomAt(e.deltaY<0?.8:1.25, x, y); }, { passive:false });
    let drag=null, moved=false;
    // pan only once the pointer really moves: capturing it on press would steal the click from the département under it
    svgEl.addEventListener('pointerdown', e=>{ if(!app.parcMapView) return; drag={ x:e.clientX, y:e.clientY, v:app.parcMapView, id:e.pointerId }; moved=false; });
    svgEl.addEventListener('pointermove', e=>{ if(!drag) return; if(!moved){ if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)<=3) return; moved=true; try{ svgEl.setPointerCapture(drag.id); }catch(_){} } const r=svgEl.getBoundingClientRect(); const dx=(e.clientX-drag.x)/r.width*drag.v.w, dy=(e.clientY-drag.y)/r.height*drag.v.h; app.parcMapView=clampView({ ...drag.v, x:drag.v.x-dx, y:drag.v.y-dy }); applyView(); });
    const endDrag=()=>{ drag=null; }; svgEl.addEventListener('pointerup', endDrag); svgEl.addEventListener('pointercancel', endDrag);
    mapEl.addEventListener('click', e=>{
      if(moved){ moved=false; return; }
      const hit=document.elementFromPoint(e.clientX, e.clientY)||e.target, t=hit.closest && hit.closest('[data-dep]');
      if(t && !by[t.dataset.dep]) return;   // a département with no plant: nothing to open, keep the current selection
      if(!t){ if(app.parcMapSel){ app.parcMapSel=null; mapRerender(); } return; }
      // in the open département, a plant opens its sheet; elsewhere the first click opens the département
      if(app.parcMapSel===t.dataset.dep && t.dataset.i!=null && dots[+t.dataset.i]){ openMapPoint(dots[+t.dataset.i].p); return; }
      if(app.parcMapSel===t.dataset.dep){ app.parcMapSel=null; app.parcMapView=null; mapRerender(); return; }
      app.parcMapSel=t.dataset.dep;
      const dep=svgEl.querySelector('path[data-dep="'+app.parcMapSel+'"]');
      if(dep){ const bb=dep.getBBox(), w=Math.max(FULL.w/6, Math.max(bb.width, bb.height*FULL.w/FULL.h)*2.2); app.parcMapView=clampView({ w, h:w*FULL.h/FULL.w, x:bb.x+bb.width/2-w/2, y:bb.y+bb.height/2-w*FULL.h/FULL.w/2 }); }
      mapRerender();
    });
    grid.appendChild(mapEl);
    requestAnimationFrame(applyView);

    // side: one big figure, the technology mix as a thin bar, then the départements (or the plants of the selected one)
    const side=document.createElement('div'); side.className='parc-map-side';
    const selV=app.parcMapSel && by[app.parcMapSel];
    const scope=selV?selV.names:pts;
    const total=scope.reduce((s,p)=>s+p.kwc,0);
    const top=document.createElement('div'); top.className='map-figure';
    if(selV){
      const dep=FR_MAP.deps.find(d=>d[0]===app.parcMapSel);
      const back=document.createElement('button'); back.type='button'; back.className='map-back'; back.textContent='← Toute la France'; back.onclick=()=>{ app.parcMapSel=null; app.parcMapView=null; mapRerender(); };
      side.appendChild(back);
      top.innerHTML='<div class="map-eyebrow">'+escapeHtml(dep[1])+' · '+app.parcMapSel+'</div>';
    } else top.innerHTML='<div class="map-eyebrow">'+escapeHtml(app.parcKpiSet?app.parcKpiLabel:({ won:'Portefeuille signé', pending:'Offres en attente', pipe:'Pipeline' })[app.parcMapLayer])+'</div>';
    top.innerHTML+='<div class="map-big">'+escapeHtml(fmtMwc(total))+'</div><div class="map-sub">'+scope.length+' installation'+(scope.length>1?'s':'')+'</div>';
    side.appendChild(top);
    const mix=KEYS.map(([k,l,c])=>{ const list=scope.filter(p=>p.tech===k); return { k, l, c, n:list.length, kwc:list.reduce((x,p)=>x+p.kwc,0) }; }).filter(m=>m.n);
    if(mix.length){
      const bar=document.createElement('div'); bar.className='map-mix';
      mix.forEach(m=>{ const s=document.createElement('span'); s.style.flex=String(Math.max(m.kwc,1)); s.style.background=m.c; s.dataset.m=m.k; bar.appendChild(s); });
      side.appendChild(bar);
      attachTip(bar, t=>{ const m=t.dataset && mix.find(x=>x.k===t.dataset.m); return m?'<b>'+escapeHtml(m.l)+'</b>'+tipRow(m.c,'Installations',String(m.n))+tipRow('','Puissance',fmtMwc(m.kwc)+' · '+Math.round(m.kwc/(total||1)*100)+' %'):null; });
      const leg=document.createElement('div'); leg.className='map-rows';
      mix.forEach(m=>{ const r=document.createElement('div'); r.className='map-row'; r.innerHTML='<span class="map-k"><i style="background:'+m.c+'"></i>'+escapeHtml(m.l)+'</span><span class="map-v">'+m.n+'</span><span class="map-v">'+escapeHtml(fmtMwc(m.kwc))+'</span>'; leg.appendChild(r); });
      side.appendChild(leg);
    }
    const listH=document.createElement('div'); listH.className='map-eyebrow map-list-h'; listH.textContent=selV?'Installations':'Départements';
    side.appendChild(listH);
    const rows=document.createElement('div'); rows.className='map-rows map-scroll';
    if(selV){
      selV.names.slice().sort((a,b)=>b.kwc-a.kwc).forEach(p=>{ const r=document.createElement('button'); r.type='button'; r.className='map-row two map-plant'; r.onclick=()=>openMapPoint(p); r.innerHTML='<span class="map-k"><i style="background:'+color(p.tech)+'"></i>'+escapeHtml(p.name)+(p.prod && p.prod!==p.name?'<span class="map-p">'+escapeHtml(p.prod)+'</span>':'')+'</span><span class="map-v">'+escapeHtml(p.kwc?fmtKwc(p.kwc):'')+'</span>'; r.title=[p.prod,p.extra].filter(Boolean).join(' · ')+(p.ref&&p.ref.opp?' — ouvrir l\u2019opportunité':' — ouvrir la fiche client'); rows.appendChild(r); });
    } else {
      const ranked=Object.entries(by).sort((a,b)=>b[1].kwc-a[1].kwc);
      const maxDep=ranked.length?ranked[0][1].kwc:1;
      ranked.slice(0, app.parcMapAll?ranked.length:6).forEach(([code,v])=>{
        const dep=FR_MAP.deps.find(d=>d[0]===code);
        const r=document.createElement('button'); r.type='button'; r.className='map-row map-dep';
        r.innerHTML='<span class="map-k">'+escapeHtml(dep[1])+'</span><span class="map-v">'+v.n+'</span><span class="map-v">'+escapeHtml(fmtMwc(v.kwc))+'</span><span class="map-line"><span style="width:'+Math.max(3,v.kwc/maxDep*100)+'%"></span></span>';
        r.onclick=()=>{ app.parcMapSel=code; app.parcMapView=null; mapRerender(); };
        r.dataset.dep=code;
        rows.appendChild(r);
      });
      attachTip(rows, t=>{ const r=t.closest && t.closest('.map-dep'); if(!r) return null; const v=by[r.dataset.dep], dep=FR_MAP.deps.find(d=>d[0]===r.dataset.dep);
        return '<b>'+escapeHtml(dep[1])+' · '+escapeHtml(fmtMwc(v.kwc))+'</b>'+v.names.slice().sort((a,b)=>b.kwc-a.kwc).slice(0,6).map(p=>tipRow(color(p.tech), p.name, p.kwc?fmtKwc(p.kwc):'')).join('')+(v.names.length>6?'<span class="muted">+ '+(v.names.length-6)+' autres</span>':''); });
    }
    side.appendChild(rows);
    // no inner scroll bar: the 6 biggest départements, the rest on demand
    if(!selV && Object.keys(by).length>6){ const more=document.createElement('button'); more.type='button'; more.className='map-more'; more.textContent=app.parcMapAll?'Réduire':'Voir les '+Object.keys(by).length+' départements'; more.onclick=()=>{ app.parcMapAll=!app.parcMapAll; mapRerender(); }; side.appendChild(more); }
    if(elsewhere.length && !selV){ const o=document.createElement('div'); o.className='map-foot'; o.textContent='Hors métropole ou non localisé : '+elsewhere.length+' · '+fmtMwc(elsewhere.reduce((s,p)=>s+p.kwc,0)); o.title=elsewhere.map(p=>p.name).join(', '); side.appendChild(o); }
    grid.appendChild(side); wrap.appendChild(grid);
    return wrap;
  }
    Object.assign(api, { renewGroupId, fmtMwc });
  };
  return api;
})();
