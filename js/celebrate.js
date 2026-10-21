/* Won / signed / lost animations of the pipeline: three of each, one drawn at random (never the same twice in a row).
   window.todoCelebrate(kind, { sub }[, variant]) with kind 'won' | 'signed' | 'lost' (variant: to show one in particular). They play over the page for a few
   seconds, never catch a click, and shrink to the message alone when the device asks for less motion. */
(function(){
  'use strict';
  const VARIANTS={ won:['panel','turbine','battery'], signed:['gun','gong','champagne'], lost:['umbrella','nowind','plane'] };
  const LENGTH={ panel:3400, turbine:3400, battery:3400, gun:6600, gong:3800, champagne:4000, umbrella:4000, nowind:4200, plane:3900 };
  const COLORS=['#14D3A9','#FFFD82','#ED6965','#7DD3FC','#8B7FB5','#CA6702'];
  const MSG={
    panel:'Offre acceptée ! 😎', turbine:'Offre acceptée ! 🚁', battery:'Offre acceptée ! ⚡ 100 %',
    gun:'Contrat signé ! 💶', gong:'Contrat signé ! 🔔', champagne:'Contrat signé ! 🥂',
    umbrella:'Offre perdue', nowind:'Offre perdue', plane:'Offre perdue'
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
    // signed 2: the gong has a face; struck, it wobbles, sees stars (spiral eyes) and says « GONG ! »
    gong:'<defs><radialGradient id="cx-gold" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#FFE9A3"/><stop offset=".55" stop-color="#E0B23A"/><stop offset="1" stop-color="#9C6B12"/></radialGradient></defs>'
      +'<path d="M58 226V36M202 226V36M46 34h168" stroke="#7A4E2A" stroke-width="9" stroke-linecap="round"/><path d="M46 34h168" stroke="#A8703C" stroke-width="3" stroke-linecap="round"/>'
      +'<g class="cx-grings" fill="none" stroke="#E8C547">'+[0,.18,.36].map(d=>'<circle class="cx-gring" cx="130" cy="122" r="58" stroke-width="2.5" style="--d:'+d+'s"/>').join('')+'</g>'
      +'<g class="cx-gong"><path d="M108 36l10 30M152 36l-10 30" stroke="#C9A04A" stroke-width="2"/><circle cx="130" cy="122" r="58" fill="url(#cx-gold)" stroke="#8A5A10" stroke-width="3"/>'
      +'<circle cx="130" cy="122" r="44" fill="none" stroke="#B8862B" stroke-width="1.5" opacity=".7"/>'
      +'<g class="cx-geyes" fill="#5A3A08"><ellipse cx="113" cy="112" rx="5" ry="7"/><ellipse cx="147" cy="112" rx="5" ry="7"/><circle cx="115" cy="109" r="1.8" fill="#FFF3C4"/><circle cx="149" cy="109" r="1.8" fill="#FFF3C4"/></g>'
      +'<g class="cx-gdizzy" stroke="#5A3A08" stroke-width="2" fill="none" stroke-linecap="round"><path d="M113 112m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-5 -1a5 5 0 1 1 9 2"/><path d="M147 112m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-5 -1a5 5 0 1 1 9 2"/></g>'
      +'<path class="cx-gsmile" d="M114 136q16 14 32 0" stroke="#5A3A08" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse class="cx-gmouth" cx="130" cy="140" rx="8" ry="10" fill="#5A3A08"/>'
      +'<circle cx="100" cy="128" r="7" fill="#F28C6B" opacity=".45"/><circle cx="160" cy="128" r="7" fill="#F28C6B" opacity=".45"/></g>'
      +'<g class="cx-gstars"><g class="cx-gorbit" fill="#FFE066">'+[0,120,240].map(a=>'<path transform="rotate('+a+' 130 50) translate(130 30)" d="M0-7l2 5l5 .5l-4 3.5l1.5 5l-4.5-3l-4.5 3l1.5-5l-4-3.5l5-.5z"/>').join('')+'</g></g>'
      +'<g class="cx-mallet"><path d="M236 226L176 150" stroke="#7A4E2A" stroke-width="6" stroke-linecap="round"/><ellipse cx="172" cy="145" rx="13" ry="15" fill="#B33A2E" transform="rotate(-38 172 145)"/></g>'
      +'<g class="cx-bang"><path d="M214 30l9 14l15-6l-4 15l15 6l-14 8l7 14l-16-3l-3 16l-11-12l-12 10l-1-16l-16-1l11-12l-9-13l16 1z" fill="#FFD23F" stroke="#E2463A" stroke-width="3" stroke-linejoin="round"/>'
      +'<text x="219" y="66" text-anchor="middle" font-family="Impact,\'Arial Black\',system-ui,sans-serif" font-weight="900" font-size="15" fill="#E2463A" transform="rotate(-12 219 62)">GONG!</text></g>',
    // signed 3: the bottle rocks, the cork pops (« POP ! »), a fountain of foam; it glides away and two flutes clink, bubbles rising
    champagne:'<g class="cx-foam" fill="#FFF6D0">'+[[-30,-64,0],[-12,-86,.04],[6,-96,.08],[22,-80,.02],[36,-58,.06],[-22,-44,.1],[14,-52,.12],[-4,-72,.14],[30,-36,.16],[-36,-28,.05],[0,-108,.11],[18,-100,.17]].map(([x,y,d])=>'<circle cx="130" cy="64" r="'+(3+Math.abs(x)%4)+'" style="--x:'+x+'px;--y:'+y+'px;--d:'+d+'s"/>').join('')+'</g>'
      +'<g class="cx-bottle"><path d="M118 230h24a9 9 0 0 0 9-9V128c0-16-9-24-11-33V68h-20v27c-2 9-11 17-11 33v93a9 9 0 0 0 9 9z" fill="#1F5A3A" stroke="#0F2E1E" stroke-width="2.5"/>'
      +'<path d="M124 132v74" stroke="#3E8A5E" stroke-width="5" stroke-linecap="round" opacity=".6"/><rect x="119" y="62" width="22" height="16" rx="3" fill="#E8C547"/>'
      +'<rect x="112" y="178" width="36" height="34" rx="3" fill="#F2E6C2"/><text x="130" y="199" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="10" fill="#7A5A10">SIGNÉ</text>'
      +'<g fill="#E8EEF5"><circle cx="122" cy="146" r="4"/><circle cx="138" cy="146" r="4"/><circle cx="123" cy="147" r="2" fill="#0F2E1E"/><circle cx="139" cy="147" r="2" fill="#0F2E1E"/></g>'
      +'<path class="cx-bsmile" d="M122 158q8 8 16 0" stroke="#E8EEF5" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse class="cx-bwow" cx="130" cy="160" rx="4.5" ry="5.5" fill="#0F2E1E" stroke="#E8EEF5" stroke-width="2"/></g>'
      +'<g class="cx-cork"><rect x="122" y="46" width="16" height="18" rx="5" fill="#C9955A" stroke="#8A5E30" stroke-width="1.5"/></g>'
      +'<g class="cx-pop"><path d="M190 40l7 10l12-4l-3 12l12 5l-11 6l5 11l-12-2l-3 12l-8-9l-10 8l-1-12l-12-1l8-9l-7-10l12 1z" fill="#FFD23F" stroke="#E2463A" stroke-width="2.5" stroke-linejoin="round"/>'
      +'<text x="194" y="69" text-anchor="middle" font-family="Impact,\'Arial Black\',system-ui,sans-serif" font-weight="900" font-size="13" fill="#E2463A" transform="rotate(10 194 64)">POP!</text></g>'
      +'<g class="cx-flute cx-fl"><path d="M50 96h30l-5 44q-10 8-20 0z" fill="rgba(255,236,160,.25)" stroke="#E8EEF5" stroke-width="2.5"/><path d="M54 114h22l-3 24q-8 6-16 0z" fill="#F2C94C"/>'
      +'<g class="cx-fbub" fill="#FFF6D0"><circle cx="60" cy="134" r="1.6" style="--d:0s"/><circle cx="66" cy="136" r="1.3" style="--d:.35s"/><circle cx="70" cy="132" r="1.5" style="--d:.7s"/></g><path d="M65 140v42M54 184h22" stroke="#E8EEF5" stroke-width="3" stroke-linecap="round"/></g>'
      +'<g class="cx-flute cx-fr"><path d="M180 96h30l-5 44q-10 8-20 0z" fill="rgba(255,236,160,.25)" stroke="#E8EEF5" stroke-width="2.5"/><path d="M184 114h22l-3 24q-8 6-16 0z" fill="#F2C94C"/>'
      +'<g class="cx-fbub" fill="#FFF6D0"><circle cx="190" cy="134" r="1.5" style="--d:.2s"/><circle cx="196" cy="136" r="1.3" style="--d:.55s"/><circle cx="200" cy="132" r="1.6" style="--d:.9s"/></g><path d="M195 140v42M184 184h22" stroke="#E8EEF5" stroke-width="3" stroke-linecap="round"/></g>'
      +'<g class="cx-clink" fill="#FFE066"><path d="M130 66l4 11l11 4l-11 4l-4 11l-4-11l-11-4l11-4z"/></g>'
      +'<text class="cx-tchin" x="130" y="52" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="20" fill="#FFE066" stroke="#7A5A10" stroke-width="1">Tchin !</text>',
    // lost 1: grey clouds gather and rain on the solar panel (the same one as « offer accepted »); it shivers, cries and sags into a puddle
    umbrella:'<ellipse class="cx-puddle" cx="130" cy="232" rx="70" ry="7" fill="#3E5A78" opacity=".7"/>'
      +'<g class="cx-rain" stroke="#8FB4D9" stroke-width="2" stroke-linecap="round">'
      +[[40,.1],[52,.4],[64,0],[76,.3],[88,.15],[100,.45],[112,.05],[124,.35],[136,.2],[148,.5],[160,.1],[172,.3],[184,0],[196,.4],[208,.25],[220,.15],[70,.55],[118,.6],[166,.62],[214,.5]].map(([x,d])=>'<line x1="'+x+'" y1="52" x2="'+(x-4)+'" y2="66" style="--d:'+d+'s"/>').join('')+'</g>'
      +'<g class="cx-cloud2"><g transform="translate(-64 8) scale(.8)"><path d="M84 44a20 20 0 0 1 8-38a28 28 0 0 1 52-6a22 22 0 0 1 34 18a14 14 0 0 1-4 26z" fill="#4A5563"/></g></g>'
      +'<g class="cx-cloud3"><g transform="translate(118 4) scale(.85)"><path d="M84 44a20 20 0 0 1 8-38a28 28 0 0 1 52-6a22 22 0 0 1 34 18a14 14 0 0 1-4 26z" fill="#4A5563"/></g></g>'
      +'<g class="cx-cloud"><path d="M84 44a20 20 0 0 1 8-38a28 28 0 0 1 52-6a22 22 0 0 1 34 18a14 14 0 0 1-4 26z" fill="#5E6B7A"/>'
      +'<path d="M112 16l10 5M150 16l-10 5" stroke="#2C3540" stroke-width="3" stroke-linecap="round"/><circle cx="118" cy="26" r="3" fill="#2C3540"/><circle cx="144" cy="26" r="3" fill="#2C3540"/><path d="M122 38q9-6 18 0" stroke="#2C3540" stroke-width="3" fill="none" stroke-linecap="round"/></g>'
      +'<g class="cx-slump"><g class="cx-shiver" transform="translate(0 24)"><path d="M118 168l-10 38h-10" stroke="#5B7A99" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M142 168l10 38h10" stroke="#5B7A99" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
      +'<rect x="70" y="80" width="120" height="90" rx="6" fill="#1E3A5F" stroke="#7FA9D6" stroke-width="3"/><path d="M110 80v90M150 80v90M70 110h120M70 140h120" stroke="#7FA9D6" stroke-width="2"/>'
      +'<path d="M95 100l14-5M165 100l-14-5" stroke="#E8EEF5" stroke-width="2.5" stroke-linecap="round"/><circle cx="104" cy="106" r="4" fill="#E8EEF5"/><circle cx="156" cy="106" r="4" fill="#E8EEF5"/>'
      +'<path class="cx-tear" d="M100 114q-3 6 0 8q3-2 0-8z" fill="#7DD3FC"/><path class="cx-tear t2" d="M160 114q-3 6 0 8q3-2 0-8z" fill="#7DD3FC"/>'
      +'<path d="M106 158q24-16 48 0" stroke="#E8EEF5" stroke-width="3" fill="none" stroke-linecap="round"/></g></g>',
    // lost 2: no wind: the same turbine as « offer accepted » slows down and stops; a tumbleweed; crickets
    nowind:'<g class="cx-sag"><path d="M126 82l-6 132h20l-6-132z" fill="#DDE5EE"/><rect x="120" y="70" width="22" height="14" rx="5" fill="#C9D3DE"/><g fill="#F2F6FA">'+blades('cx-slow')+'</g></g>'
      +'<g class="cx-tumble" stroke="#B08A58" stroke-width="1.8" fill="none"><circle cx="40" cy="201" r="13"/><path d="M29 195q11 6 22 0M31 207q9-10 18 0M40 188q-6 13 0 26M34 191q12 12 12 20"/></g>'
      +'<text class="cx-cri c1" x="176" y="190" font-family="system-ui,sans-serif" font-style="italic" font-weight="600" font-size="12" fill="#9AA8B8">cri…</text>'
      +'<text class="cx-cri c2" x="192" y="172" font-family="system-ui,sans-serif" font-style="italic" font-weight="600" font-size="12" fill="#9AA8B8">cri…</text>'
      +'<path d="M30 214h200" stroke="#2C3A4A" stroke-width="3" stroke-linecap="round"/>',
    // lost 3: the paper plane loops and nosedives into the bin
    plane:'<g class="cx-bin"><path d="M190 168h40l-5 46h-30z" fill="#2C3A4A" stroke="#9AA8B8" stroke-width="2"/><path d="M186 165h48" stroke="#9AA8B8" stroke-width="4" stroke-linecap="round"/><path d="M202 176l1 30M210 176v30M218 176l-1 30" stroke="#5E6B7A" stroke-width="2" stroke-linecap="round"/></g>'
      +'<g class="cx-swish"><text x="210" y="150" text-anchor="middle" font-family="Impact,\'Arial Black\',system-ui,sans-serif" font-weight="900" font-size="16" fill="#FFD23F" stroke="#E2463A" stroke-width="1">Swish !</text></g>'
      +'<path d="M20 214h220" stroke="#2C3A4A" stroke-width="3" stroke-linecap="round"/>'
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
  // small building blocks: a note (with an optional glide) and a burst of filtered noise
  function tone(f, at, dur, opt){
    try{ const o=opt||{}, a=ctx(), t=a.currentTime+at, osc=a.createOscillator(), g=a.createGain(); osc.type=o.type||'sine'; osc.frequency.setValueAtTime(f,t);
      if(o.to) osc.frequency.exponentialRampToValueAtTime(o.to,t+dur); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(o.vol||.12,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      osc.connect(g); g.connect(a.destination); osc.start(t); osc.stop(t+dur+.02); }catch(e){}
  }
  function hiss(at, dur, opt){
    try{ const o=opt||{}, a=ctx(), t=a.currentTime+at, len=Math.max(1,a.sampleRate*dur), nb=a.createBuffer(1,len,a.sampleRate), ch=nb.getChannelData(0); for(let i=0;i<len;i++) ch[i]=Math.random()*2-1;
      const src=a.createBufferSource(), f=a.createBiquadFilter(), g=a.createGain(); src.buffer=nb; f.type=o.filter||'bandpass'; f.frequency.setValueAtTime(o.f||1200,t); if(o.fto) f.frequency.exponentialRampToValueAtTime(o.fto,t+dur); f.Q.value=o.q||1;
      const v=o.vol||.1; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+(o.attack||.02)); g.gain.setValueAtTime(v,t+Math.max(.02,dur-(o.release||.1))); g.gain.linearRampToValueAtTime(0,t+dur);
      src.connect(f); f.connect(g); g.connect(a.destination); src.start(t); src.stop(t+dur); }catch(e){}
  }
  // a short bossa nova (about 3 s at 160 bpm): nylon-guitar chords in the bossa rhythm, the bass, a shaker and a few rim clicks
  function pluck(f, at, dur, vol){
    try{ const a=ctx(), t=a.currentTime+at, o1=a.createOscillator(), o2=a.createOscillator(), g=a.createGain(), lp=a.createBiquadFilter();
      o1.type='triangle'; o2.type='sine'; o1.frequency.value=f; o2.frequency.value=f*2.003; lp.type='lowpass'; lp.frequency.setValueAtTime(2600,t); lp.frequency.exponentialRampToValueAtTime(700,t+dur);
      const g2=a.createGain(); g2.gain.value=.25; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.008); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(a.destination); o1.start(t); o2.start(t); o1.stop(t+dur+.02); o2.stop(t+dur+.02); }catch(e){}
  }
  function bossaNova(){
    const st=60/160/4;   // one sixteenth
    const C=[261.6,329.6,392,493.9], Dm=[293.7,349.2,440,523.3], G7=[246.9,293.7,349.2,392], C9=[329.6,392,493.9,587.3];
    const chord=(notes, step, dur)=>notes.forEach((f,i)=>pluck(f, step*st+i*.012, dur||.45, .07));   // a light strum
    const bass=(f, step)=>pluck(f, step*st, .5, .16);
    [0,3,6,10,13].forEach(k=>chord(C,k)); [[0,130.8],[6,98],[8,130.8],[14,98]].forEach(([k,f])=>bass(f,k));
    [16,19].forEach(k=>chord(Dm,k)); [[16,146.8],[19,110]].forEach(([k,f])=>bass(f,k));
    [22,25].forEach(k=>chord(G7,k)); [[22,98],[25,123.5]].forEach(([k,f])=>bass(f,k));
    chord(C9, 28, 1.1); bass(130.8, 28); pluck(65.4, 28*st, 1.1, .07);
    for(let k=0;k<28;k+=2) hiss(k*st, .035, { filter:'highpass', f:6500, vol:k%4===0?.022:.014, attack:.004, release:.03 });   // shaker
    [0,3,6,10,12,16,19,22].forEach(k=>tone(1700, k*st, .025, { type:'square', vol:.018 }));   // rim clicks
  }
  // one little sound per animation (synthesized, quiet)
  const SOUND={
    panel(){ bossaNova(); },   // a little bossa nova while it dances
    turbine(){ hiss(.9,1.4,{ f:300, fto:2400, q:.8, vol:.07, attack:.5, release:.3 }); tone(1568,2.2,.5,{ vol:.08 }); tone(2093,2.28,.5,{ vol:.06 }); },   // whoosh, then « ding »
    battery(){ hiss(.4,.12,{ filter:'highpass', f:2000, vol:.12, attack:.005, release:.08 }); tone(1800,.4,.15,{ type:'square', to:200, vol:.05 }); tone(300,.6,1,{ type:'triangle', to:950, vol:.06 }); tone(1319,1.6,.4,{ vol:.08 }); tone(1760,1.68,.5,{ vol:.07 }); },   // zap, charging, ding
    gun(el){ tone(2637,.15,.5,{ vol:.07 }); tone(3136,.22,.6,{ vol:.06 }); hiss(.15,.08,{ filter:'highpass', f:4000, vol:.08, attack:.005, release:.06 }); for(let i=0;i<14;i++) hiss(.5+i*.13,.06,{ f:900+Math.random()*400, q:2, vol:.06, attack:.005, release:.05 });
      // when the gun leaves: the cash drawer « chunk », a bright « ka-ching » and a few coins
      const W=window.innerWidth, out=(W<700?2.25:2.65);
      setTimeout(()=>{ if(!el.isConnected) return; hiss(0,.09,{ filter:'lowpass', f:500, vol:.12, attack:.004, release:.07 }); tone(90,0,.12,{ vol:.1, to:60 });
        tone(2093,.07,.9,{ vol:.08 }); tone(2637,.07,.9,{ vol:.07 }); tone(3136,.13,1,{ vol:.07 }); tone(4186,.13,.7,{ vol:.04 });
        [.3,.38,.47,.53,.62].forEach((t,i)=>tone(3500+i*420,t,.12,{ vol:.03 })); }, out*1000); },   // « ka-ching », the shots, and the final « ka-ching »
    gong(el){ setTimeout(()=>{ if(el.isConnected) gongSound(); }, 620); },
    champagne(el){ setTimeout(()=>{ if(el.isConnected) popSound(); }, 900); hiss(1,1.1,{ filter:'highpass', f:5000, vol:.04, attack:.05, release:.6 }); setTimeout(()=>{ if(el.isConnected) clinkSound(); }, 2050); },   // pop, fizz, « ting »
    umbrella(){ hiss(.3,3.4,{ filter:'lowpass', f:1800, q:.5, vol:.05, attack:.8, release:.8 }); tone(392,1.7,.5,{ vol:.07 }); tone(330,2.15,.8,{ vol:.07 }); },   // rain, two sad notes
    nowind(){ tromboneSound(); },
    plane(){ hiss(.1,1.9,{ f:700, fto:1600, q:1.2, vol:.05, attack:.4, release:.4 }); hiss(2.05,.18,{ filter:'lowpass', f:600, vol:.14, attack:.005, release:.15 }); tone(110,2.05,.25,{ vol:.12, to:60 }); }   // whoosh, thud in the bin
  };
  function tromboneSound(){ // « wah wah wah waaah »
    try{ const a=ctx(), t0=a.currentTime, out=a.createGain(), lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; out.gain.value=.16; lp.connect(out); out.connect(a.destination);
      [[233,0,.38],[220,.42,.38],[208,.84,.38],[196,1.26,1.1]].forEach(([f,s,d],i)=>{ const o=a.createOscillator(), g=a.createGain(), t=t0+s; o.type='sawtooth'; o.frequency.setValueAtTime(f*1.03,t); o.frequency.linearRampToValueAtTime(f,t+.08);
        if(i===3){ const lfo=a.createOscillator(), lg=a.createGain(); lfo.frequency.value=6; lg.gain.value=5; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t+.2); lfo.stop(t+d); o.frequency.linearRampToValueAtTime(f*.94,t+d); }
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(1,t+.04); g.gain.setValueAtTime(1,t+d-.12); g.gain.linearRampToValueAtTime(0,t+d); o.connect(g); g.connect(lp); o.start(t); o.stop(t+d); }); }catch(e){}
  }

  const PLANE=c=>'<svg viewBox="0 0 34 22"><path d="M1 11L33 1L20 21L15 13z" fill="'+c+'"/><path d="M15 13L33 1" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>';

  window.todoCelebrate=function(kind, info, force){
    if(!VARIANTS[kind]) return;
    document.querySelectorAll('.celebrate').forEach(n=>n.remove());
    const v=VARIANTS[kind].includes(force)?force:pick(kind), less=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // cxv-: the variant drawn (the cx- classes are the parts of the drawings)
    const el=document.createElement('div'); el.className='celebrate celebrate-'+kind+' cxv-'+v+(less?' cx-less':''); el.setAttribute('aria-live','polite'); el.dataset.variant=v;
    el.innerHTML='<div class="cx-fx"></div>'+(SVG[v]?'<svg class="cx-art" viewBox="0 0 260 240" aria-hidden="true">'+SVG[v]+'</svg>':'')
      +(v==='plane'?'<div class="cx-planes"><div class="cx-plane cx-p1">'+PLANE('#E8EEF5')+'</div></div>':'')
      +'<div class="cx-msg"><b>'+esc(MSG[v])+'</b>'+(info&&info.sub?'<span>'+esc(info.sub)+'</span>':'')+'</div>';
    document.body.appendChild(el);
    const fx=el.querySelector('.cx-fx');
    // the paper planes fly on the drawing's scale
    if(v==='plane'){ const art=el.querySelector('.cx-art'), pl=el.querySelector('.cx-planes'); if(art && pl) pl.style.transform='translate(-50%,-58%) scale('+(art.getBoundingClientRect().width/260)+')'; }
    void el.offsetWidth; el.classList.add('cx-play');
    if(!less){
      if(kind==='won') confetti(fx, 80);
      if(v==='battery'){ const t=el.querySelector('.cx-pct'); let n=0; setTimeout(()=>{ const iv=setInterval(()=>{ n=Math.min(100,n+5); if(t) t.textContent=n+' %'; if(n>=100) clearInterval(iv); },45); },550); }
      if(v==='gun') setTimeout(()=>moneyGun(fx), 150);
      if(v==='gong' || v==='champagne') confetti(fx, 70);
      if(SOUND[v]) SOUND[v](el);
    }
    const len=less?1800:LENGTH[v];
    setTimeout(()=>el.classList.add('out'), len-500);
    setTimeout(()=>el.remove(), len);
  };
})();
