import {useEffect,useMemo,useRef,useState} from 'react';
import {View} from 'react-native';
import {uuid} from 'expo';
import * as ImagePicker from 'expo-image-picker';
import {router,useLocalSearchParams} from 'expo-router';
import {useAuth} from '../auth/auth-state';
import {AccessStatus} from '../auth/workspace';
import {useLiveResident} from '../resident/live-state';
import {mediaService} from '../resident/media-client';
import {MODEL_VERSION,materialLabel,type MediaRow,type PendingMedia} from '../resident/media-model';
import {PrivatePhoto} from '../resident/media-ui';
import {classifyPhoto} from '../scanner/classify-photo';
import {Button,Card,Copy,Field,Heading,Message,Page} from '../resident/resident-ui';
import {scanRewardService,type ScanCleanup} from './scan-reward-service';
import {createRewardsService} from './rewards-service';
import {rewardsStorage} from './rewards-local';
import {CleanupList} from './rewards-ui';
type Form={version:1;owner:string;photo:string|null;event:string|null;mode:'independent'|'event';location:string;description:string;request:string|null;community:string|null};
export function RewardCaptureScreen(){const {state}=useAuth();if(!state.user||!state.access||state.access.product_role!=='resident')return <AccessStatus/>;return <Capture key={state.user.id}/>;}
function Capture(){
 const auth=useAuth(),owner=auth.state.user!.id,ready=auth.state.phase==='ready',{state:resident}=useLiveResident();
 const params=useLocalSearchParams<{photo?:string}>();const initialPhoto=typeof params.photo==='string'?params.photo:null;
 const media=useMemo(()=>mediaService(auth.client!),[auth.client]),api=useMemo(()=>scanRewardService(auth.client!),[auth.client]),service=useMemo(()=>createRewardsService(auth.client!,rewardsStorage),[auth.client]);
 const key=`cebu-photo-form-v1:${owner}`;
 const [form,setForm]=useState<Form|null>(null),[selected,setSelected]=useState<MediaRow|null>(null),[photos,setPhotos]=useState<MediaRow[]>([]),[pending,setPending]=useState<PendingMedia[]>([]),[more,setMore]=useState(false),[library,setLibrary]=useState(false);
 const [events,setEvents]=useState<ScanCleanup[]>([]),[registration,setRegistration]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[sent,setSent]=useState(false);
 const alive=useRef(true),flight=useRef(false),rows=useRef<MediaRow[]>([]);
 useEffect(()=>{alive.current=true;let current=true;void Promise.resolve().then(async()=>{
  try{const raw=rewardsStorage.getItem(key);const value:Form=raw?JSON.parse(raw):{version:1,owner,photo:initialPhoto,event:null,mode:'independent',location:'',description:'',request:null,community:null};
   if(value.version!==1||value.owner!==owner||!['independent','event'].includes(value.mode)||typeof value.location!=='string'||typeof value.description!=='string')throw Error('Saved form is damaged and has been preserved.');
   const row=value.photo?await media.item(owner,value.photo):null;if(value.photo&&(!row||row.state!=='ready'))throw Error('The selected saved photo is unavailable. Reopen this photo from History Reports.');
   if(current&&alive.current){setForm(value);setSelected(row);if(initialPhoto&&value.photo!==initialPhoto)setNotice('Your earlier saved form was restored. Finish or edit it before submitting another photo.');setPending((await media.pending(owner)).filter(p=>p.kind==='scan'));}
  }catch(e){if(current&&alive.current)setError(e instanceof Error?e.message:'Could not load the saved photo.');}
 });return()=>{current=false;alive.current=false;};},[key,owner,initialPhoto,media]);
 function save(next:Form){rewardsStorage.setItem(key,JSON.stringify(next));if(rewardsStorage.getItem(key)!==JSON.stringify(next))throw Error('The submission retry could not be saved.');if(alive.current)setForm(next);}
 function edit(change:Partial<Form>){if(!form||form.request||busy)return;try{save({...form,...change});}catch(e){setError(e instanceof Error?e.message:'Cannot save this form.');}}
 async function task(action:()=>Promise<void>){if(flight.current||!ready)return;flight.current=true;setBusy(true);setError('');try{await action();}catch(e){if(alive.current){setError(e instanceof Error?e.message:'Request could not be confirmed. Retry the same submission.');try{setPending((await media.pending(owner)).filter(p=>p.kind==='scan'));}catch{/* Preserve the original failure. */}}}finally{flight.current=false;if(alive.current)setBusy(false);}}
 async function load(append=false){const result=await media.list(owner,'scan',undefined,append?rows.current.at(-1):undefined);if(!alive.current)return;const old=append?rows.current:[],ids=new Set(old.map(r=>r.id));rows.current=[...old,...result.rows.filter(r=>!ids.has(r.id))];setPhotos(rows.current);setMore(result.more);setLibrary(true);setPending((await media.pending(owner)).filter(p=>p.kind==='scan'));}
 async function choose(){if(!form||form.request)return;await task(async()=>{
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:false,allowsEditing:false,quality:0.8,exif:false});
  if(result.canceled||!result.assets[0])return;
  const prediction=await classifyPhoto(result.assets[0].uri);
  const row=await media.save(owner,uuid.v4(),{kind:'scan',reportId:null,label:prediction.label,score:prediction.score.toFixed(8),modelVersion:MODEL_VERSION},result.assets[0].uri);
  save({...form,photo:row.id});if(alive.current){setSelected(row);setLibrary(false);setNotice('Material classified and photo saved. Authenticity has not been verified.');}
 });}
 async function loadEvents(){const community=resident.profile.value?.resident_barangay_id;if(!community)throw Error('Choose an active barangay in Profile first.');const list=await api.cleanupOptions(owner,community);if(alive.current)setEvents(list);}
 async function submit(){if(!form?.photo||!selected)return;await task(async()=>{
  const community=form.community??resident.profile.value?.resident_barangay_id;if(!community)throw Error('Choose an active barangay in Profile first.');
  if(form.mode==='event'&&!form.event)throw Error('Choose a joined cleanup event.');
  if(form.location.trim().length<3||form.description.trim().length<10)throw Error('Add a location and describe what you did.');
  const snapshot={...form,request:form.request??uuid.v4(),community};save(snapshot);
  const unresolved=service.pending(owner);
  if(unresolved&&unresolved.args.p_request_id!==snapshot.request)throw Error('An earlier rewards request is unresolved. Use Retry earlier request below first.');
  await api.startCapture(owner,snapshot.request,community,snapshot.mode==='event'?snapshot.event:null);
  const confirmed=await service.send(owner,{version:1,owner,operation:'submit_disposal_claim',args:{p_request_id:snapshot.request,p_expected_barangay_id:community,p_before_id:snapshot.photo!,p_after_id:null,p_location:snapshot.location.trim(),p_description:snapshot.description.trim()}});
  rewardsStorage.removeItem(key);if(alive.current){setSent(true);setNotice(confirmed.status==='approved'?'Your submission has been approved. View your current points balance.':confirmed.status==='rejected'?'Your submission was reviewed and not approved.':snapshot.mode==='event'?'Event photo submitted for officer review.':'Photo queued for automatic checking. Points appear only if the backend approves it.');}
 });}
 const locked=Boolean(form?.request),disabled=busy||locked;
 return <View style={{flex:1,display:ready?'flex':'none'}}><Page title="Submit a photo" subtitle="Your photo, then your action details" badge={form?.mode==='event'?'Event review':'Independent evidence'} back>
  <Message error text={error}/><Message text={notice}/>
  {!form&&!error&&<Copy>Loading your saved photo…</Copy>}
  {sent?<Button label="View points" onPress={()=>router.replace('/(tabs)/rewards')}/>:form&&<>
   {selected?<Card><PrivatePhoto row={selected}/><Heading>{materialLabel(selected.label!)}</Heading><Copy>AI material suggestion. Photo originality and proper disposal have not been verified. Independent photos use automatic checks; event photos keep officer review.</Copy></Card>:<Copy>Choose a saved scan or a gallery photo. Gallery photos are classified before the form is shown.</Copy>}
   {!locked&&<><Button secondary disabled={busy} label="Choose a saved scan" onPress={()=>{void task(()=>load());}}/><Button secondary disabled={busy} label={busy?'Preparing photo…':'Choose from gallery'} onPress={()=>{void choose();}}/></>}
   {library&&photos.map(row=><Card key={row.id}><Heading>{row.label?materialLabel(row.label):'Saved photo'}</Heading><Copy>{new Date(row.created_at).toLocaleString()}</Copy>{row.state==='ready'?<><PrivatePhoto row={row} compact height={120}/><Button secondary disabled={disabled} label={selected?.id===row.id?'Selected':'Use this photo'} onPress={()=>{void task(async()=>{save({...form,photo:row.id});setSelected(row);setLibrary(false);});}}/></>:<Copy>Photo save is incomplete. Recover its pending upload below.</Copy>}</Card>)}
   {library&&more&&<Button secondary disabled={busy} label="Load more saved scans" onPress={()=>{void task(()=>load(true));}}/>}
   {library&&!photos.length&&<Copy>No saved scans yet. Use the scanner or choose a gallery photo.</Copy>}
   {pending.map(p=><Card key={p.requestId}><Heading>Photo save needs recovery</Heading><Button disabled={disabled} label="Retry saved photo" onPress={()=>{void task(async()=>{const row=await media.resume(p);save({...form,photo:row.id});setSelected(row);setPending((await media.pending(owner)).filter(x=>x.kind==='scan'));});}}/></Card>)}
   {selected&&<>
    <Heading>What was this action?</Heading>
    <Button secondary={form.mode!=='independent'} disabled={disabled} label={`${form.mode==='independent'?'✓ ':''}Independent action`} onPress={()=>edit({mode:'independent',event:null})}/>
    <Button secondary={form.mode!=='event'} disabled={disabled} label={`${form.mode==='event'?'✓ ':''}Barangay event`} onPress={()=>{edit({mode:'event'});void task(loadEvents);}}/>
    {form.mode==='event'&&<><Copy>Choose an event you already joined. Saved evidence can also be submitted after it ends. Larger points are awarded once for officer-confirmed participation, not for each photo.</Copy>
     {events.map(e=><Button secondary={form.event!==e.id} disabled={disabled} key={e.id} label={`${form.event===e.id?'✓ ':''}${e.title}`} onPress={()=>edit({event:e.id})}/>)}
     {!events.length&&<Copy>No recent joined event loaded. Refresh, manage registration, or choose independent action.</Copy>}
     <Button secondary disabled={busy} label="Refresh joined events" onPress={()=>{void task(loadEvents);}}/>
     <Button secondary disabled={disabled} label={registration?'Hide event registration':'Manage event registration'} onPress={()=>setRegistration(v=>!v)}/>
     {registration&&<CleanupList service={service} owner={owner} busy={busy} join={async event=>{let ok=false;await task(async()=>{const community=resident.profile.value?.resident_barangay_id;if(!community)throw Error('Choose a barangay first.');await service.join(owner,event,community);setNotice('Registration saved. You can submit saved event evidence later; participation still needs officer confirmation.');await loadEvents();ok=true;});return ok;}}/>}
    </>}
    <Field label="Location" placeholder="Where did you dispose of or collect the waste?" value={form.location} editable={!disabled} maxLength={200} onChangeText={location=>edit({location})}/>
    <Field label="What did you do?" placeholder="Describe the waste, sorting and disposal action." value={form.description} editable={!disabled} multiline maxLength={2000} onChangeText={description=>edit({description})}/>
    <Copy>AI cannot prove internet originality, capture time or physical disposal. Independent evidence must clearly show appropriate disposal, pass duplicate checks and meet daily limits. Unclear evidence receives no automatic points. Event evidence follows officer review.</Copy>
    <Button disabled={busy||form.location.trim().length<3||form.description.trim().length<10||(form.mode==='event'&&!form.event)} label={busy?'Confirming…':locked?'Retry the same submission':form.mode==='event'?'Submit for event review':'Submit for automatic checking'} onPress={()=>{void submit();}}/>
   </>}
   <Button secondary disabled={busy} label="Retry earlier rewards request" onPress={()=>{void task(async()=>{if(!service.pending(owner)){setNotice('No earlier request needs confirmation.');return;}await service.send(owner);setNotice('Earlier request confirmed. No duplicate award was created.');});}}/>
   {locked&&<Button secondary disabled={busy} label="Edit unsubmitted details" onPress={()=>{void task(async()=>{if(service.pending(owner))throw Error('Confirm the pending request before editing.');save({...form,request:null,community:null});setNotice('Details unlocked. The earlier start still counts toward server limits.');});}}/>}
   <Button secondary label="Save for later · back to scanner" onPress={()=>router.replace('/(tabs)/scan')}/>
   <Copy>Your photo is already in History Reports. Submitting is separate from saving. Do not include faces, private addresses or sensitive information.</Copy>
  </>}
 </Page></View>;
}
