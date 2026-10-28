-- Append-only upgrade after Part 7. Automatic awards default OFF.
insert into public.scan_reward_config(id) values(1);
revoke all on public.scan_reward_config,public.scan_reward_sessions,public.reward_image_fingerprints from public,anon,authenticated;
grant select on public.scan_reward_config,public.scan_reward_sessions to authenticated;
create policy scan_config_read on public.scan_reward_config for select to authenticated using(cebu_private.is_eligible());
create policy scan_session_read on public.scan_reward_sessions for select to authenticated using(cebu_private.is_eligible() and (owner_id=auth.uid() or cebu_private.reward_staff(barangay_id)));
create function cebu_private.reward_day_start() returns timestamptz language sql stable set search_path='' as $$
 select date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';$$;
revoke all on function cebu_private.reward_day_start() from public,anon,authenticated;

create function cebu_private.reward_has_daily_room(p_owner uuid,p_points integer) returns boolean
language sql stable security definer set search_path='' as $$
 select count(l.id)<c.daily_awards and coalesce(sum(l.amount),0)+p_points<=c.daily_points
 from public.scan_reward_config c left join public.reward_ledger l
 on l.owner_id=p_owner and l.kind in ('disposal','scan') and l.created_at>=cebu_private.reward_day_start()
 where c.id=1 group by c.daily_awards,c.daily_points;$$;
revoke all on function cebu_private.reward_has_daily_room(uuid,integer) from public,anon,authenticated;
create function cebu_private.guard_independent_award() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind in ('scan','disposal') then
 perform 1 from public.account_access where user_id=new.owner_id for update;
 if not cebu_private.reward_has_daily_room(new.owner_id,new.amount) then raise exception using errcode='22023',message='Independent disposal daily earning limit reached';end if;
 end if;return new;end;$$;
revoke all on function cebu_private.guard_independent_award() from public,anon,authenticated;
create trigger independent_award_limit before insert on public.reward_ledger for each row execute function cebu_private.guard_independent_award();

create function public.start_reward_scan(p_request_id uuid,p_expected_barangay_id uuid) returns public.scan_reward_sessions
language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); s public.scan_reward_sessions; cfg public.scan_reward_config; community uuid; amount integer;
begin
 if p_request_id is null or p_request_id='00000000-0000-0000-0000-000000000000'::uuid then raise exception using errcode='22023',message='Invalid capture request';end if;
 select * into s from public.scan_reward_sessions where owner_id=actor and request_id=p_request_id;
 if found then
 if s.barangay_id is distinct from p_expected_barangay_id then raise exception using errcode='23505',message='Request belongs to another community';end if;return s;end if;
 community:=cebu_private.reward_community(actor);
 if community is distinct from p_expected_barangay_id then raise exception using errcode='22023',message='Your community changed. Reopen the scan';end if;
 select * into cfg from public.scan_reward_config where id=1;
 select disposal_points into amount from public.reward_rules where id=1;
 if not cebu_private.reward_has_daily_room(actor,amount) then raise exception using errcode='22023',message='Daily independent reward limit reached. Sorting guidance is still available';end if;
 if exists(select 1 from public.scan_reward_sessions where owner_id=actor and created_at>now()-interval '60 seconds') then raise exception using errcode='22023',message='Wait one minute before starting another reward capture';end if;
 if (select count(*) from public.scan_reward_sessions where owner_id=actor and created_at>now()-interval '1 hour')>=cfg.hourly_starts
 or (select count(*) from public.scan_reward_sessions where owner_id=actor and created_at>=cebu_private.reward_day_start())>=cfg.daily_starts then
 raise exception using errcode='22023',message='Reward capture rate limit reached. Try later; ordinary sorting remains available';end if;
 insert into public.scan_reward_sessions(owner_id,request_id,barangay_id,fingers,points,expires_at)
 values(actor,p_request_id,community,1+floor(random()*3)::int,amount,
 least(now()+interval '5 minutes',cebu_private.reward_day_start()+interval '1 day')) returning * into s;return s;
end;$$;
create function public.submit_reward_scan(p_session_id uuid,p_before_id uuid,p_after_id uuid) returns public.scan_reward_sessions
language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident();s public.scan_reward_sessions;b public.resident_media;a public.resident_media;
begin
 select * into s from public.scan_reward_sessions where id=p_session_id and owner_id=actor for update;
 if not found then raise exception using errcode='42501',message='Owned capture session required';end if;
 if s.status<>'capture' then
 if s.before_id is distinct from p_before_id or s.after_id is distinct from p_after_id then raise exception using errcode='23505',message='Retry must use the original photos';end if;return s;end if;
 if now()>=s.expires_at then raise exception using errcode='22023',message='Capture session expired. Start a new live capture';end if;
 if cebu_private.reward_community(actor)<>s.barangay_id then raise exception using errcode='22023',message='Community changed during capture';end if;
 perform 1 from public.resident_media where id in(p_before_id,p_after_id) order by id for update;
 select * into b from public.resident_media where id=p_before_id and owner_id=actor;
 select * into a from public.resident_media where id=p_after_id and owner_id=actor;
 if b.id is null or a.id is null or b.id=a.id or b.kind<>'scan' or a.kind<>'disposal_photo' or b.state<>'ready' or a.state<>'ready'
 or b.request_id<>s.request_id or b.created_at<s.created_at or a.created_at<b.created_at or a.ready_at>s.expires_at or b.ready_at>s.expires_at then
 raise exception using errcode='22023',message='Save a fresh before scan and after photo within this session';end if;
 if exists(select 1 from public.disposal_claims where before_id in(b.id,a.id) or after_id in(b.id,a.id))
 or exists(select 1 from public.scan_reward_sessions x where x.id<>s.id and (x.before_id in(b.id,a.id) or x.after_id in(b.id,a.id))) then raise exception using errcode='23505',message='Evidence already used';end if;
 update public.scan_reward_sessions set before_id=b.id,after_id=a.id,status='pending',submitted_at=now(),reason='Waiting for server verification' where id=s.id returning * into s;return s;
end;$$;

-- A single bounded response uses server time, with separate guidance-only scans.
create function public.get_today_scan_rewards() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); result jsonb;
begin
 select jsonb_build_object('server_now',clock_timestamp(),'day_start',cebu_private.reward_day_start(),
 'earned_points',(select coalesce(sum(amount),0) from public.reward_ledger where owner_id=actor and kind in('disposal','scan') and created_at>=cebu_private.reward_day_start()),
 'awards',(select count(*) from public.reward_ledger where owner_id=actor and kind in('disposal','scan') and created_at>=cebu_private.reward_day_start()),
 'config',(select to_jsonb(c) from public.scan_reward_config c where id=1),
 'activity',coalesce((select jsonb_agg(row_to_json(x)) from (
 select m.id,m.owner_id,m.created_at,m.label,m.score,m.request_id,to_jsonb(m) as media,
 s.id as session_id,s.status,s.reason,s.points,s.fingers,s.expires_at,s.after_id
 from public.resident_media m left join public.scan_reward_sessions s on s.owner_id=actor and (s.before_id=m.id or (s.before_id is null and s.request_id=m.request_id))
 where m.owner_id=actor and m.kind='scan' and m.state='ready' and m.created_at>=cebu_private.reward_day_start()
 order by m.created_at desc,m.id desc limit 100
 ) x),'[]'::jsonb)) into result;return result;
end;$$;

-- Protect linked evidence and extend the unused-evidence library.
create function cebu_private.protect_scan_reward_photo() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state is distinct from old.state and exists(select 1 from public.scan_reward_sessions s where
 (s.before_id=old.id or s.after_id=old.id) and s.status in ('pending','review','approved')) then
 raise exception using errcode='22023',message='Reward verification evidence is retained for review';end if;return new;end;$$;
revoke all on function cebu_private.protect_scan_reward_photo() from public,anon,authenticated;
create trigger scan_reward_evidence_retained before update on public.resident_media for each row execute function cebu_private.protect_scan_reward_photo();
create or replace view public.unused_disposal_photos with (security_invoker=true) as
 select m.* from public.resident_media m where m.kind='disposal_photo' and m.state<>'deleted'
 and not exists(select 1 from public.disposal_claims c where m.id in(c.before_id,c.after_id))
 and not exists(select 1 from public.scan_reward_sessions s where m.id in(s.before_id,s.after_id));

-- Worker has a bounded lease queue. It never accepts a client-supplied owner or award.
create function public.lease_scan_reward_review() returns public.scan_reward_sessions
language plpgsql security definer set search_path='' as $$
declare s public.scan_reward_sessions;
begin
 perform 1 from public.scan_reward_config where id=1 for update;
 if (select coalesce(sum(attempts),0) from public.scan_reward_sessions where leased_at>=cebu_private.reward_day_start())>=100 then return null;end if;
 update public.scan_reward_sessions set status='rejected',reason='Verification could not be completed after three attempts. No points awarded; contact support before retrying',lease=null
 where status='pending' and attempts>=3 and leased_at<now()-interval '2 minutes';
 select * into s from public.scan_reward_sessions where status='pending' and attempts<3 and (leased_at is null or leased_at<now()-interval '2 minutes') order by submitted_at,id limit 1 for update skip locked;
 if not found then return null;end if;
 update public.scan_reward_sessions set lease=gen_random_uuid(),leased_at=now(),attempts=attempts+1 where id=s.id returning * into s;return s;
end;$$;
create function public.finish_scan_reward_review(p_id uuid,p_lease uuid,p_before_sha text,p_after_sha text,p_before_dhash text,p_after_dhash text,p_decision text,p_reason text,p_model text)
returns public.scan_reward_sessions language plpgsql security definer set search_path='' as $$
declare s public.scan_reward_sessions;target uuid;exact_duplicate boolean;near_duplicate boolean;eligible boolean;
begin
 perform 1 from public.scan_reward_config where id=1 for update;
 select owner_id into target from public.scan_reward_sessions where id=p_id;
 perform 1 from public.account_access where user_id=target for update;
 select * into s from public.scan_reward_sessions where id=p_id for update;
 if not found or p_lease is null or s.lease is distinct from p_lease or s.status<>'pending' or s.leased_at<now()-interval '2 minutes' then raise exception using errcode='42501',message='Active verification lease required';end if;
 if p_before_sha is null or p_after_sha is null or p_before_dhash is null or p_after_dhash is null or p_before_sha !~ '^[0-9a-f]{64}$' or p_after_sha !~ '^[0-9a-f]{64}$'
 or p_before_dhash !~ '^[0-9a-f]{16}$' or p_after_dhash !~ '^[0-9a-f]{16}$' or p_decision is null or p_decision not in('eligible','review','reject')
 or p_reason is null or char_length(p_reason) not between 8 and 500 or p_model is null or char_length(p_model) not between 2 and 100 then raise exception using errcode='22023',message='Invalid verification result';end if;
 exact_duplicate:=p_before_sha=p_after_sha or exists(select 1 from public.reward_image_fingerprints where sha256 in(p_before_sha,p_after_sha) and session_id<>s.id);
 near_duplicate:=exists(select 1 from public.reward_image_fingerprints f where f.session_id<>s.id and
 (bit_count(('x'||f.dhash)::bit(64)#('x'||p_before_dhash)::bit(64))<=4 or bit_count(('x'||f.dhash)::bit(64)#('x'||p_after_dhash)::bit(64))<=4));
 insert into public.reward_image_fingerprints values(p_before_sha,s.id,p_before_dhash) on conflict do nothing;
 insert into public.reward_image_fingerprints values(p_after_sha,s.id,p_after_dhash) on conflict do nothing;
 eligible:=not exact_duplicate and not near_duplicate and p_decision='eligible' and (select auto_awards_enabled from public.scan_reward_config where id=1)
 and cebu_private.reward_has_daily_room(s.owner_id,s.points)
 and exists(select 1 from public.account_access a join auth.users u on u.id=a.user_id where a.user_id=s.owner_id and a.product_role='resident' and a.enabled and a.provisioning_state='ready' and u.email_confirmed_at is not null);
 if eligible then insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(s.owner_id,s.points,'scan',s.id,s.owner_id);end if;
 update public.scan_reward_sessions set status=case when exact_duplicate or p_decision='reject' then 'rejected' when eligible then 'approved' else 'review' end,
 reason=case when exact_duplicate then 'Duplicate reward evidence' when near_duplicate then 'Similar reward evidence needs staff review' when p_decision='eligible' and not eligible then 'Verification complete; award requires staff review or daily limit reset' else p_reason end,
 verifier=p_model,reviewed_at=now(),lease=null where id=s.id returning * into s;return s;
end;$$;
-- Explicit worker-only grants. A publishable key or normal JWT cannot mint points.
revoke all on function public.lease_scan_reward_review() from public,anon,authenticated;
revoke all on function public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.lease_scan_reward_review() to service_role;
grant execute on function public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text) to service_role;
revoke all on function public.start_reward_scan(uuid,uuid),public.submit_reward_scan(uuid,uuid,uuid),public.get_today_scan_rewards() from public,anon,authenticated;
grant execute on function public.start_reward_scan(uuid,uuid),public.submit_reward_scan(uuid,uuid,uuid),public.get_today_scan_rewards() to authenticated;

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
  elsif p_kind='disposal_photo' and (select count(*) from public.resident_media r where r.owner_id=actor and r.kind='disposal_photo' and r.state<>'deleted' and not exists(select 1 from public.disposal_claims c where r.id in(c.before_id,c.after_id)) and not exists(select 1 from public.scan_reward_sessions s where r.id in(s.before_id,s.after_id)))>=60 then
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



create function cebu_private.prevent_reward_evidence_reuse() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.scan_reward_sessions s where new.before_id in(s.before_id,s.after_id) or new.after_id in(s.before_id,s.after_id)) then
 raise exception using errcode='23505',message='Evidence already belongs to a reward capture';end if;return new;end;$$;
revoke all on function cebu_private.prevent_reward_evidence_reuse() from public,anon,authenticated;
create trigger claim_scan_evidence_unique before insert on public.disposal_claims for each row execute function cebu_private.prevent_reward_evidence_reuse();
create or replace function cebu_private.can_review_reward_photo(p_media uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.disposal_claims c where p_media in(c.before_id,c.after_id) and cebu_private.reward_staff(c.barangay_id))
 or exists(select 1 from public.scan_reward_sessions s where p_media in(s.before_id,s.after_id) and s.status in('pending','review','approved','rejected') and cebu_private.reward_staff(s.barangay_id));$$;
alter policy reward_evidence_reviewer on public.resident_media using(state='ready' and cebu_private.can_review_reward_photo(id));
create function public.review_scan_reward(p_id uuid,p_approve boolean,p_note text) returns public.scan_reward_sessions
language plpgsql security definer set search_path='' as $$
declare s public.scan_reward_sessions;target uuid;
begin
 select owner_id into target from public.scan_reward_sessions where id=p_id;
 perform 1 from public.account_access where user_id=target for update;
 select * into s from public.scan_reward_sessions where id=p_id for update;
 if not found or auth.uid()=s.owner_id or not cebu_private.reward_staff(s.barangay_id) then raise exception using errcode='42501',message='Assigned staff with MFA required';end if;
 if p_approve is null or p_note is null or char_length(btrim(p_note)) not between 8 and 500 then raise exception using errcode='22023',message='Review explanation required';end if;
 if s.status in('approved','rejected') then
 if (s.status='approved')<>p_approve then raise exception using errcode='23505',message='Reward already decided';end if;return s;end if;
 if s.status<>'review' or s.verifier is null then raise exception using errcode='22023',message='Wait for evidence verification before reviewing';end if;
 if p_approve then
 if not exists(select 1 from public.account_access a join auth.users u on u.id=a.user_id where a.user_id=s.owner_id and a.enabled and a.product_role='resident' and a.provisioning_state='ready' and u.email_confirmed_at is not null) then raise exception using errcode='42501',message='Eligible resident required';end if;
 insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(s.owner_id,s.points,'scan',s.id,auth.uid());end if;
 update public.scan_reward_sessions set status=case when p_approve then 'approved' else 'rejected' end,reason=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=now() where id=s.id returning * into s;return s;
end;$$;
revoke all on function public.review_scan_reward(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.review_scan_reward(uuid,boolean,text) to authenticated;

create or replace function cebu_private.media_storage_access(p_name text,p_action text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); m public.resident_media;
begin
  if actor is null or not cebu_private.is_eligible() then return false; end if;
  if p_action='select' and exists(select 1 from public.resident_media r where p_name=r.owner_id::text||'/'||r.id::text||'.jpg' and r.kind in('disposal_photo','scan') and r.state='ready' and cebu_private.can_review_reward_photo(r.id)) then return true;end if;
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


