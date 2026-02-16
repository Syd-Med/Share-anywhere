import mongoose, { Document, Schema, Types } from 'mongoose';
import crypto from 'crypto';

export interface IAPIKey extends Document {
  userId: Types.ObjectId;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const apiKeySchema = new Schema<IAPIKey>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    scopes: { type: [String], default: ['files:read', 'files:write'] },
    rateLimit: { type: Number, default: 100 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

apiKeySchema.index({ keyHash: 1 });
apiKeySchema.index({ userId: 1 });

export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateKey(): string {
  return 'sa_' + crypto.randomBytes(32).toString('base64url');
}

export const APIKey = mongoose.model<IAPIKey>('APIKey', apiKeySchema);
