// Todo — « Clips » : coller une capture d'écran sur une tâche (loaded before js/app.js). Split out like js/parc.js.
// Gardées en IndexedDB sur cet appareil UNIQUEMENT (clé « todo-clips », pas dans les fichiers synchronisés sur GitHub) :
// une image collée pèse largement plus qu'une fiche entière, et chaque synchro est un commit gardé pour toujours (README).
window.TodoClips=(function(){
  let map=null, loading=null;
  async function load(){
    if(map) return map;
    if(!loading) loading=(async()=>{ const v=await window.storage.get('todo-clips'); try{ map=v?JSON.parse(v.value):{}; }catch(e){ map={}; } return map; })();
    return loading;
  }
  function save(){ return window.storage.set('todo-clips', JSON.stringify(map||{})); }
  function fileToDataUrl(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }

  // Mounts a paste zone + thumbnails for one record (a task, later a CRM fiche) into `root`. Call again after the record changes id.
  async function mount(root, recordId){
    root.innerHTML='';
    const label=document.createElement('label'); label.className='clips-label'; label.textContent='Clips';
    const thumbs=document.createElement('div'); thumbs.className='clips-thumbs';
    const zone=document.createElement('div'); zone.className='clips-zone'; zone.tabIndex=0;
    zone.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg><span>Ctrl+V pour coller une capture</span>';
    root.append(label, thumbs, zone);

    await load();
    function paint(){
      thumbs.innerHTML='';
      (map[recordId]||[]).forEach(c=>{
        const t=document.createElement('div'); t.className='clip-thumb';
        t.innerHTML='<img src="'+c.dataUrl+'" alt="'+(c.name||'capture').replace(/"/g,'')+'"><button type="button" class="clip-del" title="Retirer">×</button>';
        t.querySelector('.clip-del').onclick=async()=>{ map[recordId]=(map[recordId]||[]).filter(x=>x.id!==c.id); await save(); paint(); };
        thumbs.appendChild(t);
      });
    }
    paint();

    async function addFile(file){
      if(!file || !/^image\//.test(file.type)) return;
      const dataUrl=await fileToDataUrl(file);
      map[recordId]=map[recordId]||[];
      map[recordId].push({ id:'clip_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name:file.name||'capture.png', dataUrl, addedAt:Date.now() });
      await save(); paint();
    }
    zone.addEventListener('paste', e=>{
      const items=(e.clipboardData && e.clipboardData.items)||[];
      [...items].forEach(it=>{ if(it.kind==='file'){ const f=it.getAsFile(); if(f) addFile(f); } });
    });
    zone.addEventListener('dragover', e=>{ e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', ()=>zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e=>{ e.preventDefault(); zone.classList.remove('drag-over'); [...(e.dataTransfer.files||[])].forEach(addFile); });
  }
  const api={};
  api.init=function(){};   // nothing from js/app.js needed yet — kept for the same shape as the other modules
  api.mount=mount;
  return api;
})();
