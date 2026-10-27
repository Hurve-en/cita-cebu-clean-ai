import { Directory, File, Paths } from 'expo-file-system';
import { uuid } from './live-model';
import { pendingMedia, type MediaSpool } from './media-model';
const folder = (owner: string) => new Directory(Paths.document, 'cebuclean-pending-media-v1', uuid(owner));
const file = (owner: string, request: string, ext: string) => new File(folder(owner), `${uuid(request)}.${ext}`);
export const mediaSpool: MediaSpool = {
  async list(owner) {
    const dir = folder(owner); if (!dir.exists) return [];
    return dir.list().filter(entry => entry instanceof File && entry.name.endsWith('.json'))
      .map(entry => pendingMedia(JSON.parse((entry as File).textSync()), owner));
  },
  async put(p, bytes) {
    pendingMedia(p,p.owner);
    const metadata = file(p.owner,p.requestId,'json');
    if (metadata.exists) throw Error('This photo already has a pending upload. Retry it first.');
    if (bytes.length !== p.byteSize) throw Error('Photo size mismatch.');
    folder(p.owner).create({idempotent:true,intermediates:true});
    const photo = file(p.owner,p.requestId,'jpg');
    await photo.write(bytes);
    if (photo.size !== bytes.length) throw Error('The retry photo could not be saved on this device.');
    await metadata.write(JSON.stringify(p));
    if (metadata.textSync() !== JSON.stringify(p)) throw Error('The upload retry details could not be saved.');
  },
  async bytes(owner,request) { return file(owner,request,'jpg').bytes(); },
  async drop(owner,request) {
    // Keep the manifest until photo cleanup succeeds; retries remain discoverable.
    const photo=file(owner,request,'jpg');if(photo.exists)photo.delete();
    const metadata=file(owner,request,'json');if(metadata.exists)metadata.delete();
  },
};
