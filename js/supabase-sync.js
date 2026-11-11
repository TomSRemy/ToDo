// Todo — équipe (Supabase) : pipeline, contacts, sociétés, rendez-vous partagés entre collègues.
// Chargé après js/storage.js, avant js/app.js. Reste inactif tant qu'aucune configuration (URL +
// clé anonyme du projet) n'est enregistrée : l'appli continue comme avant (GitHub + local), rien
// ne casse pour qui n'est pas encore migré. Deux instances possibles (beta perso / prod équipe),
// chacune avec son propre projet Supabase : la config dit laquelle, jamais codée en dur ici.
//
// Pas encore branché sur les écrans ni sur saveCrm() : étape suivante, une fois un projet réel
// (au moins beta) créé et testé contre le schéma de supabase/schema.sql.
window.TodoTeam=(function(){
  const SDK_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  const CONFIG_KEY='team-config';   // { url, anonKey } — jamais commité, saisi dans Réglages, gardé par window.storage
  const TABLES=['opportunities','contacts','companies','meetings','team_settings'];
  let client=null, session=null, sdkPromise=null;
  const liveState={};   // table -> SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED

  async function loadConfig(){
    try{ const r=await window.storage.get(CONFIG_KEY); return r&&r.value?JSON.parse(r.value):null; }catch(e){ return null; }
  }
  async function saveConfig(cfg){
    try{ await window.storage.set(CONFIG_KEY, JSON.stringify(cfg||{})); return true; }catch(e){ return false; }
  }

  function loadSdk(){
    if(window.supabase) return Promise.resolve();
    if(sdkPromise) return sdkPromise;
    sdkPromise=new Promise((res,rej)=>{
      const s=document.createElement('script'); s.src=SDK_URL;
      s.onload=res; s.onerror=()=>rej(new Error('Bibliothèque Supabase introuvable (réseau ?)'));
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  // à appeler une fois au démarrage (sans effet si pas configuré) ; renvoie le client, ou null
  async function init(){
    if(client) return client;
    const cfg=cleanConfig(await loadConfig());
    if(!cfg) return null;
    await loadSdk();
    client=window.supabase.createClient(cfg.url, cfg.anonKey, { auth:{ persistSession:true, autoRefreshToken:true } });
    const { data }=await client.auth.getSession();
    session=data && data.session;
    if(session) client.realtime.setAuth(session.access_token);
    // the live channels read with the signed-in person's rights (the tables are closed to anonymous readers) :
    // they get the token at sign-in and at each refresh, not only the anonymous key
    client.auth.onAuthStateChange((_evt, s)=>{ session=s; if(s) client.realtime.setAuth(s.access_token); });
    return client;
  }

  // a header only takes plain ASCII : a character pasted by mistake (typographic quote, invisible space) or a password
  // a browser filled in by itself (Edge did, in the key field) made « String contains non ISO-8859-1 code point »
  const clean=v=>String(v||'').replace(/[^\x21-\x7E]/g,'');
  function cleanConfig(cfg){
    if(!cfg) return null;
    const url=clean(cfg.url).replace(/\/+$/,''), anonKey=clean(cfg.anonKey);
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(anonKey) ? { url, anonKey } : null;
  }
  function isConfigured(){ return !!client; }
  function isSignedIn(){ return !!session; }
  function currentUser(){ return session && session.user; }

  // comptes créés à la main par l'admin (dashboard Supabase), jamais d'inscription ni de mail envoyé
  // par l'appli : aucune dépendance à un service d'envoi d'email ni à un domaine vérifié
  async function signIn(email, password){
    if(!client) await init();
    if(!client) throw new Error('Synchro équipe non configurée (Réglages › Synchro équipe)');
    const { data, error }=await client.auth.signInWithPassword({ email, password });
    if(error) throw error;
    session=data && data.session;
    return session;
  }
  async function signOut(){ if(client) await client.auth.signOut(); session=null; }

  // app <-> ligne de table : les champs connus restent des colonnes (filtrage/index), le reste
  // (toute la forme libre existante) va dans `data` sans rien perdre
  const ROW_COLS={
    opportunities: o=>({ kind:o.kind||'installation', company:o.company||null, stage:o.stage||null, request_id:o.requestId||null }),
    contacts: o=>({ company:o.company||null }),
    companies: o=>({ name:o.name||null }),
    meetings: o=>({ contact_id:o.contactId||null })
  };
  function rowToItem(row){
    return Object.assign({}, row.data, { id:row.id, deleted:!!row.deleted, updatedAt:+new Date(row.updated_at), createdAt:+new Date(row.created_at) });
  }
  function itemToRow(table, item){
    const rest=Object.assign({}, item);   // le reste (tout sauf les colonnes posées par la base) part dans `data`
    delete rest.id; delete rest.deleted; delete rest.updatedAt; delete rest.createdAt;
    const row={ id:item.id, deleted:!!item.deleted, data:rest };
    const cols=ROW_COLS[table]; if(cols) Object.assign(row, cols(item));
    return row;
  }

  async function pullAll(table){
    if(!client) return null;
    const { data, error }=await client.from(table).select('*');
    if(error) throw error;
    return data.map(rowToItem);
  }

  async function pushItem(table, item){
    if(!client) return false;
    const { error }=await client.from(table).upsert(itemToRow(table, item));
    if(error) throw error;
    return true;
  }

  // vraie suppression (pas `deleted:true`) : un contact rendu privé ne doit plus rester dans la base d'équipe
  // with the team rules, only the author of a row can delete it for good : a refused delete raises no error, it just
  // deletes nothing. Returns 'deleted', 'gone' (already not there) or 'refused' (someone else's row).
  async function removeItem(table, id){
    if(!client) return 'gone';
    const { data, error }=await client.from(table).delete().eq('id', id).select('id');
    if(error) throw error;
    if(data && data.length) return 'deleted';
    const { data:still, error:e2 }=await client.from(table).select('id').eq('id', id);
    if(e2) throw e2;
    return still && still.length ? 'refused' : 'gone';
  }

  // the history of one row (written by the database itself) : the last changes, with who made them
  let names=null;
  async function history(table, id, limit){
    if(!client || !session) return null;
    const { data, error }=await client.from('change_log').select('field, old_value, new_value, changed_by, changed_at').eq('entity_type', table).eq('entity_id', id).order('changed_at', { ascending:false }).limit(limit||40);
    if(error) throw error;
    if(!names){ const r=await client.from('profiles').select('id, display_name'); names={}; (r.data||[]).forEach(p=>{ names[p.id]=p.display_name||''; }); }
    const me=session.user && session.user.id;
    return (data||[]).map(x=>Object.assign({}, x, { who:x.changed_by===me?'Toi':(names[x.changed_by]||'Un collègue') }));
  }

  // an error met on a colleague's device, sent to the team base (client_errors) so that it can be seen and fixed
  async function reportError(row){
    if(!client || !session) return false;
    const { error }=await client.from('client_errors').insert({ where_:row.where, message:row.message, stack:row.stack, app_version:row.version, user_agent:navigator.userAgent.slice(0,200) });
    return !error;
  }

  // the errors met by the whole team (client_errors), the most recent first, with who met them
  async function teamErrors(sinceMs, limit){
    if(!client || !session) return null;
    const { data, error }=await client.from('client_errors').select('at, where_, message, user_id, app_version').gte('at', new Date(sinceMs).toISOString()).order('at', { ascending:false }).limit(limit||50);
    if(error) throw error;
    if(!names){ const r=await client.from('profiles').select('id, display_name'); names={}; (r.data||[]).forEach(p=>{ names[p.id]=p.display_name||''; }); }
    const me=session.user && session.user.id;
    return (data||[]).map(x=>Object.assign({}, x, { who:x.user_id===me?'Toi':(names[x.user_id]||'Un collègue') }));
  }

  // un canal temps réel par table ; onChange(item, 'INSERT'|'UPDATE'|'DELETE') pour fusionner dans
  // les tableaux en mémoire et redessiner, sans attendre un rechargement
  function subscribe(table, onChange){
    if(!client) return ()=>{};
    let ch=null, stopped=false, wait=2000;
    const open=()=>{
      ch=client.channel('team-'+table)
        .on('postgres_changes', { event:'*', schema:'public', table }, payload=>{
          const row=payload.new || payload.old; if(!row) return;
          onChange(rowToItem(row), payload.eventType);
        }).subscribe((status, err)=>{
          liveState[table]=status; console.log('[team realtime]', table, status, err||'');
          if(status==='SUBSCRIBED') wait=2000;
          // a dropped channel comes back by itself (2 s, then up to 1 min between tries)
          if((status==='CHANNEL_ERROR' || status==='TIMED_OUT') && !stopped){ const c=ch; setTimeout(()=>{ if(stopped) return; client.removeChannel(c); open(); }, wait); wait=Math.min(wait*2, 60000); }
        });
    };
    open();
    return ()=>{ stopped=true; if(ch) client.removeChannel(ch); };
  }

  // migration one-shot : reprend ce que l'appli a localement (window.storage) et le pousse en
  // Supabase, table par table. À lancer une fois, à la main, une fois le projet configuré — jamais
  // automatiquement (on ne veut pas écraser des données d'équipe déjà réelles par erreur).
  async function migrateFromLocal(keys){
    if(!client) throw new Error('Synchro équipe non configurée');
    const map={ companies:'todo-widget-companies', contacts:'todo-widget-contacts', meetings:'todo-widget-meetings', opportunities:'todo-widget-opportunities' };
    const report={};
    for(const table of Object.keys(map)){
      const r=await window.storage.get(map[table]);
      const items=r&&r.value?JSON.parse(r.value):[];
      let ok=0, fail=0;
      for(const item of items){ if(table==='contacts' && item.private) continue;   // privé : jamais envoyé à l'équipe
        try{ await pushItem(table, item); ok++; }catch(e){ fail++; console.error('[migrateFromLocal]', table, item.id, e); } }
      report[table]={ total:items.length, ok, fail };
    }
    return report;
  }

  return { TABLES, init, loadConfig, saveConfig, isConfigured, isSignedIn, currentUser, signIn, signOut, pullAll, pushItem, removeItem, history, reportError, teamErrors, subscribe, liveState:()=>Object.assign({}, liveState), cleanConfig, migrateFromLocal };
})();
