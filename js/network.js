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
      +'<div class="nw-stage"><canvas></canvas><div class="nw-tip" hidden></div><div class="nw-side" hidden></div><div class="nw-hint">Molette : zoom · glisser : déplacer · clic : détails · double-clic : ouvrir la fiche</div></div>';
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
      const ok=visibleSet(), vis=nodes.filter(ok), cell=90, grid=new Map();
      vis.forEach(n=>{ const k=Math.floor(n.p.x/cell)+','+Math.floor(n.p.y/cell); (grid.get(k)||grid.set(k,[]).get(k)).push(n); });
      vis.forEach(n=>{ const gx=Math.floor(n.p.x/cell), gy=Math.floor(n.p.y/cell);
        for(let dx=-2;dx<=2;dx++) for(let dy=-2;dy<=2;dy++){ const list=grid.get((gx+dx)+','+(gy+dy)); if(!list) continue;
          list.forEach(m=>{ if(m===n) return; let x=n.p.x-m.p.x, y=n.p.y-m.p.y, d2=x*x+y*y; if(d2<1){ x=Math.random()-.5; y=Math.random()-.5; d2=.5; } if(d2>cell*cell*4) return;
            const f=900/d2; n.p.vx+=x*f*.02*alpha; n.p.vy+=y*f*.02*alpha; }); } });
      edges.forEach(([a,b])=>{ const A=byId.get(a), B=byId.get(b); if(!ok(A)||!ok(B)) return;
        const L=(A.type==='company'||B.type==='company')?60:40, x=B.p.x-A.p.x, y=B.p.y-A.p.y, d=Math.sqrt(x*x+y*y)||1, f=(d-L)/d*.06*alpha;
        A.p.vx+=x*f; A.p.vy+=y*f; B.p.vx-=x*f; B.p.vy-=y*f; });
      vis.forEach(n=>{ n.p.vx-=n.p.x*.0025*alpha; n.p.vy-=n.p.y*.0025*alpha; if(n===dragging) return; n.p.vx*=.82; n.p.vy*=.82; n.p.x+=n.p.vx; n.p.y+=n.p.vy; });
      alpha*=.985;
    }
    const toScreen=(x,y)=>[(x*view.k+view.x)+W/2, (y*view.k+view.y)+H/2];
    const toWorld=(sx,sy)=>[((sx-W/2)-view.x)/view.k, ((sy-H/2)-view.y)/view.k];
    function draw(){
      const ok=visibleSet(); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
      const focus=hover||selected, near=focus?new Set([focus.id, ...(adj.get(focus.id)||[])]):null;
      ctx.lineWidth=1;
      edges.forEach(([a,b])=>{ const A=byId.get(a), B=byId.get(b); if(!ok(A)||!ok(B)) return; const on=near && near.has(a) && near.has(b) && (a===focus.id||b===focus.id);
        ctx.strokeStyle=on?'rgba(20,211,169,.75)':(near?'rgba(140,160,180,.07)':'rgba(140,160,180,.22)'); const [x1,y1]=toScreen(A.p.x,A.p.y), [x2,y2]=toScreen(B.p.x,B.p.y);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });
      nodes.forEach(n=>{ if(!ok(n)) return; const [x,y]=toScreen(n.p.x,n.p.y), r=n.r*Math.max(.6,Math.min(1.6,view.k)); if(x<-30||y<-30||x>W+30||y>H+30) return;
        const dim=(near && !near.has(n.id)) || (matches && !matches.has(n.id));
        ctx.globalAlpha=dim?.18:1; ctx.fillStyle=(TYPES[n.type]||TYPES.task).color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
        if(n===selected){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); ctx.lineWidth=1; }
        const showLabel=(n.type==='company' && view.k>.55) || view.k>1.6 || (near && near.has(n.id)) || (matches && matches.has(n.id));
        if(showLabel && !dim){ ctx.font=(n.type==='company'?'600 ':'')+'11px system-ui, sans-serif'; ctx.fillStyle='rgba(232,238,245,.92)'; ctx.fillText(n.label.length>34?n.label.slice(0,33)+'…':n.label, x+r+3, y+4); }
        ctx.globalAlpha=1; });
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
    function focus(id){
      const n=byId.get(id); if(!n) return;
      if(hidden.has(n.type)){ hidden.delete(n.type); paintTypes(); }
      selected=n; showSide(n); view.x=-n.p.x*view.k; view.y=-n.p.y*view.k; if(view.k<1) view.k=1.1; kick();
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
