// Todo — readers with no screen (loaded before js/app.js): pricing-request fields and lists, French dates and numbers,
// signatures, mails (.eml/.msg), producers' Excel files → installations. Pure functions: no state of the app here.
// Split out of js/app.js (code audit, lot 2); js/app.js takes every name back from window.TodoParse.
window.TodoParse=(function(){
  const softFail=(where, e)=>{ try{ console.error('['+where+']', e); }catch(e2){} };   // same trace as the app's own softFail
  function toISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  const PQ_CHARGES=['PGU','EMC','QRY','MBA','TOR','SAM','SMA','JFO','LHD'];
  const PQ_ORIGINES=['Prospection','Contact direct','Crédit Agricole','BOAMP'];
  const PQ_ACTIONS=['Rendez-vous à prendre','A relancer','A rappeler','Appeler','En attente retour','A réévaluer'];
  const PQ_INSTALLS=['PV','Eolien','BIOGAZ','Hydro','PV et Eolien'];
  const PQ_CONTRATS=['AOS CRE','AO CRE CR','AO CRE','AO S21 CR','PPA Spot','Surplus ACC',"Sortie d'OA / CR",'A préciser'];
  const PQ_MARCHES=['AC','MD'];
  const PQ_NATURES=['Engageante','Non engageante'];
  const PQ_CAISSES=['Alpes Provence','Alsace Vosges','Anjou et Maine','Aquitaine','Atlantique Vendée','Brie Picardie','Centre-Est','Centre France','Centre Loire','Centre Ouest','Champagne-Bourgogne','Charente-Maritime Deux-Sèvres','Charente Périgord','Corse',"Côtes d'Armor",'Finistère','Franche-Comté','Guadeloupe','Ille-et-Vilaine','Languedoc','Loire Haute-Loire','Lorraine','Martinique-Guyane','Morbihan','Nord de France','Nord Est','Normandie','Normandie-Seine','Paris et Île-de-France','Provence Côte d\u2019Azur','Pyrénées Gascogne','Réunion','Savoie','Sud Méditerranée','Sud Rhône Alpes','Toulouse 31','Touraine Poitou','Val de France'];
  const PQ_CA_OPTIONS=['N/A','CAT&E'].concat(PQ_CAISSES.map(c=>'CR '+c));
  const PQ_REGIONS=['Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne','Centre-Val de Loire','Corse','Grand Est','Hauts-de-France','Ile-de-France','Normandie','Nouvelle-Aquitaine','Occitanie','Pays de la Loire',"Provence-Alpes-Côte d'Azur",'Guadeloupe','Martinique','Guyane','La Réunion','Mayotte'];
  const PQ_DEPTS=[['01','Ain',0],['02','Aisne',6],['03','Allier',0],['04','Alpes-de-Haute-Provence',12],['05','Hautes-Alpes',12],['06','Alpes-Maritimes',12],['07','Ardèche',0],['08','Ardennes',5],['09','Ariège',10],['10','Aube',5],['11','Aude',10],['12','Aveyron',10],['13','Bouches-du-Rhône',12],['14','Calvados',8],['15','Cantal',0],['16','Charente',9],['17','Charente-Maritime',9],['18','Cher',3],['19','Corrèze',9],['2A','Corse-du-Sud',4],['2B','Haute-Corse',4],['21',"Côte-d'Or",1],['22',"Côtes-d'Armor",2],['23','Creuse',9],['24','Dordogne',9],['25','Doubs',1],['26','Drôme',0],['27','Eure',8],['28','Eure-et-Loir',3],['29','Finistère',2],['30','Gard',10],['31','Haute-Garonne',10],['32','Gers',10],['33','Gironde',9],['34','Hérault',10],['35','Ille-et-Vilaine',2],['36','Indre',3],['37','Indre-et-Loire',3],['38','Isère',0],['39','Jura',1],['40','Landes',9],['41','Loir-et-Cher',3],['42','Loire',0],['43','Haute-Loire',0],['44','Loire-Atlantique',11],['45','Loiret',3],['46','Lot',10],['47','Lot-et-Garonne',9],['48','Lozère',10],['49','Maine-et-Loire',11],['50','Manche',8],['51','Marne',5],['52','Haute-Marne',5],['53','Mayenne',11],['54','Meurthe-et-Moselle',5],['55','Meuse',5],['56','Morbihan',2],['57','Moselle',5],['58','Nièvre',1],['59','Nord',6],['60','Oise',6],['61','Orne',8],['62','Pas-de-Calais',6],['63','Puy-de-Dôme',0],['64','Pyrénées-Atlantiques',9],['65','Hautes-Pyrénées',10],['66','Pyrénées-Orientales',10],['67','Bas-Rhin',5],['68','Haut-Rhin',5],['69','Rhône',0],['70','Haute-Saône',1],['71','Saône-et-Loire',1],['72','Sarthe',11],['73','Savoie',0],['74','Haute-Savoie',0],['75','Paris',7],['76','Seine-Maritime',8],['77','Seine-et-Marne',7],['78','Yvelines',7],['79','Deux-Sèvres',9],['80','Somme',6],['81','Tarn',10],['82','Tarn-et-Garonne',10],['83','Var',12],['84','Vaucluse',12],['85','Vendée',11],['86','Vienne',9],['87','Haute-Vienne',9],['88','Vosges',5],['89','Yonne',1],['90','Territoire de Belfort',1],['91','Essonne',7],['92','Hauts-de-Seine',7],['93','Seine-Saint-Denis',7],['94','Val-de-Marne',7],['95',"Val-d'Oise",7],['971','Guadeloupe',13],['972','Martinique',14],['973','Guyane',15],['974','La Réunion',16],['976','Mayotte',17]];
  const pqDeptLabel=d=>d[0].replace(/^0/,'')+' - '+d[1];
  const PQ_DEPT_OPTIONS=PQ_DEPTS.map(pqDeptLabel);
  const PQ_YIELD={ 'Hauts-de-France':950, 'Normandie':980, 'Ile-de-France':1000, 'Grand Est':1000, 'Bretagne':1050, 'Bourgogne-Franche-Comté':1080, 'Centre-Val de Loire':1100, 'Pays de la Loire':1100, 'Auvergne-Rhône-Alpes':1150, 'Nouvelle-Aquitaine':1200, 'Occitanie':1300, "Provence-Alpes-Côte d'Azur":1400, 'Corse':1400 };

  // Columns of the "Pipe agrégation" sheet, A → AK. sec 'centrale' = per installation, others shared by a producer's installations.
  const PQ_FIELDS=[
    { k:'annee', col:'A', label:'Année', type:'number', sec:'suivi' },
    { k:'new', col:'B', label:'New', type:'check', sec:'suivi' },
    { k:'charge', col:'C', label:"Chargé d'affaires", type:'select', opts:PQ_CHARGES, sec:'suivi', req:true },
    { k:'dateEntree', col:'D', label:'Date entrée pipe', type:'date', sec:'suivi' },
    { k:'origine', col:'E', label:'Origine du lead', type:'select', opts:PQ_ORIGINES, sec:'suivi' },
    { k:'ca', col:'F', label:'Crédit Agricole', type:'list', opts:PQ_CA_OPTIONS, sec:'suivi' },
    { k:'producteur', col:'G', label:'Nom Producteur', type:'text', sec:'prod', req:true },
    { k:'region', col:'H', label:'Région', type:'select', opts:PQ_REGIONS, sec:'centrale' },
    { k:'dept', col:'I', label:'Département', type:'list', opts:PQ_DEPT_OPTIONS, sec:'centrale' },
    { k:'marche', col:'J', label:'Type de marché', type:'select', opts:PQ_MARCHES, sec:'prod' },
    { k:'nom', col:'K', label:'Nom contact', type:'text', sec:'contact' },
    { k:'prenom', col:'L', label:'Prénom contact', type:'text', sec:'contact' },
    { k:'qualite', col:'M', label:'Qualité', type:'text', sec:'contact' },
    { k:'tel', col:'N', label:'Tel', type:'text', sec:'contact', req:true },
    { k:'mail', col:'O', label:'Mail', type:'text', sec:'contact', req:true },
    { k:'rdv1', col:'P', label:'RDV 1', type:'date', sec:'suite' },
    { k:'cr1', col:'Q', label:'CR', type:'check', sec:'suite' },
    { k:'rdv2', col:'R', label:'RDV 2', type:'date', sec:'suite' },
    { k:'cr2', col:'S', label:'CR2', type:'check', sec:'suite' },
    { k:'centrale', col:'T', label:'Nom Centrale', type:'text', sec:'centrale', req:true },
    { k:'install', col:'U', label:'Type installation', type:'select', opts:PQ_INSTALLS, sec:'centrale' },
    { k:'contrat', col:'V', label:'Type contrat', type:'select', opts:PQ_CONTRATS, sec:'centrale' },
    { k:'kwc', col:'W', label:'Puissance (kWc)', type:'number', sec:'centrale' },
    { k:'mwh', col:'X', label:'P50 (MWh/an)', type:'number', sec:'centrale' },
    { k:'mesPrev', col:'Y', label:'MES prévisionnelle', type:'text', sec:'centrale', ph:'jj/mm/aaaa ou « 2027 »' },
    { k:'mesEff', col:'Z', label:'MES effective', type:'text', sec:'centrale', ph:'jj/mm/aaaa' },
    { k:'debut', col:'AA', label:'Date début', type:'text', sec:'centrale', ph:'jj/mm/aaaa' },
    { k:'fin', col:'AB', label:'Date fin', type:'text', sec:'centrale', ph:'jj/mm/aaaa' },
    { k:'duree', col:'AC', label:'Durée (année)', type:'text', sec:'centrale' },
    { k:'particularites', col:'AD', label:'Particularités', type:'area', sec:'centrale', wide:true },
    { k:'stade', col:'AE', label:'Stade', type:'computed', sec:'none' },
    { k:'dateOffre', col:'AF', label:'Date remise 1ère offre', type:'date', sec:'suite' },
    { k:'nature', col:'AG', label:'Nature offre', type:'select', opts:PQ_NATURES, sec:'suite' },
    { k:'action', col:'AH', label:"Type d'action à réaliser", type:'select', opts:PQ_ACTIONS, sec:'suivi' },
    { k:'relance', col:'AI', label:'Date relance', type:'date', sec:'suivi' },
    { k:'commentaires', col:'AJ', label:'Commentaires', type:'area', sec:'comment', wide:true },
    { k:'qualification', col:'AK', label:'Qualification', type:'check', sec:'suite' }
  ];
  const PQ_SHARED_KEYS=PQ_FIELDS.filter(f=>f.sec!=='centrale' && f.sec!=='none').map(f=>f.k);
  // Plant details that are not Pipe columns but feed the BDD (Nom_prod, SIRET_prod, CP, P90) and the sheet
  const PQ_EXTRA_FIELDS=[
    { k:'spv', col:'BDD', label:'SPV (société de projet)', type:'text', sec:'centrale' },
    { k:'siret', col:'BDD', label:'SIRET', type:'text', sec:'centrale' },
    { k:'commune', col:'BDD', label:'Commune', type:'text', sec:'centrale' },
    { k:'cp', col:'BDD', label:'Code postal', type:'text', sec:'centrale' },
    { k:'p90', col:'BDD', label:'P90 (MWh)', type:'number', sec:'centrale' },
    { k:'productible', col:'BDD', label:'Productible (kWh/kWc)', type:'number', sec:'centrale' }
  ];
  const PQ_INST_GROUPS=[['Centrale',['centrale','install','contrat','spv','siret']], ['Lieu',['region','dept','commune','cp']],
    ['Production',['kwc','mwh','productible','p90']], ['Dates',['mesPrev','mesEff','debut','fin','duree']], ['',['particularites']]];
  const PQ_CENTRALE_KEYS=PQ_FIELDS.filter(f=>f.sec==='centrale').map(f=>f.k).concat(PQ_EXTRA_FIELDS.map(f=>f.k));

  const pqPad=n=>String(n).padStart(2,'0');
  const pqFold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pqTitleCase=s=>s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
  const pqIsoToFr=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); return m?m[3]+'/'+m[2]+'/'+m[1]:(s||''); };
  const pqAddDays=(n)=>{ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n); return toISO(d); };
  const PQ_MONTHS={ janvier:1, fevrier:2, mars:3, avril:4, mai:5, juin:6, juillet:7, aout:8, septembre:9, octobre:10, novembre:11, decembre:12 };
  const PQ_MONTH_LABEL={ janvier:'Janvier', fevrier:'Février', mars:'Mars', avril:'Avril', mai:'Mai', juin:'Juin', juillet:'Juillet', aout:'Août', septembre:'Septembre', octobre:'Octobre', novembre:'Novembre', decembre:'Décembre' };
  const PQ_MONTH_NAMES=['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];

  // ----- Mail parser (rules, runs locally: nothing leaves the browser) -----
  const PQ_EMAIL_RE=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const PQ_PHONE_RE=/(?:\+33\s?\(?0?\)?\s?|\b0)[1-9](?:[\s.\-]?\d{2}){4}\b/g;
  const pqIsCa=e=>{ const d=(e.split('@')[1]||'').toLowerCase(); return /^ca-|credit-?agricole|^ca\.|creditagricole/.test(d); };
  const PQ_CLOSINGS=/^(bien\s+)?(cordialement|à bientôt|a bientot|bien à vous|bien a vous|salutations|merci( d'avance| par avance| beaucoup)?|bonne (journée|journee|soirée|fin de journée)|best regards|regards|sincères salutations|je vous prie d.agr[ée]er|veuillez agr[ée]er|dans l.attente|--\s*$)/i;
  const PQ_HEADER=/^(de|from|à|a|to|cc|cci|envoyé|envoye|sent|date|objet|subject)\s*:/i;
  function pqFmtPhone(p){ let d=p.replace(/\D/g,''); if(d.startsWith('33')) d='0'+d.slice(2).replace(/^0/,''); return d.length===10?d.replace(/(\d{2})(?=\d)/g,'$1 ').trim():p.trim(); }
  // "9 800", "1.250 kWc" (thousands), "4,98 MWc", "2.5 MW" (decimal); "1.250 MWc" stays 1,25 MW
  const PQ_QTY='(?<![\\p{L}\\d.,])(\\d{1,3}(?:[ .]\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';
  function pqQty(s, unit){
    let t=String(s).replace(/\s/g,'');
    const big=/^(mw|mwc|gwh)$/i.test(unit||'');
    if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) && !(big && /^\d{1,3}\.\d{3}$/.test(t))) t=t.replace(/\./g,'');
    return parseFloat(t.replace(',','.'));
  }
  function pqNum(s){ return parseFloat(String(s).replace(/\s/g,'').replace(',','.')); }
  function pqCaisseFromText(s){
    const f=pqFold(s);
    if(/cat\s*&\s*e|transitions?\s*&?\s*energies/.test(f)) return 'CAT&E';
    let best=null;
    PQ_CAISSES.forEach(c=>{ const fc=pqFold(c).replace(/[^a-z0-9]/g,''); if(fc.length>3 && f.replace(/[^a-z0-9]/g,'').includes(fc) && (!best||fc.length>best.l)) best={c,l:fc.length}; });
    return best?'CR '+best.c:null;
  }
  function pqCaisseFromDomain(email){
    const slug=(email.split('@')[1]||'').toLowerCase().replace(/\.(fr|com|net)$/,'').replace(/^ca-/,'');
    const s=slug.replace(/[^a-z0-9]/g,'');
    if(!s || /credit|agricole/.test(s)) return null;
    let best=null;
    PQ_CAISSES.forEach(c=>{ const fc=pqFold(c).replace(/[^a-z0-9]/g,''); if(fc.includes(s)||s.includes(fc)){ if(!best||fc.length>best.l) best={c,l:fc.length}; } });
    return best?'CR '+best.c:'CR '+pqTitleCase(slug.replace(/-/g,' '));
  }
  function pqDeptFromPostal(cp){
    const n=parseInt(cp,10); if(!(n>=1000 && n<=98999)) return null;
    let code=cp.slice(0,2);
    if(code==='20') code=n<20200?'2A':'2B';
    if(code==='97'||code==='98') code=cp.slice(0,3);
    return PQ_DEPTS.find(d=>d[0]===code)||null;
  }
  function pqDeptFromText(s){
    const t=String(s||''); if(!t.trim()) return null;
    const cp=/\b((?:0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})\b/.exec(t); if(cp){ const d=pqDeptFromPostal(cp[1]); if(d) return d; }
    const code=/(?:^|\(|\s)(\d{2}|2A|2B|97\d)(?:\)|$)/.exec(t.trim()); if(code){ const d=PQ_DEPTS.find(x=>x[0]===code[1].padStart(2,'0')); if(d) return d; }
    const ft=pqFold(t);
    // hyphen last in the class: "[ '-]" (in "[ -']" it would be a range and "Seine-Maritime" would never match)
    return PQ_DEPTS.slice().sort((a,b)=>b[1].length-a[1].length).find(d=>new RegExp('(^|[^a-z])'+pqFold(d[1]).replace(/[-' ]/g,"[ '-]")+'([^a-z]|$)').test(ft))||null;
  }
  function pqParseDateLoose(s){
    s=pqFold(s);
    let m=/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s); if(m) return pqPad(m[1])+'/'+pqPad(m[2])+'/'+m[3];
    m=/(\d{4})-(\d{2})-(\d{2})/.exec(s); if(m) return m[3]+'/'+m[2]+'/'+m[1];
    m=/(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/.exec(s); if(m) return pqPad(m[1])+'/'+pqPad(PQ_MONTHS[m[2]])+'/'+m[3];
    m=/(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/.exec(s); if(m) return PQ_MONTH_LABEL[m[1]]+' '+m[2];
    // Excel's short form « juil-27 », « déc. 2027 », « sept-2028 »
    m=/\b(janv?|fevr?|mars|avr|mai|juin|juil|aout|sept?|oct|nov|dec)\.?[\s-]+(\d{2}|\d{4})\b/.exec(s);
    if(m){ const k={ jan:'janvier', janv:'janvier', fev:'fevrier', fevr:'fevrier', mars:'mars', avr:'avril', mai:'mai', juin:'juin', juil:'juillet', aout:'aout', sep:'septembre', sept:'septembre', oct:'octobre', nov:'novembre', dec:'decembre' }[m[1]];
      if(k) return PQ_MONTH_LABEL[k]+' '+(m[2].length===2?'20'+m[2]:m[2]); }
    m=/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/.exec(s); if(m) return Object.values(PQ_MONTH_LABEL)[['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(m[1])]+' '+m[2];
    m=/\bq([1-4])\s+(\d{4})/.exec(s); if(m) return 'T'+m[1]+' '+m[2];
    m=/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/.exec(s); if(m) return PQ_MONTH_LABEL[Object.keys(PQ_MONTHS)[parseInt(m[1],10)-1]]+' '+m[2];
    m=/\b(t[1-4]|[1-4](?:er|e|eme|ème)\s+trimestre)\s+(\d{4})/.exec(s); if(m){ const q=parseInt(m[1].replace(/\D/g,''),10); return 'T'+q+' '+m[2]; }
    m=/(ete|printemps|automne|hiver|debut|fin|courant)\s+(\d{4})/.exec(s); if(m) return m[0].replace(/^ete/,'été').replace(/^debut/,'début');
    m=/\b(20\d{2})\b/.exec(s); if(m) return m[1];
    return null;
  }
  // Excel serial date or JS Date → dd/mm/yyyy
  // A date read from Excel (SheetJS, cellDates) is built from a winter date plus a number of days: a summer date comes out
  // at 23:00 the day before (and very old ones a few minutes off). Back to the right calendar day.
  function xlDay(v){ const d=new Date(v.getTime()); if(d.getHours()>=22) d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d; }
  function pqCellDate(v){
    if(v instanceof Date && !isNaN(v)){ v=xlDay(v); return pqPad(v.getDate())+'/'+pqPad(v.getMonth()+1)+'/'+v.getFullYear(); }
    if(typeof v==='number' && v>20000 && v<80000){ const d=new Date(Math.round((v-25569)*86400000)); return pqPad(d.getUTCDate())+'/'+pqPad(d.getUTCMonth()+1)+'/'+d.getUTCFullYear(); }
    return pqParseDateLoose(String(v));
  }

  // Relays forward a lead without being the prospect: Crédit Agricole and colleagues (own domain).
  const PQ_INTERNAL_DOMAINS=['selfee.fr'];
  const pqIsInternal=e=>PQ_INTERNAL_DOMAINS.includes((e.split('@')[1]||'').toLowerCase());
  const pqIsRelay=e=>pqIsCa(e)||pqIsInternal(e);
  const PQ_GENERIC_DOMAINS=/^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|orange|wanadoo|free|sfr|laposte|neuf|icloud|me|aol|bbox|numericable|proton|protonmail)\./;
  // words that make a capitalised pair look like a name but are not people
  const PQ_NOT_NAME=/\b(cr[eé]dit|agricole|[eé]nergies?|solaire|syndicat|centrale|soci[eé]t[eé]|commune|mairie|parc|ville|groupe|service|transitions?|madame|monsieur|bonjour|cordialement|objet|projet|sas|sarl|earl|gaec|scea)\b/i;
  const PQ_FORM='SAS|SASU|SARL|EURL|EARL|GAEC|SCEA|SCI|SEM|SEML|SCIC|SPL|SA|SNC|GIE|SICA|CUMA';

  function pqSplitName(raw){
    let n=raw.trim().replace(/^(m\.|mme|mlle|monsieur|madame)\s+/i,'');
    const parts=n.split(/\s+/);
    // "DURAND Pierre": the all-caps word is the surname; otherwise the first word is the first name
    let fi=0; if(parts.length>1 && parts[0]===parts[0].toUpperCase() && parts[0].length>1 && parts[1]!==parts[1].toUpperCase()) fi=parts.length-1;
    return { prenom:pqTitleCase(fi===0?parts[0]:parts[parts.length-1]), nom:(fi===0?parts.slice(1).join(' '):parts.slice(0,-1).join(' ')).toUpperCase() };
  }
  // "l'EARL Bastide", "la société VENTS DU NORD SAS", "SARL SOLEIL D'OC" inside a sentence
  function pqCompanyInText(s){
    // names never run onto the next line (spaces/tabs only between words)
    const W="[A-Z0-9ÉÈÀÂÎÔÛÇ][\\p{L}0-9'’&.-]*";
    let m=new RegExp('\\b('+PQ_FORM+')[ \\t]+('+W+'(?:[ \\t]+(?:(?:des|du|de|les|la|le)(?=[ \\t])|'+W+')){0,4})','u').exec(s);
    if(m){ const name=(m[1]+' '+m[2]).replace(/\s+(du|de|des|la|le|les)$/i,'').replace(/[.,;:]+$/,''); return name.toUpperCase(); }
    m=new RegExp("((?:[A-Z0-9ÉÈÀÂÎÔÛÇ][A-Z0-9ÉÈÀÂÎÔÛÇ'’&.-]+[ \\t]+){1,4})("+PQ_FORM+')\\b','u').exec(s);
    if(m) return (m[1]+m[2]).trim().toUpperCase();
    return null;
  }

  // ---------- Signature reader, shared by Contacts (« Coller une signature ») and the mail reader ----------
  // Works line by line, each line cut into parts on " | ", " – ", ", "; every part is classified as phone, mail,
  // web, address, name, role or company. The mail address helps: its local part names the person
  // (jean.dupont@ → Jean DUPONT) and its domain names the company (solairedumidi.fr → Solaire du Midi).
  const SIG_JUNK=/^\[cid:|^<image|^\[image|^image\d|envoy[ée] (de|depuis) mon|sent from my|get outlook|obtenir outlook|t[ée]l[ée]charger outlook|^[-—–_=*•·~]+$/i;
  const SIG_DISCLAIMER=/confidentiel|destinataires?\b|pi[eè]ces? jointes?|pensez [àa] l.environnement|avant d.imprimer|this (e-?mail|message)|intended (solely|only)|disclaimer|n.imprimez/i;
  const SIG_PHONE_LABEL=/^(t[ée]l[ée]?(?:phone)?|tel|t|fixe|ligne directe|direct|standard|bureau|office|mob(?:ile)?|port(?:able)?|gsm|m|cell(?:ular)?|fax|f)\s*\.?\s*:?\s*/i;
  const SIG_MAIL_LABEL=/^(e-?mail|courriel|mail|e)\s*\.?\s*:?\s*/i;
  const SIG_ROLE=/\b(directeur|directrice|director|g[ée]rante?|pr[ée]sidente?|president|responsable|charg[ée]e?|ing[ée]nieure?|engineer|associ[ée]e?|partner|dirigeante?|fondat(?:eur|rice)|founder|co-?fondat\p{L}*|ceo|cfo|coo|cto|dg|daf|dsi|vp|maire|adjointe?|manager|asset|chef|head|d[ée]l[ée]gu[ée]e?|exploitante?|agricult(?:eur|rice)|technicien(?:ne)?|acheteu(?:r|se)|secr[ée]taire|assistante?|comptable|conseill[eè]re?|consultante?|coordinat(?:eur|rice)|analyste?|analyst|officer|commerciale?|attach[ée]e?|juriste|avocate?|administrat(?:eur|rice)|gestionnaire|business developer|account)\b/iu;
  const SIG_PUBLIC=/\b(mairie|commune|communaut[eé]|syndicat|r[ée]gie|d[ée]partement|conseil (r[ée]gional|d[ée]partemental)|m[ée]tropole|agglom[ée]ration|ville de|sem\b|spl\b)/i;
  const SIG_ADDRESS=/\b\d{5}\b|\b(rue|avenue|av\.|bd|boulevard|chemin|route|place|all[ée]e|impasse|quai|cours|za|zi|zac|bp|cs|lieu-dit|lieudit|parc d.activit[ée]s)\b/i;
  const SIG_WEB=/https?:\/\/|www\.|linkedin|\b[a-z0-9-]+\.(fr|com|eu|net|org|bzh|re|io)\b(?!@)/i;
  const SIG_PARTICLES=/^(de|du|des|la|le|les|d'|van|von|da|di|del)$/i;

  function sigNameWords(s){
    const t=s.replace(/^(m\.|mr\.?|mme|mlle|monsieur|madame)\s+/i,'').trim();
    const w=t.split(/\s+/);
    if(w.length<2 || w.length>5) return null;
    // each word: a capitalised or all-caps word, or a particle (de, La, Le…) inside the name
    const capsWord=x=>x.length>1 && x===x.toUpperCase() && /\p{L}/u.test(x);
    // "BERTRAND julien": a lowercase first name is accepted next to an all-caps surname
    const lowerOk=w.length===2 && w.some(capsWord) && w.some(x=>/^[a-zéèàâîôûç][\p{L}'’-]+$/u.test(x));
    if(!lowerOk && !w.every((x,i)=>/^[A-ZÉÈÀÂÎÔÛÇ][\p{L}'’-]*$/u.test(x) || (i>0 && SIG_PARTICLES.test(x)))) return null;
    if(w.filter(x=>!SIG_PARTICLES.test(x)).length<2 && !SIG_PARTICLES.test(w[1])) return null;
    return w;
  }
  function sigLocalTokens(mail){
    if(!mail) return [];
    const whole=pqFold(mail.split('@')[0]).split(/[._]+/).filter(Boolean);
    return whole.concat(...whole.filter(t=>t.includes('-')).map(t=>t.split('-')));
  }
  function sigDomainStem(mail){ if(!mail) return ''; const d=(mail.split('@')[1]||'').toLowerCase(); if(PQ_GENERIC_DOMAINS.test(d)) return ''; return pqFold(d.replace(/\.[a-z]{2,4}$/,'')).replace(/[^a-z0-9]/g,''); }
  // How much a part looks like the person's name (0 = not a name)
  function sigNameScore(part, tokens, stem){
    const w=sigNameWords(part); if(!w) return 0;
    const f=pqFold(part);
    if(stem && f.replace(/[^a-z0-9]/g,'')===stem) return 0;
    if(SIG_ROLE.test(part) || SIG_PUBLIC.test(part) || new RegExp('\\b('+PQ_FORM+')\\b').test(part) || /\b(energie|energies|solaire|solar|capital|groupe|group|eolien|hydro|metha|soleil|vents?|centrale|parc|sas|sarl)\b/.test(f)) return 0;
    let score=1;
    const words=w.map(x=>pqFold(x).replace(/[^a-z]/g,'')).filter(Boolean);
    const joined=tokens.join('');
    if(tokens.length && words.some(x=>x.length>2 && (tokens.includes(x) || joined.includes(x)))) score+=3;
    if(/[a-zé]/.test(part)) score+=1;   // mixed case looks more like a person than an all-caps company
    return score;
  }
  function sigSplitName(part, tokens){
    const w=sigNameWords(part);
    const caps=w.map(x=>x.length>1 && x===x.toUpperCase());
    let first=[], last=[];
    if(caps.some(Boolean) && !caps.every(Boolean)){
      // "Jean DUPONT" / "DURAND Pierre": the all-caps words are the surname
      w.forEach((x,i)=>{ (caps[i] || (SIG_PARTICLES.test(x) && i>0 && caps[i+1]))?last.push(x):first.push(x); });
    } else {
      // all caps or all capitalised: the mail says which word is the surname, else the first word is the first name
      // surname = the word matching the last block of the address (anne-sophie.leclerc → leclerc)
      const lastTok=tokens.length?tokens.filter(t=>!t.includes('-'))[tokens.filter(t=>!t.includes('-')).length-1]:'';
      const blocks=tokens.filter(t=>!tokens.some(u=>u!==t && u.includes('-') && u.split('-').includes(t)));
      const surname=blocks.length>1?blocks[blocks.length-1]:lastTok;
      const li=surname?w.findIndex((x,i)=>i>0 && pqFold(x).replace(/[^a-z]/g,'')===surname):-1;
      const fi=tokens.length?w.findIndex(x=>{ const fx=pqFold(x).replace(/[^a-z-]/g,''); return tokens[0]===fx || (tokens[0]===fx[0] && tokens.length>1) || tokens[0]===fx.split('-').map(y=>y[0]).join(''); }):-1;
      if(li>0){ first=w.slice(0,li); last=w.slice(li); }
      else if(fi>0){ first=w.slice(fi); last=w.slice(0,fi); }
      else { first=[w[0]]; last=w.slice(1); }
    }
    return { prenom:first.map(x=>x.split('-').map(y=>y.charAt(0).toUpperCase()+y.slice(1).toLowerCase()).join('-')).join(' '), nom:last.join(' ').toUpperCase() };
  }
  function sigPhones(line){
    const out=[]; const re=new RegExp(PQ_PHONE_RE.source,'g'); let m;
    while((m=re.exec(line))){ out.push({ num:pqFmtPhone(m[0]), at:m.index }); }
    return out;
  }
  function parseSignatureBlock(text, hint){
    hint=hint||{};
    const res={ prenom:'', nom:'', qualite:'', societe:'', mail:'', tel:'', tel2:'', adresse:'', site:'' };
    let lines=String(text||'').replace(/\r/g,'').replace(/ /g,' ').split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
    lines=lines.filter(l=>!SIG_JUNK.test(l) && !(SIG_DISCLAIMER.test(l) && l.split(' ').length>8) && !PQ_CLOSINGS.test(l));
    const mails=[...new Set(lines.join('\n').match(PQ_EMAIL_RE)||[])].map(e=>e.toLowerCase());
    res.mail=hint.mail || mails.find(e=>!pqIsRelay(e)) || mails[0] || '';
    const tokens=sigLocalTokens(res.mail), stem=sigDomainStem(res.mail);
    // phones, ranked: mobile (06/07 or labelled mobile) > direct line > other > switchboard
    const phones=[];
    lines.forEach(l=>{
      const segs=l.split(/\s+[-–|·]\s+|\s{2,}|;\s*/);
      segs.forEach(seg=>{
        sigPhones(seg).forEach(p=>{
          const lab=pqFold(seg.slice(0,p.at));
          let rank=/^0[67]/.test(p.num)?0:2;
          if(/mob|port|gsm|cell|\bm\b/.test(lab)) rank=0; else if(/direct/.test(lab)) rank=1; else if(/standard|fax|\bf\b/.test(lab)) rank=/fax|\bf\b/.test(lab)?9:3;
          if(rank<9 && !phones.some(x=>x.num===p.num)) phones.push({ num:p.num, rank, order:phones.length });
        });
      });
    });
    phones.sort((a,b)=>a.rank-b.rank || a.order-b.order);
    if(phones[0]) res.tel=phones[0].num;
    if(phones[1]) res.tel2=phones[1].num;
    // classify the remaining parts
    const parts=[];
    lines.forEach((l,li)=>{
      l.split(/\s+[-–|·•]\s+|,\s+|\s\|\s?|\|/).map(p=>p.trim()).filter(Boolean).forEach(p=>parts.push({ p, li }));
    });
    const names=[], roles=[], companies=[];
    parts.forEach(({p,li})=>{
      if(new RegExp(PQ_EMAIL_RE.source).test(p) || SIG_MAIL_LABEL.test(p) && new RegExp(PQ_EMAIL_RE.source).test(p)) return;
      if(sigPhones(p).length || (SIG_PHONE_LABEL.test(p) && /\d{2}/.test(p) && !/[a-z]{4,}/i.test(p.replace(SIG_PHONE_LABEL,'')))) return;
      if(SIG_WEB.test(p)){ if(!res.site && !/linkedin/i.test(p)) res.site=p.replace(/^(web|site(?: web)?|w)\s*:?\s*/i,''); return; }
      if(SIG_ADDRESS.test(p) && !SIG_ROLE.test(p)){ res.adresse=(res.adresse?res.adresse+', ':'')+p; return; }
      if(p.split(' ').length>9) return;
      const ns=sigNameScore(p, tokens, stem);
      if(ns){ names.push({ p, li, score:ns }); return; }
      // "Gérant BREIZH SOLAR": a role followed by an all-caps company
      const rc=new RegExp('^(.{3,40}?)\\s+((?:[A-Z0-9ÉÈÀÂÎÔÛÇ][A-Z0-9ÉÈÀÂÎÔÛÇ\'’&.-]+\\s*){1,5})$','u').exec(p);
      if(rc && SIG_ROLE.test(rc[1]) && !SIG_ROLE.test(rc[2]) && !/^(g[ée]n[ée]ral|technique|commercial|financier|adjoint|d[ée]l[ée]gu[ée]|administratif|op[ée]rationnel|marketing|juridique|rh)$/i.test(rc[2].trim())){ roles.push({ p:rc[1], li }); companies.push({ p:rc[2].trim(), li, score:3 }); return; }
      const f=pqFold(p).replace(/[^a-z0-9]/g,'');
      const isLegal=new RegExp('\\b('+PQ_FORM+')\\b').test(p)||/cr[ée]dit agricole|caisse r[ée]gionale|caisse d.[ée]pargne|banque populaire|soci[ée]t[ée] g[ée]n[ée]rale|bnp/i.test(p), isPublic=SIG_PUBLIC.test(p);
      const letters=p.replace(/[^\p{L}]/gu,''), allCaps=letters.length>=4 && letters===letters.toUpperCase();
      const domainHit=stem && f.length>=4 && (f===stem || stem.includes(f) || f.includes(stem));
      const isRole=SIG_ROLE.test(p) && !isLegal && !(isPublic && /^(mairie|commune|syndicat|communaut)/i.test(p));
      if(isRole && !domainHit){ roles.push({ p, li }); return; }
      if(isLegal || isPublic || domainHit || allCaps){
        let score=(isLegal?4:0)+(domainHit?4:0)+(isPublic?3:0)+(allCaps?1:0);
        if(/^groupe?\b/i.test(p)) score-=3;
        companies.push({ p, li, score });
      }
    });
    if(names.length){
      names.sort((a,b)=>b.score-a.score || a.li-b.li);
      const n=sigSplitName(names[0].p, tokens); res.prenom=n.prenom; res.nom=n.nom;
    }
    if(roles.length) res.qualite=roles[0].p.replace(/\s*[-–|,:]\s*$/,'');
    if(companies.length){ companies.sort((a,b)=>b.score-a.score || a.li-b.li); res.societe=companies[0].p; }
    return res;
  }

  // Everyone of a document: each sender of a mail thread with their signature, people in To/Cc, the signature of a
  // pasted reply. Colleagues and bank relays are left out. Merged by address; senders first.
  function pqSplitDisplayName(s){
    const t=String(s||'').replace(/["'\[\]()]/g,' ').replace(PQ_CIVILITY,'').replace(/\s+/g,' ').trim();
    if(!t || /@/.test(t) || PQ_NOT_NAME.test(t)) return null;
    const w=t.split(' '); if(w.length<2 || w.length>4) return null;
    const caps=x=>x.length>1 && x===x.toUpperCase() && /[A-Z]/.test(pqFold(x).toUpperCase());
    if(caps(w[0]) && !caps(w[w.length-1])) return { prenom:pqTitleCase(w.slice(1).join(' ')), nom:w[0].toUpperCase() };
    return { prenom:pqTitleCase(w.slice(0,-1).join(' ')), nom:w[w.length-1].toUpperCase() };
  }
  const PQ_ROBOT=/^(no-?reply|ne-?pas-?repondre|notification|mailer-daemon|postmaster)@/i;
  function pqDetectPeople(raw){
    const text=String(raw||'').replace(/\r/g,'').replace(/\u00a0/g,' ').replace(/<(mailto|tel):[^>]*>/gi,'').replace(/^[ \t]*(>[ \t]?)+/gm,'');
    const lines=text.split('\n').map(l=>l.trim()); if(!text.trim()) return [];
    const blocks=[]; let cur={ from:null, lines:[], to:[] };
    lines.forEach(l=>{
      const m=/^(de|from)\s*:\s*(.*)$/i.exec(l)||/^(le|on)\s.{6,120}?(<?[\w.+-]+@[\w.-]+>?).{0,40}(a [ée]crit|wrote)\s*:?\s*$/i.exec(l);
      if(m){ if(cur.lines.length||cur.from) blocks.push(cur); cur={ from:/^(de|from)$/i.test(m[1])?m[2]:l, lines:[], to:[] }; return; }
      const r=/^(à|a|to|cc|cci|bcc)\s*:\s*(.+)$/i.exec(l); if(r){ cur.to.push(r[2]); return; }
      cur.lines.push(l);
    });
    blocks.push(cur);
    const people=new Map();
    const ok=mail=>mail && !pqIsRelay(mail) && !PQ_ROBOT.test(mail);
    const add=(p, sender)=>{
      const mail=(p.mail||'').toLowerCase(); if(mail && !ok(mail)) return;
      if(!mail && !(p.prenom && p.nom)) return;
      const key=mail||pqFold(p.prenom+' '+p.nom), was=people.get(key)||{ prenom:'', nom:'', qualite:'', tel:'', tel2:'', mail, sender:false };
      ['prenom','nom','qualite','tel','tel2'].forEach(k=>{ if(!was[k] && p[k]) was[k]=p[k]; });
      was.sender=was.sender||sender; people.set(key, was);
    };
    blocks.forEach((b,bi)=>{
      const email=(((b.from||'').match(PQ_EMAIL_RE)||[])[0]||'').toLowerCase();
      const body=b.lines.filter(l=>l && !PQ_HEADER.test(l));
      let sigStart=-1; body.forEach((l,i)=>{ if(PQ_CLOSINGS.test(l)) sigStart=i; });
      const sigLines=(sigStart>=0?body.slice(sigStart+1):body.slice(-8)).filter(l=>!/message d.origine|original message|forwarded message/i.test(l)).slice(0,10);
      const sig=sigLines.length?parseSignatureBlock(sigLines.join('\n'), email?{ mail:email }:{}):{};
      const sigMail=(sig.mail||'').toLowerCase();
      if(email && ok(email)){
        const dn=pqSplitDisplayName((b.from||'').replace(/<.*?>/,'').replace(PQ_EMAIL_RE,''));
        const sigIsHim=!sigMail || sigMail===email;
        add({ prenom:(sigIsHim&&sig.prenom)||(dn&&dn.prenom)||'', nom:(sigIsHim&&sig.nom)||(dn&&dn.nom)||'', qualite:sigIsHim?sig.qualite:'', tel:sigIsHim?sig.tel:'', tel2:sigIsHim?sig.tel2:'', mail:email }, true);
      } else if(!b.from && bi===0 && sigMail && ok(sigMail) && (sig.prenom||sig.nom)){
        add({ prenom:sig.prenom, nom:sig.nom, qualite:sig.qualite, tel:sig.tel, tel2:sig.tel2, mail:sigMail }, true);   // a reply pasted without its header
      }
      b.to.forEach(list=>list.split(/[;,](?![^<]*>)/).forEach(part=>{
        const mail=((part.match(PQ_EMAIL_RE)||[])[0]||'').toLowerCase(); if(!mail) return;
        const dn=pqSplitDisplayName(part.replace(/<.*?>/,'').replace(PQ_EMAIL_RE,''));
        add({ prenom:dn?dn.prenom:'', nom:dn?dn.nom:'', mail }, false);
      }));
    });
    return [...people.values()].sort((a,b)=>(b.sender?1:0)-(a.sender?1:0));
  }
  // A pricing-request mail read into the request form's fields. Split in steps (code audit C2: it was one function of
  // complexity 146); each step reads and fills the same reading `c` (c.out holds the fields), in the original order.
  function parsePipeMail(raw){
    const c=mailSplit(raw);
    if(!c) return {};
    mailOrigin(c); mailContact(c); mailProducer(c); mailLocation(c); mailTech(c); mailFigures(c); mailPlantName(c); mailNotes(c);
    return c.out;
  }
  // clean-up, the thread cut into messages, the prospect's message, the subject
  function mailSplit(raw){
    // "<mailto:…>" / "<tel:…>" copies left by Outlook, "> " quote marks of plain-text replies
    let text=String(raw||'').replace(/\r/g,'').replace(/ /g,' ').replace(/<(mailto|tel):[^>]*>/gi,'').replace(/^[ \t]*(>[ \t]?)+/gm,'');
    // English mail: "12,400 MWh" is twelve thousand four hundred
    const english=(text.match(/\b(the|our|and|is|with|we|hi|best regards|please|plant)\b/gi)||[]).length>=4;
    if(english) text=text.replace(/(\d),(\d{3})(?![\d,])/g,'$1$2');
    const lines=text.split('\n').map(l=>l.trim());
    if(!text.trim()) return null;
    const all=[...new Set((text.match(PQ_EMAIL_RE)||[]).map(e=>e.toLowerCase()))];
    const blocks=mailThread(lines), prospect=mailProspect(blocks);
    const body=prospect?prospect.lines.filter(l=>!PQ_HEADER.test(l)):lines.filter(l=>!PQ_HEADER.test(l));
    const subj=lines.map(l=>/^(objet|subject)\s*:\s*(.*)$/i.exec(l)).filter(Boolean).map(m=>m[2].replace(/^((tr|fw|fwd|re)\s*:\s*)+/i,'').trim()).filter(Boolean);
    return { out:{}, text, lines, all, caEmails:all.filter(pqIsCa), blocks, prospect, body, bodyText:body.join('\n'), subject:subj[subj.length-1]||subj[0]||'',
      caPerson:null, inlineLine:null, company:null, city:null, scope:'', ft:'' };
  }
  // a forward chain cut at each "De :"/"From:" header, or "Le jeu. 9 oct. 2026 à 11:02, X <x@y> a écrit :"
  function mailThread(lines){
    const blocks=[]; let cur={ from:null, lines:[] };
    lines.forEach(l=>{
      const m=/^(de|from)\s*:\s*(.*)$/i.exec(l)||/^(le|on)\s.{6,120}?(<?[\w.+-]+@[\w.-]+>?).{0,40}(a [ée]crit|wrote)\s*:?\s*$/i.exec(l);
      if(m){ if(cur.lines.length||cur.from) blocks.push(cur); cur={ from:/^(de|from)$/i.test(m[1])?m[2]:l, lines:[] }; } else cur.lines.push(l);
    });
    blocks.push(cur);
    blocks.forEach(b=>{ b.email=((b.from||'').match(PQ_EMAIL_RE)||[])[0]||null; b.relay=b.email?pqIsRelay(b.email):false; });
    return blocks;
  }
  // the prospect's message: the latest one whose sender is not a relay (us, the bank)
  function mailProspect(blocks){
    let prospect=blocks.slice().reverse().find(b=>b.from && b.email && !b.relay)||null;
    // a reply to us (or to the bank) pasted without its own header: the top message is the prospect's
    if(!prospect && blocks.length>1 && !blocks[0].from && blocks.slice(1).every(b=>b.relay)) prospect=blocks[0];
    if(!prospect){ const b=blocks[blocks.length-1]; prospect=(b.relay||(!b.from && blocks.some(x=>x.relay)))?null:b; }
    return prospect;
  }
  // the Crédit Agricole caisse: from the bank's address, or named in the text (CAT&E wins)
  function mailCaisse(text, caEmails, mentionsCa){
    let caisse=null;
    caEmails.forEach(e=>{ caisse=caisse||pqCaisseFromDomain(e); });
    const caText=(caEmails.length||mentionsCa)?pqCaisseFromText(text):null;
    return caText==='CAT&E' || (!caisse && caText)?caText:caisse;
  }
  // origin & Crédit Agricole caisse (a caisse name alone, e.g. "Morbihan", is not enough), and who at the bank sent it
  function mailOrigin(c){
    const { out, text, lines, caEmails, blocks, prospect }=c;
    const mentionsCa=/cr[eé]dit\s+agricole|\bca\s+(transitions|t&e)|cat\s*&\s*e/i.test(text);
    const caisse=mailCaisse(text, caEmails, mentionsCa);
    if(caEmails.length || caisse || (mentionsCa && !prospect)){ out.origine='Crédit Agricole'; out.ca=caisse||'N/A'; }
    else if(/boamp/i.test(text)){ out.origine='BOAMP'; out.ca='N/A'; }
    else { out.origine='Contact direct'; out.ca='N/A'; }
    if(caEmails.length) c.caPerson=mailBankPerson(lines, blocks, caEmails[0]);
  }
  // the bank adviser: a « Prénom Nom » line just above their address, else the name of the bank's message sender
  function mailBankPerson(lines, blocks, caEmail){
    const idx=lines.findIndex(l=>l.toLowerCase().includes(caEmail));
    for(let i=idx-1;i>=Math.max(0,idx-5);i--){ const l=lines[i]; if(/^[A-ZÉÈ][a-zéèëêïîôç-]+(\s+[A-ZÉÈ][\wéèëêïîôç'-]+){1,2}$/.test(l)) return l; }
    const hb=blocks.find(b=>b.relay && pqIsCa(b.email||''));
    return hb?((hb.from||'').replace(/<.*?>/,'').replace(/["']/g,'').trim()||null):null;
  }
  // the prospect: address, phones, then name, role and company from the signature (or, in a relay mail, the line quoting them)
  function mailContact(c){
    const { out, lines, all, prospect, bodyText }=c;
    // the prospect's own address: sender of its block, else an address quoted in the body by the relay
    const nonRelay=all.filter(e=>!pqIsRelay(e));
    if(prospect && prospect.email && !pqIsRelay(prospect.email)) out.mail=prospect.email.toLowerCase();
    else if(nonRelay.length){ out.mail=nonRelay[0]; c.inlineLine=lines.find(l=>l.toLowerCase().includes(nonRelay[0]))||null; }
    if(!out.mail) delete out.mail;
    const inlineLine=c.inlineLine;
    // phones: on the line that quotes the prospect first, then in the prospect's part
    const phoneSrc=(inlineLine&&new RegExp(PQ_PHONE_RE.source).test(inlineLine)?inlineLine+'\n':'')+bodyText;
    const phones=[...new Set((phoneSrc.match(PQ_PHONE_RE)||[]).map(pqFmtPhone))];
    if(phones.length) out.tel=phones.slice(0,2).join(' / ');
    const who=prospect?mailSignature(c):{ name:inlineLine?mailRelayName(lines, inlineLine, out.mail):null, role:null };
    if(who.name){ const n=pqSplitName(who.name); out.prenom=n.prenom; out.nom=n.nom; }
    if(who.role) out.qualite=who.role.replace(/\s*[-–|,]\s*$/,'');
  }
  // the prospect's signature: lines after the last closing formula; each line may hold "Name – Role, COMPANY, phone"
  function mailSignature(c){
    const { out, prospect, body }=c;
    let sigStart=-1;
    body.forEach((l,i)=>{ if(PQ_CLOSINGS.test(l)) sigStart=i; });
    const sigLines=(sigStart>=0?body.slice(sigStart+1):body.slice(-8)).filter(l=>l && !/message d.origine|original message|forwarded message/i.test(l)).slice(0,10);
    const sig=parseSignatureBlock(sigLines.join('\n'), { mail:out.mail });
    let name=(sig.prenom||sig.nom)?[sig.prenom, sig.nom].filter(Boolean).join(' '):null;
    if(sig.societe) c.company=sig.societe;
    // the signature's phones, mobile first, win over numbers quoted elsewhere in the mail
    if(sig.tel) out.tel=[sig.tel, sig.tel2].filter(Boolean).join(' / ');
    if(!name && prospect.from){ const dn=prospect.from.replace(/<.*?>/,'').replace(PQ_EMAIL_RE,'').replace(/["'\[\]]/g,'').trim(), w=dn.split(/\s+/).length; if(dn && w>=2 && w<=4 && !PQ_NOT_NAME.test(dn)) name=dn; }
    return { name, role:sig.qualite||null };
  }
  // relay mail: "M. Hugo Lefebvre, hugo@…, 06…" — the name closest before the address, or a few lines above after a civility
  function mailRelayName(lines, inlineLine, mail){
    const before=inlineLine.slice(0, inlineLine.toLowerCase().indexOf(mail));
    const re=/(?:(?:M\.|Mme|Monsieur|Madame)\s+)?([A-ZÉÈÀÂÎÔ][\p{L}'’-]+)\s+([A-ZÉÈÀÂÎÔ][\p{L}'’-]+)/gu;
    let m, best=null;
    while((m=re.exec(before))){ if(!PQ_NOT_NAME.test(m[0]) && /[a-zé]/.test(m[0])) best=m[1]+' '+m[2]; }
    if(!best){
      // "M. Olivier Mercier, gérant de …"
      const li=lines.indexOf(inlineLine);
      for(let i=li-1;i>=Math.max(0,li-3) && !best;i--){ const cv=/(?:M\.|Mme|Monsieur|Madame)\s+([A-ZÉÈÀÂÎÔ][\p{L}'’-]+)\s+([A-ZÉÈÀÂÎÔ][\p{L}'’-]+)/u.exec(lines[i]); if(cv) best=cv[1]+' '+cv[2]; }
    }
    return best;
  }
  // the text the figures are read in (the prospect's message, then the producer side's other messages), and the producer
  function mailProducer(c){
    const { out, text, lines, blocks, prospect, bodyText, caPerson }=c;
    // a later reply often brings the power or the volume
    const sideText=prospect?blocks.filter(b=>b!==prospect && b.email && !b.relay).map(b=>b.lines.filter(l=>!PQ_HEADER.test(l)).join('\n')):[];
    const scope=c.scope=prospect?[bodyText].concat(sideText).join('\n'):text;
    let company=c.company;
    if(!company) company=pqCompanyInText(prospect?bodyText:lines.filter(l=>!(caPerson && l.includes(caPerson))).join('\n'));
    if(!company){ const m=/\b(?:société|societe|entreprise|ferme|exploitation|commune de|ville de)\s+([A-Z][\p{L}'&.\- ]{2,40})/u.exec(scope); if(m) company=(/^(commune|ville)/i.test(m[0])?m[0]:m[1]).trim(); }
    if(!company && out.mail && !PQ_GENERIC_DOMAINS.test(out.mail.split('@')[1]||'')){
      company=(out.mail.split('@')[1]||'').replace(/\.[a-z]{2,4}$/,'').replace(/[-_.]+/g,' ');
    }
    if(company) out.producteur=company.replace(/\s+/g,' ').trim().toUpperCase();
    c.company=company;
  }
  // location: postal code (5 digits, overseas 97x xx), "(46)", "département … 64", then département names
  function mailLocation(c){
    const { out, scope }=c;
    let dept=null;
    const noContact=scope.replace(PQ_EMAIL_RE,' ').replace(PQ_PHONE_RE,' ');
    const cpm=/\b(?:[àa]|sur|de|commune de)?\s*([A-ZÉÈ][\p{L}'-]+(?:[ -][A-ZÉÈ]?[\p{L}'-]+){0,3})?\s*,?\s*\(?\b((?:0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})\b\)?/u.exec(noContact);
    if(cpm){ dept=pqDeptFromPostal(cpm[2]); if(cpm[1] && !/^(Le|La|Les|De|Du|Des)$/.test(cpm[1])) c.city=cpm[1].trim(); }
    if(!dept){ const m=/\((\d{2}|2A|2B|97\d)\)/.exec(noContact); if(m) dept=PQ_DEPTS.find(d=>d[0]===m[1].padStart(2,'0'))||null; }
    if(!dept){ const m=/d[ée]partement[^\n\d]{0,30}?\b(\d{2,3}|2A|2B)\b/i.exec(noContact); if(m) dept=PQ_DEPTS.find(d=>d[0]===m[1].padStart(2,'0'))||null; }
    if(!dept){ const fold=pqFold(noContact); dept=PQ_DEPTS.slice().sort((a,b)=>b[1].length-a[1].length).find(d=>new RegExp('(^|[^a-z])'+pqFold(d[1]).replace(/[-' ]/g,'[ \'-]')+'([^a-z]|$)').test(fold))||null; }
    if(dept){ out.dept=pqDeptLabel(dept); out.region=PQ_REGIONS[dept[2]]; }
  }
  // the contract, first rule that matches the folded text
  const MAIL_CONTRACTS=[
    [ft=>/\bs21\b/.test(ft), ()=>'AO S21 CR'],
    [ft=>/\baos\b|appel d.offres? simplifie/.test(ft), ()=>'AOS CRE'],
    [ft=>/autoconsommation collective|\bacc\b/.test(ft), ()=>'Surplus ACC'],
    [ft=>/obligation d.achat|sortie d.oa|\boa\b/.test(ft) && !/jusqu.(en|au) 20(2[8-9]|[3-9]\d)/.test(ft), ()=>"Sortie d'OA / CR"],
    [ft=>/\bppa\b/.test(ft), ()=>'PPA Spot'],
    [ft=>/appel d.offres?|\bao\b|\bcre\b|laureat|ppe2/.test(ft), ft=>/complement de remuneration|\bcr\b/.test(ft)?'AO CRE CR':'AO CRE']
  ];
  // installation type and contract
  function mailTech(c){
    const out=c.out, ft=c.ft=pqFold(c.scope);
    const eol=/eolien|eolienne/.test(ft);
    const pv=/photovolta|voltai|\bpv\b|solaire|ombriere|panneaux|toiture|hangar/.test(ft) || (!eol && /\b\d[\d\s.,]*\s*(kwc|mwc)\b|crete/.test(ft));
    const install=pv&&eol?'PV et Eolien':eol?'Eolien':/biogaz|methanis|cogeneration/.test(ft)?'BIOGAZ':/hydro/.test(ft)?'Hydro':pv?'PV':null;
    if(install) out.install=install;
    const rule=MAIL_CONTRACTS.find(([test])=>test(ft));
    if(rule) out.contrat=rule[1](ft);
  }
  // power, volume, commissioning date (not "en service depuis …"), contract length and start
  function mailFigures(c){
    const { out, scope }=c;
    // a stated total ("soit 16,8 MW", "total 5 MWc") wins over the first figure
    const powRe=PQ_QTY+'\\s*(mwc|mwp|mw|kwc|kwp|kw)\\b(?!h)';
    const pm=new RegExp('(?:soit|au total|total(?:e)?(?:\\s+de)?)\\s*:?\\s*'+powRe,'iu').exec(scope)||new RegExp(powRe,'iu').exec(scope);
    if(pm){ let v=pqQty(pm[1],pm[2]); if(/^m/i.test(pm[2])) v*=1000; out.kwc=String(Math.round(v*100)/100); }
    const vm=new RegExp(PQ_QTY+'\\s*(gwh|mwh|kwh)(?!\\s*\\/\\s*kwc)','iu').exec(scope);
    if(vm){ let v=pqQty(vm[1],vm[2]); const u=vm[2].toLowerCase(); if(u==='gwh') v*=1000; if(u==='kwh') v/=1000; out.mwh=String(Math.round(v)); }
    const mesSent=scope.split(/(?<=[.!?\n])/).find(s=>/mise en service|\bmis\p{L}* en service|\bm[eé]t\p{L}* en service|\ben service (?:en|au|à|a|le|pour|pr[ée]vue?)\b|\bmes\b|\bmsi\b|\bcod\b|raccordement/iu.test(s) && !/depuis/i.test(s));
    if(mesSent){ const d=pqParseDateLoose(mesSent.replace(/\d+[.,]?\d*\s*(mwc|mw|kwc|kw)\b/ig,'')); if(d) out.mesPrev=d; }
    const dm=/(?:contrat|dur[ée]e|pendant|sur|pour|offre)[^.\n]{0,40}?\b(\d{1,2})\s*(?:ans|années|annees)\b/i.exec(scope);
    if(dm) out.duree=dm[1];
    const deb=/(?:à partir du|a partir du|dès le|des le|à compter du|a compter du|début(?:\s+du contrat)?\s*(?:le|au|:)?)\s+([\d\/.\-]+|\d{1,2}(?:er)?\s+\p{L}+\s+\d{4})/iu.exec(scope);
    if(deb){ const d=pqParseDateLoose(deb[1]); if(d) out.debut=d; }
  }
  // plant name: CRE file number, "Parc éolien de …", else "Centrale de <ville>"; a list of plants gives the first one
  function mailPlantName(c){
    const { out, text, scope, city }=c;
    const multi=parseMailInstallations(scope);
    const cre=/\bPR\/\d{4}\/\d{4,6}\b/.exec(text);
    const named=/\b(parc|centrale|ferme)\s+(?:éolien(?:ne)?|solaire|photovoltaïque|PV|hydro\p{L}*)?\s*(de la|de l'|de l’|du|des|de)\s+([A-ZÉÈ][\p{L}'’-]+(?:[ -][A-ZÉÈ][\p{L}'’-]+)*)/u.exec(scope);
    if(multi.length){ out.centrale=multi[0].centrale; if(multi[0].kwc) out.kwc=multi[0].kwc; if(!out.dept && multi[0].dept){ out.dept=multi[0].dept; out.region=multi[0].region; } }
    else if(cre) out.centrale=cre[0];
    else if(named) out.centrale=(named[0].charAt(0).toUpperCase()+named[0].slice(1)).trim();
    else if(city) out.centrale='Centrale de '+city;
    if(!out.centrale) delete out.centrale;
  }
  const MAIL_NOTES=[[/au sol/,'Centrale au sol'],[/toiture|en toit|hangar/,'Toiture'],[/ombriere/,'Ombrière'],[/agrivolta/,'Agrivoltaïsme'],[/laureat/,'Lauréat AO'],
    [/bride/,'Production bridée'],[/stockage|batterie|bess/,'Stockage'],[/pilotage/,'Demande de pilotage']];
  // what is particular about the plant, and the first line of the comments (who sent the lead, the subject)
  function mailNotes(c){
    const { out, ft, prospect, blocks, caPerson, subject }=c;
    const notes=MAIL_NOTES.filter(([re])=>re.test(ft)).map(([,label])=>label);
    if(notes.length) out.particularites=notes.join(' · ');
    const bank=out.ca!=='N/A'?out.ca:null;
    let first='Mail reçu';
    if(out.origine==='Crédit Agricole') first='Lead transmis par '+(caPerson?caPerson+' ('+(bank||'Crédit Agricole')+')':(bank||'le Crédit Agricole'));
    else if(!prospect && blocks.some(b=>b.relay)) first='Lead transmis en interne';
    out.commentaires=pqIsoToFr(toISO(new Date()))+' : '+first+(subject?' — '+subject:'')+'.';
  }

  // A list of plants in the mail ("- Centrale de Cholet (49) : 1,2 MWc, MES 03/2027"): one installation per line
  // a table pasted in the mail (tab-separated from Excel/Outlook, or "| a | b |" from a PDF): read like an Excel sheet
  function parseMailTable(raw){
    const lines=String(raw||'').replace(/\r/g,'').replace(/\u00a0/g,' ').split('\n');
    const cells=l=>{ if((l.match(/\t/g)||[]).length>=1) return l.split('\t').map(c=>c.trim()); if((l.match(/\|/g)||[]).length>=2) return l.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|').map(c=>c.trim()); return null; };
    let best=[], block=[];
    const flush=()=>{ if(block.length>=2){ const found=pqRowsToInstallations(['mail'], ()=>block.map(r=>r.map(c=>/^-?\d+([.,]\d+)?$/.test(c)?parseFloat(c.replace(',','.')):c))); if(found.length>best.length) best=found; } block=[]; };
    lines.forEach(l=>{ const c=cells(l); if(c && c.filter(Boolean).length>=2) block.push(c); else flush(); });
    flush();
    return best;
  }
  // short project names announced in the subject ("Projets photovoltaïques DURAND, KORVAL et MERCADIER")
  function pqSubjectNames(raw){
    const subj=(/^(?:objet|subject)\s*:\s*(.*)$/im.exec(String(raw||''))||[])[1]||'';
    return (subj.match(/\b[A-ZÉÈÀÂÎÔÛÇ][A-ZÉÈÀÂÎÔÛÇ'’-]{2,}\b/g)||[]).filter(w=>!/^(RE|TR|FW|FWD|PV|AO|CRE|MW|MWC|KWC|SAS|SARL|EARL|GAEC|SCEA|ACC|OA|CR)$/.test(w));
  }
  function parseMailInstallations(raw){
    const table=parseMailTable(raw);
    if(table.length) return table;
    const found=[], short=pqSubjectNames(raw);
    String(raw||'').replace(/\r/g,'').replace(/ /g,' ').split('\n').forEach(l=>{
      const m=/^\s*(?:[-•*·–]|\d+[.)])\s*(.+)$/.exec(l); if(!m) return;
      const s=m[1];
      const pm=new RegExp(PQ_QTY+'\\s*(mwc|mwp|mw|kwc|kwp|kw)\\b(?!h)','iu').exec(s); if(!pm) return;
      let v=pqQty(pm[1],pm[2]); if(/^m/i.test(pm[2])) v*=1000;
      const inst={ kwc:String(Math.round(v*100)/100) };
      let name=s.slice(0,pm.index).replace(/\((\d{2,3}|2A|2B)\)/,' ').replace(/[\s:–,-]+$/,'').replace(/\s+/g,' ').trim();
      // "OWNER à COMMUNE (à) 55000": owner, commune and postal code go to their own fields
      const loc=/^(.+?)\s+(?:à|a|sur|-|–)\s+(.+?)\s*(?:,|\s)\s*(?:à\s+)?\(?((?:0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})\)?$/u.exec(name)
             || /^(.+?)\s+(?:à|a|sur)\s+([A-ZÉÈ][\p{L}' -]+)$/u.exec(name);
      if(loc){ inst.spv=loc[1].trim(); inst.commune=loc[2].trim(); if(loc[3]) inst.cp=loc[3]; name=inst.spv; }
      // the plant is called by the short name given in the subject when one matches ("DURAND PAUL" → DURAND)
      const hit=short.find(w=>new RegExp('(^|[^\\p{L}])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^\\p{L}]|$)','u').test(name.toUpperCase()));
      if(hit) name=hit;
      if(name) inst.centrale=name.charAt(0).toUpperCase()+name.slice(1);
      const d=inst.cp?pqDeptFromPostal(inst.cp):pqDeptFromText(s); if(d){ inst.dept=pqDeptLabel(d); inst.region=PQ_REGIONS[d[2]]; }
      const rest=s.slice(pm.index+pm[0].length);
      if(/mes|service|msi|cod|\d{1,2}\/\d{4}/i.test(rest)){ const dt=pqParseDateLoose(rest.replace(/\b(?:p50|p90|production|productible)\b[^,;]*/gi,'')); if(dt) inst.mesPrev=dt; }
      // its own yearly production (« P50 2 900 MWh/an ») and place (« Prayssac (46220) »)
      const pe=/(?:p50|production|productible)?\s*:?\s*(\d[\d\s\u202f.,]*)\s*(gwh|mwh)\b/i.exec(rest);
      if(pe && !/p90/i.test(rest.slice(Math.max(0,pe.index-6), pe.index+4))){ let e=pqNum(pe[1].replace(/[\s\u202f]/g,'')); if(/^g/i.test(pe[2])) e*=1000; if(e>0) inst.mwh=String(Math.round(e)); }
      const place=/([A-ZÉÈÀÂÎÔÛ][\p{L}'’ -]{1,40}?)\s*\(\s*((?:0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})\s*\)/u.exec(rest);
      if(place && !inst.cp){ inst.commune=place[1].trim(); inst.cp=place[2]; const dp=pqDeptFromPostal(inst.cp); if(dp){ inst.dept=pqDeptLabel(dp); inst.region=PQ_REGIONS[dp[2]]; } }
      // what follows the power ("– Injection totale.", "– Autoconsommation prévisionnelle de 10 %, à confirmer.")
      const note=rest.replace(/^[\s,;:–—-]+/,'').replace(/[.\s]+$/,'').trim();
      if(note && note.length<=120 && !/^(mes|msi|cod)\b/i.test(note)) inst.particularites=note;
      found.push(inst);
    });
    if(found.length>=2) return found;
    return parseMailSentencePlants(raw);
  }
  // plants named in a sentence: "nos centrales de Cholet (1,2 MWc) et de Saumur (800 kWc)", "l'école (36 kWc), le gymnase (100 kWc)"
  function parseMailSentencePlants(raw){
    const text=String(raw||'').replace(/\r/g,'').replace(/\u00a0/g,' ');
    const re=new RegExp("([\\p{L}'’-]+(?:[ \\t]+[\\p{L}'’-]+){0,4})\\s*\\(\\s*"+PQ_QTY+"\\s*(mwc|mwp|mw|kwc|kwp|kw)\\s*\\)",'giu');
    const STOP=/^(de|du|des|d|l|le|la|les|et|ou|nos|notre|leurs?|aux?|à|a|sa|son|ses|en|dont|avec|soit|puis)$/i;
    const found=[]; let m;
    while((m=re.exec(text))){
      const words=m[1].split(/[ \t]+/);
      let k=words.length-1;
      // the name = the words after the last little word ("de Cholet" → Cholet, "le gymnase" → gymnase, "l'école" → école)
      while(k>0 && !STOP.test(words[k-1].replace(/['’].*$/,'')) && !/['’]$/.test(words[k-1])) k--;
      let name=words.slice(k).join(' ').replace(/^[dl]['’]/i,'').trim();
      if(!name || STOP.test(name)) continue;
      let v=pqQty(m[2],m[3]); if(/^m/i.test(m[3])) v*=1000;
      found.push({ centrale:name.charAt(0).toUpperCase()+name.slice(1), kwc:String(Math.round(v*100)/100) });
    }
    return found.length>=2?found:[];
  }

  // What the mail announces about the number of plants, to check the installations found against it:
  // "trois projets", "3 centrales", the names listed in the subject, "soit une puissance totale de 795 kWc".
  const PQ_NUMBERS={ deux:2, trois:3, quatre:4, cinq:5, six:6, sept:7, huit:8, neuf:9, dix:10, onze:11, douze:12, quinze:15, vingt:20, two:2, three:3, four:4, five:5 };
  function pqPlantHints(raw){
    const text=String(raw||'').replace(/\u00a0/g,' ');
    const hints={ count:null, total:null, source:'' };
    const cm=/\b(\d{1,2}|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|two|three|four|five)\s+(?:(?:nouveaux|nouvelles|autres|futurs?|premiers?|petites?|grandes?)\s+)?(projets?|centrales?|installations?|sites?|parcs?|toitures?|ombri[eè]res?|hangars?|b[aâ]timents?|plants?|unit[ée]s?)\b/i.exec(text);
    if(cm){ const n=PQ_NUMBERS[cm[1].toLowerCase()]||parseInt(cm[1],10); if(n>=2 && n<=60){ hints.count=n; hints.source='« '+cm[0].trim()+' »'; } }
    if(!hints.count){
      const subj=(/^(?:objet|subject)\s*:\s*(.*)$/im.exec(text)||[])[1]||'';
      const names=pqSubjectNames(text);
      if(/projets|centrales|sites|parcs|installations/i.test(subj) && names.length>=2){
        // the names right after "Projets …": "Projets photovoltaïques DURAND, MARTIN et LEROY"
        const tail=subj.replace(/^.*?(projets|centrales|sites|parcs|installations)\b/i,'');
        const listed=names.filter(n=>tail.toUpperCase().includes(n));
        if(listed.length>=2){ hints.count=listed.length; hints.source='objet du mail'; }
      }
    }
    const tm=new RegExp("(?:puissance\\s+totale(?:\\s+install[ée]e)?(?:\\s+de)?|soit(?:\\s+une\\s+puissance\\s+totale(?:\\s+install[ée]e)?\\s+de)?|au\\s+total(?:\\s+de)?|total(?:e)?\\s*(?:de|:)?)\\s*:?\\s*"+PQ_QTY+"\\s*(mwc|mwp|mw|kwc|kwp|kw)\\b",'iu').exec(text)
            || new RegExp(PQ_QTY+"\\s*(mwc|mwp|mw|kwc|kwp|kw)\\s+au\\s+total",'iu').exec(text);
    if(tm){ let v=pqQty(tm[1],tm[2]); if(/^m/i.test(tm[2])) v*=1000; hints.total=Math.round(v*100)/100; }
    return hints;
  }

  // ----- Producer Excel → installations -----
  // Two layouts are recognised on every sheet, and the one that reads the most values wins:
  //  - one column per plant: labels in a left column (Puissance installée, P50…), a plant per column to the right
  //    (the Selfee « Caractéristiques Centrales » template is of this kind);
  //  - one row per plant: a header row (Projet | Puissance | P50 …), a plant per row below; « Total » rows skipped.
  // Order matters: the first definition matching a label wins (« Puissance unitaire » before « Puissance »).
  const XL_DEFS=[
    { k:'nbm', re:/nombre d.(eoliennes|machines|turbines|aerogenerateurs)|^nb (d.)?(eoliennes|machines|turbines)/ },
    { k:'unit', re:/puissance unitaire/, not:/onduleur|kva/ },
    { k:'centrale', re:/^(nom\b.*\b(installation|centrale|projet|parc|site)\b.*|nom|nom du projet|nom du site|installation|centrale|projet|site|parc|ouvrage|designation|(plant|project|site|asset) name|plant|asset)$/ },
    { k:'siret', re:/siret|siren/ },
    { k:'spv', re:/\bspv\b|societe de projet|raison sociale|^societe$/ },
    { k:'adresse', re:/^adresse/ },
    { k:'commune', re:/^(commune|ville|localite)\b/ },
    { k:'cp', re:/code postal|^cp$/ },
    { k:'dept', re:/^(departement|dept|dpt|location|localisation|county)\b/ },
    { k:'install', re:/^(type|filiere|technologie|techno|energie|nature projet|nature du projet|type d.installation|type de centrale|technology)$/, not:/injection|contrat|liste/ },
    { k:'productible', re:/kwh ?\/ ?kwc|kwh ?\/ ?kwp|par kwc|productible specifique|specific yield|heures? equivalentes?/, not:/\bp90\b/ },
    { k:'kwc', re:/puissance|^p ?(installee|crete|nominale)\b|^pc$|\bkwc\b|\bmwc\b|capacity|\bpower\b|\bmwp\b|\bkwp\b/, not:/raccordement|\bac\b|kva|mva|unitaire|onduleur|injection|reservee|kwh ?\/ ?kwc|par kwc|productible/ },
    { k:'mwh', re:/\bp50\b|production|productible|volume|energie (produite|annuelle)|\byield\b|generation|annual energy/, not:/kwh ?\/ ?kwc|\bp90\b|par kwc/ },
    { k:'p90', re:/\bp90\b/, not:/kwh ?\/ ?kwc/ },
    { k:'fin', re:/fin (de l.|d.)?oa\b|fin (du |de )?contrat|echeance|date de fin/ },
    { k:'injection', re:/premiere injection|first injection|date d.injection/, not:/type d.injection/ },   // start of the contract (test phase until the MSI)
    { k:'mesPrev', re:/mise en service|\bmsi\b|\bmes\b|\bcod\b|date de raccordement|raccordement prevu|commissioning|\bcod date\b/, not:/type d.injection/ },
    { k:'contrat', re:/mecanisme|soutien|type de contrat|appel d.offres?|^tarif|^contrat$|cadre (juridique|contractuel)/ }
  ];
  const xlLabel=v=>pqFold(v).replace(/\s+/g,' ').trim();
  function xlDef(v){
    if(typeof v!=='string' || !v.trim() || v.length>80) return null;
    const lf=xlLabel(v);
    if(/^(centrale|installation|projet|site|parc)\s*n?°?\s*\d+$/.test(lf)) return null;   // "Centrale 1" is a column title, not a label
    return XL_DEFS.find(d=>d.re.test(lf) && !(d.not && d.not.test(lf)))||null;
  }
  const xlUnit=s=>{ const m=/\b(mwc|mwp|mw|kwc|kwp|kw|kva|gwh|mwh|kwh)\b/.exec(pqFold(s)); return m?m[1]:''; };
  // number + unit from a cell; the unit written in the cell wins over the one in the label
  function xlQty(v, labelUnit){
    if(typeof v==='number') return { n:v, unit:labelUnit };
    const s=String(v||'').replace(/ /g,' ').trim(); if(!s) return null;
    const m=new RegExp(PQ_QTY+'\\s*(mwc|mwp|mw|kwc|kwp|kw|kva|gwh|mwh|kwh)?','iu').exec(s); if(!m) return null;
    const unit=(m[2]||labelUnit||'').toLowerCase();
    return { n:pqQty(m[1], unit), unit };
  }
  const xlRound=(n,d)=>String(Math.round(n*Math.pow(10,d))/Math.pow(10,d));
  function xlInstallType(v){ const f=pqFold(v); return /eol/.test(f)?'Eolien':/hydro/.test(f)?'Hydro':/biog|metha|cogen/.test(f)?'BIOGAZ':/pv|photo|solaire|ombri|toiture|\bsol\b|agrivolta|hangar/.test(f)?'PV':''; }
  function xlContrat(v){ const f=pqFold(v); return /s21/.test(f)?'AO S21 CR':/\baos\b|simplifi/.test(f)?'AOS CRE':/\boa\b|obligation/.test(f)?"Sortie d'OA / CR":/\bacc\b|autoconsommation/.test(f)?'Surplus ACC':/ppa/.test(f)?'PPA Spot':/\bao\b|cre|complement/.test(f)?'AO CRE CR':''; }
  // one value of one plant, converted for the installation form
  function xlSet(inst, def, label, v){
    if(v===''||v==null) return;
    const lu=xlUnit(label);
    switch(def.k){
      case 'kwc': { const q=xlQty(v, lu); if(!q||isNaN(q.n)) return; const dcFirst=/\bdc\b|crete|installee|totale|kwc|mwc/.test(xlLabel(label)); if(inst.kwc && !dcFirst) return; inst.kwc=xlRound(/^m/.test(q.unit)?q.n*1000:q.n, 2); return; }
      case 'unit': { const q=xlQty(v, lu||'mw'); if(q&&!isNaN(q.n)) inst._unitKw=/^m/.test(q.unit)?q.n*1000:q.n; return; }
      case 'nbm': { const n=parseFloat(v); if(n) inst._nb=n; return; }
      case 'productible': { const n=typeof v==='number'?v:pqNum(String(v)); if(!n||isNaN(n)) return; inst.productible=String(Math.round(n<10?n*1000:n)); return; }
      case 'mwh': case 'p90': { const q=xlQty(v, lu||'mwh'); if(!q||isNaN(q.n)) return; let n=q.n; if(q.unit==='gwh') n*=1000; if(q.unit==='kwh') n/=1000; inst[def.k]=String(Math.round(n)); return; }
      case 'mesPrev': case 'fin': { const d=pqCellDate(v); if(d) inst[def.k]=d; return; }
      case 'injection': { const d=pqCellDate(v); if(d) inst._inj=d; return; }
      case 'dept': { const d=pqDeptFromText(String(v)); if(d){ inst.dept=pqDeptLabel(d); inst.region=PQ_REGIONS[d[2]]; } return; }
      case 'cp': { const cp=typeof v==='number'?String(v).padStart(5,'0'):String(v).trim(); inst.cp=cp; return; }
      case 'install': { const t=xlInstallType(v); if(t) inst.install=t; if(/au sol|\bsol\b/i.test(v)) inst._nature='Centrale au sol'; else if(/toiture|hangar/i.test(v)) inst._nature='Toiture'; else if(/ombri/i.test(v)) inst._nature='Ombrière'; return; }
      case 'contrat': { const c=xlContrat(v); if(c) inst.contrat=c; return; }
      case 'commune': { const s=String(v).trim(), m=/^(\d{5})\s+(.+)$/.exec(s); if(m){ inst.commune=m[2].trim(); if(!inst.cp) inst.cp=m[1]; } else inst.commune=s; return; }
      default: inst[def.k]=String(v).trim();
    }
  }
  function xlFinish(inst){
    if(!inst.kwc && inst._nb && inst._unitKw) inst.kwc=xlRound(inst._nb*inst._unitKw, 2);
    if(!inst.dept && inst.cp){ const d=pqDeptFromPostal(inst.cp); if(d){ inst.dept=pqDeptLabel(d); inst.region=PQ_REGIONS[d[2]]; } }
    if(!inst.dept && inst.adresse){ const d=pqDeptFromText(inst.adresse); if(d){ inst.dept=pqDeptLabel(d); inst.region=PQ_REGIONS[d[2]]; } }
    if(!inst.cp && inst.adresse){ const m=/\b(\d{5})\b/.exec(inst.adresse); if(m) inst.cp=m[1]; }
    if(!inst.install && (inst.kwc||'') && /kwc|mwc|crete/.test(inst._labels||'')) inst.install='PV';
    if(inst._nature) inst.particularites=inst._nature;
    if(inst._inj && !inst.debut){ const f=pqFullDate(inst._inj); inst.debut=f||inst._inj; }   // the contract starts at the first injection
    if(inst._inj && !inst.mesPrev) inst.mesPrev=inst._inj;
    if(!inst.centrale && inst.spv) inst.centrale=inst.spv;   // « Nom Installation » left empty: the SPV names the plant
    Object.keys(inst).forEach(k=>{ if(k.charAt(0)==='_') delete inst[k]; });
    return inst;
  }
  const xlFilled=list=>list.reduce((s,i)=>s+Object.keys(i).filter(k=>k!=='caract').length,0);
  // label → value of one plant, as written in the file (dates as dd/mm/yyyy)
  function xlRaw(pairs){
    const out={};
    pairs.forEach(([l,v])=>{ if(typeof l!=='string' || !l.trim() || v==='' || v==null) return; out[l.trim()]=v instanceof Date?pqCellDate(v):(typeof v==='number'?v:String(v).trim()); });
    return out;
  }
  // layout « one column per plant »
  function xlVertical(rows){
    let best=[];
    for(let c=0;c<3;c++){
      const hits=[];
      rows.forEach((r,ri)=>{ const d=xlDef(r[c]); if(d && !hits.some(h=>h.def.k===d.k && d.k!=='kwc')) hits.push({ def:d, ri, label:r[c] }); });
      const keys=new Set(hits.map(h=>h.def.k));
      if(keys.size<2 || !['kwc','mwh','centrale'].some(k=>keys.has(k))) continue;
      const first=Math.min(...hits.map(h=>h.ri));
      const width=Math.max(...rows.map(r=>r.length));
      const plants=[];
      for(let j=c+1;j<width;j++){
        const filled=hits.filter(h=>rows[h.ri][j]!=='' && rows[h.ri][j]!=null).length;
        if(filled<2) continue;
        const inst={ _labels:hits.map(h=>xlLabel(h.label)).join(' ') };
        hits.forEach(h=>xlSet(inst, h.def, h.label, rows[h.ri][j]));
        inst.caract=xlRaw(rows.map(r=>[r[c], r[j]]));   // every line of the file, for the « Caractéristiques Centrales » sheet
        // a plant named in the column title ("Centrale du Moulin") when there is no name row
        if(!inst.centrale){ for(let r=first-1;r>=0;r--){ const t=rows[r][j]; if(typeof t==='string' && t.trim() && !/^(centrale|installation|projet|site|parc)\s*n?°?\s*\d+$/i.test(pqFold(t).trim())){ inst.centrale=t.trim(); break; } } }
        plants.push(xlFinish(inst));
      }
      if(xlFilled(plants)>xlFilled(best)) best=plants;
    }
    return best;
  }
  // layout « one row per plant »
  function xlHorizontal(rows){
    let best=[];
    rows.slice(0,40).forEach((head,hi)=>{
      const cols=[]; head.forEach((v,j)=>{ const d=xlDef(v); if(d) cols.push({ def:d, j, label:v }); });
      const keys=new Set(cols.map(c=>c.def.k));
      if(keys.size<2 || !['kwc','mwh'].some(k=>keys.has(k))) return;
      const plants=[]; let blanks=0;
      for(let r=hi+1;r<rows.length && blanks<2;r++){
        const row=rows[r]||[];
        if(!row.some(v=>v!==''&&v!=null)){ blanks++; continue; } blanks=0;
        const firstCell=String(row.find(v=>v!==''&&v!=null)||'');
        if(/^(total|sous-total|somme|moyenne|ensemble)\b/i.test(pqFold(firstCell))) continue;
        const inst={ _labels:cols.map(c=>xlLabel(c.label)).join(' ') };
        cols.forEach(c=>xlSet(inst, c.def, c.label, row[c.j]));
        inst.caract=xlRaw(head.map((l,j)=>[l, row[j]]));
        if(!inst.centrale){ const nameCell=row.find((v,j)=>typeof v==='string' && v.trim() && !cols.some(c=>c.j===j)); if(nameCell) inst.centrale=nameCell.trim(); }
        if(Object.keys(inst).filter(k=>k.charAt(0)!=='_').length>=2) plants.push(xlFinish(inst));
      }
      if(xlFilled(plants)>xlFilled(best)) best=plants;
    });
    return best;
  }
  function pqRowsToInstallations(sheetNames, getRows){
    const found=[];
    sheetNames.forEach(name=>{
      const rows=(getRows(name)||[]).map(r=>(r||[]).map(v=>v==null?'':v));
      const v=xlVertical(rows), h=xlHorizontal(rows);
      found.push(...(xlFilled(h)>xlFilled(v)?h:v));
    });
    return found.filter(i=>i.kwc||i.mwh||i.centrale);
  }
  function pqXlsxToInstallations(wb){ return pqRowsToInstallations(wb.SheetNames, n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''})); }

  // ----- Files: .eml / .txt / .msg (Outlook) / .xlsx; SheetJS is loaded on first use -----

  function pqDecodeQP(s){ return s.replace(/=\r?\n/g,'').replace(/(=[0-9A-F]{2})+/gi, m=>{ try{ return decodeURIComponent(m.replace(/=/g,'%')); }catch(e){ return m; } }); }
  function pqHtmlToText(h){ const d=document.createElement('div'); d.innerHTML=h.replace(/<(br|\/p|\/div|\/tr|\/li)[^>]*>/gi,'\n$&'); d.querySelectorAll('style,script').forEach(n=>n.remove()); return d.textContent.replace(/\n{3,}/g,'\n\n'); }
  function pqDecodeMimeWords(s){ return s.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,(m,cs,enc,txt)=>{ try{ if(enc.toLowerCase()==='b') return decodeURIComponent(escape(atob(txt))); return pqDecodeQP(txt.replace(/_/g,' ')); }catch(e){ return txt; } }); }
  // .eml (saved from the new Outlook, Outlook on the web, Gmail…): text, sender, subject and the attached files
  // (Excel of the producer…), including those of a mail forwarded as an attachment.
  function pqEmlFileName(ph){
    const h=ph.replace(/\r?\n[ \t]+/g,' ');
    const star=/filename\*=(?:([\w-]+)'[^']*')?([^;\r\n]+)/i.exec(h);
    if(star){ try{ return decodeURIComponent(star[2].trim().replace(/^"|"$/g,'')); }catch(e){ return star[2].trim(); } }
    const m=/(?:filename|name)\s*=\s*"([^"]+)"/i.exec(h) || /(?:filename|name)\s*=\s*([^;\s]+)/i.exec(h);
    return m?pqDecodeMimeWords(m[1].trim()):'';
  }
  function pqB64Bytes(s){ const bin=atob(s.replace(/[^A-Za-z0-9+/=]/g,'')); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; }
  function parseEml(raw){
    const split=raw.search(/\r?\n\r?\n/); const head=raw.slice(0,split<0?raw.length:split).replace(/\r?\n[ \t]+/g,' '); const rest=split<0?'':raw.slice(split).trim();
    const hdr=n=>{ const m=new RegExp('^'+n+':\\s*(.*)$','im').exec(head); return m?pqDecodeMimeWords(m[1].trim()):''; };
    let text='', html=''; const attachments=[], forwarded=[];
    const bm=/boundary="?([^";\r\n]+)"?/i.exec(head+'\n'+rest.slice(0,2000));
    const decodePart=(ph, body)=>{ const enc=(/content-transfer-encoding:\s*([\w-]+)/i.exec(ph)||[])[1]||''; if(/base64/i.test(enc)){ try{ return decodeURIComponent(escape(atob(body.replace(/\s/g,'')))); }catch(e){ return ''; } } if(/quoted-printable/i.test(enc)) return pqDecodeQP(body); return body; };
    if(bm){
      rest.split('--'+bm[1]).forEach(part=>{
        const i=part.search(/\r?\n\r?\n/); if(i<0) return; const ph=part.slice(0,i).replace(/^\s+/,''), pb=part.slice(i).trim();
        const name=pqEmlFileName(ph), isAttach=/content-disposition:\s*attachment/i.test(ph) || (!!name && !/content-type:\s*text\/(plain|html)/i.test(ph));
        if(/content-type:\s*message\/rfc822/i.test(ph)){ const inner=parseEml(decodePart(ph,pb)); forwarded.push(inner); attachments.push(...inner.attachments); return; }
        if(/boundary=/i.test(ph)){ const inner=parseEml(ph+'\n\n'+pb); if(!text) text=inner.body; attachments.push(...inner.attachments); return; }   // inner.body already carries its forwarded mails
        if(isAttach && name){
          try{ attachments.push({ name, data:/base64/i.test(ph)?pqB64Bytes(pb):new TextEncoder().encode(decodePart(ph,pb)) }); }catch(e){ softFail('pièce jointe '+name, e); }
          return;
        }
        if(/content-type:\s*text\/plain/i.test(ph) && !text) text=decodePart(ph,pb);
        else if(/content-type:\s*text\/html/i.test(ph) && !html) html=decodePart(ph,pb);
      });
    } else { const body=decodePart(head,rest); if(/content-type:\s*text\/html/i.test(head)) html=body; else text=body; }
    let body=text||pqHtmlToText(html);
    forwarded.forEach(f=>{ body+='\n\n-------- Mail joint --------\nDe : '+f.from+'\nObjet : '+f.subject+'\n\n'+f.body; });
    return { from:hdr('From'), subject:hdr('Subject'), body, attachments, forwarded };
  }
  function pqUtf16(u8){ let s=''; for(let i=0;i+1<u8.length;i+=2) s+=String.fromCharCode(u8[i]|(u8[i+1]<<8)); return s.replace(/\u0000+$/,''); }
  function parseMsg(buf){
    const cfb=XLSX.CFB.read(new Uint8Array(buf),{type:'array'});
    const get=(path)=>{ const e=XLSX.CFB.find(cfb,path); return e&&e.content?new Uint8Array(e.content):null; };
    const str=(id)=>{ const u=get('/__substg1.0_'+id+'001F'); if(u) return pqUtf16(u); const a=get('/__substg1.0_'+id+'001E'); return a?new TextDecoder('latin1').decode(a).replace(/\u0000+$/,''):''; };
    let body=str('1000');
    if(!body){ const h=get('/__substg1.0_10130102'); if(h) body=pqHtmlToText(new TextDecoder().decode(h)); }
    const attachments=[];
    cfb.FullPaths.forEach(p=>{
      const m=/^\/?(?:Root Entry\/)?(__attach_version1\.0_#[0-9A-F]{8})\/$/i.exec(p); if(!m) return;
      const nameU=get('/'+m[1]+'/__substg1.0_3707001F')||get('/'+m[1]+'/__substg1.0_3704001F');
      const data=get('/'+m[1]+'/__substg1.0_37010102');
      if(nameU && data) attachments.push({ name:pqUtf16(nameU), data });
    });
    return { from:(str('0C1A')+' <'+(str('0C1F')||str('5D01'))+'>').trim(), subject:str('0037'), body, attachments };
  }
  const PQ_CIVILITY=/^(m\.|mr\.?|mme|mlle|mrs?|ms|monsieur|madame|mademoiselle)\s+/i;
  function pqFullDate(s){ const p=pqMonthYear(s); if(!p) return ''; const d=new Date(p.y, (p.m||1)-1, p.d||1); return pqPad(d.getDate())+'/'+pqPad(d.getMonth()+1)+'/'+d.getFullYear(); }
  function pqMonthYear(s){
    const t=String(s||'').trim(); let m;
    if((m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) return { y:+m[3], m:+m[2], d:+m[1] };
    if((m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) return { y:+m[1], m:+m[2], d:+m[3] };
    if((m=/^(\p{L}+)\s+(\d{4})$/u.exec(t)) && PQ_MONTHS[pqFold(m[1])]) return { y:+m[2], m:PQ_MONTHS[pqFold(m[1])], d:1 };
    if((m=/^(\d{4})$/.exec(t))) return { y:+m[1], m:null, d:null };
    const loose=t?pqParseDateLoose(t):null;   // « juil-27 », « 1er mars 2027 »… once more through the loose reader
    return loose && loose!==t ? pqMonthYear(loose) : null;
  }
  // a .vcf file (what a phone exports): one contact per card, folded lines, quoted-printable, mobile number first
  function parseVcf(text){
    const raw=String(text||'').replace(/\r\n?/g,'\n').replace(/\n[ \t]/g,'');   // folded lines
    const un=v=>String(v||'').replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1').trim();
    const qp=v=>{ try{ return decodeURIComponent(v.replace(/=\n/g,'').replace(/(=[0-9A-F]{2})+/gi, m=>m.replace(/=/g,'%'))); }catch(e){ return v; } };
    const out=[];
    raw.split(/BEGIN:VCARD/i).slice(1).forEach(card=>{
      const c={ firstName:'', lastName:'', company:'', role:'', email:'', phone1:'', phone2:'', comment:'' }, tels=[];
      card.split('\n').forEach(line=>{ const m=/^([^:;]+)((?:;[^:]*)?):(.*)$/.exec(line.trim()); if(!m) return;
        const key=m[1].toUpperCase().replace(/^ITEM\d+\./,''), params=m[2].toUpperCase(); let val=m[3]; if(/QUOTED-PRINTABLE/.test(params)) val=qp(val);
        if(key==='N'){ const [last,first]=val.split(';'); c.lastName=un(last); c.firstName=un(first); }
        else if(key==='FN' && !c.firstName && !c.lastName){ const w=un(val).split(/\s+/); c.firstName=w.shift()||''; c.lastName=w.join(' '); }
        else if(key==='ORG'){ c.company=un(val.split(';')[0]); }
        else if(key==='TITLE'){ c.role=un(val); }
        else if(key==='EMAIL' && !c.email){ c.email=un(val).toLowerCase(); }
        else if(key==='TEL'){ tels.push({ v:un(val).replace(/^tel:/i,''), cell:/CELL|MOBILE|IPHONE/.test(params) }); }
        else if(key==='NOTE'){ c.comment=un(val); } });
      tels.sort((a,b)=>b.cell-a.cell); c.phone1=tels[0]?pqFmtPhone(tels[0].v):''; c.phone2=tels[1]?pqFmtPhone(tels[1].v):'';
      if(c.firstName||c.lastName||c.email||c.phone1) out.push(c); });
    return out;
  }
  return { parseVcf, toISO, PQ_CHARGES, PQ_ORIGINES, PQ_ACTIONS, PQ_INSTALLS, PQ_CONTRATS, PQ_MARCHES, PQ_NATURES, PQ_CAISSES, PQ_CA_OPTIONS, PQ_REGIONS, PQ_DEPTS, pqDeptLabel, PQ_DEPT_OPTIONS, PQ_YIELD, PQ_FIELDS, PQ_SHARED_KEYS, PQ_EXTRA_FIELDS, PQ_INST_GROUPS, PQ_CENTRALE_KEYS, pqPad, pqFold, pqTitleCase, pqIsoToFr, pqAddDays, PQ_MONTHS, PQ_MONTH_LABEL, PQ_MONTH_NAMES, PQ_EMAIL_RE, PQ_PHONE_RE, pqIsCa, PQ_CLOSINGS, PQ_HEADER, pqFmtPhone, PQ_QTY, pqQty, pqNum, pqCaisseFromText, pqCaisseFromDomain, pqDeptFromPostal, pqDeptFromText, pqParseDateLoose, xlDay, pqCellDate, PQ_INTERNAL_DOMAINS, pqIsInternal, pqIsRelay, PQ_GENERIC_DOMAINS, PQ_NOT_NAME, PQ_FORM, pqSplitName, pqCompanyInText, SIG_JUNK, SIG_DISCLAIMER, SIG_PHONE_LABEL, SIG_MAIL_LABEL, SIG_ROLE, SIG_PUBLIC, SIG_ADDRESS, SIG_WEB, SIG_PARTICLES, sigNameWords, sigLocalTokens, sigDomainStem, sigNameScore, sigSplitName, sigPhones, parseSignatureBlock, pqSplitDisplayName, PQ_ROBOT, pqDetectPeople, parsePipeMail, parseMailTable, pqSubjectNames, parseMailInstallations, parseMailSentencePlants, PQ_NUMBERS, pqPlantHints, XL_DEFS, xlLabel, xlDef, xlUnit, xlQty, xlRound, xlInstallType, xlContrat, xlSet, xlFinish, xlFilled, xlRaw, xlVertical, xlHorizontal, pqRowsToInstallations, pqXlsxToInstallations, pqDecodeQP, pqHtmlToText, pqDecodeMimeWords, pqEmlFileName, pqB64Bytes, parseEml, pqUtf16, parseMsg, PQ_CIVILITY, pqFullDate, pqMonthYear };
})();
