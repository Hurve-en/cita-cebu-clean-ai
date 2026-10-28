import {uuid} from './live-model';
import type {HistoryItem} from './history-model';
import {pendingKey,type PendingStorage} from '../rewards/rewards-model';
export const WITHDRAWAL_NOTE='Withdrawn by resident; no points awarded';
export function canDeletePendingScan(item:HistoryItem){return item.kind==='scan'&&item.event_id===null&&item.points===0&&item.photo!==null&&(item.status==='checking'||(item.photo.state==='delete_pending'&&item.note===WITHDRAWAL_NOTE));}
// Only called after the backend confirms withdrawal AND Storage confirms removal.
// Foreign/unrelated or damaged local data is preserved rather than guessed at.
export function clearDeletedPhotoDrafts(storage:PendingStorage,owner:string,id:string){
 uuid(owner);uuid(id);
 const formKey=`cebu-photo-form-v1:${owner}`,rawForm=storage.getItem(formKey);
 if(rawForm){const form=JSON.parse(rawForm);if(form.version===1&&form.owner===owner&&form.photo===id)storage.removeItem(formKey);}
 const key=pendingKey(owner),raw=storage.getItem(key);
 if(raw){const command=JSON.parse(raw);if(command.version===1&&command.owner===owner&&command.operation==='submit_disposal_claim'&&command.args?.p_before_id===id)storage.removeItem(key);}
}
