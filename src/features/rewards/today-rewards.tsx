import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {router,useIsFocused} from 'expo-router';
import {useAuth} from '../auth/auth-state';
import {scanRewardService,type TodayRewards,type TodayScan} from './scan-reward-service';
import {PrivatePhoto} from '../resident/media-ui';
import {Button,Card,Copy,Heading,Message,openDetail,Section,ui} from '../resident/resident-ui';
import {materialLabel} from '../resident/media-model';
function status(r:TodayScan,now:string){if(!r.session_id)return 'Sorting guidance only';if(r.cleanup_event_id&&r.participation_status==='completed')return 'Cleanup participation rewarded';if(r.cleanup_event_id&&r.participation_status==='rejected')return 'Participation not approved';if(r.cleanup_event_id&&r.participation_status==='cancelled')return 'Participation cancelled';if(r.cleanup_event_id&&r.status==='review')return 'Awaiting officer participation review';if(r.status==='capture')return Date.parse(r.expires_at!)<=Date.parse(now)?'Capture expired':'Finish disposal capture';return ({pending:'Waiting for verification',review:'Needs review',approved:'Points awarded',rejected:'Not eligible'} as Record<string,string>)[r.status!]??'Checking status';}
export function TodayRewardsPanel({onBalanceChange}:{onBalanceChange:()=>void}){
 const auth=useAuth(),owner=auth.state.user!.id,focused=useIsFocused();const api=useMemo(()=>scanRewardService(auth.client!),[auth.client]);
 const [data,setData]=useState<TodayRewards|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[visible,setVisible]=useState(3);
 const callback=useRef(onBalanceChange),flight=useRef(false),active=useRef(true),previous=useRef<number|null>(null);
 useEffect(()=>{callback.current=onBalanceChange;},[onBalanceChange]);
 const load=useCallback(async()=>{if(flight.current||!active.current)return;flight.current=true;setLoading(true);try{const next=await api.today(owner);if(!active.current)return;if(previous.current!==null&&previous.current!==next.earned_points)callback.current();previous.current=next.earned_points;setData(next);setError('');}catch(e){if(active.current)setError(e instanceof Error?e.message:'Today’s activity could not load.');}finally{flight.current=false;if(active.current)setLoading(false);}},[api,owner]);
 useEffect(()=>{active.current=true;let current=true;const enabled=focused&&auth.state.phase==='ready';if(enabled)void Promise.resolve().then(()=>{if(current)return load();});const timer=enabled?setInterval(()=>{void load();},5000):null;return()=>{current=false;active.current=false;if(timer)clearInterval(timer);};},[load,focused,auth.state.phase]);
 return <>
  <Card><Heading>Today’s progress</Heading><Text style={ui.badge}>{data?`${data.earned_points} / ${data.config.daily_points} points`:'Checking today’s points…'}</Text><Copy>{data?`${data.awards} of ${data.config.daily_awards} independent awards · resets at midnight, Philippine time`:'Only approved actions count.'}</Copy><Button label="Open Scan" onPress={()=>router.push('/(tabs)/scan')}/>{data&&!data.config.auto_awards_enabled&&<Copy>Automatic awards are not enabled yet. Captures remain pending until verification is available.</Copy>}</Card>
  <Section title="Today’s scans"/>
  <Message error text={error}/>
  {!data&&!error&&<Copy>Loading today’s activity…</Copy>}
  {data?.activity.slice(0,visible).map(r=><Card key={r.id}>
   <View style={{gap:8}}><PrivatePhoto row={r.media} height={100} compact/><Heading>{materialLabel(r.label)}</Heading><Copy>{new Date(r.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Manila'})} PHT · saved scan</Copy><Text style={ui.badge}>{status(r,data.server_now)}{r.status==='approved'&&!r.cleanup_event_id?` · +${r.points} pts`:''}</Text></View>
   {r.cleanup_event_id&&<Copy>{r.cleanup_title} · {r.participation_status==='completed'?`${r.cleanup_awarded_points} points awarded once for this event; photos do not add extra points.`:'Event reward requires officer-confirmed participation.'}</Copy>}
   {r.status==='rejected'&&<Copy>{r.reason}</Copy>}
   {r.status==='review'&&r.participation_status!=='completed'&&<Copy>Verification needs another check. Points have not been added for this activity.</Copy>}
   {r.status==='pending'&&<Copy>Submitted for server verification. This screen refreshes while open.</Copy>}
   {r.status==='capture'&&Date.parse(r.expires_at!)>Date.parse(data.server_now)&&<Button secondary label="Continue disposal capture" onPress={()=>router.push('/(tabs)/scan')}/>}
   <Button secondary label="View saved scan" onPress={()=>openDetail('scan-record',r.id)}/>
  </Card>)}
  {data&&!data.activity.length&&<Copy>No scans today. Open Scan to record your disposal activity.</Copy>}
  {data&&visible<data.activity.length&&<Button secondary label="Show more today" onPress={()=>setVisible(v=>v+3)}/>}
  <Button secondary disabled={loading} label={loading?'Updating…':'Refresh today’s activity'} onPress={()=>{void load();}}/>
 </>;
}
