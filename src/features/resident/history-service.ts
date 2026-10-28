import type {SupabaseClient} from '@supabase/supabase-js';
import {uuid} from './live-model';
import {mediaRow} from './media-model';
import {historyPage,historyCursor,historyKey,type HistoryCursor,type HistoryFilter} from './history-model';
export function historyService(client:SupabaseClient){
 async function token(owner:string){const s=await client.auth.getSession();if(s.error||s.data.session?.user.id!==uuid(owner))throw Error('Your account changed. Reopen History Reports.');return s.data.session.access_token;}
 async function read(owner:string,filter:HistoryFilter,cursor?:HistoryCursor,key?:string){if(!['all','saved','submitted'].includes(filter))throw Error('Invalid history filter.');const c=cursor?historyCursor(cursor):null,t=await token(owner);
 const r=await client.rpc('get_resident_history',{p_cursor_time:c?.time??null,p_cursor_key:c?.key??null,p_filter:filter,p_item_key:key?historyKey(key):null}).setHeader('Authorization',`Bearer ${t}`);await token(owner);
 if(r.error)throw Error('History Reports could not be loaded. Check your connection and retry.');const page=historyPage(r.data,owner);if(key&&(page.items.length>1||page.items.some(i=>i.key!==key)))throw Error('Unexpected history item.');return page;}
 return {async withdraw(owner:string,id:string){const t=await token(owner);const r=await client.rpc('withdraw_pending_scan',{p_media_id:uuid(id)}).setHeader('Authorization',`Bearer ${t}`);await token(owner);if(r.error)throw Error(r.error.code==='22023'?r.error.message:'Deletion could not be confirmed. Retry the same photo.');const row=mediaRow(Array.isArray(r.data)?r.data[0]:r.data,owner);if(row.id!==id||row.kind!=='scan'||!['delete_pending','deleted'].includes(row.state))throw Error('Withdrawal confirmation did not match this photo. Retry.');return row;},page:(owner:string,filter:HistoryFilter,cursor?:HistoryCursor)=>read(owner,filter,cursor),async item(owner:string,key:string){return (await read(owner,'all',undefined,key)).items[0]??null;}};
}
