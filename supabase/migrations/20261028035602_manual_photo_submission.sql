-- Source: backend/drizzle/0015_manual_photo_submission.sql
-- Source SHA256: 8c721c9c09b2a6c478dc3a0e239124ee663140eb09425807526f3a11d9d3cb35
BEGIN;
SET LOCAL search_path = public, pg_catalog;
-- Only existing tables, columns and RPC signatures are used. One-photo claims are manual-only.
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
 update public.scan_reward_sessions set before_id=p_before_id,status='review',submitted_at=now(),verifier='manual-review-required',
 reason='Single-photo submission requires officer review; classification does not prove authenticity' where id=s.id;
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
create or replace function public.review_scan_reward(p_id uuid,p_approve boolean,p_note text) returns public.scan_reward_sessions
language plpgsql security definer set search_path='' as $$
declare s public.scan_reward_sessions;target uuid;c public.disposal_claims;
begin
 select owner_id into target from public.scan_reward_sessions where id=p_id;
 perform 1 from public.account_access where user_id=target for update;
 select * into s from public.scan_reward_sessions where id=p_id for update;
 if not found or auth.uid()=s.owner_id or not cebu_private.reward_staff(s.barangay_id) then raise exception using errcode='42501',message='Assigned staff with MFA required';end if;
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
-- CREATE OR REPLACE retains all prior grants. No client can approve a claim.

create or replace function public.start_scan_capture(p_request_id uuid,p_expected_barangay_id uuid,p_cleanup_event_id uuid) returns public.scan_reward_sessions
language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); s public.scan_reward_sessions; cfg public.scan_reward_config; community uuid; amount integer;e public.cleanup_events;
begin
 if p_request_id is null or p_request_id='00000000-0000-0000-0000-000000000000'::uuid then raise exception using errcode='22023',message='Invalid capture request';end if;
 select * into s from public.scan_reward_sessions where owner_id=actor and request_id=p_request_id;
 if found then
 if s.cleanup_event_id is distinct from p_cleanup_event_id then raise exception using errcode='23505',message='Retry must keep the original activity';end if;
 if s.barangay_id is distinct from p_expected_barangay_id then raise exception using errcode='23505',message='Request belongs to another community';end if;return s;end if;
 community:=cebu_private.reward_community(actor);
 if community is distinct from p_expected_barangay_id then raise exception using errcode='22023',message='Your community changed. Reopen the scan';end if;
 if p_cleanup_event_id is not null then
 select * into e from public.cleanup_events where id=p_cleanup_event_id for share;
 if not found or e.barangay_id<>community or e.status<>'published' or now()<e.starts_at
 or not exists(select 1 from public.cleanup_participants where event_id=e.id and owner_id=actor and status in('joined','completed')) then
 raise exception using errcode='22023',message='Choose a cleanup you have already joined';end if;
 end if;
 select * into cfg from public.scan_reward_config where id=1;
 select disposal_points into amount from public.reward_rules where id=1;
 if p_cleanup_event_id is null and not cebu_private.reward_has_daily_room(actor,amount) then raise exception using errcode='22023',message='Daily independent reward limit reached. Sorting guidance is still available';end if;
 if exists(select 1 from public.scan_reward_sessions where owner_id=actor and created_at>now()-interval '60 seconds') then raise exception using errcode='22023',message='Wait one minute before starting another reward capture';end if;
 if (select count(*) from public.scan_reward_sessions where owner_id=actor and created_at>now()-interval '1 hour')>=cfg.hourly_starts
 or (select count(*) from public.scan_reward_sessions where owner_id=actor and created_at>=cebu_private.reward_day_start())>=cfg.daily_starts then
 raise exception using errcode='22023',message='Reward capture rate limit reached. Try later; ordinary sorting remains available';end if;
 insert into public.scan_reward_sessions(owner_id,request_id,barangay_id,fingers,points,expires_at,cleanup_event_id)
 values(actor,p_request_id,community,1+floor(random()*3)::int,amount,
 least(now()+interval '5 minutes',cebu_private.reward_day_start()+interval '1 day',case when e.ends_at>now() then e.ends_at else 'infinity'::timestamptz end),p_cleanup_event_id) returning * into s;return s;
end;$$;

create or replace function public.get_scan_cleanup_options() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); community uuid:=cebu_private.reward_community(actor);
begin
 return jsonb_build_object('server_now',clock_timestamp(),'events',coalesce((select jsonb_agg(to_jsonb(x)) from(
 select e.id,e.barangay_id,e.title,e.location,e.starts_at,e.ends_at,e.points
 from public.cleanup_events e join public.cleanup_participants p on p.event_id=e.id and p.owner_id=actor and p.status in('joined','completed')
 where e.barangay_id=community and e.status='published' and now()>=e.starts_at
 order by e.starts_at desc,e.id desc limit 21)x),'[]'::jsonb));
end;$$;
COMMIT;
