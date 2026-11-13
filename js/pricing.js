// Todo — « Pricing » : one page for the prices and fees the pricing sends back. The installations waiting for their
// prices (or that have them), grouped by request, in a table edited like Excel (type, Enter / arrows to move, the small
// square to copy down, Ctrl+V of a range copied from Excel) ; the pricing's mail dropped or pasted fills it, each line
// found by its business code across all installations (js/conditions.js). Loaded before js/app.js.
window.TodoPricing=(function(){
  const api={};
  const ESSENTIAL=['c_fgP1', 'c_m0P1', 'c_finP1', 'c_fgP2', 'c_m0P2', 'c_finP2', 'c_pu', 'c_formule', 'c_exemple', 'c_puGo', 'c_pilotage', 'c_fgGestion', 'c_fgFixe', 'c_fgMarge'];
  const WAIT=new Set(['pricing_indicatif', 'pricing_ferme']);
  api.init=function(app){
    const { $, escapeHtml, isExited, stageIndex, stageLabel, daysInStage, oppName, touchCrm, saveCrm, openOppDetail, fillHandle, pqFullDate, notify, bridgeConfigured }=app;   // app.codeAffaire : read when used
    const C=()=>window.TodoConditions;
    let view='wait', cols='essential', q='', folded=new Set();
    try{ folded=new Set(JSON.parse(localStorage.getItem('pricing-folded')||'[]')); }catch(e){ /* none folded */ }
    const keepFolded=()=>{ try{ localStorage.setItem('pricing-folded', JSON.stringify([...folded])); }catch(e){ /* kept for this session */ } };
    try{ view=localStorage.getItem('pricing-view')||'wait'; cols=localStorage.getItem('pricing-cols')||'essential'; }catch(e){ /* defaults */ }
    const installs=()=>app.opportunities.filter(o=>!o.deleted && o.kind==='installation');
    const priced=o=>!!(o.prixValeur || o.c_pu || o.c_fgP1 || o.c_m0P1 || o.c_pePrix || o.c_formule || o.c_grpFormule);
    const waiting=o=>!isExited(o) && WAIT.has(o.stage) && !priced(o);
    const relevant=o=>priced(o) || (!isExited(o) && stageIndex(o.stage)>=stageIndex('pricing_indicatif'));
    api.waitingCount=()=>installs().filter(waiting).length;
    // the pricing's own extra columns (kept under their header) : shown with « Toutes les colonnes »
    const extras=list=>[...new Set(list.flatMap(o=>Object.keys(o.pricingExtra||{})))].map(h=>({ k:'x:'+h, label:h, type:'text', hint:'colonne du mail du pricing' }));
    const fields=list=>{ const F=C().FIELDS.filter(f=>f.part==='back'); return cols==='all' ? F.concat(extras(list||[])) : ESSENTIAL.map(k=>F.find(f=>f.k===k)).filter(Boolean); };
    const valOf=(o, k)=>{ const v=k.startsWith('x:') ? (o.pricingExtra||{})[k.slice(2)] : o[k]; return v==null ? '' : String(v); };
    const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    function shown(){
      const list=installs().filter(view==='wait' ? waiting : view==='done' ? priced : relevant);
      const w=fold(q).trim();
      return w ? list.filter(o=>fold([o.producteur, o.company, o.centrale, o.title, app.codeAffaire(o)].join(' ')).includes(w)) : list;
    }
    // one group per pricing request (or per producer for a plant on its own)
    // level 1 : the producer ; level 2 : its lots (a plant's « lot », else its request when it holds several plants) and
    // its lone installations
    function tree(list){
      const prods=new Map();
      list.forEach(o=>{ const p=String(o.producteur||o.company||'(sans producteur)').trim(); if(!prods.has(p)) prods.set(p, new Map());
        const req=o.requestId && app.opportunities.find(x=>x.id===o.requestId && !x.deleted), many=req && list.filter(x=>x.requestId===req.id && !x.lot).length>1;
        const key=o.lot ? 'l:'+(o.requestId||'')+'/'+o.lot : many ? 'r:'+req.id : 'o:'+o.id;
        const name=o.lot ? (/^\s*lot\b/i.test(o.lot) ? o.lot : 'Lot · '+o.lot) : many ? (req.label||'Demande') : '';
        const m=prods.get(p); if(!m.has(key)) m.set(key, { key, name, ms:[] }); m.get(key).ms.push(o); });
      return [...prods.entries()].sort((x, y)=>x[0].localeCompare(y[0], 'fr'))
        .map(([p, m])=>({ p, items:[...m.values()].sort((x, y)=>(!x.name)-(!y.name) || x.name.localeCompare(y.name, 'fr')) }));
    }
    function cellHtml(o, f){
      const v=valOf(o, f.k);
      return '<td class="pr-cell"><input class="req-in pr-in" data-id="'+escapeHtml(o.id)+'" data-k="'+f.k+'" value="'+escapeHtml(v)+'" placeholder="—" aria-label="'+escapeHtml(oppName(o)+' · '+f.label)+'"></td>';
    }
    const foldBtn=(key, label)=>'<button type="button" class="pr-fold" data-fold="'+escapeHtml(key)+'" aria-expanded="'+(!folded.has(key))+'" title="Replier / déplier '+escapeHtml(label)+'">'+(folded.has(key)?'\u25b8':'\u25be')+'</button>';
    function rowHtml(o, F, keys, inLot){
      const hide=(keys||[]).some(k=>folded.has(k)), d=daysInStage(o), st=WAIT.has(o.stage) ? stageLabel(o.stage, o)+(d!=null?' · '+d+' j':'') : stageLabel(o.stage, o);
      const ref=app.codeAffaire(o);
      return '<tr class="'+(inLot?'pr-in-lot':'pr-solo')+'" data-in="'+escapeHtml((keys||[]).join('|'))+'"'+(hide?' hidden':'')+'><td class="pr-name"><b>'+escapeHtml(ref||oppName(o))+'</b><span>'+escapeHtml([ref?oppName(o):'', o.kwc?o.kwc+' kWc':''].filter(Boolean).join(' · '))+'</span></td>'
        +'<td class="pr-st"><span class="pr-tag'+(waiting(o)?' wait':'')+'">'+escapeHtml(st)+'</span></td>'+F.map(f=>cellHtml(o, f)).join('')
        +'<td class="pr-act">'+((o.pricingMails||[]).length?'<button type="button" class="pipe-bar-btn pr-mails-btn" data-id="'+escapeHtml(o.id)+'" title="Les mails du pricing gardés pour cette installation">\u2709 '+o.pricingMails.length+'</button> ':'')+'<button type="button" class="pipe-bar-btn pr-open" data-id="'+escapeHtml(o.id)+'">Fiche</button></td></tr>';
    }
    const tplBtn=(ms, label)=>'<button type="button" class="pipe-bar-btn pr-tpl-grp" data-ids="'+escapeHtml(ms.map(o=>o.id).join(','))+'" title="Le tableau à faire compléter par le pricing pour '+escapeHtml(label)+', avec les codes affaire, à coller dans ton mail">Tableau pour le pricing</button>';
    const daysOf=ms=>Math.max(0, ...ms.map(o=>daysInStage(o)||0));
    // a lot's line : priced once for all its plants
    function lotRowHtml(it, F, pk){
      const ms=it.ms, lk=pk+'#'+it.key, ids=ms.map(o=>o.id).join(','), val=f=>{ const v=[...new Set(ms.map(o=>valOf(o, f.k)))]; return v.length===1 ? v[0] : ''; }, d=daysOf(ms);
      return '<tr class="pr-lot" data-in="'+escapeHtml(pk)+'"'+(folded.has(pk)?' hidden':'')+'><td class="pr-name">'+foldBtn(lk, 'le lot')+'<b>'+escapeHtml(it.name)+'</b><span>'+ms.length+' installation'+(ms.length>1?'s':'')+(d?' · depuis '+d+' j':'')+' · un prix pour tout le lot</span></td><td></td>'
        +F.map(f=>{ const v=val(f), mixed=!v && ms.some(o=>valOf(o, f.k));
          return '<td class="pr-cell"><input class="req-in pr-in pr-lot-in" data-ids="'+escapeHtml(ids)+'" data-k="'+f.k+'" value="'+escapeHtml(v)+'" placeholder="'+(mixed?'différents':'—')+'" aria-label="'+escapeHtml(it.name+' · '+f.label)+'"></td>'; }).join('')
        +'<td class="pr-act">'+tplBtn(ms, it.name)+'</td></tr>';
    }
    function tableHtml(list){
      const F=fields(list);
      let t='<table class="req-table pr-table"><thead><tr><th>Producteur · lot · installation</th><th>Étape</th>'+F.map(f=>'<th>'+escapeHtml(f.label)+(f.hint?'<small>'+escapeHtml(f.hint)+'</small>':'')+'</th>').join('')+'<th></th></tr></thead>';
      tree(list).forEach(g=>{ const pk='p:'+g.p, all=g.items.flatMap(it=>it.ms), nLots=g.items.filter(it=>it.name).length;
        t+='<tbody><tr class="pr-grp pr-prod"><td colspan="'+(F.length+3)+'">'+foldBtn(pk, 'le producteur')+escapeHtml(g.p)+' <span>· '+all.length+' installation'+(all.length>1?'s':'')+(nLots?' · '+nLots+' lot'+(nLots>1?'s':''):'')+'</span> '+tplBtn(all, g.p)+'</td></tr>'
          +g.items.map(it=>it.name ? lotRowHtml(it, F, pk)+it.ms.map(o=>rowHtml(o, F, [pk, pk+'#'+it.key], true)).join('') : it.ms.map(o=>rowHtml(o, F, [pk])).join('')).join('')+'</tbody>'; });
      return t+'</table>';
    }
    // a cell saved ; a lot's cell : the value goes to every plant of the lot (their own cells follow)
    function save(inp){
      const ids=inp.dataset.ids ? inp.dataset.ids.split(',') : [inp.dataset.id], list=app.opportunities.filter(x=>ids.includes(x.id)); if(!list.length) return;
      const k=inp.dataset.k, f=C().FIELDS.find(x=>x.k===k); let v=inp.value.trim();
      if(f && f.type==='date' && v){ const fd=pqFullDate(v); if(fd) v=fd; }
      if(inp.dataset.ids && !v) return;   // an empty lot cell never clears its plants
      const changed=list.filter(o=>valOf(o, k)!==v); if(!changed.length) return;
      changed.forEach(o=>{ if(k.startsWith('x:')){ const x=Object.assign({}, o.pricingExtra||{}); if(v) x[k.slice(2)]=v; else delete x[k.slice(2)]; o.pricingExtra=x; }
        else if(v) o[k]=v; else delete o[k]; touchCrm(o); });
      saveCrm(); inp.value=v;
      if(inp.dataset.ids) ids.forEach(id=>{ const x=[...inp.closest('table').querySelectorAll('.pr-in[data-id="'+id+'"]')].find(i=>i.dataset.k===k); if(x) x.value=v; });
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
      box.querySelectorAll('.pr-mails-btn').forEach(b=>{ b.onclick=()=>{ const o=app.opportunities.find(x=>x.id===b.dataset.id), l=o && o.pricingMails || []; if(l.length) C().showMail(l[l.length-1]); }; });
      fillHandle(box);
    }
    function seg(name, opts, cur){ return '<div class="pr-seg pipe-seg" role="group" data-seg="'+name+'">'+opts.map(([v, l])=>'<button type="button" data-v="'+v+'" class="'+(v===cur?'on':'')+'">'+l+'</button>').join('')+'</div>'; }
    function render(){
      const root=$('pricing-root'); if(!root) return;
      const all=installs(), nWait=all.filter(waiting).length, nDone=all.filter(priced).length, nAll=all.filter(relevant).length, list=shown();
      root.innerHTML='<div class="quick-add-bar pr-bar"><div class="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>'
        +'<input type="text" class="pr-search" placeholder="Rechercher producteur, centrale, code…" value="'+escapeHtml(q)+'"></div>'
        +seg('view', [['wait', 'En attente de prix <i>'+nWait+'</i>'], ['done', 'Prix reçus <i>'+nDone+'</i>'], ['all', 'Toutes <i>'+nAll+'</i>']], view)
        +seg('cols', [['essential', 'Essentiel'], ['all', 'Toutes les colonnes']], cols)
        +'<span class="pr-r"><button type="button" class="pipe-bar-btn pr-foldall" title="Replier ou déplier toutes les demandes et tous les lots">Tout replier</button>'
        +'<button type="button" class="pipe-bar-btn pr-tpl" title="Le tableau à faire compléter par le pricing pour toutes les installations de cette vue">Tableau pour le pricing</button>'+(bridgeConfigured()?'<button type="button" class="primary-btn pr-send">Envoyer au Suivi</button>':'')+'</span></div>'
        +'<div class="pr-body"><p class="pr-sub">Les prix et frais rendus par le pricing, par demande et par lot</p><div class="pr-drop-slot"></div>'
        +(list.length ? '<div class="pr-scroll">'+tableHtml(list)+'</div>' : '<p class="xs-empty">'+(view==='wait'?'✓ Aucune installation en attente de prix.':'Rien à afficher.')+'</p>')+'</div>';
      // the drop zone : the pricing's mail matched across every installation of the app
      root.querySelector('.pr-drop-slot').replaceWith(C().dropZone(installs().filter(o=>!isExited(o) || priced(o)), root, 'Dépose ici le mail du pricing : chaque ligne va à son installation (code affaire)'));
      root.querySelectorAll('.pr-seg').forEach(s=>s.querySelectorAll('button').forEach(b=>{ b.onclick=()=>{ if(s.dataset.seg==='view'){ view=b.dataset.v; try{ localStorage.setItem('pricing-view', view); }catch(e){ /* kept for this session */ } }
        else { cols=b.dataset.v; try{ localStorage.setItem('pricing-cols', cols); }catch(e){ /* kept for this session */ } } render(); }; }));
      const sr=root.querySelector('.pr-search'); sr.oninput=()=>{ q=sr.value; const pos=sr.selectionStart; render(); const n=$('pricing-root').querySelector('.pr-search'); n.focus(); n.setSelectionRange(pos, pos); };
      root.querySelector('.pr-tpl').onclick=e=>copyTemplate(e.currentTarget);
      root.querySelectorAll('.pr-tpl-grp').forEach(b=>{ b.onclick=e=>{ const ids=b.dataset.ids.split(','); copyTemplate(e.currentTarget, app.opportunities.filter(o=>ids.includes(o.id))); }; });
      const send=root.querySelector('.pr-send'); if(send) send.onclick=async()=>{ const l=shown().filter(priced); if(!l.length){ notify('Aucun prix à envoyer dans cette vue.'); return; } await window.TodoExcelSync.sendToExcel('bdd', l, send); };
      wireFold(root); wire(root); paintCount();
    }
    // a request or a lot folded : its lines hidden (a lot inside a folded request stays folded)
    function paintFold(root){
      root.querySelectorAll('.pr-fold').forEach(b=>{ const on=folded.has(b.dataset.fold); b.textContent=on?'\u25b8':'\u25be'; b.setAttribute('aria-expanded', String(!on)); });
      root.querySelectorAll('tr[data-in]').forEach(tr=>{ tr.hidden=tr.dataset.in.split('|').some(k=>folded.has(k)); });
      const fa=root.querySelector('.pr-foldall'); if(fa) fa.textContent=root.querySelector('.pr-fold[aria-expanded="true"]') ? 'Tout replier' : 'Tout déplier';
    }
    function wireFold(root){
      root.querySelectorAll('.pr-fold').forEach(b=>{ b.onclick=()=>{ const k=b.dataset.fold; if(folded.has(k)) folded.delete(k); else folded.add(k); keepFolded(); paintFold(root); }; });
      const fa=root.querySelector('.pr-foldall');
      if(fa) fa.onclick=()=>{ const ks=[...root.querySelectorAll('.pr-fold')].map(b=>b.dataset.fold), open=ks.some(k=>!folded.has(k)); ks.forEach(k=>{ if(open) folded.add(k); else folded.delete(k); }); keepFolded(); paintFold(root); };
      paintFold(root);
    }
    // the table the pricing fills in : the Suivi's exact names, one line per lot (« Lot … ») or per installation (its
    // business code), copied as a table (pasted in Outlook as a table) and as tab-separated text
    // one line per lot (a plant's « lot », or its request named « Lot … ») or per installation, with its business codes :
    // the pricing keeps them, and its answer is matched by them for sure
    const reqLot=o=>{ const r=o.requestId && app.opportunities.find(x=>x.id===o.requestId && !x.deleted); return r && /^\s*lot\b/i.test(r.label||'') ? r.label.trim() : ''; };
    function templateLines(list){
      const by=new Map();
      list.forEach(o=>{ const n=o.lot ? 'Lot '+String(o.lot).replace(/^lot\s*/i, '') : reqLot(o) || app.codeAffaire(o) || oppName(o); if(!by.has(n)) by.set(n, []); by.get(n).push(app.codeAffaire(o)); });
      return [...by.entries()].map(([name, codes])=>({ name, codes:codes.filter(Boolean).join(', ') }));
    }
    const templateRows=list=>templateLines(list).map(l=>l.name);
    async function copyTemplate(btn, only){
      const list=only||shown(), cols=C().templateCols(list); if(!list.length){ notify('Aucune installation dans cette vue.'); return; }
      const names=templateLines(list), lines=[cols].concat(names.map(l=>[l.name, l.codes].concat(cols.slice(2).map(()=>''))));
      const tsv=lines.map(r=>r.join('\t')).join('\n');
      const cell=(v, h)=>'<'+(h?'th':'td')+' style="border:1px solid #999;padding:4px 8px;font:11pt Calibri,Arial;'+(h?'background:#1d6b4f;color:#fff;':'')+'">'+escapeHtml(v)+'</'+(h?'th':'td')+'>';
      const html='<table style="border-collapse:collapse">'+lines.map((r, i)=>'<tr>'+r.map(v=>cell(v, i===0)).join('')+'</tr>').join('')+'</table>';
      try{ await navigator.clipboard.write([new ClipboardItem({ 'text/html':new Blob([html], { type:'text/html' }), 'text/plain':new Blob([tsv], { type:'text/plain' }) })]); }
      catch(e){ try{ await navigator.clipboard.writeText(tsv); }catch(e2){ notify('Copie impossible dans ce navigateur.'); return; } }
      const t=btn.textContent; btn.textContent='Copié ✓'; setTimeout(()=>{ btn.textContent=t; }, 1500);
      notify('Tableau copié ('+names.length+' ligne'+(names.length>1?'s':'')+') : colle-le dans ton mail au pricing, et demande-lui de garder les codes affaire.');
    }
    api.templateRows=templateRows;
    function paintCount(){ const b=$('pricing-badge'); if(b){ const n=api.waitingCount(); b.textContent=n?String(n):''; } }
    // from a sheet's « Saisir les prix » : the view that shows them, their rows marked, the first empty price focused
    function focusOn(ids){
      if(!ids.length) return;
      const list=app.opportunities.filter(o=>ids.includes(o.id));
      q=''; view=list.every(waiting) ? 'wait' : 'all'; unfold(list); render();
      const root=$('pricing-root'), rows=ids.map(id=>root.querySelector('.pr-in[data-id="'+id+'"]')).filter(Boolean).map(x=>x.closest('tr'));
      rows.forEach(tr=>tr.classList.add('pr-focus'));
      if(rows[0]) rows[0].scrollIntoView({ block:'center' });
      const first=rows.map(tr=>[...tr.querySelectorAll('.pr-in')].find(i=>!i.value)).find(Boolean) || (rows[0] && rows[0].querySelector('.pr-in'));
      if(first) setTimeout(()=>{ first.focus(); first.select(); }, 60);
    }
    // their producers and lots unfolded
    function unfold(list){ list.forEach(o=>{ const pk='p:'+String(o.producteur||o.company||'(sans producteur)').trim(); [...folded].forEach(k=>{ if(k===pk || k.startsWith(pk+'#')) folded.delete(k); }); }); keepFolded(); }
    // after a pricing mail filled : the view where they now are, their requests and lots unfolded, their rows marked
    function showFilled(ids){
      const list=app.opportunities.filter(o=>ids.includes(o.id)); if(!list.length){ render(); return; }
      q=''; view=list.every(waiting) ? 'wait' : list.every(priced) ? 'done' : 'all';
      unfold(list);
      render();
      const root=$('pricing-root'), rows=[...new Set(ids.map(id=>root.querySelector('.pr-in[data-id="'+id+'"]')).filter(Boolean).map(x=>x.closest('tr')))];
      rows.forEach(tr=>tr.classList.add('pr-focus')); if(rows[0]) rows[0].scrollIntoView({ block:'center' });
    }
    Object.assign(api, { render, paintCount, focusOn, showFilled });
  };
  return api;
})();
