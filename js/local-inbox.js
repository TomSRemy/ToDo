// Todo — the Outlook macro's inbox without GitHub : the macro writes one file per flagged mail (or « CRM Contact » mail)
// in a folder of this PC (by default OneDrive\ToDo\boite-mail) and the Excel bridge (v1.34) hands them to the app ;
// a file taken (imported or ignored) is moved to « traites » by the bridge. Loaded before js/app.js.
window.TodoLocalInbox=(function(){
  const api={};
  api.init=function(app){
    const { bridgeCall, bridgeInfo }=app;
    let cache=null, at=0;
    const ready=()=>{ const i=bridgeInfo(); return !!i && !!i.who; };   // a bridge that knows the inbox (v1.34+)
    // the folder's files, read once for both lists (tasks, contacts) ; [] without the bridge
    async function all(){
      if(!ready()) return { tasks:[], contacts:[] };
      if(cache && Date.now()-at<3000) return cache;
      try{ const r=await bridgeCall('POST', '/inbox/list', {}, 15000); cache={ tasks:r.tasks||[], contacts:r.contacts||[] }; at=Date.now(); }
      catch(e){ cache={ tasks:[], contacts:[] }; }
      return cache;
    }
    const list=async kind=>(await all())[kind==='contact'?'contacts':'tasks'];
    // taken from the queue : its file leaves the folder (kept 30 days in « traites »)
    async function done(item){
      if(!item || !item._file) return;
      try{ await bridgeCall('POST', '/inbox/done', { files:[item._file] }); cache=null; }catch(e){ /* the bridge will be asked again next time : the item stays seen */ }
    }
    Object.assign(api, { ready, list, done });
  };
  return api;
})();
