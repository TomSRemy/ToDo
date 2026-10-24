// Share target: a link or text shared to the app becomes a task (kept out of the page so the page can forbid inline scripts)
  if(!window.storage){
    window.storage = {
      async get(key){ try{ const v=localStorage.getItem('todo_'+key); return v!==null?{key,value:v,shared:false}:null; }catch(e){ return null; } },
      async set(key,value){ try{ localStorage.setItem('todo_'+key,value); return {key,value,shared:false}; }catch(e){ return null; } }
    };
  }

  (async function(){
    const params = new URLSearchParams(location.search);
    const sharedTitle = (params.get('title') || '').trim();
    const sharedText = (params.get('text') || '').trim();
    const sharedUrl = (params.get('url') || '').trim();

    // Best-effort title: prefer the share's title, fall back to the first line of text, else a generic label
    let title = sharedTitle || (sharedText.split('\n')[0] || '').slice(0, 120) || 'Tâche depuis partage';
    let description = sharedText && sharedText !== title ? sharedText : '';
    let link = sharedUrl;
    // If a URL got shared inside the text body instead of the url param, keep it as link too
    if(!link){
      const m = sharedText.match(/https?:\/\/\S+/);
      if(m) link = m[0];
    }

    const TASKS_KEY = 'todo-widget-tasks';
    let tasks = [];
    try{ const r = await window.storage.get(TASKS_KEY, false); tasks = r && r.value ? JSON.parse(r.value) : []; }catch(e){}

    tasks.push({
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      title: title,
      description: description,
      client: '', project: '',
      urgency: 'moyenne', status: 'a_faire',
      due: '', reminder: '', link: link,
      recur: null, subtasks: [],
      archived: false, archivedAt: null, deleted: false,
      createdAt: Date.now(), updatedAt: Date.now()
    });

    try{ await window.storage.set(TASKS_KEY, JSON.stringify(tasks), false); }catch(e){}

    document.getElementById('spinner').style.display = 'none';
    document.getElementById('msg').textContent = 'Tâche ajoutée ✓';
    document.getElementById('sub').textContent = title;
    setTimeout(()=>{ location.href = 'index.html'; }, 900);
  })();
