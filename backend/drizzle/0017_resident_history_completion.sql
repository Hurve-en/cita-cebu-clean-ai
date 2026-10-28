-- Append-only completion after the sixteen deployed migrations. No new columns.
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
  -- Existing request replays return above. Deleted rows still consume today's reservation.
  if (select count(*) from public.resident_media where owner_id=actor and created_at>=cebu_private.reward_day_start())>=10 then
    raise exception using errcode='22023',message='Daily photo limit reached: 10 new photos per Philippine day. Existing photos and retrying the same save remain available';end if;
  if p_kind='report_photo' then
    perform 1 from public.reports r where r.id=p_report_id and r.owner_id=actor for share;
    if not found then raise exception using errcode='42501',message='Owned report required'; end if;
    if exists(select 1 from public.resident_media r where r.report_id=p_report_id and r.state<>'deleted') then
      raise exception using errcode='23505',message='Remove the existing report photo before adding another'; end if;
  elsif p_kind='disposal_photo' and (select count(*) from public.resident_media r where r.owner_id=actor and r.kind='disposal_photo' and r.state<>'deleted' and not exists(select 1 from public.disposal_claims c where r.id in(c.before_id,c.after_id)) and not exists(select 1 from public.scan_reward_sessions s where r.id in(s.before_id,s.after_id)))>=60 then
    raise exception using errcode='22023',message='Evidence photo limit reached; remove unused photos';
  elsif p_kind='scan' and (select count(*) from public.resident_media r where r.owner_id=actor and r.kind='scan' and r.state<>'deleted' and not exists(select 1 from public.disposal_claims c where c.before_id=r.id or c.after_id=r.id) and not exists(select 1 from public.scan_reward_sessions x where x.before_id=r.id or x.after_id=r.id))>=200 then
    raise exception using errcode='22023',message='Saved draft limit reached; remove an unused draft first';
  end if;
  if (select count(*) from public.resident_media r where r.owner_id=actor and r.state='uploading')>=5 then
    raise exception using errcode='22023',message='Finish or cancel pending uploads first'; end if;
  insert into public.resident_media(owner_id,request_id,kind,report_id,label,score,model_version,byte_size)
    values(actor,p_request_id,p_kind,p_report_id,p_label,p_score,p_model_version,p_byte_size) returning * into m;
  return m;
end; $$;

create or replace function public.submit_disposal_claim(p_request_id uuid,p_expected_barangay_id uuid,p_before_id uuid,p_after_id uuid,p_location text,p_description text)
returns public.disposal_claims language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); community uuid;c public.disposal_claims;rules public.reward_rules;
 s public.scan_reward_sessions;e public.cleanup_events;n integer;award integer;
begin
 if p_request_id is null or p_request_id='00000000-0000-0000-0000-000000000000'::uuid or p_before_id is null
 or p_before_id=p_after_id or p_location is null or char_length(btrim(p_location)) not between 3 and 200
 or p_description is null or char_length(btrim(p_description)) not between 10 and 2000 then
 raise exception using errcode='22023',message='Choose a photo and add a location and disposal details';end if;
 select * into c from public.disposal_claims where owner_id=actor and request_id=p_request_id;
 if found then
 if c.barangay_id is distinct from p_expected_barangay_id or c.before_id is distinct from p_before_id or c.after_id is distinct from p_after_id
 or c.location<>btrim(p_location) or c.description<>btrim(p_description) then raise exception using errcode='23505',message='Claim retry key has different details';end if;return c;end if;
 community:=cebu_private.reward_community(actor);
 if community is distinct from p_expected_barangay_id then raise exception using errcode='22023',message='Your community changed. Reopen the form';end if;
 select * into rules from public.reward_rules where id=1;
 if not found then raise exception using errcode='55000',message='Reward rules unavailable';end if;award:=rules.disposal_points;
 if p_after_id is null then
 select * into s from public.scan_reward_sessions where owner_id=actor and request_id=p_request_id for update;
 if not found or s.status<>'capture' or s.before_id is not null or s.barangay_id<>community or now()>=s.expires_at then
 raise exception using errcode='22023',message='Confirm a fresh submission request before sending this photo';end if;
 if s.cleanup_event_id is not null then
 select * into e from public.cleanup_events where id=s.cleanup_event_id for share;
 if not found or e.status<>'published' or e.barangay_id<>community or now()<e.starts_at
 or not exists(select 1 from public.cleanup_participants where owner_id=actor and event_id=e.id and status in('joined','completed')) then
 raise exception using errcode='22023',message='Cleanup participation is no longer active';end if;award:=e.points;
 end if;
 end if;
 if s.cleanup_event_id is null and (select count(*) from public.disposal_claims c1 where c1.owner_id=actor
 and c1.created_at>=cebu_private.reward_day_start() and not exists(select 1 from public.scan_reward_sessions x where x.owner_id=actor and x.request_id=c1.request_id and x.cleanup_event_id is not null))>=rules.daily_claim_limit then
 raise exception using errcode='22023',message='Daily independent submission limit reached';end if;
 perform 1 from public.resident_media where id in(p_before_id,p_after_id) order by id for update;
 if p_after_id is null then
 select count(*) into n from public.resident_media where id=p_before_id and owner_id=actor and kind='scan' and state='ready';
 if n<>1 then raise exception using errcode='42501',message='One owned, saved classification photo is required';end if;
 else
 select count(*) into n from public.resident_media where id in(p_before_id,p_after_id) and owner_id=actor and kind='disposal_photo' and state='ready';
 if n<>2 then raise exception using errcode='42501',message='Two owned, saved disposal photos are required';end if;
 end if;
 if exists(select 1 from public.disposal_claims where before_id in(p_before_id,p_after_id) or after_id in(p_before_id,p_after_id)) then
 raise exception using errcode='23505',message='This photo has already been submitted';end if;
 insert into public.disposal_claims(owner_id,request_id,barangay_id,before_id,after_id,location,description,points)
 values(actor,p_request_id,community,p_before_id,p_after_id,btrim(p_location),btrim(p_description),award) returning * into c;
 if p_after_id is null then
 if s.cleanup_event_id is null and rules.disposal_points<>10 then raise exception using errcode='55000',message='Independent reward must be configured as 10 points';end if;
 update public.scan_reward_sessions set before_id=p_before_id,status=case when s.cleanup_event_id is null then 'pending' else 'review' end,submitted_at=now(),verifier=case when s.cleanup_event_id is null then null else 'manual-review-required' end,
 reason=case when s.cleanup_event_id is null then 'Waiting for automatic evidence screening' else 'Event evidence requires officer review' end where id=s.id;
 end if;
 return c;
end;$$;

create or replace function public.review_disposal_claim(p_id uuid,p_approve boolean,p_note text)
returns public.disposal_claims language plpgsql security definer set search_path='' as $$
declare c public.disposal_claims; actor uuid:=auth.uid(); target uuid;s public.scan_reward_sessions;
begin
 select owner_id into target from public.disposal_claims where id=p_id;
 -- Same account lock as every earning/spending command. Resident balance cannot go negative.
 perform 1 from public.account_access where user_id=target for update;
 if not exists(select 1 from public.account_access a join auth.users u on u.id=a.user_id where a.user_id=target and a.enabled and a.provisioning_state='ready' and a.product_role='resident' and u.email_confirmed_at is not null) then raise exception using errcode='42501',message='Eligible resident recipient required';end if;
 select * into c from public.disposal_claims where id=p_id for update;
 if not found or actor=c.owner_id or not cebu_private.reward_staff(c.barangay_id) then
 raise exception using errcode='42501',message='Assigned staff with MFA required';end if;
 if not exists(select 1 from public.scan_reward_sessions x where x.owner_id=c.owner_id and x.request_id=c.request_id and x.cleanup_event_id is not null) then
 raise exception using errcode='42501',message='Independent submissions cannot be reviewed by officers';end if;
 if p_approve is null or p_note is null or char_length(btrim(p_note)) not between 8 and 1000 then
 raise exception using errcode='22023',message='Add a review explanation of 8 to 1000 characters';end if;
 if c.status<>'pending' then
 if (c.status='approved')<>p_approve or c.review_note<>btrim(p_note) then raise exception using errcode='23505',message='Claim already reviewed';end if;
 return c;end if;
 select * into s from public.scan_reward_sessions where owner_id=c.owner_id and request_id=c.request_id;
 if p_approve and s.cleanup_event_id is not null and not exists(select 1 from public.cleanup_participants where owner_id=c.owner_id and event_id=s.cleanup_event_id and status='completed') then
 raise exception using errcode='22023',message='Confirm cleanup participation after the event first; photo approval never grants extra event points';end if;
 if p_approve and s.cleanup_event_id is null then
 insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(c.owner_id,c.points,'disposal',c.id,actor);end if;
 update public.disposal_claims set status=case when p_approve then 'approved' else 'rejected' end,
 review_note=btrim(p_note),reviewed_by=actor,reviewed_at=now() where id=c.id returning * into c;
 if c.after_id is null then update public.scan_reward_sessions set status=case when p_approve then 'approved' else 'rejected' end,reason=btrim(p_note),reviewed_by=actor,reviewed_at=now() where id=s.id;end if;
 return c;
end;$$;

create or replace function public.lease_scan_reward_review() returns public.scan_reward_sessions
language plpgsql security definer set search_path='' as $$
declare s public.scan_reward_sessions;
begin
 perform 1 from public.scan_reward_config where id=1 for update;
 if (select coalesce(sum(attempts),0) from public.scan_reward_sessions where leased_at>=cebu_private.reward_day_start())>=100 then return null;end if;
 update public.scan_reward_sessions set status='rejected',reason='Verification could not be completed after three attempts. No points awarded; contact support before retrying',lease=null
 where status='pending' and attempts>=3 and leased_at<now()-interval '2 minutes';
 update public.disposal_claims c set status='rejected',review_note=x.reason,reviewed_by=null,reviewed_at=now()
 from public.scan_reward_sessions x where c.owner_id=x.owner_id and c.request_id=x.request_id and c.after_id is null and c.status='pending'
 and x.after_id is null and x.cleanup_event_id is null and x.status='rejected' and x.attempts>=3;
 select * into s from public.scan_reward_sessions where status='pending' and (after_id is not null or cleanup_event_id is not null or (select auto_awards_enabled from public.scan_reward_config where id=1)) and attempts<3 and (leased_at is null or leased_at<now()-interval '2 minutes') order by submitted_at,id limit 1 for update skip locked;
 if not found then return null;end if;
 update public.scan_reward_sessions set lease=gen_random_uuid(),leased_at=now(),attempts=attempts+1 where id=s.id returning * into s;return s;
end;$$;

create or replace function public.finish_scan_reward_review(p_id uuid,p_lease uuid,p_before_sha text,p_after_sha text,p_before_dhash text,p_after_dhash text,p_decision text,p_reason text,p_model text)
returns public.scan_reward_sessions language plpgsql security definer set search_path='' as $$
declare s public.scan_reward_sessions;target uuid;exact_duplicate boolean;near_duplicate boolean;eligible boolean;c public.disposal_claims;
begin
 perform 1 from public.scan_reward_config where id=1 for update;
 select owner_id into target from public.scan_reward_sessions where id=p_id;
 perform 1 from public.account_access where user_id=target for update;
 select * into s from public.scan_reward_sessions where id=p_id for update;
 if not found or p_lease is null or s.lease is distinct from p_lease or s.status<>'pending' or s.leased_at<now()-interval '2 minutes' then raise exception using errcode='42501',message='Active verification lease required';end if;
 if s.cleanup_event_id is null and s.after_id is null then
  select * into c from public.disposal_claims where owner_id=s.owner_id and request_id=s.request_id and before_id=s.before_id and after_id is null for update;
  if not found or c.status<>'pending' then raise exception using errcode='22023',message='Pending owned single-photo claim required';end if;
  if p_before_sha is null or p_before_sha !~ '^[0-9a-f]{64}$' or p_before_dhash is null or p_before_dhash !~ '^[0-9a-f]{16}$'
   or p_after_sha is not null or p_after_dhash is not null or p_decision is null or p_decision not in('eligible','review','reject')
   or p_reason is null or char_length(p_reason) not between 8 and 500 or p_model is null or char_length(p_model) not between 2 and 100 then
   raise exception using errcode='22023',message='Invalid single-photo verdict';end if;
  if not (select auto_awards_enabled from public.scan_reward_config where id=1) then
   update public.scan_reward_sessions set lease=null,reason='Automatic verification is paused' where id=s.id returning * into s;return s;
  end if;
  exact_duplicate:=exists(select 1 from public.reward_image_fingerprints where sha256=p_before_sha and session_id<>s.id);
  near_duplicate:=exists(select 1 from public.reward_image_fingerprints f where f.session_id<>s.id and bit_count(('x'||f.dhash)::bit(64)#('x'||p_before_dhash)::bit(64))<=4);
  insert into public.reward_image_fingerprints values(p_before_sha,s.id,p_before_dhash) on conflict do nothing;
  eligible:=not exact_duplicate and not near_duplicate and p_decision='eligible'
   and cebu_private.reward_has_daily_room(s.owner_id,10)
   and exists(select 1 from public.account_access a join auth.users u on u.id=a.user_id where a.user_id=s.owner_id and a.product_role='resident' and a.enabled and a.provisioning_state='ready' and u.email_confirmed_at is not null);
  p_reason:=case when exact_duplicate then 'This photo has already been used for a reward' when near_duplicate then 'Similar evidence could not be automatically verified'
   when p_decision='review' then 'The photo could not be automatically verified. No points were awarded'
   when p_decision='eligible' and not eligible then 'The account is ineligible or the daily reward limit has been reached' else p_reason end;
  if eligible then insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(s.owner_id,10,'disposal',c.id,s.owner_id);end if;
  update public.disposal_claims set status=case when eligible then 'approved' else 'rejected' end,points=10,review_note=p_reason,reviewed_by=null,reviewed_at=now() where id=c.id;
  update public.scan_reward_sessions set status=case when eligible then 'approved' else 'rejected' end,points=10,reason=p_reason,verifier=p_model,reviewed_by=null,reviewed_at=now(),lease=null where id=s.id returning * into s;
  return s;
 end if;
 if s.cleanup_event_id is null and s.points<>10 then raise exception using errcode='55000',message='Independent reward must be configured as 10 points';end if;
 if p_before_sha is null or p_after_sha is null or p_before_dhash is null or p_after_dhash is null or p_before_sha !~ '^[0-9a-f]{64}$' or p_after_sha !~ '^[0-9a-f]{64}$'
 or p_before_dhash !~ '^[0-9a-f]{16}$' or p_after_dhash !~ '^[0-9a-f]{16}$' or p_decision is null or p_decision not in('eligible','review','reject')
 or p_reason is null or char_length(p_reason) not between 8 and 500 or p_model is null or char_length(p_model) not between 2 and 100 then raise exception using errcode='22023',message='Invalid verification result';end if;
 exact_duplicate:=p_before_sha=p_after_sha or exists(select 1 from public.reward_image_fingerprints where sha256 in(p_before_sha,p_after_sha) and session_id<>s.id);
 near_duplicate:=exists(select 1 from public.reward_image_fingerprints f where f.session_id<>s.id and
 (bit_count(('x'||f.dhash)::bit(64)#('x'||p_before_dhash)::bit(64))<=4 or bit_count(('x'||f.dhash)::bit(64)#('x'||p_after_dhash)::bit(64))<=4));
 insert into public.reward_image_fingerprints values(p_before_sha,s.id,p_before_dhash) on conflict do nothing;
 insert into public.reward_image_fingerprints values(p_after_sha,s.id,p_after_dhash) on conflict do nothing;
 eligible:=s.cleanup_event_id is null and not exact_duplicate and not near_duplicate and p_decision='eligible' and (select auto_awards_enabled from public.scan_reward_config where id=1)
 and cebu_private.reward_has_daily_room(s.owner_id,s.points)
 and exists(select 1 from public.account_access a join auth.users u on u.id=a.user_id where a.user_id=s.owner_id and a.product_role='resident' and a.enabled and a.provisioning_state='ready' and u.email_confirmed_at is not null);
 if eligible then insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(s.owner_id,s.points,'scan',s.id,s.owner_id);end if;
 update public.scan_reward_sessions set status=case when exact_duplicate or p_decision='reject' then 'rejected' when eligible then 'approved' else 'review' end,
 reason=case when exact_duplicate then 'Duplicate reward evidence' when near_duplicate then 'Similar reward evidence needs staff review' when s.cleanup_event_id is not null then 'Event evidence checked; cleanup points require officer-confirmed participation' when p_decision='eligible' and not eligible then 'Verification complete; award requires staff review or daily limit reset' else p_reason end,
 verifier=p_model,reviewed_at=now(),lease=null where id=s.id returning * into s;return s;
end;$$;

-- Existing undecided single-photo independent claims move to the AI queue. No points are created here.
update public.scan_reward_sessions s set status='pending',verifier=null,reason='Waiting for automatic evidence screening'
from public.disposal_claims c where c.owner_id=s.owner_id and c.request_id=s.request_id and c.status='pending' and c.after_id is null
 and s.cleanup_event_id is null and s.status='review' and s.verifier='manual-review-required';


-- NEW endpoint. One owner-scoped, globally ordered page; no new database columns.
create function public.get_resident_history(p_cursor_time timestamptz default null,p_cursor_key text default null,p_filter text default 'all',p_item_key text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); result jsonb;
begin
 if p_filter is null or p_filter not in('all','saved','submitted') or (p_cursor_time is null)<>(p_cursor_key is null)
 or (p_cursor_key is not null and p_cursor_key !~ '^(scan|report|claim|event):[0-9a-f-]{36}$')
 or (p_item_key is not null and (p_item_key !~ '^(scan|report|claim|event):[0-9a-f-]{36}$' or p_cursor_time is not null)) then
 raise exception using errcode='22023',message='Invalid history page';end if;
 with entries as (
 select 'scan:'||m.id as key,actor as owner_id,'scan'::text as kind,m.id as id,
 coalesce(c.created_at,s.submitted_at,m.created_at) as occurred_at,
 coalesce(m.label,'Saved photo') as title,
 case when c.id is not null then case when c.status='pending' then case when s.cleanup_event_id is null then 'checking' else 'pending' end else c.status end
 when s.id is not null and s.status<>'capture' then case s.status when 'pending' then 'checking' else s.status end
 when m.state='ready' then 'saved' else m.state end as status,
 coalesce(nullif(c.review_note,''),s.reason,'') as note,
 coalesce(c.description,'') as description,coalesce(c.location,'') as location,
 coalesce((select sum(l.amount)::integer from public.reward_ledger l where l.owner_id=actor and
 ((l.kind='disposal' and l.source_id=c.id) or (l.kind='scan' and l.source_id=s.id))),0) as points,
 c.id is not null or (s.id is not null and s.status<>'capture') as submitted,
 to_jsonb(m) as photo,s.cleanup_event_id as event_id
 from public.resident_media m
 left join lateral(select * from public.disposal_claims x where x.owner_id=actor and (x.before_id=m.id or x.after_id=m.id) order by x.created_at desc,x.id desc limit 1)c on true
 left join lateral(select * from public.scan_reward_sessions x where x.owner_id=actor and
 (x.before_id=m.id or x.after_id=m.id or (c.request_id is not null and x.request_id=c.request_id)) order by x.created_at desc,x.id desc limit 1)s on true
 where m.owner_id=actor and m.kind='scan' and m.state<>'deleted'
 union all
 select 'report:'||r.id,actor,'report',r.id,r.created_at,r.title,r.status::text,''::text,r.description,r.location_text,0,true,null::jsonb,null::uuid
 from public.reports r where r.owner_id=actor
 union all
 select 'claim:'||c.id,actor,'claim',c.id,c.created_at,'Disposal submission',c.status,c.review_note,c.description,c.location,
 coalesce((select sum(l.amount)::integer from public.reward_ledger l where l.owner_id=actor and l.kind='disposal' and l.source_id=c.id),0),true,to_jsonb(m),s.cleanup_event_id
 from public.disposal_claims c join public.resident_media m on m.id=c.before_id and m.owner_id=actor
 left join public.scan_reward_sessions s on s.owner_id=actor and s.request_id=c.request_id
 where c.owner_id=actor and m.kind<>'scan'
 union all
 select 'event:'||p.id,actor,'event',p.id,p.created_at,e.title,p.status,p.review_note,e.instructions,e.location,
 coalesce((select sum(l.amount)::integer from public.reward_ledger l where l.owner_id=actor and l.kind='cleanup' and l.source_id=p.id),0),true,null::jsonb,e.id
 from public.cleanup_participants p join public.cleanup_events e on e.id=p.event_id where p.owner_id=actor
 ), candidates as (
 select * from entries where (p_item_key is null or key=p_item_key)
 and (p_filter='all' or (p_filter='saved' and not submitted) or (p_filter='submitted' and submitted))
 and (p_cursor_time is null or (occurred_at,key)<(p_cursor_time,p_cursor_key))
 order by occurred_at desc,key desc limit 21
 ), visible as (select * from candidates order by occurred_at desc,key desc limit 20)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(v) order by occurred_at desc,key desc) from visible v),'[]'::jsonb),
 'more',(select count(*)>20 from candidates),
 'next_cursor',case when (select count(*)>20 from candidates) then (select jsonb_build_object('time',occurred_at,'key',key) from visible order by occurred_at,key limit 1) else null end)
 into result;
 return result;
end;$$;
revoke all on function public.get_resident_history(timestamptz,text,text,text) from public,anon;
grant execute on function public.get_resident_history(timestamptz,text,text,text) to authenticated;

create or replace function public.review_scan_reward(p_id uuid,p_approve boolean,p_note text) returns public.scan_reward_sessions
language plpgsql security definer set search_path='' as $$
declare s public.scan_reward_sessions;target uuid;c public.disposal_claims;
begin
 select owner_id into target from public.scan_reward_sessions where id=p_id;
 perform 1 from public.account_access where user_id=target for update;
 select * into s from public.scan_reward_sessions where id=p_id for update;
 if not found or auth.uid()=s.owner_id or not cebu_private.reward_staff(s.barangay_id) then raise exception using errcode='42501',message='Assigned staff with MFA required';end if;
 if s.cleanup_event_id is null then raise exception using errcode='42501',message='Independent submissions cannot be reviewed by officers';end if;
 select * into c from public.disposal_claims where owner_id=s.owner_id and request_id=s.request_id and after_id is null;
 if found then
 perform public.review_disposal_claim(c.id,p_approve,p_note);
 select x.* into s from public.scan_reward_sessions x where x.id=p_id;return s;
 end if;
 if s.cleanup_event_id is not null then raise exception using errcode='22023',message='Review cleanup participation to award event points once';end if;
 if p_approve is null or p_note is null or char_length(btrim(p_note)) not between 8 and 500 then raise exception using errcode='22023',message='Review explanation required';end if;
 if s.status in('approved','rejected') then
 if (s.status='approved')<>p_approve then raise exception using errcode='23505',message='Reward already decided';end if;return s;end if;
 if s.status<>'review' or s.verifier is null then raise exception using errcode='22023',message='Wait for evidence verification before reviewing';end if;
 if p_approve then
 if not exists(select 1 from public.account_access a join auth.users u on u.id=a.user_id where a.user_id=s.owner_id and a.enabled and a.product_role='resident' and a.provisioning_state='ready' and u.email_confirmed_at is not null) then raise exception using errcode='42501',message='Eligible resident required';end if;
 insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(s.owner_id,s.points,'scan',s.id,auth.uid());end if;
 update public.scan_reward_sessions set status=case when p_approve then 'approved' else 'rejected' end,reason=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=now() where id=s.id returning * into s;return s;
end;$$;
