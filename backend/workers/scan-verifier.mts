// PRIVATE SERVER PROCESS ONLY. Never import this into src/ or an Expo bundle.
import {createRequire} from 'node:module';
import process from 'node:process';
import {fingerprint,safeDecision,visionRequest,safeSingleDecision,singleVisionRequest} from './scan-verifier-core.mjs';
const requireRoot=createRequire(new URL('../../package.json',import.meta.url));
const jpeg=requireRoot('jpeg-js') as {decode:(b:Uint8Array,o:Record<string,unknown>)=>{width:number;height:number;data:Uint8Array}};
function required(name:string){const v=process.env[name];if(!v||v.startsWith('REPLACE_'))throw Error(`Missing server setting: ${name}`);return v;}
const url=new URL(required('REWARDS_SUPABASE_URL'));if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Use a plain HTTPS Supabase project URL');
const base=url.origin,key=required('REWARDS_SUPABASE_SERVICE_ROLE_KEY'),aiKey=required('OPENAI_API_KEY'),model=required('REWARDS_VISION_MODEL');
if(process.env.REWARDS_ALLOW_PAID_VERIFICATION!=='true')throw Error('Paid verification is disabled. Review costs and explicitly set REWARDS_ALLOW_PAID_VERIFICATION=true');
const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
async function rpc(name:string,args:Record<string,unknown>){const r=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Verification database request failed (${r.status})`);return r.json();}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
async function download(owner:string,id:string){if(!uuid.test(owner)||!uuid.test(id))throw Error('Invalid evidence reference');const r=await fetch(`${base}/storage/v1/object/authenticated/resident-media/${owner}/${id}.jpg`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Evidence download failed');const length=Number(r.headers.get('content-length'));if(length>2097152)throw Error('Evidence too large');const b=new Uint8Array(await r.arrayBuffer());if(b.length>2097152)throw Error('Evidence too large');return b;}
async function once(){
 const result=await rpc('lease_scan_reward_review',{}),s=Array.isArray(result)?result[0]:result;
 if(!s?.id)return false;
 if(!uuid.test(s.id)||!uuid.test(s.lease)||s.status!=='pending')throw Error('Invalid verification lease');
 const single=s.after_id===null&&s.cleanup_event_id===null;
 const before=await download(s.owner_id,s.before_id),after=single?null:await download(s.owner_id,s.after_id);
 const b=fingerprint(before,jpeg.decode(before,{useTArray:true,maxResolutionInMP:16,maxMemoryUsageInMB:96})),a=after?fingerprint(after,jpeg.decode(after,{useTArray:true,maxResolutionInMP:16,maxMemoryUsageInMB:96})):null;
 // Fingerprints and server caps independently constrain any model result.
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${aiKey}`,'Content-Type':'application/json'},body:JSON.stringify(single?singleVisionRequest(model,before):visionRequest(model,before,after!,s.fingers,s.cleanup_event_id!=null)),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`Vision provider unavailable (${response.status})`);
 const body=await response.json() as {status?:string;output?:{content?:{type:string;text?:string}[]}[]};
 if(body.status!=='completed')throw Error('Incomplete vision response');
 const text=body.output?.flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text??'').join('');if(!text||text.length>8000)throw Error('Missing vision response');
 const decision=single?safeSingleDecision(JSON.parse(text)):safeDecision(JSON.parse(text));
 await rpc('finish_scan_reward_review',{p_id:s.id,p_lease:s.lease,p_before_sha:b.sha,p_after_sha:a?.sha??null,p_before_dhash:b.dhash,p_after_dhash:a?.dhash??null,p_decision:decision.decision,p_reason:decision.reason,p_model:model});
 // Log only an operational outcome. Never log images, JWTs, keys or provider prompts.
 console.info('One verification completed.');return true;
}
try{if(process.argv.includes('--watch')){let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});while(!stopping){try{await once();}catch{console.error('Verification deferred; retry limits apply.');}await new Promise(r=>setTimeout(r,5000));}}else await once();}catch{console.error('Verification deferred; check private server configuration and provider availability.');process.exitCode=1;}
