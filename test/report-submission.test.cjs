/* global __dirname: readonly */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), ts = require('typescript');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'cebu-submission-'));
for (const name of ['live-model', 'report-submission', 'report-submission-service']) {
  fs.writeFileSync(path.join(output, name + '.js'), ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/resident', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
}
after(() => fs.rmSync(output, { recursive: true, force: true }));
const { createReportSubmission, cleanDraft, pendingKey, SubmissionError, submissionResult } = require(path.join(output, 'report-submission.js'));
const { createReportSubmissionService } = require(path.join(output, 'report-submission-service.js'));
const A = 'ce100000-0000-4000-8000-000000000001', B = 'ce100000-0000-4000-8000-000000000002';
const N = 'ce000000-0000-4000-8000-000000000001', ID = 'ce200000-0000-4000-8000-000000000001';
const KEY = 'ce500000-0000-4000-8000-000000000001';
const draft = { barangay: N, category: 'dumping', title: 'Waste beside bridge', location: 'North footbridge', description: 'Bags of waste are blocking the walkway.' };
const pending = { version: 1, owner: A, requestId: KEY, draft };
const report = { id: ID, created_at: '2026-10-27T00:00:00Z', updated_at: '2026-10-27T00:00:00Z', owner_id: A, original_barangay_id: N, category_code: draft.category, title: draft.title, location_text: draft.location, description: draft.description, status: 'pending_review' };
const result = { requestId: KEY, replayed: false, report };
function storage() { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k,v) => { data.set(k,v); }, removeItem: k => { data.delete(k); } }; }
function fixture(patch = {}) {
  const store = storage(); let calls = 0, saved = 0, keys = 0;
  const controller = createReportSubmission({ owner: A, storage: store, newKey: () => { keys++; return KEY; }, send: async () => { calls++; return result; }, onSaved: () => { saved++; }, ...patch });
  return { controller, store, calls: () => calls, saved: () => saved, keys: () => keys };
}
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
test('normalization and field boundaries are validated before sending', async () => {
  assert.deepEqual(cleanDraft({...draft, title:'  Waste\n beside bridge ', description:'\r\n'+draft.description+'\r\n'}), draft);
  for (const patch of [{title:'a'}, {description:' '.repeat(20)}, {location:'a'}, {category:'bad,code'}, {barangay:'bad'}, {description:'x'.repeat(2001)}]) assert.throws(() => cleanDraft({...draft,...patch}));
  const f = fixture(); await f.controller.submit({...draft,title:'a'}); assert.equal(f.calls(),0); assert.equal(f.store.data.size,0);
});
test('retry snapshot is persisted before RPC and success waits for acknowledgement', async () => {
  const store = storage(); let saved = 0;
  const c = createReportSubmission({ owner:A, storage:store, newKey:()=>KEY, send:async p => { assert.deepEqual(JSON.parse(store.getItem(pendingKey(A))),p); return result; }, onSaved:()=>saved++ });
  await c.submit(draft); assert.equal(c.getSnapshot().phase,'saved'); assert.equal(saved,1); assert.equal(store.data.size,1);
  await c.submit(draft); assert.equal(saved,1); assert.equal(c.acknowledge(),true); assert.equal(store.data.size,0);
});
test('double taps are single flight', async () => {
  const wait = deferred(); let calls=0; const f=fixture({send:()=> {calls++; return wait.promise;}});
  const first=f.controller.submit(draft); await f.controller.submit(draft); assert.equal(calls,1); wait.resolve(result); await first;
});
test('ambiguous failure retries identical details and key despite changed input', async () => {
  const sent=[]; const f=fixture({send:async p=>{ sent.push(p); if(sent.length===1) throw Error('lost response'); return {...result,replayed:true}; }});
  await f.controller.submit(draft); assert.equal(f.controller.getSnapshot().phase,'uncertain');
  await f.controller.submit({...draft,title:'Different report'}); assert.deepEqual(sent[0],sent[1]); assert.equal(f.keys(),1); assert.equal(f.controller.getSnapshot().phase,'saved');
});
test('reopening after a crash restores the same owner snapshot without automatically sending', async () => {
  const store=storage(); store.setItem(pendingKey(A),JSON.stringify(pending)); let calls=0;
  const c=createReportSubmission({owner:A,storage:store,newKey:()=>{throw Error('must not create key');},send:async p=>{calls++;assert.deepEqual(p,pending);return result;},onSaved:()=>{}});
  assert.equal(calls,0); assert.equal(c.getSnapshot().phase,'uncertain'); await c.submit(); assert.equal(calls,1);
  const other=fixture({owner:B,storage:store}); assert.equal(other.controller.getSnapshot().phase,'editing');
});
test('known server validation rejection clears pending copy and permits corrected input', async () => {
  let calls=0;const f=fixture({send:async()=>{if(!calls++)throw new SubmissionError('22023','invalid'); return result;}});
  await f.controller.submit(draft); assert.equal(f.controller.getSnapshot().phase,'editing'); assert.equal(f.store.data.size,0); await f.controller.submit(draft); assert.equal(f.controller.getSnapshot().phase,'saved'); assert.equal(f.keys(),2);
});
test('key conflicts and access rejection never silently create a different submission', async () => {
  for(const code of ['23505','42501']) { const f=fixture({send:async()=>{throw new SubmissionError(code,'denied');}}); await f.controller.submit(draft); await f.controller.submit({...draft,title:'Changed title'}); assert.equal(f.keys(),1); assert.equal(f.controller.getSnapshot().pending.draft.title,draft.title); }
});
test('unavailable storage prevents any network write', async () => {
  let calls=0;const store=storage();store.setItem=()=>{throw Error('full');}; const f=fixture({storage:store,send:async()=>{calls++;return result;}});await f.controller.submit(draft);assert.equal(calls,0);
  const noOp=storage();noOp.setItem=()=>{};const g=fixture({storage:noOp,send:async()=>{calls++;return result;}});await g.controller.submit(draft);assert.equal(calls,0);
});
test('corrupt and foreign pending data are preserved and block overwrites', async () => {
  for(const raw of ['{bad',JSON.stringify({...pending,owner:B})]) {const store=storage();store.setItem(pendingKey(A),raw);const f=fixture({storage:store});await f.controller.submit(draft);assert.equal(f.calls(),0);assert.equal(store.getItem(pendingKey(A)),raw);assert.equal(f.controller.getSnapshot().phase,'blocked');}
});
test('a later form cannot overwrite an earlier pending submission', async () => {
  const store=storage();const f=fixture({storage:store});store.setItem(pendingKey(A),JSON.stringify(pending));await f.controller.submit({...draft,title:'New title'});assert.equal(f.calls(),0);assert.deepEqual(JSON.parse(store.getItem(pendingKey(A))),pending);
});
test('disposing ignores late success and retains a retry copy for the original identity', async () => {
  const wait=deferred();let saved=0;const f=fixture({send:()=>wait.promise,onSaved:()=>saved++});const p=f.controller.submit(draft);f.controller.dispose();wait.resolve(result);await p;assert.equal(saved,0);assert.equal(f.store.data.size,1);assert.notEqual(f.controller.getSnapshot().phase,'saved');
});
test('acknowledgement storage failure stays saved and does not permit another write', async () => {
  const f=fixture();await f.controller.submit(draft);f.store.removeItem=()=>{};assert.equal(f.controller.acknowledge(),false);await f.controller.submit(draft);assert.equal(f.calls(),1);assert.equal(f.controller.getSnapshot().phase,'saved');
});
test('refresh callback failure never downgrades a confirmed report', async () => {
  const f=fixture({onSaved:()=>{throw Error('refresh failed');}});await f.controller.submit(draft);assert.equal(f.controller.getSnapshot().phase,'saved');
});
test('result decoder rejects wrong key, owner, community and report text', () => {
  const response={request_id:KEY,replayed:false,report};assert.equal(submissionResult(response,pending).report.id,ID);
  for(const patch of [{request_id:ID},{replayed:'yes'},{report:{...report,owner_id:B}},{report:{...report,original_barangay_id:ID}},{report:{...report,title:'Other title'}}])assert.throws(()=>submissionResult({...response,...patch},pending));
});
function fakeClient(owner=A, response={data:{request_id:KEY,replayed:false,report},error:null}) {
 const calls=[];return {calls,auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'test-token'}},error:null})},rpc:(name,args)=>{calls.push({name,args});return {setHeader:(name,value)=>{calls[0].header=[name,value];return Promise.resolve(response);}};}};
}
test('RPC pins identity token and sends no owner, role, status or actor inputs',async()=>{
 const client=fakeClient();const service=createReportSubmissionService(client);await service.send(pending);assert.equal(client.calls[0].name,'submit_resident_report');assert.deepEqual(client.calls[0].header,['Authorization','Bearer test-token']);assert.deepEqual(Object.keys(client.calls[0].args).sort(),['p_request_id','p_expected_barangay_id','p_title','p_category_code','p_location_text','p_description'].sort());
 const switched=fakeClient(B);await assert.rejects(()=>createReportSubmissionService(switched).send(pending));assert.equal(switched.calls.length,0);
});
test('RPC errors keep the server code; malformed confirmations fail closed',async()=>{
 await assert.rejects(()=>createReportSubmissionService(fakeClient(A,{data:null,error:{code:'22023'}})).send(pending),e=>e instanceof SubmissionError&&e.code==='22023');
 await assert.rejects(()=>createReportSubmissionService(fakeClient(A,{data:{},error:null})).send(pending));
});
test('categories are enabled-only, bounded, cursor checked and decoded',async()=>{
 const calls=[];let data=[{code:'dumping',label:'Dumping'}];const query={select:(v)=>{calls.push(['select',v]);return query;},eq:(...v)=>{calls.push(['eq',...v]);return query;},order:(v)=>{calls.push(['order',v]);return query;},limit:(v)=>{calls.push(['limit',v]);return query;},gt:(...v)=>{calls.push(['gt',...v]);return query;},then:(ok)=>Promise.resolve({data,error:null}).then(ok)};const service=createReportSubmissionService({from:()=>query});
 assert.equal((await service.categories('collection')).rows.length,1);assert.ok(calls.some(v=>v[0]==='eq'&&v[1]==='enabled'&&v[2]===true));assert.ok(calls.some(v=>v[0]==='limit'&&v[1]===21));await assert.rejects(()=>service.categories('bad,filter'));data=Array(22).fill({code:'dumping',label:'Dumping'});await assert.rejects(()=>service.categories());data=[{code:'x',label:'X'}];await assert.rejects(()=>service.categories());
});
