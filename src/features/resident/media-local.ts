import { pendingMedia, type MediaSpool, type PendingMedia } from './media-model';
import { uuid } from './live-model';
// Web: persist actual bytes in IndexedDB, not a large base64 localStorage value.
async function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw Error('This browser cannot keep a safe photo retry copy.');
  return new Promise((resolve,reject) => {
    const request=indexedDB.open('cebuclean-pending-media-v1',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('uploads',{keyPath:'key'});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Photo storage could not be opened.'));
  });
}
async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore)=>IDBRequest<T>): Promise<T> {
  const db=await database();
  try { return await new Promise<T>((resolve,reject)=>{
    const tx=db.transaction('uploads',mode),request=action(tx.objectStore('uploads'));let result:T;
    request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(Error('Photo storage failed.'));tx.onabort=()=>reject(Error('Photo storage was interrupted.'));
  }); } finally {db.close();}
}
const key=(owner:string,request:string)=>`${uuid(owner)}/${uuid(request)}`;
type Entry={key:string;pending:PendingMedia;bytes:Uint8Array};
export const mediaSpool: MediaSpool={
  async list(owner){uuid(owner);const entries=await run<Entry[]>('readonly',s=>s.getAll());return entries.filter(e=>e.key.startsWith(owner+'/')).map(e=>pendingMedia(e.pending,owner));},
  async put(p,bytes){pendingMedia(p,p.owner);if(bytes.length!==p.byteSize)throw Error('Photo size mismatch.');await run('readwrite',s=>s.add({key:key(p.owner,p.requestId),pending:p,bytes}));},
  async bytes(owner,request){const e=await run<Entry|undefined>('readonly',s=>s.get(key(owner,request)));if(!e)throw Error('The retry photo is missing from this browser.');return e.bytes;},
  async drop(owner,request){await run('readwrite',s=>s.delete(key(owner,request)));},
};
