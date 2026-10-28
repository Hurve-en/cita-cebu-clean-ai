import type { SupabaseClient } from '@supabase/supabase-js';
import { cursorFilter, page, uuid, type Cursor } from './live-model';
import { MEDIA_BUCKET, matchesPending, mediaPath, mediaRow, pendingMedia, validateDraft, type MediaDraft, type MediaRow, type MediaSpool, type PendingMedia } from './media-model';
export class MediaError extends Error { constructor(public code:string,message:string){super(message);} }
const rowValue=(v:unknown)=>{if(Array.isArray(v)){if(v.length!==1)throw Error('Unexpected photo response.');return v[0];}return v;};
export function createMediaService(source: SupabaseClient, scoped: (token:string)=>SupabaseClient, spool: MediaSpool, normalize:(uri:string)=>Promise<Uint8Array>) {
  async function session(owner:string){
    uuid(owner);const r=await source.auth.getSession();
    if(r.error||r.data.session?.user.id!==owner)throw new MediaError('42501','The account changed. Reopen this screen.');
    return scoped(r.data.session.access_token);
  }
  async function guard(owner:string){await session(owner);}
  async function command(client:SupabaseClient,owner:string,name:string,args:Record<string,unknown>){
    const r=await client.rpc(name,args);
    if(r.error)throw new MediaError(r.error.code, r.error.code==='22023' ? r.error.message : 'Photo operation could not be confirmed. Retry safely.');
    return mediaRow(rowValue(r.data),owner);
  }
  async function resume(p:PendingMedia):Promise<MediaRow>{
    pendingMedia(p,p.owner);const c=await session(p.owner);
    let row=matchesPending(await command(c,p.owner,'prepare_resident_media',{
      p_request_id:p.requestId,p_kind:p.kind,p_report_id:p.reportId,p_label:p.label,
      p_score:p.score,p_model_version:p.modelVersion,p_byte_size:p.byteSize,
    }),p);
    if(row.state==='deleted'){await spool.drop(p.owner,p.requestId);throw Error('This upload was removed. Choose a new photo to save again.');}
    if(row.state==='delete_pending')throw Error('This photo is being removed. Finish removal before uploading again.');
    if(row.state!=='ready'){
      await guard(p.owner);
      try {row=await command(c,p.owner,'finalize_resident_media',{p_id:row.id});}
      catch(e){
        if(!(e instanceof MediaError)||e.code!=='P0002')throw e;
        const bytes=await spool.bytes(p.owner,p.requestId);
        if(bytes.length!==p.byteSize||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('The local retry photo is missing or damaged. Cancel this upload and choose the photo again.');
        await guard(p.owner);
        const uploaded=await c.storage.from(MEDIA_BUCKET).upload(mediaPath(row),Uint8Array.from(bytes).buffer,{contentType:'image/jpeg',upsert:false,cacheControl:'0'});
        await guard(p.owner);
        // Never equate a duplicate-file error with success. Check the owned row
        // and exact Storage metadata, including when an upload response was lost.
        try {row=await command(c,p.owner,'finalize_resident_media',{p_id:row.id});}
        catch(failure){if(uploaded.error)throw new MediaError('upload','Photo upload could not be confirmed. Check your connection and retry.');throw failure;}
      }
    }
    matchesPending(row,p);
    if(row.state!=='ready')throw Error('The photo has not finished saving.');
    // Cleanup failure retains a discoverable retry. Replaying cannot duplicate it.
    await spool.drop(p.owner,p.requestId);
    return row;
  }
  return {
    pending: (owner:string)=>spool.list(uuid(owner)),
    resume,
    async save(owner:string,requestId:string,draft:MediaDraft,uri:string){
      validateDraft(draft);uuid(requestId);await guard(owner);
      const existing=(await spool.list(owner)).find(p=>p.requestId===requestId);
      if(existing){
        if(existing.kind!==draft.kind||existing.reportId!==draft.reportId||existing.label!==draft.label||existing.score!==draft.score||existing.modelVersion!==draft.modelVersion)throw Error('A different result is pending for this photo. Confirm it in scan history first.');
        return resume(existing);
      }
      const bytes=await normalize(uri);await guard(owner);
      const p=pendingMedia({version:1,owner,requestId,...draft,byteSize:bytes.length,createdAt:new Date().toISOString()},owner);
      await spool.put(p,bytes);
      // Read back both metadata and bytes before making a remote write.
      const stored=(await spool.list(owner)).find(v=>v.requestId===requestId);
      if(!stored||JSON.stringify(stored)!==JSON.stringify(p)||(await spool.bytes(owner,requestId)).length!==bytes.length)throw Error('The retry photo could not be verified. No upload was started.');
      return resume(p);
    },
    async list(owner:string,kind:'scan'|'report_photo'|'disposal_photo',reportId?:string,cursor?:Cursor){
      const c=await session(owner);
      let query=c.from(kind==='disposal_photo'?'unused_disposal_photos':'resident_media').select('*').eq('owner_id',owner).eq('kind',kind).neq('state','deleted').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(21);
      if(kind==='report_photo')query=query.eq('report_id',uuid(reportId));
      if(cursor)query=query.or(cursorFilter(cursor,false));
      const r=await query;if(r.error)throw Error('Saved photos could not be loaded. Check your connection and retry.');
      return page(r.data,v=>{const row=mediaRow(v,owner);if(row.kind!==kind||(kind==='report_photo'&&row.report_id!==reportId)||row.state==='deleted')throw Error('Unexpected photo scope.');return row;});
    },
    async findByRequest(owner:string,request:string){const c=await session(owner);const r=await c.from('resident_media').select('*').eq('owner_id',owner).eq('request_id',uuid(request)).neq('state','deleted').maybeSingle();if(r.error)throw Error('Saved capture could not be recovered.');if(!r.data)return null;const row=mediaRow(r.data,owner);if(row.request_id!==request)throw Error('Recovery key mismatch.');return row;},
    async item(owner:string,id:string){
      const c=await session(owner);const r=await c.from('resident_media').select('*').eq('owner_id',owner).eq('kind','scan').neq('state','deleted').eq('id',uuid(id)).maybeSingle();
      if(r.error)throw Error('This saved scan could not be loaded.');
      if(r.data===null)return null;
      const row=mediaRow(r.data,owner);if(row.kind!=='scan'||row.state==='deleted')throw Error('Unexpected scan record.');return row;
    },
    async signedUrl(owner:string,row:MediaRow){
      if(row.owner_id!==owner||row.state!=='ready')throw Error('This photo is not available.');
      const c=await session(owner);const r=await c.storage.from(MEDIA_BUCKET).createSignedUrl(mediaPath(row),60);
      if(r.error||!r.data?.signedUrl)throw Error('Photo could not be opened. Check your connection and retry.');
      return r.data.signedUrl;
    },
    async remove(owner:string,row:MediaRow){
      if(row.owner_id!==owner)throw Error('Photo ownership mismatch.');
      const c=await session(owner);
      const deleting=await command(c,owner,'begin_resident_media_delete',{p_id:row.id});
      if(deleting.state!=='deleted'){
        await guard(owner);const r=await c.storage.from(MEDIA_BUCKET).remove([mediaPath(deleting)]);
        if(r.error)throw Error('Photo removal is unfinished. Retry removal to finish safely.');
        await guard(owner);const removed=await command(c,owner,'finish_resident_media_delete',{p_id:row.id});
        if(removed.state!=='deleted')throw Error('Photo removal was not confirmed.');
      }
      await spool.drop(owner,row.request_id);
    },
    async cancelPending(p:PendingMedia){
      pendingMedia(p,p.owner);const c=await session(p.owner);
      const row=await command(c,p.owner,'cancel_resident_media_request',{p_request_id:p.requestId,p_kind:p.kind});
      if(row.request_id!==p.requestId||row.kind!==p.kind)throw Error('Cancellation did not match this upload.');
      await this.remove(p.owner,row);
    },
  };
}
export type MediaService=ReturnType<typeof createMediaService>;
