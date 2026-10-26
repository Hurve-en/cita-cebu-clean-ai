import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import Storage from "expo-sqlite/kv-store";
import {
  newRecordId,
  validPhotoName,
  type LocalRecordsAdapter,
} from "./resident-model";
const directory = () =>
  new Directory(Paths.document, "cebuclean-resident-photos");
export function savedPhotoUri(fileName: string): string {
  if (!validPhotoName(fileName)) throw new Error("Invalid saved photo name.");
  return new File(directory(), fileName).uri;
}
export function removeSavedPhoto(fileName: string) {
  const file = new File(savedPhotoUri(fileName));
  if (file.exists) file.delete();
}
async function savePhoto(uri: string): Promise<string> {
  const input = new File(uri);
  if (input.size > 20 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 20 MB.");
  const context = ImageManipulator.manipulate(uri);
  const original = await context.renderAsync();
  const maxSide = Math.max(original.width, original.height);
  if (maxSide > 1280) {
    context.resize(
      original.width >= original.height ? { width: 1280 } : { height: 1280 },
    );
  }
  const rendered = maxSide > 1280 ? await context.renderAsync() : original;
  const output = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.7,
  });
  const temporary = new File(output.uri);
  let destination: File | undefined;
  try {
    if (temporary.size > 2 * 1024 * 1024)
      throw new Error(
        "This photo is too large to save. Choose a smaller image.",
      );
    const folder = directory();
    folder.create({ idempotent: true, intermediates: true });
    const name = `${newRecordId()}.jpg`;
    destination = new File(folder, name);
    temporary.copy(destination);
    if (!destination.exists || destination.size === 0)
      throw new Error("Photo could not be saved.");
    return name;
  } catch (error) {
    try {
      if (destination?.exists) destination.delete();
    } catch {
      /* A failed copy may leave a partial file. */
    }
    throw error;
  } finally {
    // Only delete the temporary JPEG created above, never the original photo.
    try {
      if (output.uri !== uri && temporary.exists) temporary.delete();
    } catch {
      /* OS cache cleanup can run later. */
    }
  }
}
export const localRecords: LocalRecordsAdapter = {
  read: (key) => Storage.getItemSync(key),
  write: (key, value) => Storage.setItemSync(key, value),
  savePhoto,
  deletePhoto: removeSavedPhoto,
};
