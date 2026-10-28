import type { SupabaseClient } from '@supabase/supabase-js';
import { cursorFilter, page, uuid, type Cursor } from '../resident/live-model';
import { decode, integer, pendingKey, rewardRules, validateCommand, type PendingCommand, type PendingStorage, type RewardTable } from './rewards-model';
export function createRewardsService(client: SupabaseClient, storage: PendingStorage) {
    let sending = false;
    async function token(owner: string) { const s = await client.auth.getSession(); if (s.error || s.data.session?.user.id !== uuid(owner))
        throw Error('Your account changed. Reopen Rewards.'); return s.data.session.access_token; }
    async function rpc(owner: string, name: string, args: Record<string, unknown>) { const t = await token(owner); const r = await client.rpc(name, args).setHeader('Authorization', `Bearer ${t}`); await token(owner); return r; }
    function pending(owner: string) { const raw = storage.getItem(pendingKey(owner)); return raw === null ? null : validateCommand(JSON.parse(raw), owner); }
    function persist(p: PendingCommand) { storage.setItem(pendingKey(p.owner), JSON.stringify(p)); const saved = pending(p.owner); if (JSON.stringify(saved) !== JSON.stringify(p))
        throw Error('Could not save the retry request. No request was sent.'); }
    async function send(owner: string, next?: PendingCommand) {
        if (sending)
            throw Error('A rewards request is already being confirmed.');
        sending = true;
        try {
            await token(owner);
            let p = pending(owner);
            if (!p) {
                if (!next)
                    throw Error('No pending request.');
                p = validateCommand(next, owner);
                persist(p);
            }
            else if (next && JSON.stringify(next) !== JSON.stringify(p))
                throw Error('Confirm your earlier pending request before starting another.');
            const result = await rpc(owner, p.operation, p.args);
            if (result.error) {
                // 22023 is a definite transactional validation rejection. Unknown/network,
                // access and key-conflict failures retain the exact original snapshot.
                if (result.error.code === '22023')
                    storage.removeItem(pendingKey(owner));
                throw Error(result.error.code === '22023' ? result.error.message : 'Request could not be confirmed. Use Retry pending request.');
            }
            const value = Array.isArray(result.data) ? result.data.length === 1 ? result.data[0] : null : result.data;
            if (p.operation === 'redeem_reward') {
                const r = decode('reward_redemptions', value, owner);
                if (r.barangay_id !== p.args.p_expected_barangay_id || r.request_id !== p.args.p_request_id || r.reward_id !== p.args.p_reward_id || r.cost !== p.args.p_expected_cost)
                    throw Error('Redemption confirmation mismatch. Retry the pending request.');
            }
            else {
                const r = decode('disposal_claims', value, owner);
                if (r.barangay_id !== p.args.p_expected_barangay_id || r.request_id !== p.args.p_request_id || r.before_id !== p.args.p_before_id || r.after_id !== p.args.p_after_id || r.location !== p.args.p_location || r.description !== p.args.p_description)
                    throw Error('Claim confirmation mismatch. Retry the pending request.');
            }
            storage.removeItem(pendingKey(owner));
            if (pending(owner) !== null)
                throw Error('Saved request confirmed; local cleanup needs retry.');
            return value;
        }
        finally {
            sending = false;
        }
    }
    return {
        pending, send,
        async balance(owner: string) { const r = await rpc(owner, 'get_reward_balance', {}); if (r.error)
            throw Error('Points balance could not be loaded.'); if ((typeof r.data !== 'number' && typeof r.data !== 'string') || !/^\d+$/.test(String(r.data)))
            throw Error('Invalid balance response.'); return integer(Number(r.data)); },
        async rules(owner: string) { const t = await token(owner); const r = await client.from('reward_rules').select('*').eq('id', 1).single().setHeader('Authorization', `Bearer ${t}`); await token(owner); if (r.error)
            throw Error('Earning rules could not be loaded.'); return rewardRules(r.data); },
        async earningInfo(owner:string){const t=await token(owner);const r=await client.from('scan_reward_config').select('auto_awards_enabled,daily_awards,daily_points').eq('id',1).single().setHeader('Authorization',`Bearer ${t}`);await token(owner);if(r.error||!r.data||typeof r.data.auto_awards_enabled!=='boolean')throw Error('Verification rules could not be loaded.');return {enabled:r.data.auto_awards_enabled,awards:integer(r.data.daily_awards,1,10),points:integer(r.data.daily_points,1,1000)};},
        async list<T extends RewardTable>(owner: string, table: T, after?: Cursor) {
            const t = await token(owner);
            let q = client.from(table).select(table === 'cleanup_participants' ? '*,cleanup_events(title,starts_at,location,points)' : '*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(21);
            if (table === 'reward_catalog')
                q = q.eq('enabled', true);
            else if (table !== 'cleanup_events')
                q = q.eq('owner_id', owner);
            if (after)
                q = q.or(cursorFilter(after, false));
            const r = await q.setHeader('Authorization', `Bearer ${t}`);
            await token(owner);
            if (r.error)
                throw Error('Rewards could not be loaded. Check your connection and retry.');
            return page(r.data, v => decode(table, v, owner));
        },
        async join(owner: string, event: string, community: string) { const r = await rpc(owner, 'join_cleanup_event', { p_event_id: uuid(event), p_expected_barangay_id: uuid(community) }); if (r.error)
            throw Error(r.error.code === '22023' ? r.error.message : 'Joining could not be confirmed. Retry joining the same event.'); const row = decode('cleanup_participants', Array.isArray(r.data) ? r.data[0] : r.data, owner); if (row.event_id !== event)
            throw Error('Participation mismatch.'); return row; },
        async withdraw(owner: string, id: string) { const r = await rpc(owner, 'withdraw_cleanup_event', { p_id: uuid(id) }); if (r.error)
            throw Error(r.error.code === '22023' ? r.error.message : 'Withdrawal could not be confirmed. Retry the same registration.'); const row = decode('cleanup_participants', Array.isArray(r.data) ? r.data[0] : r.data, owner); if (row.id !== id || row.status !== 'cancelled')
            throw Error('Withdrawal mismatch.'); return row; },
        async cancel(owner: string, id: string) { const r = await rpc(owner, 'cancel_reward_redemption', { p_id: uuid(id) }); if (r.error)
            throw Error('Cancellation could not be confirmed. Retry the same redemption.'); const row = decode('reward_redemptions', Array.isArray(r.data) ? r.data[0] : r.data, owner); if (row.id !== id || row.status !== 'cancelled')
            throw Error('Cancellation mismatch.'); return row; },
    };
}
export type RewardsService = ReturnType<typeof createRewardsService>;
