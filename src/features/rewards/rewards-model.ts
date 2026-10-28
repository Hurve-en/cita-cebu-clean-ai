import { uuid, type Cursor } from '../resident/live-model';
export type Catalog = Cursor & {
    name: string;
    description: string;
    cost: number;
    stock: number;
    enabled: boolean;
};
export type Rules = {
    id: 1;
    disposal_points: number;
    cleanup_points: number;
    daily_claim_limit: number;
};
export type Claim = Cursor & {
    owner_id: string;
    request_id: string;
    barangay_id: string;
    before_id: string;
    after_id: string | null;
    location: string;
    description: string;
    points: number;
    status: 'pending' | 'approved' | 'rejected';
    review_note: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
};
export type Cleanup = Cursor & {
    barangay_id: string;
    title: string;
    location: string;
    instructions: string;
    starts_at: string;
    ends_at: string;
    points: number;
    capacity: number;
    status: 'published' | 'cancelled';
};
export type Participation = Cursor & {
    owner_id: string;
    event_id: string;
    status: 'joined' | 'completed' | 'rejected' | 'cancelled';
    review_note: string;
    cleanup_events?: {
        title: string;
        starts_at: string;
        location: string;
        points: number;
    } | null;
};
export type Redemption = Cursor & {
    owner_id: string;
    request_id: string;
    reward_id: string;
    barangay_id: string;
    reward_name: string;
    cost: number;
    status: 'pending' | 'fulfilled' | 'cancelled';
    review_note: string;
};
export type Ledger = Cursor & {
    owner_id: string;
    amount: number;
    kind: 'disposal' | 'scan' | 'cleanup' | 'redemption' | 'refund';
    source_id: string;
    actor_id: string;
};
export type RewardTable = 'reward_catalog' | 'disposal_claims' | 'cleanup_events' | 'cleanup_participants' | 'reward_redemptions' | 'reward_ledger';
export type Rows = {
    reward_catalog: Catalog;
    disposal_claims: Claim;
    cleanup_events: Cleanup;
    cleanup_participants: Participation;
    reward_redemptions: Redemption;
    reward_ledger: Ledger;
};
export type PendingCommand = {
    version: 1;
    owner: string;
    operation: 'submit_disposal_claim' | 'redeem_reward';
    args: Record<string, string | number | null>;
};
export type PendingStorage = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};
export const pendingKey = (owner: string) => `cebuclean-reward-command-v1:${uuid(owner)}`;
function text(v: unknown, min: number, max: number): string { if (typeof v !== 'string' || v.length < min || v.length > max)
    throw Error('Invalid rewards response.'); return v; }
export function integer(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max)
    throw Error('Invalid rewards amount.'); return v; }
function date(v: unknown) { if (typeof v !== 'string' || !Number.isFinite(Date.parse(v)))
    throw Error('Invalid rewards date.'); return v; }
export function rewardRules(v: unknown): Rules { const r = v as Rules; if (!r || r.id !== 1)
    throw Error('Reward rules unavailable.'); integer(r.disposal_points, 1, 1000); integer(r.cleanup_points, r.disposal_points + 1, 10000); integer(r.daily_claim_limit, 1, 10); return r; }
export function decode<T extends RewardTable>(table: T, value: unknown, owner: string): Rows[T] {
    const r = value as Record<string, unknown>;
    if (!r || typeof r !== 'object')
        throw Error('Invalid rewards response.');
    uuid(r.id);
    date(r.created_at);
    if (!['reward_catalog', 'cleanup_events'].includes(table) && r.owner_id !== owner)
        throw Error('Reward ownership mismatch.');
    if (table === 'reward_catalog') {
        text(r.name, 3, 100);
        text(r.description, 10, 1000);
        integer(r.cost, 1, 1000000);
        integer(r.stock);
        if (r.enabled !== true)
            throw Error('Unavailable reward returned.');
    }
    if (table === 'disposal_claims') {
        uuid(r.request_id);
        uuid(r.barangay_id);
        uuid(r.before_id);
        if(r.after_id!==null)uuid(r.after_id);
        if (r.before_id === r.after_id)
            throw Error('Invalid evidence.');
        text(r.location, 3, 200);
        text(r.description, 10, 2000);
        integer(r.points, 1, 10000);
        if (!['pending', 'approved', 'rejected'].includes(String(r.status)))
            throw Error('Invalid claim status.');
        text(r.review_note, 0, 1000);
        if (r.status === 'pending' && (r.reviewed_by !== null || r.reviewed_at !== null))
            throw Error('Contradictory pending claim.');
        if (r.status !== 'pending') {
            if(r.reviewed_by!==null)uuid(r.reviewed_by);
            date(r.reviewed_at);
            text(r.review_note, 8, 1000);
        }
    }
    if (table === 'cleanup_events') {
        uuid(r.barangay_id);
        text(r.title, 3, 100);
        text(r.location, 3, 200);
        text(r.instructions, 10, 2000);
        date(r.starts_at);
        date(r.ends_at);
        integer(r.points, 2, 10000);
        integer(r.capacity, 1, 10000);
        if (Date.parse(String(r.ends_at)) <= Date.parse(String(r.starts_at)) || !['published', 'cancelled'].includes(String(r.status)))
            throw Error('Invalid cleanup event.');
    }
    if (table === 'cleanup_participants') {
        uuid(r.event_id);
        if (!['joined', 'completed', 'rejected', 'cancelled'].includes(String(r.status)))
            throw Error('Invalid participation status.');
        text(r.review_note, 0, 1000);
        if (r.cleanup_events != null) {
            const e = r.cleanup_events as Record<string, unknown>;
            text(e.title, 3, 100);
            date(e.starts_at);
            text(e.location, 3, 200);
            integer(e.points, 2, 10000);
        }
    }
    if (table === 'reward_redemptions') {
        uuid(r.request_id);
        uuid(r.reward_id);
        uuid(r.barangay_id);
        text(r.reward_name, 3, 100);
        integer(r.cost, 1, 1000000);
        if (!['pending', 'fulfilled', 'cancelled'].includes(String(r.status)))
            throw Error('Invalid redemption status.');
        text(r.review_note, 0, 1000);
    }
    if (table === 'reward_ledger') {
        uuid(r.source_id);
        uuid(r.actor_id);
        integer(r.amount, -1000000, 1000000);
        if (!['disposal', 'scan', 'cleanup', 'redemption', 'refund'].includes(String(r.kind)) || r.amount === 0 || (r.kind === 'redemption') !== (Number(r.amount) < 0))
            throw Error('Invalid points transaction.');
    }
    return r as Rows[T];
}
export function validateCommand(value: unknown, owner: string): PendingCommand {
    const p = value as PendingCommand;
    if (!p || p.version !== 1 || p.owner !== uuid(owner) || !p.args)
        throw Error('Pending rewards request is damaged. It has been preserved.');
    const a = p.args;
    uuid(a.p_request_id);
    uuid(a.p_expected_barangay_id);
    if (a.p_request_id === '00000000-0000-0000-0000-000000000000')
        throw Error('Invalid request key.');
    if (p.operation === 'submit_disposal_claim') {
        uuid(a.p_before_id);
        if(a.p_after_id!==null)uuid(a.p_after_id);
        if (a.p_before_id === a.p_after_id)
            throw Error('Choose different before and after photos.');
        text(a.p_location, 3, 200);
        text(a.p_description, 10, 2000);
        if (Object.keys(a).sort().join(',') !== 'p_after_id,p_before_id,p_description,p_expected_barangay_id,p_location,p_request_id')
            throw Error('Invalid claim arguments.');
    }
    else if (p.operation === 'redeem_reward') {
        uuid(a.p_reward_id);
        integer(a.p_expected_cost, 1, 1000000);
        if (Object.keys(a).sort().join(',') !== 'p_expected_barangay_id,p_expected_cost,p_request_id,p_reward_id')
            throw Error('Invalid redemption arguments.');
    }
    else
        throw Error('Invalid pending operation.');
    return p;
}
