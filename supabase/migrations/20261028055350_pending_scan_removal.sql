-- Source: backend/drizzle/0018_pending_scan_removal.sql
-- Source SHA256: e9ca96e8156d8744e581d0c98e65fdd84e8b6a3b11f1e14e34fe31f3e4f54351
BEGIN;
SET LOCAL search_path = public, pg_catalog;
-- NEW owner-only withdrawal endpoint. No new fields/tables; deployed migrations stay immutable.
-- A private, server-written verifier marker distinguishes withdrawal from an AI rejection.
create function cebu_private.is_withdrawn_scan(p_media uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.scan_reward_sessions s join public.disposal_claims c
   on c.owner_id=s.owner_id and c.request_id=s.request_id and c.before_id=s.before_id
  join public.resident_media m on m.id=s.before_id and m.owner_id=s.owner_id
  where m.id=p_media and m.kind='scan' and s.cleanup_event_id is null and s.after_id is null and c.after_id is null
   and s.status='rejected' and c.status='rejected' and s.verifier='resident-withdrawal-v1' and s.lease is null
   and c.review_note='Withdrawn by resident; no points awarded'
   and not exists(select 1 from public.reward_ledger l where l.owner_id=s.owner_id and ((l.kind='scan' and l.source_id=s.id) or (l.kind='disposal' and l.source_id=c.id)))
   and not exists(select 1 from public.scan_reward_sessions x where x.id<>s.id and (x.before_id=m.id or x.after_id=m.id))
   and not exists(select 1 from public.disposal_claims x where x.id<>c.id and (x.before_id=m.id or x.after_id=m.id))
 );$$;
revoke all on function cebu_private.is_withdrawn_scan(uuid) from public,anon,authenticated;

create or replace function cebu_private.protect_reward_evidence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (new.state is distinct from old.state or new.kind is distinct from old.kind or new.owner_id is distinct from old.owner_id)
 and exists(select 1 from public.disposal_claims where before_id=old.id or after_id=old.id)
 and not(new.kind=old.kind and new.owner_id=old.owner_id and new.state in('delete_pending','deleted') and cebu_private.is_withdrawn_scan(old.id)) then
 raise exception using errcode='22023',message='Submitted claim evidence is retained for review and audit';end if;
 return new;
end;$$;

create function public.withdraw_pending_scan(p_media_id uuid) returns public.resident_media
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid;m public.resident_media;s public.scan_reward_sessions;c public.disposal_claims;
begin
 -- Same order as worker finalization: config -> account -> session -> claim -> media.
 perform 1 from public.scan_reward_config where id=1 for update;
 actor:=cebu_private.require_media_resident();
 select * into m from public.resident_media where id=p_media_id and owner_id=actor and kind='scan';
 if not found then raise exception using errcode='42501',message='Owned saved scan required';end if;
 if cebu_private.is_withdrawn_scan(m.id) then return m;end if;
 select * into s from public.scan_reward_sessions where owner_id=actor and before_id=m.id for update;
 if not found or s.status<>'pending' or s.cleanup_event_id is not null or s.after_id is not null then
 raise exception using errcode='22023',message='Only an independent photo still waiting for its AI check can be deleted. Refresh history for the current result';end if;
 select * into c from public.disposal_claims where owner_id=actor and request_id=s.request_id and before_id=m.id and after_id is null for update;
 if not found or c.status<>'pending' or m.state<>'ready'
 or exists(select 1 from public.reward_ledger l where l.owner_id=actor and ((l.kind='scan' and l.source_id=s.id) or (l.kind='disposal' and l.source_id=c.id))) then
 raise exception using errcode='22023',message='This submission has already been decided or cannot be withdrawn';end if;
 update public.scan_reward_sessions set status='rejected',reason='Withdrawn by resident; no points awarded',verifier='resident-withdrawal-v1',reviewed_by=null,reviewed_at=now(),lease=null where id=s.id;
 update public.disposal_claims set status='rejected',review_note='Withdrawn by resident; no points awarded',reviewed_by=null,reviewed_at=now() where id=c.id;
 -- Retained request rows prevent quota resets and stale retries from resurrecting this evidence.
 -- This state authorizes the existing Storage API delete + finish protocol, not a fake byte deletion.
 update public.resident_media set state='delete_pending' where id=m.id returning * into m;
 return m;
end;$$;
revoke all on function public.withdraw_pending_scan(uuid) from public,anon;
grant execute on function public.withdraw_pending_scan(uuid) to authenticated;
COMMIT;
