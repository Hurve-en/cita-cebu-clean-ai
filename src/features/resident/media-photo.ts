import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { toByteArray } from 'base64-js';
import { MEDIA_LIMIT } from './media-model';
export async function preparePhoto(uri: string): Promise<Uint8Array> {
  if (!/^(file:|content:|blob:|data:image\/)/.test(uri)) throw Error('Choose a photo from this device.');
  const context=ImageManipulator.manipulate(uri);
  let rendered=await context.renderAsync();
  try {
    if(Math.max(rendered.width,rendered.height)>1280){
      context.resize(rendered.width>=rendered.height?{width:1280}:{height:1280});
      const resized=await context.renderAsync();
      rendered.release();
      rendered=resized;
    }
    const image=await rendered.saveAsync({format:SaveFormat.JPEG,compress:0.7,base64:true});
    if(!image.base64)throw Error('The photo could not be prepared.');
    const bytes=toByteArray(image.base64);
    if(!bytes.length||bytes.length>MEDIA_LIMIT)throw Error('Choose a smaller photo. Prepared images must be under 2 MB.');
    return bytes;
  } finally { rendered.release(); context.release(); }
}
