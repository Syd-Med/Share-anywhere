import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFileRequest extends Document {
  userId: Types.ObjectId;
  folderId: Types.ObjectId | null;
  token: string;
  expiresAt: Date;
  maxFiles?: number;
  createdAt: Date;
  updatedAt: Date;
}

const fileRequestSchema = new Schema<IFileRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    maxFiles: { type: Number },
  },
  { timestamps: true, versionKey: false }
);

fileRequestSchema.index({ token: 1 });
fileRequestSchema.index({ expiresAt: 1 });

export const FileRequest = mongoose.model<IFileRequest>('FileRequest', fileRequestSchema);
