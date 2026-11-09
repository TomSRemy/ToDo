// Todo — « Focus » : minuteur sur une seule tâche (loaded before js/app.js). Split out like js/parc.js.
window.TodoFocus=(function(){
  let app=null;   // what this part needs from js/app.js, given once at start-up (init)
  let timer=null, seconds=0, running=false, countUp=false, total=20*60;
  function fmt(s){ s=Math.max(0, Math.round(s)); const m=Math.floor(s/60), r=s%60; return String(m).padStart(2,'0')+':'+String(r).padStart(2,'0'); }
  function open(t){
    let ov=document.getElementById('focus-overlay'); if(ov) ov.remove();
    seconds=0; running=false; countUp=false; total=20*60;
    ov=document.createElement('div'); ov.id='focus-overlay'; ov.className='modal-overlay';
    ov.innerHTML='<div class="modal-box focus-box" role="dialog" aria-labelledby="focus-title">'+
      '<span class="focus-eyebrow">Focus · 1 tâche à la fois</span>'+
      '<h3 id="focus-title" class="focus-task-title"></h3>'+
      '<div class="focus-ring-wrap"><svg width="170" height="170" viewBox="0 0 170 170" class="focus-ring"><circle cx="85" cy="85" r="76" fill="none" stroke="var(--panel-3)" stroke-width="9"/><circle cx="85" cy="85" r="76" fill="none" stroke="var(--accent)" stroke-width="9" stroke-linecap="round" class="focus-ring-progress"/></svg>'+
      '<div class="focus-time"><span class="focus-clock">00:00</span><span class="focus-of"></span></div></div>'+
      '<div class="focus-controls"><button type="button" class="ghost-btn focus-toggle">Démarrer</button><button type="button" class="ghost-btn focus-add5">+5 min</button><button type="button" class="focus-done">Marquer fait</button></div>'+
      '<label class="focus-mode-row"><span>Chronomètre libre sans échéance</span><input type="checkbox" class="focus-countup"></label>'+
      '<button type="button" class="ghost-btn focus-close">Fermer</button></div>';
    document.body.appendChild(ov);
    ov.querySelector('.focus-task-title').textContent=t.title||'(sans titre)';
    const clock=ov.querySelector('.focus-clock'), of=ov.querySelector('.focus-of'), ring=ov.querySelector('.focus-ring-progress'), toggle=ov.querySelector('.focus-toggle'), countupBox=ov.querySelector('.focus-countup');
    const CIRC=2*Math.PI*76;
    ring.style.strokeDasharray=String(CIRC);
    function paint(){
      if(countUp){ clock.textContent=fmt(seconds); of.textContent='chrono libre'; ring.style.strokeDashoffset='0'; }
      else { clock.textContent=fmt(total-seconds); of.textContent='sur '+fmt(total); const pct=Math.min(1, seconds/total); ring.style.strokeDashoffset=String(CIRC*(1-pct)); if(seconds>=total){ pause(); if(window.Notification && Notification.permission==='granted') try{ new Notification('Focus terminé : '+(t.title||'')); }catch(e){} } }
      toggle.textContent=running?'Pause':(seconds?'Reprendre':'Démarrer');
    }
    function tick(){ seconds++; paint(); }
    function play(){ if(running) return; running=true; timer=setInterval(tick,1000); paint(); }
    function pause(){ running=false; if(timer) clearInterval(timer); timer=null; paint(); }
    toggle.onclick=()=>running?pause():play();
    ov.querySelector('.focus-add5').onclick=()=>{ total+=5*60; paint(); };
    countupBox.onchange=()=>{ countUp=countupBox.checked; seconds=0; pause(); };
    ov.querySelector('.focus-done').onclick=()=>{ pause(); close(); if(app && app.validateTask) app.validateTask(t.id); };
    const close=()=>{ pause(); ov.remove(); };
    ov.querySelector('.focus-close').onclick=close;
    ov.addEventListener('click', e=>{ if(e.target===ov) close(); });
    ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } });
    paint();
  }
  const api={};
  api.init=function(a){ app=a; };
  api.open=open;
  return api;
})();
