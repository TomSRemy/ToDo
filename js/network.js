/* Network view (« Réseau »): every connection between companies, contacts, installations, requests, tasks, meetings,
   contracts and projects, as a force-directed graph on a canvas. No library.
   window.todoNetwork.mount(el, getData, opts) → { refresh(), focus(id) }
   getData() → { nodes:[{ id, type, label, sub, open }], edges:[[idA, idB], …] } */
(function(){
  'use strict';
  const TYPES={
    company:{ label:'Sociétés', color:'#14D3A9', r:7 }, contact:{ label:'Contacts', color:'#7DD3FC', r:4.5 }, installation:{ label:'Installations', color:'#FFD54A', r:5 },
    request:{ label:'Demandes', color:'#F2A541', r:5.5 }, prequal:{ label:'Pré-qualifs', color:'#E8C547', r:4.5 }, task:{ label:'Tâches', color:'#B49CFF', r:3.5 },
    meeting:{ label:'RDV', color:'#9AA8B8', r:3.5 }, contract:{ label:'Contrats', color:'#6FCF97', r:4.5 }, project:{ label:'Projets', color:'#ED6965', r:6 }, note:{ label:'Notes', color:'#F4A3C8', r:4 }
  };
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

  function mount(root, getData, opts){
    opts=opts||{};
    let hidden=new Set(); try{ hidden=new Set(JSON.parse(localStorage.getItem('network-hidden')||'["meeting"]')); }catch(e){}
    root.innerHTML='<div class="nw-bar"><div class="nw-search"><input type="text" placeholder="Trouver dans le réseau…" aria-label="Trouver dans le réseau"></div><div class="nw-types"></div>'
      +'<label class="nw-local"><input type="checkbox"> Voisinage seulement</label><button type="button" class="nw-fit">Recentrer</button></div>'
      +'<div class="nw-stage"><canvas role="img" aria-label="Graphe des connexions. Utilise la recherche pour trouver un élément : ses liens s’affichent dans le panneau."></canvas><div class="nw-tip" hidden></div><div class="nw-side" hidden></div><div class="nw-hint">Molette : zoom · glisser : déplacer · clic : détails · double-clic : ouvrir la fiche</div></div>';
    const canvas=root.querySelector('canvas'), ctx=canvas.getContext('2d'), stage=root.querySelector('.nw-stage'), tip=root.querySelector('.nw-tip'), side=root.querySelector('.nw-side');
    const search=root.querySelector('.nw-search input'), typesBox=root.querySelector('.nw-types'), localBox=root.querySelector('.nw-local input');
    let nodes=[], edges=[], byId=new Map(), adj=new Map(), pos=new Map();   // positions kept between refreshes
    let view={ x:0, y:0, k:1 }, hover=null, selected=null, alpha=1, raf=0, dpr=1, W=0, H=0, dragging=null, panning=null, moved=false, matches=null;

    function visibleSet(){
      let ok=n=>!hidden.has(n.type);
      if(localBox.checked && selected){ const near=new Set([selected.id]); (adj.get(selected.id)||[]).forEach(i=>{ near.add(i); (adj.get(i)||[]).forEach(j=>{ if(byId.get(j) && byId.get(j).type==='company') near.add(j); }); }); const base=ok; ok=n=>base(n) && near.has(n.id); }
      return ok;
    }
    function build(){
      const d=getData(); byId=new Map(); adj=new Map();
      nodes=d.nodes.map(n=>{ const p=pos.get(n.id)||{ x:(Math.random()-.5)*600, y:(Math.random()-.5)*600, vx:0, vy:0 }; pos.set(n.id,p); const o=Object.assign({}, n, { p }); byId.set(n.id,o); adj.set(n.id,[]); return o; });
      edges=d.edges.filter(([a,b])=>byId.has(a) && byId.has(b) && a!==b);
      const seen=new Set(); edges=edges.filter(([a,b])=>{ const k=a<b?a+'|'+b:b+'|'+a; if(seen.has(k)) return false; seen.add(k); return true; });
      edges.forEach(([a,b])=>{ adj.get(a).push(b); adj.get(b).push(a); });
      nodes.forEach(n=>{ n.deg=adj.get(n.id).length; n.r=(TYPES[n.type]||TYPES.task).r+Math.min(9, Math.sqrt(n.deg)*1.6); });
      if(selected) selected=byId.get(selected.id)||null;
      paintTypes(); alpha=Math.max(alpha,.6); kick();
      let empty=stage.querySelector('.nw-empty');
      if(!nodes.length){ if(!empty){ empty=document.createElement('div'); empty.className='nw-empty'; empty.innerHTML='Rien à relier pour l’instant.<br>Les sociétés, contacts, opportunités et tâches apparaîtront ici avec leurs liens.'; stage.appendChild(empty); } }
      else if(empty) empty.remove();
    }
    function paintTypes(){
      const count={}; nodes.forEach(n=>{ count[n.type]=(count[n.type]||0)+1; });
      typesBox.innerHTML='';
      Object.keys(TYPES).filter(t=>count[t]).forEach(t=>{ const b=document.createElement('button'); b.type='button'; b.className='nw-type'+(hidden.has(t)?' off':''); b.setAttribute('aria-pressed', String(!hidden.has(t)));
        b.innerHTML='<i style="background:'+TYPES[t].color+'"></i>'+esc(TYPES[t].label)+' <span>'+count[t]+'</span>';
        b.onclick=()=>{ hidden.has(t)?hidden.delete(t):hidden.add(t); try{ localStorage.setItem('network-hidden', JSON.stringify([...hidden])); }catch(e){} paintTypes(); alpha=Math.max(alpha,.5); kick(); };
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
        const L=(A.type==='company'||B.type==='company')?60:40, x=B.p.x-A.p.x, y=B.p.y-A.p.y, d=Math.sqrt(x*x+y*y)||1, f=(d-L)/d*.06*alpha;
        A.p.vx+=x*f; A.p.vy+=y*f; B.p.vx-=x*f; B.p.vy-=y*f; });
      vis.forEach(n=>{ n.p.vx-=n.p.x*.0025*alpha; n.p.vy-=n.p.y*.0025*alpha; if(n===dragging) return; n.p.vx*=.82; n.p.vy*=.82; n.p.x+=n.p.vx; n.p.y+=n.p.vy; });
      alpha*=big?.97:.985;   // a big graph settles sooner
    }
    const toScreen=(x,y)=>[(x*view.k+view.x)+W/2, (y*view.k+view.y)+H/2];
    const toWorld=(sx,sy)=>[((sx-W/2)-view.x)/view.k, ((sy-H/2)-view.y)/view.k];
    function draw(){
      const ok=visibleSet(); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
      const focus=hover||selected, near=focus?new Set([focus.id, ...(adj.get(focus.id)||[])]):null;
      // links: one path per style (drawing them one by one is what makes a big graph slow)
      ctx.lineWidth=1; const pNorm=new Path2D(), pOn=new Path2D();
      edges.forEach(([a,b])=>{ const A=byId.get(a), B=byId.get(b); if(!ok(A)||!ok(B)) return; const on=near && (a===focus.id||b===focus.id);
        const [x1,y1]=toScreen(A.p.x,A.p.y), [x2,y2]=toScreen(B.p.x,B.p.y); const p=on?pOn:pNorm; p.moveTo(x1,y1); p.lineTo(x2,y2); });
      ctx.strokeStyle=near?'rgba(140,160,180,.07)':'rgba(140,160,180,.22)'; ctx.stroke(pNorm);
      if(near){ ctx.strokeStyle='rgba(20,211,169,.75)'; ctx.stroke(pOn); }
      // nodes: one path per colour and brightness
      const groups=new Map(), labels=[];
      nodes.forEach(n=>{ if(!ok(n)) return; const [x,y]=toScreen(n.p.x,n.p.y), r=n.r*Math.max(.6,Math.min(1.6,view.k)); if(x<-30||y<-30||x>W+30||y>H+30) return;
        const dim=(near && !near.has(n.id)) || (matches && !matches.has(n.id)), key=(TYPES[n.type]||TYPES.task).color+(dim?'|d':'');
        let g=groups.get(key); if(!g){ g=new Path2D(); groups.set(key,g); } g.moveTo(x+r,y); g.arc(x,y,r,0,Math.PI*2);
        const showLabel=(n.type==='company' && view.k>.55) || view.k>1.6 || (near && near.has(n.id)) || (matches && matches.has(n.id));
        if(showLabel && !dim) labels.push([n,x,y,r]); });
      groups.forEach((p,key)=>{ const [color,d]=key.split('|'); ctx.globalAlpha=d?.18:1; ctx.fillStyle=color; ctx.fill(p); });
      ctx.globalAlpha=1;
      if(selected && ok(selected)){ const [x,y]=toScreen(selected.p.x,selected.p.y), r=selected.r*Math.max(.6,Math.min(1.6,view.k)); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); ctx.lineWidth=1; }
      ctx.fillStyle='rgba(232,238,245,.92)';
      labels.forEach(([n,x,y,r])=>{ ctx.font=(n.type==='company'?'600 ':'')+'11px system-ui, sans-serif'; ctx.fillText(n.label.length>34?n.label.slice(0,33)+'…':n.label, x+r+3, y+4); });
    }
    function loop(){ raf=0; if(alpha>.02 || dragging) tick(); draw(); if(alpha>.02 || dragging) raf=requestAnimationFrame(loop); }
    function kick(){ if(!raf) raf=requestAnimationFrame(loop); }
    function resize(){ const r=stage.getBoundingClientRect(); dpr=window.devicePixelRatio||1; W=r.width; H=r.height; canvas.width=W*dpr; canvas.height=H*dpr; canvas.style.width=W+'px'; canvas.style.height=H+'px'; kick(); }
    function nodeAt(sx,sy){ const ok=visibleSet(); let best=null, bd=1e9; nodes.forEach(n=>{ if(!ok(n)) return; const [x,y]=toScreen(n.p.x,n.p.y), d=(x-sx)**2+(y-sy)**2, r=Math.max(8,n.r*view.k+4); if(d<r*r && d<bd){ bd=d; best=n; } }); return best; }
    function fit(){
      const ok=visibleSet(), vis=nodes.filter(ok); if(!vis.length) return;
      let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; vis.forEach(n=>{ x0=Math.min(x0,n.p.x); y0=Math.min(y0,n.p.y); x1=Math.max(x1,n.p.x); y1=Math.max(y1,n.p.y); });
      view.k=Math.max(.25, Math.min(2.2, Math.min(W/((x1-x0)||1), H/((y1-y0)||1))*.85)); view.x=-(x0+x1)/2*view.k; view.y=-(y0+y1)/2*view.k; kick();
    }
    function showSide(n){
      if(!n){ side.hidden=true; return; }
      const neigh=(adj.get(n.id)||[]).map(i=>byId.get(i)).filter(Boolean).sort((a,b)=>a.type.localeCompare(b.type)||a.label.localeCompare(b.label,'fr'));
      const groups={}; neigh.forEach(m=>{ (groups[m.type]=groups[m.type]||[]).push(m); });
      side.innerHTML='<button type="button" class="nw-x" aria-label="Fermer">×</button><div class="nw-kind" style="color:'+(TYPES[n.type]||{}).color+'">'+esc((TYPES[n.type]||{}).label||'')+'</div><h3>'+esc(n.label)+'</h3>'
        +(n.sub?'<p class="nw-sub">'+esc(n.sub)+'</p>':'')+(n.open?'<button type="button" class="nw-open">Ouvrir la fiche</button>':'')
        +'<div class="nw-count">'+neigh.length+' lien'+(neigh.length>1?'s':'')+'</div>'
        +Object.keys(groups).map(t=>'<div class="nw-g">'+esc((TYPES[t]||{}).label||t)+'</div>'+groups[t].slice(0,40).map(m=>'<button type="button" class="nw-n" data-id="'+esc(m.id)+'"><i style="background:'+(TYPES[m.type]||{}).color+'"></i>'+esc(m.label)+'</button>').join('')+(groups[t].length>40?'<div class="nw-more">+ '+(groups[t].length-40)+'</div>':'')).join('');
      side.hidden=false;
      side.querySelector('.nw-x').onclick=()=>{ selected=null; showSide(null); kick(); };
      const ob=side.querySelector('.nw-open'); if(ob) ob.onclick=()=>n.open();
      side.querySelectorAll('.nw-n').forEach(b=>b.onclick=()=>focus(b.dataset.id));
    }
    function focus(id, o){
      const n=byId.get(id); if(!n) return;
      if(hidden.has(n.type)){ hidden.delete(n.type); paintTypes(); }
      selected=n; showSide(n);
      if(o && o.local){ localBox.checked=true; alpha=Math.max(alpha,.5); setTimeout(fit, 500); }   // from a sheet: its neighbourhood first
      view.x=-n.p.x*view.k; view.y=-n.p.y*view.k; if(view.k<1) view.k=1.1; kick();
    }
    // ---- interactions
    canvas.addEventListener('wheel', e=>{ e.preventDefault(); const r=canvas.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top, [wx,wy]=toWorld(sx,sy);
      view.k=Math.max(.15, Math.min(4, view.k*(e.deltaY<0?1.12:1/1.12))); view.x=(sx-W/2)-wx*view.k; view.y=(sy-H/2)-wy*view.k; kick(); }, { passive:false });
    canvas.addEventListener('pointerdown', e=>{ const r=canvas.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top, n=nodeAt(sx,sy); moved=false; canvas.setPointerCapture(e.pointerId);
      if(n){ dragging=n; alpha=Math.max(alpha,.3); } else panning={ sx, sy, x:view.x, y:view.y }; kick(); });
    canvas.addEventListener('pointermove', e=>{ const r=canvas.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top;
      if(dragging){ const [wx,wy]=toWorld(sx,sy); dragging.p.x=wx; dragging.p.y=wy; dragging.p.vx=dragging.p.vy=0; moved=true; kick(); return; }
      if(panning){ view.x=panning.x+(sx-panning.sx); view.y=panning.y+(sy-panning.sy); if(Math.abs(sx-panning.sx)+Math.abs(sy-panning.sy)>3) moved=true; kick(); return; }
      const n=nodeAt(sx,sy); if(n!==hover){ hover=n; kick(); }
      canvas.style.cursor=n?'pointer':'grab';
      if(n){ tip.hidden=false; tip.innerHTML='<b>'+esc(n.label)+'</b>'+(n.sub?'<span>'+esc(n.sub)+'</span>':''); tip.style.left=Math.min(W-220, sx+14)+'px'; tip.style.top=(sy+14)+'px'; } else tip.hidden=true; });
    canvas.addEventListener('pointerup', e=>{ const r=canvas.getBoundingClientRect(), n=nodeAt(e.clientX-r.left, e.clientY-r.top);
      if(!moved){ selected=n||null; showSide(selected); if(localBox.checked) { alpha=Math.max(alpha,.4); } kick(); }
      dragging=null; panning=null; });
    canvas.addEventListener('pointerleave', ()=>{ hover=null; tip.hidden=true; kick(); });
    canvas.addEventListener('dblclick', e=>{ const r=canvas.getBoundingClientRect(), n=nodeAt(e.clientX-r.left, e.clientY-r.top); if(n && n.open) n.open(); });
    search.addEventListener('input', ()=>{ const q=fold(search.value.trim()); matches=q?new Set(nodes.filter(n=>fold(n.label+' '+(n.sub||'')).includes(q)).map(n=>n.id)):null; kick(); });
    search.addEventListener('keydown', e=>{ if(e.key==='Enter' && matches && matches.size){ const first=nodes.find(n=>matches.has(n.id) && visibleSet()(n)) || nodes.find(n=>matches.has(n.id)); if(first) focus(first.id); } });
    localBox.addEventListener('change', ()=>{ alpha=Math.max(alpha,.5); kick(); setTimeout(fit, 600); });
    root.querySelector('.nw-fit').onclick=fit;
    new ResizeObserver(resize).observe(stage);
    resize(); build();
    let first=true; setTimeout(()=>{ if(first){ fit(); first=false; } }, 900);
    return { refresh:build, focus, fit, _state:()=>({ nodes:nodes.length, edges:edges.length, selected:selected&&selected.id, visible:nodes.filter(visibleSet()).length }) };
  }
  window.todoNetwork={ mount, TYPES };
})();
