import { Worker, Job } from 'bullmq';
import { ShareLink } from '../models/ShareLink';
import sharp from 'sharp';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { config } from '../config';
import { File } from '../models/File';
import { User } from '../models/User';
import { thumbnailQueue } from './queues';

const s3Client = new S3Client({ region: config.awsRegion });
const BUCKET = config.s3Bucket;
const THUMB_SIZE = 256;

interface ThumbnailJobData {
  fileId: string;
  s3Key: string;
  mimeType: string;
}

async function streamToBuffer(stream: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getRedisConnection() {
  if (config.redisUrl.startsWith('redis://') || config.redisUrl.startsWith('rediss://')) {
    try {
      const u = new URL(config.redisUrl);
      return {
        host: u.hostname,
        port: parseInt(u.port || '6379', 10),
        password: u.password ? decodeURIComponent(u.password) : undefined,
      };
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  }
  return { host: 'localhost', port: 6379 };
}

export function startThumbnailWorker(): Worker {
  const connection = getRedisConnection();

  const worker = new Worker<ThumbnailJobData>(
    'thumbnail',
    async (job: Job<ThumbnailJobData>) => {
      const { fileId, s3Key, mimeType } = job.data;

      const file = await File.findById(fileId);
      if (!file || file.encryptedFileKey) {
        return { skipped: true, reason: 'File encrypted - no server-side thumbnail' };
      }

      const isImage = mimeType.startsWith('image/');
      if (!isImage) {
        return { skipped: true, reason: 'Not an image' };
      }

      const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
      const obj = await s3Client.send(getCmd);
      if (!obj.Body) throw new Error('Empty object');
      const buffer = await streamToBuffer(obj.Body as AsyncIterable<Uint8Array>);

      const thumbBuffer = await sharp(buffer)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbKey = `thumbnails/${fileId}.jpg`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: 'image/jpeg',
        })
      );

      await File.findByIdAndUpdate(fileId, { thumbnailKey: thumbKey });
      return { success: true, thumbKey };
    },
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Thumbnail job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`Thumbnail job ${job?.id} failed`, err);
  });

  return worker;
}

export async function runCleanupJobs(): Promise<void> {
  const now = new Date();
  await ShareLink.updateMany(
    { expiresAt: { $lt: now }, revokedAt: null },
    { $set: { revokedAt: now } }
  );
  const deletedFiles = await File.find({ deletedAt: { $ne: null } }).lean();
  for (const f of deletedFiles) {
    const user = await User.findById(f.userId).select('deletedRetentionDays').lean();
    const retentionDays = user?.deletedRetentionDays ?? 30;
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    if (f.deletedAt && f.deletedAt < cutoff) {
      await File.deleteOne({ _id: f._id });
    }
  }
}


export async function enqueueThumbnail(data: ThumbnailJobData): Promise<void> {
  await thumbnailQueue.add('generate', data);
}
