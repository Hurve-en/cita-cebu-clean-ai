import {useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Platform,View} from 'react-native';
import {useAuth} from '../auth/auth-state';
import {rewardsStorage} from '../rewards/rewards-local';
import {Button,Message} from './resident-ui';
import {historyService} from './history-service';
import {mediaService} from './media-client';
import {canDeletePendingScan,clearDeletedPhotoDrafts} from './history-deletion';
import type {HistoryItem} from './history-model';
export function PendingScanDelete({item,onDeleted}:{item:HistoryItem;onDeleted:()=>void|Promise<void>}){
 const {client,state}=useAuth(),owner=state.user!.id;
 const api=useMemo(()=>historyService(client!),[client]),media=useMemo(()=>mediaService(client!),[client]);
 const alive=useRef(true),flight=useRef(false);const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 if(!canDeletePendingScan(item))return null;
 async function remove(){if(flight.current)return;flight.current=true;setBusy(true);setError('');setNotice('');
  try{const row=await api.withdraw(owner,item.id);await media.remove(owner,row);
   try{clearDeletedPhotoDrafts(rewardsStorage,owner,item.id);}catch{if(alive.current)setNotice('Photo deleted. Some local retry data could not be cleared.');}
   if(alive.current){try{await onDeleted();}catch{setNotice('Photo deleted. Refresh history to update the list.');}}
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Deletion is incomplete. Retry the same photo.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 function confirm(){if(flight.current)return;const message='This cancels the AI check and permanently deletes the photo. No points will be awarded. Your daily submission allowance is not reset.';
  if(Platform.OS==='web'){if(window.confirm(message))void remove();}
  else Alert.alert('Delete pending photo?',message,[{text:'Keep photo',style:'cancel'},{text:'Delete photo',style:'destructive',onPress:()=>{void remove();}}]);
 }
 return <View style={{gap:8}}><Message error text={error}/><Message text={notice}/><Button secondary disabled={busy} label={busy?'Deleting photo…':item.photo?.state==='delete_pending'?'Retry deleting photo':'Delete pending photo'} onPress={confirm}/></View>;
}
