// Todo — the Synthèse's panels : the market tiles, the pipeline (who has the offers), the urgent tasks, the map and the
// aggregated portfolio. Split out of js/app.js (code audit). Loaded before js/app.js.
window.TodoSynth=(function(){
  const api={};
  api.init=function(app){
    const { $, ON_PHONE, gsTab, loadParc, parcMap, activeTasks, sortedTasks, dueStatus, plainLinks, openEdit, openWeek }=app;
    // the market tiles : drawn by js/market.js from PowerKlock's open data (spot, Cal, TTF, EUA, Brent, GO), a click opens Marché
    function renderSynthMarket(){
      const root=$('synth-market'); if(!root) return;   // on the phone too : the tiles wrap two by two
      if(!root.dataset.built || Date.now()-(+root.dataset.built)>30*60000){ root.dataset.built=String(Date.now()); window.TodoMarket.renderTiles(root); }
    }
    // the Synthèse : on the left the pipeline (who has the offers) and the urgent tasks, on the right the map ;
    // the left column stops where the map ends (the tasks that don't fit : « + N autres »)
    function renderSynthPanels(){
      const root=$('synth-panels'); if(!root || ON_PHONE) return;
      root.innerHTML='';
      const grid=document.createElement('div'); grid.className='synth-grid';
      const left=document.createElement('div'); left.className='synth-left';
      const inner=document.createElement('div'); inner.className='synth-left-in'; left.appendChild(inner);
      const pipe=window.TodoOffers.offersSummary(()=>gsTab('pipeline')); pipe.querySelector('.of-sum-go').textContent='Pipeline'; inner.appendChild(pipe);
      if(app.parcData===null) loadParc();
      if(app.parcData){ const c=window.TodoParc.parcChart(app.parcData.items.filter(p=>p.statut==='Gagné')); c.classList.add('synth-parc'); c.querySelector('.parc-h').title='Ouvrir le Portefeuille'; c.querySelector('.parc-h').onclick=()=>gsTab('parc'); inner.appendChild(c); }
      inner.appendChild(synthTasksCard());
      grid.appendChild(left);
      const right=document.createElement('div'); right.className='synth-right';
      const m=parcMap(); m.classList.add('synth-map'); right.appendChild(m);
      grid.appendChild(right);
      root.appendChild(grid);
      requestAnimationFrame(synthFitTasks);
    }
    function synthTasksCard(){
      const open=activeTasks(), od=sortedTasks(open.filter(t=>dueStatus(t.due)==='overdue'));
      const now=new Date(); now.setHours(0,0,0,0);
      const td=sortedTasks(open.filter(t=>t.due && new Date(t.due+'T00:00:00').getTime()===now.getTime()));
      const c=document.createElement('section'); c.className='pd-card st-card';
      c.innerHTML='<h4 class="st-h"><button type="button" class="of-sum-go st-go"></button><button type="button" class="st-week">Ma semaine →</button></h4><div class="st-rows"></div>';
      c.querySelector('.st-go').textContent='Tâches urgentes'+(od.length+td.length?' · '+(od.length+td.length):'');
      c.querySelector('.st-go').onclick=()=>gsTab('tasks');
      c.querySelector('.st-week').onclick=()=>openWeek('this');
      const rows=c.querySelector('.st-rows');
      if(!od.length && !td.length){
        const nx=sortedTasks(open.filter(t=>t.due && dueStatus(t.due)!=='overdue')).sort((a,b)=>a.due.localeCompare(b.due))[0];
        const p=document.createElement('p'); p.className='of-sum-empty'; p.textContent='Rien en retard ni dû aujourd\u2019hui.'+(nx?' Prochaine : '+plainLinks(nx.title)+', '+new Date(nx.due+'T00:00:00').toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })+'.':'');
        rows.appendChild(p); return c;
      }
      od.concat(td).forEach(t=>{
        const late=dueStatus(t.due)==='overdue', days=Math.round((now-new Date(t.due+'T00:00:00'))/864e5);
        const r=document.createElement('button'); r.type='button'; r.className='st-row';
        r.innerHTML='<span class="tag"></span><span class="t"></span><span class="c"></span>';
        const tg=r.querySelector('.tag'); tg.textContent=late?'\u2212'+days+' j':'auj.'; tg.classList.add(late?'r':'a');
        r.querySelector('.t').textContent=plainLinks(t.title); r.querySelector('.c').textContent=t.client||'';
        r.onclick=()=>{ gsTab('tasks'); setTimeout(()=>openEdit(t.id), 30); };
        rows.appendChild(r); });
      return c;
    }
    // as many task lines as the map's height allows, the rest behind « + N autres »
    function synthFitTasks(){
      const left=document.querySelector('#synth-panels .synth-left'), rows=left && left.querySelector('.st-rows'); if(!rows) return;
      const all=[...rows.querySelectorAll('.st-row')]; rows.querySelectorAll('.of-sum-more').forEach(x=>x.remove()); all.forEach(x=>{ x.hidden=false; });
      if(getComputedStyle(left.querySelector('.synth-left-in')).position!=='absolute' || !all.length) return;   // one column (narrow window) : everything shown
      const limit=left.getBoundingClientRect().bottom-30;
      let hidden=0; all.forEach(x=>{ if(x.getBoundingClientRect().bottom>limit){ x.hidden=true; hidden++; } });
      if(hidden){ const m=document.createElement('button'); m.type='button'; m.className='of-sum-more'; m.textContent='+ '+hidden+' autre'+(hidden>1?'s':'')+' dans Tâches'; m.onclick=()=>gsTab('tasks'); rows.appendChild(m); }
    }
    window.addEventListener('resize', ()=>{ if(!$('tab-today').classList.contains('hidden')) synthFitTasks(); });
    Object.assign(api, { renderSynthMarket, renderSynthPanels });
  };
  return api;
})();
