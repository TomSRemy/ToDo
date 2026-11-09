// Todo — « Semaine » tab (loaded before js/app.js): drag-and-drop week view, replans a task's due date in place. Split out like js/parc.js.
window.TodoWeek=(function(){
  let app=null;   // what this part needs from js/app.js, given once at start-up (init)
  const $=id=>document.getElementById(id);
  const DOW=['Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.','Dim.'];
  const toISO=window.TodoParse.toISO;
  function startOfWeek(d){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x; }
  let weekStart=startOfWeek(new Date());
  function renderWeek(){
    const root=$('week-root'); if(!root) return;
    const { tasks, URGENCY_META, openWeekTask, rescheduleTask }=app;
    const days=[...Array(7)].map((_,i)=>{ const d=new Date(weekStart); d.setDate(d.getDate()+i); return d; });
    const list=tasks().filter(t=>!t.deleted && !t.archived && t.status!=='termine' && t.due);
    const byDay=days.map(d=>{ const iso=toISO(d); return list.filter(t=>t.due===iso); });
    const today=toISO(new Date());
    const fmtRange=days[0].toLocaleDateString('fr-FR',{ day:'numeric', month:'short' })+' — '+days[6].toLocaleDateString('fr-FR',{ day:'numeric', month:'short' });
    root.innerHTML='<div class="week-head"><div class="week-title"><h2>Semaine</h2><span class="week-range"></span></div>'+
      '<div class="week-nav"><button type="button" class="week-nav-btn" id="week-prev">‹ Semaine préc.</button><button type="button" class="week-nav-btn" id="week-today">Cette semaine</button><button type="button" class="week-nav-btn" id="week-next">Semaine suiv. ›</button></div></div>'+
      '<div class="week-grid"></div><p class="modal-hint week-hint">Glisse une carte sur un autre jour pour la replanifier.</p>';
    root.querySelector('.week-range').textContent=fmtRange;
    const grid=root.querySelector('.week-grid');
    days.forEach((d, i)=>{
      const iso=toISO(d);
      const col=document.createElement('div'); col.className='week-col'+(iso===today?' is-today':''); col.dataset.date=iso;
      const head=document.createElement('div'); head.className='week-col-head';
      head.innerHTML='<span class="week-dow">'+DOW[i]+'</span><span class="week-dom">'+d.getDate()+'</span>';
      col.appendChild(head);
      byDay[i].forEach(t=>{
        const card=document.createElement('div'); card.className='week-card'; card.draggable=true; card.dataset.id=t.id;
        const uMeta=URGENCY_META[t.urgency]||URGENCY_META.moyenne;
        card.innerHTML='<span class="week-card-title"></span><span class="week-card-urg"></span><button type="button" class="week-card-focus" title="Focus">●</button>';
        card.querySelector('.week-card-title').textContent=t.title||'(sans titre)';
        const u=card.querySelector('.week-card-urg'); u.textContent=uMeta.label; u.style.color=uMeta.color;
        card.querySelector('.week-card-focus').onclick=e=>{ e.stopPropagation(); if(window.TodoFocus) window.TodoFocus.open(t); };
        card.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', t.id); card.classList.add('dragging'); });
        card.addEventListener('dragend', ()=>card.classList.remove('dragging'));
        card.addEventListener('click', ()=>openWeekTask(t.id));
        col.appendChild(card);
      });
      col.addEventListener('dragover', e=>{ e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', ()=>col.classList.remove('drag-over'));
      col.addEventListener('drop', e=>{
        e.preventDefault(); col.classList.remove('drag-over');
        const id=e.dataTransfer.getData('text/plain'); if(!id) return;
        rescheduleTask(id, iso); renderWeek();
      });
      grid.appendChild(col);
    });
    root.querySelector('#week-prev').onclick=()=>{ weekStart.setDate(weekStart.getDate()-7); renderWeek(); };
    root.querySelector('#week-next').onclick=()=>{ weekStart.setDate(weekStart.getDate()+7); renderWeek(); };
    root.querySelector('#week-today').onclick=()=>{ weekStart=startOfWeek(new Date()); renderWeek(); };
  }
  const api={};
  api.init=function(a){ app=a; };
  api.renderWeek=renderWeek;
  return api;
})();
