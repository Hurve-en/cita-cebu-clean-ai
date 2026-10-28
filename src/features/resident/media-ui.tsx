import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { uuid } from 'expo';
import { router } from 'expo-router';
import { useAuth } from '../auth/auth-state';
import { mediaService } from './media-client';
import { createMediaCollection } from './media-store';
import { dateLabel } from './live-model';
import { materialLabel, type MediaRow, type PendingMedia } from './media-model';
import { Button, Card, Copy, Heading, Message, Page, Section, ui } from './resident-ui';
import { historyService } from './history-service';
import { historyStatus, type HistoryItem } from './history-model';
import {PendingScanDelete} from './pending-scan-delete';
import {canDeletePendingScan} from './history-deletion';
import { CATEGORY_GUIDANCE } from './resident-data';

function useCollection(kind:'scan'|'report_photo',reportId?:string){
  const auth=useAuth();const owner=auth.state.user!.id;
  const service=useMemo(()=>mediaService(auth.client!),[auth.client]);
  const store=useMemo(()=>createMediaCollection(service,owner,kind,reportId),[service,owner,kind,reportId]);
  useEffect(()=>{store.activate();return()=>store.dispose();},[store]);
  const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  return {owner,service,store,state};
}
function confirmRemoval(action:()=>void){
  if(Platform.OS==='web'){if(window.confirm('Remove this photo and its saved scan record, if applicable? This cannot be undone.'))action();}
  else Alert.alert('Remove saved photo?','This also removes the scan from history, if applicable. Your report text stays saved.',[{text:'Keep',style:'cancel'},{text:'Remove',style:'destructive',onPress:action}]);
}
export function PrivatePhoto({row,height=260,compact=false}:{row:MediaRow;height?:number;compact?:boolean}){
  const {client,state:auth}=useAuth();const owner=auth.user!.id;
  const service=useMemo(()=>mediaService(client!),[client]);
  const [url,setUrl]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;
    void service.signedUrl(owner,row).then(value=>{if(active){setUrl(value);setError('');}})
      .catch(()=>{if(active)setError('Photo could not be opened. Check your connection and retry.');});
    return()=>{active=false;};
  },[service,owner,row,attempt]);
  return <View style={{gap:10}}>
    {!!url&&<Image accessibilityLabel="Your saved waste photo" source={{uri:url}} contentFit="contain" cachePolicy="none" style={{width:'100%',height,borderRadius:16,backgroundColor:'#EAF2EC'}} onError={()=>setError('Photo link expired or could not load. Refresh the photo.')} />}
    {!url&&!error&&<Copy>Opening private photo…</Copy>}
    <Message error text={error}/>
    {(!compact||Boolean(error))&&<Button secondary label="Refresh photo" onPress={()=>{setUrl('');setError('');setAttempt(a=>a+1);}}/>}
  </View>;
}
export function PendingCard({pending,busy,retry,cancel}:{pending:PendingMedia;busy:boolean;retry:()=>void;cancel:()=>void}){
  return <Card><Text style={ui.badge}>Needs confirmation</Text><Heading>{pending.kind==='scan'?`Scan: ${materialLabel(pending.label)}`:'Report photo upload'}</Heading>
    <Copy>{dateLabel(pending.createdAt)}</Copy><Copy>A retry copy is saved on this device. Confirm this upload without creating another record.</Copy>
    <Button disabled={busy} label={busy?'Working…':'Retry / confirm saving'} onPress={retry}/>
    <Button secondary disabled={busy} label="Cancel upload" onPress={()=>confirmRemoval(cancel)}/>
  </Card>;
}
export function SavedScan({id}:{id:string}){
  const {client,state:auth}=useAuth();const owner=auth.user!.id;
  const service=useMemo(()=>mediaService(client!),[client]);
  const [row,setRow]=useState<MediaRow|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
  const [entry,setEntry]=useState<HistoryItem|null>(null);
  const history=useMemo(()=>historyService(client!),[client]);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;let active=true;
    void Promise.all([service.item(owner,id),history.item(owner,`scan:${id}`)]).then(([r,h])=>{if(active){setRow(r);setEntry(h);setLoaded(true);}}).catch(()=>{if(active){setError('This scan could not be loaded.');setLoaded(true);}});
    return()=>{active=false;alive.current=false;};
  },[service,history,owner,id,attempt]);
  return <Page title="Saved scan" badge="Resident account" back>
    <Message error text={error}/>
    {!loaded&&<Copy>Loading scan…</Copy>}
    {row?.state==='ready'?<>
      <PrivatePhoto row={row}/>{entry&&<Card><Heading>{historyStatus(entry)}</Heading><Copy>{entry.points} points earned</Copy>{!!entry.note&&<Copy>{entry.note}</Copy>}</Card>}<Card><Heading>{materialLabel(row.label)}</Heading>
      <Copy>Model score: {(Number(row.score)*100).toFixed(1)}%. This is not a calibrated confidence guarantee.</Copy>
      <Copy>{CATEGORY_GUIDANCE[materialLabel(row.label)]??'Follow your barangay’s current sorting rules.'}</Copy>
      <Copy>Saved {dateLabel(row.ready_at!)}</Copy><Copy>Model: MobileNetV2 · {row.model_version}</Copy></Card>
      {entry&&!entry.submitted&&<Button label="Submit this photo" onPress={()=>router.push({pathname:'/reward-scan',params:{photo:row.id}})}/>}
      {entry?.submitted?(canDeletePendingScan(entry)?<PendingScanDelete item={entry} onDeleted={()=>router.replace({pathname:'/detail',params:{view:'history'}})}/>:<Copy>This photo is retained as submitted evidence.</Copy>):<Button secondary disabled={busy} label={busy?'Removing…':'Remove scan and photo'} onPress={()=>confirmRemoval(()=>{
        if(busy)return;setBusy(true);setError('');
        void service.remove(owner,row).then(()=>{if(alive.current)router.replace({pathname:'/detail',params:{view:'history'}});})
          .catch(e=>{if(alive.current)setError(e instanceof Error?e.message:'Removal failed. Retry.');})
          .finally(()=>{if(alive.current)setBusy(false);});
      })}/>}
    </>:loaded&&!error&&<Copy>This scan is unavailable, incomplete, or being removed. Return to history to check pending operations.</Copy>}
    {row?.state==='delete_pending'&&entry&&<PendingScanDelete item={entry} onDeleted={()=>router.replace({pathname:'/detail',params:{view:'history'}})}/>}
    <Button secondary disabled={busy} label="Reload scan" onPress={()=>{setError('');setAttempt(a=>a+1);}}/>
  </Page>;
}
export function ReportPhotoPanel({reportId,available}:{reportId:string;available:boolean}){
  const {store,state}=useCollection('report_photo',reportId);
  const [photo,setPhoto]=useState<{uri:string;request:string}|null>(null),[picking,setPicking]=useState(false),[error,setError]=useState('');
  const alive=useRef(true),pickerBusy=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function choose(camera:boolean){
    if(pickerBusy.current||state.busy)return;pickerBusy.current=true;setPicking(true);setError('');
    try {
      if(camera){const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted)throw Error('Camera access is needed to take a photo. You can choose one from your gallery instead.');}
      const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],allowsMultipleSelection:false,allowsEditing:false,quality:0.8,exif:false};
      const result=camera?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);
      if(alive.current&&!result.canceled&&result.assets[0]?.uri)setPhoto({uri:result.assets[0].uri,request:uuid.v4()});
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'The photo could not be opened. Try again.');}
    finally{pickerBusy.current=false;if(alive.current)setPicking(false);}
  }
  const pendingKeys=new Set(state.pending.map(p=>p.requestId));
  const exists=state.rows.length>0||state.pending.length>0;
  if(!available)return null;
  return <View style={{gap:14}}><Section title="Report photo"/>
    <Message error text={error||state.error}/><Message text={state.notice}/>
    {state.pending.map(p=><PendingCard key={p.requestId} pending={p} busy={state.busy} retry={()=>{void store.retry(p);}} cancel={()=>{void store.cancel(p);}}/>)}
    {state.rows.filter(r=>!pendingKeys.has(r.request_id)).map(r=><Card key={r.id}>
      {r.state==='ready'?<PrivatePhoto row={r}/>:<Copy>{r.state==='delete_pending'?'Removal is unfinished. Retry below.':'This photo upload is incomplete. Resume it on its original device, or remove it.'}</Copy>}
      <Button secondary disabled={state.busy} label={r.state==='delete_pending'?'Finish photo removal':'Remove photo'} onPress={()=>confirmRemoval(()=>{void store.remove(r);})}/>
    </Card>)}
    {state.loading&&<Copy>Loading photo…</Copy>}
    {!exists&&!state.loading&&!state.error&&<Card>
      <Heading>Add a photo · optional</Heading><Copy>One photo per report. Images are resized and saved privately to your account. Avoid including faces or private details.</Copy>
      {photo&&<><Image accessibilityLabel="Photo selected for this report" source={{uri:photo.uri}} cachePolicy="none" contentFit="contain" style={{width:'100%',height:220,borderRadius:14}}/>
        <Button disabled={state.busy||picking} label={state.busy?'Saving photo…':'Save photo to report'} onPress={()=>{void store.upload(photo.request,photo.uri).then(saved=>{if(alive.current&&saved)setPhoto(null);});}}/>
        <Button secondary disabled={state.busy||picking} label="Remove selection" onPress={()=>setPhoto(null)}/></>}
      <Button secondary disabled={picking||state.busy} label={picking?'Opening photos…':'Choose from gallery'} onPress={()=>{void choose(false);}}/>
      <Button secondary disabled={picking||state.busy} label="Take a photo" onPress={()=>{void choose(true);}}/>
    </Card>}
    {!!state.error&&<Button secondary disabled={state.busy||state.loading} label="Refresh report photo" onPress={()=>{void store.load();}}/>}
  </View>;
}
