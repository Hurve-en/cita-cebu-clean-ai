/* global __dirname: readonly */
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'cebu-rewards-'));
for(const folder of ['resident','rewards'])fs.mkdirSync(path.join(output,folder));
for(const [folder,name] of [['resident','live-model'],['rewards','rewards-model'],['rewards','rewards-service']]){
 fs.writeFileSync(path.join(output,folder,name+'.js'),ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/features',folder,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
}
after(()=>fs.rmSync(output,{recursive:true,force:true}));
const {createRewardsService}=require(path.join(output,'rewards/rewards-service.js'));
const {validateCommand,decode,rewardRules,pendingKey}=require(path.join(output,'rewards/rewards-model.js'));
const A='da100000-0000-4000-8000-000000000001',B='da100000-0000-4000-8000-000000000002',G='da000000-0000-4000-8000-000000000001',K='da600000-0000-4000-8000-000000000001',R='da200000-0000-4000-8000-000000000001',ID='da700000-0000-4000-8000-000000000001',P='da300000-0000-4000-8000-000000000001',Q='da300000-0000-4000-8000-000000000002';
const draft=()=>({version:1,owner:A,operation:'redeem_reward',args:{p_request_id:K,p_expected_barangay_id:G,p_reward_id:R,p_expected_cost:5}});
const claim=()=>({version:1,owner:A,operation:'submit_disposal_claim',args:{p_request_id:K,p_expected_barangay_id:G,p_before_id:P,p_after_id:Q,p_location:'Waste bin',p_description:'Sorted and disposed correctly'}});
function fixture(){
 let actor=A,fail='',corrupt=false,afterSwitch=false,failWrite=false,failDrop=false,resolve;const data=new Map(),calls=[],records=new Map();let debits=0;
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(failWrite)throw Error('disk full');data.set(k,v);},removeItem:k=>{if(failDrop)throw Error('cleanup failed');data.delete(k);}};
 const client={auth:{getSession:async()=>({data:{session:actor?{user:{id:actor},access_token:'token-'+actor}:null},error:null})},rpc(name,args){
  return{setHeader(header,value){calls.push({name,args:structuredClone(args),header,value,persisted:data.has(pendingKey(A))});return Promise.resolve().then(async()=>{
   if(fail==='defer')await new Promise(r=>{resolve=r;});
   if(fail==='22023'||fail==='23505'||fail==='42501')return{data:null,error:{code:fail,message:'server rejection'}};
   if(name==='get_reward_balance')return{data:'10',error:null};
   let row=records.get(args.p_request_id);
   if(!row){debits++;row=name==='redeem_reward'?{id:ID,owner_id:A,request_id:args.p_request_id,reward_id:R,barangay_id:G,reward_name:'Test reward',cost:5,status:'pending',review_note:'',created_at:'2026-10-28T00:00:00Z'}:{id:ID,owner_id:A,request_id:args.p_request_id,barangay_id:G,before_id:args.p_before_id,after_id:args.p_after_id,location:'Waste bin',description:'Sorted and disposed correctly',points:10,status:'pending',review_note:'',reviewed_by:null,reviewed_at:null,created_at:'2026-10-28T00:00:00Z'};records.set(args.p_request_id,row);}
   if(fail==='lost'){fail='';throw Error('lost response after commit');}
   if(afterSwitch)actor=B;
   return{data:corrupt?{...row,owner_id:B}:row,error:null};
  });}};
 }};
 return{service:createRewardsService(client,storage),storage,data,calls,records,get debits(){return debits;},setActor:v=>{actor=v;},setFail:v=>{fail=v;},setCorrupt:v=>{corrupt=v;},setSwitch:v=>{afterSwitch=v;},setWrite:v=>{failWrite=v;},setDrop:v=>{failDrop=v;},release:()=>resolve?.()};
}
test('reward rules enforce larger cleanup award and bounded daily limits',()=>{
 assert.equal(rewardRules({id:1,disposal_points:10,cleanup_points:50,daily_claim_limit:3}).cleanup_points,50);
 assert.throws(()=>rewardRules({id:1,disposal_points:10,cleanup_points:5,daily_claim_limit:3}));
 assert.throws(()=>rewardRules({id:1,disposal_points:10,cleanup_points:50,daily_claim_limit:100}));
});
test('pending command validation rejects privilege fields, changed owner, nil keys and shared photos',()=>{
 assert.equal(validateCommand(draft(),A).owner,A);
 assert.throws(()=>validateCommand({...draft(),owner:B},A));
 const d=draft();d.args.p_owner_id=B;assert.throws(()=>validateCommand(d,A));
 const c=claim();c.args.p_after_id=P;assert.throws(()=>validateCommand(c,A));
 const nil=draft();nil.args.p_request_id='00000000-0000-0000-0000-000000000000';assert.throws(()=>validateCommand(nil,A));
});
test('redemption retry snapshot is durable before RPC; token is pinned and no role/owner/amount input',async()=>{
 const f=fixture();await f.service.send(A,draft());assert.equal(f.calls[0].persisted,true);assert.equal(f.calls[0].value,'Bearer token-'+A);assert.equal(f.debits,1);assert.equal(f.service.pending(A),null);
 assert.deepEqual(Object.keys(f.calls[0].args).sort(),['p_expected_barangay_id','p_expected_cost','p_request_id','p_reward_id']);
});
test('lost redemption confirmation replays same request without double debit',async()=>{
 const f=fixture();f.setFail('lost');await assert.rejects(f.service.send(A,draft()));assert.equal(f.debits,1);assert.deepEqual(f.service.pending(A),draft());
 await f.service.send(A);assert.equal(f.debits,1);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0].args,f.calls[1].args);
});
test('recreating the service restores pending original details without automatically sending',async()=>{
 const f=fixture();f.setFail('lost');await assert.rejects(f.service.send(A,claim()));const saved=f.data.get(pendingKey(A));assert.ok(saved);assert.equal(f.calls.length,1);
 assert.equal(f.service.pending(A).operation,'submit_disposal_claim');assert.equal(f.calls.length,1);await f.service.send(A);assert.equal(f.debits,1);
});
test('another form cannot replace an unresolved request',async()=>{
 const f=fixture();f.setFail('lost');await assert.rejects(f.service.send(A,draft()));await assert.rejects(f.service.send(A,claim()),/earlier pending/);assert.equal(f.calls.length,1);assert.equal(f.service.pending(A).operation,'redeem_reward');
});
test('definite validation rejection releases request; access and key conflicts preserve it',async()=>{
 for(const code of ['22023','23505','42501']){const f=fixture();f.setFail(code);await assert.rejects(f.service.send(A,draft()));assert.equal(Boolean(f.service.pending(A)),code!=='22023');}
});
test('unavailable local storage prevents any network mutation',async()=>{
 const f=fixture();f.setWrite(true);await assert.rejects(f.service.send(A,draft()));assert.equal(f.calls.length,0);
});
test('corrupt local requests are preserved and block overwrites',async()=>{
 const f=fixture();f.data.set(pendingKey(A),'broken json');await assert.rejects(f.service.send(A,draft()));assert.equal(f.data.get(pendingKey(A)),'broken json');assert.equal(f.calls.length,0);
});
test('foreign session cannot prepare request or use a later account token',async()=>{
 const f=fixture();f.setActor(B);await assert.rejects(f.service.send(A,draft()));assert.equal(f.calls.length,0);assert.equal(f.data.size,0);
});
test('account switch during response retains original request without accepting late success',async()=>{
 const f=fixture();f.setSwitch(true);await assert.rejects(f.service.send(A,draft()));assert.ok(f.data.get(pendingKey(A)));assert.equal(f.calls[0].value,'Bearer token-'+A);
});
test('single flight rejects double taps without a second network command',async()=>{
 const f=fixture();f.setFail('defer');const first=f.service.send(A,draft());await new Promise(r=>setTimeout(r,5));await assert.rejects(f.service.send(A,draft()),/already/);f.release();await first;assert.equal(f.calls.length,1);
});
test('malformed/foreign confirmations never clear durable pending data',async()=>{
 const f=fixture();f.setCorrupt(true);await assert.rejects(f.service.send(A,draft()));assert.ok(f.service.pending(A));
});
test('confirmation cleanup failure remains retryable without another debit',async()=>{
 const f=fixture();f.setDrop(true);await assert.rejects(f.service.send(A,draft()));assert.equal(f.debits,1);f.setDrop(false);await f.service.send(A);assert.equal(f.debits,1);
});
test('ledger decoder rejects wrong ownership and sign, catalog rejects unpublished stock',()=>{
 const row={id:ID,owner_id:A,source_id:R,actor_id:A,created_at:'2026-10-28T00:00:00Z',amount:5,kind:'disposal'};
 assert.equal(decode('reward_ledger',row,A).amount,5);assert.throws(()=>decode('reward_ledger',{...row,owner_id:B},A));assert.throws(()=>decode('reward_ledger',{...row,amount:-5},A));
 assert.throws(()=>decode('reward_catalog',{id:ID,created_at:row.created_at,name:'Test reward',description:'Description test',cost:5,stock:1,enabled:false},A));
});
test('approved independent scan credits decode in points history',()=>{
 const transaction={id:ID,owner_id:A,source_id:P,actor_id:A,amount:10,kind:'scan',created_at:'2026-10-28T00:00:00Z'};
 assert.equal(decode('reward_ledger',transaction,A).kind,'scan');assert.throws(()=>decode('reward_ledger',{...transaction,amount:-10},A));
});
test('one-photo command permits an explicit null after photo without accepting arbitrary values',()=>{
 const c=claim();c.args.p_after_id=null;assert.equal(validateCommand(c,A).args.p_after_id,null);
 for(const bad of [undefined,'',12,'not-an-id'])assert.throws(()=>validateCommand({...c,args:{...c.args,p_after_id:bad}},A));
});
test('single-photo submission persists snapshot before RPC and decodes a pending manual claim',async()=>{
 const f=fixture(),c=claim();c.args.p_after_id=null;const result=await f.service.send(A,c);assert.equal(result.after_id,null);assert.equal(result.status,'pending');assert.equal(f.calls[0].persisted,true);assert.equal(f.service.pending(A),null);
});
test('lost single-photo response retries the same key and null attachment once',async()=>{
 const f=fixture(),c=claim();c.args.p_after_id=null;f.setFail('lost');await assert.rejects(f.service.send(A,c));assert.deepEqual(f.service.pending(A),c);await f.service.send(A);assert.equal(f.debits,1);assert.deepEqual(f.calls[0].args,f.calls[1].args);
});
test('single-photo confirmation mismatch preserves the durable request',async()=>{
 const f=fixture(),c=claim();c.args.p_after_id=null;f.setFail('lost');await assert.rejects(f.service.send(A,c));f.records.get(K).after_id=Q;await assert.rejects(f.service.send(A),/mismatch/);assert.deepEqual(f.service.pending(A),c);
});
test('single-photo event claim accepts bounded event points but never a fabricated approved state',()=>{
 const row={id:ID,owner_id:A,request_id:K,barangay_id:G,before_id:P,after_id:null,location:'Waste bin',description:'Sorted and disposed correctly',points:5000,status:'pending',review_note:'',reviewed_by:null,reviewed_at:null,created_at:'2026-10-28T00:00:00Z'};
 assert.equal(decode('disposal_claims',row,A).points,5000);assert.throws(()=>decode('disposal_claims',{...row,points:10001},A));assert.throws(()=>decode('disposal_claims',{...row,status:'approved'},A));
});
test('automated claim decisions allow no human reviewer but require a timestamp and explanation',()=>{
 const r={id:ID,created_at:'2026-10-28T00:00:00Z',owner_id:A,request_id:K,barangay_id:G,before_id:P,after_id:null,location:'Waste bin',description:'Sorted and disposed correctly',points:10,status:'approved',review_note:'Automatic screening passed',reviewed_by:null,reviewed_at:'2026-10-28T00:01:00Z'};
 assert.equal(decode('disposal_claims',r,A).status,'approved');assert.throws(()=>decode('disposal_claims',{...r,reviewed_at:null},A));assert.throws(()=>decode('disposal_claims',{...r,review_note:''},A));
});
