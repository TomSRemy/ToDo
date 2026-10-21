/* Won / signed / lost animations of the pipeline: three of each, one drawn at random (never the same twice in a row).
   window.todoCelebrate(kind, { sub }[, variant]) with kind 'won' | 'signed' | 'lost' (variant: to show one in particular). They play over the page for a few
   seconds, never catch a click, and shrink to the message alone when the device asks for less motion. */
(function(){
  'use strict';
  const VARIANTS={ won:['panel','turbine','battery'], signed:['gun','gong','champagne'], lost:['umbrella','nowind','plane'] };
  const LENGTH={ panel:3400, turbine:3400, battery:3400, gun:6600, gong:3800, champagne:3800, umbrella:3800, nowind:3800, plane:4000 };
  const COLORS=['#14D3A9','#FFFD82','#ED6965','#7DD3FC','#8B7FB5','#CA6702'];
  const MSG={
    panel:'Offre acceptée ! 😎', turbine:'Offre acceptée ! 🚁', battery:'Offre acceptée ! ⚡ 100 %',
    gun:'Contrat signé ! 💶', gong:'Contrat signé ! 🔔', champagne:'Contrat signé ! 🥂',
    umbrella:'Offre perdue · on rebondit ☂️', nowind:'Offre perdue · pas de vent cette fois', plane:'Offre perdue · la suivante décolle ✈️'
  };
  const BLADE='<path d="M130 78c-4-20-2-48 3-60c4 14 3 40-3 60z"/>';
  const blades=cls=>'<g class="'+cls+'">'+BLADE+BLADE.replace('/>',' transform="rotate(120 130 78)"/>')+BLADE.replace('/>',' transform="rotate(240 130 78)"/>')+'<circle cx="130" cy="78" r="6" fill="#B7C3D0"/></g>';
  const SVG={
    panel:'<g class="cx-rays" stroke="#FFD54A" stroke-width="3" stroke-linecap="round"><path d="M212 14v8M212 70v8M180 46h8M236 46h8M189 23l6 6M229 63l6 6M235 23l-6 6M195 63l-6 6"/></g>'
      +'<circle cx="212" cy="46" r="18" fill="#FFD54A"/><ellipse class="cx-eye" cx="205" cy="43" rx="2.5" ry="3" fill="#7A5A00"/><ellipse class="cx-eye cx-wink" cx="219" cy="43" rx="2.5" ry="3" fill="#7A5A00"/>'
      +'<path d="M204 52q8 6 16 0" stroke="#7A5A00" stroke-width="2" fill="none" stroke-linecap="round"/>'
      +'<g class="cx-leg-l"><path d="M118 168l-10 38h-10" stroke="#5B7A99" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'
      +'<g class="cx-leg-r"><path d="M142 168l10 38h10" stroke="#5B7A99" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'
      +'<g class="cx-body"><rect x="70" y="80" width="120" height="90" rx="6" fill="#1E3A5F" stroke="#7FA9D6" stroke-width="3"/><path d="M110 80v90M150 80v90M70 110h120M70 140h120" stroke="#7FA9D6" stroke-width="2"/>'
      +'<path d="M100 152q30 14 60 0" stroke="#E8EEF5" stroke-width="3" fill="none" stroke-linecap="round"/>'
      +'<g class="cx-glasses"><rect x="92" y="100" width="30" height="16" rx="6" fill="#04070C"/><rect x="138" y="100" width="30" height="16" rx="6" fill="#04070C"/><path d="M122 106h16" stroke="#04070C" stroke-width="3"/><path d="M97 104l8 0" stroke="#5E6B7A" stroke-width="2" stroke-linecap="round"/></g></g>',
    turbine:'<ellipse class="cx-dust" cx="130" cy="214" rx="46" ry="8" fill="#9AA8B8"/><g class="cx-lift"><path d="M126 82l-6 132h20l-6-132z" fill="#DDE5EE"/><rect x="120" y="70" width="22" height="14" rx="5" fill="#C9D3DE"/>'
      +'<g fill="#F2F6FA">'+blades('cx-whirl')+'</g></g>'
      +'<g class="cx-check"><circle cx="200" cy="60" r="20" fill="#14D3A9"/><path d="M190 60l7 7l13-14" stroke="#04070C" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'
      +'<path d="M60 214h140" stroke="#2C3A4A" stroke-width="3" stroke-linecap="round"/>',
    battery:'<path class="cx-bolt" d="M140 14l-26 52h20l-14 40l38-56h-22l16-36z" fill="#FFD54A"/><rect x="60" y="112" width="130" height="64" rx="10" fill="none" stroke="#DDE5EE" stroke-width="5"/>'
      +'<rect x="190" y="132" width="12" height="24" rx="3" fill="#DDE5EE"/><rect class="cx-fill" x="68" y="120" width="114" height="48" rx="5" fill="#14D3A9"/>'
      +'<text class="cx-pct" x="125" y="152" text-anchor="middle">0 %</text>'
      +'<g class="cx-spark" fill="#FFD54A"><path d="M60 104l4 10l10 4l-10 4l-4 10l-4-10l-10-4l10-4z"/><path d="M206 100l3 7l7 3l-7 3l-3 7l-3-7l-7-3l7-3z"/><path d="M200 184l3 7l7 3l-7 3l-3 7l-3-7l-7-3l7-3z"/></g>',
    gun:'',
    gong:'<defs><radialGradient id="cx-gold" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#FFE9A3"/><stop offset=".55" stop-color="#E0B23A"/><stop offset="1" stop-color="#9C6B12"/></radialGradient></defs>'
      +'<circle class="cx-gflash" cx="130" cy="122" r="120" fill="#FFE9A3"/>'
      +'<path d="M58 226V36M202 226V36M46 34h168" stroke="#7A4E2A" stroke-width="9" stroke-linecap="round"/><path d="M46 34h168" stroke="#A8703C" stroke-width="3" stroke-linecap="round"/>'
      +'<g class="cx-gong"><path d="M108 36l10 30M152 36l-10 30" stroke="#C9A04A" stroke-width="2"/><circle cx="130" cy="122" r="58" fill="url(#cx-gold)" stroke="#8A5A10" stroke-width="3"/>'
      +'<circle cx="130" cy="122" r="42" fill="none" stroke="#B8862B" stroke-width="1.5" opacity=".8"/><circle cx="130" cy="122" r="26" fill="none" stroke="#B8862B" stroke-width="1.5" opacity=".8"/><circle cx="130" cy="122" r="12" fill="#C9962E"/></g>'
      +'<g class="cx-mallet"><path d="M236 226L176 150" stroke="#7A4E2A" stroke-width="6" stroke-linecap="round"/><ellipse cx="172" cy="145" rx="13" ry="15" fill="#B33A2E" transform="rotate(-38 172 145)"/></g>',
    champagne:'<g class="cx-bottle"><path d="M98 230h24a8 8 0 0 0 8-8V128c0-14-8-22-10-30V66h-20v32c-2 8-10 16-10 30v94a8 8 0 0 0 8 8z" fill="#1F5A3A" stroke="#123824" stroke-width="2"/>'
      +'<rect x="94" y="150" width="32" height="38" rx="3" fill="#F2E6C2"/><text x="110" y="173" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="10" fill="#7A5A10">SIGNÉ</text>'
      +'<rect x="99" y="60" width="22" height="20" rx="3" fill="#E8C547"/><g class="cx-cork"><rect x="102" y="44" width="16" height="18" rx="5" fill="#C9955A" stroke="#8A5E30" stroke-width="1.5"/></g>'
      +'<circle class="cx-neck" cx="110" cy="44" r="1" fill="none"/></g>',
    umbrella:'<g class="cx-cloud"><g class="cx-rain" stroke="#8FB4D9" stroke-width="2" stroke-linecap="round">'
      +[[92,0],[112,.2],[132,.1],[152,.35],[172,.15],[102,.45],[162,.28]].map(([x,d])=>'<line x1="'+x+'" y1="70" x2="'+(x-4)+'" y2="84" style="--d:'+d+'s"/>').join('')+'</g>'
      +'<path d="M84 66a20 20 0 0 1 8-38a28 28 0 0 1 52-6a22 22 0 0 1 34 18a14 14 0 0 1-4 26z" fill="#5E6B7A"/></g>'
      +'<g class="cx-umb"><path d="M84 112a46 34 0 0 1 92 0q-7.6-6-15.3 0q-7.7-6-15.4 0q-7.7-6-15.3 0q-7.7-6-15.4 0q-7.6-6-15.3 0z" fill="#14D3A9"/><path d="M130 112v40q0 8 8 8" stroke="#DDE5EE" stroke-width="3" fill="none" stroke-linecap="round"/></g>'
      +'<rect x="80" y="150" width="100" height="62" rx="5" fill="#1E3A5F" stroke="#7FA9D6" stroke-width="3"/><path d="M113 150v62M147 150v62M80 181h100" stroke="#7FA9D6" stroke-width="2"/>'
      +'<circle cx="114" cy="170" r="3" fill="#DDE5EE"/><circle cx="146" cy="170" r="3" fill="#DDE5EE"/>'
      +'<path class="cx-sad" d="M118 196q12-9 24 0" stroke="#DDE5EE" stroke-width="3" fill="none" stroke-linecap="round"/><path class="cx-happy" d="M116 190q14 12 28 0" stroke="#DDE5EE" stroke-width="3" fill="none" stroke-linecap="round"/>',
    nowind:'<path d="M126 82l-6 132h20l-6-132z" fill="#C9D3DE"/><rect x="120" y="70" width="22" height="14" rx="5" fill="#B7C3D0"/><g fill="#DDE5EE">'+blades('cx-slow')+'</g>'
      +'<g class="cx-tumble" stroke="#A8865A" stroke-width="1.8" fill="none"><circle cx="110" cy="200" r="13"/><path d="M99 194q11 6 22 0M101 206q9-10 18 0M110 187q-6 13 0 26M104 190q12 12 12 20"/></g>'
      +'<path d="M40 214h180" stroke="#2C3A4A" stroke-width="3" stroke-linecap="round"/>',
    plane:'<ellipse class="cx-puff" cx="182" cy="208" rx="22" ry="7" fill="#9AA8B8"/><path d="M30 214h200" stroke="#2C3A4A" stroke-width="3" stroke-linecap="round"/>'
  };
  const PLANE=c=>'<svg viewBox="0 0 34 22"><path d="M1 11L33 1L20 21L15 13z" fill="'+c+'"/><path d="M15 13L33 1" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>';
  const GUN='<svg viewBox="0 0 160 100" aria-hidden="true"><rect x="40" y="10" width="62" height="22" rx="3" fill="#2E9E6A" stroke="#9EE6C0" stroke-width="2"/><rect x="44" y="6" width="54" height="6" rx="2" fill="#1F7A50"/>'
    +'<path d="M18 34h118a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H60l-10 34a6 6 0 0 1-6 4H26a5 5 0 0 1-5-6l9-32h-12a6 6 0 0 1-6-6V40a6 6 0 0 1 6-6z" fill="#1C2733" stroke="#E8C547" stroke-width="2.5"/>'
    +'<path d="M62 60q8 14 20 6" stroke="#E8C547" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="128" y="38" width="22" height="18" rx="3" fill="#E8C547"/>'
    +'<text x="78" y="51" font-family="system-ui,sans-serif" font-weight="800" font-size="13" fill="#E8C547" text-anchor="middle">€€€</text><circle class="cx-muzzle" cx="152" cy="47" r="1" fill="none"/></svg>';

  function pick(kind){
    const all=VARIANTS[kind]; let last=null; try{ last=localStorage.getItem('celebrate-last-'+kind); }catch(e){}
    const pool=all.filter(v=>v!==last), v=pool[Math.floor(Math.random()*pool.length)];
    try{ localStorage.setItem('celebrate-last-'+kind, v); }catch(e){}
    return v;
  }
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  function confetti(fx, n){
    for(let i=0;i<n;i++){
      const c=document.createElement('i'); c.className='confetti';
      c.style.left=(Math.random()*100)+'vw'; c.style.background=COLORS[i%COLORS.length];
      c.style.width=(6+Math.random()*6)+'px'; c.style.height=(8+Math.random()*8)+'px';
      c.style.setProperty('--dx',(Math.random()*160-80)+'px'); c.style.setProperty('--rot',(Math.random()*900-450)+'deg');
      c.style.animationDelay=(1.2+Math.random()*.6)+'s'; c.style.animationDuration=(1.6+Math.random()*1.2)+'s';
      fx.appendChild(c);
    }
  }
  // money gun from the bottom-left corner: a burst of banknotes that float down like leaves
  function moneyGun(fx){
    const W=fx.clientWidth, H=fx.clientHeight, k=Math.max(.7, Math.min(1.5, W/700)), n=W<700?70:130, list=[];
    const gun=document.createElement('div'); gun.className='cx-gun'; gun.innerHTML=GUN; fx.appendChild(gun);
    const ANG=-38, IN=320, FIRE=n>80?2000:1600, OUT=IN+FIRE+400, muzzle=gun.querySelector('.cx-muzzle'), box=fx.getBoundingClientRect();
    let recoil=0, shot=0; const start=performance.now();
    (function step(now){
      if(!fx.isConnected) return;
      const t=now-start, slide=t<IN?1-t/IN:(t>OUT?Math.min(1,(t-OUT)/350):0);
      recoil*=0.82;
      gun.style.transform='translate('+(-200*slide)+'px,'+(110*slide)+'px) rotate('+(ANG+recoil*.6)+'deg) translateX('+(-recoil)+'px)';
      while(shot<n && t>IN && t-IN>=FIRE*Math.pow(shot/n,1.25)){
        const m=muzzle.getBoundingClientRect(), a=(ANG+(Math.random()*36-18))*Math.PI/180, sp=(9+Math.random()*17)*k;
        const b=document.createElement('i'); b.className='cx-bill'; b.textContent='€'; fx.insertBefore(b, gun);
        const near=Math.random()<.18; if(near){ b.style.filter='blur(1.2px)'; b.style.zIndex=3; }
        list.push({ el:b, x:m.left-box.left-31, y:m.top-box.top-16, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:ANG+Math.random()*20-10, vr:Math.random()*10-5, born:t,
          ph:Math.random()*6.28, s:near?1.5+Math.random()*.6:.6+Math.random()*.6, sw:.6+Math.random()*.8, fall:0 });
        recoil=7; shot++;
      }
      let alive=t<OUT+400;
      list.forEach(p=>{
        const age=t-p.born;
        if(!p.fall){ p.vy+=.32*k; p.vx*=.985; p.r+=p.vr; if(p.vy>0) p.fall=age; }
        else { const sway=Math.sin((age-p.fall)/1000*2.6*p.sw+p.ph); p.vy+=(1.9*k-p.vy)*.08; p.vx=p.vx*.94+sway*1.82*k; p.r=p.r*.9+sway*3.8; }
        p.x+=p.vx; p.y+=p.vy;
        const flip=p.fall?Math.cos((age-p.fall)/260*p.sw+p.ph):1, fade=age>3600?Math.max(0,1-(age-3600)/900):1;
        p.el.style.transform='translate('+p.x+'px,'+p.y+'px) rotate('+p.r+'deg) scale('+p.s+','+(p.s*(.3+.7*Math.abs(flip)))+')'; p.el.style.opacity=fade;
        if(p.y<H+60 && fade>0) alive=true;
      });
      if(alive) requestAnimationFrame(step);
    })(start);
  }
  // the gong: a synthesized strike (inharmonic partials, long decay) and golden waves across the screen
  let audio=null;
  function gongSound(){
    try{
      audio=audio||new (window.AudioContext||window.webkitAudioContext)(); const a=audio, t=a.currentTime, out=a.createGain(); out.gain.value=.3; out.connect(a.destination);
      [[98,1,4.2],[147,.7,3.6],[207,.55,3],[271,.4,2.4],[334,.3,2],[412,.22,1.6],[523,.15,1.2]].forEach(([f,v,d])=>{
        const o=a.createOscillator(), g=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(f*1.012,t); o.frequency.exponentialRampToValueAtTime(f,t+.4);
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+d); o.connect(g); g.connect(out); o.start(t); o.stop(t+d); });
      const nb=a.createBuffer(1,a.sampleRate*.08,a.sampleRate), ch=nb.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*(1-i/ch.length);
      const src=a.createBufferSource(), ng=a.createGain(); src.buffer=nb; ng.gain.value=.22; src.connect(ng); ng.connect(out); src.start(t);
    }catch(e){}
  }
  function waves(fx){ for(let i=0;i<4;i++){ const w=document.createElement('i'); w.className='cx-wave'; w.style.animationDelay=(i*.18)+'s'; fx.appendChild(w); } }
  // champagne: foam falls back, golden bubbles float up
  function spray(el, fx){
    const neck=el.querySelector('.cx-neck'); if(!neck) return; const m=neck.getBoundingClientRect(), r=fx.getBoundingClientRect(), N=140, list=[];
    for(let i=0;i<N;i++){ const b=document.createElement('i'); b.className='cx-bubble'; const foam=i<N*.4, sz=(3+Math.random()*(foam?5:9))*2.2; b.style.width=b.style.height=sz+'px'; fx.appendChild(b);
      const a=(-62+Math.random()*30)*Math.PI/180, sp=(3+Math.random()*7)*2.2;
      list.push({ el:b, x:m.left-r.left, y:m.top-r.top, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, foam, t0:i*12, ph:Math.random()*6.28 }); }
    const start=performance.now();
    (function step(now){ if(!fx.isConnected) return; const t=now-start; let alive=false;
      list.forEach(p=>{ const age=t-p.t0; if(age<0){ p.el.style.opacity=0; alive=true; return; }
        if(p.foam) p.vy+=.26; else { p.vy=p.vy*.96-.13; p.vx=p.vx*.97+Math.sin(age/200+p.ph)*.18; }
        p.x+=p.vx; p.y+=p.vy; const o=Math.max(0,1-age/(p.foam?1100:2600)); p.el.style.opacity=o; p.el.style.transform='translate('+p.x+'px,'+p.y+'px)'; if(o>0) alive=true; });
      if(alive) requestAnimationFrame(step); })(start);
  }

  window.todoCelebrate=function(kind, info, force){
    if(!VARIANTS[kind]) return;
    document.querySelectorAll('.celebrate').forEach(n=>n.remove());
    const v=VARIANTS[kind].includes(force)?force:pick(kind), less=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // cxv-: the variant drawn (the cx- classes are the parts of the drawings)
    const el=document.createElement('div'); el.className='celebrate celebrate-'+kind+' cxv-'+v+(less?' cx-less':''); el.setAttribute('aria-live','polite'); el.dataset.variant=v;
    el.innerHTML='<div class="cx-fx"></div>'+(SVG[v]?'<svg class="cx-art" viewBox="0 0 260 240" aria-hidden="true">'+SVG[v]+'</svg>':'')
      +(v==='plane'?'<div class="cx-planes"><div class="cx-plane cx-p1">'+PLANE('#DDE5EE')+'</div><div class="cx-plane cx-p2">'+PLANE('#14D3A9')+'</div></div>':'')
      +'<div class="cx-msg"><b>'+esc(MSG[v])+'</b>'+(info&&info.sub?'<span>'+esc(info.sub)+'</span>':'')+'</div>';
    document.body.appendChild(el);
    const fx=el.querySelector('.cx-fx');
    if(v==='plane'){ const art=el.querySelector('.cx-art'), pl=el.querySelector('.cx-planes'); if(art && pl) pl.style.transform='translate(-50%,-55%) scale('+(art.getBoundingClientRect().width/260)+')'; }
    void el.offsetWidth; el.classList.add('cx-play');
    if(!less){
      if(kind==='won') confetti(fx, 80);
      if(v==='battery'){ const t=el.querySelector('.cx-pct'); let n=0; setTimeout(()=>{ const iv=setInterval(()=>{ n=Math.min(100,n+5); if(t) t.textContent=n+' %'; if(n>=100) clearInterval(iv); },45); },550); }
      if(v==='gun') setTimeout(()=>moneyGun(fx), 150);
      if(v==='gong') setTimeout(()=>{ gongSound(); waves(fx); }, 620);
      if(v==='champagne') setTimeout(()=>spray(el, fx), 600);
    }
    const len=less?1800:LENGTH[v];
    setTimeout(()=>el.classList.add('out'), len-500);
    setTimeout(()=>el.remove(), len);
  };
})();
