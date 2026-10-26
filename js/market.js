// Todo — « Marché » tab (loaded before js/app.js): a ready-made PowerKlock dashboard, the figures behind « Copier pour un mail »
// and the call screen, the last figures drawn by the app when offline. Split out of js/app.js (code audit, lot 3).
window.TodoMarket=(function(){
  let app=null;   // what this part needs from js/app.js, given once at start-up (init)
  const $=id=>document.getElementById(id);
  const escapeHtml=(...a)=>app.escapeHtml(...a);
  const prefsToNote=(...a)=>app.prefsToNote(...a);
  const gsTab=(...a)=>app.gsTab(...a);
  const askText=(...a)=>app.askText(...a);
  const tell=(...a)=>app.tell(...a);
  const { pqIsoToFr, toISO }=window.TodoParse;
  // ---------- « Marché » : the market figures a producer talks about, read from the public PowerKlock API ----------
  // Plain GET, no key (https://tomsremy.github.io/PowerKlock/data/api.json). Every block names its source (the API's rule).
  // Only the few numbers shown are kept on this device, so the page and the call screen still show the last ones offline.
  const MK_BASE='https://tomsremy.github.io/PowerKlock/data/';
  const MK_SRC={ spot:'ENTSO-E Transparency Platform, via PowerKlock', m0:'CRE open data (Licence Ouverte) ; estimation et prévision PowerKlock', cap:'PowerKlock, à partir de RTE éCO2mix et ENTSO-E' };
  const MK_ZONES=[['FR','France'],['DE_LU','Allemagne'],['BE','Belgique'],['NL','Pays-Bas'],['ES','Espagne'],['CH','Suisse'],['IT_NORD','Italie Nord']];
  let marketData=null, marketLoading=null;
  try{ marketData=JSON.parse(localStorage.getItem('market-cache')||'null'); }catch(e){}
  const mkNum=(v,d)=>v==null || isNaN(v)?'—':Number(v).toLocaleString('fr-FR',{ minimumFractionDigits:d==null?1:d, maximumFractionDigits:d==null?1:d });
  const mkMonth=k=>{ const [y,m]=k.split('-'); return new Date(+y, +m-1, 1).toLocaleDateString('fr-FR',{ month:'short', year:'numeric' }).replace('.',''); };
  const mkDay=iso=>iso?new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' }):'';
  async function loadMarket(force){
    if(marketLoading) return marketLoading;
    if(!force && marketData && Date.now()-marketData.at<30*60000) return marketData;
    const get=async f=>{ const r=await fetch(MK_BASE+f, { cache:'no-cache' }); if(!r.ok) throw new Error(f+' '+r.status); return r.json(); };
    const now=new Date(), ym=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'), prevM=new Date(now.getFullYear(), now.getMonth()-1, 1);
    marketLoading=(async()=>{
      const [prices, cur, prev, m0, cap]=await Promise.all([get('prices.json'), get('history/monthly/'+ym(now)+'.json').catch(()=>null), get('history/monthly/'+ym(prevM)+'.json').catch(()=>null), get('cre_m0.json').catch(()=>null), get('history/fr_capture.json').catch(()=>null)]);
      const fr=(prices.zones||[]).find(z=>z.code==='FR'); if(!fr) throw new Error('FR');
      const days=[].concat(prev && prev.zones && prev.zones.FR || [], cur && cur.zones && cur.zones.FR || []).filter(x=>x && x.d).sort((a,b)=>a.d.localeCompare(b.d));
      const lastDay=days.filter(x=>Math.abs((x.avg||0)-fr.today)<0.06).pop()||days[days.length-1]||null;
      const out={ at:Date.now(), updated:prices.updated,
        spot:{ day:lastDay?lastDay.d:'', avg:fr.today, vs:fr.vsYday, min:fr.min, minH:fr.minHour, max:fr.max, maxH:fr.maxHour, neg:fr.negHours||0, peak:lastDay?lastDay.peakAvg:null, off:lastDay?lastDay.offAvg:null, ren:lastDay?lastDay.renPct:null, q:(fr.hourly||[]).slice(0,100) },
        days:days.slice(-30).map(x=>({ d:x.d, avg:x.avg, neg:x.negH||0 })),
        zones:MK_ZONES.map(([c,n])=>{ const z=(prices.zones||[]).find(x=>x.code===c); return z?{ c, n, avg:z.today, vs:z.vsYday, neg:z.negHours||0 }:null; }).filter(Boolean) };
      if(m0 && m0.official){ const o=m0.official, rows=[];
        const offM=Object.keys(o.monthly||{}).sort().slice(-3);
        offM.forEach(k=>rows.push({ m:k, base:o.monthly[k], wind:(o.wind||{})[k], solar:(o.solar||{})[k], how:'CRE' }));
        const lastOff=offM[offM.length-1]||'';
        Object.keys(m0.estimate||{}).sort().filter(k=>k>lastOff).forEach(k=>{ const e=m0.estimate[k]; rows.push({ m:k, base:e.base, wind:e.wind, solar:e.solar, how:'estimation', days:e.days }); });
        // a month the CRE published for the base only: its wind / solar come from the estimate
        rows.forEach(r=>{ const e=(m0.estimate||{})[r.m]; if(r.how==='CRE' && e){ if(r.wind==null){ r.wind=e.wind; r.est=true; } if(r.solar==null){ r.solar=e.solar; r.est=true; } } });
        (m0.forecast||[]).slice(0,3).forEach(f=>rows.push({ m:f.month, base:f.base, wind:f.wind, solar:f.solar, how:'prévision' }));
        const ann=Object.keys(o.annual||{}).sort().slice(-2).map(y=>({ y, v:o.annual[y] }));
        out.m0={ rows, ann, cur:m0.currentMonth }; }
      if(cap && cap.days && cap.days.length){ const F=cap.fields||[], ix=k=>F.indexOf(k)+1, last=cap.days[cap.days.length-1][0];
        const win=(label, from, to)=>{ const ds=cap.days.filter(x=>x[0]>=from && x[0]<=to); if(!ds.length) return null; const s=k=>ds.reduce((t,x)=>t+(x[ix(k)]||0),0);
          const base=s('pSum')/Math.max(1,s('pN')), sol=s('sE')?s('sR')/s('sE'):null, wnd=s('wE')?s('wR')/s('wE'):null;
          return { label, base, sol, wnd, solR:sol!=null?sol/base:null, wndR:wnd!=null?wnd/base:null, n:ds.length }; };
        const d30=toISO(new Date(new Date(last+'T12:00:00').getTime()-29*864e5)), y=last.slice(0,4);
        out.cap={ last, rows:[win('30 derniers jours', d30, last), win('Mois en cours', last.slice(0,7)+'-01', last), win('Depuis janvier', y+'-01-01', last), win('Année '+(y-1), (y-1)+'-01-01', (y-1)+'-12-31')].filter(Boolean) }; }
      marketData=out; try{ localStorage.setItem('market-cache', JSON.stringify(out)); }catch(e){}
      return out; })();
    try{ return await marketLoading; } finally { marketLoading=null; }
  }
  // the few words to open a call or a mail with
  function marketLine(){
    const m=marketData; if(!m || !m.spot) return '';
    const s=m.spot, sol=m.m0 && m.m0.rows.filter(r=>r.how==='CRE' && r.solar!=null && !r.est).pop(), c=m.cap && m.cap.rows[0];
    return ['Spot France du '+(s.day?pqIsoToFr(s.day):'dernier jour')+' : '+mkNum(s.avg)+' €/MWh'+(s.neg?' ('+mkNum(s.neg,1)+' h négatives)':''),
      sol?'M0 solaire '+mkMonth(sol.m)+' : '+mkNum(sol.solar)+' €/MWh':'', c && c.sol!=null?'capture solaire 30 j : '+mkNum(c.sol)+' €/MWh ('+Math.round(c.solR*100)+' % du prix moyen)':''].filter(Boolean).join(' · ');
  }
  function marketText(){
    const m=marketData; if(!m) return '';
    const s=m.spot, L=['Marché de l’électricité · '+(s.day?mkDay(s.day):''), '',
      'Spot France (day-ahead) : '+mkNum(s.avg)+' €/MWh'+(s.vs!=null?' ('+(s.vs>0?'+':'')+mkNum(s.vs)+' vs la veille)':'')+' · pointe '+mkNum(s.peak)+' · hors pointe '+mkNum(s.off)+' · min '+mkNum(s.min)+' à '+(s.minH||'')+' · max '+mkNum(s.max)+' à '+(s.maxH||'')+' · '+mkNum(s.neg,1)+' h à prix négatif'];
    if(m.m0){ L.push('', 'M0 (€/MWh) — base / éolien / solaire :'); m.m0.rows.forEach(r=>L.push('  '+mkMonth(r.m)+' : '+mkNum(r.base)+' / '+mkNum(r.wind)+' / '+mkNum(r.solar)+(r.how!=='CRE'?' ('+r.how+' PowerKlock)':r.est?' (éolien / solaire estimés)':' (CRE)'))); }
    if(m.cap){ L.push('', 'Prix capturés (€/MWh, en % du prix moyen) :'); m.cap.rows.forEach(r=>L.push('  '+r.label+' : solaire '+mkNum(r.sol)+' ('+Math.round(r.solR*100)+' %) · éolien '+mkNum(r.wnd)+' ('+Math.round(r.wndR*100)+' %) · moyenne '+mkNum(r.base))); }
    L.push('', 'Sources : '+MK_SRC.spot+' ; '+MK_SRC.m0+' ; '+MK_SRC.cap+'. Jours de livraison, heure de Paris.');
    return L.join('\n');
  }
  // charts drawn to scale: the day's 96 quarter-hours, then the last 30 days
  function mkDayChart(q){
    if(!q || !q.length) return '<p class="mk-empty">Pas de courbe pour ce jour.</p>';
    const W=640, H=200, pl=40, pr=8, pt=10, pb=24, lo=Math.min(0, ...q), hi=Math.max(...q, 1), y=v=>pt+(hi-v)/(hi-lo)*(H-pt-pb), x=i=>pl+i*(W-pl-pr)/(q.length-1);
    const step=hi-lo>300?100:hi-lo>120?50:hi-lo>60?20:10, ticks=[]; for(let t=Math.ceil(lo/step)*step; t<=hi; t+=step) ticks.push(t);
    const line=q.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
    return '<svg class="mk-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Prix au quart d’heure">'
      +ticks.map(t=>'<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(t)+'" y2="'+y(t)+'" class="mk-grid'+(t===0?' zero':'')+'"/><text x="'+(pl-6)+'" y="'+(y(t)+3.5)+'" class="mk-ax" text-anchor="end">'+t+'</text>').join('')
      // a 25-hour (or 23-hour) day: local hours shift by one after 3 h (cold audit: the hour change was not marked)
      +[0,6,12,18,24].map(h=>{ const shift=q.length===100 && h>=3?4:q.length===92 && h>=3?-4:0; return '<text x="'+x(Math.min(q.length-1,h*4+shift))+'" y="'+(H-6)+'" class="mk-ax" text-anchor="middle">'+h+' h</text>'; }).join('')
      +(q.length===100||q.length===92?'<text x="'+(W-pr)+'" y="'+(pt+10)+'" class="mk-ax" text-anchor="end">journée de '+(q.length/4)+' h (changement d\u2019heure)</text>':'')
      +'<path d="'+line+' L'+x(q.length-1)+' '+y(lo)+' L'+x(0)+' '+y(lo)+' Z" class="mk-area"/><path d="'+line+'" class="mk-line"/>'
      +q.map((v,i)=>v<0?'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="2.2" class="mk-neg"/>':'').join('')+'</svg>';
  }
  function mk30Chart(days){
    if(!days || !days.length) return '<p class="mk-empty">Pas d’historique.</p>';
    const W=640, H=200, pl=40, pr=8, pt=10, pb=24, hi=Math.max(...days.map(d=>d.avg), 1), lo=Math.min(0, ...days.map(d=>d.avg)), y=v=>pt+(hi-v)/(hi-lo)*(H-pt-pb), bw=(W-pl-pr)/days.length;
    const step=hi>300?100:hi>120?50:20, ticks=[]; for(let t=Math.ceil(lo/step)*step; t<=hi; t+=step) ticks.push(t);
    return '<svg class="mk-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Prix moyen des 30 derniers jours">'
      +ticks.map(t=>'<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(t)+'" y2="'+y(t)+'" class="mk-grid'+(t===0?' zero':'')+'"/><text x="'+(pl-6)+'" y="'+(y(t)+3.5)+'" class="mk-ax" text-anchor="end">'+t+'</text>').join('')
      +days.map((d,i)=>{ const top=y(Math.max(0,d.avg)), bot=y(Math.min(0,d.avg)); return '<rect x="'+(pl+i*bw+bw*.15).toFixed(1)+'" width="'+(bw*.7).toFixed(1)+'" y="'+top.toFixed(1)+'" height="'+Math.max(1,bot-top).toFixed(1)+'" class="mk-bar'+(d.neg?' has-neg':'')+'"><title>'+pqIsoToFr(d.d)+' : '+mkNum(d.avg)+' €/MWh'+(d.neg?' · '+mkNum(d.neg,1)+' h négatives':'')+'</title></rect>'; }).join('')
      +[0, Math.floor(days.length/2), days.length-1].map(i=>'<text x="'+(pl+i*bw+bw/2)+'" y="'+(H-6)+'" class="mk-ax" text-anchor="middle">'+escapeHtml(days[i].d.slice(8)+'/'+days[i].d.slice(5,7))+'</text>').join('')+'</svg>';
  }
  // The page shows a ready-made PowerKlock dashboard (its « solo » link: read-only, always up to date, PowerPoint export).
  // The templates are the site's own (General › My dashboard › templates); « Mon tableau » takes a link copied from the site.
  const MK_S=t=>({ t:'s', title:t, w:12, h:1 }), MK_W=(wid,w,h,p)=>Object.assign({ t:'w', wid, w, h }, p?{ p }:{});
  const MK_BOARDS=[
    { id:'orig', name:'Origination · France', label:'Origination France : forwards, prix capturés, M0, garanties d’origine', items:[
      MK_S('Prices & forwards'), MK_W('kpi-da',3,2,{ zone:'FR' }), MK_W('kpi-fuel',3,2,{ c:'eua' }), MK_W('kpi-go',3,2), MK_W('kpi-fr-nuclear',3,2),
      MK_W('pf-curve',6,5,{ country:'FR' }), MK_W('pf-history',6,5,{ country:'FR', tenor:'Y+1', win:'3Y' }),
      MK_S('Value of renewables'), MK_W('ren-cr',6,5,{ zone:'FR', window:'1Y' }), MK_W('ren-daily',6,5,{ zone:'FR', window:'1Y' }),
      MK_W('fr-m0',12,5,{ tech:'solar', view:'price', win:'2Y' }), MK_W('fr-m0-forecast',12,6),
      MK_S('Regions & capacity'), MK_W('fr-reg-lf',6,5), MK_W('cap-history',6,5,{ country:'FR' }),
      MK_S('Guarantees of origin'), MK_W('go-cal1',6,5), MK_W('go-cal',6,5)] },
    { id:'mu', name:'Market update', label:'Point marché : dans l’ordre de la présentation interne', items:[
      MK_S('1 · Supply'), MK_W('wx-outlook',6,5,{ series:'precip' }), MK_W('wx-outlook',6,5,{ series:'solar' }), MK_W('wx-outlook',6,5,{ series:'wind' }), MK_W('nuc-monthly-years',6,5),
      MK_W('gas-storage-years',6,5), MK_W('hydro-reservoirs',6,5,{ country:'FR' }),
      MK_S('2 · Demand'), MK_W('wx-outlook',6,5,{ series:'temp' }), MK_W('fr-load-normal',6,5),
      MK_S('3 · News and geopolitics'), MK_W('fuel-coal-oil',6,5), MK_W('news-latest',6,5),
      MK_S('4 · Prices'), MK_W('fr-cal-history',6,5,{ win:'3M' }), MK_W('fr-cal-drivers',6,5,{ win:'6M' }), MK_W('ttf-cal-history',6,5,{ win:'6M' }), MK_W('ttf-fwd-table',6,5),
      MK_W('fr-spot-monthly',6,5), MK_W('fr-spot-30d',6,5), MK_W('fr-spot-day',6,7,{ day:'latest' }), MK_W('fr-spot-day',6,7,{ day:'previous' })] },
    { id:'spot', name:'Spot trader · France', label:'Spot France : prix du jour, consommation, échanges', items:[
      MK_S('Today'), MK_W('kpi-da',2,2,{ zone:'FR' }), MK_W('kpi-da',2,2,{ zone:'DE_LU' }), MK_W('kpi-fr-load',2,2), MK_W('kpi-fr-net',2,2), MK_W('kpi-fr-nuclear',2,2), MK_W('kpi-hdd',2,2),
      MK_W('da-intraday',8,5), MK_W('cb-fr-avg',4,5), MK_S('France fundamentals'), MK_W('load-day',6,5,{ zone:'FR' }), MK_W('ren-intraday',6,5), MK_W('cb-intraday',12,5)] },
    { id:'fund', name:'Fundamentals', label:'Fondamentaux : combustibles, carbone, nucléaire, météo', items:[
      MK_S('Fuels & carbon'), MK_W('kpi-fuel',3,2,{ c:'eua' }), MK_W('kpi-fuel',3,2,{ c:'ttf' }), MK_W('kpi-fuel',3,2,{ c:'coal' }), MK_W('kpi-fuel',3,2,{ c:'brent' }),
      MK_W('fuel-eua-ttf',6,5), MK_W('fuel-switch',6,5), MK_W('fuel-storage',6,5), MK_W('spark-daily',6,5),
      MK_S('Supply & weather'), MK_W('nuc-hist',6,5), MK_W('hdd',6,5), MK_S('Forwards'), MK_W('fwd-power',6,5), MK_W('fwdc-ttf',6,5)] }
  ];
  const MK_SITE='https://tomsremy.github.io/PowerKlock/index.html';
  const mkB64u=bytes=>{ let b=''; bytes.forEach(x=>{ b+=String.fromCharCode(x); }); return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
  async function mkBoardUrl(bd){   // « z » + base64url of the raw-deflated JSON, as the site expects (« j » + plain JSON if the browser can't compress)
    const raw=new TextEncoder().encode(JSON.stringify({ n:bd.name, items:bd.items }));
    if(window.CompressionStream){ try{ const buf=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(); return MK_SITE+'#solo=z'+mkB64u(new Uint8Array(buf)); }catch(e){} }
    return MK_SITE+'#solo=j'+mkB64u(raw);
  }
  const mkPick=()=>{ try{ return localStorage.getItem('market-board')||'mu'; }catch(e){ return 'mu'; } };
  const mkOwn=v=>{ const m=/^https:\/\/tomsremy\.github\.io\/PowerKlock\/(?:index\.html)?#(?:solo|board)=([zj][A-Za-z0-9_-]+)$/.exec(String(v||'').trim()); return m?MK_SITE+'#solo='+m[1]:null; };
  async function renderMarket(force){
    const root=$('market-root'); if(!root) return; const e=escapeHtml, pick=mkPick(), own=mkOwn(pick), bd=MK_BOARDS.find(b=>b.id===pick)||(own?null:MK_BOARDS[0]);
    loadMarket(force).catch(()=>{});   // the figures behind « Copier pour un mail » and the call screen
    const head='<div class="mk-head"><div><h2>Marché de l’électricité</h2><span class="mk-upd">Tableau de bord PowerKlock, toujours à jour · sources citées sous chaque graphique</span></div>'
      +'<div class="mk-acts"><select class="mk-board" aria-label="Tableau de bord">'+MK_BOARDS.map(b=>'<option value="'+b.id+'"'+(bd && bd.id===b.id?' selected':'')+'>'+e(b.label)+'</option>').join('')+'<option value="own"'+(own?' selected':'')+'>Mon tableau (lien copié sur PowerKlock)…</option></select>'
      +'<button type="button" class="pipe-bar-btn mk-copy" title="Spot, M0 et prix capturés, prêts à coller dans un mail ou dans Teams">Copier pour un mail</button><a class="pipe-bar-btn mk-open" target="_blank" rel="noopener">Ouvrir en grand ↗</a><a class="pipe-bar-btn mk-site" href="'+MK_SITE.replace('index.html','')+'" target="_blank" rel="noopener" title="Le site PowerKlock, dans un nouvel onglet">Site PowerKlock ↗</a></div></div>';
    if(!navigator.onLine){ root.innerHTML=head; root.querySelector('.mk-open').remove(); mkCards(root); mkWire(root); return; }
    const url=own||await mkBoardUrl(bd);
    root.innerHTML=head+'<iframe class="mk-frame" title="Tableau de bord PowerKlock" loading="lazy" referrerpolicy="no-referrer"></iframe>';
    root.querySelector('.mk-frame').src=url; root.querySelector('.mk-open').href=url;
    mkWire(root);
  }
  function mkWire(root){
    const sel=root.querySelector('.mk-board');
    sel.onchange=async ()=>{ let v=sel.value;
      if(v==='own'){ const u=await askText('Colle le lien de ton tableau de bord PowerKlock (General › API › « A whole dashboard ») :', mkOwn(mkPick())||''); if(u==null){ renderMarket(); return; } if(!mkOwn(u)){ tell('Ce n’est pas un lien de tableau PowerKlock (il contient « #solo= »).'); renderMarket(); return; } v=u.trim(); }
      try{ localStorage.setItem('market-board', v); }catch(e2){} prefsToNote(); renderMarket(); };
    root.querySelector('.mk-copy').onclick=async ev=>{ const b=ev.currentTarget; try{ await loadMarket(); }catch(e2){}
      if(!marketData){ b.textContent='Pas de données (hors ligne ?)'; return; }
      navigator.clipboard.writeText(marketText()).then(()=>{ b.textContent='Copié ✓'; setTimeout(()=>{ b.textContent='Copier pour un mail'; }, 1800); }, ()=>{ b.textContent='Copie impossible'; }); };
  }
  // offline: the last figures read, drawn by the app
  function mkCards(root){
    const m=marketData, e=escapeHtml;
    if(!m){ root.insertAdjacentHTML('beforeend', '<div class="mk-load">Hors ligne, et aucun chiffre gardé pour l’instant.</div>'); return; }
    const s=m.spot, src=t=>'<p class="mk-src">Source : '+e(t)+'. Jours de livraison, heure de Paris.</p>';
    const card=(k,v,sub,cls)=>'<div class="mk-kpi'+(cls?' '+cls:'')+'"><span class="mk-k">'+e(k)+'</span><b>'+v+'</b><span class="mk-sub">'+sub+'</span></div>';
    const zeroH=(s.q||[]).filter(v=>v!=null && v<=0).length/4;   // cold audit: « 0 h négative » on a day with 7 h at 0 €
    const last30=m.days||[], avg30=last30.length?last30.reduce((t,d)=>t+d.avg,0)/last30.length:null, neg30=last30.reduce((t,d)=>t+d.neg,0);
    let h='<p class="mk-off">Hors ligne : derniers chiffres lus le '+e(new Date(m.at).toLocaleString('fr-FR',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }))+(s.day?' (spot du '+e(mkDay(s.day))+')':'')+'.</p>';
    h+='<div class="mk-kpis">'
      +card('Spot France', mkNum(s.avg)+'<small> €/MWh</small>', s.vs!=null?'<i class="'+(s.vs>0?'up':'down')+'">'+(s.vs>0?'▲ +':'▼ ')+mkNum(s.vs)+'</i> vs la veille':'moyenne du jour')
      +card('Pointe / hors pointe', mkNum(s.peak,0)+' <small>/</small> '+mkNum(s.off,0), 'pointe 8 h – 20 h, jours ouvrés')
      +card('Min · max', mkNum(s.min,0)+' <small>→</small> '+mkNum(s.max,0), 'à '+e(s.minH||'—')+' et à '+e(s.maxH||'—'))
      +card('Heures à prix négatif', mkNum(s.neg,1)+'<small> h</small>', (zeroH>s.neg?mkNum(zeroH,1)+' h à 0 € ou moins ce jour · ':'')+mkNum(neg30,1)+' h négatives sur 30 jours', s.neg||zeroH?'warn':'')
      +card('Moyenne 30 jours', mkNum(avg30)+'<small> €/MWh</small>', s.ren!=null?'renouvelables '+mkNum(s.ren,0)+' % du mix le '+e(pqIsoToFr(s.day)):'')
      +'</div>';
    h+='<div class="mk-grid2"><section class="mk-card"><h3>Prix au quart d’heure · '+e(s.day?pqIsoToFr(s.day):'')+'</h3>'+mkDayChart(s.q)+src(MK_SRC.spot)+'</section>'
      +'<section class="mk-card"><h3>Prix moyen par jour · 30 derniers jours</h3>'+mk30Chart(last30)+'<p class="mk-leg"><i class="b"></i>prix moyen du jour <i class="n"></i>jour avec des heures négatives</p>'+src(MK_SRC.spot)+'</section></div>';
    h+='<div class="mk-grid2">';
    if(m.m0){ h+='<section class="mk-card"><h3>M0 : prix de marché de référence (€/MWh)</h3><p class="mk-why">Le prix de référence de la CRE pour le complément de rémunération : le producteur touche la différence entre son tarif et le M0 de sa filière.</p>'
      +'<table class="mk-table"><thead><tr><th>Mois</th><th class="n">Base</th><th class="n">Éolien</th><th class="n">Solaire</th><th></th></tr></thead><tbody>'
      +m.m0.rows.map(r=>'<tr class="'+(r.how==='CRE'?'':'mk-est')+'"><td>'+e(mkMonth(r.m))+'</td><td class="n">'+mkNum(r.base)+'</td><td class="n">'+mkNum(r.wind)+'</td><td class="n">'+mkNum(r.solar)+'</td><td><span class="mk-tag '+(r.how==='CRE'?'off':r.how==='estimation'?'est':'fc')+'">'+(r.how==='CRE'?(r.est?'CRE · éol./sol. estimés':'CRE officiel'):r.how==='estimation'?'estimation'+(r.days?' · '+r.days+' j':''):'prévision')+'</span></td></tr>').join('')
      +'</tbody></table>'+(m.m0.ann.length?'<p class="mk-why">M0 annuel officiel : '+m.m0.ann.map(a=>e(a.y)+' : '+mkNum(a.v)+' €/MWh').join(' · ')+'</p>':'')+src(MK_SRC.m0)+'</section>'; }
    if(m.cap){ const best=m.cap.rows[2]||m.cap.rows[0], prevY=m.cap.rows[3];
      h+='<section class="mk-card"><h3>Prix capturés : ce que valent le solaire et l’éolien</h3><p class="mk-why">Le prix moyen touché par la production, comparé au prix moyen du marché. En dessous de 100 %, la filière produit surtout quand les prix sont bas.</p>'
      +'<table class="mk-table"><thead><tr><th>Période</th><th class="n">Prix moyen</th><th class="n">Solaire</th><th class="n">Éolien</th></tr></thead><tbody>'
      +m.cap.rows.map(r=>'<tr><td>'+e(r.label)+'</td><td class="n">'+mkNum(r.base)+'</td><td class="n">'+mkNum(r.sol)+' <span class="mk-rate'+(r.solR<.8?' low':'')+'">'+Math.round(r.solR*100)+' %</span></td><td class="n">'+mkNum(r.wnd)+' <span class="mk-rate'+(r.wndR<.8?' low':'')+'">'+Math.round(r.wndR*100)+' %</span></td></tr>').join('')
      +'</tbody></table>'+(best && prevY?'<aside class="mk-take"><b>À retenir</b> Le solaire capte '+Math.round(best.solR*100)+' % du prix moyen depuis janvier, contre '+Math.round(prevY.solR*100)+' % sur '+e(prevY.label.replace('Année ',''))+'.</aside>':'')+src(MK_SRC.cap)+'</section>'; }
    h+='</div>';
    if(m.zones && m.zones.length){ const mx=Math.max(...m.zones.map(z=>Math.abs(z.avg)),1);
      h+='<section class="mk-card"><h3>Spot chez les voisins · même jour (€/MWh)</h3><div class="mk-zones">'+m.zones.map(z=>'<div class="mk-zone'+(z.c==='FR'?' fr':'')+'"><span>'+e(z.n)+'</span><i style="width:'+Math.max(2,Math.abs(z.avg)/mx*100)+'%"></i><b>'+mkNum(z.avg)+'</b>'+(z.neg?'<em>'+mkNum(z.neg,1)+' h nég.</em>':'<em></em>')+'</div>').join('')+'</div>'+src(MK_SRC.spot)+'</section>'; }
    root.insertAdjacentHTML('beforeend', '<div class="mk-cards">'+h+'</div>');
  }
  window.todoExtraCommands=(window.todoExtraCommands||[]).concat([{ t:'Marché : prix spot, M0, captures', k:'marche prix spot m0 cre capture powerklock electricite', go:()=>gsTab('market') }]);
  return { init:a=>{ app=a; }, renderMarket, loadMarket, marketLine };
})();
