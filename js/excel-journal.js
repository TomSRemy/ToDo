// Todo — « qui a modifié quoi » in the shared Excel files : the Excel bridge (v1.34) signs each cell it writes and keeps
// the line in « Journal ToDo » next to the Pipe (one file per person) ; a pipeline sheet shows those lines, and Réglages
// sets the name written there. Loaded before js/app.js.
window.TodoJournal=(function(){
  const api={};
  api.init=function(app){
    const { $, bridgeCall, bridgeConfigured, bridgeInfo, notify }=app;
    const ready=()=>{ const i=bridgeInfo(); return bridgeConfigured() && !!i && !!i.authorized && !!i.who; };   // a bridge that knows the journal (v1.34+)
    const when=iso=>{ const d=new Date(iso); return isNaN(d) ? '' : d.toLocaleString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); };
    const cut=v=>{ const t=String(v==null?'':v); return !t ? '(vide)' : t.length>60 ? t.slice(0,57)+'…' : t; };
    function row(r){
      const line=document.createElement('div'); line.className='hist-row';
      line.innerHTML='<span class="hw"></span><span class="ht"></span><span class="hd"></span>';
      line.querySelector('.hw').textContent=r.who||'?';
      line.querySelector('.ht').textContent=(r.file?r.file+' · ':'')+(r.column||'')+' : '+cut(r.old)+' → '+cut(r.new);
      line.querySelector('.hd').textContent=when(r.at);
      line.title=r.why||'';
      return line;
    }
    // the sheet's Excel history : « Producteur / Centrale », as the bridge names the row
    function block(o){
      if(!ready() || !o || !(o.producteur||o.company) || !o.centrale) return null;
      const key=(o.producteur||o.company)+' / '+o.centrale;
      const d=document.createElement('details'); d.className='hist-block';
      d.innerHTML='<summary>Historique Excel (qui a écrit quoi dans le Pipe et le Suivi)</summary><div class="hist-rows"><p class="hist-empty">Chargement…</p></div>';
      let done=false;
      d.addEventListener('toggle', async ()=>{ if(!d.open || done) return; done=true; const box=d.querySelector('.hist-rows');
        try{
          const r=await bridgeCall('POST', '/journal/read', { key, limit:60 }, 15000);
          if(!r.rows.length){ box.innerHTML='<p class="hist-empty">Rien d’écrit par le pont pour cette centrale dans le journal de l’équipe.</p>'; return; }
          box.innerHTML=''; r.rows.forEach(x=>box.appendChild(row(x)));
        }catch(e){ box.innerHTML=''; const p=document.createElement('p'); p.className='hist-empty'; p.textContent='Journal indisponible : '+(e&&e.message||e); box.appendChild(p); }
      });
      return d;
    }
    // Réglages › Pont Excel : the name signed in the journal
    function paintName(){
      const box=$('bridge-who-row'); if(!box) return;
      const i=bridgeInfo(); box.hidden=!ready(); if(box.hidden) return;
      const inp=$('bridge-who'); if(document.activeElement!==inp) inp.value=i.who||'';
    }
    async function saveName(){
      const v=$('bridge-who').value.trim(); if(!v) return;
      try{ const r=await bridgeCall('POST', '/journal/name', { name:v }); const i=bridgeInfo(); if(i) i.who=r.who; notify('Ton nom dans le journal de l’équipe : '+r.who+'.'); }
      catch(e){ notify('Nom non enregistré : '+(e&&e.message||e)); }
    }
    if($('bridge-who-save')) $('bridge-who-save').onclick=saveName;
    Object.assign(api, { block, paintName });
  };
  return api;
})();
