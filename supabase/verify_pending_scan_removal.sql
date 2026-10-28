-- Read-only: no withdrawal, data deletion or automation changes.
select
 has_function_privilege('authenticated','public.withdraw_pending_scan(uuid)','EXECUTE') as resident_withdrawal,
 has_function_privilege('anon','public.withdraw_pending_scan(uuid)','EXECUTE') as anonymous_withdrawal,
 has_function_privilege('authenticated','cebu_private.is_withdrawn_scan(uuid)','EXECUTE') as client_private_helper,
 has_function_privilege('authenticated','public.finish_scan_reward_review(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE') as client_verifier;
-- Expected: true, false, false, false.
