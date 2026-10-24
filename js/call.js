// Todo — notes express and « Mode appel » (loaded before js/app.js): notes typed in bulk during a call, the figures spotted
// and offered for the installation sheet; one screen while on the phone with the producer. Split out of js/app.js (code audit).
window.TodoCall=(function(){
  const api={};
  // what this part uses from js/app.js, given where its code used to stand in js/app.js (so it runs in the same order);
  // app.<name>: a value js/app.js defines further down or may replace, read when used
  api.init=function(app){
    const { $, PQ_REGIONS, REQ_NEEDED, activeTasks, caractSet, caractValue, closeOppDetail, contacts, daysInStage, escapeHtml, flashBtn, fmtKwc, isExited, kwcNum, loadMarket, marketLine, oppName, oppStage, parsePipeMail, plainLinks, pqDeptFromPostal, pqDeptLabel, pqFold, pqIsoToFr, pqNum, pqParseDateLoose, pqQty, pqTitleCase, renderPipeline, saveCrm, stageLabel, toISO, touchCrm }=app;
    Object.assign(api, { mwhText, buildQuickNotes, openCallMode });   // function declarations: ready before the code below runs
  // ---------- Notes express / mode appel: notes typed in bulk, the app spots the figures and offers to fill the sheet ----------
  const QN_LABELS={ kwc:'Puissance', mwh:'P50', p90:'P90', mesPrev:'MES prévisionnelle', mesEff:'MES effective', dept:'Département', commune:'Commune', cp:'Code postal',
    contrat:'Type de contrat', duree:'Durée (ans)', debut:'Début du contrat', install:'Technologie', rdv1:'RDV 1', rdv2:'RDV 2', nature:'Offre demandée', spv:'SPV', siret:'SIRET',
    tel:'Téléphone', mail:'Mail', relance:'Relance', particularites:'Particularités' };
  const QN_PER_PLANT=new Set(['kwc','mwh','p90','mesPrev','mesEff','dept','commune','cp','contrat','duree','debut','install','spv','siret','particularites']);
  // a production for the eye: « 1 200 MWh », nothing when the value is not a number (« abc », « n/c »)
  function mwhText(v){ const n=pqNum(String(v==null?'':v)); return isFinite(n) && n?Math.round(n).toLocaleString('fr-FR')+' MWh':''; }
  function qnShow(k, v){ if(v==null || v==='') return '—';
    if(k==='kwc') return fmtKwc(v); if(k==='mwh' || k==='p90') return mwhText(v)?mwhText(v)+'/an':String(v);
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return pqIsoToFr(v); return String(v); }
  function parseQuickNotes(text){
    const t=String(text||'').replace(/ /g,' '), f=pqFold(t), out={};
    if(!t.trim()) return out;
    const P=parsePipeMail(t);
    ['kwc','mesPrev','dept','region','contrat','duree','install','debut','tel','mail'].forEach(k=>{ if(P[k]) out[k]=P[k]; });
    if(out.kwc && !(pqNum(out.kwc)>0)) delete out.kwc;   // the production: read here (a P90 is not a P50)
    const qty='(?<![\\w,.-])(\\d{1,3}(?:[ .]\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?)(?![\\d.,]*e\\d)';
    let m;
    // a power or a production written short, as in notes: « 1,2 MWc », « 900 kWc », « P50 1200 », « 1 400 MWh »
    if(!out.kwc && (m=new RegExp(qty+'\\s*(mwc|mwp|mw|kwc|kwp|kw)\\b','i').exec(t))){ const v=pqQty(m[1], m[2]); if(v>0) out.kwc=String(/^m/i.test(m[2])?Math.round(v*1000):Math.round(v)); }
    if((m=new RegExp('\\bp50\\s*[:=]?\\s*'+qty+'\\s*(gwh|mwh)?','i').exec(t))){ const v=pqQty(m[1], m[2]); if(v>0) out.mwh=String(/^g/i.test(m[2]||'')?Math.round(v*1000):Math.round(v)); }
    else { const re=new RegExp(qty+'\\s*(gwh|mwh)\\b','gi'); let g; while((g=re.exec(t))){ if(/p90\W{0,4}$/i.test(t.slice(Math.max(0,g.index-8), g.index))) continue; const v=pqQty(g[1], g[2]); if(v>0){ out.mwh=String(/^g/i.test(g[2])?Math.round(v*1000):Math.round(v)); break; } } }
    if((m=new RegExp('\\bp90\\s*[:=]?\\s*'+qty+'\\s*(gwh|mwh)?','i').exec(t))){ const v=pqQty(m[1], m[2]); if(v>0) out.p90=String(/^g/i.test(m[2]||'')?Math.round(v*1000):Math.round(v)); }
    // commissioning: « MES juin 2027 », « mise en service prévue le 01/03/2027 », « MSI T2 2027 »
    if((m=/\b(mes|msi|mise en service)\b[^\n.;]{0,25}?((?:\d{1,2}\/)?\d{1,2}\/\d{4}|(?:janv|fevr|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|t[1-4]\s+\d{4}|\d{4})/i.exec(f))){ const d=pqParseDateLoose(m[2]); if(d) out[/effective|realisee|en service depuis/.test(f.slice(Math.max(0,m.index-20), m.index+40))?'mesEff':'mesPrev']=d; }
    // where: « 49300 Cholet », « à Cholet (49) »
    if((m=/\b((?:0[1-9]|[1-8]\d|9[0-5])\d{3})\s+([A-ZÉÈÀÂÎÔ][\p{L}'’ -]{1,40}?)(?=[\n,.;)]|\s{2}|$)/u.exec(t))){ out.cp=m[1]; out.commune=pqTitleCase(m[2].trim()); const d=pqDeptFromPostal(m[1]); if(d){ out.dept=pqDeptLabel(d); out.region=PQ_REGIONS[d[2]]; } }
    // meetings and follow-ups: « RDV 2 le 12/11 », « rdv1 : 05/11/2026 », « relance le 3/12 »
    const isoOf=s2=>{ let d=/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s2); if(!d || +d[1]<1 || +d[1]>31 || +d[2]<1 || +d[2]>12) return null; let y=d[3]?+d[3]:new Date().getFullYear(); if(y<100) y+=2000; const dt=new Date(y, +d[2]-1, +d[1]); if(dt.getDate()!==+d[1]) return null; if(!d[3] && dt<new Date(Date.now()-30*864e5)) dt.setFullYear(y+1); return toISO(dt); };
    [['rdv1',/\brdv\s*(?:1|un)\b[^\d\n]{0,12}(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/],['rdv2',/\brdv\s*(?:2|deux)\b[^\d\n]{0,12}(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/],['relance',/\brelan\w*[^\d\n]{0,12}(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/]]
      .forEach(([k,re])=>{ const r=re.exec(f); const v=r && isoOf(r[1]); if(v) out[k]=v; });
    if(/\b(offre|prix|pricing)\s+engageant/.test(f) || /\bengageante?\b/.test(f)) out.nature='Engageante';
    else if(/\b(offre|prix|pricing)\s+(indicati|non engageant)/.test(f)) out.nature='Non engageante';
    if((m=/\bspv\s*[:=]?\s*([^\n,;()]{2,60}?)(?=\s*(?:[.,;()\n]|\bsiret\b|$))/i.exec(t))) out.spv=m[1].trim();
    if((m=/\b(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/.exec(t))) out.siret=m[1].replace(/\s/g,'');
    return out;
  }
  // the proposals for these installations: only what changes something
  function quickNoteProposals(text, list){
    const found=parseQuickNotes(text), rows=[];
    Object.keys(QN_LABELS).forEach(k=>{ if(found[k]==null || found[k]==='') return;
      const olds=[...new Set(list.map(o=>o[k]||''))], same=olds.length===1 && String(olds[0])===String(found[k]);
      if(!same) rows.push({ k, v:found[k], old:olds.filter(Boolean).join(' / '), extra:k==='dept' && found.region?{ region:found.region }:null }); });
    return rows;
  }
  function applyQuickNotes(rows, targets){
    targets.forEach(o=>{ rows.forEach(r=>{ o[r.k]=r.v; if(r.extra) Object.assign(o, r.extra); }); touchCrm(o); });
    saveCrm(); renderPipeline();
  }
  function logNote(list, kind, text, extra){
    const n=Object.assign({ at:Date.now(), kind, text:String(text||'').trim() }, extra||{}); if(!n.text && kind!=='appel') return;
    list.forEach(o=>{ o.notesLog=(o.notesLog||[]).concat([n]); touchCrm(o); }); saveCrm();
  }
  // the box: notes, what the app understood (each line can be left out), « Remplir », « Garder la note »
  function buildQuickNotes(list, opts){
    opts=opts||{};
    const live=list.filter(x=>!isExited(x)).length?list.filter(x=>!isExited(x)):list;
    const box=document.createElement('div'); box.className='qn';
    const ta=document.createElement('textarea'); ta.className='qn-text'; ta.rows=opts.rows||4; ta.id=opts.id||'qn-text';
    ta.placeholder=opts.placeholder||'Tes notes en vrac, ex. « P50 1200, MES juin 2027, 49300 Cholet, RDV 2 le 12/11, offre engageante »';
    box.appendChild(ta);
    let pick=null;
    if(live.length>1){   // a figure of one plant: which one
      pick=document.createElement('div'); pick.className='qn-for'; pick.innerHTML='<span>Les chiffres de la centrale vont à :</span>';
      const sel=document.createElement('select'); sel.className='qn-target'; sel.innerHTML='<option value="">Toutes ('+live.length+')</option>'+live.map(o=>'<option value="'+escapeHtml(o.id)+'">'+escapeHtml(oppName(o))+'</option>').join('');
      pick.appendChild(sel); box.appendChild(pick); pick.hidden=true; }
    const prop=document.createElement('div'); prop.className='qn-props'; box.appendChild(prop);
    const acts=document.createElement('div'); acts.className='qn-acts'; box.appendChild(acts);
    const fill=document.createElement('button'); fill.type='button'; fill.className='qn-fill'; fill.hidden=true;
    const keep=document.createElement('button'); keep.type='button'; keep.className='ghost-btn qn-keep'; keep.textContent=opts.keepLabel||'Garder la note dans l’historique';
    acts.append(fill, keep);
    let rows=[];
    const targets=()=>{ const id=pick && pick.querySelector('select').value; return id?live.filter(o=>o.id===id):live; };
    const paint=()=>{
      rows=live.length?quickNoteProposals(ta.value, targets()):[]; prop.innerHTML='';
      if(pick) pick.hidden=!rows.some(r=>QN_PER_PLANT.has(r.k));
      rows.forEach(r=>{ const l=document.createElement('label'); l.className='qn-row'; const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=true; r.cb=cb;
        const sp=document.createElement('span'); sp.innerHTML='<b></b> <span class="qn-v"></span> <small></small>'; sp.querySelector('b').textContent=QN_LABELS[r.k]+' :'; sp.querySelector('.qn-v').textContent=qnShow(r.k, r.v); sp.querySelector('small').textContent=r.old?'(avant : '+r.old.split(' / ').map(v=>qnShow(r.k, v)).join(' / ')+')':'(vide)';
        cb.onchange=paintBtn; l.append(cb, sp); prop.appendChild(l); });
      paintBtn(); };
    function paintBtn(){ const n=rows.filter(r=>r.cb.checked).length; fill.hidden=!rows.length; fill.disabled=!n; fill.textContent=n?'Remplir '+n+' case'+(n>1?'s':''):'Rien à remplir'; }
    ta.addEventListener('input', paint);
    if(pick) pick.querySelector('select').onchange=paint;
    fill.onclick=()=>{ const ok=rows.filter(r=>r.cb.checked); if(!ok.length) return;
      // a meeting date, a follow-up, the offer asked: shared by the block; a figure of the plant: the chosen one(s)
      const shared=ok.filter(r=>!QN_PER_PLANT.has(r.k)), own=ok.filter(r=>QN_PER_PLANT.has(r.k));
      if(shared.length) applyQuickNotes(shared, live); if(own.length) applyQuickNotes(own, targets());
      flashBtn(fill, '✓ '+ok.length+' case'+(ok.length>1?'s':'')+' remplie'+(ok.length>1?'s':''));
      if(opts.onFill) opts.onFill(ok); else paint(); };
    keep.onclick=()=>{ if(!ta.value.trim()) return; logNote(live, 'note', ta.value); ta.value=''; paint(); flashBtn(keep, '✓ Gardée'); if(opts.onKeep) opts.onKeep(); };
    if(opts.keepHidden) keep.hidden=true;
    box.qn={ ta, paint, rows:()=>rows, fill };
    return box;
  }
  // ---------- Mode appel: one screen while on the phone with the producer ----------
  const QN_ASK={ nominstallation:'Le nom de la centrale ?', departement:'Où est-elle (commune, code postal) ?', commune:'La commune ?',
    datedemiseenserviceeffectiveouprevisionnelle:'Mise en service : quand ?', puissanceinstalleekwc:'La puissance installée (kWc) ?', p50annuelindicatifmwhan:'La production annuelle (P50, MWh/an) ?' };
  const CALL_TALK={ a_qualifier:['Présenter Selfee et l’agrégation','Combien de centrales, quelle puissance, quel contrat (AO CRE, OA, marché) ?'], prise_contact:['Fixer le RDV 1'],
    collecte:['Peut-il envoyer le fichier Caractéristiques rempli ?','La date de mise en service, le P50'], qualif_en_cours:['Fixer ou faire le RDV 2','Offre indicative ou engageante ?'],
    pricing_indicatif:['Le pricing est en cours chez Ops','Une info manque-t-elle pour le prix ?'], offre_remise:['Présenter l’offre'], offre_attente:['A-t-il pu regarder l’offre ?','Des questions, une contre-proposition ?'],
    kyc:['Documents KYC à envoyer (Kbis, statuts, RIB, pièce d’identité)'], negociation:['Les points restant à régler'], pricing_ferme:['Le prix ferme arrive (Ops)'],
    mise_signature:['Le DocuSign est-il bien arrivé ?'], signature:['Signé de son côté ?'], onboarding:['Accès, ARPE, données techniques'], actif:['Tout va bien sur la valorisation ?'] };
  // person: a contact called from the Contacts tab (backlog decision 6) — the call is about that person, with their company's deals if any
  function openCallMode(list, back, person){
    const live=list.filter(x=>!isExited(x)).length?list.filter(x=>!isExited(x)):list; if(!live.length && !person) return;
    const first=live[0]||null, st=first?oppStage(first.stage):null, started=Date.now();
    const mail=((person?person.email:first.mail)||'').toLowerCase(), crm=person||(mail && contacts.find(c=>!c.deleted && (c.email||'').toLowerCase()===mail));
    const name=person?[person.firstName,person.lastName].filter(Boolean).join(' '):[first.prenom, first.nom].filter(Boolean).join(' ')||(crm?[crm.firstName,crm.lastName].filter(Boolean).join(' '):''), tel=person?(person.phone1||person.phone2||''):first.tel||(crm?crm.phone1:'');
    const company=person?person.company||'':first.company;
    closeOppDetail();
    let ov=$('call-overlay'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='call-overlay'; ov.className='modal-overlay';
    const bx=document.createElement('div'); bx.className='modal-box wide call-box'; bx.setAttribute('role','dialog'); bx.setAttribute('aria-label','Mode appel'); ov.appendChild(bx);
    const head=document.createElement('div'); head.className='call-head';
    head.innerHTML='<div><div class="sp-k">Mode appel <span class="call-timer">0:00</span></div><h3></h3><div class="call-sub"></div></div><div class="call-tel"></div>';
    head.querySelector('h3').textContent=(name||company)+(name && company?' · '+company:'');
    head.querySelector('.call-sub').textContent=first?[live.length>1?live.length+' installations':oppName(first), fmtKwc(live.reduce((s2,x)=>s2+kwcNum(x),0)), st?stageLabel(st.key, first)+(daysInStage(first)!=null?' depuis '+daysInStage(first)+' j':''):''].filter(Boolean).join(' · '):[person && person.role, 'aucun dossier en cours'].filter(Boolean).join(' · ');
    if(tel){ const a=document.createElement('a'); a.href='tel:'+tel.replace(/[^\d+]/g,''); a.className='call-num'; a.textContent=tel; head.querySelector('.call-tel').appendChild(a); }
    if(mail){ const a=document.createElement('a'); a.href='mailto:'+mail; a.className='os-link'; a.textContent=mail; head.querySelector('.call-tel').appendChild(a); }
    if(!tel && !mail){ const n=document.createElement('span'); n.className='call-sub'; n.textContent='Pas de numéro sur la fiche'; head.querySelector('.call-tel').appendChild(n); }
    bx.appendChild(head);
    const grid=document.createElement('div'); grid.className='call-grid'; bx.appendChild(grid);
    const left=document.createElement('section'); left.className='call-col'; grid.appendChild(left);
    // what to talk about at this step, then what is missing in the sheet (typed right there)
    const talk=first?CALL_TALK[first.stage]||[]:['Présenter Selfee et l\u2019agrégation','Des projets en cours ou à venir ? Combien de centrales, quelle puissance, quel contrat ?','Qui décide, et quand se reparler ?'];
    if(talk.length){ const h=document.createElement('div'); h.className='sp-k'; h.textContent='À aborder'; left.appendChild(h); const ul=document.createElement('ul'); ul.className='call-talk'; talk.forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ul.appendChild(li); }); left.appendChild(ul); }
    { const mk=document.createElement('div'); mk.className='call-market'; left.appendChild(mk);   // the market, to open the conversation (backlog decision 24)
      const paintMk=()=>{ const t=marketLine(); mk.hidden=!t; mk.innerHTML=t?'<div class="sp-k">Le marché</div><p></p><small>Source : ENTSO-E, CRE, RTE, via PowerKlock</small>':''; if(t) mk.querySelector('p').textContent=t; };
      paintMk(); loadMarket().then(paintMk, ()=>{}); }
    const asks=document.createElement('div'); asks.className='call-asks'; left.appendChild(asks);
    const paintAsks=()=>{ asks.innerHTML=''; if(!live.length) return;
      const miss=[]; live.forEach(o=>app.CARACT_ROWS.forEach(l=>{ const k=app.caractKey(l); if(REQ_NEEDED.has(k) && caractValue(o,l)==='') miss.push({ o, l, k }); }));
      const h=document.createElement('div'); h.className='sp-k'; h.textContent=miss.length?'À demander · '+miss.length:'Fiche complète'; asks.appendChild(h);
      miss.forEach(x=>{ const r=document.createElement('label'); r.className='call-ask'; const q=document.createElement('span'); q.textContent=(live.length>1?oppName(x.o)+' — ':'')+(QN_ASK[x.k]||x.l);
        const i=document.createElement('input'); i.type='text'; i.placeholder='réponse'; i.onchange=()=>{ const v=i.value.trim(); if(!v) return; caractSet(x.o, x.l, v); touchCrm(x.o); saveCrm(); renderPipeline(); paintAsks(); };
        r.append(q, i); asks.appendChild(r); }); };
    paintAsks();
    const tk=activeTasks().filter(t=>t.opportunityId && live.some(o=>t.opportunityId===o.id || t.opportunityId===o.requestId)).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'))[0];
    if(tk){ const h=document.createElement('div'); h.className='sp-k'; h.textContent='Prochaine tâche'; const d=document.createElement('div'); d.className='call-task'; d.textContent=plainLinks(tk.title)+(tk.due?' · '+pqIsoToFr(tk.due):''); left.append(h, d); }
    const right=document.createElement('section'); right.className='call-col'; grid.appendChild(right);
    { const h=document.createElement('div'); h.className='sp-k'; h.textContent='Notes de l’appel'; right.appendChild(h); }
    const qn=buildQuickNotes(live, { id:'call-notes', rows:9, keepHidden:true, placeholder:'Ce qu’il dit, en vrac : les chiffres (P50, MES, commune, RDV…) sont repérés au fil de la frappe.', onFill:()=>{ qn.qn.paint(); paintAsks(); paintEnd(); } });
    right.appendChild(qn);
    const foot=document.createElement('div'); foot.className='crm-form-actions call-foot'; bx.appendChild(foot);
    const timer=setInterval(()=>{ const s2=Math.floor((Date.now()-started)/1000); const el=bx.querySelector('.call-timer'); if(el) el.textContent=Math.floor(s2/60)+':'+String(s2%60).padStart(2,'0'); }, 1000);
    const close=save=>{ clearInterval(timer);
      if(save){ if(qn.qn.rows().some(r=>r.cb.checked)) qn.qn.fill.click();   // what was spotted and left ticked goes into the sheet
        const mins=Math.max(1, Math.round((Date.now()-started)/60000)); if(live.length) logNote(live, 'appel', qn.qn.ta.value, { min:mins });
        if(person){ const said=qn.qn.ta.value.trim();   // the contact has no journal: the call goes at the top of its Commentaire
          person.comment=['Appel du '+new Date().toLocaleDateString('fr-FR')+' ('+mins+' min)'+(said?' : '+said:''), person.comment||''].filter(Boolean).join('\n'); touchCrm(person); saveCrm(); } }
      ov.remove(); if(back) back(); };
    const end=document.createElement('button'); end.type='button'; end.className='call-end'; end.textContent='Terminer l’appel'; end.title='Garde la note et la durée dans l’historique'; end.onclick=()=>close(true);
    const cancel=document.createElement('button'); cancel.type='button'; cancel.className='ghost-btn'; cancel.textContent='Annuler'; cancel.onclick=()=>close(false);
    foot.append(end, cancel);
    function paintEnd(){ const n=qn.qn.rows().filter(r=>r.cb.checked).length; end.textContent=n?'Terminer et remplir '+n+' case'+(n>1?'s':''):'Terminer l\u2019appel'; }
    qn.qn.ta.addEventListener('input', paintEnd); qn.addEventListener('change', paintEnd);
    ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(false); } });
    document.body.appendChild(ov);
    setTimeout(()=>qn.qn.ta.focus(), 30);
  }
  };
  return api;
})();
