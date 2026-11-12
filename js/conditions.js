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
    ['c_remu', 'Remu_prod', 87, 'text'], ['c_puGo', 'Pu/Go', 90, 'number']
  ];
  const def=([k, label, col, type, opts, need], part)=>({ k, label, col, type, opts:opts||null, need:!!need, part });
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
    FIELDS.forEach(f=>{ const v=o[f.k]; if(v==null || String(v).trim()==='') return;
      out[f.col]=f.type==='number' ? h.numCell(v) : f.type==='date' ? h.looseDateCell(v) : String(v).trim(); });
    return out; };
  // a Suivi line read back : the same cells, as the sheet keeps them
  api.fromBdd=(vals, cellText)=>{ const out={};
    FIELDS.forEach(f=>{ const t=cellText(vals[f.col], f.type==='date'); if(t!=='') out[f.k]=t; });
    return out; };

  api.init=function(app){
    const { readPipeFiles, caractValue, caractSet, caractKey, PQ_FIELDS, pqFold, touchCrm, saveCrm, notify, reopen, escapeHtml }=app;
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
    async function fill(files, list){
      let got; try{ got=await readPipeFiles(files); }catch(e){ notify('Fichier illisible : '+(e&&e.message||e)); return; }
      const rows=[];
      (got.installs||[]).forEach(inst=>{ const o=sheetFor(inst, list); if(o) rows.push(...changes(o, inst, got.names.join(', '))); });
      if(!rows.length){ notify(got.installs && got.installs.length ? 'Rien de nouveau dans '+got.names.join(', ')+' pour cette fiche.' : 'Aucune centrale trouvée dans '+got.names.join(', ')+' (un Excel Caractéristiques Centrales ou du producteur, ou un mail qui en contient un).'); return; }
      const ok=await preview(rows, 'Remplir depuis « '+got.names.join(', ')+' »'); if(!ok || !ok.length) return;
      ok.forEach(r=>r.set(r.val));
      new Set(ok.map(r=>r.o)).forEach(o=>touchCrm(o)); await saveCrm();
      notify(ok.length+' case'+(ok.length>1?'s':'')+' remplie'+(ok.length>1?'s':'')+'.'); reopen();
    }
    // the zone at the top of a sheet ; the whole sheet takes a drop too
    function dropZone(list, host){
      const z=document.createElement('label'); z.className='fill-drop';
      z.innerHTML='<input type="file" multiple accept=".xlsx,.xlsm,.xls,.msg,.eml" hidden><b>Dépose un fichier ici pour remplir la fiche</b><span>Caractéristiques Centrales, Excel du producteur, mail (.msg, .eml) — ou clique pour le choisir. Tu valides avant que rien ne change.</span>';
      const inp=z.querySelector('input'); inp.onchange=()=>{ if(inp.files.length) fill([...inp.files], list); inp.value=''; };
      // the sheet's body stays the same element from one sheet to the next : listened to once, for the sheet now shown
      const target=host||z; target._fillList=list;
      if(!target.dataset.fillDrop){ target.dataset.fillDrop='1';
        const zone=()=>target.querySelector('.fill-drop');
        target.addEventListener('dragover', e=>{ if(e.dataTransfer && [...e.dataTransfer.types].includes('Files') && zone()){ e.preventDefault(); zone().classList.add('drag'); } });
        target.addEventListener('dragleave', e=>{ if(e.target===target && zone()) zone().classList.remove('drag'); });
        target.addEventListener('drop', e=>{ if(!e.dataTransfer || !e.dataTransfer.files.length || !zone()) return; e.preventDefault(); zone().classList.remove('drag'); fill([...e.dataTransfer.files], target._fillList); }); }
      return z;
    }
    Object.assign(api, { dropZone, fill, escapeHtml });
  };
  return api;
})();
