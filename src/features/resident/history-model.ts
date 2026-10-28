import {uuid} from './live-model';
import {mediaRow,type MediaRow} from './media-model';
export type HistoryFilter='all'|'saved'|'submitted';
export type HistoryCursor={time:string;key:string};
export type HistoryItem={key:string;owner_id:string;kind:'scan'|'report'|'claim'|'event';id:string;occurred_at:string;title:string;status:string;note:string;description:string;location:string;points:number;submitted:boolean;photo:MediaRow|null;event_id:string|null};
export type HistoryPage={items:HistoryItem[];more:boolean;next_cursor:HistoryCursor|null};
const states:Record<HistoryItem['kind'],string[]>={scan:['saved','uploading','delete_pending','checking','pending','review','approved','rejected'],report:['pending_review','in_progress','resolved'],claim:['pending','approved','rejected'],event:['joined','completed','rejected','cancelled']};
export function historyKey(v:unknown):string{if(typeof v!=='string'||!/^(scan|report|claim|event):[0-9a-f-]{36}$/.test(v))throw Error('Invalid history reference.');uuid(v.split(':')[1]);return v;}
export function historyCursor(v:unknown):HistoryCursor{const c=v as HistoryCursor;if(!c||typeof c.time!=='string'||!Number.isFinite(Date.parse(c.time)))throw Error('Invalid history cursor.');historyKey(c.key);return {time:c.time,key:c.key};}
export function historyItem(v:unknown,owner:string):HistoryItem{const r=v as HistoryItem;
 if(!r||r.owner_id!==uuid(owner)||!Object.hasOwn(states,r.kind)||r.key!==`${r.kind}:${uuid(r.id)}`||typeof r.occurred_at!=='string'||!Number.isFinite(Date.parse(r.occurred_at))||!states[r.kind].includes(r.status)||typeof r.submitted!=='boolean'||!Number.isSafeInteger(r.points)||r.points<0||r.points>1000000)throw Error('History response could not be verified.');
 historyKey(r.key);for(const k of ['title','note','description','location'] as const)if(typeof r[k]!=='string'||r[k].length>2000)throw Error('Invalid history details.');
 if(r.event_id!==null)uuid(r.event_id);if(r.photo!==null){mediaRow(r.photo,owner);if(r.kind==='scan'&&(r.photo.id!==r.id||r.photo.kind!=='scan'||r.photo.state==='deleted'))throw Error('Unexpected history photo.');}
 if(r.kind==='scan'&&((!r.submitted&&(!['saved','uploading','delete_pending'].includes(r.status)||r.points!==0))||(r.submitted&&['saved','uploading','delete_pending'].includes(r.status))))throw Error('Contradictory scan history.');
 return r;
}
function instant(v:string){const fraction=v.match(/[.](\d+)/)?.[1]??'';return BigInt(Date.parse(v))*1000n+BigInt((fraction+'000000').slice(3,6));}
export function historyPage(v:unknown,owner:string):HistoryPage{const p=v as HistoryPage;if(!p||!Array.isArray(p.items)||p.items.length>20||typeof p.more!=='boolean'||(p.more?(p.items.length!==20||!p.next_cursor):p.next_cursor!==null))throw Error('Invalid history page.');
 const items=p.items.map(i=>historyItem(i,owner));if(new Set(items.map(i=>i.key)).size!==items.length)throw Error('Duplicate history entries.');
 for(let i=1;i<items.length;i++){const a=items[i-1],b=items[i];if(instant(a.occurred_at)<instant(b.occurred_at)||(instant(a.occurred_at)===instant(b.occurred_at)&&a.key<=b.key))throw Error('History order could not be verified.');}
 const next=p.next_cursor?historyCursor(p.next_cursor):null;if(next&&(Date.parse(next.time)!==Date.parse(items.at(-1)!.occurred_at)||next.key!==items.at(-1)!.key))throw Error('History cursor mismatch.');return {items,more:p.more,next_cursor:next};
}
export function historyStatus(r:HistoryItem){if(r.photo?.state==='delete_pending'&&r.note==='Withdrawn by resident; no points awarded')return 'Deletion unfinished';if(r.status==='review'&&!r.event_id)return 'Needs attention';return ({saved:'Saved draft',uploading:'Save incomplete',delete_pending:'Removal unfinished',checking:'AI check pending',pending:'Awaiting review',review:'Awaiting review',approved:'Verified',rejected:'Not approved',pending_review:'Report received',in_progress:'In progress',resolved:'Resolved',joined:'Registered',completed:'Participation verified',cancelled:'Cancelled'} as Record<string,string>)[r.status]??r.status;}
