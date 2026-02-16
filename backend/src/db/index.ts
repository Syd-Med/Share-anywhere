import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/share-anywhere';
  try {
    await mongoose.connect(uri);
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err });
    throw err;
  }
}
