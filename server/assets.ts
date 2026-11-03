// Profile picture storage. Images are stored under generated names and only
// ever referenced by validated asset ids, never by user-supplied paths.

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';
import type { PhotoAsset } from './latex/generate';
import { ASSET_RE, ASSETS_DIR } from './paths';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function detectType(buf: Buffer): 'png' | 'jpg' | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  return null;
}

export function assetPath(id: string): string {
  if (!ASSET_RE.test(id)) throw new Error('Invalid asset id');
  return path.join(ASSETS_DIR, id);
}

export async function saveImage(buf: Buffer): Promise<string> {
  const type = detectType(buf);
  if (!type) throw new Error('Only PNG and JPEG images are supported.');
  if (buf.length > MAX_IMAGE_BYTES) throw new Error('Image is larger than 8 MB.');
  const size = imageSize(buf);
  if (!size.width || !size.height) throw new Error('Could not read the image dimensions.');
  const id = `img-${randomBytes(8).toString('hex')}.${type}`;
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  await fs.writeFile(assetPath(id), buf);
  return id;
}

export async function loadPhoto(id: string | null): Promise<PhotoAsset | null> {
  if (!id || !ASSET_RE.test(id)) return null;
  const file = assetPath(id);
  try {
    const buf = await fs.readFile(file);
    const size = imageSize(buf);
    const ext = detectType(buf);
    if (!ext || !size.width || !size.height) return null;
    return { sourcePath: file, ext, width: size.width, height: size.height };
  } catch {
    return null;
  }
}
