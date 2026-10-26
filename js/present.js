// Todo — meeting view of the pipeline and « Présenter » (loaded before js/app.js): the table, its columns and phases, the
// consultant-style deck and its PowerPoint export. Split out of js/app.js (code audit, lot 3).
window.TodoPresent=(function(){
  const api={};
  // everything this part uses from js/app.js, given once when the app has finished loading
  api.init=function(app){
    const { $, meetCopyShort, MAP_PHASES, MEET_COLS, MEET_PHASES, MES_WEIGHTS, OPP_STAGES, PIPE_PHASES, WHO, WHO_COLORS, activeTasks, buildHistory, caractValue, daysInStage, escapeHtml, fmtKwc, fmtMwc, kwcNum, loadScript, meetBlockKey, meetBlockName, meetCopy, meetData, meetHiddenCols, meetPhasesOn, meetPick, meetPrint, meetTotal, meetVis, meetVisuals, meetXlsx, mesForecast, openOppDetail, openRequestDetail, oppName, oppStage, plainLinks, pqNum, prefsToNote, renderPipeline, stageLabel, stageTaskOf, toISO }=app;
    let meetColsOpen=false;   // the « Colonnes ▾ » chips shown
  // ---------- « Présenter » : the meeting as a consultant's deck (pyramid principle): the answer on slide 1, then one message
  // per slide that details it — an action title (a sentence with a number), one exhibit, « À retenir », source and page; the deals in appendix ----------
  const loadPptx=()=>loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', ()=>!!window.PptxGenJS, 'PowerPoint');

  const pxHex=c=>{ const m=/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/.exec(c||''); if(!m || (m[4]!=null && +m[4]<0.08)) return null; return [m[1],m[2],m[3]].map(x=>Math.round(+x).toString(16).padStart(2,'0')).join('').toUpperCase(); };
  function slideToPptx(pptx, el){
    const sl=pptx.addSlide(), R=el.getBoundingClientRect(), k=13.333/R.width, pt=px=>Math.max(6, Math.round(px*k*72*10)/10);
    const at=r=>({ x:(r.left-R.left)*k, y:(r.top-R.top)*k, w:Math.max(.02, r.width*k), h:Math.max(.02, r.height*k) });
    const cs0=getComputedStyle(el), grad=/rgba?\([^)]*\)/.exec(cs0.backgroundImage||'');
    sl.background={ color:(cs0.backgroundImage!=='none' && grad && pxHex(grad[0]))||pxHex(cs0.backgroundColor)||'FFFFFF' };
    const runOf=(txt, cs)=>({ text:cs.textTransform==='uppercase'?txt.toUpperCase():txt, options:{ bold:+cs.fontWeight>=600, italic:cs.fontStyle==='italic', color:pxHex(cs.color)||'0F1B2D', fontSize:pt(parseFloat(cs.fontSize)) } });
    const runsOf=node=>{ const out=[]; node.childNodes.forEach(c=>{
        if(c.nodeType===3){ const t=c.textContent.replace(/\s+/g,' '); if(t.trim()) out.push(runOf(t, getComputedStyle(node))); }
        else if(c.nodeType===1){ const cs=getComputedStyle(c); if(cs.display==='none') return; if(cs.display==='inline'){ const t=c.innerText.replace(/\s+/g,' '); if(t.trim()) out.push(runOf(t, cs)); } } });
      if(out.length){ out[0].text=out[0].text.replace(/^\s+/,''); out[out.length-1].text=out[out.length-1].text.replace(/\s+$/,''); }
      return out.filter(r=>r.text); };
    const isBlockText=n=>{ const cs=getComputedStyle(n); return cs.display!=='inline' && cs.display!=='none' && [...n.childNodes].some(c=>(c.nodeType===3 && c.textContent.trim()) || (c.nodeType===1 && getComputedStyle(c).display==='inline' && c.innerText.trim())); };
    el.querySelectorAll('*').forEach(n=>{
      if(n.closest('table') && n.tagName!=='TABLE') return;
      const cs=getComputedStyle(n), r=n.getBoundingClientRect(); if(cs.display==='none' || cs.visibility==='hidden' || r.width<1 || r.height<1) return;
      if(n.tagName==='TABLE'){
        const rows=[...n.rows].map(tr=>[...tr.cells].map(td=>{ const c=getComputedStyle(td), runs=runsOf(td), bg=pxHex(c.backgroundColor)||pxHex(getComputedStyle(tr).backgroundColor);
          const bb=parseFloat(c.borderBottomWidth)>0?{ type:'solid', pt:Math.max(.5, parseFloat(c.borderBottomWidth)*k*72), color:pxHex(c.borderBottomColor)||'DDE3EA' }:{ type:'none' };
          return { text:runs.length?runs:'', options:Object.assign({ align:c.textAlign==='right'?'right':'left', valign:'middle', margin:[0,4,0,4], border:[{ type:'none' },{ type:'none' },bb,{ type:'none' }] }, bg?{ fill:{ color:bg } }:{}, td.colSpan>1?{ colspan:td.colSpan }:{}) }; }));
        const full=[...n.rows].find(tr=>tr.cells.length===Math.max(...[...n.rows].map(x=>x.cells.length)));
        sl.addTable(rows, Object.assign(at(r), { colW:[...full.cells].map(td=>td.getBoundingClientRect().width*k), rowH:[...n.rows].map(tr=>tr.getBoundingClientRect().height*k), fontFace:'Arial', autoPage:false }));
        return; }
      const bg=pxHex(cs.backgroundColor), rad=parseFloat(cs.borderTopLeftRadius)||0;
      if(bg) sl.addShape(rad>=Math.min(r.width,r.height)/2-1 && Math.abs(r.width-r.height)<2?'ellipse':'rect', Object.assign(at(r), { fill:{ color:bg }, line:{ type:'none' } }));
      [['Top',0],['Bottom',0],['Left',1],['Right',1]].forEach(([sd,vert])=>{ const w=parseFloat(cs['border'+sd+'Width']), col=pxHex(cs['border'+sd+'Color']); if(!(w>=.5) || !col || cs['border'+sd+'Style']==='none') return;
        const b={ left:r.left, top:r.top, width:vert?w:r.width, height:vert?r.height:w }; if(sd==='Bottom') b.top=r.bottom-w; if(sd==='Right') b.left=r.right-w;
        sl.addShape('rect', Object.assign(at(b), { fill:{ color:col }, line:{ type:'none' } })); });
      if(n.matches('.ps-exec-r li')){ const d=r.height>0?Math.min(r.height*.6, R.width*.028):0, cb=getComputedStyle(n,'::before');   // the numbered circles are drawn by CSS
        const box={ left:r.left, top:r.top+(r.height-d)/2, width:d, height:d }; sl.addShape('ellipse', Object.assign(at(box), { fill:{ color:pxHex(cb.backgroundColor)||'0F1B2D' }, line:{ type:'none' } }));
        sl.addText(String([...n.parentNode.children].indexOf(n)+1), Object.assign(at(box), { align:'center', valign:'middle', margin:0, bold:true, color:'FFFFFF', fontSize:pt(parseFloat(cb.fontSize)||14), fontFace:'Arial' })); }
      if(isBlockText(n)){ const runs=runsOf(n); if(!runs.length) return;
        // where the text itself sits (a label above it, drawn by a block child, keeps its own place)
        const own=[...n.childNodes].filter(c=>(c.nodeType===3 && c.textContent.trim()) || (c.nodeType===1 && getComputedStyle(c).display==='inline' && c.innerText.trim()));
        const rg=document.createRange(); rg.setStartBefore(own[0]); rg.setEndAfter(own[own.length-1]); const tr=rg.getBoundingClientRect();
        const pl=parseFloat(cs.paddingLeft)+parseFloat(cs.borderLeftWidth||0), pr=parseFloat(cs.paddingRight)+parseFloat(cs.borderRightWidth||0);
        const one=tr.height<parseFloat(cs.fontSize)*1.9, align=cs.textAlign==='right' || cs.textAlign==='end'?'right':cs.textAlign==='center'?'center':'left';
        let left=r.left+pl, width=Math.max(4, r.width-pl-pr);
        if(/grid|flex/.test(cs.display)){ left=tr.left; width=Math.max(4, Math.min(tr.width, r.right-pr-tr.left)); }   // a loose text inside a grid or flex row has its own cell
        if(cs.textOverflow==='ellipsis' && n.scrollWidth>n.clientWidth+1 && runs.length===1){ const keep=Math.max(1, Math.floor(runs[0].text.length*n.clientWidth/n.scrollWidth)-1); runs[0].text=runs[0].text.slice(0,keep).trimEnd()+'…'; }
        if(one){ const extra=width*.06+6; width+=extra; if(align==='right') left-=extra; else if(align==='center') left-=extra/2; }   // PowerPoint's fonts run a little wider: one line stays one line
        sl.addText(runs, Object.assign(at({ left, top:tr.top, width, height:Math.max(4, tr.height) }), { margin:0, valign:'top', align, fontFace:'Arial', wrap:!one, lineSpacingMultiple:.95 })); }
    });
  }
  function meetPresent(groups){
    const list=groups.flatMap(g=>g.list); if(!list.length) return;
    const e=escapeHtml, date=new Date().toLocaleDateString('fr-FR',{ day:'numeric', month:'long', year:'numeric' });
    const mw=k=>fmtMwc(k), kwOf=l=>l.reduce((x,o)=>x+kwcNum(o),0), daysOf=o=>daysInStage(o), pct=(a,b)=>Math.round(a/Math.max(1,b)*100);
    const plural=(n,w)=>n+' '+w+(n>1?'s':'');
    const kw=kwOf(list), likely=list.reduce((x,o)=>x+kwcNum(o)*(MES_WEIGHTS[o.stage]||0),0), mwh=list.reduce((x,o)=>x+(pqNum(String(o.mwh||''))||0),0);
    const stuck=list.filter(o=>{ const d=daysOf(o); return d!=null && d>15; }).sort((a,b)=>daysOf(b)-daysOf(a));
    // the blocks (a lot, a request at one step, a plant alone), the unit people talk about in the meeting
    const blocks=[]; { const m=new Map(); groups.forEach(g=>g.list.forEach(o=>{ const k=meetBlockKey(o); if(!m.has(k)){ m.set(k,{ g, list:[] }); blocks.push(m.get(k)); } m.get(k).list.push(o); })); }
    const bInfo=bk=>{ const o=bk.list[0], st=oppStage(o.stage), d=daysOf(o), name=meetBlockName(o);
      const ids=new Set(bk.list.map(x=>x.id).concat(o.requestId?[o.requestId]:[])), tk=activeTasks().filter(t=>t.opportunityId && ids.has(t.opportunityId)).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'))[0];
      return { o, st, d, kw:kwOf(bk.list), n:bk.list.length, label:(o.company||'')+(bk.list.length>1 && name?' — '+name:bk.list.length===1?' — '+oppName(o):''),
        who:st?(st.who==='Com'?'Commercial':WHO[st.who]||st.who):'', next:(tk && plainLinks(tk.title||'').replace(/\s+—\s+.*$/,'').trim())||(st?stageTaskOf(st, o):'') }; };
    // the facts every slide is built from
    const steps=OPP_STAGES.map(st=>{ const l=list.filter(o=>o.stage===st.key); return { st, n:l.length, kw:kwOf(l) }; }).filter(x=>x.n);
    const bySize=steps.slice().sort((a,b)=>b.kw-a.kw), big=bySize[0], big2=bySize[1];
    const phases=groups.filter(g=>g.list.length).map(g=>({ g, kw:kwOf(g.list), color:(MAP_PHASES.find(p=>p[0]===g.phase.key)||[0,0,'#7DA2CF'])[2], short:g.phase.label.split(' · ')[0] }));
    const who={}; list.forEach(o=>{ const st=oppStage(o.stage); if(!st) return; const w=st.who==='SC'?'Ops':st.who; (who[w]=who[w]||[]).push(o); });
    const whoOrder=['Com','Ops','Jur','Client','Dir'].filter(w=>who[w]), whoLead=whoOrder.slice().sort((a,b)=>who[b].length-who[a].length)[0];
    const whoName=w=>w==='Com'?'Le commercial':w==='Ops'?'Ops':w==='Jur'?'Le Juridique':w==='Client'?'Les producteurs':'La Direction';
    const lateOf=l=>l.filter(o=>{ const d=daysOf(o); return d!=null && d>15; }).length, avgOf=l=>{ const ds=l.map(daysOf).filter(d=>d!=null); return ds.length?Math.round(ds.reduce((x,y)=>x+y,0)/ds.length):null; };
    const fc=mesForecast(list), fcPeak=(()=>{ const cols=[...fc.chart.querySelectorAll('.pd-mes-col')].map(c=>({ q:c.querySelector('.q').textContent, v:c.querySelector('.v').textContent })).filter(c=>c.v); return cols.sort((a,b)=>pqNum(b.v)-pqNum(a.v))[0]; })();
    // the deck's sections (the tracker at the top of each slide) and the slides
    const SECTIONS=['Synthèse','Étapes','Dossiers','Mises en service','Qui a la main','Attention'];
    const slides=[]; const add=o=>{ slides.push(o); return slides.length; };
    const takeaway=t=>'<aside class="ps-take"><span class="ps-k">À retenir</span>'+e(t)+'</aside>';
    // 1. the answer: every key figure and the four messages, each pointing to the slide that details it
    const S1=add({ sec:'Synthèse' });
    const pStep=add({ sec:'Étapes', title:'« '+big.st.label+' » concentre '+mw(big.kw)+', soit '+pct(big.kw,kw)+' % du volume en jeu',
      body:'<div class="ps-bars ps-fill">'+steps.map(x=>'<div class="ps-bar"><span class="l">'+e(x.st.label)+'</span><span class="b"><i style="width:'+Math.max(2,x.kw/bySize[0].kw*100)+'%;background:'+(MAP_PHASES.find(p=>p[0]===x.st.phase)||[0,0,'#7DA2CF'])[2]+'"></i></span><span class="v">'+e(mw(x.kw))+'</span><span class="n">'+plural(x.n,'install.').replace('install.s','install.')+'</span></div>').join('')+'</div>'
        +takeaway(big2?'Après « '+big.st.label+' », c’est « '+big2.st.label+' » qui pèse le plus ('+mw(big2.kw)+').':'Tout le volume est à cette étape.') });
    // dossiers: one table for every phase (a line per phase inside), cut into balanced pages so none is half empty
    let pDeals=null;
    { const rowsAll=[]; phases.forEach(ph=>blocks.filter(b=>b.g===ph.g).map(bInfo).sort((a,b)=>b.kw-a.kw).forEach(r=>rowsAll.push(Object.assign(r, { ph }))));
      const pages=Math.max(1, Math.ceil((rowsAll.length+phases.length)/11)), per=Math.ceil(rowsAll.length/pages), lead=phases.slice().sort((a,b)=>b.kw-a.kw)[0];
      for(let pg=0; pg<pages; pg++){ const part=rowsAll.slice(pg*per, (pg+1)*per); if(!part.length) break; const late=part.filter(r=>r.d!=null && r.d>15);
        let body='', last=null;
        part.forEach(r=>{ if(r.ph!==last){ const nPh=rowsAll.filter(x=>x.ph===r.ph).length; body+='<tr class="ps-ph"><td colspan="6"><i style="background:'+r.ph.color+'"></i>'+e(r.ph.short)+'<span>'+plural(nPh,'dossier')+' · '+e(mw(r.ph.kw))+(last===null && pg && rowsAll[pg*per-1].ph===r.ph?' · suite':'')+'</span></td></tr>'; last=r.ph; }
          body+='<tr><td><b>'+e(r.label)+'</b>'+(r.n>1?'<small> · '+r.n+' install.</small>':'')+'</td><td class="n">'+e(r.kw?mw(r.kw):'—')+'</td><td>'+e(r.st?stageLabel(r.o.stage, r.o):'')+'</td><td>'+e(r.who)+'</td><td class="n'+(r.d!=null && r.d>15?' warn':'')+'">'+(r.d!=null?r.d+' j':'—')+'</td><td>'+e(r.next)+'</td></tr>'; });
        const n=add({ sec:'Dossiers', title:plural(blocks.length,'dossier')+' en cours, '+mw(kw)+' : '+lead.short+' en porte '+pct(lead.kw,kw)+' %'+(pages>1?' ('+(pg+1)+'/'+pages+')':''),
          body:'<div class="ps-fill"><table class="ps-table ps-table-fill"><thead><tr><th>Dossier</th><th class="n">Puissance</th><th>Étape</th><th>Chez</th><th class="n">Depuis</th><th>Prochaine action</th></tr></thead><tbody>'+body+'</tbody></table></div>'
            +takeaway(late.length?plural(late.length,'dossier')+(pages>1?' de cette page':'')+' attend'+(late.length>1?'ent':'')+' depuis plus de 15 jours : '+[...new Set(late.map(r=>r.label.split(' — ')[0]))].slice(0,3).join(', ')+'.':'Aucun de ces dossiers n’attend depuis plus de 15 jours.') });
        if(!pDeals) pDeals=n; } }
    const pMes=fc.tot?add({ sec:'Mises en service', title:mw(fc.tot)+' probables à mettre en service d’ici deux ans'+(fcPeak?', surtout au '+fcPeak.q.replace(/(\d\d)$/,'20$1'):''),
      body:'<div class="ps-chart ps-fill">'+fc.chart.outerHTML+'</div><p class="ps-note">Barre claire : en jeu · foncée : probable, pondéré par l’étape (pricing 25 %, offre en attente 40 %, KYC 60 %, signature 90 %, signé 100 %). Chiffre : MWc probables.</p>'
        +takeaway('Sur '+mw(fc.all)+' en jeu, '+mw(fc.tot)+' sont probables : c’est le volume sur lequel on peut compter.') }):null;
    const pWho=add({ sec:'Qui a la main', title:whoName(whoLead)+' a la main sur '+plural(who[whoLead].length,'dossier')+' ('+mw(kwOf(who[whoLead]))+')',
      body:'<div class="ps-who ps-fill">'+whoOrder.map(w=>{ const l=who[w], avg=avgOf(l), late=lateOf(l);
        const top=[...new Map(l.slice().sort((a,b)=>(daysOf(b)||0)-(daysOf(a)||0)).map(o=>[meetBlockKey(o), o])).values()], max=5;
        return '<div class="ps-who-c"><span class="ps-chip" style="--c:'+WHO_COLORS[w]+'">'+e(w==='Com'?'Commercial':WHO[w])+'</span><b>'+l.length+'</b><span>'+e(mw(kwOf(l)))+'</span><em'+(late?' class="warn"':'')+'>'+(avg!=null?avg+' j en moyenne':'')+(late?' · '+late+' > 15 j':'')+'</em>'
          +'<ul class="ps-who-l">'+top.slice(0,max).map(o=>{ const d=daysOf(o); return '<li><span>'+e(o.company||oppName(o))+'</span><i'+(d!=null && d>15?' class="warn"':'')+'>'+(d!=null?d+' j':'')+'</i></li>'; }).join('')+(top.length>max?'<li class="more">+ '+(top.length-max)+' autres</li>':'')+'</ul></div>'; }).join('')+'</div>'
        +takeaway(who.Ops?'Ops porte '+plural(who.Ops.length,'dossier')+(lateOf(who.Ops)?', dont '+lateOf(who.Ops)+' depuis plus de 15 jours : à relancer.':' ; rien de bloqué de son côté.'):'Aucun dossier n’attend Ops.') });
    const pAtt=add({ sec:'Attention', title:stuck.length?plural(stuck.length,'dossier')+' à débloquer, le plus ancien depuis '+daysOf(stuck[0])+' jours':'Aucun dossier bloqué depuis plus de 15 jours',
      body:stuck.length?'<div class="ps-cards ps-fill" style="--cols:'+Math.min(4, stuck.slice(0,8).length)+'">'+stuck.slice(0,8).map(o=>{ const st=oppStage(o.stage), r=bInfo({ list:[o] }), nt=(o.notesLog||[]).filter(x=>x && x.text).sort((x,y)=>y.at-x.at)[0];
          return '<div class="ps-card"><span class="ps-k">'+e(stageLabel(o.stage, o))+' · '+e(st?(st.who==='Com'?'Commercial':WHO[st.who]||st.who):'')+'</span><b class="ps-card-t">'+e(o.company||'')+'</b><span class="ps-card-s">'+e(oppName(o))+(kwcNum(o)?' · '+e(mw(kwcNum(o))):'')+'</span>'
            +'<strong class="warn">'+daysOf(o)+' j</strong><span class="ps-card-s">sans bouger</span><p><span class="ps-k">Prochaine action</span>'+e(r.next||'—')+'</p>'+(nt?'<p class="ps-card-n"><span class="ps-k">Dernier échange · '+e(new Date(nt.at).toLocaleDateString('fr-FR'))+'</span>'+e(nt.text.length>110?nt.text.slice(0,110)+'…':nt.text)+'</p>':'')+'</div>'; }).join('')+'</div>'
        +takeaway('Décider en séance qui relance qui, et pour quand.'):takeaway('Rien n’est à la même étape depuis plus de 15 jours.') });
    // the answer, written now that every page number is known
    const msgs=[
      { b:'« '+big.st.label+' » concentre '+mw(big.kw)+' ('+pct(big.kw,kw)+' %)', s:plural(big.n,'installation')+(big2?' ; ensuite « '+big2.st.label+' » ('+mw(big2.kw)+')':''), p:pStep },
      { b:whoName(whoLead)+' a la main sur '+plural(who[whoLead].length,'dossier'), s:whoOrder.filter(w=>w!==whoLead).map(w=>(w==='Com'?'commercial':WHO[w])+' '+who[w].length).join(' · '), p:pWho },
      fc.tot?{ b:mw(fc.tot)+' probables à mettre en service d’ici deux ans', s:fcPeak?'Le plus au '+fcPeak.q.replace(/(\d\d)$/,'20$1')+' ('+fcPeak.v+' MWc)':'', p:pMes }:null,
      { b:stuck.length?plural(stuck.length,'dossier')+' bloqué'+(stuck.length>1?'s':'')+' depuis plus de 15 jours':'Aucun dossier bloqué', s:[...new Map(stuck.map(o=>[o.company||'', daysOf(o)])).entries()].slice(0,3).map(([c,d])=>c+' ('+d+' j)').join(' · '), p:pAtt, warn:!!stuck.length }
    ].filter(Boolean);
    slides[S1-1]={ sec:'Synthèse', exec:true, title:mw(likely)+' probables sur '+mw(kw)+' en jeu'+(stuck.length?' ; '+plural(stuck.length,'dossier')+' à débloquer':''),
      body:'<div class="ps-exec"><div class="ps-exec-l">'
        +[[mw(kw),'en jeu'],[mw(likely),'probables'],[String(list.length),'installations · '+plural(blocks.length,'dossier')],[mwh?(mwh>=1000?(Math.round(mwh/100)/10).toLocaleString('fr-FR')+' GWh':Math.round(mwh).toLocaleString('fr-FR')+' MWh'):'—','par an (P50)']].map(([v,l])=>'<div class="ps-ex-k"><b>'+e(v)+'</b><span>'+e(l)+'</span></div>').join('')
        +'<div class="ps-split"><div class="ps-split-bar">'+phases.map(p=>'<i style="flex:'+Math.max(p.kw,1)+';background:'+p.color+'"></i>').join('')+'</div><div class="ps-split-l">'+phases.map(p=>'<span><i style="background:'+p.color+'"></i>'+e(p.short)+' '+e(mw(p.kw))+'</span>').join('')+'</div></div>'
        +'</div><ol class="ps-exec-r">'+msgs.map(m=>'<li'+(m.warn?' class="warn"':'')+'><b>'+e(m.b)+'</b>'+(m.s?'<span>'+e(m.s)+'</span>':'')+'<em>p. '+m.p+'</em></li>').join('')+'</ol></div>' };
    // appendix: one page per deal; under the figures, the plants (or the plant's sheet) and what happened lately
    const dealMore=l=>{
      let left;
      if(l.length>1) left='<div><span class="ps-k">Centrales</span><table class="ps-table ps-mini"><tbody>'+l.slice(0,6).map(x=>'<tr><td><b>'+e(oppName(x))+'</b></td><td class="n">'+e(x.kwc?fmtKwc(x.kwc):'—')+'</td><td class="n">'+e(x.mwh?Math.round(pqNum(String(x.mwh))||0).toLocaleString('fr-FR')+' MWh':'—')+'</td><td>'+e(x.commune||'')+'</td><td>'+e(x.mesEff||x.mesPrev||'')+'</td></tr>').join('')+(l.length>6?'<tr><td colspan="5">+ '+(l.length-6)+' autres</td></tr>':'')+'</tbody></table></div>';
      else { const o=l[0], keys=['Commune','Département','Nature Projet',"Type d'injection",'Puissance raccordement (kVA)','Stockage','P90 annuel (indicatif) (MWh/an)','Productible (P50) (kWh/kWc/an)','Nom SPV','Système de gestion des heures négatives','Première injection'];
        const kv=keys.map(k=>[k.replace(/ \(.*$/,''), caractValue(o,k)]).filter(x=>x[1]!=='' && x[1]!=null).slice(0,10);
        left='<div><span class="ps-k">Caractéristiques</span>'+(kv.length?'<dl class="ps-kv">'+kv.map(([k,v])=>'<dt>'+e(k)+'</dt><dd>'+e(String(v))+'</dd>').join('')+'</dl>':'<p class="ps-empty">Fiche Caractéristiques pas encore remplie.</p>')+'</div>'; }
      const h=buildHistory(l), ev=h?[...h.querySelectorAll('li')].slice(0,6).map(li=>[li.firstChild.textContent, li.lastChild.textContent]):[];
      const right='<div><span class="ps-k">Historique récent</span>'+(ev.length?'<ul class="ps-hist">'+ev.map(([d,t])=>'<li><span>'+e(d)+'</span>'+e(t.length>90?t.slice(0,90)+'…':t)+'</li>').join('')+'</ul>':'<p class="ps-empty">Rien de noté pour l’instant.</p>')+'</div>';
      return '<div class="ps-deal-more">'+left+right+'</div>'; };
    add({ divider:true, title:'Annexe', sub:'Une fiche par dossier, dans l’ordre des tableaux' });
    blocks.slice().sort((a,b)=>MEET_PHASES.findIndex(p=>p.key===b.g.phase.key)-MEET_PHASES.findIndex(p=>p.key===a.g.phase.key) || kwOf(b.list)-kwOf(a.list)).forEach(bk=>{
      const r=bInfo(bk), o=r.o, mwhB=bk.list.reduce((x,y)=>x+(pqNum(String(y.mwh||''))||0),0), mes=o.mesEff||o.mesPrev||'';
      const lastNote=bk.list.flatMap(x=>x.notesLog||[]).filter(n=>n && n.text).sort((a,b)=>b.at-a.at)[0];
      const ph=PIPE_PHASES.filter(p=>p.key!=='prequal'), cur=ph.findIndex(p=>p.key===(r.st&&r.st.phase));
      add({ sec:'Annexe', title:r.label+' · '+(r.st?stageLabel(o.stage, o):'')+(r.d!=null?' depuis '+r.d+' jour'+(r.d>1?'s':''):''),
        body:'<div class="ps-deal"><div class="ps-deal-figs"><div><b>'+e(r.kw?mw(r.kw):'—')+'</b><span>'+plural(r.n,'installation')+'</span></div><div><b>'+e(mwhB?Math.round(mwhB).toLocaleString('fr-FR')+' MWh':'—')+'</b><span>par an (P50)</span></div><div><b>'+e(mes||'—')+'</b><span>mise en service</span></div></div>'
          +'<div class="ps-track">'+ph.map((p,i)=>'<div class="'+(i<cur?'done':i===cur?'on':'')+'"><i></i><span>'+e(p.label)+'</span></div>').join('')+'</div>'
          +'<div class="ps-deal-next"><div><span class="ps-k">Prochaine action</span><b>'+e(r.next||'—')+'</b></div><div><span class="ps-k">Chez</span><b'+(r.d!=null && r.d>15?' class="warn"':'')+'>'+e(r.who)+(r.d!=null?' · '+r.d+' j':'')+'</b></div>'+(o.contrat?'<div><span class="ps-k">Contrat</span><b>'+e(o.contrat+(o.duree?' · '+o.duree+' ans':''))+'</b></div>':'')+'</div>'
          +(lastNote?'<p class="ps-context"><span class="ps-k">Dernier échange · '+e(new Date(lastNote.at).toLocaleDateString('fr-FR'))+'</span>'+e(lastNote.text.length>180?lastNote.text.slice(0,180)+'…':lastNote.text)+'</p>':'')
          +dealMore(bk.list)+'</div>' });
    });
    // the deck
    let ov=$('present-overlay'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='present-overlay'; ov.className='ps-overlay'; ov.tabIndex=-1; ov.setAttribute('role','dialog'); ov.setAttribute('aria-label','Présentation de la réunion');
    ov.innerHTML='<div class="ps-stage"><div class="ps-slide"></div></div><div class="ps-bar-ui"><button type="button" class="ps-prev" aria-label="Slide précédente">‹</button><span class="ps-count"></span><button type="button" class="ps-next" aria-label="Slide suivante">›</button><button type="button" class="ps-full" title="Plein écran (F)">Plein écran</button><button type="button" class="ps-pptx" title="Télécharger en PowerPoint (.pptx) pour retoucher les slides à la main">PowerPoint</button><button type="button" class="ps-close" title="Fermer (Échap)">Fermer</button></div>';
    document.body.appendChild(ov);
    let i=0; const box=ov.querySelector('.ps-slide');
    const tracker=sec=>'<nav class="ps-tracker">'+SECTIONS.map(x=>'<span'+(x===sec?' class="on"':'')+'>'+e(x)+'</span>').join('')+'</nav>';
    const paint=(box, n)=>{ const sl=slides[n];
      box.className='ps-slide'+(sl.divider?' ps-divider':'')+(sl.exec?' ps-execs':'');
      box.innerHTML=sl.divider?'<div class="ps-div-in"><div class="ps-cover-k">Réunion pricing · '+e(date)+'</div><h1>'+e(sl.title)+'</h1><p>'+e(sl.sub)+'</p></div>'
        :'<header>'+(sl.sec!=='Annexe'?tracker(sl.sec):'<nav class="ps-tracker"><span class="on">Annexe · fiche dossier</span></nav>')+(sl.exec?'<div class="ps-kicker">Réunion pricing · '+e(date)+'</div>':'')+'<h2>'+e(sl.title)+'</h2></header><div class="ps-body">'+sl.body+'</div>'
          +'<footer><span>Source : Pipe agrégation (appli ToDo), au '+e(date)+'</span><span>'+(n+1)+'</span></footer>';
      box.querySelectorAll('.ps-fill > .ps-table-fill').forEach(t=>{ t.style.height='auto'; t.style.fontSize=''; const room=t.parentNode.clientHeight;
        for(let f=1.45; t.offsetHeight>room && f>1.2; f-=0.06){ t.style.fontSize=f.toFixed(2)+'cqw'; t.querySelectorAll('td').forEach(td=>{ td.style.paddingTop=td.style.paddingBottom=(f*0.32).toFixed(2)+'cqw'; }); }   // too many lines: smaller, never cut
        const nat=t.offsetHeight; if(room>nat) t.style.height=Math.min(room, nat*2.2)+'px'; }); };
    const show=n=>{ i=Math.max(0, Math.min(slides.length-1, n)); paint(box, i); ov.querySelector('.ps-count').textContent=(i+1)+' / '+slides.length; };
    // « PowerPoint » : the same slides as a .pptx, every text and table editable
    ov.querySelector('.ps-pptx').onclick=async ev=>{ ev.stopPropagation(); const b=ev.currentTarget, was=b.textContent; b.disabled=true; b.textContent='Préparation…';
      try{ await loadPptx(); const host=document.createElement('div'); host.className='ps-export-host'; const sb=document.createElement('div'); host.appendChild(sb); document.body.appendChild(host);
        const pptx=new window.PptxGenJS(); pptx.layout='LAYOUT_WIDE'; pptx.title='Réunion pricing · '+date;
        try{ slides.forEach((x,n)=>{ paint(sb, n); slideToPptx(pptx, sb); }); } finally { host.remove(); }
        await pptx.writeFile({ fileName:'Reunion pricing '+toISO(new Date())+'.pptx' }); b.textContent='Téléchargé ✓'; }
      catch(err){ console.error(err); b.textContent='Échec (hors ligne ?)'; }
      ov.focus();   // the button is disabled a moment: the arrows and Échap keep working
      setTimeout(()=>{ b.textContent=was; b.disabled=false; }, 2500); };
    const onResize=()=>{ if(document.body.contains(ov)) show(i); }; window.addEventListener('resize', onResize);   // full screen: the tables are spread again
    const close=()=>{ if(document.fullscreenElement) try{ document.exitFullscreen(); }catch(e2){} window.removeEventListener('resize', onResize); ov.remove(); };
    ov.querySelector('.ps-prev').onclick=()=>show(i-1); ov.querySelector('.ps-next').onclick=()=>show(i+1); ov.querySelector('.ps-close').onclick=close;
    ov.querySelector('.ps-full').onclick=()=>{ try{ document.fullscreenElement?document.exitFullscreen():ov.requestFullscreen(); }catch(e2){} };
    ov.querySelector('.ps-stage').addEventListener('click', ev=>{ const pg=ev.target.closest('.ps-exec-r li'); if(pg){ const m=/p\. (\d+)/.exec(pg.textContent); if(m){ show(+m[1]-1); return; } }
      const r=ov.getBoundingClientRect(); show(ev.clientX>r.left+r.width/3?i+1:i-1); });
    ov.addEventListener('keydown', ev=>{ const k=ev.key; ev.stopPropagation();   // the app's own shortcuts (n, p, Ctrl K…) stay quiet while presenting
      if(['ArrowRight','ArrowDown','PageDown',' ','Enter'].includes(k)){ ev.preventDefault(); show(i+1); }
      else if(['ArrowLeft','ArrowUp','PageUp','Backspace'].includes(k)){ ev.preventDefault(); show(i-1); }
      else if(k==='Home'){ ev.preventDefault(); show(0); } else if(k==='End'){ ev.preventDefault(); show(slides.length-1); }
      else if(k==='f' || k==='F'){ ev.preventDefault(); ov.querySelector('.ps-full').click(); }
      else if(k==='Escape'){ ev.preventDefault(); if(!document.fullscreenElement) close(); } });
    show(0); ov.focus();
  }
  function renderPipeMeet(board, q){
    board.classList.add('pipe-meet');
    const groups=meetData(q), n=groups.reduce((t,g)=>t+g.rows.length,0);
    const head=document.createElement('div'); head.className='meet-head';
    head.innerHTML='<div class="meet-title"><b></b><span></span></div><div class="meet-actions"></div>';
    head.querySelector('b').textContent='Ce qui arrive'; head.querySelector('span').textContent=meetTotal(groups.reduce((t,g)=>t+g.kwc,0), groups.reduce((t,g)=>t+g.mwh,0), n);
    const acts=head.querySelector('.meet-actions');
    const mk=(label, fn, title)=>{ const b=document.createElement('button'); b.type='button'; b.className='pipe-bar-btn'; b.textContent=label; if(title) b.title=title; b.onclick=()=>fn(b); acts.appendChild(b); return b; };
    mk('Copier pour mail / Teams', b=>meetCopy(groups,b), 'Le tableau, prêt à coller dans un mail Outlook ou dans Teams');
    mk('Copier en liste courte', b=>meetCopyShort(groups,b), 'Une ligne par installation : lisible dans Teams sur un téléphone');
    mk('Excel', b=>meetXlsx(groups,b), 'Télécharger le tableau en .xlsx');
    mk('Imprimer / PDF', ()=>meetPrint(groups), 'Imprimer, ou enregistrer en PDF (paysage)');
    const pres=mk('Présenter', ()=>meetPresent(groups), 'La réunion en slides, plein écran ; flèches du clavier pour avancer');
    pres.classList.add('meet-present-btn');
    const colBtn=mk('Colonnes ▾', ()=>{ meetColsOpen=!meetColsOpen; renderPipeline(); }, 'Choisir les colonnes du tableau (aussi pour la copie, l\u2019Excel et l\u2019impression)');
    colBtn.classList.add('meet-cols-btn'); colBtn.setAttribute('aria-expanded', String(meetColsOpen));
    board.appendChild(head);
    if(meetColsOpen){ const cc=document.createElement('div'); cc.className='meet-chips meet-cols'; const hid=meetHiddenCols();
      cc.innerHTML='<span class="meet-cols-l">Colonnes :</span>';
      MEET_COLS.slice(2).forEach(c=>{ const b=document.createElement('button'); b.type='button'; b.className='meet-chip'+(hid.includes(c)?'':' on'); b.textContent=c; b.dataset.col=c; b.setAttribute('aria-pressed', String(!hid.includes(c)));
        b.onclick=()=>{ let v=meetHiddenCols(); v=v.includes(c)?v.filter(x=>x!==c):v.concat(c); try{ localStorage.setItem('pipe-meet-cols', JSON.stringify(v)); }catch(e){} prefsToNote(); renderPipeline(); }; cc.appendChild(b); });
      board.appendChild(cc); }
    // which phases to show (remembered on this device)
    const chips=document.createElement('div'); chips.className='meet-chips'; const on=meetPhasesOn();
    MEET_PHASES.forEach(p=>{ const c=document.createElement('button'); c.type='button'; c.className='meet-chip'+(on.includes(p.key)?' on':''); c.textContent=p.label; c.dataset.phase=p.key; c.setAttribute('aria-pressed', String(on.includes(p.key)));
      c.onclick=()=>{ let v=meetPhasesOn(); v=v.includes(p.key)?v.filter(k=>k!==p.key):v.concat(p.key); if(!v.length) return; try{ localStorage.setItem('pipe-meet-phases', JSON.stringify(MEET_PHASES.map(x=>x.key).filter(k=>v.includes(k)))); }catch(e){} prefsToNote(); renderPipeline(); };
      chips.appendChild(c); });
    board.appendChild(chips);
    if(!n){ const e=document.createElement('div'); e.className='today-empty'; e.textContent='Aucune installation dans ces phases.'; board.appendChild(e); return; }
    board.appendChild(meetVisuals(groups));
    const wrap=document.createElement('div'); wrap.className='meet-scroll';
    const vis=meetVis(), ncol=vis.filter(Boolean).length;
    let t='<table class="meet-table"><thead><tr>'+meetPick(MEET_COLS, vis).map(c=>'<th>'+escapeHtml(c)+'</th>').join('')+'</tr></thead><tbody>';
    groups.forEach(g=>{ if(!g.rows.length) return;
      t+='<tr class="meet-sec" data-phase="'+g.phase.key+'"><th colspan="'+ncol+'"><i style="background:'+(MAP_PHASES.find(x=>x[0]===g.phase.key)||[0,0,'#888'])[2]+'"></i>'+escapeHtml(g.phase.label)+'<span>'+escapeHtml(meetTotal(g.kwc,g.mwh,g.rows.length))+'</span></th></tr>';
      let lastKey=null;
      g.rows.forEach((r,i)=>{ const o=g.list[i], k=meetBlockKey(o), mates=g.list.filter(x=>meetBlockKey(x)===k);
        if(mates.length>1 && k!==lastKey){   // a lot, or a request at one step: one title line, the installations under it
          const st=oppStage(o.stage), d=daysInStage(o), kw=mates.reduce((x,y)=>x+kwcNum(y),0);
          t+='<tr class="meet-blk" data-blk="'+escapeHtml(k)+'" data-req="'+escapeHtml(o.requestId)+'" data-ids="'+escapeHtml(mates.map(x=>x.id).join(','))+'"><td colspan="'+ncol+'"><b>'+escapeHtml(o.company||'')+'</b>'
            +(meetBlockName(o)?' <span class="meet-blk-name">'+escapeHtml(meetBlockName(o))+'</span>':'')
            +' <span class="meet-blk-sum">'+escapeHtml([mates.length+' installations', kw?fmtKwc(kw):'', stageLabel(o.stage, o), st?WHO[st.who]||st.who:'', d!=null?'depuis '+d+' j':''].filter(Boolean).join(' · '))+'</span></td></tr>'; }
        lastKey=k;
        t+='<tr data-id="'+escapeHtml(o.id)+'"'+(mates.length>1?' class="meet-inblk"':'')+'>'+meetPick(r, vis).map((v,j)=>'<td'+(j===1?' class="meet-name"':'')+'>'+escapeHtml(v)+'</td>').join('')+'</tr>'; }); });
    wrap.innerHTML=t+'</tbody></table>';
    wrap.querySelectorAll('tr[data-id]').forEach(tr=>{ tr.onclick=()=>openOppDetail(tr.dataset.id); });
    wrap.querySelectorAll('tr.meet-blk').forEach(tr=>{ tr.onclick=()=>openRequestDetail(tr.dataset.req, tr.dataset.ids.split(',')); });
    board.appendChild(wrap);
  }
    Object.assign(api, { renderPipeMeet });
  };
  return api;
})();
