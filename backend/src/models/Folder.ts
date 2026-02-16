import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFolder extends Document {
  userId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

const folderSchema = new Schema<IFolder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
    name: { type: String, required: true },
    path: { type: String, default: '/' },
  },
  { timestamps: true, versionKey: false }
);

folderSchema.index({ userId: 1 });
folderSchema.index({ userId: 1, parentId: 1, name: 1 }, { unique: true });

export const Folder = mongoose.model<IFolder>('Folder', folderSchema);
