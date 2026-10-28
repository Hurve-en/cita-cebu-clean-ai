-- Append-only unified Scan upgrade; the original twelve migrations remain immutable.
create function public.start_scan_capture(p_request_id uuid,p_expected_barangay_id uuid,p_cleanup_event_id uuid) returns public.scan_reward_sessions
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
 if not found or e.barangay_id<>community or e.status<>'published' or now()<e.starts_at or now()>=e.ends_at
 or not exists(select 1 from public.cleanup_participants where event_id=e.id and owner_id=actor and status='joined') then
 raise exception using errcode='22023',message='Choose an active cleanup you have already joined';end if;
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
 least(now()+interval '5 minutes',cebu_private.reward_day_start()+interval '1 day',coalesce(e.ends_at,'infinity'::timestamptz)),p_cleanup_event_id) returning * into s;return s;
end;$$;

create or replace function public.start_reward_scan(p_request_id uuid,p_expected_barangay_id uuid) returns public.scan_reward_sessions
language sql security definer set search_path='' as $$ select public.start_scan_capture(p_request_id,p_expected_barangay_id,null);$$;

create function public.get_scan_cleanup_options() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); community uuid:=cebu_private.reward_community(actor);
begin
 return jsonb_build_object('server_now',clock_timestamp(),'events',coalesce((select jsonb_agg(to_jsonb(x)) from(
 select e.id,e.barangay_id,e.title,e.location,e.starts_at,e.ends_at,e.points
 from public.cleanup_events e join public.cleanup_participants p on p.event_id=e.id and p.owner_id=actor and p.status='joined'
 where e.barangay_id=community and e.status='published' and now()>=e.starts_at and now()<e.ends_at
 order by e.starts_at,e.id limit 21)x),'[]'::jsonb));
end;$$;

create or replace function public.submit_reward_scan(p_session_id uuid,p_before_id uuid,p_after_id uuid) returns public.scan_reward_sessions
language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident();s public.scan_reward_sessions;b public.resident_media;a public.resident_media;
begin
 select * into s from public.scan_reward_sessions where id=p_session_id and owner_id=actor for update;
 if not found then raise exception using errcode='42501',message='Owned capture session required';end if;
 if s.status<>'capture' then
 if s.before_id is distinct from p_before_id or s.after_id is distinct from p_after_id then raise exception using errcode='23505',message='Retry must use the original photos';end if;return s;end if;
 if now()>=s.expires_at then raise exception using errcode='22023',message='Capture session expired. Start a new live capture';end if;
 if cebu_private.reward_community(actor)<>s.barangay_id then raise exception using errcode='22023',message='Community changed during capture';end if;
 if s.cleanup_event_id is not null then
 perform 1 from public.cleanup_events e where e.id=s.cleanup_event_id and e.status='published' and now()>=e.starts_at and now()<e.ends_at
 and exists(select 1 from public.cleanup_participants p where p.event_id=e.id and p.owner_id=actor and p.status='joined') for share;
 if not found then raise exception using errcode='22023',message='Cleanup registration or event is no longer active';end if;
 end if;
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

create or replace function public.finish_scan_reward_review(p_id uuid,p_lease uuid,p_before_sha text,p_after_sha text,p_before_dhash text,p_after_dhash text,p_decision text,p_reason text,p_model text)
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
 eligible:=s.cleanup_event_id is null and not exact_duplicate and not near_duplicate and p_decision='eligible' and (select auto_awards_enabled from public.scan_reward_config where id=1)
 and cebu_private.reward_has_daily_room(s.owner_id,s.points)
 and exists(select 1 from public.account_access a join auth.users u on u.id=a.user_id where a.user_id=s.owner_id and a.product_role='resident' and a.enabled and a.provisioning_state='ready' and u.email_confirmed_at is not null);
 if eligible then insert into public.reward_ledger(owner_id,amount,kind,source_id,actor_id) values(s.owner_id,s.points,'scan',s.id,s.owner_id);end if;
 update public.scan_reward_sessions set status=case when exact_duplicate or p_decision='reject' then 'rejected' when eligible then 'approved' else 'review' end,
 reason=case when exact_duplicate then 'Duplicate reward evidence' when near_duplicate then 'Similar reward evidence needs staff review' when s.cleanup_event_id is not null then 'Event evidence checked; cleanup points require officer-confirmed participation' when p_decision='eligible' and not eligible then 'Verification complete; award requires staff review or daily limit reset' else p_reason end,
 verifier=p_model,reviewed_at=now(),lease=null where id=s.id returning * into s;return s;
end;$$;

create or replace function public.review_scan_reward(p_id uuid,p_approve boolean,p_note text) returns public.scan_reward_sessions
language plpgsql security definer set search_path='' as $$
declare s public.scan_reward_sessions;target uuid;
begin
 select owner_id into target from public.scan_reward_sessions where id=p_id;
 perform 1 from public.account_access where user_id=target for update;
 select * into s from public.scan_reward_sessions where id=p_id for update;
 if not found or auth.uid()=s.owner_id or not cebu_private.reward_staff(s.barangay_id) then raise exception using errcode='42501',message='Assigned staff with MFA required';end if;
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

create or replace function public.get_today_scan_rewards() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=cebu_private.require_media_resident(); result jsonb;
begin
 select jsonb_build_object('server_now',clock_timestamp(),'day_start',cebu_private.reward_day_start(),
 'earned_points',(select coalesce(sum(amount),0) from public.reward_ledger where owner_id=actor and kind in('disposal','scan') and created_at>=cebu_private.reward_day_start()),
 'awards',(select count(*) from public.reward_ledger where owner_id=actor and kind in('disposal','scan') and created_at>=cebu_private.reward_day_start()),
 'config',(select to_jsonb(c) from public.scan_reward_config c where id=1),
 'activity',coalesce((select jsonb_agg(row_to_json(x)) from (
 select m.id,m.owner_id,m.created_at,m.label,m.score,m.request_id,to_jsonb(m) as media,
 s.cleanup_event_id,e.title as cleanup_title,p.status as participation_status,
 case when p.status='completed' then e.points else null end as cleanup_awarded_points,
 s.id as session_id,s.status,s.reason,s.points,s.fingers,s.expires_at,s.after_id
 from public.resident_media m left join public.scan_reward_sessions s on s.owner_id=actor and (s.before_id=m.id or (s.before_id is null and s.request_id=m.request_id))
 left join public.cleanup_events e on e.id=s.cleanup_event_id
 left join public.cleanup_participants p on p.event_id=e.id and p.owner_id=actor
 where m.owner_id=actor and m.kind='scan' and m.state='ready' and m.created_at>=cebu_private.reward_day_start()
 order by m.created_at desc,m.id desc limit 100
 ) x),'[]'::jsonb)) into result;return result;
end;$$;
revoke all on function public.start_scan_capture(uuid,uuid,uuid),public.get_scan_cleanup_options() from public,anon,authenticated;
grant execute on function public.start_scan_capture(uuid,uuid,uuid),public.get_scan_cleanup_options() to authenticated;
-- CREATE OR REPLACE retains existing grants on the other RPCs, including service-only finish.
