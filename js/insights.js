// Todo — « Bilan » tab (loaded before js/app.js): weekly numbers computed from what's already tracked (archivedAt, stageLog). No new data kept. Split out like js/parc.js.
window.TodoInsights=(function(){
  let app=null;   // what this part needs from js/app.js, given once at start-up (init)
  const $=id=>document.getElementById(id);
  const DOW=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  function startOfWeek(d){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x; }
  let weekStart=startOfWeek(new Date());
  function fmtRange(s){ const e=new Date(s); e.setDate(e.getDate()+6);
    return s.toLocaleDateString('fr-FR',{ day:'numeric', month:'short' })+' — '+e.toLocaleDateString('fr-FR',{ day:'numeric', month:'short' }); }
  function stat(label, value, sub){
    const d=document.createElement('div'); d.className='bilan-stat';
    d.innerHTML='<span class="bilan-stat-label"></span><span class="bilan-stat-value"></span><span class="bilan-stat-sub"></span>';
    d.querySelector('.bilan-stat-label').textContent=label; d.querySelector('.bilan-stat-value').textContent=value; d.querySelector('.bilan-stat-sub').textContent=sub||'';
    return d;
  }
  function renderBilan(){
    const root=$('bilan-root'); if(!root) return;
    const { tasks, opportunities }=app;
    const from=weekStart.getTime(), to=from+7*86400000;
    const inRange=t=>t>=from && t<to;

    const allTasks=tasks().filter(t=>!t.deleted);
    const done=allTasks.filter(t=>t.archived && inRange(t.archivedAt||0));
    const created=allTasks.filter(t=>inRange(t.createdAt||0));

    const opps=opportunities();
    const moved=new Set(), submitted=[], signed=[];
    opps.forEach(o=>{ (o.stageLog||[]).forEach(e=>{ if(!e || !inRange(e.at||0)) return; moved.add(o.id); if(e.stage==='offre_attente') submitted.push(o); if(e.stage==='onboarding') signed.push(o); }); });

    const byDay=[0,0,0,0,0,0,0];
    done.forEach(t=>{ const d=Math.floor(((t.archivedAt||0)-from)/86400000); if(d>=0 && d<7) byDay[d]++; });
    const maxDay=Math.max(1, ...byDay);

    root.innerHTML='<div class="week-head"><div class="week-title"><h2>Bilan</h2><span class="week-range"></span></div>'+
      '<div class="week-nav"><button type="button" class="week-nav-btn" id="bilan-prev">‹ Semaine préc.</button><button type="button" class="week-nav-btn" id="bilan-today">Cette semaine</button><button type="button" class="week-nav-btn" id="bilan-next">Semaine suiv. ›</button></div></div>'+
      '<div class="bilan-stats"></div><div class="bilan-cols"><div class="bilan-box" id="bilan-days"><h3>Jours actifs</h3><div class="bilan-bars"></div></div>'+
      '<div class="bilan-box" id="bilan-pipe"><h3>Pipeline</h3></div></div>';
    root.querySelector('.week-range').textContent=fmtRange(weekStart);

    const stats=root.querySelector('.bilan-stats');
    stats.appendChild(stat('Tâches terminées', done.length));
    stats.appendChild(stat('Tâches créées', created.length));
    stats.appendChild(stat('Offres remises', submitted.length));
    stats.appendChild(stat('Signatures', signed.length));

    const bars=root.querySelector('.bilan-bars');
    byDay.forEach((n,i)=>{ const col=document.createElement('div'); col.className='bilan-bar-col';
      col.innerHTML='<div class="bilan-bar" style="height:'+Math.max(4, n/maxDay*76)+'px"></div><span></span>';
      col.querySelector('span').textContent=DOW[i]; col.title=n+' terminée'+(n===1?'':'s'); bars.appendChild(col); });

    const pipeBox=root.querySelector('#bilan-pipe');
    if(!moved.size){ const p=document.createElement('p'); p.className='modal-hint'; p.textContent='Aucune fiche n’a changé d’étape cette semaine.'; pipeBox.appendChild(p); }
    else { const p=document.createElement('p'); p.className='modal-hint'; p.textContent=moved.size+' fiche'+(moved.size>1?'s':'')+' ont avancé d’une étape ou plus cette semaine.'; pipeBox.appendChild(p); }

    root.querySelector('#bilan-prev').onclick=()=>{ weekStart.setDate(weekStart.getDate()-7); renderBilan(); };
    root.querySelector('#bilan-next').onclick=()=>{ weekStart.setDate(weekStart.getDate()+7); renderBilan(); };
    root.querySelector('#bilan-today').onclick=()=>{ weekStart=startOfWeek(new Date()); renderBilan(); };
  }
  const api={};
  api.init=function(a){ app=a; };
  api.renderBilan=renderBilan;
  return api;
})();
