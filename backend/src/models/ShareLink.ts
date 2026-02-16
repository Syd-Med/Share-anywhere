import mongoose, { Document, Schema, Types } from 'mongoose';

export type SharePermission = 'read' | 'full';

export interface IShareLink extends Document {
  fileId: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  passwordHash?: string;
  shareEncryptedFileKey: string; // File key encrypted for share (with token or password)
  permission: SharePermission;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const shareLinkSchema = new Schema<IShareLink>(
  {
    fileId: { type: Schema.Types.ObjectId, ref: 'File', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    passwordHash: { type: String },
    shareEncryptedFileKey: { type: String, required: true },
    permission: { type: String, enum: ['read', 'full'], default: 'full' },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

shareLinkSchema.index({ token: 1 });
shareLinkSchema.index({ expiresAt: 1 });
shareLinkSchema.index({ revokedAt: 1 });

export const ShareLink = mongoose.model<IShareLink>('ShareLink', shareLinkSchema);
