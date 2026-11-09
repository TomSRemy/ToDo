// Todo — capture vocale dans la barre d'ajout rapide (loaded before js/app.js). Split out like js/parc.js.
// Reconnaissance : Web Speech API du navigateur (Chrome/Edge sur Windows, Safari sur iPhone) ; audio envoyé au service du
// navigateur pour être transcrit, comme pour la dictée du clavier du téléphone. Rien d'enregistré par l'appli elle-même.
window.TodoVoice=(function(){
  let app=null;   // what this part needs from js/app.js, given once at start-up (init)
  const DOW=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const fold=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  function pad(n){ return String(n).padStart(2,'0'); }
  function toISO(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }

  // Finds a date/time phrase in French speech and returns { due, time, cleanTitle } — null fields if nothing found.
  function parseWhen(text){
    const folded=fold(text);
    const now=new Date(); now.setHours(0,0,0,0);
    const spans=[]; let due=null;
    let m=/apres[\s-]?demain/.exec(folded);
    if(m){ const d=new Date(now); d.setDate(d.getDate()+2); due=toISO(d); spans.push([m.index, m.index+m[0].length]); }
    else if((m=/\bdemain\b/.exec(folded))){ const d=new Date(now); d.setDate(d.getDate()+1); due=toISO(d); spans.push([m.index, m.index+m[0].length]); }
    else if((m=/aujourd'?hui/.exec(folded))){ due=toISO(now); spans.push([m.index, m.index+m[0].length]); }
    else if((m=/\bdans\s+(\d+)\s+jours?\b/.exec(folded))){ const d=new Date(now); d.setDate(d.getDate()+parseInt(m[1],10)); due=toISO(d); spans.push([m.index, m.index+m[0].length]); }
    else if((m=new RegExp('\\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\\b(\\s+prochain[e]?)?','').exec(folded))){
      const target=DOW.indexOf(m[1]); const diff=((target-now.getDay()+7)%7)||7; const d=new Date(now); d.setDate(d.getDate()+diff); due=toISO(d);
      spans.push([m.index, m.index+m[0].length]);
    }
    let time=null;
    const tm=/\b(?:a\s+)?(\d{1,2})\s*[h:]\s*(\d{2})?\b/.exec(folded);
    if(tm && +tm[1]<24 && (!tm[2]||+tm[2]<60)){ time=pad(+tm[1])+':'+pad(tm[2]?+tm[2]:0); spans.push([tm.index, tm.index+tm[0].length]); }
    spans.sort((a,b)=>b[0]-a[0]);   // remove from the end so earlier indices stay valid
    let clean=text;
    spans.forEach(([a,b])=>{ clean=clean.slice(0,a)+clean.slice(b); });
    clean=clean.replace(/\s{2,}/g,' ').replace(/^[\s,.-]+|[\s,.-]+$/g,'').trim();
    if(clean) clean=clean.charAt(0).toUpperCase()+clean.slice(1);
    return { due, time, cleanTitle:clean||text };
  }

  function supported(){ return !!(window.SpeechRecognition||window.webkitSpeechRecognition); }

  function wire(btn, input){
    if(!supported()){ btn.hidden=true; return; }
    const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
    let rec=null, listening=false;
    function stop(){ listening=false; btn.classList.remove('listening'); if(rec){ try{ rec.stop(); }catch(e){} } }
    btn.onclick=()=>{
      if(listening){ stop(); return; }
      rec=new Rec(); rec.lang='fr-FR'; rec.interimResults=false; rec.maxAlternatives=1;
      rec.onresult=e=>{
        const text=(e.results[0] && e.results[0][0] && e.results[0][0].transcript)||''; if(!text) return;
        const { due, time, cleanTitle }=parseWhen(text);
        app.openVoiceTask(cleanTitle, due, time);
      };
      rec.onerror=()=>stop();
      rec.onend=()=>stop();
      try{ rec.start(); listening=true; btn.classList.add('listening'); }catch(e){ stop(); }
    };
  }
  const api={};
  api.init=function(a){ app=a; };
  api.wire=wire;
  api.parseWhen=parseWhen;   // exposed for a quick manual check from the console
  return api;
})();
