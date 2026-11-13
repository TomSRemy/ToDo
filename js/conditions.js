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
  const colKey=h=>{ if(/^(option|variante)/i.test(h.trim())) return 'opt'; if(/code.{0,6}affaire/i.test(h)) return 'codes'; const k=fieldFor(h); if(k) return k; const hit=TAB_COLS.find(([re, x])=>x && re.test(h)); return hit ? hit[1] : 'x:'+h.replace(/\s+/g, ' ').trim(); };
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
        cols.forEach((k, n)=>{ const v=c[n+1]; if(!v || k==='x:') return; if(k==='opt'){ r.option=v; return; } if(k==='codes'){ r.codes=v; return; } r.values[k]=NUM.test(v) ? v.replace(/\s*[€%]$/, '').replace('.', ',') : v; });
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
  api.TEMPLATE_COLS=['Nom du marché', 'Code(s) affaire (à garder)', 'Variante (si plusieurs offres)', 'Prix fixe (€/MWh)',
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

  let appRef={};
  api.init=function(app){
    appRef=app;
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
    // the preview of a pricing mail over several installations : one line per line of the mail (a lot, a plant), its
    // values in columns like the table sent ; opened, its installations by business code — a value already typed
    // differently in orange, kept unless ticked
    const SHORT={ c_pu:'Prix fixe', c_fgP1:'Frais €/MWh P1', c_m0P1:'Frais % M0 P1', c_finP1:'Jusqu’au P1', c_fgP2:'Frais €/MWh P2', c_m0P2:'Frais % M0 P2', c_finP2:'Jusqu’au P2',
      c_pePrix:'Prix essai', c_fgAcc:'ACC €/an', c_puGo:'Prix GO', c_pilotage:'Pilotage', c_fgGestion:'Gestion €/MWh', c_fgGestionPct:'Gestion % M0', c_fgFixe:'Fixes €/MWh',
      c_fgFixePct:'Fixes % M0', c_fgMarge:'Marge €/MWh', c_fgMargePct:'Marge % M0', c_blMW:'Baseload MW', c_formule:'Formule', c_exemple:'Exemple' };
    const shortOf=k=>SHORT[k] || (String(k).startsWith('x:') ? k.slice(2) : (FIELDS.find(f=>f.k===k)||{}).label || k);
    const refOf=o=>codeAffaire(o) || o.centrale || o.title || '?';
    function previewGroups(rows){
      const groups=[], at=new Map();
      rows.forEach((r, i)=>{ const g=r.line || ('Fiche · '+refOf(r.o)); if(!at.has(g)){ at.set(g, groups.length); groups.push({ name:g, variant:r.variant||'', idx:[] }); } groups[at.get(g)].idx.push(i); });
      return groups;
    }
    function previewHtml(rows, groups, keys){
      const cell=(g, k)=>{ const rs=g.idx.map(i=>rows[i]).filter(r=>(r.k||r.label)===k); if(!rs.length) return '<td class="fg-v fg-e">—</td>';
        const vals=[...new Set(rs.map(r=>r.val))], conf=rs.filter(r=>r.now).length;
        return '<td class="fg-v'+(conf?' conf':'')+'"'+(conf?' title="'+conf+' installation'+(conf>1?'s ont':' a')+' déjà une autre valeur : ouvre la ligne pour choisir"':'')+'>'+escapeHtml(vals.length===1 ? vals[0] : 'variable')+(conf?' <i>'+conf+'</i>':'')+'</td>'; };
      const sub=(g, n)=>[...new Set(g.idx.map(i=>rows[i].o))].map(o=>'<tr class="fg-sub" data-g="'+n+'" hidden><td><input type="checkbox" class="fg-p" data-g="'+n+'" data-o="'+escapeHtml(o.id)+'" aria-label="'+escapeHtml(refOf(o))+'"></td><td class="fg-ref"><b>'+escapeHtml(refOf(o))+'</b><span>'+escapeHtml([o.centrale||o.title, o.producteur||o.company].filter(Boolean).join(' · '))+'</span></td><td></td>'
        +keys.map(k=>{ const ri=g.idx.find(i=>rows[i].o===o && (rows[i].k||rows[i].label)===k); if(ri==null) return '<td class="fg-v fg-e"></td>'; const r=rows[ri];
          return r.now ? '<td class="fg-v conf"><label><input type="checkbox" class="fg-c" data-i="'+ri+'"> <s>'+escapeHtml(r.now)+'</s> '+escapeHtml(r.val)+'</label></td>' : '<td class="fg-v">'+escapeHtml(r.val)+'</td>'; }).join('')+'</tr>').join('');
      return '<table class="fill-table fg-table"><thead><tr><th></th><th>Ligne du mail</th><th>Inst.</th>'+keys.map(k=>'<th>'+escapeHtml(shortOf(k))+'</th>').join('')+'</tr></thead><tbody>'
        +groups.map((g, n)=>{ const os=new Set(g.idx.map(i=>rows[i].o)), conf=g.idx.some(i=>rows[i].now);
          return '<tr class="fg-grp'+(conf?' has-conf':'')+'"><td><input type="checkbox" class="fg-g" data-g="'+n+'" aria-label="'+escapeHtml(g.name)+'"></td><td class="fg-name"><button type="button" class="fg-x pr-fold" data-g="'+n+'" aria-expanded="false" title="Voir les installations">▸</button><b>'+escapeHtml(g.name)+'</b>'+(g.variant?'<span>variante « '+escapeHtml(g.variant)+' », gardée à part</span>':'')+'</td><td class="fg-n">'+os.size+'</td>'
            +keys.map(k=>cell(g, k)).join('')+'</tr>'+sub(g, n); }).join('')+'</tbody></table>';
    }
    function previewGrouped(rows, title){
      return new Promise(res=>{
        const order=k=>{ const i=FIELDS.findIndex(f=>f.k===k); return i<0 ? 999 : i; };
        const keys=[...new Set(rows.map(r=>r.k||r.label))].sort((a, b)=>order(a)-order(b)), groups=previewGroups(rows);
        const sel=new Set(rows.map((r, i)=>r.now ? -1 : i).filter(i=>i>=0)), nPlants=new Set(rows.map(r=>r.o)).size, nConf=rows.filter(r=>r.now).length;
        const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='fill-overlay';
        ov.innerHTML='<div class="modal-box wide fill-box fg-box" role="dialog" aria-labelledby="fill-title"><div class="opp-detail-head"><h3 id="fill-title"></h3></div><p class="modal-hint"></p>'
          +'<div class="fill-scroll">'+previewHtml(rows, groups, keys)+'</div>'
          +'<div class="crm-form-actions"><button type="button" class="ghost-btn fill-cancel">Annuler</button><button type="button" class="fill-go"></button></div></div>';
        ov.querySelector('#fill-title').textContent=title;
        ov.querySelector('.modal-hint').textContent=groups.length+' ligne'+(groups.length>1?'s':'')+' du mail · '+nPlants+' installations. ▸ pour voir les installations d’une ligne, par code affaire.'
          +(nConf ? ' '+nConf+' valeur'+(nConf>1?'s':'')+' déjà saisie'+(nConf>1?'s':'')+' autrement (en orange) : gardée'+(nConf>1?'s':'')+', sauf si tu coches.' : '');
        const tb=ov.querySelector('tbody'), go=ov.querySelector('.fill-go'), plain=i=>!rows[i].now;
        const ofG=n=>groups[n].idx, ofP=(n, id)=>groups[n].idx.filter(i=>rows[i].o.id===id);
        const tick=(box, idx)=>{ const p=idx.filter(plain), on=p.length ? p.filter(i=>sel.has(i)).length : idx.filter(i=>sel.has(i)).length, all=p.length||idx.length; box.checked=on===all && all>0; box.indeterminate=on>0 && on<all; };
        const paint=()=>{ tb.querySelectorAll('.fg-g').forEach(b=>tick(b, ofG(+b.dataset.g))); tb.querySelectorAll('.fg-p').forEach(b=>tick(b, ofP(+b.dataset.g, b.dataset.o)));
          tb.querySelectorAll('.fg-c').forEach(b=>{ b.checked=sel.has(+b.dataset.i); });
          const os=new Set([...sel].map(i=>rows[i].o)).size; go.textContent=sel.size ? 'Remplir '+os+' installation'+(os>1?'s':'')+' ('+sel.size+' cases)' : 'Rien à remplir'; go.disabled=!sel.size; };
        tb.addEventListener('change', e=>{ const b=e.target, set=(idx, on)=>idx.forEach(i=>{ if(on) sel.add(i); else sel.delete(i); });
          if(b.classList.contains('fg-g')) set(b.checked ? ofG(+b.dataset.g).filter(plain) : ofG(+b.dataset.g), b.checked);
          else if(b.classList.contains('fg-p')) set(b.checked ? ofP(+b.dataset.g, b.dataset.o).filter(plain) : ofP(+b.dataset.g, b.dataset.o), b.checked);
          else if(b.classList.contains('fg-c')) set([+b.dataset.i], b.checked);
          paint(); });
        tb.addEventListener('click', e=>{ const x=e.target.closest('.fg-x'); if(!x) return; const open=x.getAttribute('aria-expanded')!=='true';
          x.setAttribute('aria-expanded', String(open)); x.textContent=open?'▾':'▸'; tb.querySelectorAll('.fg-sub[data-g="'+x.dataset.g+'"]').forEach(tr=>{ tr.hidden=!open; }); });
        paint();
        const done=v=>{ ov.remove(); res(v); };
        ov.querySelector('.fill-cancel').onclick=()=>done(null);
        go.onclick=()=>done([...sel].sort((a, b)=>a-b).map(i=>rows[i]));
        ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(null); } });
        document.body.appendChild(ov); go.focus();
      });
    }
    function preview(rows, title){
      if(new Set(rows.map(r=>r.o)).size>1) return previewGrouped(rows, title);
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
    // a line priced for a whole lot (« Lot 1 — toitures », or a business code carrying the lot's name) : every plant of the lot
    // « Lot Brownfield » ↔ the app's lot « Brownfield » or « Lot 1 – Brownfield » : the same words, « lot » and numbers aside
    const lotWords=x=>new Set(pqFold(String(x||'')).split(/[^a-z0-9]+/).filter(w=>w.length>1 && w!=='lot' && !/^\d{1,2}$/.test(w)));
    // the app's lots : the plants' « lot », and the requests named like a lot (« Lot Greenfield », a request of 33 plants) ;
    // the other requests (« Solarhona ») only offered by hand, never matched on their own (a producer's name is no lot)
    function lotsIn(all){
      const out=[...new Set(all.map(o=>o.lot).filter(Boolean))].map(l=>({ key:'lot:'+l, name:l, ps:all.filter(o=>o.lot===l), isLot:true }));
      (appRef.opportunities||[]).filter(r=>r.kind==='request' && !r.deleted).forEach(r=>{ const ps=all.filter(o=>o.requestId===r.id && !o.deleted);
        const name=String(r.label||r.company||'Demande'); if(ps.length) out.push({ key:'req:'+r.id, name, ps, isLot:/^\s*lot\b/i.test(name) }); });
      return out;
    }
    function lotFor(r, list){
      const rw=lotWords(r.name), fit=lotsIn(list).filter(x=>x.isLot).map(x=>({ x, lw:lotWords(x.name) })).filter(({ lw })=>lw.size && [...lw].every(w=>rw.has(w)));
      const top=Math.max(0, ...fit.map(f=>f.lw.size)), best=fit.filter(f=>f.lw.size===top);
      const keys=new Set(best.map(f=>f.x.ps.map(o=>o.id).sort().join(',')));
      if(!best.length || keys.size>1) return { plants:[], extra:'' };   // two lots fit as well (« Lot Brownfield - 2028 » : Brownfield ? 2028 ?) : asked
      const { x, lw }=best[0], pw=lotWords(x.ps.map(o=>[o.producteur, o.company].join(' ')).join(' '));
      const extra=[...rw].filter(w=>!lw.has(w) && !pw.has(w) && !/^(baseload|bl)$/.test(w));   // « Lot Brownfield - 2028 » : the variant « 2028 » (never the producer's name)
      return { plants:x.ps, extra:extra.join(' ') };
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
    // what a line of the pricing's table is, and how sure : its business codes (the column « Code(s) affaire », or the
    // code as the line's name) are sure ; a lot's name, a plant's name are proposals, always shown before anything is filled
    const SURE=new Set(['codes', 'code', 'sheet']);
    const codesOf=t=>String(t||'').split(/[,;\n]+/).map(fold).filter(x=>x.length>5);
    function propose(r, list, n){
      const all=pool(list, appRef), name=fold(r.name);
      const cs=codesOf(r.codes), byCodes=cs.length ? all.filter(o=>cs.includes(fold(codeAffaire(o)))) : [];
      if(byCodes.length) return { plants:byCodes, extra:'', how:'codes' };
      const code=all.find(o=>{ const c=fold(codeAffaire(o)); return c.length>8 && name.includes(c); }); if(code) return { plants:[code], extra:'', how:'code' };
      const g=groupLine(r, list); if(g) return { plants:g.plants, extra:'', how:'group', group:g };
      if(list.length===1 && n===1) return { plants:[list[0]], extra:'', how:'sheet' };
      // a plant's whole name in the line (« GREENFIELD 3 seul ») is more precise than its lot's (« Greenfield ») : the plant
      const named=list.map(o=>({ o, c:fold(o.centrale||o.title) })).filter(x=>x.c.length>3 && name.includes(x.c)).sort((x, y)=>y.c.length-x.c.length)[0];
      const lot=lotFor(r, all), lotLen=lot.plants.length ? Math.max(...lotsIn(all).filter(x=>x.ps.length===lot.plants.length && x.ps.every(o=>lot.plants.includes(o))).map(x=>fold(lotOf(x.name)).length), 0) : 0;
      if(lot.plants.length && !(named && named.c.length>lotLen)) return Object.assign(lot, { how:'lot' });
      return named ? { plants:[named.o], extra:'', how:'name' } : { plants:[], extra:'', how:'' };
    }
    // the lines of the table, each onto the installations decided for it : an option or a variant (« Lot Brownfield - 2028 »,
    // Option « MES 2028 ») kept apart under its own name
    function pricingChanges(text, list, from, decided){
      // m : where the value comes from, for the preview (the mail's line, the field without its variant, the variant)
      const out=[], hit=new Set(), put=(o, k, v, m)=>{ const meta=m||{ line:'', k };
        if(k.startsWith('x:')){ const h=k.slice(2), now=(o.pricingExtra||{})[h]; if(v!=='' && !same(now, v)) out.push(Object.assign({ o, label:h, now:String(now==null?'':now), val:v, set:x=>{ o.pricingExtra=Object.assign({}, o.pricingExtra||{}, { [h]:x }); }, from }, meta)); return; }
        const f=FIELDS.find(x=>x.k===k); if(f && v!=='' && !same(o[k], v)) out.push(Object.assign({ o, label:f.label, now:String(o[k]==null?'':o[k]), val:v, set:x=>{ o[k]=x; }, from }, meta)); };
      const label=k=>{ if(k.startsWith('x:')) return k.slice(2); const f=FIELDS.find(x=>x.k===k); return f ? f.label : k; };
      const onto=(targets, r, variant)=>targets.forEach(x=>{ hit.add(x); Object.keys(r.values).forEach(k=>put(x, variant ? 'x:'+variant+' · '+label(k) : k, r.values[k], { line:r.name, k, variant })); });
      const rows=pricingTables(text), dec=decided || rows.map(r=>propose(r, list, rows.length));
      rows.forEach((r, i)=>{
        const d=dec[i]; if(!d || !d.plants.length) return;
        const opt=r.option && !/^(base|principale?|standard|-)$/i.test(r.option) ? r.option : '';
        if(d.group){ d.group.plants.forEach(x=>{ hit.add(x); Object.keys(d.group.values).forEach(k=>put(x, k, d.group.values[k], { line:r.name, k })); }); return; }
        onto(d.plants, r, opt || d.extra);
      });
      // the steering's price, said once for the whole mail : on the plants of its table (or the only sheet)
      const pil=api.pilotageIn(text);
      if(pil) (hit.size ? [...hit] : list.length===1 ? list : []).forEach(o=>put(o, 'c_pilotage', pil, { line:'Pilotage (dit dans le mail)', k:'c_pilotage' }));
      return { out, rows };
    }
    // a line : a lot of the app (every one, not only those shown), or installations picked by hand —
    // kept as a lot named after the line (« Lot Greenfield » → lot « Greenfield »), found on its own next time
    const lotOf=name=>String(name||'').replace(/^\s*lot\s*[-–:]?\s*/i, '').trim()||String(name||'').trim();
    const pool=(list, app)=>{ const all=(app.opportunities||[]).filter(o=>!o.deleted && o.kind!=='request'); return [...new Set(list.concat(all))]; };
    const prodOf=o=>String(o.producteur||o.company||'Sans producteur').trim();
    const score=(rw, text)=>{ const w=lotWords(text); return [...rw].filter(x=>w.has(x)).length; };
    const SHOW=60;
    const HOW={ codes:['ok', 'codes affaire'], code:['ok', 'code affaire'], sheet:['ok', 'cette fiche'], group:['chk', 'offre groupée · à vérifier'], lot:['chk', 'nom du lot · à vérifier'],
      name:['chk', 'nom de centrale · à vérifier'], hand:['ok', 'choisi'], '':['none', 'à choisir'] };
    const lotItem=x=>'<button type="button" class="as-opt as-lot" data-key="'+escapeHtml(x.key)+'"><b>'+escapeHtml(x.isLot && !/^\s*lot\b/i.test(x.name) ? 'Lot · '+x.name : x.name)+'</b><span>'
      +escapeHtml([...new Set(x.ps.map(prodOf))].join(', '))+' · '+x.ps.length+' installation'+(x.ps.length>1?'s':'')+'</span></button>';
    // the results of one line's search : the lots first (the closest to the line's name on top), the other requests, then the
    // installations, those ticked first
    function assignResults(st, all, lots){
      const q=pqFold(st.q||''), hit=t=>!q || pqFold(t).includes(q), rw=lotWords(st.name);
      const more=n=>n>SHOW ? '<p class="as-more">… et '+(n-SHOW)+' autres : affine la recherche</p>' : '';
      const rank=l=>l.filter(x=>hit(x.name+' '+x.ps.map(prodOf).join(' '))).map(x=>({ x, s:score(rw, x.name) })).sort((a, b)=>b.s-a.s || a.x.name.localeCompare(b.x.name, 'fr')).map(y=>y.x);
      const ls=rank(lots.filter(x=>x.isLot)), rs=rank(lots.filter(x=>!x.isLot));
      const ps=all.filter(o=>hit([o.centrale, o.title, prodOf(o), o.lot, codeAffaire(o)].join(' '))).map(o=>({ o, s:(st.ids.has(o.id)?100:0)+score(rw, [o.centrale||o.title, prodOf(o), o.lot].join(' ')) }))
        .sort((a, b)=>b.s-a.s || prodOf(a.o).localeCompare(prodOf(b.o), 'fr') || String(a.o.centrale||'').localeCompare(String(b.o.centrale||''), 'fr'));
      return '<div class="as-sec">Lots <i>'+ls.length+'</i></div>'+(ls.length ? ls.slice(0, SHOW).map(lotItem).join('')+more(ls.length) : '<p class="as-more">Aucun lot</p>')
        +(rs.length ? '<div class="as-sec">Autres demandes <i>'+rs.length+'</i></div>'+rs.slice(0, SHOW).map(lotItem).join('')+more(rs.length) : '')
        +'<div class="as-sec">Installations <i>'+ps.length+'</i> <small>coche celles de la ligne</small></div>'
        +ps.slice(0, SHOW).map(({ o })=>'<label class="as-opt"><input type="checkbox" value="'+escapeHtml(o.id)+'"'+(st.ids.has(o.id)?' checked':'')+'><b>'+escapeHtml(refOf(o))+'</b><span>'+escapeHtml([codeAffaire(o) ? o.centrale||o.title : '', prodOf(o), o.lot ? 'lot '+o.lot : ''].filter(Boolean).join(' · '))+'</span></label>').join('')+more(ps.length);
    }
    // what a line goes to, in words : its lot's name when it is exactly a lot, else its business code(s)
    function targetLabel(s, all, lots){
      if(!s.ids.size) return 'Choisir…';
      const ids=[...s.ids].sort().join(','), lot=lots.find(x=>x.ps.map(o=>o.id).sort().join(',')===ids);
      if(lot) return lot.name+' · '+lot.ps.length+' inst.';
      const ps=all.filter(o=>s.ids.has(o.id));
      return ps.length===1 ? refOf(ps[0]) : ps.length+' installations'+(s.save?' → lot « '+lotOf(s.name)+' »':'');
    }
    function assignRow(s, all, lots, paintAll){
      const row=document.createElement('div'); row.className='as-row';
      row.innerHTML='<div class="as-line"><span class="as-name"></span><span class="as-how"></span><button type="button" class="pipe-bar-btn as-pick-btn"></button><button type="button" class="as-clear" title="Ignorer cette ligne">×</button></div>';
      row.querySelector('.as-name').textContent=s.name;
      const paint=()=>{ const h=HOW[s.how]||HOW['']; const t=row.querySelector('.as-how'); t.className='as-how '+h[0]; t.textContent=s.ids.size ? h[1] : HOW[''][1];
        const btn=row.querySelector('.as-pick-btn'); btn.textContent=targetLabel(s, all, lots); btn.classList.toggle('set', !!s.ids.size); row.querySelector('.as-clear').hidden=!s.ids.size; paintAll(); };
      const close=()=>{ const p=row.querySelector('.as-panel'); if(p) p.remove(); };
      const hand=()=>{ s.how='hand'; s.group=null; s.extra=''; };
      function open(){
        row.parentNode.querySelectorAll('.as-panel').forEach(p=>p.remove());
        const p=document.createElement('div'); p.className='as-panel';
        p.innerHTML='<input type="text" class="as-filter" placeholder="Chercher un lot, une centrale, un producteur, un code affaire"><div class="as-res"></div>'
          +'<div class="as-foot"><label class="as-save-l"><input type="checkbox" class="as-save"'+(s.save?' checked':'')+'> Retenir les installations cochées comme lot « <span></span> »</label><button type="button" class="pipe-bar-btn as-ok">OK</button></div>';
        p.querySelector('.as-save-l span').textContent=lotOf(s.name);
        row.appendChild(p); const f=p.querySelector('.as-filter'), res=()=>{ p.querySelector('.as-res').innerHTML=assignResults(s, all, lots); };
        f.value=s.q; res(); f.focus();
        let t=null; f.oninput=()=>{ clearTimeout(t); t=setTimeout(()=>{ s.q=f.value; res(); }, 120); };
        f.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); const first=p.querySelector('.as-lot'); if(first) first.click(); } if(e.key==='Escape'){ e.stopPropagation(); close(); row.querySelector('.as-pick-btn').focus(); } };
        p.onclick=e=>{ const l=e.target.closest('.as-lot'); if(!l) return; const x=lots.find(y=>y.key===l.dataset.key); s.ids=new Set(x.ps.map(o=>o.id)); s.save=false; hand(); paint(); close(); };
        p.onchange=e=>{ const x=e.target; if(x.classList.contains('as-save')) s.save=x.checked; else if(x.type==='checkbox'){ if(x.checked) s.ids.add(x.value); else s.ids.delete(x.value); hand(); } paint(); };
        p.querySelector('.as-ok').onclick=()=>{ close(); row.querySelector('.as-pick-btn').focus(); };
      }
      row.querySelector('.as-pick-btn').onclick=()=>{ if(row.querySelector('.as-panel')) close(); else open(); };
      row.querySelector('.as-clear').onclick=()=>{ s.ids.clear(); hand(); s.how=''; paint(); close(); };
      paint();
      return row;
    }
    // every line of the mail with what it was matched to and how ; nothing is filled before « Continuer »
    function assignDialog(rows, props, list, app){
      return new Promise(res=>{
        const all=pool(list, app), lots=lotsIn(all);
        const st=rows.map((r, i)=>({ i, name:r.name, q:'', ids:new Set(props[i].plants.map(o=>o.id)), how:props[i].how, extra:props[i].extra, group:props[i].group||null, save:!props[i].plants.length }));
        const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='assign-overlay';
        ov.innerHTML='<div class="modal-box wide fill-box" role="dialog" aria-labelledby="assign-title"><div class="opp-detail-head"><h3 id="assign-title">Vérifie les correspondances</h3></div>'
          +'<p class="modal-hint"></p><div class="as-rows"></div><div class="crm-form-actions"><button type="button" class="ghost-btn as-cancel">Annuler</button><button type="button" class="fill-go as-go">Continuer</button></div></div>';
        const box=ov.querySelector('.as-rows'), hint=ov.querySelector('.modal-hint');
        const paintAll=()=>{ const chk=st.filter(s=>s.ids.size && HOW[s.how] && HOW[s.how][0]==='chk').length, none=st.filter(s=>!s.ids.size).length;
          hint.textContent=rows.length+' ligne'+(rows.length>1?'s':'')+' dans le mail du pricing. Reconnues par leur code affaire : sûres. '+(chk ? chk+' proposée'+(chk>1?'s':'')+' d’après les noms (en orange) : vérifie-les. ' : '')+(none ? none+' sans correspondance : choisis, ou elle'+(none>1?'s seront ignorées':' sera ignorée')+'.' : ''); };
        st.forEach(s=>box.appendChild(assignRow(s, all, lots, paintAll)));
        const done=v=>{ ov.remove(); res(v); };
        ov.querySelector('.as-cancel').onclick=()=>done(null);
        ov.querySelector('.as-go').onclick=()=>{ const dec=[], keep=[];
          st.forEach(s=>{ const plants=all.filter(o=>s.ids.has(o.id)); dec[s.i]=plants.length ? { plants, extra:s.extra, group:s.group } : null;
            if(plants.length && s.how==='hand' && s.save) keep.push({ plants, name:lotOf(s.name) }); });
          done({ dec, lots:keep }); };
        ov.addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.stopPropagation(); done(null); } });
        document.body.appendChild(ov); ov.querySelector('.as-go').focus();
      });
    }
    // the pricing's changes : on a sheet, its own line ; elsewhere every line confirmed first, unless all found by business code
    async function pricingChangesAsk(text, list, from){
      const rows=pricingTables(text), props=rows.map(r=>propose(r, list, rows.length));
      if(list.length===1){ const dec=props.map(p=>p.plants.includes(list[0]) ? { plants:[list[0]], extra:p.extra } : null); return pricingChanges(text, list, from, dec).out; }
      if(props.every(p=>SURE.has(p.how))) return pricingChanges(text, list, from, props).out;
      const got=await assignDialog(rows, props, list, app); if(!got) return null;
      const out=pricingChanges(text, list, from, got.dec).out; out.lots=got.lots; return out;
    }
    async function fill(files, list){
      let got; try{ got=await readPipeFiles(files); }catch(e){ notify('Fichier illisible : '+(e&&e.message||e)); return; }
      const rows=await pricingChangesAsk(got.text, list, got.names.join(', ')); if(!rows) return;
      (got.installs||[]).forEach(inst=>{ const o=sheetFor(inst, list); if(o) rows.push(...changes(o, inst, got.names.join(', '))); });
      await apply(rows, got, list);
    }
    // the text of a mail pasted (the pricing's answer copied out of Outlook)
    async function fillText(text, list){ const rows=await pricingChangesAsk(text, list, 'texte collé'); if(rows) await apply(rows, { names:['le texte collé'], installs:[], text }, list); }
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
      const filled=[...new Set(ok.map(r=>r.o))];
      notify(filled.length>1 ? filled.length+' installations remplies ('+ok.length+' cases).' : ok.length+' case'+(ok.length>1?'s':'')+' remplie'+(ok.length>1?'s':'')+'.'); reopen(filled.map(o=>o.id));
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
