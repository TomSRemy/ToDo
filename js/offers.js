// Todo — « Offres », the offers' control post (backlog: « Poste de pilotage des offres » and « Relancer Ops sur les pricings »).
// One line per deal waiting on a price or an answer: who has it (Ops for the price, me for the offer to send, the producer for his answer),
// since when, the offers already made (version, price, date), and a « Relancer » that prepares the mail in Outlook. Loaded before js/app.js.
window.TodoOffers=(function(){
  const api={};
  api.init=function(app){
    const { oppName, stageLabel, daysInStage, fmtKwc, fmtMwc, kwcNum, isExited, sameCo, openOppDetail, openRequestDetail,
      touchCrm, saveCrm, renderPipeline, askText, notify, copyToClipboard, pqIsoToFr, toISO, lsSet }=app;
    // who has the deal at each step watched here
    const SECTIONS=[
      { key:'ops', title:'Chez Ops : le prix est demandé', stages:['pricing_indicatif','pricing_ferme'], late:10 },
      { key:'me', title:'À toi : l’offre est à remettre', stages:['offre_remise'], late:3 },
      { key:'client', title:'Chez le producteur : sa réponse est attendue', stages:['offre_attente'], late:7 }
    ];
    const opsMail=()=>{ try{ return localStorage.getItem('ops-mail')||''; }catch(e){ return ''; } };
    const lastOffer=list=>{ const all=list.flatMap(o=>o.offers||[]); return all.sort((a,b)=>(b.n||0)-(a.n||0) || String(b.at).localeCompare(String(a.at)))[0]||null; };
    const offerText=f=>f?'Offre '+f.n+(f.prix?' · '+f.prix:'')+(f.at?' · '+pqIsoToFr(f.at):''):'';
    // the deals of one section, a request's installations at one step on one line
    function rows(sec, q){
      const live=app.opportunities.filter(o=>!o.deleted && o.kind==='installation' && !isExited(o) && sec.stages.includes(o.stage))
        .filter(o=>!q || app.fold([o.company,o.producteur,o.centrale,o.title,o.dept].join(' ')).includes(q));
      const by=new Map(); live.forEach(o=>{ const k=(o.requestId||o.id)+'|'+o.stage; if(!by.has(k)) by.set(k,[]); by.get(k).push(o); });
      return [...by.values()].map(list=>({ list, o:list[0], days:Math.max(0,...list.map(x=>daysInStage(x)||0)) })).sort((a,b)=>b.days-a.days);
    }
    const what=r=>r.list.length>1?r.list.length+' installations'+(r.o.requestId?' ('+((app.opportunities.find(x=>x.id===r.o.requestId)||{}).label||'demande')+')':''):oppName(r.o);
    const power=r=>{ const kw=r.list.reduce((s,x)=>s+kwcNum(x),0); return kw?(r.list.length>1?fmtMwc(kw):fmtKwc(r.o.kwc, r.o.install)):''; };
    const since=r=>{ const t=Date.now()-r.days*864e5; return new Date(t).toLocaleDateString('fr-FR'); };
    // the producer's mail: the sheet's contact, else the company's
    function producerMail(o){
      if(o.mail) return { to:o.mail, first:o.prenom||'' };
      const c=app.contacts.find(x=>!x.deleted && x.company && sameCo(x.company, o.producteur||o.company) && x.email);
      return c?{ to:c.email, first:c.firstName||'' }:{ to:'', first:'' };
    }
    function openMail(to, subject, body){
      const url='mailto:'+encodeURIComponent(to||'')+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
      const a=document.createElement('a'); a.href=url; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove();
    }
    // the follow-up to the producer: the « Relance après une offre » template of the backlog (draft, to be corrected)
    function producerFollowUp(r){
      const f=lastOffer(r.list), p=producerMail(r.o), plants=r.list.map(oppName).join(', '), kw=r.list.reduce((s,x)=>s+kwcNum(x),0);
      const sent=f && f.at?pqIsoToFr(f.at):(r.o.dateOffre?(/^\d{4}-/.test(r.o.dateOffre)?pqIsoToFr(r.o.dateOffre):r.o.dateOffre):since(r));
      const body='Bonjour'+(p.first?' '+p.first:'')+',\n\nJe reviens vers vous au sujet de l’offre d’agrégation envoyée le '+sent+' pour '+plants+(kw?' ('+Math.round(kw).toLocaleString('fr-FR')+' kWc)':'')
        +'. Avez-vous pu la regarder ? Je peux en parler avec vous par téléphone, répondre à vos questions ou ajuster une hypothèse si besoin.\n\nBien cordialement,';
      openMail(p.to, 'Votre offre Selfee – '+plants, body);
      if(!p.to) notify('Pas d’adresse mail pour '+(r.o.company||'ce producteur')+' : le mail s’ouvre sans destinataire.');
    }
    // one grouped mail to Ops for the prices still awaited
    function opsText(list){
      return 'Bonjour,\n\nJe reviens vers vous pour '+(list.length>1?'les '+list.length+' demandes de prix suivantes, toujours en attente':'la demande de prix suivante, toujours en attente')+' :\n'
        +list.map(r=>'- '+[r.o.producteur||r.o.company, what(r)].filter(Boolean).join(' — ')+(power(r)?' ('+power(r)+')':'')+' : '+stageLabel(r.o.stage, r.o).toLowerCase()+', demandée le '+since(r)+', il y a '+r.days+' jour'+(r.days>1?'s':'')).join('\n')
        +'\n\nPouvez-vous me dire quand je pourrai les avoir ?\n\nMerci, bien cordialement,';
    }
    function opsFollowUp(list){
      if(!list.length) return;
      openMail(opsMail(), (list.length>1?list.length+' pricings en attente':'Pricing en attente')+(list[0].days>=10?' depuis plus de 10 jours':''), opsText(list));
      if(!opsMail()) notify('Indique l’adresse des Ops en haut de la vue Offres : le mail s’ouvre sans destinataire.');
    }
    // a new version of the offer: its number, its price (free text: €/MWh, frais d'agrégation…), today's date
    async function recordOffer(r){
      const n=((lastOffer(r.list)||{}).n||0)+1;
      const prix=await askText('Offre '+n+' pour '+(r.o.company||'')+' — '+what(r)+' : le prix ou les frais proposés (ex. « 52 €/MWh » ou « frais 2,5 €/MWh »)', '', 'Noter l’offre');
      if(prix==null) return;
      const f={ n, at:toISO(new Date()), prix:String(prix).trim() };
      r.list.forEach(o=>{ o.offers=(o.offers||[]).concat([f]); if(!o.dateOffre) o.dateOffre=f.at; touchCrm(o); });
      saveCrm(); renderPipeline(); notify('Offre '+n+' notée'+(f.prix?' : '+f.prix:''));
    }
    api.renderOffers=function(board, q){
      board.classList.add('pipe-offers');
      const data=SECTIONS.map(s=>({ s, rows:rows(s, q) }));
      const ops=data[0].rows;
      const head=document.createElement('div'); head.className='of-head';
      head.innerHTML='<div class="of-title"><b>Offres</b><span></span></div><div class="of-acts"></div>';
      head.querySelector('.of-title span').textContent=data.map(d=>d.rows.length+' '+({ ops:'chez Ops', me:'à remettre', client:'chez les producteurs' })[d.s.key]).join(' · ');
      const acts=head.querySelector('.of-acts');
      const rb=document.createElement('button'); rb.type='button'; rb.className='pipe-bar-btn'; rb.textContent='Relancer Ops ('+ops.length+')'; rb.disabled=!ops.length;
      rb.title='Un seul mail aux Ops avec toutes les demandes de prix en attente, leur date et leur délai'; rb.onclick=()=>opsFollowUp(ops); acts.appendChild(rb);
      const cb=document.createElement('button'); cb.type='button'; cb.className='pipe-bar-btn'; cb.textContent='Copier le mail aux Ops'; cb.disabled=!ops.length; cb.onclick=()=>copyToClipboard(opsText(ops), cb); acts.appendChild(cb);
      const ml=document.createElement('label'); ml.className='of-opsmail'; ml.innerHTML='Mail des Ops <input type="email" placeholder="pricing@…" autocomplete="off">';
      const mi=ml.querySelector('input'); mi.value=opsMail(); mi.onchange=()=>lsSet('ops-mail', mi.value.trim()); acts.appendChild(ml);
      board.appendChild(head);
      const hint=document.createElement('p'); hint.className='meet-scope'; hint.textContent='Installations en pricing (chez Ops), offre à remettre (toi) ou retour sur l’offre (le producteur), les plus anciennes en premier. « Depuis » : jours à cette étape. En orange : au-delà de 10 jours chez Ops, 3 jours chez toi, 7 jours chez le producteur. Les mails s’ouvrent dans ta messagerie, rien n’est envoyé sans toi.';
      board.appendChild(hint);
      data.forEach(({ s, rows:list })=>{
        const sec=document.createElement('section'); sec.className='of-sec'; sec.dataset.k=s.key;
        const h=document.createElement('h3'); h.textContent=s.title+' · '+list.length; sec.appendChild(h);
        if(!list.length){ const e=document.createElement('p'); e.className='of-empty'; e.textContent='Rien ici pour le moment.'; sec.appendChild(e); board.appendChild(sec); return; }
        const t=document.createElement('table'); t.className='of-table';
        t.innerHTML='<thead><tr><th>Producteur</th><th>Installation</th><th>Puissance</th><th>Étape</th><th>Dernière offre</th><th>Depuis</th><th></th></tr></thead><tbody></tbody>';
        const tb=t.querySelector('tbody');
        list.forEach(r=>{ const tr=document.createElement('tr'); if(r.days>s.late) tr.className='late';
          const f=lastOffer(r.list);
          [r.o.producteur||r.o.company||'', what(r), power(r), stageLabel(r.o.stage, r.o), f?offerText(f):'—', r.days+' j'].forEach((v,i)=>{ const td=document.createElement('td'); td.textContent=v; if(i===5) td.className='of-days'; tr.appendChild(td); });
          const act=document.createElement('td'); act.className='of-act';
          const btn=(label, fn, title)=>{ const b=document.createElement('button'); b.type='button'; b.className='pq-link'; b.textContent=label; if(title) b.title=title; b.onclick=e=>{ e.stopPropagation(); fn(); }; act.appendChild(b); };
          if(s.key==='ops') btn('Relancer', ()=>opsFollowUp([r]), 'Un mail aux Ops pour ce prix');
          if(s.key!=='ops') btn(f?'Nouvelle offre':'Noter l’offre', ()=>recordOffer(r), 'Le prix proposé : la version de l’offre est comptée toute seule');
          if(s.key==='client') btn('Relancer', ()=>producerFollowUp(r), 'Le mail de relance au producteur, prêt dans ta messagerie');
          tr.appendChild(act);
          tr.onclick=()=>{ if(r.list.length>1 && r.o.requestId) openRequestDetail(r.o.requestId, r.list.map(x=>x.id)); else openOppDetail(r.o.id); };
          tb.appendChild(tr); });
        sec.appendChild(t); board.appendChild(sec);
      });
    };
    api.offersOf=o=>(o.offers||[]).slice();
  };
  return api;
})();
