import type { SupabaseClient } from '@supabase/supabase-js';
import { uuid } from '../resident/live-model';
import { mediaRow, type MediaRow } from '../resident/media-model';
export type RewardSession={id:string;owner_id:string;request_id:string;status:'capture'|'pending'|'review'|'approved'|'rejected';fingers:number;points:number;expires_at:string;reason:string;before_id:string|null;after_id:string|null;cleanup_event_id?:string|null};
export type TodayScan={id:string;owner_id:string;created_at:string;label:string;session_id:string|null;status:RewardSession['status']|null;reason:string|null;points:number|null;fingers:number|null;expires_at:string|null;after_id:string|null;media:MediaRow;cleanup_event_id?:string|null;cleanup_title?:string|null;participation_status?:string|null;cleanup_awarded_points?:number|null};
export type TodayRewards={server_now:string;day_start:string;earned_points:number;awards:number;config:{auto_awards_enabled:boolean;daily_awards:number;daily_points:number};activity:TodayScan[]};
function integer(v:unknown,min:number,max:number){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw Error('Invalid reward verification response.');return v;}
function time(v:unknown){if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw Error('Invalid verification time.');return v;}
export function sessionRow(v:unknown,owner:string):RewardSession{
 const r=(Array.isArray(v)?v.length===1?v[0]:null:v) as RewardSession;
 if(!r||r.owner_id!==owner)throw Error('Capture ownership could not be verified.');uuid(r.id);uuid(r.request_id);if(r.cleanup_event_id!=null)uuid(r.cleanup_event_id);integer(r.fingers,1,3);integer(r.points,1,1000);time(r.expires_at);
 if(!['capture','pending','review','approved','rejected'].includes(r.status))throw Error('Unknown verification status.');return r;
}
export function todayRewards(v:unknown,owner:string):TodayRewards{
 const r=v as TodayRewards;if(!r||!r.config||!Array.isArray(r.activity)||r.activity.length>100)throw Error('Today’s reward activity could not be verified.');
 const start=Date.parse(time(r.day_start)),now=Date.parse(time(r.server_now));if(now<start||now>=start+86400000)throw Error('Invalid reward day.');
 integer(r.earned_points,0,1000000);integer(r.awards,0,1000);integer(r.config.daily_awards,1,10);integer(r.config.daily_points,1,1000);if(typeof r.config.auto_awards_enabled!=='boolean')throw Error('Invalid verification setting.');
 const seen=new Set<string>();for(const a of r.activity){uuid(a.id);if(seen.has(a.id)||a.owner_id!==owner)throw Error('Unexpected scan identity.');seen.add(a.id);if(a.cleanup_event_id!=null){uuid(a.cleanup_event_id);if(!a.session_id||typeof a.cleanup_title!=='string'||a.cleanup_title.length<3||!['joined','completed','rejected','cancelled'].includes(a.participation_status??''))throw Error('Invalid cleanup attribution.');if(a.participation_status==='completed')integer(a.cleanup_awarded_points,2,10000);else if(a.cleanup_awarded_points!=null)throw Error('Unconfirmed cleanup credit.');}else if(a.cleanup_awarded_points!=null)throw Error('Unexpected cleanup credit.');const at=Date.parse(time(a.created_at));if(at<start||at>now)throw Error('Unexpected scan date.');a.media=mediaRow(a.media,owner);if(a.media.id!==a.id||a.media.kind!=='scan'||a.media.state!=='ready')throw Error('Unexpected saved scan.');if(a.session_id!==null){uuid(a.session_id);integer(a.fingers,1,3);integer(a.points,1,1000);time(a.expires_at);if(!['capture','pending','review','approved','rejected'].includes(a.status??''))throw Error('Unexpected scan reward state.');}else if(a.status!==null)throw Error('Unexpected reward attribution.');}
 return r;
}
export type ScanCleanup={id:string;barangay_id:string;title:string;location:string;starts_at:string;ends_at:string;points:number};
export function cleanupOptions(value:unknown,community:string):ScanCleanup[]{
 const r=value as {server_now:string;events:ScanCleanup[]};const now=Date.parse(time(r?.server_now));
 if(!Array.isArray(r.events)||r.events.length>21)throw Error('Cleanup choices could not be verified.');
 const seen=new Set<string>();for(const e of r.events){uuid(e.id);if(seen.has(e.id)||e.barangay_id!==community)throw Error('Unexpected cleanup community.');seen.add(e.id);if(typeof e.title!=='string'||e.title.length<3||e.title.length>100||typeof e.location!=='string'||e.location.length<3||e.location.length>200)throw Error('Invalid cleanup details.');if(Date.parse(time(e.starts_at))>now||Date.parse(time(e.ends_at))<=Date.parse(time(e.starts_at)))throw Error('Cleanup dates are not valid for submission.');integer(e.points,2,10000);}return r.events;
}
export function scanRewardService(client:SupabaseClient){
 async function token(owner:string){const s=await client.auth.getSession();if(s.error||s.data.session?.user.id!==uuid(owner))throw Error('Your account changed. Reopen the screen.');return s.data.session.access_token;}
 async function rpc(owner:string,name:string,args:Record<string,unknown>){const t=await token(owner);const r=await client.rpc(name,args).setHeader('Authorization',`Bearer ${t}`);await token(owner);if(r.error)throw Error(r.error.code==='22023'||r.error.code==='23505'?r.error.message:'Verification request could not be confirmed. Retry the same capture.');return r.data;}
 return{
  async session(owner:string,id:string){const t=await token(owner);const r=await client.from('scan_reward_sessions').select('*').eq('owner_id',owner).eq('id',uuid(id)).single().setHeader('Authorization',`Bearer ${t}`);await token(owner);if(r.error)throw Error('Capture status could not be confirmed. Retry.');return sessionRow(r.data,owner);},
  async cleanupOptions(owner:string,community:string){return cleanupOptions(await rpc(owner,'get_scan_cleanup_options',{}),uuid(community));},
  async startCapture(owner:string,request:string,community:string,event:string|null){const r=sessionRow(await rpc(owner,'start_scan_capture',{p_request_id:uuid(request),p_expected_barangay_id:uuid(community),p_cleanup_event_id:event===null?null:uuid(event)}),owner);if(r.request_id!==request||(r.cleanup_event_id??null)!==event)throw Error('Capture activity mismatch.');return r;},
  today:async(owner:string)=>todayRewards(await rpc(owner,'get_today_scan_rewards',{}),owner),
  async start(owner:string,request:string,community:string){const r=sessionRow(await rpc(owner,'start_reward_scan',{p_request_id:uuid(request),p_expected_barangay_id:uuid(community)}),owner);if(r.request_id!==request)throw Error('Capture request mismatch.');return r;},
  async submit(owner:string,session:string,before:string,after:string){const r=sessionRow(await rpc(owner,'submit_reward_scan',{p_session_id:uuid(session),p_before_id:uuid(before),p_after_id:uuid(after)}),owner);if(r.id!==session||r.before_id!==before||r.after_id!==after)throw Error('Capture confirmation mismatch.');return r;},
 };
}
