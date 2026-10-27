import { uuid } from './live-model';
export const MEDIA_BUCKET = 'resident-media';
export const MEDIA_LIMIT = 2 * 1024 * 1024;
export const MODEL_VERSION = 'mobilenetv2-d0744dc70738-v1';
export const MATERIALS = ['glass','metal','non-recyclable','organic','paper','plastic'] as const;
export type MediaKind = 'scan' | 'report_photo';
export type MediaDraft = { kind: MediaKind; reportId: string | null; label: string | null; score: string | null; modelVersion: string | null };
export type PendingMedia = MediaDraft & { version: 1; owner: string; requestId: string; byteSize: number; createdAt: string };
export type MediaRow = { id: string; owner_id: string; request_id: string; kind: MediaKind; report_id: string | null; label: string | null; score: string | null; model_version: string | null; byte_size: number; state: 'uploading'|'ready'|'delete_pending'|'deleted'; created_at: string; ready_at: string | null };
export type MediaSpool = {
  list(owner: string): Promise<PendingMedia[]>;
  put(pending: PendingMedia, bytes: Uint8Array): Promise<void>;
  bytes(owner: string, request: string): Promise<Uint8Array>;
  drop(owner: string, request: string): Promise<void>;
};
export function validateDraft(d: MediaDraft) {
  if (!d || !['scan','report_photo'].includes(d.kind)) throw Error('Invalid media type.');
  if (d.kind === 'scan') {
    if (d.reportId !== null || !MATERIALS.includes(d.label as typeof MATERIALS[number]) || typeof d.score !== 'string' || !/^(0([.][0-9]{1,8})?|1([.]0{1,8})?)$/.test(d.score) || d.modelVersion !== MODEL_VERSION) throw Error('Invalid scan result.');
  } else if (!d.reportId || !uuid(d.reportId) || d.label !== null || d.score !== null || d.modelVersion !== null) throw Error('Invalid report attachment.');
  return d;
}
export function pendingMedia(value: unknown, owner: string): PendingMedia {
  const p = value as PendingMedia;
  if (!p || p.version !== 1 || p.owner !== uuid(owner) || uuid(p.requestId) === '00000000-0000-0000-0000-000000000000' || !Number.isInteger(p.byteSize) || p.byteSize < 1 || p.byteSize > MEDIA_LIMIT || !Number.isFinite(Date.parse(p.createdAt))) throw Error('Saved photo retry data is invalid. It was preserved for review.');
  validateDraft(p); return p;
}
export function mediaRow(value: unknown, owner: string): MediaRow {
  const r = value as MediaRow;
  if (!r || uuid(r.owner_id) !== owner || !uuid(r.id) || !uuid(r.request_id) || !['scan','report_photo'].includes(r.kind) || !['uploading','ready','delete_pending','deleted'].includes(r.state) || !Number.isInteger(r.byte_size) || r.byte_size < 1 || r.byte_size > MEDIA_LIMIT || !Number.isFinite(Date.parse(r.created_at))) throw Error('Photo record could not be verified.');
  if (r.state !== 'deleted') validateDraft({ kind:r.kind, reportId:r.report_id, label:r.label, score:r.score, modelVersion:r.model_version });
  if (r.state === 'ready' && (!r.ready_at || !Number.isFinite(Date.parse(r.ready_at)))) throw Error('Photo is not confirmed saved.');
  return r;
}
export function mediaPath(row: MediaRow) { return `${uuid(row.owner_id)}/${uuid(row.id)}.jpg`; }
export function matchesPending(row: MediaRow, p: PendingMedia) {
  if (row.owner_id !== p.owner || row.request_id !== p.requestId || row.kind !== p.kind || (row.state !== 'deleted' && (row.report_id !== p.reportId || row.label !== p.label || row.score !== p.score || row.model_version !== p.modelVersion || row.byte_size !== p.byteSize))) throw Error('Saved photo confirmation did not match this upload.');
  return row;
}

export const materialLabel=(value:string|null)=>({glass:'Glass',metal:'Metal','non-recyclable':'Non-recyclable',organic:'Organic',paper:'Paper',plastic:'Plastic'}[value??'']??'Scan');
