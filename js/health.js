// Todo — the app's health : the error log (this device, and the team's when signed in) and the keyboard focus given
// back when a window closes. Split out of js/app.js (code audit). Loaded before js/app.js.
window.TodoHealth=(function(){
  const api={};
  api.init=function(app){
    const { $, lsGet, lsSet, notify }=app, gsTab=(...a)=>app.gsTab(...a);
    // ---------- error log : the last 50 kept on this device (Réglages › Journal des erreurs), and sent to the team base
    // when signed in, so that a problem on a colleague's computer doesn't go unnoticed. Never the data itself : the place,
    // the message and the first lines of the stack.
    const ERR_KEY='error-log', ERR_MAX=50; let errSent=0; const errSeen={};
    function errRow(where, e){
      const message=String(e && (e.message||e.reason&&e.reason.message) || e || '').slice(0,300); if(!message) return null;
      const stack=String(e && e.stack || '').split('\n').slice(0,6).join('\n').slice(0,800);
      return { at:Date.now(), where:String(where||'').slice(0,80), message, stack, version:(document.querySelector('meta[name=app-version]')||{}).content||'' };
    }
    const teamOn=()=>!!(window.TodoTeam && window.TodoTeam.isSignedIn && window.TodoTeam.isSignedIn());
    function logError(where, e){
      try{
        const row=errRow(where, e); if(!row) return;
        let list=[]; try{ list=JSON.parse(localStorage.getItem(ERR_KEY)||'[]'); }catch(e2){}
        list.unshift(row); localStorage.setItem(ERR_KEY, JSON.stringify(list.slice(0, ERR_MAX)));
        const k=row.where+'|'+row.message;   // the same error sent once per 10 minutes, at most 20 per session
        if(teamOn() && errSent<20 && !(errSeen[k]>Date.now()-6e5)){ errSeen[k]=Date.now(); errSent++; window.TodoTeam.reportError(row).catch(()=>{}); }
        if($('errlog-section') && !$('tab-lists').classList.contains('hidden')) paintErrorLog();
      }catch(e3){}
    }
    // ---------- keyboard : closing a window gives the focus back to what opened it (instead of the top of the page) ----------
    { const OV='.modal-overlay, #gs-overlay, #mkc-overlay, #contact-form, .crm-form';
      let back=null;
      document.addEventListener('focusin', e=>{ if(!e.target.closest(OV)) back=e.target; });
      const giveBack=()=>{ const a=document.activeElement, lost=!a || a===document.body || a.offsetParent===null;   // nothing focused, or the focus left inside a window now hidden
        if(back && document.contains(back) && lost && back.offsetParent!==null) back.focus({ preventScroll:true }); };
      new MutationObserver(ms=>{ if(ms.some(m=>(m.type==='childList' && [...m.removedNodes].some(n=>n.nodeType===1 && n.matches && n.matches(OV))) || (m.type==='attributes' && m.target.matches && m.target.matches(OV)))) setTimeout(giveBack, 0); })
        .observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['class','hidden'] }); }
    window.addEventListener('error', ev=>logError('page', ev.error || ev.message));
    window.addEventListener('unhandledrejection', ev=>logError('promesse', ev.reason));
    // the team's errors (signed in) : the last 7 days in Réglages, and once a day a word when new ones came in
    const ERR_SEEN_KEY='team-errors-seen';
    async function paintTeamErrors(){
      const wrap=$('errlog-team'), box=$('errlog-team-list'); if(!wrap || !teamOn()) { if(wrap) wrap.hidden=true; return; }
      wrap.hidden=false; box.innerHTML='<p class="hist-empty">Chargement…</p>';
      try{
        const rows=await window.TodoTeam.teamErrors(Date.now()-7*864e5, 50)||[];
        lsSet(ERR_SEEN_KEY, String(Date.now()));
        if(!rows.length){ box.innerHTML='<p class="hist-empty">Aucune erreur chez l\u2019équipe cette semaine.</p>'; return; }
        // the same error grouped : how many times, by whom, the last time
        const by=new Map(); rows.forEach(r=>{ const k=r.where_+'|'+r.message; const g=by.get(k)||{ r, n:0, who:new Set() }; g.n++; g.who.add(r.who); by.set(k, g); });
        box.innerHTML='';
        [...by.values()].forEach(g=>{ const d=document.createElement('div'); d.className='hist-row';
          d.innerHTML='<span class="hw"></span><span class="ht"></span><span class="hd"></span>';
          d.querySelector('.hw').textContent=[...g.who].join(', '); d.querySelector('.ht').textContent=(g.n>1?g.n+' × ':'')+'['+g.r.where_+'] '+g.r.message;
          d.querySelector('.hd').textContent=new Date(g.r.at).toLocaleString('fr-FR',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
          box.appendChild(d); });
      }catch(e){ box.innerHTML='<p class="hist-empty">Erreurs de l\u2019équipe indisponibles (hors ligne ?).</p>'; }
    }
    async function teamErrorsNotice(){
      if(!teamOn()) return;
      const seen=Number(lsGet(ERR_SEEN_KEY)||0), asked=Number(lsGet('team-errors-asked')||0);
      if(Date.now()-asked<864e5) return; lsSet('team-errors-asked', String(Date.now()));   // once a day at most
      try{ const rows=await window.TodoTeam.teamErrors(Math.max(seen, Date.now()-7*864e5), 50)||[]; const others=rows.filter(r=>r.who!=='Toi');
        if(others.length) notify(others.length+' erreur'+(others.length>1?'s':'')+' chez l\u2019équipe depuis ta dernière visite', { label:'Voir', fn:()=>{ gsTab('lists'); setTimeout(()=>{ const el=$('errlog-section'); if(el) el.scrollIntoView({ behavior:'smooth', block:'start' }); }, 80); } });
      }catch(e){}
    }
    function paintErrorLog(){
      const box=$('errlog-list'); if(!box) return;
      let list=[]; try{ list=JSON.parse(localStorage.getItem(ERR_KEY)||'[]'); }catch(e){}
      box.innerHTML=list.length?'':'<p class="hist-empty">Aucune erreur enregistrée sur cet appareil.</p>';
      list.slice(0,20).forEach(r=>{ const d=document.createElement('div'); d.className='hist-row';
        d.innerHTML='<span class="hw"></span><span class="ht"></span><span class="hd"></span>';
        d.querySelector('.hw').textContent=r.where; d.querySelector('.ht').textContent=r.message; d.querySelector('.hd').textContent=new Date(r.at).toLocaleString('fr-FR',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        box.appendChild(d); });
    }
    Object.assign(api, { logError, paintErrorLog, paintTeamErrors, teamErrorsNotice });
  };
  return api;
})();
