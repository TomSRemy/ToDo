/* Network view (« Réseau »): every connection between companies, contacts, installations, requests, tasks, meetings,
   contracts and projects, as a force-directed graph on a canvas. No library.
   window.todoNetwork.mount(el, getData, opts) → { refresh(), focus(id) }
   getData() → { nodes:[{ id, type, label, sub, open }], edges:[[idA, idB], …] } */
(function(){
  'use strict';
  const TYPES={
    company:{ label:'Sociétés', color:'#14D3A9', r:7 }, contact:{ label:'Contacts', color:'#7DD3FC', r:4.5 }, installation:{ label:'Installations', color:'#FFD54A', r:5 },
    request:{ label:'Demandes', color:'#F2A541', r:5.5 }, prequal:{ label:'Pré-qualifs', color:'#E8C547', r:4.5 }, task:{ label:'Tâches', color:'#B49CFF', r:3.5 },
    meeting:{ label:'RDV', color:'#9AA8B8', r:3.5 }, contract:{ label:'Contrats', color:'#4F7CFF', r:4.5 }, project:{ label:'Projets', color:'#ED6965', r:6 }, note:{ label:'Notes', color:'#F4A3C8', r:4 }
  };
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

  function mount(root, getData, opts){
    opts=opts||{};
    let hidden=new Set(); try{ hidden=new Set(JSON.parse(localStorage.getItem('network-hidden')||'["meeting"]')); }catch(e){}
    // points put down by hand stay where they were left (shared with the other devices by the sync) until « Libérer les points »
    let pins=new Map(); try{ pins=new Map(Object.entries(JSON.parse(localStorage.getItem('network-pins')||'{}'))); }catch(e){}
    const savePins=()=>{ try{ localStorage.setItem('network-pins', JSON.stringify(Object.fromEntries(pins))); }catch(e){} if(window.todoSettingsChanged) window.todoSettingsChanged(); paintPins(); };
    root.innerHTML='<div class="nw-bar"><div class="nw-search"><input type="text" placeholder="Trouver dans le réseau…" aria-label="Trouver dans le réseau"></div><div class="nw-types"></div>'
      +'<select class="nw-actor" aria-label="Type d’acteur" hidden></select><label class="nw-local" title="Choisis d’abord un point : seuls lui et ce qui y est relié restent affichés"><input type="checkbox" disabled> Seulement ses liens</label><button type="button" class="nw-selmode" aria-pressed="false" title="Glisser pour entourer plusieurs points (ou Maj + glisser)">Sélection</button><button type="button" class="nw-fit" title="Tout réafficher et voir l’ensemble (Échap)">Vue d’ensemble</button></div>'
      +'<p class="nw-explain">Chaque point est une société, un contact, une installation, une tâche… ; un trait relie deux points liés. Clique un point pour voir ses liens, deux fois pour ouvrir sa fiche.</p>'
      +'<div class="nw-stage"><canvas role="img" aria-label="Graphe des connexions. Utilise la recherche pour trouver un élément : ses liens s’affichent dans le panneau."></canvas><div class="nw-tip" hidden></div><div class="nw-side" hidden></div><button type="button" class="nw-unpin" hidden>Libérer les points</button><div class="nw-hint">'+(window.matchMedia && matchMedia('(pointer:coarse)').matches?'Pincer : zoom · glisser : déplacer · toucher : détails · toucher deux fois : la fiche · glisser un point : il reste où tu le poses':'Molette : zoom · glisser : déplacer · clic : détails · double-clic : ouvrir la fiche · glisser un point : il reste où tu le poses')+'</div></div>';
    const canvas=root.querySelector('canvas'), ctx=canvas.getContext('2d'), stage=root.querySelector('.nw-stage'), tip=root.querySelector('.nw-tip'), side=root.querySelector('.nw-side');
    const search=root.querySelector('.nw-search input'), typesBox=root.querySelector('.nw-types'), localBox=root.querySelector('.nw-local input'), unpinBtn=root.querySelector('.nw-unpin'), selBtn=root.querySelector('.nw-selmode'), actorSel=root.querySelector('.nw-actor');
    let actor=''; try{ actor=localStorage.getItem('network-actor')||''; }catch(e){} let actorSet=null;   // the kind of company kept, and what hangs on them
    let nodes=[], edges=[], byId=new Map(), adj=new Map(), pos=new Map();   // positions kept between refreshes
    let view={ x:0, y:0, k:1 }, hover=null, selected=null, alpha=1, raf=0, dpr=1, W=0, H=0, dragging=null, panning=null, moved=false, matches=null, follow=0, typeHover=null, typeFocus=null, multi=new Set(), boxSel=null, groupOff=null;   // multi: points picked with a rectangle (Maj + glisser, or « Sélection »)   // a kind of point put forward (chip hovered, or ◎)

    function visibleSet(){
      let ok=n=>!hidden.has(n.type) && (!actorSet || actorSet.has(n.id));
      if(localBox.checked && selected){ const near=new Set([selected.id]); (adj.get(selected.id)||[]).forEach(i=>{ near.add(i); (adj.get(i)||[]).forEach(j=>{ if(byId.get(j) && byId.get(j).type==='company') near.add(j); }); }); const base=ok; ok=n=>base(n) && near.has(n.id); }
      return ok;
    }
    function build(){
      // settings may have come from the other device: read again
      try{ hidden=new Set(JSON.parse(localStorage.getItem('network-hidden')||'["meeting"]')); }catch(e){} try{ pins=new Map(Object.entries(JSON.parse(localStorage.getItem('network-pins')||'{}'))); }catch(e){}
      const d=getData(); byId=new Map(); adj=new Map(); const fresh=[];
      nodes=d.nodes.map(n=>{ let p=pos.get(n.id); if(!p){ p={ x:0, y:0, vx:0, vy:0, fresh:true }; fresh.push(n.id); } pos.set(n.id,p); const pin=pins.get(n.id); if(pin){ p.x=pin[0]; p.y=pin[1]; } const o=Object.assign({}, n, { p }); byId.set(n.id,o); adj.set(n.id,[]); return o; });
      edges=d.edges.filter(([a,b])=>byId.has(a) && byId.has(b) && a!==b);
      const seen=new Set(); edges=edges.filter(([a,b])=>{ const k=a<b?a+'|'+b:b+'|'+a; if(seen.has(k)) return false; seen.add(k); return true; });
      edges.forEach(([a,b])=>{ adj.get(a).push(b); adj.get(b).push(a); });
      nodes.forEach(n=>{ n.deg=adj.get(n.id).length; n.r=(TYPES[n.type]||TYPES.task).r+Math.min(9, Math.sqrt(n.deg)*1.6); });
      placeFresh(); paintActors(); computeActor();
      if(fresh.length>nodes.length/3){ settle(); setTimeout(fit, 0); }   // first opening: the layout is worked out before it is shown, then framed
      if(selected) selected=byId.get(selected.id)||null;
      paintTypes(); paintPins(); alpha=Math.max(alpha,.6); kick();
      let empty=stage.querySelector('.nw-empty');
      if(!nodes.length){ if(!empty){ empty=document.createElement('div'); empty.className='nw-empty'; empty.innerHTML='Rien à relier pour l’instant.<br>Les sociétés, contacts, opportunités et tâches apparaîtront ici avec leurs liens.'; stage.appendChild(empty); } }
      else if(empty) empty.remove();
    }
    function paintPins(){ const n=[...pins.keys()].filter(id=>byId.has(id)).length; unpinBtn.hidden=!n; unpinBtn.textContent='Libérer les points ('+n+')'; unpinBtn.title='Les points posés à la main reprennent leur place automatique'; }
    function unpin(ids){ (ids||[...pins.keys()]).forEach(id=>pins.delete(id)); savePins(); alpha=Math.max(alpha,.6); if(multi.size) showMulti(); else if(selected) showSide(selected); kick(); }
    unpinBtn.onclick=()=>unpin();
    // new points: the busiest companies on a spiral from the centre, the rest next to what they hang on, lone ones on an outer ring
    function placeFresh(){
      const isNew=n=>n.p.fresh, golden=Math.PI*(3-Math.sqrt(5));
      const hubs=nodes.filter(n=>isNew(n) && n.type==='company').sort((a,b)=>b.deg-a.deg);
      hubs.forEach((n,i)=>{ const r=38*Math.sqrt(i+1), a=i*golden; n.p.x=r*Math.cos(a); n.p.y=r*Math.sin(a); });
      const R=Math.max(160, 38*Math.sqrt(hubs.length+1)+90);
      const lone=nodes.filter(n=>isNew(n) && !n.deg);
      lone.forEach((n,i)=>{ const a=i/Math.max(1,lone.length)*Math.PI*2; n.p.x=R*Math.cos(a); n.p.y=R*Math.sin(a); });
      nodes.filter(n=>isNew(n) && n.type!=='company' && n.deg).forEach(n=>{ const nb=(adj.get(n.id)||[]).map(i=>byId.get(i)).find(m=>m && !isNew(m) || (m && m.type==='company'));
        const a=Math.random()*Math.PI*2, d=30+Math.random()*25; n.p.x=(nb?nb.p.x:0)+d*Math.cos(a); n.p.y=(nb?nb.p.y:0)+d*Math.sin(a); });
      nodes.forEach(n=>{ const pin=pins.get(n.id); if(pin){ n.p.x=pin[0]; n.p.y=pin[1]; } delete n.p.fresh; });
    }
    function settle(){ const t0=performance.now(); alpha=1; let i=0; while(i<300 && alpha>.03 && performance.now()-t0<600){ tick(); i++; } }
    function paintActors(){
      const types=[...new Set(nodes.map(n=>n.ctype).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
      actorSel.hidden=!types.length; if(actor && !types.includes(actor)) actor='';
      actorSel.innerHTML='<option value="">Tous les acteurs</option>'+types.map(t=>'<option value="'+esc(t)+'"'+(t===actor?' selected':'')+'>'+esc(t)+'</option>').join('');
    }
    // the companies of that kind, and what hangs on them (contacts, deals, tasks, and one step further — never through another company)
    function computeActor(){
      if(!actor){ actorSet=null; return; }
      const keep=new Set(), q=[]; nodes.forEach(n=>{ if(n.type==='company' && n.ctype===actor){ keep.add(n.id); q.push([n.id,0]); } });
      while(q.length){ const [id,d]=q.shift(); if(d>=2) continue; (adj.get(id)||[]).forEach(j=>{ const m=byId.get(j); if(!m || keep.has(j) || m.type==='company') return; keep.add(j); q.push([j,d+1]); }); }
      actorSet=keep;
    }
    actorSel.onchange=()=>{ actor=actorSel.value; try{ localStorage.setItem('network-actor', actor); }catch(e){} computeActor(); alpha=Math.max(alpha,.5); kick(); setTimeout(fit, 500); };
    function paintTypes(){
      const count={}; nodes.forEach(n=>{ count[n.type]=(count[n.type]||0)+1; });
      typesBox.innerHTML='';
      Object.keys(TYPES).filter(t=>count[t]).forEach(t=>{ const b=document.createElement('span'); b.className='nw-type'+(hidden.has(t)?' off':'');   // two buttons side by side, not one inside the other (WCAG 4.1.2)
        if(typeFocus===t) b.classList.add('lit');
        b.innerHTML='<button type="button" class="nw-type-main" aria-pressed="'+String(!hidden.has(t))+'"><i style="background:'+TYPES[t].color+'"></i>'+esc(TYPES[t].label)+' <span>'+count[t]+'</span></button><button type="button" class="nw-lit" title="Mettre en avant seulement ce type" aria-label="Mettre en avant les '+esc(TYPES[t].label)+'">◎</button>';
        b.onmouseenter=()=>{ if(!hidden.has(t)){ typeHover=t; kick(); } }; b.onmouseleave=()=>{ typeHover=null; kick(); };
        const lb=b.querySelector('.nw-lit'), litToggle=e=>{ e.stopPropagation(); e.preventDefault(); typeFocus=typeFocus===t?null:t; if(typeFocus && hidden.has(t)){ hidden.delete(t); try{ localStorage.setItem('network-hidden', JSON.stringify([...hidden])); }catch(err){} } paintTypes(); kick(); };
        lb.onclick=litToggle;
        b.querySelector('.nw-type-main').onclick=()=>{ if(typeFocus===t) typeFocus=null; hidden.has(t)?hidden.delete(t):hidden.add(t); try{ localStorage.setItem('network-hidden', JSON.stringify([...hidden])); }catch(e){} if(window.todoSettingsChanged) window.todoSettingsChanged(); paintTypes(); alpha=Math.max(alpha,.5); kick(); };
        typesBox.appendChild(b); });
    }
    // ---- physics: springs on the links, repulsion between all visible nodes (grid-bucketed), a gentle pull to the centre
    function tick(){
      const ok=visibleSet(), vis=nodes.filter(ok), big=vis.length>900, cell=big?120:90, reach=big?1:2, grid=new Map();
      const ox=Math.random()*cell, oy=Math.random()*cell, cx=n=>Math.floor((n.p.x+ox)/cell), cy=n=>Math.floor((n.p.y+oy)/cell);   // the grid moves at every step: no lines along its edges
      vis.forEach(n=>{ const k=cx(n)+','+cy(n); (grid.get(k)||grid.set(k,[]).get(k)).push(n); });
      // repulsion: one by one inside a cell (at most ~60 neighbours), and each nearby cell pushes as one mass from its centre
      const mass=new Map(); grid.forEach((list,k)=>{ let x=0,y=0; list.forEach(m=>{ x+=m.p.x; y+=m.p.y; }); mass.set(k,{ x:x/list.length, y:y/list.length, n:list.length }); });
      const push=(n,x,y,w)=>{ let d2=x*x+y*y; if(d2<1){ x=Math.random()-.5; y=Math.random()-.5; d2=.5; } if(d2>cell*cell*9) return; const f=900*w/d2*.02*alpha; n.p.vx+=x*f; n.p.vy+=y*f; };
      vis.forEach(n=>{ const gx=cx(n), gy=cy(n), own=gx+','+gy, list=grid.get(own), step=Math.max(1, Math.floor(list.length/60));
        for(let i=0;i<list.length;i+=step){ const m=list[i]; if(m!==n) push(n, n.p.x-m.p.x, n.p.y-m.p.y, step); }
        for(let dx=-reach;dx<=reach;dx++) for(let dy=-reach;dy<=reach;dy++){ if(!dx && !dy) continue; const k=(gx+dx)+','+(gy+dy), l2=grid.get(k); if(!l2) continue;
          if(l2.length<=12) l2.forEach(m=>push(n, n.p.x-m.p.x, n.p.y-m.p.y, 1)); else { const c=mass.get(k); push(n, n.p.x-c.x, n.p.y-c.y, c.n); } } });
      edges.forEach(([a,b])=>{ const A=byId.get(a), B=byId.get(b); if(!ok(A)||!ok(B)) return;
        const L=(A.type==='company'||B.type==='company')?60:40, x=B.p.x-A.p.x, y=B.p.y-A.p.y, d=Math.sqrt(x*x+y*y)||1, f=(d-L)/d*.06*alpha*(dragging && (A===dragging||B===dragging)?4:1);   // a point held pulls its neighbours along firmly
        A.p.vx+=x*f; A.p.vy+=y*f; B.p.vx-=x*f; B.p.vy-=y*f; });
      const ring=Math.max(160, 38*Math.sqrt(vis.filter(n=>n.type==='company').length+1)+90);
      vis.forEach(n=>{ if(!n.deg){ const d=Math.hypot(n.p.x,n.p.y)||1, f=(ring-d)/d*.02*alpha; n.p.vx+=n.p.x*f; n.p.vy+=n.p.y*f; } else { n.p.vx-=n.p.x*.0035*alpha; n.p.vy-=n.p.y*.0035*alpha; } if(n===dragging || pins.has(n.id)){ n.p.vx=n.p.vy=0; return; } n.p.vx*=.82; n.p.vy*=.82; n.p.x+=n.p.vx; n.p.y+=n.p.vy; });
      alpha*=big?.97:.985;   // a big graph settles sooner
    }
    const toScreen=(x,y)=>[(x*view.k+view.x)+W/2, (y*view.k+view.y)+H/2];
    const toWorld=(sx,sy)=>[((sx-W/2)-view.x)/view.k, ((sy-H/2)-view.y)/view.k];
    // a colour half way to the grey of the page: the kind stays guessable, nothing shouts
    const greyCache=new Map();
    function greyed(c){ if(greyCache.has(c)) return greyCache.get(c); const m=/^#?([0-9a-f]{6})$/i.exec(c); let out='rgba(120,132,145,.7)';
      if(m){ const v=parseInt(m[1],16), mix=(x,g)=>Math.round(x*.42+g*.58); out='rgba('+mix(v>>16,104)+','+mix((v>>8)&255,116)+','+mix(v&255,128)+',.78)'; }
      greyCache.set(c,out); return out; }
    function draw(){
      const ok=visibleSet(); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
      const focus=hover||(multi.size?null:selected), near=focus?new Set([focus.id, ...(adj.get(focus.id)||[])]):(multi.size?new Set(multi):null), lit=near?null:(typeHover||typeFocus);
      // links: one path per style (drawing them one by one is what makes a big graph slow)
      ctx.lineWidth=1; const pNorm=new Path2D(), pOn=new Path2D();
      edges.forEach(([a,b])=>{ const A=byId.get(a), B=byId.get(b); if(!ok(A)||!ok(B)) return; const on=(near && (focus?(a===focus.id||b===focus.id):(multi.has(a)||multi.has(b)))) || (lit && (A.type===lit||B.type===lit));
        const [x1,y1]=toScreen(A.p.x,A.p.y), [x2,y2]=toScreen(B.p.x,B.p.y); const p=on?pOn:pNorm; p.moveTo(x1,y1); p.lineTo(x2,y2); });
      ctx.strokeStyle=near||lit?'rgba(140,160,180,.09)':'rgba(140,160,180,.16)'; ctx.stroke(pNorm);
      if(near){ ctx.strokeStyle='rgba(20,211,169,.75)'; ctx.stroke(pOn); } else if(lit){ ctx.strokeStyle='rgba(140,160,180,.32)'; ctx.stroke(pOn); }
      // nodes: one path per colour and brightness
      const rest=[], restMin=(()=>{ const ds=nodes.filter(m=>m.type==='company').map(m=>(adj.get(m.id)||[]).length).sort((a,b)=>b-a); return ds.length>20?Math.max(1,ds[19]):0; })();
      const groups=new Map(), labels=[], litCount=lit?nodes.filter(n=>n.type===lit && ok(n)).length:0;
      nodes.forEach(n=>{ if(!ok(n)) return; const [x,y]=toScreen(n.p.x,n.p.y), r=n.r*Math.max(.6,Math.min(1.6,view.k)); if(x<-30||y<-30||x>W+30||y>H+30) return;
        // at rest everything is softly greyed; what is pointed (and its links), searched or put forward lights up in its colour
        const on=near?near.has(n.id):matches?matches.has(n.id):lit?n.type===lit:false, dim=!on, col=(TYPES[n.type]||TYPES.task).color, key=dim?greyed(col):col;
        let g=groups.get(key); if(!g){ g=new Path2D(); groups.set(key,g); } g.moveTo(x+r,y); g.arc(x,y,r,0,Math.PI*2);
        // names only on demand: the point under the mouse (or selected) and its neighbours, search results, the kind put forward
        const showLabel=(near && near.has(n.id)) || (matches && matches.has(n.id)) || (lit===n.type && (litCount<=40 || view.k>1.3));
        if(showLabel && !dim) labels.push([n,x,y,r]);
        // at rest, the main companies are named (cold audit: no point had a name until hovered)
        else if(!near && !matches && !lit && (n.type==='company' || n.type==='project') && ((adj.get(n.id)||[]).length>=restMin || view.k>1.4)) rest.push([n,x,y,r]); });
      groups.forEach((p,key)=>{ ctx.fillStyle=key; ctx.fill(p); });
      ctx.globalAlpha=1;
      if(pins.size){ ctx.strokeStyle='rgba(232,238,245,.55)'; ctx.lineWidth=1; ctx.setLineDash([2,2]); nodes.forEach(n=>{ if(!pins.has(n.id) || !ok(n)) return; const [x,y]=toScreen(n.p.x,n.p.y), r=n.r*Math.max(.6,Math.min(1.6,view.k))+3; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); }); ctx.setLineDash([]); }
      if(multi.size){ ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; multi.forEach(id=>{ const n=byId.get(id); if(!n || !ok(n)) return; const [x,y]=toScreen(n.p.x,n.p.y), r=n.r*Math.max(.6,Math.min(1.6,view.k))+1; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); }); ctx.lineWidth=1; }
      if(boxSel){ const x=Math.min(boxSel.sx,boxSel.ex), y=Math.min(boxSel.sy,boxSel.ey); ctx.fillStyle='rgba(20,211,169,.08)'; ctx.strokeStyle='rgba(20,211,169,.8)'; ctx.setLineDash([4,3]); ctx.fillRect(x,y,Math.abs(boxSel.ex-boxSel.sx),Math.abs(boxSel.ey-boxSel.sy)); ctx.strokeRect(x,y,Math.abs(boxSel.ex-boxSel.sx),Math.abs(boxSel.ey-boxSel.sy)); ctx.setLineDash([]); }
      if(selected && !multi.size && ok(selected)){ const [x,y]=toScreen(selected.p.x,selected.p.y), r=selected.r*Math.max(.6,Math.min(1.6,view.k)); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); ctx.lineWidth=1; }
      ctx.fillStyle='rgba(174,182,194,.85)'; ctx.font='11px system-ui, sans-serif';
      rest.forEach(([n,x,y,r])=>{ ctx.fillText(n.label.length>24?n.label.slice(0,23)+'…':n.label, x+r+3, y+4); });
      ctx.fillStyle='rgba(232,238,245,.92)';
      labels.forEach(([n,x,y,r])=>{ ctx.font=(n.type==='company'||n.type==='project'?'600 ':'')+'11px system-ui, sans-serif'; ctx.fillText(n.label.length>34?n.label.slice(0,33)+'…':n.label, x+r+3, y+4); });
    }
    // the selected point in the middle of the free space (left of the side panel); followed while the layout settles
    function centerOn(n){ const below=!side.hidden && side.offsetLeft<40;   // phone: the panel lies across the bottom
      const ox=side.hidden||below?0:-(side.offsetWidth+12)/2, oy=below?-(side.offsetHeight+12)/2:0; view.x=-n.p.x*view.k+ox; view.y=-n.p.y*view.k+oy; }
    function loop(){ raf=0; if(alpha>.02 || dragging) tick(); if(follow && selected && !panning && !dragging && performance.now()<follow) centerOn(selected); draw(); if(alpha>.02 || dragging) raf=requestAnimationFrame(loop); }
    function kick(){ if(!raf) raf=requestAnimationFrame(loop); }
    function resize(){ const r=stage.getBoundingClientRect(); dpr=window.devicePixelRatio||1; W=r.width; H=r.height; canvas.width=W*dpr; canvas.height=H*dpr; canvas.style.width=W+'px'; canvas.style.height=H+'px'; kick(); }
    function nodeAt(sx,sy,finger){ const ok=visibleSet(); let best=null, bd=1e9; nodes.forEach(n=>{ if(!ok(n)) return; const [x,y]=toScreen(n.p.x,n.p.y), d=(x-sx)**2+(y-sy)**2, r=Math.max(finger?18:8,n.r*view.k+4); if(d<r*r && d<bd){ bd=d; best=n; } }); return best; }
    function fit(){ follow=0;
      const ok=visibleSet(), vis=nodes.filter(ok); if(!vis.length) return;
      let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; vis.forEach(n=>{ x0=Math.min(x0,n.p.x); y0=Math.min(y0,n.p.y); x1=Math.max(x1,n.p.x); y1=Math.max(y1,n.p.y); });
      view.k=Math.max(.25, Math.min(2.2, Math.min(W/((x1-x0)||1), H/((y1-y0)||1))*.85)); view.x=-(x0+x1)/2*view.k; view.y=-(y0+y1)/2*view.k; kick();
    }
    // a few lines of the sheet (given by the app) under the name
    function infoHtml(n, max){ let L=[]; try{ L=(window.todoNetworkInfo?window.todoNetworkInfo(n.id, n.label):[])||[]; }catch(e){}
      return L.length?'<div class="nw-info">'+L.slice(0,max).map(([k,v])=>'<div><span>'+esc(k||'')+'</span><span>'+esc(v||'')+'</span></div>').join('')+'</div>':''; }
    function showMulti(){
      if(!multi.size){ side.hidden=true; return; }
      const list=[...multi].map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>a.type.localeCompare(b.type)||a.label.localeCompare(b.label,'fr'));
      const groups={}; list.forEach(m=>{ (groups[m.type]=groups[m.type]||[]).push(m); });
      const anyPinned=list.some(m=>pins.has(m.id));
      side.innerHTML='<button type="button" class="nw-x" aria-label="Fermer">×</button><div class="nw-kind">Sélection</div><h3>'+list.length+' point'+(list.length>1?'s':'')+' sélectionné'+(list.length>1?'s':'')+'</h3>'
        +'<p class="nw-sub">Glisse l’un d’eux pour déplacer tout le groupe.</p>'+(anyPinned?'<button type="button" class="nw-unpin-one nw-unpin-sel">Libérer ces points</button>':'')
        +Object.keys(groups).map(t=>'<div class="nw-g">'+esc((TYPES[t]||{}).label||t)+' · '+groups[t].length+'</div>'+groups[t].slice(0,40).map(m=>'<button type="button" class="nw-n" data-id="'+esc(m.id)+'"><i style="background:'+(TYPES[m.type]||{}).color+'"></i>'+esc(m.label)+'</button>').join('')+(groups[t].length>40?'<div class="nw-more">+ '+(groups[t].length-40)+'</div>':'')).join('');
      side.hidden=false;
      side.querySelector('.nw-x').onclick=()=>{ multi.clear(); showSide(null); kick(); };
      const u=side.querySelector('.nw-unpin-sel'); if(u) u.onclick=()=>unpin(list.map(m=>m.id).filter(id=>pins.has(id)));
      side.querySelectorAll('.nw-n').forEach(b=>b.onclick=()=>{ multi.clear(); focus(b.dataset.id); });
    }
    function showSide(n){
      localBox.disabled=!n; if(!n && localBox.checked){ localBox.checked=false; alpha=Math.max(alpha,.3); }
      if(!n){ side.hidden=true; return; }
      const neigh=(adj.get(n.id)||[]).map(i=>byId.get(i)).filter(Boolean).sort((a,b)=>a.type.localeCompare(b.type)||a.label.localeCompare(b.label,'fr'));
      const groups={}; neigh.forEach(m=>{ (groups[m.type]=groups[m.type]||[]).push(m); });
      side.innerHTML='<button type="button" class="nw-x" aria-label="Fermer">×</button><div class="nw-kind" style="color:'+(TYPES[n.type]||{}).color+'">'+esc((TYPES[n.type]||{}).label||'')+'</div><h3>'+esc(n.label)+'</h3>'
        +(n.sub?'<p class="nw-sub">'+esc(n.sub)+'</p>':'')+infoHtml(n, 12)+(n.open?'<button type="button" class="nw-open">Ouvrir la fiche</button>':'')
        +'<div class="nw-count">'+neigh.length+' lien'+(neigh.length>1?'s':'')+'</div>'
        +Object.keys(groups).map(t=>'<div class="nw-g">'+esc((TYPES[t]||{}).label||t)+'</div>'+groups[t].slice(0,40).map(m=>'<button type="button" class="nw-n" data-id="'+esc(m.id)+'"><i style="background:'+(TYPES[m.type]||{}).color+'"></i>'+esc(m.label)+'</button>').join('')+(groups[t].length>40?'<div class="nw-more">+ '+(groups[t].length-40)+'</div>':'')).join('');
      side.hidden=false;
      side.querySelector('.nw-x').onclick=()=>{ selected=null; showSide(null); kick(); };
      const ob=side.querySelector('.nw-open'); if(ob) ob.onclick=()=>n.open();
      if(pins.has(n.id)){ const u=document.createElement('button'); u.type='button'; u.className='nw-unpin-one'; u.textContent='Libérer ce point'; u.onclick=()=>unpin([n.id]); side.querySelector('.nw-count').before(u); }
      side.querySelectorAll('.nw-n').forEach(b=>b.onclick=()=>focus(b.dataset.id));
    }
    function focus(id, o){
      const n=byId.get(id); if(!n) return;
      if(hidden.has(n.type)){ hidden.delete(n.type); paintTypes(); }
      selected=n; showSide(n);
      if(o && o.local){ localBox.checked=true; alpha=Math.max(alpha,.5); setTimeout(fit, 500); }   // from a sheet: its neighbourhood first
      if(view.k<1) view.k=1.1;   // zoom first, then centre (the other way round put the point off-centre)
      centerOn(n); follow=o && o.local?0:performance.now()+2000; kick();
    }
    // ---- interactions
    canvas.addEventListener('wheel', e=>{ e.preventDefault(); follow=0; const r=canvas.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top, [wx,wy]=toWorld(sx,sy);
      view.k=Math.max(.15, Math.min(4, view.k*(e.deltaY<0?1.12:1/1.12))); view.x=(sx-W/2)-wx*view.k; view.y=(sy-H/2)-wy*view.k; kick(); }, { passive:false });
    // touch: two fingers pinch to zoom, a double tap opens the sheet
    const touches=new Map(); let pinch=null, lastTap={ id:null, t:0 };
    const pinchState=()=>{ const [a,b]=[...touches.values()]; return { d:Math.hypot(a.x-b.x, a.y-b.y)||1, mx:(a.x+b.x)/2, my:(a.y+b.y)/2 }; };
    canvas.addEventListener('pointerdown', e=>{ follow=0; const r=canvas.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top;
      touches.set(e.pointerId, { x:sx, y:sy });
      if(touches.size===2){ dragging=null; panning=null; moved=true; const p=pinchState(), [wx,wy]=toWorld(p.mx,p.my); pinch={ d:p.d, k:view.k, wx, wy }; return; }
      const n=nodeAt(sx,sy,e.pointerType==='touch'); moved=false; canvas.setPointerCapture(e.pointerId);
      if(n){ dragging=n; hover=n; alpha=Math.max(alpha,.3); canvas.style.cursor='grabbing'; tip.hidden=true;
        groupOff=multi.has(n.id) && multi.size>1?[...multi].map(id=>byId.get(id)).filter(Boolean).map(m=>[m, m.p.x-n.p.x, m.p.y-n.p.y]):null; }   // a picked point drags its whole group
      else if(e.shiftKey || selBtn.getAttribute('aria-pressed')==='true') boxSel={ sx, sy, ex:sx, ey:sy, add:e.shiftKey && multi.size>0 };
      else panning={ sx, sy, x:view.x, y:view.y }; kick(); });
    canvas.addEventListener('pointermove', e=>{ const r=canvas.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top;
      if(touches.has(e.pointerId)) touches.set(e.pointerId, { x:sx, y:sy });
      if(pinch && touches.size>=2){ const p=pinchState(); view.k=Math.max(.15, Math.min(4, pinch.k*p.d/pinch.d)); view.x=(p.mx-W/2)-pinch.wx*view.k; view.y=(p.my-H/2)-pinch.wy*view.k; kick(); return; }
      if(e.pointerType==='touch' && !dragging && !panning && !boxSel) return;
      if(boxSel){ boxSel.ex=sx; boxSel.ey=sy; if(Math.abs(sx-boxSel.sx)+Math.abs(sy-boxSel.sy)>3) moved=true; kick(); return; }
      // like Obsidian: the point follows the mouse, its links light up and pull its neighbours along (the layout stays « warm » while held)
      if(dragging){ const [wx,wy]=toWorld(sx,sy); dragging.p.x=wx; dragging.p.y=wy; dragging.p.vx=dragging.p.vy=0; if(groupOff) groupOff.forEach(([m,dx,dy])=>{ m.p.x=wx+dx; m.p.y=wy+dy; m.p.vx=m.p.vy=0; }); moved=true; hover=dragging; tip.hidden=true; alpha=Math.max(alpha,.3); kick(); return; }
      if(panning){ view.x=panning.x+(sx-panning.sx); view.y=panning.y+(sy-panning.sy); if(Math.abs(sx-panning.sx)+Math.abs(sy-panning.sy)>3) moved=true; kick(); return; }
      const n=nodeAt(sx,sy); if(n!==hover){ hover=n; kick(); }
      canvas.style.cursor=n?'pointer':'grab';
      if(n){ tip.hidden=false; tip.innerHTML='<b>'+esc(n.label)+'</b>'+(n.sub?'<span>'+esc(n.sub)+'</span>':'')+infoHtml(n, 4); tip.style.left=Math.min(W-290, sx+14)+'px'; tip.style.top=(sy+14)+'px'; } else tip.hidden=true; });
    const endTouch=e=>{ touches.delete(e.pointerId); if(pinch){ if(touches.size<2) pinch=null; dragging=null; panning=null; return true; } return false; };
    canvas.addEventListener('pointercancel', e=>{ endTouch(e); dragging=null; panning=null; });
    canvas.addEventListener('pointerup', e=>{ if(endTouch(e)) return; const r=canvas.getBoundingClientRect(), n=nodeAt(e.clientX-r.left, e.clientY-r.top, e.pointerType==='touch');
      if(boxSel){ const b=boxSel; boxSel=null; if(moved){ const x1=Math.min(b.sx,b.ex), x2=Math.max(b.sx,b.ex), y1=Math.min(b.sy,b.ey), y2=Math.max(b.sy,b.ey), ok=visibleSet();
          if(!b.add) multi.clear(); nodes.forEach(m=>{ if(!ok(m)) return; const [x,y]=toScreen(m.p.x,m.p.y); if(x>=x1 && x<=x2 && y>=y1 && y<=y2) multi.add(m.id); });
          selected=null; showMulti(); kick(); return; } }
      if(!moved){ if(multi.size){ multi.clear(); } selected=n||null; showSide(selected); if(localBox.checked) { alpha=Math.max(alpha,.4); } kick();
        if(e.pointerType==='touch' && n){ const now=Date.now(); if(lastTap.id===n.id && now-lastTap.t<400){ lastTap={ id:null, t:0 }; if(n.open) n.open(); } else lastTap={ id:n.id, t:now }; } }
      if(dragging && moved){ (groupOff?groupOff.map(g=>g[0]):[dragging]).forEach(m=>pins.set(m.id, [Math.round(m.p.x), Math.round(m.p.y)])); groupOff=null; savePins(); if(multi.size) showMulti(); alpha=Math.max(alpha,.25); if(selected===dragging) showSide(selected); }   // let go: it stays there, its neighbours settle around it
      dragging=null; panning=null; canvas.style.cursor=n?'pointer':'grab'; kick(); });
    canvas.addEventListener('pointerleave', ()=>{ if(!dragging) hover=null; tip.hidden=true; kick(); });
    canvas.addEventListener('dblclick', e=>{ const r=canvas.getBoundingClientRect(), n=nodeAt(e.clientX-r.left, e.clientY-r.top); if(n && n.open) n.open(); });
    search.addEventListener('input', ()=>{ const q=fold(search.value.trim()); matches=q?new Set(nodes.filter(n=>fold(n.label+' '+(n.sub||'')).includes(q)).map(n=>n.id)):null; kick(); });
    search.addEventListener('keydown', e=>{ if(e.key==='Enter' && matches && matches.size){ const first=nodes.find(n=>matches.has(n.id) && visibleSet()(n)) || nodes.find(n=>matches.has(n.id)); if(first) focus(first.id); } });
    localBox.addEventListener('change', ()=>{ alpha=Math.max(alpha,.5); kick(); setTimeout(fit, 600); });
    // back to the whole picture: selection, search, « seulement ses liens » and the kind put forward all cleared
    function overview(){ actor=''; actorSel.value=''; try{ localStorage.setItem('network-actor',''); }catch(e){} computeActor(); selected=null; multi.clear(); hover=null; search.value=''; matches=null; localBox.checked=false; typeFocus=null; typeHover=null; boxSel=null; showSide(null); paintTypes(); alpha=Math.max(alpha,.3); kick(); setTimeout(fit, 60); }
    root.querySelector('.nw-fit').onclick=overview;
    selBtn.onclick=()=>{ const on=selBtn.getAttribute('aria-pressed')!=='true'; selBtn.setAttribute('aria-pressed', String(on)); selBtn.classList.toggle('on', on); canvas.style.cursor=on?'crosshair':'grab'; };
    document.addEventListener('keydown', e=>{ if(e.key!=='Escape' || !root.offsetParent || document.querySelector('.modal-overlay:not(.hidden)')) return; if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target!==search) return; if(multi.size){ multi.clear(); showSide(selected); kick(); } else overview(); });
    new ResizeObserver(resize).observe(stage);
    resize(); build();
    let first=true; setTimeout(()=>{ if(first){ fit(); first=false; } }, 900);
    return { refresh:build, focus, fit, _pos:id=>{ const n=byId.get(id); return n?toScreen(n.p.x,n.p.y):null; }, _state:()=>({ multi:[...multi], k:Math.round(view.k*100)/100, lit:typeHover||typeFocus, nodes:nodes.length, edges:edges.length, selected:selected&&selected.id, visible:nodes.filter(visibleSet()).length }) };
  }
  window.todoNetwork={ mount, TYPES };
})();
