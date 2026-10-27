-- Source: backend/drizzle/0007_resident_media_security.sql
-- Source SHA256: be7a627b39cd0d952f2b2f2171d0b008858c413462c41bf778f22acbb12f5f58
BEGIN;
SET LOCAL search_path = public, pg_catalog;
-- Private, owner-only resident media. Bytes are always managed by Storage API.
revoke all on public.resident_media from public,anon,authenticated;
grant select on public.resident_media to authenticated;
create policy media_owner_read on public.resident_media for select to authenticated
using (owner_id=(select auth.uid()) and state<>'deleted' and (select cebu_private.is_eligible()));

create function cebu_private.require_media_resident() returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); a public.account_access;
begin
  if actor is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select x.* into a from public.account_access x where x.user_id=actor for update;
  if not found or a.product_role<>'resident' or not a.enabled or a.provisioning_state<>'ready' or not cebu_private.is_eligible() then
    raise exception using errcode='42501',message='Eligible resident required';
  end if;
  return actor;
end; $$;
revoke all on function cebu_private.require_media_resident() from public,anon,authenticated;

create function public.prepare_resident_media(p_request_id uuid,p_kind text,p_report_id uuid,p_label text,p_score text,p_model_version text,p_byte_size integer)
returns public.resident_media language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); m public.resident_media;
begin
  if p_request_id is null or p_request_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_kind is null or p_kind not in ('report_photo','scan') or p_byte_size is null or p_byte_size not between 1 and 2097152 then
    raise exception using errcode='22023',message='Invalid media details'; end if;
  if (p_kind='report_photo' and (p_report_id is null or p_label is not null or p_score is not null or p_model_version is not null))
    or (p_kind='scan' and (p_report_id is not null or p_label is null or p_label not in ('glass','metal','non-recyclable','organic','paper','plastic')
      or p_score is null or p_score !~ '^(0([.][0-9]{1,8})?|1([.]0{1,8})?)$' or p_model_version is distinct from 'mobilenetv2-d0744dc70738-v1')) then
    raise exception using errcode='22023',message='Invalid media shape'; end if;
  if not exists(select 1 from storage.buckets b where b.id='resident-media' and not b.public
    and b.file_size_limit=2097152 and b.allowed_mime_types=array['image/jpeg']::text[]) then
    raise exception using errcode='55000',message='Configure the private resident-media bucket: JPEG only, 2 MB limit'; end if;
  select r.* into m from public.resident_media r where r.owner_id=actor and r.request_id=p_request_id;
  if found then
    if m.state='deleted' then return m; end if;
    if m.kind<>p_kind or m.report_id is distinct from p_report_id or m.label is distinct from p_label
      or m.score is distinct from p_score or m.model_version is distinct from p_model_version or m.byte_size<>p_byte_size then
      raise exception using errcode='23505',message='Media key already used with other details'; end if;
    return m;
  end if;
  if p_kind='report_photo' then
    perform 1 from public.reports r where r.id=p_report_id and r.owner_id=actor for share;
    if not found then raise exception using errcode='42501',message='Owned report required'; end if;
    if exists(select 1 from public.resident_media r where r.report_id=p_report_id and r.state<>'deleted') then
      raise exception using errcode='23505',message='Remove the existing report photo before adding another'; end if;
  elsif (select count(*) from public.resident_media r where r.owner_id=actor and r.kind='scan' and r.state<>'deleted')>=200 then
    raise exception using errcode='22023',message='Scan history limit reached; delete an old scan first';
  end if;
  if (select count(*) from public.resident_media r where r.owner_id=actor and r.state='uploading')>=5 then
    raise exception using errcode='22023',message='Finish or cancel pending uploads first'; end if;
  insert into public.resident_media(owner_id,request_id,kind,report_id,label,score,model_version,byte_size)
    values(actor,p_request_id,p_kind,p_report_id,p_label,p_score,p_model_version,p_byte_size) returning * into m;
  return m;
end; $$;

create function public.finalize_resident_media(p_id uuid) returns public.resident_media
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); m public.resident_media; o storage.objects;
begin
  select r.* into m from public.resident_media r where r.id=p_id and r.owner_id=actor for update;
  if not found then raise exception using errcode='42501',message='Owned media required'; end if;
  if m.state='ready' then return m; end if;
  if m.state<>'uploading' then raise exception using errcode='22023',message='Media is being removed'; end if;
  select x.* into o from storage.objects x where x.bucket_id='resident-media' and x.name=actor::text||'/'||m.id::text||'.jpg' for share;
  if not found then raise exception using errcode='P0002',message='Photo not uploaded yet'; end if;
  if o.owner_id is distinct from actor::text or o.metadata->>'mimetype' is distinct from 'image/jpeg'
    or o.metadata->>'size' is distinct from m.byte_size::text then
    raise exception using errcode='22023',message='Uploaded photo metadata does not match'; end if;
  update public.resident_media r set state='ready',ready_at=now() where r.id=m.id returning * into m;
  return m;
end; $$;

create function public.begin_resident_media_delete(p_id uuid) returns public.resident_media
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); m public.resident_media;
begin
  select r.* into m from public.resident_media r where r.id=p_id and r.owner_id=actor for update;
  if not found then raise exception using errcode='42501',message='Owned media required'; end if;
  if m.state not in ('deleted','delete_pending') then
    update public.resident_media r set state='delete_pending' where r.id=m.id returning * into m;
  end if;
  return m;
end; $$;
create function public.finish_resident_media_delete(p_id uuid) returns public.resident_media
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); m public.resident_media;
begin
  select r.* into m from public.resident_media r where r.id=p_id and r.owner_id=actor for update;
  if not found then raise exception using errcode='42501',message='Owned media required'; end if;
  if m.state='deleted' then return m; end if;
  if m.state<>'delete_pending' then raise exception using errcode='22023',message='Begin removal first'; end if;
  if exists(select 1 from storage.objects x where x.bucket_id='resident-media' and x.name=actor::text||'/'||m.id::text||'.jpg') then
    raise exception using errcode='22023',message='Remove photo through Storage before finishing'; end if;
  update public.resident_media r set state='deleted',report_id=null,label=null,score=null,model_version=null,ready_at=null
    where r.id=m.id returning * into m;
  return m;
end; $$;

-- Cancel by retry key even if preparation never committed (quota/offline errors).
-- The same account lock serializes a cancellation with a delayed preparation.
create function public.cancel_resident_media_request(p_request_id uuid,p_kind text) returns public.resident_media
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); m public.resident_media;
begin
  if p_request_id is null or p_request_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_kind is null or p_kind not in ('scan','report_photo') then
    raise exception using errcode='22023',message='Invalid cancellation key'; end if;
  select r.* into m from public.resident_media r where r.owner_id=actor and r.request_id=p_request_id for update;
  if not found then
    insert into public.resident_media(owner_id,request_id,kind,byte_size,state)
      values(actor,p_request_id,p_kind,1,'deleted') returning * into m;
  elsif m.kind<>p_kind then
    raise exception using errcode='23505',message='Cancellation key has a different media type';
  elsif m.state<>'deleted' then
    update public.resident_media r set state='delete_pending' where r.id=m.id returning * into m;
  end if;
  return m;
end; $$;
revoke all on function public.cancel_resident_media_request(uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_resident_media_request(uuid,text) to authenticated;

-- Grant commands explicitly. Never grant table mutations to mobile clients.
revoke all on function public.prepare_resident_media(uuid,text,uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.finalize_resident_media(uuid) from public,anon,authenticated;
revoke all on function public.begin_resident_media_delete(uuid) from public,anon,authenticated;
revoke all on function public.finish_resident_media_delete(uuid) from public,anon,authenticated;
grant execute on function public.prepare_resident_media(uuid,text,uuid,text,text,text,integer) to authenticated;
grant execute on function public.finalize_resident_media(uuid) to authenticated;
grant execute on function public.begin_resident_media_delete(uuid) to authenticated;
grant execute on function public.finish_resident_media_delete(uuid) to authenticated;

-- Lock a media reservation while Storage inserts/deletes its metadata. Deletion
-- cannot finish while an allowed object insert is still in its DB transaction.
create function cebu_private.media_storage_access(p_name text,p_action text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); m public.resident_media;
begin
  if actor is null or not cebu_private.is_eligible() then return false; end if;
  if not exists(select 1 from public.account_access a where a.user_id=actor and a.product_role='resident') then return false; end if;
  select r.* into m from public.resident_media r
    where r.owner_id=actor and p_name=actor::text||'/'||r.id::text||'.jpg' for share;
  if not found then return false; end if;
  return case p_action when 'insert' then m.state='uploading'
    when 'select' then m.state in ('uploading','ready','delete_pending')
    when 'delete' then m.state='delete_pending' else false end;
end; $$;
revoke all on function cebu_private.media_storage_access(text,text) from public,anon,authenticated;
grant execute on function cebu_private.media_storage_access(text,text) to authenticated;

-- Restrictive guards also protect this bucket from broader existing permissive
-- policies. Other buckets retain their existing policies and behavior.
create policy resident_media_insert on storage.objects for insert to authenticated
  with check(bucket_id='resident-media' and owner_id=auth.uid()::text and cebu_private.media_storage_access(name,'insert'));
create policy resident_media_select on storage.objects for select to authenticated
  using(bucket_id='resident-media' and owner_id=auth.uid()::text and cebu_private.media_storage_access(name,'select'));
create policy resident_media_delete on storage.objects for delete to authenticated
  using(bucket_id='resident-media' and owner_id=auth.uid()::text and cebu_private.media_storage_access(name,'delete'));
create policy resident_media_insert_guard on storage.objects as restrictive for insert to public
  with check(bucket_id<>'resident-media' or (owner_id=auth.uid()::text and cebu_private.media_storage_access(name,'insert')));
create policy resident_media_select_guard on storage.objects as restrictive for select to public
  using(bucket_id<>'resident-media' or (owner_id=auth.uid()::text and cebu_private.media_storage_access(name,'select')));
create policy resident_media_delete_guard on storage.objects as restrictive for delete to public
  using(bucket_id<>'resident-media' or (owner_id=auth.uid()::text and cebu_private.media_storage_access(name,'delete')));
create policy resident_media_update_guard on storage.objects as restrictive for update to public
  using(bucket_id<>'resident-media') with check(bucket_id<>'resident-media');
COMMIT;
