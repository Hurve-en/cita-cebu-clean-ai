-- Configurable launch defaults, not a funded reward catalog. No automatic scan awards.
insert into public.reward_rules(id) values(1);
revoke all on public.reward_rules,public.reward_catalog,public.cleanup_events,public.cleanup_participants,
 public.disposal_claims,public.reward_redemptions,public.reward_ledger from public,anon,authenticated;
grant select on public.reward_rules,public.reward_catalog,public.cleanup_events,public.cleanup_participants,
 public.disposal_claims,public.reward_redemptions,public.reward_ledger to authenticated;

create function cebu_private.reward_staff(p_barangay uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select cebu_private.is_eligible()
 and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','')='aal2'
 and exists(select 1 from public.account_access a where a.user_id=auth.uid()
 and (a.product_role='admin' or (a.product_role='officer' and exists(
 select 1 from public.officer_assignments x join public.barangays b on b.id=x.barangay_id
 where x.officer_id=a.user_id and x.barangay_id=p_barangay and x.effective_to is null
 and x.effective_from<=now() and b.enabled))));
$$;
revoke all on function cebu_private.reward_staff(uuid) from public,anon,authenticated;
grant execute on function cebu_private.reward_staff(uuid) to authenticated;
create policy reward_rules_read on public.reward_rules for select to authenticated using(cebu_private.is_eligible());
create policy reward_catalog_read on public.reward_catalog for select to authenticated using(enabled and cebu_private.is_eligible());
create policy cleanup_events_read on public.cleanup_events for select to authenticated using(cebu_private.is_eligible() and (
 cebu_private.reward_staff(barangay_id) or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.resident_barangay_id=barangay_id)
 or exists(select 1 from public.cleanup_participants p where p.event_id=cleanup_events.id and p.owner_id=auth.uid())));
-- No policy references back to cleanup_events: avoid recursive RLS.
create policy cleanup_participant_read on public.cleanup_participants for select to authenticated using(owner_id=auth.uid() and cebu_private.is_eligible());
create policy disposal_claim_read on public.disposal_claims for select to authenticated using(cebu_private.is_eligible() and (owner_id=auth.uid() or cebu_private.reward_staff(barangay_id)));
create policy redemption_read on public.reward_redemptions for select to authenticated using(cebu_private.is_eligible() and (owner_id=auth.uid() or cebu_private.reward_staff(barangay_id)));
create policy ledger_read on public.reward_ledger for select to authenticated using(owner_id=auth.uid() and cebu_private.is_eligible());

-- Extend the proven upload protocol, without modifying historical migrations.
create or replace function public.prepare_resident_media(p_request_id uuid,p_kind text,p_report_id uuid,p_label text,p_score text,p_model_version text,p_byte_size integer)
returns public.resident_media language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); m public.resident_media;
begin
  if p_request_id is null or p_request_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_kind is null or p_kind not in ('report_photo','scan','disposal_photo') or p_byte_size is null or p_byte_size not between 1 and 2097152 then
    raise exception using errcode='22023',message='Invalid media details'; end if;
  if (p_kind='disposal_photo' and (p_report_id is not null or p_label is not null or p_score is not null or p_model_version is not null))
    or (p_kind='report_photo' and (p_report_id is null or p_label is not null or p_score is not null or p_model_version is not null))
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
  elsif p_kind='disposal_photo' and (select count(*) from public.resident_media r where r.owner_id=actor and r.kind='disposal_photo' and r.state<>'deleted' and not exists(select 1 from public.disposal_claims c where r.id in(c.before_id,c.after_id)))>=60 then
    raise exception using errcode='22023',message='Evidence photo limit reached; remove unused photos';
  elsif p_kind='scan' and (select count(*) from public.resident_media r where r.owner_id=actor and r.kind='scan' and r.state<>'deleted')>=200 then
    raise exception using errcode='22023',message='Scan history limit reached; delete an old scan first';
  end if;
  if (select count(*) from public.resident_media r where r.owner_id=actor and r.state='uploading')>=5 then
    raise exception using errcode='22023',message='Finish or cancel pending uploads first'; end if;
  insert into public.resident_media(owner_id,request_id,kind,report_id,label,score,model_version,byte_size)
    values(actor,p_request_id,p_kind,p_report_id,p_label,p_score,p_model_version,p_byte_size) returning * into m;
  return m;
end; $$;


create or replace function public.cancel_resident_media_request(p_request_id uuid,p_kind text) returns public.resident_media
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); m public.resident_media;
begin
  if p_request_id is null or p_request_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_kind is null or p_kind not in ('scan','report_photo','disposal_photo') then
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


create function cebu_private.reward_community(p_actor uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare community uuid;
begin
 select p.resident_barangay_id into community from public.profiles p join public.barangays b on b.id=p.resident_barangay_id
 where p.user_id=p_actor and b.enabled for share of p,b;
 if community is null then raise exception using errcode='22023',message='Choose an active barangay in your profile first'; end if;
 return community;
end; $$;
revoke all on function cebu_private.reward_community(uuid) from public,anon,authenticated;

create function public.submit_disposal_claim(p_request_id uuid,p_expected_barangay_id uuid,p_before_id uuid,p_after_id uuid,p_location text,p_description text)
returns public.disposal_claims language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); community uuid; c public.disposal_claims; rules public.reward_rules; n integer;
begin
 if p_request_id is null or p_request_id='00000000-0000-0000-0000-000000000000'::uuid
 or p_before_id is null or p_after_id is null or p_before_id=p_after_id
 or p_location is null or char_length(btrim(p_location)) not between 3 and 200
 or p_description is null or char_length(btrim(p_description)) not between 10 and 2000 then
 raise exception using errcode='22023',message='Add two different photos, a location and disposal details';end if;
 select * into c from public.disposal_claims where owner_id=actor and request_id=p_request_id;
 if found then
 if c.barangay_id is distinct from p_expected_barangay_id or c.before_id<>p_before_id or c.after_id<>p_after_id or c.location<>btrim(p_location) or c.description<>btrim(p_description) then
 raise exception using errcode='23505',message='Claim retry key has different details';end if;return c;end if;
 community:=cebu_private.reward_community(actor);
 if community is distinct from p_expected_barangay_id then raise exception using errcode='22023',message='Your community changed. Reopen this form before submitting';end if;
 select * into rules from public.reward_rules where id=1;
 if not found then raise exception using errcode='55000',message='Reward rules are not configured';end if;
 if (select count(*) from public.disposal_claims where owner_id=actor and
 (created_at at time zone 'Asia/Manila')::date=(now() at time zone 'Asia/Manila')::date)>=rules.daily_claim_limit then
 raise exception using errcode='22023',message='Daily disposal claim limit reached';end if;
 -- Stable lock order serializes evidence consumption against deletion and reuse.
 perform 1 from public.resident_media where id in(p_before_id,p_after_id) order by id for update;
 select count(*) into n from public.resident_media where id in(p_before_id,p_after_id) and owner_id=actor and kind='disposal_photo' and state='ready';
 if n<>2 then raise exception using errcode='42501',message='Two owned, saved disposal photos are required';end if;
 if exists(select 1 from public.disposal_claims where before_id in(p_before_id,p_after_id) or after_id in(p_before_id,p_after_id)) then
 raise exception using errcode='23505',message='These photos have already been submitted';end if;
 insert into public.disposal_claims(owner_id,request_id,barangay_id,before_id,after_id,location,description,points)
 values(actor,p_request_id,community,p_before_id,p_after_id,btrim(p_location),btrim(p_description),rules.disposal_points) returning * into c;
 return c;
end; $$;

-- Referenced evidence is immutable throughout review and after a decision.
-- Abandoned/unsubmitted evidence remains removable with the existing protocol.
create function cebu_private.protect_reward_evidence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (new.state is distinct from old.state or new.kind is distinct from old.kind or new.owner_id is distinct from old.owner_id)
 and exists(select 1 from public.disposal_claims where before_id=old.id or after_id=old.id) then
 raise exception using errcode='22023',message='Submitted claim evidence is retained for review and audit';end if;
 return new;
end;$$;
revoke all on function cebu_private.protect_reward_evidence() from public,anon,authenticated;
create trigger reward_evidence_retained before update on public.resident_media for each row execute function cebu_private.protect_reward_evidence();

create function public.review_disposal_claim(p_id uuid,p_approve boolean,p_note text)
returns public.disposal_claims language plpgsql security definer set search_path='' as $$
declare c public.disposal_claims; actor uuid:=auth.uid(); target uuid;
begin
 select owner_id into target from public.disposal_claims where id=p_id;
 -- Same account lock as every earning/spending command. Resident balance cannot go negative.
 perform 1 from public.account_access where user_id=target for update;
 if not exists(select 1 from public.account_access a join auth.users u on u.id=a.user_id where a.user_id=target and a.enabled and a.provisioning_state='ready' and a.product_role='resident' and u.email_confirmed_at is not null) then raise exception using errcode='42501',message='Eligible resident recipient required';end if;
 select * into c from public.disposal_claims where id=p_id for update;
 if not found or actor=c.owner_id or not cebu_private.reward_staff(c.barangay_id) then
 raise exception using errcode='42501',message='Assigned staff with MFA required';end if;
 if p_approve is null or p_note is null or char_length(btrim(p_note)) not between 8 and 1000 then
 raise exception using errcode='22023',message='Add a review explanation of 8 to 1000 characters';end if;
 if c.status<>'pending' then
 if (c.status='approved')<>p_approve or c.review_note<>btrim(p_note) then raise exception using errcode='23505',message='Claim already reviewed';end if;
 return c;end if;
 if p_approve then
 insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(c.owner_id,c.points,'disposal',c.id,actor);end if;
 update public.disposal_claims set status=case when p_approve then 'approved' else 'rejected' end,
 review_note=btrim(p_note),reviewed_by=actor,reviewed_at=now() where id=c.id returning * into c;return c;
end;$$;

create function public.create_cleanup_event(p_barangay_id uuid,p_title text,p_location text,p_instructions text,p_starts_at timestamptz,p_ends_at timestamptz,p_capacity integer)
returns public.cleanup_events language plpgsql security definer set search_path='' as $$
declare e public.cleanup_events; award integer;
begin
 if not cebu_private.reward_staff(p_barangay_id) then raise exception using errcode='42501',message='Assigned staff with MFA required';end if;
 if not exists(select 1 from public.barangays where id=p_barangay_id and enabled) then raise exception using errcode='22023',message='Active community required';end if;
 if p_starts_at is null or p_starts_at<=now() or p_ends_at is null or p_ends_at<=p_starts_at
 or p_title is null or char_length(btrim(p_title)) not between 3 and 100
 or p_location is null or char_length(btrim(p_location)) not between 3 and 200
 or p_instructions is null or char_length(btrim(p_instructions)) not between 10 and 2000
 or p_capacity is null or p_capacity not between 1 and 10000 then raise exception using errcode='22023',message='Invalid cleanup event details';end if;
 select cleanup_points into award from public.reward_rules where id=1;
 insert into public.cleanup_events(barangay_id,title,location,instructions,starts_at,ends_at,capacity,points,created_by)
 values(p_barangay_id,btrim(p_title),btrim(p_location),btrim(p_instructions),p_starts_at,p_ends_at,p_capacity,award,auth.uid()) returning * into e;return e;
end;$$;
create function public.join_cleanup_event(p_event_id uuid,p_expected_barangay_id uuid) returns public.cleanup_participants
language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); e public.cleanup_events; p public.cleanup_participants; community uuid;
begin
 select * into p from public.cleanup_participants where owner_id=actor and event_id=p_event_id;
 if found and p.status<>'cancelled' then return p;end if;
 community:=cebu_private.reward_community(actor);
 if community is distinct from p_expected_barangay_id then raise exception using errcode='22023',message='Your community changed. Reopen this form before submitting';end if;
 select * into e from public.cleanup_events where id=p_event_id for update;
 if not found or e.barangay_id<>community or e.status<>'published' or e.starts_at<=now() then
 raise exception using errcode='22023',message='This cleanup is no longer open to join';end if;
 if (select count(*) from public.cleanup_participants where event_id=e.id and status<>'cancelled')>=e.capacity then
 raise exception using errcode='22023',message='This cleanup has reached capacity';end if;
 insert into public.cleanup_participants(owner_id,event_id) values(actor,e.id) on conflict(owner_id,event_id) do update set status='joined' returning * into p;return p;
end;$$;
create function public.verify_cleanup_participation(p_id uuid,p_complete boolean,p_note text) returns public.cleanup_participants
language plpgsql security definer set search_path='' as $$
declare p public.cleanup_participants; e public.cleanup_events; target uuid;
begin
 select owner_id into target from public.cleanup_participants where id=p_id;
 perform 1 from public.account_access where user_id=target for update;
 if not exists(select 1 from public.account_access a join auth.users u on u.id=a.user_id where a.user_id=target and a.enabled and a.provisioning_state='ready' and a.product_role='resident' and u.email_confirmed_at is not null) then raise exception using errcode='42501',message='Eligible resident recipient required';end if;
 select * into p from public.cleanup_participants where id=p_id for update;
 if not found then raise exception using errcode='42501',message='Participation unavailable';end if;
 select * into e from public.cleanup_events where id=p.event_id for share;
 if auth.uid()=p.owner_id or not cebu_private.reward_staff(e.barangay_id) then raise exception using errcode='42501',message='Assigned staff with MFA required';end if;
 if p_complete is null or p_note is null or char_length(btrim(p_note)) not between 8 and 1000 then raise exception using errcode='22023',message='A verification explanation is required';end if;
 if p.status='cancelled' then raise exception using errcode='22023',message='Withdrawn registrations cannot earn points';end if;
 if p.status<>'joined' then
 if (p.status='completed')<>p_complete or p.review_note<>btrim(p_note) then raise exception using errcode='23505',message='Participation already verified';end if;return p;end if;
 if e.status<>'published' or now()<e.ends_at then raise exception using errcode='22023',message='Verify participation after the cleanup has ended';end if;
 if p_complete then insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(p.owner_id,e.points,'cleanup',p.id,auth.uid());end if;
 update public.cleanup_participants set status=case when p_complete then 'completed' else 'rejected' end,review_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=now() where id=p.id returning * into p;return p;
end;$$;

create function public.redeem_reward(p_request_id uuid,p_expected_barangay_id uuid,p_reward_id uuid,p_expected_cost integer) returns public.reward_redemptions
language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); r public.reward_catalog; d public.reward_redemptions; balance bigint; community uuid;
begin
 if p_request_id is null or p_request_id='00000000-0000-0000-0000-000000000000'::uuid or p_reward_id is null or p_expected_cost is null then raise exception using errcode='22023',message='Invalid redemption details';end if;
 select * into d from public.reward_redemptions where owner_id=actor and request_id=p_request_id;
 if found then
 if d.barangay_id is distinct from p_expected_barangay_id or d.reward_id<>p_reward_id or d.cost<>p_expected_cost then raise exception using errcode='23505',message='Redemption retry key has different details';end if;return d;end if;
 community:=cebu_private.reward_community(actor);
 if community is distinct from p_expected_barangay_id then raise exception using errcode='22023',message='Your community changed. Reopen Rewards before redeeming';end if;
 select * into r from public.reward_catalog where id=p_reward_id for update;
 if not found or not r.enabled or r.stock<=0 then raise exception using errcode='22023',message='Reward is unavailable or out of stock';end if;
 if r.cost<>p_expected_cost then raise exception using errcode='22023',message='Reward price changed. Refresh the catalog before redeeming';end if;
 select coalesce(sum(amount),0) into balance from public.reward_ledger where owner_id=actor;
 if balance<r.cost then raise exception using errcode='22023',message='Not enough verified points';end if;
 insert into public.reward_redemptions(owner_id,request_id,reward_id,barangay_id,reward_name,cost)
 values(actor,p_request_id,r.id,community,r.name,r.cost) returning * into d;
 update public.reward_catalog set stock=stock-1 where id=r.id;
 insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(actor,-r.cost,'redemption',d.id,actor);return d;
end;$$;
create function public.cancel_reward_redemption(p_id uuid) returns public.reward_redemptions
language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); d public.reward_redemptions;
begin
 select * into d from public.reward_redemptions where id=p_id and owner_id=actor for update;
 if not found then raise exception using errcode='42501',message='Owned redemption required';end if;
 if d.status='cancelled' then return d;end if;
 if d.status<>'pending' then raise exception using errcode='22023',message='Fulfilled rewards cannot be cancelled';end if;
 update public.reward_catalog set stock=stock+1 where id=d.reward_id;
 insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(actor,d.cost,'refund',d.id,actor);
 update public.reward_redemptions set status='cancelled' where id=d.id returning * into d;return d;
end;$$;
create function public.fulfill_reward_redemption(p_id uuid,p_note text) returns public.reward_redemptions
language plpgsql security definer set search_path='' as $$
declare d public.reward_redemptions; target uuid;
begin
 select owner_id into target from public.reward_redemptions where id=p_id;
 perform 1 from public.account_access where user_id=target for update;
 select * into d from public.reward_redemptions where id=p_id for update;
 if not found or auth.uid()=d.owner_id or not cebu_private.reward_staff(d.barangay_id) then raise exception using errcode='42501',message='Assigned staff with MFA required';end if;
 if p_note is null or char_length(btrim(p_note)) not between 8 and 1000 then raise exception using errcode='22023',message='Pickup explanation required';end if;
 if d.status='fulfilled' then return d;end if;
 if d.status<>'pending' then raise exception using errcode='22023',message='Cancelled rewards cannot be fulfilled';end if;
 update public.reward_redemptions set status='fulfilled',fulfilled_by=auth.uid(),review_note=btrim(p_note) where id=d.id returning * into d;return d;
end;$$;
-- A bounded consistent summary. No wallet value is accepted from the device.
create function public.get_reward_balance() returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); result bigint;
begin select coalesce(sum(amount),0) into result from public.reward_ledger where owner_id=actor;return result;end;$$;

-- Owner-only media policies remain unchanged; staff evidence reads use a narrowly
-- scoped helper for a submitted claim, with current assignment + aal2 on each request.
create function cebu_private.can_review_reward_photo(p_media uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.disposal_claims c where p_media in(c.before_id,c.after_id) and cebu_private.reward_staff(c.barangay_id));
$$;
revoke all on function cebu_private.can_review_reward_photo(uuid) from public,anon,authenticated;
grant execute on function cebu_private.can_review_reward_photo(uuid) to authenticated;
-- Metadata policies use this helper without trusting an owner parameter.
create policy reward_evidence_reviewer on public.resident_media for select to authenticated
 using(kind='disposal_photo' and state='ready' and cebu_private.can_review_reward_photo(id));

create or replace function cebu_private.media_storage_access(p_name text,p_action text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); m public.resident_media;
begin
  if actor is null or not cebu_private.is_eligible() then return false; end if;
  if p_action='select' and exists(select 1 from public.resident_media r where p_name=r.owner_id::text||'/'||r.id::text||'.jpg' and r.kind='disposal_photo' and r.state='ready' and cebu_private.can_review_reward_photo(r.id)) then return true;end if;
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


alter policy resident_media_select on storage.objects using(bucket_id='resident-media' and cebu_private.media_storage_access(name,'select'));
alter policy resident_media_select_guard on storage.objects using(bucket_id<>'resident-media' or cebu_private.media_storage_access(name,'select'));

revoke all on function public.submit_disposal_claim(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_disposal_claim(uuid,uuid,uuid,uuid,text,text) to authenticated;

revoke all on function public.review_disposal_claim(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.review_disposal_claim(uuid,boolean,text) to authenticated;

revoke all on function public.create_cleanup_event(uuid,text,text,text,timestamp with time zone,timestamp with time zone,integer) from public,anon,authenticated;
grant execute on function public.create_cleanup_event(uuid,text,text,text,timestamp with time zone,timestamp with time zone,integer) to authenticated;

revoke all on function public.join_cleanup_event(uuid,uuid) from public,anon,authenticated;
grant execute on function public.join_cleanup_event(uuid,uuid) to authenticated;

revoke all on function public.verify_cleanup_participation(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.verify_cleanup_participation(uuid,boolean,text) to authenticated;

revoke all on function public.redeem_reward(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.redeem_reward(uuid,uuid,uuid,integer) to authenticated;

revoke all on function public.cancel_reward_redemption(uuid) from public,anon,authenticated;
grant execute on function public.cancel_reward_redemption(uuid) to authenticated;

revoke all on function public.fulfill_reward_redemption(uuid,text) from public,anon,authenticated;
grant execute on function public.fulfill_reward_redemption(uuid,text) to authenticated;

revoke all on function public.get_reward_balance() from public,anon,authenticated;
grant execute on function public.get_reward_balance() to authenticated;

-- Submitted evidence is retained, but must not consume the unused-upload quota
-- or be offered as evidence for another claim.
create view public.unused_disposal_photos with (security_invoker=true) as
 select m.* from public.resident_media m where m.kind='disposal_photo' and m.state<>'deleted'
 and not exists(select 1 from public.disposal_claims c where m.id in(c.before_id,c.after_id));
revoke all on public.unused_disposal_photos from public,anon,authenticated;
grant select on public.unused_disposal_photos to authenticated;

create function public.withdraw_cleanup_event(p_id uuid) returns public.cleanup_participants
language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); p public.cleanup_participants; e public.cleanup_events;
begin
 select * into p from public.cleanup_participants where id=p_id and owner_id=actor for update;
 if not found then raise exception using errcode='42501',message='Owned registration required';end if;
 if p.status='cancelled' then return p;end if;
 select * into e from public.cleanup_events where id=p.event_id for update;
 if p.status<>'joined' or e.starts_at<=now() then raise exception using errcode='22023',message='Withdraw before the cleanup begins';end if;
 update public.cleanup_participants set status='cancelled' where id=p.id returning * into p;return p;
end;$$;
revoke all on function public.withdraw_cleanup_event(uuid) from public,anon,authenticated;
grant execute on function public.withdraw_cleanup_event(uuid) to authenticated;
