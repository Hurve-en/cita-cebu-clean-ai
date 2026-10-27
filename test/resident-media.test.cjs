/* global __dirname: readonly */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'cebu-media-'));
for(const name of ['live-model','media-model','media-service','media-store'])fs.writeFileSync(path.join(output,name+'.js'),ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/features/resident',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
after(()=>fs.rmSync(output,{recursive:true,force:true}));
const {pendingMedia,mediaRow,mediaPath,MODEL_VERSION}=require(path.join(output,'media-model.js'));
const {createMediaService,MediaError}=require(path.join(output,'media-service.js'));
const {createMediaCollection}=require(path.join(output,'media-store.js'));
const A='cf100000-0000-4000-8000-000000000001',B='cf100000-0000-4000-8000-000000000002',K='cf500000-0000-4000-8000-000000000001',R='cf300000-0000-4000-8000-000000000001';
const bytes=Uint8Array.from([255,216,255,1,2]);
const draft={kind:'scan',reportId:null,label:'glass',score:'0.90000000',modelVersion:MODEL_VERSION};
const pending={version:1,owner:A,requestId:K,...draft,byteSize:5,createdAt:'2026-10-27T00:00:00Z'};
const clone=v=>JSON.parse(JSON.stringify(v));
function spool(){const data=new Map(),calls=[];return{data,calls,async list(owner){calls.push('list');return [...data.values()].filter(v=>v.pending.owner===owner).map(v=>clone(v.pending));},async put(p,b){calls.push('put');assert.equal(data.has(p.requestId),false);data.set(p.requestId,{pending:clone(p),bytes:b.slice()});},async bytes(o,k){calls.push('bytes');const e=data.get(k);if(!e||e.pending.owner!==o)throw Error('missing');return e.bytes.slice();},async drop(o,k){calls.push('drop');const e=data.get(k);if(e?.pending.owner===o)data.delete(k);}};}
function fixture(){
 const local=spool(),rows=new Map(),objects=new Map(),calls=[];let owner=A,count=0,uploads=0,failUpload=false,loseUpload=false,loseFinalize=false,failFinalize=false,failRemove=false;
 const source={auth:{getSession:async()=>({data:{session:owner?{user:{id:owner},access_token:'token-'+owner}:null},error:null})}};
 const scoped=token=>{const actor=token.slice(6);return{
  rpc:async(name,args)=>{calls.push({name,args:clone(args),actor});let row;
   if(name==='cancel_resident_media_request'){
    row=rows.get(args.p_request_id);if(!row){row={id:'cf600000-0000-4000-8000-999999999999',owner_id:actor,request_id:args.p_request_id,kind:args.p_kind,report_id:null,label:null,score:null,model_version:null,byte_size:1,state:'deleted',created_at:'2026-10-27T00:00:00Z',ready_at:null};rows.set(row.request_id,row);}else if(row.state!=='deleted')row.state='delete_pending';
   }else if(name==='prepare_resident_media'){
    assert.ok(local.data.has(args.p_request_id),'local snapshot must precede remote prepare');
    row=rows.get(args.p_request_id);if(!row){row={id:`cf600000-0000-4000-8000-${String(++count).padStart(12,'0')}`,owner_id:actor,request_id:args.p_request_id,kind:args.p_kind,report_id:args.p_report_id,label:args.p_label,score:args.p_score,model_version:args.p_model_version,byte_size:args.p_byte_size,state:'uploading',created_at:'2026-10-27T00:00:00Z',ready_at:null};rows.set(row.request_id,row);}
   }else{row=[...rows.values()].find(r=>r.id===args.p_id&&r.owner_id===actor);if(!row)return{data:null,error:{code:'42501'}};
    if(name==='finalize_resident_media'){
     if(failFinalize)return{data:null,error:{code:'22023',message:'bad upload metadata'}};
     if(row.state!=='ready'){if(!objects.has(mediaPath(row)))return{data:null,error:{code:'P0002'}};row.state='ready';row.ready_at='2026-10-27T00:01:00Z';}
     if(loseFinalize){loseFinalize=false;throw Error('response lost after commit');}
    }else if(name==='begin_resident_media_delete'){if(row.state!=='deleted')row.state='delete_pending';}
    else if(name==='finish_resident_media_delete'){
     if(objects.has(mediaPath(row)))return{data:null,error:{code:'22023',message:'object still exists'}};
     row.state='deleted';row.label=null;row.score=null;row.model_version=null;row.report_id=null;row.ready_at=null;
    }
   }
   return{data:clone(row),error:null};
  },
  storage:{from:bucket=>({
   upload:async(p,b,opts)=>{uploads++;assert.ok(b instanceof ArrayBuffer);calls.push({name:'upload',actor,bucket,path:p,options:opts});assert.equal(opts.upsert,false);assert.equal(opts.contentType,'image/jpeg');if(failUpload)return{error:{message:'offline'}};if(objects.has(p))return{error:{message:'duplicate'}};objects.set(p,b.slice());if(loseUpload)throw Error('upload response lost');return{error:null};},
   remove:async(paths)=>{calls.push({name:'remove',actor,paths});if(failRemove)return{error:{message:'offline'}};for(const p of paths)objects.delete(p);return{error:null};},
   createSignedUrl:async(p,ttl)=>{calls.push({name:'url',actor,ttl});return{data:{signedUrl:'https://example.test/private'},error:null};},
  })},
 };};
 const service=createMediaService(source,scoped,local,async()=>bytes.slice());
 return{service,local,rows,objects,calls,uploads:()=>uploads,setOwner:v=>{owner=v;},failUpload:()=>{failUpload=true;},restoreUpload:()=>{failUpload=false;},loseUpload:()=>{loseUpload=true;},loseFinalize:()=>{loseFinalize=true;},failFinalize:()=>{failFinalize=true;},failRemove:()=>{failRemove=true;},restoreRemove:()=>{failRemove=false;}};
}
test('media decoders reject foreign ownership, bad states, labels, models and paths',()=>{
 assert.equal(pendingMedia(pending,A).requestId,K);
 for(const patch of [{owner:B},{requestId:'../x'},{byteSize:2097153},{score:'NaN'},{label:'hazardous'},{modelVersion:'other'}])assert.throws(()=>pendingMedia({...pending,...patch},A));
 assert.throws(()=>mediaRow({owner_id:B},A));assert.throws(()=>mediaPath({owner_id:A,id:'../escape'}));
});
test('photo bytes and retry metadata persist before preparation and confirmed saving clears local copy',async()=>{
 const f=fixture();const r=await f.service.save(A,K,draft,'file:photo');assert.equal(r.state,'ready');assert.equal(f.uploads(),1);assert.equal(f.local.data.size,0);assert.equal(f.rows.size,1);
 assert.deepEqual(Object.keys(f.calls.find(c=>c.name==='prepare_resident_media').args).sort(),['p_request_id','p_kind','p_report_id','p_label','p_score','p_model_version','p_byte_size'].sort());
});
test('offline upload retains original snapshot; resume creates one record and one object',async()=>{
 const f=fixture();f.failUpload();await assert.rejects(()=>f.service.save(A,K,draft,'file:photo'));assert.equal(f.local.data.size,1);assert.equal([...f.rows.values()][0].state,'uploading');f.restoreUpload();await f.service.resume((await f.service.pending(A))[0]);assert.equal(f.rows.size,1);assert.equal(f.objects.size,1);assert.equal(f.local.data.size,0);
});
test('lost upload response is confirmed on retry without a second byte upload',async()=>{
 const f=fixture();f.loseUpload();await assert.rejects(()=>f.service.save(A,K,draft,'file:photo'));assert.equal(f.objects.size,1);const r=await f.service.resume((await f.service.pending(A))[0]);assert.equal(r.state,'ready');assert.equal(f.uploads(),1);assert.equal(f.rows.size,1);
});
test('lost final confirmation is replayed without duplicating result or bytes',async()=>{
 const f=fixture();f.loseFinalize();await assert.rejects(()=>f.service.save(A,K,draft,'file:photo'));assert.equal([...f.rows.values()][0].state,'ready');await f.service.resume((await f.service.pending(A))[0]);assert.equal(f.rows.size,1);assert.equal(f.uploads(),1);
});
test('storage failure before prepare makes no remote write',async()=>{
 const f=fixture();f.local.put=async()=>{throw Error('disk full');};await assert.rejects(()=>f.service.save(A,K,draft,'file:photo'));assert.equal(f.calls.length,0);
});
test('damaged local bytes do not upload; original snapshot remains available for cancel',async()=>{
 const f=fixture();f.failUpload();await assert.rejects(()=>f.service.save(A,K,draft,'file:photo'));f.restoreUpload();f.local.data.get(K).bytes=Uint8Array.from([1,2,3,4,5]);await assert.rejects(async()=>f.service.resume((await f.service.pending(A))[0]));assert.equal(f.uploads(),1);assert.equal(f.local.data.size,1);await f.service.cancelPending((await f.service.pending(A))[0]);assert.equal(f.local.data.size,0);
});
test('changed pending payload does not silently replace an upload key',async()=>{
 const f=fixture();f.failUpload();await assert.rejects(()=>f.service.save(A,K,draft,'file:photo'));const calls=f.calls.length;await assert.rejects(()=>f.service.save(A,K,{...draft,label:'metal'},'file:other'));assert.equal(f.calls.length,calls);assert.equal(f.local.data.get(K).pending.label,'glass');
});
test('switching sessions prevents preparation and uses no later account token',async()=>{
 const f=fixture();f.setOwner(B);await assert.rejects(()=>f.service.save(A,K,draft,'file:photo'));assert.equal(f.calls.length,0);
});
test('switching accounts during upload stops subsequent finalize and keeps original owner retry',async()=>{
 const f=fixture();const original=f.local.bytes;f.local.bytes=async(o,k)=>{const b=await original(o,k);f.setOwner(B);return b;};await assert.rejects(()=>f.service.save(A,K,draft,'file:photo'));assert.equal(f.uploads(),0);assert.equal(f.local.data.size,1);assert.ok(f.calls.every(c=>c.actor===A));
});
test('metadata finalization failures never report save success or clear retry copy',async()=>{
 const f=fixture();f.failFinalize();await assert.rejects(()=>f.service.save(A,K,draft,'file:photo'));assert.equal(f.local.data.size,1);assert.notEqual([...f.rows.values()][0].state,'ready');
});
test('remove calls begin, Storage API, then finish and scrubs result',async()=>{
 const f=fixture();const row=await f.service.save(A,K,draft,'file:photo');f.calls.length=0;await f.service.remove(A,row);assert.deepEqual(f.calls.map(c=>c.name),['begin_resident_media_delete','remove','finish_resident_media_delete']);assert.equal(f.objects.size,0);assert.equal([...f.rows.values()][0].state,'deleted');assert.equal([...f.rows.values()][0].label,null);
});
test('deletion does not allow a stale retry to resurrect removed data',async()=>{
 const f=fixture();const row=await f.service.save(A,K,draft,'file:photo');await f.service.remove(A,row);await f.local.put(pending,bytes);await assert.rejects(()=>f.service.resume(pending));assert.equal(f.objects.size,0);assert.equal([...f.rows.values()][0].state,'deleted');assert.equal(f.local.data.size,0);
});
test('local cleanup failure retains a discoverable pending item and replay uses existing server record',async()=>{
 const f=fixture();const drop=f.local.drop;f.local.drop=async()=>{throw Error('busy disk');};await assert.rejects(()=>f.service.save(A,K,draft,'file:photo'));assert.equal([...f.rows.values()][0].state,'ready');assert.equal(f.local.data.size,1);f.local.drop=drop;await f.service.resume(pending);assert.equal(f.rows.size,1);assert.equal(f.uploads(),1);
});
test('private photo links are short lived, owner scoped and not stored locally',async()=>{
 const f=fixture();const row=await f.service.save(A,K,draft,'file:photo');await f.service.signedUrl(A,row);assert.equal(f.calls.at(-1).ttl,60);await assert.rejects(()=>f.service.signedUrl(B,row));assert.equal(f.local.data.size,0);
});
const tick=()=>new Promise(r=>setImmediate(r));
const wait=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
test('collection logout/disposal clears private rows and ignores delayed responses',async()=>{
 const d=wait();const store=createMediaCollection({list:()=>d.promise,pending:async()=>[]},A,'scan');store.activate();await tick();store.dispose();d.resolve({rows:[{id:R}],more:false});await tick();assert.deepEqual(store.getSnapshot().rows,[]);
});
test('offline collection exposes local retries and error instead of successful empty history',async()=>{
 const store=createMediaCollection({list:async()=>{throw Error('offline');},pending:async()=>[pending]},A,'scan');store.activate();await tick();assert.equal(store.getSnapshot().pending.length,1);assert.equal(store.getSnapshot().error,'offline');assert.equal(store.getSnapshot().loading,false);
});
test('collection deduplicates page boundaries and keeps failed pagination retryable',async()=>{
 let n=0;const service={pending:async()=>[],list:async()=>{n++;if(n===2)throw Error('offline');return n===1?{rows:[{id:K}],more:true}:{rows:[{id:K},{id:R}],more:false};}};const store=createMediaCollection(service,A,'scan');store.activate();await tick();await store.load(true);assert.equal(store.getSnapshot().more,true);await store.load(true);assert.deepEqual(store.getSnapshot().rows.map(r=>r.id),[K,R]);
});
test('report photo retry copies are scoped to their owned report',async()=>{
 const store=createMediaCollection({pending:async()=>[{...pending,kind:'report_photo',reportId:R},{...pending,requestId:R,kind:'report_photo',reportId:K}],list:async()=>({rows:[],more:false})},A,'report_photo',R);store.activate();await tick();assert.equal(store.getSnapshot().pending.length,1);assert.equal(store.getSnapshot().pending[0].reportId,R);
});

test('a local-only rejected upload can be cancelled without preparation or a quota reservation',async()=>{const f=fixture();await f.local.put(pending,bytes);await f.service.cancelPending(pending);assert.equal(f.local.data.size,0);assert.equal(f.rows.get(K).state,'deleted');assert.ok(!f.calls.some(c=>c.name==='prepare_resident_media'));});

test('a stale pre-mutation list cannot undo a successful confirmation refresh',async()=>{const delayed=wait();let n=0;const ready={id:R,state:'ready'},service={pending:async()=>[],list:async()=>{n++;return n===1?delayed.promise:{rows:[ready],more:false};},resume:async()=>ready};const store=createMediaCollection(service,A,'scan');store.activate();await tick();await store.retry(pending);delayed.resolve({rows:[{id:R,state:'uploading'}],more:false});await tick();assert.equal(store.getSnapshot().rows[0].state,'ready');});

test('interrupted Storage removal remains retryable and cannot hide a remaining object',async()=>{const f=fixture();const row=await f.service.save(A,K,draft,'file:photo');f.failRemove();await assert.rejects(()=>f.service.remove(A,row));assert.equal(f.rows.get(K).state,'delete_pending');assert.equal(f.objects.size,1);assert.ok(!f.calls.some(c=>c.name==='finish_resident_media_delete'));f.restoreRemove();await f.service.remove(A,row);assert.equal(f.objects.size,0);assert.equal(f.rows.get(K).state,'deleted');});
test('history reads use explicit owner/kind/state filters, stable cursors and bounded pages',async()=>{const f=fixture();const row=await f.service.save(A,K,draft,'file:photo');const filters=[];let data=[row];const q={select:v=>{filters.push(['select',v]);return q;},eq:(...v)=>{filters.push(['eq',...v]);return q;},neq:(...v)=>{filters.push(['neq',...v]);return q;},order:(...v)=>{filters.push(['order',...v]);return q;},limit:v=>{filters.push(['limit',v]);return q;},or:v=>{filters.push(['or',v]);return q;},then:ok=>Promise.resolve({data,error:null}).then(ok)};const source={auth:{getSession:async()=>({data:{session:{user:{id:A},access_token:'captured'}},error:null})}};const service=createMediaService(source,token=>{assert.equal(token,'captured');return{from:table=>{assert.equal(table,'resident_media');return q;}};},spool(),async()=>bytes);await service.list(A,'scan');for(const expected of [['eq','owner_id',A],['eq','kind','scan'],['neq','state','deleted'],['limit',21]])assert.ok(filters.some(v=>JSON.stringify(v)===JSON.stringify(expected)));await assert.rejects(()=>service.list(A,'scan',undefined,{id:'bad,filter',created_at:row.created_at}));assert.ok(!filters.some(v=>v[0]==='or'));data=[{...row,owner_id:B}];await assert.rejects(()=>service.list(A,'scan'));data=Array(22).fill(row);await assert.rejects(()=>service.list(A,'scan'));});
