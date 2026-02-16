import mongoose, { Document, Schema } from 'mongoose';

export interface IConfig extends Document {
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

const configSchema = new Schema<IConfig>(
  { key: { type: String, required: true, unique: true }, value: { type: String, default: '' } },
  { timestamps: true, versionKey: false }
);

export const Config = mongoose.model<IConfig>('Config', configSchema);
