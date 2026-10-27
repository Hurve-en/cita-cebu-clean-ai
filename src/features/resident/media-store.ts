import type { Cursor } from './live-model';
import type { MediaKind, MediaRow, PendingMedia } from './media-model';
import type { MediaService } from './media-service';
export function createMediaCollection(service:MediaService,owner:string,kind:MediaKind,reportId?:string){
  let state={rows:[] as MediaRow[],pending:[] as PendingMedia[],loading:false,more:false,error:'',notice:'',busy:false};
  let generation=0,active=true;const listeners=new Set<()=>void>();
  function patch(part:Partial<typeof state>){if(active){state={...state,...part};listeners.forEach(l=>l());}}
  async function load(more=false){
    if(!active||state.loading||(more&&!state.more))return;
    const expected=generation;patch({loading:true,error:''});
    try {
      const last=more?state.rows.at(-1):undefined;
      const pending=await service.pending(owner);
      if(!active||generation!==expected)return;
      patch({pending:pending.filter(p=>p.kind===kind&&(kind!=='report_photo'||p.reportId===reportId))});
      const page=await service.list(owner,kind,reportId,last as Cursor|undefined);
      if(!active||generation!==expected)return;
      const ids=new Set(state.rows.map(r=>r.id));
      patch({rows:more?[...state.rows,...page.rows.filter(r=>!ids.has(r.id))]:page.rows,
        pending:pending.filter(p=>p.kind===kind&&(kind!=='report_photo'||p.reportId===reportId)),more:page.more,loading:false});
    }catch(e){if(expected===generation)patch({loading:false,error:e instanceof Error?e.message:'Could not load saved photos.'});}
  }
  async function perform(task:()=>Promise<unknown>,notice:string){
    if(!active||state.busy)return false;const expected=++generation;
    // A pre-mutation list response must not overwrite the refreshed result.
    patch({busy:true,loading:false,error:'',notice:''});
    try {await task();if(active&&expected===generation){patch({notice});await load();return true;}return false;}
    catch(e){if(expected===generation){await load();patch({error:e instanceof Error?e.message:'Photo operation was not confirmed. Retry.'});}return false;}
    finally{if(expected===generation)patch({busy:false});}
  }
  return {
    getSnapshot:()=>state,
    subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
    activate(){active=true;void load();},
    dispose(){active=false;++generation;listeners.clear();state={rows:[],pending:[],loading:false,more:false,error:'',notice:'',busy:false};},
    load,
    retry:(p:PendingMedia)=>perform(()=>service.resume(p),'Photo and record saved.'),
    cancel:(p:PendingMedia)=>perform(()=>service.cancelPending(p),'Upload removed.'),
    remove:(r:MediaRow)=>perform(()=>service.remove(owner,r),'Photo and record removed.'),
    upload:(request:string,uri:string)=>perform(()=>service.save(owner,request,{kind:'report_photo',reportId:reportId!,label:null,score:null,modelVersion:null},uri),'Report photo saved.'),
  };
}
