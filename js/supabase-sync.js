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
    const cfg=await loadConfig();
    if(!cfg || !cfg.url || !cfg.anonKey) return null;
    await loadSdk();
    client=window.supabase.createClient(cfg.url, cfg.anonKey, { auth:{ persistSession:true, autoRefreshToken:true } });
    const { data }=await client.auth.getSession();
    session=data && data.session;
    client.auth.onAuthStateChange((_evt, s)=>{ session=s; });
    return client;
  }

  function isConfigured(){ return !!client; }
  function isSignedIn(){ return !!session; }
  function currentUser(){ return session && session.user; }

  async function sendMagicLink(email){
    if(!client) await init();
    if(!client) throw new Error('Synchro équipe non configurée (Réglages › Synchro équipe)');
    const { error }=await client.auth.signInWithOtp({ email, options:{ emailRedirectTo: location.href.split('#')[0] } });
    if(error) throw error;
  }
  // code à 6 chiffres du même mail, tapé dans l'appli : marche quel que soit le navigateur qui ouvre le
  // mail (pas de lien à cliquer, donc pas de risque d'atterrir dans un autre navigateur que celui de l'appli)
  async function verifyCode(email, code){
    if(!client) await init();
    if(!client) throw new Error('Synchro équipe non configurée (Réglages › Synchro équipe)');
    const { data, error }=await client.auth.verifyOtp({ email, token:code.trim(), type:'email' });
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

  // un canal temps réel par table ; onChange(item, 'INSERT'|'UPDATE'|'DELETE') pour fusionner dans
  // les tableaux en mémoire et redessiner, sans attendre un rechargement
  function subscribe(table, onChange){
    if(!client) return ()=>{};
    const ch=client.channel('team-'+table)
      .on('postgres_changes', { event:'*', schema:'public', table }, payload=>{
        const row=payload.new || payload.old; if(!row) return;
        onChange(rowToItem(row), payload.eventType);
      }).subscribe();
    return ()=>client.removeChannel(ch);
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
      for(const item of items){ try{ await pushItem(table, item); ok++; }catch(e){ fail++; console.error('[migrateFromLocal]', table, item.id, e); } }
      report[table]={ total:items.length, ok, fail };
    }
    return report;
  }

  return { TABLES, init, loadConfig, saveConfig, isConfigured, isSignedIn, currentUser, sendMagicLink, verifyCode, signOut, pullAll, pushItem, subscribe, migrateFromLocal };
})();
