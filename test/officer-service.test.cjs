/* global __dirname: readonly */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const output = fs.mkdtempSync(path.join(os.tmpdir(),'cebuclean-officer-tests-'));
const source = fs.readFileSync(path.join(__dirname,'../src/features/officer/officer-service.ts'),'utf8');
fs.writeFileSync(path.join(output,'service.cjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
const { createOfficerService, validateSchedule } = require(path.join(output,'service.cjs'));
const draft=(extra={})=>({title:'Zone 1 recyclables',stream:'Recyclables',days:['Monday'],startTime:'08:00',endTime:'11:00',location:'Demo Zone 1',instructions:'Separate accepted materials.',status:'Draft',...extra});

test('opening the demo shows only the assigned community',()=>{
 const api=createOfficerService(),{session,data}=api.start();assert.equal(data.reports.length,3);assert.equal(data.schedules.length,3);assert.ok([...data.reports,...data.schedules].every(item=>item.barangayId===session.barangayId));
});
test('operations require a demo session and logout blocks access',async()=>{
 const api=createOfficerService();await assert.rejects(api.load(),/Open the officer demo/);api.start();api.end();await assert.rejects(api.load(),/Open the officer demo/);
});
test('foreign schedules cannot be edited, archived, or restored',async()=>{
 const api=createOfficerService();api.start();await assert.rejects(api.saveSchedule('outside-schedule',draft()),/assigned community/);await assert.rejects(api.archiveSchedule('outside-schedule'),/assigned community/);await assert.rejects(api.restoreSchedule('outside-schedule'),/assigned community/);
});
test('foreign report updates are rejected',async()=>{
 const api=createOfficerService();api.start();await assert.rejects(api.updateReport('outside-report','Resolved','Sample resolution completed.'),/assigned community/);
});
test('weekly schedules require valid days and same-day time windows',()=>{
 assert.match(validateSchedule(draft({days:[]})),/at least one/);assert.match(validateSchedule(draft({startTime:'8am'})),/24-hour/);assert.match(validateSchedule(draft({endTime:'07:00'})),/later/);assert.match(validateSchedule(draft({days:['Notaday']})),/at least one/);assert.equal(validateSchedule(draft()),null);
});
test('new schedules receive an ID and the assigned barangay',async()=>{
 const api=createOfficerService();const {session}=api.start();const data=await api.saveSchedule(undefined,draft());assert.equal(data.schedules.length,4);const added=data.schedules.find(item=>item.title==='Zone 1 recyclables');assert.ok(added.id);assert.equal(added.barangayId,session.barangayId);assert.equal(added.status,'Draft');
});
test('editing a schedule preserves its ID and deduplicates days',async()=>{
 const api=createOfficerService();api.start();const data=await api.saveSchedule('recyclables-week',draft({days:['Friday','Monday','Monday'],status:'Published'}));const edited=data.schedules.find(item=>item.id==='recyclables-week');assert.equal(data.schedules.length,3);assert.deepEqual(edited.days,['Monday','Friday']);assert.equal(edited.status,'Published');
});
test('archive is reversible and restore returns to draft',async()=>{
 const api=createOfficerService();api.start();let data=await api.archiveSchedule('recyclables-week');assert.equal(data.schedules.find(item=>item.id==='recyclables-week').status,'Archived');await assert.rejects(api.saveSchedule('recyclables-week',draft()),/Restore/);data=await api.restoreSchedule('recyclables-week');assert.equal(data.schedules.find(item=>item.id==='recyclables-week').status,'Draft');
});
test('resolving needs an explanation and does not mutate on validation failure',async()=>{
 const api=createOfficerService();api.start();await assert.rejects(api.updateReport('report-bin','Resolved','done'),/at least 8/);const data=await api.load();assert.equal(data.reports.find(item=>item.id==='report-bin').status,'Pending review');
});
test('report updates append an attributed activity event',async()=>{
 const api=createOfficerService();api.start();const data=await api.updateReport('report-bin','Resolved','The collection point has been cleared.');const report=data.reports.find(item=>item.id==='report-bin');assert.equal(report.status,'Resolved');assert.equal(report.events[0].actor,'Demo officer');assert.equal(report.events.length,2);assert.match(report.events[0].note,/cleared/);
});
test('internal notes can be added without changing status; empty updates are rejected',async()=>{
 const api=createOfficerService();api.start();await assert.rejects(api.updateReport('report-bin','Pending review',''),/Change the status/);const data=await api.updateReport('report-bin','Pending review','Inspection requested.');assert.equal(data.reports.find(item=>item.id==='report-bin').events[0].note,'Inspection requested.');
});
test('invalid report status cannot change the report',async()=>{
 const api=createOfficerService();api.start();await assert.rejects(api.updateReport('report-bin','Anything','test note'),/valid report status/);
});
test('logout and a new demo session reset sample edits',async()=>{
 const api=createOfficerService();api.start();await api.updateReport('report-bin','Resolved','The sample location was cleared.');api.end();const {data}=api.start();assert.equal(data.reports.find(item=>item.id==='report-bin').status,'Pending review');
});
test('returned snapshots and profile do not expose mutable internal state',async()=>{
 const api=createOfficerService();const first=api.start();first.session.barangayId='other-barangay';first.data.reports.length=0;const next=await api.load();assert.equal(next.reports.length,3);assert.ok(next.reports.every(item=>item.barangayId==='demo-barangay'));
});
process.on('exit',()=>fs.rmSync(output,{recursive:true,force:true}));
