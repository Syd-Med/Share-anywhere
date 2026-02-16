import { startThumbnailWorker, runCleanupJobs } from './workers/thumbnailProcessor';
import { connectMongo } from './db';
import { getRedisClient } from './db/redis';

async function main() {
  console.log('Starting worker process...');
  await connectMongo();
  await getRedisClient();
  startThumbnailWorker();
  setInterval(runCleanupJobs, 60 * 60 * 1000);
  await runCleanupJobs();
  console.log('Worker ready. Processing jobs.');
}

main().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
