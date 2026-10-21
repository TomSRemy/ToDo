/* Won / signed / lost animations of the pipeline: three of each, one drawn at random (never the same twice in a row).
   window.todoCelebrate(kind, { sub }[, variant]) with kind 'won' | 'signed' | 'lost' (variant: to show one in particular). They play over the page for a few
   seconds, never catch a click, and shrink to the message alone when the device asks for less motion. */
(function(){
  'use strict';
  const VARIANTS={ won:['panel','turbine','battery'], signed:['gun','gong','champagne'], lost:['umbrella','nowind','plane'] };
  const LENGTH={ panel:3400, turbine:3400, battery:3400, gun:6600, gong:4200, champagne:4400, umbrella:4400, nowind:4400, plane:5600 };
  const COLORS=['#14D3A9','#FFFD82','#ED6965','#7DD3FC','#8B7FB5','#CA6702'];
  const MSG={
    panel:'Offre acceptée ! 😎', turbine:'Offre acceptée ! 🚁', battery:'Offre acceptée ! ⚡ 100 %',
    gun:'Contrat signé ! 💶', gong:'Contrat signé ! 🔔', champagne:'Contrat signé ! 🥂',
    umbrella:'Offre perdue · on rebondit ☂️', nowind:'Offre perdue · pas de vent cette fois 🍃', plane:'Offre perdue · la suivante décolle ✈️'
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
    // signed 2: the gong has a face; struck, it sees stars (spiral eyes), « GONG ! » like in a comic
    gong:'<defs><radialGradient id="cx-gold" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#FFE9A3"/><stop offset=".55" stop-color="#E0B23A"/><stop offset="1" stop-color="#9C6B12"/></radialGradient></defs>'
      +'<path d="M58 226V36M202 226V36M46 34h168" stroke="#7A4E2A" stroke-width="9" stroke-linecap="round"/><path d="M46 34h168" stroke="#A8703C" stroke-width="3" stroke-linecap="round"/>'
      +'<g class="cx-gong"><path d="M108 36l10 30M152 36l-10 30" stroke="#C9A04A" stroke-width="2"/><circle class="cx-gdisc" cx="130" cy="122" r="58" fill="url(#cx-gold)" stroke="#8A5A10" stroke-width="3"/>'
      +'<circle cx="130" cy="122" r="44" fill="none" stroke="#B8862B" stroke-width="1.5" opacity=".7"/>'
      +'<g class="cx-geyes" fill="#5A3A08"><ellipse cx="113" cy="112" rx="5" ry="7"/><ellipse cx="147" cy="112" rx="5" ry="7"/><circle cx="115" cy="109" r="1.8" fill="#FFF3C4"/><circle cx="149" cy="109" r="1.8" fill="#FFF3C4"/></g>'
      +'<g class="cx-gdizzy" stroke="#5A3A08" stroke-width="2" fill="none" stroke-linecap="round"><path d="M113 112m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-5 -1a5 5 0 1 1 9 2"/><path d="M147 112m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-5 -1a5 5 0 1 1 9 2"/></g>'
      +'<path class="cx-gsmile" d="M114 136q16 14 32 0" stroke="#5A3A08" stroke-width="3" fill="none" stroke-linecap="round"/>'
      +'<ellipse class="cx-gmouth" cx="130" cy="140" rx="8" ry="10" fill="#5A3A08"/>'
      +'<circle cx="100" cy="128" r="7" fill="#F28C6B" opacity=".45"/><circle cx="160" cy="128" r="7" fill="#F28C6B" opacity=".45"/></g>'
      +'<g class="cx-gstars"><g class="cx-gorbit" fill="#FFE066">'+[0,120,240].map(a=>'<path transform="rotate('+a+' 130 50) translate(130 26)" d="M0-7l2 5l5 .5l-4 3.5l1.5 5l-4.5-3l-4.5 3l1.5-5l-4-3.5l5-.5z"/>').join('')+'</g></g>'
      +'<g class="cx-mallet"><path d="M236 226L176 150" stroke="#7A4E2A" stroke-width="6" stroke-linecap="round"/><ellipse cx="172" cy="145" rx="13" ry="15" fill="#B33A2E" transform="rotate(-38 172 145)"/></g>'
      +'<g class="cx-bang"><path d="M214 30l9 14l15-6l-4 15l15 6l-14 8l7 14l-16-3l-3 16l-11-12l-12 10l-1-16l-16-1l11-12l-9-13l16 1z" fill="#FFD23F" stroke="#E2463A" stroke-width="3" stroke-linejoin="round"/>'
      +'<text x="219" y="66" text-anchor="middle" font-family="Impact,\'Arial Black\',system-ui,sans-serif" font-weight="900" font-size="15" fill="#E2463A" transform="rotate(-12 219 62)">GONG!</text></g>',
    // signed 3: champagne, the cork flies at the screen, a golden geyser, then « Tchin ! »
    champagne:'<g class="cx-bottle"><path d="M118 236h24a9 9 0 0 0 9-9V124c0-16-9-24-11-33V58h-20v33c-2 9-11 17-11 33v103a9 9 0 0 0 9 9z" fill="#1F5A3A" stroke="#0F2E1E" stroke-width="2.5"/>'
      +'<path d="M126 128v80" stroke="#3E8A5E" stroke-width="5" stroke-linecap="round" opacity=".6"/>'
      +'<rect x="112" y="150" width="36" height="42" rx="3" fill="#F2E6C2"/><text x="130" y="176" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="11" fill="#7A5A10">SIGNÉ</text>'
      +'<rect x="119" y="52" width="22" height="22" rx="3" fill="#E8C547"/><g class="cx-cork"><rect x="122" y="36" width="16" height="18" rx="5" fill="#C9955A" stroke="#8A5E30" stroke-width="1.5"/></g>'
      +'<circle class="cx-neck" cx="130" cy="38" r="1" fill="none"/></g>'
      +'<g class="cx-flute cx-fl"><path d="M66 70h36l-6 54q-12 10-24 0z" fill="rgba(255,236,160,.25)" stroke="#E8EEF5" stroke-width="2.5"/><path d="M70 92h28l-3 30q-11 8-22 0z" fill="#F2C94C"/><path d="M84 124v52M70 178h28" stroke="#E8EEF5" stroke-width="3" stroke-linecap="round"/></g>'
      +'<g class="cx-flute cx-fr"><path d="M158 70h36l-6 54q-12 10-24 0z" fill="rgba(255,236,160,.25)" stroke="#E8EEF5" stroke-width="2.5"/><path d="M162 92h28l-3 30q-11 8-22 0z" fill="#F2C94C"/><path d="M176 124v52M162 178h28" stroke="#E8EEF5" stroke-width="3" stroke-linecap="round"/></g>'
      +'<g class="cx-clink" fill="#FFE066"><path d="M130 44l4 12l12 4l-12 4l-4 12l-4-12l-12-4l12-4z"/></g>'
      +'<text class="cx-tchin" x="130" y="34" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="22" fill="#FFE066" stroke="#7A5A10" stroke-width="1">Tchin !</text>',
    // lost 1: a downpour, the panel shivers, opens its umbrella, hops, and a rainbow comes out
    umbrella:'<g class="cx-rainbow" fill="none" stroke-width="7" stroke-linecap="round">'
      +['#ED6965','#F2A541','#FFE066','#14D3A9','#7DD3FC','#8B7FB5'].map((c,i)=>'<path d="M'+(20+i*7)+' 210A'+(110-i*7)+' '+(110-i*7)+' 0 0 1 '+(240-i*7)+' 210" stroke="'+c+'" pathLength="100"/>').join('')+'</g>'
      +'<g class="cx-cloud"><path d="M84 66a20 20 0 0 1 8-38a28 28 0 0 1 52-6a22 22 0 0 1 34 18a14 14 0 0 1-4 26z" fill="#5E6B7A"/>'
      +'<path d="M112 38l10 5M150 38l-10 5" stroke="#2C3540" stroke-width="3" stroke-linecap="round"/><circle cx="118" cy="48" r="3" fill="#2C3540"/><circle cx="144" cy="48" r="3" fill="#2C3540"/><path d="M122 60q9-6 18 0" stroke="#2C3540" stroke-width="3" fill="none" stroke-linecap="round"/></g>'
      +'<g class="cx-hop"><g class="cx-umb"><path d="M84 112a46 34 0 0 1 92 0q-7.6-6-15.3 0q-7.7-6-15.4 0q-7.7-6-15.3 0q-7.7-6-15.4 0q-7.6-6-15.3 0z" fill="#14D3A9"/><path d="M130 112v40q0 8 8 8" stroke="#DDE5EE" stroke-width="3" fill="none" stroke-linecap="round"/></g>'
      +'<g class="cx-shiver"><path d="M116 206l-6 22h-8M144 206l6 22h8" stroke="#5B7A99" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
      +'<rect x="80" y="146" width="100" height="62" rx="5" fill="#1E3A5F" stroke="#7FA9D6" stroke-width="3"/><path d="M113 146v62M147 146v62M80 177h100" stroke="#7FA9D6" stroke-width="2"/>'
      +'<circle cx="114" cy="166" r="3.5" fill="#DDE5EE"/><circle cx="146" cy="166" r="3.5" fill="#DDE5EE"/><path class="cx-tear" d="M110 172q-3 6 0 8q3-2 0-8z" fill="#7DD3FC"/>'
      +'<path class="cx-sad" d="M118 194q12-9 24 0" stroke="#DDE5EE" stroke-width="3" fill="none" stroke-linecap="round"/><path class="cx-happy" d="M114 186q16 14 32 0" stroke="#DDE5EE" stroke-width="3" fill="none" stroke-linecap="round"/></g></g>',
    // lost 2: no wind, sad trombone; the turbine blows on its own blades; a tumbleweed crosses the screen; crickets
    nowind:'<path d="M118 84l-8 130h40l-8-130z" fill="#C9D3DE"/><rect x="116" y="70" width="28" height="16" rx="6" fill="#B7C3D0"/><g fill="#DDE5EE">'+blades('cx-slow')+'</g>'
      +'<g class="cx-teyes" fill="#2C3A4A"><circle cx="123" cy="132" r="3.2"/><circle cx="137" cy="132" r="3.2"/></g>'
      +'<path class="cx-tmouth" d="M124 150q6-4 12 0" stroke="#2C3A4A" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
      +'<g class="cx-puffcheeks"><circle cx="121" cy="148" r="6" fill="#F28C6B" opacity=".6"/><circle cx="139" cy="148" r="6" fill="#F28C6B" opacity=".6"/><ellipse cx="130" cy="150" rx="3" ry="2.5" fill="#2C3A4A"/></g>'
      +'<g class="cx-blow" stroke="#9AA8B8" stroke-width="2" fill="none" stroke-linecap="round"><path d="M136 150q14-12 10-40"/><path d="M138 152q20-14 18-52"/><path d="M134 148q8-10 4-30"/></g>'
      +'<path d="M30 214h200" stroke="#2C3A4A" stroke-width="3" stroke-linecap="round"/>',
    // lost 3: everything in full screen (see paperPlane)
    plane:''
  };
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
  // ---------- sounds (synthesized, no file) ----------
  let audio=null;
  const ctx=()=>{ audio=audio||new (window.AudioContext||window.webkitAudioContext)(); return audio; };
  function gongSound(){
    try{
      const a=ctx(), t=a.currentTime, out=a.createGain(); out.gain.value=.3; out.connect(a.destination);
      [[98,1,4.2],[147,.7,3.6],[207,.55,3],[271,.4,2.4],[334,.3,2],[412,.22,1.6],[523,.15,1.2]].forEach(([f,v,d])=>{
        const o=a.createOscillator(), g=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(f*1.012,t); o.frequency.exponentialRampToValueAtTime(f,t+.4);
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+d); o.connect(g); g.connect(out); o.start(t); o.stop(t+d); });
      noise(a, out, .08, .22, t);
    }catch(e){}
  }
  function noise(a, out, len, vol, t){
    const nb=a.createBuffer(1,Math.max(1,a.sampleRate*len),a.sampleRate), ch=nb.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*(1-i/ch.length);
    const src=a.createBufferSource(), g=a.createGain(); src.buffer=nb; g.gain.value=vol; src.connect(g); g.connect(out); src.start(t);
  }
  function popSound(){   // the cork: a short burst and a falling « pop »
    try{ const a=ctx(), t=a.currentTime, out=a.createGain(); out.gain.value=.35; out.connect(a.destination); noise(a, out, .05, .5, t);
      const o=a.createOscillator(), g=a.createGain(); o.frequency.setValueAtTime(520,t); o.frequency.exponentialRampToValueAtTime(140,t+.12); g.gain.setValueAtTime(.5,t); g.gain.exponentialRampToValueAtTime(.001,t+.15); o.connect(g); g.connect(out); o.start(t); o.stop(t+.16); }catch(e){}
  }
  function clinkSound(){ // two glasses: « ting »
    try{ const a=ctx(), t=a.currentTime, out=a.createGain(); out.gain.value=.18; out.connect(a.destination);
      [[2093,1,.9],[3136,.5,.6],[4186,.3,.4]].forEach(([f,v,d])=>{ const o=a.createOscillator(), g=a.createGain(); o.frequency.value=f; g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.0001,t+d); o.connect(g); g.connect(out); o.start(t); o.stop(t+d); }); }catch(e){}
  }
  function tromboneSound(){ // « wah wah wah waaah »
    try{ const a=ctx(), t0=a.currentTime, out=a.createGain(), lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; out.gain.value=.16; lp.connect(out); out.connect(a.destination);
      [[233,0,.38],[220,.42,.38],[208,.84,.38],[196,1.26,1.1]].forEach(([f,s,d],i)=>{ const o=a.createOscillator(), g=a.createGain(), t=t0+s; o.type='sawtooth'; o.frequency.setValueAtTime(f*1.03,t); o.frequency.linearRampToValueAtTime(f,t+.08);
        if(i===3){ const lfo=a.createOscillator(), lg=a.createGain(); lfo.frequency.value=6; lg.gain.value=5; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t+.2); lfo.stop(t+d); o.frequency.linearRampToValueAtTime(f*.94,t+d); }
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(1,t+.04); g.gain.setValueAtTime(1,t+d-.12); g.gain.linearRampToValueAtTime(0,t+d); o.connect(g); g.connect(lp); o.start(t); o.stop(t+d); }); }catch(e){}
  }

  // ---------- particles ----------
  // small physics loop shared by the effects: each particle has x, y, vx, vy, and its own update
  function run(fx, list, step, until){
    const start=performance.now();
    (function frame(now){ if(!fx.isConnected) return; const t=now-start; let alive=t<(until||0);
      list.forEach(p=>{ if(p.dead) return; if(step(p, t)!==false) alive=true; else { p.dead=true; p.el.remove(); } });
      if(alive) requestAnimationFrame(frame); })(start);
  }
  const center=el=>{ const r=el.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2 }; };
  function shake(){ try{ document.body.animate([{ transform:'none' },{ transform:'translate(-9px,5px)' },{ transform:'translate(8px,-6px)' },{ transform:'translate(-6px,-3px)' },{ transform:'translate(5px,4px)' },{ transform:'translate(-2px,1px)' },{ transform:'none' }], { duration:520, easing:'ease-out' }); }catch(e){} }
  function flash(fx, color){ const f=document.createElement('i'); f.className='cx-flashall'; f.style.background=color; fx.appendChild(f); setTimeout(()=>f.remove(), 900); }

  // the gong: sparks fly out in all directions, golden waves cross the screen
  function waves(fx){ for(let i=0;i<4;i++){ const w=document.createElement('i'); w.className='cx-wave'; w.style.animationDelay=(i*.18)+'s'; fx.appendChild(w); } }
  function gongHit(el, fx){
    gongSound(); shake(); flash(fx, 'radial-gradient(circle at 50% 42%, rgba(255,233,163,.75), rgba(255,233,163,0) 60%)'); waves(fx);
    const c=center(el.querySelector('.cx-gdisc')), list=[];
    for(let i=0;i<90;i++){ const s=document.createElement('i'); s.className='cx-spark'; fx.appendChild(s); const a=Math.random()*6.283, sp=6+Math.random()*14;
      s.style.background=['#FFE066','#FFD23F','#FFF3C4','#E8C547'][i%4]; const sz=3+Math.random()*5; s.style.width=s.style.height=sz+'px';
      list.push({ el:s, x:c.x, y:c.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:900+Math.random()*700 }); }
    run(fx, list, (p,t)=>{ p.vy+=.25; p.vx*=.98; p.x+=p.vx; p.y+=p.vy; const o=1-t/p.life; if(o<=0) return false; p.el.style.opacity=o; p.el.style.transform='translate('+p.x+'px,'+p.y+'px)'; });
  }
  // champagne: the cork flies at the screen, a golden geyser up to the top, then it rains gold
  function champagnePop(el, fx){
    popSound(); const n=center(el.querySelector('.cx-neck')), W=fx.clientWidth, H=fx.clientHeight;
    const cork=document.createElement('i'); cork.className='cx-bigcork'; fx.appendChild(cork);
    cork.animate([{ transform:'translate('+(n.x-14)+'px,'+(n.y-16)+'px) scale(1) rotate(0)', opacity:1 }, { transform:'translate('+(W*.62)+'px,'+(H*.12)+'px) scale(16) rotate(540deg)', opacity:.95, offset:.85 }, { transform:'translate('+(W*.64)+'px,'+(H*.1)+'px) scale(19) rotate(600deg)', opacity:0 }], { duration:750, easing:'cubic-bezier(.3,.6,.4,1)', fill:'forwards' });
    setTimeout(()=>flash(fx, 'rgba(255,240,190,.35)'), 650);
    const list=[];
    for(let i=0;i<240;i++){ const b=document.createElement('i'); const foam=i%3===0; b.className=foam?'cx-foam':'cx-bubble'; const sz=foam?10+Math.random()*16:5+Math.random()*12; b.style.width=b.style.height=sz+'px'; fx.appendChild(b);
      const a=(-90+(Math.random()*44-22))*Math.PI/180, sp=(H/36)*(.65+Math.random()*.7);
      list.push({ el:b, x:n.x-sz/2, y:n.y-sz/2, vx:Math.cos(a)*sp+(Math.random()*2-1)*2.5, vy:Math.sin(a)*sp, t0:i*6, life:1700+Math.random()*900, ph:Math.random()*6.28 }); }
    run(fx, list, (p,t)=>{ const age=t-p.t0; if(age<0){ p.el.style.opacity=0; return; }
      p.vy+=.32; if(p.vy>4){ p.vy=4; p.vx=p.vx*.96+Math.sin(age/180+p.ph)*.35; } p.x+=p.vx; p.y+=p.vy;
      const o=1-age/p.life; if(o<=0) return false; p.el.style.opacity=Math.min(1,o*1.5); p.el.style.transform='translate('+p.x+'px,'+p.y+'px)'; });
    setTimeout(clinkSound, 1650);
  }
  // umbrella: a downpour over the whole screen, which stops when the umbrella opens
  function downpour(fx){
    const W=fx.clientWidth, H=fx.clientHeight, list=[];
    for(let i=0;i<170;i++){ const d=document.createElement('i'); d.className='cx-drop'; fx.appendChild(d);
      list.push({ el:d, x:Math.random()*(W+200)-100, y:-Math.random()*H, v:16+Math.random()*10, t0:Math.random()*300, stop:2000+Math.random()*500 }); }
    run(fx, list, (p,t)=>{ if(t<p.t0) return; p.y+=p.v; p.x-=p.v*.18; if(p.y>H){ if(t>p.stop) return false; p.y=-30; p.x=Math.random()*(W+200)-100; } p.el.style.transform='translate('+p.x+'px,'+p.y+'px) rotate(10deg)'; });
  }
  // no wind: a big tumbleweed rolls across the bottom of the screen; crickets
  const TUMBLE='<svg viewBox="0 0 60 60" aria-hidden="true"><g stroke="#B08A58" stroke-width="2.4" fill="none" stroke-linecap="round"><circle cx="30" cy="30" r="25"/><path d="M8 22q22 10 44 0M10 40q20-16 40 0M30 5q-12 25 0 50M18 9q22 22 22 44M44 9q-20 20-28 42M6 30q26 6 48-4"/></g></svg>';
  function tumbleweed(fx){
    const W=fx.clientWidth, H=fx.clientHeight, s=Math.max(70, Math.min(130, W/11)), tw=document.createElement('i'); tw.className='cx-tw'; tw.innerHTML=TUMBLE; tw.style.width=tw.style.height=s+'px'; fx.appendChild(tw);
    const ground=H*.86-s, p={ el:tw };
    run(fx, [p], (q,t)=>{ const u=Math.max(0,(t-700)/2900); if(u>1) return false; const x=-s+u*(W+2*s), bounce=Math.abs(Math.sin(u*Math.PI*5))*s*.7*(1-u*.4);
      q.el.style.transform='translate('+x+'px,'+(ground-bounce)+'px) rotate('+(u*1500)+'deg)'; });
    [[1900,'cri…'],[2700,'cri…']].forEach(([d,txt],i)=>setTimeout(()=>{ if(!fx.isConnected) return; const c=document.createElement('i'); c.className='cx-cri'; c.textContent=txt; c.style.left=(62+i*12)+'%'; fx.appendChild(c); }, d));
  }
  // paper plane: flies in, loops, sputters and nosedives; crumpled into a ball, bounced into the bin; a new plane takes off
  const PAPER=c=>'<svg viewBox="0 0 34 22" aria-hidden="true"><path d="M1 11L33 1L20 21L15 13z" fill="'+c+'"/><path d="M15 13L33 1" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>';
  const BALL='<svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="13" fill="#E8EEF5" stroke="#9AA8B8" stroke-width="1.5"/><path d="M6 12l7 3l-3 7M14 5l2 8l8-2M18 16l6 6M11 20l6-3" stroke="#9AA8B8" stroke-width="1.3" fill="none"/></svg>';
  const BIN='<svg viewBox="0 0 70 80" aria-hidden="true"><path d="M6 14h58l-7 62H13z" fill="#2C3A4A" stroke="#9AA8B8" stroke-width="2.5"/><path d="M2 10h66" stroke="#9AA8B8" stroke-width="5" stroke-linecap="round"/><path d="M24 26l2 40M35 26v40M46 26l-2 40" stroke="#5E6B7A" stroke-width="2.5" stroke-linecap="round"/></svg>';
  function paperPlane(fx){
    const W=fx.clientWidth, H=fx.clientHeight, k=Math.max(1.4, Math.min(2.6, W/520));
    const mk=(cls, html, w, h)=>{ const e=document.createElement('i'); e.className=cls; e.innerHTML=html; e.style.width=w+'px'; e.style.height=h+'px'; fx.appendChild(e); return e; };
    const p1=mk('cx-pl', PAPER('#E8EEF5'), 34*k, 22*k), ball=mk('cx-pl', BALL, 30*k, 30*k), p2=mk('cx-pl', PAPER('#14D3A9'), 34*k, 22*k), bin=mk('cx-bin', BIN, 70*k, 80*k);
    ball.style.opacity=0; p2.style.opacity=0;
    const groundY=H*.84, binX=W*.8, binTop=groundY-80*k+6;
    bin.style.transform='translate('+(binX-35*k)+'px,'+(groundY-80*k)+'px)';
    const R=Math.min(W,H)*.14, cx=W*.42, cy=H*.34-R, impact={ x:W*.56, y:groundY-12*k }, put=(e,x,y,a,w,h)=>{ e.style.transform='translate('+(x-w/2)+'px,'+(y-h/2)+'px) rotate('+a+'deg)'; };
    let last=null, trailT=0; const trail=(x,y,color)=>{ const d=document.createElement('i'); d.className='cx-trail'; d.style.background=color; d.style.transform='translate('+x+'px,'+y+'px)'; fx.appendChild(d); setTimeout(()=>d.remove(), 900); };
    const p={ el:p1 };
    run(fx, [p], (q,t)=>{
      let x, y;
      if(t<1100){ const u=t/1100; x=-0.06*W+u*(cx+0.06*W); y=H*.34+Math.sin(u*9)*10; }
      else if(t<2000){ const u=(t-1100)/900, f=Math.PI/2-u*2*Math.PI; x=cx+R*Math.cos(f); y=cy+R*Math.sin(f); }   // a full loop
      else if(t<2700){ const u=(t-2000)/700, e=u*u; x=cx+(impact.x-cx)*u; y=H*.34+(impact.y-H*.34)*e; x+=Math.sin(t/40)*4*(1-u); }
      else if(t<3800){
        if(p1.style.opacity!=='0'){ p1.style.opacity=0; ball.style.opacity=1; const puff=document.createElement('i'); puff.className='cx-puff'; puff.style.transform='translate('+(impact.x-40)+'px,'+(groundY-20)+'px)'; fx.appendChild(puff); }
        const u=(t-2700)/1100, mid=impact.x+(binX-impact.x)*.45, bx=u<.4?impact.x+(mid-impact.x)*(u/.4):mid+(binX-mid)*((u-.4)/.6), by=u<.4?impact.y-Math.sin(u/.4*Math.PI)*70*k:(()=>{ const v=(u-.4)/.6; return impact.y+(binTop-impact.y)*v-Math.sin(v*Math.PI)*150*k; })();
        put(ball, bx, by, u*720, 30*k, 30*k);
        if(u>.97 && !q.swish){ q.swish=1; ball.style.opacity=0; const s=document.createElement('i'); s.className='cx-swish'; s.textContent='Swish !'; s.style.transform='translate('+(binX-50)+'px,'+(binTop-90*k)+'px)'; fx.appendChild(s); }
        return;
      }
      else if(t<5000){ p2.style.opacity=1; const u=(t-3800)/1200, a0={x:.06*W,y:groundY}, c1={x:.35*W,y:groundY}, c2={x:.55*W,y:.1*H}, a1={x:1.08*W,y:.05*H};
        const b=(a,b2,c,d,s)=>Math.pow(1-s,3)*a+3*Math.pow(1-s,2)*s*b2+3*(1-s)*s*s*c+s*s*s*d; x=b(a0.x,c1.x,c2.x,a1.x,u); y=b(a0.y,c1.y,c2.y,a1.y,u);
        const ang=last?Math.atan2(y-last.y,x-last.x)*180/Math.PI:-30; put(p2, x, y, ang, 34*k, 22*k); if(t-trailT>28){ trailT=t; trail(x,y,'#14D3A9'); } last={x,y}; return; }
      else return false;
      const ang=last?Math.atan2(y-last.y,x-last.x)*180/Math.PI:0; put(p1, x, y, ang, 34*k, 22*k); if(t-trailT>34){ trailT=t; trail(x,y,'rgba(232,238,245,.8)'); } last={x,y};
    });
  }

  window.todoCelebrate=function(kind, info, force){
    if(!VARIANTS[kind]) return;
    document.querySelectorAll('.celebrate').forEach(n=>n.remove());
    const v=VARIANTS[kind].includes(force)?force:pick(kind), less=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // cxv-: the variant drawn (the cx- classes are the parts of the drawings)
    const el=document.createElement('div'); el.className='celebrate celebrate-'+kind+' cxv-'+v+(less?' cx-less':''); el.setAttribute('aria-live','polite'); el.dataset.variant=v;
    el.innerHTML='<div class="cx-fx"></div>'+(SVG[v]?'<svg class="cx-art" viewBox="0 0 260 240" aria-hidden="true">'+SVG[v]+'</svg>':'')
      +'<div class="cx-msg"><b>'+esc(MSG[v])+'</b>'+(info&&info.sub?'<span>'+esc(info.sub)+'</span>':'')+'</div>';
    document.body.appendChild(el);
    const fx=el.querySelector('.cx-fx');
    void el.offsetWidth; el.classList.add('cx-play');
    if(!less){
      if(kind==='won') confetti(fx, 80);
      if(v==='battery'){ const t=el.querySelector('.cx-pct'); let n=0; setTimeout(()=>{ const iv=setInterval(()=>{ n=Math.min(100,n+5); if(t) t.textContent=n+' %'; if(n>=100) clearInterval(iv); },45); },550); }
      if(v==='gun') setTimeout(()=>moneyGun(fx), 150);
      if(v==='gong') setTimeout(()=>gongHit(el, fx), 620);
      if(v==='champagne') setTimeout(()=>champagnePop(el, fx), 650);
      if(v==='umbrella') downpour(fx);
      if(v==='nowind'){ tromboneSound(); tumbleweed(fx); }
      if(v==='plane') paperPlane(fx);
    }
    const len=less?1800:LENGTH[v];
    setTimeout(()=>el.classList.add('out'), len-500);
    setTimeout(()=>el.remove(), len);
  };
})();
