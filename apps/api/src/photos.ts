import sharp from 'sharp';
import { imageTypes, MAX_UPLOAD_BYTES } from '../../../packages/shared/src/index.js';
import { HttpError } from './errors.js';
export async function normalizePhoto(file?: { buffer: Buffer; mimetype: string; size: number }): Promise<Buffer> {
  if (!file) throw new HttpError(400, 'Choose a JPEG, PNG, or WebP garment photo.');
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, 'Photos must be 8 MB or smaller.');
  if (!(imageTypes as readonly string[]).includes(file.mimetype)) throw new HttpError(415, 'Use a JPEG, PNG, or WebP photo.');
  try {
    const image = sharp(file.buffer, { limitInputPixels: 25000000, animated: false });
    const meta = await image.metadata();
    const expected: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
    if (meta.format !== expected[file.mimetype] || (meta.pages ?? 1) > 1) throw new Error('Invalid format');
    // Decode, orient, strip metadata, and bound dimensions before private storage and AI.
    return await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw new HttpError(415, 'This photo cannot be read. Use a non-animated JPEG, PNG, or WebP under 25 megapixels.'); }
}
