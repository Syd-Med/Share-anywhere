import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/share-anywhere',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-too-in-production',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : (process.env.NODE_ENV === 'development' ? 1000 : 100),
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  s3Bucket: process.env.S3_BUCKET || 'share-anywhere',
} as const;
