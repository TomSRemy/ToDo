// Todo — the Suivi's own lines for an offer (columns P, AQ–AV, BM–CM of « BDD Agrégation »), with their exact names and the
// value lists of its « Cst » sheet : what the pricing request needs (everything but the pricing's answer), and what the
// pricing sends back (prices, management fees). Shown in the « Caractéristiques centrales » table of a sheet, sent to the
// Suivi with the rest, read back from it. Also : a file dropped on a sheet (Caractéristiques Centrales, the producer's
// Excel, a mail) fills it, after a look at what changes. Loaded before js/app.js.
window.TodoConditions=(function(){
  const api={};
  const ON=['OUI', 'NON'];
  // [key, the Suivi's header (exact), column (0 = A), type, list, needed for the pricing request]
  const ASK=[
    ['c_secteur', 'Secteur', 15, 'list', ['Public', 'Privé'], true],
    ['c_peDuree', "Durée période d'essai (Mois)", 64, 'number', null, true],
    ['c_peFin', 'Date_fin_PE', 65, 'date', null, false],
    ['c_pnArret', 'Arrêt Prix Négatifs (PN)', 69, 'list', ['NON', 'Enchères', 'Prix Fixe'], true],
    ['c_pnPas', 'Pas de temps', 70, 'list', ['Horaire', 'Quart-horaire'], true],
    ['c_pnResp', 'Responsabilité arrêt PN', 71, 'list', ['Producteur', 'Agrégateur'], true],
    ['c_pnPen', 'Pénalités_PN', 72, 'text', null, true],
    ['c_indispoPen', 'Pénalités_indispo.', 73, 'text', null, true],
    ['c_indice', 'Indice', 74, 'list', ['OA', 'M0_CR', 'Prix fixe', 'Prix spot', 'N/A'], true],
    ['c_garanties', 'Garanties financières', 85, 'text', null, true],
    ['c_capa', 'Certification_Capacité', 86, 'list', ON, true],
    ['c_goRegistre', 'Inscription_Registre GO', 88, 'list', ON, true],
    ['c_selfee', 'Achat_Selfee', 89, 'list', ON, true]
  ];
  const EXPLOIT=[
    ['c_remit', 'REMIT', 42, 'list', ON, true],
    ['c_prog', 'Programmation', 43, 'list', ON, true],
    ['c_pilot', 'Pilotage à distance', 44, 'list', ON, true],
    ['c_grd', 'GRD', 45, 'text', null, true],
    ['c_releve', 'Type_relève', 46, 'list', ['Télérelevé', 'Profilé'], true],
    ['c_surplus', 'Surplus / Totalité', 47, 'list', ['Totalité', 'Surplus'], true]
  ];
  // what the pricing sends back : never asked for the request
  const BACK=[
    ['c_pePrix', 'Prix_PE', 66, 'number'], ['c_peFgPct', 'Frais_gestion_PE %', 67, 'number'], ['c_peFg', 'Frais_gestion_PE €/MWh', 68, 'number'],
    ['c_fgAcc', 'FG_ACC / An', 75, 'number'], ['c_pu', 'Pu€/MWh (PPA)', 76, 'number'],
    ['c_fgP1', 'FG_Fixe_P1 € / MWh', 77, 'number'], ['c_finP1', 'Fin P1 fixe', 78, 'date'], ['c_fgP2', 'FG_Fixe_P2 € / MWh', 79, 'number'], ['c_finP2', 'Fin P2 fixe', 80, 'date'],
    ['c_m0P1', 'FG_%M0_P1', 81, 'number'], ['c_finM0P1', 'Fin P1 %', 82, 'date'], ['c_m0P2', 'FG_%M0_P2', 83, 'number'], ['c_finM0P2', 'Fin P2 %', 84, 'date'],
    ['c_remu', 'Remu_prod', 87, 'text'], ['c_puGo', 'Pu/Go', 90, 'number'],
    // the detail of the aggregation fee as the pricing's mail gives it (no column in the Suivi : kept in the app)
    ['c_fgGestion', 'Frais de gestion (€/MWh)', null, 'number'], ['c_fgFixe', 'Frais fixe (€/MWh)', null, 'number'], ['c_fgMarge', 'Marge (€/MWh)', null, 'number'],
    ['c_pilotage', 'Pilotage (€/MWh)', null, 'number'],
    ['c_fgGestionPct', 'Frais de gestion (%m0)', null, 'number'], ['c_fgFixePct', 'Frais fixe (%m0)', null, 'number'], ['c_fgMargePct', 'Marge (%m0)', null, 'number'],
    // a baseload offer indexed on the CAL (« 38.5% x CAL - 1.7 »), and the same for several plants together
    ['c_blMW', 'Puissance BL (MW)', null, 'number'], ['c_formule', 'Formule', null, 'text'], ['c_exemple', 'Prix exemple (€/MWh)', null, 'number'], ['c_exempleRef', 'Base de l\u2019exemple', null, 'text'],
    ['c_grpNom', 'Offre groupée', null, 'text'], ['c_grpBlMW', 'Offre groupée · Puissance BL (MW)', null, 'number'], ['c_grpFormule', 'Offre groupée · Formule', null, 'text'], ['c_grpExemple', 'Offre groupée · Prix exemple (€/MWh)', null, 'number']
  ];
  // the Suivi's own words above its headers (the lines « Période tarifaire », « M0 − FG », « CAPA », « GO »…), shown under each line
  const HINT={ c_fgAcc:'Prix forfaitaire par an pour la gestion d\u2019une ACC', c_pu:'Prix fixe', c_fgP1:'Période tarifaire 1 (P1) · M0 − FG', c_finP1:'Période tarifaire 1 (P1)',
    c_fgP2:'Période tarifaire 2 (P2) · M0 − FG', c_finP2:'Période tarifaire 2 (P2)', c_m0P1:'Période tarifaire 1 (P1) · FG% × M0', c_finM0P1:'Période tarifaire 1 (P1)',
    c_m0P2:'Période tarifaire 2 (P2) · FG% × M0', c_finM0P2:'Période tarifaire 2 (P2)', c_garanties:'GAPD', c_capa:'CAPA', c_remu:'CAPA', c_goRegistre:'GO', c_selfee:'GO', c_puGo:'GO',
    c_blMW:'baseload, sur la base du P50', c_formule:'prix indexé, ex. 38,5 % × CAL − 1,7', c_exemple:'le prix pour la valeur de l\u2019exemple', c_grpNom:'les installations prises ensemble',
    c_pilotage:'noté à part, dans le mail du pricing ou l\u2019échange qui suit', c_fgGestion:'détail du mail du pricing', c_fgFixe:'détail du mail du pricing', c_fgMarge:'détail du mail du pricing' };
  const def=([k, label, col, type, opts, need], part)=>({ k, label, col, type, opts:opts||null, need:!!need, part, hint:HINT[k]||'' });
  const FIELDS=ASK.map(x=>def(x, 'ask')).concat(EXPLOIT.map(x=>def(x, 'exploit')), BACK.map(x=>def(x, 'back')));
  api.FIELDS=FIELDS;
  // the three parts of the table, in the Suivi's order
  api.sections=()=>[['Demande de pricing · contrat', FIELDS.filter(f=>f.part==='ask')], ['Demande de pricing · exploitation', FIELDS.filter(f=>f.part==='exploit')],
    ['Retour pricing', FIELDS.filter(f=>f.part==='back')]];
  // a trial period of 0 months needs no end date ; with one, its end is asked too
  const needed=(f, o)=>f.need || (f.k==='c_peFin' && Number(String(o.c_peDuree||'').replace(',', '.'))>0);
  api.needed=needed;
  api.missing=o=>FIELDS.filter(f=>needed(f, o) && String(o[f.k]==null?'':o[f.k]).trim()==='').length;
  // the cells of the Suivi line, by column : numbers as numbers, dates as dates
  api.bddCells=(o, h)=>{ const out={};
    FIELDS.forEach(f=>{ const v=o[f.k]; if(f.col==null || v==null || String(v).trim()==='') return;
      out[f.col]=f.type==='number' ? h.numCell(v) : f.type==='date' ? h.looseDateCell(v) : String(v).trim(); });
    return out; };
  // a Suivi line read back : the same cells, as the sheet keeps them
  api.fromBdd=(vals, cellText)=>{ const out={};
    FIELDS.forEach(f=>{ if(f.col==null) return; const t=cellText(vals[f.col], f.type==='date'); if(t!=='') out[f.k]=t; });
    return out; };

  // ---- the pricing's mail : a table « Nom du marché » (the business code) + columns in €/MWh, one line per plant.
  // Copied out of Outlook, a table comes one cell per line (or tab-separated) : read back as cells, header then rows ----
  const foldS=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9%]/g, '');
  const NUM=/^-?\d+(?:[.,]\d+)?\s*(?:€|%)?$/;
  const FIRST_COL=/^(nomdumarche|codeaffaire|centrale|installation|nomdelacentrale|nominstallation|marche)$/;
  // a pricing column → the sheet's field ; the total aggregation fee is the Suivi's FG_Fixe_P1
  // a header → the sheet's field : the Suivi's exact name first, then the %m0 columns (never mixed with the €/MWh ones)
  function fieldFor(h){
    const f=foldS(h), exact=FIELDS.find(x=>foldS(x.label)===f);
    if(exact) return exact.k;
    if(/m0/.test(f)){ if(/fraisdagregation|total/.test(f)) return /2e|deuxieme|seconde|p2/.test(f.replace('m0', '')) ? 'c_m0P2' : 'c_m0P1'; if(/fraisdegestion/.test(f)) return 'c_fgGestionPct'; if(/fraisfixe/.test(f)) return 'c_fgFixePct'; if(/marge/.test(f)) return 'c_fgMargePct'; }
    return pricingField(h);
  }
  // a column's words → the field ; the first rule that matches (the order matters : « 2e période » before the plain fee)
  const FIELD_RULES=[[/pilotage/, 'c_pilotage'], [/puissancebl|baseload/, 'c_blMW'], [/formule/, 'c_formule'], [/exemple/, 'c_exemple'], [/fraisacc/, 'c_fgAcc'],
    [/(valablejusqu|jusquau|^fin).*(2e|deuxieme|seconde|p2)/, 'c_finP2'],
    [/(fraisdagregation|totalfrais).*(2e|deuxieme|p2|seconde)|(2e|deuxieme|seconde)periode/, 'c_fgP2'], [/valablejusqu|jusquau|finp1|findelapremiere|fin1re/, 'c_finP1'],
    [/fraisdagregation|totalfrais/, 'c_fgP1'], [/fraisdegestion/, 'c_fgGestion'], [/fraisfixe/, 'c_fgFixe'], [/marge/, 'c_fgMarge'], [/periodedessai|prixpe/, 'c_pePrix'],
    [/m0/, 'c_m0P1'], [/go(?![a-z])|prixgo|pugo/, 'c_puGo'], [/^pu|prix/, 'c_pu']];
  function pricingField(h){
    const f=foldS(h), hit=FIELD_RULES.find(([re])=>re.test(f));
    if(hit && hit[1]==='c_puGo' && !/pu|prix/.test(f)) return null;
    return hit ? hit[1] : null;
  }

  // a table copied with its tabs (Outlook / Excel) : the header may run over several lines (a cell with a line break) ;
  // its columns are found by their words, in order, then each line « name, value, value… » is read under them
  const TAB_COLS=[[/puissance\s*bl|puissance\s*baseload/i, 'c_blMW'], [/formule/i, 'c_formule'], [/exemple/i, 'c_exemple'], [/frais\s+d.agr/i, 'c_fgP1'], [/frais\s+de\s+gestion/i, 'c_fgGestion'],
    [/frais\s+fixe/i, 'c_fgFixe'], [/marge/i, 'c_fgMarge'], [/pilotage/i, 'c_pilotage'], [/pu\s*\/\s*go|prix\s+go/i, 'c_puGo'], [/p[ée]riode\s+d.essai/i, 'c_pePrix'], [/%\s*m0|fg\s*%/i, 'c_m0P1'], [/^|\bprix\b/i, null]];
  const isValue=v=>NUM.test(v) || /%|\bcal\b|\bm0\b|spot/i.test(v);
  // the header's cells put back together : a cell with a line break in it comes over several lines, its continuation
  // first on the next line (before the first tab), the next cells after the tabs
  function headCells(lines){
    const cells=[];
    lines.forEach((l, n)=>{ const seg=l.split('\t').map(x=>x.trim());
      if(n && cells.length) cells[cells.length-1]=(cells[cells.length-1]+' '+seg.shift()).trim();
      seg.forEach(x=>cells.push(x)); });
    return cells;
  }
  // a header cell → the sheet's field ; a column the app doesn't know is kept under its own name (« x: » + its header)
  const colKey=h=>{ if(/^(option|variante)/i.test(h.trim())) return 'opt'; const k=fieldFor(h); if(k) return k; const hit=TAB_COLS.find(([re, x])=>x && re.test(h)); return hit ? hit[1] : 'x:'+h.replace(/\s+/g, ' ').trim(); };
  function tabTables(text){
    const lines=String(text||'').replace(/ /g, ' ').split(/\r?\n/), rows=[];
    const isData=l=>{ const c=l.split('\t').map(x=>x.trim()); return c.length>1 && c[0] && !FIRST_COL.test(foldS(c[0])) && c.slice(1).some(x=>x && isValue(x)); };
    for(let i=0; i<lines.length; i++){
      if(!FIRST_COL.test(foldS(lines[i].split('\t')[0]))) continue;
      let j=i; while(j<lines.length && !isData(lines[j])) j++;
      const head=headCells(lines.slice(i, j)), cols=head.slice(1).map(colKey), ref=(/(cal\s*=\s*[\d.,]+\s*€\s*\/\s*mwh)/i.exec(head.join(' '))||[])[1]||'';
      if(!cols.length){ i=j-1; continue; }
      for(; j<lines.length && isData(lines[j]); j++){
        const c=lines[j].split('\t').map(x=>x.trim()), r={ name:c[0], values:{} };
        cols.forEach((k, n)=>{ const v=c[n+1]; if(!v || k==='x:') return; if(k==='opt'){ r.option=v; return; } r.values[k]=NUM.test(v) ? v.replace(/\s*[€%]$/, '').replace('.', ',') : v; });
        if(ref && r.values.c_exemple) r.values.c_exempleRef=ref.replace(/\s+/g, ' ');
        rows.push(r);
      }
      i=j-1;
    }
    return rows;
  }
  function pricingTables(text){
    const a=flatTables(text), seen=new Set(a.map(r=>foldS(r.name)));
    return a.concat(tabTables(text).filter(r=>!seen.has(foldS(r.name))));
  }
  function flatTables(text){
    const cells=String(text||'').split(/\r?\n/).flatMap(l=>l.split('\t')).map(c=>c.replace(/\u00a0/g, ' ').trim()).filter(Boolean), rows=[];
    for(let i=0; i<cells.length; i++){
      if(!FIRST_COL.test(foldS(cells[i]))) continue;
      const head=[]; let j=i+1;
      while(j<cells.length && !NUM.test(cells[j]) && fieldFor(cells[j])!==null){ head.push(cells[j]); j++; }
      if(!head.length) continue;
      while(j+head.length<cells.length && !NUM.test(cells[j]) && head.every((h, k)=>NUM.test(cells[j+1+k]))){
        const r={ name:cells[j], values:{} }; head.forEach((h, k)=>{ r.values[fieldFor(h)]=cells[j+1+k].replace(/\s*[€%]$/, '').replace('.', ','); });
        if(!rows.some(x=>foldS(x.name)===foldS(r.name))) rows.push(r);   // a quoted older reply repeating the table : the most recent kept
        j+=head.length+1;
      }
      i=j-1;
    }
    return rows;
  }
  api.pricingTables=pricingTables;
  // the table to send to the pricing : plain words (the ones its own mails use), only the columns the request needs —
  // each read back into the right line of the Suivi
  api.TEMPLATE_COLS=['Nom du marché', 'Variante (si plusieurs offres)', 'Prix fixe (€/MWh)',
    'Frais d\u2019agrégation 1re période (€/MWh)', 'Frais d\u2019agrégation 1re période (% M0)', 'Valable jusqu\u2019au (1re période)',
    'Frais d\u2019agrégation 2e période (€/MWh)', 'Frais d\u2019agrégation 2e période (% M0)', 'Valable jusqu\u2019au (2e période)',
    'Prix période d\u2019essai (€/MWh)', 'Frais ACC (€/an)', 'Prix GO (€/MWh)', 'Pilotage (€/MWh)',
    'Dont frais de gestion (€/MWh)', 'Dont frais de gestion (% M0)', 'Dont frais fixes (€/MWh)', 'Dont frais fixes (% M0)',
    'Dont marge (€/MWh)', 'Dont marge (% M0)', 'Commentaire'];
  api.templateCols=()=>api.TEMPLATE_COLS.slice();
  // « on est à 0.4 €/MWh pour le pilotage » / « pilotage : 0,4 €/MWh » : the steering's price said in a sentence of the thread
  api.pilotageIn=text=>{ const t=String(text||'');
    const m=/(\d+(?:[.,]\d+)?)\s*€\s*\/\s*MWh[^\n.]{0,25}pilotage/i.exec(t) || /pilotage[^\n\d]{0,30}(\d+(?:[.,]\d+)?)\s*€\s*\/\s*MWh/i.exec(t);
    return m ? m[1].replace('.', ',') : ''; };

  api.init=function(app){
    const { readPipeFiles, caractValue, caractSet, caractKey, PQ_FIELDS, pqFold, touchCrm, saveCrm, notify, reopen, escapeHtml, codeAffaire }=app;
    const fold=s=>pqFold(String(s==null?'':s)).replace(/[^a-z0-9]/g, '');
    const same=(a, b)=>fold(a)===fold(b);
    // which of the sheets a plant of the file is : its name, else its power, else the only one
    function sheetFor(inst, list){
      if(list.length===1) return list[0];
      const n=fold(inst.centrale||(inst.caract && inst.caract['Nom Installation'])||'');
      return (n && list.find(o=>fold(o.centrale||o.title)===n)) || list.find(o=>inst.kwc && Number(o.kwc)===Number(inst.kwc)) || null;
    }
    // what the file would change on one sheet : the app's fields, the file's lines, and the Suivi's lines found by name
    function changes(o, inst, from){
      const out=[], add=(label, now, val, set)=>{ if(String(val==null?'':val).trim()==='' || same(now, val)) return; out.push({ o, label, now:String(now==null?'':now), val:String(val), set, from }); };
      PQ_FIELDS.forEach(f=>{ if(f.k==='stade' || f.type==='check') return; if(inst[f.k]!==undefined) add(f.label, o[f.k], inst[f.k], v=>{ o[f.k]=v; }); });
      Object.keys(inst.caract||{}).forEach(l=>{
        const c=FIELDS.find(x=>fold(x.label)===fold(l));
        if(c) add(c.label, o[c.k], inst.caract[l], v=>{ o[c.k]=v; });
        else add(l, caractValue(o, l), inst.caract[l], v=>{ caractSet(o, l, v); });
      });
      // the file's « Type d'injection » says total or surplus
      const inj=Object.keys(inst.caract||{}).find(l=>caractKey(l)===caractKey("Type d'injection"));
      if(inj && !o.c_surplus){ const t=pqFold(inst.caract[inj]); const v=/surplus|autoconso/.test(t)?'Surplus':/total/.test(t)?'Totalité':''; if(v) add('Surplus / Totalité', '', v, x=>{ o.c_surplus=x; }); }
      // the same change met twice (an app field and its line in the file, e.g. the P50) : shown once
      const seen=new Set();
      return out.filter(r=>{ const k=fold(r.now)+'|'+fold(r.val); if(seen.has(k)) return false; seen.add(k); return true; });
    }
    // the look before filling : every change, the old value beside it ; a value already there and different starts unticked
    function preview(rows, title){
      return new Promise(res=>{
        const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='fill-overlay';
        ov.innerHTML='<div class="modal-box wide fill-box" role="dialog" aria-labelledby="fill-title"><div class="opp-detail-head"><h3 id="fill-title"></h3></div><p class="modal-hint"></p>'
          +'<div class="fill-scroll"><table class="fill-table"><thead><tr><th></th><th>Ligne</th><th>Dans la fiche</th><th>Dans le fichier</th></tr></thead><tbody></tbody></table></div>'
          +'<div class="crm-form-actions"><button type="button" class="ghost-btn fill-cancel">Annuler</button><button type="button" class="fill-go"></button></div></div>';
        ov.querySelector('#fill-title').textContent=title;
        const multi=new Set(rows.map(r=>r.o.id)).size>1;
        ov.querySelector('.modal-hint').textContent=rows.length+' valeur'+(rows.length>1?'s':'')+' trouvée'+(rows.length>1?'s':'')+'. Décoche ce qui ne va pas ; une case déjà remplie autrement est décochée.';
        const tb=ov.querySelector('tbody');
        rows.forEach((r, i)=>{ const tr=document.createElement('tr'); if(r.now) tr.className='conf';
          tr.innerHTML='<td><input type="checkbox" data-i="'+i+'"'+(r.now?'':' checked')+'></td><td class="fl"></td><td class="fo"></td><td class="fn"></td>';
          tr.querySelector('.fl').textContent=(multi?(r.o.centrale||r.o.title||'')+' · ':'')+r.label; tr.querySelector('.fo').textContent=r.now||'—'; tr.querySelector('.fn').textContent=r.val;
          tb.appendChild(tr); });
        const go=ov.querySelector('.fill-go'), count=()=>{ const n=ov.querySelectorAll('tbody input:checked').length; go.textContent='Remplir '+n+' case'+(n>1?'s':''); go.disabled=!n; };
        tb.addEventListener('change', count); count();
        const done=v=>{ ov.remove(); res(v); };
        ov.querySelector('.fill-cancel').onclick=()=>done(null);
        go.onclick=()=>done([...ov.querySelectorAll('tbody input:checked')].map(x=>rows[+x.dataset.i]));
        ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(null); } });
        document.body.appendChild(ov); go.focus();
      });
    }
    // a line of the pricing's table : its sheet by the business code, else by the plant's name in it
    // sure : the business code, or the plant and its producer both in the line's name
    function sheetForLine(r, list){
      const n=fold(r.name);
      return list.find(o=>fold(codeAffaire(o))===n) || list.find(o=>{ const c=fold(o.centrale||o.title); return c && n.includes(c) && n.includes(fold(o.producteur||o.company)); }) || null;
    }
    // looser, after the lots : the plant's name alone in the line's name
    const sheetByName=(r, list)=>{ const n=fold(r.name); return list.find(o=>{ const c=fold(o.centrale||o.title); return c.length>3 && n.includes(c); }) || null; };
    // a line priced for a whole lot (« Lot 1 — toitures », or a business code carrying the lot's name) : every plant of the lot
    // « Lot Brownfield » ↔ the app's lot « Brownfield » or « Lot 1 – Brownfield » : the same words, « lot » and numbers aside
    const lotWords=x=>new Set(pqFold(String(x||'')).split(/[^a-z0-9]+/).filter(w=>w.length>1 && w!=='lot' && !/^\d{1,2}$/.test(w)));
    function lotFor(r, list){
      const rw=lotWords(r.name), lots=[...new Set(list.map(o=>o.lot).filter(Boolean))];
      const lot=lots.filter(l=>{ const lw=lotWords(l); return lw.size && [...lw].every(w=>rw.has(w)); }).sort((a, b)=>lotWords(b).size-lotWords(a).size)[0];
      if(!lot) return { plants:[], extra:'' };
      const plants=list.filter(o=>o.lot===lot), lw=lotWords(lot), pw=lotWords(plants.map(o=>[o.producteur, o.company].join(' ')).join(' '));
      const extra=[...rw].filter(w=>!lw.has(w) && !pw.has(w) && !/^(baseload|bl)$/.test(w));   // « Lot Brownfield - 2028 » : the variant « 2028 » (never the producer's name)
      return { plants, extra:extra.join(' ') };
    }
    // « Plouisy + Moutonnerie - Baseload » : an offer for several plants together, kept on each of them as the group's offer
    const GRP={ c_blMW:'c_grpBlMW', c_formule:'c_grpFormule', c_exemple:'c_grpExemple', c_exempleRef:'c_exempleRef' };
    function groupLine(r, list){
      if(!/\+|\bet\b/i.test(r.name)) return null;
      const n=fold(r.name), plants=list.filter(o=>{ const c=fold(o.centrale||o.title); return c.length>3 && n.includes(c); });
      if(plants.length<2) return null;
      const values={ c_grpNom:r.name.replace(/\s*[-–]\s*(baseload|bl)\s*$/i, '').trim() };
      Object.keys(r.values).forEach(k=>{ values[GRP[k]||k]=r.values[k]; });
      return { plants, values };
    }
    // a line's sheets : the sure match, else its lot (and the variant beyond the lot's name), else the plant's name alone
    function targetsFor(r, list, n){
      const o=sheetForLine(r, list) || (list.length===1 && n===1 ? list[0] : null); if(o) return { plants:[o], extra:'' };
      const lot=lotFor(r, pool(list, app)); if(lot.plants.length) return lot;
      const loose=sheetByName(r, list); return { plants:loose ? [loose] : [], extra:'' };
    }
    // the lines of the table, each onto its sheets : an option or a variant (« Lot Brownfield - 2028 », Option « MES 2028 ») kept
    // apart under its own name ; the lines nobody is found for come back in `left`, to be assigned by hand
    function pricingChanges(text, list, from, assigned){
      const out=[], hit=new Set(), left=[], put=(o, k, v)=>{
        if(k.startsWith('x:')){ const h=k.slice(2), now=(o.pricingExtra||{})[h]; if(v!=='' && !same(now, v)) out.push({ o, label:h, now:String(now==null?'':now), val:v, set:x=>{ o.pricingExtra=Object.assign({}, o.pricingExtra||{}, { [h]:x }); }, from }); return; }
        const f=FIELDS.find(x=>x.k===k); if(f && v!=='' && !same(o[k], v)) out.push({ o, label:f.label, now:String(o[k]==null?'':o[k]), val:v, set:x=>{ o[k]=x; }, from }); };
      const label=k=>{ if(k.startsWith('x:')) return k.slice(2); const f=FIELDS.find(x=>x.k===k); return f ? f.label : k; };
      const onto=(targets, r, variant)=>targets.forEach(x=>{ hit.add(x); Object.keys(r.values).forEach(k=>put(x, variant ? 'x:'+variant+' \u00b7 '+label(k) : k, r.values[k])); });
      const rows=pricingTables(text);
      rows.forEach((r, i)=>{
        const opt=r.option && !/^(base|principale?|standard|-)$/i.test(r.option) ? r.option : '';
        if(assigned && assigned[i]){ onto(assigned[i], r, opt); return; }
        const g=groupLine(r, list); if(g){ g.plants.forEach(x=>{ hit.add(x); Object.keys(g.values).forEach(k=>put(x, k, g.values[k])); }); return; }
        const t=targetsFor(r, list, rows.length);
        if(!t.plants.length){ left.push(i); return; }
        onto(t.plants, r, opt || t.extra);
      });
      // the steering's price, said once for the whole mail : on the plants of its table (or the only sheet)
      const pil=api.pilotageIn(text);
      if(pil) (hit.size ? [...hit] : list.length===1 ? list : []).forEach(o=>put(o, 'c_pilotage', pil));
      return { out, left, rows };
    }
    // the lines found for no sheet : chosen by hand (a lot, or an installation), or left aside
    // a line nobody was found for : a lot of the app (every one, not only those shown), or installations picked by hand —
    // kept as a lot named after the line (« Lot Greenfield » → lot « Greenfield »), found on its own next time
    const lotOf=name=>String(name||'').replace(/^\s*lot\s*[-–:]?\s*/i, '').trim()||String(name||'').trim();
    const pool=(list, app)=>{ const all=(app.opportunities||[]).filter(o=>!o.deleted && o.kind!=='request'); return [...new Set(list.concat(all))]; };
    const prodOf=o=>String(o.producteur||o.company||'Sans producteur').trim();
    const score=(rw, text)=>{ const w=lotWords(text); return [...rw].filter(x=>w.has(x)).length; };
    const SHOW=60;
    function assignLots(all){
      return [...new Set(all.map(o=>o.lot).filter(Boolean))].map(l=>{ const ps=all.filter(o=>o.lot===l); return { l, ps, prod:[...new Set(ps.map(prodOf))].join(', ') }; });
    }
    // the results of one line's search : its lots first (the closest to the line's name on top), then the installations
    function assignResults(st, all, lots){
      const q=pqFold(st.q||''), hit=t=>!q || pqFold(t).includes(q), rw=lotWords(st.name);
      const ls=lots.filter(x=>hit('lot '+x.l+' '+x.prod)).map(x=>({ x, s:score(rw, x.l+' '+x.prod) })).sort((a, b)=>b.s-a.s || a.x.l.localeCompare(b.x.l, 'fr'));
      const ps=all.filter(o=>hit([o.centrale, o.title, prodOf(o), o.lot, codeAffaire(o)].join(' '))).map(o=>({ o, s:score(rw, [o.centrale||o.title, prodOf(o), o.lot].join(' ')) }))
        .sort((a, b)=>b.s-a.s || prodOf(a.o).localeCompare(prodOf(b.o), 'fr') || String(a.o.centrale||'').localeCompare(String(b.o.centrale||''), 'fr'));
      const more=n=>n>SHOW ? '<p class="as-more">… et '+(n-SHOW)+' autres : affine la recherche</p>' : '';
      return '<div class="as-sec">Lots <i>'+ls.length+'</i></div>'+(ls.length ? ls.slice(0, SHOW).map(({ x })=>'<button type="button" class="as-opt as-lot" data-lot="'+escapeHtml(x.l)+'"><b>Lot · '+escapeHtml(x.l)+'</b><span>'+escapeHtml(x.prod)+' · '+x.ps.length+' installation'+(x.ps.length>1?'s':'')+'</span></button>').join('')+more(ls.length) : '<p class="as-more">Aucun lot</p>')
        +'<div class="as-sec">Installations <i>'+ps.length+'</i> <small>coche celles du lot</small></div>'
        +ps.slice(0, SHOW).map(({ o })=>'<label class="as-opt"><input type="checkbox" value="'+escapeHtml(o.id)+'"'+(st.ids.has(o.id)?' checked':'')+'><b>'+escapeHtml(o.centrale||o.title||'?')+'</b><span>'+escapeHtml(prodOf(o)+(o.lot?' · lot '+o.lot:''))+'</span></label>').join('')+more(ps.length);
    }
    function assignDialog(rows, left, list, app){
      return new Promise(res=>{
        const all=pool(list, app), lots=assignLots(all), st=left.map(i=>({ i, name:rows[i].name, q:'', ids:new Set(), lot:null, save:true }));
        const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='assign-overlay';
        ov.innerHTML='<div class="modal-box wide fill-box" role="dialog" aria-labelledby="assign-title"><div class="opp-detail-head"><h3 id="assign-title">À quoi correspondent ces lignes ?</h3></div>'
          +'<p class="modal-hint">'+left.length+' ligne'+(left.length>1?'s':'')+' du tableau du pricing sans fiche ni lot reconnus. Pour chacune : un lot, ou coche ses installations (l’appli s’en souviendra). Sans choix, la ligne est ignorée.</p>'
          +'<div class="as-rows"></div><div class="crm-form-actions"><button type="button" class="ghost-btn as-cancel">Annuler</button><button type="button" class="fill-go as-go">Continuer</button></div></div>';
        const box=ov.querySelector('.as-rows');
        const label=s=>s.lot ? 'Lot · '+s.lot : s.ids.size ? s.ids.size+' installation'+(s.ids.size>1?'s':'')+(s.save?' → lot « '+lotOf(s.name)+' »':'') : 'Choisir…';
        const paintBtn=(row, s)=>{ const btn=row.querySelector('.as-pick-btn'); btn.textContent=label(s); btn.classList.toggle('set', !!(s.lot||s.ids.size)); row.querySelector('.as-clear').hidden=!(s.lot||s.ids.size); };
        const paintRes=(row, s)=>{ row.querySelector('.as-res').innerHTML=assignResults(s, all, lots); };
        const close=row=>{ const p=row.querySelector('.as-panel'); if(p) p.remove(); };
        function open(row, s){
          box.querySelectorAll('.as-row').forEach(close);
          const p=document.createElement('div'); p.className='as-panel';
          p.innerHTML='<input type="text" class="as-filter" placeholder="Chercher un lot, une centrale, un producteur, un code affaire"><div class="as-res"></div>'
            +'<div class="as-foot"><label class="as-save-l"><input type="checkbox" class="as-save"'+(s.save?' checked':'')+'> Retenir les installations cochées comme lot « <span></span> »</label><button type="button" class="pipe-bar-btn as-ok">OK</button></div>';
          p.querySelector('.as-save-l span').textContent=lotOf(s.name);
          row.appendChild(p); const f=p.querySelector('.as-filter'); f.value=s.q; paintRes(row, s); f.focus();
          let t=null; f.oninput=()=>{ clearTimeout(t); t=setTimeout(()=>{ s.q=f.value; paintRes(row, s); }, 120); };
          f.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); const first=p.querySelector('.as-lot'); if(first) first.click(); } if(e.key==='Escape'){ e.stopPropagation(); close(row); row.querySelector('.as-pick-btn').focus(); } };
          p.onclick=e=>{ const l=e.target.closest('.as-lot'); if(!l) return; s.lot=l.dataset.lot; s.ids.clear(); paintBtn(row, s); close(row); };
          p.onchange=e=>{ const x=e.target; if(x.classList.contains('as-save')){ s.save=x.checked; } else if(x.type==='checkbox'){ if(x.checked) s.ids.add(x.value); else s.ids.delete(x.value); s.lot=null; } paintBtn(row, s); };
          p.querySelector('.as-ok').onclick=()=>{ close(row); row.querySelector('.as-pick-btn').focus(); };
        }
        st.forEach(s=>{ const row=document.createElement('div'); row.className='as-row';
          row.innerHTML='<div class="as-line"><span class="as-name"></span><button type="button" class="pipe-bar-btn as-pick-btn"></button><button type="button" class="as-clear" title="Ignorer cette ligne" hidden>×</button></div>';
          row.querySelector('.as-name').textContent=s.name; paintBtn(row, s);
          row.querySelector('.as-pick-btn').onclick=()=>{ if(row.querySelector('.as-panel')) close(row); else open(row, s); };
          row.querySelector('.as-clear').onclick=()=>{ s.lot=null; s.ids.clear(); paintBtn(row, s); close(row); };
          box.appendChild(row); });
        const done=v=>{ ov.remove(); res(v); };
        ov.querySelector('.as-cancel').onclick=()=>done(null);
        ov.querySelector('.as-go').onclick=()=>{ const map={}, keep=[];
          st.forEach(s=>{ const plants=s.lot ? all.filter(o=>o.lot===s.lot) : all.filter(o=>s.ids.has(o.id)); if(!plants.length) return;
            map[s.i]=plants; if(!s.lot && s.save) keep.push({ plants, name:lotOf(s.name) }); });
          done({ map, lots:keep }); };
        ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(null); } });
        document.body.appendChild(ov); ov.querySelector('.as-pick-btn').focus();
      });
    }
    // the pricing's changes, with the lines nobody was found for chosen by hand first
    async function pricingChangesAsk(text, list, from){
      const first=pricingChanges(text, list, from);
      if(!first.left.length || (list.length===1 && first.out.length)) return first.out;   // on a single sheet, the other plants' lines are none of its business
      const got=await assignDialog(first.rows, first.left, list, app); if(!got) return first.out;
      const out=pricingChanges(text, list, from, got.map).out; out.lots=got.lots; return out;
    }
    async function fill(files, list){
      let got; try{ got=await readPipeFiles(files); }catch(e){ notify('Fichier illisible : '+(e&&e.message||e)); return; }
      const rows=await pricingChangesAsk(got.text, list, got.names.join(', '));
      (got.installs||[]).forEach(inst=>{ const o=sheetFor(inst, list); if(o) rows.push(...changes(o, inst, got.names.join(', '))); });
      await apply(rows, got, list);
    }
    // the text of a mail pasted (the pricing's answer copied out of Outlook)
    async function fillText(text, list){ await apply(await pricingChangesAsk(text, list, 'texte collé'), { names:['le texte collé'], installs:[], text }, list); }
    // the pricing's mails kept on the sheets they filled (the text, read back later ; at most 20 000 characters, the last 10)
    const mailHash=t=>{ let h=5381; for(let i=0; i<t.length; i++) h=((h*33)^t.charCodeAt(i))>>>0; return h.toString(36); };
    function keepMail(sheets, got){
      const text=String(got.text).slice(0, 20000), h=mailHash(text), subj=(/^Objet\s*:\s*(.+)$/mi.exec(text)||[])[1]||'';
      sheets.forEach(o=>{ const l=(o.pricingMails||[]).filter(m=>m.h!==h); l.push({ at:Date.now(), name:got.names.join(', '), subject:subj.trim(), text, h }); o.pricingMails=l.slice(-10); });
    }
    // the mails of a sheet : a line each, a click shows its text
    function mailsBlock(o){
      const l=(o.pricingMails||[]).slice().reverse(); if(!l.length) return null;
      const box=document.createElement('div'); box.className='pr-mails';
      l.forEach(m=>{ const b=document.createElement('button'); b.type='button'; b.className='pr-mail';
        b.textContent='\u2709 '+new Date(m.at).toLocaleDateString('fr-FR')+' \u00b7 '+(m.subject||m.name);
        b.onclick=()=>showMail(m); box.appendChild(b); });
      return box;
    }
    function showMail(m){
      const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='pmail-overlay';
      ov.innerHTML='<div class="modal-box wide fill-box" role="dialog" aria-labelledby="pmail-title"><div class="opp-detail-head"><h3 id="pmail-title"></h3></div><pre class="pr-mail-text"></pre><div class="crm-form-actions"><button type="button" class="ghost-btn pm-copy">Copier</button><button type="button" class="ghost-btn pm-close">Fermer</button></div></div>';
      ov.querySelector('#pmail-title').textContent=(m.subject||m.name)+' \u00b7 '+new Date(m.at).toLocaleDateString('fr-FR');
      ov.querySelector('.pr-mail-text').textContent=m.text;
      const close=()=>ov.remove(); ov.querySelector('.pm-close').onclick=close; ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } });
      ov.querySelector('.pm-copy').onclick=()=>{ try{ navigator.clipboard.writeText(m.text); notify('Mail copié.'); }catch(e){ notify('Copie impossible.'); } };
      document.body.appendChild(ov); ov.querySelector('.pm-close').focus();
    }
    // the lots made while assigning the lines : each installation picked gets the lot's name
    const saveLots=lots=>(lots||[]).flatMap(l=>l.plants.filter(o=>o.lot!==l.name).map(o=>{ o.lot=l.name; return o; }));
    async function apply(rows, got, list){
      if(!rows.length){ notify(got.installs && got.installs.length ? 'Rien de nouveau dans '+got.names.join(', ')+' pour cette fiche.' : 'Rien trouvé pour cette fiche dans '+got.names.join(', ')+' : ni centrale (Excel Caractéristiques Centrales ou du producteur), ni tableau de prix du pricing (« Nom du marché » + colonnes en €/MWh, avec le code affaire de la fiche).'); return; }
      const ok=await preview(rows, 'Remplir depuis « '+got.names.join(', ')+' »'); if(!ok || !ok.length) return;
      ok.forEach(r=>r.set(r.val));
      const lotted=saveLots(rows.lots);
      if(got.text && pricingTables(got.text).length) keepMail(new Set(ok.map(r=>r.o)), got);
      new Set(ok.map(r=>r.o).concat(lotted)).forEach(o=>touchCrm(o)); await saveCrm();
      notify(ok.length+' case'+(ok.length>1?'s':'')+' remplie'+(ok.length>1?'s':'')+'.'); reopen();
    }
    // the zone at the top of a sheet ; the whole sheet takes a drop too
    function dropZone(list, host, title){
      const z=document.createElement('label'); z.className='fill-drop';
      z.innerHTML='<input type="file" multiple accept=".xlsx,.xlsm,.xls,.msg,.eml" hidden><b>'+(title||'Dépose un fichier ici pour remplir la fiche')+'</b><span>Caractéristiques Centrales, Excel du producteur, mail du pricing (.msg, .eml) — ou clique pour le choisir. Tu valides avant que rien ne change.</span> <button type="button" class="fill-paste">ou colle le texte d\u2019un mail</button>';
      const inp=z.querySelector('input'); inp.onchange=()=>{ if(inp.files.length) fill([...inp.files], list); inp.value=''; };
      z.querySelector('.fill-paste').onclick=e=>{ e.preventDefault(); e.stopPropagation(); pasteBox(list); };
      // the sheet's body stays the same element from one sheet to the next : listened to once, for the sheet now shown
      const target=host||z; target._fillList=list;
      if(!target.dataset.fillDrop){ target.dataset.fillDrop='1';
        const zone=()=>target.querySelector('.fill-drop');
        target.addEventListener('dragover', e=>{ if(e.dataTransfer && [...e.dataTransfer.types].includes('Files') && zone()){ e.preventDefault(); zone().classList.add('drag'); } });
        target.addEventListener('dragleave', e=>{ if(e.target===target && zone()) zone().classList.remove('drag'); });
        target.addEventListener('drop', e=>{ if(!e.dataTransfer || !e.dataTransfer.files.length || !zone()) return; e.preventDefault(); zone().classList.remove('drag'); fill([...e.dataTransfer.files], target._fillList); }); }
      return z;
    }
    // a box to paste the mail's text into (Ctrl+A, Ctrl+C in Outlook, then Ctrl+V here)
    function pasteBox(list){
      const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='paste-overlay';
      ov.innerHTML='<div class="modal-box wide fill-box" role="dialog" aria-labelledby="paste-title"><div class="opp-detail-head"><h3 id="paste-title">Coller le mail du pricing</h3></div>'
        +'<p class="modal-hint">Dans Outlook : ouvre le mail, Ctrl+A puis Ctrl+C ; ici : Ctrl+V. Les prix et frais sont repérés par centrale (code affaire), tu valides ensuite.</p>'
        +'<textarea class="paste-text" rows="10" style="width:100%"></textarea><div class="crm-form-actions"><button type="button" class="ghost-btn paste-cancel">Annuler</button><button type="button" class="fill-go paste-go">Analyser</button></div></div>';
      document.body.appendChild(ov);
      const ta=ov.querySelector('textarea'), close=()=>ov.remove(); ta.focus();
      ov.querySelector('.paste-cancel').onclick=close;
      ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); close(); } });
      ov.querySelector('.paste-go').onclick=()=>{ const t=ta.value; close(); fillText(t, list); };
    }
    Object.assign(api, { dropZone, fill, fillText, escapeHtml, mailsBlock, showMail });
  };
  return api;
})();
