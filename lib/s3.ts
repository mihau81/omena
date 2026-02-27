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
          accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'omena',
          secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'omena_dev',
        },
        forcePathStyle: true, // Required for MinIO
      }
);

export const S3_BUCKET = process.env.S3_BUCKET ?? 'omena-media';
export const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL ?? 'http://localhost:9000/omena-media';

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
