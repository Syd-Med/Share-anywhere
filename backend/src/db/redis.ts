import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url });
    redisClient.on('error', (err) => logger.error('Redis error', { error: err }));
    await redisClient.connect();
    logger.info('Redis connected');
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}
