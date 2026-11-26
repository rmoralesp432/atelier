import { z } from 'zod';
const panorama = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  image: z
    .string()
    .max(8_000_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/),
  width: z.number().int().min(1).max(8192),
  height: z.number().int().min(1).max(4096),
  horizontalAngle: z.number().finite().min(60).max(360),
});
const collection = z.object({
  version: z.literal(1),
  items: z.array(panorama).max(8),
});
export type Panorama = z.infer<typeof panorama>;
export type Panoramas = z.infer<typeof collection>;
export const emptyPanoramas = (): Panoramas => ({ version: 1, items: [] });
export function parsePanoramas(value: unknown): Panoramas {
  if (value === undefined) return emptyPanoramas();
  if (JSON.stringify(value).length > 32_000_000)
    throw new Error('Panoramas exceed this project’s 32 MB photo budget.');
  const result = collection.parse(value);
  if (new Set(result.items.map((p) => p.id)).size !== result.items.length)
    throw new Error('Panorama identities must be unique.');
  return result;
}

/** Decode locally, bound GPU memory, and store a portable photographic view. */
export async function importPanorama(file: File): Promise<Panorama> {
  if (!/\.(jpe?g|png|webp)$/i.test(file.name))
    throw new Error('Choose a JPG, PNG or WebP panorama.');
  if (file.size > 50_000_000)
    throw new Error('Panorama photos must be 50 MB or smaller.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      'This image could not be decoded. Export it as JPG or PNG.',
    );
  }
  try {
    if (bitmap.width / bitmap.height < 1.5)
      throw new Error(
        'Choose a wide panorama, or a 2:1 equirectangular image for a complete 360° view.',
      );
    if (bitmap.width * bitmap.height > 80_000_000)
      throw new Error('Resize this panorama below 80 megapixels first.');
    // A 4096 × 2048 texture works within common iPhone GPU limits.
    const ratio = Math.min(1, 4096 / bitmap.width, 2048 / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Image processing is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.9);
    return panorama.parse({
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Panorama',
      image,
      width: canvas.width,
      height: canvas.height,
      horizontalAngle:
        Math.abs(bitmap.width / bitmap.height - 2) < 0.08 ? 360 : 180,
    });
  } finally {
    bitmap.close();
  }
}
