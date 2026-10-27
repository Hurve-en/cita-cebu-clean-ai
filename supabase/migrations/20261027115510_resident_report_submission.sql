-- Source: backend/drizzle/0005_resident_report_submission.sql
-- Source SHA256: e7b35a9b7cbc04bcb482ef937e2b94696ea891ca4d6c6f58f06df7623090a803
BEGIN;
SET LOCAL search_path = public, pg_catalog;
-- Text-only resident command. Ownership, community and state are server controlled.
revoke all on table public.report_submission_receipts from public, anon, authenticated;

create function public.submit_resident_report(
  p_request_id uuid,
  p_expected_barangay_id uuid,
  p_title text,
  p_category_code text,
  p_location_text text,
  p_description text
)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_access public.account_access;
  selected_barangay uuid;
  clean_title text := btrim(regexp_replace(p_title, '[[:space:]]+', ' ', 'g'));
  clean_category text := btrim(p_category_code);
  clean_location text := btrim(regexp_replace(p_location_text, '[[:space:]]+', ' ', 'g'));
  clean_description text := btrim(replace(replace(p_description, chr(13)||chr(10), chr(10)), chr(13), chr(10)), chr(32)||chr(9)||chr(10)||chr(13));
  desired jsonb;
  receipt public.report_submission_receipts;
  saved public.reports;
begin
  if actor is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;
  -- Serialize per resident, including same-key retries. This also coordinates
  -- with existing profile updates (FOR SHARE) and future access mutations.
  select a.* into actor_access from public.account_access a
    where a.user_id=actor for update;
  if not found or actor_access.product_role <> 'resident'
     or not actor_access.enabled or actor_access.provisioning_state <> 'ready'
     or not cebu_private.is_eligible() then
    raise exception using errcode='42501', message='Eligible resident account required';
  end if;
  if p_request_id is null or p_request_id='00000000-0000-0000-0000-000000000000'::uuid
     or p_expected_barangay_id is null
     or p_title is null or char_length(clean_title) not between 3 and 120
     or p_location_text is null or char_length(clean_location) not between 3 and 200
     or p_description is null or char_length(clean_description) not between 10 and 2000
     or clean_description !~ '[^[:space:]]'
     or p_category_code is null or clean_category !~ '^[a-z][a-z0-9_]{1,49}$' then
    raise exception using errcode='22023', message='Invalid report details';
  end if;
  desired := jsonb_build_object('barangay_id',p_expected_barangay_id,'title',clean_title,
    'category_code',clean_category,'location_text',clean_location,'description',clean_description);
  select r.* into receipt from public.report_submission_receipts r
    where r.owner_id=actor and r.request_id=p_request_id;
  if found then
    if receipt.payload <> desired then
      raise exception using errcode='23505', message='Submission key already used with different details';
    end if;
    select r.* into saved from public.reports r where r.id=receipt.report_id and r.owner_id=actor;
    if not found then
      raise exception using errcode='55000', message='Submission receipt requires operator review';
    end if;
    -- A committed receipt remains a safe retry after a community/category change.
    -- Current account eligibility is still required above.
    return jsonb_build_object('request_id',p_request_id,'replayed',true,'report',to_jsonb(saved));
  end if;
  select p.resident_barangay_id into selected_barangay from public.profiles p
    where p.user_id=actor for share;
  if not found or selected_barangay is null or selected_barangay <> p_expected_barangay_id then
    raise exception using errcode='22023', message='Select your current barangay before submitting';
  end if;
  perform 1 from public.barangays b where b.id=selected_barangay and b.enabled for share;
  if not found then
    raise exception using errcode='22023', message='Choose an enabled barangay';
  end if;
  perform 1 from public.report_categories c where c.code=clean_category and c.enabled for share;
  if not found then
    raise exception using errcode='22023', message='Choose an enabled report category';
  end if;
  insert into public.reports(owner_id,original_barangay_id,title,category_code,location_text,description,status)
    values(actor,selected_barangay,clean_title,clean_category,clean_location,clean_description,'pending_review')
    returning * into saved;
  insert into public.report_events(report_id,actor_id,event_type,previous_status,next_status,visibility,note)
    values(saved.id,actor,'created',null,'pending_review','resident','Report submitted');
  insert into public.report_submission_receipts(owner_id,request_id,payload,report_id)
    values(actor,p_request_id,desired,saved.id);
  return jsonb_build_object('request_id',p_request_id,'replayed',false,'report',to_jsonb(saved));
end;
$$;
revoke all on function public.submit_resident_report(uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_resident_report(uuid,uuid,text,text,text,text) to authenticated;

comment on table public.report_submission_receipts is 'Internal retry receipts containing normalized report text; no client table access; retention follows the linked report';
comment on function public.submit_resident_report(uuid,uuid,text,text,text,text) is 'Authenticated resident text submission; atomic report/event/receipt, owner-scoped retry key, no attachments';
COMMIT;
