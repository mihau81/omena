import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { uploadToS3, getPublicUrl } from './s3';

interface ImageVariant {
  width: number;
  suffix: string;
}

const VARIANTS: ImageVariant[] = [
  { width: 400, suffix: 'thumb' },
  { width: 800, suffix: 'medium' },
  { width: 1600, suffix: 'large' },
];

export interface ProcessedImage {
  key: string;
  url: string;
  thumbnailUrl: string;
  mediumUrl: string;
  largeUrl: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

export async function processAndUploadImage(
  buffer: Buffer,
  originalFilename: string,
): Promise<ProcessedImage> {
  const id = randomUUID();
  const ext = 'webp';
  const mimeType = 'image/webp';

  // Get original metadata
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  // Upload original as WebP
  const originalKey = `images/${id}/original.${ext}`;
  const originalWebp = await sharp(buffer).webp({ quality: 85 }).toBuffer();
  await uploadToS3(originalKey, originalWebp, mimeType);

  // Generate and upload variants
  const variantUrls: Record<string, string> = {};

  for (const variant of VARIANTS) {
    const variantKey = `images/${id}/${variant.suffix}.${ext}`;

    // Only resize if the original is larger than the target width
    const resized = originalWidth > variant.width
      ? await sharp(buffer)
          .resize(variant.width, undefined, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer()
      : await sharp(buffer).webp({ quality: 80 }).toBuffer();

    await uploadToS3(variantKey, resized, mimeType);
    variantUrls[variant.suffix] = getPublicUrl(variantKey);
  }

  return {
    key: originalKey,
    url: getPublicUrl(originalKey),
    thumbnailUrl: variantUrls['thumb'],
    mediumUrl: variantUrls['medium'],
    largeUrl: variantUrls['large'],
    width: originalWidth,
    height: originalHeight,
    fileSize: originalWebp.length,
    mimeType,
  };
}
