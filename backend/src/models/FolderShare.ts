import mongoose, { Document, Schema, Types } from 'mongoose';

export type FolderSharePermission = 'read' | 'read_write' | 'full';

export interface IFolderShare extends Document {
  folderId: Types.ObjectId;
  ownerId: Types.ObjectId;
  sharedWithUserId: Types.ObjectId;
  permission: FolderSharePermission;
  createdAt: Date;
  updatedAt: Date;
}

const folderShareSchema = new Schema<IFolderShare>(
  {
    folderId: { type: Schema.Types.ObjectId, ref: 'Folder', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWithUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    permission: { type: String, enum: ['read', 'read_write', 'full'], default: 'read' },
  },
  { timestamps: true, versionKey: false }
);

folderShareSchema.index({ folderId: 1 });
folderShareSchema.index({ sharedWithUserId: 1 });
folderShareSchema.index({ folderId: 1, sharedWithUserId: 1 }, { unique: true });

export const FolderShare = mongoose.model<IFolderShare>('FolderShare', folderShareSchema);
