import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFile extends Document {
  userId: Types.ObjectId;
  folderId: Types.ObjectId | null;
  fileRequestId?: Types.ObjectId;
  s3Key: string;
  encryptedFileKey?: string; // Placeholder for Phase 3 encryption
  thumbnailKey?: string;
  name: string;
  mimeType: string;
  size: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<IFile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
    fileRequestId: { type: Schema.Types.ObjectId, ref: 'FileRequest' },
    s3Key: { type: String, required: true },
    encryptedFileKey: { type: String },
    name: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

fileSchema.index({ userId: 1 });
fileSchema.index({ folderId: 1 });
fileSchema.index({ deletedAt: 1 });
fileSchema.index({ userId: 1, folderId: 1, name: 1 });

export const File = mongoose.model<IFile>('File', fileSchema);
