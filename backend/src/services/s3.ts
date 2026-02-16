import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

const s3Client = new S3Client({
  region: config.awsRegion,
});

const BUCKET = config.s3Bucket;
const PRESIGN_EXPIRY = 3600; // 1 hour

export async function getUploadPresignedUrl(
  key: string,
  contentType?: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRY });
}

export async function getDownloadPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRY });
}

export async function getThumbnailPresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGN_EXPIRY });
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
