import app from './app';
import { config } from './config';
import { initSentry } from './utils/sentry';

initSentry();
import { connectMongo } from './db';
import { getRedisClient } from './db/redis';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  try {
    await connectMongo();
    await getRedisClient();

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

start();
