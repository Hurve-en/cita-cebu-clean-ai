/* global __dirname: readonly */
const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'cebu-scan-rewards-'));
for(const folder of ['resident','rewards'])fs.mkdirSync(path.join(output,folder));
for(const [folder,name] of [['resident','live-model'],['resident','media-model'],['rewards','scan-reward-service']])fs.writeFileSync(path.join(output,folder,name+'.js'),ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/features',folder,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
after(()=>fs.rmSync(output,{recursive:true,force:true}));
const {todayRewards,sessionRow,scanRewardService}=require(path.join(output,'rewards/scan-reward-service.js'));
const A='da100000-0000-4000-8000-000000000001',B='da100000-0000-4000-8000-000000000002',R='db400000-0000-4000-8000-000000000001',M='db300000-0000-4000-8000-000000000001',S='db200000-0000-4000-8000-000000000001',G='da000000-0000-4000-8000-000000000001';
const session={id:S,owner_id:A,request_id:R,status:'capture',fingers:2,points:10,expires_at:'2026-10-28T00:05:00Z',reason:'',before_id:null,after_id:null};
const row={id:M,owner_id:A,request_id:R,kind:'scan',report_id:null,label:'plastic',score:'0.9',model_version:'mobilenetv2-d0744dc70738-v1',byte_size:4,state:'ready',created_at:'2026-10-28T00:00:00Z',ready_at:'2026-10-28T00:00:01Z'};
function data(){return {server_now:'2026-10-28T00:01:00Z',day_start:'2026-10-27T16:00:00Z',earned_points:0,awards:0,config:{auto_awards_enabled:false,daily_awards:3,daily_points:30},activity:[{id:M,owner_id:A,created_at:row.created_at,label:'plastic',session_id:S,status:'capture',reason:'',points:10,fingers:2,expires_at:session.expires_at,after_id:null,media:{...row}}]};}
test('today activity preserves the same saved scan identity and server-day window',()=>{const d=todayRewards(data(),A);assert.equal(d.activity[0].media.id,M);assert.equal(d.earned_points,0);assert.equal(d.config.auto_awards_enabled,false);});
test('foreign scans and foreign embedded media are rejected',()=>{let d=data();d.activity[0].owner_id=B;assert.throws(()=>todayRewards(d,A));d=data();d.activity[0].media.owner_id=B;assert.throws(()=>todayRewards(d,A));});
test('old/future photos and duplicate response rows do not masquerade as today activity',()=>{for(const at of ['2026-10-26T00:00:00Z','2026-10-29T00:00:00Z']){const d=data();d.activity[0].created_at=at;assert.throws(()=>todayRewards(d,A));}const d=data();d.activity.push(d.activity[0]);assert.throws(()=>todayRewards(d,A));});
test('unknown states, invalid quotas and oversized pages fail closed',()=>{let d=data();d.activity[0].status='verified_magic';assert.throws(()=>todayRewards(d,A));d=data();d.config.daily_points=-1;assert.throws(()=>todayRewards(d,A));d=data();d.activity=Array(101).fill(d.activity[0]);assert.throws(()=>todayRewards(d,A));});
test('session decoder rejects foreign ownership and malformed challenge',()=>{assert.equal(sessionRow(session,A).fingers,2);assert.throws(()=>sessionRow({...session,owner_id:B},A));assert.throws(()=>sessionRow({...session,fingers:9},A));});
test('capture start pins identity token and never sends a score, owner or points',async()=>{const calls=[];const client={auth:{getSession:async()=>({data:{session:{user:{id:A},access_token:'owner-token'}},error:null})},rpc(name,args){return{setHeader(k,v){calls.push({name,args,k,v});return Promise.resolve({data:session,error:null});}}}};await scanRewardService(client).start(A,R,G);assert.deepEqual(calls[0].args,{p_request_id:R,p_expected_barangay_id:G});assert.equal(calls[0].v,'Bearer owner-token');});
test('account switch during verification ignores the original user response',async()=>{let n=0;const client={auth:{getSession:async()=>({data:{session:{user:{id:n++===0?A:B},access_token:'owner-token'}},error:null})},rpc(){return{setHeader(){return Promise.resolve({data:session,error:null});}}}};await assert.rejects(scanRewardService(client).start(A,R,G),/account changed/);});
const {cleanupOptions}=require(path.join(output,'rewards/scan-reward-service.js'));
const E='ea200000-0000-4000-8000-000000000001';
const option=()=>({server_now:'2026-10-28T00:00:00Z',events:[{id:E,barangay_id:G,title:'River cleanup',location:'Community park',starts_at:'2026-10-27T23:00:00Z',ends_at:'2026-10-28T01:00:00Z',points:50}]});
test('cleanup options use server time and reject foreign communities, duplicates, future and malformed events',()=>{
 assert.equal(cleanupOptions(option(),G)[0].points,50);
 for(const field of ['foreign','duplicate','future','points','oversized']){const d=option();if(field==='foreign')d.events[0].barangay_id=B;if(field==='duplicate')d.events.push(d.events[0]);if(field==='future')d.events[0].starts_at='2026-10-28T00:01:00Z';if(field==='ended')d.events[0].ends_at=d.server_now;if(field==='points')d.events[0].points=0;if(field==='oversized')d.events=Array(22).fill(d.events[0]);assert.throws(()=>cleanupOptions(d,G),field);}
});
test('unified start pins activity but never sends points or an approval',async()=>{
 const calls=[];const client={auth:{getSession:async()=>({data:{session:{user:{id:A},access_token:'owner-token'}},error:null})},rpc(name,args){return{setHeader(k,v){calls.push({name,args,k,v});return Promise.resolve({data:{...session,cleanup_event_id:E},error:null});}}}};
 await scanRewardService(client).startCapture(A,R,G,E);assert.equal(calls[0].name,'start_scan_capture');assert.deepEqual(calls[0].args,{p_request_id:R,p_expected_barangay_id:G,p_cleanup_event_id:E});assert.equal(calls[0].v,'Bearer owner-token');
 await assert.rejects(scanRewardService(client).startCapture(A,R,G,null),/activity mismatch/);
});
test('event attribution never invents a cleanup credit before completed participation',()=>{
 const d=data();Object.assign(d.activity[0],{cleanup_event_id:E,cleanup_title:'River cleanup',participation_status:'joined',cleanup_awarded_points:null});assert.equal(todayRewards(d,A).activity[0].cleanup_awarded_points,null);
 d.activity[0].cleanup_awarded_points=50;assert.throws(()=>todayRewards(d,A));d.activity[0].participation_status='completed';assert.equal(todayRewards(d,A).activity[0].cleanup_awarded_points,50);d.activity[0].cleanup_event_id=null;assert.throws(()=>todayRewards(d,A));
});

test('a previously joined completed event remains selectable for saved-photo evidence',()=>{const d=option();d.events[0].ends_at='2026-10-27T23:30:00Z';assert.equal(cleanupOptions(d,G)[0].id,E);});
