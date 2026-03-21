/**
 * S3/MinIO abstraction layer for media storage.
 *
 * Dual setup:
 *  - Development: MinIO running in Docker (forcePathStyle required because MinIO
 *    does not support virtual-hosted-style bucket URLs on localhost).
 *  - Production: AWS S3, using the default credential chain (instance role / env vars).
 *
 * All lot images are uploaded directly from the server using uploadToS3() (server-side
 * resize happens first), then served via getPublicUrl() which points to the public
 * bucket URL. Presigned URLs are provided for admin tooling that needs temporary
 * client-side upload access without exposing permanent credentials.
 *
 * Media variants (thumbnail 400px, medium 800px, large 1600px) are generated at
 * upload time and stored as separate S3 objects; their keys/URLs are persisted in
 * the media table so the CDN can serve them without on-the-fly resizing.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const isProduction = process.env.NODE_ENV === 'production';

export const s3Client = new S3Client(
  isProduction
    ? {
        // AWS S3 in production — uses default credential chain
        region: process.env.AWS_REGION ?? 'eu-central-1',
      }
    : {
        // MinIO in development
        endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
        region: 'us-east-1', // MinIO requires a region but ignores the value
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'omenaa',
          secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'omenaa_dev',
        },
        forcePathStyle: true, // Required for MinIO
      }
);

export const S3_BUCKET = process.env.S3_BUCKET ?? 'omenaa-media';
export const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL ?? 'http://localhost:9000/omenaa-media';

export function getPublicUrl(key: string): string {
  return `${S3_PUBLIC_URL}/${key}`;
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
    }),
  );
  return getPublicUrl(key);
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
  );
}

/**
 * Download an object from S3 as a Buffer.
 * Returns null if the key does not exist.
 */
export async function getFromS3(key: string): Promise<Buffer | null> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    );
    if (!response.Body) return null;
    // Collect streaming body into a Buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err: unknown) {
    const code = (err as { name?: string; Code?: string })?.name ?? (err as { Code?: string })?.Code;
    if (code === 'NoSuchKey' || code === 'NotFound') return null;
    throw err;
  }
}

// Presigned upload URL: lets the admin browser PUT directly to S3/MinIO without
// routing the file through the Next.js server. Expires in 1 h by default.
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
    { expiresIn },
  );
}
