// Todo — the sync merge (loaded before js/app.js): three-way merge by record and by field, the post-it merged line by line,
// settings merged key by key. Pure functions: the app passes in what records a conflict (js/app.js keeps the list).
// Split out of js/app.js (code audit, lot 2).
window.TodoMerge=(function(){
  const recs=v=>Array.isArray(v)?v.filter(x=>x && typeof x==='object' && !Array.isArray(x) && x.id!=null && x.id!==''):[];
  // Post-it text edited on two devices: this device's lines, minus those the other device deleted (and this one did not touch),
  // plus those the other device added, placed after the line that precedes them there.
  // a setting changed on both devices (saved views, network layout, goals): both kept — views by name, the rest key by key
  function mergePrefValue(local, remote){
    let l, r; try{ l=JSON.parse(local); r=JSON.parse(remote); }catch(e){ return local; }
    if(Array.isArray(l) && Array.isArray(r)) return JSON.stringify(l.every(x=>x && typeof x==='object')?l.concat(r.filter(x=>x && !l.some(y=>y.name===x.name))):[...new Set(l.concat(r))]);
    if(l && r && typeof l==='object' && typeof r==='object') return JSON.stringify(Object.assign({}, r, l));
    return local;
  }
  function mergeNoteLines(base, local, remote){
    const B=String(base||'').split('\n'), L=String(local||'').split('\n'), R=String(remote||'').split('\n');
    const inB=new Set(B), inR=new Set(R), inL=new Set(L);
    const out=L.filter(l=>!(inB.has(l) && !inR.has(l)));
    R.forEach((l,i)=>{ if(inB.has(l) || inL.has(l) || out.includes(l)) return;
      const prev=i>0?R[i-1]:null, at=prev!=null?out.lastIndexOf(prev):-1; out.splice(at+1, 0, l); });
    return out.join('\n').replace(/\n{3,}/g,'\n\n');
  }
  // fields the user never needs to arbitrate: the app's own bookkeeping
  const SILENT_MERGE=new Set(['caract','excelSent','excelPrev','excelKeep','mailSentAt','caractSentAt','pipeSentAt','bddSentAt','notDupOf','lostAt','goDate','signDate','taskId','stageBeforeExit','createdAt','archivedAt','lastSeen']);
  // Three-way merge: with a known common ancestor (base), a field that
  // changed on only one side is taken automatically; a field changed
  // differently on both sides is a real conflict — auto-resolved to the
  // most recent for now (nothing ever blocks), but logged for review.
  // Without a base (first sync ever), falls back to whole-record
  // most-recent-wins, same as before.
  function threeWayMerge(entityType, localList, remoteList, baseList, logConflict){   // logConflict: the app keeps the conflict list
    localList=recs(localList); remoteList=recs(remoteList); baseList=recs(baseList);
    const baseById={}; (baseList||[]).forEach(b=>{ baseById[b.id]=b; });
    const localById={}; localList.forEach(l=>{ localById[l.id]=l; });
    const remoteById={}; remoteList.forEach(r=>{ remoteById[r.id]=r; });
    const allIds=new Set([...Object.keys(localById), ...Object.keys(remoteById)]);
    const merged=[];

    allIds.forEach(id=>{
      const local=localById[id], remote=remoteById[id], base=baseById[id];
      if(local && !remote){ merged.push(local); return; }
      if(remote && !local){ merged.push(remote); return; }
      if(!local || !remote) return;
      if(JSON.stringify(local)===JSON.stringify(remote)){ merged.push(local); return; }

      if(!base){
        merged.push((remote.updatedAt||0) > (local.updatedAt||0) ? remote : local);
        return;
      }

      const result={...local};
      const allFields=new Set([...Object.keys(local), ...Object.keys(remote)]);
      allFields.forEach(field=>{
        if(field==='updatedAt') return;
        const lv=JSON.stringify(local[field]), rv=JSON.stringify(remote[field]), bv=JSON.stringify(base[field]);
        if(lv===rv) return;
        const localChanged=lv!==bv, remoteChanged=rv!==bv;
        if(remoteChanged && !localChanged){ result[field]=remote[field]; return; }
        if(localChanged && !remoteChanged) return;
        if(localChanged && remoteChanged && entityType==='note'){
          // the post-it changes all the time on both devices: its lines are merged, never reported as a conflict
          result[field]=field==='text'?mergeNoteLines(base[field], local[field], remote[field]):field.startsWith('pref_')?mergePrefValue(local[field], remote[field]):((remote.updatedAt||0)>(local.updatedAt||0)?remote[field]:local[field]);
          return;
        }
        // logs only ever grow (calls, notes, steps), ticks are per step: both devices' entries are kept, not one of them
        if(localChanged && remoteChanged && (field==='notesLog' || field==='stageLog') && Array.isArray(local[field]) && Array.isArray(remote[field])){
          const seen=new Set(), all=[]; local[field].concat(remote[field]).forEach(e=>{ const k=JSON.stringify(e); if(!seen.has(k)){ seen.add(k); all.push(e); } });
          result[field]=all.sort((x,y)=>((x&&x.at)||0)-((y&&y.at)||0)); return; }
        if(localChanged && remoteChanged && field==='checks' && local[field] && remote[field] && typeof local[field]==='object' && typeof remote[field]==='object'){
          const m={}; new Set([...Object.keys(remote[field]), ...Object.keys(local[field])]).forEach(k=>{ m[k]=Object.assign({}, remote[field][k]||{}, local[field][k]||{}); });
          result[field]=m; return; }
        // what the app keeps for itself (Excel sends, characteristics file, a date something happened): merged quietly, never a question
        if(localChanged && remoteChanged && SILENT_MERGE.has(field)){
          const l=local[field], r=remote[field], newer=(remote.updatedAt||0)>(local.updatedAt||0);
          if(l && r && typeof l==='object' && typeof r==='object' && !Array.isArray(l) && !Array.isArray(r)) result[field]=newer?Object.assign({}, l, r):Object.assign({}, r, l);
          else if(typeof l==='number' && typeof r==='number') result[field]=Math.max(l, r);
          else result[field]=newer?r:l;
          return; }
        if(localChanged && remoteChanged){
          const takeRemote=(remote.updatedAt||0) > (local.updatedAt||0);
          result[field]=takeRemote?remote[field]:local[field];
          const when=t=>t?' (modifié le '+new Date(t).toLocaleDateString('fr-FR')+')':'';
          logConflict(entityType, result, field, local[field], remote[field], result[field], { a:'Sur cet appareil'+when(local.updatedAt), b:'Venu de ton autre appareil, par la synchro'+when(remote.updatedAt) });
        }
      });
      result.updatedAt=Math.max(local.updatedAt||0, remote.updatedAt||0);
      merged.push(result);
    });

    return merged;
  }
  function stableStringify(o){
    if(o===null || typeof o!=='object') return JSON.stringify(o);
    if(Array.isArray(o)) return '['+o.map(stableStringify).join(',')+']';
    return '{'+Object.keys(o).sort().filter(k=>o[k]!==undefined).map(k=>JSON.stringify(k)+':'+stableStringify(o[k])).join(',')+'}';
  }
  function sameRecords(a, b){
    if(a.length!==b.length) return false;
    const byId={}; b.forEach(r=>{ byId[r.id]=stableStringify(r); });
    return a.every(r=>byId[r.id]===stableStringify(r));
  }
  return { recs, mergePrefValue, mergeNoteLines, SILENT_MERGE, threeWayMerge, stableStringify, sameRecords };
})();
