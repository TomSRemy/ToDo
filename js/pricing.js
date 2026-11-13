// Todo — « Pricing » : one page for the prices and fees the pricing sends back. The installations waiting for their
// prices (or that have them), grouped by request, in a table edited like Excel (type, Enter / arrows to move, the small
// square to copy down, Ctrl+V of a range copied from Excel) ; the pricing's mail dropped or pasted fills it, each line
// found by its business code across all installations (js/conditions.js). Loaded before js/app.js.
window.TodoPricing=(function(){
  const api={};
  const ESSENTIAL=['c_fgP1', 'c_finP1', 'c_fgP2', 'c_finP2', 'c_pu', 'c_puGo', 'c_pilotage', 'c_fgGestion', 'c_fgFixe', 'c_fgMarge'];
  const WAIT=new Set(['pricing_indicatif', 'pricing_ferme']);
  api.init=function(app){
    const { $, escapeHtml, isExited, stageIndex, stageLabel, daysInStage, oppName, touchCrm, saveCrm, openOppDetail, fillHandle, pqFullDate, notify, bridgeConfigured }=app;   // app.codeAffaire : read when used
    const C=()=>window.TodoConditions;
    let view='wait', cols='essential', q='';
    try{ view=localStorage.getItem('pricing-view')||'wait'; cols=localStorage.getItem('pricing-cols')||'essential'; }catch(e){ /* defaults */ }
    const installs=()=>app.opportunities.filter(o=>!o.deleted && o.kind==='installation');
    const priced=o=>!!(o.prixValeur || o.c_pu || o.c_fgP1 || o.c_m0P1 || o.c_pePrix);
    const waiting=o=>!isExited(o) && WAIT.has(o.stage) && !priced(o);
    const relevant=o=>priced(o) || (!isExited(o) && stageIndex(o.stage)>=stageIndex('pricing_indicatif'));
    api.waitingCount=()=>installs().filter(waiting).length;
    const fields=()=>{ const F=C().FIELDS.filter(f=>f.part==='back'); return cols==='all' ? F : ESSENTIAL.map(k=>F.find(f=>f.k===k)).filter(Boolean); };
    const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    function shown(){
      const list=installs().filter(view==='wait' ? waiting : view==='done' ? priced : relevant);
      const w=fold(q).trim();
      return w ? list.filter(o=>fold([o.producteur, o.company, o.centrale, o.title, app.codeAffaire(o)].join(' ')).includes(w)) : list;
    }
    // one group per pricing request (or per producer for a plant on its own)
    function groups(list){
      const by=new Map();
      list.forEach(o=>{ const k=o.requestId||('co:'+(o.producteur||o.company||'')); if(!by.has(k)) by.set(k, []); by.get(k).push(o); });
      return [...by.entries()].map(([k, members])=>{ const req=k.startsWith('co:')?null:app.opportunities.find(x=>x.id===k);
        return { title:(req && req.label) || members[0].producteur || members[0].company || '(sans producteur)', members, days:Math.max(...members.map(o=>daysInStage(o)||0)) }; });
    }
    function cellHtml(o, f){
      const v=o[f.k]==null?'':String(o[f.k]);
      return '<td class="pr-cell"><input class="req-in pr-in" data-id="'+escapeHtml(o.id)+'" data-k="'+f.k+'" value="'+escapeHtml(v)+'" placeholder="—" aria-label="'+escapeHtml(oppName(o)+' · '+f.label)+'"></td>';
    }
    function rowHtml(o, F){
      const d=daysInStage(o), st=WAIT.has(o.stage) ? stageLabel(o.stage, o)+(d!=null?' · '+d+' j':'') : stageLabel(o.stage, o);
      return '<tr><td class="pr-name"><b>'+escapeHtml(oppName(o))+'</b><span>'+escapeHtml([app.codeAffaire(o), o.kwc?o.kwc+' kWc':''].filter(Boolean).join(' · '))+'</span></td>'
        +'<td class="pr-st"><span class="pr-tag'+(waiting(o)?' wait':'')+'">'+escapeHtml(st)+'</span></td>'+F.map(f=>cellHtml(o, f)).join('')
        +'<td class="pr-act"><button type="button" class="ghost-btn pr-open" data-id="'+escapeHtml(o.id)+'">Fiche</button></td></tr>';
    }
    // the plants of a group, lot by lot (those without a lot last) ; a lot gets a line of its own to price it once
    function lotsOf(members){
      const by=new Map(); members.forEach(o=>{ const k=o.lot||''; if(!by.has(k)) by.set(k, []); by.get(k).push(o); });
      return [...by.entries()].sort((a, b)=>(a[0]==='')-(b[0]===''));
    }
    function lotRowHtml(lot, ms, F){
      const ids=ms.map(o=>o.id).join(','), val=f=>{ const v=[...new Set(ms.map(o=>o[f.k]==null?'':String(o[f.k])))]; return v.length===1 ? v[0] : ''; };
      return '<tr class="pr-lot"><td class="pr-name"><b>Lot · '+escapeHtml(lot)+'</b><span>'+ms.length+' installation'+(ms.length>1?'s':'')+' · un prix pour tout le lot</span></td><td></td>'
        +F.map(f=>{ const v=val(f), mixed=!v && ms.some(o=>o[f.k]);
          return '<td class="pr-cell"><input class="req-in pr-in pr-lot-in" data-ids="'+escapeHtml(ids)+'" data-k="'+f.k+'" value="'+escapeHtml(v)+'" placeholder="'+(mixed?'différents':'—')+'" aria-label="'+escapeHtml('Lot '+lot+' · '+f.label)+'"></td>'; }).join('')
        +'<td></td></tr>';
    }
    function tableHtml(list){
      const F=fields();
      let t='<table class="req-table pr-table"><thead><tr><th>Installation</th><th>Étape</th>'+F.map(f=>'<th>'+escapeHtml(f.label)+(f.hint?'<small>'+escapeHtml(f.hint)+'</small>':'')+'</th>').join('')+'<th></th></tr></thead>';
      groups(list).forEach(g=>{ t+='<tbody><tr class="pr-grp"><td colspan="'+(F.length+3)+'">'+escapeHtml(g.title)+' <span>· '+g.members.length+' installation'+(g.members.length>1?'s':'')+(g.days?' · depuis '+g.days+' j à cette étape':'')+'</span></td></tr>'
        +lotsOf(g.members).map(([lot, ms])=>(lot ? lotRowHtml(lot, ms, F) : '')+ms.map(o=>rowHtml(o, F)).join('')).join('')+'</tbody>'; });
      return t+'</table>';
    }
    // a cell saved ; a lot's cell : the value goes to every plant of the lot (their own cells follow)
    function save(inp){
      const ids=inp.dataset.ids ? inp.dataset.ids.split(',') : [inp.dataset.id], list=app.opportunities.filter(x=>ids.includes(x.id)); if(!list.length) return;
      const f=C().FIELDS.find(x=>x.k===inp.dataset.k); let v=inp.value.trim();
      if(f && f.type==='date' && v){ const fd=pqFullDate(v); if(fd) v=fd; }
      if(inp.dataset.ids && !v) return;   // an empty lot cell never clears its plants
      const changed=list.filter(o=>(o[f.k]||'')!==v); if(!changed.length) return;
      changed.forEach(o=>{ if(v) o[f.k]=v; else delete o[f.k]; touchCrm(o); });
      saveCrm(); inp.value=v;
      if(inp.dataset.ids) ids.forEach(id=>{ const x=inp.closest('table').querySelector('.pr-in[data-id="'+id+'"][data-k="'+f.k+'"]'); if(x) x.value=v; });
      const td=inp.closest('td'); td.classList.add('saved'); setTimeout(()=>td.classList.remove('saved'), 900);
      paintCount();
    }
    // Excel-like keys : Enter / ↓ the cell below, ↑ the one above ; a range pasted from Excel fills the cells from here
    function move(inp, dr, dc){
      const td=inp.closest('td'), tr=td.parentElement, rows=[...tr.closest('table').querySelectorAll('tbody tr:not(.pr-grp)')];
      const r=rows.indexOf(tr)+dr, row=rows[r]; if(!row) return;
      const target=row.cells[td.cellIndex+dc]; const x=target && target.querySelector('.pr-in'); if(x){ x.focus(); x.select(); }
    }
    function pasteRange(inp, text){
      const lines=text.replace(/\r/g, '').split('\n').filter((l, i, a)=>l!=='' || i<a.length-1); if(lines.length<2 && !lines[0].includes('\t')) return false;
      const rows=[...inp.closest('table').querySelectorAll('tbody tr:not(.pr-grp)')], r0=rows.indexOf(inp.closest('tr')), c0=inp.closest('td').cellIndex;
      lines.forEach((l, i)=>{ const row=rows[r0+i]; if(!row) return; l.split('\t').forEach((v, j)=>{ const x=row.cells[c0+j] && row.cells[c0+j].querySelector('.pr-in'); if(x){ x.value=v.trim(); save(x); } }); });
      return true;
    }
    function wire(box){
      box.querySelectorAll('.pr-in').forEach(inp=>{
        inp.addEventListener('change', ()=>save(inp));
        inp.addEventListener('keydown', e=>{
          if(e.key==='Enter' || e.key==='ArrowDown'){ e.preventDefault(); save(inp); move(inp, 1, 0); }
          else if(e.key==='ArrowUp'){ e.preventDefault(); save(inp); move(inp, -1, 0); }
          else if(e.key==='Escape'){ inp.blur(); e.stopPropagation(); } });
        inp.addEventListener('paste', e=>{ const t=e.clipboardData && e.clipboardData.getData('text'); if(t && pasteRange(inp, t)) e.preventDefault(); });
      });
      box.querySelectorAll('.pr-open').forEach(b=>{ b.onclick=()=>openOppDetail(b.dataset.id); });
      fillHandle(box);
    }
    function seg(name, opts, cur){ return '<div class="pr-seg" data-seg="'+name+'">'+opts.map(([v, l])=>'<button type="button" data-v="'+v+'" class="'+(v===cur?'on':'')+'">'+l+'</button>').join('')+'</div>'; }
    function render(){
      const root=$('pricing-root'); if(!root) return;
      const all=installs(), nWait=all.filter(waiting).length, nDone=all.filter(priced).length, nAll=all.filter(relevant).length, list=shown();
      root.innerHTML='<div class="pr-top"><h1>Pricing</h1><span>les prix et frais rendus par le pricing, installation par installation</span></div><div class="pr-drop-slot"></div>'
        +'<div class="pr-bar">'+seg('view', [['wait', 'En attente de prix <i>'+nWait+'</i>'], ['done', 'Prix reçus <i>'+nDone+'</i>'], ['all', 'Toutes <i>'+nAll+'</i>']], view)
        +'<input type="search" class="pr-search" placeholder="Rechercher producteur, centrale, code…" value="'+escapeHtml(q)+'">'
        +'<span class="pr-r">'+seg('cols', [['essential', 'Essentiel'], ['all', 'Toutes les colonnes']], cols)+(bridgeConfigured()?'<button type="button" class="ghost-btn pr-send">Envoyer au Suivi</button>':'')+'</span></div>'
        +(list.length ? '<div class="pr-scroll">'+tableHtml(list)+'</div>' : '<p class="xs-empty">'+(view==='wait'?'✓ Aucune installation en attente de prix.':'Rien à afficher.')+'</p>');
      // the drop zone : the pricing's mail matched across every installation of the app
      root.querySelector('.pr-drop-slot').replaceWith(C().dropZone(installs().filter(o=>!isExited(o) || priced(o)), root, 'Dépose ici le mail du pricing : chaque ligne va à son installation (code affaire)'));
      root.querySelectorAll('.pr-seg').forEach(s=>s.querySelectorAll('button').forEach(b=>{ b.onclick=()=>{ if(s.dataset.seg==='view'){ view=b.dataset.v; try{ localStorage.setItem('pricing-view', view); }catch(e){ /* kept for this session */ } }
        else { cols=b.dataset.v; try{ localStorage.setItem('pricing-cols', cols); }catch(e){ /* kept for this session */ } } render(); }; }));
      const sr=root.querySelector('.pr-search'); sr.oninput=()=>{ q=sr.value; const pos=sr.selectionStart; render(); const n=$('pricing-root').querySelector('.pr-search'); n.focus(); n.setSelectionRange(pos, pos); };
      const send=root.querySelector('.pr-send'); if(send) send.onclick=async()=>{ const l=shown().filter(priced); if(!l.length){ notify('Aucun prix à envoyer dans cette vue.'); return; } await window.TodoExcelSync.sendToExcel('bdd', l, send); };
      wire(root); paintCount();
    }
    function paintCount(){ const b=$('pricing-badge'); if(b){ const n=api.waitingCount(); b.textContent=n?String(n):''; } }
    // from a sheet's « Saisir les prix » : the view that shows them, their rows marked, the first empty price focused
    function focusOn(ids){
      if(!ids.length) return;
      const list=app.opportunities.filter(o=>ids.includes(o.id));
      q=''; view=list.every(waiting) ? 'wait' : 'all'; render();
      const root=$('pricing-root'), rows=ids.map(id=>root.querySelector('.pr-in[data-id="'+id+'"]')).filter(Boolean).map(x=>x.closest('tr'));
      rows.forEach(tr=>tr.classList.add('pr-focus'));
      if(rows[0]) rows[0].scrollIntoView({ block:'center' });
      const first=rows.map(tr=>[...tr.querySelectorAll('.pr-in')].find(i=>!i.value)).find(Boolean) || (rows[0] && rows[0].querySelector('.pr-in'));
      if(first) setTimeout(()=>{ first.focus(); first.select(); }, 60);
    }
    Object.assign(api, { render, paintCount, focusOn });
  };
  return api;
})();
